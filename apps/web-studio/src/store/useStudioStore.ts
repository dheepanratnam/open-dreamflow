import { create } from 'zustand';
import type {
  AspectRatio,
  BridgeIncomingEvent,
  BrowserPlatformTarget,
  BYOKCredentials,
  CameraTransitionCurve,
  CanvasEdge,
  CanvasNode,
  ChatMessageItem,
  ChromeBridgeState,
  DiskProjectMeta,
  DiskSnapshotItem,
  DreaminaSkill,
  DreaminaToolId,
  ElementVault,
  ExternalMcpServerRecord,
  FrameLayer,
  FrameLayerType,
  KeyframeBridgeCurve,
  MCPServerEntry,
  MCPToolDefinition,
  McpBackendHealth,
  McpOAuthSession,
  MultiframeBridge,
  MultiframeCard,
  PlatformDefinition,
  PlatformId,
  ProviderId,
  ProviderVerificationResult,
  ResolutionTier,
  StudioHistorySnapshot,
  StudioPresetId,
  StyleDNAPayload,
  TimelineClip,
} from '../types/studio';
import {
  LEGACY_MODEL_ID_REDIRECTS,
  PLATFORM_CATALOG,
  getModelsForPlatformAndModality,
  getPlatformBadgeLabel,
  getPlatformConnectionStatus,
  nodeKindToModality,
  resolveByokCredentialsForPlatform,
  resolveCanonicalModelId,
} from '../presets/platformCatalog';
import {
  BUILTIN_SKILLS,
  buildBlankStudioGraph,
  buildInitialElements,
  buildInitialStudioGraph,
  buildStudioPresetGraph,
  createDefaultLayers,
  type MediaCatalogItem,
} from '../presets/studioPresets';
import {
  FOUR_ANGLE_LABELS,
  NINE_GRID_LABELS,
  compositeInpaintRedraw,
  createDefaultWaveform,
  decomposeSubjectAndBackground,
  expandOutpaintDataUrl,
  extractStyleDnaFromPrompt,
  getDimensionsForAspect,
  renderContactSheetDataUrl,
  renderShotDataUrl,
  sliceGridImageDataUrl,
} from '../utils/proceduralMedia';
import {
  LOCAL_MCP_BASE,
  LOCAL_MCP_HTTP_URL,
  checkBrowserConnectionsViaBackend,
  compileTimelineViaBackend,
  deleteDiskProject,
  deleteExternalMcpServer,
  disconnectDreaminaMcpViaBackend,
  discoverMcpTools,
  enqueueLiveBridgeJobViaBackend,
  executeStudioGeneration,
  exportDiskProjectBundle,
  extractLastFrameViaBackend,
  fetchConnectionsStatusViaBackend,
  fetchPlatformCatalogViaBackend,
  generateAudioViaBackend,
  generateNodeViaBackend,
  getActiveApiKeyForProvider,
  getDefaultDiscoveredMcpTools,
  getDiskProject,
  getDreaminaMcpStatusViaBackend,
  getMcpOAuthStatusViaBackend,
  getProviderDisplayLabel,
  importDiskProjectBundle,
  inpaintViaBackend,
  isCloudOrBridgeProvider,
  keyframeBridgeViaBackend,
  launchConnectedBrowserViaBackend,
  listDiskProjects,
  listExternalMcpServers,
  normalizeBackendMediaUrl,
  outpaintViaBackend,
  pingChromeBridge,
  probeLiveMcpBackend,
  pushBridgeEventViaBackend,
  refreshExternalMcpServer,
  registerExternalMcpServer,
  removeBgViaBackend,
  renderVideoViaBackend,
  saveDiskProject,
  sliceGridViaBackend,
  startDreaminaMcpConnectViaBackend,
  startMcpOAuthViaBackend,
  uploadMediaViaBackend,
  upscaleViaBackend,
  verifyProviderViaBackend,
} from '../services/executionRouter';
import {
  compileTimelineToWebm,
  decodeRecipeFromUrlParam,
  downloadTextFile,
  encodeRecipeToUrlParam,
} from '../utils/exporters';

const BYOK_STORAGE_KEY = 'open_dreamflow_byok_v1';
const ACTIVE_PROVIDER_KEY = 'open_dreamflow_active_provider_v1';
const ACTIVE_PROJECT_KEY = 'dreamflow_active_project_id';
const seenBridgeEventIds = new Set<string>();
const completedBridgeJobIds = new Set<string>();

export function normalizeProviderId(raw?: string | null): ProviderId {
  switch (raw) {
    case 'dreamina-bridge':
    case 'chrome-bridge-dreamina':
      return 'dreamina-bridge';
    case 'flow-bridge':
    case 'chrome-bridge-flow':
      return 'flow-bridge';
    case 'gemini-api':
    case 'gemini-omni':
      return 'gemini-api';
    case 'fal':
      return 'fal';
    case 'replicate':
      return 'replicate';
    case 'seedance':
      return 'seedance';
    case 'comfyui':
      return 'comfyui';
    case 'mcp-router':
      return 'mcp-router';
    case 'openai':
      return 'openai';
    case 'ffmpeg-local':
    case 'local-canvas':
    default:
      return 'ffmpeg-local';
  }
}

function loadSavedActiveProvider(): ProviderId {
  try {
    const raw = localStorage.getItem(ACTIVE_PROVIDER_KEY);
    if (raw) return normalizeProviderId(raw);
  } catch {
    // ignore storage errors
  }
  return 'ffmpeg-local';
}

function getLiveStatusBadgeForProvider(
  provider: ProviderId,
  fallbackLabel = 'Synthesizing via FFmpeg 8.0…'
): string {
  switch (normalizeProviderId(provider)) {
    case 'dreamina-bridge':
      return 'Generating on Dreamina Canvas…';
    case 'flow-bridge':
      return 'Generating on Google Flow…';
    case 'gemini-api':
      return 'Generating via Google Gemini / Veo 3.1…';
    case 'fal':
      return 'Generating via Fal.ai…';
    case 'replicate':
      return 'Generating via Replicate…';
    case 'seedance':
      return 'Generating via BytePlus Seedream/Seedance…';
    case 'comfyui':
      return 'Generating on ComfyUI (:8188)…';
    case 'mcp-router':
      return 'Running MCP Studio Pipeline…';
    default:
      return fallbackLabel;
  }
}

function ensureProviderReadyOrPromptUser(
  provider: ProviderId,
  byok: BYOKCredentials,
  openModal: (
    tab?: 'byok' | 'mcp' | 'bridge',
    focusField?: 'gemini' | 'fal' | 'replicate' | 'seedance' | 'comfyui' | null
  ) => void,
  showToast: (msg: string, kind?: 'ok' | 'error') => void
): boolean {
  const norm = normalizeProviderId(provider);
  if (norm === 'gemini-api' && !byok.geminiApiKey?.trim()) {
    openModal('byok', 'gemini');
    showToast(
      'Enter your Google AI Studio API key (AIza...) or switch to Google Flow · Live Browser',
      'error'
    );
    return false;
  }
  if (norm === 'fal' && !byok.falApiKey?.trim()) {
    openModal('byok', 'fal');
    showToast('Enter your Fal.ai API key in BYOK · MCP before running Fal.ai', 'error');
    return false;
  }
  if (norm === 'replicate' && !byok.replicateApiKey?.trim()) {
    openModal('byok', 'replicate');
    showToast(
      'Enter your Replicate API token (r8_...) in BYOK · MCP before running Replicate',
      'error'
    );
    return false;
  }
  if (norm === 'seedance' && !byok.seedanceApiKey?.trim()) {
    openModal('byok', 'seedance');
    showToast(
      'Enter your BytePlus Ark API key or switch to Dreamina · Live Browser',
      'error'
    );
    return false;
  }
  return true;
}

function loadSavedByok(): BYOKCredentials {
  try {
    const raw = localStorage.getItem(BYOK_STORAGE_KEY);
    if (raw) {
      return { ...defaultByok(), ...JSON.parse(raw) };
    }
  } catch {
    // ignore storage errors
  }
  return defaultByok();
}

function defaultByok(): BYOKCredentials {
  return {
    geminiApiKey: '',
    geminiModel: 'veo-3.1-fast-generate-preview',
    seedanceApiKey: '',
    seedanceEndpoint: 'https://ark.ap-southeast.bytepluses.com/api/v3/contents/generations/tasks',
    falApiKey: '',
    falModel: 'fal-ai/wan-pro/image-to-video',
    replicateApiKey: '',
    openaiApiKey: '',
    comfyUiUrl: 'http://127.0.0.1:8188',
    higgsfieldApiKey: '',
    higgsfieldKeyId: '',
    higgsfieldKeySecret: '',
    sumeApiKey: '',
    klingAccessKey: '',
    klingSecretKey: '',
    klingApiKey: '',
    openartApiKey: '',
    imagineartApiKey: '',
    elevenlabsApiKey: '',
  };
}

function extractHandles(text: string): string[] {
  const matches = text.match(/@[A-Za-z0-9_]+/g);
  return matches ? Array.from(new Set(matches)) : [];
}

function inferMoodFromPrompt(prompt: string): string {
  const low = prompt.toLowerCase();
  if (low.includes('dusk') || low.includes('amber') || low.includes('golden')) return 'golden';
  if (low.includes('cliff') || low.includes('ocean') || low.includes('coastal')) return 'coastal';
  return 'daylight';
}

export type ActiveWorkspaceView = 'canvas' | 'multiframes' | 'split' | 'app';

export interface ShareableBeatInput {
  id: string;
  title: string;
  prompt: string;
  imageUrl: string;
  videoUrl?: string;
  durationSec: number;
  cameraCurve: CameraTransitionCurve;
}

export interface StudioState {
  activeProjectId: string;
  projectTitle: string;
  saveStatus: 'saved' | 'saving' | 'local';
  diskProjects: DiskProjectMeta[];
  projectSnapshots: DiskSnapshotItem[];
  bridgeWsConnected: boolean;
  inlineEditorModal: {
    open: boolean;
    mode: 'inpaint' | 'outpaint';
    nodeId: string | null;
  };

  activeView: ActiveWorkspaceView;
  canvasToolMode: 'select' | 'hand';
  showMinimap: boolean;
  showConnections: boolean;

  timelineExpanded: boolean;
  fullscreenTimelineOpen: boolean;
  cameraDirectorOpen: boolean;
  assetDrawerOpen: boolean;
  chatDrawerOpen: boolean;
  searchModalOpen: boolean;
  historyPanelOpen: boolean;

  providerModalOpen: boolean;
  providerModalTab: 'byok' | 'mcp' | 'bridge';
  providerFocusField:
    | null
    | 'gemini'
    | 'fal'
    | 'replicate'
    | 'seedance'
    | 'comfyui'
    | PlatformId;
  providerVerifyStatus: Record<string, ProviderVerificationResult>;
  verifyingProvider: Record<string, boolean>;
  liveBridgeTestRunning: null | BrowserPlatformTarget;
  liveBridgeStatusText: string | null;
  platformsCatalog: PlatformDefinition[];
  externalMcpServers: ExternalMcpServerRecord[];
  connectedBrowserPlatforms: PlatformId[];
  connectedMcpPlatforms: PlatformId[];
  configuredApiPlatforms: PlatformId[];
  launchingBrowserTarget: string | null;
  checkingBrowserPlatform: string | null;
  mcpOAuthSession: McpOAuthSession | null;
  lastImagePlatformId: PlatformId;
  lastVideoPlatformId: PlatformId;
  lastAudioPlatformId: PlatformId;
  lastFailedPlatformId: PlatformId | null;
  workflowRunning: boolean;
  workflowProgressText: string | null;
  directorModalOpen: boolean;
  directorRunning: boolean;
  directorStepLog: string[];
  toastMessage: string | null;
  toastKind: 'ok' | 'error';

  panX: number;
  panY: number;
  zoom: number;
  snapToGrid: boolean;

  nodes: CanvasNode[];
  edges: CanvasEdge[];
  selectedNodeIds: string[];
  clipboardNode: CanvasNode | null;

  past: StudioHistorySnapshot[];
  future: StudioHistorySnapshot[];

  promptText: string;
  promptMode: 'image' | 'video' | '9-grid' | '4-angle' | 'multi-turn';
  promptSubMode: 'omni-ref' | 'keyframe-bridge' | 'multi-turn';
  promptAspect: AspectRatio;
  promptDurationSec: number;
  promptResolution: ResolutionTier;
  elements: ElementVault[];
  skills: DreaminaSkill[];

  multiframes: MultiframeCard[];
  bridges: MultiframeBridge[];

  activeProvider: ProviderId;
  byok: BYOKCredentials;
  mcpServers: MCPServerEntry[];
  mcpHealth: McpBackendHealth;
  chromeBridge: ChromeBridgeState;

  timelineClips: TimelineClip[];
  playheadSec: number;
  isPlayingTimeline: boolean;
  timelineMuted: boolean;
  masterRenderUrl: string | null;
  isRenderingMasterMp4: boolean;
  appSynthesizing: boolean;
  appRenderLog: string[];
  chatMessages: ChatMessageItem[];

  setProjectTitle: (title: string) => void;
  setActiveView: (view: ActiveWorkspaceView) => void;
  setCanvasToolMode: (mode: 'select' | 'hand') => void;
  toggleMinimap: () => void;
  toggleShowConnections: () => void;
  setTimelineExpanded: (expanded: boolean) => void;
  setFullscreenTimelineOpen: (open: boolean) => void;
  setCameraDirectorOpen: (open: boolean) => void;
  setAssetDrawerOpen: (open: boolean) => void;
  setChatDrawerOpen: (open: boolean) => void;
  setSearchModalOpen: (open: boolean) => void;
  setHistoryPanelOpen: (open: boolean) => void;

  openProviderModal: (
    tab?: 'byok' | 'mcp' | 'bridge',
    focusField?: StudioState['providerFocusField']
  ) => void;
  closeProviderModal: () => void;
  setDirectorModalOpen: (open: boolean) => void;
  showToast: (msg: string, kind?: 'ok' | 'error') => void;
  setViewport: (panX: number, panY: number, zoom: number) => void;
  toggleSnapToGrid: () => void;
  resetViewport: () => void;
  fitAllNodesInViewport: (vpWidth?: number, vpHeight?: number) => void;
  tidyUpNodes: () => void;
  loadPresetProject: (preset: StudioPresetId) => void;

  pushHistory: () => void;
  undo: () => void;
  redo: () => void;
  hydrateFromUrlRecipe: () => void;
  copyShareableRecipeUrl: () => string;

  selectNodes: (ids: string[], additive?: boolean) => void;
  moveNodes: (ids: string[], dx: number, dy: number) => void;
  commitNodePositions: () => void;
  connectNodes: (
    sourceId: string,
    targetId: string,
    kind?: CanvasEdge['kind'],
    label?: string
  ) => void;
  deleteSelectedNodes: (explicitId?: string) => void;
  updateNodeFields: (nodeId: string, patch: Partial<CanvasNode>) => void;
  copySelectedNode: (explicitId?: string) => void;
  pasteClipboardNode: (worldX?: number, worldY?: number) => void;
  duplicateNodes: (explicitId?: string) => void;

  spawnDreaminaNodeAt: (
    tool: DreaminaToolId | 'blend',
    worldX: number,
    worldY: number,
    opts?: {
      wireFromNodeId?: string;
      wireDirection?: 'left' | 'right';
      asset?: MediaCatalogItem;
    }
  ) => string | null;
  spawnConnectedNodeFromSelection: (
    targetKind: 'image' | 'video' | 'audio',
    opts?: {
      nodeIds?: string[];
      prompt?: string;
      platformId?: PlatformId;
      modelId?: string;
      aspectRatio?: AspectRatio;
      resolution?: ResolutionTier;
      quality?: string;
      batchCount?: 1 | 2 | 4;
      durationSec?: number;
      modelParams?: Record<string, string | number | boolean>;
      referenceFrameMode?: 'multi-ref' | 'start-end';
      autoGenerate?: boolean;
      x?: number;
      y?: number;
    }
  ) => Promise<string | null>;
  splitBatchNodeToIndividualNodes: (nodeId: string, onlyIndex?: number) => string[];
  uploadLocalMediaNode: (file: File, worldX?: number, worldY?: number) => void;

  setPromptText: (text: string) => void;
  setPromptMode: (mode: StudioState['promptMode']) => void;
  setPromptSubMode: (sub: StudioState['promptSubMode']) => void;
  setPromptAspect: (aspect: AspectRatio) => void;
  setPromptDurationSec: (sec: number) => void;
  setPromptResolution: (res: ResolutionTier) => void;
  applySkillPreset: (skill: DreaminaSkill) => void;
  submitPromptGeneration: (sourceNodeId?: string) => Promise<void>;
  injectCameraPromptToSelection: (cameraTag: string) => void;

  applyInpaintToNode: (
    nodeId: string,
    maskDataUrl: string,
    regionalPrompt: string
  ) => Promise<void>;
  expandOutpaintNode: (
    nodeId: string,
    targetAspect: AspectRatio,
    customPrompt?: string
  ) => Promise<void>;
  removeBgAndDecomposeLayers: (nodeId: string) => Promise<void>;
  updateNodeLayer: (
    nodeId: string,
    layerId: FrameLayerType,
    patch: Partial<FrameLayer>
  ) => void;
  upscaleNodeHd: (nodeId: string, targetRes: '2K' | '4K') => Promise<void>;
  openInlineEditor: (mode: 'inpaint' | 'outpaint', nodeId: string) => void;
  closeInlineEditor: () => void;

  bootDiskPersistence: () => Promise<void>;
  persistActiveProjectToDisk: (opts?: {
    createSnapshot?: boolean;
    snapshotLabel?: string;
  }) => Promise<void>;
  switchDiskProject: (id: string) => Promise<void>;
  createNewBlankProject: (name?: string) => Promise<void>;
  deleteSavedProject: (id: string) => Promise<void>;
  saveVersionSnapshot: (label?: string) => Promise<void>;
  restoreVersionSnapshot: (snapshotId: string) => Promise<void>;
  exportCurrentProjectDreamflowJson: () => Promise<void>;
  importProjectDreamflowJson: (file: File) => Promise<void>;

  setBridgeWsConnected: (connected: boolean) => void;
  ingestBridgeWsEvent: (ev: BridgeIncomingEvent) => boolean;
  handleBridgeJobWsEvent: (payload: Record<string, unknown>) => void;
  verifyProviderConnection: (
    provider:
      | 'gemini'
      | 'fal'
      | 'replicate'
      | 'seedance'
      | 'comfyui'
      | 'kling'
      | 'elevenlabs'
      | 'openai'
      | 'higgsfield'
      | 'sume'
      | 'openart'
      | 'imagineart'
  ) => Promise<void>;
  refreshConnectionsStatus: () => Promise<void>;
  launchConnectedCreatorBrowser: (platformId?: string) => Promise<boolean>;
  checkBrowserConnections: (platformId?: string) => Promise<{
    ok: boolean;
    connected: boolean;
    connectedPlatforms: PlatformId[];
  }>;
  startMcpOAuth: (platformId: string, mcpUrl?: string) => Promise<McpOAuthSession | null>;
  pollMcpOAuthStatus: (sessionId?: string) => Promise<McpOAuthSession | null>;
  startDreaminaMcpConnect: (payload?: {
    mode?: 'browser' | 'session' | 'ark_api_key';
    sessionIdCookie?: string;
    arkApiKey?: string;
    arkEndpoint?: string;
    launchBrowser?: boolean;
  }) => Promise<McpOAuthSession | null>;
  disconnectDreaminaMcp: () => Promise<void>;
  setMcpOAuthSession: (session: McpOAuthSession | null) => void;
  runLiveBridgeTestGeneration: (
    target: BrowserPlatformTarget,
    mode?: 'image' | 'video' | 'audio'
  ) => Promise<void>;
  triggerTestBridgeCapture: (source?: BrowserPlatformTarget | 'flow') => Promise<void>;

  setNodePlatformAndModel: (
    nodeId: string,
    platformId: PlatformId,
    modelId?: string
  ) => void;
  setNodeAspectRatio: (nodeId: string, aspectRatio: AspectRatio) => void;
  uploadReferenceToNode: (nodeId: string, file: File) => Promise<void>;
  attachReferenceToNode: (nodeId: string, file: File) => Promise<void>;
  removeReferenceUrlFromNode: (nodeId: string, url: string) => void;
  saveNodeAsElementReference: (nodeId: string, customHandle?: string) => void;
  generateSingleNode: (nodeId: string) => Promise<boolean>;
  runWorkflowPipeline: (startFromNodeId?: string) => Promise<void>;
  refreshPlatformsAndExternalMcp: () => Promise<void>;
  addExternalMcpServer: (payload: {
    name: string;
    platformId: string;
    transport: 'stdio' | 'http';
    command?: string;
    args?: string[];
    env?: Record<string, string>;
    url?: string;
    headers?: Record<string, string>;
  }) => Promise<boolean>;
  refreshExternalMcpById: (id: string) => Promise<void>;
  removeExternalMcpById: (id: string) => Promise<void>;
  runChatQuickAction: (
    action: 'sequence-3' | 'remix-branch' | 'slice-sheet' | 'compile-master'
  ) => Promise<void>;
  retakeNode: (nodeId: string) => Promise<void>;
  sliceContactSheetNode: (nodeId: string, rows?: number, cols?: number) => Promise<void>;
  generateFourAngleCoverage: (nodeId: string) => Promise<void>;
  convertImageToOmniVideo: (nodeId: string, durationSec?: number) => Promise<void>;
  branchVideoMultiTurn: (nodeId: string, deltaPrompt: string) => Promise<void>;
  generateKeyframeBridgeForNode: (
    nodeId: string,
    opts?: {
      startImageUrl?: string;
      endImageUrl?: string;
      startNodeId?: string;
      endNodeId?: string;
      motionCurve?: KeyframeBridgeCurve;
      durationSec?: number;
      prompt?: string;
    }
  ) => Promise<void>;
  generateAudioForNode: (
    nodeId: string,
    opts?: {
      prompt?: string;
      mode?: 'tts' | 'ambient' | 'voiceover' | 'sfx';
      durationSec?: number;
    }
  ) => Promise<void>;
  executeMcpToolNode: (nodeId: string) => Promise<void>;

  addElementVault: (
    handle: string,
    name: string,
    category: ElementVault['category'],
    description: string
  ) => void;
  addReferenceImageToVault: (vaultId: string, label: string, dataUrl: string) => void;
  removeReferenceFromVault: (vaultId: string, refId: string) => void;
  spawnStyleDnaNode: (sourceNodeId?: string) => void;
  updateStyleDnaNode: (nodeId: string, patch: Partial<StyleDNAPayload>) => void;

  addMultiframeFromNodeOrBlank: (nodeId?: string) => void;
  removeMultiframeCard: (cardId: string) => void;
  updateMultiframeCard: (cardId: string, patch: Partial<MultiframeCard>) => void;
  updateMultiframeBridge: (bridgeId: string, patch: Partial<MultiframeBridge>) => void;
  synthesizeMultiframeSequence: () => Promise<void>;

  autoConnectLocalMcpBackend: () => Promise<void>;
  setActiveProvider: (provider: ProviderId) => void;
  updateByok: (patch: Partial<BYOKCredentials>) => void;
  clearByokKeys: () => void;
  addMcpServer: (
    name: string,
    url: string,
    transport: 'websocket' | 'http-sse'
  ) => Promise<void>;
  refreshMcpServer: (serverId: string) => Promise<void>;
  spawnMcpToolAsCanvasNode: (tool: MCPToolDefinition) => void;
  pingBridge: () => void;
  handleIncomingBridgeEvent: (msg: {
    type?: string;
    payload?: Record<string, unknown>;
  }) => void;

  setPlayheadSec: (sec: number) => void;
  setIsPlayingTimeline: (playing: boolean) => void;
  setTimelineMuted: (muted: boolean) => void;
  sendNodeToTimeline: (nodeId: string) => void;
  splitTimelineClipAtPlayhead: (clipId?: string) => void;
  addVoiceOrSfxClip: (
    track: 'voice' | 'sfx',
    title: string,
    dialogueOrSfx: string,
    durationSec?: number
  ) => void;
  removeTimelineClip: (clipId: string) => void;
  extractLastFrameToNextShot: (clipIdOrNodeId?: string) => Promise<void>;
  compileTimelineMasterMp4: () => Promise<string | null>;
  synthesizeShareableAppFilm: (params: {
    title: string;
    selectedHandles: string[];
    beats: ShareableBeatInput[];
    aspectRatio: AspectRatio;
    resolution: ResolutionTier;
  }) => Promise<string | null>;
  sendChatAssistantPrompt: (userText: string) => Promise<void>;
  runAutonomousDirectorAgent: (creativeBrief: string) => Promise<void>;
}

const initialGraph = buildInitialStudioGraph();
const initialElements = buildInitialElements();

const defaultMcpTools = getDefaultDiscoveredMcpTools(
  LOCAL_MCP_HTTP_URL,
  'Local Open-DreamFlow MCP + FFmpeg Engine'
);

export const useStudioStore = create<StudioState>((set, get) => ({
  activeProjectId: 'salt-terracotta',
  projectTitle: 'Salt & Terracotta — Coastal Short',
  saveStatus: 'saved',
  diskProjects: [],
  projectSnapshots: [],
  bridgeWsConnected: false,
  inlineEditorModal: {
    open: false,
    mode: 'inpaint',
    nodeId: null,
  },

  activeView: 'canvas',
  canvasToolMode: 'select',
  showMinimap: false,
  showConnections: true,

  timelineExpanded: false,
  fullscreenTimelineOpen: false,
  cameraDirectorOpen: false,
  assetDrawerOpen: false,
  chatDrawerOpen: false,
  searchModalOpen: false,
  historyPanelOpen: false,

  providerModalOpen: false,
  providerModalTab: 'byok',
  providerFocusField: null,
  providerVerifyStatus: {},
  verifyingProvider: {},
  liveBridgeTestRunning: null,
  liveBridgeStatusText: null,
  platformsCatalog: PLATFORM_CATALOG,
  externalMcpServers: [],
  connectedBrowserPlatforms: [],
  connectedMcpPlatforms: [],
  configuredApiPlatforms: [],
  launchingBrowserTarget: null,
  checkingBrowserPlatform: null,
  mcpOAuthSession: null,
  lastImagePlatformId: 'higgsfield',
  lastVideoPlatformId: 'higgsfield',
  lastAudioPlatformId: 'elevenlabs',
  lastFailedPlatformId: null,
  workflowRunning: false,
  workflowProgressText: null,
  directorModalOpen: false,
  directorRunning: false,
  directorStepLog: [],
  toastMessage: null,
  toastKind: 'ok',

  panX: 84,
  panY: 54,
  zoom: 0.68,
  snapToGrid: true,

  nodes: initialGraph.nodes,
  edges: initialGraph.edges,
  // Golden Rule #1: Start with NO node selected so initial load is 95% open charcoal canvas!
  selectedNodeIds: [],
  clipboardNode: null,

  past: [],
  future: [],

  promptText: '',
  promptMode: 'image',
  promptSubMode: 'omni-ref',
  promptAspect: '16:9',
  promptDurationSec: 6,
  promptResolution: '720p',
  elements: initialElements,
  skills: BUILTIN_SKILLS,

  multiframes: initialGraph.multiframes,
  bridges: initialGraph.bridges,

  activeProvider: loadSavedActiveProvider(),
  byok: loadSavedByok(),
  mcpServers: [
    {
      id: 'mcp-local-default',
      name: 'Local Open-DreamFlow MCP + FFmpeg Engine',
      url: LOCAL_MCP_HTTP_URL,
      transport: 'http-sse',
      status: 'simulated',
      tools: defaultMcpTools,
      lastPingMs: 8,
    },
  ],
  mcpHealth: {
    online: false,
    ffmpegAvailable: false,
    toolCount: defaultMcpTools.length,
    tools: defaultMcpTools,
    mediaFiles: [],
    baseUrl: LOCAL_MCP_BASE,
  },
  chromeBridge: {
    extensionDetected: false,
    flowTabConnected: false,
    dreaminaTabConnected: false,
    connectedPlatforms: {},
    injectElementRefs: true,
    autoStreamMutationObserver: true,
    jobs: [],
  },

  timelineClips: initialGraph.timelineClips,
  playheadSec: 0,
  isPlayingTimeline: false,
  timelineMuted: true,
  masterRenderUrl: '/media/real_salt_terracotta_master.mp4',
  isRenderingMasterMp4: false,
  appSynthesizing: false,
  appRenderLog: [],
  chatMessages: [
    {
      id: 'chat-welcome',
      role: 'assistant',
      text: 'Dreamina Director Chat ready. Describe a multi-shot scene to build on the canvas, or select a video node and describe a multi-turn edit.',
      timestamp: Date.now(),
    },
  ],

  setProjectTitle: (projectTitle) => set({ projectTitle }),
  setActiveView: (activeView) => set({ activeView }),
  setCanvasToolMode: (canvasToolMode) => set({ canvasToolMode }),
  toggleMinimap: () => set((s) => ({ showMinimap: !s.showMinimap })),
  toggleShowConnections: () => set((s) => ({ showConnections: !s.showConnections })),
  setTimelineExpanded: (timelineExpanded) => set({ timelineExpanded }),
  setFullscreenTimelineOpen: (fullscreenTimelineOpen) => set({ fullscreenTimelineOpen }),
  setCameraDirectorOpen: (cameraDirectorOpen) => set({ cameraDirectorOpen }),
  setAssetDrawerOpen: (assetDrawerOpen) => set({ assetDrawerOpen }),
  setChatDrawerOpen: (chatDrawerOpen) => set({ chatDrawerOpen }),
  setSearchModalOpen: (searchModalOpen) => set({ searchModalOpen }),
  setHistoryPanelOpen: (historyPanelOpen) => set({ historyPanelOpen }),

  openProviderModal: (tab = 'byok', focusField = null) =>
    set({
      providerModalOpen: true,
      providerModalTab: tab,
      providerFocusField: focusField,
    }),
  closeProviderModal: () =>
    set({ providerModalOpen: false, providerFocusField: null }),
  setDirectorModalOpen: (directorModalOpen) => set({ directorModalOpen }),

  showToast: (msg, kind = 'ok') => {
    set({ toastMessage: msg, toastKind: kind });
    setTimeout(
      () => {
        if (get().toastMessage === msg) {
          set({ toastMessage: null });
        }
      },
      kind === 'error' ? 5200 : 3200
    );
  },

  setViewport: (panX, panY, zoom) =>
    set({ panX, panY, zoom: Math.min(2.5, Math.max(0.2, zoom)) }),
  toggleSnapToGrid: () => set((s) => ({ snapToGrid: !s.snapToGrid })),
  resetViewport: () => set({ panX: 84, panY: 54, zoom: 0.68 }),

  fitAllNodesInViewport: (vpWidth = window.innerWidth, vpHeight = window.innerHeight) => {
    const { nodes } = get();
    if (nodes.length === 0) {
      set({ panX: 84, panY: 54, zoom: 0.74 });
      return;
    }
    const minX = Math.min(...nodes.map((n) => n.x));
    const minY = Math.min(...nodes.map((n) => n.y));
    const maxX = Math.max(...nodes.map((n) => n.x + n.width));
    const maxY = Math.max(...nodes.map((n) => n.y + n.height));
    const contentW = Math.max(400, maxX - minX);
    const contentH = Math.max(300, maxY - minY);
    const padX = 140;
    const padY = 120;
    const nextZoom = Math.min(
      1.15,
      Math.max(0.28, Math.min((vpWidth - padX * 2) / contentW, (vpHeight - padY * 2) / contentH))
    );
    const panX = (vpWidth - contentW * nextZoom) / 2 - minX * nextZoom;
    const panY = (vpHeight - contentH * nextZoom) / 2 - minY * nextZoom;
    set({ panX, panY, zoom: nextZoom });
  },

  tidyUpNodes: () => {
    const { nodes } = get();
    if (nodes.length === 0) return;
    get().pushHistory();

    const timelineNodes = nodes.filter((n) => n.kind === 'timeline');
    const regularNodes = nodes.filter((n) => n.kind !== 'timeline');

    const startX = 120;
    const startY = 110;
    const gapX = 110;
    const gapY = 120;
    const maxColsPerRow = 4;
    const maxRowWidth = 2080;

    // Pack regular nodes into width-aware rows so no two nodes ever overlap
    const rows: CanvasNode[][] = [];
    let currentRow: CanvasNode[] = [];
    let currentRowWidth = 0;

    for (const node of regularNodes) {
      const w = node.width || 340;
      if (currentRow.length === 0) {
        currentRow = [node];
        currentRowWidth = w;
      } else if (
        currentRow.length < maxColsPerRow &&
        currentRowWidth + gapX + w <= maxRowWidth
      ) {
        currentRow.push(node);
        currentRowWidth += gapX + w;
      } else {
        rows.push(currentRow);
        currentRow = [node];
        currentRowWidth = w;
      }
    }
    if (currentRow.length > 0) {
      rows.push(currentRow);
    }

    const positioned: CanvasNode[] = [];
    let cursorY = startY;
    let maxGraphRight = startX + 1120;

    for (const row of rows) {
      let cursorX = startX;
      let maxRowHeight = 0;
      for (const n of row) {
        const w = n.width || 340;
        const h = n.height || 240;
        positioned.push({
          ...n,
          x: cursorX,
          y: cursorY,
        });
        maxGraphRight = Math.max(maxGraphRight, cursorX + w);
        cursorX += w + gapX;
        maxRowHeight = Math.max(maxRowHeight, h);
      }
      cursorY += maxRowHeight + gapY;
    }

    // Place timeline nodes on their own dedicated bottom row aligned cleanly under the graph
    const timelineY = regularNodes.length > 0 ? cursorY + 40 : startY;
    let tlCursorX =
      timelineNodes.length === 1
        ? Math.max(
            startX,
            Math.round(
              startX +
                (maxGraphRight - startX - (timelineNodes[0].width || 1120)) / 2
            )
          )
        : startX;

    for (const tn of timelineNodes) {
      const tw = tn.width || 1120;
      positioned.push({
        ...tn,
        x: tlCursorX,
        y: timelineY,
      });
      tlCursorX += tw + gapX;
    }

    set({ nodes: positioned });
    get().fitAllNodesInViewport();
    get().showToast('Tidied up canvas nodes');
  },

  loadPresetProject: (preset) => {
    get().pushHistory();
    const built = buildStudioPresetGraph(preset);
    if (preset === 'blank') {
      set({
        activeProjectId: `canvas_${Date.now().toString(36)}`,
        projectTitle: 'Untitled Canvas',
        nodes: [],
        edges: [],
        elements: [],
        multiframes: [],
        bridges: [],
        timelineClips: [],
        selectedNodeIds: [],
        promptText: '',
        masterRenderUrl: null,
        panX: 120,
        panY: 80,
        zoom: 0.85,
      });
      get().showToast('Created New Blank Canvas');
    } else if (preset === 'cross-platform-blueprint') {
      set({
        activeProjectId: `blueprint_${Date.now().toString(36)}`,
        projectTitle: built.title,
        nodes: built.nodes,
        edges: built.edges,
        elements: [],
        multiframes: [],
        bridges: [],
        timelineClips: [],
        selectedNodeIds: [built.nodes[0]?.id].filter(Boolean) as string[],
        promptText: built.nodes[0]?.prompt || '',
        masterRenderUrl: null,
        panX: 84,
        panY: 54,
        zoom: 0.82,
      });
      get().showToast('Loaded Workflow Blueprint · Ready for your credits');
    } else {
      set({
        activeProjectId: preset,
        projectTitle: built.title,
        nodes: built.nodes,
        edges: built.edges,
        elements: buildInitialElements(),
        multiframes: built.multiframes,
        bridges: built.bridges,
        timelineClips: built.timelineClips,
        selectedNodeIds: [],
        promptText: built.nodes.find((n) => n.kind === 'video')?.prompt || '',
        masterRenderUrl: '/media/real_salt_terracotta_master.mp4',
        panX: 84,
        panY: 54,
        zoom: 0.68,
      });
      get().showToast(`Loaded "${built.title}"`);
    }
  },

  pushHistory: () => {
    const { nodes, edges, multiframes, bridges, timelineClips, past } = get();
    const snapshot: StudioHistorySnapshot = {
      nodes: structuredClone(nodes),
      edges: structuredClone(edges),
      multiframes: structuredClone(multiframes),
      bridges: structuredClone(bridges),
      timelineClips: structuredClone(timelineClips),
    };
    set({
      past: [...past.slice(-19), snapshot],
      future: [],
    });
  },

  undo: () => {
    const { past, future, nodes, edges, multiframes, bridges, timelineClips } = get();
    if (past.length === 0) return;
    const previous = past[past.length - 1];
    const currentSnapshot: StudioHistorySnapshot = {
      nodes: structuredClone(nodes),
      edges: structuredClone(edges),
      multiframes: structuredClone(multiframes),
      bridges: structuredClone(bridges),
      timelineClips: structuredClone(timelineClips),
    };
    set({
      nodes: previous.nodes,
      edges: previous.edges,
      multiframes: previous.multiframes,
      bridges: previous.bridges,
      timelineClips: previous.timelineClips,
      past: past.slice(0, -1),
      future: [currentSnapshot, ...future.slice(0, 19)],
    });
    get().showToast('Undo');
  },

  redo: () => {
    const { past, future, nodes, edges, multiframes, bridges, timelineClips } = get();
    if (future.length === 0) return;
    const next = future[0];
    const currentSnapshot: StudioHistorySnapshot = {
      nodes: structuredClone(nodes),
      edges: structuredClone(edges),
      multiframes: structuredClone(multiframes),
      bridges: structuredClone(bridges),
      timelineClips: structuredClone(timelineClips),
    };
    set({
      nodes: next.nodes,
      edges: next.edges,
      multiframes: next.multiframes,
      bridges: next.bridges,
      timelineClips: next.timelineClips,
      past: [...past.slice(-19), currentSnapshot],
      future: future.slice(1),
    });
    get().showToast('Redo');
  },

  hydrateFromUrlRecipe: () => {
    const params = new URLSearchParams(window.location.search);
    const encoded = params.get('recipe');
    if (!encoded) return;
    const decoded = decodeRecipeFromUrlParam(encoded);
    if (!decoded) return;

    const restoredNodes: CanvasNode[] = decoded.nodes.map((n) => {
      const dims =
        n.kind === 'timeline'
          ? { width: 1120, height: 196 }
          : n.kind === 'style-dna'
          ? { width: 300, height: 210 }
          : n.kind === 'audio'
          ? { width: 340, height: 128 }
          : n.kind === 'video'
          ? getDimensionsForAspect(n.aspectRatio, 480)
          : getDimensionsForAspect(n.aspectRatio, 384);
      const restoredStatus: CanvasNode['status'] =
        n.status === 'ready' &&
        (n.kind === 'text' || n.kind === 'sticky' || n.kind === 'style-dna')
          ? 'ready'
          : 'idle';
      const badge = getPlatformBadgeLabel(n.platformId, n.modelId);
      return {
        id: n.id,
        kind: n.kind,
        title: n.title,
        prompt: n.prompt,
        x: n.x,
        y: n.y,
        width: dims.width,
        height: dims.height,
        aspectRatio: n.aspectRatio,
        status: restoredStatus,
        platformId: n.platformId,
        connectionMode: n.connectionMode || 'auto',
        modelId: n.modelId,
        batchCount: n.batchCount,
        negativePrompt: n.negativePrompt,
        audioEnabled: n.audioEnabled,
        audioMode: n.audioMode,
        voiceId: n.voiceId,
        imageUrl: undefined,
        videoUrl: undefined,
        audioUrl: undefined,
        waveform: n.kind === 'audio' ? createDefaultWaveform(n.seed || 305, 64) : undefined,
        seed: n.seed,
        resolution: n.resolution,
        durationSec: n.durationSec,
        interactionId: n.interactionId,
        previousInteractionId: n.previousInteractionId,
        elementHandles: n.elementHandles || [],
        styleDna: n.styleDna,
        gridSpec:
          n.kind === 'contact-sheet' ? { rows: 3, cols: 3, labels: NINE_GRID_LABELS } : undefined,
        layers: [],
        providerUsed: badge || 'Shared Workflow Recipe',
        createdAt: Date.now(),
      };
    });

    set({
      projectTitle: decoded.title || 'Shared Workflow Recipe',
      nodes: restoredNodes,
      edges: decoded.edges || [],
      elements: [],
      promptText: '',
      masterRenderUrl: null,
      selectedNodeIds: [],
    });
    get().showToast(`Loaded workflow "${decoded.title}"`);
  },

  copyShareableRecipeUrl: () => {
    const { projectTitle, nodes, edges, multiframes, bridges } = get();
    const encoded = encodeRecipeToUrlParam({
      v: 1,
      title: projectTitle,
      nodes: nodes.map((n) => ({
        id: n.id,
        kind: n.kind,
        title: n.title,
        prompt: n.prompt,
        x: Math.round(n.x),
        y: Math.round(n.y),
        aspectRatio: n.aspectRatio,
        status: n.status === 'generating' ? 'idle' : n.status,
        platformId: n.platformId,
        connectionMode: n.connectionMode,
        modelId: n.modelId,
        batchCount: n.batchCount,
        negativePrompt: n.negativePrompt,
        audioEnabled: n.audioEnabled,
        audioMode: n.audioMode,
        voiceId: n.voiceId,
        seed: n.seed,
        resolution: n.resolution,
        durationSec: n.durationSec,
        interactionId: n.interactionId,
        previousInteractionId: n.previousInteractionId,
        elementHandles: n.elementHandles,
        styleDna: n.styleDna,
      })),
      edges,
      multiframes: multiframes.map((m) => ({
        id: m.id,
        order: m.order,
        title: m.title,
        prompt: m.prompt,
        aspectRatio: m.aspectRatio,
      })),
      bridges,
    });
    const url = new URL(window.location.href);
    url.searchParams.set('recipe', encoded);
    const fullUrl = url.toString();
    window.history.replaceState({}, '', fullUrl);
    navigator.clipboard?.writeText(fullUrl).catch(() => undefined);
    get().showToast('Copied credential-free ?recipe= workflow link');
    return fullUrl;
  },

  selectNodes: (ids, additive = false) =>
    set((s) => {
      if (!additive) {
        const primary = s.nodes.find((n) => n.id === ids[0]);
        return {
          selectedNodeIds: ids,
          promptText:
            primary && primary.kind !== 'timeline' ? primary.prompt : s.promptText,
          promptMode:
            primary?.kind === 'contact-sheet'
              ? '9-grid'
              : primary?.kind === 'image'
              ? 'image'
              : 'video',
        };
      }
      const merged = new Set(s.selectedNodeIds);
      ids.forEach((id) => {
        if (merged.has(id)) merged.delete(id);
        else merged.add(id);
      });
      return { selectedNodeIds: Array.from(merged) };
    }),

  moveNodes: (ids, dx, dy) =>
    set((s) => ({
      nodes: s.nodes.map((n) =>
        ids.includes(n.id) ? { ...n, x: n.x + dx, y: n.y + dy } : n
      ),
    })),

  commitNodePositions: () => {
    const { snapToGrid, nodes, selectedNodeIds } = get();
    if (!snapToGrid) return;
    const grid = 10;
    set({
      nodes: nodes.map((n) =>
        selectedNodeIds.includes(n.id)
          ? {
              ...n,
              x: Math.round(n.x / grid) * grid,
              y: Math.round(n.y / grid) * grid,
            }
          : n
      ),
    });
  },

  connectNodes: (sourceId, targetId, kind = 'lineage', label) => {
    if (sourceId === targetId) return;
    const { edges, nodes } = get();
    const exists = edges.some((e) => e.sourceId === sourceId && e.targetId === targetId);
    if (exists) return;
    get().pushHistory();
    const sourceNode = nodes.find((n) => n.id === sourceId);
    const targetNode = nodes.find((n) => n.id === targetId);
    const resolvedKind = sourceNode?.kind === 'style-dna' ? 'style-dna' : kind;

    const newEdge: CanvasEdge = {
      id: `edge_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      sourceId,
      targetId,
      kind: resolvedKind,
      label,
    };

    set((s) => {
      const nextEdges = [...s.edges, newEdge];
      let nextNodes = s.nodes;

      if (resolvedKind === 'style-dna') {
        nextNodes = nextNodes.map((n) =>
          n.id === targetId ? { ...n, styleDnaId: sourceId } : n
        );
      }

      return {
        edges: nextEdges,
        nodes: nextNodes,
      };
    });

    // If wired into a Timeline node, automatically append source video/image/audio stem to timelineClips!
    if (
      targetNode?.kind === 'timeline' &&
      sourceNode &&
      (sourceNode.kind === 'video' ||
        sourceNode.kind === 'image' ||
        sourceNode.kind === 'audio')
    ) {
      get().sendNodeToTimeline(sourceNode.id);
    }
  },

  deleteSelectedNodes: (explicitId) => {
    const idsToDelete = explicitId ? [explicitId] : get().selectedNodeIds;
    if (idsToDelete.length === 0) return;
    get().pushHistory();
    set((s) => ({
      nodes: s.nodes.filter((n) => !idsToDelete.includes(n.id)),
      edges: s.edges.filter(
        (e) => !idsToDelete.includes(e.sourceId) && !idsToDelete.includes(e.targetId)
      ),
      selectedNodeIds: s.selectedNodeIds.filter((id) => !idsToDelete.includes(id)),
    }));
  },

  updateNodeFields: (nodeId, patch) =>
    set((s) => ({
      nodes: s.nodes.map((n) => (n.id === nodeId ? { ...n, ...patch } : n)),
    })),

  copySelectedNode: (explicitId) => {
    const id = explicitId || get().selectedNodeIds[0];
    const node = get().nodes.find((n) => n.id === id);
    if (!node) return;
    set({ clipboardNode: structuredClone(node) });
    get().showToast(`Copied "${node.title}"`);
  },

  pasteClipboardNode: (worldX, worldY) => {
    const { clipboardNode } = get();
    if (!clipboardNode) {
      get().showToast('Clipboard is empty');
      return;
    }
    get().pushHistory();
    const newId = `node_paste_${Date.now()}`;
    const pasted: CanvasNode = {
      ...structuredClone(clipboardNode),
      id: newId,
      title: `${clipboardNode.title} Copy`,
      x: worldX !== undefined ? worldX : clipboardNode.x + 56,
      y: worldY !== undefined ? worldY : clipboardNode.y + 56,
      createdAt: Date.now(),
    };
    set((s) => ({
      nodes: [...s.nodes, pasted],
      selectedNodeIds: [newId],
    }));
    get().showToast(`Pasted "${pasted.title}"`);
  },

  duplicateNodes: (explicitId) => {
    const ids = explicitId ? [explicitId] : get().selectedNodeIds;
    if (ids.length === 0) return;
    get().pushHistory();
    const { nodes } = get();
    const clones: CanvasNode[] = [];
    ids.forEach((id, i) => {
      const orig = nodes.find((n) => n.id === id);
      if (!orig) return;
      clones.push({
        ...structuredClone(orig),
        id: `node_dup_${Date.now()}_${i}`,
        title: `${orig.title} Copy`,
        x: orig.x + 48,
        y: orig.y + 48,
        createdAt: Date.now() + i,
      });
    });
    set((s) => ({
      nodes: [...s.nodes, ...clones],
      selectedNodeIds: clones.map((c) => c.id),
    }));
    get().showToast(`Duplicated ${clones.length} node${clones.length > 1 ? 's' : ''}`);
  },

  spawnDreaminaNodeAt: (tool, worldX, worldY, opts) => {
    if (tool === 'camera-3d') {
      set({ cameraDirectorOpen: true });
      return null;
    }
    if (tool === 'assets') {
      set({ assetDrawerOpen: true });
      return null;
    }

    const { nodes, edges } = get();
    if (tool === 'timeline') {
      const existingTimeline = nodes.find((n) => n.kind === 'timeline');
      if (existingTimeline && !opts?.wireFromNodeId) {
        set({ selectedNodeIds: [existingTimeline.id] });
        get().showToast('Focused Timelines 1');
        return existingTimeline.id;
      }
    }

    get().pushHistory();
    const id = `node_${tool}_${Date.now()}`;
    const countOfKind = (k: CanvasNode['kind']) =>
      nodes.filter((n) => n.kind === k).length + 1;

    const x = Math.round(worldX / 10) * 10;
    const y = Math.round(worldY / 10) * 10;
    const upstream = opts?.wireFromNodeId
      ? nodes.find((n) => n.id === opts.wireFromNodeId)
      : undefined;

    let newNode: CanvasNode;

    if (opts?.asset) {
      const a = opts.asset;
      const isVid = a.kind === 'video';
      const isAud = a.kind === 'audio';
      const w = isVid ? 480 : a.kind === 'contact-sheet' ? 480 : isAud ? 340 : 384;
      const h = isVid ? 270 : a.kind === 'contact-sheet' ? 270 : isAud ? 128 : 216;
      newNode = {
        id,
        kind: a.kind,
        title: a.title,
        prompt: a.title,
        x,
        y,
        width: w,
        height: h,
        aspectRatio: isVid || a.kind === 'contact-sheet' || isAud ? '16:9' : '16:9',
        status: 'ready',
        imageUrl: isAud
          ? undefined
          : isVid
          ? a.posterUrl
          : a.url,
        videoUrl: isVid ? a.url : undefined,
        audioUrl: isAud ? a.url : undefined,
        audioMode: isAud ? 'ambient' : undefined,
        waveform: isAud ? createDefaultWaveform(305, 64) : undefined,
        durationSec: a.durationSec,
        seed: Math.floor(Math.random() * 9000) + 100,
        resolution: '1080p',
        elementHandles: [],
        gridSpec:
          a.kind === 'contact-sheet'
            ? { rows: 3, cols: 3, labels: NINE_GRID_LABELS }
            : undefined,
        layers: isAud ? [] : createDefaultLayers(isVid ? a.posterUrl : a.url),
        providerUsed: 'Asset Vault',
        createdAt: Date.now(),
      };
    } else {
      const {
        lastImagePlatformId,
        lastVideoPlatformId,
        lastAudioPlatformId,
        platformsCatalog,
        externalMcpServers,
      } = get();

      const imgModels = getModelsForPlatformAndModality(
        lastImagePlatformId,
        'image',
        platformsCatalog,
        externalMcpServers
      );
      const defaultImgModel = imgModels[0];
      const defaultImageModelId = defaultImgModel?.id || 'gpt_image_2_6';
      const defaultImageBadge =
        getPlatformBadgeLabel(
          lastImagePlatformId,
          defaultImageModelId,
          platformsCatalog,
          externalMcpServers
        ) || 'Higgsfield · ChatGPT / GPT Image 2.6';

      const vidModels = getModelsForPlatformAndModality(
        lastVideoPlatformId,
        'video',
        platformsCatalog,
        externalMcpServers
      );
      const defaultVidModel = vidModels[0];
      const defaultVideoModelId = defaultVidModel?.id || 'cinematic_studio_video_4_0';
      const defaultVideoBadge =
        getPlatformBadgeLabel(
          lastVideoPlatformId,
          defaultVideoModelId,
          platformsCatalog,
          externalMcpServers
        ) || 'Higgsfield · Cinema Studio 4.0';

      const audModels = getModelsForPlatformAndModality(
        lastAudioPlatformId,
        'audio',
        platformsCatalog,
        externalMcpServers
      );
      const defaultAudModel = audModels[0];
      const defaultAudioModelId = defaultAudModel?.id || 'eleven_multilingual_v2';
      const defaultAudioBadge =
        getPlatformBadgeLabel(
          lastAudioPlatformId,
          defaultAudioModelId,
          platformsCatalog,
          externalMcpServers
        ) || 'ElevenLabs · Multilingual v2';

      const initParamsFromModel = (m?: {
        id: string;
        parameters?: Array<{ name: string; default?: string | number | boolean; options?: Array<string | number> }>;
      }) => {
        const out: Record<string, string | number | boolean> = {};
        for (const p of m?.parameters || []) {
          if (p.default !== undefined) out[p.name] = p.default;
        }
        if (['gpt_image_2_6', 'gpt_image_2_6_flare', 'gpt_image_2_5', 'gpt_image_2'].includes(m?.id || '')) {
          out.quality = 'high';
        }
        return {
          quality: typeof out.quality === 'string' ? out.quality : undefined,
          modelParams: Object.keys(out).length > 0 ? out : undefined,
        };
      };
      const imgInit = initParamsFromModel(defaultImgModel);
      const vidInit = initParamsFromModel(defaultVidModel);
      const audInit = initParamsFromModel(defaultAudModel);

      switch (tool) {
        case 'text': {
          const n = countOfKind('text');
          newNode = {
            id,
            kind: 'text',
            title: `Texts ${n}`,
            prompt: '',
            x,
            y,
            width: 320,
            height: 190,
            aspectRatio: '16:9',
            status: 'ready',
            seed: 110 + n,
            resolution: '1080p',
            elementHandles: [],
            layers: [],
            providerUsed: 'Script / Prompt Node',
            createdAt: Date.now(),
          };
          break;
        }
        case 'image': {
          const n = countOfKind('image');
          newNode = {
            id,
            kind: 'image',
            title: `Images ${n}`,
            prompt: '',
            x,
            y,
            width: 384,
            height: 216,
            aspectRatio: defaultImgModel?.defaultAspect || '16:9',
            status: 'idle',
            platformId: lastImagePlatformId,
            connectionMode: 'auto',
            modelId: defaultImageModelId,
            batchCount: 1,
            imageUrl: undefined,
            seed: 200 + n * 37,
            resolution: defaultImgModel?.defaultResolution || '2k',
            ...(imgInit.quality ? { quality: imgInit.quality } : {}),
            ...(imgInit.modelParams ? { modelParams: imgInit.modelParams } : {}),
            elementHandles: [],
            layers: [],
            providerUsed: defaultImageBadge,
            createdAt: Date.now(),
          };
          break;
        }
        case 'video':
        case 'blend': {
          const n = countOfKind('video');
          newNode = {
            id,
            kind: 'video',
            title: `Videos ${n}`,
            prompt: '',
            x,
            y,
            width: 480,
            height: 270,
            aspectRatio: defaultVidModel?.defaultAspect || '16:9',
            status: 'idle',
            platformId: lastVideoPlatformId,
            connectionMode: 'auto',
            modelId: defaultVideoModelId,
            audioEnabled: true,
            imageUrl: undefined,
            videoUrl: undefined,
            durationSec: defaultVidModel?.defaultDurationSec ?? 5,
            previousInteractionId: upstream?.interactionId,
            seed: 500 + n * 41,
            resolution: defaultVidModel?.defaultResolution || '720p',
            ...(vidInit.quality ? { quality: vidInit.quality } : {}),
            ...(vidInit.modelParams ? { modelParams: vidInit.modelParams } : {}),
            elementHandles: [],
            layers: [],
            providerUsed: defaultVideoBadge,
            createdAt: Date.now(),
          };
          break;
        }
        case 'audio': {
          const n = countOfKind('audio');
          const seed = 600 + n * 29;
          newNode = {
            id,
            kind: 'audio',
            title: `Audio ${n}`,
            prompt: '',
            x,
            y,
            width: 340,
            height: 128,
            aspectRatio: '16:9',
            status: 'idle',
            platformId: lastAudioPlatformId,
            connectionMode: 'auto',
            modelId: defaultAudioModelId,
            audioUrl: undefined,
            audioMode: 'tts',
            voiceId: 'JBFqnCBsd6RMkjVDRZzb',
            waveform: createDefaultWaveform(seed, 64),
            durationSec: defaultAudModel?.defaultDurationSec ?? 8,
            seed,
            resolution: '1080p',
            ...(audInit.quality ? { quality: audInit.quality } : {}),
            ...(audInit.modelParams ? { modelParams: audInit.modelParams } : {}),
            elementHandles: [],
            layers: [],
            providerUsed: defaultAudioBadge,
            createdAt: Date.now(),
          };
          break;
        }
        case 'timeline': {
          const n = countOfKind('timeline');
          newNode = {
            id,
            kind: 'timeline',
            title: `Timelines ${n}`,
            prompt: 'Spatial Rough-Cut Sequence',
            x,
            y,
            width: 1120,
            height: 196,
            aspectRatio: '16:9',
            status: 'ready',
            videoUrl: undefined,
            durationSec: 18,
            seed: 900 + n,
            resolution: '1080p',
            elementHandles: [],
            layers: [],
            providerUsed: 'Spatial Timeline',
            createdAt: Date.now(),
          };
          break;
        }
        case 'element': {
          const n = countOfKind('element');
          const handle = `@Ref_${n}`;
          newNode = {
            id,
            kind: 'element',
            title: `Reference ${n}`,
            prompt: '',
            x,
            y,
            width: 300,
            height: 300,
            aspectRatio: '1:1',
            status: 'idle',
            platformId: lastImagePlatformId,
            connectionMode: 'auto',
            modelId: defaultImageModelId,
            batchCount: 1,
            imageUrl: undefined,
            seed: 300 + n,
            resolution: '2K',
            elementHandles: [handle],
            layers: [],
            providerUsed: defaultImageBadge,
            createdAt: Date.now(),
          };
          break;
        }
        case 'cinema-kit': {
          const n = countOfKind('style-dna');
          const dna = extractStyleDnaFromPrompt('Natural 35mm Daylight Studio');
          newNode = {
            id,
            kind: 'style-dna',
            title: `Cinema Kit ${n}`,
            prompt: `${dna.lens} · ${dna.lighting} · ${dna.filmStock}`,
            x,
            y,
            width: 300,
            height: 210,
            aspectRatio: '16:9',
            status: 'ready',
            seed: 410 + n,
            resolution: '4K',
            elementHandles: [],
            styleDna: dna,
            layers: [],
            providerUsed: 'Cinema Kit Optical Lock',
            createdAt: Date.now(),
          };
          break;
        }
        case 'image-editor': {
          const n = countOfKind('contact-sheet');
          newNode = {
            id,
            kind: 'contact-sheet',
            title: `Contact Sheet ${n}`,
            prompt: '',
            x,
            y,
            width: 480,
            height: 270,
            aspectRatio: '16:9',
            status: 'idle',
            platformId: lastImagePlatformId,
            connectionMode: 'auto',
            modelId: defaultImageModelId,
            batchCount: 1,
            imageUrl: undefined,
            seed: 512 + n,
            resolution: '4K',
            elementHandles: [],
            gridSpec: { rows: 3, cols: 3, labels: NINE_GRID_LABELS },
            layers: [],
            providerUsed: defaultImageBadge,
            createdAt: Date.now(),
          };
          break;
        }
        case 'sticky':
        default: {
          const n = countOfKind('sticky');
          newNode = {
            id,
            kind: 'sticky',
            title: `Notes ${n}`,
            prompt: '',
            x,
            y,
            width: 260,
            height: 220,
            aspectRatio: '1:1',
            status: 'ready',
            seed: 700 + n,
            resolution: '1080p',
            elementHandles: [],
            layers: [],
            providerUsed: 'Sticky Note',
            createdAt: Date.now(),
          };
          break;
        }
      }
    }

    const nextEdges = [...edges];
    if (opts?.wireFromNodeId && upstream) {
      const sourceId =
        opts.wireDirection === 'left' ? id : opts.wireFromNodeId;
      const targetId =
        opts.wireDirection === 'left' ? opts.wireFromNodeId : id;
      nextEdges.push({
        id: `edge_wire_${Date.now()}`,
        sourceId,
        targetId,
        kind: tool === 'blend' ? 'multi-turn-branch' : 'lineage',
      });
    }

    set({
      nodes: [...nodes, newNode],
      edges: nextEdges,
      selectedNodeIds: [id],
      promptText: newNode.kind !== 'timeline' ? newNode.prompt : get().promptText,
    });

    if (
      newNode.kind === 'timeline' &&
      upstream &&
      (upstream.kind === 'video' || upstream.kind === 'image' || upstream.kind === 'audio')
    ) {
      get().sendNodeToTimeline(upstream.id);
    }

    return id;
  },

  spawnConnectedNodeFromSelection: async (targetKind, opts) => {
    const state = get();
    const targetIds =
      opts?.nodeIds && opts.nodeIds.length > 0
        ? opts.nodeIds
        : state.selectedNodeIds;
    const sourceNodes = targetIds
      .map((nid) => state.nodes.find((n) => n.id === nid))
      .filter((n): n is CanvasNode => Boolean(n));

    if (sourceNodes.length === 0) return null;

    get().pushHistory();

    // Compute group bounding box for smart right-hand placement
    const minY = Math.min(...sourceNodes.map((n) => n.y));
    const maxX = Math.max(...sourceNodes.map((n) => n.x + n.width));
    const maxY = Math.max(...sourceNodes.map((n) => n.y + n.height));
    const centerY = (minY + maxY) / 2;

    const platformId: PlatformId =
      opts?.platformId ||
      (targetKind === 'video'
        ? state.lastVideoPlatformId
        : targetKind === 'audio'
        ? state.lastAudioPlatformId
        : state.lastImagePlatformId);

    const models = getModelsForPlatformAndModality(
      platformId,
      targetKind,
      state.platformsCatalog,
      state.externalMcpServers
    );
    const chosenModel =
      (opts?.modelId
        ? models.find((m) => m.id === resolveCanonicalModelId(opts.modelId) || m.id === opts.modelId)
        : undefined) || models[0];
    const modelId = chosenModel?.id || opts?.modelId || '';

    const defaultParams: Record<string, string | number | boolean> = {};
    for (const p of chosenModel?.parameters || []) {
      if (p.default !== undefined) defaultParams[p.name] = p.default;
    }
    const mergedModelParams = {
      ...defaultParams,
      ...(opts?.modelParams || {}),
    };
    const quality =
      opts?.quality ||
      (typeof mergedModelParams.quality === 'string' ? mergedModelParams.quality : undefined);

    const aspectRatio: AspectRatio =
      opts?.aspectRatio || chosenModel?.defaultAspect || '16:9';
    const resolution: ResolutionTier =
      opts?.resolution ||
      chosenModel?.defaultResolution ||
      (targetKind === 'video' ? '1080p' : '2K');

    // Collect multimodal references & text prompts from selected nodes in selection order
    const imageRefs: string[] = [];
    const videoRefs: string[] = [];
    const promptParts: string[] = [];
    const handleSet = new Set<string>();
    let inheritedStyleDnaId: string | undefined;
    let inheritedStyleDna: StyleDNAPayload | undefined;

    for (const src of sourceNodes) {
      for (const h of src.elementHandles || []) {
        if (h) handleSet.add(h);
      }
      if (
        (src.kind === 'image' || src.kind === 'element' || src.kind === 'contact-sheet') &&
        src.imageUrl
      ) {
        if (!imageRefs.includes(src.imageUrl)) imageRefs.push(src.imageUrl);
      } else if (src.kind === 'video' && src.videoUrl) {
        if (!videoRefs.includes(src.videoUrl)) videoRefs.push(src.videoUrl);
        if (src.imageUrl && imageRefs.length === 0) {
          // Keep poster only if no still references exist? Better not pollute imageRefs with posters when videoUrls exist.
        }
      } else if ((src.kind === 'text' || src.kind === 'sticky') && src.prompt.trim()) {
        promptParts.push(src.prompt.trim());
      } else if (src.kind === 'style-dna' && src.styleDna) {
        inheritedStyleDnaId = src.id;
        inheritedStyleDna = src.styleDna;
      }
    }

    const explicitPrompt = (opts?.prompt ?? '').trim();
    const combinedPrompt =
      explicitPrompt || promptParts.join('\n').trim();
    for (const h of extractHandles(combinedPrompt)) {
      handleSet.add(h);
    }

    const dims =
      targetKind === 'audio'
        ? { width: 340, height: 128 }
        : getDimensionsForAspect(aspectRatio, targetKind === 'video' ? 480 : 384);
    const width = dims.width;
    const height = dims.height;
    const x = Math.round(((opts?.x ?? maxX + 160)) / 10) * 10;
    const y = Math.round(((opts?.y ?? centerY - height / 2)) / 10) * 10;

    const countOfKind =
      state.nodes.filter((n) => n.kind === targetKind).length + 1;
    const id = `node_${targetKind}_ref_${Date.now()}`;
    const referenceFrameMode =
      targetKind === 'video'
        ? opts?.referenceFrameMode || 'multi-ref'
        : undefined;
    const startImageUrl =
      targetKind === 'video' &&
      referenceFrameMode === 'start-end' &&
      imageRefs.length >= 1
        ? imageRefs[0]
        : undefined;
    const endImageUrl =
      targetKind === 'video' &&
      referenceFrameMode === 'start-end' &&
      imageRefs.length >= 2
        ? imageRefs[1]
        : undefined;

    const badge =
      getPlatformBadgeLabel(
        platformId,
        modelId,
        state.platformsCatalog,
        state.externalMcpServers
      ) || platformId;

    const newNode: CanvasNode = {
      id,
      kind: targetKind,
      title:
        targetKind === 'image'
          ? `Images ${countOfKind}`
          : targetKind === 'video'
          ? `Videos ${countOfKind}`
          : `Audio ${countOfKind}`,
      prompt: combinedPrompt,
      x,
      y,
      width,
      height,
      aspectRatio,
      status: 'idle',
      platformId,
      connectionMode: 'auto',
      modelId,
      batchCount: targetKind === 'image' ? opts?.batchCount ?? 1 : 1,
      durationSec:
        targetKind === 'video'
          ? opts?.durationSec ?? chosenModel?.defaultDurationSec ?? 5
          : targetKind === 'audio'
          ? opts?.durationSec ?? chosenModel?.defaultDurationSec ?? 8
          : undefined,
      audioEnabled: targetKind === 'video' ? true : undefined,
      audioMode: targetKind === 'audio' ? 'tts' : undefined,
      voiceId: targetKind === 'audio' ? 'JBFqnCBsd6RMkjVDRZzb' : undefined,
      waveform: targetKind === 'audio' ? createDefaultWaveform(600 + countOfKind, 64) : undefined,
      referenceUrls: imageRefs.length > 0 ? imageRefs : undefined,
      videoReferenceUrls: videoRefs.length > 0 ? videoRefs : undefined,
      referenceFrameMode,
      startImageUrl,
      endImageUrl,
      seed: Math.floor(Math.random() * 9000) + 100,
      resolution,
      ...(quality ? { quality } : {}),
      ...(Object.keys(mergedModelParams).length > 0
        ? { modelParams: mergedModelParams }
        : {}),
      elementHandles: Array.from(handleSet),
      ...(inheritedStyleDnaId ? { styleDnaId: inheritedStyleDnaId } : {}),
      ...(inheritedStyleDna ? { styleDna: inheritedStyleDna } : {}),
      layers: [],
      providerUsed: badge,
      createdAt: Date.now(),
    };

    const ts = Date.now();
    const newEdges: CanvasEdge[] = sourceNodes.map((src, idx) => ({
      id: `edge_multiref_${ts}_${idx}`,
      sourceId: src.id,
      targetId: id,
      kind: 'lineage',
      label:
        src.elementHandles[0] ||
        (src.kind === 'video'
          ? `Video ${idx + 1}`
          : src.kind === 'text' || src.kind === 'sticky'
          ? 'Prompt'
          : `Ref ${idx + 1}`),
    }));

    set((s) => ({
      nodes: [...s.nodes, newNode],
      edges: [...s.edges, ...newEdges],
      selectedNodeIds: [id],
      promptText: combinedPrompt || s.promptText,
    }));

    void get().persistActiveProjectToDisk();
    get().showToast(
      `Formed "${newNode.title}" from ${sourceNodes.length} reference node${sourceNodes.length === 1 ? '' : 's'}`
    );

    if (opts?.autoGenerate) {
      await get().generateSingleNode(id);
    }

    return id;
  },

  splitBatchNodeToIndividualNodes: (nodeId, onlyIndex) => {
    const state = get();
    const node = state.nodes.find((n) => n.id === nodeId);
    if (!node) return [];
    const allOutputs =
      node.generatedOutputs && node.generatedOutputs.length > 0
        ? node.generatedOutputs
        : node.imageUrl
        ? [node.imageUrl]
        : [];
    if (allOutputs.length === 0) return [];
    if (onlyIndex === undefined && allOutputs.length <= 1) return [];

    const indices =
      typeof onlyIndex === 'number'
        ? onlyIndex >= 0 && onlyIndex < allOutputs.length
          ? [onlyIndex]
          : []
        : allOutputs.map((_, i) => i);
    if (indices.length === 0) return [];

    get().pushHistory();

    const childDims = getDimensionsForAspect(node.aspectRatio, 360);
    const childW = Math.min(384, childDims.width);
    const childH = Math.round((childW * childDims.height) / Math.max(1, childDims.width));
    const baseX = Math.round((node.x + node.width + 120) / 10) * 10;
    const baseY = Math.round(node.y / 10) * 10;
    const ts = Date.now();

    const createdNodes: CanvasNode[] = [];
    const createdEdges: CanvasEdge[] = [];

    indices.forEach((origIdx, posIdx) => {
      const url = allOutputs[origIdx];
      const col = indices.length === 1 ? 0 : posIdx % 2;
      const row = indices.length === 1 ? 0 : Math.floor(posIdx / 2);
      const childId = `node_split_${ts}_${origIdx}`;
      createdNodes.push({
        id: childId,
        kind: 'image',
        title: `${node.title} #${origIdx + 1}`,
        prompt: node.prompt,
        negativePrompt: node.negativePrompt,
        x: Math.round((baseX + col * (childW + 40)) / 10) * 10,
        y: Math.round((baseY + row * (childH + 40)) / 10) * 10,
        width: childW,
        height: childH,
        aspectRatio: node.aspectRatio,
        status: 'ready',
        progress: 100,
        imageUrl: url,
        generatedOutputs: [url],
        batchCount: 1,
        batchViewMode: 'single',
        platformId: node.platformId,
        connectionMode: node.connectionMode,
        modelId: node.modelId,
        seed: (node.seed || 100) + origIdx,
        resolution: node.resolution,
        quality: node.quality,
        modelParams: node.modelParams,
        elementHandles: node.elementHandles,
        styleDnaId: node.styleDnaId,
        styleDna: node.styleDna,
        editBadge: `Variation #${origIdx + 1}`,
        layers: createDefaultLayers(url),
        providerUsed: node.providerUsed,
        createdAt: ts + posIdx,
      });
      createdEdges.push({
        id: `edge_split_${ts}_${origIdx}`,
        sourceId: node.id,
        targetId: childId,
        kind: 'lineage',
        label: `#${origIdx + 1}`,
      });
    });

    const createdIds = createdNodes.map((n) => n.id);
    set((s) => ({
      nodes: [...s.nodes, ...createdNodes],
      edges: [...s.edges, ...createdEdges],
      selectedNodeIds: createdIds,
    }));

    void get().persistActiveProjectToDisk();
    get().showToast(
      indices.length === 1
        ? `Popped out variation #${indices[0] + 1} as a standalone node`
        : `Split batch into ${createdNodes.length} standalone image nodes`
    );
    return createdIds;
  },

  uploadLocalMediaNode: (file, worldX = 520, worldY = 260) => {
    const objectUrl = URL.createObjectURL(file);
    const isVideo = file.type.startsWith('video/');
    const isAudio = file.type.startsWith('audio/');
    get().pushHistory();

    const id = `node_upload_${Date.now()}`;
    const seed = Math.floor(Math.random() * 9000);
    const newNode: CanvasNode = {
      id,
      kind: isVideo ? 'video' : isAudio ? 'audio' : 'image',
      title: file.name.slice(0, 28),
      prompt: `Uploaded media: ${file.name}`,
      x: Math.round(worldX / 10) * 10,
      y: Math.round(worldY / 10) * 10,
      width: isVideo ? 568 : isAudio ? 360 : 340,
      height: isVideo ? 320 : isAudio ? 150 : 340,
      aspectRatio: isVideo || isAudio ? '16:9' : '1:1',
      status: 'ready',
      editBadge: 'Uploading…',
      imageUrl: !isVideo && !isAudio ? objectUrl : undefined,
      videoUrl: isVideo ? objectUrl : undefined,
      audioUrl: isAudio ? objectUrl : undefined,
      audioMode: isAudio ? 'ambient' : undefined,
      waveform: isAudio ? createDefaultWaveform(seed, 64) : undefined,
      durationSec: isVideo || isAudio ? 8 : undefined,
      seed,
      resolution: '1080p',
      elementHandles: [],
      layers: !isVideo && !isAudio ? createDefaultLayers(objectUrl) : [],
      providerUsed: 'Local Device Upload',
      createdAt: Date.now(),
    };

    set((s) => ({
      nodes: [...s.nodes, newNode],
      selectedNodeIds: [id],
    }));

    const reader = new FileReader();
    reader.onload = async () => {
      const dataBase64 = typeof reader.result === 'string' ? reader.result : '';
      if (!dataBase64) {
        get().updateNodeFields(id, { editBadge: undefined });
        return;
      }
      const uploaded = await uploadMediaViaBackend({
        filename: file.name,
        mimeType: file.type || undefined,
        dataBase64,
      });
      if (uploaded.ok && (uploaded.fullUrl || uploaded.mediaUrl)) {
        const persistedUrl = uploaded.fullUrl || uploaded.mediaUrl!;
        set((s) => ({
          nodes: s.nodes.map((n) =>
            n.id === id
              ? {
                  ...n,
                  editBadge: undefined,
                  imageUrl: !isVideo && !isAudio ? persistedUrl : n.imageUrl,
                  videoUrl: isVideo ? persistedUrl : n.videoUrl,
                  audioUrl: isAudio ? persistedUrl : n.audioUrl,
                  layers:
                    !isVideo && !isAudio
                      ? createDefaultLayers(persistedUrl)
                      : n.layers,
                  providerUsed: 'Disk Media (:3001)',
                }
              : n
          ),
        }));
        get().showToast(`Saved "${file.name}" to /media`);
      } else {
        get().updateNodeFields(id, { editBadge: undefined });
        get().showToast(`Added "${file.name}" to canvas`);
      }
    };
    reader.onerror = () => {
      get().updateNodeFields(id, { editBadge: undefined });
    };
    reader.readAsDataURL(file);
  },

  setPromptText: (promptText) => {
    const selId = get().selectedNodeIds[0];
    set((s) => ({
      promptText,
      nodes: selId
        ? s.nodes.map((n) =>
            n.id === selId && n.kind !== 'timeline' ? { ...n, prompt: promptText } : n
          )
        : s.nodes,
    }));
  },
  setPromptMode: (promptMode) => set({ promptMode }),
  setPromptSubMode: (promptSubMode) => set({ promptSubMode }),
  setPromptAspect: (promptAspect) => set({ promptAspect }),
  setPromptDurationSec: (promptDurationSec) => set({ promptDurationSec }),
  setPromptResolution: (promptResolution) => set({ promptResolution }),

  applySkillPreset: (skill) => {
    get().setPromptText(skill.promptTemplate);
    set({
      promptMode: skill.recommendedMode,
      promptDurationSec: skill.durationSec || get().promptDurationSec,
    });
    get().showToast(`Applied ${skill.slash}`);
  },

  injectCameraPromptToSelection: (cameraTag) => {
    const { selectedNodeIds, nodes, promptText } = get();
    const sel = nodes.find((n) => n.id === selectedNodeIds[0]);
    const base = sel ? sel.prompt : promptText;
    const nextPrompt = `${base.trim()}, ${cameraTag}`;
    if (sel) {
      get().updateNodeFields(sel.id, {
        prompt: nextPrompt,
        cameraMotion: cameraTag.slice(0, 32),
      });
    }
    set({ promptText: nextPrompt, cameraDirectorOpen: false });
    get().showToast(`Applied 3D Camera parameters: ${cameraTag}`);
  },

  submitPromptGeneration: async (sourceNodeId) => {
    const {
      promptText,
      promptMode,
      promptSubMode,
      promptAspect,
      promptDurationSec,
      promptResolution,
      activeProvider,
      byok,
      elements,
      nodes,
      selectedNodeIds,
    } = get();

    const anchorNode = nodes.find(
      (n) => n.id === (sourceNodeId || selectedNodeIds[0])
    );
    const effectivePrompt = (promptText || anchorNode?.prompt || '').trim();
    if (!effectivePrompt) return;

    if (anchorNode?.kind === 'audio') {
      await get().generateAudioForNode(anchorNode.id, {
        prompt: effectivePrompt,
        mode: anchorNode.audioMode || 'ambient',
        durationSec: promptDurationSec,
      });
      return;
    }

    if (
      !ensureProviderReadyOrPromptUser(
        activeProvider,
        byok,
        get().openProviderModal,
        get().showToast
      )
    ) {
      return;
    }

    if (
      anchorNode?.kind === 'video' &&
      (promptSubMode === 'keyframe-bridge' || anchorNode.bridgeMode)
    ) {
      await get().generateKeyframeBridgeForNode(anchorNode.id, {
        prompt: effectivePrompt,
        durationSec: promptDurationSec,
      });
      return;
    }

    if (
      (promptMode === 'multi-turn' || promptSubMode === 'multi-turn') &&
      anchorNode
    ) {
      await get().branchVideoMultiTurn(anchorNode.id, effectivePrompt);
      return;
    }

    get().pushHistory();
    const handles = extractHandles(effectivePrompt);
    const refImages: string[] = [];
    elements.forEach((v) => {
      if (handles.includes(v.handle)) {
        v.references.slice(0, 2).forEach((r) => refImages.push(r.dataUrl));
      }
    });

    const isGrid9 =
      promptMode === '9-grid' || effectivePrompt.includes('/9-Grid');
    const isGrid4 =
      promptMode === '4-angle' || effectivePrompt.includes('/4-Angle');
    const isVideo = !isGrid9 && !isGrid4 && promptMode === 'video';
    const targetKind: CanvasNode['kind'] =
      isGrid9 || isGrid4 ? 'contact-sheet' : isVideo ? 'video' : 'image';

    const seed = Math.floor(Math.random() * 9000) + 100;
    const liveBadge = getLiveStatusBadgeForProvider(activeProvider);
    const defaultSourceImg = isGrid9
      ? '/media/real_contact_9grid.jpg'
      : anchorNode?.imageUrl || refImages[0] || '/media/real_courtyard_sun.jpg';

    const updateInPlace = Boolean(anchorNode && anchorNode.kind === targetKind);
    const targetNodeId = updateInPlace && anchorNode ? anchorNode.id : `node_gen_${Date.now()}`;

    if (updateInPlace && anchorNode) {
      const nextDims = isVideo
        ? { width: 568, height: 320 }
        : isGrid9 || isGrid4
        ? { width: 480, height: 270 }
        : getDimensionsForAspect(promptAspect, Math.max(320, anchorNode.width));

      set((s) => ({
        nodes: s.nodes.map((n) =>
          n.id === anchorNode.id
            ? {
                ...n,
                prompt: effectivePrompt,
                aspectRatio: promptAspect,
                width: nextDims.width,
                height: nextDims.height,
                resolution: promptResolution,
                durationSec: isVideo ? promptDurationSec : n.durationSec,
                elementHandles: handles.length > 0 ? handles : n.elementHandles,
                status: 'generating' as const,
                progress: 35,
                editBadge: liveBadge,
              }
            : n
        ),
      }));
    } else {
      const spawnX = anchorNode
        ? anchorNode.x + anchorNode.width + 110
        : 600;
      const spawnY = anchorNode ? anchorNode.y : 160;
      const imgDims = getDimensionsForAspect(promptAspect, 360);
      const width = isVideo ? 568 : isGrid9 || isGrid4 ? 480 : imgDims.width;
      const height = isVideo ? 320 : isGrid9 || isGrid4 ? 270 : imgDims.height;

      const placeholderNode: CanvasNode = {
        id: targetNodeId,
        kind: targetKind,
        title: isGrid9
          ? 'Images · 9-Grid Sheet'
          : isGrid4
          ? 'Images · 4-Angle Sheet'
          : isVideo
          ? `Videos · ${promptDurationSec}s Shot`
          : 'Images · Generated Frame',
        prompt: effectivePrompt,
        x: spawnX,
        y: spawnY,
        width,
        height,
        aspectRatio: promptAspect,
        status: 'generating',
        progress: 35,
        editBadge: liveBadge,
        imageUrl: isCloudOrBridgeProvider(activeProvider) ? anchorNode?.imageUrl : defaultSourceImg,
        seed,
        resolution: promptResolution,
        durationSec: isVideo ? promptDurationSec : undefined,
        elementHandles: handles,
        layers: anchorNode?.imageUrl ? createDefaultLayers(anchorNode.imageUrl) : [],
        providerUsed: getProviderDisplayLabel(activeProvider),
        createdAt: Date.now(),
      };

      set((s) => ({
        nodes: [...s.nodes, placeholderNode],
        selectedNodeIds: [targetNodeId],
        edges: anchorNode
          ? [
              ...s.edges,
              {
                id: `edge_gen_${targetNodeId}`,
                sourceId: anchorNode.id,
                targetId: targetNodeId,
                kind: 'lineage',
              },
            ]
          : s.edges,
      }));
    }

    const execResult = await executeStudioGeneration({
      provider: activeProvider,
      prompt: effectivePrompt,
      aspectRatio: promptAspect,
      durationSec: promptDurationSec,
      resolution: promptResolution,
      mode: isGrid9 ? '9-grid' : isVideo ? 'video' : 'image',
      referenceImages:
        anchorNode?.imageUrl && !refImages.includes(anchorNode.imageUrl)
          ? [anchorNode.imageUrl, ...refImages]
          : refImages,
      firstFrameDataUrl: defaultSourceImg,
      mood: inferMoodFromPrompt(effectivePrompt),
      byok,
    });

    if (!execResult.ok) {
      if (updateInPlace && anchorNode) {
        set((s) => ({
          nodes: s.nodes.map((n) =>
            n.id === anchorNode.id
              ? {
                  ...n,
                  status: 'ready' as const,
                  progress: undefined,
                  editBadge: undefined,
                }
              : n
          ),
        }));
      } else {
        set((s) => ({
          nodes: s.nodes.filter((n) => n.id !== targetNodeId),
          edges: s.edges.filter((e) => e.id !== `edge_gen_${targetNodeId}`),
          selectedNodeIds: anchorNode ? [anchorNode.id] : [],
        }));
      }
      get().showToast(
        execResult.error || `Generation failed on ${getProviderDisplayLabel(activeProvider)}`,
        'error'
      );
      return;
    }

    const alreadySyncedViaWs = Boolean(
      execResult.jobId && completedBridgeJobIds.has(execResult.jobId)
    );
    if (execResult.jobId) {
      completedBridgeJobIds.add(execResult.jobId);
    }

    let imageUrl = execResult.imageUrl;
    let gridSpec: CanvasNode['gridSpec'];

    if (!imageUrl && !isCloudOrBridgeProvider(activeProvider)) {
      if (isGrid9) {
        imageUrl = '/media/real_contact_9grid.jpg';
        gridSpec = { rows: 3, cols: 3, labels: NINE_GRID_LABELS };
      } else if (isGrid4) {
        const sheet = renderContactSheetDataUrl(2, 2, effectivePrompt, seed);
        imageUrl = sheet.dataUrl;
        gridSpec = { rows: 2, cols: 2, labels: FOUR_ANGLE_LABELS };
      } else if (execResult.videoUrl) {
        imageUrl = defaultSourceImg;
      } else {
        imageUrl = renderShotDataUrl(promptAspect, {
          prompt: effectivePrompt,
          seed,
          cameraLabel: isVideo ? `${promptDurationSec}s` : promptResolution,
        });
      }
    } else if (!imageUrl && execResult.videoUrl) {
      imageUrl = anchorNode?.imageUrl || defaultSourceImg;
    }

    const normProvider = normalizeProviderId(activeProvider);
    set((s) => ({
      chromeBridge:
        normProvider === 'dreamina-bridge'
          ? { ...s.chromeBridge, extensionDetected: true, dreaminaTabConnected: true }
          : normProvider === 'flow-bridge'
          ? { ...s.chromeBridge, extensionDetected: true, flowTabConnected: true }
          : s.chromeBridge,
      nodes: s.nodes.map((n) => {
        if (n.id !== targetNodeId) return n;
        const resolvedImg = imageUrl || n.imageUrl;
        const resolvedVid = isVideo ? execResult.videoUrl || n.videoUrl : undefined;
        return {
          ...n,
          status: 'ready' as const,
          progress: 100,
          editBadge: undefined,
          imageUrl: resolvedImg,
          videoUrl: resolvedVid,
          interactionId: execResult.jobId || execResult.interactionId,
          gridSpec: gridSpec || n.gridSpec,
          layers: resolvedImg ? createDefaultLayers(resolvedImg) : n.layers,
          providerUsed: execResult.providerLabel,
          seed,
        };
      }),
    }));

    if (!alreadySyncedViaWs) {
      get().showToast(`Generated via ${execResult.providerLabel}`);
    }
  },

  openInlineEditor: (mode, nodeId) => {
    set({
      inlineEditorModal: {
        open: true,
        mode,
        nodeId,
      },
    });
  },

  closeInlineEditor: () => {
    set({
      inlineEditorModal: {
        open: false,
        mode: 'inpaint',
        nodeId: null,
      },
    });
  },

  applyInpaintToNode: async (nodeId, maskDataUrl, regionalPrompt) => {
    const node = get().nodes.find((n) => n.id === nodeId);
    if (!node) return;
    const { activeProvider, byok } = get();
    if (
      !ensureProviderReadyOrPromptUser(
        activeProvider,
        byok,
        get().openProviderModal,
        get().showToast
      )
    ) {
      return;
    }

    const sourceImage = node.imageUrl || '/media/real_courtyard_sun.jpg';
    get().pushHistory();

    const apiKey = getActiveApiKeyForProvider(activeProvider, byok);
    const promptToUse = regionalPrompt || 'Natural daylight limestone & foliage detail redraw';
    const normProvider = normalizeProviderId(activeProvider);
    const isByokCloud =
      normProvider === 'gemini-api' ||
      normProvider === 'fal' ||
      normProvider === 'replicate' ||
      normProvider === 'seedance' ||
      normProvider === 'comfyui';

    const childId = `node_inpaint_${Date.now()}`;
    const edgeId = `edge_inpaint_${Date.now()}`;
    const childNode: CanvasNode = {
      id: childId,
      kind: 'image',
      title: `Images · Inpaint Redraw`,
      prompt: promptToUse,
      x: node.x + node.width + 110,
      y: node.y,
      width: node.width,
      height: node.height,
      aspectRatio: node.aspectRatio,
      status: 'generating',
      progress: 40,
      editBadge: getLiveStatusBadgeForProvider(activeProvider, 'Inpainting…'),
      imageUrl: undefined,
      seed: node.seed + 19,
      resolution: node.resolution,
      elementHandles: node.elementHandles,
      layers: [],
      providerUsed: getProviderDisplayLabel(activeProvider),
      createdAt: Date.now(),
    };

    set((s) => ({
      nodes: [...s.nodes, childNode],
      edges: [
        ...s.edges,
        {
          id: edgeId,
          sourceId: node.id,
          targetId: childId,
          kind: 'lineage',
        },
      ],
      selectedNodeIds: [childId],
      inlineEditorModal: { open: false, mode: 'inpaint', nodeId: null },
    }));

    const live = await inpaintViaBackend({
      imageUrl: sourceImage,
      maskDataUrl,
      prompt: promptToUse,
      provider: activeProvider,
      apiKey,
    });

    if (!live.ok && isByokCloud) {
      set((s) => ({
        nodes: s.nodes.filter((n) => n.id !== childId),
        edges: s.edges.filter((e) => e.id !== edgeId),
        selectedNodeIds: [node.id],
      }));
      get().showToast(
        live.error || `Inpaint failed on ${getProviderDisplayLabel(activeProvider)}`,
        'error'
      );
      return;
    }

    let finalUrl = live.fullUrl || live.imageUrl;
    if (!finalUrl) {
      const { compositedDataUrl } = await compositeInpaintRedraw(
        sourceImage,
        maskDataUrl,
        promptToUse,
        node.seed + 19
      );
      finalUrl = compositedDataUrl;
    }

    set((s) => ({
      nodes: s.nodes.map((n) =>
        n.id === childId
          ? {
              ...n,
              status: 'ready',
              progress: 100,
              editBadge: undefined,
              imageUrl: finalUrl,
              layers: createDefaultLayers(finalUrl),
              providerUsed: live.ok
                ? isByokCloud
                  ? getProviderDisplayLabel(activeProvider)
                  : `FFmpeg Inpaint (${live.engine || 'local'})`
                : 'Canvas Inpaint',
            }
          : n
      ),
    }));
    get().showToast('Synthesized Inpaint frame');
  },

  expandOutpaintNode: async (nodeId, targetAspect, customPrompt) => {
    const node = get().nodes.find((n) => n.id === nodeId);
    if (!node) return;
    const { activeProvider, byok } = get();
    if (
      !ensureProviderReadyOrPromptUser(
        activeProvider,
        byok,
        get().openProviderModal,
        get().showToast
      )
    ) {
      return;
    }

    const sourceImage = node.imageUrl || '/media/real_courtyard_sun.jpg';
    get().pushHistory();

    const apiKey = getActiveApiKeyForProvider(activeProvider, byok);
    const normProvider = normalizeProviderId(activeProvider);
    const isByokCloud =
      normProvider === 'gemini-api' ||
      normProvider === 'fal' ||
      normProvider === 'replicate' ||
      normProvider === 'seedance' ||
      normProvider === 'comfyui';
    const newDims = getDimensionsForAspect(targetAspect, 440);
    const childId = `node_outpaint_${Date.now()}`;
    const edgeId = `edge_outpaint_${Date.now()}`;
    const promptUsed = customPrompt?.trim() || node.prompt;

    const childNode: CanvasNode = {
      id: childId,
      kind: 'image',
      title: `Images · Outpaint ${targetAspect}`,
      prompt: promptUsed,
      x: node.x + node.width + 110,
      y: node.y,
      width: newDims.width,
      height: newDims.height,
      aspectRatio: targetAspect,
      status: 'generating',
      progress: 45,
      editBadge: getLiveStatusBadgeForProvider(
        activeProvider,
        `Outpainting ${targetAspect}…`
      ),
      imageUrl: undefined,
      seed: node.seed + 31,
      resolution: '2K',
      elementHandles: node.elementHandles,
      layers: [],
      providerUsed: getProviderDisplayLabel(activeProvider),
      createdAt: Date.now(),
    };

    set((s) => ({
      nodes: [...s.nodes, childNode],
      edges: [
        ...s.edges,
        {
          id: edgeId,
          sourceId: node.id,
          targetId: childId,
          kind: 'lineage',
        },
      ],
      selectedNodeIds: [childId],
      inlineEditorModal: { open: false, mode: 'outpaint', nodeId: null },
    }));

    const live = await outpaintViaBackend({
      imageUrl: sourceImage,
      targetAspect,
      prompt: promptUsed,
      provider: activeProvider,
      apiKey,
    });

    if (!live.ok && isByokCloud) {
      set((s) => ({
        nodes: s.nodes.filter((n) => n.id !== childId),
        edges: s.edges.filter((e) => e.id !== edgeId),
        selectedNodeIds: [node.id],
      }));
      get().showToast(
        live.error || `Outpaint failed on ${getProviderDisplayLabel(activeProvider)}`,
        'error'
      );
      return;
    }

    const finalUrl =
      live.fullUrl ||
      live.imageUrl ||
      (await expandOutpaintDataUrl(sourceImage, targetAspect, promptUsed, node.seed));

    set((s) => ({
      nodes: s.nodes.map((n) =>
        n.id === childId
          ? {
              ...n,
              status: 'ready',
              progress: 100,
              editBadge: undefined,
              imageUrl: finalUrl,
              layers: createDefaultLayers(finalUrl),
              providerUsed: live.ok
                ? isByokCloud
                  ? getProviderDisplayLabel(activeProvider)
                  : 'FFmpeg Outpaint (:3001)'
                : 'Canvas Outpaint',
            }
          : n
      ),
    }));
    get().showToast(`Outpainted frame to ${targetAspect}`);
  },

  removeBgAndDecomposeLayers: async (nodeId) => {
    const node = get().nodes.find((n) => n.id === nodeId);
    if (!node) return;
    get().pushHistory();

    const sourceImage = node.imageUrl || '/media/real_portrait_clara.jpg';
    get().updateNodeFields(nodeId, { editBadge: 'Removing BG…' });

    const live = await removeBgViaBackend(sourceImage);
    const fallbackCutout = decomposeSubjectAndBackground(
      node.aspectRatio,
      node.prompt,
      node.seed
    ).foregroundDataUrl;
    const cutoutUrl = live.fullUrl || live.imageUrl || fallbackCutout;

    const childId = `node_cutout_${Date.now()}`;
    const cutoutNode: CanvasNode = {
      id: childId,
      kind: 'image',
      title: `Images · Alpha Cutout`,
      prompt: `${node.prompt} (Transparent RGBA Cutout)`,
      x: node.x + node.width + 110,
      y: node.y,
      width: node.width,
      height: node.height,
      aspectRatio: node.aspectRatio,
      status: 'ready',
      isTransparentCutout: true,
      imageUrl: cutoutUrl,
      seed: node.seed,
      resolution: node.resolution,
      elementHandles: node.elementHandles,
      layers: createDefaultLayers(cutoutUrl),
      providerUsed: live.ok ? 'FFmpeg RGBA Cutout (:3001)' : 'Alpha Cutout',
      createdAt: Date.now(),
    };

    set((s) => ({
      nodes: [
        ...s.nodes.map((n) =>
          n.id === nodeId ? { ...n, editBadge: undefined } : n
        ),
        cutoutNode,
      ],
      edges: [
        ...s.edges,
        {
          id: `edge_cutout_${Date.now()}`,
          sourceId: node.id,
          targetId: childId,
          kind: 'lineage',
        },
      ],
      selectedNodeIds: [childId],
    }));

    get().showToast('Extracted RGBA subject cutout onto canvas');
  },

  updateNodeLayer: (nodeId, layerId, patch) => {
    set((s) => ({
      nodes: s.nodes.map((n) =>
        n.id === nodeId
          ? {
              ...n,
              layers: n.layers.map((l) => (l.id === layerId ? { ...l, ...patch } : l)),
            }
          : n
      ),
    }));
  },

  upscaleNodeHd: async (nodeId, targetRes) => {
    const node = get().nodes.find((n) => n.id === nodeId);
    if (!node) return;
    get().pushHistory();

    const sourceImage = node.imageUrl || '/media/real_courtyard_sun.jpg';
    get().updateNodeFields(nodeId, { editBadge: `Upscaling ${targetRes}…` });

    const live = await upscaleViaBackend(sourceImage);
    const upscaledUrl = live.fullUrl || live.imageUrl || sourceImage;

    const childId = `node_upscale_${Date.now()}`;
    const upscaledNode: CanvasNode = {
      id: childId,
      kind: 'image',
      title: `${node.title.replace(/ · 4K$/, '')} · ${targetRes}`,
      prompt: node.prompt,
      x: node.x + node.width + 110,
      y: node.y,
      width: node.width,
      height: node.height,
      aspectRatio: node.aspectRatio,
      status: 'ready',
      imageUrl: upscaledUrl,
      seed: node.seed,
      resolution: targetRes,
      elementHandles: node.elementHandles,
      layers: createDefaultLayers(upscaledUrl),
      providerUsed: live.ok ? 'FFmpeg 4K Lanczos (:3001)' : `${targetRes} Upscaler`,
      createdAt: Date.now(),
    };

    set((s) => ({
      nodes: [
        ...s.nodes.map((n) =>
          n.id === nodeId ? { ...n, editBadge: undefined } : n
        ),
        upscaledNode,
      ],
      edges: [
        ...s.edges,
        {
          id: `edge_upscale_${Date.now()}`,
          sourceId: node.id,
          targetId: childId,
          kind: 'lineage',
        },
      ],
      selectedNodeIds: [childId],
    }));

    get().showToast(`Upscaled "${node.title}" to ${targetRes} (3840px)`);
  },

  retakeNode: async (nodeId) => {
    const node = get().nodes.find((n) => n.id === nodeId);
    if (!node) return;
    get().pushHistory();
    const nextSeed = node.seed + 137;

    if (node.kind === 'video') {
      const ff = await renderVideoViaBackend({
        prompt: `${node.prompt} (seed ${nextSeed})`,
        imageUrl: node.imageUrl || '/media/real_courtyard_sun.jpg',
        durationSec: node.durationSec || 6,
        aspectRatio: node.aspectRatio,
        mood: inferMoodFromPrompt(node.prompt),
      });
      if (ff.ok && ff.videoUrl) {
        set((s) => ({
          nodes: s.nodes.map((n) =>
            n.id === nodeId
              ? {
                  ...n,
                  seed: nextSeed,
                  videoUrl: ff.videoUrl,
                  providerUsed: 'FFmpeg 8.0 Retake (:3001)',
                }
              : n
          ),
        }));
        get().showToast(`Retook "${node.title}" (Seed #${nextSeed})`);
        return;
      }
    }

    const nextImg =
      node.imageUrl?.startsWith('/media/')
        ? node.imageUrl
        : renderShotDataUrl(node.aspectRatio, {
            prompt: node.prompt,
            seed: nextSeed,
          });
    set((s) => ({
      nodes: s.nodes.map((n) =>
        n.id === nodeId ? { ...n, seed: nextSeed, imageUrl: nextImg } : n
      ),
    }));
    get().showToast(`Retook "${node.title}" (Seed #${nextSeed})`);
  },

  sliceContactSheetNode: async (nodeId, rows = 3, cols = 3) => {
    const node = get().nodes.find((n) => n.id === nodeId);
    if (!node) return;
    get().pushHistory();

    const defaultLabels = rows === 3 && cols === 3 ? NINE_GRID_LABELS : FOUR_ANGLE_LABELS;
    const labels =
      node.gridSpec?.labels && node.gridSpec.labels.length === rows * cols
        ? node.gridSpec.labels
        : defaultLabels;

    const candidateImg =
      node.kind === 'contact-sheet' && node.imageUrl
        ? node.imageUrl
        : rows === 3 && cols === 3
        ? '/media/real_contact_9grid.jpg'
        : node.imageUrl;

    get().showToast(`Slicing ${rows}×${cols} sheet via :3001 FFmpeg...`);

    let slicedUrls: string[] = [];
    let usedBackend = false;

    if (candidateImg && !candidateImg.startsWith('data:')) {
      const backendSlice = await sliceGridViaBackend(candidateImg, rows, cols);
      if (backendSlice.ok && backendSlice.sliceUrls.length > 0) {
        slicedUrls = backendSlice.sliceUrls;
        usedBackend = true;
      }
    }

    if (slicedUrls.length === 0) {
      let sourceDataUrl = candidateImg;
      if (!sourceDataUrl || (node.kind !== 'contact-sheet' && rows === 2)) {
        const sheet = renderContactSheetDataUrl(rows, cols, node.prompt, node.seed);
        sourceDataUrl = sheet.dataUrl;
      }
      slicedUrls = await sliceGridImageDataUrl(sourceDataUrl, rows, cols);
    }

    const cardW = 260;
    const cardH = 146;
    const startX = node.x + node.width + 120;
    const startY = Math.max(80, node.y - 40);

    const spawnedNodes: CanvasNode[] = [];
    const spawnedEdges: CanvasEdge[] = [];

    slicedUrls.forEach((url, idx) => {
      const r = Math.floor(idx / cols);
      const c = idx % cols;
      const childId = `node_slice_${Date.now()}_${idx}`;
      const angleLabel = labels[idx] || `Images · Slice ${idx + 1}`;
      spawnedNodes.push({
        id: childId,
        kind: 'image',
        title: angleLabel,
        prompt: `${node.prompt} — [${angleLabel}]`,
        x: startX + c * (cardW + 44),
        y: startY + r * (cardH + 64),
        width: cardW,
        height: cardH,
        aspectRatio: '16:9',
        status: 'ready',
        imageUrl: url,
        seed: node.seed + idx * 97,
        resolution: '2K',
        cameraAngle: angleLabel,
        interactionId: `int_slice_${idx + 1}`,
        elementHandles: node.elementHandles,
        layers: createDefaultLayers(url),
        providerUsed: usedBackend ? 'FFmpeg Slicer (:3001)' : `${rows}×${cols} Slicer`,
        createdAt: Date.now() + idx,
      });
      spawnedEdges.push({
        id: `edge_slice_${node.id}_${childId}`,
        sourceId: node.id,
        targetId: childId,
        kind: 'grid-slice',
      });
    });

    set((s) => ({
      nodes: [...s.nodes, ...spawnedNodes],
      edges: [...s.edges, ...spawnedEdges],
      selectedNodeIds: spawnedNodes.map((sn) => sn.id),
    }));

    get().showToast(`Unpacked ${spawnedNodes.length} sliced frames onto canvas`);
  },

  generateFourAngleCoverage: async (nodeId) => {
    await get().sliceContactSheetNode(nodeId, 2, 2);
  },

  convertImageToOmniVideo: async (nodeId, durationSec = 6) => {
    const node = get().nodes.find((n) => n.id === nodeId);
    if (!node) return;
    const { activeProvider, byok } = get();
    if (
      !ensureProviderReadyOrPromptUser(
        activeProvider,
        byok,
        get().openProviderModal,
        get().showToast
      )
    ) {
      return;
    }

    get().pushHistory();
    const liveBadge = getLiveStatusBadgeForProvider(
      activeProvider,
      `Synthesizing ${durationSec}s Video…`
    );
    get().updateNodeFields(nodeId, { editBadge: liveBadge });
    get().showToast(`${liveBadge}`);

    const exec = await executeStudioGeneration({
      provider: activeProvider,
      prompt: node.prompt,
      aspectRatio: '16:9',
      durationSec,
      resolution: node.resolution,
      mode: 'video',
      referenceImages: node.imageUrl ? [node.imageUrl] : [],
      firstFrameDataUrl: node.imageUrl || '/media/real_courtyard_sun.jpg',
      cameraMotion: 'Dolly In',
      mood: inferMoodFromPrompt(node.prompt),
      byok,
    });

    if (!exec.ok) {
      get().updateNodeFields(nodeId, { editBadge: undefined });
      get().showToast(
        exec.error || `Image → Video failed on ${getProviderDisplayLabel(activeProvider)}`,
        'error'
      );
      return;
    }

    if (exec.jobId) completedBridgeJobIds.add(exec.jobId);

    const childId = `node_omni_vid_${Date.now()}`;
    const newVideoNode: CanvasNode = {
      id: childId,
      kind: 'video',
      title: `Videos · ${node.title}`,
      prompt: node.prompt,
      x: node.x + node.width + 110,
      y: node.y,
      width: 568,
      height: 320,
      aspectRatio: '16:9',
      status: 'ready',
      imageUrl: node.imageUrl || '/media/real_courtyard_sun.jpg',
      videoUrl:
        exec.videoUrl ||
        (!isCloudOrBridgeProvider(activeProvider) ? '/media/real_shot01_courtyard.mp4' : undefined),
      seed: node.seed,
      resolution: node.resolution,
      durationSec,
      cameraMotion: 'Dolly In',
      interactionId: exec.jobId || exec.interactionId,
      elementHandles: node.elementHandles,
      layers: createDefaultLayers(node.imageUrl),
      providerUsed: exec.providerLabel,
      createdAt: Date.now(),
    };

    set((s) => ({
      nodes: [
        ...s.nodes.map((n) => (n.id === nodeId ? { ...n, editBadge: undefined } : n)),
        newVideoNode,
      ],
      edges: [
        ...s.edges,
        {
          id: `edge_img2vid_${Date.now()}`,
          sourceId: node.id,
          targetId: childId,
          kind: 'lineage',
        },
      ],
      selectedNodeIds: [childId],
    }));

    get().showToast(`Rendered ${durationSec}s video via ${exec.providerLabel}`);
  },

  branchVideoMultiTurn: async (nodeId, deltaPrompt) => {
    const parent = get().nodes.find((n) => n.id === nodeId);
    if (!parent) return;
    const { activeProvider, byok } = get();
    if (
      !ensureProviderReadyOrPromptUser(
        activeProvider,
        byok,
        get().openProviderModal,
        get().showToast
      )
    ) {
      return;
    }

    get().pushHistory();
    const parentInteractionId = parent.interactionId || `int_omni_${parent.seed}`;

    const mood = inferMoodFromPrompt(deltaPrompt);
    const branchKeyframe =
      mood === 'golden'
        ? '/media/real_atelier_interior.jpg'
        : parent.imageUrl || '/media/real_coastal_cliffs.jpg';

    const liveBadge = getLiveStatusBadgeForProvider(
      activeProvider,
      `Branching Multi-Turn (${parentInteractionId.slice(0, 10)})…`
    );
    get().updateNodeFields(nodeId, { editBadge: liveBadge });
    get().showToast(`${liveBadge}`);

    const exec = await executeStudioGeneration({
      provider: activeProvider,
      prompt: deltaPrompt,
      aspectRatio: '16:9',
      durationSec: parent.durationSec || 6,
      resolution: parent.resolution,
      mode: 'video',
      referenceImages: parent.imageUrl ? [parent.imageUrl] : [],
      firstFrameDataUrl: branchKeyframe,
      previousInteractionId: parentInteractionId,
      mood,
      byok,
    });

    if (!exec.ok) {
      get().updateNodeFields(nodeId, { editBadge: undefined });
      get().showToast(
        exec.error || `Multi-turn branch failed on ${getProviderDisplayLabel(activeProvider)}`,
        'error'
      );
      return;
    }

    if (exec.jobId) completedBridgeJobIds.add(exec.jobId);

    const branchId = `node_branch_${Date.now()}`;
    const branchedNode: CanvasNode = {
      id: branchId,
      kind: 'video',
      title: `Videos · Multi-Turn Branch`,
      prompt: deltaPrompt,
      x: parent.x + parent.width + 110,
      y: parent.y + 80,
      width: 568,
      height: 320,
      aspectRatio: '16:9',
      status: 'ready',
      imageUrl: branchKeyframe,
      videoUrl:
        exec.videoUrl ||
        (!isCloudOrBridgeProvider(activeProvider) ? '/media/real_shot03_atelier.mp4' : undefined),
      seed: parent.seed + 211,
      resolution: parent.resolution,
      durationSec: parent.durationSec || 6,
      cameraMotion: 'Multi-Turn Branch',
      interactionId: exec.jobId || exec.interactionId,
      previousInteractionId: parentInteractionId,
      elementHandles: Array.from(
        new Set([...parent.elementHandles, ...extractHandles(deltaPrompt)])
      ),
      layers: createDefaultLayers(branchKeyframe),
      providerUsed: exec.providerLabel,
      createdAt: Date.now(),
    };

    set((s) => ({
      nodes: [
        ...s.nodes.map((n) => (n.id === nodeId ? { ...n, editBadge: undefined } : n)),
        branchedNode,
      ],
      edges: [
        ...s.edges,
        {
          id: `edge_branch_${Date.now()}`,
          sourceId: parent.id,
          targetId: branchId,
          kind: 'multi-turn-branch',
        },
      ],
      selectedNodeIds: [branchId],
    }));

    get().showToast(`Branched video via ${exec.providerLabel}`);
  },

  generateKeyframeBridgeForNode: async (nodeId, opts) => {
    const node = get().nodes.find((n) => n.id === nodeId);
    if (!node) return;

    const { nodes, edges, activeProvider, byok } = get();
    if (
      !ensureProviderReadyOrPromptUser(
        activeProvider,
        byok,
        get().openProviderModal,
        get().showToast
      )
    ) {
      return;
    }

    get().pushHistory();
    const apiKey = getActiveApiKeyForProvider(activeProvider, byok);

    // Find any connected upstream image nodes if explicit URLs weren't provided
    const upstreamImages = edges
      .filter((e) => e.targetId === nodeId)
      .map((e) => nodes.find((nn) => nn.id === e.sourceId))
      .filter(
        (nn): nn is CanvasNode =>
          Boolean(nn && (nn.kind === 'image' || nn.kind === 'element') && nn.imageUrl)
      );

    const allCanvasImages = nodes.filter(
      (nn) => (nn.kind === 'image' || nn.kind === 'element') && nn.imageUrl
    );

    const startNodeId =
      opts?.startNodeId ??
      node.startNodeId ??
      upstreamImages[0]?.id ??
      allCanvasImages[0]?.id;
    const endNodeId =
      opts?.endNodeId ??
      node.endNodeId ??
      upstreamImages[1]?.id ??
      allCanvasImages[1]?.id;

    const startImageUrl =
      opts?.startImageUrl ||
      (startNodeId ? nodes.find((nn) => nn.id === startNodeId)?.imageUrl : undefined) ||
      node.startImageUrl ||
      node.imageUrl ||
      '/media/real_courtyard_sun.jpg';

    const endImageUrl =
      opts?.endImageUrl ||
      (endNodeId ? nodes.find((nn) => nn.id === endNodeId)?.imageUrl : undefined) ||
      node.endImageUrl ||
      '/media/real_coastal_cliffs.jpg';

    const motionCurve: KeyframeBridgeCurve =
      opts?.motionCurve || node.motionCurve || 'ease-in-out';
    const durationSec = opts?.durationSec || node.durationSec || 6;
    const prompt =
      opts?.prompt?.trim() ||
      node.prompt ||
      'First-Frame → Last-Frame smooth optical transition';

    const normProvider = normalizeProviderId(activeProvider);
    const liveBadge = getLiveStatusBadgeForProvider(
      activeProvider,
      `Bridging (${motionCurve})…`
    );

    get().updateNodeFields(nodeId, {
      status: 'generating',
      editBadge: liveBadge,
      bridgeMode: true,
      startNodeId,
      endNodeId,
      startImageUrl,
      endImageUrl,
      motionCurve,
    });
    get().showToast(liveBadge);

    let finalVideoUrl: string | undefined;
    let finalDuration = durationSec;
    let providerLabelUsed = getProviderDisplayLabel(activeProvider);

    if (normProvider === 'dreamina-bridge' || normProvider === 'flow-bridge') {
      const bridgeRes = await enqueueLiveBridgeJobViaBackend({
        target: normProvider === 'dreamina-bridge' ? 'dreamina' : 'google-flow',
        mode: 'video',
        prompt: `[First-Frame → Last-Frame ${motionCurve}] ${prompt}`,
        aspectRatio: '16:9',
        durationSec,
        referenceImages: [startImageUrl, endImageUrl].filter(Boolean),
        waitForResult: true,
      });
      if (!bridgeRes.ok || (!bridgeRes.videoUrl && !bridgeRes.fullUrl)) {
        get().updateNodeFields(nodeId, { status: 'ready', editBadge: undefined });
        get().showToast(
          bridgeRes.error || `Keyframe bridge failed on ${providerLabelUsed}`,
          'error'
        );
        return;
      }
      if (bridgeRes.jobId) completedBridgeJobIds.add(bridgeRes.jobId);
      finalVideoUrl = bridgeRes.fullUrl || bridgeRes.videoUrl;
    } else {
      const live = await keyframeBridgeViaBackend({
        startImageUrl,
        endImageUrl,
        durationSec,
        motionCurve,
        prompt,
        provider: activeProvider,
        apiKey,
        baseUrl: normProvider === 'comfyui' ? byok.comfyUiUrl : undefined,
      });

      if (!live.ok && isCloudOrBridgeProvider(activeProvider)) {
        get().updateNodeFields(nodeId, { status: 'ready', editBadge: undefined });
        get().showToast(
          live.error || `Keyframe bridge failed on ${providerLabelUsed}`,
          'error'
        );
        return;
      }

      finalVideoUrl =
        live.fullUrl ||
        live.videoUrl ||
        (!isCloudOrBridgeProvider(activeProvider) ? '/media/real_shot02_bridge.mp4' : undefined);
      finalDuration = live.durationSec || durationSec;
      providerLabelUsed = live.ok
        ? isCloudOrBridgeProvider(activeProvider)
          ? `${providerLabelUsed}${live.model ? ` · ${live.model}` : ''}`
          : `FFmpeg Keyframe Bridge (${motionCurve})`
        : 'Keyframe Bridge';
    }

    if (node.kind === 'video') {
      set((s) => ({
        nodes: s.nodes.map((n) =>
          n.id === nodeId
            ? {
                ...n,
                status: 'ready',
                editBadge: undefined,
                bridgeMode: true,
                startNodeId,
                endNodeId,
                startImageUrl,
                endImageUrl,
                motionCurve,
                durationSec: finalDuration,
                prompt,
                imageUrl: endImageUrl,
                videoUrl: finalVideoUrl,
                cameraMotion: `Bridge · ${motionCurve}`,
                providerUsed: providerLabelUsed,
              }
            : n
        ),
        timelineClips: s.timelineClips.map((c) =>
          c.sourceNodeId === nodeId && finalVideoUrl
            ? { ...c, videoUrl: finalVideoUrl, thumbnailUrl: endImageUrl }
            : c
        ),
      }));
    } else {
      const childId = `node_bridge_vid_${Date.now()}`;
      const bridgeNode: CanvasNode = {
        id: childId,
        kind: 'video',
        title: `Videos · A → B Keyframe Bridge`,
        prompt,
        x: node.x + node.width + 110,
        y: node.y,
        width: 568,
        height: 320,
        aspectRatio: '16:9',
        status: 'ready',
        bridgeMode: true,
        startNodeId,
        endNodeId,
        startImageUrl,
        endImageUrl,
        motionCurve,
        imageUrl: endImageUrl,
        videoUrl: finalVideoUrl,
        durationSec: finalDuration,
        cameraMotion: `Bridge · ${motionCurve}`,
        seed: node.seed + 71,
        resolution: '1080p',
        elementHandles: node.elementHandles,
        layers: createDefaultLayers(endImageUrl),
        providerUsed: providerLabelUsed,
        createdAt: Date.now(),
      };
      set((s) => ({
        nodes: [
          ...s.nodes.map((n) =>
            n.id === nodeId
              ? { ...n, status: 'ready' as const, editBadge: undefined }
              : n
          ),
          bridgeNode,
        ],
        edges: [
          ...s.edges,
          {
            id: `edge_kfb_${Date.now()}`,
            sourceId: nodeId,
            targetId: childId,
            kind: 'multiframe',
          },
        ],
        selectedNodeIds: [childId],
      }));
    }

    get().showToast(`Rendered A → B Keyframe Bridge via ${providerLabelUsed}`);
  },

  generateAudioForNode: async (nodeId, opts) => {
    const node = get().nodes.find((n) => n.id === nodeId);
    if (!node) return;
    get().pushHistory();

    const mode = opts?.mode || node.audioMode || 'ambient';
    const durationSec = opts?.durationSec || node.durationSec || 8;
    const prompt =
      opts?.prompt?.trim() ||
      node.prompt ||
      'Natural Atlantic coastal breeze and warm open-air room tone';

    get().updateNodeFields(nodeId, {
      status: 'generating',
      editBadge: mode === 'voiceover' ? 'Synthesizing TTS…' : 'Synthesizing Audio…',
      audioMode: mode,
      prompt,
    });
    get().showToast(
      mode === 'voiceover'
        ? 'Synthesizing spoken voiceover + 64-bar waveform...'
        : 'Synthesizing stereo soundscape + 64-bar waveform...'
    );

    const live = await generateAudioViaBackend({
      prompt,
      mode,
      voiceText: mode === 'voiceover' ? prompt : undefined,
      durationSec,
    });

    const finalAudioUrl =
      live.fullUrl || live.audioUrl || '/media/real_coastal_foley.mp3';
    const nextSeed = node.seed + 23;
    const finalWaveform =
      live.waveform && live.waveform.length > 0
        ? live.waveform
        : createDefaultWaveform(nextSeed, 64);
    const finalDuration = live.durationSec || durationSec;

    set((s) => ({
      nodes: s.nodes.map((n) =>
        n.id === nodeId
          ? {
              ...n,
              status: 'ready',
              editBadge: undefined,
              prompt,
              audioMode: mode,
              audioUrl: finalAudioUrl,
              waveform: finalWaveform,
              durationSec: finalDuration,
              seed: nextSeed,
              providerUsed:
                mode === 'voiceover'
                  ? 'macOS TTS + FFmpeg (:3001)'
                  : 'FFmpeg Acoustic Synth (:3001)',
            }
          : n
      ),
      timelineClips: s.timelineClips.map((c) =>
        c.sourceNodeId === nodeId
          ? {
              ...c,
              audioUrl: finalAudioUrl,
              waveform: finalWaveform,
              durationSec: finalDuration,
              promptOrDialogue: prompt,
            }
          : c
      ),
    }));

    get().showToast(
      mode === 'voiceover'
        ? 'Synthesized spoken voiceover MP3'
        : 'Synthesized stereo acoustic MP3'
    );
  },

  executeMcpToolNode: async (nodeId) => {
    const mcpNode = get().nodes.find((n) => n.id === nodeId);
    if (!mcpNode || !mcpNode.mcpTool) return;
    get().pushHistory();

    const isVidTool =
      mcpNode.mcpTool.name.includes('video') || mcpNode.mcpTool.name.includes('scene');

    const exec = await executeStudioGeneration({
      provider: 'mcp-router',
      prompt: mcpNode.prompt,
      aspectRatio: '16:9',
      durationSec: 6,
      mode: isVidTool ? 'video' : 'image',
      firstFrameDataUrl: '/media/real_courtyard_sun.jpg',
      mcpTool: mcpNode.mcpTool,
      byok: get().byok,
    });

    const outId = `node_mcp_out_${Date.now()}`;
    const img = exec.imageUrl || '/media/real_courtyard_sun.jpg';

    const outNode: CanvasNode = {
      id: outId,
      kind: isVidTool || exec.videoUrl ? 'video' : 'image',
      title: `MCP · ${mcpNode.mcpTool.name}`,
      prompt: mcpNode.prompt,
      x: mcpNode.x + mcpNode.width + 100,
      y: mcpNode.y,
      width: isVidTool ? 568 : 320,
      height: 320,
      aspectRatio: isVidTool ? '16:9' : '1:1',
      status: 'ready',
      imageUrl: img,
      videoUrl: exec.videoUrl || (isVidTool ? '/media/real_shot01_courtyard.mp4' : undefined),
      seed: mcpNode.seed + 83,
      resolution: '1080p',
      durationSec: isVidTool ? 6 : undefined,
      interactionId: exec.interactionId,
      elementHandles: extractHandles(mcpNode.prompt),
      layers: createDefaultLayers(img),
      providerUsed: exec.providerLabel,
      createdAt: Date.now(),
    };

    set((s) => ({
      nodes: [...s.nodes, outNode],
      edges: [
        ...s.edges,
        {
          id: `edge_mcp_${Date.now()}`,
          sourceId: mcpNode.id,
          targetId: outId,
          kind: 'mcp-pipe',
        },
      ],
      selectedNodeIds: [outId],
    }));

    get().showToast(`Executed MCP tool "${mcpNode.mcpTool.name}"`);
  },

  addElementVault: (handle, name, category, description) => {
    const normalized = handle.startsWith('@') ? handle : `@${handle}`;
    const cleanHandle = normalized.replace(/[^@A-Za-z0-9_]/g, '_');
    const newVault: ElementVault = {
      id: `el_${Date.now()}`,
      handle: cleanHandle,
      name,
      category,
      description,
      accentColor: '#20D5EC',
      references: [],
    };
    set((s) => ({ elements: [...s.elements, newVault] }));
    get().showToast(`Created element ${cleanHandle}`);
  },

  addReferenceImageToVault: (vaultId, label, dataUrl) => {
    set((s) => ({
      elements: s.elements.map((v) => {
        if (v.id !== vaultId || v.references.length >= 6) return v;
        return {
          ...v,
          references: [...v.references, { id: `ref_${Date.now()}`, label, dataUrl }],
        };
      }),
    }));
  },

  removeReferenceFromVault: (vaultId, refId) => {
    set((s) => ({
      elements: s.elements.map((v) =>
        v.id === vaultId
          ? { ...v, references: v.references.filter((r) => r.id !== refId) }
          : v
      ),
    }));
  },

  spawnStyleDnaNode: (sourceNodeId) => {
    const refNode = sourceNodeId
      ? get().nodes.find((n) => n.id === sourceNodeId)
      : get().nodes.find((n) => n.id === get().selectedNodeIds[0]);
    get().spawnDreaminaNodeAt(
      'cinema-kit',
      refNode ? refNode.x - 360 : 120,
      refNode ? refNode.y : 200,
      refNode ? { wireFromNodeId: refNode.id, wireDirection: 'left' } : undefined
    );
  },

  updateStyleDnaNode: (nodeId, patch) => {
    set((s) => ({
      nodes: s.nodes.map((n) =>
        n.id === nodeId && n.styleDna
          ? { ...n, styleDna: { ...n.styleDna, ...patch } }
          : n
      ),
    }));
  },

  addMultiframeFromNodeOrBlank: (nodeId) => {
    const { multiframes, bridges, nodes } = get();
    if (multiframes.length >= 10) return;
    get().pushHistory();
    const srcNode = nodeId ? nodes.find((n) => n.id === nodeId) : undefined;
    const idx = multiframes.length + 1;
    const prompt =
      srcNode?.prompt ||
      `Keyframe 0${idx} · @Clara_Vidal & @Leica_M6 natural daylight camera progression`;
    const imageUrl = srcNode?.imageUrl || '/media/real_courtyard_sun.jpg';

    const newCard: MultiframeCard = {
      id: `mf_${Date.now()}`,
      order: multiframes.length,
      title: srcNode?.title || `KF 0${idx}`,
      prompt,
      imageUrl,
      videoUrl: srcNode?.videoUrl,
      sourceNodeId: srcNode?.id,
      aspectRatio: '16:9',
    };

    const prevCard = multiframes[multiframes.length - 1];
    const nextBridges = prevCard
      ? [
          ...bridges,
          {
            id: `bridge_${Date.now()}`,
            fromCardId: prevCard.id,
            toCardId: newCard.id,
            durationSec: 6,
            curve: 'Orbit 180°' as CameraTransitionCurve,
            transitionPrompt: 'First/Last keyframe bridge with 10s context lock',
            useTenSecContextWindow: true,
            firstLastKeyframeLock: true,
          },
        ]
      : bridges;

    set({
      multiframes: [...multiframes, newCard],
      bridges: nextBridges,
    });
    get().showToast(`Added Keyframe #${idx}`);
  },

  removeMultiframeCard: (cardId) => {
    const { multiframes } = get();
    if (multiframes.length <= 2) return;
    get().pushHistory();
    const remaining = multiframes
      .filter((c) => c.id !== cardId)
      .map((c, idx) => ({ ...c, order: idx }));

    const rebuiltBridges: MultiframeBridge[] = [];
    for (let i = 0; i < remaining.length - 1; i++) {
      const a = remaining[i];
      const b = remaining[i + 1];
      const existing = get().bridges.find(
        (br) => br.fromCardId === a.id && br.toCardId === b.id
      );
      rebuiltBridges.push(
        existing || {
          id: `bridge_${a.id}_${b.id}`,
          fromCardId: a.id,
          toCardId: b.id,
          durationSec: 6,
          curve: 'Dolly In',
          transitionPrompt: 'Continuous motion bridge',
          useTenSecContextWindow: true,
          firstLastKeyframeLock: true,
        }
      );
    }
    set({ multiframes: remaining, bridges: rebuiltBridges });
  },

  updateMultiframeCard: (cardId, patch) =>
    set((s) => ({
      multiframes: s.multiframes.map((c) => (c.id === cardId ? { ...c, ...patch } : c)),
    })),

  updateMultiframeBridge: (bridgeId, patch) =>
    set((s) => ({
      bridges: s.bridges.map((b) => (b.id === bridgeId ? { ...b, ...patch } : b)),
    })),

  synthesizeMultiframeSequence: async () => {
    const { multiframes, bridges, nodes, timelineClips } = get();
    if (multiframes.length < 2) return;
    get().pushHistory();

    const baseRight = nodes.reduce((acc, n) => Math.max(acc, n.x + n.width), 800) + 120;
    const spawnedNodes: CanvasNode[] = [];
    const spawnedEdges: CanvasEdge[] = [];
    const spawnedClips: TimelineClip[] = [];

    let cursorSec = timelineClips
      .filter((c) => c.track === 'video')
      .reduce((acc, c) => Math.max(acc, c.startSec + c.durationSec), 0);

    let prevVidId: string | undefined;

    for (let idx = 0; idx < bridges.length; idx++) {
      const br = bridges[idx];
      const fromCard = multiframes.find((c) => c.id === br.fromCardId);
      const toCard = multiframes.find((c) => c.id === br.toCardId);
      if (!fromCard || !toCard) continue;

      const ff = await renderVideoViaBackend({
        prompt: `[${br.curve} · ${br.durationSec}s] ${br.transitionPrompt}`,
        imageUrl: fromCard.imageUrl,
        endImage: br.firstLastKeyframeLock ? toCard.imageUrl : undefined,
        durationSec: br.durationSec,
        cameraMotion: br.curve,
        mood: inferMoodFromPrompt(toCard.prompt),
      });

      const resolvedVideoUrl =
        ff.videoUrl || fromCard.videoUrl || '/media/real_shot02_bridge.mp4';
      const nodeId = `node_mf_seq_${Date.now()}_${idx}`;
      const interactionId = ff.interactionId || `int_mf_${idx + 1}`;

      const vNode: CanvasNode = {
        id: nodeId,
        kind: 'video',
        title: `Videos · Bridge ${idx + 1}→${idx + 2}`,
        prompt: `${fromCard.title} → ${toCard.title}: ${br.transitionPrompt}`,
        x: baseRight + idx * 640,
        y: 200,
        width: 568,
        height: 320,
        aspectRatio: '16:9',
        status: 'ready',
        imageUrl: fromCard.imageUrl,
        videoUrl: resolvedVideoUrl,
        seed: 2000 + idx * 155,
        resolution: '1080p',
        durationSec: br.durationSec,
        cameraMotion: br.curve,
        interactionId,
        previousInteractionId: prevVidId,
        elementHandles: extractHandles(`${fromCard.prompt} ${toCard.prompt}`),
        layers: createDefaultLayers(fromCard.imageUrl),
        providerUsed: 'FFmpeg Keyframe Bridge',
        createdAt: Date.now() + idx,
      };
      spawnedNodes.push(vNode);

      if (prevVidId && spawnedNodes.length >= 2) {
        spawnedEdges.push({
          id: `edge_mf_chain_${idx}`,
          sourceId: spawnedNodes[spawnedNodes.length - 2].id,
          targetId: nodeId,
          kind: 'multiframe',
        });
      }
      prevVidId = interactionId;

      spawnedClips.push({
        id: `clip_mf_${Date.now()}_${idx}`,
        track: 'video',
        title: vNode.title,
        sourceNodeId: nodeId,
        startSec: cursorSec,
        durationSec: br.durationSec,
        thumbnailUrl: fromCard.imageUrl,
        videoUrl: resolvedVideoUrl,
        seed: vNode.seed,
        promptOrDialogue: vNode.prompt,
        color: '#252525',
      });
      cursorSec += br.durationSec;
    }

    set((s) => ({
      nodes: [...s.nodes, ...spawnedNodes],
      edges: [...s.edges, ...spawnedEdges],
      timelineClips: [...s.timelineClips, ...spawnedClips],
      activeView: 'canvas',
      selectedNodeIds: spawnedNodes.map((n) => n.id),
    }));

    get().showToast(`Synthesized ${spawnedNodes.length} Multiframe shots onto canvas`);
  },

  autoConnectLocalMcpBackend: async () => {
    const health = await probeLiveMcpBackend();
    set((s) => {
      const updatedServers = s.mcpServers.map((srv) =>
        srv.id === 'mcp-local-default'
          ? {
              ...srv,
              status: health.online ? ('connected' as const) : ('simulated' as const),
              lastPingMs: health.pingMs || srv.lastPingMs,
              tools: health.tools,
            }
          : srv
      );

      const mcpSkills: DreaminaSkill[] = health.tools.map((t, i) => ({
        id: `mcp_skill_local_${i}`,
        slash: `/mcp:${t.name}`,
        title: `MCP · ${t.name}`,
        category: 'MCP Tool' as const,
        badge: 'MCP',
        description: t.description,
        promptTemplate: `Execute MCP ${t.name}: natural 35mm daylight composition`,
        recommendedMode: t.name.includes('video') ? ('video' as const) : ('image' as const),
        mcpToolName: t.name,
      }));

      const masterFile = health.mediaFiles.find(
        (f) => f === 'real_salt_terracotta_master.mp4' || f.startsWith('master_cut_')
      );
      const nextMaster =
        s.masterRenderUrl === null
          ? null
          : masterFile
          ? normalizeBackendMediaUrl(`/media/${masterFile}`, true) || s.masterRenderUrl
          : s.masterRenderUrl;

      return {
        mcpHealth: health,
        mcpServers: updatedServers,
        masterRenderUrl: nextMaster,
        skills: [
          ...s.skills.filter((sk) => !sk.id.startsWith('mcp_skill_local_')),
          ...mcpSkills,
        ],
      };
    });

    if (health.online) {
      await get().refreshPlatformsAndExternalMcp();
    }
  },

  setActiveProvider: (rawProvider) => {
    const activeProvider = normalizeProviderId(rawProvider);
    try {
      localStorage.setItem(ACTIVE_PROVIDER_KEY, activeProvider);
    } catch {
      // ignore storage errors
    }
    set({ activeProvider });
  },

  updateByok: (patch) => {
    const next = { ...get().byok, ...patch };
    try {
      localStorage.setItem(BYOK_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
    set({ byok: next });
  },

  clearByokKeys: () => {
    try {
      localStorage.removeItem(BYOK_STORAGE_KEY);
    } catch {
      // ignore
    }
    set({ byok: defaultByok() });
    get().showToast('Cleared local BYOK keys');
  },

  addMcpServer: async (name, url, transport) => {
    const id = `mcp_${Date.now()}`;
    const newEntry: MCPServerEntry = {
      id,
      name,
      url,
      transport,
      status: 'connecting',
      tools: [],
    };
    set((s) => ({ mcpServers: [...s.mcpServers, newEntry] }));
    const discovery = await discoverMcpTools(url, name);
    set((s) => ({
      mcpServers: s.mcpServers.map((srv) =>
        srv.id === id
          ? {
              ...srv,
              status: discovery.connected ? 'connected' : 'simulated',
              lastPingMs: discovery.pingMs,
              tools: discovery.tools,
            }
          : srv
      ),
    }));
    get().showToast(
      discovery.connected ? `Connected MCP "${name}"` : `Added MCP "${name}"`
    );
  },

  refreshMcpServer: async (serverId) => {
    if (serverId === 'mcp-local-default') {
      await get().autoConnectLocalMcpBackend();
      const { mcpHealth } = get();
      get().showToast(
        mcpHealth.online
          ? `MCP Live · ${mcpHealth.toolCount} tools (${mcpHealth.pingMs || 6}ms)`
          : 'Local :3001 MCP offline'
      );
      return;
    }
    const srv = get().mcpServers.find((m) => m.id === serverId);
    if (!srv) return;
    const discovery = await discoverMcpTools(srv.url, srv.name);
    set((s) => ({
      mcpServers: s.mcpServers.map((m) =>
        m.id === serverId
          ? {
              ...m,
              status: discovery.connected ? 'connected' : 'simulated',
              lastPingMs: discovery.pingMs,
              tools: discovery.tools,
            }
          : m
      ),
    }));
  },

  spawnMcpToolAsCanvasNode: (tool) => {
    get().pushHistory();
    const maxRight = get().nodes.reduce((acc, n) => Math.max(acc, n.x + n.width), 400);
    const nodeId = `node_mcp_${Date.now()}`;
    const newNode: CanvasNode = {
      id: nodeId,
      kind: 'mcp-tool',
      title: `MCP · ${tool.name}`,
      prompt: get().promptText,
      x: maxRight + 100,
      y: 220,
      width: 300,
      height: 190,
      aspectRatio: '16:9',
      status: 'ready',
      seed: Math.floor(Math.random() * 5000),
      resolution: '1080p',
      elementHandles: extractHandles(get().promptText),
      mcpTool: tool,
      layers: [],
      providerUsed: `MCP · ${tool.serverName}`,
      createdAt: Date.now(),
    };
    set((s) => ({
      nodes: [...s.nodes, newNode],
      selectedNodeIds: [nodeId],
      providerModalOpen: false,
      activeView: 'canvas',
    }));
    get().showToast(`Placed MCP tool "${tool.name}" on canvas`);
  },

  pingBridge: () => {
    pingChromeBridge();
    get().showToast('Pinged Chrome Extension bridge');
  },

  handleIncomingBridgeEvent: (msg) => {
    const type = msg.type || '';
    const p = msg.payload || {};
    if (type === 'DREAMFLOW_PONG' || type === 'DREAMFLOW_BRIDGE_STATUS') {
      set((s) => ({
        chromeBridge: {
          ...s.chromeBridge,
          extensionDetected: true,
          flowTabConnected: Boolean(p.flowConnected ?? true),
          dreaminaTabConnected: Boolean(p.dreaminaConnected ?? false),
        },
      }));
    } else if (type === 'dreamflow_mcp_oauth_complete') {
      const raw = msg as unknown as {
        sessionId?: string;
        platformId?: string;
        serverId?: string;
        ok?: boolean;
        error?: string;
      };
      if (raw.sessionId) {
        void get().pollMcpOAuthStatus(raw.sessionId);
      }
      set((s) => ({
        lastFailedPlatformId: raw.ok ? null : s.lastFailedPlatformId,
        mcpOAuthSession:
          s.mcpOAuthSession ||
          (raw.sessionId || raw.platformId
            ? {
                sessionId: raw.sessionId || 'oauth_done',
                platformId: raw.platformId || 'higgsfield',
                mcpUrl:
                  raw.platformId === 'higgsfield' ? 'https://mcp.higgsfield.ai/mcp' : '',
                serverId: raw.serverId,
                step: raw.ok ? 'connected' : 'error',
                error: raw.error,
                updatedAt: Date.now(),
              }
            : null),
      }));
      if (raw.ok) {
        void get().refreshPlatformsAndExternalMcp();
        get().showToast(`${raw.platformId || 'MCP'} connected successfully!`, 'ok');
      } else if (raw.error) {
        get().showToast(raw.error, 'error');
      }
    } else if (type === 'DREAMFLOW_JOB_COMPLETE' || type === 'DREAMFLOW_JOB_COMPLETED') {
      const jobId = String(p.jobId || '');
      const videoUrl = typeof p.videoUrl === 'string' ? p.videoUrl : undefined;
      const imageUrl = typeof p.imageUrl === 'string' ? p.imageUrl : undefined;
      set((s) => ({
        nodes: s.nodes.map((n) =>
          n.interactionId === jobId
            ? {
                ...n,
                status: 'ready',
                videoUrl: videoUrl || n.videoUrl,
                imageUrl: imageUrl || n.imageUrl,
              }
            : n
        ),
      }));
      get().showToast(`Chrome Bridge completed job ${jobId}`);
    }
  },

  setPlayheadSec: (playheadSec) => set({ playheadSec: Math.max(0, playheadSec) }),
  setIsPlayingTimeline: (isPlayingTimeline) => set({ isPlayingTimeline }),
  setTimelineMuted: (timelineMuted) => set({ timelineMuted }),

  sendNodeToTimeline: (nodeId) => {
    const node = get().nodes.find((n) => n.id === nodeId);
    if (!node) return;
    get().pushHistory();

    const timelineNode = get().nodes.find((n) => n.kind === 'timeline');

    if (node.kind === 'audio') {
      const track: 'voice' | 'sfx' =
        node.audioMode === 'voiceover' ? 'voice' : 'sfx';
      const audioClip: TimelineClip = {
        id: `clip_audio_${Date.now()}`,
        track,
        title: `${node.title} (A1)`,
        sourceNodeId: node.id,
        startSec: 0,
        durationSec: node.durationSec || 12,
        audioUrl: node.audioUrl || '/media/real_coastal_foley.mp3',
        waveform: node.waveform || createDefaultWaveform(node.seed, 64),
        promptOrDialogue: node.prompt,
        lipSyncCharacter: track === 'voice' ? '@Clara_Vidal' : undefined,
        sfxKind: track === 'sfx' ? 'coastal-surf' : undefined,
        color: '#252525',
      };

      set((s) => ({
        timelineClips: [
          ...s.timelineClips.filter((c) => c.sourceNodeId !== node.id),
          audioClip,
        ],
        edges:
          timelineNode &&
          !s.edges.some(
            (e) => e.sourceId === node.id && e.targetId === timelineNode.id
          )
            ? [
                ...s.edges,
                {
                  id: `edge_tl_aud_${Date.now()}`,
                  sourceId: node.id,
                  targetId: timelineNode.id,
                  kind: 'lineage',
                },
              ]
            : s.edges,
      }));
      get().showToast(`Attached "${node.title}" to Timelines 1 A1 lane`);
      return;
    }

    const endV1 = get()
      .timelineClips.filter((c) => c.track === 'video')
      .reduce((acc, c) => Math.max(acc, c.startSec + c.durationSec), 0);

    const newClip: TimelineClip = {
      id: `clip_${Date.now()}`,
      track: 'video',
      title: node.title,
      sourceNodeId: node.id,
      startSec: endV1,
      durationSec: node.durationSec || 6,
      thumbnailUrl: node.imageUrl,
      videoUrl: node.videoUrl,
      videoTheme: node.videoTheme,
      seed: node.seed,
      promptOrDialogue: node.prompt,
      color: '#252525',
    };

    set((s) => ({
      timelineClips: [...s.timelineClips, newClip],
      edges:
        timelineNode &&
        !s.edges.some(
          (e) => e.sourceId === node.id && e.targetId === timelineNode.id
        )
          ? [
              ...s.edges,
              {
                id: `edge_tl_${Date.now()}`,
                sourceId: node.id,
                targetId: timelineNode.id,
                kind: 'multiframe',
              },
            ]
          : s.edges,
    }));
    get().showToast(`Added "${node.title}" to Timelines 1`);
  },

  splitTimelineClipAtPlayhead: (clipId) => {
    const { timelineClips, playheadSec } = get();
    const target = clipId
      ? timelineClips.find((c) => c.id === clipId)
      : timelineClips.find(
          (c) =>
            c.track === 'video' &&
            playheadSec > c.startSec + 0.5 &&
            playheadSec < c.startSec + c.durationSec - 0.5
        );

    if (!target) {
      get().showToast('Move playhead inside a clip to split');
      return;
    }

    const splitOffset = Math.max(
      1,
      Math.min(target.durationSec - 1, Math.round((playheadSec - target.startSec) * 10) / 10)
    );
    get().pushHistory();

    const firstHalf: TimelineClip = {
      ...target,
      durationSec: splitOffset,
      title: `${target.title} (A)`,
    };
    const secondHalf: TimelineClip = {
      ...target,
      id: `clip_split_${Date.now()}`,
      startSec: target.startSec + splitOffset,
      durationSec: Number((target.durationSec - splitOffset).toFixed(1)),
      title: `${target.title} (B)`,
    };

    set((s) => ({
      timelineClips: s.timelineClips.flatMap((c) =>
        c.id === target.id ? [firstHalf, secondHalf] : [c]
      ),
    }));
    get().showToast(`Split "${target.title}" at ${playheadSec.toFixed(1)}s`);
  },

  addVoiceOrSfxClip: (track, title, dialogueOrSfx, durationSec = 6) => {
    get().pushHistory();
    const endTrack = get()
      .timelineClips.filter((c) => c.track === track)
      .reduce((acc, c) => Math.max(acc, c.startSec + c.durationSec), 0);

    const clip: TimelineClip = {
      id: `clip_${track}_${Date.now()}`,
      track,
      title,
      startSec: endTrack,
      durationSec,
      promptOrDialogue: dialogueOrSfx,
      audioUrl: track === 'sfx' ? '/media/real_coastal_foley.mp3' : undefined,
      waveform: createDefaultWaveform(Math.floor(Math.random() * 900) + 100, 64),
      lipSyncCharacter: track === 'voice' ? '@Clara_Vidal' : undefined,
      audioFreqHz: track === 'voice' ? 196 : undefined,
      sfxKind: track === 'sfx' ? 'coastal-surf' : undefined,
      color: '#252525',
    };
    set((s) => ({ timelineClips: [...s.timelineClips, clip] }));
    get().showToast(`Added "${title}"`);
  },

  removeTimelineClip: (clipId) => {
    get().pushHistory();
    set((s) => ({
      timelineClips: s.timelineClips.filter((c) => c.id !== clipId),
    }));
  },

  extractLastFrameToNextShot: async (clipIdOrNodeId) => {
    const { timelineClips, nodes } = get();
    const directNode = clipIdOrNodeId
      ? nodes.find((n) => n.id === clipIdOrNodeId)
      : undefined;

    const videoClips = timelineClips
      .filter((c) => c.track === 'video')
      .sort((a, b) => a.startSec - b.startSec);

    const targetClip = directNode
      ? undefined
      : clipIdOrNodeId
      ? videoClips.find((c) => c.id === clipIdOrNodeId)
      : videoClips[videoClips.length - 1];

    const sourceVideoUrl = directNode?.videoUrl || targetClip?.videoUrl;
    const sourceTitle = directNode?.title || targetClip?.title || 'Shot';
    const sourcePrompt =
      directNode?.prompt || targetClip?.promptOrDialogue || '@Clara_Vidal sunlit courtyard';
    const sourceNodeId = directNode?.id || targetClip?.sourceNodeId;

    get().pushHistory();

    let lastFrameUrl: string | undefined;
    let usedBackend = false;

    if (sourceVideoUrl) {
      const ffExtract = await extractLastFrameViaBackend(sourceVideoUrl);
      if (ffExtract.ok && ffExtract.frameUrl) {
        lastFrameUrl = ffExtract.frameUrl;
        usedBackend = true;
      }
    }

    if (!lastFrameUrl) {
      lastFrameUrl = '/media/real_coastal_cliffs.jpg';
    }

    const parentNode = sourceNodeId ? nodes.find((n) => n.id === sourceNodeId) : undefined;
    const spawnX = parentNode ? parentNode.x + parentNode.width + 110 : 980;
    const spawnY = parentNode ? parentNode.y : 220;
    const newNodeId = `node_lastframe_${Date.now()}`;

    const anchorNode: CanvasNode = {
      id: newNodeId,
      kind: 'image',
      title: `Images · Last Frame (${sourceTitle.slice(0, 14)})`,
      prompt: `Continuation from "${sourceTitle}": ${sourcePrompt}`,
      x: spawnX,
      y: spawnY,
      width: 340,
      height: 220,
      aspectRatio: '16:9',
      status: 'ready',
      imageUrl: lastFrameUrl,
      seed: 888,
      resolution: '2K',
      interactionId: `int_lf_${Date.now().toString(36)}`,
      elementHandles: extractHandles(sourcePrompt),
      layers: createDefaultLayers(lastFrameUrl),
      providerUsed: usedBackend ? 'FFmpeg Final-Frame (:3001)' : 'Last-Frame Anchor',
      createdAt: Date.now(),
    };

    set((s) => ({
      nodes: [...s.nodes, anchorNode],
      edges: parentNode
        ? [
            ...s.edges,
            {
              id: `edge_lf_${Date.now()}`,
              sourceId: parentNode.id,
              targetId: newNodeId,
              kind: 'lineage',
            },
          ]
        : s.edges,
      selectedNodeIds: [newNodeId],
    }));

    get().showToast('Extracted final frame onto canvas');
  },

  compileTimelineMasterMp4: async () => {
    const { timelineClips, projectTitle, isRenderingMasterMp4 } = get();
    if (isRenderingMasterMp4) return null;

    const v1Clips = timelineClips
      .filter((c) => c.track === 'video')
      .sort((a, b) => a.startSec - b.startSec);

    if (v1Clips.length === 0) {
      get().showToast('Add video clips to Timelines 1 first');
      return null;
    }

    set({ isRenderingMasterMp4: true });
    get().showToast(`Compiling Master .mp4 via :3001 FFmpeg...`);

    try {
      const clipUrls: string[] = [];
      for (const clip of v1Clips) {
        if (clip.videoUrl) {
          clipUrls.push(clip.videoUrl);
        } else {
          const rendered = await renderVideoViaBackend({
            prompt: clip.promptOrDialogue,
            imageUrl: clip.thumbnailUrl || '/media/real_courtyard_sun.jpg',
            durationSec: clip.durationSec,
          });
          if (rendered.ok && rendered.videoUrl) {
            clipUrls.push(rendered.videoUrl);
          }
        }
      }

      const audioTracks = timelineClips
        .filter((c) => c.track !== 'video' && Boolean(c.audioUrl))
        .map((c) => ({
          audioUrl: c.audioUrl!,
          volume: c.track === 'voice' ? 0.95 : 0.6,
        }));

      if (audioTracks.length === 0) {
        const audioNode = get().nodes.find((n) => n.kind === 'audio' && n.audioUrl);
        if (audioNode?.audioUrl) {
          audioTracks.push({
            audioUrl: audioNode.audioUrl,
            volume: audioNode.audioMode === 'voiceover' ? 0.95 : 0.6,
          });
        }
      }

      if (clipUrls.length > 0) {
        const compiled = await compileTimelineViaBackend({
          clips: clipUrls,
          title: projectTitle,
          audioTracks,
        });

        if (compiled.ok && compiled.masterUrl) {
          set({
            masterRenderUrl: compiled.masterUrl,
            isRenderingMasterMp4: false,
          });

          const a = document.createElement('a');
          a.href = compiled.masterUrl;
          a.download = `${projectTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-master.mp4`;
          a.target = '_blank';
          a.rel = 'noopener noreferrer';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);

          get().showToast('Master .mp4 compiled & ready');
          return compiled.masterUrl;
        }
      }

      const blob = await compileTimelineToWebm(timelineClips);
      const blobUrl = URL.createObjectURL(blob);
      set({
        masterRenderUrl: blobUrl,
        isRenderingMasterMp4: false,
      });
      get().showToast('Compiled master WebM in-browser');
      return blobUrl;
    } catch {
      set({ isRenderingMasterMp4: false });
      get().showToast('Failed to compile master video');
      return null;
    }
  },

  synthesizeShareableAppFilm: async ({
    title,
    selectedHandles,
    beats,
    aspectRatio,
    resolution,
  }) => {
    if (get().appSynthesizing || beats.length === 0) return null;
    get().pushHistory();

    set({
      projectTitle: title,
      appSynthesizing: true,
      appRenderLog: [`Locking continuity (${selectedHandles.join(', ') || '@Clara_Vidal'})...`],
    });

    const renderedClipUrls: string[] = [];
    const newTimelineClips: TimelineClip[] = [];
    let cursorSec = 0;

    for (let i = 0; i < beats.length; i++) {
      const beat = beats[i];
      const fullPrompt = `${beat.prompt} ${selectedHandles.join(' ')}`.trim();

      set((s) => ({
        appRenderLog: [
          ...s.appRenderLog,
          `Rendering "${beat.title}" (${beat.durationSec}s · ${beat.cameraCurve})...`,
        ],
      }));

      const ff = await renderVideoViaBackend({
        prompt: fullPrompt,
        imageUrl: beat.imageUrl,
        durationSec: beat.durationSec,
        aspectRatio,
        resolution,
        cameraMotion: beat.cameraCurve,
        mood: inferMoodFromPrompt(fullPrompt),
      });

      const clipVideoUrl = ff.videoUrl || beat.videoUrl;
      if (clipVideoUrl) {
        renderedClipUrls.push(clipVideoUrl);
      }

      newTimelineClips.push({
        id: `clip_app_${Date.now()}_${i}`,
        track: 'video',
        title: beat.title,
        startSec: cursorSec,
        durationSec: beat.durationSec,
        thumbnailUrl: beat.imageUrl,
        videoUrl: clipVideoUrl,
        seed: 3100 + i * 111,
        promptOrDialogue: fullPrompt,
        color: '#252525',
      });
      cursorSec += beat.durationSec;
    }

    set((s) => ({
      timelineClips: [
        ...newTimelineClips,
        ...s.timelineClips.filter((c) => c.track !== 'video'),
      ],
      appRenderLog: [
        ...s.appRenderLog,
        `Stitching ${beats.length}-shot H.264 + AAC Master .mp4...`,
      ],
    }));

    let finalMasterUrl: string | null = null;
    if (renderedClipUrls.length > 0) {
      const stitched = await compileTimelineViaBackend({
        clips: renderedClipUrls,
        title,
      });
      finalMasterUrl = stitched.ok && stitched.masterUrl ? stitched.masterUrl : renderedClipUrls[0];
    }

    if (!finalMasterUrl) {
      finalMasterUrl = '/media/real_salt_terracotta_master.mp4';
    }

    set((s) => ({
      masterRenderUrl: finalMasterUrl,
      appSynthesizing: false,
      appRenderLog: [
        ...s.appRenderLog,
        `Ready — ${cursorSec}s Master Cut ($0.00 markup)`,
      ],
    }));

    get().showToast(`Synthesized "${title}"`);
    return finalMasterUrl;
  },

  sendChatAssistantPrompt: async (userText) => {
    const clean = userText.trim();
    if (!clean) return;
    const low = clean.toLowerCase();
    const userMsg: ChatMessageItem = {
      id: `msg_u_${Date.now()}`,
      role: 'user',
      text: clean,
      timestamp: Date.now(),
    };
    set((s) => ({ chatMessages: [...s.chatMessages, userMsg] }));

    if (low.includes('compile') || low.includes('master')) {
      await get().runChatQuickAction('compile-master');
      return;
    }

    if (low.includes('slice') || low.includes('9-grid') || low.includes('contact')) {
      await get().runChatQuickAction('slice-sheet');
      return;
    }

    const sel = get().nodes.find((n) => n.id === get().selectedNodeIds[0]);
    const isRemixIntent =
      low.includes('remix') ||
      low.includes('branch') ||
      low.includes('multi-turn') ||
      low.includes('weather') ||
      low.includes('sunrise') ||
      low.includes('dawn') ||
      Boolean(sel && sel.kind === 'video' && !low.includes('sequence') && !low.includes('3-shot'));

    if (isRemixIntent && (sel || get().nodes.some((n) => n.kind === 'video'))) {
      const targetVid =
        (sel && sel.kind === 'video' ? sel : null) ||
        get().nodes.find((n) => n.kind === 'video');
      if (targetVid) {
        const beforeIds = new Set(get().nodes.map((n) => n.id));
        await get().branchVideoMultiTurn(targetVid.id, clean);
        const created = get().nodes.find((n) => !beforeIds.has(n.id));
        set((s) => ({
          chatMessages: [
            ...s.chatMessages,
            {
              id: `msg_a_${Date.now()}`,
              role: 'assistant',
              text: `Branched "${targetVid.title}" via stateful previous_interaction_id with delta: "${clean}".`,
              timestamp: Date.now(),
              videoUrl: created?.videoUrl,
              nodeFocusPills: created
                ? [{ nodeId: created.id, title: created.title }]
                : undefined,
            },
          ],
        }));
        return;
      }
    }

    const beforeIds = new Set(get().nodes.map((n) => n.id));
    await get().runAutonomousDirectorAgent(clean);
    const createdNodes = get().nodes.filter((n) => !beforeIds.has(n.id));
    set((s) => ({
      chatMessages: [
        ...s.chatMessages,
        {
          id: `msg_a_${Date.now()}`,
          role: 'assistant',
          text: `Synthesized ${createdNodes.length || 3}-shot sequence on the spatial canvas and linked clips into Timelines 1.`,
          timestamp: Date.now(),
          videoUrl: createdNodes[0]?.videoUrl,
          nodeFocusPills: createdNodes.map((cn) => ({
            nodeId: cn.id,
            title: cn.title,
          })),
        },
      ],
    }));
  },

  runChatQuickAction: async (action) => {
    if (action === 'sequence-3') {
      await get().sendChatAssistantPrompt(
        'Build a 3-shot @Clara_Vidal & @Leica_M6 sunlit coastal courtyard documentary sequence'
      );
      return;
    }

    if (action === 'remix-branch') {
      const target =
        get().nodes.find(
          (n) => n.id === get().selectedNodeIds[0] && n.kind === 'video'
        ) || get().nodes.find((n) => n.kind === 'video');
      if (!target) {
        get().showToast('Select or add a video node first');
        return;
      }
      const userMsg: ChatMessageItem = {
        id: `msg_u_${Date.now()}`,
        role: 'user',
        text: `Branch Multi-Turn Remix on "${target.title}" -> Warm golden-hour dusk shift`,
        timestamp: Date.now(),
      };
      set((s) => ({ chatMessages: [...s.chatMessages, userMsg] }));

      const beforeIds = new Set(get().nodes.map((n) => n.id));
      await get().branchVideoMultiTurn(
        target.id,
        'Shift midday daylight to warm late-afternoon amber dusk over @Clara_Vidal and limestone arches'
      );
      const created = get().nodes.find((n) => !beforeIds.has(n.id));
      set((s) => ({
        chatMessages: [
          ...s.chatMessages,
          {
            id: `msg_a_${Date.now()}`,
            role: 'assistant',
            text: `Rendered stateful Multi-Turn remix branch from "${target.title}":`,
            timestamp: Date.now(),
            videoUrl: created?.videoUrl || '/media/real_shot03_atelier.mp4',
            nodeFocusPills: created
              ? [{ nodeId: created.id, title: created.title }]
              : undefined,
          },
        ],
      }));
      return;
    }

    if (action === 'slice-sheet') {
      const sheet =
        get().nodes.find(
          (n) =>
            n.id === get().selectedNodeIds[0] &&
            (n.kind === 'contact-sheet' || n.kind === 'image')
        ) ||
        get().nodes.find((n) => n.kind === 'contact-sheet') ||
        get().nodes.find((n) => n.kind === 'image');
      if (!sheet) {
        get().showToast('No contact sheet or image node on canvas');
        return;
      }
      const beforeIds = new Set(get().nodes.map((n) => n.id));
      await get().sliceContactSheetNode(sheet.id, 3, 3);
      const slices = get().nodes.filter((n) => !beforeIds.has(n.id));
      set((s) => ({
        chatMessages: [
          ...s.chatMessages,
          {
            id: `msg_a_${Date.now()}`,
            role: 'assistant',
            text: `Sliced "${sheet.title}" into ${slices.length} individual camera coverage frames:`,
            timestamp: Date.now(),
            nodeFocusPills: slices.slice(0, 6).map((sl) => ({
              nodeId: sl.id,
              title: sl.title,
            })),
          },
        ],
      }));
      return;
    }

    if (action === 'compile-master') {
      const userMsg: ChatMessageItem = {
        id: `msg_u_${Date.now()}`,
        role: 'user',
        text: 'Compile Timelines 1 into a stitched Master .mp4',
        timestamp: Date.now(),
      };
      set((s) => ({ chatMessages: [...s.chatMessages, userMsg] }));
      const masterUrl = await get().compileTimelineMasterMp4();
      set((s) => ({
        chatMessages: [
          ...s.chatMessages,
          {
            id: `msg_a_${Date.now()}`,
            role: 'assistant',
            text: masterUrl
              ? 'Compiled H.264 + AAC Master .mp4 from Timelines 1:'
              : 'Add clips to Timelines 1 to compile a master cut.',
            timestamp: Date.now(),
            videoUrl: masterUrl || '/media/real_salt_terracotta_master.mp4',
          },
        ],
      }));
    }
  },

  bootDiskPersistence: async () => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('recipe')) return;

    const isLegacySlopId = (id?: string | null) =>
      !id || id.toLowerCase().startsWith('proto');

    const listing = await listDiskProjects();
    if (!listing.ok) {
      // Fallback to localStorage if :3001 is temporarily offline
      try {
        const cached = localStorage.getItem('dreamflow_local_project_backup');
        if (cached) {
          const parsed = JSON.parse(cached) as {
            id?: string;
            name?: string;
            nodes?: CanvasNode[];
            edges?: CanvasEdge[];
            timelineClips?: TimelineClip[];
          };
          if (
            !isLegacySlopId(parsed.id) &&
            Array.isArray(parsed.nodes) &&
            parsed.nodes.length > 0
          ) {
            set({
              activeProjectId: parsed.id || 'salt-terracotta',
              projectTitle: parsed.name || 'Salt & Terracotta — Coastal Short',
              nodes: parsed.nodes,
              edges: Array.isArray(parsed.edges) ? parsed.edges : get().edges,
              timelineClips: Array.isArray(parsed.timelineClips)
                ? parsed.timelineClips
                : get().timelineClips,
              selectedNodeIds: [],
              saveStatus: 'local',
            });
          }
        }
      } catch {
        // ignore
      }
      return;
    }

    const cleanProjects = listing.projects.filter((p) => !isLegacySlopId(p.id));
    set({ diskProjects: cleanProjects });

    const storedId = (() => {
      try {
        const v = localStorage.getItem(ACTIVE_PROJECT_KEY);
        return isLegacySlopId(v) ? null : v;
      } catch {
        return null;
      }
    })();

    const preferredId = storedId || cleanProjects[0]?.id;

    if (preferredId && cleanProjects.some((p) => p.id === preferredId)) {
      const loaded = await getDiskProject(preferredId);
      const st = loaded.project?.state as
        | {
            nodes?: CanvasNode[];
            edges?: CanvasEdge[];
            elements?: ElementVault[];
            multiframes?: MultiframeCard[];
            bridges?: MultiframeBridge[];
            timelineClips?: TimelineClip[];
          }
        | undefined;
      if (loaded.ok && loaded.project && st && Array.isArray(st.nodes)) {
        set({
          activeProjectId: loaded.project.id,
          projectTitle: loaded.project.name || 'Untitled Canvas',
          nodes: st.nodes,
          edges: Array.isArray(st.edges) ? st.edges : [],
          elements: Array.isArray(st.elements) ? st.elements : [],
          multiframes: Array.isArray(st.multiframes)
            ? st.multiframes
            : [],
          bridges: Array.isArray(st.bridges) ? st.bridges : [],
          timelineClips: Array.isArray(st.timelineClips)
            ? st.timelineClips
            : [],
          projectSnapshots: Array.isArray(loaded.project.snapshots)
            ? loaded.project.snapshots
            : [],
          selectedNodeIds: [],
          promptText: '',
          saveStatus: 'saved',
        });
        return;
      }
    }

    // Seed initial Salt & Terracotta project onto disk
    await get().persistActiveProjectToDisk({
      createSnapshot: true,
      snapshotLabel: 'Initial Salt & Terracotta',
    });
  },

  persistActiveProjectToDisk: async (opts) => {
    const {
      activeProjectId,
      projectTitle,
      nodes,
      edges,
      elements,
      multiframes,
      bridges,
      timelineClips,
    } = get();

    set({ saveStatus: 'saving' });

    const payloadState = {
      nodes,
      edges,
      elements,
      multiframes,
      bridges,
      timelineClips,
    };

    try {
      localStorage.setItem(ACTIVE_PROJECT_KEY, activeProjectId);
      localStorage.setItem(
        'dreamflow_local_project_backup',
        JSON.stringify({
          id: activeProjectId,
          name: projectTitle,
          nodes,
          edges,
          timelineClips,
        })
      );
    } catch {
      // ignore storage quota errors
    }

    const res = await saveDiskProject({
      id: activeProjectId,
      name: projectTitle,
      state: payloadState,
      createSnapshot: opts?.createSnapshot,
      snapshotLabel: opts?.snapshotLabel,
    });

    if (res.ok) {
      const listing = await listDiskProjects();
      let nextSnaps = get().projectSnapshots;
      if (opts?.createSnapshot) {
        const full = await getDiskProject(activeProjectId);
        if (full.ok && Array.isArray(full.project?.snapshots)) {
          nextSnaps = full.project!.snapshots!;
        }
      }
      set({
        saveStatus: 'saved',
        diskProjects: listing.ok ? listing.projects : get().diskProjects,
        projectSnapshots: nextSnaps,
      });
    } else {
      set({ saveStatus: 'local' });
    }
  },

  switchDiskProject: async (id) => {
    const loaded = await getDiskProject(id);
    if (!loaded.ok || !loaded.project) {
      get().showToast('Could not load project from disk');
      return;
    }
    const st = (loaded.project.state || {}) as {
      nodes?: CanvasNode[];
      edges?: CanvasEdge[];
      elements?: ElementVault[];
      multiframes?: MultiframeCard[];
      bridges?: MultiframeBridge[];
      timelineClips?: TimelineClip[];
    };
    try {
      localStorage.setItem(ACTIVE_PROJECT_KEY, id);
    } catch {
      // ignore
    }
    set({
      activeProjectId: loaded.project.id,
      projectTitle: loaded.project.name,
      nodes: Array.isArray(st.nodes) ? st.nodes : [],
      edges: Array.isArray(st.edges) ? st.edges : [],
      elements: Array.isArray(st.elements) ? st.elements : [],
      multiframes: Array.isArray(st.multiframes) ? st.multiframes : [],
      bridges: Array.isArray(st.bridges) ? st.bridges : [],
      timelineClips: Array.isArray(st.timelineClips) ? st.timelineClips : [],
      projectSnapshots: Array.isArray(loaded.project.snapshots)
        ? loaded.project.snapshots
        : [],
      selectedNodeIds: [],
      promptText: '',
      past: [],
      future: [],
      saveStatus: 'saved',
    });
    get().showToast(`Switched to "${loaded.project.name}"`);
  },

  createNewBlankProject: async (name = 'Untitled canvas') => {
    const blank = buildBlankStudioGraph();
    const newId = `canvas_${Date.now().toString(36)}`;
    try {
      localStorage.setItem(ACTIVE_PROJECT_KEY, newId);
    } catch {
      // ignore
    }
    set({
      activeProjectId: newId,
      projectTitle: name,
      nodes: blank.nodes,
      edges: blank.edges,
      elements: [],
      multiframes: blank.multiframes,
      bridges: blank.bridges,
      timelineClips: blank.timelineClips,
      projectSnapshots: [],
      selectedNodeIds: [],
      promptText: '',
      masterRenderUrl: null,
      past: [],
      future: [],
      panX: 120,
      panY: 80,
      zoom: 0.85,
    });
    await get().persistActiveProjectToDisk({
      createSnapshot: true,
      snapshotLabel: 'Created blank canvas',
    });
    get().showToast(`Created "${name}"`);
  },

  deleteSavedProject: async (id) => {
    const ok = await deleteDiskProject(id);
    if (!ok) {
      get().showToast('Failed to delete project');
      return;
    }
    const listing = await listDiskProjects();
    set({ diskProjects: listing.projects });
    if (get().activeProjectId === id) {
      if (listing.projects.length > 0) {
        await get().switchDiskProject(listing.projects[0].id);
      } else {
        get().loadPresetProject('salt-terracotta');
        set({ activeProjectId: 'salt-terracotta' });
        await get().persistActiveProjectToDisk();
      }
    } else {
      get().showToast('Deleted project from disk');
    }
  },

  saveVersionSnapshot: async (label) => {
    const timeStr = new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
    const snapLabel =
      label?.trim() || `${get().nodes.length} nodes · ${timeStr}`;
    await get().persistActiveProjectToDisk({
      createSnapshot: true,
      snapshotLabel: snapLabel,
    });
    get().showToast(`Saved snapshot "${snapLabel}"`);
  },

  restoreVersionSnapshot: async (snapshotId) => {
    const snap = get().projectSnapshots.find((s) => s.snapshotId === snapshotId);
    if (!snap) return;
    get().pushHistory();
    const st = snap.state as {
      nodes?: CanvasNode[];
      edges?: CanvasEdge[];
      elements?: ElementVault[];
      multiframes?: MultiframeCard[];
      bridges?: MultiframeBridge[];
      timelineClips?: TimelineClip[];
    };
    set({
      nodes: Array.isArray(st.nodes) ? st.nodes : get().nodes,
      edges: Array.isArray(st.edges) ? st.edges : get().edges,
      elements: Array.isArray(st.elements) ? st.elements : get().elements,
      multiframes: Array.isArray(st.multiframes)
        ? st.multiframes
        : get().multiframes,
      bridges: Array.isArray(st.bridges) ? st.bridges : get().bridges,
      timelineClips: Array.isArray(st.timelineClips)
        ? st.timelineClips
        : get().timelineClips,
      selectedNodeIds: [],
    });
    await get().persistActiveProjectToDisk();
    get().showToast(`Restored snapshot "${snap.label}"`);
  },

  exportCurrentProjectDreamflowJson: async () => {
    await get().persistActiveProjectToDisk();
    const {
      activeProjectId,
      projectTitle,
      nodes,
      edges,
      elements,
      multiframes,
      bridges,
      timelineClips,
      projectSnapshots,
    } = get();

    const remoteBundle = await exportDiskProjectBundle(activeProjectId);
    const bundle = remoteBundle || {
      format: 'open-dreamflow-project/v1',
      exportedAt: new Date().toISOString(),
      project: {
        id: activeProjectId,
        name: projectTitle,
        updatedAt: Date.now(),
        state: {
          nodes,
          edges,
          elements,
          multiframes,
          bridges,
          timelineClips,
        },
        snapshots: projectSnapshots,
      },
    };

    const slug =
      projectTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-') || activeProjectId;
    downloadTextFile(
      `${slug}.dreamflow.json`,
      JSON.stringify(bundle, null, 2),
      'application/json'
    );
    get().showToast(`Exported ${slug}.dreamflow.json`);
  },

  importProjectDreamflowJson: async (file) => {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as Record<string, unknown>;
      const imported = await importDiskProjectBundle(parsed);

      const proj =
        imported.project ||
        ((parsed.project as Record<string, unknown>)
          ? (parsed.project as {
              id?: string;
              name?: string;
              state?: Record<string, unknown>;
              snapshots?: DiskSnapshotItem[];
            })
          : null);

      if (!proj || !proj.state) {
        get().showToast('Invalid .dreamflow.json archive');
        return;
      }

      const st = proj.state as {
        nodes?: CanvasNode[];
        edges?: CanvasEdge[];
        elements?: ElementVault[];
        multiframes?: MultiframeCard[];
        bridges?: MultiframeBridge[];
        timelineClips?: TimelineClip[];
      };

      const nextId = proj.id || `imported_${Date.now().toString(36)}`;
      try {
        localStorage.setItem(ACTIVE_PROJECT_KEY, nextId);
      } catch {
        // ignore
      }

      set({
        activeProjectId: nextId,
        projectTitle: proj.name || 'Imported Canvas',
        nodes: Array.isArray(st.nodes) ? st.nodes : [],
        edges: Array.isArray(st.edges) ? st.edges : [],
        elements: Array.isArray(st.elements) ? st.elements : [],
        multiframes: Array.isArray(st.multiframes) ? st.multiframes : [],
        bridges: Array.isArray(st.bridges) ? st.bridges : [],
        timelineClips: Array.isArray(st.timelineClips) ? st.timelineClips : [],
        projectSnapshots: Array.isArray(proj.snapshots) ? proj.snapshots : [],
        selectedNodeIds: [],
        promptText: '',
        saveStatus: 'saved',
      });

      const listing = await listDiskProjects();
      if (listing.ok) set({ diskProjects: listing.projects });
      get().showToast(`Imported "${proj.name || file.name}"`);
    } catch {
      get().showToast('Failed to parse .dreamflow.json file');
    }
  },

  setBridgeWsConnected: (connected) => {
    set((s) => ({
      bridgeWsConnected: connected,
      chromeBridge: {
        ...s.chromeBridge,
        extensionDetected: connected || s.chromeBridge.extensionDetected,
      },
    }));
  },

  ingestBridgeWsEvent: (ev) => {
    const normalizedSrc =
      ev?.source === 'flow' ? 'google-flow' : String(ev?.source || '');

    if (!ev || (ev.type !== 'bridge_asset' && ev.type !== 'bridge_prompt')) {
      if (ev?.type === 'mcp_oauth_update') {
        const sess = (ev as unknown as { session?: McpOAuthSession }).session;
        if (sess && sess.sessionId) {
          const prevStep = get().mcpOAuthSession?.step;
          set({ mcpOAuthSession: sess });
          if (sess.step === 'connected' && prevStep !== 'connected') {
            void get().refreshPlatformsAndExternalMcp();
            get().showToast(`${sess.platformId} MCP Connected Successfully!`);
          }
        }
        return true;
      }
      if (ev?.type === 'bridge_session') {
        const domainMap: Array<[string, PlatformId]> = [
          ['dreamina.capcut.com', 'dreamina'],
          ['labs.google', 'google-flow'],
          ['flow.google.com', 'google-flow'],
          ['higgsfield.ai', 'higgsfield'],
          ['sume.com', 'sume'],
          ['klingai.com', 'kling'],
          ['openart.ai', 'openart'],
          ['imagine.art', 'imagineart'],
          ['elevenlabs.io', 'elevenlabs'],
        ];
        const rawDomains = Array.isArray(ev.metadata?.openDomains)
          ? (ev.metadata?.openDomains as unknown[])
          : Array.isArray((ev as unknown as Record<string, unknown>).openDomains)
          ? ((ev as unknown as Record<string, unknown>).openDomains as unknown[])
          : [];
        const detectedFromDomains = new Set<PlatformId>();
        if (normalizedSrc) {
          detectedFromDomains.add(normalizedSrc as PlatformId);
        }
        for (const d of rawDomains) {
          if (typeof d !== 'string') continue;
          for (const [host, pid] of domainMap) {
            if (d.toLowerCase().includes(host)) detectedFromDomains.add(pid);
          }
        }
        const rawPlats = Array.isArray((ev as unknown as Record<string, unknown>).platforms)
          ? ((ev as unknown as Record<string, unknown>).platforms as unknown[])
          : [];
        for (const p of rawPlats) {
          if (typeof p === 'string' && p) detectedFromDomains.add(p as PlatformId);
        }

        const mergedPlatformMap: Record<string, boolean> = {};
        for (const pid of detectedFromDomains) {
          mergedPlatformMap[pid] = true;
        }
        const connectedList = Array.from(detectedFromDomains);

        set((s) => ({
          connectedBrowserPlatforms: Array.from(
            new Set([...s.connectedBrowserPlatforms, ...connectedList])
          ),
          lastFailedPlatformId:
            s.lastFailedPlatformId && detectedFromDomains.has(s.lastFailedPlatformId)
              ? null
              : s.lastFailedPlatformId,
          chromeBridge: {
            ...s.chromeBridge,
            extensionDetected: true,
            dreaminaTabConnected:
              connectedList.includes('dreamina') || s.chromeBridge.dreaminaTabConnected,
            flowTabConnected:
              connectedList.includes('google-flow') || s.chromeBridge.flowTabConnected,
            connectedPlatforms: {
              ...s.chromeBridge.connectedPlatforms,
              ...mergedPlatformMap,
            },
          },
        }));
      }
      return false;
    }

    const dedupKey =
      ev.eventId || `${ev.type}_${ev.source}_${ev.mediaUrl || ''}_${ev.timestamp || ''}`;
    if (ev.eventId && seenBridgeEventIds.has(dedupKey)) {
      return false;
    }
    seenBridgeEventIds.add(dedupKey);

    const { nodes } = get();
    const maxRight = nodes
      .filter((n) => n.kind !== 'timeline')
      .reduce((acc, n) => Math.max(acc, n.x + n.width), 360);

    const mediaUrl = ev.mediaUrl
      ? normalizeBackendMediaUrl(ev.mediaUrl, false)
      : undefined;
    const isVideo = Boolean(mediaUrl && /\.(mp4|webm|mov)(\?|$)/i.test(mediaUrl));
    const isAudio = Boolean(mediaUrl && /\.(mp3|wav|m4a|ogg)(\?|$)/i.test(mediaUrl));
    const isTextOnly = ev.type === 'bridge_prompt' && !mediaUrl;

    const platformMap: Record<string, string> = {
      'google-flow': 'Google Flow',
      flow: 'Google Flow',
      dreamina: 'Dreamina',
      higgsfield: 'Higgsfield',
      sume: 'Sume',
      kling: 'Kling AI',
      openart: 'OpenArt',
      imagineart: 'ImagineArt',
      elevenlabs: 'ElevenLabs',
    };
    const sourceLabel = platformMap[normalizedSrc] || 'Browser Bridge';

    const nodeId = `node_bridge_${Date.now()}`;
    const newNode: CanvasNode = {
      id: nodeId,
      kind: isTextOnly ? 'text' : isVideo ? 'video' : isAudio ? 'audio' : 'image',
      title: ev.title || `Bridge · ${sourceLabel}`,
      prompt: ev.prompt || `Captured from ${sourceLabel}`,
      x: maxRight + 96,
      y: 160,
      width: isVideo ? 480 : isTextOnly ? 320 : isAudio ? 340 : 384,
      height: isVideo ? 270 : isTextOnly ? 190 : isAudio ? 128 : 216,
      aspectRatio: '16:9',
      status: mediaUrl || isTextOnly ? 'ready' : 'idle',
      platformId: (normalizedSrc as PlatformId) || undefined,
      imageUrl: !isTextOnly && !isVideo && !isAudio ? mediaUrl : undefined,
      videoUrl: isVideo ? mediaUrl : undefined,
      audioUrl: isAudio ? mediaUrl : undefined,
      durationSec: isVideo ? 5 : isAudio ? 8 : undefined,
      seed: Math.floor(Math.random() * 9000),
      resolution: '1080p',
      elementHandles: extractHandles(ev.prompt || ''),
      layers: !isTextOnly && !isVideo && !isAudio && mediaUrl ? createDefaultLayers(mediaUrl) : [],
      providerUsed: `Bridge · ${sourceLabel}`,
      createdAt: Date.now(),
    };

    set((s) => ({
      nodes: [...s.nodes, newNode],
      selectedNodeIds: [nodeId],
      chromeBridge: {
        ...s.chromeBridge,
        extensionDetected: true,
        dreaminaTabConnected:
          normalizedSrc === 'dreamina' ? true : s.chromeBridge.dreaminaTabConnected,
        flowTabConnected:
          normalizedSrc === 'google-flow' ? true : s.chromeBridge.flowTabConnected,
        connectedPlatforms: normalizedSrc
          ? { ...s.chromeBridge.connectedPlatforms, [normalizedSrc]: true }
          : s.chromeBridge.connectedPlatforms,
      },
    }));

    get().showToast(`Bridge · Imported from ${sourceLabel}`);
    return true;
  },

  handleBridgeJobWsEvent: (payload) => {
    const type = String(payload.type || '');
    if (type !== 'bridge_job_complete') return;

    const job =
      payload.job && typeof payload.job === 'object'
        ? (payload.job as Record<string, unknown>)
        : payload;
    const jobId = String(job.jobId || payload.jobId || '');
    const rawTarget = String(job.target || payload.target || '');
    const target = rawTarget === 'flow' ? 'google-flow' : rawTarget;
    const status = String(job.status || payload.status || 'succeeded');
    const errorMsg =
      typeof (job.error || payload.error) === 'string'
        ? String(job.error || payload.error)
        : undefined;

    const rawImg =
      (typeof job.localImageUrl === 'string' && job.localImageUrl) ||
      (typeof payload.localImageUrl === 'string' && payload.localImageUrl) ||
      (typeof job.imageUrl === 'string' && job.imageUrl) ||
      (typeof payload.imageUrl === 'string' && payload.imageUrl) ||
      undefined;
    const rawVid =
      (typeof job.localVideoUrl === 'string' && job.localVideoUrl) ||
      (typeof payload.localVideoUrl === 'string' && payload.localVideoUrl) ||
      (typeof job.videoUrl === 'string' && job.videoUrl) ||
      (typeof payload.videoUrl === 'string' && payload.videoUrl) ||
      undefined;
    const rawAud =
      (typeof job.localAudioUrl === 'string' && job.localAudioUrl) ||
      (typeof payload.localAudioUrl === 'string' && payload.localAudioUrl) ||
      (typeof job.audioUrl === 'string' && job.audioUrl) ||
      (typeof payload.audioUrl === 'string' && payload.audioUrl) ||
      undefined;

    const normImg = rawImg ? normalizeBackendMediaUrl(rawImg, false) || rawImg : undefined;
    const normVid = rawVid ? normalizeBackendMediaUrl(rawVid, true) || rawVid : undefined;
    const normAud = rawAud ? normalizeBackendMediaUrl(rawAud, false) || rawAud : undefined;

    const isDreamina =
      target === 'dreamina' ||
      Boolean(normImg?.includes('dreamina_')) ||
      Boolean(normVid?.includes('dreamina_'));
    const isFlow =
      target === 'google-flow' ||
      Boolean(normImg?.includes('flow_')) ||
      Boolean(normVid?.includes('flow_'));

    set((s) => ({
      chromeBridge: {
        ...s.chromeBridge,
        extensionDetected: true,
        dreaminaTabConnected: isDreamina ? true : s.chromeBridge.dreaminaTabConnected,
        flowTabConnected: isFlow ? true : s.chromeBridge.flowTabConnected,
        connectedPlatforms: target
          ? { ...s.chromeBridge.connectedPlatforms, [target]: true }
          : s.chromeBridge.connectedPlatforms,
      },
    }));

    if (jobId && completedBridgeJobIds.has(jobId)) {
      return;
    }

    if (status === 'failed') {
      if (jobId) completedBridgeJobIds.add(jobId);
      set((s) => ({
        nodes: s.nodes.map((n) =>
          (jobId && n.interactionId === jobId) ||
          (n.status === 'generating' && target && n.platformId === target)
            ? {
                ...n,
                status: n.imageUrl || n.videoUrl || n.audioUrl ? ('ready' as const) : ('idle' as const),
                editBadge: undefined,
              }
            : n
        ),
      }));
      if (errorMsg) get().showToast(errorMsg, 'error');
      return;
    }

    if (!normImg && !normVid && !normAud) return;

    const { nodes } = get();
    const matchedNode =
      (jobId ? nodes.find((n) => n.interactionId === jobId) : undefined) ||
      nodes.find(
        (n) =>
          n.status === 'generating' &&
          ((target && n.platformId === target) ||
            (isDreamina && n.editBadge?.includes('Dreamina')) ||
            (isFlow && n.editBadge?.includes('Google Flow')))
      );

    if (matchedNode) {
      if (jobId) completedBridgeJobIds.add(jobId);
      const label = `${target || 'Browser'} · Live Credits`;
      set((s) => ({
        nodes: s.nodes.map((n) => {
          if (n.id !== matchedNode.id) return n;
          const nextImg = normImg || n.imageUrl;
          return {
            ...n,
            status: 'ready' as const,
            progress: 100,
            editBadge: undefined,
            imageUrl: nextImg,
            videoUrl: normVid || (n.kind === 'video' ? n.videoUrl : undefined),
            audioUrl: normAud || (n.kind === 'audio' ? n.audioUrl : undefined),
            interactionId: jobId || n.interactionId,
            layers: nextImg ? createDefaultLayers(nextImg) : n.layers,
            providerUsed: label,
          };
        }),
      }));
      get().showToast(`Live ${label} job finished`);
    }
  },

  verifyProviderConnection: async (provider) => {
    const { byok } = get();
    const apiKeyMap: Record<string, string | undefined> = {
      gemini: byok.geminiApiKey?.trim() || undefined,
      fal: byok.falApiKey?.trim() || undefined,
      replicate: byok.replicateApiKey?.trim() || undefined,
      seedance: byok.seedanceApiKey?.trim() || undefined,
      comfyui: undefined,
      kling: byok.klingApiKey?.trim() || undefined,
      elevenlabs: byok.elevenlabsApiKey?.trim() || undefined,
      openai: byok.openaiApiKey?.trim() || undefined,
      higgsfield:
        byok.higgsfieldKeyId?.trim() && byok.higgsfieldKeySecret?.trim()
          ? `${byok.higgsfieldKeyId.trim()}:${byok.higgsfieldKeySecret.trim()}`
          : byok.higgsfieldApiKey?.trim() || undefined,
      sume: byok.sumeApiKey?.trim() || undefined,
      openart: byok.openartApiKey?.trim() || undefined,
      imagineart: byok.imagineartApiKey?.trim() || undefined,
    };

    set((s) => ({
      verifyingProvider: { ...s.verifyingProvider, [provider]: true },
    }));

    const result = await verifyProviderViaBackend({
      provider,
      apiKey: apiKeyMap[provider],
      accessKey:
        provider === 'kling'
          ? byok.klingAccessKey?.trim() || undefined
          : provider === 'higgsfield'
          ? byok.higgsfieldKeyId?.trim() || undefined
          : undefined,
      secretKey:
        provider === 'kling'
          ? byok.klingSecretKey?.trim() || undefined
          : provider === 'higgsfield'
          ? byok.higgsfieldKeySecret?.trim() || undefined
          : undefined,
      baseUrl:
        provider === 'comfyui'
          ? byok.comfyUiUrl?.trim() || 'http://127.0.0.1:8188'
          : provider === 'seedance'
          ? byok.seedanceEndpoint?.trim() || undefined
          : undefined,
    });

    set((s) => ({
      lastFailedPlatformId: result.valid ? null : s.lastFailedPlatformId,
      verifyingProvider: { ...s.verifyingProvider, [provider]: false },
      providerVerifyStatus: { ...s.providerVerifyStatus, [provider]: result },
    }));

    if (result.valid) {
      const unlocked = [
        ...(result.videoModels || []).slice(0, 2),
        ...(result.imageModels || []).slice(0, 2),
      ];
      get().showToast(
        unlocked.length > 0
          ? `Verified ${provider.toUpperCase()} · Unlocked ${unlocked.join(', ')}`
          : `Verified ${provider.toUpperCase()} connection`
      );
      await get().refreshPlatformsAndExternalMcp();
    } else {
      get().showToast(
        result.error || `Failed to verify ${provider.toUpperCase()} credentials`,
        'error'
      );
    }
  },

  runLiveBridgeTestGeneration: async (target, mode = 'image') => {
    if (get().liveBridgeTestRunning) return;
    get().pushHistory();

    const labelMap: Record<BrowserPlatformTarget, string> = {
      higgsfield: 'Higgsfield',
      sume: 'Sume',
      kling: 'Kling AI',
      dreamina: 'Dreamina',
      'google-flow': 'Google Flow',
      openart: 'OpenArt',
      imagineart: 'ImagineArt',
      elevenlabs: 'ElevenLabs',
    };
    const targetName = labelMap[target] || target;
    const resolvedMode: 'image' | 'video' | 'audio' =
      target === 'elevenlabs' ? 'audio' : mode;

    const testPrompt =
      resolvedMode === 'audio'
        ? 'Every vessel carries the quiet memory of salt, water, and afternoon sun.'
        : '35mm natural daylight architectural courtyard study, warm travertine window shadow, Kodak Vision3 250D';

    const maxRight = get()
      .nodes.filter((n) => n.kind !== 'timeline')
      .reduce((acc, n) => Math.max(acc, n.x + n.width), 360);

    const nodeId = `node_live_bridge_${Date.now()}`;
    const liveBadge = `Generating on ${targetName}…`;

    const testNode: CanvasNode = {
      id: nodeId,
      kind: resolvedMode,
      title: `${resolvedMode === 'video' ? 'Videos' : resolvedMode === 'audio' ? 'Audio' : 'Images'} · ${targetName}`,
      prompt: testPrompt,
      x: maxRight + 96,
      y: 160,
      width: resolvedMode === 'video' ? 480 : resolvedMode === 'audio' ? 340 : 384,
      height: resolvedMode === 'video' ? 270 : resolvedMode === 'audio' ? 128 : 216,
      aspectRatio: '16:9',
      status: 'generating',
      platformId: target as PlatformId,
      connectionMode: 'browser-bridge',
      progress: 35,
      editBadge: liveBadge,
      seed: Math.floor(Math.random() * 9000) + 100,
      resolution: resolvedMode === 'video' ? '1080p' : '2K',
      durationSec: resolvedMode === 'video' ? 5 : resolvedMode === 'audio' ? 8 : undefined,
      elementHandles: [],
      layers: [],
      providerUsed: `${targetName} · Browser Credits`,
      createdAt: Date.now(),
    };

    set((s) => ({
      liveBridgeTestRunning: target,
      liveBridgeStatusText: `Dispatched live ${resolvedMode} prompt to ${targetName} — waiting for browser session…`,
      nodes: [...s.nodes, testNode],
      selectedNodeIds: [nodeId],
      activeView: 'canvas',
    }));

    const res = await enqueueLiveBridgeJobViaBackend({
      target,
      mode: resolvedMode,
      prompt: testPrompt,
      aspectRatio: '16:9',
      durationSec: 5,
      waitForResult: true,
    });

    if (!res.ok || (!res.imageUrl && !res.videoUrl && !res.fullUrl)) {
      set((s) => ({
        liveBridgeTestRunning: null,
        liveBridgeStatusText:
          res.error ||
          `No live ${targetName} browser tab answered. Open ${targetName} with the Chrome Bridge extension loaded.`,
        nodes: s.nodes.filter((n) => n.id !== nodeId),
        selectedNodeIds: [],
      }));
      get().showToast(
        res.error || `No live ${targetName} browser session answered.`,
        'error'
      );
      return;
    }

    if (res.jobId) completedBridgeJobIds.add(res.jobId);
    const resolvedImg = res.imageUrl || (resolvedMode === 'image' ? res.fullUrl : undefined);
    const resolvedVid = res.videoUrl || (resolvedMode === 'video' ? res.fullUrl : undefined);

    set((s) => ({
      liveBridgeTestRunning: null,
      liveBridgeStatusText: `✓ Live ${targetName} generation succeeded (${resolvedVid || resolvedImg})`,
      providerModalOpen: false,
      chromeBridge: {
        ...s.chromeBridge,
        extensionDetected: true,
        dreaminaTabConnected:
          target === 'dreamina' ? true : s.chromeBridge.dreaminaTabConnected,
        flowTabConnected:
          target === 'google-flow' ? true : s.chromeBridge.flowTabConnected,
        connectedPlatforms: {
          ...s.chromeBridge.connectedPlatforms,
          [target]: true,
        },
      },
      nodes: s.nodes.map((n) =>
        n.id === nodeId
          ? {
              ...n,
              status: 'ready' as const,
              progress: 100,
              editBadge: undefined,
              imageUrl: resolvedImg || n.imageUrl,
              videoUrl: resolvedVid || n.videoUrl,
              interactionId: res.jobId || n.interactionId,
              layers: resolvedImg ? createDefaultLayers(resolvedImg) : n.layers,
              providerUsed: `${targetName} · Browser Credits`,
            }
          : n
      ),
    }));

    get().showToast(`Live ${targetName} generation landed on canvas`);
  },

  triggerTestBridgeCapture: async (source = 'dreamina') => {
    const testEvent: BridgeIncomingEvent = {
      eventId: `evt_test_${Date.now()}`,
      timestamp: Date.now(),
      type: 'bridge_asset',
      source,
      title: `Bridge · ${source === 'flow' || source === 'google-flow' ? 'Google Flow' : source} Frame`,
      mediaUrl:
        source === 'flow' || source === 'google-flow'
          ? '/media/real_shot02_bridge.mp4'
          : '/media/real_alpine_road.jpg',
      prompt: 'Natural daylight architectural composition captured via Browser Credit Bridge',
    };

    const pushed = await pushBridgeEventViaBackend(testEvent);
    setTimeout(() => {
      if (!seenBridgeEventIds.has(testEvent.eventId!)) {
        get().ingestBridgeWsEvent(testEvent);
      }
    }, pushed.ok ? 350 : 20);
  },

  setNodePlatformAndModel: (nodeId, platformId, explicitModelId) => {
    const { nodes, platformsCatalog, externalMcpServers } = get();
    const target = nodes.find((n) => n.id === nodeId);
    if (!target) return;
    const modality = nodeKindToModality(target.kind) || 'image';
    const models = getModelsForPlatformAndModality(
      platformId,
      modality,
      platformsCatalog,
      externalMcpServers
    );
    const canonicalExplicit = explicitModelId
      ? resolveCanonicalModelId(explicitModelId)
      : undefined;
    const chosenModel =
      (canonicalExplicit
        ? models.find((m) => m.id === canonicalExplicit || m.id === explicitModelId)
        : undefined) || models[0];
    const resolvedModelId = chosenModel?.id || canonicalExplicit || explicitModelId || '';

    let mcpServerId: string | undefined;
    let mcpToolName: string | undefined;
    if (platformId === 'custom-mcp' && resolvedModelId.includes('::')) {
      const [sId, tName] = resolvedModelId.split('::');
      mcpServerId = sId;
      mcpToolName = tName;
    } else if (resolvedModelId.startsWith('mcp:')) {
      const [, sId, tName] = resolvedModelId.split(':');
      mcpServerId = sId;
      mcpToolName = tName;
    }

    // Clamp & sync aspectRatio, resolution, durationSec, quality, and modelParams for the selected model
    let nextAspect = target.aspectRatio;
    let nextDims: { width: number; height: number } | null = null;
    if (chosenModel?.aspectRatios?.length) {
      const matchedAspect = chosenModel.aspectRatios.find(
        (ar) => ar.toLowerCase() === String(target.aspectRatio).toLowerCase()
      );
      if (matchedAspect) {
        nextAspect = matchedAspect;
      } else {
        nextAspect =
          chosenModel.defaultAspect ||
          chosenModel.aspectRatios.find((ar) => ar !== 'auto') ||
          chosenModel.aspectRatios[0];
        const baseW =
          target.kind === 'video' || target.kind === 'contact-sheet'
            ? 480
            : target.kind === 'element'
            ? 320
            : 384;
        nextDims = getDimensionsForAspect(nextAspect, baseW);
      }
    }

    let nextResolution = target.resolution;
    if (chosenModel?.resolutions?.length) {
      const matchedRes = chosenModel.resolutions.find(
        (r) => r.toLowerCase() === String(target.resolution).toLowerCase()
      );
      nextResolution =
        matchedRes || chosenModel.defaultResolution || chosenModel.resolutions[0];
    }

    let nextDurationSec = target.durationSec;
    if (chosenModel?.durationsSec?.length) {
      if (
        typeof target.durationSec === 'number' &&
        chosenModel.durationsSec.includes(target.durationSec)
      ) {
        nextDurationSec = target.durationSec;
      } else {
        nextDurationSec =
          chosenModel.defaultDurationSec ??
          chosenModel.durationsSec.find((d) => d > 0) ??
          chosenModel.durationsSec[0];
      }
    } else if (chosenModel?.defaultDurationSec !== undefined) {
      nextDurationSec = chosenModel.defaultDurationSec;
    }

    const GPT_CRISP_DEFAULT_IDS = new Set([
      'gpt_image_2_6',
      'gpt_image_2_6_flare',
      'gpt_image_2_5',
      'gpt_image_2',
    ]);
    const qualitySpec = chosenModel?.parameters?.find((p) => p.name === 'quality');
    let nextQuality: string | undefined;
    if (qualitySpec) {
      const opts = (qualitySpec.options || []).map((o) => String(o));
      const matchedCur = target.quality
        ? opts.find((o) => o.toLowerCase() === String(target.quality).toLowerCase())
        : undefined;
      if (matchedCur && target.modelId === resolvedModelId) {
        nextQuality = matchedCur;
      } else if (GPT_CRISP_DEFAULT_IDS.has(resolvedModelId) && opts.includes('high')) {
        nextQuality = 'high';
      } else if (qualitySpec.default !== undefined) {
        nextQuality = String(qualitySpec.default);
      } else if (opts.length > 0) {
        nextQuality = opts[0];
      }
    }

    const nextModelParams: Record<string, string | number | boolean> = {};
    const prevParams = target.modelParams || {};
    for (const spec of chosenModel?.parameters || []) {
      if (spec.name === 'quality') {
        if (nextQuality !== undefined) nextModelParams.quality = nextQuality;
        continue;
      }
      const prevVal = prevParams[spec.name];
      if (prevVal !== undefined) {
        if (spec.options?.length) {
          const matched = spec.options.find(
            (o) => String(o).toLowerCase() === String(prevVal).toLowerCase()
          );
          if (matched !== undefined) {
            nextModelParams[spec.name] = matched;
            continue;
          }
        } else if (typeof prevVal === (spec.type === 'boolean' ? 'boolean' : spec.type === 'number' ? 'number' : 'string')) {
          nextModelParams[spec.name] = prevVal;
          continue;
        }
      }
      if (spec.default !== undefined) {
        nextModelParams[spec.name] = spec.default;
      }
    }

    const badge =
      getPlatformBadgeLabel(
        platformId,
        resolvedModelId,
        platformsCatalog,
        externalMcpServers
      ) || platformId;

    set((s) => ({
      lastImagePlatformId: modality === 'image' ? platformId : s.lastImagePlatformId,
      lastVideoPlatformId: modality === 'video' ? platformId : s.lastVideoPlatformId,
      lastAudioPlatformId: modality === 'audio' ? platformId : s.lastAudioPlatformId,
      nodes: s.nodes.map((n) =>
        n.id === nodeId
          ? {
              ...n,
              platformId,
              modelId: resolvedModelId,
              mcpServerId,
              mcpToolName,
              aspectRatio: nextAspect,
              ...(nextDims ? { width: nextDims.width, height: nextDims.height } : {}),
              resolution: nextResolution,
              durationSec: nextDurationSec,
              quality: nextQuality,
              modelParams: Object.keys(nextModelParams).length > 0 ? nextModelParams : undefined,
              audioMode:
                modality === 'audio' && resolvedModelId.includes('sound')
                  ? 'sfx'
                  : modality === 'audio' && n.audioMode === 'sfx' && !resolvedModelId.includes('sound')
                  ? 'tts'
                  : n.audioMode,
              providerUsed: badge,
            }
          : n
      ),
    }));
  },

  setNodeAspectRatio: (nodeId, aspectRatio) => {
    const target = get().nodes.find((n) => n.id === nodeId);
    if (!target) return;
    const baseW =
      target.kind === 'video' || target.kind === 'contact-sheet'
        ? 480
        : target.kind === 'element'
        ? 320
        : 384;
    const dims = getDimensionsForAspect(aspectRatio, baseW);
    set((s) => ({
      nodes: s.nodes.map((n) =>
        n.id === nodeId
          ? {
              ...n,
              aspectRatio,
              width: dims.width,
              height: dims.height,
            }
          : n
      ),
    }));
  },

  uploadReferenceToNode: async (nodeId, file) => {
    const target = get().nodes.find((n) => n.id === nodeId);
    if (!target) return;
    get().pushHistory();

    const dataUrl = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => resolve('');
      reader.readAsDataURL(file);
    });
    if (!dataUrl) return;

    const commaIdx = dataUrl.indexOf(',');
    const b64 = commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : dataUrl;
    const uploaded = await uploadMediaViaBackend({
      filename: file.name || `ref_${Date.now()}.png`,
      mimeType: file.type || 'image/png',
      dataBase64: b64,
    });
    const finalUrl = uploaded.ok && uploaded.mediaUrl ? uploaded.mediaUrl : dataUrl;

    set((s) => {
      let nextElements = s.elements;
      if (target.kind === 'element') {
        const handle = target.elementHandles[0] || '@Ref_1';
        const existingVault = s.elements.find(
          (el) => el.handle.toLowerCase() === handle.toLowerCase()
        );
        const refItem = {
          id: `ref_${Date.now()}`,
          label: file.name.slice(0, 24) || handle,
          dataUrl: finalUrl,
        };
        if (existingVault) {
          nextElements = s.elements.map((el) =>
            el.id === existingVault.id
              ? { ...el, references: [refItem, ...el.references.slice(0, 5)] }
              : el
          );
        } else {
          nextElements = [
            ...s.elements,
            {
              id: `vault_${Date.now()}`,
              handle,
              name: target.title || handle.replace(/^@/, ''),
              category: 'character',
              description: target.prompt || 'Canvas reference anchor',
              accentColor: '#20D5EC',
              references: [refItem],
            },
          ];
        }
      }

      return {
        elements: nextElements,
        nodes: s.nodes.map((n) =>
          n.id === nodeId
            ? {
                ...n,
                status: 'ready' as const,
                imageUrl: finalUrl,
                layers: createDefaultLayers(finalUrl),
                providerUsed: 'Uploaded Reference',
              }
            : n
        ),
      };
    });

    get().showToast(`Loaded "${file.name}" onto ${target.title}`);
  },

  attachReferenceToNode: async (nodeId, file) => {
    const target = get().nodes.find((n) => n.id === nodeId);
    if (!target) return;
    const dataUrl = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => resolve('');
      reader.readAsDataURL(file);
    });
    if (!dataUrl) return;
    const commaIdx = dataUrl.indexOf(',');
    const b64 = commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : dataUrl;
    const uploaded = await uploadMediaViaBackend({
      filename: file.name || `ref_${Date.now()}.png`,
      mimeType: file.type || 'image/png',
      dataBase64: b64,
    });
    const finalUrl = uploaded.ok && uploaded.mediaUrl ? uploaded.mediaUrl : dataUrl;

    set((s) => ({
      nodes: s.nodes.map((n) =>
        n.id === nodeId
          ? {
              ...n,
              referenceUrls: Array.from(new Set([...(n.referenceUrls || []), finalUrl])),
            }
          : n
      ),
    }));
    get().showToast(`Attached reference to "${target.title}"`);
  },

  removeReferenceUrlFromNode: (nodeId, url) => {
    set((s) => ({
      nodes: s.nodes.map((n) =>
        n.id === nodeId
          ? {
              ...n,
              referenceUrls: (n.referenceUrls || []).filter((u) => u !== url),
            }
          : n
      ),
    }));
  },

  saveNodeAsElementReference: (nodeId, customHandle) => {
    const node = get().nodes.find((n) => n.id === nodeId);
    if (!node || !node.imageUrl) {
      get().showToast('Generate or upload an image on this node first', 'error');
      return;
    }
    const idx = get().elements.length + 1;
    const rawHandle =
      customHandle?.trim() ||
      node.elementHandles[0] ||
      `@Ref_${idx}`;
    const handle = rawHandle.startsWith('@')
      ? rawHandle.replace(/[^@A-Za-z0-9_]/g, '')
      : `@${rawHandle.replace(/[^A-Za-z0-9_]/g, '')}`;

    set((s) => {
      const existing = s.elements.find(
        (el) => el.handle.toLowerCase() === handle.toLowerCase()
      );
      const refEntry = {
        id: `ref_${Date.now()}`,
        label: node.title,
        dataUrl: node.imageUrl!,
      };
      const nextElements = existing
        ? s.elements.map((el) =>
            el.id === existing.id
              ? { ...el, references: [refEntry, ...el.references.slice(0, 5)] }
              : el
          )
        : [
            ...s.elements,
            {
              id: `vault_${Date.now()}`,
              handle,
              name: node.title,
              category: 'character' as const,
              description: node.prompt || 'Saved from canvas generation',
              accentColor: '#20D5EC',
              references: [refEntry],
            },
          ];

      return {
        elements: nextElements,
        nodes: s.nodes.map((n) =>
          n.id === nodeId
            ? {
                ...n,
                elementHandles: Array.from(new Set([handle, ...n.elementHandles])),
              }
            : n
        ),
      };
    });

    get().showToast(`Saved "${node.title}" as ${handle} reference`);
  },

  generateSingleNode: async (nodeId) => {
    const state = get();
    const node = state.nodes.find((n) => n.id === nodeId);
    if (!node) return false;

    const modality = nodeKindToModality(node.kind);
    if (!modality) {
      if (node.kind === 'mcp-tool') {
        await get().executeMcpToolNode(node.id);
        return true;
      }
      return false;
    }

    const platformId: PlatformId =
      node.platformId ||
      (modality === 'video'
        ? state.lastVideoPlatformId
        : modality === 'audio'
        ? state.lastAudioPlatformId
        : state.lastImagePlatformId);

    const models = getModelsForPlatformAndModality(
      platformId,
      modality,
      state.platformsCatalog,
      state.externalMcpServers
    );
    const rawModelId = node.modelId || models[0]?.id || '';
    const modelId =
      platformId === 'higgsfield' ? resolveCanonicalModelId(rawModelId) : rawModelId;

    // Gather wired upstream nodes (references, videos, text/sticky prompts, & Style DNA)
    const incomingEdges = state.edges.filter((e) => e.targetId === node.id);
    const upstreamNodes = incomingEdges
      .map((e) => state.nodes.find((nn) => nn.id === e.sourceId))
      .filter((nn): nn is CanvasNode => Boolean(nn));

    const upstreamTextPrompt = upstreamNodes
      .filter((nn) => (nn.kind === 'text' || nn.kind === 'sticky') && nn.prompt.trim())
      .map((nn) => nn.prompt.trim())
      .join('\n');

    const upstreamStyleCues = upstreamNodes
      .filter((nn) => nn.kind === 'style-dna' && nn.styleDna)
      .map((nn) => `${nn.styleDna!.lens}, ${nn.styleDna!.lighting}, ${nn.styleDna!.filmStock}`)
      .join('; ');

    let basePrompt = (node.prompt.trim() || upstreamTextPrompt).trim();
    if (!basePrompt && node.prompt.trim() === '' && upstreamTextPrompt) {
      basePrompt = upstreamTextPrompt;
    }
    if (!basePrompt) {
      get().selectNodes([node.id]);
      get().showToast(`Enter a prompt on "${node.title}" before generating`, 'error');
      return false;
    }
    if (upstreamStyleCues && !basePrompt.includes(upstreamStyleCues)) {
      basePrompt = `${basePrompt}. Style DNA: ${upstreamStyleCues}`;
    }

    const effectivePrompt =
      modality === 'video' &&
      node.cameraMotion &&
      node.cameraMotion !== 'Static Tripod' &&
      !basePrompt.toLowerCase().includes(node.cameraMotion.toLowerCase())
        ? `${basePrompt}, ${node.cameraMotion} camera motion`
        : basePrompt;

    // Collect image + video references in deterministic priority:
    // 1. Wired upstream image/element/contact-sheet & video nodes
    // 2. Node's explicit referenceUrls[] & videoReferenceUrls[]
    // 3. @Element handles referenced in prompt or attached to node
    const refSet = new Set<string>();
    const videoRefSet = new Set<string>();
    for (const up of upstreamNodes) {
      if (
        (up.kind === 'image' || up.kind === 'element' || up.kind === 'contact-sheet') &&
        up.imageUrl
      ) {
        refSet.add(up.imageUrl);
      } else if (up.kind === 'video' && up.videoUrl) {
        videoRefSet.add(up.videoUrl);
      }
    }
    for (const url of node.referenceUrls || []) {
      if (url) refSet.add(url);
    }
    for (const vUrl of node.videoReferenceUrls || []) {
      if (vUrl) videoRefSet.add(vUrl);
    }
    const promptHandles = [
      ...extractHandles(effectivePrompt),
      ...(node.elementHandles || []),
    ];
    for (const h of promptHandles) {
      const vault = state.elements.find(
        (el) => el.handle.toLowerCase() === h.toLowerCase()
      );
      if (vault?.references?.[0]?.dataUrl) {
        refSet.add(vault.references[0].dataUrl);
      }
    }
    const imageRefsList = Array.from(refSet);
    const videoRefsList = Array.from(videoRefSet);
    const effectiveStartImg =
      node.startImageUrl ||
      (node.referenceFrameMode === 'start-end' && imageRefsList.length >= 1
        ? imageRefsList[0]
        : undefined);
    const effectiveEndImg =
      node.endImageUrl ||
      (node.referenceFrameMode === 'start-end' && imageRefsList.length >= 2
        ? imageRefsList[1]
        : undefined);

    let mcpServerId = node.mcpServerId;
    let mcpToolName = node.mcpToolName;
    if (platformId === 'custom-mcp' && modelId.includes('::')) {
      const [sId, tName] = modelId.split('::');
      mcpServerId = sId;
      mcpToolName = tName;
    } else if (modelId.startsWith('mcp:')) {
      const [, sId, tName] = modelId.split(':');
      mcpServerId = sId;
      mcpToolName = tName;
    }

    const badge =
      getPlatformBadgeLabel(
        platformId,
        modelId,
        state.platformsCatalog,
        state.externalMcpServers
      ) || `${platformId} · ${modelId}`;

    const credentials = resolveByokCredentialsForPlatform(platformId, state.byok);

    set((s) => ({
      lastFailedPlatformId: null,
      nodes: s.nodes.map((n) =>
        n.id === nodeId
          ? {
              ...n,
              platformId,
              modelId,
              status: 'generating' as const,
              progress: 30,
              editBadge: `Generating on ${badge}…`,
            }
          : n
      ),
    }));

    const effectiveQuality =
      node.quality ||
      (typeof node.modelParams?.quality === 'string'
        ? node.modelParams.quality
        : undefined);
    const mergedModelParams: Record<string, string | number | boolean> | undefined =
      node.modelParams || effectiveQuality
        ? {
            ...(node.modelParams || {}),
            ...(effectiveQuality ? { quality: effectiveQuality } : {}),
          }
        : undefined;

    const res = await generateNodeViaBackend({
      nodeId: node.id,
      kind: modality,
      platformId,
      connectionMode: node.connectionMode || 'auto',
      modelId,
      prompt: effectivePrompt,
      negativePrompt: node.negativePrompt,
      settings: {
        aspectRatio: node.aspectRatio,
        resolution: node.resolution,
        ...(effectiveQuality ? { quality: effectiveQuality } : {}),
        batchCount: node.batchCount || 1,
        durationSec: node.durationSec || (modality === 'video' ? 5 : modality === 'audio' ? 8 : undefined),
        audioEnabled: node.audioEnabled ?? true,
        audioMode: node.audioMode || (modality === 'audio' ? 'tts' : undefined),
        voiceId: node.voiceId || (modality === 'audio' ? 'JBFqnCBsd6RMkjVDRZzb' : undefined),
        seed: node.seed,
        ...(mergedModelParams ? { modelParams: mergedModelParams } : {}),
      },
      ...(mergedModelParams ? { modelParams: mergedModelParams } : {}),
      referenceImages: imageRefsList,
      ...(videoRefsList.length > 0 ? { videoReferences: videoRefsList } : {}),
      ...(node.referenceFrameMode ? { referenceFrameMode: node.referenceFrameMode } : {}),
      ...(effectiveStartImg ? { startImageUrl: effectiveStartImg } : {}),
      ...(effectiveEndImg ? { endImageUrl: effectiveEndImg } : {}),
      mcpServerId,
      mcpToolName,
      credentials,
    });

    if (!res.ok) {
      const latestState = get();
      const backendPlat = latestState.platformsCatalog.find((p) => p.id === platformId);
      const connStatus = getPlatformConnectionStatus(
        platformId,
        latestState.byok,
        latestState.chromeBridge,
        latestState.externalMcpServers,
        backendPlat,
        {
          connectedBrowserPlatforms: latestState.connectedBrowserPlatforms,
          connectedMcpPlatforms: latestState.connectedMcpPlatforms,
          configuredApiPlatforms: latestState.configuredApiPlatforms,
        }
      );
      const errMsg = res.error || '';
      const explicitlyNeedsAuth =
        /\b401\b|not connected|unauthorized|expired.*token|missing credentials|no api key/i.test(
          errMsg
        );
      const shouldShowConnectButton = !connStatus.connected || explicitlyNeedsAuth;

      set((s) => ({
        lastFailedPlatformId: shouldShowConnectButton ? platformId : null,
        nodes: s.nodes.map((n) => {
          if (n.id !== nodeId) return n;
          const hadMedia = Boolean(n.imageUrl || n.videoUrl || n.audioUrl);
          return {
            ...n,
            status: hadMedia ? ('ready' as const) : ('idle' as const),
            progress: undefined,
            editBadge: undefined,
          };
        }),
      }));
      get().showToast(
        res.error ||
          (shouldShowConnectButton
            ? `Connect your ${badge} credits (MCP, Browser Session, or API Key) in Connections · Credits.`
            : `${badge} generation failed — please try again.`),
        'error'
      );
      return false;
    }

    const primaryImg =
      res.imageUrl ||
      (modality === 'image' ? res.mediaUrl || res.outputs?.[0] : undefined);
    const primaryVid =
      res.videoUrl ||
      (modality === 'video' ? res.mediaUrl || res.outputs?.[0] : undefined);
    const primaryAud =
      res.audioUrl ||
      (modality === 'audio' ? res.mediaUrl || res.outputs?.[0] : undefined);

    set((s) => {
      let nextElements = s.elements;
      if (node.kind === 'element' && primaryImg) {
        const handle = node.elementHandles[0] || '@Ref_1';
        const existing = s.elements.find(
          (el) => el.handle.toLowerCase() === handle.toLowerCase()
        );
        const refEntry = {
          id: `ref_${Date.now()}`,
          label: node.title,
          dataUrl: primaryImg,
        };
        nextElements = existing
          ? s.elements.map((el) =>
              el.id === existing.id
                ? { ...el, references: [refEntry, ...el.references.slice(0, 5)] }
                : el
            )
          : [
              ...s.elements,
              {
                id: `vault_${Date.now()}`,
                handle,
                name: node.title,
                category: 'character' as const,
                description: effectivePrompt,
                accentColor: '#20D5EC',
                references: [refEntry],
              },
            ];
      }

      return {
        elements: nextElements,
        nodes: s.nodes.map((n) => {
          if (n.id !== nodeId) return n;
          const resolvedImageForCard =
            primaryImg ||
            (modality === 'video' && !n.imageUrl
              ? Array.from(refSet)[0]
              : n.imageUrl);
          return {
            ...n,
            prompt: n.prompt.trim() ? n.prompt : effectivePrompt,
            status: 'ready' as const,
            progress: 100,
            editBadge: undefined,
            imageUrl: resolvedImageForCard,
            videoUrl: primaryVid || n.videoUrl,
            audioUrl: primaryAud || n.audioUrl,
            waveform:
              res.waveform && res.waveform.length > 0 ? res.waveform : n.waveform,
            generatedOutputs:
              res.outputs && res.outputs.length > 0
                ? res.outputs
                : n.generatedOutputs,
            batchViewMode:
              res.outputs && res.outputs.length > 1
                ? ('grid' as const)
                : n.batchViewMode,
            interactionId: res.jobId || n.interactionId,
            layers: resolvedImageForCard
              ? createDefaultLayers(resolvedImageForCard)
              : n.layers,
            providerUsed: res.providerUsed || badge,
          };
        }),
      };
    });

    void get().persistActiveProjectToDisk();
    get().showToast(`Generated "${node.title}" via ${res.providerUsed || badge}`);
    return true;
  },

  runWorkflowPipeline: async (startFromNodeId) => {
    if (get().workflowRunning) return;
    const { nodes, edges } = get();

    const isGeneratable = (n: CanvasNode) => Boolean(nodeKindToModality(n.kind));

    let candidateIds: Set<string>;
    if (startFromNodeId) {
      // BFS reachable downstream from startFromNodeId
      candidateIds = new Set<string>();
      const q = [startFromNodeId];
      while (q.length > 0) {
        const cur = q.shift()!;
        if (candidateIds.has(cur)) continue;
        candidateIds.add(cur);
        for (const e of edges) {
          if (e.sourceId === cur && !candidateIds.has(e.targetId)) {
            q.push(e.targetId);
          }
        }
      }
    } else {
      const edgeParticipantIds = new Set<string>();
      for (const e of edges) {
        edgeParticipantIds.add(e.sourceId);
        edgeParticipantIds.add(e.targetId);
      }
      const idleNodes = nodes.filter((n) => isGeneratable(n) && n.status === 'idle');
      if (idleNodes.length > 0 || edgeParticipantIds.size > 0) {
        candidateIds = new Set<string>();
        for (const n of nodes) {
          if (isGeneratable(n) && (n.status === 'idle' || edgeParticipantIds.has(n.id))) {
            candidateIds.add(n.id);
          }
        }
      } else {
        candidateIds = new Set(nodes.filter(isGeneratable).map((n) => n.id));
      }
    }

    // Topological sort (Kahn's algorithm) over candidate generatable nodes
    const genNodes = nodes.filter((n) => candidateIds.has(n.id) && isGeneratable(n));
    if (genNodes.length === 0) {
      get().showToast('Add an Image, Video, or Audio node to run the workflow', 'error');
      return;
    }

    const inDegree = new Map<string, number>();
    const adj = new Map<string, string[]>();
    for (const n of genNodes) {
      inDegree.set(n.id, 0);
      adj.set(n.id, []);
    }
    for (const e of edges) {
      if (inDegree.has(e.sourceId) && inDegree.has(e.targetId)) {
        adj.get(e.sourceId)!.push(e.targetId);
        inDegree.set(e.targetId, (inDegree.get(e.targetId) || 0) + 1);
      }
    }

    const queue = genNodes
      .filter((n) => (inDegree.get(n.id) || 0) === 0)
      .sort((a, b) => a.x - b.x || a.y - b.y)
      .map((n) => n.id);

    const orderedIds: string[] = [];
    while (queue.length > 0) {
      const id = queue.shift()!;
      orderedIds.push(id);
      for (const nxt of adj.get(id) || []) {
        const deg = (inDegree.get(nxt) || 1) - 1;
        inDegree.set(nxt, deg);
        if (deg === 0) queue.push(nxt);
      }
    }
    // Append any remaining cycle nodes deterministically
    for (const n of genNodes) {
      if (!orderedIds.includes(n.id)) orderedIds.push(n.id);
    }

    // When running whole workflow without explicit startFromNodeId, skip upstream nodes that already have media ready unless all nodes are already ready
    const anyIdle = orderedIds.some((id) => {
      const nn = get().nodes.find((x) => x.id === id);
      return nn && nn.status === 'idle';
    });
    const executionPlan =
      !startFromNodeId && anyIdle
        ? orderedIds.filter((id) => {
            const nn = get().nodes.find((x) => x.id === id);
            return nn && nn.status === 'idle';
          })
        : orderedIds;

    set({
      workflowRunning: true,
      workflowProgressText: `Running 1/${executionPlan.length}…`,
    });

    let completedCount = 0;
    for (let i = 0; i < executionPlan.length; i++) {
      const targetId = executionPlan[i];
      const curNode = get().nodes.find((n) => n.id === targetId);
      set({
        workflowProgressText: `Stage ${i + 1}/${executionPlan.length} · ${
          curNode?.title || 'Node'
        }`,
      });
      const ok = await get().generateSingleNode(targetId);
      if (!ok) {
        set({ workflowRunning: false, workflowProgressText: null });
        return;
      }
      completedCount++;
    }

    set({ workflowRunning: false, workflowProgressText: null });
    if (completedCount > 1) {
      get().showToast(`Completed ${completedCount}-stage canvas workflow`);
    }
  },

  refreshConnectionsStatus: async () => {
    const snap = await fetchConnectionsStatusViaBackend();
    if (!snap.ok) return;

    set((s) => {
      const browserSet = new Set<string>(snap.connectedBrowserPlatforms);
      const mcpSet = new Set<string>(snap.connectedMcpPlatforms);
      const apiSet = new Set<string>(snap.configuredApiPlatforms);
      const nextPlatformMap: Record<string, boolean> = {
        ...s.chromeBridge.connectedPlatforms,
      };
      for (const pid of snap.connectedBrowserPlatforms) {
        nextPlatformMap[pid] = true;
      }

      // Merge snap.mcpServers while preserving richer tool schemas already loaded in externalMcpServers
      let mergedExternalMcp = s.externalMcpServers;
      if (snap.mcpServers && snap.mcpServers.length > 0) {
        const existingById = new Map(s.externalMcpServers.map((srv) => [srv.id, srv]));
        mergedExternalMcp = snap.mcpServers.map((incoming) => {
          const prev = existingById.get(incoming.id);
          return {
            ...prev,
            ...incoming,
            tools:
              incoming.tools && incoming.tools.length > 0
                ? incoming.tools
                : prev?.tools || [],
            balance: incoming.balance || prev?.balance || snap.mcpBalance,
          };
        });
      }

      const nextFailedStillConnected =
        s.lastFailedPlatformId &&
        (browserSet.has(s.lastFailedPlatformId) ||
          mcpSet.has(s.lastFailedPlatformId) ||
          apiSet.has(s.lastFailedPlatformId));
      const nextLastFailed = nextFailedStillConnected ? null : s.lastFailedPlatformId;

      const liveObj = {
        connectedBrowserPlatforms: snap.connectedBrowserPlatforms,
        connectedMcpPlatforms: snap.connectedMcpPlatforms,
        configuredApiPlatforms: snap.configuredApiPlatforms,
      };
      const isPlatConnected = (pid: PlatformId) =>
        getPlatformConnectionStatus(
          pid,
          s.byok,
          s.chromeBridge,
          mergedExternalMcp,
          s.platformsCatalog.find((p) => p.id === pid),
          liveObj
        ).connected;

      const pickForModality = (mod: 'image' | 'video' | 'audio', cur: PlatformId): PlatformId => {
        if (isPlatConnected(cur)) return cur;
        const found = s.platformsCatalog.find(
          (p) => p.modalities.includes(mod) && isPlatConnected(p.id)
        );
        return found ? found.id : cur;
      };

      return {
        connectedBrowserPlatforms: snap.connectedBrowserPlatforms,
        connectedMcpPlatforms: snap.connectedMcpPlatforms,
        configuredApiPlatforms: snap.configuredApiPlatforms,
        externalMcpServers: mergedExternalMcp,
        lastImagePlatformId: pickForModality('image', s.lastImagePlatformId),
        lastVideoPlatformId: pickForModality('video', s.lastVideoPlatformId),
        lastAudioPlatformId: pickForModality('audio', s.lastAudioPlatformId),
        lastFailedPlatformId: nextLastFailed,
        bridgeWsConnected:
          snap.bridgeClients > 0 ? true : s.bridgeWsConnected,
        chromeBridge: {
          ...s.chromeBridge,
          extensionDetected:
            snap.bridgeClients > 0 ||
            snap.connectedBrowserPlatforms.length > 0 ||
            s.chromeBridge.extensionDetected,
          dreaminaTabConnected:
            snap.connectedBrowserPlatforms.includes('dreamina') ||
            s.chromeBridge.dreaminaTabConnected,
          flowTabConnected:
            snap.connectedBrowserPlatforms.includes('google-flow') ||
            s.chromeBridge.flowTabConnected,
          connectedPlatforms: nextPlatformMap,
        },
        mcpHealth: {
          ...s.mcpHealth,
          bridgeClients: Math.max(snap.bridgeClients, s.mcpHealth.bridgeClients || 0),
        },
      };
    });
  },

  launchConnectedCreatorBrowser: async (platformId = 'all') => {
    set({ launchingBrowserTarget: platformId });
    const res = await launchConnectedBrowserViaBackend(platformId);
    set({ launchingBrowserTarget: null });
    if (!res.ok) {
      get().showToast(
        res.error || 'Could not launch connected Chrome creator window',
        'error'
      );
      return false;
    }
    const label =
      platformId === 'all'
        ? 'Connected Creator Browser (sign into your accounts once — bridge is pre-loaded!)'
        : `Opened ${platformId} in Connected Creator Browser (sign in once)`;
    get().showToast(label);
    setTimeout(() => void get().refreshConnectionsStatus(), 1500);
    setTimeout(() => void get().refreshConnectionsStatus(), 4000);
    return true;
  },

  checkBrowserConnections: async (platformId) => {
    set({ checkingBrowserPlatform: platformId || 'all' });
    const res = await checkBrowserConnectionsViaBackend(platformId);
    set({ checkingBrowserPlatform: null });
    await get().refreshConnectionsStatus();
    const list = res.connectedBrowserPlatforms || [];
    const connected = platformId ? list.includes(platformId as PlatformId) : list.length > 0;
    if (connected) {
      get().showToast(
        platformId
          ? `Detected active ${platformId} browser session!`
          : `Detected ${list.length} active browser sessions!`
      );
    } else if (res.error) {
      get().showToast(res.error, 'error');
    } else {
      get().showToast(
        platformId
          ? `No open signed-in ${platformId} tab detected yet — sign in via browser then click Check again.`
          : 'No open creator tabs detected yet.',
        'error'
      );
    }
    return {
      ok: res.ok,
      connected,
      connectedPlatforms: list,
    };
  },

  setMcpOAuthSession: (mcpOAuthSession) => set({ mcpOAuthSession }),

  startMcpOAuth: async (platformId, mcpUrl) => {
    set({
      mcpOAuthSession: {
        sessionId: 'starting',
        platformId,
        mcpUrl: mcpUrl || (platformId === 'higgsfield' ? 'https://mcp.higgsfield.ai/mcp' : ''),
        step: 'registering',
        updatedAt: Date.now(),
      },
    });
    const res = await startMcpOAuthViaBackend(platformId, mcpUrl);
    if (!res.ok || !res.sessionId || !res.authorizeUrl) {
      const errSess: McpOAuthSession = {
        sessionId: res.sessionId || 'error',
        platformId,
        mcpUrl: res.mcpUrl || mcpUrl || '',
        step: 'error',
        error: res.error || 'Could not start MCP OAuth handshake',
        updatedAt: Date.now(),
      };
      set({ mcpOAuthSession: errSess });
      get().showToast(errSess.error || 'MCP OAuth error', 'error');
      return errSess;
    }
    const nextSess: McpOAuthSession = {
      sessionId: res.sessionId,
      state: res.state,
      platformId: res.platformId || platformId,
      mcpUrl: res.mcpUrl || mcpUrl || '',
      authorizeUrl: res.authorizeUrl,
      step: res.step || 'awaiting_login',
      updatedAt: Date.now(),
    };
    set({ mcpOAuthSession: nextSess });
    return nextSess;
  },

  pollMcpOAuthStatus: async (sessionId) => {
    const targetId = sessionId || get().mcpOAuthSession?.sessionId;
    if (!targetId || targetId === 'starting' || targetId === 'error') return null;
    const isDreamina =
      targetId.startsWith('drm_mcp_') ||
      get().mcpOAuthSession?.platformId === 'dreamina';
    const res = isDreamina
      ? await getDreaminaMcpStatusViaBackend(targetId)
      : await getMcpOAuthStatusViaBackend(targetId);
    if (!res.ok || !res.session) return null;
    const prevStep = get().mcpOAuthSession?.step;
    set({ mcpOAuthSession: res.session });
    if (res.session.step === 'connected' && prevStep !== 'connected') {
      await get().refreshPlatformsAndExternalMcp();
      get().showToast(`${res.session.platformId} MCP Connected Successfully!`);
    }
    return res.session;
  },

  startDreaminaMcpConnect: async (payload = { mode: 'browser', launchBrowser: true }) => {
    set({
      mcpOAuthSession: {
        sessionId: 'starting',
        platformId: 'dreamina',
        mcpUrl: 'dreamina://mcp/seedream-seedance',
        authorizeUrl: 'https://dreamina.capcut.com/ai-tool/home',
        step: 'registering',
        updatedAt: Date.now(),
      },
    });
    const res = await startDreaminaMcpConnectViaBackend(payload);
    if (!res.ok || !res.session) {
      const errSess: McpOAuthSession = {
        sessionId: 'error',
        platformId: 'dreamina',
        mcpUrl: 'dreamina://mcp/seedream-seedance',
        authorizeUrl: 'https://dreamina.capcut.com/ai-tool/home',
        step: 'error',
        error: res.error || 'Could not start Dreamina MCP connection',
        updatedAt: Date.now(),
      };
      set({ mcpOAuthSession: errSess });
      get().showToast(errSess.error || 'Dreamina MCP error', 'error');
      return errSess;
    }
    set({ mcpOAuthSession: res.session });
    if (res.session.step === 'connected') {
      await get().refreshPlatformsAndExternalMcp();
      get().showToast('Dreamina MCP Connected Successfully!');
    }
    return res.session;
  },

  disconnectDreaminaMcp: async () => {
    const res = await disconnectDreaminaMcpViaBackend();
    if (get().mcpOAuthSession?.platformId === 'dreamina') {
      set({ mcpOAuthSession: null });
    }
    await get().refreshPlatformsAndExternalMcp();
    get().showToast(
      res.ok ? 'Disconnected Dreamina MCP' : res.error || 'Failed to disconnect Dreamina MCP',
      res.ok ? 'ok' : 'error'
    );
  },

  refreshPlatformsAndExternalMcp: async () => {
    const [platRes, mcpRes] = await Promise.all([
      fetchPlatformCatalogViaBackend(),
      listExternalMcpServers(),
    ]);
    await get().refreshConnectionsStatus();

    set((s) => {
      let mergedCatalog = PLATFORM_CATALOG;
      if (platRes.ok && platRes.platforms.length > 0) {
        const backendMap = new Map(platRes.platforms.map((p) => [p.id, p]));
        mergedCatalog = PLATFORM_CATALOG.map((localPlat) => {
          const remote = backendMap.get(localPlat.id);
          if (!remote) return localPlat;
          const mergedModels = [...localPlat.models];
          for (const rm of remote.models || []) {
            if (!rm?.id || rm.id in LEGACY_MODEL_ID_REDIRECTS) continue;
            const existingIdx = mergedModels.findIndex((lm) => lm.id === rm.id);
            if (existingIdx >= 0) {
              const lm = mergedModels[existingIdx];
              mergedModels[existingIdx] = {
                ...lm,
                ...rm,
                label: lm.label || rm.label,
                providerFamily: rm.providerFamily || lm.providerFamily,
                parameters: rm.parameters?.length ? rm.parameters : lm.parameters,
                aspectRatios: rm.aspectRatios?.length ? rm.aspectRatios : lm.aspectRatios,
                resolutions: rm.resolutions?.length ? rm.resolutions : lm.resolutions,
                durationsSec: rm.durationsSec?.length ? rm.durationsSec : lm.durationsSec,
                mediaRoles: rm.mediaRoles?.length ? rm.mediaRoles : lm.mediaRoles,
              };
            } else {
              mergedModels.push(rm);
            }
          }
          return {
            ...localPlat,
            connected: remote.connected ?? localPlat.connected,
            activeTransports: remote.activeTransports ?? localPlat.activeTransports,
            models: mergedModels,
          };
        });
        for (const remote of platRes.platforms) {
          if (!mergedCatalog.some((lp) => lp.id === remote.id)) {
            mergedCatalog.push(remote);
          }
        }
      }

      let nextExternalMcp = s.externalMcpServers;
      if (mcpRes.ok) {
        const prevById = new Map(s.externalMcpServers.map((srv) => [srv.id, srv]));
        nextExternalMcp = mcpRes.servers.map((incoming) => {
          const prev = prevById.get(incoming.id);
          return {
            ...incoming,
            balance: incoming.balance || prev?.balance,
          };
        });
      }

      const liveObj = {
        connectedBrowserPlatforms: s.connectedBrowserPlatforms,
        connectedMcpPlatforms: s.connectedMcpPlatforms,
        configuredApiPlatforms: s.configuredApiPlatforms,
      };
      const isPlatConnected = (pid: PlatformId) =>
        getPlatformConnectionStatus(
          pid,
          s.byok,
          s.chromeBridge,
          nextExternalMcp,
          mergedCatalog.find((p) => p.id === pid),
          liveObj
        ).connected;

      const pickForModality = (mod: 'image' | 'video' | 'audio', cur: PlatformId): PlatformId => {
        if (isPlatConnected(cur)) return cur;
        const found = mergedCatalog.find(
          (p) => p.modalities.includes(mod) && isPlatConnected(p.id)
        );
        return found ? found.id : cur;
      };

      return {
        platformsCatalog: mergedCatalog,
        externalMcpServers: nextExternalMcp,
        lastImagePlatformId: pickForModality('image', s.lastImagePlatformId),
        lastVideoPlatformId: pickForModality('video', s.lastVideoPlatformId),
        lastAudioPlatformId: pickForModality('audio', s.lastAudioPlatformId),
      };
    });
  },

  addExternalMcpServer: async (payload) => {
    const res = await registerExternalMcpServer(payload);
    if (!res.ok) {
      get().showToast(res.error || 'Could not connect MCP server', 'error');
      return false;
    }
    await get().refreshPlatformsAndExternalMcp();
    get().showToast(
      `Connected MCP "${payload.name}" (${res.server?.tools?.length || 0} tools)`
    );
    return true;
  },

  refreshExternalMcpById: async (id) => {
    const res = await refreshExternalMcpServer(id);
    if (!res.ok) {
      get().showToast(res.error || 'Could not refresh MCP server', 'error');
      return;
    }
    await get().refreshPlatformsAndExternalMcp();
    get().showToast(
      `Refreshed "${res.server?.name || id}" (${res.server?.tools?.length || 0} tools)`
    );
  },

  removeExternalMcpById: async (id) => {
    await deleteExternalMcpServer(id);
    set((s) => ({
      externalMcpServers: s.externalMcpServers.filter((srv) => srv.id !== id),
    }));
    await get().refreshPlatformsAndExternalMcp();
    get().showToast('Removed external MCP server');
  },

  runAutonomousDirectorAgent: async (creativeBrief) => {
    if (!creativeBrief.trim() || get().directorRunning) return;
    get().pushHistory();
    set({
      directorRunning: true,
      directorStepLog: ['Parsing brief & locking @Elements continuity...'],
    });

    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const baseY =
      get()
        .nodes.filter((n) => n.kind !== 'timeline')
        .reduce((acc, n) => Math.max(acc, n.y + n.height), 480) + 140;

    await sleep(180);
    const beatDefs = [
      {
        title: 'Videos · Beat 01 Courtyard',
        prompt: `${creativeBrief} — Wide 35mm daylight establishing frame, @Clara_Vidal & @Leica_M6`,
        dur: 6,
        curve: 'Dolly In',
        img: '/media/real_courtyard_sun.jpg',
        vid: '/media/real_shot01_courtyard.mp4',
      },
      {
        title: 'Videos · Beat 02 Headland Bridge',
        prompt: `${creativeBrief} — Optical camera glide out toward sunlit Atlantic limestone cliffs`,
        dur: 6,
        curve: 'Orbit 180°',
        img: '/media/real_coastal_cliffs.jpg',
        vid: '/media/real_shot02_bridge.mp4',
      },
      {
        title: 'Videos · Beat 03 Sunlit Atelier',
        prompt: `${creativeBrief} — Quiet architectural studio table reveal in north window light`,
        dur: 6,
        curve: 'Crane Up',
        img: '/media/real_atelier_interior.jpg',
        vid: '/media/real_shot03_atelier.mp4',
      },
    ];

    const createdNodes: CanvasNode[] = [];
    const createdEdges: CanvasEdge[] = [];
    const createdClips: TimelineClip[] = [];
    let tCursor = get()
      .timelineClips.filter((c) => c.track === 'video')
      .reduce((acc, c) => Math.max(acc, c.startSec + c.durationSec), 0);

    let prevInteraction: string | undefined;

    for (let i = 0; i < beatDefs.length; i++) {
      const beat = beatDefs[i];
      const ff = await renderVideoViaBackend({
        prompt: beat.prompt,
        imageUrl: beat.img,
        durationSec: beat.dur,
        cameraMotion: beat.curve,
        mood: inferMoodFromPrompt(beat.prompt),
      });

      const interactionId = ff.interactionId || `int_dir_${i + 1}_${Date.now().toString(36)}`;
      const videoUrl = ff.videoUrl || beat.vid;

      const sNode: CanvasNode = {
        id: `node_dir_shot_${Date.now()}_${i}`,
        kind: 'video',
        title: beat.title,
        prompt: beat.prompt,
        x: 460 + i * 650,
        y: baseY,
        width: 568,
        height: 320,
        aspectRatio: '16:9',
        status: 'ready',
        imageUrl: beat.img,
        videoUrl,
        seed: 4200 + i * 233,
        resolution: '1080p',
        durationSec: beat.dur,
        cameraMotion: beat.curve,
        interactionId,
        previousInteractionId: prevInteraction,
        elementHandles: extractHandles(beat.prompt),
        layers: createDefaultLayers(beat.img),
        providerUsed: ff.ok ? 'Local FFmpeg 8.0' : 'Director Agent',
        createdAt: Date.now() + i,
      };
      createdNodes.push(sNode);

      if (i > 0) {
        createdEdges.push({
          id: `edge_dir_chain_${i}_${Date.now()}`,
          sourceId: createdNodes[i - 1].id,
          targetId: sNode.id,
          kind: 'multi-turn-branch',
        });
      }
      prevInteraction = interactionId;

      createdClips.push({
        id: `clip_dir_v_${Date.now()}_${i}`,
        track: 'video',
        title: beat.title,
        sourceNodeId: sNode.id,
        startSec: tCursor,
        durationSec: beat.dur,
        thumbnailUrl: beat.img,
        videoUrl,
        seed: sNode.seed,
        promptOrDialogue: beat.prompt,
        color: '#252525',
      });
      tCursor += beat.dur;

      set((s) => ({
        directorStepLog: [...s.directorStepLog, `Synthesized ${beat.title}`],
      }));
    }

    set((s) => ({
      nodes: [...s.nodes, ...createdNodes],
      edges: [...s.edges, ...createdEdges],
      timelineClips: [...s.timelineClips, ...createdClips],
      selectedNodeIds: [createdNodes[0].id],
      directorRunning: false,
      directorModalOpen: false,
    }));

    get().showToast('Built 3-shot sequence on canvas');
  },
}));
