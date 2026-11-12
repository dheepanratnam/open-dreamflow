import type {
  AspectRatio,
  BridgeIncomingEvent,
  BYOKCredentials,
  DiskProjectMeta,
  DiskProjectRecord,
  MCPToolDefinition,
  McpBackendHealth,
  ProviderId,
  ResolutionTier,
} from '../types/studio';

export const LOCAL_MCP_BASE = 'http://localhost:3001';
export const LOCAL_MCP_HTTP_URL = `${LOCAL_MCP_BASE}/mcp`;
export const LOCAL_MCP_WS_URL = 'ws://localhost:3001/mcp';
export const LOCAL_BRIDGE_WS_URL = 'ws://localhost:3001/bridge';

export function getActiveApiKeyForProvider(
  provider: ProviderId,
  byok: BYOKCredentials
): string | undefined {
  switch (provider) {
    case 'gemini-omni':
      return byok.geminiApiKey || undefined;
    case 'seedance':
      return byok.seedanceApiKey || undefined;
    case 'fal':
      return byok.falApiKey || undefined;
    case 'replicate':
      return byok.replicateApiKey || undefined;
    case 'openai':
      return byok.openaiApiKey || undefined;
    default:
      return undefined;
  }
}

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
  cameraMotion?: string;
  mood?: string;
  outputName?: string;
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

export function normalizeBackendMediaUrl(
  rawUrl?: string,
  preferBackendOrigin = false
): string | undefined {
  if (!rawUrl || typeof rawUrl !== 'string') return undefined;
  if (
    rawUrl.startsWith('http://') ||
    rawUrl.startsWith('https://') ||
    rawUrl.startsWith('data:') ||
    rawUrl.startsWith('blob:')
  ) {
    return rawUrl;
  }
  const clean = rawUrl.startsWith('/') ? rawUrl : `/media/${rawUrl}`;
  return preferBackendOrigin && clean.startsWith('/media/')
    ? `${LOCAL_MCP_BASE}${clean}`
    : clean;
}

export function toBackendRelativeMediaPath(urlOrPath?: string): string | undefined {
  if (!urlOrPath) return undefined;
  if (urlOrPath.startsWith(`${LOCAL_MCP_BASE}/`)) {
    return urlOrPath.slice(LOCAL_MCP_BASE.length);
  }
  if (urlOrPath.startsWith('http://127.0.0.1:3001/')) {
    return urlOrPath.slice('http://127.0.0.1:3001'.length);
  }
  return urlOrPath;
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
    provider === 'mcp-router' ||
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

export async function probeLiveMcpBackend(): Promise<McpBackendHealth> {
  const start = performance.now();
  const serverName = 'Local Open-DreamFlow MCP + FFmpeg Engine';

  try {
    const healthCtrl = new AbortController();
    const healthTimer = setTimeout(() => healthCtrl.abort(), 2200);

    const [healthRes, mcpDiscovery] = await Promise.allSettled([
      fetch(`${LOCAL_MCP_BASE}/api/health`, { signal: healthCtrl.signal }).then(async (r) => {
        clearTimeout(healthTimer);
        if (!r.ok) return null;
        return (await r.json()) as {
          ok?: boolean;
          ffmpeg?: boolean;
          ffmpegAvailable?: boolean;
          mcpTools?: Array<string | { name: string; description?: string }>;
          mediaFiles?: string[];
          savedProjectsCount?: number;
          bridgeClients?: number;
        };
      }),
      discoverMcpTools(LOCAL_MCP_HTTP_URL, serverName),
    ]);

    clearTimeout(healthTimer);

    const healthData =
      healthRes.status === 'fulfilled' && healthRes.value ? healthRes.value : null;
    const disc =
      mcpDiscovery.status === 'fulfilled'
        ? mcpDiscovery.value
        : {
            connected: false,
            pingMs: Math.round(performance.now() - start),
            tools: getDefaultDiscoveredMcpTools(LOCAL_MCP_HTTP_URL, serverName),
          };

    const online = Boolean(healthData?.ok || disc.connected);
    const ffmpegAvailable = Boolean(healthData?.ffmpeg ?? healthData?.ffmpegAvailable ?? online);
    const tools =
      disc.tools.length > 0
        ? disc.tools
        : getDefaultDiscoveredMcpTools(LOCAL_MCP_HTTP_URL, serverName);
    const toolCount = Math.max(
      tools.length,
      Array.isArray(healthData?.mcpTools) ? healthData!.mcpTools!.length : 0
    );

    return {
      online,
      ffmpegAvailable,
      toolCount: online ? Math.max(toolCount, 10) : tools.length,
      tools,
      mediaFiles: Array.isArray(healthData?.mediaFiles) ? healthData!.mediaFiles! : [],
      baseUrl: LOCAL_MCP_BASE,
      pingMs: Math.round(performance.now() - start),
      savedProjectsCount: healthData?.savedProjectsCount,
      bridgeClients: healthData?.bridgeClients,
    };
  } catch {
    const fallbackTools = getDefaultDiscoveredMcpTools(LOCAL_MCP_HTTP_URL, serverName);
    return {
      online: false,
      ffmpegAvailable: false,
      toolCount: fallbackTools.length,
      tools: fallbackTools,
      mediaFiles: [],
      baseUrl: LOCAL_MCP_BASE,
    };
  }
}

export async function renderVideoViaBackend(params: {
  prompt: string;
  imageUrl?: string;
  endImage?: string;
  durationSec?: number;
  aspectRatio?: AspectRatio;
  resolution?: ResolutionTier;
  cameraMotion?: string;
  mood?: string;
  previousInteractionId?: string;
  provider?: ProviderId;
  apiKey?: string;
  outputName?: string;
}): Promise<{
  ok: boolean;
  videoUrl?: string;
  rawVideoPath?: string;
  interactionId?: string;
  engine?: string;
  durationSec?: number;
}> {
  try {
    const cleanInput = toBackendRelativeMediaPath(params.imageUrl);
    const cleanEnd = toBackendRelativeMediaPath(params.endImage);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 28000);

    const res = await fetch(`${LOCAL_MCP_BASE}/api/render-video`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: ctrl.signal,
      body: JSON.stringify({
        prompt: params.prompt,
        image: cleanInput,
        imageUrl: cleanInput,
        inputImage: cleanInput,
        startImage: cleanInput,
        endImage: cleanEnd,
        lastFrameUrl: cleanEnd,
        durationSec: params.durationSec || 7,
        duration_seconds: params.durationSec || 7,
        duration: params.durationSec || 7,
        aspectRatio: params.aspectRatio || '16:9',
        resolution: params.resolution || '720p',
        cameraMotion: params.cameraMotion,
        cameraCurve: params.cameraMotion,
        mood: params.mood,
        grade: params.mood,
        previousInteractionId: params.previousInteractionId,
        provider: params.provider,
        apiKey: params.apiKey,
        outputName: params.outputName,
      }),
    });
    clearTimeout(timer);

    if (!res.ok) return { ok: false };
    const json = (await res.json()) as {
      ok?: boolean;
      videoUrl?: string;
      fullUrl?: string;
      url?: string;
      interactionId?: string;
      engine?: string;
      durationSec?: number;
    };

    const resolvedUrl =
      json.fullUrl || normalizeBackendMediaUrl(json.videoUrl || json.url, true);
    if (!resolvedUrl) return { ok: false };

    return {
      ok: true,
      videoUrl: resolvedUrl,
      rawVideoPath: json.videoUrl || json.url,
      interactionId: json.interactionId,
      engine: json.engine || 'ffmpeg-local',
      durationSec: json.durationSec || params.durationSec,
    };
  } catch {
    return { ok: false };
  }
}

export async function sliceGridViaBackend(
  imageUrl: string,
  rows = 3,
  cols = 3
): Promise<{ ok: boolean; sliceUrls: string[] }> {
  try {
    const cleanSource = toBackendRelativeMediaPath(imageUrl);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 18000);

    const res = await fetch(`${LOCAL_MCP_BASE}/api/slice-grid`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: ctrl.signal,
      body: JSON.stringify({
        image: cleanSource,
        imageUrl: cleanSource,
        inputImage: cleanSource,
        sourceImage: cleanSource,
        rows,
        cols,
        grid: `${rows}x${cols}`,
      }),
    });
    clearTimeout(timer);

    if (!res.ok) return { ok: false, sliceUrls: [] };
    const json = (await res.json()) as Record<string, unknown>;
    const rawArr =
      (json.fullUrls as unknown[]) ||
      (json.slices as unknown[]) ||
      (json.sliceUrls as unknown[]) ||
      (json.urls as unknown[]) ||
      (json.images as unknown[]) ||
      (json.files as unknown[]) ||
      [];

    const normalized = rawArr
      .map((item) => {
        if (typeof item === 'string') {
          return normalizeBackendMediaUrl(item, true);
        }
        if (item && typeof item === 'object') {
          const obj = item as Record<string, unknown>;
          const u =
            (obj.fullUrl as string) ||
            (obj.url as string) ||
            (obj.imageUrl as string) ||
            (obj.sliceUrl as string);
          return normalizeBackendMediaUrl(u, true);
        }
        return undefined;
      })
      .filter((u): u is string => Boolean(u));

    return { ok: normalized.length > 0, sliceUrls: normalized };
  } catch {
    return { ok: false, sliceUrls: [] };
  }
}

export async function extractLastFrameViaBackend(
  videoUrl?: string
): Promise<{ ok: boolean; frameUrl?: string }> {
  if (!videoUrl) return { ok: false };
  try {
    const cleanVid = toBackendRelativeMediaPath(videoUrl);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 14000);

    const res = await fetch(`${LOCAL_MCP_BASE}/api/extract-last-frame`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: ctrl.signal,
      body: JSON.stringify({
        videoUrl: cleanVid,
        videoPath: cleanVid,
        inputVideo: cleanVid,
      }),
    });
    clearTimeout(timer);

    if (!res.ok) return { ok: false };
    const json = (await res.json()) as {
      frameUrl?: string;
      fullUrl?: string;
      imageUrl?: string;
      url?: string;
    };
    const resolved =
      json.fullUrl ||
      normalizeBackendMediaUrl(json.frameUrl || json.imageUrl || json.url, true);
    return { ok: Boolean(resolved), frameUrl: resolved };
  } catch {
    return { ok: false };
  }
}

export async function compileTimelineViaBackend(params: {
  clips: string[];
  title: string;
  outputName?: string;
}): Promise<{ ok: boolean; masterUrl?: string; bytes?: number }> {
  if (params.clips.length === 0) return { ok: false };
  try {
    const cleanClips = params.clips
      .map((c) => toBackendRelativeMediaPath(c))
      .filter((c): c is string => Boolean(c));

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 35000);

    const res = await fetch(`${LOCAL_MCP_BASE}/api/compile-timeline`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: ctrl.signal,
      body: JSON.stringify({
        clips: cleanClips,
        videoUrls: cleanClips,
        title: params.title,
        outputName: params.outputName,
      }),
    });
    clearTimeout(timer);

    if (!res.ok) return { ok: false };
    const json = (await res.json()) as {
      masterUrl?: string;
      fullUrl?: string;
      videoUrl?: string;
      url?: string;
      bytes?: number;
    };
    const masterUrl =
      json.fullUrl ||
      normalizeBackendMediaUrl(json.masterUrl || json.videoUrl || json.url, true);
    return { ok: Boolean(masterUrl), masterUrl, bytes: json.bytes };
  } catch {
    return { ok: false };
  }
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
      (req.referenceImages || [])
        .filter((img) => img.startsWith('data:'))
        .slice(0, 6)
        .forEach((img) => {
          const { mimeType, base64 } = stripDataUrlPrefix(img);
          parts.push({ inline_data: { mime_type: mimeType, data: base64 } });
        });
      if (req.firstFrameDataUrl?.startsWith('data:')) {
        const { mimeType, base64 } = stripDataUrlPrefix(req.firstFrameDataUrl);
        parts.push({ role_hint: 'first_frame', inline_data: { mime_type: mimeType, data: base64 } });
      }
      if (req.lastFrameDataUrl?.startsWith('data:')) {
        const { mimeType, base64 } = stripDataUrlPrefix(req.lastFrameDataUrl);
        parts.push({ role_hint: 'last_frame', inline_data: { mime_type: mimeType, data: base64 } });
      }

      const body: Record<string, unknown> = {
        model: req.byok.geminiModel || 'gemini-omni-1.2-flash',
        input: [{ role: 'user', parts }],
        generation_config: {
          response_modalities:
            req.mode === 'video' || req.mode === 'multiframe' ? ['VIDEO', 'AUDIO'] : ['IMAGE'],
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
      // Fall through to live local FFmpeg / MCP engine on :3001
    }
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
          model:
            req.mode === 'video' || req.mode === 'multiframe'
              ? 'seedance-1-0-pro'
              : 'seedream-3-0',
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
      // Fall through to live :3001 FFmpeg synthesis
    }
  }

  if (req.provider === 'mcp-router' && req.mcpTool) {
    try {
      const result = await callMcpServerTool(req.mcpTool.serverUrl, req.mcpTool.name, {
        prompt: req.prompt,
        imageUrl: toBackendRelativeMediaPath(req.firstFrameDataUrl),
        endImage: toBackendRelativeMediaPath(req.lastFrameDataUrl),
        aspect_ratio: req.aspectRatio,
        duration_seconds: req.durationSec || 7,
        previous_interaction_id: req.previousInteractionId,
      });
      if (result.connected) {
        return {
          providerLabel: `MCP · ${req.mcpTool.serverName} (${req.mcpTool.name})`,
          interactionId: result.interactionId || interactionId,
          imageUrl: result.imageUrl,
          videoUrl: result.videoUrl,
          usedLiveEndpoint: true,
          costEstimateUsd: 0,
        };
      }
    } catch {
      // Fall through
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

  // Try live :3001 FFmpeg + Zero-Markup Media Server first for video/multiframe requests
  if (req.mode === 'video' || req.mode === 'multiframe') {
    const inputImg =
      req.firstFrameDataUrl ||
      req.referenceImages?.[0] ||
      (req.prompt.toLowerCase().includes('sunrise') || req.prompt.toLowerCase().includes('dawn')
        ? '/media/shot02b_sunrise_remix.png'
        : req.prompt.toLowerCase().includes('alley') || req.prompt.toLowerCase().includes('sprint')
        ? '/media/shot02_alley_chase.png'
        : '/media/shot01_rooftop.png');

    const ffmpegRes = await renderVideoViaBackend({
      prompt: req.prompt,
      imageUrl: inputImg,
      endImage: req.lastFrameDataUrl,
      durationSec: Math.min(req.durationSec || 7, 15),
      aspectRatio: req.aspectRatio,
      resolution: req.resolution,
      cameraMotion: req.cameraMotion,
      mood: req.mood,
      previousInteractionId: req.previousInteractionId,
      provider: req.provider,
      outputName: req.outputName,
    });

    if (ffmpegRes.ok && ffmpegRes.videoUrl) {
      return {
        providerLabel: `Live :3001 · ${ffmpegRes.engine || 'FFmpeg H.264 + Stereo Audio'} ($0)`,
        interactionId: ffmpegRes.interactionId || interactionId,
        imageUrl: inputImg.startsWith('/media/') || inputImg.startsWith('http') ? inputImg : undefined,
        videoUrl: ffmpegRes.videoUrl,
        usedLiveEndpoint: true,
        costEstimateUsd: 0,
      };
    }
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
        'Synthesizes H.264 MP4 + stereo audio via Zero-Markup BYOK or local FFmpeg zoompan/LUT engine',
      serverUrl,
      serverName,
      inputSchema: { type: 'object', properties: { prompt: { type: 'string' }, duration_seconds: { type: 'number' } } },
    },
    {
      name: 'slice_contact_sheet',
      description:
        'Slices 3×3 or 2×2 storyboard contact sheet PNGs into 9 or 4 real individual PNG frames via FFmpeg crop',
      serverUrl,
      serverName,
      inputSchema: { type: 'object', properties: { imageUrl: { type: 'string' }, rows: { type: 'number' }, cols: { type: 'number' } } },
    },
    {
      name: 'extract_last_frame',
      description:
        'Extracts the exact final PNG frame of any MP4 shot via FFmpeg (-sseof -0.1) for seamless next-shot anchoring',
      serverUrl,
      serverName,
      inputSchema: { type: 'object', properties: { videoUrl: { type: 'string' } } },
    },
    {
      name: 'flow_scene_builder',
      description:
        'Concatenates multi-shot timeline MP4 clips into a single faststart H.264 + AAC master film',
      serverUrl,
      serverName,
      inputSchema: { type: 'object', properties: { clips: { type: 'array' }, title: { type: 'string' } } },
    },
    {
      name: 'inpaint_frame',
      description: 'Dreamina Smart Brush regional redraw & FFmpeg maskedmerge composite',
      serverUrl,
      serverName,
      inputSchema: { type: 'object', properties: { imageUrl: { type: 'string' }, maskDataUrl: { type: 'string' }, prompt: { type: 'string' } } },
    },
    {
      name: 'outpaint_expand',
      description: 'Expands frame boundaries to 16:9, 9:16, 21:9, or 1:1 via FFmpeg atmospheric outpaint',
      serverUrl,
      serverName,
      inputSchema: { type: 'object', properties: { imageUrl: { type: 'string' }, targetAspect: { type: 'string' } } },
    },
    {
      name: 'remove_background',
      description: 'Extracts RGBA alpha subject cutout PNG via FFmpeg colorkey matte',
      serverUrl,
      serverName,
      inputSchema: { type: 'object', properties: { imageUrl: { type: 'string' } } },
    },
    {
      name: 'upscale_4k',
      description: 'Upscales frame to 3840px 4K UHD via FFmpeg Lanczos + unsharp detail pass',
      serverUrl,
      serverName,
      inputSchema: { type: 'object', properties: { imageUrl: { type: 'string' } } },
    },
    {
      name: 'extract_style_dna',
      description: 'Extracts 5-swatch color LUT, lens focal profile, and film stock DNA from reference frame',
      serverUrl,
      serverName,
      inputSchema: { type: 'object', properties: { image_url: { type: 'string' } } },
    },
    {
      name: 'save_project',
      description: 'Persists canvas graph and snapshots to local .dreamflow-data.nosync disk database',
      serverUrl,
      serverName,
      inputSchema: { type: 'object', properties: { id: { type: 'string' }, name: { type: 'string' } } },
    },
  ];
}

async function callMcpServerTool(
  serverUrl: string,
  toolName: string,
  args: Record<string, unknown>
): Promise<{ connected: boolean; interactionId?: string; imageUrl?: string; videoUrl?: string }> {
  const httpTarget = serverUrl.startsWith('ws://')
    ? serverUrl.replace(/^ws:\/\//, 'http://')
    : serverUrl.startsWith('wss://')
    ? serverUrl.replace(/^wss:\/\//, 'https://')
    : serverUrl;

  const rpc = {
    jsonrpc: '2.0',
    id: Date.now(),
    method: 'tools/call',
    params: { name: toolName, arguments: args },
  };
  if (httpTarget.startsWith('http://') || httpTarget.startsWith('https://')) {
    const res = await fetch(httpTarget, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rpc),
    });
    if (res.ok) {
      const json = await res.json();
      let payload = json?.result || {};
      if (Array.isArray(payload?.content) && payload.content[0]?.text) {
        try {
          payload = { ...payload, ...JSON.parse(payload.content[0].text) };
        } catch {
          // ignore non-JSON text content
        }
      }
      return {
        connected: true,
        interactionId: payload.interactionId,
        imageUrl: normalizeBackendMediaUrl(payload.imageUrl || payload.frameUrl, true),
        videoUrl:
          payload.fullUrl ||
          normalizeBackendMediaUrl(payload.videoUrl || payload.masterUrl, true),
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

// ============================================================================
// Stage 4: Inline Image Editing, Upload, Disk Persistence & Bridge Relay APIs
// ============================================================================

export async function uploadMediaViaBackend(params: {
  filename: string;
  mimeType?: string;
  dataBase64: string;
}): Promise<{ ok: boolean; mediaUrl?: string; fullUrl?: string; bytes?: number }> {
  try {
    const res = await fetch(`${LOCAL_MCP_BASE}/api/upload-media`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!res.ok) return { ok: false };
    const json = (await res.json()) as {
      ok?: boolean;
      mediaUrl?: string;
      fullUrl?: string;
      bytes?: number;
    };
    const resolved =
      json.mediaUrl ||
      (json.fullUrl ? toBackendRelativeMediaPath(json.fullUrl) : undefined);
    if (!resolved) return { ok: false };
    return {
      ok: true,
      mediaUrl: resolved,
      fullUrl: json.fullUrl || normalizeBackendMediaUrl(resolved, true),
      bytes: json.bytes,
    };
  } catch {
    return { ok: false };
  }
}

export async function inpaintViaBackend(params: {
  imageUrl: string;
  maskDataUrl?: string;
  prompt?: string;
  provider?: ProviderId;
  apiKey?: string;
}): Promise<{ ok: boolean; imageUrl?: string; fullUrl?: string; engine?: string }> {
  try {
    const cleanSource = toBackendRelativeMediaPath(params.imageUrl) || params.imageUrl;
    const res = await fetch(`${LOCAL_MCP_BASE}/api/inpaint`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageUrl: cleanSource,
        maskDataUrl: params.maskDataUrl,
        prompt: params.prompt,
        provider: params.provider,
        apiKey: params.apiKey,
      }),
    });
    if (!res.ok) return { ok: false };
    const json = (await res.json()) as {
      ok?: boolean;
      imageUrl?: string;
      fullUrl?: string;
      engine?: string;
    };
    const url = json.imageUrl || toBackendRelativeMediaPath(json.fullUrl);
    if (!url) return { ok: false };
    return {
      ok: true,
      imageUrl: url,
      fullUrl: json.fullUrl || normalizeBackendMediaUrl(url, true),
      engine: json.engine || 'ffmpeg-local',
    };
  } catch {
    return { ok: false };
  }
}

export async function outpaintViaBackend(params: {
  imageUrl: string;
  targetAspect: AspectRatio;
  prompt?: string;
  provider?: ProviderId;
  apiKey?: string;
}): Promise<{
  ok: boolean;
  imageUrl?: string;
  fullUrl?: string;
  width?: number;
  height?: number;
}> {
  try {
    const cleanSource = toBackendRelativeMediaPath(params.imageUrl) || params.imageUrl;
    const res = await fetch(`${LOCAL_MCP_BASE}/api/outpaint`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageUrl: cleanSource,
        targetAspect: params.targetAspect,
        prompt: params.prompt,
        provider: params.provider,
        apiKey: params.apiKey,
      }),
    });
    if (!res.ok) return { ok: false };
    const json = (await res.json()) as {
      ok?: boolean;
      imageUrl?: string;
      fullUrl?: string;
      width?: number;
      height?: number;
    };
    const url = json.imageUrl || toBackendRelativeMediaPath(json.fullUrl);
    if (!url) return { ok: false };
    return {
      ok: true,
      imageUrl: url,
      fullUrl: json.fullUrl || normalizeBackendMediaUrl(url, true),
      width: json.width,
      height: json.height,
    };
  } catch {
    return { ok: false };
  }
}

export async function removeBgViaBackend(
  imageUrl: string
): Promise<{ ok: boolean; imageUrl?: string; fullUrl?: string }> {
  try {
    const cleanSource = toBackendRelativeMediaPath(imageUrl) || imageUrl;
    const res = await fetch(`${LOCAL_MCP_BASE}/api/remove-bg`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageUrl: cleanSource }),
    });
    if (!res.ok) return { ok: false };
    const json = (await res.json()) as {
      ok?: boolean;
      imageUrl?: string;
      fullUrl?: string;
    };
    const url = json.imageUrl || toBackendRelativeMediaPath(json.fullUrl);
    if (!url) return { ok: false };
    return {
      ok: true,
      imageUrl: url,
      fullUrl: json.fullUrl || normalizeBackendMediaUrl(url, true),
    };
  } catch {
    return { ok: false };
  }
}

export async function upscaleViaBackend(
  imageUrl: string
): Promise<{ ok: boolean; imageUrl?: string; fullUrl?: string; width?: number }> {
  try {
    const cleanSource = toBackendRelativeMediaPath(imageUrl) || imageUrl;
    const res = await fetch(`${LOCAL_MCP_BASE}/api/upscale`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageUrl: cleanSource }),
    });
    if (!res.ok) return { ok: false };
    const json = (await res.json()) as {
      ok?: boolean;
      imageUrl?: string;
      fullUrl?: string;
      width?: number;
    };
    const url = json.imageUrl || toBackendRelativeMediaPath(json.fullUrl);
    if (!url) return { ok: false };
    return {
      ok: true,
      imageUrl: url,
      fullUrl: json.fullUrl || normalizeBackendMediaUrl(url, true),
      width: json.width || 3840,
    };
  } catch {
    return { ok: false };
  }
}

export async function listDiskProjects(): Promise<{
  ok: boolean;
  projects: DiskProjectMeta[];
}> {
  try {
    const res = await fetch(`${LOCAL_MCP_BASE}/api/projects`);
    if (!res.ok) return { ok: false, projects: [] };
    const json = (await res.json()) as {
      ok?: boolean;
      projects?: DiskProjectMeta[];
    };
    return {
      ok: Boolean(json.ok),
      projects: Array.isArray(json.projects) ? json.projects : [],
    };
  } catch {
    return { ok: false, projects: [] };
  }
}

export async function getDiskProject(
  id: string
): Promise<{ ok: boolean; project?: DiskProjectRecord }> {
  try {
    const res = await fetch(
      `${LOCAL_MCP_BASE}/api/projects/${encodeURIComponent(id)}`
    );
    if (!res.ok) return { ok: false };
    const json = (await res.json()) as {
      ok?: boolean;
      project?: DiskProjectRecord;
    };
    return { ok: Boolean(json.ok && json.project), project: json.project };
  } catch {
    return { ok: false };
  }
}

export async function saveDiskProject(params: {
  id: string;
  name: string;
  state: Record<string, unknown>;
  createSnapshot?: boolean;
  snapshotLabel?: string;
}): Promise<{ ok: boolean; updatedAt?: number; snapshotCount?: number }> {
  try {
    const res = await fetch(`${LOCAL_MCP_BASE}/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!res.ok) return { ok: false };
    const json = (await res.json()) as {
      ok?: boolean;
      updatedAt?: number;
      snapshotCount?: number;
    };
    return {
      ok: Boolean(json.ok),
      updatedAt: json.updatedAt,
      snapshotCount: json.snapshotCount,
    };
  } catch {
    return { ok: false };
  }
}

export async function deleteDiskProject(id: string): Promise<boolean> {
  try {
    const res = await fetch(
      `${LOCAL_MCP_BASE}/api/projects/${encodeURIComponent(id)}`,
      { method: 'DELETE' }
    );
    return res.ok;
  } catch {
    return false;
  }
}

export async function exportDiskProjectBundle(
  id: string
): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(
      `${LOCAL_MCP_BASE}/api/projects/${encodeURIComponent(id)}/export`
    );
    if (!res.ok) return null;
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function importDiskProjectBundle(
  bundle: Record<string, unknown>
): Promise<{ ok: boolean; project?: DiskProjectRecord }> {
  try {
    const res = await fetch(`${LOCAL_MCP_BASE}/api/projects/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bundle }),
    });
    if (!res.ok) return { ok: false };
    const json = (await res.json()) as {
      ok?: boolean;
      project?: DiskProjectRecord;
    };
    return { ok: Boolean(json.ok && json.project), project: json.project };
  } catch {
    return { ok: false };
  }
}

export async function pushBridgeEventViaBackend(
  event: BridgeIncomingEvent
): Promise<{ ok: boolean }> {
  try {
    const res = await fetch(`${LOCAL_MCP_BASE}/api/bridge/push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
    });
    return { ok: res.ok };
  } catch {
    return { ok: false };
  }
}
