/**
 * @open-dreamflow/mcp-client — Built-In Dreamina MCP Server & Guided Connection Engine
 *
 * Exposes `mcp_dreamina` (`platformId: 'dreamina'`) inside `ExternalMcpHost` with tools:
 *   - `dreamina_models_explore` (10 canonical Seedream / Seedance / OmniHuman models)
 *   - `dreamina_session_status` & `balance`
 *   - `dreamina_generate_image`
 *   - `dreamina_generate_video`
 *
 * Supports three connection modes persisted with `0o600` permissions:
 *   - `'browser'`: Live Chrome Extension bridge / CDP `:9222` tab on `dreamina.capcut.com` or `jimeng.jianying.com`
 *   - `'session'`: Saved Dreamina `sessionid` cookie
 *   - `'ark_api_key'`: BytePlus ModelArk `ARK_API_KEY` (Seedream / Seedance)
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type {
  ExternalMcpHost,
  ExternalMcpToolSchema,
  McpOAuthAccountInfo,
} from './external-mcp-host.js';

export const DREAMINA_MCP_SERVER_ID = 'mcp_dreamina';
export const DREAMINA_STUDIO_URL = 'https://dreamina.capcut.com/ai-tool/home';

export type DreaminaConnectionMode = 'browser' | 'session' | 'ark_api_key';

export type DreaminaSessionStep =
  | 'initializing'
  | 'awaiting_user'
  | 'verifying'
  | 'connected'
  | 'error';

export interface PersistedDreaminaMcpConfig {
  connected: boolean;
  mode: DreaminaConnectionMode;
  account?: string;
  sessionIdCookie?: string;
  arkApiKey?: string;
  arkEndpoint?: string;
  connectedAt: string;
  updatedAt: string;
}

export interface DreaminaMcpSession {
  sessionId: string;
  platformId: 'dreamina';
  serverId: string;
  serverName: string;
  mode: DreaminaConnectionMode;
  step: DreaminaSessionStep;
  authorizeUrl: string;
  account?: McpOAuthAccountInfo;
  toolsCount?: number;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DreaminaBrowserProbeResult {
  extensionTabActive: boolean;
  cdpDreaminaOpen: boolean;
  cdpReachable: boolean;
  openUrls?: string[];
}

export interface DreaminaMcpEngineDeps {
  externalMcpHost: ExternalMcpHost;
  loadProviderSdk: () => Promise<Record<string, unknown>>;
  checkBrowserStatus: () => Promise<DreaminaBrowserProbeResult>;
  launchDreaminaBrowser?: (dryRun?: boolean) => { ok: boolean; error?: string; launchedUrl?: string };
  runBrowserGeneration: (params: Record<string, unknown>) => Promise<Record<string, unknown>>;
  onSessionUpdate?: (session: DreaminaMcpSession) => void;
}

export function resolveDreaminaConfigPath(): string {
  const override = process.env.DREAMFLOW_DREAMINA_CONFIG_PATH?.trim();
  if (override) return override;
  return path.join(os.homedir(), '.open-dreamflow', 'dreamina-mcp.json');
}

const DREAMINA_TOOLS: ExternalMcpToolSchema[] = [
  {
    name: 'dreamina_models_explore',
    description:
      'List all 10 canonical Dreamina Seedream, Seedance, and OmniHuman models with parameter schemas and media roles.',
    inputSchema: {
      type: 'object',
      properties: {
        modality: {
          type: 'string',
          enum: ['all', 'image', 'video'],
          description: 'Optional modality filter.',
        },
      },
    },
  },
  {
    name: 'dreamina_session_status',
    description: 'Inspect current Dreamina MCP connection mode, browser tab / CDP reachability, and credentials.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'balance',
    description: 'Check Dreamina session & credit connection status.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'dreamina_generate_image',
    description:
      'Generate 1-4 images using Dreamina Seedream (5.5, 5.0 Pro/Flash/Lite, 4.5) via ModelArk API or Browser Credit Bridge.',
    inputSchema: {
      type: 'object',
      required: ['prompt'],
      properties: {
        prompt: { type: 'string', description: 'Detailed image prompt.' },
        model: {
          type: 'string',
          description: 'Model ID (seedream_5_5, seedream_5_0_pro, seedream_5_0_flash, seedream_5_0_lite, seedream_4_5).',
        },
        aspect_ratio: { type: 'string', description: 'Aspect ratio such as 16:9, 9:16, 1:1.' },
        resolution: { type: 'string', description: 'Target resolution such as 2K or 4K.' },
        batch_count: { type: 'number', description: 'Number of images to generate (1-4).' },
        count: { type: 'number', description: 'Alias for batch_count (1-4).' },
        negative_prompt: { type: 'string' },
        reference_images: { type: 'array', items: { type: 'string' } },
        seed: { type: 'number' },
      },
    },
  },
  {
    name: 'dreamina_generate_video',
    description:
      'Generate video using Dreamina Seedance 2.5 / 2.5 Flash / 2.0 / 1.5 Pro / OmniHuman 1.5 with image & video references.',
    inputSchema: {
      type: 'object',
      required: ['prompt'],
      properties: {
        prompt: { type: 'string', description: 'Detailed motion & scene prompt.' },
        model: {
          type: 'string',
          description: 'Model ID (seedance_2_5, seedance_2_5_flash, seedance_2_0, seedance_1_5_pro, omnihuman_1_5).',
        },
        aspect_ratio: { type: 'string' },
        resolution: { type: 'string', enum: ['480p', '720p', '1080p'] },
        duration: { type: 'number', description: 'Duration in seconds (4-15).' },
        start_image_url: { type: 'string' },
        end_image_url: { type: 'string' },
        reference_images: { type: 'array', items: { type: 'string' } },
        video_references: { type: 'array', items: { type: 'string' } },
        generate_audio: { type: 'boolean' },
        negative_prompt: { type: 'string' },
        seed: { type: 'number' },
      },
    },
  },
];

function mapCanonicalDreaminaToArkModel(canonicalId: string, config?: PersistedDreaminaMcpConfig | null): string {
  if (config?.arkEndpoint?.trim()) {
    return config.arkEndpoint.trim();
  }
  const map: Record<string, string> = {
    seedream_5_5: 'seedream-5.5',
    seedream_5_0_pro: 'seedream-5.0-pro',
    seedream_5_0_flash: 'seedream-5.0-flash',
    seedream_5_0_lite: 'seedream-5.0-lite',
    seedream_4_5: 'seedream-4.5',
    seedance_2_5: 'seedance-2.5',
    seedance_2_5_flash: 'seedance-2.5-flash',
    seedance_2_0: 'seedance-2.0',
    seedance_1_5_pro: 'seedance-1.5-pro',
    omnihuman_1_5: 'omnihuman-1.5',
  };
  return map[canonicalId] || canonicalId;
}

export class DreaminaMcpEngine {
  private readonly deps: DreaminaMcpEngineDeps;
  private readonly sessions = new Map<string, DreaminaMcpSession>();
  private config: PersistedDreaminaMcpConfig | null = null;

  constructor(deps: DreaminaMcpEngineDeps) {
    this.deps = deps;
  }

  public getConfig(): PersistedDreaminaMcpConfig | null {
    return this.config ? { ...this.config } : null;
  }

  public hydrateOnStartup(): void {
    const cfgPath = resolveDreaminaConfigPath();
    try {
      if (!fs.existsSync(cfgPath)) return;
      const raw = JSON.parse(fs.readFileSync(cfgPath, 'utf8')) as Partial<PersistedDreaminaMcpConfig>;
      if (!raw || raw.connected !== true || !raw.mode) return;
      this.config = {
        connected: true,
        mode: raw.mode,
        account: raw.account,
        sessionIdCookie: raw.sessionIdCookie,
        arkApiKey: raw.arkApiKey,
        arkEndpoint: raw.arkEndpoint,
        connectedAt: raw.connectedAt || new Date().toISOString(),
        updatedAt: raw.updatedAt || new Date().toISOString(),
      };
      this.registerVirtualServer();
    } catch {
      // Ignore invalid persisted Dreamina MCP config on startup
    }
  }

  private writeConfigToDisk(cfg: PersistedDreaminaMcpConfig): void {
    const targetPath = resolveDreaminaConfigPath();
    const dir = path.dirname(targetPath);
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    const tmp = `${targetPath}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(cfg, null, 2), { encoding: 'utf8', mode: 0o600 });
    fs.chmodSync(tmp, 0o600);
    fs.renameSync(tmp, targetPath);
    fs.chmodSync(targetPath, 0o600);
  }

  private clearConfigFromDisk(): void {
    const targetPath = resolveDreaminaConfigPath();
    try {
      if (fs.existsSync(targetPath)) {
        fs.unlinkSync(targetPath);
      }
    } catch {
      // Ignore cleanup failure
    }
  }

  private buildAccountInfo(cfg: PersistedDreaminaMcpConfig | null): McpOAuthAccountInfo | undefined {
    if (!cfg) return undefined;
    const label =
      cfg.mode === 'ark_api_key'
        ? 'BytePlus ModelArk API'
        : cfg.mode === 'session'
          ? 'Dreamina Session Cookie'
          : 'Dreamina Browser Session';
    return {
      name: cfg.account || label,
      username: `dreamina-${cfg.mode}`,
    };
  }

  public registerVirtualServer(): void {
    const account = this.buildAccountInfo(this.config);
    this.deps.externalMcpHost.registerVirtualServer({
      id: DREAMINA_MCP_SERVER_ID,
      name: 'Dreamina MCP (Seedream 5.5 & Seedance 2.5)',
      platformId: 'dreamina',
      url: 'builtin://mcp_dreamina',
      account,
      authType: this.config?.mode === 'ark_api_key' ? 'headers' : 'oauth',
      getTools: () => DREAMINA_TOOLS,
      callTool: (toolName, args, timeoutMs) => this.executeToolCall(toolName, args, timeoutMs),
      onRemove: () => {
        this.config = null;
        this.clearConfigFromDisk();
      },
    });
  }

  private emitSessionUpdate(session: DreaminaMcpSession): void {
    this.deps.onSessionUpdate?.({ ...session });
  }

  public async connect(params: {
    mode?: string;
    sessionIdCookie?: string;
    arkApiKey?: string;
    arkEndpoint?: string;
    launchBrowser?: boolean;
  }): Promise<DreaminaMcpSession> {
    const rawMode = String(params.mode || '').trim().toLowerCase();
    const mode: DreaminaConnectionMode =
      rawMode === 'ark_api_key' || rawMode === 'api_key' || rawMode === 'ark'
        ? 'ark_api_key'
        : rawMode === 'session' || rawMode === 'cookie'
          ? 'session'
          : 'browser';

    const now = new Date().toISOString();
    const sessionId = `drm_mcp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const session: DreaminaMcpSession = {
      sessionId,
      platformId: 'dreamina',
      serverId: DREAMINA_MCP_SERVER_ID,
      serverName: 'Dreamina MCP (Seedream 5.5 & Seedance 2.5)',
      mode,
      step: 'initializing',
      authorizeUrl: DREAMINA_STUDIO_URL,
      createdAt: now,
      updatedAt: now,
    };
    this.sessions.set(sessionId, session);
    this.emitSessionUpdate(session);

    if (mode === 'ark_api_key') {
      const arkApiKey = String(
        params.arkApiKey || process.env.ARK_API_KEY || process.env.SEEDANCE_API_KEY || ''
      ).trim();
      const arkEndpoint = typeof params.arkEndpoint === 'string' ? params.arkEndpoint.trim() : undefined;
      if (!arkApiKey) {
        session.step = 'error';
        session.error = 'BytePlus ModelArk API Key (`arkApiKey`) is required for ark_api_key mode.';
        session.updatedAt = new Date().toISOString();
        this.emitSessionUpdate(session);
        return { ...session };
      }

      const cfg: PersistedDreaminaMcpConfig = {
        connected: true,
        mode: 'ark_api_key',
        account: `Ark Key (${arkApiKey.slice(0, 6)}...)`,
        arkApiKey,
        ...(arkEndpoint ? { arkEndpoint } : {}),
        connectedAt: now,
        updatedAt: now,
      };
      this.config = cfg;
      this.writeConfigToDisk(cfg);
      this.registerVirtualServer();

      session.step = 'connected';
      session.account = this.buildAccountInfo(cfg);
      session.toolsCount = DREAMINA_TOOLS.length;
      session.updatedAt = new Date().toISOString();
      this.emitSessionUpdate(session);
      return { ...session };
    }

    if (mode === 'session') {
      const cookie = String(params.sessionIdCookie || '').trim();
      if (!cookie) {
        session.step = 'error';
        session.error = 'Dreamina `sessionIdCookie` is required for session mode.';
        session.updatedAt = new Date().toISOString();
        this.emitSessionUpdate(session);
        return { ...session };
      }

      const cfg: PersistedDreaminaMcpConfig = {
        connected: true,
        mode: 'session',
        account: `Dreamina Cookie (${cookie.slice(0, 6)}...)`,
        sessionIdCookie: cookie,
        connectedAt: now,
        updatedAt: now,
      };
      this.config = cfg;
      this.writeConfigToDisk(cfg);
      this.registerVirtualServer();

      session.step = 'connected';
      session.account = this.buildAccountInfo(cfg);
      session.toolsCount = DREAMINA_TOOLS.length;
      session.updatedAt = new Date().toISOString();
      this.emitSessionUpdate(session);
      return { ...session };
    }

    // Mode: 'browser' (Live Dreamina tab via Chrome Bridge Extension or CDP :9222)
    session.step = 'verifying';
    session.updatedAt = new Date().toISOString();
    this.emitSessionUpdate(session);

    const probe = await this.deps.checkBrowserStatus();
    if (probe.extensionTabActive || probe.cdpDreaminaOpen) {
      const cfg: PersistedDreaminaMcpConfig = {
        connected: true,
        mode: 'browser',
        account: probe.extensionTabActive
          ? 'Dreamina Chrome Bridge Tab'
          : 'Dreamina Browser Tab (CDP)',
        connectedAt: now,
        updatedAt: now,
      };
      this.config = cfg;
      this.writeConfigToDisk(cfg);
      this.registerVirtualServer();

      session.step = 'connected';
      session.account = this.buildAccountInfo(cfg);
      session.toolsCount = DREAMINA_TOOLS.length;
      session.updatedAt = new Date().toISOString();
      this.emitSessionUpdate(session);
      return { ...session };
    }

    if (params.launchBrowser !== false && this.deps.launchDreaminaBrowser) {
      this.deps.launchDreaminaBrowser(false);
    }

    session.step = 'awaiting_user';
    session.updatedAt = new Date().toISOString();
    this.emitSessionUpdate(session);
    return { ...session };
  }

  public async getSessionStatus(sessionId: string): Promise<DreaminaMcpSession | null> {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    if (session.mode === 'browser' && session.step === 'awaiting_user') {
      const probe = await this.deps.checkBrowserStatus();
      if (probe.extensionTabActive || probe.cdpDreaminaOpen) {
        const now = new Date().toISOString();
        const cfg: PersistedDreaminaMcpConfig = {
          connected: true,
          mode: 'browser',
          account: probe.extensionTabActive
            ? 'Dreamina Chrome Bridge Tab'
            : 'Dreamina Browser Tab (CDP)',
          connectedAt: now,
          updatedAt: now,
        };
        this.config = cfg;
        this.writeConfigToDisk(cfg);
        this.registerVirtualServer();

        session.step = 'connected';
        session.account = this.buildAccountInfo(cfg);
        session.toolsCount = DREAMINA_TOOLS.length;
        session.updatedAt = now;
        this.emitSessionUpdate(session);
      }
    }

    return { ...session };
  }

  public async disconnect(): Promise<{ ok: true; disconnected: boolean }> {
    const wasConnected = Boolean(this.config?.connected) ||
      this.deps.externalMcpHost.listServers().some((s) => s.id === DREAMINA_MCP_SERVER_ID);
    this.config = null;
    this.clearConfigFromDisk();
    this.deps.externalMcpHost.unregisterVirtualServer(DREAMINA_MCP_SERVER_ID);
    return { ok: true, disconnected: wasConnected };
  }

  public async getModelsCatalog(modality = 'all'): Promise<Array<Record<string, unknown>>> {
    const sdk = await this.deps.loadProviderSdk();
    const models = (Array.isArray(sdk.DREAMINA_CANONICAL_MODELS)
      ? sdk.DREAMINA_CANONICAL_MODELS
      : []) as Array<Record<string, unknown>>;
    if (modality === 'image' || modality === 'video') {
      return models.filter((m) => String(m.modality || '') === modality);
    }
    return models;
  }

  private async executeToolCall(
    toolName: string,
    args: Record<string, unknown>,
    timeoutMs?: number
  ): Promise<Record<string, unknown>> {
    const sdk = await this.deps.loadProviderSdk();
    const normalizeModel =
      typeof sdk.normalizeDreaminaModelId === 'function'
        ? (sdk.normalizeDreaminaModelId as (raw?: string, modality?: 'image' | 'video') => string)
        : (raw?: string) => String(raw || '').trim() || 'seedream_5_5';

    if (toolName === 'dreamina_models_explore') {
      const modality = String(args.modality || 'all').toLowerCase();
      const models = await this.getModelsCatalog(modality);
      const payload = { ok: true, platformId: 'dreamina', count: models.length, models };
      return {
        structuredContent: payload,
        content: [{ type: 'text', text: JSON.stringify(payload) }],
      };
    }

    if (toolName === 'dreamina_session_status' || toolName === 'balance') {
      const probe = await this.deps.checkBrowserStatus();
      const mode = this.config?.mode || 'browser';
      const hasApiKey = Boolean(
        this.config?.arkApiKey || process.env.ARK_API_KEY || process.env.SEEDANCE_API_KEY
      );
      const payload = {
        ok: true,
        connected: Boolean(this.config?.connected || probe.extensionTabActive || probe.cdpDreaminaOpen || hasApiKey),
        mode,
        account: this.config?.account || 'Dreamina MCP',
        browserExtensionActive: probe.extensionTabActive,
        cdpDreaminaOpen: probe.cdpDreaminaOpen,
        hasArkApiKey: hasApiKey,
        hasSessionCookie: Boolean(this.config?.sessionIdCookie),
        plan: mode === 'ark_api_key' ? 'BytePlus ModelArk' : 'Dreamina Subscription',
      };
      return {
        structuredContent: payload,
        content: [{ type: 'text', text: JSON.stringify(payload) }],
      };
    }

    if (toolName === 'dreamina_generate_image') {
      const prompt = String(args.prompt || '').trim();
      if (!prompt) {
        return {
          isError: true,
          content: [{ type: 'text', text: 'dreamina_generate_image requires a non-empty prompt.' }],
        };
      }
      const canonicalModel = normalizeModel(
        typeof args.model === 'string' ? args.model : 'seedream_5_5',
        'image'
      );
      const batchCount = Math.max(
        1,
        Math.min(4, Math.round(Number(args.batch_count ?? args.count ?? args.n ?? 1) || 1))
      );
      const aspectRatio = String(args.aspect_ratio || '16:9').trim();
      const resolution = String(args.resolution || '2K').trim();
      const refImages = Array.isArray(args.reference_images)
        ? (args.reference_images as unknown[]).filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
        : [];
      const seed = typeof args.seed === 'number' && Number.isFinite(args.seed) ? Math.round(args.seed) : undefined;

      const effectiveArkKey = String(
        this.config?.arkApiKey || process.env.ARK_API_KEY || process.env.SEEDANCE_API_KEY || ''
      ).trim();

      if (this.config?.mode === 'ark_api_key' || effectiveArkKey) {
        const SeedanceClientCtor = sdk.SeedanceClient as new (cfg: { apiKey: string; baseUrl?: string }) => {
          generateImage: (req: Record<string, unknown>) => Promise<{
            model: string;
            imageUrl?: string;
            imageBase64?: string;
            imageUrls?: string[];
            images?: Array<{ url?: string; b64_json?: string }>;
          }>;
        };
        const client = new SeedanceClientCtor({ apiKey: effectiveArkKey });
        const arkModel = mapCanonicalDreaminaToArkModel(canonicalModel, this.config);
        const firstOut = await client.generateImage({
          model: arkModel,
          prompt,
          aspectRatio,
          referenceImages: refImages,
          n: batchCount,
          seed,
        });

        const collected: string[] = [];
        const rawList = Array.isArray(firstOut.imageUrls) && firstOut.imageUrls.length > 0
          ? firstOut.imageUrls
          : firstOut.imageUrl
            ? [firstOut.imageUrl]
            : firstOut.imageBase64
              ? [`data:image/png;base64,${firstOut.imageBase64}`]
              : [];
        collected.push(...rawList);

        if (collected.length < batchCount) {
          const remaining = batchCount - collected.length;
          const extraOuts = await Promise.all(
            Array.from({ length: remaining }, (_, idx) =>
              client.generateImage({
                model: arkModel,
                prompt,
                aspectRatio,
                referenceImages: refImages,
                n: 1,
                seed: seed !== undefined ? seed + idx + 1 : Math.floor(Math.random() * 2_000_000_000),
              })
            )
          );
          for (const extra of extraOuts) {
            const url =
              extra.imageUrls?.[0] ||
              extra.imageUrl ||
              (extra.imageBase64 ? `data:image/png;base64,${extra.imageBase64}` : '');
            if (url) collected.push(url);
          }
        }

        const images = collected.slice(0, batchCount);
        const payload = {
          ok: true,
          status: 'completed',
          model: canonicalModel,
          imageUrl: images[0],
          images: images.map((url) => ({ url })),
        };
        return {
          structuredContent: payload,
          content: [{ type: 'text', text: JSON.stringify(payload) }],
        };
      }

      const probe = await this.deps.checkBrowserStatus();
      if (this.config?.mode === 'browser' || probe.extensionTabActive) {
        const bridgeOut = await this.deps.runBrowserGeneration({
          target: 'dreamina',
          mode: 'image',
          modelId: canonicalModel,
          prompt,
          negativePrompt: typeof args.negative_prompt === 'string' ? args.negative_prompt : undefined,
          aspectRatio,
          resolution,
          batchCount,
          referenceImages: refImages,
          smartFastFail: true,
          claimTimeoutMs: 15_000,
          timeoutMs: timeoutMs || 150_000,
        });
        const outputs =
          Array.isArray(bridgeOut.outputs) && bridgeOut.outputs.length > 0
            ? (bridgeOut.outputs as string[])
            : bridgeOut.mediaUrl
              ? [String(bridgeOut.mediaUrl)]
              : [];
        const payload = {
          ok: true,
          status: 'completed',
          model: canonicalModel,
          imageUrl: outputs[0],
          images: outputs.map((url) => ({ url })),
        };
        return {
          structuredContent: payload,
          content: [{ type: 'text', text: JSON.stringify(payload) }],
        };
      }

      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: 'Dreamina MCP requires an active dreamina.capcut.com Browser Bridge tab or a BytePlus ModelArk API Key (`arkApiKey`) to execute real generations.',
          },
        ],
      };
    }

    if (toolName === 'dreamina_generate_video') {
      const prompt = String(args.prompt || '').trim();
      if (!prompt) {
        return {
          isError: true,
          content: [{ type: 'text', text: 'dreamina_generate_video requires a non-empty prompt.' }],
        };
      }
      const canonicalModel = normalizeModel(
        typeof args.model === 'string' ? args.model : 'seedance_2_5',
        'video'
      );
      const aspectRatio = String(args.aspect_ratio || '16:9').trim();
      const resolution = String(args.resolution || '1080p').trim();
      const durationSec = Math.max(4, Math.min(15, Math.round(Number(args.duration ?? 5) || 5)));
      const generateAudio = typeof args.generate_audio === 'boolean' ? args.generate_audio : true;
      const startImageUrl =
        typeof args.start_image_url === 'string' && args.start_image_url.trim()
          ? args.start_image_url.trim()
          : undefined;
      const endImageUrl =
        typeof args.end_image_url === 'string' && args.end_image_url.trim()
          ? args.end_image_url.trim()
          : undefined;
      const refImages = Array.isArray(args.reference_images)
        ? (args.reference_images as unknown[]).filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
        : [];
      const videoRefs = Array.isArray(args.video_references)
        ? (args.video_references as unknown[]).filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
        : [];
      const seed = typeof args.seed === 'number' && Number.isFinite(args.seed) ? Math.round(args.seed) : undefined;

      const effectiveArkKey = String(
        this.config?.arkApiKey || process.env.ARK_API_KEY || process.env.SEEDANCE_API_KEY || ''
      ).trim();

      if (this.config?.mode === 'ark_api_key' || effectiveArkKey) {
        const SeedanceClientCtor = sdk.SeedanceClient as new (cfg: { apiKey: string; baseUrl?: string }) => {
          generateVideo: (req: Record<string, unknown>) => Promise<{
            model: string;
            taskId: string;
            status: string;
            videoUrl?: string;
          }>;
        };
        const client = new SeedanceClientCtor({ apiKey: effectiveArkKey });
        const out = await client.generateVideo({
          model: mapCanonicalDreaminaToArkModel(canonicalModel, this.config),
          prompt,
          aspectRatio,
          resolution,
          durationSeconds: durationSec,
          referenceImages: refImages,
          videoReferences: videoRefs,
          startImageUrl,
          endImageUrl,
          generateAudio,
          seed,
        });
        const payload = {
          ok: true,
          status: 'completed',
          model: canonicalModel,
          taskId: out.taskId,
          videoUrl: out.videoUrl,
        };
        return {
          structuredContent: payload,
          content: [{ type: 'text', text: JSON.stringify(payload) }],
        };
      }

      const probe = await this.deps.checkBrowserStatus();
      if (this.config?.mode === 'browser' || probe.extensionTabActive) {
        const allRefs = [startImageUrl, ...refImages, endImageUrl].filter((x): x is string => Boolean(x));
        const bridgeOut = await this.deps.runBrowserGeneration({
          target: 'dreamina',
          mode: 'video',
          modelId: canonicalModel,
          prompt,
          negativePrompt: typeof args.negative_prompt === 'string' ? args.negative_prompt : undefined,
          aspectRatio,
          resolution,
          durationSec,
          audioEnabled: generateAudio,
          referenceImages: allRefs,
          videoReferences: videoRefs,
          smartFastFail: true,
          claimTimeoutMs: 15_000,
          timeoutMs: timeoutMs || 150_000,
        });
        const payload = {
          ok: true,
          status: 'completed',
          model: canonicalModel,
          videoUrl: bridgeOut.videoUrl || bridgeOut.mediaUrl,
        };
        return {
          structuredContent: payload,
          content: [{ type: 'text', text: JSON.stringify(payload) }],
        };
      }

      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: 'Dreamina MCP requires an active dreamina.capcut.com Browser Bridge tab or a BytePlus ModelArk API Key (`arkApiKey`) to generate video.',
          },
        ],
      };
    }

    return {
      isError: true,
      content: [{ type: 'text', text: `Unknown Dreamina MCP tool: ${toolName}` }],
    };
  }
}
