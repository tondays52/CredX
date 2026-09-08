const { ethers } = require("hardhat");

async function main() {
  console.log("==================================================");
  console.log("   🚀 Deploying CredX Protocol to Creditcoin Network");
  console.log("==================================================");

  const [deployer] = await ethers.getSigners();
  console.log("Deployer account:", deployer.address);
  console.log("Account balance:", (await ethers.provider.getBalance(deployer.address)).toString());

  // 1. Deploy Mock Attestation Oracle (Simulating Creditcoin Precompile)
  console.log("\n1. Deploying MockAttestationOracle...");
  const MockAttestationOracle = await ethers.getContractFactory("MockAttestationOracle");
  const oracle = await MockAttestationOracle.deploy();
  await oracle.waitForDeployment();
  const oracleAddress = await oracle.getAddress();
  console.log("   ✅ MockAttestationOracle deployed at:", oracleAddress);

  // 2. Deploy CreditScoreEngine
  console.log("\n2. Deploying CreditScoreEngine...");
  const CreditScoreEngine = await ethers.getContractFactory("CreditScoreEngine");
  const scoreEngine = await CreditScoreEngine.deploy();
  await scoreEngine.waitForDeployment();
  const scoreEngineAddress = await scoreEngine.getAddress();
  console.log("   ✅ CreditScoreEngine deployed at:", scoreEngineAddress);

  // 3. Deploy CredXHub
  console.log("\n3. Deploying CredXHub...");
  const CredXHub = await ethers.getContractFactory("CredXHub");
  const credXHub = await CredXHub.deploy(oracleAddress, scoreEngineAddress);
  await credXHub.waitForDeployment();
  const credXHubAddress = await credXHub.getAddress();
  console.log("   ✅ CredXHub deployed at:", credXHubAddress);

  // Link CredXHub in scoreEngine
  await scoreEngine.setCredXHub(credXHubAddress);
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
  await credXHub.setLendingPool(lendingPoolAddress);
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
  const seedAmount = ethers.parseEther("1000000");
  await cUSD.approve(lendingPoolAddress, seedAmount);
  await lendingPool.depositLiquidity(seedAmount);
  console.log("   💧 Seeded $1,000,000 cUSD into UndercollateralizedLendingPool!");

  console.log("\n==================================================");
  console.log("   🎉 CredX Protocol Successfully Deployed!");
  console.log("==================================================");
  console.log(JSON.stringify({
    MockAttestationOracle: oracleAddress,
    CreditScoreEngine: scoreEngineAddress,
    CredXHub: credXHubAddress,
    cUSD: cUSDAddress,
    UndercollateralizedLendingPool: lendingPoolAddress,
    CreditAttestationSBT: sbtAddress,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
