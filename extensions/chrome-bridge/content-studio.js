/**
 * Open-DreamFlow Chrome Bridge — Web Studio Content Script (`content-studio.js`)
 *
 * Bridges `window.postMessage` on `http://localhost:*` / `http://127.0.0.1:*`
 * with the MV3 Background Service Worker (`background.js`).
 *
 * Accepts both `'open-dreamflow-studio'` and `'OPEN_DREAMFLOW_STUDIO'` envelopes
 * for seamless compatibility across Studio builds, and posts back using
 * `source: 'open-dreamflow-extension'`.
 */

(function initOpenDreamFlowStudioBridge() {
  const ACCEPTED_STUDIO_SOURCES = new Set([
    'open-dreamflow-studio',
    'OPEN_DREAMFLOW_STUDIO',
  ]);

  function postToStudio(type, payload) {
    window.postMessage(
      {
        source: 'open-dreamflow-extension',
        type,
        payload,
      },
      '*'
    );
  }

  // Announce bridge presence immediately when loaded
  try {
    document.documentElement?.setAttribute('data-open-dreamflow-bridge', '1.1.0');
    chrome.runtime.sendMessage({ type: 'STUDIO_PING' }, (response) => {
      if (chrome.runtime.lastError) return;
      if (response?.status) {
        postToStudio('DREAMFLOW_BRIDGE_STATUS', response.status);
      }
    });
  } catch {
    // Ignore extension context invalidation during reloads
  }

  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    const data = event.data;
    if (!data || typeof data !== 'object') return;
    if (!ACCEPTED_STUDIO_SOURCES.has(data.source)) return;

    const msgType = String(data.type || '');
    const payload = data.payload || {};

    if (msgType === 'DREAMFLOW_PING' || msgType === 'PING_BRIDGE') {
      chrome.runtime.sendMessage({ type: 'STUDIO_PING' }, (response) => {
        if (chrome.runtime.lastError) return;
        const status = response?.status || {
          extensionVersion: '1.1.0',
          flowConnected: false,
          dreaminaConnected: false,
        };
        postToStudio('DREAMFLOW_PONG', status);
        postToStudio('DREAMFLOW_BRIDGE_STATUS', status);
      });
      return;
    }

    if (msgType === 'DREAMFLOW_ENQUEUE_JOB' || msgType === 'ENQUEUE_JOB') {
      chrome.runtime.sendMessage({ type: 'STUDIO_ENQUEUE_JOB', payload }, (response) => {
        if (chrome.runtime.lastError) {
          postToStudio('DREAMFLOW_JOB_COMPLETE', {
            jobId: payload?.jobId,
            status: 'failed',
            error: chrome.runtime.lastError.message,
          });
          return;
        }
        if (response?.status) {
          postToStudio('DREAMFLOW_BRIDGE_STATUS', response.status);
        }
      });
      return;
    }

    if (msgType === 'DREAMFLOW_ENQUEUE_BATCH' || msgType === 'ENQUEUE_BATCH') {
      chrome.runtime.sendMessage({ type: 'STUDIO_ENQUEUE_BATCH', payload }, (response) => {
        if (chrome.runtime.lastError) return;
        if (response?.status) {
          postToStudio('DREAMFLOW_BRIDGE_STATUS', response.status);
        }
      });
      return;
    }

    if (msgType === 'DREAMFLOW_CANCEL_JOB' || msgType === 'CANCEL_JOB') {
      chrome.runtime.sendMessage({ type: 'STUDIO_CANCEL_JOB', payload }, () => {});
    }
  });

  chrome.runtime.onMessage.addListener((message) => {
    if (!message || message.source !== 'open-dreamflow-extension') return;
    postToStudio(message.type, message.payload);
  });
})();
