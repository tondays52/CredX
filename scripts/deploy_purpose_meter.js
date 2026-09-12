// scripts/deploy_purpose_meter.js
// Deploys PurposeBoundFunding + UsageMeteringRegistry on the active network
// (creditcoinTestnet in production; hardhat for local checks) and patches
// deployments.json + frontend/contracts.json with the new addresses.
require("dotenv").config();
const { ethers, network } = require("hardhat");
const fs = require("fs");
const path = require("path");

const rootJson = path.join(__dirname, "../deployments.json");
const frontendJson = path.join(__dirname, "../frontend/contracts.json");

async function main() {
  console.log(`Purpose-Bound Funding + Usage Meter deploy → [${network.name}]`);
  const [deployer] = await ethers.getSigners();
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("deployer", deployer.address, "balance", ethers.formatEther(balance), "native");

  const base = JSON.parse(fs.readFileSync(rootJson, "utf8"));
  const c = base.contracts || {};
  const cUSD = c.cUSD;
  const hub = c.CredXHub;
  const engine = c.CreditScoreEngine;
  const verifier = c.AttestationVerifier;
  if (!cUSD || !hub || !engine || !verifier) throw new Error("deployments.json missing core addresses");

  const PurposeBoundFunding = await ethers.getContractFactory("PurposeBoundFunding");
  const fund = await PurposeBoundFunding.deploy(cUSD, hub, engine, verifier);
  await fund.waitForDeployment();
  const fundAddr = await fund.getAddress();
  console.log("✅ PurposeBoundFunding", fundAddr);

  const UsageMeteringRegistry = await ethers.getContractFactory("UsageMeteringRegistry");
  const meter = await UsageMeteringRegistry.deploy(cUSD, verifier, hub);
  await meter.waitForDeployment();
  const meterAddr = await meter.getAddress();
  console.log("✅ UsageMeteringRegistry", meterAddr);

  const patch = { PurposeBoundFunding: fundAddr, UsageMeteringRegistry: meterAddr };
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