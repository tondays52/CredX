# 🛡️ CredX Protocol: Cross-Chain Trustless Credit Bureau & Under-Collateralized Lending

> **Built natively for the Creditcoin BUIDL Hackathon 2026 Fall (DoraHacks)**  
> *Powered by Creditcoin's Attestcoin Protocol / Universal Smart Contracts (USC)*  
> *Grounded in OCCR (On-Chain Credit Risk) probabilistic modeling & Soulbound Credit Attestation Tokens (SBT)*

---

## ⚡ Executive Summary

DeFi today is crippled by **150%+ over-collateralization requirements** ($150 of capital locked to borrow $100). Borrowers who have flawlessly repaid hundreds of thousands of dollars across Ethereum DeFi protocols (Aave, Compound, Uniswap LP) or settled real-world trade invoices are treated as complete strangers on other chains.

**CredX** turns **Creditcoin into the decentralized cross-chain credit layer for Web3**. Using Creditcoin's **Attestcoin Protocol (USC)** via the native proof precompile (`0x0FD2`), CredX verifies raw Merkle transaction inclusion receipts directly from **Ethereum Mainnet and Sepolia**—with zero bridges and zero centralized oracles.

Verified actions feed into an institutional-grade **OCCR (On-Chain Credit Risk) Multi-Factor Engine**, scoring wallets across 7 dimensions (300 to 850 CTS) to unlock:
1. **Under-collateralized borrowing (down to 70% collateral ratio — 30% capital savings)**
2. **Dynamic risk-adjusted APR (2.5% to 12.0%)**
3. **Batch proof imports in a single atomic transaction**
4. **Soulbound Credit Attestation Tokens (CX-SBT) with zero-knowledge privacy commitments**
5. **Credit delegation and social vouching**

---

## 🏗️ Technical Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        SOURCE NETWORKS                          │
│   Ethereum Mainnet | Sepolia Testnet                            │
│   Aave Repayment | Compound Supply | Uniswap LP | ENS | RWA     │
└─────────────────────────────────────────────────────────────────┘
                               │ (RLP Receipts & Merkle Proofs)
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                    CREDITCOIN NETWORK (L1 EVM)                   │
│                                                                 │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │ Attestcoin Precompile / Verifier (0x0FD2)               │   │
│   │ - Cryptographic Merkle inclusion verification           │   │
│   │ - Replay attack prevention                              │   │
│   └────────────────────────────┬────────────────────────────┘   │
│                                │                                │
│                                ▼                                │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │ CredXHub.sol                                            │   │
│   │ - submitRepaymentProof() & submitBatchProofs()          │   │
│   │ - delegateCredit() social vouching                      │   │
│   │ - Privacy-preserving commitment hash generation         │   │
│   └───────────────┬─────────────────────────┬───────────────┘   │
│                   │                         │                   │
│                   ▼                         ▼                   │
│   ┌────────────────────────┐  ┌─────────────────────────────┐   │
│   │ CreditScoreEngine.sol  │  │ UndercollateralizedPool.sol │   │
│   │ - 7-dimension OCCR     │  │ - 70% min collateral ratio  │   │
│   │ - 8 action type weights│  │ - Dynamic FICO-style APR    │   │
│   │ - Dynamic APR pricing  │  │ - Instant settlement/refund │   │
│   └────────────────────────┘  └─────────────────────────────┘   │
│                   │                                             │
│                   ▼                                             │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │ CreditAttestationSBT.sol (CX-SBT)                       │   │
│   │ - Soulbound Non-Transferable Credit Passport            │   │
│   │ - Cross-protocol reputation verification                │   │
│   │ - Selective disclosure with privacy commitments         │   │
│   └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📐 OCCR Multi-Factor Credit Scoring Model

Inspired by top-tier academic research (*"On-Chain Credit Risk Score in DeFi"*, arXiv 2025/2026), CredX calculates a deterministic, tamper-proof **Creditcoin Trust Score (CTS)** between **300 and 850**:

$$\text{CTS} = \text{Base} + S_{\text{vol}} + S_{\text{proto}} + S_{\text{chain}} + S_{\text{freq}} + S_{\text{recency}} + S_{\text{quality}} + S_{\text{action}} + S_{\text{delegation}}$$

### Scoring Dimensions

| Dimension | Maximum Impact | Description |
| :--- | :---: | :--- |
| **Base Score** | 350 pts | Starting baseline for active proof providers |
| **Volume ($S_{\text{vol}}$)** | +200 pts | Tiered scaling: $\ge\$100\text{k}$ (+200), $\ge\$50\text{k}$ (+160), $\ge\$10\text{k}$ (+100) |
| **Protocol Diversity ($S_{\text{proto}}$)** | +80 pts | Cross-protocol breadth: 5+ protocols (+80), 3+ (+50), 2 (+25) |
| **Chain Diversity ($S_{\text{chain}}$)** | +40 pts | Multi-chain track record: 3+ chains (+40), 2 chains (+20) |
| **Attestation Frequency ($S_{\text{freq}}$)** | +80 pts | Cumulative track record: 15+ txs (+80), 10+ (+60), 5+ (+40) |
| **Recency ($S_{\text{recency}}$)** | +50 pts | Proof freshness: $\le 30$ days (+50), $\le 90$ days (+25) |
| **Mainnet Source Quality ($S_{\text{quality}}$)** | +20 pts | High-economic-security boost for Ethereum Mainnet facts |
| **Weighted Action Bonus ($S_{\text{action}}$)** | +80 pts | Cumulative multiplier based on economic significance of actions |
| **Social Delegation ($S_{\text{delegation}}$)** | Up to +100 pts | CTS boost delegated by a verified Prime+ user |

### Multi-Protocol Action Multipliers

| Action Type | Weight | Signal Value |
| :--- | :---: | :--- |
| `RWA_INVOICE_SETTLEMENT` | **1.8x** | Highest real-world economic commitment |
| `DEFI_LOAN_REPAYMENT` | **1.5x** | Proven willingness and capacity to repay debt |
| `STAKING_COLLATERAL_LOCK`| **1.3x** | Long-term capital commitment |
| `UNISWAP_LP_PROVISION` | **1.2x** | Liquidity underwriting commitment |
| `COMPOUND_SUPPLY` | **1.0x** | Lending collateral supply |
| `STABLECOIN_TRANSFER` | **0.8x** | High-volume transactional velocity |
| `ENS_IDENTITY` | **0.5x** | Human identity and Sybil resistance signal |
| `ONCHAIN_IDENTITY_VERIFIED`| **0.4x** | Gitcoin Passport / WorldID attestation |

---

## 🎯 Credit Tiers, Dynamic APR & Collateral Ratios

| Tier | CTS Range | Collateral Ratio | Borrow APR | Max Credit Line |
| :--- | :---: | :---: | :---: | :---: |
| **Super-Prime 🏆** | **780 - 850** | **70.0% (Under-Collateralized)** | **2.50%** | Up to 150% of verified volume |
| **Prime 🌟** | **700 - 779** | **85.0% (Under-Collateralized)** | **5.00%** | Up to 100% of verified volume |
| **Near-Prime** | **650 - 699** | **95.0% (Under-Collateralized)** | **5.00%** | Up to 50% of verified volume |
| **Standard** | **580 - 649** | **120.0%** | **8.00%** | Up to 25% of verified volume |
| **Subprime** | **300 - 579** | **150.0% (Over-Collateralized)** | **12.00%** | Baseline ($1,000 max) |

---

## 🎖️ Credit Attestation Soulbound Token (CX-SBT)

CredX introduces **Soulbound Credit Attestations** that allow borrowers to prove their creditworthiness to external protocols without exposing their private transaction histories:
- **Non-Transferable**: Bound to the holder's wallet address.
- **Selective Disclosure**: Proves `"This wallet has CTS ≥ 780 (Super-Prime) as of block X"` without revealing specific trade amounts or counterparties.
- **Privacy Commitment Hash**: `keccak256(holder, score, timestamp, blockhash)` stored on-chain for zero-knowledge verification.
- **Composable**: Any DeFi protocol on Creditcoin can query `verifyAttestation(user, Tier.PRIME)` to grant instant whitelist or fee discounts.

---

## 📂 Repository Structure

```
.
├── contracts/
│   ├── core/
│   │   ├── CredXHub.sol                      # Central registry, batch imports & replay defense
│   │   ├── CreditScoreEngine.sol             # OCCR multi-factor scoring & dynamic APR engine
│   │   ├── CreditAttestationSBT.sol          # Soulbound Credit Attestation Token (CX-SBT)
│   │   └── UndercollateralizedLendingPool.sol # Capital pool & under-collateralized loans
│   ├── interfaces/
│   │   ├── IAttestationVerifier.sol          # Creditcoin Attestcoin precompile (0x0FD2) interface
│   │   ├── ICredXHub.sol                     # CredX core interface & ActionType enum
│   │   └── ILendingPool.sol                  # Lending pool interface
│   └── mocks/
│       ├── MockAttestationOracle.sol         # Attestcoin local simulation harness
│       └── MockERC20.sol                     # cUSD liquidity stablecoin
├── scripts/
│   ├── generateProof.js                      # Offchain Merkle proof packager
│   ├── deploy.js                             # Creditcoin deployment script (with SBT)
│   └── test-e2e.js                           # End-to-end multi-protocol demonstration
├── test/
│   └── CredX.test.js                         # Comprehensive 23-test suite
├── frontend/                                 # Web3 Cyber-Fintech DApp
│   ├── index.html                            # Interactive user interface
│   ├── style.css                             # Glassmorphism design system
│   └── app.js                                # Ethers.js integration & simulation engine
├── hardhat.config.js                         # Hardhat config for Creditcoin Testnet (102031)
└── package.json
```

---

## 🚀 Quick Start & Testing

### 1. Install Dependencies
```bash
npm install
```

### 2. Run the Full Test Suite (23 Passing Unit Tests)
```bash
npx hardhat test
```

### 3. Run the End-to-End Workflow Demonstration
```bash
npx hardhat run scripts/test-e2e.js
```

### 4. Deploy to Creditcoin Testnet (Chain ID 102031)
```bash
npx hardhat run scripts/deploy.js --network creditcoinTestnet
```

---

## 🏆 DoraHacks Hackathon Submission Data

* **Project Name**: CredX Protocol
* **Track**: DeFi & RWA (Real-World Assets)
* **Tagline**: Cross-Chain Trustless Credit Bureau & Under-Collateralized Lending via Attestcoin Protocol
* **Source Chains**: Ethereum Mainnet, Ethereum Sepolia
* **Destination Chain**: Creditcoin Testnet (Chain ID `102031`)
* **Attestcoin / USC Integration**: Directly interfaces with Creditcoin's cryptographic proof verifier precompile at `0x0FD2` to validate Merkle inclusion proofs of historical DeFi transactions and RWA invoice receipts, unlocking under-collateralized borrowing and soulbound credit identities.

---

## 📄 License
MIT License. Open source for Creditcoin ecosystem builders.
