import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowUp,
  AtSign,
  AudioLines,
  Camera,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clapperboard,
  Compass,
  Copy,
  Download,
  Eraser,
  Film,
  FolderOpen,
  GitBranch,
  Grid2X2,
  Grid3X3,
  Image as ImageIcon,
  Link2,
  Loader2,
  Maximize2,
  Minimize2,
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
  CanvasNode,
  ConnectionTransport,
  CreditQuoteResponse,
  ModelParameterSpec,
  PlatformId,
  PlatformModelDefinition,
  ResolutionTier,
} from '../types/studio';
import {
  collectDownloadableMediaItemsFromNodes,
  fetchCreditQuoteViaBackend,
} from '../services/executionRouter';
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
const BATCH_COUNTS: Array<1 | 2 | 3 | 4> = [1, 2, 3, 4];

const FIRST_CLASS_DUP_PARAMS = new Set([
  'resolution',
  'aspect_ratio',
  'ratio',
  'duration',
  'duration_sec',
  'batch_count',
  'count',
]);

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
  const ownConnectedPlatforms = useStudioStore((s) => s.ownConnectedPlatforms);
  const sharedAvailablePools = useStudioStore((s) => s.sharedAvailablePools);
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
  const attachAssetUrlToNode = useStudioStore((s) => s.attachAssetUrlToNode);
  const removeReferenceUrlFromNode = useStudioStore((s) => s.removeReferenceUrlFromNode);
  const removeVideoReferenceUrlFromNode = useStudioStore(
    (s) => s.removeVideoReferenceUrlFromNode
  );
  const removeAudioReferenceUrlFromNode = useStudioStore(
    (s) => s.removeAudioReferenceUrlFromNode
  );
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
  const disconnectNodes = useStudioStore((s) => s.disconnectNodes);
  const setCanvasRefPickerSourceNodeId = useStudioStore(
    (s) => s.setCanvasRefPickerSourceNodeId
  );
  const assetsCatalog = useStudioStore((s) => s.assetsCatalog);
  const assetsLoading = useStudioStore((s) => s.assetsLoading);
  const refreshAssetsCatalog = useStudioStore((s) => s.refreshAssetsCatalog);
  const duplicateNodes = useStudioStore((s) => s.duplicateNodes);
  const deleteSelectedNodes = useStudioStore((s) => s.deleteSelectedNodes);
  const openInlineEditor = useStudioStore((s) => s.openInlineEditor);
  const removeBgAndDecomposeLayers = useStudioStore((s) => s.removeBgAndDecomposeLayers);
  const upscaleNodeHd = useStudioStore((s) => s.upscaleNodeHd);
  const extractLastFrameToNextShot = useStudioStore((s) => s.extractLastFrameToNextShot);
  const sendNodeToTimeline = useStudioStore((s) => s.sendNodeToTimeline);
  const openProviderModal = useStudioStore((s) => s.openProviderModal);
  const openLightbox = useStudioStore((s) => s.openLightbox);
  const downloadNodeMedia = useStudioStore((s) => s.downloadNodeMedia);
  const downloadSelectedNodesMedia = useStudioStore((s) => s.downloadSelectedNodesMedia);
  const sliceContactSheetNode = useStudioStore((s) => s.sliceContactSheetNode);
  const generateAiNineGridStoryboard = useStudioStore(
    (s) => s.generateAiNineGridStoryboard
  );

  const [openMenu, setOpenMenu] = useState<
    | null
    | 'platform'
    | 'model'
    | 'format'
    | 'quality'
    | 'mode'
    | 'duration'
    | 'camera'
    | 'voice'
    | 'advanced'
    | 'plus-upload'
    | 'plus-assets'
    | 'video-ref-mode'
  >(null);
  const [modelSearch, setModelSearch] = useState('');
  const [modelFamilyFilter, setModelFamilyFilter] = useState<string>('All');
  const [atAutocompleteOpen, setAtAutocompleteOpen] = useState(false);
  const [atQuery, setAtQuery] = useState('');
  const [atTokenRange, setAtTokenRange] = useState<{ start: number; end: number } | null>(null);
  const [atActiveIndex, setAtActiveIndex] = useState(0);
  const [atCategory, setAtCategory] = useState<
    null | 'element' | 'image' | 'video' | 'audio' | 'motion'
  >(null);
  const [composerExpanded, setComposerExpanded] = useState(false);
  const [composerFilterTab, setComposerFilterTab] = useState<'all' | 'images' | 'text'>('all');
  const [isComposerDragOver, setIsComposerDragOver] = useState(false);
  const [assetPickerSearch, setAssetPickerSearch] = useState('');
  const [pendingUploadSlot, setPendingUploadSlot] = useState<{
    accept: string;
    motionMode?: boolean;
    insertAtPrompt?: boolean;
  }>({ accept: 'image/*,video/*,audio/*' });
  const [creditQuote, setCreditQuote] = useState<CreditQuoteResponse | null>(null);

  const refUploadInputRef = useRef<HTMLInputElement | null>(null);
  const directCardUploadInputRef = useRef<HTMLInputElement | null>(null);
  const promptTextareaRef = useRef<HTMLTextAreaElement | null>(null);

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
    setAtQuery('');
    setAtTokenRange(null);
    setAtCategory(null);
    setAssetPickerSearch('');
    setIsComposerDragOver(false);
  }, [selectedNode?.id, resolvedEffectivePlatformId, selectedModality]);

  useEffect(() => {
    if (!selectedNode || !selectedModality) {
      setCreditQuote(null);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      void fetchCreditQuoteViaBackend({
        platformId: resolvedEffectivePlatformId,
        modelId: resolveCanonicalModelId(selectedNode.modelId) || selectedNode.modelId || '',
        modality: selectedModality,
        resolution: selectedNode.resolution,
        durationSec: selectedNode.durationSec,
        aspectRatio: selectedNode.aspectRatio,
        batchCount: selectedNode.batchCount || 1,
        quality:
          selectedNode.quality ||
          (typeof selectedNode.modelParams?.quality === 'string'
            ? selectedNode.modelParams.quality
            : undefined),
        prompt: selectedNode.prompt,
        live: true,
      }).then((q) => {
        if (!cancelled) setCreditQuote(q);
      });
    }, 280);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [
    selectedNode?.id,
    selectedModality,
    resolvedEffectivePlatformId,
    selectedNode?.modelId,
    selectedNode?.resolution,
    selectedNode?.durationSec,
    selectedNode?.aspectRatio,
    selectedNode?.batchCount,
    selectedNode?.quality,
    selectedNode?.modelParams?.quality,
    selectedNode?.prompt,
  ]);

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

  const popoverWidth = Math.min(composerExpanded ? 880 : 856, window.innerWidth - 88);
  const popoverLeft = Math.max(
    64,
    Math.min(window.innerWidth - popoverWidth - 20, centerScreenX - popoverWidth / 2)
  );
  const popoverTop = Math.min(
    window.innerHeight - (composerExpanded ? 410 : 332),
    Math.max(68, nodeBottomScreen + 18)
  );
  const atMenuAnchorY = popoverTop + (composerExpanded ? 104 : 92);
  const atMenuSafeBottom = Math.max(
    16,
    Math.min(window.innerHeight - atMenuAnchorY, window.innerHeight - 58 - 356)
  );

  // Wired upstream & downstream inspection
  const upstreamNodes = edges
    .filter((e) => e.targetId === selectedNode.id)
    .map((e) => nodes.find((n) => n.id === e.sourceId))
    .filter((n): n is NonNullable<typeof n> => Boolean(n));

  const upstreamRefNodes = upstreamNodes.filter(
    (n) => n.kind === 'image' || n.kind === 'element' || n.kind === 'contact-sheet'
  );
  const upstreamVideoNodes = upstreamNodes.filter((n) => n.kind === 'video');
  const upstreamAudioNodes = upstreamNodes.filter((n) => n.kind === 'audio');
  const upstreamTextNodes = upstreamNodes.filter(
    (n) => n.kind === 'text' || n.kind === 'sticky'
  );

  const hasDownstreamEdges = edges.some((e) => e.sourceId === selectedNode.id);

  // Linkable canvas nodes by kind not yet wired into selectedNode
  const linkableCanvasImageNodes = nodes.filter(
    (n) =>
      n.id !== selectedNode.id &&
      (n.kind === 'image' || n.kind === 'element' || n.kind === 'contact-sheet') &&
      !edges.some((e) => e.sourceId === n.id && e.targetId === selectedNode.id)
  );
  const linkableCanvasVideoNodes = nodes.filter(
    (n) =>
      n.id !== selectedNode.id &&
      n.kind === 'video' &&
      !edges.some((e) => e.sourceId === n.id && e.targetId === selectedNode.id)
  );
  const linkableCanvasAudioNodes = nodes.filter(
    (n) =>
      n.id !== selectedNode.id &&
      n.kind === 'audio' &&
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
  const activeDisplayResolution =
    resolutionOptions.find(
      (r) => r.toLowerCase() === String(selectedNode.resolution || '').toLowerCase()
    ) ||
    activeModelDef?.defaultResolution ||
    resolutionOptions[0] ||
    selectedNode.resolution;
  const activeBatchCount = selectedNode.batchCount || 1;

  const setNodeUnifiedResolution = (res: ResolutionTier) => {
    const nextParams = { ...(selectedNode.modelParams || {}) };
    delete nextParams.resolution;
    updateNodeFields(selectedNode.id, {
      resolution: res,
      modelParams: Object.keys(nextParams).length > 0 ? nextParams : undefined,
    });
  };

  const qualitySpec = activeModelDef?.parameters?.find(
    (p) => p.name === 'quality' && !FIRST_CLASS_DUP_PARAMS.has(p.name.toLowerCase())
  );
  const activeQualityVal = qualitySpec
    ? resolveModelParamValue(selectedNode.modelParams, selectedNode.quality, qualitySpec)
    : undefined;
  const modeSpec = activeModelDef?.parameters?.find(
    (p) =>
      !FIRST_CLASS_DUP_PARAMS.has(p.name.toLowerCase()) &&
      (p.name === 'mode' ||
        p.name === 'variant' ||
        (p.inlinePill && p.name !== 'quality'))
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
    (p) =>
      p.name !== 'quality' &&
      p !== modeSpec &&
      !FIRST_CLASS_DUP_PARAMS.has(p.name.toLowerCase())
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
    const modeStr = name === 'mode' ? String(value || '').toLowerCase() : '';
    const syncedRefModePatch: Partial<CanvasNode> =
      name === 'mode' && (modeStr === 'm2v' || modeStr === 'reference-to-video' || modeStr === 'omni_reference')
        ? { referenceFrameMode: 'multi-ref' }
        : name === 'mode' && (modeStr === 'first_last_frame' || modeStr === 'image-to-video')
        ? { referenceFrameMode: 'start-end' }
        : name === 'mode' && (modeStr === 't2v' || modeStr === 'text-to-video')
        ? { referenceFrameMode: undefined }
        : {};
    updateNodeFields(selectedNode.id, {
      ...(name === 'quality'
        ? { quality: typeof value === 'string' ? value : undefined }
        : {}),
      ...syncedRefModePatch,
      modelParams: Object.keys(nextParams).length > 0 ? nextParams : undefined,
    });
  };

  const resetModelParamDefaults = () => {
    const defaults: Record<string, string | number | boolean> = {};
    for (const p of activeModelDef?.parameters || []) {
      if (p.default !== undefined && !FIRST_CLASS_DUP_PARAMS.has(p.name.toLowerCase())) {
        defaults[p.name] = p.default;
      }
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

  const deriveUiHandleForNode = (n: CanvasNode, idx: number): string => {
    if (n.elementHandles?.[0]) return n.elementHandles[0];
    const m = n.title.match(/@[A-Za-z0-9_]+/);
    if (m?.[0]) return m[0];
    const slug = n.title
      .replace(/[^A-Za-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 22);
    return slug ? `@${slug}` : `@Ref${idx}`;
  };

  const resolveBindingHandleForUrl = (
    url: string,
    fallbackPrefix: string,
    idx: number
  ): string => {
    const matched = (selectedNode.referenceHandles || []).find((b) => b.url === url);
    return matched?.handle || `@${fallbackPrefix}${idx}`;
  };

  const availableAtHandleItems = (() => {
    const items: Array<{
      handle: string;
      displayName: string;
      label: string;
      imageUrl?: string;
      kind: 'element' | 'image' | 'video' | 'audio';
      nodeId?: string;
    }> = [];
    const seen = new Set<string>();
    const pushItem = (
      handle: string,
      displayName: string,
      label: string,
      imageUrl?: string,
      kind: 'element' | 'image' | 'video' | 'audio' = 'element',
      nodeId?: string
    ) => {
      const clean = handle.startsWith('@') ? handle : `@${handle}`;
      const k = clean.toLowerCase();
      if (seen.has(k)) return;
      seen.add(k);
      items.push({ handle: clean, displayName, label, imageUrl, kind, nodeId });
    };
    upstreamRefNodes.forEach((up, idx) => {
      const h = deriveUiHandleForNode(up, idx + 1);
      pushItem(
        h,
        up.kind === 'element' ? h.replace(/^@/, '') : h,
        up.title,
        up.imageUrl,
        up.kind === 'element' ? 'element' : 'image',
        up.id
      );
    });
    upstreamVideoNodes.forEach((up, idx) => {
      const h = deriveUiHandleForNode(up, idx + 1);
      pushItem(h, h, up.title, up.imageUrl, 'video', up.id);
    });
    upstreamAudioNodes.forEach((up, idx) => {
      const h = deriveUiHandleForNode(up, idx + 1);
      pushItem(h, h, up.title, undefined, 'audio', up.id);
    });
    for (const b of selectedNode.referenceHandles || []) {
      if (b.handle) {
        pushItem(
          b.handle,
          b.handle,
          b.label || b.handle,
          b.kind === 'image' ? b.url : undefined,
          b.kind || 'image'
        );
      }
    }
    (selectedNode.referenceUrls || []).forEach((url, idx) => {
      const h = resolveBindingHandleForUrl(url, 'Image', idx + 1);
      pushItem(h, h, `Attached Image ${idx + 1}`, url, 'image');
    });
    (selectedNode.videoReferenceUrls || []).forEach((url, idx) => {
      const h = resolveBindingHandleForUrl(url, 'Video', idx + 1);
      pushItem(h, h, `Attached Video ${idx + 1}`, undefined, 'video');
    });
    (selectedNode.audioReferenceUrls || []).forEach((url, idx) => {
      const h = resolveBindingHandleForUrl(url, 'Audio', idx + 1);
      pushItem(h, h, `Attached Audio ${idx + 1}`, undefined, 'audio');
    });
    for (const cn of nodes) {
      if (cn.id !== selectedNode.id && cn.kind === 'element' && cn.imageUrl) {
        const h = deriveUiHandleForNode(cn, 1);
        pushItem(h, h.replace(/^@/, ''), cn.title, cn.imageUrl, 'element', cn.id);
      }
    }
    for (const el of elements) {
      pushItem(
        el.handle,
        el.name || el.handle.replace(/^@/, ''),
        el.name,
        el.references?.[0]?.dataUrl,
        'element'
      );
    }
    return items;
  })();

  const filteredAtMentionItems = (() => {
    const q = atQuery.trim().toLowerCase();
    if (!q) return availableAtHandleItems;
    return availableAtHandleItems.filter(
      (it) =>
        it.handle.toLowerCase().includes(q) ||
        it.displayName.toLowerCase().includes(q) ||
        it.label.toLowerCase().includes(q)
    );
  })();

  const modeOptionsStrings = (modeSpec?.options || []).map((o) => String(o).toLowerCase());
  const modeParamControlsVideoInput =
    modeOptionsStrings.includes('m2v') ||
    modeOptionsStrings.includes('first_last_frame') ||
    modeOptionsStrings.includes('reference-to-video');

  const activeVideoInputMethod: 't2v' | 'start-end' | 'multi-ref' = (() => {
    const mStr = String(selectedNode.modelParams?.mode || '').toLowerCase();
    if (mStr === 'm2v' || mStr === 'reference-to-video' || mStr === 'omni_reference') {
      return 'multi-ref';
    }
    if (mStr === 'first_last_frame' || mStr === 'image-to-video') {
      return 'start-end';
    }
    if (mStr === 't2v' || mStr === 'text-to-video') {
      return 't2v';
    }
    if (selectedNode.referenceFrameMode === 'multi-ref' || activeModelDef?.id === 'kling-elements') {
      return 'multi-ref';
    }
    if (selectedNode.referenceFrameMode === 'start-end') {
      return 'start-end';
    }
    const hasAnyRefs =
      upstreamRefNodes.length > 0 ||
      upstreamVideoNodes.length > 0 ||
      (selectedNode.referenceUrls?.length || 0) > 0 ||
      (selectedNode.videoReferenceUrls?.length || 0) > 0;
    if (!hasAnyRefs) return 't2v';
    if (
      /@[A-Za-z0-9_]+/.test(selectedNode.prompt) ||
      upstreamRefNodes.some((u) => u.kind === 'element') ||
      upstreamVideoNodes.length > 0 ||
      (selectedNode.videoReferenceUrls?.length || 0) > 0 ||
      upstreamRefNodes.length >= 2
    ) {
      return 'multi-ref';
    }
    return 'start-end';
  })();

  const setVideoInputMethod = (target: 't2v' | 'start-end' | 'multi-ref') => {
    const nextParams: Record<string, string | number | boolean> = {
      ...(selectedNode.modelParams || {}),
    };
    if (modeParamControlsVideoInput) {
      if (modeOptionsStrings.includes('m2v')) {
        nextParams.mode =
          target === 'multi-ref'
            ? 'm2v'
            : target === 'start-end'
            ? 'first_last_frame'
            : 't2v';
      } else if (modeOptionsStrings.includes('reference-to-video')) {
        nextParams.mode =
          target === 'multi-ref'
            ? 'reference-to-video'
            : target === 'start-end'
            ? 'image-to-video'
            : 'text-to-video';
      }
    }
    updateNodeFields(selectedNode.id, {
      referenceFrameMode: target === 't2v' ? undefined : target,
      modelParams: Object.keys(nextParams).length > 0 ? nextParams : undefined,
    });
  };

  const insertHandleIntoPrompt = (handle: string, autoWireNodeId?: string) => {
    if (
      autoWireNodeId &&
      !edges.some((e) => e.sourceId === autoWireNodeId && e.targetId === selectedNode.id)
    ) {
      connectNodes(autoWireNodeId, selectedNode.id, 'lineage');
    }
    const cleanHandle = handle.startsWith('@') ? handle : `@${handle}`;
    const curPrompt = useStudioStore.getState().nodes.find((n) => n.id === selectedNode.id)?.prompt ?? selectedNode.prompt;
    let nextPrompt = curPrompt;
    let nextCaretPos: number | null = null;

    if (
      atTokenRange &&
      atTokenRange.start >= 0 &&
      atTokenRange.end <= curPrompt.length &&
      curPrompt.slice(atTokenRange.start, atTokenRange.start + 1) === '@'
    ) {
      const before = curPrompt.slice(0, atTokenRange.start);
      const after = curPrompt.slice(atTokenRange.end);
      const inserted = `${cleanHandle}${after.startsWith(' ') ? '' : ' '}`;
      nextPrompt = `${before}${inserted}${after}`;
      nextCaretPos = before.length + inserted.length;
    } else if (curPrompt.endsWith('@')) {
      nextPrompt = `${curPrompt.slice(0, -1)}${cleanHandle} `;
      nextCaretPos = nextPrompt.length;
    } else if (!curPrompt.toLowerCase().includes(cleanHandle.toLowerCase())) {
      nextPrompt = `${curPrompt}${curPrompt && !curPrompt.endsWith(' ') ? ' ' : ''}${cleanHandle} `;
      nextCaretPos = nextPrompt.length;
    }

    const nextParams: Record<string, string | number | boolean> = {
      ...(selectedNode.modelParams || {}),
    };
    if (modality === 'video' && modeParamControlsVideoInput && modeOptionsStrings.includes('m2v')) {
      nextParams.mode = 'm2v';
    }
    updateNodeFields(selectedNode.id, {
      prompt: nextPrompt,
      elementHandles: Array.from(new Set([...(selectedNode.elementHandles || []), cleanHandle])),
      ...(modality === 'video' ? { referenceFrameMode: 'multi-ref' as const } : {}),
      modelParams: Object.keys(nextParams).length > 0 ? nextParams : undefined,
    });
    setAtAutocompleteOpen(false);
    setAtQuery('');
    setAtTokenRange(null);
    setAtCategory(null);
    if (nextCaretPos !== null) {
      requestAnimationFrame(() => {
        const el = promptTextareaRef.current;
        if (el) {
          el.focus();
          el.setSelectionRange(nextCaretPos, nextCaretPos);
        }
      });
    }
  };

  const detectAtMentionAtCaret = (text: string, caret: number) => {
    const before = text.slice(0, caret);
    const match = /(?:^|[\s(\[{])@([A-Za-z0-9_]*)$/.exec(before);
    if (match) {
      const query = match[1] || '';
      const atStart = caret - query.length - 1;
      setAtQuery(query);
      setAtTokenRange({ start: atStart, end: caret });
      setAtActiveIndex(0);
      setAtCategory(null);
      setAtAutocompleteOpen(true);
      setOpenMenu(null);
    } else {
      setAtAutocompleteOpen(false);
      setAtQuery('');
      setAtTokenRange(null);
      setAtCategory(null);
    }
  };

  const handlePromptChange = (val: string, caretPos?: number) => {
    updateNodeFields(selectedNode.id, { prompt: val });
    const effectiveCaret = typeof caretPos === 'number' ? caretPos : val.length;
    detectAtMentionAtCaret(val, effectiveCaret);
  };

  const openAtMenuFromToolbarButton = () => {
    if (atAutocompleteOpen) {
      setAtAutocompleteOpen(false);
      setAtCategory(null);
      return;
    }
    setOpenMenu(null);
    const cur = selectedNode.prompt;
    const needsSpace = cur.length > 0 && !/\s$/.test(cur);
    const nextPrompt = cur.endsWith('@') ? cur : `${cur}${needsSpace ? ' ' : ''}@`;
    if (nextPrompt !== cur) {
      updateNodeFields(selectedNode.id, { prompt: nextPrompt });
    }
    const atPos = nextPrompt.length - 1;
    setAtQuery('');
    setAtTokenRange({ start: atPos, end: nextPrompt.length });
    setAtActiveIndex(0);
    setAtCategory(null);
    setAtAutocompleteOpen(true);
    void refreshAssetsCatalog('all', false);
    requestAnimationFrame(() => {
      const el = promptTextareaRef.current;
      if (el) {
        el.focus();
        el.setSelectionRange(nextPrompt.length, nextPrompt.length);
      }
    });
  };

  const triggerDeviceUpload = (opts?: {
    accept?: string;
    motionMode?: boolean;
    insertAtPrompt?: boolean;
  }) => {
    const slot = {
      accept: opts?.accept || 'image/*,video/*,audio/*',
      motionMode: opts?.motionMode,
      insertAtPrompt: opts?.insertAtPrompt,
    };
    setPendingUploadSlot(slot);
    setOpenMenu(null);
    requestAnimationFrame(() => {
      if (refUploadInputRef.current) {
        refUploadInputRef.current.accept = slot.accept;
        refUploadInputRef.current.click();
      }
    });
  };

  const handleAttachFilesBatch = async (
    fileList: FileList | File[],
    opts?: { motionMode?: boolean; insertAtPrompt?: boolean }
  ) => {
    const files = Array.from(fileList).filter((f) =>
      /^(image|video|audio)\//i.test(f.type) ||
      /\.(png|jpe?g|webp|gif|mp4|mov|webm|mp3|wav|m4a|ogg)$/i.test(f.name)
    );
    if (files.length === 0) return;
    let firstHandle: string | null = null;
    for (const f of files) {
      const h = await attachReferenceToNode(selectedNode.id, f, {
        motionMode: opts?.motionMode,
      });
      if (!firstHandle && h) firstHandle = h;
    }
    if (opts?.insertAtPrompt && firstHandle) {
      insertHandleIntoPrompt(firstHandle);
    } else {
      setAtAutocompleteOpen(false);
      setAtCategory(null);
    }
  };

  return (
    <>
      {/* Hidden file inputs */}
      <input
        ref={refUploadInputRef}
        type="file"
        multiple
        accept={pendingUploadSlot.accept}
        className="hidden"
        onChange={(e) => {
          const files = e.target.files;
          if (files && files.length > 0) {
            const slotSnap = pendingUploadSlot;
            void handleAttachFilesBatch(Array.from(files), {
              motionMode: slotSnap.motionMode,
              insertAtPrompt: slotSnap.insertAtPrompt,
            });
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
          className="fixed z-40 h-9 px-1.5 rounded-[10px] dreamina-levitation flex items-center gap-1 text-[11.5px] whitespace-nowrap w-max max-w-[calc(100vw-28px)] overflow-x-auto select-none [&_button]:shrink-0 [&_button]:whitespace-nowrap"
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

                {selectedNode.kind !== 'contact-sheet' && (
                  <button
                    type="button"
                    data-testid="quickbar-ai-9grid-btn"
                    onClick={() => void generateAiNineGridStoryboard(selectedNode.id)}
                    className="h-7 px-2.5 rounded-[7px] bg-[#20D5EC]/12 hover:bg-[#20D5EC]/22 border border-[#20D5EC]/35 text-[#8cf0ff] font-medium flex items-center gap-1.5"
                    title="Generate a 3×3 multi-angle storyboard via GPT Image 2.6 and slice into 9 keyframe nodes"
                  >
                    <Grid3X3 className="w-3.5 h-3.5 text-[#20D5EC]" strokeWidth={1.6} />
                    <span>→ AI 9-Grid</span>
                  </button>
                )}

                {(selectedNode.kind === 'contact-sheet' || Boolean(selectedNode.imageUrl)) && (
                  <>
                    <button
                      type="button"
                      data-testid="quickbar-slice-3x3-btn"
                      onClick={() => void sliceContactSheetNode(selectedNode.id, 3, 3)}
                      className="h-7 px-2.5 rounded-[7px] bg-[#20D5EC]/15 hover:bg-[#20D5EC]/25 border border-[#20D5EC]/40 text-[#8cf0ff] font-medium flex items-center gap-1.5"
                      title="Slice 3×3 contact sheet into 9 standalone camera-angle nodes via FFmpeg"
                    >
                      <Grid3X3 className="w-3.5 h-3.5 text-[#20D5EC]" strokeWidth={1.6} />
                      <span>Slice 3×3 (9)</span>
                    </button>
                    {selectedNode.kind === 'contact-sheet' && (
                      <button
                        type="button"
                        onClick={() => void sliceContactSheetNode(selectedNode.id, 2, 2)}
                        className="h-7 px-2 rounded-[7px] hover:bg-white/[0.08] text-white/80 flex items-center gap-1"
                        title="Slice 2×2 sheet into 4 standalone nodes"
                      >
                        <Grid2X2 className="w-3.5 h-3.5 text-white/65" strokeWidth={1.5} />
                        <span>2×2</span>
                      </button>
                    )}
                  </>
                )}

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
                  title="Outpaint / Expand canvas frame"
                >
                  <Maximize2 className="w-3.5 h-3.5 text-white/60" strokeWidth={1.5} />
                  <span>Outpaint</span>
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

          {hasMedia && (
            <>
              {selectedNode.kind !== 'audio' && (
                <button
                  type="button"
                  data-testid="quickbar-fullscreen-btn"
                  onClick={() => openLightbox(selectedNode.id)}
                  className="h-7 px-2.5 rounded-[7px] hover:bg-white/[0.1] text-white/90 flex items-center gap-1.5"
                  title="Open in full screen cinema view"
                >
                  <Maximize2 className="w-3.5 h-3.5 text-[#20D5EC]" strokeWidth={1.6} />
                  <span>Full Screen</span>
                </button>
              )}
              <button
                type="button"
                data-testid="quickbar-download-btn"
                onClick={() => void downloadNodeMedia(selectedNode.id)}
                className="h-7 px-2.5 rounded-[7px] hover:bg-white/[0.1] text-white/90 flex items-center gap-1.5"
                title="Download original media file"
              >
                <Download className="w-3.5 h-3.5 text-[#20D5EC]" strokeWidth={1.6} />
                <span>Download</span>
              </button>
              {selectedNode.generatedOutputs && selectedNode.generatedOutputs.length > 1 && (
                <button
                  type="button"
                  onClick={() => void downloadSelectedNodesMedia([selectedNode.id])}
                  className="h-7 px-2 rounded-[7px] bg-[#20D5EC]/12 hover:bg-[#20D5EC]/22 border border-[#20D5EC]/35 text-[#7ceeff] font-medium flex items-center gap-1"
                  title={`Download all ${selectedNode.generatedOutputs.length} variations as ZIP`}
                >
                  <Download className="w-3 h-3" strokeWidth={1.7} />
                  <span>All ({selectedNode.generatedOutputs.length})</span>
                </button>
              )}
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
          className="fixed z-40 rounded-[18px] dreamina-levitation p-3 space-y-2.5 select-none"
        >
          {/* Top Strip: Modality / Expanded Filter Tabs + Video Input Method + Connection Badge */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              {composerExpanded && modality !== 'audio' ? (
                <div
                  data-testid="composer-filter-tabs"
                  className="flex items-center gap-4 px-1"
                >
                  {(
                    [
                      { id: 'all', label: 'All' },
                      { id: 'images', label: 'Images' },
                      { id: 'text', label: 'Text' },
                    ] as const
                  ).map((tab) => {
                    const activeTab = composerFilterTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setComposerFilterTab(tab.id)}
                        className={`relative pb-1 text-[12.5px] font-medium transition-colors ${
                          activeTab
                            ? 'text-white after:content-[""] after:absolute after:left-0 after:right-0 after:bottom-0 after:h-[2px] after:rounded-full after:bg-white'
                            : 'text-white/45 hover:text-white/80'
                        }`}
                      >
                        {tab.label}
                      </button>
                    );
                  })}
                </div>
              ) : (
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
              )}

              {/* Video Input Method Selector: Text-to-Video vs 1st/Last Frame vs @Ref R2V */}
              {modality === 'video' && activeModelDef?.supportsReferences && (
                <div
                  data-testid="video-input-method-segmented"
                  className="h-6 p-0.5 rounded-[7px] bg-[#1a1a1a] border border-white/[0.1] inline-flex items-center gap-0.5 text-[10.5px]"
                >
                  <button
                    type="button"
                    onClick={() => setVideoInputMethod('t2v')}
                    className={`h-5 px-2 rounded-[5px] font-medium transition-colors ${
                      activeVideoInputMethod === 't2v'
                        ? 'bg-white text-[#0e0e0e]'
                        : 'text-white/60 hover:text-white'
                    }`}
                    title="Text-to-Video (ignore frame lock)"
                  >
                    T2V
                  </button>
                  {activeModelDef?.supportsStartEndFrames !== false && (
                    <button
                      type="button"
                      onClick={() => setVideoInputMethod('start-end')}
                      className={`h-5 px-2 rounded-[5px] font-medium transition-colors ${
                        activeVideoInputMethod === 'start-end'
                          ? 'bg-amber-400/20 border border-amber-300/40 text-amber-200'
                          : 'text-white/60 hover:text-white'
                      }`}
                      title="First / Last Frame Keyframe Lock (I2V)"
                    >
                      1st/Last
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setVideoInputMethod('multi-ref')}
                    className={`h-5 px-2 rounded-[5px] font-medium transition-colors ${
                      activeVideoInputMethod === 'multi-ref'
                        ? 'bg-[#20D5EC]/20 border border-[#20D5EC]/45 text-[#7ceeff]'
                        : 'text-white/60 hover:text-white'
                    }`}
                    title="True Omni Reference-to-Video (@Character / @Scene / @Prop tagging via Seedance m2v & Kling omni_ref_video)"
                  >
                    @Ref R2V
                  </button>
                </div>
              )}
            </div>

            <div className="flex items-center gap-1.5">
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
          </div>

          {/* Dreamina Unified Prompt & Reference Composer Box ([ + ] Drag-Drop Tile + @ Mention Menu) */}
          <div
            data-testid="dreamina-prompt-composer"
            onDragEnter={(e) => {
              if (e.dataTransfer?.types?.includes('Files')) {
                e.preventDefault();
                e.stopPropagation();
                setIsComposerDragOver(true);
              }
            }}
            onDragOver={(e) => {
              if (e.dataTransfer?.types?.includes('Files')) {
                e.preventDefault();
                e.stopPropagation();
                e.dataTransfer.dropEffect = 'copy';
                if (!isComposerDragOver) setIsComposerDragOver(true);
              }
            }}
            onDragLeave={(e) => {
              if (e.currentTarget === e.target) {
                setIsComposerDragOver(false);
              }
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsComposerDragOver(false);
              if (e.dataTransfer?.files?.length) {
                void handleAttachFilesBatch(e.dataTransfer.files, { insertAtPrompt: false });
              }
            }}
            className={`relative rounded-[14px] bg-[#141414] border transition-colors p-2.5 space-y-2 ${
              isComposerDragOver
                ? 'border-[#20D5EC] border-dashed bg-[#122229]'
                : 'border-white/[0.08] focus-within:border-white/[0.2]'
            }`}
          >
            {isComposerDragOver && (
              <div className="pointer-events-none absolute inset-0 rounded-[14px] bg-[#10242c]/90 z-30 flex items-center justify-center gap-2 text-[12.5px] font-medium text-[#7ceeff]">
                <Upload className="w-4 h-4 text-[#20D5EC]" strokeWidth={1.8} />
                <span>Drop image, video, or audio files to attach as @references</span>
              </div>
            )}

            {/* Top Reference Tile Row inside Composer ([ + ] 40x40 + Attached Thumbnails + Expand Toggle) */}
            {modality !== 'audio' && (
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap min-w-0">
                  {/* Dreamina [ + ] 40x40 Reference Upload / Drop Tile */}
                  <div className="relative">
                    <button
                      type="button"
                      data-testid="composer-plus-upload-btn"
                      onClick={() => {
                        setAtAutocompleteOpen(false);
                        setAtCategory(null);
                        setOpenMenu(
                          openMenu === 'plus-upload' || openMenu === 'plus-assets'
                            ? null
                            : 'plus-upload'
                        );
                      }}
                      onDragOver={(e) => {
                        if (e.dataTransfer?.types?.includes('Files')) {
                          e.preventDefault();
                          e.dataTransfer.dropEffect = 'copy';
                          if (!isComposerDragOver) setIsComposerDragOver(true);
                        }
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setIsComposerDragOver(false);
                        if (e.dataTransfer?.files?.length) {
                          void handleAttachFilesBatch(e.dataTransfer.files, {
                            insertAtPrompt: false,
                          });
                        }
                      }}
                      className={`w-10 h-10 rounded-[10px] border flex items-center justify-center transition-colors ${
                        openMenu === 'plus-upload' || openMenu === 'plus-assets'
                          ? 'bg-[#2f2f2f] border-white/[0.22] text-white'
                          : 'bg-[#242424] hover:bg-[#2d2d2d] border-white/[0.07] text-white/75 hover:text-white'
                      }`}
                      title="Upload from device, Select from Assets, Add from canvas, or drag & drop files here"
                    >
                      <Plus className="w-4 h-4" strokeWidth={1.8} />
                    </button>

                    {/* Dreamina 3-Item [ + ] Menu */}
                    {openMenu === 'plus-upload' && (
                      <div
                        data-testid="composer-plus-menu"
                        className="absolute bottom-full left-0 mb-2 w-[216px] p-1.5 rounded-[14px] bg-[#202020] border border-white/[0.09] shadow-[0_20px_50px_rgba(0,0,0,0.78)] z-50 space-y-0.5 text-[13px]"
                      >
                        <button
                          type="button"
                          onClick={() =>
                            triggerDeviceUpload({
                              accept:
                                modality === 'video'
                                  ? 'image/*,video/*,audio/*'
                                  : 'image/*',
                              insertAtPrompt: false,
                            })
                          }
                          className="w-full h-9 px-3 rounded-[9px] hover:bg-white/[0.08] text-white/92 flex items-center gap-2.5 text-left transition-colors"
                        >
                          <Upload className="w-4 h-4 text-white/75 shrink-0" strokeWidth={1.65} />
                          <span>Upload from device</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setAssetPickerSearch('');
                            setOpenMenu('plus-assets');
                            void refreshAssetsCatalog('all', false);
                          }}
                          className="w-full h-9 px-3 rounded-[9px] hover:bg-white/[0.08] text-white/92 flex items-center gap-2.5 text-left transition-colors"
                        >
                          <FolderOpen
                            className="w-4 h-4 text-white/75 shrink-0"
                            strokeWidth={1.65}
                          />
                          <span>Select from Assets</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setCanvasRefPickerSourceNodeId(selectedNode.id);
                            setOpenMenu(null);
                          }}
                          className="w-full h-9 px-3 rounded-[9px] hover:bg-white/[0.08] text-white/92 flex items-center gap-2.5 text-left transition-colors"
                        >
                          <Sparkles className="w-4 h-4 text-white/75 shrink-0" strokeWidth={1.65} />
                          <span>Add from canvas</span>
                        </button>
                      </div>
                    )}

                    {/* Select from Assets Picker Subview */}
                    {openMenu === 'plus-assets' && (
                      <div
                        data-testid="composer-assets-menu"
                        className="absolute bottom-full left-0 mb-2 w-[304px] max-h-[308px] p-2 rounded-[14px] bg-[#202020] border border-white/[0.09] shadow-[0_20px_50px_rgba(0,0,0,0.82)] z-50 flex flex-col gap-2 text-[12px]"
                      >
                        <div className="flex items-center justify-between gap-2 px-1">
                          <button
                            type="button"
                            onClick={() => setOpenMenu('plus-upload')}
                            className="inline-flex items-center gap-1 text-white/70 hover:text-white text-[12px] font-medium"
                          >
                            <ChevronLeft className="w-3.5 h-3.5" strokeWidth={1.8} />
                            <span>Select from Assets</span>
                          </button>
                          {assetsLoading && (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-white/45" />
                          )}
                        </div>
                        <div className="relative">
                          <Search className="w-3.5 h-3.5 text-white/35 absolute left-2.5 top-1/2 -translate-y-1/2" />
                          <input
                            type="text"
                            value={assetPickerSearch}
                            onChange={(e) => setAssetPickerSearch(e.target.value)}
                            placeholder="Search @Elements & cloud assets…"
                            className="w-full h-7 pl-7 pr-2.5 rounded-[8px] bg-[#141414] border border-white/[0.08] text-[11.5px] text-white placeholder:text-white/35 outline-none select-text"
                          />
                        </div>
                        <div className="overflow-y-auto max-h-[212px] space-y-1 pr-0.5">
                          {elements
                            .filter((el) => {
                              const q = assetPickerSearch.trim().toLowerCase();
                              return (
                                !q ||
                                el.handle.toLowerCase().includes(q) ||
                                el.name.toLowerCase().includes(q)
                              );
                            })
                            .map((el) => (
                              <button
                                key={`vault_${el.id}`}
                                type="button"
                                onClick={() => {
                                  const refImg = el.references?.[0]?.dataUrl;
                                  if (refImg) {
                                    attachAssetUrlToNode(selectedNode.id, {
                                      url: refImg,
                                      title: el.name,
                                      kind: 'image',
                                      handle: el.handle,
                                    });
                                  }
                                  insertHandleIntoPrompt(el.handle);
                                  setOpenMenu(null);
                                }}
                                className="w-full h-9 px-2 rounded-[8px] hover:bg-white/[0.08] flex items-center justify-between gap-2 text-left"
                              >
                                <span className="flex items-center gap-2 min-w-0">
                                  {el.references?.[0]?.dataUrl ? (
                                    <SmartMediaImage
                                      src={el.references[0].dataUrl}
                                      alt={el.name}
                                      className="w-6 h-6 rounded-[5px] object-cover shrink-0"
                                    />
                                  ) : (
                                    <UserSquare2 className="w-4 h-4 text-[#20D5EC] shrink-0" />
                                  )}
                                  <span className="truncate text-white/90 font-medium">
                                    {el.handle}
                                  </span>
                                </span>
                                <span className="text-[10.5px] text-white/40 shrink-0">
                                  Element
                                </span>
                              </button>
                            ))}

                          {assetsCatalog
                            .filter((asset) => {
                              if (modality === 'image' && asset.kind !== 'image') return false;
                              const q = assetPickerSearch.trim().toLowerCase();
                              return (
                                !q ||
                                asset.title.toLowerCase().includes(q) ||
                                (asset.prompt || '').toLowerCase().includes(q)
                              );
                            })
                            .slice(0, 24)
                            .map((asset) => (
                              <button
                                key={asset.id}
                                type="button"
                                onClick={() => {
                                  attachAssetUrlToNode(selectedNode.id, {
                                    url: asset.url,
                                    title: asset.title,
                                    kind: asset.kind,
                                  });
                                  setOpenMenu(null);
                                }}
                                className="w-full h-9 px-2 rounded-[8px] hover:bg-white/[0.08] flex items-center justify-between gap-2 text-left"
                              >
                                <span className="flex items-center gap-2 min-w-0">
                                  {asset.kind === 'image' || asset.thumbnailUrl ? (
                                    <SmartMediaImage
                                      src={asset.thumbnailUrl || asset.url}
                                      alt={asset.title}
                                      className="w-6 h-6 rounded-[5px] object-cover shrink-0"
                                    />
                                  ) : asset.kind === 'video' ? (
                                    <Film className="w-4 h-4 text-[#20D5EC] shrink-0" />
                                  ) : (
                                    <AudioLines className="w-4 h-4 text-[#20D5EC] shrink-0" />
                                  )}
                                  <span className="truncate text-white/90">{asset.title}</span>
                                </span>
                                <span className="text-[10px] text-white/40 uppercase shrink-0">
                                  {asset.kind}
                                </span>
                              </button>
                            ))}

                          {!assetsLoading &&
                            elements.length === 0 &&
                            assetsCatalog.length === 0 && (
                              <div className="px-2 py-4 text-center text-[11.5px] text-white/40">
                                No cloud assets yet. Upload a file or pick from canvas.
                              </div>
                            )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Wired Upstream Image / Element Reference Thumbnails */}
                  {(!composerExpanded || composerFilterTab !== 'text') &&
                    upstreamRefNodes.map((up, upIdx) => {
                      const chipHandle = deriveUiHandleForNode(up, upIdx + 1);
                      const isTagged = selectedNode.prompt
                        .toLowerCase()
                        .includes(chipHandle.toLowerCase());
                      return (
                        <div
                          key={up.id}
                          data-testid={`composer-ref-tile-${up.id}`}
                          className={`group relative w-10 h-10 rounded-[10px] border overflow-hidden shrink-0 transition-colors ${
                            isTagged
                              ? 'border-[#20D5EC]/75 bg-[#162930]'
                              : 'border-white/[0.14] bg-[#222222]'
                          }`}
                          title={`${chipHandle} · ${up.title} (click to mention in prompt)`}
                        >
                          <button
                            type="button"
                            onClick={() => insertHandleIntoPrompt(chipHandle)}
                            className="w-full h-full flex items-center justify-center"
                          >
                            {up.imageUrl ? (
                              <SmartMediaImage
                                src={up.imageUrl}
                                alt={up.title}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <ImageIcon className="w-4 h-4 text-[#20D5EC]/80" />
                            )}
                            <span className="absolute inset-x-0 bottom-0 px-1 py-0.5 bg-black/75 text-[8.5px] font-semibold text-[#8cf0ff] truncate text-center leading-none">
                              {chipHandle}
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              disconnectNodes(up.id, selectedNode.id);
                            }}
                            className="opacity-0 group-hover:opacity-100 absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/80 text-white/80 hover:text-white flex items-center justify-center transition-opacity"
                            title="Disconnect reference"
                          >
                            <X className="w-2.5 h-2.5" strokeWidth={2.2} />
                          </button>
                        </div>
                      );
                    })}

                  {/* Wired Upstream Video & Audio Reference Thumbnails */}
                  {(!composerExpanded || composerFilterTab === 'all') &&
                    [...upstreamVideoNodes, ...upstreamAudioNodes].map((up, idx) => {
                      const chipHandle = deriveUiHandleForNode(up, idx + 1);
                      return (
                        <div
                          key={up.id}
                          className="group relative w-10 h-10 rounded-[10px] border border-white/[0.14] bg-[#222222] overflow-hidden shrink-0"
                          title={`${chipHandle} · ${up.title} (click to mention)`}
                        >
                          <button
                            type="button"
                            onClick={() => insertHandleIntoPrompt(chipHandle)}
                            className="w-full h-full flex items-center justify-center"
                          >
                            {up.imageUrl ? (
                              <SmartMediaImage
                                src={up.imageUrl}
                                alt={up.title}
                                className="w-full h-full object-cover"
                              />
                            ) : up.kind === 'video' ? (
                              <Film className="w-4 h-4 text-[#20D5EC]" />
                            ) : (
                              <AudioLines className="w-4 h-4 text-[#20D5EC]" />
                            )}
                            <span className="absolute inset-x-0 bottom-0 px-1 py-0.5 bg-black/75 text-[8.5px] font-semibold text-[#8cf0ff] truncate text-center leading-none">
                              {chipHandle}
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              disconnectNodes(up.id, selectedNode.id);
                            }}
                            className="opacity-0 group-hover:opacity-100 absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/80 text-white/80 hover:text-white flex items-center justify-center transition-opacity"
                            title="Disconnect reference"
                          >
                            <X className="w-2.5 h-2.5" strokeWidth={2.2} />
                          </button>
                        </div>
                      );
                    })}

                  {/* Wired Upstream Text Reference Chips (shown in All / Text tab) */}
                  {(!composerExpanded || composerFilterTab !== 'images') &&
                    upstreamTextNodes.map((up, idx) => {
                      const chipHandle = `@Text${idx + 1}`;
                      return (
                        <div
                          key={up.id}
                          className="group relative h-10 px-2.5 rounded-[10px] border border-white/[0.12] bg-[#222222] flex items-center gap-1.5 text-[11px] text-white/85 shrink-0"
                          title={up.prompt || up.title}
                        >
                          <Type className="w-3.5 h-3.5 text-[#20D5EC]" />
                          <span className="max-w-[90px] truncate">{up.title}</span>
                          <button
                            type="button"
                            onClick={() => disconnectNodes(up.id, selectedNode.id)}
                            className="text-white/40 hover:text-white"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      );
                    })}

                  {/* Attached Direct Image Reference Thumbnails */}
                  {(!composerExpanded || composerFilterTab !== 'text') &&
                    (selectedNode.referenceUrls || []).map((refUrl, idx) => {
                      const handle = resolveBindingHandleForUrl(refUrl, 'Image', idx + 1);
                      return (
                        <div
                          key={`img_${refUrl}_${idx}`}
                          data-testid={`attached-image-ref-${idx}`}
                          className="group relative w-10 h-10 rounded-[10px] border border-white/[0.14] bg-[#222222] overflow-hidden shrink-0"
                          title={`${handle} (click to mention in prompt)`}
                        >
                          <button
                            type="button"
                            onClick={() => insertHandleIntoPrompt(handle)}
                            className="w-full h-full flex items-center justify-center"
                          >
                            <SmartMediaImage
                              src={refUrl}
                              alt={handle}
                              className="w-full h-full object-cover"
                            />
                            <span className="absolute inset-x-0 bottom-0 px-1 py-0.5 bg-black/75 text-[8.5px] font-semibold text-white/90 truncate text-center leading-none">
                              {handle}
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeReferenceUrlFromNode(selectedNode.id, refUrl);
                            }}
                            className="opacity-0 group-hover:opacity-100 absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/80 text-white/80 hover:text-white flex items-center justify-center transition-opacity"
                            title="Remove reference"
                          >
                            <X className="w-2.5 h-2.5" strokeWidth={2.2} />
                          </button>
                        </div>
                      );
                    })}

                  {/* Attached Direct Video Reference Thumbnails */}
                  {(!composerExpanded || composerFilterTab === 'all') &&
                    (selectedNode.videoReferenceUrls || []).map((vidUrl, idx) => {
                      const handle = resolveBindingHandleForUrl(vidUrl, 'Video', idx + 1);
                      return (
                        <div
                          key={`vid_${vidUrl}_${idx}`}
                          data-testid={`attached-video-ref-${idx}`}
                          className="group relative w-10 h-10 rounded-[10px] border border-white/[0.14] bg-[#222222] overflow-hidden shrink-0"
                          title={`${handle} (click to mention in prompt)`}
                        >
                          <button
                            type="button"
                            onClick={() => insertHandleIntoPrompt(handle)}
                            className="w-full h-full flex flex-col items-center justify-center"
                          >
                            <Film className="w-4 h-4 text-[#20D5EC] mb-2" strokeWidth={1.7} />
                            <span className="absolute inset-x-0 bottom-0 px-1 py-0.5 bg-black/75 text-[8.5px] font-semibold text-[#8cf0ff] truncate text-center leading-none">
                              {handle}
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeVideoReferenceUrlFromNode(selectedNode.id, vidUrl);
                            }}
                            className="opacity-0 group-hover:opacity-100 absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/80 text-white/80 hover:text-white flex items-center justify-center transition-opacity"
                            title="Remove video reference"
                          >
                            <X className="w-2.5 h-2.5" strokeWidth={2.2} />
                          </button>
                        </div>
                      );
                    })}

                  {/* Attached Direct Audio Reference Thumbnails */}
                  {(!composerExpanded || composerFilterTab === 'all') &&
                    (selectedNode.audioReferenceUrls || []).map((audUrl, idx) => {
                      const handle = resolveBindingHandleForUrl(audUrl, 'Audio', idx + 1);
                      return (
                        <div
                          key={`aud_${audUrl}_${idx}`}
                          data-testid={`attached-audio-ref-${idx}`}
                          className="group relative w-10 h-10 rounded-[10px] border border-white/[0.14] bg-[#222222] overflow-hidden shrink-0"
                          title={`${handle} (click to mention in prompt)`}
                        >
                          <button
                            type="button"
                            onClick={() => insertHandleIntoPrompt(handle)}
                            className="w-full h-full flex flex-col items-center justify-center"
                          >
                            <AudioLines
                              className="w-4 h-4 text-[#20D5EC] mb-2"
                              strokeWidth={1.7}
                            />
                            <span className="absolute inset-x-0 bottom-0 px-1 py-0.5 bg-black/75 text-[8.5px] font-semibold text-[#8cf0ff] truncate text-center leading-none">
                              {handle}
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeAudioReferenceUrlFromNode(selectedNode.id, audUrl);
                            }}
                            className="opacity-0 group-hover:opacity-100 absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/80 text-white/80 hover:text-white flex items-center justify-center transition-opacity"
                            title="Remove audio reference"
                          >
                            <X className="w-2.5 h-2.5" strokeWidth={2.2} />
                          </button>
                        </div>
                      );
                    })}
                </div>

                {/* Top-Right Expand / Collapse Toggle */}
                <button
                  type="button"
                  data-testid="composer-expand-btn"
                  onClick={() => setComposerExpanded((prev) => !prev)}
                  className="w-6 h-6 rounded-[6px] hover:bg-white/[0.08] text-white/50 hover:text-white flex items-center justify-center shrink-0 transition-colors"
                  title={composerExpanded ? 'Collapse prompt composer' : 'Expand prompt composer'}
                >
                  {composerExpanded ? (
                    <Minimize2 className="w-3.5 h-3.5" strokeWidth={1.75} />
                  ) : (
                    <Maximize2 className="w-3.5 h-3.5" strokeWidth={1.75} />
                  )}
                </button>
              </div>
            )}

            {/* Prompt Textarea + Dreamina [@] Keycap Placeholder */}
            <div className="relative">
              {!selectedNode.prompt && modality !== 'audio' && (
                <div className="pointer-events-none absolute inset-x-1 top-1 text-[13.5px] leading-relaxed text-white/35 flex items-center gap-1 select-none">
                  <span>
                    {modality === 'video'
                      ? 'Describe your video or use'
                      : 'Describe your image or use'}
                  </span>
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-[5px] bg-white/[0.07] border border-white/[0.08] text-white/60 text-[12px] font-medium">
                    @
                  </span>
                  <span>
                    {modality === 'video'
                      ? 'to mention elements, images, and videos'
                      : 'to mention elements'}
                  </span>
                </div>
              )}
              {selectedNode.prompt === '@' && atAutocompleteOpen && (
                <div className="pointer-events-none absolute left-[18px] top-1 text-[13.5px] leading-relaxed text-white/32 select-none">
                  Search elements, images, and videos
                </div>
              )}
              <textarea
                ref={promptTextareaRef}
                data-testid="composer-prompt-textarea"
                rows={composerExpanded ? 6 : 2}
                value={selectedNode.prompt}
                onChange={(e) =>
                  handlePromptChange(e.target.value, e.target.selectionStart ?? undefined)
                }
                onClick={(e) => {
                  const target = e.currentTarget;
                  if (target.value.includes('@')) {
                    detectAtMentionAtCaret(
                      target.value,
                      target.selectionStart ?? target.value.length
                    );
                  }
                }}
                onKeyDown={(e) => {
                  if (atAutocompleteOpen && atCategory === null) {
                    if (e.key === 'ArrowDown' && filteredAtMentionItems.length > 0) {
                      e.preventDefault();
                      setAtActiveIndex(
                        (prev) => (prev + 1) % filteredAtMentionItems.length
                      );
                      return;
                    }
                    if (e.key === 'ArrowUp' && filteredAtMentionItems.length > 0) {
                      e.preventDefault();
                      setAtActiveIndex(
                        (prev) =>
                          (prev - 1 + filteredAtMentionItems.length) %
                          filteredAtMentionItems.length
                      );
                      return;
                    }
                    if (
                      (e.key === 'Enter' || e.key === 'Tab') &&
                      !e.metaKey &&
                      !e.ctrlKey &&
                      filteredAtMentionItems.length > 0
                    ) {
                      e.preventDefault();
                      const chosen =
                        filteredAtMentionItems[
                          Math.min(atActiveIndex, filteredAtMentionItems.length - 1)
                        ];
                      if (chosen) {
                        insertHandleIntoPrompt(chosen.handle, chosen.nodeId);
                      }
                      return;
                    }
                    if (e.key === 'Escape') {
                      e.preventDefault();
                      setAtAutocompleteOpen(false);
                      setAtCategory(null);
                      return;
                    }
                  } else if (atAutocompleteOpen && e.key === 'Escape') {
                    e.preventDefault();
                    setAtCategory(null);
                    setAtAutocompleteOpen(false);
                    return;
                  }
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    void generateSingleNode(selectedNode.id);
                  }
                }}
                placeholder={
                  modality === 'audio'
                    ? selectedNode.audioMode === 'sfx'
                      ? 'Describe the foley or ambient sound effect to generate…'
                      : 'Write the voiceover script or character dialogue…'
                    : ''
                }
                className={`w-full bg-transparent px-1 py-1 text-[13.5px] leading-relaxed text-white placeholder:text-white/35 resize-none outline-none select-text ${
                  composerExpanded ? 'min-h-[148px]' : 'min-h-[48px]'
                }`}
              />
            </div>

            {/* Dreamina Two-Section Floating @ Mention & "Add reference" Menu (viewport-clamped) */}
            {atAutocompleteOpen && modality !== 'audio' && (
              <div
                data-testid="dreamina-at-menu"
                style={{
                  left: `${popoverLeft + 12}px`,
                  bottom: `${atMenuSafeBottom}px`,
                  maxHeight: 'calc(100vh - 72px)',
                }}
                className="fixed w-[268px] p-2 rounded-[16px] bg-[#1e1e1e] border border-white/[0.09] shadow-[0_22px_54px_rgba(0,0,0,0.86)] z-50 text-[13px] overflow-y-auto"
              >
                {atCategory === null ? (
                  <>
                    <div className="px-2 py-0.5 text-[11.5px] text-white/45 font-normal">
                      Use &quot;@&quot; to mention
                    </div>
                    <div className="max-h-[120px] overflow-y-auto space-y-0.5">
                      {filteredAtMentionItems.length > 0 ? (
                        filteredAtMentionItems.map((item, idx) => {
                          const isHighlighted = idx === atActiveIndex;
                          return (
                            <button
                              key={item.handle}
                              type="button"
                              onMouseEnter={() => setAtActiveIndex(idx)}
                              onClick={() =>
                                insertHandleIntoPrompt(item.handle, item.nodeId)
                              }
                              className={`w-full h-9 px-2 rounded-[9px] flex items-center gap-2.5 text-left transition-colors ${
                                isHighlighted
                                  ? 'bg-white/[0.09] text-white'
                                  : 'hover:bg-white/[0.06] text-white/92'
                              }`}
                            >
                              {item.imageUrl ? (
                                <SmartMediaImage
                                  src={item.imageUrl}
                                  alt={item.label}
                                  className="w-6.5 h-6.5 w-[26px] h-[26px] rounded-[6px] object-cover shrink-0"
                                />
                              ) : item.kind === 'video' ? (
                                <span className="w-[26px] h-[26px] rounded-[6px] bg-white/[0.07] flex items-center justify-center shrink-0">
                                  <Film className="w-3.5 h-3.5 text-[#20D5EC]" />
                                </span>
                              ) : item.kind === 'audio' ? (
                                <span className="w-[26px] h-[26px] rounded-[6px] bg-white/[0.07] flex items-center justify-center shrink-0">
                                  <AudioLines className="w-3.5 h-3.5 text-[#20D5EC]" />
                                </span>
                              ) : (
                                <span className="w-[26px] h-[26px] rounded-[6px] bg-white/[0.07] flex items-center justify-center shrink-0">
                                  <AtSign className="w-3.5 h-3.5 text-[#20D5EC]" />
                                </span>
                              )}
                              <span className="truncate font-medium text-[13px]">
                                {item.displayName}
                              </span>
                            </button>
                          );
                        })
                      ) : (
                        <div className="px-2 py-1.5 text-[11.5px] text-white/38">
                          No matching @elements yet — add below
                        </div>
                      )}
                    </div>

                    <div className="my-1.5 h-px bg-white/[0.08]" />

                    <div className="px-2 py-0.5 text-[11.5px] text-white/45 font-normal">
                      Add reference
                    </div>
                    <div className="space-y-0.5">
                      {(
                        [
                          {
                            id: 'element' as const,
                            label: 'Element',
                            icon: UserSquare2,
                            isNew: false,
                          },
                          {
                            id: 'image' as const,
                            label: 'Image',
                            icon: ImageIcon,
                            isNew: false,
                          },
                          {
                            id: 'video' as const,
                            label: 'Video',
                            icon: Film,
                            isNew: false,
                          },
                          {
                            id: 'audio' as const,
                            label: 'Audio',
                            icon: AudioLines,
                            isNew: false,
                          },
                          {
                            id: 'motion' as const,
                            label: 'Motion',
                            icon: Compass,
                            isNew: true,
                          },
                        ] as const
                      ).map((cat) => {
                        const IconComp = cat.icon;
                        return (
                          <button
                            key={cat.id}
                            type="button"
                            data-testid={`at-add-ref-${cat.id}`}
                            onClick={() => {
                              setAtCategory(cat.id);
                              void refreshAssetsCatalog('all', false);
                            }}
                            className="w-full h-8 px-2 rounded-[9px] hover:bg-white/[0.07] text-white/92 flex items-center justify-between gap-2 transition-colors"
                          >
                            <span className="flex items-center gap-2.5">
                              <IconComp
                                className="w-4 h-4 text-white/80 shrink-0"
                                strokeWidth={1.65}
                              />
                              <span>{cat.label}</span>
                              {cat.isNew && (
                                <span className="px-1.5 py-0.5 rounded-[4px] bg-[#133240] text-[#20D5EC] text-[10px] font-semibold leading-none">
                                  New
                                </span>
                              )}
                            </span>
                            <ChevronRight
                              className="w-3.5 h-3.5 text-white/45"
                              strokeWidth={1.8}
                            />
                          </button>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between px-1 py-0.5">
                      <button
                        type="button"
                        onClick={() => setAtCategory(null)}
                        className="inline-flex items-center gap-1 text-[12px] font-medium text-white/80 hover:text-white"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" strokeWidth={1.8} />
                        <span className="capitalize">Add {atCategory}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAtCategory(null);
                          setAtAutocompleteOpen(false);
                        }}
                        className="text-white/40 hover:text-white"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        triggerDeviceUpload({
                          accept:
                            atCategory === 'video' || atCategory === 'motion'
                              ? 'video/*'
                              : atCategory === 'audio'
                              ? 'audio/*'
                              : 'image/*',
                          motionMode: atCategory === 'motion',
                          insertAtPrompt: true,
                        })
                      }
                      className="w-full h-8 px-2.5 rounded-[8px] bg-white/[0.06] hover:bg-white/[0.11] text-white/92 text-[12px] flex items-center gap-2"
                    >
                      <Upload className="w-3.5 h-3.5 text-[#20D5EC]" strokeWidth={1.7} />
                      <span>Upload {atCategory} from device…</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setCanvasRefPickerSourceNodeId(selectedNode.id);
                        setAtCategory(null);
                        setAtAutocompleteOpen(false);
                      }}
                      className="w-full h-8 px-2.5 rounded-[8px] hover:bg-white/[0.07] text-white/85 text-[12px] flex items-center gap-2"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-[#20D5EC]" strokeWidth={1.7} />
                      <span>Pick from canvas…</span>
                    </button>

                    <div className="my-1 h-px bg-white/[0.07]" />

                    <div className="max-h-[172px] overflow-y-auto space-y-0.5">
                      {atCategory === 'element' &&
                        elements.map((el) => (
                          <button
                            key={el.id}
                            type="button"
                            onClick={() => {
                              const refImg = el.references?.[0]?.dataUrl;
                              if (refImg) {
                                attachAssetUrlToNode(selectedNode.id, {
                                  url: refImg,
                                  title: el.name,
                                  kind: 'image',
                                  handle: el.handle,
                                });
                              }
                              insertHandleIntoPrompt(el.handle);
                            }}
                            className="w-full h-9 px-2 rounded-[8px] hover:bg-white/[0.07] flex items-center gap-2 text-left text-[12px] text-white/90"
                          >
                            {el.references?.[0]?.dataUrl ? (
                              <SmartMediaImage
                                src={el.references[0].dataUrl}
                                alt={el.name}
                                className="w-6 h-6 rounded-[5px] object-cover shrink-0"
                              />
                            ) : (
                              <UserSquare2 className="w-4 h-4 text-[#20D5EC] shrink-0" />
                            )}
                            <span className="truncate font-medium">{el.handle}</span>
                          </button>
                        ))}

                      {(atCategory === 'image' || atCategory === 'element') &&
                        linkableCanvasImageNodes.slice(0, 10).map((cn, idx) => {
                          const h = deriveUiHandleForNode(cn, idx + 1);
                          return (
                            <button
                              key={cn.id}
                              type="button"
                              onClick={() => insertHandleIntoPrompt(h, cn.id)}
                              className="w-full h-9 px-2 rounded-[8px] hover:bg-white/[0.07] flex items-center justify-between gap-2 text-left text-[12px] text-white/90"
                            >
                              <span className="flex items-center gap-2 min-w-0">
                                {cn.imageUrl ? (
                                  <SmartMediaImage
                                    src={cn.imageUrl}
                                    alt={cn.title}
                                    className="w-6 h-6 rounded-[5px] object-cover shrink-0"
                                  />
                                ) : (
                                  <ImageIcon className="w-4 h-4 text-white/55 shrink-0" />
                                )}
                                <span className="truncate">{cn.title}</span>
                              </span>
                              <span className="text-[10.5px] text-[#20D5EC] shrink-0">
                                {h}
                              </span>
                            </button>
                          );
                        })}

                      {(atCategory === 'video' || atCategory === 'motion') &&
                        linkableCanvasVideoNodes.slice(0, 10).map((cn, idx) => {
                          const h = deriveUiHandleForNode(cn, idx + 1);
                          return (
                            <button
                              key={cn.id}
                              type="button"
                              onClick={() => {
                                if (atCategory === 'motion') {
                                  updateModelParam('mode', 'motion_control');
                                }
                                insertHandleIntoPrompt(h, cn.id);
                              }}
                              className="w-full h-9 px-2 rounded-[8px] hover:bg-white/[0.07] flex items-center justify-between gap-2 text-left text-[12px] text-white/90"
                            >
                              <span className="flex items-center gap-2 min-w-0">
                                <Film className="w-4 h-4 text-[#20D5EC] shrink-0" />
                                <span className="truncate">{cn.title}</span>
                              </span>
                              <span className="text-[10.5px] text-[#20D5EC] shrink-0">
                                {h}
                              </span>
                            </button>
                          );
                        })}

                      {atCategory === 'audio' &&
                        linkableCanvasAudioNodes.slice(0, 10).map((cn, idx) => {
                          const h = deriveUiHandleForNode(cn, idx + 1);
                          return (
                            <button
                              key={cn.id}
                              type="button"
                              onClick={() => insertHandleIntoPrompt(h, cn.id)}
                              className="w-full h-9 px-2 rounded-[8px] hover:bg-white/[0.07] flex items-center justify-between gap-2 text-left text-[12px] text-white/90"
                            >
                              <span className="flex items-center gap-2 min-w-0">
                                <AudioLines className="w-4 h-4 text-[#20D5EC] shrink-0" />
                                <span className="truncate">{cn.title}</span>
                              </span>
                              <span className="text-[10.5px] text-[#20D5EC] shrink-0">
                                {h}
                              </span>
                            </button>
                          );
                        })}

                      {assetsCatalog
                        .filter((a) =>
                          atCategory === 'video' || atCategory === 'motion'
                            ? a.kind === 'video'
                            : atCategory === 'audio'
                            ? a.kind === 'audio'
                            : a.kind === 'image'
                        )
                        .slice(0, 12)
                        .map((asset) => (
                          <button
                            key={asset.id}
                            type="button"
                            onClick={() => {
                              const assignedHandle = attachAssetUrlToNode(selectedNode.id, {
                                url: asset.url,
                                title: asset.title,
                                kind: asset.kind,
                                motionMode: atCategory === 'motion',
                              });
                              insertHandleIntoPrompt(assignedHandle);
                            }}
                            className="w-full h-9 px-2 rounded-[8px] hover:bg-white/[0.07] flex items-center gap-2 text-left text-[12px] text-white/85"
                          >
                            {asset.kind === 'image' || asset.thumbnailUrl ? (
                              <SmartMediaImage
                                src={asset.thumbnailUrl || asset.url}
                                alt={asset.title}
                                className="w-6 h-6 rounded-[5px] object-cover shrink-0"
                              />
                            ) : asset.kind === 'video' ? (
                              <Film className="w-4 h-4 text-[#20D5EC] shrink-0" />
                            ) : (
                              <AudioLines className="w-4 h-4 text-[#20D5EC] shrink-0" />
                            )}
                            <span className="truncate">{asset.title}</span>
                          </button>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Inline Generation Error & 1-Click Retry Banner */}
          {selectedNode.lastError && !isGenerating && (
            <div
              data-testid="composer-error-banner"
              className="px-3 py-2 rounded-[10px] bg-rose-500/[0.1] border border-rose-400/30 flex items-center justify-between gap-2 text-[11.5px]"
            >
              <span className="text-rose-200/95 truncate" title={selectedNode.lastError}>
                {selectedNode.lastError}
              </span>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => void generateSingleNode(selectedNode.id)}
                  className="h-6 px-2.5 rounded-[6px] bg-rose-500/25 hover:bg-rose-500/40 border border-rose-300/35 text-rose-100 font-semibold inline-flex items-center gap-1"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Retry</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    updateNodeFields(selectedNode.id, {
                      lastError: undefined,
                      editBadge: undefined,
                    })
                  }
                  className="text-rose-200/60 hover:text-white p-0.5"
                  title="Dismiss error"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

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

          {/* Bottom Controls Row: Single-Row [Where] + [Model] + [Unified Format/Res] + [Mode] + [Duration] + [@] + [Generate] */}
          <div className="flex items-center justify-between gap-1.5 flex-nowrap">
            <div className="flex items-center gap-1.5 min-w-0 flex-nowrap [&_button]:whitespace-nowrap">
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

              {/* 3. DREAMINA UNIFIED FORMAT & RESOLUTION PILL (Aspect · Resolution · Count) */}
              {modality !== 'audio' && (aspectOptions.length > 0 || showResolutionPill) && (
                <div className="relative">
                  <button
                    type="button"
                    data-testid="unified-format-resolution-pill"
                    onClick={() => {
                      setAtAutocompleteOpen(false);
                      setAtCategory(null);
                      setOpenMenu(openMenu === 'format' ? null : 'format');
                    }}
                    className={`h-8 px-2.5 rounded-[8px] border tabular-nums text-[12px] flex items-center gap-1.5 transition-colors ${
                      openMenu === 'format'
                        ? 'bg-[#303030] border-white/[0.22] text-white'
                        : 'bg-[#252525] hover:bg-white/[0.11] border-white/[0.08] text-white/92'
                    }`}
                    title="Aspect Ratio, Output Resolution & Count"
                  >
                    <span>{selectedNode.aspectRatio}</span>
                    {showResolutionPill && (
                      <>
                        <span className="text-white/35">·</span>
                        <span>{activeDisplayResolution}</span>
                      </>
                    )}
                    <span className="text-white/35">·</span>
                    <span>
                      {modality === 'video'
                        ? '1 video'
                        : `${activeBatchCount} ${activeBatchCount === 1 ? 'image' : 'images'}`}
                    </span>
                    {effectivePlatformId === 'dreamina' && (
                      <Sparkles
                        className="w-3 h-3 text-[#20D5EC] shrink-0"
                        strokeWidth={1.9}
                      />
                    )}
                    <ChevronDown className="w-3 h-3 text-white/45 shrink-0" strokeWidth={1.6} />
                  </button>

                  {openMenu === 'format' && (
                    <div
                      data-testid="unified-format-popover"
                      className="absolute bottom-full left-0 mb-2 w-[280px] p-3 rounded-[14px] dreamina-menu z-50 space-y-3 text-[11.5px]"
                    >
                      {aspectOptions.length > 0 && (
                        <div className="space-y-1.5">
                          <div className="text-[10.5px] font-medium text-white/45 uppercase tracking-wider">
                            Aspect Ratio
                          </div>
                          <div className="grid grid-cols-4 gap-1 max-h-[144px] overflow-y-auto pr-0.5">
                            {aspectOptions.map((ar) => {
                              const isActiveAr =
                                String(selectedNode.aspectRatio).toLowerCase() ===
                                ar.toLowerCase();
                              return (
                                <button
                                  key={ar}
                                  type="button"
                                  data-testid={`format-aspect-${ar}`}
                                  onClick={() => setNodeAspectRatio(selectedNode.id, ar)}
                                  className={`h-7 px-1.5 rounded-[7px] tabular-nums text-[11px] border transition-colors ${
                                    isActiveAr
                                      ? 'bg-white text-[#0e0e0e] border-white font-semibold'
                                      : 'bg-[#171717] hover:bg-white/[0.08] border-white/[0.08] text-white/80'
                                  }`}
                                >
                                  {ar}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {showResolutionPill && (
                        <div className="space-y-1.5">
                          <div className="text-[10.5px] font-medium text-white/45 uppercase tracking-wider">
                            Resolution
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {resolutionOptions.map((res) => {
                              const isActiveRes =
                                String(activeDisplayResolution).toLowerCase() ===
                                res.toLowerCase();
                              return (
                                <button
                                  key={res}
                                  type="button"
                                  data-testid={`format-res-${res}`}
                                  onClick={() => setNodeUnifiedResolution(res)}
                                  className={`h-7 px-3 rounded-[7px] tabular-nums text-[11.5px] border transition-colors ${
                                    isActiveRes
                                      ? 'bg-white text-[#0e0e0e] border-white font-semibold'
                                      : 'bg-[#171717] hover:bg-white/[0.08] border-white/[0.08] text-white/80'
                                  }`}
                                >
                                  {res}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {modality === 'image' && (
                        <div className="space-y-1.5">
                          <div className="text-[10.5px] font-medium text-white/45 uppercase tracking-wider">
                            Images per Generation
                          </div>
                          <div className="grid grid-cols-4 gap-1">
                            {BATCH_COUNTS.map((cnt) => {
                              const isActiveCnt = activeBatchCount === cnt;
                              return (
                                <button
                                  key={cnt}
                                  type="button"
                                  data-testid={`format-count-${cnt}`}
                                  onClick={() =>
                                    updateNodeFields(selectedNode.id, { batchCount: cnt })
                                  }
                                  className={`h-7 rounded-[7px] tabular-nums text-[11.5px] border transition-colors ${
                                    isActiveCnt
                                      ? 'bg-white text-[#0e0e0e] border-white font-semibold'
                                      : 'bg-[#171717] hover:bg-white/[0.08] border-white/[0.08] text-white/80'
                                  }`}
                                >
                                  {cnt}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* First-Class Quality Pill (non-duplicate provider quality tiers only) */}
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

              {/* Dreamina Video Reference Mode Pill ("Omni reference ⌄" / "First & last frame ⌄" / "Text to video ⌄") */}
              {modality === 'video' && activeModelDef?.supportsReferences && !modeSpec && (
                <div className="relative">
                  <button
                    type="button"
                    data-testid="video-ref-mode-pill"
                    onClick={() =>
                      setOpenMenu(openMenu === 'video-ref-mode' ? null : 'video-ref-mode')
                    }
                    className="h-8 px-2.5 rounded-[8px] bg-[#252525] hover:bg-white/[0.11] border border-white/[0.07] text-[11.5px] text-white/90 flex items-center gap-1"
                    title="Video Reference Conditioning Mode"
                  >
                    <span className="font-medium text-white">
                      {activeVideoInputMethod === 'multi-ref'
                        ? 'Omni reference'
                        : activeVideoInputMethod === 'start-end'
                        ? 'First & last frame'
                        : 'Text to video'}
                    </span>
                    <ChevronDown className="w-3 h-3 text-white/40 shrink-0" strokeWidth={1.6} />
                  </button>
                  {openMenu === 'video-ref-mode' && (
                    <div className="absolute bottom-full left-0 mb-1.5 w-[178px] p-1 rounded-[10px] dreamina-menu z-50 space-y-0.5">
                      {(
                        [
                          { id: 'multi-ref' as const, label: 'Omni reference', show: true },
                          {
                            id: 'start-end' as const,
                            label: 'First & last frame',
                            show: activeModelDef?.supportsStartEndFrames !== false,
                          },
                          { id: 't2v' as const, label: 'Text to video', show: true },
                        ] as const
                      )
                        .filter((opt) => opt.show)
                        .map((opt) => {
                          const isActive = activeVideoInputMethod === opt.id;
                          return (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() => {
                                setVideoInputMethod(opt.id);
                                setOpenMenu(null);
                              }}
                              className={`w-full h-7 px-2.5 rounded-[7px] text-[11.5px] flex items-center justify-between gap-2 ${
                                isActive
                                  ? 'bg-white/[0.1] text-white font-medium'
                                  : 'hover:bg-white/[0.06] text-white/80'
                              }`}
                            >
                              <span>{opt.label}</span>
                              {isActive && (
                                <Check className="w-3 h-3 text-[#20D5EC] shrink-0" strokeWidth={2} />
                              )}
                            </button>
                          );
                        })}
                    </div>
                  )}
                </div>
              )}

              {/* Video Duration Pill ("15s ⌄") */}
              {modality === 'video' && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() =>
                      setOpenMenu(openMenu === 'duration' ? null : 'duration')
                    }
                    className="h-8 px-2 rounded-[8px] bg-[#252525] hover:bg-white/[0.11] border border-white/[0.07] tabular-nums text-[11.5px] text-white/85 flex items-center gap-1"
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
                          className={`w-full h-7 px-2.5 rounded-[7px] tabular-nums text-[11.5px] flex items-center justify-between ${
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
              )}

              {/* Dreamina Bottom Toolbar @ Mention Trigger */}
              {modality !== 'audio' && (
                <button
                  type="button"
                  data-testid="composer-at-btn"
                  onClick={openAtMenuFromToolbarButton}
                  className={`h-8 w-8 rounded-[8px] border flex items-center justify-center shrink-0 transition-colors ${
                    atAutocompleteOpen
                      ? 'bg-white text-[#0e0e0e] border-white'
                      : 'bg-[#252525] hover:bg-white/[0.11] border-white/[0.07] text-white/85 hover:text-white'
                  }`}
                  title='Mention @Element or add reference ("@")'
                >
                  <AtSign className="w-3.5 h-3.5" strokeWidth={1.75} />
                </button>
              )}

              {/* Compact Video DoP Camera Rig + Dynamic Audio Toggle */}
              {modality === 'video' && (
                <>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() =>
                        setOpenMenu(openMenu === 'camera' ? null : 'camera')
                      }
                      className={`h-8 px-2 rounded-[8px] border text-[11.5px] flex items-center gap-1 transition-colors max-w-[138px] ${
                        selectedNode.cameraMotion &&
                        selectedNode.cameraMotion !== 'Static Tripod'
                          ? 'bg-[#252525] border-[#20D5EC]/40 text-white'
                          : 'bg-[#252525] hover:bg-white/[0.11] border-white/[0.07] text-white/80'
                      }`}
                      title={`Camera Motion (DoP Rig): ${selectedNode.cameraMotion || 'Static Tripod'}`}
                    >
                      <Camera
                        className={`w-3.5 h-3.5 shrink-0 ${
                          selectedNode.cameraMotion &&
                          selectedNode.cameraMotion !== 'Static Tripod'
                            ? 'text-[#20D5EC]'
                            : 'text-white/65'
                        }`}
                        strokeWidth={1.6}
                      />
                      {selectedNode.cameraMotion &&
                        selectedNode.cameraMotion !== 'Static Tripod' && (
                          <span className="truncate">{selectedNode.cameraMotion}</span>
                        )}
                      <ChevronDown className="w-3 h-3 text-white/40 shrink-0" strokeWidth={1.6} />
                    </button>
                    {openMenu === 'camera' && (
                      <div className="absolute bottom-full right-0 mb-1.5 w-[212px] p-1.5 rounded-[11px] dreamina-menu z-50 space-y-0.5">
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
                      className={`h-8 w-8 rounded-[8px] border flex items-center justify-center shrink-0 transition-colors ${
                        selectedNode.audioEnabled ?? true
                          ? 'bg-[#252525] border-white/[0.1] text-white/90'
                          : 'bg-[#191919] border-white/[0.06] text-white/40'
                      }`}
                      title={`Native Video Audio: ${(selectedNode.audioEnabled ?? true) ? 'On' : 'Off'}`}
                    >
                      {selectedNode.audioEnabled ?? true ? (
                        <Volume2 className="w-3.5 h-3.5 text-[#20D5EC]" strokeWidth={1.6} />
                      ) : (
                        <VolumeX className="w-3.5 h-3.5" strokeWidth={1.6} />
                      )}
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
                      className="h-8 px-2 rounded-[8px] bg-[#252525] hover:bg-white/[0.11] border border-white/[0.07] tabular-nums text-[11.5px] text-white/85 flex items-center gap-1"
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
                            className={`w-full h-7 px-2.5 rounded-[7px] hover:bg-white/[0.08] tabular-nums text-[11.5px] flex items-center justify-between ${
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
                    <span className="h-4 min-w-[16px] px-1 rounded-full bg-[#20D5EC]/20 text-[#20D5EC] tabular-nums text-[10px] font-semibold flex items-center justify-center">
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
                                    className="w-24 h-7 px-2 rounded-[7px] bg-[#141414] border border-white/[0.08] tabular-nums text-[11.5px] text-white outline-none select-text"
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
                        className="w-28 h-7 px-2 rounded-[7px] bg-[#141414] border border-white/[0.08] tabular-nums text-[11.5px] text-white outline-none select-text"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right Execution CTAs */}
            <div className="flex items-center gap-1.5 shrink-0">
              {ownConnectedPlatforms.includes(effectivePlatformId) &&
                sharedAvailablePools.some(
                  (p) => p.platformId === effectivePlatformId && p.enabled
                ) && (
                  <div
                    className="h-8 p-0.5 rounded-full bg-[#1C1C1F] border border-white/[0.1] flex items-center text-[10.5px] font-medium"
                    title="Choose credit source for this generation"
                  >
                    <button
                      type="button"
                      onClick={() =>
                        updateNodeFields(selectedNode.id, { creditSource: 'own' })
                      }
                      className={`h-7 px-2 rounded-full transition-colors ${
                        (selectedNode.creditSource || 'own') !== 'shared'
                          ? 'bg-[#20D5EC]/20 text-[#20D5EC]'
                          : 'text-white/55 hover:text-white/85'
                      }`}
                    >
                      My Credits
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        updateNodeFields(selectedNode.id, { creditSource: 'shared' })
                      }
                      className={`h-7 px-2 rounded-full transition-colors ${
                        selectedNode.creditSource === 'shared'
                          ? 'bg-[#20D5EC]/20 text-[#20D5EC]'
                          : 'text-white/55 hover:text-white/85'
                      }`}
                    >
                      Shared Pool
                    </button>
                  </div>
                )}

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
                    <span>
                      Generate
                      {creditQuote?.ok
                        ? creditQuote.isUnlimitedEligible || creditQuote.unit === 'unlimited'
                          ? ' · ∞ Unlim'
                          : creditQuote.estimatedCredits != null
                          ? ` · ${creditQuote.estimatedCredits.toLocaleString()} ${
                              creditQuote.unit === 'chars' ||
                              creditQuote.unit === 'characters'
                                ? 'chars'
                                : 'cr'
                            }`
                          : ''
                        : ''}
                    </span>
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
  const downloadSelectedNodesMedia = useStudioStore((s) => s.downloadSelectedNodesMedia);

  const selNodes = useMemo(
    () =>
      selectedNodeIds
        .map((id) => nodes.find((n) => n.id === id))
        .filter((n): n is NonNullable<typeof n> => Boolean(n)),
    [nodes, selectedNodeIds]
  );

  const downloadableSelCount = useMemo(
    () => collectDownloadableMediaItemsFromNodes(selNodes, true).length,
    [selNodes]
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
    null | 'platform' | 'model' | 'format' | 'duration'
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
  const [batchCount, setBatchCount] = useState<1 | 2 | 3 | 4>(1);
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
      if (p.default !== undefined && !FIRST_CLASS_DUP_PARAMS.has(p.name.toLowerCase())) {
        defaults[p.name] = p.default;
      }
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
        {downloadableSelCount > 0 && (
          <button
            type="button"
            data-testid="multibar-download-zip-btn"
            onClick={() => void downloadSelectedNodesMedia(selNodes.map((n) => n.id))}
            className="h-7 px-2.5 rounded-[7px] bg-[#20D5EC]/15 hover:bg-[#20D5EC] border border-[#20D5EC]/40 text-[#7ceeff] hover:text-[#0b0d10] font-semibold flex items-center gap-1.5 transition-colors"
            title={`Download all ${downloadableSelCount} selected files as a ZIP archive`}
          >
            <Download className="w-3.5 h-3.5" strokeWidth={1.75} />
            <span>Download All ({downloadableSelCount})</span>
          </button>
        )}
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
              <span className="tabular-nums">{chip.tag}</span>
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
                <PlatformBrandIcon platformId={effectivePlatformId} size="xs" />
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
                        <span className="flex items-center gap-1.5 min-w-0">
                          <PlatformBrandIcon platformId={plat.id} size="xs" />
                          <span className="truncate">{plat.shortLabel}</span>
                        </span>
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

            {/* Unified Format & Resolution Pill (Aspect · Resolution · Count) */}
            {targetKind !== 'audio' && (
              <div className="relative">
                <button
                  type="button"
                  data-testid="multibar-unified-format-pill"
                  onClick={() =>
                    setOpenDropdown(openDropdown === 'format' ? null : 'format')
                  }
                  className="h-7 px-2.5 rounded-[8px] bg-[#252525] hover:bg-white/[0.1] border border-white/[0.08] tabular-nums text-[11px] text-white/90 flex items-center gap-1.5"
                >
                  <span>{aspectRatio}</span>
                  <span className="text-white/35">·</span>
                  <span>{resolution}</span>
                  <span className="text-white/35">·</span>
                  <span>
                    {targetKind === 'video'
                      ? '1 video'
                      : `${batchCount} ${batchCount === 1 ? 'image' : 'images'}`}
                  </span>
                  <ChevronDown className="w-3 h-3 text-white/45" />
                </button>
                {openDropdown === 'format' && (
                  <div className="absolute bottom-full left-0 mb-1.5 w-[256px] p-2.5 rounded-[12px] dreamina-menu z-50 space-y-2.5 text-[11px]">
                    {(activeModel?.aspectRatios?.length || 0) > 0 && (
                      <div className="space-y-1">
                        <div className="text-[10px] text-white/45 uppercase tracking-wider">
                          Aspect Ratio
                        </div>
                        <div className="grid grid-cols-4 gap-1">
                          {(activeModel?.aspectRatios || IMAGE_ASPECTS).map((ar) => (
                            <button
                              key={ar}
                              type="button"
                              onClick={() => setAspectRatio(ar)}
                              className={`h-6 px-1.5 rounded-[6px] text-[10.5px] ${
                                ar === aspectRatio
                                  ? 'bg-white text-[#0e0e0e] font-semibold'
                                  : 'bg-white/[0.05] text-white/80 hover:bg-white/[0.12]'
                              }`}
                            >
                              {ar}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    {(activeModel?.resolutions?.length || 0) > 0 && (
                      <div className="space-y-1">
                        <div className="text-[10px] text-white/45 uppercase tracking-wider">
                          Resolution
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {(activeModel?.resolutions || IMAGE_RESOLUTIONS).map((r) => (
                            <button
                              key={r}
                              type="button"
                              onClick={() => setResolution(r)}
                              className={`h-6 px-2.5 rounded-[6px] text-[10.5px] ${
                                r === resolution
                                  ? 'bg-white text-[#0e0e0e] font-semibold'
                                  : 'bg-white/[0.05] text-white/80 hover:bg-white/[0.12]'
                              }`}
                            >
                              {r}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    {targetKind === 'image' && (
                      <div className="space-y-1">
                        <div className="text-[10px] text-white/45 uppercase tracking-wider">
                          Images
                        </div>
                        <div className="grid grid-cols-4 gap-1">
                          {BATCH_COUNTS.map((cnt) => (
                            <button
                              key={cnt}
                              type="button"
                              onClick={() => setBatchCount(cnt)}
                              className={`h-6 rounded-[6px] text-[10.5px] ${
                                cnt === batchCount
                                  ? 'bg-white text-[#0e0e0e] font-semibold'
                                  : 'bg-white/[0.05] text-white/80 hover:bg-white/[0.12]'
                              }`}
                            >
                              {cnt}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Inline Enum Parameter Pills (non-duplicate params only) */}
            {(activeModel?.parameters || [])
              .filter(
                (p) =>
                  p.type === 'enum' &&
                  (p.options?.length || 0) > 1 &&
                  p.inlinePill !== false &&
                  !FIRST_CLASS_DUP_PARAMS.has(p.name.toLowerCase())
              )
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
                  <span>{durationSec === -1 ? 'Auto' : `${durationSec}s`}</span>
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
                        {d === -1 ? 'Auto' : `${d}s`}
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
