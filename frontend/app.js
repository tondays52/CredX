// CredX Protocol — Frontend Client Logic & Interactive Multi-Track Simulation (v2.5)
document.addEventListener("DOMContentLoaded", async () => {
  if (window.lucide) lucide.createIcons();
  initToastContainer();
  initChart();
  updateScoreGauge(794);
  updateCollateralCalc();
  initHardwareTelemetry();
  await loadContractsConfig();
});

// Professional Floating Toast Notification System
function initToastContainer() {
  if (!document.getElementById("toast-container")) {
    const container = document.createElement("div");
    container.id = "toast-container";
    document.body.appendChild(container);
  }
}

function showToast(title, message, type = "info", duration = 4000) {
  initToastContainer();
  const container = document.getElementById("toast-container");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = `toast-item toast-${type}`;

  const iconMap = {
    success: "✅",
    error: "❌",
    info: "⚡",
    warning: "⚠️"
  };

  toast.innerHTML = `
    <span class="text-lg">${iconMap[type] || "⚡"}</span>
    <div class="flex-1 min-w-0">
      <div class="text-xs font-bold text-white tracking-wide">${title}</div>
      <div class="text-[11px] text-slate-300 mt-0.5 leading-snug break-words">${message}</div>
    </div>
    <div class="toast-progress" style="animation-duration: ${duration}ms;"></div>
  `;

  container.appendChild(toast);

  // Trigger enter animation
  requestAnimationFrame(() => {
    toast.classList.add("show");
  });

  // Auto dismiss
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 400);
  }, duration);
}

function showStatus(message, type = "info") {
  const titles = {
    success: "Transaction Confirmed",
    error: "Action Failed",
    info: "CredX Network Update",
    warning: "Security Notice"
  };
  showToast(titles[type] || "CredX Protocol", message, type);
}

// Clipboard Helper
function copyToClipboard(text, label = "Address") {
  navigator.clipboard.writeText(text).then(() => {
    playSoundEffect('click');
    showToast("Copied to Clipboard", `${label}: ${text.slice(0, 10)}...${text.slice(-6)}`, "success", 2500);
  }).catch(() => {
    showToast("Copy Failed", text, "error");
  });
}

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
  playSoundEffect('click');
}

// Wallet Connection
function toggleWalletConnect() {
  state.isConnected = !state.isConnected;
  const btn = document.getElementById("connect-wallet-btn");
  const text = document.getElementById("wallet-address-text");
  const holderAddrEl = document.getElementById("sbt-holder-addr");

  if (state.isConnected) {
    text.innerText = "0x742d...f44e (14,250 CTC)";
    if (holderAddrEl) holderAddrEl.innerText = "0x742d35Cc6634C0532925a3b844Bc454e4438f44e";
    btn.classList.remove("from-cyan-500", "to-indigo-600");
    btn.classList.add("from-emerald-500", "to-teal-600");
    playSoundEffect('success');
    showToast("Wallet Connected", "Connected to Creditcoin Testnet (Chain ID 102031) · 14,250 CTC available", "success");
  } else {
    text.innerText = "Connect Wallet";
    btn.classList.add("from-cyan-500", "to-indigo-600");
    btn.classList.remove("from-emerald-500", "to-teal-600");
    playSoundEffect('click');
    showToast("Wallet Disconnected", "Switched to Public Read-Only Mode", "info");
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

  document.getElementById("borrowModalDisbursed").textContent = `$${borrowUSD.toLocaleString()} cUSD`;
  document.getElementById("borrowModalLocked").textContent = `${requiredCTC.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} CTC (70.0% Ratio)`;
  
  playSoundEffect('success');
  openGameModal('borrowModal');
  showStatus(`🚀 Loan Originated! $${borrowUSD.toLocaleString()} cUSD disbursed at 70% collateral ratio (2.5% APR).`, "success");
}

function repayDemoLoan() {
  playSoundEffect('success');
  openGameModal('repayModal');
  showStatus("🎉 Loan #1 Fully Settled! 3,500 CTC collateral refunded to your wallet.", "success");
}

function refreshSBT() {
  playSoundEffect('success');
  openGameModal('sbtModal');
  showStatus(`🎖️ CX-SBT Soulbound Token synchronized with CredXHub (Score: ${state.creditScore} CTS).`, "success");
}

function verifySBTForExternalDApp() {
  playSoundEffect('harvest');
  openGameModal('composableQueryModal');
}

// ══════════════ MULTI-TRACK INTERACTIVE DEMO HANDLERS ══════════════

// ══════════════ MULTI-TRACK INTERACTIVE DEMO HANDLERS ══════════════

// ==================== TRACK 1: DEFI MODAL CONTROLLERS ====================

// 1. Flash Loan Arbitrage Simulator
let selectedFlashAmount = 100000;

function executeFlashLoanDemo() {
  selectFlashAmount(100000);
  document.getElementById('flashProgressContainer').classList.add('hidden');
  document.getElementById('flashProgressBar').style.width = '0%';
  const btn = document.getElementById('btnExecuteFlash');
  btn.disabled = false;
  btn.innerHTML = `<i data-lucide="zap" class="w-4 h-4"></i><span>Execute Atomic Flash Loan & Arbitrage</span>`;
  openGameModal('flashLoanModal');
}

function selectFlashAmount(amount) {
  selectedFlashAmount = amount;
  const buttons = document.querySelectorAll('.flash-btn');
  buttons.forEach(b => {
    b.classList.remove('active', 'bg-cyan-500', 'text-slate-950', 'border-cyan-400');
    b.classList.add('bg-white/5', 'text-white', 'border-white/10');
    if (b.textContent.includes(amount >= 1000 ? `$${amount/1000}k` : `$${amount}`)) {
      b.classList.add('active', 'bg-cyan-500', 'text-slate-950', 'border-cyan-400');
      b.classList.remove('bg-white/5', 'text-white', 'border-white/10');
    }
  });

  const fee = amount * 0.0001; // 0.01%
  const standardFee = amount * 0.0009; // 0.09%
  const saved = standardFee - fee;
  const estimatedProfit = (amount * 0.0142).toFixed(2); // ~1.42% net profit

  document.getElementById('flashPrincipalText').textContent = `$${amount.toLocaleString()} cUSD`;
  document.getElementById('flashFeeText').innerHTML = `$${fee.toFixed(2)} cUSD <span class="text-[10px] text-slate-500">(Saved $${saved.toFixed(2)} vs standard)</span>`;
  document.getElementById('flashProfitText').textContent = `+$${parseFloat(estimatedProfit).toLocaleString()} cUSD`;
}

function runFlashLoanSimulation() {
  const btn = document.getElementById('btnExecuteFlash');
  btn.disabled = true;
  const progressContainer = document.getElementById('flashProgressContainer');
  const progressBar = document.getElementById('flashProgressBar');
  const progressText = document.getElementById('flashProgressText');
  progressContainer.classList.remove('hidden');

  playSoundEffect('harvest');
  progressBar.style.width = '25%';
  progressText.innerHTML = `<span>Step 1: Borrowing $${selectedFlashAmount.toLocaleString()} from LendingPool (0x0FD2)...</span><span>25%</span>`;

  setTimeout(() => {
    progressBar.style.width = '55%';
    progressText.innerHTML = `<span>Step 2: Swapping on Uniswap v3 ➔ Curve Pool Arbitrage...</span><span>55%</span>`;
    playSoundEffect('harvest');
  }, 700);

  setTimeout(() => {
    progressBar.style.width = '85%';
    progressText.innerHTML = `<span>Step 3: Repaying Principal + 0.01% Fee ($${(selectedFlashAmount * 0.0001).toFixed(2)})...</span><span>85%</span>`;
    playSoundEffect('harvest');
  }, 1400);

  setTimeout(() => {
    progressBar.style.width = '100%';
    progressText.innerHTML = `<span>Step 4: Atomic Settlement Complete! Net Profit Captured: +$${(selectedFlashAmount * 0.0142).toFixed(2)}</span><span>100%</span>`;
    playSoundEffect('success');
    btn.innerHTML = `<span>🎉 Arbitrage Settled in Block #1,928,452!</span>`;
    setTimeout(() => {
      closeGameModal('flashLoanModal');
      showStatus(`⚡ Flash Loan Arbitrage Executed! Profit: +$${(selectedFlashAmount * 0.0142).toFixed(2)} cUSD (0.01% Super-Prime Fee Paid).`, "success");
    }, 1200);
  }, 2100);
}

// 2. Yield Staking Vault
let liveVaultYield = 12.45;
let yieldInterval = null;

function executeStakeYieldDemo() {
  openGameModal('yieldVaultModal');
  if (!yieldInterval) {
    yieldInterval = setInterval(() => {
      liveVaultYield += 0.0042;
      const el = document.getElementById('liveVaultYieldDisplay');
      if (el) el.textContent = `+${liveVaultYield.toFixed(4)} cUSD`;
    }, 500);
  }
}

function confirmVaultStake() {
  playSoundEffect('success');
  const amt = document.getElementById('yieldStakeInput').value || 5000;
  closeGameModal('yieldVaultModal');
  showStatus(`🏛️ Staked ${parseFloat(amt).toLocaleString()} cUSD into Boosted 17.0% APY Yield Vault! (2.0x Multiplier Active)`, "success");
}

function harvestVaultYield() {
  playSoundEffect('success');
  const harvested = liveVaultYield.toFixed(2);
  liveVaultYield = 0.00;
  const el = document.getElementById('liveVaultYieldDisplay');
  if (el) el.textContent = `+0.0000 cUSD`;
  closeGameModal('yieldVaultModal');
  showStatus(`🎉 Harvested +${harvested} cUSD in yield rewards to your Creditcoin wallet!`, "success");
}

// 3. Reputation AMM DEX Swap
function executeAMMSwapDemo() {
  updateAmmReceiveAmount();
  openGameModal('ammSwapModal');
}

function updateAmmReceiveAmount() {
  const payAmt = parseFloat(document.getElementById('ammPayAmount').value) || 0;
  const rate = 0.5; // 1 cUSD = 0.5 CTC
  const feeRate = 0.0005; // 0.05% fee
  const netReceived = (payAmt * rate * (1 - feeRate)).toFixed(2);
  document.getElementById('ammReceiveAmount').textContent = netReceived;
  const btn = document.getElementById('btnAmmSwap');
  if (btn) {
    btn.textContent = `🔄 Swap ${payAmt} cUSD ➔ CTC (0.05% Fee)`;
  }
}

function executeAmmSwapSimulation() {
  playSoundEffect('harvest');
  const btn = document.getElementById('btnAmmSwap');
  btn.disabled = true;
  btn.textContent = "Swapping across Creditcoin AMM...";

  setTimeout(() => {
    playSoundEffect('success');
    btn.textContent = "✅ Swap Confirmed (0.05% VIP Fee Applied)";
    setTimeout(() => {
      closeGameModal('ammSwapModal');
      showStatus("🔄 Reputation AMM Swap Complete: 1,000 cUSD ➔ 499.75 CTC (0.05% VIP Fee Applied).", "success");
      btn.disabled = false;
    }, 800);
  }, 1000);
}

// ==================== TRACK 2: DEPIN MODAL CONTROLLERS ====================

// 1. Hardware Lease Simulator
let selectedGpuCost = 50000;
let selectedGpuModel = "8x NVIDIA H100 (80GB)";

function executeHardwareLeaseDemo() {
  document.getElementById('leaseProgressContainer').classList.add('hidden');
  document.getElementById('leaseProgressBar').style.width = '0%';
  const btn = document.getElementById('btnOriginateLease');
  btn.disabled = false;
  btn.innerHTML = `<span>🚀 Originate Zero-Collateral Compute Lease</span>`;
  openGameModal('depinLeaseModal');
}

function selectGpuCluster(cost, model, compute, btn) {
  selectedGpuCost = cost;
  selectedGpuModel = model;
  const buttons = document.querySelectorAll('.gpu-cluster-btn');
  buttons.forEach(b => {
    b.classList.remove('active', 'bg-indigo-500/20', 'border-indigo-400');
    b.classList.add('bg-white/5', 'border-white/10');
  });
  btn.classList.add('active', 'bg-indigo-500/20', 'border-indigo-400');
  btn.classList.remove('bg-white/5', 'border-white/10');

  document.getElementById('gpuModelText').textContent = model;
  document.getElementById('gpuComputeText').textContent = compute;
  document.getElementById('gpuCostText').textContent = `$${cost.toLocaleString()} USD Lease`;
}

function runHardwareLeaseSimulation() {
  const btn = document.getElementById('btnOriginateLease');
  btn.disabled = true;
  const container = document.getElementById('leaseProgressContainer');
  const bar = document.getElementById('leaseProgressBar');
  const text = document.getElementById('leaseProgressText');
  container.classList.remove('hidden');

  playSoundEffect('harvest');
  bar.style.width = '30%';
  text.innerHTML = `<span>Step 1: Verifying node operator CTS 794 &ge; 750 on Creditcoin...</span><span>30%</span>`;

  setTimeout(() => {
    bar.style.width = '65%';
    text.innerHTML = `<span>Step 2: Securing $${selectedGpuCost.toLocaleString()} credit line with $0 upfront collateral...</span><span>65%</span>`;
    playSoundEffect('harvest');
  }, 750);

  setTimeout(() => {
    bar.style.width = '100%';
    text.innerHTML = `<span>Step 3: Escrow disbursed to NVIDIA Hardware Vendor! Cluster Activated.</span><span>100%</span>`;
    playSoundEffect('success');
    btn.innerHTML = `<span>🎉 Lease Active! Cluster Dispatched to Operator</span>`;

    setTimeout(() => {
      closeGameModal('depinLeaseModal');
      showStatus(`🖥️ DePIN Hardware Lease Originated! $${selectedGpuCost.toLocaleString()} ${selectedGpuModel} activated with $0 collateral.`, "success");
    }, 1200);
  }, 1600);
}

// 2. Node Staking Delegation Terminal
let selectedNodeApy = 14.2;

function executeNodeDelegationDemo() {
  updateDePINStakeAmount();
  openGameModal('depinDelegationModal');
}

function selectDePINNode(nodeId, score, apyStr, el) {
  const cards = document.querySelectorAll('.node-select-card');
  cards.forEach(c => {
    c.classList.remove('active', 'bg-cyan-500/20', 'border-cyan-400');
    c.classList.add('bg-white/5', 'border-white/10');
  });
  el.classList.add('active', 'bg-cyan-500/20', 'border-cyan-400');
  el.classList.remove('bg-white/5', 'border-white/10');

  selectedNodeApy = parseFloat(apyStr);
  updateDePINStakeAmount();
  playSoundEffect('harvest');
}

function updateDePINStakeAmount() {
  const slider = document.getElementById('depinStakeSlider');
  if (!slider) return;
  const amt = parseInt(slider.value);
  document.getElementById('depinStakeAmtText').textContent = `${amt.toLocaleString()} CTC`;
  const estEarn = ((amt * selectedNodeApy) / 100).toFixed(1);
  document.getElementById('depinEstEarnings').textContent = `${estEarn} CTC / Year (${selectedNodeApy}% APY)`;
}

function runNodeDelegationSimulation() {
  playSoundEffect('success');
  const slider = document.getElementById('depinStakeSlider');
  const amt = slider ? parseInt(slider.value) : 2500;
  closeGameModal('depinDelegationModal');
  showStatus(`📡 Delegated ${amt.toLocaleString()} CTC to Verified DePIN Node! Earning ${selectedNodeApy}% APY revenue share.`, "success");
}

// ==================== TRACK 3: GAMING MODAL CONTROLLERS ====================

// Simple Web Audio Sound Synthesizer for retro game sound effects
function playSoundEffect(type) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'harvest') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.15);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } else if (type === 'chest') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(659.25, ctx.currentTime + 0.3);
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } else if (type === 'success') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, ctx.currentTime);
      osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1);
      osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.2);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.35);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    }
  } catch (e) {
    // Audio context may be blocked before user interaction
  }
}

function openGameModal(id) {
  const modal = document.getElementById(id);
  if (modal) {
    modal.classList.add('active');
  }
}

function closeGameModal(id) {
  const modal = document.getElementById(id);
  if (modal) {
    modal.classList.remove('active');
  }
}

// 1. Pixels Farm Harvest Game
let currentHarvestTotal = 0;
let tilesHarvestedCount = 0;

function executeGatherDailyDemo() {
  currentHarvestTotal = 0;
  tilesHarvestedCount = 0;
  const tiles = document.querySelectorAll('#farmTilesGrid .farm-tile');
  tiles.forEach(t => t.classList.remove('harvested'));
  document.getElementById('farmHarvestTotal').textContent = '0 GAME';
  document.getElementById('farmProgressBar').style.width = '0%';
  const claimBtn = document.getElementById('claimHarvestBtn');
  claimBtn.disabled = true;
  claimBtn.className = "w-full py-3.5 rounded-xl bg-slate-700 text-slate-400 font-extrabold text-xs transition-all flex items-center justify-center space-x-2";
  claimBtn.innerHTML = "<span>Click crop tiles above to harvest!</span>";
  openGameModal('pixelsHarvestModal');
}

function harvestTile(el, baseAmount) {
  if (el.classList.contains('harvested')) return;
  el.classList.add('harvested');
  playSoundEffect('harvest');

  const multiplier = 3.0; // Super-Prime tier multiplier
  const harvested = Math.round(baseAmount * multiplier);
  currentHarvestTotal += harvested;
  tilesHarvestedCount++;

  document.getElementById('farmHarvestTotal').textContent = `${currentHarvestTotal} GAME (+${harvested})`;
  const pct = (tilesHarvestedCount / 6) * 100;
  document.getElementById('farmProgressBar').style.width = `${pct}%`;

  if (tilesHarvestedCount >= 6) {
    const claimBtn = document.getElementById('claimHarvestBtn');
    claimBtn.disabled = false;
    claimBtn.className = "w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 font-extrabold text-xs transition-all flex items-center justify-center space-x-2 shadow-lg shadow-emerald-500/25";
    claimBtn.innerHTML = `<span>🎉 Claim Daily Total (${currentHarvestTotal} GAME)</span>`;
    playSoundEffect('success');
  }
}

function claimAllHarvest() {
  playSoundEffect('success');
  closeGameModal('pixelsHarvestModal');
  showStatus(`🎮 Harvest Complete! Claimed ${currentHarvestTotal} GAME Tokens with 3.0x Super-Prime Multiplier.`, "success");
}

// 2. Anti-Sybil Fair Lootbox Drop
function executeOpenLootboxDemo() {
  document.getElementById('chestClosedView').classList.remove('hidden');
  document.getElementById('chestOpenedView').classList.add('hidden');
  const chest = document.getElementById('clickableChest');
  chest.classList.remove('chest-shaking');
  chest.classList.add('chest-glow');
  chest.textContent = '📦';
  openGameModal('lootboxModal');
}

function triggerOpenChest() {
  const chest = document.getElementById('clickableChest');
  chest.classList.remove('chest-glow');
  chest.classList.add('chest-shaking');
  playSoundEffect('chest');

  setTimeout(() => {
    chest.classList.remove('chest-shaking');
    document.getElementById('chestClosedView').classList.add('hidden');
    document.getElementById('chestOpenedView').classList.remove('hidden');
    playSoundEffect('success');
  }, 1000);
}

// 3. Guild Scholarship Rental Vault
function executeBorrowNFTDemo() {
  openGameModal('scholarshipModal');
}

function confirmRental(btn) {
  playSoundEffect('success');
  btn.disabled = true;
  btn.className = "px-4 py-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 font-extrabold text-xs border border-emerald-500/40";
  btn.textContent = "Active Rental (0 Collateral)";
  setTimeout(() => {
    closeGameModal('scholarshipModal');
    showStatus("🛡️ Dragon Slayer #42 rented to wallet for 0 collateral! Approved by CTS 794.", "success");
  }, 900);
}

// 4. Zero-Fee Gaming Marketplace
function executeBuyNFTMarketplaceDemo() {
  openGameModal('marketplaceModal');
}

function buyMarketItem(btn) {
  playSoundEffect('success');
  btn.disabled = true;
  btn.className = "px-4 py-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 font-extrabold text-xs border border-emerald-500/40";
  btn.textContent = "Purchased (0% Fee)";
  setTimeout(() => {
    closeGameModal('marketplaceModal');
    showStatus("🛒 Item purchased with 0% marketplace fee! Transferred to inventory.", "success");
  }, 800);
}

// ==================== TRACK 4: AUTONOMOUS AI MODAL CONTROLLERS ====================

// 1. AI Dynamic Risk Oracle
function executeAIRiskUpdateDemo() {
  updateAIRiskCalc();
  openGameModal('aiRiskModal');
}

function updateAIRiskCalc() {
  const vol = parseFloat(document.getElementById('aiVolSlider').value) || 10;
  const defRate = parseFloat(document.getElementById('aiDefSlider').value) || 2;
  document.getElementById('aiVolDisplay').textContent = `${vol.toFixed(1)}%`;
  document.getElementById('aiDefDisplay').textContent = `${defRate.toFixed(1)}%`;

  // On-chain formula: Base APR = 4.0% + (volatility * 0.15) + (defaultRate * 0.25)
  const calcAPR = (4.0 + (vol * 0.15) + (defRate * 0.25)).toFixed(2);
  document.getElementById('aiCalcAPR').textContent = `${calcAPR}% APR`;
}

function runAIRiskPushSimulation() {
  playSoundEffect('harvest');
  const btn = document.getElementById('btnPushAIRisk');
  btn.disabled = true;
  btn.textContent = "Broadcasting AI telemetry across chains...";

  setTimeout(() => {
    playSoundEffect('success');
    btn.textContent = "✅ Risk Telemetry Ingested into AIRiskOracle.sol";
    setTimeout(() => {
      closeGameModal('aiRiskModal');
      const apr = document.getElementById('aiCalcAPR').textContent;
      showStatus(`🤖 AI Risk Oracle Updated! Base credit APR re-indexed to ${apr} autonomously.`, "success");
      btn.disabled = false;
    }, 900);
  }, 1000);
}

// 2. AgentFi Credit Facility
function executeAgentFiDemo() {
  openGameModal('agentFiModal');
}

function runAgentFiDisbursement() {
  playSoundEffect('harvest');
  const btn = document.getElementById('btnDisburseAgentFi');
  btn.disabled = true;
  btn.textContent = "Disbursing $100,000 cUSD Credit Line...";

  setTimeout(() => {
    playSoundEffect('success');
    btn.textContent = "✅ $100,000 cUSD Disbursed to 0xAgent...1011";
    setTimeout(() => {
      closeGameModal('agentFiModal');
      showStatus("💳 AgentFi Facility Disbursed: $100,000 cUSD to AI Agent for autonomous MEV & arbitrage!", "success");
      btn.disabled = false;
    }, 900);
  }, 1000);
}

// 3. Proof-of-Compute Settlement
function executeComputeEscrowDemo() {
  openGameModal('computeEscrowModal');
}

function runComputeSettlement() {
  playSoundEffect('harvest');
  const btn = document.getElementById('btnSettleCompute');
  btn.disabled = true;
  btn.textContent = "Verifying cryptographic proof on 0x0FD2...";

  setTimeout(() => {
    playSoundEffect('success');
    btn.textContent = "✅ Merkle Proof Valid! $1,500 USDC Released";
    setTimeout(() => {
      closeGameModal('computeEscrowModal');
      showStatus("⚙️ Compute Settlement Complete: $1,500 USDC released to GPU Provider (0xGPU...489f).", "success");
      btn.disabled = false;
    }, 900);
  }, 1000);
}

// ==================== TRACK 5: RWA MODAL CONTROLLERS ====================

// 4. Institutional Treasury Yield Fund (tbUSD)
function executeRWADepositDemo() {
  openGameModal('rwaTreasuryModal');
}

function runRWAMintSimulation() {
  playSoundEffect('harvest');
  const btn = document.getElementById('btnMintTbUSD');
  const amt = document.getElementById('rwaDepositInput').value || 10000;
  btn.disabled = true;
  btn.textContent = "Minting tbUSD with +2.0% Loyalty Bonus...";

  setTimeout(() => {
    playSoundEffect('success');
    btn.textContent = `✅ Minted ${parseFloat(amt).toLocaleString()} tbUSD`;
    setTimeout(() => {
      closeGameModal('rwaTreasuryModal');
      showStatus(`🏛️ Treasury Fund Minted: ${parseFloat(amt).toLocaleString()} tbUSD! +2.0% Super-Prime Bonus APY applied.`, "success");
      btn.disabled = false;
    }, 900);
  }, 1000);
}

// 5. Tokenized Invoice Factoring
function executeRWAInvoiceDemo() {
  openGameModal('rwaInvoiceModal');
}

function runInvoiceFundingSimulation() {
  playSoundEffect('harvest');
  const btn = document.getElementById('btnFundInvoice');
  btn.disabled = true;
  btn.textContent = "Factoring Invoice with 95% Advance Rate...";

  setTimeout(() => {
    playSoundEffect('success');
    btn.textContent = "✅ $47,500 cUSD Advance Disbursed";
    setTimeout(() => {
      closeGameModal('rwaInvoiceModal');
      showStatus("📄 Tokenized Invoice Funded: $47,500 cUSD (95% advance) disbursed to corporate vendor!", "success");
      btn.disabled = false;
    }, 900);
  }, 1000);
}

// Track 6: Virtual Node Chrome Extension Simulator & Real Hardware Telemetry
function initHardwareTelemetry() {
  const coresEl = document.getElementById("dashHwCores");
  const ramEl = document.getElementById("dashHwRAM");
  const gpuEl = document.getElementById("dashHwGpu");
  const pingEl = document.getElementById("dashHwPing");

  if (!coresEl) return;

  // Real CPU Cores
  const cores = navigator.hardwareConcurrency || 8;
  coresEl.innerText = `${cores} Cores`;

  // Real Device RAM
  const ram = navigator.deviceMemory || (cores >= 8 ? 16 : 8);
  ramEl.innerText = `${ram} GB RAM`;

  // Real GPU Hardware Detection via WebGL
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
    if (gl) {
      const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
      if (debugInfo) {
        const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
        let clean = renderer.replace(/ANGLE \((.*)\)/, '$1').replace(/Direct3D.*vs_\d+_\d+ ps_\d+_\d+/, '').trim();
        gpuEl.innerText = clean || "WebGL 2.0 Hardware Accelerator";
      } else {
        gpuEl.innerText = gl.getParameter(gl.RENDERER) || "DirectX/Metal GPU Acceleration";
      }
    } else {
      gpuEl.innerText = "Standard GPU Accelerator";
    }
  } catch (e) {
    gpuEl.innerText = "DirectX / Metal Hardware GPU";
  }

  // Real Live Network Ping probe
  const probePing = async () => {
    const t0 = performance.now();
    try {
      await fetch("https://1.1.1.1/cdn-cgi/trace", { method: "HEAD", mode: "no-cors", cache: "no-store" });
      const rtt = Math.round(performance.now() - t0);
      if (pingEl) pingEl.innerText = `${Math.max(rtt, 14)} ms`;
    } catch (e) {
      const rtt = Math.round(performance.now() - t0);
      if (pingEl) pingEl.innerText = `${Math.min(Math.max(rtt, 18), 45)} ms`;
    }
  };

  probePing();
  setInterval(probePing, 5000);
}

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
    showStatus("Please run the virtual node for a few seconds to accumulate points first!", "error");
    return;
  }
  const pts = state.nodePoints;
  const ctsBoost = Math.floor(pts / 10) || 5;

  document.getElementById("nodeModalPts").textContent = `${pts.toLocaleString()} Points`;
  document.getElementById("nodeModalBoost").textContent = `+${ctsBoost} CTS Points Credited`;

  playSoundEffect('success');
  openGameModal('nodeSyncModal');

  state.nodePoints = 0;
  document.getElementById("ext-points-display").innerText = "0";
  state.creditScore = Math.min(state.creditScore + ctsBoost, 850);
  updateScoreGauge(state.creditScore);
  showStatus(`⚡ Synchronized Virtual Node! +${ctsBoost} CTS Points credited on Creditcoin.`, "success");
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
