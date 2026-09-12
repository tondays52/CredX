require("dotenv").config();
const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

/**
 * One-off Track-2 deploy: RWAInvoiceFinancing against the ALREADY deployed
 * CredXHub + cUSD. Leaves the rest of the stack untouched and merges the new
 * address into both deployment artifacts (deployments.json + frontend/contracts.json).
 */
async function main() {
  const artifactPath = path.join(__dirname, "..", "deployments.json");
  const frontendPath = path.join(__dirname, "..", "frontend", "contracts.json");

  const deployed = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
  const credXHubAddress = deployed.contracts.CredXHub;
  const cUSDAddress = deployed.contracts.cUSD;

  if (!credXHubAddress || !cUSDAddress) {
    throw new Error("deployments.json is missing CredXHub or cUSD addresses");
  }

  console.log("Deploying RWAInvoiceFinancing with hub:", credXHubAddress, "token:", cUSDAddress);

  const RWAInvoiceFinancing = await ethers.getContractFactory("RWAInvoiceFinancing");
  const invoices = await RWAInvoiceFinancing.deploy(credXHubAddress, cUSDAddress);
  await invoices.waitForDeployment();
  const address = await invoices.getAddress();
  console.log("✅ RWAInvoiceFinancing deployed at:", address);

  const netInfo = await ethers.provider.getNetwork();
  const snapshot = {
    ...deployed,
    network: deployed.network || network.name,
    chainId: deployed.chainId || netInfo.chainId.toString(),
    timestamp: new Date().toISOString(),
    contracts: {
      ...deployed.contracts,
      RWAInvoiceFinancing: address,
    },
  };

  fs.writeFileSync(artifactPath, JSON.stringify(snapshot, null, 2));
  if (fs.existsSync(path.join(__dirname, "..", "frontend"))) {
    fs.writeFileSync(frontendPath, JSON.stringify(snapshot, null, 2));
  }
  console.log("💾 Updated deployments.json and frontend/contracts.json");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});