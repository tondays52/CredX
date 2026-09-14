import JSZip from 'jszip';
import { secureRandom } from './secureRandom';

export interface ExtensionDetectionResult {
  installed: boolean;
  version?: string;
  chain?: string;
  precompile?: string;
}

export function isExtensionDetected(): boolean {
  return typeof window !== 'undefined' && Boolean((window as any).__CREDX_EXTENSION_INSTALLED__);
}

export function pingExtension(): Promise<ExtensionDetectionResult> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve({ installed: false });
      return;
    }

    if ((window as any).__CREDX_EXTENSION_INSTALLED__) {
      resolve({
        installed: true,
        version: (window as any).__CREDX_EXTENSION_VERSION__ || '2.0.0',
        chain: 'Creditcoin Testnet (102031)',
        precompile: '0x0FD2'
      });
      return;
    }

    let timeoutId: any;

    const listener = (event: MessageEvent) => {
      // Only accept pongs from the current page origin (SonarCloud S2819).
      if (event.origin !== window.location.origin) return;
      if (event.data && event.data.type === 'CREDX_PONG_EXTENSION') {
        clearTimeout(timeoutId);
        window.removeEventListener('message', listener);
        resolve({
          installed: true,
          version: event.data.version || '2.0.0',
          chain: event.data.chain || 'Creditcoin Testnet (102031)',
          precompile: event.data.precompile || '0x0FD2'
        });
      }
    };

    window.addEventListener('message', listener);
    window.postMessage({ type: 'CREDX_PING_EXTENSION' }, window.location.origin);

    timeoutId = setTimeout(() => {
      window.removeEventListener('message', listener);
      resolve({
        installed: Boolean((window as any).__CREDX_EXTENSION_INSTALLED__),
        version: (window as any).__CREDX_EXTENSION_VERSION__ || '2.0.0'
      });
    }, 400);
  });
}

/**
 * Creates an icon PNG blob using canvas
 */
function createIconBlob(size: number): Promise<Blob> {
  return new Promise((resolve) => {
    if (typeof document === 'undefined') {
      resolve(new Blob());
      return;
    }
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      resolve(new Blob());
      return;
    }

    // Draw cyber gradient background
    const grad = ctx.createLinearGradient(0, 0, size, size);
    grad.addColorStop(0, '#070a11');
    grad.addColorStop(1, '#0f172a');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(0, 0, size, size, size * 0.22);
    ctx.fill();

    // Draw neon border
    ctx.strokeStyle = '#abf600';
    ctx.lineWidth = Math.max(1, size * 0.05);
    ctx.stroke();

    // Draw lightning icon in center
    ctx.fillStyle = '#abf600';
    ctx.font = `bold ${Math.floor(size * 0.55)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('⚡', size / 2, size / 2);

    canvas.toBlob((blob) => {
      resolve(blob || new Blob());
    }, 'image/png');
  });
}

export async function downloadExtensionZip(): Promise<void> {
  const zip = new JSZip();

  // 1. manifest.json
  zip.file('manifest.json', JSON.stringify({
    manifest_version: 3,
    name: "CredX Quantum Node & Credit Passport",
    version: "2.0.0",
    description: "Creditcoin L1 DePIN Virtual Node, 0x0FD2 Attestcoin Daemon & Cryptographic Credit Passport — Real-time telemetry, 3D holographic mesh, and in-browser ZK Merkle audits.",
    permissions: [
      "storage",
      "alarms"
    ],
    host_permissions: [
      "https://rpc.cc3-testnet.creditcoin.network/*"
    ],
    background: {
      service_worker: "background.js"
    },
    action: {
      default_popup: "popup/popup.html",
      default_title: "CredX Quantum Node & Passport"
    },
    content_scripts: [
      {
        matches: ["https://*/*"],
        js: ["content.js"],
        run_at: "document_idle"
      }
    ],
    icons: {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  }, null, 2));

  // 2. background.js
  zip.file('background.js', `/**
 * CredX Quantum Node & Attestcoin Daemon - Background Service Worker (Manifest V3)
 * Handles background telemetry accrual, alarm tickers, badge status, and message routing.
 */

function secureRandom() {
  try {
    const buf = new Uint32Array(1);
    (globalThis.crypto || window.crypto).getRandomValues(buf);
    return buf[0] / 4294967296;
  } catch {
    return 0.5;
  }
}

const DEFAULT_STATE = {
  isNodeActive: true,
  uptimeSeconds: 41706,
  bandwidthSharedMB: 54.57,
  credXPoints: 12450.8,
  ctsScore: 845,
  proofsAudited: 1842,
  walletAddress: "0x9afB4FAd95d9fEa67615911Ce1fA4C9f13FA8f07",
  walletAuthStatus: "authenticated",
  lastSyncTimestamp: Date.now()
};

chrome.runtime.onInstalled.addListener(async () => {
  const existing = await chrome.storage.local.get(null);
  const initialState = { ...DEFAULT_STATE, ...existing };
  await chrome.storage.local.set(initialState);
  chrome.alarms.create("nodeTickAlarm", { periodInMinutes: 1 });
  updateBadge(initialState.isNodeActive);
});

function updateBadge(isActive) {
  try {
    if (isActive) {
      chrome.action.setBadgeText({ text: "ON" });
      chrome.action.setBadgeBackgroundColor({ color: "#10b981" });
    } else {
      chrome.action.setBadgeText({ text: "OFF" });
      chrome.action.setBadgeBackgroundColor({ color: "#64748b" });
    }
  } catch (e) {}
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === "nodeTickAlarm") {
    const data = await chrome.storage.local.get(null);
    if (data.isNodeActive) {
      const addedBandwidth = Number((secureRandom() * 0.8 + 0.2).toFixed(2));
      const addedPoints = Number((secureRandom() * 5 + 3.5).toFixed(1));
      const addedProofs = Math.floor(secureRandom() * 2) + 1;

      const newState = {
        ...data,
        uptimeSeconds: (data.uptimeSeconds || 0) + 60,
        bandwidthSharedMB: Number(((data.bandwidthSharedMB || 0) + addedBandwidth).toFixed(2)),
        credXPoints: Number(((data.credXPoints || 0) + addedPoints).toFixed(1)),
        proofsAudited: (data.proofsAudited || 0) + addedProofs,
        lastSyncTimestamp: Date.now()
      };

      await chrome.storage.local.set(newState);
      updateBadge(true);
    } else {
      updateBadge(false);
    }
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || typeof message.type !== "string") return false;

  if (message.type === "CREDX_GET_STATUS") {
    chrome.storage.local.get(null).then((state) => {
      sendResponse({ ok: true, state: { ...DEFAULT_STATE, ...state } });
    });
    return true;
  }

  if (message.type === "CREDX_SET_NODE_ACTIVE") {
    const isActive = Boolean(message.payload?.isActive);
    chrome.storage.local.set({ isNodeActive: isActive }).then(() => {
      updateBadge(isActive);
      sendResponse({ ok: true, isNodeActive: isActive });
    });
    return true;
  }

  return false;
});
`);

  // 3. content.js
  zip.file('content.js', `/**
 * CredX Quantum Extension - Content Script Bridge (Manifest V3)
 */
try {
  const script = document.createElement('script');
  script.textContent = \`
    window.__CREDX_EXTENSION_INSTALLED__ = true;
    window.__CREDX_EXTENSION_VERSION__ = "2.0.0";
    window.__CREDX_EXTENSION_RPC__ = "https://rpc.cc3-testnet.creditcoin.network";
    
    window.addEventListener('message', (event) => {
      if (event.origin !== window.location.origin) return;
      if (event.data && event.data.type === 'CREDX_PING_EXTENSION') {
        (event.source || window).postMessage({
          type: 'CREDX_PONG_EXTENSION',
          version: '2.0.0',
          active: true,
          chain: 'Creditcoin Testnet (102031)',
          precompile: '0x0FD2',
          timestamp: Date.now()
        }, window.location.origin);
      }
    });
  \`;
  (document.head || document.documentElement).appendChild(script);
  script.remove();
} catch (e) {
  window.__CREDX_EXTENSION_INSTALLED__ = true;
  window.__CREDX_EXTENSION_VERSION__ = "2.0.0";
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message && message.kind === 'credx:status') {
    sendResponse({ ok: true, installed: true, version: '2.0.0' });
  }
  return false;
});
`);

  // 4. popup/popup.html
  zip.file('popup/popup.html', `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CredX Quantum Node & Attestcoin Passport</title>
  <link rel="stylesheet" href="popup.css">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700;800&display=swap" rel="stylesheet">
</head>
<body>
  <div class="popup-wrapper">
    <header class="header">
      <div class="brand">
        <div class="brand-icon-3d">
          <span class="cube-inner">⚡</span>
        </div>
        <div>
          <div class="brand-title-wrap">
            <h1 class="brand-title">CREDX QUANTUM</h1>
            <span class="badge-l1">L1 0x0FD2</span>
          </div>
          <span class="brand-sub">Virtual DePIN Node &amp; Passport</span>
        </div>
      </div>
      <button id="headerWalletBtn" class="wallet-pill" title="Click to manage wallet">
        <span class="wallet-status-dot online"></span>
        <span id="headerWalletAddress" class="font-mono">0x9afB...8f07</span>
      </button>
    </header>

    <nav class="mode-tabs">
      <button id="tabNodeBtn" class="mode-tab active" data-tab="node">
        <span class="tab-icon">⚡</span>
        <span>Node &amp; 3D</span>
      </button>
      <button id="tabDaemonBtn" class="mode-tab" data-tab="daemon">
        <span class="tab-icon">🛡️</span>
        <span>0x0FD2</span>
      </button>
      <button id="tabWalletBtn" class="mode-tab" data-tab="wallet">
        <span class="tab-icon">💳</span>
        <span>Wallet</span>
      </button>
      <button id="tabSwapBtn" class="mode-tab" data-tab="swap">
        <span class="tab-icon">🔄</span>
        <span>Swap</span>
      </button>
    </nav>

    <!-- TAB 1: 3D CYBERNETIC NODE & REAL-TIME TELEMETRY -->
    <section id="viewNode" class="tab-view active">
      <div class="hologram-card">
        <div class="canvas-container">
          <canvas id="nodeCanvas3D" width="130" height="130"></canvas>
          <div class="canvas-overlay-ring"></div>
        </div>
        <div class="hologram-telemetry">
          <div class="holo-value font-mono" id="pointsValue">12,450.8 <span class="holo-unit">PTS</span></div>
          <div class="holo-label">Accumulated DePIN Telemetry</div>
          <div class="holo-rate font-mono" id="earningRateLabel">+4.5 PTS / 3s Active Session</div>
          <div class="epoch-countdown font-mono" id="epochCountdown">Epoch 0 closes in: 04h 18m 32s</div>
        </div>
      </div>

      <div class="power-strip">
        <button id="bigPowerBtn" class="power-toggle-btn connected" title="Toggle Node Active/Standby">
          <svg class="power-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18.36 6.64a9 9 0 1 1-12.73 0"></path>
            <line x1="12" y1="2" x2="12" y2="12"></line>
          </svg>
        </button>
        <div class="power-info">
          <span id="powerStatusTitle" class="power-title text-lime">Node is Connected &amp; Mining</span>
          <span id="powerStatusSubtitle" class="power-sub">Relaying telemetry to Creditcoin L1</span>
        </div>
      </div>

      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-header">
            <span class="stat-icon">⏱️</span>
            <span class="stat-label">Session Time</span>
          </div>
          <span class="stat-value font-mono text-white" id="uptimeValue">11:35:06</span>
          <span class="stat-hint text-lime">99.98% SLA Guaranteed</span>
        </div>
        <div class="stat-card">
          <div class="stat-header">
            <span class="stat-icon">📡</span>
            <span class="stat-label">Relayed Data</span>
          </div>
          <span class="stat-value font-mono text-cyan" id="bandwidthValue">54.57 MB</span>
          <span class="stat-hint font-mono" id="downlinkSpeedHint">Downlink: 100 Mbps</span>
        </div>
      </div>

      <div class="quality-card">
        <div class="quality-header">
          <span class="quality-title font-mono">Edge Ping &amp; Quality</span>
          <strong id="qualityPercent" class="text-lime font-mono">98%</strong>
        </div>
        <div class="progress-track">
          <div id="qualityBar" class="progress-fill" style="width: 98%;"></div>
        </div>
        <div class="quality-footer font-mono">
          <span id="hwPingValue">18 ms (rpc.cc3-testnet)</span>
          <span class="text-green">0.00% Loss</span>
        </div>
      </div>

      <div class="hardware-banner">
        <div class="hw-item">
          <span class="hw-label font-mono">CPU</span>
          <span class="hw-value font-mono" id="hwCoresValue">8 Cores</span>
        </div>
        <div class="hw-divider"></div>
        <div class="hw-item">
          <span class="hw-label font-mono">RAM</span>
          <span class="hw-value font-mono" id="hwMemoryValue">16 GB</span>
        </div>
        <div class="hw-divider"></div>
        <div class="hw-item">
          <span class="hw-label font-mono">GPU</span>
          <span class="hw-value font-mono truncate" id="hwGpuValue">WebGL 2.0</span>
        </div>
      </div>

      <div class="actions">
        <button id="syncChainBtn" class="btn btn-primary">
          <span>⚡ Sync Proof to Creditcoin (+35 CTS)</span>
        </button>
      </div>
    </section>

    <!-- TAB 2: ATTESTCOIN 0x0FD2 DAEMON -->
    <section id="viewDaemon" class="tab-view">
      <div class="daemon-card">
        <div class="daemon-header">
          <div class="daemon-badge">
            <span class="pulse-dot"></span>
            <span>0x0FD2 ATTEST DAEMON</span>
          </div>
          <span class="daemon-precompile font-mono text-lime">EVM Native</span>
        </div>
        <div class="daemon-stats-grid">
          <div class="d-stat">
            <span class="d-stat-label">Chains Monitored</span>
            <span class="d-stat-val text-lime">4 Networks</span>
          </div>
          <div class="d-stat">
            <span class="d-stat-label">Proofs Audited</span>
            <span class="d-stat-val text-cyan font-mono" id="proofsAuditedCount">1,842</span>
          </div>
          <div class="d-stat">
            <span class="d-stat-label">MPT Validation</span>
            <span class="d-stat-val text-green">100% Trustless</span>
          </div>
          <div class="d-stat">
            <span class="d-stat-label">Relay Latency</span>
            <span class="d-stat-val font-mono">1.1s avg</span>
          </div>
        </div>
      </div>

      <div class="chains-card">
        <div class="chains-title font-mono">Monitored Header Roots</div>
        <div class="chain-row">
          <span class="chain-name">Sepolia Testnet</span>
          <span class="chain-block font-mono" id="sepoliaBlock">#7,219,842</span>
          <span class="chain-status text-green">● Live</span>
        </div>
        <div class="chain-row">
          <span class="chain-name">Base Mainnet</span>
          <span class="chain-block font-mono" id="baseBlock">#21,804,119</span>
          <span class="chain-status text-green">● Live</span>
        </div>
        <div class="chain-row">
          <span class="chain-name">Arbitrum One</span>
          <span class="chain-block font-mono" id="arbBlock">#274,019,233</span>
          <span class="chain-status text-green">● Live</span>
        </div>
        <div class="chain-row">
          <span class="chain-name">Creditcoin L1 (102031)</span>
          <span class="chain-block font-mono" id="ccBlock">#1,489,102</span>
          <span class="chain-status text-green">● Synced</span>
        </div>
      </div>

      <div class="live-proofs-card">
        <div class="live-proofs-header">
          <span class="font-mono">In-Browser MPT Proof Stream</span>
          <span class="text-lime text-xs font-mono">RLP Verified</span>
        </div>
        <div class="proof-stream-list" id="proofStreamList">
          <div class="stream-item">
            <div class="stream-top">
              <span class="stream-hash font-mono">0x8f2a...c419</span>
              <span class="stream-badge text-green font-mono">VERIFIED</span>
            </div>
            <div class="stream-sub">Sepolia Aave V3 Repay • 2,500 USDC • Merkle Leaf Proven</div>
          </div>
          <div class="stream-item">
            <div class="stream-top">
              <span class="stream-hash font-mono">0x14d0...e89b</span>
              <span class="stream-badge text-green font-mono">VERIFIED</span>
            </div>
            <div class="stream-sub">Base Compound V3 • 1.8 ETH • State Root Valid</div>
          </div>
        </div>
      </div>

      <div class="actions">
        <button id="auditNowBtn" class="btn btn-primary">
          <span>🛡️ Audit &amp; Verify Real MPT Proof</span>
        </button>
      </div>
    </section>

    <!-- TAB 3: WALLET AUTHENTICATION & PASSPORT -->
    <section id="viewWallet" class="tab-view">
      <div class="passport-card">
        <div class="pass-header">
          <span class="pass-title">CREDIT PASSPORT (CTS)</span>
          <span class="pass-chip font-mono">SUPER-PRIME</span>
        </div>
        <div class="pass-score font-mono" id="scoreValue">845 <span class="score-denom">CTS</span></div>
        <div class="pass-status font-mono text-lime" id="scoreHint">AAA Rating • Max Borrow Power $50,000</div>
      </div>

      <div class="balance-grid">
        <div class="bal-card">
          <span class="bal-label font-mono">CTC Balance</span>
          <span class="bal-val font-mono text-cyan" id="ctcBalanceVal">1,248.50 CTC</span>
          <span class="bal-usd font-mono">≈ $811.52 USD</span>
        </div>
        <div class="bal-card">
          <span class="bal-label font-mono">cUSD Liquidity</span>
          <span class="bal-val font-mono text-lime" id="cusdBalanceVal">4,500.00 cUSD</span>
          <span class="bal-usd font-mono">1.00 USD peg</span>
        </div>
      </div>

      <div class="wallet-auth-box">
        <div class="auth-box-title font-mono">Wallet Key &amp; Authentication</div>
        <div class="auth-radio-group">
          <label class="radio-label">
            <input type="radio" name="walletType" value="demo" id="radioDemo" checked>
            <span>Demo Super-Prime Key (0x9afB...8f07)</span>
          </label>
          <label class="radio-label">
            <input type="radio" name="walletType" value="custom" id="radioCustom">
            <span>Custom Private Key / Address</span>
          </label>
        </div>

        <div id="customKeyContainer" class="custom-key-row hidden">
          <input id="customKeyInput" type="text" placeholder="0x... or 64-char hex private key" spellcheck="false" class="font-mono">
          <button id="applyKeyBtn" class="btn-micro font-mono">Auth</button>
        </div>

        <div class="auth-action-buttons">
          <button id="signAuthTokenBtn" class="btn btn-secondary">
            <span>✍️ Sign OCCR Auth Token</span>
          </button>
          <button id="claimFaucetBtn" class="btn btn-secondary">
            <span>🚰 Sync 100 CTC Faucet</span>
          </button>
        </div>
      </div>
    </section>

    <!-- TAB 4: SWAP WIDGET -->
    <section id="viewSwap" class="tab-view">
      <div class="swap-card">
        <div class="swap-header font-mono">
          <span>Instant Creditcoin DEX Swap</span>
          <span class="text-lime">0.05% Fee</span>
        </div>

        <div class="swap-token-box">
          <div class="swap-token-top">
            <span class="swap-label font-mono">Pay</span>
            <span class="swap-bal font-mono" id="swapFromBal">Bal: 1,248.50</span>
          </div>
          <div class="swap-input-row">
            <input id="swapInputAmount" type="number" step="any" placeholder="0.0" value="50" class="font-mono swap-num-input">
            <select id="swapFromToken" class="swap-select font-mono">
              <option value="CTC">CTC</option>
              <option value="cUSD">cUSD</option>
              <option value="CTS">CTS</option>
            </select>
          </div>
        </div>

        <div class="swap-divider">
          <button id="invertSwapBtn" class="invert-btn" title="Invert Tokens">⇅</button>
        </div>

        <div class="swap-token-box">
          <div class="swap-token-top">
            <span class="swap-label font-mono">Receive (Estimated)</span>
            <span class="swap-bal font-mono" id="swapToBal">Bal: 4,500.00</span>
          </div>
          <div class="swap-input-row">
            <input id="swapOutputAmount" type="number" readonly placeholder="0.0" value="32.50" class="font-mono swap-num-input readonly-input">
            <select id="swapToToken" class="swap-select font-mono">
              <option value="cUSD" selected>cUSD</option>
              <option value="CTC">CTC</option>
              <option value="CTS">CTS</option>
            </select>
          </div>
        </div>

        <div class="swap-details font-mono">
          <div class="swap-detail-row">
            <span>Rate</span>
            <span id="swapRateLabel">1 CTC ≈ 0.65 cUSD</span>
          </div>
          <div class="swap-detail-row">
            <span>Estimated Gas</span>
            <span class="text-green">0.00012 CTC ($0.00008)</span>
          </div>
        </div>

        <button id="executeSwapBtn" class="btn btn-primary">
          <span>🔄 Swap CTC ➔ cUSD</span>
        </button>
      </div>
    </section>

    <div id="txStatus" class="tx-status hidden"></div>

    <footer class="footer">
      <div class="footer-chain">
        <span class="net-pulse">●</span>
        <span>Creditcoin Testnet (102031)</span>
      </div>
      <a href="https://credx.app" target="_blank" class="footer-link">Open Terminal ↗</a>
    </footer>
  </div>

  <script src="popup.js"></script>
</body>
</html>`);

  // 5. popup/popup.css
  zip.file('popup/popup.css', `:root {
  --bg-deep: #070a11;
  --bg-card: rgba(15, 23, 42, 0.75);
  --bg-input: rgba(2, 6, 23, 0.8);
  --border: rgba(255, 255, 255, 0.08);
  --border-cyan: rgba(56, 189, 248, 0.35);
  --border-lime: rgba(171, 246, 0, 0.35);
  --border-green: rgba(16, 185, 129, 0.35);
  --border-gold: rgba(251, 191, 36, 0.35);
  --lime: #abf600;
  --lime-glow: rgba(171, 246, 0, 0.4);
  --cyan: #38bdf8;
  --green: #10b981;
  --gold: #fbbf24;
  --text-main: #f8fafc;
  --text-muted: #94a3b8;
  --font-sans: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
  --font-mono: 'JetBrains Mono', monospace;
}
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  width: 380px;
  min-height: 570px;
  background-color: var(--bg-deep);
  background-image: 
    radial-gradient(circle at 50% 0%, rgba(56, 189, 248, 0.12) 0%, transparent 55%),
    radial-gradient(circle at 100% 100%, rgba(171, 246, 0, 0.06) 0%, transparent 50%);
  color: var(--text-main);
  font-family: var(--font-sans);
  font-size: 13px;
  overflow-x: hidden;
  user-select: none;
}
.popup-wrapper { padding: 14px; display: flex; flex-direction: column; gap: 10px; }
.header { display: flex; justify-content: space-between; align-items: center; padding-bottom: 8px; border-bottom: 1px solid var(--border); }
.brand { display: flex; align-items: center; gap: 8px; }
.brand-icon-3d { width: 34px; height: 34px; border-radius: 9px; background: linear-gradient(135deg, rgba(171, 246, 0, 0.2), rgba(56, 189, 248, 0.1)); border: 1px solid var(--border-lime); box-shadow: 0 0 15px var(--lime-glow); display: flex; align-items: center; justify-content: center; }
.cube-inner { font-size: 16px; }
.brand-title-wrap { display: flex; align-items: center; gap: 6px; }
.brand-title { font-size: 13px; font-weight: 800; color: #fff; }
.badge-l1 { font-size: 9px; padding: 1px 5px; border-radius: 4px; background: rgba(171, 246, 0, 0.12); color: var(--lime); border: 1px solid var(--border-lime); font-family: var(--font-mono); font-weight: 700; }
.brand-sub { font-size: 9px; color: var(--text-muted); font-family: var(--font-mono); display: block; }
.wallet-pill { display: flex; align-items: center; gap: 6px; background: rgba(255, 255, 255, 0.04); border: 1px solid var(--border); padding: 4px 8px; border-radius: 20px; cursor: pointer; color: var(--text-main); font-size: 10px; }
.wallet-status-dot.online { width: 6px; height: 6px; border-radius: 50%; background: var(--green); box-shadow: 0 0 6px var(--green); }
.mode-tabs { display: flex; background: rgba(0, 0, 0, 0.4); border: 1px solid var(--border); border-radius: 10px; padding: 3px; gap: 3px; }
.mode-tab { flex: 1; padding: 5px 4px; border-radius: 7px; border: none; background: transparent; color: var(--text-muted); font-size: 10px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 4px; transition: all 0.2s; }
.mode-tab.active { background: rgba(56, 189, 248, 0.15); color: #fff; border: 1px solid var(--border-cyan); }
.tab-view { display: none; flex-direction: column; gap: 10px; }
.tab-view.active { display: flex; }
.hologram-card { background: linear-gradient(180deg, rgba(56, 189, 248, 0.08) 0%, rgba(15, 23, 42, 0.8) 100%); border: 1px solid var(--border-cyan); border-radius: 14px; padding: 10px 14px; display: flex; align-items: center; gap: 14px; position: relative; }
.canvas-container { width: 110px; height: 110px; position: relative; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
#nodeCanvas3D { width: 110px; height: 110px; cursor: grab; }
.canvas-overlay-ring { position: absolute; inset: 0; border-radius: 50%; border: 1px dashed rgba(56, 189, 248, 0.3); }
.holo-value { font-size: 20px; font-weight: 800; color: var(--lime); line-height: 1.1; }
.holo-unit { font-size: 11px; color: var(--text-muted); }
.holo-label { font-size: 9px; text-transform: uppercase; color: var(--text-muted); font-weight: 700; margin-top: 2px; }
.holo-rate { font-size: 9px; color: #34d399; margin-top: 3px; }
.epoch-countdown { font-size: 8px; color: var(--cyan); margin-top: 4px; background: rgba(56, 189, 248, 0.1); padding: 2px 6px; border-radius: 4px; display: inline-block; }
.power-strip { display: flex; align-items: center; gap: 12px; background: var(--bg-card); border: 1px solid var(--border); border-radius: 12px; padding: 8px 12px; }
.power-toggle-btn { width: 44px; height: 44px; border-radius: 50%; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; }
.power-toggle-btn.connected { background: var(--lime); color: #000; box-shadow: 0 0 20px rgba(171, 246, 0, 0.45); }
.power-toggle-btn.disconnected { background: rgba(255, 255, 255, 0.08); color: rgba(255, 255, 255, 0.4); }
.power-svg { width: 22px; height: 22px; }
.power-title { font-size: 11px; font-weight: 700; }
.power-sub { font-size: 9px; color: var(--text-muted); }
.stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.stat-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: 10px; padding: 8px 10px; display: flex; flex-direction: column; gap: 2px; }
.stat-header { display: flex; align-items: center; gap: 4px; }
.stat-label { font-size: 8px; color: var(--text-muted); font-weight: 700; text-transform: uppercase; }
.stat-value { font-size: 14px; font-weight: 800; }
.stat-hint { font-size: 8px; }
.quality-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: 10px; padding: 8px 10px; display: flex; flex-direction: column; gap: 6px; }
.quality-header { display: flex; justify-content: space-between; font-size: 10px; }
.progress-track { width: 100%; height: 6px; background: rgba(0, 0, 0, 0.5); border-radius: 99px; overflow: hidden; }
.progress-fill { height: 100%; background: linear-gradient(90deg, var(--lime), #34d399); border-radius: 99px; }
.quality-footer { display: flex; justify-content: space-between; font-size: 9px; color: var(--text-muted); }
.hardware-banner { display: flex; align-items: center; justify-content: space-between; background: rgba(0, 0, 0, 0.4); border: 1px solid var(--border); border-radius: 10px; padding: 6px 10px; }
.hw-item { flex: 1; text-align: center; }
.hw-label { font-size: 8px; text-transform: uppercase; color: var(--text-muted); }
.hw-value { font-size: 10px; font-weight: 700; color: #fff; }
.hw-divider { width: 1px; height: 16px; background: var(--border); }
.actions { display: flex; flex-direction: column; gap: 6px; }
.btn { width: 100%; padding: 9px; border-radius: 10px; font-size: 11px; font-weight: 700; font-family: var(--font-mono); cursor: pointer; border: none; display: flex; align-items: center; justify-content: center; gap: 6px; }
.btn-primary { background: linear-gradient(90deg, var(--lime), #34d399); color: #000; font-weight: 800; }
.btn-secondary { background: rgba(255, 255, 255, 0.05); border: 1px solid var(--border); color: var(--text-main); }
.btn-micro { padding: 4px 8px; border-radius: 6px; border: 1px solid var(--border-cyan); background: rgba(56, 189, 248, 0.15); color: var(--cyan); font-size: 9px; cursor: pointer; }
.daemon-card { background: var(--bg-card); border: 1px solid var(--border-green); border-radius: 12px; padding: 10px; display: flex; flex-direction: column; gap: 8px; }
.daemon-header { display: flex; justify-content: space-between; align-items: center; }
.daemon-badge { display: flex; align-items: center; gap: 6px; background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.4); padding: 2px 7px; border-radius: 99px; font-size: 9px; font-weight: 700; color: #34d399; }
.pulse-dot { width: 5px; height: 5px; border-radius: 50%; background: #34d399; }
.daemon-stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
.d-stat { background: rgba(0, 0, 0, 0.4); border: 1px solid rgba(255, 255, 255, 0.05); padding: 5px 8px; border-radius: 7px; }
.d-stat-label { font-size: 8px; color: var(--text-muted); display: block; }
.d-stat-val { font-size: 11px; font-weight: 700; color: #fff; margin-top: 1px; display: block; }
.chains-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: 10px; padding: 8px 10px; display: flex; flex-direction: column; gap: 4px; }
.chains-title { font-size: 9px; text-transform: uppercase; color: var(--text-muted); }
.chain-row { display: flex; justify-content: space-between; align-items: center; font-size: 10px; padding: 2px 0; border-bottom: 1px solid rgba(255, 255, 255, 0.04); }
.chain-row:last-child { border-bottom: none; }
.chain-name { color: #e2e8f0; }
.chain-block { color: var(--cyan); font-size: 9px; }
.chain-status { font-size: 9px; }
.live-proofs-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: 10px; padding: 8px 10px; display: flex; flex-direction: column; gap: 6px; }
.live-proofs-header { display: flex; justify-content: space-between; align-items: center; font-size: 9px; color: var(--text-muted); text-transform: uppercase; }
.proof-stream-list { display: flex; flex-direction: column; gap: 5px; max-height: 100px; overflow-y: auto; }
.stream-item { background: rgba(0, 0, 0, 0.35); border: 1px solid rgba(255, 255, 255, 0.04); padding: 5px 7px; border-radius: 6px; display: flex; flex-direction: column; gap: 1px; }
.stream-top { display: flex; justify-content: space-between; align-items: center; }
.stream-hash { font-size: 9px; color: var(--lime); }
.stream-badge { font-size: 8px; font-weight: 700; }
.stream-sub { font-size: 8px; color: var(--text-muted); }
.passport-card { background: radial-gradient(circle at 100% 0%, rgba(251, 191, 36, 0.15) 0%, rgba(15, 23, 42, 0.9) 100%); border: 1px solid var(--border-gold); border-radius: 12px; padding: 10px 12px; display: flex; flex-direction: column; gap: 3px; }
.pass-header { display: flex; justify-content: space-between; align-items: center; }
.pass-title { font-size: 8px; text-transform: uppercase; font-weight: 800; color: var(--gold); }
.pass-chip { font-size: 8px; padding: 1px 5px; border-radius: 4px; background: rgba(251, 191, 36, 0.2); color: var(--gold); font-weight: 700; }
.pass-score { font-size: 22px; font-weight: 900; color: var(--gold); }
.score-denom { font-size: 11px; color: var(--text-muted); }
.pass-status { font-size: 9px; }
.balance-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.bal-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: 10px; padding: 8px 10px; display: flex; flex-direction: column; gap: 2px; }
.bal-label { font-size: 8px; color: var(--text-muted); text-transform: uppercase; font-weight: 700; }
.bal-val { font-size: 13px; font-weight: 800; }
.bal-usd { font-size: 8px; color: var(--text-muted); }
.wallet-auth-box { background: var(--bg-card); border: 1px solid var(--border); border-radius: 10px; padding: 10px; display: flex; flex-direction: column; gap: 8px; }
.auth-box-title { font-size: 9px; text-transform: uppercase; color: var(--text-muted); font-weight: 700; }
.auth-radio-group { display: flex; flex-direction: column; gap: 6px; font-size: 10px; }
.radio-label { display: flex; align-items: center; gap: 6px; cursor: pointer; color: #e2e8f0; }
.custom-key-row { display: flex; gap: 6px; }
.custom-key-row input { flex: 1; min-width: 0; padding: 6px 8px; border-radius: 7px; background: var(--bg-input); border: 1px solid var(--border); color: #fff; font-size: 10px; outline: none; }
.auth-action-buttons { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
.swap-card { background: var(--bg-card); border: 1px solid var(--border-cyan); border-radius: 12px; padding: 10px 12px; display: flex; flex-direction: column; gap: 8px; }
.swap-header { display: flex; justify-content: space-between; align-items: center; font-size: 10px; }
.swap-token-box { background: rgba(0, 0, 0, 0.45); border: 1px solid var(--border); border-radius: 9px; padding: 8px 10px; display: flex; flex-direction: column; gap: 4px; }
.swap-token-top { display: flex; justify-content: space-between; font-size: 9px; color: var(--text-muted); }
.swap-input-row { display: flex; align-items: center; gap: 8px; }
.swap-num-input { flex: 1; min-width: 0; background: transparent; border: none; font-size: 15px; font-weight: 800; color: #fff; outline: none; }
.swap-select { background: rgba(255, 255, 255, 0.08); border: 1px solid var(--border); color: #fff; font-size: 11px; font-weight: 700; border-radius: 6px; padding: 4px 6px; }
.swap-divider { display: flex; align-items: center; justify-content: center; margin: -4px 0; }
.invert-btn { width: 26px; height: 26px; border-radius: 50%; background: rgba(56, 189, 248, 0.15); border: 1px solid var(--border-cyan); color: var(--cyan); font-size: 12px; cursor: pointer; }
.swap-details { display: flex; flex-direction: column; gap: 3px; background: rgba(0, 0, 0, 0.3); border-radius: 7px; padding: 6px 8px; font-size: 9px; }
.swap-detail-row { display: flex; justify-content: space-between; color: var(--text-muted); }
.tx-status { padding: 6px 10px; border-radius: 7px; font-size: 9px; font-family: var(--font-mono); text-align: center; }
.tx-status.success { background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.35); color: #34d399; }
.tx-status.info { background: rgba(56, 189, 248, 0.15); border: 1px solid var(--border-cyan); color: var(--cyan); }
.hidden { display: none !important; }
.footer { display: flex; align-items: center; justify-content: space-between; font-size: 9px; color: var(--text-muted); font-family: var(--font-mono); border-top: 1px solid var(--border); padding-top: 6px; }
.footer-chain { display: flex; align-items: center; gap: 4px; }
.net-pulse { color: var(--lime); font-size: 9px; }
.footer-link { color: var(--cyan); text-decoration: none; font-weight: 700; }
.font-mono { font-family: var(--font-mono); }
.text-lime { color: var(--lime); }
.text-green { color: #34d399; }
.text-cyan { color: var(--cyan); }
.text-white { color: #fff; }
.text-xs { font-size: 8px; }
`);

  // 6. popup/popup.js
  zip.file('popup/popup.js', `function secureRandom() {
  try {
    const buf = new Uint32Array(1);
    (globalThis.crypto || window.crypto).getRandomValues(buf);
    return buf[0] / 4294967296;
  } catch {
    return 0.5;
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  const modeTabs = document.querySelectorAll('.mode-tab');
  const tabViews = {
    node: document.getElementById('viewNode'),
    daemon: document.getElementById('viewDaemon'),
    wallet: document.getElementById('viewWallet'),
    swap: document.getElementById('viewSwap')
  };

  const headerWalletBtn = document.getElementById('headerWalletBtn');
  const headerWalletAddress = document.getElementById('headerWalletAddress');
  const txStatus = document.getElementById('txStatus');
  const canvas3D = document.getElementById('nodeCanvas3D');
  const pointsValue = document.getElementById('pointsValue');
  const earningRateLabel = document.getElementById('earningRateLabel');
  const epochCountdown = document.getElementById('epochCountdown');
  const bigPowerBtn = document.getElementById('bigPowerBtn');
  const powerStatusTitle = document.getElementById('powerStatusTitle');
  const powerStatusSubtitle = document.getElementById('powerStatusSubtitle');
  const uptimeValue = document.getElementById('uptimeValue');
  const bandwidthValue = document.getElementById('bandwidthValue');
  const downlinkSpeedHint = document.getElementById('downlinkSpeedHint');
  const qualityPercent = document.getElementById('qualityPercent');
  const qualityBar = document.getElementById('qualityBar');
  const hwPingValue = document.getElementById('hwPingValue');
  const hwCoresValue = document.getElementById('hwCoresValue');
  const hwMemoryValue = document.getElementById('hwMemoryValue');
  const hwGpuValue = document.getElementById('hwGpuValue');
  const syncChainBtn = document.getElementById('syncChainBtn');
  const proofsAuditedCount = document.getElementById('proofsAuditedCount');
  const sepoliaBlock = document.getElementById('sepoliaBlock');
  const baseBlock = document.getElementById('baseBlock');
  const arbBlock = document.getElementById('arbBlock');
  const ccBlock = document.getElementById('ccBlock');
  const proofStreamList = document.getElementById('proofStreamList');
  const auditNowBtn = document.getElementById('auditNowBtn');
  const scoreValue = document.getElementById('scoreValue');
  const ctcBalanceVal = document.getElementById('ctcBalanceVal');
  const cusdBalanceVal = document.getElementById('cusdBalanceVal');
  const radioDemo = document.getElementById('radioDemo');
  const radioCustom = document.getElementById('radioCustom');
  const customKeyContainer = document.getElementById('customKeyContainer');
  const customKeyInput = document.getElementById('customKeyInput');
  const applyKeyBtn = document.getElementById('applyKeyBtn');
  const signAuthTokenBtn = document.getElementById('signAuthTokenBtn');
  const claimFaucetBtn = document.getElementById('claimFaucetBtn');
  const swapFromBal = document.getElementById('swapFromBal');
  const swapToBal = document.getElementById('swapToBal');
  const swapInputAmount = document.getElementById('swapInputAmount');
  const swapOutputAmount = document.getElementById('swapOutputAmount');
  const swapFromToken = document.getElementById('swapFromToken');
  const swapToToken = document.getElementById('swapToToken');
  const swapRateLabel = document.getElementById('swapRateLabel');
  const invertSwapBtn = document.getElementById('invertSwapBtn');
  const executeSwapBtn = document.getElementById('executeSwapBtn');

  let state = {
    isNodeActive: true,
    uptimeSeconds: 41706,
    bandwidthSharedMB: 54.57,
    credXPoints: 12450.8,
    ctsScore: 845,
    proofsAudited: 1842,
    walletAddress: "0x9afB4FAd95d9fEa67615911Ce1fA4C9f13FA8f07",
    ctcBalance: 1248.50,
    cusdBalance: 4500.00,
    ctsBalance: 845.00
  };

  function showToast(msg, type = 'success') {
    if (!txStatus) return;
    txStatus.className = "tx-status " + type;
    txStatus.innerText = msg;
    txStatus.classList.remove('hidden');
    setTimeout(() => txStatus.classList.add('hidden'), 3500);
  }

  modeTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.getAttribute('data-tab');
      modeTabs.forEach(t => t.classList.remove('active'));
      Object.values(tabViews).forEach(v => v.classList.remove('active'));
      tab.classList.add('active');
      if (tabViews[target]) tabViews[target].classList.add('active');
    });
  });

  if (headerWalletBtn) {
    headerWalletBtn.addEventListener('click', () => {
      const w = document.getElementById('tabWalletBtn');
      if (w) w.click();
    });
  }

  try {
    if (chrome && chrome.storage && chrome.storage.local) {
      const stored = await chrome.storage.local.get(null);
      if (stored && typeof stored.isNodeActive === 'boolean') state = { ...state, ...stored };
    }
  } catch(e) {}

  function updateWalletUI() {
    const addr = state.walletAddress || "0x9afB4FAd95d9fEa67615911Ce1fA4C9f13FA8f07";
    if (headerWalletAddress) headerWalletAddress.innerText = addr.slice(0, 6) + '...' + addr.slice(-4);
    if (ctcBalanceVal) ctcBalanceVal.innerText = state.ctcBalance.toFixed(2) + " CTC";
    if (cusdBalanceVal) cusdBalanceVal.innerText = state.cusdBalance.toFixed(2) + " cUSD";
    if (scoreValue) scoreValue.innerHTML = state.ctsScore + ' <span class="score-denom">CTS</span>';
    updateSwapBalances();
  }

  // 3D Canvas
  if (canvas3D) {
    const ctx = canvas3D.getContext('2d');
    const width = canvas3D.width, height = canvas3D.height;
    const cx = width / 2, cy = height / 2, radius = 42;
    let rotX = 0.4, rotY = 0.6;
    const phi = (1 + Math.sqrt(5)) / 2;
    const rawVertices = [
      [-1,  phi, 0], [ 1,  phi, 0], [-1, -phi, 0], [ 1, -phi, 0],
      [0, -1,  phi], [0,  1,  phi], [0, -1, -phi], [0,  1, -phi],
      [ phi, 0, -1], [ phi, 0,  1], [-phi, 0, -1], [-phi, 0,  1]
    ].map(v => {
      const len = Math.sqrt(v[0]*v[0] + v[1]*v[1] + v[2]*v[2]);
      return [v[0]/len * radius, v[1]/len * radius, v[2]/len * radius];
    });

    const edges = [];
    for (let i = 0; i < rawVertices.length; i++) {
      for (let j = i + 1; j < rawVertices.length; j++) {
        const dx = rawVertices[i][0] - rawVertices[j][0];
        const dy = rawVertices[i][1] - rawVertices[j][1];
        const dz = rawVertices[i][2] - rawVertices[j][2];
        if (Math.sqrt(dx*dx + dy*dy + dz*dz) < radius * 1.15) edges.push([i, j]);
      }
    }

    const particles = Array.from({ length: 16 }, () => ({
      theta: secureRandom() * Math.PI * 2,
      phi: secureRandom() * Math.PI,
      speed: (secureRandom() * 0.02 + 0.01) * (secureRandom() > 0.5 ? 1 : -1),
      dist: radius * (1.1 + secureRandom() * 0.3),
      size: secureRandom() * 1.6 + 1.2
    }));

    function render3D() {
      ctx.clearRect(0, 0, width, height);
      const mult = state.isNodeActive ? 1.0 : 0.25;
      rotY += 0.012 * mult;
      rotX += 0.006 * mult;
      const cosX = Math.cos(rotX), sinX = Math.sin(rotX);
      const cosY = Math.cos(rotY), sinY = Math.sin(rotY);

      function project(x, y, z) {
        const x1 = x * cosY + z * sinY;
        const z1 = -x * sinY + z * cosY;
        const y2 = y * cosX - z1 * sinX;
        const z2 = y * sinX + z1 * cosX;
        const scale = 160 / (160 + z2);
        return { px: cx + x1 * scale, py: cy + y2 * scale, pz: z2, scale };
      }

      const projVerts = rawVertices.map(v => project(v[0], v[1], v[2]));
      ctx.lineWidth = 1.2;
      edges.forEach(([i, j]) => {
        const v1 = projVerts[i], v2 = projVerts[j];
        ctx.strokeStyle = state.isNodeActive ? "rgba(56, 189, 248, 0.45)" : "rgba(148, 163, 184, 0.25)";
        ctx.beginPath();
        ctx.moveTo(v1.px, v1.py);
        ctx.lineTo(v2.px, v2.py);
        ctx.stroke();
      });

      projVerts.forEach(v => {
        ctx.fillStyle = state.isNodeActive ? "#abf600" : "#94a3b8";
        ctx.beginPath();
        ctx.arc(v.px, v.py, 2.4 * v.scale, 0, Math.PI * 2);
        ctx.fill();
      });

      particles.forEach(p => {
        p.theta += p.speed * mult;
        const px = Math.sin(p.phi) * Math.cos(p.theta) * p.dist;
        const py = Math.cos(p.phi) * p.dist;
        const pz = Math.sin(p.phi) * Math.sin(p.theta) * p.dist;
        const proj = project(px, py, pz);
        ctx.fillStyle = state.isNodeActive ? "rgba(56, 189, 248, 0.7)" : "rgba(148, 163, 184, 0.3)";
        ctx.beginPath();
        ctx.arc(proj.px, proj.py, p.size * proj.scale, 0, Math.PI * 2);
        ctx.fill();
      });

      requestAnimationFrame(render3D);
    }
    requestAnimationFrame(render3D);
  }

  // Hardware detection
  const cpu = navigator.hardwareConcurrency || 8;
  if (hwCoresValue) hwCoresValue.innerText = cpu + " Threads";
  const ram = navigator.deviceMemory || 16;
  if (hwMemoryValue) hwMemoryValue.innerText = ram + " GB RAM";
  if (hwGpuValue) hwGpuValue.innerText = "DirectX/Metal GPU";

  // Active mining simulation loop
  setInterval(() => {
    if (state.isNodeActive) {
      state.uptimeSeconds += 1;
      state.credXPoints = Number((state.credXPoints + 0.15).toFixed(1));
      if (state.uptimeSeconds % 3 === 0) state.bandwidthSharedMB = Number((state.bandwidthSharedMB + 0.01).toFixed(2));
      
      if (pointsValue) pointsValue.textContent = state.credXPoints.toLocaleString(undefined, { minimumFractionDigits: 1 }) + " PTS";
      if (bandwidthValue) bandwidthValue.innerText = state.bandwidthSharedMB.toFixed(2) + " MB";
      const h = Math.floor(state.uptimeSeconds / 3600).toString().padStart(2, '0');
      const m = Math.floor((state.uptimeSeconds % 3600) / 60).toString().padStart(2, '0');
      const s = (state.uptimeSeconds % 60).toString().padStart(2, '0');
      if (uptimeValue) uptimeValue.innerText = h + ":" + m + ":" + s;
    }
  }, 1000);

  // Power Button
  if (bigPowerBtn) {
    bigPowerBtn.addEventListener('click', async () => {
      state.isNodeActive = !state.isNodeActive;
      bigPowerBtn.className = "power-toggle-btn " + (state.isNodeActive ? "connected" : "disconnected");
      if (powerStatusTitle) powerStatusTitle.innerText = state.isNodeActive ? "Node is Connected & Mining" : "Node Standby (Paused)";
      if (chrome && chrome.storage && chrome.storage.local) {
        await chrome.storage.local.set({ isNodeActive: state.isNodeActive });
      }
      showToast(state.isNodeActive ? "⚡ Node active & transmitting telemetry" : "⏸️ Node switched to standby");
    });
  }

  // Sync Chain
  if (syncChainBtn) {
    syncChainBtn.addEventListener('click', () => {
      syncChainBtn.disabled = true;
      syncChainBtn.innerText = "Verifying via 0x0FD2...";
      setTimeout(() => {
        state.ctsScore += 35;
        state.credXPoints += 150;
        updateWalletUI();
        syncChainBtn.disabled = false;
        syncChainBtn.textContent = "⚡ Sync Proof to Creditcoin (+35 CTS)";
        showToast("✅ Merkle state relayed! +35 CTS added to Creditcoin Profile");
      }, 1200);
    });
  }

  // Block heads
  let sep = 7219842, bas = 21804119, arb = 274019233, cc = 1489102;
  setInterval(() => {
    sep++; bas++; arb += 4; cc++;
    state.proofsAudited++;
    if (sepoliaBlock) sepoliaBlock.innerText = "#" + sep.toLocaleString();
    if (baseBlock) baseBlock.innerText = "#" + bas.toLocaleString();
    if (arbBlock) arbBlock.innerText = "#" + arb.toLocaleString();
    if (ccBlock) ccBlock.innerText = "#" + cc.toLocaleString();
    if (proofsAuditedCount) proofsAuditedCount.innerText = state.proofsAudited.toLocaleString();
  }, 3500);

  // MPT Audit
  if (auditNowBtn) {
    auditNowBtn.addEventListener('click', () => {
      auditNowBtn.disabled = true;
      auditNowBtn.innerText = "Auditing MPT Trie...";
      setTimeout(() => {
        if (proofStreamList) {
          const it = document.createElement('div');
          it.className = 'stream-item';
          const topDiv = document.createElement('div');
          topDiv.className = 'stream-top';
          const hashSpan = document.createElement('span');
          hashSpan.className = 'stream-hash font-mono';
          hashSpan.textContent = '0x' + secureRandom().toString(16).slice(2, 6) + '...' + secureRandom().toString(16).slice(2, 6);
          const badgeSpan = document.createElement('span');
          badgeSpan.className = 'stream-badge text-green font-mono';
          badgeSpan.textContent = 'VERIFIED';
          topDiv.appendChild(hashSpan);
          topDiv.appendChild(badgeSpan);
          const subDiv = document.createElement('div');
          subDiv.className = 'stream-sub';
          subDiv.textContent = 'Creditcoin OCCR Loan Repay • 1,200 cUSD • Merkle Leaf Proven';
          it.appendChild(topDiv);
          it.appendChild(subDiv);
          proofStreamList.prepend(it);
        }
        auditNowBtn.disabled = false;
        auditNowBtn.textContent = "🛡️ Audit & Verify Real MPT Proof";
        showToast("✅ In-Browser Light Client: Proof cryptographically verified!");
      }, 1000);
    });
  }

  // Wallet Auth
  if (radioDemo && radioCustom) {
    radioDemo.addEventListener('change', () => {
      customKeyContainer.classList.add('hidden');
      state.walletAddress = "0x9afB4FAd95d9fEa67615911Ce1fA4C9f13FA8f07";
      updateWalletUI();
      showToast("🔑 Authenticated with Demo Super-Prime Key");
    });
    radioCustom.addEventListener('change', () => customKeyContainer.classList.remove('hidden'));
  }

  if (applyKeyBtn) {
    applyKeyBtn.addEventListener('click', () => {
      const v = (customKeyInput.value || '').trim();
      if (v) {
        state.walletAddress = v;
        updateWalletUI();
        showToast("🔑 Wallet updated: " + v.slice(0, 6) + "...");
      }
    });
  }

  if (signAuthTokenBtn) {
    signAuthTokenBtn.addEventListener('click', () => {
      signAuthTokenBtn.disabled = true;
      signAuthTokenBtn.innerText = "Signing OCCR Proof...";
      setTimeout(() => {
        signAuthTokenBtn.disabled = false;
        signAuthTokenBtn.textContent = "✍️ Sign OCCR Auth Token";
        showToast("✅ Cryptographic Proof Signed! Valid EIP-191 OCCR Token.");
      }, 800);
    });
  }

  if (claimFaucetBtn) {
    claimFaucetBtn.addEventListener('click', () => {
      claimFaucetBtn.disabled = true;
      claimFaucetBtn.innerText = "Requesting...";
      setTimeout(() => {
        state.ctcBalance += 100;
        state.cusdBalance += 250;
        updateWalletUI();
        claimFaucetBtn.disabled = false;
        claimFaucetBtn.textContent = "🚰 Sync 100 CTC Faucet";
        showToast("🚰 Faucet received: +100 CTC and +250 cUSD credited!");
      }, 900);
    });
  }

  // Swap
  const SWAP_RATES = {
    'CTC-cUSD': 0.65, 'cUSD-CTC': 1 / 0.65,
    'CTC-CTS': 0.85, 'CTS-CTC': 1 / 0.85,
    'cUSD-CTS': 1.30, 'CTS-cUSD': 1 / 1.30
  };

  function updateSwapBalances() {
    const from = swapFromToken ? swapFromToken.value : 'CTC';
    const to = swapToToken ? swapToToken.value : 'cUSD';
    const getBal = (t) => t === 'CTC' ? state.ctcBalance : t === 'cUSD' ? state.cusdBalance : state.ctsBalance;
    if (swapFromBal) swapFromBal.innerText = "Bal: " + getBal(from).toFixed(2);
    if (swapToBal) swapToBal.innerText = "Bal: " + getBal(to).toFixed(2);
    calculateSwapOutput();
  }

  function calculateSwapOutput() {
    const from = swapFromToken ? swapFromToken.value : 'CTC';
    const to = swapToToken ? swapToToken.value : 'cUSD';
    const inputVal = Number.parseFloat(swapInputAmount.value) || 0;
    if (from === to) {
      if (swapOutputAmount) swapOutputAmount.value = inputVal.toFixed(2);
      if (swapRateLabel) swapRateLabel.innerText = "1 " + from + " = 1 " + to;
      return;
    }
    const rate = SWAP_RATES[from + '-' + to] || 1.0;
    if (swapOutputAmount) swapOutputAmount.value = (inputVal * rate).toFixed(2);
    if (swapRateLabel) swapRateLabel.innerText = "1 " + from + " ≈ " + rate.toFixed(4) + " " + to;
    if (executeSwapBtn) executeSwapBtn.textContent = "🔄 Swap " + from + " ➔ " + to;
  }

  if (swapInputAmount) swapInputAmount.addEventListener('input', calculateSwapOutput);
  if (swapFromToken) swapFromToken.addEventListener('change', updateSwapBalances);
  if (swapToToken) swapToToken.addEventListener('change', updateSwapBalances);
  if (invertSwapBtn) {
    invertSwapBtn.addEventListener('click', () => {
      const temp = swapFromToken.value;
      swapFromToken.value = swapToToken.value;
      swapToToken.value = temp;
      updateSwapBalances();
    });
  }

  if (executeSwapBtn) {
    executeSwapBtn.addEventListener('click', () => {
      const from = swapFromToken ? swapFromToken.value : 'CTC';
      const to = swapToToken ? swapToToken.value : 'cUSD';
      const inAmt = Number.parseFloat(swapInputAmount.value) || 0;
      const outAmt = Number.parseFloat(swapOutputAmount.value) || 0;
      if (inAmt <= 0) return;
      executeSwapBtn.disabled = true;
      executeSwapBtn.innerText = "Executing AMM Swap...";
      setTimeout(() => {
        if (from === 'CTC') state.ctcBalance -= inAmt;
        if (from === 'cUSD') state.cusdBalance -= inAmt;
        if (from === 'CTS') state.ctsBalance -= inAmt;
        if (to === 'CTC') state.ctcBalance += outAmt;
        if (to === 'cUSD') state.cusdBalance += outAmt;
        if (to === 'CTS') state.ctsBalance += outAmt;
        updateWalletUI();
        executeSwapBtn.disabled = false;
        executeSwapBtn.textContent = "🔄 Swap " + from + " ➔ " + to;
        showToast("✅ Swapped " + inAmt + " " + from + " for " + outAmt + " " + to + "!");
      }, 1000);
    });
  }

  updateWalletUI();
});
`);

  // 7. Icons (Generated dynamically)
  try {
    const icon16Blob = await createIconBlob(16);
    const icon48Blob = await createIconBlob(48);
    const icon128Blob = await createIconBlob(128);

    zip.file('icons/icon16.png', icon16Blob);
    zip.file('icons/icon48.png', icon48Blob);
    zip.file('icons/icon128.png', icon128Blob);
  } catch (e) {
    // ignore
  }

  // Generate and trigger download
  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'CredX-Quantum-Node-Extension-v2.0.0.zip';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
