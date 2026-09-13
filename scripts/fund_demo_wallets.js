// scripts/fund_demo_wallets.js
// Funds the CC3 demo wallet vault (testnet-only demo keys embedded in the
// frontend so Register/Heartbeat/Claim work fully in-browser during the demo).
require("dotenv").config();
const { ethers } = require("hardhat");

// Addresses of the demo vault wallets (generated once; keys live in
// frontend/src/config/demoWallets.ts, labeled testnet-demo).
const TARGETS = process.env.DEMO_VAULT_JSON
  ? JSON.parse(require("fs").readFileSync(process.env.DEMO_VAULT_JSON, "utf8"))
  : [];

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("deployer", deployer.address, `balance ${ethers.formatEther(await deployer.provider.getBalance(deployer.address))} CTC`);
  for (const t of TARGETS) {
    const bal = await deployer.provider.getBalance(t.address);
    console.log(`${t.id} ${t.address} bal=${ethers.formatEther(bal)}`);
    if (bal < ethers.parseEther("1")) {
      const tx = await deployer.sendTransaction({ to: t.address, value: ethers.parseEther("5") });
      await tx.wait();
      console.log(`  funded +5 CTC → tx ${tx.hash}`);
    }
  }
}

main().catch((e) => { console.error(e); process.exitCode = 1; });