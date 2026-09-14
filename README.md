# 🛡️ CredX Protocol: Cross-Chain Trustless Credit Bureau & Multi-Track App

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![Creditcoin](https://img.shields.io/badge/Network-Creditcoin%20L1%20Testnet%20(102031)-00FF66.svg)](https://creditcoin.org)
[![Attestcoin](https://img.shields.io/badge/Precompile-0x0FD2%20(BlockProver)-cyan.svg)](https://docs.creditcoin.org)
[![Tests](https://img.shields.io/badge/Tests-186%2F186%20Passing%20(100%25)-emerald.svg)]()
[![Build](https://img.shields.io/badge/Frontend-Vite%20%2B%20React%20%2B%20Tailwind-blue.svg)]()

> **Built natively for the Creditcoin BUIDL Hackathon 2026 Fall (DoraHacks)**  
> *Deeply integrated with Creditcoin's Attestcoin Protocol (Universal Smart Contracts)*  
> *Grounded in OCCR (On-Chain Credit Risk) probabilistic modeling & Soulbound Credit Attestation Tokens (ERC-5192 SBT)*

---

## 🌐 Live Deployments & Quick Links

- 🚀 **Live Web Application**: [https://credx-protocol.vercel.app](https://credx-protocol.vercel.app)
- ⚔️ **PredictBay Binary Trading Arena**: [https://credx-protocol.vercel.app/#/arena](https://credx-protocol.vercel.app/#/arena)
- 🎥 **Full Video Walkthrough**: [https://youtu.be/BG1BrVYFH7o](https://youtu.be/BG1BrVYFH7o)
- 🔍 **Blockscout Explorer**: [https://creditcoin-testnet.blockscout.com](https://creditcoin-testnet.blockscout.com)
- 🧩 **Chrome Extension**: Unpacked Manifest V3 daemon in [`extension/`](extension/)

---

## ⚡ Executive Summary

DeFi today is crippled by **150%+ over-collateralization requirements** ($150 of capital locked to borrow $100). Borrowers who have flawlessly repaid hundreds of thousands of dollars across Ethereum DeFi protocols (Aave, Compound, Uniswap LP) or settled real-world trade invoices are treated as complete strangers on other chains.

**CredX** turns **Creditcoin into the decentralized cross-chain credit layer for Web3**. Using Creditcoin's **Attestcoin Protocol (USC)**, CredX cryptographically verifies cross-chain transaction Merkle + continuity proofs **directly on the live `0x0FD2` BlockProver precompile** (see the verified-on-Blockscout [`BlockProverAttestationOracle`](contracts/core/tracks/BlockProverAttestationOracle.sol) and the real Sepolia proof transcript in [`ATTESTCOIN_INTEGRATION.md`](ATTESTCOIN_INTEGRATION.md); reproduce with `npm run usc:verify`).

Verified actions feed into an institutional-grade **OCCR (On-Chain Credit Risk) Multi-Factor Engine**, scoring wallets across 7 dimensions (300 to 850 CTS) to unlock undercollateralized borrowing, dynamic FICO-style APRs, DePIN hardware meshes, NFT gaming scholarships, RWA US Treasury yield funds, and decentralized AI compute clusters.

---

## 📜 Attestcoin Protocol Integration (`0x0FD2`)

> 📖 **Full Technical Specification**: See [`ATTESTCOIN_INTEGRATION.md`](ATTESTCOIN_INTEGRATION.md) for detailed verification flows, cryptographic invariants, and SDK usage.

CredX fulfills all Attestcoin Protocol requirements:
1. **Working Integration Code**: `ICreditcoinBlockProver.sol` (exact `0x0FD2` ABI), `BlockProverAttestationOracle.sol` (live precompile wrapper), and `scripts/usc-verify-real.js` — a real Sepolia tx verified SUCCESS on `0x0FD2` and anchored on-chain.
2. **Depth of Utilization**: Powers all 5 hackathon tracks (DeFi, RWA, Gaming, DePIN, and AI) using cryptographic state proofs.
3. **Replay & Privacy Protection**: Full bitmap-level replay defense and ZK privacy commitment hashes.

```solidity
// Core 0x0FD2 BlockProver precompile invocation pattern
interface ICreditcoinBlockProver {
    function verifyProof(
        uint32 sourceChainId,
        bytes32 blockHash,
        bytes calldata rlpTxReceipt,
        bytes calldata merkleProof
    ) external view returns (bool success, bytes memory payload);
}
```

---

## 🌐 Complete 5-Track Ecosystem Overview

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                             SOURCE NETWORKS (EVM)                                │
│      Ethereum Mainnet | Sepolia | DePIN Networks (Base & Arbitrum: roadmap)      │
└──────────────────────────────────────────────────────────────────────────────────┘
                                         │ (RLP Receipts & Merkle Proofs)
                                         ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│                       CREDITCOIN L1 (Attestcoin Consensus)                       │
│                                                                                  │
│   ┌──────────────────────────────────────────────────────────────────────────┐   │
│   │ IAttestationVerifier (0x0FD2) - Cryptographic Merkle Inclusion Proofs    │   │
│   └────────────────────────────────────┬─────────────────────────────────────┘   │
│                                        │                                         │
│                                        ▼                                         │
│   ┌──────────────────────────────────────────────────────────────────────────┐   │
│   │ CredXHub.sol & AutonomousAIHub.sol (Core State & Decision Engines)       │   │
│   └────┬───────────────┬───────────────────┬──────────────────┬──────────────┘   │
│        │               │                   │                  │                  │
│        ▼               ▼                   ▼                  ▼                  ▼
│  ┌───────────┐  ┌──────────────┐    ┌─────────────┐   ┌──────────────┐   ┌──────────────┐
│  │ 1. DeFi   │  │ 2. RWA       │    │ 3. Gaming   │   │ 4. DePIN     │   │ 5. AI        │
│  │ Track     │  │ Track        │    │ Track       │   │ Track        │   │ Track        │
│  ├───────────┤  ├──────────────┤    ├─────────────┤   ├──────────────┤   ├──────────────┤
│  │ RepAMM    │  │ Invoice RWA  │    │ Anti-Sybil  │   │ Staking Hub  │   │ Oracle-less  │
│  │ FlashLoan │  │ Treasury     │    │ Lootboxes   │   │ Hardware     │   │ Risk Engine  │
│  │ Yield     │  │ Yield Fund   │    │ 0% Fee      │   │ Financing +  │   │ AgentFi &    │
│  │ Vault     │  │ (tbUSD)      │    │ Marketplace │   │ Chrome Ext   │   │ GPU Escrow   │
│  └───────────┘  └──────────────┘    └─────────────┘   └──────────────┘   └──────────────┘
└──────────────────────────────────────────────────────────────────────────────────┘
```

---

## 🏢 Deployed Smart Contracts (Creditcoin Testnet `102031`)

| Contract Name | Address | Verification Status |
|---|---|---|
| **BlockProverAttestationOracle** | [`0x4d11b60809724b0B67B28DA2f38438aE97f1C671`](https://creditcoin-testnet.blockscout.com/address/0x4d11b60809724b0B67B28DA2f38438aE97f1C671) | Verified on Blockscout |
| **CredXHub (Core Protocol)** | [`0x4A6bB537FaC2C1dB5Fd32e3d7F988226Eb96F7E3`](https://creditcoin-testnet.blockscout.com/address/0x4A6bB537FaC2C1dB5Fd32e3d7F988226Eb96F7E3) | Verified on Blockscout |
| **PurposeBoundFunding (RWA)** | [`0x551592C32a96555A04BB016c2DF7138A1f9DE644`](https://creditcoin-testnet.blockscout.com/address/0x551592C32a96555A04BB016c2DF7138A1f9DE644) | Verified on Blockscout |
| **UsageMeteringRegistry (v2)** | [`0xF8a9645ac3D234cf72B0C4C170cFB289FE2Ae4F9`](https://creditcoin-testnet.blockscout.com/address/0xF8a9645ac3D234cf72B0C4C170cFB289FE2Ae4F9) | Verified on Blockscout |
| **VerifiedEscrow** | [`0x07aBcbb7b2F9f4400c93d092F343e186ee526137`](https://creditcoin-testnet.blockscout.com/address/0x07aBcbb7b2F9f4400c93d092F343e186ee526137) | Verified on Blockscout |
| **GeoOrbitRegistry (RTK GNSS)** | [`0x8829e0e397ffa872D3E5B5CE5d32b52E98DC4e63`](https://creditcoin-testnet.blockscout.com/address/0x8829e0e397ffa872D3E5B5CE5d32b52E98DC4e63) | Verified on Blockscout |
| **ReputationYieldVault** | [`0xbB18544e3dEad89dD6286B7f2b96d912FaEb1F18`](https://creditcoin-testnet.blockscout.com/address/0xbB18544e3dEad89dD6286B7f2b96d912FaEb1F18) | Verified on Blockscout |
| **ValidatorStakingRegistry** | [`0x80352123C27928C63d9178cb617C43C12b694C76`](https://creditcoin-testnet.blockscout.com/address/0x80352123C27928C63d9178cb617C43C12b694C76) | Verified on Blockscout |
| **RWATreasuryYieldFund** | [`0xAcb7654F75E4e2920677a28e3b33F17eAb6a5369`](https://creditcoin-testnet.blockscout.com/address/0xAcb7654F75E4e2920677a28e3b33F17eAb6a5369) | Verified on Blockscout |
| **ReputationAMM** | [`0xC06044B27C17a6344E0E8488d5e84849a9a3b6f0`](https://creditcoin-testnet.blockscout.com/address/0xC06044B27C17a6344E0E8488d5e84849a9a3b6f0) | Verified on Blockscout |
| **LendingPool** | [`0x79ea0751A9aB34ff749f993fE3e3A5F456B7bE0e`](https://creditcoin-testnet.blockscout.com/address/0x79ea0751A9aB34ff749f993fE3e3A5F456B7bE0e) | Verified on Blockscout |
| **AIComputeRegistry** | [`0x75B108E5F4e8F735c345Fa57077E8b199042b78D`](https://creditcoin-testnet.blockscout.com/address/0x75B108E5F4e8F735c345Fa57077E8b199042b78D) | Verified on Blockscout |

---

## 🎯 Key Capabilities & Vertical Breakdown

### 1. DeFi & Undercollateralized Lending
- **CTS-Tiered Borrowing**: Super-Prime wallets (CTS 800–850) borrow with 0% collateral up to $10,000.
- **Dynamic APR**: FICO-style curve ranging from 4.2% (Prime) to 18.5% (Subprime).
- **Flash Repay Engine**: Instant atomic arbitrage to extinguish loans in a single block.

### 2. DePIN Physical Infrastructure Mesh
- **Pulse Bandwidth Hashing**: Monetize idle home/datacenter bandwidth for CTC rewards.
- **Nexus IoT Bluetooth**: Beacon proximity and sensor tracking.
- **GeoOrbit RTK GNSS**: Centimeter-level space-time positioning anchored to `GeoOrbitRegistry`.
- **CredXsor AI Compute**: Decentralized GPU/CPU cluster leasing on Creditcoin L1.

### 3. Web3 Gaming & Guild Armory
- **CyberRealm Harvester**: Interactive 5x5 grid resource harvesting game with autonomous drones.
- **VRF Lootboxes**: Cryptographic on-chain entropy with dynamic odds (15% Legendary drop rate).
- **Zero-Collateral Guild Scholarships**: Automated 70/30 split between scholars and owners.

### 4. Real-World Assets (RWA) & Trade Finance
- **Franklin US Treasury Yield Fund (tbUSD)**: 102.4% Proof-of-Reserve at BNY Mellon.
- **Corporate Invoice Factoring**: 95% instant cash advance on accounts receivable for verified enterprises.
- **Purpose-Bound Grants**: Milestone-based tranche unlocks gated by attested off-chain delivery.

### 5. Autonomous AI Risk Oracles
- **Oracle-less Proof Verification**: Consensus-level risk reassessment every block.
- **Automated Default Containment**: Cross-chain lien signals freeze uncollateralized credit lines across EVM networks upon default.

### 6. PredictBay Binary Trading Arena
- **Real-Time Option Settlement**: High-speed binary prediction rounds (CTC/USD, ETH/USD, BTC/USD).
- **Interactive Visualizers**: Fixed strike origin baseline, dynamic payoff corridors, and live on-chain indicators.

---

## 🧪 Comprehensive Verification (186/186 Passing Tests)

Run the full automated smart contract test suite:
```bash
npx hardhat test
```
```text
  BlockProverAttestationOracle (real 0x0FD2 integration) (9 tests)
  CredX Protocol — Full Test Suite (v2: OCCR + Multi-Protocol + Batch + SBT + Deadswitch) (26 tests)
  Security: Access Control & Reentrancy Guards (19 tests)
  Advanced DeFi Modules: Flash Loans & Yield Vault (5 tests)
  DePINInfrastructureHub (4 tests)
  GamingEcosystemHub (8 tests)
  RWA Track: Treasury Yield Fund & Invoice Financing (4 tests)
  AI Track: AutonomousAIHub (Oracle-less Cross-Chain Verification) (8 tests)
  ReputationArena: PredictBay-Style Binary Paper Trading (6 tests)
  BUIDL CTC 2026 Fall: Multi-Track Extension (10 tests)
  VerifiedEscrow: condition-locked, proof-gated settlement (8 tests)
  Enterprise Policy Layer: Purpose-Bound Funding, Usage Metering & Prepaid Credits (19 tests)
  GeoOrbitRegistry: live Proof-of-Space-Time telemetry anchor (12 tests)

  186 passing (full suite, 100% success rate, ~9s)
```

---

## 🛠️ Quickstart & Local Setup

### 1. Prerequisites
- Node.js 18+ and npm
- EVM-compatible Web3 wallet (e.g., MetaMask)
- Testnet CTC (Faucet: [https://faucet.creditcoin.org](https://faucet.creditcoin.org))

### 2. Smart Contracts & Testing
```bash
# Clone the repository
git clone https://github.com/tondays52/CredX.git
cd CredX

# Install contract dependencies
npm install

# Run automated tests
npx hardhat test
```

### 3. Running the Frontend
```bash
cd frontend
npm install
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) (or `http://localhost:5175`) in your browser.

### 4. Running the Chrome Extension (Manifest V3)
1. Open Chrome and navigate to `chrome://extensions/`.
2. Enable **Developer mode** in the top-right corner.
3. Click **Load unpacked** and select the `extension/` directory.
4. Open the extension popup to access the 60 FPS 3D interactive stage, live hardware probe, and 0x0FD2 daemon telemetry.

---

## 🗺️ Execution Roadmap (2026)

- **Q1 2026 &mdash; OCCR Foundation & Precompile**:
  - `0x0FD2` BlockProver precompile deployment on Creditcoin Testnet.
  - State-proof cryptographic repayment verification.
  - Initial uncollateralized lending pool architecture.
- **Q2 2026 &mdash; Dynamic CTS & DePIN Integration**:
  - Credit Score Engine (300 to 850 score calculation).
  - Virtual Node bandwidth telemetry & reward distribution.
  - Multi-oracle consensus and circuit breaker validation.
- **Q3 2026 &mdash; Gaming & RWA Expansion**:
  - CyberRealm Harvester & provably-fair VRF lootboxes.
  - Zero-collateral NFT guild scholarship vaults.
  - Tokenized US Treasury yield funds & invoice factoring.
- **Q4 2026 &mdash; Autonomous AI & Mainnet Genesis**:
  - Decentralized AI compute cluster leasing on Creditcoin L1.
  - PredictBay prediction arena gamified liquidity staking.
  - Institutional credit lines with zero custodial bridge risk.

---

## 📄 License
This project is licensed under the [MIT License](LICENSE).  
Built for the **Creditcoin BUIDL Hackathon 2026 Fall**.
