import type {
  BYOKCredentials,
  BrowserPlatformTarget,
  ChromeBridgeState,
  ExternalMcpServerRecord,
  ModelModality,
  NodeKind,
  PlatformDefinition,
  PlatformId,
  PlatformModelDefinition,
} from '../types/studio';
import { HIGGSFIELD_MODELS } from './higgsfieldModels';

export const ELEVENLABS_VOICES: Array<{
  id: string;
  name: string;
  accent: string;
}> = [
  { id: 'JBFqnCBsd6RMkjVDRZzb', name: 'George', accent: 'Warm British Narrator' },
  { id: '9BWtsMINqrJLrRacOk9x', name: 'Aria', accent: 'Expressive Natural' },
  { id: 'CwhRBWXzGAHq8TQ4Fs17', name: 'Roger', accent: 'Measured Documentary' },
  { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Sarah', accent: 'Clear Studio Commercial' },
];

export const BROWSER_BRIDGE_PLATFORMS: Array<{
  id: BrowserPlatformTarget;
  name: string;
  url: string;
  creditNote: string;
}> = [
  {
    id: 'higgsfield',
    name: 'Higgsfield',
    url: 'https://higgsfield.ai',
    creditNote: 'ChatGPT Image 2.6 · Soul · DoP I2V · Wan 2.6',
  },
  {
    id: 'sume',
    name: 'Sume',
    url: 'https://sume.com',
    creditNote: '0% Markup Wallet · Seedance 2.5 · Kling 4.0 · ChatGPT Image 2.6',
  },
  {
    id: 'kling',
    name: 'Kling AI',
    url: 'https://app.klingai.com',
    creditNote: 'Kling 4.0 · Kling 3.0 Master · Multi-Element Ref',
  },
  {
    id: 'dreamina',
    name: 'Dreamina',
    url: 'https://dreamina.capcut.com',
    creditNote: 'Seedream 5.5 · Seedance 2.5/2.0/1.5 · Veo 3.1 · Wan 3.0',
  },
  {
    id: 'google-flow',
    name: 'Google Flow',
    url: 'https://labs.google/fx/tools/flow',
    creditNote: 'Imagen 4 · Nano Banana 2 · Veo 3.1',
  },
  {
    id: 'openart',
    name: 'OpenArt',
    url: 'https://openart.ai',
    creditNote: 'ChatGPT Image 2.6 · Photoreal · Kling 4.0',
  },
  {
    id: 'imagineart',
    name: 'ImagineArt',
    url: 'https://www.imagine.art',
    creditNote: 'Imagine V2 · Flux Realism · Hailuo 02',
  },
  {
    id: 'elevenlabs',
    name: 'ElevenLabs',
    url: 'https://elevenlabs.io',
    creditNote: 'Multilingual v2 TTS · Sound Effects v2',
  },
];

export interface ExternalMcpTemplate {
  id: string;
  name: string;
  platformId: PlatformId;
  description: string;
  transport: 'stdio' | 'http';
  command?: string;
  args?: string[];
  envKeyName?: string;
  envPlaceholder?: string;
  url?: string;
}

export const EXTERNAL_MCP_TEMPLATES: ExternalMcpTemplate[] = [
  {
    id: 'tpl-higgsfield-cli-mcp',
    name: 'Higgsfield CLI MCP (@higgsfield/cli)',
    platformId: 'higgsfield',
    description: 'Local stdio MCP bridge via @higgsfield/cli using your Key ID + Key Secret.',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@higgsfield/cli', 'mcp'],
    envKeyName: 'HF_API_KEY',
    envPlaceholder: 'KEY_ID:KEY_SECRET',
  },
  {
    id: 'tpl-elevenlabs-mcp',
    name: 'ElevenLabs Official MCP',
    platformId: 'elevenlabs',
    description: 'Official ElevenLabs voice TTS, sound effects, and voice cloning MCP server.',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@elevenlabs/elevenlabs-mcp'],
    envKeyName: 'ELEVENLABS_API_KEY',
    envPlaceholder: 'xi-...',
  },
  {
    id: 'tpl-playwright-mcp',
    name: 'Playwright Creator Credits MCP',
    platformId: 'higgsfield',
    description: 'Automate logged-in Higgsfield, Kling, Dreamina, OpenArt, or ImagineArt web credits.',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@playwright/mcp@latest'],
  },
  {
    id: 'tpl-fal-mcp',
    name: 'Fal / Replicate Media MCP',
    platformId: 'fal',
    description: 'Zero-markup Flux, Kling, Seedream, and Veo endpoints via MCP stdio server.',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', 'mcp-fal-server'],
    envKeyName: 'FAL_KEY',
    envPlaceholder: 'fal_key_...',
  },
  {
    id: 'tpl-http-mcp',
    name: 'Custom Remote / Local HTTP MCP',
    platformId: 'custom-mcp',
    description: 'Connect any JSON-RPC / Streamable HTTP MCP server exposing image, video, or audio tools.',
    transport: 'http',
    url: 'http://localhost:3002/mcp',
  },
];

export const PLATFORM_CATALOG: PlatformDefinition[] = [
  {
    id: 'higgsfield',
    name: 'Higgsfield',
    shortLabel: 'Higgsfield',
    webUrl: 'https://higgsfield.ai',
    modalities: ['image', 'video', 'audio'],
    supportsBrowserBridge: true,
    supportsApiKey: true,
    supportsMcp: true,
    models: HIGGSFIELD_MODELS,
  },
  {
    id: 'sume',
    name: 'Sume (0% Markup)',
    shortLabel: 'Sume',
    webUrl: 'https://sume.com',
    modalities: ['image', 'video'],
    supportsBrowserBridge: true,
    supportsApiKey: true,
    supportsMcp: true,
    models: [
      {
        id: 'sume-chatgpt-image',
        label: 'ChatGPT Image 2.6',
        modality: 'image',
        providerFamily: 'OpenAI',
        description: 'Prompt-adherent base image generation via Sume 0%-markup credits',
        supportsReferences: true,
        maxReferences: 4,
        aspectRatios: ['auto', '1:1', '3:2', '2:3', '4:3', '3:4', '16:9', '9:16', '21:9'],
        resolutions: ['1k', '2k', '4k'],
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
          },
        ],
        defaultAspect: '16:9',
        defaultResolution: '2k',
      },
      {
        id: 'sume-flux-pro',
        label: 'Flux.1 Pro',
        modality: 'image',
        providerFamily: 'FLUX',
        description: 'Photorealistic stills at raw wholesale credit pricing',
        supportsReferences: true,
        maxReferences: 2,
        aspectRatios: ['1:1', '4:3', '3:4', '16:9', '9:16', '21:9'],
        resolutions: ['1K', '2K'],
        defaultAspect: '16:9',
        defaultResolution: '2K',
      },
      {
        id: 'sume-seedance-2.5',
        label: 'Seedance 2.5',
        modality: 'video',
        providerFamily: 'ByteDance',
        description: 'Pay-as-you-go Seedance 2.5 video generation on Sume',
        supportsReferences: true,
        supportsStartEndFrames: true,
        maxReferences: 4,
        supportsAudio: true,
        aspectRatios: ['16:9', '9:16', '1:1', '21:9', '4:3', '3:4'],
        resolutions: ['480p', '720p', '1080p', '4k'],
        durationsSec: [4, 5, 8, 10, 15],
        parameters: [
          {
            name: 'mode',
            label: 'Mode',
            type: 'enum',
            options: ['t2v', 'omni_reference', 'video_edit'],
            default: 't2v',
            inlinePill: true,
          },
        ],
        defaultAspect: '16:9',
        defaultResolution: '1080p',
        defaultDurationSec: 5,
      },
      {
        id: 'sume-kling-4.0',
        label: 'Kling 4.0',
        modality: 'video',
        providerFamily: 'Kling',
        description: 'Physics-accurate I2V & T2V motion on Sume wallet credits',
        supportsReferences: true,
        supportsStartEndFrames: true,
        maxReferences: 4,
        supportsAudio: true,
        aspectRatios: ['16:9', '9:16', '1:1', '21:9'],
        resolutions: ['720p', '1080p'],
        durationsSec: [3, 5, 8, 10, 15],
        parameters: [
          {
            name: 'mode',
            label: 'Mode',
            type: 'enum',
            options: ['text-to-video', 'image-to-video', 'reference-to-video'],
            default: 'text-to-video',
            inlinePill: true,
          },
        ],
        defaultAspect: '16:9',
        defaultResolution: '1080p',
        defaultDurationSec: 5,
      },
    ],
  },
  {
    id: 'kling',
    name: 'Kling AI',
    shortLabel: 'Kling AI',
    webUrl: 'https://app.klingai.com',
    modalities: ['video', 'image'],
    supportsBrowserBridge: true,
    supportsApiKey: true,
    supportsMcp: true,
    models: [
      {
        id: 'kling-4.0',
        label: 'Kling 4.0',
        modality: 'video',
        providerFamily: 'Kling',
        description: 'Flagship physics-accurate image-to-video & text-to-video with native audio',
        supportsReferences: true,
        supportsStartEndFrames: true,
        maxReferences: 4,
        supportsAudio: true,
        aspectRatios: ['21:9', '16:9', '9:16', '1:1'],
        resolutions: ['720p', '1080p', '4K'],
        durationsSec: [5, 10, 15],
        parameters: [
          {
            name: 'mode',
            label: 'Mode',
            type: 'enum',
            options: ['std', 'pro', '4k'],
            default: 'pro',
            inlinePill: true,
          },
        ],
        defaultAspect: '16:9',
        defaultResolution: '1080p',
        defaultDurationSec: 5,
      },
      {
        id: 'kling-3.0-master',
        label: 'Kling 3.0 Master',
        modality: 'video',
        providerFamily: 'Kling',
        description: 'Cinema-grade long-shot temporal consistency',
        supportsReferences: true,
        supportsStartEndFrames: true,
        maxReferences: 3,
        supportsAudio: true,
        aspectRatios: ['16:9', '9:16', '1:1'],
        resolutions: ['720p', '1080p', '4K'],
        durationsSec: [5, 10, 15],
        parameters: [
          {
            name: 'mode',
            label: 'Mode',
            type: 'enum',
            options: ['std', 'pro', '4k'],
            default: 'pro',
            inlinePill: true,
          },
        ],
        defaultAspect: '16:9',
        defaultResolution: '1080p',
        defaultDurationSec: 10,
      },
      {
        id: 'kling-2.6-pro',
        label: 'Kling 2.6 Pro',
        modality: 'video',
        providerFamily: 'Kling',
        description: 'Fast pro image-to-video with start/end frame lock',
        supportsReferences: true,
        supportsStartEndFrames: true,
        maxReferences: 2,
        supportsAudio: true,
        aspectRatios: ['16:9', '9:16', '1:1'],
        resolutions: ['720p', '1080p'],
        durationsSec: [5, 10],
        parameters: [
          {
            name: 'mode',
            label: 'Mode',
            type: 'enum',
            options: ['std', 'pro'],
            default: 'pro',
            inlinePill: true,
          },
        ],
        defaultAspect: '16:9',
        defaultResolution: '1080p',
        defaultDurationSec: 5,
      },
      {
        id: 'kling-elements',
        label: 'Kling Multi-Element Ref',
        modality: 'video',
        providerFamily: 'Kling',
        description: 'Combine up to 4 character, prop, and scene reference images in one shot',
        supportsReferences: true,
        maxReferences: 4,
        supportsAudio: true,
        aspectRatios: ['16:9', '9:16', '1:1'],
        resolutions: ['720p', '1080p'],
        durationsSec: [5, 10],
        parameters: [
          {
            name: 'mode',
            label: 'Mode',
            type: 'enum',
            options: ['std', 'pro', '4k'],
            default: 'pro',
            inlinePill: true,
          },
        ],
        defaultAspect: '16:9',
        defaultResolution: '1080p',
        defaultDurationSec: 5,
      },
      {
        id: 'kolors-2.0',
        label: 'Kolors 2.0',
        modality: 'image',
        providerFamily: 'Kling',
        description: 'Rich color & lighting fidelity still generation',
        supportsReferences: true,
        maxReferences: 3,
        aspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3'],
        resolutions: ['1K', '2K'],
        defaultAspect: '16:9',
        defaultResolution: '2K',
      },
      {
        id: 'kling-image-o1',
        label: 'Kling Image O1',
        modality: 'image',
        providerFamily: 'Kling',
        description: 'Multi-reference subject-locked concept frame model',
        supportsReferences: true,
        maxReferences: 4,
        aspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:4', '21:9'],
        resolutions: ['1K', '2K'],
        defaultAspect: '16:9',
        defaultResolution: '2K',
      },
    ],
  },
  {
    id: 'dreamina',
    name: 'Dreamina',
    shortLabel: 'Dreamina',
    webUrl: 'https://dreamina.capcut.com',
    modalities: ['image', 'video', 'audio'],
    supportsBrowserBridge: true,
    supportsApiKey: true,
    supportsMcp: true,
    models: [
      // ── 14 Dreamina Image Models ─────────────────────────────────────────────
      {
        id: 'seedream_5_5',
        label: 'Seedream 5.5',
        modality: 'image',
        providerFamily: 'ByteDance',
        description: 'Flagship Dreamina 1.3.0 photorealism, typography & 10-ref synthesis',
        supportsReferences: true,
        maxReferences: 10,
        aspectRatios: ['1:1', '3:4', '16:9', '4:3', '9:16', '2:3', '3:2', '21:9'],
        resolutions: ['1.5K', '2K', '4K'],
        parameters: [
          {
            name: 'quality',
            label: 'Quality',
            type: 'enum',
            options: ['basic', 'high'],
            default: 'high',
            inlinePill: true,
          },
        ],
        defaultAspect: '16:9',
        defaultResolution: '2K',
      },
      {
        id: 'seedream_5_0_pro',
        label: 'Seedream 5.0 Pro',
        modality: 'image',
        providerFamily: 'ByteDance',
        description: '4K realism, 10-ref subject lock, and crisp layout control',
        supportsReferences: true,
        maxReferences: 10,
        aspectRatios: ['1:1', '9:16', '16:9', '3:4', '4:3', '2:3', '3:2', '9:21', '21:9'],
        resolutions: ['1.5K', '2K', '4K'],
        parameters: [
          {
            name: 'quality',
            label: 'Quality',
            type: 'enum',
            options: ['basic', 'high'],
            default: 'high',
            inlinePill: true,
          },
        ],
        defaultAspect: '16:9',
        defaultResolution: '2K',
      },
      {
        id: 'seedream_5_0_flash',
        label: 'Seedream 5.0 Flash',
        modality: 'image',
        providerFamily: 'ByteDance',
        description: 'Fast low-latency Seedream 5.0 Flash for rapid storyboard iteration',
        supportsReferences: true,
        maxReferences: 6,
        aspectRatios: ['1:1', '4:3', '3:4', '16:9', '9:16', '2:3', '3:2', '21:9'],
        resolutions: ['1K', '2K'],
        defaultAspect: '16:9',
        defaultResolution: '2K',
      },
      {
        id: 'seedream_5_0_lite',
        label: 'Seedream 5.0 Lite',
        modality: 'image',
        providerFamily: 'ByteDance',
        description: 'Rapid 2K/4K concept exploration on Dreamina credits',
        supportsReferences: true,
        maxReferences: 6,
        aspectRatios: ['1:1', '4:3', '3:4', '16:9', '9:16', '21:9'],
        resolutions: ['2K', '4K'],
        parameters: [
          {
            name: 'quality',
            label: 'Quality',
            type: 'enum',
            options: ['basic', 'high'],
            default: 'basic',
            inlinePill: true,
          },
        ],
        defaultAspect: '16:9',
        defaultResolution: '2K',
      },
      {
        id: 'seedream_4_7',
        label: 'Seedream 4.7',
        modality: 'image',
        providerFamily: 'ByteDance',
        description: 'Up to 14 reference images with high-fidelity character coherence',
        supportsReferences: true,
        maxReferences: 14,
        aspectRatios: ['1:1', '4:3', '3:4', '16:9', '9:16', '3:2', '2:3', '21:9'],
        resolutions: ['2K', '4K'],
        parameters: [
          {
            name: 'quality',
            label: 'Quality',
            type: 'enum',
            options: ['basic', 'high'],
            default: 'high',
            inlinePill: true,
          },
        ],
        defaultAspect: '16:9',
        defaultResolution: '2K',
      },
      {
        id: 'seedream_4_6',
        label: 'Seedream 4.6',
        modality: 'image',
        providerFamily: 'ByteDance',
        description: 'Stylized art & 14-reference character fusion',
        supportsReferences: true,
        maxReferences: 14,
        aspectRatios: ['1:1', '4:3', '3:4', '16:9', '9:16', '3:2', '2:3', '21:9'],
        resolutions: ['2K', '4K'],
        defaultAspect: '16:9',
        defaultResolution: '2K',
      },
      {
        id: 'seedream_4_5',
        label: 'Seedream 4.5',
        modality: 'image',
        providerFamily: 'ByteDance',
        description: 'Balanced 2K/4K studio stills & character consistency',
        supportsReferences: true,
        maxReferences: 6,
        aspectRatios: ['1:1', '4:3', '3:4', '16:9', '9:16', '3:2', '2:3', '21:9'],
        resolutions: ['2K', '4K'],
        parameters: [
          {
            name: 'quality',
            label: 'Quality',
            type: 'enum',
            options: ['basic', 'high'],
            default: 'high',
            inlinePill: true,
          },
        ],
        defaultAspect: '16:9',
        defaultResolution: '2K',
      },
      {
        id: 'seedream_4_1',
        label: 'Seedream 4.1',
        modality: 'image',
        providerFamily: 'ByteDance',
        description: 'Crisp editorial stills & multi-subject Seedream 4.1 synthesis',
        supportsReferences: true,
        maxReferences: 6,
        aspectRatios: ['1:1', '4:3', '3:4', '16:9', '9:16', '3:2', '2:3', '21:9'],
        resolutions: ['2K', '4K'],
        defaultAspect: '16:9',
        defaultResolution: '2K',
      },
      {
        id: 'seedream_4_0',
        label: 'Seedream 4.0',
        modality: 'image',
        providerFamily: 'ByteDance',
        description: 'Fast Seedream 4.0 still generation & classic Dreamina styling',
        supportsReferences: true,
        maxReferences: 6,
        aspectRatios: ['1:1', '4:3', '3:4', '16:9', '9:16', '3:2', '2:3', '21:9'],
        resolutions: ['1K', '2K', '4K'],
        defaultAspect: '16:9',
        defaultResolution: '2K',
      },
      {
        id: 'jm_image_model_gg_bp_21',
        label: 'Nano Banana 2.1',
        modality: 'image',
        providerFamily: 'Google',
        description: 'Multi-reference conversational fusion up to 14 refs',
        supportsReferences: true,
        maxReferences: 14,
        aspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3', '21:9'],
        resolutions: ['1K', '2K', '4K'],
        defaultAspect: '16:9',
        defaultResolution: '2K',
      },
      {
        id: 'gemini_3_image_pro',
        label: 'Nano Banana Pro',
        modality: 'image',
        providerFamily: 'Google',
        description: 'Studio 4K reasoning & precision multi-reference editing',
        supportsReferences: true,
        maxReferences: 6,
        aspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3', '21:9'],
        resolutions: ['1K', '2K', '4K'],
        defaultAspect: '16:9',
        defaultResolution: '2K',
      },
      {
        id: 'dreamina_gpt_image_2_5_flare',
        label: 'GPT Image 2.5 Flare',
        modality: 'image',
        providerFamily: 'OpenAI',
        description: '16-reference photorealistic synthesis & lighting fidelity',
        supportsReferences: true,
        maxReferences: 16,
        aspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3', '21:9', '9:21'],
        resolutions: ['1K', '2K', '4K'],
        defaultAspect: '16:9',
        defaultResolution: '2K',
      },
      {
        id: 'dreamina_gpt_image_2_5_sunburst',
        label: 'GPT Image 2.5 Sunburst',
        modality: 'image',
        providerFamily: 'OpenAI',
        description: '16-reference warm editorial & design typography synthesis',
        supportsReferences: true,
        maxReferences: 16,
        aspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3', '21:9', '9:21'],
        resolutions: ['1K', '2K', '4K'],
        defaultAspect: '16:9',
        defaultResolution: '2K',
      },
      {
        id: 'gpt_image_2',
        label: 'GPT Image 2',
        modality: 'image',
        providerFamily: 'OpenAI',
        description: 'Clean instruction following & multi-reference compositing',
        supportsReferences: true,
        maxReferences: 6,
        aspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3', '21:9', '9:21'],
        resolutions: ['1K', '2K', '4K'],
        defaultAspect: '16:9',
        defaultResolution: '2K',
      },
      // ── 18 Dreamina Video Models ─────────────────────────────────────────────
      {
        id: 'seedance_2_5',
        label: 'Seedance 2.5',
        modality: 'video',
        providerFamily: 'ByteDance',
        description: 'Flagship multi-ref (50 refs) + start/end frame 4s–30s cinema video',
        supportsReferences: true,
        supportsStartEndFrames: true,
        maxReferences: 50,
        supportsAudio: true,
        aspectRatios: ['21:9', '16:9', '4:3', '1:1', '3:4', '9:16'],
        resolutions: ['480p', '720p', '1080p', '4K'],
        durationsSec: [4, 5, 8, 10, 12, 15, 20, 30],
        parameters: [
          {
            name: 'mode',
            label: 'Mode',
            type: 'enum',
            options: ['auto', 't2v', 'first_last_frame', 'm2v'],
            default: 'auto',
            inlinePill: true,
          },
        ],
        defaultAspect: '16:9',
        defaultResolution: '1080p',
        defaultDurationSec: 5,
      },
      {
        id: 'seedance_2_5_flash',
        label: 'Seedance 2.5 Flash',
        modality: 'video',
        providerFamily: 'ByteDance',
        description: 'Fast 4s–30s multi-reference & keyframe motion previews with native audio',
        supportsReferences: true,
        supportsStartEndFrames: true,
        maxReferences: 50,
        supportsAudio: true,
        aspectRatios: ['21:9', '16:9', '4:3', '1:1', '3:4', '9:16'],
        resolutions: ['480p', '720p'],
        durationsSec: [4, 5, 8, 10, 12, 15, 20, 30],
        parameters: [
          {
            name: 'mode',
            label: 'Mode',
            type: 'enum',
            options: ['auto', 't2v', 'first_last_frame', 'm2v'],
            default: 'auto',
            inlinePill: true,
          },
        ],
        defaultAspect: '16:9',
        defaultResolution: '720p',
        defaultDurationSec: 5,
      },
      {
        id: 'seedance_2_5_draft',
        label: 'Seedance 2.5 Draft',
        modality: 'video',
        providerFamily: 'ByteDance',
        description: 'Rapid 480p pre-visualization up to 30s (promotable to HD)',
        supportsReferences: true,
        supportsStartEndFrames: true,
        maxReferences: 12,
        supportsAudio: false,
        aspectRatios: ['21:9', '16:9', '4:3', '1:1', '3:4', '9:16'],
        resolutions: ['480p'],
        durationsSec: [4, 5, 8, 10, 15, 30],
        parameters: [
          {
            name: 'mode',
            label: 'Mode',
            type: 'enum',
            options: ['auto', 't2v', 'first_last_frame', 'm2v'],
            default: 'auto',
            inlinePill: true,
          },
        ],
        defaultAspect: '16:9',
        defaultResolution: '480p',
        defaultDurationSec: 5,
      },
      {
        id: 'seedance_2_0',
        label: 'Seedance 2.0',
        modality: 'video',
        providerFamily: 'ByteDance',
        description: 'Smooth camera choreography up to 4K from up to 12 references',
        supportsReferences: true,
        supportsStartEndFrames: true,
        maxReferences: 12,
        supportsAudio: true,
        aspectRatios: ['21:9', '16:9', '4:3', '1:1', '3:4', '9:16'],
        resolutions: ['720p', '1080p', '4K'],
        durationsSec: [4, 5, 8, 10, 12, 15],
        parameters: [
          {
            name: 'mode',
            label: 'Mode',
            type: 'enum',
            options: ['auto', 't2v', 'first_last_frame', 'm2v'],
            default: 'auto',
            inlinePill: true,
          },
        ],
        defaultAspect: '16:9',
        defaultResolution: '1080p',
        defaultDurationSec: 5,
      },
      {
        id: 'seedance_2_0_fast',
        label: 'Seedance 2.0 Fast',
        modality: 'video',
        providerFamily: 'ByteDance',
        description: 'Low-latency 720p camera & multi-ref generation up to 15s',
        supportsReferences: true,
        supportsStartEndFrames: true,
        maxReferences: 12,
        supportsAudio: true,
        aspectRatios: ['21:9', '16:9', '4:3', '1:1', '3:4', '9:16'],
        resolutions: ['720p'],
        durationsSec: [4, 5, 8, 10, 12, 15],
        parameters: [
          {
            name: 'mode',
            label: 'Mode',
            type: 'enum',
            options: ['auto', 't2v', 'first_last_frame', 'm2v'],
            default: 'auto',
            inlinePill: true,
          },
        ],
        defaultAspect: '16:9',
        defaultResolution: '720p',
        defaultDurationSec: 5,
      },
      {
        id: 'seedance_2_0_mini',
        label: 'Seedance 2.0 Mini',
        modality: 'video',
        providerFamily: 'ByteDance',
        description: 'Compact high-throughput Seedance 2.0 Mini for 4s–15s 720p shots',
        supportsReferences: true,
        supportsStartEndFrames: true,
        maxReferences: 12,
        supportsAudio: false,
        aspectRatios: ['21:9', '16:9', '4:3', '1:1', '3:4', '9:16'],
        resolutions: ['720p'],
        durationsSec: [4, 5, 8, 10, 12, 15],
        parameters: [
          {
            name: 'mode',
            label: 'Mode',
            type: 'enum',
            options: ['auto', 't2v', 'first_last_frame', 'm2v'],
            default: 'auto',
            inlinePill: true,
          },
        ],
        defaultAspect: '16:9',
        defaultResolution: '720p',
        defaultDurationSec: 5,
      },
      {
        id: 'seedance_1_5_pro',
        label: 'Seedance 1.5 Pro',
        modality: 'video',
        providerFamily: 'ByteDance',
        description: 'Audio-visual synchronized 1080p keyframe & text-to-video (4s–12s)',
        supportsReferences: true,
        supportsStartEndFrames: true,
        maxReferences: 2,
        supportsAudio: true,
        aspectRatios: ['21:9', '16:9', '4:3', '1:1', '3:4', '9:16'],
        resolutions: ['480p', '720p', '1080p'],
        durationsSec: [4, 5, 8, 10, 12],
        parameters: [
          {
            name: 'mode',
            label: 'Mode',
            type: 'enum',
            options: ['auto', 't2v', 'first_last_frame'],
            default: 'auto',
            inlinePill: true,
          },
        ],
        defaultAspect: '16:9',
        defaultResolution: '1080p',
        defaultDurationSec: 5,
      },
      {
        id: 'seedance_1_0_pro',
        label: 'Seedance 1.0 Pro',
        modality: 'video',
        providerFamily: 'ByteDance',
        description: 'Classic high-coherence Seedance 1.0 Pro 1080p text & keyframe video',
        supportsReferences: true,
        supportsStartEndFrames: true,
        maxReferences: 2,
        supportsAudio: false,
        aspectRatios: ['21:9', '16:9', '4:3', '1:1', '3:4', '9:16'],
        resolutions: ['480p', '720p', '1080p'],
        durationsSec: [5, 10],
        defaultAspect: '16:9',
        defaultResolution: '1080p',
        defaultDurationSec: 5,
      },
      {
        id: 'seedance_pro_fast',
        label: 'Seedance 1.0 Fast',
        modality: 'video',
        providerFamily: 'ByteDance',
        description: 'Rapid Seedance 1.0 Pro Fast 720p/1080p keyframe motion generator',
        supportsReferences: true,
        supportsStartEndFrames: true,
        maxReferences: 2,
        supportsAudio: false,
        aspectRatios: ['21:9', '16:9', '4:3', '1:1', '3:4', '9:16'],
        resolutions: ['720p', '1080p'],
        durationsSec: [5, 10],
        defaultAspect: '16:9',
        defaultResolution: '720p',
        defaultDurationSec: 5,
      },
      {
        id: 'seedance_1_0_lite',
        label: 'Seedance 1.0 Lite',
        modality: 'video',
        providerFamily: 'ByteDance',
        description: 'Ultra-lightweight Seedance 1.0 Lite for quick 480p/720p previews',
        supportsReferences: true,
        supportsStartEndFrames: true,
        maxReferences: 2,
        supportsAudio: false,
        aspectRatios: ['21:9', '16:9', '4:3', '1:1', '3:4', '9:16'],
        resolutions: ['480p', '720p'],
        durationsSec: [5, 10],
        defaultAspect: '16:9',
        defaultResolution: '720p',
        defaultDurationSec: 5,
      },
      {
        id: 'veo_3_1',
        label: 'Veo 3.1 (Dreamina)',
        modality: 'video',
        providerFamily: 'Google',
        description: '8s cinema Veo 3.1 with native audio on Dreamina Maestro credits',
        supportsReferences: true,
        supportsStartEndFrames: true,
        maxReferences: 3,
        supportsAudio: true,
        aspectRatios: ['16:9', '9:16'],
        resolutions: ['720p', '1080p', '4K'],
        durationsSec: [8],
        defaultAspect: '16:9',
        defaultResolution: '1080p',
        defaultDurationSec: 8,
      },
      {
        id: 'veo_3_1_fast',
        label: 'Veo 3.1 Fast (Dreamina)',
        modality: 'video',
        providerFamily: 'Google',
        description: 'Fast 8s Veo 3.1 on Dreamina credits with start/end keyframes',
        supportsReferences: true,
        supportsStartEndFrames: true,
        maxReferences: 3,
        supportsAudio: true,
        aspectRatios: ['16:9', '9:16'],
        resolutions: ['720p', '1080p', '4K'],
        durationsSec: [8],
        defaultAspect: '16:9',
        defaultResolution: '1080p',
        defaultDurationSec: 8,
      },
      {
        id: 'veo_3_1_lite',
        label: 'Veo 3.1 Lite (Dreamina)',
        modality: 'video',
        providerFamily: 'Google',
        description: 'Cost-efficient 8s Veo 3.1 Lite with native audio & keyframe lock',
        supportsReferences: true,
        supportsStartEndFrames: true,
        maxReferences: 2,
        supportsAudio: true,
        aspectRatios: ['16:9', '9:16'],
        resolutions: ['720p', '1080p'],
        durationsSec: [8],
        defaultAspect: '16:9',
        defaultResolution: '720p',
        defaultDurationSec: 8,
      },
      {
        id: 'gemini_omni_1_1_flash',
        label: 'Gemini Omni 1.1 Flash (Dreamina)',
        modality: 'video',
        providerFamily: 'Google',
        description: 'Native audio-visual Gemini Omni 1.1 Flash video up to 4K on Dreamina',
        supportsReferences: true,
        supportsStartEndFrames: false,
        maxReferences: 2,
        supportsAudio: true,
        aspectRatios: ['16:9', '9:16'],
        resolutions: ['360P', '720p', '1080p', '4K'],
        durationsSec: [4, 5, 8, 10],
        defaultAspect: '16:9',
        defaultResolution: '1080p',
        defaultDurationSec: 5,
      },
      {
        id: 'wan_3_0',
        label: 'Wan 3.0 (Dreamina)',
        modality: 'video',
        providerFamily: 'Wan',
        description: '20-ref dynamic motion & multi-frame narrative up to 15s',
        supportsReferences: true,
        supportsStartEndFrames: true,
        maxReferences: 20,
        supportsAudio: true,
        aspectRatios: ['16:9', '4:3', '1:1', '3:4', '9:16'],
        resolutions: ['720P', '1080P'],
        durationsSec: [4, 5, 8, 10, 15],
        defaultAspect: '16:9',
        defaultResolution: '1080P',
        defaultDurationSec: 5,
      },
      {
        id: 'happyhorse_1_1',
        label: 'HappyHorse 1.1',
        modality: 'video',
        providerFamily: 'ByteDance',
        description: 'Expressive stylized character & physics motion up to 15s (9 refs)',
        supportsReferences: true,
        supportsStartEndFrames: true,
        maxReferences: 9,
        supportsAudio: true,
        aspectRatios: ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9'],
        resolutions: ['720P', '1080P'],
        durationsSec: [4, 5, 8, 10, 15],
        defaultAspect: '16:9',
        defaultResolution: '1080P',
        defaultDurationSec: 5,
      },
      {
        id: 'omnihuman_1_5',
        label: 'OmniHuman 1.5',
        modality: 'video',
        providerFamily: 'ByteDance',
        description: 'Portrait character animation & audio lip-sync digital human video',
        supportsReferences: true,
        supportsStartEndFrames: false,
        maxReferences: 2,
        supportsAudio: true,
        aspectRatios: ['1:1', '3:4', '9:16', '16:9'],
        resolutions: ['720p', '1080p'],
        durationsSec: [5, 10, 15],
        parameters: [
          {
            name: 'mode',
            label: 'Mode',
            type: 'enum',
            options: ['portrait_sync', 'full_body'],
            default: 'portrait_sync',
            inlinePill: true,
          },
        ],
        defaultAspect: '9:16',
        defaultResolution: '1080p',
        defaultDurationSec: 5,
      },
      {
        id: 'dreamina_motion_imitation',
        label: 'Motion Imitation (Action Copy)',
        modality: 'video',
        providerFamily: 'ByteDance',
        description: 'Character image + driving reference video motion transfer',
        supportsReferences: true,
        supportsStartEndFrames: false,
        maxReferences: 4,
        supportsAudio: true,
        aspectRatios: ['16:9', '9:16', '1:1', '3:4', '4:3'],
        resolutions: ['720p', '1080p'],
        durationsSec: [5, 10, 15],
        defaultAspect: '9:16',
        defaultResolution: '1080p',
        defaultDurationSec: 5,
      },
      // ── 2 Dreamina Audio Models ──────────────────────────────────────────────
      {
        id: 'seed_audio_v1',
        label: 'SeedAudio 1.0',
        modality: 'audio',
        providerFamily: 'ByteDance',
        description: 'Dreamina SeedAudio 1.0 multi-voice narration, dialogue & soundtracks',
        supportsReferences: false,
        aspectRatios: ['16:9'],
        defaultAspect: '16:9',
      },
      {
        id: 'legacy_tts',
        label: 'Seed TTS',
        modality: 'audio',
        providerFamily: 'ByteDance',
        description: 'Dreamina Seed TTS expressive speech synthesis & voice presets',
        supportsReferences: false,
        aspectRatios: ['16:9'],
        defaultAspect: '16:9',
      },
    ],
  },
  {
    id: 'google-flow',
    name: 'Google Flow',
    shortLabel: 'Google Flow',
    webUrl: 'https://labs.google/fx/tools/flow',
    modalities: ['image', 'video'],
    supportsBrowserBridge: true,
    supportsApiKey: true,
    supportsMcp: true,
    models: [
      {
        id: 'imagen-4.0-generate-001',
        label: 'Imagen 4',
        modality: 'image',
        providerFamily: 'Google',
        description: 'Photorealistic still generation via Flow credits or Gemini API key',
        supportsReferences: true,
        maxReferences: 3,
        aspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:4'],
        resolutions: ['1K', '2K'],
        parameters: [
          {
            name: 'quality',
            label: 'Quality',
            type: 'enum',
            options: ['standard', 'ultra'],
            default: 'ultra',
            inlinePill: true,
          },
        ],
        defaultAspect: '16:9',
        defaultResolution: '2K',
      },
      {
        id: 'gemini-3.1-flash-image-preview',
        label: 'Nano Banana 2 (Gemini Flash Image)',
        modality: 'image',
        providerFamily: 'Google',
        description: 'Multi-turn conversational image & reference fusion',
        supportsReferences: true,
        maxReferences: 6,
        aspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3', '21:9'],
        resolutions: ['1K', '2K', '4K'],
        parameters: [
          {
            name: 'thinking_level',
            label: 'Thinking',
            type: 'enum',
            options: ['minimal', 'medium', 'high'],
            default: 'medium',
          },
        ],
        defaultAspect: '16:9',
        defaultResolution: '2K',
      },
      {
        id: 'veo-3.1-generate-preview',
        label: 'Veo 3.1 Quality',
        modality: 'video',
        providerFamily: 'Google',
        description: 'Cinema 1080p video + native spatial audio & dialogue',
        supportsReferences: true,
        supportsStartEndFrames: true,
        maxReferences: 3,
        supportsAudio: true,
        aspectRatios: ['16:9', '9:16'],
        resolutions: ['720p', '1080p'],
        durationsSec: [4, 6, 8],
        parameters: [
          {
            name: 'quality',
            label: 'Quality',
            type: 'enum',
            options: ['basic', 'high', 'ultra'],
            default: 'high',
            inlinePill: true,
          },
        ],
        defaultAspect: '16:9',
        defaultResolution: '1080p',
        defaultDurationSec: 8,
      },
      {
        id: 'veo-3.1-fast-generate-preview',
        label: 'Veo 3.1 Fast',
        modality: 'video',
        providerFamily: 'Google',
        description: 'Low-latency scene iteration with image reference',
        supportsReferences: true,
        maxReferences: 2,
        supportsAudio: true,
        aspectRatios: ['16:9', '9:16'],
        resolutions: ['720p', '1080p'],
        durationsSec: [4, 6, 8],
        defaultAspect: '16:9',
        defaultResolution: '720p',
        defaultDurationSec: 8,
      },
    ],
  },
  {
    id: 'openart',
    name: 'OpenArt',
    shortLabel: 'OpenArt',
    webUrl: 'https://openart.ai',
    modalities: ['image', 'video'],
    supportsBrowserBridge: true,
    supportsApiKey: true,
    supportsMcp: true,
    models: [
      {
        id: 'openart-chatgpt-2.6',
        label: 'ChatGPT Image 2.6',
        modality: 'image',
        description: 'ChatGPT Image 2.6 using OpenArt subscription credits',
        supportsReferences: true,
        maxReferences: 4,
        defaultAspect: '16:9',
        defaultResolution: '2K',
      },
      {
        id: 'openart-photoreal',
        label: 'OpenArt Photoreal',
        modality: 'image',
        description: 'Character-consistent editorial photoreal stills',
        supportsReferences: true,
        maxReferences: 4,
        defaultAspect: '16:9',
        defaultResolution: '2K',
      },
      {
        id: 'openart-flux-dev',
        label: 'Flux Dev',
        modality: 'image',
        description: 'Custom LoRA & reference-guided Flux image synthesis',
        supportsReferences: true,
        maxReferences: 3,
        defaultAspect: '16:9',
        defaultResolution: '2K',
      },
      {
        id: 'openart-kling-4.0',
        label: 'Kling 4.0',
        modality: 'video',
        description: 'Kling 4.0 video generation using OpenArt credits',
        supportsReferences: true,
        maxReferences: 2,
        supportsAudio: true,
        defaultAspect: '16:9',
        defaultResolution: '1080p',
        defaultDurationSec: 5,
      },
      {
        id: 'openart-wan-2.6',
        label: 'Wan 2.6',
        modality: 'video',
        description: 'Wan 2.6 image-to-video on OpenArt',
        supportsReferences: true,
        maxReferences: 2,
        supportsAudio: false,
        defaultAspect: '16:9',
        defaultResolution: '1080p',
        defaultDurationSec: 5,
      },
    ],
  },
  {
    id: 'imagineart',
    name: 'ImagineArt',
    shortLabel: 'ImagineArt',
    webUrl: 'https://www.imagine.art',
    modalities: ['image', 'video'],
    supportsBrowserBridge: true,
    supportsApiKey: true,
    supportsMcp: true,
    models: [
      {
        id: 'imagine-v2',
        label: 'Imagine V2',
        modality: 'image',
        description: 'Flagship ImagineArt high-contrast commercial photography',
        supportsReferences: true,
        maxReferences: 3,
        defaultAspect: '16:9',
        defaultResolution: '2K',
      },
      {
        id: 'imagine-flux-realism',
        label: 'Flux Realism',
        modality: 'image',
        description: 'Natural skin & material texture realism',
        supportsReferences: true,
        maxReferences: 2,
        defaultAspect: '16:9',
        defaultResolution: '2K',
      },
      {
        id: 'imagine-ideogram-3',
        label: 'Ideogram 3',
        modality: 'image',
        description: 'Poster design, packaging, and exact typography',
        supportsReferences: true,
        maxReferences: 2,
        defaultAspect: '1:1',
        defaultResolution: '2K',
      },
      {
        id: 'imagine-video-2.0',
        label: 'Imagine Video 2.0',
        modality: 'video',
        description: 'Image-to-video motion generation on ImagineArt credits',
        supportsReferences: true,
        maxReferences: 2,
        supportsAudio: true,
        defaultAspect: '16:9',
        defaultResolution: '1080p',
        defaultDurationSec: 5,
      },
      {
        id: 'imagine-hailuo-02',
        label: 'Hailuo 02',
        modality: 'video',
        description: 'Expressive character acting & subtle camera drift',
        supportsReferences: true,
        maxReferences: 2,
        supportsAudio: false,
        defaultAspect: '16:9',
        defaultResolution: '1080p',
        defaultDurationSec: 6,
      },
    ],
  },
  {
    id: 'elevenlabs',
    name: 'ElevenLabs',
    shortLabel: 'ElevenLabs',
    webUrl: 'https://elevenlabs.io',
    modalities: ['audio'],
    supportsBrowserBridge: true,
    supportsApiKey: true,
    supportsMcp: true,
    models: [
      {
        id: 'eleven_multilingual_v2',
        label: 'Eleven Multilingual v2 (Voice TTS)',
        modality: 'audio',
        description: 'Lifelike multi-language voiceover & character dialogue',
        defaultDurationSec: 8,
      },
      {
        id: 'eleven_text_to_sound_v2',
        label: 'Eleven Sound Effects v2 (SFX)',
        modality: 'audio',
        description: 'Prompt-driven foley, ambience, and cinematic sound design',
        defaultDurationSec: 8,
      },
      {
        id: 'eleven_flash_v2_5',
        label: 'Eleven Flash v2.5',
        modality: 'audio',
        description: 'Ultra-low-latency voice synthesis',
        defaultDurationSec: 8,
      },
    ],
  },
  {
    id: 'openai',
    name: 'OpenAI Direct',
    shortLabel: 'OpenAI',
    webUrl: 'https://platform.openai.com',
    modalities: ['image', 'video'],
    supportsBrowserBridge: false,
    supportsApiKey: true,
    supportsMcp: true,
    models: [
      {
        id: 'gpt-image-1.5',
        label: 'GPT Image 1.5',
        modality: 'image',
        providerFamily: 'OpenAI',
        description: 'Direct OpenAI zero-markup high-fidelity image & editing',
        supportsReferences: true,
        maxReferences: 6,
        aspectRatios: ['auto', '1:1', '3:2', '2:3', '16:9', '9:16'],
        resolutions: ['1K', '2K'],
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
          },
          {
            name: 'output_format',
            label: 'Format',
            type: 'enum',
            options: ['png', 'jpeg', 'webp'],
            default: 'png',
          },
        ],
        defaultAspect: '16:9',
        defaultResolution: '2K',
      },
      {
        id: 'gpt-image-1',
        label: 'GPT-Image-1 / ChatGPT Image',
        modality: 'image',
        providerFamily: 'OpenAI',
        description: 'Direct OpenAI zero-markup image & reference editing',
        supportsReferences: true,
        maxReferences: 4,
        aspectRatios: ['auto', '1:1', '3:2', '2:3'],
        resolutions: ['1K', '2K'],
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
          },
          {
            name: 'output_format',
            label: 'Format',
            type: 'enum',
            options: ['png', 'jpeg', 'webp'],
            default: 'png',
          },
        ],
        defaultAspect: '3:2',
        defaultResolution: '2K',
      },
      {
        id: 'gpt-image-1-mini',
        label: 'GPT Image 1 Mini',
        modality: 'image',
        providerFamily: 'OpenAI',
        description: 'Fast low-cost OpenAI Direct image generation',
        supportsReferences: true,
        maxReferences: 4,
        aspectRatios: ['auto', '1:1', '3:2', '2:3'],
        resolutions: ['1K'],
        parameters: [
          {
            name: 'quality',
            label: 'Quality',
            type: 'enum',
            options: ['auto', 'low', 'medium', 'high'],
            default: 'medium',
            inlinePill: true,
          },
          {
            name: 'background',
            label: 'Background',
            type: 'enum',
            options: ['auto', 'opaque', 'transparent'],
            default: 'auto',
          },
          {
            name: 'output_format',
            label: 'Format',
            type: 'enum',
            options: ['png', 'jpeg', 'webp'],
            default: 'png',
          },
        ],
        defaultAspect: '1:1',
        defaultResolution: '1K',
      },
      {
        id: 'dall-e-3',
        label: 'DALL·E 3',
        modality: 'image',
        providerFamily: 'OpenAI',
        description: 'Classic DALL·E 3 text-to-image synthesis',
        supportsReferences: false,
        aspectRatios: ['1:1', '16:9', '9:16'],
        resolutions: ['1K', '2K'],
        parameters: [
          {
            name: 'quality',
            label: 'Quality',
            type: 'enum',
            options: ['standard', 'hd'],
            default: 'hd',
            inlinePill: true,
          },
          {
            name: 'variant',
            label: 'Style',
            type: 'enum',
            options: ['vivid', 'natural'],
            default: 'vivid',
            inlinePill: true,
          },
        ],
        defaultAspect: '16:9',
        defaultResolution: '2K',
      },
      {
        id: 'sora-2',
        label: 'Sora 2',
        modality: 'video',
        providerFamily: 'OpenAI',
        description: 'Direct OpenAI Sora 2 video generation',
        supportsReferences: true,
        maxReferences: 2,
        supportsAudio: true,
        aspectRatios: ['16:9', '9:16', '1:1'],
        resolutions: ['720p', '1080p'],
        durationsSec: [4, 8, 12],
        defaultAspect: '16:9',
        defaultResolution: '1080p',
        defaultDurationSec: 8,
      },
      {
        id: 'sora-2-pro',
        label: 'Sora 2 Pro',
        modality: 'video',
        providerFamily: 'OpenAI',
        description: 'Studio high-definition OpenAI Sora 2 Pro video',
        supportsReferences: true,
        maxReferences: 2,
        supportsAudio: true,
        aspectRatios: ['16:9', '9:16', '1:1'],
        resolutions: ['720p', '1080p'],
        durationsSec: [4, 8, 12],
        parameters: [
          {
            name: 'quality',
            label: 'Quality',
            type: 'enum',
            options: ['standard', 'high'],
            default: 'high',
            inlinePill: true,
          },
        ],
        defaultAspect: '16:9',
        defaultResolution: '1080p',
        defaultDurationSec: 8,
      },
    ],
  },
  {
    id: 'fal',
    name: 'Fal.ai',
    shortLabel: 'Fal.ai',
    webUrl: 'https://fal.ai',
    modalities: ['image', 'video'],
    supportsBrowserBridge: false,
    supportsApiKey: true,
    supportsMcp: true,
    models: [
      {
        id: 'fal-ai/flux-pro/v1.1',
        label: 'Flux 1.1 Pro',
        modality: 'image',
        description: 'Raw pay-per-call Flux 1.1 Pro via Fal queue',
        supportsReferences: true,
        maxReferences: 2,
        defaultAspect: '16:9',
        defaultResolution: '2K',
      },
      {
        id: 'fal-ai/recraft-v3',
        label: 'Recraft V3',
        modality: 'image',
        description: 'Design, brand assets, and editorial photography',
        supportsReferences: true,
        maxReferences: 2,
        defaultAspect: '16:9',
        defaultResolution: '2K',
      },
      {
        id: 'fal-ai/kling-video/v2/master/image-to-video',
        label: 'Kling Master I2V',
        modality: 'video',
        description: 'Direct Fal queue image-to-video with Kling Master',
        supportsReferences: true,
        maxReferences: 2,
        supportsAudio: true,
        defaultAspect: '16:9',
        defaultResolution: '1080p',
        defaultDurationSec: 5,
      },
      {
        id: 'fal-ai/veo3',
        label: 'Veo 3',
        modality: 'video',
        description: 'Veo 3 video synthesis via Fal API key',
        supportsReferences: true,
        maxReferences: 1,
        supportsAudio: true,
        defaultAspect: '16:9',
        defaultResolution: '1080p',
        defaultDurationSec: 8,
      },
    ],
  },
  {
    id: 'replicate',
    name: 'Replicate',
    shortLabel: 'Replicate',
    webUrl: 'https://replicate.com',
    modalities: ['image', 'video'],
    supportsBrowserBridge: false,
    supportsApiKey: true,
    supportsMcp: true,
    models: [
      {
        id: 'black-forest-labs/flux-1.1-pro',
        label: 'Flux 1.1 Pro',
        modality: 'image',
        description: 'Direct Replicate Flux 1.1 Pro model',
        supportsReferences: true,
        maxReferences: 2,
        defaultAspect: '16:9',
        defaultResolution: '2K',
      },
      {
        id: 'kwaivgi/kling-v2.0',
        label: 'Kling v2.0',
        modality: 'video',
        description: 'Kling image-to-video via Replicate token',
        supportsReferences: true,
        maxReferences: 2,
        defaultAspect: '16:9',
        defaultResolution: '1080p',
        defaultDurationSec: 5,
      },
    ],
  },
  {
    id: 'comfyui',
    name: 'ComfyUI Local GPU',
    shortLabel: 'ComfyUI',
    webUrl: 'http://127.0.0.1:8188',
    modalities: ['image', 'video'],
    supportsBrowserBridge: false,
    supportsApiKey: false,
    supportsMcp: true,
    models: [
      {
        id: 'flux-dev-local',
        label: 'Local Flux / SDXL',
        modality: 'image',
        description: 'Local GPU checkpoint execution on 127.0.0.1:8188',
        supportsReferences: true,
        maxReferences: 4,
        defaultAspect: '16:9',
        defaultResolution: '2K',
      },
      {
        id: 'wan-i2v-local',
        label: 'Local Wan 2.6 I2V',
        modality: 'video',
        description: 'Local GPU image-to-video workflow on 127.0.0.1:8188',
        supportsReferences: true,
        maxReferences: 2,
        defaultAspect: '16:9',
        defaultResolution: '720p',
        defaultDurationSec: 5,
      },
    ],
  },
  {
    id: 'custom-mcp',
    name: 'Custom MCP Server',
    shortLabel: 'Custom MCP',
    webUrl: 'http://localhost:3001/mcp',
    modalities: ['image', 'video', 'audio'],
    supportsBrowserBridge: false,
    supportsApiKey: false,
    supportsMcp: true,
    models: [],
  },
];

export function nodeKindToModality(kind: NodeKind): ModelModality | null {
  if (kind === 'image' || kind === 'element' || kind === 'contact-sheet') {
    return 'image';
  }
  if (kind === 'video') return 'video';
  if (kind === 'audio') return 'audio';
  return null;
}

export function getPlatformsForModality(
  modality: ModelModality,
  catalog: PlatformDefinition[] = PLATFORM_CATALOG
): PlatformDefinition[] {
  return catalog.filter((p) => p.modalities.includes(modality));
}

export function getModelsForPlatformAndModality(
  platformId: PlatformId | undefined,
  modality: ModelModality,
  catalog: PlatformDefinition[] = PLATFORM_CATALOG,
  externalMcpServers: ExternalMcpServerRecord[] = []
): PlatformModelDefinition[] {
  if (!platformId) return [];
  if (platformId === 'custom-mcp') {
    const dynamicModels: PlatformModelDefinition[] = [];
    for (const srv of externalMcpServers) {
      for (const tool of srv.tools || []) {
        dynamicModels.push({
          id: `${srv.id}::${tool.name}`,
          label: `${srv.name} · ${tool.name}`,
          modality,
          description: tool.description || `MCP tool on ${srv.name}`,
          supportsReferences: true,
          maxReferences: 4,
        });
      }
    }
    return dynamicModels;
  }

  const platform = catalog.find((p) => p.id === platformId);
  if (!platform) return [];
  const baseModels = platform.models.filter((m) => m.modality === modality);

  // Append tools only for custom/small-catalog MCP servers where the platform doesn't already provide a curated catalog
  const extraMcpTools: PlatformModelDefinition[] = [];
  for (const srv of externalMcpServers) {
    if (srv.platformId !== platformId) continue;
    const toolCount = srv.tools?.length || 0;
    const allowInDropdown =
      baseModels.length === 0 ||
      (platformId !== 'higgsfield' && platformId !== 'dreamina' && toolCount <= 15);
    if (!allowInDropdown) continue;
    for (const tool of srv.tools || []) {
      extraMcpTools.push({
        id: `mcp:${srv.id}:${tool.name}`,
        label: `MCP · ${tool.name}`,
        modality,
        description: tool.description || `${srv.name} MCP tool`,
        supportsReferences: true,
        maxReferences: 4,
      });
    }
  }
  return [...baseModels, ...extraMcpTools];
}

export const LEGACY_MODEL_ID_REDIRECTS: Record<string, string> = {
  'chatgpt-image-2.6': 'gpt_image_2_6',
  'higgsfield-soul': 'soul_2',
  'higgsfield-dop-i2v': 'cinematic_studio_video_4_0',
  'kling-4.0-hf': 'kling4_0',
  'flux-1-pro': 'flux_3_image',
  'seedream-5.0': 'seedream_v5_pro',
  'seedream-5.0-pro': 'seedream_5_0_pro',
  'seedream-5.0-lite': 'seedream_5_0_lite',
  'seedream-4.5': 'seedream_4_5',
  'seedance-2.5': 'seedance_2_5',
  'seedance-2.0': 'seedance_2_0',
  'wan-2.6': 'wan2_6',
};

export const LEGACY_MODEL_LABEL_MAP: Record<string, string> = {
  'chatgpt-image-2.6': 'ChatGPT / GPT Image 2.6',
  'higgsfield-soul': 'Higgsfield Soul 2.0',
  'higgsfield-dop-i2v': 'Cinema Studio 4.0',
  'wan-2.6': 'Wan 2.6 Video',
  'kling-4.0-hf': 'Kling 4.0',
  'flux-1-pro': 'FLUX 3 Image',
  'seedream-5.0': 'Seedream 5.0 Pro',
  'seedream-5.0-pro': 'Seedream 5.0 Pro',
  'seedream-5.0-lite': 'Seedream 5.0 Lite',
  'seedream-4.5': 'Seedream 4.5',
  'seedance-2.5': 'Seedance 2.5',
  'seedance-2.0': 'Seedance 2.0',
};

export function resolveCanonicalModelId(modelId?: string): string {
  if (!modelId) return '';
  return LEGACY_MODEL_ID_REDIRECTS[modelId] || modelId;
}

export function resolveModelDisplayLabel(
  platformId?: PlatformId,
  modelId?: string,
  catalog: PlatformDefinition[] = PLATFORM_CATALOG
): string | null {
  if (!modelId) return null;
  const canonical = resolveCanonicalModelId(modelId);
  const platform = platformId ? catalog.find((p) => p.id === platformId) : undefined;
  const foundModel =
    platform?.models.find((m) => m.id === modelId) ||
    platform?.models.find((m) => m.id === canonical);
  return foundModel?.label || LEGACY_MODEL_LABEL_MAP[modelId] || modelId;
}

export function getPlatformBadgeLabel(
  platformId?: PlatformId,
  modelId?: string,
  catalog: PlatformDefinition[] = PLATFORM_CATALOG,
  externalMcpServers: ExternalMcpServerRecord[] = []
): string | null {
  if (!platformId) return null;
  const platform = catalog.find((p) => p.id === platformId);
  const pLabel = platform?.shortLabel || platformId;
  if (!modelId) return pLabel;

  if (platformId === 'custom-mcp' && modelId.includes('::')) {
    const [srvId, toolName] = modelId.split('::');
    const srv = externalMcpServers.find((s) => s.id === srvId);
    return `${srv?.name || 'MCP'} · ${toolName}`;
  }

  return `${pLabel} · ${resolveModelDisplayLabel(platformId, modelId, catalog) || modelId}`;
}

export interface PlatformUiMeta {
  tagline: string;
  apiKeyUrl: string;
  apiKeyUrlLabel: string;
  apiPlaceholder: string;
  verifySlug?:
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
}

export const PLATFORM_UI_META: Record<PlatformId, PlatformUiMeta> = {
  higgsfield: {
    tagline: 'Official MCP OAuth (mcp.higgsfield.ai) · Soul · DoP Cinema I2V · Genjutsu',
    apiKeyUrl: 'https://console.higgsfield.ai',
    apiKeyUrlLabel: 'console.higgsfield.ai',
    apiPlaceholder: 'KEY_ID:KEY_SECRET',
    verifySlug: 'higgsfield',
  },
  sume: {
    tagline: 'Pay-as-you-go 0% markup · Seedance 2.5 · Kling 4.0 · ChatGPT Image 2.6',
    apiKeyUrl: 'https://sume.com',
    apiKeyUrlLabel: 'sume.com',
    apiPlaceholder: 'sume_... (optional API token)',
    verifySlug: 'sume',
  },
  kling: {
    tagline: 'Kling 4.0 (Native Audio) · Kling 3.0 Master · Kolors',
    apiKeyUrl: 'https://app.klingai.com/global/dev',
    apiKeyUrlLabel: 'app.klingai.com/global/dev',
    apiPlaceholder: 'Kling Bearer / Access Token...',
    verifySlug: 'kling',
  },
  dreamina: {
    tagline: 'Official CLI/MCP OAuth · Seedance 2.5/2.0/1.5 · Seedream 5.5 · Veo 3.1 · Wan 3.0 · OmniHuman',
    apiKeyUrl: 'https://console.byteplus.com',
    apiKeyUrlLabel: 'console.byteplus.com',
    apiPlaceholder: 'ark-...',
    verifySlug: 'seedance',
  },
  'google-flow': {
    tagline: 'Imagen 4 · Nano Banana 2 · Veo 3.1 Quality & Fast',
    apiKeyUrl: 'https://aistudio.google.com/apikey',
    apiKeyUrlLabel: 'aistudio.google.com/apikey',
    apiPlaceholder: 'AIzaSy...',
    verifySlug: 'gemini',
  },
  elevenlabs: {
    tagline: 'Multilingual v2 Voiceover TTS · Flash v2.5 · Sound Effects v2',
    apiKeyUrl: 'https://elevenlabs.io/app/settings/api-keys',
    apiKeyUrlLabel: 'elevenlabs.io/app/settings/api-keys',
    apiPlaceholder: 'sk_... / xi-...',
    verifySlug: 'elevenlabs',
  },
  openart: {
    tagline: 'ChatGPT Image 2.6 · OpenArt Photoreal · Kling 4.0',
    apiKeyUrl: 'https://openart.ai',
    apiKeyUrlLabel: 'openart.ai',
    apiPlaceholder: 'oa_...',
    verifySlug: 'openart',
  },
  imagineart: {
    tagline: 'Imagine V2 · Flux Realism · Hailuo 02 · Kling 4.0',
    apiKeyUrl: 'https://www.imagine.art',
    apiKeyUrlLabel: 'imagine.art',
    apiPlaceholder: 'vk-...',
    verifySlug: 'imagineart',
  },
  openai: {
    tagline: 'GPT Image 1 / ChatGPT Image · Sora 2 Video',
    apiKeyUrl: 'https://platform.openai.com/api-keys',
    apiKeyUrlLabel: 'platform.openai.com/api-keys',
    apiPlaceholder: 'sk-proj-...',
    verifySlug: 'openai',
  },
  fal: {
    tagline: 'Direct serverless GPU pass-through · Flux · Kling · Wan',
    apiKeyUrl: 'https://fal.ai/dashboard/keys',
    apiKeyUrlLabel: 'fal.ai/dashboard/keys',
    apiPlaceholder: 'fal_...',
    verifySlug: 'fal',
  },
  replicate: {
    tagline: 'Direct Replicate model predictions · Flux · Video',
    apiKeyUrl: 'https://replicate.com/account/api-tokens',
    apiKeyUrlLabel: 'replicate.com/account/api-tokens',
    apiPlaceholder: 'r8_...',
    verifySlug: 'replicate',
  },
  comfyui: {
    tagline: 'Local GPU node engine at 127.0.0.1:8188 ($0.00/gen)',
    apiKeyUrl: 'http://127.0.0.1:8188',
    apiKeyUrlLabel: '127.0.0.1:8188',
    apiPlaceholder: 'http://127.0.0.1:8188',
    verifySlug: 'comfyui',
  },
  'custom-mcp': {
    tagline: 'Connect any stdio or HTTP MCP server exposing image/video/audio tools',
    apiKeyUrl: 'https://modelcontextprotocol.io',
    apiKeyUrlLabel: 'modelcontextprotocol.io',
    apiPlaceholder: 'http://localhost:3002/mcp',
  },
};

export function getPlatformConnectionStatus(
  platformId: PlatformId,
  byok: BYOKCredentials,
  chromeBridge: ChromeBridgeState,
  externalMcpServers: ExternalMcpServerRecord[],
  backendPlatform?: PlatformDefinition,
  liveStatus?: {
    connectedBrowserPlatforms?: string[];
    connectedMcpPlatforms?: string[];
    configuredApiPlatforms?: string[];
  }
): {
  connected: boolean;
  hasBrowser: boolean;
  hasMcp: boolean;
  hasApiKey: boolean;
  transports: Array<'mcp' | 'browser-bridge' | 'api-key'>;
  statusLabel:
    | 'Connected via Browser'
    | 'Connected via MCP'
    | 'Connected via API Key'
    | 'Not Connected';
  summary: string;
} {
  const transports: Array<'mcp' | 'browser-bridge' | 'api-key'> = [];

  // 1. Browser Credit Bridge tabs (check WS state, /api/connections/status, & backendPlatform)
  const bridgeMap = chromeBridge.connectedPlatforms || {};
  const hasBrowser =
    Boolean(bridgeMap[platformId]) ||
    Boolean(liveStatus?.connectedBrowserPlatforms?.includes(platformId)) ||
    (platformId === 'google-flow' && chromeBridge.flowTabConnected) ||
    (platformId === 'dreamina' && chromeBridge.dreaminaTabConnected) ||
    Boolean(backendPlatform?.activeTransports?.includes('browser-bridge'));
  if (hasBrowser) {
    transports.push('browser-bridge');
  }

  // 2. External MCP servers registered for this platform
  const hasMcp =
    externalMcpServers.some(
      (s) =>
        (s.platformId === platformId || platformId === 'custom-mcp') &&
        s.status === 'connected'
    ) ||
    Boolean(liveStatus?.connectedMcpPlatforms?.includes(platformId)) ||
    Boolean(backendPlatform?.activeTransports?.includes('mcp'));
  if (hasMcp) {
    transports.push('mcp');
  }

  // 3. Direct zero-markup API keys in localStorage or backend env
  let hasApiKey =
    Boolean(liveStatus?.configuredApiPlatforms?.includes(platformId)) ||
    Boolean(backendPlatform?.activeTransports?.includes('api-key'));
  switch (platformId) {
    case 'higgsfield':
      if (
        byok.higgsfieldApiKey?.trim() ||
        (byok.higgsfieldKeyId?.trim() && byok.higgsfieldKeySecret?.trim())
      ) {
        hasApiKey = true;
      }
      break;
    case 'sume':
      if (byok.sumeApiKey?.trim()) hasApiKey = true;
      break;
    case 'kling':
      if (
        byok.klingApiKey?.trim() ||
        (byok.klingAccessKey?.trim() && byok.klingSecretKey?.trim())
      ) {
        hasApiKey = true;
      }
      break;
    case 'dreamina':
      if (byok.seedanceApiKey?.trim()) hasApiKey = true;
      break;
    case 'google-flow':
      if (byok.geminiApiKey?.trim()) hasApiKey = true;
      break;
    case 'openart':
      if (byok.openartApiKey?.trim()) hasApiKey = true;
      break;
    case 'imagineart':
      if (byok.imagineartApiKey?.trim()) hasApiKey = true;
      break;
    case 'elevenlabs':
      if (byok.elevenlabsApiKey?.trim()) hasApiKey = true;
      break;
    case 'openai':
      if (byok.openaiApiKey?.trim()) hasApiKey = true;
      break;
    case 'fal':
      if (byok.falApiKey?.trim()) hasApiKey = true;
      break;
    case 'replicate':
      if (byok.replicateApiKey?.trim()) hasApiKey = true;
      break;
    case 'comfyui':
      if (byok.comfyUiUrl?.trim() && backendPlatform?.connected) hasApiKey = true;
      break;
    default:
      break;
  }
  if (hasApiKey) {
    transports.push('api-key');
  }

  const connected = transports.length > 0 || Boolean(backendPlatform?.connected);
  const statusLabel:
    | 'Connected via Browser'
    | 'Connected via MCP'
    | 'Connected via API Key'
    | 'Not Connected' = hasMcp
    ? 'Connected via MCP'
    : hasBrowser
    ? 'Connected via Browser'
    : hasApiKey
    ? 'Connected via API Key'
    : 'Not Connected';

  const labels = transports.map((t) =>
    t === 'mcp' ? 'MCP' : t === 'browser-bridge' ? 'Browser Credits' : 'API Key'
  );
  return {
    connected,
    hasBrowser,
    hasMcp,
    hasApiKey,
    transports,
    statusLabel,
    summary: labels.length > 0 ? labels.join(' · ') : 'Connect Credits',
  };
}

export function resolveByokCredentialsForPlatform(
  platformId: PlatformId,
  byok: BYOKCredentials
): {
  apiKey?: string;
  accessKey?: string;
  secretKey?: string;
  baseUrl?: string;
} {
  switch (platformId) {
    case 'higgsfield': {
      const keyId = byok.higgsfieldKeyId?.trim();
      const keySecret = byok.higgsfieldKeySecret?.trim();
      const combined = keyId && keySecret ? `${keyId}:${keySecret}` : byok.higgsfieldApiKey?.trim();
      return {
        apiKey: combined || undefined,
        accessKey: keyId || undefined,
        secretKey: keySecret || undefined,
      };
    }
    case 'sume':
      return { apiKey: byok.sumeApiKey?.trim() || undefined };
    case 'kling':
      return {
        apiKey: byok.klingApiKey?.trim() || undefined,
        accessKey: byok.klingAccessKey?.trim() || undefined,
        secretKey: byok.klingSecretKey?.trim() || undefined,
      };
    case 'dreamina':
      return {
        apiKey: byok.seedanceApiKey?.trim() || undefined,
        baseUrl: byok.seedanceEndpoint?.trim() || undefined,
      };
    case 'google-flow':
      return { apiKey: byok.geminiApiKey?.trim() || undefined };
    case 'openart':
      return { apiKey: byok.openartApiKey?.trim() || undefined };
    case 'imagineart':
      return { apiKey: byok.imagineartApiKey?.trim() || undefined };
    case 'elevenlabs':
      return { apiKey: byok.elevenlabsApiKey?.trim() || undefined };
    case 'openai':
      return { apiKey: byok.openaiApiKey?.trim() || undefined };
    case 'fal':
      return { apiKey: byok.falApiKey?.trim() || undefined };
    case 'replicate':
      return { apiKey: byok.replicateApiKey?.trim() || undefined };
    case 'comfyui':
      return { baseUrl: byok.comfyUiUrl?.trim() || 'http://127.0.0.1:8188' };
    default:
      return {};
  }
}
