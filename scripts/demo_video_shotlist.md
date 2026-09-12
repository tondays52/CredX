# Demo Video Shot List — CredX Protocol (Creditcoin BUIDL 2026 Fall)

Two options:
1. **Auto-generated montage (pre-made)** — `npm run demo:video` drives the real running app in
   headless Edge, captures the LIVE 0x0FD2/0x0FD3 panel + Blockscout anchor tx + each track, and
   renders `CredX_Demo.mp4` (1920x1080, ~1:54, silent). Add a voiceover if you like, then upload.
2. **Manual screen capture** — record the live app yourself following the cuts below (best if you
   want to show the wallet-signing "Verify & Anchor on 0x0FD2" step, which needs MetaMask).

Target: 2–3 minutes. Record 1080p screen capture, upload to YouTube (unlisted or public),
then paste the URL into `DORAHACKS_SUBMISSION.md` (§ Demo Video) and the submission form.

## Suggested cuts

1. **Hook (0:00–0:15)** — Problem frame.
   - Overlay text: "To borrow $1,000, DeFi locks $1,500." Show a Lender UI with 150% collateral ratio vs CredX 70%.
2. **The live 0x0FD2 proof (0:15–1:00)** — SHOW, don't just say. This is the core scoring criterion.
   - Terminal → "Proofs & Attest" tab. Open the USC panel (live ChainInfo from 0x0FD3).
   - Click **Verify & Anchor on 0x0FD2** (wallet connected on Creditcoin testnet).
   - Narrate each in-browser step: attested-height → real Sepolia tx → Merkle+continuity proof → "0x0FD2 VERIFIED" → MetaMask signature → anchor tx on Blockscout (linked).
   - Optionally also mention: reproduce with `npm run usc:verify`.
3. **Scoring & passport (1:00–1:25)** — live reads.
   - Credit score dashboard (OCCR 300–850) + Soulbound CX-SBT (non-transferable).
4. **Track tour (1:25–2:15)** — quick pan through 5 tracks.
   - DeFi (flash loan), RWA (invoice financing), Gaming (lootboxes/scholarship),
     DePIN (virtual node + Chrome extension), AI (AgentFi hub + compute escrow), PredictBay Arena.
   - Show that simulated panels carry the amber **SIMULATED** badge (honesty).
5. **Proof of work (2:15–2:30)** — tests & deployments.
   - `npx hardhat test` → "113 passing".
   - Blockscout verify pages quickly (oracle + a couple of hubs).
6. **Outro (2:30–2:45)** — GitHub + MIT + thanks.

## Checklist before recording

- [ ] Wallet connected to Creditcoin testnet (chainId 102031) with test CTC.
- [ ] `npm run usc:verify` has been run at least once (oracle has ≥1 anchor; button shows green).
- [ ] Frontend running: `cd frontend && npm run dev`.
- [ ] No real secrets visible (never show .env / private keys / API keys).
- [ ] Google Maps panels: if no `VITE_GOOGLE_MAPS_API_KEY`, they show the honest OSM fallback note — fine to record.
- [ ] Paste final URL into `DORAHACKS_SUBMISSION.md` § Demo Video and the DoraHacks form.
