/**
 * Open-DreamFlow Chrome Bridge — Stage 4 Popup Controller (`popup.js`)
 */

function setIndicator(dotId, labelId, connected, onlineText = 'Connected', offlineText = 'Not Open') {
  const dot = document.getElementById(dotId);
  const label = document.getElementById(labelId);
  if (dot) {
    dot.classList.toggle('online', Boolean(connected));
  }
  if (label) {
    label.textContent = connected ? onlineText : offlineText;
    label.style.color = connected ? '#34d399' : '#8e8e93';
  }
}

function renderPopupState(response) {
  const status = response?.status || {};
  setIndicator(
    'dot-studio',
    'lbl-studio',
    (status.studioTabsCount || 0) > 0,
    `${status.studioTabsCount} tab(s)`,
    'Offline'
  );
  setIndicator(
    'dot-relay',
    'lbl-relay',
    Boolean(status.relayConnected),
    'Live WS (:3001)',
    'Standby'
  );
  setIndicator(
    'dot-flow',
    'lbl-flow',
    Boolean(status.flowConnected),
    'Ready ($0 Bridge)',
    'Tab Closed'
  );
  setIndicator(
    'dot-dreamina',
    'lbl-dreamina',
    Boolean(status.dreaminaConnected),
    'Ready ($0 Bridge)',
    'Tab Closed'
  );

  const queuedEl = document.getElementById('val-queued');
  const completedEl = document.getElementById('val-completed');
  const savedEl = document.getElementById('val-saved');

  const activeCount =
    (status.activeJobs?.['google-flow'] ? 1 : 0) +
    (status.activeJobs?.dreamina ? 1 : 0);

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

document.getElementById('btn-open-flow')?.addEventListener('click', () => {
  chrome.runtime.sendMessage({
    type: 'POPUP_OPEN_TARGET',
    target: 'google-flow',
    url: 'https://flow.google.com/',
  });
});

document.getElementById('btn-open-dreamina')?.addEventListener('click', () => {
  chrome.runtime.sendMessage({
    type: 'POPUP_OPEN_TARGET',
    target: 'dreamina',
    url: 'https://dreamina.capcut.com/',
  });
});

document.getElementById('btn-test-relay')?.addEventListener('click', () => {
  const feedback = document.getElementById('relay-feedback');
  if (feedback) feedback.textContent = 'Pushing capture to :3001/api/bridge/push...';

  chrome.runtime.sendMessage({ type: 'POPUP_TEST_RELAY_PUSH' }, (response) => {
    if (chrome.runtime.lastError) return;
    if (feedback) {
      feedback.textContent = response?.ok
        ? 'Relayed to Studio Canvas via :3001!'
        : 'Start :3001 MCP server to relay live.';
      feedback.style.color = response?.ok ? '#20d5ec' : '#8e8e93';
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
