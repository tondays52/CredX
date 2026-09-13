// Deploy + seed the real on-chain perpetual engine on CC3:
//   1. report the live single-venue mark (ReputationAMM reserve0/reserve1)
//   2. deploy ReputationPerpetual (idempotent via deployments.json)
//   3. seed the insurance pool (sponsor float that is the counterparty of record)
//   4. open two REAL demo positions (1 LONG + 1 SHORT) with the demo-root wallet
//   5. print a projection + funding/risk params
// Safe to re-run: existing deployment/positions are skipped or reported.
require("dotenv").config();
const { ethers } = require("hardhat");

const CREDX_HUB_ADDR = "0x729b2D8B630c4241d051c92D4FeB31412846eE18";
const AMM_ADDR = "0x81463b6bf1A8DD535c6DAeF034cAb6ee92434c32";
const CUSD_ADDR = "0xdec5170C46DC63D812c699E9dFE6561FFd1BF298";
const DEPIN_ADDR = "0x1930302C2fB835d06C9ca3949F2DB6359212E3F4";

const INSURANCE_TOPUP = ethers.parseEther("20000");
const DEMO_LONG = { side: 0, collateral: ethers.parseEther("200"), leverage: 50000 }; // 200 cUSD @ 5x = 1,000 cUSD notional
const DEMO_SHORT = { side: 1, collateral: ethers.parseEther("200"), leverage: 50000 };

const PERP_ABI = [
  "function markPrice() view returns (uint256)",
  "function feeBpsFor(address) view returns (uint256)",
  "function marketInfo() view returns (uint256 mark, uint256 maxLev, uint256 maint, uint256 liqBonus, uint256 maxPos, uint256 maxTotal, uint256 longNotional, uint256 shortNotional, uint256 openCount, uint256 reserveQuote, uint256 reserveBase)",
  "function fundingInfo() view returns (uint256 rateBps, uint256 epochBlocks, uint256 lastBlock, uint256 nextFundingBlock, uint256 acc, uint256 blocksElapsed)",
  "function insurancePool() view returns (uint256)",
  "function positionsOf(address) view returns (uint64[])",
  "function getPosition(uint64) view returns (uint64 id, address owner, uint8 side, uint256 collateral, uint256 notional, uint256 entryMark, uint256 markAtOpen, uint256 fundingAtOpen, uint256 openedAtBlock, bool closed)",
  "function openPosition(uint8 side, uint256 collateral, uint256 leverageBps) returns (uint64)",
  "function closePosition(uint64 id) returns (uint256)",
  "function addMargin(uint64 id, uint256 amount)",
  "function addInsurance(uint256 amount)",
  "function setRiskParams(uint256, uint256, uint256, uint256, uint256)",
  "function setFunding(uint256 rateBps, uint256 epochBlocks)",
  "event PositionOpened(address indexed owner, uint64 id, uint8 side, uint256 collateral, uint256 notional, uint256 entryMark, uint256 openedAtBlock)",
];

function fmt(v, d = 18) {
  return parseFloat(ethers.formatUnits(v, d));
}

async function main() {
  if (!process.env.PRIVATE_KEY) throw new Error("PRIVATE_KEY missing in .env");
  const [signer] = await ethers.getSigners();
  const owner = await signer.getAddress();
  const provider = ethers.provider;

  const cUSD = await ethers.getContractAt("MockERC20", CUSD_ADDR, signer);

  // ── 1. Live mark from the deployed AMM ────────────────────────────────────
  const amm = await ethers.getContractAt(
    ["function reserve0() view returns (uint256)", "function reserve1() view returns (uint256)"],
    AMM_ADDR
  );
  const [r0, r1] = await Promise.all([amm.reserve0(), amm.reserve1()]);
  const SCALE = 10n ** 18n;
  const mark = r0 > 0n && r1 > 0n ? Number((r0 * SCALE) / r1) / 1e18 : 0;
  console.log("--- live state (block", (await provider.getBlockNumber()) + ") ---");
  console.log("AMM reserves:", fmt(r0), "cUSD /", fmt(r1), "DEPIN");
  console.log("DEPIN mark (cUSD/DEPIN):", mark.toFixed(6));

  // ── 2. Deploy (idempotent) ────────────────────────────────────────────────
  const fs = require("fs");
  const path = require("path");
  const depl = path.join(__dirname, "..", "deployments.json");
  const json = JSON.parse(fs.readFileSync(depl, "utf8"));
  let perpAddr = json.contracts?.ReputationPerpetual || null;

  if (perpAddr) {
    console.log("perpetual already deployed:", perpAddr);
  } else {
    const Factory = await ethers.getContractFactory("ReputationPerpetual");
    const c = await Factory.deploy(CREDX_HUB_ADDR, AMM_ADDR, CUSD_ADDR, DEPIN_ADDR);
    await c.waitForDeployment();
    perpAddr = await c.getAddress();
    json.contracts.ReputationPerpetual = perpAddr;
    fs.writeFileSync(depl, JSON.stringify(json, null, 2) + "\n");
    console.log("deployed ReputationPerpetual:", perpAddr, "tx", c.deploymentTransaction().hash);
  }

  const perp = await ethers.getContractAt(PERP_ABI, perpAddr, signer);

  // 10x max leverage, 0.65% maintenance, 5% keeper bonus, market caps.
  await (await perp.setRiskParams(100000, 65, 5, ethers.parseEther("20000"), ethers.parseEther("200000"))).wait();
  console.log("risk params: 10x max | 0.65% maintenance | 5% keeper bonus");

  // ── 3. Seed the insurance pool ────────────────────────────────────────────
  const poolBal = await perp.insurancePool();
  console.log("insurance pool:", fmt(poolBal), "cUSD");
  if (poolBal < INSURANCE_TOPUP) {
    const short = INSURANCE_TOPUP - poolBal;
    const bal = await cUSD.balanceOf(owner);
    if (bal < short) throw new Error("owner lacks cUSD to top up the insurance pool");
    await (await cUSD.approve(perpAddr, short)).wait();
    const tx = await perp.addInsurance(short);
    const rcpt = await tx.wait();
    console.log("insurance top-up:", fmt(short), "cUSD — tx", tx.hash, "block", rcpt.blockNumber);
  } else {
    console.log("insurance pool already seeded — skipping");
  }

  // ── 4. Open TWO real demo positions ───────────────────────────────────────
  const existing = await perp.positionsOf(owner);
  console.log("demo-root open positions:", existing.length);
  if (existing.length === 0) {
    await (await cUSD.approve(perpAddr, ethers.parseEther("1000"))).wait();
    for (const d of [DEMO_LONG, DEMO_SHORT]) {
      const tx = await perp.openPosition(d.side, d.collateral, d.leverage, { gasLimit: 500000 });
      const rcpt = await tx.wait();
      console.log(
        "opened", d.side === 0 ? "LONG " : "SHORT",
        "notional", fmt((d.collateral * BigInt(d.leverage)) / 10000n), "cUSD — tx", tx.hash, "block", rcpt.blockNumber
      );
    }
  } else {
    console.log("positions already open on demo root — skipping open");
  }

  // ── 5. Report ─────────────────────────────────────────────────────────────
  const [m, maxLev, maint, liqBonus, maxPos, maxTotal, ln, sn, oc, qr, br] = await perp.marketInfo();
  const finf = await perp.fundingInfo();
  const fee = await perp.feeBpsFor(owner);
  const num = (v) => Number(v) / 1e18;
  console.log("--- ReputationPerpetual ---");
  console.log("mark:", num(m).toFixed(6), "cUSD/DEPIN | credit fee (bps):", fee.toString());
  console.log("maxLeverage:", (Number(maxLev) / 10000).toString() + "x | maintenance:", (Number(maint) / 100).toString() + "% | keeper bonus:", (Number(liqBonus) / 100).toString() + "% of notional");
  console.log("maxPosNotional:", num(maxPos).toFixed(0), "| maxTotalNotional:", num(maxTotal).toFixed(0), "cUSD");
  console.log("open exposure: LONG", num(ln).toFixed(0), "| SHORT", num(sn).toFixed(0), "| openPositionCount:", oc.toString());
  console.log("funding: rate", finf[0].toString(), "bps / epoch", finf[1].toString(), "blocks | next", finf[3].toString(), "| acc", num(finf[4]).toFixed(6));
  console.log("insurance pool:", fmt(await perp.insurancePool()), "cUSD");
  console.log("payout addr:", perpAddr);
  console.log("blockscout:", "https://creditcoin-testnet.blockscout.com/address/" + perpAddr);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});