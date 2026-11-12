export type AspectRatio = '16:9' | '9:16' | '21:9' | '1:1';

export type NodeKind =
  | 'text'
  | 'image'
  | 'video'
  | 'audio'
  | 'timeline'
  | 'element'
  | 'style-dna'
  | 'contact-sheet'
  | 'sticky'
  | 'mcp-tool';

export type DreaminaToolId =
  | 'text'
  | 'image'
  | 'video'
  | 'audio'
  | 'timeline'
  | 'element'
  | 'cinema-kit'
  | 'camera-3d'
  | 'image-editor'
  | 'sticky'
  | 'assets'
  | 'upload';

export type ResolutionTier = '360p' | '720p' | '1080p' | '2K' | '4K';

export type FrameLayerType = 'fg' | 'bg' | 'mask' | 'text';

export interface FrameLayer {
  id: FrameLayerType;
  name: 'Foreground Subject' | 'Background' | 'Inpaint Mask' | 'Text Overlay';
  visible: boolean;
  opacity: number;
  dataUrl?: string;
  regionalPrompt?: string;
  textContent?: string;
  bgRemoved?: boolean;
}

export interface StyleDNAPayload {
  presetName: string;
  palette: string[];
  lighting: string;
  lens: string;
  filmStock: string;
  motionCadence: string;
  locked: boolean;
}

export interface MCPToolDefinition {
  name: string;
  description: string;
  serverUrl: string;
  serverName: string;
  inputSchema?: Record<string, unknown>;
}

export interface McpBackendHealth {
  online: boolean;
  ffmpegAvailable: boolean;
  toolCount: number;
  tools: MCPToolDefinition[];
  mediaFiles: string[];
  baseUrl: string;
  pingMs?: number;
}

export interface CanvasNode {
  id: string;
  kind: NodeKind;
  title: string;
  prompt: string;
  x: number;
  y: number;
  width: number;
  height: number;
  aspectRatio: AspectRatio;
  status: 'ready' | 'generating' | 'error';
  progress?: number;
  imageUrl?: string;
  videoUrl?: string;
  audioUrl?: string;
  videoTheme?:
    | 'cyberpunk-rain'
    | 'sneaker-macro'
    | 'drone-canyon'
    | 'neon-orbit'
    | 'product-ugc'
    | 'night-remix';
  seed: number;
  resolution: ResolutionTier;
  durationSec?: number;
  cameraAngle?: string;
  cameraMotion?: string;
  interactionId?: string;
  previousInteractionId?: string;
  elementHandles: string[];
  styleDnaId?: string;
  styleDna?: StyleDNAPayload;
  gridSpec?: {
    rows: number;
    cols: number;
    labels: string[];
  };
  mcpTool?: MCPToolDefinition;
  layers: FrameLayer[];
  providerUsed: string;
  createdAt: number;
}

export type EdgeKind =
  | 'lineage'
  | 'style-dna'
  | 'multi-turn-branch'
  | 'grid-slice'
  | 'multiframe'
  | 'mcp-pipe';

export interface CanvasEdge {
  id: string;
  sourceId: string;
  targetId: string;
  kind: EdgeKind;
  label?: string;
}

export interface ElementReferenceImage {
  id: string;
  label: string;
  dataUrl: string;
}

export interface ElementVault {
  id: string;
  handle: string;
  name: string;
  category: 'character' | 'product' | 'style' | 'voice';
  description: string;
  accentColor: string;
  references: ElementReferenceImage[];
  voiceProfile?: string;
}

export interface DreaminaSkill {
  id: string;
  slash: string;
  title: string;
  category: 'Storyboard' | 'Camera' | 'Commercial' | 'Omni Multi-Turn' | 'MCP Tool';
  description: string;
  badge: string;
  promptTemplate: string;
  recommendedMode: 'image' | 'video' | '9-grid' | '4-angle' | 'multi-turn';
  durationSec?: number;
  mcpToolName?: string;
}

export type CameraTransitionCurve =
  | 'Dolly In'
  | 'Dolly Out'
  | 'Orbit 180°'
  | 'Crane Up'
  | 'Whip Pan'
  | 'FPV Dive'
  | 'Rack Focus';

export interface MultiframeCard {
  id: string;
  order: number;
  title: string;
  prompt: string;
  imageUrl: string;
  videoUrl?: string;
  sourceNodeId?: string;
  aspectRatio: AspectRatio;
}

export interface MultiframeBridge {
  id: string;
  fromCardId: string;
  toCardId: string;
  durationSec: number;
  curve: CameraTransitionCurve;
  transitionPrompt: string;
  useTenSecContextWindow: boolean;
  firstLastKeyframeLock: boolean;
}

export type ProviderId =
  | 'local-canvas'
  | 'gemini-omni'
  | 'seedance'
  | 'fal'
  | 'replicate'
  | 'openai'
  | 'comfyui'
  | 'mcp-router'
  | 'chrome-bridge-flow'
  | 'chrome-bridge-dreamina';

export interface BYOKCredentials {
  geminiApiKey: string;
  geminiModel: string;
  seedanceApiKey: string;
  seedanceEndpoint: string;
  falApiKey: string;
  falModel: string;
  replicateApiKey: string;
  openaiApiKey: string;
  comfyUiUrl: string;
}

export interface MCPServerEntry {
  id: string;
  name: string;
  url: string;
  transport: 'websocket' | 'http-sse';
  status: 'disconnected' | 'connecting' | 'connected' | 'simulated';
  tools: MCPToolDefinition[];
  lastPingMs?: number;
}

export interface ChromeBridgeJob {
  jobId: string;
  target: 'google-flow' | 'dreamina';
  prompt: string;
  status: 'queued' | 'injecting-dom' | 'rendering' | 'completed' | 'bridge-offline';
  createdAt: number;
  resultUrl?: string;
}

export interface ChromeBridgeState {
  extensionDetected: boolean;
  flowTabConnected: boolean;
  dreaminaTabConnected: boolean;
  injectElementRefs: boolean;
  autoStreamMutationObserver: boolean;
  jobs: ChromeBridgeJob[];
}

export type TimelineTrackType = 'video' | 'voice' | 'sfx';

export interface TimelineClip {
  id: string;
  track: TimelineTrackType;
  title: string;
  sourceNodeId?: string;
  startSec: number;
  durationSec: number;
  thumbnailUrl?: string;
  videoUrl?: string;
  videoTheme?: CanvasNode['videoTheme'];
  seed?: number;
  promptOrDialogue: string;
  lipSyncCharacter?: string;
  audioFreqHz?: number;
  sfxKind?: 'rain-ambience' | 'whoosh-transition' | 'sub-impact' | 'cyber-synth';
  color: string;
}

export interface ChatMessageItem {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: number;
}

export interface StudioHistorySnapshot {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  multiframes: MultiframeCard[];
  bridges: MultiframeBridge[];
  timelineClips: TimelineClip[];
}
