/**
 * @open-dreamflow/provider-sdk — Google Gemini Omni 1.2 Flash Adapter
 */

export const GEMINI_INTERACTIONS_ENDPOINT =
  'https://generativelanguage.googleapis.com/v1beta/interactions';

export const GEMINI_OMNI_DEFAULT_MODEL = 'gemini-omni-1.2-flash';
export const GEMINI_OMNI_MAX_REFERENCE_IMAGES = 6;
export const GEMINI_OMNI_MIN_DURATION_SECONDS = 3;
export const GEMINI_OMNI_MAX_DURATION_SECONDS = 15;
export const GEMINI_OMNI_MAX_CONTEXT_WINDOW_SECONDS = 10;

export type GeminiOmniResolution = '360p' | '720p' | '1080p' | '2k' | '4k';
export type GeminiAspectRatio = '16:9' | '9:16' | '21:9' | '1:1' | '4:3' | '3:4';
export type GeminiCameraCurve =
  | 'locked_off'
  | 'dolly_in'
  | 'dolly_out'
  | 'orbit_left'
  | 'orbit_right'
  | 'crane_up'
  | 'crane_down'
  | 'whip_pan'
  | 'fpv_through'
  | 'handheld_cinema'
  | 'custom';

export type ElementRole =
  | 'character'
  | 'product'
  | 'environment'
  | 'style_dna'
  | 'prop'
  | 'costume';

export interface GeminiInlineData {
  mime_type: string;
  data: string;
}

export interface GeminiReferenceElementInput {
  elementTag?: string;
  role?: ElementRole;
  image: string | Uint8Array;
  mimeType?: string;
  weight?: number;
}

export interface GeminiFrameAnchorInput {
  image: string | Uint8Array;
  mimeType?: string;
  timestampSeconds?: number;
}

export interface GeminiPriorContextWindow {
  priorVideo?: string;
  priorInteractionId?: string;
  windowSeconds?: number;
  continuityLock?: boolean;
}

export interface GeminiStyleDnaLock {
  paletteHex?: string[];
  lighting?: string;
  lens?: string;
  filmStock?: string;
  colorGradeLut?: string;
}

export interface GeminiOmniGenerateRequest {
  prompt: string;
  negativePrompt?: string;
  model?: string;
  durationSeconds?: number;
  resolution?: GeminiOmniResolution;
  aspectRatio?: GeminiAspectRatio;
  fps?: 24 | 30 | 60;
  referenceImages?: GeminiReferenceElementInput[];
  firstFrame?: GeminiFrameAnchorInput;
  lastFrame?: GeminiFrameAnchorInput;
  cameraCurve?: GeminiCameraCurve;
  priorContext?: GeminiPriorContextWindow;
  previousInteractionId?: string;
  editMask?: GeminiFrameAnchorInput;
  styleDna?: GeminiStyleDnaLock;
  generateNativeAudio?: boolean;
  seed?: number;
  waitForCompletion?: boolean;
  onProgress?: (status: GeminiInteractionStatusPayload) => void;
  signal?: AbortSignal;
}

export interface GeminiMultiTurnEditRequest {
  previousInteractionId: string;
  editInstruction: string;
  editMask?: GeminiFrameAnchorInput;
  referenceImages?: GeminiReferenceElementInput[];
  preserveMotionTrajectory?: boolean;
  preserveAudio?: boolean;
  resolution?: GeminiOmniResolution;
  durationSeconds?: number;
  waitForCompletion?: boolean;
  onProgress?: (status: GeminiInteractionStatusPayload) => void;
  signal?: AbortSignal;
}

export interface GeminiUpscaleRequest {
  interactionId: string;
  targetResolution?: '1080p' | '2k' | '4k';
  detailPrompt?: string;
  creativeRefinement?: number;
  waitForCompletion?: boolean;
  onProgress?: (status: GeminiInteractionStatusPayload) => void;
  signal?: AbortSignal;
}

export interface GeminiMultiframeBridgeStep {
  id?: string;
  prompt: string;
  firstFrame: GeminiFrameAnchorInput;
  lastFrame: GeminiFrameAnchorInput;
  durationSeconds: number;
  cameraCurve?: GeminiCameraCurve;
}

export interface GeminiInteractionStatusPayload {
  interactionId: string;
  status: 'QUEUED' | 'IN_PROGRESS' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  progressPercent?: number;
  etaSeconds?: number;
  raw?: unknown;
}

export interface GeminiOmniVideoResult {
  provider: 'gemini-omni';
  model: string;
  interactionId: string;
  previousInteractionId?: string;
  status: 'COMPLETED' | 'IN_PROGRESS' | 'PROCESSING' | 'QUEUED';
  videoUrl?: string;
  videoMimeType: string;
  videoInlineBase64?: string;
  audioTrackUrl?: string;
  thumbnailFrameBase64?: string;
  lastFrameBase64?: string;
  durationSeconds: number;
  resolution: GeminiOmniResolution;
  aspectRatio: GeminiAspectRatio;
  usage?: {
    inputTokens?: number;
    outputVideoSeconds?: number;
    estimatedRawCostUsd: number;
  };
  rawResponse: Record<string, unknown>;
}

export interface GeminiOmniClientConfig {
  apiKey: string;
  endpoint?: string;
  defaultModel?: string;
  pollIntervalMs?: number;
  maxWaitMs?: number;
  fetchImpl?: typeof fetch;
}

export class GeminiOmniError extends Error {
  public readonly statusCode?: number;
  public readonly errorBody?: unknown;

  constructor(message: string, statusCode?: number, errorBody?: unknown) {
    super(message);
    this.name = 'GeminiOmniError';
    this.statusCode = statusCode;
    this.errorBody = errorBody;
  }
}

export async function toGeminiInlineData(
  input: string | Uint8Array,
  defaultMimeType = 'image/png',
  fetchImpl: typeof fetch = globalThis.fetch
): Promise<GeminiInlineData> {
  if (input instanceof Uint8Array) {
    return { mime_type: defaultMimeType, data: uint8ArrayToBase64(input) };
  }

  const trimmed = input.trim();
  const dataUriMatch = /^data:([^;,]+);base64,(.+)$/s.exec(trimmed);
  if (dataUriMatch) {
    return { mime_type: dataUriMatch[1], data: dataUriMatch[2].replace(/\s+/g, '') };
  }

  if (/^https?:\/\//i.test(trimmed)) {
    const res = await fetchImpl(trimmed);
    if (!res.ok) {
      throw new GeminiOmniError(
        `Failed to fetch reference asset from URL (${res.status}): ${trimmed}`,
        res.status
      );
    }
    const contentType = res.headers.get('content-type')?.split(';')[0]?.trim() || defaultMimeType;
    const buf = new Uint8Array(await res.arrayBuffer());
    return { mime_type: contentType, data: uint8ArrayToBase64(buf) };
  }

  return { mime_type: defaultMimeType, data: trimmed.replace(/\s+/g, '') };
}

export function uint8ArrayToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

export function estimateGeminiOmniRawCostUsd(
  durationSeconds: number,
  resolution: GeminiOmniResolution
): number {
  const ratePerSecond: Record<GeminiOmniResolution, number> = {
    '360p': 0.012,
    '720p': 0.025,
    '1080p': 0.045,
    '2k': 0.075,
    '4k': 0.12,
  };
  return Number((durationSeconds * (ratePerSecond[resolution] ?? 0.025)).toFixed(4));
}

export class GeminiOmniClient {
  private readonly apiKey: string;
  private readonly endpoint: string;
  private readonly defaultModel: string;
  private readonly pollIntervalMs: number;
  private readonly maxWaitMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(config: GeminiOmniClientConfig) {
    if (!config.apiKey || !config.apiKey.trim()) {
      throw new GeminiOmniError('GeminiOmniClient requires a non-empty Google AI Studio apiKey.');
    }
    this.apiKey = config.apiKey.trim();
    this.endpoint = (config.endpoint || GEMINI_INTERACTIONS_ENDPOINT).replace(/\/+$/, '');
    this.defaultModel = config.defaultModel || GEMINI_OMNI_DEFAULT_MODEL;
    this.pollIntervalMs = config.pollIntervalMs ?? 2500;
    this.maxWaitMs = config.maxWaitMs ?? 300_000;
    this.fetchImpl = config.fetchImpl ?? globalThis.fetch.bind(globalThis);
  }

  public async buildInteractionPayload(
    req: GeminiOmniGenerateRequest
  ): Promise<Record<string, unknown>> {
    const durationSeconds = req.durationSeconds ?? 8;
    if (
      durationSeconds < GEMINI_OMNI_MIN_DURATION_SECONDS ||
      durationSeconds > GEMINI_OMNI_MAX_DURATION_SECONDS
    ) {
      throw new GeminiOmniError(
        `Gemini Omni 1.2 Flash durationSeconds must be between ${GEMINI_OMNI_MIN_DURATION_SECONDS}s and ${GEMINI_OMNI_MAX_DURATION_SECONDS}s (received ${durationSeconds}s).`
      );
    }

    const refs = req.referenceImages ?? [];
    if (refs.length > GEMINI_OMNI_MAX_REFERENCE_IMAGES) {
      throw new GeminiOmniError(
        `Gemini Omni 1.2 Flash supports up to ${GEMINI_OMNI_MAX_REFERENCE_IMAGES} @Element reference images via inline_data (received ${refs.length}).`
      );
    }

    const inputParts: Array<Record<string, unknown>> = [];

    for (let i = 0; i < refs.length; i++) {
      const ref = refs[i];
      const inlineData = await toGeminiInlineData(
        ref.image,
        ref.mimeType || 'image/png',
        this.fetchImpl
      );
      inputParts.push({
        type: 'reference_image',
        element_tag: ref.elementTag || `@Element_${i + 1}`,
        role: ref.role || 'character',
        weight: ref.weight ?? 0.85,
        inline_data: inlineData,
      });
    }

    let enrichedPrompt = req.prompt.trim();
    if (req.styleDna) {
      const styleTokens: string[] = [];
      if (req.styleDna.lighting) styleTokens.push(`Lighting: ${req.styleDna.lighting}`);
      if (req.styleDna.lens) styleTokens.push(`Lens: ${req.styleDna.lens}`);
      if (req.styleDna.filmStock) styleTokens.push(`Film Stock: ${req.styleDna.filmStock}`);
      if (req.styleDna.paletteHex?.length) {
        styleTokens.push(`Color Palette: ${req.styleDna.paletteHex.join(', ')}`);
      }
      if (styleTokens.length > 0) {
        enrichedPrompt = `${enrichedPrompt}\n[Style DNA Lock — ${styleTokens.join(' | ')}]`;
      }
    }

    inputParts.push({ type: 'text', text: enrichedPrompt });

    if (req.editMask) {
      inputParts.push({
        type: 'edit_mask',
        inline_data: await toGeminiInlineData(
          req.editMask.image,
          req.editMask.mimeType || 'image/png',
          this.fetchImpl
        ),
      });
    }

    const keyframeAnchors: Record<string, unknown> = {};
    if (req.firstFrame) {
      keyframeAnchors.first_frame = {
        inline_data: await toGeminiInlineData(
          req.firstFrame.image,
          req.firstFrame.mimeType || 'image/png',
          this.fetchImpl
        ),
        timestamp_seconds: req.firstFrame.timestampSeconds ?? 0,
      };
    }
    if (req.lastFrame) {
      keyframeAnchors.last_frame = {
        inline_data: await toGeminiInlineData(
          req.lastFrame.image,
          req.lastFrame.mimeType || 'image/png',
          this.fetchImpl
        ),
        timestamp_seconds: req.lastFrame.timestampSeconds ?? durationSeconds,
      };
    }

    let temporalContext: Record<string, unknown> | undefined;
    if (req.priorContext && (req.priorContext.priorVideo || req.priorContext.priorInteractionId)) {
      const requestedWindow = req.priorContext.windowSeconds ?? GEMINI_OMNI_MAX_CONTEXT_WINDOW_SECONDS;
      const clampedWindow = Math.max(
        1,
        Math.min(GEMINI_OMNI_MAX_CONTEXT_WINDOW_SECONDS, requestedWindow)
      );
      temporalContext = {
        window_seconds: clampedWindow,
        continuity_lock: req.priorContext.continuityLock ?? true,
      };
      if (req.priorContext.priorInteractionId) {
        temporalContext.prior_interaction_id = req.priorContext.priorInteractionId;
      }
      if (req.priorContext.priorVideo) {
        if (req.priorContext.priorVideo.startsWith('data:')) {
          temporalContext.prior_video_inline = await toGeminiInlineData(
            req.priorContext.priorVideo,
            'video/mp4',
            this.fetchImpl
          );
        } else {
          temporalContext.prior_video_uri = req.priorContext.priorVideo;
        }
      }
    }

    const resolution: GeminiOmniResolution = req.resolution ?? '720p';
    const aspectRatio: GeminiAspectRatio = req.aspectRatio ?? '16:9';

    const payload: Record<string, unknown> = {
      model: req.model || this.defaultModel,
      input: inputParts,
      response_modalities: req.generateNativeAudio === false ? ['VIDEO'] : ['VIDEO', 'AUDIO'],
      generation_config: {
        video_config: {
          duration_seconds: durationSeconds,
          resolution,
          aspect_ratio: aspectRatio,
          fps: req.fps ?? 24,
          camera_curve: req.cameraCurve ?? 'locked_off',
          ...(Object.keys(keyframeAnchors).length > 0 ? { keyframe_anchors: keyframeAnchors } : {}),
          ...(temporalContext ? { temporal_context: temporalContext } : {}),
          ...(req.negativePrompt ? { negative_prompt: req.negativePrompt } : {}),
          ...(typeof req.seed === 'number' ? { seed: req.seed } : {}),
        },
      },
    };

    if (req.previousInteractionId) {
      payload.previous_interaction_id = req.previousInteractionId;
    }

    return payload;
  }

  public async generateVideo(req: GeminiOmniGenerateRequest): Promise<GeminiOmniVideoResult> {
    const payload = await this.buildInteractionPayload(req);
    const resolution: GeminiOmniResolution = req.resolution ?? '720p';
    const aspectRatio: GeminiAspectRatio = req.aspectRatio ?? '16:9';
    const durationSeconds = req.durationSeconds ?? 8;

    const initialRaw = await this.postInteraction(payload, req.signal);
    const waitForCompletion = req.waitForCompletion ?? true;

    const finalRaw =
      waitForCompletion && this.isPendingStatus(initialRaw)
        ? await this.pollInteractionUntilDone(
            this.extractInteractionId(initialRaw),
            req.onProgress,
            req.signal
          )
        : initialRaw;

    return this.parseInteractionResult(finalRaw, {
      model: (payload.model as string) || this.defaultModel,
      durationSeconds,
      resolution,
      aspectRatio,
      previousInteractionId: req.previousInteractionId,
    });
  }

  public async generateDraft360p(
    req: Omit<GeminiOmniGenerateRequest, 'resolution'>
  ): Promise<GeminiOmniVideoResult> {
    return this.generateVideo({ ...req, resolution: '360p' });
  }

  public async upscaleTo4K(req: GeminiUpscaleRequest): Promise<GeminiOmniVideoResult> {
    if (!req.interactionId) {
      throw new GeminiOmniError('upscaleTo4K requires the source draft interactionId.');
    }
    const targetResolution = req.targetResolution ?? '4k';
    const payload: Record<string, unknown> = {
      model: this.defaultModel,
      previous_interaction_id: req.interactionId,
      input: [
        {
          type: 'upscale_directive',
          target_resolution: targetResolution,
          creative_refinement: req.creativeRefinement ?? 0.35,
          text:
            req.detailPrompt ||
            `Upscale prior interaction to ${targetResolution.toUpperCase()} master fidelity while preserving exact motion vectors, framing, lighting, and audio sync.`,
        },
      ],
      response_modalities: ['VIDEO', 'AUDIO'],
      generation_config: {
        video_config: { resolution: targetResolution, mode: 'STATEFUL_UPSCALE' },
      },
    };

    const initialRaw = await this.postInteraction(payload, req.signal);
    const waitForCompletion = req.waitForCompletion ?? true;
    const finalRaw =
      waitForCompletion && this.isPendingStatus(initialRaw)
        ? await this.pollInteractionUntilDone(
            this.extractInteractionId(initialRaw),
            req.onProgress,
            req.signal
          )
        : initialRaw;

    const inferredDuration =
      Number((finalRaw.metadata as Record<string, unknown> | undefined)?.duration_seconds ?? 8) ||
      8;

    return this.parseInteractionResult(finalRaw, {
      model: this.defaultModel,
      durationSeconds: inferredDuration,
      resolution: targetResolution,
      aspectRatio: '16:9',
      previousInteractionId: req.interactionId,
    });
  }

  public async branchEditVideo(req: GeminiMultiTurnEditRequest): Promise<GeminiOmniVideoResult> {
    if (!req.previousInteractionId) {
      throw new GeminiOmniError('branchEditVideo requires a valid previousInteractionId.');
    }

    const directivePrefix =
      req.preserveMotionTrajectory === false
        ? '[Multi-Turn Video Edit]'
        : '[Multi-Turn Video Edit — Preserve camera trajectory & subject blocking]';

    return this.generateVideo({
      prompt: `${directivePrefix} ${req.editInstruction.trim()}`,
      previousInteractionId: req.previousInteractionId,
      editMask: req.editMask,
      referenceImages: req.referenceImages,
      resolution: req.resolution ?? '1080p',
      durationSeconds: req.durationSeconds ?? 8,
      generateNativeAudio: req.preserveAudio ?? true,
      waitForCompletion: req.waitForCompletion,
      onProgress: req.onProgress,
      signal: req.signal,
    });
  }

  public async synthesizeMultiframeChain(options: {
    bridges: GeminiMultiframeBridgeStep[];
    referenceImages?: GeminiReferenceElementInput[];
    styleDna?: GeminiStyleDnaLock;
    resolution?: GeminiOmniResolution;
    aspectRatio?: GeminiAspectRatio;
    onBridgeComplete?: (index: number, result: GeminiOmniVideoResult) => void;
    signal?: AbortSignal;
  }): Promise<GeminiOmniVideoResult[]> {
    if (options.bridges.length < 1 || options.bridges.length > 9) {
      throw new GeminiOmniError(
        `Multiframe chain requires 1 to 9 bridges (2 to 10 keyframes); received ${options.bridges.length} bridges.`
      );
    }

    const results: GeminiOmniVideoResult[] = [];
    let priorInteractionId: string | undefined;
    let priorVideoUrl: string | undefined;

    for (let i = 0; i < options.bridges.length; i++) {
      const bridge = options.bridges[i];
      const clip = await this.generateVideo({
        prompt: bridge.prompt,
        firstFrame: bridge.firstFrame,
        lastFrame: bridge.lastFrame,
        durationSeconds: bridge.durationSeconds,
        cameraCurve: bridge.cameraCurve ?? 'dolly_in',
        referenceImages: options.referenceImages,
        styleDna: options.styleDna,
        resolution: options.resolution ?? '720p',
        aspectRatio: options.aspectRatio ?? '16:9',
        priorContext:
          priorInteractionId || priorVideoUrl
            ? {
                priorInteractionId,
                priorVideo: priorVideoUrl,
                windowSeconds: GEMINI_OMNI_MAX_CONTEXT_WINDOW_SECONDS,
                continuityLock: true,
              }
            : undefined,
        signal: options.signal,
      });

      results.push(clip);
      priorInteractionId = clip.interactionId;
      priorVideoUrl = clip.videoUrl;
      options.onBridgeComplete?.(i, clip);
    }

    return results;
  }

  public async getInteraction(
    interactionId: string,
    signal?: AbortSignal
  ): Promise<Record<string, unknown>> {
    const url = `${this.endpoint}/${encodeURIComponent(interactionId)}`;
    const res = await this.fetchImpl(url, {
      method: 'GET',
      headers: { 'x-goog-api-key': this.apiKey, Accept: 'application/json' },
      signal,
    });

    const body = await this.safeParseJson(res);
    if (!res.ok) {
      throw new GeminiOmniError(
        `Gemini Interactions GET failed (${res.status}): ${this.extractErrorMessage(body)}`,
        res.status,
        body
      );
    }
    return body;
  }

  private async postInteraction(
    payload: Record<string, unknown>,
    signal?: AbortSignal
  ): Promise<Record<string, unknown>> {
    const res = await this.fetchImpl(this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': this.apiKey,
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
      signal,
    });

    const body = await this.safeParseJson(res);
    if (!res.ok) {
      throw new GeminiOmniError(
        `Gemini Interactions POST failed (${res.status}): ${this.extractErrorMessage(body)}`,
        res.status,
        body
      );
    }
    return body;
  }

  private async pollInteractionUntilDone(
    interactionId: string,
    onProgress?: (status: GeminiInteractionStatusPayload) => void,
    signal?: AbortSignal
  ): Promise<Record<string, unknown>> {
    const startedAt = Date.now();

    while (true) {
      if (signal?.aborted) {
        throw new GeminiOmniError('Gemini Omni interaction polling aborted by caller.');
      }
      if (Date.now() - startedAt > this.maxWaitMs) {
        throw new GeminiOmniError(
          `Timed out waiting for Gemini Omni interaction ${interactionId} after ${this.maxWaitMs}ms.`
        );
      }

      await new Promise((resolve) => setTimeout(resolve, this.pollIntervalMs));

      const current = await this.getInteraction(interactionId, signal);
      const rawStatus = String(current.status || current.state || 'COMPLETED').toUpperCase();

      onProgress?.({
        interactionId,
        status: rawStatus as GeminiInteractionStatusPayload['status'],
        progressPercent:
          typeof current.progress_percent === 'number' ? current.progress_percent : undefined,
        etaSeconds: typeof current.eta_seconds === 'number' ? current.eta_seconds : undefined,
        raw: current,
      });

      if (rawStatus === 'FAILED' || rawStatus === 'CANCELLED' || current.error) {
        throw new GeminiOmniError(
          `Gemini Omni interaction ${interactionId} ${rawStatus}: ${this.extractErrorMessage(current)}`,
          undefined,
          current
        );
      }

      if (!this.isPendingStatus(current)) return current;
    }
  }

  private isPendingStatus(raw: Record<string, unknown>): boolean {
    const status = String(raw.status || raw.state || '').toUpperCase();
    return (
      status === 'QUEUED' ||
      status === 'IN_PROGRESS' ||
      status === 'PROCESSING' ||
      status === 'PENDING'
    );
  }

  private extractInteractionId(raw: Record<string, unknown>): string {
    const id = raw.id || raw.interaction_id || raw.name;
    if (typeof id === 'string' && id.length > 0) return id.replace(/^interactions\//, '');
    return `int_${Date.now()}`;
  }

  private parseInteractionResult(
    raw: Record<string, unknown>,
    defaults: {
      model: string;
      durationSeconds: number;
      resolution: GeminiOmniResolution;
      aspectRatio: GeminiAspectRatio;
      previousInteractionId?: string;
    }
  ): GeminiOmniVideoResult {
    const interactionId = this.extractInteractionId(raw);
    const outputs = Array.isArray(raw.outputs)
      ? (raw.outputs as Array<Record<string, unknown>>)
      : Array.isArray((raw.response as Record<string, unknown> | undefined)?.outputs)
        ? ((raw.response as Record<string, unknown>).outputs as Array<Record<string, unknown>>)
        : [];

    let videoUrl: string | undefined;
    let videoInlineBase64: string | undefined;
    let videoMimeType = 'video/mp4';
    let audioTrackUrl: string | undefined;
    let thumbnailFrameBase64: string | undefined;
    let lastFrameBase64: string | undefined;

    for (const part of outputs) {
      const partType = String(part.type || part.modality || '').toLowerCase();
      const fileData = part.file_data as Record<string, unknown> | undefined;
      const inlineData = part.inline_data as Record<string, unknown> | undefined;

      if (
        partType === 'video' ||
        String(fileData?.mime_type || inlineData?.mime_type || '').startsWith('video/')
      ) {
        videoUrl =
          (part.uri as string | undefined) ||
          (part.video_url as string | undefined) ||
          (fileData?.file_uri as string | undefined);
        videoInlineBase64 = inlineData?.data as string | undefined;
        videoMimeType =
          (fileData?.mime_type as string | undefined) ||
          (inlineData?.mime_type as string | undefined) ||
          'video/mp4';
      } else if (partType === 'audio') {
        audioTrackUrl =
          (part.uri as string | undefined) || (fileData?.file_uri as string | undefined);
      } else if (partType === 'thumbnail_frame') {
        thumbnailFrameBase64 = inlineData?.data as string | undefined;
      } else if (partType === 'last_frame') {
        lastFrameBase64 = inlineData?.data as string | undefined;
      }
    }

    if (!videoUrl && typeof raw.video_uri === 'string') videoUrl = raw.video_uri;
    if (!videoUrl && typeof raw.videoUrl === 'string') videoUrl = raw.videoUrl;

    const usageObj = raw.usage as Record<string, unknown> | undefined;
    const statusRaw = String(raw.status || raw.state || 'COMPLETED').toUpperCase();
    const normalizedStatus: GeminiOmniVideoResult['status'] =
      statusRaw === 'QUEUED' || statusRaw === 'IN_PROGRESS' || statusRaw === 'PROCESSING'
        ? statusRaw
        : 'COMPLETED';

    return {
      provider: 'gemini-omni',
      model: (raw.model as string) || defaults.model,
      interactionId,
      previousInteractionId:
        (raw.previous_interaction_id as string | undefined) || defaults.previousInteractionId,
      status: normalizedStatus,
      videoUrl,
      videoMimeType,
      videoInlineBase64,
      audioTrackUrl,
      thumbnailFrameBase64,
      lastFrameBase64,
      durationSeconds: defaults.durationSeconds,
      resolution: defaults.resolution,
      aspectRatio: defaults.aspectRatio,
      usage: {
        inputTokens: typeof usageObj?.input_tokens === 'number' ? usageObj.input_tokens : undefined,
        outputVideoSeconds: defaults.durationSeconds,
        estimatedRawCostUsd: estimateGeminiOmniRawCostUsd(
          defaults.durationSeconds,
          defaults.resolution
        ),
      },
      rawResponse: raw,
    };
  }

  private async safeParseJson(res: Response): Promise<Record<string, unknown>> {
    const text = await res.text();
    if (!text) return {};
    try {
      return JSON.parse(text) as Record<string, unknown>;
    } catch {
      return { rawText: text };
    }
  }

  private extractErrorMessage(body: Record<string, unknown>): string {
    const err = body.error as Record<string, unknown> | string | undefined;
    if (typeof err === 'string') return err;
    if (err && typeof err.message === 'string') return err.message;
    if (typeof body.message === 'string') return body.message;
    if (typeof body.rawText === 'string') return body.rawText.slice(0, 300);
    return JSON.stringify(body).slice(0, 300);
  }
}
