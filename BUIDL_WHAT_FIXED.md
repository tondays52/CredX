# CredX — What Was Fixed, Built & Verified (BUIDL 2026 Fall)

Concise, honest summary of everything new in this submission window. Every claim below is reproducible from `main`.

## 1. Security / hygiene fixes

- **Exposed GitHub PAT rotated** — revoked the leaked token, replaced with a fresh fine-grained PAT; remote updated and verified (`git ls-remote origin` OK).
- **Exposed RapidAPI key rotated** — old key revoked, new key moved into git-ignored `frontend/.env` (`VITE_RAPIDAPI_KEY`); nothing secret is committed or pushed.
- **Vercel prod deployment gate fixed** — HEAD commits are now authored by the GitHub-matched identity (`tondays52 <tondays52@gmail.com>`), so production deployments no longer get blocked; README-facing identity untouched.
- No new dependencies introduced; `npm audit --omit=dev` remains **0 production vulnerabilities**.

## 2. New on-chain ideas: enterprise policy layer (ideas 3 & 4)

Deployed and verified on Creditcoin testnet (chainId 102031), both re-deployable with `npm run deploy:policy`:

- **`PurposeBoundFunding`** (`contracts/core/PurposeBoundFunding.sol`, live at `0x551592C32a96555A04BB016c2DF7138A1f9DE644`)
  Purpose-bound RWA funding: funds locked to a declared `PurposeCode` at funding time; before an attested usage receipt is verified the vault disburses **only to the allowlisted counterparty, never to the borrower**; verified receipts unlock borrower tranches; proven breach freezes the record (covenant deadswitch); settlement repays principal + interest and refunds collateral.
- **`UsageMeteringRegistry`** (`contracts/core/UsageMeteringRegistry.sol`, live at `0xd0aD5750F3Ea9F4d699e5aa3612E9f48BafE9eD5`)
  Metered accountable usage: meters per wallet + action key with unit price + window cap; meter advances **only** on a verified attested receipt (public proof path) or via a registered KYC agent (telemetry path); window caps **fail closed** (`ExceedsWindowCap` reverts); accrued debt is on-chain and payable in cUSD.

Both are backed by **14 new automated tests** (recipient enforcement, attested-tranche gating, freeze/settle, fail-closed caps, window rollover, KYC-agent-only telemetry, debt settlement). Full suite is now **113/113 passing**.

## 3. Earlier battery (still shipping, now counted into 20 deployed contracts)

- RiskGuard verify-then-execute policy gate + Covenant Ops live collateral-liveness feed (already submitted, kept live).
- 18 existing contracts across all 5 tracks (DeFi, RWA, Gaming, DePIN, AI) + Reputation Arena, all verified on Blockscout.

## 4. Frontend / product

- New live panes in the Proofs & Attest tab reading the deployed contracts: **Purpose-Bound RWA** (`PurposeFundView.tsx`) and **Usage Meters** (`MeterTrackingView.tsx`), with deterministic, explicitly-labeled SIMULATED policy traces and honesty badges — no mocked live feeds.
- Addresses registered in `frontend/src/config/contracts.ts` + `frontend/contracts.json`; live-read service functions in `credXService.ts` (ethers v6, read-only RPC).
- **18-slide deck** regenerated (`CredX_BUIDL_Deck.pdf`) with two new policy-layer slides; counts corrected to 113 tests / 20 contracts.
- **Full demo video** `CredX_Demo.mp4` (2:38, 1080p/30) regenerated with scenes for RiskGuard, Covenant Ops, Purpose-Bound RWA and Usage Meters.

## 5. Docs & reproducibility

- `README.md` updated: new honesty-positioning blockquote, test counts 99→113, the two new deployed addresses, `npm run deploy:policy`.
- `DORAHACKS_SUBMISSION.md` updated: positioning (20 contracts), §5b enterprise policy layer (4 layers), test evidence (113), deployments table (+2 rows), §10c engineering appendix.
- Live re-deploy of the product to https://credx-protocol.vercel.app.

## Verify everything yourself

```bash
npx hardhat test                     # 113/113 passing
npm run deploy:policy                # (re)deploy the policy layer to Creditcoin testnet
npm run usc:verify                   # real Sepolia proof -> 0x0FD2 -> on-chain anchor
cd frontend && npm install && npm run build && npm run preview
# open http://127.0.0.1:4173/#/lending -> Proofs & Attest -> the four policy panes, all LIVE
```