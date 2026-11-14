import type {
  AspectRatio,
  AuthBootstrapInfo,
  AuthMePayload,
  BillingMetaEntry,
  BridgeIncomingEvent,
  BrowserPlatformTarget,
  BYOKCredentials,
  CloudAssetItem,
  ConnectionTransport,
  ConnectionsStatusSnapshot,
  CreditQuoteResponse,
  CreditsSummaryResponse,
  CreditSourcePreference,
  DiskProjectMeta,
  DiskProjectRecord,
  ExternalMcpServerRecord,
  KeyframeBridgeCurve,
  MCPToolDefinition,
  McpBackendHealth,
  McpOAuthSession,
  McpToolCallResult,
  ModelModality,
  PlatformDefinition,
  PlatformId,
  ProviderId,
  ProviderVerificationResult,
  ResolutionTier,
  SharedCreditGrant,
  StudioAuthUser,
  TeamMemberSummary,
} from '../types/studio';
import { renderShotDataUrl } from '../utils/proceduralMedia';

function resolveBackendOrigin(): string {
  const envBase =
    typeof import.meta !== 'undefined'
      ? (import.meta as { env?: Record<string, string | undefined> }).env?.VITE_API_BASE_URL
      : undefined;
  if (envBase && envBase.trim()) {
    return envBase.trim().replace(/\/+$/, '');
  }
  if (
    typeof window !== 'undefined' &&
    (window.location.protocol === 'http:' || window.location.protocol === 'https:')
  ) {
    const port = window.location.port;
    if (port && port !== '8789' && port !== '5173' && port !== '4173') {
      return window.location.origin;
    }
    if (
      !port &&
      window.location.hostname !== 'localhost' &&
      window.location.hostname !== '127.0.0.1'
    ) {
      return window.location.origin;
    }
  }
  return 'http://localhost:3001';
}

export const LOCAL_MCP_BASE = resolveBackendOrigin();
const LOCAL_MCP_WS_ORIGIN = LOCAL_MCP_BASE.replace(/^http:\/\//, 'ws://').replace(
  /^https:\/\//,
  'wss://'
);
export const LOCAL_MCP_HTTP_URL = `${LOCAL_MCP_BASE}/mcp`;
export const LOCAL_MCP_WS_URL = `${LOCAL_MCP_WS_ORIGIN}/mcp`;
export const LOCAL_BRIDGE_WS_URL = `${LOCAL_MCP_WS_ORIGIN}/bridge`;

export const AUTH_TOKEN_STORAGE_KEY = 'dreamflow_auth_token_v1';

let authModeActive = false;

export function setAuthModeActive(active: boolean): void {
  authModeActive = active;
}

export function getStoredAuthToken(): string | null {
  try {
    return typeof localStorage !== 'undefined'
      ? localStorage.getItem(AUTH_TOKEN_STORAGE_KEY)
      : null;
  } catch {
    return null;
  }
}

export function setStoredAuthToken(token: string | null): void {
  try {
    if (typeof localStorage === 'undefined') return;
    if (token) localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
    else localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
  } catch {
    // ignore storage errors
  }
}

export function buildAuthHeaders(extra?: HeadersInit): Headers {
  const headers = new Headers(extra);
  const token = getStoredAuthToken();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (authModeActive || token) {
    headers.set('X-Dreamflow-Require-Auth', '1');
  }
  return headers;
}

export function authFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  return fetch(input, {
    ...init,
    headers: buildAuthHeaders(init?.headers),
  });
}

export function getBridgeWsUrl(): string {
  const token = getStoredAuthToken();
  if (!token) return LOCAL_BRIDGE_WS_URL;
  const sep = LOCAL_BRIDGE_WS_URL.includes('?') ? '&' : '?';
  return `${LOCAL_BRIDGE_WS_URL}${sep}token=${encodeURIComponent(token)}`;
}

export type BackendProviderSlug =
  | 'gemini'
  | 'fal'
  | 'replicate'
  | 'seedance'
  | 'comfyui'
  | 'ffmpeg-local';

export function toBackendProviderSlug(provider?: ProviderId): BackendProviderSlug {
  switch (provider) {
    case 'gemini-api':
    case 'gemini-omni':
      return 'gemini';
    case 'fal':
      return 'fal';
    case 'replicate':
      return 'replicate';
    case 'seedance':
      return 'seedance';
    case 'comfyui':
      return 'comfyui';
    default:
      return 'ffmpeg-local';
  }
}

export function isCloudOrBridgeProvider(provider: ProviderId): boolean {
  return (
    provider === 'dreamina-bridge' ||
    provider === 'chrome-bridge-dreamina' ||
    provider === 'flow-bridge' ||
    provider === 'chrome-bridge-flow' ||
    provider === 'gemini-api' ||
    provider === 'gemini-omni' ||
    provider === 'fal' ||
    provider === 'replicate' ||
    provider === 'seedance' ||
    provider === 'comfyui'
  );
}

export function getProviderDisplayLabel(provider: ProviderId): string {
  switch (provider) {
    case 'dreamina-bridge':
    case 'chrome-bridge-dreamina':
      return 'Dreamina · Live Browser';
    case 'flow-bridge':
    case 'chrome-bridge-flow':
      return 'Google Flow · Live Browser';
    case 'gemini-api':
    case 'gemini-omni':
      return 'Google Gemini / Veo 3.1 API';
    case 'fal':
      return 'Fal.ai · Flux / Wan Pro';
    case 'replicate':
      return 'Replicate · Flux / Video';
    case 'seedance':
      return 'BytePlus · Seedream / Seedance';
    case 'comfyui':
      return 'ComfyUI · Local GPU (:8188)';
    case 'mcp-router':
      return 'MCP Studio Pipeline (:3001)';
    default:
      return 'FFmpeg 8.0 · Local Camera';
  }
}

export function getActiveApiKeyForProvider(
  provider: ProviderId,
  byok: BYOKCredentials
): string | undefined {
  switch (provider) {
    case 'gemini-api':
    case 'gemini-omni':
      return byok.geminiApiKey?.trim() || undefined;
    case 'seedance':
      return byok.seedanceApiKey?.trim() || undefined;
    case 'fal':
      return byok.falApiKey?.trim() || undefined;
    case 'replicate':
      return byok.replicateApiKey?.trim() || undefined;
    case 'openai':
      return byok.openaiApiKey?.trim() || undefined;
    default:
      return undefined;
  }
}

export interface GenerationRequest {
  provider: ProviderId;
  prompt: string;
  aspectRatio: AspectRatio;
  durationSec?: number;
  resolution?: ResolutionTier;
  mode: 'image' | 'video' | 'inpaint' | 'outpaint' | '9-grid' | 'multiframe';
  referenceImages?: string[];
  firstFrameDataUrl?: string;
  lastFrameDataUrl?: string;
  previousInteractionId?: string;
  cameraMotion?: string;
  mood?: string;
  outputName?: string;
  mcpTool?: MCPToolDefinition;
  byok: BYOKCredentials;
}

export interface GenerationResult {
  ok: boolean;
  error?: string;
  jobId?: string;
  providerLabel: string;
  interactionId: string;
  imageUrl?: string;
  videoUrl?: string;
  usedLiveEndpoint: boolean;
  costEstimateUsd: number;
}

export function normalizeBackendMediaUrl(
  rawUrl?: string,
  preferBackendOrigin = false
): string | undefined {
  if (!rawUrl || typeof rawUrl !== 'string') return undefined;
  if (
    rawUrl.startsWith('http://') ||
    rawUrl.startsWith('https://') ||
    rawUrl.startsWith('data:') ||
    rawUrl.startsWith('blob:')
  ) {
    return rawUrl;
  }
  const clean = rawUrl.startsWith('/') ? rawUrl : `/media/${rawUrl}`;
  return preferBackendOrigin && clean.startsWith('/media/')
    ? `${LOCAL_MCP_BASE}${clean}`
    : clean;
}

export function toBackendRelativeMediaPath(urlOrPath?: string): string | undefined {
  if (!urlOrPath) return undefined;
  if (urlOrPath.startsWith(`${LOCAL_MCP_BASE}/`)) {
    return urlOrPath.slice(LOCAL_MCP_BASE.length);
  }
  if (urlOrPath.startsWith('http://localhost:3001/')) {
    return urlOrPath.slice('http://localhost:3001'.length);
  }
  if (urlOrPath.startsWith('http://127.0.0.1:3001/')) {
    return urlOrPath.slice('http://127.0.0.1:3001'.length);
  }
  return urlOrPath;
}

export function stripDataUrlPrefix(dataUrl: string): { mimeType: string; base64: string } {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    return { mimeType: 'image/png', base64: dataUrl };
  }
  return { mimeType: match[1], base64: match[2] };
}

export function estimateZeroMarkupCostUsd(
  provider: ProviderId,
  mode: GenerationRequest['mode'],
  durationSec = 5,
  resolution: ResolutionTier = '1080p'
): number {
  if (
    provider === 'ffmpeg-local' ||
    provider === 'local-canvas' ||
    provider === 'comfyui' ||
    provider === 'mcp-router' ||
    provider === 'dreamina-bridge' ||
    provider === 'flow-bridge' ||
    provider === 'chrome-bridge-flow' ||
    provider === 'chrome-bridge-dreamina'
  ) {
    return 0;
  }
  if (mode === 'image' || mode === 'inpaint' || mode === 'outpaint' || mode === '9-grid') {
    return resolution === '4K' ? 0.04 : 0.02;
  }
  const perSec =
    provider === 'gemini-api' || provider === 'gemini-omni'
      ? resolution === '360p'
        ? 0.015
        : 0.045
      : provider === 'seedance'
      ? 0.038
      : 0.05;
  return Number((perSec * durationSec).toFixed(3));
}

export async function probeLiveMcpBackend(): Promise<McpBackendHealth> {
  const start = performance.now();
  const serverName = 'Local Open-DreamFlow MCP + FFmpeg Engine';

  try {
    const healthCtrl = new AbortController();
    const healthTimer = setTimeout(() => healthCtrl.abort(), 2200);

    const [healthRes, mcpDiscovery] = await Promise.allSettled([
      authFetch(`${LOCAL_MCP_BASE}/api/health`, { signal: healthCtrl.signal }).then(async (r) => {
        clearTimeout(healthTimer);
        if (!r.ok) return null;
        return (await r.json()) as {
          ok?: boolean;
          ffmpeg?: boolean;
          ffmpegAvailable?: boolean;
          mcpTools?: Array<string | { name: string; description?: string }>;
          mediaFiles?: string[];
          savedProjectsCount?: number;
          bridgeClients?: number;
        };
      }),
      discoverMcpTools(LOCAL_MCP_HTTP_URL, serverName),
    ]);

    clearTimeout(healthTimer);

    const healthData =
      healthRes.status === 'fulfilled' && healthRes.value ? healthRes.value : null;
    const disc =
      mcpDiscovery.status === 'fulfilled'
        ? mcpDiscovery.value
        : {
            connected: false,
            pingMs: Math.round(performance.now() - start),
            tools: getDefaultDiscoveredMcpTools(LOCAL_MCP_HTTP_URL, serverName),
          };

    const online = Boolean(healthData?.ok || disc.connected);
    const ffmpegAvailable = Boolean(healthData?.ffmpeg ?? healthData?.ffmpegAvailable ?? online);
    const tools =
      disc.tools.length > 0
        ? disc.tools
        : getDefaultDiscoveredMcpTools(LOCAL_MCP_HTTP_URL, serverName);
    const toolCount = Math.max(
      tools.length,
      Array.isArray(healthData?.mcpTools) ? healthData!.mcpTools!.length : 0
    );

    return {
      online,
      ffmpegAvailable,
      toolCount: online ? Math.max(toolCount, 12) : tools.length,
      tools,
      mediaFiles: Array.isArray(healthData?.mediaFiles) ? healthData!.mediaFiles! : [],
      baseUrl: LOCAL_MCP_BASE,
      pingMs: Math.round(performance.now() - start),
      savedProjectsCount: healthData?.savedProjectsCount,
      bridgeClients: healthData?.bridgeClients,
    };
  } catch {
    const fallbackTools = getDefaultDiscoveredMcpTools(LOCAL_MCP_HTTP_URL, serverName);
    return {
      online: false,
      ffmpegAvailable: false,
      toolCount: fallbackTools.length,
      tools: fallbackTools,
      mediaFiles: [],
      baseUrl: LOCAL_MCP_BASE,
    };
  }
}

export async function verifyProviderViaBackend(params: {
  provider:
    | 'gemini'
    | 'fal'
    | 'replicate'
    | 'seedance'
    | 'comfyui'
    | 'kling'
    | 'elevenlabs'
    | 'openai'
    | 'higgsfield'
    | 'sume'
    | 'openart'
    | 'imagineart';
  apiKey?: string;
  accessKey?: string;
  secretKey?: string;
  baseUrl?: string;
}): Promise<ProviderVerificationResult> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 18000);
    const res = await authFetch(`${LOCAL_MCP_BASE}/api/verify-provider`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: ctrl.signal,
      body: JSON.stringify(params),
    });
    clearTimeout(timer);
    const json = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      valid?: boolean;
      videoModels?: string[];
      imageModels?: string[];
      models?: string[];
      allCount?: number;
      error?: string;
      message?: string;
    };
    const valid = Boolean(res.ok && (json.valid ?? json.ok));
    return {
      checkedAt: Date.now(),
      valid,
      videoModels: Array.isArray(json.videoModels) ? json.videoModels : [],
      imageModels: Array.isArray(json.imageModels) ? json.imageModels : [],
      allCount: json.allCount,
      error: valid ? undefined : json.error || json.message || `Verification failed (HTTP ${res.status})`,
      message: json.message,
    };
  } catch (err) {
    return {
      checkedAt: Date.now(),
      valid: false,
      error:
        err instanceof Error
          ? `Could not reach :3001 verification endpoint (${err.message})`
          : 'Could not reach :3001 verification endpoint',
    };
  }
}

export async function fetchPlatformCatalogViaBackend(forceRefresh = false): Promise<{
  ok: boolean;
  platforms: PlatformDefinition[];
}> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const url = forceRefresh
      ? `${LOCAL_MCP_BASE}/api/platforms?forceRefresh=1`
      : `${LOCAL_MCP_BASE}/api/platforms`;
    const res = await fetch(url, {
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return { ok: false, platforms: [] };
    const json = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      platforms?: PlatformDefinition[];
    };
    if (!Array.isArray(json.platforms)) return { ok: false, platforms: [] };
    return { ok: true, platforms: json.platforms };
  } catch {
    return { ok: false, platforms: [] };
  }
}

export interface GenerateNodeBackendParams {
  nodeId: string;
  kind: ModelModality;
  platformId: PlatformId;
  connectionMode: ConnectionTransport;
  modelId: string;
  prompt: string;
  negativePrompt?: string;
  settings: {
    aspectRatio?: AspectRatio;
    resolution?: ResolutionTier;
    quality?: string;
    batchCount?: 1 | 2 | 4;
    durationSec?: number;
    audioEnabled?: boolean;
    audioMode?: 'tts' | 'ambient' | 'voiceover' | 'sfx';
    voiceId?: string;
    seed?: number;
    modelParams?: Record<string, string | number | boolean>;
  };
  modelParams?: Record<string, string | number | boolean>;
  referenceImages?: string[];
  videoReferences?: string[];
  referenceFrameMode?: 'multi-ref' | 'start-end';
  startImageUrl?: string;
  endImageUrl?: string;
  mcpServerId?: string;
  mcpToolName?: string;
  creditSource?: CreditSourcePreference;
  credentials?: {
    apiKey?: string;
    accessKey?: string;
    secretKey?: string;
    baseUrl?: string;
  };
}

export interface GenerateNodeBackendResult {
  ok: boolean;
  platformId?: string;
  modelId?: string;
  transportUsed?: string;
  providerUsed?: string;
  mediaUrl?: string;
  fullUrl?: string;
  imageUrl?: string;
  videoUrl?: string;
  audioUrl?: string;
  waveform?: number[];
  outputs?: string[];
  jobId?: string;
  error?: string;
}

export async function generateNodeViaBackend(
  params: GenerateNodeBackendParams
): Promise<GenerateNodeBackendResult> {
  try {
    const ctrl = new AbortController();
    const timeoutMs = params.kind === 'video' ? 390000 : 240000;
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    const cleanedRefs = (params.referenceImages || [])
      .filter(Boolean)
      .map((u) => toBackendRelativeMediaPath(u) || u);
    const cleanedVideoRefs = (params.videoReferences || [])
      .filter(Boolean)
      .map((u) => toBackendRelativeMediaPath(u) || u);
    const cleanedStartImg = params.startImageUrl
      ? toBackendRelativeMediaPath(params.startImageUrl) || params.startImageUrl
      : undefined;
    const cleanedEndImg = params.endImageUrl
      ? toBackendRelativeMediaPath(params.endImageUrl) || params.endImageUrl
      : undefined;

    const res = await authFetch(`${LOCAL_MCP_BASE}/api/generate-node`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: ctrl.signal,
      body: JSON.stringify({
        ...params,
        referenceImages: cleanedRefs,
        ...(cleanedVideoRefs.length > 0 ? { videoReferences: cleanedVideoRefs } : {}),
        ...(params.referenceFrameMode ? { referenceFrameMode: params.referenceFrameMode } : {}),
        ...(cleanedStartImg ? { startImageUrl: cleanedStartImg } : {}),
        ...(cleanedEndImg ? { endImageUrl: cleanedEndImg } : {}),
        ...(params.creditSource ? { creditSource: params.creditSource } : {}),
      }),
    });
    clearTimeout(timer);

    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok || json.ok === false) {
      return {
        ok: false,
        error:
          (typeof json.error === 'string' && json.error) ||
          (typeof json.message === 'string' && json.message) ||
          `Generation failed on ${params.platformId} (HTTP ${res.status})`,
      };
    }

    const rawMedia =
      (typeof json.mediaUrl === 'string' && json.mediaUrl) ||
      (typeof json.url === 'string' && json.url) ||
      undefined;
    const rawImg =
      (typeof json.imageUrl === 'string' && json.imageUrl) ||
      (typeof json.localImageUrl === 'string' && json.localImageUrl) ||
      (params.kind === 'image' ? rawMedia : undefined);
    const rawVid =
      (typeof json.videoUrl === 'string' && json.videoUrl) ||
      (typeof json.localVideoUrl === 'string' && json.localVideoUrl) ||
      (params.kind === 'video' ? rawMedia : undefined);
    const rawAud =
      (typeof json.audioUrl === 'string' && json.audioUrl) ||
      (typeof json.localAudioUrl === 'string' && json.localAudioUrl) ||
      (params.kind === 'audio' ? rawMedia : undefined);

    const normImg = rawImg ? toBackendRelativeMediaPath(rawImg) || rawImg : undefined;
    const normVid = rawVid ? toBackendRelativeMediaPath(rawVid) || rawVid : undefined;
    const normAud = rawAud ? toBackendRelativeMediaPath(rawAud) || rawAud : undefined;
    const normMedia =
      normVid ||
      normImg ||
      normAud ||
      (rawMedia ? toBackendRelativeMediaPath(rawMedia) || rawMedia : undefined);

    const rawOutputs = Array.isArray(json.outputs)
      ? (json.outputs as unknown[]).filter((x): x is string => typeof x === 'string')
      : [];
    const outputs = rawOutputs.map((u) => toBackendRelativeMediaPath(u) || u);

    if (!normMedia && outputs.length === 0) {
      return {
        ok: false,
        error:
          (typeof json.error === 'string' && json.error) ||
          `No media output returned from ${params.platformId} (${params.modelId}).`,
      };
    }

    const primaryMedia = normMedia || outputs[0];
    return {
      ok: true,
      platformId: (json.platformId as string) || params.platformId,
      modelId: (json.modelId as string) || params.modelId,
      transportUsed: json.transportUsed as string | undefined,
      providerUsed:
        (typeof json.providerUsed === 'string' && json.providerUsed) ||
        `${params.platformId} · ${params.modelId}`,
      mediaUrl: primaryMedia,
      fullUrl:
        (typeof json.fullUrl === 'string' && json.fullUrl) ||
        normalizeBackendMediaUrl(primaryMedia, true),
      imageUrl: normImg || (params.kind === 'image' ? primaryMedia : undefined),
      videoUrl: normVid || (params.kind === 'video' ? primaryMedia : undefined),
      audioUrl: normAud || (params.kind === 'audio' ? primaryMedia : undefined),
      waveform: Array.isArray(json.waveform)
        ? (json.waveform as number[])
        : undefined,
      outputs: outputs.length > 0 ? outputs : primaryMedia ? [primaryMedia] : [],
      jobId: json.jobId as string | undefined,
    };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error && err.name === 'AbortError'
          ? `Timed out waiting for ${params.platformId} (${params.modelId}) to finish generating.`
          : err instanceof Error
          ? `Could not reach :3001 /api/generate-node (${err.message})`
          : 'Could not reach :3001 /api/generate-node',
    };
  }
}

export async function fetchConnectionsStatusViaBackend(): Promise<ConnectionsStatusSnapshot> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    const res = await authFetch(`${LOCAL_MCP_BASE}/api/connections/status`, {
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (!res.ok) {
      return {
        ok: false,
        bridgeClients: 0,
        connectedBrowserPlatforms: [],
        connectedMcpPlatforms: [],
        configuredApiPlatforms: [],
      };
    }
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    const toPlatArray = (val: unknown): PlatformId[] =>
      Array.isArray(val) ? (val.filter((x): x is string => typeof x === 'string') as PlatformId[]) : [];

    const connectedBrowserPlatforms = new Set<PlatformId>(
      toPlatArray(json.connectedBrowserPlatforms)
    );
    const connectedMcpPlatforms = new Set<PlatformId>(
      toPlatArray(json.connectedMcpPlatforms)
    );
    const configuredApiPlatforms = new Set<PlatformId>([
      ...toPlatArray(json.configuredApiKeyPlatforms),
      ...toPlatArray(json.configuredApiPlatforms),
      ...toPlatArray(json.configuredEnvPlatforms),
      ...toPlatArray(json.apiKeyPlatforms),
    ]);

    if (Array.isArray(json.platforms)) {
      for (const item of json.platforms) {
        if (!item || typeof item !== 'object') continue;
        const rec = item as Record<string, unknown>;
        const id = rec.id as PlatformId | undefined;
        if (!id) continue;
        if (rec.browserConnected) connectedBrowserPlatforms.add(id);
        if (rec.mcpConnected) connectedMcpPlatforms.add(id);
        if (rec.apiKeyConnected) configuredApiPlatforms.add(id);
      }
    }

    const byId =
      json.byId && typeof json.byId === 'object'
        ? (json.byId as Record<string, Record<string, unknown>>)
        : {};
    const mcpBalances: Record<string, ConnectionsStatusSnapshot['mcpBalance'] & object> = {};
    if (json.mcpBalances && typeof json.mcpBalances === 'object') {
      for (const [k, v] of Object.entries(json.mcpBalances as Record<string, unknown>)) {
        if (v && typeof v === 'object') {
          mcpBalances[k] = v as NonNullable<ConnectionsStatusSnapshot['mcpBalance']>;
        }
      }
    }
    for (const [k, rec] of Object.entries(byId)) {
      if (rec?.mcpBalance && typeof rec.mcpBalance === 'object' && !mcpBalances[k]) {
        mcpBalances[k] = rec.mcpBalance as NonNullable<ConnectionsStatusSnapshot['mcpBalance']>;
      }
    }
    const rawMcpServers = Array.isArray(json.mcpServers)
      ? (json.mcpServers as ExternalMcpServerRecord[])
      : [];
    const enrichedMcpServers = rawMcpServers.map((srv) => {
      const pid = String(srv.platformId);
      const pidRec = byId[pid];
      const bal =
        srv.balance ||
        mcpBalances[pid] ||
        (pidRec?.mcpBalance as ExternalMcpServerRecord['balance']);
      if (bal && !mcpBalances[pid]) {
        mcpBalances[pid] = bal;
      }
      return bal ? { ...srv, balance: bal } : srv;
    });
    const topBalance =
      (json.mcpBalance as ConnectionsStatusSnapshot['mcpBalance']) ||
      mcpBalances.higgsfield ||
      (byId.higgsfield?.mcpBalance as ConnectionsStatusSnapshot['mcpBalance']) ||
      enrichedMcpServers.find((s) => s.balance)?.balance;

    return {
      ok: Boolean(json.ok ?? true),
      bridgeClients: typeof json.bridgeClients === 'number' ? json.bridgeClients : 0,
      connectedBrowserPlatforms: Array.from(connectedBrowserPlatforms),
      connectedMcpPlatforms: Array.from(connectedMcpPlatforms),
      configuredApiPlatforms: Array.from(configuredApiPlatforms),
      mcpServers: enrichedMcpServers,
      mcpBalance: topBalance,
      mcpBalances,
      ownConnected: Array.isArray(json.ownConnected)
        ? (json.ownConnected.filter((x): x is string => typeof x === 'string'))
        : undefined,
      sharedAvailable: Array.isArray(json.sharedAvailable)
        ? (json.sharedAvailable as SharedCreditGrant[])
        : undefined,
      connectedPlatforms: Array.isArray(json.connectedPlatforms)
        ? (json.connectedPlatforms.filter((x): x is string => typeof x === 'string'))
        : undefined,
      browserSessionOpen: Boolean(json.browserSessionOpen),
      activeBrowserProfileDir:
        typeof json.activeBrowserProfileDir === 'string'
          ? json.activeBrowserProfileDir
          : undefined,
    };
  } catch {
    return {
      ok: false,
      bridgeClients: 0,
      connectedBrowserPlatforms: [],
      connectedMcpPlatforms: [],
      configuredApiPlatforms: [],
      mcpServers: [],
    };
  }
}

export async function launchConnectedBrowserViaBackend(
  platformId: string = 'all'
): Promise<{
  ok: boolean;
  launched?: boolean;
  browserName?: string;
  profileDir?: string;
  urls?: string[];
  activeTabsConnected?: string[];
  error?: string;
}> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 12000);
    const res = await authFetch(`${LOCAL_MCP_BASE}/api/connections/launch-browser`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: ctrl.signal,
      body: JSON.stringify({ platformId }),
    });
    clearTimeout(timer);
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok || json.ok === false) {
      return {
        ok: false,
        error:
          (typeof json.error === 'string' && json.error) ||
          `Could not launch connected browser (HTTP ${res.status})`,
      };
    }
    return {
      ok: true,
      launched: Boolean(json.launched ?? true),
      browserName: typeof json.browserName === 'string' ? json.browserName : 'Google Chrome',
      profileDir: typeof json.profileDir === 'string' ? json.profileDir : undefined,
      urls: Array.isArray(json.urls)
        ? json.urls.filter((u): u is string => typeof u === 'string')
        : undefined,
      activeTabsConnected: Array.isArray(json.activeTabsConnected)
        ? json.activeTabsConnected.filter((u): u is string => typeof u === 'string')
        : undefined,
    };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error
          ? `Could not reach :3001 browser launcher (${err.message})`
          : 'Could not reach :3001 browser launcher',
    };
  }
}

export async function checkBrowserConnectionsViaBackend(
  platformId?: string
): Promise<{
  ok: boolean;
  connectedBrowserPlatforms: PlatformId[];
  openDomains: string[];
  cdpReachable?: boolean;
  error?: string;
}> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    const res = await authFetch(`${LOCAL_MCP_BASE}/api/connections/check-browser`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: ctrl.signal,
      body: JSON.stringify(platformId ? { platformId } : {}),
    });
    clearTimeout(timer);
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok || json.ok === false) {
      return {
        ok: false,
        connectedBrowserPlatforms: [],
        openDomains: [],
        error:
          (typeof json.error === 'string' && json.error) ||
          `Browser check failed (HTTP ${res.status})`,
      };
    }
    return {
      ok: true,
      connectedBrowserPlatforms: Array.isArray(json.connectedBrowserPlatforms)
        ? (json.connectedBrowserPlatforms.filter((x): x is string => typeof x === 'string') as PlatformId[])
        : [],
      openDomains: Array.isArray(json.openDomains)
        ? json.openDomains.filter((x): x is string => typeof x === 'string')
        : [],
      cdpReachable: typeof json.cdpReachable === 'boolean' ? json.cdpReachable : undefined,
    };
  } catch (err) {
    return {
      ok: false,
      connectedBrowserPlatforms: [],
      openDomains: [],
      error:
        err instanceof Error
          ? `Could not check browser sessions (${err.message})`
          : 'Could not check browser sessions',
    };
  }
}

export async function startMcpOAuthViaBackend(
  platformId: string,
  mcpUrl?: string
): Promise<{
  ok: boolean;
  sessionId?: string;
  state?: string;
  platformId?: string;
  mcpUrl?: string;
  authorizeUrl?: string;
  step?: McpOAuthSession['step'];
  error?: string;
}> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15000);
    const res = await authFetch(`${LOCAL_MCP_BASE}/api/mcp/oauth/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: ctrl.signal,
      body: JSON.stringify({ platformId, ...(mcpUrl ? { mcpUrl } : {}) }),
    });
    clearTimeout(timer);
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok || json.ok === false) {
      return {
        ok: false,
        error:
          (typeof json.error === 'string' && json.error) ||
          `Failed to start MCP OAuth (HTTP ${res.status})`,
      };
    }
    return {
      ok: true,
      sessionId: typeof json.sessionId === 'string' ? json.sessionId : undefined,
      state: typeof json.state === 'string' ? json.state : undefined,
      platformId: typeof json.platformId === 'string' ? json.platformId : platformId,
      mcpUrl: typeof json.mcpUrl === 'string' ? json.mcpUrl : mcpUrl,
      authorizeUrl: typeof json.authorizeUrl === 'string' ? json.authorizeUrl : undefined,
      step: typeof json.step === 'string' ? (json.step as McpOAuthSession['step']) : 'awaiting_login',
    };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error
          ? `Could not reach :3001 MCP OAuth endpoint (${err.message})`
          : 'Could not reach :3001 MCP OAuth endpoint',
    };
  }
}

export async function getMcpOAuthStatusViaBackend(sessionId: string): Promise<{
  ok: boolean;
  session?: McpOAuthSession;
  error?: string;
}> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    const res = await authFetch(
      `${LOCAL_MCP_BASE}/api/mcp/oauth/status/${encodeURIComponent(sessionId)}`,
      { signal: ctrl.signal }
    );
    clearTimeout(timer);
    const json = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      session?: McpOAuthSession;
      error?: string;
    };
    if (!res.ok || json.ok === false || !json.session) {
      return {
        ok: false,
        error: json.error || `Status check failed (HTTP ${res.status})`,
      };
    }
    return { ok: true, session: json.session };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Status check network error',
    };
  }
}

export async function startDreaminaMcpConnectViaBackend(payload: {
  mode?: 'cli_oauth' | 'browser' | 'session' | 'ark_api_key';
  sessionIdCookie?: string;
  arkApiKey?: string;
  arkEndpoint?: string;
  launchBrowser?: boolean;
}): Promise<{
  ok: boolean;
  session?: McpOAuthSession;
  error?: string;
}> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 25000);
    const res = await authFetch(`${LOCAL_MCP_BASE}/api/mcp/dreamina/connect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: ctrl.signal,
      body: JSON.stringify(payload),
    });
    clearTimeout(timer);
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok || json.ok === false) {
      return {
        ok: false,
        error:
          (typeof json.error === 'string' && json.error) ||
          `Dreamina MCP connect failed (HTTP ${res.status})`,
      };
    }
    const rawSess = (json.session && typeof json.session === 'object'
      ? (json.session as Partial<McpOAuthSession>)
      : {}) as Partial<McpOAuthSession>;
    const session: McpOAuthSession = {
      sessionId:
        rawSess.sessionId ||
        (typeof json.sessionId === 'string' ? json.sessionId : `drm_mcp_${Date.now()}`),
      platformId: rawSess.platformId || 'dreamina',
      mcpUrl:
        rawSess.mcpUrl ||
        (typeof json.mcpUrl === 'string' ? json.mcpUrl : 'dreamina://mcp/dreamina-canvas'),
      authorizeUrl:
        rawSess.authorizeUrl ||
        (typeof json.authorizeUrl === 'string'
          ? json.authorizeUrl
          : undefined),
      userCode:
        rawSess.userCode ||
        (typeof json.userCode === 'string' ? json.userCode : undefined),
      step:
        rawSess.step ||
        (typeof json.step === 'string' ? (json.step as McpOAuthSession['step']) : 'awaiting_login'),
      serverId:
        rawSess.serverId ||
        (typeof json.serverId === 'string' ? json.serverId : undefined),
      account:
        rawSess.account ||
        (json.account && typeof json.account === 'object'
          ? (json.account as McpOAuthSession['account'])
          : undefined),
      balance:
        rawSess.balance ||
        (json.balance && typeof json.balance === 'object'
          ? (json.balance as McpOAuthSession['balance'])
          : undefined),
      tools:
        rawSess.tools ||
        (Array.isArray(json.tools) ? (json.tools as McpOAuthSession['tools']) : undefined),
      updatedAt: rawSess.updatedAt || Date.now(),
      error: rawSess.error,
    };
    return { ok: true, session };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error
          ? `Could not reach :3001 Dreamina MCP connect (${err.message})`
          : 'Could not reach :3001 Dreamina MCP connect',
    };
  }
}

export async function getDreaminaMcpStatusViaBackend(sessionId: string): Promise<{
  ok: boolean;
  session?: McpOAuthSession;
  error?: string;
}> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    const res = await authFetch(
      `${LOCAL_MCP_BASE}/api/mcp/dreamina/status/${encodeURIComponent(sessionId)}`,
      { signal: ctrl.signal }
    );
    clearTimeout(timer);
    const json = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      session?: McpOAuthSession;
      error?: string;
    };
    if (!res.ok || json.ok === false || !json.session) {
      return {
        ok: false,
        error: json.error || `Dreamina MCP status check failed (HTTP ${res.status})`,
      };
    }
    return { ok: true, session: json.session };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Dreamina MCP status network error',
    };
  }
}

export async function disconnectDreaminaMcpViaBackend(): Promise<{
  ok: boolean;
  error?: string;
}> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const res = await authFetch(`${LOCAL_MCP_BASE}/api/mcp/dreamina/disconnect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
    return { ok: res.ok && json.ok !== false, error: json.error };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Dreamina disconnect network error',
    };
  }
}

export async function callExternalMcpToolViaBackend(
  serverId: string,
  toolName: string,
  args: Record<string, unknown> = {}
): Promise<McpToolCallResult> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 120000);
    const res = await authFetch(`${LOCAL_MCP_BASE}/api/mcp/call`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: ctrl.signal,
      body: JSON.stringify({
        serverId,
        toolName,
        args,
        arguments: args,
      }),
    });
    clearTimeout(timer);
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok || json.ok === false) {
      return {
        ok: false,
        serverId,
        toolName,
        error:
          (typeof json.error === 'string' && json.error) ||
          `MCP tool call failed (HTTP ${res.status})`,
        rawResult: json.rawResult ?? json,
      };
    }
    const relMedia =
      (typeof json.mediaUrl === 'string' && json.mediaUrl) ||
      (typeof json.imageUrl === 'string' && json.imageUrl) ||
      (typeof json.videoUrl === 'string' && json.videoUrl) ||
      (typeof json.audioUrl === 'string' && json.audioUrl) ||
      undefined;
    return {
      ok: true,
      serverId: (typeof json.serverId === 'string' && json.serverId) || serverId,
      toolName: (typeof json.toolName === 'string' && json.toolName) || toolName,
      textContent: typeof json.textContent === 'string' ? json.textContent : undefined,
      structuredData: json.structuredData,
      mediaUrl: relMedia,
      fullUrl:
        (typeof json.fullUrl === 'string' && json.fullUrl) ||
        (relMedia ? normalizeBackendMediaUrl(relMedia, true) : undefined),
      imageUrl: typeof json.imageUrl === 'string' ? json.imageUrl : undefined,
      videoUrl: typeof json.videoUrl === 'string' ? json.videoUrl : undefined,
      audioUrl: typeof json.audioUrl === 'string' ? json.audioUrl : undefined,
      rawResult: json.rawResult ?? json,
    };
  } catch (err) {
    return {
      ok: false,
      serverId,
      toolName,
      error:
        err instanceof Error
          ? `MCP call error (${err.message})`
          : 'MCP call error',
    };
  }
}

export async function listExternalMcpServers(): Promise<{
  ok: boolean;
  servers: ExternalMcpServerRecord[];
}> {
  try {
    const res = await authFetch(`${LOCAL_MCP_BASE}/api/mcp/servers`);
    if (!res.ok) return { ok: false, servers: [] };
    const json = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      servers?: ExternalMcpServerRecord[];
    };
    return {
      ok: Boolean(json.ok ?? true),
      servers: Array.isArray(json.servers) ? json.servers : [],
    };
  } catch {
    return { ok: false, servers: [] };
  }
}

export async function registerExternalMcpServer(payload: {
  id?: string;
  name: string;
  platformId: string;
  transport: 'stdio' | 'http';
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  headers?: Record<string, string>;
}): Promise<{
  ok: boolean;
  server?: ExternalMcpServerRecord;
  error?: string;
}> {
  try {
    const res = await authFetch(`${LOCAL_MCP_BASE}/api/mcp/servers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      server?: ExternalMcpServerRecord;
      error?: string;
    };
    if (!res.ok || json.ok === false) {
      return {
        ok: false,
        error: json.error || `Failed to connect MCP server (HTTP ${res.status})`,
      };
    }
    return { ok: true, server: json.server };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Failed to connect MCP server on :3001',
    };
  }
}

export async function refreshExternalMcpServer(id: string): Promise<{
  ok: boolean;
  server?: ExternalMcpServerRecord;
  error?: string;
}> {
  try {
    const res = await authFetch(
      `${LOCAL_MCP_BASE}/api/mcp/servers/${encodeURIComponent(id)}/refresh`,
      { method: 'POST' }
    );
    const json = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      server?: ExternalMcpServerRecord;
      error?: string;
    };
    if (!res.ok || json.ok === false) {
      return { ok: false, error: json.error || 'Refresh failed' };
    }
    return { ok: true, server: json.server };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Refresh failed' };
  }
}

export async function deleteExternalMcpServer(id: string): Promise<{ ok: boolean }> {
  try {
    const res = await authFetch(
      `${LOCAL_MCP_BASE}/api/mcp/servers/${encodeURIComponent(id)}`,
      { method: 'DELETE' }
    );
    return { ok: res.ok };
  } catch {
    return { ok: false };
  }
}

export async function callExternalMcpTool(params: {
  serverId: string;
  toolName: string;
  arguments: Record<string, unknown>;
}): Promise<{ ok: boolean; result?: unknown; error?: string }> {
  try {
    const res = await authFetch(`${LOCAL_MCP_BASE}/api/mcp/call`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const json = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      result?: unknown;
      error?: string;
    };
    if (!res.ok || json.ok === false) {
      return { ok: false, error: json.error || `MCP tool call failed (${res.status})` };
    }
    return { ok: true, result: json.result ?? json };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'MCP tool call failed' };
  }
}

export async function generateImageViaBackend(params: {
  prompt: string;
  aspectRatio?: AspectRatio;
  referenceImages?: string[];
  provider?: ProviderId;
  apiKey?: string;
  baseUrl?: string;
}): Promise<{
  ok: boolean;
  imageUrl?: string;
  fullUrl?: string;
  model?: string;
  engine?: string;
  error?: string;
}> {
  try {
    const backendProvider = toBackendProviderSlug(params.provider);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 120000);
    const res = await authFetch(`${LOCAL_MCP_BASE}/api/generate-image`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: ctrl.signal,
      body: JSON.stringify({
        prompt: params.prompt,
        aspectRatio: params.aspectRatio || '16:9',
        referenceImages: params.referenceImages,
        provider: backendProvider,
        apiKey: params.apiKey,
        baseUrl: params.baseUrl,
      }),
    });
    clearTimeout(timer);

    const json = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      imageUrl?: string;
      fullUrl?: string;
      url?: string;
      model?: string;
      engine?: string;
      error?: string;
    };

    if (!res.ok || json.ok === false) {
      return {
        ok: false,
        error: json.error || `Image generation failed (HTTP ${res.status})`,
      };
    }

    const rel = json.imageUrl || toBackendRelativeMediaPath(json.fullUrl || json.url);
    const full = json.fullUrl || normalizeBackendMediaUrl(rel || json.url, true);
    if (!rel && !full) {
      return { ok: false, error: json.error || 'No image URL returned from backend' };
    }

    return {
      ok: true,
      imageUrl: rel || full,
      fullUrl: full || rel,
      model: json.model,
      engine: json.engine,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Network error calling /api/generate-image',
    };
  }
}

export async function enqueueLiveBridgeJobViaBackend(params: {
  target: BrowserPlatformTarget;
  mode: 'image' | 'video' | 'audio';
  prompt: string;
  modelId?: string;
  aspectRatio?: AspectRatio;
  durationSec?: number;
  referenceImages?: string[];
  waitForResult?: boolean;
  timeoutMs?: number;
}): Promise<{
  ok: boolean;
  jobId?: string;
  status?: string;
  imageUrl?: string;
  videoUrl?: string;
  fullUrl?: string;
  error?: string;
}> {
  try {
    const timeoutMs = params.timeoutMs ?? 180000;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs + 10000);

    const res = await authFetch(`${LOCAL_MCP_BASE}/api/bridge/enqueue`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: ctrl.signal,
      body: JSON.stringify({
        target: params.target,
        mode: params.mode,
        prompt: params.prompt,
        aspectRatio: params.aspectRatio || '16:9',
        durationSec: params.durationSec || 6,
        referenceImages: params.referenceImages || [],
        waitForResult: params.waitForResult ?? true,
        timeoutMs,
      }),
    });
    clearTimeout(timer);

    const json = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      jobId?: string;
      imageUrl?: string;
      localImageUrl?: string;
      videoUrl?: string;
      localVideoUrl?: string;
      fullUrl?: string;
      error?: string;
      job?: {
        jobId?: string;
        status?: string;
        imageUrl?: string;
        localImageUrl?: string;
        videoUrl?: string;
        localVideoUrl?: string;
        resultUrl?: string;
        fullUrl?: string;
        error?: string;
      };
    };

    const job = json.job || {};
    const jobId = job.jobId || json.jobId;
    const status = job.status;

    if (!res.ok || json.ok === false || status === 'failed') {
      return {
        ok: false,
        jobId,
        status,
        error:
          json.error ||
          job.error ||
          `No live ${params.target === 'dreamina' ? 'Dreamina' : 'Google Flow'} browser session answered within timeout. Open the tab with Chrome Bridge or run the 1-line connector in BYOK · MCP → Browser Credit Bridge.`,
      };
    }

    const rawImg =
      job.localImageUrl ||
      json.localImageUrl ||
      job.imageUrl ||
      json.imageUrl ||
      (params.mode === 'image' ? job.resultUrl : undefined);
    const rawVid =
      job.localVideoUrl ||
      json.localVideoUrl ||
      job.videoUrl ||
      json.videoUrl ||
      (params.mode === 'video' ? job.resultUrl : undefined);

    const normImg = rawImg ? toBackendRelativeMediaPath(rawImg) || rawImg : undefined;
    const normVid = rawVid ? toBackendRelativeMediaPath(rawVid) || rawVid : undefined;
    const fullUrl =
      json.fullUrl ||
      job.fullUrl ||
      normalizeBackendMediaUrl(normVid || normImg, true);

    return {
      ok: true,
      jobId,
      status: status || 'succeeded',
      imageUrl: normImg,
      videoUrl: normVid,
      fullUrl,
    };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error && err.name === 'AbortError'
          ? `Timed out waiting for ${params.target === 'dreamina' ? 'Dreamina' : 'Google Flow'} browser tab to finish rendering.`
          : err instanceof Error
          ? err.message
          : 'Failed to reach /api/bridge/enqueue on :3001',
    };
  }
}

export async function renderVideoViaBackend(params: {
  prompt: string;
  imageUrl?: string;
  endImage?: string;
  durationSec?: number;
  aspectRatio?: AspectRatio;
  resolution?: ResolutionTier;
  cameraMotion?: string;
  mood?: string;
  previousInteractionId?: string;
  provider?: ProviderId;
  apiKey?: string;
  baseUrl?: string;
  outputName?: string;
}): Promise<{
  ok: boolean;
  videoUrl?: string;
  rawVideoPath?: string;
  interactionId?: string;
  model?: string;
  engine?: string;
  durationSec?: number;
  error?: string;
}> {
  try {
    const cleanInput = toBackendRelativeMediaPath(params.imageUrl);
    const cleanEnd = toBackendRelativeMediaPath(params.endImage);
    const backendProvider = toBackendProviderSlug(params.provider);
    const isCloud = backendProvider !== 'ffmpeg-local';
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), isCloud ? 240000 : 32000);

    const res = await authFetch(`${LOCAL_MCP_BASE}/api/render-video`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: ctrl.signal,
      body: JSON.stringify({
        prompt: params.prompt,
        image: cleanInput,
        imageUrl: cleanInput,
        inputImage: cleanInput,
        startImage: cleanInput,
        endImage: cleanEnd,
        lastFrameUrl: cleanEnd,
        durationSec: params.durationSec || 7,
        duration_seconds: params.durationSec || 7,
        duration: params.durationSec || 7,
        aspectRatio: params.aspectRatio || '16:9',
        resolution: params.resolution || '720p',
        cameraMotion: params.cameraMotion,
        cameraCurve: params.cameraMotion,
        mood: params.mood,
        grade: params.mood,
        previousInteractionId: params.previousInteractionId,
        provider: backendProvider,
        apiKey: params.apiKey,
        baseUrl: params.baseUrl,
        outputName: params.outputName,
      }),
    });
    clearTimeout(timer);

    const json = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      videoUrl?: string;
      fullUrl?: string;
      url?: string;
      interactionId?: string;
      operationName?: string;
      model?: string;
      engine?: string;
      durationSec?: number;
      error?: string;
    };

    if (!res.ok || json.ok === false) {
      return {
        ok: false,
        error: json.error || `Video generation failed (HTTP ${res.status})`,
      };
    }

    const resolvedUrl =
      json.fullUrl || normalizeBackendMediaUrl(json.videoUrl || json.url, true);
    if (!resolvedUrl) {
      return { ok: false, error: json.error || 'No video URL returned from backend' };
    }

    return {
      ok: true,
      videoUrl: resolvedUrl,
      rawVideoPath: json.videoUrl || json.url,
      interactionId: json.interactionId || json.operationName,
      model: json.model,
      engine: json.engine || backendProvider,
      durationSec: json.durationSec || params.durationSec,
    };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error && err.name === 'AbortError'
          ? 'Video generation timed out while waiting for provider.'
          : err instanceof Error
          ? err.message
          : 'Network error calling /api/render-video',
    };
  }
}

export async function sliceGridViaBackend(
  imageUrl: string,
  rows = 3,
  cols = 3
): Promise<{ ok: boolean; sliceUrls: string[] }> {
  try {
    const cleanSource = toBackendRelativeMediaPath(imageUrl);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 18000);

    const res = await authFetch(`${LOCAL_MCP_BASE}/api/slice-grid`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: ctrl.signal,
      body: JSON.stringify({
        image: cleanSource,
        imageUrl: cleanSource,
        inputImage: cleanSource,
        sourceImage: cleanSource,
        rows,
        cols,
        grid: `${rows}x${cols}`,
      }),
    });
    clearTimeout(timer);

    if (!res.ok) return { ok: false, sliceUrls: [] };
    const json = (await res.json()) as Record<string, unknown>;
    const rawArr =
      (json.fullUrls as unknown[]) ||
      (json.slices as unknown[]) ||
      (json.sliceUrls as unknown[]) ||
      (json.urls as unknown[]) ||
      (json.images as unknown[]) ||
      (json.files as unknown[]) ||
      [];

    const normalized = rawArr
      .map((item) => {
        if (typeof item === 'string') {
          return normalizeBackendMediaUrl(item, true);
        }
        if (item && typeof item === 'object') {
          const obj = item as Record<string, unknown>;
          const u =
            (obj.fullUrl as string) ||
            (obj.url as string) ||
            (obj.imageUrl as string) ||
            (obj.sliceUrl as string);
          return normalizeBackendMediaUrl(u, true);
        }
        return undefined;
      })
      .filter((u): u is string => Boolean(u));

    return { ok: normalized.length > 0, sliceUrls: normalized };
  } catch {
    return { ok: false, sliceUrls: [] };
  }
}

export async function extractLastFrameViaBackend(
  videoUrl?: string
): Promise<{ ok: boolean; frameUrl?: string }> {
  if (!videoUrl) return { ok: false };
  try {
    const cleanVid = toBackendRelativeMediaPath(videoUrl);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 14000);

    const res = await authFetch(`${LOCAL_MCP_BASE}/api/extract-last-frame`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: ctrl.signal,
      body: JSON.stringify({
        videoUrl: cleanVid,
        videoPath: cleanVid,
        inputVideo: cleanVid,
      }),
    });
    clearTimeout(timer);

    if (!res.ok) return { ok: false };
    const json = (await res.json()) as {
      frameUrl?: string;
      fullUrl?: string;
      imageUrl?: string;
      url?: string;
    };
    const resolved =
      json.fullUrl ||
      normalizeBackendMediaUrl(json.frameUrl || json.imageUrl || json.url, true);
    return { ok: Boolean(resolved), frameUrl: resolved };
  } catch {
    return { ok: false };
  }
}

export async function compileTimelineViaBackend(params: {
  clips: string[];
  title: string;
  outputName?: string;
  audioTracks?: Array<{ audioUrl: string; volume?: number }>;
}): Promise<{ ok: boolean; masterUrl?: string; bytes?: number }> {
  if (params.clips.length === 0) return { ok: false };
  try {
    const cleanClips = params.clips
      .map((c) => toBackendRelativeMediaPath(c))
      .filter((c): c is string => Boolean(c));

    const cleanAudioTracks = (params.audioTracks || [])
      .map((t) => {
        const cleanAudio = toBackendRelativeMediaPath(t.audioUrl);
        return cleanAudio ? { audioUrl: cleanAudio, volume: t.volume ?? 0.65 } : null;
      })
      .filter((t): t is { audioUrl: string; volume: number } => Boolean(t));

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 35000);

    const res = await authFetch(`${LOCAL_MCP_BASE}/api/compile-timeline`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: ctrl.signal,
      body: JSON.stringify({
        clips: cleanClips,
        videoUrls: cleanClips,
        title: params.title,
        outputName: params.outputName,
        ...(cleanAudioTracks.length > 0 ? { audioTracks: cleanAudioTracks } : {}),
      }),
    });
    clearTimeout(timer);

    if (!res.ok) return { ok: false };
    const json = (await res.json()) as {
      masterUrl?: string;
      fullUrl?: string;
      videoUrl?: string;
      url?: string;
      bytes?: number;
    };
    const masterUrl =
      json.fullUrl ||
      normalizeBackendMediaUrl(json.masterUrl || json.videoUrl || json.url, true);
    return { ok: Boolean(masterUrl), masterUrl, bytes: json.bytes };
  } catch {
    return { ok: false };
  }
}

export async function executeStudioGeneration(
  req: GenerationRequest
): Promise<GenerationResult> {
  const interactionId = `int_df_${Math.random().toString(36).slice(2, 10)}`;
  const costEstimateUsd = estimateZeroMarkupCostUsd(
    req.provider,
    req.mode,
    req.durationSec || 8,
    req.resolution || '1080p'
  );

  // 1. Real Live Browser Bridge (Dreamina Canvas or Google Flow) — NEVER fake with FFmpeg
  if (
    req.provider === 'dreamina-bridge' ||
    req.provider === 'chrome-bridge-dreamina' ||
    req.provider === 'flow-bridge' ||
    req.provider === 'chrome-bridge-flow'
  ) {
    const target =
      req.provider === 'flow-bridge' || req.provider === 'chrome-bridge-flow'
        ? 'google-flow'
        : 'dreamina';
    const bridgeMode =
      req.mode === 'video' || req.mode === 'multiframe' ? 'video' : 'image';

    dispatchBridgeJob({
      jobId: interactionId,
      target,
      prompt: req.prompt,
      aspectRatio: req.aspectRatio,
      durationSec: req.durationSec || 6,
      referenceImages: req.referenceImages || [],
      previousInteractionId: req.previousInteractionId,
    });

    const bridgeRes = await enqueueLiveBridgeJobViaBackend({
      target,
      mode: bridgeMode,
      prompt: req.prompt,
      aspectRatio: req.aspectRatio,
      durationSec: req.durationSec || 6,
      referenceImages: req.referenceImages || [],
      waitForResult: true,
      timeoutMs: 180000,
    });

    if (!bridgeRes.ok) {
      return {
        ok: false,
        error: bridgeRes.error,
        jobId: bridgeRes.jobId,
        providerLabel:
          target === 'dreamina'
            ? 'Dreamina · Live Browser'
            : 'Google Flow · Live Browser',
        interactionId: bridgeRes.jobId || interactionId,
        usedLiveEndpoint: true,
        costEstimateUsd: 0,
      };
    }

    return {
      ok: true,
      jobId: bridgeRes.jobId,
      providerLabel:
        target === 'dreamina'
          ? 'Dreamina · Live Browser ($0 Credits)'
          : 'Google Flow · Live Browser ($0 Credits)',
      interactionId: bridgeRes.jobId || interactionId,
      imageUrl: bridgeRes.imageUrl,
      videoUrl: bridgeRes.videoUrl,
      usedLiveEndpoint: true,
      costEstimateUsd: 0,
    };
  }

  // 2. Real Cloud BYOK & Local GPU Engines (Google Gemini / Veo 3.1, Fal, Replicate, Seedance, ComfyUI) — NEVER fake with FFmpeg
  if (isCloudOrBridgeProvider(req.provider)) {
    const apiKey = getActiveApiKeyForProvider(req.provider, req.byok);
    const label = getProviderDisplayLabel(req.provider);

    if (req.provider !== 'comfyui' && !apiKey) {
      const missingMsg =
        req.provider === 'gemini-api' || req.provider === 'gemini-omni'
          ? 'Enter your Google AI Studio API key (AIza...) or switch to Google Flow · Live Browser'
          : `Enter your ${label} API key in BYOK · MCP, or switch to FFmpeg 8.0 · Local Camera`;
      return {
        ok: false,
        error: missingMsg,
        providerLabel: label,
        interactionId,
        usedLiveEndpoint: true,
        costEstimateUsd,
      };
    }

    if (req.mode === 'video' || req.mode === 'multiframe') {
      const vidRes = await renderVideoViaBackend({
        prompt: req.prompt,
        imageUrl: req.firstFrameDataUrl,
        endImage: req.lastFrameDataUrl,
        durationSec: Math.min(req.durationSec || 6, 15),
        aspectRatio: req.aspectRatio,
        resolution: req.resolution,
        cameraMotion: req.cameraMotion,
        mood: req.mood,
        previousInteractionId: req.previousInteractionId,
        provider: req.provider,
        apiKey,
        baseUrl: req.provider === 'comfyui' ? req.byok.comfyUiUrl : undefined,
        outputName: req.outputName,
      });

      if (!vidRes.ok || !vidRes.videoUrl) {
        return {
          ok: false,
          error: vidRes.error || `${label} video generation failed`,
          providerLabel: label,
          interactionId,
          usedLiveEndpoint: true,
          costEstimateUsd,
        };
      }

      return {
        ok: true,
        providerLabel: vidRes.model ? `${label} · ${vidRes.model}` : label,
        interactionId: vidRes.interactionId || interactionId,
        imageUrl:
          req.firstFrameDataUrl &&
          (req.firstFrameDataUrl.startsWith('/media/') ||
            req.firstFrameDataUrl.startsWith('http'))
            ? req.firstFrameDataUrl
            : undefined,
        videoUrl: vidRes.videoUrl,
        usedLiveEndpoint: true,
        costEstimateUsd,
      };
    }

    // Image or 9-grid synthesis via real provider endpoint
    const imgRes = await generateImageViaBackend({
      prompt: req.prompt,
      aspectRatio: req.aspectRatio,
      referenceImages: req.referenceImages,
      provider: req.provider,
      apiKey,
      baseUrl: req.provider === 'comfyui' ? req.byok.comfyUiUrl : undefined,
    });

    if (!imgRes.ok || (!imgRes.imageUrl && !imgRes.fullUrl)) {
      return {
        ok: false,
        error: imgRes.error || `${label} image generation failed`,
        providerLabel: label,
        interactionId,
        usedLiveEndpoint: true,
        costEstimateUsd,
      };
    }

    return {
      ok: true,
      providerLabel: imgRes.model ? `${label} · ${imgRes.model}` : label,
      interactionId,
      imageUrl: imgRes.imageUrl || imgRes.fullUrl,
      usedLiveEndpoint: true,
      costEstimateUsd,
    };
  }

  // 3. Explicit MCP Tool Node Pipeline
  if (req.provider === 'mcp-router' && req.mcpTool) {
    try {
      const result = await callMcpServerTool(req.mcpTool.serverUrl, req.mcpTool.name, {
        prompt: req.prompt,
        imageUrl: toBackendRelativeMediaPath(req.firstFrameDataUrl),
        endImage: toBackendRelativeMediaPath(req.lastFrameDataUrl),
        aspect_ratio: req.aspectRatio,
        duration_seconds: req.durationSec || 7,
        previous_interaction_id: req.previousInteractionId,
      });
      if (result.connected) {
        return {
          ok: true,
          providerLabel: `MCP · ${req.mcpTool.serverName} (${req.mcpTool.name})`,
          interactionId: result.interactionId || interactionId,
          imageUrl: result.imageUrl,
          videoUrl: result.videoUrl,
          usedLiveEndpoint: true,
          costEstimateUsd: 0,
        };
      }
    } catch {
      // Fall through to local FFmpeg engine
    }
  }

  // 4. Explicit FFmpeg 8.0 · Local Camera ($0.00 Offline Deterministic Engine)
  if (req.mode === 'video' || req.mode === 'multiframe') {
    const inputImg =
      req.firstFrameDataUrl ||
      req.referenceImages?.[0] ||
      renderShotDataUrl(req.aspectRatio || '16:9', {
        prompt: req.prompt || 'Studio Frame',
        seed: 101,
      });

    const ffmpegRes = await renderVideoViaBackend({
      prompt: req.prompt,
      imageUrl: inputImg,
      endImage: req.lastFrameDataUrl,
      durationSec: Math.min(req.durationSec || 7, 15),
      aspectRatio: req.aspectRatio,
      resolution: req.resolution,
      cameraMotion: req.cameraMotion,
      mood: req.mood,
      previousInteractionId: req.previousInteractionId,
      provider: 'ffmpeg-local',
      outputName: req.outputName,
    });

    if (ffmpegRes.ok && ffmpegRes.videoUrl) {
      return {
        ok: true,
        providerLabel: 'FFmpeg 8.0 · Local Camera ($0.00)',
        interactionId: ffmpegRes.interactionId || interactionId,
        imageUrl: inputImg.startsWith('/media/') || inputImg.startsWith('http') ? inputImg : undefined,
        videoUrl: ffmpegRes.videoUrl,
        usedLiveEndpoint: true,
        costEstimateUsd: 0,
      };
    }
  } else if (req.mode === 'image') {
    const localImgRes = await generateImageViaBackend({
      prompt: req.prompt,
      aspectRatio: req.aspectRatio,
      referenceImages: req.referenceImages,
      provider: 'ffmpeg-local',
    });
    if (localImgRes.ok && (localImgRes.imageUrl || localImgRes.fullUrl)) {
      return {
        ok: true,
        providerLabel: 'FFmpeg 8.0 · Local Camera ($0.00)',
        interactionId,
        imageUrl: localImgRes.imageUrl || localImgRes.fullUrl,
        usedLiveEndpoint: true,
        costEstimateUsd: 0,
      };
    }
  }

  return {
    ok: true,
    providerLabel: 'FFmpeg 8.0 · Local Camera ($0.00)',
    interactionId,
    usedLiveEndpoint: false,
    costEstimateUsd: 0,
  };
}

export async function discoverMcpTools(
  serverUrl: string,
  serverName: string
): Promise<{ connected: boolean; pingMs: number; tools: MCPToolDefinition[] }> {
  const start = performance.now();
  const rpcPayload = {
    jsonrpc: '2.0',
    id: Date.now(),
    method: 'tools/list',
    params: {},
  };

  try {
    if (serverUrl.startsWith('ws://') || serverUrl.startsWith('wss://')) {
      const tools = await new Promise<MCPToolDefinition[]>((resolve, reject) => {
        const ws = new WebSocket(serverUrl);
        const timer = setTimeout(() => {
          ws.close();
          reject(new Error('MCP WebSocket timeout'));
        }, 1800);

        ws.onopen = () => {
          ws.send(JSON.stringify(rpcPayload));
        };
        ws.onmessage = (ev) => {
          clearTimeout(timer);
          try {
            const parsed = JSON.parse(String(ev.data));
            const rawTools = parsed?.result?.tools || [];
            ws.close();
            resolve(
              rawTools.map((t: { name: string; description?: string; inputSchema?: Record<string, unknown> }) => ({
                name: t.name,
                description: t.description || 'Discovered MCP Canvas Tool',
                serverUrl,
                serverName,
                inputSchema: t.inputSchema,
              }))
            );
          } catch (e) {
            ws.close();
            reject(e);
          }
        };
        ws.onerror = () => {
          clearTimeout(timer);
          reject(new Error('MCP WebSocket connection failed'));
        };
      });

      return {
        connected: true,
        pingMs: Math.round(performance.now() - start),
        tools,
      };
    } else {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 1800);
      const res = await fetch(serverUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rpcPayload),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const parsed = await res.json();
      const rawTools = parsed?.result?.tools || [];
      return {
        connected: true,
        pingMs: Math.round(performance.now() - start),
        tools: rawTools.map(
          (t: { name: string; description?: string; inputSchema?: Record<string, unknown> }) => ({
            name: t.name,
            description: t.description || 'Discovered MCP Canvas Tool',
            serverUrl,
            serverName,
            inputSchema: t.inputSchema,
          })
        ),
      };
    }
  } catch {
    return {
      connected: false,
      pingMs: Math.round(performance.now() - start),
      tools: getDefaultDiscoveredMcpTools(serverUrl, serverName),
    };
  }
}

export function getDefaultDiscoveredMcpTools(
  serverUrl: string,
  serverName: string
): MCPToolDefinition[] {
  return [
    {
      name: 'generate_video',
      description:
        'Synthesizes H.264 MP4 + stereo audio via Zero-Markup BYOK or local FFmpeg zoompan/LUT engine',
      serverUrl,
      serverName,
      inputSchema: { type: 'object', properties: { prompt: { type: 'string' }, duration_seconds: { type: 'number' } } },
    },
    {
      name: 'keyframe_bridge',
      description:
        'Synthesizes smooth First-Frame → Last-Frame optical transition MP4 across motion curves (ease-in-out, linear, match-dissolve, whip-pan)',
      serverUrl,
      serverName,
      inputSchema: {
        type: 'object',
        properties: {
          startImageUrl: { type: 'string' },
          endImageUrl: { type: 'string' },
          motionCurve: { type: 'string' },
          durationSec: { type: 'number' },
        },
      },
    },
    {
      name: 'generate_audio',
      description:
        'Synthesizes real MP3 voiceover (macOS TTS) or stereo acoustic foley + 64-bar normalized waveform array',
      serverUrl,
      serverName,
      inputSchema: {
        type: 'object',
        properties: {
          prompt: { type: 'string' },
          mode: { type: 'string' },
          durationSec: { type: 'number' },
        },
      },
    },
    {
      name: 'slice_contact_sheet',
      description:
        'Slices 3×3 or 2×2 storyboard contact sheet PNGs into 9 or 4 real individual PNG frames via FFmpeg crop',
      serverUrl,
      serverName,
      inputSchema: { type: 'object', properties: { imageUrl: { type: 'string' }, rows: { type: 'number' }, cols: { type: 'number' } } },
    },
    {
      name: 'extract_last_frame',
      description:
        'Extracts the exact final PNG frame of any MP4 shot via FFmpeg (-sseof -0.1) for seamless next-shot anchoring',
      serverUrl,
      serverName,
      inputSchema: { type: 'object', properties: { videoUrl: { type: 'string' } } },
    },
    {
      name: 'flow_scene_builder',
      description:
        'Concatenates multi-shot timeline MP4 clips into a single faststart H.264 + AAC master film',
      serverUrl,
      serverName,
      inputSchema: { type: 'object', properties: { clips: { type: 'array' }, title: { type: 'string' } } },
    },
    {
      name: 'inpaint_frame',
      description: 'Dreamina Smart Brush regional redraw & FFmpeg maskedmerge composite',
      serverUrl,
      serverName,
      inputSchema: { type: 'object', properties: { imageUrl: { type: 'string' }, maskDataUrl: { type: 'string' }, prompt: { type: 'string' } } },
    },
    {
      name: 'outpaint_expand',
      description: 'Expands frame boundaries to 16:9, 9:16, 21:9, or 1:1 via FFmpeg atmospheric outpaint',
      serverUrl,
      serverName,
      inputSchema: { type: 'object', properties: { imageUrl: { type: 'string' }, targetAspect: { type: 'string' } } },
    },
    {
      name: 'remove_background',
      description: 'Extracts RGBA alpha subject cutout PNG via FFmpeg colorkey matte',
      serverUrl,
      serverName,
      inputSchema: { type: 'object', properties: { imageUrl: { type: 'string' } } },
    },
    {
      name: 'upscale_4k',
      description: 'Upscales frame to 3840px 4K UHD via FFmpeg Lanczos + unsharp detail pass',
      serverUrl,
      serverName,
      inputSchema: { type: 'object', properties: { imageUrl: { type: 'string' } } },
    },
    {
      name: 'extract_style_dna',
      description: 'Extracts 5-swatch color LUT, lens focal profile, and film stock DNA from reference frame',
      serverUrl,
      serverName,
      inputSchema: { type: 'object', properties: { image_url: { type: 'string' } } },
    },
    {
      name: 'save_project',
      description: 'Persists canvas graph and snapshots to local .dreamflow-data.nosync disk database',
      serverUrl,
      serverName,
      inputSchema: { type: 'object', properties: { id: { type: 'string' }, name: { type: 'string' } } },
    },
  ];
}

async function callMcpServerTool(
  serverUrl: string,
  toolName: string,
  args: Record<string, unknown>
): Promise<{ connected: boolean; interactionId?: string; imageUrl?: string; videoUrl?: string }> {
  const httpTarget = serverUrl.startsWith('ws://')
    ? serverUrl.replace(/^ws:\/\//, 'http://')
    : serverUrl.startsWith('wss://')
    ? serverUrl.replace(/^wss:\/\//, 'https://')
    : serverUrl;

  const rpc = {
    jsonrpc: '2.0',
    id: Date.now(),
    method: 'tools/call',
    params: { name: toolName, arguments: args },
  };
  if (httpTarget.startsWith('http://') || httpTarget.startsWith('https://')) {
    const res = await fetch(httpTarget, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rpc),
    });
    if (res.ok) {
      const json = await res.json();
      let payload = json?.result || {};
      if (Array.isArray(payload?.content) && payload.content[0]?.text) {
        try {
          payload = { ...payload, ...JSON.parse(payload.content[0].text) };
        } catch {
          // ignore non-JSON text content
        }
      }
      return {
        connected: true,
        interactionId: payload.interactionId,
        imageUrl: normalizeBackendMediaUrl(payload.imageUrl || payload.frameUrl, true),
        videoUrl:
          payload.fullUrl ||
          normalizeBackendMediaUrl(payload.videoUrl || payload.masterUrl, true),
      };
    }
  }
  return { connected: false };
}

export function pingChromeBridge(): void {
  window.postMessage(
    { source: 'open-dreamflow-studio', type: 'DREAMFLOW_PING', payload: { ts: Date.now() } },
    '*'
  );
}

export function dispatchBridgeJob(payload: {
  jobId: string;
  target: BrowserPlatformTarget;
  mode?: 'image' | 'video' | 'audio';
  modelId?: string;
  prompt: string;
  aspectRatio: AspectRatio;
  durationSec: number;
  referenceImages: string[];
  previousInteractionId?: string;
}): void {
  window.postMessage(
    { source: 'open-dreamflow-studio', type: 'DREAMFLOW_ENQUEUE_JOB', payload },
    '*'
  );
}

// ============================================================================
// Stage 4: Inline Image Editing, Upload, Disk Persistence & Bridge Relay APIs
// ============================================================================

export async function uploadMediaViaBackend(params: {
  filename: string;
  mimeType?: string;
  dataBase64: string;
}): Promise<{ ok: boolean; mediaUrl?: string; fullUrl?: string; bytes?: number }> {
  try {
    const res = await authFetch(`${LOCAL_MCP_BASE}/api/upload-media`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!res.ok) return { ok: false };
    const json = (await res.json()) as {
      ok?: boolean;
      mediaUrl?: string;
      fullUrl?: string;
      bytes?: number;
    };
    const resolved =
      json.mediaUrl ||
      (json.fullUrl ? toBackendRelativeMediaPath(json.fullUrl) : undefined);
    if (!resolved) return { ok: false };
    return {
      ok: true,
      mediaUrl: resolved,
      fullUrl: json.fullUrl || normalizeBackendMediaUrl(resolved, true),
      bytes: json.bytes,
    };
  } catch {
    return { ok: false };
  }
}

export async function inpaintViaBackend(params: {
  imageUrl: string;
  maskDataUrl?: string;
  prompt?: string;
  provider?: ProviderId;
  apiKey?: string;
  baseUrl?: string;
}): Promise<{ ok: boolean; imageUrl?: string; fullUrl?: string; engine?: string; error?: string }> {
  try {
    const cleanSource = toBackendRelativeMediaPath(params.imageUrl) || params.imageUrl;
    const backendProvider = toBackendProviderSlug(params.provider);
    const res = await authFetch(`${LOCAL_MCP_BASE}/api/inpaint`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageUrl: cleanSource,
        maskDataUrl: params.maskDataUrl,
        prompt: params.prompt,
        provider: backendProvider,
        apiKey: params.apiKey,
        baseUrl: params.baseUrl,
      }),
    });
    const json = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      imageUrl?: string;
      fullUrl?: string;
      engine?: string;
      error?: string;
    };
    if (!res.ok || json.ok === false) {
      return { ok: false, error: json.error || `Inpaint failed (HTTP ${res.status})` };
    }
    const url = json.imageUrl || toBackendRelativeMediaPath(json.fullUrl);
    if (!url) return { ok: false, error: json.error };
    return {
      ok: true,
      imageUrl: url,
      fullUrl: json.fullUrl || normalizeBackendMediaUrl(url, true),
      engine: json.engine || backendProvider,
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Inpaint network error' };
  }
}

export async function outpaintViaBackend(params: {
  imageUrl: string;
  targetAspect: AspectRatio;
  prompt?: string;
  provider?: ProviderId;
  apiKey?: string;
  baseUrl?: string;
}): Promise<{
  ok: boolean;
  imageUrl?: string;
  fullUrl?: string;
  width?: number;
  height?: number;
  error?: string;
}> {
  try {
    const cleanSource = toBackendRelativeMediaPath(params.imageUrl) || params.imageUrl;
    const backendProvider = toBackendProviderSlug(params.provider);
    const res = await authFetch(`${LOCAL_MCP_BASE}/api/outpaint`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageUrl: cleanSource,
        targetAspect: params.targetAspect,
        prompt: params.prompt,
        provider: backendProvider,
        apiKey: params.apiKey,
        baseUrl: params.baseUrl,
      }),
    });
    const json = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      imageUrl?: string;
      fullUrl?: string;
      width?: number;
      height?: number;
      error?: string;
    };
    if (!res.ok || json.ok === false) {
      return { ok: false, error: json.error || `Outpaint failed (HTTP ${res.status})` };
    }
    const url = json.imageUrl || toBackendRelativeMediaPath(json.fullUrl);
    if (!url) return { ok: false, error: json.error };
    return {
      ok: true,
      imageUrl: url,
      fullUrl: json.fullUrl || normalizeBackendMediaUrl(url, true),
      width: json.width,
      height: json.height,
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Outpaint network error' };
  }
}

export async function removeBgViaBackend(
  imageUrl: string
): Promise<{ ok: boolean; imageUrl?: string; fullUrl?: string }> {
  try {
    const cleanSource = toBackendRelativeMediaPath(imageUrl) || imageUrl;
    const res = await authFetch(`${LOCAL_MCP_BASE}/api/remove-bg`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageUrl: cleanSource }),
    });
    if (!res.ok) return { ok: false };
    const json = (await res.json()) as {
      ok?: boolean;
      imageUrl?: string;
      fullUrl?: string;
    };
    const url = json.imageUrl || toBackendRelativeMediaPath(json.fullUrl);
    if (!url) return { ok: false };
    return {
      ok: true,
      imageUrl: url,
      fullUrl: json.fullUrl || normalizeBackendMediaUrl(url, true),
    };
  } catch {
    return { ok: false };
  }
}

export async function upscaleViaBackend(
  imageUrl: string
): Promise<{ ok: boolean; imageUrl?: string; fullUrl?: string; width?: number }> {
  try {
    const cleanSource = toBackendRelativeMediaPath(imageUrl) || imageUrl;
    const res = await authFetch(`${LOCAL_MCP_BASE}/api/upscale`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageUrl: cleanSource }),
    });
    if (!res.ok) return { ok: false };
    const json = (await res.json()) as {
      ok?: boolean;
      imageUrl?: string;
      fullUrl?: string;
      width?: number;
    };
    const url = json.imageUrl || toBackendRelativeMediaPath(json.fullUrl);
    if (!url) return { ok: false };
    return {
      ok: true,
      imageUrl: url,
      fullUrl: json.fullUrl || normalizeBackendMediaUrl(url, true),
      width: json.width || 3840,
    };
  } catch {
    return { ok: false };
  }
}

export async function listDiskProjects(): Promise<{
  ok: boolean;
  projects: DiskProjectMeta[];
}> {
  try {
    const res = await authFetch(`${LOCAL_MCP_BASE}/api/projects`);
    if (!res.ok) return { ok: false, projects: [] };
    const json = (await res.json()) as {
      ok?: boolean;
      projects?: DiskProjectMeta[];
    };
    return {
      ok: Boolean(json.ok),
      projects: Array.isArray(json.projects) ? json.projects : [],
    };
  } catch {
    return { ok: false, projects: [] };
  }
}

export async function getDiskProject(
  id: string
): Promise<{ ok: boolean; project?: DiskProjectRecord }> {
  try {
    const res = await authFetch(
      `${LOCAL_MCP_BASE}/api/projects/${encodeURIComponent(id)}`
    );
    if (!res.ok) return { ok: false };
    const json = (await res.json()) as {
      ok?: boolean;
      project?: DiskProjectRecord;
    };
    return { ok: Boolean(json.ok && json.project), project: json.project };
  } catch {
    return { ok: false };
  }
}

export async function saveDiskProject(params: {
  id: string;
  name: string;
  state: Record<string, unknown>;
  createSnapshot?: boolean;
  snapshotLabel?: string;
  isSharedWithTeam?: boolean;
}): Promise<{ ok: boolean; updatedAt?: number; snapshotCount?: number }> {
  try {
    const res = await authFetch(`${LOCAL_MCP_BASE}/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!res.ok) return { ok: false };
    const json = (await res.json()) as {
      ok?: boolean;
      updatedAt?: number;
      snapshotCount?: number;
    };
    return {
      ok: Boolean(json.ok),
      updatedAt: json.updatedAt,
      snapshotCount: json.snapshotCount,
    };
  } catch {
    return { ok: false };
  }
}

export async function deleteDiskProject(id: string): Promise<boolean> {
  try {
    const res = await authFetch(
      `${LOCAL_MCP_BASE}/api/projects/${encodeURIComponent(id)}`,
      { method: 'DELETE' }
    );
    return res.ok;
  } catch {
    return false;
  }
}

export async function exportDiskProjectBundle(
  id: string
): Promise<Record<string, unknown> | null> {
  try {
    const res = await authFetch(
      `${LOCAL_MCP_BASE}/api/projects/${encodeURIComponent(id)}/export`
    );
    if (!res.ok) return null;
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function importDiskProjectBundle(
  bundle: Record<string, unknown>
): Promise<{ ok: boolean; project?: DiskProjectRecord }> {
  try {
    const res = await authFetch(`${LOCAL_MCP_BASE}/api/projects/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bundle }),
    });
    if (!res.ok) return { ok: false };
    const json = (await res.json()) as {
      ok?: boolean;
      project?: DiskProjectRecord;
    };
    return { ok: Boolean(json.ok && json.project), project: json.project };
  } catch {
    return { ok: false };
  }
}

export async function pushBridgeEventViaBackend(
  event: BridgeIncomingEvent
): Promise<{ ok: boolean }> {
  try {
    const res = await authFetch(`${LOCAL_MCP_BASE}/api/bridge/push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
    });
    return { ok: res.ok };
  } catch {
    return { ok: false };
  }
}

// ============================================================================
// Stage 5: True First-Frame → Last-Frame Keyframe Bridge & Audio / TTS APIs
// ============================================================================

export async function keyframeBridgeViaBackend(params: {
  startImageUrl: string;
  endImageUrl: string;
  durationSec?: number;
  motionCurve?: KeyframeBridgeCurve;
  prompt?: string;
  provider?: ProviderId;
  apiKey?: string;
  baseUrl?: string;
}): Promise<{
  ok: boolean;
  videoUrl?: string;
  fullUrl?: string;
  durationSec?: number;
  motionCurve?: KeyframeBridgeCurve;
  model?: string;
  engine?: string;
  error?: string;
}> {
  try {
    const cleanStart = toBackendRelativeMediaPath(params.startImageUrl) || params.startImageUrl;
    const cleanEnd = toBackendRelativeMediaPath(params.endImageUrl) || params.endImageUrl;
    const backendProvider = toBackendProviderSlug(params.provider);
    const isCloud = backendProvider !== 'ffmpeg-local';
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), isCloud ? 240000 : 35000);

    const res = await authFetch(`${LOCAL_MCP_BASE}/api/keyframe-bridge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: ctrl.signal,
      body: JSON.stringify({
        startImageUrl: cleanStart,
        endImageUrl: cleanEnd,
        durationSec: params.durationSec || 6,
        motionCurve: params.motionCurve || 'ease-in-out',
        prompt: params.prompt,
        provider: backendProvider,
        apiKey: params.apiKey,
        baseUrl: params.baseUrl,
      }),
    });
    clearTimeout(timer);

    const json = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      videoUrl?: string;
      fullUrl?: string;
      durationSec?: number;
      motionCurve?: KeyframeBridgeCurve;
      model?: string;
      engine?: string;
      error?: string;
    };
    if (!res.ok || json.ok === false) {
      return {
        ok: false,
        error: json.error || `Keyframe bridge failed (HTTP ${res.status})`,
      };
    }

    const rel = json.videoUrl || toBackendRelativeMediaPath(json.fullUrl);
    const full = json.fullUrl || normalizeBackendMediaUrl(rel, true);
    if (!full && !rel) return { ok: false, error: json.error };

    return {
      ok: true,
      videoUrl: rel || full,
      fullUrl: full || rel,
      durationSec: json.durationSec || params.durationSec || 6,
      motionCurve: json.motionCurve || params.motionCurve || 'ease-in-out',
      model: json.model,
      engine: json.engine || backendProvider,
    };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error && err.name === 'AbortError'
          ? 'Keyframe bridge timed out while waiting for provider.'
          : err instanceof Error
          ? err.message
          : 'Network error calling /api/keyframe-bridge',
    };
  }
}

export async function generateAudioViaBackend(params: {
  prompt: string;
  mode?: 'tts' | 'voiceover' | 'ambient' | 'sfx';
  voiceText?: string;
  durationSec?: number;
}): Promise<{
  ok: boolean;
  audioUrl?: string;
  fullUrl?: string;
  durationSec?: number;
  mode?: 'tts' | 'voiceover' | 'ambient' | 'sfx';
  waveform?: number[];
}> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 28000);

    const res = await authFetch(`${LOCAL_MCP_BASE}/api/generate-audio`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: ctrl.signal,
      body: JSON.stringify({
        prompt: params.prompt,
        mode: params.mode || 'ambient',
        voiceText: params.voiceText || (params.mode === 'voiceover' ? params.prompt : undefined),
        durationSec: params.durationSec || 8,
      }),
    });
    clearTimeout(timer);
    if (!res.ok) return { ok: false };

    const json = (await res.json()) as {
      ok?: boolean;
      audioUrl?: string;
      fullUrl?: string;
      durationSec?: number;
      mode?: 'voiceover' | 'ambient' | 'sfx';
      waveform?: number[];
    };
    const rel = json.audioUrl || toBackendRelativeMediaPath(json.fullUrl);
    const full = json.fullUrl || normalizeBackendMediaUrl(rel, true);
    if (!full && !rel) return { ok: false };

    return {
      ok: true,
      audioUrl: rel || full,
      fullUrl: full || rel,
      durationSec: json.durationSec || params.durationSec || 8,
      mode: json.mode || params.mode || 'ambient',
      waveform:
        Array.isArray(json.waveform) && json.waveform.length > 0
          ? json.waveform.slice(0, 64)
          : undefined,
    };
  } catch {
    return { ok: false };
  }
}

// ============================================================================
// Stage 11: Multi-User Invite Auth, Team Shared Credits, Credit Summary & Assets
// ============================================================================

export async function fetchAuthBootstrapInfo(): Promise<AuthBootstrapInfo> {
  try {
    const res = await authFetch(`${LOCAL_MCP_BASE}/api/auth/bootstrap-info`);
    const json = (await res.json().catch(() => ({}))) as Partial<AuthBootstrapInfo>;
    return {
      ok: Boolean(res.ok && (json.ok ?? true)),
      authEnabled: Boolean(json.authEnabled ?? true),
      isLocalhost: Boolean(json.isLocalhost ?? (typeof window !== 'undefined' && /^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname))),
      ownerDefaultEmail: json.ownerDefaultEmail || 'owner@dreamflow.studio',
      r2Configured: Boolean(json.r2Configured),
    };
  } catch {
    return {
      ok: false,
      authEnabled: false,
      isLocalhost:
        typeof window !== 'undefined' &&
        /^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname),
      ownerDefaultEmail: 'owner@dreamflow.studio',
      r2Configured: false,
    };
  }
}

export async function loginViaBackend(
  email: string,
  passcode: string
): Promise<{
  ok: boolean;
  token?: string;
  user?: StudioAuthUser;
  sharedGrants?: Record<string, { enabled: boolean; capCredits: number | null; usedCredits?: number }>;
  error?: string;
}> {
  try {
    const res = await authFetch(`${LOCAL_MCP_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, passcode }),
    });
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok || json.ok === false || typeof json.token !== 'string') {
      return {
        ok: false,
        error:
          (typeof json.error === 'string' && json.error) ||
          'Invalid email or passcode',
      };
    }
    setStoredAuthToken(json.token);
    setAuthModeActive(true);
    return {
      ok: true,
      token: json.token,
      user: json.user as StudioAuthUser,
      sharedGrants: json.sharedGrants as Record<string, { enabled: boolean; capCredits: number | null; usedCredits?: number }>,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Login request failed',
    };
  }
}

export async function logoutViaBackend(): Promise<void> {
  try {
    await authFetch(`${LOCAL_MCP_BASE}/api/auth/logout`, { method: 'POST' });
  } catch {
    // ignore network failure on sign out
  } finally {
    setStoredAuthToken(null);
  }
}

export async function fetchAuthMe(): Promise<AuthMePayload | null> {
  try {
    const res = await authFetch(`${LOCAL_MCP_BASE}/api/auth/me`);
    if (!res.ok) return null;
    const json = (await res.json().catch(() => null)) as AuthMePayload | null;
    if (!json || json.ok === false || !json.user) return null;
    return json;
  } catch {
    return null;
  }
}

export async function updateAuthProfileViaBackend(payload: {
  displayName?: string;
  email?: string;
  passcode?: string;
}): Promise<{ ok: boolean; user?: StudioAuthUser; error?: string }> {
  try {
    const res = await authFetch(`${LOCAL_MCP_BASE}/api/auth/profile`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      user?: StudioAuthUser;
      error?: string;
    };
    return {
      ok: Boolean(res.ok && json.ok !== false),
      user: json.user,
      error: json.error,
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Profile update failed' };
  }
}

export async function updateUserVaultViaBackend(payload: {
  byok?: Partial<BYOKCredentials>;
  billingMeta?: Record<string, BillingMetaEntry>;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await authFetch(`${LOCAL_MCP_BASE}/api/user/vault`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
    return { ok: Boolean(res.ok && json.ok !== false), error: json.error };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Vault save failed' };
  }
}

export async function inviteTeamMemberViaBackend(payload: {
  email: string;
  displayName: string;
  passcode: string;
  sharedGrants?: Record<string, { enabled: boolean; capCredits: number | null }>;
}): Promise<{ ok: boolean; member?: TeamMemberSummary; error?: string }> {
  try {
    const res = await authFetch(`${LOCAL_MCP_BASE}/api/team/invites`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      member?: TeamMemberSummary;
      error?: string;
    };
    return {
      ok: Boolean(res.ok && json.ok !== false),
      member: json.member,
      error: json.error,
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Invite creation failed' };
  }
}

export async function updateMemberGrantsViaBackend(
  userId: string,
  payload: {
    grants: Record<string, { enabled: boolean; capCredits: number | null }>;
    resetUsagePlatformId?: string;
    passcode?: string;
    displayName?: string;
  }
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await authFetch(
      `${LOCAL_MCP_BASE}/api/team/members/${encodeURIComponent(userId)}/grants`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    );
    const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
    return { ok: Boolean(res.ok && json.ok !== false), error: json.error };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to update grants' };
  }
}

export async function deleteTeamMemberViaBackend(userId: string): Promise<boolean> {
  try {
    const res = await authFetch(
      `${LOCAL_MCP_BASE}/api/team/members/${encodeURIComponent(userId)}`,
      { method: 'DELETE' }
    );
    return res.ok;
  } catch {
    return false;
  }
}

const PLATFORM_DISPLAY_LABELS: Record<string, string> = {
  dreamina: 'Dreamina',
  higgsfield: 'Higgsfield',
  elevenlabs: 'ElevenLabs',
  'google-flow': 'Google Flow',
  kling: 'Kling AI',
  openai: 'OpenAI',
  fal: 'fal.ai',
  replicate: 'Replicate',
  comfyui: 'ComfyUI',
  openart: 'OpenArt',
  imagineart: 'ImagineArt',
  sume: 'Sume',
};

function formatFriendlyDateLabel(raw?: string | number | null): string | undefined {
  if (raw === null || raw === undefined || raw === '') return undefined;
  const date =
    typeof raw === 'number'
      ? new Date(raw > 1e12 ? raw : raw * 1000)
      : new Date(String(raw));
  if (Number.isNaN(date.getTime())) return String(raw);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatAssetTitleFromFilename(filename?: string, fallbackKind = 'Asset'): string {
  if (!filename) return fallbackKind;
  const stem = filename.replace(/\.[a-z0-9]+$/i, '');
  const m = /^(dreamina_mcp|higgsfield_mcp|upload|render|upscale4k|inpaint|outpaint|nobg|bridge)_(.+)$/i.exec(
    stem
  );
  if (m) {
    const prefixMap: Record<string, string> = {
      dreamina_mcp: 'Dreamina',
      higgsfield_mcp: 'Higgsfield',
      upload: 'Upload',
      render: 'Render',
      upscale4k: '4K Upscale',
      inpaint: 'Inpaint',
      outpaint: 'Outpaint',
      nobg: 'Cutout',
      bridge: 'Keyframe Bridge',
    };
    const label = prefixMap[m[1].toLowerCase()] || m[1];
    const shortSuffix = m[2].slice(-6);
    return `${label} · ${shortSuffix}`;
  }
  return stem.replace(/[_-]+/g, ' ').slice(0, 48);
}

function normalizeRawAssetItem(raw: Record<string, unknown>): CloudAssetItem {
  const rawModality = String(raw.kind || raw.modality || 'image').toLowerCase();
  const kind: 'image' | 'video' | 'audio' =
    rawModality === 'video' ? 'video' : rawModality === 'audio' ? 'audio' : 'image';
  const rawSource = String(raw.source || 'storage').toLowerCase();
  const source: 'storage' | 'r2' | 'dreamina' | 'higgsfield' =
    rawSource === 'dreamina'
      ? 'dreamina'
      : rawSource === 'higgsfield'
      ? 'higgsfield'
      : rawSource === 'r2'
      ? 'r2'
      : 'storage';
  const filename = typeof raw.filename === 'string' ? raw.filename : undefined;
  const relUrl = String(
    raw.url || raw.mediaUrl || raw.previewUrl || raw.fullUrl || ''
  ).trim();
  const thumb =
    typeof raw.thumbnailUrl === 'string' && raw.thumbnailUrl
      ? raw.thumbnailUrl
      : kind === 'image'
      ? String(raw.previewUrl || relUrl)
      : undefined;

  return {
    id: String(raw.id || relUrl || Math.random().toString(36).slice(2)),
    title:
      typeof raw.title === 'string' && raw.title.trim()
        ? raw.title.trim()
        : formatAssetTitleFromFilename(filename, `Studio ${kind}`),
    filename,
    kind,
    url: relUrl,
    ...(thumb ? { thumbnailUrl: thumb } : {}),
    source,
    platformId: typeof raw.platformId === 'string' ? raw.platformId : undefined,
    projectId: typeof raw.projectId === 'string' ? raw.projectId : undefined,
    resourceId: typeof raw.resourceId === 'string' ? raw.resourceId : undefined,
    cachedLocally: typeof raw.cachedLocally === 'boolean' ? raw.cachedLocally : undefined,
    createdAt:
      typeof raw.createdAt === 'string' ? raw.createdAt : new Date().toISOString(),
    sizeBytes:
      typeof raw.sizeBytes === 'number'
        ? raw.sizeBytes
        : typeof raw.bytes === 'number'
        ? raw.bytes
        : undefined,
    prompt: typeof raw.prompt === 'string' ? raw.prompt : undefined,
  };
}

export async function fetchCreditsSummaryViaBackend(
  refresh = false
): Promise<CreditsSummaryResponse> {
  try {
    const res = await authFetch(
      `${LOCAL_MCP_BASE}/api/credits/summary?refresh=${refresh ? '1' : '0'}`
    );
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok || json.ok === false) {
      return {
        ok: false,
        platforms: [],
        sharedPools: [],
        expiringSoonAlerts: [],
        error: (typeof json.error === 'string' && json.error) || `HTTP ${res.status}`,
      };
    }

    const rawPlatformsInput = json.platforms;
    const rawPlatformList: Array<Record<string, unknown>> = Array.isArray(rawPlatformsInput)
      ? (rawPlatformsInput as Array<Record<string, unknown>>)
      : rawPlatformsInput && typeof rawPlatformsInput === 'object'
      ? Object.entries(rawPlatformsInput as Record<string, Record<string, unknown>>).map(
          ([pid, val]) => ({
            platformId: pid,
            ...(val && typeof val === 'object' ? val : {}),
          })
        )
      : [];

    const platforms = rawPlatformList.map((p) => {
      const pid = String(p.platformId || '');
      const rawBuckets = Array.isArray(p.buckets)
        ? (p.buckets as Array<Record<string, unknown>>)
        : [];
      const buckets = rawBuckets.map((b) => ({
        credits: Number(b.credits || 0),
        expiresAt:
          formatFriendlyDateLabel(b.expiresAt as string | undefined) ||
          String(b.expiresAt || ''),
        daysRemaining: Number(b.daysRemaining ?? 0),
      }));

      const creditsVal =
        typeof p.credits === 'number'
          ? p.credits
          : typeof p.remainingCharacters === 'number'
          ? p.remainingCharacters
          : null;
      const limitVal =
        typeof p.limit === 'number'
          ? p.limit
          : typeof p.characterLimit === 'number'
          ? p.characterLimit
          : null;
      const resetDay = typeof p.resetDay === 'number' ? p.resetDay : null;
      const nextResetAt =
        formatFriendlyDateLabel(
          (p.nextResetAt as string | undefined) ||
            (typeof p.nextResetUnix === 'number' ? p.nextResetUnix : undefined) ||
            (p.vipLevelExpiresAt as string | undefined) ||
            (p.manualExpiresAt as string | undefined)
        ) || (resetDay ? `Day ${resetDay} monthly` : undefined);

      return {
        platformId: pid,
        name:
          (typeof p.name === 'string' && p.name) ||
          PLATFORM_DISPLAY_LABELS[pid] ||
          pid,
        connected: Boolean(p.connected),
        configured: Boolean(p.configured ?? p.connected),
        credits: creditsVal,
        limit: limitVal,
        unit: typeof p.unit === 'string' ? p.unit : undefined,
        plan:
          (typeof p.plan === 'string' && p.plan) ||
          (typeof p.tier === 'string' && p.tier) ||
          (typeof p.vipLevel === 'string' && p.vipLevel) ||
          undefined,
        vipLevel: typeof p.vipLevel === 'string' ? p.vipLevel : undefined,
        vipLevelExpiresAt: formatFriendlyDateLabel(
          p.vipLevelExpiresAt as string | undefined
        ),
        expiresAt: formatFriendlyDateLabel(p.expiresAt as string | undefined),
        nextResetAt,
        supportsUnlimited: Boolean(p.supportsUnlimited),
        buckets,
        account: typeof p.account === 'string' ? p.account : undefined,
      };
    });

    const rawPools = Array.isArray(json.sharedPools)
      ? (json.sharedPools as Array<Record<string, unknown>>)
      : [];
    const sharedPools: CreditsSummaryResponse['sharedPools'] = [];
    for (const entry of rawPools) {
      if (entry && typeof entry.grants === 'object' && entry.grants !== null) {
        const memberName = String(entry.displayName || entry.email || entry.userId || 'Member');
        const userId = String(entry.userId || memberName);
        const grantsMap = entry.grants as Record<
          string,
          { enabled?: boolean; capCredits?: number | null; usedCredits?: number }
        >;
        for (const [pid, g] of Object.entries(grantsMap)) {
          if (!g || (!g.enabled && !(g.usedCredits && g.usedCredits > 0))) continue;
          const used = Number(g.usedCredits || 0);
          const cap = typeof g.capCredits === 'number' ? g.capCredits : null;
          sharedPools.push({
            id: `${userId}_${pid}`,
            platformId: pid,
            memberName,
            enabled: Boolean(g.enabled),
            capCredits: cap,
            usedCredits: used,
            remainingCredits: cap !== null ? Math.max(0, cap - used) : null,
          });
        }
      } else if (entry && typeof entry.platformId === 'string') {
        const used = Number(entry.usedCredits || 0);
        const cap = typeof entry.capCredits === 'number' ? entry.capCredits : null;
        sharedPools.push({
          id: String(entry.platformId),
          platformId: entry.platformId,
          enabled: Boolean(entry.enabled),
          capCredits: cap,
          usedCredits: used,
          remainingCredits:
            typeof entry.remainingCredits === 'number'
              ? entry.remainingCredits
              : cap !== null
              ? Math.max(0, cap - used)
              : null,
          ownerPoolCredits:
            typeof entry.ownerPoolCredits === 'number' ? entry.ownerPoolCredits : null,
        });
      }
    }

    const rawAlerts = Array.isArray(json.expiringSoonAlerts)
      ? (json.expiringSoonAlerts as Array<Record<string, unknown>>)
      : [];
    const expiringSoonAlerts = rawAlerts.map((al) => {
      const days = Number(al.daysRemaining ?? 0);
      return {
        platformId: String(al.platformId || 'dreamina'),
        credits: Number(al.credits || 0),
        expiresAt:
          formatFriendlyDateLabel(al.expiresAt as string | undefined) ||
          String(al.expiresAt || ''),
        daysRemaining: days,
        severity: (days <= 3 ? 'urgent' : 'warning') as 'urgent' | 'warning',
      };
    });

    return {
      ok: true,
      updatedAt:
        typeof json.updatedAt === 'number'
          ? json.updatedAt
          : typeof json.fetchedAt === 'string'
          ? Date.parse(json.fetchedAt)
          : Date.now(),
      totalPoolCredits:
        typeof json.totalPoolCredits === 'number' ? json.totalPoolCredits : undefined,
      platforms,
      sharedPools,
      expiringSoonAlerts,
    };
  } catch (err) {
    return {
      ok: false,
      platforms: [],
      sharedPools: [],
      expiringSoonAlerts: [],
      error: err instanceof Error ? err.message : 'Failed to load credits summary',
    };
  }
}

export async function fetchCreditQuoteViaBackend(payload: {
  platformId: PlatformId | string;
  modelId: string;
  modality?: ModelModality;
  resolution?: string;
  durationSec?: number;
  aspectRatio?: string;
  batchCount?: number;
  quality?: string;
  useUnlim?: boolean;
  prompt?: string;
  live?: boolean;
}): Promise<CreditQuoteResponse | null> {
  try {
    const res = await authFetch(`${LOCAL_MCP_BASE}/api/credits/quote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return null;
    const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    if (!json || json.ok === false) return null;
    const rawUnit = String(json.unit || 'credits');
    const unit = (rawUnit === 'characters' ? 'chars' : rawUnit) as CreditQuoteResponse['unit'];
    const isUnlim = Boolean(json.isUnlimitedEligible ?? json.unlimitedEligible);
    const estCredits =
      typeof json.estimatedCredits === 'number' ? json.estimatedCredits : null;
    return {
      ok: true,
      platformId: String(json.platformId || payload.platformId),
      modelId: String(json.modelId || payload.modelId),
      estimatedCredits: estCredits,
      estimatedUsd: typeof json.estimatedUsd === 'number' ? json.estimatedUsd : null,
      unit,
      isUnlimitedEligible: isUnlim,
      source: String(json.source || 'rate-table'),
      label:
        typeof json.label === 'string'
          ? json.label
          : isUnlim
          ? '∞ Unlim'
          : estCredits !== null
          ? `${estCredits} ${unit === 'chars' ? 'chars' : 'cr'}`
          : '',
    };
  } catch {
    return null;
  }
}

export async function fetchAssetsViaBackend(
  source: 'all' | 'storage' | 'dreamina' | 'higgsfield' = 'all',
  refresh = false
): Promise<{ ok: boolean; items: CloudAssetItem[]; error?: string }> {
  try {
    const res = await authFetch(
      `${LOCAL_MCP_BASE}/api/assets?source=${encodeURIComponent(source)}&refresh=${refresh ? '1' : '0'}`
    );
    const json = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      items?: Array<Record<string, unknown>>;
      error?: string;
    };
    if (!res.ok || json.ok === false) {
      return { ok: false, items: [], error: json.error || `HTTP ${res.status}` };
    }
    const items = Array.isArray(json.items)
      ? json.items.map((it) => normalizeRawAssetItem(it)).filter((it) => Boolean(it.url))
      : [];
    return {
      ok: true,
      items,
    };
  } catch (err) {
    return {
      ok: false,
      items: [],
      error: err instanceof Error ? err.message : 'Failed to load assets',
    };
  }
}

export async function importAssetViaBackend(payload: {
  url?: string;
  projectId?: string;
  resourceId?: string;
  modality?: string;
  kind?: 'image' | 'video' | 'audio';
  title?: string;
  platformId?: string;
}): Promise<{ ok: boolean; item?: CloudAssetItem; error?: string }> {
  try {
    const res = await authFetch(`${LOCAL_MCP_BASE}/api/assets/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...payload,
        modality: payload.modality || payload.kind || 'image',
      }),
    });
    const json = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      item?: Record<string, unknown>;
      asset?: Record<string, unknown>;
      error?: string;
    };
    const rawObj = json.item || json.asset;
    if (!res.ok || json.ok === false || !rawObj) {
      return { ok: false, error: json.error || `Asset import failed (HTTP ${res.status})` };
    }
    return {
      ok: true,
      item: normalizeRawAssetItem({
        ...rawObj,
        title: payload.title || (rawObj.title as string | undefined),
      }),
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Asset import failed' };
  }
}
