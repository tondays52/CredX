require("dotenv").config();
const { ethers, network } = require("hardhat");
const fs = require("fs");
const path = require("path");

/**
 * Deploys BlockProverAttestationOracle — the real, on-chain Attestcoin Protocol (USC)
 * integration that wraps Creditcoin's BlockProver precompile 0x0FD2 and ChainInfo
 * precompile 0x0FD3.
 *
 * On Creditcoin L1 networks the contract talks to the real precompiles; the canonical
 * precompile addresses are passed explicitly so the deployment artifact is unambiguous.
 */
async function main() {
  console.log("==================================================");
  console.log(`   🚀 Deploying BlockProverAttestationOracle to [${network.name}]`);
  console.log("==================================================");

  const [deployer] = await ethers.getSigners();
  if (!deployer) {
    throw new Error("No deployer account found. Check your private key configuration in .env.");
  }

  const balanceWei = await ethers.provider.getBalance(deployer.address);
  console.log("Deployer account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(balanceWei), "native tokens");
  if (balanceWei === 0n) {
    throw new Error("Deployer has zero balance on this network; cannot deploy.");
  }

  const blockProver = "0x0000000000000000000000000000000000000FD2";
  const chainInfo = "0x0000000000000000000000000000000000000FD3";

  console.log("\n1. Deploying BlockProverAttestationOracle...");
  console.log("   BlockProver precompile (0x0FD2):", blockProver);
  console.log("   ChainInfo precompile  (0x0FD3):", chainInfo);

  const Oracle = await ethers.getContractFactory("BlockProverAttestationOracle");
  const oracle = await Oracle.deploy(blockProver, chainInfo);
  await oracle.waitForDeployment();
  const oracleAddress = await oracle.getAddress();
  console.log("   ✅ BlockProverAttestationOracle deployed at:", oracleAddress);

  // Best-effort source verification on Blockscout.
  try {
    console.log("\n2. Attempting Blockscout source verification...");
    await hre.run("verify:verify", {
      address: oracleAddress,
      constructorArguments: [blockProver, chainInfo],
    });
    console.log("   ✅ Contract verified on Blockscout.");
  } catch (err) {
    console.warn("   ⚠️ Verification skipped/failed (non-fatal):", err.message.split("\n")[0]);
  }

  // Merge into deployment artifacts (preserve existing entries).
  const deploymentFile = path.join(__dirname, "../deployments.json");
  const artifact = fs.existsSync(deploymentFile)
    ? JSON.parse(fs.readFileSync(deploymentFile, "utf8"))
    : { network: network.name };

  artifact.network = network.name;
  artifact.contracts = artifact.contracts || {};
  artifact.contracts.BlockProverAttestationOracle = oracleAddress;
  artifact.attestcoin = {
    integration: "real-usc-blockprover",
    blockProverPrecompile: blockProver,
    chainInfoPrecompile: chainInfo,
    notes:
      "Live Attestcoin Protocol integration: BlockProverAttestationOracle wraps Creditcoin's " +
      "0x0FD2 BlockProver precompile (verify / verifyAndEmit / TransactionVerified) and 0x0FD3 " +
      "ChainInfo precompile. Source-chain txs (e.g. Ethereum Sepolia) are Merkle+continuity " +
      "verified against Creditcoin attestations; see scripts/usc-verify-real.js and " +
      "node_modules/@gluwa/usc-sdk.",
    deployedAt: new Date().toISOString(),
  };

  fs.writeFileSync(deploymentFile, JSON.stringify(artifact, null, 2));

  const frontendFile = path.join(__dirname, "../frontend/contracts.json");
  if (fs.existsSync(frontendFile)) {
    fs.writeFileSync(frontendFile, JSON.stringify(artifact, null, 2));
  }

  const logFile = path.join(__dirname, "../deploy_log.json");
  const logs = fs.existsSync(logFile) ? JSON.parse(fs.readFileSync(logFile, "utf8")) : [];
  logs.push({
    contract: "BlockProverAttestationOracle",
    network: network.name,
    chainId: (await ethers.provider.getNetwork()).chainId.toString(),
    address: oracleAddress,
    blockProverPrecompile: blockProver,
    chainInfoPrecompile: chainInfo,
    timestamp: new Date().toISOString(),
    txHash: oracle.deploymentTransaction().hash,
  });
  fs.writeFileSync(logFile, JSON.stringify(logs, null, 2));

  console.log("\n   💾 Updated deployments.json, frontend/contracts.json, deploy_log.json");
  console.log("\n==================================================");
  console.log("   🎉 BlockProverAttestationOracle (real 0x0FD2 integration) deployed!");
  console.log("   → Run `node scripts/usc-verify-real.js` for a live USC proof.");
  console.log("==================================================");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});