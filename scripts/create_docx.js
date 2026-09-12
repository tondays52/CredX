const fs = require("fs");
const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  BorderStyle,
  WidthType,
  AlignmentType,
  ShadingType,
} = require("docx");

function createHeader(text, level = HeadingLevel.HEADING_1) {
  return new Paragraph({
    text: text,
    heading: level,
    spacing: { before: 300, after: 120 },
  });
}

function createParagraph(text, isBold = false) {
  return new Paragraph({
    children: [
      new TextRun({
        text: text,
        font: "Calibri",
        size: 22, // 11pt
        bold: isBold,
        color: "1E293B",
      }),
    ],
    spacing: { before: 80, after: 80, line: 276 },
  });
}

function createBullet(title, desc) {
  return new Paragraph({
    children: [
      new TextRun({
        text: title + ": ",
        font: "Calibri",
        size: 22,
        bold: true,
        color: "0F172A",
      }),
      new TextRun({
        text: desc,
        font: "Calibri",
        size: 22,
        color: "334155",
      }),
    ],
    bullet: { level: 0 },
    spacing: { before: 60, after: 60, line: 260 },
  });
}

function createCallout(title, body) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 100, type: WidthType.PERCENTAGE },
            shading: { fill: "F0F9FF", type: ShadingType.CLEAR },
            margins: { top: 140, bottom: 140, left: 200, right: 200 },
            borders: {
              top: { style: BorderStyle.NONE },
              right: { style: BorderStyle.NONE },
              bottom: { style: BorderStyle.NONE },
              left: { style: BorderStyle.SINGLE, size: 24, color: "0284C7" },
            },
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: title,
                    font: "Calibri",
                    size: 24,
                    bold: true,
                    color: "0369A1",
                  }),
                ],
                spacing: { after: 60 },
              }),
              new Paragraph({
                children: [
                  new TextRun({
                    text: body,
                    font: "Calibri",
                    size: 22,
                    color: "0C4A6E",
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

function createDoc() {
  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: "Calibri", size: 22, color: "1E293B" },
        },
      },
      heading1: {
        run: { font: "Calibri", size: 36, bold: true, color: "1E3A8A" },
      },
      heading2: {
        run: { font: "Calibri", size: 28, bold: true, color: "0284C7" },
      },
      heading3: {
        run: { font: "Calibri", size: 24, bold: true, color: "0F172A" },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
          },
        },
        children: [
          // Title
          new Paragraph({
            children: [
              new TextRun({
                text: "CredX Protocol",
                font: "Calibri",
                size: 52,
                bold: true,
                color: "1E3A8A",
              }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { before: 200, after: 100 },
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: "Cross-Chain Trustless Credit Bureau & Under-Collateralized Lending",
                font: "Calibri",
                size: 26,
                bold: true,
                color: "0284C7",
              }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { after: 300 },
          }),

          createCallout(
            "🌟 BUIDL Executive Vision",
            "Decentralizing credit and unlocking capital efficiency across Web3 by leveraging Creditcoin's Attestcoin Protocol & Universal Smart Contracts (USC) to power undercollateralized lending, reputation-weighted DeFi, RWA financing, DePIN delegation, Gaming micro-rewards, and autonomous AgentFi."
          ),

          new Paragraph({ spacing: { before: 200 } }),

          // 1. Overview & Problem
          createHeader("1. The Problem: Capital Inefficiency in Overcollateralized DeFi", HeadingLevel.HEADING_2),
          createParagraph(
            "In DeFi today, capital efficiency is severely throttled by mandatory 150%+ overcollateralization. If a user wants to borrow $1,000, they must lock up $1,500 in crypto. Simultaneously, billions of dollars of positive financial history—regular loan repayments on Aave, continuous DEX liquidity provision on Uniswap, timely NFT debt settlements, and staking commitments—remain locked in isolated blockchain silos on Ethereum, Arbitrum, Base, and Solana."
          ),
          createParagraph(
            "Borrowers have no portable financial reputation, and protocols have no trustless mechanism to differentiate a trusted 5-year crypto native from a brand-new Sybil bot."
          ),

          // 2. The Solution
          createHeader("2. The CredX Solution: Trustless Cross-Chain Credit Bureau", HeadingLevel.HEADING_2),
          createParagraph(
            "CredX is built natively on Creditcoin to serve as the global trust and credit settlement layer for Web3. It ingests cryptographically proven transaction receipts from external chains and aggregates them into an On-Chain Credit Rating (OCCR) ranging from 300 to 850."
          ),
          createParagraph(
            "High-scoring borrowers receive under-collateralized loans, reduced interest rates, lower DEX trading fees, and elevated ecosystem access without giving up self-custody or revealing private identity data."
          ),

          // 3. Technical Core
          createHeader("3. Core Technical Architecture & Attestcoin Integration", HeadingLevel.HEADING_2),
          createBullet(
            "Native Attestcoin Precompile Integration",
            "CredX verifies cross-chain transaction inclusion receipts against Creditcoin's Attestcoin / USC protocol. 0x0FD2 on Creditcoin is the BlockProver precompile (continuity & Merkle proof verification, with a companion 0x0fd3 ChainInfo precompile). The current testnet deployment uses an always-pass MockAttestationOracle harness standing in for the precompile so the full stack can be exercised end-to-end; activating the true 0x0FD2 path requires adopting the BlockProver proof interface (USC SDK) rather than this project's EventProof ABI, documented in ATTESTCOIN_INTEGRATION.md."
          ),
          createBullet(
            "Deployment Hygiene & Verification",
            "Every deployed contract address ships in deployments.json / frontend/contracts.json; fresh contracts are source-verified on Blockscout (creditcoin-testnet.blockscout.com). A GitHub Actions CI pipeline runs hardhat tests, TypeScript checks and the Vite build on every push."
          ),
          createBullet(
            "OCCR Multi-Factor Credit Scoring Engine (CreditScoreEngine.sol)",
            "Evaluates 8 distinct on-chain financial behaviors (DeFi loan repayments, DEX trading volume, protocol diversity, staking longevity, social credit delegation, and account age) to compute dynamic FICO-style credit scores."
          ),
          createBullet(
            "Soulbound Credit Credentials (CreditAttestationSBT.sol)",
            "Issues non-transferable ERC-5192 / ERC-721 Soulbound Tokens (SBTs) representing credit tiers (Subprime, Near-Prime, Prime, Super-Prime) with built-in zero-knowledge privacy commitment hashes."
          ),
          createBullet(
            "Undercollateralized Lending Pool (UndercollateralizedLendingPool.sol)",
            "Provides tiered borrowing limits and dynamic APRs (from 4% for Super-Prime down from standard 15%), with collateral requirements dropping to partial or zero for top-tier borrowers."
          ),

          // 4. Multi-Track Ecosystem
          createHeader("4. Multi-Track Ecosystem Applications", HeadingLevel.HEADING_2),
          createParagraph(
            "CredX provides deep, practical utility across five major Web3 verticals:"
          ),
          createBullet(
            "🏦 DeFi Track",
            "ReputationAMM (fee discounts down to 0.05%), ReputationFlashLoan (0.01% fee for Super-Prime), and ReputationYieldVault (up to 2x yield boost for top credit ratings)."
          ),
          createBullet(
            "🏢 RWA Track",
            "RWATreasuryYieldFund (tokenized US Treasury yield fund 'tbUSD' with bonus yields) and RWAInvoiceFinancing (corporate invoice factoring with reputation discounts — businesses tokenize accounts receivable, funders earn the discount, repay and overdue-reclaim are handled on-chain) are both live on testnet."
          ),
          createBullet(
            "🎮 Gaming Track",
            "Daily Gathering with 3x multipliers for OG players, Anti-Sybil Fair Lootboxes with boosted drop rates, and Zero-Fee NFT Marketplace (0% fee for high reputation)."
          ),
          createBullet(
            "📡 DePIN Track + Live Chrome Extension",
            "Automated Staking Delegation based on node uptime proofs, Hardware Financing for infrastructure expansion, and a live CredX DePIN Chrome Extension for bandwidth staking and node monitoring. The extension reads the real on-chain credit score, and can sign proof anchors via a MetaMask message relay (it never stores a private key)."
          ),
          createBullet(
            "🤖 AI & AgentFi Track (AutonomousAIHub.sol)",
            "Oracle-less cross-chain market volatility ingestion, autonomous micro-loans for profitable AI trading agents (AgentFi), and verifiable Proof-of-Compute escrow settlements for GPU leasing."
          ),

          // 5. PredictBay Arena
          createHeader("5. PredictBay-Style Gamified Paper Trading Arena", HeadingLevel.HEADING_2),
          createParagraph(
            "To onboard mainstream users and drive viral pre-launch adoption, CredX features a high-engagement gamified paper trading arena (frontend/arena.html):"
          ),
          createBullet(
            "Real-Time Trajectory Chart",
            "Live dynamic canvas graph displaying BTC/USD price movement against dashed strike lines with 1-minute and 3-minute round countdown clocks."
          ),
          createBullet(
            "Interactive Order Ticket",
            "ABOVE / BELOW prediction buttons with quick stake selectors ($10 to $500) and keyboard hotkeys (A / B)."
          ),
          createBullet(
            "Streak-to-Reputation Bridge",
            "Traders who achieve a 3-win streak can sync their streak on-chain to the arena contract, recording a verifiable reputation-streak claim event (staking the streak into their on-chain reputation history)."
          ),

          // 6. Test Metrics
          createHeader("6. Protocol Quality & Verification Metrics", HeadingLevel.HEADING_2),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    shading: { fill: "1E3A8A", type: ShadingType.CLEAR },
                    children: [
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: "Component / Module",
                            bold: true,
                            color: "FFFFFF",
                          }),
                        ],
                      }),
                    ],
                  }),
                  new TableCell({
                    shading: { fill: "1E3A8A", type: ShadingType.CLEAR },
                    children: [
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: "Verification & Test Status",
                            bold: true,
                            color: "FFFFFF",
                          }),
                        ],
                      }),
                    ],
                  }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({
                    children: [
                      createParagraph("Core Protocol & OCCR Scoring Engine (test/CredX.test.js)"),
                    ],
                  }),
                  new TableCell({
                    children: [createParagraph("✅ Passing (26/26 tests)")],
                  }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({
                    children: [createParagraph("Security Hardening (test/Security.test.js)")],
                  }),
                  new TableCell({
                    children: [createParagraph("✅ Passing (18/18 tests)")],
                  }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({
                    children: [createParagraph("Advanced DeFi Hubs — AMM, FlashLoan, Vault (test/DeFi.test.js)")],
                  }),
                  new TableCell({
                    children: [createParagraph("✅ Passing (5/5 tests)")],
                  }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({
                    children: [createParagraph("DePIN Infrastructure (test/DePIN.test.js)")],
                  }),
                  new TableCell({
                    children: [createParagraph("✅ Passing (4/4 tests)")],
                  }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({
                    children: [createParagraph("Gaming Ecosystem (test/Gaming.test.js)")],
                  }),
                  new TableCell({
                    children: [createParagraph("✅ Passing (8/8 tests)")],
                  }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({
                    children: [createParagraph("RWA Treasury Yield Fund (test/RWA.test.js)")],
                  }),
                  new TableCell({
                    children: [createParagraph("✅ Passing (4/4 tests)")],
                  }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({
                    children: [createParagraph("Autonomous AI Hub (test/AI.test.js)")],
                  }),
                  new TableCell({
                    children: [createParagraph("✅ Passing (8/8 tests)")],
                  }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({
                    children: [createParagraph("PredictBay Paper-Trading Arena (test/Arena.test.js)")],
                  }),
                  new TableCell({
                    children: [createParagraph("✅ Passing (6/6 tests)")],
                  }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({
                    children: [createParagraph("Multi-Track Extension (test/Tracks.test.js)")],
                  }),
                  new TableCell({
                    children: [createParagraph("✅ Passing (9/9 tests)")],
                  }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({
                    shading: { fill: "F1F5F9", type: ShadingType.CLEAR },
                    children: [
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: "Total Test Suite",
                            bold: true,
                          }),
                        ],
                      }),
                    ],
                  }),
                  new TableCell({
                    shading: { fill: "F1F5F9", type: ShadingType.CLEAR },
                    children: [
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: "🎉 88 / 88 Tests Passing (100%)",
                            bold: true,
                            color: "059669",
                          }),
                        ],
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),

          new Paragraph({ spacing: { before: 200 } }),

          // 7. Key Links
          createHeader("7. Submission Links & Resources", HeadingLevel.HEADING_2),
          createBullet("GitHub Repository", "https://github.com/tondays52/CredX"),
          createBullet(
            "Smart Contracts Folder",
            "https://github.com/tondays52/CredX/tree/main/contracts"
          ),
          createBullet(
            "Attestcoin Integration Guide",
            "https://github.com/tondays52/CredX/blob/main/ATTESTCOIN_INTEGRATION.md"
          ),
          createBullet(
            "Live PredictBay Arena UI",
            "https://github.com/tondays52/CredX/blob/main/frontend/arena.html"
          ),
          createBullet(
            "DePIN Chrome Extension",
            "https://github.com/tondays52/CredX/tree/main/extension"
          ),
        ],
      },
    ],
  });

  return doc;
}

async function main() {
  const doc = createDoc();
  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync("d:\\money\\CredX_BUIDL_Submission.docx", buffer);
  console.log("✅ Successfully created: d:\\money\\CredX_BUIDL_Submission.docx");
}

main().catch(console.error);
