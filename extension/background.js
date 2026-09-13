/**
 * CredX Quantum Node & Attestcoin Daemon - Background Service Worker (Manifest V3)
 * Handles background telemetry accrual, alarm tickers, badge status, and message routing.
 */

// CSPRNG-backed replacement for Math.random() (SonarCloud S2245).
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
  walletAuthStatus: "authenticated", // 'authenticated' | 'disconnected'
  lastSyncTimestamp: Date.now()
};

// Initialize extension storage on install
chrome.runtime.onInstalled.addListener(async () => {
  const existing = await chrome.storage.local.get(null);
  const initialState = { ...DEFAULT_STATE, ...existing };
  await chrome.storage.local.set(initialState);
  
  // Create 1-minute alarm for periodic background sync
  chrome.alarms.create("nodeTickAlarm", { periodInMinutes: 1 });
  
  // Set badge
  updateBadge(initialState.isNodeActive);
});

// Update extension icon badge
function updateBadge(isActive) {
  try {
    if (isActive) {
      chrome.action.setBadgeText({ text: "ON" });
      chrome.action.setBadgeBackgroundColor({ color: "#10b981" });
    } else {
      chrome.action.setBadgeText({ text: "OFF" });
      chrome.action.setBadgeBackgroundColor({ color: "#64748b" });
    }
  } catch (e) {
    // ignore
  }
}

// Background tick handler (runs even when popup is closed)
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

// Handle messages from content script or popup
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || typeof message.type !== "string") {
    return false;
  }

  if (message.type === "CREDX_GET_STATUS") {
    chrome.storage.local.get(null).then((state) => {
      sendResponse({ ok: true, state: { ...DEFAULT_STATE, ...state } });
    });
    return true; // asynchronous response
  }

  if (message.type === "CREDX_SET_NODE_ACTIVE") {
    const isActive = Boolean(message.payload?.isActive);
    chrome.storage.local.set({ isNodeActive: isActive }).then(() => {
      updateBadge(isActive);
      sendResponse({ ok: true, isNodeActive: isActive });
    });
    return true;
  }

  if (message.type === "CREDX_UPDATE_WALLET") {
    const { address, authStatus } = message.payload || {};
    chrome.storage.local.set({
      walletAddress: address || DEFAULT_STATE.walletAddress,
      walletAuthStatus: authStatus || "authenticated"
    }).then(() => {
      sendResponse({ ok: true });
    });
    return true;
  }

  return false;
});
