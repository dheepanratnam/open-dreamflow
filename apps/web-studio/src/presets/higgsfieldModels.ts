import type { PlatformModelDefinition } from '../types/studio';

/** Complete Higgsfield Official MCP catalog (Image, Video & Audio) synchronized from live models_explore schemas. */
export const HIGGSFIELD_MODELS: PlatformModelDefinition[] = [
  {
    "id": "gpt_image_2_6",
    "label": "ChatGPT / GPT Image 2.6",
    "modality": "image",
    "providerFamily": "OpenAI",
    "description": "Unlimited on Ultimate · GPT Image 2.6 Sunburst image generation and editing, GIF and SVG output",
    "supportsUnlim": true,
    "mediaRoles": [
      "image_references"
    ],
    "aspectRatios": [
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
    "resolutions": [
      "1k",
      "2k",
      "4k"
    ],
    "parameters": [
      {
        "name": "quality",
        "label": "Quality",
        "type": "enum",
        "options": [
          "auto",
          "low",
          "medium",
          "high",
          "xhigh",
          "max"
        ],
        "default": "low",
        "description": "Rendering quality.",
        "inlinePill": true
      },
      {
        "name": "background",
        "label": "Background",
        "type": "enum",
        "options": [
          "auto",
          "opaque",
          "transparent"
        ],
        "description": "Background handling. Omit to keep the model default."
      },
      {
        "name": "output_format",
        "label": "Format",
        "type": "enum",
        "options": [
          "png",
          "jpeg",
          "webp",
          "gif",
          "svg"
        ],
        "default": "png",
        "description": "Output file format. SVG does not accept reference images."
      },
      {
        "name": "size",
        "label": "Size",
        "type": "string",
        "description": "WIDTHxHEIGHT or auto. GIF defaults to 288x288; dimensions must divide by 16."
      },
      {
        "name": "frame_count",
        "label": "GIF Frames",
        "type": "number",
        "min": 2,
        "max": 64,
        "description": "GIF only. Defaults to 9. Whole number."
      },
      {
        "name": "frame_duration_ms",
        "label": "GIF Speed (ms)",
        "type": "number",
        "min": 20,
        "max": 2000,
        "description": "GIF only. Frame duration in milliseconds; defaults to 200. Whole number."
      },
      {
        "name": "use_unlim",
        "label": "Billing Mode",
        "type": "enum",
        "options": [
          "auto",
          "unlimited",
          "credits"
        ],
        "default": "auto",
        "description": "Auto uses Ultimate unlimited for 1x and credits for multi-batch, or force queue mode."
      }
    ],
    "supportsReferences": true,
    "maxReferences": 16,
    "supportsAudio": false,
    "defaultAspect": "16:9",
    "defaultResolution": "1k"
  },
  {
    "id": "gpt_image_2_6_flare",
    "label": "ChatGPT / GPT Image 2.6 Flare",
    "modality": "image",
    "providerFamily": "OpenAI",
    "description": "GPT Image 2.6 Flare image generation and editing, GIF and SVG output",
    "mediaRoles": [
      "image_references"
    ],
    "aspectRatios": [
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
    "resolutions": [
      "1k",
      "2k",
      "4k"
    ],
    "parameters": [
      {
        "name": "quality",
        "label": "Quality",
        "type": "enum",
        "options": [
          "auto",
          "low",
          "medium",
          "high",
          "xhigh",
          "max"
        ],
        "default": "low",
        "description": "Rendering quality.",
        "inlinePill": true
      },
      {
        "name": "background",
        "label": "Background",
        "type": "enum",
        "options": [
          "auto",
          "opaque",
          "transparent"
        ],
        "description": "Background handling. Omit to keep the model default."
      },
      {
        "name": "output_format",
        "label": "Format",
        "type": "enum",
        "options": [
          "png",
          "jpeg",
          "webp",
          "gif",
          "svg"
        ],
        "default": "png",
        "description": "Output file format. SVG does not accept reference images."
      },
      {
        "name": "size",
        "label": "Size",
        "type": "string",
        "description": "WIDTHxHEIGHT or auto. GIF defaults to 288x288; dimensions must divide by 16."
      },
      {
        "name": "frame_count",
        "label": "GIF Frames",
        "type": "number",
        "min": 2,
        "max": 64,
        "description": "GIF only. Defaults to 9. Whole number."
      },
      {
        "name": "frame_duration_ms",
        "label": "GIF Speed (ms)",
        "type": "number",
        "min": 20,
        "max": 2000,
        "description": "GIF only. Frame duration in milliseconds; defaults to 200. Whole number."
      }
    ],
    "supportsReferences": true,
    "maxReferences": 16,
    "supportsAudio": false,
    "defaultAspect": "16:9",
    "defaultResolution": "1k"
  },
  {
    "id": "gpt_image_2_5",
    "label": "ChatGPT / GPT Image 2.5",
    "modality": "image",
    "providerFamily": "OpenAI",
    "description": "Unlimited on Ultimate · GPT Image 2.5 generation and editing with Flare and Sunburst variants",
    "supportsUnlim": true,
    "mediaRoles": [
      "image_references"
    ],
    "aspectRatios": [
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
    "resolutions": [
      "1k",
      "2k",
      "4k"
    ],
    "parameters": [
      {
        "name": "variant",
        "label": "Variant",
        "type": "enum",
        "options": [
          "flare",
          "sunburst"
        ],
        "default": "flare",
        "description": "Model variant.",
        "inlinePill": true
      },
      {
        "name": "quality",
        "label": "Quality",
        "type": "enum",
        "options": [
          "low",
          "medium",
          "high",
          "xhigh",
          "max"
        ],
        "default": "low",
        "description": "Rendering quality.",
        "inlinePill": true
      },
      {
        "name": "background",
        "label": "Background",
        "type": "enum",
        "options": [
          "auto",
          "opaque",
          "transparent"
        ],
        "description": "Background handling. Omit to keep the model default."
      },
      {
        "name": "use_unlim",
        "label": "Billing Mode",
        "type": "enum",
        "options": [
          "auto",
          "unlimited",
          "credits"
        ],
        "default": "auto",
        "description": "Auto uses Ultimate unlimited for 1x and credits for multi-batch, or force queue mode."
      }
    ],
    "supportsReferences": true,
    "maxReferences": 16,
    "supportsAudio": false,
    "defaultAspect": "16:9",
    "defaultResolution": "1k"
  },
  {
    "id": "gpt_image_2",
    "label": "ChatGPT / GPT Image 2",
    "modality": "image",
    "providerFamily": "OpenAI",
    "description": "Unlimited on Ultimate · Next-gen GPT Image model with 1k/2k/4k resolution and low/medium/high quality tiers",
    "supportsUnlim": true,
    "mediaRoles": [
      "image"
    ],
    "aspectRatios": [
      "1:1",
      "4:3",
      "3:4",
      "16:9",
      "21:9",
      "9:16",
      "3:2",
      "2:3"
    ],
    "resolutions": [
      "1k",
      "2k",
      "4k"
    ],
    "parameters": [
      {
        "name": "quality",
        "label": "Quality",
        "type": "enum",
        "options": [
          "low",
          "medium",
          "high"
        ],
        "default": "low",
        "description": "Image quality",
        "inlinePill": true
      },
      {
        "name": "use_unlim",
        "label": "Billing Mode",
        "type": "enum",
        "options": [
          "auto",
          "unlimited",
          "credits"
        ],
        "default": "auto",
        "description": "Auto uses Ultimate unlimited for 1x and credits for multi-batch, or force queue mode."
      }
    ],
    "supportsReferences": true,
    "maxReferences": 4,
    "supportsAudio": false,
    "defaultAspect": "16:9",
    "defaultResolution": "1k"
  },
  {
    "id": "openai_hazel",
    "label": "OpenAI Hazel",
    "modality": "image",
    "providerFamily": "OpenAI",
    "description": "Powerful editing, best text rendering",
    "mediaRoles": [
      "image_references"
    ],
    "aspectRatios": [
      "1:1",
      "3:2",
      "2:3",
      "auto"
    ],
    "parameters": [
      {
        "name": "quality",
        "label": "Quality",
        "type": "enum",
        "options": [
          "low",
          "medium",
          "high"
        ],
        "default": "medium",
        "description": "Rendering quality / detail level.",
        "inlinePill": true
      }
    ],
    "supportsReferences": true,
    "maxReferences": 16,
    "supportsAudio": false,
    "defaultAspect": "1:1"
  },
  {
    "id": "soul_2",
    "label": "Higgsfield Soul 2.0",
    "modality": "image",
    "providerFamily": "Higgsfield",
    "description": "Unlimited on Ultimate · Realistic UGC, fashion editorial and character generation",
    "supportsUnlim": true,
    "mediaRoles": [
      "image"
    ],
    "aspectRatios": [
      "1:1",
      "16:9",
      "9:16",
      "4:3",
      "3:4",
      "3:2",
      "2:3"
    ],
    "parameters": [
      {
        "name": "quality",
        "label": "Quality",
        "type": "enum",
        "options": [
          "1.5k",
          "2k"
        ],
        "default": "2k",
        "description": "Output quality tier shown as 1.5k or 2k",
        "inlinePill": true
      },
      {
        "name": "use_unlim",
        "label": "Billing Mode",
        "type": "enum",
        "options": [
          "auto",
          "unlimited",
          "credits"
        ],
        "default": "auto",
        "description": "Auto uses Ultimate unlimited for 1x and credits for multi-batch, or force queue mode."
      }
    ],
    "supportsReferences": true,
    "maxReferences": 4,
    "supportsAudio": false,
    "defaultAspect": "16:9"
  },
  {
    "id": "cinematic_studio_2_5",
    "label": "Cinema Studio Image 2.5",
    "modality": "image",
    "providerFamily": "Higgsfield",
    "description": "Cinematic stills, up to 4K resolution",
    "mediaRoles": [
      "image"
    ],
    "aspectRatios": [
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
    "resolutions": [
      "1k",
      "2k",
      "4k"
    ],
    "supportsReferences": true,
    "maxReferences": 4,
    "supportsAudio": false,
    "defaultAspect": "16:9",
    "defaultResolution": "1k"
  },
  {
    "id": "soul_cinematic",
    "label": "Soul Cinema",
    "modality": "image",
    "providerFamily": "Higgsfield",
    "description": "Cinema-grade stills and concept art",
    "mediaRoles": [
      "image"
    ],
    "aspectRatios": [
      "1:1",
      "4:3",
      "3:4",
      "16:9",
      "9:16",
      "3:2",
      "2:3",
      "21:9"
    ],
    "parameters": [
      {
        "name": "quality",
        "label": "Quality",
        "type": "enum",
        "options": [
          "1.5k",
          "2k"
        ],
        "default": "2k",
        "description": "Output quality tier shown as 1.5k or 2k",
        "inlinePill": true
      }
    ],
    "supportsReferences": true,
    "maxReferences": 4,
    "supportsAudio": false,
    "defaultAspect": "16:9"
  },
  {
    "id": "soul_cinema_studio",
    "label": "Soul Cinema Studio",
    "modality": "image",
    "providerFamily": "Higgsfield",
    "mediaRoles": [
      "image_references"
    ],
    "aspectRatios": [
      "1:1",
      "16:9",
      "9:16",
      "4:3",
      "3:4",
      "3:2",
      "2:3",
      "21:9"
    ],
    "parameters": [
      {
        "name": "quality",
        "label": "Quality",
        "type": "enum",
        "options": [
          "1.5k",
          "2k"
        ],
        "default": "2k",
        "description": "Output resolution tier (1.5K or 2K).",
        "inlinePill": true
      },
      {
        "name": "enhance_prompt",
        "label": "Enhance Prompt",
        "type": "boolean",
        "default": false,
        "description": "Automatically expand and enrich the prompt before generation."
      }
    ],
    "supportsReferences": true,
    "maxReferences": 4,
    "supportsAudio": false,
    "defaultAspect": "16:9"
  },
  {
    "id": "nano_banana_2_1",
    "label": "Nano Banana 2.1",
    "modality": "image",
    "providerFamily": "Google",
    "description": "Unlimited on Ultimate · Nano Banana 2.1 image generation with image and video references",
    "supportsUnlim": true,
    "mediaRoles": [
      "image_references",
      "mask",
      "video_references"
    ],
    "aspectRatios": [
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
    "resolutions": [
      "1k",
      "2k",
      "4k"
    ],
    "parameters": [
      {
        "name": "is_inpaint",
        "label": "Inpaint Mode",
        "type": "boolean",
        "default": false,
        "description": "Whether to restrict the edit to the supplied mask."
      },
      {
        "name": "thinking_level",
        "label": "Thinking",
        "type": "enum",
        "options": [
          "minimal",
          "medium",
          "high"
        ],
        "default": "medium"
      },
      {
        "name": "enable_web_search",
        "label": "Web Search",
        "type": "boolean"
      },
      {
        "name": "enable_image_search",
        "label": "Image Search",
        "type": "boolean"
      },
      {
        "name": "use_unlim",
        "label": "Billing Mode",
        "type": "enum",
        "options": [
          "auto",
          "unlimited",
          "credits"
        ],
        "default": "auto",
        "description": "Auto uses Ultimate unlimited for 1x and credits for multi-batch, or force queue mode."
      }
    ],
    "supportsReferences": true,
    "maxReferences": 14,
    "supportsAudio": false,
    "defaultAspect": "16:9",
    "defaultResolution": "1k"
  },
  {
    "id": "nano_banana_2",
    "label": "Nano Banana 2",
    "modality": "image",
    "providerFamily": "Google",
    "description": "Unlimited on Ultimate · Fast, next-gen high-quality images",
    "supportsUnlim": true,
    "mediaRoles": [
      "image_references",
      "mask"
    ],
    "aspectRatios": [
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
    "resolutions": [
      "1k",
      "2k",
      "4k"
    ],
    "parameters": [
      {
        "name": "is_inpaint",
        "label": "Inpaint Mode",
        "type": "boolean",
        "default": false,
        "description": "Whether to restrict the edit to the supplied mask."
      },
      {
        "name": "use_unlim",
        "label": "Billing Mode",
        "type": "enum",
        "options": [
          "auto",
          "unlimited",
          "credits"
        ],
        "default": "auto",
        "description": "Auto uses Ultimate unlimited for 1x and credits for multi-batch, or force queue mode."
      }
    ],
    "supportsReferences": true,
    "maxReferences": 4,
    "supportsAudio": false,
    "defaultAspect": "16:9",
    "defaultResolution": "1k"
  },
  {
    "id": "nano_banana_pro",
    "label": "Nano Banana Pro",
    "modality": "image",
    "providerFamily": "Google",
    "description": "Unlimited on Ultimate · Ultimate quality, text and diagrams",
    "supportsUnlim": true,
    "mediaRoles": [
      "image_references"
    ],
    "aspectRatios": [
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
    "resolutions": [
      "1k",
      "2k",
      "4k"
    ],
    "parameters": [
      {
        "name": "use_unlim",
        "label": "Billing Mode",
        "type": "enum",
        "options": [
          "auto",
          "unlimited",
          "credits"
        ],
        "default": "auto",
        "description": "Auto uses Ultimate unlimited for 1x and credits for multi-batch, or force queue mode."
      }
    ],
    "supportsReferences": true,
    "maxReferences": 4,
    "supportsAudio": false,
    "defaultAspect": "16:9",
    "defaultResolution": "2k"
  },
  {
    "id": "nano_banana",
    "label": "Nano Banana",
    "modality": "image",
    "providerFamily": "Google",
    "description": "Realistic images, budget-friendly",
    "mediaRoles": [
      "image_references"
    ],
    "aspectRatios": [
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
    "supportsReferences": true,
    "maxReferences": 4,
    "supportsAudio": false,
    "defaultAspect": "16:9"
  },
  {
    "id": "nano_banana_2_lite",
    "label": "Nano Banana 2 Lite",
    "modality": "image",
    "providerFamily": "Google",
    "description": "Lite next-gen high-quality images",
    "mediaRoles": [
      "image_references",
      "mask"
    ],
    "aspectRatios": [
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
    "resolutions": [
      "1k"
    ],
    "parameters": [
      {
        "name": "thinking",
        "label": "Thinking",
        "type": "enum",
        "options": [
          "MINIMAL",
          "HIGH"
        ],
        "default": "HIGH",
        "description": "Depth of internal reasoning before generation."
      },
      {
        "name": "is_inpaint",
        "label": "Inpaint Mode",
        "type": "boolean",
        "default": false,
        "description": "Whether to restrict the edit to the supplied mask."
      }
    ],
    "supportsReferences": true,
    "maxReferences": 4,
    "supportsAudio": false,
    "defaultAspect": "16:9",
    "defaultResolution": "1k"
  },
  {
    "id": "nano_banana_2_shots",
    "label": "Nano Banana Pro (2 Shots)",
    "modality": "image",
    "providerFamily": "Google",
    "mediaRoles": [
      "image_references"
    ],
    "aspectRatios": [
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
    "supportsReferences": true,
    "maxReferences": 4,
    "supportsAudio": false,
    "defaultAspect": "16:9"
  },
  {
    "id": "seedream_5_5",
    "label": "Seedream 5.5",
    "modality": "image",
    "providerFamily": "ByteDance",
    "description": "Image generation and editing with PNG output and optional transparent background",
    "mediaRoles": [
      "image_references"
    ],
    "aspectRatios": [
      "auto",
      "1:1",
      "4:3",
      "3:4",
      "16:9",
      "9:16",
      "3:2",
      "2:3",
      "21:9"
    ],
    "resolutions": [
      "1k",
      "1.5k",
      "2k"
    ],
    "parameters": [
      {
        "name": "background",
        "label": "Background",
        "type": "enum",
        "options": [
          "auto",
          "transparent",
          "opaque"
        ],
        "default": "auto",
        "description": "Background mode. Output is always PNG."
      }
    ],
    "supportsReferences": true,
    "maxReferences": 10,
    "supportsAudio": false,
    "defaultAspect": "16:9",
    "defaultResolution": "2k"
  },
  {
    "id": "seedream_v5_pro",
    "label": "Seedream 5.0 Pro",
    "modality": "image",
    "providerFamily": "ByteDance",
    "description": "Unlimited on Ultimate · Pro-tier visual reasoning, instruction-based editing, up to 2K",
    "supportsUnlim": true,
    "mediaRoles": [
      "image_references"
    ],
    "aspectRatios": [
      "1:1",
      "4:3",
      "3:4",
      "16:9",
      "9:16",
      "3:2",
      "2:3",
      "21:9"
    ],
    "resolutions": [
      "1k",
      "1.5k",
      "2k"
    ],
    "parameters": [
      {
        "name": "width",
        "label": "Width",
        "type": "number",
        "min": 1,
        "description": "Optional output width stored with the generation. Whole number."
      },
      {
        "name": "height",
        "label": "Height",
        "type": "number",
        "min": 1,
        "description": "Optional output height stored with the generation. Whole number."
      },
      {
        "name": "remove_bg",
        "label": "Remove BG",
        "type": "boolean",
        "default": false,
        "description": "Remove the background from the generated image."
      },
      {
        "name": "is_inpaint",
        "label": "Inpaint Mode",
        "type": "boolean",
        "default": false,
        "description": "Treat the request as an inpaint/edit of the reference image(s) instead of a fresh generation."
      },
      {
        "name": "use_unlim",
        "label": "Billing Mode",
        "type": "enum",
        "options": [
          "auto",
          "unlimited",
          "credits"
        ],
        "default": "auto",
        "description": "Auto uses Ultimate unlimited for 1x and credits for multi-batch, or force queue mode."
      }
    ],
    "supportsReferences": true,
    "maxReferences": 4,
    "supportsAudio": false,
    "defaultAspect": "16:9",
    "defaultResolution": "2k"
  },
  {
    "id": "seedream_5_0_flash",
    "label": "Seedream 5.0 Flash",
    "modality": "image",
    "providerFamily": "ByteDance",
    "description": "Fast image generation and instruction-based editing, up to 2K",
    "mediaRoles": [
      "image_references"
    ],
    "aspectRatios": [
      "auto",
      "1:1",
      "4:3",
      "3:4",
      "16:9",
      "9:16",
      "3:2",
      "2:3",
      "21:9"
    ],
    "resolutions": [
      "1k",
      "1.5k",
      "2k"
    ],
    "parameters": [
      {
        "name": "width",
        "label": "Width",
        "type": "number",
        "min": 1,
        "description": "Optional width stored in generation metadata; not sent to the provider. Whole number."
      },
      {
        "name": "height",
        "label": "Height",
        "type": "number",
        "min": 1,
        "description": "Optional height stored in generation metadata; not sent to the provider. Whole number."
      }
    ],
    "supportsReferences": true,
    "maxReferences": 10,
    "supportsAudio": false,
    "defaultAspect": "16:9",
    "defaultResolution": "2k"
  },
  {
    "id": "seedream_v5_lite",
    "label": "Seedream 5.0 Lite",
    "modality": "image",
    "providerFamily": "ByteDance",
    "description": "Visual reasoning, instruction-based editing",
    "mediaRoles": [
      "image_references"
    ],
    "aspectRatios": [
      "1:1",
      "4:3",
      "3:4",
      "16:9",
      "9:16",
      "21:9"
    ],
    "parameters": [
      {
        "name": "quality",
        "label": "Quality",
        "type": "enum",
        "options": [
          "basic",
          "high"
        ],
        "default": "basic",
        "description": "Output quality tier.",
        "inlinePill": true
      }
    ],
    "supportsReferences": true,
    "maxReferences": 4,
    "supportsAudio": false,
    "defaultAspect": "16:9"
  },
  {
    "id": "seedream_v4_5",
    "label": "Seedream 4.5",
    "modality": "image",
    "providerFamily": "ByteDance",
    "description": "4K output, precise control, transformations",
    "mediaRoles": [
      "image_references"
    ],
    "aspectRatios": [
      "1:1",
      "4:3",
      "16:9",
      "3:2",
      "21:9",
      "3:4",
      "9:16",
      "2:3"
    ],
    "parameters": [
      {
        "name": "quality",
        "label": "Quality",
        "type": "enum",
        "options": [
          "basic",
          "high"
        ],
        "default": "basic",
        "description": "Output quality tier. 'basic' renders up to 4K; 'high' renders up to ~6K.",
        "inlinePill": true
      }
    ],
    "supportsReferences": true,
    "maxReferences": 4,
    "supportsAudio": false,
    "defaultAspect": "16:9"
  },
  {
    "id": "flux_3_image",
    "label": "FLUX 3 Image",
    "modality": "image",
    "providerFamily": "FLUX",
    "description": "FLUX 3 image generation and editing with up to ten reference images",
    "mediaRoles": [
      "image_references"
    ],
    "aspectRatios": [
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
    "resolutions": [
      "768sq",
      "1k",
      "1.5k",
      "2k",
      "4k"
    ],
    "supportsReferences": true,
    "maxReferences": 10,
    "supportsAudio": false,
    "defaultAspect": "16:9",
    "defaultResolution": "1k"
  },
  {
    "id": "flux_2",
    "label": "FLUX.2",
    "modality": "image",
    "providerFamily": "FLUX",
    "description": "Multiple model variants (pro, flex, max), precise prompt adherence",
    "mediaRoles": [
      "image_references"
    ],
    "aspectRatios": [
      "1:1",
      "4:3",
      "3:4",
      "16:9",
      "9:16"
    ],
    "resolutions": [
      "1k",
      "2k"
    ],
    "parameters": [
      {
        "name": "variant",
        "label": "Variant",
        "type": "enum",
        "options": [
          "pro",
          "flex",
          "max"
        ],
        "default": "pro",
        "description": "FLUX.2 model variant.",
        "inlinePill": true
      }
    ],
    "supportsReferences": true,
    "maxReferences": 4,
    "supportsAudio": false,
    "defaultAspect": "16:9",
    "defaultResolution": "1k"
  },
  {
    "id": "flux_kontext",
    "label": "Flux Kontext",
    "modality": "image",
    "providerFamily": "FLUX",
    "description": "Context-aware editing and style transfer",
    "mediaRoles": [
      "image_references"
    ],
    "aspectRatios": [
      "1:1",
      "4:3",
      "3:4",
      "16:9",
      "9:16"
    ],
    "supportsReferences": true,
    "maxReferences": 4,
    "supportsAudio": false,
    "defaultAspect": "16:9"
  },
  {
    "id": "flux_2_pro_outpaint",
    "label": "FLUX.2 Pro Outpaint",
    "modality": "image",
    "providerFamily": "FLUX",
    "description": "Expands an image beyond its borders with FLUX.2 [pro]: per-side pixel expansion painted as a coherent, seamless scene extension. Negative values crop that side instead; an all-crop request is served locally for free without the model.",
    "mediaRoles": [
      "image_references"
    ],
    "parameters": [
      {
        "name": "expand_top",
        "label": "Expand Top",
        "type": "number",
        "default": 0,
        "min": -8192,
        "max": 2048,
        "description": "Pixels to expand at the top of the image; a negative value crops the top by that many pixels instead. Whole number."
      },
      {
        "name": "expand_bottom",
        "label": "Expand Bottom",
        "type": "number",
        "default": 0,
        "min": -8192,
        "max": 2048,
        "description": "Pixels to expand at the bottom of the image; a negative value crops the bottom by that many pixels instead. Whole number."
      },
      {
        "name": "expand_left",
        "label": "Expand Left",
        "type": "number",
        "default": 0,
        "min": -8192,
        "max": 2048,
        "description": "Pixels to expand on the left of the image; a negative value crops the left by that many pixels instead. Whole number."
      },
      {
        "name": "expand_right",
        "label": "Expand Right",
        "type": "number",
        "default": 0,
        "min": -8192,
        "max": 2048,
        "description": "Pixels to expand on the right of the image; a negative value crops the right by that many pixels instead. Whole number."
      }
    ],
    "supportsReferences": true,
    "maxReferences": 4,
    "supportsAudio": false,
    "defaultAspect": "16:9"
  },
  {
    "id": "kling_omni_image",
    "label": "Kling O1 Image",
    "modality": "image",
    "providerFamily": "Kling",
    "description": "Versatile photorealistic generation",
    "mediaRoles": [
      "image_references"
    ],
    "aspectRatios": [
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
    "resolutions": [
      "1k",
      "2k"
    ],
    "supportsReferences": true,
    "maxReferences": 10,
    "supportsAudio": false,
    "defaultAspect": "16:9",
    "defaultResolution": "1k"
  },
  {
    "id": "grok_image_2_0",
    "label": "Grok Image 2.0",
    "modality": "image",
    "providerFamily": "xAI",
    "description": "Next-generation image creation and editing from xAI",
    "mediaRoles": [
      "image_references"
    ],
    "aspectRatios": [
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
    "resolutions": [
      "1k",
      "2k"
    ],
    "parameters": [
      {
        "name": "quality",
        "label": "Quality",
        "type": "enum",
        "options": [
          "low",
          "medium"
        ],
        "default": "medium",
        "description": "Generation quality level.",
        "inlinePill": true
      }
    ],
    "supportsReferences": true,
    "maxReferences": 3,
    "supportsAudio": false,
    "defaultAspect": "16:9",
    "defaultResolution": "1k"
  },
  {
    "id": "grok_image",
    "label": "Grok Image",
    "modality": "image",
    "providerFamily": "xAI",
    "description": "Expressive, high-contrast generation and editing",
    "mediaRoles": [
      "image_references"
    ],
    "aspectRatios": [
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
    "resolutions": [
      "1k",
      "2k"
    ],
    "parameters": [
      {
        "name": "mode",
        "label": "Mode",
        "type": "enum",
        "options": [
          "std",
          "quality"
        ],
        "default": "std",
        "description": "Generation mode: standard or higher-fidelity quality.",
        "inlinePill": true
      }
    ],
    "supportsReferences": true,
    "maxReferences": 4,
    "supportsAudio": false,
    "defaultAspect": "16:9",
    "defaultResolution": "1k"
  },
  {
    "id": "ideogram_4_5",
    "label": "Ideogram 4.5",
    "modality": "image",
    "providerFamily": "Ideogram",
    "description": "Ideogram 4.5 image generation and transformation with up to five source images",
    "mediaRoles": [
      "image_references",
      "mask"
    ],
    "aspectRatios": [
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
    "resolutions": [
      "1k",
      "2k"
    ],
    "parameters": [
      {
        "name": "quality",
        "label": "Quality",
        "type": "enum",
        "options": [
          "very_low",
          "low",
          "medium",
          "high"
        ],
        "default": "high",
        "description": "Generation quality. Very low requires a source image.",
        "inlinePill": true
      },
      {
        "name": "magic_prompt",
        "label": "Magic Prompt",
        "type": "enum",
        "options": [
          "auto",
          "on",
          "off"
        ],
        "default": "auto",
        "description": "Prompt enhancement mode."
      }
    ],
    "supportsReferences": true,
    "maxReferences": 5,
    "supportsAudio": false,
    "defaultAspect": "16:9",
    "defaultResolution": "2k"
  },
  {
    "id": "ideogram_vector",
    "label": "Ideogram Vector",
    "modality": "image",
    "providerFamily": "Ideogram",
    "description": "Generate SVG images or vectorize an existing image with Ideogram Vector",
    "mediaRoles": [
      "image_references"
    ],
    "aspectRatios": [
      "auto",
      "1:1",
      "1:4",
      "1:3",
      "1:2",
      "9:16",
      "10:16",
      "2:3",
      "3:4",
      "4:5",
      "5:4",
      "4:3",
      "3:2",
      "16:10",
      "16:9",
      "2:1",
      "3:1",
      "4:1"
    ],
    "parameters": [
      {
        "name": "operation",
        "label": "Operation",
        "type": "enum",
        "options": [
          "generate",
          "vectorize"
        ],
        "required": true,
        "description": "Generate a vector image from a prompt or vectorize one source image."
      },
      {
        "name": "quality",
        "label": "Quality",
        "type": "enum",
        "options": [
          "low",
          "medium",
          "high"
        ],
        "description": "Generate only. Defaults to medium.",
        "inlinePill": true
      },
      {
        "name": "mode",
        "label": "Mode",
        "type": "enum",
        "options": [
          "simple",
          "default"
        ],
        "description": "Vectorize only. Defaults to default.",
        "inlinePill": true
      }
    ],
    "supportsReferences": true,
    "maxReferences": 5,
    "supportsAudio": false,
    "defaultAspect": "16:9"
  },
  {
    "id": "recraft_v4_1",
    "label": "Recraft V4.1",
    "modality": "image",
    "providerFamily": "Recraft",
    "description": "V4.1 image generation with selectable model_type for standard exploration, vector logos/icons, utility product shots/mockups, and utility_vector brand assets",
    "aspectRatios": [
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
    "resolutions": [
      "1k",
      "2k"
    ],
    "parameters": [
      {
        "name": "model_type",
        "label": "Engine Type",
        "type": "enum",
        "options": [
          "standard",
          "vector",
          "utility",
          "utility_vector"
        ],
        "default": "standard",
        "description": "Recraft V4.1 variant. standard is expressive and exploratory; vector is for logos, typography, icons, and SVG-like illustration; utility is cleaner, flatter, front-facing, and predictable for product shots and mockups; utility_vector combines utility simplicity with vector output."
      },
      {
        "name": "background_color",
        "label": "BG Color",
        "type": "string",
        "description": "Optional #RRGGBB background color with no alpha channel, or null. Use for controlled flat backgrounds, brand swatches, product mockups, icons, and vector-style work."
      }
    ],
    "supportsReferences": false,
    "supportsAudio": false,
    "defaultAspect": "16:9",
    "defaultResolution": "1k"
  },
  {
    "id": "recraft_v4_styles",
    "label": "Recraft V4 Styles",
    "modality": "image",
    "providerFamily": "Recraft",
    "description": "Generate images using your saved, ready Recraft style.",
    "aspectRatios": [
      "1:1",
      "2:1",
      "1:2",
      "3:2",
      "2:3",
      "4:3",
      "3:4",
      "5:4",
      "4:5",
      "6:10",
      "14:10",
      "10:14",
      "16:9",
      "9:16"
    ],
    "resolutions": [
      "1k",
      "2k"
    ],
    "parameters": [
      {
        "name": "style_match",
        "label": "Style Match",
        "type": "enum",
        "options": [
          "precise",
          "flexible"
        ],
        "default": "precise",
        "description": "How closely to match the saved style."
      }
    ],
    "supportsReferences": false,
    "supportsAudio": false,
    "defaultAspect": "16:9",
    "defaultResolution": "1k"
  },
  {
    "id": "minimax_h3_image",
    "label": "MiniMax H3 Image",
    "modality": "image",
    "providerFamily": "MiniMax",
    "description": "Image generation and editing with up to sixteen reference images",
    "mediaRoles": [
      "image_references"
    ],
    "resolutions": [
      "1k",
      "2k",
      "4k"
    ],
    "supportsReferences": true,
    "maxReferences": 16,
    "supportsAudio": false,
    "defaultAspect": "16:9",
    "defaultResolution": "4k"
  },
  {
    "id": "3d_jutsu_angles",
    "label": "3D Jutsu Angles",
    "modality": "image",
    "providerFamily": "ByteDance",
    "description": "3D Jutsu Angles powered by Seedream 5.0 Pro",
    "mediaRoles": [
      "image_references"
    ],
    "aspectRatios": [
      "1:1",
      "4:3",
      "3:4",
      "16:9",
      "9:16",
      "3:2",
      "2:3",
      "21:9"
    ],
    "resolutions": [
      "1k",
      "1.5k",
      "2k"
    ],
    "parameters": [
      {
        "name": "width",
        "label": "Width",
        "type": "number",
        "min": 1,
        "description": "Optional output width stored with the generation. Whole number."
      },
      {
        "name": "height",
        "label": "Height",
        "type": "number",
        "min": 1,
        "description": "Optional output height stored with the generation. Whole number."
      },
      {
        "name": "remove_bg",
        "label": "Remove BG",
        "type": "boolean",
        "default": false,
        "description": "Remove the background from the generated image."
      },
      {
        "name": "is_inpaint",
        "label": "Inpaint Mode",
        "type": "boolean",
        "default": false,
        "description": "Treat the request as an inpaint/edit of the reference image(s) instead of a fresh generation."
      }
    ],
    "supportsReferences": true,
    "maxReferences": 4,
    "supportsAudio": false,
    "defaultAspect": "16:9",
    "defaultResolution": "2k"
  },
  {
    "id": "image_auto",
    "label": "Auto",
    "modality": "image",
    "providerFamily": "Higgsfield",
    "description": "Auto-selects the best image model based on prompt intent",
    "mediaRoles": [
      "image"
    ],
    "aspectRatios": [
      "1:1",
      "4:3",
      "3:4",
      "16:9",
      "9:16"
    ],
    "supportsReferences": true,
    "maxReferences": 4,
    "supportsAudio": false,
    "defaultAspect": "16:9"
  },
  {
    "id": "bytedance_image_upscale",
    "label": "Bytedance Image Upscale",
    "modality": "image",
    "providerFamily": "ByteDance",
    "mediaRoles": [
      "image_references"
    ],
    "resolutions": [
      "2k",
      "4k"
    ],
    "parameters": [
      {
        "name": "remove_bg",
        "label": "Remove BG",
        "type": "boolean",
        "default": false,
        "description": "Remove the background from the upscaled image."
      }
    ],
    "supportsReferences": true,
    "maxReferences": 4,
    "supportsAudio": false,
    "defaultAspect": "16:9",
    "defaultResolution": "4k"
  },
  {
    "id": "cinematic_studio_image",
    "label": "Cinematic Studio Image",
    "modality": "image",
    "providerFamily": "Higgsfield",
    "mediaRoles": [
      "image_references"
    ],
    "aspectRatios": [
      "1:1",
      "4:3",
      "3:4",
      "16:9",
      "9:16",
      "3:2",
      "2:3",
      "21:9"
    ],
    "resolutions": [
      "1k",
      "2k",
      "4k"
    ],
    "supportsReferences": true,
    "maxReferences": 4,
    "supportsAudio": false,
    "defaultAspect": "16:9",
    "defaultResolution": "2k"
  },
  {
    "id": "cinematic_studio_soul_cast",
    "label": "Cinematic Studio Soul Cast",
    "modality": "image",
    "providerFamily": "Higgsfield",
    "aspectRatios": [
      "1:1",
      "16:9",
      "9:16",
      "4:3",
      "3:4",
      "3:2",
      "2:3",
      "5:4",
      "4:5",
      "21:9",
      "9:21"
    ],
    "parameters": [
      {
        "name": "budget",
        "label": "Budget",
        "type": "number",
        "default": 50,
        "description": "Generation budget controlling the amount of compute spent. Whole number."
      }
    ],
    "supportsReferences": false,
    "supportsAudio": false,
    "defaultAspect": "16:9"
  },
  {
    "id": "cinematic_studio_soul_location",
    "label": "Cinematic Studio Soul Location",
    "modality": "image",
    "providerFamily": "Higgsfield",
    "aspectRatios": [
      "1:1",
      "16:9",
      "9:16",
      "4:3",
      "3:4",
      "3:2",
      "2:3",
      "21:9",
      "9:21"
    ],
    "supportsReferences": false,
    "supportsAudio": false,
    "defaultAspect": "16:9"
  },
  {
    "id": "ms_image",
    "label": "DTC Ads",
    "modality": "image",
    "providerFamily": "Higgsfield",
    "description": "DTC ad image generation with brand-kit-aware prompts, avatars, products, and curated ad formats",
    "mediaRoles": [
      "image"
    ],
    "aspectRatios": [
      "1:1",
      "3:2",
      "2:3",
      "16:9",
      "9:16",
      "4:3",
      "3:4",
      "21:9",
      "27:16",
      "16:27",
      "9:8",
      "8:9",
      "4:9",
      "9:4",
      "auto"
    ],
    "resolutions": [
      "1k",
      "2k",
      "4k"
    ],
    "parameters": [
      {
        "name": "quality",
        "label": "Quality",
        "type": "enum",
        "options": [
          "low",
          "medium",
          "high"
        ],
        "default": "low",
        "description": "Output quality. Affects cost.",
        "inlinePill": true
      }
    ],
    "supportsReferences": true,
    "maxReferences": 4,
    "supportsAudio": false,
    "defaultAspect": "16:9",
    "defaultResolution": "1k"
  },
  {
    "id": "image_background_remover",
    "label": "Image Background Remover",
    "modality": "image",
    "providerFamily": "Tools & Upscale",
    "mediaRoles": [
      "image_references"
    ],
    "supportsReferences": true,
    "maxReferences": 4,
    "supportsAudio": false,
    "defaultAspect": "16:9"
  },
  {
    "id": "image_command",
    "label": "Image Command",
    "modality": "image",
    "providerFamily": "Higgsfield",
    "description": "Runs a Higgsfield image command such as polish on one photo. Higgsfield writes the prompt from the command's own recipe and generates one image, so the caller never writes a prompt or picks settings. Use it only when the user invokes the command (/polish), with one request per photo.",
    "mediaRoles": [
      "image_references"
    ],
    "parameters": [
      {
        "name": "command",
        "label": "Command",
        "type": "string",
        "required": true,
        "description": "The command without its slash, e.g. polish."
      }
    ],
    "supportsReferences": true,
    "maxReferences": 1,
    "supportsAudio": false,
    "defaultAspect": "16:9"
  },
  {
    "id": "image_decompose",
    "label": "Image Decompose",
    "modality": "image",
    "providerFamily": "Tools & Upscale",
    "mediaRoles": [
      "image_references"
    ],
    "parameters": [
      {
        "name": "mode",
        "label": "Mode",
        "type": "enum",
        "options": [
          "granular",
          "standard"
        ],
        "default": "granular",
        "description": "Decomposition granularity. 'granular' = split into many fine-grained layers; 'standard' = fewer, coarser layers.",
        "inlinePill": true
      }
    ],
    "supportsReferences": true,
    "maxReferences": 4,
    "supportsAudio": false,
    "defaultAspect": "16:9"
  },
  {
    "id": "marketing_studio_image",
    "label": "Marketing Studio Image",
    "modality": "image",
    "providerFamily": "Higgsfield",
    "description": "One-click product image ads for social campaigns",
    "mediaRoles": [
      "image"
    ],
    "aspectRatios": [
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
    "resolutions": [
      "1k",
      "2k",
      "4k"
    ],
    "supportsReferences": true,
    "maxReferences": 4,
    "supportsAudio": false,
    "defaultAspect": "16:9",
    "defaultResolution": "1k"
  },
  {
    "id": "marketing_studio_2_image",
    "label": "Marketing Studio Product Shot",
    "modality": "image",
    "providerFamily": "Higgsfield",
    "description": "Marketing Studio product shots, posters, and ad creatives",
    "mediaRoles": [
      "input_images",
      "product_image",
      "character_photo",
      "model_image"
    ],
    "aspectRatios": [
      "1:1",
      "3:2",
      "2:3",
      "4:3",
      "3:4",
      "9:16",
      "16:9"
    ],
    "parameters": [
      {
        "name": "type",
        "label": "Type",
        "type": "enum",
        "options": [
          "product_shots",
          "product_shots_people",
          "poster",
          "ads",
          "marketplace"
        ],
        "required": true,
        "description": "Image format to generate.",
        "inlinePill": true
      },
      {
        "name": "notes",
        "label": "Notes",
        "type": "string",
        "description": "Only for type=ads|marketplace: extra creative notes. At most 5000 characters."
      },
      {
        "name": "want_person",
        "label": "Include Person",
        "type": "boolean",
        "default": false,
        "description": "Only for type=ads|marketplace: cast a generated person into the ad."
      }
    ],
    "supportsReferences": true,
    "maxReferences": 1,
    "supportsAudio": false,
    "defaultAspect": "16:9"
  },
  {
    "id": "outpaint",
    "label": "Outpaint",
    "modality": "image",
    "providerFamily": "Tools & Upscale",
    "mediaRoles": [
      "image_references"
    ],
    "aspectRatios": [
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
    "supportsReferences": true,
    "maxReferences": 4,
    "supportsAudio": false,
    "defaultAspect": "16:9"
  },
  {
    "id": "soul_cast",
    "label": "Soul Cast",
    "modality": "image",
    "providerFamily": "Higgsfield",
    "description": "Consistent cinematic character identity",
    "aspectRatios": [
      "16:9"
    ],
    "parameters": [
      {
        "name": "budget",
        "label": "Budget",
        "type": "number",
        "default": 50,
        "description": "Generation budget (10-500)"
      }
    ],
    "supportsReferences": false,
    "supportsAudio": false,
    "defaultAspect": "16:9"
  },
  {
    "id": "soul_location",
    "label": "Soul Location",
    "modality": "image",
    "providerFamily": "Higgsfield",
    "description": "Environment and location generation",
    "aspectRatios": [
      "1:1",
      "4:3",
      "3:4",
      "16:9",
      "9:16",
      "3:2",
      "2:3",
      "21:9",
      "9:21"
    ],
    "supportsReferences": false,
    "supportsAudio": false,
    "defaultAspect": "16:9"
  },
  {
    "id": "topaz_image_generative",
    "label": "Topaz Image Generative",
    "modality": "image",
    "providerFamily": "Tools & Upscale",
    "mediaRoles": [
      "image_references"
    ],
    "parameters": [
      {
        "name": "output_width",
        "label": "Output Width",
        "type": "number",
        "min": 1,
        "required": true,
        "description": "Target output width in pixels. Whole number."
      },
      {
        "name": "output_height",
        "label": "Output Height",
        "type": "number",
        "min": 1,
        "required": true,
        "description": "Target output height in pixels. Whole number."
      },
      {
        "name": "variant",
        "label": "Variant",
        "type": "enum",
        "options": [
          "Standard MAX",
          "Redefine",
          "Recovery",
          "Recovery V2",
          "Wonder 2",
          "Wonder 3.5"
        ],
        "default": "Redefine",
        "description": "Topaz generative upscale model variant.",
        "inlinePill": true
      },
      {
        "name": "autoprompt",
        "label": "Autoprompt",
        "type": "boolean",
        "default": true,
        "description": "Automatically generate a guiding prompt from the image."
      },
      {
        "name": "creativity",
        "label": "Creativity",
        "type": "number",
        "default": 1,
        "min": 1,
        "max": 6,
        "description": "Creativity level (1-6); higher adds more detail. Whole number."
      },
      {
        "name": "texture",
        "label": "Texture",
        "type": "number",
        "default": 1,
        "min": 1,
        "max": 5,
        "description": "Texture strength (1-5). Whole number."
      },
      {
        "name": "sharpen",
        "label": "Sharpen",
        "type": "number",
        "default": 0,
        "min": 0,
        "max": 1,
        "description": "Sharpening amount (0-1)."
      },
      {
        "name": "denoise",
        "label": "Denoise",
        "type": "number",
        "default": 0,
        "min": 0,
        "max": 1,
        "description": "Denoising amount (0-1)."
      },
      {
        "name": "face_enhancement",
        "label": "Face Enhance",
        "type": "boolean",
        "default": false,
        "description": "Enable face enhancement."
      },
      {
        "name": "face_enhancement_creativity",
        "label": "Face Creativity",
        "type": "number",
        "default": 0,
        "min": 0,
        "max": 1,
        "description": "Face enhancement creativity (0-1)."
      },
      {
        "name": "face_enhancement_strength",
        "label": "Face Strength",
        "type": "number",
        "default": 0,
        "min": 0,
        "max": 1,
        "description": "Face enhancement strength (0-1)."
      }
    ],
    "supportsReferences": true,
    "maxReferences": 1,
    "supportsAudio": false,
    "defaultAspect": "16:9"
  },
  {
    "id": "topaz_image",
    "label": "Topaz Image Upscale",
    "modality": "image",
    "providerFamily": "Tools & Upscale",
    "mediaRoles": [
      "image_references"
    ],
    "parameters": [
      {
        "name": "output_width",
        "label": "Output Width",
        "type": "number",
        "min": 1,
        "required": true,
        "description": "Target output width in pixels. Whole number."
      },
      {
        "name": "output_height",
        "label": "Output Height",
        "type": "number",
        "min": 1,
        "required": true,
        "description": "Target output height in pixels. Whole number."
      },
      {
        "name": "face_enhancement",
        "label": "Face Enhance",
        "type": "boolean",
        "default": false,
        "description": "Enable dedicated face enhancement."
      },
      {
        "name": "face_enhancement_creativity",
        "label": "Face Creativity",
        "type": "number",
        "default": 0,
        "min": 0,
        "max": 1,
        "description": "Face enhancement creativity (0-1). Applies when face_enhancement is enabled."
      },
      {
        "name": "face_enhancement_strength",
        "label": "Face Strength",
        "type": "number",
        "default": 0,
        "min": 0,
        "max": 1,
        "description": "Face enhancement strength (0-1). Applies when face_enhancement is enabled."
      },
      {
        "name": "variant",
        "label": "Variant",
        "type": "enum",
        "options": [
          "Standard V2",
          "Low Resolution V2",
          "CGI",
          "High Fidelity V2",
          "Text Refine"
        ],
        "default": "Standard V2",
        "description": "Topaz enhancement model.",
        "inlinePill": true
      },
      {
        "name": "sharpen",
        "label": "Sharpen",
        "type": "number",
        "default": 0,
        "min": 0,
        "max": 1,
        "description": "Sharpening amount (0-1)."
      },
      {
        "name": "denoise",
        "label": "Denoise",
        "type": "number",
        "default": 0,
        "min": 0,
        "max": 1,
        "description": "Denoising amount (0-1)."
      }
    ],
    "supportsReferences": true,
    "maxReferences": 1,
    "supportsAudio": false,
    "defaultAspect": "16:9"
  },
  {
    "id": "z_image",
    "label": "Z Image",
    "modality": "image",
    "providerFamily": "Tongyi-MAI",
    "description": "Super fast, stylized text-to-image",
    "aspectRatios": [
      "1:1",
      "4:3",
      "3:4",
      "16:9",
      "9:16"
    ],
    "supportsReferences": false,
    "supportsAudio": false,
    "defaultAspect": "16:9"
  },
  {
    "id": "cinematic_studio_video_4_0",
    "label": "Cinema Studio 4.0",
    "modality": "video",
    "providerFamily": "Higgsfield",
    "description": "Cinema-grade video generation with automatic prompt direction and camera, lighting, pacing, genre, era, and color controls",
    "supportsStartEndFrames": true,
    "mediaRoles": [
      "start_image",
      "end_image",
      "image_references",
      "video_references",
      "audio_references"
    ],
    "aspectRatios": [
      "auto",
      "21:9",
      "16:9",
      "4:3",
      "1:1",
      "3:4",
      "9:16"
    ],
    "resolutions": [
      "480p",
      "720p",
      "1080p"
    ],
    "durationsSec": [
      4,
      5,
      6,
      8,
      10,
      12,
      15,
      20,
      30
    ],
    "parameters": [
      {
        "name": "mode",
        "label": "Mode",
        "type": "enum",
        "options": [
          "t2v",
          "omni_reference",
          "video_edit",
          "video_extension"
        ],
        "default": "t2v",
        "description": "Generation mode: 't2v' for prompt-only generation, 'omni_reference' for image, video, or audio references, 'video_edit' to edit one reference video (billed by that video's duration; 'duration' and 'aspect_ratio' are ignored), or 'video_extension' to extend a reference video ('aspect_ratio' is ignored — the output follows the extended video).",
        "inlinePill": true
      },
      {
        "name": "bitrate_mode",
        "label": "Bitrate",
        "type": "enum",
        "options": [
          "standard",
          "high"
        ],
        "default": "standard",
        "description": "'standard' = normal output bitrate; 'high' = higher bitrate output."
      },
      {
        "name": "extension_mode",
        "label": "Extend Direction",
        "type": "enum",
        "options": [
          "backward",
          "forward"
        ],
        "description": "Extension direction; required for mode 'video_extension' and not allowed otherwise."
      },
      {
        "name": "light",
        "label": "Light",
        "type": "enum",
        "options": [
          "preset",
          "custom",
          "user"
        ],
        "description": "Lighting source: 'preset' for a Cinema Studio scheme, 'user' for the caller's saved lighting preset, or 'custom' for a placed rig."
      },
      {
        "name": "color_palette",
        "label": "Color Palette",
        "type": "string",
        "description": "Color palette selection with type 'preset' or 'user' and its id."
      }
    ],
    "supportsReferences": true,
    "maxReferences": 30,
    "supportsAudio": true,
    "defaultAspect": "16:9",
    "defaultResolution": "720p",
    "defaultDurationSec": 5
  },
  {
    "id": "cinematic_studio_video_3_5",
    "label": "Cinema Studio Video 3.5",
    "modality": "video",
    "providerFamily": "Higgsfield",
    "supportsStartEndFrames": true,
    "mediaRoles": [
      "start_image",
      "end_image",
      "image_references",
      "video_references",
      "audio_references"
    ],
    "aspectRatios": [
      "auto",
      "21:9",
      "16:9",
      "4:3",
      "1:1",
      "3:4",
      "9:16"
    ],
    "resolutions": [
      "480p",
      "720p",
      "1080p"
    ],
    "durationsSec": [
      4,
      5,
      6,
      8,
      10,
      12,
      15
    ],
    "parameters": [
      {
        "name": "genre",
        "label": "Genre",
        "type": "enum",
        "options": [
          "auto",
          "action",
          "horror",
          "comedy",
          "noir",
          "drama",
          "epic"
        ],
        "default": "auto",
        "description": "Cinematic genre hint."
      },
      {
        "name": "enhance_prompt",
        "label": "Enhance Prompt",
        "type": "boolean",
        "default": false,
        "description": "Automatically rewrite the prompt for richer detail."
      },
      {
        "name": "prompt_language",
        "label": "Prompt Language",
        "type": "enum",
        "options": [
          "en",
          "zh"
        ],
        "default": "zh",
        "description": "Language the prompt is written in."
      },
      {
        "name": "multi_shots",
        "label": "Multi-Shot",
        "type": "boolean",
        "default": false,
        "description": "Split the video into multiple shots driven by multi_prompt."
      },
      {
        "name": "multi_shot_mode",
        "label": "Multi-Shot Mode",
        "type": "enum",
        "options": [
          "auto",
          "custom"
        ],
        "default": "custom",
        "description": "'auto' lets the model plan shots; 'custom' uses the given multi_prompt."
      },
      {
        "name": "camera_style",
        "label": "Camera Style",
        "type": "enum",
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
        "description": "Camera movement and framing style."
      },
      {
        "name": "light_scheme",
        "label": "Lighting",
        "type": "enum",
        "options": [
          "soft_cross",
          "contre_jour",
          "overhead_fall",
          "window",
          "practicals",
          "silhouette"
        ],
        "description": "Lighting scheme for the scene."
      },
      {
        "name": "color_grading",
        "label": "Color Grading",
        "type": "enum",
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
        "description": "Color grading look applied to the video."
      },
      {
        "name": "style_prompt",
        "label": "Style Prompt",
        "type": "string",
        "description": "Free-form description of the visual style. At most 2000 characters."
      }
    ],
    "supportsReferences": true,
    "maxReferences": 4,
    "supportsAudio": true,
    "defaultAspect": "16:9",
    "defaultResolution": "720p",
    "defaultDurationSec": 15
  },
  {
    "id": "cinematic_studio_3_0",
    "label": "Cinema Studio Video 3.0",
    "modality": "video",
    "providerFamily": "Higgsfield",
    "description": "Most advanced cinema-grade model",
    "supportsStartEndFrames": true,
    "mediaRoles": [
      "image",
      "start_image",
      "end_image"
    ],
    "aspectRatios": [
      "auto",
      "21:9",
      "16:9",
      "4:3",
      "1:1",
      "3:4",
      "9:16"
    ],
    "resolutions": [
      "480p",
      "720p",
      "1080p",
      "4k"
    ],
    "parameters": [
      {
        "name": "genre",
        "label": "Genre",
        "type": "enum",
        "options": [
          "auto",
          "action",
          "horror",
          "comedy",
          "noir",
          "drama",
          "epic"
        ],
        "default": "auto",
        "description": "Cinematic genre hint"
      }
    ],
    "supportsReferences": true,
    "maxReferences": 4,
    "supportsAudio": true,
    "defaultAspect": "16:9",
    "defaultResolution": "720p",
    "defaultDurationSec": 5
  },
  {
    "id": "cinematic_studio_video_v2",
    "label": "Cinema Studio Video 2.0",
    "modality": "video",
    "providerFamily": "Higgsfield",
    "description": "Refined cinematic camera and color, genre control",
    "supportsStartEndFrames": true,
    "mediaRoles": [
      "image",
      "start_image",
      "end_image"
    ],
    "aspectRatios": [
      "1:1",
      "4:3",
      "3:4",
      "16:9",
      "9:16"
    ],
    "parameters": [
      {
        "name": "genre",
        "label": "Genre",
        "type": "enum",
        "options": [
          "auto",
          "action",
          "horror",
          "comedy",
          "western",
          "suspense",
          "intimate",
          "spectacle"
        ],
        "default": "auto",
        "description": "Video genre/style"
      },
      {
        "name": "mode",
        "label": "Mode",
        "type": "enum",
        "options": [
          "pro",
          "std"
        ],
        "default": "std",
        "description": "Quality mode: pro or standard",
        "inlinePill": true
      },
      {
        "name": "speedramp",
        "label": "Speedramp",
        "type": "enum",
        "options": [
          "auto",
          "custom",
          "linear",
          "slowmo",
          "speedup",
          "impact"
        ],
        "default": "auto",
        "description": "Speed-ramp time effect (slowmo, speedup, etc.)."
      },
      {
        "name": "multi_shots",
        "label": "Multi-Shot",
        "type": "boolean",
        "default": false,
        "description": "Split the video into multiple shots driven by multi_prompt."
      },
      {
        "name": "multi_shot_mode",
        "label": "Multi-Shot Mode",
        "type": "enum",
        "options": [
          "auto",
          "custom"
        ],
        "default": "custom",
        "description": "'auto' lets the model plan shots; 'custom' uses the given multi_prompt."
      },
      {
        "name": "cfg_scale",
        "label": "CFG Scale",
        "type": "number",
        "default": 0.5,
        "min": 0,
        "max": 1,
        "description": "Prompt adherence strength (0-1)."
      }
    ],
    "supportsReferences": true,
    "maxReferences": 4,
    "supportsAudio": true,
    "defaultAspect": "16:9",
    "defaultDurationSec": 5
  },
  {
    "id": "cinematic_studio_video",
    "label": "Cinema Studio Video 1.0",
    "modality": "video",
    "providerFamily": "Higgsfield",
    "description": "Solid cinematic, dramatic compositions",
    "supportsStartEndFrames": true,
    "mediaRoles": [
      "image",
      "start_image",
      "end_image"
    ],
    "aspectRatios": [
      "1:1",
      "4:3",
      "3:4",
      "16:9",
      "9:16"
    ],
    "parameters": [
      {
        "name": "slow_motion",
        "label": "Slow Motion",
        "type": "boolean",
        "default": false,
        "description": "Enable slow motion effect"
      }
    ],
    "supportsReferences": true,
    "maxReferences": 4,
    "supportsAudio": true,
    "defaultAspect": "16:9",
    "defaultDurationSec": 5
  },
  {
    "id": "kling4_0",
    "label": "Kling 4.0",
    "modality": "video",
    "providerFamily": "Kling",
    "description": "Generate video from text, ordered keyframes, references, or edit an input video",
    "supportsStartEndFrames": true,
    "mediaRoles": [
      "start_image",
      "end_image",
      "image_references",
      "video_references"
    ],
    "aspectRatios": [
      "21:9",
      "16:9",
      "9:16",
      "1:1",
      "auto"
    ],
    "resolutions": [
      "720p",
      "1080p"
    ],
    "durationsSec": [
      3,
      4,
      5,
      6,
      8,
      10,
      12,
      15,
      20,
      30
    ],
    "parameters": [
      {
        "name": "mode",
        "label": "Mode",
        "type": "enum",
        "options": [
          "text-to-video",
          "image-to-video",
          "reference-to-video",
          "video-edit"
        ],
        "default": "text-to-video",
        "description": "Generation mode.",
        "inlinePill": true
      }
    ],
    "supportsReferences": true,
    "maxReferences": 10,
    "supportsAudio": false,
    "defaultAspect": "16:9",
    "defaultResolution": "1080p",
    "defaultDurationSec": 10
  },
  {
    "id": "kling_4_0_flash",
    "label": "Kling 4.0 Flash",
    "modality": "video",
    "providerFamily": "Kling",
    "description": "Fast 720p video from text, one first frame, references, or an input video",
    "supportsStartEndFrames": true,
    "mediaRoles": [
      "start_image",
      "image_references",
      "video_references"
    ],
    "aspectRatios": [
      "21:9",
      "16:9",
      "9:16",
      "1:1",
      "auto"
    ],
    "resolutions": [
      "720p"
    ],
    "durationsSec": [
      3,
      4,
      5,
      6,
      8,
      10,
      12,
      15,
      20
    ],
    "parameters": [
      {
        "name": "mode",
        "label": "Mode",
        "type": "enum",
        "options": [
          "text-to-video",
          "image-to-video",
          "reference-to-video",
          "video-edit"
        ],
        "default": "text-to-video",
        "description": "Generation mode.",
        "inlinePill": true
      }
    ],
    "supportsReferences": true,
    "maxReferences": 10,
    "supportsAudio": false,
    "defaultAspect": "16:9",
    "defaultResolution": "720p",
    "defaultDurationSec": 10
  },
  {
    "id": "kling3_0",
    "label": "Kling v3.0",
    "modality": "video",
    "providerFamily": "Kling",
    "description": "Multi-shot, audio sync, motion transfer",
    "supportsStartEndFrames": true,
    "mediaRoles": [
      "start_image",
      "end_image"
    ],
    "aspectRatios": [
      "16:9",
      "9:16",
      "1:1"
    ],
    "durationsSec": [
      3,
      4,
      5,
      6,
      8,
      10,
      12,
      15
    ],
    "parameters": [
      {
        "name": "mode",
        "label": "Mode",
        "type": "enum",
        "options": [
          "std",
          "pro",
          "4k"
        ],
        "default": "std",
        "description": "Generation mode: 'std' (standard), 'pro' (higher quality), or '4k' (4K resolution).",
        "inlinePill": true
      }
    ],
    "supportsReferences": true,
    "maxReferences": 4,
    "supportsAudio": true,
    "defaultAspect": "16:9",
    "defaultDurationSec": 5
  },
  {
    "id": "kling3_0_turbo",
    "label": "Kling 3.0 Turbo",
    "modality": "video",
    "providerFamily": "Kling",
    "description": "Fast text-to-video and single start-frame animation",
    "supportsStartEndFrames": true,
    "mediaRoles": [
      "start_image"
    ],
    "aspectRatios": [
      "16:9",
      "9:16",
      "1:1"
    ],
    "resolutions": [
      "720p",
      "1080p"
    ],
    "durationsSec": [
      3,
      4,
      5,
      6,
      8,
      10,
      12,
      15
    ],
    "supportsReferences": true,
    "maxReferences": 4,
    "supportsAudio": false,
    "defaultAspect": "16:9",
    "defaultResolution": "720p",
    "defaultDurationSec": 5
  },
  {
    "id": "kling_o3_image_reference",
    "label": "Kling 3.0 Omni",
    "modality": "video",
    "providerFamily": "Kling",
    "description": "Generate video from text and up to seven reference images",
    "mediaRoles": [
      "image_references"
    ],
    "aspectRatios": [
      "16:9",
      "9:16",
      "1:1"
    ],
    "durationsSec": [
      3,
      4,
      5,
      6,
      8,
      10,
      12,
      15
    ],
    "parameters": [
      {
        "name": "mode",
        "label": "Mode",
        "type": "enum",
        "options": [
          "std",
          "pro",
          "4k"
        ],
        "default": "std",
        "description": "Output quality: Standard, Pro, or 4K.",
        "inlinePill": true
      },
      {
        "name": "multi_shots",
        "label": "Multi-Shot",
        "type": "boolean",
        "default": false,
        "description": "Generate a sequence of multiple shots."
      }
    ],
    "supportsReferences": true,
    "maxReferences": 7,
    "supportsAudio": true,
    "defaultAspect": "16:9",
    "defaultDurationSec": 5
  },
  {
    "id": "kling_o3_flf",
    "label": "Kling 3.0 Omni (Frames)",
    "modality": "video",
    "providerFamily": "Kling",
    "description": "Generate video from text or a first frame and optional last frame",
    "supportsStartEndFrames": true,
    "mediaRoles": [
      "start_image",
      "end_image"
    ],
    "aspectRatios": [
      "16:9",
      "9:16",
      "1:1"
    ],
    "durationsSec": [
      3,
      4,
      5,
      6,
      8,
      10,
      12,
      15
    ],
    "parameters": [
      {
        "name": "mode",
        "label": "Mode",
        "type": "enum",
        "options": [
          "std",
          "pro",
          "4k"
        ],
        "default": "std",
        "description": "Output quality: Standard, Pro, or 4K.",
        "inlinePill": true
      },
      {
        "name": "multi_shots",
        "label": "Multi-Shot",
        "type": "boolean",
        "default": false,
        "description": "Generate a sequence of multiple shots."
      }
    ],
    "supportsReferences": true,
    "maxReferences": 4,
    "supportsAudio": true,
    "defaultAspect": "16:9",
    "defaultDurationSec": 5
  },
  {
    "id": "kling_video_edit",
    "label": "Kling 3.0 Omni Edit",
    "modality": "video",
    "providerFamily": "Kling",
    "description": "Edit a source video with text instructions and optional reference images",
    "mediaRoles": [
      "video_references",
      "image_references"
    ],
    "parameters": [
      {
        "name": "mode",
        "label": "Mode",
        "type": "enum",
        "options": [
          "std",
          "pro",
          "4k"
        ],
        "default": "pro",
        "description": "Output quality: Standard, Pro, or 4K.",
        "inlinePill": true
      }
    ],
    "supportsReferences": true,
    "maxReferences": 1,
    "supportsAudio": false,
    "defaultAspect": "16:9",
    "defaultDurationSec": 5
  },
  {
    "id": "kling3_0_motion_control",
    "label": "Kling 3.0 Motion Control",
    "modality": "video",
    "providerFamily": "Kling",
    "mediaRoles": [
      "image_references",
      "video_references"
    ],
    "parameters": [
      {
        "name": "mode",
        "label": "Mode",
        "type": "enum",
        "options": [
          "std",
          "pro"
        ],
        "default": "std",
        "description": "Motion control quality mode. 'std' = standard, 'pro' = higher quality.",
        "inlinePill": true
      },
      {
        "name": "background_source",
        "label": "BG Source",
        "type": "enum",
        "options": [
          "input_image",
          "input_video"
        ],
        "default": "input_image",
        "description": "Which input provides the background of the output: the reference image or the reference video."
      }
    ],
    "supportsReferences": true,
    "maxReferences": 4,
    "supportsAudio": false,
    "defaultAspect": "16:9",
    "defaultDurationSec": 5
  },
  {
    "id": "kling2_6",
    "label": "Kling 2.6 Video",
    "modality": "video",
    "providerFamily": "Kling",
    "description": "Cinematic motion, advanced physics",
    "supportsStartEndFrames": true,
    "mediaRoles": [
      "start_image"
    ],
    "aspectRatios": [
      "16:9",
      "9:16",
      "1:1"
    ],
    "durationsSec": [
      5,
      10
    ],
    "supportsReferences": true,
    "maxReferences": 4,
    "supportsAudio": true,
    "defaultAspect": "16:9",
    "defaultDurationSec": 5
  },
  {
    "id": "seedance_2_5",
    "label": "Seedance 2.5",
    "modality": "video",
    "providerFamily": "ByteDance",
    "description": "Unlimited on Ultimate · Seedance 2.5 text-to-video, multimodal omni-reference generation, video edit, and video extension",
    "supportsUnlim": true,
    "supportsStartEndFrames": true,
    "mediaRoles": [
      "start_image",
      "end_image",
      "image_references",
      "video_references",
      "audio_references"
    ],
    "aspectRatios": [
      "auto",
      "21:9",
      "16:9",
      "4:3",
      "1:1",
      "3:4",
      "9:16"
    ],
    "resolutions": [
      "480p",
      "720p",
      "1080p",
      "4k"
    ],
    "durationsSec": [
      4,
      5,
      6,
      8,
      10,
      12,
      15,
      20,
      30
    ],
    "parameters": [
      {
        "name": "mode",
        "label": "Mode",
        "type": "enum",
        "options": [
          "t2v",
          "omni_reference",
          "video_edit",
          "video_extension"
        ],
        "default": "t2v",
        "description": "Generation mode: 't2v' for prompt-only generation, 'omni_reference' for image, video, or audio references, 'video_edit' to edit one reference video (billed by that video's duration; 'duration' and 'aspect_ratio' are ignored), or 'video_extension' to extend a reference video ('aspect_ratio' is ignored — the output follows the extended video).",
        "inlinePill": true
      },
      {
        "name": "bitrate_mode",
        "label": "Bitrate",
        "type": "enum",
        "options": [
          "standard",
          "high"
        ],
        "default": "standard",
        "description": "'standard' = normal output bitrate; 'high' = higher bitrate output."
      },
      {
        "name": "extension_mode",
        "label": "Extend Direction",
        "type": "enum",
        "options": [
          "backward",
          "forward"
        ],
        "description": "Extension direction; required for mode 'video_extension' and not allowed otherwise."
      },
      {
        "name": "draft",
        "label": "Draft",
        "type": "boolean",
        "default": false,
        "description": "Generate a 480p draft that can be finalized within seven days."
      },
      {
        "name": "use_unlim",
        "label": "Billing Mode",
        "type": "enum",
        "options": [
          "auto",
          "unlimited",
          "credits"
        ],
        "default": "auto",
        "description": "Auto uses Ultimate unlimited for 1x and credits for multi-batch, or force queue mode."
      }
    ],
    "supportsReferences": true,
    "maxReferences": 30,
    "supportsAudio": true,
    "defaultAspect": "16:9",
    "defaultResolution": "720p",
    "defaultDurationSec": 5
  },
  {
    "id": "seedance_2_5_flash",
    "label": "Seedance 2.5 Flash",
    "modality": "video",
    "providerFamily": "ByteDance",
    "description": "Seedance 2.5 Flash video generation, editing, and extension",
    "supportsStartEndFrames": true,
    "mediaRoles": [
      "start_image",
      "end_image",
      "image_references",
      "video_references",
      "audio_references"
    ],
    "aspectRatios": [
      "auto",
      "21:9",
      "16:9",
      "4:3",
      "1:1",
      "3:4",
      "9:16"
    ],
    "resolutions": [
      "480p",
      "720p"
    ],
    "durationsSec": [
      4,
      5,
      6,
      8,
      10,
      12,
      15,
      20,
      30
    ],
    "parameters": [
      {
        "name": "mode",
        "label": "Mode",
        "type": "enum",
        "options": [
          "t2v",
          "omni_reference",
          "video_edit",
          "video_extension"
        ],
        "default": "t2v",
        "description": "Generation mode: 't2v' for prompt-only generation, 'omni_reference' for image, video, or audio references, 'video_edit' to edit one reference video (billed by that video's duration; 'duration' and 'aspect_ratio' are ignored), or 'video_extension' to extend a reference video ('aspect_ratio' is ignored — the output follows the extended video).",
        "inlinePill": true
      },
      {
        "name": "bitrate_mode",
        "label": "Bitrate",
        "type": "enum",
        "options": [
          "standard",
          "high"
        ],
        "default": "standard",
        "description": "'standard' = normal output bitrate; 'high' = higher bitrate output."
      },
      {
        "name": "extension_mode",
        "label": "Extend Direction",
        "type": "enum",
        "options": [
          "backward",
          "forward"
        ],
        "description": "Extension direction; required for mode 'video_extension' and not allowed otherwise."
      }
    ],
    "supportsReferences": true,
    "maxReferences": 10,
    "supportsAudio": true,
    "defaultAspect": "16:9",
    "defaultResolution": "720p",
    "defaultDurationSec": 5
  },
  {
    "id": "seedance_2_0",
    "label": "Seedance 2.0",
    "modality": "video",
    "providerFamily": "ByteDance",
    "description": "Unlimited on Ultimate · Reference-driven video with image/video/audio reference inputs, consistent identity, multi-SKU; optional generate_audio for native audio",
    "supportsUnlim": true,
    "supportsStartEndFrames": true,
    "mediaRoles": [
      "start_image",
      "end_image",
      "image_references",
      "video_references",
      "audio_references"
    ],
    "aspectRatios": [
      "auto",
      "16:9",
      "9:16",
      "4:3",
      "3:4",
      "1:1",
      "21:9"
    ],
    "resolutions": [
      "480p",
      "720p",
      "1080p",
      "4k"
    ],
    "durationsSec": [
      4,
      5,
      6,
      8,
      10,
      12,
      15
    ],
    "parameters": [
      {
        "name": "mode",
        "label": "Mode",
        "type": "enum",
        "options": [
          "std",
          "fast"
        ],
        "default": "std",
        "description": "'std' = higher quality, supports 480p/720p/1080p/4k, requires a Plus plan or higher (Pro on legacy plans); 'fast' = cheaper/faster, supports 480p/720p only, available from the Basic/Starter plan.",
        "inlinePill": true
      },
      {
        "name": "bitrate_mode",
        "label": "Bitrate",
        "type": "enum",
        "options": [
          "standard",
          "high"
        ],
        "default": "standard",
        "description": "'standard' = normal output bitrate; 'high' = higher bitrate output."
      },
      {
        "name": "genre",
        "label": "Genre",
        "type": "enum",
        "options": [
          "auto",
          "action",
          "horror",
          "comedy",
          "noir",
          "drama",
          "epic"
        ],
        "default": "auto",
        "description": "Cinematic genre hint."
      },
      {
        "name": "use_unlim",
        "label": "Billing Mode",
        "type": "enum",
        "options": [
          "auto",
          "unlimited",
          "credits"
        ],
        "default": "auto",
        "description": "Auto uses Ultimate unlimited for 1x and credits for multi-batch, or force queue mode."
      }
    ],
    "supportsReferences": true,
    "maxReferences": 3,
    "supportsAudio": true,
    "defaultAspect": "16:9",
    "defaultResolution": "720p",
    "defaultDurationSec": 5
  },
  {
    "id": "seedance_2_0_mini",
    "label": "Seedance 2.0 Mini",
    "modality": "video",
    "providerFamily": "ByteDance",
    "description": "Fast budget Seedance 2.0 variant with image/video/audio reference inputs and native audio",
    "supportsStartEndFrames": true,
    "mediaRoles": [
      "start_image",
      "end_image",
      "image_references",
      "video_references",
      "audio_references"
    ],
    "aspectRatios": [
      "auto",
      "16:9",
      "9:16",
      "4:3",
      "3:4",
      "1:1",
      "21:9"
    ],
    "resolutions": [
      "480p",
      "720p"
    ],
    "durationsSec": [
      4,
      5,
      6,
      8,
      10,
      12,
      15
    ],
    "parameters": [
      {
        "name": "bitrate_mode",
        "label": "Bitrate",
        "type": "enum",
        "options": [
          "standard",
          "high"
        ],
        "default": "standard",
        "description": "'standard' = normal output bitrate; 'high' = higher bitrate output."
      },
      {
        "name": "genre",
        "label": "Genre",
        "type": "enum",
        "options": [
          "auto",
          "action",
          "horror",
          "comedy",
          "noir",
          "drama",
          "epic"
        ],
        "default": "auto",
        "description": "Cinematic genre hint."
      }
    ],
    "supportsReferences": true,
    "maxReferences": 3,
    "supportsAudio": true,
    "defaultAspect": "16:9",
    "defaultResolution": "720p",
    "defaultDurationSec": 5
  },
  {
    "id": "veo3_1",
    "label": "Google Veo 3.1",
    "modality": "video",
    "providerFamily": "Google",
    "description": "Ultra-realistic, top-tier cinematic quality",
    "supportsStartEndFrames": true,
    "mediaRoles": [
      "start_image"
    ],
    "aspectRatios": [
      "16:9",
      "9:16"
    ],
    "durationsSec": [
      4,
      6,
      8
    ],
    "parameters": [
      {
        "name": "quality",
        "label": "Quality",
        "type": "enum",
        "options": [
          "basic",
          "high",
          "ultra"
        ],
        "default": "basic",
        "description": "Output quality tier.",
        "inlinePill": true
      },
      {
        "name": "variant",
        "label": "Variant",
        "type": "enum",
        "options": [
          "veo-3-1-preview",
          "veo-3-1-fast"
        ],
        "default": "veo-3-1-fast",
        "description": "Veo 3.1 variant: 'veo-3-1-preview' = best quality, 'veo-3-1-fast' = faster generation.",
        "inlinePill": true
      }
    ],
    "supportsReferences": true,
    "maxReferences": 4,
    "supportsAudio": false,
    "defaultAspect": "16:9",
    "defaultDurationSec": 8
  },
  {
    "id": "veo3_1_lite",
    "label": "Google Veo 3.1 Lite",
    "modality": "video",
    "providerFamily": "Google",
    "description": "Fast, affordable, budget batch clips",
    "supportsStartEndFrames": true,
    "mediaRoles": [
      "start_image",
      "end_image"
    ],
    "aspectRatios": [
      "16:9",
      "9:16",
      "auto"
    ],
    "durationsSec": [
      4,
      6,
      8
    ],
    "supportsReferences": true,
    "maxReferences": 4,
    "supportsAudio": true,
    "defaultAspect": "16:9",
    "defaultDurationSec": 8
  },
  {
    "id": "gemini_omni_flash_1_2",
    "label": "Gemini Omni Flash 1.2",
    "modality": "video",
    "providerFamily": "Google",
    "description": "Gemini Omni Flash 1.2 video generation, keyframes, multimodal references, editing with reference images, and clip extension with native audio",
    "supportsStartEndFrames": true,
    "mediaRoles": [
      "start_image",
      "end_image",
      "image_references",
      "video_references"
    ],
    "aspectRatios": [
      "16:9",
      "9:16"
    ],
    "resolutions": [
      "360p",
      "720p",
      "1080p",
      "4k"
    ],
    "durationsSec": [
      3,
      4,
      5,
      6,
      8,
      10,
      12,
      15
    ],
    "parameters": [
      {
        "name": "mode",
        "label": "Mode",
        "type": "enum",
        "options": [
          "text-to-video",
          "image-to-video",
          "reference-to-video",
          "edit",
          "extend"
        ],
        "required": true,
        "description": "Generation mode.",
        "inlinePill": true
      }
    ],
    "supportsReferences": true,
    "maxReferences": 7,
    "supportsAudio": false,
    "defaultAspect": "16:9",
    "defaultResolution": "720p",
    "defaultDurationSec": 8
  },
  {
    "id": "gemini_omni_flash_1_1",
    "label": "Gemini Omni Flash 1.1",
    "modality": "video",
    "providerFamily": "Google",
    "description": "Gemini Omni Flash 1.1 text-to-video, keyframe animation, multimodal reference generation, and video editing with native audio",
    "supportsStartEndFrames": true,
    "mediaRoles": [
      "start_image",
      "end_image",
      "image_references",
      "video_references"
    ],
    "aspectRatios": [
      "16:9",
      "9:16"
    ],
    "resolutions": [
      "360p",
      "720p",
      "1080p",
      "4k"
    ],
    "durationsSec": [
      3,
      4,
      5,
      6,
      8,
      10
    ],
    "parameters": [
      {
        "name": "mode",
        "label": "Mode",
        "type": "enum",
        "options": [
          "text-to-video",
          "image-to-video",
          "reference-to-video",
          "edit"
        ],
        "required": true,
        "description": "Generation mode.",
        "inlinePill": true
      }
    ],
    "supportsReferences": true,
    "maxReferences": 7,
    "supportsAudio": false,
    "defaultAspect": "16:9",
    "defaultResolution": "720p",
    "defaultDurationSec": 8
  },
  {
    "id": "flux_3_video",
    "label": "FLUX 3 Video",
    "modality": "video",
    "providerFamily": "FLUX",
    "description": "Text-to-video, multi-frame image-to-video, and video continuation with synchronized audio",
    "supportsStartEndFrames": true,
    "mediaRoles": [
      "start_image",
      "end_image",
      "image_references",
      "video_references"
    ],
    "aspectRatios": [
      "auto",
      "21:9",
      "2:1",
      "16:9",
      "4:3",
      "1:1",
      "3:4",
      "9:16"
    ],
    "resolutions": [
      "720p",
      "1080p",
      "2k",
      "4k"
    ],
    "durationsSec": [
      5,
      6,
      8,
      10,
      12,
      15,
      20
    ],
    "supportsReferences": true,
    "maxReferences": 10,
    "supportsAudio": true,
    "defaultAspect": "16:9",
    "defaultResolution": "720p",
    "defaultDurationSec": 5
  },
  {
    "id": "flux_3_video_edit",
    "label": "FLUX 3 Video Edit",
    "modality": "video",
    "providerFamily": "FLUX",
    "description": "Edit a video with a text prompt. Uses the first 15 seconds at most; costs 1 credit per second of the processed clip.",
    "mediaRoles": [
      "video_references"
    ],
    "supportsReferences": true,
    "maxReferences": 1,
    "supportsAudio": false,
    "defaultAspect": "16:9",
    "defaultDurationSec": 5
  },
  {
    "id": "wan3_0_prime",
    "label": "Wan 3.0 Prime",
    "modality": "video",
    "providerFamily": "Wan",
    "description": "Wan 3.0 Prime text-to-video, first/last frame video, and multimodal reference-to-video with native audio",
    "supportsStartEndFrames": true,
    "mediaRoles": [
      "start_image",
      "end_image",
      "image_references",
      "video_references",
      "audio_references"
    ],
    "aspectRatios": [
      "auto",
      "16:9",
      "9:16",
      "1:1",
      "4:3",
      "3:4"
    ],
    "resolutions": [
      "480p",
      "720p",
      "1080p"
    ],
    "durationsSec": [
      -1,
      2,
      3,
      4,
      5,
      6,
      8,
      10,
      12,
      15,
      20,
      30
    ],
    "parameters": [
      {
        "name": "enable_thinking",
        "label": "Thinking",
        "type": "boolean",
        "default": false,
        "description": "Let the model reason about the prompt before generating (slower, better prompt adherence)."
      }
    ],
    "supportsReferences": true,
    "maxReferences": 10,
    "supportsAudio": true,
    "defaultAspect": "16:9",
    "defaultResolution": "720p",
    "defaultDurationSec": 5
  },
  {
    "id": "wan3_0",
    "label": "Wan 3.0",
    "modality": "video",
    "providerFamily": "Wan",
    "description": "Wan 3.0 text-to-video, first/last frame video, and multimodal reference-to-video with native audio",
    "supportsStartEndFrames": true,
    "mediaRoles": [
      "start_image",
      "end_image",
      "image_references",
      "video_references",
      "audio_references"
    ],
    "aspectRatios": [
      "auto",
      "16:9",
      "9:16",
      "1:1",
      "4:3",
      "3:4"
    ],
    "resolutions": [
      "480p",
      "720p",
      "1080p"
    ],
    "durationsSec": [
      -1,
      2,
      3,
      4,
      5,
      6,
      8,
      10,
      12,
      15,
      20,
      30
    ],
    "parameters": [
      {
        "name": "enable_thinking",
        "label": "Thinking",
        "type": "boolean",
        "default": false,
        "description": "Let the model reason about the prompt before generating (slower, better prompt adherence)."
      }
    ],
    "supportsReferences": true,
    "maxReferences": 10,
    "supportsAudio": true,
    "defaultAspect": "16:9",
    "defaultResolution": "720p",
    "defaultDurationSec": 5
  },
  {
    "id": "wan2_7",
    "label": "Wan 2.7",
    "modality": "video",
    "providerFamily": "Wan",
    "description": "Synchronized audio, character-consistent video",
    "supportsStartEndFrames": true,
    "mediaRoles": [
      "start_image",
      "end_image",
      "audio_references"
    ],
    "aspectRatios": [
      "16:9",
      "9:16",
      "1:1",
      "4:3",
      "3:4"
    ],
    "resolutions": [
      "720p",
      "1080p"
    ],
    "durationsSec": [
      2,
      3,
      4,
      5,
      6,
      8,
      10,
      12,
      15
    ],
    "supportsReferences": true,
    "maxReferences": 4,
    "supportsAudio": false,
    "defaultAspect": "16:9",
    "defaultResolution": "720p",
    "defaultDurationSec": 5
  },
  {
    "id": "wan2_6",
    "label": "Wan 2.6 Video",
    "modality": "video",
    "providerFamily": "Wan",
    "description": "Open-weight, stylized, experimental creative",
    "mediaRoles": [
      "image_references",
      "video_references",
      "audio_references"
    ],
    "aspectRatios": [
      "16:9",
      "9:16",
      "1:1"
    ],
    "durationsSec": [
      5,
      10,
      15
    ],
    "parameters": [
      {
        "name": "quality",
        "label": "Quality",
        "type": "enum",
        "options": [
          "720p",
          "1080p"
        ],
        "default": "720p",
        "description": "Output resolution / quality.",
        "inlinePill": true
      }
    ],
    "supportsReferences": true,
    "maxReferences": 1,
    "supportsAudio": false,
    "defaultAspect": "16:9",
    "defaultDurationSec": 5
  },
  {
    "id": "minimax_h3",
    "label": "MiniMax H3",
    "modality": "video",
    "providerFamily": "MiniMax",
    "description": "Multimodal video generation with keyframes or image/video/audio references",
    "supportsStartEndFrames": true,
    "mediaRoles": [
      "start_image",
      "end_image",
      "image_references",
      "video_references",
      "audio_references"
    ],
    "aspectRatios": [
      "auto",
      "21:9",
      "16:9",
      "4:3",
      "1:1",
      "3:4",
      "9:16"
    ],
    "resolutions": [
      "2K"
    ],
    "durationsSec": [
      4,
      5,
      6,
      8,
      10,
      12,
      15
    ],
    "supportsReferences": true,
    "maxReferences": 9,
    "supportsAudio": false,
    "defaultAspect": "16:9",
    "defaultResolution": "2K",
    "defaultDurationSec": 5
  },
  {
    "id": "minimax_h3_max",
    "label": "MiniMax H3 Max",
    "modality": "video",
    "providerFamily": "MiniMax",
    "description": "Fast text-to-video, keyframe, and multimodal-reference video generation",
    "supportsStartEndFrames": true,
    "mediaRoles": [
      "start_image",
      "end_image",
      "image_references",
      "video_references",
      "audio_references"
    ],
    "aspectRatios": [
      "auto",
      "21:9",
      "16:9",
      "4:3",
      "1:1",
      "3:4",
      "9:16"
    ],
    "resolutions": [
      "480p",
      "768p"
    ],
    "durationsSec": [
      5,
      6,
      8,
      10,
      12,
      15
    ],
    "supportsReferences": true,
    "maxReferences": 12,
    "supportsAudio": false,
    "defaultAspect": "16:9",
    "defaultResolution": "768p",
    "defaultDurationSec": 5
  },
  {
    "id": "minimax_hailuo",
    "label": "Minimax Hailuo",
    "modality": "video",
    "providerFamily": "MiniMax",
    "description": "Natural physics, facial emotion, multiple variants",
    "supportsStartEndFrames": true,
    "mediaRoles": [
      "start_image",
      "end_image"
    ],
    "resolutions": [
      "512",
      "768",
      "1080"
    ],
    "durationsSec": [
      6,
      10
    ],
    "parameters": [
      {
        "name": "variant",
        "label": "Variant",
        "type": "enum",
        "options": [
          "minimax",
          "minimax-fast",
          "minimax-2.3",
          "minimax-2.3-fast"
        ],
        "default": "minimax-2.3",
        "description": "Minimax Hailuo model variant.",
        "inlinePill": true
      }
    ],
    "supportsReferences": true,
    "maxReferences": 4,
    "supportsAudio": false,
    "defaultAspect": "16:9",
    "defaultResolution": "768",
    "defaultDurationSec": 6
  },
  {
    "id": "grok_video_v15",
    "label": "Grok Video 1.5",
    "modality": "video",
    "providerFamily": "xAI",
    "description": "Multimodal video generation from text, a start image, or image and audio references",
    "supportsStartEndFrames": true,
    "mediaRoles": [
      "start_image",
      "image_references",
      "audio_references"
    ],
    "resolutions": [
      "480p",
      "720p",
      "1080p"
    ],
    "durationsSec": [
      2,
      3,
      4,
      5,
      6,
      8,
      10,
      12,
      15
    ],
    "supportsReferences": true,
    "maxReferences": 7,
    "supportsAudio": false,
    "defaultAspect": "16:9",
    "defaultResolution": "720p",
    "defaultDurationSec": 5
  },
  {
    "id": "grok_video_v15_lite",
    "label": "Grok Imagine Video 1.5 Lite",
    "modality": "video",
    "providerFamily": "xAI",
    "description": "Fast text and first-frame image-to-video generation, up to 1080p (upscaled)",
    "supportsStartEndFrames": true,
    "mediaRoles": [
      "start_image"
    ],
    "aspectRatios": [
      "auto",
      "16:9",
      "9:16",
      "4:3",
      "3:4",
      "1:1",
      "3:2",
      "2:3"
    ],
    "resolutions": [
      "480p",
      "720p",
      "1080p"
    ],
    "durationsSec": [
      2,
      3,
      4,
      5,
      6,
      8,
      10,
      12,
      15
    ],
    "supportsReferences": true,
    "maxReferences": 4,
    "supportsAudio": false,
    "defaultAspect": "16:9",
    "defaultResolution": "720p",
    "defaultDurationSec": 5
  },
  {
    "id": "grok_video",
    "label": "Grok Video",
    "modality": "video",
    "providerFamily": "xAI",
    "description": "Text and image-to-video, audio support",
    "supportsStartEndFrames": true,
    "mediaRoles": [
      "start_image"
    ],
    "aspectRatios": [
      "16:9",
      "9:16",
      "1:1"
    ],
    "durationsSec": [
      2,
      3,
      4,
      5,
      6,
      8,
      10,
      12,
      15
    ],
    "supportsReferences": true,
    "maxReferences": 4,
    "supportsAudio": false,
    "defaultAspect": "16:9",
    "defaultDurationSec": 5
  },
  {
    "id": "happy_horse_video",
    "label": "Happy Horse Video",
    "modality": "video",
    "providerFamily": "Happy Horse",
    "description": "Text-to-video and single start-frame animation",
    "supportsStartEndFrames": true,
    "mediaRoles": [
      "start_image"
    ],
    "aspectRatios": [
      "16:9",
      "9:16",
      "1:1",
      "4:3",
      "3:4"
    ],
    "resolutions": [
      "720p",
      "1080p"
    ],
    "durationsSec": [
      3,
      4,
      5,
      6,
      8,
      10,
      12,
      15
    ],
    "supportsReferences": true,
    "maxReferences": 4,
    "supportsAudio": false,
    "defaultAspect": "16:9",
    "defaultResolution": "720p",
    "defaultDurationSec": 5
  },
  {
    "id": "ad_multiplier",
    "label": "Ad Multiplier",
    "modality": "video",
    "providerFamily": "Higgsfield",
    "description": "Ad Multiplier video generation powered by Seedance 2.5",
    "supportsStartEndFrames": true,
    "mediaRoles": [
      "start_image",
      "end_image",
      "image_references",
      "video_references",
      "audio_references"
    ],
    "aspectRatios": [
      "auto",
      "21:9",
      "16:9",
      "4:3",
      "1:1",
      "3:4",
      "9:16"
    ],
    "resolutions": [
      "480p",
      "720p",
      "1080p"
    ],
    "durationsSec": [
      4,
      5,
      6,
      8,
      10,
      12,
      15,
      20,
      30
    ],
    "parameters": [
      {
        "name": "mode",
        "label": "Mode",
        "type": "enum",
        "options": [
          "t2v",
          "omni_reference",
          "video_edit",
          "video_extension"
        ],
        "default": "t2v",
        "description": "Generation mode: 't2v' for prompt-only generation, 'omni_reference' for image, video, or audio references, 'video_edit' to edit one reference video (billed by that video's duration; 'duration' and 'aspect_ratio' are ignored), or 'video_extension' to extend a reference video ('aspect_ratio' is ignored — the output follows the extended video).",
        "inlinePill": true
      },
      {
        "name": "bitrate_mode",
        "label": "Bitrate",
        "type": "enum",
        "options": [
          "standard",
          "high"
        ],
        "default": "standard",
        "description": "'standard' = normal output bitrate; 'high' = higher bitrate output."
      },
      {
        "name": "extension_mode",
        "label": "Extend Direction",
        "type": "enum",
        "options": [
          "backward",
          "forward"
        ],
        "description": "Extension direction; required for mode 'video_extension' and not allowed otherwise."
      }
    ],
    "supportsReferences": true,
    "maxReferences": 30,
    "supportsAudio": true,
    "defaultAspect": "16:9",
    "defaultResolution": "720p",
    "defaultDurationSec": 5
  },
  {
    "id": "ad_multiplier_v2",
    "label": "Ad Multiplier Recreate",
    "modality": "video",
    "providerFamily": "Higgsfield",
    "description": "Recreate a 4-30 second source ad as a new ad for another audience, language, product, cast or setting, keeping its structure, beats and pacing, or regenerate only its hook, its CTA or both and stitch them back into the source. Everything is decided from the video, the images and the prompt: the backend analyzes the source, classifies the images and writes the generation prompt.",
    "mediaRoles": [
      "video_references",
      "image_references"
    ],
    "resolutions": [
      "480p",
      "720p",
      "1080p"
    ],
    "parameters": [
      {
        "name": "mode",
        "label": "Mode",
        "type": "enum",
        "options": [
          "recreate",
          "sections"
        ],
        "default": "recreate",
        "description": "recreate renders the whole ad again and costs the source length rounded up. sections renders a new hook (4-15 s), CTA (4-5 s) or both, each in its own render, and stitches them in place of the source ones; the rest of the source is kept as is. The run reserves the longest lengths and is charged for the lengths it renders. With both, if one part fails the other is still delivered with the source kept in place of the failed one, and only the delivered part is charged. If the source has no clear hook or CTA, the new one is added before (hook) or after (CTA) the whole source instead.",
        "inlinePill": true
      },
      {
        "name": "section",
        "label": "Section",
        "type": "enum",
        "options": [
          "hook",
          "cta",
          "both"
        ],
        "description": "With mode sections, which part to regenerate: hook (the opening), cta (the closing call to action) or both. Omit it for recreate."
      }
    ],
    "supportsReferences": true,
    "maxReferences": 1,
    "supportsAudio": false,
    "defaultAspect": "16:9",
    "defaultResolution": "720p",
    "defaultDurationSec": 5
  },
  {
    "id": "bytedance_video_upscale",
    "label": "Bytedance Video Upscale",
    "modality": "video",
    "providerFamily": "ByteDance",
    "mediaRoles": [
      "video_references"
    ],
    "resolutions": [
      "1080p",
      "2k",
      "4k"
    ],
    "parameters": [
      {
        "name": "fps",
        "label": "Fps",
        "type": "number",
        "default": 24,
        "min": 24,
        "max": 60,
        "description": "Output frame rate in frames per second (24-60). Whole number."
      },
      {
        "name": "preset",
        "label": "Preset",
        "type": "enum",
        "options": [
          "common",
          "aigc",
          "short_series",
          "ugc",
          "old_film"
        ],
        "default": "common",
        "description": "Content-type preset that tunes the upscaler for the source material."
      },
      {
        "name": "model_version",
        "label": "Model Version",
        "type": "enum",
        "options": [
          "standard",
          "pro"
        ],
        "default": "standard",
        "description": "Upscaler model tier: 'standard' or higher-quality 'pro'."
      }
    ],
    "supportsReferences": true,
    "maxReferences": 1,
    "supportsAudio": false,
    "defaultAspect": "16:9",
    "defaultResolution": "2k",
    "defaultDurationSec": 5
  },
  {
    "id": "depth_anything_video",
    "label": "Depth Anything Video",
    "modality": "video",
    "providerFamily": "Tools & Upscale",
    "description": "Generate a depth map from a source video",
    "mediaRoles": [
      "video_references"
    ],
    "resolutions": [
      "auto",
      "360p",
      "480p",
      "720p",
      "1080p"
    ],
    "parameters": [
      {
        "name": "variant",
        "label": "Variant",
        "type": "enum",
        "options": [
          "VDA-Small",
          "VDA-Base",
          "VDA-Large"
        ],
        "default": "VDA-Large",
        "description": "Depth estimation model size.",
        "inlinePill": true
      },
      {
        "name": "colormap",
        "label": "Colormap",
        "type": "enum",
        "options": [
          "grayscale",
          "turbo",
          "inferno",
          "magma",
          "viridis"
        ],
        "default": "grayscale",
        "description": "Color palette for the depth map."
      },
      {
        "name": "max_frames",
        "label": "Max Frames",
        "type": "number",
        "min": 1,
        "max": 1800,
        "description": "Maximum frames to process; defaults to at most 1800 source frames. Whole number."
      },
      {
        "name": "side_by_side",
        "label": "Side-by-Side",
        "type": "boolean",
        "default": false,
        "description": "Show the source video beside the depth map."
      }
    ],
    "supportsReferences": true,
    "maxReferences": 1,
    "supportsAudio": false,
    "defaultAspect": "16:9",
    "defaultResolution": "auto",
    "defaultDurationSec": 5
  },
  {
    "id": "draw_to_video",
    "label": "Draw To Video",
    "modality": "video",
    "providerFamily": "Higgsfield",
    "mediaRoles": [
      "video",
      "image_references",
      "ref_image"
    ],
    "aspectRatios": [
      "auto",
      "21:9",
      "16:9",
      "4:3",
      "1:1",
      "3:4",
      "9:16"
    ],
    "resolutions": [
      "480p",
      "720p",
      "1080p"
    ],
    "durationsSec": [
      5,
      8,
      10,
      15
    ],
    "parameters": [
      {
        "name": "enhancer",
        "label": "Enhancer",
        "type": "boolean",
        "default": true,
        "description": "Enhance the prompt before generation."
      }
    ],
    "supportsReferences": true,
    "maxReferences": 4,
    "supportsAudio": true,
    "defaultAspect": "16:9",
    "defaultResolution": "720p",
    "defaultDurationSec": 5
  },
  {
    "id": "fps_boost",
    "label": "FPS Boost",
    "modality": "video",
    "providerFamily": "Tools & Upscale",
    "description": "Increase video frame rate with ByteDance or Topaz",
    "mediaRoles": [
      "video_references"
    ],
    "parameters": [
      {
        "name": "variant",
        "label": "Variant",
        "type": "enum",
        "options": [
          "bytedance",
          "topaz"
        ],
        "required": true,
        "description": "Frame interpolation provider.",
        "inlinePill": true
      },
      {
        "name": "fps",
        "label": "Fps",
        "type": "number",
        "min": 16,
        "max": 120,
        "required": true,
        "description": "Target frame rate; ByteDance requires at least 24. Whole number."
      }
    ],
    "supportsReferences": true,
    "maxReferences": 1,
    "supportsAudio": false,
    "defaultAspect": "16:9",
    "defaultDurationSec": 5
  },
  {
    "id": "hf_mult_motion_control_flash",
    "label": "Genjutsu Lite Motion",
    "modality": "video",
    "providerFamily": "Higgsfield",
    "description": "Transfer motion from a reference video to subjects in reference images (Wan 3.0, up to 15 seconds)",
    "mediaRoles": [
      "image_references",
      "video_references"
    ],
    "resolutions": [
      "480p",
      "720p",
      "1080p"
    ],
    "supportsReferences": true,
    "maxReferences": 10,
    "supportsAudio": false,
    "defaultAspect": "16:9",
    "defaultResolution": "720p",
    "defaultDurationSec": 5
  },
  {
    "id": "hf_mult_replace_object_flash",
    "label": "Genjutsu Lite Replace",
    "modality": "video",
    "providerFamily": "Higgsfield",
    "description": "Replace objects in a source video using reference images (Kling 4.0)",
    "mediaRoles": [
      "image_references",
      "video_references"
    ],
    "resolutions": [
      "720p",
      "1080p"
    ],
    "supportsReferences": true,
    "maxReferences": 10,
    "supportsAudio": false,
    "defaultAspect": "16:9",
    "defaultResolution": "720p",
    "defaultDurationSec": 5
  },
  {
    "id": "hf_mult_motion_control",
    "label": "Genjutsu Motion Control",
    "modality": "video",
    "providerFamily": "Higgsfield",
    "description": "Transfer motion from a reference video to subjects in reference images",
    "mediaRoles": [
      "image_references",
      "video_references"
    ],
    "resolutions": [
      "480p",
      "720p",
      "1080p"
    ],
    "supportsReferences": true,
    "maxReferences": 49,
    "supportsAudio": false,
    "defaultAspect": "16:9",
    "defaultResolution": "720p",
    "defaultDurationSec": 5
  },
  {
    "id": "hf_mult_replace_object",
    "label": "Genjutsu Replace Object",
    "modality": "video",
    "providerFamily": "Higgsfield",
    "description": "Replace objects in a source video using reference images",
    "mediaRoles": [
      "image_references",
      "video_references"
    ],
    "resolutions": [
      "480p",
      "720p",
      "1080p"
    ],
    "supportsReferences": true,
    "maxReferences": 30,
    "supportsAudio": false,
    "defaultAspect": "16:9",
    "defaultResolution": "720p",
    "defaultDurationSec": 5
  },
  {
    "id": "intone",
    "label": "Higgsfield Intone",
    "modality": "video",
    "providerFamily": "Higgsfield",
    "description": "Talking-head video: one or two characters speak one to six voice recordings, alone to the camera or to each other, in the room of a location image or one the prompt names; a prompt asking for action, several places or camera work stages it in up to five shots. It runs the voices (2 to 30 seconds in total, the pauses between files not counted) and 2.5 s more, 4 to 30 seconds",
    "mediaRoles": [
      "character_images",
      "location_image",
      "image_references",
      "audio_references"
    ],
    "aspectRatios": [
      "21:9",
      "16:9",
      "9:16",
      "1:1",
      "4:3",
      "3:4"
    ],
    "resolutions": [
      "480p",
      "720p",
      "1080p"
    ],
    "parameters": [
      {
        "name": "bitrate_mode",
        "label": "Bitrate",
        "type": "enum",
        "options": [
          "high",
          "standard"
        ],
        "default": "high",
        "description": "Bitrate of the output video: high or standard."
      }
    ],
    "supportsReferences": true,
    "maxReferences": 2,
    "supportsAudio": false,
    "defaultAspect": "16:9",
    "defaultResolution": "1080p",
    "defaultDurationSec": 5
  },
  {
    "id": "higgsfield_preset",
    "label": "Higgsfield Preset",
    "modality": "video",
    "providerFamily": "Higgsfield",
    "description": "Legacy image-to-video generation for an existing preset ID. Browse new Viral presets with get_presets and execute them with execute_preset",
    "mediaRoles": [
      "image"
    ],
    "aspectRatios": [
      "16:9",
      "9:16",
      "1:1"
    ],
    "supportsReferences": true,
    "maxReferences": 4,
    "supportsAudio": false,
    "defaultAspect": "16:9",
    "defaultDurationSec": 5
  },
  {
    "id": "marketing_studio_video",
    "label": "Marketing Studio",
    "modality": "video",
    "providerFamily": "Higgsfield",
    "description": "One-click product ads, TikTok/Reels ready",
    "supportsStartEndFrames": true,
    "mediaRoles": [
      "image",
      "start_image",
      "end_image"
    ],
    "aspectRatios": [
      "auto",
      "21:9",
      "16:9",
      "4:3",
      "1:1",
      "3:4",
      "9:16"
    ],
    "resolutions": [
      "480p",
      "720p",
      "1080p"
    ],
    "parameters": [
      {
        "name": "mode",
        "label": "Mode",
        "type": "string",
        "description": "Marketing video mode slug — the creative format/style. Use a previously selected mode slug or a slug from a currently available catalog confirmed compatible with this model. Do not substitute a preset id from another workflow. Choose deliberately; omit only when the user explicitly wants a generic video.",
        "inlinePill": true
      },
      {
        "name": "width",
        "label": "Width",
        "type": "number",
        "description": "Optional explicit output width"
      },
      {
        "name": "height",
        "label": "Height",
        "type": "number",
        "description": "Optional explicit output height"
      }
    ],
    "supportsReferences": true,
    "maxReferences": 4,
    "supportsAudio": true,
    "defaultAspect": "16:9",
    "defaultResolution": "720p",
    "defaultDurationSec": 5
  },
  {
    "id": "marketing_studio_v2_reference2video",
    "label": "Marketing Studio Reference Video",
    "modality": "video",
    "providerFamily": "Higgsfield",
    "description": "Recreate a reference video with your own character and product",
    "mediaRoles": [
      "input_video",
      "character_image",
      "product_image"
    ],
    "supportsReferences": true,
    "maxReferences": 4,
    "supportsAudio": false,
    "defaultAspect": "16:9",
    "defaultDurationSec": 5
  },
  {
    "id": "marketing_studio_v2_video",
    "label": "Marketing Studio Video",
    "modality": "video",
    "providerFamily": "Higgsfield",
    "description": "Marketing Studio V2 motion and UGC product videos, and the Product Link, Ad Reference and App video tools",
    "mediaRoles": [
      "input_images",
      "product_photo",
      "character_photo",
      "location_photo",
      "avatars"
    ],
    "aspectRatios": [
      "auto",
      "21:9",
      "16:9",
      "4:3",
      "1:1",
      "3:4",
      "9:16"
    ],
    "resolutions": [
      "480p",
      "720p",
      "1080p"
    ],
    "durationsSec": [
      4,
      5,
      6,
      8,
      10,
      12,
      15,
      20,
      30
    ],
    "parameters": [
      {
        "name": "type",
        "label": "Type",
        "type": "enum",
        "options": [
          "2d_motion",
          "hypermotion",
          "mixed_media",
          "saas_motion",
          "ugc",
          "video_mode",
          "ugc_v2",
          "product_link",
          "ad_reference",
          "app_video"
        ],
        "required": true,
        "description": "Video format to generate.",
        "inlinePill": true
      },
      {
        "name": "include_reference_video",
        "label": "Include Ref Video",
        "type": "boolean",
        "default": false,
        "description": "Only for type=ad_reference: also send the reference ad (2-30 s, from an upload or a generation) to the video model."
      },
      {
        "name": "device",
        "label": "Device",
        "type": "string",
        "description": "Only for type=app_video: which screenshots to use."
      }
    ],
    "supportsReferences": true,
    "maxReferences": 9,
    "supportsAudio": true,
    "defaultAspect": "16:9",
    "defaultDurationSec": 4
  },
  {
    "id": "reframe",
    "label": "Reframe",
    "modality": "video",
    "providerFamily": "Tools & Upscale",
    "supportsStartEndFrames": true,
    "mediaRoles": [
      "video_references",
      "start_image",
      "image_references"
    ],
    "aspectRatios": [
      "21:9",
      "16:9",
      "4:3",
      "1:1",
      "3:4",
      "9:16"
    ],
    "resolutions": [
      "480p",
      "720p",
      "1080p"
    ],
    "durationsSec": [
      5,
      8,
      10,
      15
    ],
    "supportsReferences": true,
    "maxReferences": 2,
    "supportsAudio": false,
    "defaultAspect": "16:9",
    "defaultResolution": "720p",
    "defaultDurationSec": 5
  },
  {
    "id": "sam_3_video",
    "label": "Remove Background",
    "modality": "video",
    "providerFamily": "Tools & Upscale",
    "mediaRoles": [
      "video_references"
    ],
    "parameters": [
      {
        "name": "apply_mask",
        "label": "Apply Mask",
        "type": "boolean",
        "default": true,
        "description": "Apply the segmentation mask to the output video."
      },
      {
        "name": "frames_count",
        "label": "Frames Count",
        "type": "number",
        "min": 1,
        "description": "Number of frames to process. Defaults to the full clip when omitted. Whole number."
      }
    ],
    "supportsReferences": true,
    "maxReferences": 4,
    "supportsAudio": false,
    "defaultAspect": "16:9",
    "defaultDurationSec": 5
  },
  {
    "id": "sync_so",
    "label": "Sync Lipsync 3",
    "modality": "video",
    "providerFamily": "Tools & Upscale",
    "mediaRoles": [
      "input_video",
      "input_audio"
    ],
    "parameters": [
      {
        "name": "sync_mode",
        "label": "Lip-Sync Mode",
        "type": "enum",
        "options": [
          "bounce",
          "loop",
          "cut_off",
          "silence",
          "remap"
        ],
        "default": "bounce",
        "description": "How to reconcile a duration mismatch between the video and the audio: 'bounce' ping-pongs the video, 'loop' repeats it, 'cut_off' truncates to the shorter input, 'silence' pads the audio, 'remap' retimes the video."
      }
    ],
    "supportsReferences": true,
    "maxReferences": 4,
    "supportsAudio": false,
    "defaultAspect": "16:9",
    "defaultDurationSec": 5
  },
  {
    "id": "topaz_hyperion_2_5",
    "label": "Topaz Hyperion 2.5",
    "modality": "video",
    "providerFamily": "Tools & Upscale",
    "description": "Convert SDR video to HDR while preserving the source dimensions and frame rate.",
    "mediaRoles": [
      "video_references"
    ],
    "parameters": [
      {
        "name": "output_format",
        "label": "Format",
        "type": "enum",
        "options": [
          "h265",
          "prores",
          "exr"
        ],
        "default": "prores",
        "description": "HDR output format. ProRes is returned as MOV; EXR as a ZIP archive."
      }
    ],
    "supportsReferences": true,
    "maxReferences": 1,
    "supportsAudio": false,
    "defaultAspect": "16:9",
    "defaultDurationSec": 5
  },
  {
    "id": "topaz_video",
    "label": "Topaz Video Upscale",
    "modality": "video",
    "providerFamily": "Tools & Upscale",
    "mediaRoles": [
      "video_references"
    ],
    "aspectRatios": [
      "auto",
      "21:9",
      "16:9",
      "4:3",
      "1:1",
      "3:4",
      "9:16"
    ],
    "resolutions": [
      "1080p",
      "2160p"
    ],
    "parameters": [
      {
        "name": "enhancement",
        "label": "Enhancement",
        "type": "string",
        "description": "Enhancement settings (omit to use Topaz defaults)."
      },
      {
        "name": "frame_interpolation",
        "label": "Frame Interpolation",
        "type": "string",
        "description": "Frame interpolation (omit to disable)."
      }
    ],
    "supportsReferences": true,
    "maxReferences": 1,
    "supportsAudio": false,
    "defaultAspect": "16:9",
    "defaultResolution": "1080p",
    "defaultDurationSec": 5
  },
  {
    "id": "video_background_remover",
    "label": "Video Background Remover",
    "modality": "video",
    "providerFamily": "Tools & Upscale",
    "mediaRoles": [
      "video_references"
    ],
    "supportsReferences": true,
    "maxReferences": 4,
    "supportsAudio": false,
    "defaultAspect": "16:9",
    "defaultDurationSec": 5
  },
  {
    "id": "video_deflicker",
    "label": "Video Deflicker",
    "modality": "video",
    "providerFamily": "Tools & Upscale",
    "mediaRoles": [
      "input_video"
    ],
    "durationsSec": [
      2,
      3,
      4,
      5,
      6,
      8,
      10,
      12,
      15
    ],
    "supportsReferences": true,
    "maxReferences": 4,
    "supportsAudio": false,
    "defaultAspect": "16:9",
    "defaultDurationSec": 2
  },
  {
    "id": "dubbing",
    "label": "Video Dubbing",
    "modality": "video",
    "providerFamily": "Tools & Upscale",
    "mediaRoles": [
      "input_video"
    ],
    "parameters": [
      {
        "name": "target_language",
        "label": "Target Language",
        "type": "enum",
        "options": [
          "eng",
          "cmn",
          "fra",
          "hin",
          "ita",
          "jpn",
          "kor",
          "por",
          "rus",
          "tur",
          "spa",
          "deu",
          "ara",
          "pol",
          "ind",
          "fil",
          "swe",
          "fin"
        ],
        "required": true,
        "description": "Language to dub the video into."
      }
    ],
    "supportsReferences": true,
    "maxReferences": 4,
    "supportsAudio": false,
    "defaultAspect": "16:9",
    "defaultDurationSec": 5
  },
  {
    "id": "video_upscale",
    "label": "Video Upscale",
    "modality": "video",
    "providerFamily": "Tools & Upscale",
    "mediaRoles": [
      "input_video"
    ],
    "durationsSec": [
      2,
      3,
      4,
      5,
      6,
      8,
      10,
      12,
      15
    ],
    "supportsReferences": true,
    "maxReferences": 4,
    "supportsAudio": false,
    "defaultAspect": "16:9",
    "defaultDurationSec": 2
  },
  {
    "id": "voice_change",
    "label": "Voice Change (Video)",
    "modality": "video",
    "providerFamily": "Tools & Upscale",
    "mediaRoles": [
      "input_video"
    ],
    "parameters": [
      {
        "name": "voice_id",
        "label": "Voice Id",
        "type": "string",
        "required": true,
        "description": "Identifier of the target voice — a preset voice id or a voice element id, depending on voice_type."
      },
      {
        "name": "voice_type",
        "label": "Voice Type",
        "type": "enum",
        "options": [
          "preset",
          "element"
        ],
        "default": "preset",
        "description": "How to interpret voice_id: 'preset' for a built-in voice, 'element' for a user-created voice element."
      }
    ],
    "supportsReferences": true,
    "maxReferences": 4,
    "supportsAudio": false,
    "defaultAspect": "16:9",
    "defaultDurationSec": 5
  },
  {
    "id": "elevenlabs_v4",
    "label": "Eleven v4",
    "modality": "audio",
    "providerFamily": "ElevenLabs",
    "description": "Eleven v4 speech generation with up to 10 preset or reference-element voices. Dialogue text is limited to 10,000 characters in total.",
    "parameters": [
      {
        "name": "stability",
        "label": "Stability",
        "type": "number",
        "min": 0,
        "max": 1,
        "description": "Voice stability; omit to use the provider default."
      },
      {
        "name": "similarity_boost",
        "label": "Similarity",
        "type": "number",
        "min": 0,
        "max": 1,
        "description": "Voice similarity; omit to use the provider default."
      }
    ],
    "supportsReferences": false,
    "supportsAudio": true,
    "defaultDurationSec": 8
  },
  {
    "id": "elevenlabs_v4_turbo",
    "label": "Eleven v4 Turbo",
    "modality": "audio",
    "providerFamily": "ElevenLabs",
    "description": "Eleven v4 Turbo speech generation with one preset or reference-element voice. All dialogue turns must use the same voice; text is limited to 10,000 characters in total.",
    "parameters": [
      {
        "name": "stability",
        "label": "Stability",
        "type": "number",
        "min": 0,
        "max": 1,
        "description": "Voice stability; omit to use the provider default."
      },
      {
        "name": "similarity_boost",
        "label": "Similarity",
        "type": "number",
        "min": 0,
        "max": 1,
        "description": "Voice similarity; omit to use the provider default."
      }
    ],
    "supportsReferences": false,
    "supportsAudio": true,
    "defaultDurationSec": 8
  },
  {
    "id": "elevenlabs_music_v2_5",
    "label": "ElevenLabs Music v2.5",
    "modality": "audio",
    "providerFamily": "ElevenLabs",
    "description": "Music generation from a prompt or custom lyrics, with required duration and up to four variations. Custom lyrics support up to 120 seconds.",
    "durationsSec": [
      3,
      4,
      5,
      6,
      8,
      10,
      12,
      15,
      20,
      30
    ],
    "parameters": [
      {
        "name": "force_instrumental",
        "label": "Instrumental",
        "type": "boolean",
        "default": false,
        "description": "Generate without vocals."
      },
      {
        "name": "lyrics",
        "label": "Lyrics",
        "type": "string",
        "description": "Custom lyrics; omit for prompt mode."
      }
    ],
    "supportsReferences": false,
    "supportsAudio": true,
    "defaultDurationSec": 3
  },
  {
    "id": "elevenlabs_music_v2",
    "label": "ElevenLabs Music v2",
    "modality": "audio",
    "providerFamily": "ElevenLabs",
    "description": "Music generation from a prompt or custom lyrics, with required duration and up to four variations. Custom lyrics support up to 120 seconds.",
    "durationsSec": [
      3,
      4,
      5,
      6,
      8,
      10,
      12,
      15,
      20,
      30
    ],
    "parameters": [
      {
        "name": "force_instrumental",
        "label": "Instrumental",
        "type": "boolean",
        "default": false,
        "description": "Generate without vocals."
      },
      {
        "name": "lyrics",
        "label": "Lyrics",
        "type": "string",
        "description": "Custom lyrics; omit for prompt mode."
      }
    ],
    "supportsReferences": false,
    "supportsAudio": true,
    "defaultDurationSec": 3
  },
  {
    "id": "seed_audio",
    "label": "Seed Audio 1.0",
    "modality": "audio",
    "providerFamily": "ByteDance",
    "description": "Unlimited on Ultimate · Seed Audio 1.0 — text-to-audio synthesis with optional voice/audio reference or a single image reference.",
    "supportsUnlim": true,
    "mediaRoles": [
      "image_references",
      "audio_references"
    ],
    "parameters": [
      {
        "name": "format",
        "label": "Format",
        "type": "enum",
        "options": [
          "wav",
          "mp3",
          "pcm",
          "ogg_opus"
        ],
        "default": "wav",
        "description": "Output audio container format."
      },
      {
        "name": "sample_rate",
        "label": "Sample Rate",
        "type": "enum",
        "options": [
          8000,
          16000,
          24000,
          32000,
          44100,
          48000
        ],
        "default": 24000,
        "description": "Output sample rate in Hz."
      },
      {
        "name": "speech_rate",
        "label": "Speech Rate",
        "type": "number",
        "default": 0,
        "min": -50,
        "max": 100,
        "description": "Speech speed adjustment. 0 keeps the default speed; positive values are faster. Whole number."
      },
      {
        "name": "loudness_rate",
        "label": "Loudness",
        "type": "number",
        "default": 0,
        "min": -50,
        "max": 100,
        "description": "Loudness adjustment. 0 keeps the default loudness. Whole number."
      },
      {
        "name": "pitch_rate",
        "label": "Pitch",
        "type": "number",
        "default": 0,
        "min": -12,
        "max": 12,
        "description": "Pitch adjustment in provider units. 0 keeps the default pitch. Whole number."
      },
      {
        "name": "voice_type",
        "label": "Voice Type",
        "type": "enum",
        "options": [
          "preset",
          "element"
        ],
        "description": "Optional voice source: 'preset' for a built-in voice id, or 'element' for a workspace voice reference element. Must be sent together with voice_id."
      },
      {
        "name": "voice_id",
        "label": "Voice Id",
        "type": "string",
        "description": "Voice id: a preset voice id when voice_type='preset', or a voice reference element id when voice_type='element'. Must be sent together with voice_type."
      },
      {
        "name": "use_unlim",
        "label": "Billing Mode",
        "type": "enum",
        "options": [
          "auto",
          "unlimited",
          "credits"
        ],
        "default": "auto",
        "description": "Auto uses Ultimate unlimited for 1x and credits for multi-batch, or force queue mode."
      }
    ],
    "supportsReferences": true,
    "maxReferences": 1,
    "supportsAudio": true,
    "defaultDurationSec": 8
  },
  {
    "id": "text2speech_v2",
    "label": "Higgsfield TTS v2",
    "modality": "audio",
    "providerFamily": "Higgsfield",
    "description": "Unlimited on Ultimate · Text-to-speech with a selectable engine (ElevenLabs, MiniMax, Seed Speech, Vibe Voice, Cozy Voice) via the variant param; preset or reference-element voices (voice_type + voice_id).",
    "supportsUnlim": true,
    "parameters": [
      {
        "name": "variant",
        "label": "Variant",
        "type": "enum",
        "options": [
          "elevenlabs",
          "minimax",
          "seed_speech",
          "vibe_voice",
          "cozy_voice"
        ],
        "required": true,
        "description": "Text-to-speech engine.",
        "inlinePill": true
      },
      {
        "name": "voice_type",
        "label": "Voice Type",
        "type": "enum",
        "options": [
          "preset",
          "element"
        ],
        "required": true,
        "description": "Whether voice_id is a built-in preset voice ('preset') or a workspace reference element ('element')."
      },
      {
        "name": "voice_id",
        "label": "Voice Id",
        "type": "string",
        "required": true,
        "description": "Voice id: a preset voice id when voice_type='preset', or a reference element id when voice_type='element'."
      },
      {
        "name": "use_unlim",
        "label": "Billing Mode",
        "type": "enum",
        "options": [
          "auto",
          "unlimited",
          "credits"
        ],
        "default": "auto",
        "description": "Auto uses Ultimate unlimited for 1x and credits for multi-batch, or force queue mode."
      }
    ],
    "supportsReferences": false,
    "supportsAudio": true,
    "defaultDurationSec": 8
  },
  {
    "id": "qwen_audio_tts",
    "label": "Qwen Audio 3.0 TTS Flash",
    "modality": "audio",
    "providerFamily": "Alibaba Cloud",
    "description": "Qwen Audio 3.0 TTS Flash with expressive instructions and a selectable system preset or cloned reference-element voice.",
    "parameters": [
      {
        "name": "voice_type",
        "label": "Voice Type",
        "type": "enum",
        "options": [
          "preset",
          "element"
        ],
        "required": true,
        "description": "Use 'preset' for a system voice or 'element' for a cloned voice."
      },
      {
        "name": "voice_id",
        "label": "Voice Id",
        "type": "string",
        "required": true,
        "description": "Preset or reference-element voice ID. At least 1 character."
      },
      {
        "name": "instruction",
        "label": "Instruction",
        "type": "string",
        "description": "Natural-language direction for emotion, dialect, speed, or style. At most 128 characters."
      },
      {
        "name": "language",
        "label": "Language",
        "type": "enum",
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
        "description": "Optional target-language hint."
      },
      {
        "name": "format",
        "label": "Format",
        "type": "enum",
        "options": [
          "wav",
          "mp3",
          "pcm",
          "ogg_opus"
        ],
        "default": "mp3",
        "description": "Output audio container format."
      },
      {
        "name": "sample_rate",
        "label": "Sample Rate",
        "type": "enum",
        "options": [
          8000,
          16000,
          22050,
          24000,
          44100,
          48000
        ],
        "default": 24000,
        "description": "Output sample rate in Hz."
      },
      {
        "name": "volume",
        "label": "Volume",
        "type": "number",
        "default": 50,
        "min": 0,
        "max": 100,
        "description": "Whole number."
      },
      {
        "name": "speech_rate",
        "label": "Speech Rate",
        "type": "number",
        "default": 1,
        "min": 0.5,
        "max": 2
      },
      {
        "name": "pitch_rate",
        "label": "Pitch",
        "type": "number",
        "default": 1,
        "min": 0.5,
        "max": 2
      }
    ],
    "supportsReferences": false,
    "supportsAudio": true,
    "defaultDurationSec": 8
  },
  {
    "id": "inworld_text_to_speech",
    "label": "Inworld Text to Speech",
    "modality": "audio",
    "providerFamily": "Audio & Music",
    "description": "Text-to-speech audio generation. Game pipeline only.",
    "parameters": [
      {
        "name": "voice",
        "label": "Voice",
        "type": "enum",
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
        ],
        "required": true,
        "description": "Voice to use for text-to-speech synthesis (language tag in parentheses)."
      }
    ],
    "supportsReferences": false,
    "supportsAudio": true,
    "defaultDurationSec": 8
  },
  {
    "id": "sonilo_music",
    "label": "Sonilo Music",
    "modality": "audio",
    "providerFamily": "Audio & Music",
    "description": "Text-to-music generation with controllable duration. Game pipeline only.",
    "durationsSec": [
      5,
      8,
      10,
      15,
      30
    ],
    "supportsReferences": false,
    "supportsAudio": true,
    "defaultDurationSec": 5
  },
  {
    "id": "mirelo_text_to_audio",
    "label": "Mirelo Text to Audio",
    "modality": "audio",
    "providerFamily": "Audio & Music",
    "description": "Text-to-audio sound effect generation with controllable duration. Game pipeline only.",
    "durationsSec": [
      5,
      8,
      10,
      15,
      30
    ],
    "supportsReferences": false,
    "supportsAudio": true,
    "defaultDurationSec": 5
  },
  {
    "id": "audio_dubbing",
    "label": "Audio Dubbing",
    "modality": "audio",
    "providerFamily": "ElevenLabs",
    "description": "Dub one audio into a target language and return WAV. Optionally provide a source transcript and verbatim translations keyed by segment external_id (ElevenLabs Enterprise).",
    "parameters": [
      {
        "name": "target_language",
        "label": "Target Language",
        "type": "string",
        "required": true,
        "description": "Target BCP-47 language tag, e.g. fr or pt-BR. At most 35 characters."
      },
      {
        "name": "source_language",
        "label": "Source Language",
        "type": "string",
        "description": "Source BCP-47 language tag. Required with a custom transcript. At most 35 characters."
      },
      {
        "name": "transcript",
        "label": "Transcript",
        "type": "string",
        "description": "Timed transcript; requires translations and ElevenLabs Enterprise."
      },
      {
        "name": "translations",
        "label": "Translations",
        "type": "string",
        "description": "Verbatim target text keyed by every source segment external_id."
      }
    ],
    "supportsReferences": false,
    "supportsAudio": true,
    "defaultDurationSec": 8
  }
];
