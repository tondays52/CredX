const { expect } = require("chai");
const { ethers } = require("hardhat");

const RPD = () => ethers.parseEther("10");
const COOLDOWN = 30;

describe("NexusEdgeRegistry: real on-chain IoT proximity detection ledger", function () {
  let owner, alice, bob, eve;
  let nexus;

  const root = (seed) => ethers.keccak256(ethers.toUtf8Bytes(`merkle-root-${seed}`));

  before(async function () {
    [owner, alice, bob, eve] = await ethers.getSigners();
    nexus = await (await ethers.getContractFactory("NexusEdgeRegistry")).deploy(COOLDOWN);
  });

  it("deploys with sane defaults", async function () {
    expect(await nexus.owner()).to.equal(owner.address);
    expect(await nexus.paused()).to.equal(false);
    expect(await nexus.rewardPerDetection()).to.equal(RPD());
    expect(await nexus.maxDetectionsPerBatch()).to.equal(5_000);
    expect(await nexus.minSecondsBetweenBatches()).to.equal(COOLDOWN);
    expect(await nexus.edgeCount()).to.equal(0n);
  });

  it("registers an edge operator and records it on-chain", async function () {
    const tx = await nexus.connect(alice).registerEdge("0x4e45583a");
    const rec = await tx.wait();
    const ts = (await ethers.provider.getBlock(rec.blockNumber)).timestamp;
    await expect(tx).to.emit(nexus, "EdgeRegistered").withArgs(alice.address, 1, "0x4e45583a", ts);

    const e = await nexus.edges(alice.address);
    expect(e.edgeId).to.equal(1n);
    expect(e.operator).to.equal(alice.address);
    expect(e.batchCount).to.equal(0n);
    expect(await nexus.edgeCount()).to.equal(1n);
    expect(await nexus.edgeOperators(1)).to.equal(alice.address);
  });

  it("rejects duplicate registration and zero edge tags", async function () {
    await expect(nexus.connect(alice).registerEdge("0x4e45583b")).to.be.revertedWithCustomError(nexus, "AlreadyRegistered");
    await expect(nexus.connect(bob).registerEdge("0x00000000")).to.be.revertedWithCustomError(nexus, "ZeroEdgeTag");
  });

  it("only a registered edge operator can settle a batch", async function () {
    await expect(nexus.connect(eve).settleBatch(12, 3, root("eve"))).to.be.revertedWithCustomError(nexus, "NotRegistered");
  });

  it("settles a detection batch and loads the network ledger", async function () {
    const tx = await nexus.connect(alice).settleBatch(12, 3, root("a1"));
    const rec = await tx.wait();
    const ts = (await ethers.provider.getBlock(rec.blockNumber)).timestamp;
    await expect(tx)
      .to.emit(nexus, "DetectionBatchSettled")
      .withArgs(alice.address, 1, root("a1"), 12, 3, RPD() * 12n * 3n, ts);

    const e = await nexus.edges(alice.address);
    expect(e.batchCount).to.equal(1n);
    expect(e.lastBatchSeq).to.equal(1n);
    expect(e.lastDetectionsCount).to.equal(12);
    expect(e.lastQualityGrade).to.equal(3);
    expect(e.lastMerkleRoot).to.equal(root("a1"));
    expect(e.totalDetections).to.equal(12n);
    expect(e.totalRewardUnits).to.equal(RPD() * 36n);
    expect(e.lastAnchorHash).to.not.equal(ethers.ZeroHash);

    expect(await nexus.totalBatchesSettled()).to.equal(1n);
    expect(await nexus.totalDetectionsAnchored()).to.equal(12n);
    expect(await nexus.totalRewardUnitsIssued()).to.equal(RPD() * 36n);
  });

  it("rejects bad detection counts, quality grades and zero Merkle roots", async function () {
    await expect(nexus.connect(alice).settleBatch(0, 3, root("x"))).to.be.revertedWithCustomError(nexus, "BadDetectionCount");
    await expect(nexus.connect(alice).settleBatch(5001, 3, root("x"))).to.be.revertedWithCustomError(nexus, "BadDetectionCount");
    await expect(nexus.connect(alice).settleBatch(12, 0, root("x"))).to.be.revertedWithCustomError(nexus, "BadQuality");
    await expect(nexus.connect(alice).settleBatch(12, 5, root("x"))).to.be.revertedWithCustomError(nexus, "BadQuality");
    await expect(nexus.connect(alice).settleBatch(12, 3, ethers.ZeroHash)).to.be.revertedWithCustomError(nexus, "ZeroMerkleRoot");
  });

  it("rate-limits batches by cooldown, then allows the next batch", async function () {
    await expect(nexus.connect(alice).settleBatch(6, 4, root("a2"))).to.be.revertedWithCustomError(nexus, "TooFrequent");

    await ethers.provider.send("evm_increaseTime", [COOLDOWN + 1]);
    await ethers.provider.send("hardhat_mine", ["0x1", "0x1"]);

    const tx = await nexus.connect(alice).settleBatch(6, 4, root("a2"));
    const rec = await tx.wait();
    const ts = (await ethers.provider.getBlock(rec.blockNumber)).timestamp;
    await expect(tx)
      .to.emit(nexus, "DetectionBatchSettled")
      .withArgs(alice.address, 2, root("a2"), 6, 4, RPD() * 24n, ts);

    const e = await nexus.edges(alice.address);
    expect(e.batchCount).to.equal(2n);
    expect(e.lastBatchSeq).to.equal(2n);
    expect(e.totalDetections).to.equal(18n);
    expect(e.totalRewardUnits).to.equal(RPD() * 60n);
  });

  it("accrues and claims rewards exactly once", async function () {
    const e0 = await nexus.edges(alice.address);
    expect(e0.totalRewardUnits - e0.claimedUnits).to.equal(RPD() * 60n);

    await expect(nexus.connect(alice).claimRewards())
      .to.emit(nexus, "RewardsClaimed")
      .withArgs(alice.address, RPD() * 60n);

    expect((await nexus.edges(alice.address)).claimedUnits).to.equal(RPD() * 60n);
    await expect(nexus.connect(alice).claimRewards()).to.be.revertedWithCustomError(nexus, "NothingToClaim");
    await expect(nexus.connect(eve).claimRewards()).to.be.revertedWithCustomError(nexus, "NotRegistered");
  });

  it("only the owner may tune the network knobs", async function () {
    await expect(nexus.connect(eve).setRewardPerDetection(1)).to.be.revertedWithCustomError(nexus, "OnlyOwner");
    await expect(nexus.connect(eve).setMaxDetectionsPerBatch(1)).to.be.revertedWithCustomError(nexus, "OnlyOwner");
    await expect(nexus.connect(eve).setMinSecondsBetweenBatches(1)).to.be.revertedWithCustomError(nexus, "OnlyOwner");
    await expect(nexus.connect(eve).setPaused(true)).to.be.revertedWithCustomError(nexus, "OnlyOwner");
    await nexus.connect(owner).setMaxDetectionsPerBatch(10_000);
    expect(await nexus.maxDetectionsPerBatch()).to.equal(10_000n);
  });

  it("pausing freezes registration, batches and claims", async function () {
    await nexus.connect(owner).setPaused(true);
    await expect(nexus.connect(bob).registerEdge("0x4e45583b")).to.be.revertedWithCustomError(nexus, "Paused");
    await expect(nexus.connect(alice).settleBatch(6, 3, root("x"))).to.be.revertedWithCustomError(nexus, "Paused");
    await expect(nexus.connect(eve).claimRewards()).to.be.revertedWithCustomError(nexus, "Paused");
    await nexus.connect(owner).setPaused(false);
    await expect(nexus.connect(eve).claimRewards()).to.be.revertedWithCustomError(nexus, "NotRegistered");
  });

  it("multiple edges each chain their own batches with quality-scaled rewards", async function () {
    await ethers.provider.send("evm_increaseTime", [COOLDOWN + 1]);
    await ethers.provider.send("hardhat_mine", ["0x1", "0x1"]);

    await nexus.connect(bob).registerEdge("0x4e45583b");
    await nexus.connect(bob).settleBatch(20, 2, root("b1"));
    const eb = await nexus.edges(bob.address);
    const ea = await nexus.edges(alice.address);
    expect(eb.totalRewardUnits).to.equal(RPD() * 40n);
    expect(ea.totalRewardUnits).to.equal(RPD() * 60n);
    expect(await nexus.edgeCount()).to.equal(2n);
    expect(await nexus.totalBatchesSettled()).to.equal(3n);
    expect(await nexus.totalDetectionsAnchored()).to.equal(38n);
  });
});