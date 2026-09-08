require("dotenv").config();
const { ethers, network } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("==================================================");
  console.log(`   🚀 Deploying CredX Protocol to [${network.name}]`);
  console.log("==================================================");

  const [deployer] = await ethers.getSigners();
  if (!deployer) {
    throw new Error("No deployer account found. Check your private key configuration in .env.");
  }

  const balanceWei = await ethers.provider.getBalance(deployer.address);
  console.log("Deployer account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(balanceWei), "native tokens");

  if (balanceWei === 0n && network.name !== "hardhat" && network.name !== "localhost") {
    console.warn("\n⚠️  WARNING: Deployer account has 0 balance! Transactions will fail without gas funds.");
    console.warn("   Please fund your account with testnet CTC tokens before deploying.\n");
  }

  // 1. Resolve Attestation Verifier (Mock vs Native Creditcoin Precompile 0x0FD2)
  const isCreditcoinNetwork = network.name.toLowerCase().includes("creditcoin");
  let oracleAddress;

  if (isCreditcoinNetwork && !process.env.FORCE_MOCK_ORACLE) {
    // Creditcoin L1 native consensus precompile
    const rawAddress = process.env.ATTESTCOIN_PRECOMPILE || "0x0000000000000000000000000000000000000FD2";
    oracleAddress = ethers.getAddress(rawAddress);
    console.log(`\n1. Using Native Creditcoin Attestcoin Precompile at: ${oracleAddress}`);
  } else {
    console.log("\n1. Deploying MockAttestationOracle (Simulating Creditcoin Precompile 0x0FD2)...");
    const MockAttestationOracle = await ethers.getContractFactory("MockAttestationOracle");
    const oracle = await MockAttestationOracle.deploy();
    await oracle.waitForDeployment();
    oracleAddress = await oracle.getAddress();
    console.log("   ✅ MockAttestationOracle deployed at:", oracleAddress);
  }

  // 2. Deploy CreditScoreEngine (OCCR Multi-Factor Model)
  console.log("\n2. Deploying CreditScoreEngine (OCCR Multi-Factor Model)...");
  const CreditScoreEngine = await ethers.getContractFactory("CreditScoreEngine");
  const scoreEngine = await CreditScoreEngine.deploy();
  await scoreEngine.waitForDeployment();
  const scoreEngineAddress = await scoreEngine.getAddress();
  console.log("   ✅ CreditScoreEngine deployed at:", scoreEngineAddress);

  // 3. Deploy CredXHub (Central Registry & Batch Importer)
  console.log("\n3. Deploying CredXHub...");
  const CredXHub = await ethers.getContractFactory("CredXHub");
  const credXHub = await CredXHub.deploy(oracleAddress, scoreEngineAddress);
  await credXHub.waitForDeployment();
  const credXHubAddress = await credXHub.getAddress();
  console.log("   ✅ CredXHub deployed at:", credXHubAddress);

  // Link CredXHub in scoreEngine
  const setHubTx = await scoreEngine.setCredXHub(credXHubAddress);
  await setHubTx.wait();
  console.log("   🔗 Linked CredXHub to CreditScoreEngine");

  // 4. Deploy Mock cUSD (Liquidity Stablecoin)
  console.log("\n4. Deploying MockERC20 (cUSD)...");
  const MockERC20 = await ethers.getContractFactory("MockERC20");
  const cUSD = await MockERC20.deploy("Creditcoin USD", "cUSD");
  await cUSD.waitForDeployment();
  const cUSDAddress = await cUSD.getAddress();
  console.log("   ✅ MockERC20 (cUSD) deployed at:", cUSDAddress);

  // 5. Deploy UndercollateralizedLendingPool
  console.log("\n5. Deploying UndercollateralizedLendingPool...");
  const UndercollateralizedLendingPool = await ethers.getContractFactory("UndercollateralizedLendingPool");
  const lendingPool = await UndercollateralizedLendingPool.deploy(cUSDAddress, credXHubAddress, scoreEngineAddress);
  await lendingPool.waitForDeployment();
  const lendingPoolAddress = await lendingPool.getAddress();
  console.log("   ✅ UndercollateralizedLendingPool deployed at:", lendingPoolAddress);

  // Link lending pool in CredXHub
  const setPoolTx = await credXHub.setLendingPool(lendingPoolAddress);
  await setPoolTx.wait();
  console.log("   🔗 Linked LendingPool to CredXHub");

  // 6. Deploy CreditAttestationSBT (Soulbound Token)
  console.log("\n6. Deploying CreditAttestationSBT (Soulbound Credit Credentials)...");
  const CreditAttestationSBT = await ethers.getContractFactory("CreditAttestationSBT");
  const sbt = await CreditAttestationSBT.deploy(credXHubAddress);
  await sbt.waitForDeployment();
  const sbtAddress = await sbt.getAddress();
  console.log("   ✅ CreditAttestationSBT deployed at:", sbtAddress);

  // 7. Seed Lending Pool with Initial Liquidity ($1,000,000 cUSD)
  console.log("\n7. Seeding initial lending pool liquidity ($1,000,000 cUSD)...");
  try {
    const seedAmount = ethers.parseEther("1000000");
    const approveTx = await cUSD.approve(lendingPoolAddress, seedAmount);
    await approveTx.wait();
    const depositTx = await lendingPool.depositLiquidity(seedAmount);
    await depositTx.wait();
    console.log("   💧 Seeded $1,000,000 cUSD into UndercollateralizedLendingPool!");
  } catch (err) {
    console.warn("   ⚠️ Notice: Auto-seed skipped or completed with existing funds.");
  }

  // Save deployment artifact
  const netInfo = await ethers.provider.getNetwork();
  const deploymentData = {
    network: network.name,
    chainId: netInfo.chainId.toString(),
    timestamp: new Date().toISOString(),
    contracts: {
      AttestationVerifier: oracleAddress,
      CreditScoreEngine: scoreEngineAddress,
      CredXHub: credXHubAddress,
      cUSD: cUSDAddress,
      UndercollateralizedLendingPool: lendingPoolAddress,
      CreditAttestationSBT: sbtAddress,
    }
  };

  try {
    fs.writeFileSync(path.join(__dirname, "../deployments.json"), JSON.stringify(deploymentData, null, 2));
    const frontendDir = path.join(__dirname, "../frontend");
    if (fs.existsSync(frontendDir)) {
      fs.writeFileSync(path.join(frontendDir, "contracts.json"), JSON.stringify(deploymentData, null, 2));
    }
    console.log("   💾 Saved deployment addresses to deployments.json and frontend/contracts.json");
  } catch (fsErr) {
    console.warn("   ⚠️ Could not write deployments.json:", fsErr.message);
  }

  console.log("\n==================================================");
  console.log("   🎉 CredX Protocol Successfully Deployed!");
  console.log("==================================================");
  console.log(JSON.stringify(deploymentData.contracts, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
