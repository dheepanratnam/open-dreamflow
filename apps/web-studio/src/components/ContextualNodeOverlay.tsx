import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Aperture,
  ArrowRight,
  ArrowUp,
  AtSign,
  AudioLines,
  Check,
  ChevronDown,
  Clapperboard,
  Clock,
  Compass,
  Film,
  GitBranch,
  Grid3X3,
  Image as ImageIcon,
  Layers,
  Loader2,
  Maximize,
  Maximize2,
  Mic,
  Minimize2,
  Move3d,
  Paintbrush,
  Palette,
  Play,
  Plus,
  RefreshCw,
  Scissors,
  SlidersHorizontal,
  Sparkles,
  Waves,
} from 'lucide-react';
import type {
  AspectRatio,
  KeyframeBridgeCurve,
  ProviderId,
  ResolutionTier,
} from '../types/studio';
import { useStudioStore, normalizeProviderId } from '../store/useStudioStore';
import { SmartMediaImage } from './SmartMedia';

const ENGINE_OPTIONS: Array<{
  id: ProviderId;
  label: string;
  shortLabel: string;
  costLabel: string;
  group: 'live-browser' | 'cloud-byok' | 'local';
}> = [
  {
    id: 'dreamina-bridge',
    label: 'Dreamina · Live Browser',
    shortLabel: 'Dreamina · Live Browser',
    costLabel: '$0.00',
    group: 'live-browser',
  },
  {
    id: 'flow-bridge',
    label: 'Google Flow · Live Browser',
    shortLabel: 'Google Flow · Live Browser',
    costLabel: '$0.00',
    group: 'live-browser',
  },
  {
    id: 'gemini-api',
    label: 'Google Gemini / Veo 3.1 API',
    shortLabel: 'Gemini / Veo 3.1 API',
    costLabel: '$0.04',
    group: 'cloud-byok',
  },
  {
    id: 'fal',
    label: 'Fal.ai · Flux / Wan Pro',
    shortLabel: 'Fal.ai · Wan Pro',
    costLabel: '$0.05',
    group: 'cloud-byok',
  },
  {
    id: 'replicate',
    label: 'Replicate · Flux / Video',
    shortLabel: 'Replicate · Flux',
    costLabel: '$0.05',
    group: 'cloud-byok',
  },
  {
    id: 'seedance',
    label: 'BytePlus · Seedream / Seedance',
    shortLabel: 'Seedream / Seedance',
    costLabel: '$0.05',
    group: 'cloud-byok',
  },
  {
    id: 'comfyui',
    label: 'ComfyUI · Local GPU (:8188)',
    shortLabel: 'ComfyUI · Local GPU',
    costLabel: '$0.00',
    group: 'local',
  },
  {
    id: 'ffmpeg-local',
    label: 'FFmpeg 8.0 · Local Camera',
    shortLabel: 'FFmpeg 8.0 · Local Camera',
    costLabel: '$0.00',
    group: 'local',
  },
];

const ASPECT_OPTIONS: AspectRatio[] = ['16:9', '9:16', '21:9', '1:1'];
const RES_OPTIONS: ResolutionTier[] = ['720p', '1080p', '2K', '4K'];
const DURATION_OPTIONS = [4, 6, 10, 15];
const AUDIO_DURATION_OPTIONS = [6, 12];

const BRIDGE_CURVE_OPTIONS: Array<{
  id: KeyframeBridgeCurve;
  label: string;
  svgPath: string;
}> = [
  {
    id: 'ease-in-out',
    label: 'Ease In-Out',
    svgPath: 'M 2 12 C 7 12, 9 2, 14 2',
  },
  {
    id: 'linear',
    label: 'Linear',
    svgPath: 'M 2 12 L 14 2',
  },
  {
    id: 'match-dissolve',
    label: 'Match Dissolve',
    svgPath: 'M 2 10 Q 8 7, 14 4',
  },
  {
    id: 'whip-pan',
    label: 'Whip Pan',
    svgPath: 'M 2 12 C 11 12, 12 2, 14 2',
  },
];

const LENS_STOCK_PRESETS = [
  '35mm Cooke S4/i · Kodak Vision3 250D',
  '50mm Leica Summilux · Portra 400 Daylight',
  '24mm Zeiss Master Prime · Alpine Crisp',
  '65mm ARRI Prime · Architectural Natural',
];

const MOTION_PRESETS = [
  { label: 'Dolly In', tag: 'measured 35mm dolly-in push toward subject' },
  { label: 'Orbit 180°', tag: '180-degree natural parallax camera orbit' },
  { label: 'Crane Up', tag: 'smooth vertical architectural crane reveal upward' },
  { label: 'Aerial Glide', tag: 'measured coastal aerial tracking glide' },
  { label: 'Whip Pan', tag: 'kinetic lateral whip-pan transition' },
  { label: 'Golden Hour Multi-Turn', tag: 'multi-turn shift to warm late-afternoon amber dusk' },
];

const CurveMiniIcon: React.FC<{ path: string }> = ({ path }) => (
  <svg width="16" height="14" viewBox="0 0 16 14" fill="none" className="shrink-0">
    <path
      d={path}
      stroke="#20D5EC"
      strokeWidth="1.6"
      strokeLinecap="round"
    />
  </svg>
);

export const ContextualNodeOverlay: React.FC = () => {
  const nodes = useStudioStore((s) => s.nodes);
  const edges = useStudioStore((s) => s.edges);
  const selectedNodeIds = useStudioStore((s) => s.selectedNodeIds);
  const panX = useStudioStore((s) => s.panX);
  const panY = useStudioStore((s) => s.panY);
  const zoom = useStudioStore((s) => s.zoom);

  const promptText = useStudioStore((s) => s.promptText);
  const promptMode = useStudioStore((s) => s.promptMode);
  const promptSubMode = useStudioStore((s) => s.promptSubMode);
  const promptAspect = useStudioStore((s) => s.promptAspect);
  const promptDurationSec = useStudioStore((s) => s.promptDurationSec);
  const promptResolution = useStudioStore((s) => s.promptResolution);
  const activeProvider = useStudioStore((s) => s.activeProvider);
  const byok = useStudioStore((s) => s.byok);
  const chromeBridge = useStudioStore((s) => s.chromeBridge);
  const bridgeWsConnected = useStudioStore((s) => s.bridgeWsConnected);
  const mcpHealth = useStudioStore((s) => s.mcpHealth);
  const elements = useStudioStore((s) => s.elements);
  const skills = useStudioStore((s) => s.skills);

  const setPromptText = useStudioStore((s) => s.setPromptText);
  const setPromptMode = useStudioStore((s) => s.setPromptMode);
  const setPromptSubMode = useStudioStore((s) => s.setPromptSubMode);
  const setPromptAspect = useStudioStore((s) => s.setPromptAspect);
  const setPromptDurationSec = useStudioStore((s) => s.setPromptDurationSec);
  const setPromptResolution = useStudioStore((s) => s.setPromptResolution);
  const setActiveProvider = useStudioStore((s) => s.setActiveProvider);
  const submitPromptGeneration = useStudioStore((s) => s.submitPromptGeneration);
  const applySkillPreset = useStudioStore((s) => s.applySkillPreset);
  const updateNodeFields = useStudioStore((s) => s.updateNodeFields);

  const openInlineEditor = useStudioStore((s) => s.openInlineEditor);
  const removeBgAndDecomposeLayers = useStudioStore((s) => s.removeBgAndDecomposeLayers);
  const upscaleNodeHd = useStudioStore((s) => s.upscaleNodeHd);
  const retakeNode = useStudioStore((s) => s.retakeNode);
  const sliceContactSheetNode = useStudioStore((s) => s.sliceContactSheetNode);
  const extractLastFrameToNextShot = useStudioStore((s) => s.extractLastFrameToNextShot);
  const convertImageToOmniVideo = useStudioStore((s) => s.convertImageToOmniVideo);
  const branchVideoMultiTurn = useStudioStore((s) => s.branchVideoMultiTurn);
  const generateKeyframeBridgeForNode = useStudioStore(
    (s) => s.generateKeyframeBridgeForNode
  );
  const generateAudioForNode = useStudioStore((s) => s.generateAudioForNode);
  const sendNodeToTimeline = useStudioStore((s) => s.sendNodeToTimeline);
  const executeMcpToolNode = useStudioStore((s) => s.executeMcpToolNode);
  const spawnStyleDnaNode = useStudioStore((s) => s.spawnStyleDnaNode);
  const setCameraDirectorOpen = useStudioStore((s) => s.setCameraDirectorOpen);
  const injectCameraPromptToSelection = useStudioStore((s) => s.injectCameraPromptToSelection);
  const openProviderModal = useStudioStore((s) => s.openProviderModal);

  const [viewport, setViewport] = useState({
    w: typeof window !== 'undefined' ? window.innerWidth : 1440,
    h: typeof window !== 'undefined' ? window.innerHeight : 900,
  });
  const [expandedPrompt, setExpandedPrompt] = useState(false);
  const [openMenu, setOpenMenu] = useState<
    | null
    | 'expand'
    | 'layers'
    | 'engine'
    | 'aspect'
    | 'submode'
    | 'duration'
    | 'elements'
    | 'skills'
    | 'palette'
    | 'style'
    | 'motion'
    | 'frame-a'
    | 'frame-b'
    | 'bridge-curve'
  >(null);

  const lastSyncedNodeId = useRef<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const onResize = () =>
      setViewport({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const selectedNode = useMemo(() => {
    if (selectedNodeIds.length !== 1) return null;
    return nodes.find((n) => n.id === selectedNodeIds[0]) || null;
  }, [nodes, selectedNodeIds]);

  const canvasImageNodes = useMemo(
    () =>
      nodes.filter(
        (n) =>
          (n.kind === 'image' || n.kind === 'element' || n.kind === 'contact-sheet') &&
          Boolean(n.imageUrl)
      ),
    [nodes]
  );

  const upstreamImageNodes = useMemo(() => {
    if (!selectedNode) return [];
    return edges
      .filter((e) => e.targetId === selectedNode.id)
      .map((e) => nodes.find((n) => n.id === e.sourceId))
      .filter(
        (n): n is NonNullable<typeof n> =>
          Boolean(n && (n.kind === 'image' || n.kind === 'element') && n.imageUrl)
      );
  }, [edges, nodes, selectedNode]);

  // Sync prompt bar cleanly when user selects a different node
  useEffect(() => {
    if (!selectedNode) {
      lastSyncedNodeId.current = null;
      setOpenMenu(null);
      return;
    }
    if (lastSyncedNodeId.current !== selectedNode.id) {
      lastSyncedNodeId.current = selectedNode.id;
      setPromptText(selectedNode.prompt || '');
      setPromptAspect(selectedNode.aspectRatio || '16:9');
      if (selectedNode.durationSec) {
        setPromptDurationSec(selectedNode.durationSec);
      }
      if (selectedNode.kind === 'video') {
        setPromptMode('video');
        if (selectedNode.bridgeMode || upstreamImageNodes.length >= 2) {
          setPromptSubMode('keyframe-bridge');
        } else {
          setPromptSubMode('omni-ref');
        }
      } else if (selectedNode.kind === 'contact-sheet') {
        setPromptMode('9-grid');
      } else {
        setPromptMode('image');
      }
      setOpenMenu(null);
    }
  }, [
    selectedNode,
    upstreamImageNodes.length,
    setPromptText,
    setPromptAspect,
    setPromptDurationSec,
    setPromptMode,
    setPromptSubMode,
  ]);

  if (!selectedNode || selectedNode.kind === 'timeline') {
    return null;
  }

  const isAudioNode = selectedNode.kind === 'audio';
  const isBridgeVideoActive =
    selectedNode.kind === 'video' &&
    (promptSubMode === 'keyframe-bridge' ||
      Boolean(selectedNode.bridgeMode) ||
      upstreamImageNodes.length >= 2);

  const activeStartImg =
    selectedNode.startImageUrl ||
    upstreamImageNodes[0]?.imageUrl ||
    canvasImageNodes[0]?.imageUrl ||
    '/media/real_courtyard_sun.jpg';

  const activeEndImg =
    selectedNode.endImageUrl ||
    upstreamImageNodes[1]?.imageUrl ||
    canvasImageNodes[1]?.imageUrl ||
    '/media/real_coastal_cliffs.jpg';

  const activeStartTitle =
    nodes.find((n) => n.id === selectedNode.startNodeId)?.title ||
    upstreamImageNodes[0]?.title ||
    canvasImageNodes.find((n) => n.imageUrl === activeStartImg)?.title ||
    'Frame A (Start)';

  const activeEndTitle =
    nodes.find((n) => n.id === selectedNode.endNodeId)?.title ||
    upstreamImageNodes[1]?.title ||
    canvasImageNodes.find((n) => n.imageUrl === activeEndImg)?.title ||
    'Frame B (End)';

  const activeBridgeCurve =
    BRIDGE_CURVE_OPTIONS.find((c) => c.id === (selectedNode.motionCurve || 'ease-in-out')) ||
    BRIDGE_CURVE_OPTIONS[0];

  const activeAudioMode = selectedNode.audioMode || 'ambient';

  const nodeLeft = panX + selectedNode.x * zoom;
  const nodeTop = panY + selectedNode.y * zoom;
  const nodeW = selectedNode.width * zoom;
  const nodeH = selectedNode.height * zoom;
  const nodeCenterX = nodeLeft + nodeW / 2;
  const nodeBottom = nodeTop + nodeH;

  const cardWidth = Math.min(648, Math.max(360, viewport.w - 96));
  const halfCard = cardWidth / 2;
  const clampedCenterX = Math.max(
    72 + halfCard,
    Math.min(viewport.w - 24 - halfCard, nodeCenterX)
  );

  // Top toolbar sits above the -24px node title header
  const topToolbarTop = Math.max(58, Math.min(viewport.h - 280, nodeTop - 64));

  // Bottom prompt stack sits 14px below node bottom, clamped cleanly inside viewport
  const extraHeight = isBridgeVideoActive || isAudioNode ? 54 : 0;
  const maxStackTop = Math.max(
    110,
    viewport.h - (expandedPrompt ? 260 + extraHeight : 204 + extraHeight)
  );
  const bottomStackTop = Math.max(104, Math.min(maxStackTop, nodeBottom + 14));

  const normalizedActiveProvider = normalizeProviderId(activeProvider);
  const activeEngine =
    ENGINE_OPTIONS.find((e) => e.id === normalizedActiveProvider) ||
    ENGINE_OPTIONS[ENGINE_OPTIONS.length - 1];

  const isEngineReady = (id: ProviderId): boolean => {
    switch (id) {
      case 'dreamina-bridge':
        return chromeBridge.dreaminaTabConnected || bridgeWsConnected;
      case 'flow-bridge':
        return chromeBridge.flowTabConnected || bridgeWsConnected;
      case 'gemini-api':
        return Boolean(byok.geminiApiKey?.trim());
      case 'fal':
        return Boolean(byok.falApiKey?.trim());
      case 'replicate':
        return Boolean(byok.replicateApiKey?.trim());
      case 'seedance':
        return Boolean(byok.seedanceApiKey?.trim());
      case 'comfyui':
        return Boolean(byok.comfyUiUrl?.trim());
      case 'ffmpeg-local':
      default:
        return mcpHealth.online || true;
    }
  };

  const handleInsertHandle = (handle: string) => {
    const base = promptText.trim();
    const next = base.includes(handle) ? base : `${base ? `${base} ` : ''}${handle} `;
    setPromptText(next);
    updateNodeFields(selectedNode.id, { prompt: next });
    setOpenMenu(null);
    textareaRef.current?.focus();
  };

  const handlePromptChange = (val: string) => {
    setPromptText(val);
    updateNodeFields(selectedNode.id, { prompt: val });
    if (val.endsWith('@')) {
      setOpenMenu('elements');
    } else if (val.endsWith('/')) {
      setOpenMenu('skills');
    } else if (openMenu === 'elements' || openMenu === 'skills') {
      const lastWord = val.split(/\s+/).pop() || '';
      if (!lastWord.startsWith('@') && !lastWord.startsWith('/')) {
        setOpenMenu(null);
      }
    }
  };

  const handleGenerate = () => {
    if (selectedNode.kind === 'mcp-tool') {
      void executeMcpToolNode(selectedNode.id);
      return;
    }
    if (isAudioNode) {
      void generateAudioForNode(selectedNode.id, {
        prompt: promptText,
        mode: activeAudioMode,
        durationSec: promptDurationSec,
      });
      return;
    }
    if (isBridgeVideoActive) {
      void generateKeyframeBridgeForNode(selectedNode.id, {
        startImageUrl: activeStartImg,
        endImageUrl: activeEndImg,
        startNodeId: selectedNode.startNodeId || upstreamImageNodes[0]?.id,
        endNodeId: selectedNode.endNodeId || upstreamImageNodes[1]?.id,
        motionCurve: activeBridgeCurve.id,
        durationSec: promptDurationSec,
        prompt: promptText,
      });
      return;
    }
    void submitPromptGeneration(selectedNode.id);
  };

  const isGenerating =
    selectedNode.status === 'generating' || Boolean(selectedNode.editBadge);

  return (
    <>
      {/* 1. Floating Quick-Action Toolbar Above Selected Node */}
      <div
        style={{
          left: `${clampedCenterX}px`,
          top: `${topToolbarTop}px`,
          transform: 'translateX(-50%)',
        }}
        onPointerDown={(e) => e.stopPropagation()}
        className="fixed z-30 h-[36px] px-1.5 rounded-[10px] dreamina-levitation flex items-center gap-0.5 select-none"
      >
        {isAudioNode ? (
          <>
            <button
              type="button"
              onClick={() => sendNodeToTimeline(selectedNode.id)}
              className="h-7 px-2.5 rounded-[7px] text-[12px] font-medium text-white/85 hover:text-white hover:bg-[#252525] flex items-center gap-1.5 transition-colors"
            >
              <Film className="w-3.5 h-3.5" strokeWidth={1.5} />
              <span>Send to Timeline (A1)</span>
            </button>
            <button
              type="button"
              onClick={() =>
                void generateAudioForNode(selectedNode.id, {
                  prompt: promptText,
                  mode: 'voiceover',
                  durationSec: 6,
                })
              }
              className="h-7 px-2.5 rounded-[7px] text-[12px] font-medium text-white/80 hover:text-white hover:bg-[#252525] flex items-center gap-1.5 transition-colors"
            >
              <Mic className="w-3.5 h-3.5" strokeWidth={1.5} />
              <span>Synthesize TTS</span>
            </button>
            <button
              type="button"
              onClick={() =>
                void generateAudioForNode(selectedNode.id, {
                  prompt: promptText,
                  mode: 'ambient',
                  durationSec: 12,
                })
              }
              className="h-7 px-2.5 rounded-[7px] text-[12px] font-medium text-white/80 hover:text-white hover:bg-[#252525] flex items-center gap-1.5 transition-colors"
            >
              <Waves className="w-3.5 h-3.5" strokeWidth={1.5} />
              <span>Ambient Foley</span>
            </button>
          </>
        ) : (
          <>
            {(selectedNode.kind === 'image' ||
              selectedNode.kind === 'contact-sheet' ||
              selectedNode.kind === 'element' ||
              selectedNode.kind === 'video') && (
              <>
                <button
                  type="button"
                  onClick={() => openInlineEditor('inpaint', selectedNode.id)}
                  className="h-7 px-2.5 rounded-[7px] text-[12px] font-medium text-white/80 hover:text-white hover:bg-[#252525] flex items-center gap-1.5 transition-colors"
                >
                  <Paintbrush className="w-3.5 h-3.5" strokeWidth={1.5} />
                  <span>Inpaint</span>
                </button>

                <button
                  type="button"
                  onClick={() => openInlineEditor('outpaint', selectedNode.id)}
                  className="h-7 px-2.5 rounded-[7px] text-[12px] font-medium text-white/80 hover:text-white hover:bg-[#252525] flex items-center gap-1.5 transition-colors"
                >
                  <Maximize className="w-3.5 h-3.5" strokeWidth={1.5} />
                  <span>Expand</span>
                </button>

                <button
                  type="button"
                  onClick={() => void removeBgAndDecomposeLayers(selectedNode.id)}
                  className="h-7 px-2.5 rounded-[7px] text-[12px] font-medium text-white/80 hover:text-white hover:bg-[#252525] flex items-center gap-1.5 transition-colors"
                >
                  <Scissors className="w-3.5 h-3.5" strokeWidth={1.5} />
                  <span>Remove BG</span>
                </button>

                <button
                  type="button"
                  onClick={() => void upscaleNodeHd(selectedNode.id, '4K')}
                  className="h-7 px-2.5 rounded-[7px] text-[12px] font-medium text-white/80 hover:text-white hover:bg-[#252525] flex items-center gap-1.5 transition-colors"
                >
                  <Sparkles className="w-3.5 h-3.5" strokeWidth={1.5} />
                  <span>Upscale 4K</span>
                </button>
              </>
            )}

            <button
              type="button"
              onClick={() => void sliceContactSheetNode(selectedNode.id, 3, 3)}
              className="h-7 px-2.5 rounded-[7px] text-[12px] font-medium text-white/80 hover:text-white hover:bg-[#252525] flex items-center gap-1.5 transition-colors"
            >
              <Grid3X3 className="w-3.5 h-3.5" strokeWidth={1.5} />
              <span>9-Grid Slice</span>
            </button>

            {selectedNode.kind === 'video' ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    updateNodeFields(selectedNode.id, { bridgeMode: true });
                    setPromptSubMode('keyframe-bridge');
                  }}
                  className={`h-7 px-2.5 rounded-[7px] text-[12px] font-medium flex items-center gap-1.5 transition-colors ${
                    isBridgeVideoActive
                      ? 'bg-[#252525] text-[#20D5EC]'
                      : 'text-white/80 hover:text-white hover:bg-[#252525]'
                  }`}
                >
                  <GitBranch className="w-3.5 h-3.5" strokeWidth={1.5} />
                  <span>A → B Bridge</span>
                </button>
                <button
                  type="button"
                  onClick={() => void extractLastFrameToNextShot(selectedNode.id)}
                  className="h-7 px-2.5 rounded-[7px] text-[12px] font-medium text-white/80 hover:text-white hover:bg-[#252525] flex items-center gap-1.5 transition-colors"
                >
                  <Layers className="w-3.5 h-3.5" strokeWidth={1.5} />
                  <span>Extract Frame</span>
                </button>
              </>
            ) : selectedNode.kind === 'mcp-tool' ? (
              <button
                type="button"
                onClick={() => void executeMcpToolNode(selectedNode.id)}
                className="h-7 px-2.5 rounded-[7px] text-[12px] font-medium bg-white text-[#0e0e0e] hover:bg-[#e5e5e5] flex items-center gap-1.5 transition-colors"
              >
                <Play className="w-3.5 h-3.5" strokeWidth={1.75} />
                <span>Run MCP</span>
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() =>
                    void convertImageToOmniVideo(selectedNode.id, promptDurationSec)
                  }
                  className="h-7 px-2.5 rounded-[7px] text-[12px] font-medium text-white/80 hover:text-white hover:bg-[#252525] flex items-center gap-1.5 transition-colors"
                >
                  <Film className="w-3.5 h-3.5" strokeWidth={1.5} />
                  <span>Image → Video</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    void generateKeyframeBridgeForNode(selectedNode.id, {
                      startImageUrl: selectedNode.imageUrl,
                      startNodeId: selectedNode.id,
                      motionCurve: 'ease-in-out',
                      durationSec: 6,
                    })
                  }
                  className="h-7 px-2.5 rounded-[7px] text-[12px] font-medium text-white/80 hover:text-white hover:bg-[#252525] flex items-center gap-1.5 transition-colors"
                >
                  <GitBranch className="w-3.5 h-3.5" strokeWidth={1.5} />
                  <span>A → B Bridge</span>
                </button>
              </>
            )}

            <button
              type="button"
              onClick={() => void retakeNode(selectedNode.id)}
              className="h-7 px-2.5 rounded-[7px] text-[12px] font-medium text-white/80 hover:text-white hover:bg-[#252525] flex items-center gap-1.5 transition-colors"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${isGenerating ? 'animate-spin' : ''}`}
                strokeWidth={1.5}
              />
              <span>Retake</span>
            </button>
          </>
        )}
      </div>

      {/* 2. Contextual Cinema Kit Pill + 648px Dreamina Prompt Popover Below Selected Node */}
      <div
        style={{
          left: `${clampedCenterX}px`,
          top: `${bottomStackTop}px`,
          width: `${cardWidth}px`,
          transform: 'translateX(-50%)',
        }}
        onPointerDown={(e) => e.stopPropagation()}
        className="fixed z-30 flex flex-col items-center gap-2 select-none"
      >
        {/* Cinema Kit Sub-Toolbar Pill (32px) — hidden on Audio nodes to keep acoustic mode crisp */}
        {!isAudioNode && (
          <div className="h-[32px] px-2 rounded-full dreamina-levitation flex items-center gap-1 relative">
            <button
              type="button"
              onClick={() => setCameraDirectorOpen(true)}
              className="h-6 px-2.5 rounded-full text-[11.5px] text-white/80 hover:text-white hover:bg-[#252525] flex items-center gap-1.5 transition-colors"
            >
              <Compass className="w-3.5 h-3.5 text-white/65" strokeWidth={1.5} />
              <span>Camera</span>
            </button>

            <div className="w-px h-3 bg-white/[0.08]" />

            <div className="relative">
              <button
                type="button"
                onClick={() =>
                  setOpenMenu(openMenu === 'palette' ? null : 'palette')
                }
                className="h-6 px-2.5 rounded-full text-[11.5px] text-white/80 hover:text-white hover:bg-[#252525] flex items-center gap-1.5 transition-colors"
              >
                <Palette className="w-3.5 h-3.5 text-white/65" strokeWidth={1.5} />
                <span>Color</span>
              </button>
              {openMenu === 'palette' && (
                <div className="absolute left-0 bottom-[36px] w-[224px] p-2.5 rounded-[12px] dreamina-menu z-40 space-y-2">
                  <div className="text-[11px] text-white/50 font-medium">
                    Style DNA Color Grade
                  </div>
                  <div className="flex items-center gap-1.5">
                    {['#2b343b', '#6b7f8c', '#c87d55', '#e2c49f', '#f5efe6'].map(
                      (hex) => (
                        <div
                          key={hex}
                          style={{ backgroundColor: hex }}
                          className="w-6 h-6 rounded-[6px] border border-white/20"
                        />
                      )
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      spawnStyleDnaNode(selectedNode.id);
                      setOpenMenu(null);
                    }}
                    className="w-full h-7 rounded-[7px] bg-[#252525] hover:bg-[#303030] text-[11.5px] text-white/90 font-medium"
                  >
                    Extract Style DNA Node
                  </button>
                </div>
              )}
            </div>

            <div className="w-px h-3 bg-white/[0.08]" />

            <div className="relative">
              <button
                type="button"
                onClick={() => setOpenMenu(openMenu === 'style' ? null : 'style')}
                className="h-6 px-2.5 rounded-full text-[11.5px] text-white/80 hover:text-white hover:bg-[#252525] flex items-center gap-1.5 transition-colors"
              >
                <Aperture className="w-3.5 h-3.5 text-white/65" strokeWidth={1.5} />
                <span>Style</span>
              </button>
              {openMenu === 'style' && (
                <div className="absolute left-0 bottom-[36px] w-[256px] p-1 rounded-[12px] dreamina-menu z-40">
                  {LENS_STOCK_PRESETS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => {
                        injectCameraPromptToSelection(preset);
                        setOpenMenu(null);
                      }}
                      className="w-full h-7 px-2.5 rounded-[7px] text-left text-[12px] text-white/85 hover:bg-white/[0.08] truncate"
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="w-px h-3 bg-white/[0.08]" />

            <div className="relative">
              <button
                type="button"
                onClick={() =>
                  setOpenMenu(openMenu === 'motion' ? null : 'motion')
                }
                className="h-6 px-2.5 rounded-full text-[11.5px] text-white/80 hover:text-white hover:bg-[#252525] flex items-center gap-1.5 transition-colors"
              >
                <Move3d className="w-3.5 h-3.5 text-white/65" strokeWidth={1.5} />
                <span>Motion +</span>
              </button>
              {openMenu === 'motion' && (
                <div className="absolute right-0 bottom-[36px] w-[216px] p-1 rounded-[12px] dreamina-menu z-40">
                  {MOTION_PRESETS.map((m) => (
                    <button
                      key={m.label}
                      type="button"
                      onClick={() => {
                        if (
                          m.label === 'Golden Hour Multi-Turn' &&
                          selectedNode.kind === 'video'
                        ) {
                          void branchVideoMultiTurn(
                            selectedNode.id,
                            'Shift midday courtyard sun to warm late-afternoon amber dusk'
                          );
                        } else {
                          injectCameraPromptToSelection(m.tag);
                        }
                        setOpenMenu(null);
                      }}
                      className="w-full h-7 px-2.5 rounded-[7px] text-left text-[12px] text-white/85 hover:bg-white/[0.08]"
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Main 648px Dreamina Contextual Prompt Popover Card */}
        <div className="w-full rounded-[16px] bg-[#191919]/95 backdrop-blur-xl border border-white/[0.1] shadow-[0_24px_64px_rgba(0,0,0,0.75)] p-3 flex flex-col gap-2.5 relative">
          {/* Stage 5 Feature A: First-Frame → Last-Frame Keyframe Bridge Strip */}
          {isBridgeVideoActive && (
            <div className="px-2.5 py-2 rounded-[10px] bg-[#141414] border border-white/[0.08] flex items-center justify-between gap-2 relative">
              {/* Frame A (Start) Picker */}
              <div className="relative flex-1 min-w-0">
                <button
                  type="button"
                  onClick={() =>
                    setOpenMenu(openMenu === 'frame-a' ? null : 'frame-a')
                  }
                  className="w-full h-9 px-2 rounded-[8px] bg-[#222222] hover:bg-[#2a2a2a] border border-white/[0.08] flex items-center gap-2 text-left transition-colors"
                >
                  <div className="w-6 h-6 rounded-[5px] overflow-hidden bg-[#191919] shrink-0 border border-white/[0.12]">
                    <SmartMediaImage
                      src={activeStartImg}
                      alt="Frame A"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[10px] font-mono text-white/45 leading-none">
                      FRAME A · FIRST
                    </div>
                    <div className="text-[11.5px] font-medium text-white/90 truncate mt-0.5">
                      {activeStartTitle}
                    </div>
                  </div>
                  <ChevronDown
                    className="w-3 h-3 text-white/45 shrink-0"
                    strokeWidth={1.5}
                  />
                </button>

                {openMenu === 'frame-a' && (
                  <div className="absolute left-0 bottom-[42px] w-[240px] max-h-[220px] overflow-y-auto p-1 rounded-[12px] dreamina-menu z-50 space-y-0.5">
                    <div className="px-2 py-1 text-[10.5px] text-white/45 font-medium">
                      Select First Frame (A)
                    </div>
                    {canvasImageNodes.map((imgNode) => (
                      <button
                        key={imgNode.id}
                        type="button"
                        onClick={() => {
                          updateNodeFields(selectedNode.id, {
                            bridgeMode: true,
                            startNodeId: imgNode.id,
                            startImageUrl: imgNode.imageUrl,
                          });
                          setOpenMenu(null);
                        }}
                        className="w-full p-1.5 rounded-[8px] hover:bg-white/[0.08] flex items-center gap-2 text-left"
                      >
                        <div className="w-7 h-7 rounded-[5px] overflow-hidden bg-[#252525] shrink-0">
                          <SmartMediaImage
                            src={imgNode.imageUrl}
                            alt={imgNode.title}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <span className="text-[11.5px] text-white/90 truncate">
                          {imgNode.title}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <ArrowRight
                className="w-3.5 h-3.5 text-white/35 shrink-0"
                strokeWidth={1.5}
              />

              {/* Motion Curve Picker */}
              <div className="relative shrink-0">
                <button
                  type="button"
                  onClick={() =>
                    setOpenMenu(
                      openMenu === 'bridge-curve' ? null : 'bridge-curve'
                    )
                  }
                  className="h-9 px-2.5 rounded-[8px] bg-[#222222] hover:bg-[#2a2a2a] border border-white/[0.08] flex items-center gap-1.5 text-[11.5px] text-white/90 transition-colors"
                >
                  <CurveMiniIcon path={activeBridgeCurve.svgPath} />
                  <span>{activeBridgeCurve.label}</span>
                  <ChevronDown
                    className="w-3 h-3 text-white/45"
                    strokeWidth={1.5}
                  />
                </button>

                {openMenu === 'bridge-curve' && (
                  <div className="absolute left-1/2 -translate-x-1/2 bottom-[42px] w-[184px] p-1 rounded-[12px] dreamina-menu z-50 space-y-0.5">
                    <div className="px-2 py-1 text-[10.5px] text-white/45 font-medium">
                      Optical Motion Curve
                    </div>
                    {BRIDGE_CURVE_OPTIONS.map((curve) => (
                      <button
                        key={curve.id}
                        type="button"
                        onClick={() => {
                          updateNodeFields(selectedNode.id, {
                            bridgeMode: true,
                            motionCurve: curve.id,
                          });
                          setOpenMenu(null);
                        }}
                        className="w-full h-7 px-2 rounded-[7px] hover:bg-white/[0.08] flex items-center justify-between text-[12px] text-white/90"
                      >
                        <span className="flex items-center gap-2">
                          <CurveMiniIcon path={curve.svgPath} />
                          <span>{curve.label}</span>
                        </span>
                        {activeBridgeCurve.id === curve.id && (
                          <Check className="w-3 h-3 text-[#20D5EC]" strokeWidth={1.75} />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <ArrowRight
                className="w-3.5 h-3.5 text-white/35 shrink-0"
                strokeWidth={1.5}
              />

              {/* Frame B (End) Picker */}
              <div className="relative flex-1 min-w-0">
                <button
                  type="button"
                  onClick={() =>
                    setOpenMenu(openMenu === 'frame-b' ? null : 'frame-b')
                  }
                  className="w-full h-9 px-2 rounded-[8px] bg-[#222222] hover:bg-[#2a2a2a] border border-white/[0.08] flex items-center gap-2 text-left transition-colors"
                >
                  <div className="w-6 h-6 rounded-[5px] overflow-hidden bg-[#191919] shrink-0 border border-white/[0.12]">
                    <SmartMediaImage
                      src={activeEndImg}
                      alt="Frame B"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[10px] font-mono text-white/45 leading-none">
                      FRAME B · LAST
                    </div>
                    <div className="text-[11.5px] font-medium text-white/90 truncate mt-0.5">
                      {activeEndTitle}
                    </div>
                  </div>
                  <ChevronDown
                    className="w-3 h-3 text-white/45 shrink-0"
                    strokeWidth={1.5}
                  />
                </button>

                {openMenu === 'frame-b' && (
                  <div className="absolute right-0 bottom-[42px] w-[240px] max-h-[220px] overflow-y-auto p-1 rounded-[12px] dreamina-menu z-50 space-y-0.5">
                    <div className="px-2 py-1 text-[10.5px] text-white/45 font-medium">
                      Select Last Frame (B)
                    </div>
                    {canvasImageNodes.map((imgNode) => (
                      <button
                        key={imgNode.id}
                        type="button"
                        onClick={() => {
                          updateNodeFields(selectedNode.id, {
                            bridgeMode: true,
                            endNodeId: imgNode.id,
                            endImageUrl: imgNode.imageUrl,
                          });
                          setOpenMenu(null);
                        }}
                        className="w-full p-1.5 rounded-[8px] hover:bg-white/[0.08] flex items-center gap-2 text-left"
                      >
                        <div className="w-7 h-7 rounded-[5px] overflow-hidden bg-[#252525] shrink-0">
                          <SmartMediaImage
                            src={imgNode.imageUrl}
                            alt={imgNode.title}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <span className="text-[11.5px] text-white/90 truncate">
                          {imgNode.title}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Stage 5 Feature B: Audio / Voiceover Synthesis Mode Strip */}
          {isAudioNode && (
            <div className="px-2.5 py-1.5 rounded-[10px] bg-[#141414] border border-white/[0.08] flex items-center justify-between gap-2">
              <div className="flex items-center gap-1">
                {(
                  [
                    { id: 'ambient', label: 'Ambient Soundscape', icon: Waves },
                    { id: 'voiceover', label: 'Spoken Voiceover (TTS)', icon: Mic },
                    { id: 'sfx', label: 'Foley SFX', icon: AudioLines },
                  ] as const
                ).map((m) => {
                  const Icon = m.icon;
                  const active = activeAudioMode === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() =>
                        updateNodeFields(selectedNode.id, { audioMode: m.id })
                      }
                      className={`h-7 px-2.5 rounded-[7px] text-[11.5px] font-medium flex items-center gap-1.5 transition-colors ${
                        active
                          ? 'bg-white text-[#0e0e0e]'
                          : 'text-white/70 hover:text-white hover:bg-[#252525]'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" strokeWidth={1.6} />
                      <span>{m.label}</span>
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-1">
                {AUDIO_DURATION_OPTIONS.map((sec) => (
                  <button
                    key={sec}
                    type="button"
                    onClick={() => {
                      setPromptDurationSec(sec);
                      updateNodeFields(selectedNode.id, { durationSec: sec });
                    }}
                    className={`h-7 px-2 rounded-[7px] font-mono text-[11px] transition-colors ${
                      (selectedNode.durationSec || promptDurationSec) === sec
                        ? 'bg-[#252525] text-[#20D5EC] border border-[#20D5EC]/40'
                        : 'bg-[#1e1e1e] text-white/60 hover:text-white'
                    }`}
                  >
                    {sec}s
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* @Elements Autocomplete Popover */}
          {openMenu === 'elements' && (
            <div className="absolute left-3 bottom-[calc(100%+8px)] w-[320px] p-2 rounded-[12px] dreamina-menu z-50 space-y-1">
              <div className="px-2 py-1 text-[11px] font-medium text-white/45 flex items-center justify-between">
                <span>@Elements Subject & Style Vault</span>
                <span>Lock Identity</span>
              </div>
              {elements.map((el) => (
                <button
                  key={el.id}
                  type="button"
                  onClick={() => handleInsertHandle(el.handle)}
                  className="w-full p-1.5 rounded-[8px] hover:bg-white/[0.08] flex items-center gap-2.5 text-left transition-colors"
                >
                  <div className="w-9 h-9 rounded-[6px] overflow-hidden bg-[#252525] border border-white/[0.1] shrink-0">
                    <SmartMediaImage
                      src={el.references[0]?.dataUrl}
                      alt={el.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[12px] font-medium text-white/95 truncate">
                      {el.handle}
                    </div>
                    <div className="text-[11px] text-white/45 truncate">
                      {el.description}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* /Skills Autocomplete Popover */}
          {openMenu === 'skills' && (
            <div className="absolute left-3 bottom-[calc(100%+8px)] w-[356px] max-h-[260px] overflow-y-auto p-1.5 rounded-[12px] dreamina-menu z-50 space-y-0.5">
              <div className="px-2 py-1 text-[11px] font-medium text-white/45">
                Dreamina Camera & Storyboard Skills
              </div>
              {skills.map((sk) => (
                <button
                  key={sk.id}
                  type="button"
                  onClick={() => {
                    applySkillPreset(sk);
                    updateNodeFields(selectedNode.id, {
                      prompt: sk.promptTemplate,
                    });
                    setOpenMenu(null);
                  }}
                  className="w-full px-2.5 py-1.5 rounded-[8px] hover:bg-white/[0.08] text-left flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <div className="text-[12px] font-medium text-white/90 truncate">
                      {sk.slash} · {sk.title}
                    </div>
                    <div className="text-[11px] text-white/45 truncate">
                      {sk.description}
                    </div>
                  </div>
                  <span className="px-1.5 py-0.5 rounded-[5px] bg-[#252525] text-[10px] text-white/65 shrink-0">
                    {sk.badge}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Top Row: [+] Reference Thumbnail + Borderless Textarea + [⤢] Expand */}
          <div className="flex items-start gap-2.5">
            <button
              type="button"
              onClick={() =>
                setOpenMenu(openMenu === 'elements' ? null : 'elements')
              }
              title="Attach @Element or reference frame"
              className="w-9 h-9 rounded-[10px] bg-[#252525] hover:bg-[#2e2e2e] border border-white/[0.08] flex items-center justify-center text-white/70 hover:text-white shrink-0 transition-colors overflow-hidden"
            >
              {isAudioNode ? (
                <AudioLines className="w-4 h-4 text-[#20D5EC]" strokeWidth={1.5} />
              ) : selectedNode.imageUrl ? (
                <SmartMediaImage
                  src={selectedNode.imageUrl}
                  alt={selectedNode.title}
                  className="w-full h-full object-cover opacity-85"
                />
              ) : (
                <Plus className="w-4 h-4" strokeWidth={1.5} />
              )}
            </button>

            <textarea
              ref={textareaRef}
              value={promptText}
              onChange={(e) => handlePromptChange(e.target.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                  e.preventDefault();
                  handleGenerate();
                }
              }}
              rows={expandedPrompt ? 5 : 2}
              placeholder={
                isAudioNode
                  ? activeAudioMode === 'voiceover'
                    ? 'Enter spoken narration script for macOS TTS voiceover synthesis...'
                    : 'Describe natural acoustic foley, coastal wind, or room tone...'
                  : 'Describe your shot in natural light, or use @ for elements, / for camera skills'
              }
              className="flex-1 bg-transparent border-0 outline-none resize-none text-[13.5px] leading-[1.45] text-[#f5f5f5] placeholder:text-white/35 py-0.5"
            />

            <button
              type="button"
              onClick={() => setExpandedPrompt(!expandedPrompt)}
              title={expandedPrompt ? 'Collapse prompt' : 'Expand prompt'}
              className="w-7 h-7 rounded-[7px] hover:bg-[#252525] flex items-center justify-center text-white/50 hover:text-white/85 shrink-0 transition-colors"
            >
              {expandedPrompt ? (
                <Minimize2 className="w-3.5 h-3.5" strokeWidth={1.5} />
              ) : (
                <Maximize2 className="w-3.5 h-3.5" strokeWidth={1.5} />
              )}
            </button>
          </div>

          {/* Bottom Parameter Pill Bar */}
          <div className="flex items-center justify-between gap-2 pt-0.5">
            {isAudioNode ? (
              <div className="flex items-center gap-1.5">
                <span className="h-7 px-2.5 rounded-[8px] bg-[#252525] text-[12px] text-white/80 flex items-center gap-1.5">
                  <AudioLines className="w-3.5 h-3.5 text-[#20D5EC]" strokeWidth={1.5} />
                  <span>
                    {activeAudioMode === 'voiceover'
                      ? 'macOS TTS + FFmpeg'
                      : 'FFmpeg Stereo Acoustic'}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => sendNodeToTimeline(selectedNode.id)}
                  className="h-7 px-2.5 rounded-[8px] bg-[#252525] hover:bg-[#2e2e2e] text-[12px] text-white/85 flex items-center gap-1.5 transition-colors"
                >
                  <Plus className="w-3 h-3" strokeWidth={1.5} />
                  <span>Attach to A1 Lane</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 flex-wrap">
                {/* Engine Selector Pill */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() =>
                      setOpenMenu(openMenu === 'engine' ? null : 'engine')
                    }
                    className="h-7 px-2.5 rounded-[8px] bg-[#252525] hover:bg-[#2e2e2e] text-[12px] text-white/85 flex items-center gap-1.5 transition-colors"
                  >
                    {promptMode === 'video' ? (
                      <Clapperboard
                        className="w-3.5 h-3.5 text-white/70"
                        strokeWidth={1.5}
                      />
                    ) : (
                      <ImageIcon
                        className="w-3.5 h-3.5 text-white/70"
                        strokeWidth={1.5}
                      />
                    )}
                    <span>{activeEngine.shortLabel}</span>
                    <ChevronDown
                      className="w-3 h-3 text-white/45"
                      strokeWidth={1.5}
                    />
                  </button>
                  {openMenu === 'engine' && (
                    <div className="absolute left-0 bottom-[34px] w-[288px] p-1.5 rounded-[12px] dreamina-menu z-50">
                      <div className="px-2 py-1 text-[10.5px] text-white/40 font-medium flex items-center justify-between">
                        <span>Output Mode</span>
                        <span className="font-mono text-[10px] text-white/35">
                          Zero-Fallback Execution
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-1 p-1 mb-1.5 bg-[#141414] rounded-[8px]">
                        {(
                          [
                            { id: 'video', label: 'Video' },
                            { id: 'image', label: 'Image' },
                            { id: '9-grid', label: '9-Grid' },
                          ] as const
                        ).map((m) => (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => setPromptMode(m.id)}
                            className={`h-6 rounded-[6px] text-[11px] font-medium transition-colors ${
                              promptMode === m.id
                                ? 'bg-[#2e2e2e] text-white'
                                : 'text-white/55 hover:text-white/85'
                            }`}
                          >
                            {m.label}
                          </button>
                        ))}
                      </div>
                      <div className="space-y-0.5">
                        {ENGINE_OPTIONS.map((eng) => {
                          const selected = normalizedActiveProvider === eng.id;
                          const ready = isEngineReady(eng.id);
                          return (
                            <button
                              key={eng.id}
                              type="button"
                              onClick={() => {
                                setActiveProvider(eng.id);
                                setOpenMenu(null);
                              }}
                              className={`w-full h-7 px-2 rounded-[7px] text-[12px] flex items-center justify-between gap-2 transition-colors ${
                                selected
                                  ? 'bg-white/[0.1] text-white font-medium'
                                  : 'text-white/85 hover:bg-white/[0.07]'
                              }`}
                            >
                              <span className="flex items-center gap-2 truncate">
                                <span
                                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                    ready ? 'bg-[#10b981]' : 'bg-white/25'
                                  }`}
                                />
                                <span className="truncate">{eng.label}</span>
                              </span>
                              <span className="font-mono text-[10.5px] text-white/45 shrink-0 flex items-center gap-1">
                                <span>{eng.costLabel}</span>
                                {selected && (
                                  <Check className="w-3 h-3 text-[#20D5EC]" strokeWidth={1.75} />
                                )}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                      <div className="mt-1.5 pt-1.5 border-t border-white/[0.07]">
                        <button
                          type="button"
                          onClick={() => {
                            setOpenMenu(null);
                            openProviderModal(
                              normalizedActiveProvider === 'dreamina-bridge' ||
                                normalizedActiveProvider === 'flow-bridge'
                                ? 'bridge'
                                : 'byok',
                              normalizedActiveProvider === 'gemini-api' ? 'gemini' : null
                            );
                          }}
                          className="w-full h-7 px-2 rounded-[7px] bg-[#222222] hover:bg-[#2c2c2c] text-[11px] text-white/80 hover:text-white flex items-center justify-between transition-colors"
                        >
                          <span>Configure API Keys & Browser Bridge…</span>
                          <ArrowRight className="w-3 h-3 text-white/50" strokeWidth={1.5} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Aspect Ratio & Resolution Pill */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() =>
                      setOpenMenu(openMenu === 'aspect' ? null : 'aspect')
                    }
                    className="h-7 px-2.5 rounded-[8px] bg-[#252525] hover:bg-[#2e2e2e] text-[12px] text-white/85 flex items-center gap-1.5 transition-colors"
                  >
                    <span>
                      {promptAspect} · {promptResolution}
                    </span>
                  </button>
                  {openMenu === 'aspect' && (
                    <div className="absolute left-0 bottom-[34px] w-[200px] p-2 rounded-[12px] dreamina-menu z-50 space-y-2">
                      <div>
                        <div className="text-[11px] text-white/45 mb-1">
                          Aspect Ratio
                        </div>
                        <div className="grid grid-cols-4 gap-1">
                          {ASPECT_OPTIONS.map((ar) => (
                            <button
                              key={ar}
                              type="button"
                              onClick={() => setPromptAspect(ar)}
                              className={`h-6 rounded-[6px] text-[11px] ${
                                promptAspect === ar
                                  ? 'bg-white text-[#0e0e0e] font-semibold'
                                  : 'bg-[#252525] text-white/75 hover:bg-[#303030]'
                              }`}
                            >
                              {ar}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] text-white/45 mb-1">
                          Resolution
                        </div>
                        <div className="grid grid-cols-4 gap-1">
                          {RES_OPTIONS.map((res) => (
                            <button
                              key={res}
                              type="button"
                              onClick={() => {
                                setPromptResolution(res);
                                setOpenMenu(null);
                              }}
                              className={`h-6 rounded-[6px] text-[11px] ${
                                promptResolution === res
                                  ? 'bg-white text-[#0e0e0e] font-semibold'
                                  : 'bg-[#252525] text-white/75 hover:bg-[#303030]'
                              }`}
                            >
                              {res}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Sub-mode Pill: Omni reference / First-Last frame / Multi-turn */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() =>
                      setOpenMenu(openMenu === 'submode' ? null : 'submode')
                    }
                    className="h-7 px-2.5 rounded-[8px] bg-[#252525] hover:bg-[#2e2e2e] text-[12px] text-white/85 flex items-center gap-1.5 transition-colors"
                  >
                    <SlidersHorizontal
                      className="w-3 h-3 text-white/60"
                      strokeWidth={1.5}
                    />
                    <span>
                      {isBridgeVideoActive || promptSubMode === 'keyframe-bridge'
                        ? 'First/Last frame'
                        : promptSubMode === 'omni-ref'
                        ? 'Omni reference'
                        : 'Multi-turn'}
                    </span>
                    <ChevronDown
                      className="w-3 h-3 text-white/45"
                      strokeWidth={1.5}
                    />
                  </button>
                  {openMenu === 'submode' && (
                    <div className="absolute left-0 bottom-[34px] w-[176px] p-1 rounded-[12px] dreamina-menu z-50">
                      {(
                        [
                          { id: 'omni-ref', label: 'Omni reference' },
                          { id: 'keyframe-bridge', label: 'First/Last frame' },
                          { id: 'multi-turn', label: 'Multi-turn edit' },
                        ] as const
                      ).map((sm) => (
                        <button
                          key={sm.id}
                          type="button"
                          onClick={() => {
                            setPromptSubMode(sm.id);
                            if (selectedNode.kind === 'video') {
                              updateNodeFields(selectedNode.id, {
                                bridgeMode: sm.id === 'keyframe-bridge',
                              });
                            }
                            if (sm.id === 'multi-turn') {
                              setPromptMode('multi-turn');
                            }
                            setOpenMenu(null);
                          }}
                          className="w-full h-7 px-2.5 rounded-[7px] text-left text-[12px] text-white/85 hover:bg-white/[0.08] flex items-center justify-between"
                        >
                          <span>{sm.label}</span>
                          {promptSubMode === sm.id && (
                            <Check
                              className="w-3 h-3 text-white/75"
                              strokeWidth={1.75}
                            />
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Duration Pill */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() =>
                      setOpenMenu(openMenu === 'duration' ? null : 'duration')
                    }
                    className="h-7 px-2.5 rounded-[8px] bg-[#252525] hover:bg-[#2e2e2e] text-[12px] text-white/85 flex items-center gap-1 transition-colors"
                  >
                    <Clock className="w-3 h-3 text-white/60" strokeWidth={1.5} />
                    <span>{promptDurationSec}s</span>
                  </button>
                  {openMenu === 'duration' && (
                    <div className="absolute left-0 bottom-[34px] w-[104px] p-1 rounded-[10px] dreamina-menu z-50">
                      {DURATION_OPTIONS.map((sec) => (
                        <button
                          key={sec}
                          type="button"
                          onClick={() => {
                            setPromptDurationSec(sec);
                            setOpenMenu(null);
                          }}
                          className="w-full h-7 px-2.5 rounded-[6px] text-left text-[12px] text-white/85 hover:bg-white/[0.08] flex items-center justify-between"
                        >
                          <span>{sec}s</span>
                          {promptDurationSec === sec && (
                            <Check
                              className="w-3 h-3 text-white/75"
                              strokeWidth={1.75}
                            />
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* @ Mention Quick Trigger */}
                <button
                  type="button"
                  onClick={() =>
                    setOpenMenu(openMenu === 'elements' ? null : 'elements')
                  }
                  title="Insert @Element reference"
                  className="w-7 h-7 rounded-[8px] bg-[#252525] hover:bg-[#2e2e2e] text-white/75 hover:text-white flex items-center justify-center transition-colors"
                >
                  <AtSign className="w-3.5 h-3.5" strokeWidth={1.5} />
                </button>
              </div>
            )}

            {/* Right: Zero-Markup Pass-Through Badge + Circular White [↑] Generate CTA */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => openProviderModal('byok')}
                title="Zero-Markup BYOK / Local FFmpeg Cost"
                className="h-7 px-2 rounded-[8px] hover:bg-[#252525] text-[11.5px] font-mono text-white/65 hover:text-white/90 flex items-center gap-1 transition-colors"
              >
                <Sparkles
                  className="w-3 h-3 text-[#face15]"
                  strokeWidth={1.75}
                />
                <span>{isAudioNode ? '$0.00' : activeEngine.costLabel}</span>
              </button>

              <button
                type="button"
                disabled={isGenerating}
                onClick={handleGenerate}
                title={
                  isAudioNode
                    ? 'Synthesize Audio (⌘ + Enter)'
                    : isBridgeVideoActive
                    ? 'Render A → B Keyframe Bridge (⌘ + Enter)'
                    : 'Generate (⌘ + Enter)'
                }
                className="w-8 h-8 rounded-full bg-white hover:bg-[#e5e5e5] text-[#0e0e0e] flex items-center justify-center shadow-[0_4px_14px_rgba(255,255,255,0.2)] transition-all disabled:opacity-60"
              >
                {isGenerating ? (
                  <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2} />
                ) : (
                  <ArrowUp className="w-4 h-4" strokeWidth={2} />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
