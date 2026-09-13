// Live probe: run REAL flash-loan transactions through the deployed
// ReputationFlashBorrower on CC3, exactly as the frontend will:
//   1. mode 0 (audit & return) → must SUCCEED and emit a real FlashLoan event
//   2. mode 1 (AMM round-trip, guarded) → must REVERT atomically (NoProfit) on a
//      constant-product pool — this is the honest "all-or-nothing" property
require("dotenv").config();
const { ethers } = require("hardhat");

const FLASH_LOAN_ADDR = "0x4962e6AdF6E59C60058d09b7cA4516dD2410d637";
const BORROWER_ADDR = "0xb11342835BD710B77C7876AdcC37971d95bC4c57";
const CUSD_ADDR = "0xdec5170C46DC63D812c699E9dFE6561FFd1BF298";

const FLASH_LOAN_ABI = [
  "function flashLoan(address receiver, uint256 amount, bytes data)",
  "event FlashLoan(address indexed receiver, address indexed token, uint256 amount, uint256 fee, uint256 score)",
];
const BORROWER_ABI = [
  "function lastAudit() view returns (uint256 blockNumber, uint256 amount, uint256 fee, uint256 feeBps, uint256 score, uint256 projectedDepin, uint256 projectedBack, bool profitable)",
];
const CUSD_ABI = ["function balanceOf(address) view returns (uint256)"];

async function main() {
  if (!process.env.PRIVATE_KEY) throw new Error("PRIVATE_KEY missing in .env");
  const [signer] = await ethers.getSigners();
  const initiator = await signer.getAddress();
  const provider = ethers.provider;

  const flash = await ethers.getContractAt(FLASH_LOAN_ABI, FLASH_LOAN_ADDR, signer);
  const borrower = await ethers.getContractAt(BORROWER_ABI, BORROWER_ADDR);
  const cusd = await ethers.getContractAt(CUSD_ABI, CUSD_ADDR);

  const floatBefore = await cusd.balanceOf(BORROWER_ADDR);
  const capBefore = await cusd.balanceOf(FLASH_LOAN_ADDR);
  console.log("float before:", ethers.formatEther(floatBefore), "| lender capacity:", ethers.formatEther(capBefore));

  // ── 1. AUDIT & RETURN (mode 0) — should succeed ────────────────────────────
  const amount = ethers.parseEther("20000");
  const data0 = ethers.AbiCoder.defaultAbiCoder().encode(["uint256", "address"], [0, initiator]);
  const gas = await flash.flashLoan.estimateGas(BORROWER_ADDR, amount, data0);
  console.log("mode0 gas estimate:", gas.toString());
  const tx0 = await flash.flashLoan(BORROWER_ADDR, amount, data0, { gasLimit: 600000 });
  const rcpt0 = await tx0.wait();
  const evt0 = rcpt0.logs
    .filter((l) => l.address.toLowerCase() === FLASH_LOAN_ADDR.toLowerCase())
    .map((l) => flash.interface.parseLog(l))
    .find((p) => p && p.name === "FlashLoan");
  console.log("mode0 SUCCESS — tx", tx0.hash, "block", rcpt0.blockNumber);
  if (evt0) {
    const args = evt0.args;
    console.log("  FlashLoan event: receiver", args.receiver, "amount", ethers.formatEther(args.amount), "fee", ethers.formatEther(args.fee), "score", args.score.toString());
  }
  const audit0 = await borrower.lastAudit();
  console.log("  lastAudit:", {
    block: audit0.blockNumber.toString(),
    amount: ethers.formatEther(audit0.amount),
    fee: ethers.formatEther(audit0.fee),
    feeBps: audit0.feeBps.toString(),
    score: audit0.score.toString(),
    projectedDepin: ethers.formatEther(audit0.projectedDepin),
    projectedBack: ethers.formatEther(audit0.projectedBack),
    profitable: audit0.profitable,
  });

  // ── 2. AMM ROUND-TRIP (mode 1) — must REVERT atomically (NoProfit) ────────
  const data1 = ethers.AbiCoder.defaultAbiCoder().encode(["uint256", "address"], [1, initiator]);
  try {
    const tx1 = await flash.flashLoan(BORROWER_ADDR, amount, data1, { gasLimit: 1000000 });
    await tx1.wait();
    console.log("mode1 UNEXPECTED SUCCESS — tx", tx1.hash);
  } catch (e) {
    const reason = e.reason || e.shortMessage || e.message;
    const reverted = String(reason).toLowerCase();
    console.log("mode1 atomic REVERT (honest):", reverted.includes("noprofit") ? "NoProfit()" : reason);
  }

  const floatAfter = await cusd.balanceOf(BORROWER_ADDR);
  const capAfter = await cusd.balanceOf(FLASH_LOAN_ADDR);
  console.log("float after:", ethers.formatEther(floatAfter), "| lender capacity after:", ethers.formatEther(capAfter));
  console.log("float delta (fee absorbed by sponsor float, real):", ethers.formatEther(floatAfter - floatBefore));
  console.log("blockscout flash loan:", "https://creditcoin-testnet.blockscout.com/address/" + FLASH_LOAN_ADDR);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});