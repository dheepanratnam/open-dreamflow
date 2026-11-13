/**
 * @open-dreamflow/mcp-client — External Multi-Server MCP Host
 * Connects Open-DreamFlow (:3001) to ANY external user MCP server:
 *   - `stdio` subprocesses (supporting BOTH newline-delimited JSON-RPC 2.0 and `Content-Length` framing)
 *   - `http` Streamable HTTP JSON-RPC endpoints (supporting JSON & `text/event-stream` responses + `Mcp-Session-Id`)
 * Discovers `tools/list`, invokes `tools/call`, extracts returned image/video/audio media
 * (MCP `image`/`audio` blocks, `structuredContent`, JSON URLs/base64, or local file paths like `@elevenlabs/elevenlabs-mcp`),
 * and persists server definitions in `.dreamflow-data.nosync/mcp-servers.json` with redacted secrets in GET responses.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';

export type ExternalMcpTransport = 'stdio' | 'http';

export interface ExternalMcpToolSchema {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

export interface PersistedMcpServerConfig {
  id: string;
  name: string;
  platformId: string;
  transport: ExternalMcpTransport;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
  url?: string;
  headers?: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

export interface PublicMcpServerSummary {
  id: string;
  name: string;
  platformId: string;
  transport: ExternalMcpTransport;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  headers?: Record<string, string>;
  status: 'connected' | 'connecting' | 'error' | 'disconnected';
  pid?: number | null;
  error?: string | null;
  tools: ExternalMcpToolSchema[];
  createdAt: string;
  updatedAt: string;
}

export interface ExtractedMcpMediaCandidate {
  kindHint?: 'image' | 'video' | 'audio';
  /** Either a `data:<mime>;base64,...` URI, an `https://...` URL, or an `absfile:<path>` marker */
  source: string;
  mimeType?: string;
}

interface PendingRpcRequest {
  resolve: (value: Record<string, unknown>) => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

interface LiveStdioSession {
  proc: ChildProcessWithoutNullStreams;
  rawBuffer: Buffer;
  pending: Map<string | number, PendingRpcRequest>;
  stderrTail: string;
  useContentLengthFraming: boolean;
}

interface LiveServerRuntime {
  config: PersistedMcpServerConfig;
  status: 'connected' | 'connecting' | 'error' | 'disconnected';
  error: string | null;
  tools: ExternalMcpToolSchema[];
  httpSessionId?: string;
  stdio?: LiveStdioSession;
}

function redactSecretRecord(rec?: Record<string, string>): Record<string, string> | undefined {
  if (!rec) return undefined;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(rec)) {
    out[k] = v ? '***' : '';
  }
  return out;
}

function writeJsonAtomic(targetPath: string, data: unknown): void {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  const tmp = `${targetPath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmp, targetPath);
}

export class ExternalMcpHost {
  private readonly registryPath: string;
  private readonly servers = new Map<string, LiveServerRuntime>();
  private nextRpcId = 1;
  private readonly quiet: boolean;

  constructor(options: { dataDir: string; quiet?: boolean }) {
    this.registryPath = path.join(options.dataDir, 'mcp-servers.json');
    this.quiet = options.quiet ?? false;
  }

  public hydrateFromDiskInBackground(): void {
    try {
      if (!fs.existsSync(this.registryPath)) return;
      const parsed = JSON.parse(fs.readFileSync(this.registryPath, 'utf8'));
      if (!Array.isArray(parsed)) return;

      for (const item of parsed as PersistedMcpServerConfig[]) {
        if (!item || typeof item.id !== 'string') continue;
        const runtime: LiveServerRuntime = {
          config: item,
          status: 'connecting',
          error: null,
          tools: [],
        };
        this.servers.set(item.id, runtime);
        void this.connectRuntime(runtime).catch((err) => {
          runtime.status = 'error';
          runtime.error = err instanceof Error ? err.message : String(err);
        });
      }
    } catch {
      // Ignore malformed registry file on startup
    }
  }

  private persistRegistry(): void {
    try {
      const list: PersistedMcpServerConfig[] = Array.from(this.servers.values()).map(
        (r) => r.config
      );
      writeJsonAtomic(this.registryPath, list);
    } catch {
      // Ignore in read-only environments
    }
  }

  public toPublicSummary(runtime: LiveServerRuntime): PublicMcpServerSummary {
    const { config } = runtime;
    return {
      id: config.id,
      name: config.name,
      platformId: config.platformId,
      transport: config.transport,
      command: config.command,
      args: config.args,
      env: redactSecretRecord(config.env),
      url: config.url,
      headers: redactSecretRecord(config.headers),
      status: runtime.status,
      pid: runtime.stdio?.proc?.pid ?? null,
      error: runtime.error,
      tools: runtime.tools,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
    };
  }

  public listServers(): PublicMcpServerSummary[] {
    return Array.from(this.servers.values()).map((r) => this.toPublicSummary(r));
  }

  public getConnectedServersForPlatform(platformId: string): PublicMcpServerSummary[] {
    return Array.from(this.servers.values())
      .filter(
        (r) =>
          r.status === 'connected' &&
          (r.config.platformId === platformId || platformId === 'custom-mcp')
      )
      .map((r) => this.toPublicSummary(r));
  }

  public findBestServerForExecution(params: {
    mcpServerId?: string;
    platformId?: string;
  }): PublicMcpServerSummary | null {
    if (params.mcpServerId) {
      const exact = this.servers.get(params.mcpServerId);
      if (exact && exact.status === 'connected') {
        return this.toPublicSummary(exact);
      }
    }
    if (params.platformId) {
      for (const r of this.servers.values()) {
        if (r.status === 'connected' && r.config.platformId === params.platformId) {
          return this.toPublicSummary(r);
        }
      }
      if (params.platformId === 'custom-mcp') {
        for (const r of this.servers.values()) {
          if (r.status === 'connected') return this.toPublicSummary(r);
        }
      }
    }
    return null;
  }

  public selectBestToolForModality(
    serverId: string,
    modality: 'image' | 'video' | 'audio',
    explicitToolName?: string
  ): ExternalMcpToolSchema | null {
    const runtime = this.servers.get(serverId);
    if (!runtime || runtime.tools.length === 0) return null;

    if (explicitToolName) {
      const exact = runtime.tools.find((t) => t.name === explicitToolName);
      if (exact) return exact;
    }

    const keywordsByModality: Record<'image' | 'video' | 'audio', RegExp> = {
      image: /image|photo|picture|draw|flux|seedream|imagen|kolors|render_image|text_to_image/i,
      video: /video|animate|i2v|t2v|kling|veo|seedance|wan|sora|motion/i,
      audio: /audio|speech|tts|voice|sound|sfx|music|eleven/i,
    };
    const pattern = keywordsByModality[modality];
    const matched = runtime.tools.find(
      (t) => pattern.test(t.name) || pattern.test(t.description || '')
    );
    return matched || runtime.tools[0];
  }

  public async registerOrUpdateServer(input: Record<string, unknown>): Promise<PublicMcpServerSummary> {
    const rawId =
      typeof input.id === 'string' && input.id.trim()
        ? input.id.trim().replace(/[^a-zA-Z0-9_-]+/g, '-')
        : `mcp_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;

    const existing = this.servers.get(rawId);
    if (existing) {
      await this.teardownRuntimeProcess(existing);
    }

    const rawTransport = String(input.transport || (input.command ? 'stdio' : 'http'))
      .trim()
      .toLowerCase();
    const transport: ExternalMcpTransport = rawTransport === 'stdio' ? 'stdio' : 'http';

    const name =
      typeof input.name === 'string' && input.name.trim()
        ? input.name.trim()
        : String(input.platformId || rawId);
    const platformId =
      typeof input.platformId === 'string' && input.platformId.trim()
        ? input.platformId.trim().toLowerCase()
        : 'custom-mcp';

    const command = typeof input.command === 'string' ? input.command.trim() : undefined;
    const args = Array.isArray(input.args)
      ? input.args.map((a) => String(a))
      : typeof input.args === 'string' && input.args.trim()
        ? input.args.trim().split(/\s+/)
        : [];

    // Preserve previous secret values if caller sends "***" during update
    const mergedEnv: Record<string, string> = {};
    if (existing?.config.env) {
      Object.assign(mergedEnv, existing.config.env);
    }
    if (typeof input.env === 'object' && input.env !== null) {
      for (const [k, v] of Object.entries(input.env as Record<string, unknown>)) {
        const strVal = String(v ?? '');
        if (strVal !== '***') {
          mergedEnv[k] = strVal;
        }
      }
    }

    const mergedHeaders: Record<string, string> = {};
    if (existing?.config.headers) {
      Object.assign(mergedHeaders, existing.config.headers);
    }
    if (typeof input.headers === 'object' && input.headers !== null) {
      for (const [k, v] of Object.entries(input.headers as Record<string, unknown>)) {
        const strVal = String(v ?? '');
        if (strVal !== '***') {
          mergedHeaders[k] = strVal;
        }
      }
    }

    const url = typeof input.url === 'string' ? input.url.trim() : undefined;
    const cwd = typeof input.cwd === 'string' && input.cwd.trim() ? input.cwd.trim() : undefined;

    if (transport === 'stdio' && !command) {
      throw new Error('MCP stdio server requires a non-empty "command" (e.g. "node" or "npx").');
    }
    if (transport === 'http' && !url) {
      throw new Error('MCP HTTP server requires a non-empty "url".');
    }

    const nowIso = new Date().toISOString();
    const config: PersistedMcpServerConfig = {
      id: rawId,
      name,
      platformId,
      transport,
      ...(command ? { command, args } : {}),
      ...(Object.keys(mergedEnv).length > 0 ? { env: mergedEnv } : {}),
      ...(cwd ? { cwd } : {}),
      ...(url ? { url } : {}),
      ...(Object.keys(mergedHeaders).length > 0 ? { headers: mergedHeaders } : {}),
      createdAt: existing?.config.createdAt || nowIso,
      updatedAt: nowIso,
    };

    const runtime: LiveServerRuntime = {
      config,
      status: 'connecting',
      error: null,
      tools: [],
    };

    this.servers.set(rawId, runtime);
    try {
      await this.connectRuntime(runtime);
    } catch (err) {
      runtime.status = 'error';
      runtime.error = err instanceof Error ? err.message : String(err);
      this.persistRegistry();
      throw err;
    }

    this.persistRegistry();
    return this.toPublicSummary(runtime);
  }

  public async refreshServerTools(serverId: string): Promise<PublicMcpServerSummary> {
    const runtime = this.servers.get(serverId);
    if (!runtime) {
      throw new Error(`External MCP server not found: ${serverId}`);
    }

    if (
      runtime.config.transport === 'stdio' &&
      (!runtime.stdio || runtime.stdio.proc.killed || runtime.stdio.proc.exitCode !== null)
    ) {
      await this.connectRuntime(runtime);
      return this.toPublicSummary(runtime);
    }

    const toolsResp = await this.sendRpc(runtime, 'tools/list', {}, 20_000);
    runtime.tools = this.parseToolsList(toolsResp);
    runtime.status = 'connected';
    runtime.error = null;
    runtime.config.updatedAt = new Date().toISOString();
    this.persistRegistry();
    return this.toPublicSummary(runtime);
  }

  public async removeServer(serverId: string): Promise<{ ok: true; id: string; deleted: boolean }> {
    const runtime = this.servers.get(serverId);
    if (!runtime) {
      return { ok: true, id: serverId, deleted: false };
    }
    await this.teardownRuntimeProcess(runtime);
    this.servers.delete(serverId);
    this.persistRegistry();
    return { ok: true, id: serverId, deleted: true };
  }

  public async stopAll(): Promise<void> {
    const teardowns: Array<Promise<void>> = [];
    for (const runtime of this.servers.values()) {
      teardowns.push(this.teardownRuntimeProcess(runtime));
    }
    await Promise.allSettled(teardowns);
  }

  public async callTool(params: {
    serverId: string;
    toolName: string;
    arguments?: Record<string, unknown>;
    timeoutMs?: number;
  }): Promise<{
    server: PublicMcpServerSummary;
    rawResult: Record<string, unknown>;
    mediaCandidates: ExtractedMcpMediaCandidate[];
    textSummary: string;
  }> {
    const runtime = this.servers.get(params.serverId);
    if (!runtime) {
      throw new Error(`External MCP server "${params.serverId}" is not registered.`);
    }

    // Reconnect stdio automatically if subprocess had exited
    if (
      runtime.config.transport === 'stdio' &&
      (!runtime.stdio || runtime.stdio.proc.killed || runtime.stdio.proc.exitCode !== null)
    ) {
      await this.connectRuntime(runtime);
    } else if (runtime.status !== 'connected') {
      await this.connectRuntime(runtime);
    }

    const rpcResponse = await this.sendRpc(
      runtime,
      'tools/call',
      {
        name: params.toolName,
        arguments: params.arguments || {},
      },
      params.timeoutMs ?? 180_000
    );

    const resultObj = ((rpcResponse.result as Record<string, unknown>) || rpcResponse) as Record<
      string,
      unknown
    >;

    if (resultObj.isError === true) {
      const errText = this.extractTextSummary(resultObj) || `MCP tool "${params.toolName}" returned isError=true`;
      throw new Error(errText);
    }

    const mediaCandidates = this.extractMediaCandidatesFromResult(resultObj);
    const textSummary = this.extractTextSummary(resultObj);

    return {
      server: this.toPublicSummary(runtime),
      rawResult: resultObj,
      mediaCandidates,
      textSummary,
    };
  }

  /**
   * Builds smart tool arguments mapped to the discovered MCP tool's JSON Schema `inputSchema`
   * so arbitrary MCP servers (`prompt` vs `text`, `aspect_ratio` vs `aspectRatio`, `image_url` vs `image`)
   * receive the exact property names their `inputSchema` expects!
   */
  public buildArgumentsForToolSchema(
    tool: ExternalMcpToolSchema,
    nodeInput: {
      prompt: string;
      negativePrompt?: string;
      aspectRatio?: string;
      resolution?: string;
      durationSec?: number;
      voiceId?: string;
      modelId?: string;
      referenceImages?: string[];
    }
  ): Record<string, unknown> {
    const schema = (tool.inputSchema || {}) as Record<string, unknown>;
    const props = ((schema.properties as Record<string, unknown>) || {}) as Record<
      string,
      Record<string, unknown>
    >;
    const propNames = Object.keys(props);

    if (propNames.length === 0) {
      return {
        prompt: nodeInput.prompt,
        ...(nodeInput.negativePrompt ? { negative_prompt: nodeInput.negativePrompt } : {}),
        ...(nodeInput.aspectRatio ? { aspect_ratio: nodeInput.aspectRatio } : {}),
        ...(nodeInput.durationSec ? { duration: nodeInput.durationSec } : {}),
        ...(nodeInput.voiceId ? { voice_id: nodeInput.voiceId } : {}),
        ...(nodeInput.modelId ? { model: nodeInput.modelId } : {}),
        ...(nodeInput.referenceImages?.length
          ? { image_url: nodeInput.referenceImages[0], reference_images: nodeInput.referenceImages }
          : {}),
      };
    }

    const args: Record<string, unknown> = {};
    const setFirstMatching = (candidates: string[], value: unknown) => {
      if (value === undefined || value === null || value === '') return;
      for (const key of candidates) {
        if (key in props) {
          args[key] = value;
          return;
        }
      }
    };

    setFirstMatching(['prompt', 'text', 'description', 'query', 'input'], nodeInput.prompt);
    if (Object.keys(args).length === 0) {
      args.prompt = nodeInput.prompt;
    }

    setFirstMatching(['negative_prompt', 'negativePrompt'], nodeInput.negativePrompt);
    setFirstMatching(['aspect_ratio', 'aspectRatio', 'ratio'], nodeInput.aspectRatio);
    setFirstMatching(['resolution', 'quality', 'size'], nodeInput.resolution);
    setFirstMatching(
      ['duration_seconds', 'durationSeconds', 'duration', 'durationSec', 'seconds'],
      nodeInput.durationSec
    );
    setFirstMatching(['voice_id', 'voiceId', 'voice'], nodeInput.voiceId);
    setFirstMatching(['model_id', 'modelId', 'model', 'model_name'], nodeInput.modelId);

    if (nodeInput.referenceImages && nodeInput.referenceImages.length > 0) {
      setFirstMatching(
        ['image_url', 'imageUrl', 'image', 'start_image', 'first_frame', 'source_image'],
        nodeInput.referenceImages[0]
      );
      setFirstMatching(
        ['reference_images', 'referenceImages', 'images', 'image_urls'],
        nodeInput.referenceImages
      );
    }

    return args;
  }

  private async connectRuntime(runtime: LiveServerRuntime): Promise<void> {
    await this.teardownRuntimeProcess(runtime);
    runtime.status = 'connecting';
    runtime.error = null;

    if (runtime.config.transport === 'stdio') {
      const cmd = runtime.config.command!;
      const args = runtime.config.args || [];
      const childEnv: NodeJS.ProcessEnv = {
        ...process.env,
        ...(runtime.config.env || {}),
      };

      const proc = spawn(cmd, args, {
        cwd: runtime.config.cwd || process.cwd(),
        env: childEnv,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      const session: LiveStdioSession = {
        proc,
        rawBuffer: Buffer.alloc(0),
        pending: new Map(),
        stderrTail: '',
        useContentLengthFraming: false,
      };
      runtime.stdio = session;

      proc.stderr.on('data', (chunk: Buffer) => {
        const text = chunk.toString('utf8');
        session.stderrTail = (session.stderrTail + text).slice(-1200);
        if (!this.quiet && text.trim()) {
          // Keep stderr diagnostic quiet unless needed
        }
      });

      proc.stdout.on('data', (chunk: Buffer) => {
        session.rawBuffer = Buffer.concat([session.rawBuffer, chunk]);
        this.drainStdioFrames(session);
      });

      proc.on('error', (err) => {
        runtime.status = 'error';
        runtime.error = err.message;
        for (const [, p] of session.pending) {
          clearTimeout(p.timer);
          p.reject(err);
        }
        session.pending.clear();
      });

      proc.on('close', (code) => {
        if (runtime.stdio === session) {
          if (runtime.status === 'connected' || runtime.status === 'connecting') {
            runtime.status = 'disconnected';
            if (code !== 0 && code !== null) {
              runtime.error = `MCP process exited with code ${code}${
                session.stderrTail ? `: ${session.stderrTail.trim().slice(-240)}` : ''
              }`;
            }
          }
          for (const [, p] of session.pending) {
            clearTimeout(p.timer);
            p.reject(
              new Error(
                `MCP stdio server exited (code ${String(code)})${
                  session.stderrTail ? `: ${session.stderrTail.trim().slice(-240)}` : ''
                }`
              )
            );
          }
          session.pending.clear();
        }
      });
    }

    const initResp = await this.sendRpc(
      runtime,
      'initialize',
      {
        protocolVersion: '2025-03-26',
        capabilities: {},
        clientInfo: {
          name: 'open-dreamflow-mcp-host',
          version: '1.1.0',
        },
      },
      25_000
    );

    if (initResp.error) {
      const errObj = initResp.error as Record<string, unknown>;
      throw new Error(`MCP initialize failed: ${String(errObj.message || JSON.stringify(errObj))}`);
    }

    await this.sendNotification(runtime, 'notifications/initialized', {});

    const toolsResp = await this.sendRpc(runtime, 'tools/list', {}, 20_000);
    runtime.tools = this.parseToolsList(toolsResp);
    runtime.status = 'connected';
    runtime.error = null;
  }

  private drainStdioFrames(session: LiveStdioSession): void {
    while (session.rawBuffer.length > 0) {
      // 1. Check for LSP/MCP `Content-Length: <N>\r\n\r\n` header framing
      const asciiPrefix = session.rawBuffer
        .subarray(0, Math.min(session.rawBuffer.length, 128))
        .toString('utf8');

      const clMatch = /^Content-Length:\s*(\d+)\r?\n/i.exec(asciiPrefix);
      if (clMatch) {
        session.useContentLengthFraming = true;
        const bodyLen = Number(clMatch[1]);
        const sepCrLf = session.rawBuffer.indexOf('\r\n\r\n');
        const sepLf = session.rawBuffer.indexOf('\n\n');
        let headerEnd = -1;
        if (sepCrLf >= 0 && (sepLf < 0 || sepCrLf <= sepLf)) {
          headerEnd = sepCrLf + 4;
        } else if (sepLf >= 0) {
          headerEnd = sepLf + 2;
        }
        if (headerEnd < 0 || session.rawBuffer.length < headerEnd + bodyLen) {
          return; // Wait for more bytes
        }
        const jsonSlice = session.rawBuffer
          .subarray(headerEnd, headerEnd + bodyLen)
          .toString('utf8');
        session.rawBuffer = session.rawBuffer.subarray(headerEnd + bodyLen);
        this.handleIncomingRpcJson(session, jsonSlice);
        continue;
      }

      // 2. Standard MCP newline-delimited JSON-RPC (`{...}\n`)
      const nlIdx = session.rawBuffer.indexOf(0x0a); // '\n'
      if (nlIdx < 0) {
        return; // Wait for newline
      }
      const line = session.rawBuffer.subarray(0, nlIdx).toString('utf8').trim();
      session.rawBuffer = session.rawBuffer.subarray(nlIdx + 1);
      if (!line) continue;
      this.handleIncomingRpcJson(session, line);
    }
  }

  private handleIncomingRpcJson(session: LiveStdioSession, rawJson: string): void {
    try {
      const msg = JSON.parse(rawJson) as Record<string, unknown>;
      if ('id' in msg && msg.id !== undefined && msg.id !== null) {
        const key = msg.id as string | number;
        const pending = session.pending.get(key) || session.pending.get(String(key));
        if (pending) {
          session.pending.delete(key);
          session.pending.delete(String(key));
          clearTimeout(pending.timer);
          if (msg.error) {
            const errObj = msg.error as Record<string, unknown>;
            pending.reject(
              new Error(`MCP RPC error: ${String(errObj.message || JSON.stringify(errObj))}`)
            );
          } else {
            pending.resolve(msg);
          }
        }
      }
    } catch {
      // Ignore non-JSON banner lines emitted on stdout by noisy CLIs
    }
  }

  private writeStdioPayload(session: LiveStdioSession, payloadObj: Record<string, unknown>): void {
    const json = JSON.stringify(payloadObj);
    if (session.useContentLengthFraming) {
      const byteLen = Buffer.byteLength(json, 'utf8');
      session.proc.stdin.write(`Content-Length: ${byteLen}\r\n\r\n${json}`);
    } else {
      session.proc.stdin.write(`${json}\n`);
    }
  }

  private async sendNotification(
    runtime: LiveServerRuntime,
    method: string,
    params: Record<string, unknown>
  ): Promise<void> {
    const msg: Record<string, unknown> = {
      jsonrpc: '2.0',
      method,
      params,
    };

    if (runtime.config.transport === 'stdio') {
      if (runtime.stdio && runtime.stdio.proc.stdin.writable) {
        this.writeStdioPayload(runtime.stdio, msg);
      }
      return;
    }

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        ...(runtime.config.headers || {}),
      };
      if (runtime.httpSessionId) {
        headers['Mcp-Session-Id'] = runtime.httpSessionId;
      }
      await fetch(runtime.config.url!, {
        method: 'POST',
        headers,
        body: JSON.stringify(msg),
        signal: AbortSignal.timeout(8_000),
      });
    } catch {
      // Notifications are fire-and-forget
    }
  }

  private async sendRpc(
    runtime: LiveServerRuntime,
    method: string,
    params: Record<string, unknown>,
    timeoutMs = 30_000
  ): Promise<Record<string, unknown>> {
    const rpcId = this.nextRpcId++;
    const payload: Record<string, unknown> = {
      jsonrpc: '2.0',
      id: rpcId,
      method,
      params,
    };

    if (runtime.config.transport === 'stdio') {
      const session = runtime.stdio;
      if (!session || !session.proc.stdin.writable) {
        throw new Error(`MCP stdio process for "${runtime.config.name}" is not writable.`);
      }

      return new Promise<Record<string, unknown>>((resolve, reject) => {
        const timer = setTimeout(() => {
          session.pending.delete(rpcId);
          reject(
            new Error(
              `MCP stdio server "${runtime.config.name}" timed out on ${method} after ${timeoutMs}ms${
                session.stderrTail ? ` (${session.stderrTail.trim().slice(-200)})` : ''
              }`
            )
          );
        }, timeoutMs);

        session.pending.set(rpcId, { resolve, reject, timer });
        this.writeStdioPayload(session, payload);
      });
    }

    // Streamable HTTP JSON-RPC
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      ...(runtime.config.headers || {}),
    };
    if (runtime.httpSessionId) {
      headers['Mcp-Session-Id'] = runtime.httpSessionId;
    }

    const res = await fetch(runtime.config.url!, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(timeoutMs),
    });

    const returnedSession = res.headers.get('mcp-session-id');
    if (returnedSession) {
      runtime.httpSessionId = returnedSession;
    }

    const rawText = await res.text();
    if (!res.ok) {
      throw new Error(
        `MCP HTTP server "${runtime.config.name}" returned HTTP ${res.status}: ${rawText.slice(0, 260)}`
      );
    }

    const contentType = (res.headers.get('content-type') || '').toLowerCase();
    if (contentType.includes('text/event-stream') || rawText.startsWith('event:') || rawText.startsWith('data:')) {
      const dataLines = rawText
        .split(/\r?\n/)
        .filter((l) => l.startsWith('data:'))
        .map((l) => l.slice(5).trim())
        .filter(Boolean);
      for (const dl of dataLines.reverse()) {
        try {
          const parsed = JSON.parse(dl) as Record<string, unknown>;
          if (parsed.result || parsed.error) {
            if (parsed.error) {
              const errObj = parsed.error as Record<string, unknown>;
              throw new Error(String(errObj.message || JSON.stringify(errObj)));
            }
            return parsed;
          }
        } catch (err) {
          if (err instanceof Error && !err.message.includes('JSON')) throw err;
        }
      }
    }

    const parsed = JSON.parse(rawText) as Record<string, unknown>;
    if (parsed.error) {
      const errObj = parsed.error as Record<string, unknown>;
      throw new Error(`MCP HTTP RPC error: ${String(errObj.message || JSON.stringify(errObj))}`);
    }
    return parsed;
  }

  private parseToolsList(rpcResp: Record<string, unknown>): ExternalMcpToolSchema[] {
    const resObj = (rpcResp.result || rpcResp) as Record<string, unknown>;
    const rawTools = Array.isArray(resObj.tools)
      ? (resObj.tools as Array<Record<string, unknown>>)
      : [];
    return rawTools
      .filter((t) => typeof t?.name === 'string' && t.name.trim())
      .map((t) => ({
        name: String(t.name).trim(),
        description: typeof t.description === 'string' ? t.description : undefined,
        inputSchema:
          typeof t.inputSchema === 'object' && t.inputSchema !== null
            ? (t.inputSchema as Record<string, unknown>)
            : { type: 'object', properties: {} },
      }));
  }

  private async teardownRuntimeProcess(runtime: LiveServerRuntime): Promise<void> {
    const session = runtime.stdio;
    runtime.stdio = undefined;
    if (!session) return;

    for (const [, p] of session.pending) {
      clearTimeout(p.timer);
      p.reject(new Error('MCP server session closed.'));
    }
    session.pending.clear();

    const proc = session.proc;
    if (proc.exitCode !== null || proc.killed) return;

    await new Promise<void>((resolve) => {
      const killTimer = setTimeout(() => {
        try {
          proc.kill('SIGKILL');
        } catch {
          // Ignore
        }
        resolve();
      }, 1_500);

      proc.once('close', () => {
        clearTimeout(killTimer);
        resolve();
      });

      try {
        proc.stdin.end();
        proc.kill('SIGTERM');
      } catch {
        clearTimeout(killTimer);
        resolve();
      }
    });
  }

  private extractTextSummary(resultObj: Record<string, unknown>): string {
    const content = Array.isArray(resultObj.content)
      ? (resultObj.content as Array<Record<string, unknown>>)
      : [];
    const parts: string[] = [];
    for (const block of content) {
      if (block?.type === 'text' && typeof block.text === 'string') {
        parts.push(block.text);
      }
    }
    return parts.join('\n').trim();
  }

  /**
   * Extracts media outputs from any MCP `tools/call` response shape:
   *  1. `{ type: 'image' | 'audio' | 'video', data: '<base64>', mimeType: '...' }`
   *  2. `{ type: 'resource', resource: { blob: '<base64>', mimeType, uri } }`
   *  3. `structuredContent` or JSON inside `content[].text` (`imageUrl`, `videoUrl`, `audioUrl`, `mediaUrl`, `url`, `dataUrl`, `b64_json`, `dataBase64`, `file_path`, `output_path`)
   *  4. Inline `data:image/...;base64,...`, `https://...` media URLs, or local generated file paths (e.g. `@elevenlabs/elevenlabs-mcp` MP3 output path)
   */
  private extractMediaCandidatesFromResult(
    resultObj: Record<string, unknown>
  ): ExtractedMcpMediaCandidate[] {
    const candidates: ExtractedMcpMediaCandidate[] = [];

    const inspectObject = (obj: Record<string, unknown>) => {
      const urlKeys: Array<{ key: string; hint?: 'image' | 'video' | 'audio' }> = [
        { key: 'videoUrl', hint: 'video' },
        { key: 'video_url', hint: 'video' },
        { key: 'audioUrl', hint: 'audio' },
        { key: 'audio_url', hint: 'audio' },
        { key: 'imageUrl', hint: 'image' },
        { key: 'image_url', hint: 'image' },
        { key: 'mediaUrl' },
        { key: 'media_url' },
        { key: 'dataUrl' },
        { key: 'url' },
      ];
      for (const { key, hint } of urlKeys) {
        const val = obj[key];
        if (typeof val === 'string' && val.trim()) {
          candidates.push({ source: val.trim(), kindHint: hint });
        }
      }

      const b64Keys: Array<{ key: string; mime: string; hint: 'image' | 'video' | 'audio' }> = [
        { key: 'b64_json', mime: 'image/png', hint: 'image' },
        { key: 'imageBase64', mime: 'image/png', hint: 'image' },
        { key: 'image_base64', mime: 'image/png', hint: 'image' },
        { key: 'audioBase64', mime: 'audio/mpeg', hint: 'audio' },
        { key: 'audio_base64', mime: 'audio/mpeg', hint: 'audio' },
        { key: 'videoBase64', mime: 'video/mp4', hint: 'video' },
        { key: 'dataBase64', mime: String(obj.mimeType || 'image/png'), hint: 'image' },
      ];
      for (const { key, mime, hint } of b64Keys) {
        const val = obj[key];
        if (typeof val === 'string' && val.trim().length > 32) {
          const clean = val.trim();
          candidates.push({
            source: clean.startsWith('data:') ? clean : `data:${mime};base64,${clean}`,
            mimeType: mime,
            kindHint: hint,
          });
        }
      }

      const pathKeys = ['file_path', 'filePath', 'output_path', 'outputPath', 'saved_path', 'path'];
      for (const pk of pathKeys) {
        const pVal = obj[pk];
        if (typeof pVal === 'string' && pVal.trim() && path.isAbsolute(pVal.trim()) && fs.existsSync(pVal.trim())) {
          candidates.push({ source: `absfile:${pVal.trim()}` });
        }
      }

      if (Array.isArray(obj.images)) {
        for (const item of obj.images as Array<unknown>) {
          if (typeof item === 'string' && item.trim()) {
            candidates.push({ source: item.trim(), kindHint: 'image' });
          } else if (typeof item === 'object' && item !== null) {
            inspectObject(item as Record<string, unknown>);
          }
        }
      }
      if (Array.isArray(obj.videos)) {
        for (const item of obj.videos as Array<unknown>) {
          if (typeof item === 'string' && item.trim()) {
            candidates.push({ source: item.trim(), kindHint: 'video' });
          } else if (typeof item === 'object' && item !== null) {
            inspectObject(item as Record<string, unknown>);
          }
        }
      }
      if (typeof obj.data === 'object' && obj.data !== null && !Array.isArray(obj.data)) {
        inspectObject(obj.data as Record<string, unknown>);
      }
      if (Array.isArray(obj.data)) {
        for (const item of obj.data as Array<unknown>) {
          if (typeof item === 'object' && item !== null) {
            inspectObject(item as Record<string, unknown>);
          }
        }
      }
    };

    if (typeof resultObj.structuredContent === 'object' && resultObj.structuredContent !== null) {
      inspectObject(resultObj.structuredContent as Record<string, unknown>);
    }

    const contentArr = Array.isArray(resultObj.content)
      ? (resultObj.content as Array<Record<string, unknown>>)
      : [];

    for (const block of contentArr) {
      if (!block || typeof block !== 'object') continue;
      const bType = String(block.type || '').toLowerCase();

      if (
        (bType === 'image' || bType === 'audio' || bType === 'video') &&
        typeof block.data === 'string' &&
        block.data.trim()
      ) {
        const defaultMime =
          bType === 'audio' ? 'audio/mpeg' : bType === 'video' ? 'video/mp4' : 'image/png';
        const mime = String(block.mimeType || block.mime_type || defaultMime).trim();
        const rawData = block.data.trim();
        candidates.push({
          kindHint: bType as 'image' | 'audio' | 'video',
          mimeType: mime,
          source: rawData.startsWith('data:') ? rawData : `data:${mime};base64,${rawData}`,
        });
        continue;
      }

      if (bType === 'resource' && typeof block.resource === 'object' && block.resource !== null) {
        const res = block.resource as Record<string, unknown>;
        const mime = String(res.mimeType || 'application/octet-stream');
        if (typeof res.blob === 'string' && res.blob.trim()) {
          candidates.push({
            mimeType: mime,
            source: `data:${mime};base64,${res.blob.trim()}`,
          });
        } else if (typeof res.uri === 'string' && res.uri.trim()) {
          if (res.uri.startsWith('file://')) {
            const fp = res.uri.replace(/^file:\/\//, '');
            if (fs.existsSync(fp)) candidates.push({ source: `absfile:${fp}` });
          } else {
            candidates.push({ source: res.uri.trim(), mimeType: mime });
          }
        }
        continue;
      }

      if (bType === 'text' && typeof block.text === 'string') {
        const text = block.text.trim();
        if (!text) continue;

        // Try JSON parse first
        if (text.startsWith('{') || text.startsWith('[')) {
          try {
            const parsed = JSON.parse(text);
            if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
              inspectObject(parsed as Record<string, unknown>);
            }
          } catch {
            // Fall through to regex extraction
          }
        }

        // Check embedded data: URI
        const dataUriMatch = /data:(image|video|audio)\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=\s]+/.exec(
          text
        );
        if (dataUriMatch) {
          candidates.push({
            source: dataUriMatch[0].replace(/\s+/g, ''),
            kindHint: dataUriMatch[1] as 'image' | 'video' | 'audio',
          });
        }

        // Check https:// URL pointing to media or CDN
        const urlMatches = text.match(/https?:\/\/[^\s"'<>]+/g) || [];
        for (const u of urlMatches) {
          const cleanUrl = u.replace(/[.,;)\]]+$/, '');
          candidates.push({ source: cleanUrl });
        }

        // Check local absolute media path (e.g. `/tmp/output.mp3` or `/Users/.../audio.mp3` from `@elevenlabs/elevenlabs-mcp`)
        const absFileMatches =
          text.match(/(?:\/[A-Za-z0-9._-]+)+\.(?:png|jpg|jpeg|webp|gif|mp4|webm|mov|mp3|wav|m4a)/gi) ||
          [];
        for (const fp of absFileMatches) {
          if (!fp.startsWith('/media/') && fs.existsSync(fp)) {
            candidates.push({ source: `absfile:${fp}` });
          }
        }
      }
    }

    return candidates;
  }
}
