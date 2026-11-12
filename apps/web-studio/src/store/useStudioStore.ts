import { create } from 'zustand';
import type {
  AspectRatio,
  BYOKCredentials,
  CameraTransitionCurve,
  CanvasEdge,
  CanvasNode,
  ChromeBridgeState,
  DreaminaSkill,
  ElementVault,
  FrameLayer,
  FrameLayerType,
  MCPServerEntry,
  MCPToolDefinition,
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
  buildInitialElements,
  buildInitialStudioGraph,
  createDefaultLayers,
} from '../presets/studioPresets';
import {
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
  discoverMcpTools,
  executeStudioGeneration,
  getDefaultDiscoveredMcpTools,
  pingChromeBridge,
} from '../services/executionRouter';
import {
  decodeRecipeFromUrlParam,
  encodeRecipeToUrlParam,
} from '../utils/exporters';

const BYOK_STORAGE_KEY = 'open_dreamflow_byok_v1';

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

export type ActiveWorkspaceView = 'canvas' | 'multiframes' | 'split';

export interface StudioState {
  projectTitle: string;
  activeView: ActiveWorkspaceView;
  timelineExpanded: boolean;
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

  past: StudioHistorySnapshot[];
  future: StudioHistorySnapshot[];

  promptText: string;
  promptMode: 'image' | 'video' | '9-grid' | '4-angle' | 'multi-turn';
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
  chromeBridge: ChromeBridgeState;

  timelineClips: TimelineClip[];
  playheadSec: number;
  isPlayingTimeline: boolean;

  setProjectTitle: (title: string) => void;
  setActiveView: (view: ActiveWorkspaceView) => void;
  setTimelineExpanded: (expanded: boolean) => void;
  openProviderModal: (tab?: 'byok' | 'mcp' | 'bridge') => void;
  closeProviderModal: () => void;
  setDirectorModalOpen: (open: boolean) => void;
  showToast: (msg: string) => void;
  setViewport: (panX: number, panY: number, zoom: number) => void;
  toggleSnapToGrid: () => void;
  resetViewport: () => void;

  pushHistory: () => void;
  undo: () => void;
  redo: () => void;
  hydrateFromUrlRecipe: () => void;
  copyShareableRecipeUrl: () => string;

  selectNodes: (ids: string[], additive?: boolean) => void;
  moveNodes: (ids: string[], dx: number, dy: number) => void;
  commitNodePositions: () => void;
  connectNodes: (sourceId: string, targetId: string, kind?: CanvasEdge['kind'], label?: string) => void;
  deleteSelectedNodes: () => void;

  setPromptText: (text: string) => void;
  setPromptMode: (mode: StudioState['promptMode']) => void;
  setPromptAspect: (aspect: AspectRatio) => void;
  setPromptDurationSec: (sec: number) => void;
  setPromptResolution: (res: ResolutionTier) => void;
  applySkillPreset: (skill: DreaminaSkill) => void;
  submitPromptGeneration: () => Promise<void>;

  applyInpaintToNode: (nodeId: string, maskDataUrl: string, regionalPrompt: string) => Promise<void>;
  expandOutpaintNode: (nodeId: string, targetAspect: AspectRatio) => Promise<void>;
  removeBgAndDecomposeLayers: (nodeId: string) => void;
  updateNodeLayer: (nodeId: string, layerId: FrameLayerType, patch: Partial<FrameLayer>) => void;
  upscaleNodeHd: (nodeId: string, targetRes: '2K' | '4K') => void;
  retakeNode: (nodeId: string) => Promise<void>;
  sliceContactSheetNode: (nodeId: string, rows?: number, cols?: number) => Promise<void>;
  generateFourAngleCoverage: (nodeId: string) => Promise<void>;
  convertImageToOmniVideo: (nodeId: string, durationSec?: number) => Promise<void>;
  branchVideoMultiTurn: (nodeId: string, deltaPrompt: string) => Promise<void>;
  executeMcpToolNode: (nodeId: string) => Promise<void>;

  addElementVault: (handle: string, name: string, category: ElementVault['category'], description: string) => void;
  addReferenceImageToVault: (vaultId: string, label: string, dataUrl: string) => void;
  removeReferenceFromVault: (vaultId: string, refId: string) => void;
  spawnStyleDnaNode: (sourceNodeId?: string) => void;
  updateStyleDnaNode: (nodeId: string, patch: Partial<StyleDNAPayload>) => void;

  addMultiframeFromNodeOrBlank: (nodeId?: string) => void;
  removeMultiframeCard: (cardId: string) => void;
  updateMultiframeCard: (cardId: string, patch: Partial<MultiframeCard>) => void;
  updateMultiframeBridge: (bridgeId: string, patch: Partial<MultiframeBridge>) => void;
  synthesizeMultiframeSequence: () => Promise<void>;

  setActiveProvider: (provider: ProviderId) => void;
  updateByok: (patch: Partial<BYOKCredentials>) => void;
  clearByokKeys: () => void;
  addMcpServer: (name: string, url: string, transport: 'websocket' | 'http-sse') => Promise<void>;
  refreshMcpServer: (serverId: string) => Promise<void>;
  spawnMcpToolAsCanvasNode: (tool: MCPToolDefinition) => void;
  pingBridge: () => void;
  handleIncomingBridgeEvent: (msg: {
    type?: string;
    payload?: Record<string, unknown>;
  }) => void;

  setPlayheadSec: (sec: number) => void;
  setIsPlayingTimeline: (playing: boolean) => void;
  sendNodeToTimeline: (nodeId: string) => void;
  addVoiceOrSfxClip: (track: 'voice' | 'sfx', title: string, dialogueOrSfx: string, durationSec?: number) => void;
  removeTimelineClip: (clipId: string) => void;
  extractLastFrameToNextShot: (clipId?: string) => void;
  runAutonomousDirectorAgent: (creativeBrief: string) => Promise<void>;
}

const initialGraph = buildInitialStudioGraph();
const initialElements = buildInitialElements();

const defaultMcpTools = getDefaultDiscoveredMcpTools(
  'ws://localhost:3001/mcp',
  'Local Open-DreamFlow MCP Bridge'
);

export const useStudioStore = create<StudioState>((set, get) => ({
  projectTitle: 'Neo-Tokyo AeroFlux Spot',
  activeView: 'canvas',
  timelineExpanded: true,
  providerModalOpen: false,
  providerModalTab: 'byok',
  directorModalOpen: false,
  directorRunning: false,
  directorStepLog: [],
  toastMessage: null,

  panX: 36,
  panY: 28,
  zoom: 0.88,
  snapToGrid: true,

  nodes: initialGraph.nodes,
  edges: initialGraph.edges,
  selectedNodeIds: ['node-shot-hero'],

  past: [],
  future: [],

  promptText:
    '@Hero_Kael sprinting across wet cyberpunk rooftop wearing @Cyber_Sneaker, @Brand_Style anamorphic halation',
  promptMode: 'image',
  promptAspect: '16:9',
  promptDurationSec: 10,
  promptResolution: '1080p',
  elements: initialElements,
  skills: BUILTIN_SKILLS,

  multiframes: initialGraph.multiframes,
  bridges: initialGraph.bridges,

  activeProvider: 'local-canvas',
  byok: loadSavedByok(),
  mcpServers: [
    {
      id: 'mcp-local-default',
      name: 'Local Open-DreamFlow MCP Bridge',
      url: 'ws://localhost:3001/mcp',
      transport: 'websocket',
      status: 'simulated',
      tools: defaultMcpTools,
      lastPingMs: 12,
    },
  ],
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

  setProjectTitle: (projectTitle) => set({ projectTitle }),
  setActiveView: (activeView) => set({ activeView }),
  setTimelineExpanded: (timelineExpanded) => set({ timelineExpanded }),
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
    }, 3400);
  },

  setViewport: (panX, panY, zoom) =>
    set({ panX, panY, zoom: Math.min(2.4, Math.max(0.22, zoom)) }),
  toggleSnapToGrid: () => set((s) => ({ snapToGrid: !s.snapToGrid })),
  resetViewport: () => set({ panX: 36, panY: 28, zoom: 0.88 }),

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
    get().showToast('Undid canvas action');
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
    get().showToast('Redid canvas action');
  },

  hydrateFromUrlRecipe: () => {
    const params = new URLSearchParams(window.location.search);
    const encoded = params.get('recipe');
    if (!encoded) return;
    const decoded = decodeRecipeFromUrlParam(encoded);
    if (!decoded) return;

    const restoredNodes: CanvasNode[] = decoded.nodes.map((n) => {
      const dims =
        n.kind === 'style-dna'
          ? { width: 290, height: 220 }
          : getDimensionsForAspect(n.aspectRatio, 360);
      const imageUrl =
        n.kind === 'style-dna' || n.kind === 'mcp-tool'
          ? undefined
          : n.kind === 'contact-sheet'
          ? renderContactSheetDataUrl(3, 3, n.prompt, n.seed).dataUrl
          : renderShotDataUrl(n.aspectRatio, {
              prompt: n.prompt,
              seed: n.seed,
              cameraLabel: n.title,
            });
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
        seed: n.seed,
        resolution: n.resolution,
        durationSec: n.durationSec,
        interactionId: n.interactionId,
        previousInteractionId: n.previousInteractionId,
        elementHandles: n.elementHandles,
        styleDna: n.styleDna,
        gridSpec: n.kind === 'contact-sheet' ? { rows: 3, cols: 3, labels: [] } : undefined,
        layers: createDefaultLayers(imageUrl),
        providerUsed: 'Restored via ?recipe= URL',
        createdAt: Date.now(),
      };
    });

    set({
      projectTitle: decoded.title || 'Shared Recipe Scene',
      nodes: restoredNodes,
      edges: decoded.edges || [],
      selectedNodeIds: restoredNodes[0] ? [restoredNodes[0].id] : [],
    });
    get().showToast(`Loaded shared recipe "${decoded.title}"`);
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
    get().showToast('Copied ?recipe= URL to clipboard!');
    return fullUrl;
  },

  selectNodes: (ids, additive = false) =>
    set((s) => {
      if (!additive) return { selectedNodeIds: ids };
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
    const grid = 16;
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
    const resolvedKind = sourceNode?.kind === 'style-dna' ? 'style-dna' : kind;
    const newEdge: CanvasEdge = {
      id: `edge_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      sourceId,
      targetId,
      kind: resolvedKind,
      label: label || (resolvedKind === 'style-dna' ? 'Style DNA Lock' : 'Connected'),
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
  },

  deleteSelectedNodes: () => {
    const { selectedNodeIds } = get();
    if (selectedNodeIds.length === 0) return;
    get().pushHistory();
    set((s) => ({
      nodes: s.nodes.filter((n) => !selectedNodeIds.includes(n.id)),
      edges: s.edges.filter(
        (e) => !selectedNodeIds.includes(e.sourceId) && !selectedNodeIds.includes(e.targetId)
      ),
      selectedNodeIds: [],
    }));
  },

  setPromptText: (promptText) => set({ promptText }),
  setPromptMode: (promptMode) => set({ promptMode }),
  setPromptAspect: (promptAspect) => set({ promptAspect }),
  setPromptDurationSec: (promptDurationSec) => set({ promptDurationSec }),
  setPromptResolution: (promptResolution) => set({ promptResolution }),

  applySkillPreset: (skill) => {
    set({
      promptText: skill.promptTemplate,
      promptMode: skill.recommendedMode,
      promptDurationSec: skill.durationSec || get().promptDurationSec,
    });
    get().showToast(`Activated skill ${skill.slash}`);
  },

  submitPromptGeneration: async () => {
    const {
      promptText,
      promptMode,
      promptAspect,
      promptDurationSec,
      promptResolution,
      activeProvider,
      byok,
      elements,
      nodes,
      selectedNodeIds,
    } = get();

    if (!promptText.trim()) return;

    const selectedPrimary = nodes.find((n) => n.id === selectedNodeIds[0]);
    if (promptMode === 'multi-turn' && selectedPrimary) {
      await get().branchVideoMultiTurn(selectedPrimary.id, promptText);
      return;
    }

    get().pushHistory();
    const handles = extractHandles(promptText);
    const refImages: string[] = [];
    elements.forEach((v) => {
      if (handles.includes(v.handle)) {
        v.references.slice(0, 2).forEach((r) => refImages.push(r.dataUrl));
      }
    });

    const activeStyleNode =
      nodes.find((n) => n.id === selectedPrimary?.styleDnaId) ||
      nodes.find((n) => n.kind === 'style-dna');
    const palette = activeStyleNode?.styleDna?.palette;

    const maxRight = nodes.reduce((acc, n) => Math.max(acc, n.x + n.width), 360);
    const spawnX = Math.round((maxRight + 72) / 16) * 16;
    const spawnY = 140;
    const seed = Math.floor(Math.random() * 9000) + 100;
    const dims = getDimensionsForAspect(promptAspect, 360);
    const tempId = `node_gen_${Date.now()}`;

    const isGrid9 = promptMode === '9-grid' || promptText.includes('/9-Grid');
    const isGrid4 = promptMode === '4-angle' || promptText.includes('/4-Angle');
    const isVideo = promptMode === 'video';

    const placeholderNode: CanvasNode = {
      id: tempId,
      kind: isGrid9 || isGrid4 ? 'contact-sheet' : isVideo ? 'video' : 'image',
      title: isGrid9
        ? '9-Grid Storyboard Sheet'
        : isGrid4
        ? '4-Angle Camera Coverage'
        : isVideo
        ? `Omni 1.2 Shot (${promptDurationSec}s)`
        : 'Synthesized Keyframe',
      prompt: promptText,
      x: spawnX,
      y: spawnY,
      width: dims.width,
      height: dims.height,
      aspectRatio: promptAspect,
      status: 'generating',
      progress: 35,
      seed,
      resolution: promptResolution,
      durationSec: isVideo ? promptDurationSec : undefined,
      elementHandles: handles,
      styleDnaId: activeStyleNode?.id,
      layers: createDefaultLayers(),
      providerUsed: activeProvider,
      createdAt: Date.now(),
    };

    set((s) => ({
      nodes: [...s.nodes, placeholderNode],
      selectedNodeIds: [tempId],
      edges: activeStyleNode
        ? [
            ...s.edges,
            {
              id: `edge_dna_${tempId}`,
              sourceId: activeStyleNode.id,
              targetId: tempId,
              kind: 'style-dna',
              label: 'Style DNA Lock',
            },
          ]
        : s.edges,
    }));

    const execResult = await executeStudioGeneration({
      provider: activeProvider,
      prompt: promptText,
      aspectRatio: promptAspect,
      durationSec: promptDurationSec,
      resolution: promptResolution,
      mode: isGrid9 ? '9-grid' : isVideo ? 'video' : 'image',
      referenceImages: refImages,
      byok,
    });

    let imageUrl = execResult.imageUrl;
    let gridSpec: CanvasNode['gridSpec'];

    if (!imageUrl) {
      if (isGrid9 || isGrid4) {
        const rows = isGrid9 ? 3 : 2;
        const cols = isGrid9 ? 3 : 2;
        const sheet = renderContactSheetDataUrl(rows, cols, promptText, seed, palette);
        imageUrl = sheet.dataUrl;
        gridSpec = { rows, cols, labels: sheet.labels };
      } else {
        imageUrl = renderShotDataUrl(promptAspect, {
          prompt: promptText,
          seed,
          palette,
          cameraLabel: isVideo ? `OMNI 1.2 · ${promptDurationSec}s` : `FRAME · ${promptResolution}`,
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

    get().showToast(
      isGrid9
        ? '9-Grid ready! Click "⊞ Slice 9-Grid" in floating toolbar to unpack all 9 frames'
        : `Generated ${placeholderNode.title} (${execResult.providerLabel})`
    );
  },

  applyInpaintToNode: async (nodeId, maskDataUrl, regionalPrompt) => {
    const node = get().nodes.find((n) => n.id === nodeId);
    if (!node || !node.imageUrl) return;
    get().pushHistory();
    const styleNode = get().nodes.find((n) => n.id === node.styleDnaId);
    const { compositedDataUrl, isolatedPatchDataUrl } = await compositeInpaintRedraw(
      node.imageUrl,
      maskDataUrl,
      regionalPrompt || 'Cyberpunk neon hologram detail',
      node.seed + 19,
      styleNode?.styleDna?.palette
    );

    set((s) => ({
      nodes: s.nodes.map((n) => {
        if (n.id !== nodeId) return n;
        const updatedLayers = n.layers.map((layer) =>
          layer.id === 'mask'
            ? {
                ...layer,
                visible: true,
                dataUrl: isolatedPatchDataUrl,
                regionalPrompt,
              }
            : layer
        );
        return {
          ...n,
          imageUrl: compositedDataUrl,
          seed: n.seed + 19,
          layers: updatedLayers,
        };
      }),
    }));
    get().showToast(`Applied regional Inpaint redraw: "${regionalPrompt}"`);
  },

  expandOutpaintNode: async (nodeId, targetAspect) => {
    const node = get().nodes.find((n) => n.id === nodeId);
    if (!node || !node.imageUrl) return;
    get().pushHistory();
    const styleNode = get().nodes.find((n) => n.id === node.styleDnaId);
    const expandedDataUrl = await expandOutpaintDataUrl(
      node.imageUrl,
      targetAspect,
      node.prompt,
      node.seed,
      styleNode?.styleDna?.palette
    );
    const newDims = getDimensionsForAspect(targetAspect, 390);
    set((s) => ({
      nodes: s.nodes.map((n) =>
        n.id === nodeId
          ? {
              ...n,
              aspectRatio: targetAspect,
              width: newDims.width,
              height: newDims.height,
              imageUrl: expandedDataUrl,
              title: `${n.title.replace(/ \(Outpaint.*\)$/, '')} (Outpaint ${targetAspect})`,
              layers: createDefaultLayers(expandedDataUrl),
            }
          : n
      ),
    }));
    get().showToast(`Expanded frame boundaries to ${targetAspect} (Smart Outpaint)`);
  },

  removeBgAndDecomposeLayers: (nodeId) => {
    const node = get().nodes.find((n) => n.id === nodeId);
    if (!node) return;
    get().pushHistory();
    const styleNode = get().nodes.find((n) => n.id === node.styleDnaId);
    const { foregroundDataUrl, backgroundDataUrl } = decomposeSubjectAndBackground(
      node.aspectRatio,
      node.prompt,
      node.seed,
      styleNode?.styleDna?.palette
    );

    set((s) => ({
      nodes: s.nodes.map((n) => {
        if (n.id !== nodeId) return n;
        const nextLayers: FrameLayer[] = [
          {
            id: 'fg',
            name: 'Foreground Subject',
            visible: true,
            opacity: 100,
            dataUrl: foregroundDataUrl,
            bgRemoved: true,
          },
          {
            id: 'bg',
            name: 'Background',
            visible: false,
            opacity: 100,
            dataUrl: backgroundDataUrl,
          },
          n.layers.find((l) => l.id === 'mask') || {
            id: 'mask',
            name: 'Inpaint Mask',
            visible: true,
            opacity: 100,
          },
          n.layers.find((l) => l.id === 'text') || {
            id: 'text',
            name: 'Text Overlay',
            visible: false,
            opacity: 100,
            textContent: 'AEROFLUX // ZERO MARKUP',
          },
        ];
        return { ...n, layers: nextLayers };
      }),
    }));
    get().showToast('Isolated Foreground Subject! Toggle Background/Text layers in the stack.');
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

  upscaleNodeHd: (nodeId, targetRes) => {
    const node = get().nodes.find((n) => n.id === nodeId);
    if (!node) return;
    get().pushHistory();
    const styleNode = get().nodes.find((n) => n.id === node.styleDnaId);
    const crispUrl =
      node.kind === 'contact-sheet'
        ? node.imageUrl
        : renderShotDataUrl(
            node.aspectRatio,
            {
              prompt: node.prompt,
              seed: node.seed,
              palette: styleNode?.styleDna?.palette,
              hudBadge: `HD ${targetRes} MASTER`,
            },
            3
          );
    set((s) => ({
      nodes: s.nodes.map((n) =>
        n.id === nodeId
          ? {
              ...n,
              resolution: targetRes,
              imageUrl: crispUrl || n.imageUrl,
            }
          : n
      ),
    }));
    get().showToast(`Upscaled "${node.title}" to ${targetRes} Ultra-Crisp Master`);
  },

  retakeNode: async (nodeId) => {
    const node = get().nodes.find((n) => n.id === nodeId);
    if (!node) return;
    get().pushHistory();
    const nextSeed = node.seed + 137;
    const styleNode = get().nodes.find((n) => n.id === node.styleDnaId);
    let nextImg = node.imageUrl;
    if (node.kind === 'contact-sheet' && node.gridSpec) {
      nextImg = renderContactSheetDataUrl(
        node.gridSpec.rows,
        node.gridSpec.cols,
        node.prompt,
        nextSeed,
        styleNode?.styleDna?.palette
      ).dataUrl;
    } else if (node.kind !== 'style-dna' && node.kind !== 'mcp-tool') {
      nextImg = renderShotDataUrl(node.aspectRatio, {
        prompt: node.prompt,
        seed: nextSeed,
        palette: styleNode?.styleDna?.palette,
        cameraLabel: `RETAKE SEED #${nextSeed}`,
      });
    }
    set((s) => ({
      nodes: s.nodes.map((n) =>
        n.id === nodeId
          ? {
              ...n,
              seed: nextSeed,
              imageUrl: nextImg,
              layers: createDefaultLayers(nextImg),
            }
          : n
      ),
    }));
    get().showToast(`Retook "${node.title}" (Seed #${nextSeed}) with @Elements locked`);
  },

  sliceContactSheetNode: async (nodeId, rows = 3, cols = 3) => {
    const node = get().nodes.find((n) => n.id === nodeId);
    if (!node) return;
    get().pushHistory();

    const styleNode = get().nodes.find((n) => n.id === node.styleDnaId);
    let sourceDataUrl = node.imageUrl;
    let labels = node.gridSpec?.labels || [];

    if (node.kind !== 'contact-sheet' || !sourceDataUrl || node.gridSpec?.rows !== rows) {
      const sheet = renderContactSheetDataUrl(
        rows,
        cols,
        node.prompt,
        node.seed,
        styleNode?.styleDna?.palette
      );
      sourceDataUrl = sheet.dataUrl;
      labels = sheet.labels;
    }

    const slicedUrls = await sliceGridImageDataUrl(sourceDataUrl, rows, cols);
    const cardW = 240;
    const cardH = 135;
    const startX = node.x + node.width + 110;
    const startY = Math.max(40, node.y - 80);

    const spawnedNodes: CanvasNode[] = [];
    const spawnedEdges: CanvasEdge[] = [];

    slicedUrls.forEach((url, idx) => {
      const r = Math.floor(idx / cols);
      const c = idx % cols;
      const childId = `node_slice_${Date.now()}_${idx}`;
      const angleLabel = labels[idx] || `Panel ${idx + 1}`;
      spawnedNodes.push({
        id: childId,
        kind: 'image',
        title: angleLabel,
        prompt: `${node.prompt} — [${angleLabel}]`,
        x: startX + c * (cardW + 32),
        y: startY + r * (cardH + 58),
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
        styleDnaId: node.styleDnaId,
        layers: createDefaultLayers(url),
        providerUsed: `Sliced from ${rows}×${cols} Sheet`,
        createdAt: Date.now() + idx,
      });
      spawnedEdges.push({
        id: `edge_slice_${node.id}_${childId}`,
        sourceId: node.id,
        targetId: childId,
        kind: 'grid-slice',
        label: `#${idx + 1}`,
      });
    });

    set((s) => ({
      nodes: [...s.nodes, ...spawnedNodes],
      edges: [...s.edges, ...spawnedEdges],
      selectedNodeIds: spawnedNodes.map((sn) => sn.id),
    }));

    get().showToast(
      `Sliced ${rows}×${cols} sheet into ${spawnedNodes.length} individual linked frames!`
    );
  },

  generateFourAngleCoverage: async (nodeId) => {
    await get().sliceContactSheetNode(nodeId, 2, 2);
  },

  convertImageToOmniVideo: async (nodeId, durationSec = 15) => {
    const node = get().nodes.find((n) => n.id === nodeId);
    if (!node) return;
    get().pushHistory();
    const { activeProvider, byok } = get();

    const exec = await executeStudioGeneration({
      provider: activeProvider === 'local-canvas' ? 'gemini-omni' : activeProvider,
      prompt: node.prompt,
      aspectRatio: node.aspectRatio,
      durationSec,
      resolution: node.resolution,
      mode: 'video',
      firstFrameDataUrl: node.imageUrl,
      byok,
    });

    const childId = `node_omni_vid_${Date.now()}`;
    const dims = getDimensionsForAspect(node.aspectRatio, 360);
    const newVideoNode: CanvasNode = {
      id: childId,
      kind: 'video',
      title: `${node.title} · ${durationSec}s Omni Video`,
      prompt: node.prompt,
      x: node.x + node.width + 96,
      y: node.y,
      width: dims.width,
      height: dims.height,
      aspectRatio: node.aspectRatio,
      status: 'ready',
      imageUrl: node.imageUrl,
      videoUrl: exec.videoUrl,
      videoTheme: node.prompt.toLowerCase().includes('sneaker') ? 'sneaker-macro' : 'cyberpunk-rain',
      seed: node.seed,
      resolution: node.resolution,
      durationSec,
      cameraMotion: 'Smooth Gimbal Steadicam',
      interactionId: exec.interactionId,
      elementHandles: node.elementHandles,
      styleDnaId: node.styleDnaId,
      layers: createDefaultLayers(node.imageUrl),
      providerUsed: 'Gemini Omni 1.2 Flash (15s)',
      createdAt: Date.now(),
    };

    const edge: CanvasEdge = {
      id: `edge_img2vid_${Date.now()}`,
      sourceId: node.id,
      targetId: childId,
      kind: 'lineage',
      label: `Image → ${durationSec}s Omni`,
    };

    set((s) => ({
      nodes: [...s.nodes, newVideoNode],
      edges: [...s.edges, edge],
      selectedNodeIds: [childId],
    }));

    get().showToast(`Generated ${durationSec}s Gemini Omni 1.2 Flash video (${exec.interactionId})`);
  },

  branchVideoMultiTurn: async (nodeId, deltaPrompt) => {
    const parent = get().nodes.find((n) => n.id === nodeId);
    if (!parent) return;
    get().pushHistory();
    const parentInteractionId = parent.interactionId || `int_omni_${parent.seed}`;
    const { activeProvider, byok } = get();

    const exec = await executeStudioGeneration({
      provider: activeProvider === 'local-canvas' ? 'gemini-omni' : activeProvider,
      prompt: deltaPrompt,
      aspectRatio: parent.aspectRatio,
      durationSec: parent.durationSec || 12,
      resolution: parent.resolution,
      mode: 'video',
      previousInteractionId: parentInteractionId,
      byok,
    });

    const dims = getDimensionsForAspect(parent.aspectRatio, 360);
    const nextSeed = parent.seed + 211;
    const branchThumb = renderShotDataUrl(parent.aspectRatio, {
      prompt: `${parent.prompt} :: ${deltaPrompt}`,
      seed: nextSeed,
      theme: 'night-remix',
      cameraLabel: `BRANCH · prev=${parentInteractionId.slice(-6)}`,
    });

    const branchId = `node_branch_${Date.now()}`;
    const branchedNode: CanvasNode = {
      id: branchId,
      kind: 'video',
      title: `Multi-Turn Branch · ${deltaPrompt.slice(0, 24)}...`,
      prompt: deltaPrompt,
      x: parent.x + parent.width + 96,
      y: parent.y + 110,
      width: dims.width,
      height: dims.height,
      aspectRatio: parent.aspectRatio,
      status: 'ready',
      imageUrl: branchThumb,
      videoUrl: exec.videoUrl,
      videoTheme: 'night-remix',
      seed: nextSeed,
      resolution: parent.resolution,
      durationSec: parent.durationSec || 12,
      cameraMotion: 'Multi-Turn Stateful Remix',
      interactionId: exec.interactionId,
      previousInteractionId: parentInteractionId,
      elementHandles: Array.from(new Set([...parent.elementHandles, ...extractHandles(deltaPrompt)])),
      styleDnaId: parent.styleDnaId,
      layers: createDefaultLayers(branchThumb),
      providerUsed: 'Gemini Omni 1.2 (previous_interaction_id)',
      createdAt: Date.now(),
    };

    const branchEdge: CanvasEdge = {
      id: `edge_branch_${Date.now()}`,
      sourceId: parent.id,
      targetId: branchId,
      kind: 'multi-turn-branch',
      label: `prev_id: ${parentInteractionId}`,
    };

    set((s) => ({
      nodes: [...s.nodes, branchedNode],
      edges: [...s.edges, branchEdge],
      selectedNodeIds: [branchId],
    }));

    get().showToast(`Branched multi-turn video via previous_interaction_id=${parentInteractionId}`);
  },

  executeMcpToolNode: async (nodeId) => {
    const mcpNode = get().nodes.find((n) => n.id === nodeId);
    if (!mcpNode || !mcpNode.mcpTool) return;
    get().pushHistory();

    const exec = await executeStudioGeneration({
      provider: 'mcp-router',
      prompt: mcpNode.prompt,
      aspectRatio: '16:9',
      durationSec: 10,
      mode: mcpNode.mcpTool.name.includes('video') ? 'video' : 'image',
      mcpTool: mcpNode.mcpTool,
      byok: get().byok,
    });

    const outId = `node_mcp_out_${Date.now()}`;
    const dims = getDimensionsForAspect('16:9', 360);
    const seed = mcpNode.seed + 83;
    const img =
      exec.imageUrl ||
      renderShotDataUrl('16:9', {
        prompt: mcpNode.prompt,
        seed,
        hudBadge: `MCP · ${mcpNode.mcpTool.name}`,
      });

    const outNode: CanvasNode = {
      id: outId,
      kind: mcpNode.mcpTool.name.includes('video') ? 'video' : 'image',
      title: `MCP Output · ${mcpNode.mcpTool.name}`,
      prompt: mcpNode.prompt,
      x: mcpNode.x + mcpNode.width + 90,
      y: mcpNode.y,
      width: dims.width,
      height: dims.height,
      aspectRatio: '16:9',
      status: 'ready',
      imageUrl: img,
      videoUrl: exec.videoUrl,
      seed,
      resolution: '1080p',
      durationSec: mcpNode.mcpTool.name.includes('video') ? 10 : undefined,
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
          label: `tools/call: ${mcpNode.mcpTool!.name}`,
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
      accentColor: category === 'character' ? '#38BDF8' : category === 'product' ? '#A855F7' : '#F43F5E',
      references: [],
    };
    set((s) => ({ elements: [...s.elements, newVault] }));
    get().showToast(`Created @Elements vault ${cleanHandle}`);
  },

  addReferenceImageToVault: (vaultId, label, dataUrl) => {
    set((s) => ({
      elements: s.elements.map((v) => {
        if (v.id !== vaultId) return v;
        if (v.references.length >= 6) return v;
        return {
          ...v,
          references: [
            ...v.references,
            { id: `ref_${Date.now()}`, label, dataUrl },
          ],
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
    get().pushHistory();
    const { nodes } = get();
    const refNode = sourceNodeId
      ? nodes.find((n) => n.id === sourceNodeId)
      : nodes.find((n) => n.id === get().selectedNodeIds[0]);
    const dna = extractStyleDnaFromPrompt(refNode?.prompt || get().promptText);
    const id = `node_dna_${Date.now()}`;
    const newNode: CanvasNode = {
      id,
      kind: 'style-dna',
      title: `Style DNA · ${dna.presetName.slice(0, 22)}`,
      prompt: `${dna.lighting} · ${dna.lens} · ${dna.filmStock}`,
      x: refNode ? Math.max(40, refNode.x - 340) : 100,
      y: refNode ? refNode.y : 140,
      width: 290,
      height: 220,
      aspectRatio: '16:9',
      status: 'ready',
      seed: Math.floor(Math.random() * 1000),
      resolution: '4K',
      elementHandles: ['@Brand_Style'],
      styleDna: dna,
      layers: [],
      providerUsed: 'Style DNA Optical Lock',
      createdAt: Date.now(),
    };

    set((s) => ({
      nodes: [...s.nodes, newNode],
      edges: refNode
        ? [
            ...s.edges,
            {
              id: `edge_dna_${Date.now()}`,
              sourceId: id,
              targetId: refNode.id,
              kind: 'style-dna',
              label: 'Style DNA Lock',
            },
          ]
        : s.edges,
      selectedNodeIds: [id],
    }));
    get().showToast('Extracted & locked Style DNA Node on Spatial Board');
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
    if (multiframes.length >= 10) {
      get().showToast('Dreamina Smart Multiframes supports up to 10 chained keyframes.');
      return;
    }
    get().pushHistory();
    const srcNode = nodeId ? nodes.find((n) => n.id === nodeId) : undefined;
    const idx = multiframes.length + 1;
    const seed = 1400 + idx * 113;
    const prompt =
      srcNode?.prompt ||
      `Keyframe 0${idx} · @Hero_Kael & @Cyber_Sneaker dynamic camera progression, @Brand_Style`;
    const imageUrl =
      srcNode?.imageUrl ||
      renderShotDataUrl('16:9', {
        prompt,
        seed,
        cameraLabel: `KEYFRAME 0${idx}`,
      });

    const newCard: MultiframeCard = {
      id: `mf_${Date.now()}`,
      order: multiframes.length,
      title: srcNode?.title || `KF 0${idx} · Sequence Beat`,
      prompt,
      imageUrl,
      sourceNodeId: srcNode?.id,
      aspectRatio: srcNode?.aspectRatio || '16:9',
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
            transitionPrompt: 'Seamless Gemini Omni 1.2 First/Last frame morph with 10s prior context lock',
            useTenSecContextWindow: true,
            firstLastKeyframeLock: true,
          },
        ]
      : bridges;

    set({
      multiframes: [...multiframes, newCard],
      bridges: nextBridges,
    });
    get().showToast(`Added Keyframe #${idx} to Smart Multiframes Chain`);
  },

  removeMultiframeCard: (cardId) => {
    const { multiframes } = get();
    if (multiframes.length <= 2) {
      get().showToast('Smart Multiframes requires at least 2 keyframes.');
      return;
    }
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
          transitionPrompt: 'Continuous camera motion bridge',
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

    const baseRight = nodes.reduce((acc, n) => Math.max(acc, n.x + n.width), 400) + 90;
    const spawnedNodes: CanvasNode[] = [];
    const spawnedEdges: CanvasEdge[] = [];
    const spawnedClips: TimelineClip[] = [];

    let cursorSec = timelineClips
      .filter((c) => c.track === 'video')
      .reduce((acc, c) => Math.max(acc, c.startSec + c.durationSec), 0);

    let prevVidId: string | undefined;

    bridges.forEach((br, idx) => {
      const fromCard = multiframes.find((c) => c.id === br.fromCardId);
      const toCard = multiframes.find((c) => c.id === br.toCardId);
      if (!fromCard || !toCard) return;

      const nodeId = `node_mf_seq_${Date.now()}_${idx}`;
      const interactionId = `int_mf_${idx + 1}_${Math.random().toString(36).slice(2, 6)}`;

      const vNode: CanvasNode = {
        id: nodeId,
        kind: 'video',
        title: `Multiframe ${idx + 1}→${idx + 2} (${br.curve})`,
        prompt: `[${br.curve} · ${br.durationSec}s] ${fromCard.title} → ${toCard.title}: ${br.transitionPrompt}`,
        x: baseRight + idx * 420,
        y: 220,
        width: 360,
        height: 202,
        aspectRatio: '16:9',
        status: 'ready',
        imageUrl: fromCard.imageUrl,
        videoTheme: idx % 2 === 0 ? 'cyberpunk-rain' : 'drone-canyon',
        seed: 2000 + idx * 155,
        resolution: '1080p',
        durationSec: br.durationSec,
        cameraMotion: br.curve,
        interactionId,
        previousInteractionId: prevVidId,
        elementHandles: extractHandles(`${fromCard.prompt} ${toCard.prompt}`),
        layers: createDefaultLayers(fromCard.imageUrl),
        providerUsed: 'Omni 1.2 First/Last Keyframe + 10s Context',
        createdAt: Date.now() + idx,
      };
      spawnedNodes.push(vNode);

      if (prevVidId) {
        const prevNode = spawnedNodes[spawnedNodes.length - 2];
        spawnedEdges.push({
          id: `edge_mf_chain_${idx}`,
          sourceId: prevNode.id,
          targetId: nodeId,
          kind: 'multiframe',
          label: `${br.curve} · 10s Context`,
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
        videoTheme: vNode.videoTheme,
        seed: vNode.seed,
        promptOrDialogue: vNode.prompt,
        color: idx % 2 === 0 ? '#8B5CF6' : '#0EA5E9',
      });
      cursorSec += br.durationSec;
    });

    set((s) => ({
      nodes: [...s.nodes, ...spawnedNodes],
      edges: [...s.edges, ...spawnedEdges],
      timelineClips: [...s.timelineClips, ...spawnedClips],
      timelineExpanded: true,
      selectedNodeIds: spawnedNodes.map((n) => n.id),
    }));

    get().showToast(
      `Synthesized ${spawnedNodes.length} bridged Multiframe shots onto Canvas & Timeline!`
    );
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
    get().showToast('Cleared all local BYOK credentials from browser storage');
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
      skills: [
        ...s.skills.filter((sk) => !sk.id.startsWith(`mcp_skill_${id}`)),
        ...discovery.tools.map((t, i) => ({
          id: `mcp_skill_${id}_${i}`,
          slash: `/mcp:${t.name}`,
          title: `MCP · ${t.name}`,
          category: 'MCP Tool' as const,
          badge: 'MCP NODE',
          description: t.description,
          promptTemplate: `Execute MCP ${t.name}: @Hero_Kael & @Cyber_Sneaker in @Brand_Style`,
          recommendedMode: t.name.includes('video') ? ('video' as const) : ('image' as const),
          mcpToolName: t.name,
        })),
      ],
    }));
    get().showToast(
      discovery.connected
        ? `Connected MCP server "${name}" (${discovery.tools.length} tools registered!)`
        : `Registered "${name}" in offline preview mode (${discovery.tools.length} MCP node schemas ready)`
    );
  },

  refreshMcpServer: async (serverId) => {
    const srv = get().mcpServers.find((m) => m.id === serverId);
    if (!srv) return;
    set((s) => ({
      mcpServers: s.mcpServers.map((m) =>
        m.id === serverId ? { ...m, status: 'connecting' } : m
      ),
    }));
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
    get().showToast(
      discovery.connected
        ? `MCP "${srv.name}" live (${discovery.pingMs}ms)`
        : `MCP "${srv.name}" unreachable on ${srv.url} — using local tool schemas`
    );
  },

  spawnMcpToolAsCanvasNode: (tool) => {
    get().pushHistory();
    const maxRight = get().nodes.reduce((acc, n) => Math.max(acc, n.x + n.width), 360);
    const nodeId = `node_mcp_${Date.now()}`;
    const newNode: CanvasNode = {
      id: nodeId,
      kind: 'mcp-tool',
      title: `MCP Tool · ${tool.name}`,
      prompt: get().promptText,
      x: maxRight + 72,
      y: 220,
      width: 310,
      height: 215,
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
    get().showToast(`Spawned MCP Tool "${tool.name}" onto Spatial Board`);
  },

  pingBridge: () => {
    pingChromeBridge();
    get().showToast('Sent handshake ping to Open-DreamFlow Chrome Extension...');
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
      get().showToast(`Chrome Bridge streamed media back for job ${jobId}`);
    }
  },

  setPlayheadSec: (playheadSec) => set({ playheadSec: Math.max(0, playheadSec) }),
  setIsPlayingTimeline: (isPlayingTimeline) => set({ isPlayingTimeline }),

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
      color: node.kind === 'video' ? '#8B5CF6' : '#0EA5E9',
    };
    set((s) => ({
      timelineClips: [...s.timelineClips, newClip],
      timelineExpanded: true,
    }));
    get().showToast(`Appended "${node.title}" to V1 Video Track`);
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
      color: track === 'voice' ? '#10B981' : '#F59E0B',
    };
    set((s) => ({ timelineClips: [...s.timelineClips, clip] }));
    get().showToast(`Added "${title}" to ${track === 'voice' ? 'Voice/Lip-Sync' : 'SFX'} Track`);
  },

  removeTimelineClip: (clipId) => {
    get().pushHistory();
    set((s) => ({
      timelineClips: s.timelineClips.filter((c) => c.id !== clipId),
    }));
  },

  extractLastFrameToNextShot: (clipId) => {
    const { timelineClips, nodes } = get();
    const videoClips = timelineClips
      .filter((c) => c.track === 'video')
      .sort((a, b) => a.startSec - b.startSec);
    const targetClip = clipId
      ? videoClips.find((c) => c.id === clipId)
      : videoClips[videoClips.length - 1];

    if (!targetClip) {
      get().showToast('Add a video shot to V1 first to extract its last frame.');
      return;
    }

    get().pushHistory();
    const lastFrameUrl = renderShotDataUrl('16:9', {
      prompt: targetClip.promptOrDialogue,
      seed: (targetClip.seed || 500) + 17,
      theme: targetClip.videoTheme,
      cameraLabel: `EXTRACTED LAST FRAME · ${(targetClip.startSec + targetClip.durationSec).toFixed(1)}s`,
      hudBadge: 'NEXT SHOT ANCHOR',
    });

    const maxRight = nodes.reduce((acc, n) => Math.max(acc, n.x + n.width), 400);
    const newNodeId = `node_lastframe_${Date.now()}`;
    const dims = getDimensionsForAspect('16:9', 360);

    const anchorNode: CanvasNode = {
      id: newNodeId,
      kind: 'image',
      title: `Last Frame → Next Shot (${targetClip.title.slice(0, 18)})`,
      prompt: `Seamless continuation from "${targetClip.title}": ${targetClip.promptOrDialogue}`,
      x: maxRight + 80,
      y: 180,
      width: dims.width,
      height: dims.height,
      aspectRatio: '16:9',
      status: 'ready',
      imageUrl: lastFrameUrl,
      seed: (targetClip.seed || 500) + 17,
      resolution: '2K',
      interactionId: `int_lf_${Date.now().toString(36)}`,
      elementHandles: extractHandles(targetClip.promptOrDialogue),
      layers: createDefaultLayers(lastFrameUrl),
      providerUsed: 'Frame-Accurate Last-Frame Extractor',
      createdAt: Date.now(),
    };

    set((s) => ({
      nodes: [...s.nodes, anchorNode],
      edges:
        targetClip.sourceNodeId && s.nodes.some((n) => n.id === targetClip.sourceNodeId)
          ? [
              ...s.edges,
              {
                id: `edge_lf_${Date.now()}`,
                sourceId: targetClip.sourceNodeId,
                targetId: newNodeId,
                kind: 'lineage',
                label: '✂️ Extracted Last Frame',
              },
            ]
          : s.edges,
      selectedNodeIds: [newNodeId],
      activeView: 'canvas',
    }));

    get().showToast('Extracted exact Last Frame onto Spatial Board as Next-Shot Anchor!');
  },

  runAutonomousDirectorAgent: async (creativeBrief) => {
    if (!creativeBrief.trim() || get().directorRunning) return;
    get().pushHistory();
    set({
      directorRunning: true,
      directorStepLog: ['[Director Agent] Parsing creative brief & locking @Elements continuity...'],
    });

    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const baseY = get().nodes.reduce((acc, n) => Math.max(acc, n.y + n.height), 520) + 120;

    await sleep(320);
    const dna = extractStyleDnaFromPrompt(creativeBrief);
    const dnaId = `node_dir_dna_${Date.now()}`;
    const dnaNode: CanvasNode = {
      id: dnaId,
      kind: 'style-dna',
      title: 'Director Style DNA Lock',
      prompt: `${dna.lighting} · ${dna.lens}`,
      x: 80,
      y: baseY,
      width: 290,
      height: 220,
      aspectRatio: '16:9',
      status: 'ready',
      seed: 310,
      resolution: '4K',
      elementHandles: extractHandles(creativeBrief),
      styleDna: dna,
      layers: [],
      providerUsed: 'Autonomous Director Agent',
      createdAt: Date.now(),
    };

    set((s) => ({
      nodes: [...s.nodes, dnaNode],
      directorStepLog: [
        ...s.directorStepLog,
        `[Step 1/4] Extracted Style DNA (${dna.lens}, ${dna.filmStock})`,
      ],
    }));

    await sleep(380);
    const beatDefs = [
      {
        title: 'Director Beat 01 · Establishing Hook',
        prompt: `${creativeBrief} — Wide anamorphic establishing hook, @Hero_Kael & @Cyber_Sneaker`,
        dur: 8,
        curve: 'Dolly In',
        theme: 'drone-canyon' as const,
      },
      {
        title: 'Director Beat 02 · Kinetic Hero Action',
        prompt: `${creativeBrief} — Dynamic tracking close-up with volumetric rim speculars`,
        dur: 10,
        curve: 'Orbit 180°',
        theme: 'sneaker-macro' as const,
      },
      {
        title: 'Director Beat 03 · Climax Hero Reveal',
        prompt: `${creativeBrief} — Iconic product & hero lockup silhouette in neon rain`,
        dur: 12,
        curve: 'Crane Up',
        theme: 'cyberpunk-rain' as const,
      },
    ];

    const createdShotNodes: CanvasNode[] = [];
    const createdEdges: CanvasEdge[] = [];
    const createdClips: TimelineClip[] = [];
    let tCursor = get()
      .timelineClips.filter((c) => c.track === 'video')
      .reduce((acc, c) => Math.max(acc, c.startSec + c.durationSec), 0);

    let prevInteraction: string | undefined;

    for (let i = 0; i < beatDefs.length; i++) {
      await sleep(320);
      const beat = beatDefs[i];
      const seed = 4200 + i * 233;
      const interactionId = `int_dir_${i + 1}_${Math.random().toString(36).slice(2, 6)}`;
      const thumb = renderShotDataUrl('16:9', {
        prompt: beat.prompt,
        seed,
        palette: dna.palette,
        theme: beat.theme,
        cameraLabel: `BEAT 0${i + 1} · ${beat.dur}s OMNI`,
      });

      const sNode: CanvasNode = {
        id: `node_dir_shot_${Date.now()}_${i}`,
        kind: 'video',
        title: beat.title,
        prompt: beat.prompt,
        x: 450 + i * 430,
        y: baseY,
        width: 360,
        height: 202,
        aspectRatio: '16:9',
        status: 'ready',
        imageUrl: thumb,
        videoTheme: beat.theme,
        seed,
        resolution: '1080p',
        durationSec: beat.dur,
        cameraMotion: beat.curve,
        interactionId,
        previousInteractionId: prevInteraction,
        elementHandles: extractHandles(beat.prompt),
        styleDnaId: dnaId,
        layers: createDefaultLayers(thumb),
        providerUsed: 'Director Agent · Omni 1.2',
        createdAt: Date.now() + i,
      };
      createdShotNodes.push(sNode);
      createdEdges.push({
        id: `edge_dir_dna_${i}_${Date.now()}`,
        sourceId: dnaId,
        targetId: sNode.id,
        kind: 'style-dna',
        label: 'Style DNA',
      });

      if (i > 0) {
        createdEdges.push({
          id: `edge_dir_chain_${i}_${Date.now()}`,
          sourceId: createdShotNodes[i - 1].id,
          targetId: sNode.id,
          kind: 'multi-turn-branch',
          label: `prev_id: ${prevInteraction}`,
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
        thumbnailUrl: thumb,
        videoTheme: beat.theme,
        seed,
        promptOrDialogue: beat.prompt,
        color: '#8B5CF6',
      });
      tCursor += beat.dur;

      set((s) => ({
        directorStepLog: [
          ...s.directorStepLog,
          `[Step ${i + 2}/4] Synthesized ${beat.title} (${beat.dur}s, ${beat.curve})`,
        ],
      }));
    }

    createdClips.push({
      id: `clip_dir_vo_${Date.now()}`,
      track: 'voice',
      title: 'Director Agent VO · @Hero_Kael',
      startSec: tCursor - 28,
      durationSec: 12,
      promptOrDialogue: `Autonomous sequence locked: ${creativeBrief.slice(0, 64)}`,
      lipSyncCharacter: '@Hero_Kael',
      audioFreqHz: 180,
      color: '#10B981',
    });

    set((s) => ({
      nodes: [...s.nodes, ...createdShotNodes],
      edges: [...s.edges, ...createdEdges],
      timelineClips: [...s.timelineClips, ...createdClips],
      selectedNodeIds: createdShotNodes.map((n) => n.id),
      panY: Math.min(28, -(baseY - 180)),
      directorRunning: false,
      directorModalOpen: false,
      timelineExpanded: true,
    }));

    get().showToast('Autonomous Director built 3-shot multi-turn storyboard + rough cut!');
  },
}));
