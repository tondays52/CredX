// Seed the deployed ReputationFlashLoan with REAL usage:
//   1. verify TOKEN() is cUSD and read the live credit tier of the initiator
//   2. fund the lender with cUSD so real flash-loan capacity exists on-chain
//   3. deploy ReputationFlashBorrower (the ERC-3156 receiver the app borrows into)
//   4. seed the receiver's executor float (sponsor capital that covers the live fee)
// Safe to re-run: skips steps already done.
require("dotenv").config();
const { ethers } = require("hardhat");

const FLASH_LOAN_ADDR = "0x4962e6AdF6E59C60058d09b7cA4516dD2410d637";
const CUSD_ADDR = "0xdec5170C46DC63D812c699E9dFE6561FFd1BF298";
const DEPIN_ADDR = "0x1930302C2fB835d06C9ca3949F2DB6359212E3F4";
const CREDX_HUB_ADDR = "0x729b2D8B630c4241d051c92D4FeB31412846eE18";
const AMM_ADDR = "0x81463b6bf1A8DD535c6DAeF034cAb6ee92434c32";

const FUND_TARGET = ethers.parseEther("250000"); // real capacity on the lender
const EXECUTOR_FLOAT = ethers.parseEther("5000"); // sponsor float on the receiver

const FLASH_LOAN_ABI = [
  "function TOKEN() view returns (address)",
  "function CREDX_HUB() view returns (address)",
  "function CALLBACK_SUCCESS() view returns (bytes32)",
  "function flashLoan(address receiver, uint256 amount, bytes data)",
];
const HUB_ABI = [
  "function getBorrowerProfile(address) view returns (uint256 creditScore, uint256 totalVerifiedVolumeUSD, uint256 totalAttestationsCount, uint256 maxCreditLineUSD, uint256 requiredCollateralRatioBps, uint256 lastAttestationTimestamp)",
];

function feeTier(score) {
  if (score >= 780) return { bps: 1, label: "SUPER_PRIME (1 bp)" };
  if (score >= 650) return { bps: 5, label: "PRIME (5 bps)" };
  return { bps: 9, label: "STANDARD (9 bps)" };
}

async function main() {
  if (!process.env.PRIVATE_KEY) throw new Error("PRIVATE_KEY missing in .env");
  const [signer] = await ethers.getSigners();
  const initiator = await signer.getAddress();
  const provider = ethers.provider;

  const flash = await ethers.getContractAt(FLASH_LOAN_ABI, FLASH_LOAN_ADDR, signer);
  const [tokenAddr, hubAddr] = await Promise.all([flash.TOKEN(), flash.CREDX_HUB()]);
  if (tokenAddr.toLowerCase() !== CUSD_ADDR.toLowerCase()) {
    throw new Error("Unexpected TOKEN on ReputationFlashLoan: " + tokenAddr);
  }
  const cUSD = await ethers.getContractAt("MockERC20", CUSD_ADDR, signer);
  const depin = await ethers.getContractAt("MockDePINToken", DEPIN_ADDR);

  console.log("--- live state (block", (await provider.getBlockNumber()) + ") ---");
  console.log("initiator (demo root):", initiator);
  console.log("flash loan:", FLASH_LOAN_ADDR, "| token:", tokenAddr, "| hub:", hubAddr);

  // ── 1. Credit tier of the initiator (real, drives the live flash fee) ─────
  const hub = await ethers.getContractAt(HUB_ABI, hubAddr);
  const profile = await hub.getBorrowerProfile(initiator);
  const score = Number(profile.creditScore);
  const tier = feeTier(score);
  console.log("credit score:", score, "| flash fee tier:", tier.label, "| maxCreditLine:", ethers.formatEther(profile.maxCreditLineUSD));
  console.log("CALLBACK_SUCCESS:", await flash.CALLBACK_SUCCESS());

  // ── 2. Fund the lender so real borrow capacity exists ─────────────────────
  const held = await cUSD.balanceOf(FLASH_LOAN_ADDR);
  console.log("cUSD held by ReputationFlashLoan:", ethers.formatEther(held));
  if (held < FUND_TARGET) {
    const short = FUND_TARGET - held;
    const bal = await cUSD.balanceOf(initiator);
    if (bal < short) throw new Error("Initiator lacks cUSD to fund the lender");
    const tx = await cUSD.transfer(FLASH_LOAN_ADDR, short);
    const rcpt = await tx.wait();
    console.log("funded lender with", ethers.formatEther(short), "cUSD — tx", tx.hash, "block", rcpt.blockNumber);
  } else {
    console.log("lender already funded — skipping");
  }

  // ── 3. Deploy ReputationFlashBorrower (idempotent via deployments.json) ────
  const fs = require("fs");
  const path = require("path");
  const depl = path.join(__dirname, "..", "deployments.json");
  const json = JSON.parse(fs.readFileSync(depl, "utf8"));
  let borrowerAddr = json.contracts?.ReputationFlashBorrower || null;

  if (borrowerAddr) {
    console.log("borrower already deployed:", borrowerAddr);
  } else {
    const Factory = await ethers.getContractFactory("ReputationFlashBorrower");
    const c = await Factory.deploy(CREDX_HUB_ADDR, AMM_ADDR, FLASH_LOAN_ADDR, CUSD_ADDR, DEPIN_ADDR, initiator);
    await c.waitForDeployment();
    borrowerAddr = await c.getAddress();
    json.contracts.ReputationFlashBorrower = borrowerAddr;
    fs.writeFileSync(depl, JSON.stringify(json, null, 2) + "\n");
    console.log("deployed ReputationFlashBorrower:", borrowerAddr, "tx", c.deploymentTransaction().hash);
  }

  // ── 4. Seed the executor float on the receiver ────────────────────────────
  const floatHeld = await cUSD.balanceOf(borrowerAddr);
  console.log("executor float held by borrower:", ethers.formatEther(floatHeld));
  if (floatHeld < EXECUTOR_FLOAT) {
    const short = EXECUTOR_FLOAT - floatHeld;
    const tx = await cUSD.transfer(borrowerAddr, short);
    const rcpt = await tx.wait();
    console.log("seeded float with", ethers.formatEther(short), "cUSD — tx", tx.hash, "block", rcpt.blockNumber);
  }

  // ── 5. Real sample projection via the deployed receiver ───────────────────
  const B_ABI = [
    "function lastAudit() view returns (uint256 blockNumber, uint256 amount, uint256 fee, uint256 feeBps, uint256 score, uint256 projectedDepin, uint256 projectedBack, bool profitable)",
    "function projectRoundTrip(uint256 amount) view returns (uint256 depinOut, uint256 cusdBack)",
    "function ammFeeBps() view returns (uint256)",
    "function reputationFeeBps(address) view returns (uint256)",
  ];
  const b = await ethers.getContractAt(B_ABI, borrowerAddr);
  const sample = ethers.parseEther("1000"); // 1,000 cUSD borrow sample
  const [depinOut, cusdBack] = await b.projectRoundTrip(sample);
  const feeBps = await b.reputationFeeBps(initiator);
  console.log("sample borrow 1,000 cUSD:");
  console.log("  AMM receiver fee (bps):", (await b.ammFeeBps()).toString());
  console.log("  projected cUSD->DEPIN:", ethers.formatEther(depinOut), "DEPIN");
  console.log("  projected DEPIN->cUSD:", ethers.formatEther(cusdBack), "cUSD");
  console.log("  flash fee (1bp):", ethers.formatEther((sample * BigInt(feeBps)) / 10000n), "cUSD");
  console.log("  round-trip net:", ethers.formatEther(BigInt(cusdBack) - sample), "cUSD (negative = atomic-guard reverts, honest)");

  const finalBal = await cUSD.balanceOf(FLASH_LOAN_ADDR);
  console.log("--- final state ---");
  console.log("cUSD capacity in ReputationFlashLoan:", ethers.formatEther(finalBal));
  console.log("borrower:", borrowerAddr);
  console.log("blockscout borrower:", "https://creditcoin-testnet.blockscout.com/address/" + borrowerAddr);
  console.log("blockscout flash loan:", "https://creditcoin-testnet.blockscout.com/address/" + FLASH_LOAN_ADDR);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});