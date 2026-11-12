import { create } from 'zustand';
import type {
  AspectRatio,
  BridgeIncomingEvent,
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
  FrameLayer,
  FrameLayerType,
  MCPServerEntry,
  MCPToolDefinition,
  McpBackendHealth,
  MultiframeBridge,
  MultiframeCard,
  ProviderId,
  ResolutionTier,
  StudioHistorySnapshot,
  StyleDNAPayload,
  TimelineClip,
} from '../types/studio';
import {
  BUILTIN_SKILLS,
  buildBlankStudioGraph,
  buildInitialElements,
  buildInitialStudioGraph,
  createDefaultLayers,
  type MediaCatalogItem,
} from '../presets/studioPresets';
import {
  FOUR_ANGLE_LABELS,
  NINE_GRID_LABELS,
  compositeInpaintRedraw,
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
  compileTimelineViaBackend,
  deleteDiskProject,
  discoverMcpTools,
  executeStudioGeneration,
  exportDiskProjectBundle,
  extractLastFrameViaBackend,
  getActiveApiKeyForProvider,
  getDefaultDiscoveredMcpTools,
  getDiskProject,
  importDiskProjectBundle,
  inpaintViaBackend,
  listDiskProjects,
  normalizeBackendMediaUrl,
  outpaintViaBackend,
  pingChromeBridge,
  probeLiveMcpBackend,
  pushBridgeEventViaBackend,
  removeBgViaBackend,
  renderVideoViaBackend,
  saveDiskProject,
  sliceGridViaBackend,
  uploadMediaViaBackend,
  upscaleViaBackend,
} from '../services/executionRouter';
import {
  compileTimelineToWebm,
  decodeRecipeFromUrlParam,
  downloadTextFile,
  encodeRecipeToUrlParam,
} from '../utils/exporters';

const BYOK_STORAGE_KEY = 'open_dreamflow_byok_v1';
const ACTIVE_PROJECT_KEY = 'dreamflow_active_project_id';
const seenBridgeEventIds = new Set<string>();

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
    geminiModel: 'gemini-omni-1.2-flash',
    seedanceApiKey: '',
    seedanceEndpoint: 'https://ark.ap-southeast.bytepluses.com/api/v3/contents/generations/tasks',
    falApiKey: '',
    falModel: 'fal-ai/wan-pro/image-to-video',
    replicateApiKey: '',
    openaiApiKey: '',
    comfyUiUrl: 'http://127.0.0.1:8188',
  };
}

function extractHandles(text: string): string[] {
  const matches = text.match(/@[A-Za-z0-9_]+/g);
  return matches ? Array.from(new Set(matches)) : [];
}

function inferMoodFromPrompt(prompt: string): string {
  const low = prompt.toLowerCase();
  if (low.includes('sunrise') || low.includes('dawn') || low.includes('golden')) return 'sunrise';
  if (low.includes('night') || low.includes('crimson') || low.includes('midnight')) return 'night';
  return 'rain';
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
  directorModalOpen: boolean;
  directorRunning: boolean;
  directorStepLog: string[];
  toastMessage: string | null;

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

  openProviderModal: (tab?: 'byok' | 'mcp' | 'bridge') => void;
  closeProviderModal: () => void;
  setDirectorModalOpen: (open: boolean) => void;
  showToast: (msg: string) => void;
  setViewport: (panX: number, panY: number, zoom: number) => void;
  toggleSnapToGrid: () => void;
  resetViewport: () => void;
  fitAllNodesInViewport: (vpWidth?: number, vpHeight?: number) => void;
  tidyUpNodes: () => void;
  loadPresetProject: (preset: 'protocol-rain' | 'blank') => void;

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
  triggerTestBridgeCapture: (source?: 'dreamina' | 'flow') => Promise<void>;
  runChatQuickAction: (
    action: 'sequence-3' | 'remix-branch' | 'slice-sheet' | 'compile-master'
  ) => Promise<void>;
  retakeNode: (nodeId: string) => Promise<void>;
  sliceContactSheetNode: (nodeId: string, rows?: number, cols?: number) => Promise<void>;
  generateFourAngleCoverage: (nodeId: string) => Promise<void>;
  convertImageToOmniVideo: (nodeId: string, durationSec?: number) => Promise<void>;
  branchVideoMultiTurn: (nodeId: string, deltaPrompt: string) => Promise<void>;
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
  activeProjectId: 'protocol-rain',
  projectTitle: 'Protocol: Rain',
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
  directorModalOpen: false,
  directorRunning: false,
  directorStepLog: [],
  toastMessage: null,

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

  promptText:
    '@Hero_Kael sprinting across wet Neo-Tokyo rooftop wearing @Cyber_Sneaker, Panavision 40mm anamorphic',
  promptMode: 'video',
  promptSubMode: 'omni-ref',
  promptAspect: '16:9',
  promptDurationSec: 6,
  promptResolution: '720p',
  elements: initialElements,
  skills: BUILTIN_SKILLS,

  multiframes: initialGraph.multiframes,
  bridges: initialGraph.bridges,

  activeProvider: 'local-canvas',
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
    injectElementRefs: true,
    autoStreamMutationObserver: true,
    jobs: [],
  },

  timelineClips: initialGraph.timelineClips,
  playheadSec: 0,
  isPlayingTimeline: false,
  timelineMuted: true,
  masterRenderUrl: '/media/protocol_rain_master.mp4',
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

  openProviderModal: (tab = 'byok') =>
    set({ providerModalOpen: true, providerModalTab: tab }),
  closeProviderModal: () => set({ providerModalOpen: false }),
  setDirectorModalOpen: (directorModalOpen) => set({ directorModalOpen }),

  showToast: (msg) => {
    set({ toastMessage: msg });
    setTimeout(() => {
      if (get().toastMessage === msg) {
        set({ toastMessage: null });
      }
    }, 3200);
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
    if (preset === 'blank') {
      const blank = buildBlankStudioGraph();
      set({
        projectTitle: 'Untitled Canvas',
        nodes: blank.nodes,
        edges: blank.edges,
        timelineClips: blank.timelineClips,
        selectedNodeIds: [],
        panX: 120,
        panY: 80,
        zoom: 0.78,
      });
      get().showToast('Created New Blank Canvas');
    } else {
      const full = buildInitialStudioGraph();
      set({
        projectTitle: 'Protocol: Rain',
        nodes: full.nodes,
        edges: full.edges,
        multiframes: full.multiframes,
        bridges: full.bridges,
        timelineClips: full.timelineClips,
        selectedNodeIds: [],
        panX: 84,
        panY: 54,
        zoom: 0.68,
      });
      get().showToast('Loaded Protocol: Rain preset');
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
          ? { width: 1120, height: 168 }
          : n.kind === 'style-dna'
          ? { width: 300, height: 210 }
          : n.kind === 'video'
          ? { width: 568, height: 320 }
          : getDimensionsForAspect(n.aspectRatio, 340);
      const imageUrl =
        n.kind === 'style-dna' || n.kind === 'mcp-tool' || n.kind === 'timeline'
          ? undefined
          : n.kind === 'contact-sheet'
          ? '/media/contact_sheet_9grid.png'
          : '/media/shot01_rooftop.png';
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
        status: 'ready',
        imageUrl,
        videoUrl: n.kind === 'video' ? '/media/shot01_rooftop.mp4' : undefined,
        seed: n.seed,
        resolution: n.resolution,
        durationSec: n.durationSec,
        interactionId: n.interactionId,
        previousInteractionId: n.previousInteractionId,
        elementHandles: n.elementHandles,
        styleDna: n.styleDna,
        gridSpec:
          n.kind === 'contact-sheet' ? { rows: 3, cols: 3, labels: NINE_GRID_LABELS } : undefined,
        layers: createDefaultLayers(imageUrl),
        providerUsed: 'Restored via ?recipe= URL',
        createdAt: Date.now(),
      };
    });

    set({
      projectTitle: decoded.title || 'Shared Recipe',
      nodes: restoredNodes,
      edges: decoded.edges || [],
      selectedNodeIds: [],
    });
    get().showToast(`Loaded "${decoded.title}"`);
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
    get().showToast('Copied shareable ?recipe= link');
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

    set((s) => ({
      edges: [...s.edges, newEdge],
      nodes:
        resolvedKind === 'style-dna'
          ? s.nodes.map((n) =>
              n.id === targetId ? { ...n, styleDnaId: sourceId } : n
            )
          : s.nodes,
    }));

    // If wired into a Timeline node, automatically append source media to timelineClips!
    if (
      targetNode?.kind === 'timeline' &&
      sourceNode &&
      (sourceNode.kind === 'video' || sourceNode.kind === 'image')
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
      const w = isVid ? 568 : a.kind === 'contact-sheet' ? 480 : 320;
      const h = isVid ? 320 : a.kind === 'contact-sheet' ? 270 : 320;
      newNode = {
        id,
        kind: a.kind,
        title: a.title,
        prompt: `${a.title} · @Hero_Kael @Cyber_Sneaker`,
        x,
        y,
        width: w,
        height: h,
        aspectRatio: isVid || a.kind === 'contact-sheet' ? '16:9' : '1:1',
        status: 'ready',
        imageUrl: isVid ? a.posterUrl || '/media/shot01_rooftop.png' : a.url,
        videoUrl: isVid ? a.url : undefined,
        durationSec: a.durationSec,
        seed: Math.floor(Math.random() * 9000) + 100,
        resolution: '1080p',
        elementHandles: ['@Hero_Kael', '@Cyber_Sneaker'],
        gridSpec:
          a.kind === 'contact-sheet'
            ? { rows: 3, cols: 3, labels: NINE_GRID_LABELS }
            : undefined,
        layers: createDefaultLayers(isVid ? a.posterUrl : a.url),
        providerUsed: 'Asset Vault',
        createdAt: Date.now(),
      };
    } else {
      switch (tool) {
        case 'text': {
          const n = countOfKind('text');
          newNode = {
            id,
            kind: 'text',
            title: `Texts ${n}`,
            prompt:
              upstream?.prompt ||
              'Write a scene description, dialogue beat, or camera prompt for @Hero_Kael...',
            x,
            y,
            width: 320,
            height: 200,
            aspectRatio: '16:9',
            status: 'ready',
            seed: 110 + n,
            resolution: '1080p',
            elementHandles: ['@Hero_Kael'],
            layers: [],
            providerUsed: 'Dreamina Text Node',
            createdAt: Date.now(),
          };
          break;
        }
        case 'image': {
          const n = countOfKind('image');
          const img = upstream?.imageUrl || '/media/shot01_rooftop.png';
          newNode = {
            id,
            kind: 'image',
            title: `Images ${n}`,
            prompt:
              upstream?.prompt ||
              '@Hero_Kael standing under Neo-Tokyo rain neon, Panavision 40mm keyframe',
            x,
            y,
            width: 320,
            height: 320,
            aspectRatio: '1:1',
            status: 'ready',
            imageUrl: img,
            seed: 200 + n * 37,
            resolution: '2K',
            elementHandles: ['@Hero_Kael', '@Cyber_Sneaker'],
            layers: createDefaultLayers(img),
            providerUsed: 'Dreamina Image Node',
            createdAt: Date.now(),
          };
          break;
        }
        case 'video':
        case 'blend': {
          const n = countOfKind('video');
          const isBlend = tool === 'blend';
          const img = isBlend
            ? '/media/shot02b_sunrise_remix.png'
            : upstream?.imageUrl || '/media/shot02_alley_chase.png';
          const vid = isBlend
            ? '/media/shot02b_sunrise_remix.mp4'
            : '/media/shot02_alley_chase.mp4';
          newNode = {
            id,
            kind: 'video',
            title: isBlend ? `Videos ${n} · Multi-Turn` : `Videos ${n}`,
            prompt: isBlend
              ? 'Keep @Hero_Kael motion vector locked; shift alley lighting to golden sunrise'
              : upstream?.prompt ||
                'Dynamic tracking shot of @Hero_Kael sprinting through rain-drenched alley in @Cyber_Sneaker',
            x,
            y,
            width: 568,
            height: 320,
            aspectRatio: '16:9',
            status: 'ready',
            imageUrl: img,
            videoUrl: vid,
            durationSec: 6,
            cameraMotion: 'Dolly In',
            interactionId: `int_omni_${Date.now().toString(36)}`,
            previousInteractionId: upstream?.interactionId,
            seed: 500 + n * 41,
            resolution: '1080p',
            elementHandles: ['@Hero_Kael', '@Cyber_Sneaker'],
            layers: createDefaultLayers(img),
            providerUsed: 'Local FFmpeg 8.0 · $0.00',
            createdAt: Date.now(),
          };
          break;
        }
        case 'audio': {
          const n = countOfKind('audio');
          newNode = {
            id,
            kind: 'audio',
            title: `Audios ${n}`,
            prompt: 'Binaural Neo-Tokyo rain ambience + 55Hz anamorphic sub-bass pulse',
            x,
            y,
            width: 340,
            height: 150,
            aspectRatio: '16:9',
            status: 'ready',
            durationSec: 8,
            seed: 600 + n,
            resolution: '1080p',
            elementHandles: [],
            layers: [],
            providerUsed: 'Native Stereo Audio',
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
            height: 168,
            aspectRatio: '16:9',
            status: 'ready',
            videoUrl: '/media/protocol_rain_master.mp4',
            durationSec: 18,
            seed: 900 + n,
            resolution: '1080p',
            elementHandles: [],
            layers: [],
            providerUsed: 'Dreamina Spatial Timeline',
            createdAt: Date.now(),
          };
          break;
        }
        case 'element': {
          const n = countOfKind('element');
          const isSneaker = n % 2 === 0;
          const img = isSneaker
            ? '/media/cyber_sneaker_vault.png'
            : '/media/hero_kael_vault.png';
          const handle = isSneaker ? '@Cyber_Sneaker' : '@Hero_Kael';
          newNode = {
            id,
            kind: 'element',
            title: `Elements ${n} · ${handle}`,
            prompt: `${handle} 6-reference visual continuity anchor`,
            x,
            y,
            width: 280,
            height: 280,
            aspectRatio: '1:1',
            status: 'ready',
            imageUrl: img,
            seed: 300 + n,
            resolution: '2K',
            elementHandles: [handle],
            layers: createDefaultLayers(img),
            providerUsed: 'Element Continuity Vault',
            createdAt: Date.now(),
          };
          break;
        }
        case 'cinema-kit': {
          const n = countOfKind('style-dna');
          const dna = extractStyleDnaFromPrompt('Neo-Tokyo 500T @Brand_Style');
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
            elementHandles: ['@Brand_Style'],
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
            title: `Images ${n} · 9-Grid Contact Sheet`,
            prompt:
              '/9-Grid Storyboard @Hero_Kael & @Cyber_Sneaker rain coverage across 9 lenses',
            x,
            y,
            width: 480,
            height: 270,
            aspectRatio: '16:9',
            status: 'ready',
            imageUrl: '/media/contact_sheet_9grid.png',
            seed: 512 + n,
            resolution: '4K',
            elementHandles: ['@Hero_Kael', '@Cyber_Sneaker'],
            gridSpec: { rows: 3, cols: 3, labels: NINE_GRID_LABELS },
            layers: createDefaultLayers('/media/contact_sheet_9grid.png'),
            providerUsed: '9-Grid Slicer',
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
            prompt:
              'Director Note:\n• Keep 40mm anamorphic bokeh consistent\n• Cut on sneaker puddle impact at 00:06',
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

    if (newNode.kind === 'timeline' && upstream && (upstream.kind === 'video' || upstream.kind === 'image')) {
      get().sendNodeToTimeline(upstream.id);
    }

    return id;
  },

  uploadLocalMediaNode: (file, worldX = 520, worldY = 260) => {
    const objectUrl = URL.createObjectURL(file);
    const isVideo = file.type.startsWith('video/');
    const isAudio = file.type.startsWith('audio/');
    get().pushHistory();

    const id = `node_upload_${Date.now()}`;
    const newNode: CanvasNode = {
      id,
      kind: isVideo ? 'video' : isAudio ? 'audio' : 'image',
      title: file.name.slice(0, 28),
      prompt: `Uploaded media: ${file.name}`,
      x: Math.round(worldX / 10) * 10,
      y: Math.round(worldY / 10) * 10,
      width: isVideo ? 568 : isAudio ? 340 : 340,
      height: isVideo ? 320 : isAudio ? 150 : 340,
      aspectRatio: isVideo ? '16:9' : '1:1',
      status: 'ready',
      editBadge: 'Uploading…',
      imageUrl: !isVideo && !isAudio ? objectUrl : undefined,
      videoUrl: isVideo ? objectUrl : undefined,
      audioUrl: isAudio ? objectUrl : undefined,
      durationSec: isVideo || isAudio ? 8 : undefined,
      seed: Math.floor(Math.random() * 9000),
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

    const spawnX = anchorNode
      ? anchorNode.x + anchorNode.width + 110
      : 600;
    const spawnY = anchorNode ? anchorNode.y : 160;
    const seed = Math.floor(Math.random() * 9000) + 100;
    const tempId = `node_gen_${Date.now()}`;

    const isGrid9 =
      promptMode === '9-grid' || effectivePrompt.includes('/9-Grid');
    const isGrid4 =
      promptMode === '4-angle' || effectivePrompt.includes('/4-Angle');
    const isVideo =
      !isGrid9 &&
      !isGrid4 &&
      (promptMode === 'video' || anchorNode?.kind === 'video' || anchorNode?.kind === 'image');

    const width = isVideo ? 568 : isGrid9 || isGrid4 ? 480 : 320;
    const height = isVideo ? 320 : isGrid9 || isGrid4 ? 270 : 320;

    const defaultSourceImg = isGrid9
      ? '/media/contact_sheet_9grid.png'
      : anchorNode?.imageUrl || refImages[0] || '/media/shot01_rooftop.png';

    const placeholderNode: CanvasNode = {
      id: tempId,
      kind: isGrid9 || isGrid4 ? 'contact-sheet' : isVideo ? 'video' : 'image',
      title: isGrid9
        ? 'Images · 9-Grid Sheet'
        : isGrid4
        ? 'Images · 4-Angle Sheet'
        : isVideo
        ? `Videos · ${promptDurationSec}s Shot`
        : 'Images · Synthesized Frame',
      prompt: effectivePrompt,
      x: spawnX,
      y: spawnY,
      width,
      height,
      aspectRatio: promptAspect,
      status: 'generating',
      progress: 35,
      imageUrl: defaultSourceImg,
      seed,
      resolution: promptResolution,
      durationSec: isVideo ? promptDurationSec : undefined,
      elementHandles: handles,
      layers: createDefaultLayers(defaultSourceImg),
      providerUsed: activeProvider,
      createdAt: Date.now(),
    };

    set((s) => ({
      nodes: [...s.nodes, placeholderNode],
      selectedNodeIds: [tempId],
      edges: anchorNode
        ? [
            ...s.edges,
            {
              id: `edge_gen_${tempId}`,
              sourceId: anchorNode.id,
              targetId: tempId,
              kind: 'lineage',
            },
          ]
        : s.edges,
    }));

    const execResult = await executeStudioGeneration({
      provider: activeProvider,
      prompt: effectivePrompt,
      aspectRatio: promptAspect,
      durationSec: promptDurationSec,
      resolution: promptResolution,
      mode: isGrid9 ? '9-grid' : isVideo ? 'video' : 'image',
      referenceImages: refImages,
      firstFrameDataUrl: defaultSourceImg,
      mood: inferMoodFromPrompt(effectivePrompt),
      byok,
    });

    let imageUrl = execResult.imageUrl;
    let gridSpec: CanvasNode['gridSpec'];

    if (!imageUrl) {
      if (isGrid9) {
        imageUrl = '/media/contact_sheet_9grid.png';
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
    }

    set((s) => ({
      nodes: s.nodes.map((n) =>
        n.id === tempId
          ? {
              ...n,
              status: 'ready',
              progress: 100,
              imageUrl,
              videoUrl: execResult.videoUrl,
              interactionId: execResult.interactionId,
              gridSpec,
              layers: createDefaultLayers(imageUrl),
              providerUsed: execResult.providerLabel,
            }
          : n
      ),
    }));

    get().showToast(`Synthesized ${placeholderNode.title}`);
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
    const sourceImage = node.imageUrl || '/media/shot01_rooftop.png';
    get().pushHistory();

    const { activeProvider, byok } = get();
    const apiKey = getActiveApiKeyForProvider(activeProvider, byok);
    const promptToUse = regionalPrompt || 'Cinema lighting & texture detail redraw';

    const childId = `node_inpaint_${Date.now()}`;
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
      editBadge: 'Inpainting…',
      imageUrl: undefined,
      seed: node.seed + 19,
      resolution: node.resolution,
      elementHandles: node.elementHandles,
      layers: [],
      providerUsed: 'FFmpeg Inpaint (:3001)',
      createdAt: Date.now(),
    };

    set((s) => ({
      nodes: [...s.nodes, childNode],
      edges: [
        ...s.edges,
        {
          id: `edge_inpaint_${Date.now()}`,
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
              providerUsed: live.ok ? `FFmpeg Inpaint (${live.engine || 'local'})` : 'Canvas Inpaint',
            }
          : n
      ),
    }));
    get().showToast('Synthesized Inpaint frame');
  },

  expandOutpaintNode: async (nodeId, targetAspect, customPrompt) => {
    const node = get().nodes.find((n) => n.id === nodeId);
    if (!node) return;
    const sourceImage = node.imageUrl || '/media/shot01_rooftop.png';
    get().pushHistory();

    const { activeProvider, byok } = get();
    const apiKey = getActiveApiKeyForProvider(activeProvider, byok);
    const newDims = getDimensionsForAspect(targetAspect, 440);
    const childId = `node_outpaint_${Date.now()}`;
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
      editBadge: `Outpainting ${targetAspect}…`,
      imageUrl: undefined,
      seed: node.seed + 31,
      resolution: '2K',
      elementHandles: node.elementHandles,
      layers: [],
      providerUsed: 'FFmpeg Outpaint (:3001)',
      createdAt: Date.now(),
    };

    set((s) => ({
      nodes: [...s.nodes, childNode],
      edges: [
        ...s.edges,
        {
          id: `edge_outpaint_${Date.now()}`,
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
              providerUsed: live.ok ? 'FFmpeg Outpaint (:3001)' : 'Canvas Outpaint',
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

    const sourceImage = node.imageUrl || '/media/hero_kael_vault.png';
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

    const sourceImage = node.imageUrl || '/media/shot01_rooftop.png';
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
        imageUrl: node.imageUrl || '/media/shot01_rooftop.png',
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
        ? '/media/contact_sheet_9grid.png'
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
    get().pushHistory();
    const { activeProvider, byok } = get();

    get().showToast(`Synthesizing ${durationSec}s video via :3001...`);

    const exec = await executeStudioGeneration({
      provider: activeProvider === 'local-canvas' ? 'gemini-omni' : activeProvider,
      prompt: node.prompt,
      aspectRatio: '16:9',
      durationSec,
      resolution: node.resolution,
      mode: 'video',
      firstFrameDataUrl: node.imageUrl || '/media/shot01_rooftop.png',
      cameraMotion: 'Dolly In',
      mood: inferMoodFromPrompt(node.prompt),
      byok,
    });

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
      imageUrl: node.imageUrl || '/media/shot01_rooftop.png',
      videoUrl: exec.videoUrl || '/media/shot01_rooftop.mp4',
      seed: node.seed,
      resolution: node.resolution,
      durationSec,
      cameraMotion: 'Dolly In',
      interactionId: exec.interactionId,
      elementHandles: node.elementHandles,
      layers: createDefaultLayers(node.imageUrl),
      providerUsed: exec.providerLabel,
      createdAt: Date.now(),
    };

    set((s) => ({
      nodes: [...s.nodes, newVideoNode],
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

    get().showToast(`Rendered ${durationSec}s video`);
  },

  branchVideoMultiTurn: async (nodeId, deltaPrompt) => {
    const parent = get().nodes.find((n) => n.id === nodeId);
    if (!parent) return;
    get().pushHistory();
    const parentInteractionId = parent.interactionId || `int_omni_${parent.seed}`;
    const { activeProvider, byok } = get();

    const mood = inferMoodFromPrompt(deltaPrompt);
    const branchKeyframe =
      mood === 'sunrise'
        ? '/media/shot02b_sunrise_remix.png'
        : parent.imageUrl || '/media/shot02_alley_chase.png';

    get().showToast(`Branching Multi-Turn edit (${parentInteractionId.slice(0, 12)})...`);

    const exec = await executeStudioGeneration({
      provider: activeProvider === 'local-canvas' ? 'gemini-omni' : activeProvider,
      prompt: deltaPrompt,
      aspectRatio: '16:9',
      durationSec: parent.durationSec || 6,
      resolution: parent.resolution,
      mode: 'video',
      firstFrameDataUrl: branchKeyframe,
      previousInteractionId: parentInteractionId,
      mood,
      byok,
    });

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
      videoUrl: exec.videoUrl || '/media/shot02b_sunrise_remix.mp4',
      seed: parent.seed + 211,
      resolution: parent.resolution,
      durationSec: parent.durationSec || 6,
      cameraMotion: 'Multi-Turn Branch',
      interactionId: exec.interactionId,
      previousInteractionId: parentInteractionId,
      elementHandles: Array.from(
        new Set([...parent.elementHandles, ...extractHandles(deltaPrompt)])
      ),
      layers: createDefaultLayers(branchKeyframe),
      providerUsed: exec.providerLabel,
      createdAt: Date.now(),
    };

    set((s) => ({
      nodes: [...s.nodes, branchedNode],
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

    get().showToast(`Branched stateful video`);
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
      firstFrameDataUrl: '/media/shot01_rooftop.png',
      mcpTool: mcpNode.mcpTool,
      byok: get().byok,
    });

    const outId = `node_mcp_out_${Date.now()}`;
    const img = exec.imageUrl || '/media/shot01_rooftop.png';

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
      videoUrl: exec.videoUrl || (isVidTool ? '/media/shot01_rooftop.mp4' : undefined),
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
      `Keyframe 0${idx} · @Hero_Kael & @Cyber_Sneaker camera progression`;
    const imageUrl = srcNode?.imageUrl || '/media/shot01_rooftop.png';

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

      const resolvedVideoUrl = ff.videoUrl || fromCard.videoUrl || '/media/shot01_rooftop.mp4';
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
        promptTemplate: `Execute MCP ${t.name}: @Hero_Kael & @Cyber_Sneaker`,
        recommendedMode: t.name.includes('video') ? ('video' as const) : ('image' as const),
        mcpToolName: t.name,
      }));

      const masterFile = health.mediaFiles.find(
        (f) => f === 'protocol_rain_master.mp4' || f.startsWith('master_cut_')
      );
      const nextMaster = masterFile
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
  },

  setActiveProvider: (activeProvider) => set({ activeProvider }),

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

    const timelineNode = get().nodes.find((n) => n.kind === 'timeline');
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
      lipSyncCharacter: track === 'voice' ? '@Hero_Kael' : undefined,
      audioFreqHz: track === 'voice' ? 185 : undefined,
      sfxKind: track === 'sfx' ? 'cyber-synth' : undefined,
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
      directNode?.prompt || targetClip?.promptOrDialogue || '@Hero_Kael rooftop';
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
      lastFrameUrl = '/media/lastframe_shot02.png';
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
            imageUrl: clip.thumbnailUrl || '/media/shot01_rooftop.png',
            durationSec: clip.durationSec,
          });
          if (rendered.ok && rendered.videoUrl) {
            clipUrls.push(rendered.videoUrl);
          }
        }
      }

      if (clipUrls.length > 0) {
        const compiled = await compileTimelineViaBackend({
          clips: clipUrls,
          title: projectTitle,
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
      appRenderLog: [`Locking continuity (${selectedHandles.join(', ') || '@Hero_Kael'})...`],
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
      finalMasterUrl = '/media/protocol_rain_master.mp4';
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
        'Build a 3-shot @Hero_Kael & @Cyber_Sneaker rooftop rain pursuit sequence'
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
        text: `Branch Multi-Turn Remix on "${target.title}" -> Golden dawn weather shift`,
        timestamp: Date.now(),
      };
      set((s) => ({ chatMessages: [...s.chatMessages, userMsg] }));

      const beforeIds = new Set(get().nodes.map((n) => n.id));
      await get().branchVideoMultiTurn(
        target.id,
        'Shift weather from neon midnight rain to golden sunrise dawn over @Hero_Kael'
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
            videoUrl: created?.videoUrl || '/media/shot02b_sunrise_remix.mp4',
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
            videoUrl: masterUrl || '/media/protocol_rain_master.mp4',
          },
        ],
      }));
    }
  },

  bootDiskPersistence: async () => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('recipe')) return;

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
          if (Array.isArray(parsed.nodes) && parsed.nodes.length > 0) {
            set({
              activeProjectId: parsed.id || 'protocol-rain',
              projectTitle: parsed.name || 'Protocol: Rain',
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

    set({ diskProjects: listing.projects });

    const preferredId =
      (() => {
        try {
          return localStorage.getItem(ACTIVE_PROJECT_KEY);
        } catch {
          return null;
        }
      })() || listing.projects[0]?.id;

    if (preferredId && listing.projects.some((p) => p.id === preferredId)) {
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
          projectTitle: loaded.project.name || 'Protocol: Rain',
          nodes: st.nodes,
          edges: Array.isArray(st.edges) ? st.edges : [],
          elements: Array.isArray(st.elements) ? st.elements : get().elements,
          multiframes: Array.isArray(st.multiframes)
            ? st.multiframes
            : get().multiframes,
          bridges: Array.isArray(st.bridges) ? st.bridges : get().bridges,
          timelineClips: Array.isArray(st.timelineClips)
            ? st.timelineClips
            : get().timelineClips,
          projectSnapshots: Array.isArray(loaded.project.snapshots)
            ? loaded.project.snapshots
            : [],
          selectedNodeIds: [],
          saveStatus: 'saved',
        });
        return;
      }
    }

    // Seed initial Protocol: Rain project onto disk
    await get().persistActiveProjectToDisk({
      createSnapshot: true,
      snapshotLabel: 'Initial Protocol: Rain',
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
      elements: Array.isArray(st.elements) ? st.elements : get().elements,
      multiframes: Array.isArray(st.multiframes)
        ? st.multiframes
        : get().multiframes,
      bridges: Array.isArray(st.bridges) ? st.bridges : get().bridges,
      timelineClips: Array.isArray(st.timelineClips) ? st.timelineClips : [],
      projectSnapshots: Array.isArray(loaded.project.snapshots)
        ? loaded.project.snapshots
        : [],
      selectedNodeIds: [],
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
      multiframes: blank.multiframes,
      bridges: blank.bridges,
      timelineClips: blank.timelineClips,
      projectSnapshots: [],
      selectedNodeIds: [],
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
        get().loadPresetProject('protocol-rain');
        set({ activeProjectId: 'protocol-rain' });
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
        elements: Array.isArray(st.elements) ? st.elements : get().elements,
        multiframes: Array.isArray(st.multiframes)
          ? st.multiframes
          : get().multiframes,
        bridges: Array.isArray(st.bridges) ? st.bridges : get().bridges,
        timelineClips: Array.isArray(st.timelineClips) ? st.timelineClips : [],
        projectSnapshots: Array.isArray(proj.snapshots) ? proj.snapshots : [],
        selectedNodeIds: [],
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
    if (!ev || (ev.type !== 'bridge_asset' && ev.type !== 'bridge_prompt')) {
      if (ev?.type === 'bridge_session') {
        set((s) => ({
          chromeBridge: {
            ...s.chromeBridge,
            extensionDetected: true,
            dreaminaTabConnected:
              ev.source === 'dreamina' ? true : s.chromeBridge.dreaminaTabConnected,
            flowTabConnected:
              ev.source === 'flow' ? true : s.chromeBridge.flowTabConnected,
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
    const isTextOnly = ev.type === 'bridge_prompt' && !mediaUrl;

    const sourceLabel =
      ev.source === 'flow' ? 'Google Flow' : ev.source === 'dreamina' ? 'Dreamina' : 'Bridge';

    const nodeId = `node_bridge_${Date.now()}`;
    const newNode: CanvasNode = {
      id: nodeId,
      kind: isTextOnly ? 'text' : isVideo ? 'video' : 'image',
      title: ev.title || `Bridge · ${sourceLabel}`,
      prompt: ev.prompt || `Captured from ${sourceLabel}`,
      x: maxRight + 96,
      y: 160,
      width: isVideo ? 568 : isTextOnly ? 320 : 380,
      height: isVideo ? 320 : isTextOnly ? 210 : 240,
      aspectRatio: '16:9',
      status: 'ready',
      imageUrl: !isTextOnly && !isVideo ? mediaUrl || '/media/shot01_rooftop.png' : '/media/shot01_rooftop.png',
      videoUrl: isVideo ? mediaUrl : undefined,
      durationSec: isVideo ? 6 : undefined,
      seed: Math.floor(Math.random() * 9000),
      resolution: '1080p',
      elementHandles: extractHandles(ev.prompt || ''),
      layers:
        !isTextOnly && !isVideo
          ? createDefaultLayers(mediaUrl || '/media/shot01_rooftop.png')
          : [],
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
          ev.source === 'dreamina' ? true : s.chromeBridge.dreaminaTabConnected,
        flowTabConnected:
          ev.source === 'flow' ? true : s.chromeBridge.flowTabConnected,
      },
    }));

    get().showToast(`Bridge · Imported from ${sourceLabel}`);
    return true;
  },

  triggerTestBridgeCapture: async (source = 'dreamina') => {
    const testEvent: BridgeIncomingEvent = {
      eventId: `evt_test_${Date.now()}`,
      timestamp: Date.now(),
      type: 'bridge_asset',
      source,
      title:
        source === 'flow'
          ? 'Bridge · Flow Scene Capture'
          : 'Bridge · Dreamina Keyframe',
      mediaUrl:
        source === 'flow'
          ? '/media/shot02_alley_chase.mp4'
          : '/media/shot02b_sunrise_remix.png',
      prompt:
        source === 'flow'
          ? 'Captured live 6s tracking shot from Google Flow via ws://localhost:3001/bridge'
          : 'Captured live sunrise keyframe from Dreamina Canvas via ws://localhost:3001/bridge',
    };

    const pushed = await pushBridgeEventViaBackend(testEvent);
    // If WebSocket broadcast hasn't ingested it within 350ms (e.g. offline), ingest locally
    setTimeout(() => {
      if (!seenBridgeEventIds.has(testEvent.eventId!)) {
        get().ingestBridgeWsEvent(testEvent);
      }
    }, pushed.ok ? 350 : 20);
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
        title: 'Videos · Beat 01 Hook',
        prompt: `${creativeBrief} — Wide establishing shot, @Hero_Kael & @Cyber_Sneaker`,
        dur: 6,
        curve: 'Dolly In',
        img: '/media/shot01_rooftop.png',
        vid: '/media/shot01_rooftop.mp4',
      },
      {
        title: 'Videos · Beat 02 Action',
        prompt: `${creativeBrief} — Dynamic tracking pursuit`,
        dur: 6,
        curve: 'Orbit 180°',
        img: '/media/shot02_alley_chase.png',
        vid: '/media/shot02_alley_chase.mp4',
      },
      {
        title: 'Videos · Beat 03 Dawn Climax',
        prompt: `${creativeBrief} — Golden dawn reveal`,
        dur: 6,
        curve: 'Crane Up',
        img: '/media/shot02b_sunrise_remix.png',
        vid: '/media/shot02b_sunrise_remix.mp4',
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
