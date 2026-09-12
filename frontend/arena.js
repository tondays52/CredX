/**
 * PredictBay | CredX Reputation Arena Frontend Logic
 * Live canvas ticker, multi-asset markets, timeframe controls, stake multipliers & Web3 score sync.
 */

document.addEventListener('DOMContentLoaded', () => {

  // Assets config
  const ASSETS = {
    BTC: { name: 'BTC/USD', strike: 78444.52, current: 78418.95, icon: '₿', feed: 'Pyth Oracle · Crypto.BTC/USD', volatility: 8.5, decimals: 2 },
    ETH: { name: 'ETH/USD', strike: 2685.40, current: 2682.10, icon: 'Ξ', feed: 'Pyth Oracle · Crypto.ETH/USD', volatility: 1.2, decimals: 2 },
    GOLD: { name: 'XAU/USD', strike: 2652.80, current: 2651.90, icon: '🪙', feed: 'Pyth Oracle · Commodities.XAU/USD', volatility: 0.8, decimals: 2 },
    OIL: { name: 'WTI/USD', strike: 74.65, current: 74.50, icon: '🛢️', feed: 'Pyth Oracle · Commodities.WTI/USD', volatility: 0.15, decimals: 2 }
  };

  let activeAssetKey = 'BTC';

  // DOM Elements
  const livePriceDisplay = document.getElementById('livePriceDisplay');
  const strikeDiffDisplay = document.getElementById('strikeDiffDisplay');
  const countdownClock = document.getElementById('countdownClock');
  const roundTitleText = document.getElementById('roundTitleText');
  const roundDateText = document.getElementById('roundDateText');
  const strikeLineLabel = document.getElementById('strikeLineLabel');
  const ticketStrikeHint = document.getElementById('ticketStrikeHint');

  const assetIcon = document.getElementById('assetIcon');
  const assetPairName = document.getElementById('assetPairName');
  const assetFeedTag = document.getElementById('assetFeedTag');
  const assetPillsContainer = document.getElementById('assetPillsContainer');
  const timeframeGroup = document.getElementById('timeframeGroup');

  const paperBalanceDisplay = document.getElementById('paperBalanceDisplay');
  const streakBadge = document.getElementById('streakBadge');
  const syncScoreBtn = document.getElementById('syncScoreBtn');
  const toastMessage = document.getElementById('toastMessage');
  const historyChips = document.getElementById('historyChips');
  const connectWalletBtn = document.getElementById('connectWalletBtn');
  const resetBalanceBtn = document.getElementById('resetBalanceBtn');

  const btnPredictAbove = document.getElementById('btnPredictAbove');
  const btnPredictBelow = document.getElementById('btnPredictBelow');
  const stakeButtons = document.querySelectorAll('.stake-btn[data-stake]');
  const doubleStakeBtn = document.getElementById('doubleStakeBtn');
  const halfStakeBtn = document.getElementById('halfStakeBtn');
  const maxStakeBtn = document.getElementById('maxStakeBtn');
  const customStakeBtn = document.getElementById('customStakeBtn');

  const ratioFillAbove = document.getElementById('ratioFillAbove');
  const ratioFillBelow = document.getElementById('ratioFillBelow');
  const abovePct = document.getElementById('abovePct');
  const belowPct = document.getElementById('belowPct');

  // State
  let strikePrice = ASSETS[activeAssetKey].strike;
  let currentPrice = ASSETS[activeAssetKey].current;
  let selectedStake = 100;
  let paperBalance = 10000;
  let currentWinStreak = 0;
  let activePrediction = null; // { choice: 'ABOVE' | 'BELOW', stake: 100, placedPrice: price }
  let roundDuration = 60; // seconds
  let roundTimeRemaining = 60;
  let isConnected = false;

  // Chart Canvas & Price History
  const canvas = document.getElementById('predictionChart');
  const ctx = canvas.getContext('2d');
  let priceHistory = [];
  const MAX_HISTORY_POINTS = 50;

  // Initialize Price History
  function initPriceHistory() {
    const asset = ASSETS[activeAssetKey];
    strikePrice = asset.strike;
    currentPrice = asset.current;
    priceHistory = [];
    let p = strikePrice - (asset.volatility * 2);
    for (let i = 0; i < MAX_HISTORY_POINTS; i++) {
      p += (Math.random() - 0.49) * asset.volatility;
      priceHistory.push(p);
    }
    currentPrice = priceHistory[priceHistory.length - 1];
  }

  // Draw Smooth Canvas Chart
  function drawChart() {
    if (!canvas || !canvas.parentElement) return;
    const width = canvas.width = canvas.parentElement.clientWidth || 800;
    const height = canvas.height = canvas.parentElement.clientHeight || 340;

    ctx.clearRect(0, 0, width, height);

    const asset = ASSETS[activeAssetKey];
    const buffer = asset.volatility * 4;
    const minPrice = Math.min(...priceHistory, strikePrice - buffer);
    const maxPrice = Math.max(...priceHistory, strikePrice + buffer);
    const priceRange = maxPrice - minPrice || 1;

    const getY = (val) => height - ((val - minPrice) / priceRange) * (height - 60) - 30;
    const getX = (idx) => (idx / (MAX_HISTORY_POINTS - 1)) * width;

    // 1. Strike Line (Dashed)
    const strikeY = getY(strikePrice);
    ctx.beginPath();
    ctx.setLineDash([6, 6]);
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.moveTo(0, strikeY);
    ctx.lineTo(width, strikeY);
    ctx.stroke();
    ctx.setLineDash([]);

    // 2. Price Path & Gradient
    ctx.beginPath();
    ctx.moveTo(getX(0), getY(priceHistory[0]));

    for (let i = 1; i < priceHistory.length; i++) {
      const xc = (getX(i) + getX(i - 1)) / 2;
      const yc = (getY(priceHistory[i]) + getY(priceHistory[i - 1])) / 2;
      ctx.quadraticCurveTo(getX(i - 1), getY(priceHistory[i - 1]), xc, yc);
    }
    ctx.lineTo(getX(priceHistory.length - 1), getY(priceHistory[priceHistory.length - 1]));

    const isAbove = currentPrice >= strikePrice;
    const mainColor = isAbove ? '#10b981' : '#ef4444';

    ctx.strokeStyle = mainColor;
    ctx.lineWidth = 3;
    ctx.stroke();

    // Fill Gradient below curve
    ctx.lineTo(width, height);
    ctx.lineTo(0, height);
    ctx.closePath();

    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    if (isAbove) {
      gradient.addColorStop(0, 'rgba(16, 185, 129, 0.25)');
      gradient.addColorStop(1, 'rgba(16, 185, 129, 0.0)');
    } else {
      gradient.addColorStop(0, 'rgba(239, 68, 68, 0.25)');
      gradient.addColorStop(1, 'rgba(239, 68, 68, 0.0)');
    }
    ctx.fillStyle = gradient;
    ctx.fill();

    // 3. Pulsing Active Price Node
    const lastX = getX(priceHistory.length - 1);
    const lastY = getY(currentPrice);

    ctx.beginPath();
    ctx.arc(lastX, lastY, 6, 0, Math.PI * 2);
    ctx.fillStyle = mainColor;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(lastX, lastY, 12, 0, Math.PI * 2);
    ctx.strokeStyle = isAbove ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // Update Ticker & UI
  function updatePriceUI() {
    const asset = ASSETS[activeAssetKey];
    const diff = currentPrice - strikePrice;
    const isAbove = diff >= 0;

    livePriceDisplay.innerText = `$${currentPrice.toLocaleString('en-US', { minimumFractionDigits: asset.decimals, maximumFractionDigits: asset.decimals })}`;
    livePriceDisplay.className = `current-price-display ${isAbove ? 'positive' : ''}`;

    const sign = diff >= 0 ? '+' : '-';
    strikeDiffDisplay.innerText = `${sign}$${Math.abs(diff).toFixed(asset.decimals)} vs strike`;
    strikeDiffDisplay.className = `vs-strike-diff ${isAbove ? 'positive' : 'negative'}`;
  }

  // Price Fluctuation Simulation Loop
  function tickPrice() {
    const asset = ASSETS[activeAssetKey];
    const delta = (Math.random() - 0.49) * (asset.volatility / 2);
    const maxBound = strikePrice + (asset.volatility * 6);
    const minBound = strikePrice - (asset.volatility * 6);
    currentPrice = Math.max(minBound, Math.min(maxBound, currentPrice + delta));
    
    priceHistory.shift();
    priceHistory.push(currentPrice);

    updatePriceUI();
    drawChart();
  }

  // Countdown & Settlement Loop
  function tickCountdown() {
    if (roundTimeRemaining > 0) {
      roundTimeRemaining--;
    } else {
      resolveRound();
      startNewRound();
    }

    const mins = Math.floor(roundTimeRemaining / 60).toString().padStart(2, '0');
    const secs = (roundTimeRemaining % 60).toString().padStart(2, '0');
    countdownClock.innerText = `${mins}:${secs}`;
  }

  function resolveRound() {
    const isAboveWin = currentPrice >= strikePrice;
    const winningChoice = isAboveWin ? 'ABOVE' : 'BELOW';

    // Add outcome to history chips
    const chip = document.createElement('span');
    chip.className = `chip ${isAboveWin ? 'up' : 'down'}`;
    chip.innerText = isAboveWin ? '▲' : '▼';
    historyChips.prepend(chip);
    if (historyChips.children.length > 8) {
      historyChips.removeChild(historyChips.lastChild);
    }

    if (activePrediction) {
      if (activePrediction.choice === winningChoice) {
        const winPayout = activePrediction.stake * 2;
        paperBalance += winPayout;
        currentWinStreak++;
        showToast(`🎉 Round Won! +$${winPayout} Paper Points!`, 'success');
      } else {
        currentWinStreak = 0;
        showToast(`❌ Round Lost on ${activePrediction.choice}. Streak reset.`, 'error');
      }

      activePrediction = null;
      btnPredictAbove.classList.remove('active-bet');
      btnPredictBelow.classList.remove('active-bet');
      updateStatsUI();
    }
  }

  function startNewRound() {
    const asset = ASSETS[activeAssetKey];
    strikePrice = currentPrice;
    roundTimeRemaining = roundDuration;
    
    const formattedStrike = `$${strikePrice.toLocaleString('en-US', { minimumFractionDigits: asset.decimals, maximumFractionDigits: asset.decimals })}`;
    roundTitleText.textContent = "";
    roundTitleText.appendChild(document.createTextNode(`$${activeAssetKey} above ${formattedStrike} `));
    const dateSpan = document.createElement("span");
    dateSpan.className = "round-date";
    dateSpan.id = "roundDateText";
    dateSpan.textContent = "on Sep 9 UTC";
    roundTitleText.appendChild(dateSpan);
    strikeLineLabel.innerText = `STRIKE ${formattedStrike}`;
    ticketStrikeHint.innerText = `strike ${formattedStrike}`;

    // Randomize market ratio
    const rAbove = Math.floor(Math.random() * 30) + 35;
    const rBelow = 100 - rAbove;
    abovePct.innerText = `${rAbove}%`;
    belowPct.innerText = `${rBelow}%`;
    ratioFillAbove.style.width = `${rAbove}%`;
    ratioFillBelow.style.width = `${rBelow}%`;
  }

  function updateStatsUI() {
    paperBalanceDisplay.innerHTML = `PAPER <span class="balance-amt">$${paperBalance.toLocaleString('en-US')}</span>`;
    streakBadge.innerText = `🔥 Win Streak: ${currentWinStreak}`;

    if (currentWinStreak >= 3) {
      syncScoreBtn.disabled = false;
      syncScoreBtn.innerText = `Sync ${currentWinStreak}-Win Streak to Creditcoin (+25 CTS) ✦`;
      syncScoreBtn.style.background = 'linear-gradient(135deg, #10b981, #06b6d4)';
      syncScoreBtn.style.color = '#000';
      syncScoreBtn.style.cursor = 'pointer';
    } else {
      syncScoreBtn.disabled = true;
      syncScoreBtn.innerText = `Sync Streak to Creditcoin Score (Need ${3 - currentWinStreak} More Wins)`;
      syncScoreBtn.style.background = '';
      syncScoreBtn.style.color = '';
      syncScoreBtn.style.cursor = 'not-allowed';
    }
  }

  function showToast(msg, type) {
    toastMessage.innerText = msg;
    toastMessage.className = `toast-message ${type}`;
    setTimeout(() => {
      toastMessage.className = 'toast-message hidden';
    }, 4000);
  }

  // Asset Switcher
  assetPillsContainer.querySelectorAll('.asset-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      assetPillsContainer.querySelectorAll('.asset-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');

      activeAssetKey = pill.getAttribute('data-asset');
      const asset = ASSETS[activeAssetKey];

      assetIcon.innerText = asset.icon;
      assetPairName.innerText = asset.name;
      assetFeedTag.innerText = asset.feed;

      initPriceHistory();
      startNewRound();
      updatePriceUI();
      drawChart();
      showToast(`Switched market to ${asset.name}`, 'success');
    });
  });

  // Timeframe Switcher
  timeframeGroup.querySelectorAll('.timeframe-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      timeframeGroup.querySelectorAll('.timeframe-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      roundDuration = Number(btn.getAttribute('data-sec')) || 60;
      roundTimeRemaining = roundDuration;
      showToast(`Timeframe changed to ${btn.innerText}`, 'success');
    });
  });

  // Stake Buttons
  stakeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#stakeButtonsContainer .stake-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedStake = Number(btn.getAttribute('data-stake')) || 100;
    });
  });

  if (doubleStakeBtn) {
    doubleStakeBtn.addEventListener('click', () => {
      selectedStake = Math.min(paperBalance, selectedStake * 2);
      highlightCustomStake(`$${selectedStake}`);
    });
  }

  if (halfStakeBtn) {
    halfStakeBtn.addEventListener('click', () => {
      selectedStake = Math.max(1, Math.floor(selectedStake / 2));
      highlightCustomStake(`$${selectedStake}`);
    });
  }

  if (maxStakeBtn) {
    maxStakeBtn.addEventListener('click', () => {
      selectedStake = paperBalance;
      highlightCustomStake(`$${selectedStake}`);
    });
  }

  if (customStakeBtn) {
    customStakeBtn.addEventListener('click', () => {
      const val = prompt('Enter custom stake in Paper Points ($):', selectedStake);
      if (val && !isNaN(val) && Number(val) > 0) {
        selectedStake = Math.min(paperBalance, Number(val));
        highlightCustomStake(`$${selectedStake}`);
      }
    });
  }

  function highlightCustomStake(label) {
    document.querySelectorAll('#stakeButtonsContainer .stake-btn').forEach(b => b.classList.remove('active'));
    customStakeBtn.classList.add('active');
    customStakeBtn.innerText = label;
  }

  // Reset Balance
  if (resetBalanceBtn) {
    resetBalanceBtn.addEventListener('click', () => {
      paperBalance = 10000;
      currentWinStreak = 0;
      activePrediction = null;
      updateStatsUI();
      showToast('Paper balance reset to $10,000!', 'success');
    });
  }

  // Wallet Connect
  if (connectWalletBtn) {
    connectWalletBtn.addEventListener('click', () => {
      isConnected = !isConnected;
      if (isConnected) {
        connectWalletBtn.innerText = '0x742d...f44e (Connected)';
        connectWalletBtn.style.background = '#10b981';
        connectWalletBtn.style.color = '#000';
        showToast('Wallet connected to Creditcoin Testnet!', 'success');
      } else {
        connectWalletBtn.innerText = 'Connect Wallet';
        connectWalletBtn.style.background = '';
        connectWalletBtn.style.color = '';
        showToast('Wallet disconnected.', 'error');
      }
    });
  }

  // Decision Placement
  function placeBet(choice) {
    if (activePrediction) {
      showToast('You already have an active prediction in this round!', 'error');
      return;
    }
    if (paperBalance < selectedStake) {
      showToast('Insufficient Paper Points balance! Click Reset Balance.', 'error');
      return;
    }

    paperBalance -= selectedStake;
    activePrediction = { choice, stake: selectedStake, placedAt: Date.now() };

    if (choice === 'ABOVE') {
      btnPredictAbove.classList.add('active-bet');
    } else {
      btnPredictBelow.classList.add('active-bet');
    }

    updateStatsUI();
    showToast(`✓ Locked $${selectedStake} on ${choice}!`, 'success');
  }

  btnPredictAbove.addEventListener('click', () => placeBet('ABOVE'));
  btnPredictBelow.addEventListener('click', () => placeBet('BELOW'));

  // Keyboard Hotkeys
  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return;
    if (e.key === 'a' || e.key === 'A') {
      placeBet('ABOVE');
    } else if (e.key === 'b' || e.key === 'B') {
      placeBet('BELOW');
    }
  });

  // Audio Synthesizer for Arena
  function playArenaSound(type) {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      if (type === 'fanfare') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, ctx.currentTime);
        osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.12);
        osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.24);
        osc.frequency.setValueAtTime(1046.50, ctx.currentTime + 0.36);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.55);
        osc.start();
        osc.stop(ctx.currentTime + 0.55);
      }
    } catch (e) {}
  }

  // Sync to Creditcoin Score
  const arenaSyncModal = document.getElementById('arenaSyncModal');
  const closeArenaSyncModal = document.getElementById('closeArenaSyncModal');

  if (closeArenaSyncModal && arenaSyncModal) {
    closeArenaSyncModal.addEventListener('click', () => {
      arenaSyncModal.classList.remove('active');
    });
  }

  syncScoreBtn.addEventListener('click', async () => {
    if (currentWinStreak < 3) return;

    syncScoreBtn.innerText = 'Syncing Proof to Creditcoin Precompile 0x0FD2...';
    syncScoreBtn.disabled = true;

    setTimeout(() => {
      playArenaSound('fanfare');
      if (arenaSyncModal) {
        arenaSyncModal.classList.add('active');
      }
      showToast(`🏆 CredX Score Boosted! +25 CTS credited on Creditcoin Testnet.`, 'success');
      currentWinStreak = 0;
      updateStatsUI();
    }, 1000);
  });

  // Startup
  initPriceHistory();
  startNewRound();
  updatePriceUI();
  updateStatsUI();
  drawChart();

  // Active Loops
  setInterval(tickPrice, 800);
  setInterval(tickCountdown, 1000);
  window.addEventListener('resize', drawChart);
});
