// scripts/deploy_validator_staking.js
// Deploys the ValidatorStakingRegistry (real on-chain validator registry + staking
// pool for the DePIN > Validator Staking tab) on the active network, seeds real
// validators with score-ranked operators, self-stake + cross-delegations, then
// proves reward/commission accrual with a live claim. Patches deployments.json,
// frontend/contracts.json and frontend/src/config/contracts.ts.
require("dotenv").config();
const { ethers, network } = require("hardhat");
const fs = require("fs");
const path = require("path");
const { buildMockEventProof } = require("./generateProof");

const rootJson = path.join(__dirname, "../deployments.json");
const frontendJson = path.join(__dirname, "../frontend/contracts.json");
const contractsTs = path.join(__dirname, "../frontend/src/config/contracts.ts");
const VAULT = "C:/Users/tonda/AppData/Local/Temp/opencode/demo_vault.json";

const CREDX_HUB_ABI = [
  "function getBorrowerProfile(address) view returns (uint256,uint256,uint256,uint256,uint256,uint256)",
  "function submitRepaymentProof((uint256 sourceChainId,bytes32 blockHash,uint256 blockNumber,bytes32 txHash,uint256 txIndex,bytes rlpEncodedReceipt,bytes merkleProof) proof,uint8 actionType,uint256 reportedValueUSD) returns (uint256)",
];
const DEPIN_HUB_ABI = ["function DEPIN_TOKEN() view returns (address)"];
const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
  "function mint(address,uint256)",
  "function symbol() view returns (string)",
];

async function main() {
  console.log(`ValidatorStakingRegistry deploy → [${network.name}]`);
  const [deployer] = await ethers.getSigners();
  console.log("deployer", deployer.address, `balance ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} native`);

  const deployments = JSON.parse(fs.readFileSync(rootJson, "utf8"));
  const d = deployments.contracts;
  if (!d.CredXHub || !d.DePINInfrastructureHub) throw new Error("missing CredXHub / DePINInfrastructureHub in deployments.json");

  const credXHubRead = new ethers.Contract(d.CredXHub, CREDX_HUB_ABI, ethers.provider);
  const depinHub = new ethers.Contract(d.DePINInfrastructureHub, DEPIN_HUB_ABI, ethers.provider);
  const depinAddr = await depinHub.DEPIN_TOKEN();
  const token = new ethers.Contract(depinAddr, ERC20_ABI, deployer);
  console.log("DEPIN token", depinAddr, await token.symbol());
  console.log("CredXHub", d.CredXHub);

  const ValidatorStakingRegistry = await ethers.getContractFactory("ValidatorStakingRegistry");
  let existing = null;
  for (const f of [rootJson, frontendJson]) {
    const j = JSON.parse(fs.readFileSync(f, "utf8"));
    if (j.contracts?.ValidatorStakingRegistry) { existing = j.contracts.ValidatorStakingRegistry; break; }
  }
  const registry = existing
    ? ValidatorStakingRegistry.attach(existing)
    : await ValidatorStakingRegistry.deploy(d.CredXHub, depinAddr, deployer.address);
  if (!existing) await registry.waitForDeployment();
  const addr = await registry.getAddress();
  console.log("✅ ValidatorStakingRegistry", addr);
  console.log(
    "defaults: reward/block",
    ethers.formatEther(await registry.rewardPerTokenPerBlock()),
    "· minOperatorScore",
    (await registry.minOperatorScore()).toString(),
    "· maxCommissionBps",
    (await registry.MAX_COMMISSION_BPS()).toString()
  );
  console.log("hub", await registry.CREDX_HUB(), "· stakeToken", await registry.STAKE_TOKEN());

  const waitNextBlock = async (n) => {
    for (let i = 0; i < 90; i++) {
      if (await ethers.provider.getBlockNumber() > n) return;
      await new Promise((r) => setTimeout(r, 1200));
    }
    throw new Error("timeout waiting for next block");
  };

  const score = async (w) => (await credXHubRead.getBorrowerProfile(w))[0];

  // Raise an operator to Prime (>=700) through the mock-harness oracle proofs,
  // exactly like the DePIN test settlement path. Idempotent: skips if already Prime.
  const ensurePrime = async (signer) => {
    const credx = new ethers.Contract(d.CredXHub, CREDX_HUB_ABI, signer);
    let s = await score(signer.address);
    console.log(`   score ${signer.address} = ${s}`);
    for (let i = 0; s < 700n && i < 4; i++) {
      const proof = await buildMockEventProof(1, `vstake-${signer.address}-${i}-${Date.now()}`, 0, null, null, "100000");
      const r = await (await credx.submitRepaymentProof(proof, 0, ethers.parseEther("100000"))).wait();
      s = await score(signer.address);
      console.log(`   proof[${i}] block ${r.blockNumber} → score ${s}`);
      await waitNextBlock(r.blockNumber);
    }
    if (s < 700n) throw new Error(`failed to raise ${signer.address} to Prime (score ${s})`);
  };

  const vault = JSON.parse(fs.readFileSync(VAULT, "utf8"));
  const byId = Object.fromEntries(vault.map((w) => [w.id, new ethers.Wallet(w.privateKey, ethers.provider)]));

  const validators = [
    { signer: deployer, label: "VSTKROOT", commissionBps: 500, selfStake: "2000" },
    { signer: byId["demo-iot"], label: "VSTKIOT1", commissionBps: 1000, selfStake: "1500" },
    { signer: byId["demo-fleet"], label: "VSTKFLT1", commissionBps: 1500, selfStake: "1200" },
  ];

  const MAX = ethers.MaxUint256;
  for (const v of validators) {
    console.log(`\n→ validator ${v.label} ${v.signer.address}`);
    await ensurePrime(v.signer);

    const bal = await token.balanceOf(v.signer.address);
    const need = ethers.parseEther("4000");
    if (bal < need) {
      const r = await (await token.mint(v.signer.address, need - bal)).wait();
      console.log(`   minted ${ethers.formatEther(need - bal)} DEPIN (block ${r.blockNumber})`);
      await waitNextBlock(r.blockNumber);
    }
    await (await token.connect(v.signer).approve(addr, MAX)).wait();

    const tag = ethers.id(v.label).slice(0, 10);
    try {
      const r = await (await registry.connect(v.signer).registerValidator(tag, v.commissionBps)).wait();
      console.log(`   registered tag ${tag} commission ${v.commissionBps}bps (block ${r.blockNumber})`);
      await waitNextBlock(r.blockNumber);
    } catch (e) {
      console.log(`   register skipped — ${e?.error?.message ?? e?.reason ?? e}`);
    }
    try {
      const already = await registry.staked(v.signer.address, v.signer.address);
      if (already === 0n) {
        const r = await (await registry.connect(v.signer).stakeToValidator(v.signer.address, ethers.parseEther(v.selfStake))).wait();
        console.log(`   self-staked ${v.selfStake} DEPIN (block ${r.blockNumber})`);
        await waitNextBlock(r.blockNumber);
      } else {
        console.log(`   self-stake present ${ethers.formatEther(already)} DEPIN — skip`);
      }
    } catch (e) {
      console.log(`   self-stake skipped — ${e?.error?.message ?? e?.reason ?? e}`);
    }
  }

  // Cross-delegations: deployer backs the IoT + Fleet validators; IoT backs the root pool.
  const delegate = async (from, to, amount, note) => {
    const already = await registry.staked(from.address, to.address);
    if (already > 0n) { console.log(`   delegation ${note} present ${ethers.formatEther(already)} DEPIN — skip`); return; }
    try {
      await (await token.connect(from).approve(addr, MAX)).wait();
      const r = await (await registry.connect(from).stakeToValidator(to.address, ethers.parseEther(amount))).wait();
      console.log(`   delegated ${amount} DEPIN ${note} (block ${r.blockNumber})`);
      await waitNextBlock(r.blockNumber);
    } catch (e) {
      console.log(`   delegate ${note} skipped — ${e?.error?.message ?? e?.reason ?? e}`);
    }
  };
  console.log("\n→ cross-delegations");
  await delegate(deployer, byId["demo-iot"], "3000", "root → IoT validator");
  await delegate(deployer, byId["demo-fleet"], "2500", "root → Fleet validator");
  await delegate(byId["demo-iot"], deployer, "2000", "IoT → root validator");

  // Let rewards accrue for a few blocks, then prove a real claim.
  console.log("\n→ accrual proof");
  const startBlock = await ethers.provider.getBlockNumber();
  const pool = await registry.getPool(byId["demo-iot"].address);
  console.log("   IoT pool lastUpdateBlock", pool.lastUpdateBlock.toString());
  for (let i = 0; i < 6; i++) {
    await waitNextBlock(await ethers.provider.getBlockNumber());
  }
  const pending = await registry.pendingRewards(deployer.address, byId["demo-iot"].address);
  console.log("   pendingRewards(deployer → IoT) =", ethers.formatEther(pending));
  if (pending > 0n) {
    const r = await (await registry.connect(deployer).claimRewards(byId["demo-iot"].address)).wait();
    console.log(`   claimed rewards (block ${r.blockNumber})`);
    await waitNextBlock(r.blockNumber);
  }
  const commission = await registry.pendingCommission(byId["demo-iot"].address);
  console.log("   pendingCommission(IoT) =", ethers.formatEther(commission));
  if (commission > 0n) {
    const r = await (await registry.connect(byId["demo-iot"]).claimCommission()).wait();
    console.log(`   claimed commission (block ${r.blockNumber})`);
    await waitNextBlock(r.blockNumber);
  }

  console.log("\n── ledger ──");
  console.log("validatorCount        ", (await registry.validatorCount()).toString());
  console.log("totalStaked           ", ethers.formatEther(await registry.totalStaked()));
  console.log("totalRewardUnitsIssued", ethers.formatEther(await registry.totalRewardUnitsIssued()));
  console.log("totalCommissionClaimed", ethers.formatEther(await registry.totalCommissionClaimed()));
  for (const v of validators) {
    const p = await registry.getPool(v.signer.address);
    console.log(
      `  id ${p.validatorId.toString()} ${v.label}  staked ${ethers.formatEther(p.totalStaked)} · commission ${p.commissionBps}bps · registeredAt block ${p.registeredAt.toString()} · claimedCommission ${ethers.formatEther(p.claimedCommission)}`
    );
  }
  console.log("startBlock", startBlock, "→ endBlock", await ethers.provider.getBlockNumber());

  const patch = { ValidatorStakingRegistry: addr };
  for (const f of [rootJson, frontendJson]) {
    const j = JSON.parse(fs.readFileSync(f, "utf8"));
    j.contracts = { ...j.contracts, ...patch };
    j.timestamp = new Date().toISOString();
    fs.writeFileSync(f, JSON.stringify(j, null, 2));
  }

  let ts = fs.readFileSync(contractsTs, "utf8");
  if (ts.includes("validatorStakingRegistry:")) {
    ts = ts.replace(/validatorStakingRegistry: '0x[a-fA-F0-9]{40}',?/, `validatorStakingRegistry: '${addr}',`);
  } else {
    ts = ts.replace(
      /  aiComputeRegistry: '0x[a-fA-F0-9]{40}',\n/,
      (m) => `${m}  validatorStakingRegistry: '${addr}',\n`
    );
  }
  fs.writeFileSync(contractsTs, ts);
  console.log("💾 patched deployments.json + frontend/contracts.json + src/config/contracts.ts");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
