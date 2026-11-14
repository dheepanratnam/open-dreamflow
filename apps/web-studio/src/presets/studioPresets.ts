import type {
  CanvasEdge,
  CanvasNode,
  DreaminaSkill,
  ElementVault,
  FrameLayer,
  MultiframeBridge,
  MultiframeCard,
  StudioPresetId,
  TimelineClip,
} from '../types/studio';

export interface MediaCatalogItem {
  id: string;
  title: string;
  kind: 'image' | 'video' | 'contact-sheet' | 'element' | 'audio';
  url: string;
  posterUrl?: string;
  durationSec?: number;
  resolution: string;
}

export interface StudioPresetDescriptor {
  id: StudioPresetId;
  title: string;
  subtitle: string;
  thumbnailUrl?: string;
  badge: string;
}

export const STUDIO_PRESETS: StudioPresetDescriptor[] = [
  {
    id: 'blank',
    title: 'Blank Canvas',
    subtitle: 'Clean spatial workflow canvas',
    badge: 'NEW',
  },
];

export const MEDIA_ASSET_CATALOG: MediaCatalogItem[] = [];

export function createDefaultLayers(baseDataUrl?: string): FrameLayer[] {
  return [
    {
      id: 'fg',
      name: 'Foreground Subject',
      visible: true,
      opacity: 100,
      dataUrl: baseDataUrl,
      bgRemoved: false,
    },
    {
      id: 'bg',
      name: 'Background',
      visible: true,
      opacity: 100,
    },
    {
      id: 'mask',
      name: 'Inpaint Mask',
      visible: true,
      opacity: 100,
    },
    {
      id: 'text',
      name: 'Text Overlay',
      visible: false,
      opacity: 100,
      textContent: '',
    },
  ];
}

export const BUILTIN_SKILLS: DreaminaSkill[] = [
  {
    id: 'skill-9-grid',
    slash: '/9-Grid Storyboard',
    title: '9-Grid Location Contact Sheet',
    category: 'Storyboard',
    badge: '3×3 SLICER',
    description:
      'Synthesizes a 3×3 35mm documentary contact sheet and slices all 9 camera framings into linked frames.',
    promptTemplate:
      '9-panel 35mm architectural courtyard storyboard contact sheet, warm daylight, coherent framing across all 9 cells',
    recommendedMode: '9-grid',
  },
  {
    id: 'skill-4-angle',
    slash: '/4-Angle Coverage',
    title: '4-Angle Prime Lens Coverage',
    category: 'Camera',
    badge: '2×2 MULTI-CAM',
    description:
      'Locks lighting & subject identity across Wide 24mm, Normal 35mm, Portrait 50mm, and Macro 85mm.',
    promptTemplate:
      'Multi-camera 4-angle natural daylight coverage across 24mm wide, 35mm medium, 50mm close-up, and 85mm detail shot',
    recommendedMode: '4-angle',
  },
  {
    id: 'skill-long-take',
    slash: '/Cinematic Long Take',
    title: '15s Omni 1.2 Flash Long Take',
    category: 'Camera',
    badge: '15S OMNI 1.2',
    description:
      'Unbroken 15-second Steadicam tracking shot with organic environmental foley and context lock.',
    promptTemplate:
      'Unbroken 15s Steadicam tracking shot moving smoothly through a sunlit stone colonnade toward open coastal horizon, 24fps',
    recommendedMode: 'video',
    durationSec: 15,
  },
  {
    id: 'skill-aerial-glide',
    slash: '/Coastal Aerial Glide',
    title: 'Architectural Aerial One-Shot',
    category: 'Camera',
    badge: 'AERIAL 24MM',
    description:
      'Measured architectural camera glide rising above roofline geometry at golden hour.',
    promptTemplate:
      'Smooth 24mm crane-to-aerial glide rising above architectural stone roofline at late afternoon golden hour, 24fps',
    recommendedMode: 'video',
    durationSec: 10,
  },
  {
    id: 'skill-craft-spot',
    slash: '/Craft Tabletop Study',
    title: 'Tactile Studio Craft Spot',
    category: 'Commercial',
    badge: 'MACRO 85MM',
    description:
      'Tactile tabletop product study with crisp directional north window lighting.',
    promptTemplate:
      'Tactile 85mm macro tabletop reveal resting on raw travertine and linen desk with warm north-facing window daylight',
    recommendedMode: 'video',
    durationSec: 6,
  },
  {
    id: 'skill-golden-remix',
    slash: '/Multi-Turn Golden Hour',
    title: 'Multi-Turn Daylight Shift',
    category: 'Omni Multi-Turn',
    badge: 'INTERACTION_ID',
    description:
      'Branches selected video via previous_interaction_id to shift midday sun into warm dusk while keeping camera motion locked.',
    promptTemplate:
      'Keep camera blocking identical; shift midday sun to warm late-afternoon amber dusk with long architectural shadows',
    recommendedMode: 'multi-turn',
    durationSec: 6,
  },
];

export function buildInitialElements(): ElementVault[] {
  return [];
}

export function buildBlankStudioGraph(): {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  multiframes: MultiframeCard[];
  bridges: MultiframeBridge[];
  timelineClips: TimelineClip[];
} {
  return {
    nodes: [],
    edges: [],
    multiframes: [],
    bridges: [],
    timelineClips: [],
  };
}

export function buildStudioPresetGraph(_preset: StudioPresetId): {
  title: string;
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  multiframes: MultiframeCard[];
  bridges: MultiframeBridge[];
  timelineClips: TimelineClip[];
} {
  return {
    title: 'Untitled Canvas',
    ...buildBlankStudioGraph(),
  };
}

export function buildInitialStudioGraph(): {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  multiframes: MultiframeCard[];
  bridges: MultiframeBridge[];
  timelineClips: TimelineClip[];
} {
  return buildBlankStudioGraph();
}
