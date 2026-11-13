/**
 * Canonical Higgsfield Official MCP model catalog converter + 53-model static fallback.
 * Shared between `PLATFORM_CATALOG` and live `models_explore` MCP discovery in `server-bridge.ts`.
 */

import type {
  ModelModality,
  ModelParameterSpec,
  PlatformId,
  PlatformModelDefinition,
} from './platforms.js';

export interface RawHiggsfieldParamSpec {
  name: string;
  required?: string | boolean;
  type?: string;
  description?: string;
  default?: unknown;
  options?: Array<string | number>;
  min?: number;
  max?: number;
  step?: number;
  nullable?: boolean;
  format?: string;
  pattern?: string;
}

export interface RawHiggsfieldMediaSpec {
  name?: string;
  type?: string;
  max?: number;
  roles?: string[];
  description?: string;
}

export interface RawHiggsfieldModelSpec {
  id: string;
  name?: string;
  provider_name?: string;
  description?: string;
  output_type?: string;
  parameters?: RawHiggsfieldParamSpec[];
  medias?: RawHiggsfieldMediaSpec[];
  aspect_ratios?: string[];
  tags?: string[];
  supports_unlim?: boolean;
  durations?: number[];
  duration_range?: { min?: number; max?: number };
}

const HIGGSFIELD_LABEL_OVERRIDES: Record<string, string> = {
  gpt_image_2_6: 'ChatGPT / GPT Image 2.6',
  gpt_image_2_6_flare: 'ChatGPT / GPT Image 2.6 Flare',
  gpt_image_2_5: 'ChatGPT / GPT Image 2.5',
  gpt_image_2: 'ChatGPT / GPT Image 2',
  openai_hazel: 'OpenAI Hazel',
  soul_2: 'Higgsfield Soul 2.0',
  soul_cinematic: 'Soul Cinema',
  soul_cinema_studio: 'Soul Cinema Studio',
  cinematic_studio_2_5: 'Cinema Studio Image 2.5',
  cinematic_studio_video_4_0: 'Cinema Studio 4.0',
  cinematic_studio_video_3_5: 'Cinema Studio 3.5',
  cinematic_studio_3_0: 'Cinema Studio 3.0',
  kling4_0: 'Kling 4.0',
  kling_4_0_flash: 'Kling 4.0 Flash',
  kling3_0: 'Kling 3.0',
  kling3_0_turbo: 'Kling 3.0 Turbo',
  kling_o3_image_reference: 'Kling 3.0 Omni',
  kling_o3_flf: 'Kling 3.0 Omni (Frames)',
  voice_change: 'Voice Change',
  dubbing: 'Video Dubbing',
};

const IGNORED_MCP_PARAM_NAMES = new Set<string>([
  'folder_id',
  'brand_kit_id',
  'product_id',
  'product_ids',
  'web_product_id',
  'preset_session_id',
  'kling_element_ids',
  'light_custom',
  'dialogue',
  'medias',
  'avatar_id',
  'avatar_ids',
  'assets',
  'ad_reference_id',
  'custom_reference_id',
  'draft_job_id',
  'hook_id',
  'setting_id',
  'era_id',
  'camera_model_id',
  'camera_lens_id',
  'camera_aperture_id',
  'camera_focal_length_id',
  'genre_id',
  'light_id',
  'mode_id',
  'pacing_id',
  'preset_id',
  'style_id',
  'soul_id',
  'user_context',
  'delivery_specs',
  'transcript',
  'translations',
  'multi_prompt',
  'keyterms',
  'notes',
  'command',
  'command_version',
  'device',
  'device_id',
]);

const INLINE_PILL_PARAM_NAMES = new Set<string>([
  'quality',
  'variant',
  'mode',
  'background',
  'output_format',
]);

function titleCaseParamName(rawName: string): string {
  const special: Record<string, string> = {
    output_format: 'Output Format',
    generate_audio: 'Native Audio',
    bitrate_mode: 'Bitrate',
    thinking_level: 'Thinking',
    magic_prompt: 'Magic Prompt',
    model_type: 'Model Type',
    enhance_prompt: 'Enhance Prompt',
    enable_thinking: 'Thinking',
    sample_rate: 'Sample Rate',
    use_unlim: 'Billing Mode',
    batch_size: 'Batch Count',
    frame_count: 'GIF Frames',
    frame_duration_ms: 'GIF Frame (ms)',
    cfg_scale: 'CFG Scale',
    force_instrumental: 'Instrumental Only',
  };
  if (special[rawName]) return special[rawName];
  return rawName
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function normalizeProviderFamily(rawProvider: unknown, modelId: string): string {
  const p = String(rawProvider || '').trim();
  const lowered = p.toLowerCase();
  if (lowered === 'bytedance') return 'ByteDance';
  if (lowered === 'topaz') return 'Topaz';
  if (lowered === 'elevenlabs') return 'ElevenLabs';
  if (lowered === 'fal') return 'FAL';
  if (p) return p;

  const id = modelId.toLowerCase();
  if (id.startsWith('gpt_') || id.startsWith('openai_')) return 'OpenAI';
  if (id.startsWith('kling')) return 'Kling';
  if (id.startsWith('nano_banana') || id.startsWith('veo') || id.startsWith('gemini')) return 'Google';
  if (id.startsWith('seedream') || id.startsWith('seedance') || id.startsWith('seed_') || id.startsWith('bytedance')) return 'ByteDance';
  if (id.startsWith('flux')) return 'Black Forest Labs';
  if (id.startsWith('wan')) return 'Wan';
  if (id.startsWith('minimax')) return 'MiniMax';
  if (id.startsWith('grok')) return 'xAI';
  if (id.startsWith('ideogram')) return 'Ideogram';
  if (id.startsWith('recraft')) return 'Recraft';
  if (id.startsWith('eleven')) return 'ElevenLabs';
  if (id.startsWith('topaz')) return 'Topaz';
  if (id.startsWith('sync')) return 'Sync';
  return 'Higgsfield';
}

function buildHumanModelLabel(raw: RawHiggsfieldModelSpec): string {
  if (HIGGSFIELD_LABEL_OVERRIDES[raw.id]) return HIGGSFIELD_LABEL_OVERRIDES[raw.id];
  const rawName = String(raw.name || '').trim();
  if (rawName && rawName !== raw.id) return rawName;
  return raw.id
    .split('_')
    .filter(Boolean)
    .map((seg) => seg.charAt(0).toUpperCase() + seg.slice(1))
    .join(' ');
}

function deriveVideoDurationStops(
  raw: RawHiggsfieldModelSpec,
  durationParam: RawHiggsfieldParamSpec | undefined,
  modality: ModelModality
): number[] | undefined {
  if (Array.isArray(raw.durations) && raw.durations.length > 0) {
    return Array.from(new Set(raw.durations.map((d) => Number(d)).filter((n) => Number.isFinite(n) && n > 0))).sort((a, b) => a - b);
  }
  if (durationParam && Array.isArray(durationParam.options) && durationParam.options.length > 0) {
    return Array.from(new Set(durationParam.options.map((d) => Number(d)).filter((n) => Number.isFinite(n) && n > 0))).sort((a, b) => a - b);
  }
  if (modality !== 'video') return undefined;

  const rangeMin = typeof raw.duration_range?.min === 'number' ? raw.duration_range.min : durationParam?.min;
  const rangeMax = typeof raw.duration_range?.max === 'number' ? raw.duration_range.max : durationParam?.max;
  if (typeof rangeMin === 'number' || typeof rangeMax === 'number') {
    const min = Math.max(1, typeof rangeMin === 'number' ? rangeMin : 3);
    const max = Math.max(min, typeof rangeMax === 'number' ? rangeMax : 15);
    const stops = [2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 30].filter((s) => s >= min && s <= max);
    if (typeof durationParam?.default === 'number' && durationParam.default > 0 && !stops.includes(durationParam.default)) {
      stops.push(durationParam.default);
    }
    if (!stops.includes(min)) stops.push(min);
    if (stops.length > 0) return Array.from(new Set(stops)).sort((a, b) => a - b);
  }
  return undefined;
}

export function convertRawHiggsfieldModelToPlatformModel(
  raw: RawHiggsfieldModelSpec,
  platformId: PlatformId = 'higgsfield'
): PlatformModelDefinition {
  const rawType = String(raw.output_type || 'image').toLowerCase();
  const modality: ModelModality =
    rawType === 'video' ? 'video' : rawType === 'audio' ? 'audio' : 'image';

  const rawParams = Array.isArray(raw.parameters) ? raw.parameters : [];
  const parameters: ModelParameterSpec[] = [];
  let resolutionParam: RawHiggsfieldParamSpec | undefined;
  let durationParam: RawHiggsfieldParamSpec | undefined;

  for (const p of rawParams) {
    if (!p || !p.name) continue;
    if (p.name === 'resolution') resolutionParam = p;
    if (p.name === 'duration') durationParam = p;
    if (IGNORED_MCP_PARAM_NAMES.has(p.name)) continue;

    const pTypeLower = String(p.type || 'string').toLowerCase();
    if (pTypeLower === 'object_array' || pTypeLower === 'string_array') continue;

    const hasOptions = Array.isArray(p.options) && p.options.length > 0;
    const specType: ModelParameterSpec['type'] = hasOptions
      ? 'enum'
      : pTypeLower === 'bool' || pTypeLower === 'boolean'
        ? 'boolean'
        : pTypeLower === 'number' || pTypeLower === 'integer'
          ? 'number'
          : 'string';

    let defaultVal =
      typeof p.default === 'string' ||
      typeof p.default === 'number' ||
      typeof p.default === 'boolean'
        ? p.default
        : undefined;

    if (
      p.name === 'quality' &&
      /^gpt_image_2/.test(raw.id) &&
      hasOptions &&
      p.options!.map(String).includes('high')
    ) {
      defaultVal = 'high';
    }

    parameters.push({
      name: p.name,
      label: titleCaseParamName(p.name),
      type: specType,
      ...(hasOptions ? { options: p.options } : {}),
      ...(defaultVal !== undefined ? { default: defaultVal } : {}),
      ...(typeof p.min === 'number' ? { min: p.min } : {}),
      ...(typeof p.max === 'number' ? { max: p.max } : {}),
      ...(typeof p.step === 'number' ? { step: p.step } : {}),
      ...(p.required === 'required' || p.required === true ? { required: true } : {}),
      ...(p.description ? { description: p.description } : {}),
      ...(INLINE_PILL_PARAM_NAMES.has(p.name) ? { inlinePill: true } : {}),
    });
  }

  const supportsUnlim = Boolean(raw.supports_unlim);
  if (supportsUnlim) {
    parameters.push({
      name: 'use_unlim',
      label: 'Billing Mode',
      type: 'enum',
      options: ['auto', 'unlimited', 'credits'],
      default: 'auto',
      description: 'Use Ultimate unlimited allowance when eligible, or pay credits (allows batch > 1).',
      inlinePill: false,
    });
  }

  const rawMedias = Array.isArray(raw.medias) ? raw.medias : [];
  const mediaRoles = Array.from(
    new Set(
      rawMedias.flatMap((m) => (Array.isArray(m.roles) ? m.roles.map((r) => String(r).trim()).filter(Boolean) : []))
    )
  );
  let maxReferences = 0;
  for (const m of rawMedias) {
    if (typeof m.max === 'number' && m.max > maxReferences) {
      maxReferences = m.max;
    } else if (typeof m.description === 'string') {
      const match = /maxs+(d+)/i.exec(m.description);
      if (match) {
        const parsed = Number(match[1]);
        if (Number.isFinite(parsed) && parsed > maxReferences) maxReferences = parsed;
      }
    }
  }
  if (mediaRoles.length > 0 && maxReferences === 0) {
    maxReferences = mediaRoles.includes('image_references') ? 10 : 2;
  }

  const resolutions =
    resolutionParam && Array.isArray(resolutionParam.options) && resolutionParam.options.length > 0
      ? resolutionParam.options.map((r) => String(r))
      : undefined;

  const aspectRatios =
    Array.isArray(raw.aspect_ratios) && raw.aspect_ratios.length > 0
      ? raw.aspect_ratios.map((ar) => String(ar))
      : undefined;

  const durationsSec = deriveVideoDurationStops(raw, durationParam, modality);
  const tagsLower = Array.isArray(raw.tags) ? raw.tags.map((t) => String(t).toLowerCase()) : [];
  const hasAudioParam = parameters.some((p) => p.name === 'generate_audio' || p.name === 'sound');

  const defaultAspectRatio =
    aspectRatios && aspectRatios.includes('16:9') ? '16:9' : aspectRatios?.[0];
  const defaultResolution =
    typeof resolutionParam?.default === 'string'
      ? resolutionParam.default
      : resolutions?.[0];
  const defaultDurationSec =
    typeof durationParam?.default === 'number' && durationParam.default > 0
      ? durationParam.default
      : durationsSec?.[0];

  return {
    id: raw.id,
    label: buildHumanModelLabel(raw),
    modality,
    platformId,
    ...(raw.description ? { description: raw.description } : {}),
    providerFamily: normalizeProviderFamily(raw.provider_name, raw.id),
    ...(supportsUnlim ? { supportsUnlim: true } : {}),
    supportsReferences: mediaRoles.length > 0,
    ...(maxReferences > 0 ? { maxReferences } : {}),
    supportsStartEndFrames:
      mediaRoles.includes('start_image') || mediaRoles.includes('end_image'),
    supportsNativeAudio:
      modality === 'audio'
        ? true
        : modality === 'video'
          ? hasAudioParam || mediaRoles.includes('audio_references') || tagsLower.includes('audio')
          : false,
    ...(mediaRoles.length > 0 ? { mediaRoles } : {}),
    ...(aspectRatios ? { aspectRatios } : {}),
    ...(resolutions ? { resolutions } : {}),
    ...(durationsSec ? { durationsSec } : {}),
    ...(defaultAspectRatio ? { defaultAspectRatio } : {}),
    ...(defaultResolution ? { defaultResolution } : {}),
    ...(defaultDurationSec ? { defaultDurationSec } : {}),
    ...(parameters.length > 0 ? { parameters } : {}),
  };
}

export function convertRawHiggsfieldCatalog(
  rawItems: RawHiggsfieldModelSpec[],
  platformId: PlatformId = 'higgsfield'
): PlatformModelDefinition[] {
  const hasSoul2 = rawItems.some((item) => item && item.id === 'soul_2');
  const seen = new Set<string>();
  const out: PlatformModelDefinition[] = [];
  for (const raw of rawItems) {
    if (!raw || !raw.id) continue;
    if (hasSoul2 && raw.id === 'soul_v2') continue;
    if (seen.has(raw.id)) continue;
    seen.add(raw.id);
    out.push(convertRawHiggsfieldModelToPlatformModel(raw, platformId));
  }
  return out;
}

const HIGGSFIELD_CANONICAL_FALLBACK_RAW: RawHiggsfieldModelSpec[] = [
  {
    "id": "gpt_image_2_6",
    "name": "GPT Image 2.6",
    "provider_name": "OpenAI",
    "description": "GPT Image 2.6 Sunburst image generation and editing, GIF and SVG output",
    "output_type": "image",
    "parameters": [
      {
        "name": "quality",
        "required": "optional",
        "type": "string",
        "description": "Rendering quality.",
        "options": [
          "auto",
          "low",
          "medium",
          "high",
          "xhigh",
          "max"
        ],
        "default": "low"
      },
      {
        "name": "resolution",
        "required": "optional",
        "type": "string",
        "description": "Output resolution tier.",
        "options": [
          "1k",
          "2k",
          "4k"
        ],
        "default": "1k"
      },
      {
        "name": "background",
        "required": "optional",
        "type": "string",
        "description": "Background handling. Omit to keep the model default.",
        "options": [
          "auto",
          "opaque",
          "transparent"
        ],
        "nullable": true
      },
      {
        "name": "batch_size",
        "required": "optional",
        "type": "number",
        "description": "Number of outputs. Whole number.",
        "min": 1,
        "max": 4,
        "default": 1
      },
      {
        "name": "output_format",
        "required": "optional",
        "type": "string",
        "description": "Output file format. SVG does not accept reference images.",
        "options": [
          "png",
          "jpeg",
          "webp",
          "gif",
          "svg"
        ],
        "default": "png"
      },
      {
        "name": "size",
        "required": "optional",
        "type": "string",
        "description": "WIDTHxHEIGHT or auto. GIF defaults to 288x288; dimensions must divide by 16.",
        "nullable": true
      },
      {
        "name": "frame_count",
        "required": "optional",
        "type": "number",
        "description": "GIF only. Defaults to 9. Whole number.",
        "min": 2,
        "max": 64,
        "nullable": true
      },
      {
        "name": "frame_duration_ms",
        "required": "optional",
        "type": "number",
        "description": "GIF only. Frame duration in milliseconds; defaults to 200. Whole number.",
        "min": 20,
        "max": 2000,
        "nullable": true
      }
    ],
    "medias": [
      {
        "name": "medias",
        "type": "image",
        "roles": [
          "image_references"
        ],
        "description": "Media roles: image_references — Reference images for generation or editing. Not supported for SVG. (array, max 16)"
      }
    ],
    "aspect_ratios": [
      "auto",
      "1:1",
      "3:2",
      "2:3",
      "4:3",
      "3:4",
      "16:9",
      "9:16",
      "21:9",
      "27:16",
      "16:27",
      "9:8",
      "8:9",
      "4:5",
      "5:4"
    ],
    "tags": [
      "image-generation",
      "editing",
      "reference-images",
      "4k",
      "text-rendering",
      "vector",
      "unlim"
    ],
    "supports_unlim": true
  },
  {
    "id": "gpt_image_2_6_flare",
    "name": "GPT Image 2.6 Flare",
    "provider_name": "OpenAI",
    "description": "GPT Image 2.6 Flare image generation and editing, GIF and SVG output",
    "output_type": "image",
    "parameters": [
      {
        "name": "quality",
        "required": "optional",
        "type": "string",
        "description": "Rendering quality.",
        "options": [
          "auto",
          "low",
          "medium",
          "high",
          "xhigh",
          "max"
        ],
        "default": "low"
      },
      {
        "name": "resolution",
        "required": "optional",
        "type": "string",
        "description": "Output resolution tier.",
        "options": [
          "1k",
          "2k",
          "4k"
        ],
        "default": "1k"
      },
      {
        "name": "background",
        "required": "optional",
        "type": "string",
        "description": "Background handling. Omit to keep the model default.",
        "options": [
          "auto",
          "opaque",
          "transparent"
        ],
        "nullable": true
      },
      {
        "name": "batch_size",
        "required": "optional",
        "type": "number",
        "description": "Number of outputs. Whole number.",
        "min": 1,
        "max": 4,
        "default": 1
      },
      {
        "name": "output_format",
        "required": "optional",
        "type": "string",
        "description": "Output file format. SVG does not accept reference images.",
        "options": [
          "png",
          "jpeg",
          "webp",
          "gif",
          "svg"
        ],
        "default": "png"
      },
      {
        "name": "size",
        "required": "optional",
        "type": "string",
        "description": "WIDTHxHEIGHT or auto. GIF defaults to 288x288; dimensions must divide by 16.",
        "nullable": true
      },
      {
        "name": "frame_count",
        "required": "optional",
        "type": "number",
        "description": "GIF only. Defaults to 9. Whole number.",
        "min": 2,
        "max": 64,
        "nullable": true
      },
      {
        "name": "frame_duration_ms",
        "required": "optional",
        "type": "number",
        "description": "GIF only. Frame duration in milliseconds; defaults to 200. Whole number.",
        "min": 20,
        "max": 2000,
        "nullable": true
      }
    ],
    "medias": [
      {
        "name": "medias",
        "type": "image",
        "roles": [
          "image_references"
        ],
        "description": "Media roles: image_references — Reference images for generation or editing. Not supported for SVG. (array, max 16)"
      }
    ],
    "aspect_ratios": [
      "auto",
      "1:1",
      "3:2",
      "2:3",
      "4:3",
      "3:4",
      "16:9",
      "9:16",
      "21:9",
      "27:16",
      "16:27",
      "9:8",
      "8:9",
      "4:5",
      "5:4"
    ],
    "tags": [
      "image-generation",
      "editing",
      "reference-images",
      "4k",
      "text-rendering",
      "vector"
    ]
  },
  {
    "id": "gpt_image_2_5",
    "name": "GPT Image 2.5",
    "provider_name": "OpenAI",
    "description": "GPT Image 2.5 generation and editing with Flare and Sunburst variants",
    "output_type": "image",
    "parameters": [
      {
        "name": "variant",
        "required": "optional",
        "type": "string",
        "description": "Model variant.",
        "options": [
          "flare",
          "sunburst"
        ],
        "default": "flare"
      },
      {
        "name": "quality",
        "required": "optional",
        "type": "string",
        "description": "Rendering quality.",
        "options": [
          "low",
          "medium",
          "high",
          "xhigh",
          "max"
        ],
        "default": "low"
      },
      {
        "name": "resolution",
        "required": "optional",
        "type": "string",
        "description": "Output resolution.",
        "options": [
          "1k",
          "2k",
          "4k"
        ],
        "default": "1k"
      },
      {
        "name": "background",
        "required": "optional",
        "type": "string",
        "description": "Background handling. Omit to keep the model default.",
        "options": [
          "auto",
          "opaque",
          "transparent"
        ],
        "nullable": true
      }
    ],
    "medias": [
      {
        "name": "medias",
        "type": "image",
        "roles": [
          "image_references"
        ],
        "description": "Media roles: image_references — Reference images to guide generation or editing (max 16). (array, max 16)"
      }
    ],
    "aspect_ratios": [
      "auto",
      "1:1",
      "3:2",
      "2:3",
      "4:3",
      "3:4",
      "16:9",
      "9:16",
      "21:9",
      "27:16",
      "16:27",
      "9:8",
      "8:9",
      "4:5",
      "5:4"
    ],
    "tags": [
      "image-generation",
      "editing",
      "reference-images",
      "4k",
      "text-rendering",
      "unlim"
    ],
    "supports_unlim": true
  },
  {
    "id": "gpt_image_2",
    "name": "GPT Image 2",
    "provider_name": "OpenAI",
    "description": "Next-gen GPT Image model with 1k/2k/4k resolution and low/medium/high quality tiers",
    "output_type": "image",
    "parameters": [
      {
        "name": "resolution",
        "required": "optional",
        "type": "string",
        "description": "Output resolution",
        "default": "1k",
        "options": [
          "1k",
          "2k",
          "4k"
        ]
      },
      {
        "name": "quality",
        "required": "optional",
        "type": "string",
        "description": "Image quality",
        "default": "low",
        "options": [
          "low",
          "medium",
          "high"
        ]
      }
    ],
    "medias": [
      {
        "name": "medias",
        "type": "image",
        "roles": [
          "image"
        ]
      }
    ],
    "aspect_ratios": [
      "1:1",
      "4:3",
      "3:4",
      "16:9",
      "21:9",
      "9:16",
      "3:2",
      "2:3"
    ],
    "tags": [
      "text-rendering",
      "editing",
      "typography",
      "photorealistic",
      "4k",
      "high-resolution",
      "unlim"
    ],
    "supports_unlim": true
  },
  {
    "id": "openai_hazel",
    "name": "OpenAI Hazel",
    "provider_name": "OpenAI",
    "description": "Powerful editing, best text rendering",
    "output_type": "image",
    "parameters": [
      {
        "name": "quality",
        "required": "optional",
        "type": "string",
        "description": "Rendering quality / detail level.",
        "options": [
          "low",
          "medium",
          "high"
        ],
        "default": "medium"
      }
    ],
    "medias": [
      {
        "name": "medias",
        "type": "image",
        "roles": [
          "image_references"
        ],
        "description": "Media roles: image_references — Reference / input images to edit or condition on (max 16). (array)"
      }
    ],
    "aspect_ratios": [
      "1:1",
      "3:2",
      "2:3",
      "auto"
    ],
    "tags": [
      "text-rendering",
      "editing",
      "typography",
      "logos",
      "diagram",
      "infographic"
    ]
  },
  {
    "id": "soul_2",
    "name": "Higgsfield Soul 2.0",
    "provider_name": "Higgsfield",
    "description": "Realistic UGC, fashion editorial and character generation",
    "output_type": "image",
    "parameters": [
      {
        "name": "quality",
        "required": "optional",
        "type": "string",
        "description": "Output quality tier shown as 1.5k or 2k",
        "default": "2k",
        "options": [
          "1.5k",
          "2k"
        ]
      },
      {
        "name": "style_id",
        "required": "optional",
        "type": "string",
        "description": "Curated Soul style UUID from get_presets(source='soul'). Compatible with soul_id, but not medias/image references. Omit for the general style.",
        "format": "regex",
        "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
      },
      {
        "name": "soul_id",
        "required": "optional",
        "type": "string",
        "description": "Soul-ID for personalized generation. Get one from soul_list."
      }
    ],
    "medias": [
      {
        "name": "medias",
        "type": "image",
        "max": 1,
        "roles": [
          "image"
        ],
        "description": "roles: image x1"
      }
    ],
    "aspect_ratios": [
      "1:1",
      "16:9",
      "9:16",
      "4:3",
      "3:4",
      "3:2",
      "2:3"
    ],
    "tags": [
      "ugc",
      "fashion",
      "editorial",
      "realistic",
      "character",
      "character-generation",
      "soul",
      "portrait",
      "v2",
      "unlim"
    ],
    "supports_unlim": true
  },
  {
    "id": "soul_cinematic",
    "name": "Soul Cinema",
    "provider_name": "Higgsfield",
    "description": "Cinema-grade stills and concept art",
    "output_type": "image",
    "parameters": [
      {
        "name": "quality",
        "required": "optional",
        "type": "string",
        "description": "Output quality tier shown as 1.5k or 2k",
        "default": "2k",
        "options": [
          "1.5k",
          "2k"
        ]
      },
      {
        "name": "soul_id",
        "required": "optional",
        "type": "string",
        "description": "Soul Cinema Character ID for personalized cinematic generation."
      }
    ],
    "medias": [
      {
        "name": "medias",
        "type": "image",
        "max": 1,
        "roles": [
          "image"
        ]
      }
    ],
    "aspect_ratios": [
      "1:1",
      "4:3",
      "3:4",
      "16:9",
      "9:16",
      "3:2",
      "2:3",
      "21:9"
    ],
    "tags": [
      "cinematic",
      "dramatic",
      "concept-art",
      "lighting",
      "soul",
      "film"
    ]
  },
  {
    "id": "cinematic_studio_2_5",
    "name": "Cinema Studio Image 2.5",
    "provider_name": "Higgsfield",
    "description": "Cinematic stills, up to 4K resolution",
    "output_type": "image",
    "parameters": [
      {
        "name": "resolution",
        "required": "optional",
        "type": "string",
        "description": "Output resolution",
        "default": "1k",
        "options": [
          "1k",
          "2k",
          "4k"
        ]
      }
    ],
    "medias": [
      {
        "name": "medias",
        "type": "image",
        "roles": [
          "image"
        ]
      }
    ],
    "aspect_ratios": [
      "1:1",
      "3:2",
      "2:3",
      "4:3",
      "3:4",
      "4:5",
      "5:4",
      "16:9",
      "9:16",
      "21:9"
    ],
    "tags": [
      "cinematic",
      "4k",
      "high-resolution",
      "dramatic",
      "film"
    ]
  },
  {
    "id": "nano_banana_2_1",
    "name": "Nano Banana 2.1",
    "provider_name": "Google",
    "description": "Nano Banana 2.1 image generation with image and video references",
    "output_type": "image",
    "parameters": [
      {
        "name": "resolution",
        "required": "optional",
        "type": "string",
        "options": [
          "1k",
          "2k",
          "4k"
        ],
        "default": "1k"
      },
      {
        "name": "is_inpaint",
        "required": "optional",
        "type": "bool",
        "description": "Whether to restrict the edit to the supplied mask.",
        "default": false
      },
      {
        "name": "thinking_level",
        "required": "optional",
        "type": "string",
        "options": [
          "minimal",
          "medium",
          "high"
        ],
        "default": "medium"
      },
      {
        "name": "enable_web_search",
        "required": "optional",
        "type": "bool",
        "nullable": true
      },
      {
        "name": "enable_image_search",
        "required": "optional",
        "type": "bool",
        "nullable": true
      },
      {
        "name": "seed",
        "required": "optional",
        "type": "number",
        "description": "Whole number.",
        "min": 0,
        "max": 2147483647,
        "nullable": true
      }
    ],
    "medias": [
      {
        "name": "medias",
        "type": "image",
        "roles": [
          "image_references",
          "mask",
          "video_references"
        ],
        "description": "Media roles: image_references — Reference images for image generation or editing. (array, max 14) | mask — Full-frame mask for regional image editing. | video_references — One reference video for image generation. (array, max 1)"
      }
    ],
    "aspect_ratios": [
      "auto",
      "1:1",
      "3:2",
      "2:3",
      "4:3",
      "3:4",
      "4:5",
      "5:4",
      "9:16",
      "16:9",
      "21:9",
      "4:1",
      "1:4",
      "8:1",
      "1:8"
    ],
    "tags": [
      "fast",
      "high-quality",
      "photorealistic",
      "versatile",
      "4k",
      "text-to-image",
      "image-to-image",
      "unlim"
    ],
    "supports_unlim": true
  },
  {
    "id": "nano_banana_2",
    "name": "Nano Banana 2",
    "provider_name": "Google",
    "description": "Fast, next-gen high-quality images",
    "output_type": "image",
    "parameters": [
      {
        "name": "resolution",
        "required": "optional",
        "type": "string",
        "description": "Output resolution.",
        "options": [
          "1k",
          "2k",
          "4k"
        ],
        "default": "1k"
      },
      {
        "name": "is_inpaint",
        "required": "optional",
        "type": "bool",
        "description": "Whether to restrict the edit to the supplied mask.",
        "default": false
      }
    ],
    "medias": [
      {
        "name": "medias",
        "type": "image",
        "roles": [
          "image_references",
          "mask"
        ],
        "description": "Media roles: image_references — Reference images for image-to-image generation. (array) | mask — Full-frame mask for regional image editing."
      }
    ],
    "aspect_ratios": [
      "auto",
      "1:1",
      "3:2",
      "2:3",
      "4:3",
      "3:4",
      "4:5",
      "5:4",
      "9:16",
      "16:9",
      "21:9"
    ],
    "tags": [
      "fast",
      "high-quality",
      "photorealistic",
      "versatile",
      "4k",
      "text-to-image",
      "image-to-image",
      "unlim"
    ],
    "supports_unlim": true
  },
  {
    "id": "nano_banana_pro",
    "name": "Nano Banana Pro",
    "provider_name": "Google",
    "description": "Ultimate quality, text and diagrams",
    "output_type": "image",
    "parameters": [
      {
        "name": "resolution",
        "required": "optional",
        "type": "string",
        "description": "Output resolution.",
        "options": [
          "1k",
          "2k",
          "4k"
        ],
        "default": "2k"
      }
    ],
    "medias": [
      {
        "name": "medias",
        "type": "image",
        "roles": [
          "image_references"
        ],
        "description": "Media roles: image_references — Reference images (style, composition, or subject anchor). At most 14. (array)"
      }
    ],
    "aspect_ratios": [
      "1:1",
      "3:2",
      "2:3",
      "4:3",
      "3:4",
      "4:5",
      "5:4",
      "9:16",
      "16:9",
      "21:9"
    ],
    "tags": [
      "quality",
      "text-rendering",
      "diagrams",
      "photorealistic",
      "versatile",
      "4k",
      "text-to-image",
      "image-to-image",
      "unlim"
    ],
    "supports_unlim": true
  },
  {
    "id": "seedream_v5_pro",
    "name": "Seedream 5.0 Pro",
    "provider_name": "Bytedance",
    "description": "Pro-tier visual reasoning, instruction-based editing, up to 2K",
    "output_type": "image",
    "parameters": [
      {
        "name": "resolution",
        "required": "optional",
        "type": "string",
        "description": "Output resolution tier.",
        "options": [
          "1k",
          "1.5k",
          "2k"
        ],
        "default": "2k"
      },
      {
        "name": "width",
        "required": "optional",
        "type": "number",
        "description": "Optional output width stored with the generation. Whole number.",
        "min": 1,
        "nullable": true
      },
      {
        "name": "height",
        "required": "optional",
        "type": "number",
        "description": "Optional output height stored with the generation. Whole number.",
        "min": 1,
        "nullable": true
      },
      {
        "name": "remove_bg",
        "required": "optional",
        "type": "bool",
        "description": "Remove the background from the generated image.",
        "default": false
      },
      {
        "name": "is_inpaint",
        "required": "optional",
        "type": "bool",
        "description": "Treat the request as an inpaint/edit of the reference image(s) instead of a fresh generation.",
        "default": false
      }
    ],
    "medias": [
      {
        "name": "medias",
        "type": "image",
        "roles": [
          "image_references"
        ],
        "description": "Media roles: image_references — Reference images to guide the generation (style, composition, subject). At most 10. (array)"
      }
    ],
    "aspect_ratios": [
      "1:1",
      "4:3",
      "3:4",
      "16:9",
      "9:16",
      "3:2",
      "2:3",
      "21:9"
    ],
    "tags": [
      "editing",
      "instruction",
      "reasoning",
      "pro",
      "2k",
      "unlim"
    ],
    "supports_unlim": true
  },
  {
    "id": "seedream_v4_5",
    "name": "Seedream 4.5",
    "provider_name": "Bytedance",
    "description": "4K output, precise control, transformations",
    "output_type": "image",
    "parameters": [
      {
        "name": "quality",
        "required": "optional",
        "type": "string",
        "description": "Output quality tier. 'basic' renders up to 4K; 'high' renders up to ~6K.",
        "options": [
          "basic",
          "high"
        ],
        "default": "basic"
      }
    ],
    "medias": [
      {
        "name": "medias",
        "type": "image",
        "roles": [
          "image_references"
        ],
        "description": "Media roles: image_references — Reference images for editing, transformation, or control (at most 14). (array)"
      }
    ],
    "aspect_ratios": [
      "1:1",
      "4:3",
      "16:9",
      "3:2",
      "21:9",
      "3:4",
      "9:16",
      "2:3"
    ],
    "tags": [
      "4k",
      "high-resolution",
      "precise",
      "transformations",
      "editing",
      "control"
    ]
  },
  {
    "id": "flux_3_image",
    "name": "FLUX 3 Image",
    "provider_name": "Black Forest Labs",
    "description": "FLUX 3 image generation and editing with up to ten reference images",
    "output_type": "image",
    "parameters": [
      {
        "name": "resolution",
        "required": "optional",
        "type": "string",
        "description": "Output resolution class. Exact pixel dimensions depend on aspect ratio.",
        "options": [
          "768sq",
          "1k",
          "1.5k",
          "2k",
          "4k"
        ],
        "default": "1k"
      },
      {
        "name": "batch_size",
        "required": "optional",
        "type": "number",
        "description": "Number of output images to generate. Whole number.",
        "min": 1,
        "max": 4,
        "default": 1
      },
      {
        "name": "folder_id",
        "required": "optional",
        "type": "string",
        "description": "Optional folder to place generated images in.",
        "nullable": true
      }
    ],
    "medias": [
      {
        "name": "medias",
        "type": "image",
        "roles": [
          "image_references"
        ],
        "description": "Media roles: image_references — Up to ten reference images, in order, for editing or guided generation. (array, max 10)"
      }
    ],
    "aspect_ratios": [
      "auto",
      "21:9",
      "2:1",
      "16:9",
      "3:2",
      "7:5",
      "4:3",
      "5:4",
      "1:1",
      "4:5",
      "3:4",
      "5:7",
      "2:3",
      "9:16",
      "1:2"
    ],
    "tags": [
      "text-to-image",
      "image-to-image",
      "editing",
      "multi-reference",
      "4k"
    ]
  },
  {
    "id": "flux_2",
    "name": "FLUX.2",
    "provider_name": "Black Forest Labs",
    "description": "Multiple model variants (pro, flex, max), precise prompt adherence",
    "output_type": "image",
    "parameters": [
      {
        "name": "resolution",
        "required": "optional",
        "type": "string",
        "description": "Output resolution.",
        "options": [
          "1k",
          "2k"
        ],
        "default": "1k"
      },
      {
        "name": "variant",
        "required": "optional",
        "type": "string",
        "description": "FLUX.2 model variant.",
        "options": [
          "pro",
          "flex",
          "max"
        ],
        "default": "pro"
      }
    ],
    "medias": [
      {
        "name": "medias",
        "type": "image",
        "roles": [
          "image_references"
        ],
        "description": "Media roles: image_references — Reference images (style, composition, subject). (array)"
      }
    ],
    "aspect_ratios": [
      "1:1",
      "4:3",
      "3:4",
      "16:9",
      "9:16"
    ],
    "tags": [
      "precise",
      "prompt-adherence",
      "creative",
      "versatile",
      "pro",
      "quality"
    ]
  },
  {
    "id": "flux_kontext",
    "name": "Flux Kontext",
    "provider_name": "Black Forest Labs",
    "description": "Context-aware editing and style transfer",
    "output_type": "image",
    "parameters": [],
    "medias": [
      {
        "name": "medias",
        "type": "image",
        "roles": [
          "image_references"
        ],
        "description": "Media roles: image_references — Reference images to edit (at most 4). (array)"
      }
    ],
    "aspect_ratios": [
      "1:1",
      "4:3",
      "3:4",
      "16:9",
      "9:16"
    ],
    "tags": [
      "editing",
      "style-transfer",
      "context-aware",
      "typography",
      "remix"
    ]
  },
  {
    "id": "kling_omni_image",
    "name": "Kling O1 Image",
    "provider_name": "Kling",
    "description": "Versatile photorealistic generation",
    "output_type": "image",
    "parameters": [
      {
        "name": "resolution",
        "required": "optional",
        "type": "string",
        "description": "Output resolution.",
        "options": [
          "1k",
          "2k"
        ],
        "default": "1k"
      }
    ],
    "medias": [
      {
        "name": "medias",
        "type": "image",
        "roles": [
          "image_references"
        ],
        "description": "Media roles: image_references — Reference images guiding the generation (max 10). (array)"
      }
    ],
    "aspect_ratios": [
      "1:1",
      "auto",
      "16:9",
      "9:16",
      "4:3",
      "3:4",
      "3:2",
      "2:3",
      "21:9"
    ],
    "tags": [
      "photorealistic",
      "versatile",
      "wide-aspect-ratio",
      "realistic"
    ]
  },
  {
    "id": "ideogram_4_5",
    "name": "Ideogram 4.5",
    "provider_name": "Ideogram",
    "description": "Ideogram 4.5 image generation and transformation with up to five source images",
    "output_type": "image",
    "parameters": [
      {
        "name": "resolution",
        "required": "optional",
        "type": "string",
        "description": "Output resolution. Masked edits use source geometry.",
        "options": [
          "1k",
          "2k"
        ],
        "default": "2k"
      },
      {
        "name": "quality",
        "required": "optional",
        "type": "string",
        "description": "Generation quality. Very low requires a source image.",
        "options": [
          "very_low",
          "low",
          "medium",
          "high"
        ],
        "default": "high"
      },
      {
        "name": "magic_prompt",
        "required": "optional",
        "type": "string",
        "description": "Prompt enhancement mode.",
        "options": [
          "auto",
          "on",
          "off"
        ],
        "default": "auto"
      },
      {
        "name": "seed",
        "required": "optional",
        "type": "number",
        "description": "Optional generation seed. Whole number.",
        "min": 0,
        "max": 2147483647,
        "nullable": true
      },
      {
        "name": "batch_size",
        "required": "optional",
        "type": "number",
        "description": "Number of images to generate. Whole number.",
        "min": 1,
        "max": 4,
        "default": 1
      }
    ],
    "medias": [
      {
        "name": "medias",
        "type": "image",
        "roles": [
          "image_references",
          "mask"
        ],
        "description": "Media roles: image_references — Source images in order. The first image determines the automatic ratio. (array, max 5) | mask — Optional mask: black areas are edited and white areas are preserved. Requires one to four source images."
      }
    ],
    "aspect_ratios": [
      "auto",
      "1:1",
      "1:2",
      "2:1",
      "2:3",
      "3:2",
      "4:5",
      "5:4",
      "9:16",
      "16:9",
      "5:8",
      "8:5",
      "3:4",
      "4:3",
      "9:22",
      "22:9",
      "9:23",
      "23:9",
      "3:8",
      "8:3",
      "5:12",
      "12:5",
      "1:3",
      "3:1"
    ],
    "tags": [
      "text-to-image",
      "image-to-image",
      "editing",
      "typography"
    ]
  },
  {
    "id": "recraft_v4_1",
    "name": "Recraft V4.1",
    "provider_name": "Recraft",
    "description": "V4.1 image generation with selectable model_type for standard exploration, vector logos/icons, utility product shots/mockups, and utility_vector brand assets",
    "output_type": "image",
    "parameters": [
      {
        "name": "resolution",
        "required": "optional",
        "type": "string",
        "description": "Output resolution: 1k for everyday work, 2k for larger assets.",
        "options": [
          "1k",
          "2k"
        ],
        "default": "1k"
      },
      {
        "name": "model_type",
        "required": "optional",
        "type": "string",
        "description": "Recraft V4.1 variant. standard is expressive and exploratory; vector is for logos, typography, icons, and SVG-like illustration; utility is cleaner, flatter, front-facing, and predictable for product shots and mockups; utility_vector combines utility simplicity with vector output.",
        "options": [
          "standard",
          "vector",
          "utility",
          "utility_vector"
        ],
        "default": "standard"
      },
      {
        "name": "colors",
        "required": "optional",
        "type": "string_array",
        "description": "Optional color palette, up to 10 colors. Each color must be #RRGGBB: six hex digits with leading # and no alpha channel."
      },
      {
        "name": "background_color",
        "required": "optional",
        "type": "string",
        "description": "Optional #RRGGBB background color with no alpha channel, or null. Use for controlled flat backgrounds, brand swatches, product mockups, icons, and vector-style work.",
        "nullable": true
      }
    ],
    "medias": [],
    "aspect_ratios": [
      "1:1",
      "3:4",
      "4:3",
      "4:5",
      "5:4",
      "3:2",
      "2:3",
      "16:9",
      "9:16"
    ],
    "tags": [
      "photorealistic",
      "illustration",
      "typography",
      "logos",
      "icons",
      "vector",
      "utility",
      "product",
      "mockups",
      "brand",
      "palette",
      "text-to-image"
    ]
  },
  {
    "id": "grok_image_2_0",
    "name": "Grok Image 2.0",
    "provider_name": "xAI",
    "description": "Next-generation image creation and editing from xAI",
    "output_type": "image",
    "parameters": [
      {
        "name": "resolution",
        "required": "optional",
        "type": "string",
        "description": "Output resolution.",
        "options": [
          "1k",
          "2k"
        ],
        "default": "1k"
      },
      {
        "name": "quality",
        "required": "optional",
        "type": "string",
        "description": "Generation quality level.",
        "options": [
          "low",
          "medium"
        ],
        "default": "medium"
      }
    ],
    "medias": [
      {
        "name": "medias",
        "type": "image",
        "roles": [
          "image_references"
        ],
        "description": "Media roles: image_references — Reference images to guide the generation or edit. (array, max 3)"
      }
    ],
    "aspect_ratios": [
      "1:1",
      "auto",
      "1:2",
      "2:1",
      "3:2",
      "2:3",
      "4:3",
      "3:4",
      "16:9",
      "9:16"
    ],
    "tags": [
      "expressive",
      "high-contrast",
      "editing",
      "creative",
      "bold"
    ]
  },
  {
    "id": "minimax_h3_image",
    "name": "MiniMax H3 Image",
    "provider_name": "MiniMax",
    "description": "Image generation and editing with up to sixteen reference images",
    "output_type": "image",
    "parameters": [
      {
        "name": "resolution",
        "required": "optional",
        "type": "string",
        "description": "Output resolution class: 1K, 2K or 4K.",
        "options": [
          "1k",
          "2k",
          "4k"
        ],
        "default": "4k"
      },
      {
        "name": "batch_size",
        "required": "optional",
        "type": "number",
        "description": "Number of output images to generate (1-4). Whole number.",
        "min": 1,
        "max": 4,
        "default": 1
      },
      {
        "name": "folder_id",
        "required": "optional",
        "type": "string",
        "description": "Optional folder to place generated images in.",
        "nullable": true
      }
    ],
    "medias": [
      {
        "name": "medias",
        "type": "image",
        "roles": [
          "image_references"
        ],
        "description": "Media roles: image_references — Up to sixteen ordered reference images for editing or guided generation. (array, max 16)"
      }
    ],
    "aspect_ratios": [],
    "tags": [
      "text-to-image",
      "image-to-image",
      "editing",
      "multi-reference",
      "4k"
    ]
  },
  {
    "id": "cinematic_studio_video_4_0",
    "name": "Cinema Studio 4.0",
    "provider_name": "Higgsfield",
    "description": "Cinema-grade video generation with automatic prompt direction and camera, lighting, pacing, genre, era, and color controls",
    "output_type": "video",
    "parameters": [
      {
        "name": "mode",
        "required": "optional",
        "type": "string",
        "description": "Generation mode: 't2v' for prompt-only generation, 'omni_reference' for image, video, or audio references, 'video_edit' to edit one reference video (billed by that video's duration; 'duration' and 'aspect_ratio' are ignored), or 'video_extension' to extend a reference video ('aspect_ratio' is ignored — the output follows the extended video).",
        "options": [
          "t2v",
          "omni_reference",
          "video_edit",
          "video_extension"
        ],
        "default": "t2v"
      },
      {
        "name": "duration",
        "required": "optional",
        "type": "number",
        "description": "Duration in seconds (4-30). Whole number.",
        "min": 4,
        "max": 30,
        "default": 5
      },
      {
        "name": "resolution",
        "required": "optional",
        "type": "string",
        "description": "Output resolution: 480p, 720p, or 1080p.",
        "options": [
          "480p",
          "720p",
          "1080p"
        ],
        "default": "720p"
      },
      {
        "name": "generate_audio",
        "required": "optional",
        "type": "bool",
        "description": "Generate audio for the output video.",
        "default": true
      },
      {
        "name": "bitrate_mode",
        "required": "optional",
        "type": "string",
        "description": "'standard' = normal output bitrate; 'high' = higher bitrate output.",
        "options": [
          "standard",
          "high"
        ],
        "default": "standard"
      },
      {
        "name": "extension_mode",
        "required": "optional",
        "type": "string",
        "description": "Extension direction; required for mode 'video_extension' and not allowed otherwise.",
        "options": [
          "backward",
          "forward"
        ],
        "nullable": true
      },
      {
        "name": "era_id",
        "required": "optional",
        "type": "string",
        "description": "Cinema Studio 4.0 creative-control id selecting the film era.",
        "nullable": true
      },
      {
        "name": "camera_model_id",
        "required": "optional",
        "type": "string",
        "description": "Cinema Studio 4.0 creative-control id selecting the camera body.",
        "nullable": true
      },
      {
        "name": "camera_lens_id",
        "required": "optional",
        "type": "string",
        "description": "Cinema Studio 4.0 creative-control id selecting the lens.",
        "nullable": true
      },
      {
        "name": "camera_aperture_id",
        "required": "optional",
        "type": "string",
        "description": "Cinema Studio 4.0 creative-control id selecting the aperture.",
        "nullable": true
      },
      {
        "name": "pacing_id",
        "required": "optional",
        "type": "string",
        "description": "Cinema Studio 4.0 creative-control id selecting montage pacing.",
        "nullable": true
      },
      {
        "name": "genre_id",
        "required": "optional",
        "type": "string",
        "description": "Cinema Studio 4.0 creative-control id selecting the film genre.",
        "nullable": true
      },
      {
        "name": "light",
        "required": "optional",
        "type": "string",
        "description": "Lighting source: 'preset' for a Cinema Studio scheme, 'user' for the caller's saved lighting preset, or 'custom' for a placed rig.",
        "options": [
          "preset",
          "custom",
          "user"
        ],
        "nullable": true
      },
      {
        "name": "light_id",
        "required": "optional",
        "type": "string",
        "description": "Lighting id. Use a Cinema Studio control id with light='preset', a saved lighting-preset id with light='user', or 'custom' for a placed rig.",
        "nullable": true
      },
      {
        "name": "light_custom",
        "required": "optional",
        "type": "object_array",
        "description": "Ordered custom lighting rig. The first source is the key light. Each item is an object {direction: top|bottom|left|right|front|back|top-left|top-right|bottom-left|bottom-right|front-top|front-bottom|front-left|front-right|back-top|back-bottom|back-left|back-right|front-top-left|front-top-right|front-bottom-left|front-bottom-right|back-top-left|back-top-right|back-bottom-left|back-bottom-right (required), color: string, brightness: integer, diffuse: integer}.",
        "nullable": true
      },
      {
        "name": "color_palette",
        "required": "optional",
        "type": "string",
        "description": "Color palette selection with type 'preset' or 'user' and its id.",
        "nullable": true
      }
    ],
    "medias": [
      {
        "name": "medias",
        "type": "image",
        "roles": [
          "start_image",
          "end_image",
          "image_references",
          "video_references",
          "audio_references"
        ],
        "description": "Media roles: start_image — First frame of the output video (mode 'omni_reference' only). | end_image — Last frame of the output video (mode 'omni_reference' only). | image_references — Reference images for subject, style, or composition (max 30 across image_references + start_image + end_image). (array, max 30) | video_references — Reference video clips (max 10). (array, max 10) | audio_references — Reference audio clips (max 10). (array, max 10)"
      }
    ],
    "aspect_ratios": [
      "auto",
      "21:9",
      "16:9",
      "4:3",
      "1:1",
      "3:4",
      "9:16"
    ],
    "tags": [
      "cinematic",
      "director",
      "text-to-video",
      "reference",
      "audio-reference",
      "video-reference",
      "video-edit",
      "video-extension",
      "480p",
      "720p"
    ]
  },
  {
    "id": "cinematic_studio_video_3_5",
    "name": "Cinematic Studio Video 3.5",
    "description": "",
    "output_type": "video",
    "parameters": [
      {
        "name": "resolution",
        "required": "optional",
        "type": "string",
        "description": "Output resolution of the video.",
        "options": [
          "480p",
          "720p",
          "1080p"
        ],
        "default": "720p"
      },
      {
        "name": "duration",
        "required": "optional",
        "type": "number",
        "description": "Total duration of the video in seconds (minimum 4). Whole number.",
        "min": 4,
        "default": 15
      },
      {
        "name": "genre",
        "required": "optional",
        "type": "string",
        "description": "Cinematic genre hint.",
        "options": [
          "auto",
          "action",
          "horror",
          "comedy",
          "noir",
          "drama",
          "epic"
        ],
        "default": "auto"
      },
      {
        "name": "generate_audio",
        "required": "optional",
        "type": "bool",
        "description": "Generate native audio for the video. Set false for a silent video.",
        "default": false
      },
      {
        "name": "enhance_prompt",
        "required": "optional",
        "type": "bool",
        "description": "Automatically rewrite the prompt for richer detail.",
        "default": false
      },
      {
        "name": "prompt_language",
        "required": "optional",
        "type": "string",
        "description": "Language the prompt is written in.",
        "options": [
          "en",
          "zh"
        ],
        "default": "zh"
      },
      {
        "name": "multi_shots",
        "required": "optional",
        "type": "bool",
        "description": "Split the video into multiple shots driven by multi_prompt.",
        "default": false
      },
      {
        "name": "multi_shot_mode",
        "required": "optional",
        "type": "string",
        "description": "'auto' lets the model plan shots; 'custom' uses the given multi_prompt.",
        "options": [
          "auto",
          "custom"
        ],
        "default": "custom"
      },
      {
        "name": "multi_prompt",
        "required": "optional",
        "type": "object_array",
        "description": "Per-shot prompts and durations (max 6) used when multi_shots is enabled. Each item is an object {prompt: string (required), duration: integer}."
      },
      {
        "name": "camera_style",
        "required": "optional",
        "type": "string",
        "description": "Camera movement and framing style.",
        "options": [
          "classic_static",
          "silent_machine",
          "one_take",
          "epic_scale",
          "intimate_observer",
          "impossible_camera",
          "documentary_snap",
          "raw_chaos",
          "dreamy_flow"
        ],
        "nullable": true
      },
      {
        "name": "light_scheme",
        "required": "optional",
        "type": "string",
        "description": "Lighting scheme for the scene.",
        "options": [
          "soft_cross",
          "contre_jour",
          "overhead_fall",
          "window",
          "practicals",
          "silhouette"
        ],
        "nullable": true
      },
      {
        "name": "color_grading",
        "required": "optional",
        "type": "string",
        "description": "Color grading look applied to the video.",
        "options": [
          "naturalistic_clean",
          "bleached_warm",
          "hyper_neon",
          "teal_orange_epic",
          "sodium_decay",
          "cold_steel",
          "bleach_bypass",
          "classic_bw"
        ],
        "nullable": true
      },
      {
        "name": "style_prompt",
        "required": "optional",
        "type": "string",
        "description": "Free-form description of the visual style. At most 2000 characters.",
        "nullable": true
      }
    ],
    "medias": [
      {
        "name": "medias",
        "type": "image",
        "roles": [
          "start_image",
          "end_image",
          "image_references",
          "video_references",
          "audio_references"
        ],
        "description": "Media roles: start_image — First frame of the output video. | end_image — Last frame of the output video. | image_references — Generic reference images (style, composition, subject). At most 15 media total across image_references + start_image + end_image + video_references + audio_references. (array) | video_references — Reference video clips. (array) | audio_references — Reference audio clips. (array)"
      }
    ],
    "aspect_ratios": [
      "auto",
      "21:9",
      "16:9",
      "4:3",
      "1:1",
      "3:4",
      "9:16"
    ],
    "tags": []
  },
  {
    "id": "cinematic_studio_3_0",
    "name": "Cinema Studio Video 3.0",
    "provider_name": "Higgsfield",
    "description": "Most advanced cinema-grade model",
    "output_type": "video",
    "parameters": [
      {
        "name": "resolution",
        "required": "optional",
        "type": "string",
        "description": "Output resolution (higher = more credits)",
        "default": "720p",
        "options": [
          "480p",
          "720p",
          "1080p",
          "4k"
        ]
      },
      {
        "name": "genre",
        "required": "optional",
        "type": "string",
        "description": "Cinematic genre hint",
        "default": "auto",
        "options": [
          "auto",
          "action",
          "horror",
          "comedy",
          "noir",
          "drama",
          "epic"
        ]
      },
      {
        "name": "generate_audio",
        "required": "optional",
        "type": "bool",
        "description": "Generate audio for the video.",
        "default": false
      }
    ],
    "medias": [
      {
        "name": "medias",
        "type": "image",
        "roles": [
          "image",
          "start_image",
          "end_image"
        ]
      }
    ],
    "aspect_ratios": [
      "auto",
      "21:9",
      "16:9",
      "4:3",
      "1:1",
      "3:4",
      "9:16"
    ],
    "tags": [
      "cinematic",
      "premium",
      "advanced",
      "sota",
      "film",
      "best-quality"
    ],
    "duration_range": {
      "min": 4,
      "max": 15
    }
  },
  {
    "id": "kling4_0",
    "name": "Kling 4.0",
    "provider_name": "Kling",
    "description": "Generate video from text, ordered keyframes, references, or edit an input video",
    "output_type": "video",
    "parameters": [
      {
        "name": "mode",
        "required": "optional",
        "type": "string",
        "description": "Generation mode.",
        "options": [
          "text-to-video",
          "image-to-video",
          "reference-to-video",
          "video-edit"
        ],
        "default": "text-to-video"
      },
      {
        "name": "resolution",
        "required": "optional",
        "type": "string",
        "description": "Output resolution.",
        "options": [
          "720p",
          "1080p"
        ],
        "default": "1080p"
      },
      {
        "name": "duration",
        "required": "optional",
        "type": "number",
        "description": "Duration in whole seconds (3-30). Whole number.",
        "min": 3,
        "max": 30,
        "default": 10
      },
      {
        "name": "kling_element_ids",
        "required": "optional",
        "type": "string_array",
        "description": "Accessible, ready Kling element IDs or reference UUIDs (up to seven)."
      }
    ],
    "medias": [
      {
        "name": "medias",
        "type": "image",
        "roles": [
          "start_image",
          "end_image",
          "image_references",
          "video_references"
        ],
        "description": "Media roles: start_image — Optional first frame; included in the ten-image limit. | end_image — Optional last frame; included in the ten-image limit. | image_references — Ordered middle frames in image-to-video; reference images in other modes. (array, max 10) | video_references — In video-edit: the base video first, then reference videos. (array, max 5)"
      }
    ],
    "aspect_ratios": [
      "21:9",
      "16:9",
      "9:16",
      "1:1",
      "auto"
    ],
    "tags": [
      "text-to-video",
      "image-to-video",
      "reference-to-video",
      "video-edit",
      "keyframes"
    ]
  },
  {
    "id": "kling_4_0_flash",
    "name": "Kling 4.0 Flash",
    "provider_name": "Kling",
    "description": "Fast 720p video from text, one first frame, references, or an input video",
    "output_type": "video",
    "parameters": [
      {
        "name": "mode",
        "required": "optional",
        "type": "string",
        "description": "Generation mode.",
        "options": [
          "text-to-video",
          "image-to-video",
          "reference-to-video",
          "video-edit"
        ],
        "default": "text-to-video"
      },
      {
        "name": "resolution",
        "required": "optional",
        "type": "string",
        "description": "Output resolution.",
        "options": [
          "720p"
        ],
        "default": "720p"
      },
      {
        "name": "duration",
        "required": "optional",
        "type": "number",
        "description": "Duration in whole seconds (3-20). Whole number.",
        "min": 3,
        "max": 20,
        "default": 10
      },
      {
        "name": "kling_element_ids",
        "required": "optional",
        "type": "string_array",
        "description": "Accessible, ready Kling element IDs or reference UUIDs (up to seven)."
      }
    ],
    "medias": [
      {
        "name": "medias",
        "type": "image",
        "roles": [
          "start_image",
          "image_references",
          "video_references"
        ],
        "description": "Media roles: start_image — First frame; required in image-to-video. | image_references — Reference images for reference-to-video and video-edit. (array, max 10) | video_references — In video-edit: the base video first, then reference videos. (array, max 5)"
      }
    ],
    "aspect_ratios": [
      "21:9",
      "16:9",
      "9:16",
      "1:1",
      "auto"
    ],
    "tags": [
      "fast",
      "text-to-video",
      "image-to-video",
      "reference-to-video",
      "video-edit"
    ]
  },
  {
    "id": "kling3_0",
    "name": "Kling v3.0",
    "provider_name": "Kling",
    "description": "Multi-shot, audio sync, motion transfer",
    "output_type": "video",
    "parameters": [
      {
        "name": "duration",
        "required": "optional",
        "type": "number",
        "description": "Duration in seconds (3-15). Whole number.",
        "min": 3,
        "max": 15,
        "default": 5
      },
      {
        "name": "mode",
        "required": "optional",
        "type": "string",
        "description": "Generation mode: 'std' (standard), 'pro' (higher quality), or '4k' (4K resolution).",
        "options": [
          "std",
          "pro",
          "4k"
        ],
        "default": "std"
      },
      {
        "name": "sound",
        "required": "optional",
        "type": "string",
        "description": "Generate audio. Use 'off' for silent video and lower credits.",
        "options": [
          "on",
          "off"
        ],
        "default": "on"
      }
    ],
    "medias": [
      {
        "name": "medias",
        "type": "image",
        "roles": [
          "start_image",
          "end_image"
        ],
        "description": "Media roles: start_image — First frame of the output video. | end_image — Last frame of the output video."
      }
    ],
    "aspect_ratios": [
      "16:9",
      "9:16",
      "1:1"
    ],
    "tags": [
      "multi-shot",
      "audio",
      "motion-transfer",
      "cinematic",
      "advanced"
    ]
  },
  {
    "id": "kling3_0_turbo",
    "name": "Kling 3.0 Turbo",
    "provider_name": "Kling",
    "description": "Fast text-to-video and single start-frame animation",
    "output_type": "video",
    "parameters": [
      {
        "name": "resolution",
        "required": "optional",
        "type": "string",
        "description": "Output resolution.",
        "options": [
          "720p",
          "1080p"
        ],
        "default": "720p"
      },
      {
        "name": "duration",
        "required": "optional",
        "type": "number",
        "description": "Duration in seconds (3-15). Whole number.",
        "min": 3,
        "max": 15,
        "default": 5
      }
    ],
    "medias": [
      {
        "name": "medias",
        "type": "image",
        "roles": [
          "start_image"
        ],
        "description": "Media roles: start_image — Optional first frame (image-to-video); omit for text-to-video."
      }
    ],
    "aspect_ratios": [
      "16:9",
      "9:16",
      "1:1"
    ],
    "tags": [
      "fast",
      "turbo",
      "text-to-video",
      "image-to-video",
      "start-frame",
      "budget",
      "kling"
    ]
  },
  {
    "id": "kling_o3_image_reference",
    "name": "Kling 3.0 Omni",
    "provider_name": "Kling",
    "description": "Generate video from text and up to seven reference images",
    "output_type": "video",
    "parameters": [
      {
        "name": "duration",
        "required": "optional",
        "type": "number",
        "description": "Duration in seconds (3-15). Whole number.",
        "min": 3,
        "max": 15,
        "default": 5
      },
      {
        "name": "mode",
        "required": "optional",
        "type": "string",
        "description": "Output quality: Standard, Pro, or 4K.",
        "options": [
          "std",
          "pro",
          "4k"
        ],
        "default": "std"
      },
      {
        "name": "sound",
        "required": "optional",
        "type": "string",
        "description": "Generate audio or a silent video.",
        "options": [
          "on",
          "off"
        ],
        "default": "on"
      },
      {
        "name": "multi_shots",
        "required": "optional",
        "type": "bool",
        "description": "Generate a sequence of multiple shots.",
        "default": false
      },
      {
        "name": "multi_prompt",
        "required": "optional",
        "type": "object_array",
        "description": "Ordered shot prompts and durations; required when multi_shots is true. Each item is an object {prompt: string (required), duration: integer}."
      }
    ],
    "medias": [
      {
        "name": "medias",
        "type": "image",
        "roles": [
          "image_references"
        ],
        "description": "Media roles: image_references — Optional reference images for the video (up to seven). (array, max 7)"
      }
    ],
    "aspect_ratios": [
      "16:9",
      "9:16",
      "1:1"
    ],
    "tags": [
      "multi-shot",
      "audio",
      "4k"
    ]
  },
  {
    "id": "kling_o3_flf",
    "name": "Kling 3.0 Omni (Frames)",
    "provider_name": "Kling",
    "description": "Generate video from text or a first frame and optional last frame",
    "output_type": "video",
    "parameters": [
      {
        "name": "duration",
        "required": "optional",
        "type": "number",
        "description": "Duration in seconds (3-15). Whole number.",
        "min": 3,
        "max": 15,
        "default": 5
      },
      {
        "name": "mode",
        "required": "optional",
        "type": "string",
        "description": "Output quality: Standard, Pro, or 4K.",
        "options": [
          "std",
          "pro",
          "4k"
        ],
        "default": "std"
      },
      {
        "name": "sound",
        "required": "optional",
        "type": "string",
        "description": "Generate audio or a silent video.",
        "options": [
          "on",
          "off"
        ],
        "default": "on"
      },
      {
        "name": "multi_shots",
        "required": "optional",
        "type": "bool",
        "description": "Generate a sequence of multiple shots.",
        "default": false
      },
      {
        "name": "multi_prompt",
        "required": "optional",
        "type": "object_array",
        "description": "Ordered shot prompts and durations; required when multi_shots is true. Each item is an object {prompt: string (required), duration: integer}."
      }
    ],
    "medias": [
      {
        "name": "medias",
        "type": "image",
        "roles": [
          "start_image",
          "end_image"
        ],
        "description": "Media roles: start_image — Optional first frame; omit for text-to-video. | end_image — Optional last frame; requires start_image."
      }
    ],
    "aspect_ratios": [
      "16:9",
      "9:16",
      "1:1"
    ],
    "tags": [
      "multi-shot",
      "audio",
      "4k"
    ]
  },
  {
    "id": "seedance_2_5",
    "name": "Seedance 2.5",
    "provider_name": "Bytedance",
    "description": "Seedance 2.5 text-to-video, multimodal omni-reference generation, video edit, and video extension",
    "output_type": "video",
    "parameters": [
      {
        "name": "mode",
        "required": "optional",
        "type": "string",
        "description": "Generation mode: 't2v' for prompt-only generation, 'omni_reference' for image, video, or audio references, 'video_edit' to edit one reference video (billed by that video's duration; 'duration' and 'aspect_ratio' are ignored), or 'video_extension' to extend a reference video ('aspect_ratio' is ignored — the output follows the extended video).",
        "options": [
          "t2v",
          "omni_reference",
          "video_edit",
          "video_extension"
        ],
        "default": "t2v"
      },
      {
        "name": "duration",
        "required": "optional",
        "type": "number",
        "description": "Duration in seconds (4-30). Whole number.",
        "min": 4,
        "max": 30,
        "default": 5
      },
      {
        "name": "resolution",
        "required": "optional",
        "type": "string",
        "description": "Output resolution.",
        "options": [
          "480p",
          "720p",
          "1080p",
          "4k"
        ],
        "default": "720p"
      },
      {
        "name": "generate_audio",
        "required": "optional",
        "type": "bool",
        "description": "Generate audio for the output video.",
        "default": true
      },
      {
        "name": "bitrate_mode",
        "required": "optional",
        "type": "string",
        "description": "'standard' = normal output bitrate; 'high' = higher bitrate output.",
        "options": [
          "standard",
          "high"
        ],
        "default": "standard"
      },
      {
        "name": "extension_mode",
        "required": "optional",
        "type": "string",
        "description": "Extension direction; required for mode 'video_extension' and not allowed otherwise.",
        "options": [
          "backward",
          "forward"
        ],
        "nullable": true
      },
      {
        "name": "draft",
        "required": "optional",
        "type": "bool",
        "description": "Generate a 480p draft that can be finalized within seven days.",
        "default": false
      },
      {
        "name": "draft_job_id",
        "required": "optional",
        "type": "string",
        "description": "Completed draft job to finalize at the selected resolution. The final renders the draft's full duration and is billed for it; 'duration' is ignored.",
        "nullable": true
      }
    ],
    "medias": [
      {
        "name": "medias",
        "type": "image",
        "roles": [
          "start_image",
          "end_image",
          "image_references",
          "video_references",
          "audio_references"
        ],
        "description": "Media roles: start_image — First frame of the output video (mode 'omni_reference' only). | end_image — Last frame of the output video (mode 'omni_reference' only). | image_references — Reference images for subject, style, or composition (max 30 across image_references + start_image + end_image). (array, max 30) | video_references — Reference video clips (max 10). (array, max 10) | audio_references — Reference audio clips (max 10). (array, max 10)"
      }
    ],
    "aspect_ratios": [
      "auto",
      "21:9",
      "16:9",
      "4:3",
      "1:1",
      "3:4",
      "9:16"
    ],
    "tags": [
      "text-to-video",
      "reference",
      "identity",
      "audio-reference",
      "video-reference",
      "video-edit",
      "video-extension",
      "480p",
      "720p",
      "1080p",
      "unlim"
    ],
    "supports_unlim": true
  },
  {
    "id": "seedance_2_5_flash",
    "name": "Seedance 2.5 Flash",
    "provider_name": "Bytedance",
    "description": "Seedance 2.5 Flash video generation, editing, and extension",
    "output_type": "video",
    "parameters": [
      {
        "name": "mode",
        "required": "optional",
        "type": "string",
        "description": "Generation mode: 't2v' for prompt-only generation, 'omni_reference' for image, video, or audio references, 'video_edit' to edit one reference video (billed by that video's duration; 'duration' and 'aspect_ratio' are ignored), or 'video_extension' to extend a reference video ('aspect_ratio' is ignored — the output follows the extended video).",
        "options": [
          "t2v",
          "omni_reference",
          "video_edit",
          "video_extension"
        ],
        "default": "t2v"
      },
      {
        "name": "duration",
        "required": "optional",
        "type": "number",
        "description": "Duration in seconds (4-30). Whole number.",
        "min": 4,
        "max": 30,
        "default": 5
      },
      {
        "name": "resolution",
        "required": "optional",
        "type": "string",
        "options": [
          "480p",
          "720p"
        ],
        "default": "720p"
      },
      {
        "name": "generate_audio",
        "required": "optional",
        "type": "bool",
        "description": "Generate audio for the output video.",
        "default": true
      },
      {
        "name": "bitrate_mode",
        "required": "optional",
        "type": "string",
        "description": "'standard' = normal output bitrate; 'high' = higher bitrate output.",
        "options": [
          "standard",
          "high"
        ],
        "default": "standard"
      },
      {
        "name": "extension_mode",
        "required": "optional",
        "type": "string",
        "description": "Extension direction; required for mode 'video_extension' and not allowed otherwise.",
        "options": [
          "backward",
          "forward"
        ],
        "nullable": true
      }
    ],
    "medias": [
      {
        "name": "medias",
        "type": "image",
        "roles": [
          "start_image",
          "end_image",
          "image_references",
          "video_references",
          "audio_references"
        ],
        "description": "Media roles: start_image — First frame of the output video (mode 'omni_reference' only). | end_image — Last frame of the output video (mode 'omni_reference' only). | image_references (array, max 10) | video_references (array, max 5) | audio_references (array, max 5)"
      }
    ],
    "aspect_ratios": [
      "auto",
      "21:9",
      "16:9",
      "4:3",
      "1:1",
      "3:4",
      "9:16"
    ],
    "tags": [
      "text-to-video",
      "reference",
      "identity",
      "audio-reference",
      "video-reference",
      "video-edit",
      "video-extension",
      "480p",
      "720p"
    ]
  },
  {
    "id": "seedance_2_0",
    "name": "Seedance 2.0",
    "provider_name": "Bytedance",
    "description": "Reference-driven video with image/video/audio reference inputs, consistent identity, multi-SKU; optional generate_audio for native audio",
    "output_type": "video",
    "parameters": [
      {
        "name": "duration",
        "required": "optional",
        "type": "number",
        "description": "Duration in seconds (4-15). Whole number.",
        "min": 4,
        "max": 15,
        "default": 5
      },
      {
        "name": "resolution",
        "required": "optional",
        "type": "string",
        "description": "Output resolution. 4k/1080p require mode='std'; mode='fast' supports 480p/720p only.",
        "options": [
          "480p",
          "720p",
          "1080p",
          "4k"
        ],
        "default": "720p"
      },
      {
        "name": "mode",
        "required": "optional",
        "type": "string",
        "description": "'std' = higher quality, supports 480p/720p/1080p/4k, requires a Plus plan or higher (Pro on legacy plans); 'fast' = cheaper/faster, supports 480p/720p only, available from the Basic/Starter plan.",
        "options": [
          "std",
          "fast"
        ],
        "default": "std"
      },
      {
        "name": "bitrate_mode",
        "required": "optional",
        "type": "string",
        "description": "'standard' = normal output bitrate; 'high' = higher bitrate output.",
        "options": [
          "standard",
          "high"
        ],
        "default": "standard"
      },
      {
        "name": "genre",
        "required": "optional",
        "type": "string",
        "description": "Cinematic genre hint.",
        "options": [
          "auto",
          "action",
          "horror",
          "comedy",
          "noir",
          "drama",
          "epic"
        ],
        "default": "auto"
      },
      {
        "name": "generate_audio",
        "required": "optional",
        "type": "bool",
        "description": "Generate native audio for the video. Set false for a silent video. Independent of audio_references.",
        "default": true
      }
    ],
    "medias": [
      {
        "name": "medias",
        "type": "image",
        "roles": [
          "start_image",
          "end_image",
          "image_references",
          "video_references",
          "audio_references"
        ],
        "description": "Media roles: start_image — First frame of the output video. | end_image — Last frame of the output video. | image_references — Generic reference images (style, composition, subject). At most 9 across image_references + start_image + end_image. (array) | video_references — Reference video clips (2-15s each, max 3). (array) | audio_references — Reference audio clips (2-15s each, max 3; require at least one image or video reference). (array)"
      }
    ],
    "aspect_ratios": [
      "auto",
      "16:9",
      "9:16",
      "4:3",
      "3:4",
      "1:1",
      "21:9"
    ],
    "tags": [
      "reference",
      "identity",
      "consistent",
      "product",
      "multi-sku",
      "e-commerce",
      "audio",
      "audio-reference",
      "video-reference",
      "start-frame",
      "end-frame",
      "4k",
      "high-resolution",
      "unlim"
    ],
    "supports_unlim": true
  },
  {
    "id": "veo3_1",
    "name": "Google Veo 3.1",
    "provider_name": "Google",
    "description": "Ultra-realistic, top-tier cinematic quality",
    "output_type": "video",
    "parameters": [
      {
        "name": "duration",
        "required": "optional",
        "type": "number",
        "description": "Duration of the output video in seconds.",
        "options": [
          4,
          6,
          8
        ],
        "default": 8
      },
      {
        "name": "quality",
        "required": "optional",
        "type": "string",
        "description": "Output quality tier.",
        "options": [
          "basic",
          "high",
          "ultra"
        ],
        "default": "basic"
      },
      {
        "name": "variant",
        "required": "optional",
        "type": "string",
        "description": "Veo 3.1 variant: 'veo-3-1-preview' = best quality, 'veo-3-1-fast' = faster generation.",
        "options": [
          "veo-3-1-preview",
          "veo-3-1-fast"
        ],
        "default": "veo-3-1-fast"
      }
    ],
    "medias": [
      {
        "name": "medias",
        "type": "image",
        "roles": [
          "start_image"
        ],
        "description": "Media roles: start_image — Optional source image used as the first frame of the video (image-to-video). Omit for text-to-video."
      }
    ],
    "aspect_ratios": [
      "16:9",
      "9:16"
    ],
    "tags": [
      "ultra-realistic",
      "cinematic",
      "top-tier",
      "quality",
      "audio"
    ]
  },
  {
    "id": "veo3_1_lite",
    "name": "Google Veo 3.1 Lite",
    "provider_name": "Google",
    "description": "Fast, affordable, budget batch clips",
    "output_type": "video",
    "parameters": [
      {
        "name": "duration",
        "required": "optional",
        "type": "number",
        "description": "Duration of the output video in seconds.",
        "options": [
          4,
          6,
          8
        ],
        "default": 8
      },
      {
        "name": "generate_audio",
        "required": "optional",
        "type": "bool",
        "description": "Generate native audio for the video.",
        "default": false
      }
    ],
    "medias": [
      {
        "name": "medias",
        "type": "image",
        "roles": [
          "start_image",
          "end_image"
        ],
        "description": "Media roles: start_image — First frame of the output video. | end_image — Last frame of the output video."
      }
    ],
    "aspect_ratios": [
      "16:9",
      "9:16",
      "auto"
    ],
    "tags": [
      "fast",
      "budget",
      "affordable",
      "batch",
      "lite"
    ]
  },
  {
    "id": "gemini_omni_flash_1_2",
    "name": "Gemini Omni Flash 1.2",
    "provider_name": "Google",
    "description": "Gemini Omni Flash 1.2 video generation, keyframes, multimodal references, editing with reference images, and clip extension with native audio",
    "output_type": "video",
    "parameters": [
      {
        "name": "mode",
        "required": "required",
        "type": "string",
        "description": "Generation mode.",
        "options": [
          "text-to-video",
          "image-to-video",
          "reference-to-video",
          "edit",
          "extend"
        ]
      },
      {
        "name": "duration",
        "required": "optional",
        "type": "number",
        "description": "Output seconds: 3-15 for text or a single first frame, 3-10 for references or first/last frames. For extend, 3-10 added seconds. Ignored for edit, which uses the source length (3-15 seconds). Whole number.",
        "min": 3,
        "max": 15,
        "default": 8
      },
      {
        "name": "resolution",
        "required": "optional",
        "type": "string",
        "description": "Output resolution: 360p, 720p, 1080p, or 4K.",
        "options": [
          "360p",
          "720p",
          "1080p",
          "4k"
        ],
        "default": "720p"
      }
    ],
    "medias": [
      {
        "name": "medias",
        "type": "image",
        "roles": [
          "start_image",
          "end_image",
          "image_references",
          "video_references"
        ],
        "description": "Media roles: start_image — First frame for mode 'image-to-video'. | end_image — Optional final frame for mode 'image-to-video'. | image_references — Up to 7 reference images for reference-to-video or edit. (array, max 7) | video_references — Up to 3 reference videos for reference-to-video, or exactly one source video for edit (3-15 seconds) or extend (1-30 seconds). (array, max 3)"
      }
    ],
    "aspect_ratios": [
      "16:9",
      "9:16"
    ],
    "tags": [
      "audio",
      "text-to-video",
      "image-to-video",
      "reference",
      "video-edit",
      "360p",
      "720p",
      "1080p",
      "4k",
      "video-extend"
    ]
  },
  {
    "id": "gemini_omni_flash_1_1",
    "name": "Gemini Omni Flash 1.1",
    "provider_name": "Google",
    "description": "Gemini Omni Flash 1.1 text-to-video, keyframe animation, multimodal reference generation, and video editing with native audio",
    "output_type": "video",
    "parameters": [
      {
        "name": "mode",
        "required": "required",
        "type": "string",
        "description": "Generation mode.",
        "options": [
          "text-to-video",
          "image-to-video",
          "reference-to-video",
          "edit"
        ]
      },
      {
        "name": "duration",
        "required": "optional",
        "type": "number",
        "description": "Output duration in seconds (3-10). Ignored in edit mode, which uses the source video duration capped at 30 seconds. Whole number.",
        "min": 3,
        "max": 10,
        "default": 8
      },
      {
        "name": "resolution",
        "required": "optional",
        "type": "string",
        "description": "Output resolution: 360p, 720p, 1080p, or 4K.",
        "options": [
          "360p",
          "720p",
          "1080p",
          "4k"
        ],
        "default": "720p"
      }
    ],
    "medias": [
      {
        "name": "medias",
        "type": "image",
        "roles": [
          "start_image",
          "end_image",
          "image_references",
          "video_references"
        ],
        "description": "Media roles: start_image — First frame for mode 'image-to-video'. | end_image — Optional final frame for mode 'image-to-video'. | image_references — Reference images for mode 'reference-to-video': up to 7, or up to 5 when a video reference is provided. (array, max 7) | video_references — Reference video for mode 'reference-to-video', or the source video for mode 'edit'. (array, max 1)"
      }
    ],
    "aspect_ratios": [
      "16:9",
      "9:16"
    ],
    "tags": [
      "audio",
      "text-to-video",
      "image-to-video",
      "reference",
      "video-edit",
      "360p",
      "720p",
      "1080p",
      "4k"
    ]
  },
  {
    "id": "flux_3_video",
    "name": "FLUX 3 Video",
    "provider_name": "Black Forest Labs",
    "description": "Text-to-video, multi-frame image-to-video, and video continuation with synchronized audio",
    "output_type": "video",
    "parameters": [
      {
        "name": "duration",
        "required": "optional",
        "type": "number",
        "description": "Duration in whole seconds (5-20). Whole number.",
        "min": 5,
        "max": 20,
        "default": 5
      },
      {
        "name": "resolution",
        "required": "optional",
        "type": "string",
        "description": "Output resolution: 720p, 1080p, 2K, or 4K.",
        "options": [
          "720p",
          "1080p",
          "2k",
          "4k"
        ],
        "default": "720p"
      },
      {
        "name": "generate_audio",
        "required": "optional",
        "type": "bool",
        "description": "Generate synchronized speech, effects, and ambience.",
        "default": true
      }
    ],
    "medias": [
      {
        "name": "medias",
        "type": "image",
        "roles": [
          "start_image",
          "end_image",
          "image_references",
          "video_references"
        ],
        "description": "Media roles: start_image — Optional first frame for image-to-video. | end_image — Optional final frame for image-to-video. Requires start_image. | image_references — Ordered intermediate frames for image-to-video. (array, max 10) | video_references — One source video to continue from its final frames. (array, max 1)"
      }
    ],
    "aspect_ratios": [
      "auto",
      "21:9",
      "2:1",
      "16:9",
      "4:3",
      "1:1",
      "3:4",
      "9:16"
    ],
    "tags": [
      "text-to-video",
      "image-to-video",
      "video-continuation",
      "audio",
      "start-frame",
      "end-frame",
      "storyboard",
      "1080p",
      "2k",
      "4k"
    ]
  },
  {
    "id": "wan3_0_prime",
    "name": "Wan 3.0 Prime",
    "provider_name": "Wan",
    "description": "Wan 3.0 Prime text-to-video, first/last frame video, and multimodal reference-to-video with native audio",
    "output_type": "video",
    "parameters": [
      {
        "name": "duration",
        "required": "optional",
        "type": "number",
        "description": "Duration in seconds (2-30), or -1 to let the model choose the length from the prompt and media. Smart duration (-1) is only available for unlimited generations. Whole number.",
        "min": -1,
        "max": 30,
        "default": 5
      },
      {
        "name": "resolution",
        "required": "optional",
        "type": "string",
        "description": "Output resolution: 480p, 720p, or 1080p.",
        "options": [
          "480p",
          "720p",
          "1080p"
        ],
        "default": "720p"
      },
      {
        "name": "generate_audio",
        "required": "optional",
        "type": "bool",
        "description": "Generate a native audio track for the output video.",
        "default": true
      },
      {
        "name": "enable_thinking",
        "required": "optional",
        "type": "bool",
        "description": "Let the model reason about the prompt before generating (slower, better prompt adherence).",
        "default": false
      }
    ],
    "medias": [
      {
        "name": "medias",
        "type": "image",
        "roles": [
          "start_image",
          "end_image",
          "image_references",
          "video_references",
          "audio_references"
        ],
        "description": "Media roles: start_image — First frame of the output video. Cannot be combined with reference media. | end_image — Last frame of the output video; requires start_image. | image_references — Reference images for subject, style, or composition (max 10). (array, max 10) | video_references — Reference video clips (max 5). (array, max 5) | audio_references — Reference audio clips (max 5). (array, max 5)"
      }
    ],
    "aspect_ratios": [
      "auto",
      "16:9",
      "9:16",
      "1:1",
      "4:3",
      "3:4"
    ],
    "tags": [
      "text-to-video",
      "reference",
      "identity",
      "audio-reference",
      "video-reference",
      "first-last-frame",
      "sound",
      "thinking",
      "480p",
      "720p",
      "1080p",
      "prime"
    ]
  },
  {
    "id": "wan3_0",
    "name": "Wan 3.0",
    "provider_name": "Wan",
    "description": "Wan 3.0 text-to-video, first/last frame video, and multimodal reference-to-video with native audio",
    "output_type": "video",
    "parameters": [
      {
        "name": "duration",
        "required": "optional",
        "type": "number",
        "description": "Duration in seconds (2-30), or -1 to let the model choose the length from the prompt and media. Smart duration (-1) is only available for unlimited generations. Whole number.",
        "min": -1,
        "max": 30,
        "default": 5
      },
      {
        "name": "resolution",
        "required": "optional",
        "type": "string",
        "description": "Output resolution: 480p, 720p, or 1080p.",
        "options": [
          "480p",
          "720p",
          "1080p"
        ],
        "default": "720p"
      },
      {
        "name": "generate_audio",
        "required": "optional",
        "type": "bool",
        "description": "Generate a native audio track for the output video.",
        "default": true
      },
      {
        "name": "enable_thinking",
        "required": "optional",
        "type": "bool",
        "description": "Let the model reason about the prompt before generating (slower, better prompt adherence).",
        "default": false
      }
    ],
    "medias": [
      {
        "name": "medias",
        "type": "image",
        "roles": [
          "start_image",
          "end_image",
          "image_references",
          "video_references",
          "audio_references"
        ],
        "description": "Media roles: start_image — First frame of the output video. Cannot be combined with reference media. | end_image — Last frame of the output video; requires start_image. | image_references — Reference images for subject, style, or composition (max 10). (array, max 10) | video_references — Reference video clips (max 5). (array, max 5) | audio_references — Reference audio clips (max 5). (array, max 5)"
      }
    ],
    "aspect_ratios": [
      "auto",
      "16:9",
      "9:16",
      "1:1",
      "4:3",
      "3:4"
    ],
    "tags": [
      "text-to-video",
      "reference",
      "identity",
      "audio-reference",
      "video-reference",
      "first-last-frame",
      "sound",
      "thinking",
      "480p",
      "720p",
      "1080p"
    ]
  },
  {
    "id": "wan2_7",
    "name": "Wan 2.7",
    "provider_name": "Wan",
    "description": "Synchronized audio, character-consistent video",
    "output_type": "video",
    "parameters": [
      {
        "name": "duration",
        "required": "optional",
        "type": "number",
        "description": "Duration in seconds (2-15). Whole number.",
        "min": 2,
        "max": 15,
        "default": 5
      },
      {
        "name": "resolution",
        "required": "optional",
        "type": "string",
        "description": "Output resolution.",
        "options": [
          "720p",
          "1080p"
        ],
        "default": "720p"
      }
    ],
    "medias": [
      {
        "name": "medias",
        "type": "image",
        "roles": [
          "start_image",
          "end_image",
          "audio_references"
        ],
        "description": "Media roles: start_image — First frame of the output video. | end_image — Last frame of the output video. | audio_references — Reference audio clips for audio-synced generation. (array)"
      }
    ],
    "aspect_ratios": [
      "16:9",
      "9:16",
      "1:1",
      "4:3",
      "3:4"
    ],
    "tags": [
      "audio",
      "character",
      "consistent",
      "sync",
      "sound"
    ]
  },
  {
    "id": "wan2_6",
    "name": "Wan 2.6 Video",
    "provider_name": "Wan",
    "description": "Open-weight, stylized, experimental creative",
    "output_type": "video",
    "parameters": [
      {
        "name": "quality",
        "required": "optional",
        "type": "string",
        "description": "Output resolution / quality.",
        "options": [
          "720p",
          "1080p"
        ],
        "default": "720p"
      },
      {
        "name": "duration",
        "required": "optional",
        "type": "number",
        "description": "Duration in seconds.",
        "options": [
          5,
          10,
          15
        ],
        "default": 5
      }
    ],
    "medias": [
      {
        "name": "medias",
        "type": "image",
        "roles": [
          "image_references",
          "video_references",
          "audio_references"
        ],
        "description": "Media roles: image_references — Optional reference image (at most one). (array, max 1) | video_references — Reference video clips (at most three). (array, max 3) | audio_references — Reference audio (at most one). (array, max 1)"
      }
    ],
    "aspect_ratios": [
      "16:9",
      "9:16",
      "1:1"
    ],
    "tags": [
      "stylized",
      "experimental",
      "creative",
      "open-weight",
      "artistic"
    ]
  },
  {
    "id": "minimax_h3",
    "name": "MiniMax H3",
    "provider_name": "MiniMax",
    "description": "Multimodal video generation with keyframes or image/video/audio references",
    "output_type": "video",
    "parameters": [
      {
        "name": "duration",
        "required": "optional",
        "type": "number",
        "description": "Duration in seconds (4-15). Whole number.",
        "min": 4,
        "max": 15,
        "default": 5
      },
      {
        "name": "resolution",
        "required": "optional",
        "type": "string",
        "description": "Output resolution.",
        "options": [
          "2K"
        ],
        "default": "2K"
      },
      {
        "name": "batch_size",
        "required": "optional",
        "type": "number",
        "description": "Number of videos to generate (1-4). Whole number.",
        "min": 1,
        "max": 4,
        "default": 1
      },
      {
        "name": "folder_id",
        "required": "optional",
        "type": "string",
        "description": "Optional folder to place the generated video in.",
        "nullable": true
      }
    ],
    "medias": [
      {
        "name": "medias",
        "type": "image",
        "roles": [
          "start_image",
          "end_image",
          "image_references",
          "video_references",
          "audio_references"
        ],
        "description": "Media roles: start_image — Optional first frame of the output video. | end_image — Optional last frame; requires start_image. | image_references — Reference images for subject, style, or composition (max 9). (array, max 9) | video_references — Reference video clips (max 3). (array, max 3) | audio_references — Reference audio clips (max 3); require an image or video reference. (array, max 3)"
      }
    ],
    "aspect_ratios": [
      "auto",
      "21:9",
      "16:9",
      "4:3",
      "1:1",
      "3:4",
      "9:16"
    ],
    "tags": [
      "text-to-video",
      "image-to-video",
      "reference",
      "audio-reference",
      "video-reference",
      "start-frame",
      "end-frame",
      "2k"
    ]
  },
  {
    "id": "minimax_h3_max",
    "name": "MiniMax H3 Max",
    "provider_name": "MiniMax",
    "description": "Fast text-to-video, keyframe, and multimodal-reference video generation",
    "output_type": "video",
    "parameters": [
      {
        "name": "duration",
        "required": "optional",
        "type": "number",
        "description": "Duration in seconds (5-15). Whole number.",
        "min": 5,
        "max": 15,
        "default": 5
      },
      {
        "name": "resolution",
        "required": "optional",
        "type": "string",
        "description": "Output resolution.",
        "options": [
          "480p",
          "768p"
        ],
        "default": "768p"
      },
      {
        "name": "batch_size",
        "required": "optional",
        "type": "number",
        "description": "Number of videos to generate (1-4). Whole number.",
        "min": 1,
        "max": 4,
        "default": 1
      },
      {
        "name": "folder_id",
        "required": "optional",
        "type": "string",
        "description": "Optional folder to place the generated video in.",
        "nullable": true
      }
    ],
    "medias": [
      {
        "name": "medias",
        "type": "image",
        "roles": [
          "start_image",
          "end_image",
          "image_references",
          "video_references",
          "audio_references"
        ],
        "description": "Media roles: start_image — Optional first frame of the output video. | end_image — Optional last frame; requires start_image. | image_references — Optional subject or style reference images (max 12). (array, max 12) | video_references — Optional motion/reference video clips. (array, max 12) | audio_references — Optional reference audio clips; requires an image or video reference. (array, max 12)"
      }
    ],
    "aspect_ratios": [
      "auto",
      "21:9",
      "16:9",
      "4:3",
      "1:1",
      "3:4",
      "9:16"
    ],
    "tags": [
      "text-to-video",
      "image-to-video",
      "reference",
      "video-reference",
      "audio-reference",
      "start-frame",
      "end-frame",
      "fast"
    ]
  },
  {
    "id": "minimax_hailuo",
    "name": "Minimax Hailuo",
    "provider_name": "Hailuo",
    "description": "Natural physics, facial emotion, multiple variants",
    "output_type": "video",
    "parameters": [
      {
        "name": "variant",
        "required": "optional",
        "type": "string",
        "description": "Minimax Hailuo model variant.",
        "options": [
          "minimax",
          "minimax-fast",
          "minimax-2.3",
          "minimax-2.3-fast"
        ],
        "default": "minimax-2.3"
      },
      {
        "name": "duration",
        "required": "optional",
        "type": "number",
        "description": "Duration in seconds.",
        "options": [
          6,
          10
        ],
        "default": 6
      },
      {
        "name": "resolution",
        "required": "optional",
        "type": "string",
        "description": "Output resolution. '512' is incompatible with end_image, and is not supported by the 'minimax-2.3' / 'minimax-2.3-fast' variants.",
        "options": [
          "512",
          "768",
          "1080"
        ],
        "default": "768"
      }
    ],
    "medias": [
      {
        "name": "medias",
        "type": "image",
        "roles": [
          "start_image",
          "end_image"
        ],
        "description": "Media roles: start_image — First frame of the output video. | end_image — Last frame of the output video. Not supported with resolution '512'."
      }
    ],
    "aspect_ratios": [],
    "tags": [
      "physics",
      "emotion",
      "facial",
      "realistic",
      "1080p",
      "natural"
    ]
  },
  {
    "id": "grok_video_v15",
    "name": "Grok Video 1.5",
    "provider_name": "xAI",
    "description": "Multimodal video generation from text, a start image, or image and audio references",
    "output_type": "video",
    "parameters": [
      {
        "name": "resolution",
        "required": "optional",
        "type": "string",
        "description": "Output resolution.",
        "options": [
          "480p",
          "720p",
          "1080p"
        ],
        "default": "720p"
      },
      {
        "name": "duration",
        "required": "optional",
        "type": "number",
        "description": "Duration in seconds (2-15). Whole number.",
        "min": 2,
        "max": 15,
        "default": 5
      }
    ],
    "medias": [
      {
        "name": "medias",
        "type": "image",
        "roles": [
          "start_image",
          "image_references",
          "audio_references"
        ],
        "description": "Media roles: start_image — Optional source image — the first frame of the generated video. | image_references — Reference images for subject, style, or composition (max 7). (array, max 7) | audio_references — Optional reference audio; requires at least one image reference. (array, max 1)"
      }
    ],
    "aspect_ratios": [],
    "tags": [
      "audio",
      "cinematic",
      "text-to-video",
      "image-to-video",
      "reference",
      "audio-reference",
      "start-frame",
      "physics",
      "camera-motion",
      "preview"
    ]
  },
  {
    "id": "elevenlabs_v4",
    "name": "Eleven v4",
    "provider_name": "ElevenLabs",
    "description": "Eleven v4 speech generation with up to 10 preset or reference-element voices. Dialogue text is limited to 10,000 characters in total.",
    "output_type": "audio",
    "parameters": [
      {
        "name": "dialogue",
        "required": "required",
        "type": "object_array",
        "description": "Ordered speech turns with a required voice per turn; 10,000 characters in total. Eleven v4 supports up to 10 voices; Turbo supports one voice. Each item is an object {text: string (required), voice_type: preset|element (required), voice_id: string (required)}."
      },
      {
        "name": "stability",
        "required": "optional",
        "type": "number",
        "description": "Voice stability; omit to use the provider default.",
        "min": 0,
        "max": 1,
        "nullable": true
      },
      {
        "name": "similarity_boost",
        "required": "optional",
        "type": "number",
        "description": "Voice similarity; omit to use the provider default.",
        "min": 0,
        "max": 1,
        "nullable": true
      },
      {
        "name": "batch_size",
        "required": "optional",
        "type": "number",
        "description": "Number of independent variations to generate. Whole number.",
        "min": 1,
        "max": 4,
        "default": 1
      }
    ],
    "medias": [],
    "aspect_ratios": [],
    "tags": [
      "audio",
      "speech",
      "tts",
      "text-to-speech",
      "voice",
      "dialogue",
      "elevenlabs"
    ]
  },
  {
    "id": "elevenlabs_v4_turbo",
    "name": "Eleven v4 Turbo",
    "provider_name": "ElevenLabs",
    "description": "Eleven v4 Turbo speech generation with one preset or reference-element voice. All dialogue turns must use the same voice; text is limited to 10,000 characters in total.",
    "output_type": "audio",
    "parameters": [
      {
        "name": "dialogue",
        "required": "required",
        "type": "object_array",
        "description": "Ordered speech turns with a required voice per turn; 10,000 characters in total. Eleven v4 supports up to 10 voices; Turbo supports one voice. Each item is an object {text: string (required), voice_type: preset|element (required), voice_id: string (required)}."
      },
      {
        "name": "stability",
        "required": "optional",
        "type": "number",
        "description": "Voice stability; omit to use the provider default.",
        "min": 0,
        "max": 1,
        "nullable": true
      },
      {
        "name": "similarity_boost",
        "required": "optional",
        "type": "number",
        "description": "Voice similarity; omit to use the provider default.",
        "min": 0,
        "max": 1,
        "nullable": true
      },
      {
        "name": "batch_size",
        "required": "optional",
        "type": "number",
        "description": "Number of independent variations to generate. Whole number.",
        "min": 1,
        "max": 4,
        "default": 1
      }
    ],
    "medias": [],
    "aspect_ratios": [],
    "tags": [
      "audio",
      "speech",
      "tts",
      "text-to-speech",
      "voice",
      "dialogue",
      "elevenlabs"
    ]
  },
  {
    "id": "elevenlabs_music_v2_5",
    "name": "ElevenLabs Music v2.5",
    "provider_name": "ElevenLabs",
    "description": "Music generation from a prompt or custom lyrics, with required duration and up to four variations. Custom lyrics support up to 120 seconds.",
    "output_type": "audio",
    "parameters": [
      {
        "name": "duration",
        "required": "required",
        "type": "number",
        "description": "Duration in seconds; custom lyrics support up to 120 seconds.",
        "min": 3,
        "max": 600
      },
      {
        "name": "force_instrumental",
        "required": "optional",
        "type": "bool",
        "description": "Generate without vocals.",
        "default": false
      },
      {
        "name": "lyrics",
        "required": "optional",
        "type": "string",
        "description": "Custom lyrics; omit for prompt mode.",
        "nullable": true
      },
      {
        "name": "batch_size",
        "required": "optional",
        "type": "number",
        "description": "Number of variations. Whole number.",
        "min": 1,
        "max": 4,
        "default": 1
      }
    ],
    "medias": [],
    "aspect_ratios": [],
    "tags": [
      "audio",
      "music",
      "text-to-music",
      "elevenlabs",
      "lyrics",
      "instrumental"
    ]
  },
  {
    "id": "seed_audio",
    "name": "Seed Audio 1.0",
    "provider_name": "ByteDance",
    "description": "Seed Audio 1.0 — text-to-audio synthesis with optional voice/audio reference or a single image reference.",
    "output_type": "audio",
    "parameters": [
      {
        "name": "format",
        "required": "optional",
        "type": "string",
        "description": "Output audio container format.",
        "options": [
          "wav",
          "mp3",
          "pcm",
          "ogg_opus"
        ],
        "default": "wav"
      },
      {
        "name": "sample_rate",
        "required": "optional",
        "type": "number",
        "description": "Output sample rate in Hz.",
        "options": [
          8000,
          16000,
          24000,
          32000,
          44100,
          48000
        ],
        "default": 24000
      },
      {
        "name": "speech_rate",
        "required": "optional",
        "type": "number",
        "description": "Speech speed adjustment. 0 keeps the default speed; positive values are faster. Whole number.",
        "min": -50,
        "max": 100,
        "default": 0
      },
      {
        "name": "loudness_rate",
        "required": "optional",
        "type": "number",
        "description": "Loudness adjustment. 0 keeps the default loudness. Whole number.",
        "min": -50,
        "max": 100,
        "default": 0
      },
      {
        "name": "pitch_rate",
        "required": "optional",
        "type": "number",
        "description": "Pitch adjustment in provider units. 0 keeps the default pitch. Whole number.",
        "min": -12,
        "max": 12,
        "default": 0
      },
      {
        "name": "voice_type",
        "required": "optional",
        "type": "string",
        "description": "Optional voice source: 'preset' for a built-in voice id, or 'element' for a workspace voice reference element. Must be sent together with voice_id.",
        "options": [
          "preset",
          "element"
        ],
        "nullable": true
      },
      {
        "name": "voice_id",
        "required": "optional",
        "type": "string",
        "description": "Voice id: a preset voice id when voice_type='preset', or a voice reference element id when voice_type='element'. Must be sent together with voice_type.",
        "nullable": true
      }
    ],
    "medias": [
      {
        "name": "medias",
        "type": "image",
        "roles": [
          "image_references",
          "audio_references"
        ],
        "description": "Media roles: image_references — Optional image reference. Mutually exclusive with audio_references and with a voice. (array, max 1) | audio_references — Optional voice/audio references. Up to three clips are supported and may be addressed as @Audio 1, @Audio 2, and @Audio 3 in the prompt. With a voice, at most two audio clips are allowed (3 refs total), and they occupy @Audio 2 and @Audio 3. (array, max 3)"
      }
    ],
    "aspect_ratios": [],
    "tags": [
      "audio",
      "text-to-speech",
      "tts",
      "bytedance",
      "seed-audio",
      "unlim"
    ],
    "supports_unlim": true
  },
  {
    "id": "text2speech_v2",
    "name": "Text to Speech V2",
    "provider_name": "Higgsfield",
    "description": "Text-to-speech with a selectable engine (ElevenLabs, MiniMax, Seed Speech, Vibe Voice, Cozy Voice) via the variant param; preset or reference-element voices (voice_type + voice_id).",
    "output_type": "audio",
    "parameters": [
      {
        "name": "variant",
        "required": "required",
        "type": "string",
        "description": "Text-to-speech engine.",
        "options": [
          "elevenlabs",
          "minimax",
          "seed_speech",
          "vibe_voice",
          "cozy_voice"
        ]
      },
      {
        "name": "voice_type",
        "required": "required",
        "type": "string",
        "description": "Whether voice_id is a built-in preset voice ('preset') or a workspace reference element ('element').",
        "options": [
          "preset",
          "element"
        ]
      },
      {
        "name": "voice_id",
        "required": "required",
        "type": "string",
        "description": "Voice id: a preset voice id when voice_type='preset', or a reference element id when voice_type='element'."
      }
    ],
    "medias": [],
    "aspect_ratios": [],
    "tags": [
      "audio",
      "speech",
      "tts",
      "text-to-speech",
      "voice",
      "preset",
      "reference-element",
      "elevenlabs",
      "minimax",
      "seed_speech",
      "vibe_voice",
      "cozy_voice",
      "unlim"
    ],
    "supports_unlim": true
  },
  {
    "id": "qwen_audio_tts",
    "name": "Qwen Audio 3.0 TTS Flash",
    "provider_name": "Alibaba Cloud",
    "description": "Qwen Audio 3.0 TTS Flash with expressive instructions and a selectable system preset or cloned reference-element voice.",
    "output_type": "audio",
    "parameters": [
      {
        "name": "voice_type",
        "required": "required",
        "type": "string",
        "description": "Use 'preset' for a system voice or 'element' for a cloned voice.",
        "options": [
          "preset",
          "element"
        ]
      },
      {
        "name": "voice_id",
        "required": "required",
        "type": "string",
        "description": "Preset or reference-element voice ID. At least 1 character."
      },
      {
        "name": "instruction",
        "required": "optional",
        "type": "string",
        "description": "Natural-language direction for emotion, dialect, speed, or style. At most 128 characters.",
        "nullable": true
      },
      {
        "name": "language",
        "required": "optional",
        "type": "string",
        "description": "Optional target-language hint.",
        "options": [
          "zh",
          "en",
          "fr",
          "de",
          "ja",
          "ko",
          "ru",
          "pt",
          "th",
          "id",
          "vi",
          "it",
          "ms"
        ],
        "nullable": true
      },
      {
        "name": "format",
        "required": "optional",
        "type": "string",
        "description": "Output audio container format.",
        "options": [
          "wav",
          "mp3",
          "pcm",
          "ogg_opus"
        ],
        "default": "mp3"
      },
      {
        "name": "sample_rate",
        "required": "optional",
        "type": "number",
        "description": "Output sample rate in Hz.",
        "options": [
          8000,
          16000,
          22050,
          24000,
          44100,
          48000
        ],
        "default": 24000
      },
      {
        "name": "volume",
        "required": "optional",
        "type": "number",
        "description": "Whole number.",
        "min": 0,
        "max": 100,
        "default": 50
      },
      {
        "name": "speech_rate",
        "required": "optional",
        "type": "number",
        "min": 0.5,
        "max": 2,
        "default": 1
      },
      {
        "name": "pitch_rate",
        "required": "optional",
        "type": "number",
        "min": 0.5,
        "max": 2,
        "default": 1
      },
      {
        "name": "seed",
        "required": "optional",
        "type": "number",
        "description": "Whole number.",
        "min": 0,
        "max": 65535,
        "default": 0
      },
      {
        "name": "batch_size",
        "required": "optional",
        "type": "number",
        "description": "Number of independent variations to generate. Whole number.",
        "min": 1,
        "max": 4,
        "default": 1
      }
    ],
    "medias": [],
    "aspect_ratios": [],
    "tags": [
      "audio",
      "speech",
      "tts",
      "text-to-speech",
      "voice",
      "voice-cloning",
      "reference-element",
      "qwen",
      "alibaba"
    ]
  },
  {
    "id": "inworld_text_to_speech",
    "name": "Inworld Text to Speech",
    "provider_name": "FAL",
    "description": "Text-to-speech audio generation. Game pipeline only.",
    "output_type": "audio",
    "parameters": [
      {
        "name": "voice",
        "required": "required",
        "type": "string",
        "description": "Voice to use for text-to-speech synthesis (language tag in parentheses).",
        "options": [
          "Loretta (en)",
          "Darlene (en)",
          "Marlene (en)",
          "Hank (en)",
          "Evelyn (en)",
          "Celeste (en)",
          "Pippa (en)",
          "Tessa (en)",
          "Liam (en)",
          "Callum (en)",
          "Hamish (en)",
          "Abby (en)",
          "Graham (en)",
          "Rupert (en)",
          "Mortimer (en)",
          "Snik (en)",
          "Anjali (en)",
          "Saanvi (en)",
          "Arjun (en)",
          "Claire (en)",
          "Oliver (en)",
          "Simon (en)",
          "Elliot (en)",
          "James (en)",
          "Serena (en)",
          "Gareth (en)",
          "Vinny (en)",
          "Lauren (en)",
          "Jessica (en)",
          "Ethan (en)",
          "Tyler (en)",
          "Jason (en)",
          "Chloe (en)",
          "Veronica (en)",
          "Victoria (en)",
          "Miranda (en)",
          "Sebastian (en)",
          "Victor (en)",
          "Malcolm (en)",
          "Kayla (en)",
          "Nate (en)",
          "Jake (en)",
          "Brian (en)",
          "Amina (en)",
          "Kelsey (en)",
          "Derek (en)",
          "Grant (en)",
          "Evan (en)",
          "Alex (en)",
          "Ashley (en)",
          "Craig (en)",
          "Deborah (en)",
          "Dennis (en)",
          "Edward (en)",
          "Elizabeth (en)",
          "Hades (en)",
          "Julia (en)",
          "Pixie (en)",
          "Mark (en)",
          "Olivia (en)",
          "Priya (en)",
          "Ronald (en)",
          "Sarah (en)",
          "Shaun (en)",
          "Theodore (en)",
          "Timothy (en)",
          "Wendy (en)",
          "Dominus (en)",
          "Hana (en)",
          "Clive (en)",
          "Carter (en)",
          "Blake (en)",
          "Luna (en)",
          "Yichen (zh)",
          "Xiaoyin (zh)",
          "Xinyi (zh)",
          "Jing (zh)",
          "Erik (nl)",
          "Katrien (nl)",
          "Lennart (nl)",
          "Lore (nl)",
          "Alain (fr)",
          "Hélène (fr)",
          "Mathieu (fr)",
          "Étienne (fr)",
          "Johanna (de)",
          "Josef (de)",
          "Gianni (it)",
          "Orietta (it)",
          "Asuka (ja)",
          "Satoshi (ja)",
          "Hyunwoo (ko)",
          "Minji (ko)",
          "Seojun (ko)",
          "Yoona (ko)",
          "Szymon (pl)",
          "Wojciech (pl)",
          "Heitor (pt)",
          "Maitê (pt)",
          "Diego (es)",
          "Lupita (es)",
          "Miguel (es)",
          "Rafael (es)",
          "Svetlana (ru)",
          "Elena (ru)",
          "Dmitry (ru)",
          "Nikolai (ru)",
          "Riya (hi)",
          "Manoj (hi)",
          "Yael (he)",
          "Oren (he)",
          "Nour (ar)",
          "Omar (ar)"
        ]
      }
    ],
    "medias": [],
    "aspect_ratios": [],
    "tags": [
      "audio",
      "speech",
      "tts",
      "text-to-speech",
      "fal",
      "inworld"
    ]
  }
];

export const HIGGSFIELD_CANONICAL_MODELS: PlatformModelDefinition[] =
  convertRawHiggsfieldCatalog(HIGGSFIELD_CANONICAL_FALLBACK_RAW, 'higgsfield');
