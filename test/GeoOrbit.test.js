const { expect } = require("chai");
const { ethers } = require("hardhat");

const RPT = () => ethers.parseEther("1000");

describe("GeoOrbitRegistry: live Proof-of-Space-Time telemetry anchor", function () {
  let owner, alice, bob, eve;
  let orbit;

  before(async function () {
    [owner, alice, bob, eve] = await ethers.getSigners();
    orbit = await (await ethers.getContractFactory("GeoOrbitRegistry")).deploy();
  });

  async function registerWith(signer, hexId, lat = 0, lng = 0, h = 0) {
    return orbit.connect(signer).registerStation(hexId, lat, lng, h);
  }

  it("deploys with sane defaults and owner", async function () {
    expect(await orbit.owner()).to.equal(owner.address);
    expect(await orbit.paused()).to.equal(false);
    expect(await orbit.rewardPerTelemetry()).to.equal(RPT());
    expect(await orbit.minTelemetryIntervalBlocks()).to.equal(1n);
    expect(await orbit.maxSpeedMps()).to.equal(30n);
    expect(await orbit.stationCount()).to.equal(0n);
    expect(await orbit.totalTelemetryAnchored()).to.equal(0n);
  });

  it("registers a station and records it on-chain", async function () {
    const tx = await registerWith(alice, "0x414C4901", 523726500, 49100000, 19);
    const rec = await tx.wait();
    const ts = (await ethers.provider.getBlock(rec.blockNumber)).timestamp;
    await expect(tx)
      .to.emit(orbit, "StationRegistered")
      .withArgs(alice.address, 1, "0x414c4901", 523726500, 49100000, 19, ts);

    const s = await orbit.stations(alice.address);
    expect(s.stationId).to.equal(1n);
    expect(s.hexId).to.equal("0x414c4901");
    expect(s.telemetryCount).to.equal(0n);
    expect(await orbit.stationCount()).to.equal(1n);
    expect(await orbit.operators(1)).to.equal(alice.address);
  });

  it("rejects duplicate registration, bad hexId and out-of-range fixes", async function () {
    await expect(registerWith(alice, "0x414C4902")).to.be.revertedWithCustomError(orbit, "AlreadyRegistered");
    await expect(registerWith(eve, "0x00000000")).to.be.revertedWithCustomError(orbit, "ZeroHexId");
    await expect(registerWith(eve, "0x414c4902", 990_000_000, 0)).to.be.revertedWithCustomError(orbit, "BadFix");
    await expect(registerWith(eve, "0x414c4902", 0, 1_820_000_000)).to.be.revertedWithCustomError(orbit, "BadFix");
  });

  it("only a registered operator can stream telemetry", async function () {
    await expect(
      orbit.connect(eve).submitTelemetry(0, 0, 0, 10, 18, ethers.ZeroHash)
    ).to.be.revertedWithCustomError(orbit, "NotRegistered");
  });

  it("anchors a heartbeat, chains the PoS hash and accrues reward units", async function () {
    const antenna = ethers.id("antenna-ALI-01");
    const tx = await orbit.connect(alice).submitTelemetry(523726500, 49100000, 19, 12, 18, antenna);
    const rec = await tx.wait();
    const height = rec.blockNumber;
    const ts = (await ethers.provider.getBlock(height)).timestamp;
    const prev = ethers.solidityPackedKeccak256(["int32", "int32", "uint32"], [523726500, 49100000, 19]);
    const posHash = ethers.solidityPackedKeccak256(
      ["bytes32", "uint32", "int32", "int32", "uint32", "bytes32"],
      [prev, ts, 523726500, 49100000, 19, antenna]
    );
    await expect(tx)
      .to.emit(orbit, "TelemetryAnchored")
      .withArgs(alice.address, 1, posHash, 523726500, 49100000, 19, 12, ts);

    const s = await orbit.stations(alice.address);
    expect(s.telemetryCount).to.equal(1n);
    expect(s.totalRewardUnits).to.equal(RPT());
    expect(s.lastFix.satellites).to.equal(12);
    expect(s.lastFix.tdop).to.equal(18);
    expect(await orbit.totalTelemetryAnchored()).to.equal(1n);
    expect(await orbit.totalRewardUnitsIssued()).to.equal(RPT());
  });

  it("rejects invalid fix quality (no satellites, zero/absurd tdop)", async function () {
    const base = (lat, lng, sat, tdop) =>
      orbit.connect(alice).submitTelemetry(lat, lng, 19, sat, tdop, ethers.ZeroHash);
    await expect(base(523726500, 49100000, 0, 18)).to.be.revertedWithCustomError(orbit, "BadFix");
    await expect(base(523726500, 49100000, 10, 0)).to.be.revertedWithCustomError(orbit, "BadFix");
    await expect(base(523726500, 49100000, 10, 101)).to.be.revertedWithCustomError(orbit, "BadFix");
  });

  it("enforces the heartbeat cooldown window", async function () {
    await orbit.connect(owner).setMinTelemetryIntervalBlocks(50);
    await expect(
      orbit.connect(alice).submitTelemetry(523726500, 49100000, 19, 12, 18, ethers.ZeroHash)
    ).to.be.revertedWithCustomError(orbit, "TooFrequent");
    await orbit.connect(owner).setMinTelemetryIntervalBlocks(1);
  });

  it("rejects impossible teleports via the PoST speed envelope", async function () {
    await registerWith(bob, "0x424F4202", 0, 0, 10);
    await orbit.connect(bob).submitTelemetry(0, 0, 10, 10, 20, ethers.ZeroHash);

    await ethers.provider.send("evm_increaseTime", [3600]);
    await ethers.provider.send("hardhat_mine", ["0x1", "0x1"]);

    // ~501 km in 3600s ≈ 139 m/s — over the 30 m/s envelope.
    await expect(
      orbit.connect(bob).submitTelemetry(0, 45_000_000, 10, 10, 20, ethers.ZeroHash)
    ).to.be.revertedWithCustomError(orbit, "SpeedViolation");

    // ~50 m in 3600s is fine.
    await expect(orbit.connect(bob).submitTelemetry(0, 4_500, 10, 10, 20, ethers.ZeroHash))
      .to.emit(orbit, "TelemetryAnchored");
    expect(await orbit.totalTelemetryAnchored()).to.equal(3n);
  });

  it("accrues and claims rewards exactly once", async function () {
    const s0 = await orbit.stations(bob.address);
    const unpaid0 = s0.totalRewardUnits - s0.claimedUnits;
    expect(unpaid0).to.equal(2n * RPT());

    await expect(orbit.connect(bob).claimRewards())
      .to.emit(orbit, "RewardsClaimed")
      .withArgs(bob.address, 2n * RPT());

    const s1 = await orbit.stations(bob.address);
    expect(s1.claimedUnits).to.equal(s1.totalRewardUnits);
    await expect(orbit.connect(bob).claimRewards()).to.be.revertedWithCustomError(orbit, "NothingToClaim");
    await expect(orbit.connect(eve).claimRewards()).to.be.revertedWithCustomError(orbit, "NotRegistered");

    // Broadcast a second heartbeat for alice and fold into a single claim path.
    await orbit.connect(alice).submitTelemetry(523726500, 49100000, 19, 12, 18, ethers.ZeroHash);
    await expect(orbit.connect(alice).claimRewards())
      .to.emit(orbit, "RewardsClaimed")
      .withArgs(alice.address, 2n * RPT());
  });

  it("only the owner may tune the network knobs", async function () {
    await expect(orbit.connect(eve).setMaxSpeedMps(5)).to.be.revertedWithCustomError(orbit, "OnlyOwner");
    await expect(orbit.connect(eve).setPaused(true)).to.be.revertedWithCustomError(orbit, "OnlyOwner");
    await orbit.connect(owner).setMaxSpeedMps(50);
    expect(await orbit.maxSpeedMps()).to.equal(50n);
  });

  it("pausing freezes registration, telemetry and claims", async function () {
    await orbit.connect(owner).setPaused(true);
    await expect(registerWith(eve, "0x45564501", 0, 0)).to.be.revertedWithCustomError(orbit, "Paused");
    await expect(
      orbit.connect(alice).submitTelemetry(523726500, 49100000, 19, 12, 18, ethers.ZeroHash)
    ).to.be.revertedWithCustomError(orbit, "Paused");
    await expect(orbit.connect(alice).claimRewards()).to.be.revertedWithCustomError(orbit, "Paused");
    await orbit.connect(owner).setPaused(false);
  });

  it("let owner tune, then streaming resumes; eve finally registers a live hex", async function () {
    await orbit.connect(eve).registerStation("0x45564501", 523726500, 49100000, 19);
    await orbit.connect(eve).submitTelemetry(523726500, 49100000, 19, 14, 15, ethers.ZeroHash);
    const s = await orbit.stations(eve.address);
    expect(s.telemetryCount).to.equal(1n);
    expect(await orbit.stationCount()).to.equal(3n);
  });
});

// NOTE:
// - station alice: id 1, 2 anchors (tx #1 + claim-path heartbeat)
// - station bob:   id 2, 2 anchors
// - station eve:   id 3, 1 anchor
// totalTelemetryAnchored expectation above: 3 after bob's second anchor,
// then +1 alice +1 eve in later tests.
let _suiteTally; // (unused marker — see assertions for exact counts)