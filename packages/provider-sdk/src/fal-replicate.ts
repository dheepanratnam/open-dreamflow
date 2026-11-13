/**
 * @open-dreamflow/provider-sdk — Fal.ai & Replicate Zero-Markup Adapters
 */

import { resolveReferenceImageForCloud } from './providers/reference-utils.js';

export type OpenWeightVideoModelFamily =
  | 'wan-2.1-t2v'
  | 'wan-2.1-i2v'
  | 'wan-2.1-flf2v'
  | 'ltx-video'
  | 'hunyuan-video'
  | 'hunyuan-video-i2v';

export const FAL_OPEN_WEIGHT_ENDPOINTS: Record<OpenWeightVideoModelFamily, string> = {
  'wan-2.1-t2v': 'fal-ai/wan-t2v',
  'wan-2.1-i2v': 'fal-ai/wan-i2v',
  'wan-2.1-flf2v': 'fal-ai/wan-flf2v',
  'ltx-video': 'fal-ai/ltx-video-13b-distilled',
  'hunyuan-video': 'fal-ai/hunyuan-video',
  'hunyuan-video-i2v': 'fal-ai/hunyuan-video-image-to-video',
};

export const REPLICATE_OPEN_WEIGHT_MODELS: Record<OpenWeightVideoModelFamily, string> = {
  'wan-2.1-t2v': 'wavespeedai/wan-2.1-t2v-720p',
  'wan-2.1-i2v': 'wavespeedai/wan-2.1-i2v-720p',
  'wan-2.1-flf2v': 'wavespeedai/wan-2.1-i2v-720p',
  'ltx-video': 'lightricks/ltx-video',
  'hunyuan-video': 'tencent/hunyuan-video',
  'hunyuan-video-i2v': 'tencent/hunyuan-video',
};

export interface OpenWeightVideoRequest {
  family?: OpenWeightVideoModelFamily;
  endpointOrModelId?: string;
  prompt: string;
  negativePrompt?: string;
  imageUrl?: string;
  lastFrameUrl?: string;
  aspectRatio?: '16:9' | '9:16' | '1:1';
  resolution?: '480p' | '720p' | '1080p';
  numFrames?: number;
  fps?: number;
  guidanceScale?: number;
  numInferenceSteps?: number;
  seed?: number;
  extraInput?: Record<string, unknown>;
  onQueueUpdate?: (status: { status: string; queuePosition?: number; logs?: string[] }) => void;
  signal?: AbortSignal;
}

export interface OpenWeightVideoResult {
  provider: 'fal' | 'replicate';
  modelId: string;
  requestId: string;
  videoUrl: string;
  seed?: number;
  rawResponse: Record<string, unknown>;
}

export interface FalClientConfig {
  apiKey: string;
  queueBaseUrl?: string;
  syncBaseUrl?: string;
  pollIntervalMs?: number;
  maxWaitMs?: number;
  fetchImpl?: typeof fetch;
}

export class CloudPassThroughError extends Error {
  public readonly provider: 'fal' | 'replicate';
  public readonly statusCode?: number;
  public readonly errorBody?: unknown;

  constructor(
    provider: 'fal' | 'replicate',
    message: string,
    statusCode?: number,
    errorBody?: unknown
  ) {
    super(message);
    this.name = 'CloudPassThroughError';
    this.provider = provider;
    this.statusCode = statusCode;
    this.errorBody = errorBody;
  }
}

export class FalClient {
  private readonly apiKey: string;
  private readonly queueBaseUrl: string;
  private readonly syncBaseUrl: string;
  private readonly pollIntervalMs: number;
  private readonly maxWaitMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(config: FalClientConfig) {
    if (!config.apiKey || !config.apiKey.trim()) {
      throw new CloudPassThroughError('fal', 'FalClient requires a non-empty Fal.ai API key.');
    }
    this.apiKey = config.apiKey.trim();
    this.queueBaseUrl = (config.queueBaseUrl || 'https://queue.fal.run').replace(/\/+$/, '');
    this.syncBaseUrl = (config.syncBaseUrl || 'https://fal.run').replace(/\/+$/, '');
    this.pollIntervalMs = config.pollIntervalMs ?? 2000;
    this.maxWaitMs = config.maxWaitMs ?? 300_000;
    this.fetchImpl = config.fetchImpl ?? globalThis.fetch.bind(globalThis);
  }

  public async generateOpenWeightVideo(
    req: OpenWeightVideoRequest
  ): Promise<OpenWeightVideoResult> {
    const resolvedStartUrl = req.imageUrl
      ? (await resolveReferenceImageForCloud(req.imageUrl, { fetchImpl: this.fetchImpl }))
          .publicOrDataUrl
      : undefined;
    const resolvedEndUrl = req.lastFrameUrl
      ? (await resolveReferenceImageForCloud(req.lastFrameUrl, { fetchImpl: this.fetchImpl }))
          .publicOrDataUrl
      : undefined;

    const family: OpenWeightVideoModelFamily =
      req.family ||
      (resolvedStartUrl && resolvedEndUrl
        ? 'wan-2.1-flf2v'
        : resolvedStartUrl
          ? 'wan-2.1-i2v'
          : 'wan-2.1-t2v');

    const endpointId = (req.endpointOrModelId || FAL_OPEN_WEIGHT_ENDPOINTS[family]).replace(
      /^\/+/,
      ''
    );

    const inputPayload: Record<string, unknown> = {
      prompt: req.prompt,
      ...(req.negativePrompt ? { negative_prompt: req.negativePrompt } : {}),
      ...(req.aspectRatio ? { aspect_ratio: req.aspectRatio } : {}),
      ...(req.resolution ? { resolution: req.resolution } : {}),
      ...(req.numFrames ? { num_frames: req.numFrames } : {}),
      ...(req.fps ? { frames_per_second: req.fps } : {}),
      ...(typeof req.guidanceScale === 'number' ? { guidance_scale: req.guidanceScale } : {}),
      ...(typeof req.numInferenceSteps === 'number'
        ? { num_inference_steps: req.numInferenceSteps }
        : {}),
      ...(typeof req.seed === 'number' ? { seed: req.seed } : {}),
      ...(resolvedStartUrl
        ? family === 'wan-2.1-flf2v'
          ? { start_image_url: resolvedStartUrl }
          : { image_url: resolvedStartUrl }
        : {}),
      ...(resolvedEndUrl ? { end_image_url: resolvedEndUrl } : {}),
      ...(req.extraInput || {}),
    };

    const raw = await this.runQueued(endpointId, inputPayload, req.onQueueUpdate, req.signal);
    const videoObj = raw.video as Record<string, unknown> | undefined;
    const videoUrl =
      (videoObj?.url as string | undefined) ||
      (raw.video_url as string | undefined) ||
      (Array.isArray(raw.videos)
        ? ((raw.videos[0] as Record<string, unknown>)?.url as string | undefined)
        : undefined);

    if (!videoUrl) {
      throw new CloudPassThroughError(
        'fal',
        `Fal endpoint ${endpointId} completed without returning a video URL.`,
        undefined,
        raw
      );
    }

    return {
      provider: 'fal',
      modelId: endpointId,
      requestId: String(raw.request_id || `fal_${Date.now()}`),
      videoUrl,
      seed: typeof raw.seed === 'number' ? raw.seed : req.seed,
      rawResponse: raw,
    };
  }

  public async generateImage(req: {
    endpointId?: string;
    prompt: string;
    negativePrompt?: string;
    aspectRatio?: string;
    numImages?: number;
    referenceImages?: string[];
    seed?: number;
    signal?: AbortSignal;
  }): Promise<{
    provider: 'fal';
    modelId: string;
    imageUrl: string;
    imageUrls: string[];
    rawResponse: Record<string, unknown>;
  }> {
    const endpointId = (req.endpointId || 'fal-ai/flux-pro/v1.1').replace(/^\/+/, '');
    const resolvedRefs: string[] = [];
    for (const r of (req.referenceImages || []).slice(0, 4)) {
      const resolved = await resolveReferenceImageForCloud(r, { fetchImpl: this.fetchImpl });
      resolvedRefs.push(resolved.publicOrDataUrl);
    }

    const inputPayload: Record<string, unknown> = {
      prompt: req.prompt,
      ...(req.negativePrompt ? { negative_prompt: req.negativePrompt } : {}),
      ...(req.aspectRatio ? { aspect_ratio: req.aspectRatio } : {}),
      ...(req.numImages ? { num_images: req.numImages } : {}),
      ...(typeof req.seed === 'number' ? { seed: req.seed } : {}),
      ...(resolvedRefs.length > 0
        ? {
            image_url: resolvedRefs[0],
            image_urls: resolvedRefs,
          }
        : {}),
    };

    const raw = await this.runQueued(endpointId, inputPayload, undefined, req.signal);
    const imagesArr = Array.isArray(raw.images)
      ? (raw.images as Array<Record<string, unknown>>)
      : [];
    const urls = imagesArr
      .map((img) => String(img.url || '').trim())
      .filter(Boolean);
    const singleObj = raw.image as Record<string, unknown> | undefined;
    if (urls.length === 0 && typeof singleObj?.url === 'string') {
      urls.push(singleObj.url);
    }
    if (urls.length === 0 && typeof raw.image_url === 'string') {
      urls.push(raw.image_url);
    }

    if (urls.length === 0) {
      throw new CloudPassThroughError(
        'fal',
        `Fal image endpoint ${endpointId} completed without returning image URLs.`,
        undefined,
        raw
      );
    }

    return {
      provider: 'fal',
      modelId: endpointId,
      imageUrl: urls[0],
      imageUrls: urls,
      rawResponse: raw,
    };
  }

  public async removeBackground(
    imageUrl: string,
    signal?: AbortSignal
  ): Promise<{ foregroundPngUrl: string; maskUrl?: string; raw: Record<string, unknown> }> {
    const raw = await this.runSync(
      'fal-ai/birefnet/v2',
      {
        image_url: imageUrl,
        model: 'General Use (Heavy)',
        operating_resolution: '2048x2048',
        output_mask: true,
      },
      signal
    );

    const imageObj = raw.image as Record<string, unknown> | undefined;
    const maskObj = raw.mask_image as Record<string, unknown> | undefined;
    const foregroundPngUrl = (imageObj?.url as string | undefined) || '';
    if (!foregroundPngUrl) {
      throw new CloudPassThroughError('fal', 'BiRefNet did not return a foreground PNG URL.', undefined, raw);
    }

    return { foregroundPngUrl, maskUrl: maskObj?.url as string | undefined, raw };
  }

  public async runSync(
    endpointId: string,
    input: Record<string, unknown>,
    signal?: AbortSignal
  ): Promise<Record<string, unknown>> {
    return this.requestJson(`${this.syncBaseUrl}/${endpointId}`, 'POST', input, signal);
  }

  public async runQueued(
    endpointId: string,
    input: Record<string, unknown>,
    onQueueUpdate?: OpenWeightVideoRequest['onQueueUpdate'],
    signal?: AbortSignal
  ): Promise<Record<string, unknown>> {
    const submitRes = await this.requestJson(
      `${this.queueBaseUrl}/${endpointId}`,
      'POST',
      input,
      signal
    );
    if (submitRes.video || submitRes.video_url) return submitRes;

    const requestId = String(submitRes.request_id || '');
    const statusUrl =
      (submitRes.status_url as string | undefined) ||
      `${this.queueBaseUrl}/${endpointId}/requests/${encodeURIComponent(requestId)}/status`;
    const responseUrl =
      (submitRes.response_url as string | undefined) ||
      `${this.queueBaseUrl}/${endpointId}/requests/${encodeURIComponent(requestId)}`;

    const startedAt = Date.now();
    while (true) {
      if (signal?.aborted) throw new CloudPassThroughError('fal', 'Fal queue polling aborted.');
      if (Date.now() - startedAt > this.maxWaitMs) {
        throw new CloudPassThroughError(
          'fal',
          `Fal request ${requestId} timed out after ${this.maxWaitMs}ms.`
        );
      }

      const statusPayload = await this.requestJson(
        `${statusUrl}${statusUrl.includes('?') ? '&' : '?'}logs=1`,
        'GET',
        undefined,
        signal
      );

      const status = String(statusPayload.status || '').toUpperCase();
      const logs = Array.isArray(statusPayload.logs)
        ? (statusPayload.logs as Array<Record<string, unknown>>).map((l) => String(l.message || ''))
        : undefined;

      onQueueUpdate?.({
        status,
        queuePosition:
          typeof statusPayload.queue_position === 'number'
            ? statusPayload.queue_position
            : undefined,
        logs,
      });

      if (status === 'COMPLETED') {
        const finalResult = await this.requestJson(responseUrl, 'GET', undefined, signal);
        return { ...finalResult, request_id: requestId };
      }

      if (status === 'FAILED' || status === 'ERROR') {
        throw new CloudPassThroughError(
          'fal',
          `Fal job ${requestId} failed: ${JSON.stringify(statusPayload).slice(0, 280)}`,
          undefined,
          statusPayload
        );
      }

      await new Promise((resolve) => setTimeout(resolve, this.pollIntervalMs));
    }
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
        Authorization: `Key ${this.apiKey}`,
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
      throw new CloudPassThroughError(
        'fal',
        `Fal API error (${res.status}): ${String(parsed.detail || parsed.message || text).slice(0, 300)}`,
        res.status,
        parsed
      );
    }

    return parsed;
  }
}

export interface ReplicateClientConfig {
  apiToken: string;
  baseUrl?: string;
  pollIntervalMs?: number;
  maxWaitMs?: number;
  fetchImpl?: typeof fetch;
}

export class ReplicateClient {
  private readonly apiToken: string;
  private readonly baseUrl: string;
  private readonly pollIntervalMs: number;
  private readonly maxWaitMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(config: ReplicateClientConfig) {
    if (!config.apiToken || !config.apiToken.trim()) {
      throw new CloudPassThroughError(
        'replicate',
        'ReplicateClient requires a non-empty Replicate apiToken.'
      );
    }
    this.apiToken = config.apiToken.trim();
    this.baseUrl = (config.baseUrl || 'https://api.replicate.com/v1').replace(/\/+$/, '');
    this.pollIntervalMs = config.pollIntervalMs ?? 2500;
    this.maxWaitMs = config.maxWaitMs ?? 300_000;
    this.fetchImpl = config.fetchImpl ?? globalThis.fetch.bind(globalThis);
  }

  public async generateOpenWeightVideo(
    req: OpenWeightVideoRequest
  ): Promise<OpenWeightVideoResult> {
    const resolvedStartUrl = req.imageUrl
      ? (await resolveReferenceImageForCloud(req.imageUrl, { fetchImpl: this.fetchImpl }))
          .publicOrDataUrl
      : undefined;
    const resolvedEndUrl = req.lastFrameUrl
      ? (await resolveReferenceImageForCloud(req.lastFrameUrl, { fetchImpl: this.fetchImpl }))
          .publicOrDataUrl
      : undefined;

    const family: OpenWeightVideoModelFamily =
      req.family || (resolvedStartUrl ? 'wan-2.1-i2v' : 'wan-2.1-t2v');
    const modelSpec = req.endpointOrModelId || REPLICATE_OPEN_WEIGHT_MODELS[family];

    const input: Record<string, unknown> = {
      prompt: req.prompt,
      ...(req.negativePrompt ? { negative_prompt: req.negativePrompt } : {}),
      ...(resolvedStartUrl ? { image: resolvedStartUrl, start_image: resolvedStartUrl } : {}),
      ...(resolvedEndUrl ? { last_frame_image: resolvedEndUrl } : {}),
      ...(req.aspectRatio ? { aspect_ratio: req.aspectRatio } : {}),
      ...(req.numFrames ? { num_frames: req.numFrames } : {}),
      ...(req.fps ? { fps: req.fps } : {}),
      ...(typeof req.guidanceScale === 'number' ? { guidance_scale: req.guidanceScale } : {}),
      ...(typeof req.numInferenceSteps === 'number' ? { steps: req.numInferenceSteps } : {}),
      ...(typeof req.seed === 'number' ? { seed: req.seed } : {}),
      ...(req.extraInput || {}),
    };

    const hasVersion = modelSpec.includes(':');
    const createUrl = hasVersion
      ? `${this.baseUrl}/predictions`
      : `${this.baseUrl}/models/${modelSpec}/predictions`;
    const createBody: Record<string, unknown> = hasVersion
      ? { version: modelSpec.split(':')[1], input }
      : { input };

    let prediction = await this.requestJson(createUrl, 'POST', createBody, req.signal, {
      Prefer: 'wait=5',
    });

    const predictionId = String(prediction.id || `rep_${Date.now()}`);
    const pollUrl =
      ((prediction.urls as Record<string, unknown> | undefined)?.get as string | undefined) ||
      `${this.baseUrl}/predictions/${encodeURIComponent(predictionId)}`;

    const startedAt = Date.now();
    while (
      prediction.status === 'starting' ||
      prediction.status === 'processing' ||
      prediction.status === 'queued'
    ) {
      if (req.signal?.aborted) {
        throw new CloudPassThroughError('replicate', 'Replicate prediction polling aborted.');
      }
      if (Date.now() - startedAt > this.maxWaitMs) {
        throw new CloudPassThroughError(
          'replicate',
          `Replicate prediction ${predictionId} timed out after ${this.maxWaitMs}ms.`
        );
      }

      req.onQueueUpdate?.({
        status: String(prediction.status),
        logs: typeof prediction.logs === 'string' ? prediction.logs.split('\n') : undefined,
      });

      await new Promise((resolve) => setTimeout(resolve, this.pollIntervalMs));
      prediction = await this.requestJson(pollUrl, 'GET', undefined, req.signal);
    }

    if (prediction.status === 'failed' || prediction.status === 'canceled') {
      throw new CloudPassThroughError(
        'replicate',
        `Replicate prediction ${predictionId} ${String(prediction.status)}: ${String(prediction.error || 'Unknown error')}`,
        undefined,
        prediction
      );
    }

    const output = prediction.output;
    const videoUrl =
      typeof output === 'string'
        ? output
        : Array.isArray(output) && typeof output[0] === 'string'
          ? output[0]
          : typeof (output as Record<string, unknown> | undefined)?.video === 'string'
            ? ((output as Record<string, unknown>).video as string)
            : '';

    if (!videoUrl) {
      throw new CloudPassThroughError(
        'replicate',
        `Replicate prediction ${predictionId} succeeded without an output video URL.`,
        undefined,
        prediction
      );
    }

    return {
      provider: 'replicate',
      modelId: modelSpec,
      requestId: predictionId,
      videoUrl,
      seed: req.seed,
      rawResponse: prediction,
    };
  }

  public async generateImage(req: {
    modelSpec?: string;
    prompt: string;
    aspectRatio?: string;
    referenceImages?: string[];
    seed?: number;
    signal?: AbortSignal;
  }): Promise<{
    provider: 'replicate';
    modelId: string;
    imageUrl: string;
    imageUrls: string[];
    rawResponse: Record<string, unknown>;
  }> {
    const modelSpec = req.modelSpec || 'black-forest-labs/flux-1.1-pro';
    const resolvedRef = req.referenceImages?.[0]
      ? (await resolveReferenceImageForCloud(req.referenceImages[0], { fetchImpl: this.fetchImpl }))
          .publicOrDataUrl
      : undefined;

    const input: Record<string, unknown> = {
      prompt: req.prompt,
      aspect_ratio: req.aspectRatio || '16:9',
      output_format: 'png',
      ...(resolvedRef ? { image_prompt: resolvedRef, image: resolvedRef } : {}),
      ...(typeof req.seed === 'number' ? { seed: req.seed } : {}),
    };

    const hasVersion = modelSpec.includes(':');
    const createUrl = hasVersion
      ? `${this.baseUrl}/predictions`
      : `${this.baseUrl}/models/${modelSpec}/predictions`;
    const createBody: Record<string, unknown> = hasVersion
      ? { version: modelSpec.split(':')[1], input }
      : { input };

    let prediction = await this.requestJson(createUrl, 'POST', createBody, req.signal, {
      Prefer: 'wait=15',
    });
    const predictionId = String(prediction.id || `rep_img_${Date.now()}`);
    const pollUrl =
      ((prediction.urls as Record<string, unknown> | undefined)?.get as string | undefined) ||
      `${this.baseUrl}/predictions/${encodeURIComponent(predictionId)}`;

    const startedAt = Date.now();
    while (
      prediction.status === 'starting' ||
      prediction.status === 'processing' ||
      prediction.status === 'queued'
    ) {
      if (req.signal?.aborted) {
        throw new CloudPassThroughError('replicate', 'Replicate image polling aborted.');
      }
      if (Date.now() - startedAt > this.maxWaitMs) {
        throw new CloudPassThroughError(
          'replicate',
          `Replicate image prediction ${predictionId} timed out after ${this.maxWaitMs}ms.`
        );
      }
      await new Promise((resolve) => setTimeout(resolve, this.pollIntervalMs));
      prediction = await this.requestJson(pollUrl, 'GET', undefined, req.signal);
    }

    if (prediction.status === 'failed' || prediction.status === 'canceled') {
      throw new CloudPassThroughError(
        'replicate',
        `Replicate image prediction ${predictionId} ${String(prediction.status)}: ${String(prediction.error || 'Unknown error')}`,
        undefined,
        prediction
      );
    }

    const output = prediction.output;
    const urls =
      typeof output === 'string'
        ? [output]
        : Array.isArray(output)
          ? output.map((u) => String(u || '').trim()).filter(Boolean)
          : [];

    if (urls.length === 0) {
      throw new CloudPassThroughError(
        'replicate',
        `Replicate image prediction ${predictionId} completed without output URLs.`,
        undefined,
        prediction
      );
    }

    return {
      provider: 'replicate',
      modelId: modelSpec,
      imageUrl: urls[0],
      imageUrls: urls,
      rawResponse: prediction,
    };
  }

  public async cancelPrediction(predictionId: string): Promise<Record<string, unknown>> {
    return this.requestJson(
      `${this.baseUrl}/predictions/${encodeURIComponent(predictionId)}/cancel`,
      'POST'
    );
  }

  private async requestJson(
    url: string,
    method: 'GET' | 'POST',
    body?: Record<string, unknown>,
    signal?: AbortSignal,
    extraHeaders?: Record<string, string>
  ): Promise<Record<string, unknown>> {
    const res = await this.fetchImpl(url, {
      method,
      headers: {
        Authorization: `Bearer ${this.apiToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(extraHeaders || {}),
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
      throw new CloudPassThroughError(
        'replicate',
        `Replicate API error (${res.status}): ${String(parsed.detail || parsed.error || text).slice(0, 300)}`,
        res.status,
        parsed
      );
    }

    return parsed;
  }
}
