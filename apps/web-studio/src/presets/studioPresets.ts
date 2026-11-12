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
  getDimensionsForAspect,
} from '../utils/proceduralMedia';

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
      textContent: 'PROTOCOL: RAIN // ZERO MARKUP',
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
      'Synthesizes a coherent 3×3 cinema storyboard sheet and slices all 9 camera framings into linked spatial frames via FFmpeg in 1 click.',
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
      'Locks scene geometry & @Elements across Wide Master 24mm, Medium 50mm, Close-Up 85mm, and Low Dutch 18mm simultaneously.',
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
      'Unbroken 15-second Steadicam tracking shot with native environmental audio and 10s temporal context lock.',
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
      'High-velocity FPV drone dive threading megastructure arches right into macro product reveal.',
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
      'High-conversion commercial product reveal with locked @Cyber_Sneaker geometry and crisp rim speculars.',
    promptTemplate:
      'Hero commercial tabletop reveal of @Cyber_Sneaker levitating above obsidian mirror plinth, cyan laser scanlines, @Brand_Style',
    recommendedMode: 'video',
    durationSec: 8,
  },
  {
    id: 'skill-night-remix',
    slash: '/Multi-Turn Night Remix',
    title: 'Multi-Turn Stateful Video Remix',
    category: 'Omni Multi-Turn',
    badge: 'INTERACTION_ID',
    description:
      'Branches selected video via Gemini Omni 1.2 `previous_interaction_id` to transform lighting/weather while keeping motion locked.',
    promptTemplate:
      'Keep @Hero_Kael choreography identical; shift lighting to golden dawn sunrise breaking through Neo-Tokyo rain clouds with warm amber rim light',
    recommendedMode: 'multi-turn',
    durationSec: 8,
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
        'Cybernetic trench coat courier, cyan visor slit, locked facial & wardrobe continuity across shots.',
      accentColor: '#38BDF8',
      voiceProfile: 'Deep Baritone · Neural Lip-Sync Locked',
      references: [
        {
          id: 'kael_ref_1',
          label: '3-Angle Turnaround Sheet',
          dataUrl: '/media/hero_kael_vault.png',
        },
        {
          id: 'kael_ref_2',
          label: 'Rooftop Rain Keyframe',
          dataUrl: '/media/shot01_rooftop.png',
        },
        {
          id: 'kael_ref_3',
          label: 'Alley Pursuit Action',
          dataUrl: '/media/shot02_alley_chase.png',
        },
        {
          id: 'kael_ref_4',
          label: 'Golden Dawn Remix',
          dataUrl: '/media/shot02b_sunrise_remix.png',
        },
        {
          id: 'kael_ref_5',
          label: '9-Grid Coverage Sheet',
          dataUrl: '/media/contact_sheet_9grid.png',
        },
        {
          id: 'kael_ref_6',
          label: 'Wardrobe & Gear Lock',
          dataUrl: '/media/hero_kael_vault.png',
        },
      ],
    },
    {
      id: 'el-cyber-sneaker',
      handle: '@Cyber_Sneaker',
      name: 'AeroFlux X-99 Sneaker',
      category: 'product',
      description:
        'Sculpted translucent luminescence sole + matte carbon chassis (6-angle orthographic product lock).',
      accentColor: '#A855F7',
      references: [
        {
          id: 'sneaker_ref_1',
          label: 'Product Macro Sheet',
          dataUrl: '/media/cyber_sneaker_vault.png',
        },
        {
          id: 'sneaker_ref_2',
          label: 'Wet Asphalt Kinetic Step',
          dataUrl: '/media/shot02_alley_chase.png',
        },
        {
          id: 'sneaker_ref_3',
          label: 'Sunrise Specular Rim',
          dataUrl: '/media/shot02b_sunrise_remix.png',
        },
        {
          id: 'sneaker_ref_4',
          label: 'Rooftop Hero Stance',
          dataUrl: '/media/shot01_rooftop.png',
        },
        {
          id: 'sneaker_ref_5',
          label: 'Multi-Lens Contact Sheet',
          dataUrl: '/media/contact_sheet_9grid.png',
        },
        {
          id: 'sneaker_ref_6',
          label: 'Sole Luminescence Orthographic',
          dataUrl: '/media/cyber_sneaker_vault.png',
        },
      ],
    },
    {
      id: 'el-brand-style',
      handle: '@Brand_Style',
      name: 'Neo-Tokyo Anamorphic LUT',
      category: 'style',
      description:
        'Panavision 40mm T2.0 halation, wet asphalt speculars, teal/violet split-tone Kodak 500T.',
      accentColor: '#F43F5E',
      references: [
        {
          id: 'style_ref_1',
          label: 'Teal/Cyan Rain Halation',
          dataUrl: '/media/shot01_rooftop.png',
        },
        {
          id: 'style_ref_2',
          label: 'Shinjuku Neon Reflections',
          dataUrl: '/media/shot02_alley_chase.png',
        },
        {
          id: 'style_ref_3',
          label: 'Golden Dawn Split-Tone',
          dataUrl: '/media/shot02b_sunrise_remix.png',
        },
        {
          id: 'style_ref_4',
          label: '9-Panel Director LUT',
          dataUrl: '/media/contact_sheet_9grid.png',
        },
        {
          id: 'style_ref_5',
          label: 'Character Rim Lighting',
          dataUrl: '/media/hero_kael_vault.png',
        },
        {
          id: 'style_ref_6',
          label: 'Macro Specular Profile',
          dataUrl: '/media/cyber_sneaker_vault.png',
        },
      ],
    },
  ];
}

export function buildInitialStudioGraph(): {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  multiframes: MultiframeCard[];
  bridges: MultiframeBridge[];
  timelineClips: TimelineClip[];
} {
  const styleDna = extractStyleDnaFromPrompt('Neo-Tokyo cyberpunk rain @Brand_Style');

  const styleNode: CanvasNode = {
    id: 'node-style-dna-1',
    kind: 'style-dna',
    title: 'Style DNA · Neo-Tokyo 500T',
    prompt: 'Panavision C-Series 40mm · Teal/Violet Rain LUT · Kodak Vision3 500T',
    x: 80,
    y: 120,
    width: 290,
    height: 220,
    aspectRatio: '16:9',
    status: 'ready',
    seed: 101,
    resolution: '4K',
    elementHandles: ['@Brand_Style'],
    styleDna,
    layers: [],
    providerUsed: 'Style DNA Extractor',
    createdAt: Date.now() - 40000,
  };

  const heroDims = getDimensionsForAspect('16:9', 360);
  const heroImg = '/media/shot01_rooftop.png';
  const heroVideo = '/media/shot01_rooftop.mp4';

  const heroNode: CanvasNode = {
    id: 'node-shot-hero',
    kind: 'video',
    title: 'Shot 01 · Rooftop Establishing',
    prompt:
      '@Hero_Kael standing on rain-slicked Neo-Tokyo rooftop ledge wearing glowing @Cyber_Sneaker, @Brand_Style 40mm anamorphic dolly',
    x: 450,
    y: 80,
    width: heroDims.width,
    height: heroDims.height,
    aspectRatio: '16:9',
    status: 'ready',
    imageUrl: heroImg,
    videoUrl: heroVideo,
    videoTheme: 'cyberpunk-rain',
    seed: 204,
    resolution: '2K',
    durationSec: 7,
    cameraMotion: 'Anamorphic Dolly In 24fps',
    interactionId: 'int_omni_a102f9',
    elementHandles: ['@Hero_Kael', '@Cyber_Sneaker', '@Brand_Style'],
    styleDnaId: styleNode.id,
    layers: createDefaultLayers(heroImg),
    providerUsed: 'Dreamina 2.0 Smart Canvas + FFmpeg',
    createdAt: Date.now() - 30000,
  };

  const gridImg = '/media/contact_sheet_9grid.png';
  const gridNode: CanvasNode = {
    id: 'node-grid-9',
    kind: 'contact-sheet',
    title: '9-Grid Contact Sheet (Click ⊞ Slice!)',
    prompt:
      '/9-Grid Storyboard @Hero_Kael & @Cyber_Sneaker rain chase coverage across 9 cinema lenses',
    x: 450,
    y: 375,
    width: 360,
    height: 204,
    aspectRatio: '16:9',
    status: 'ready',
    imageUrl: gridImg,
    seed: 512,
    resolution: '4K',
    interactionId: 'int_seedream_9grid',
    elementHandles: ['@Hero_Kael', '@Cyber_Sneaker'],
    styleDnaId: styleNode.id,
    gridSpec: { rows: 3, cols: 3, labels: NINE_GRID_LABELS },
    layers: createDefaultLayers(gridImg),
    providerUsed: 'Seedream 3.0 · 9-Grid FFmpeg Slicer',
    createdAt: Date.now() - 25000,
  };

  const shot02Img = '/media/shot02_alley_chase.png';
  const shot02Video = '/media/shot02_alley_chase.mp4';
  const videoNode: CanvasNode = {
    id: 'node-video-omni-1',
    kind: 'video',
    title: 'Shot 02 · Alley Chase 15s Omni',
    prompt:
      'Dynamic Steadicam tracking @Hero_Kael sprinting through rain-drenched Shinjuku neon alley, @Cyber_Sneaker sole glowing cyan',
    x: 900,
    y: 70,
    width: heroDims.width,
    height: heroDims.height,
    aspectRatio: '16:9',
    status: 'ready',
    imageUrl: shot02Img,
    videoUrl: shot02Video,
    videoTheme: 'cyberpunk-rain',
    seed: 777,
    resolution: '1080p',
    durationSec: 7,
    cameraMotion: 'Dolly Tracking 24fps',
    interactionId: 'int_omni_88c41d',
    elementHandles: ['@Hero_Kael', '@Cyber_Sneaker'],
    styleDnaId: styleNode.id,
    layers: createDefaultLayers(shot02Img),
    providerUsed: 'Gemini Omni 1.2 Flash ($0 BYOK / FFmpeg)',
    createdAt: Date.now() - 18000,
  };

  const shot02bImg = '/media/shot02b_sunrise_remix.png';
  const shot02bVideo = '/media/shot02b_sunrise_remix.mp4';
  const branchVideoNode: CanvasNode = {
    id: 'node-video-branch-2',
    kind: 'video',
    title: 'Shot 02B · Golden Dawn Multi-Turn Branch',
    prompt:
      'Keep @Hero_Kael motion vector locked; transform alley lighting into golden sunrise breaking through Neo-Tokyo mist on @Cyber_Sneaker',
    x: 900,
    y: 375,
    width: heroDims.width,
    height: heroDims.height,
    aspectRatio: '16:9',
    status: 'ready',
    imageUrl: shot02bImg,
    videoUrl: shot02bVideo,
    videoTheme: 'sneaker-macro',
    seed: 909,
    resolution: '4K',
    durationSec: 7,
    cameraMotion: 'Orbit 180° + Golden Dawn LUT',
    interactionId: 'int_omni_f319b0',
    previousInteractionId: 'int_omni_88c41d',
    elementHandles: ['@Hero_Kael', '@Cyber_Sneaker', '@Brand_Style'],
    styleDnaId: styleNode.id,
    layers: createDefaultLayers(shot02bImg),
    providerUsed: 'Gemini Omni 1.2 (Stateful Branch)',
    createdAt: Date.now() - 9000,
  };

  const edges: CanvasEdge[] = [
    {
      id: 'edge-dna-hero',
      sourceId: styleNode.id,
      targetId: heroNode.id,
      kind: 'style-dna',
      label: 'Style DNA Lock',
    },
    {
      id: 'edge-dna-grid',
      sourceId: styleNode.id,
      targetId: gridNode.id,
      kind: 'style-dna',
      label: 'LUT + 40mm Lens',
    },
    {
      id: 'edge-hero-video',
      sourceId: heroNode.id,
      targetId: videoNode.id,
      kind: 'lineage',
      label: 'First Frame → 15s Omni',
    },
    {
      id: 'edge-video-branch',
      sourceId: videoNode.id,
      targetId: branchVideoNode.id,
      kind: 'multi-turn-branch',
      label: 'prev_id: int_omni_88c41d',
    },
  ];

  const multiframes: MultiframeCard[] = [
    {
      id: 'mf-1',
      order: 0,
      title: 'KF 01 · Rooftop Rain Protocol',
      prompt: heroNode.prompt,
      imageUrl: heroImg,
      videoUrl: heroVideo,
      sourceNodeId: heroNode.id,
      aspectRatio: '16:9',
    },
    {
      id: 'mf-2',
      order: 1,
      title: 'KF 02 · Shinjuku Alley Pursuit',
      prompt: videoNode.prompt,
      imageUrl: shot02Img,
      videoUrl: shot02Video,
      sourceNodeId: videoNode.id,
      aspectRatio: '16:9',
    },
    {
      id: 'mf-3',
      order: 2,
      title: 'KF 03 · Golden Dawn Climax',
      prompt: branchVideoNode.prompt,
      imageUrl: shot02bImg,
      videoUrl: shot02bVideo,
      sourceNodeId: branchVideoNode.id,
      aspectRatio: '16:9',
    },
  ];

  const bridges: MultiframeBridge[] = [
    {
      id: 'bridge-1-2',
      fromCardId: 'mf-1',
      toCardId: 'mf-2',
      durationSec: 7,
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
      durationSec: 7,
      curve: 'Crane Up',
      transitionPrompt:
        'Seamless multi-turn lighting morph from midnight neon rain into golden sunrise horizon',
      useTenSecContextWindow: true,
      firstLastKeyframeLock: true,
    },
  ];

  const timelineClips: TimelineClip[] = [
    {
      id: 'clip-v0',
      track: 'video',
      title: 'Shot 01 · Rooftop Establishing',
      sourceNodeId: heroNode.id,
      startSec: 0,
      durationSec: 7,
      thumbnailUrl: heroImg,
      videoUrl: heroVideo,
      videoTheme: 'cyberpunk-rain',
      seed: 204,
      promptOrDialogue: heroNode.prompt,
      color: '#6366F1',
    },
    {
      id: 'clip-v1',
      track: 'video',
      title: 'Shot 02 · Alley Chase Tracking',
      sourceNodeId: videoNode.id,
      startSec: 7,
      durationSec: 7,
      thumbnailUrl: shot02Img,
      videoUrl: shot02Video,
      videoTheme: 'cyberpunk-rain',
      seed: 777,
      promptOrDialogue: videoNode.prompt,
      color: '#7C3AED',
    },
    {
      id: 'clip-v2',
      track: 'video',
      title: 'Shot 02B · Golden Dawn Remix',
      sourceNodeId: branchVideoNode.id,
      startSec: 14,
      durationSec: 7,
      thumbnailUrl: shot02bImg,
      videoUrl: shot02bVideo,
      videoTheme: 'sneaker-macro',
      seed: 909,
      promptOrDialogue: branchVideoNode.prompt,
      color: '#0EA5E9',
    },
    {
      id: 'clip-a1-voice',
      track: 'voice',
      title: '@Hero_Kael · Neural Lip-Sync VO',
      startSec: 1,
      durationSec: 12,
      promptOrDialogue:
        'Protocol Rain initiated. Every step rewrites the city grid — zero markup, zero limits.',
      lipSyncCharacter: '@Hero_Kael',
      audioFreqHz: 174,
      color: '#10B981',
    },
    {
      id: 'clip-a2-sfx-1',
      track: 'sfx',
      title: 'Rain Downpour + Sub-Bass Drone (Stereo)',
      startSec: 0,
      durationSec: 14,
      promptOrDialogue: 'Binaural rain on asphalt + 55Hz anamorphic sub-bass drone',
      sfxKind: 'rain-ambience',
      color: '#F59E0B',
    },
    {
      id: 'clip-a2-sfx-2',
      track: 'sfx',
      title: 'Golden Dawn Synth Swell + Riser',
      startSec: 14,
      durationSec: 7,
      promptOrDialogue: 'Warm harmonic sunrise synth swell + kinetic sneaker impact',
      sfxKind: 'sub-impact',
      color: '#F97316',
    },
  ];

  return {
    nodes: [styleNode, heroNode, gridNode, videoNode, branchVideoNode],
    edges,
    multiframes,
    bridges,
    timelineClips,
  };
}
