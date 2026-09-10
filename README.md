# 🛡️ CredX Protocol: Cross-Chain Trustless Credit Bureau & Under-Collateralized Lending

> **Built natively for the Creditcoin BUIDL Hackathon 2026 Fall (DoraHacks)**  
> *Deeply integrated with Creditcoin's Attestcoin Protocol / Universal Smart Contracts (USC)*  
> *Grounded in OCCR (On-Chain Credit Risk) probabilistic modeling & Soulbound Credit Attestation Tokens (SBT)*

---

## ⚡ Executive Summary

DeFi today is crippled by **150%+ over-collateralization requirements** ($150 of capital locked to borrow $100). Borrowers who have flawlessly repaid hundreds of thousands of dollars across Ethereum DeFi protocols (Aave, Compound, Uniswap LP) or settled real-world trade invoices are treated as complete strangers on other chains.

**CredX** turns **Creditcoin into the decentralized cross-chain credit layer for Web3**. Using Creditcoin's **Attestcoin Protocol (USC)** via the native proof precompile (`0x0FD2`) and `IAttestationVerifier`, CredX cryptographically verifies raw Merkle Patricia Trie transaction inclusion receipts directly from **Ethereum Mainnet, Sepolia, Base, and Arbitrum**—with zero bridges and zero centralized oracles.

Verified actions feed into an institutional-grade **OCCR (On-Chain Credit Risk) Multi-Factor Engine**, scoring wallets across 7 dimensions (300 to 850 CTS) to unlock undercollateralized borrowing, dynamic FICO-style APRs, and multi-track ecosystems.

---

## 📜 Attestcoin Protocol Integration

> 📖 **Full Technical Specification**: See [ATTESTCOIN_INTEGRATION.md](file:///d:/money/ATTESTCOIN_INTEGRATION.md) for detailed verification flows, cryptographic invariants, and SDK usage.

CredX fulfills all Attestcoin Protocol requirements:
1. **Working Integration Code**: `IAttestationVerifier.sol` interface, `CredXHub.sol`, `AutonomousAIHub.sol`, and `scripts/generateProof.js`.
2. **Depth of Utilization**: Powers all 5 hackathon tracks (DeFi, RWA, Gaming, DePIN, and AI) using cryptographic state proofs.
3. **Replay & Privacy Protection**: Full bitmap-level replay defense and ZK privacy commitment hashes.

---

## 🌐 Complete 5-Track Ecosystem Overview

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                             SOURCE NETWORKS (EVM)                                │
│          Ethereum Mainnet | Sepolia | Base | Arbitrum | DePIN Networks           │
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

## 🧪 Comprehensive Verification (70/70 Passing Tests)

Run the full automated test suite:
```bash
npx hardhat test
```
```text
  AI Track: AutonomousAIHub (Oracle-less Cross-Chain Verification) (8 tests)
  ReputationArena: PredictBay-Style Binary Paper Trading (7 tests)
  CredX Protocol — Full Test Suite (v2: OCCR + Multi-Protocol + Batch + SBT + Deadswitch) (23 tests)
  Advanced DeFi Modules: Flash Loans & Yield Vault (5 tests)
  DePINInfrastructureHub (4 tests)
  GamingEcosystemHub (7 tests)
  RWA Track: Treasury Yield Fund (4 tests)
  BUIDL CTC 2026 Fall: Multi-Track Extension (12 tests)

  70 passing (17s)
```

---

## 🚀 Chrome Extension (CredX Virtual Node & Attestcoin Daemon)

CredX includes a production Manifest V3 browser extension (`extension/`):
1. **Pulse Virtual Node**: Detects real CPU, RAM, and WebGL accelerator specs, measures live ping, and shares idle bandwidth to earn Creditcoin reputation points.
2. **Attestcoin Light Client Daemon**: Tracks cross-chain block headers (Sepolia, Base, Arbitrum), audits Merkle Patricia Trie transaction receipts in-browser, and relays verified proofs to precompile `0x0FD2`.

Load unpacked in Chrome via `chrome://extensions` from the `extension/` directory.

---

## 📄 License
MIT License. Built for Creditcoin BUIDL Hackathon 2026 Fall.
