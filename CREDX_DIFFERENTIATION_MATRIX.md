# CredX Differentiation Matrix (BUIDL CTC 2026 Fall)

Stress-testing CredX against the field — cluster by cluster, honestly. "They ship X" is a fair summary of each category; "Where CredX stands" maps the competitor claim to the **actual CredX contract/module** that covers it, or explicitly says CredX does not cover it. No category is awarded a match CredX doesn't own.

## The category CredX plays in

**Cross-chain credit infrastructure with an attestation-backed, contract-enforced policy layer.** Not a credit passport, not a score API, not a lending venue — the spine that lets any of those run on *verified cross-chain history* with the *decision enforced by contract*.

| Competitor cluster (examples) | They ship | Where CredX stands (module / contract) |
|---|---|---|
| **Credit passports / one-click prove** (It'sPleasure Xanpool-style attestation reports, EAS passports, Gitcoin Passport, Sismo, PrivadoID, Galxe ID) | Attestation records that something happened (an action, an era-end snapshots) — no engine, no lending | `CredXHub` + `OCCR` scoring engine turns raw attested events into a **300–850 credit score**; `CX-SBT` mints a non-transferable passport *with* a deterministically derived score commitment. The passports prove "a wallet visited X"; CredX passports prove "this wallet has CTS ≥ 780" — computed, not claimed. |
| **Credit scoring protocols** (Credora, Lumen, Scorechain/on-chain scoring APIs, Scroll marks, Cakral IT) | Score derived from on-chain activity of *one chain* (or off-chain underwriter data) | `OCCR` runs the academic 7-dimension scoring, but the input history is **verified across chains via Creditcoin's 0x0FD2 BlockProver precompile** (`BlockProverAttestationOracle`) — not scraped. CredX scores attestations; the field scores ledgers. |
| **Under-collateralized lending venues** (Credora Prime pools, Earnbit, Intersolv, private credit DAOs) | Lending at lower collateralization backed by off-chain KYC/underwriter trust | `CredXHub` lending pool unlocks **70% collateral Super-Prime lending** driven by the OCCR score; the collateral is native CTC, and a **cross-chain deadswitch** liquidates on verified withdrawal proofs from the source chain — the trust root is the precompile, not a credit committee. |
| **Verifiable-compute / GPU marketplaces** (Render, io.net, Akash, Pyth Network staking) | Compute marketplaces with off-chain reputation or TEE attestations | `AutonomousAIHub` + **VerifiedEscrow** (`contracts/core/VerifiedEscrow.sol`): GPU settlement happens in an escrow that releases **only on a receipt verified by the Attestcoin verifier** (optionally pinned to the exact event signature), is replay-guarded per receipt, and auto-refunds after deadline. No TEE-equipment trust required — release is a cryptographic condition, not a dashboard claim. |
| **Decentralized escrow services** (timestamped/multisig escrows, fiat escrow rails) | Funds held until *someone says so* — a timestamp, a signature, a multi-sig vote | CredX `VerifiedEscrow` holds cUSD until **an attested cross-chain event says so**; the "someone" is the 0x0FD2 precompile verdict. The condition, seller, order ref, amount and deadline are bound at creation and immutable. |
| **Metering / pay-as-you-go billing rails** (SaaS metering, DePIN network meters) | Centralized counters; trust the operator's database | `UsageMeteringRegistry` (prepaid v2): the meter advances only on a verified attested receipt or a registered KYC agent, caps **fail closed**, and v2 consumes **prepaid credit before debt** — overdraw reverts (`InsufficientPrepaid`) instead of silently drifting into arrears. The counter is a contract, and the top-up is a settlement-token (cUSD) transaction. |
| **Audit / evidence tooling** (block explorers, TheGraph subgraphs, frame-validators) | *Show* you what happened on-chain | CredX **Evidence Registry** (`EvidenceRegistryView.tsx`) recovers the *proof-gated* events — `ProofAnchored`, `EscrowReleased`, `UsageRecorded`, `PrepaidConsumed` — from the deployed contracts via `eth_getLogs`. It's the exact read surface a dispute auditor queries: what was proven, when, and by whom. |
| **Identity / KYC middlewares** (Fractal ID, Blockpass, World ID) | Prove *who you are*, not what you've done | Complementary — CredX's KYC-agent telemetry path plugs into registries like these; the credit core is about *behavioral history*, not identity. Honest gap: CredX ships no identity proof of its own. |
| **Creditcoin-native builders (same sponsor)** | One-feature credit/identity apps on Creditcoin | CredX is the **platform**: the 0x0FD2 oracle contract, scoring hub, and the 6-layer policy stack (RiskGuard gate, Covenant Ops liveness, purpose-bound funding, prepaid metering, verified escrow, evidence registry) are all deployed and test-covered. |
| **Bridges / interoperable lending aggregators** (bridge-based cross-chain lending) | Move assets or calldata across chains | CredX moves **only cryptographic proofs**, never assets, so it inherits none of the ~$2.8B lost to bridge hacks. Honest gap: no native bridging; source-chain collateral stays put. |

## Where CredX is (currently) alone

1. **Verify-then-execute that rejects valid-but-wrong proofs.** The RiskGuard gate and escrow release both pin the *event* a proof must resolve to; a valid Merkle proof of the *wrong thing* is refused on-chain.
2. **Replay-guarded proof-gated escrow.** One attested receipt pays once, permanently (`keccak(sourceChainId, txHash)` nullifier), and the escrow auto-refunds after its deadline so funds can never be locked forever.
3. **Prepaid-first, fail-closed usage metering.** A customer cannot silently overdraw: while prepaid exists, a debit beyond it reverts the transaction.
4. **A dispute-ready Evidence Registry.** Every proof-gated event is reconstructible from the chain with the same query surface an auditor uses — CredX doesn't ask you to trust its dashboard.

## What CredX is NOT (honest gaps)

- **Not a production lending venue.** Everything runs on Creditcoin **testnet** with demo wallets; real depositors/lenders do not exist yet.
- **Not verified GPU runtime.** Compute "completion" on testnet is proven via the deployed `MockAttestationOracle` harness designed to mirror the `0x0FD2` proof shape (`ATTESTCOIN_INTEGRATION.md` documents exactly which path is real vs harnessed); the **real** 0x0FD2-attested event flow is proven for the corporate/payment receipts in `npm run usc:verify`.
- **Not an identity provider** — it consumes, not produces, identity/telemetry.
- **No bridges, no asset mobility** — by design (zero bridge risk), but positions like "cross-chain lending of the asset itself" belong to other builders.
- **No TEE attestations / confidential computing** — workload *integrity* is out of scope; *proof-of-event* is in scope.

Every numbered claim is reproducible from `main`: `npx hardhat test` (126/126), `npm run usc:verify`, `npm run deploy:policy`, `npm run deploy:flagship`, and the live product at https://credx-protocol.vercel.app.