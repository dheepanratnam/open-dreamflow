/**
 * @open-dreamflow/provider-sdk — Local ComfyUI Zero-Markup GPU Adapter
 */

export type ComfyVideoWorkflowPreset = 'wan-2.1' | 'ltx-video' | 'hunyuan-video';

export interface ComfyWorkflowBuildOptions {
  preset: ComfyVideoWorkflowPreset;
  prompt: string;
  negativePrompt?: string;
  width?: number;
  height?: number;
  numFrames?: number;
  fps?: number;
  steps?: number;
  cfg?: number;
  seed?: number;
  firstFrameFilename?: string;
  lastFrameFilename?: string;
  modelFilename?: string;
}

export interface ComfyProgressEvent {
  promptId: string;
  nodeId?: string;
  step?: number;
  maxSteps?: number;
  percent?: number;
  status: 'queued' | 'executing' | 'progress' | 'completed' | 'error';
}

export interface ComfyOutputAsset {
  filename: string;
  subfolder: string;
  type: string;
  format?: string;
  viewUrl: string;
}

export interface ComfyExecutionResult {
  provider: 'comfyui';
  promptId: string;
  preset?: ComfyVideoWorkflowPreset;
  videoUrl?: string;
  assets: ComfyOutputAsset[];
  estimatedRawCostUsd: 0;
  rawHistory: Record<string, unknown>;
}

export interface ComfyUIClientConfig {
  baseUrl?: string;
  authToken?: string;
  clientId?: string;
  pollIntervalMs?: number;
  maxWaitMs?: number;
  fetchImpl?: typeof fetch;
}

export class ComfyUIError extends Error {
  public readonly statusCode?: number;
  public readonly details?: unknown;

  constructor(message: string, statusCode?: number, details?: unknown) {
    super(message);
    this.name = 'ComfyUIError';
    this.statusCode = statusCode;
    this.details = details;
  }
}

export function buildComfyVideoWorkflow(
  opts: ComfyWorkflowBuildOptions
): Record<string, Record<string, unknown>> {
  const width = opts.width ?? 832;
  const height = opts.height ?? 480;
  const numFrames = opts.numFrames ?? 81;
  const fps = opts.fps ?? 16;
  const steps = opts.steps ?? (opts.preset === 'ltx-video' ? 25 : 30);
  const cfg = opts.cfg ?? (opts.preset === 'ltx-video' ? 3.5 : 6.0);
  const seed = opts.seed ?? Math.floor(Math.random() * 2_147_483_647);
  const negativePrompt =
    opts.negativePrompt ||
    'blurry, low quality, distorted anatomy, watermark, text overlay, temporal flicker, static freeze';

  if (opts.preset === 'wan-2.1') {
    const unetName =
      opts.modelFilename ||
      (opts.firstFrameFilename
        ? 'wan2.1_i2v_720p_14B_fp8_e4m3fn.safetensors'
        : 'wan2.1_t2v_14B_fp8_e4m3fn.safetensors');

    const graph: Record<string, Record<string, unknown>> = {
      '1': { class_type: 'UNETLoader', inputs: { unet_name: unetName, weight_dtype: 'fp8_e4m3fn' } },
      '2': { class_type: 'CLIPLoader', inputs: { clip_name: 'umt5_xxl_fp8_e4m3fn_scaled.safetensors', type: 'wan' } },
      '3': { class_type: 'VAELoader', inputs: { vae_name: 'wan_2.1_vae.safetensors' } },
      '4': { class_type: 'CLIPTextEncode', inputs: { text: opts.prompt, clip: ['2', 0] } },
      '5': { class_type: 'CLIPTextEncode', inputs: { text: negativePrompt, clip: ['2', 0] } },
    };

    if (opts.firstFrameFilename && opts.lastFrameFilename) {
      graph['6'] = { class_type: 'LoadImage', inputs: { image: opts.firstFrameFilename } };
      graph['7'] = { class_type: 'LoadImage', inputs: { image: opts.lastFrameFilename } };
      graph['8'] = {
        class_type: 'WanFirstLastFrameToVideo',
        inputs: {
          positive: ['4', 0],
          negative: ['5', 0],
          vae: ['3', 0],
          start_image: ['6', 0],
          end_image: ['7', 0],
          width,
          height,
          length: numFrames,
          batch_size: 1,
        },
      };
    } else if (opts.firstFrameFilename) {
      graph['6'] = { class_type: 'LoadImage', inputs: { image: opts.firstFrameFilename } };
      graph['8'] = {
        class_type: 'WanImageToVideo',
        inputs: {
          positive: ['4', 0],
          negative: ['5', 0],
          vae: ['3', 0],
          start_image: ['6', 0],
          width,
          height,
          length: numFrames,
          batch_size: 1,
        },
      };
    } else {
      graph['8'] = {
        class_type: 'EmptyHunyuanLatentVideo',
        inputs: { width, height, length: numFrames, batch_size: 1 },
      };
    }

    const usesConditioningNode = Boolean(opts.firstFrameFilename);
    graph['9'] = {
      class_type: 'KSampler',
      inputs: {
        seed,
        steps,
        cfg,
        sampler_name: 'uni_pc',
        scheduler: 'simple',
        denoise: 1.0,
        model: ['1', 0],
        positive: usesConditioningNode ? ['8', 0] : ['4', 0],
        negative: usesConditioningNode ? ['8', 1] : ['5', 0],
        latent_image: usesConditioningNode ? ['8', 2] : ['8', 0],
      },
    };
    graph['10'] = { class_type: 'VAEDecode', inputs: { samples: ['9', 0], vae: ['3', 0] } };
    graph['11'] = {
      class_type: 'VHS_VideoCombine',
      inputs: {
        frame_rate: fps,
        loop_count: 0,
        filename_prefix: 'dreamflow_wan21',
        format: 'video/h264-mp4',
        save_output: true,
        images: ['10', 0],
      },
    };
    return graph;
  }

  if (opts.preset === 'ltx-video') {
    return {
      '1': {
        class_type: 'CheckpointLoaderSimple',
        inputs: { ckpt_name: opts.modelFilename || 'ltx-video-2b-v0.9.5.safetensors' },
      },
      '2': { class_type: 'CLIPLoader', inputs: { clip_name: 't5xxl_fp16.safetensors', type: 'ltxv' } },
      '3': { class_type: 'CLIPTextEncode', inputs: { text: opts.prompt, clip: ['2', 0] } },
      '4': { class_type: 'CLIPTextEncode', inputs: { text: negativePrompt, clip: ['2', 0] } },
      '5': { class_type: 'EmptyLTXVLatentVideo', inputs: { width, height, length: numFrames, batch_size: 1 } },
      '6': { class_type: 'LTXVConditioning', inputs: { positive: ['3', 0], negative: ['4', 0], frame_rate: fps } },
      '7': {
        class_type: 'KSampler',
        inputs: {
          seed,
          steps,
          cfg,
          sampler_name: 'euler',
          scheduler: 'normal',
          denoise: 1.0,
          model: ['1', 0],
          positive: ['6', 0],
          negative: ['6', 1],
          latent_image: ['5', 0],
        },
      },
      '8': { class_type: 'VAEDecode', inputs: { samples: ['7', 0], vae: ['1', 2] } },
      '9': {
        class_type: 'VHS_VideoCombine',
        inputs: {
          frame_rate: fps,
          loop_count: 0,
          filename_prefix: 'dreamflow_ltxv',
          format: 'video/h264-mp4',
          save_output: true,
          images: ['8', 0],
        },
      },
    };
  }

  return {
    '1': {
      class_type: 'UNETLoader',
      inputs: {
        unet_name: opts.modelFilename || 'hunyuan_video_720_cfgdistill_fp8_e4m3fn.safetensors',
        weight_dtype: 'fp8_e4m3fn',
      },
    },
    '2': {
      class_type: 'DualCLIPLoader',
      inputs: {
        clip_name1: 'clip_l.safetensors',
        clip_name2: 'llava_llama3_fp8_scaled.safetensors',
        type: 'hunyuan_video',
      },
    },
    '3': { class_type: 'VAELoader', inputs: { vae_name: 'hunyuan_video_vae_bf16.safetensors' } },
    '4': { class_type: 'CLIPTextEncode', inputs: { text: opts.prompt, clip: ['2', 0] } },
    '5': { class_type: 'EmptyHunyuanLatentVideo', inputs: { width, height, length: numFrames, batch_size: 1 } },
    '6': {
      class_type: 'KSampler',
      inputs: {
        seed,
        steps,
        cfg: 1.0,
        sampler_name: 'euler',
        scheduler: 'simple',
        denoise: 1.0,
        model: ['1', 0],
        positive: ['4', 0],
        negative: ['4', 0],
        latent_image: ['5', 0],
      },
    },
    '7': { class_type: 'VAEDecodeTiled', inputs: { samples: ['6', 0], vae: ['3', 0], tile_size: 256 } },
    '8': {
      class_type: 'VHS_VideoCombine',
      inputs: {
        frame_rate: fps,
        loop_count: 0,
        filename_prefix: 'dreamflow_hunyuan',
        format: 'video/h264-mp4',
        save_output: true,
        images: ['7', 0],
      },
    },
  };
}

export function injectCustomWorkflowTokens(
  workflowTemplate: Record<string, unknown>,
  tokens: Record<string, string | number | undefined>
): Record<string, Record<string, unknown>> {
  let serialized = JSON.stringify(workflowTemplate);
  for (const [key, val] of Object.entries(tokens)) {
    if (val === undefined) continue;
    const tokenPattern = `{{${key}}}`;
    if (typeof val === 'number') {
      serialized = serialized.split(`"${tokenPattern}"`).join(String(val));
    }
    serialized = serialized.split(tokenPattern).join(String(val).replace(/"/g, '\\"'));
  }
  return JSON.parse(serialized) as Record<string, Record<string, unknown>>;
}

export class ComfyUIClient {
  private readonly baseUrl: string;
  private readonly authToken?: string;
  private readonly clientId: string;
  private readonly pollIntervalMs: number;
  private readonly maxWaitMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(config: ComfyUIClientConfig = {}) {
    this.baseUrl = (config.baseUrl || 'http://127.0.0.1:8188').replace(/\/+$/, '');
    this.authToken = config.authToken;
    this.clientId =
      config.clientId || `open_dreamflow_${Math.random().toString(36).slice(2, 10)}`;
    this.pollIntervalMs = config.pollIntervalMs ?? 1500;
    this.maxWaitMs = config.maxWaitMs ?? 600_000;
    this.fetchImpl = config.fetchImpl ?? globalThis.fetch.bind(globalThis);
  }

  public async getSystemStats(signal?: AbortSignal): Promise<Record<string, unknown>> {
    const res = await this.fetchImpl(`${this.baseUrl}/system_stats`, {
      method: 'GET',
      headers: this.buildHeaders(),
      signal,
    });
    if (!res.ok) throw new ComfyUIError(`ComfyUI /system_stats failed (${res.status})`, res.status);
    return (await res.json()) as Record<string, unknown>;
  }

  public async uploadImage(
    imageBytes: Uint8Array | Blob,
    filename = `dreamflow_ref_${Date.now()}.png`,
    overwrite = true,
    signal?: AbortSignal
  ): Promise<{ name: string; subfolder: string; type: string }> {
    const form = new FormData();
    const blob =
      imageBytes instanceof Blob
        ? imageBytes
        : new Blob([imageBytes as unknown as BlobPart], { type: 'image/png' });
    form.append('image', blob, filename);
    form.append('overwrite', overwrite ? 'true' : 'false');

    const headers = this.buildHeaders();
    delete headers['Content-Type'];

    const res = await this.fetchImpl(`${this.baseUrl}/upload/image`, {
      method: 'POST',
      headers,
      body: form,
      signal,
    });
    if (!res.ok) throw new ComfyUIError(`ComfyUI /upload/image failed (${res.status})`, res.status);
    return (await res.json()) as { name: string; subfolder: string; type: string };
  }

  public async generateLocalVideo(
    opts: ComfyWorkflowBuildOptions & {
      onProgress?: (event: ComfyProgressEvent) => void;
      signal?: AbortSignal;
    }
  ): Promise<ComfyExecutionResult> {
    const workflow = buildComfyVideoWorkflow(opts);
    const result = await this.queueAndAwaitWorkflow(workflow, opts.onProgress, opts.signal);
    return { ...result, preset: opts.preset };
  }

  public async queueAndAwaitWorkflow(
    workflow: Record<string, Record<string, unknown>>,
    onProgress?: (event: ComfyProgressEvent) => void,
    signal?: AbortSignal
  ): Promise<ComfyExecutionResult> {
    const res = await this.fetchImpl(`${this.baseUrl}/prompt`, {
      method: 'POST',
      headers: this.buildHeaders(),
      body: JSON.stringify({ prompt: workflow, client_id: this.clientId }),
      signal,
    });

    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      throw new ComfyUIError(
        `ComfyUI /prompt rejected workflow (${res.status}): ${JSON.stringify(body).slice(0, 300)}`,
        res.status,
        body
      );
    }

    const promptId = String(body.prompt_id || '');
    if (!promptId) {
      throw new ComfyUIError('ComfyUI /prompt response did not include a prompt_id.', undefined, body);
    }

    onProgress?.({ promptId, status: 'queued' });
    const wsCleanup = this.attachWebSocketProgress(promptId, onProgress);

    try {
      const historyEntry = await this.pollHistory(promptId, signal);
      const assets = this.extractOutputAssets(historyEntry);
      const primaryVideo = assets.find((a) => /\.(mp4|webm|mov|gif)$/i.test(a.filename));
      onProgress?.({ promptId, percent: 100, status: 'completed' });

      return {
        provider: 'comfyui',
        promptId,
        videoUrl: primaryVideo?.viewUrl || assets[0]?.viewUrl,
        assets,
        estimatedRawCostUsd: 0,
        rawHistory: historyEntry,
      };
    } finally {
      wsCleanup();
    }
  }

  public buildViewUrl(filename: string, subfolder = '', type = 'output'): string {
    const params = new URLSearchParams({ filename, subfolder, type });
    return `${this.baseUrl}/view?${params.toString()}`;
  }

  private async pollHistory(
    promptId: string,
    signal?: AbortSignal
  ): Promise<Record<string, unknown>> {
    const startedAt = Date.now();
    while (true) {
      if (signal?.aborted) throw new ComfyUIError('ComfyUI execution aborted by caller.');
      if (Date.now() - startedAt > this.maxWaitMs) {
        throw new ComfyUIError(`ComfyUI prompt ${promptId} timed out after ${this.maxWaitMs}ms.`);
      }

      const res = await this.fetchImpl(
        `${this.baseUrl}/history/${encodeURIComponent(promptId)}`,
        { method: 'GET', headers: this.buildHeaders(), signal }
      );

      if (res.ok) {
        const historyMap = (await res.json()) as Record<string, unknown>;
        const entry = historyMap[promptId] as Record<string, unknown> | undefined;
        if (entry) {
          const statusObj = entry.status as Record<string, unknown> | undefined;
          if (statusObj?.status_str === 'error') {
            throw new ComfyUIError(
              `ComfyUI workflow execution error on prompt ${promptId}`,
              undefined,
              entry
            );
          }
          if (entry.outputs) return entry;
        }
      }

      await new Promise((resolve) => setTimeout(resolve, this.pollIntervalMs));
    }
  }

  private extractOutputAssets(historyEntry: Record<string, unknown>): ComfyOutputAsset[] {
    const outputs = (historyEntry.outputs || {}) as Record<string, Record<string, unknown>>;
    const assets: ComfyOutputAsset[] = [];

    for (const nodeOutputs of Object.values(outputs)) {
      for (const bucketKey of ['gifs', 'videos', 'images']) {
        const list = nodeOutputs[bucketKey];
        if (!Array.isArray(list)) continue;
        for (const item of list as Array<Record<string, unknown>>) {
          const filename = String(item.filename || '');
          if (!filename) continue;
          const subfolder = String(item.subfolder || '');
          const type = String(item.type || 'output');
          assets.push({
            filename,
            subfolder,
            type,
            format: typeof item.format === 'string' ? item.format : undefined,
            viewUrl: this.buildViewUrl(filename, subfolder, type),
          });
        }
      }
    }

    return assets;
  }

  private attachWebSocketProgress(
    promptId: string,
    onProgress?: (event: ComfyProgressEvent) => void
  ): () => void {
    if (!onProgress || typeof WebSocket === 'undefined') return () => {};

    let ws: WebSocket | null = null;
    try {
      const wsBase = this.baseUrl.replace(/^http/i, 'ws');
      ws = new WebSocket(`${wsBase}/ws?clientId=${encodeURIComponent(this.clientId)}`);
      ws.onmessage = (evt) => {
        if (typeof evt.data !== 'string') return;
        try {
          const msg = JSON.parse(evt.data) as { type?: string; data?: Record<string, unknown> };
          const data = msg.data || {};
          if (data.prompt_id && data.prompt_id !== promptId) return;

          if (msg.type === 'executing' && data.node) {
            onProgress({ promptId, nodeId: String(data.node), status: 'executing' });
          } else if (msg.type === 'progress') {
            const step = Number(data.value ?? 0);
            const maxSteps = Number(data.max ?? 1);
            onProgress({
              promptId,
              nodeId: data.node ? String(data.node) : undefined,
              step,
              maxSteps,
              percent: Math.round((step / Math.max(1, maxSteps)) * 100),
              status: 'progress',
            });
          }
        } catch {
          // Ignore
        }
      };
    } catch {
      return () => {};
    }

    return () => {
      try {
        ws?.close();
      } catch {
        // Ignore
      }
    };
  }

  private buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
    if (this.authToken) headers.Authorization = `Bearer ${this.authToken}`;
    return headers;
  }
}
