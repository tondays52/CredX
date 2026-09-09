const { expect } = require("chai");
const { ethers } = require("hardhat");
const { mine } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("ReputationArena: PredictBay-Style Binary Paper Trading", function () {
  let deployer, trader1, trader2;
  let credXHub, oracle, scoreEngine, arena;

  beforeEach(async function () {
    [deployer, trader1, trader2] = await ethers.getSigners();

    // 1. Deploy Core CredX Infrastructure
    const MockAttestationOracle = await ethers.getContractFactory("MockAttestationOracle");
    oracle = await MockAttestationOracle.deploy();

    const CreditScoreEngine = await ethers.getContractFactory("CreditScoreEngine");
    scoreEngine = await CreditScoreEngine.deploy();

    const CredXHub = await ethers.getContractFactory("CredXHub");
    credXHub = await CredXHub.deploy(await oracle.getAddress(), await scoreEngine.getAddress());

    // 2. Deploy ReputationArena
    const ReputationArena = await ethers.getContractFactory("ReputationArena");
    arena = await ReputationArena.deploy(await credXHub.getAddress());
  });

  describe("1. User Onboarding & Balance", function () {
    it("should initialize user with $10,000 Paper Points upon registration", async function () {
      await arena.connect(trader1).registerUser();
      const stats = await arena.userStats(trader1.address);
      expect(stats.paperBalance).to.equal(ethers.parseEther("10000"));
      expect(stats.currentWinStreak).to.equal(0);
    });

    it("should auto-register user on their first prediction if not registered", async function () {
      await arena.createRound("BTC/USD", 7844452000000n, 120); // 120 blocks round
      await arena.connect(trader1).placePrediction(1, 0, ethers.parseEther("100")); // Choice.ABOVE
      
      const stats = await arena.userStats(trader1.address);
      expect(stats.paperBalance).to.equal(ethers.parseEther("9900"));
    });
  });

  describe("2. Round Lifecycle & Settlement", function () {
    const strikePrice = 7844452000000n; // $78,444.52

    it("should allow placing ABOVE and BELOW predictions", async function () {
      await arena.createRound("BTC/USD", strikePrice, 120);

      await arena.connect(trader1).placePrediction(1, 0, ethers.parseEther("500")); // ABOVE
      await arena.connect(trader2).placePrediction(1, 1, ethers.parseEther("300")); // BELOW

      const round = await arena.rounds(1);
      expect(round.totalAboveStake).to.equal(ethers.parseEther("500"));
      expect(round.totalBelowStake).to.equal(ethers.parseEther("300"));
    });

    it("should settle round correctly and distribute 2x payout to winner", async function () {
      await arena.createRound("BTC/USD", strikePrice, 120);
      await arena.connect(trader1).placePrediction(1, 0, ethers.parseEther("500")); // ABOVE
      await arena.connect(trader2).placePrediction(1, 1, ethers.parseEther("500")); // BELOW

      // Mine blocks past round close
      await mine(130);

      // Settlement price: $78,500.00 (> Strike -> ABOVE wins)
      const settlementPrice = 7850000000000n;
      await expect(arena.settleRound(1, settlementPrice))
        .to.emit(arena, "RoundSettled")
        .withArgs(1, settlementPrice, 0); // 0 = ABOVE

      // Trader1 (Won) claims payout
      await expect(arena.connect(trader1).claimPayout(1))
        .to.emit(arena, "PayoutClaimed")
        .withArgs(1, trader1.address, ethers.parseEther("1000"));

      const stats1 = await arena.userStats(trader1.address);
      expect(stats1.paperBalance).to.equal(ethers.parseEther("10500"));
      expect(stats1.currentWinStreak).to.equal(1);

      // Trader2 (Lost) claims payout -> 0 and streak resets
      await arena.connect(trader2).claimPayout(1);
      const stats2 = await arena.userStats(trader2.address);
      expect(stats2.paperBalance).to.equal(ethers.parseEther("9500"));
      expect(stats2.currentWinStreak).to.equal(0);
    });
  });

  describe("3. Win Streaks & Reputation Boost Sync", function () {
    it("should track a 3-win streak and allow syncing to on-chain reputation", async function () {
      // Execute 3 winning rounds for trader1
      for (let i = 1; i <= 3; i++) {
        await arena.createRound("BTC/USD", 7800000000000n, 120);
        await arena.connect(trader1).placePrediction(i, 0, ethers.parseEther("100")); // ABOVE

        await mine(130);

        await arena.settleRound(i, 7810000000000n); // ABOVE wins
        await arena.connect(trader1).claimPayout(i);
      }

      const stats = await arena.userStats(trader1.address);
      expect(stats.currentWinStreak).to.equal(3);
      expect(stats.longestWinStreak).to.equal(3);
      expect(stats.totalWins).to.equal(3);

      // Claim Reputation Boost
      await expect(arena.connect(trader1).syncStreakToReputation())
        .to.emit(arena, "ReputationBoostClaimed")
        .withArgs(trader1.address, 3, 1);

      const updatedStats = await arena.userStats(trader1.address);
      expect(updatedStats.currentWinStreak).to.equal(0); // Reset after claiming
      expect(updatedStats.totalReputationBoostsClaimed).to.equal(1);
    });

    it("should revert reputation sync if current streak < 3", async function () {
      await arena.connect(trader1).registerUser();
      await expect(
        arena.connect(trader1).syncStreakToReputation()
      ).to.be.revertedWithCustomError(arena, "InsufficientWinStreak");
    });
  });
});
