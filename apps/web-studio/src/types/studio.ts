export type AspectRatio = '16:9' | '9:16' | '21:9' | '1:1' | '4:3' | '3:4';

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

export type ResolutionTier = '360p' | '720p' | '1080p' | '1K' | '2K' | '4K';

export type PlatformId =
  | 'higgsfield'
  | 'sume'
  | 'kling'
  | 'dreamina'
  | 'google-flow'
  | 'openart'
  | 'imagineart'
  | 'elevenlabs'
  | 'openai'
  | 'fal'
  | 'replicate'
  | 'comfyui'
  | 'custom-mcp';

export type BrowserPlatformTarget =
  | 'dreamina'
  | 'google-flow'
  | 'higgsfield'
  | 'sume'
  | 'kling'
  | 'openart'
  | 'imagineart'
  | 'elevenlabs';

export type ModelModality = 'image' | 'video' | 'audio';

export type ConnectionTransport = 'auto' | 'mcp' | 'browser-bridge' | 'api-key';

export interface PlatformModelDefinition {
  id: string;
  label: string;
  modality: ModelModality;
  description?: string;
  supportsReferences?: boolean;
  maxReferences?: number;
  supportsAudio?: boolean;
  defaultAspect?: AspectRatio;
  defaultResolution?: ResolutionTier;
  defaultDurationSec?: number;
}

export interface PlatformDefinition {
  id: PlatformId;
  name: string;
  shortLabel: string;
  webUrl: string;
  modalities: ModelModality[];
  models: PlatformModelDefinition[];
  supportsBrowserBridge: boolean;
  supportsApiKey: boolean;
  supportsMcp: boolean;
  connected?: boolean;
  activeTransports?: string[];
}

export interface ExternalMcpToolItem {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

export interface ExternalMcpServerRecord {
  id: string;
  name: string;
  platformId: PlatformId | string;
  transport: 'stdio' | 'http';
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  headers?: Record<string, string>;
  status: 'connected' | 'connecting' | 'error' | 'disconnected' | string;
  error?: string;
  tools: ExternalMcpToolItem[];
}

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
  savedProjectsCount?: number;
  bridgeClients?: number;
}

export type KeyframeBridgeCurve =
  | 'ease-in-out'
  | 'linear'
  | 'match-dissolve'
  | 'whip-pan';

export type StudioPresetId =
  | 'salt-terracotta'
  | 'kyoto-joinery'
  | 'alpine-pass'
  | 'cross-platform-blueprint'
  | 'blank';

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
  status: 'idle' | 'ready' | 'generating' | 'error';
  progress?: number;
  imageUrl?: string;
  videoUrl?: string;
  audioUrl?: string;
  platformId?: PlatformId;
  connectionMode?: ConnectionTransport;
  modelId?: string;
  batchCount?: 1 | 2 | 4;
  negativePrompt?: string;
  audioEnabled?: boolean;
  voiceId?: string;
  mcpServerId?: string;
  mcpToolName?: string;
  referenceUrls?: string[];
  generatedOutputs?: string[];
  videoTheme?:
    | 'coastal-daylight'
    | 'craft-macro'
    | 'alpine-aerial'
    | 'architectural-pan'
    | 'product-ugc'
    | 'golden-hour';
  seed: number;
  resolution: ResolutionTier;
  durationSec?: number;
  cameraAngle?: string;
  cameraMotion?: string;
  bridgeMode?: boolean;
  startImageUrl?: string;
  endImageUrl?: string;
  startNodeId?: string;
  endNodeId?: string;
  motionCurve?: KeyframeBridgeCurve;
  audioMode?: 'tts' | 'ambient' | 'voiceover' | 'sfx';
  waveform?: number[];
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
  isTransparentCutout?: boolean;
  editBadge?: string;
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
  | 'dreamina-bridge'
  | 'flow-bridge'
  | 'gemini-api'
  | 'fal'
  | 'replicate'
  | 'seedance'
  | 'comfyui'
  | 'ffmpeg-local'
  | 'mcp-router'
  | 'openai'
  | 'kling'
  | 'higgsfield'
  | 'sume'
  | 'elevenlabs'
  | 'openart'
  | 'imagineart'
  | 'local-canvas'
  | 'gemini-omni'
  | 'chrome-bridge-flow'
  | 'chrome-bridge-dreamina';

export interface ProviderVerificationResult {
  checkedAt: number;
  valid: boolean;
  videoModels?: string[];
  imageModels?: string[];
  allCount?: number;
  error?: string;
  message?: string;
}

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
  higgsfieldApiKey: string;
  sumeApiKey: string;
  klingAccessKey: string;
  klingSecretKey: string;
  klingApiKey: string;
  openartApiKey: string;
  imagineartApiKey: string;
  elevenlabsApiKey: string;
}

export interface ConnectionsStatusSnapshot {
  ok: boolean;
  bridgeClients: number;
  connectedBrowserPlatforms: PlatformId[];
  connectedMcpPlatforms: PlatformId[];
  configuredApiPlatforms: PlatformId[];
  browserSessionOpen?: boolean;
  activeBrowserProfileDir?: string;
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
  target: BrowserPlatformTarget;
  prompt: string;
  status: 'queued' | 'injecting-dom' | 'rendering' | 'completed' | 'bridge-offline';
  createdAt: number;
  resultUrl?: string;
}

export interface ChromeBridgeState {
  extensionDetected: boolean;
  flowTabConnected: boolean;
  dreaminaTabConnected: boolean;
  connectedPlatforms: Record<string, boolean>;
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
  audioUrl?: string;
  waveform?: number[];
  videoTheme?: CanvasNode['videoTheme'];
  seed?: number;
  promptOrDialogue: string;
  lipSyncCharacter?: string;
  audioFreqHz?: number;
  sfxKind?: 'coastal-surf' | 'room-tone' | 'shutter-foley' | 'acoustic-stem';
  color: string;
}

export interface ChatMessageItem {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: number;
  videoUrl?: string;
  imageUrl?: string;
  nodeFocusPills?: Array<{ nodeId: string; title: string }>;
}

export interface DiskProjectMeta {
  id: string;
  name: string;
  nodeCount: number;
  edgeCount: number;
  snapshotCount: number;
  updatedAt: number;
}

export interface DiskSnapshotItem {
  snapshotId: string;
  label: string;
  createdAt: number;
  state: Record<string, unknown>;
}

export interface DiskProjectRecord {
  id: string;
  name: string;
  state: Record<string, unknown>;
  snapshots?: DiskSnapshotItem[];
  updatedAt: number;
}

export interface BridgeIncomingEvent {
  eventId?: string;
  timestamp?: number;
  type:
    | 'bridge_asset'
    | 'bridge_prompt'
    | 'bridge_session'
    | 'bridge_job_complete'
    | 'dispatch_bridge_job';
  source?: BrowserPlatformTarget | 'flow' | 'manual' | string;
  jobId?: string;
  target?: BrowserPlatformTarget | string;
  status?: string;
  mediaUrl?: string;
  imageUrl?: string;
  localImageUrl?: string;
  videoUrl?: string;
  localVideoUrl?: string;
  audioUrl?: string;
  localAudioUrl?: string;
  error?: string;
  title?: string;
  prompt?: string;
  job?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface StudioHistorySnapshot {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  multiframes: MultiframeCard[];
  bridges: MultiframeBridge[];
  timelineClips: TimelineClip[];
}
