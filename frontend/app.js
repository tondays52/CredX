// CredX Protocol — Frontend Client Logic & Interactive Simulation
document.addEventListener("DOMContentLoaded", () => {
  lucide.createIcons();
  initChart();
  updateScoreGauge(785);
  updateCollateralCalc();
});

// App State
let state = {
  isConnected: false,
  walletAddress: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
  creditScore: 785,
  totalVerifiedUSD: 125000,
  attestationsCount: 12,
  requiredCollateralRatioBps: 7000, // 70%
  activeLoans: [
    {
      id: 1,
      principalUSD: 10000,
      collateralCTC: 3500,
      collateralRatio: "70.0%",
      apr: "5.0%",
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
}

// Wallet Connection
function toggleWalletConnect() {
  state.isConnected = !state.isConnected;
  const btn = document.getElementById("connect-wallet-btn");
  const text = document.getElementById("wallet-address-text");

  if (state.isConnected) {
    text.innerText = "0x742d...f44e (CTC: 14,250)";
    btn.classList.remove("from-cyan-500", "to-indigo-600");
    btn.classList.add("from-emerald-500", "to-teal-600");
  } else {
    text.innerText = "Connect Wallet";
    btn.classList.add("from-cyan-500", "to-indigo-600");
    btn.classList.remove("from-emerald-500", "to-teal-600");
  }
}

// Update Score SVG Gauge
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
      tierBadge.innerText = "Tier: Prime (780+)";
    } else if (score >= 700) {
      tierBadge.className = "px-3 py-1 rounded-full text-xs font-bold bg-purple-500/20 text-purple-400 border border-purple-500/30";
      tierBadge.innerText = "Tier: Gold (700+)";
    } else if (score >= 600) {
      tierBadge.className = "px-3 py-1 rounded-full text-xs font-bold bg-cyan-500/20 text-cyan-400 border border-cyan-500/30";
      tierBadge.innerText = "Tier: Silver (600+)";
    } else {
      tierBadge.className = "px-3 py-1 rounded-full text-xs font-bold bg-slate-500/20 text-slate-400 border border-slate-500/30";
      tierBadge.innerText = "Tier: Unranked";
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
      labels: ['Month -4', 'Month -3', 'Month -2', 'Month -1', 'Current'],
      datasets: [{
        label: 'Creditcoin Trust Score (CTS)',
        data: [420, 510, 640, 710, 785],
        borderColor: '#06b6d4',
        backgroundColor: 'rgba(6, 182, 212, 0.1)',
        borderWidth: 3,
        fill: true,
        tension: 0.4,
        pointBackgroundColor: '#22d3ee',
        pointRadius: 4,
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

// Presets for Proof Verifier
function loadPreset(type) {
  const chainSelect = document.getElementById("proof-source-chain");
  const actionSelect = document.getElementById("proof-action-type");
  const txHashInput = document.getElementById("proof-tx-hash");
  const valueInput = document.getElementById("proof-value-usd");
  const blockInput = document.getElementById("proof-block-num");

  if (type === 'aave') {
    chainSelect.value = "11155111"; // Sepolia
    actionSelect.value = "0"; // DeFi Repayment
    txHashInput.value = "0x8f3b219e4a8b76c12d849fa023e981bc89a74e567123490abcde891234567890";
    valueInput.value = "50000";
    blockInput.value = "5928192";
  } else if (type === 'invoice') {
    chainSelect.value = "11155111";
    actionSelect.value = "1"; // RWA Invoice
    txHashInput.value = "0x3d7a89bc4412ef891234567890123456789012345678901234567890abcdef91";
    valueInput.value = "25000";
    blockInput.value = "5931045";
  } else if (type === 'mainnet') {
    chainSelect.value = "1"; // Ethereum Mainnet
    actionSelect.value = "0";
    txHashInput.value = "0xfa297710bc881234567890123456789012345678901234567890abcdef123456";
    valueInput.value = "100000";
    blockInput.value = "19283746";
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

  pipeline.classList.remove("hidden");
  btn.disabled = true;
  btn.innerHTML = `<i data-lucide="loader-2" class="w-5 h-5 animate-spin"></i><span>Verifying Merkle Proof via Attestcoin...</span>`;
  lucide.createIcons();

  setTimeout(() => {
    step1.innerHTML = `<i data-lucide="check" class="w-3.5 h-3.5 text-emerald-400"></i><span class="text-emerald-300">RLP Receipt & Merkle Proof Generated for Block ${document.getElementById("proof-block-num").value}</span>`;
    step2.className = "flex items-center space-x-2 text-cyan-400";
    step2.innerHTML = `<i data-lucide="loader-2" class="w-3.5 h-3.5 animate-spin text-cyan-400"></i><span>Calling Creditcoin Precompile at 0x000...09 to re-derive Merkle Root...</span>`;
    lucide.createIcons();
  }, 1000);

  setTimeout(() => {
    step2.innerHTML = `<i data-lucide="check" class="w-3.5 h-3.5 text-emerald-400"></i><span class="text-emerald-300">Precompile Merkle Verification Succeeded (Root Matched Source Consensus)</span>`;
    step3.className = "flex items-center space-x-2 text-cyan-400";
    step3.innerHTML = `<i data-lucide="loader-2" class="w-3.5 h-3.5 animate-spin text-cyan-400"></i><span>Updating CredXHub Credit Score & Discharging Replay Lock...</span>`;
    lucide.createIcons();
  }, 2200);

  setTimeout(() => {
    step3.innerHTML = `<i data-lucide="check" class="w-3.5 h-3.5 text-emerald-400"></i><span class="text-emerald-300">CredXHub Updated: CTS Score Upgraded to 810 (Prime Tier)!</span>`;
    btn.disabled = false;
    btn.className = "w-full py-4 rounded-2xl bg-emerald-500 text-slate-950 font-bold text-base shadow-xl transition-all flex items-center justify-center space-x-2";
    btn.innerHTML = `<i data-lucide="check-circle" class="w-5 h-5"></i><span>Proof Successfully Attested on Creditcoin!</span>`;
    lucide.createIcons();

    // Update state
    state.creditScore = 810;
    state.totalVerifiedUSD += valueUSD;
    state.attestationsCount += 1;
    updateScoreGauge(810);

    // Add row to explorer table
    const tbody = document.getElementById("attestation-table-body");
    if (tbody) {
      const row = document.createElement("tr");
      row.className = "hover:bg-white/[0.02] bg-cyan-500/10 transition-colors";
      row.innerHTML = `
        <td class="p-4 flex items-center space-x-2">
          <span class="w-2 h-2 rounded-full bg-emerald-400"></span>
          <span>${chainId == "1" ? "Ethereum L1 (1)" : "Sepolia (11155111)"}</span>
        </td>
        <td class="p-4 font-semibold text-white">Verified Attestation</td>
        <td class="p-4 text-cyan-400 font-mono">${txHash.slice(0, 8)}...${txHash.slice(-4)}</td>
        <td class="p-4 font-bold text-emerald-400">$${valueUSD.toLocaleString()}</td>
        <td class="p-4 text-emerald-400">+25 pts (810)</td>
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
  if (!borrowInput || !ctcReqEl) return;

  const borrowUSD = parseFloat(borrowInput.value) || 0;
  // 70% collateral ratio, CTC Price = $2.00
  const requiredUSD = borrowUSD * 0.70;
  const requiredCTC = requiredUSD / 2.0;

  ctcReqEl.innerText = `${requiredCTC.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} CTC`;
}

// Borrow Execution
function executeBorrow() {
  const borrowInput = document.getElementById("borrow-amount-input");
  const borrowUSD = parseFloat(borrowInput.value) || 10000;
  const requiredCTC = (borrowUSD * 0.7) / 2;

  alert(`🚀 Loan Origination Successful on Creditcoin!\n\nDisbursed: $${borrowUSD.toLocaleString()} cUSD\nLocked Collateral: ${requiredCTC.toLocaleString()} CTC (70.0% Under-Collateralized Ratio)\nInterest APR: 5.0%\n\nTransaction Hash on Creditcoin: 0x9a8f...312b`);
}

// Repay Loan Demo
function repayDemoLoan() {
  alert("🎉 Loan #1 Fully Repaid!\n\nRepaid $10,000 cUSD. Reclaimed 3,500 CTC Collateral back to your wallet!");
  const activeList = document.getElementById("active-loans-list");
  if (activeList) {
    activeList.innerHTML = `<div class="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400 font-mono text-center">All loans settled. Zero outstanding debt.</div>`;
  }
}
