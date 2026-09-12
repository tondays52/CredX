require("dotenv").config();
const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

/**
 * One-off Track-3 deploy: fresh GamingEcosystemHub + game tokens with the
 * ownership fix (hub owns the mocks so gatherResources()/openLootbox() can
 * mint on behalf of players). Leaves the rest of the stack untouched and
 * merges the new addresses into both deployment artifacts.
 */
async function main() {
  const artifactPath = path.join(__dirname, "..", "deployments.json");
  const frontendPath = path.join(__dirname, "..", "frontend", "contracts.json");

  const deployed = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
  const credXHubAddress = deployed.contracts.CredXHub;

  if (!credXHubAddress) {
    throw new Error("deployments.json is missing CredXHub address");
  }

  console.log("Deploying gaming stack with hub:", credXHubAddress);

  const MockGameToken = await ethers.getContractFactory("MockGameToken");
  const gameToken = await MockGameToken.deploy();
  await gameToken.waitForDeployment();
  const gameTokenAddress = await gameToken.getAddress();
  console.log("✅ MockGameToken deployed at:", gameTokenAddress);

  const MockGameItem = await ethers.getContractFactory("MockGameItem");
  const gameNFT = await MockGameItem.deploy();
  await gameNFT.waitForDeployment();
  const gameNFTAddress = await gameNFT.getAddress();
  console.log("✅ MockGameItem deployed at:", gameNFTAddress);

  const GamingEcosystemHub = await ethers.getContractFactory("GamingEcosystemHub");
  const gamingHub = await GamingEcosystemHub.deploy(credXHubAddress, gameTokenAddress, gameNFTAddress);
  await gamingHub.waitForDeployment();
  const gamingHubAddress = await gamingHub.getAddress();
  console.log("✅ GamingEcosystemHub deployed at:", gamingHubAddress);

  const t1 = await gameToken.transferOwnership(gamingHubAddress);
  await t1.wait();
  const t2 = await gameNFT.transferOwnership(gamingHubAddress);
  await t2.wait();
  console.log("🔑 Transferred gameToken & gameNFT ownership to GamingEcosystemHub");

  const netInfo = await ethers.provider.getNetwork();
  const snapshot = {
    ...deployed,
    network: deployed.network || network.name,
    chainId: deployed.chainId || netInfo.chainId.toString(),
    timestamp: new Date().toISOString(),
    contracts: {
      ...deployed.contracts,
      GamingEcosystemHub: gamingHubAddress,
      GameToken: gameTokenAddress,
      GameNFT: gameNFTAddress,
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