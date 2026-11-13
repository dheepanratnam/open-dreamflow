/**
 * @open-dreamflow/provider-sdk — Official OpenAI Direct Zero-Markup REST Client
 * Supports `POST https://api.openai.com/v1/images/generations` (`gpt-image-1`),
 * reference-guided `/v1/images/edits`, and `/v1/videos` (`sora-2`).
 */

import { resolveReferenceImageForCloud } from './reference-utils.js';

export const OPENAI_DEFAULT_BASE_URL = 'https://api.openai.com/v1';

export interface OpenAIClientConfig {
  apiKey: string;
  baseUrl?: string;
  pollIntervalMs?: number;
  maxWaitMs?: number;
  mediaDir?: string;
  fetchImpl?: typeof fetch;
}

export interface OpenAIImageRequest {
  model?: string;
  prompt: string;
  aspectRatio?: string;
  quality?: 'low' | 'medium' | 'high' | 'auto';
  n?: number;
  referenceImages?: string[];
  signal?: AbortSignal;
}

export interface OpenAIImageResult {
  provider: 'openai';
  model: string;
  imageBase64?: string;
  imageUrl?: string;
  mimeType: string;
  outputs: Array<{ b64_json?: string; url?: string }>;
  rawResponse: Record<string, unknown>;
}

export interface OpenAIVideoRequest {
  model?: string;
  prompt: string;
  aspectRatio?: string;
  durationSeconds?: number;
  referenceImages?: string[];
  signal?: AbortSignal;
}

export interface OpenAIVideoResult {
  provider: 'openai';
  model: string;
  videoBytes?: Uint8Array;
  videoUrl?: string;
  mimeType: string;
  rawResponse: Record<string, unknown>;
}

export class OpenAIApiError extends Error {
  public readonly statusCode?: number;
  public readonly errorBody?: unknown;

  constructor(message: string, statusCode?: number, errorBody?: unknown) {
    super(message);
    this.name = 'OpenAIApiError';
    this.statusCode = statusCode;
    this.errorBody = errorBody;
  }
}

function mapAspectRatioToOpenAISize(aspectRatio?: string): string {
  switch (aspectRatio) {
    case '16:9':
    case '21:9':
    case '4:3':
      return '1536x1024';
    case '9:16':
    case '3:4':
      return '1024x1536';
    case '1:1':
    default:
      return '1024x1024';
  }
}

export class OpenAIClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly pollIntervalMs: number;
  private readonly maxWaitMs: number;
  private readonly mediaDir?: string;
  private readonly fetchImpl: typeof fetch;

  constructor(config: OpenAIClientConfig) {
    if (!config.apiKey || !config.apiKey.trim()) {
      throw new OpenAIApiError('OpenAIClient requires a non-empty OpenAI API key.');
    }
    this.apiKey = config.apiKey.trim();
    this.baseUrl = (config.baseUrl || OPENAI_DEFAULT_BASE_URL).replace(/\/+$/, '');
    this.pollIntervalMs = config.pollIntervalMs ?? 3000;
    this.maxWaitMs = config.maxWaitMs ?? 300_000;
    this.mediaDir = config.mediaDir;
    this.fetchImpl = config.fetchImpl ?? globalThis.fetch.bind(globalThis);
  }

  public async verifyAccount(
    signal?: AbortSignal
  ): Promise<{ ok: boolean; models: string[] }> {
    const res = await this.fetchImpl(`${this.baseUrl}/models`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        Accept: 'application/json',
      },
      signal,
    });

    const parsed = await this.parseJson(res);
    if (!res.ok) {
      throw new OpenAIApiError(
        `OpenAI verification failed (${res.status}): ${this.extractErrorMessage(parsed)}`,
        res.status,
        parsed
      );
    }

    const list = Array.isArray(parsed.data)
      ? (parsed.data as Array<{ id?: string }>).map((m) => String(m.id || '')).filter(Boolean)
      : [];
    return {
      ok: true,
      models: list.filter((id) => /gpt-image|dall-e|sora/i.test(id)).slice(0, 20),
    };
  }

  public async generateImage(req: OpenAIImageRequest): Promise<OpenAIImageResult> {
    const model = (req.model || 'gpt-image-1').trim();
    const prompt = String(req.prompt || '').trim();
    if (!prompt) {
      throw new OpenAIApiError('Prompt is required for OpenAI image generation.');
    }

    const size = mapAspectRatioToOpenAISize(req.aspectRatio);
    const n = Math.max(1, Math.min(4, req.n ?? 1));
    const refs = (req.referenceImages || []).filter(Boolean);

    let parsed: Record<string, unknown>;

    if (refs.length > 0 && model.startsWith('gpt-image')) {
      const form = new FormData();
      form.append('model', model);
      form.append('prompt', prompt);
      form.append('size', size);
      form.append('n', String(n));

      for (let i = 0; i < Math.min(4, refs.length); i++) {
        const resolved = await resolveReferenceImageForCloud(refs[i], {
          mediaDir: this.mediaDir,
          preferDataUriEvenForRemote: true,
          fetchImpl: this.fetchImpl,
        });
        const bytes =
          typeof Buffer !== 'undefined'
            ? new Uint8Array(Buffer.from(resolved.base64Data, 'base64'))
            : Uint8Array.from(atob(resolved.base64Data), (c) => c.charCodeAt(0));
        const ext = resolved.mimeType.includes('jpeg')
          ? 'jpg'
          : resolved.mimeType.includes('webp')
            ? 'webp'
            : 'png';
        form.append(
          'image[]',
          new Blob([bytes], { type: resolved.mimeType }),
          `ref_${i + 1}.${ext}`
        );
      }

      const res = await this.fetchImpl(`${this.baseUrl}/images/edits`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: form,
        signal: req.signal,
      });
      parsed = await this.parseJson(res);
      if (!res.ok) {
        throw new OpenAIApiError(
          `OpenAI Images Edit (${model}) failed (${res.status}): ${this.extractErrorMessage(parsed)}`,
          res.status,
          parsed
        );
      }
    } else {
      const payload: Record<string, unknown> = {
        model,
        prompt,
        size,
        n,
      };
      if (req.quality && model.startsWith('gpt-image')) {
        payload.quality = req.quality;
      }

      const res = await this.fetchImpl(`${this.baseUrl}/images/generations`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(payload),
        signal: req.signal,
      });
      parsed = await this.parseJson(res);
      if (!res.ok) {
        throw new OpenAIApiError(
          `OpenAI Images (${model}) failed (${res.status}): ${this.extractErrorMessage(parsed)}`,
          res.status,
          parsed
        );
      }
    }

    const dataArr = Array.isArray(parsed.data)
      ? (parsed.data as Array<{ b64_json?: string; url?: string }>)
      : [];
    const first = dataArr[0];
    if (!first || (!first.b64_json && !first.url)) {
      throw new OpenAIApiError(
        `OpenAI Images (${model}) returned no image data.`,
        undefined,
        parsed
      );
    }

    return {
      provider: 'openai',
      model,
      imageBase64: first.b64_json,
      imageUrl: first.url,
      mimeType: 'image/png',
      outputs: dataArr,
      rawResponse: parsed,
    };
  }

  public async generateVideo(req: OpenAIVideoRequest): Promise<OpenAIVideoResult> {
    const model = (req.model || 'sora-2').trim();
    const prompt = String(req.prompt || '').trim();
    if (!prompt) {
      throw new OpenAIApiError('Prompt is required for OpenAI Sora video generation.');
    }

    const seconds = req.durationSeconds && req.durationSeconds >= 10 ? '12' : req.durationSeconds && req.durationSeconds >= 6 ? '8' : '4';
    const size = req.aspectRatio === '9:16' ? '720x1280' : '1280x720';

    const createRes = await this.fetchImpl(`${this.baseUrl}/videos`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        model,
        prompt,
        size,
        seconds,
      }),
      signal: req.signal,
    });

    const created = await this.parseJson(createRes);
    if (!createRes.ok) {
      throw new OpenAIApiError(
        `OpenAI Video (${model}) failed (${createRes.status}): ${this.extractErrorMessage(created)}`,
        createRes.status,
        created
      );
    }

    const videoId = String(created.id || '');
    if (!videoId) {
      throw new OpenAIApiError(`OpenAI Video (${model}) returned no job id.`, undefined, created);
    }

    const startedAt = Date.now();
    let current = created;
    while (
      current.status === 'queued' ||
      current.status === 'in_progress' ||
      current.status === 'processing'
    ) {
      if (req.signal?.aborted) {
        throw new OpenAIApiError('OpenAI Sora video polling aborted.');
      }
      if (Date.now() - startedAt > this.maxWaitMs) {
        throw new OpenAIApiError(`OpenAI Sora video ${videoId} timed out after ${this.maxWaitMs}ms.`);
      }
      await new Promise((r) => setTimeout(r, this.pollIntervalMs));
      const pollRes = await this.fetchImpl(
        `${this.baseUrl}/videos/${encodeURIComponent(videoId)}`,
        {
          method: 'GET',
          headers: { Authorization: `Bearer ${this.apiKey}` },
          signal: req.signal,
        }
      );
      current = await this.parseJson(pollRes);
      if (!pollRes.ok) {
        throw new OpenAIApiError(
          `OpenAI Video poll (${pollRes.status}): ${this.extractErrorMessage(current)}`,
          pollRes.status,
          current
        );
      }
    }

    if (current.status === 'failed' || current.error) {
      throw new OpenAIApiError(
        `OpenAI Video ${videoId} failed: ${this.extractErrorMessage(current)}`,
        undefined,
        current
      );
    }

    const dlRes = await this.fetchImpl(
      `${this.baseUrl}/videos/${encodeURIComponent(videoId)}/content`,
      {
        method: 'GET',
        headers: { Authorization: `Bearer ${this.apiKey}` },
        signal: req.signal,
      }
    );
    if (!dlRes.ok) {
      const errBody = await this.parseJson(dlRes);
      throw new OpenAIApiError(
        `OpenAI Video download failed (${dlRes.status}): ${this.extractErrorMessage(errBody)}`,
        dlRes.status,
        errBody
      );
    }

    return {
      provider: 'openai',
      model,
      videoBytes: new Uint8Array(await dlRes.arrayBuffer()),
      mimeType: dlRes.headers.get('content-type')?.split(';')[0]?.trim() || 'video/mp4',
      rawResponse: current,
    };
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
    const err = parsed.error as Record<string, unknown> | string | undefined;
    if (typeof err === 'string') return err;
    if (err && typeof err.message === 'string') return err.message;
    if (typeof parsed.message === 'string') return parsed.message;
    if (typeof parsed.rawText === 'string') return parsed.rawText.slice(0, 300);
    return JSON.stringify(parsed).slice(0, 300);
  }
}
