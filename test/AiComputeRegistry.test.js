const { expect } = require("chai");
const { ethers } = require("hardhat");

const RPM = () => ethers.parseEther("10");
const COOLDOWN = 30;
const root = (seed) => ethers.keccak256(ethers.toUtf8Bytes(`compute-root-${seed}`));

describe("AiComputeRegistry: real on-chain AI compute Data-DAO ledger", function () {
  let owner, alice, bob, eve;
  let registry;

  before(async function () {
    [owner, alice, bob, eve] = await ethers.getSigners();
    registry = await (await ethers.getContractFactory("AiComputeRegistry")).deploy(COOLDOWN);
  });

  it("deploys with sane defaults", async function () {
    expect(await registry.owner()).to.equal(owner.address);
    expect(await registry.paused()).to.equal(false);
    expect(await registry.rewardUnitsPerMinute()).to.equal(RPM());
    expect(await registry.maxGrade()).to.equal(4);
    expect(await registry.maxSessionMinutes()).to.equal(1_440);
    expect(await registry.minSecondsBetweenSessions()).to.equal(COOLDOWN);
    expect(await registry.providerCount()).to.equal(0n);
  });

  it("registers a compute provider and records specs on-chain", async function () {
    const tx = await registry.connect(alice).registerProvider("0x48583031", 80, 1979);
    const rec = await tx.wait();
    const ts = (await ethers.provider.getBlock(rec.blockNumber)).timestamp;
    await expect(tx).to.emit(registry, "ProviderRegistered").withArgs(alice.address, 1, "0x48583031", 80, 1979, ts);

    const p = await registry.providers(alice.address);
    expect(p.providerId).to.equal(1n);
    expect(p.operator).to.equal(alice.address);
    expect(p.modelTag).to.equal("0x48583031");
    expect(p.vramGb).to.equal(80);
    expect(p.tflops).to.equal(1979);
    expect(await registry.providerCount()).to.equal(1n);
    expect(await registry.providerOperators(1)).to.equal(alice.address);
    expect(p.lastAnchorHash).to.equal(ethers.ZeroHash);
  });

  it("rejects duplicate registration, zero model tags and bad specs", async function () {
    await expect(registry.connect(alice).registerProvider("0x48583032", 100, 40)).to.be.revertedWithCustomError(registry, "AlreadyRegistered");
    await expect(registry.connect(bob).registerProvider("0x00000000", 100, 40)).to.be.revertedWithCustomError(registry, "ZeroModelTag");
    await expect(registry.connect(bob).registerProvider("0x48583033", 0, 40)).to.be.revertedWithCustomError(registry, "BadSpec");
    await expect(registry.connect(bob).registerProvider("0x48583033", 100, 0)).to.be.revertedWithCustomError(registry, "BadSpec");
  });

  it("only a registered provider can settle a session", async function () {
    await expect(registry.connect(eve).settleSession(5, 3, root("eve"))).to.be.revertedWithCustomError(registry, "NotRegistered");
  });

  it("settles a compute session and loads the network ledger", async function () {
    const tx = await registry.connect(alice).settleSession(5, 3, root("a1"));
    const rec = await tx.wait();
    const ts = (await ethers.provider.getBlock(rec.blockNumber)).timestamp;
    await expect(tx)
      .to.emit(registry, "ComputeSessionSettled")
      .withArgs(alice.address, 1, root("a1"), 5, 3, RPM() * 5n * 3n, ts);

    const p = await registry.providers(alice.address);
    expect(p.sessionSeq).to.equal(1n);
    expect(p.totalSessionMinutes).to.equal(5n);
    expect(p.totalRewardUnits).to.equal(RPM() * 15n);
    expect(p.lastAnchorHash).to.not.equal(ethers.ZeroHash);

    expect(await registry.totalSessionsSettled()).to.equal(1n);
    expect(await registry.totalSessionMinutes()).to.equal(5n);
    expect(await registry.totalRewardUnitsIssued()).to.equal(RPM() * 15n);
  });

  it("rejects bad minutes, quality grades and zero Merkle roots", async function () {
    await expect(registry.connect(alice).settleSession(0, 3, root("x"))).to.be.revertedWithCustomError(registry, "BadSessionMinutes");
    await expect(registry.connect(alice).settleSession(1441, 3, root("x"))).to.be.revertedWithCustomError(registry, "BadSessionMinutes");
    await expect(registry.connect(alice).settleSession(5, 0, root("x"))).to.be.revertedWithCustomError(registry, "BadQuality");
    await expect(registry.connect(alice).settleSession(5, 5, root("x"))).to.be.revertedWithCustomError(registry, "BadQuality");
    await expect(registry.connect(alice).settleSession(5, 3, ethers.ZeroHash)).to.be.revertedWithCustomError(registry, "ZeroMerkleRoot");
  });

  it("rate-limits sessions by cooldown, then allows the next session", async function () {
    await expect(registry.connect(alice).settleSession(2, 4, root("a2"))).to.be.revertedWithCustomError(registry, "TooFrequent");

    await ethers.provider.send("evm_increaseTime", [COOLDOWN + 1]);
    await ethers.provider.send("hardhat_mine", ["0x1", "0x1"]);

    const tx = await registry.connect(alice).settleSession(2, 4, root("a2"));
    const rec = await tx.wait();
    const ts = (await ethers.provider.getBlock(rec.blockNumber)).timestamp;
    await expect(tx)
      .to.emit(registry, "ComputeSessionSettled")
      .withArgs(alice.address, 2, root("a2"), 2, 4, RPM() * 8n, ts);

    const p = await registry.providers(alice.address);
    expect(p.sessionSeq).to.equal(2n);
    expect(p.totalSessionMinutes).to.equal(7n);
    expect(p.totalRewardUnits).to.equal(RPM() * 23n);
  });

  it("accrues and claims rewards exactly once", async function () {
    const p0 = await registry.providers(alice.address);
    expect(p0.totalRewardUnits - p0.claimedUnits).to.equal(RPM() * 23n);

    await expect(registry.connect(alice).claimRewards())
      .to.emit(registry, "RewardsClaimed")
      .withArgs(alice.address, RPM() * 23n);

    expect((await registry.providers(alice.address)).claimedUnits).to.equal(RPM() * 23n);
    await expect(registry.connect(alice).claimRewards()).to.be.revertedWithCustomError(registry, "NothingToClaim");
    await expect(registry.connect(eve).claimRewards()).to.be.revertedWithCustomError(registry, "NotRegistered");
  });

  it("only the owner may tune the network knobs", async function () {
    await expect(registry.connect(eve).setRewardUnitsPerMinute(1)).to.be.revertedWithCustomError(registry, "OnlyOwner");
    await expect(registry.connect(eve).setMinSecondsBetweenSessions(1)).to.be.revertedWithCustomError(registry, "OnlyOwner");
    await expect(registry.connect(eve).setPaused(true)).to.be.revertedWithCustomError(registry, "OnlyOwner");
    await registry.connect(owner).setRewardUnitsPerMinute(ethers.parseEther("12"));
    expect(await registry.rewardUnitsPerMinute()).to.equal(ethers.parseEther("12"));
  });

  it("pausing freezes registration, sessions and claims", async function () {
    await registry.connect(owner).setPaused(true);
    await expect(registry.connect(bob).registerProvider("0x48583033", 100, 40)).to.be.revertedWithCustomError(registry, "Paused");
    await expect(registry.connect(alice).settleSession(5, 3, root("x"))).to.be.revertedWithCustomError(registry, "Paused");
    await expect(registry.connect(eve).claimRewards()).to.be.revertedWithCustomError(registry, "Paused");
    await registry.connect(owner).setPaused(false);
    await expect(registry.connect(eve).claimRewards()).to.be.revertedWithCustomError(registry, "NotRegistered");
  });

  it("multiple providers each chain their own sessions with grade-scaled rewards", async function () {
    await ethers.provider.send("evm_increaseTime", [COOLDOWN + 1]);
    await ethers.provider.send("hardhat_mine", ["0x1", "0x1"]);

    await registry.connect(bob).registerProvider("0x48583033", 192, 660);
    await registry.connect(bob).settleSession(4, 2, root("b1"));
    const pb = await registry.providers(bob.address);
    const pa = await registry.providers(alice.address);
    expect(pb.totalRewardUnits).to.equal(ethers.parseEther("12") * 4n * 2n); // rate was raised to 12/min earlier
    expect(pa.totalRewardUnits).to.equal(RPM() * 23n);
    expect(await registry.providerCount()).to.equal(2n);
    expect(await registry.totalSessionsSettled()).to.equal(3n);
    expect(await registry.totalSessionMinutes()).to.equal(11n);
    expect(await registry.providerOperators(2)).to.equal(bob.address);
  });
});