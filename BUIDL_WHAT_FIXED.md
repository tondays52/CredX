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
- **`UsageMeteringRegistry` (prepaid v2)** (`contracts/core/UsageMeteringRegistry.sol`, live at `0xF8a9645ac3D234cf72B0C4C170cFB289FE2Ae4F9`)
  Metered accountable usage: meters per wallet + action key with unit price + window cap; meter advances **only** on a verified attested receipt (public proof path) or via a registered KYC agent (telemetry path); window caps **fail closed** (`ExceedsWindowCap` reverts); accrued debt is on-chain and payable in cUSD. **v2 prepaid credits**: a top-up (settlement-token tx) funds a prepaid balance that is consumed **before any debt**, fail-closed — a debit exceeding prepaid reverts (`InsufficientPrepaid`) rather than silently drifting into debt; withdrawals return unused prepaid.

These ideas are backed by **14 policy-layer tests** (recipient enforcement, attested-tranche gating, freeze/settle, fail-closed caps, window rollover, KYC-agent-only telemetry, debt settlement) plus **5 new prepaid-credit tests** (top-up, withdraw, prepaid-first consumption, fail-closed overdraw).

## 2b. Flagship: Verified Escrow + Evidence Registry (ideas 5 & 6)

Deployed and verified on Creditcoin testnet (chainId 102031), re-deployable with `npm run deploy:flagship`:

- **`VerifiedEscrow`** (`contracts/core/VerifiedEscrow.sol`, live at `0x07aBcbb7b2F9f4400c93d092F343e186ee526137`)
  Condition-locked, proof-gated settlement escrow. A depositor locks cUSD against an order ref; release requires a cross-chain receipt that verifies against the deployed Attestcoin verifier (**and**, when pinned, an exact event signature / Topic0) — so only the attested event pays. The seller, order reference, amount and deadline are bound at creation; the same receipt can never pay twice (`keccak(sourceChainId, txHash)` is consumed and replay-guarded); after the deadline, anyone can trigger the refund — funds can never be locked forever. Backed by **8 automated tests** (condition-locked funding, proof-gated release, wrong-signature rejection, replay-receipt rejection, seller/order/amount/deadline binding, deadline refund).
- **Evidence Registry** (`frontend/src/components/terminal/EvidenceRegistryView.tsx`)
  Every proof-gated event is recoverable on-chain via `eth_getLogs` from the deployed contracts: `ProofAnchored` attestation anchors, `EscrowReleased` releases, `UsageRecorded` / `PrepaidConsumed` metered + prepaid usage. This is the same read surface a dispute auditor or judge queries — nothing can be quietly reversed.

Full suite is now **126/126 passing**.

## 3. Earlier battery (still shipping, now counted into 22 deployed contracts)

- RiskGuard verify-then-execute policy gate + Covenant Ops live collateral-liveness feed (already submitted, kept live).
- 18 existing contracts across all 5 tracks (DeFi, RWA, Gaming, DePIN, AI) + Reputation Arena, all verified on Blockscout.

## 4. Frontend / product

- New live panes in the Proofs & Attest tab reading the deployed contracts: **Purpose-Bound RWA** (`PurposeFundView.tsx`), **Usage Meters + Prepaid Credits** (`MeterTrackingView.tsx`), **Verified Escrow** (`VerifiedEscrowView.tsx`) and the **Evidence Registry** (`EvidenceRegistryView.tsx`), with deterministic, explicitly-labeled SIMULATED policy traces and honesty badges — no mocked live feeds. Escrow release/refund, meter top-up/withdraw and new-esrow creation sign real transactions with a connected wallet.
- Addresses registered in `frontend/src/config/contracts.ts` + `frontend/contracts.json`; live-read service functions in `credXService.ts` (ethers v6, read-only RPC + `eth_getLogs` evidence recovery).
- **18-slide deck** regenerated (`CredX_BUIDL_Deck.pdf`) with four policy-layer slides; counts corrected to 126 tests / 22 contracts.
- **Full demo video** `CredX_Demo.mp4` regenerated with scenes for RiskGuard, Covenant Ops, Purpose-Bound RWA, Usage Meters, Verified Escrow and Evidence Registry.

## 5. Docs & reproducibility

- `README.md` updated: new honesty-positioning blockquote, test counts 99→126, the three policy-layer deployed addresses, `npm run deploy:policy` + `npm run deploy:flagship`.
- `DORAHACKS_SUBMISSION.md` updated: positioning (22 contracts), §5b enterprise policy layer (6 layers incl. escrow + evidence registry), test evidence (126), deployments table (+3 rows), §10c engineering appendix.
- `CREDX_DIFFERENTIATION_MATRIX.md` added: every field competitor cluster mapped honestly to the CredX contracts that actually cover it.
- Live re-deploy of the product to https://credx-protocol.vercel.app.

## Verify everything yourself

```bash
npx hardhat test                     # 126/126 passing
npm run deploy:policy                # (re)deploy the policy layer to Creditcoin testnet
npm run deploy:flagship              # (re)deploy Verified Escrow + prepaid-meter v2
npm run usc:verify                   # real Sepolia proof -> 0x0FD2 -> on-chain anchor
cd frontend && npm install && npm run build && npm run preview
# open http://127.0.0.1:4173/#/lending -> Proofs & Attest -> the six policy panes, all LIVE
```