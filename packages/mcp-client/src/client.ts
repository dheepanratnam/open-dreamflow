/**
 * @open-dreamflow/mcp-client — Universal MCP Client & Canvas Node Schema Converter
 */

export const MCP_PROTOCOL_VERSION = '2025-03-26';

export type McpTransportKind = 'websocket' | 'sse' | 'http';

export interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: number | string;
  method: string;
  params?: Record<string, unknown>;
}

export interface JsonRpcNotification {
  jsonrpc: '2.0';
  method: string;
  params?: Record<string, unknown>;
}

export interface JsonRpcErrorObject {
  code: number;
  message: string;
  data?: unknown;
}

export interface JsonRpcResponse<T = unknown> {
  jsonrpc: '2.0';
  id: number | string | null;
  result?: T;
  error?: JsonRpcErrorObject;
}

export interface McpJsonSchemaProperty {
  type?: string | string[];
  description?: string;
  enum?: Array<string | number | boolean>;
  default?: unknown;
  minimum?: number;
  maximum?: number;
  format?: string;
  items?: McpJsonSchemaProperty;
  properties?: Record<string, McpJsonSchemaProperty>;
  required?: string[];
}

export interface McpToolInputSchema {
  type: 'object';
  properties?: Record<string, McpJsonSchemaProperty>;
  required?: string[];
  additionalProperties?: boolean;
}

export interface McpToolAnnotations {
  title?: string;
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
  idempotentHint?: boolean;
  openWorldHint?: boolean;
}

export interface McpToolDefinition {
  name: string;
  description?: string;
  inputSchema: McpToolInputSchema;
  annotations?: McpToolAnnotations;
}

export interface McpContentBlock {
  type: 'text' | 'image' | 'audio' | 'resource';
  text?: string;
  data?: string;
  mimeType?: string;
  uri?: string;
  resource?: {
    uri: string;
    mimeType?: string;
    text?: string;
    blob?: string;
  };
}

export interface McpToolCallResult {
  content: McpContentBlock[];
  isError?: boolean;
  structuredContent?: Record<string, unknown>;
  extractedMedia: {
    videoUrl?: string;
    imageUrl?: string;
    audioUrl?: string;
    styleDna?: Record<string, unknown>;
    interactionId?: string;
    parsedJson?: Record<string, unknown>;
    textSummary: string;
  };
}

export type CanvasPortDataType =
  | 'video'
  | 'image'
  | 'mask'
  | 'audio'
  | 'elements'
  | 'style_dna'
  | 'keyframes'
  | 'prompt'
  | 'interaction_id'
  | 'timeline'
  | 'json'
  | 'number'
  | 'boolean';

export interface CanvasNodePortSchema {
  id: string;
  label: string;
  dataType: CanvasPortDataType;
  required: boolean;
  multiple?: boolean;
  description?: string;
}

export interface CanvasNodeInspectorControl {
  key: string;
  label: string;
  controlType: 'text' | 'textarea' | 'number' | 'slider' | 'select' | 'toggle' | 'json';
  defaultValue?: unknown;
  options?: Array<{ label: string; value: string | number | boolean }>;
  min?: number;
  max?: number;
  step?: number;
  description?: string;
}

export type CanvasNodeCategory =
  | 'video-generation'
  | 'image-editing'
  | 'style-dna'
  | 'scene-builder'
  | 'mcp-custom';

export interface CanvasNodeSchema {
  nodeTypeId: string;
  serverId: string;
  toolName: string;
  title: string;
  description: string;
  category: CanvasNodeCategory;
  icon: string;
  accentColor: string;
  inputPorts: CanvasNodePortSchema[];
  outputPorts: CanvasNodePortSchema[];
  inspectorControls: CanvasNodeInspectorControl[];
  rawTool: McpToolDefinition;
}

export interface BoundCanvasMcpNode extends CanvasNodeSchema {
  execute: (
    args: Record<string, unknown>,
    options?: { signal?: AbortSignal; onProgress?: (progress: McpProgressNotification) => void }
  ) => Promise<McpToolCallResult>;
}

export interface McpProgressNotification {
  progressToken: string | number;
  progress: number;
  total?: number;
  message?: string;
}

export interface UniversalMcpClientOptions {
  serverId?: string;
  url: string;
  transport?: McpTransportKind;
  headers?: Record<string, string>;
  requestTimeoutMs?: number;
  onToolsChanged?: (tools: McpToolDefinition[], nodes: BoundCanvasMcpNode[]) => void;
  onConnectionStateChange?: (state: 'connecting' | 'connected' | 'disconnected' | 'error') => void;
  fetchImpl?: typeof fetch;
  WebSocketImpl?: typeof WebSocket;
}

export class McpClientError extends Error {
  public readonly code?: number;
  public readonly data?: unknown;

  constructor(message: string, code?: number, data?: unknown) {
    super(message);
    this.name = 'McpClientError';
    this.code = code;
    this.data = data;
  }
}

const CANONICAL_TOOL_BLUEPRINTS: Record<
  string,
  {
    title: string;
    category: CanvasNodeCategory;
    icon: string;
    accentColor: string;
    inputPorts: CanvasNodePortSchema[];
    outputPorts: CanvasNodePortSchema[];
  }
> = {
  generate_video: {
    title: 'MCP · Generate Video',
    category: 'video-generation',
    icon: '🎬',
    accentColor: '#6366F1',
    inputPorts: [
      { id: 'prompt', label: 'Scene Prompt', dataType: 'prompt', required: true },
      { id: 'first_frame', label: 'First Frame', dataType: 'image', required: false },
      { id: 'last_frame', label: 'Last Frame', dataType: 'image', required: false },
      { id: 'reference_elements', label: '@Elements (≤6)', dataType: 'elements', required: false, multiple: true },
      { id: 'style_dna', label: 'Style DNA', dataType: 'style_dna', required: false },
      { id: 'previous_interaction_id', label: 'Prior Turn ID', dataType: 'interaction_id', required: false },
    ],
    outputPorts: [
      { id: 'video', label: 'Video Clip', dataType: 'video', required: true },
      { id: 'last_frame', label: 'Last Frame', dataType: 'image', required: false },
      { id: 'interaction_id', label: 'Interaction ID', dataType: 'interaction_id', required: false },
    ],
  },
  inpaint_frame: {
    title: 'MCP · Smart Inpaint Frame',
    category: 'image-editing',
    icon: '🖌️',
    accentColor: '#EC4899',
    inputPorts: [
      { id: 'source_frame', label: 'Source Frame', dataType: 'image', required: true },
      { id: 'mask_image', label: 'Brush Mask', dataType: 'mask', required: true },
      { id: 'prompt', label: 'Redraw Prompt', dataType: 'prompt', required: true },
      { id: 'style_dna', label: 'Style DNA', dataType: 'style_dna', required: false },
    ],
    outputPorts: [
      { id: 'edited_frame', label: 'Inpainted Frame', dataType: 'image', required: true },
      { id: 'mask_layer', label: 'Non-Destructive Mask', dataType: 'mask', required: false },
    ],
  },
  extract_style_dna: {
    title: 'MCP · Extract Style DNA',
    category: 'style-dna',
    icon: '🧬',
    accentColor: '#10B981',
    inputPorts: [
      { id: 'reference_images', label: 'Reference Frames', dataType: 'image', required: true, multiple: true },
    ],
    outputPorts: [
      { id: 'style_dna', label: 'Style DNA Lock', dataType: 'style_dna', required: true },
      { id: 'palette_preview', label: 'Color Swatch', dataType: 'json', required: false },
    ],
  },
  flow_scene_builder: {
    title: 'MCP · Flow Scene Builder',
    category: 'scene-builder',
    icon: '🎞️',
    accentColor: '#F59E0B',
    inputPorts: [
      { id: 'prompt', label: 'Sequence Script', dataType: 'prompt', required: true },
      { id: 'keyframes', label: 'Keyframes (2–10)', dataType: 'keyframes', required: false, multiple: true },
      { id: 'reference_elements', label: '@Elements Vault', dataType: 'elements', required: false, multiple: true },
      { id: 'style_dna', label: 'Style DNA', dataType: 'style_dna', required: false },
    ],
    outputPorts: [
      { id: 'video', label: 'Compiled Sequence', dataType: 'video', required: true },
      { id: 'timeline_tracks', label: 'Rough-Cut Tracks', dataType: 'timeline', required: false },
      { id: 'interaction_id', label: 'Chain Turn ID', dataType: 'interaction_id', required: false },
    ],
  },
};

function inferCanvasPortType(
  propName: string,
  propSchema: McpJsonSchemaProperty
): CanvasPortDataType | null {
  const lower = propName.toLowerCase();
  if (lower.includes('mask')) return 'mask';
  if (lower.includes('video')) return 'video';
  if (
    lower.includes('image') ||
    lower.includes('frame') ||
    lower.includes('photo') ||
    lower.includes('thumbnail')
  ) {
    return lower.includes('keyframes') ? 'keyframes' : 'image';
  }
  if (lower.includes('audio') || lower.includes('voice') || lower.includes('sfx')) return 'audio';
  if (lower.includes('style_dna') || lower === 'style') return 'style_dna';
  if (lower.includes('element')) return 'elements';
  if (lower.includes('interaction_id')) return 'interaction_id';
  if (lower === 'prompt' || lower.endsWith('_prompt') || lower === 'instruction') return 'prompt';
  if (propSchema.type === 'object') return 'json';
  return null;
}

function humanizeIdentifier(raw: string): string {
  return raw
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (ch) => ch.toUpperCase())
    .trim();
}

export function mcpToolToCanvasNodeSchema(
  tool: McpToolDefinition,
  serverId = 'mcp-server'
): CanvasNodeSchema {
  const normalizedName = tool.name.trim();
  const blueprint = CANONICAL_TOOL_BLUEPRINTS[normalizedName];
  const properties = tool.inputSchema?.properties || {};
  const requiredSet = new Set(tool.inputSchema?.required || []);

  const inputPorts: CanvasNodePortSchema[] = blueprint
    ? blueprint.inputPorts.map((p) => ({ ...p }))
    : [];
  const existingPortIds = new Set(inputPorts.map((p) => p.id));
  const inspectorControls: CanvasNodeInspectorControl[] = [];

  for (const [propKey, propSchema] of Object.entries(properties)) {
    const portType = inferCanvasPortType(propKey, propSchema);
    const isRequired = requiredSet.has(propKey);

    if (portType && !existingPortIds.has(propKey)) {
      inputPorts.push({
        id: propKey,
        label: humanizeIdentifier(propKey),
        dataType: portType,
        required: isRequired,
        multiple: propSchema.type === 'array',
        description: propSchema.description,
      });
      existingPortIds.add(propKey);
    }

    const schemaType = Array.isArray(propSchema.type) ? propSchema.type[0] : propSchema.type;
    if (Array.isArray(propSchema.enum) && propSchema.enum.length > 0) {
      inspectorControls.push({
        key: propKey,
        label: humanizeIdentifier(propKey),
        controlType: 'select',
        defaultValue: propSchema.default ?? propSchema.enum[0],
        options: propSchema.enum.map((val) => ({ label: String(val), value: val })),
        description: propSchema.description,
      });
    } else if (schemaType === 'boolean') {
      inspectorControls.push({
        key: propKey,
        label: humanizeIdentifier(propKey),
        controlType: 'toggle',
        defaultValue: propSchema.default ?? false,
        description: propSchema.description,
      });
    } else if (schemaType === 'number' || schemaType === 'integer') {
      const hasBounds =
        typeof propSchema.minimum === 'number' && typeof propSchema.maximum === 'number';
      inspectorControls.push({
        key: propKey,
        label: humanizeIdentifier(propKey),
        controlType: hasBounds ? 'slider' : 'number',
        defaultValue: propSchema.default ?? propSchema.minimum ?? 0,
        min: propSchema.minimum,
        max: propSchema.maximum,
        step: schemaType === 'integer' ? 1 : 0.05,
        description: propSchema.description,
      });
    } else if (schemaType === 'string' && (!portType || portType === 'prompt')) {
      const isLongText =
        portType === 'prompt' ||
        propKey.toLowerCase().includes('script') ||
        propKey.toLowerCase().includes('description');
      inspectorControls.push({
        key: propKey,
        label: humanizeIdentifier(propKey),
        controlType: isLongText ? 'textarea' : 'text',
        defaultValue: propSchema.default ?? '',
        description: propSchema.description,
      });
    }
  }

  if (inputPorts.length === 0) {
    inputPorts.push({ id: 'input_payload', label: 'Trigger / Input', dataType: 'json', required: false });
  }

  const outputPorts: CanvasNodePortSchema[] = blueprint
    ? blueprint.outputPorts.map((p) => ({ ...p }))
    : [
        { id: 'video', label: 'Video Out', dataType: 'video', required: false },
        { id: 'image', label: 'Image Out', dataType: 'image', required: false },
        { id: 'result_json', label: 'Structured Output', dataType: 'json', required: true },
      ];

  return {
    nodeTypeId: `mcp:${serverId}:${normalizedName}`,
    serverId,
    toolName: normalizedName,
    title:
      tool.annotations?.title || blueprint?.title || `MCP · ${humanizeIdentifier(normalizedName)}`,
    description: tool.description || `Connected MCP tool "${normalizedName}" from ${serverId}`,
    category: blueprint?.category || 'mcp-custom',
    icon: blueprint?.icon || '🔌',
    accentColor: blueprint?.accentColor || '#38BDF8',
    inputPorts,
    outputPorts,
    inspectorControls,
    rawTool: tool,
  };
}

export function convertToolsToCanvasNodes(
  tools: McpToolDefinition[],
  serverId = 'mcp-server'
): CanvasNodeSchema[] {
  return tools.map((t) => mcpToolToCanvasNodeSchema(t, serverId));
}

export function normalizeMcpToolCallResult(raw: Record<string, unknown>): McpToolCallResult {
  const content = Array.isArray(raw.content) ? (raw.content as McpContentBlock[]) : [];
  const structured =
    typeof raw.structuredContent === 'object' && raw.structuredContent !== null
      ? (raw.structuredContent as Record<string, unknown>)
      : undefined;

  let videoUrl: string | undefined;
  let imageUrl: string | undefined;
  let audioUrl: string | undefined;
  let styleDna: Record<string, unknown> | undefined;
  let interactionId: string | undefined;
  let parsedJson: Record<string, unknown> | undefined = structured;
  const textSnippets: string[] = [];

  for (const block of content) {
    if (block.type === 'text' && typeof block.text === 'string') {
      textSnippets.push(block.text);
      const trimmed = block.text.trim();
      if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
        try {
          const obj = JSON.parse(trimmed) as Record<string, unknown>;
          parsedJson = { ...(parsedJson || {}), ...obj };
        } catch {
          // Plain text
        }
      }
    } else if (block.type === 'image' && block.data) {
      const mime = block.mimeType || 'image/png';
      imageUrl = block.data.startsWith('data:') ? block.data : `data:${mime};base64,${block.data}`;
    } else if (block.type === 'audio' && block.data) {
      const mime = block.mimeType || 'audio/mp3';
      audioUrl = block.data.startsWith('data:') ? block.data : `data:${mime};base64,${block.data}`;
    } else if (block.type === 'resource' && block.resource) {
      const rUri = block.resource.uri;
      const rMime = block.resource.mimeType || '';
      if (rMime.startsWith('video/') || /\.(mp4|webm|mov)(\?|$)/i.test(rUri)) videoUrl = rUri;
      else if (rMime.startsWith('image/') || /\.(png|jpe?g|webp)(\?|$)/i.test(rUri)) imageUrl = rUri;
      else if (rMime.startsWith('audio/')) audioUrl = rUri;
    }
  }

  if (parsedJson) {
    if (!videoUrl && typeof parsedJson.videoUrl === 'string') videoUrl = parsedJson.videoUrl;
    if (!videoUrl && typeof parsedJson.video_url === 'string') videoUrl = parsedJson.video_url;
    if (!imageUrl && typeof parsedJson.imageUrl === 'string') imageUrl = parsedJson.imageUrl;
    if (!imageUrl && typeof parsedJson.image_url === 'string') imageUrl = parsedJson.image_url;
    if (!audioUrl && typeof parsedJson.audioUrl === 'string') audioUrl = parsedJson.audioUrl;
    if (typeof parsedJson.interactionId === 'string') interactionId = parsedJson.interactionId;
    if (typeof parsedJson.interaction_id === 'string') interactionId = parsedJson.interaction_id;
    if (typeof parsedJson.styleDna === 'object' && parsedJson.styleDna !== null) {
      styleDna = parsedJson.styleDna as Record<string, unknown>;
    } else if (typeof parsedJson.style_dna === 'object' && parsedJson.style_dna !== null) {
      styleDna = parsedJson.style_dna as Record<string, unknown>;
    }
  }

  return {
    content,
    isError: Boolean(raw.isError),
    structuredContent: structured,
    extractedMedia: {
      videoUrl,
      imageUrl,
      audioUrl,
      styleDna,
      interactionId,
      parsedJson,
      textSummary: textSnippets.join('\n').trim(),
    },
  };
}

export class UniversalMcpClient {
  public readonly serverId: string;
  public readonly url: string;
  public readonly transport: McpTransportKind;

  private readonly headers: Record<string, string>;
  private readonly requestTimeoutMs: number;
  private readonly onToolsChanged?: UniversalMcpClientOptions['onToolsChanged'];
  private readonly onConnectionStateChange?: UniversalMcpClientOptions['onConnectionStateChange'];
  private readonly fetchImpl: typeof fetch;
  private readonly WebSocketImpl?: typeof WebSocket;

  private nextRequestId = 1;
  private ws: WebSocket | null = null;
  private sseAbortController: AbortController | null = null;
  private ssePostUrl: string | null = null;
  private httpSessionId: string | null = null;
  private isConnected = false;

  private serverInfo: { name?: string; version?: string } | null = null;
  private cachedTools: McpToolDefinition[] = [];

  private readonly pendingRequests = new Map<
    number | string,
    {
      resolve: (value: unknown) => void;
      reject: (reason: Error) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  >();

  private readonly progressCallbacks = new Map<
    string | number,
    (progress: McpProgressNotification) => void
  >();

  constructor(options: UniversalMcpClientOptions) {
    this.url = options.url.trim();
    this.serverId =
      options.serverId ||
      this.url
        .replace(/^[a-z]+:\/\//i, '')
        .replace(/[^a-zA-Z0-9_-]+/g, '-')
        .replace(/^-|-$/g, '') ||
      'mcp-server';
    this.transport = options.transport || UniversalMcpClient.detectTransport(this.url);
    this.headers = { ...(options.headers || {}) };
    this.requestTimeoutMs = options.requestTimeoutMs ?? 180_000;
    this.onToolsChanged = options.onToolsChanged;
    this.onConnectionStateChange = options.onConnectionStateChange;
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
    this.WebSocketImpl = options.WebSocketImpl ?? globalThis.WebSocket;
  }

  public static detectTransport(url: string): McpTransportKind {
    if (/^wss?:\/\//i.test(url)) return 'websocket';
    if (/\/sse(\?|$|\/)/i.test(url)) return 'sse';
    return 'http';
  }

  public get connected(): boolean {
    return this.isConnected;
  }

  public getServerInfo(): { name?: string; version?: string } | null {
    return this.serverInfo;
  }

  public async connect(): Promise<{
    serverInfo: { name?: string; version?: string };
    tools: McpToolDefinition[];
    canvasNodes: BoundCanvasMcpNode[];
  }> {
    this.onConnectionStateChange?.('connecting');

    try {
      if (this.transport === 'websocket') await this.openWebSocket();
      else if (this.transport === 'sse') await this.openSseStream();

      const initResult = (await this.sendRequest('initialize', {
        protocolVersion: MCP_PROTOCOL_VERSION,
        capabilities: { roots: { listChanged: false }, sampling: {} },
        clientInfo: { name: 'open-dreamflow-mcp-client', version: '1.0.0' },
      })) as Record<string, unknown>;

      this.serverInfo = (initResult?.serverInfo as { name?: string; version?: string }) || {
        name: this.serverId,
      };

      await this.sendNotification('notifications/initialized', {});
      this.isConnected = true;
      this.onConnectionStateChange?.('connected');

      const tools = await this.listTools();
      const canvasNodes = this.getBoundCanvasNodes();

      return { serverInfo: this.serverInfo, tools, canvasNodes };
    } catch (err) {
      this.isConnected = false;
      this.onConnectionStateChange?.('error');
      throw err;
    }
  }

  public async listTools(): Promise<McpToolDefinition[]> {
    const collected: McpToolDefinition[] = [];
    let cursor: string | undefined;

    do {
      const res = (await this.sendRequest(
        'tools/list',
        cursor ? { cursor } : {}
      )) as Record<string, unknown>;

      const batch = Array.isArray(res?.tools) ? (res.tools as McpToolDefinition[]) : [];
      collected.push(...batch);
      cursor = typeof res?.nextCursor === 'string' && res.nextCursor ? res.nextCursor : undefined;
    } while (cursor);

    this.cachedTools = collected;
    return collected;
  }

  public getBoundCanvasNodes(): BoundCanvasMcpNode[] {
    return this.cachedTools.map((tool) => {
      const schema = mcpToolToCanvasNodeSchema(tool, this.serverId);
      return {
        ...schema,
        execute: (args, options) => this.callTool(tool.name, args, options),
      };
    });
  }

  public async callTool(
    name: string,
    args: Record<string, unknown> = {},
    options?: {
      signal?: AbortSignal;
      onProgress?: (progress: McpProgressNotification) => void;
    }
  ): Promise<McpToolCallResult> {
    const progressToken = `df_prog_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    if (options?.onProgress) this.progressCallbacks.set(progressToken, options.onProgress);

    try {
      const raw = (await this.sendRequest(
        'tools/call',
        {
          name,
          arguments: args,
          _meta: options?.onProgress ? { progressToken } : undefined,
        },
        options?.signal
      )) as Record<string, unknown>;

      const normalized = normalizeMcpToolCallResult(raw);
      if (normalized.isError) {
        throw new McpClientError(
          `MCP tool "${name}" returned error: ${normalized.extractedMedia.textSummary || 'Unknown tool error'}`,
          -32000,
          raw
        );
      }
      return normalized;
    } finally {
      this.progressCallbacks.delete(progressToken);
    }
  }

  public async listResources(): Promise<Array<Record<string, unknown>>> {
    const res = (await this.sendRequest('resources/list', {})) as Record<string, unknown>;
    return Array.isArray(res?.resources)
      ? (res.resources as Array<Record<string, unknown>>)
      : [];
  }

  public async disconnect(): Promise<void> {
    this.isConnected = false;
    for (const [, pending] of this.pendingRequests) {
      clearTimeout(pending.timer);
      pending.reject(new McpClientError('MCP client disconnected.'));
    }
    this.pendingRequests.clear();

    if (this.ws) {
      try {
        this.ws.close();
      } catch {
        // Ignore
      }
      this.ws = null;
    }

    if (this.sseAbortController) {
      this.sseAbortController.abort();
      this.sseAbortController = null;
    }

    this.onConnectionStateChange?.('disconnected');
  }

  private async openWebSocket(): Promise<void> {
    if (!this.WebSocketImpl) {
      throw new McpClientError('WebSocket is not available in this runtime.');
    }

    await new Promise<void>((resolve, reject) => {
      const socket = new this.WebSocketImpl!(this.url);
      let settled = false;

      socket.onopen = () => {
        settled = true;
        this.ws = socket;
        resolve();
      };

      socket.onerror = () => {
        if (!settled) {
          settled = true;
          reject(new McpClientError(`Failed to connect to MCP WebSocket at ${this.url}`));
        }
      };

      socket.onclose = () => {
        this.isConnected = false;
        this.onConnectionStateChange?.('disconnected');
        for (const [, pending] of this.pendingRequests) {
          clearTimeout(pending.timer);
          pending.reject(new McpClientError('MCP WebSocket connection closed.'));
        }
        this.pendingRequests.clear();
      };

      socket.onmessage = (event) => {
        const text = typeof event.data === 'string' ? event.data : String(event.data);
        this.handleIncomingJsonRpcText(text);
      };
    });
  }

  private async openSseStream(): Promise<void> {
    this.sseAbortController = new AbortController();
    const res = await this.fetchImpl(this.url, {
      method: 'GET',
      headers: { Accept: 'text/event-stream', ...this.headers },
      signal: this.sseAbortController.signal,
    });

    if (!res.ok || !res.body) {
      throw new McpClientError(
        `Failed to open MCP SSE stream at ${this.url} (${res.status})`,
        res.status
      );
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();

    await new Promise<void>((resolveEndpoint, rejectEndpoint) => {
      let endpointResolved = false;
      let buffer = '';

      const pump = async () => {
        try {
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });

            let boundaryIdx: number;
            while ((boundaryIdx = buffer.indexOf('\n\n')) !== -1) {
              const rawEvent = buffer.slice(0, boundaryIdx);
              buffer = buffer.slice(boundaryIdx + 2);

              let eventType = 'message';
              const dataLines: string[] = [];
              for (const line of rawEvent.split(/\r?\n/)) {
                if (line.startsWith('event:')) eventType = line.slice(6).trim();
                else if (line.startsWith('data:')) dataLines.push(line.slice(5).trimStart());
              }

              const dataPayload = dataLines.join('\n');
              if (eventType === 'endpoint' && dataPayload) {
                this.ssePostUrl = new URL(dataPayload, this.url).toString();
                if (!endpointResolved) {
                  endpointResolved = true;
                  resolveEndpoint();
                }
              } else if (dataPayload) {
                this.handleIncomingJsonRpcText(dataPayload);
              }
            }
          }
        } catch (err) {
          if (!endpointResolved) {
            endpointResolved = true;
            rejectEndpoint(err instanceof Error ? err : new Error(String(err)));
          }
        }
      };

      void pump();

      setTimeout(() => {
        if (!endpointResolved) {
          this.ssePostUrl = this.url.replace(/\/sse(\?.*)?$/i, '/messages');
          endpointResolved = true;
          resolveEndpoint();
        }
      }, 1500);
    });
  }

  private async sendRequest(
    method: string,
    params?: Record<string, unknown>,
    signal?: AbortSignal
  ): Promise<unknown> {
    const id = this.nextRequestId++;
    const rpcRequest: JsonRpcRequest = { jsonrpc: '2.0', id, method, params };

    if (this.transport === 'http') return this.sendHttpJsonRpc(rpcRequest, signal);

    return new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(
          new McpClientError(
            `MCP request "${method}" (id=${id}) timed out after ${this.requestTimeoutMs}ms.`
          )
        );
      }, this.requestTimeoutMs);

      if (signal) {
        signal.addEventListener(
          'abort',
          () => {
            clearTimeout(timer);
            this.pendingRequests.delete(id);
            reject(new McpClientError(`MCP request "${method}" aborted by caller.`));
          },
          { once: true }
        );
      }

      this.pendingRequests.set(id, { resolve, reject, timer });

      if (this.transport === 'websocket') {
        if (!this.ws || this.ws.readyState !== 1) {
          clearTimeout(timer);
          this.pendingRequests.delete(id);
          reject(new McpClientError('MCP WebSocket is not open.'));
          return;
        }
        this.ws.send(JSON.stringify(rpcRequest));
      } else if (this.transport === 'sse') {
        const postTarget = this.ssePostUrl || this.url;
        this.fetchImpl(postTarget, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...this.headers },
          body: JSON.stringify(rpcRequest),
          signal,
        })
          .then(async (res) => {
            if (!res.ok) throw new McpClientError(`MCP SSE POST failed (${res.status})`, res.status);
            const text = await res.text();
            if (text && text.trim().startsWith('{')) this.handleIncomingJsonRpcText(text);
          })
          .catch((err: unknown) => {
            clearTimeout(timer);
            this.pendingRequests.delete(id);
            reject(err instanceof Error ? err : new Error(String(err)));
          });
      }
    });
  }

  private async sendNotification(
    method: string,
    params?: Record<string, unknown>
  ): Promise<void> {
    const notification: JsonRpcNotification = { jsonrpc: '2.0', method, params };

    if (this.transport === 'websocket' && this.ws && this.ws.readyState === 1) {
      this.ws.send(JSON.stringify(notification));
      return;
    }

    const postUrl = this.transport === 'sse' ? this.ssePostUrl || this.url : this.url;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...this.headers,
    };
    if (this.httpSessionId) headers['Mcp-Session-Id'] = this.httpSessionId;

    await this.fetchImpl(postUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(notification),
    }).catch(() => {});
  }

  private async sendHttpJsonRpc(
    rpcRequest: JsonRpcRequest,
    signal?: AbortSignal
  ): Promise<unknown> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      ...this.headers,
    };
    if (this.httpSessionId) headers['Mcp-Session-Id'] = this.httpSessionId;

    const res = await this.fetchImpl(this.url, {
      method: 'POST',
      headers,
      body: JSON.stringify(rpcRequest),
      signal,
    });

    const returnedSession = res.headers.get('mcp-session-id');
    if (returnedSession) this.httpSessionId = returnedSession;

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new McpClientError(
        `MCP HTTP POST failed (${res.status}): ${errText.slice(0, 300)}`,
        res.status
      );
    }

    const contentType = res.headers.get('content-type') || '';
    let rawJsonText = await res.text();

    if (contentType.includes('text/event-stream')) {
      const dataLines = rawJsonText
        .split(/\r?\n/)
        .filter((l) => l.startsWith('data:'))
        .map((l) => l.slice(5).trim());
      rawJsonText = dataLines[dataLines.length - 1] || '{}';
    }

    const parsed = JSON.parse(rawJsonText) as JsonRpcResponse;
    if (parsed.error) {
      throw new McpClientError(
        parsed.error.message || 'MCP JSON-RPC error',
        parsed.error.code,
        parsed.error.data
      );
    }
    return parsed.result;
  }

  private handleIncomingJsonRpcText(rawText: string): void {
    for (const line of rawText.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('{')) continue;

      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(trimmed) as Record<string, unknown>;
      } catch {
        continue;
      }

      if (
        'id' in msg &&
        msg.id !== null &&
        msg.id !== undefined &&
        ('result' in msg || 'error' in msg)
      ) {
        const pending = this.pendingRequests.get(msg.id as number | string);
        if (pending) {
          clearTimeout(pending.timer);
          this.pendingRequests.delete(msg.id as number | string);
          if (msg.error) {
            const errObj = msg.error as JsonRpcErrorObject;
            pending.reject(
              new McpClientError(errObj.message || 'MCP error', errObj.code, errObj.data)
            );
          } else {
            pending.resolve(msg.result);
          }
        }
        continue;
      }

      if (typeof msg.method === 'string') {
        if (msg.method === 'notifications/tools/list_changed') {
          void this.listTools().then((tools) => {
            this.onToolsChanged?.(tools, this.getBoundCanvasNodes());
          });
        } else if (msg.method === 'notifications/progress') {
          const params = (msg.params || {}) as Record<string, unknown>;
          const token = params.progressToken as string | number | undefined;
          if (token !== undefined) {
            const cb = this.progressCallbacks.get(token);
            cb?.({
              progressToken: token,
              progress: Number(params.progress ?? 0),
              total: typeof params.total === 'number' ? params.total : undefined,
              message: typeof params.message === 'string' ? params.message : undefined,
            });
          }
        }
      }
    }
  }
}
