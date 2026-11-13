/**
 * Open-DreamFlow Chrome Bridge — v1.2.0 Multi-Platform Popup Controller (`popup.js`)
 */

const PLATFORM_IDS = [
  'higgsfield',
  'sume',
  'kling',
  'dreamina',
  'google-flow',
  'openart',
  'imagineart',
  'elevenlabs',
];

function setRowIndicator(dotId, labelId, connected, onlineText, offlineText) {
  const dot = document.getElementById(dotId);
  const label = document.getElementById(labelId);
  if (dot) {
    dot.classList.toggle('online', Boolean(connected));
  }
  if (label) {
    label.textContent = connected ? onlineText : offlineText;
    label.style.color = connected ? '#5e9e79' : '#8b8882';
  }
}

function setPlatformButton(platformId, connected) {
  const dot = document.getElementById(`dot-${platformId}`);
  const btn = document.getElementById(`lbl-${platformId}`);
  if (dot) {
    dot.classList.toggle('online', Boolean(connected));
  }
  if (btn) {
    btn.textContent = connected ? 'Connected' : 'Open Tab';
    btn.classList.toggle('connected', Boolean(connected));
  }
}

function renderPopupState(response) {
  const status = response?.status || {};
  setRowIndicator(
    'dot-studio',
    'lbl-studio',
    (status.studioTabsCount || 0) > 0,
    `${status.studioTabsCount} tab(s)`,
    'Offline'
  );
  setRowIndicator(
    'dot-relay',
    'lbl-relay',
    Boolean(status.relayConnected),
    'Live WS (:3001)',
    'Standby'
  );

  const connectedMap = status.platformsConnected || {};
  for (const id of PLATFORM_IDS) {
    setPlatformButton(id, Boolean(connectedMap[id]));
  }

  const queuedEl = document.getElementById('val-queued');
  const completedEl = document.getElementById('val-completed');
  const savedEl = document.getElementById('val-saved');

  let activeCount = 0;
  if (status.activeJobs && typeof status.activeJobs === 'object') {
    for (const val of Object.values(status.activeJobs)) {
      if (val) activeCount += 1;
    }
  }

  if (queuedEl) queuedEl.textContent = String((status.queuedCount || 0) + activeCount);
  if (completedEl) completedEl.textContent = String(status.stats?.completedCount || 0);
  if (savedEl) {
    const saved = Number(status.stats?.savedEstimateUsd || 0).toFixed(2);
    savedEl.textContent = `$${saved}`;
  }
}

function refresh() {
  chrome.runtime.sendMessage({ type: 'POPUP_GET_STATE' }, (response) => {
    if (chrome.runtime.lastError) return;
    renderPopupState(response);
  });
}

for (const btn of document.querySelectorAll('[data-open-target]')) {
  btn.addEventListener('click', () => {
    const target = btn.getAttribute('data-open-target');
    if (!target) return;
    chrome.runtime.sendMessage({
      type: 'POPUP_OPEN_TARGET',
      target,
    });
  });
}

document.getElementById('btn-test-relay')?.addEventListener('click', () => {
  const feedback = document.getElementById('relay-feedback');
  if (feedback) feedback.textContent = 'Pushing capture to :3001/api/bridge/push...';

  chrome.runtime.sendMessage({ type: 'POPUP_TEST_RELAY_PUSH' }, (response) => {
    if (chrome.runtime.lastError) return;
    if (feedback) {
      feedback.textContent = response?.ok
        ? 'Relayed to Studio Canvas via :3001!'
        : 'Start :3001 MCP server to relay live.';
      feedback.style.color = response?.ok ? '#c89f81' : '#8b8882';
    }
    if (response?.status) renderPopupState(response);
  });
});

document.getElementById('btn-open-studio')?.addEventListener('click', () => {
  chrome.runtime.sendMessage({
    type: 'POPUP_OPEN_TARGET',
    url: 'http://localhost:8789/',
  });
});

document.getElementById('btn-clear-queue')?.addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'POPUP_CLEAR_QUEUE' }, (response) => {
    if (chrome.runtime.lastError) return;
    renderPopupState(response);
  });
});

refresh();
setInterval(refresh, 2500);
