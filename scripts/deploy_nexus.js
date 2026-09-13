// scripts/deploy_nexus.js
// Deploys the NexusEdgeRegistry (live on-chain proximity-detection ledger for
// the CredX Nexus IoT edge) on the active network (creditcoinTestnet in
// production; hardhat for local checks), seeds registered edge operators with
// settled detection batches, and patches deployments.json +
// frontend/contracts.json.
require("dotenv").config();
const { ethers, network } = require("hardhat");
const fs = require("fs");
const path = require("path");

const rootJson = path.join(__dirname, "../deployments.json");
const frontendJson = path.join(__dirname, "../frontend/contracts.json");

async function main() {
  console.log(`NexusEdgeRegistry deploy → [${network.name}]`);
  const [deployer] = await ethers.getSigners();
  console.log("deployer", deployer.address, `balance ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} native`);

  const NexusEdgeRegistry = await ethers.getContractFactory("NexusEdgeRegistry");
  // Resume-friendly: reuse an existing deployment (from either JSON) if present.
  let existing = null;
  for (const f of [rootJson, frontendJson]) {
    const d = JSON.parse(fs.readFileSync(f, "utf8"));
    if (d.contracts?.NexusEdgeRegistry) { existing = d.contracts.NexusEdgeRegistry; break; }
  }
  const nexus = existing
    ? NexusEdgeRegistry.attach(existing)
    : await NexusEdgeRegistry.deploy(60); // 60s min between batches per edge
  if (!existing) await nexus.waitForDeployment();
  const addr = await nexus.getAddress();
  console.log("✅ NexusEdgeRegistry", addr);
  console.log(
    "defaults: reward/detection",
    ethers.formatEther(await nexus.rewardPerDetection()),
    "units · maxBatch",
    (await nexus.maxDetectionsPerBatch()).toString(),
    "· cooldown",
    (await nexus.minSecondsBetweenBatches()).toString(),
    "s"
  );

  const waitNextBlock = async (n) => {
    for (let i = 0; i < 60; i++) {
      if (await ethers.provider.getBlockNumber() > n) return;
      await new Promise((r) => setTimeout(r, 1200));
    }
    throw new Error("timeout waiting for next block");
  };

  // Operator-computed Merkle root over N enumerated detection leaves.
  const merkleRoot = (count) => {
    let acc = "0x" + "00".repeat(32);
    for (let i = 0; i < count; i++) acc = ethers.keccak256(ethers.concat([acc, ethers.id(`nexus-leaf-${i}`)]));
    return acc;
  };

  const seedEdge = async (wallet, label, detections, grade) => {
    const tag = ethers.id(label).slice(0, 10);
    try {
      const r = await (await nexus.connect(wallet).registerEdge(tag)).wait();
      console.log("edge registered", tag, "at block", r.blockNumber);
      await waitNextBlock(r.blockNumber);
    } catch (e) {
      console.log("register (already present?)", tag, "—", (e?.error?.message ?? e?.reason ?? "continue"));
    }
    try {
      const t = await (await nexus.connect(wallet).settleBatch(detections, grade, merkleRoot(detections))).wait();
      console.log("batch settled | edge", tag, "| detections", detections, "| grade", grade, "| seq", (await nexus.connect(wallet).edges(wallet.address)).lastBatchSeq.toString(), "| block", t.blockNumber);
      await waitNextBlock(t.blockNumber);
    } catch (e) {
      console.log("settle (cooldown? already?)", tag, "—", (e?.error?.message ?? e?.reason ?? "continue"));
    }
  };

  await seedEdge(deployer, "NEXUS-EDGE-01", 42, 3);

  const node2 = ethers.Wallet.createRandom();
  await (await deployer.sendTransaction({ to: node2.address, value: ethers.parseEther("0.5") })).wait();
  const node2Signer = node2.connect(ethers.provider);
  await seedEdge(node2Signer, "NEXUS-EDGE-02", 27, 2);

  const edge = await nexus.edges(deployer.address);
  console.log("totalEdges:", (await nexus.edgeCount()).toString());
  console.log("totalBatchesSettled:", (await nexus.totalBatchesSettled()).toString());
  console.log("totalDetectionsAnchored:", (await nexus.totalDetectionsAnchored()).toString());
  console.log("totalRewardUnitsIssued:", ethers.formatEther(await nexus.totalRewardUnitsIssued()));
  console.log("myEdge.batches:", edge.batchCount.toString(), "· seq:", edge.lastBatchSeq.toString(), "· detections:", edge.totalDetections.toString(), "· units:", ethers.formatEther(edge.totalRewardUnits));

  const patch = { NexusEdgeRegistry: addr };
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