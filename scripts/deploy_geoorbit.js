// scripts/deploy_geoorbit.js
// Deploys the GeoOrbitRegistry (live on-chain Proof-of-Space-Time telemetry
// anchor for the CredX GeoOrbit RTK mesh) on the active network
// (creditcoinTestnet in production; hardhat for local checks), seeds a demo
// station with a few anchored heartbeats, and patches deployments.json +
// frontend/contracts.json.
require("dotenv").config();
const { ethers, network } = require("hardhat");
const fs = require("fs");
const path = require("path");

const rootJson = path.join(__dirname, "../deployments.json");
const frontendJson = path.join(__dirname, "../frontend/contracts.json");

// Amsterdam scientific reference point (52.3676N 4.9041E).
const BASE = { latE7: 523676000, lngE7: 49041000, h: 2 };

async function main() {
  console.log(`GeoOrbit Registry deploy → [${network.name}]`);
  const [deployer] = await ethers.getSigners();
  console.log("deployer", deployer.address, `balance ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} native`);

  const GeoOrbitRegistry = await ethers.getContractFactory("GeoOrbitRegistry");
  const orbit = await GeoOrbitRegistry.deploy();
  await orbit.waitForDeployment();
  const addr = await orbit.getAddress();
  console.log("✅ GeoOrbitRegistry", addr);
  console.log(
    "defaults: reward/telemetry",
    ethers.formatEther(await orbit.rewardPerTelemetry()),
    "· intervalBlocks",
    (await orbit.minTelemetryIntervalBlocks()).toString(),
    "· maxSpeedMps",
    (await orbit.maxSpeedMps()).toString()
  );

  // ── Seed a live demo station (deployer wallet = the connected demo account)
  const waitNextBlock = async (n) => {
    for (let i = 0; i < 60; i++) {
      if (await ethers.provider.getBlockNumber() > n) return;
      await new Promise((r) => setTimeout(r, 1200));
    }
    throw new Error("timeout waiting for next block");
  };

  const hexId = ethers.id("LXA01").slice(0, 10); // bytes4
  const rtx = await (await orbit.registerStation(hexId, BASE.latE7, BASE.lngE7, BASE.h)).wait();
  console.log("station registered", hexId, "at block", rtx.blockNumber);

  // A handful of canopy-mining heartbeats, each within the PoST speed envelope.
  const heartbeats = [
    { lat: BASE.latE7 + 300, lng: BASE.lngE7 - 120, h: BASE.h, sats: 14, tdop: 12 },
    { lat: BASE.latE7 - 200, lng: BASE.lngE7 + 240, h: BASE.h + 1, sats: 15, tdop: 11 },
    { lat: BASE.latE7, lng: BASE.lngE7 + 60, h: BASE.h, sats: 16, tdop: 10 },
  ];
  for (let i = 0; i < heartbeats.length; i++) {
    const b = heartbeats[i];
    const t = await (
      await orbit.submitTelemetry(b.lat, b.lng, b.h, b.sats, b.tdop, ethers.id("antenna-helios-LXA01"))
    ).wait();
    console.log(`heartbeat #${i + 1} anchored at block`, t.blockNumber);
    await waitNextBlock(t.blockNumber);
  }
  console.log("totalTelemetryAnchored:", (await orbit.totalTelemetryAnchored()).toString());
  console.log("totalRewardUnitsIssued:", (await orbit.totalRewardUnitsIssued()).toString());
  console.log("claimable(station):", (await orbit.stations(deployer.address)).claimedUnits > 0 ? "claimed" : "unclaimed");

  const patch = { GeoOrbitRegistry: addr };
  for (const f of [rootJson, frontendJson]) {
    const d = JSON.parse(fs.readFileSync(f, "utf8"));
    d.contracts = { ...d.contracts, ...patch };
    d.timestamp = new Date().toISOString();
    fs.writeFileSync(f, JSON.stringify(d, null, 2));
  }
  console.log("💾 patched deployments.json + frontend/contracts.json");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});