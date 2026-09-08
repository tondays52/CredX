// CredX Protocol — Frontend Client Logic & Interactive Simulation (v2)
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
  ]
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

  // Total circumference is ~264
  // Min score 300 -> 0%, Max score 850 -> 100%
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
let scoreChartInstance = null;
function initChart() {
  const ctx = document.getElementById('creditScoreChart');
  if (!ctx) return;

  scoreChartInstance = new Chart(ctx, {
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
      plugins: {
        legend: { display: false }
      },
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

// Batch Mode Toggle
let isBatchMode = false;
function toggleBatchMode() {
  const toggle = document.getElementById("batch-mode-toggle");
  const submitLabel = document.getElementById("submit-btn-text");
  isBatchMode = toggle.checked;

  if (isBatchMode) {
    submitLabel.innerText = "Submit Batch Proofs (3 Proofs in 1 Tx via 0x0FD2) & Upgrade Score";
  } else {
    submitLabel.innerText = "Verify Fact via Attestcoin Protocol & Upgrade Score";
  }
}

// Presets for Proof Verifier
function loadPreset(type) {
  const chainSelect = document.getElementById("proof-source-chain");
  const actionSelect = document.getElementById("proof-action-type");
  const txHashInput = document.getElementById("proof-tx-hash");
  const valueInput = document.getElementById("proof-value-usd");
  const blockInput = document.getElementById("proof-block-num");

  if (type === 'aave') {
    chainSelect.value = "11155111"; // Sepolia
    actionSelect.value = "0"; // DeFi Loan Repayment
    txHashInput.value = "0xa515e6844f02f0fb90114b7cc1abb0a39b4bed6be8acf114674be8ac19cd6200";
    valueInput.value = "50000";
    blockInput.value = "5928192";
  } else if (type === 'compound') {
    chainSelect.value = "1"; // Mainnet
    actionSelect.value = "1"; // Compound Supply
    txHashInput.value = "0x19283746bc881234567890123456789012345678901234567890abcdef123456";
    valueInput.value = "75000";
    blockInput.value = "19283746";
  } else if (type === 'uniswap') {
    chainSelect.value = "1"; // Mainnet
    actionSelect.value = "2"; // Uniswap LP Provision
    txHashInput.value = "0xfa297710bc881234567890123456789012345678901234567890abcdef7710";
    valueInput.value = "25000";
    blockInput.value = "19283800";
  } else if (type === 'invoice') {
    chainSelect.value = "1"; // Mainnet
    actionSelect.value = "5"; // RWA Invoice Settlement
    txHashInput.value = "0x3d7a89bc4412ef891234567890123456789012345678901234567890abcdef91";
    valueInput.value = "35000";
    blockInput.value = "19283920";
  }
}

// Attestcoin Proof Simulation Execution
function executeProofSubmission() {
  const pipeline = document.getElementById("verification-pipeline");
  const btn = document.getElementById("submit-proof-btn");
  const step1 = document.getElementById("step-1");
  const step2 = document.getElementById("step-2");
  const step3 = document.getElementById("step-3");
  const valueUSD = parseFloat(document.getElementById("proof-value-usd").value) || 25000;
  const txHash = document.getElementById("proof-tx-hash").value;
  const chainId = document.getElementById("proof-source-chain").value;
  const actionType = document.getElementById("proof-action-type").options[document.getElementById("proof-action-type").selectedIndex].text;

  pipeline.classList.remove("hidden");
  btn.disabled = true;
  btn.innerHTML = `<i data-lucide="loader-2" class="w-5 h-5 animate-spin"></i><span>Calling Creditcoin Precompile 0x0FD2...</span>`;
  if (window.lucide) lucide.createIcons();

  setTimeout(() => {
    step1.innerHTML = `<i data-lucide="check" class="w-3.5 h-3.5 text-emerald-400"></i><span class="text-emerald-300">RLP Receipt & Merkle Proof Extracted for Block ${document.getElementById("proof-block-num").value}</span>`;
    step2.className = "flex items-center space-x-2 text-cyan-400";
    step2.innerHTML = `<i data-lucide="loader-2" class="w-3.5 h-3.5 animate-spin text-cyan-400"></i><span>Precompile 0x0FD2 verifying Merkle inclusion against source headers...</span>`;
    if (window.lucide) lucide.createIcons();
  }, 1000);

  setTimeout(() => {
    step2.innerHTML = `<i data-lucide="check" class="w-3.5 h-3.5 text-emerald-400"></i><span class="text-emerald-300">Precompile 0x0FD2 Succeeded: Cryptographic Proof Verified!</span>`;
    step3.className = "flex items-center space-x-2 text-cyan-400";
    step3.innerHTML = `<i data-lucide="loader-2" class="w-3.5 h-3.5 animate-spin text-cyan-400"></i><span>Executing OCCR Multi-Factor Algorithm & Privacy Commitment Hash...</span>`;
    if (window.lucide) lucide.createIcons();
  }, 2200);

  setTimeout(() => {
    const newScore = Math.min(state.creditScore + 16, 850);
    step3.innerHTML = `<i data-lucide="check" class="w-3.5 h-3.5 text-emerald-400"></i><span class="text-emerald-300">CredXHub Updated: CTS Upgraded to ${newScore} (Super-Prime Tier)!</span>`;
    btn.disabled = false;
    btn.className = "w-full py-4 rounded-2xl bg-emerald-500 text-slate-950 font-bold text-base shadow-xl transition-all flex items-center justify-center space-x-2";
    btn.innerHTML = `<i data-lucide="check-circle" class="w-5 h-5"></i><span>Proof Attested by Creditcoin Consensus!</span>`;
    if (window.lucide) lucide.createIcons();

    // Update state
    state.creditScore = newScore;
    state.totalVerifiedUSD += valueUSD;
    state.attestationsCount += 1;
    updateScoreGauge(newScore);

    // Add row to explorer table
    const tbody = document.getElementById("attestation-table-body");
    if (tbody) {
      const row = document.createElement("tr");
      row.className = "hover:bg-white/[0.02] bg-cyan-500/10 transition-colors";
      row.innerHTML = `
        <td class="p-4 flex items-center space-x-2">
          <span class="w-2 h-2 rounded-full bg-emerald-400"></span>
          <span>${chainId == "1" ? "Ethereum L1 (1)" : (chainId == "11155111" ? "Sepolia (11155111)" : "Arbitrum (42161)")}</span>
        </td>
        <td class="p-4 font-semibold text-white">${actionType.split('&')[0].trim()}</td>
        <td class="p-4 text-cyan-400 font-mono">${txHash.slice(0, 8)}...${txHash.slice(-4)}</td>
        <td class="p-4 font-bold text-emerald-400">$${valueUSD.toLocaleString()}</td>
        <td class="p-4 text-emerald-400">+16 pts (${newScore})</td>
        <td class="p-4 text-slate-400 font-mono">0x${Math.random().toString(16).slice(2, 6)}...${Math.random().toString(16).slice(2, 6)}</td>
        <td class="p-4"><span class="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">Verified</span></td>
      `;
      tbody.prepend(row);
    }
  }, 3400);
}

// Dynamic Collateral Calculation
function updateCollateralCalc() {
  const borrowInput = document.getElementById("borrow-amount-input");
  const ctcReqEl = document.getElementById("calc-ctc-required");
  const usdReqEl = document.getElementById("calc-usd-required");
  const defiStdEl = document.getElementById("calc-defi-standard");
  const capSavedEl = document.getElementById("calc-capital-saved");
  const borrowBtnLabel = document.getElementById("borrow-btn-label");

  if (!borrowInput || !ctcReqEl) return;

  const borrowUSD = parseFloat(borrowInput.value) || 0;
  // 70% collateral ratio, CTC Price = $2.00
  const requiredUSD = borrowUSD * 0.70;
  const requiredCTC = requiredUSD / 2.0;

  // Standard DeFi (150% collateral)
  const standardUSD = borrowUSD * 1.50;
  const standardCTC = standardUSD / 2.0;

  // Savings
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

  alert(`🚀 Loan Origination Successful on Creditcoin!\n\nDisbursed: $${borrowUSD.toLocaleString()} cUSD\nLocked Collateral: ${requiredCTC.toLocaleString()} CTC (70.0% Under-Collateralized Ratio)\nInterest APR: 2.50% (Super-Prime Institutional Rate)\n\nSavings vs Standard DeFi: 4,000 CTC ($8,000 USD preserved!)\n\nCreditcoin Tx: 0x5fc8d32690cc91d4c39d9d3abcbd16989f875707`);
}

// Repay Loan Demo
function repayDemoLoan() {
  alert("🎉 Loan #1 Fully Repaid!\n\nSettled $10,000 cUSD with accrued interest (2.5% APR = $1.37).\n3,500 CTC Collateral fully refunded to your wallet!");
  const activeList = document.getElementById("active-loans-list");
  if (activeList) {
    activeList.innerHTML = `<div class="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400 font-mono text-center">All loans settled. Zero outstanding debt. 3,500 CTC returned!</div>`;
  }
}

// Refresh Soulbound Attestation
function refreshSBT() {
  alert(`🎖️ Soulbound Token (CX-SBT #1) Refreshed!\n\nCurrent Score: ${state.creditScore} CTS (Super-Prime Tier)\nPrivacy Commitment: ${state.sbtCommitment}\nBlock Number: #1,928,450\n\nAttestation synchronized with CredXHub on Creditcoin!`);
}

// Test External Composable Query
function verifySBTForExternalDApp() {
  alert(`🔗 Composable Query Simulation:\n\nExternal Lending Protocol called: verifyAttestation(0x742d...f44e, CreditTier.PRIME)\n\nResult: TRUE ✅\nBorrower eligible for VIP 0-fee swaps and instant flash credit on Creditcoin!`);
}

// Social Vouching / Delegation
function executeVouch() {
  const target = document.getElementById("vouch-target-address").value;
  const boost = document.getElementById("vouch-boost-pts").value;
  const duration = document.getElementById("vouch-duration-days").value;

  alert(`🤝 Credit Delegation Successful!\n\nYou delegated +${boost} CTS points to wallet:\n${target}\nValidity: ${duration} Days\n\nThe beneficiary will receive an instant score boost on their next verified Attestcoin proof!`);
}

// Dynamically load deployed contract addresses from contracts.json
async function loadContractsConfig() {
  try {
    const res = await fetch("contracts.json");
    if (res.ok) {
      const data = await res.json();
      state.contracts = data.contracts;
      console.log("CredX deployed contract addresses loaded from contracts.json:", data);
    }
  } catch (err) {
    // Non-blocking in static environments
    console.debug("Contracts JSON not loaded (running in standalone demo mode)");
  }
}
