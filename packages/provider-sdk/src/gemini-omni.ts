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

export const GOOGLE_GENERATIVE_LANGUAGE_BASE =
  'https://generativelanguage.googleapis.com/v1beta';

export const GOOGLE_PREFERRED_VEO_MODELS = [
  'veo-3.1-fast-generate-preview',
  'veo-3.1-generate-preview',
  'veo-3.0-fast-generate-001',
  'veo-3.0-generate-preview',
  'veo-2.0-generate-001',
] as const;

export const GOOGLE_PREFERRED_IMAGE_MODELS = [
  'gemini-3.1-flash-image-preview',
  'gemini-2.5-flash-image-preview',
  'gemini-2.5-flash-image',
  'gemini-2.0-flash-exp-image-generation',
  'imagen-3.0-generate-002',
] as const;

export interface GoogleLiveModelSummary {
  models: string[];
  videoModels: string[];
  imageModels: string[];
  allCount: number;
}

export interface GeminiNativeImageRequest {
  prompt: string;
  model?: string;
  aspectRatio?: string;
  referenceImages?: Array<{ data: string; mimeType: string }>;
  signal?: AbortSignal;
}

export interface GeminiNativeImageResult {
  base64Data: string;
  mimeType: string;
  model: string;
  textResponse?: string;
}

export interface GoogleVeoVideoRequest {
  prompt: string;
  model?: string;
  aspectRatio?: string;
  durationSeconds?: number;
  startImage?: { bytesBase64Encoded: string; mimeType: string };
  endImage?: { bytesBase64Encoded: string; mimeType: string };
  onProgress?: (status: { operationName: string; done: boolean; elapsedMs: number }) => void;
  signal?: AbortSignal;
}

export interface GoogleVeoVideoResult {
  videoBytes: Uint8Array;
  mimeType: string;
  model: string;
  operationName: string;
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

  /**
   * Queries real Google AI Studio `GET /v1beta/models` for this API key and returns
   * discovered `veo*` video models and `gemini-*-image*` / `imagen*` native image models.
   */
  public async listAvailableModels(signal?: AbortSignal): Promise<GoogleLiveModelSummary> {
    const url = `${GOOGLE_GENERATIVE_LANGUAGE_BASE}/models?pageSize=200&key=${encodeURIComponent(this.apiKey)}`;
    const res = await this.fetchImpl(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal,
    });

    const body = await this.safeParseJson(res);
    if (!res.ok) {
      throw new GeminiOmniError(
        `Google AI Studio models check failed (${res.status}): ${this.extractErrorMessage(body)}`,
        res.status,
        body
      );
    }

    const rawModels = Array.isArray(body.models)
      ? (body.models as Array<Record<string, unknown>>)
      : [];
    const models = rawModels
      .map((m) => String(m.name || '').replace(/^models\//, '').trim())
      .filter(Boolean);

    const prioritize = (items: string[], preferred: readonly string[]): string[] => {
      const unique = Array.from(new Set(items));
      return unique.sort((a, b) => {
        const ia = preferred.indexOf(a);
        const ib = preferred.indexOf(b);
        if (ia !== -1 && ib !== -1) return ia - ib;
        if (ia !== -1) return -1;
        if (ib !== -1) return 1;
        return a.localeCompare(b);
      });
    };

    const videoModels = prioritize(
      models.filter((m) => /^veo/i.test(m)),
      GOOGLE_PREFERRED_VEO_MODELS
    );
    const imageModels = prioritize(
      models.filter((m) => /image|imagen/i.test(m)),
      GOOGLE_PREFERRED_IMAGE_MODELS
    );

    return {
      models,
      videoModels,
      imageModels,
      allCount: models.length,
    };
  }

  /**
   * Real Google Gemini Native Image Generation (`:generateContent` with `responseModalities: ["TEXT", "IMAGE"]`,
   * plus automatic fallback across `gemini-3.1-flash-image-preview`, `gemini-2.5-flash-image-preview`,
   * `gemini-2.0-flash-exp-image-generation`, and `imagen-3.0-generate-002:predict`).
   */
  public async generateNativeImage(
    req: GeminiNativeImageRequest
  ): Promise<GeminiNativeImageResult> {
    const prompt = String(req.prompt || '').trim();
    if (!prompt) {
      throw new GeminiOmniError('Prompt is required for Gemini native image generation.');
    }

    const requestedModel = req.model
      ? req.model.replace(/^models\//, '').trim()
      : '';

    const geminiImageCandidates = Array.from(
      new Set(
        [
          requestedModel && !/^imagen/i.test(requestedModel) && !/^gemini-omni/i.test(requestedModel)
            ? requestedModel
            : '',
          'gemini-3.1-flash-image-preview',
          'gemini-2.5-flash-image-preview',
          'gemini-2.5-flash-image',
          'gemini-2.0-flash-exp-image-generation',
        ].filter(Boolean)
      )
    );

    const inlineRefParts = (req.referenceImages || []).slice(0, 6).map((ref) => ({
      inlineData: {
        mimeType: ref.mimeType || 'image/png',
        data: ref.data.replace(/^data:[^;,]+;base64,/i, '').replace(/\s+/g, ''),
      },
    }));

    const effectivePrompt =
      req.aspectRatio && !prompt.includes(req.aspectRatio)
        ? `${prompt}\n(Target aspect ratio: ${req.aspectRatio})`
        : prompt;

    let lastStatus: number | undefined;
    let lastErrorMsg = 'No Gemini native image model returned image bytes.';
    let lastBody: unknown;

    // If caller explicitly requested an Imagen model (e.g. `imagen-4.0-generate-001`) with text-to-image, try Imagen `:predict` first
    if (requestedModel && /^imagen/i.test(requestedModel) && inlineRefParts.length === 0) {
      const validImagenAspect =
        req.aspectRatio === '9:16' ||
        req.aspectRatio === '1:1' ||
        req.aspectRatio === '4:3' ||
        req.aspectRatio === '3:4'
          ? req.aspectRatio
          : '16:9';
      const url = `${GOOGLE_GENERATIVE_LANGUAGE_BASE}/models/${encodeURIComponent(requestedModel)}:predict`;
      const res = await this.fetchImpl(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': this.apiKey,
          Accept: 'application/json',
        },
        body: JSON.stringify({
          instances: [{ prompt }],
          parameters: {
            sampleCount: 1,
            aspectRatio: validImagenAspect,
          },
        }),
        signal: req.signal,
      });
      const body = await this.safeParseJson(res);
      if (res.ok) {
        const predictions = Array.isArray(body.predictions)
          ? (body.predictions as Array<Record<string, unknown>>)
          : [];
        const firstPred = predictions[0];
        const b64 =
          typeof firstPred?.bytesBase64Encoded === 'string'
            ? firstPred.bytesBase64Encoded.trim()
            : '';
        if (b64.length > 64) {
          return {
            base64Data: b64,
            mimeType: String(firstPred?.mimeType || 'image/png').toLowerCase(),
            model: requestedModel,
          };
        }
      } else if (res.status === 401 || res.status === 403) {
        throw new GeminiOmniError(
          `Imagen ${requestedModel} failed (${res.status}): ${this.extractErrorMessage(body)}`,
          res.status,
          body
        );
      } else {
        lastStatus = res.status;
        lastErrorMsg = `Imagen ${requestedModel} failed (${res.status}): ${this.extractErrorMessage(body)}`;
        lastBody = body;
      }
    }

    for (const model of geminiImageCandidates) {
      const url = `${GOOGLE_GENERATIVE_LANGUAGE_BASE}/models/${encodeURIComponent(model)}:generateContent`;
      const res = await this.fetchImpl(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': this.apiKey,
          Accept: 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [...inlineRefParts, { text: effectivePrompt }],
            },
          ],
          generationConfig: {
            responseModalities: ['TEXT', 'IMAGE'],
          },
        }),
        signal: req.signal,
      });

      const body = await this.safeParseJson(res);
      if (!res.ok) {
        const msg = this.extractErrorMessage(body);
        lastStatus = res.status;
        lastErrorMsg = `Gemini ${model} failed (${res.status}): ${msg}`;
        lastBody = body;

        // Fail fast on invalid API key / authentication rejection
        if (
          res.status === 401 ||
          res.status === 403 ||
          (res.status === 400 && /API[_\s-]?KEY|key not valid/i.test(msg))
        ) {
          throw new GeminiOmniError(lastErrorMsg, res.status, body);
        }
        continue;
      }

      const candidates = Array.isArray(body.candidates)
        ? (body.candidates as Array<Record<string, unknown>>)
        : [];
      let textResponse = '';
      for (const cand of candidates) {
        const content = cand.content as Record<string, unknown> | undefined;
        const parts = Array.isArray(content?.parts)
          ? (content.parts as Array<Record<string, unknown>>)
          : [];
        for (const part of parts) {
          if (typeof part.text === 'string') {
            textResponse += (textResponse ? '\n' : '') + part.text;
          }
          const inline =
            (part.inlineData as Record<string, unknown> | undefined) ||
            (part.inline_data as Record<string, unknown> | undefined);
          const b64 = typeof inline?.data === 'string' ? inline.data.trim() : '';
          if (b64.length > 64) {
            const mimeType = String(
              inline?.mimeType || inline?.mime_type || 'image/png'
            ).toLowerCase();
            return {
              base64Data: b64,
              mimeType,
              model,
              textResponse: textResponse || undefined,
            };
          }
        }
      }

      lastErrorMsg = `Gemini ${model} returned text without inline image data${
        textResponse ? `: ${textResponse.slice(0, 180)}` : ''
      }`;
    }

    // Fallback to Imagen 3 `:predict` when pure text-to-image is requested
    if (inlineRefParts.length === 0) {
      const imagenModels = Array.from(
        new Set(
          [
            requestedModel && /^imagen/i.test(requestedModel) ? requestedModel : '',
            'imagen-3.0-generate-002',
            'imagen-3.0-generate-001',
          ].filter(Boolean)
        )
      );
      const validImagenAspect =
        req.aspectRatio === '9:16' ||
        req.aspectRatio === '1:1' ||
        req.aspectRatio === '4:3' ||
        req.aspectRatio === '3:4'
          ? req.aspectRatio
          : '16:9';

      for (const imagenModel of imagenModels) {
        const url = `${GOOGLE_GENERATIVE_LANGUAGE_BASE}/models/${encodeURIComponent(imagenModel)}:predict`;
        const res = await this.fetchImpl(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': this.apiKey,
            Accept: 'application/json',
          },
          body: JSON.stringify({
            instances: [{ prompt }],
            parameters: {
              sampleCount: 1,
              aspectRatio: validImagenAspect,
            },
          }),
          signal: req.signal,
        });

        const body = await this.safeParseJson(res);
        if (!res.ok) {
          lastStatus = res.status;
          lastErrorMsg = `Imagen ${imagenModel} failed (${res.status}): ${this.extractErrorMessage(body)}`;
          lastBody = body;
          continue;
        }

        const predictions = Array.isArray(body.predictions)
          ? (body.predictions as Array<Record<string, unknown>>)
          : [];
        const firstPred = predictions[0];
        const b64 =
          typeof firstPred?.bytesBase64Encoded === 'string'
            ? firstPred.bytesBase64Encoded.trim()
            : '';
        if (b64.length > 64) {
          return {
            base64Data: b64,
            mimeType: String(firstPred?.mimeType || 'image/png').toLowerCase(),
            model: imagenModel,
          };
        }
      }
    }

    throw new GeminiOmniError(lastErrorMsg, lastStatus, lastBody);
  }

  /**
   * Real Google Veo 3.1 / 3.0 / 2.0 Video Generation via `:predictLongRunning` + operation polling + MP4 download.
   */
  public async generateVeoVideo(req: GoogleVeoVideoRequest): Promise<GoogleVeoVideoResult> {
    const prompt = String(req.prompt || '').trim();
    if (!prompt) {
      throw new GeminiOmniError('Prompt is required for Google Veo video generation.');
    }

    // 1. Discover available `veo*` models on this Google AI Studio key (also validates API key upfront)
    const summary = await this.listAvailableModels(req.signal);
    const requestedModel = req.model ? req.model.replace(/^models\//, '').trim() : '';
    const veoCandidates = Array.from(
      new Set(
        [
          requestedModel && /^veo/i.test(requestedModel) ? requestedModel : '',
          ...summary.videoModels,
          ...GOOGLE_PREFERRED_VEO_MODELS,
        ].filter(Boolean)
      )
    );

    const normalizedAspect = req.aspectRatio === '9:16' ? '9:16' : '16:9';
    const rawDur = Number(req.durationSeconds || 6);
    const snappedDuration = rawDur <= 4 ? 4 : rawDur <= 6 ? 6 : 8;

    let selectedModel = veoCandidates[0] || 'veo-3.1-fast-generate-preview';
    let operationName = '';
    let lastStatus: number | undefined;
    let lastErr = 'Unable to start Veo predictLongRunning operation.';
    let lastBody: unknown;

    for (const candidateModel of veoCandidates) {
      const url = `${GOOGLE_GENERATIVE_LANGUAGE_BASE}/models/${encodeURIComponent(candidateModel)}:predictLongRunning`;
      const isVeo2 = /veo-2/i.test(candidateModel);
      const durationForModel = isVeo2 ? Math.max(5, Math.min(8, Math.round(rawDur || 6))) : snappedDuration;

      const instanceObj: Record<string, unknown> = { prompt };
      if (req.startImage?.bytesBase64Encoded) {
        instanceObj.image = {
          bytesBase64Encoded: req.startImage.bytesBase64Encoded
            .replace(/^data:[^;,]+;base64,/i, '')
            .replace(/\s+/g, ''),
          mimeType: req.startImage.mimeType || 'image/jpeg',
        };
      }

      const paramsObj: Record<string, unknown> = {
        sampleCount: 1,
        aspectRatio: normalizedAspect,
        durationSeconds: durationForModel,
      };
      if (req.endImage?.bytesBase64Encoded) {
        paramsObj.lastFrame = {
          bytesBase64Encoded: req.endImage.bytesBase64Encoded
            .replace(/^data:[^;,]+;base64,/i, '')
            .replace(/\s+/g, ''),
          mimeType: req.endImage.mimeType || 'image/jpeg',
        };
      }

      let res = await this.fetchImpl(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': this.apiKey,
          Accept: 'application/json',
        },
        body: JSON.stringify({
          instances: [instanceObj],
          parameters: paramsObj,
        }),
        signal: req.signal,
      });

      let body = await this.safeParseJson(res);

      // Retry without optional durationSeconds/lastFrame if a specific Veo variant rejects optional parameters
      if (!res.ok && res.status === 400 && (paramsObj.lastFrame || paramsObj.durationSeconds)) {
        const minimalParams: Record<string, unknown> = {
          aspectRatio: normalizedAspect,
        };
        const retryRes = await this.fetchImpl(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': this.apiKey,
            Accept: 'application/json',
          },
          body: JSON.stringify({
            instances: [instanceObj],
            parameters: minimalParams,
          }),
          signal: req.signal,
        });
        const retryBody = await this.safeParseJson(retryRes);
        if (retryRes.ok) {
          res = retryRes;
          body = retryBody;
        }
      }

      if (!res.ok) {
        lastStatus = res.status;
        lastErr = `Google Veo (${candidateModel}) failed (${res.status}): ${this.extractErrorMessage(body)}`;
        lastBody = body;
        if (res.status === 401 || res.status === 403 || res.status === 429) {
          throw new GeminiOmniError(lastErr, res.status, body);
        }
        continue;
      }

      if (typeof body.name === 'string' && body.name.trim()) {
        selectedModel = candidateModel;
        operationName = body.name.trim();
        break;
      }
    }

    if (!operationName) {
      throw new GeminiOmniError(lastErr, lastStatus, lastBody);
    }

    // 2. Poll GET /v1beta/${operationName} until done === true
    const pollDelayMs = Math.max(4_000, this.pollIntervalMs);
    const startedAt = Date.now();
    let finalOp: Record<string, unknown> = {};

    while (true) {
      if (req.signal?.aborted) {
        throw new GeminiOmniError('Google Veo operation polling aborted by caller.');
      }
      const elapsedMs = Date.now() - startedAt;
      if (elapsedMs > this.maxWaitMs) {
        throw new GeminiOmniError(
          `Timed out waiting for Google Veo operation ${operationName} after ${this.maxWaitMs}ms.`
        );
      }

      await new Promise((resolve) => setTimeout(resolve, pollDelayMs));

      const opUrl = `${GOOGLE_GENERATIVE_LANGUAGE_BASE}/${operationName.replace(/^\/+/, '')}`;
      const pollRes = await this.fetchImpl(opUrl, {
        method: 'GET',
        headers: {
          'x-goog-api-key': this.apiKey,
          Accept: 'application/json',
        },
        signal: req.signal,
      });

      const pollBody = await this.safeParseJson(pollRes);
      if (!pollRes.ok) {
        throw new GeminiOmniError(
          `Google Veo operation poll failed (${pollRes.status}): ${this.extractErrorMessage(pollBody)}`,
          pollRes.status,
          pollBody
        );
      }

      const isDone = Boolean(pollBody.done);
      req.onProgress?.({
        operationName,
        done: isDone,
        elapsedMs: Date.now() - startedAt,
      });

      if (pollBody.error) {
        throw new GeminiOmniError(
          `Google Veo generation failed: ${this.extractErrorMessage(pollBody)}`,
          undefined,
          pollBody
        );
      }

      if (isDone) {
        finalOp = pollBody;
        break;
      }
    }

    // 3. Extract video URI or inline base64 from operation response
    const opResponse = (finalOp.response || {}) as Record<string, unknown>;
    const genVideoResp = (opResponse.generateVideoResponse || {}) as Record<string, unknown>;
    const samples = Array.isArray(genVideoResp.generatedSamples)
      ? (genVideoResp.generatedSamples as Array<Record<string, unknown>>)
      : Array.isArray(opResponse.generatedSamples)
        ? (opResponse.generatedSamples as Array<Record<string, unknown>>)
        : [];
    const videosArr = Array.isArray(opResponse.videos)
      ? (opResponse.videos as Array<Record<string, unknown>>)
      : [];

    const firstVideoObj =
      (samples[0]?.video as Record<string, unknown> | undefined) ||
      videosArr[0] ||
      (opResponse.video as Record<string, unknown> | undefined);

    const inlineB64 =
      typeof firstVideoObj?.bytesBase64Encoded === 'string'
        ? firstVideoObj.bytesBase64Encoded.trim()
        : '';

    if (inlineB64.length > 64) {
      const bytes =
        typeof Buffer !== 'undefined'
          ? new Uint8Array(Buffer.from(inlineB64, 'base64'))
          : Uint8Array.from(atob(inlineB64), (ch) => ch.charCodeAt(0));
      return {
        videoBytes: bytes,
        mimeType: String(firstVideoObj?.mimeType || 'video/mp4'),
        model: selectedModel,
        operationName,
      };
    }

    const videoUri =
      typeof firstVideoObj?.uri === 'string' ? firstVideoObj.uri.trim() : '';

    if (!videoUri) {
      const raiReasons = genVideoResp.raiMediaFilteredReasons;
      const reasonSuffix = Array.isArray(raiReasons) && raiReasons.length > 0
        ? ` (Filtered: ${raiReasons.join('; ')})`
        : '';
      throw new GeminiOmniError(
        `Google Veo operation ${operationName} completed without a downloadable video URI${reasonSuffix}.`,
        undefined,
        finalOp
      );
    }

    let dlRes = await this.fetchImpl(videoUri, {
      method: 'GET',
      headers: { 'x-goog-api-key': this.apiKey },
      redirect: 'follow',
      signal: req.signal,
    });

    if (!dlRes.ok && (dlRes.status === 401 || dlRes.status === 403)) {
      const sep = videoUri.includes('?') ? '&' : '?';
      dlRes = await this.fetchImpl(`${videoUri}${sep}key=${encodeURIComponent(this.apiKey)}`, {
        method: 'GET',
        redirect: 'follow',
        signal: req.signal,
      });
    }

    if (!dlRes.ok) {
      throw new GeminiOmniError(
        `Failed to download generated Veo MP4 (${dlRes.status}) from ${videoUri}`,
        dlRes.status
      );
    }

    const videoBytes = new Uint8Array(await dlRes.arrayBuffer());
    return {
      videoBytes,
      mimeType: dlRes.headers.get('content-type')?.split(';')[0]?.trim() || 'video/mp4',
      model: selectedModel,
      operationName,
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
