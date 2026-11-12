import type {
  AspectRatio,
  BYOKCredentials,
  MCPToolDefinition,
  ProviderId,
  ResolutionTier,
} from '../types/studio';

export interface GenerationRequest {
  provider: ProviderId;
  prompt: string;
  aspectRatio: AspectRatio;
  durationSec?: number;
  resolution?: ResolutionTier;
  mode: 'image' | 'video' | 'inpaint' | 'outpaint' | '9-grid' | 'multiframe';
  referenceImages?: string[];
  firstFrameDataUrl?: string;
  lastFrameDataUrl?: string;
  previousInteractionId?: string;
  mcpTool?: MCPToolDefinition;
  byok: BYOKCredentials;
}

export interface GenerationResult {
  providerLabel: string;
  interactionId: string;
  imageUrl?: string;
  videoUrl?: string;
  usedLiveEndpoint: boolean;
  costEstimateUsd: number;
}

function stripDataUrlPrefix(dataUrl: string): { mimeType: string; base64: string } {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    return { mimeType: 'image/png', base64: dataUrl };
  }
  return { mimeType: match[1], base64: match[2] };
}

export function estimateZeroMarkupCostUsd(
  provider: ProviderId,
  mode: GenerationRequest['mode'],
  durationSec = 5,
  resolution: ResolutionTier = '1080p'
): number {
  if (
    provider === 'local-canvas' ||
    provider === 'comfyui' ||
    provider === 'chrome-bridge-flow' ||
    provider === 'chrome-bridge-dreamina'
  ) {
    return 0;
  }
  if (mode === 'image' || mode === 'inpaint' || mode === 'outpaint' || mode === '9-grid') {
    return resolution === '4K' ? 0.04 : 0.02;
  }
  const perSec =
    provider === 'gemini-omni'
      ? resolution === '360p'
        ? 0.015
        : 0.045
      : provider === 'seedance'
      ? 0.038
      : 0.05;
  return Number((perSec * durationSec).toFixed(3));
}

export async function executeStudioGeneration(
  req: GenerationRequest
): Promise<GenerationResult> {
  const interactionId = `int_omni_${Math.random().toString(36).slice(2, 10)}`;
  const costEstimateUsd = estimateZeroMarkupCostUsd(
    req.provider,
    req.mode,
    req.durationSec || 8,
    req.resolution || '1080p'
  );

  if (req.provider === 'gemini-omni' && req.byok.geminiApiKey.trim()) {
    try {
      const parts: Array<Record<string, unknown>> = [{ text: req.prompt }];
      (req.referenceImages || []).slice(0, 6).forEach((img) => {
        const { mimeType, base64 } = stripDataUrlPrefix(img);
        parts.push({ inline_data: { mime_type: mimeType, data: base64 } });
      });
      if (req.firstFrameDataUrl) {
        const { mimeType, base64 } = stripDataUrlPrefix(req.firstFrameDataUrl);
        parts.push({ role_hint: 'first_frame', inline_data: { mime_type: mimeType, data: base64 } });
      }
      if (req.lastFrameDataUrl) {
        const { mimeType, base64 } = stripDataUrlPrefix(req.lastFrameDataUrl);
        parts.push({ role_hint: 'last_frame', inline_data: { mime_type: mimeType, data: base64 } });
      }

      const body: Record<string, unknown> = {
        model: req.byok.geminiModel || 'gemini-omni-1.2-flash',
        input: [{ role: 'user', parts }],
        generation_config: {
          response_modalities: req.mode === 'video' || req.mode === 'multiframe' ? ['VIDEO', 'AUDIO'] : ['IMAGE'],
          aspect_ratio: req.aspectRatio,
          duration_seconds: req.durationSec || 8,
          resolution: req.resolution || '1080p',
        },
      };
      if (req.previousInteractionId) {
        body.previous_interaction_id = req.previousInteractionId;
      }

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/interactions?key=${encodeURIComponent(
          req.byok.geminiApiKey.trim()
        )}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }
      );

      if (res.ok) {
        const json = (await res.json()) as {
          id?: string;
          interaction_id?: string;
          video_uri?: string;
          image_uri?: string;
        };
        return {
          providerLabel: 'Google AI Studio · Gemini Omni 1.2 Flash ($0 Markup)',
          interactionId: json.interaction_id || json.id || interactionId,
          imageUrl: json.image_uri,
          videoUrl: json.video_uri,
          usedLiveEndpoint: true,
          costEstimateUsd,
        };
      }
    } catch {
      // Graceful local synthesis fallback
    }
    return {
      providerLabel: 'Gemini Omni 1.2 Flash (BYOK Preview)',
      interactionId,
      usedLiveEndpoint: false,
      costEstimateUsd,
    };
  }

  if (req.provider === 'seedance' && req.byok.seedanceApiKey.trim()) {
    try {
      const endpoint =
        req.byok.seedanceEndpoint.trim() ||
        'https://ark.ap-southeast.bytepluses.com/api/v3/contents/generations/tasks';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${req.byok.seedanceApiKey.trim()}`,
        },
        body: JSON.stringify({
          model: req.mode === 'video' || req.mode === 'multiframe' ? 'seedance-1-0-pro' : 'seedream-3-0',
          content: [{ type: 'text', text: req.prompt }],
          parameters: {
            aspect_ratio: req.aspectRatio,
            duration: req.durationSec || 5,
            resolution: req.resolution || '1080p',
          },
        }),
      });
      if (res.ok) {
        const json = (await res.json()) as { id?: string; video_url?: string; image_url?: string };
        return {
          providerLabel: 'BytePlus · Seedream / Seedance ($0 Markup)',
          interactionId: json.id || interactionId,
          imageUrl: json.image_url,
          videoUrl: json.video_url,
          usedLiveEndpoint: true,
          costEstimateUsd,
        };
      }
    } catch {
      // Fallback to local preview
    }
    return {
      providerLabel: 'BytePlus Seedance 1.0 (BYOK Preview)',
      interactionId,
      usedLiveEndpoint: false,
      costEstimateUsd,
    };
  }

  if (req.provider === 'mcp-router' && req.mcpTool) {
    try {
      const result = await callMcpServerTool(req.mcpTool.serverUrl, req.mcpTool.name, {
        prompt: req.prompt,
        aspect_ratio: req.aspectRatio,
        duration_seconds: req.durationSec || 8,
        previous_interaction_id: req.previousInteractionId,
      });
      return {
        providerLabel: `MCP · ${req.mcpTool.serverName} (${req.mcpTool.name})`,
        interactionId: result.interactionId || interactionId,
        imageUrl: result.imageUrl,
        videoUrl: result.videoUrl,
        usedLiveEndpoint: result.connected,
        costEstimateUsd: 0,
      };
    } catch {
      return {
        providerLabel: `MCP · ${req.mcpTool.name} (Local Synthesis)`,
        interactionId,
        usedLiveEndpoint: false,
        costEstimateUsd: 0,
      };
    }
  }

  if (req.provider === 'chrome-bridge-flow' || req.provider === 'chrome-bridge-dreamina') {
    const target = req.provider === 'chrome-bridge-flow' ? 'google-flow' : 'dreamina';
    dispatchBridgeJob({
      jobId: interactionId,
      target,
      prompt: req.prompt,
      aspectRatio: req.aspectRatio,
      durationSec: req.durationSec || 8,
      referenceImages: req.referenceImages || [],
      previousInteractionId: req.previousInteractionId,
    });
    return {
      providerLabel:
        target === 'google-flow'
          ? 'Chrome Bridge · flow.google.com ($0 Credits)'
          : 'Chrome Bridge · dreamina.capcut.com ($0 Credits)',
      interactionId,
      usedLiveEndpoint: true,
      costEstimateUsd: 0,
    };
  }

  return {
    providerLabel: 'Open-DreamFlow Local Engine ($0 Instant)',
    interactionId,
    usedLiveEndpoint: false,
    costEstimateUsd: 0,
  };
}

export async function discoverMcpTools(
  serverUrl: string,
  serverName: string
): Promise<{ connected: boolean; pingMs: number; tools: MCPToolDefinition[] }> {
  const start = performance.now();
  const rpcPayload = {
    jsonrpc: '2.0',
    id: Date.now(),
    method: 'tools/list',
    params: {},
  };

  try {
    if (serverUrl.startsWith('ws://') || serverUrl.startsWith('wss://')) {
      const tools = await new Promise<MCPToolDefinition[]>((resolve, reject) => {
        const ws = new WebSocket(serverUrl);
        const timer = setTimeout(() => {
          ws.close();
          reject(new Error('MCP WebSocket timeout'));
        }, 1800);

        ws.onopen = () => {
          ws.send(JSON.stringify(rpcPayload));
        };
        ws.onmessage = (ev) => {
          clearTimeout(timer);
          try {
            const parsed = JSON.parse(String(ev.data));
            const rawTools = parsed?.result?.tools || [];
            ws.close();
            resolve(
              rawTools.map((t: { name: string; description?: string; inputSchema?: Record<string, unknown> }) => ({
                name: t.name,
                description: t.description || 'Discovered MCP Canvas Tool',
                serverUrl,
                serverName,
                inputSchema: t.inputSchema,
              }))
            );
          } catch (e) {
            ws.close();
            reject(e);
          }
        };
        ws.onerror = () => {
          clearTimeout(timer);
          reject(new Error('MCP WebSocket connection failed'));
        };
      });

      return {
        connected: true,
        pingMs: Math.round(performance.now() - start),
        tools,
      };
    } else {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 1800);
      const res = await fetch(serverUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rpcPayload),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const parsed = await res.json();
      const rawTools = parsed?.result?.tools || [];
      return {
        connected: true,
        pingMs: Math.round(performance.now() - start),
        tools: rawTools.map(
          (t: { name: string; description?: string; inputSchema?: Record<string, unknown> }) => ({
            name: t.name,
            description: t.description || 'Discovered MCP Canvas Tool',
            serverUrl,
            serverName,
            inputSchema: t.inputSchema,
          })
        ),
      };
    }
  } catch {
    return {
      connected: false,
      pingMs: Math.round(performance.now() - start),
      tools: getDefaultDiscoveredMcpTools(serverUrl, serverName),
    };
  }
}

export function getDefaultDiscoveredMcpTools(
  serverUrl: string,
  serverName: string
): MCPToolDefinition[] {
  return [
    {
      name: 'generate_video',
      description:
        'Gemini Omni 1.2 Flash / ComfyUI 15s video synthesis with First/Last frame lock & previous_interaction_id',
      serverUrl,
      serverName,
      inputSchema: { type: 'object', properties: { prompt: { type: 'string' }, duration_seconds: { type: 'number' } } },
    },
    {
      name: 'inpaint_frame',
      description: 'Dreamina Smart Brush regional redraw & alpha layer decomposition via MCP',
      serverUrl,
      serverName,
      inputSchema: { type: 'object', properties: { prompt: { type: 'string' }, mask_b64: { type: 'string' } } },
    },
    {
      name: 'extract_style_dna',
      description: 'Extracts 5-swatch color LUT, lens focal profile, and film stock DNA from reference frame',
      serverUrl,
      serverName,
      inputSchema: { type: 'object', properties: { image_url: { type: 'string' } } },
    },
    {
      name: 'flow_scene_builder',
      description: 'Multi-shot Scene Builder chaining 2–10 keyframes with camera curve continuity',
      serverUrl,
      serverName,
      inputSchema: { type: 'object', properties: { brief: { type: 'string' }, shot_count: { type: 'number' } } },
    },
  ];
}

async function callMcpServerTool(
  serverUrl: string,
  toolName: string,
  args: Record<string, unknown>
): Promise<{ connected: boolean; interactionId?: string; imageUrl?: string; videoUrl?: string }> {
  const rpc = {
    jsonrpc: '2.0',
    id: Date.now(),
    method: 'tools/call',
    params: { name: toolName, arguments: args },
  };
  if (serverUrl.startsWith('http://') || serverUrl.startsWith('https://')) {
    const res = await fetch(serverUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rpc),
    });
    if (res.ok) {
      const json = await res.json();
      return {
        connected: true,
        interactionId: json?.result?.interactionId,
        imageUrl: json?.result?.imageUrl,
        videoUrl: json?.result?.videoUrl,
      };
    }
  }
  return { connected: false };
}

export function pingChromeBridge(): void {
  window.postMessage(
    { source: 'open-dreamflow-studio', type: 'DREAMFLOW_PING', payload: { ts: Date.now() } },
    '*'
  );
}

export function dispatchBridgeJob(payload: {
  jobId: string;
  target: 'google-flow' | 'dreamina';
  prompt: string;
  aspectRatio: AspectRatio;
  durationSec: number;
  referenceImages: string[];
  previousInteractionId?: string;
}): void {
  window.postMessage(
    { source: 'open-dreamflow-studio', type: 'DREAMFLOW_ENQUEUE_JOB', payload },
    '*'
  );
}
