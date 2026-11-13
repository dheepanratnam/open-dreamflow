/**
 * @open-dreamflow/provider-sdk — Official Higgsfield Cloud API Client
 * Supports `https://platform.higgsfield.ai/v1/...` with `Authorization: Bearer ...` / `hf-api-key`
 * and clean HTTP error propagation for image & image-to-video generation.
 */

import { resolveReferenceImageForCloud } from './reference-utils.js';

export const HIGGSFIELD_DEFAULT_BASE_URL = 'https://platform.higgsfield.ai/v1';

export interface HiggsfieldClientConfig {
  apiKey: string;
  secretKey?: string;
  baseUrl?: string;
  pollIntervalMs?: number;
  maxWaitMs?: number;
  mediaDir?: string;
  fetchImpl?: typeof fetch;
}

export interface HiggsfieldGenerationRequest {
  modality: 'image' | 'video';
  model?: string;
  prompt: string;
  negativePrompt?: string;
  aspectRatio?: string;
  resolution?: string;
  durationSeconds?: number;
  batchSize?: number;
  referenceImages?: string[];
  signal?: AbortSignal;
}

export interface HiggsfieldGenerationResult {
  provider: 'higgsfield';
  model: string;
  jobId: string;
  mediaUrl: string;
  outputs: string[];
  rawResponse: Record<string, unknown>;
}

export class HiggsfieldApiError extends Error {
  public readonly statusCode?: number;
  public readonly errorBody?: unknown;

  constructor(message: string, statusCode?: number, errorBody?: unknown) {
    super(message);
    this.name = 'HiggsfieldApiError';
    this.statusCode = statusCode;
    this.errorBody = errorBody;
  }
}

export class HiggsfieldClient {
  private readonly apiKey: string;
  private readonly secretKey?: string;
  private readonly baseUrl: string;
  private readonly pollIntervalMs: number;
  private readonly maxWaitMs: number;
  private readonly mediaDir?: string;
  private readonly fetchImpl: typeof fetch;

  constructor(config: HiggsfieldClientConfig) {
    if (!config.apiKey || !config.apiKey.trim()) {
      throw new HiggsfieldApiError('HiggsfieldClient requires a non-empty Higgsfield API key.');
    }
    this.apiKey = config.apiKey.trim();
    this.secretKey = config.secretKey?.trim() || undefined;
    this.baseUrl = (config.baseUrl || HIGGSFIELD_DEFAULT_BASE_URL).replace(/\/+$/, '');
    this.pollIntervalMs = config.pollIntervalMs ?? 2500;
    this.maxWaitMs = config.maxWaitMs ?? 300_000;
    this.mediaDir = config.mediaDir;
    this.fetchImpl = config.fetchImpl ?? globalThis.fetch.bind(globalThis);
  }

  private buildHeaders(): Record<string, string> {
    const authToken =
      this.secretKey && !this.apiKey.includes(':')
        ? `Key ${this.apiKey}:${this.secretKey}`
        : `Bearer ${this.apiKey}`;
    return {
      Authorization: authToken,
      'hf-api-key': this.apiKey,
      ...(this.secretKey ? { 'hf-secret': this.secretKey } : {}),
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
  }

  public async verifyAccount(signal?: AbortSignal): Promise<{ ok: boolean; endpoint: string }> {
    const res = await this.fetchImpl(`${this.baseUrl}/user`, {
      method: 'GET',
      headers: this.buildHeaders(),
      signal,
    });
    const parsed = await this.parseJson(res);
    if (!res.ok) {
      throw new HiggsfieldApiError(
        `Higgsfield API verification failed (${res.status}): ${this.extractErrorMessage(parsed)}`,
        res.status,
        parsed
      );
    }
    return { ok: true, endpoint: this.baseUrl };
  }

  public async generate(req: HiggsfieldGenerationRequest): Promise<HiggsfieldGenerationResult> {
    const model =
      req.model || (req.modality === 'video' ? 'higgsfield-dop-i2v' : 'chatgpt-image-2.6');
    const prompt = String(req.prompt || '').trim();
    if (!prompt) {
      throw new HiggsfieldApiError('Prompt is required for Higgsfield generation.');
    }

    const resolvedRefs: string[] = [];
    for (const ref of (req.referenceImages || []).slice(0, 6)) {
      const resolved = await resolveReferenceImageForCloud(ref, {
        mediaDir: this.mediaDir,
        fetchImpl: this.fetchImpl,
      });
      resolvedRefs.push(resolved.publicOrDataUrl);
    }

    const endpoint =
      req.modality === 'video'
        ? `${this.baseUrl}/generations/video`
        : `${this.baseUrl}/generations/text2image`;

    const params: Record<string, unknown> = {
      model,
      prompt,
      ...(req.negativePrompt ? { negative_prompt: req.negativePrompt } : {}),
      aspect_ratio: req.aspectRatio || '16:9',
      ...(req.resolution ? { resolution: req.resolution } : {}),
      ...(req.modality === 'video' && req.durationSeconds
        ? { duration: req.durationSeconds }
        : {}),
      ...(req.batchSize ? { batch_size: req.batchSize } : {}),
      ...(resolvedRefs.length > 0
        ? {
            image_url: resolvedRefs[0],
            input_images: resolvedRefs.map((url) => ({ type: 'image_url', image_url: url })),
          }
        : {}),
    };

    const submitRes = await this.fetchImpl(endpoint, {
      method: 'POST',
      headers: this.buildHeaders(),
      body: JSON.stringify({ params, ...params }),
      signal: req.signal,
    });
    const submitted = await this.parseJson(submitRes);
    if (!submitRes.ok) {
      throw new HiggsfieldApiError(
        `Higgsfield API (${model}) failed (${submitRes.status}): ${this.extractErrorMessage(submitted)}`,
        submitRes.status,
        submitted
      );
    }

    const directUrls = this.extractOutputUrls(submitted);
    const jobId = String(submitted.id || submitted.job_set_id || `hf_${Date.now()}`);
    if (directUrls.length > 0) {
      return {
        provider: 'higgsfield',
        model,
        jobId,
        mediaUrl: directUrls[0],
        outputs: directUrls,
        rawResponse: submitted,
      };
    }

    const statusUrl =
      typeof submitted.status_url === 'string'
        ? submitted.status_url
        : `${this.baseUrl}/job-sets/${encodeURIComponent(jobId)}`;

    const startedAt = Date.now();
    while (true) {
      if (req.signal?.aborted) {
        throw new HiggsfieldApiError('Higgsfield job polling aborted.');
      }
      if (Date.now() - startedAt > this.maxWaitMs) {
        throw new HiggsfieldApiError(
          `Higgsfield job ${jobId} timed out after ${this.maxWaitMs}ms.`
        );
      }

      await new Promise((r) => setTimeout(r, this.pollIntervalMs));

      const pollRes = await this.fetchImpl(statusUrl, {
        method: 'GET',
        headers: this.buildHeaders(),
        signal: req.signal,
      });
      const polled = await this.parseJson(pollRes);
      if (!pollRes.ok) {
        throw new HiggsfieldApiError(
          `Higgsfield job poll (${pollRes.status}): ${this.extractErrorMessage(polled)}`,
          pollRes.status,
          polled
        );
      }

      const urls = this.extractOutputUrls(polled);
      const status = String(polled.status || '').toLowerCase();
      if (urls.length > 0 || status === 'completed' || status === 'succeeded') {
        if (urls.length === 0) {
          throw new HiggsfieldApiError(
            `Higgsfield job ${jobId} completed without output URLs.`,
            undefined,
            polled
          );
        }
        return {
          provider: 'higgsfield',
          model,
          jobId,
          mediaUrl: urls[0],
          outputs: urls,
          rawResponse: polled,
        };
      }

      if (status === 'failed' || status === 'error' || status === 'nsfw') {
        throw new HiggsfieldApiError(
          `Higgsfield job ${jobId} failed: ${this.extractErrorMessage(polled)}`,
          undefined,
          polled
        );
      }
    }
  }

  private extractOutputUrls(obj: Record<string, unknown>): string[] {
    const urls: string[] = [];
    if (typeof obj.url === 'string' && obj.url.startsWith('http')) urls.push(obj.url);
    if (typeof obj.video_url === 'string') urls.push(obj.video_url);
    if (typeof obj.image_url === 'string') urls.push(obj.image_url);
    if (Array.isArray(obj.images)) {
      for (const item of obj.images as Array<Record<string, unknown> | string>) {
        if (typeof item === 'string') urls.push(item);
        else if (typeof item?.url === 'string') urls.push(item.url);
      }
    }
    if (Array.isArray(obj.jobs)) {
      for (const job of obj.jobs as Array<Record<string, unknown>>) {
        const results = job.results as Record<string, unknown> | undefined;
        const raw = results?.raw as Record<string, unknown> | undefined;
        if (typeof raw?.url === 'string') urls.push(raw.url);
        if (typeof job.url === 'string') urls.push(job.url);
      }
    }
    return urls.filter(Boolean);
  }

  private async parseJson(res: Response): Promise<Record<string, unknown>> {
    const text = await res.text();
    if (!text) return {};
    try {
      return JSON.parse(text) as Record<string, unknown>;
    } catch {
      return { rawText: text };
    }
  }

  private extractErrorMessage(parsed: Record<string, unknown>): string {
    const detail = parsed.detail;
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail) && detail[0]) return JSON.stringify(detail[0]).slice(0, 260);
    const err = parsed.error as Record<string, unknown> | string | undefined;
    if (typeof err === 'string') return err;
    if (err && typeof err.message === 'string') return err.message;
    if (typeof parsed.message === 'string') return parsed.message;
    if (typeof parsed.rawText === 'string') return parsed.rawText.slice(0, 280);
    return JSON.stringify(parsed).slice(0, 280);
  }
}
