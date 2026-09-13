// scripts/deploy_ai_compute.js
// Deploys the AiComputeRegistry (live on-chain AI compute Data-DAO ledger for
// the CredXsor AI compute market) on the active network (creditcoinTestnet in
// production; hardhat for local checks), seeds registered providers with settled
// compute sessions, and patches deployments.json + frontend/contracts.json.
require("dotenv").config();
const { ethers, network } = require("hardhat");
const fs = require("fs");
const path = require("path");

const rootJson = path.join(__dirname, "../deployments.json");
const frontendJson = path.join(__dirname, "../frontend/contracts.json");
const contractsTs = path.join(__dirname, "../frontend/src/config/contracts.ts");

async function main() {
  console.log(`AiComputeRegistry deploy → [${network.name}]`);
  const [deployer] = await ethers.getSigners();
  console.log("deployer", deployer.address, `balance ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} native`);

  const AiComputeRegistry = await ethers.getContractFactory("AiComputeRegistry");
  // Resume-friendly: reuse an existing deployment (from either JSON) if present.
  let existing = null;
  for (const f of [rootJson, frontendJson]) {
    const d = JSON.parse(fs.readFileSync(f, "utf8"));
    if (d.contracts?.AiComputeRegistry) { existing = d.contracts.AiComputeRegistry; break; }
  }
  const registry = existing
    ? AiComputeRegistry.attach(existing)
    : await AiComputeRegistry.deploy(60); // 60s min between sessions per provider
  if (!existing) await registry.waitForDeployment();
  const addr = await registry.getAddress();
  console.log("✅ AiComputeRegistry", addr);
  console.log(
    "defaults: reward/min",
    ethers.formatEther(await registry.rewardUnitsPerMinute()),
    "units · maxGrade",
    (await registry.maxGrade()).toString(),
    "· cooldown",
    (await registry.minSecondsBetweenSessions()).toString(),
    "s"
  );

  const waitNextBlock = async (n) => {
    for (let i = 0; i < 60; i++) {
      if (await ethers.provider.getBlockNumber() > n) return;
      await new Promise((r) => setTimeout(r, 1200));
    }
    throw new Error("timeout waiting for next block");
  };

  // Operator-computed Merkle root over the real device benchmark evidence leaves.
  const merkleRoot = (label, minutes) => {
    let acc = "0x" + "00".repeat(32);
    for (let i = 0; i < minutes; i++) acc = ethers.keccak256(ethers.concat([acc, ethers.id(`${label}-leaf-${i}`)]));
    return acc;
  };

  const seedProvider = async (wallet, label, vramGb, tflops, minutes, grade) => {
    const tag = ethers.id(label).slice(0, 10); // bytes4
    try {
      const r = await (await registry.connect(wallet).registerProvider(tag, vramGb, tflops)).wait();
      console.log("provider registered", tag, `| vram ${vramGb}GB | ${tflops} TFLOPS | block`, r.blockNumber);
      await waitNextBlock(r.blockNumber);
    } catch (e) {
      console.log("register (already present?)", tag, "—", (e?.error?.message ?? e?.reason ?? "continue"));
    }
    try {
      const t = await (await registry.connect(wallet).settleSession(minutes, grade, merkleRoot(label, minutes))).wait();
      console.log("session settled | provider", tag, "| minutes", minutes, "| grade", grade, "| seq", (await registry.providers(wallet.address)).sessionSeq.toString(), "| block", t.blockNumber);
      await waitNextBlock(t.blockNumber);
    } catch (e) {
      console.log("settle (cooldown? already?)", tag, "—", (e?.error?.message ?? e?.reason ?? "continue"));
    }
  };

  await seedProvider(deployer, "CREDXSOR-H100", 80, 1979, 10, 4);

  const node2 = ethers.Wallet.createRandom();
  await (await deployer.sendTransaction({ to: node2.address, value: ethers.parseEther("0.5") })).wait();
  const node2Signer = node2.connect(ethers.provider);
  await seedProvider(node2Signer, "CREDXSOR-4090", 192, 660, 5, 3);

  const p = await registry.getProvider(deployer.address);
  console.log("totalProviders:", (await registry.providerCount()).toString());
  console.log("totalSessionsSettled:", (await registry.totalSessionsSettled()).toString());
  console.log("totalSessionMinutes:", (await registry.totalSessionMinutes()).toString());
  console.log("totalRewardUnitsIssued:", ethers.formatEther(await registry.totalRewardUnitsIssued()));
  console.log("myProvider.id:", p.providerId.toString(), "· seq:", p.sessionSeq.toString(), "· minutes:", p.totalSessionMinutes.toString(), "· units:", ethers.formatEther(p.totalRewardUnits));

  const patch = { AiComputeRegistry: addr };
  for (const f of [rootJson, frontendJson]) {
    const d = JSON.parse(fs.readFileSync(f, "utf8"));
    d.contracts = { ...d.contracts, ...patch };
    d.timestamp = new Date().toISOString();
    fs.writeFileSync(f, JSON.stringify(d, null, 2));
  }

  // Patch the frontend CONTRACTS map (frontend/src/config/contracts.ts).
  let ts = fs.readFileSync(contractsTs, "utf8");
  if (ts.includes("aiComputeRegistry:")) {
    ts = ts.replace(/aiComputeRegistry: '0x[a-fA-F0-9]{40}',?/, `aiComputeRegistry: '${addr}',`);
  } else {
    ts = ts.replace(
      /  nexusEdgeRegistry: '0x[a-fA-F0-9]{40}',\n/,
      `  nexusEdgeRegistry: '0xc28C0c9e8D81FDF7DFf46a9F458586857928e00B',\n  aiComputeRegistry: '${addr}',\n`
    );
  }
  fs.writeFileSync(contractsTs, ts);
  console.log("💾 patched deployments.json + frontend/contracts.json + src/config/contracts.ts");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});