import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowUp,
  AtSign,
  AudioLines,
  Camera,
  Check,
  ChevronDown,
  Clapperboard,
  Copy,
  Eraser,
  Film,
  GitBranch,
  Grid2X2,
  Image as ImageIcon,
  Link2,
  Loader2,
  Maximize2,
  Paintbrush,
  Play,
  Plus,
  RotateCcw,
  Scissors,
  Search,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Type,
  Upload,
  UserSquare2,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import type {
  AspectRatio,
  ConnectionTransport,
  ModelParameterSpec,
  PlatformId,
  PlatformModelDefinition,
  ResolutionTier,
} from '../types/studio';
import {
  ELEVENLABS_VOICES,
  getModelsForPlatformAndModality,
  getPlatformConnectionStatus,
  getPlatformsForModality,
  nodeKindToModality,
  resolveCanonicalModelId,
  resolveModelDisplayLabel,
} from '../presets/platformCatalog';
import { useStudioStore } from '../store/useStudioStore';
import { SmartMediaImage } from './SmartMedia';
import { PlatformBrandIcon } from './PlatformBrandIcon';

const IMAGE_ASPECTS: AspectRatio[] = ['16:9', '1:1', '9:16', '4:3', '3:4', '21:9'];
const VIDEO_ASPECTS: AspectRatio[] = ['16:9', '9:16', '1:1', '21:9'];
const IMAGE_RESOLUTIONS: ResolutionTier[] = ['1K', '2K', '4K'];
const VIDEO_RESOLUTIONS: ResolutionTier[] = ['720p', '1080p', '4K'];
const VIDEO_DURATIONS = [5, 8, 10, 15];
const AUDIO_DURATIONS = [5, 8, 10, 15];
const BATCH_COUNTS: Array<1 | 2 | 4> = [1, 2, 4];

const DOP_CAMERA_MOTIONS = [
  'Static Tripod',
  'Slow Dolly In',
  'Pull Back Reveal',
  'Handheld 35mm',
  'Crane Up',
  'Orbit 180°',
  'FPV Tracking',
  'Anamorphic Rack Focus',
] as const;

const TRANSPORT_OPTIONS: Array<{
  id: ConnectionTransport;
  label: string;
  hint: string;
}> = [
  { id: 'auto', label: 'Auto (Best Available)', hint: 'MCP → Browser Credits → API Key' },
  { id: 'mcp', label: 'MCP Server Credits', hint: 'Route via connected MCP server' },
  { id: 'browser-bridge', label: 'Browser Session Credits', hint: 'Logged-in web tab via Chrome Bridge' },
  { id: 'api-key', label: 'Direct API Key ($0 Markup)', hint: 'Raw BYOK provider call' },
];

const PREFERRED_FAMILY_ORDER = [
  'OpenAI',
  'Higgsfield',
  'Kling',
  'ByteDance',
  'Google',
  'Wan',
  'FLUX',
];

function normalizeFamilyChipLabel(raw?: string): string {
  return (raw || '').split(/[\/(]/)[0].trim();
}

function familyMatchesChip(providerFamily: string | undefined, chip: string): boolean {
  const fam = (providerFamily || '').trim().toLowerCase();
  const target = chip.trim().toLowerCase();
  if (!fam || !target) return false;
  return fam === target || fam.includes(target);
}

function buildFamilyChips(models: PlatformModelDefinition[]): string[] {
  const seen = new Set<string>();
  const uniqueFamilies: string[] = [];
  for (const m of models) {
    const label = normalizeFamilyChipLabel(m.providerFamily);
    if (!label) continue;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    uniqueFamilies.push(label);
  }
  uniqueFamilies.sort((a, b) => {
    const ia = PREFERRED_FAMILY_ORDER.findIndex((p) => p.toLowerCase() === a.toLowerCase());
    const ib = PREFERRED_FAMILY_ORDER.findIndex((p) => p.toLowerCase() === b.toLowerCase());
    if (ia !== -1 && ib !== -1) return ia - ib;
    if (ia !== -1) return -1;
    if (ib !== -1) return 1;
    return a.localeCompare(b);
  });
  return [
    'All',
    ...(models.some((m) => m.supportsUnlim) ? ['∞ Unlim'] : []),
    ...uniqueFamilies,
  ];
}

function formatParamOptionLabel(val: string | number | boolean): string {
  const str = String(val);
  if (str === 't2v') return 'Text → Video';
  if (str === 'omni_reference') return 'Omni Reference';
  if (str === 'video_edit') return 'Video Edit';
  if (str === 'video_extension') return 'Video Extend';
  if (str === 'xhigh') return 'X-High';
  if (str === 'very_low') return 'Very Low';
  if (str === 'auto') return 'Auto';
  if (str === 'unlimited') return 'Unlimited (∞)';
  if (str === 'credits') return 'Credits (Batch)';
  if (/^\d+(?:\.\d+)?[kp]$/i.test(str)) return str;
  if (str.includes('-') && str.length > 10) return str;
  return str
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function resolveModelParamValue(
  nodeParams: Record<string, string | number | boolean> | undefined,
  nodeQuality: string | undefined,
  spec: ModelParameterSpec
): string | number | boolean | undefined {
  if (spec.name === 'quality' && nodeQuality !== undefined) return nodeQuality;
  const v = nodeParams?.[spec.name];
  if (v !== undefined) return v;
  if (spec.default !== undefined) return spec.default;
  if (spec.options?.length) return spec.options[0];
  return undefined;
}

export const ContextualNodeOverlay: React.FC = () => {
  const nodes = useStudioStore((s) => s.nodes);
  const edges = useStudioStore((s) => s.edges);
  const selectedNodeIds = useStudioStore((s) => s.selectedNodeIds);
  const panX = useStudioStore((s) => s.panX);
  const panY = useStudioStore((s) => s.panY);
  const zoom = useStudioStore((s) => s.zoom);

  const elements = useStudioStore((s) => s.elements);
  const byok = useStudioStore((s) => s.byok);
  const chromeBridge = useStudioStore((s) => s.chromeBridge);
  const platformsCatalog = useStudioStore((s) => s.platformsCatalog);
  const externalMcpServers = useStudioStore((s) => s.externalMcpServers);
  const connectedBrowserPlatforms = useStudioStore((s) => s.connectedBrowserPlatforms);
  const connectedMcpPlatforms = useStudioStore((s) => s.connectedMcpPlatforms);
  const configuredApiPlatforms = useStudioStore((s) => s.configuredApiPlatforms);
  const lastImagePlatformId = useStudioStore((s) => s.lastImagePlatformId);
  const lastVideoPlatformId = useStudioStore((s) => s.lastVideoPlatformId);
  const lastAudioPlatformId = useStudioStore((s) => s.lastAudioPlatformId);
  const lastFailedPlatformId = useStudioStore((s) => s.lastFailedPlatformId);
  const workflowRunning = useStudioStore((s) => s.workflowRunning);

  const updateNodeFields = useStudioStore((s) => s.updateNodeFields);
  const setNodePlatformAndModel = useStudioStore((s) => s.setNodePlatformAndModel);
  const setNodeAspectRatio = useStudioStore((s) => s.setNodeAspectRatio);
  const uploadReferenceToNode = useStudioStore((s) => s.uploadReferenceToNode);
  const attachReferenceToNode = useStudioStore((s) => s.attachReferenceToNode);
  const removeReferenceUrlFromNode = useStudioStore((s) => s.removeReferenceUrlFromNode);
  const saveNodeAsElementReference = useStudioStore((s) => s.saveNodeAsElementReference);
  const generateSingleNode = useStudioStore((s) => s.generateSingleNode);
  const runWorkflowPipeline = useStudioStore((s) => s.runWorkflowPipeline);
  const spawnDreaminaNodeAt = useStudioStore((s) => s.spawnDreaminaNodeAt);
  const spawnConnectedNodeFromSelection = useStudioStore(
    (s) => s.spawnConnectedNodeFromSelection
  );
  const splitBatchNodeToIndividualNodes = useStudioStore(
    (s) => s.splitBatchNodeToIndividualNodes
  );
  const connectNodes = useStudioStore((s) => s.connectNodes);
  const duplicateNodes = useStudioStore((s) => s.duplicateNodes);
  const deleteSelectedNodes = useStudioStore((s) => s.deleteSelectedNodes);
  const openInlineEditor = useStudioStore((s) => s.openInlineEditor);
  const removeBgAndDecomposeLayers = useStudioStore((s) => s.removeBgAndDecomposeLayers);
  const upscaleNodeHd = useStudioStore((s) => s.upscaleNodeHd);
  const extractLastFrameToNextShot = useStudioStore((s) => s.extractLastFrameToNextShot);
  const sendNodeToTimeline = useStudioStore((s) => s.sendNodeToTimeline);
  const openProviderModal = useStudioStore((s) => s.openProviderModal);

  const [openMenu, setOpenMenu] = useState<
    | null
    | 'platform'
    | 'model'
    | 'aspect'
    | 'resolution'
    | 'quality'
    | 'mode'
    | 'duration'
    | 'batch'
    | 'camera'
    | 'voice'
    | 'advanced'
    | 'add-ref'
  >(null);
  const [modelSearch, setModelSearch] = useState('');
  const [modelFamilyFilter, setModelFamilyFilter] = useState<string>('All');
  const [atAutocompleteOpen, setAtAutocompleteOpen] = useState(false);

  const refUploadInputRef = useRef<HTMLInputElement | null>(null);
  const directCardUploadInputRef = useRef<HTMLInputElement | null>(null);

  const selectedNode = useMemo(() => {
    if (selectedNodeIds.length !== 1) return null;
    return nodes.find((n) => n.id === selectedNodeIds[0]) || null;
  }, [nodes, selectedNodeIds]);

  const selectedModality = selectedNode ? nodeKindToModality(selectedNode.kind) : null;
  const resolvedEffectivePlatformId: PlatformId = selectedNode
    ? selectedNode.platformId ||
      (selectedModality === 'video'
        ? lastVideoPlatformId
        : selectedModality === 'audio'
        ? lastAudioPlatformId
        : lastImagePlatformId)
    : lastImagePlatformId;

  useEffect(() => {
    setOpenMenu(null);
    setModelSearch('');
    setModelFamilyFilter('All');
    setAtAutocompleteOpen(false);
  }, [selectedNode?.id, resolvedEffectivePlatformId, selectedModality]);

  if (selectedNodeIds.length >= 2) {
    return <MultiReferenceSelectionBar />;
  }

  if (!selectedNode) return null;

  const modality = selectedModality;
  const hasMedia = Boolean(
    selectedNode.imageUrl || selectedNode.videoUrl || selectedNode.audioUrl
  );

  // Screen-space anchor coordinates of the selected node
  const nodeLeftScreen = panX + selectedNode.x * zoom;
  const nodeTopScreen = panY + selectedNode.y * zoom;
  const nodeWidthScreen = selectedNode.width * zoom;
  const nodeBottomScreen = nodeTopScreen + selectedNode.height * zoom;
  const centerScreenX = nodeLeftScreen + nodeWidthScreen / 2;

  const quickBarLeft = Math.max(
    220,
    Math.min(window.innerWidth - 220, centerScreenX)
  );
  const quickBarTop = Math.max(58, nodeTopScreen - 56);

  const popoverWidth = Math.min(688, window.innerWidth - 96);
  const popoverLeft = Math.max(
    72,
    Math.min(window.innerWidth - popoverWidth - 20, centerScreenX - popoverWidth / 2)
  );
  const popoverTop = Math.min(
    window.innerHeight - 238,
    Math.max(96, nodeBottomScreen + 18)
  );

  // Wired upstream & downstream inspection
  const upstreamNodes = edges
    .filter((e) => e.targetId === selectedNode.id)
    .map((e) => nodes.find((n) => n.id === e.sourceId))
    .filter((n): n is NonNullable<typeof n> => Boolean(n));

  const upstreamRefNodes = upstreamNodes.filter(
    (n) => n.kind === 'image' || n.kind === 'element' || n.kind === 'contact-sheet'
  );

  const hasDownstreamEdges = edges.some((e) => e.sourceId === selectedNode.id);

  // Linkable canvas image/element nodes not yet wired into selectedNode
  const linkableCanvasImageNodes = nodes.filter(
    (n) =>
      n.id !== selectedNode.id &&
      (n.kind === 'image' || n.kind === 'element' || n.kind === 'contact-sheet') &&
      !edges.some((e) => e.sourceId === n.id && e.targetId === selectedNode.id)
  );

  // Resolve active platform & model for generatable nodes
  const effectivePlatformId: PlatformId = resolvedEffectivePlatformId;

  const availablePlatforms = modality
    ? getPlatformsForModality(modality, platformsCatalog)
    : [];

  const activePlatformDef =
    availablePlatforms.find((p) => p.id === effectivePlatformId) ||
    availablePlatforms[0];

  const availableModels = modality
    ? getModelsForPlatformAndModality(
        activePlatformDef?.id || effectivePlatformId,
        modality,
        platformsCatalog,
        externalMcpServers
      )
    : [];

  const canonicalSelectedModelId = resolveCanonicalModelId(selectedNode.modelId);
  const activeModelDef =
    availableModels.find(
      (m) => m.id === selectedNode.modelId || m.id === canonicalSelectedModelId
    ) || availableModels[0];

  const aspectOptions = activeModelDef?.aspectRatios?.length
    ? activeModelDef.aspectRatios
    : modality === 'video'
    ? VIDEO_ASPECTS
    : IMAGE_ASPECTS;
  const showResolutionPill =
    modality !== 'audio' &&
    (Boolean(activeModelDef?.resolutions?.length) || !activeModelDef?.parameters?.length);
  const resolutionOptions = activeModelDef?.resolutions?.length
    ? activeModelDef.resolutions
    : modality === 'video'
    ? VIDEO_RESOLUTIONS
    : IMAGE_RESOLUTIONS;
  const qualitySpec = activeModelDef?.parameters?.find((p) => p.name === 'quality');
  const activeQualityVal = qualitySpec
    ? resolveModelParamValue(selectedNode.modelParams, selectedNode.quality, qualitySpec)
    : undefined;
  const modeSpec = activeModelDef?.parameters?.find(
    (p) =>
      p.name === 'mode' ||
      p.name === 'variant' ||
      (p.inlinePill && p.name !== 'quality')
  );
  const activeModeVal = modeSpec
    ? resolveModelParamValue(selectedNode.modelParams, selectedNode.quality, modeSpec)
    : undefined;
  const durationOptions = activeModelDef?.durationsSec?.length
    ? activeModelDef.durationsSec
    : modality === 'audio'
    ? AUDIO_DURATIONS
    : VIDEO_DURATIONS;
  const showVideoAudioPill = modality === 'video' && activeModelDef?.supportsAudio !== false;
  const remainingParamSpecs = (activeModelDef?.parameters || []).filter(
    (p) => p.name !== 'quality' && p !== modeSpec
  );
  const customParamCount = remainingParamSpecs.filter((spec) => {
    const val = selectedNode.modelParams?.[spec.name];
    return val !== undefined && val !== spec.default;
  }).length;

  const updateModelParam = (name: string, value: string | number | boolean | undefined) => {
    const nextParams: Record<string, string | number | boolean> = {
      ...(selectedNode.modelParams || {}),
    };
    if (value === undefined) {
      delete nextParams[name];
    } else {
      nextParams[name] = value;
    }
    updateNodeFields(selectedNode.id, {
      ...(name === 'quality'
        ? { quality: typeof value === 'string' ? value : undefined }
        : {}),
      modelParams: Object.keys(nextParams).length > 0 ? nextParams : undefined,
    });
  };

  const resetModelParamDefaults = () => {
    const defaults: Record<string, string | number | boolean> = {};
    for (const p of activeModelDef?.parameters || []) {
      if (p.default !== undefined) defaults[p.name] = p.default;
    }
    updateNodeFields(selectedNode.id, {
      quality:
        typeof defaults.quality === 'string' ? defaults.quality : undefined,
      modelParams: Object.keys(defaults).length > 0 ? defaults : undefined,
    });
  };

  const dynamicFamilyChips = buildFamilyChips(availableModels);
  const normalizedModelSearch = modelSearch.trim().toLowerCase();
  const visibleModels = availableModels.filter((m) => {
    if (modelFamilyFilter === '∞ Unlim' && !m.supportsUnlim) return false;
    if (
      modelFamilyFilter !== 'All' &&
      modelFamilyFilter !== '∞ Unlim' &&
      !familyMatchesChip(m.providerFamily, modelFamilyFilter)
    ) {
      return false;
    }
    if (!normalizedModelSearch) return true;
    return (
      m.label.toLowerCase().includes(normalizedModelSearch) ||
      m.id.toLowerCase().includes(normalizedModelSearch) ||
      (m.providerFamily || '').toLowerCase().includes(normalizedModelSearch) ||
      (m.description || '').toLowerCase().includes(normalizedModelSearch)
    );
  });

  const groupedVisibleModels: Array<{ family: string; models: PlatformModelDefinition[] }> = [];
  const familyIndexMap = new Map<string, number>();
  for (const m of visibleModels) {
    const fam = m.providerFamily || activePlatformDef?.shortLabel || 'Models';
    const idx = familyIndexMap.get(fam);
    if (idx === undefined) {
      familyIndexMap.set(fam, groupedVisibleModels.length);
      groupedVisibleModels.push({ family: fam, models: [m] });
    } else {
      groupedVisibleModels[idx].models.push(m);
    }
  }

  const liveConnStatusObj = {
    connectedBrowserPlatforms,
    connectedMcpPlatforms,
    configuredApiPlatforms,
  };

  const activeConnStatus = activePlatformDef
    ? getPlatformConnectionStatus(
        activePlatformDef.id,
        byok,
        chromeBridge,
        externalMcpServers,
        activePlatformDef,
        liveConnStatusObj
      )
    : {
        connected:
          connectedMcpPlatforms.includes(effectivePlatformId) ||
          connectedBrowserPlatforms.includes(effectivePlatformId) ||
          configuredApiPlatforms.includes(effectivePlatformId),
        hasBrowser: connectedBrowserPlatforms.includes(effectivePlatformId),
        hasMcp: connectedMcpPlatforms.includes(effectivePlatformId),
        hasApiKey: configuredApiPlatforms.includes(effectivePlatformId),
        transports: [],
        statusLabel: 'Not Connected' as const,
        summary: 'Connect Credits',
      };

  const isEffectivePlatformConnected =
    activeConnStatus.connected ||
    connectedMcpPlatforms.includes(effectivePlatformId) ||
    configuredApiPlatforms.includes(effectivePlatformId) ||
    connectedBrowserPlatforms.includes(effectivePlatformId) ||
    Boolean(chromeBridge.connectedPlatforms?.[effectivePlatformId]) ||
    (effectivePlatformId === 'dreamina' && chromeBridge.dreaminaTabConnected) ||
    (effectivePlatformId === 'google-flow' && chromeBridge.flowTabConnected);

  const activeVoice =
    ELEVENLABS_VOICES.find((v) => v.id === (selectedNode.voiceId || 'JBFqnCBsd6RMkjVDRZzb')) ||
    ELEVENLABS_VOICES[0];

  const isGenerating = selectedNode.status === 'generating';

  const handlePromptChange = (val: string) => {
    updateNodeFields(selectedNode.id, { prompt: val });
    if (val.endsWith('@') && elements.length > 0) {
      setAtAutocompleteOpen(true);
    } else if (!val.includes('@') || val.endsWith(' ')) {
      setAtAutocompleteOpen(false);
    }
  };

  return (
    <>
      {/* Hidden file inputs */}
      <input
        ref={refUploadInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) {
            void attachReferenceToNode(selectedNode.id, f);
            e.target.value = '';
          }
          setOpenMenu(null);
        }}
      />
      <input
        ref={directCardUploadInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) {
            void uploadReferenceToNode(selectedNode.id, f);
            e.target.value = '';
          }
        }}
      />

      {/* 1. Floating Top Quick-Action Pill Bar */}
      {selectedNode.kind !== 'timeline' && (
        <div
          style={{
            left: `${quickBarLeft}px`,
            top: `${quickBarTop}px`,
            transform: 'translateX(-50%)',
          }}
          onPointerDown={(e) => e.stopPropagation()}
          className="fixed z-40 h-9 px-1.5 rounded-[10px] dreamina-levitation flex items-center gap-1 text-[11.5px] select-none"
        >
          {(selectedNode.kind === 'image' ||
            selectedNode.kind === 'element' ||
            selectedNode.kind === 'contact-sheet') &&
            hasMedia && (
              <>
                <button
                  type="button"
                  onClick={() => saveNodeAsElementReference(selectedNode.id)}
                  className="h-7 px-2.5 rounded-[7px] hover:bg-white/[0.08] text-white/90 flex items-center gap-1.5"
                  title="Register this image as a reusable @Element reference tag"
                >
                  <UserSquare2 className="w-3.5 h-3.5 text-[#20D5EC]" strokeWidth={1.6} />
                  <span>Save @Ref</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    spawnDreaminaNodeAt(
                      'video',
                      selectedNode.x + selectedNode.width + 130,
                      selectedNode.y - 20,
                      {
                        wireFromNodeId: selectedNode.id,
                        wireDirection: 'right',
                      }
                    );
                  }}
                  className="h-7 px-2.5 rounded-[7px] bg-white/[0.08] hover:bg-white/[0.15] text-white font-medium flex items-center gap-1.5"
                  title="Spawn a connected Video node using this image as Reference"
                >
                  <Clapperboard className="w-3.5 h-3.5 text-[#20D5EC]" strokeWidth={1.6} />
                  <span>→ Create Video</span>
                </button>

                <div className="w-px h-4 bg-white/[0.08] mx-0.5" />

                <button
                  type="button"
                  onClick={() => openInlineEditor('inpaint', selectedNode.id)}
                  className="h-7 px-2 rounded-[7px] hover:bg-white/[0.08] text-white/80 flex items-center gap-1"
                >
                  <Paintbrush className="w-3.5 h-3.5 text-white/60" strokeWidth={1.5} />
                  <span>Inpaint</span>
                </button>

                <button
                  type="button"
                  onClick={() => openInlineEditor('outpaint', selectedNode.id)}
                  className="h-7 px-2 rounded-[7px] hover:bg-white/[0.08] text-white/80 flex items-center gap-1"
                >
                  <Maximize2 className="w-3.5 h-3.5 text-white/60" strokeWidth={1.5} />
                  <span>Expand</span>
                </button>

                <button
                  type="button"
                  onClick={() => void removeBgAndDecomposeLayers(selectedNode.id)}
                  className="h-7 px-2 rounded-[7px] hover:bg-white/[0.08] text-white/80 flex items-center gap-1"
                >
                  <Eraser className="w-3.5 h-3.5 text-white/60" strokeWidth={1.5} />
                  <span>Cutout</span>
                </button>

                <button
                  type="button"
                  onClick={() => void upscaleNodeHd(selectedNode.id, '4K')}
                  className="h-7 px-2 rounded-[7px] hover:bg-white/[0.08] text-white/80 flex items-center gap-1"
                >
                  <Sparkles className="w-3.5 h-3.5 text-white/60" strokeWidth={1.5} />
                  <span>4K</span>
                </button>

                {selectedNode.generatedOutputs &&
                  selectedNode.generatedOutputs.length > 1 && (
                    <button
                      type="button"
                      onClick={() => splitBatchNodeToIndividualNodes(selectedNode.id)}
                      className="h-7 px-2.5 rounded-[7px] bg-[#20D5EC]/15 hover:bg-[#20D5EC]/25 border border-[#20D5EC]/35 text-[#7ceeff] font-medium flex items-center gap-1.5"
                      title="Split all batch outputs into standalone canvas nodes"
                    >
                      <Grid2X2 className="w-3.5 h-3.5" strokeWidth={1.6} />
                      <span>Split into {selectedNode.generatedOutputs.length} Nodes</span>
                    </button>
                  )}

                <div className="w-px h-4 bg-white/[0.08] mx-0.5" />
              </>
            )}

          {(selectedNode.kind === 'image' || selectedNode.kind === 'element') &&
            !hasMedia && (
              <>
                <button
                  type="button"
                  onClick={() => directCardUploadInputRef.current?.click()}
                  className="h-7 px-2.5 rounded-[7px] hover:bg-white/[0.08] text-white/85 flex items-center gap-1.5"
                >
                  <Upload className="w-3.5 h-3.5 text-white/65" strokeWidth={1.5} />
                  <span>Upload Image</span>
                </button>
                <div className="w-px h-4 bg-white/[0.08] mx-0.5" />
              </>
            )}

          {selectedNode.kind === 'video' && hasMedia && (
            <>
              <button
                type="button"
                onClick={() => void extractLastFrameToNextShot(selectedNode.id)}
                className="h-7 px-2.5 rounded-[7px] hover:bg-white/[0.08] text-white/85 flex items-center gap-1.5"
              >
                <Scissors className="w-3.5 h-3.5 text-white/65" strokeWidth={1.5} />
                <span>Last Frame → Next Shot</span>
              </button>
              <button
                type="button"
                onClick={() => sendNodeToTimeline(selectedNode.id)}
                className="h-7 px-2.5 rounded-[7px] hover:bg-white/[0.08] text-white/85 flex items-center gap-1.5"
              >
                <Film className="w-3.5 h-3.5 text-white/65" strokeWidth={1.5} />
                <span>To Timeline</span>
              </button>
              <div className="w-px h-4 bg-white/[0.08] mx-0.5" />
            </>
          )}

          {selectedNode.kind === 'audio' && hasMedia && (
            <>
              <button
                type="button"
                onClick={() => sendNodeToTimeline(selectedNode.id)}
                className="h-7 px-2.5 rounded-[7px] hover:bg-white/[0.08] text-white/85 flex items-center gap-1.5"
              >
                <Film className="w-3.5 h-3.5 text-white/65" strokeWidth={1.5} />
                <span>Send to Timeline (A1)</span>
              </button>
              <div className="w-px h-4 bg-white/[0.08] mx-0.5" />
            </>
          )}

          <button
            type="button"
            onClick={() => duplicateNodes(selectedNode.id)}
            className="h-7 px-2 rounded-[7px] hover:bg-white/[0.08] text-white/75 flex items-center gap-1"
            title="Duplicate node (⌘D)"
          >
            <Copy className="w-3.5 h-3.5" strokeWidth={1.5} />
          </button>

          <button
            type="button"
            onClick={() => deleteSelectedNodes(selectedNode.id)}
            className="h-7 px-2 rounded-[7px] hover:bg-red-500/15 text-red-400 flex items-center gap-1"
            title="Delete node"
          >
            <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
          </button>
        </div>
      )}

      {/* 2. Modality-Locked Creation Bar ([Where] + [Model] + [Settings] + [References] + [Generate]) */}
      {modality && (
        <div
          style={{
            left: `${popoverLeft}px`,
            top: `${popoverTop}px`,
            width: `${popoverWidth}px`,
          }}
          onPointerDown={(e) => e.stopPropagation()}
          className="fixed z-40 rounded-[16px] dreamina-levitation p-3 space-y-2.5 select-none"
        >
          {/* Top Strip: Modality Header + Live Wired / Uploaded References */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="px-2 py-0.5 rounded-[6px] bg-[#252525] border border-white/[0.07] text-[11px] font-medium text-white/85 flex items-center gap-1.5">
                {modality === 'video' ? (
                  <Clapperboard className="w-3 h-3 text-[#20D5EC]" strokeWidth={1.75} />
                ) : modality === 'audio' ? (
                  <AudioLines className="w-3 h-3 text-[#20D5EC]" strokeWidth={1.75} />
                ) : selectedNode.kind === 'element' ? (
                  <UserSquare2 className="w-3 h-3 text-[#20D5EC]" strokeWidth={1.75} />
                ) : (
                  <ImageIcon className="w-3 h-3 text-[#20D5EC]" strokeWidth={1.75} />
                )}
                <span>
                  {selectedNode.kind === 'element'
                    ? `Create Reference (${selectedNode.elementHandles[0] || '@Ref_1'})`
                    : modality === 'video'
                    ? 'Create Video'
                    : modality === 'audio'
                    ? 'Create Voice / SFX'
                    : 'Create Image'}
                </span>
              </span>

              {/* Wired Upstream Reference Chips */}
              {modality !== 'audio' &&
                upstreamRefNodes.map((up) => (
                  <div
                    key={up.id}
                    className="h-6 pl-1 pr-2 rounded-[6px] bg-[#252525] border border-[#20D5EC]/35 flex items-center gap-1.5 text-[11px] text-white/90"
                    title={
                      up.imageUrl
                        ? `Wired reference from ${up.title}`
                        : `Waiting for ${up.title} to generate`
                    }
                  >
                    {up.imageUrl ? (
                      <SmartMediaImage
                        src={up.imageUrl}
                        alt={up.title}
                        className="w-4 h-4 rounded-[3px] object-cover"
                      />
                    ) : (
                      <span className="w-2 h-2 rounded-full bg-[#20D5EC]/70 ml-1" />
                    )}
                    <span className="truncate max-w-[110px]">{up.title}</span>
                    {!up.imageUrl && (
                      <span className="text-[10px] text-[#20D5EC]">Pending</span>
                    )}
                  </div>
                ))}

              {/* Attached Custom Reference Image Chips */}
              {modality !== 'audio' &&
                (selectedNode.referenceUrls || []).map((refUrl, idx) => (
                  <div
                    key={`${refUrl}_${idx}`}
                    className="h-6 pl-1 pr-1.5 rounded-[6px] bg-[#252525] border border-white/[0.12] flex items-center gap-1 text-[11px] text-white/85"
                  >
                    <SmartMediaImage
                      src={refUrl}
                      alt={`Ref ${idx + 1}`}
                      className="w-4 h-4 rounded-[3px] object-cover"
                    />
                    <span>Ref {idx + 1}</span>
                    <button
                      type="button"
                      onClick={() =>
                        removeReferenceUrlFromNode(selectedNode.id, refUrl)
                      }
                      className="text-white/45 hover:text-white ml-0.5"
                    >
                      <X className="w-3 h-3" strokeWidth={1.75} />
                    </button>
                  </div>
                ))}

              {/* + Add Reference Dropdown Button */}
              {modality !== 'audio' && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() =>
                      setOpenMenu(openMenu === 'add-ref' ? null : 'add-ref')
                    }
                    className="h-6 px-2 rounded-[6px] bg-[#252525] hover:bg-white/[0.1] border border-dashed border-white/[0.18] text-[11px] text-white/75 hover:text-white flex items-center gap-1 transition-colors"
                  >
                    <Plus className="w-3 h-3" strokeWidth={1.75} />
                    <span>Reference</span>
                  </button>

                  {openMenu === 'add-ref' && (
                    <div className="absolute bottom-full left-0 mb-1.5 w-[248px] p-1.5 rounded-[12px] dreamina-menu z-50 space-y-0.5 text-[12px]">
                      <button
                        type="button"
                        onClick={() => refUploadInputRef.current?.click()}
                        className="w-full h-8 px-2.5 rounded-[8px] hover:bg-white/[0.08] text-white/90 flex items-center gap-2 text-left"
                      >
                        <Upload className="w-3.5 h-3.5 text-white/65" strokeWidth={1.5} />
                        <span>Upload reference image…</span>
                      </button>

                      {linkableCanvasImageNodes.length > 0 && (
                        <>
                          <div className="my-1 h-px bg-white/[0.07]" />
                          <div className="px-2.5 py-0.5 text-[10.5px] text-white/40 uppercase tracking-wider">
                            Link Canvas Node
                          </div>
                          {linkableCanvasImageNodes.slice(0, 6).map((cn) => (
                            <button
                              key={cn.id}
                              type="button"
                              onClick={() => {
                                connectNodes(cn.id, selectedNode.id, 'lineage');
                                setOpenMenu(null);
                              }}
                              className="w-full h-8 px-2.5 rounded-[8px] hover:bg-white/[0.08] text-white/90 flex items-center justify-between gap-2 text-left"
                            >
                              <span className="flex items-center gap-2 min-w-0">
                                <Link2
                                  className="w-3.5 h-3.5 text-[#20D5EC] shrink-0"
                                  strokeWidth={1.5}
                                />
                                <span className="truncate">{cn.title}</span>
                              </span>
                              <span className="text-[10px] text-white/40 shrink-0">
                                {cn.imageUrl ? 'Ready' : 'Idle'}
                              </span>
                            </button>
                          ))}
                        </>
                      )}

                      {elements.length > 0 && (
                        <>
                          <div className="my-1 h-px bg-white/[0.07]" />
                          <div className="px-2.5 py-0.5 text-[10.5px] text-white/40 uppercase tracking-wider">
                            Project @Elements
                          </div>
                          {elements.map((el) => (
                            <button
                              key={el.id}
                              type="button"
                              onClick={() => {
                                const nextPrompt = selectedNode.prompt.includes(el.handle)
                                  ? selectedNode.prompt
                                  : `${selectedNode.prompt}${
                                      selectedNode.prompt &&
                                      !selectedNode.prompt.endsWith(' ')
                                        ? ' '
                                        : ''
                                    }${el.handle} `;
                                updateNodeFields(selectedNode.id, {
                                  prompt: nextPrompt,
                                  elementHandles: Array.from(
                                    new Set([...selectedNode.elementHandles, el.handle])
                                  ),
                                });
                                setOpenMenu(null);
                              }}
                              className="w-full h-8 px-2.5 rounded-[8px] hover:bg-white/[0.08] text-white/90 flex items-center justify-between gap-2 text-left"
                            >
                              <span className="flex items-center gap-2 min-w-0">
                                <AtSign
                                  className="w-3.5 h-3.5 text-[#20D5EC] shrink-0"
                                  strokeWidth={1.5}
                                />
                                <span className="font-mono text-[11.5px] truncate">
                                  {el.handle}
                                </span>
                              </span>
                              <span className="text-[10px] text-white/45 shrink-0">
                                {el.references.length} ref
                              </span>
                            </button>
                          ))}
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Active Connection Badge */}
            {(() => {
              const matchingMcpSrv = externalMcpServers.find(
                (s) => s.platformId === effectivePlatformId && s.status === 'connected'
              );
              const mcpCredits = matchingMcpSrv?.balance?.credits;
              const badgeText = activeConnStatus.connected
                ? activeConnStatus.hasMcp
                  ? mcpCredits !== undefined
                    ? `✓ MCP · ${mcpCredits.toLocaleString(undefined, { maximumFractionDigits: 1 })} cr`
                    : '✓ MCP Connected'
                  : `✓ ${activeConnStatus.summary}`
                : 'Connect Credits';
              return (
                <button
                  type="button"
                  onClick={() =>
                    openProviderModal(
                      activeConnStatus.transports.includes('mcp')
                        ? 'mcp'
                        : activeConnStatus.transports.includes('browser-bridge')
                        ? 'bridge'
                        : 'byok',
                      effectivePlatformId
                    )
                  }
                  className={`h-6 px-2.5 rounded-[6px] border text-[10.5px] font-medium flex items-center gap-1.5 transition-colors ${
                    activeConnStatus.connected
                      ? 'bg-[#10b981]/12 hover:bg-[#10b981]/20 border-[#10b981]/30 text-[#6ee7b7]'
                      : 'bg-[#252525] hover:bg-white/[0.1] border-white/[0.07] text-white/70 hover:text-white'
                  }`}
                  title="Configure MCP, Browser Session Credits, or Zero-Markup API Keys"
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      activeConnStatus.connected ? 'bg-[#10b981]' : 'bg-amber-400/80'
                    }`}
                  />
                  <span>{badgeText}</span>
                </button>
              );
            })()}
          </div>

          {/* Prompt Input Area */}
          <div className="relative">
            <textarea
              rows={2}
              value={selectedNode.prompt}
              onChange={(e) => handlePromptChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  void generateSingleNode(selectedNode.id);
                }
              }}
              placeholder={
                selectedNode.kind === 'element'
                  ? 'Describe the character, product, or visual reference to create…'
                  : modality === 'video'
                  ? upstreamRefNodes.length > 0
                    ? `Describe how ${upstreamRefNodes[0].title} moves, camera motion & scene action…`
                    : 'Describe camera motion, subject action & scene dynamics…'
                  : modality === 'audio'
                  ? selectedNode.audioMode === 'sfx'
                    ? 'Describe the foley or ambient sound effect to generate…'
                    : 'Write the voiceover script or character dialogue…'
                  : 'Describe the image you want to create…'
              }
              className="w-full bg-[#141414] border border-white/[0.07] focus:border-white/[0.22] rounded-[10px] px-3 py-2 text-[13px] leading-relaxed text-white placeholder:text-white/32 resize-none outline-none select-text"
            />

            {/* Inline @Element Autocomplete (ONLY when active project actually has elements!) */}
            {atAutocompleteOpen && elements.length > 0 && (
              <div className="absolute bottom-full left-2 mb-1.5 w-[240px] p-1.5 rounded-[11px] dreamina-menu z-50 space-y-0.5">
                {elements.map((el) => (
                  <button
                    key={el.id}
                    type="button"
                    onClick={() => {
                      const nextPrompt = selectedNode.prompt.replace(
                        /@$/,
                        `${el.handle} `
                      );
                      updateNodeFields(selectedNode.id, {
                        prompt: nextPrompt,
                        elementHandles: Array.from(
                          new Set([...selectedNode.elementHandles, el.handle])
                        ),
                      });
                      setAtAutocompleteOpen(false);
                    }}
                    className="w-full h-8 px-2.5 rounded-[7px] hover:bg-white/[0.08] text-left text-[12px] text-white/90 flex items-center justify-between"
                  >
                    <span className="font-mono text-[#20D5EC]">{el.handle}</span>
                    <span className="text-[11px] text-white/45 truncate ml-2">
                      {el.name}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Actionable Banner ONLY when platform is genuinely disconnected after clicking Generate */}
          {lastFailedPlatformId === effectivePlatformId &&
            !isEffectivePlatformConnected && (
              <div className="px-3 py-2 rounded-[9px] bg-amber-500/[0.09] border border-amber-400/25 flex items-center justify-between gap-2 text-[11.5px]">
                <span className="text-amber-100/90 truncate">
                  Connect your {activePlatformDef?.name || effectivePlatformId} account or API key to generate on this node.
                </span>
                <button
                  type="button"
                  onClick={() => openProviderModal('byok', effectivePlatformId)}
                  className="h-6 px-2.5 rounded-[6px] bg-white text-[#0e0e0e] font-semibold shrink-0 hover:bg-white/90"
                >
                  Connect Credits →
                </button>
              </div>
            )}

          {/* Bottom Controls Row: [Where (Platform)] + [Model] + [Settings] + [Generate] */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 flex-wrap">
              {/* 1. WHERE (Platform Selector) */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() =>
                    setOpenMenu(openMenu === 'platform' ? null : 'platform')
                  }
                  className="h-8 px-2.5 rounded-[8px] bg-[#252525] hover:bg-white/[0.11] border border-white/[0.08] text-[12px] font-medium text-white/95 flex items-center gap-1.5 transition-colors"
                  title="Where this node gets generated (Platform / Credits)"
                >
                  <PlatformBrandIcon platformId={effectivePlatformId} size="xs" />
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      activeConnStatus.connected ? 'bg-[#10b981]' : 'bg-white/35'
                    }`}
                  />
                  <span>{activePlatformDef?.shortLabel || effectivePlatformId}</span>
                  <ChevronDown className="w-3.5 h-3.5 text-white/45" strokeWidth={1.6} />
                </button>

                {openMenu === 'platform' && (
                  <div className="absolute bottom-full left-0 mb-1.5 w-[256px] max-h-[320px] overflow-y-auto p-1.5 rounded-[12px] dreamina-menu z-50 space-y-0.5">
                    <div className="px-2.5 py-1 text-[10.5px] font-medium text-white/40 uppercase tracking-wider">
                      Where to Generate
                    </div>
                    {availablePlatforms.map((plat) => {
                      const st = getPlatformConnectionStatus(
                        plat.id,
                        byok,
                        chromeBridge,
                        externalMcpServers,
                        plat,
                        liveConnStatusObj
                      );
                      const active = plat.id === effectivePlatformId;
                      return (
                        <button
                          key={plat.id}
                          type="button"
                          onClick={() => {
                            setNodePlatformAndModel(selectedNode.id, plat.id);
                            setOpenMenu(null);
                          }}
                          className={`w-full px-2.5 py-1.5 rounded-[8px] text-left flex items-center justify-between gap-2 transition-colors ${
                            active ? 'bg-white/[0.1] text-white' : 'hover:bg-white/[0.06] text-white/85'
                          }`}
                        >
                          <div className="min-w-0 flex items-center gap-2">
                            <PlatformBrandIcon platformId={plat.id} size="sm" />
                            <div className="min-w-0">
                              <div className="text-[12px] font-medium flex items-center gap-1.5">
                                <span
                                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                    st.connected ? 'bg-[#10b981]' : 'bg-white/25'
                                  }`}
                                />
                                <span className="truncate">{plat.name}</span>
                              </div>
                              <div className="text-[10.5px] text-white/40 truncate">
                                {st.connected ? st.summary : 'Click to select · Setup credits'}
                              </div>
                            </div>
                          </div>
                          {active && (
                            <Check className="w-3.5 h-3.5 text-[#20D5EC] shrink-0" strokeWidth={2} />
                          )}
                        </button>
                      );
                    })}
                    <div className="my-1 h-px bg-white/[0.07]" />
                    <button
                      type="button"
                      onClick={() => {
                        setOpenMenu(null);
                        openProviderModal('byok', effectivePlatformId);
                      }}
                      className="w-full h-8 px-2.5 rounded-[8px] hover:bg-white/[0.08] text-[11.5px] text-[#20D5EC] flex items-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" strokeWidth={1.75} />
                      <span>Connect Platform / MCP Credits…</span>
                    </button>
                  </div>
                )}
              </div>

              {/* 2. MODEL Selector (Searchable Grouped Studio Picker) */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() =>
                    setOpenMenu(openMenu === 'model' ? null : 'model')
                  }
                  className="h-8 px-2.5 rounded-[8px] bg-[#252525] hover:bg-white/[0.11] border border-white/[0.08] text-[12px] text-white/90 flex items-center gap-1.5 transition-colors max-w-[220px]"
                  title="Model on selected platform"
                >
                  {activeModelDef?.supportsUnlim && (
                    <span className="text-[10px] font-semibold text-emerald-300 shrink-0">
                      ∞
                    </span>
                  )}
                  <span className="truncate">
                    {activeModelDef?.label ||
                      (effectivePlatformId === 'custom-mcp'
                        ? 'Connect MCP Tool…'
                        : resolveModelDisplayLabel(
                            effectivePlatformId,
                            selectedNode.modelId,
                            platformsCatalog
                          ) || 'Select Model')}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 text-white/45 shrink-0" strokeWidth={1.6} />
                </button>

                {openMenu === 'model' && (
                  <div className="absolute bottom-full left-0 mb-1.5 w-[370px] rounded-[13px] dreamina-menu z-50 flex flex-col overflow-hidden">
                    <div className="p-2 border-b border-white/[0.07] space-y-2">
                      <div className="flex items-center justify-between px-1">
                        <span className="text-[10.5px] font-medium text-white/45 uppercase tracking-wider">
                          {activePlatformDef?.name || 'Platform'} · {availableModels.length}{' '}
                          {modality === 'video'
                            ? 'Video Models'
                            : modality === 'audio'
                            ? 'Audio Models'
                            : 'Image Models'}
                        </span>
                        {(modelSearch || modelFamilyFilter !== 'All') && (
                          <button
                            type="button"
                            onClick={() => {
                              setModelSearch('');
                              setModelFamilyFilter('All');
                            }}
                            className="text-[10px] text-[#20D5EC] hover:underline"
                          >
                            Clear filter
                          </button>
                        )}
                      </div>

                      {availableModels.length > 6 && (
                        <div className="relative">
                          <Search className="w-3.5 h-3.5 text-white/35 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                          <input
                            autoFocus
                            value={modelSearch}
                            onChange={(e) => setModelSearch(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Escape') setOpenMenu(null);
                            }}
                            placeholder="Search 100+ models: ChatGPT, Kling, Cinema, Veo, Seedance, FLUX…"
                            className="w-full h-8 pl-8 pr-2.5 rounded-[8px] bg-[#141414] border border-white/[0.08] focus:border-[#20D5EC]/45 text-[11.5px] text-white placeholder:text-white/35 outline-none select-text"
                          />
                        </div>
                      )}

                      {availableModels.length > 6 && dynamicFamilyChips.length > 2 && (
                        <div className="flex items-center gap-1 overflow-x-auto pb-0.5 no-scrollbar">
                          {dynamicFamilyChips.map((chip) => {
                            const isChipActive = modelFamilyFilter === chip;
                            return (
                              <button
                                key={chip}
                                type="button"
                                onClick={() => setModelFamilyFilter(chip)}
                                className={`h-6 px-2 rounded-full text-[10.5px] font-medium whitespace-nowrap border transition-colors ${
                                  isChipActive
                                    ? chip === '∞ Unlim'
                                      ? 'bg-emerald-500/20 border-emerald-400/45 text-emerald-200'
                                      : 'bg-white text-[#0e0e0e] border-white'
                                    : 'bg-white/[0.04] hover:bg-white/[0.08] border-white/[0.08] text-white/65'
                                }`}
                              >
                                {chip}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <div className="max-h-[340px] overflow-y-auto p-1.5 space-y-2">
                      {availableModels.length === 0 ? (
                        <div className="px-2.5 py-2 text-[11.5px] text-white/55 space-y-2">
                          <p>No MCP tools registered yet.</p>
                          <button
                            type="button"
                            onClick={() => {
                              setOpenMenu(null);
                              openProviderModal('mcp');
                            }}
                            className="h-7 px-2.5 rounded-[7px] bg-white text-[#0e0e0e] font-medium text-[11.5px]"
                          >
                            Add MCP Server →
                          </button>
                        </div>
                      ) : groupedVisibleModels.length === 0 ? (
                        <div className="px-3 py-4 text-center text-[11.5px] text-white/45">
                          No models match &ldquo;{modelSearch}&rdquo;.
                        </div>
                      ) : (
                        groupedVisibleModels.map((grp) => (
                          <div key={grp.family} className="space-y-0.5">
                            {groupedVisibleModels.length > 1 && (
                              <div className="px-2 py-0.5 text-[10px] font-semibold text-white/35 uppercase tracking-wider">
                                {grp.family}
                              </div>
                            )}
                            {grp.models.map((m) => {
                              const active = m.id === (activeModelDef?.id || canonicalSelectedModelId);
                              return (
                                <button
                                  key={m.id}
                                  type="button"
                                  onClick={() => {
                                    setNodePlatformAndModel(
                                      selectedNode.id,
                                      effectivePlatformId,
                                      m.id
                                    );
                                    setOpenMenu(null);
                                  }}
                                  className={`w-full px-2.5 py-1.5 rounded-[8px] text-left flex items-center justify-between gap-2 transition-colors ${
                                    active
                                      ? 'bg-white/[0.11] text-white'
                                      : 'hover:bg-white/[0.06] text-white/85'
                                  }`}
                                >
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="text-[12px] font-medium truncate">
                                        {m.label}
                                      </span>
                                      {m.supportsUnlim && (
                                        <span className="px-1.5 py-px rounded-[4px] bg-emerald-500/15 border border-emerald-400/25 text-[9.5px] font-semibold text-emerald-300 shrink-0">
                                          ∞ UNLIM
                                        </span>
                                      )}
                                      {m.supportsStartEndFrames && (
                                        <span className="px-1 py-px rounded-[4px] bg-white/[0.07] text-[9px] text-white/60 shrink-0">
                                          Start/End
                                        </span>
                                      )}
                                      {!m.supportsStartEndFrames && m.supportsReferences && (
                                        <span className="px-1 py-px rounded-[4px] bg-white/[0.07] text-[9px] text-white/55 shrink-0">
                                          Ref
                                        </span>
                                      )}
                                      {modality === 'video' && m.supportsAudio && (
                                        <span className="px-1 py-px rounded-[4px] bg-[#20D5EC]/15 text-[9px] text-[#20D5EC] shrink-0">
                                          Audio
                                        </span>
                                      )}
                                    </div>
                                    {m.description && (
                                      <div className="text-[10.5px] text-white/42 line-clamp-1 mt-0.5">
                                        {m.description}
                                      </div>
                                    )}
                                  </div>
                                  {active && (
                                    <Check className="w-3.5 h-3.5 text-[#20D5EC] shrink-0" strokeWidth={2} />
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* 3. DYNAMIC MODEL-AWARE PARAMETER PILLS */}
              {modality !== 'audio' && aspectOptions.length > 0 && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() =>
                      setOpenMenu(openMenu === 'aspect' ? null : 'aspect')
                    }
                    className="h-8 px-2 rounded-[8px] bg-[#252525] hover:bg-white/[0.11] border border-white/[0.07] font-mono text-[11.5px] text-white/85 flex items-center gap-1"
                    title="Aspect Ratio"
                  >
                    <span>{selectedNode.aspectRatio}</span>
                    <ChevronDown className="w-3 h-3 text-white/40" strokeWidth={1.6} />
                  </button>
                  {openMenu === 'aspect' && (
                    <div className="absolute bottom-full left-0 mb-1.5 w-[132px] max-h-[260px] overflow-y-auto p-1 rounded-[10px] dreamina-menu z-50 space-y-0.5">
                      {aspectOptions.map((ar) => (
                        <button
                          key={ar}
                          type="button"
                          onClick={() => {
                            setNodeAspectRatio(selectedNode.id, ar);
                            setOpenMenu(null);
                          }}
                          className={`w-full h-7 px-2.5 rounded-[7px] font-mono text-[11.5px] flex items-center justify-between ${
                            String(selectedNode.aspectRatio).toLowerCase() === ar.toLowerCase()
                              ? 'bg-white/[0.1] text-white'
                              : 'hover:bg-white/[0.06] text-white/80'
                          }`}
                        >
                          <span>{ar}</span>
                          {String(selectedNode.aspectRatio).toLowerCase() === ar.toLowerCase() && (
                            <Check className="w-3 h-3 text-[#20D5EC]" strokeWidth={2} />
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {showResolutionPill && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() =>
                      setOpenMenu(openMenu === 'resolution' ? null : 'resolution')
                    }
                    className="h-8 px-2 rounded-[8px] bg-[#252525] hover:bg-white/[0.11] border border-white/[0.07] font-mono text-[11.5px] text-white/85 flex items-center gap-1"
                    title="Output Resolution"
                  >
                    <span>{selectedNode.resolution}</span>
                    <ChevronDown className="w-3 h-3 text-white/40" strokeWidth={1.6} />
                  </button>
                  {openMenu === 'resolution' && (
                    <div className="absolute bottom-full left-0 mb-1.5 w-[118px] p-1 rounded-[10px] dreamina-menu z-50 space-y-0.5">
                      {resolutionOptions.map((res) => {
                        const isActiveRes =
                          String(selectedNode.resolution).toLowerCase() === res.toLowerCase();
                        return (
                          <button
                            key={res}
                            type="button"
                            onClick={() => {
                              updateNodeFields(selectedNode.id, { resolution: res });
                              setOpenMenu(null);
                            }}
                            className={`w-full h-7 px-2.5 rounded-[7px] font-mono text-[11.5px] flex items-center justify-between ${
                              isActiveRes
                                ? 'bg-white/[0.1] text-white'
                                : 'hover:bg-white/[0.06] text-white/80'
                            }`}
                          >
                            <span>{res}</span>
                            {isActiveRes && (
                              <Check className="w-3 h-3 text-[#20D5EC]" strokeWidth={2} />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* First-Class Quality Pill */}
              {qualitySpec && (qualitySpec.options?.length || 0) > 0 && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() =>
                      setOpenMenu(openMenu === 'quality' ? null : 'quality')
                    }
                    className="h-8 px-2.5 rounded-[8px] bg-[#252525] hover:bg-white/[0.11] border border-white/[0.07] text-[11.5px] text-white/90 flex items-center gap-1"
                    title={qualitySpec.description || 'Rendering quality tier'}
                  >
                    <span className="text-white/50">Quality:</span>
                    <span className="font-medium text-white">
                      {formatParamOptionLabel(activeQualityVal ?? '')}
                    </span>
                    <ChevronDown className="w-3 h-3 text-white/40" strokeWidth={1.6} />
                  </button>
                  {openMenu === 'quality' && (
                    <div className="absolute bottom-full left-0 mb-1.5 w-[144px] p-1 rounded-[10px] dreamina-menu z-50 space-y-0.5">
                      <div className="px-2 py-0.5 text-[10px] font-medium text-white/40 uppercase tracking-wider">
                        Quality Tier
                      </div>
                      {(qualitySpec.options || []).map((opt) => {
                        const activeOpt =
                          String(activeQualityVal ?? '').toLowerCase() ===
                          String(opt).toLowerCase();
                        return (
                          <button
                            key={String(opt)}
                            type="button"
                            onClick={() => {
                              updateModelParam('quality', opt);
                              setOpenMenu(null);
                            }}
                            className={`w-full h-7 px-2.5 rounded-[7px] text-[11.5px] flex items-center justify-between ${
                              activeOpt
                                ? 'bg-white/[0.1] text-white font-medium'
                                : 'hover:bg-white/[0.06] text-white/80'
                            }`}
                          >
                            <span>{formatParamOptionLabel(opt)}</span>
                            {activeOpt && (
                              <Check className="w-3 h-3 text-[#20D5EC]" strokeWidth={2} />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* First-Class Mode / Variant Pill */}
              {modeSpec && (modeSpec.options?.length || 0) > 0 && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() =>
                      setOpenMenu(openMenu === 'mode' ? null : 'mode')
                    }
                    className="h-8 px-2.5 rounded-[8px] bg-[#252525] hover:bg-white/[0.11] border border-white/[0.07] text-[11.5px] text-white/90 flex items-center gap-1 max-w-[175px]"
                    title={modeSpec.description || modeSpec.label || 'Model mode / variant'}
                  >
                    <span className="text-white/50 shrink-0">
                      {modeSpec.label || (modeSpec.name === 'variant' ? 'Variant' : 'Mode')}:
                    </span>
                    <span className="font-medium text-white truncate">
                      {formatParamOptionLabel(activeModeVal ?? '')}
                    </span>
                    <ChevronDown className="w-3 h-3 text-white/40 shrink-0" strokeWidth={1.6} />
                  </button>
                  {openMenu === 'mode' && (
                    <div className="absolute bottom-full left-0 mb-1.5 min-w-[168px] max-w-[230px] max-h-[260px] overflow-y-auto p-1 rounded-[10px] dreamina-menu z-50 space-y-0.5">
                      <div className="px-2 py-0.5 text-[10px] font-medium text-white/40 uppercase tracking-wider">
                        {modeSpec.label || modeSpec.name}
                      </div>
                      {(modeSpec.options || []).map((opt) => {
                        const activeOpt =
                          String(activeModeVal ?? '').toLowerCase() ===
                          String(opt).toLowerCase();
                        return (
                          <button
                            key={String(opt)}
                            type="button"
                            onClick={() => {
                              updateModelParam(modeSpec.name, opt);
                              setOpenMenu(null);
                            }}
                            className={`w-full h-7 px-2.5 rounded-[7px] text-[11.5px] flex items-center justify-between gap-2 ${
                              activeOpt
                                ? 'bg-white/[0.1] text-white font-medium'
                                : 'hover:bg-white/[0.06] text-white/80'
                            }`}
                          >
                            <span className="truncate">{formatParamOptionLabel(opt)}</span>
                            {activeOpt && (
                              <Check className="w-3 h-3 text-[#20D5EC] shrink-0" strokeWidth={2} />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Image Batch Count */}
              {modality === 'image' && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() =>
                      setOpenMenu(openMenu === 'batch' ? null : 'batch')
                    }
                    className="h-8 px-2 rounded-[8px] bg-[#252525] hover:bg-white/[0.11] border border-white/[0.07] font-mono text-[11.5px] text-white/85 flex items-center gap-1"
                    title="Batch image count"
                  >
                    <span>{selectedNode.batchCount || 1}×</span>
                    <ChevronDown className="w-3 h-3 text-white/40" strokeWidth={1.6} />
                  </button>
                  {openMenu === 'batch' && (
                    <div className="absolute bottom-full left-0 mb-1.5 w-[108px] p-1 rounded-[10px] dreamina-menu z-50 space-y-0.5">
                      {BATCH_COUNTS.map((cnt) => (
                        <button
                          key={cnt}
                          type="button"
                          onClick={() => {
                            updateNodeFields(selectedNode.id, { batchCount: cnt });
                            setOpenMenu(null);
                          }}
                          className={`w-full h-7 px-2.5 rounded-[7px] font-mono text-[11.5px] flex items-center justify-between ${
                            (selectedNode.batchCount || 1) === cnt
                              ? 'bg-white/[0.1] text-white'
                              : 'hover:bg-white/[0.06] text-white/80'
                          }`}
                        >
                          <span>{cnt} {cnt === 1 ? 'image' : 'images'}</span>
                          {(selectedNode.batchCount || 1) === cnt && (
                            <Check className="w-3 h-3 text-[#20D5EC]" strokeWidth={2} />
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Video Duration + DoP Camera Rig + Dynamic Audio Toggle */}
              {modality === 'video' && (
                <>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() =>
                        setOpenMenu(openMenu === 'duration' ? null : 'duration')
                      }
                      className="h-8 px-2 rounded-[8px] bg-[#252525] hover:bg-white/[0.11] border border-white/[0.07] font-mono text-[11.5px] text-white/85 flex items-center gap-1"
                      title="Clip Duration"
                    >
                      <span>
                        {(selectedNode.durationSec ?? activeModelDef?.defaultDurationSec ?? 5) === -1
                          ? 'Auto'
                          : `${selectedNode.durationSec ?? activeModelDef?.defaultDurationSec ?? 5}s`}
                      </span>
                      <ChevronDown className="w-3 h-3 text-white/40" strokeWidth={1.6} />
                    </button>
                    {openMenu === 'duration' && (
                      <div className="absolute bottom-full left-0 mb-1.5 w-[108px] max-h-[240px] overflow-y-auto p-1 rounded-[10px] dreamina-menu z-50 space-y-0.5">
                        {durationOptions.map((sec) => (
                          <button
                            key={sec}
                            type="button"
                            onClick={() => {
                              updateNodeFields(selectedNode.id, { durationSec: sec });
                              setOpenMenu(null);
                            }}
                            className={`w-full h-7 px-2.5 rounded-[7px] font-mono text-[11.5px] flex items-center justify-between ${
                              (selectedNode.durationSec ?? activeModelDef?.defaultDurationSec ?? 5) === sec
                                ? 'bg-white/[0.1] text-white'
                                : 'hover:bg-white/[0.06] text-white/80'
                            }`}
                          >
                            <span>{sec === -1 ? 'Auto' : `${sec}s`}</span>
                            {(selectedNode.durationSec ?? activeModelDef?.defaultDurationSec ?? 5) === sec && (
                              <Check className="w-3 h-3 text-[#20D5EC]" strokeWidth={2} />
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Higgsfield-Style DoP Camera Motion Rig */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() =>
                        setOpenMenu(openMenu === 'camera' ? null : 'camera')
                      }
                      className={`h-8 px-2.5 rounded-[8px] border text-[11.5px] flex items-center gap-1.5 transition-colors max-w-[165px] ${
                        selectedNode.cameraMotion &&
                        selectedNode.cameraMotion !== 'Static Tripod'
                          ? 'bg-[#252525] border-[#20D5EC]/40 text-white'
                          : 'bg-[#252525] hover:bg-white/[0.11] border-white/[0.07] text-white/85'
                      }`}
                      title="DoP Rig · Camera Motion Control"
                    >
                      <Camera
                        className={`w-3.5 h-3.5 shrink-0 ${
                          selectedNode.cameraMotion &&
                          selectedNode.cameraMotion !== 'Static Tripod'
                            ? 'text-[#20D5EC]'
                            : 'text-white/55'
                        }`}
                        strokeWidth={1.6}
                      />
                      <span className="truncate">
                        {selectedNode.cameraMotion || 'DoP Rig'}
                      </span>
                      <ChevronDown className="w-3 h-3 text-white/40 shrink-0" strokeWidth={1.6} />
                    </button>
                    {openMenu === 'camera' && (
                      <div className="absolute bottom-full left-0 mb-1.5 w-[212px] p-1.5 rounded-[11px] dreamina-menu z-50 space-y-0.5">
                        <div className="px-2 py-1 text-[10px] font-medium text-white/40 uppercase tracking-wider">
                          Camera Motion (DoP Rig)
                        </div>
                        {DOP_CAMERA_MOTIONS.map((preset) => {
                          const active =
                            (selectedNode.cameraMotion || 'Static Tripod') === preset;
                          return (
                            <button
                              key={preset}
                              type="button"
                              onClick={() => {
                                updateNodeFields(selectedNode.id, {
                                  cameraMotion: preset,
                                });
                                setOpenMenu(null);
                              }}
                              className={`w-full h-7 px-2.5 rounded-[7px] text-[11.5px] flex items-center justify-between text-left ${
                                active
                                  ? 'bg-white/[0.1] text-white font-medium'
                                  : 'hover:bg-white/[0.06] text-white/80'
                              }`}
                            >
                              <span>{preset}</span>
                              {active && (
                                <Check className="w-3.5 h-3.5 text-[#20D5EC]" strokeWidth={2} />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {showVideoAudioPill && (
                    <button
                      type="button"
                      onClick={() =>
                        updateNodeFields(selectedNode.id, {
                          audioEnabled: !(selectedNode.audioEnabled ?? true),
                        })
                      }
                      className={`h-8 px-2 rounded-[8px] border text-[11.5px] flex items-center gap-1 transition-colors ${
                        selectedNode.audioEnabled ?? true
                          ? 'bg-[#252525] border-white/[0.1] text-white/90'
                          : 'bg-[#191919] border-white/[0.06] text-white/40'
                      }`}
                      title="Toggle native video audio"
                    >
                      {selectedNode.audioEnabled ?? true ? (
                        <Volume2 className="w-3.5 h-3.5 text-[#20D5EC]" strokeWidth={1.6} />
                      ) : (
                        <VolumeX className="w-3.5 h-3.5" strokeWidth={1.6} />
                      )}
                      <span>Audio</span>
                    </button>
                  )}
                </>
              )}

              {/* Audio Mode + Voice + Duration */}
              {modality === 'audio' && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      const nextMode = selectedNode.audioMode === 'sfx' ? 'tts' : 'sfx';
                      const nextModel =
                        nextMode === 'sfx'
                          ? 'eleven_text_to_sound_v2'
                          : 'eleven_multilingual_v2';
                      updateNodeFields(selectedNode.id, {
                        audioMode: nextMode,
                        modelId:
                          effectivePlatformId === 'elevenlabs'
                            ? nextModel
                            : selectedNode.modelId,
                      });
                    }}
                    className="h-8 px-2.5 rounded-[8px] bg-[#252525] hover:bg-white/[0.11] border border-white/[0.07] text-[11.5px] text-white/90"
                    title="Switch between Voice TTS and Sound Effects"
                  >
                    {selectedNode.audioMode === 'sfx' ? 'Mode: SFX' : 'Mode: Voice TTS'}
                  </button>

                  {selectedNode.audioMode !== 'sfx' && (
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() =>
                          setOpenMenu(openMenu === 'voice' ? null : 'voice')
                        }
                        className="h-8 px-2.5 rounded-[8px] bg-[#252525] hover:bg-white/[0.11] border border-white/[0.07] text-[11.5px] text-white/90 flex items-center gap-1"
                      >
                        <span>Voice: {activeVoice.name}</span>
                        <ChevronDown className="w-3 h-3 text-white/40" strokeWidth={1.6} />
                      </button>
                      {openMenu === 'voice' && (
                        <div className="absolute bottom-full left-0 mb-1.5 w-[220px] p-1 rounded-[10px] dreamina-menu z-50 space-y-0.5">
                          {ELEVENLABS_VOICES.map((v) => (
                            <button
                              key={v.id}
                              type="button"
                              onClick={() => {
                                updateNodeFields(selectedNode.id, { voiceId: v.id });
                                setOpenMenu(null);
                              }}
                              className={`w-full px-2.5 py-1.5 rounded-[7px] text-left flex items-center justify-between ${
                                (selectedNode.voiceId || ELEVENLABS_VOICES[0].id) === v.id
                                  ? 'bg-white/[0.1] text-white'
                                  : 'hover:bg-white/[0.06] text-white/85'
                              }`}
                            >
                              <div>
                                <div className="text-[12px] font-medium">{v.name}</div>
                                <div className="text-[10.5px] text-white/40">{v.accent}</div>
                              </div>
                              {(selectedNode.voiceId || ELEVENLABS_VOICES[0].id) ===
                                v.id && (
                                <Check className="w-3.5 h-3.5 text-[#20D5EC]" strokeWidth={2} />
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="relative">
                    <button
                      type="button"
                      onClick={() =>
                        setOpenMenu(openMenu === 'duration' ? null : 'duration')
                      }
                      className="h-8 px-2 rounded-[8px] bg-[#252525] hover:bg-white/[0.11] border border-white/[0.07] font-mono text-[11.5px] text-white/85 flex items-center gap-1"
                    >
                      <span>{selectedNode.durationSec || 8}s</span>
                      <ChevronDown className="w-3 h-3 text-white/40" strokeWidth={1.6} />
                    </button>
                    {openMenu === 'duration' && (
                      <div className="absolute bottom-full left-0 mb-1.5 w-[100px] p-1 rounded-[10px] dreamina-menu z-50 space-y-0.5">
                        {durationOptions.map((sec) => (
                          <button
                            key={sec}
                            type="button"
                            onClick={() => {
                              updateNodeFields(selectedNode.id, { durationSec: sec });
                              setOpenMenu(null);
                            }}
                            className={`w-full h-7 px-2.5 rounded-[7px] hover:bg-white/[0.08] font-mono text-[11.5px] flex items-center justify-between ${
                              (selectedNode.durationSec || 8) === sec
                                ? 'bg-white/[0.1] text-white'
                                : 'text-white/85'
                            }`}
                          >
                            <span>{sec}s</span>
                            {(selectedNode.durationSec || 8) === sec && (
                              <Check className="w-3 h-3 text-[#20D5EC]" strokeWidth={2} />
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Full Model Parameters + Connection Route + Negative Prompt + Seed Popover */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() =>
                    setOpenMenu(openMenu === 'advanced' ? null : 'advanced')
                  }
                  className={`relative h-8 px-2 rounded-[8px] border flex items-center justify-center gap-1 transition-colors ${
                    openMenu === 'advanced'
                      ? 'bg-white text-[#0e0e0e] border-white'
                      : customParamCount > 0
                      ? 'bg-[#252525] hover:bg-white/[0.11] border-[#20D5EC]/40 text-white'
                      : 'bg-[#252525] hover:bg-white/[0.11] border-white/[0.07] text-white/75'
                  }`}
                  title="Model Parameters, Connection Route, Negative Prompt & Seed"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" strokeWidth={1.6} />
                  {customParamCount > 0 && (
                    <span className="h-4 min-w-[16px] px-1 rounded-full bg-[#20D5EC]/20 text-[#20D5EC] font-mono text-[10px] font-semibold flex items-center justify-center">
                      {customParamCount}
                    </span>
                  )}
                </button>

                {openMenu === 'advanced' && (
                  <div className="absolute bottom-full right-0 mb-1.5 w-[340px] max-h-[420px] overflow-y-auto p-3 rounded-[13px] dreamina-menu z-50 space-y-3 text-[12px]">
                    {remainingParamSpecs.length > 0 && (
                      <div className="space-y-2.5 pb-2.5 border-b border-white/[0.08]">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10.5px] font-medium text-white/50 uppercase tracking-wider truncate">
                            Model Parameters · {activeModelDef?.label}
                          </span>
                          {customParamCount > 0 && (
                            <button
                              type="button"
                              onClick={resetModelParamDefaults}
                              className="inline-flex items-center gap-1 text-[10.5px] text-[#20D5EC] hover:underline shrink-0"
                            >
                              <RotateCcw className="w-3 h-3" />
                              <span>Reset</span>
                            </button>
                          )}
                        </div>

                        <div className="space-y-2">
                          {remainingParamSpecs.map((spec) => {
                            const curVal = resolveModelParamValue(
                              selectedNode.modelParams,
                              selectedNode.quality,
                              spec
                            );

                            if (spec.type === 'boolean') {
                              const checked = Boolean(curVal);
                              return (
                                <div
                                  key={spec.name}
                                  className="flex items-center justify-between gap-2"
                                  title={spec.description}
                                >
                                  <span className="text-[11.5px] text-white/80">
                                    {spec.label || spec.name}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => updateModelParam(spec.name, !checked)}
                                    className={`h-6 px-2.5 rounded-full text-[11px] font-medium border transition-colors ${
                                      checked
                                        ? 'bg-[#20D5EC]/20 border-[#20D5EC]/45 text-[#20D5EC]'
                                        : 'bg-[#141414] border-white/[0.08] text-white/55 hover:text-white/80'
                                    }`}
                                  >
                                    {checked ? 'On' : 'Off'}
                                  </button>
                                </div>
                              );
                            }

                            if (spec.type === 'enum' && spec.options?.length) {
                              const opts = spec.options;
                              const useSegmented =
                                opts.length <= 5 &&
                                opts.every((o) => String(o).length <= 14);
                              return (
                                <div key={spec.name} className="space-y-1" title={spec.description}>
                                  <label className="text-[11px] text-white/60 block">
                                    {spec.label || spec.name}
                                  </label>
                                  {useSegmented ? (
                                    <div className="flex flex-wrap gap-1">
                                      {opts.map((opt) => {
                                        const isOptActive =
                                          String(curVal ?? '') === String(opt);
                                        return (
                                          <button
                                            key={String(opt)}
                                            type="button"
                                            onClick={() => updateModelParam(spec.name, opt)}
                                            className={`h-6 px-2 rounded-[6px] text-[11px] border transition-colors ${
                                              isOptActive
                                                ? 'bg-white text-[#0e0e0e] border-white font-semibold'
                                                : 'bg-[#141414] hover:bg-white/[0.08] border-white/[0.08] text-white/75'
                                            }`}
                                          >
                                            {formatParamOptionLabel(opt)}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  ) : (
                                    <select
                                      value={String(curVal ?? opts[0])}
                                      onChange={(e) => {
                                        const raw = e.target.value;
                                        const matched = opts.find((o) => String(o) === raw);
                                        updateModelParam(spec.name, matched ?? raw);
                                      }}
                                      className="w-full h-7 px-2 rounded-[7px] bg-[#141414] border border-white/[0.08] text-[11.5px] text-white outline-none"
                                    >
                                      {opts.map((opt) => (
                                        <option key={String(opt)} value={String(opt)}>
                                          {formatParamOptionLabel(opt)}
                                        </option>
                                      ))}
                                    </select>
                                  )}
                                </div>
                              );
                            }

                            if (spec.type === 'number') {
                              return (
                                <div
                                  key={spec.name}
                                  className="flex items-center justify-between gap-2"
                                  title={spec.description}
                                >
                                  <label className="text-[11px] text-white/70 truncate">
                                    {spec.label || spec.name}
                                    {spec.min !== undefined && spec.max !== undefined
                                      ? ` (${spec.min}–${spec.max})`
                                      : ''}
                                  </label>
                                  <input
                                    type="number"
                                    min={spec.min}
                                    max={spec.max}
                                    step={spec.step ?? (spec.max && spec.max <= 2 ? 0.05 : 1)}
                                    value={curVal !== undefined ? Number(curVal) : ''}
                                    placeholder={
                                      spec.default !== undefined ? String(spec.default) : 'Auto'
                                    }
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      updateModelParam(
                                        spec.name,
                                        val === '' ? undefined : Number(val)
                                      );
                                    }}
                                    className="w-24 h-7 px-2 rounded-[7px] bg-[#141414] border border-white/[0.08] font-mono text-[11.5px] text-white outline-none select-text"
                                  />
                                </div>
                              );
                            }

                            return (
                              <div key={spec.name} className="space-y-1" title={spec.description}>
                                <label className="text-[11px] text-white/60 block">
                                  {spec.label || spec.name}
                                </label>
                                <input
                                  value={curVal !== undefined ? String(curVal) : ''}
                                  onChange={(e) =>
                                    updateModelParam(
                                      spec.name,
                                      e.target.value ? e.target.value : undefined
                                    )
                                  }
                                  placeholder={spec.description || spec.name}
                                  className="w-full h-7 px-2.5 rounded-[7px] bg-[#141414] border border-white/[0.08] text-[11.5px] text-white outline-none select-text"
                                />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <div className="space-y-1">
                      <label className="text-[10.5px] font-medium text-white/45 uppercase tracking-wider">
                        Credit Connection Route
                      </label>
                      <div className="space-y-1">
                        {TRANSPORT_OPTIONS.map((tr) => {
                          const active = (selectedNode.connectionMode || 'auto') === tr.id;
                          return (
                            <button
                              key={tr.id}
                              type="button"
                              onClick={() =>
                                updateNodeFields(selectedNode.id, {
                                  connectionMode: tr.id,
                                })
                              }
                              className={`w-full px-2.5 py-1.5 rounded-[8px] text-left flex items-center justify-between ${
                                active
                                  ? 'bg-white/[0.1] text-white'
                                  : 'hover:bg-white/[0.06] text-white/80'
                              }`}
                            >
                              <div>
                                <div className="text-[11.5px] font-medium">{tr.label}</div>
                                <div className="text-[10px] text-white/40">{tr.hint}</div>
                              </div>
                              {active && (
                                <Check className="w-3.5 h-3.5 text-[#20D5EC]" strokeWidth={2} />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {modality !== 'audio' && (
                      <div className="space-y-1">
                        <label className="text-[10.5px] font-medium text-white/45 uppercase tracking-wider">
                          Negative Prompt
                        </label>
                        <input
                          value={selectedNode.negativePrompt || ''}
                          onChange={(e) =>
                            updateNodeFields(selectedNode.id, {
                              negativePrompt: e.target.value,
                            })
                          }
                          placeholder="blur, watermark, distortion…"
                          className="w-full h-7 px-2.5 rounded-[7px] bg-[#141414] border border-white/[0.08] text-[11.5px] text-white outline-none select-text"
                        />
                      </div>
                    )}

                    <div className="flex items-center justify-between gap-2">
                      <label className="text-[10.5px] font-medium text-white/45 uppercase tracking-wider">
                        Seed
                      </label>
                      <input
                        type="number"
                        value={selectedNode.seed}
                        onChange={(e) =>
                          updateNodeFields(selectedNode.id, {
                            seed: Number(e.target.value) || 100,
                          })
                        }
                        className="w-28 h-7 px-2 rounded-[7px] bg-[#141414] border border-white/[0.08] font-mono text-[11.5px] text-white outline-none select-text"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right Execution CTAs */}
            <div className="flex items-center gap-1.5 shrink-0">
              {hasDownstreamEdges && (
                <button
                  type="button"
                  disabled={isGenerating || workflowRunning}
                  onClick={() => void runWorkflowPipeline(selectedNode.id)}
                  className="h-8 px-2.5 rounded-[9px] bg-[#252525] hover:bg-white/[0.12] disabled:opacity-45 border border-[#20D5EC]/35 text-[11.5px] font-medium text-[#20D5EC] flex items-center gap-1.5 transition-colors"
                  title="Generate this node, then pass its output automatically into wired downstream nodes"
                >
                  <GitBranch className="w-3.5 h-3.5" strokeWidth={1.7} />
                  <span>Run Chain</span>
                </button>
              )}

              <button
                type="button"
                disabled={isGenerating}
                onClick={() => void generateSingleNode(selectedNode.id)}
                title={`Generate on ${activePlatformDef?.name || effectivePlatformId} · ${
                  activeModelDef?.label || ''
                } (⌘Enter)`}
                className="h-8 px-3 rounded-full bg-white hover:bg-[#e5e5e5] disabled:opacity-50 text-[#0e0e0e] text-[12px] font-semibold flex items-center gap-1.5 transition-colors"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={2} />
                    <span>Generating</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3 h-3 fill-current" strokeWidth={2} />
                    <span>Generate</span>
                    <ArrowUp className="w-3.5 h-3.5" strokeWidth={2.2} />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

const MultiReferenceSelectionBar: React.FC = () => {
  const nodes = useStudioStore((s) => s.nodes);
  const selectedNodeIds = useStudioStore((s) => s.selectedNodeIds);
  const panX = useStudioStore((s) => s.panX);
  const panY = useStudioStore((s) => s.panY);
  const zoom = useStudioStore((s) => s.zoom);
  const byok = useStudioStore((s) => s.byok);
  const chromeBridge = useStudioStore((s) => s.chromeBridge);
  const platformsCatalog = useStudioStore((s) => s.platformsCatalog);
  const externalMcpServers = useStudioStore((s) => s.externalMcpServers);
  const connectedBrowserPlatforms = useStudioStore((s) => s.connectedBrowserPlatforms);
  const connectedMcpPlatforms = useStudioStore((s) => s.connectedMcpPlatforms);
  const configuredApiPlatforms = useStudioStore((s) => s.configuredApiPlatforms);
  const lastImagePlatformId = useStudioStore((s) => s.lastImagePlatformId);
  const lastVideoPlatformId = useStudioStore((s) => s.lastVideoPlatformId);
  const lastAudioPlatformId = useStudioStore((s) => s.lastAudioPlatformId);

  const spawnConnectedNodeFromSelection = useStudioStore(
    (s) => s.spawnConnectedNodeFromSelection
  );
  const duplicateNodes = useStudioStore((s) => s.duplicateNodes);
  const deleteSelectedNodes = useStudioStore((s) => s.deleteSelectedNodes);

  const selNodes = useMemo(
    () =>
      selectedNodeIds
        .map((id) => nodes.find((n) => n.id === id))
        .filter((n): n is NonNullable<typeof n> => Boolean(n)),
    [nodes, selectedNodeIds]
  );

  const refChips = useMemo(() => {
    let imgIdx = 0;
    let vidIdx = 0;
    let txtIdx = 0;
    return selNodes.map((n) => {
      if (n.kind === 'image' || n.kind === 'element' || n.kind === 'contact-sheet') {
        imgIdx += 1;
        const tag = n.elementHandles[0] || `@Image${imgIdx}`;
        return {
          id: n.id,
          type: 'image' as const,
          tag,
          label: n.title,
          thumbUrl: n.imageUrl,
          imgOrder: imgIdx - 1,
        };
      }
      if (n.kind === 'video') {
        vidIdx += 1;
        return {
          id: n.id,
          type: 'video' as const,
          tag: `@Video${vidIdx}`,
          label: n.title,
          thumbUrl: n.imageUrl,
        };
      }
      if (n.kind === 'text' || n.kind === 'sticky') {
        txtIdx += 1;
        return {
          id: n.id,
          type: 'text' as const,
          tag: `@Text${txtIdx}`,
          label: n.prompt.trim().slice(0, 40) || n.title,
        };
      }
      return {
        id: n.id,
        type: 'style' as const,
        tag: n.kind === 'style-dna' ? '@StyleDNA' : `@${n.title.replace(/\s+/g, '_')}`,
        label: n.title,
      };
    });
  }, [selNodes]);

  const imageChipCount = refChips.filter((c) => c.type === 'image').length;
  const videoChipCount = refChips.filter((c) => c.type === 'video').length;

  const [targetKind, setTargetKind] = useState<'image' | 'video' | 'audio'>(() =>
    videoChipCount > 0 ? 'video' : 'video'
  );
  const [referenceFrameMode, setReferenceFrameMode] = useState<'multi-ref' | 'start-end'>(
    'multi-ref'
  );
  const [composerPrompt, setComposerPrompt] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<
    null | 'platform' | 'model' | 'aspect' | 'resolution' | 'duration' | 'batch'
  >(null);

  const selectionSignature = selectedNodeIds.join('|');
  useEffect(() => {
    const initialText = selNodes
      .filter((n) => (n.kind === 'text' || n.kind === 'sticky') && n.prompt.trim())
      .map((n) => n.prompt.trim())
      .join('\n');
    setComposerPrompt(initialText);
    setTargetKind(videoChipCount > 0 ? 'video' : imageChipCount >= 2 ? 'video' : 'image');
    setReferenceFrameMode('multi-ref');
    setOpenDropdown(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectionSignature]);

  const [platformId, setPlatformId] = useState<PlatformId>(lastVideoPlatformId);
  useEffect(() => {
    setPlatformId(
      targetKind === 'video'
        ? lastVideoPlatformId
        : targetKind === 'audio'
        ? lastAudioPlatformId
        : lastImagePlatformId
    );
  }, [targetKind, lastImagePlatformId, lastVideoPlatformId, lastAudioPlatformId]);

  const availablePlatforms = useMemo(
    () => getPlatformsForModality(targetKind, platformsCatalog),
    [platformsCatalog, targetKind]
  );

  const effectivePlatformId: PlatformId = availablePlatforms.some((p) => p.id === platformId)
    ? platformId
    : availablePlatforms[0]?.id || platformId;

  const availableModels = useMemo(
    () =>
      getModelsForPlatformAndModality(
        effectivePlatformId,
        targetKind,
        platformsCatalog,
        externalMcpServers
      ),
    [effectivePlatformId, targetKind, platformsCatalog, externalMcpServers]
  );

  const [modelId, setModelId] = useState<string>(availableModels[0]?.id || '');
  const activeModel =
    availableModels.find((m) => m.id === modelId) || availableModels[0] || null;

  const [aspectRatio, setAspectRatio] = useState<AspectRatio>(
    activeModel?.defaultAspect || '16:9'
  );
  const [resolution, setResolution] = useState<ResolutionTier>(
    activeModel?.defaultResolution || (targetKind === 'video' ? '1080p' : '2K')
  );
  const [durationSec, setDurationSec] = useState<number>(
    activeModel?.defaultDurationSec || 5
  );
  const [batchCount, setBatchCount] = useState<1 | 2 | 4>(1);
  const [modelParams, setModelParams] = useState<Record<string, string | number | boolean>>(
    {}
  );

  useEffect(() => {
    const nextModel = availableModels[0];
    if (!nextModel) return;
    setModelId(nextModel.id);
    if (nextModel.defaultAspect) setAspectRatio(nextModel.defaultAspect);
    if (nextModel.defaultResolution) setResolution(nextModel.defaultResolution);
    if (nextModel.defaultDurationSec) setDurationSec(nextModel.defaultDurationSec);
    const defaults: Record<string, string | number | boolean> = {};
    for (const p of nextModel.parameters || []) {
      if (p.default !== undefined) defaults[p.name] = p.default;
    }
    setModelParams(defaults);
  }, [effectivePlatformId, targetKind, availableModels]);

  if (selNodes.length < 2) return null;

  const minX = Math.min(...selNodes.map((n) => n.x));
  const minY = Math.min(...selNodes.map((n) => n.y));
  const maxX = Math.max(...selNodes.map((n) => n.x + n.width));
  const maxY = Math.max(...selNodes.map((n) => n.y + n.height));

  const centerScreenX = ((minX + maxX) / 2) * zoom + panX;
  const quickTop = Math.max(58, minY * zoom + panY - 50);
  const quickLeft = Math.min(window.innerWidth - 260, Math.max(260, centerScreenX));

  const composerW = Math.min(820, Math.max(600, window.innerWidth - 150));
  const composerLeft = Math.min(
    window.innerWidth - composerW - 16,
    Math.max(76, centerScreenX - composerW / 2)
  );
  const composerTop = Math.min(
    window.innerHeight - 235,
    Math.max(116, maxY * zoom + panY + 18)
  );

  const liveStatusObj = {
    connectedBrowserPlatforms,
    connectedMcpPlatforms,
    configuredApiPlatforms,
  };
  const activePlatformDef =
    availablePlatforms.find((p) => p.id === effectivePlatformId) || availablePlatforms[0];

  const handleInsertChipTag = (tag: string) => {
    setComposerPrompt((prev) => {
      const trimmed = prev.trimEnd();
      if (!trimmed) return `${tag} `;
      return trimmed.includes(tag) ? prev : `${trimmed} ${tag} `;
    });
  };

  const handleFormAndGenerate = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const fallbackPrompt =
        composerPrompt.trim() ||
        `Combine ${refChips.map((c) => c.tag).join(', ')} into a cohesive ${targetKind}`;
      await spawnConnectedNodeFromSelection(targetKind, {
        nodeIds: selNodes.map((n) => n.id),
        prompt: fallbackPrompt,
        platformId: effectivePlatformId,
        modelId: activeModel?.id || modelId,
        aspectRatio,
        resolution,
        batchCount: targetKind === 'image' ? batchCount : 1,
        durationSec: targetKind === 'video' ? durationSec : undefined,
        modelParams,
        referenceFrameMode: targetKind === 'video' ? referenceFrameMode : undefined,
        autoGenerate: true,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {/* 1. Floating Top Multi-Reference Formation Pill Bar */}
      <div
        style={{
          left: `${quickLeft}px`,
          top: `${quickTop}px`,
          transform: 'translateX(-50%)',
        }}
        onPointerDown={(e) => e.stopPropagation()}
        className="fixed z-40 h-9 px-2 rounded-[10px] dreamina-levitation flex items-center gap-1 text-[11.5px] select-none whitespace-nowrap"
      >
        <span className="px-2 py-0.5 rounded-[6px] bg-[#20D5EC]/15 border border-[#20D5EC]/35 font-semibold text-[#7ceeff]">
          {selNodes.length} Selected
        </span>
        <div className="w-px h-4 bg-white/[0.08] mx-0.5" />
        <button
          type="button"
          onClick={() =>
            void spawnConnectedNodeFromSelection('image', {
              prompt: composerPrompt,
              autoGenerate: false,
            })
          }
          className="h-7 px-2.5 rounded-[7px] hover:bg-white/[0.1] text-white/90 font-medium flex items-center gap-1.5"
        >
          <ImageIcon className="w-3.5 h-3.5 text-[#20D5EC]" strokeWidth={1.6} />
          <span>→ Reference to Image</span>
        </button>
        <button
          type="button"
          onClick={() =>
            void spawnConnectedNodeFromSelection('video', {
              prompt: composerPrompt,
              referenceFrameMode,
              autoGenerate: false,
            })
          }
          className="h-7 px-2.5 rounded-[7px] bg-white/[0.08] hover:bg-white/[0.15] text-white font-medium flex items-center gap-1.5"
        >
          <Clapperboard className="w-3.5 h-3.5 text-[#20D5EC]" strokeWidth={1.6} />
          <span>→ Reference to Video</span>
        </button>
        <button
          type="button"
          onClick={() =>
            void spawnConnectedNodeFromSelection('audio', {
              prompt: composerPrompt,
              autoGenerate: false,
            })
          }
          className="h-7 px-2.5 rounded-[7px] hover:bg-white/[0.1] text-white/85 flex items-center gap-1.5"
        >
          <AudioLines className="w-3.5 h-3.5 text-white/65" strokeWidth={1.6} />
          <span>→ Reference to Audio</span>
        </button>
        <div className="w-px h-4 bg-white/[0.08] mx-0.5" />
        <button
          type="button"
          onClick={() => duplicateNodes()}
          className="h-7 px-2 rounded-[7px] hover:bg-white/[0.08] text-white/75"
          title="Duplicate selected"
        >
          <Copy className="w-3.5 h-3.5" strokeWidth={1.5} />
        </button>
        <button
          type="button"
          onClick={() => deleteSelectedNodes()}
          className="h-7 px-2 rounded-[7px] hover:bg-red-500/15 text-red-400"
          title="Delete selected"
        >
          <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
        </button>
      </div>

      {/* 2. Dreamina Multi-Reference Composer Bar */}
      <div
        style={{
          left: `${composerLeft}px`,
          top: `${composerTop}px`,
          width: `${composerW}px`,
        }}
        onPointerDown={(e) => e.stopPropagation()}
        className="fixed z-40 rounded-[16px] dreamina-levitation p-3 space-y-2.5 select-none"
      >
        {/* Header: Modality Tabs + Start/End Toggle + Clickable @Reference Chips */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1 p-0.5 rounded-[8px] bg-[#141414] border border-white/[0.07]">
            {(['image', 'video', 'audio'] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => {
                  setTargetKind(k);
                  setOpenDropdown(null);
                }}
                className={`h-6 px-2.5 rounded-[6px] text-[11px] font-medium transition-colors flex items-center gap-1 ${
                  targetKind === k
                    ? 'bg-[#2a2a2a] text-white'
                    : 'text-white/55 hover:text-white'
                }`}
              >
                {k === 'image' ? 'Create Image' : k === 'video' ? 'Create Video' : 'Create Audio'}
              </button>
            ))}
          </div>

          {targetKind === 'video' && imageChipCount >= 2 && (
            <div className="flex items-center gap-1 p-0.5 rounded-[8px] bg-[#141414] border border-white/[0.07] text-[10.5px]">
              <button
                type="button"
                onClick={() => setReferenceFrameMode('multi-ref')}
                className={`h-5 px-2 rounded-[5px] ${
                  referenceFrameMode === 'multi-ref'
                    ? 'bg-[#20D5EC]/20 text-[#7ceeff] font-medium'
                    : 'text-white/55 hover:text-white'
                }`}
              >
                Multi-Ref
              </button>
              <button
                type="button"
                onClick={() => setReferenceFrameMode('start-end')}
                className={`h-5 px-2 rounded-[5px] ${
                  referenceFrameMode === 'start-end'
                    ? 'bg-[#20D5EC]/20 text-[#7ceeff] font-medium'
                    : 'text-white/55 hover:text-white'
                }`}
              >
                Start → End Frame
              </button>
            </div>
          )}
        </div>

        {/* Selected Node Reference Chips (click to insert @handle) */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {refChips.map((chip) => (
            <button
              key={chip.id}
              type="button"
              onClick={() => handleInsertChipTag(chip.tag)}
              title={`Click to insert ${chip.tag} into prompt (${chip.label})`}
              className="h-6 pl-1.5 pr-2 rounded-[6px] bg-[#1f292c] hover:bg-[#25363b] border border-[#20D5EC]/35 text-[11px] text-[#bdf5ff] flex items-center gap-1.5 transition-colors"
            >
              {chip.type === 'image' && chip.thumbUrl ? (
                <SmartMediaImage
                  src={chip.thumbUrl}
                  alt={chip.tag}
                  className="w-4 h-4 rounded-[3px] object-cover"
                />
              ) : chip.type === 'video' ? (
                <Clapperboard className="w-3 h-3 text-[#20D5EC]" />
              ) : (
                <Type className="w-3 h-3 text-[#20D5EC]" />
              )}
              <span className="font-mono">{chip.tag}</span>
              {targetKind === 'video' &&
                referenceFrameMode === 'start-end' &&
                chip.type === 'image' &&
                chip.imgOrder !== undefined &&
                chip.imgOrder < 2 && (
                  <span className="px-1 rounded bg-[#20D5EC]/25 text-[9.5px] font-semibold">
                    {chip.imgOrder === 0 ? 'Start' : 'End'}
                  </span>
                )}
            </button>
          ))}
        </div>

        {/* Multi-Reference Prompt Input */}
        <textarea
          value={composerPrompt}
          onChange={(e) => setComposerPrompt(e.target.value)}
          rows={2}
          placeholder={`Describe how to fuse ${refChips
            .map((c) => c.tag)
            .slice(0, 4)
            .join(', ')} into your new ${targetKind}…`}
          className="w-full rounded-[10px] bg-[#141414] border border-white/[0.08] focus:border-[#20D5EC]/50 px-3 py-2 text-[12.5px] text-white placeholder:text-white/35 outline-none resize-none select-text"
        />

        {/* Controls Footer: [Where · Model · Aspect · Res · Duration · Batch] + Form & Generate */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 flex-wrap relative">
            {/* Platform Pill */}
            <div className="relative">
              <button
                type="button"
                onClick={() =>
                  setOpenDropdown(openDropdown === 'platform' ? null : 'platform')
                }
                className="h-7 px-2.5 rounded-[8px] bg-[#252525] hover:bg-white/[0.1] border border-white/[0.08] text-[11px] text-white/90 flex items-center gap-1.5"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[#20D5EC]" />
                <span>{activePlatformDef?.shortLabel || effectivePlatformId}</span>
                <ChevronDown className="w-3 h-3 text-white/45" />
              </button>
              {openDropdown === 'platform' && (
                <div className="absolute bottom-full left-0 mb-1.5 w-[210px] max-h-[240px] overflow-y-auto p-1 rounded-[10px] dreamina-menu z-50 space-y-0.5 text-[11.5px]">
                  {availablePlatforms.map((plat) => {
                    const st = getPlatformConnectionStatus(
                      plat.id,
                      byok,
                      chromeBridge,
                      externalMcpServers,
                      plat,
                      liveStatusObj
                    );
                    return (
                      <button
                        key={plat.id}
                        type="button"
                        onClick={() => {
                          setPlatformId(plat.id);
                          setOpenDropdown(null);
                        }}
                        className={`w-full h-7 px-2 rounded-[6px] flex items-center justify-between text-left ${
                          plat.id === effectivePlatformId
                            ? 'bg-white/[0.12] text-white font-medium'
                            : 'hover:bg-white/[0.07] text-white/80'
                        }`}
                      >
                        <span className="truncate">{plat.shortLabel}</span>
                        {st.connected && (
                          <span className="w-1.5 h-1.5 rounded-full bg-[#10b981]" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Model Pill */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setOpenDropdown(openDropdown === 'model' ? null : 'model')}
                className="h-7 px-2.5 rounded-[8px] bg-[#252525] hover:bg-white/[0.1] border border-white/[0.08] text-[11px] text-white/90 flex items-center gap-1.5 max-w-[190px]"
              >
                <span className="truncate">{activeModel?.label || 'Model'}</span>
                <ChevronDown className="w-3 h-3 text-white/45 shrink-0" />
              </button>
              {openDropdown === 'model' && (
                <div className="absolute bottom-full left-0 mb-1.5 w-[240px] max-h-[240px] overflow-y-auto p-1 rounded-[10px] dreamina-menu z-50 space-y-0.5 text-[11.5px]">
                  {availableModels.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        setModelId(m.id);
                        if (m.defaultAspect) setAspectRatio(m.defaultAspect);
                        if (m.defaultResolution) setResolution(m.defaultResolution);
                        if (m.defaultDurationSec) setDurationSec(m.defaultDurationSec);
                        setOpenDropdown(null);
                      }}
                      className={`w-full px-2 py-1.5 rounded-[6px] text-left flex items-center justify-between ${
                        m.id === activeModel?.id
                          ? 'bg-white/[0.12] text-white font-medium'
                          : 'hover:bg-white/[0.07] text-white/80'
                      }`}
                    >
                      <span className="truncate">{m.label}</span>
                      {m.providerFamily && (
                        <span className="text-[10px] text-white/40 ml-2">
                          {m.providerFamily}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Aspect Ratio Pill */}
            {activeModel?.aspectRatios && activeModel.aspectRatios.length > 0 && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() =>
                    setOpenDropdown(openDropdown === 'aspect' ? null : 'aspect')
                  }
                  className="h-7 px-2 rounded-[8px] bg-[#252525] hover:bg-white/[0.1] border border-white/[0.08] text-[11px] text-white/85 flex items-center gap-1"
                >
                  <span>{aspectRatio}</span>
                  <ChevronDown className="w-3 h-3 text-white/45" />
                </button>
                {openDropdown === 'aspect' && (
                  <div className="absolute bottom-full left-0 mb-1.5 p-1 rounded-[10px] dreamina-menu z-50 flex flex-wrap gap-1 w-[170px]">
                    {activeModel.aspectRatios.map((ar) => (
                      <button
                        key={ar}
                        type="button"
                        onClick={() => {
                          setAspectRatio(ar);
                          setOpenDropdown(null);
                        }}
                        className={`h-6 px-2 rounded-[6px] text-[11px] ${
                          ar === aspectRatio
                            ? 'bg-white text-[#0e0e0e] font-semibold'
                            : 'bg-white/[0.05] text-white/80 hover:bg-white/[0.12]'
                        }`}
                      >
                        {ar}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Resolution Pill */}
            {activeModel?.resolutions && activeModel.resolutions.length > 0 && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() =>
                    setOpenDropdown(openDropdown === 'resolution' ? null : 'resolution')
                  }
                  className="h-7 px-2 rounded-[8px] bg-[#252525] hover:bg-white/[0.1] border border-white/[0.08] text-[11px] text-white/85 flex items-center gap-1"
                >
                  <span>{resolution}</span>
                  <ChevronDown className="w-3 h-3 text-white/45" />
                </button>
                {openDropdown === 'resolution' && (
                  <div className="absolute bottom-full left-0 mb-1.5 p-1 rounded-[10px] dreamina-menu z-50 space-y-0.5 w-[100px]">
                    {activeModel.resolutions.map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => {
                          setResolution(r);
                          setOpenDropdown(null);
                        }}
                        className={`w-full h-6 px-2 rounded-[6px] text-[11px] text-left ${
                          r === resolution
                            ? 'bg-white/[0.14] text-white font-semibold'
                            : 'text-white/80 hover:bg-white/[0.07]'
                        }`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Inline Enum Parameter Pills (e.g. Quality / Mode) */}
            {(activeModel?.parameters || [])
              .filter((p) => p.type === 'enum' && (p.options?.length || 0) > 1 && p.inlinePill !== false)
              .slice(0, 2)
              .map((param) => {
                const opts = param.options || [];
                const curVal = String(modelParams[param.name] ?? param.default ?? opts[0] ?? '');
                const nextIdx = (opts.map(String).indexOf(curVal) + 1) % opts.length;
                return (
                  <button
                    key={param.name}
                    type="button"
                    onClick={() =>
                      setModelParams((prev) => ({
                        ...prev,
                        [param.name]: opts[nextIdx],
                      }))
                    }
                    title={`Cycle ${param.label}`}
                    className="h-7 px-2 rounded-[8px] bg-[#252525] hover:bg-white/[0.1] border border-white/[0.08] text-[11px] text-white/85 flex items-center gap-1"
                  >
                    <span className="text-white/45">{param.label}:</span>
                    <span className="font-medium text-white">{curVal}</span>
                  </button>
                );
              })}

            {/* Duration (Video) */}
            {targetKind === 'video' && (activeModel?.durationsSec?.length || 0) > 0 && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() =>
                    setOpenDropdown(openDropdown === 'duration' ? null : 'duration')
                  }
                  className="h-7 px-2 rounded-[8px] bg-[#252525] hover:bg-white/[0.1] border border-white/[0.08] text-[11px] text-white/85 flex items-center gap-1"
                >
                  <span>{durationSec}s</span>
                  <ChevronDown className="w-3 h-3 text-white/45" />
                </button>
                {openDropdown === 'duration' && (
                  <div className="absolute bottom-full left-0 mb-1.5 p-1 rounded-[10px] dreamina-menu z-50 space-y-0.5 w-[90px]">
                    {activeModel!.durationsSec!.map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => {
                          setDurationSec(d);
                          setOpenDropdown(null);
                        }}
                        className={`w-full h-6 px-2 rounded-[6px] text-[11px] text-left ${
                          d === durationSec
                            ? 'bg-white/[0.14] text-white font-semibold'
                            : 'text-white/80 hover:bg-white/[0.07]'
                        }`}
                      >
                        {d}s
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Batch Count (Image) */}
            {targetKind === 'image' && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setOpenDropdown(openDropdown === 'batch' ? null : 'batch')}
                  className="h-7 px-2 rounded-[8px] bg-[#252525] hover:bg-white/[0.1] border border-white/[0.08] text-[11px] text-white/85 flex items-center gap-1"
                >
                  <span>{batchCount}×</span>
                  <ChevronDown className="w-3 h-3 text-white/45" />
                </button>
                {openDropdown === 'batch' && (
                  <div className="absolute bottom-full left-0 mb-1.5 p-1 rounded-[10px] dreamina-menu z-50 space-y-0.5 w-[80px]">
                    {([1, 2, 4] as const).map((cnt) => (
                      <button
                        key={cnt}
                        type="button"
                        onClick={() => {
                          setBatchCount(cnt);
                          setOpenDropdown(null);
                        }}
                        className={`w-full h-6 px-2 rounded-[6px] text-[11px] text-left ${
                          cnt === batchCount
                            ? 'bg-white/[0.14] text-white font-semibold'
                            : 'text-white/80 hover:bg-white/[0.07]'
                        }`}
                      >
                        {cnt}× Grid
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <button
            type="button"
            disabled={submitting}
            onClick={() => void handleFormAndGenerate()}
            className="h-8 px-3.5 rounded-full bg-white hover:bg-[#e5e5e5] disabled:opacity-50 text-[#0e0e0e] text-[12px] font-semibold flex items-center gap-1.5 transition-colors shrink-0"
          >
            {submitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={2} />
                <span>Forming…</span>
              </>
            ) : (
              <>
                <span>Form &amp; Generate</span>
                <ArrowUp className="w-3.5 h-3.5" strokeWidth={2.2} />
              </>
            )}
          </button>
        </div>
      </div>
    </>
  );
};
