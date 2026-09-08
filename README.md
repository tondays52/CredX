# 🛡️ CredX Protocol: Cross-Chain Trustless Credit Scoring & Under-Collateralized Lending

> **Built natively for the Creditcoin BUIDL Hackathon 2026 Fall (DoraHacks)**  
> *Powered by Creditcoin's Universal Smart Contracts (USC) / Attestcoin Protocol*

---

## ⚡ Executive Summary

DeFi today is crippled by a **150%+ over-collateralization requirement** ($150 of capital locked to borrow $100). Borrowers who have flawlessly repaid hundreds of thousands of dollars across Ethereum DeFi protocols (Aave, MakerDAO, Compound) or settled real-world trade finance invoices are treated as total strangers on new blockchains.

**CredX** solves this capital inefficiency by turning **Creditcoin into the global trustless credit layer**. Using Creditcoin's **Attestcoin Protocol (USC)**, CredX smart contracts directly read and cryptographically verify past transaction events and Merkle receipts from **Ethereum Mainnet and Sepolia**—without risky bridges and without centralized oracles.

Verified actions instantly boost the borrower's onchain **Creditcoin Trust Score (CTS)**, unlocking **under-collateralized borrowing limits (down to 70% collateral ratio)** and discounted interest rates on Creditcoin.

---

## 🏗️ Architecture & Attestcoin / USC Integration

```
 [ Ethereum Mainnet / Sepolia ]                       [ Creditcoin L1 (EVM) ]
  ┌──────────────────────────────┐                      ┌─────────────────────────────────┐
  │ User Repays Loan on Aave v3  │                      │       CredXHub.sol              │
  │ or Settles RWA Invoice Tx    │                      │  (Proof Coordinator & Registry) │
  └──────────────┬───────────────┘                      └────────────────▲────────────────┘
                 │                                                       │
                 │ 1. Transaction Receipt & Merkle Proof                 │ 3. Verified Event Fact
                 ▼                                                       │    (Triggers Score Upgrade &
  ┌──────────────────────────────┐                      ┌────────────────┴────────────────┐     Unlocks Credit Line)
  │ Merkle & Inclusion Proof     │ ────────────────────▶│ Creditcoin Native Precompile /  │
  │ Generator (RLP Receipts)     │   2. Submit Tx &     │ Attestcoin Oracle (0x000...09)  │
  └──────────────────────────────┘      Proof           └─────────────────────────────────┘
                                                                         │
                                                                         │ 4. Updates Borrower Limits
                                                                         ▼
                                                        ┌─────────────────────────────────┐
                                                        │ UndercollateralizedLendingPool  │
                                                        │ (Borrow at 70% Collateral Ratio)│
                                                        └─────────────────────────────────┘
```

---

## 📐 Mathematical Model: Creditcoin Trust Score (CTS)

The **CreditScoreEngine** calculates a deterministic onchain credit score in the range of **300 to 850**:

$$\text{CTS} = \text{Base} + S_{\text{vol}} + S_{\text{freq}} + S_{\text{recency}} + S_{\text{tier}}$$

* **$\text{Base}$**: $450$ points initial baseline for active wallets.
* **$S_{\text{vol}}$ (Volume Contribution, up to $+250$ pts)**: Logarithmic scaling based on verified USD debt repayment volume:
  * $\ge \$100,000 \rightarrow +250 \text{ pts}$
  * $\ge \$50,000 \rightarrow +180 \text{ pts}$
  * $\ge \$10,000 \rightarrow +110 \text{ pts}$
  * $\ge \$1,000 \rightarrow +50 \text{ pts}$
* **$S_{\text{freq}}$ (Proof Frequency, up to $+100$ pts)**: Rewards consistent track records ($+10 \text{ pts per verified attestation}$, capped at 10 txs).
* **$S_{\text{recency}}$ (Activity Bonus, $+50$ pts)**: Active verified repayment within the last 30 days.
* **$S_{\text{tier}}$ (Source Chain Multiplier, $+20$ pts)**: High-security boost for Ethereum Mainnet L1 receipts.

### 🎯 Dynamic Collateral Tiers

| Tier | CTS Range | Required Collateral Ratio | Max Borrow Limit | Borrow APR Discount |
| :--- | :---: | :---: | :---: | :---: |
| **Prime** | **780 - 850** | **70.0% (Under-Collateralized)** | Up to 150% of verified volume | **-3.00%** |
| **Gold** | 700 - 779 | 85.0% | Up to 100% of verified volume | -2.00% |
| **Silver** | 620 - 699 | 110.0% | Up to 50% of verified volume | -1.00% |
| **Standard** | 300 - 619 | 150.0% (Over-collateralized) | Baseline ($1,000) | 0.00% |

---

## 📂 Repository Structure

```
.
├── contracts/
│   ├── core/
│   │   ├── CredXHub.sol                      # Central registry & proof replay defense
│   │   ├── CreditScoreEngine.sol             # Deterministic CTS rating algorithm
│   │   └── UndercollateralizedLendingPool.sol # Liquidity pool & under-collateralized loans
│   ├── interfaces/
│   │   ├── IAttestationVerifier.sol          # Creditcoin Attestcoin precompile interface
│   │   ├── ICredXHub.sol                     # CredX core interface
│   │   └── ILendingPool.sol                  # Lending pool interface
│   └── mocks/
│       ├── MockAttestationOracle.sol         # Attestcoin local test harness
│       └── MockERC20.sol                     # cUSD liquidity stablecoin
├── scripts/
│   ├── generateProof.js                      # Offchain Merkle proof packager
│   ├── deploy.js                             # Creditcoin deployment script
│   └── test-e2e.js                           # End-to-end demonstration workflow
├── test/
│   └── CredX.test.js                         # Hardhat unit & integration test suite
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

### 2. Run the Smart Contract Test Suite
```bash
npx hardhat test
```

### 3. Deploy to Creditcoin Testnet (Chain ID 102031)
```bash
npx hardhat run scripts/deploy.js --network creditcoinTestnet
```

### 4. Launch the Interactive Web3 Frontend
Open `frontend/index.html` directly in your browser or run:
```bash
npm run start:frontend
```

---

## 🏆 DoraHacks Hackathon Submission Data

* **Project Name**: CredX Protocol
* **Track**: DeFi & RWA (Real-World Assets)
* **Tagline**: Cross-Chain Trustless Credit Scoring & Under-Collateralized Lending via Attestcoin Protocol
* **Source Chains**: Ethereum Mainnet, Ethereum Sepolia
* **Destination Chain**: Creditcoin Testnet (Chain ID `102031`)
* **USC / Attestcoin Integration**: Directly calls the Creditcoin Proof Verifier precompile to validate transaction inclusion receipts from source EVM networks, executing autonomous credit scoring and lending with zero centralized oracles and zero bridge contracts.

---

## 📄 License
MIT License. Open source for Creditcoin ecosystem builders.
