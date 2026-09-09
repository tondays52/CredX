const { expect } = require("chai");
const { ethers } = require("hardhat");
const { buildMockEventProof } = require("../scripts/generateProof");

describe("RWA Track: Treasury Yield Fund", function () {
  let owner, primeUser, superPrimeUser, lowScoreUser;
  let credXHub, scoreEngine, mockOracle, priceOracle, stablecoin, treasuryFund;

  const ActionType = {
    DEFI_LOAN_REPAYMENT: 0,
    COMPOUND_SUPPLY: 1,
    UNISWAP_LP_PROVISION: 2,
    ENS_IDENTITY: 3,
    STABLECOIN_TRANSFER: 4,
    RWA_INVOICE_SETTLEMENT: 5,
    STAKING_COLLATERAL_LOCK: 6,
    ONCHAIN_IDENTITY_VERIFIED: 7
  };

  before(async function () {
    [owner, primeUser, superPrimeUser, lowScoreUser] = await ethers.getSigners();

    // Deploy core dependencies
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    stablecoin = await MockERC20.deploy("USDC Token", "USDC");

    const ScoreEngine = await ethers.getContractFactory("CreditScoreEngine");
    scoreEngine = await ScoreEngine.deploy();

    const MockAttestationOracle = await ethers.getContractFactory("MockAttestationOracle");
    mockOracle = await MockAttestationOracle.deploy();

    const CredXHub = await ethers.getContractFactory("CredXHub");
    credXHub = await CredXHub.deploy(await mockOracle.getAddress(), await scoreEngine.getAddress());
    await scoreEngine.setCredXHub(await credXHub.getAddress());

    // Deploy Price Oracle
    const PriceOracle = await ethers.getContractFactory("MockPriceOracle");
    // Initial NAV price: $100 per share (with 8 decimals)
    priceOracle = await PriceOracle.deploy(10000000000, 8);

    // Deploy Treasury Fund
    const TreasuryFund = await ethers.getContractFactory("RWATreasuryYieldFund");
    treasuryFund = await TreasuryFund.deploy(
      await credXHub.getAddress(),
      await priceOracle.getAddress(),
      await stablecoin.getAddress()
    );

    // Bootstrap Users
    await stablecoin.mint(primeUser.address, ethers.parseEther("10000"));
    await stablecoin.mint(superPrimeUser.address, ethers.parseEther("10000"));
    await stablecoin.mint(lowScoreUser.address, ethers.parseEther("10000"));
    
    // Give Treasury Fund some extra stablecoins to pay for bonus yields
    await stablecoin.mint(await treasuryFund.getAddress(), ethers.parseEther("50000"));

    // Boost primeUser to ~650
    for (let i = 0; i < 15; i++) {
        const proof = await buildMockEventProof(1, "tx-rwa1-" + primeUser.address + i);
        await credXHub.connect(primeUser).submitRepaymentProof(proof, ActionType.DEFI_LOAN_REPAYMENT, ethers.parseEther("1000"));
    }

    // Boost superPrimeUser to > 750
    for (let i = 0; i < 20; i++) {
        const proof = await buildMockEventProof(1, "tx-rwa2-" + superPrimeUser.address + i);
        await credXHub.connect(superPrimeUser).submitRepaymentProof(proof, ActionType.DEFI_LOAN_REPAYMENT, ethers.parseEther("200000"));
    }
  });

  it("should reject low score users (Score < 600) from depositing", async function () {
    const depositAmount = ethers.parseEther("100");
    await stablecoin.connect(lowScoreUser).approve(await treasuryFund.getAddress(), depositAmount);
    
    await expect(
      treasuryFund.connect(lowScoreUser).deposit(depositAmount)
    ).to.be.revertedWithCustomError(treasuryFund, "CreditScoreTooLow");
  });

  it("should allow a Prime user (Score >= 600) to deposit and mint tbUSD", async function () {
    const depositAmount = ethers.parseEther("100"); // $100
    await stablecoin.connect(primeUser).approve(await treasuryFund.getAddress(), depositAmount);
    
    // NAV is $100 (100 * 10^8). User deposits 100 * 10^18. 
    // Shares = (100 * 10^18 * 10^8) / (100 * 10^8) = 1 * 10^18 (1 share)
    await treasuryFund.connect(primeUser).deposit(depositAmount);
    
    const tbUsdBalance = await treasuryFund.balanceOf(primeUser.address);
    expect(tbUsdBalance).to.equal(ethers.parseEther("1"));
  });

  it("should payout standard withdrawal value to a Prime user", async function () {
    // Increase NAV price from $100 to $110 to simulate yield accrual
    await priceOracle.setPrice(11000000000); // $110

    const sharesToWithdraw = ethers.parseEther("1");
    const balBefore = await stablecoin.balanceOf(primeUser.address);
    
    await treasuryFund.connect(primeUser).withdraw(sharesToWithdraw);
    
    const balAfter = await stablecoin.balanceOf(primeUser.address);
    // User should get 1 share * $110 = 110 stablecoins
    expect(balAfter - balBefore).to.equal(ethers.parseEther("110"));
  });

  it("should give a Super-Prime user a 2% bonus yield upon withdrawal", async function () {
    // Deposit
    const depositAmount = ethers.parseEther("110"); // NAV is now 110, so this mints 1 share
    await stablecoin.connect(superPrimeUser).approve(await treasuryFund.getAddress(), depositAmount);
    await treasuryFund.connect(superPrimeUser).deposit(depositAmount);

    const shares = await treasuryFund.balanceOf(superPrimeUser.address);
    expect(shares).to.equal(ethers.parseEther("1"));

    // Withdraw right away (NAV still $110)
    const balBefore = await stablecoin.balanceOf(superPrimeUser.address);
    await treasuryFund.connect(superPrimeUser).withdraw(shares);
    const balAfter = await stablecoin.balanceOf(superPrimeUser.address);

    // Base = 110. Bonus = 2% of 110 = 2.2. Total = 112.2
    expect(balAfter - balBefore).to.equal(ethers.parseEther("112.2"));
  });
});
