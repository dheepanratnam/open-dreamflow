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
  extractStyleDnaFromPrompt,
  getDimensionsForAspect,
  renderContactSheetDataUrl,
  renderElementAvatarDataUrl,
  renderShotDataUrl,
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
      textContent: 'NEO-TOKYO // 2099',
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
      'Synthesizes a coherent 3×3 cinema storyboard sheet and slices all 9 camera framings into linked spatial frames in 1 click.',
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
      'Keep @Hero_Kael choreography identical; shift environment to crimson midnight neon downpour with volumetric thunder flashes and wet reflections',
    recommendedMode: 'multi-turn',
    durationSec: 12,
  },
];

export function buildInitialElements(): ElementVault[] {
  const makeRefs = (prefix: string, accent: string, count = 6) =>
    Array.from({ length: count }, (_, idx) => ({
      id: `${prefix}_ref_${idx + 1}`,
      label: `${prefix} Angle ${idx + 1}`,
      dataUrl: renderElementAvatarDataUrl(`${prefix} angle ${idx + 1}`, accent, idx),
    }));

  return [
    {
      id: 'el-hero-kael',
      handle: '@Hero_Kael',
      name: 'Kael (Protagonist)',
      category: 'character',
      description: 'Cybernetic trench coat courier, cyan visor slit, locked facial & wardrobe continuity across shots.',
      accentColor: '#38BDF8',
      voiceProfile: 'Deep Baritone · Neural Lip-Sync Locked',
      references: makeRefs('Hero Kael', '#38BDF8', 6),
    },
    {
      id: 'el-cyber-sneaker',
      handle: '@Cyber_Sneaker',
      name: 'AeroFlux X-99 Sneaker',
      category: 'product',
      description: 'Sculpted translucent luminescence sole + matte carbon chassis (6-angle orthographic product lock).',
      accentColor: '#A855F7',
      references: makeRefs('Cyber Sneaker', '#A855F7', 6),
    },
    {
      id: 'el-brand-style',
      handle: '@Brand_Style',
      name: 'Neo-Tokyo Anamorphic LUT',
      category: 'style',
      description: 'Panavision 40mm T2.0 halation, wet asphalt speculars, teal/violet split-tone Kodak 500T.',
      accentColor: '#F43F5E',
      references: makeRefs('Brand Style', '#F43F5E', 6),
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
  const heroImg = renderShotDataUrl('16:9', {
    prompt: '@Hero_Kael standing in rain-soaked Neo-Tokyo street wearing @Cyber_Sneaker',
    seed: 204,
    palette: styleDna.palette,
    cameraLabel: 'SHOT 01 · 40mm ANAMORPHIC',
    hudBadge: 'KEYFRAME A',
  });

  const heroNode: CanvasNode = {
    id: 'node-shot-hero',
    kind: 'image',
    title: 'Shot 01 · Rooftop Establishing',
    prompt: '@Hero_Kael standing on rain-slicked Neo-Tokyo crosswalk wearing glowing @Cyber_Sneaker, @Brand_Style',
    x: 450,
    y: 80,
    width: heroDims.width,
    height: heroDims.height,
    aspectRatio: '16:9',
    status: 'ready',
    imageUrl: heroImg,
    seed: 204,
    resolution: '2K',
    interactionId: 'int_omni_a102f9',
    elementHandles: ['@Hero_Kael', '@Cyber_Sneaker', '@Brand_Style'],
    styleDnaId: styleNode.id,
    layers: createDefaultLayers(heroImg),
    providerUsed: 'Dreamina 2.0 Smart Canvas',
    createdAt: Date.now() - 30000,
  };

  const sheet = renderContactSheetDataUrl(
    3,
    3,
    '@Hero_Kael & @Cyber_Sneaker cyberpunk chase sequence',
    512,
    styleDna.palette
  );
  const gridNode: CanvasNode = {
    id: 'node-grid-9',
    kind: 'contact-sheet',
    title: '9-Grid Contact Sheet (Click ⊞ Slice!)',
    prompt: '/9-Grid Storyboard @Hero_Kael & @Cyber_Sneaker rain chase coverage across 9 cinema lenses',
    x: 450,
    y: 375,
    width: 360,
    height: 204,
    aspectRatio: '16:9',
    status: 'ready',
    imageUrl: sheet.dataUrl,
    seed: 512,
    resolution: '4K',
    interactionId: 'int_seedream_9grid',
    elementHandles: ['@Hero_Kael', '@Cyber_Sneaker'],
    styleDnaId: styleNode.id,
    gridSpec: { rows: 3, cols: 3, labels: sheet.labels },
    layers: createDefaultLayers(sheet.dataUrl),
    providerUsed: 'Seedream 3.0 · 9-Grid Engine',
    createdAt: Date.now() - 25000,
  };

  const omniThumb = renderShotDataUrl('16:9', {
    prompt: 'Unbroken 15s tracking shot of @Hero_Kael sprinting in @Cyber_Sneaker',
    seed: 777,
    palette: styleDna.palette,
    theme: 'cyberpunk-rain',
    cameraLabel: 'OMNI 1.2 FLASH · 15.0s',
  });
  const videoNode: CanvasNode = {
    id: 'node-video-omni-1',
    kind: 'video',
    title: 'Shot 02 · 15s Omni Tracking Shot',
    prompt: '15s Steadicam tracking @Hero_Kael sprinting across wet neon street, @Cyber_Sneaker sole glowing cyan',
    x: 900,
    y: 70,
    width: heroDims.width,
    height: heroDims.height,
    aspectRatio: '16:9',
    status: 'ready',
    imageUrl: omniThumb,
    videoTheme: 'cyberpunk-rain',
    seed: 777,
    resolution: '1080p',
    durationSec: 15,
    cameraMotion: 'Dolly Tracking 24fps',
    interactionId: 'int_omni_88c41d',
    elementHandles: ['@Hero_Kael', '@Cyber_Sneaker'],
    styleDnaId: styleNode.id,
    layers: createDefaultLayers(omniThumb),
    providerUsed: 'Gemini Omni 1.2 Flash ($0 BYOK)',
    createdAt: Date.now() - 18000,
  };

  const remixThumb = renderShotDataUrl('16:9', {
    prompt: 'Crimson night remix @Cyber_Sneaker macro',
    seed: 909,
    theme: 'sneaker-macro',
    cameraLabel: 'MULTI-TURN BRANCH · 10.0s',
  });
  const branchVideoNode: CanvasNode = {
    id: 'node-video-branch-2',
    kind: 'video',
    title: 'Shot 02B · Multi-Turn Macro Branch',
    prompt: 'Whip-pan down to 120fps slow-mo macro of @Cyber_Sneaker splashing crimson neon puddle, keep motion vector',
    x: 900,
    y: 375,
    width: heroDims.width,
    height: heroDims.height,
    aspectRatio: '16:9',
    status: 'ready',
    imageUrl: remixThumb,
    videoTheme: 'sneaker-macro',
    seed: 909,
    resolution: '4K',
    durationSec: 10,
    cameraMotion: 'Orbit 180° + 120fps Ramp',
    interactionId: 'int_omni_f319b0',
    previousInteractionId: 'int_omni_88c41d',
    elementHandles: ['@Cyber_Sneaker', '@Brand_Style'],
    styleDnaId: styleNode.id,
    layers: createDefaultLayers(remixThumb),
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

  const mf3Img = renderShotDataUrl('16:9', {
    prompt: 'FPV drone pull-back Neo-Tokyo skyline @Brand_Style',
    seed: 1205,
    theme: 'drone-canyon',
    cameraLabel: 'KEYFRAME C · SKYLINE CLIMAX',
  });

  const multiframes: MultiframeCard[] = [
    {
      id: 'mf-1',
      order: 0,
      title: 'KF 01 · Alley Standoff',
      prompt: heroNode.prompt,
      imageUrl: heroImg,
      sourceNodeId: heroNode.id,
      aspectRatio: '16:9',
    },
    {
      id: 'mf-2',
      order: 1,
      title: 'KF 02 · AeroFlux Sole Surge',
      prompt: branchVideoNode.prompt,
      imageUrl: remixThumb,
      sourceNodeId: branchVideoNode.id,
      aspectRatio: '16:9',
    },
    {
      id: 'mf-3',
      order: 2,
      title: 'KF 03 · Skyline Crane Reveal',
      prompt: 'High crane pull-back into glowing Neo-Tokyo megastructure horizon with @Hero_Kael on rooftop edge',
      imageUrl: mf3Img,
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
      transitionPrompt: 'Low-angle camera drops smoothly toward @Cyber_Sneaker kinetic sole',
      useTenSecContextWindow: true,
      firstLastKeyframeLock: true,
    },
    {
      id: 'bridge-2-3',
      fromCardId: 'mf-2',
      toCardId: 'mf-3',
      durationSec: 9,
      curve: 'Crane Up',
      transitionPrompt: 'Sweeping crane ascent from wet street reflection up into neon skyline',
      useTenSecContextWindow: true,
      firstLastKeyframeLock: true,
    },
  ];

  const timelineClips: TimelineClip[] = [
    {
      id: 'clip-v1',
      track: 'video',
      title: 'Shot 02 · 15s Omni Tracking',
      sourceNodeId: videoNode.id,
      startSec: 0,
      durationSec: 8,
      thumbnailUrl: omniThumb,
      videoTheme: 'cyberpunk-rain',
      seed: 777,
      promptOrDialogue: videoNode.prompt,
      color: '#7C3AED',
    },
    {
      id: 'clip-v2',
      track: 'video',
      title: 'Shot 02B · Sneaker Macro Branch',
      sourceNodeId: branchVideoNode.id,
      startSec: 8,
      durationSec: 7,
      thumbnailUrl: remixThumb,
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
      durationSec: 6.5,
      promptOrDialogue: 'Every step rewrites the city grid. Zero latency. Zero limits.',
      lipSyncCharacter: '@Hero_Kael',
      audioFreqHz: 174,
      color: '#10B981',
    },
    {
      id: 'clip-a2-sfx-1',
      track: 'sfx',
      title: 'Rain Downpour + Neon Hum (Native Audio)',
      startSec: 0,
      durationSec: 8,
      promptOrDialogue: 'Binaural rain on asphalt + 60Hz transformer hum',
      sfxKind: 'rain-ambience',
      color: '#F59E0B',
    },
    {
      id: 'clip-a2-sfx-2',
      track: 'sfx',
      title: 'Kinetic Sub-Bass Drop + Whoosh',
      startSec: 8,
      durationSec: 7,
      promptOrDialogue: 'Anamorphic whip-pan whoosh + sub-bass impact 40Hz',
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
