/**
 * @open-dreamflow/provider-sdk — Universal Multi-Platform Creator Catalog
 * Zero-markup model & connection definitions across Browser Credit Bridges,
 * External MCP Servers, Official BYOK REST APIs, and Local GPUs.
 */

import {
  HIGGSFIELD_CANONICAL_MODELS,
  convertRawHiggsfieldCatalog,
  convertRawHiggsfieldModelToPlatformModel,
  type RawHiggsfieldModelSpec,
  type RawHiggsfieldParamSpec,
  type RawHiggsfieldMediaSpec,
} from './higgsfield-catalog.js';
import {
  DREAMINA_CANONICAL_MODELS,
  normalizeDreaminaModelId,
} from './dreamina-catalog.js';

export {
  HIGGSFIELD_CANONICAL_MODELS,
  convertRawHiggsfieldCatalog,
  convertRawHiggsfieldModelToPlatformModel,
  type RawHiggsfieldModelSpec,
  type RawHiggsfieldParamSpec,
  type RawHiggsfieldMediaSpec,
  DREAMINA_CANONICAL_MODELS,
  normalizeDreaminaModelId,
};

export type PlatformId =
  | 'higgsfield'
  | 'sume'
  | 'kling'
  | 'dreamina'
  | 'google-flow'
  | 'openart'
  | 'imagineart'
  | 'elevenlabs'
  | 'openai'
  | 'fal'
  | 'replicate'
  | 'comfyui'
  | 'custom-mcp';

export type ModelModality = 'image' | 'video' | 'audio';

export type ConnectionTransport = 'auto' | 'mcp' | 'browser-bridge' | 'api-key';

export interface ModelParameterSpec {
  name: string;
  label?: string;
  type: 'enum' | 'boolean' | 'number' | 'string';
  options?: Array<string | number>;
  default?: string | number | boolean;
  min?: number;
  max?: number;
  step?: number;
  required?: boolean;
  description?: string;
  inlinePill?: boolean;
}

export interface PlatformModelDefinition {
  id: string;
  label: string;
  modality: ModelModality;
  platformId: PlatformId;
  description?: string;
  providerFamily?: string;
  supportsUnlim?: boolean;
  supportsReferences?: boolean;
  maxReferences?: number;
  supportsStartEndFrames?: boolean;
  supportsNativeAudio?: boolean;
  mediaRoles?: string[];
  aspectRatios?: string[];
  resolutions?: string[];
  durationsSec?: number[];
  defaultAspectRatio?: string;
  defaultResolution?: string;
  defaultDurationSec?: number;
  parameters?: ModelParameterSpec[];
}

export interface PlatformAuthField {
  key: 'apiKey' | 'accessKey' | 'secretKey' | 'baseUrl';
  label: string;
  placeholder: string;
  secret?: boolean;
}

export interface PlatformMcpTemplate {
  name: string;
  transport: 'stdio' | 'http';
  command?: string;
  args?: string[];
  envKeys?: string[];
  urlPlaceholder?: string;
}

export interface PlatformDefinition {
  id: PlatformId;
  name: string;
  shortName: string;
  websiteUrl: string;
  creatorStudioUrl: string;
  apiKeysUrl?: string;
  description: string;
  modalities: ModelModality[];
  supportedTransports: Exclude<ConnectionTransport, 'auto'>[];
  preferredTransport: Exclude<ConnectionTransport, 'auto'>;
  browserBridgeSupported: boolean;
  apiKeySupported: boolean;
  authFields: PlatformAuthField[];
  mcpTemplate?: PlatformMcpTemplate;
  models: PlatformModelDefinition[];
}

export const BROWSER_BRIDGE_PLATFORM_IDS = [
  'dreamina',
  'google-flow',
  'higgsfield',
  'sume',
  'kling',
  'openart',
  'imagineart',
  'elevenlabs',
] as const;

export type BrowserBridgePlatformId = (typeof BROWSER_BRIDGE_PLATFORM_IDS)[number];

const COMMON_IMAGE_RATIOS = ['1:1', '16:9', '9:16', '4:3', '3:4', '21:9'];
const COMMON_IMAGE_RESOLUTIONS = ['1K', '2K', '4K'];
const COMMON_VIDEO_RATIOS = ['16:9', '9:16', '1:1', '21:9'];
const COMMON_VIDEO_RESOLUTIONS = ['720p', '1080p', '4K'];
const COMMON_VIDEO_DURATIONS = [5, 8, 10, 15];

export const PLATFORM_CATALOG: PlatformDefinition[] = [
  {
    id: 'higgsfield',
    name: 'Higgsfield',
    shortName: 'Higgsfield',
    websiteUrl: 'https://higgsfield.ai',
    creatorStudioUrl: 'https://higgsfield.ai/create',
    apiKeysUrl: 'https://cloud.higgsfield.ai',
    description:
      'Use your Higgsfield creator credits via Chrome Credit Bridge, MCP server, or Higgsfield Cloud API.',
    modalities: ['image', 'video', 'audio'],
    supportedTransports: ['browser-bridge', 'mcp', 'api-key'],
    preferredTransport: 'browser-bridge',
    browserBridgeSupported: true,
    apiKeySupported: true,
    authFields: [
      {
        key: 'apiKey',
        label: 'Higgsfield API Key',
        placeholder: 'hf_live_...',
        secret: true,
      },
      {
        key: 'secretKey',
        label: 'API Secret (Optional)',
        placeholder: 'hf_secret_...',
        secret: true,
      },
    ],
    models: HIGGSFIELD_CANONICAL_MODELS,
  },
  {
    id: 'sume',
    name: 'Sume',
    shortName: 'Sume',
    websiteUrl: 'https://sume.com',
    creatorStudioUrl: 'https://sume.com',
    apiKeysUrl: 'https://sume.com',
    description:
      'Zero-markup pay-as-you-go creative wallet (365-day non-expiring credits) via Chrome Credit Bridge, MCP, or API Key.',
    modalities: ['image', 'video'],
    supportedTransports: ['browser-bridge', 'mcp', 'api-key'],
    preferredTransport: 'browser-bridge',
    browserBridgeSupported: true,
    apiKeySupported: true,
    authFields: [
      {
        key: 'apiKey',
        label: 'Sume API Key (Optional if using Browser Session)',
        placeholder: 'sume_...',
        secret: true,
      },
    ],
    models: [
      {
        id: 'sume-chatgpt-image',
        label: 'ChatGPT Image 2.6',
        modality: 'image',
        platformId: 'sume',
        supportsReferences: true,
        maxReferences: 6,
        aspectRatios: COMMON_IMAGE_RATIOS,
        resolutions: COMMON_IMAGE_RESOLUTIONS,
        defaultAspectRatio: '16:9',
        defaultResolution: '2K',
      },
      {
        id: 'sume-flux-pro',
        label: 'Flux.1 Pro',
        modality: 'image',
        platformId: 'sume',
        supportsReferences: true,
        maxReferences: 4,
        aspectRatios: COMMON_IMAGE_RATIOS,
        resolutions: COMMON_IMAGE_RESOLUTIONS,
        defaultAspectRatio: '16:9',
        defaultResolution: '2K',
      },
      {
        id: 'sume-seedance-2.5',
        label: 'Seedance 2.5',
        modality: 'video',
        platformId: 'sume',
        supportsReferences: true,
        maxReferences: 6,
        supportsStartEndFrames: true,
        supportsNativeAudio: true,
        aspectRatios: COMMON_VIDEO_RATIOS,
        resolutions: COMMON_VIDEO_RESOLUTIONS,
        durationsSec: COMMON_VIDEO_DURATIONS,
        defaultAspectRatio: '16:9',
        defaultResolution: '1080p',
        defaultDurationSec: 5,
      },
      {
        id: 'sume-kling-4.0',
        label: 'Kling 4.0',
        modality: 'video',
        platformId: 'sume',
        supportsReferences: true,
        maxReferences: 4,
        supportsStartEndFrames: true,
        supportsNativeAudio: true,
        aspectRatios: COMMON_VIDEO_RATIOS,
        resolutions: COMMON_VIDEO_RESOLUTIONS,
        durationsSec: COMMON_VIDEO_DURATIONS,
        defaultAspectRatio: '16:9',
        defaultResolution: '1080p',
        defaultDurationSec: 5,
      },
    ],
  },
  {
    id: 'kling',
    name: 'Kling AI',
    shortName: 'Kling AI',
    websiteUrl: 'https://app.klingai.com',
    creatorStudioUrl: 'https://app.klingai.com/global/image-to-video/frame-mode',
    apiKeysUrl: 'https://app.klingai.com/global/dev',
    description:
      'Chain upstream canvas images directly into Kling 4.0 / 3.0 Master via Browser Credits, MCP, or Kling Access+Secret JWT API.',
    modalities: ['video', 'image'],
    supportedTransports: ['browser-bridge', 'mcp', 'api-key'],
    preferredTransport: 'browser-bridge',
    browserBridgeSupported: true,
    apiKeySupported: true,
    authFields: [
      {
        key: 'accessKey',
        label: 'Kling Access Key (or Bearer Token)',
        placeholder: 'ak_...',
        secret: false,
      },
      {
        key: 'secretKey',
        label: 'Kling Secret Key',
        placeholder: 'sk_...',
        secret: true,
      },
    ],
    models: [
      {
        id: 'kling-4.0',
        label: 'Kling 4.0',
        modality: 'video',
        platformId: 'kling',
        supportsReferences: true,
        maxReferences: 4,
        supportsStartEndFrames: true,
        supportsNativeAudio: true,
        aspectRatios: COMMON_VIDEO_RATIOS,
        resolutions: COMMON_VIDEO_RESOLUTIONS,
        durationsSec: [5, 10, 15],
        defaultAspectRatio: '16:9',
        defaultResolution: '1080p',
        defaultDurationSec: 5,
      },
      {
        id: 'kling-3.0-master',
        label: 'Kling 3.0 Master',
        modality: 'video',
        platformId: 'kling',
        supportsReferences: true,
        maxReferences: 4,
        supportsStartEndFrames: true,
        supportsNativeAudio: true,
        aspectRatios: COMMON_VIDEO_RATIOS,
        resolutions: COMMON_VIDEO_RESOLUTIONS,
        durationsSec: [5, 10],
        defaultAspectRatio: '16:9',
        defaultResolution: '1080p',
        defaultDurationSec: 5,
      },
      {
        id: 'kling-2.6-pro',
        label: 'Kling 2.6 Pro',
        modality: 'video',
        platformId: 'kling',
        supportsReferences: true,
        maxReferences: 2,
        supportsStartEndFrames: true,
        supportsNativeAudio: true,
        aspectRatios: COMMON_VIDEO_RATIOS,
        resolutions: ['720p', '1080p'],
        durationsSec: [5, 10],
        defaultAspectRatio: '16:9',
        defaultResolution: '1080p',
        defaultDurationSec: 5,
      },
      {
        id: 'kling-elements',
        label: 'Kling Multi-Element Ref',
        modality: 'video',
        platformId: 'kling',
        supportsReferences: true,
        maxReferences: 4,
        supportsStartEndFrames: false,
        supportsNativeAudio: true,
        aspectRatios: COMMON_VIDEO_RATIOS,
        resolutions: ['720p', '1080p'],
        durationsSec: [5, 10],
        defaultAspectRatio: '16:9',
        defaultResolution: '1080p',
        defaultDurationSec: 5,
      },
      {
        id: 'kolors-2.0',
        label: 'Kolors 2.0',
        modality: 'image',
        platformId: 'kling',
        supportsReferences: true,
        maxReferences: 4,
        aspectRatios: COMMON_IMAGE_RATIOS,
        resolutions: ['1K', '2K'],
        defaultAspectRatio: '16:9',
        defaultResolution: '2K',
      },
      {
        id: 'kling-image-o1',
        label: 'Kling Image O1',
        modality: 'image',
        platformId: 'kling',
        supportsReferences: true,
        maxReferences: 4,
        aspectRatios: COMMON_IMAGE_RATIOS,
        resolutions: COMMON_IMAGE_RESOLUTIONS,
        defaultAspectRatio: '16:9',
        defaultResolution: '2K',
      },
    ],
  },
  {
    id: 'dreamina',
    name: 'Dreamina',
    shortName: 'Dreamina',
    websiteUrl: 'https://dreamina.capcut.com',
    creatorStudioUrl: 'https://dreamina.capcut.com/ai-tool/home',
    description:
      'Spend Dreamina MCP / subscription browser credits (Seedream 5.5, Seedance 2.5, OmniHuman 1.5) or BytePlus ModelArk API.',
    modalities: ['image', 'video'],
    supportedTransports: ['mcp', 'browser-bridge', 'api-key'],
    preferredTransport: 'mcp',
    browserBridgeSupported: true,
    apiKeySupported: true,
    authFields: [
      {
        key: 'apiKey',
        label: 'BytePlus / Ark API Key',
        placeholder: 'ark-...',
        secret: true,
      },
    ],
    models: DREAMINA_CANONICAL_MODELS,
  },
  {
    id: 'google-flow',
    name: 'Google Flow',
    shortName: 'Google Flow',
    websiteUrl: 'https://labs.google/fx/tools/flow',
    creatorStudioUrl: 'https://labs.google/fx/tools/flow',
    apiKeysUrl: 'https://aistudio.google.com/apikey',
    description:
      'Use Google AI Ultra / Flow browser credits or direct Google AI Studio API Key (Veo 3.1, Imagen 4, Nano Banana 2).',
    modalities: ['image', 'video'],
    supportedTransports: ['browser-bridge', 'api-key', 'mcp'],
    preferredTransport: 'api-key',
    browserBridgeSupported: true,
    apiKeySupported: true,
    authFields: [
      {
        key: 'apiKey',
        label: 'Google AI Studio / Gemini API Key',
        placeholder: 'AIzaSy...',
        secret: true,
      },
    ],
    models: [
      {
        id: 'imagen-4.0-generate-001',
        label: 'Imagen 4',
        modality: 'image',
        platformId: 'google-flow',
        supportsReferences: false,
        maxReferences: 0,
        aspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:4'],
        resolutions: ['1K', '2K'],
        defaultAspectRatio: '16:9',
        defaultResolution: '2K',
      },
      {
        id: 'gemini-3.1-flash-image-preview',
        label: 'Nano Banana 2 (Gemini Flash Image)',
        modality: 'image',
        platformId: 'google-flow',
        supportsReferences: true,
        maxReferences: 6,
        aspectRatios: COMMON_IMAGE_RATIOS,
        resolutions: COMMON_IMAGE_RESOLUTIONS,
        defaultAspectRatio: '16:9',
        defaultResolution: '2K',
      },
      {
        id: 'veo-3.1-generate-preview',
        label: 'Veo 3.1 Quality',
        modality: 'video',
        platformId: 'google-flow',
        supportsReferences: true,
        maxReferences: 2,
        supportsStartEndFrames: true,
        supportsNativeAudio: true,
        aspectRatios: ['16:9', '9:16'],
        resolutions: ['720p', '1080p', '4K'],
        durationsSec: [4, 6, 8],
        defaultAspectRatio: '16:9',
        defaultResolution: '1080p',
        defaultDurationSec: 8,
      },
      {
        id: 'veo-3.1-fast-generate-preview',
        label: 'Veo 3.1 Fast',
        modality: 'video',
        platformId: 'google-flow',
        supportsReferences: true,
        maxReferences: 2,
        supportsStartEndFrames: true,
        supportsNativeAudio: true,
        aspectRatios: ['16:9', '9:16'],
        resolutions: ['720p', '1080p'],
        durationsSec: [4, 6, 8],
        defaultAspectRatio: '16:9',
        defaultResolution: '1080p',
        defaultDurationSec: 6,
      },
    ],
  },
  {
    id: 'openart',
    name: 'OpenArt',
    shortName: 'OpenArt',
    websiteUrl: 'https://openart.ai',
    creatorStudioUrl: 'https://openart.ai/create',
    description:
      'Use your OpenArt subscription credits via Chrome Credit Bridge or connected MCP server.',
    modalities: ['image', 'video'],
    supportedTransports: ['browser-bridge', 'mcp', 'api-key'],
    preferredTransport: 'browser-bridge',
    browserBridgeSupported: true,
    apiKeySupported: true,
    authFields: [
      {
        key: 'apiKey',
        label: 'OpenArt API Key (Optional if using Browser Bridge)',
        placeholder: 'oa_...',
        secret: true,
      },
    ],
    models: [
      {
        id: 'openart-chatgpt-2.6',
        label: 'ChatGPT Image 2.6',
        modality: 'image',
        platformId: 'openart',
        supportsReferences: true,
        maxReferences: 4,
        aspectRatios: COMMON_IMAGE_RATIOS,
        resolutions: COMMON_IMAGE_RESOLUTIONS,
        defaultAspectRatio: '16:9',
        defaultResolution: '2K',
      },
      {
        id: 'openart-photoreal',
        label: 'OpenArt Photoreal',
        modality: 'image',
        platformId: 'openart',
        supportsReferences: true,
        maxReferences: 4,
        aspectRatios: COMMON_IMAGE_RATIOS,
        resolutions: COMMON_IMAGE_RESOLUTIONS,
        defaultAspectRatio: '16:9',
        defaultResolution: '2K',
      },
      {
        id: 'openart-flux-dev',
        label: 'Flux Dev',
        modality: 'image',
        platformId: 'openart',
        supportsReferences: true,
        maxReferences: 4,
        aspectRatios: COMMON_IMAGE_RATIOS,
        resolutions: COMMON_IMAGE_RESOLUTIONS,
        defaultAspectRatio: '16:9',
        defaultResolution: '2K',
      },
      {
        id: 'openart-kling-4.0',
        label: 'Kling 4.0',
        modality: 'video',
        platformId: 'openart',
        supportsReferences: true,
        maxReferences: 2,
        supportsStartEndFrames: true,
        supportsNativeAudio: true,
        aspectRatios: COMMON_VIDEO_RATIOS,
        resolutions: COMMON_VIDEO_RESOLUTIONS,
        durationsSec: [5, 10],
        defaultAspectRatio: '16:9',
        defaultResolution: '1080p',
        defaultDurationSec: 5,
      },
      {
        id: 'openart-wan-2.6',
        label: 'Wan 2.6',
        modality: 'video',
        platformId: 'openart',
        supportsReferences: true,
        maxReferences: 2,
        supportsStartEndFrames: true,
        supportsNativeAudio: true,
        aspectRatios: COMMON_VIDEO_RATIOS,
        resolutions: COMMON_VIDEO_RESOLUTIONS,
        durationsSec: [5, 10],
        defaultAspectRatio: '16:9',
        defaultResolution: '1080p',
        defaultDurationSec: 5,
      },
    ],
  },
  {
    id: 'imagineart',
    name: 'ImagineArt',
    shortName: 'ImagineArt',
    websiteUrl: 'https://imagine.art',
    creatorStudioUrl: 'https://www.imagine.art/dashboard',
    description:
      'Use ImagineArt creator credits via Chrome Credit Bridge, Vyro Imagine API Key, or MCP.',
    modalities: ['image', 'video'],
    supportedTransports: ['browser-bridge', 'mcp', 'api-key'],
    preferredTransport: 'browser-bridge',
    browserBridgeSupported: true,
    apiKeySupported: true,
    authFields: [
      {
        key: 'apiKey',
        label: 'ImagineArt / Vyro API Token',
        placeholder: 'vk-...',
        secret: true,
      },
    ],
    models: [
      {
        id: 'imagine-v2',
        label: 'Imagine V2',
        modality: 'image',
        platformId: 'imagineart',
        supportsReferences: true,
        maxReferences: 4,
        aspectRatios: COMMON_IMAGE_RATIOS,
        resolutions: COMMON_IMAGE_RESOLUTIONS,
        defaultAspectRatio: '16:9',
        defaultResolution: '2K',
      },
      {
        id: 'imagine-flux-realism',
        label: 'Flux Realism',
        modality: 'image',
        platformId: 'imagineart',
        supportsReferences: true,
        maxReferences: 2,
        aspectRatios: COMMON_IMAGE_RATIOS,
        resolutions: COMMON_IMAGE_RESOLUTIONS,
        defaultAspectRatio: '16:9',
        defaultResolution: '2K',
      },
      {
        id: 'imagine-ideogram-3',
        label: 'Ideogram 3',
        modality: 'image',
        platformId: 'imagineart',
        supportsReferences: true,
        maxReferences: 2,
        aspectRatios: COMMON_IMAGE_RATIOS,
        resolutions: COMMON_IMAGE_RESOLUTIONS,
        defaultAspectRatio: '16:9',
        defaultResolution: '2K',
      },
      {
        id: 'imagine-video-2.0',
        label: 'Imagine Video 2.0',
        modality: 'video',
        platformId: 'imagineart',
        supportsReferences: true,
        maxReferences: 2,
        supportsStartEndFrames: true,
        supportsNativeAudio: true,
        aspectRatios: COMMON_VIDEO_RATIOS,
        resolutions: ['720p', '1080p'],
        durationsSec: [5, 8],
        defaultAspectRatio: '16:9',
        defaultResolution: '1080p',
        defaultDurationSec: 5,
      },
      {
        id: 'imagine-hailuo-02',
        label: 'Hailuo 02',
        modality: 'video',
        platformId: 'imagineart',
        supportsReferences: true,
        maxReferences: 2,
        supportsStartEndFrames: false,
        supportsNativeAudio: false,
        aspectRatios: COMMON_VIDEO_RATIOS,
        resolutions: ['720p', '1080p'],
        durationsSec: [6, 10],
        defaultAspectRatio: '16:9',
        defaultResolution: '1080p',
        defaultDurationSec: 6,
      },
    ],
  },
  {
    id: 'elevenlabs',
    name: 'ElevenLabs',
    shortName: 'ElevenLabs',
    websiteUrl: 'https://elevenlabs.io',
    creatorStudioUrl: 'https://elevenlabs.io/app/speech-synthesis/text-to-speech',
    apiKeysUrl: 'https://elevenlabs.io/app/settings/api-keys',
    description:
      'Generate studio Voice TTS and Cinema Sound Effects via Official ElevenLabs API, @elevenlabs/elevenlabs-mcp, or Browser Bridge.',
    modalities: ['audio'],
    supportedTransports: ['api-key', 'mcp', 'browser-bridge'],
    preferredTransport: 'api-key',
    browserBridgeSupported: true,
    apiKeySupported: true,
    authFields: [
      {
        key: 'apiKey',
        label: 'ElevenLabs xi-api-key',
        placeholder: 'sk_...',
        secret: true,
      },
    ],
    mcpTemplate: {
      name: 'ElevenLabs Official MCP',
      transport: 'stdio',
      command: 'npx',
      args: ['-y', '@elevenlabs/elevenlabs-mcp'],
      envKeys: ['ELEVENLABS_API_KEY'],
    },
    models: [
      {
        id: 'eleven_multilingual_v2',
        label: 'Eleven Multilingual v2 (Voice TTS)',
        modality: 'audio',
        platformId: 'elevenlabs',
        durationsSec: [5, 10, 15, 30],
        defaultDurationSec: 8,
      },
      {
        id: 'eleven_text_to_sound_v2',
        label: 'Eleven Sound Effects v2 (SFX)',
        modality: 'audio',
        platformId: 'elevenlabs',
        durationsSec: [4, 8, 12, 16, 22],
        defaultDurationSec: 8,
      },
      {
        id: 'eleven_flash_v2_5',
        label: 'Eleven Flash v2.5',
        modality: 'audio',
        platformId: 'elevenlabs',
        durationsSec: [5, 10, 15, 30],
        defaultDurationSec: 8,
      },
    ],
  },
  {
    id: 'openai',
    name: 'OpenAI Direct',
    shortName: 'OpenAI',
    websiteUrl: 'https://platform.openai.com',
    creatorStudioUrl: 'https://platform.openai.com',
    apiKeysUrl: 'https://platform.openai.com/api-keys',
    description: 'Direct zero-markup OpenAI REST API for GPT-Image-1 and Sora 2.',
    modalities: ['image', 'video'],
    supportedTransports: ['api-key', 'mcp'],
    preferredTransport: 'api-key',
    browserBridgeSupported: false,
    apiKeySupported: true,
    authFields: [
      {
        key: 'apiKey',
        label: 'OpenAI API Key',
        placeholder: 'sk-proj-...',
        secret: true,
      },
    ],
    models: [
      {
        id: 'gpt-image-1.5',
        label: 'GPT Image 1.5',
        modality: 'image',
        platformId: 'openai',
        providerFamily: 'OpenAI',
        supportsReferences: true,
        maxReferences: 4,
        aspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:4'],
        resolutions: ['1K', '2K'],
        defaultAspectRatio: '16:9',
        defaultResolution: '2K',
        parameters: [
          {
            name: 'quality',
            label: 'Quality',
            type: 'enum',
            options: ['auto', 'low', 'medium', 'high'],
            default: 'high',
            inlinePill: true,
          },
          {
            name: 'background',
            label: 'Background',
            type: 'enum',
            options: ['auto', 'opaque', 'transparent'],
            default: 'auto',
            inlinePill: true,
          },
          {
            name: 'output_format',
            label: 'Output Format',
            type: 'enum',
            options: ['png', 'jpeg', 'webp'],
            default: 'png',
            inlinePill: true,
          },
        ],
      },
      {
        id: 'gpt-image-1',
        label: 'GPT Image 1',
        modality: 'image',
        platformId: 'openai',
        providerFamily: 'OpenAI',
        supportsReferences: true,
        maxReferences: 4,
        aspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:4'],
        resolutions: ['1K', '2K'],
        defaultAspectRatio: '16:9',
        defaultResolution: '2K',
        parameters: [
          {
            name: 'quality',
            label: 'Quality',
            type: 'enum',
            options: ['auto', 'low', 'medium', 'high'],
            default: 'high',
            inlinePill: true,
          },
          {
            name: 'background',
            label: 'Background',
            type: 'enum',
            options: ['auto', 'opaque', 'transparent'],
            default: 'auto',
            inlinePill: true,
          },
          {
            name: 'output_format',
            label: 'Output Format',
            type: 'enum',
            options: ['png', 'jpeg', 'webp'],
            default: 'png',
            inlinePill: true,
          },
        ],
      },
      {
        id: 'gpt-image-1-mini',
        label: 'GPT Image 1 Mini',
        modality: 'image',
        platformId: 'openai',
        providerFamily: 'OpenAI',
        supportsReferences: true,
        maxReferences: 4,
        aspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:4'],
        resolutions: ['1K', '2K'],
        defaultAspectRatio: '16:9',
        defaultResolution: '1K',
        parameters: [
          {
            name: 'quality',
            label: 'Quality',
            type: 'enum',
            options: ['auto', 'low', 'medium', 'high'],
            default: 'high',
            inlinePill: true,
          },
          {
            name: 'background',
            label: 'Background',
            type: 'enum',
            options: ['auto', 'opaque', 'transparent'],
            default: 'auto',
            inlinePill: true,
          },
          {
            name: 'output_format',
            label: 'Output Format',
            type: 'enum',
            options: ['png', 'jpeg', 'webp'],
            default: 'png',
            inlinePill: true,
          },
        ],
      },
      {
        id: 'dall-e-3',
        label: 'DALL·E 3',
        modality: 'image',
        platformId: 'openai',
        providerFamily: 'OpenAI',
        supportsReferences: false,
        maxReferences: 0,
        aspectRatios: ['1:1', '16:9', '9:16'],
        resolutions: ['1K', '2K'],
        defaultAspectRatio: '16:9',
        defaultResolution: '2K',
        parameters: [
          {
            name: 'quality',
            label: 'Quality',
            type: 'enum',
            options: ['standard', 'hd'],
            default: 'hd',
            inlinePill: true,
          },
        ],
      },
      {
        id: 'sora-2',
        label: 'Sora 2',
        modality: 'video',
        platformId: 'openai',
        providerFamily: 'OpenAI',
        supportsReferences: true,
        maxReferences: 1,
        supportsStartEndFrames: false,
        supportsNativeAudio: true,
        aspectRatios: ['16:9', '9:16', '1:1'],
        resolutions: ['720p', '1080p'],
        durationsSec: [4, 8, 12],
        defaultAspectRatio: '16:9',
        defaultResolution: '1080p',
        defaultDurationSec: 8,
      },
      {
        id: 'sora-2-pro',
        label: 'Sora 2 Pro',
        modality: 'video',
        platformId: 'openai',
        providerFamily: 'OpenAI',
        supportsReferences: true,
        maxReferences: 1,
        supportsStartEndFrames: false,
        supportsNativeAudio: true,
        aspectRatios: ['16:9', '9:16', '1:1'],
        resolutions: ['720p', '1080p'],
        durationsSec: [4, 8, 12],
        defaultAspectRatio: '16:9',
        defaultResolution: '1080p',
        defaultDurationSec: 8,
      },
    ],
  },
  {
    id: 'fal',
    name: 'Fal.ai',
    shortName: 'Fal.ai',
    websiteUrl: 'https://fal.ai',
    creatorStudioUrl: 'https://fal.ai/models',
    apiKeysUrl: 'https://fal.ai/dashboard/keys',
    description: 'Direct zero-markup Fal.ai queue pass-through for Flux, Recraft, Kling, and Veo.',
    modalities: ['image', 'video'],
    supportedTransports: ['api-key', 'mcp'],
    preferredTransport: 'api-key',
    browserBridgeSupported: false,
    apiKeySupported: true,
    authFields: [
      {
        key: 'apiKey',
        label: 'Fal.ai Key (key_id:key_secret)',
        placeholder: 'fal_key_...',
        secret: true,
      },
    ],
    models: [
      {
        id: 'fal-ai/flux-pro/v1.1',
        label: 'Flux 1.1 Pro',
        modality: 'image',
        platformId: 'fal',
        supportsReferences: true,
        maxReferences: 1,
        aspectRatios: COMMON_IMAGE_RATIOS,
        resolutions: ['1K', '2K'],
        defaultAspectRatio: '16:9',
        defaultResolution: '2K',
      },
      {
        id: 'fal-ai/recraft-v3',
        label: 'Recraft V3',
        modality: 'image',
        platformId: 'fal',
        supportsReferences: false,
        maxReferences: 0,
        aspectRatios: COMMON_IMAGE_RATIOS,
        resolutions: ['1K', '2K'],
        defaultAspectRatio: '16:9',
        defaultResolution: '2K',
      },
      {
        id: 'fal-ai/kling-video/v2/master/image-to-video',
        label: 'Kling Master I2V',
        modality: 'video',
        platformId: 'fal',
        supportsReferences: true,
        maxReferences: 2,
        supportsStartEndFrames: true,
        supportsNativeAudio: false,
        aspectRatios: ['16:9', '9:16', '1:1'],
        resolutions: ['720p', '1080p'],
        durationsSec: [5, 10],
        defaultAspectRatio: '16:9',
        defaultResolution: '1080p',
        defaultDurationSec: 5,
      },
      {
        id: 'fal-ai/veo3',
        label: 'Veo 3',
        modality: 'video',
        platformId: 'fal',
        supportsReferences: true,
        maxReferences: 1,
        supportsStartEndFrames: false,
        supportsNativeAudio: true,
        aspectRatios: ['16:9', '9:16'],
        resolutions: ['720p', '1080p'],
        durationsSec: [5, 8],
        defaultAspectRatio: '16:9',
        defaultResolution: '1080p',
        defaultDurationSec: 8,
      },
    ],
  },
  {
    id: 'replicate',
    name: 'Replicate',
    shortName: 'Replicate',
    websiteUrl: 'https://replicate.com',
    creatorStudioUrl: 'https://replicate.com/explore',
    apiKeysUrl: 'https://replicate.com/account/api-tokens',
    description: 'Direct zero-markup Replicate predictions API for Flux 1.1 Pro and Kling v2.0.',
    modalities: ['image', 'video'],
    supportedTransports: ['api-key', 'mcp'],
    preferredTransport: 'api-key',
    browserBridgeSupported: false,
    apiKeySupported: true,
    authFields: [
      {
        key: 'apiKey',
        label: 'Replicate API Token',
        placeholder: 'r8_...',
        secret: true,
      },
    ],
    models: [
      {
        id: 'black-forest-labs/flux-1.1-pro',
        label: 'Flux 1.1 Pro',
        modality: 'image',
        platformId: 'replicate',
        supportsReferences: true,
        maxReferences: 1,
        aspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:4', '21:9'],
        resolutions: ['1K', '2K'],
        defaultAspectRatio: '16:9',
        defaultResolution: '2K',
      },
      {
        id: 'kwaivgi/kling-v2.0',
        label: 'Kling v2.0',
        modality: 'video',
        platformId: 'replicate',
        supportsReferences: true,
        maxReferences: 1,
        supportsStartEndFrames: true,
        supportsNativeAudio: false,
        aspectRatios: ['16:9', '9:16', '1:1'],
        resolutions: ['720p', '1080p'],
        durationsSec: [5, 10],
        defaultAspectRatio: '16:9',
        defaultResolution: '1080p',
        defaultDurationSec: 5,
      },
    ],
  },
  {
    id: 'comfyui',
    name: 'ComfyUI Local GPU',
    shortName: 'ComfyUI',
    websiteUrl: 'http://127.0.0.1:8188',
    creatorStudioUrl: 'http://127.0.0.1:8188',
    description: 'Zero-cost local GPU execution against a running ComfyUI server on :8188.',
    modalities: ['image', 'video'],
    supportedTransports: ['api-key', 'mcp'],
    preferredTransport: 'api-key',
    browserBridgeSupported: false,
    apiKeySupported: true,
    authFields: [
      {
        key: 'baseUrl',
        label: 'ComfyUI Server URL',
        placeholder: 'http://127.0.0.1:8188',
        secret: false,
      },
    ],
    models: [
      {
        id: 'flux-dev-local',
        label: 'Local Flux / SDXL',
        modality: 'image',
        platformId: 'comfyui',
        supportsReferences: true,
        maxReferences: 2,
        aspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:4'],
        resolutions: ['1K', '2K'],
        defaultAspectRatio: '16:9',
        defaultResolution: '1K',
      },
      {
        id: 'wan-i2v-local',
        label: 'Local Wan 2.6 I2V',
        modality: 'video',
        platformId: 'comfyui',
        supportsReferences: true,
        maxReferences: 2,
        supportsStartEndFrames: true,
        supportsNativeAudio: false,
        aspectRatios: ['16:9', '9:16', '1:1'],
        resolutions: ['720p', '1080p'],
        durationsSec: [4, 5, 8],
        defaultAspectRatio: '16:9',
        defaultResolution: '720p',
        defaultDurationSec: 5,
      },
    ],
  },
  {
    id: 'custom-mcp',
    name: 'Custom MCP Server',
    shortName: 'Custom MCP',
    websiteUrl: 'https://modelcontextprotocol.io',
    creatorStudioUrl: 'http://127.0.0.1:3001/mcp',
    description:
      'Connect any Stdio or Streamable HTTP MCP server to expose your own credit tools as native canvas models.',
    modalities: ['image', 'video', 'audio'],
    supportedTransports: ['mcp'],
    preferredTransport: 'mcp',
    browserBridgeSupported: false,
    apiKeySupported: false,
    authFields: [],
    models: [],
  },
];

export function getPlatformDefinition(platformId: string): PlatformDefinition | undefined {
  return PLATFORM_CATALOG.find((p) => p.id === platformId);
}

export function getModelsForPlatformAndModality(
  platformId: PlatformId,
  modality: ModelModality
): PlatformModelDefinition[] {
  const platform = getPlatformDefinition(platformId);
  if (!platform) return [];
  return platform.models.filter((m) => m.modality === modality);
}

export function isBrowserBridgePlatform(platformId: string): platformId is BrowserBridgePlatformId {
  return (BROWSER_BRIDGE_PLATFORM_IDS as readonly string[]).includes(platformId);
}
