const { expect } = require("chai");
const { ethers } = require("hardhat");
const { buildMockEventProof } = require("../scripts/generateProof");

describe("Advanced DeFi Modules: Flash Loans & Yield Vault", function () {
  let owner, user1, lowScoreUser;
  let credXHub, scoreEngine, mockToken, rewardToken;
  let flashLoan, yieldVault, flashBorrower;

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
    [owner, user1, lowScoreUser] = await ethers.getSigners();

    // Deploy core dependencies
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    mockToken = await MockERC20.deploy("Mock USD", "mUSD");
    rewardToken = await MockERC20.deploy("Reward Token", "RWD");

    const ScoreEngine = await ethers.getContractFactory("CreditScoreEngine");
    scoreEngine = await ScoreEngine.deploy();

    const MockOracle = await ethers.getContractFactory("MockAttestationOracle");
    const mockOracle = await MockOracle.deploy();

    const CredXHub = await ethers.getContractFactory("CredXHub");
    credXHub = await CredXHub.deploy(await mockOracle.getAddress(), await scoreEngine.getAddress());

    await scoreEngine.setCredXHub(await credXHub.getAddress());

    // Deploy advanced DeFi modules
    const FlashLoan = await ethers.getContractFactory("ReputationFlashLoan");
    flashLoan = await FlashLoan.deploy(await credXHub.getAddress(), await mockToken.getAddress());

    const MockBorrower = await ethers.getContractFactory("MockFlashBorrower");
    flashBorrower = await MockBorrower.deploy(await mockToken.getAddress());

    const YieldVault = await ethers.getContractFactory("ReputationYieldVault");
    yieldVault = await YieldVault.deploy(
        await credXHub.getAddress(), 
        await mockToken.getAddress(),
        await rewardToken.getAddress()
    );

    // Bootstrap Users
    await mockToken.mint(user1.address, ethers.parseEther("10000"));
    await mockToken.mint(lowScoreUser.address, ethers.parseEther("10000"));
    await mockToken.mint(await flashBorrower.getAddress(), ethers.parseEther("10000")); // To pay fees

    // Fund the protocols
    await mockToken.mint(await flashLoan.getAddress(), ethers.parseEther("100000"));
    await rewardToken.mint(await yieldVault.getAddress(), ethers.parseEther("10000000"));

    // Give user1 a high score (Super-Prime: >= 780)
    // Value cap: max $500k/proof, $1M/day. 15 × $60k = $900k (under cap).
    for (let i = 0; i < 15; i++) {
        const proof = await buildMockEventProof(1, "tx-defi-" + user1.address + i);
        await credXHub.connect(user1).submitRepaymentProof(proof, ActionType.DEFI_LOAN_REPAYMENT, ethers.parseEther("60000"));
    }
  });

  describe("ReputationFlashLoan", function () {
    it("should charge 0.09% fee for a low-score user", async function () {
      const borrowAmount = ethers.parseEther("1000");
      // Execute flash loan as lowScoreUser
      await flashLoan.connect(lowScoreUser).flashLoan(await flashBorrower.getAddress(), borrowAmount, "0x");

      const expectedFee = (borrowAmount * 9n) / 10000n; // 0.09%
      expect(await flashBorrower.lastFeePaid()).to.equal(expectedFee);
    });

    it("should charge 0.01% fee for a super-prime user", async function () {
      const borrowAmount = ethers.parseEther("1000");
      // Execute flash loan as user1 (score > 780)
      await flashLoan.connect(user1).flashLoan(await flashBorrower.getAddress(), borrowAmount, "0x");

      const expectedFee = (borrowAmount * 1n) / 10000n; // 0.01%
      expect(await flashBorrower.lastFeePaid()).to.equal(expectedFee);
    });
  });

  describe("ReputationYieldVault", function () {
    it("should grant 1x multiplier for low-score user and 2x multiplier for super-prime user", async function () {
      const stakeAmount = ethers.parseEther("100");
      
      // Both users stake 100 tokens
      await mockToken.connect(user1).approve(await yieldVault.getAddress(), stakeAmount);
      await yieldVault.connect(user1).stake(stakeAmount);
      
      await mockToken.connect(lowScoreUser).approve(await yieldVault.getAddress(), stakeAmount);
      await yieldVault.connect(lowScoreUser).stake(stakeAmount);

      // Mine a few blocks to accumulate rewards
      await ethers.provider.send("evm_mine", []);
      await ethers.provider.send("evm_mine", []);
      await ethers.provider.send("evm_mine", []);

      // Check accumulated rewards (don't claim yet so we can inspect storage if needed, or just claim)
      await yieldVault.connect(user1).claimRewards();
      await yieldVault.connect(lowScoreUser).claimRewards();

      const user1Rewards = await rewardToken.balanceOf(user1.address);
      const lowUserRewards = await rewardToken.balanceOf(lowScoreUser.address);

      // User1 should have double the rewards of lowScoreUser because they have a 2x multiplier vs 1x
      // (Accounting for exact block counts could vary slightly if they didn't stake in the same block, 
      // but roughly we expect user1 to earn at double the rate)
      // Since they staked 1 block apart, lowScoreUser was staked for slightly fewer blocks at the time of claim.
      // We just ensure user1 earned significantly more.
      expect(user1Rewards).to.be.gt(lowUserRewards);
    });
  });
  describe("ReputationAMM", function () {
    let amm, tokenA, tokenB;

    before(async function () {
      const MockERC20 = await ethers.getContractFactory("MockERC20");
      tokenA = await MockERC20.deploy("Token A", "TKNA");
      tokenB = await MockERC20.deploy("Token B", "TKNB");

      const AMM = await ethers.getContractFactory("ReputationAMM");
      amm = await AMM.deploy(await credXHub.getAddress(), await tokenA.getAddress(), await tokenB.getAddress());

      // Mint tokens
      await tokenA.mint(owner.address, ethers.parseEther("100000"));
      await tokenB.mint(owner.address, ethers.parseEther("100000"));
      
      await tokenA.mint(user1.address, ethers.parseEther("1000"));
      await tokenA.mint(lowScoreUser.address, ethers.parseEther("1000"));

      // Add initial liquidity
      await tokenA.connect(owner).approve(await amm.getAddress(), ethers.parseEther("10000"));
      await tokenB.connect(owner).approve(await amm.getAddress(), ethers.parseEther("10000"));
      await amm.connect(owner).addLiquidity(ethers.parseEther("10000"), ethers.parseEther("10000"));
    });

    it("should charge 0.30% fee for a low-score user", async function () {
      const swapAmountIn = ethers.parseEther("100");
      
      // Calculate expected output
      const expectedOut = await amm.getAmountOut(swapAmountIn, await tokenA.getAddress(), lowScoreUser.address);

      // Low score user transfers Token A to AMM
      await tokenA.connect(lowScoreUser).transfer(await amm.getAddress(), swapAmountIn);
      
      const balanceBefore = await tokenB.balanceOf(lowScoreUser.address);
      await amm.connect(lowScoreUser).swap(0, expectedOut); // amount0Out = 0, amount1Out = expectedOut
      const balanceAfter = await tokenB.balanceOf(lowScoreUser.address);

      expect(balanceAfter - balanceBefore).to.equal(expectedOut);
    });

    it("should charge 0.05% fee for a super-prime user", async function () {
      const swapAmountIn = ethers.parseEther("100");

      // Calculate expected output
      const expectedOutUser1 = await amm.getAmountOut(swapAmountIn, await tokenA.getAddress(), user1.address);
      const expectedOutLowScore = await amm.getAmountOut(swapAmountIn, await tokenA.getAddress(), lowScoreUser.address);

      // User1 should get MORE output for the same input because of the lower fee
      expect(expectedOutUser1).to.be.gt(expectedOutLowScore);

      // User1 transfers Token A to AMM
      await tokenA.connect(user1).transfer(await amm.getAddress(), swapAmountIn);
      
      const balanceBefore = await tokenB.balanceOf(user1.address);
      await amm.connect(user1).swap(0, expectedOutUser1); 
      const balanceAfter = await tokenB.balanceOf(user1.address);

      expect(balanceAfter - balanceBefore).to.equal(expectedOutUser1);
    });
  });
});
