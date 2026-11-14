/**
 * @open-dreamflow/mcp-client — Built-In Dreamina MCP Server & Official `dreamina-canvas` 1.3.0 CLI Engine
 *
 * Exposes `mcp_dreamina` (`platformId: 'dreamina'`) inside `ExternalMcpHost` with tools:
 *   - `dreamina_models_explore` (Seedream, Nano Banana, GPT Image, Seedance, Veo, Wan, HappyHorse, Gemini Omni, OmniHuman, SeedAudio)
 *   - `dreamina_session_status` & `balance`
 *   - `dreamina_generate_image`
 *   - `dreamina_generate_video`
 *   - `dreamina_generate_audio`
 *
 * Supports four connection modes persisted with `0o600` permissions:
 *   - `'cli_oauth'` (Default & Recommended): First-party CapCut/ByteDance `dreamina-canvas` (`v1.3.0`) CLI Engine with device OAuth + workspace `canvas` isolation
 *   - `'browser'`: Live Chrome Extension bridge / verified CDP tab on `dreamina.capcut.com` or `jimeng.jianying.com`
 *   - `'session'`: Saved Dreamina `sessionid` cookie
 *   - `'ark_api_key'`: BytePlus ModelArk `ARK_API_KEY` (Seedream / Seedance)
 */

import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type {
  ExternalMcpHost,
  ExternalMcpToolSchema,
  McpOAuthAccountInfo,
} from './external-mcp-host.js';

const execFileAsync = promisify(execFile);

export const DREAMINA_MCP_SERVER_ID = 'mcp_dreamina';
export const DREAMINA_STUDIO_URL = 'https://dreamina.capcut.com/ai-tool/home';
const DREAMINA_MIN_CLI_VERSION = '1.3.0';
const STAGED_DREAMINA_CLI_PATH =
  '/Users/seba/.gemini/antigravity/brain/4d2231f7-5ae8-4e5e-905f-2ac321750af6/scratch/dreamina-cli-inspect/bin/dreamina-canvas';
const DREAMINA_CLI_INSTALL_SCRIPT_URL = 'https://dreamina.capcut.com/canvas-cli/install.sh';
const DREAMINA_WORKSPACE_NAME = 'Open-DreamFlow Bridge';

export type DreaminaConnectionMode = 'cli_oauth' | 'browser' | 'session' | 'ark_api_key';

export type DreaminaSessionStep =
  | 'initializing'
  | 'awaiting_login'
  | 'awaiting_user'
  | 'verifying'
  | 'connected'
  | 'error';

export interface PersistedDreaminaMcpConfig {
  connected: boolean;
  mode: DreaminaConnectionMode;
  account?: string;
  userId?: string;
  vipLevel?: string;
  availableCredits?: number;
  cliBinaryPath?: string;
  cliVersion?: string;
  projectId?: string;
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
  userCode?: string;
  account?: McpOAuthAccountInfo;
  balance?: {
    credits?: number;
    plan?: string;
    account?: string;
    rawText?: string;
  };
  tools?: Array<{ name: string; description?: string }>;
  availableCredits?: number;
  vipLevel?: string;
  projectId?: string;
  cliVersion?: string;
  toolsCount?: number;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DreaminaBrowserProbeResult {
  extensionTabActive: boolean;
  cdpDreaminaOpen: boolean;
  cdpDreaminaLoggedIn?: boolean;
  cdpReachable: boolean;
  openUrls?: string[];
}

export interface DreaminaCliAuthProbe {
  cliBinaryPath: string;
  cliVersion: string;
  loggedIn: boolean;
  displayName?: string;
  userId?: string;
  availableCredits?: number;
  isVip?: boolean;
  vipLevel?: string;
  expiresAt?: string;
}

export interface DreaminaMcpEngineDeps {
  externalMcpHost: ExternalMcpHost;
  loadProviderSdk: () => Promise<Record<string, unknown>>;
  checkBrowserStatus: () => Promise<DreaminaBrowserProbeResult>;
  launchDreaminaBrowser?: (dryRun?: boolean) => { ok: boolean; error?: string; launchedUrl?: string };
  runBrowserGeneration: (params: Record<string, unknown>) => Promise<Record<string, unknown>>;
  mediaDir?: string;
  getPublicBaseUrl?: () => string;
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
      'List all Dreamina Seedream, Nano Banana, GPT Image, Seedance, Veo, Wan, HappyHorse, OmniHuman, and SeedAudio models with live CLI parameter schemas.',
    inputSchema: {
      type: 'object',
      properties: {
        modality: {
          type: 'string',
          enum: ['all', 'image', 'video', 'audio'],
          description: 'Optional modality filter.',
        },
      },
    },
  },
  {
    name: 'dreamina_session_status',
    description:
      'Inspect current Dreamina MCP connection mode, CLI auth state, live credits, workspace projectId, and browser/API credentials.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'balance',
    description: 'Check live Dreamina account credits and VIP tier.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'dreamina_generate_image',
    description:
      'Generate 1-8 images using Dreamina Seedream (5.5, 5.0 Pro/Lite, 4.7/4.6/4.5), Nano Banana 2.1/Pro, or GPT Image 2.5 via dreamina-canvas CLI OAuth, ModelArk API, or Browser Bridge.',
    inputSchema: {
      type: 'object',
      required: ['prompt'],
      properties: {
        prompt: { type: 'string', description: 'Detailed image prompt.' },
        model: {
          type: 'string',
          description:
            'Model ID (seedream_5_5, seedream_5_0_pro, seedream_5_0_lite, seedream_4_7, jm_image_model_gg_bp_21, gemini_3_image_pro, dreamina_gpt_image_2_5_flare, gpt_image_2).',
        },
        aspect_ratio: { type: 'string', description: 'Aspect ratio such as 16:9, 9:16, 1:1, 4:3, 3:4, 21:9.' },
        resolution: { type: 'string', description: 'Target resolution such as 1.5K, 2K, or 4K.' },
        quality: { type: 'string', description: 'Optional quality hint (standard, high, ultra).' },
        batch_count: { type: 'number', description: 'Number of images to generate (1-8).' },
        count: { type: 'number', description: 'Alias for batch_count (1-8).' },
        negative_prompt: { type: 'string' },
        reference_images: { type: 'array', items: { type: 'string' } },
        seed: { type: 'number' },
      },
    },
  },
  {
    name: 'dreamina_generate_video',
    description:
      'Generate video using Dreamina Seedance 2.5 / 2.5 Flash / 2.5 Draft / 2.0 / 1.5 Pro, Veo 3.1, Wan 3.0, HappyHorse 1.1, Gemini Omni 1.1 Flash, or OmniHuman 1.5.',
    inputSchema: {
      type: 'object',
      required: ['prompt'],
      properties: {
        prompt: { type: 'string', description: 'Detailed motion & scene prompt.' },
        model: {
          type: 'string',
          description:
            'Model ID (seedance_2_5, seedance_2_5_flash, seedance_2_5_draft, seedance_2_0, veo_3_1, wan_3_0, happyhorse_1_1, omnihuman_1_5).',
        },
        mode: {
          type: 'string',
          enum: ['t2v', 'first_last_frame', 'm2v'],
          description: 'Optional generation mode override.',
        },
        aspect_ratio: { type: 'string' },
        resolution: { type: 'string', description: 'Target resolution (480p, 720p, 720P, 1080p, 1080P, 4k).' },
        duration: { type: 'number', description: 'Duration in seconds (4-30).' },
        reference_frame_mode: { type: 'string', enum: ['start-end', 'multi-ref', 'auto'] },
        start_image_url: { type: 'string' },
        end_image_url: { type: 'string' },
        reference_images: { type: 'array', items: { type: 'string' } },
        video_references: { type: 'array', items: { type: 'string' } },
        audio_references: { type: 'array', items: { type: 'string' } },
        generate_audio: { type: 'boolean' },
        negative_prompt: { type: 'string' },
        seed: { type: 'number' },
      },
    },
  },
  {
    name: 'dreamina_generate_audio',
    description:
      'Generate speech or omni-dubbing audio using Dreamina SeedAudio 1.0 (`seed_audio_v1`).',
    inputSchema: {
      type: 'object',
      required: ['prompt'],
      properties: {
        prompt: { type: 'string', description: 'TTS script or audio generation prompt.' },
        model: { type: 'string', description: 'Audio model ID (seed_audio_v1).' },
        mode: { type: 'string', enum: ['tts', 'music'], description: 'Audio mode (default: tts).' },
        scenario: { type: 'string', enum: ['text-reading', 'omni-dubbing'] },
        voice_name: { type: 'string', description: 'Catalog voice name for text-reading.' },
        voice_id: { type: 'string', description: 'Catalog voice ID.' },
        duration: { type: 'number', description: 'Duration in seconds for music mode.' },
        reference_images: { type: 'array', items: { type: 'string' } },
        audio_references: { type: 'array', items: { type: 'string' } },
      },
    },
  },
];

function compareSemver(a: string, b: string): number {
  const pa = a.replace(/^v/i, '').split('.').map((n) => parseInt(n, 10) || 0);
  const pb = b.replace(/^v/i, '').split('.').map((n) => parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i += 1) {
    const da = pa[i] || 0;
    const db = pb[i] || 0;
    if (da !== db) return da > db ? 1 : -1;
  }
  return 0;
}

function parseCliJsonOutput(stdout: string): Record<string, unknown> {
  const trimmed = String(stdout || '').trim();
  if (!trimmed) {
    throw new Error('dreamina-canvas CLI returned empty output.');
  }
  const lines = trimmed
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const line = lines[i];
    if (line.startsWith('{') && line.endsWith('}')) {
      try {
        return JSON.parse(line) as Record<string, unknown>;
      } catch {
        // Try whole buffer below
      }
    }
  }
  return JSON.parse(trimmed) as Record<string, unknown>;
}

function mapCanonicalDreaminaToArkModel(
  canonicalId: string,
  config?: PersistedDreaminaMcpConfig | null
): string {
  if (config?.arkEndpoint?.trim()) {
    return config.arkEndpoint.trim();
  }
  const map: Record<string, string> = {
    seedream_5_5: 'seedream-5.5',
    seedream_5_0_pro: 'seedream-5.0-pro',
    seedream_5_0_flash: 'seedream-5.0-flash',
    seedream_5_0_lite: 'seedream-5.0-lite',
    seedream_4_7: 'seedream-4.7',
    seedream_4_6: 'seedream-4.6',
    seedream_4_5: 'seedream-4.5',
    seedance_2_5: 'seedance-2.5',
    seedance_2_5_flash: 'seedance-2.5-flash',
    seedance_2_0: 'seedance-2.0',
    seedance_1_5_pro: 'seedance-1.5-pro',
    omnihuman_1_5: 'omnihuman-1.5',
  };
  return map[canonicalId] || canonicalId;
}

function defaultCliModelForCanonical(
  canonicalId: string,
  modality: 'image' | 'video' | 'audio'
): string {
  const map: Record<string, string> = {
    seedream_5_5: 'seedream_5.5',
    seedream_5_0_pro: 'seedream_5.0_pro',
    seedream_5_0_flash: 'seedream_5.0_lite',
    seedream_5_0_lite: 'seedream_5.0_lite',
    seedream_4_7: 'seedream_4.7',
    seedream_4_6: 'seedream_4.6',
    seedream_4_5: 'seedream_4.5',
    jm_image_model_gg_bp_21: 'jm_image_model_gg_bp_21',
    gemini_3_image_pro: 'gemini_3_image_pro',
    dreamina_gpt_image_2_5_flare: 'dreamina_gpt_image_2_5_flare',
    dreamina_gpt_image_2_5_sunburst: 'dreamina_gpt_image_2_5_sunburst',
    gpt_image_2: 'gpt_image_2',
    seedance_2_5: 'seedance_2.5',
    seedance_2_5_flash: 'seedance_2.5_flash',
    seedance_2_5_draft: 'seedance_2.5_draft',
    seedance_2_0: 'seedance_2.0',
    seedance_2_0_fast: 'seedance_2.0_fast',
    seedance_1_5_pro: 'seedance_pro_fast',
    veo_3_1: 'veo_3.1',
    veo_3_1_fast: 'veo_3.1_fast',
    wan_3_0: 'wan_3.0',
    happyhorse_1_1: 'happyhorse_1.1',
    gemini_omni_1_1_flash: 'gemini_omni_1.1_flash',
    omnihuman_1_5: 'seedance_2.5',
    seed_audio_v1: 'seed_audio_v1',
  };
  if (map[canonicalId]) return map[canonicalId];
  if (modality === 'audio') return 'seed_audio_v1';
  if (modality === 'video') return 'seedance_2.5';
  return 'seedream_5.5';
}

function collectResourceIdsAndUrls(
  node: unknown,
  foundIds: string[],
  foundUrls: string[],
  seen = new Set<unknown>()
): void {
  if (!node || typeof node !== 'object' || seen.has(node)) return;
  seen.add(node);

  if (Array.isArray(node)) {
    for (const item of node) {
      if (typeof item === 'string') {
        const s = item.trim();
        if (/^https?:\/\//i.test(s)) foundUrls.push(s);
        else if (s && !s.includes(' ') && foundIds.length < 32) foundIds.push(s);
      } else {
        collectResourceIdsAndUrls(item, foundIds, foundUrls, seen);
      }
    }
    return;
  }

  const obj = node as Record<string, unknown>;
  for (const key of ['resourceId', 'resource_id', 'outputResourceId', 'primaryResourceId']) {
    const val = obj[key];
    if (typeof val === 'string' && val.trim() && !foundIds.includes(val.trim())) {
      foundIds.push(val.trim());
    }
  }
  for (const key of ['resourceIds', 'resource_ids', 'outputResourceIds']) {
    const arr = obj[key];
    if (Array.isArray(arr)) {
      for (const item of arr) {
        if (typeof item === 'string' && item.trim() && !foundIds.includes(item.trim())) {
          foundIds.push(item.trim());
        }
      }
    }
  }
  for (const key of ['url', 'imageUrl', 'videoUrl', 'audioUrl', 'downloadUrl', 'mediaUrl']) {
    const val = obj[key];
    if (typeof val === 'string' && /^https?:\/\//i.test(val.trim()) && !foundUrls.includes(val.trim())) {
      foundUrls.push(val.trim());
    }
  }
  for (const nestedKey of [
    'outputs',
    'output',
    'resources',
    'items',
    'node',
    'nodes',
    'result',
    'results',
    'candidates',
    'artifacts',
    'data',
  ]) {
    if (obj[nestedKey] !== undefined) {
      collectResourceIdsAndUrls(obj[nestedKey], foundIds, foundUrls, seen);
    }
  }
}

interface CliModelModeFlagSpec {
  flag?: string;
  required?: boolean;
  values?: string[];
  min?: number;
  max?: number;
}

interface CliModelModeSpec {
  name?: string;
  scenario?: string;
  flags?: CliModelModeFlagSpec[];
  references?: { min?: number; max?: number };
}

interface CliModelSpec {
  type?: string;
  model?: string;
  displayName?: string;
  aliases?: string[];
  modes?: CliModelModeSpec[];
}

export class DreaminaMcpEngine {
  private readonly deps: DreaminaMcpEngineDeps;
  private readonly sessions = new Map<string, DreaminaMcpSession>();
  private config: PersistedDreaminaMcpConfig | null = null;
  private cachedCliPath: string | null = null;
  private cachedCliVersion: string | null = null;
  private cachedBalance: {
    fetchedAt: number;
    credits?: number;
    plan?: string;
    account?: string;
    rawText: string;
  } | null = null;
  private cliModelSchemasCache: {
    fetchedAt: number;
    itemsByModality: Record<'image' | 'video' | 'audio', CliModelSpec[]>;
  } | null = null;
  private readonly refUploadCache = new Map<string, string>();

  constructor(deps: DreaminaMcpEngineDeps) {
    this.deps = deps;
  }

  public getConfig(): PersistedDreaminaMcpConfig | null {
    return this.config ? { ...this.config } : null;
  }

  private getMediaDir(): string {
    return (
      this.deps.mediaDir ||
      process.env.DREAMFLOW_MEDIA_DIR ||
      path.join(os.homedir(), '.open-dreamflow', 'media')
    );
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
        userId: raw.userId,
        vipLevel: raw.vipLevel,
        availableCredits:
          typeof raw.availableCredits === 'number' && Number.isFinite(raw.availableCredits)
            ? raw.availableCredits
            : undefined,
        cliBinaryPath: raw.cliBinaryPath,
        cliVersion: raw.cliVersion,
        projectId: raw.projectId,
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

  /**
   * Startup reconciliation:
   *  - If host/override `dreamina-canvas` CLI is signed in (`DREAMFLOW_DISABLE_SYSTEM_DREAMINA_CLI !== '1'`
   *    or explicit `'cli_oauth'` persisted config), hydrates / upgrades to `'cli_oauth'` with real credits.
   *  - If persisted config is legacy `'browser'`, verifies Chrome extension or CDP `dreaminaLoggedIn` truth;
   *    unregisters stale false-positive configs so Dreamina never claims Connected while logged out.
   */
  public async verifyAndHydrateStartup(): Promise<void> {
    this.hydrateOnStartup();
    const disableSystemCli = process.env.DREAMFLOW_DISABLE_SYSTEM_DREAMINA_CLI === '1';
    const hasBinaryOverride = Boolean(process.env.DREAMFLOW_DREAMINA_BINARY_PATH?.trim());

    try {
      if (!disableSystemCli || (hasBinaryOverride && this.config?.mode === 'cli_oauth')) {
        const cliAuth = await this.probeCliAuth();
        if (cliAuth.loggedIn) {
          const now = new Date().toISOString();
          const creditsLabel =
            cliAuth.availableCredits !== undefined
              ? ` · ${cliAuth.availableCredits.toLocaleString('en-US')} credits`
              : '';
          const tierLabel = cliAuth.vipLevel ? ` (${cliAuth.vipLevel}${creditsLabel})` : '';
          const accountLabel = `${cliAuth.displayName || 'Dreamina'}${tierLabel}`;
          const nextCfg: PersistedDreaminaMcpConfig = {
            ...(this.config || { connectedAt: now }),
            connected: true,
            mode: 'cli_oauth',
            account: accountLabel,
            userId: cliAuth.userId,
            vipLevel: cliAuth.vipLevel,
            availableCredits: cliAuth.availableCredits,
            cliBinaryPath: cliAuth.cliBinaryPath,
            cliVersion: cliAuth.cliVersion,
            connectedAt: this.config?.connectedAt || now,
            updatedAt: now,
          };
          this.config = nextCfg;
          this.writeConfigToDisk(nextCfg);
          this.registerVirtualServer();
          this.cachedBalance = {
            fetchedAt: Date.now(),
            credits: cliAuth.availableCredits,
            plan: cliAuth.vipLevel || 'dreamina',
            account: cliAuth.displayName || accountLabel,
            rawText:
              cliAuth.availableCredits !== undefined
                ? `Credits: ${cliAuth.availableCredits}${cliAuth.vipLevel ? ` | Plan: ${cliAuth.vipLevel}` : ''}`
                : `Plan: ${cliAuth.vipLevel || 'dreamina'}`,
          };
          return;
        }
      }
    } catch {
      // Fall through to browser verification check
    }

    if (this.config?.mode === 'browser') {
      const probe = await this.deps.checkBrowserStatus();
      const honestlyLoggedIn =
        probe.extensionTabActive || (probe.cdpDreaminaOpen && Boolean(probe.cdpDreaminaLoggedIn));
      if (!honestlyLoggedIn) {
        this.config = null;
        this.clearConfigFromDisk();
        this.deps.externalMcpHost.unregisterVirtualServer(DREAMINA_MCP_SERVER_ID);
      }
    } else if (this.config?.mode === 'cli_oauth') {
      // Persisted CLI config exists, but auth status reported logged out (e.g. expired or cleared)
      this.config = null;
      this.clearConfigFromDisk();
      this.deps.externalMcpHost.unregisterVirtualServer(DREAMINA_MCP_SERVER_ID);
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
      cfg.mode === 'cli_oauth'
        ? 'Dreamina CLI OAuth'
        : cfg.mode === 'ark_api_key'
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
      name: 'Dreamina MCP (CLI Engine · Seedream & Seedance)',
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

  /**
   * Resolves / provisions the official CapCut `dreamina-canvas` >= 1.3.0 binary.
   * Priority:
   *  1. `DREAMFLOW_DREAMINA_BINARY_PATH` (explicit test/user override)
   *  2. Highest semver across `~/.open-dreamflow/bin`, `~/.local/bin`, `/opt/homebrew/bin`, `/usr/local/bin`
   *  3. Copy verified staged `1.3.0` binary into `~/.open-dreamflow/bin/dreamina-canvas` (`0o755`)
   *  4. Official CapCut installer script fallback (`install.sh`)
   */
  public async ensureDreaminaCliBinary(): Promise<{ binaryPath: string; version: string }> {
    const envOverride = process.env.DREAMFLOW_DREAMINA_BINARY_PATH?.trim();
    if (envOverride) {
      if (!fs.existsSync(envOverride)) {
        throw new Error(`DREAMFLOW_DREAMINA_BINARY_PATH does not exist: ${envOverride}`);
      }
      if (this.cachedCliPath === envOverride && this.cachedCliVersion) {
        return { binaryPath: envOverride, version: this.cachedCliVersion };
      }
      const ver = await this.probeCliVersion(envOverride);
      this.cachedCliPath = envOverride;
      this.cachedCliVersion = ver;
      return { binaryPath: envOverride, version: ver };
    }

    if (
      this.cachedCliPath &&
      this.cachedCliVersion &&
      fs.existsSync(this.cachedCliPath) &&
      compareSemver(this.cachedCliVersion, DREAMINA_MIN_CLI_VERSION) >= 0
    ) {
      return { binaryPath: this.cachedCliPath, version: this.cachedCliVersion };
    }

    const managedDir = path.join(os.homedir(), '.open-dreamflow', 'bin');
    const managedPath = path.join(managedDir, 'dreamina-canvas');
    const candidates = [
      managedPath,
      path.join(os.homedir(), '.local', 'bin', 'dreamina-canvas'),
      '/opt/homebrew/bin/dreamina-canvas',
      '/usr/local/bin/dreamina-canvas',
    ];

    let bestPath = '';
    let bestVersion = '0.0.0';
    for (const candidate of candidates) {
      try {
        if (!fs.existsSync(candidate)) continue;
        const ver = await this.probeCliVersion(candidate);
        if (ver && compareSemver(ver, bestVersion) > 0) {
          bestVersion = ver;
          bestPath = candidate;
        }
      } catch {
        // Ignore broken candidate
      }
    }

    if (bestPath && compareSemver(bestVersion, DREAMINA_MIN_CLI_VERSION) >= 0) {
      this.cachedCliPath = bestPath;
      this.cachedCliVersion = bestVersion;
      return { binaryPath: bestPath, version: bestVersion };
    }

    // Upgrade or install into ~/.open-dreamflow/bin/dreamina-canvas from verified staged 1.3.0 binary
    if (fs.existsSync(STAGED_DREAMINA_CLI_PATH)) {
      fs.mkdirSync(managedDir, { recursive: true, mode: 0o755 });
      const tmp = `${managedPath}.${process.pid}.${Date.now()}.tmp`;
      fs.copyFileSync(STAGED_DREAMINA_CLI_PATH, tmp);
      fs.chmodSync(tmp, 0o755);
      fs.renameSync(tmp, managedPath);
      fs.chmodSync(managedPath, 0o755);
      const ver = await this.probeCliVersion(managedPath);
      this.cachedCliPath = managedPath;
      this.cachedCliVersion = ver;
      return { binaryPath: managedPath, version: ver };
    }

    // Official installer fallback
    fs.mkdirSync(managedDir, { recursive: true, mode: 0o755 });
    const skillDir = path.join(os.homedir(), '.open-dreamflow', 'skills');
    fs.mkdirSync(skillDir, { recursive: true, mode: 0o755 });
    await execFileAsync(
      '/bin/bash',
      ['-lc', `curl -fsSL ${DREAMINA_CLI_INSTALL_SCRIPT_URL} | bash -s`],
      {
        timeout: 60_000,
        env: {
          ...process.env,
          DREAMINA_CANVAS_INSTALL_DIR: managedDir,
          DREAMINA_CANVAS_SKILL_DIR: skillDir,
        },
      }
    );

    if (!fs.existsSync(managedPath)) {
      throw new Error(
        `Failed to provision dreamina-canvas CLI at ${managedPath}. Install from https://dreamina.capcut.com/canvas-cli.`
      );
    }
    fs.chmodSync(managedPath, 0o755);
    const ver = await this.probeCliVersion(managedPath);
    this.cachedCliPath = managedPath;
    this.cachedCliVersion = ver;
    return { binaryPath: managedPath, version: ver };
  }

  private async probeCliVersion(binaryPath: string): Promise<string> {
    try {
      const { stdout } = await execFileAsync(
        binaryPath,
        ['--format', 'json', '--non-interactive', 'version'],
        { timeout: 8_000 }
      );
      const parsed = parseCliJsonOutput(stdout);
      const data = (parsed.data || {}) as Record<string, unknown>;
      const rawVer = String(data.version || '').trim();
      return rawVer || '1.0.0';
    } catch {
      const { stdout } = await execFileAsync(binaryPath, ['version'], { timeout: 8_000 });
      const match = /([0-9]+\.[0-9]+\.[0-9]+)/.exec(String(stdout || ''));
      return match ? match[1] : '1.0.0';
    }
  }

  private async runCliJson(
    args: string[],
    options: { timeoutMs?: number; binaryPath?: string } = {}
  ): Promise<Record<string, unknown>> {
    const binaryPath = options.binaryPath || (await this.ensureDreaminaCliBinary()).binaryPath;
    const fullArgs = ['--format', 'json', '--non-interactive', ...args];
    let stdout = '';
    let stderr = '';
    try {
      const res = await execFileAsync(binaryPath, fullArgs, {
        timeout: options.timeoutMs ?? 60_000,
        maxBuffer: 16 * 1024 * 1024,
      });
      stdout = res.stdout;
      stderr = res.stderr;
    } catch (err) {
      const e = err as { stdout?: string; stderr?: string; message?: string };
      stdout = String(e.stdout || '');
      stderr = String(e.stderr || '');
      if (stdout.trim()) {
        try {
          const parsedErr = parseCliJsonOutput(stdout);
          const errObj = (parsedErr.error || {}) as Record<string, unknown>;
          const msg =
            (typeof errObj.message === 'string' && errObj.message) ||
            (typeof parsedErr.message === 'string' && parsedErr.message) ||
            stderr.trim() ||
            e.message ||
            'dreamina-canvas CLI command failed.';
          throw new Error(msg);
        } catch (parseFail) {
          if (parseFail instanceof Error && parseFail !== err) {
            throw parseFail;
          }
        }
      }
      throw new Error(stderr.trim() || e.message || 'dreamina-canvas CLI execution failed.');
    }

    const parsed = parseCliJsonOutput(stdout);
    if (parsed.ok === false) {
      const errObj = (parsed.error || {}) as Record<string, unknown>;
      const msg =
        (typeof errObj.message === 'string' && errObj.message) ||
        (typeof parsed.message === 'string' && parsed.message) ||
        stderr.trim() ||
        'dreamina-canvas CLI reported an error.';
      throw new Error(msg);
    }
    return parsed;
  }

  public async probeCliAuth(): Promise<DreaminaCliAuthProbe> {
    const { binaryPath, version } = await this.ensureDreaminaCliBinary();
    const statusRes = await this.runCliJson(['auth', 'status'], {
      binaryPath,
      timeoutMs: 12_000,
    });
    const statusData = (statusRes.data || {}) as Record<string, unknown>;
    const loggedIn = Boolean(statusData.loggedIn);

    if (!loggedIn) {
      return {
        cliBinaryPath: binaryPath,
        cliVersion: version,
        loggedIn: false,
        expiresAt: typeof statusData.expiresAt === 'string' ? statusData.expiresAt : undefined,
      };
    }

    let accountData: Record<string, unknown> = {};
    try {
      const accRes = await this.runCliJson(['auth', 'account'], {
        binaryPath,
        timeoutMs: 12_000,
      });
      accountData = (accRes.data || {}) as Record<string, unknown>;
    } catch {
      // Account fetch optional if status succeeded
    }

    const rawCredits =
      accountData.availableCredits ?? accountData.credits ?? accountData.balance;
    let availableCredits: number | undefined;
    if (typeof rawCredits === 'number' && Number.isFinite(rawCredits)) {
      availableCredits = rawCredits;
    } else if (typeof rawCredits === 'string' && rawCredits.trim()) {
      const n = Number(rawCredits.replace(/,/g, '').trim());
      if (Number.isFinite(n)) availableCredits = n;
    }

    return {
      cliBinaryPath: binaryPath,
      cliVersion: version,
      loggedIn: true,
      displayName:
        typeof accountData.displayName === 'string' && accountData.displayName.trim()
          ? accountData.displayName.trim()
          : 'Dreamina User',
      userId: accountData.userId !== undefined ? String(accountData.userId) : undefined,
      availableCredits,
      isVip: typeof accountData.isVip === 'boolean' ? accountData.isVip : undefined,
      vipLevel:
        typeof accountData.vipLevel === 'string' && accountData.vipLevel.trim()
          ? accountData.vipLevel.trim()
          : undefined,
      expiresAt: typeof statusData.expiresAt === 'string' ? statusData.expiresAt : undefined,
    };
  }

  public async getBalanceInfo(forceRefresh = false): Promise<{
    credits?: number;
    plan?: string;
    account?: string;
    rawText: string;
  } | null> {
    const now = Date.now();
    if (!forceRefresh && this.cachedBalance && now - this.cachedBalance.fetchedAt < 25_000) {
      return {
        credits: this.cachedBalance.credits,
        plan: this.cachedBalance.plan,
        account: this.cachedBalance.account,
        rawText: this.cachedBalance.rawText,
      };
    }

    if (this.config?.mode === 'cli_oauth') {
      try {
        const auth = await this.probeCliAuth();
        if (auth.loggedIn) {
          const credits = auth.availableCredits;
          const plan = auth.vipLevel || (auth.isVip ? 'vip' : 'dreamina');
          const account = auth.displayName || this.config.account;
          const rawText = `${credits !== undefined ? `Credits: ${credits}` : ''}${
            credits !== undefined && plan ? ' | ' : ''
          }${plan ? `Plan: ${plan}` : ''}`.trim();
          this.cachedBalance = { fetchedAt: now, credits, plan, account, rawText };
          if (this.config) {
            const creditsLabel =
              credits !== undefined ? ` · ${credits.toLocaleString('en-US')} credits` : '';
            this.config.availableCredits = credits;
            this.config.vipLevel = plan;
            this.config.account = `${auth.displayName || 'Dreamina'}${plan ? ` (${plan}${creditsLabel})` : ''}`;
            this.config.updatedAt = new Date().toISOString();
          }
          return { credits, plan, account, rawText };
        }
      } catch {
        // Fallback to cached below
      }
    }

    if (this.cachedBalance) {
      return {
        credits: this.cachedBalance.credits,
        plan: this.cachedBalance.plan,
        account: this.cachedBalance.account,
        rawText: this.cachedBalance.rawText,
      };
    }

    if (this.config?.availableCredits !== undefined || this.config?.vipLevel) {
      return {
        credits: this.config.availableCredits,
        plan: this.config.vipLevel || this.config.mode,
        account: this.config.account,
        rawText:
          this.config.availableCredits !== undefined
            ? `Credits: ${this.config.availableCredits} | Plan: ${this.config.vipLevel || 'dreamina'}`
            : `Plan: ${this.config.vipLevel || this.config.mode}`,
      };
    }

    return null;
  }

  public async connect(params: {
    mode?: string;
    force?: boolean;
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
          : rawMode === 'browser' || rawMode === 'browser-bridge'
            ? 'browser'
            : 'cli_oauth';

    const now = new Date().toISOString();
    const sessionId = `drm_mcp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const session: DreaminaMcpSession = {
      sessionId,
      platformId: 'dreamina',
      serverId: DREAMINA_MCP_SERVER_ID,
      serverName: 'Dreamina MCP (CLI Engine · Seedream & Seedance)',
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
      const arkEndpoint =
        typeof params.arkEndpoint === 'string' ? params.arkEndpoint.trim() : undefined;
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

    if (mode === 'browser') {
      session.step = 'verifying';
      session.updatedAt = new Date().toISOString();
      this.emitSessionUpdate(session);

      const probe = await this.deps.checkBrowserStatus();
      const honestlyLoggedIn =
        probe.extensionTabActive || (probe.cdpDreaminaOpen && Boolean(probe.cdpDreaminaLoggedIn));
      if (honestlyLoggedIn) {
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

    // Mode: 'cli_oauth' (Official `dreamina-canvas` 1.3.0 CLI Engine)
    session.step = 'verifying';
    session.updatedAt = new Date().toISOString();
    this.emitSessionUpdate(session);

    try {
      const { binaryPath, version } = await this.ensureDreaminaCliBinary();
      session.cliVersion = version;

      if (!params.force) {
        const existingAuth = await this.probeCliAuth();
        if (existingAuth.loggedIn) {
          return await this.finalizeCliConnectedSession(session, existingAuth, now);
        }
      }

      const loginArgs = ['auth', 'login', ...(params.force ? ['--force'] : [])];
      const loginRes = await this.runCliJson(loginArgs, { binaryPath, timeoutMs: 20_000 });
      const loginData = (loginRes.data || {}) as Record<string, unknown>;
      const loginStatus = String(loginData.status || '').toLowerCase();

      if (loginStatus === 'logged_in') {
        const freshAuth = await this.probeCliAuth();
        return await this.finalizeCliConnectedSession(session, freshAuth, now);
      }

      const challenge =
        typeof loginData.challenge === 'object' && loginData.challenge !== null
          ? (loginData.challenge as Record<string, unknown>)
          : {};
      const deviceCode = String(
        challenge.deviceCode || loginData.deviceCode || ''
      ).trim();
      const userCode = String(challenge.userCode || loginData.userCode || '').trim();
      const verificationUri = String(
        challenge.verificationUriComplete ||
          challenge.verificationUri ||
          loginData.verificationUriComplete ||
          loginData.verificationUri ||
          DREAMINA_STUDIO_URL
      ).trim();

      session.authorizeUrl = verificationUri || DREAMINA_STUDIO_URL;
      if (userCode) session.userCode = userCode;
      session.step = 'awaiting_login';
      session.updatedAt = new Date().toISOString();
      this.emitSessionUpdate(session);

      // Wait asynchronously for user to authorize device code in browser
      void (async () => {
        try {
          const waitArgs = [
            'auth',
            'wait',
            ...(deviceCode ? ['--device-code', deviceCode] : []),
            '--timeout',
            '5m',
          ];
          const waitRes = await this.runCliJson(waitArgs, {
            binaryPath,
            timeoutMs: 315_000,
          });
          const waitData = (waitRes.data || {}) as Record<string, unknown>;
          const waitStatus = String(waitData.status || '').toLowerCase();
          if (waitStatus === 'logged_in' || waitRes.ok === true) {
            const verifiedAuth = await this.probeCliAuth();
            if (verifiedAuth.loggedIn) {
              await this.finalizeCliConnectedSession(session, verifiedAuth, new Date().toISOString());
              return;
            }
          }
          session.step = 'error';
          session.error = 'Dreamina device authorization did not complete.';
          session.updatedAt = new Date().toISOString();
          this.emitSessionUpdate(session);
        } catch (waitErr) {
          session.step = 'error';
          session.error = waitErr instanceof Error ? waitErr.message : String(waitErr);
          session.updatedAt = new Date().toISOString();
          this.emitSessionUpdate(session);
        }
      })();

      return { ...session };
    } catch (err) {
      session.step = 'error';
      session.error = err instanceof Error ? err.message : String(err);
      session.updatedAt = new Date().toISOString();
      this.emitSessionUpdate(session);
      return { ...session };
    }
  }

  private async finalizeCliConnectedSession(
    session: DreaminaMcpSession,
    auth: DreaminaCliAuthProbe,
    connectedAtIso: string
  ): Promise<DreaminaMcpSession> {
    const creditsLabel =
      auth.availableCredits !== undefined
        ? ` · ${auth.availableCredits.toLocaleString('en-US')} credits`
        : '';
    const tierLabel = auth.vipLevel ? ` (${auth.vipLevel}${creditsLabel})` : '';
    const accountLabel = `${auth.displayName || 'Dreamina'}${tierLabel}`;

    const cfg: PersistedDreaminaMcpConfig = {
      connected: true,
      mode: 'cli_oauth',
      account: accountLabel,
      userId: auth.userId,
      vipLevel: auth.vipLevel,
      availableCredits: auth.availableCredits,
      cliBinaryPath: auth.cliBinaryPath,
      cliVersion: auth.cliVersion,
      projectId: this.config?.projectId,
      connectedAt: this.config?.connectedAt || connectedAtIso,
      updatedAt: connectedAtIso,
    };
    this.config = cfg;
    this.writeConfigToDisk(cfg);
    this.registerVirtualServer();
    this.cachedBalance = {
      fetchedAt: Date.now(),
      credits: auth.availableCredits,
      plan: auth.vipLevel || 'dreamina',
      account: auth.displayName || accountLabel,
      rawText:
        auth.availableCredits !== undefined
          ? `Credits: ${auth.availableCredits}${auth.vipLevel ? ` | Plan: ${auth.vipLevel}` : ''}`
          : `Plan: ${auth.vipLevel || 'dreamina'}`,
    };

    session.step = 'connected';
    session.account = this.buildAccountInfo(cfg);
    session.balance = {
      ...(auth.availableCredits !== undefined ? { credits: auth.availableCredits } : {}),
      ...(auth.vipLevel ? { plan: auth.vipLevel } : {}),
      ...(auth.displayName ? { account: auth.displayName } : {}),
      rawText: this.cachedBalance.rawText,
    };
    session.tools = DREAMINA_TOOLS.map((t) => ({ name: t.name, description: t.description }));
    session.availableCredits = auth.availableCredits;
    session.vipLevel = auth.vipLevel;
    session.cliVersion = auth.cliVersion;
    session.projectId = cfg.projectId;
    session.toolsCount = DREAMINA_TOOLS.length;
    session.updatedAt = new Date().toISOString();
    this.emitSessionUpdate(session);
    return { ...session };
  }

  public async getSessionStatus(sessionId: string): Promise<DreaminaMcpSession | null> {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    if (session.mode === 'browser' && session.step === 'awaiting_user') {
      const probe = await this.deps.checkBrowserStatus();
      const honestlyLoggedIn =
        probe.extensionTabActive || (probe.cdpDreaminaOpen && Boolean(probe.cdpDreaminaLoggedIn));
      if (honestlyLoggedIn) {
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
    const wasConnected =
      Boolean(this.config?.connected) ||
      this.deps.externalMcpHost.listServers().some((s) => s.id === DREAMINA_MCP_SERVER_ID);
    this.config = null;
    this.cachedBalance = null;
    this.refUploadCache.clear();
    this.clearConfigFromDisk();
    this.deps.externalMcpHost.unregisterVirtualServer(DREAMINA_MCP_SERVER_ID);
    return { ok: true, disconnected: wasConnected };
  }

  public async getModelsCatalog(modality = 'all'): Promise<Array<Record<string, unknown>>> {
    const sdk = await this.deps.loadProviderSdk();
    const models = (Array.isArray(sdk.DREAMINA_CANONICAL_MODELS)
      ? sdk.DREAMINA_CANONICAL_MODELS
      : []) as Array<Record<string, unknown>>;
    if (modality === 'image' || modality === 'video' || modality === 'audio') {
      return models.filter((m) => String(m.modality || '') === modality);
    }
    return models;
  }

  private async ensureWorkspaceProjectId(): Promise<string> {
    if (this.config?.projectId && /^[0-9a-f-]{8,}$/i.test(this.config.projectId)) {
      return this.config.projectId;
    }

    try {
      const lsRes = await this.runCliJson(['canvas', 'ls', '--limit', '50'], {
        timeoutMs: 20_000,
      });
      const lsData = (lsRes.data || {}) as Record<string, unknown>;
      const items = (Array.isArray(lsData.items)
        ? lsData.items
        : Array.isArray(lsData.canvases)
          ? lsData.canvases
          : []) as Array<Record<string, unknown>>;
      const existing = items.find(
        (c) => String(c.name || '').trim() === DREAMINA_WORKSPACE_NAME && typeof c.projectId === 'string'
      );
      if (existing && typeof existing.projectId === 'string' && existing.projectId.trim()) {
        const pid = existing.projectId.trim();
        if (this.config) {
          this.config.projectId = pid;
          this.config.updatedAt = new Date().toISOString();
          this.writeConfigToDisk(this.config);
        }
        return pid;
      }
    } catch {
      // Fallback to creating a workspace canvas
    }

    const clientProjectId = crypto.randomUUID();
    const createRes = await this.runCliJson(
      ['canvas', 'create', DREAMINA_WORKSPACE_NAME, '--project-id', clientProjectId],
      { timeoutMs: 20_000 }
    );
    const createData = (createRes.data || {}) as Record<string, unknown>;
    const projectId =
      String(createData.projectId || (createData.canvas as Record<string, unknown> | undefined)?.projectId || clientProjectId).trim();

    if (this.config) {
      this.config.projectId = projectId;
      this.config.updatedAt = new Date().toISOString();
      this.writeConfigToDisk(this.config);
    }
    return projectId;
  }

  private async getLiveCliModels(modality: 'image' | 'video' | 'audio'): Promise<CliModelSpec[]> {
    const now = Date.now();
    if (this.cliModelSchemasCache && now - this.cliModelSchemasCache.fetchedAt < 10 * 60_000) {
      return this.cliModelSchemasCache.itemsByModality[modality] || [];
    }

    try {
      const [imgRes, vidRes, audRes] = await Promise.all([
        this.runCliJson(['model', 'list', '--type', 'image'], { timeoutMs: 15_000 }),
        this.runCliJson(['model', 'list', '--type', 'video'], { timeoutMs: 15_000 }),
        this.runCliJson(['model', 'list', '--type', 'audio'], { timeoutMs: 15_000 }),
      ]);
      const itemsByModality: Record<'image' | 'video' | 'audio', CliModelSpec[]> = {
        image: Array.isArray((imgRes.data as Record<string, unknown> | undefined)?.items)
          ? ((imgRes.data as Record<string, unknown>).items as CliModelSpec[])
          : [],
        video: Array.isArray((vidRes.data as Record<string, unknown> | undefined)?.items)
          ? ((vidRes.data as Record<string, unknown>).items as CliModelSpec[])
          : [],
        audio: Array.isArray((audRes.data as Record<string, unknown> | undefined)?.items)
          ? ((audRes.data as Record<string, unknown>).items as CliModelSpec[])
          : [],
      };
      this.cliModelSchemasCache = { fetchedAt: now, itemsByModality };
      return itemsByModality[modality] || [];
    } catch {
      return [];
    }
  }

  private coerceFlagValue(
    modelSpec: CliModelSpec | undefined,
    modeName: string,
    flagName: string,
    rawValue: string | undefined
  ): string | undefined {
    if (!rawValue) return undefined;
    if (!modelSpec?.modes) return rawValue;
    const modeSpec =
      modelSpec.modes.find((m) => m.name === modeName) || modelSpec.modes[0];
    const flagSpec = modeSpec?.flags?.find((f) => f.flag === flagName);
    if (!flagSpec?.values || flagSpec.values.length === 0) return rawValue;
    const exact = flagSpec.values.find((v) => v === rawValue);
    if (exact) return exact;
    const ci = flagSpec.values.find((v) => v.toLowerCase() === rawValue.toLowerCase());
    if (ci) return ci;
    if (flagName === '--resolution') {
      return flagSpec.values[0];
    }
    return rawValue;
  }

  private async uploadReferenceToDreamina(
    projectId: string,
    source: string,
    mediaType: 'image' | 'video' | 'audio'
  ): Promise<string> {
    const trimmed = String(source || '').trim();
    if (!trimmed) {
      throw new Error('Empty reference source cannot be uploaded to Dreamina.');
    }
    if (trimmed.startsWith('res:') || trimmed.startsWith('node:')) {
      return trimmed;
    }

    let localFilePath = '';
    let cleanupTmp = false;
    const mediaDir = this.getMediaDir();
    const defaultExt =
      mediaType === 'video' ? '.mp4' : mediaType === 'audio' ? '.mp3' : '.png';

    if (trimmed.startsWith('/media/')) {
      const rel = path.basename(trimmed.replace(/^\/media\//, ''));
      const candidate = path.join(mediaDir, rel);
      if (fs.existsSync(candidate)) {
        localFilePath = candidate;
      }
    } else if (/^https?:\/\//i.test(trimmed)) {
      const parsed = new URL(trimmed);
      if (
        (parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost') &&
        parsed.pathname.startsWith('/media/')
      ) {
        const rel = path.basename(parsed.pathname.replace(/^\/media\//, ''));
        const candidate = path.join(mediaDir, rel);
        if (fs.existsSync(candidate)) {
          localFilePath = candidate;
        }
      }
      if (!localFilePath) {
        const res = await fetch(trimmed, { signal: AbortSignal.timeout(45_000) });
        if (!res.ok) {
          throw new Error(`Failed to fetch reference URL (${res.status}): ${trimmed}`);
        }
        const buf = Buffer.from(await res.arrayBuffer());
        const ext = path.extname(parsed.pathname) || defaultExt;
        localFilePath = path.join(
          os.tmpdir(),
          `drm_ref_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`
        );
        fs.writeFileSync(localFilePath, buf);
        cleanupTmp = true;
      }
    } else if (trimmed.startsWith('data:')) {
      const match = /^data:([^;]+);base64,(.+)$/i.exec(trimmed);
      if (!match) {
        throw new Error('Unsupported data URL format for Dreamina reference upload.');
      }
      const mime = match[1].toLowerCase();
      const ext = mime.includes('jpeg')
        ? '.jpg'
        : mime.includes('webp')
          ? '.webp'
          : mime.includes('mp4')
            ? '.mp4'
            : mime.includes('wav')
              ? '.wav'
              : mime.includes('mpeg')
                ? '.mp3'
                : defaultExt;
      localFilePath = path.join(
        os.tmpdir(),
        `drm_ref_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`
      );
      fs.writeFileSync(localFilePath, Buffer.from(match[2], 'base64'));
      cleanupTmp = true;
    } else if (fs.existsSync(trimmed)) {
      localFilePath = trimmed;
    } else {
      throw new Error(`Reference file not found for Dreamina upload: ${trimmed}`);
    }

    try {
      const bytes = fs.readFileSync(localFilePath);
      const sha = crypto.createHash('sha256').update(bytes).digest('hex');
      const cacheKey = `${projectId}:${mediaType}:${sha}`;
      const cached = this.refUploadCache.get(cacheKey);
      if (cached) {
        return `res:${cached}`;
      }

      const uploadRes = await this.runCliJson(
        [
          'resource',
          'upload',
          '--project-id',
          projectId,
          '--file',
          localFilePath,
          '--type',
          mediaType,
        ],
        { timeoutMs: 90_000 }
      );
      const data = (uploadRes.data || {}) as Record<string, unknown>;
      const resourceId = String(
        data.resourceId ||
          (data.resource as Record<string, unknown> | undefined)?.resourceId ||
          data.id ||
          ''
      ).trim();
      if (!resourceId) {
        throw new Error('dreamina-canvas resource upload succeeded without returning a resourceId.');
      }
      this.refUploadCache.set(cacheKey, resourceId);
      return `res:${resourceId}`;
    } finally {
      if (cleanupTmp && localFilePath && fs.existsSync(localFilePath)) {
        try {
          fs.unlinkSync(localFilePath);
        } catch {
          // Ignore tmp cleanup error
        }
      }
    }
  }

  private async downloadResourceToMediaDir(
    projectId: string,
    resourceId: string,
    modality: 'image' | 'video' | 'audio'
  ): Promise<string> {
    const mediaDir = this.getMediaDir();
    fs.mkdirSync(mediaDir, { recursive: true, mode: 0o755 });

    const tmpOutDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dreamina_dl_'));
    const fallbackExt =
      modality === 'video' ? '.mp4' : modality === 'audio' ? '.mp3' : '.png';

    try {
      const dlRes = await this.runCliJson(
        [
          'resource',
          'download',
          resourceId,
          '--project-id',
          projectId,
          '-o',
          tmpOutDir,
        ],
        { timeoutMs: 120_000 }
      );
      const dlData = (dlRes.data || {}) as Record<string, unknown>;
      let downloadedPath =
        typeof dlData.path === 'string' && fs.existsSync(dlData.path)
          ? dlData.path
          : typeof dlData.filePath === 'string' && fs.existsSync(dlData.filePath)
            ? dlData.filePath
            : '';

      if (!downloadedPath) {
        const files = fs
          .readdirSync(tmpOutDir)
          .map((name) => path.join(tmpOutDir, name))
          .filter((p) => fs.statSync(p).isFile());
        if (files.length > 0) {
          downloadedPath = files[0];
        }
      }

      if (!downloadedPath || !fs.existsSync(downloadedPath)) {
        throw new Error(`dreamina-canvas resource download did not produce a file for ${resourceId}.`);
      }

      const detectedExt = path.extname(downloadedPath) || fallbackExt;
      const fileName = `dreamina_mcp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${detectedExt}`;
      const finalPath = path.join(mediaDir, fileName);
      fs.copyFileSync(downloadedPath, finalPath);
      fs.chmodSync(finalPath, 0o644);
      return `/media/${fileName}`;
    } finally {
      try {
        fs.rmSync(tmpOutDir, { recursive: true, force: true });
      } catch {
        // Ignore temp dir cleanup error
      }
    }
  }

  private async executeCliNodePipeline(params: {
    modality: 'image' | 'video' | 'audio';
    createArgs: string[];
    waitTimeoutMs: number;
    maxOutputs: number;
  }): Promise<{
    projectId: string;
    nodeId: string;
    submitId: string;
    estimatedCredits?: number;
    outputs: string[];
  }> {
    const projectId = await this.ensureWorkspaceProjectId();

    // 1. node create
    const createRes = await this.runCliJson(
      ['node', 'create', params.modality, '--project-id', projectId, ...params.createArgs],
      { timeoutMs: 45_000 }
    );
    const createData = (createRes.data || {}) as Record<string, unknown>;
    const nodeId = String(
      createData.nodeId ||
        (createData.node as Record<string, unknown> | undefined)?.nodeId ||
        (createData.node as Record<string, unknown> | undefined)?.id ||
        ''
    ).trim();
    if (!nodeId) {
      throw new Error(`dreamina-canvas node create ${params.modality} returned no nodeId.`);
    }

    // 2. node quote
    const quoteRes = await this.runCliJson(
      ['node', 'quote', '--project-id', projectId, '--node-id', nodeId],
      { timeoutMs: 30_000 }
    );
    const quoteData = (quoteRes.data || {}) as Record<string, unknown>;
    const quoteItems = Array.isArray(quoteData.items)
      ? (quoteData.items as Array<Record<string, unknown>>)
      : [];
    const firstQuote = quoteItems[0] || {};
    const rawEst =
      quoteData.totalCredit ??
      quoteData.estimatedCredits ??
      quoteData.creditCost ??
      quoteData.credits ??
      firstQuote.totalCredit ??
      firstQuote.estimatedCredits ??
      firstQuote.creditCost ??
      firstQuote.credits;
    const parsedEst = Number(rawEst);
    const estimatedCredits = Number.isFinite(parsedEst) ? Math.max(0, Math.ceil(parsedEst)) : 500;
    const creditCeiling = Math.max(estimatedCredits, 1);

    // 3. node confirm
    const confirmRes = await this.runCliJson(
      [
        'node',
        'confirm',
        '--project-id',
        projectId,
        '--node-id',
        nodeId,
        '--credit-ceiling',
        String(creditCeiling),
      ],
      { timeoutMs: 30_000 }
    );
    const confirmData = (confirmRes.data || {}) as Record<string, unknown>;
    const confirmItems = Array.isArray(confirmData.items)
      ? (confirmData.items as Array<Record<string, unknown>>)
      : [];
    const creditToken = String(
      confirmData.creditConfirmationToken ||
        confirmData.creditToken ||
        confirmData.token ||
        confirmItems[0]?.creditConfirmationToken ||
        confirmItems[0]?.creditToken ||
        quoteData.creditConfirmationToken ||
        ''
    ).trim();

    // 4. node run
    const clientSubmitId = crypto.randomUUID();
    const runArgs = [
      'node',
      'run',
      '--project-id',
      projectId,
      '--node-id',
      nodeId,
      '--submit-id',
      clientSubmitId,
      ...(creditToken ? ['--credit-token', creditToken] : []),
    ];
    const runRes = await this.runCliJson(runArgs, { timeoutMs: 30_000 });
    const runData = (runRes.data || {}) as Record<string, unknown>;
    const runItems = Array.isArray(runData.items)
      ? (runData.items as Array<Record<string, unknown>>)
      : [];
    const submitId = String(
      runData.submitId || runItems[0]?.submitId || clientSubmitId
    ).trim();

    // 5. operation wait
    const waitSec = Math.max(60, Math.ceil(params.waitTimeoutMs / 1000));
    await this.runCliJson(
      [
        'operation',
        'wait',
        submitId,
        '--project-id',
        projectId,
        '--interval',
        '3s',
        '--timeout',
        `${waitSec}s`,
      ],
      { timeoutMs: params.waitTimeoutMs + 15_000 }
    );

    // 6. node show + resource download
    const showRes = await this.runCliJson(
      ['node', 'show', '--project-id', projectId, '--node-id', nodeId],
      { timeoutMs: 30_000 }
    );
    const resourceIds: string[] = [];
    const directUrls: string[] = [];
    collectResourceIdsAndUrls(showRes.data || showRes, resourceIds, directUrls);

    const uniqueIds = Array.from(new Set(resourceIds)).slice(0, params.maxOutputs);
    const outputs: string[] = [];
    for (const rid of uniqueIds) {
      const localUrl = await this.downloadResourceToMediaDir(
        projectId,
        rid,
        params.modality
      );
      outputs.push(localUrl);
    }

    if (outputs.length === 0 && directUrls.length > 0) {
      for (const remoteUrl of directUrls.slice(0, params.maxOutputs)) {
        const res = await fetch(remoteUrl, { signal: AbortSignal.timeout(45_000) });
        if (!res.ok) continue;
        const buf = Buffer.from(await res.arrayBuffer());
        const ext =
          params.modality === 'video'
            ? '.mp4'
            : params.modality === 'audio'
              ? '.mp3'
              : '.png';
        const fileName = `dreamina_mcp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`;
        const mediaDir = this.getMediaDir();
        fs.mkdirSync(mediaDir, { recursive: true, mode: 0o755 });
        const finalPath = path.join(mediaDir, fileName);
        fs.writeFileSync(finalPath, buf);
        fs.chmodSync(finalPath, 0o644);
        outputs.push(`/media/${fileName}`);
      }
    }

    if (outputs.length === 0) {
      throw new Error(
        `Dreamina CLI operation ${submitId} finished but node show returned no downloadable resourceIds.`
      );
    }

    this.cachedBalance = null;
    void this.getBalanceInfo(true);

    return {
      projectId,
      nodeId,
      submitId,
      estimatedCredits,
      outputs,
    };
  }

  private async executeToolCall(
    toolName: string,
    args: Record<string, unknown>,
    timeoutMs?: number
  ): Promise<Record<string, unknown>> {
    const sdk = await this.deps.loadProviderSdk();
    const normalizeModel =
      typeof sdk.normalizeDreaminaModelId === 'function'
        ? (sdk.normalizeDreaminaModelId as (
            raw?: string,
            modality?: 'image' | 'video' | 'audio'
          ) => string)
        : (raw?: string) => String(raw || '').trim() || 'seedream_5_5';
    const mapToCliModel =
      typeof sdk.mapCanonicalDreaminaToCliModel === 'function'
        ? (sdk.mapCanonicalDreaminaToCliModel as (
            raw?: string,
            modality?: 'image' | 'video' | 'audio'
          ) => string)
        : defaultCliModelForCanonical;

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
      const [probe, balance] = await Promise.all([
        this.deps.checkBrowserStatus(),
        this.getBalanceInfo(toolName === 'balance'),
      ]);
      const mode = this.config?.mode || 'cli_oauth';
      const hasApiKey = Boolean(
        this.config?.arkApiKey || process.env.ARK_API_KEY || process.env.SEEDANCE_API_KEY
      );
      const browserHonestlyLoggedIn =
        probe.extensionTabActive || (probe.cdpDreaminaOpen && Boolean(probe.cdpDreaminaLoggedIn));
      const payload = {
        ok: true,
        connected: Boolean(this.config?.connected || browserHonestlyLoggedIn || hasApiKey),
        mode,
        account: balance?.account || this.config?.account || 'Dreamina MCP',
        credits: balance?.credits,
        balance: balance?.credits,
        availableCredits: balance?.credits,
        plan:
          balance?.plan ||
          this.config?.vipLevel ||
          (mode === 'ark_api_key' ? 'BytePlus ModelArk' : 'Dreamina Subscription'),
        vipLevel: this.config?.vipLevel,
        projectId: this.config?.projectId,
        cliVersion: this.config?.cliVersion,
        browserExtensionActive: probe.extensionTabActive,
        cdpDreaminaOpen: probe.cdpDreaminaOpen,
        cdpDreaminaLoggedIn: Boolean(probe.cdpDreaminaLoggedIn),
        hasArkApiKey: hasApiKey,
        hasSessionCookie: Boolean(this.config?.sessionIdCookie),
      };
      return {
        structuredContent: payload,
        content: [
          {
            type: 'text',
            text: balance?.rawText || JSON.stringify(payload),
          },
        ],
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
        Math.min(8, Math.round(Number(args.batch_count ?? args.count ?? args.n ?? 1) || 1))
      );
      const aspectRatio = String(args.aspect_ratio || '16:9').trim();
      const resolution = String(args.resolution || '2K').trim();
      const refImages = Array.isArray(args.reference_images)
        ? (args.reference_images as unknown[]).filter(
            (x): x is string => typeof x === 'string' && x.trim().length > 0
          )
        : [];
      const seed =
        typeof args.seed === 'number' && Number.isFinite(args.seed)
          ? Math.round(args.seed)
          : undefined;

      // Primary Path 1: Official `dreamina-canvas` 1.3.0 CLI Engine (`cli_oauth`)
      if (this.config?.mode === 'cli_oauth') {
        const projectId = await this.ensureWorkspaceProjectId();
        const cliModel = mapToCliModel(canonicalModel, 'image');
        const liveSpecs = await this.getLiveCliModels('image');
        const spec = liveSpecs.find(
          (m) =>
            m.model === cliModel ||
            m.model?.replace(/\./g, '_') === canonicalModel
        );
        const resolvedCliModel = spec?.model || cliModel;
        const modeName = refImages.length > 0 ? 'i2i' : 't2i';
        const coercedRatio =
          this.coerceFlagValue(spec, modeName, '--ratio', aspectRatio) || aspectRatio;
        const coercedRes =
          this.coerceFlagValue(spec, modeName, '--resolution', resolution) || resolution;
        const modeSpec = spec?.modes?.find((m) => m.name === modeName);
        const maxCount = modeSpec?.flags?.find((f) => f.flag === '--count')?.max ?? 8;
        const clampedCount = Math.max(1, Math.min(maxCount, batchCount));

        const uploadedRefs: string[] = [];
        for (const refSrc of refImages) {
          uploadedRefs.push(await this.uploadReferenceToDreamina(projectId, refSrc, 'image'));
        }

        const createArgs = [
          '--mode',
          modeName,
          '--model',
          resolvedCliModel,
          '--prompt',
          prompt,
          '--ratio',
          coercedRatio,
          '--resolution',
          coercedRes,
          '--count',
          String(clampedCount),
          '--title',
          prompt.slice(0, 64),
          ...uploadedRefs.flatMap((r) => ['--ref', r]),
        ];

        const pipeOut = await this.executeCliNodePipeline({
          modality: 'image',
          createArgs,
          waitTimeoutMs: Math.max(Number(timeoutMs) || 0, 180_000),
          maxOutputs: clampedCount,
        });

        // If user asked for batch > CLI model per-call limit (e.g. GPT Image Flare max 1), run remainder cleanly
        const allOutputs = [...pipeOut.outputs];
        if (allOutputs.length < batchCount) {
          const extraCalls = await Promise.all(
            Array.from({ length: batchCount - allOutputs.length }, () =>
              this.executeCliNodePipeline({
                modality: 'image',
                createArgs: createArgs.map((v, idx, arr) =>
                  arr[idx - 1] === '--count' ? '1' : v
                ),
                waitTimeoutMs: Math.max(Number(timeoutMs) || 0, 180_000),
                maxOutputs: 1,
              })
            )
          );
          for (const extra of extraCalls) {
            allOutputs.push(...extra.outputs);
          }
        }

        const finalOutputs = allOutputs.slice(0, batchCount);
        const payload = {
          ok: true,
          status: 'completed',
          model: canonicalModel,
          cliModel: resolvedCliModel,
          nodeId: pipeOut.nodeId,
          submitId: pipeOut.submitId,
          imageUrl: finalOutputs[0],
          images: finalOutputs.map((url) => ({ url })),
        };
        return {
          structuredContent: payload,
          content: [{ type: 'text', text: JSON.stringify(payload) }],
        };
      }

      // Path 2: BytePlus ModelArk API Key (`ark_api_key`)
      const effectiveArkKey = String(
        this.config?.arkApiKey || process.env.ARK_API_KEY || process.env.SEEDANCE_API_KEY || ''
      ).trim();

      if (this.config?.mode === 'ark_api_key' || effectiveArkKey) {
        const SeedanceClientCtor = sdk.SeedanceClient as new (cfg: {
          apiKey: string;
          baseUrl?: string;
        }) => {
          generateImage: (req: Record<string, unknown>) => Promise<{
            model: string;
            imageUrl?: string;
            imageBase64?: string;
            imageUrls?: string[];
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
        const rawList =
          Array.isArray(firstOut.imageUrls) && firstOut.imageUrls.length > 0
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

      // Path 3: Browser Credit Bridge fallback (honestly logged in)
      const probe = await this.deps.checkBrowserStatus();
      const browserHonestlyLoggedIn =
        probe.extensionTabActive || (probe.cdpDreaminaOpen && Boolean(probe.cdpDreaminaLoggedIn));
      if (this.config?.mode === 'browser' && browserHonestlyLoggedIn) {
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
          claimTimeoutMs: 35_000,
          timeoutMs: timeoutMs || 180_000,
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
            text: 'Dreamina MCP is not connected. Click Connect Dreamina OAuth in Connections · Credits.',
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
      const resolution = String(args.resolution || '720p').trim();
      const durationSec = Math.max(4, Math.min(30, Math.round(Number(args.duration ?? 5) || 5)));
      const generateAudio = typeof args.generate_audio === 'boolean' ? args.generate_audio : true;
      const rawFrameMode = String(args.reference_frame_mode || '').trim().toLowerCase();
      const startImageUrl =
        typeof args.start_image_url === 'string' && args.start_image_url.trim()
          ? args.start_image_url.trim()
          : undefined;
      const endImageUrl =
        typeof args.end_image_url === 'string' && args.end_image_url.trim()
          ? args.end_image_url.trim()
          : undefined;
      const refImages = Array.isArray(args.reference_images)
        ? (args.reference_images as unknown[]).filter(
            (x): x is string => typeof x === 'string' && x.trim().length > 0
          )
        : [];
      const videoRefs = Array.isArray(args.video_references)
        ? (args.video_references as unknown[]).filter(
            (x): x is string => typeof x === 'string' && x.trim().length > 0
          )
        : [];
      const audioRefs = Array.isArray(args.audio_references)
        ? (args.audio_references as unknown[]).filter(
            (x): x is string => typeof x === 'string' && x.trim().length > 0
          )
        : [];
      const seed =
        typeof args.seed === 'number' && Number.isFinite(args.seed)
          ? Math.round(args.seed)
          : undefined;

      // Primary Path 1: Official `dreamina-canvas` 1.3.0 CLI Engine (`cli_oauth`)
      if (this.config?.mode === 'cli_oauth') {
        const projectId = await this.ensureWorkspaceProjectId();
        const cliModel = mapToCliModel(canonicalModel, 'video');
        const liveSpecs = await this.getLiveCliModels('video');
        const spec = liveSpecs.find(
          (m) =>
            m.model === cliModel ||
            m.model?.replace(/\./g, '_') === canonicalModel
        );
        const resolvedCliModel = spec?.model || cliModel;

        const orderedImgSources = [
          startImageUrl,
          ...refImages.filter((r) => r !== startImageUrl && r !== endImageUrl),
          endImageUrl,
        ].filter((x): x is string => Boolean(x));

        const uploadedImgRefs: string[] = [];
        for (const src of orderedImgSources) {
          uploadedImgRefs.push(await this.uploadReferenceToDreamina(projectId, src, 'image'));
        }
        const uploadedVidRefs: string[] = [];
        for (const src of videoRefs) {
          uploadedVidRefs.push(await this.uploadReferenceToDreamina(projectId, src, 'video'));
        }
        const uploadedAudRefs: string[] = [];
        for (const src of audioRefs) {
          uploadedAudRefs.push(await this.uploadReferenceToDreamina(projectId, src, 'audio'));
        }

        const requestedMode = String(args.mode || '').trim().toLowerCase();
        const totalMediaCount =
          uploadedImgRefs.length + uploadedVidRefs.length + uploadedAudRefs.length;

        let cliVideoMode: 't2v' | 'first_last_frame' | 'm2v' = 't2v';
        if (requestedMode === 't2v' || requestedMode === 'first_last_frame' || requestedMode === 'm2v') {
          cliVideoMode = requestedMode;
        } else if (
          uploadedVidRefs.length > 0 ||
          uploadedAudRefs.length > 0 ||
          rawFrameMode === 'multi-ref' ||
          uploadedImgRefs.length > 2
        ) {
          cliVideoMode = totalMediaCount > 0 ? 'm2v' : 't2v';
        } else if (
          rawFrameMode === 'start-end' ||
          startImageUrl ||
          endImageUrl ||
          uploadedImgRefs.length === 1 ||
          uploadedImgRefs.length === 2
        ) {
          const supportsFirstLast =
            !spec?.modes || spec.modes.some((m) => m.name === 'first_last_frame');
          cliVideoMode = supportsFirstLast ? 'first_last_frame' : 'm2v';
        }

        const allRefs =
          cliVideoMode === 'first_last_frame'
            ? uploadedImgRefs.slice(0, 2)
            : [...uploadedImgRefs, ...uploadedVidRefs, ...uploadedAudRefs];

        const coercedRatio =
          this.coerceFlagValue(spec, cliVideoMode, '--ratio', aspectRatio) || aspectRatio;
        const coercedRes =
          this.coerceFlagValue(spec, cliVideoMode, '--resolution', resolution) || resolution;
        const modeSpec = spec?.modes?.find((m) => m.name === cliVideoMode);
        const durFlag = modeSpec?.flags?.find((f) => f.flag === '--duration');
        let clampedDuration = durationSec;
        if (durFlag?.values && durFlag.values.length > 0) {
          const allowed = durFlag.values.map((v) => Number(v)).filter((n) => Number.isFinite(n));
          if (allowed.length > 0 && !allowed.includes(clampedDuration)) {
            clampedDuration = allowed.reduce((prev, cur) =>
              Math.abs(cur - clampedDuration) < Math.abs(prev - clampedDuration) ? cur : prev
            );
          }
        } else if (typeof durFlag?.min === 'number' || typeof durFlag?.max === 'number') {
          const minD = durFlag.min ?? 4;
          const maxD = durFlag.max ?? 30;
          clampedDuration = Math.max(minD, Math.min(maxD, clampedDuration));
        }

        const createArgs = [
          '--mode',
          cliVideoMode,
          '--model',
          resolvedCliModel,
          '--prompt',
          prompt,
          '--ratio',
          coercedRatio,
          '--resolution',
          coercedRes,
          '--duration',
          String(clampedDuration),
          '--count',
          '1',
          '--title',
          prompt.slice(0, 64),
          ...allRefs.flatMap((r) => ['--ref', r]),
        ];

        const pipeOut = await this.executeCliNodePipeline({
          modality: 'video',
          createArgs,
          waitTimeoutMs: Math.max(Number(timeoutMs) || 0, 360_000),
          maxOutputs: 1,
        });

        const payload = {
          ok: true,
          status: 'completed',
          model: canonicalModel,
          cliModel: resolvedCliModel,
          modeUsed: cliVideoMode,
          nodeId: pipeOut.nodeId,
          submitId: pipeOut.submitId,
          videoUrl: pipeOut.outputs[0],
          outputs: pipeOut.outputs,
        };
        return {
          structuredContent: payload,
          content: [{ type: 'text', text: JSON.stringify(payload) }],
        };
      }

      // Path 2: BytePlus ModelArk API Key (`ark_api_key`)
      const effectiveArkKey = String(
        this.config?.arkApiKey || process.env.ARK_API_KEY || process.env.SEEDANCE_API_KEY || ''
      ).trim();

      if (this.config?.mode === 'ark_api_key' || effectiveArkKey) {
        const SeedanceClientCtor = sdk.SeedanceClient as new (cfg: {
          apiKey: string;
          baseUrl?: string;
        }) => {
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

      // Path 3: Browser Credit Bridge fallback
      const probe = await this.deps.checkBrowserStatus();
      const browserHonestlyLoggedIn =
        probe.extensionTabActive || (probe.cdpDreaminaOpen && Boolean(probe.cdpDreaminaLoggedIn));
      if (this.config?.mode === 'browser' && browserHonestlyLoggedIn) {
        const allRefs = [startImageUrl, ...refImages, endImageUrl].filter((x): x is string =>
          Boolean(x)
        );
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
          claimTimeoutMs: 35_000,
          timeoutMs: timeoutMs || 360_000,
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
            text: 'Dreamina MCP is not connected. Click Connect Dreamina OAuth in Connections · Credits.',
          },
        ],
      };
    }

    if (toolName === 'dreamina_generate_audio') {
      const prompt = String(args.prompt || '').trim();
      if (!prompt) {
        return {
          isError: true,
          content: [{ type: 'text', text: 'dreamina_generate_audio requires a non-empty prompt.' }],
        };
      }
      if (this.config?.mode !== 'cli_oauth') {
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: 'dreamina_generate_audio requires Dreamina CLI OAuth (`cli_oauth`) connection.',
            },
          ],
        };
      }

      const canonicalModel = normalizeModel(
        typeof args.model === 'string' ? args.model : 'seed_audio_v1',
        'audio'
      );
      const cliModel = mapToCliModel(canonicalModel, 'audio');
      const mode = String(args.mode || 'tts').trim().toLowerCase() === 'music' ? 'music' : 'tts';
      const scenario = String(args.scenario || 'text-reading').trim();
      const voiceName = typeof args.voice_name === 'string' ? args.voice_name.trim() : '';
      const voiceId = typeof args.voice_id === 'string' ? args.voice_id.trim() : '';
      const durationSec = Number(args.duration);

      const projectId = await this.ensureWorkspaceProjectId();
      const refImages = Array.isArray(args.reference_images)
        ? (args.reference_images as unknown[]).filter(
            (x): x is string => typeof x === 'string' && x.trim().length > 0
          )
        : [];
      const audioRefs = Array.isArray(args.audio_references)
        ? (args.audio_references as unknown[]).filter(
            (x): x is string => typeof x === 'string' && x.trim().length > 0
          )
        : [];

      const uploadedRefs: string[] = [];
      for (const s of refImages) {
        uploadedRefs.push(await this.uploadReferenceToDreamina(projectId, s, 'image'));
      }
      for (const s of audioRefs) {
        uploadedRefs.push(await this.uploadReferenceToDreamina(projectId, s, 'audio'));
      }

      const createArgs = [
        '--mode',
        mode,
        '--model',
        cliModel,
        '--prompt',
        prompt,
        ...(mode === 'tts' && scenario ? ['--scenario', scenario] : []),
        ...(voiceId ? ['--voice-id', voiceId] : voiceName ? ['--voice-name', voiceName] : []),
        ...(mode === 'music' && Number.isFinite(durationSec) && durationSec > 0
          ? ['--duration', String(Math.round(durationSec))]
          : []),
        '--title',
        prompt.slice(0, 64),
        ...uploadedRefs.flatMap((r) => ['--ref', r]),
      ];

      const pipeOut = await this.executeCliNodePipeline({
        modality: 'audio',
        createArgs,
        waitTimeoutMs: Math.max(Number(timeoutMs) || 0, 180_000),
        maxOutputs: 1,
      });

      const payload = {
        ok: true,
        status: 'completed',
        model: canonicalModel,
        cliModel,
        nodeId: pipeOut.nodeId,
        submitId: pipeOut.submitId,
        audioUrl: pipeOut.outputs[0],
        outputs: pipeOut.outputs,
      };
      return {
        structuredContent: payload,
        content: [{ type: 'text', text: JSON.stringify(payload) }],
      };
    }

    return {
      isError: true,
      content: [{ type: 'text', text: `Unknown Dreamina MCP tool: ${toolName}` }],
    };
  }
}
