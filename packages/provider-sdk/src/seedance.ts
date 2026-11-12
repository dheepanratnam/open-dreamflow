/**
 * @open-dreamflow/provider-sdk — Dreamina / BytePlus Seedream & Seedance Adapter
 */

export const SEEDANCE_DEFAULT_BASE_URL = 'https://ark.ap-southeast.bytepluses.com/api/v3';
export const SEEDANCE_DEFAULT_VIDEO_MODEL = 'seedance-2.0-pro';
export const SEEDREAM_DEFAULT_IMAGE_MODEL = 'seedream-3.0';
export const SEEDREAM_DEFAULT_EDIT_MODEL = 'seedream-3.0-edit';

export const SEEDANCE_MIN_KEYFRAMES = 2;
export const SEEDANCE_MAX_KEYFRAMES = 10;

export type SeedanceAspectRatio = '16:9' | '9:16' | '21:9' | '1:1' | '4:3' | '3:4';

export type SeedanceCameraMotion =
  | 'push_in'
  | 'pull_out'
  | 'pan_left'
  | 'pan_right'
  | 'tilt_up'
  | 'tilt_down'
  | 'orbit_cw'
  | 'orbit_ccw'
  | 'crane_up'
  | 'whip_pan'
  | 'fpv_drone'
  | 'static';

export interface SeedanceKeyframeInput {
  imageUrl: string;
  timestampSeconds?: number;
  transitionPrompt?: string;
  cameraMotion?: SeedanceCameraMotion;
  bridgeDurationSeconds?: number;
}

export interface SeedanceSequenceRequest {
  prompt: string;
  keyframes: SeedanceKeyframeInput[];
  model?: string;
  resolution?: '480p' | '720p' | '1080p';
  aspectRatio?: SeedanceAspectRatio;
  characterLock?: boolean;
  seed?: number;
  waitForCompletion?: boolean;
  onProgress?: (task: SeedanceTaskStatus) => void;
  signal?: AbortSignal;
}

export interface SeedanceTaskStatus {
  taskId: string;
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';
  videoUrl?: string;
  coverImageUrl?: string;
  durationSeconds?: number;
  errorMessage?: string;
  raw?: Record<string, unknown>;
}

export interface SeedanceVideoResult {
  provider: 'seedance';
  model: string;
  taskId: string;
  status: SeedanceTaskStatus['status'];
  videoUrl?: string;
  coverImageUrl?: string;
  keyframeCount: number;
  totalDurationSeconds: number;
  aspectRatio: SeedanceAspectRatio;
  estimatedRawCostUsd: number;
  rawResponse: Record<string, unknown>;
}

export interface SeedreamInpaintRequest {
  sourceImage: string;
  maskImage: string;
  prompt: string;
  negativePrompt?: string;
  model?: string;
  featherPx?: number;
  strength?: number;
  size?: string;
  seed?: number;
  signal?: AbortSignal;
}

export interface SeedreamOutpaintRequest {
  sourceImage: string;
  targetAspectRatio: SeedanceAspectRatio;
  prompt?: string;
  expandPadding?: { top?: number; right?: number; bottom?: number; left?: number };
  model?: string;
  seed?: number;
  signal?: AbortSignal;
}

export interface ContactSheetPanelSlice {
  index: number;
  row: number;
  col: number;
  shotLabel: string;
  cameraAngle: string;
  cropBox: { x: number; y: number; width: number; height: number };
}

export interface SeedreamContactSheetRequest {
  prompt: string;
  gridLayout?: '9-grid' | '4-angle';
  referenceImages?: string[];
  styleDnaDescriptor?: string;
  panelAspectRatio?: SeedanceAspectRatio;
  model?: string;
  seed?: number;
  signal?: AbortSignal;
}

export interface SeedreamImageEditResult {
  provider: 'seedream';
  model: string;
  operation: 'inpaint' | 'outpaint';
  imageUrl?: string;
  imageBase64?: string;
  aspectRatio?: SeedanceAspectRatio;
  estimatedRawCostUsd: number;
  rawResponse: Record<string, unknown>;
}

export interface SeedreamContactSheetResult {
  provider: 'seedream';
  model: string;
  gridLayout: '9-grid' | '4-angle';
  rows: number;
  cols: number;
  sheetImageUrl?: string;
  sheetImageBase64?: string;
  panels: ContactSheetPanelSlice[];
  estimatedRawCostUsd: number;
  rawResponse: Record<string, unknown>;
}

export interface SeedanceClientConfig {
  apiKey: string;
  baseUrl?: string;
  defaultVideoModel?: string;
  defaultImageModel?: string;
  defaultEditModel?: string;
  pollIntervalMs?: number;
  maxWaitMs?: number;
  fetchImpl?: typeof fetch;
}

export class SeedanceError extends Error {
  public readonly statusCode?: number;
  public readonly errorBody?: unknown;

  constructor(message: string, statusCode?: number, errorBody?: unknown) {
    super(message);
    this.name = 'SeedanceError';
    this.statusCode = statusCode;
    this.errorBody = errorBody;
  }
}

const NINE_GRID_SHOT_PRESETS: Array<{ label: string; angle: string }> = [
  { label: '01 · Extreme Wide Establishing', angle: '24mm Anamorphic Wide' },
  { label: '02 · Medium Tracking Subject', angle: '35mm Dolly Steadicam' },
  { label: '03 · Over-the-Shoulder Reveal', angle: '50mm Shallow DOF' },
  { label: '04 · Intimate Close-Up Emotion', angle: '85mm Prime Portrait' },
  { label: '05 · Dynamic Low-Angle Hero', angle: '28mm Low Dutch Tilt' },
  { label: '06 · Insert Detail / Prop Beat', angle: '100mm Macro Insert' },
  { label: '07 · High-Angle God’s Eye', angle: '18mm Overhead Crane' },
  { label: '08 · Action Kinetic Mid-Shot', angle: '40mm Tracking Lateral' },
  { label: '09 · Silhouette Resolution Wide', angle: '35mm Backlit Horizon' },
];

const FOUR_ANGLE_COVERAGE_PRESETS: Array<{ label: string; angle: string }> = [
  { label: 'Cam A · Master Wide Shot', angle: '24mm Full-Frame Wide' },
  { label: 'Cam B · Medium Two-Shot', angle: '50mm Eye-Level Cinema' },
  { label: 'Cam C · Tight Close-Up', angle: '85mm f/1.4 Subject Lock' },
  { label: 'Cam D · Low-Angle Dynamic', angle: '28mm Hero Low-Angle' },
];

export function buildContactSheetSlices(
  gridLayout: '9-grid' | '4-angle',
  gutterRatio = 0.006
): ContactSheetPanelSlice[] {
  const rows = gridLayout === '9-grid' ? 3 : 2;
  const cols = gridLayout === '9-grid' ? 3 : 2;
  const presets = gridLayout === '9-grid' ? NINE_GRID_SHOT_PRESETS : FOUR_ANGLE_COVERAGE_PRESETS;

  const cellW = 1 / cols;
  const cellH = 1 / rows;
  const panels: ContactSheetPanelSlice[] = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const index = r * cols + c;
      const preset = presets[index] || { label: `Panel ${index + 1}`, angle: '35mm Standard' };
      panels.push({
        index,
        row: r,
        col: c,
        shotLabel: preset.label,
        cameraAngle: preset.angle,
        cropBox: {
          x: Number((c * cellW + gutterRatio / 2).toFixed(6)),
          y: Number((r * cellH + gutterRatio / 2).toFixed(6)),
          width: Number((cellW - gutterRatio).toFixed(6)),
          height: Number((cellH - gutterRatio).toFixed(6)),
        },
      });
    }
  }

  return panels;
}

const CAMERA_TAG_MAP: Record<SeedanceCameraMotion, string> = {
  push_in: '[Push in]',
  pull_out: '[Pull out]',
  pan_left: '[Pan left]',
  pan_right: '[Pan right]',
  tilt_up: '[Tilt up]',
  tilt_down: '[Tilt down]',
  orbit_cw: '[Orbit clockwise]',
  orbit_ccw: '[Orbit counter-clockwise]',
  crane_up: '[Crane up]',
  whip_pan: '[Whip pan]',
  fpv_drone: '[FPV walkthrough]',
  static: '[Static camera]',
};

export class SeedanceClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly defaultVideoModel: string;
  private readonly defaultImageModel: string;
  private readonly defaultEditModel: string;
  private readonly pollIntervalMs: number;
  private readonly maxWaitMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(config: SeedanceClientConfig) {
    if (!config.apiKey || !config.apiKey.trim()) {
      throw new SeedanceError('SeedanceClient requires a non-empty BytePlus/Ark apiKey.');
    }
    this.apiKey = config.apiKey.trim();
    this.baseUrl = (config.baseUrl || SEEDANCE_DEFAULT_BASE_URL).replace(/\/+$/, '');
    this.defaultVideoModel = config.defaultVideoModel || SEEDANCE_DEFAULT_VIDEO_MODEL;
    this.defaultImageModel = config.defaultImageModel || SEEDREAM_DEFAULT_IMAGE_MODEL;
    this.defaultEditModel = config.defaultEditModel || SEEDREAM_DEFAULT_EDIT_MODEL;
    this.pollIntervalMs = config.pollIntervalMs ?? 2500;
    this.maxWaitMs = config.maxWaitMs ?? 300_000;
    this.fetchImpl = config.fetchImpl ?? globalThis.fetch.bind(globalThis);
  }

  public async synthesizeKeyframeSequence(
    req: SeedanceSequenceRequest
  ): Promise<SeedanceVideoResult> {
    if (
      !Array.isArray(req.keyframes) ||
      req.keyframes.length < SEEDANCE_MIN_KEYFRAMES ||
      req.keyframes.length > SEEDANCE_MAX_KEYFRAMES
    ) {
      throw new SeedanceError(
        `Seedance multi-frame synthesis requires between ${SEEDANCE_MIN_KEYFRAMES} and ${SEEDANCE_MAX_KEYFRAMES} keyframes (received ${req.keyframes?.length ?? 0}).`
      );
    }

    const model = req.model || this.defaultVideoModel;
    const resolution = req.resolution || '1080p';
    const aspectRatio = req.aspectRatio || '16:9';

    let elapsedSeconds = 0;
    const bridgeNotes: string[] = [];
    const contentParts: Array<Record<string, unknown>> = [];

    for (let i = 0; i < req.keyframes.length; i++) {
      const kf = req.keyframes[i];
      const timestamp = kf.timestampSeconds ?? elapsedSeconds;
      const role =
        i === 0 ? 'first_frame' : i === req.keyframes.length - 1 ? 'last_frame' : 'key_frame';

      contentParts.push({
        type: 'image_url',
        role,
        keyframe_index: i,
        timestamp_seconds: timestamp,
        image_url: { url: kf.imageUrl },
      });

      if (i < req.keyframes.length - 1) {
        const bridgeDur = Math.max(2, Math.min(10, kf.bridgeDurationSeconds ?? 4));
        const camTag = kf.cameraMotion ? CAMERA_TAG_MAP[kf.cameraMotion] : '';
        const beatText = [camTag, kf.transitionPrompt].filter(Boolean).join(' ');
        if (beatText) bridgeNotes.push(`[${timestamp}s -> ${timestamp + bridgeDur}s] ${beatText}`);
        elapsedSeconds = timestamp + bridgeDur;
      }
    }

    const totalDurationSeconds = Math.max(4, elapsedSeconds || (req.keyframes.length - 1) * 4);
    const structuredPrompt = [
      req.prompt.trim(),
      ...bridgeNotes,
      `--rs ${resolution} --rt ${aspectRatio} --dur ${totalDurationSeconds}`,
    ]
      .filter(Boolean)
      .join('\n');

    contentParts.unshift({ type: 'text', text: structuredPrompt });

    const payload: Record<string, unknown> = {
      model,
      content: contentParts,
      parameters: {
        resolution,
        aspect_ratio: aspectRatio,
        duration: totalDurationSeconds,
        character_lock: req.characterLock ?? true,
        keyframe_count: req.keyframes.length,
        ...(typeof req.seed === 'number' ? { seed: req.seed } : {}),
      },
    };

    const created = await this.requestJson(
      `${this.baseUrl}/contents/generations/tasks`,
      'POST',
      payload,
      req.signal
    );

    const taskId = String(created.id || created.task_id || `sd_task_${Date.now()}`);
    const waitForCompletion = req.waitForCompletion ?? true;
    const finalTask = waitForCompletion
      ? await this.waitForTask(taskId, req.onProgress, req.signal)
      : this.parseTaskStatus(taskId, created);

    const perSecRate = resolution === '1080p' ? 0.035 : resolution === '720p' ? 0.022 : 0.014;

    return {
      provider: 'seedance',
      model,
      taskId,
      status: finalTask.status,
      videoUrl: finalTask.videoUrl,
      coverImageUrl: finalTask.coverImageUrl,
      keyframeCount: req.keyframes.length,
      totalDurationSeconds,
      aspectRatio,
      estimatedRawCostUsd: Number((totalDurationSeconds * perSecRate).toFixed(4)),
      rawResponse: finalTask.raw || created,
    };
  }

  public async waitForTask(
    taskId: string,
    onProgress?: (task: SeedanceTaskStatus) => void,
    signal?: AbortSignal
  ): Promise<SeedanceTaskStatus> {
    const startedAt = Date.now();
    while (true) {
      if (signal?.aborted) throw new SeedanceError('Seedance task polling aborted.');
      if (Date.now() - startedAt > this.maxWaitMs) {
        throw new SeedanceError(`Seedance task ${taskId} timed out after ${this.maxWaitMs}ms.`);
      }

      const raw = await this.requestJson(
        `${this.baseUrl}/contents/generations/tasks/${encodeURIComponent(taskId)}`,
        'GET',
        undefined,
        signal
      );

      const parsed = this.parseTaskStatus(taskId, raw);
      onProgress?.(parsed);

      if (parsed.status === 'succeeded') return parsed;
      if (parsed.status === 'failed' || parsed.status === 'cancelled') {
        throw new SeedanceError(
          `Seedance task ${taskId} ${parsed.status}: ${parsed.errorMessage || 'Unknown error'}`,
          undefined,
          raw
        );
      }

      await new Promise((resolve) => setTimeout(resolve, this.pollIntervalMs));
    }
  }

  public async smartInpaint(req: SeedreamInpaintRequest): Promise<SeedreamImageEditResult> {
    if (!req.sourceImage || !req.maskImage) {
      throw new SeedanceError('smartInpaint requires both sourceImage and maskImage.');
    }
    const model = req.model || this.defaultEditModel;
    const payload: Record<string, unknown> = {
      model,
      task_type: 'inpaint',
      image: req.sourceImage,
      mask: req.maskImage,
      prompt: req.prompt,
      negative_prompt: req.negativePrompt,
      feather_px: req.featherPx ?? 12,
      strength: req.strength ?? 0.82,
      size: req.size || '1920x1080',
      response_format: 'url',
      ...(typeof req.seed === 'number' ? { seed: req.seed } : {}),
    };

    const raw = await this.requestJson(`${this.baseUrl}/images/edits`, 'POST', payload, req.signal);
    const firstItem = this.extractFirstImageItem(raw);
    return {
      provider: 'seedream',
      model,
      operation: 'inpaint',
      imageUrl: firstItem.url,
      imageBase64: firstItem.b64_json,
      estimatedRawCostUsd: 0.03,
      rawResponse: raw,
    };
  }

  public async smartOutpaint(req: SeedreamOutpaintRequest): Promise<SeedreamImageEditResult> {
    if (!req.sourceImage) throw new SeedanceError('smartOutpaint requires sourceImage.');
    const model = req.model || this.defaultEditModel;
    const payload: Record<string, unknown> = {
      model,
      task_type: 'outpaint',
      image: req.sourceImage,
      target_aspect_ratio: req.targetAspectRatio,
      prompt:
        req.prompt ||
        'Seamlessly extend scene environment, perspective lines, lighting, and film grain to fill the expanded frame.',
      expand_padding: req.expandPadding || { top: 0.15, right: 0.25, bottom: 0.15, left: 0.25 },
      response_format: 'url',
      ...(typeof req.seed === 'number' ? { seed: req.seed } : {}),
    };

    const raw = await this.requestJson(`${this.baseUrl}/images/edits`, 'POST', payload, req.signal);
    const firstItem = this.extractFirstImageItem(raw);
    return {
      provider: 'seedream',
      model,
      operation: 'outpaint',
      imageUrl: firstItem.url,
      imageBase64: firstItem.b64_json,
      aspectRatio: req.targetAspectRatio,
      estimatedRawCostUsd: 0.035,
      rawResponse: raw,
    };
  }

  public async generateContactSheet(
    req: SeedreamContactSheetRequest
  ): Promise<SeedreamContactSheetResult> {
    const gridLayout = req.gridLayout ?? '9-grid';
    const rows = gridLayout === '9-grid' ? 3 : 2;
    const cols = gridLayout === '9-grid' ? 3 : 2;
    const panels = buildContactSheetSlices(gridLayout);
    const model = req.model || this.defaultImageModel;

    const panelDirectives = panels
      .map((p) => `Panel ${p.index + 1} (${p.shotLabel}, ${p.cameraAngle})`)
      .join('; ');
    const styleSuffix = req.styleDnaDescriptor
      ? ` Style DNA Lock: ${req.styleDnaDescriptor}.`
      : '';

    const fullGridPrompt =
      `Generate a clean, borderless ${rows}x${cols} cinematic storyboard contact sheet (${panels.length} distinct camera angles of the exact same subject, costume, and environment): ${req.prompt.trim()}. ` +
      `Layout panels left-to-right, top-to-bottom: ${panelDirectives}.${styleSuffix} No text watermarks or thick borders.`;

    const sizeByRatio: Record<SeedanceAspectRatio, string> = {
      '16:9': '2560x1440',
      '9:16': '1440x2560',
      '21:9': '2688x1152',
      '1:1': '2048x2048',
      '4:3': '2304x1728',
      '3:4': '1728x2304',
    };

    const payload: Record<string, unknown> = {
      model,
      prompt: fullGridPrompt,
      size: sizeByRatio[req.panelAspectRatio || '16:9'],
      reference_images: (req.referenceImages || []).slice(0, 6),
      grid_layout: `${rows}x${cols}`,
      response_format: 'url',
      ...(typeof req.seed === 'number' ? { seed: req.seed } : {}),
    };

    const raw = await this.requestJson(
      `${this.baseUrl}/images/generations`,
      'POST',
      payload,
      req.signal
    );
    const firstItem = this.extractFirstImageItem(raw);

    return {
      provider: 'seedream',
      model,
      gridLayout,
      rows,
      cols,
      sheetImageUrl: firstItem.url,
      sheetImageBase64: firstItem.b64_json,
      panels,
      estimatedRawCostUsd: gridLayout === '9-grid' ? 0.045 : 0.035,
      rawResponse: raw,
    };
  }

  private parseTaskStatus(taskId: string, raw: Record<string, unknown>): SeedanceTaskStatus {
    const rawStatus = String(raw.status || 'succeeded').toLowerCase();
    const content = (raw.content || raw.output || {}) as Record<string, unknown>;
    const errObj = raw.error as Record<string, unknown> | undefined;

    let normalized: SeedanceTaskStatus['status'] = 'running';
    if (rawStatus === 'succeeded' || rawStatus === 'completed' || rawStatus === 'success') {
      normalized = 'succeeded';
    } else if (rawStatus === 'queued' || rawStatus === 'pending') {
      normalized = 'queued';
    } else if (rawStatus === 'failed' || rawStatus === 'error') {
      normalized = 'failed';
    } else if (rawStatus === 'cancelled' || rawStatus === 'canceled') {
      normalized = 'cancelled';
    }

    return {
      taskId,
      status: normalized,
      videoUrl:
        (content.video_url as string | undefined) || (raw.video_url as string | undefined),
      coverImageUrl:
        (content.last_frame_url as string | undefined) ||
        (content.cover_image_url as string | undefined),
      errorMessage:
        (errObj?.message as string | undefined) || (raw.error_message as string | undefined),
      raw,
    };
  }

  private extractFirstImageItem(raw: Record<string, unknown>): {
    url?: string;
    b64_json?: string;
  } {
    const dataArr = Array.isArray(raw.data)
      ? (raw.data as Array<Record<string, unknown>>)
      : [];
    if (dataArr.length > 0) {
      return {
        url: dataArr[0].url as string | undefined,
        b64_json: dataArr[0].b64_json as string | undefined,
      };
    }
    return {
      url: raw.image_url as string | undefined,
      b64_json: raw.b64_json as string | undefined,
    };
  }

  private async requestJson(
    url: string,
    method: 'GET' | 'POST',
    body?: Record<string, unknown>,
    signal?: AbortSignal
  ): Promise<Record<string, unknown>> {
    const res = await this.fetchImpl(url, {
      method,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
      signal,
    });

    const text = await res.text();
    let parsed: Record<string, unknown> = {};
    if (text) {
      try {
        parsed = JSON.parse(text) as Record<string, unknown>;
      } catch {
        parsed = { rawText: text };
      }
    }

    if (!res.ok) {
      const errObj = parsed.error as Record<string, unknown> | undefined;
      const msg =
        (errObj?.message as string | undefined) ||
        (parsed.message as string | undefined) ||
        text.slice(0, 300);
      throw new SeedanceError(
        `Seedance/Seedream API error (${res.status}): ${msg}`,
        res.status,
        parsed
      );
    }

    return parsed;
  }
}
