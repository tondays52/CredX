// Seed the deployed ReputationYieldVault with REAL usage:
//   1. resolve cUSD (staking) + DEPIN (reward) via the same raw selectors the app uses
//   2. approve cUSD -> vault (only if allowance insufficient)
//   3. staticCall stake() first (never broadcast a failing tx)
//   4. broadcast stake(AMOUNT) from the funded deployer (credx-root demo wallet)
//   5. fund DEPIN into the vault so claimRewards() can actually pay out
// Safe to re-run: skips steps already done.
require("dotenv").config();
const { ethers } = require("hardhat");

const VAULT_ADDR = "0x630943C1eD77b375d2Bb70647090F18a05490bc1";
const STAKE_AMOUNT = ethers.parseEther("25000"); // 25,000 cUSD
const DEPIN_FUND_TARGET = ethers.parseEther("1000000"); // vault holds 1,000,000 DEPIN (covers the 450k pending owed)

const SELECTORS = {
  stakingToken: "0x0479d644",
  rewardToken: "0x99248ea7",
};

const YIELD_VAULT_ABI = [
  "function stakers(address) view returns (uint256 staked, uint256 lastRewardBlock, uint256 pendingRewards)",
  "function stake(uint256 amount)",
  "function unstake(uint256 amount)",
  "function claimRewards()",
];

async function main() {
  if (!process.env.PRIVATE_KEY) throw new Error("PRIVATE_KEY missing in .env");
  const [deployer] = await ethers.getSigners();
  const deployerAddr = await deployer.getAddress();

  const provider = ethers.provider;
  const decodeAddr = (hex) => ethers.getAddress("0x" + hex.slice(2).slice(24, 64));
  const stakingAddr = decodeAddr(await provider.call({ to: VAULT_ADDR, data: SELECTORS.stakingToken }));
  const rewardAddr = decodeAddr(await provider.call({ to: VAULT_ADDR, data: SELECTORS.rewardToken }));

  const vault = await ethers.getContractAt(YIELD_VAULT_ABI, VAULT_ADDR, deployer);
  const cUSD = await ethers.getContractAt("MockERC20", stakingAddr);
  const depin = await ethers.getContractAt("MockDePINToken", rewardAddr);

  console.log("deployer:", deployerAddr);
  console.log("vault:", VAULT_ADDR);
  console.log("staking token:", stakingAddr, "reward token:", rewardAddr);

  const staker = await vault.stakers(deployerAddr);
  const stakedNow = staker[0];
  console.log(
    "stakers(deployer): staked",
    ethers.formatEther(stakedNow),
    "| lastRewardBlock",
    staker[1].toString(),
    "| pendingRewards",
    ethers.formatEther(staker[2])
  );

  const cusdBal = await cUSD.balanceOf(deployerAddr);
  console.log("cUSD balance(deployer):", ethers.formatEther(cusdBal));
  if (cusdBal < STAKE_AMOUNT) throw new Error("Deployer lacks cUSD to stake");

  if (stakedNow >= STAKE_AMOUNT) {
    console.log("already staked >= target — skipping stake");
  } else {
    const allowance = await cUSD.allowance(deployerAddr, VAULT_ADDR);
    if (allowance < STAKE_AMOUNT) {
      const atx = await cUSD.approve(VAULT_ADDR, ethers.parseEther("1000000"));
      const ar = await atx.wait();
      console.log("approved cUSD -> vault (block", ar.blockNumber + ")");
    }

    try {
      await vault.stake.staticCall(STAKE_AMOUNT);
      console.log("staticCall stake() OK — broadcasting");
    } catch (e) {
      console.log("staticCall stake() REVERTED — nothing sent, stopping:");
      console.log("  ", e.shortMessage || e.message);
      process.exitCode = 0;
      return;
    }

    const tx = await vault.stake(STAKE_AMOUNT);
    const rcpt = await tx.wait();
    console.log("staked", ethers.formatEther(STAKE_AMOUNT), "cUSD — tx", tx.hash, "block", rcpt.blockNumber);
  }

  const depinInVault = await depin.balanceOf(VAULT_ADDR);
  console.log("DEPIN balance(vault):", ethers.formatEther(depinInVault));
  if (depinInVault < DEPIN_FUND_TARGET) {
    const need = DEPIN_FUND_TARGET - depinInVault;
    const depinBal = await depin.balanceOf(deployerAddr);
    console.log("DEPIN balance(deployer):", ethers.formatEther(depinBal));
    if (depinBal < need) {
      try {
        console.log("minting missing DEPIN to deployer first");
        await (await depin.mint(deployerAddr, need)).wait();
      } catch {
        console.log("mint unavailable (owner check) — funding with deployer balance instead");
      }
    }
    const tx = await depin.transfer(VAULT_ADDR, need);
    const rcpt = await tx.wait();
    console.log("funded vault with", ethers.formatEther(need), "DEPIN — tx", tx.hash, "block", rcpt.blockNumber);
  } else {
    console.log("already funded — skipping");
  }

  const blockNow = await provider.getBlockNumber();
  const post = await vault.stakers(deployerAddr);
  console.log("--- final state (block", blockNow + ") ---");
  console.log("staked:", ethers.formatEther(post[0]));
  console.log("lastRewardBlock:", post[1].toString());
  console.log("pendingRewards:", ethers.formatEther(post[2]));
  console.log("cUSD in vault:", ethers.formatEther(await cUSD.balanceOf(VAULT_ADDR)));
  console.log("DEPIN in vault:", ethers.formatEther(await depin.balanceOf(VAULT_ADDR)));
  console.log("blockscout vault:", "https://creditcoin-testnet.blockscout.com/address/" + VAULT_ADDR);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});