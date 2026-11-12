import type {
  CanvasEdge,
  CanvasNode,
  DreaminaSkill,
  ElementVault,
  FrameLayer,
  MultiframeBridge,
  MultiframeCard,
  TimelineClip,
} from '../types/studio';
import {
  NINE_GRID_LABELS,
  extractStyleDnaFromPrompt,
} from '../utils/proceduralMedia';

export interface MediaCatalogItem {
  id: string;
  title: string;
  kind: 'image' | 'video' | 'contact-sheet' | 'element';
  url: string;
  posterUrl?: string;
  durationSec?: number;
  resolution: string;
}

export const MEDIA_ASSET_CATALOG: MediaCatalogItem[] = [
  {
    id: 'asset-shot01-vid',
    title: 'Shot 01 · Rooftop Rain',
    kind: 'video',
    url: '/media/shot01_rooftop.mp4',
    posterUrl: '/media/shot01_rooftop.png',
    durationSec: 6,
    resolution: '1280×720',
  },
  {
    id: 'asset-shot02-vid',
    title: 'Shot 02 · Alley Chase',
    kind: 'video',
    url: '/media/shot02_alley_chase.mp4',
    posterUrl: '/media/shot02_alley_chase.png',
    durationSec: 6,
    resolution: '1280×720',
  },
  {
    id: 'asset-shot02b-vid',
    title: 'Shot 02B · Dawn Remix',
    kind: 'video',
    url: '/media/shot02b_sunrise_remix.mp4',
    posterUrl: '/media/shot02b_sunrise_remix.png',
    durationSec: 6,
    resolution: '1280×720',
  },
  {
    id: 'asset-master-vid',
    title: 'Protocol: Rain Master Cut',
    kind: 'video',
    url: '/media/protocol_rain_master.mp4',
    posterUrl: '/media/shot01_rooftop.png',
    durationSec: 18,
    resolution: '1280×720',
  },
  {
    id: 'asset-kael-el',
    title: '@Hero_Kael Turnaround',
    kind: 'element',
    url: '/media/hero_kael_vault.png',
    resolution: '1280×720',
  },
  {
    id: 'asset-sneaker-el',
    title: '@Cyber_Sneaker Macro',
    kind: 'element',
    url: '/media/cyber_sneaker_vault.png',
    resolution: '1280×720',
  },
  {
    id: 'asset-shot01-img',
    title: 'Keyframe · Rooftop Ledge',
    kind: 'image',
    url: '/media/shot01_rooftop.png',
    resolution: '1280×720',
  },
  {
    id: 'asset-shot02-img',
    title: 'Keyframe · Shinjuku Sprint',
    kind: 'image',
    url: '/media/shot02_alley_chase.png',
    resolution: '1280×720',
  },
  {
    id: 'asset-shot02b-img',
    title: 'Keyframe · Golden Dawn',
    kind: 'image',
    url: '/media/shot02b_sunrise_remix.png',
    resolution: '1280×720',
  },
  {
    id: 'asset-9grid',
    title: '9-Grid Storyboard Sheet',
    kind: 'contact-sheet',
    url: '/media/contact_sheet_9grid.png',
    resolution: '1920×1080',
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
      textContent: 'PROTOCOL: RAIN',
    },
  ];
}

export const BUILTIN_SKILLS: DreaminaSkill[] = [
  {
    id: 'skill-9-grid',
    slash: '/9-Grid Storyboard',
    title: '9-Grid Contact Sheet Slicer',
    category: 'Storyboard',
    badge: '3×3 SLICER',
    description:
      'Synthesizes a 3×3 cinema storyboard sheet and slices all 9 camera framings into linked frames.',
    promptTemplate:
      '@Hero_Kael walking through rain-slicked Neo-Tokyo alley wearing @Cyber_Sneaker, 9-panel anamorphic director contact sheet, @Brand_Style lighting',
    recommendedMode: '9-grid',
  },
  {
    id: 'skill-4-angle',
    slash: '/4-Angle Coverage',
    title: '4-Angle Camera Coverage',
    category: 'Camera',
    badge: '2×2 MULTI-CAM',
    description:
      'Locks scene geometry & @Elements across Wide 24mm, Medium 50mm, Close-Up 85mm, and Low 18mm.',
    promptTemplate:
      'Multi-camera 4-angle coverage of @Hero_Kael inspecting levitating @Cyber_Sneaker on wet rooftop, @Brand_Style',
    recommendedMode: '4-angle',
  },
  {
    id: 'skill-long-take',
    slash: '/Cinematic Long Take',
    title: '15s Omni 1.2 Flash Long Take',
    category: 'Camera',
    badge: '15S OMNI 1.2',
    description:
      'Unbroken 15-second Steadicam tracking shot with native environmental audio and 10s context lock.',
    promptTemplate:
      'Unbroken 15s Steadicam tracking shot following @Hero_Kael sprinting across neon crosswalk in @Cyber_Sneaker, puddles splashing in slow motion, @Brand_Style',
    recommendedMode: 'video',
    durationSec: 15,
  },
  {
    id: 'skill-fpv-drone',
    slash: '/FPV Drone Walkthrough',
    title: 'FPV Acro One-Shot',
    category: 'Camera',
    badge: 'FPV DIVE',
    description:
      'High-velocity FPV drone dive threading megastructure arches into macro product reveal.',
    promptTemplate:
      'FPV drone dive down cyberpunk canyon threading holographic billboards into macro hero hover around @Cyber_Sneaker, motion blur, 24fps',
    recommendedMode: 'video',
    durationSec: 10,
  },
  {
    id: 'skill-ugc-ad',
    slash: '/UGC Product Ad',
    title: 'Zero-Markup Commercial Spot',
    category: 'Commercial',
    badge: 'AD ENGINE',
    description:
      'Commercial product reveal with locked @Cyber_Sneaker geometry and crisp rim speculars.',
    promptTemplate:
      'Hero commercial tabletop reveal of @Cyber_Sneaker levitating above obsidian mirror plinth, subtle rim light, @Brand_Style',
    recommendedMode: 'video',
    durationSec: 6,
  },
  {
    id: 'skill-night-remix',
    slash: '/Multi-Turn Dawn Remix',
    title: 'Multi-Turn Stateful Video Remix',
    category: 'Omni Multi-Turn',
    badge: 'INTERACTION_ID',
    description:
      'Branches selected video via previous_interaction_id to transform lighting/weather while keeping motion locked.',
    promptTemplate:
      'Keep @Hero_Kael choreography identical; shift lighting to golden dawn sunrise breaking through Neo-Tokyo rain clouds',
    recommendedMode: 'multi-turn',
    durationSec: 6,
  },
];

export function buildInitialElements(): ElementVault[] {
  return [
    {
      id: 'el-hero-kael',
      handle: '@Hero_Kael',
      name: 'Kael (Protagonist)',
      category: 'character',
      description:
        'Cybernetic trench coat courier, locked facial & wardrobe continuity across shots.',
      accentColor: '#20D5EC',
      voiceProfile: 'Baritone · Lip-Sync Locked',
      references: [
        { id: 'kael_ref_1', label: '3-Angle Turnaround', dataUrl: '/media/hero_kael_vault.png' },
        { id: 'kael_ref_2', label: 'Rooftop Keyframe', dataUrl: '/media/shot01_rooftop.png' },
        { id: 'kael_ref_3', label: 'Alley Pursuit', dataUrl: '/media/shot02_alley_chase.png' },
        { id: 'kael_ref_4', label: 'Dawn Remix', dataUrl: '/media/shot02b_sunrise_remix.png' },
        { id: 'kael_ref_5', label: '9-Grid Coverage', dataUrl: '/media/contact_sheet_9grid.png' },
        { id: 'kael_ref_6', label: 'Wardrobe Lock', dataUrl: '/media/hero_kael_vault.png' },
      ],
    },
    {
      id: 'el-cyber-sneaker',
      handle: '@Cyber_Sneaker',
      name: 'AeroFlux X-99 Sneaker',
      category: 'product',
      description:
        'Sculpted translucent sole + matte carbon chassis (6-angle orthographic product lock).',
      accentColor: '#d4d4d8',
      references: [
        { id: 'snk_ref_1', label: 'Product Macro', dataUrl: '/media/cyber_sneaker_vault.png' },
        { id: 'snk_ref_2', label: 'Kinetic Step', dataUrl: '/media/shot02_alley_chase.png' },
        { id: 'snk_ref_3', label: 'Sunrise Rim', dataUrl: '/media/shot02b_sunrise_remix.png' },
        { id: 'snk_ref_4', label: 'Rooftop Stance', dataUrl: '/media/shot01_rooftop.png' },
        { id: 'snk_ref_5', label: 'Multi-Lens Sheet', dataUrl: '/media/contact_sheet_9grid.png' },
        { id: 'snk_ref_6', label: 'Sole Orthographic', dataUrl: '/media/cyber_sneaker_vault.png' },
      ],
    },
    {
      id: 'el-brand-style',
      handle: '@Brand_Style',
      name: 'Neo-Tokyo 500T Cinema LUT',
      category: 'style',
      description:
        'Panavision 40mm T2.0 halation, wet asphalt speculars, Kodak Vision3 500T.',
      accentColor: '#a1a1aa',
      references: [
        { id: 'sty_ref_1', label: 'Rain Halation', dataUrl: '/media/shot01_rooftop.png' },
        { id: 'sty_ref_2', label: 'Alley Reflections', dataUrl: '/media/shot02_alley_chase.png' },
        { id: 'sty_ref_3', label: 'Golden Dawn LUT', dataUrl: '/media/shot02b_sunrise_remix.png' },
        { id: 'sty_ref_4', label: '9-Panel Sheet', dataUrl: '/media/contact_sheet_9grid.png' },
        { id: 'sty_ref_5', label: 'Portrait Rim', dataUrl: '/media/hero_kael_vault.png' },
        { id: 'sty_ref_6', label: 'Macro Specular', dataUrl: '/media/cyber_sneaker_vault.png' },
      ],
    },
  ];
}

export function buildBlankStudioGraph(): {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  multiframes: MultiframeCard[];
  bridges: MultiframeBridge[];
  timelineClips: TimelineClip[];
} {
  const timelineNode: CanvasNode = {
    id: 'node-timeline-1',
    kind: 'timeline',
    title: 'Timelines 1',
    prompt: 'Master Rough-Cut Sequence',
    x: 220,
    y: 520,
    width: 1120,
    height: 168,
    aspectRatio: '16:9',
    status: 'ready',
    seed: 100,
    resolution: '1080p',
    elementHandles: [],
    layers: [],
    providerUsed: 'Dreamina Spatial Timeline',
    createdAt: Date.now(),
  };

  return {
    nodes: [timelineNode],
    edges: [],
    multiframes: [],
    bridges: [],
    timelineClips: [],
  };
}

export function buildInitialStudioGraph(): {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  multiframes: MultiframeCard[];
  bridges: MultiframeBridge[];
  timelineClips: TimelineClip[];
} {
  const styleDna = extractStyleDnaFromPrompt('Neo-Tokyo cyberpunk rain @Brand_Style');

  const elementNode: CanvasNode = {
    id: 'node-element-kael',
    kind: 'element',
    title: 'Elements 1 · @Hero_Kael',
    prompt:
      '@Hero_Kael cybernetic trench coat courier + @Cyber_Sneaker 6-reference subject lock',
    x: 80,
    y: 120,
    width: 280,
    height: 280,
    aspectRatio: '1:1',
    status: 'ready',
    imageUrl: '/media/hero_kael_vault.png',
    seed: 101,
    resolution: '2K',
    elementHandles: ['@Hero_Kael', '@Cyber_Sneaker'],
    styleDna,
    layers: createDefaultLayers('/media/hero_kael_vault.png'),
    providerUsed: 'Element Continuity Vault',
    createdAt: Date.now() - 40000,
  };

  const heroImageNode: CanvasNode = {
    id: 'node-shot-hero',
    kind: 'image',
    title: 'Images 1 · Rooftop Keyframe',
    prompt:
      '@Hero_Kael standing on rain-slicked Neo-Tokyo rooftop ledge wearing @Cyber_Sneaker, Panavision 40mm T2.0',
    x: 460,
    y: 100,
    width: 340,
    height: 320,
    aspectRatio: '1:1',
    status: 'ready',
    imageUrl: '/media/shot01_rooftop.png',
    seed: 204,
    resolution: '2K',
    interactionId: 'int_omni_a102f9',
    elementHandles: ['@Hero_Kael', '@Cyber_Sneaker', '@Brand_Style'],
    layers: createDefaultLayers('/media/shot01_rooftop.png'),
    providerUsed: 'Dreamina Smart Canvas',
    createdAt: Date.now() - 32000,
  };

  const shot01VideoNode: CanvasNode = {
    id: 'node-video-shot01',
    kind: 'video',
    title: 'Videos 1 · Shot 01 Rooftop',
    prompt:
      'Anamorphic dolly-in on @Hero_Kael on rain-slicked rooftop ledge, cyan neon reflections, @Cyber_Sneaker sole glow',
    x: 900,
    y: 100,
    width: 568,
    height: 320,
    aspectRatio: '16:9',
    status: 'ready',
    imageUrl: '/media/shot01_rooftop.png',
    videoUrl: '/media/shot01_rooftop.mp4',
    videoTheme: 'cyberpunk-rain',
    seed: 408,
    resolution: '1080p',
    durationSec: 6,
    cameraMotion: 'Dolly In',
    interactionId: 'int_omni_408a',
    elementHandles: ['@Hero_Kael', '@Cyber_Sneaker'],
    layers: createDefaultLayers('/media/shot01_rooftop.png'),
    providerUsed: 'Local FFmpeg 8.0 · $0.00',
    createdAt: Date.now() - 24000,
  };

  const shot02VideoNode: CanvasNode = {
    id: 'node-video-omni-1',
    kind: 'video',
    title: 'Videos 2 · Shot 02 Alley Chase',
    prompt:
      'Dynamic tracking shot following @Hero_Kael sprinting through wet Shinjuku neon alley in @Cyber_Sneaker',
    x: 1580,
    y: 100,
    width: 568,
    height: 320,
    aspectRatio: '16:9',
    status: 'ready',
    imageUrl: '/media/shot02_alley_chase.png',
    videoUrl: '/media/shot02_alley_chase.mp4',
    videoTheme: 'cyberpunk-rain',
    seed: 777,
    resolution: '1080p',
    durationSec: 6,
    cameraMotion: 'FPV Dive',
    interactionId: 'int_omni_88c41d',
    previousInteractionId: 'int_omni_408a',
    elementHandles: ['@Hero_Kael', '@Cyber_Sneaker'],
    layers: createDefaultLayers('/media/shot02_alley_chase.png'),
    providerUsed: 'Gemini Omni 1.2 Flash ($0 BYOK)',
    createdAt: Date.now() - 18000,
  };

  const gridNode: CanvasNode = {
    id: 'node-grid-9',
    kind: 'contact-sheet',
    title: 'Images 2 · 9-Grid Contact Sheet',
    prompt:
      '/9-Grid Storyboard @Hero_Kael & @Cyber_Sneaker rain chase coverage across 9 cinema lenses',
    x: 460,
    y: 500,
    width: 480,
    height: 270,
    aspectRatio: '16:9',
    status: 'ready',
    imageUrl: '/media/contact_sheet_9grid.png',
    seed: 512,
    resolution: '4K',
    interactionId: 'int_seedream_9grid',
    elementHandles: ['@Hero_Kael', '@Cyber_Sneaker'],
    gridSpec: { rows: 3, cols: 3, labels: NINE_GRID_LABELS },
    layers: createDefaultLayers('/media/contact_sheet_9grid.png'),
    providerUsed: 'Seedream 3.0 · 9-Grid Slicer',
    createdAt: Date.now() - 14000,
  };

  const timelineNode: CanvasNode = {
    id: 'node-timeline-1',
    kind: 'timeline',
    title: 'Timelines 1',
    prompt: 'Protocol: Rain — 3-Shot Master Sequence (00:18)',
    x: 460,
    y: 880,
    width: 1120,
    height: 168,
    aspectRatio: '16:9',
    status: 'ready',
    videoUrl: '/media/protocol_rain_master.mp4',
    seed: 999,
    resolution: '1080p',
    durationSec: 18,
    elementHandles: ['@Hero_Kael', '@Cyber_Sneaker'],
    layers: [],
    providerUsed: 'Dreamina Spatial Timeline',
    createdAt: Date.now() - 8000,
  };

  const edges: CanvasEdge[] = [
    {
      id: 'edge-el-img1',
      sourceId: elementNode.id,
      targetId: heroImageNode.id,
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
      sourceId: heroImageNode.id,
      targetId: shot01VideoNode.id,
      kind: 'lineage',
    },
    {
      id: 'edge-vid1-vid2',
      sourceId: shot01VideoNode.id,
      targetId: shot02VideoNode.id,
      kind: 'multi-turn-branch',
    },
    {
      id: 'edge-vid1-timeline',
      sourceId: shot01VideoNode.id,
      targetId: timelineNode.id,
      kind: 'multiframe',
    },
  ];

  const multiframes: MultiframeCard[] = [
    {
      id: 'mf-1',
      order: 0,
      title: 'KF 01 · Rooftop Rain',
      prompt: shot01VideoNode.prompt,
      imageUrl: '/media/shot01_rooftop.png',
      videoUrl: '/media/shot01_rooftop.mp4',
      sourceNodeId: shot01VideoNode.id,
      aspectRatio: '16:9',
    },
    {
      id: 'mf-2',
      order: 1,
      title: 'KF 02 · Shinjuku Alley',
      prompt: shot02VideoNode.prompt,
      imageUrl: '/media/shot02_alley_chase.png',
      videoUrl: '/media/shot02_alley_chase.mp4',
      sourceNodeId: shot02VideoNode.id,
      aspectRatio: '16:9',
    },
    {
      id: 'mf-3',
      order: 2,
      title: 'KF 03 · Golden Dawn Remix',
      prompt:
        'Keep @Hero_Kael motion vector locked; transform alley lighting into golden sunrise over @Cyber_Sneaker',
      imageUrl: '/media/shot02b_sunrise_remix.png',
      videoUrl: '/media/shot02b_sunrise_remix.mp4',
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
        'Anamorphic plunge from rooftop ledge into rain-soaked Shinjuku alley sprint',
      useTenSecContextWindow: true,
      firstLastKeyframeLock: true,
    },
    {
      id: 'bridge-2-3',
      fromCardId: 'mf-2',
      toCardId: 'mf-3',
      durationSec: 6,
      curve: 'Crane Up',
      transitionPrompt:
        'Seamless multi-turn lighting morph from midnight rain into golden sunrise horizon',
      useTenSecContextWindow: true,
      firstLastKeyframeLock: true,
    },
  ];

  const timelineClips: TimelineClip[] = [
    {
      id: 'clip-v0',
      track: 'video',
      title: 'Shot 01 · Rooftop',
      sourceNodeId: shot01VideoNode.id,
      startSec: 0,
      durationSec: 6,
      thumbnailUrl: '/media/shot01_rooftop.png',
      videoUrl: '/media/shot01_rooftop.mp4',
      videoTheme: 'cyberpunk-rain',
      seed: 408,
      promptOrDialogue: shot01VideoNode.prompt,
      color: '#252525',
    },
    {
      id: 'clip-v1',
      track: 'video',
      title: 'Shot 02 · Alley Chase',
      sourceNodeId: shot02VideoNode.id,
      startSec: 6,
      durationSec: 6,
      thumbnailUrl: '/media/shot02_alley_chase.png',
      videoUrl: '/media/shot02_alley_chase.mp4',
      videoTheme: 'cyberpunk-rain',
      seed: 777,
      promptOrDialogue: shot02VideoNode.prompt,
      color: '#252525',
    },
    {
      id: 'clip-v2',
      track: 'video',
      title: 'Shot 02B · Dawn Remix',
      startSec: 12,
      durationSec: 6,
      thumbnailUrl: '/media/shot02b_sunrise_remix.png',
      videoUrl: '/media/shot02b_sunrise_remix.mp4',
      videoTheme: 'sneaker-macro',
      seed: 909,
      promptOrDialogue:
        'Golden dawn multi-turn branch keeping @Hero_Kael sprint choreography locked',
      color: '#252525',
    },
    {
      id: 'clip-a1-voice',
      track: 'voice',
      title: '@Hero_Kael · Neural Lip-Sync VO',
      startSec: 1,
      durationSec: 11,
      promptOrDialogue:
        'Protocol Rain initiated. Every step rewrites the city grid — zero markup, zero limits.',
      lipSyncCharacter: '@Hero_Kael',
      audioFreqHz: 174,
      color: '#252525',
    },
    {
      id: 'clip-a2-sfx-1',
      track: 'sfx',
      title: 'Rain Ambience + 55Hz Sub-Bass',
      startSec: 0,
      durationSec: 18,
      promptOrDialogue: 'Binaural rain on asphalt + 55Hz anamorphic sub-bass drone',
      sfxKind: 'rain-ambience',
      color: '#252525',
    },
  ];

  return {
    nodes: [
      elementNode,
      heroImageNode,
      shot01VideoNode,
      shot02VideoNode,
      gridNode,
      timelineNode,
    ],
    edges,
    multiframes,
    bridges,
    timelineClips,
  };
}
