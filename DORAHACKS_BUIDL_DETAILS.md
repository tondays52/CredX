# DoraHacks BUIDL — Project Details: CredX Protocol

> Ready-to-paste fields for the DoraHacks BUIDL submission form. Everything below is live and reproducible.

---

## Basic info

- **Project name**: CredX Protocol
- **One-liner / tagline**: The cross-chain trustless credit bureau and under-collateralized lending protocol, powered by Creditcoin's Attestcoin Protocol (UTC/0x0FD2) — plus an enterprise policy layer (purpose-bound RWA funding, metered accountable usage).
- **Event**: BUIDL CTC 2026 Fall — BUIDL For The Real World (Creditcoin & Credit Labs)
- **Track**: Creditcoin Ecosystem / DeFi / RWA / DePIN / AI / Gaming (multi-track)
- **GitHub**: https://github.com/tondays52/CredX
- **Live app**: https://credx-protocol.vercel.app
- **Target network**: Creditcoin L1 testnet, chain ID `102031`
- **Source chains attested**: Ethereum Mainnet (`1`), Sepolia (`11155111`), Base, Arbitrum
- **Demo video**: `CredX_Demo.mp4` — 2:38, 1920×1080/30, 14 scenes (title card, 5 tracks, LIVE 0x0FD2 verification, RiskGuard, Covenant Ops, Purpose-Bound RWA, Usage Meters, Blockscout anchors)
- **Pitch deck**: `CredX_BUIDL_Deck.pdf` — 18 slides
- **Team**: Ton (tondays52@gmail.com) — Solidity, smart contracts, frontend, Creditcoin/Attestcoin integration. MIT license.

---

## Short description (paste-able paragraph)

DeFi is stuck in a 150%+ over-collateralization trap: borrowing $100 requires locking $150 — even for wallets that have repaid hundreds of thousands of dollars on Ethereum. **CredX turns Creditcoin into the global trustless credit bureau for Web3.** Using Creditcoin's native **Attestcoin Protocol (USC)**, it cryptographically verifies cross-chain transaction receipts and Merkle inclusion proofs **directly on the live `0x0FD2` BlockProver precompile** — no bridges, no multi-sig relayers, no centralized oracles. Verified history feeds an academic **OCCR 7-dimension credit-scoring engine (300–850 CTS)** that unlocks under-collateralized lending (down to 70% collateral), dynamic FICO-style APRs (2.5%–12%), and Soulbound Credit Passports (CX-SBT) with zero-knowledge privacy commitments. On top of the credit spine, CredX ships an **enterprise policy layer that the field leaves open**: a RiskGuard verify-then-execute policy gate, a live Covenant Ops / collateral-liveness feed, **purpose-bound RWA funding** (money locked to a declared purpose until an attested receipt unlocks it) and **metered accountable usage** (attested increments, fail-closed caps, on-chain debt). **20 contracts deployed and verified on Creditcoin testnet, 113/113 automated tests passing, everything live on-chain — nothing faked.**

---

## How it uses the sponsor tech (Creditcoin / Attestcoin)

- Live `BlockProverAttestationOracle` (`0x4d11b60809724b0B67B28DA2f38438aE97f1C671`, verified on Blockscout) wraps the exact `@gluwa/usc-sdk` ABIs of the **`0x0FD2` BlockProver** and **`0x0FD3` ChainInfo** precompiles.
- A real Ethereum Sepolia transaction was proven via Creditcoin's official proof-builder service, verified **SUCCESS on `0x0FD2`**, emitted the canonical `TransactionVerified` event, and was anchored on-chain (`0xd0b88f...befd69`, `anchoredCount=1`). Reproduce anytime: `npm run usc:verify`.
- Credit actions ingest source-chain id + block header + tx hash/index + RLP receipt + Merkle proof, with deterministic replay defense `keccak256(chain|txHash|txIndex)`.
- A distinctly-labeled always-pass `MockAttestationOracle` exists **only** as a gasless fallback for score boosts; it is never presented as the precompile.

## What was built (key innovations, ideas 1–5)

1. **RiskGuard — Verify-Then-Execute policy gate.** The agent proposes; the deterministic contract decides. Proposals execute only after a 4-gate trace: collateral liveness, covenant boundary, action allowlist (fail-closed), and live `0x0FD2` cryptographic verification. Failures return `REFUSED` with the violated rule cited.
2. **Covenant Ops — Collateral Liveness & Covenant feed.** One pane over every verified spine fact read live from the deployed oracle (0x0FD3 ChainInfo); new credit closes the instant an attested receipt proves collateral left the source chain and re-opens on restoration.
3. **PurposeBoundFunding** (`0x551592C32a96555A04BB016c2DF7138A1f9DE644`) — funds locked to a declared purpose at funding time; before an attested usage receipt, disbursement goes *only* to the allowlisted counterparty, never the borrower; proven breach freezes the record; settlement repays principal + interest and refunds collateral.
4. **UsageMeteringRegistry** (`0xd0aD5750F3Ea9F4d699e5aa3612E9f48BafE9eD5`) — meters per wallet + action key with unit price and window cap; meter advances only on a verified attested receipt or registered KYC agent; caps **fail closed**; debt is on-chain and payable in cUSD.
5. **Honesty as a feature.** Every number in the demo is read live from a deployed contract or explicitly labeled SIMULATED. No mocked live feeds, no cherry-picked charts — what judges see is what the 113 tests assert.

Plus the 5-track ecosystem on the same spine: DeFi (under-collateralized lending, flash loans, yield vaults, AMM), RWA (invoice financing, treasury yield fund, purpose-bound funding), Gaming (anti-sybil, lootboxes, zero-collateral guild scholarships), DePIN (staking delegation, hardware financing, virtual-node extension), AI (AgentFi credit lines, oracle-less risk, verifiable compute escrow) — and ReputationArena binary trade terminal.

## Evidence of rigor

- **113/113 automated tests** (`npx hardhat test`) covering OCCR math, replay defense, batch imports, deadswitch, all 5 tracks, Reputation Arena, and the 14-test enterprise policy layer.
- **Security**: CodeQL clean; SonarCloud quality gate passed (Rating A/A/A, 0 bugs, 0 vulnerabilities, 0 security hotspots); `npm audit --omit=dev` = **0 production vulnerabilities**.
- **Secrets hygiene**: exposed GitHub PAT and RapidAPI key rotated; no secrets in the repo.
- **Live product**: deployed at https://credx-protocol.vercel.app (production, HTTPS) with all four policy panes reading the deployed contracts.

## Reproduce everything

```bash
git clone https://github.com/tondays52/CredX && cd CredX
npm install
npx hardhat test          # 113/113 passing
npm run usc:verify        # live Sepolia proof -> 0x0FD2 -> on-chain anchor
npm run deploy:policy     # (re)deploy Purpose-Bound RWA + Usage Meters to Creditcoin testnet
cd frontend && npm install && npm run dev   # Web3 Terminal at localhost:5173
```