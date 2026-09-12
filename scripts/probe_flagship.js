require("dotenv").config();
const { ethers } = require("hardhat");

async function main() {
  const data = JSON.parse(require("fs").readFileSync("deployments.json", "utf8"));
  const c = data.contracts;
  const escrowAddr = c.VerifiedEscrow;
  const meterAddr = c.UsageMeteringRegistry;

  const escrow = await ethers.getContractAt("VerifiedEscrow", escrowAddr);
  const meter = await ethers.getContractAt("UsageMeteringRegistry", meterAddr);

  console.log("--- VerifiedEscrow @", escrowAddr);
  console.log("settlementToken:", await escrow.settlementToken());
  console.log("verifier:", await escrow.verifier());
  console.log("totalLockedUSD:", (await escrow.totalLockedUSD()).toString());
  console.log("escrowCount:", (await escrow.escrowCount()).toString());

  console.log("--- UsageMeteringRegistry (prepaid v2) @", meterAddr);
  console.log("settlementToken:", await meter.settlementToken());
  console.log("verifier:", await meter.verifier());
  console.log("prepaidBalance(demo 0x9afB...):", (await meter.getPrepaidBalance("0x9afB4FAd95d9fEa67615911Ce1fA4C9f13FA8f07")).toString());
  console.log("totalPrepaidSpent(demo):", (await meter.getTotalPrepaidSpent("0x9afB4FAd95d9fEa67615911Ce1fA4C9f13FA8f07")).toString());
  console.log("totalOutstandingDebt(demo):", (await meter.getTotalOutstandingDebt("0x9afB4FAd95d9fEa67615911Ce1fA4C9f13FA8f07")).toString());
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});