// scripts/deploy_flagship.js
// Deploys the flagship VerifiedEscrow + the prepaid-metered UsageMeteringRegistry
// v2 on the active network (creditcoinTestnet in production; hardhat for local
// checks) and patches deployments.json + frontend/contracts.json.
//
// NOTE: the meter registry is redeployed (new address) because the prepaid
// credit fields are part of the same contract. Any consumer must be pointed at
// the new address (frontend + docs).
require("dotenv").config();
const { ethers, network } = require("hardhat");
const fs = require("fs");
const path = require("path");

const rootJson = path.join(__dirname, "../deployments.json");
const frontendJson = path.join(__dirname, "../frontend/contracts.json");

async function main() {
  console.log(`Verified Escrow + Prepaid Meter deploy → [${network.name}]`);
  const [deployer] = await ethers.getSigners();
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("deployer", deployer.address, "balance", ethers.formatEther(balance), "native");

  const base = JSON.parse(fs.readFileSync(rootJson, "utf8"));
  const c = base.contracts || {};
  const cUSD = c.cUSD;
  const hub = c.CredXHub;
  const verifier = c.AttestationVerifier;
  if (!cUSD || !hub || !verifier) throw new Error("deployments.json missing core addresses");

  const VerifiedEscrow = await ethers.getContractFactory("VerifiedEscrow");
  const escrow = await VerifiedEscrow.deploy(cUSD, verifier);
  await escrow.waitForDeployment();
  const escrowAddr = await escrow.getAddress();
  console.log("✅ VerifiedEscrow", escrowAddr);

  const UsageMeteringRegistry = await ethers.getContractFactory("UsageMeteringRegistry");
  const meter = await UsageMeteringRegistry.deploy(cUSD, verifier, hub);
  await meter.waitForDeployment();
  const meterAddr = await meter.getAddress();
  console.log("✅ UsageMeteringRegistry (prepaid v2)", meterAddr);

  const patch = { VerifiedEscrow: escrowAddr, UsageMeteringRegistry: meterAddr };
  for (const f of [rootJson, frontendJson]) {
    const data = JSON.parse(fs.readFileSync(f, "utf8"));
    data.contracts = { ...data.contracts, ...patch };
    data.timestamp = new Date().toISOString();
    fs.writeFileSync(f, JSON.stringify(data, null, 2));
  }
  console.log("💾 patched deployments.json + frontend/contracts.json");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});