/**
 * CredX MetaMask Relay (runs in the page's MAIN world so it can see the
 * EIP-1193 provider that wallet extensions inject into web pages).
 *
 * The popup (chrome-extension:// context) has no injected wallet of its own,
 * so it forwards JSON-RPC calls to whatever tab is active; if that page has
 * MetaMask unlocked, the relay can read accounts and sign real transactions
 * WITHOUT the extension ever holding a private key.
 */
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || typeof message.kind !== 'string' || !message.kind.startsWith('credx:')) {
    return false;
  }

  const provider = window.ethereum && window.ethereum.isMetaMask ? window.ethereum : null;

  if (message.kind === 'credx:hasProvider') {
    sendResponse({ ok: true, result: !!provider });
    return false;
  }

  if (message.kind === 'credx:rpc') {
    if (!provider) {
      sendResponse({ ok: false, error: 'No MetaMask provider on this tab. Open a normal web page and make sure MetaMask is unlocked, then retry.' });
      return false;
    }
    provider
      .request({ method: message.method, params: message.params || [] })
      .then((result) => sendResponse({ ok: true, result }))
      .catch((err) => {
        const msg = (err && err.message) || String(err);
        sendResponse({ ok: false, error: msg.startsWith('MetaMask') ? msg : `MetaMask: ${msg}` });
      });
    return true; // async response channel
  }

  return false;
});