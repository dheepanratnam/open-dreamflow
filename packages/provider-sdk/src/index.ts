/**
 * @open-dreamflow/provider-sdk — Unified Zero-Markup Router
 */

export * from './gemini-omni.js';
export * from './seedance.js';
export * from './fal-replicate.js';
export * from './comfyui.js';

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

export type ProviderId =
  | 'gemini-omni'
  | 'seedance'
  | 'fal'
  | 'replicate'
  | 'comfyui'
  | 'chrome-bridge-flow'
  | 'chrome-bridge-dreamina';

export interface DreamFlowProviderCredentials {
  gemini?: string | GeminiOmniClientConfig;
  seedance?: string | SeedanceClientConfig;
  fal?: string | FalClientConfig;
  replicate?: string | ReplicateClientConfig;
  comfyui?: string | ComfyUIClientConfig;
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
    case 'fal':
    case 'replicate':
      rawCost = Number((durationSeconds * 0.028).toFixed(4));
      break;
    case 'comfyui':
    case 'chrome-bridge-flow':
    case 'chrome-bridge-dreamina':
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
