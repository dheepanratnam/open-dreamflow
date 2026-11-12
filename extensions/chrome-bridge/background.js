/**
 * Open-DreamFlow Chrome Bridge — Manifest V3 Background Service Worker (Stage 4)
 *
 * Coordinates zero-API-cost job queuing between Open-DreamFlow Web Studio
 * (`localhost` / `127.0.0.1`), consumer web sessions on:
 *   - Google Flow (`https://flow.google.com/*`)
 *   - Dreamina / Seedance (`https://dreamina.capcut.com/*`)
 * and the Stage 4 Live Bridge Relay (`ws://localhost:3001/bridge` & `http://localhost:3001/api/bridge/push`).
 *
 * Includes strict `isKnownJobId()` deduplication so dual-envelope Studio posts
 * (`open-dreamflow-studio` + `OPEN_DREAMFLOW_STUDIO`) never double-enqueue jobs.
 */

const TARGET_URLS = {
  'google-flow': 'https://flow.google.com/',
  dreamina: 'https://dreamina.capcut.com/',
};

const LOCAL_RELAY_HTTP_PUSH = 'http://localhost:3001/api/bridge/push';
const LOCAL_RELAY_WS_URL = 'ws://localhost:3001/bridge';

/** @type {WebSocket | null} */
let relaySocket = null;
let relayConnected = false;

const STATE = {
  /** @type {Array<Record<string, any>>} */
  queue: [],
  /** @type {Record<'google-flow' | 'dreamina', Record<string, any> | null>} */
  activeByTarget: {
    'google-flow': null,
    dreamina: null,
  },
  /** @type {Array<Record<string, any>>} */
  history: [],
  /** @type {{ 'google-flow': Set<number>, dreamina: Set<number>, studio: Set<number> }} */
  tabs: {
    'google-flow': new Set(),
    dreamina: new Set(),
    studio: new Set(),
  },
  stats: {
    completedCount: 0,
    savedEstimateUsd: 0,
  },
};

let stateHydrated = false;

async function hydrateState() {
  if (stateHydrated) return;
  try {
    const stored = await chrome.storage.local.get(['dreamflowBridgeState']);
    if (stored?.dreamflowBridgeState) {
      const saved = stored.dreamflowBridgeState;
      if (Array.isArray(saved.queue)) STATE.queue = saved.queue;
      if (Array.isArray(saved.history)) STATE.history = saved.history.slice(0, 50);
      if (saved.stats && typeof saved.stats === 'object') {
        STATE.stats = {
          completedCount: Number(saved.stats.completedCount) || 0,
          savedEstimateUsd: Number(saved.stats.savedEstimateUsd) || 0,
        };
      }
    }
  } catch {
    // Ignore storage read errors in ephemeral profiles
  }
  stateHydrated = true;
  await refreshConnectedTabs();
  ensureLocalRelaySocket();
}

async function persistState() {
  try {
    await chrome.storage.local.set({
      dreamflowBridgeState: {
        queue: STATE.queue,
        history: STATE.history.slice(0, 50),
        stats: STATE.stats,
      },
    });
  } catch {
    // Ignore storage quota errors
  }
}

/**
 * Deduplicates job IDs across queued, active, and recently completed jobs so
 * dual-envelope Studio messages (`open-dreamflow-studio` + `OPEN_DREAMFLOW_STUDIO`)
 * never execute twice.
 * @param {string | undefined} jobId
 * @returns {boolean}
 */
function isKnownJobId(jobId) {
  if (!jobId || typeof jobId !== 'string') return false;
  if (STATE.queue.some((j) => j.jobId === jobId)) return true;
  if (Object.values(STATE.activeByTarget).some((j) => j && j.jobId === jobId)) return true;
  if (STATE.history.some((j) => j.jobId === jobId)) return true;
  return false;
}

/**
 * Normalizes target aliases (`flow`, `google-flow`, `dreamina`, `seedance`).
 * @param {string | undefined} rawTarget
 * @returns {'google-flow' | 'dreamina'}
 */
function normalizeTarget(rawTarget) {
  const lowered = String(rawTarget || 'google-flow').toLowerCase();
  if (
    lowered.includes('dreamina') ||
    lowered.includes('seedance') ||
    lowered.includes('seedream') ||
    lowered.includes('jimeng')
  ) {
    return 'dreamina';
  }
  return 'google-flow';
}

/**
 * Maintains a live WebSocket link to `ws://localhost:3001/bridge` when `:3001` is running.
 */
function ensureLocalRelaySocket() {
  if (
    typeof WebSocket === 'undefined' ||
    (relaySocket &&
      (relaySocket.readyState === WebSocket.OPEN ||
        relaySocket.readyState === WebSocket.CONNECTING))
  ) {
    return;
  }

  try {
    const ws = new WebSocket(LOCAL_RELAY_WS_URL);
    relaySocket = ws;

    ws.onopen = () => {
      relayConnected = true;
      try {
        ws.send(
          JSON.stringify({
            type: 'bridge_session',
            source: 'chrome-extension',
            title: 'Open-DreamFlow Chrome Bridge Connected',
            metadata: buildBridgeStatusPayload(),
          })
        );
      } catch {
        // Ignore transient send error
      }
    };

    ws.onclose = () => {
      relayConnected = false;
      relaySocket = null;
    };

    ws.onerror = () => {
      relayConnected = false;
    };
  } catch {
    relayConnected = false;
    relaySocket = null;
  }
}

/**
 * Pushes a captured Dreamina / Google Flow asset or prompt event to `:3001/api/bridge/push`
 * so connected Web Studio canvases spawn the node immediately in real time.
 * @param {Record<string, any>} eventBody
 */
async function pushEventToLocalRelay(eventBody) {
  try {
    const res = await fetch(LOCAL_RELAY_HTTP_PUSH, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(eventBody),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch {
    // Fallback to open WS frame if HTTP fetch failed
    if (relaySocket && relaySocket.readyState === WebSocket.OPEN) {
      try {
        relaySocket.send(JSON.stringify(eventBody));
        return { ok: true, via: 'ws' };
      } catch {
        // Ignore
      }
    }
  }
  return { ok: false };
}

async function refreshConnectedTabs() {
  try {
    const allTabs = await chrome.tabs.query({});
    STATE.tabs['google-flow'].clear();
    STATE.tabs.dreamina.clear();
    STATE.tabs.studio.clear();

    for (const tab of allTabs) {
      if (!tab.id || !tab.url) continue;
      if (
        tab.url.startsWith('https://flow.google.com/') ||
        tab.url.startsWith('https://labs.google/fx/tools/flow')
      ) {
        STATE.tabs['google-flow'].add(tab.id);
      } else if (
        tab.url.startsWith('https://dreamina.capcut.com/') ||
        tab.url.startsWith('https://jimeng.jianying.com/')
      ) {
        STATE.tabs.dreamina.add(tab.id);
      } else if (
        tab.url.startsWith('http://localhost:') ||
        tab.url.startsWith('http://127.0.0.1:')
      ) {
        STATE.tabs.studio.add(tab.id);
      }
    }
  } catch {
    // Ignore tab query permissions edge cases
  }
}

function buildBridgeStatusPayload() {
  return {
    extensionVersion: '1.0.0',
    flowConnected: STATE.tabs['google-flow'].size > 0,
    dreaminaConnected: STATE.tabs.dreamina.size > 0,
    relayConnected,
    studioTabsCount: STATE.tabs.studio.size,
    flowTabsCount: STATE.tabs['google-flow'].size,
    dreaminaTabsCount: STATE.tabs.dreamina.size,
    queuedCount: STATE.queue.length,
    activeJobs: {
      'google-flow': STATE.activeByTarget['google-flow']?.jobId || null,
      dreamina: STATE.activeByTarget.dreamina?.jobId || null,
    },
    stats: { ...STATE.stats },
  };
}

async function broadcastToStudio(type, payload) {
  await refreshConnectedTabs();
  const message = {
    source: 'open-dreamflow-extension',
    type,
    payload,
  };
  for (const tabId of STATE.tabs.studio) {
    try {
      await chrome.tabs.sendMessage(tabId, message);
    } catch {
      STATE.tabs.studio.delete(tabId);
    }
  }
}

function normalizeIncomingJob(raw) {
  const target = normalizeTarget(raw?.target);
  const jobId =
    typeof raw?.jobId === 'string' && raw.jobId.trim()
      ? raw.jobId.trim()
      : `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  return {
    jobId,
    target,
    prompt: String(raw?.prompt || '').trim(),
    aspectRatio: raw?.aspectRatio || '16:9',
    durationSec: Number(raw?.durationSec || raw?.durationSeconds || 5),
    referenceImages: Array.isArray(raw?.referenceImages) ? raw.referenceImages.slice(0, 10) : [],
    keyframes: Array.isArray(raw?.keyframes) ? raw.keyframes.slice(0, 10) : [],
    previousInteractionId: raw?.previousInteractionId || null,
    autoOpenTab: raw?.autoOpenTab !== false,
    enqueuedAt: new Date().toISOString(),
    status: 'queued',
  };
}

async function ensureTargetTab(target, autoOpen = true) {
  await refreshConnectedTabs();
  const existing = Array.from(STATE.tabs[target]);
  if (existing.length > 0) {
    return existing[0];
  }
  if (!autoOpen) {
    return null;
  }
  const created = await chrome.tabs.create({
    url: TARGET_URLS[target],
    active: false,
  });
  if (created.id) {
    STATE.tabs[target].add(created.id);
    await new Promise((resolve) => setTimeout(resolve, 2500));
    return created.id;
  }
  return null;
}

async function processQueue() {
  await hydrateState();

  for (const target of /** @type {const} */ (['google-flow', 'dreamina'])) {
    if (STATE.activeByTarget[target]) continue;

    const nextIdx = STATE.queue.findIndex((item) => item.target === target);
    if (nextIdx === -1) continue;

    const job = STATE.queue.splice(nextIdx, 1)[0];
    job.status = 'running';
    job.startedAt = new Date().toISOString();
    STATE.activeByTarget[target] = job;
    await persistState();

    await broadcastToStudio('DREAMFLOW_JOB_PROGRESS', {
      jobId: job.jobId,
      target: job.target,
      status: 'running',
      progress: 0.15,
      message: `Dispatching batch job to ${target} session...`,
    });

    const tabId = await ensureTargetTab(target, job.autoOpenTab);
    if (!tabId) {
      STATE.activeByTarget[target] = null;
      const failedRecord = {
        ...job,
        status: 'failed',
        error: `No open ${target} tab found. Open ${TARGET_URLS[target]} and sign in first.`,
        completedAt: new Date().toISOString(),
      };
      STATE.history.unshift(failedRecord);
      await persistState();
      await broadcastToStudio('DREAMFLOW_JOB_COMPLETE', {
        jobId: job.jobId,
        target: job.target,
        status: 'failed',
        error: failedRecord.error,
      });
      continue;
    }

    try {
      await chrome.tabs.sendMessage(tabId, {
        type: 'EXECUTE_CONSUMER_JOB',
        job,
      });
    } catch (err) {
      STATE.activeByTarget[target] = null;
      const errorMessage = err instanceof Error ? err.message : String(err);
      STATE.history.unshift({
        ...job,
        status: 'failed',
        error: `Content script unreachable on ${target}: ${errorMessage}`,
        completedAt: new Date().toISOString(),
      });
      await persistState();
      await broadcastToStudio('DREAMFLOW_JOB_COMPLETE', {
        jobId: job.jobId,
        target: job.target,
        status: 'failed',
        error: `Unable to reach ${target} tab. Refresh the tab and retry.`,
      });
    }
  }
}

chrome.tabs.onUpdated.addListener((_tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    refreshConnectedTabs().then(() => {
      broadcastToStudio('DREAMFLOW_BRIDGE_STATUS', buildBridgeStatusPayload());
    });
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  STATE.tabs['google-flow'].delete(tabId);
  STATE.tabs.dreamina.delete(tabId);
  STATE.tabs.studio.delete(tabId);
  broadcastToStudio('DREAMFLOW_BRIDGE_STATUS', buildBridgeStatusPayload());
});

chrome.alarms.create('dreamflow-queue-watchdog', { periodInMinutes: 0.5 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'dreamflow-queue-watchdog') {
    ensureLocalRelaySocket();
    processQueue();
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    await hydrateState();
    ensureLocalRelaySocket();

    switch (message?.type) {
      case 'TARGET_REGISTER': {
        const target = normalizeTarget(message.target);
        if (sender.tab?.id) {
          STATE.tabs[target].add(sender.tab.id);
        }
        const status = buildBridgeStatusPayload();
        await broadcastToStudio('DREAMFLOW_BRIDGE_STATUS', status);
        sendResponse({ ok: true, status });
        return;
      }

      case 'STUDIO_PING': {
        if (sender.tab?.id) {
          STATE.tabs.studio.add(sender.tab.id);
        }
        await refreshConnectedTabs();
        const status = buildBridgeStatusPayload();
        sendResponse({ ok: true, status });
        return;
      }

      case 'STUDIO_ENQUEUE_JOB': {
        if (sender.tab?.id) {
          STATE.tabs.studio.add(sender.tab.id);
        }
        const incomingJobId = message.payload?.jobId;
        if (isKnownJobId(incomingJobId)) {
          sendResponse({
            ok: true,
            deduplicated: true,
            jobId: incomingJobId,
            status: buildBridgeStatusPayload(),
          });
          return;
        }

        const job = normalizeIncomingJob(message.payload);
        STATE.queue.push(job);
        await persistState();
        await broadcastToStudio('DREAMFLOW_BRIDGE_STATUS', buildBridgeStatusPayload());
        processQueue();
        sendResponse({
          ok: true,
          deduplicated: false,
          jobId: job.jobId,
          queuePosition: STATE.queue.length,
          status: buildBridgeStatusPayload(),
        });
        return;
      }

      case 'STUDIO_ENQUEUE_BATCH': {
        if (sender.tab?.id) {
          STATE.tabs.studio.add(sender.tab.id);
        }
        const rawJobs = Array.isArray(message.payload?.jobs) ? message.payload.jobs : [];
        const acceptedIds = [];
        const deduplicatedIds = [];

        for (const rawJob of rawJobs) {
          if (isKnownJobId(rawJob?.jobId)) {
            deduplicatedIds.push(rawJob.jobId);
            continue;
          }
          const job = normalizeIncomingJob(rawJob);
          if (isKnownJobId(job.jobId)) {
            deduplicatedIds.push(job.jobId);
            continue;
          }
          STATE.queue.push(job);
          acceptedIds.push(job.jobId);
        }

        await persistState();
        await broadcastToStudio('DREAMFLOW_BRIDGE_STATUS', buildBridgeStatusPayload());
        processQueue();
        sendResponse({
          ok: true,
          acceptedIds,
          deduplicatedIds,
          status: buildBridgeStatusPayload(),
        });
        return;
      }

      case 'STUDIO_CANCEL_JOB': {
        const cancelId = message.payload?.jobId;
        STATE.queue = STATE.queue.filter((j) => j.jobId !== cancelId);
        for (const target of /** @type {const} */ (['google-flow', 'dreamina'])) {
          if (STATE.activeByTarget[target]?.jobId === cancelId) {
            STATE.activeByTarget[target] = null;
          }
        }
        await persistState();
        await broadcastToStudio('DREAMFLOW_BRIDGE_STATUS', buildBridgeStatusPayload());
        sendResponse({ ok: true, canceledJobId: cancelId });
        return;
      }

      case 'TARGET_JOB_PROGRESS': {
        const payload = message.payload || {};
        await broadcastToStudio('DREAMFLOW_JOB_PROGRESS', {
          jobId: payload.jobId,
          target: normalizeTarget(payload.target),
          status: payload.status || 'generating',
          progress: typeof payload.progress === 'number' ? payload.progress : 0.5,
          message: payload.message || 'Synthesizing frames in consumer session...',
        });
        sendResponse({ ok: true });
        return;
      }

      case 'TARGET_JOB_COMPLETE': {
        const payload = message.payload || {};
        const target = normalizeTarget(payload.target);
        const activeJob = STATE.activeByTarget[target];
        if (activeJob && (!payload.jobId || activeJob.jobId === payload.jobId)) {
          STATE.activeByTarget[target] = null;
        }

        const completedRecord = {
          ...(activeJob || {}),
          jobId: payload.jobId || activeJob?.jobId || `job_done_${Date.now()}`,
          target,
          status: payload.error ? 'failed' : payload.status || 'succeeded',
          videoUrl: payload.videoUrl || null,
          imageUrl: payload.imageUrl || null,
          error: payload.error || null,
          completedAt: new Date().toISOString(),
        };

        if (completedRecord.status === 'succeeded') {
          STATE.stats.completedCount += 1;
          STATE.stats.savedEstimateUsd = Number((STATE.stats.savedEstimateUsd + 0.35).toFixed(2));

          // Automatically push captured Dreamina / Google Flow media to Stage 4 `:3001/api/bridge/push`
          const relaySource = target === 'dreamina' ? 'dreamina' : 'flow';
          await pushEventToLocalRelay({
            type: 'bridge_asset',
            source: relaySource,
            mediaUrl: completedRecord.videoUrl || completedRecord.imageUrl,
            videoUrl: completedRecord.videoUrl,
            imageUrl: completedRecord.imageUrl,
            title:
              target === 'dreamina'
                ? 'Dreamina · Seedance Capture'
                : 'Google Flow · Omni Capture',
            prompt: completedRecord.prompt || '',
            metadata: {
              jobId: completedRecord.jobId,
              aspectRatio: completedRecord.aspectRatio || '16:9',
            },
          });
        }

        STATE.history.unshift(completedRecord);
        STATE.history = STATE.history.slice(0, 50);
        await persistState();

        await broadcastToStudio('DREAMFLOW_JOB_COMPLETE', {
          jobId: completedRecord.jobId,
          target: completedRecord.target,
          status: completedRecord.status,
          videoUrl: completedRecord.videoUrl,
          imageUrl: completedRecord.imageUrl,
          error: completedRecord.error,
        });
        await broadcastToStudio('DREAMFLOW_BRIDGE_STATUS', buildBridgeStatusPayload());

        processQueue();
        sendResponse({ ok: true });
        return;
      }

      case 'POPUP_TEST_RELAY_PUSH': {
        const pushResult = await pushEventToLocalRelay({
          type: 'bridge_asset',
          source: message.source || 'dreamina',
          mediaUrl: message.mediaUrl || '/media/shot01_rooftop.mp4',
          videoUrl: message.videoUrl || '/media/shot01_rooftop.mp4',
          title: message.title || 'Bridge · Dreamina Captured Clip',
          prompt:
            message.prompt ||
            '@Hero_Kael rooftop rain establishing shot relayed via Chrome Bridge',
        });
        sendResponse({
          ok: Boolean(pushResult?.ok),
          pushResult,
          status: buildBridgeStatusPayload(),
        });
        return;
      }

      case 'POPUP_GET_STATE': {
        await refreshConnectedTabs();
        sendResponse({
          ok: true,
          status: buildBridgeStatusPayload(),
          queue: STATE.queue,
          activeByTarget: STATE.activeByTarget,
          history: STATE.history.slice(0, 15),
        });
        return;
      }

      case 'POPUP_CLEAR_QUEUE': {
        STATE.queue = [];
        STATE.activeByTarget['google-flow'] = null;
        STATE.activeByTarget.dreamina = null;
        await persistState();
        const status = buildBridgeStatusPayload();
        await broadcastToStudio('DREAMFLOW_BRIDGE_STATUS', status);
        sendResponse({ ok: true, status });
        return;
      }

      case 'POPUP_OPEN_TARGET': {
        const url = message.url || TARGET_URLS[normalizeTarget(message.target)];
        await chrome.tabs.create({ url, active: true });
        sendResponse({ ok: true });
        return;
      }

      default:
        sendResponse({ ok: false, error: `Unknown message type: ${String(message?.type)}` });
    }
  })();

  return true;
});
