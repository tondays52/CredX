require("dotenv").config();
const { ethers, network } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("==================================================");
  console.log(`   🚀 Deploying CredX Full Multi-Track Protocol to [${network.name}]`);
  console.log("==================================================");

  const [deployer] = await ethers.getSigners();
  if (!deployer) {
    throw new Error("No deployer account found. Check your private key configuration in .env.");
  }

  const balanceWei = await ethers.provider.getBalance(deployer.address);
  console.log("Deployer account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(balanceWei), "native tokens");

  // 1. Resolve Attestation Verifier (Mock vs Native Creditcoin Precompile 0x0FD2)
  const isCreditcoinNetwork = network.name.toLowerCase().includes("creditcoin");
  let oracleAddress;

  if (isCreditcoinNetwork && !process.env.FORCE_MOCK_ORACLE) {
    const rawAddress = process.env.ATTESTCOIN_PRECOMPILE || "0x0000000000000000000000000000000000000FD2";
    oracleAddress = ethers.getAddress(rawAddress);
    console.log(`\n1. Attestation verifier address set to: ${oracleAddress}`);
    console.log("   NOTE: tooling-only repoint. 0x0FD2 is Creditcoin's BlockProver precompile (USC SDK");
    console.log("   ABI), not the IAttestationVerifier.EventProof ABI — adopt the USC interface before");
    console.log("   using this address in production. Deployments default to the mock harness above.");
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

  const setHubTx = await scoreEngine.setCredXHub(credXHubAddress);
  await setHubTx.wait();
  console.log("   🔗 Linked CredXHub to CreditScoreEngine");

  // 4. Deploy Mock Tokens & Oracles
  console.log("\n4. Deploying Protocol Liquidity, Governance Tokens & Price Oracles...");
  const MockERC20 = await ethers.getContractFactory("MockERC20");
  const cUSD = await MockERC20.deploy("Creditcoin USD", "cUSD");
  await cUSD.waitForDeployment();
  const cUSDAddress = await cUSD.getAddress();

  const MockDePINToken = await ethers.getContractFactory("MockDePINToken");
  const depinToken = await MockDePINToken.deploy();
  await depinToken.waitForDeployment();
  const depinTokenAddress = await depinToken.getAddress();

  const MockGameToken = await ethers.getContractFactory("MockGameToken");
  const gameToken = await MockGameToken.deploy();
  await gameToken.waitForDeployment();
  const gameTokenAddress = await gameToken.getAddress();

  const MockGameItem = await ethers.getContractFactory("MockGameItem");
  const gameNFT = await MockGameItem.deploy();
  await gameNFT.waitForDeployment();
  const gameNFTAddress = await gameNFT.getAddress();

  const MockPriceOracle = await ethers.getContractFactory("MockPriceOracle");
  const priceOracle = await MockPriceOracle.deploy(ethers.parseUnits("1.05", 8), 8);
  await priceOracle.waitForDeployment();
  const priceOracleAddress = await priceOracle.getAddress();

  console.log("   ✅ Liquidity Tokens (cUSD, DePIN, GameToken, GameNFT) & PriceOracle deployed.");

  // 5. Deploy UndercollateralizedLendingPool
  console.log("\n5. Deploying UndercollateralizedLendingPool...");
  const UndercollateralizedLendingPool = await ethers.getContractFactory("UndercollateralizedLendingPool");
  const lendingPool = await UndercollateralizedLendingPool.deploy(cUSDAddress, credXHubAddress, scoreEngineAddress);
  await lendingPool.waitForDeployment();
  const lendingPoolAddress = await lendingPool.getAddress();
  console.log("   ✅ UndercollateralizedLendingPool deployed at:", lendingPoolAddress);

  const setPoolTx = await credXHub.setLendingPool(lendingPoolAddress);
  await setPoolTx.wait();

  // 6. Deploy CreditAttestationSBT (Soulbound Token)
  console.log("\n6. Deploying CreditAttestationSBT (Soulbound Credit Credentials)...");
  const CreditAttestationSBT = await ethers.getContractFactory("CreditAttestationSBT");
  const sbt = await CreditAttestationSBT.deploy(credXHubAddress);
  await sbt.waitForDeployment();
  const sbtAddress = await sbt.getAddress();
  console.log("   ✅ CreditAttestationSBT deployed at:", sbtAddress);

  // 7. Deploy Track Ecosystem Hubs
  console.log("\n7. Deploying Multi-Track Ecosystem Hubs...");

  // Track 1: DeFi
  const ReputationAMM = await ethers.getContractFactory("ReputationAMM");
  const amm = await ReputationAMM.deploy(credXHubAddress, cUSDAddress, depinTokenAddress);
  await amm.waitForDeployment();
  const ammAddress = await amm.getAddress();

  const ReputationFlashLoan = await ethers.getContractFactory("ReputationFlashLoan");
  const flashLoan = await ReputationFlashLoan.deploy(credXHubAddress, cUSDAddress);
  await flashLoan.waitForDeployment();
  const flashLoanAddress = await flashLoan.getAddress();

  const ReputationYieldVault = await ethers.getContractFactory("ReputationYieldVault");
  const yieldVault = await ReputationYieldVault.deploy(credXHubAddress, cUSDAddress, depinTokenAddress);
  await yieldVault.waitForDeployment();
  const yieldVaultAddress = await yieldVault.getAddress();

  // Track 2: RWA
  const RWATreasuryYieldFund = await ethers.getContractFactory("RWATreasuryYieldFund");
  const rwaFund = await RWATreasuryYieldFund.deploy(credXHubAddress, priceOracleAddress, cUSDAddress);
  await rwaFund.waitForDeployment();
  const rwaFundAddress = await rwaFund.getAddress();

  const RWAInvoiceFinancing = await ethers.getContractFactory("RWAInvoiceFinancing");
  const rwaInvoices = await RWAInvoiceFinancing.deploy(credXHubAddress, cUSDAddress);
  await rwaInvoices.waitForDeployment();
  const rwaInvoicesAddress = await rwaInvoices.getAddress();

  // Track 3: Gaming
  const GamingEcosystemHub = await ethers.getContractFactory("GamingEcosystemHub");
  const gamingHub = await GamingEcosystemHub.deploy(credXHubAddress, gameTokenAddress, gameNFTAddress);
  await gamingHub.waitForDeployment();
  const gamingHubAddress = await gamingHub.getAddress();

  // Mock game tokens/NFTs are Ownable (deployer is owner). The hub must own
  // them for gatherResources()/openLootbox() to mint on behalf of players.
  const gameTokenOwnership = await gameToken.transferOwnership(gamingHubAddress);
  await gameTokenOwnership.wait();
  const gameNFTOwnership = await gameNFT.transferOwnership(gamingHubAddress);
  await gameNFTOwnership.wait();
  console.log("   🔑 Transferred gameToken & gameNFT ownership to GamingEcosystemHub (enables on-chain gather/lootbox mints)");

  // Track 4: DePIN
  const DePINInfrastructureHub = await ethers.getContractFactory("DePINInfrastructureHub");
  const depinHub = await DePINInfrastructureHub.deploy(credXHubAddress, depinTokenAddress);
  await depinHub.waitForDeployment();
  const depinHubAddress = await depinHub.getAddress();

  // Track 5: AI
  const AutonomousAIHub = await ethers.getContractFactory("AutonomousAIHub");
  const aiHub = await AutonomousAIHub.deploy(credXHubAddress, oracleAddress, cUSDAddress);
  await aiHub.waitForDeployment();
  const aiHubAddress = await aiHub.getAddress();

  // Reputation Arena (PredictBay-Style)
  const ReputationArena = await ethers.getContractFactory("ReputationArena");
  const arena = await ReputationArena.deploy(credXHubAddress);
  await arena.waitForDeployment();
  const arenaAddress = await arena.getAddress();

  console.log("   ✅ Track 1: DeFi Hubs (AMM, FlashLoan, YieldVault) deployed.");
  console.log("   ✅ Track 2: RWA Treasury Yield Fund (tbUSD) + Invoice Financing deployed.");
  console.log("   ✅ Track 3: Gaming Ecosystem Hub deployed.");
  console.log("   ✅ Track 4: DePIN Infrastructure Hub deployed.");
  console.log("   ✅ Track 5: Autonomous AI Hub deployed.");
  console.log("   ✅ PredictBay-Style Reputation Arena deployed.");

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
      ReputationAMM: ammAddress,
      ReputationFlashLoan: flashLoanAddress,
      ReputationYieldVault: yieldVaultAddress,
      RWATreasuryYieldFund: rwaFundAddress,
      RWAInvoiceFinancing: rwaInvoicesAddress,
      GamingEcosystemHub: gamingHubAddress,
      DePINInfrastructureHub: depinHubAddress,
      AutonomousAIHub: aiHubAddress,
      ReputationArena: arenaAddress
    },
    verifierMode: isCreditcoinNetwork && !process.env.FORCE_MOCK_ORACLE ? "attestcoin-precompile" : "mock-harness",
    notes: "AttestationVerifier on this deployment is the MockAttestationOracle (always-pass testnet harness standing in for Creditcoin's BlockProver precompile 0x0FD2). The ATTESTCOIN_PRECOMPILE repoint is tooling-only: 0x0FD2 uses the USC SDK BlockProver ABI, not IAttestationVerifier.EventProof — adopt that interface before pointing at it in production."
  };

  try {
    fs.writeFileSync(path.join(__dirname, "../deployments.json"), JSON.stringify(deploymentData, null, 2));
    const frontendDir = path.join(__dirname, "../frontend");
    if (fs.existsSync(frontendDir)) {
      fs.writeFileSync(path.join(frontendDir, "contracts.json"), JSON.stringify(deploymentData, null, 2));
    }
    console.log("\n   💾 Saved complete deployment addresses to deployments.json and frontend/contracts.json");
  } catch (fsErr) {
    console.warn("   ⚠️ Could not write deployments.json:", fsErr.message);
  }

  console.log("\n==================================================");
  console.log("   🎉 CredX Multi-Track Protocol Ready & Live!");
  console.log("==================================================");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
