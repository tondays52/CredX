// scripts/deploy_pulse.js
// Deploys the PulseBandwidthRegistry (live on-chain epoch ledger for the CredX
// Pulse bandwidth Data-DAO) on the active network (creditcoinTestnet in
// production; hardhat for local checks), seeds registered nodes with their
// Epoch 0/1 bandwidth reports, and patches deployments.json +
// frontend/contracts.json.
require("dotenv").config();
const { ethers, network } = require("hardhat");
const fs = require("fs");
const path = require("path");

const rootJson = path.join(__dirname, "../deployments.json");
const frontendJson = path.join(__dirname, "../frontend/contracts.json");

async function main() {
  console.log(`PulseBandwidthRegistry deploy → [${network.name}]`);
  const [deployer] = await ethers.getSigners();
  console.log("deployer", deployer.address, `balance ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} native`);

  const PulseBandwidthRegistry = await ethers.getContractFactory("PulseBandwidthRegistry");
  // Resume-friendly: reuse an existing deployment (from either JSON) if present.
  let existing = null;
  for (const f of [rootJson, frontendJson]) {
    const d = JSON.parse(fs.readFileSync(f, "utf8"));
    if (d.contracts?.PulseBandwidthRegistry) { existing = d.contracts.PulseBandwidthRegistry; break; }
  }
  const pulse = existing
    ? PulseBandwidthRegistry.attach(existing)
    : await PulseBandwidthRegistry.deploy(86400); // 24h settlement epochs
  if (!existing) await pulse.waitForDeployment();
  const addr = await pulse.getAddress();
  console.log("✅ PulseBandwidthRegistry", addr);
  console.log(
    "defaults: reward/epoch",
    ethers.formatEther(await pulse.rewardPerEpoch()),
    "units · maxBandwidthMB",
    (await pulse.maxBandwidthMB()).toString(),
    "· epochDuration",
    (await pulse.epochDurationSeconds()).toString(),
    "s · genesisEpoch",
    (await pulse.currentEpoch()).toString()
  );

  const waitNextBlock = async (n) => {
    for (let i = 0; i < 60; i++) {
      if (await ethers.provider.getBlockNumber() > n) return;
      await new Promise((r) => setTimeout(r, 1200));
    }
    throw new Error("timeout waiting for next block");
  };

  // Seed two distinct live operators reporting their Epoch 0 session bandwidth:
  // the demo account (deployer) plus an ephemeral node funded by the deployer.
  const seedNode = async (wallet, label, bw, grade) => {
    const tag = ethers.id(label).slice(0, 10);
    try {
      const r = await (await pulse.connect(wallet).registerNode(tag)).wait();
      console.log("node registered", tag, "at block", r.blockNumber);
      await waitNextBlock(r.blockNumber);
    } catch (e) {
      console.log("register (already present?)", tag, "—", (e?.error?.message ?? e?.reason ?? "continue"));
    }
    try {
      const t = await (await pulse.connect(wallet).submitBandwidth(bw, grade)).wait();
      console.log("bandwidth anchored | node", tag, "| mb", bw, "| grade", grade, "| epoch", (await pulse.currentEpoch()).toString(), "| block", t.blockNumber);
      await waitNextBlock(t.blockNumber);
    } catch (e) {
      console.log("submit (epoch already settled?)", tag, "—", (e?.error?.message ?? e?.reason ?? "continue"));
    }
  };

  await seedNode(deployer, "PULSE-DEMO-01", 87245, 3);

  const node2 = ethers.Wallet.createRandom();
  await (await deployer.sendTransaction({ to: node2.address, value: ethers.parseEther("0.5") })).wait();
  const node2Signer = node2.connect(ethers.provider);
  await seedNode(node2Signer, "PULSE-DEMO-02", 21450, 2);

  const node = await pulse.nodes(deployer.address);
  console.log("totalNodes:", (await pulse.nodeCount()).toString());
  console.log("totalEpochsSettled:", (await pulse.totalEpochsSettled()).toString());
  console.log("totalBandwidthMB:", (await pulse.totalBandwidthMB()).toString());
  console.log("totalRewardUnitsIssued:", ethers.formatEther(await pulse.totalRewardUnitsIssued()));
  console.log("myNode.epochCount:", node.epochCount.toString(), "· lastEpoch:", node.lastEpoch.toString(), "· lastBW:", node.lastBandwidthMB.toString(), "· units:", ethers.formatEther(node.totalRewardUnits));

  const patch = { PulseBandwidthRegistry: addr };
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