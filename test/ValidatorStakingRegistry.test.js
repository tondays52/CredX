const { expect } = require("chai");
const { ethers } = require("hardhat");

const RATE = () => 2n * 10n ** 12n; // default rewardPerTokenPerBlock
const WAD = () => 10n ** 18n;

async function seedPrimeScore(hub, account, rounds = 3, value = 100000) {
  const { buildMockEventProof } = require("../scripts/generateProof");
  for (let i = 0; i < rounds; i++) {
    const proof = await buildMockEventProof(1, "tx-validators-" + account.address + "-" + i, undefined, undefined, undefined, String(value));
    await hub.connect(account).submitRepaymentProof(proof, 0, ethers.parseEther(String(value)));
  }
}

describe("ValidatorStakingRegistry: real on-chain validator staking ledger", function () {
  let owner, alice, bob, eve, depositor;
  let depinToken, hub, registry, scoreEngine;

  before(async function () {
    [owner, alice, bob, eve, depositor] = await ethers.getSigners();
    if (!global.ActionType) global.ActionType = ethers.Enum;
    // console.log the ActionType helpers - ActionType is an enum in ICredXHub.
  });

  beforeEach(async function () {
    const ScoreEngine = await ethers.getContractFactory("CreditScoreEngine");
    scoreEngine = await ScoreEngine.deploy();
    const MockOracle = await ethers.getContractFactory("MockAttestationOracle");
    const oracle = await MockOracle.deploy();
    const CredXHub = await ethers.getContractFactory("CredXHub");
    hub = await CredXHub.deploy(await oracle.getAddress(), await scoreEngine.getAddress());
    await (await scoreEngine.setCredXHub(await hub.getAddress())).wait();

    const MockDePINToken = await ethers.getContractFactory("MockDePINToken");
    depinToken = await MockDePINToken.deploy();

    const Factory = await ethers.getContractFactory("ValidatorStakingRegistry");
    registry = await Factory.deploy(await hub.getAddress(), await depinToken.getAddress(), owner.address);

    // Prime operators (alice, bob) get CTS >= 700; eve stays unranked.
    await seedPrimeScore(hub, alice, 3);
    await seedPrimeScore(hub, bob, 8);
    const pa = await hub.getBorrowerProfile(alice.address);
    const pb = await hub.getBorrowerProfile(bob.address);
    const pe = await hub.getBorrowerProfile(eve.address);
    expect(pa.creditScore).to.be.gte(700);
    expect(pb.creditScore).to.be.gte(700);
    expect(pe.creditScore).to.be.below(700);

    // Liquidity: depositor holds DEPIN, registry needs allowance-free pull from depositor.
    await depinToken.mint(depositor.address, ethers.parseEther("100000"));
    await depinToken.connect(depositor).approve(await registry.getAddress(), ethers.parseEther("100000"));
    // Validators also hold DEPIN for self-stake.
    await depinToken.mint(alice.address, ethers.parseEther("5000"));
    await depinToken.connect(alice).approve(await registry.getAddress(), ethers.parseEther("5000"));
    await depinToken.mint(bob.address, ethers.parseEther("5000"));
    await depinToken.connect(bob).approve(await registry.getAddress(), ethers.parseEther("5000"));
  });

  describe("Validator registration", function () {
    it("rejects non-prime operators (CTS below 700)", async function () {
      await expect(registry.connect(eve).registerValidator("0x45564531", 200)).to.be.revertedWithCustomError(
        registry,
        "OperatorScoreTooLow"
      );
    });

    it("rejects zero tags and commission above the cap", async function () {
      await expect(registry.connect(alice).registerValidator("0x00000000", 200)).to.be.revertedWithCustomError(registry, "ZeroNodeTag");
      await expect(registry.connect(alice).registerValidator("0x414c4931", 5001)).to.be.revertedWithCustomError(registry, "CommissionBpsTooHigh");
    });

    it("registers a Prime validator and indexes it in the directory", async function () {
      const tx = await registry.connect(alice).registerValidator("0x414c4931", 250);
      const rec = await tx.wait();
      await expect(tx)
        .to.emit(registry, "ValidatorRegistered")
        .withArgs(alice.address, 1, "0x414c4931", 250, (await ethers.provider.getBlock(rec.blockNumber)).timestamp);

      const p = await registry.pools(alice.address);
      expect(p.validatorId).to.equal(1n);
      expect(p.operator).to.equal(alice.address);
      expect(p.nodeTag).to.equal("0x414c4931");
      expect(p.commissionBps).to.equal(250);
      expect(await registry.validatorCount()).to.equal(1n);
      expect(await registry.validatorOperators(1)).to.equal(alice.address);
      expect(p.lastUpdateBlock).to.be.gte(1);
    });

    it("rejects duplicate registration", async function () {
      await registry.connect(alice).registerValidator("0x414c4931", 250);
      await expect(registry.connect(alice).registerValidator("0x414c4932", 100)).to.be.revertedWithCustomError(
        registry,
        "AlreadyRegistered"
      );
    });
  });

  describe("Staking and rewards", function () {
    beforeEach(async function () {
      await registry.connect(alice).registerValidator("0x414c4931", 0); // alice: no commission
      await registry.connect(bob).registerValidator("0x424f4231", 1000); // bob: 10%
    });

    it("only registered validators accept stake", async function () {
      await expect(registry.connect(depositor).stakeToValidator(eve.address, 1)).to.be.revertedWithCustomError(registry, "NotRegistered");
      await expect(registry.connect(depositor).stakeToValidator(alice.address, 0)).to.be.revertedWithCustomError(registry, "ZeroAmount");
    });

    it("moves DEPIN on stake and records the position", async function () {
      await registry.connect(depositor).stakeToValidator(alice.address, ethers.parseEther("1000"));
      expect(await depinToken.balanceOf(await registry.getAddress())).to.equal(ethers.parseEther("1000"));
      expect(await registry.staked(depositor.address, alice.address)).to.equal(ethers.parseEther("1000"));
      expect(await registry.totalStaked()).to.equal(ethers.parseEther("1000"));
      expect((await registry.pools(alice.address)).totalStaked).to.equal(ethers.parseEther("1000"));
    });

    it("accrues rewards over blocks and honors commission splits", async function () {
      await registry.connect(depositor).stakeToValidator(alice.address, ethers.parseEther("100"));
      await registry.connect(depositor).stakeToValidator(bob.address, ethers.parseEther("100"));

      const alicePool0 = await registry.pools(alice.address);
      const bobPool0 = await registry.pools(bob.address);
      await ethers.provider.send("evm_increaseTime", [12]);
      await ethers.provider.send("hardhat_mine", ["0x2", "0x2"]);

      const aliceDt = BigInt(await ethers.provider.getBlockNumber()) - alicePool0.lastUpdateBlock;
      const bobDt = BigInt(await ethers.provider.getBlockNumber()) - bobPool0.lastUpdateBlock;
      const alicePending = await registry.pendingRewards(depositor.address, alice.address); // no commission
      const bobPending = await registry.pendingRewards(depositor.address, bob.address); // 10% commission
      // alice: 100e18 * (dt * RATE) / 1e18
      // bob: 100e18 * (dt * RATE * 9000/10000) / 1e18
      expect(alicePending).to.equal((100n * WAD() * BigInt(aliceDt) * RATE()) / WAD());
      expect(bobPending).to.equal((100n * WAD() * BigInt(bobDt) * RATE() * 9000n) / 10000n / WAD());
      expect(alicePending).to.be.gt(0);
      expect(bobPending).to.be.lt(alicePending);
    });

    it("claims rewards exactly once and credits the ledger", async function () {
      await registry.connect(depositor).stakeToValidator(alice.address, ethers.parseEther("100"));
      const pool0 = await registry.pools(alice.address);
      await ethers.provider.send("evm_increaseTime", [12]);
      await ethers.provider.send("hardhat_mine", ["0x2", "0x2"]);
      const dt = BigInt(await ethers.provider.getBlockNumber()) - pool0.lastUpdateBlock;

      const pending = await registry.pendingRewards(depositor.address, alice.address);
      expect(pending).to.equal((100n * WAD() * BigInt(dt) * RATE()) / WAD());
      // The claim tx mines one more block, which accrues one extra block of rewards.
      const oneBlock = (100n * WAD() * RATE()) / WAD();

      await expect(registry.connect(depositor).claimRewards(alice.address))
        .to.emit(registry, "RewardsClaimed")
        .withArgs(depositor.address, alice.address, pending + oneBlock);

      expect(await registry.claimedUnits(depositor.address)).to.equal(pending + oneBlock);
      expect(await registry.totalRewardUnitsIssued()).to.equal(pending + oneBlock);
      // A wallet with no position in the pool has nothing to claim.
      await expect(registry.connect(eve).claimRewards(alice.address)).to.be.revertedWithCustomError(registry, "NothingToClaim");
    });

    it("liquid unstake returns DEPIN and closes the position", async function () {
      await registry.connect(depositor).stakeToValidator(alice.address, ethers.parseEther("500"));
      await registry.connect(depositor).unstakeFromValidator(alice.address, ethers.parseEther("200"));
      expect(await registry.staked(depositor.address, alice.address)).to.equal(ethers.parseEther("300"));
      await expect(registry.connect(depositor).unstakeFromValidator(alice.address, ethers.parseEther("301"))).to.be.revertedWithCustomError(
        registry,
        "InsufficientStake"
      );
      expect(await depinToken.balanceOf(depositor.address)).to.equal(ethers.parseEther("99700"));
    });

    it("allows self-stake by validators (bootstrap)", async function () {
      await registry.connect(alice).stakeToValidator(alice.address, ethers.parseEther("1000"));
      expect(await registry.staked(alice.address, alice.address)).to.equal(ethers.parseEther("1000"));
      expect((await registry.pools(alice.address)).totalStaked).to.equal(ethers.parseEther("1000"));
    });
  });

  describe("Validator commissions", function () {
    it("accrues the validator-side cut and is claimable by the operator", async function () {
      await registry.connect(bob).registerValidator("0x424f4231", 1000);
      await registry.connect(depositor).stakeToValidator(bob.address, ethers.parseEther("100"));
      const pool0 = await registry.pools(bob.address);
      await ethers.provider.send("evm_increaseTime", [12]);
      await ethers.provider.send("hardhat_mine", ["0x2", "0x2"]);
      const dt = BigInt(await ethers.provider.getBlockNumber()) - pool0.lastUpdateBlock;

      const commission = await registry.pendingCommission(bob.address);
      // 100 DEPIN * (dt * RATE * 1000/10000) / 1e18
      expect(commission).to.equal((100n * WAD() * BigInt(dt) * RATE() * 1000n) / 10000n / WAD());
      // claimCommission mines one more block of commission accrual.
      const oneBlock = (100n * WAD() * RATE() * 1000n) / 10000n / WAD();

      await expect(registry.connect(bob).claimCommission())
        .to.emit(registry, "CommissionClaimed")
        .withArgs(bob.address, commission + oneBlock);
      expect((await registry.pools(bob.address)).claimedCommission).to.equal(commission + oneBlock);
      expect(await registry.totalCommissionClaimed()).to.equal(commission + oneBlock);
    });

    it("non-validators cannot claim commission", async function () {
      await registry.connect(alice).registerValidator("0x414c4931", 0);
      await expect(registry.connect(eve).claimCommission()).to.be.revertedWithCustomError(registry, "NotRegistered");
    });
  });

  describe("Guard rails", function () {
    beforeEach(async function () {
      await registry.connect(alice).registerValidator("0x414c4931", 200);
    });

    it("only owner tunes knobs", async function () {
      await expect(registry.connect(eve).setRewardPerTokenPerBlock(1)).to.be.revertedWithCustomError(registry, "OnlyOwner");
      await expect(registry.connect(eve).setMinOperatorScore(1)).to.be.revertedWithCustomError(registry, "OnlyOwner");
      await expect(registry.connect(eve).setPaused(true)).to.be.revertedWithCustomError(registry, "OnlyOwner");
      await registry.connect(owner).setRewardPerTokenPerBlock(ethers.parseEther("1"));
      expect(await registry.rewardPerTokenPerBlock()).to.equal(ethers.parseEther("1"));
    });

    it("pause freezes registration, staking and claims", async function () {
      await registry.connect(owner).setPaused(true);
      await expect(registry.connect(bob).registerValidator("0x424f4231", 100)).to.be.revertedWithCustomError(registry, "Paused");
      await expect(registry.connect(owner).stakeToValidator(alice.address, 1)).to.be.revertedWithCustomError(registry, "Paused");
      await expect(registry.connect(owner).claimRewards(alice.address)).to.be.revertedWithCustomError(registry, "Paused");
      await registry.connect(owner).setPaused(false);
      await expect(registry.connect(owner).stakeToValidator(alice.address, 0)).to.be.revertedWithCustomError(registry, "ZeroAmount");
    });

    it("padding multiple validators with independent accumulators", async function () {
      await registry.connect(bob).registerValidator("0x424f4231", 500);
      await registry.connect(depositor).stakeToValidator(bob.address, ethers.parseEther("250"));
      await ethers.provider.send("evm_increaseTime", [12]);
      await ethers.provider.send("hardhat_mine", ["0x1", "0x1"]);
      expect(await registry.pendingRewards(depositor.address, bob.address)).to.be.gt(0);
      expect(await registry.validatorCount()).to.equal(2n);
      expect(await registry.validatorOperators(2)).to.equal(bob.address);
    });
  });
});