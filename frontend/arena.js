/**
 * Predict Bay | CredX Reputation Arena Frontend Logic
 * Live canvas ticker, binary prediction resolution, win streaks & Web3 score sync.
 */

document.addEventListener('DOMContentLoaded', () => {

  // DOM Elements
  const livePriceDisplay = document.getElementById('livePriceDisplay');
  const strikeDiffDisplay = document.getElementById('strikeDiffDisplay');
  const countdownClock = document.getElementById('countdownClock');
  const roundTitleText = document.getElementById('roundTitleText');
  const roundDateText = document.getElementById('roundDateText');
  const strikeLineLabel = document.getElementById('strikeLineLabel');
  const ticketStrikeHint = document.getElementById('ticketStrikeHint');

  const paperBalanceDisplay = document.getElementById('paperBalanceDisplay');
  const streakBadge = document.getElementById('streakBadge');
  const syncScoreBtn = document.getElementById('syncScoreBtn');
  const toastMessage = document.getElementById('toastMessage');
  const historyChips = document.getElementById('historyChips');

  const btnPredictAbove = document.getElementById('btnPredictAbove');
  const btnPredictBelow = document.getElementById('btnPredictBelow');
  const stakeButtons = document.querySelectorAll('.stake-btn');

  const ratioFillAbove = document.getElementById('ratioFillAbove');
  const ratioFillBelow = document.getElementById('ratioFillBelow');
  const abovePct = document.getElementById('abovePct');
  const belowPct = document.getElementById('belowPct');

  // State
  let strikePrice = 78444.52;
  let currentPrice = 78418.95;
  let selectedStake = 100;
  let paperBalance = 10000;
  let currentWinStreak = 0;
  let activePrediction = null; // { choice: 'ABOVE' | 'BELOW', stake: 100, placedAt: timestamp }
  let roundDuration = 90; // seconds
  let roundTimeRemaining = 83; // starts at 01:23

  // Chart Canvas & Price History
  const canvas = document.getElementById('predictionChart');
  const ctx = canvas.getContext('2d');
  let priceHistory = [];
  const MAX_HISTORY_POINTS = 50;

  // Initialize Price History
  function initPriceHistory() {
    let p = strikePrice - 20;
    for (let i = 0; i < MAX_HISTORY_POINTS; i++) {
      p += (Math.random() - 0.52) * 8;
      priceHistory.push(p);
    }
    currentPrice = priceHistory[priceHistory.length - 1];
  }

  // Draw Smooth Canvas Chart
  function drawChart() {
    const width = canvas.width = canvas.parentElement.clientWidth;
    const height = canvas.height = canvas.parentElement.clientHeight;

    ctx.clearRect(0, 0, width, height);

    const minPrice = Math.min(...priceHistory, strikePrice - 40);
    const maxPrice = Math.max(...priceHistory, strikePrice + 40);
    const priceRange = maxPrice - minPrice || 1;

    const getY = (val) => height - ((val - minPrice) / priceRange) * (height - 60) - 30;
    const getX = (idx) => (idx / (MAX_HISTORY_POINTS - 1)) * width;

    // 1. Draw Strike Line (Dashed)
    const strikeY = getY(strikePrice);
    ctx.beginPath();
    ctx.setLineDash([6, 6]);
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.moveTo(0, strikeY);
    ctx.lineTo(width, strikeY);
    ctx.stroke();
    ctx.setLineDash([]);

    // 2. Draw Price Path & Gradient
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
      gradient.addColorStop(0, 'rgba(16, 185, 129, 0.2)');
      gradient.addColorStop(1, 'rgba(16, 185, 129, 0.0)');
    } else {
      gradient.addColorStop(0, 'rgba(239, 68, 68, 0.2)');
      gradient.addColorStop(1, 'rgba(239, 68, 68, 0.0)');
    }
    ctx.fillStyle = gradient;
    ctx.fill();

    // 3. Draw Pulsing Active Price Node
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
    const diff = currentPrice - strikePrice;
    const isAbove = diff >= 0;

    livePriceDisplay.innerText = `$${currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    livePriceDisplay.className = `current-price-display ${isAbove ? 'positive' : ''}`;

    const sign = diff >= 0 ? '+' : '-';
    strikeDiffDisplay.innerText = `${sign}$${Math.abs(diff).toFixed(2)} vs strike`;
    strikeDiffDisplay.className = `vs-strike-diff ${isAbove ? 'positive' : 'negative'}`;
  }

  // Price Fluctuation Simulation Loop
  function tickPrice() {
    const delta = (Math.random() - 0.49) * 4.5;
    currentPrice = Math.max(strikePrice - 100, Math.min(strikePrice + 100, currentPrice + delta));
    
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
      // Settle Round
      resolveRound();
      // Start New Round
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
        showToast(`❌ Round Lost. Streak reset.`, 'error');
      }

      activePrediction = null;
      updateStatsUI();
    }
  }

  function startNewRound() {
    strikePrice = currentPrice;
    roundTimeRemaining = roundDuration;
    
    const formattedStrike = `$${strikePrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    roundTitleText.innerHTML = `$BTC above ${formattedStrike} <span class="round-date">on Sep 9, 01:36 UTC</span>`;
    strikeLineLabel.innerText = `STRIKE ${strikePrice.toFixed(2)}`;
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
    } else {
      syncScoreBtn.disabled = true;
      syncScoreBtn.innerText = `Sync Streak to Creditcoin Score (Need 3 Wins)`;
    }
  }

  function showToast(msg, type) {
    toastMessage.innerText = msg;
    toastMessage.className = `toast-message ${type}`;
    setTimeout(() => {
      toastMessage.className = 'toast-message hidden';
    }, 4000);
  }

  // Stake Buttons
  stakeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      stakeButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedStake = Number(btn.getAttribute('data-stake')) || 100;
    });
  });

  // Decision Placement
  function placeBet(choice) {
    if (activePrediction) {
      showToast('You already have an active prediction in this round!', 'error');
      return;
    }
    if (paperBalance < selectedStake) {
      showToast('Insufficient Paper Points balance!', 'error');
      return;
    }

    paperBalance -= selectedStake;
    activePrediction = { choice, stake: selectedStake, placedAt: Date.now() };
    updateStatsUI();

    showToast(`✓ Placed $${selectedStake} on ${choice}!`, 'success');
  }

  btnPredictAbove.addEventListener('click', () => placeBet('ABOVE'));
  btnPredictBelow.addEventListener('click', () => placeBet('BELOW'));

  // Keyboard Hotkeys
  window.addEventListener('keydown', (e) => {
    if (e.key === 'a' || e.key === 'A') {
      placeBet('ABOVE');
    } else if (e.key === 'b' || e.key === 'B') {
      placeBet('BELOW');
    }
  });

  // Sync to Creditcoin Score
  syncScoreBtn.addEventListener('click', async () => {
    if (currentWinStreak < 3) return;

    syncScoreBtn.innerText = 'Syncing to Creditcoin...';
    syncScoreBtn.disabled = true;

    setTimeout(() => {
      showToast(`🏆 CredX Score Boosted! +25 CTS credited on Creditcoin Testnet.`, 'success');
      currentWinStreak = 0;
      updateStatsUI();
    }, 1500);
  });

  // Startup
  initPriceHistory();
  updatePriceUI();
  updateStatsUI();
  drawChart();

  // Active Loops
  setInterval(tickPrice, 800);
  setInterval(tickCountdown, 1000);
  window.addEventListener('resize', drawChart);
});
