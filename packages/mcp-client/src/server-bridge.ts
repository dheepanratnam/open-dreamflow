#!/usr/bin/env node
/**
 * @open-dreamflow/mcp-client — Local STDIO -> HTTP / SSE / WebSocket MCP Bridge
 */

import * as http from 'node:http';
import * as crypto from 'node:crypto';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import type { Duplex } from 'node:stream';
import { fileURLToPath } from 'node:url';
import * as path from 'node:path';
import type { McpToolDefinition } from './client.js';

const WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

export interface McpStdioBridgeOptions {
  port?: number;
  host?: string;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
  corsOrigin?: string;
  quiet?: boolean;
}

interface WsClientRecord {
  id: string;
  socket: Duplex;
  frameBuffer: Buffer;
}

interface SseClientRecord {
  id: string;
  res: http.ServerResponse;
}

interface PendingStdioCall {
  originalId: number | string;
  respond: (jsonRpcResponseObj: Record<string, unknown>) => void;
  timer: ReturnType<typeof setTimeout>;
}

export const BUILTIN_DREAMFLOW_MCP_TOOLS: McpToolDefinition[] = [
  {
    name: 'generate_video',
    description:
      'Synthesize a 3s–15s video clip using Gemini Omni 1.2 Flash or local GPU pipeline with @Element locks and First/Last frame anchors.',
    annotations: { title: 'MCP · Generate Video (Omni / Local)' },
    inputSchema: {
      type: 'object',
      required: ['prompt'],
      properties: {
        prompt: { type: 'string', description: 'Scene direction prompt with optional @Element tags' },
        duration_seconds: { type: 'integer', minimum: 3, maximum: 15, default: 8 },
        resolution: { type: 'string', enum: ['360p', '720p', '1080p', '2k', '4k'], default: '720p' },
        aspect_ratio: { type: 'string', enum: ['16:9', '9:16', '21:9', '1:1'], default: '16:9' },
        first_frame: { type: 'string' },
        last_frame: { type: 'string' },
        previous_interaction_id: { type: 'string' },
      },
    },
  },
  {
    name: 'inpaint_frame',
    description:
      'Non-destructively redraw a masked region of a spatial canvas frame while preserving surrounding lighting and perspective.',
    annotations: { title: 'MCP · Smart Inpaint Frame' },
    inputSchema: {
      type: 'object',
      required: ['source_frame', 'mask_image', 'prompt'],
      properties: {
        source_frame: { type: 'string' },
        mask_image: { type: 'string' },
        prompt: { type: 'string' },
        feather_px: { type: 'integer', minimum: 0, maximum: 64, default: 12 },
      },
    },
  },
  {
    name: 'extract_style_dna',
    description:
      'Extract Color Palette, Lighting Profile, Cinema Lens, and Film Stock tokens from reference frames into a reusable Style DNA lock.',
    annotations: { title: 'MCP · Extract Style DNA' },
    inputSchema: {
      type: 'object',
      required: ['reference_images'],
      properties: {
        reference_images: { type: 'array', items: { type: 'string' } },
        lock_strength: { type: 'number', minimum: 0.1, maximum: 1.0, default: 0.85 },
      },
    },
  },
  {
    name: 'flow_scene_builder',
    description:
      'Compile a multi-shot 2–10 keyframe chain with 10s rolling context continuity and native rough-cut timeline tracks.',
    annotations: { title: 'MCP · Flow Scene Builder' },
    inputSchema: {
      type: 'object',
      required: ['prompt'],
      properties: {
        prompt: { type: 'string' },
        keyframes: { type: 'array', items: { type: 'string' } },
        camera_curve: {
          type: 'string',
          enum: ['dolly_in', 'orbit_left', 'crane_up', 'whip_pan', 'fpv_through'],
          default: 'dolly_in',
        },
        generate_native_audio: { type: 'boolean', default: true },
      },
    },
  },
];

export function encodeWebSocketTextFrame(text: string): Buffer {
  const payload = Buffer.from(text, 'utf8');
  const len = payload.length;

  let header: Buffer;
  if (len < 126) {
    header = Buffer.alloc(2);
    header[0] = 0x81;
    header[1] = len;
  } else if (len < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 126;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x81;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(len), 2);
  }

  return Buffer.concat([header, payload]);
}

function decodeWebSocketFrames(buffer: Buffer): {
  frames: Array<{ opcode: number; payload: Buffer }>;
  remaining: Buffer;
} {
  const frames: Array<{ opcode: number; payload: Buffer }> = [];
  let offset = 0;

  while (offset + 2 <= buffer.length) {
    const firstByte = buffer[offset];
    const secondByte = buffer[offset + 1];
    const opcode = firstByte & 0x0f;
    const isMasked = (secondByte & 0x80) !== 0;
    let payloadLen = secondByte & 0x7f;
    let headerLen = 2;

    if (payloadLen === 126) {
      if (offset + 4 > buffer.length) break;
      payloadLen = buffer.readUInt16BE(offset + 2);
      headerLen = 4;
    } else if (payloadLen === 127) {
      if (offset + 10 > buffer.length) break;
      payloadLen = Number(buffer.readBigUInt64BE(offset + 2));
      headerLen = 10;
    }

    const maskLen = isMasked ? 4 : 0;
    const totalFrameLen = headerLen + maskLen + payloadLen;
    if (offset + totalFrameLen > buffer.length) break;

    const payloadStart = offset + headerLen + maskLen;
    const rawPayload = Buffer.from(buffer.subarray(payloadStart, payloadStart + payloadLen));

    if (isMasked) {
      const maskKey = buffer.subarray(offset + headerLen, offset + headerLen + 4);
      for (let i = 0; i < rawPayload.length; i++) rawPayload[i] ^= maskKey[i & 3];
    }

    frames.push({ opcode, payload: rawPayload });
    offset += totalFrameLen;
  }

  return { frames, remaining: buffer.subarray(offset) };
}

export class McpStdioBridgeServer {
  private readonly port: number;
  private readonly host: string;
  private readonly command?: string;
  private readonly args: string[];
  private readonly env?: Record<string, string>;
  private readonly cwd?: string;
  private readonly corsOrigin: string;
  private readonly quiet: boolean;

  private httpServer: http.Server | null = null;
  private childProc: ChildProcessWithoutNullStreams | null = null;
  private stdioBuffer = '';
  private nextInternalId = 1;

  private readonly wsClients = new Map<string, WsClientRecord>();
  private readonly sseClients = new Map<string, SseClientRecord>();
  private readonly pendingStdioCalls = new Map<string, PendingStdioCall>();

  constructor(options: McpStdioBridgeOptions = {}) {
    this.port = options.port ?? 3001;
    this.host = options.host || '127.0.0.1';
    this.command = options.command;
    this.args = options.args || [];
    this.env = options.env;
    this.cwd = options.cwd;
    this.corsOrigin = options.corsOrigin || '*';
    this.quiet = options.quiet ?? false;
  }

  public async start(): Promise<{ port: number; host: string; wsUrl: string; httpUrl: string }> {
    if (this.command) this.spawnStdioProcess();

    this.httpServer = http.createServer((req, res) => {
      void this.handleHttpRequest(req, res);
    });

    this.httpServer.on('upgrade', (req, socket, head) => {
      this.handleWebSocketUpgrade(req, socket, head);
    });

    const boundPort = await new Promise<number>((resolve, reject) => {
      this.httpServer!.once('error', reject);
      this.httpServer!.listen(this.port, this.host, () => {
        const addr = this.httpServer!.address();
        resolve(typeof addr === 'object' && addr ? addr.port : this.port);
      });
    });

    const displayHost = this.host === '0.0.0.0' ? 'localhost' : this.host;
    const wsUrl = `ws://${displayHost}:${boundPort}/mcp`;
    const httpUrl = `http://${displayHost}:${boundPort}/mcp`;

    this.log(
      `Open-DreamFlow MCP Bridge listening on ${wsUrl} & ${httpUrl} (${
        this.command ? `STDIO -> ${this.command} ${this.args.join(' ')}` : 'Built-in Reference Tools'
      })`
    );

    return { port: boundPort, host: this.host, wsUrl, httpUrl };
  }

  public async stop(): Promise<void> {
    for (const [, pending] of this.pendingStdioCalls) clearTimeout(pending.timer);
    this.pendingStdioCalls.clear();

    for (const [, client] of this.wsClients) {
      try {
        client.socket.destroy();
      } catch {
        // Ignore
      }
    }
    this.wsClients.clear();

    for (const [, sse] of this.sseClients) {
      try {
        sse.res.end();
      } catch {
        // Ignore
      }
    }
    this.sseClients.clear();

    if (this.childProc) {
      this.childProc.kill('SIGTERM');
      this.childProc = null;
    }

    if (this.httpServer) {
      await new Promise<void>((resolve) => {
        this.httpServer!.close(() => resolve());
      });
      this.httpServer = null;
    }
  }

  private spawnStdioProcess(): void {
    if (!this.command) return;

    this.childProc = spawn(this.command, this.args, {
      cwd: this.cwd || process.cwd(),
      env: { ...process.env, ...(this.env || {}) },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    this.childProc.stdout.setEncoding('utf8');
    this.childProc.stdout.on('data', (chunk: string) => {
      this.stdioBuffer += chunk;
      this.drainStdioBuffer();
    });

    this.childProc.stderr.setEncoding('utf8');
    this.childProc.stderr.on('data', (chunk: string) => {
      if (!this.quiet) process.stderr.write(`[STDIO stderr] ${chunk}`);
    });
  }

  private drainStdioBuffer(): void {
    let newlineIdx: number;
    while ((newlineIdx = this.stdioBuffer.indexOf('\n')) !== -1) {
      const line = this.stdioBuffer.slice(0, newlineIdx).trim();
      this.stdioBuffer = this.stdioBuffer.slice(newlineIdx + 1);
      if (!line || !line.startsWith('{')) continue;

      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(line) as Record<string, unknown>;
      } catch {
        continue;
      }

      if ('id' in parsed && typeof parsed.id === 'string' && this.pendingStdioCalls.has(parsed.id)) {
        const pending = this.pendingStdioCalls.get(parsed.id)!;
        clearTimeout(pending.timer);
        this.pendingStdioCalls.delete(parsed.id);
        pending.respond({ ...parsed, id: pending.originalId });
      } else if (typeof parsed.method === 'string') {
        this.broadcastNotification(parsed);
      }
    }
  }

  private broadcastNotification(notificationObj: Record<string, unknown>): void {
    const serialized = JSON.stringify(notificationObj);
    const wsFrame = encodeWebSocketTextFrame(serialized);
    for (const [, wsClient] of this.wsClients) wsClient.socket.write(wsFrame);
    for (const [, sseClient] of this.sseClients) {
      sseClient.res.write(`event: message\ndata: ${serialized}\n\n`);
    }
  }

  private applyCors(res: http.ServerResponse): void {
    res.setHeader('Access-Control-Allow-Origin', this.corsOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, Mcp-Session-Id, Accept'
    );
    res.setHeader('Access-Control-Expose-Headers', 'Mcp-Session-Id');
  }

  private async handleHttpRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse
  ): Promise<void> {
    this.applyCors(res);

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const reqUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const pathname = reqUrl.pathname;

    if (req.method === 'GET' && pathname === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          ok: true,
          service: 'open-dreamflow-mcp-bridge',
          mode: this.command ? 'stdio-subprocess' : 'built-in-dreamflow-tools',
          command: this.command ? `${this.command} ${this.args.join(' ')}`.trim() : null,
          pid: this.childProc?.pid ?? null,
          wsClients: this.wsClients.size,
          sseClients: this.sseClients.size,
        })
      );
      return;
    }

    if (req.method === 'GET' && (pathname === '/mcp/sse' || pathname === '/sse')) {
      const sessionId = crypto.randomUUID();
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      });

      this.sseClients.set(sessionId, { id: sessionId, res });
      res.write(`event: endpoint\ndata: /mcp/messages?sessionId=${sessionId}\n\n`);
      req.on('close', () => this.sseClients.delete(sessionId));
      return;
    }

    if (req.method === 'POST' && (pathname === '/mcp/messages' || pathname === '/messages')) {
      const sessionId = reqUrl.searchParams.get('sessionId') || '';
      const bodyObj = await this.readJsonBody(req);
      if (!bodyObj) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON-RPC payload' }));
        return;
      }

      const responseObj = await this.dispatchJsonRpc(bodyObj);
      const sseTarget = this.sseClients.get(sessionId);
      if (sseTarget && responseObj) {
        sseTarget.res.write(`event: message\ndata: ${JSON.stringify(responseObj)}\n\n`);
      }

      res.writeHead(202, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(responseObj || { accepted: true }));
      return;
    }

    if (req.method === 'POST' && (pathname === '/mcp' || pathname === '/')) {
      const sessionId =
        (req.headers['mcp-session-id'] as string | undefined) || crypto.randomUUID();
      res.setHeader('Mcp-Session-Id', sessionId);

      const bodyObj = await this.readJsonBody(req);
      if (!bodyObj) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            jsonrpc: '2.0',
            id: null,
            error: { code: -32700, message: 'Parse error' },
          })
        );
        return;
      }

      const responseObj = await this.dispatchJsonRpc(bodyObj);
      if (!responseObj) {
        res.writeHead(202);
        res.end();
        return;
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(responseObj));
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: `Unknown MCP bridge route: ${req.method} ${pathname}` }));
  }

  private handleWebSocketUpgrade(req: http.IncomingMessage, socket: Duplex, head: Buffer): void {
    const wsKey = req.headers['sec-websocket-key'];
    if (!wsKey || typeof wsKey !== 'string') {
      socket.write('HTTP/1.1 400 Bad Request\r\n\r\n');
      socket.destroy();
      return;
    }

    const acceptHash = crypto
      .createHash('sha1')
      .update(wsKey + WS_GUID)
      .digest('base64');

    socket.write(
      [
        'HTTP/1.1 101 Switching Protocols',
        'Upgrade: websocket',
        'Connection: Upgrade',
        `Sec-WebSocket-Accept: ${acceptHash}`,
        '\r\n',
      ].join('\r\n')
    );

    const clientId = crypto.randomUUID();
    const record: WsClientRecord = {
      id: clientId,
      socket,
      frameBuffer: head && head.length > 0 ? Buffer.from(head) : Buffer.alloc(0),
    };
    this.wsClients.set(clientId, record);

    const processBuffer = () => {
      const { frames, remaining } = decodeWebSocketFrames(record.frameBuffer);
      record.frameBuffer = remaining;

      for (const frame of frames) {
        if (frame.opcode === 0x8) {
          socket.write(Buffer.from([0x88, 0x00]));
          socket.end();
          this.wsClients.delete(clientId);
          return;
        }
        if (frame.opcode === 0x9) {
          const pongHeader = Buffer.from([0x8a, frame.payload.length & 0x7f]);
          socket.write(Buffer.concat([pongHeader, frame.payload.subarray(0, 125)]));
          continue;
        }
        if (frame.opcode === 0x1) {
          const text = frame.payload.toString('utf8').trim();
          if (!text) continue;
          try {
            const rpcIn = JSON.parse(text) as Record<string, unknown>;
            void this.dispatchJsonRpc(rpcIn).then((rpcOut) => {
              if (rpcOut && this.wsClients.has(clientId)) {
                socket.write(encodeWebSocketTextFrame(JSON.stringify(rpcOut)));
              }
            });
          } catch {
            socket.write(
              encodeWebSocketTextFrame(
                JSON.stringify({
                  jsonrpc: '2.0',
                  id: null,
                  error: { code: -32700, message: 'Invalid JSON over WebSocket' },
                })
              )
            );
          }
        }
      }
    };

    if (record.frameBuffer.length > 0) processBuffer();

    socket.on('data', (chunk: Buffer) => {
      record.frameBuffer = Buffer.concat([record.frameBuffer, chunk]);
      processBuffer();
    });

    socket.on('close', () => this.wsClients.delete(clientId));
    socket.on('error', () => this.wsClients.delete(clientId));
  }

  private async dispatchJsonRpc(
    rpcMsg: Record<string, unknown>
  ): Promise<Record<string, unknown> | null> {
    const hasId = 'id' in rpcMsg && rpcMsg.id !== undefined && rpcMsg.id !== null;

    if (this.childProc && this.childProc.stdin.writable) {
      if (!hasId) {
        this.childProc.stdin.write(`${JSON.stringify(rpcMsg)}\n`);
        return null;
      }

      const originalId = rpcMsg.id as number | string;
      const internalId = `bridge_${this.nextInternalId++}`;

      return new Promise<Record<string, unknown>>((resolve) => {
        const timer = setTimeout(() => {
          this.pendingStdioCalls.delete(internalId);
          resolve({
            jsonrpc: '2.0',
            id: originalId,
            error: {
              code: -32001,
              message: `STDIO MCP server timed out responding to ${String(rpcMsg.method)}`,
            },
          });
        }, 180_000);

        this.pendingStdioCalls.set(internalId, { originalId, respond: resolve, timer });
        this.childProc!.stdin.write(`${JSON.stringify({ ...rpcMsg, id: internalId })}\n`);
      });
    }

    if (!hasId) return null;

    const id = rpcMsg.id as number | string;
    const method = String(rpcMsg.method || '');
    const params = (rpcMsg.params || {}) as Record<string, unknown>;

    if (method === 'initialize') {
      return {
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: '2025-03-26',
          capabilities: { tools: { listChanged: true }, resources: { listChanged: false } },
          serverInfo: { name: 'open-dreamflow-local-bridge', version: '1.0.0' },
        },
      };
    }

    if (method === 'ping') return { jsonrpc: '2.0', id, result: {} };
    if (method === 'tools/list') {
      return { jsonrpc: '2.0', id, result: { tools: BUILTIN_DREAMFLOW_MCP_TOOLS } };
    }
    if (method === 'resources/list') {
      return {
        jsonrpc: '2.0',
        id,
        result: {
          resources: [
            {
              uri: 'dreamflow://elements/vault',
              name: 'Open-DreamFlow @Elements Subject Vault',
              mimeType: 'application/json',
            },
          ],
        },
      };
    }
    if (method === 'tools/call') {
      const toolName = String(params.name || '');
      const args = (params.arguments || {}) as Record<string, unknown>;
      return { jsonrpc: '2.0', id, result: this.executeBuiltinReferenceTool(toolName, args) };
    }

    return { jsonrpc: '2.0', id, error: { code: -32601, message: `Method not found: ${method}` } };
  }

  private executeBuiltinReferenceTool(
    toolName: string,
    args: Record<string, unknown>
  ): Record<string, unknown> {
    const nowId = `int_mcp_${Date.now().toString(36)}`;

    switch (toolName) {
      case 'generate_video': {
        const structured = {
          status: 'COMPLETED',
          tool: 'generate_video',
          interactionId: nowId,
          previousInteractionId: args.previous_interaction_id || null,
          durationSeconds: Number(args.duration_seconds ?? 8),
          resolution: String(args.resolution || '720p'),
          aspectRatio: String(args.aspect_ratio || '16:9'),
          videoUrl:
            'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
        };
        return {
          structuredContent: structured,
          content: [{ type: 'text', text: JSON.stringify(structured) }],
        };
      }
      case 'inpaint_frame': {
        const structured = {
          status: 'COMPLETED',
          tool: 'inpaint_frame',
          imageUrl: String(args.source_frame || ''),
          featherPx: Number(args.feather_px ?? 12),
          prompt: String(args.prompt || ''),
        };
        return {
          structuredContent: structured,
          content: [{ type: 'text', text: JSON.stringify(structured) }],
        };
      }
      case 'extract_style_dna': {
        const styleDna = {
          paletteHex: ['#0F172A', '#38BDF8', '#F43F5E', '#FBBF24', '#E2E8F0'],
          lighting: 'Volumetric Cyberpunk Practical Neon + Wet Asphalt Rim Light',
          lens: '35mm Cooke Anamorphic T2.3',
          filmStock: 'Kodak Vision3 500T 5219',
          lockStrength: Number(args.lock_strength ?? 0.85),
        };
        const structured = { status: 'COMPLETED', tool: 'extract_style_dna', styleDna };
        return {
          structuredContent: structured,
          content: [{ type: 'text', text: JSON.stringify(structured) }],
        };
      }
      case 'flow_scene_builder': {
        const structured = {
          status: 'COMPLETED',
          tool: 'flow_scene_builder',
          interactionId: nowId,
          videoUrl:
            'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
          keyframeCount: Array.isArray(args.keyframes) ? args.keyframes.length : 2,
          cameraCurve: String(args.camera_curve || 'dolly_in'),
        };
        return {
          structuredContent: structured,
          content: [{ type: 'text', text: JSON.stringify(structured) }],
        };
      }
      default:
        return {
          isError: true,
          content: [{ type: 'text', text: `Unknown built-in MCP tool "${toolName}".` }],
        };
    }
  }

  private async readJsonBody(
    req: http.IncomingMessage
  ): Promise<Record<string, unknown> | null> {
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const raw = Buffer.concat(chunks).toString('utf8').trim();
    if (!raw) return null;
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  private log(msg: string): void {
    if (!this.quiet) console.log(`[dreamflow-mcp-bridge] ${msg}`);
  }
}

export function parseBridgeCliArgs(argv: string[]): McpStdioBridgeOptions {
  let port = Number(process.env.PORT || 3001);
  let host = process.env.HOST || '127.0.0.1';
  let quiet = false;
  let command: string | undefined;
  let cmdArgs: string[] = [];

  const dashDashIdx = argv.indexOf('--');
  const flagArgs = dashDashIdx >= 0 ? argv.slice(0, dashDashIdx) : argv;

  if (dashDashIdx >= 0 && argv.length > dashDashIdx + 1) {
    command = argv[dashDashIdx + 1];
    cmdArgs = argv.slice(dashDashIdx + 2);
  }

  for (let i = 0; i < flagArgs.length; i++) {
    const arg = flagArgs[i];
    if ((arg === '--port' || arg === '-p') && flagArgs[i + 1]) port = Number(flagArgs[++i]);
    else if (arg === '--host' && flagArgs[i + 1]) host = flagArgs[++i];
    else if (arg === '--quiet' || arg === '-q') quiet = true;
  }

  return { port, host, command, args: cmdArgs, quiet };
}

const currentFilePath = fileURLToPath(import.meta.url);
const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (invokedPath && path.resolve(currentFilePath) === invokedPath) {
  const cliOpts = parseBridgeCliArgs(process.argv.slice(2));
  const server = new McpStdioBridgeServer(cliOpts);
  server.start().catch((err: unknown) => {
    console.error('[dreamflow-mcp-bridge] Fatal startup error:', err);
    process.exit(1);
  });

  const shutdown = () => {
    void server.stop().finally(() => process.exit(0));
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
