/**
 * @open-dreamflow/provider-sdk — Official Kling AI Zero-Markup REST Client
 * Supports HS256 JWT signing (`accessKey` + `secretKey`) OR direct `Bearer` token,
 * `/v1/videos/image2video`, `/v1/videos/text2video`, and `/v1/images/generations`.
 */

import { resolveReferenceImageForCloud, stripDataUriPrefix } from './reference-utils.js';

export const KLING_DEFAULT_BASE_URL = 'https://api.klingai.com';

export interface KlingClientConfig {
  accessKey?: string;
  secretKey?: string;
  apiKey?: string;
  baseUrl?: string;
  pollIntervalMs?: number;
  maxWaitMs?: number;
  mediaDir?: string;
  fetchImpl?: typeof fetch;
}

export interface KlingVideoRequest {
  model?: string;
  prompt: string;
  negativePrompt?: string;
  referenceImages?: string[];
  endImageUrl?: string;
  aspectRatio?: '16:9' | '9:16' | '1:1';
  durationSeconds?: number;
  mode?: 'std' | 'pro';
  cfgScale?: number;
  sound?: boolean;
  onProgress?: (status: { taskId: string; status: string }) => void;
  signal?: AbortSignal;
}

export interface KlingVideoResult {
  provider: 'kling';
  model: string;
  taskId: string;
  videoUrl: string;
  durationSeconds?: number;
  rawResponse: Record<string, unknown>;
}

export interface KlingImageRequest {
  model?: string;
  prompt: string;
  negativePrompt?: string;
  referenceImages?: string[];
  aspectRatio?: string;
  n?: number;
  onProgress?: (status: { taskId: string; status: string }) => void;
  signal?: AbortSignal;
}

export interface KlingImageResult {
  provider: 'kling';
  model: string;
  taskId: string;
  imageUrl: string;
  imageUrls: string[];
  rawResponse: Record<string, unknown>;
}

export class KlingApiError extends Error {
  public readonly statusCode?: number;
  public readonly errorBody?: unknown;

  constructor(message: string, statusCode?: number, errorBody?: unknown) {
    super(message);
    this.name = 'KlingApiError';
    this.statusCode = statusCode;
    this.errorBody = errorBody;
  }
}

function toBase64Url(bytes: Uint8Array | string): string {
  const b64 =
    typeof bytes === 'string'
      ? typeof Buffer !== 'undefined'
        ? Buffer.from(bytes, 'utf8').toString('base64')
        : btoa(unescape(encodeURIComponent(bytes)))
      : typeof Buffer !== 'undefined'
        ? Buffer.from(bytes).toString('base64')
        : btoa(String.fromCharCode(...bytes));
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

/**
 * Signs an official Kling API HS256 JWT token from `accessKey` + `secretKey`
 * using standard Web Crypto (`crypto.subtle`, supported in Node 20/22+ & browsers).
 */
export async function signKlingJwtHs256(
  accessKey: string,
  secretKey: string,
  nowEpochSeconds = Math.floor(Date.now() / 1000)
): Promise<string> {
  const header = toBase64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = toBase64Url(
    JSON.stringify({
      iss: accessKey.trim(),
      exp: nowEpochSeconds + 1800,
      nbf: nowEpochSeconds - 5,
    })
  );
  const signingInput = `${header}.${payload}`;

  if (globalThis.crypto?.subtle) {
    const enc = new TextEncoder();
    const cryptoKey = await globalThis.crypto.subtle.importKey(
      'raw',
      enc.encode(secretKey.trim()),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const sigBuf = await globalThis.crypto.subtle.sign(
      'HMAC',
      cryptoKey,
      enc.encode(signingInput)
    );
    return `${signingInput}.${toBase64Url(new Uint8Array(sigBuf))}`;
  }

  const nodeCrypto = await import('node:crypto');
  const sig = nodeCrypto
    .createHmac('sha256', secretKey.trim())
    .update(signingInput)
    .digest();
  return `${signingInput}.${toBase64Url(new Uint8Array(sig))}`;
}

const KLING_VIDEO_MODEL_MAP: Record<string, string> = {
  'kling-4.0': 'kling-v2-master',
  'kling-3.0-master': 'kling-v2-master',
  'kling-2.6-pro': 'kling-v1-6',
  'kling-elements': 'kling-v1-6',
};

const KLING_IMAGE_MODEL_MAP: Record<string, string> = {
  'kolors-2.0': 'kling-v2',
  'kling-image-o1': 'kling-v1-5',
};

export class KlingClient {
  private readonly accessKey?: string;
  private readonly secretKey?: string;
  private readonly bearerToken?: string;
  private readonly baseUrl: string;
  private readonly pollIntervalMs: number;
  private readonly maxWaitMs: number;
  private readonly mediaDir?: string;
  private readonly fetchImpl: typeof fetch;

  constructor(config: KlingClientConfig) {
    let ak = config.accessKey?.trim() || '';
    let sk = config.secretKey?.trim() || '';
    const single = config.apiKey?.trim() || '';

    if ((!ak || !sk) && single.includes(':') && !single.startsWith('eyJ')) {
      const idx = single.indexOf(':');
      ak = ak || single.slice(0, idx).trim();
      sk = sk || single.slice(idx + 1).trim();
    }

    if (ak && sk) {
      this.accessKey = ak;
      this.secretKey = sk;
    } else if (single || ak) {
      this.bearerToken = single || ak;
    } else {
      throw new KlingApiError(
        'KlingClient requires either (accessKey + secretKey) or a non-empty Bearer apiKey.'
      );
    }

    this.baseUrl = (config.baseUrl || KLING_DEFAULT_BASE_URL).replace(/\/+$/, '');
    this.pollIntervalMs = config.pollIntervalMs ?? 3000;
    this.maxWaitMs = config.maxWaitMs ?? 300_000;
    this.mediaDir = config.mediaDir;
    this.fetchImpl = config.fetchImpl ?? globalThis.fetch.bind(globalThis);
  }

  public async getBearerToken(): Promise<string> {
    if (this.accessKey && this.secretKey) {
      return signKlingJwtHs256(this.accessKey, this.secretKey);
    }
    return this.bearerToken || '';
  }

  public async verifyAccount(
    signal?: AbortSignal
  ): Promise<{ ok: boolean; authMode: 'jwt' | 'bearer'; models: string[] }> {
    await this.requestJson(
      `${this.baseUrl}/v1/videos/text2video?pageNum=1&pageSize=1`,
      'GET',
      undefined,
      signal
    );
    return {
      ok: true,
      authMode: this.accessKey && this.secretKey ? 'jwt' : 'bearer',
      models: ['kling-4.0', 'kling-3.0-master', 'kling-2.6-pro', 'kling-elements', 'kolors-2.0'],
    };
  }

  private async prepareKlingImageField(rawRef: string): Promise<string> {
    const resolved = await resolveReferenceImageForCloud(rawRef, {
      mediaDir: this.mediaDir,
      fetchImpl: this.fetchImpl,
    });
    // Kling Official REST API accepts either a public https:// URL or raw base64 WITHOUT `data:image/...;base64,`
    if (resolved.publicOrDataUrl.startsWith('data:')) {
      return stripDataUriPrefix(resolved.publicOrDataUrl).base64Data;
    }
    return resolved.publicOrDataUrl;
  }

  public async generateVideo(req: KlingVideoRequest): Promise<KlingVideoResult> {
    const requestedModel = req.model || 'kling-4.0';
    const apiModelName = KLING_VIDEO_MODEL_MAP[requestedModel] || requestedModel;
    const refs = (req.referenceImages || []).filter(Boolean);
    const hasRef = refs.length > 0;

    const durationStr = (req.durationSeconds && req.durationSeconds >= 10 ? '10' : '5') as
      | '5'
      | '10';
    const aspectRatio =
      req.aspectRatio === '9:16' || req.aspectRatio === '1:1' ? req.aspectRatio : '16:9';

    let endpointPath = '/v1/videos/text2video';
    const payload: Record<string, unknown> = {
      model_name: apiModelName,
      prompt: req.prompt,
      ...(req.negativePrompt ? { negative_prompt: req.negativePrompt } : {}),
      duration: durationStr,
      mode: req.mode || 'pro',
      cfg_scale: req.cfgScale ?? 0.5,
    };

    if (hasRef && (requestedModel === 'kling-elements' || refs.length > 1) && refs.length >= 2) {
      endpointPath = '/v1/videos/multi-image2video';
      const imageList: Array<{ image: string }> = [];
      for (const r of refs.slice(0, 4)) {
        imageList.push({ image: await this.prepareKlingImageField(r) });
      }
      payload.image_list = imageList;
      payload.aspect_ratio = aspectRatio;
    } else if (hasRef) {
      endpointPath = '/v1/videos/image2video';
      payload.image = await this.prepareKlingImageField(refs[0]);
      if (req.endImageUrl || refs[1]) {
        payload.image_tail = await this.prepareKlingImageField(req.endImageUrl || refs[1]);
      }
    } else {
      payload.aspect_ratio = aspectRatio;
    }

    const created = await this.requestJson(
      `${this.baseUrl}${endpointPath}`,
      'POST',
      payload,
      req.signal
    );

    const dataObj = (created.data || created) as Record<string, unknown>;
    const taskId = String(dataObj.task_id || dataObj.id || '');
    if (!taskId) {
      throw new KlingApiError(
        `Kling ${endpointPath} did not return a task_id.`,
        undefined,
        created
      );
    }

    const startedAt = Date.now();
    while (true) {
      if (req.signal?.aborted) {
        throw new KlingApiError('Kling video polling aborted by caller.');
      }
      if (Date.now() - startedAt > this.maxWaitMs) {
        throw new KlingApiError(`Kling task ${taskId} timed out after ${this.maxWaitMs}ms.`);
      }

      await new Promise((resolve) => setTimeout(resolve, this.pollIntervalMs));

      const pollResp = await this.requestJson(
        `${this.baseUrl}${endpointPath}/${encodeURIComponent(taskId)}`,
        'GET',
        undefined,
        req.signal
      );
      const pollData = (pollResp.data || pollResp) as Record<string, unknown>;
      const status = String(pollData.task_status || pollData.status || '').toLowerCase();
      req.onProgress?.({ taskId, status });

      if (status === 'succeed' || status === 'succeeded' || status === 'completed') {
        const taskResult = (pollData.task_result || {}) as Record<string, unknown>;
        const videos = Array.isArray(taskResult.videos)
          ? (taskResult.videos as Array<Record<string, unknown>>)
          : [];
        const videoUrl = String(videos[0]?.url || pollData.video_url || '').trim();
        if (!videoUrl) {
          throw new KlingApiError(
            `Kling task ${taskId} succeeded without returning a video URL.`,
            undefined,
            pollResp
          );
        }
        return {
          provider: 'kling',
          model: requestedModel,
          taskId,
          videoUrl,
          durationSeconds: Number(videos[0]?.duration || durationStr),
          rawResponse: pollResp,
        };
      }

      if (status === 'failed' || status === 'error') {
        throw new KlingApiError(
          `Kling task ${taskId} failed: ${String(pollData.task_status_msg || 'Unknown error')}`,
          undefined,
          pollResp
        );
      }
    }
  }

  public async generateImage(req: KlingImageRequest): Promise<KlingImageResult> {
    const requestedModel = req.model || 'kolors-2.0';
    const apiModelName = KLING_IMAGE_MODEL_MAP[requestedModel] || requestedModel;
    const refs = (req.referenceImages || []).filter(Boolean);

    const payload: Record<string, unknown> = {
      model_name: apiModelName,
      prompt: req.prompt,
      ...(req.negativePrompt ? { negative_prompt: req.negativePrompt } : {}),
      aspect_ratio: req.aspectRatio || '16:9',
      n: Math.max(1, Math.min(4, req.n ?? 1)),
    };

    if (refs[0]) {
      payload.image = await this.prepareKlingImageField(refs[0]);
    }

    const created = await this.requestJson(
      `${this.baseUrl}/v1/images/generations`,
      'POST',
      payload,
      req.signal
    );
    const dataObj = (created.data || created) as Record<string, unknown>;
    const taskId = String(dataObj.task_id || dataObj.id || '');
    if (!taskId) {
      throw new KlingApiError('Kling image generation did not return a task_id.', undefined, created);
    }

    const startedAt = Date.now();
    while (true) {
      if (req.signal?.aborted) {
        throw new KlingApiError('Kling image polling aborted by caller.');
      }
      if (Date.now() - startedAt > this.maxWaitMs) {
        throw new KlingApiError(`Kling image task ${taskId} timed out after ${this.maxWaitMs}ms.`);
      }

      await new Promise((resolve) => setTimeout(resolve, this.pollIntervalMs));

      const pollResp = await this.requestJson(
        `${this.baseUrl}/v1/images/generations/${encodeURIComponent(taskId)}`,
        'GET',
        undefined,
        req.signal
      );
      const pollData = (pollResp.data || pollResp) as Record<string, unknown>;
      const status = String(pollData.task_status || pollData.status || '').toLowerCase();
      req.onProgress?.({ taskId, status });

      if (status === 'succeed' || status === 'succeeded' || status === 'completed') {
        const taskResult = (pollData.task_result || {}) as Record<string, unknown>;
        const images = Array.isArray(taskResult.images)
          ? (taskResult.images as Array<Record<string, unknown>>)
          : [];
        const imageUrls = images
          .map((img) => String(img.url || '').trim())
          .filter(Boolean);
        if (imageUrls.length === 0) {
          throw new KlingApiError(
            `Kling image task ${taskId} succeeded without returning image URLs.`,
            undefined,
            pollResp
          );
        }
        return {
          provider: 'kling',
          model: requestedModel,
          taskId,
          imageUrl: imageUrls[0],
          imageUrls,
          rawResponse: pollResp,
        };
      }

      if (status === 'failed' || status === 'error') {
        throw new KlingApiError(
          `Kling image task ${taskId} failed: ${String(pollData.task_status_msg || 'Unknown error')}`,
          undefined,
          pollResp
        );
      }
    }
  }

  private async requestJson(
    url: string,
    method: 'GET' | 'POST',
    body?: Record<string, unknown>,
    signal?: AbortSignal
  ): Promise<Record<string, unknown>> {
    const token = await this.getBearerToken();
    const res = await this.fetchImpl(url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
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

    const apiCode = typeof parsed.code === 'number' ? parsed.code : 0;
    if (!res.ok || (apiCode !== 0 && parsed.code !== undefined)) {
      const msg = String(parsed.message || parsed.detail || text || `HTTP ${res.status}`).slice(
        0,
        320
      );
      throw new KlingApiError(
        `Kling API error (${res.status || apiCode}): ${msg}`,
        res.status,
        parsed
      );
    }

    return parsed;
  }
}
