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
    id: 'kling',
    name: 'Kling AI',
    url: 'https://app.klingai.com',
    creditNote: 'Kling 4.0 · Kling 3.0 Master · Multi-Element Ref',
  },
  {
    id: 'dreamina',
    name: 'Dreamina',
    url: 'https://dreamina.capcut.com',
    creditNote: 'Seedream 5.0 Pro · Seedance 2.5',
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
    modalities: ['image', 'video'],
    supportsBrowserBridge: true,
    supportsApiKey: true,
    supportsMcp: true,
    models: [
      {
        id: 'chatgpt-image-2.6',
        label: 'ChatGPT Image 2.6',
        modality: 'image',
        description: 'Prompt-adherent base image & character reference generation on Higgsfield',
        supportsReferences: true,
        maxReferences: 4,
        defaultAspect: '16:9',
        defaultResolution: '2K',
      },
      {
        id: 'higgsfield-soul',
        label: 'Higgsfield Soul',
        modality: 'image',
        description: 'Editorial photoreal human & fashion aesthetic model',
        supportsReferences: true,
        maxReferences: 4,
        defaultAspect: '16:9',
        defaultResolution: '2K',
      },
      {
        id: 'flux-1-pro',
        label: 'Flux.1 Pro',
        modality: 'image',
        description: 'High-detail architectural & product photography',
        supportsReferences: true,
        maxReferences: 2,
        defaultAspect: '16:9',
        defaultResolution: '2K',
      },
      {
        id: 'seedream-5.0',
        label: 'Seedream 5.0',
        modality: 'image',
        description: 'Cinematic composition & typography accuracy',
        supportsReferences: true,
        maxReferences: 4,
        defaultAspect: '16:9',
        defaultResolution: '2K',
      },
      {
        id: 'higgsfield-dop-i2v',
        label: 'DoP Cinema I2V-01',
        modality: 'video',
        description: 'Director-of-photography camera moves from base image reference',
        supportsReferences: true,
        maxReferences: 2,
        supportsAudio: true,
        defaultAspect: '16:9',
        defaultResolution: '1080p',
        defaultDurationSec: 5,
      },
      {
        id: 'wan-2.6',
        label: 'Wan 2.6',
        modality: 'video',
        description: 'Fluid motion synthesis with reference lock',
        supportsReferences: true,
        maxReferences: 2,
        supportsAudio: true,
        defaultAspect: '16:9',
        defaultResolution: '1080p',
        defaultDurationSec: 5,
      },
      {
        id: 'kling-4.0-hf',
        label: 'Kling 4.0',
        modality: 'video',
        description: 'Kling 4.0 hosted inside Higgsfield credits',
        supportsReferences: true,
        maxReferences: 4,
        supportsAudio: true,
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
        description: 'Flagship physics-accurate image-to-video & text-to-video with native audio',
        supportsReferences: true,
        maxReferences: 4,
        supportsAudio: true,
        defaultAspect: '16:9',
        defaultResolution: '1080p',
        defaultDurationSec: 5,
      },
      {
        id: 'kling-3.0-master',
        label: 'Kling 3.0 Master',
        modality: 'video',
        description: 'Cinema-grade long-shot temporal consistency',
        supportsReferences: true,
        maxReferences: 3,
        supportsAudio: true,
        defaultAspect: '16:9',
        defaultResolution: '1080p',
        defaultDurationSec: 10,
      },
      {
        id: 'kling-2.6-pro',
        label: 'Kling 2.6 Pro',
        modality: 'video',
        description: 'Fast pro image-to-video with start/end frame lock',
        supportsReferences: true,
        maxReferences: 2,
        supportsAudio: true,
        defaultAspect: '16:9',
        defaultResolution: '1080p',
        defaultDurationSec: 5,
      },
      {
        id: 'kling-elements',
        label: 'Kling Multi-Element Ref',
        modality: 'video',
        description: 'Combine up to 4 character, prop, and scene reference images in one shot',
        supportsReferences: true,
        maxReferences: 4,
        supportsAudio: true,
        defaultAspect: '16:9',
        defaultResolution: '1080p',
        defaultDurationSec: 5,
      },
      {
        id: 'kolors-2.0',
        label: 'Kolors 2.0',
        modality: 'image',
        description: 'Rich color & lighting fidelity still generation',
        supportsReferences: true,
        maxReferences: 3,
        defaultAspect: '16:9',
        defaultResolution: '2K',
      },
      {
        id: 'kling-image-o1',
        label: 'Kling Image O1',
        modality: 'image',
        description: 'Multi-reference subject-locked concept frame model',
        supportsReferences: true,
        maxReferences: 4,
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
    modalities: ['image', 'video'],
    supportsBrowserBridge: true,
    supportsApiKey: true,
    supportsMcp: true,
    models: [
      {
        id: 'seedream-5.0-pro',
        label: 'Seedream 5.0 Pro',
        modality: 'image',
        description: '4K realism, multi-reference lock, and crisp layout control',
        supportsReferences: true,
        maxReferences: 6,
        defaultAspect: '16:9',
        defaultResolution: '2K',
      },
      {
        id: 'seedream-5.0-lite',
        label: 'Seedream 5.0 Lite',
        modality: 'image',
        description: 'Rapid concept exploration on Dreamina credits',
        supportsReferences: true,
        maxReferences: 4,
        defaultAspect: '16:9',
        defaultResolution: '1K',
      },
      {
        id: 'seedream-4.5',
        label: 'Seedream 4.5',
        modality: 'image',
        description: 'Balanced studio stills & character consistency',
        supportsReferences: true,
        maxReferences: 4,
        defaultAspect: '16:9',
        defaultResolution: '2K',
      },
      {
        id: 'seedance-2.5',
        label: 'Seedance 2.5',
        modality: 'video',
        description: 'High-dynamic motion & multi-subject continuity',
        supportsReferences: true,
        maxReferences: 4,
        supportsAudio: true,
        defaultAspect: '16:9',
        defaultResolution: '1080p',
        defaultDurationSec: 5,
      },
      {
        id: 'seedance-2.0',
        label: 'Seedance 2.0',
        modality: 'video',
        description: 'Smooth camera choreography from keyframe references',
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
        description: 'Photorealistic still generation via Flow credits or Gemini API key',
        supportsReferences: true,
        maxReferences: 3,
        defaultAspect: '16:9',
        defaultResolution: '2K',
      },
      {
        id: 'gemini-3.1-flash-image-preview',
        label: 'Nano Banana 2 (Gemini Flash Image)',
        modality: 'image',
        description: 'Multi-turn conversational image & reference fusion',
        supportsReferences: true,
        maxReferences: 6,
        defaultAspect: '16:9',
        defaultResolution: '2K',
      },
      {
        id: 'veo-3.1-generate-preview',
        label: 'Veo 3.1 Quality',
        modality: 'video',
        description: 'Cinema 1080p video + native spatial audio & dialogue',
        supportsReferences: true,
        maxReferences: 3,
        supportsAudio: true,
        defaultAspect: '16:9',
        defaultResolution: '1080p',
        defaultDurationSec: 8,
      },
      {
        id: 'veo-3.1-fast-generate-preview',
        label: 'Veo 3.1 Fast',
        modality: 'video',
        description: 'Low-latency scene iteration with image reference',
        supportsReferences: true,
        maxReferences: 2,
        supportsAudio: true,
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
        id: 'gpt-image-1',
        label: 'GPT-Image-1 / ChatGPT Image',
        modality: 'image',
        description: 'Direct OpenAI zero-markup image & reference editing',
        supportsReferences: true,
        maxReferences: 4,
        defaultAspect: '16:9',
        defaultResolution: '2K',
      },
      {
        id: 'sora-2',
        label: 'Sora 2',
        modality: 'video',
        description: 'Direct OpenAI Sora 2 video generation',
        supportsReferences: true,
        maxReferences: 2,
        supportsAudio: true,
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

  // Also append any tools from external MCP servers bound to this platformId
  const extraMcpTools: PlatformModelDefinition[] = [];
  for (const srv of externalMcpServers) {
    if (srv.platformId === platformId) {
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
  }
  return [...baseModels, ...extraMcpTools];
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

  const foundModel = platform?.models.find((m) => m.id === modelId);
  return `${pLabel} · ${foundModel?.label || modelId}`;
}

export function getPlatformConnectionStatus(
  platformId: PlatformId,
  byok: BYOKCredentials,
  chromeBridge: ChromeBridgeState,
  externalMcpServers: ExternalMcpServerRecord[],
  backendPlatform?: PlatformDefinition
): {
  connected: boolean;
  transports: Array<'mcp' | 'browser-bridge' | 'api-key'>;
  summary: string;
} {
  const transports: Array<'mcp' | 'browser-bridge' | 'api-key'> = [];

  // 1. External MCP servers registered for this platform
  const hasMcp = externalMcpServers.some(
    (s) =>
      (s.platformId === platformId || platformId === 'custom-mcp') &&
      s.status === 'connected'
  );
  if (hasMcp || backendPlatform?.activeTransports?.includes('mcp')) {
    transports.push('mcp');
  }

  // 2. Browser Credit Bridge tabs
  const bridgeMap = chromeBridge.connectedPlatforms || {};
  const hasBridge =
    Boolean(bridgeMap[platformId]) ||
    (platformId === 'google-flow' && chromeBridge.flowTabConnected) ||
    (platformId === 'dreamina' && chromeBridge.dreaminaTabConnected) ||
    Boolean(backendPlatform?.activeTransports?.includes('browser-bridge'));
  if (hasBridge) {
    transports.push('browser-bridge');
  }

  // 3. Direct zero-markup API keys in localStorage or backend env
  let hasKey = Boolean(backendPlatform?.activeTransports?.includes('api-key'));
  switch (platformId) {
    case 'higgsfield':
      if (byok.higgsfieldApiKey?.trim()) hasKey = true;
      break;
    case 'kling':
      if (
        byok.klingApiKey?.trim() ||
        (byok.klingAccessKey?.trim() && byok.klingSecretKey?.trim())
      ) {
        hasKey = true;
      }
      break;
    case 'dreamina':
      if (byok.seedanceApiKey?.trim()) hasKey = true;
      break;
    case 'google-flow':
      if (byok.geminiApiKey?.trim()) hasKey = true;
      break;
    case 'openart':
      if (byok.openartApiKey?.trim()) hasKey = true;
      break;
    case 'imagineart':
      if (byok.imagineartApiKey?.trim()) hasKey = true;
      break;
    case 'elevenlabs':
      if (byok.elevenlabsApiKey?.trim()) hasKey = true;
      break;
    case 'openai':
      if (byok.openaiApiKey?.trim()) hasKey = true;
      break;
    case 'fal':
      if (byok.falApiKey?.trim()) hasKey = true;
      break;
    case 'replicate':
      if (byok.replicateApiKey?.trim()) hasKey = true;
      break;
    case 'comfyui':
      if (byok.comfyUiUrl?.trim() && backendPlatform?.connected) hasKey = true;
      break;
    default:
      break;
  }
  if (hasKey) {
    transports.push('api-key');
  }

  const connected = transports.length > 0 || Boolean(backendPlatform?.connected);
  const labels = transports.map((t) =>
    t === 'mcp' ? 'MCP' : t === 'browser-bridge' ? 'Browser Credits' : 'API Key'
  );
  return {
    connected,
    transports,
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
    case 'higgsfield':
      return { apiKey: byok.higgsfieldApiKey?.trim() || undefined };
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
