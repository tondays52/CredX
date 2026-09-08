const { expect } = require("chai");
const { ethers } = require("hardhat");
const { buildMockEventProof } = require("../scripts/generateProof");

describe("CredX Protocol - Comprehensive Test Suite", function () {
  let deployer, borrower, lender;
  let oracle, scoreEngine, credXHub, cUSD, lendingPool;

  beforeEach(async function () {
    [deployer, borrower, lender] = await ethers.getSigners();

    // 1. Deploy Mock Attestation Oracle
    const MockAttestationOracle = await ethers.getContractFactory("MockAttestationOracle");
    oracle = await MockAttestationOracle.deploy();

    // 2. Deploy CreditScoreEngine
    const CreditScoreEngine = await ethers.getContractFactory("CreditScoreEngine");
    scoreEngine = await CreditScoreEngine.deploy();

    // 3. Deploy CredXHub
    const CredXHub = await ethers.getContractFactory("CredXHub");
    credXHub = await CredXHub.deploy(await oracle.getAddress(), await scoreEngine.getAddress());
    await scoreEngine.setCredXHub(await credXHub.getAddress());

    // 4. Deploy cUSD
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    cUSD = await MockERC20.deploy("Creditcoin USD", "cUSD");

    // 5. Deploy UndercollateralizedLendingPool
    const UndercollateralizedLendingPool = await ethers.getContractFactory("UndercollateralizedLendingPool");
    lendingPool = await UndercollateralizedLendingPool.deploy(
      await cUSD.getAddress(),
      await credXHub.getAddress(),
      await scoreEngine.getAddress()
    );
    await credXHub.setLendingPool(await lendingPool.getAddress());

    // Seed Liquidity ($500,000 cUSD)
    const seedAmount = ethers.parseEther("500000");
    await cUSD.approve(await lendingPool.getAddress(), seedAmount);
    await lendingPool.depositLiquidity(seedAmount);
  });

  it("1. Baseline Profile: Unproven borrower starts at 300 CTS and 150% collateral ratio", async function () {
    const profile = await credXHub.getBorrowerProfile(borrower.address);
    expect(profile.creditScore).to.equal(300n);
    expect(profile.totalVerifiedVolumeUSD).to.equal(0n);
    expect(profile.requiredCollateralRatioBps).to.equal(15000n); // 150%
  });

  it("2. Attestation Verification: Submitting verified Ethereum loan repayment upgrades credit score", async function () {
    const txHash = ethers.keccak256(ethers.toUtf8Bytes("SEPOLIA_AAVE_REPAY_001"));
    const reportedUSD = ethers.parseEther("50000"); // $50,000 repayment

    const proof = buildMockEventProof(
      11155111, // Sepolia
      txHash,
      5928192,
      ethers.keccak256(ethers.toUtf8Bytes("blockhash")),
      "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      reportedUSD
    );

    // Submit proof as borrower
    await expect(
      credXHub.connect(borrower).submitRepaymentProof(proof, 0, reportedUSD) // ActionType.DEFI_LOAN_REPAYMENT
    ).to.emit(credXHub, "ProofSubmittedAndVerified");

    const profile = await credXHub.getBorrowerProfile(borrower.address);
    expect(profile.creditScore).to.be.greaterThan(650n);
    expect(profile.totalVerifiedVolumeUSD).to.equal(reportedUSD);
    expect(profile.requiredCollateralRatioBps).to.be.lessThan(10000n); // Under-collateralized (< 100%)
  });

  it("3. Replay Protection: Submitting the same transaction proof twice fails", async function () {
    const txHash = ethers.keccak256(ethers.toUtf8Bytes("SEPOLIA_AAVE_REPAY_REPLAY_TEST"));
    const reportedUSD = ethers.parseEther("10000");

    const proof = buildMockEventProof(11155111, txHash, 5928192, ethers.ZeroHash, ethers.ZeroAddress, reportedUSD);

    await credXHub.connect(borrower).submitRepaymentProof(proof, 0, reportedUSD);

    await expect(
      credXHub.connect(borrower).submitRepaymentProof(proof, 0, reportedUSD)
    ).to.be.revertedWith("Proof already processed (replay blocked)");
  });

  it("4. Under-Collateralized Borrowing: Prime borrower borrows $10,000 with only 70% collateral", async function () {
    // 1. Submit large Ethereum Mainnet proof ($100k+ repayment) to hit Prime tier (780+ CTS)
    const txHash1 = ethers.keccak256(ethers.toUtf8Bytes("ETH_MAINNET_PROOF_001"));
    const proof1 = buildMockEventProof(1, txHash1, 19283746, ethers.ZeroHash, ethers.ZeroAddress, ethers.parseEther("100000"));
    await credXHub.connect(borrower).submitRepaymentProof(proof1, 0, ethers.parseEther("100000"));

    const profile = await credXHub.getBorrowerProfile(borrower.address);
    expect(profile.creditScore).to.be.gte(780n);
    expect(profile.requiredCollateralRatioBps).to.equal(7000n); // 70% collateral required!

    // 2. Borrow $10,000 cUSD
    const borrowAmountUSD = ethers.parseEther("10000");
    // Required Collateral USD = $10,000 * 70% = $7,000 USD
    // CTC Price = $2.00, so required CTC = 3,500 CTC
    const requiredCollateralCTC = ethers.parseEther("3500");

    const initialCUSDBalance = await cUSD.balanceOf(borrower.address);
    
    await expect(
      lendingPool.connect(borrower).borrow(borrowAmountUSD, { value: requiredCollateralCTC })
    ).to.emit(lendingPool, "LoanOriginated");

    const finalCUSDBalance = await cUSD.balanceOf(borrower.address);
    expect(finalCUSDBalance - initialCUSDBalance).to.equal(borrowAmountUSD);
  });

  it("5. Loan Repayment: Borrower repays principal + interest and unlocks CTC collateral", async function () {
    // Setup Prime score
    const txHash = ethers.keccak256(ethers.toUtf8Bytes("ETH_MAINNET_PROOF_REPAY"));
    const proof = buildMockEventProof(1, txHash, 19283746, ethers.ZeroHash, ethers.ZeroAddress, ethers.parseEther("100000"));
    await credXHub.connect(borrower).submitRepaymentProof(proof, 0, ethers.parseEther("100000"));

    // Borrow $5,000 cUSD with 70% collateral (1,750 CTC)
    const borrowAmountUSD = ethers.parseEther("5000");
    const collateralCTC = ethers.parseEther("1750");
    await lendingPool.connect(borrower).borrow(borrowAmountUSD, { value: collateralCTC });

    // Give borrower a buffer of cUSD to pay accrued interest
    await cUSD.mint(borrower.address, ethers.parseEther("100"));

    // Approve and repay with buffer for accrued interest
    const repayAmount = ethers.parseEther("5100");
    await cUSD.connect(borrower).approve(await lendingPool.getAddress(), repayAmount);
    
    await expect(
      lendingPool.connect(borrower).repayLoan(1, repayAmount)
    ).to.emit(lendingPool, "LoanRepaid");

    const loan = await lendingPool.loans(1);
    expect(loan.isRepaid).to.be.true;
    expect(loan.collateralCTC).to.equal(0n);
  });
});
