// Seed the deployed ReputationAMM with REAL usage:
//   1. resolve the trading pair (cUSD / DEPIN) via the same raw selectors the app uses
//   2. approve both tokens -> ReputationAMM (only if allowance insufficient)
//   3. staticCall addLiquidity() first (never broadcast a failing tx)
//   4. broadcast addLiquidity(5,000 cUSD, 100,000 DEPIN) -> sets the initial ~$0.05 DEPIN price
//   5. broadcast 3 real demo swaps (2x cUSD->DEPIN, 1x DEPIN->cUSD) so the on-chain
//      activity ledger + reserve-ratio price session are real from day one
// Safe to re-run: skips steps already done.
require("dotenv").config();
const { ethers } = require("hardhat");

const AMM_ADDR = "0x81463b6bf1A8DD535c6DAeF034cAb6ee92434c32";
const CUSD_ADDR = "0xdec5170C46DC63D812c699E9dFE6561FFd1BF298";

const LIQ_HELPER_AMOUNT0 = ethers.parseEther("5000"); // 5,000 cUSD
const LIQ_HELPER_AMOUNT1 = ethers.parseEther("100000"); // 100,000 DEPIN

// Raw pair getters the deployed ReputationAMM exposes (mirrors resolveAmmPair()).
const PAIR_SELECTORS = ["0x443ec74d", "0xa4e2096c", "0x5ee04d78"];

const AMM_ABI = [
  "function reserve0() view returns (uint256)",
  "function reserve1() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function getAmountOut(uint256 amountIn, address tokenIn, address user) view returns (uint256)",
  "function addLiquidity(uint256 amount0, uint256 amount1) returns (uint256 liquidity)",
  "function swap(uint256 amount0Out, uint256 amount1Out)",
];

/** ERC20 symbol() eth_call -> string, or null when the address isn't a token. */
async function readSymbol(provider, addr) {
  try {
    const raw = await provider.call({ to: addr, data: "0x95d89b41" });
    if (!raw || raw === "0x" || raw.length < 66) return null;
    const len = Number.parseInt(raw.slice(2 + 64, 2 + 128), 16);
    const hasOffset = raw.slice(2, 2 + 64) === "0".repeat(63) + "20";
    let body = raw.slice(2 + 128);
    if (hasOffset && body.length >= len * 2) body = body.slice(0, len * 2);
    const sym = Buffer.from(body, "hex").toString("utf8").replace(/\0/g, "");
    return sym || null;
  } catch {
    return null;
  }
}

async function main() {
  if (!process.env.PRIVATE_KEY) throw new Error("PRIVATE_KEY missing in .env");
  const [deployer] = await ethers.getSigners();
  const deployerAddr = await deployer.getAddress();

  const provider = ethers.provider;
  const decodeAddr = (hex) => ethers.getAddress("0x" + hex.slice(2).slice(24, 64));

  const rawAddrs = await Promise.all(
    PAIR_SELECTORS.map((sel) => provider.call({ to: AMM_ADDR, data: sel }))
  );
  const pairAddrs = rawAddrs.map(decodeAddr);
  const metas = await Promise.all(
    pairAddrs.map(async (a) => ({ addr: a, symbol: await readSymbol(provider, a) }))
  );
  const tokens = metas.filter((m) => m.symbol && m.symbol !== "TOKEN");
  if (tokens.length !== 2) {
    console.log("unresolvable pair:", JSON.stringify(metas, null, 2));
    throw new Error("AMM pair not resolvable");
  }
  const token0Addr = tokens.find((t) => t.addr.toLowerCase() === CUSD_ADDR.toLowerCase())?.addr || tokens[0].addr;
  const token1Addr = tokens.find((t) => t.addr.toLowerCase() !== CUSD_ADDR.toLowerCase())?.addr;

  console.log("deployer:", deployerAddr);
  console.log("AMM:", AMM_ADDR);
  console.log("cUSD:", token0Addr, "| DEPIN:", token1Addr);

  const amm = await ethers.getContractAt(AMM_ABI, AMM_ADDR, deployer);
  const cUSD = await ethers.getContractAt("MockERC20", token0Addr);
  const depin = await ethers.getContractAt("MockDePINToken", token1Addr);

  const [r0, r1] = await Promise.all([amm.reserve0(), amm.reserve1()]);
  const lpTotal = await amm.balanceOf(deployerAddr);
  console.log("reserves:", ethers.formatEther(r0), "cUSD /", ethers.formatEther(r1), "DEPIN | LP held(deployer):", ethers.formatEther(lpTotal));

  const cusdBal = await cUSD.balanceOf(deployerAddr);
  const depinBal = await depin.balanceOf(deployerAddr);
  console.log("cUSD balance(deployer):", ethers.formatEther(cusdBal), "| DEPIN balance:", ethers.formatEther(depinBal));

  const approve2 = async (token, spender, amount) => {
    const allowance = await token.allowance(deployerAddr, spender);
    if (allowance < amount) {
      const atx = await token.approve(spender, ethers.parseEther("10000000"));
      const ar = await atx.wait();
      console.log("approved", await token.symbol(), "-> AMM (block", ar.blockNumber + ")");
    }
  };

  // ── 1. Seed liquidity (first-time only) ──────────────────────────────────
  if (r0 <= 0n && r1 <= 0n) {
    if (cusdBal < LIQ_HELPER_AMOUNT0) throw new Error("Deployer lacks cUSD to seed the pool");
    if (depinBal < LIQ_HELPER_AMOUNT1) {
      try {
        console.log("minting missing DEPIN to deployer first");
        await (await depin.mint(deployerAddr, LIQ_HELPER_AMOUNT1 - depinBal)).wait();
      } catch {
        console.log("mint unavailable (owner check)");
      }
    }
    await approve2(cUSD, AMM_ADDR, LIQ_HELPER_AMOUNT0);
    await approve2(depin, AMM_ADDR, LIQ_HELPER_AMOUNT1);

    try {
      await amm.addLiquidity.staticCall(LIQ_HELPER_AMOUNT0, LIQ_HELPER_AMOUNT1);
      console.log("staticCall addLiquidity() OK — broadcasting");
    } catch (e) {
      console.log("staticCall addLiquidity() REVERTED — nothing sent, stopping:");
      console.log("  ", e.shortMessage || e.message);
      process.exitCode = 0;
      return;
    }
    const ltx = await amm.addLiquidity(LIQ_HELPER_AMOUNT0, LIQ_HELPER_AMOUNT1);
    const lrcpt = await ltx.wait();
    console.log(
      "seeded",
      ethers.formatEther(LIQ_HELPER_AMOUNT0),
      "cUSD +",
      ethers.formatEther(LIQ_HELPER_AMOUNT1),
      "DEPIN — tx", ltx.hash, "block", lrcpt.blockNumber
    );
  } else {
    console.log("pool already seeded — skipping addLiquidity");
  }

  // ── 2. Demo swaps (only if the ledger has no Swap events yet) ───────────
  // Swap event topic verified against the deployed AMM runtime.
  const SWAP_TOPIC = "0x6d2535bccee43630e01014525de773080b47e1a82c56ef6a30802933a48c9e34";
  const latest = await provider.getBlockNumber();
  let swapLogs = [];
  for (const win of [600000, 300000, 150000, 60000]) {
    try {
      swapLogs = await provider.getLogs({ address: AMM_ADDR, topics: [SWAP_TOPIC], fromBlock: Math.max(1, latest - win), toBlock: "latest" });
      if (swapLogs.length > 0) break;
    } catch {
      /* narrow the window */
    }
  }

  if (swapLogs.length > 0) {
    console.log("swap events already present — skipping demo swaps");
  } else {
    const out = await amm.getAmountOut(ethers.parseEther("1"), token0Addr, deployerAddr);
    console.log("getAmountOut(1 cUSD in) =", ethers.formatEther(out), "DEPIN");

    const doSwap = async (amountIn, tokenInAddr) => {
      const token = tokenInAddr.toLowerCase() === token0Addr.toLowerCase() ? cUSD : depin;
      await approve2(token, AMM_ADDR, amountIn);
      // Uniswap-style swap: input tokens must reach the AMM balance BEFORE swap().
      await (await token.transfer(AMM_ADDR, amountIn)).wait();
      const amtOut = await amm.getAmountOut(amountIn, tokenInAddr, deployerAddr);
      const is0In = tokenInAddr.toLowerCase() === token0Addr.toLowerCase();
      const tx = await amm.swap(is0In ? 0n : amtOut, is0In ? amtOut : 0n, { gasLimit: 500000 });
      const rcpt = await tx.wait();
      console.log(
        "swapped",
        ethers.formatEther(amountIn),
        is0In ? "cUSD ->" : "DEPIN ->",
        ethers.formatEther(amtOut),
        is0In ? "DEPIN" : "cUSD",
        "— tx", tx.hash, "block", rcpt.blockNumber
      );
    };

    await doSwap(ethers.parseEther("500"), token0Addr); // 500 cUSD -> DEPIN
    await doSwap(ethers.parseEther("2000"), token1Addr); // 2,000 DEPIN -> cUSD
    await doSwap(ethers.parseEther("1000"), token0Addr); // 1,000 cUSD -> DEPIN
  }

  // ── 3. Final state ──────────────────────────────────────────────────────
  const blockNow = await provider.getBlockNumber();
  const [fr0, fr1] = await Promise.all([amm.reserve0(), amm.reserve1()]);
  const q1 = await amm.getAmountOut(ethers.parseEther("1"), token0Addr, deployerAddr);
  const q2 = await amm.getAmountOut(ethers.parseEther("1"), token1Addr, deployerAddr);
  console.log("--- final state (block", blockNow + ") ---");
  console.log("reserves:", ethers.formatEther(fr0), "cUSD /", ethers.formatEther(fr1), "DEPIN");
  console.log("DEPIN price (cUSD/DEPIN):", Number.parseFloat((Number(fr0) / Number(fr1)).toFixed(6)));
  console.log("LP held (deployer):", ethers.formatEther(await amm.balanceOf(deployerAddr)));
  console.log("getAmountOut(1 cUSD) =", ethers.formatEther(q1), "DEPIN");
  console.log("getAmountOut(1 DEPIN) =", ethers.formatEther(q2), "cUSD");
  console.log("blockscout AMM:", "https://creditcoin-testnet.blockscout.com/address/" + AMM_ADDR);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});