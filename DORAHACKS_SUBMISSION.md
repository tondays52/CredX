# 🏆 DoraHacks BUIDL Submission Package: CredX Protocol
**BUIDL CTC 2026 Fall: BUIDL For The Real World**  
*Sponsored by Creditcoin & Credit Labs*

---

## 📋 1. Basic Information

* **Project Name**: CredX Protocol
* **Tagline**: The first cross-chain trustless credit bureau and under-collateralized lending protocol powered by Creditcoin's Attestcoin Protocol (USC).
* **Track**: **Creditcoin Ecosystem / DeFi / RWA / DePIN / AI / Gaming** (Multi-Track)
* **GitHub Repository**: `https://github.com/tondays52/CredX`
* **Target Network**: Creditcoin L1 (Chain ID: `102031`)
* **Source Blockchains Attested**: Ethereum Mainnet (Chain ID `1`), Ethereum Sepolia (Chain ID `11155111`), Base, Arbitrum

---

## ⚡ 2. Elevator Pitch (30 Seconds)

DeFi is stuck in a 150%+ over-collateralization trap: if you want to borrow $100, you must lock $150. Even if you have repaid $500,000 across Aave, Compound, or real-world invoices on Ethereum, you are treated as a complete stranger on new blockchains.

**CredX solves this by turning Creditcoin into the global trustless credit bureau for Web3.** CredX is designed around Creditcoin’s native **Attestcoin Protocol (`0x0FD2`)**: it cryptographically verifies historical transaction receipts and Merkle inclusion proofs from Ethereum without risky bridges or centralized oracles. On the current testnet deployment this verification runs **LIVE on Creditcoin testnet** through CredX's own deployed `BlockProverAttestationOracle`, which wraps the `0x0FD2`/`0x0FD3` precompiles and has verified + anchored a real Sepolia proof on-chain (see §5). A distinctly-labeled always-pass `MockAttestationOracle` remains only as a gasless fallback for score boosts inside CredXHub/AutonomousAIHub and is never presented as the real precompile (see `ATTESTCOIN_INTEGRATION.md`). Verified actions feed into an academic **OCCR (On-Chain Credit Risk) 7-dimension scoring engine (300–850 CTS)**, unlocking **under-collateralized lending down to 70% collateral (saving 53% in locked capital)**, institutional **2.5% APR**, and **Soulbound Credit Passports (CX-SBT)** with zero-knowledge privacy commitments.

> **Positioning:** CredX is the attestation backbone and policy layer, not one more credit passport. Where the field ships single one-feature apps that "prove one event on one chain", CredX ships **five integrated tracks on one verified spine** — 16 deployed contracts, a full automated test suite, a **RiskGuard verify-then-execute policy gate**, and a **live Covenant Ops / collateral-liveness feed** driven directly by the deployed oracle. CredX is the platform; the pack is single-function applications.

---

## 🎯 3. Problem Statement & Market Opportunity

1. **Massive Capital Inefficiency**: Standard DeFi protocols require 130%–150%+ collateralization. This prices out creditworthy borrowers, small businesses, and institutions needing working capital.
2. **Reputation Fragmentation**: A user’s multi-year creditworthiness on Ethereum (Aave, Maker, Uniswap, trade finance) cannot be read by another blockchain without centralized bridges or custodial oracles.
3. **Privacy Dilemma**: Traditional on-chain identity systems expose every wallet transaction publicly, violating institutional privacy and GDPR standards.
4. **Oracle & Bridge Vulnerability**: Over $2.8 billion has been lost to cross-chain bridge hacks. Cross-chain lending cannot rely on multi-sig relayer bridges.

---

## 🛠️ 4. The Solution: CredX Protocol

CredX bridges the gap between historical cross-chain creditworthiness and capital efficiency:
1. **Attestcoin Consensus Verification**: Validation of source chain RLP receipts through the Attestcoin verification flow (**LIVE** on Creditcoin testnet via the `0x0FD2` BlockProver precompile — see §5).
2. **OCCR Multi-Factor Credit Scoring**: Grounded in 2025/2026 academic research (*"On-Chain Credit Risk Score in DeFi"*), scoring across 7 dimensions (volume, protocol diversity, chain diversity, frequency, recency, source quality, and weighted action types).
3. **Under-Collateralized Lending Pool**: Borrowers with Super-Prime CTS (780+) borrow cUSD against native CTC collateral at just **70% collateral ratio** (vs. 150% in standard DeFi), preserving thousands of dollars in liquidity.
4. **FICO-Style Dynamic APR**: Personalized borrowing interest rates ranging from **2.5% APR (Super-Prime)** to 12.0% APR (Subprime).
5. **Soulbound Credit Attestations (CX-SBT)**: Non-transferable ERC-721 credentials with selective disclosure that prove `"This wallet has CTS ≥ 780"` using cryptographic `keccak256` commitment hashes.
6. **Social Vouching (Credit Delegation)**: Prime+ borrowers can delegate up to 100 CTS points to vouch for colleagues or junior borrowers.
7. **Atomic Batch Proof Imports**: `submitBatchProofs()` allows importing up to 20 cross-chain proofs in a single transaction.

---

## 🔗 5. Attestcoin Protocol (USC) Integration Summary
> *(Mandatory Hackathon Section: Explicitly detailing how CredX leverages the Attestcoin Protocol)*

CredX is architected from the ground up around Creditcoin's Attestcoin Protocol:

> **✅ Integration status (LIVE):** Core, present, and functional. `BlockProverAttestationOracle` (`contracts/core/tracks/BlockProverAttestationOracle.sol`, verified on Blockscout at `0x4d11b60809724b0B67B28DA2f38438aE97f1C671`) wraps Creditcoin's native Attestcoin precompiles — BlockProver `0x0FD2` and ChainInfo `0x0FD3` — using the exact `@gluwa/usc-sdk` ABI. A real **Ethereum Sepolia** transaction was proven from Creditcoin's official proof-builder service and verified **SUCCESS** on `0x0FD2`; the canonical `TransactionVerified` event was emitted (`0x7dff1ed946c291a2f82adb9e4f1baa9b4c83d8cdf3b378fd90215a8ea9b0dd29`) and the proof anchored on-chain (`0xd0b88f9e7b596e1f23b5d99db9f72261c0d45ab208cd5381c623bca1a8befd69`, `anchoredCount=1`). Reproduce any time: `npm run usc:verify`. A distinctly-labeled always-pass `MockAttestationOracle` remains only as a gasless fallback for score boosts inside CredXHub/AutonomousAIHub and is never presented as the real precompile (see `ATTESTCOIN_INTEGRATION.md` for the full transcript and code).

* **Precompile Target (live)**: `BlockProverAttestationOracle` is verified on-chain and talks to the BlockProver precompile at `0x0000000000000000000000000000000000000FD2` (`0x0FD2`) and ChainInfo precompile `0x0FD3`.
* **Verified, not simulated**: `verifySourceTransaction(...)` forwards to the `0x0FD2` precompile `verify`; `anchorVerifiedTransaction(...)` calls `verifyAndEmit` (emitting the canonical `TransactionVerified` event), then records the proof on-chain with replay protection (`ProofAnchored`, `anchoredCount`).
* **Cryptographic Merkle Proof Validation**: Instead of trusting an off-chain oracle operator, `CredXHub.sol` receives:
  - Source Chain ID (`1` for Mainnet, `11155111` for Sepolia)
  - Source block header hash and block number
  - Transaction hash & index within the block
  - RLP-encoded transaction receipt containing event logs
  - Merkle Patricia Trie inclusion proof
* **Consensus-Level Security**: The Attestcoin verifier cryptographically validates the Merkle path against the attested block header agreed upon by Creditcoin validators.
* **Deterministic Replay Defense**: CredX computes a unique key `keccak256(sourceChainId, txHash, txIndex)` to prevent the same transaction from ever being credited twice.
* **ThirdCheck 3-Tier Proof Auditing**: Closes the "valid proof, wrong event" attack vector by enforcing consensus validation (`0x0FD2`), semantic log decoding (`Topic0` and transfer/repay argument extraction), and nullifier registration.
* **Cross-Chain Collateral Deadswitch**: Protects lenders against malicious collateral drains on source chains (Ethereum/Base/Arbitrum) via automatic grace-period liquidation and credit freezes upon verified withdrawal proofs.
* **Zero Bridge Risk**: Assets remain safely on their native chains; only cryptographic proofs of historical events cross over to Creditcoin.

---

## 🛡️ 5b. Enterprise Policy Layer: RiskGuard Verify-Then-Execute + Covenant Ops

Shipping a lender-grade product means the proof alone is not enough — the *decision* must be enforced by contract, not by whoever called the function. CredX ships two coordinate layers on top of the oracle:

1. **RiskGuard — Verify-Then-Execute Policy Gate** (`frontend/src/components/terminal/RiskGuardView.tsx`)
   The agent proposes; the deterministic contract decides. A proposal only executes after a four-gate trace passes: **(r1)** Collateral Liveness — the attested receipt shows the collateral still on the source chain; **(r2)** Covenant Boundary — requested exposure stays inside the borrower's covenant cap read from CredXHub; **(r3)** Action Allowlist — the action is policy-allowlisted (off-list actions fail closed); **(r4)** 0x0FD2 Oracle Bound — the receipt is cryptographically verified by the BlockProver precompile. Any failing gate produces an on-chain-style `REFUSED` with the failing rule cited. The UI binds r4 to a **live in-browser 0x0FD2 verification** of the latest attested Sepolia transaction (Merkle + continuity proof from the official proof-builder service, verified against the deployed precompile — no wallet needed).
2. **Covenant Ops — Collateral Liveness & Covenant Feed** (`frontend/src/components/terminal/CovenantOpsFeed.tsx`)
   One pane of glass over every verified spine fact: attestation heights, anchored proof count, and supported source chains read **live from the deployed `BlockProverAttestationOracle`** (via the 0x0FD3 ChainInfo precompile). Per-position collateral-liveness rules decide whether new credit stays open: the instant an attested receipt proves the collateral departed the source chain, **new credit is blocked** while repayment and withdrawal remain open, and it re-opens automatically when a fresh receipt shows the collateral restored. No oracle, no bridge, no operator decision — the precompile verdict is the only trust root.

This is the "third check" the field leaves open: a valid proof of the *wrong thing* is refused on-chain, and credit exposure self-corrects on attested fact, not on reputation.

---

## 🏛️ 6. System Architecture & Smart Contracts

```
┌─────────────────────────────────────────────────────────────────┐
│                        SOURCE NETWORKS                          │
│   Ethereum Mainnet (Chain 1) | Sepolia Testnet (11155111)       │
│   Aave v3 | Compound v3 | Uniswap v3 LP | ENS | RWA Invoices    │
└─────────────────────────────────────────────────────────────────┘
                               │
                               │ (RLP Receipts & Merkle Proofs)
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                    CREDITCOIN NETWORK (L1 EVM)                   │
│                                                                 │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │ Attestcoin Precompile / Verifier (0x0FD2)               │   │
│   │ - Cryptographic Merkle inclusion verification           │   │
│   │ - Validator consensus validation                        │   │
│   └────────────────────────────┬────────────────────────────┘   │
│                                │                                │
│                                ▼                                │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │ CredXHub.sol                                            │   │
│   │ - submitRepaymentProof() & submitBatchProofs()          │   │
│   │ - Replay protection & privacy commitment hashing        │   │
│   │ - delegateCredit() social underwriting                  │   │
│   └───────────────┬─────────────────────────┬───────────────┘   │
│                   │                         │                   │
│                   ▼                         ▼                   │
│   ┌────────────────────────┐  ┌─────────────────────────────┐   │
│   │ CreditScoreEngine.sol  │  │ UndercollateralizedPool.sol │   │
│   │ - 7-dimension OCCR     │  │ - 70% min collateral ratio  │   │
│   │ - 8 action type weights│  │ - Dynamic APR (2.5% - 12%)  │   │
│   │ - Dynamic APR pricing  │  │ - Capital savings counter   │   │
│   └────────────────────────┘  └─────────────────────────────┘   │
│                   │                                             │
│                   ▼                                             │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │ CreditAttestationSBT.sol (CX-SBT)                       │   │
│   │ - Non-transferable Soulbound credit passport            │   │
│   │ - Selective disclosure via privacy commitment hash      │   │
│   │ - Composable third-party verification                   │   │
│   └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### Core Contracts in Repo
* [`contracts/core/CredXHub.sol`](file:///d:/money/contracts/core/CredXHub.sol): Central coordinator, batch proof processor, and replay lock registry.
* [`contracts/core/CreditScoreEngine.sol`](file:///d:/money/contracts/core/CreditScoreEngine.sol): Institutional OCCR multi-factor scoring model and dynamic APR engine.
* [`contracts/core/UndercollateralizedLendingPool.sol`](file:///d:/money/contracts/core/UndercollateralizedLendingPool.sol): Capital lending pool enabling borrowing at 70% collateral ratio with dynamic APR.
* [`contracts/core/CreditAttestationSBT.sol`](file:///d:/money/contracts/core/CreditAttestationSBT.sol): Soulbound Token (CX-SBT) implementing selective disclosure with privacy commitment hashes.
* [`contracts/core/tracks/BlockProverAttestationOracle.sol`](file:///d:/money/contracts/core/tracks/BlockProverAttestationOracle.sol): **Live Attestcoin integration** wrapping the `0x0FD2` BlockProver and `0x0FD3` ChainInfo precompiles (USC SDK ABI) with on-chain proof anchoring + replay protection.
* [`contracts/interfaces/ICreditcoinBlockProver.sol`](file:///d:/money/contracts/interfaces/ICreditcoinBlockProver.sol) / [`ICreditcoinChainInfo.sol`](file:///d:/money/contracts/interfaces/ICreditcoinChainInfo.sol): Exact ABI of the Attestcoin precompiles, mirrored from `@gluwa/usc-sdk`.
* [`contracts/interfaces/IAttestationVerifier.sol`](file:///d:/money/contracts/interfaces/IAttestationVerifier.sol): Gasless score-boost flow implemented by the distinctly-labeled `MockAttestationOracle` harness (fallback only).

---

## 🔬 7. Mathematical Model: OCCR Multi-Factor Credit Risk Engine

$$\text{CTS} = \text{Base} + S_{\text{vol}} + S_{\text{proto}} + S_{\text{chain}} + S_{\text{freq}} + S_{\text{recency}} + S_{\text{quality}} + S_{\text{action}} + S_{\text{delegation}}$$

* **Base Score**: 350 points baseline.
* **Volume ($S_{\text{vol}}$, up to +200 pts)**: Logarithmic tiers: $\ge \$100\text{k} \rightarrow +200$, $\ge \$50\text{k} \rightarrow +160$, $\ge \$10\text{k} \rightarrow +100$.
* **Protocol Diversity ($S_{\text{proto}}$, up to +80 pts)**: Multi-protocol track record across lending, DEX LP, and RWA: $\ge 5 \rightarrow +80$, $\ge 3 \rightarrow +50$, $\ge 2 \rightarrow +25$.
* **Chain Diversity ($S_{\text{chain}}$, up to +40 pts)**: Cross-chain activity: $\ge 3 \text{ chains} \rightarrow +40$, $2 \text{ chains} \rightarrow +20$.
* **Attestation Frequency ($S_{\text{freq}}$, up to +80 pts)**: Historical consistency: $\ge 15 \text{ txs} \rightarrow +80$, $\ge 10 \rightarrow +60$, $\ge 5 \rightarrow +40$.
* **Recency ($S_{\text{recency}}$, up to +50 pts)**: Activity within 30 days ($+50 \text{ pts}$).
* **Mainnet Source Quality ($S_{\text{quality}}$, +20 pts)**: High-security boost for Ethereum L1 Mainnet receipts.
* **Action Multiplier Bonus ($S_{\text{action}}$, up to +80 pts)**: Weighted by economic significance:
  - RWA Invoice Settlement: **1.8x**
  - DeFi Loan Repayment: **1.5x**
  - Staking Collateral Lock: **1.3x**
  - Uniswap LP Provision: **1.2x**
  - Compound Collateral Supply: **1.0x**
  - Stablecoin Transfer: **0.8x**
  - ENS Identity: **0.5x**
  - On-Chain Identity Verified: **0.4x**

### Tier Matrix & Capital Efficiency

| Tier | CTS Range | Collateral Ratio | Borrow APR | Max Credit Line | Capital Savings vs DeFi |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Super-Prime 🏆** | **780 &ndash; 850** | **70.0%** | **2.50%** | 150% of volume | **53.3% capital preserved** |
| **Prime 🌟** | **700 &ndash; 779** | **85.0%** | **5.00%** | 100% of volume | **43.3% capital preserved** |
| **Near-Prime** | **650 &ndash; 699** | **95.0%** | **5.00%** | 50% of volume | **36.7% capital preserved** |
| **Standard** | **580 &ndash; 649** | **120.0%** | **8.00%** | 25% of volume | **20.0% capital preserved** |
| **Subprime** | **300 &ndash; 579** | **150.0%** | **12.00%** | $1,000 baseline | Standard Over-Collateralized |

---

## 🧪 8. Testing, Verification & Demonstration Evidence

* **Automated Unit & Integration Test Suite**: **99 passing tests (100% pass rate, ~8s)** covering all 5 hackathon tracks:
  - OCCR multi-factor scoring calculation (300 to 850 CTS)
  - Multi-protocol action weights & replay attack defense
  - Batch proof import & size limits
  - Dynamic APR tier assignment & Super-Prime under-collateralized borrowing
  - Soulbound Token (CX-SBT) non-transferability & composability
  - Social vouching delegation constraints
  - Privacy commitment generation (`keccak256`)
  - Cross-Chain Deadswitch & Covenant Guard liquidation freeze
  - Track 1 DeFi (Reputation Flash Loans, Multiplier Yield Vault, Dynamic AMM)
  - Track 2 RWA (Institutional Invoice Financing & Treasury Yield Fund)
  - Track 3 Gaming (Anti-Sybil Lootboxes, Fair Gathering, Zero-Fee Marketplace)
  - Track 4 DePIN (Hardware Operator Staking & Financing)
  - Track 5 AI (Autonomous AI Hub, AgentFi Credit Lines, Proof-of-Compute Settlement)
  - Reputation Arena (PredictBay-Style Binary BTC/ETH Paper Trading with Win-Streak Sync)
* **End-to-End Simulation Script** (`scripts/test-e2e.js`):
  - Simulates an unregistered user (`CTS = 300`, 150% collateral required).
  - Submits Aave v3 Sepolia repayment ($50k) and Mainnet Compound proof ($75k).
  - Submits Uniswap LP proof ($25k) demonstrating protocol diversity.
  - Verifies score upgrade to **Super-Prime (794 CTS)**.
  - Mints **CX-SBT #1** with privacy commitment hash.
  - Executes under-collateralized borrow ($10,000 cUSD locking 3,500 CTC vs. 7,500 CTC standard DeFi — **saving 4,000 CTC / $8,000 USD in capital**).
  - Repays loan with accrued dynamic APR and refunds collateral.

### 🌐 8.1. Chrome Extension: Virtual Node & Credit Passport
CredX includes a production Manifest V3 browser extension (`chrome-extension/`) enabling everyday users to participate in the Creditcoin network:
1. **Pulse Virtual Node (DePIN Telemetry)**: Continuously benchmarks local hardware (real CPU cores, device memory, WebGL accelerator, and live millisecond network latency) and shares verified idle bandwidth to earn Creditcoin reputation points.
2. **Credit Passport Reader + Signing Relay**: Reads the live on-chain credit score from CredXHub and can sign a real proof-anchor transaction (`submitBatchProofs`) through a MetaMask relay — the extension never stores or touches a private key.

![CredX Pulse Virtual Node](https://raw.githubusercontent.com/tondays52/CredX/main/screenshots/09_chrome_extension.png)
*Figure 9: CredX Chrome Extension — Pulse Virtual Node DePIN telemetry & real-time point accrual.*

![CredX Attestcoin Daemon](https://raw.githubusercontent.com/tondays52/CredX/main/screenshots/10_chrome_extension_daemon.png)
*Figure 10: CredX Chrome Extension — In-browser Attestcoin Light Client Daemon auditing cross-chain MPT proofs.*

---

## 🗺️ 9. Roadmap & CEIP Fast-Track Goals

* **Phase 1 (Current Hackathon Release)**:
  - Complete core smart contracts, OCCR model, Soulbound Token, batch proofs, and Web3 UI.
  - Test suite with 100% coverage.
* **Phase 2 (Post-Hackathon / CEIP Acceleration)**:
  - Deploy directly to Creditcoin Testnet (CC3) and Mainnet.
  - Integrate with Creditcoin’s live BlockProver service for automatic proof fetching.
  - Partner with RWA tokenization protocols on Creditcoin for institutional invoice financing.
* **Phase 3 (Ecosystem Expansion)**:
  - Deploy SDK for third-party Creditcoin DeFi protocols to call `verifyAttestation()` for VIP collateral rates and undercollateralized flash loans.
  - zk-SNARK proof verification for total balance privacy.

---

## 👥 10. Live Deployments (Creditcoin Testnet — Chain ID: 102031)

| Contract | Address | Network |
|---|---|---|
| **BlockProverAttestationOracle (LIVE 0x0FD2 USC)** | `0x4d11b60809724b0B67B28DA2f38438aE97f1C671` | Creditcoin Testnet |
| **MockAttestationOracle (gasless-score harness)** | `0x34aA30efE2226ffC2E55607017FbA2F07e62b279` | Creditcoin Testnet |
| **CreditScoreEngine (OCCR Model)** | `0xA31697bBd4900f8FA62015A51dA3c58972E96BB6` | Creditcoin Testnet |
| **CredXHub (Core Registry & Batch Importer)** | `0x729b2D8B630c4241d051c92D4FeB31412846eE18` | Creditcoin Testnet |
| **cUSD (Liquidity Stablecoin)** | `0xdec5170C46DC63D812c699E9dFE6561FFd1BF298` | Creditcoin Testnet |
| **UndercollateralizedLendingPool** | `0x84234C1403768D9A509c1241e5F39f81246880d2` | Creditcoin Testnet |
| **CreditAttestationSBT (Soulbound Token)** | `0xb22baF385067aF8d66823282bb4F2e3EECB60831` | Creditcoin Testnet |
| **ReputationAMM (Track 1: DeFi)** | `0x81463b6bf1A8DD535c6DAeF034cAb6ee92434c32` | Creditcoin Testnet |
| **ReputationFlashLoan (Track 1: DeFi)** | `0x4962e6AdF6E59C60058d09b7cA4516dD2410d637` | Creditcoin Testnet |
| **ReputationYieldVault (Track 1: DeFi)** | `0x630943C1eD77b375d2Bb70647090F18a05490bc1` | Creditcoin Testnet |
| **RWATreasuryYieldFund (Track 2: RWA)** | `0x2be1E6044ACEE8868b775a8C48C05f569d1Af80A` | Creditcoin Testnet |
| **RWAInvoiceFinancing (Track 2: RWA)** | `0x05D41AE81c47078DcA0CFF4891A407F4D09E01aA` | Creditcoin Testnet |
| **GamingEcosystemHub (Track 3: Gaming)** | `0x8008c8885AA72a32198159360FFA43bc8De94D75` | Creditcoin Testnet |
| **GameToken / GameNFT (Gaming mocks)** | `0x2536b84fe20BEbc890BBcd8FcCD5dcAdbd26F11E` / `0xcEe244B0EBA321d4c1705692FD7d87998f3cf65d` | Creditcoin Testnet |
| **DePINInfrastructureHub (Track 4: DePIN)** | `0x99b400D55dA3A9f9aDa967b1D60d9E3cBA2bB9Bc` | Creditcoin Testnet |
| **AutonomousAIHub (Track 5: AI)** | `0xEc1445818cF57507Ff46B8a72daa9F7A66B60a5D` | Creditcoin Testnet |
| **ReputationArena (PredictBay Arena)** | `0x42ff8Ea2Bf277F96b7F7f31C07932bcd0C79c9F5` | Creditcoin Testnet |

---

## 🎥 10b. Demo Video

> **PENDING — record per `scripts/demo_video_shotlist.md`, then fill in the link below.**
> Demo link: <https://youtu.be/PASTE_YOUR_VIDEO_URL_HERE>
> Suggested title: "CredX Protocol — Live 0x0FD2 Attestation, 5-Track Credit Bureau (Creditcoin BUIDL 2026)"

---

## 🔍 10c. Engineering Rigor & Verification Appendix

Every claim in this submission is reproducible and labeled honestly — no hidden demos, no faked telemetry:

* **Honest-labeling policy**: every screen that shows a simulated or gasless path carries an explicit **SIMULATED COMING LIVE / LIVE** badge. The live `0x0FD2` verification path is real and re-runnable. The `MockAttestationOracle` is distinctively named and documented as a gasless fallback; it is never presented as the precompile.
* **Test suite**: `npx hardhat test` → **99/99 passing** (16 contracts, scoring math, replay defense, batch import limits, deadswitch/covenant guard, 5-track hubs, Reputation Arena).
* **Security gate**: GitHub Actions CI runs `npm ci --ignore-scripts`, full JS + Solidity test suite, and **CodeQL** (all alerts fixed or dismissed with justification) + **SonarCloud** quality gate **PASSED (Rating A / A / A, 0 bugs, 0 vulnerabilities, 0 security hotspots)** at commit `b11698a`.
* **Dependency posture**: `npm audit --omit=dev` = **0 production vulnerabilities**. All open Dependabot alerts are dev-toolchain-only (Hardhat) transitive packages in the root package-lock; risk accepted and documented in `SECURITY.md`.
* **Reproducibility**: `npm run usc:verify` re-verifies the live Sepolia transaction through the deployed 0x0FD2 precompile at any time. Contract source verified on Blockscout.
* **Live product**: web app deployed at **https://credx-protocol.vercel.app** (production, HTTPS, hash-routed) with the RiskGuard and Covenant Ops panes live against the deployed oracle.

---

## 👥 11. Team & Open Source
* **Team**: Ton
* **License**: MIT License
* **Open Source Commitment**: Built specifically to enrich the Creditcoin L1 ecosystem.

### Team members:
| Name | Role | Email / Contact |
| --- | --- | --- |
| Ton | Founder & Lead Developer (Solidity, Smart Contracts, Frontend, Integration) | tondays52@gmail.com |

