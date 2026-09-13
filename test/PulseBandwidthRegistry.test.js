const { expect } = require("chai");
const { ethers } = require("hardhat");

const RPT = () => ethers.parseEther("1000");
const EPOCH_DUR = 60;

describe("PulseBandwidthRegistry: real epoch-based bandwidth Data-DAO ledger", function () {
  let owner, alice, bob, eve;
  let pulse;

  before(async function () {
    [owner, alice, bob, eve] = await ethers.getSigners();
    pulse = await (await ethers.getContractFactory("PulseBandwidthRegistry")).deploy(EPOCH_DUR);
  });

  const anchorHash = (prev, epoch, bw, grade) =>
    ethers.solidityPackedKeccak256(["bytes32", "uint256", "uint32", "uint8"], [prev, epoch, bw, grade]);

  it("deploys with sane defaults and epoch clock", async function () {
    expect(await pulse.owner()).to.equal(owner.address);
    expect(await pulse.paused()).to.equal(false);
    expect(await pulse.rewardPerEpoch()).to.equal(RPT());
    expect(await pulse.maxBandwidthMB()).to.equal(5_000_000n);
    expect(await pulse.epochDurationSeconds()).to.equal(EPOCH_DUR);
    expect(await pulse.currentEpoch()).to.equal(0n);
    expect(await pulse.nodeCount()).to.equal(0n);
  });

  it("registers a node and records it on-chain", async function () {
    const tx = await pulse.connect(alice).registerNode("0x414c4901");
    const rec = await tx.wait();
    const ts = (await ethers.provider.getBlock(rec.blockNumber)).timestamp;
    await expect(tx)
      .to.emit(pulse, "NodeRegistered")
      .withArgs(alice.address, 1, "0x414c4901", ts);

    const n = await pulse.nodes(alice.address);
    expect(n.nodeId).to.equal(1n);
    expect(n.operator).to.equal(alice.address);
    expect(n.epochCount).to.equal(0n);
    expect(await pulse.nodeCount()).to.equal(1n);
    expect(await pulse.nodeOperators(1)).to.equal(alice.address);
  });

  it("rejects duplicate registration and zero node tags", async function () {
    await expect(pulse.connect(alice).registerNode("0x414c4902")).to.be.revertedWithCustomError(pulse, "AlreadyRegistered");
    await expect(pulse.connect(bob).registerNode("0x00000000")).to.be.revertedWithCustomError(pulse, "ZeroNodeTag");
  });

  it("only a registered operator can report bandwidth", async function () {
    await expect(pulse.connect(eve).submitBandwidth(5120, 3)).to.be.revertedWithCustomError(pulse, "NotRegistered");
  });

  it("anchors one live-epoch report and loads the network ledger", async function () {
    const tx = await pulse.connect(alice).submitBandwidth(5120, 3);
    const rec = await tx.wait();
    const ts = (await ethers.provider.getBlock(rec.blockNumber)).timestamp;
    const hash = anchorHash(ethers.ZeroHash, 0, 5120, 3);
    await expect(tx)
      .to.emit(pulse, "BandwidthAnchored")
      .withArgs(alice.address, 0, hash, 5120, 3, RPT() * 3n, ts);

    const n = await pulse.nodes(alice.address);
    expect(n.epochCount).to.equal(1n);
    expect(n.lastEpoch).to.equal(0n);
    expect(n.lastBandwidthMB).to.equal(5120);
    expect(n.lastQualityGrade).to.equal(3);
    expect(n.totalRewardUnits).to.equal(RPT() * 3n);
    expect(n.lastAnchorHash).to.equal(hash);

    expect(await pulse.totalEpochsSettled()).to.equal(1n);
    expect(await pulse.totalBandwidthMB()).to.equal(5120n);
    expect(await pulse.totalRewardUnitsIssued()).to.equal(RPT() * 3n);
  });

  it("rejects out-of-corridor bandwidth and invalid quality grades", async function () {
    await expect(pulse.connect(alice).submitBandwidth(0, 3)).to.be.revertedWithCustomError(pulse, "BadBandwidth");
    await expect(pulse.connect(alice).submitBandwidth(5_000_001, 3)).to.be.revertedWithCustomError(pulse, "BadBandwidth");
    await expect(pulse.connect(alice).submitBandwidth(1024, 0)).to.be.revertedWithCustomError(pulse, "BadQuality");
    await expect(pulse.connect(alice).submitBandwidth(1024, 5)).to.be.revertedWithCustomError(pulse, "BadQuality");
  });

  it("rejects a second report inside the same epoch, accepts the next epoch", async function () {
    await expect(pulse.connect(alice).submitBandwidth(2048, 1)).to.be.revertedWithCustomError(pulse, "EpochStale");

    await ethers.provider.send("evm_increaseTime", [EPOCH_DUR + 1]);
    await ethers.provider.send("hardhat_mine", ["0x1", "0x1"]);
    expect(await pulse.currentEpoch()).to.equal(1n);

    const tx = await pulse.connect(alice).submitBandwidth(8192, 4);
    const rec = await tx.wait();
    const ts = (await ethers.provider.getBlock(rec.blockNumber)).timestamp;
    const hash = anchorHash(anchorHash(ethers.ZeroHash, 0, 5120, 3), 1, 8192, 4);
    await expect(tx)
      .to.emit(pulse, "BandwidthAnchored")
      .withArgs(alice.address, 1, hash, 8192, 4, RPT() * 4n, ts);

    const n = await pulse.nodes(alice.address);
    expect(n.epochCount).to.equal(2n);
    expect(n.lastEpoch).to.equal(1n);
    expect(n.totalRewardUnits).to.equal(RPT() * 7n);
    expect(await pulse.totalEpochsSettled()).to.equal(2n);
    expect(await pulse.totalBandwidthMB()).to.equal(13312n);
  });

  it("accrues and claims rewards exactly once", async function () {
    const n0 = await pulse.nodes(alice.address);
    expect(n0.totalRewardUnits - n0.claimedUnits).to.equal(RPT() * 7n);

    await expect(pulse.connect(alice).claimRewards())
      .to.emit(pulse, "RewardsClaimed")
      .withArgs(alice.address, RPT() * 7n);

    expect((await pulse.nodes(alice.address)).claimedUnits).to.equal(RPT() * 7n);
    await expect(pulse.connect(alice).claimRewards()).to.be.revertedWithCustomError(pulse, "NothingToClaim");
    await expect(pulse.connect(eve).claimRewards()).to.be.revertedWithCustomError(pulse, "NotRegistered");
  });

  it("only the owner may tune the network knobs", async function () {
    await expect(pulse.connect(eve).setRewardPerEpoch(1)).to.be.revertedWithCustomError(pulse, "OnlyOwner");
    await expect(pulse.connect(eve).setMaxBandwidthMB(1)).to.be.revertedWithCustomError(pulse, "OnlyOwner");
    await expect(pulse.connect(eve).setEpochDurationSeconds(1)).to.be.revertedWithCustomError(pulse, "OnlyOwner");
    await expect(pulse.connect(eve).setPaused(true)).to.be.revertedWithCustomError(pulse, "OnlyOwner");
    await pulse.connect(owner).setMaxBandwidthMB(10_000_000);
    expect(await pulse.maxBandwidthMB()).to.equal(10_000_000n);
  });

  it("pausing freezes registration, reports and claims", async function () {
    await pulse.connect(owner).setPaused(true);
    await expect(pulse.connect(bob).registerNode("0x424f4202")).to.be.revertedWithCustomError(pulse, "Paused");
    await expect(pulse.connect(alice).submitBandwidth(1024, 2)).to.be.revertedWithCustomError(pulse, "Paused");
    await expect(pulse.connect(alice).claimRewards()).to.be.revertedWithCustomError(pulse, "Paused");
    await pulse.connect(owner).setPaused(false);
  });

  it("multiple nodes each get one slot per epoch with quality-scaled rewards", async function () {
    await ethers.provider.send("evm_increaseTime", [EPOCH_DUR + 1]);
    await ethers.provider.send("hardhat_mine", ["0x1", "0x1"]);

    await pulse.connect(bob).registerNode("0x424f4201");
    await pulse.connect(bob).submitBandwidth(3072, 2);
    await pulse.connect(alice).submitBandwidth(1500, 1);

    const nb = await pulse.nodes(bob.address);
    const na = await pulse.nodes(alice.address);
    expect(nb.totalRewardUnits).to.equal(RPT() * 2n);
    expect(na.totalRewardUnits).to.equal(RPT() * 8n);
    expect(await pulse.nodeCount()).to.equal(2n);
    expect(await pulse.totalEpochsSettled()).to.equal(4n);
  });
});