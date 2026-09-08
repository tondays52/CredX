// CredX Protocol — Frontend Client Logic & Interactive Multi-Track Simulation (v2)
document.addEventListener("DOMContentLoaded", async () => {
  if (window.lucide) lucide.createIcons();
  initChart();
  updateScoreGauge(794);
  updateCollateralCalc();
  await loadContractsConfig();
});

// App State
let state = {
  isConnected: false,
  walletAddress: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
  creditScore: 794,
  tier: "Super-Prime",
  totalVerifiedUSD: 150000,
  attestationsCount: 12,
  protocolDiversity: 3,
  chainDiversity: 2,
  requiredCollateralRatioBps: 7000, // 70.0%
  apr: "2.50%",
  sbtTokenId: 1,
  sbtCommitment: "0x73549c1d64f55b95a821e289bf4490c8e109d73b22419ef8971a62948c12a84f",
  activeLoans: [
    {
      id: 1,
      principalUSD: 10000,
      collateralCTC: 3500,
      collateralRatio: "70.0%",
      apr: "2.50%",
      dueDays: 29
    }
  ],
  nodeRunning: false,
  nodePoints: 0,
  nodeUptimeSeconds: 0,
  nodeBandwidthMB: 0,
  nodeTimer: null
};

// Tab Switching
function switchTab(tabId) {
  document.querySelectorAll(".tab-content").forEach(el => el.classList.add("hidden"));
  document.querySelectorAll(".tab-btn").forEach(el => {
    el.classList.remove("active");
    el.classList.add("text-slate-400");
  });

  const selectedContent = document.getElementById(`tab-${tabId}`);
  const selectedNav = document.getElementById(`nav-${tabId}`);
  if (selectedContent) selectedContent.classList.remove("hidden");
  if (selectedNav) {
    selectedNav.classList.add("active");
    selectedNav.classList.remove("text-slate-400");
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
  if (window.lucide) lucide.createIcons();
}

// Wallet Connection
function toggleWalletConnect() {
  state.isConnected = !state.isConnected;
  const btn = document.getElementById("connect-wallet-btn");
  const text = document.getElementById("wallet-address-text");
  const holderAddrEl = document.getElementById("sbt-holder-addr");

  if (state.isConnected) {
    text.innerText = "0x742d...f44e (CTC: 14,250)";
    if (holderAddrEl) holderAddrEl.innerText = "0x742d35Cc6634C0532925a3b844Bc454e4438f44e";
    btn.classList.remove("from-cyan-500", "to-indigo-600");
    btn.classList.add("from-emerald-500", "to-teal-600");
  } else {
    text.innerText = "Connect Wallet";
    btn.classList.add("from-cyan-500", "to-indigo-600");
    btn.classList.remove("from-emerald-500", "to-teal-600");
  }
}

// Update Score SVG Gauge & Tier
function updateScoreGauge(score) {
  const scoreEl = document.getElementById("score-display-num");
  const circle = document.getElementById("score-progress-circle");
  const tierBadge = document.getElementById("score-tier-badge");

  if (scoreEl) scoreEl.innerText = score;

  const normalized = Math.min(Math.max((score - 300) / 550, 0), 1);
  const offset = 264 - (normalized * 264);
  if (circle) circle.style.strokeDashoffset = offset;

  if (tierBadge) {
    if (score >= 780) {
      tierBadge.className = "px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30";
      tierBadge.innerText = "Tier: Super-Prime (780+)";
    } else if (score >= 700) {
      tierBadge.className = "px-3 py-1 rounded-full text-xs font-bold bg-purple-500/20 text-purple-400 border border-purple-500/30";
      tierBadge.innerText = "Tier: Prime (700+)";
    } else if (score >= 650) {
      tierBadge.className = "px-3 py-1 rounded-full text-xs font-bold bg-cyan-500/20 text-cyan-400 border border-cyan-500/30";
      tierBadge.innerText = "Tier: Near-Prime (650+)";
    } else {
      tierBadge.className = "px-3 py-1 rounded-full text-xs font-bold bg-slate-500/20 text-slate-400 border border-slate-500/30";
      tierBadge.innerText = "Tier: Subprime";
    }
  }
}

// Chart.js Score Trajectory
function initChart() {
  const ctx = document.getElementById('creditScoreChart');
  if (!ctx) return;

  new Chart(ctx, {
    type: 'line',
    data: {
      labels: ['Month -4', 'Month -3', 'Month -2', 'Month -1', 'Current (v2 OCCR)'],
      datasets: [{
        label: 'Creditcoin Trust Score (CTS)',
        data: [420, 510, 640, 761, 794],
        borderColor: '#06b6d4',
        backgroundColor: 'rgba(6, 182, 212, 0.1)',
        borderWidth: 3,
        fill: true,
        tension: 0.4,
        pointBackgroundColor: '#22d3ee',
        pointRadius: 5,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: {
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { color: '#64748b', font: { family: 'JetBrains Mono', size: 10 } }
        },
        y: {
          min: 300,
          max: 850,
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { color: '#64748b', font: { family: 'JetBrains Mono', size: 10 } }
        }
      }
    }
  });
}

// Presets for Proof Verifier
function loadPreset(type) {
  const chainSelect = document.getElementById("proof-source-chain");
  const actionSelect = document.getElementById("proof-action-type");
  const txHashInput = document.getElementById("proof-tx-hash");
  const valueInput = document.getElementById("proof-value-usd");
  const blockInput = document.getElementById("proof-block-num");

  if (type === 'aave') {
    chainSelect.value = "11155111";
    actionSelect.value = "0";
    txHashInput.value = "0xa515e6844f02f0fb90114b7cc1abb0a39b4bed6be8acf114674be8ac19cd6200";
    valueInput.value = "50000";
    blockInput.value = "5928192";
  } else if (type === 'compound') {
    chainSelect.value = "1";
    actionSelect.value = "1";
    txHashInput.value = "0x19283746bc881234567890123456789012345678901234567890abcdef123456";
    valueInput.value = "75000";
    blockInput.value = "19283746";
  } else if (type === 'uniswap') {
    chainSelect.value = "1";
    actionSelect.value = "2";
    txHashInput.value = "0xfa297710bc881234567890123456789012345678901234567890abcdef7710";
    valueInput.value = "25000";
    blockInput.value = "19283800";
  } else if (type === 'invoice') {
    chainSelect.value = "1";
    actionSelect.value = "5";
    txHashInput.value = "0x3d7a89bc4412ef891234567890123456789012345678901234567890abcdef91";
    valueInput.value = "35000";
    blockInput.value = "19283920";
  }
}

// Proof Simulation Execution
function executeProofSubmission() {
  const pipeline = document.getElementById("verification-pipeline");
  const btn = document.getElementById("submit-proof-btn");
  const step1 = document.getElementById("step-1");
  const step2 = document.getElementById("step-2");
  const step3 = document.getElementById("step-3");
  const valueUSD = parseFloat(document.getElementById("proof-value-usd").value) || 25000;

  pipeline.classList.remove("hidden");
  btn.disabled = true;
  btn.innerHTML = `<i data-lucide="loader-2" class="w-5 h-5 animate-spin"></i><span>Calling Creditcoin Precompile 0x0FD2...</span>`;
  if (window.lucide) lucide.createIcons();

  setTimeout(() => {
    step1.innerHTML = `<i data-lucide="check" class="w-3.5 h-3.5 text-emerald-400"></i><span class="text-emerald-300">RLP Receipt & Merkle Proof Extracted</span>`;
    step2.className = "flex items-center space-x-2 text-cyan-400";
    step2.innerHTML = `<i data-lucide="loader-2" class="w-3.5 h-3.5 animate-spin text-cyan-400"></i><span>Precompile 0x0FD2 verifying root against L1 headers...</span>`;
    if (window.lucide) lucide.createIcons();
  }, 1000);

  setTimeout(() => {
    step2.innerHTML = `<i data-lucide="check" class="w-3.5 h-3.5 text-emerald-400"></i><span class="text-emerald-300">Precompile 0x0FD2 Succeeded: Proof Verified!</span>`;
    step3.className = "flex items-center space-x-2 text-cyan-400";
    step3.innerHTML = `<i data-lucide="loader-2" class="w-3.5 h-3.5 animate-spin text-cyan-400"></i><span>Executing OCCR Algorithm & Privacy Commitment...</span>`;
    if (window.lucide) lucide.createIcons();
  }, 2000);

  setTimeout(() => {
    const newScore = Math.min(state.creditScore + 16, 850);
    step3.innerHTML = `<i data-lucide="check" class="w-3.5 h-3.5 text-emerald-400"></i><span class="text-emerald-300">CredXHub Updated: CTS Upgraded to ${newScore}!</span>`;
    btn.disabled = false;
    btn.className = "w-full py-4 rounded-2xl bg-emerald-500 text-slate-950 font-bold text-base shadow-xl transition-all flex items-center justify-center space-x-2";
    btn.innerHTML = `<i data-lucide="check-circle" class="w-5 h-5"></i><span>Proof Attested by Creditcoin Consensus!</span>`;
    if (window.lucide) lucide.createIcons();

    state.creditScore = newScore;
    state.totalVerifiedUSD += valueUSD;
    updateScoreGauge(newScore);
  }, 3000);
}

// Collateral Calculation
function updateCollateralCalc() {
  const borrowInput = document.getElementById("borrow-amount-input");
  const ctcReqEl = document.getElementById("calc-ctc-required");
  const usdReqEl = document.getElementById("calc-usd-required");
  const defiStdEl = document.getElementById("calc-defi-standard");
  const capSavedEl = document.getElementById("calc-capital-saved");
  const borrowBtnLabel = document.getElementById("borrow-btn-label");

  if (!borrowInput || !ctcReqEl) return;

  const borrowUSD = parseFloat(borrowInput.value) || 0;
  const requiredUSD = borrowUSD * 0.70;
  const requiredCTC = requiredUSD / 2.0;
  const standardUSD = borrowUSD * 1.50;
  const standardCTC = standardUSD / 2.0;

  const savedUSD = standardUSD - requiredUSD;
  const savedCTC = standardCTC - requiredCTC;

  usdReqEl.innerText = `$${requiredUSD.toLocaleString('en-US', { maximumFractionDigits: 0 })} USD`;
  ctcReqEl.innerText = `${requiredCTC.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} CTC`;
  defiStdEl.innerText = `${standardCTC.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} CTC ($${standardUSD.toLocaleString()})`;
  capSavedEl.innerText = `${savedCTC.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} CTC ($${savedUSD.toLocaleString()} USD)`;

  if (borrowBtnLabel) {
    borrowBtnLabel.innerText = `Borrow $${borrowUSD.toLocaleString()} cUSD (Lock ${requiredCTC.toLocaleString()} CTC)`;
  }
}

// Borrow Execution
function executeBorrow() {
  const borrowInput = document.getElementById("borrow-amount-input");
  const borrowUSD = parseFloat(borrowInput.value) || 10000;
  const requiredCTC = (borrowUSD * 0.7) / 2;

  alert(`🚀 Loan Origination Successful on Creditcoin!\n\nDisbursed: $${borrowUSD.toLocaleString()} cUSD\nLocked Collateral: ${requiredCTC.toLocaleString()} CTC (70.0% Under-Collateralized Ratio)\nInterest APR: 2.50% (Super-Prime Tier)\n\nCapital Savings: 4,000 CTC ($8,000 USD preserved)`);
}

function repayDemoLoan() {
  alert("🎉 Loan #1 Fully Repaid!\n\nSettled $10,000 cUSD with accrued interest.\n3,500 CTC Collateral fully refunded to your wallet!");
}

function refreshSBT() {
  alert(`🎖️ Soulbound Token (CX-SBT #1) Refreshed!\n\nCurrent Score: ${state.creditScore} CTS (Super-Prime Tier)\nPrivacy Commitment: ${state.sbtCommitment}\nAttestation synchronized with CredXHub on Creditcoin!`);
}

function verifySBTForExternalDApp() {
  alert(`🔗 Composable Query Simulation:\n\nExternal Lending Protocol called: verifyAttestation(0x742d...f44e, CreditTier.PRIME)\n\nResult: TRUE ✅\nEligible for VIP zero-fee swaps and flash credit on Creditcoin!`);
}

// ══════════════ MULTI-TRACK INTERACTIVE DEMO HANDLERS ══════════════

// Track 1: DeFi
function executeFlashLoanDemo() {
  alert("⚡ Reputation Flash Loan Executed!\n\nBorrowed: $100,000 cUSD (0 Collateral)\nFee Paid: 0.01% = $10.00 (Super-Prime Rate vs $90.00 standard)\nArbitrage Routed & Settled in Block #1,928,452!");
}

function executeStakeYieldDemo() {
  alert("🏦 Reputation Yield Vault Stake Confirmed!\n\nStaked: 5,000 cUSD\nMultiplier: 2.0x Boost (Super-Prime Tier)\nEffective APY: 17.00% in CTC Rewards!");
}

function executeAMMSwapDemo() {
  alert("🔄 Reputation AMM Swap Confirmed!\n\nSwapped: 1,000 cUSD ➔ 500 CTC\nFee Applied: 0.05% ($0.50) instead of 0.30% ($3.00)!\nSavings credited via CredXHub tier!");
}

// Track 2: DePIN
function executeHardwareLeaseDemo() {
  alert("🖥️ DePIN Hardware Lease Line Originated!\n\nAsset: 8x NVIDIA H100 GPU Cluster ($50,000 USD)\nCollateral: $0 Zero Upfront (Approved for CTS ≥ 750)\nDisbursed to hardware vendor on Creditcoin!");
}

function executeNodeDelegationDemo() {
  alert("📡 DePIN Delegation Pool Stake Confirmed!\n\nDelegated: 2,500 CTC to 0xNode...79a1 (Score: 790 CTS)\nEstimated Yield: 14.2% APY in DePIN Revenue Share!");
}

// Track 3: Gaming
function executeGatherDailyDemo() {
  alert("🎮 Daily Pixels Gathering Harvested!\n\nBase Yield: 100 GAME Tokens\nSuper-Prime Multiplier: 3.0x Boost\nReceived: 300 GAME Tokens credited to your wallet!");
}

function executeOpenLootboxDemo() {
  alert("🎁 Anti-Sybil Fair Lootbox Opened!\n\nVerification: CTS 794 ≥ 500 (Sybil Check Passed ✅)\nUnlocked: [Legendary Creditcoin Broadsword #07] NFT!");
}

function executeBorrowNFTDemo() {
  alert("🛡️ Zero-Collateral Scholarship Vault Borrowed!\n\nCharacter: Dragon Slayer NFT #42\nCollateral Deposit: $0 (Reputation Gated for CTS ≥ 700)\nNFT transferred to player wallet for guild battle!");
}

// Track 4: Autonomous AI
function executeAIRiskUpdateDemo() {
  alert("🤖 AI Risk Oracle Ingestion Completed!\n\nAI Agent pushed cross-chain risk telemetry:\nVolatility Index: 10.0% · Default Rate: 2.0%\nAdjusted Base APR: 6.00% computed autonomously on-chain!");
}

function executeAgentFiDemo() {
  alert("💳 AgentFi Credit Facility Disbursed!\n\nAI Agent (0xAgent...1011) performance verified.\nCredit Disbursed: $100,000 cUSD for autonomous MEV & arbitrage!");
}

function executeComputeEscrowDemo() {
  alert("⚙️ Proof-of-Compute Settlement Complete!\n\nEscrow: $1,500 USDC released to GPU cluster operator upon cryptographic Merkle proof verification on Creditcoin!");
}

// Track 5: RWA
function executeRWADepositDemo() {
  alert("🏛️ Institutional Treasury Yield Fund (tbUSD) Minted!\n\nDeposited: 10,000 USDC\nMinted: 10,000 tbUSD (Treasury Backed USD)\nSuper-Prime Loyalty Reward: +2.0% bonus yield at redemption!");
}

function executeRWAInvoiceDemo() {
  alert("📄 Tokenized Invoice Financing Succeeded!\n\nInvoice: $50,000 Corporate Accounts Receivable (60 Days)\nAdvance Rate: 95% ($47,500 USD upfront advance for high credit score)\nDisbursed instantly in cUSD!");
}

// Track 6: Virtual Node Chrome Extension Simulator
function toggleVirtualNode() {
  state.nodeRunning = !state.nodeRunning;
  const badge = document.getElementById("node-status-badge");
  const btnText = document.getElementById("toggle-node-text");
  const syncBtn = document.getElementById("sync-node-btn");

  if (state.nodeRunning) {
    badge.className = "px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30";
    badge.innerText = "Running · Sharing Idle Bandwidth";
    btnText.innerText = "Stop Virtual Node";
    syncBtn.disabled = false;
    syncBtn.className = "px-5 py-3.5 rounded-xl bg-pink-500 hover:bg-pink-400 text-white font-bold text-xs transition-all flex items-center space-x-2 cursor-pointer";

    state.nodeTimer = setInterval(() => {
      state.nodeUptimeSeconds += 1;
      state.nodePoints += 2;
      state.nodeBandwidthMB += 5;

      const hrs = Math.floor(state.nodeUptimeSeconds / 3600).toString().padStart(2, '0');
      const mins = Math.floor((state.nodeUptimeSeconds % 3600) / 60).toString().padStart(2, '0');
      const secs = (state.nodeUptimeSeconds % 60).toString().padStart(2, '0');

      document.getElementById("ext-points-display").innerText = state.nodePoints.toLocaleString();
      document.getElementById("ext-uptime-display").innerText = `${hrs}:${mins}:${secs}`;
      document.getElementById("ext-bandwidth-display").innerText = `${state.nodeBandwidthMB.toLocaleString()} MB`;
      document.getElementById("ext-score-display").innerText = `+${Math.floor(state.nodePoints / 10)} CTS`;
    }, 1000);
  } else {
    badge.className = "px-3 py-1 rounded-full text-xs font-bold bg-slate-800 text-slate-400 border border-white/10";
    badge.innerText = "Disconnected";
    btnText.innerText = "Start Virtual Node";
    clearInterval(state.nodeTimer);
  }
}

function syncNodePointsToChain() {
  if (state.nodePoints === 0) {
    alert("Please run the virtual node for a few seconds to accumulate points first!");
    return;
  }
  const pts = state.nodePoints;
  const ctsBoost = Math.floor(pts / 10) || 5;
  alert(`⚡ Synchronized Virtual Node to Creditcoin!\n\nPoints Burned: ${pts}\nCTS Credit Score Boost: +${ctsBoost} CTS Points credited on Creditcoin Testnet!`);
  state.nodePoints = 0;
  document.getElementById("ext-points-display").innerText = "0";
  state.creditScore = Math.min(state.creditScore + ctsBoost, 850);
  updateScoreGauge(state.creditScore);
}

// Load deployed contracts from contracts.json
async function loadContractsConfig() {
  try {
    const res = await fetch("contracts.json");
    if (res.ok) {
      const data = await res.json();
      state.contracts = data.contracts;
    }
  } catch (err) {
    console.debug("Standalone demo mode");
  }
}
