/**
 * @open-dreamflow/provider-sdk — Unified Zero-Markup Multi-Platform Router
 */

export * from './platforms.js';
export * from './gemini-omni.js';
export * from './seedance.js';
export * from './fal-replicate.js';
export * from './comfyui.js';
export * from './providers/reference-utils.js';
export * from './providers/kling.js';
export * from './providers/elevenlabs.js';
export * from './providers/openai.js';
export * from './providers/higgsfield.js';

import {
  GeminiOmniClient,
  type GeminiOmniClientConfig,
  type GeminiOmniGenerateRequest,
  type GeminiMultiTurnEditRequest,
  type GeminiUpscaleRequest,
  type GeminiOmniVideoResult,
  estimateGeminiOmniRawCostUsd,
  type GeminiOmniResolution,
} from './gemini-omni.js';
import {
  SeedanceClient,
  type SeedanceClientConfig,
  type SeedanceSequenceRequest,
  type SeedanceVideoResult,
  type SeedreamInpaintRequest,
  type SeedreamOutpaintRequest,
  type SeedreamContactSheetRequest,
  type SeedreamImageEditResult,
  type SeedreamContactSheetResult,
} from './seedance.js';
import {
  FalClient,
  ReplicateClient,
  type FalClientConfig,
  type ReplicateClientConfig,
  type OpenWeightVideoRequest,
  type OpenWeightVideoResult,
} from './fal-replicate.js';
import {
  ComfyUIClient,
  type ComfyUIClientConfig,
  type ComfyWorkflowBuildOptions,
  type ComfyExecutionResult,
} from './comfyui.js';
import { KlingClient, type KlingClientConfig } from './providers/kling.js';
import { ElevenLabsClient, type ElevenLabsClientConfig } from './providers/elevenlabs.js';
import { OpenAIClient, type OpenAIClientConfig } from './providers/openai.js';
import { HiggsfieldClient, type HiggsfieldClientConfig } from './providers/higgsfield.js';

export type ProviderId =
  | 'gemini-omni'
  | 'seedance'
  | 'fal'
  | 'replicate'
  | 'comfyui'
  | 'kling'
  | 'elevenlabs'
  | 'openai'
  | 'higgsfield'
  | 'chrome-bridge-flow'
  | 'chrome-bridge-dreamina'
  | 'chrome-bridge-higgsfield'
  | 'chrome-bridge-kling'
  | 'chrome-bridge-openart'
  | 'chrome-bridge-imagineart'
  | 'chrome-bridge-elevenlabs';

export interface DreamFlowProviderCredentials {
  gemini?: string | GeminiOmniClientConfig;
  seedance?: string | SeedanceClientConfig;
  fal?: string | FalClientConfig;
  replicate?: string | ReplicateClientConfig;
  comfyui?: string | ComfyUIClientConfig;
  kling?: string | KlingClientConfig;
  elevenlabs?: string | ElevenLabsClientConfig;
  openai?: string | OpenAIClientConfig;
  higgsfield?: string | HiggsfieldClientConfig;
}

export interface ZeroMarkupCostEstimate {
  provider: ProviderId;
  durationSeconds: number;
  resolution: string;
  rawProviderCostUsd: number;
  openDreamFlowMarkupUsd: 0;
  typicalSaasWrapperCostUsd: number;
  savingsPercent: number;
}

export function estimateZeroMarkupCost(params: {
  provider: ProviderId;
  durationSeconds?: number;
  resolution?: GeminiOmniResolution;
}): ZeroMarkupCostEstimate {
  const durationSeconds = params.durationSeconds ?? 8;
  const resolution = params.resolution ?? '1080p';

  let rawCost = 0;
  switch (params.provider) {
    case 'gemini-omni':
      rawCost = estimateGeminiOmniRawCostUsd(durationSeconds, resolution);
      break;
    case 'seedance':
      rawCost = Number((durationSeconds * (resolution === '1080p' ? 0.035 : 0.022)).toFixed(4));
      break;
    case 'kling':
    case 'higgsfield':
      rawCost = Number((durationSeconds * 0.032).toFixed(4));
      break;
    case 'openai':
      rawCost = Number((durationSeconds * 0.05).toFixed(4));
      break;
    case 'elevenlabs':
      rawCost = Number((durationSeconds * 0.008).toFixed(4));
      break;
    case 'fal':
    case 'replicate':
      rawCost = Number((durationSeconds * 0.028).toFixed(4));
      break;
    case 'comfyui':
    case 'chrome-bridge-flow':
    case 'chrome-bridge-dreamina':
    case 'chrome-bridge-higgsfield':
    case 'chrome-bridge-kling':
    case 'chrome-bridge-openart':
    case 'chrome-bridge-imagineart':
    case 'chrome-bridge-elevenlabs':
      rawCost = 0;
      break;
  }

  const typicalWrapper = Number(Math.max(0.35, rawCost * 2.85).toFixed(4));
  const savingsPercent =
    typicalWrapper > 0 ? Math.round(((typicalWrapper - rawCost) / typicalWrapper) * 100) : 100;

  return {
    provider: params.provider,
    durationSeconds,
    resolution,
    rawProviderCostUsd: rawCost,
    openDreamFlowMarkupUsd: 0,
    typicalSaasWrapperCostUsd: typicalWrapper,
    savingsPercent,
  };
}

export class DreamFlowProviderRouter {
  public gemini?: GeminiOmniClient;
  public seedance?: SeedanceClient;
  public fal?: FalClient;
  public replicate?: ReplicateClient;
  public kling?: KlingClient;
  public elevenlabs?: ElevenLabsClient;
  public openai?: OpenAIClient;
  public higgsfield?: HiggsfieldClient;
  public comfyui: ComfyUIClient;

  constructor(credentials: DreamFlowProviderCredentials = {}) {
    if (credentials.gemini) {
      this.gemini =
        typeof credentials.gemini === 'string'
          ? new GeminiOmniClient({ apiKey: credentials.gemini })
          : new GeminiOmniClient(credentials.gemini);
    }
    if (credentials.seedance) {
      this.seedance =
        typeof credentials.seedance === 'string'
          ? new SeedanceClient({ apiKey: credentials.seedance })
          : new SeedanceClient(credentials.seedance);
    }
    if (credentials.fal) {
      this.fal =
        typeof credentials.fal === 'string'
          ? new FalClient({ apiKey: credentials.fal })
          : new FalClient(credentials.fal);
    }
    if (credentials.replicate) {
      this.replicate =
        typeof credentials.replicate === 'string'
          ? new ReplicateClient({ apiToken: credentials.replicate })
          : new ReplicateClient(credentials.replicate);
    }
    if (credentials.kling) {
      this.kling =
        typeof credentials.kling === 'string'
          ? new KlingClient({ apiKey: credentials.kling })
          : new KlingClient(credentials.kling);
    }
    if (credentials.elevenlabs) {
      this.elevenlabs =
        typeof credentials.elevenlabs === 'string'
          ? new ElevenLabsClient({ apiKey: credentials.elevenlabs })
          : new ElevenLabsClient(credentials.elevenlabs);
    }
    if (credentials.openai) {
      this.openai =
        typeof credentials.openai === 'string'
          ? new OpenAIClient({ apiKey: credentials.openai })
          : new OpenAIClient(credentials.openai);
    }
    if (credentials.higgsfield) {
      this.higgsfield =
        typeof credentials.higgsfield === 'string'
          ? new HiggsfieldClient({ apiKey: credentials.higgsfield })
          : new HiggsfieldClient(credentials.higgsfield);
    }
    this.comfyui =
      typeof credentials.comfyui === 'string'
        ? new ComfyUIClient({ baseUrl: credentials.comfyui })
        : new ComfyUIClient(credentials.comfyui);
  }

  public listConfiguredProviders(): ProviderId[] {
    const active: ProviderId[] = ['comfyui'];
    if (this.gemini) active.unshift('gemini-omni');
    if (this.seedance) active.push('seedance');
    if (this.fal) active.push('fal');
    if (this.replicate) active.push('replicate');
    if (this.kling) active.push('kling');
    if (this.elevenlabs) active.push('elevenlabs');
    if (this.openai) active.push('openai');
    if (this.higgsfield) active.push('higgsfield');
    return active;
  }

  public async generateGeminiOmniVideo(
    req: GeminiOmniGenerateRequest
  ): Promise<GeminiOmniVideoResult> {
    if (!this.gemini) throw new Error('Gemini Omni 1.2 Flash is not configured.');
    return this.gemini.generateVideo(req);
  }

  public async branchGeminiOmniVideo(
    req: GeminiMultiTurnEditRequest
  ): Promise<GeminiOmniVideoResult> {
    if (!this.gemini) throw new Error('Gemini Omni 1.2 Flash is not configured.');
    return this.gemini.branchEditVideo(req);
  }

  public async upscaleGeminiOmniTo4K(req: GeminiUpscaleRequest): Promise<GeminiOmniVideoResult> {
    if (!this.gemini) throw new Error('Gemini Omni 1.2 Flash is not configured.');
    return this.gemini.upscaleTo4K(req);
  }

  public async synthesizeSeedanceMultiframe(
    req: SeedanceSequenceRequest
  ): Promise<SeedanceVideoResult> {
    if (!this.seedance) throw new Error('Seedance/Seedream is not configured.');
    return this.seedance.synthesizeKeyframeSequence(req);
  }

  public async smartInpaint(req: SeedreamInpaintRequest): Promise<SeedreamImageEditResult> {
    if (!this.seedance) throw new Error('Seedream Edit is not configured.');
    return this.seedance.smartInpaint(req);
  }

  public async smartOutpaint(req: SeedreamOutpaintRequest): Promise<SeedreamImageEditResult> {
    if (!this.seedance) throw new Error('Seedream Edit is not configured.');
    return this.seedance.smartOutpaint(req);
  }

  public async generateContactSheet(
    req: SeedreamContactSheetRequest
  ): Promise<SeedreamContactSheetResult> {
    if (!this.seedance) throw new Error('Seedream is not configured.');
    return this.seedance.generateContactSheet(req);
  }

  public async generateOpenWeightCloudVideo(
    provider: 'fal' | 'replicate',
    req: OpenWeightVideoRequest
  ): Promise<OpenWeightVideoResult> {
    if (provider === 'fal') {
      if (!this.fal) throw new Error('Fal.ai API key is not configured.');
      return this.fal.generateOpenWeightVideo(req);
    }
    if (!this.replicate) throw new Error('Replicate API token is not configured.');
    return this.replicate.generateOpenWeightVideo(req);
  }

  public async generateLocalComfyVideo(
    opts: ComfyWorkflowBuildOptions
  ): Promise<ComfyExecutionResult> {
    return this.comfyui.generateLocalVideo(opts);
  }
}
