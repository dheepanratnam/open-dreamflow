/**
 * Open-DreamFlow Chrome Bridge — Manifest V3 Background Service Worker (v1.2.0)
 *
 * Coordinates zero-markup job queuing & chained reference forwarding between
 * Open-DreamFlow Web Studio (`localhost` / `127.0.0.1`), 8 creator platforms:
 *   1. Dreamina (`dreamina.capcut.com`, `jimeng.jianying.com`)
 *   2. Google Flow (`labs.google`, `flow.google.com`)
 *   3. Higgsfield (`higgsfield.ai`)
 *   4. Sume.com (`sume.com`)
 *   5. Kling AI (`app.klingai.com`, `klingai.com`)
 *   6. OpenArt (`openart.ai`)
 *   7. ImagineArt (`imagine.art`)
 *   8. ElevenLabs (`elevenlabs.io`)
 * and the Local Bridge Relay (`ws://localhost:3001/bridge` & `http://localhost:3001/api/bridge/*`).
 *
 * Preserves strict `isKnownJobId()` deduplication and provides `FETCH_REFERENCE_DATA_URL`
 * so content scripts can inject chained `/media/*` outputs across any domain's CSP.
 */

const ALL_TARGETS = /** @type {const} */ ([
  'higgsfield',
  'sume',
  'kling',
  'dreamina',
  'google-flow',
  'openart',
  'imagineart',
  'elevenlabs',
]);

const TARGET_URLS = {
  higgsfield: 'https://higgsfield.ai/create',
  sume: 'https://sume.com',
  kling: 'https://app.klingai.com/global/image-to-video/frame-mode',
  dreamina: 'https://dreamina.capcut.com/ai-tool/home',
  'google-flow': 'https://labs.google/fx/tools/flow',
  openart: 'https://openart.ai/create',
  imagineart: 'https://www.imagine.art/dashboard/tool/text-to-image',
  elevenlabs: 'https://elevenlabs.io/app/speech-synthesis/text-to-speech',
};

const TARGET_LABELS = {
  higgsfield: 'Higgsfield',
  sume: 'Sume.com',
  kling: 'Kling AI',
  dreamina: 'Dreamina',
  'google-flow': 'Google Flow',
  openart: 'OpenArt',
  imagineart: 'ImagineArt',
  elevenlabs: 'ElevenLabs',
};

const LOCAL_RELAY_BASE = 'http://localhost:3001';
const LOCAL_RELAY_HTTP_PUSH = `${LOCAL_RELAY_BASE}/api/bridge/push`;
const LOCAL_RELAY_HTTP_HEARTBEAT = `${LOCAL_RELAY_BASE}/api/bridge/heartbeat`;
const LOCAL_RELAY_WS_URL = 'ws://localhost:3001/bridge';

/** @type {WebSocket | null} */
let relaySocket = null;
let relayConnected = false;

const STATE = {
  /** @type {Array<Record<string, any>>} */
  queue: [],
  /** @type {Record<string, Record<string, any> | null>} */
  activeByTarget: {
    higgsfield: null,
    sume: null,
    kling: null,
    dreamina: null,
    'google-flow': null,
    openart: null,
    imagineart: null,
    elevenlabs: null,
  },
  /** @type {Array<Record<string, any>>} */
  history: [],
  /** @type {Record<string, Set<number>>} */
  tabs: {
    higgsfield: new Set(),
    sume: new Set(),
    kling: new Set(),
    dreamina: new Set(),
    'google-flow': new Set(),
    openart: new Set(),
    imagineart: new Set(),
    elevenlabs: new Set(),
    studio: new Set(),
  },
  /** @type {Set<string>} */
  openDomains: new Set(),
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
 * Normalizes target aliases across all 8 creator platforms.
 * @param {string | undefined} rawTarget
 * @returns {'higgsfield' | 'sume' | 'kling' | 'dreamina' | 'google-flow' | 'openart' | 'imagineart' | 'elevenlabs'}
 */
function normalizeTarget(rawTarget) {
  const lowered = String(rawTarget || 'google-flow').toLowerCase().trim();
  if (lowered.includes('higgsfield')) return 'higgsfield';
  if (lowered.includes('sume')) return 'sume';
  if (lowered.includes('kling') && !lowered.includes('openart') && !lowered.includes('-hf')) {
    return 'kling';
  }
  if (
    lowered.includes('dreamina') ||
    lowered.includes('seedance') ||
    lowered.includes('seedream') ||
    lowered.includes('jimeng')
  ) {
    return 'dreamina';
  }
  if (lowered.includes('openart')) return 'openart';
  if (lowered.includes('imagine')) return 'imagineart';
  if (lowered.includes('eleven')) return 'elevenlabs';
  return 'google-flow';
}

/**
 * Detects which creator platform a browser tab URL belongs to.
 * @param {string} rawUrl
 * @returns {string | null}
 */
function detectTabPlatform(rawUrl) {
  if (!rawUrl) return null;
  let u;
  try {
    u = new URL(rawUrl);
  } catch {
    return null;
  }
  const host = u.hostname.toLowerCase();
  if (host === 'localhost' || host === '127.0.0.1') return 'studio';
  if (host === 'flow.google.com' || host === 'labs.google') return 'google-flow';
  if (host.endsWith('dreamina.capcut.com') || host.endsWith('jimeng.jianying.com')) {
    return 'dreamina';
  }
  if (host === 'higgsfield.ai' || host.endsWith('.higgsfield.ai')) return 'higgsfield';
  if (host === 'sume.com' || host.endsWith('.sume.com')) return 'sume';
  if (host === 'klingai.com' || host.endsWith('.klingai.com')) return 'kling';
  if (host === 'openart.ai' || host.endsWith('.openart.ai')) return 'openart';
  if (host === 'imagine.art' || host.endsWith('.imagine.art')) return 'imagineart';
  if (host === 'elevenlabs.io' || host.endsWith('.elevenlabs.io')) return 'elevenlabs';
  return null;
}

/**
 * Sends open-domain & platform snapshot heartbeats to `:3001` (`ws://localhost:3001/bridge`
 * or fallback HTTP `/api/bridge/heartbeat`) so `:3001/api/connections/status` stays live.
 * @param {{ fullSessionEvent?: boolean }} [options]
 */
function sendRelayPlatformHeartbeats(options = {}) {
  const payload = buildBridgeStatusPayload();
  const heartbeatPacket = {
    type: options.fullSessionEvent ? 'bridge_session' : 'bridge_heartbeat',
    source: 'chrome-extension',
    fullSnapshot: true,
    extensionVersion: '1.2.0',
    openDomains: payload.openDomains,
    platformsConnected: payload.platformsConnected,
    title: 'Open-DreamFlow Universal Credit Bridge v1.2.0',
    metadata: payload,
  };

  if (relaySocket && relaySocket.readyState === WebSocket.OPEN) {
    try {
      relaySocket.send(JSON.stringify(heartbeatPacket));
      return;
    } catch {
      // Fall through to HTTP heartbeat
    }
  }

  fetch(LOCAL_RELAY_HTTP_HEARTBEAT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(heartbeatPacket),
  }).catch(() => {
    // Local relay may be offline when user opens popup standalone
  });
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
      void refreshConnectedTabs().then(() => {
        sendRelayPlatformHeartbeats({ fullSessionEvent: true });
      });
      void pollLocalServerPendingJobs();
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(String(event.data || '{}'));
        if (msg?.type === 'dispatch_bridge_job' && msg.job) {
          void pollLocalServerPendingJobs(msg.job.target);
        }
      } catch {
        // Ignore malformed frame
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
 * Claims pending live browser jobs from `:3001/api/bridge/jobs/pending?target=<platform>&claim=1`
 * ONLY for creator platforms that currently have an open browser tab, preserving `:3001`'s
 * smart 15s fast-fail for platforms that have no open session.
 * @param {string} [targetHint]
 */
async function pollLocalServerPendingJobs(targetHint) {
  await refreshConnectedTabs();

  const candidateTargets = targetHint
    ? [normalizeTarget(targetHint)].filter((t) => STATE.tabs[t].size > 0)
    : ALL_TARGETS.filter((t) => STATE.tabs[t].size > 0);

  if (candidateTargets.length === 0) return;

  let added = false;
  for (const target of candidateTargets) {
    try {
      const res = await fetch(
        `${LOCAL_RELAY_BASE}/api/bridge/jobs/pending?target=${encodeURIComponent(target)}&claim=1`
      );
      if (!res.ok) continue;
      const data = await res.json();
      if (!Array.isArray(data?.jobs) || data.jobs.length === 0) continue;

      for (const rawJob of data.jobs) {
        if (!rawJob?.jobId || isKnownJobId(rawJob.jobId)) continue;
        STATE.queue.push(
          normalizeIncomingJob({
            ...rawJob,
            target,
            fromServerQueue: true,
          })
        );
        added = true;
      }
    } catch {
      // Local `:3001` server may not be running
    }
  }

  if (added) {
    await persistState();
    await processQueue();
  }
}

/**
 * Reports job completion (or failure) back to `:3001/api/bridge/jobs/:jobId/complete`
 * so `POST /api/generate-node` & `POST /api/bridge/enqueue` callers receive local `/media/*` files.
 * @param {string} jobId
 * @param {Record<string, any>} completionBody
 */
async function reportServerBridgeJobCompletion(jobId, completionBody) {
  if (!jobId) return;
  try {
    await fetch(`${LOCAL_RELAY_BASE}/api/bridge/jobs/${encodeURIComponent(jobId)}/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(completionBody),
    });
  } catch {
    // Ignore if local relay is offline
  }
}

/**
 * Fetches a reference image (`http://localhost:3001/media/...` or HTTPS URL) in the
 * extension service worker context and converts it to a `data:<mime>;base64,...` URI
 * so content scripts on strict-CSP domains (`klingai.com`, `higgsfield.ai`, etc.)
 * can construct `File` objects for `DataTransfer` upload inputs without CORS/CSP blocks.
 * @param {string} rawUrl
 */
async function fetchUrlAsDataUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') {
    throw new Error('Missing reference URL');
  }
  if (rawUrl.startsWith('data:')) {
    const mimeMatch = /^data:([^;,]+)/i.exec(rawUrl);
    return {
      dataUrl: rawUrl,
      mimeType: mimeMatch ? mimeMatch[1] : 'image/png',
    };
  }
  const normalizedUrl = rawUrl.startsWith('/media/')
    ? `${LOCAL_RELAY_BASE}${rawUrl}`
    : rawUrl;

  const response = await fetch(normalizedUrl);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} fetching reference ${normalizedUrl}`);
  }
  const arrayBuf = await response.arrayBuffer();
  const bytes = new Uint8Array(arrayBuf);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  const base64 = btoa(binary);
  const contentType =
    (response.headers.get('content-type') || 'image/png').split(';')[0].trim() || 'image/png';
  return {
    dataUrl: `data:${contentType};base64,${base64}`,
    mimeType: contentType,
  };
}

/**
 * Pushes a captured creator asset event to `:3001/api/bridge/push`.
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
    for (const key of Object.keys(STATE.tabs)) {
      STATE.tabs[key].clear();
    }
    STATE.openDomains.clear();

    for (const tab of allTabs) {
      if (!tab.id || !tab.url) continue;
      const detected = detectTabPlatform(tab.url);
      if (detected && STATE.tabs[detected]) {
        STATE.tabs[detected].add(tab.id);
        if (detected !== 'studio') {
          try {
            const hostname = new URL(tab.url).hostname.toLowerCase();
            if (hostname) STATE.openDomains.add(hostname);
          } catch {
            // Ignore malformed URL
          }
        }
      }
    }
  } catch {
    // Ignore tab query permissions edge cases
  }
}

function buildBridgeStatusPayload() {
  /** @type {Record<string, boolean>} */
  const platformsConnected = {};
  /** @type {Record<string, number>} */
  const platformTabCounts = {};
  /** @type {Record<string, string | null>} */
  const activeJobs = {};

  for (const target of ALL_TARGETS) {
    platformsConnected[target] = STATE.tabs[target].size > 0;
    platformTabCounts[target] = STATE.tabs[target].size;
    activeJobs[target] = STATE.activeByTarget[target]?.jobId || null;
  }

  return {
    extensionVersion: '1.2.0',
    flowConnected: platformsConnected['google-flow'],
    dreaminaConnected: platformsConnected.dreamina,
    higgsfieldConnected: platformsConnected.higgsfield,
    sumeConnected: platformsConnected.sume,
    klingConnected: platformsConnected.kling,
    openartConnected: platformsConnected.openart,
    imagineartConnected: platformsConnected.imagineart,
    elevenlabsConnected: platformsConnected.elevenlabs,
    platformsConnected,
    platformTabCounts,
    openDomains: Array.from(STATE.openDomains),
    relayConnected,
    studioTabsCount: STATE.tabs.studio.size,
    flowTabsCount: STATE.tabs['google-flow'].size,
    dreaminaTabsCount: STATE.tabs.dreamina.size,
    queuedCount: STATE.queue.length,
    activeJobs,
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
  const rawMode = String(raw?.mode || '').toLowerCase();
  const mode =
    rawMode === 'video'
      ? 'video'
      : rawMode === 'audio' || target === 'elevenlabs'
        ? 'audio'
        : 'image';

  return {
    jobId,
    target,
    modelId: raw?.modelId ? String(raw.modelId) : undefined,
    mode,
    prompt: String(raw?.prompt || '').trim(),
    aspectRatio: raw?.aspectRatio || '16:9',
    durationSec: Number(raw?.durationSec || raw?.durationSeconds || 5),
    referenceImages: Array.isArray(raw?.referenceImages) ? raw.referenceImages.slice(0, 10) : [],
    keyframes: Array.isArray(raw?.keyframes) ? raw.keyframes.slice(0, 10) : [],
    previousInteractionId: raw?.previousInteractionId || null,
    autoOpenTab: raw?.autoOpenTab !== false,
    fromServerQueue: Boolean(raw?.fromServerQueue || String(jobId).startsWith('bjob_')),
    enqueuedAt: new Date().toISOString(),
    status: 'queued',
  };
}

async function ensureTargetTab(target, autoOpen = true) {
  await refreshConnectedTabs();
  const existing = Array.from(STATE.tabs[target] || []);
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

  for (const target of ALL_TARGETS) {
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
      message: `Dispatching job to ${TARGET_LABELS[target]} session...`,
    });

    const tabId = await ensureTargetTab(target, !job.fromServerQueue && job.autoOpenTab);
    if (!tabId) {
      STATE.activeByTarget[target] = null;
      const failedRecord = {
        ...job,
        status: 'failed',
        error: `No open ${TARGET_LABELS[target]} tab found. Open ${TARGET_URLS[target]} and sign in first.`,
        completedAt: new Date().toISOString(),
      };
      STATE.history.unshift(failedRecord);
      await persistState();
      if (job.fromServerQueue || String(job.jobId).startsWith('bjob_')) {
        await reportServerBridgeJobCompletion(job.jobId, {
          status: 'failed',
          target,
          error: failedRecord.error,
        });
      }
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
      const errOut = `Content script unreachable on ${TARGET_LABELS[target]}: ${errorMessage}`;
      STATE.history.unshift({
        ...job,
        status: 'failed',
        error: errOut,
        completedAt: new Date().toISOString(),
      });
      await persistState();
      if (job.fromServerQueue || String(job.jobId).startsWith('bjob_')) {
        await reportServerBridgeJobCompletion(job.jobId, {
          status: 'failed',
          target,
          error: errOut,
        });
      }
      await broadcastToStudio('DREAMFLOW_JOB_COMPLETE', {
        jobId: job.jobId,
        target: job.target,
        status: 'failed',
        error: `Unable to reach ${TARGET_LABELS[target]} tab. Refresh the tab and retry.`,
      });
    }
  }
}

chrome.tabs.onUpdated.addListener((_tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    refreshConnectedTabs().then(() => {
      sendRelayPlatformHeartbeats();
      broadcastToStudio('DREAMFLOW_BRIDGE_STATUS', buildBridgeStatusPayload());
    });
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  for (const set of Object.values(STATE.tabs)) {
    set.delete(tabId);
  }
  refreshConnectedTabs().then(() => {
    sendRelayPlatformHeartbeats();
    broadcastToStudio('DREAMFLOW_BRIDGE_STATUS', buildBridgeStatusPayload());
  });
});

chrome.alarms.create('dreamflow-queue-watchdog', { periodInMinutes: 0.5 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'dreamflow-queue-watchdog') {
    ensureLocalRelaySocket();
    refreshConnectedTabs().then(() => {
      sendRelayPlatformHeartbeats();
    });
    void pollLocalServerPendingJobs();
    processQueue();
  }
});

// 4-second live creator tab heartbeat while the MV3 service worker is awake
setInterval(() => {
  ensureLocalRelaySocket();
  void refreshConnectedTabs().then(() => {
    sendRelayPlatformHeartbeats();
  });
}, 4000);

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
        await refreshConnectedTabs();
        sendRelayPlatformHeartbeats({ fullSessionEvent: true });
        void pollLocalServerPendingJobs(target);
        const status = buildBridgeStatusPayload();
        await broadcastToStudio('DREAMFLOW_BRIDGE_STATUS', status);
        sendResponse({ ok: true, status });
        return;
      }

      case 'FETCH_REFERENCE_DATA_URL':
      case 'fetch_reference_data_url': {
        try {
          const result = await fetchUrlAsDataUrl(message.url);
          sendResponse({ ok: true, ...result });
        } catch (err) {
          sendResponse({
            ok: false,
            error: err instanceof Error ? err.message : String(err),
          });
        }
        return;
      }

      case 'STUDIO_PING': {
        if (sender.tab?.id) {
          STATE.tabs.studio.add(sender.tab.id);
        }
        await refreshConnectedTabs();
        sendRelayPlatformHeartbeats();
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
        for (const target of ALL_TARGETS) {
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
        const target = normalizeTarget(payload.target);
        await broadcastToStudio('DREAMFLOW_JOB_PROGRESS', {
          jobId: payload.jobId,
          target,
          status: payload.status || 'generating',
          progress: typeof payload.progress === 'number' ? payload.progress : 0.5,
          message: payload.message || `Synthesizing output on ${TARGET_LABELS[target]}...`,
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
          audioUrl: payload.audioUrl || null,
          error: payload.error || null,
          completedAt: new Date().toISOString(),
        };

        const isServerJob = Boolean(
          completedRecord.fromServerQueue || String(completedRecord.jobId).startsWith('bjob_')
        );

        if (isServerJob) {
          await reportServerBridgeJobCompletion(completedRecord.jobId, {
            status: completedRecord.status,
            target,
            videoUrl: completedRecord.videoUrl,
            imageUrl: completedRecord.imageUrl,
            audioUrl: completedRecord.audioUrl,
            dataUrl: payload.dataUrl || null,
            error: completedRecord.error,
          });
        }

        if (completedRecord.status === 'succeeded') {
          STATE.stats.completedCount += 1;
          STATE.stats.savedEstimateUsd = Number((STATE.stats.savedEstimateUsd + 0.35).toFixed(2));

          if (!isServerJob) {
            await pushEventToLocalRelay({
              type: 'bridge_asset',
              source: target === 'google-flow' ? 'flow' : target,
              mediaUrl:
                completedRecord.videoUrl ||
                completedRecord.audioUrl ||
                completedRecord.imageUrl,
              videoUrl: completedRecord.videoUrl,
              imageUrl: completedRecord.imageUrl,
              audioUrl: completedRecord.audioUrl,
              dataUrl: payload.dataUrl || null,
              title: `${TARGET_LABELS[target]} · Live Credit Capture`,
              prompt: completedRecord.prompt || '',
              metadata: {
                jobId: completedRecord.jobId,
                aspectRatio: completedRecord.aspectRatio || '16:9',
              },
            });
          }
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
          audioUrl: completedRecord.audioUrl,
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
          source: message.source || 'higgsfield',
          mediaUrl: message.mediaUrl || '/media/real_alpine_road.jpg',
          videoUrl: message.videoUrl || null,
          imageUrl: message.imageUrl || '/media/real_alpine_road.jpg',
          title: message.title || 'Bridge · 35mm Alpine Location Frame',
          prompt:
            message.prompt ||
            'Morning mist clearing over timber mountain pass, natural 35mm daylight',
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
        for (const target of ALL_TARGETS) {
          STATE.activeByTarget[target] = null;
        }
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
