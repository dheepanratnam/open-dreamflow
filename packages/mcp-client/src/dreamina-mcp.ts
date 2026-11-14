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
import { AsyncLocalStorage } from 'node:async_hooks';
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
  profile?: string;
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

export interface DreaminaCreditBucket {
  credits: number;
  expiresAt: string;
  daysRemaining: number;
}

export interface DreaminaFullCreditSummary {
  loggedIn: boolean;
  profile: string;
  credits?: number;
  vipLevel?: string;
  vipLevelExpiresAt?: string;
  tokenExpiresAt?: string;
  account?: string;
  buckets: DreaminaCreditBucket[];
}

export interface DreaminaCloudAssetItem {
  id: string;
  title: string;
  kind: 'image' | 'video' | 'audio';
  url: string;
  thumbnailUrl?: string;
  resourceId: string;
  projectId: string;
  createdAt: string;
  prompt?: string;
  model?: string;
  creditsAmount?: number;
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
  vipLevelExpiresAt?: string;
  expiresAt?: string;
  creditBuckets?: DreaminaCreditBucket[];
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
  // 1. Account & CLI Introspection (4)
  {
    name: 'balance',
    description: 'Check live Dreamina account credits and VIP tier.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'dreamina_session_status',
    description:
      'Inspect current Dreamina MCP connection mode, CLI auth state, live credits, workspace projectId, and browser/API credentials.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'dreamina_auth_refresh',
    description: 'Refresh active Dreamina OAuth session credentials via `dreamina-canvas auth refresh`.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'dreamina_cli_schema',
    description: 'Inspect the live machine-readable `dreamina-canvas` CLI command & version schema.',
    inputSchema: {
      type: 'object',
      properties: {
        subcommand: { type: 'string', description: 'Optional subcommand filter.' },
      },
    },
  },

  // 2. Models & Voices (4)
  {
    name: 'dreamina_models_explore',
    description:
      'List all 34+ Dreamina Seedream, Nano Banana, GPT Image, Seedance, Veo, Wan, HappyHorse, OmniHuman, and SeedAudio models merged with live CLI schemas.',
    inputSchema: {
      type: 'object',
      properties: {
        modality: {
          type: 'string',
          enum: ['all', 'image', 'video', 'audio'],
          description: 'Optional modality filter.',
        },
        refresh: {
          type: 'boolean',
          description: 'Force refresh live model list from dreamina-canvas CLI.',
        },
      },
    },
  },
  {
    name: 'dreamina_model_info',
    description: 'Get full mode, aspect ratio, resolution, duration, and flag schema for a specific Dreamina model via `dreamina-canvas model <name>`.',
    inputSchema: {
      type: 'object',
      required: ['model'],
      properties: {
        model: { type: 'string', description: 'Canonical or CLI model ID/name.' },
        modality: { type: 'string', enum: ['image', 'video', 'audio'] },
      },
    },
  },
  {
    name: 'dreamina_model_find',
    description: 'Search Dreamina models by keyword via `dreamina-canvas model find <query>`.',
    inputSchema: {
      type: 'object',
      required: ['query'],
      properties: {
        query: { type: 'string', description: 'Model keyword such as seedance, veo, wan, or seedream.' },
        modality: { type: 'string', enum: ['image', 'video', 'audio'] },
      },
    },
  },
  {
    name: 'dreamina_voices_list',
    description: 'List official Dreamina TTS / omni-dubbing voices via `dreamina-canvas voice list`.',
    inputSchema: {
      type: 'object',
      properties: {
        offset: { type: 'number', description: 'Pagination offset (default 0).' },
        count: { type: 'number', description: 'Max voices to return (default 50).' },
        model: { type: 'string', description: 'Optional audio model ID (e.g. seed_audio_v1).' },
      },
    },
  },

  // 3. One-Shot Generation (3)
  {
    name: 'dreamina_generate_image',
    description:
      'Generate 1-8 images using Dreamina Seedream (5.5, 5.0 Pro/Lite, 4.7-4.0), Nano Banana 2.1/Pro, or GPT Image 2.5.',
    inputSchema: {
      type: 'object',
      required: ['prompt'],
      properties: {
        prompt: { type: 'string', description: 'Detailed image prompt.' },
        model: { type: 'string', description: 'Image model ID (e.g. seedream_5_5, jm_image_model_gg_bp_21).' },
        aspect_ratio: { type: 'string', description: 'Aspect ratio (16:9, 9:16, 1:1, 4:3, 3:4, 21:9).' },
        resolution: { type: 'string', description: 'Target resolution (1K, 1.5K, 2K, 4K).' },
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
      'Generate video using Dreamina Seedance (2.5 / 2.5 Flash / 2.5 Draft / 2.0 / 2.0 Fast / 2.0 Mini / Pro Fast / 1.5 Pro / 1.0 Lite / Motion Imitation), Veo 3.1/3.1 Fast/3.1 Lite/3.0, Wan 3.0/2.6/2.5, HappyHorse 1.1, Gemini Omni 1.1 Flash, or OmniHuman 1.5.',
    inputSchema: {
      type: 'object',
      required: ['prompt'],
      properties: {
        prompt: { type: 'string', description: 'Detailed motion & scene prompt.' },
        model: { type: 'string', description: 'Video model ID (e.g. seedance_2_5, veo_3_1, wan_3_0).' },
        mode: { type: 'string', enum: ['t2v', 'first_last_frame', 'm2v'], description: 'Optional generation mode override.' },
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
      'Generate speech or omni-dubbing / music audio using Dreamina SeedAudio 1.0 (`seed_audio_v1`) or `legacy_tts`.',
    inputSchema: {
      type: 'object',
      required: ['prompt'],
      properties: {
        prompt: { type: 'string', description: 'TTS script or audio generation prompt.' },
        model: { type: 'string', description: 'Audio model ID (seed_audio_v1, legacy_tts).' },
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

  // 4. Cloud Post-Editing & Enhancement (5)
  {
    name: 'dreamina_upscale_image',
    description: 'Upscale an image node or URL to 2K/4K/8K on Dreamina cloud (`node upscale image`).',
    inputSchema: {
      type: 'object',
      properties: {
        node_id: { type: 'string', description: 'Existing Dreamina image node ID.' },
        image_url: { type: 'string', description: 'Local /media/ path, HTTP URL, or data URL to upload & upscale if node_id is omitted.' },
        project_id: { type: 'string' },
        mode: { type: 'string', enum: ['normal', 'pro'], description: 'Upscale mode (default normal).' },
        resolution: { type: 'string', enum: ['2K', '4K', '8K'], description: 'Target output resolution (default 4K).' },
        detail: { type: 'number', description: 'Detail preservation level (1-100).' },
        credit_ceiling: { type: 'number', description: 'Max credits allowed (default 500).' },
        wait: { type: 'boolean', description: 'Wait for completion and download to /media/ (default true).' },
        submit_id: { type: 'string' },
      },
    },
  },
  {
    name: 'dreamina_upscale_video',
    description: 'Upscale a video node or URL to higher resolution (`node upscale video`).',
    inputSchema: {
      type: 'object',
      properties: {
        node_id: { type: 'string', description: 'Existing Dreamina video node ID.' },
        video_url: { type: 'string', description: 'Local /media/ path or HTTP URL to upload & upscale if node_id is omitted.' },
        project_id: { type: 'string' },
        resolution: { type: 'string', description: 'Target resolution (e.g. 1080p, 4K).' },
        credit_ceiling: { type: 'number' },
        wait: { type: 'boolean', description: 'Wait for completion and download to /media/ (default true).' },
        submit_id: { type: 'string' },
      },
    },
  },
  {
    name: 'dreamina_cutout_image',
    description: 'Remove background / extract foreground cutout from an image node or URL (`node cutout image`).',
    inputSchema: {
      type: 'object',
      properties: {
        node_id: { type: 'string', description: 'Existing Dreamina image node ID.' },
        image_url: { type: 'string', description: 'Local /media/ path, HTTP URL, or data URL if node_id is omitted.' },
        project_id: { type: 'string' },
        credit_ceiling: { type: 'number' },
        wait: { type: 'boolean', description: 'Wait for completion and download to /media/ (default true).' },
        submit_id: { type: 'string' },
      },
    },
  },
  {
    name: 'dreamina_interpolate_video',
    description: 'Frame-interpolate a video node or URL to 30fps or 60fps (`node interpolate video`).',
    inputSchema: {
      type: 'object',
      properties: {
        node_id: { type: 'string', description: 'Existing Dreamina video node ID.' },
        video_url: { type: 'string', description: 'Local /media/ path or HTTP URL if node_id is omitted.' },
        project_id: { type: 'string' },
        fps: { type: 'number', description: 'Target frame rate (30 or 60, default 60).' },
        credit_ceiling: { type: 'number' },
        wait: { type: 'boolean', description: 'Wait for completion and download to /media/ (default true).' },
        submit_id: { type: 'string' },
      },
    },
  },
  {
    name: 'dreamina_promote_video_sample',
    description: 'Promote a video preview sample to higher resolution (`node promote video-sample`).',
    inputSchema: {
      type: 'object',
      properties: {
        node_id: { type: 'string', description: 'Existing Dreamina video node ID.' },
        video_url: { type: 'string', description: 'Local /media/ path or HTTP URL if node_id is omitted.' },
        project_id: { type: 'string' },
        resolution: { type: 'string', description: 'Target resolution (e.g. 1080p, 4K).' },
        credit_ceiling: { type: 'number' },
        wait: { type: 'boolean', description: 'Wait for completion and download to /media/ (default true).' },
        submit_id: { type: 'string' },
      },
    },
  },

  // 5. Canvas Project Management (4)
  {
    name: 'dreamina_canvas_list',
    description: 'List Dreamina cloud canvas projects (`canvas ls`).',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number' },
        cursor: { type: 'string' },
      },
    },
  },
  {
    name: 'dreamina_canvas_current',
    description: 'Get currently active Dreamina workspace canvas (`canvas current`).',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'dreamina_canvas_use',
    description: 'Switch active Dreamina canvas workspace (`canvas use <project-id>`).',
    inputSchema: {
      type: 'object',
      required: ['project_id'],
      properties: {
        project_id: { type: 'string' },
      },
    },
  },
  {
    name: 'dreamina_canvas_create',
    description: 'Create a new Dreamina cloud canvas project (`canvas create`).',
    inputSchema: {
      type: 'object',
      required: ['name'],
      properties: {
        name: { type: 'string' },
        project_id: { type: 'string' },
        use: { type: 'boolean', description: 'Set new canvas as active workspace.' },
      },
    },
  },

  // 6. Typed Node Graph CRUD & Quoting (9)
  {
    name: 'dreamina_node_create',
    description: 'Create a typed Dreamina canvas node: image, video, audio, element, text, or timeline.',
    inputSchema: {
      type: 'object',
      required: ['type'],
      properties: {
        type: { type: 'string', enum: ['image', 'video', 'audio', 'element', 'text', 'timeline'] },
        project_id: { type: 'string' },
        node_id: { type: 'string' },
        title: { type: 'string' },
        prompt: { type: 'string' },
        mode: { type: 'string' },
        model: { type: 'string' },
        ratio: { type: 'string' },
        resolution: { type: 'string' },
        duration: { type: 'number' },
        count: { type: 'number' },
        refs: { type: 'array', items: { type: 'string' } },
        resource_id: { type: 'string' },
        import_kind: { type: 'string' },
        scenario: { type: 'string' },
        voice_id: { type: 'string' },
        voice_name: { type: 'string' },
        text: { type: 'string' },
        description: { type: 'string' },
        main: { type: 'string' },
        voice: { type: 'string' },
        auxiliary: { type: 'array', items: { type: 'string' } },
        clips: { type: 'array', items: { type: 'string' } },
        audio_clips: { type: 'array', items: { type: 'string' } },
        run: { type: 'boolean' },
        wait: { type: 'boolean' },
        credit_ceiling: { type: 'number' },
      },
    },
  },
  {
    name: 'dreamina_node_edit',
    description: 'Edit an existing typed Dreamina canvas node (`node edit <type>`).',
    inputSchema: {
      type: 'object',
      required: ['type', 'node_id'],
      properties: {
        type: { type: 'string', enum: ['image', 'video', 'audio', 'element', 'text', 'timeline'] },
        node_id: { type: 'string' },
        project_id: { type: 'string' },
        title: { type: 'string' },
        prompt: { type: 'string' },
        mode: { type: 'string' },
        model: { type: 'string' },
        ratio: { type: 'string' },
        resolution: { type: 'string' },
        duration: { type: 'number' },
        count: { type: 'number' },
        refs: { type: 'array', items: { type: 'string' } },
        text: { type: 'string' },
        description: { type: 'string' },
        main: { type: 'string' },
        voice: { type: 'string' },
        auxiliary: { type: 'array', items: { type: 'string' } },
        clips: { type: 'array', items: { type: 'string' } },
        audio_clips: { type: 'array', items: { type: 'string' } },
        clear_generation: { type: 'boolean' },
        run: { type: 'boolean' },
        wait: { type: 'boolean' },
        credit_ceiling: { type: 'number' },
      },
    },
  },
  {
    name: 'dreamina_node_find',
    description: 'Find nodes on a Dreamina canvas project (`node find`).',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: { type: 'string' },
        name: { type: 'string' },
        types: { type: 'array', items: { type: 'string' } },
        statuses: { type: 'array', items: { type: 'string' } },
        tags: { type: 'array', items: { type: 'string' } },
        limit: { type: 'number' },
        offset: { type: 'number' },
      },
    },
  },
  {
    name: 'dreamina_node_show',
    description: 'Inspect one or more Dreamina canvas nodes (`node show`).',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: { type: 'string' },
        node_id: { type: 'string' },
        node_ids: { type: 'array', items: { type: 'string' } },
      },
    },
  },
  {
    name: 'dreamina_node_quote',
    description: 'Estimate credit cost for one or more Dreamina canvas nodes (`node quote`).',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: { type: 'string' },
        node_id: { type: 'string' },
        node_ids: { type: 'array', items: { type: 'string' } },
      },
    },
  },
  {
    name: 'dreamina_node_confirm',
    description: 'Confirm credit spend ceiling for Dreamina canvas nodes (`node confirm`).',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: { type: 'string' },
        node_id: { type: 'string' },
        node_ids: { type: 'array', items: { type: 'string' } },
        credit_ceiling: { type: 'number', description: 'Credit ceiling integer (default 500).' },
      },
    },
  },
  {
    name: 'dreamina_node_run',
    description: 'Submit/run one or more Dreamina canvas nodes (`node run`).',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: { type: 'string' },
        node_id: { type: 'string' },
        node_ids: { type: 'array', items: { type: 'string' } },
        submit_id: { type: 'string' },
        credit_token: { type: 'string' },
        wait: { type: 'boolean' },
      },
    },
  },
  {
    name: 'dreamina_node_delete_confirm',
    description: 'Delete one or more Dreamina canvas nodes (`node delete confirm`).',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: { type: 'string' },
        node_id: { type: 'string' },
        node_ids: { type: 'array', items: { type: 'string' } },
        update_id: { type: 'string' },
      },
    },
  },
  {
    name: 'dreamina_node_delete_status',
    description: 'Check deletion status for Dreamina canvas nodes (`node delete status`).',
    inputSchema: {
      type: 'object',
      required: ['update_id'],
      properties: {
        project_id: { type: 'string' },
        node_id: { type: 'string' },
        node_ids: { type: 'array', items: { type: 'string' } },
        update_id: { type: 'string' },
      },
    },
  },

  // 7. Resources & Operations (5)
  {
    name: 'dreamina_resource_upload',
    description: 'Upload a local file or remote URL to Dreamina workspace resources (`resource upload`).',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: { type: 'string' },
        file: { type: 'string' },
        source_url: { type: 'string' },
        type: { type: 'string', enum: ['image', 'video', 'audio'] },
        name: { type: 'string' },
        import_kind: { type: 'string', enum: ['local_upload', 'external_generated'] },
        resource_id: { type: 'string' },
      },
    },
  },
  {
    name: 'dreamina_resource_get',
    description: 'Get metadata for a Dreamina resource (`resource get`).',
    inputSchema: {
      type: 'object',
      required: ['resource_id'],
      properties: {
        resource_id: { type: 'string' },
        project_id: { type: 'string' },
      },
    },
  },
  {
    name: 'dreamina_resource_download',
    description: 'Download a Dreamina resource to /media/dreamina_mcp_* with 0644 permissions (`resource download`).',
    inputSchema: {
      type: 'object',
      required: ['resource_id'],
      properties: {
        resource_id: { type: 'string' },
        project_id: { type: 'string' },
        modality: { type: 'string', enum: ['image', 'video', 'audio'] },
      },
    },
  },
  {
    name: 'dreamina_operation_status',
    description: 'Check status of an async Dreamina operation (`operation status <submit-id>`).',
    inputSchema: {
      type: 'object',
      required: ['submit_id'],
      properties: {
        submit_id: { type: 'string' },
        project_id: { type: 'string' },
      },
    },
  },
  {
    name: 'dreamina_operation_wait',
    description: 'Wait for completion of a Dreamina operation (`operation wait <submit-id>`).',
    inputSchema: {
      type: 'object',
      required: ['submit_id'],
      properties: {
        submit_id: { type: 'string' },
        project_id: { type: 'string' },
        interval: { type: 'string', description: 'Poll interval e.g. 3s.' },
        timeout: { type: 'string', description: 'Max wait e.g. 300s.' },
      },
    },
  },

  // 8. Workflows & Templates (6)
  {
    name: 'dreamina_workflow_capabilities',
    description: 'Query workflow capabilities on a Dreamina project (`workflow capabilities`).',
    inputSchema: {
      type: 'object',
      properties: { project_id: { type: 'string' } },
    },
  },
  {
    name: 'dreamina_workflow_list',
    description: 'List workflow runs on a Dreamina project (`workflow list`).',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: { type: 'string' },
        group_node_id: { type: 'string' },
        cursor: { type: 'string' },
        limit: { type: 'number' },
      },
    },
  },
  {
    name: 'dreamina_workflow_get',
    description: 'Get details of a Dreamina workflow run (`workflow get <run-id>`).',
    inputSchema: {
      type: 'object',
      required: ['run_id'],
      properties: { run_id: { type: 'string' } },
    },
  },
  {
    name: 'dreamina_workflow_quote_and_run',
    description: 'Quote, confirm, execute, and optionally wait for a Dreamina workflow (`workflow quote -> confirm -> run -> wait`).',
    inputSchema: {
      type: 'object',
      required: ['source'],
      properties: {
        project_id: { type: 'string' },
        source: { type: 'string' },
        run_kind: { type: 'string' },
        group_node_id: { type: 'string' },
        template_id: { type: 'string' },
        template_version: { type: 'number' },
        selected_combo_ids: { type: 'array', items: { type: 'string' } },
        selected_step_ids: { type: 'array', items: { type: 'string' } },
        from_node_ids: { type: 'array', items: { type: 'string' } },
        reuse_unchanged: { type: 'boolean' },
        max_credits: { type: 'number' },
        credit_ceiling: { type: 'number' },
        wait: { type: 'boolean' },
        submit_id: { type: 'string' },
      },
    },
  },
  {
    name: 'dreamina_workflow_cancel',
    description: 'Cancel a running Dreamina workflow (`workflow cancel <run-id>`).',
    inputSchema: {
      type: 'object',
      required: ['run_id'],
      properties: { run_id: { type: 'string' } },
    },
  },
  {
    name: 'dreamina_workflow_templates',
    description: 'List, get, instantiate, or check instantiation status of Dreamina workflow templates (`workflow template ...`).',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['list', 'get', 'instantiate', 'instantiation'], description: 'Default: list.' },
        scope: { type: 'string' },
        cursor: { type: 'string' },
        limit: { type: 'number' },
        template_id: { type: 'string' },
        version: { type: 'number' },
        target_project_id: { type: 'string' },
        anchor_x: { type: 'number' },
        anchor_y: { type: 'number' },
        variables: { type: 'object' },
        instantiate_id: { type: 'string' },
      },
    },
  },

  // 9. 3D Director Stage (4)
  {
    name: 'dreamina_director_catalog',
    description: 'Browse built-in 3D Director Stage presets, characters, and camera motion rigs (`director catalog`).',
    inputSchema: {
      type: 'object',
      properties: {
        kind: { type: 'string', enum: ['builtin', 'character', 'motion'] },
        motion_usage: { type: 'string', enum: ['direct', 'path-traversal'] },
        count: { type: 'number' },
        offset: { type: 'number' },
      },
    },
  },
  {
    name: 'dreamina_director_create',
    description: 'Create a 3D Director Stage node (`director create`).',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: { type: 'string' },
        title: { type: 'string' },
        file: { type: 'string' },
      },
    },
  },
  {
    name: 'dreamina_director_show',
    description: 'Inspect a 3D Director Stage scene (`director show`).',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: { type: 'string' },
        node_id: { type: 'string' },
        file: { type: 'string' },
      },
    },
  },
  {
    name: 'dreamina_director_apply',
    description: 'Apply camera/character/motion JSON updates to a 3D Director Stage node (`director apply`).',
    inputSchema: {
      type: 'object',
      required: ['input'],
      properties: {
        project_id: { type: 'string' },
        node_id: { type: 'string' },
        file: { type: 'string' },
        input: {
          description: 'JSON object or path to JSON input file for director apply.',
        },
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
  canonicalId?: string,
  modality: 'image' | 'video' | 'audio' = 'image'
): string {
  const map: Record<string, string> = {
    seedream_5_5: 'seedream_5.5',
    seedream_5_0_pro: 'seedream_5.0_pro',
    seedream_5_0_flash: 'seedream_5.0_lite',
    seedream_5_0_lite: 'seedream_5.0_lite',
    seedream_4_7: 'seedream_4.7',
    seedream_4_6: 'seedream_4.6',
    seedream_4_5: 'seedream_4.5',
    seedream_4_1: 'seedream_4.1',
    seedream_4_0: 'seedream_4.0',
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
    seedance_2_0_mini: 'seedance_2.0_mini',
    seedance_pro_fast: 'seedance_pro_fast',
    seedance_1_5_pro: 'seedance_2.0_fast',
    seedance_1_0_lite: 'seedance_1.0_lite',
    dreamina_motion_imitation: 'seedance_2.5',
    veo_3_1: 'veo_3.1',
    veo_3_1_fast: 'veo_3.1_fast',
    veo_3_1_lite: 'veo_3.1_lite',
    veo_3_0: 'veo_3.0',
    wan_3_0: 'wan_3.0',
    wan_2_6: 'wan_2.6',
    wan_2_5: 'wan_2.5',
    happyhorse_1_1: 'happyhorse_1.1',
    gemini_omni_1_1_flash: 'gemini_omni_1.1_flash',
    omnihuman_1_5: 'seedance_2.5',
    seed_audio_v1: 'seed_audio_v1',
    legacy_tts: 'legacy_tts',
  };
  if (canonicalId && map[canonicalId]) return map[canonicalId];
  if (modality === 'audio') return 'seed_audio_v1';
  if (modality === 'video') return 'seedance_2.5';
  return 'seedream_5.5';
}

function okToolResult(payload: Record<string, unknown>, textOverride?: string): Record<string, unknown> {
  return {
    structuredContent: payload,
    content: [{ type: 'text', text: textOverride || JSON.stringify(payload) }],
  };
}

function errToolResult(message: string): Record<string, unknown> {
  return {
    isError: true,
    content: [{ type: 'text', text: message }],
  };
}

function strArg(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function strArrayArg(value: unknown, fallbackSingle?: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((x): x is string => typeof x === 'string' && x.trim().length > 0).map((x) => x.trim());
  }
  if (typeof value === 'string' && value.trim()) {
    return [value.trim()];
  }
  const single = strArg(fallbackSingle);
  return single ? [single] : [];
}

function numArg(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value.trim());
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function inferProviderFamily(modelId: string): string {
  const lower = modelId.toLowerCase();
  if (lower.includes('veo') || lower.includes('gemini') || lower.includes('gg_bp')) return 'Google';
  if (lower.includes('gpt')) return 'OpenAI';
  if (lower.includes('wan')) return 'Wan';
  return 'ByteDance';
}

function extractCliFlagValues(spec: CliModelSpec, flagName: string): string[] {
  const values = new Set<string>();
  for (const mode of spec.modes || []) {
    for (const f of mode.flags || []) {
      if (f.flag === flagName && Array.isArray(f.values)) {
        for (const v of f.values) {
          if (typeof v === 'string' && v.trim()) values.add(v.trim());
        }
      }
    }
  }
  return Array.from(values);
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
  private readonly profileStorage = new AsyncLocalStorage<string>();
  private readonly profileConfigs = new Map<string, PersistedDreaminaMcpConfig>();
  private readonly profileBalances = new Map<
    string,
    {
      fetchedAt: number;
      credits?: number;
      plan?: string;
      account?: string;
      rawText: string;
      vipLevelExpiresAt?: string;
      tokenExpiresAt?: string;
      buckets: DreaminaCreditBucket[];
    }
  >();
  private readonly lastAutoRefreshByProfile = new Map<string, number>();
  private readonly recentAssetsCacheByProfile = new Map<
    string,
    { fetchedAt: number; items: DreaminaCloudAssetItem[] }
  >();
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
    binaryPath?: string;
    itemsByModality: Record<'image' | 'video' | 'audio', CliModelSpec[]>;
  } | null = null;
  private readonly refUploadCache = new Map<string, string>();

  constructor(deps: DreaminaMcpEngineDeps) {
    this.deps = deps;
  }

  public getConfig(): PersistedDreaminaMcpConfig | null {
    return this.config ? { ...this.config } : null;
  }

  public getProfileConfig(profile = 'default'): PersistedDreaminaMcpConfig | null {
    const p = profile.trim() || 'default';
    if (p === 'default') return this.config ? { ...this.config } : null;
    const found = this.profileConfigs.get(p);
    return found ? { ...found } : null;
  }

  public hasProfileConnected(profile = 'default'): boolean {
    const cfg = this.getProfileConfig(profile);
    return Boolean(cfg?.connected);
  }

  public async runWithProfile<T>(profile: string, fn: () => Promise<T>): Promise<T> {
    const clean = String(profile || 'default').trim() || 'default';
    return await this.profileStorage.run(clean, fn);
  }

  private getActiveProfile(explicitProfile?: string): string {
    return String(explicitProfile || this.profileStorage.getStore() || 'default').trim() || 'default';
  }

  private getActiveConfig(explicitProfile?: string): PersistedDreaminaMcpConfig | null {
    const p = this.getActiveProfile(explicitProfile);
    return p === 'default' ? this.config : this.profileConfigs.get(p) || null;
  }

  private setActiveConfig(
    cfg: PersistedDreaminaMcpConfig | null,
    explicitProfile?: string
  ): void {
    const p = this.getActiveProfile(explicitProfile);
    if (p === 'default') {
      this.config = cfg;
      if (cfg) this.writeConfigToDisk(cfg);
      else this.clearConfigFromDisk();
      return;
    }
    if (cfg) {
      this.profileConfigs.set(p, cfg);
    } else {
      this.profileConfigs.delete(p);
    }
    this.writeProfilesToDisk();
  }

  private resolveProfilesPath(): string {
    return path.join(path.dirname(resolveDreaminaConfigPath()), 'dreamina-profiles.json');
  }

  private writeProfilesToDisk(): void {
    const targetPath = this.resolveProfilesPath();
    const obj: Record<string, PersistedDreaminaMcpConfig> = {};
    for (const [k, v] of this.profileConfigs.entries()) {
      obj[k] = v;
    }
    try {
      fs.mkdirSync(path.dirname(targetPath), { recursive: true, mode: 0o700 });
      const tmp = `${targetPath}.${process.pid}.${Date.now()}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(obj, null, 2), { encoding: 'utf8', mode: 0o600 });
      fs.chmodSync(tmp, 0o600);
      fs.renameSync(tmp, targetPath);
      fs.chmodSync(targetPath, 0o600);
    } catch {
      // Ignore profile persistence failure
    }
  }

  private getMediaDir(): string {
    return (
      this.deps.mediaDir ||
      process.env.DREAMFLOW_MEDIA_DIR ||
      path.join(os.homedir(), '.open-dreamflow', 'media')
    );
  }

  public hydrateOnStartup(): void {
    const profilesPath = this.resolveProfilesPath();
    try {
      if (fs.existsSync(profilesPath)) {
        const parsed = JSON.parse(fs.readFileSync(profilesPath, 'utf8')) as Record<
          string,
          PersistedDreaminaMcpConfig
        >;
        if (parsed && typeof parsed === 'object') {
          for (const [prof, raw] of Object.entries(parsed)) {
            if (raw && raw.connected === true && raw.mode) {
              this.profileConfigs.set(prof, raw);
              this.registerVirtualServer(prof);
            }
          }
        }
      }
    } catch {
      // Ignore invalid profile file
    }

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
      this.registerVirtualServer('default');
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

  public registerVirtualServer(profile = 'default'): void {
    const cleanProfile = String(profile || 'default').trim() || 'default';
    const cfg = this.getActiveConfig(cleanProfile);
    const account = this.buildAccountInfo(cfg);
    const serverId =
      cleanProfile === 'default'
        ? DREAMINA_MCP_SERVER_ID
        : `${DREAMINA_MCP_SERVER_ID}__${cleanProfile}`;
    this.deps.externalMcpHost.registerVirtualServer({
      id: serverId,
      name:
        cleanProfile === 'default'
          ? 'Dreamina MCP (CLI Engine · Seedream & Seedance)'
          : `Dreamina MCP (${cleanProfile})`,
      platformId: 'dreamina',
      url: cleanProfile === 'default' ? 'builtin://mcp_dreamina' : `builtin://mcp_dreamina/${cleanProfile}`,
      account,
      authType: cfg?.mode === 'ark_api_key' ? 'headers' : 'oauth',
      getTools: () => DREAMINA_TOOLS,
      callTool: (toolName, args, timeoutMs) =>
        this.runWithProfile(cleanProfile, () => this.executeToolCall(toolName, args, timeoutMs)),
      onRemove: () => {
        this.setActiveConfig(null, cleanProfile);
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
    options: { timeoutMs?: number; binaryPath?: string; profile?: string } = {}
  ): Promise<Record<string, unknown>> {
    const binaryPath = options.binaryPath || (await this.ensureDreaminaCliBinary()).binaryPath;
    const activeProfile = this.getActiveProfile(options.profile);
    const fullArgs = [
      '--format',
      'json',
      '--non-interactive',
      ...(activeProfile !== 'default' ? ['--profile', activeProfile] : []),
      ...args,
    ];
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

  public async probeCliAuth(explicitProfile?: string): Promise<DreaminaCliAuthProbe> {
    const profile = this.getActiveProfile(explicitProfile);
    const { binaryPath, version } = await this.ensureDreaminaCliBinary();
    const statusRes = await this.runCliJson(['auth', 'status'], {
      binaryPath,
      profile,
      timeoutMs: 12_000,
    });
    const statusData = (statusRes.data || {}) as Record<string, unknown>;
    const loggedIn = Boolean(statusData.loggedIn);
    const expiresAt = typeof statusData.expiresAt === 'string' ? statusData.expiresAt : undefined;

    if (!loggedIn) {
      return {
        cliBinaryPath: binaryPath,
        cliVersion: version,
        loggedIn: false,
        expiresAt,
      };
    }

    // Proactively refresh CLI token in background if within 48h of expiry
    if (expiresAt) {
      const msLeft = Date.parse(expiresAt) - Date.now();
      const lastRefresh = this.lastAutoRefreshByProfile.get(profile) || 0;
      if (Number.isFinite(msLeft) && msLeft > 0 && msLeft < 48 * 3600_000 && Date.now() - lastRefresh > 3600_000) {
        this.lastAutoRefreshByProfile.set(profile, Date.now());
        void this.runCliJson(['auth', 'refresh'], {
          binaryPath,
          profile,
          timeoutMs: 20_000,
        }).catch(() => {});
      }
    }

    let accountData: Record<string, unknown> = {};
    try {
      const accRes = await this.runCliJson(['auth', 'account'], {
        binaryPath,
        profile,
        timeoutMs: 12_000,
      });
      accountData = (accRes.data || {}) as Record<string, unknown>;
    } catch {
      // Account fetch optional if status succeeded
    }

    const creditsObj =
      typeof accountData.credits === 'object' && accountData.credits !== null
        ? (accountData.credits as Record<string, unknown>)
        : undefined;
    const rawCredits =
      accountData.availableCredits ??
      creditsObj?.available ??
      accountData.credits ??
      accountData.balance;
    let availableCredits: number | undefined;
    if (typeof rawCredits === 'number' && Number.isFinite(rawCredits)) {
      availableCredits = rawCredits;
    } else if (typeof rawCredits === 'string' && rawCredits.trim()) {
      const n = Number(rawCredits.replace(/,/g, '').trim());
      if (Number.isFinite(n)) availableCredits = n;
    }

    const rawDetails = Array.isArray(creditsObj?.details) ? creditsObj!.details : [];
    const nowMs = Date.now();
    const creditBuckets: DreaminaCreditBucket[] = rawDetails
      .map((item) => {
        if (!item || typeof item !== 'object') return null;
        const rec = item as Record<string, unknown>;
        const rawAmt = rec.available ?? rec.credits ?? rec.amount;
        const amt =
          typeof rawAmt === 'number'
            ? rawAmt
            : Number(String(rawAmt || '').replace(/,/g, '').trim());
        const exp = typeof rec.expiresAt === 'string' ? rec.expiresAt.trim() : '';
        if (!Number.isFinite(amt) || amt <= 0 || !exp) return null;
        const expMs = Date.parse(exp);
        const daysRemaining = Number.isFinite(expMs)
          ? Math.max(0, Math.ceil((expMs - nowMs) / (24 * 3600_000)))
          : 0;
        return { credits: amt, expiresAt: exp, daysRemaining };
      })
      .filter((b): b is DreaminaCreditBucket => b !== null)
      .sort((a, b) => Date.parse(a.expiresAt) - Date.parse(b.expiresAt));

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
      vipLevelExpiresAt:
        typeof accountData.vipLevelExpiresAt === 'string' && accountData.vipLevelExpiresAt.trim()
          ? accountData.vipLevelExpiresAt.trim()
          : undefined,
      expiresAt,
      creditBuckets,
    };
  }

  public async getBalanceInfo(
    forceRefresh = false,
    explicitProfile?: string
  ): Promise<{
    credits?: number;
    plan?: string;
    account?: string;
    rawText: string;
  } | null> {
    const profile = this.getActiveProfile(explicitProfile);
    const activeCfg = this.getActiveConfig(profile);
    const now = Date.now();
    const cachedProf = this.profileBalances.get(profile);
    if (!forceRefresh && cachedProf && now - cachedProf.fetchedAt < 25_000) {
      return {
        credits: cachedProf.credits,
        plan: cachedProf.plan,
        account: cachedProf.account,
        rawText: cachedProf.rawText,
      };
    }
    if (profile === 'default' && !forceRefresh && this.cachedBalance && now - this.cachedBalance.fetchedAt < 25_000) {
      return {
        credits: this.cachedBalance.credits,
        plan: this.cachedBalance.plan,
        account: this.cachedBalance.account,
        rawText: this.cachedBalance.rawText,
      };
    }

    if (activeCfg?.mode === 'cli_oauth') {
      try {
        const auth = await this.probeCliAuth(profile);
        if (auth.loggedIn) {
          const credits = auth.availableCredits;
          const plan = auth.vipLevel || (auth.isVip ? 'vip' : 'dreamina');
          const account = auth.displayName || activeCfg.account;
          const rawText = `${credits !== undefined ? `Credits: ${credits}` : ''}${
            credits !== undefined && plan ? ' | ' : ''
          }${plan ? `Plan: ${plan}` : ''}`.trim();
          this.profileBalances.set(profile, {
            fetchedAt: now,
            credits,
            plan,
            account,
            rawText,
            vipLevelExpiresAt: auth.vipLevelExpiresAt,
            tokenExpiresAt: auth.expiresAt,
            buckets: auth.creditBuckets || [],
          });
          if (profile === 'default') {
            this.cachedBalance = { fetchedAt: now, credits, plan, account, rawText };
          }
          if (activeCfg) {
            const creditsLabel =
              credits !== undefined ? ` · ${credits.toLocaleString('en-US')} credits` : '';
            activeCfg.availableCredits = credits;
            activeCfg.vipLevel = plan;
            activeCfg.account = `${auth.displayName || 'Dreamina'}${plan ? ` (${plan}${creditsLabel})` : ''}`;
            activeCfg.updatedAt = new Date().toISOString();
          }
          return { credits, plan, account, rawText };
        }
      } catch {
        // Fallback to cached below
      }
    }

    if (cachedProf) {
      return {
        credits: cachedProf.credits,
        plan: cachedProf.plan,
        account: cachedProf.account,
        rawText: cachedProf.rawText,
      };
    }
    if (profile === 'default' && this.cachedBalance) {
      return {
        credits: this.cachedBalance.credits,
        plan: this.cachedBalance.plan,
        account: this.cachedBalance.account,
        rawText: this.cachedBalance.rawText,
      };
    }

    if (activeCfg?.availableCredits !== undefined || activeCfg?.vipLevel) {
      return {
        credits: activeCfg.availableCredits,
        plan: activeCfg.vipLevel || activeCfg.mode,
        account: activeCfg.account,
        rawText:
          activeCfg.availableCredits !== undefined
            ? `Credits: ${activeCfg.availableCredits} | Plan: ${activeCfg.vipLevel || 'dreamina'}`
            : `Plan: ${activeCfg.vipLevel || activeCfg.mode}`,
      };
    }

    return null;
  }

  public async getFullCreditSummary(
    forceRefresh = false,
    explicitProfile?: string
  ): Promise<DreaminaFullCreditSummary> {
    const profile = this.getActiveProfile(explicitProfile);
    const activeCfg = this.getActiveConfig(profile);
    const now = Date.now();
    const cachedProf = this.profileBalances.get(profile);
    if (!forceRefresh && cachedProf && now - cachedProf.fetchedAt < 20_000) {
      return {
        loggedIn: true,
        profile,
        credits: cachedProf.credits,
        vipLevel: cachedProf.plan,
        vipLevelExpiresAt: cachedProf.vipLevelExpiresAt,
        tokenExpiresAt: cachedProf.tokenExpiresAt,
        account: cachedProf.account,
        buckets: cachedProf.buckets,
      };
    }
    if (!activeCfg?.connected || activeCfg.mode !== 'cli_oauth') {
      return { loggedIn: false, profile, buckets: [] };
    }
    const auth = await this.probeCliAuth(profile);
    if (!auth.loggedIn) {
      return { loggedIn: false, profile, buckets: [] };
    }
    const plan = auth.vipLevel || (auth.isVip ? 'vip' : 'dreamina');
    const rawText = `${auth.availableCredits !== undefined ? `Credits: ${auth.availableCredits}` : ''}${
      auth.availableCredits !== undefined && plan ? ' | ' : ''
    }${plan ? `Plan: ${plan}` : ''}`.trim();
    const buckets = auth.creditBuckets || [];
    this.profileBalances.set(profile, {
      fetchedAt: now,
      credits: auth.availableCredits,
      plan,
      account: auth.displayName || activeCfg.account,
      rawText,
      vipLevelExpiresAt: auth.vipLevelExpiresAt,
      tokenExpiresAt: auth.expiresAt,
      buckets,
    });
    if (profile === 'default') {
      this.cachedBalance = {
        fetchedAt: now,
        credits: auth.availableCredits,
        plan,
        account: auth.displayName || activeCfg.account,
        rawText,
      };
    }
    return {
      loggedIn: true,
      profile,
      credits: auth.availableCredits,
      vipLevel: plan,
      vipLevelExpiresAt: auth.vipLevelExpiresAt,
      tokenExpiresAt: auth.expiresAt,
      account: auth.displayName || activeCfg.account,
      buckets,
    };
  }

  public async downloadResourceRawToMediaDir(
    projectId: string,
    resourceId: string,
    modality: 'image' | 'video' | 'audio' = 'image',
    explicitProfile?: string
  ): Promise<string> {
    const profile = this.getActiveProfile(explicitProfile);
    return await this.runWithProfile(profile, () =>
      this.downloadResourceToMediaDir(projectId, resourceId, modality)
    );
  }

  public async listRecentCloudAssets(
    forceRefresh = false,
    explicitProfile?: string
  ): Promise<DreaminaCloudAssetItem[]> {
    const profile = this.getActiveProfile(explicitProfile);
    const now = Date.now();
    const cached = this.recentAssetsCacheByProfile.get(profile);
    if (!forceRefresh && cached && now - cached.fetchedAt < 20_000) {
      return cached.items;
    }

    const activeCfg = this.getActiveConfig(profile);
    if (!activeCfg?.connected || activeCfg.mode !== 'cli_oauth') {
      return [];
    }

    return await this.runWithProfile(profile, async () => {
      try {
        const canvasesRes = await this.runCliJson(['canvas', 'ls', '--limit', '3'], {
          profile,
          timeoutMs: 15_000,
        });
        const canvasesData = (canvasesRes.data || {}) as Record<string, unknown>;
        const canvasItems = (Array.isArray(canvasesData.items) ? canvasesData.items : []) as Array<
          Record<string, unknown>
        >;
        const projectIds: string[] = [];
        if (activeCfg.projectId) projectIds.push(activeCfg.projectId);
        for (const c of canvasItems) {
          const pid = typeof c.projectId === 'string' ? c.projectId.trim() : '';
          if (pid && !projectIds.includes(pid)) projectIds.push(pid);
        }

        const collected: DreaminaCloudAssetItem[] = [];
        for (const pid of projectIds.slice(0, 2)) {
          const findRes = await this.runCliJson(
            ['node', 'find', '--project-id', pid, '--status', 'success', '--limit', '12'],
            { profile, timeoutMs: 15_000 }
          );
          const findItems = (Array.isArray((findRes.data as Record<string, unknown> | undefined)?.items)
            ? (findRes.data as Record<string, unknown>).items
            : []) as Array<Record<string, unknown>>;
          const nodeIds = findItems
            .filter((n) => ['image', 'video', 'audio'].includes(String(n.type || '')))
            .map((n) => String(n.nodeId || '').trim())
            .filter(Boolean)
            .slice(0, 8);
          if (nodeIds.length === 0) continue;

          const showRes = await this.runCliJson(
            ['node', 'show', '--project-id', pid, ...nodeIds.flatMap((id) => ['--node-id', id])],
            { profile, timeoutMs: 20_000 }
          );
          const showNodes = (Array.isArray((showRes.data as Record<string, unknown> | undefined)?.nodes)
            ? (showRes.data as Record<string, unknown>).nodes
            : []) as Array<Record<string, unknown>>;

          for (const wrap of showNodes) {
            const node = (wrap.node && typeof wrap.node === 'object' ? wrap.node : wrap) as Record<
              string,
              unknown
            >;
            const resources = Array.isArray(node.resources)
              ? (node.resources as Array<Record<string, unknown>>)
              : [];
            const gen = (node.generation && typeof node.generation === 'object'
              ? node.generation
              : {}) as Record<string, unknown>;
            for (const r of resources) {
              const rid = typeof r.resourceId === 'string' ? r.resourceId.trim() : '';
              const rType = String(r.type || node.type || 'image').toLowerCase();
              const kind: 'image' | 'video' | 'audio' =
                rType === 'video' ? 'video' : rType === 'audio' ? 'audio' : 'image';
              if (!rid) continue;
              const directUrl =
                typeof r.url === 'string' && /^https?:\/\//i.test(r.url)
                  ? r.url
                  : `/api/assets/dreamina-resource?projectId=${encodeURIComponent(
                      pid
                    )}&resourceId=${encodeURIComponent(rid)}&modality=${kind}`;
              const createdMs = Number(r.createdAt || 0);
              const createdIso =
                Number.isFinite(createdMs) && createdMs > 1_000_000_000_000
                  ? new Date(createdMs > 1_750_000_000_000 ? Date.now() : createdMs).toISOString()
                  : new Date().toISOString();
              collected.push({
                id: `drm_${rid}`,
                title: String(node.title || gen.prompt || `Dreamina ${kind}`).slice(0, 60),
                kind,
                url: directUrl,
                ...(kind === 'image' ? { thumbnailUrl: directUrl } : {}),
                resourceId: rid,
                projectId: pid,
                createdAt: createdIso,
                prompt: typeof gen.prompt === 'string' ? gen.prompt : undefined,
                model: typeof gen.model === 'string' ? gen.model : undefined,
                creditsAmount: typeof r.creditsAmount === 'number' ? r.creditsAmount : undefined,
              });
            }
          }
        }

        this.recentAssetsCacheByProfile.set(profile, { fetchedAt: now, items: collected });
        return collected;
      } catch {
        return cached?.items || [];
      }
    });
  }

  public async quoteCliCost(params: {
    modality: 'image' | 'video' | 'audio';
    modelId: string;
    prompt?: string;
    aspectRatio?: string;
    resolution?: string;
    durationSec?: number;
    batchCount?: number;
    profile?: string;
  }): Promise<number | null> {
    const profile = this.getActiveProfile(params.profile);
    const activeCfg = this.getActiveConfig(profile);
    if (!activeCfg?.connected || activeCfg.mode !== 'cli_oauth') return null;
    return await this.runWithProfile(profile, async () => {
      const sdk = await this.deps.loadProviderSdk();
      const mapToCli =
        typeof sdk.mapCanonicalDreaminaToCliModel === 'function'
          ? (sdk.mapCanonicalDreaminaToCliModel as (r?: string, m?: 'image' | 'video' | 'audio') => string)
          : defaultCliModelForCanonical;
      const cliModel = mapToCli(params.modelId, params.modality);
      const pid = await this.ensureWorkspaceProjectId();
      const mode =
        params.modality === 'image' ? 't2i' : params.modality === 'audio' ? 'tts' : 't2v';
      const args = [
        'node',
        'create',
        params.modality,
        '--project-id',
        pid,
        '--mode',
        mode,
        '--model',
        cliModel,
        '--prompt',
        params.prompt || 'Quote check scene',
        ...(params.aspectRatio ? ['--ratio', params.aspectRatio] : []),
        ...(params.resolution ? ['--resolution', params.resolution] : []),
        ...(params.modality === 'video' && params.durationSec
          ? ['--duration', String(Math.round(params.durationSec))]
          : []),
        ...(params.modality === 'image' && params.batchCount
          ? ['--count', String(Math.max(1, Math.min(8, Math.round(params.batchCount))))]
          : []),
      ];
      let createdNodeId = '';
      try {
        const cr = await this.runCliJson(args, { profile, timeoutMs: 25_000 });
        createdNodeId = String((cr.data as Record<string, unknown> | undefined)?.nodeId || '').trim();
        if (!createdNodeId) return null;
        const qt = await this.runCliJson(
          ['node', 'quote', '--project-id', pid, '--node-id', createdNodeId],
          { profile, timeoutMs: 20_000 }
        );
        const qtData = (qt.data || {}) as Record<string, unknown>;
        const est = Number(qtData.estimatedCredits ?? qtData.credits ?? qtData.totalMaxCredits);
        return Number.isFinite(est) ? est : null;
      } catch {
        return null;
      } finally {
        if (createdNodeId) {
          void this.runCliJson(
            [
              'node',
              'delete',
              'confirm',
              '--project-id',
              pid,
              '--node-id',
              createdNodeId,
              '--update-id',
              crypto.randomUUID(),
            ],
            { profile, timeoutMs: 15_000 }
          ).catch(() => {});
        }
      }
    });
  }

  public async connect(params: {
    mode?: string;
    profile?: string;
    force?: boolean;
    sessionIdCookie?: string;
    arkApiKey?: string;
    arkEndpoint?: string;
    launchBrowser?: boolean;
  }): Promise<DreaminaMcpSession> {
    const profile = this.getActiveProfile(params.profile);
    const serverId =
      profile === 'default' ? DREAMINA_MCP_SERVER_ID : `${DREAMINA_MCP_SERVER_ID}__${profile}`;
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
      profile,
      serverId,
      serverName:
        profile === 'default'
          ? 'Dreamina MCP (CLI Engine · Seedream & Seedance)'
          : `Dreamina MCP (${profile})`,
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
      this.setActiveConfig(cfg, profile);
      this.registerVirtualServer(profile);

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
      this.setActiveConfig(cfg, profile);
      this.registerVirtualServer(profile);

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
        const sessProfile = session.profile || 'default';
        this.setActiveConfig(cfg, sessProfile);
        this.registerVirtualServer(sessProfile);

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
        const existingAuth = await this.probeCliAuth(profile);
        if (existingAuth.loggedIn) {
          return await this.finalizeCliConnectedSession(session, existingAuth, now);
        }
      }

      const loginArgs = ['auth', 'login', ...(params.force ? ['--force'] : [])];
      const loginRes = await this.runCliJson(loginArgs, { binaryPath, profile, timeoutMs: 20_000 });
      const loginData = (loginRes.data || {}) as Record<string, unknown>;
      const loginStatus = String(loginData.status || '').toLowerCase();

      if (loginStatus === 'logged_in') {
        const freshAuth = await this.probeCliAuth(profile);
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
            profile,
            timeoutMs: 315_000,
          });
          const waitData = (waitRes.data || {}) as Record<string, unknown>;
          const waitStatus = String(waitData.status || '').toLowerCase();
          if (waitStatus === 'logged_in' || waitRes.ok === true) {
            const verifiedAuth = await this.probeCliAuth(profile);
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
    const profile = this.getActiveProfile(session.profile);
    const prevCfg = this.getActiveConfig(profile);
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
      projectId: prevCfg?.projectId,
      connectedAt: prevCfg?.connectedAt || connectedAtIso,
      updatedAt: connectedAtIso,
    };
    this.setActiveConfig(cfg, profile);
    this.registerVirtualServer(profile);
    const rawText =
      auth.availableCredits !== undefined
        ? `Credits: ${auth.availableCredits}${auth.vipLevel ? ` | Plan: ${auth.vipLevel}` : ''}`
        : `Plan: ${auth.vipLevel || 'dreamina'}`;
    this.profileBalances.set(profile, {
      fetchedAt: Date.now(),
      credits: auth.availableCredits,
      plan: auth.vipLevel || 'dreamina',
      account: auth.displayName || accountLabel,
      rawText,
      vipLevelExpiresAt: auth.vipLevelExpiresAt,
      tokenExpiresAt: auth.expiresAt,
      buckets: auth.creditBuckets || [],
    });
    if (profile === 'default') {
      this.cachedBalance = {
        fetchedAt: Date.now(),
        credits: auth.availableCredits,
        plan: auth.vipLevel || 'dreamina',
        account: auth.displayName || accountLabel,
        rawText,
      };
    }

    session.step = 'connected';
    session.account = this.buildAccountInfo(cfg);
    session.balance = {
      ...(auth.availableCredits !== undefined ? { credits: auth.availableCredits } : {}),
      ...(auth.vipLevel ? { plan: auth.vipLevel } : {}),
      ...(auth.displayName ? { account: auth.displayName } : {}),
      rawText:
        this.profileBalances.get(profile)?.rawText ||
        this.cachedBalance?.rawText ||
        (auth.availableCredits !== undefined ? `Credits: ${auth.availableCredits}` : ''),
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
        const sessProfile = session.profile || 'default';
        this.setActiveConfig(cfg, sessProfile);
        this.registerVirtualServer(sessProfile);

        session.step = 'connected';
        session.account = this.buildAccountInfo(cfg);
        session.toolsCount = DREAMINA_TOOLS.length;
        session.updatedAt = now;
        this.emitSessionUpdate(session);
      }
    }

    return { ...session };
  }

  public async disconnect(explicitProfile?: string): Promise<{ ok: true; disconnected: boolean }> {
    const profile = this.getActiveProfile(explicitProfile);
    const serverId =
      profile === 'default' ? DREAMINA_MCP_SERVER_ID : `${DREAMINA_MCP_SERVER_ID}__${profile}`;
    const activeCfg = this.getActiveConfig(profile);
    const wasConnected =
      Boolean(activeCfg?.connected) ||
      this.deps.externalMcpHost.listServers().some((s) => s.id === serverId);
    this.setActiveConfig(null, profile);
    this.profileBalances.delete(profile);
    if (profile === 'default') {
      this.cachedBalance = null;
      this.refUploadCache.clear();
    }
    this.deps.externalMcpHost.unregisterVirtualServer(serverId);
    return { ok: true, disconnected: wasConnected };
  }

  private hasReadyCliBinary(): boolean {
    if (process.env.DREAMFLOW_DREAMINA_DISABLE_LIVE_CLI === '1') return false;
    if (process.env.DREAMFLOW_DREAMINA_BINARY_PATH?.trim()) {
      return fs.existsSync(process.env.DREAMFLOW_DREAMINA_BINARY_PATH.trim());
    }
    if (this.cachedCliPath && fs.existsSync(this.cachedCliPath)) return true;
    if (this.getActiveConfig()?.mode === 'cli_oauth') return true;
    const candidates = [
      path.join(os.homedir(), '.open-dreamflow', 'bin', 'dreamina-canvas'),
      path.join(os.homedir(), '.local', 'bin', 'dreamina-canvas'),
      '/opt/homebrew/bin/dreamina-canvas',
      '/usr/local/bin/dreamina-canvas',
    ];
    return candidates.some((p) => fs.existsSync(p));
  }

  public async getModelsCatalog(
    modality = 'all',
    forceRefresh = false
  ): Promise<Array<Record<string, unknown>>> {
    const sdk = await this.deps.loadProviderSdk();
    const baseModels = (Array.isArray(sdk.DREAMINA_CANONICAL_MODELS)
      ? sdk.DREAMINA_CANONICAL_MODELS
      : []) as Array<Record<string, unknown>>;

    const mapToCli =
      typeof sdk.mapCanonicalDreaminaToCliModel === 'function'
        ? (sdk.mapCanonicalDreaminaToCliModel as (
            raw?: string,
            mod?: 'image' | 'video' | 'audio'
          ) => string)
        : defaultCliModelForCanonical;
    const normalizeModel =
      typeof sdk.normalizeDreaminaModelId === 'function'
        ? (sdk.normalizeDreaminaModelId as (
            raw?: string,
            mod?: 'image' | 'video' | 'audio'
          ) => string)
        : (raw?: string) => String(raw || '').trim().replace(/\./g, '_');

    const liveByModality = await this.getAllLiveCliModels(forceRefresh);
    const liveSpecLookup = new Map<string, CliModelSpec>();
    for (const mod of ['image', 'video', 'audio'] as const) {
      for (const spec of liveByModality[mod] || []) {
        if (!spec.model) continue;
        liveSpecLookup.set(`${mod}:${spec.model}`, spec);
        liveSpecLookup.set(`${mod}:${spec.model.replace(/\./g, '_')}`, spec);
        for (const alias of spec.aliases || []) {
          liveSpecLookup.set(`${mod}:${alias}`, spec);
        }
      }
    }

    const representedCliModels = new Set<string>();
    const representedCanonicalIds = new Set<string>();
    const enriched: Array<Record<string, unknown>> = baseModels.map((entry) => {
      const id = String(entry.id || '');
      const mod = (String(entry.modality || 'image') as 'image' | 'video' | 'audio');
      const expectedCli = mapToCli(id, mod);
      representedCanonicalIds.add(`${mod}:${id}`);
      representedCliModels.add(`${mod}:${expectedCli}`);

      const spec =
        liveSpecLookup.get(`${mod}:${expectedCli}`) ||
        liveSpecLookup.get(`${mod}:${id}`);
      if (!spec) {
        return {
          ...entry,
          cliModel: entry.cliModel || expectedCli,
        };
      }
      if (spec.model) {
        representedCliModels.add(`${mod}:${spec.model}`);
      }
      const cliRatios = extractCliFlagValues(spec, '--ratio');
      const cliResolutions = extractCliFlagValues(spec, '--resolution');
      const cliDurations = extractCliFlagValues(spec, '--duration')
        .map((v) => Number(v))
        .filter((n) => Number.isFinite(n));
      const existingRatios = Array.isArray(entry.aspectRatios) ? (entry.aspectRatios as string[]) : [];
      const existingRes = Array.isArray(entry.resolutions) ? (entry.resolutions as string[]) : [];
      const existingDur = Array.isArray(entry.durations) ? (entry.durations as number[]) : [];

      return {
        ...entry,
        cliModel: spec.model || expectedCli,
        cliAvailable: true,
        cliModes: (spec.modes || []).map((m) => m.name).filter(Boolean),
        aspectRatios:
          cliRatios.length > 0
            ? Array.from(new Set([...existingRatios, ...cliRatios]))
            : entry.aspectRatios,
        resolutions:
          cliResolutions.length > 0
            ? Array.from(new Set([...existingRes, ...cliResolutions]))
            : entry.resolutions,
        durations:
          cliDurations.length > 0
            ? Array.from(new Set([...existingDur, ...cliDurations])).sort((a, b) => a - b)
            : entry.durations,
      };
    });

    // Append any newly discovered CLI models not yet listed in DREAMINA_CANONICAL_MODELS
    for (const mod of ['image', 'video', 'audio'] as const) {
      for (const spec of liveByModality[mod] || []) {
        const rawName = String(spec.model || '').trim();
        if (!rawName) continue;
        const normalized = normalizeModel(rawName, mod);
        if (
          representedCliModels.has(`${mod}:${rawName}`) ||
          representedCanonicalIds.has(`${mod}:${normalized}`) ||
          representedCanonicalIds.has(`${mod}:${rawName.replace(/\./g, '_')}`)
        ) {
          continue;
        }
        const canonicalNewId = rawName.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').toLowerCase();
        representedCanonicalIds.add(`${mod}:${canonicalNewId}`);
        representedCliModels.add(`${mod}:${rawName}`);
        const cliDurations = extractCliFlagValues(spec, '--duration')
          .map((v) => Number(v))
          .filter((n) => Number.isFinite(n));
        enriched.push({
          id: canonicalNewId || normalized,
          name: spec.displayName || rawName,
          modality: mod,
          providerFamily: inferProviderFamily(rawName),
          description: `Live discovered Dreamina CLI model (${rawName}).`,
          aspectRatios: extractCliFlagValues(spec, '--ratio'),
          resolutions: extractCliFlagValues(spec, '--resolution'),
          ...(cliDurations.length > 0 ? { durations: cliDurations } : {}),
          cliModel: rawName,
          cliAvailable: true,
          cliDiscovered: true,
          cliModes: (spec.modes || []).map((m) => m.name).filter(Boolean),
          supportedViaCli: true,
        });
      }
    }

    if (modality === 'image' || modality === 'video' || modality === 'audio') {
      return enriched.filter((m) => String(m.modality || '') === modality);
    }
    return enriched;
  }

  private async ensureWorkspaceProjectId(): Promise<string> {
    const activeProfile = this.getActiveProfile();
    const activeCfg = this.getActiveConfig(activeProfile);
    if (activeCfg?.projectId && /^[0-9a-f-]{8,}$/i.test(activeCfg.projectId)) {
      return activeCfg.projectId;
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
        if (activeCfg) {
          activeCfg.projectId = pid;
          activeCfg.updatedAt = new Date().toISOString();
          this.setActiveConfig(activeCfg, activeProfile);
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

    const updatedCfg = this.getActiveConfig(activeProfile);
    if (updatedCfg) {
      updatedCfg.projectId = projectId;
      updatedCfg.updatedAt = new Date().toISOString();
      this.setActiveConfig(updatedCfg, activeProfile);
    }
    return projectId;
  }

  private async getAllLiveCliModels(
    forceRefresh = false
  ): Promise<Record<'image' | 'video' | 'audio', CliModelSpec[]>> {
    const empty: Record<'image' | 'video' | 'audio', CliModelSpec[]> = {
      image: [],
      video: [],
      audio: [],
    };
    if (!forceRefresh && !this.hasReadyCliBinary()) {
      return empty;
    }
    const now = Date.now();
    const currentBinOverride = process.env.DREAMFLOW_DREAMINA_BINARY_PATH?.trim() || '';
    const cacheMatchesBin =
      !currentBinOverride || this.cliModelSchemasCache?.binaryPath === currentBinOverride;
    if (
      !forceRefresh &&
      this.cliModelSchemasCache &&
      cacheMatchesBin &&
      now - this.cliModelSchemasCache.fetchedAt < 10 * 60_000
    ) {
      return this.cliModelSchemasCache.itemsByModality;
    }

    try {
      const { binaryPath } = await this.ensureDreaminaCliBinary();
      const [imgRes, vidRes, audRes] = await Promise.all([
        this.runCliJson(['model', 'list', '--type', 'image'], { binaryPath, timeoutMs: 15_000 }),
        this.runCliJson(['model', 'list', '--type', 'video'], { binaryPath, timeoutMs: 15_000 }),
        this.runCliJson(['model', 'list', '--type', 'audio'], { binaryPath, timeoutMs: 15_000 }),
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
      this.cliModelSchemasCache = { fetchedAt: now, binaryPath, itemsByModality };
      return itemsByModality;
    } catch {
      return empty;
    }
  }

  private async getLiveCliModels(
    modality: 'image' | 'video' | 'audio',
    forceRefresh = false
  ): Promise<CliModelSpec[]> {
    const all = await this.getAllLiveCliModels(forceRefresh);
    return all[modality] || [];
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

  private async collectAndDownloadOutputs(
    projectId: string,
    nodeId: string,
    primaryResponse: Record<string, unknown>,
    modality: 'image' | 'video' | 'audio',
    maxOutputs = 4
  ): Promise<string[]> {
    const resourceIds: string[] = [];
    const directUrls: string[] = [];
    collectResourceIdsAndUrls(primaryResponse.data || primaryResponse, resourceIds, directUrls);

    if (resourceIds.length === 0 && directUrls.length === 0 && nodeId) {
      const showRes = await this.runCliJson(
        ['node', 'show', '--project-id', projectId, '--node-id', nodeId],
        { timeoutMs: 30_000 }
      );
      collectResourceIdsAndUrls(showRes.data || showRes, resourceIds, directUrls);
    }

    const outputs: string[] = [];
    for (const rid of Array.from(new Set(resourceIds)).slice(0, maxOutputs)) {
      outputs.push(await this.downloadResourceToMediaDir(projectId, rid, modality));
    }

    if (outputs.length === 0 && directUrls.length > 0) {
      const ext = modality === 'video' ? '.mp4' : modality === 'audio' ? '.mp3' : '.png';
      const mediaDir = this.getMediaDir();
      fs.mkdirSync(mediaDir, { recursive: true, mode: 0o755 });
      for (const remoteUrl of directUrls.slice(0, maxOutputs)) {
        const res = await fetch(remoteUrl, { signal: AbortSignal.timeout(45_000) });
        if (!res.ok) continue;
        const buf = Buffer.from(await res.arrayBuffer());
        const fileName = `dreamina_mcp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`;
        const finalPath = path.join(mediaDir, fileName);
        fs.writeFileSync(finalPath, buf);
        fs.chmodSync(finalPath, 0o644);
        outputs.push(`/media/${fileName}`);
      }
    }

    return outputs;
  }

  private async resolveOrCreateSourceNodeId(
    projectId: string,
    args: Record<string, unknown>,
    mediaType: 'image' | 'video'
  ): Promise<string> {
    const explicitNodeId = strArg(args.node_id);
    if (explicitNodeId) return explicitNodeId;

    const sourceUrl =
      strArg(args.image_url) || strArg(args.video_url) || strArg(args.source_url);
    if (!sourceUrl) {
      throw new Error(
        `Provide either node_id or ${mediaType === 'image' ? 'image_url' : 'video_url'}.`
      );
    }

    const uploadedRef = await this.uploadReferenceToDreamina(projectId, sourceUrl, mediaType);
    const resourceId = uploadedRef.replace(/^res:/, '');
    const createRes = await this.runCliJson(
      [
        'node',
        'create',
        mediaType,
        '--project-id',
        projectId,
        '--import-kind',
        'local_upload',
        '--resource-id',
        resourceId,
        '--title',
        `Post-Edit ${mediaType}`,
      ],
      { timeoutMs: 45_000 }
    );
    const data = (createRes.data || {}) as Record<string, unknown>;
    const createdNodeId = String(
      data.nodeId ||
        (data.node as Record<string, unknown> | undefined)?.nodeId ||
        (data.node as Record<string, unknown> | undefined)?.id ||
        ''
    ).trim();
    if (!createdNodeId) {
      throw new Error(`node create ${mediaType} for post-edit returned no nodeId.`);
    }
    return createdNodeId;
  }

  private async executePostEditTool(
    toolName: string,
    args: Record<string, unknown>,
    timeoutMs?: number
  ): Promise<Record<string, unknown>> {
    const projectId = strArg(args.project_id) || (await this.ensureWorkspaceProjectId());
    const sourceModality: 'image' | 'video' =
      toolName === 'dreamina_upscale_image' || toolName === 'dreamina_cutout_image'
        ? 'image'
        : 'video';
    const nodeId = await this.resolveOrCreateSourceNodeId(projectId, args, sourceModality);
    const wait = args.wait !== false;
    const creditCeiling = Math.max(1, Math.round(numArg(args.credit_ceiling) ?? 500));
    const submitIdArg = strArg(args.submit_id) || crypto.randomUUID();

    let subArgs: string[] = [];
    if (toolName === 'dreamina_upscale_image') {
      subArgs = [
        'node',
        'upscale',
        'image',
        '--project-id',
        projectId,
        '--node-id',
        nodeId,
        '--mode',
        strArg(args.mode) || 'normal',
        '--resolution',
        strArg(args.resolution) || '4K',
        ...(numArg(args.detail) !== undefined
          ? ['--detail', String(Math.max(1, Math.min(100, Math.round(numArg(args.detail)!))))]
          : []),
      ];
    } else if (toolName === 'dreamina_upscale_video') {
      subArgs = [
        'node',
        'upscale',
        'video',
        '--project-id',
        projectId,
        '--node-id',
        nodeId,
        '--resolution',
        strArg(args.resolution) || '1080p',
      ];
    } else if (toolName === 'dreamina_cutout_image') {
      subArgs = ['node', 'cutout', 'image', '--project-id', projectId, '--node-id', nodeId];
    } else if (toolName === 'dreamina_interpolate_video') {
      subArgs = [
        'node',
        'interpolate',
        'video',
        '--project-id',
        projectId,
        '--node-id',
        nodeId,
        '--fps',
        String(Math.round(numArg(args.fps) ?? 60)),
      ];
    } else {
      subArgs = [
        'node',
        'promote',
        'video-sample',
        '--project-id',
        projectId,
        '--node-id',
        nodeId,
        '--resolution',
        strArg(args.resolution) || '1080p',
      ];
    }

    subArgs.push('--credit-ceiling', String(creditCeiling), '--submit-id', submitIdArg);
    if (wait) {
      subArgs.push('--wait');
    }

    const cmdRes = await this.runCliJson(subArgs, {
      timeoutMs: Math.max(Number(timeoutMs) || 0, 240_000),
    });
    const data = (cmdRes.data || {}) as Record<string, unknown>;
    const resultNodeId = String(
      data.targetNodeId ||
        data.outputNodeId ||
        data.resultNodeId ||
        data.nodeId ||
        nodeId
    ).trim();
    const returnedSubmitId = String(data.submitId || submitIdArg).trim();

    if (!wait) {
      return okToolResult({
        ok: true,
        status: 'submitted',
        projectId,
        nodeId: resultNodeId,
        sourceNodeId: nodeId,
        submitId: returnedSubmitId,
        data,
      });
    }

    let outputs = await this.collectAndDownloadOutputs(
      projectId,
      resultNodeId,
      cmdRes,
      sourceModality,
      4
    );
    if (outputs.length === 0 && resultNodeId !== nodeId) {
      outputs = await this.collectAndDownloadOutputs(
        projectId,
        nodeId,
        cmdRes,
        sourceModality,
        4
      );
    }
    this.cachedBalance = null;
    void this.getBalanceInfo(true);

    return okToolResult({
      ok: true,
      status: 'completed',
      projectId,
      nodeId: resultNodeId,
      sourceNodeId: nodeId,
      submitId: returnedSubmitId,
      ...(sourceModality === 'image' ? { imageUrl: outputs[0] } : { videoUrl: outputs[0] }),
      outputs,
      data,
    });
  }

  private async executeExtendedCliTool(
    toolName: string,
    args: Record<string, unknown>,
    mapToCliModel: (raw?: string, modality?: 'image' | 'video' | 'audio') => string,
    timeoutMs?: number
  ): Promise<Record<string, unknown> | null> {
    if (toolName === 'dreamina_auth_refresh') {
      const res = await this.runCliJson(['auth', 'refresh'], { timeoutMs: 20_000 });
      return okToolResult({ ok: true, data: res.data || res });
    }

    if (toolName === 'dreamina_cli_schema') {
      const res = await this.runCliJson(['schema'], { timeoutMs: 15_000 });
      const data = (res.data || res) as Record<string, unknown>;
      const sub = strArg(args.subcommand).toLowerCase();
      if (sub && typeof data === 'object' && data !== null && Array.isArray(data.commands)) {
        const filtered = (data.commands as Array<Record<string, unknown>>).filter((c) =>
          String(c.name || c.path || '').toLowerCase().includes(sub)
        );
        return okToolResult({ ok: true, subcommand: sub, commands: filtered, schema: data });
      }
      return okToolResult({ ok: true, schema: data });
    }

    if (toolName === 'dreamina_model_info') {
      const rawModel = strArg(args.model);
      if (!rawModel) return errToolResult('dreamina_model_info requires a model argument.');
      const mod = strArg(args.modality) as 'image' | 'video' | 'audio' | '';
      const lowerRaw = rawModel.toLowerCase();
      const inferredMod: 'image' | 'video' | 'audio' =
        mod ||
        (/(audio|tts)/.test(lowerRaw)
          ? 'audio'
          : /(seedance|veo|wan|happyhorse|omni|motion|video)/.test(lowerRaw)
            ? 'video'
            : 'image');
      const mapped = mapToCliModel(rawModel, inferredMod);
      const [sdk, allCatalog, imgSpecs, vidSpecs, audSpecs] = await Promise.all([
        this.deps.loadProviderSdk(),
        this.getModelsCatalog('all'),
        this.getLiveCliModels('image'),
        this.getLiveCliModels('video'),
        this.getLiveCliModels('audio'),
      ]);
      const canonical =
        typeof sdk.normalizeDreaminaModelId === 'function'
          ? (
              sdk.normalizeDreaminaModelId as (
                raw?: string,
                modality?: 'image' | 'video' | 'audio'
              ) => string
            )(rawModel, inferredMod)
          : rawModel.trim().replace(/\./g, '_');
      const catalogEntry =
        allCatalog.find((m) => m.id === canonical || m.id === rawModel) || null;
      const allCliSpecs = [...imgSpecs, ...vidSpecs, ...audSpecs];
      const cliSpec =
        allCliSpecs.find(
          (s) =>
            s.model === mapped ||
            s.model === rawModel ||
            s.model?.replace(/\./g, '_') === canonical ||
            (s.aliases || []).includes(rawModel)
        ) || null;
      let findData: unknown = null;
      try {
        const res = await this.runCliJson(
          ['model', 'find', mapped, ...(mod ? ['--type', mod] : [])],
          { timeoutMs: 15_000 }
        );
        findData = res.data || res;
      } catch {
        // Ignore optional CLI find error when catalogEntry/cliSpec already matched
      }
      return okToolResult({
        ok: true,
        model: mapped,
        canonicalId: canonical,
        catalogEntry,
        cliSpec,
        data: cliSpec || findData || catalogEntry,
      });
    }

    if (toolName === 'dreamina_model_find') {
      const query = strArg(args.query);
      if (!query) return errToolResult('dreamina_model_find requires a query argument.');
      const mod = strArg(args.modality) as 'image' | 'video' | 'audio' | '';
      const mappedQuery = mapToCliModel(
        query,
        mod || (/(seedance|veo|wan|happyhorse|omni)/.test(query.toLowerCase()) ? 'video' : 'image')
      );
      let res = await this.runCliJson(
        ['model', 'find', query, ...(mod ? ['--type', mod] : [])],
        { timeoutMs: 15_000 }
      );
      const resData = (res.data || {}) as Record<string, unknown>;
      if (resData.matchKind === 'none' && mappedQuery !== query) {
        res = await this.runCliJson(
          ['model', 'find', mappedQuery, ...(mod ? ['--type', mod] : [])],
          { timeoutMs: 15_000 }
        );
      }
      return okToolResult({ ok: true, query, data: res.data || res });
    }

    if (toolName === 'dreamina_voices_list') {
      const cmdArgs = ['voice', 'list'];
      const offset = numArg(args.offset);
      const count = numArg(args.count);
      const model = strArg(args.model);
      if (offset !== undefined) cmdArgs.push('--offset', String(Math.round(offset)));
      if (count !== undefined) cmdArgs.push('--count', String(Math.round(count)));
      if (model) cmdArgs.push('--model', model);
      const res = await this.runCliJson(cmdArgs, { timeoutMs: 20_000 });
      const data = (res.data || {}) as Record<string, unknown>;
      let voices: unknown[] = Array.isArray(data.items)
        ? data.items
        : Array.isArray(data.voices)
          ? data.voices
          : [];
      if (voices.length === 0 && data.models && typeof data.models === 'object') {
        for (const [mKey, mVal] of Object.entries(data.models as Record<string, unknown>)) {
          const items = Array.isArray((mVal as Record<string, unknown> | undefined)?.items)
            ? ((mVal as Record<string, unknown>).items as Array<Record<string, unknown>>)
            : [];
          for (const item of items) {
            voices.push({ model: mKey, ...item });
          }
        }
      }
      return okToolResult({
        ok: true,
        count: voices.length,
        voices,
        data,
      });
    }

    if (
      toolName === 'dreamina_upscale_image' ||
      toolName === 'dreamina_upscale_video' ||
      toolName === 'dreamina_cutout_image' ||
      toolName === 'dreamina_interpolate_video' ||
      toolName === 'dreamina_promote_video_sample'
    ) {
      return await this.executePostEditTool(toolName, args, timeoutMs);
    }

    // 5. Canvas Project Management (4)
    if (toolName === 'dreamina_canvas_list') {
      const cmdArgs = ['canvas', 'ls'];
      const limit = numArg(args.limit);
      const cursor = strArg(args.cursor);
      if (limit !== undefined) cmdArgs.push('--limit', String(Math.round(limit)));
      if (cursor) cmdArgs.push('--cursor', cursor);
      const res = await this.runCliJson(cmdArgs, { timeoutMs: 20_000 });
      return okToolResult({ ok: true, data: res.data || res });
    }

    if (toolName === 'dreamina_canvas_current') {
      const res = await this.runCliJson(['canvas', 'current'], { timeoutMs: 15_000 });
      return okToolResult({ ok: true, data: res.data || res });
    }

    if (toolName === 'dreamina_canvas_use') {
      const pid = strArg(args.project_id);
      if (!pid) return errToolResult('dreamina_canvas_use requires project_id.');
      const res = await this.runCliJson(['canvas', 'use', pid], { timeoutMs: 20_000 });
      const activeCfg = this.getActiveConfig();
      if (activeCfg) {
        activeCfg.projectId = pid;
        activeCfg.updatedAt = new Date().toISOString();
        this.setActiveConfig(activeCfg);
      }
      return okToolResult({ ok: true, projectId: pid, data: res.data || res });
    }

    if (toolName === 'dreamina_canvas_create') {
      const name = strArg(args.name);
      if (!name) return errToolResult('dreamina_canvas_create requires name.');
      const pid = strArg(args.project_id);
      const cmdArgs = [
        'canvas',
        'create',
        name,
        ...(pid ? ['--project-id', pid] : []),
        ...(args.use ? ['--use'] : []),
      ];
      const res = await this.runCliJson(cmdArgs, { timeoutMs: 20_000 });
      const data = (res.data || {}) as Record<string, unknown>;
      const createdPid = String(
        data.projectId || (data.canvas as Record<string, unknown> | undefined)?.projectId || pid || ''
      ).trim();
      const activeCfg = this.getActiveConfig();
      if (args.use && createdPid && activeCfg) {
        activeCfg.projectId = createdPid;
        activeCfg.updatedAt = new Date().toISOString();
        this.setActiveConfig(activeCfg);
      }
      return okToolResult({ ok: true, projectId: createdPid, data });
    }

    // 6. Typed Node Graph CRUD & Quoting (9)
    if (toolName === 'dreamina_node_create' || toolName === 'dreamina_node_edit') {
      const isEdit = toolName === 'dreamina_node_edit';
      const nodeType = strArg(args.type);
      if (!['image', 'video', 'audio', 'element', 'text', 'timeline'].includes(nodeType)) {
        return errToolResult(
          `${toolName} requires type in [image, video, audio, element, text, timeline].`
        );
      }
      const pid = strArg(args.project_id) || (await this.ensureWorkspaceProjectId());
      const nodeId = strArg(args.node_id);
      if (isEdit && !nodeId) {
        return errToolResult('dreamina_node_edit requires node_id.');
      }

      const cmdArgs = [
        'node',
        isEdit ? 'edit' : 'create',
        nodeType,
        '--project-id',
        pid,
        ...(nodeId ? ['--node-id', nodeId] : []),
      ];
      const addStr = (flag: string, val: unknown) => {
        const s = strArg(val);
        if (s) cmdArgs.push(flag, s);
      };
      const addNum = (flag: string, val: unknown) => {
        const n = numArg(val);
        if (n !== undefined) cmdArgs.push(flag, String(Math.round(n)));
      };

      addStr('--title', args.title);
      addStr('--prompt', args.prompt);
      addStr('--mode', args.mode);
      const rawModel = strArg(args.model);
      if (rawModel && (nodeType === 'image' || nodeType === 'video' || nodeType === 'audio')) {
        cmdArgs.push('--model', mapToCliModel(rawModel, nodeType));
      } else if (rawModel) {
        cmdArgs.push('--model', rawModel);
      }
      addStr('--ratio', args.ratio);
      addStr('--resolution', args.resolution);
      addNum('--duration', args.duration);
      addNum('--count', args.count);
      addStr('--resource-id', args.resource_id);
      addStr('--import-kind', args.import_kind);
      addStr('--scenario', args.scenario);
      addStr('--voice-id', args.voice_id);
      addStr('--voice-name', args.voice_name);
      addStr('--text', args.text);
      addStr('--description', args.description);
      addStr('--main', args.main);
      addStr('--voice', args.voice);
      for (const r of strArrayArg(args.refs)) cmdArgs.push('--ref', r);
      for (const a of strArrayArg(args.auxiliary)) cmdArgs.push('--auxiliary', a);
      for (const c of strArrayArg(args.clips)) cmdArgs.push('--clip', c);
      for (const ac of strArrayArg(args.audio_clips)) cmdArgs.push('--audio-clip', ac);
      if (isEdit && args.clear_generation) cmdArgs.push('--clear-generation');
      if (args.run) cmdArgs.push('--run');
      if (args.wait) cmdArgs.push('--wait');
      addNum('--credit-ceiling', args.credit_ceiling);

      const res = await this.runCliJson(cmdArgs, {
        timeoutMs: args.wait ? Math.max(Number(timeoutMs) || 0, 180_000) : 45_000,
      });
      return okToolResult({ ok: true, projectId: pid, data: res.data || res });
    }

    if (toolName === 'dreamina_node_find') {
      const pid = strArg(args.project_id) || (await this.ensureWorkspaceProjectId());
      const cmdArgs = ['node', 'find', '--project-id', pid];
      if (strArg(args.name)) cmdArgs.push('--name', strArg(args.name));
      for (const t of strArrayArg(args.types)) cmdArgs.push('--type', t);
      for (const s of strArrayArg(args.statuses)) cmdArgs.push('--status', s);
      for (const tag of strArrayArg(args.tags)) cmdArgs.push('--tag', tag);
      if (numArg(args.limit) !== undefined) cmdArgs.push('--limit', String(Math.round(numArg(args.limit)!)));
      if (numArg(args.offset) !== undefined) cmdArgs.push('--offset', String(Math.round(numArg(args.offset)!)));
      const res = await this.runCliJson(cmdArgs, { timeoutMs: 25_000 });
      return okToolResult({ ok: true, projectId: pid, data: res.data || res });
    }

    if (
      toolName === 'dreamina_node_show' ||
      toolName === 'dreamina_node_quote' ||
      toolName === 'dreamina_node_confirm' ||
      toolName === 'dreamina_node_run' ||
      toolName === 'dreamina_node_delete_confirm' ||
      toolName === 'dreamina_node_delete_status'
    ) {
      const pid = strArg(args.project_id) || (await this.ensureWorkspaceProjectId());
      const nodeIds = strArrayArg(args.node_ids, args.node_id);
      if (nodeIds.length === 0) {
        return errToolResult(`${toolName} requires node_id or node_ids.`);
      }
      const nodeFlags = nodeIds.flatMap((id) => ['--node-id', id]);

      if (toolName === 'dreamina_node_show') {
        const res = await this.runCliJson(['node', 'show', '--project-id', pid, ...nodeFlags], {
          timeoutMs: 25_000,
        });
        return okToolResult({ ok: true, projectId: pid, data: res.data || res });
      }
      if (toolName === 'dreamina_node_quote') {
        const res = await this.runCliJson(['node', 'quote', '--project-id', pid, ...nodeFlags], {
          timeoutMs: 25_000,
        });
        return okToolResult({ ok: true, projectId: pid, data: res.data || res });
      }
      if (toolName === 'dreamina_node_confirm') {
        const ceiling = Math.max(1, Math.round(numArg(args.credit_ceiling) ?? 500));
        const res = await this.runCliJson(
          ['node', 'confirm', '--project-id', pid, ...nodeFlags, '--credit-ceiling', String(ceiling)],
          { timeoutMs: 25_000 }
        );
        return okToolResult({ ok: true, projectId: pid, data: res.data || res });
      }
      if (toolName === 'dreamina_node_run') {
        const submitId = strArg(args.submit_id) || crypto.randomUUID();
        const creditToken = strArg(args.credit_token);
        const cmdArgs = [
          'node',
          'run',
          '--project-id',
          pid,
          ...nodeFlags,
          '--submit-id',
          submitId,
          ...(creditToken ? ['--credit-token', creditToken] : []),
        ];
        const res = await this.runCliJson(cmdArgs, { timeoutMs: 45_000 });
        const runData = (res.data || {}) as Record<string, unknown>;
        const actualSubmitId = String(runData.submitId || submitId).trim();
        if (args.wait === true && actualSubmitId) {
          await this.runCliJson(
            ['operation', 'wait', actualSubmitId, '--project-id', pid, '--interval', '3s', '--timeout', '300s'],
            { timeoutMs: Math.max(Number(timeoutMs) || 0, 315_000) }
          );
        }
        return okToolResult({ ok: true, projectId: pid, submitId: actualSubmitId, data: runData });
      }
      if (toolName === 'dreamina_node_delete_confirm') {
        const updateId = strArg(args.update_id) || crypto.randomUUID();
        const res = await this.runCliJson(
          ['node', 'delete', 'confirm', '--project-id', pid, ...nodeFlags, '--update-id', updateId],
          { timeoutMs: 25_000 }
        );
        return okToolResult({ ok: true, projectId: pid, updateId, data: res.data || res });
      }
      const updateId = strArg(args.update_id);
      if (!updateId) return errToolResult('dreamina_node_delete_status requires update_id.');
      const res = await this.runCliJson(
        ['node', 'delete', 'status', '--project-id', pid, ...nodeFlags, '--update-id', updateId],
        { timeoutMs: 25_000 }
      );
      return okToolResult({ ok: true, projectId: pid, updateId, data: res.data || res });
    }

    // 7. Resources & Operations (5)
    if (toolName === 'dreamina_resource_upload') {
      const pid = strArg(args.project_id) || (await this.ensureWorkspaceProjectId());
      let filePath = strArg(args.file);
      const sourceUrl = strArg(args.source_url);
      if (!filePath && !sourceUrl) {
        return errToolResult('dreamina_resource_upload requires file or source_url.');
      }
      if (filePath.startsWith('/media/')) {
        filePath = path.join(this.getMediaDir(), path.basename(filePath.replace(/^\/media\//, '')));
      }
      const cmdArgs = [
        'resource',
        'upload',
        '--project-id',
        pid,
        ...(filePath ? ['--file', filePath] : ['--source-url', sourceUrl]),
        ...(strArg(args.type) ? ['--type', strArg(args.type)] : []),
        ...(strArg(args.name) ? ['--name', strArg(args.name)] : []),
        ...(strArg(args.import_kind) ? ['--import-kind', strArg(args.import_kind)] : []),
        ...(strArg(args.resource_id) ? ['--resource-id', strArg(args.resource_id)] : []),
      ];
      const res = await this.runCliJson(cmdArgs, { timeoutMs: 90_000 });
      return okToolResult({ ok: true, projectId: pid, data: res.data || res });
    }

    if (toolName === 'dreamina_resource_get') {
      const resourceId = strArg(args.resource_id);
      if (!resourceId) return errToolResult('dreamina_resource_get requires resource_id.');
      const pid = strArg(args.project_id) || (await this.ensureWorkspaceProjectId());
      const res = await this.runCliJson(['resource', 'get', resourceId, '--project-id', pid], {
        timeoutMs: 25_000,
      });
      return okToolResult({ ok: true, projectId: pid, resourceId, data: res.data || res });
    }

    if (toolName === 'dreamina_resource_download') {
      const resourceId = strArg(args.resource_id);
      if (!resourceId) return errToolResult('dreamina_resource_download requires resource_id.');
      const pid = strArg(args.project_id) || (await this.ensureWorkspaceProjectId());
      const mod = (strArg(args.modality) as 'image' | 'video' | 'audio' | '') || 'image';
      const localUrl = await this.downloadResourceToMediaDir(pid, resourceId, mod);
      return okToolResult({
        ok: true,
        projectId: pid,
        resourceId,
        url: localUrl,
        mediaUrl: localUrl,
        outputs: [localUrl],
        ...(mod === 'video'
          ? { videoUrl: localUrl }
          : mod === 'audio'
            ? { audioUrl: localUrl }
            : { imageUrl: localUrl }),
      });
    }

    if (toolName === 'dreamina_operation_status') {
      const submitId = strArg(args.submit_id);
      if (!submitId) return errToolResult('dreamina_operation_status requires submit_id.');
      const pid = strArg(args.project_id) || (await this.ensureWorkspaceProjectId());
      const res = await this.runCliJson(['operation', 'status', submitId, '--project-id', pid], {
        timeoutMs: 25_000,
      });
      return okToolResult({ ok: true, projectId: pid, submitId, data: res.data || res });
    }

    if (toolName === 'dreamina_operation_wait') {
      const submitId = strArg(args.submit_id);
      if (!submitId) return errToolResult('dreamina_operation_wait requires submit_id.');
      const pid = strArg(args.project_id) || (await this.ensureWorkspaceProjectId());
      const interval = strArg(args.interval) || '3s';
      const timeoutStr = strArg(args.timeout) || '300s';
      const res = await this.runCliJson(
        [
          'operation',
          'wait',
          submitId,
          '--project-id',
          pid,
          '--interval',
          interval,
          '--timeout',
          timeoutStr,
        ],
        { timeoutMs: Math.max(Number(timeoutMs) || 0, 315_000) }
      );
      return okToolResult({ ok: true, projectId: pid, submitId, data: res.data || res });
    }

    // 8. Workflows & Templates (6)
    if (toolName === 'dreamina_workflow_capabilities') {
      const pid = strArg(args.project_id) || (await this.ensureWorkspaceProjectId());
      const res = await this.runCliJson(['workflow', 'capabilities', '--project-id', pid], {
        timeoutMs: 20_000,
      });
      return okToolResult({ ok: true, projectId: pid, data: res.data || res });
    }

    if (toolName === 'dreamina_workflow_list') {
      const pid = strArg(args.project_id) || (await this.ensureWorkspaceProjectId());
      const cmdArgs = [
        'workflow',
        'list',
        '--project-id',
        pid,
        ...(strArg(args.group_node_id) ? ['--group-node-id', strArg(args.group_node_id)] : []),
        ...(strArg(args.cursor) ? ['--cursor', strArg(args.cursor)] : []),
        ...(numArg(args.limit) !== undefined ? ['--limit', String(Math.round(numArg(args.limit)!))] : []),
      ];
      const res = await this.runCliJson(cmdArgs, { timeoutMs: 25_000 });
      return okToolResult({ ok: true, projectId: pid, data: res.data || res });
    }

    if (toolName === 'dreamina_workflow_get') {
      const runId = strArg(args.run_id);
      if (!runId) return errToolResult('dreamina_workflow_get requires run_id.');
      const res = await this.runCliJson(['workflow', 'get', runId], { timeoutMs: 20_000 });
      return okToolResult({ ok: true, runId, data: res.data || res });
    }

    if (toolName === 'dreamina_workflow_quote_and_run') {
      const source = strArg(args.source);
      if (!source) return errToolResult('dreamina_workflow_quote_and_run requires source.');
      const pid = strArg(args.project_id) || (await this.ensureWorkspaceProjectId());
      const quoteArgs = [
        'workflow',
        'quote',
        '--project-id',
        pid,
        '--source',
        source,
        ...(strArg(args.run_kind) ? ['--run-kind', strArg(args.run_kind)] : []),
        ...(strArg(args.group_node_id) ? ['--group-node-id', strArg(args.group_node_id)] : []),
        ...(strArg(args.template_id) ? ['--template-id', strArg(args.template_id)] : []),
        ...(numArg(args.template_version) !== undefined
          ? ['--template-version', String(Math.round(numArg(args.template_version)!))]
          : []),
        ...strArrayArg(args.selected_combo_ids).flatMap((x) => ['--selected-combo-ids', x]),
        ...strArrayArg(args.selected_step_ids).flatMap((x) => ['--selected-step-ids', x]),
        ...strArrayArg(args.from_node_ids).flatMap((x) => ['--from-node-ids', x]),
        ...(args.reuse_unchanged ? ['--reuse-unchanged'] : []),
      ];
      const quoteRes = await this.runCliJson(quoteArgs, { timeoutMs: 45_000 });
      const quoteData = (quoteRes.data || {}) as Record<string, unknown>;
      const quoteId = String(quoteData.quoteId || quoteData.id || '').trim();
      if (!quoteId) {
        throw new Error('workflow quote returned no quoteId.');
      }

      const maxCredits = Math.max(
        1,
        Math.round(numArg(args.max_credits) ?? numArg(args.credit_ceiling) ?? 500)
      );
      const confirmRes = await this.runCliJson(
        ['workflow', 'confirm', '--quote-id', quoteId, '--max-credits', String(maxCredits)],
        { timeoutMs: 30_000 }
      );
      const confirmData = (confirmRes.data || {}) as Record<string, unknown>;
      const creditToken = strArg(confirmData.creditConfirmationToken || confirmData.creditToken);
      const submitId = strArg(args.submit_id) || crypto.randomUUID();
      const runRes = await this.runCliJson(
        [
          'workflow',
          'run',
          '--quote-id',
          quoteId,
          ...(creditToken ? ['--credit-confirmation-token', creditToken] : []),
          '--submit-id',
          submitId,
        ],
        { timeoutMs: 45_000 }
      );
      const runData = (runRes.data || {}) as Record<string, unknown>;
      const runId = String(runData.runId || runData.id || '').trim();
      let finalData = runData;
      if (args.wait !== false && runId) {
        const waitRes = await this.runCliJson(
          ['workflow', 'wait', runId, '--interval', '3s', '--timeout', '300s'],
          { timeoutMs: Math.max(Number(timeoutMs) || 0, 315_000) }
        );
        finalData = (waitRes.data || runData) as Record<string, unknown>;
      }
      return okToolResult({
        ok: true,
        status: args.wait !== false ? 'completed' : 'submitted',
        projectId: pid,
        quoteId,
        runId,
        submitId,
        data: finalData,
      });
    }

    if (toolName === 'dreamina_workflow_cancel') {
      const runId = strArg(args.run_id);
      if (!runId) return errToolResult('dreamina_workflow_cancel requires run_id.');
      const res = await this.runCliJson(['workflow', 'cancel', runId], { timeoutMs: 25_000 });
      return okToolResult({ ok: true, runId, data: res.data || res });
    }

    if (toolName === 'dreamina_workflow_templates') {
      const action = (strArg(args.action) || 'list').toLowerCase();
      if (action === 'get') {
        const templateId = strArg(args.template_id);
        if (!templateId) return errToolResult('dreamina_workflow_templates(get) requires template_id.');
        const ver = numArg(args.version);
        const res = await this.runCliJson(
          ['workflow', 'template', 'get', templateId, ...(ver !== undefined ? ['--version', String(Math.round(ver))] : [])],
          { timeoutMs: 20_000 }
        );
        return okToolResult({ ok: true, action, data: res.data || res });
      }
      if (action === 'instantiation') {
        const instId = strArg(args.instantiate_id);
        if (!instId) return errToolResult('dreamina_workflow_templates(instantiation) requires instantiate_id.');
        const res = await this.runCliJson(['workflow', 'template', 'instantiation', instId], {
          timeoutMs: 20_000,
        });
        return okToolResult({ ok: true, action, data: res.data || res });
      }
      if (action === 'instantiate') {
        const templateId = strArg(args.template_id);
        const ver = numArg(args.version) ?? 1;
        const targetPid =
          strArg(args.target_project_id) || (await this.ensureWorkspaceProjectId());
        if (!templateId) {
          return errToolResult('dreamina_workflow_templates(instantiate) requires template_id.');
        }
        let varsTmpPath = '';
        try {
          if (args.variables && typeof args.variables === 'object') {
            varsTmpPath = path.join(os.tmpdir(), `drm_tpl_vars_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.json`);
            fs.writeFileSync(varsTmpPath, JSON.stringify(args.variables, null, 2));
          }
          const cmdArgs = [
            'workflow',
            'template',
            'instantiate',
            '--template-id',
            templateId,
            '--version',
            String(Math.round(ver)),
            '--target-project-id',
            targetPid,
            ...(numArg(args.anchor_x) !== undefined ? ['--anchor-x', String(numArg(args.anchor_x))] : []),
            ...(numArg(args.anchor_y) !== undefined ? ['--anchor-y', String(numArg(args.anchor_y))] : []),
            ...(varsTmpPath ? ['--variables-file', varsTmpPath] : []),
          ];
          const res = await this.runCliJson(cmdArgs, { timeoutMs: 45_000 });
          return okToolResult({ ok: true, action, targetProjectId: targetPid, data: res.data || res });
        } finally {
          if (varsTmpPath && fs.existsSync(varsTmpPath)) {
            try { fs.unlinkSync(varsTmpPath); } catch { /* ignore */ }
          }
        }
      }
      const cmdArgs = [
        'workflow',
        'template',
        'list',
        ...(strArg(args.scope) ? ['--scope', strArg(args.scope)] : []),
        ...(strArg(args.cursor) ? ['--cursor', strArg(args.cursor)] : []),
        ...(numArg(args.limit) !== undefined ? ['--limit', String(Math.round(numArg(args.limit)!))] : []),
      ];
      const res = await this.runCliJson(cmdArgs, { timeoutMs: 25_000 });
      return okToolResult({ ok: true, action: 'list', data: res.data || res });
    }

    // 9. 3D Director Stage (4)
    if (toolName === 'dreamina_director_catalog') {
      const cmdArgs = [
        'director',
        'catalog',
        ...(strArg(args.kind) ? ['--kind', strArg(args.kind)] : []),
        ...(strArg(args.motion_usage) ? ['--motion-usage', strArg(args.motion_usage)] : []),
        ...(numArg(args.count) !== undefined ? ['--count', String(Math.round(numArg(args.count)!))] : []),
        ...(numArg(args.offset) !== undefined ? ['--offset', String(Math.round(numArg(args.offset)!))] : []),
      ];
      const res = await this.runCliJson(cmdArgs, { timeoutMs: 25_000 });
      return okToolResult({ ok: true, data: res.data || res });
    }

    if (toolName === 'dreamina_director_create') {
      const pid = strArg(args.project_id) || (await this.ensureWorkspaceProjectId());
      const cmdArgs = [
        'director',
        'create',
        '--project-id',
        pid,
        ...(strArg(args.title) ? ['--title', strArg(args.title)] : []),
        ...(strArg(args.file) ? ['--file', strArg(args.file)] : []),
      ];
      const res = await this.runCliJson(cmdArgs, { timeoutMs: 30_000 });
      return okToolResult({ ok: true, projectId: pid, data: res.data || res });
    }

    if (toolName === 'dreamina_director_show') {
      const file = strArg(args.file);
      const pid = file ? strArg(args.project_id) : strArg(args.project_id) || (await this.ensureWorkspaceProjectId());
      const nodeId = strArg(args.node_id);
      const cmdArgs = [
        'director',
        'show',
        ...(pid ? ['--project-id', pid] : []),
        ...(nodeId ? ['--node-id', nodeId] : []),
        ...(file ? ['--file', file] : []),
      ];
      const res = await this.runCliJson(cmdArgs, { timeoutMs: 25_000 });
      return okToolResult({ ok: true, data: res.data || res });
    }

    if (toolName === 'dreamina_director_apply') {
      const rawInput = args.input;
      if (rawInput === undefined || rawInput === null || rawInput === '') {
        return errToolResult('dreamina_director_apply requires input (JSON object or file path).');
      }
      const file = strArg(args.file);
      const pid = file ? strArg(args.project_id) : strArg(args.project_id) || (await this.ensureWorkspaceProjectId());
      const nodeId = strArg(args.node_id);
      let inputPath = '';
      let cleanupTmp = false;
      try {
        if (typeof rawInput === 'string' && fs.existsSync(rawInput.trim())) {
          inputPath = rawInput.trim();
        } else {
          inputPath = path.join(os.tmpdir(), `drm_dir_apply_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.json`);
          const content = typeof rawInput === 'string' ? rawInput : JSON.stringify(rawInput, null, 2);
          fs.writeFileSync(inputPath, content);
          cleanupTmp = true;
        }
        const cmdArgs = [
          'director',
          'apply',
          ...(pid ? ['--project-id', pid] : []),
          ...(nodeId ? ['--node-id', nodeId] : []),
          ...(file ? ['--file', file] : []),
          '--input',
          inputPath,
        ];
        const res = await this.runCliJson(cmdArgs, { timeoutMs: 45_000 });
        return okToolResult({ ok: true, data: res.data || res });
      } finally {
        if (cleanupTmp && inputPath && fs.existsSync(inputPath)) {
          try { fs.unlinkSync(inputPath); } catch { /* ignore */ }
        }
      }
    }

    return null;
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
      const models = await this.getModelsCatalog(modality, Boolean(args.refresh));
      return okToolResult({ ok: true, platformId: 'dreamina', count: models.length, models });
    }

    const extendedResult = await this.executeExtendedCliTool(
      toolName,
      args,
      mapToCliModel,
      timeoutMs
    );
    if (extendedResult) {
      return extendedResult;
    }

    if (toolName === 'dreamina_session_status' || toolName === 'balance') {
      const activeCfg = this.getActiveConfig();
      const [probe, balance] = await Promise.all([
        this.deps.checkBrowserStatus(),
        this.getBalanceInfo(toolName === 'balance'),
      ]);
      const mode = activeCfg?.mode || 'cli_oauth';
      const hasApiKey = Boolean(
        activeCfg?.arkApiKey || process.env.ARK_API_KEY || process.env.SEEDANCE_API_KEY
      );
      const browserHonestlyLoggedIn =
        probe.extensionTabActive || (probe.cdpDreaminaOpen && Boolean(probe.cdpDreaminaLoggedIn));
      const payload = {
        ok: true,
        connected: Boolean(activeCfg?.connected || browserHonestlyLoggedIn || hasApiKey),
        mode,
        profile: this.getActiveProfile(),
        account: balance?.account || activeCfg?.account || 'Dreamina MCP',
        credits: balance?.credits,
        balance: balance?.credits,
        availableCredits: balance?.credits,
        plan:
          balance?.plan ||
          activeCfg?.vipLevel ||
          (mode === 'ark_api_key' ? 'BytePlus ModelArk' : 'Dreamina Subscription'),
        vipLevel: activeCfg?.vipLevel,
        projectId: activeCfg?.projectId,
        cliVersion: activeCfg?.cliVersion,
        browserExtensionActive: probe.extensionTabActive,
        cdpDreaminaOpen: probe.cdpDreaminaOpen,
        cdpDreaminaLoggedIn: Boolean(probe.cdpDreaminaLoggedIn),
        hasArkApiKey: hasApiKey,
        hasSessionCookie: Boolean(activeCfg?.sessionIdCookie),
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
      const activeCfg = this.getActiveConfig();
      if (activeCfg?.mode === 'cli_oauth') {
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
        activeCfg?.arkApiKey || process.env.ARK_API_KEY || process.env.SEEDANCE_API_KEY || ''
      ).trim();

      if (activeCfg?.mode === 'ark_api_key' || effectiveArkKey) {
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
        const arkModel = mapCanonicalDreaminaToArkModel(canonicalModel, activeCfg);
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
      if (activeCfg?.mode === 'browser' && browserHonestlyLoggedIn) {
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
      const activeCfg = this.getActiveConfig();
      if (activeCfg?.mode === 'cli_oauth') {
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
        activeCfg?.arkApiKey || process.env.ARK_API_KEY || process.env.SEEDANCE_API_KEY || ''
      ).trim();

      if (activeCfg?.mode === 'ark_api_key' || effectiveArkKey) {
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
          model: mapCanonicalDreaminaToArkModel(canonicalModel, activeCfg),
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
      if (activeCfg?.mode === 'browser' && browserHonestlyLoggedIn) {
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
      if (this.getActiveConfig()?.mode !== 'cli_oauth') {
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
