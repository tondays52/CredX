/**
 * scripts/create_deck_pdf.js
 * Generates a dark-theme slide deck (PDF) for the Creditcoin BUIDL 2026 Fall submission.
 * Usage: node scripts/create_deck_pdf.js   (writes CredX_BUIDL_Deck.pdf in repo root)
 *
 * Content is the corrected, submission-accurate summary (99/99 tests, LIVE 0x0FD2).
 */
const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");

const OUT = path.join(__dirname, "..", "CredX_BUIDL_Deck.pdf");

const BG = "#070b14";
const BG2 = "#0d1524";
const ACCENT = "#10b981"; // emerald
const ACCENT2 = "#22d3ee"; // cyan
const AMBER = "#f59e0b";
const TEXT = "#e2e8f0";
const MUTED = "#94a3b8";

function build() {
  const doc = new PDFDocument({ size: "A4", margin: 48, bufferPages: true, autoFirstPage: false });
  const stream = fs.createWriteStream(OUT);
  doc.pipe(stream);

  let page = 0;

  function newSlide() {
    page += 1;
    doc.addPage();
    // background
    doc.rect(0, 0, doc.page.width, doc.page.height).fill(BG);
    // top accent bar
    doc.rect(0, 0, doc.page.width, 5).fill(ACCENT);
    // footer
    doc
      .font("Helvetica", 7)
      .fillColor(MUTED)
      .text(`CredX Protocol  |  Creditcoin BUIDL 2026 Fall  |  ${page}`, 48, doc.page.height - 32, {
        width: doc.page.width - 96,
        align: "center",
      });
  }

  function title(text, sub) {
    doc
      .font("Helvetica-Bold", 24)
      .fillColor("#ffffff")
      .text(text, 48, 58, { width: doc.page.width - 96 });
    if (sub) {
      doc.moveDown(0.4);
      doc.font("Helvetica", 11.5).fillColor(ACCENT2).text(sub, { width: doc.page.width - 96 });
    }
    doc.moveDown(0.9);
  }

  function sectionHead(text) {
    doc.moveDown(0.35);
    doc.font("Helvetica-Bold", 13).fillColor(ACCENT).text(text, { width: doc.page.width - 96 });
    doc.moveDown(0.25);
  }

  function bullets(items) {
    doc.font("Helvetica", 9.5).fillColor(TEXT);
    for (const it of items) {
      doc.text("•  " + it, { width: doc.page.width - 96, lineGap: 3 });
      doc.moveDown(0.18);
    }
  }

  function paired(label, value, isHead) {
    doc.font("Helvetica-Bold", (isHead ? 11 : 9.5)).fillColor(ACCENT2).text(label, { continued: false });
    doc.font(isHead ? "Helvetica-Bold" : "Helvetica", isHead ? 11 : 9.5)
      .fillColor(TEXT)
      .text("    " + value, { lineGap: 2 });
    doc.moveDown(0.14);
  }

  function mono(str, color) {
    doc.font("Courier-Bold", 7.5).fillColor(color || ACCENT2).text(str, { width: doc.page.width - 96, lineGap: 2 });
    doc.moveDown(0.1);
  }

  /* ── Slide 1: Title ─────────────────────────────────────────────── */
  newSlide();
  doc.rect(0, doc.page.height / 2 - 160, doc.page.width, 5).fill(ACCENT);
  doc
    .font("Helvetica-Bold", 34)
    .fillColor("#ffffff")
    .text("CredX Protocol", 48, doc.page.height / 2 - 130, { width: doc.page.width - 96, align: "center" });
  doc.moveDown(0.5);
  doc
    .font("Helvetica", 13)
    .fillColor(ACCENT2)
    .text("Cross-Chain Trustless Credit Bureau & 5-Track Attestcoin Engine", 48, doc.y, {
      width: doc.page.width - 96,
      align: "center",
    });
  doc.moveDown(1.2);
  doc
    .font("Helvetica", 10)
    .fillColor(MUTED)
    .text(
      "Built natively for the Creditcoin BUIDL Hackathon 2026 Fall (DoraHacks)\n" +
        "Deeply integrated with Creditcoin's Attestcoin Protocol (precompile 0x0FD2) / USC",
      { width: doc.page.width - 96, align: "center", lineGap: 3 }
    );
  doc.moveDown(1.4);
  mono("LIVE 0x0FD2 integration  |  Run live: credx-protocol.vercel.app  |  99/99 tests  |  16 contracts on testnet", AMBER);

  /* ── Slide 2: Problem ───────────────────────────────────────────── */
  newSlide();
  title("The Capital Inefficiency Trap", "Why DeFi treats proven borrowers as strangers");
  sectionHead("The bottleneck");
  bullets([
    "DeFi lending demands 150%+ over-collateralization - to borrow $1,000 you must lock up $1,500.",
    "Borrowers who repaid hundreds of thousands on Ethereum (Aave, Compound, Uniswap LP) or settled",
    "trade invoices start from zero on every new chain.",
    "Multi-sig bridge relayers have suffered over $2.8B in exploits across Web3.",
  ]);
  sectionHead("CredX answers");
  bullets([
    "Creditcoin becomes the global trustless credit bureau - reusing verified cross-chain history.",
    "Lend down to 70% collateral ratio (53.3% less capital locked).",
    "Dynamic FICO-style APRs from 2.5% to 12% based on real on-chain reputation.",
  ]);

  /* ── Slide 3: Solution / Attestcoin ─────────────────────────────── */
  newSlide();
  title("Solution: Native Attestcoin (USC, 0x0FD2)", "Zero bridges, zero custodial relayers, zero centralized oracles");
  sectionHead("Direct precompile verification");
  bullets([
    "BlockProverAttestationOracle wraps Creditcoin's BlockProver 0x0FD2 + ChainInfo 0x0FD3 precompiles",
    "using the exact @gluwa/usc-sdk ABI (MerkleProof + ContinuityProof structs).",
    "Verifies real Merkle Patricia Trie inclusion proofs from Ethereum Mainnet and Sepolia.",
    "verifySourceTransaction (view, static) and anchorVerifiedTransaction (verifyAndEmit + anchor).",
  ]);
  sectionHead("LIVE proof transcript (Creditcoin testnet)");
  mono("Verified SUCCESS on 0x0FD2  -  real Sepolia tx 0x1eb62c...72d7af", ACCENT);
  mono("verifyAndEmit (TransactionVerified)  0x7dff1e...b0dd29", ACCENT2);
  mono("Oracle anchor (anchoredCount=1)       0xd0b88f...befd69", ACCENT2);
  doc.moveDown(0.3);
  doc.font("Helvetica", 8.5).fillColor(MUTED).text("Reproduce any time:  npm run usc:verify", { width: doc.page.width - 96 });

  /* ── Slide 4: RiskGuard policy gate ─────────────────────────────── */
  newSlide();
  title("RiskGuard - Verify-Then-Execute Policy Gate", "Proposals proposed; the deterministic policy decides");
  bullets([
    "Four-gate trace before anything executes: (r1) collateral liveness, (r2) covenant boundary,",
    "(r3) policy action allowlist (fail closed), (r4) 0x0FD2 oracle-bound cryptographic verification.",
    "Failing gate => explicit REFUSED with the violated rule cited; no silent partial execution.",
    "Live in-browser 0x0FD2 button verifies the latest attested Sepolia receipt against the",
    "deployed precompile - Merkle + continuity proof, no wallet, no signer, no gas.",
  ]);

  /* ── Slide 5: Covenant Ops feed ─────────────────────────────────── */
  newSlide();
  title("Covenant Ops - Live Liveness & Covenant Feed", "Every verified spine fact in one pane of glass");
  bullets([
    "Attestation heights, anchored proof count and source chains read live from the deployed oracle",
    "(0x0FD2 + 0x0FD3 ChainInfo) - no operator, no bridge, no oracle.",
    "Collateral liveness rules decide whether new credit stays open per position.",
    "On attested collateral departure: new credit is blocked; repay/withdraw stay open;",
    "a fresh receipt proving restoration re-opens credit automatically.",
  ]);

  /* ── Slide 6: Scoring & Soulbound ───────────────────────────────── */
  newSlide();
  title("OCCR Scoring & Soulbound Credit Passport", "Academic On-Chain Credit Risk framework");
  bullets([
    "7-dimension model: volume, frequency, recency, chain diversity, protocol diversity, action weights.",
    "Composite Credit Trust Score (CTS) from 300 to 850 per wallet.",
    "Deterministic keccak256(chainKey|height|encodedTx) replay protection - no double credit ever.",
    "CX-SBT (ERC-721 soulbound): non-transferable tier passport with ZK-commitment privacy.",
  ]);

  /* ── Slides 5-9: Tracks ─────────────────────────────────────────── */
  const tracks = [
    {
      n: "Track 1",
      t: "Advanced DeFi",
      items: [
        "Under-Collateralized Lending Pool: Super-Prime (CTS 780+) borrow cUSD against CTC at 70% collateral (vs 150%).",
        "Reputation Flash Loans (ReputationFlashLoan): uncollateralized loans, Super-Prime fee 0.01% (vs 0.09%).",
        "Reputation AMM fee tiers down to 0.05% (from 0.30%); Yield Vault up to 2x reward multiplier.",
      ],
    },
    {
      n: "Track 2",
      t: "Real-World Assets (RWA)",
      items: [
        "RWA Invoice Financing (RWAInvoiceFinancing): tokenize trade invoices; prime investors fund at preferred rates.",
        "Treasury Yield Fund: permissioned tbUSD vault with +2% APY bonus for prime depositors.",
      ],
    },
    {
      n: "Track 3",
      t: "Fair Gaming Ecosystem",
      items: [
        "Anti-Sybil Proof-of-Humanity: up to 3x daily gathers tied to verified cross-chain credit.",
        "Sybil-proof lootboxes: high-tier opens require CTS >= 500.",
        "Zero-collateral NFT guild scholarships (0% upfront) + zero-fee marketplace for Super-Prime.",
      ],
    },
    {
      n: "Track 4",
      t: "DePIN & Edge Virtual Node",
      items: [
        "Automated staking delegation only to operators with CTS >= 700 (slashing protection).",
        "Under-collateralized hardware financing for verified operators.",
        "Chrome Extension Virtual Node (Manifest V3): local telemetry + MetaMask relay for real proof anchors - never stores keys.",
      ],
    },
    {
      n: "Track 5",
      t: "Autonomous AI & AgentFi",
      items: [
        "Oracle-less risk ingestion: AI models read multi-chain proofs to tune protocol parameters.",
        "AgentFi credit lines for registered on-chain AI agents with verified execution records.",
        "Verifiable Proof-of-Compute escrow: GPU leases settle on cryptographic proof verification.",
      ],
    },
  ];
  for (const tr of tracks) {
    newSlide();
    title(tr.n + " - " + tr.t, "CredX 5-Track Attestcoin Super-Ecosystem");
    bullets(tr.items);
  }

  /* ── Slide 10: Bonus arena ──────────────────────────────────────── */
  newSlide();
  title("Bonus Module: Prediction-Style Reputation Arena", "ReputationArena - binary paper trading terminal");
  bullets([
    "$10,000 paper trading points, 60-second round intervals, on-chain settlement.",
    "Achieve a 3+ win streak and sync it to Creditcoin L1 for a permanent on-chain credit boost.",
  ]);

  /* ── Slide 11: Testing & honesty ────────────────────────────────── */
  newSlide();
  title("Engineering, Testing & Honesty", "99/99 automated tests");
  bullets([
    "npx hardhat test -> 99 passing (BlockProver oracle 9 tests, hub/engine 26, security 19, tracks 45).",
    "OCCR math, dynamic APRs, CX-SBT soulbound invariants, replay defense: all covered.",
  ]);
  sectionHead("Clear labeling of simulations");
  bullets([
    "Panels that are locally simulated (perps, flash-loan UI, liquid staking, TAO/GeoOrbit telemetry,",
    "liquidation radar, DePIN telemetry, attestation pipelines) carry explicit SIMULATED badges.",
    "The real 0x0FD2 verification path is live in the 'Proofs & Attest' tab; the Mock harness is",
    "a clearly labeled gasless fallback for score boosts only.",
  ]);

  /* ── Slide 12: Deployments ──────────────────────────────────────── */
  newSlide();
  title("Live on Creditcoin Testnet (chainId 102031)", "16 deployed & verified contracts");
  const deploys = [
    ["BlockProverAttestationOracle (real 0x0FD2/0x0FD3)", "0x4d11b60809724b0B67B28DA2f38438aE97f1C671"],
    ["AttestationVerifier (labeled testnet harness)", "0x34aA30efE2226ffC2E55607017FbA2F07e62b279"],
    ["CreditScoreEngine (OCCR 7-Dimension)", "0xA31697bBd4900f8FA62015A51dA3c58972E96BB6"],
    ["CredXHub (Core Registry & Batch Importer)", "0x729b2D8B630c4241d051c92D4FeB31412846eE18"],
    ["cUSD (Liquidity Stablecoin)", "0xdec5170C46DC63D812c699E9dFE6561FFd1BF298"],
    ["UndercollateralizedLendingPool", "0x84234C1403768D9A509c1241e5F39f81246880d2"],
    ["CreditAttestationSBT (CX-SBT)", "0xb22baF385067aF8d66823282bb4F2e3EECB60831"],
    ["ReputationAMM / FlashLoan / YieldVault", "0x8146...32c / 0x4962...637 / 0x6309...bc1"],
    ["RWATreasuryYieldFund / RWAInvoiceFinancing", "0x2be1...80A / 0x05D4...1aA"],
    ["GamingEcosystemHub / DePINInfrastructureHub", "0x8008...4D75 / 0x99b4...B9Bc"],
    ["AutonomousAIHub / ReputationArena", "0xEc14...a5D / 0x42ff...c9F5"],
  ];
  for (const [label, addr] of deploys) {
    doc.moveDown(0.12);
    doc.font("Helvetica-Bold", 8.5).fillColor(ACCENT2).text(label);
    mono(addr, TEXT);
  }

  /* ── Slide 13: Frontend & extension ─────────────────────────────── */
  newSlide();
  title("Frontend DApp & Virtual Node Extension", "React 18 + TypeScript + Vite + Three.js");
  bullets([
    "Web3 Terminal: RWA invoices, DePIN telemetry, flash loans, liquidity depth, reputation arena.",
    "Proofs & Attest tab: live 0x0FD3 chain reads + connected-wallet 'Verify & Anchor on 0x0FD2' button",
    "that verifies a fresh Sepolia proof in-browser (official proof-builder API + ethers, no SDK bundle).",
    "Chrome Extension Virtual Node: load unpacked from chrome://extensions.",
  ]);

  /* ── Slide 14: Reproduce + links ────────────────────────────────── */
  newSlide();
  title("Reproduce, Team & Open Source", "Everything you need to verify");
  sectionHead("Commands");
  mono("npm install && npx hardhat test              # 99/99 tests", ACCENT);
  mono("npm run usc:verify                            # live 0x0FD2 Sepolia proof + anchor", ACCENT);
  mono("npm run usc:deploy                            # deploy BlockProverAttestationOracle", ACCENT2);
  mono("cd frontend && npm install && npm run dev     # Web3 Terminal (localhost:5173)", ACCENT2);
  sectionHead("Links & license");
  bullets([
    "GitHub: https://github.com/tondays52/CredX",
    "Live app: https://credx-protocol.vercel.app (RiskGuard + Covenant Ops panes live against the oracle)",
    "License: MIT (open source for the Creditcoin L1 ecosystem).",
  ]);

  doc.end();
  stream.on("finish", () => {
    console.log("Wrote " + OUT + " (" + page + " slides)");
  });
}

build();