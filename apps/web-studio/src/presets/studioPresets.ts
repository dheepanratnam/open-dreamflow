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
import {
  NINE_GRID_LABELS,
  createDefaultWaveform,
  extractStyleDnaFromPrompt,
} from '../utils/proceduralMedia';

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
    title: 'New Blank Canvas',
    subtitle: '100% clean workspace — zero demo tags, zero pre-filled media',
    badge: 'CLEAN',
  },
  {
    id: 'cross-platform-blueprint',
    title: 'Workflow Blueprint: Higgsfield → Kling 4.0 → ElevenLabs',
    subtitle: 'Shareable zero-markup chain: ChatGPT Image 2.6 → Kling 4.0 I2V + ElevenLabs VO',
    badge: 'BLUEPRINT',
  },
  {
    id: 'salt-terracotta',
    title: 'Salt & Terracotta — Coastal Short (Demo)',
    subtitle: '35mm Kodak 250D · Natural Daylight + Reference + A1 Audio',
    thumbnailUrl: '/media/real_courtyard_sun.jpg',
    badge: 'DEMO',
  },
  {
    id: 'kyoto-joinery',
    title: 'Kyoto Joinery — Craft Study (Demo)',
    subtitle: '50mm Leica Summilux · Cedar Atelier Documentary',
    thumbnailUrl: '/media/real_kyoto_timber.jpg',
    badge: 'CRAFT',
  },
  {
    id: 'alpine-pass',
    title: 'Alpine Pass — Architectural Monograph (Demo)',
    subtitle: '24mm Wide Prime · Morning Mist & Timber Monograph',
    thumbnailUrl: '/media/real_alpine_road.jpg',
    badge: 'MONOGRAPH',
  },
];

export const MEDIA_ASSET_CATALOG: MediaCatalogItem[] = [
  {
    id: 'asset-shot01-vid',
    title: 'Shot 01 · Limestone Courtyard',
    kind: 'video',
    url: '/media/real_shot01_courtyard.mp4',
    posterUrl: '/media/real_courtyard_sun.jpg',
    durationSec: 6,
    resolution: '1280×720',
  },
  {
    id: 'asset-shot02-bridge',
    title: 'Shot 02 · Courtyard → Cliffs Bridge',
    kind: 'video',
    url: '/media/real_shot02_bridge.mp4',
    posterUrl: '/media/real_coastal_cliffs.jpg',
    durationSec: 6,
    resolution: '1280×720',
  },
  {
    id: 'asset-shot03-atelier',
    title: 'Shot 03 · Sunlit Atelier',
    kind: 'video',
    url: '/media/real_shot03_atelier.mp4',
    posterUrl: '/media/real_atelier_interior.jpg',
    durationSec: 6,
    resolution: '1280×720',
  },
  {
    id: 'asset-master-vid',
    title: 'Salt & Terracotta Master Cut',
    kind: 'video',
    url: '/media/real_salt_terracotta_master.mp4',
    posterUrl: '/media/real_courtyard_sun.jpg',
    durationSec: 18,
    resolution: '1280×720',
  },
  {
    id: 'asset-clara-el',
    title: '@Clara_Vidal Portrait Lock',
    kind: 'element',
    url: '/media/real_portrait_clara.jpg',
    resolution: '1280×720',
  },
  {
    id: 'asset-leica-el',
    title: '@Leica_M6 Craft Study',
    kind: 'element',
    url: '/media/real_leica_craft.jpg',
    resolution: '1280×720',
  },
  {
    id: 'asset-courtyard-img',
    title: 'Location · Limestone Courtyard',
    kind: 'image',
    url: '/media/real_courtyard_sun.jpg',
    resolution: '1280×720',
  },
  {
    id: 'asset-cliffs-img',
    title: 'Location · Atlantic Cliffs',
    kind: 'image',
    url: '/media/real_coastal_cliffs.jpg',
    resolution: '1280×720',
  },
  {
    id: 'asset-kyoto-img',
    title: 'Location · Kyoto Cedar Timber',
    kind: 'image',
    url: '/media/real_kyoto_timber.jpg',
    resolution: '1280×720',
  },
  {
    id: 'asset-alpine-img',
    title: 'Location · Alpine Mountain Pass',
    kind: 'image',
    url: '/media/real_alpine_road.jpg',
    resolution: '1280×720',
  },
  {
    id: 'asset-9grid',
    title: '35mm Location Contact Sheet',
    kind: 'contact-sheet',
    url: '/media/real_contact_9grid.jpg',
    resolution: '1920×1080',
  },
  {
    id: 'asset-coastal-audio',
    title: 'Audio · Coastal Wind & Surf',
    kind: 'audio',
    url: '/media/real_coastal_foley.mp3',
    durationSec: 12,
    resolution: 'Stereo MP3',
  },
];

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
      textContent: 'SALT & TERRACOTTA',
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
      '@Clara_Vidal walking across sunlit Mediterranean limestone courtyard at @Limestone_Villa holding @Leica_M6, 9-panel Kodak 250D contact sheet',
    recommendedMode: '9-grid',
  },
  {
    id: 'skill-4-angle',
    slash: '/4-Angle Coverage',
    title: '4-Angle Prime Lens Coverage',
    category: 'Camera',
    badge: '2×2 MULTI-CAM',
    description:
      'Locks natural daylight & @Elements across Wide 24mm, Normal 35mm, Portrait 50mm, and Macro 85mm.',
    promptTemplate:
      'Multi-camera 4-angle natural daylight coverage of @Clara_Vidal adjusting @Leica_M6 aperture ring in @Limestone_Villa courtyard, Kodak 250D',
    recommendedMode: '4-angle',
  },
  {
    id: 'skill-long-take',
    slash: '/Cinematic Long Take',
    title: '15s Omni 1.2 Flash Long Take',
    category: 'Camera',
    badge: '15S OMNI 1.2',
    description:
      'Unbroken 15-second Steadicam tracking shot with organic environmental foley and 10s context lock.',
    promptTemplate:
      'Unbroken 15s Steadicam tracking shot following @Clara_Vidal from shaded olive colonnade out toward sunlit Atlantic limestone cliffs, natural 35mm film grain',
    recommendedMode: 'video',
    durationSec: 15,
  },
  {
    id: 'skill-aerial-glide',
    slash: '/Coastal Aerial Glide',
    title: 'Architectural Coastal One-Shot',
    category: 'Camera',
    badge: 'AERIAL 24MM',
    description:
      'Measured architectural camera glide rising from terraced stone walls out over coastal surf.',
    promptTemplate:
      'Smooth 24mm crane-to-aerial glide rising above @Limestone_Villa terracotta roofline revealing Atlantic headland surf at late afternoon golden hour, 24fps',
    recommendedMode: 'video',
    durationSec: 10,
  },
  {
    id: 'skill-craft-spot',
    slash: '/Craft Tabletop Study',
    title: 'Tactile Industrial Craft Spot',
    category: 'Commercial',
    badge: 'MACRO 85MM',
    description:
      'Tactile tabletop study with locked @Leica_M6 brass patina and directional window light.',
    promptTemplate:
      'Tactile 85mm macro tabletop reveal of @Leica_M6 resting on raw travertine and linen field notebook, warm north-facing window daylight',
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
      'Keep @Clara_Vidal camera blocking identical; shift midday courtyard sun to warm late-afternoon amber dusk with long olive tree shadows',
    recommendedMode: 'multi-turn',
    durationSec: 6,
  },
];

export function buildInitialElements(): ElementVault[] {
  return [
    {
      id: 'el-clara-vidal',
      handle: '@Clara_Vidal',
      name: 'Clara Vidal (Architect & Photographer)',
      category: 'character',
      description:
        'Natural linen overshirt, field notebook, locked facial & wardrobe continuity across 35mm daylight shots.',
      accentColor: '#20D5EC',
      voiceProfile: 'Warm Alto · Documentary Field VO',
      references: [
        { id: 'clara_ref_1', label: '35mm Natural Portrait', dataUrl: '/media/real_portrait_clara.jpg' },
        { id: 'clara_ref_2', label: 'Limestone Courtyard', dataUrl: '/media/real_courtyard_sun.jpg' },
        { id: 'clara_ref_3', label: 'Sunlit Atelier', dataUrl: '/media/real_atelier_interior.jpg' },
        { id: 'clara_ref_4', label: 'Atlantic Headland', dataUrl: '/media/real_coastal_cliffs.jpg' },
        { id: 'clara_ref_5', label: '35mm Contact Sheet', dataUrl: '/media/real_contact_9grid.jpg' },
        { id: 'clara_ref_6', label: 'Field Camera Craft', dataUrl: '/media/real_leica_craft.jpg' },
      ],
    },
    {
      id: 'el-leica-m6',
      handle: '@Leica_M6',
      name: 'Leica M6 Brass Rangefinder',
      category: 'product',
      description:
        'Black-paint brass 35mm rangefinder camera with 35mm Summicron prime (6-reference craft continuity lock).',
      accentColor: '#d4d4d8',
      references: [
        { id: 'leica_ref_1', label: 'Rangefinder Macro', dataUrl: '/media/real_leica_craft.jpg' },
        { id: 'leica_ref_2', label: 'Atelier Worktable', dataUrl: '/media/real_atelier_interior.jpg' },
        { id: 'leica_ref_3', label: 'Courtyard Bench', dataUrl: '/media/real_courtyard_sun.jpg' },
        { id: 'leica_ref_4', label: 'Kyoto Cedar Desk', dataUrl: '/media/real_kyoto_timber.jpg' },
        { id: 'leica_ref_5', label: '9-Frame Sheet', dataUrl: '/media/real_contact_9grid.jpg' },
        { id: 'leica_ref_6', label: 'Portrait Strap', dataUrl: '/media/real_portrait_clara.jpg' },
      ],
    },
    {
      id: 'el-limestone-villa',
      handle: '@Limestone_Villa',
      handleAliases: ['@Limestone_Villa'],
      name: 'Mediterranean Limestone Villa · Kodak 250D',
      category: 'style',
      description:
        'Cooke S4/i 35mm T2.0 natural daylight, warm travertine & terracotta bounce, Kodak Vision3 250D.',
      accentColor: '#c87d55',
      references: [
        { id: 'villa_ref_1', label: 'Courtyard Colonnade', dataUrl: '/media/real_courtyard_sun.jpg' },
        { id: 'villa_ref_2', label: 'Coastal Limestone', dataUrl: '/media/real_coastal_cliffs.jpg' },
        { id: 'villa_ref_3', label: 'Atelier Window Light', dataUrl: '/media/real_atelier_interior.jpg' },
        { id: 'villa_ref_4', label: 'Location Contact Sheet', dataUrl: '/media/real_contact_9grid.jpg' },
        { id: 'villa_ref_5', label: 'Timber Joinery', dataUrl: '/media/real_kyoto_timber.jpg' },
        { id: 'villa_ref_6', label: 'Alpine Stone Pass', dataUrl: '/media/real_alpine_road.jpg' },
      ],
    } as ElementVault,
  ];
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

export function buildCrossPlatformBlueprintGraph(): {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  multiframes: MultiframeCard[];
  bridges: MultiframeBridge[];
  timelineClips: TimelineClip[];
} {
  const now = Date.now();
  const baseImageNode: CanvasNode = {
    id: 'node-bp-img-1',
    kind: 'image',
    title: 'Images 1',
    prompt:
      'Natural daylight medium shot of an artisan ceramicist shaping wet terracotta on a stone wheel inside a sunlit Mediterranean workshop, tactile 35mm documentary still',
    x: 120,
    y: 160,
    width: 384,
    height: 216,
    aspectRatio: '16:9',
    status: 'idle',
    platformId: 'higgsfield',
    connectionMode: 'auto',
    modelId: 'gpt_image_2_6',
    batchCount: 1,
    seed: 1042,
    resolution: '2k',
    quality: 'high',
    modelParams: { quality: 'high', output_format: 'png', use_unlim: 'auto' },
    elementHandles: [],
    layers: [],
    providerUsed: 'Higgsfield · ChatGPT / GPT Image 2.6',
    createdAt: now - 3000,
  };

  const klingVideoNode: CanvasNode = {
    id: 'node-bp-vid-1',
    kind: 'video',
    title: 'Videos 1',
    prompt:
      'Slow handheld 35mm push-in as the ceramicist smooths the spinning clay rim, warm dust motes drifting through sunlit window light',
    x: 640,
    y: 140,
    width: 480,
    height: 270,
    aspectRatio: '16:9',
    status: 'idle',
    platformId: 'kling',
    connectionMode: 'auto',
    modelId: 'kling-4.0',
    audioEnabled: true,
    seed: 1084,
    resolution: '1080p',
    durationSec: 5,
    elementHandles: [],
    layers: [],
    providerUsed: 'Kling AI · Kling 4.0',
    createdAt: now - 2000,
  };

  const elevenAudioNode: CanvasNode = {
    id: 'node-bp-aud-1',
    kind: 'audio',
    title: 'Audio 1',
    prompt: 'Every vessel carries the quiet memory of salt, water, and afternoon sun.',
    x: 640,
    y: 470,
    width: 340,
    height: 128,
    aspectRatio: '16:9',
    status: 'idle',
    platformId: 'elevenlabs',
    connectionMode: 'auto',
    modelId: 'eleven_multilingual_v2',
    audioMode: 'tts',
    voiceId: 'JBFqnCBsd6RMkjVDRZzb',
    durationSec: 8,
    seed: 1120,
    resolution: '1080p',
    elementHandles: [],
    layers: [],
    providerUsed: 'ElevenLabs · Multilingual v2',
    createdAt: now - 1000,
  };

  return {
    nodes: [baseImageNode, klingVideoNode, elevenAudioNode],
    edges: [
      {
        id: 'edge-bp-img-to-vid',
        sourceId: baseImageNode.id,
        targetId: klingVideoNode.id,
        kind: 'lineage',
      },
    ],
    multiframes: [],
    bridges: [],
    timelineClips: [],
  };
}

export function buildSaltTerracottaGraph(): {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  multiframes: MultiframeCard[];
  bridges: MultiframeBridge[];
  timelineClips: TimelineClip[];
} {
  const styleDna = extractStyleDnaFromPrompt(
    'Sunlit Mediterranean limestone courtyard 35mm Kodak Vision3 250D @Limestone_Villa'
  );
  const coastalWaveform = createDefaultWaveform(305, 64);

  const elementNode: CanvasNode = {
    id: 'node-element-clara',
    kind: 'element',
    title: 'Elements 1 · @Clara_Vidal',
    prompt:
      '@Clara_Vidal natural daylight portrait + @Leica_M6 rangefinder 6-reference continuity lock',
    x: 80,
    y: 100,
    width: 280,
    height: 280,
    aspectRatio: '1:1',
    status: 'ready',
    imageUrl: '/media/real_portrait_clara.jpg',
    seed: 101,
    resolution: '2K',
    elementHandles: ['@Clara_Vidal', '@Leica_M6'],
    styleDna,
    layers: createDefaultLayers('/media/real_portrait_clara.jpg'),
    providerUsed: 'Element Continuity Vault',
    createdAt: Date.now() - 42000,
  };

  const courtyardImageNode: CanvasNode = {
    id: 'node-shot-courtyard',
    kind: 'image',
    title: 'Images 1 · Limestone Courtyard',
    prompt:
      'Sunlit Mediterranean limestone courtyard at @Limestone_Villa with olive tree shadows on warm terracotta tiles, 35mm Kodak 250D',
    x: 480,
    y: 100,
    width: 340,
    height: 320,
    aspectRatio: '1:1',
    status: 'ready',
    imageUrl: '/media/real_courtyard_sun.jpg',
    seed: 204,
    resolution: '2K',
    interactionId: 'int_omni_a102f9',
    elementHandles: ['@Clara_Vidal', '@Limestone_Villa'],
    layers: createDefaultLayers('/media/real_courtyard_sun.jpg'),
    providerUsed: 'Dreamina Smart Canvas',
    createdAt: Date.now() - 36000,
  };

  const cliffsImageNode: CanvasNode = {
    id: 'node-shot-cliffs',
    kind: 'image',
    title: 'Images 2 · Atlantic Cliffs',
    prompt:
      'Atlantic limestone headland cliffs overlooking turquoise sea swells in crisp afternoon daylight, Cooke 35mm prime',
    x: 480,
    y: 550,
    width: 340,
    height: 320,
    aspectRatio: '1:1',
    status: 'ready',
    imageUrl: '/media/real_coastal_cliffs.jpg',
    seed: 312,
    resolution: '2K',
    interactionId: 'int_omni_b220c4',
    elementHandles: ['@Limestone_Villa'],
    layers: createDefaultLayers('/media/real_coastal_cliffs.jpg'),
    providerUsed: 'Dreamina Smart Canvas',
    createdAt: Date.now() - 32000,
  };

  const shot01VideoNode: CanvasNode = {
    id: 'node-video-shot01',
    kind: 'video',
    title: 'Videos 1 · Shot 01 Courtyard',
    prompt:
      'Measured 35mm dolly-in across sunlit limestone courtyard toward @Clara_Vidal lifting @Leica_M6 in natural breeze',
    x: 940,
    y: 100,
    width: 568,
    height: 320,
    aspectRatio: '16:9',
    status: 'ready',
    imageUrl: '/media/real_courtyard_sun.jpg',
    videoUrl: '/media/real_shot01_courtyard.mp4',
    videoTheme: 'coastal-daylight',
    seed: 408,
    resolution: '1080p',
    durationSec: 6,
    cameraMotion: 'Dolly In',
    interactionId: 'int_omni_408a',
    elementHandles: ['@Clara_Vidal', '@Leica_M6'],
    layers: createDefaultLayers('/media/real_courtyard_sun.jpg'),
    providerUsed: 'Local FFmpeg 8.0 · $0.00',
    createdAt: Date.now() - 26000,
  };

  const shot02BridgeNode: CanvasNode = {
    id: 'node-video-bridge02',
    kind: 'video',
    title: 'Videos 2 · Courtyard → Cliffs Bridge',
    prompt:
      'First-Frame → Last-Frame optical camera glide from sunlit limestone courtyard archway out over Atlantic cliffs',
    x: 1628,
    y: 100,
    width: 568,
    height: 320,
    aspectRatio: '16:9',
    status: 'ready',
    imageUrl: '/media/real_coastal_cliffs.jpg',
    videoUrl: '/media/real_shot02_bridge.mp4',
    videoTheme: 'coastal-daylight',
    bridgeMode: true,
    startImageUrl: '/media/real_courtyard_sun.jpg',
    endImageUrl: '/media/real_coastal_cliffs.jpg',
    startNodeId: courtyardImageNode.id,
    endNodeId: cliffsImageNode.id,
    motionCurve: 'ease-in-out',
    seed: 777,
    resolution: '1080p',
    durationSec: 6,
    cameraMotion: 'Ease In-Out Bridge',
    interactionId: 'int_omni_88c41d',
    previousInteractionId: 'int_omni_408a',
    elementHandles: ['@Clara_Vidal', '@Limestone_Villa'],
    layers: createDefaultLayers('/media/real_coastal_cliffs.jpg'),
    providerUsed: 'Keyframe Bridge · Ease In-Out',
    createdAt: Date.now() - 20000,
  };

  const gridNode: CanvasNode = {
    id: 'node-grid-9',
    kind: 'contact-sheet',
    title: 'Images 3 · 35mm Location Sheet',
    prompt:
      '/9-Grid Storyboard @Clara_Vidal & @Leica_M6 coastal architectural study across 9 natural daylight prime lenses',
    x: 940,
    y: 550,
    width: 480,
    height: 270,
    aspectRatio: '16:9',
    status: 'ready',
    imageUrl: '/media/real_contact_9grid.jpg',
    seed: 512,
    resolution: '4K',
    interactionId: 'int_seedream_9grid',
    elementHandles: ['@Clara_Vidal', '@Leica_M6'],
    gridSpec: { rows: 3, cols: 3, labels: NINE_GRID_LABELS },
    layers: createDefaultLayers('/media/real_contact_9grid.jpg'),
    providerUsed: '35mm Contact Sheet · 9-Grid Slicer',
    createdAt: Date.now() - 16000,
  };

  const audioNode: CanvasNode = {
    id: 'node-audio-coastal',
    kind: 'audio',
    title: 'Audio 1 · Coastal Wind & Surf',
    prompt:
      'Natural Atlantic coastal breeze through olive leaves, distant limestone surf wash, warm open-air room tone',
    x: 1628,
    y: 550,
    width: 360,
    height: 150,
    aspectRatio: '16:9',
    status: 'ready',
    audioUrl: '/media/real_coastal_foley.mp3',
    audioMode: 'ambient',
    waveform: coastalWaveform,
    durationSec: 12,
    seed: 305,
    resolution: '1080p',
    elementHandles: [],
    layers: [],
    providerUsed: 'Acoustic Foley + 64-Bar Waveform',
    createdAt: Date.now() - 12000,
  };

  const timelineNode: CanvasNode = {
    id: 'node-timeline-1',
    kind: 'timeline',
    title: 'Timelines 1',
    prompt: 'Salt & Terracotta — 3-Shot Coastal Sequence (00:18)',
    x: 480,
    y: 1000,
    width: 1120,
    height: 196,
    aspectRatio: '16:9',
    status: 'ready',
    videoUrl: '/media/real_salt_terracotta_master.mp4',
    seed: 999,
    resolution: '1080p',
    durationSec: 18,
    elementHandles: ['@Clara_Vidal', '@Leica_M6'],
    layers: [],
    providerUsed: 'Dreamina Spatial Timeline',
    createdAt: Date.now() - 8000,
  };

  const edges: CanvasEdge[] = [
    {
      id: 'edge-el-img1',
      sourceId: elementNode.id,
      targetId: courtyardImageNode.id,
      kind: 'lineage',
    },
    {
      id: 'edge-el-grid',
      sourceId: elementNode.id,
      targetId: gridNode.id,
      kind: 'lineage',
    },
    {
      id: 'edge-img1-vid1',
      sourceId: courtyardImageNode.id,
      targetId: shot01VideoNode.id,
      kind: 'lineage',
    },
    {
      id: 'edge-img1-bridge',
      sourceId: courtyardImageNode.id,
      targetId: shot02BridgeNode.id,
      kind: 'multiframe',
    },
    {
      id: 'edge-img2-bridge',
      sourceId: cliffsImageNode.id,
      targetId: shot02BridgeNode.id,
      kind: 'multiframe',
    },
    {
      id: 'edge-vid1-timeline',
      sourceId: shot01VideoNode.id,
      targetId: timelineNode.id,
      kind: 'multiframe',
    },
    {
      id: 'edge-audio-timeline',
      sourceId: audioNode.id,
      targetId: timelineNode.id,
      kind: 'lineage',
    },
  ];

  const multiframes: MultiframeCard[] = [
    {
      id: 'mf-1',
      order: 0,
      title: 'KF 01 · Limestone Courtyard',
      prompt: shot01VideoNode.prompt,
      imageUrl: '/media/real_courtyard_sun.jpg',
      videoUrl: '/media/real_shot01_courtyard.mp4',
      sourceNodeId: shot01VideoNode.id,
      aspectRatio: '16:9',
    },
    {
      id: 'mf-2',
      order: 1,
      title: 'KF 02 · Courtyard → Cliffs Bridge',
      prompt: shot02BridgeNode.prompt,
      imageUrl: '/media/real_coastal_cliffs.jpg',
      videoUrl: '/media/real_shot02_bridge.mp4',
      sourceNodeId: shot02BridgeNode.id,
      aspectRatio: '16:9',
    },
    {
      id: 'mf-3',
      order: 2,
      title: 'KF 03 · Sunlit Atelier',
      prompt:
        'Interior north-light architectural atelier table with @Leica_M6, linen contact prints, and warm plaster walls',
      imageUrl: '/media/real_atelier_interior.jpg',
      videoUrl: '/media/real_shot03_atelier.mp4',
      aspectRatio: '16:9',
    },
  ];

  const bridges: MultiframeBridge[] = [
    {
      id: 'bridge-1-2',
      fromCardId: 'mf-1',
      toCardId: 'mf-2',
      durationSec: 6,
      curve: 'Dolly In',
      transitionPrompt:
        'Optical glide from shaded limestone colonnade out toward sunlit Atlantic headland cliffs',
      useTenSecContextWindow: true,
      firstLastKeyframeLock: true,
    },
    {
      id: 'bridge-2-3',
      fromCardId: 'mf-2',
      toCardId: 'mf-3',
      durationSec: 6,
      curve: 'Rack Focus',
      transitionPrompt:
        'Seamless daylight match dissolve from coastal horizon into quiet sunlit architectural atelier',
      useTenSecContextWindow: true,
      firstLastKeyframeLock: true,
    },
  ];

  const timelineClips: TimelineClip[] = [
    {
      id: 'clip-v0',
      track: 'video',
      title: 'Shot 01 · Courtyard',
      sourceNodeId: shot01VideoNode.id,
      startSec: 0,
      durationSec: 6,
      thumbnailUrl: '/media/real_courtyard_sun.jpg',
      videoUrl: '/media/real_shot01_courtyard.mp4',
      videoTheme: 'coastal-daylight',
      seed: 408,
      promptOrDialogue: shot01VideoNode.prompt,
      color: '#252525',
    },
    {
      id: 'clip-v1',
      track: 'video',
      title: 'Shot 02 · Coastal Bridge',
      sourceNodeId: shot02BridgeNode.id,
      startSec: 6,
      durationSec: 6,
      thumbnailUrl: '/media/real_coastal_cliffs.jpg',
      videoUrl: '/media/real_shot02_bridge.mp4',
      videoTheme: 'coastal-daylight',
      seed: 777,
      promptOrDialogue: shot02BridgeNode.prompt,
      color: '#252525',
    },
    {
      id: 'clip-v2',
      track: 'video',
      title: 'Shot 03 · Sunlit Atelier',
      startSec: 12,
      durationSec: 6,
      thumbnailUrl: '/media/real_atelier_interior.jpg',
      videoUrl: '/media/real_shot03_atelier.mp4',
      videoTheme: 'craft-macro',
      seed: 909,
      promptOrDialogue:
        'Quiet sunlit atelier worktable with @Leica_M6 rangefinder and contact sheet loupe',
      color: '#252525',
    },
    {
      id: 'clip-a1-voice',
      track: 'voice',
      title: '@Clara_Vidal · Field Notes VO',
      startSec: 1,
      durationSec: 11,
      promptOrDialogue:
        'Light moves across limestone slower than memory — three frames between the courtyard and the sea.',
      lipSyncCharacter: '@Clara_Vidal',
      audioFreqHz: 196,
      waveform: createDefaultWaveform(412, 64),
      color: '#252525',
    },
    {
      id: 'clip-a2-sfx-1',
      track: 'sfx',
      title: 'Coastal Wind & Surf (A1)',
      sourceNodeId: audioNode.id,
      startSec: 0,
      durationSec: 18,
      audioUrl: '/media/real_coastal_foley.mp3',
      waveform: coastalWaveform,
      promptOrDialogue: 'Open-air Atlantic breeze, olive leaves, and distant limestone surf wash',
      sfxKind: 'coastal-surf',
      color: '#252525',
    },
  ];

  return {
    nodes: [
      elementNode,
      courtyardImageNode,
      shot01VideoNode,
      shot02BridgeNode,
      cliffsImageNode,
      gridNode,
      audioNode,
      timelineNode,
    ],
    edges,
    multiframes,
    bridges,
    timelineClips,
  };
}

export function buildKyotoJoineryGraph(): {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  multiframes: MultiframeCard[];
  bridges: MultiframeBridge[];
  timelineClips: TimelineClip[];
} {
  const styleDna = extractStyleDnaFromPrompt('Kyoto cedar joinery atelier 50mm Leica Summilux');
  const roomWaveform = createDefaultWaveform(618, 64);

  const craftElement: CanvasNode = {
    id: 'node-kyoto-el',
    kind: 'element',
    title: 'Elements 1 · @Leica_M6',
    prompt: '@Leica_M6 brass rangefinder + hand-planed hinoki cedar craft study',
    x: 80,
    y: 100,
    width: 280,
    height: 280,
    aspectRatio: '1:1',
    status: 'ready',
    imageUrl: '/media/real_leica_craft.jpg',
    seed: 601,
    resolution: '2K',
    elementHandles: ['@Leica_M6'],
    styleDna,
    layers: createDefaultLayers('/media/real_leica_craft.jpg'),
    providerUsed: 'Element Continuity Vault',
    createdAt: Date.now() - 30000,
  };

  const timberNode: CanvasNode = {
    id: 'node-kyoto-img1',
    kind: 'image',
    title: 'Images 1 · Kyoto Cedar Joinery',
    prompt: 'Hand-cut hinoki cedar mortise joinery illuminated by soft shoji morning light, 50mm f/1.4',
    x: 480,
    y: 100,
    width: 340,
    height: 320,
    aspectRatio: '1:1',
    status: 'ready',
    imageUrl: '/media/real_kyoto_timber.jpg',
    seed: 602,
    resolution: '2K',
    elementHandles: ['@Leica_M6'],
    layers: createDefaultLayers('/media/real_kyoto_timber.jpg'),
    providerUsed: 'Dreamina Smart Canvas',
    createdAt: Date.now() - 26000,
  };

  const atelierNode: CanvasNode = {
    id: 'node-kyoto-img2',
    kind: 'image',
    title: 'Images 2 · Sunlit Atelier Bench',
    prompt: 'Quiet architectural studio table with timber samples, brass calipers, and @Leica_M6',
    x: 480,
    y: 550,
    width: 340,
    height: 320,
    aspectRatio: '1:1',
    status: 'ready',
    imageUrl: '/media/real_atelier_interior.jpg',
    seed: 603,
    resolution: '2K',
    elementHandles: ['@Leica_M6'],
    layers: createDefaultLayers('/media/real_atelier_interior.jpg'),
    providerUsed: 'Dreamina Smart Canvas',
    createdAt: Date.now() - 22000,
  };

  const atelierVideo: CanvasNode = {
    id: 'node-kyoto-vid1',
    kind: 'video',
    title: 'Videos 1 · Timber → Atelier Bridge',
    prompt: 'Smooth macro slider transition from cedar joinery grain to sunlit atelier workbench',
    x: 940,
    y: 100,
    width: 568,
    height: 320,
    aspectRatio: '16:9',
    status: 'ready',
    imageUrl: '/media/real_atelier_interior.jpg',
    videoUrl: '/media/real_shot03_atelier.mp4',
    videoTheme: 'craft-macro',
    bridgeMode: true,
    startImageUrl: '/media/real_kyoto_timber.jpg',
    endImageUrl: '/media/real_atelier_interior.jpg',
    startNodeId: timberNode.id,
    endNodeId: atelierNode.id,
    motionCurve: 'match-dissolve',
    seed: 604,
    resolution: '1080p',
    durationSec: 6,
    cameraMotion: 'Match Dissolve',
    elementHandles: ['@Leica_M6'],
    layers: createDefaultLayers('/media/real_atelier_interior.jpg'),
    providerUsed: 'Keyframe Bridge · Match Dissolve',
    createdAt: Date.now() - 18000,
  };

  const audioNode: CanvasNode = {
    id: 'node-kyoto-audio',
    kind: 'audio',
    title: 'Audio 1 · Atelier Room Tone',
    prompt: 'Quiet cedar workshop ambience, gentle courtyard bamboo breeze, mechanical shutter click',
    x: 940,
    y: 550,
    width: 360,
    height: 150,
    aspectRatio: '16:9',
    status: 'ready',
    audioUrl: '/media/real_coastal_foley.mp3',
    audioMode: 'ambient',
    waveform: roomWaveform,
    durationSec: 12,
    seed: 605,
    resolution: '1080p',
    elementHandles: [],
    layers: [],
    providerUsed: 'Acoustic Foley + 64-Bar Waveform',
    createdAt: Date.now() - 14000,
  };

  const timelineNode: CanvasNode = {
    id: 'node-timeline-1',
    kind: 'timeline',
    title: 'Timelines 1',
    prompt: 'Kyoto Joinery — Craft Study Sequence (00:12)',
    x: 480,
    y: 1000,
    width: 1120,
    height: 196,
    aspectRatio: '16:9',
    status: 'ready',
    videoUrl: '/media/real_shot03_atelier.mp4',
    seed: 606,
    resolution: '1080p',
    durationSec: 12,
    elementHandles: ['@Leica_M6'],
    layers: [],
    providerUsed: 'Dreamina Spatial Timeline',
    createdAt: Date.now() - 8000,
  };

  return {
    nodes: [craftElement, timberNode, atelierNode, atelierVideo, audioNode, timelineNode],
    edges: [
      { id: 'edge-k-1', sourceId: craftElement.id, targetId: timberNode.id, kind: 'lineage' },
      { id: 'edge-k-2', sourceId: timberNode.id, targetId: atelierVideo.id, kind: 'multiframe' },
      { id: 'edge-k-3', sourceId: atelierNode.id, targetId: atelierVideo.id, kind: 'multiframe' },
      { id: 'edge-k-4', sourceId: atelierVideo.id, targetId: timelineNode.id, kind: 'multiframe' },
      { id: 'edge-k-5', sourceId: audioNode.id, targetId: timelineNode.id, kind: 'lineage' },
    ],
    multiframes: [
      {
        id: 'mf-k1',
        order: 0,
        title: 'KF 01 · Cedar Joinery',
        prompt: timberNode.prompt,
        imageUrl: '/media/real_kyoto_timber.jpg',
        videoUrl: '/media/real_shot03_atelier.mp4',
        aspectRatio: '16:9',
      },
      {
        id: 'mf-k2',
        order: 1,
        title: 'KF 02 · Sunlit Atelier',
        prompt: atelierNode.prompt,
        imageUrl: '/media/real_atelier_interior.jpg',
        videoUrl: '/media/real_shot03_atelier.mp4',
        aspectRatio: '16:9',
      },
    ],
    bridges: [
      {
        id: 'bridge-k-1',
        fromCardId: 'mf-k1',
        toCardId: 'mf-k2',
        durationSec: 6,
        curve: 'Rack Focus',
        transitionPrompt: atelierVideo.prompt,
        useTenSecContextWindow: true,
        firstLastKeyframeLock: true,
      },
    ],
    timelineClips: [
      {
        id: 'clip-kv0',
        track: 'video',
        title: 'Shot 01 · Kyoto Joinery Bridge',
        sourceNodeId: atelierVideo.id,
        startSec: 0,
        durationSec: 6,
        thumbnailUrl: '/media/real_kyoto_timber.jpg',
        videoUrl: '/media/real_shot03_atelier.mp4',
        videoTheme: 'craft-macro',
        seed: 604,
        promptOrDialogue: atelierVideo.prompt,
        color: '#252525',
      },
      {
        id: 'clip-kv1',
        track: 'video',
        title: 'Shot 02 · Courtyard Daylight',
        startSec: 6,
        durationSec: 6,
        thumbnailUrl: '/media/real_courtyard_sun.jpg',
        videoUrl: '/media/real_shot01_courtyard.mp4',
        videoTheme: 'coastal-daylight',
        seed: 408,
        promptOrDialogue: 'Natural daylight exterior study',
        color: '#252525',
      },
      {
        id: 'clip-ka1',
        track: 'sfx',
        title: 'Atelier Room Tone (A1)',
        sourceNodeId: audioNode.id,
        startSec: 0,
        durationSec: 12,
        audioUrl: '/media/real_coastal_foley.mp3',
        waveform: roomWaveform,
        promptOrDialogue: audioNode.prompt,
        sfxKind: 'room-tone',
        color: '#252525',
      },
    ],
  };
}

export function buildAlpinePassGraph(): {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  multiframes: MultiframeCard[];
  bridges: MultiframeBridge[];
  timelineClips: TimelineClip[];
} {
  const alpineWaveform = createDefaultWaveform(742, 64);

  const alpineImg: CanvasNode = {
    id: 'node-alpine-img1',
    kind: 'image',
    title: 'Images 1 · Alpine Timber Pass',
    prompt: 'Morning mist clearing over high-altitude alpine switchback and timber refuge, 24mm prime',
    x: 120,
    y: 100,
    width: 340,
    height: 320,
    aspectRatio: '1:1',
    status: 'ready',
    imageUrl: '/media/real_alpine_road.jpg',
    seed: 701,
    resolution: '2K',
    elementHandles: ['@Limestone_Villa'],
    layers: createDefaultLayers('/media/real_alpine_road.jpg'),
    providerUsed: 'Dreamina Smart Canvas',
    createdAt: Date.now() - 28000,
  };

  const cliffsImg: CanvasNode = {
    id: 'node-alpine-img2',
    kind: 'image',
    title: 'Images 2 · Coastal Headland',
    prompt: 'Steep limestone sea cliffs meeting crisp Atlantic horizon under high cirrus clouds, 35mm',
    x: 120,
    y: 550,
    width: 340,
    height: 320,
    aspectRatio: '1:1',
    status: 'ready',
    imageUrl: '/media/real_coastal_cliffs.jpg',
    seed: 702,
    resolution: '2K',
    elementHandles: ['@Limestone_Villa'],
    layers: createDefaultLayers('/media/real_coastal_cliffs.jpg'),
    providerUsed: 'Dreamina Smart Canvas',
    createdAt: Date.now() - 24000,
  };

  const alpineBridge: CanvasNode = {
    id: 'node-alpine-vid1',
    kind: 'video',
    title: 'Videos 1 · Ridge → Headland Bridge',
    prompt: 'Wide architectural aerial transition from misty alpine pass to sunlit coastal headland',
    x: 600,
    y: 100,
    width: 568,
    height: 320,
    aspectRatio: '16:9',
    status: 'ready',
    imageUrl: '/media/real_alpine_road.jpg',
    videoUrl: '/media/real_shot02_bridge.mp4',
    videoTheme: 'alpine-aerial',
    bridgeMode: true,
    startImageUrl: '/media/real_alpine_road.jpg',
    endImageUrl: '/media/real_coastal_cliffs.jpg',
    startNodeId: alpineImg.id,
    endNodeId: cliffsImg.id,
    motionCurve: 'ease-in-out',
    seed: 703,
    resolution: '1080p',
    durationSec: 6,
    cameraMotion: 'Ease In-Out Bridge',
    elementHandles: ['@Limestone_Villa'],
    layers: createDefaultLayers('/media/real_alpine_road.jpg'),
    providerUsed: 'Keyframe Bridge · Ease In-Out',
    createdAt: Date.now() - 18000,
  };

  const audioNode: CanvasNode = {
    id: 'node-alpine-audio',
    kind: 'audio',
    title: 'Audio 1 · High Pass Wind',
    prompt: 'Crisp high-altitude mountain wind over granite ridge and distant valley stream',
    x: 600,
    y: 550,
    width: 360,
    height: 150,
    aspectRatio: '16:9',
    status: 'ready',
    audioUrl: '/media/real_coastal_foley.mp3',
    audioMode: 'ambient',
    waveform: alpineWaveform,
    durationSec: 12,
    seed: 704,
    resolution: '1080p',
    elementHandles: [],
    layers: [],
    providerUsed: 'Acoustic Foley + 64-Bar Waveform',
    createdAt: Date.now() - 12000,
  };

  const timelineNode: CanvasNode = {
    id: 'node-timeline-1',
    kind: 'timeline',
    title: 'Timelines 1',
    prompt: 'Alpine Pass — Architectural Monograph (00:12)',
    x: 120,
    y: 1000,
    width: 1120,
    height: 196,
    aspectRatio: '16:9',
    status: 'ready',
    videoUrl: '/media/real_shot02_bridge.mp4',
    seed: 705,
    resolution: '1080p',
    durationSec: 12,
    elementHandles: ['@Limestone_Villa'],
    layers: [],
    providerUsed: 'Dreamina Spatial Timeline',
    createdAt: Date.now() - 8000,
  };

  return {
    nodes: [alpineImg, cliffsImg, alpineBridge, audioNode, timelineNode],
    edges: [
      { id: 'edge-a-1', sourceId: alpineImg.id, targetId: alpineBridge.id, kind: 'multiframe' },
      { id: 'edge-a-2', sourceId: cliffsImg.id, targetId: alpineBridge.id, kind: 'multiframe' },
      { id: 'edge-a-3', sourceId: alpineBridge.id, targetId: timelineNode.id, kind: 'multiframe' },
      { id: 'edge-a-4', sourceId: audioNode.id, targetId: timelineNode.id, kind: 'lineage' },
    ],
    multiframes: [
      {
        id: 'mf-a1',
        order: 0,
        title: 'KF 01 · Alpine Pass',
        prompt: alpineImg.prompt,
        imageUrl: '/media/real_alpine_road.jpg',
        videoUrl: '/media/real_shot02_bridge.mp4',
        aspectRatio: '16:9',
      },
      {
        id: 'mf-a2',
        order: 1,
        title: 'KF 02 · Coastal Cliffs',
        prompt: cliffsImg.prompt,
        imageUrl: '/media/real_coastal_cliffs.jpg',
        videoUrl: '/media/real_shot02_bridge.mp4',
        aspectRatio: '16:9',
      },
    ],
    bridges: [
      {
        id: 'bridge-a-1',
        fromCardId: 'mf-a1',
        toCardId: 'mf-a2',
        durationSec: 6,
        curve: 'Crane Up',
        transitionPrompt: alpineBridge.prompt,
        useTenSecContextWindow: true,
        firstLastKeyframeLock: true,
      },
    ],
    timelineClips: [
      {
        id: 'clip-av0',
        track: 'video',
        title: 'Shot 01 · Ridge → Headland',
        sourceNodeId: alpineBridge.id,
        startSec: 0,
        durationSec: 6,
        thumbnailUrl: '/media/real_alpine_road.jpg',
        videoUrl: '/media/real_shot02_bridge.mp4',
        videoTheme: 'alpine-aerial',
        seed: 703,
        promptOrDialogue: alpineBridge.prompt,
        color: '#252525',
      },
      {
        id: 'clip-av1',
        track: 'video',
        title: 'Shot 02 · Limestone Courtyard',
        startSec: 6,
        durationSec: 6,
        thumbnailUrl: '/media/real_courtyard_sun.jpg',
        videoUrl: '/media/real_shot01_courtyard.mp4',
        videoTheme: 'coastal-daylight',
        seed: 408,
        promptOrDialogue: 'Afternoon courtyard daylight sequence',
        color: '#252525',
      },
      {
        id: 'clip-aa1',
        track: 'sfx',
        title: 'High Pass Wind (A1)',
        sourceNodeId: audioNode.id,
        startSec: 0,
        durationSec: 12,
        audioUrl: '/media/real_coastal_foley.mp3',
        waveform: alpineWaveform,
        promptOrDialogue: audioNode.prompt,
        sfxKind: 'coastal-surf',
        color: '#252525',
      },
    ],
  };
}

export function buildStudioPresetGraph(preset: StudioPresetId): {
  title: string;
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  multiframes: MultiframeCard[];
  bridges: MultiframeBridge[];
  timelineClips: TimelineClip[];
} {
  switch (preset) {
    case 'cross-platform-blueprint':
      return {
        title: 'Workflow Blueprint · Higgsfield → Kling 4.0 → ElevenLabs',
        ...buildCrossPlatformBlueprintGraph(),
      };
    case 'kyoto-joinery':
      return {
        title: 'Kyoto Joinery — Craft Study',
        ...buildKyotoJoineryGraph(),
      };
    case 'alpine-pass':
      return {
        title: 'Alpine Pass — Architectural Monograph',
        ...buildAlpinePassGraph(),
      };
    case 'blank':
      return {
        title: 'Untitled Canvas Project',
        ...buildBlankStudioGraph(),
      };
    case 'salt-terracotta':
    default:
      return {
        title: 'Salt & Terracotta — Coastal Short',
        ...buildSaltTerracottaGraph(),
      };
  }
}

export function buildInitialStudioGraph(): {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  multiframes: MultiframeCard[];
  bridges: MultiframeBridge[];
  timelineClips: TimelineClip[];
} {
  return buildSaltTerracottaGraph();
}
