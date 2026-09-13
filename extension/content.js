/**
 * CredX Quantum Extension - Content Script Bridge (Manifest V3)
 * Provides two-way communication between the CredX web terminal and the browser extension.
 */

// 1. Direct window message listener (runs in content script world)
window.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'CREDX_PING_EXTENSION') {
    window.postMessage({
      type: 'CREDX_PONG_EXTENSION',
      version: '2.0.0',
      active: true,
      chain: 'Creditcoin Testnet (102031)',
      precompile: '0x0FD2',
      timestamp: Date.now()
    }, '*');
  }
});

// 2. Try injecting window globals into page context if permitted
try {
  const script = document.createElement('script');
  script.textContent = `
    window.__CREDX_EXTENSION_INSTALLED__ = true;
    window.__CREDX_EXTENSION_VERSION__ = "2.0.0";
    window.__CREDX_EXTENSION_RPC__ = "https://rpc.cc3-testnet.creditcoin.network";
  `;
  (document.head || document.documentElement).appendChild(script);
  script.remove();
} catch (e) {
  // Silent fallback if page CSP restricts inline script injection
}

// 3. Runtime messaging router
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message && message.kind === 'credx:status') {
    sendResponse({ ok: true, installed: true, version: '2.0.0' });
    return false;
  }
  return false;
});
