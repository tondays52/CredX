# 🛡️ CredX Protocol: Cross-Chain Trustless Credit Bureau & Under-Collateralized Lending

> **Built natively for the Creditcoin BUIDL Hackathon 2026 Fall (DoraHacks)**  
> *Deeply integrated with Creditcoin's Attestcoin Protocol / Universal Smart Contracts (USC)*  
> *Grounded in OCCR (On-Chain Credit Risk) probabilistic modeling & Soulbound Credit Attestation Tokens (SBT)*

---

## ⚡ Executive Summary

DeFi today is crippled by **150%+ over-collateralization requirements** ($150 of capital locked to borrow $100). Borrowers who have flawlessly repaid hundreds of thousands of dollars across Ethereum DeFi protocols (Aave, Compound, Uniswap LP) or settled real-world trade invoices are treated as complete strangers on other chains.

**CredX** turns **Creditcoin into the decentralized cross-chain credit layer for Web3**. Using Creditcoin's **Attestcoin Protocol (USC)**, CredX cryptographically verifies cross-chain transaction Merkle + continuity proofs **directly on the live `0x0FD2` BlockProver precompile** (see the verified-on-Blockscout [`BlockProverAttestationOracle`](file:///d:/money/contracts/core/tracks/BlockProverAttestationOracle.sol) and the real Sepolia proof transcript in [ATTESTCOIN_INTEGRATION.md](file:///d:/money/ATTESTCOIN_INTEGRATION.md); reproduce with `npm run usc:verify`). A distinctly-labeled `MockAttestationOracle` harness remains only as a gasless fallback for score boosts.

Verified actions feed into an institutional-grade **OCCR (On-Chain Credit Risk) Multi-Factor Engine**, scoring wallets across 7 dimensions (300 to 850 CTS) to unlock undercollateralized borrowing, dynamic FICO-style APRs, and multi-track ecosystems.

---

## 📜 Attestcoin Protocol Integration

> 📖 **Full Technical Specification**: See [ATTESTCOIN_INTEGRATION.md](file:///d:/money/ATTESTCOIN_INTEGRATION.md) for detailed verification flows, cryptographic invariants, and SDK usage.

CredX fulfills all Attestcoin Protocol requirements:
1. **Working Integration Code**: `ICreditcoinBlockProver.sol` (exact `0x0FD2` ABI), `BlockProverAttestationOracle.sol` (live precompile wrapper), and `scripts/usc-verify-real.js` — a real Sepolia tx verified SUCCESS on `0x0FD2` and anchored on-chain.
2. **Depth of Utilization**: Powers all 5 hackathon tracks (DeFi, RWA, Gaming, DePIN, and AI) using cryptographic state proofs.
3. **Replay & Privacy Protection**: Full bitmap-level replay defense and ZK privacy commitment hashes.

> **Status:** `BlockProverAttestationOracle` is **LIVE** on Creditcoin testnet (`0x4d11b60809724b0B67B28DA2f38438aE97f1C671`, verified on Blockscout); it wraps the real BlockProver `0x0FD2` + ChainInfo `0x0FD3` precompiles. The `MockAttestationOracle` is the explicitly-labeled gasless fallback for score boosts only.

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

## 🧪 Comprehensive Verification (99/99 Passing Tests)

Run the full automated test suite:
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

  99 passing
```

---

## 🚀 Chrome Extension (CredX Virtual Node & Attestcoin Daemon)

CredX includes a production Manifest V3 browser extension (`chrome-extension/`):
1. **Pulse Virtual Node**: Detects real CPU, RAM, and WebGL accelerator specs, measures live ping, and shares idle bandwidth to earn Creditcoin reputation points.
2. **Credit Passport Reader + Signing Relay**: Reads the live on-chain credit score from CredXHub and can sign a real proof-anchor transaction through a MetaMask relay — the extension never stores a private key.

Load unpacked in Chrome via `chrome://extensions` from the `chrome-extension/` directory.

---

## 📄 License
MIT License. Built for Creditcoin BUIDL Hackathon 2026 Fall.
