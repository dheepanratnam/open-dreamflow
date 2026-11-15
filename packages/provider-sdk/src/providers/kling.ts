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

export interface KlingReferenceHandleBinding {
  handle: string;
  url: string;
  label?: string;
}

export interface KlingVideoRequest {
  model?: string;
  prompt: string;
  negativePrompt?: string;
  referenceImages?: string[];
  referenceFrameMode?: 'multi-ref' | 'start-end' | 'auto';
  referenceHandles?: KlingReferenceHandleBinding[];
  startImageUrl?: string;
  endImageUrl?: string;
  aspectRatio?: '16:9' | '9:16' | '1:1' | '21:9';
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

export interface KlingResourcePackBucket {
  packName: string;
  remainingUnits: number;
  totalUnits: number;
  expiresAt?: string;
  daysRemaining?: number;
  status?: string;
}

export interface KlingAccountCostsSummary {
  ok: boolean;
  remainingUnits: number | null;
  totalUnits: number | null;
  expiresAt: string | null;
  daysRemaining: number | null;
  packs: KlingResourcePackBucket[];
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
  'kling-video-v4_0': 'kling-v2-1-master',
  'kling-video-v4_0_flash': 'kling-v2-1-master',
  'kling-video-v3_0_omni': 'kling-v2-1-master',
  'kling-video-v3_0': 'kling-v2-master',
  'kling-video-v3_0_turbo': 'kling-v2-master',
  'kling-video-o1': 'kling-v2-1-master',
  'kling-video-v2_6': 'kling-v1-6',
  'kling-video-v2_5': 'kling-v1-6',
  'kling-4.0': 'kling-v2-1-master',
  'kling-3.0-master': 'kling-v2-master',
  'kling-2.1-master': 'kling-v2-1-master',
  'kling-v2-1-master': 'kling-v2-1-master',
  'kling-v2-master': 'kling-v2-master',
  'kling-2.6-pro': 'kling-v1-6',
  'kling-1.6-pro': 'kling-v1-6',
  'kling-elements': 'kling-v1-6',
};

const KLING_IMAGE_MODEL_MAP: Record<string, string> = {
  'kling-image-v3_0_omni': 'kling-v2',
  'kling-image-v3_0': 'kling-v2',
  'kling-image-v2_1': 'kling-v2',
  'kolors-2.0': 'kling-v2',
  'kling-v2': 'kling-v2',
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

  public async getAccountCosts(signal?: AbortSignal): Promise<KlingAccountCostsSummary> {
    const nowMs = Date.now();
    const startMs = nowMs - 90 * 86_400_000;
    const endMs = nowMs + 365 * 86_400_000;
    const resp = await this.requestJson(
      `${this.baseUrl}/account/costs?start_time=${startMs}&end_time=${endMs}`,
      'GET',
      undefined,
      signal
    );
    const dataObj =
      typeof resp.data === 'object' && resp.data !== null
        ? (resp.data as Record<string, unknown>)
        : resp;
    const rawPacks = Array.isArray(dataObj.resource_pack_subscribe_infos)
      ? (dataObj.resource_pack_subscribe_infos as Array<Record<string, unknown>>)
      : Array.isArray(resp.resource_pack_subscribe_infos)
        ? (resp.resource_pack_subscribe_infos as Array<Record<string, unknown>>)
        : [];

    let remainingSum = 0;
    let totalSum = 0;
    let hasNumericPack = false;
    let earliestExpMs: number | null = null;
    const packs: KlingResourcePackBucket[] = [];

    for (const p of rawPacks) {
      const rem = Number(p.remaining_quantity);
      const tot = Number(p.total_quantity);
      const status = typeof p.status === 'string' ? p.status : undefined;
      if (status && /expired|refunded/i.test(status) && !(rem > 0)) {
        continue;
      }
      const rawEnd = p.invalid_time ?? p.expire_time ?? p.end_time;
      let expMs: number | null = null;
      if (typeof rawEnd === 'number' && Number.isFinite(rawEnd) && rawEnd > 0) {
        expMs = rawEnd > 1e12 ? rawEnd : rawEnd * 1000;
      } else if (typeof rawEnd === 'string' && rawEnd.trim()) {
        const asNum = Number(rawEnd.trim());
        expMs =
          Number.isFinite(asNum) && asNum > 0
            ? asNum > 1e12
              ? asNum
              : asNum * 1000
            : Date.parse(rawEnd.trim());
      }
      const validExpMs = expMs !== null && Number.isFinite(expMs) ? expMs : null;
      const daysRem =
        validExpMs !== null ? Math.max(0, Math.ceil((validExpMs - nowMs) / 86_400_000)) : undefined;

      if (Number.isFinite(rem)) {
        hasNumericPack = true;
        remainingSum += Math.max(0, rem);
      }
      if (Number.isFinite(tot)) {
        totalSum += Math.max(0, tot);
      }
      if (validExpMs !== null && rem > 0) {
        if (earliestExpMs === null || validExpMs < earliestExpMs) {
          earliestExpMs = validExpMs;
        }
      }
      packs.push({
        packName: String(p.resource_pack_name || p.pack_name || 'Kling Resource Pack'),
        remainingUnits: Number.isFinite(rem) ? Math.round(rem * 100) / 100 : 0,
        totalUnits: Number.isFinite(tot) ? Math.round(tot * 100) / 100 : 0,
        ...(validExpMs !== null ? { expiresAt: new Date(validExpMs).toISOString() } : {}),
        ...(typeof daysRem === 'number' ? { daysRemaining: daysRem } : {}),
        ...(status ? { status } : {}),
      });
    }

    return {
      ok: true,
      remainingUnits: hasNumericPack ? Math.round(remainingSum * 100) / 100 : null,
      totalUnits: hasNumericPack && totalSum > 0 ? Math.round(totalSum * 100) / 100 : null,
      expiresAt: earliestExpMs !== null ? new Date(earliestExpMs).toISOString() : null,
      daysRemaining:
        earliestExpMs !== null
          ? Math.max(0, Math.ceil((earliestExpMs - nowMs) / 86_400_000))
          : null,
      packs,
    };
  }

  public async verifyAccount(
    signal?: AbortSignal
  ): Promise<{
    ok: boolean;
    authMode: 'jwt' | 'bearer';
    models: string[];
    remainingUnits?: number | null;
    expiresAt?: string | null;
  }> {
    await this.requestJson(
      `${this.baseUrl}/v1/videos/text2video?pageNum=1&pageSize=1`,
      'GET',
      undefined,
      signal
    );
    const costs = await this.getAccountCosts(signal).catch(() => null);
    return {
      ok: true,
      authMode: this.accessKey && this.secretKey ? 'jwt' : 'bearer',
      models: [
        'kling-4.0',
        'kling-3.0-master',
        'kling-2.1-master',
        'kling-2.6-pro',
        'kling-elements',
        'kolors-2.0',
      ],
      ...(costs ? { remainingUnits: costs.remainingUnits, expiresAt: costs.expiresAt } : {}),
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

  private rewriteMultiImagePromptHandles(
    rawPrompt: string,
    refs: string[],
    bindings?: KlingReferenceHandleBinding[]
  ): string {
    let rewritten = rawPrompt;
    const pairs: Array<{ alias: string; token: string }> = [];

    refs.slice(0, 4).forEach((refUrl, idx) => {
      const slotToken = `@image_${idx + 1}`;
      pairs.push(
        { alias: `@Image${idx + 1}`, token: slotToken },
        { alias: `@Image_${idx + 1}`, token: slotToken },
        { alias: `@Ref${idx + 1}`, token: slotToken },
        { alias: `@Ref_${idx + 1}`, token: slotToken },
        { alias: `@Element${idx + 1}`, token: slotToken }
      );
      const matched = (bindings || []).filter(
        (b) => b && typeof b.handle === 'string' && b.handle.trim() && b.url === refUrl
      );
      for (const b of matched) {
        const clean = b.handle.trim().startsWith('@') ? b.handle.trim() : `@${b.handle.trim()}`;
        pairs.push({ alias: clean, token: slotToken });
      }
      if (!matched.length && bindings && bindings[idx]?.handle) {
        const fallbackH = bindings[idx].handle.trim();
        if (fallbackH) {
          pairs.push({
            alias: fallbackH.startsWith('@') ? fallbackH : `@${fallbackH}`,
            token: slotToken,
          });
        }
      }
    });

    pairs.sort((a, b) => b.alias.length - a.alias.length);
    for (const { alias, token } of pairs) {
      if (alias.toLowerCase() === token.toLowerCase()) continue;
      const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp(`${escaped}(?![a-zA-Z0-9_-])`, 'gi');
      rewritten = rewritten.replace(re, token);
    }
    return rewritten;
  }

  public async generateVideo(req: KlingVideoRequest): Promise<KlingVideoResult> {
    const requestedModel = req.model || 'kling-4.0';
    const apiModelName = KLING_VIDEO_MODEL_MAP[requestedModel] || requestedModel;
    const refs = (req.referenceImages || []).filter(Boolean);
    const hasRef = refs.length > 0 || Boolean(req.startImageUrl);

    const durationStr = (req.durationSeconds && req.durationSeconds >= 10 ? '10' : '5') as
      | '5'
      | '10';
    const aspectRatio =
      req.aspectRatio === '9:16' || req.aspectRatio === '1:1' ? req.aspectRatio : '16:9';

    const frameMode = req.referenceFrameMode || 'auto';
    const hasPromptHandleTag = /@[a-zA-Z0-9_-]+/.test(req.prompt);
    const useMultiRefElements =
      refs.length > 0 &&
      frameMode !== 'start-end' &&
      !req.startImageUrl &&
      !req.endImageUrl &&
      (frameMode === 'multi-ref' ||
        requestedModel === 'kling-elements' ||
        refs.length >= 2 ||
        hasPromptHandleTag);

    let endpointPath = '/v1/videos/text2video';
    const effectivePrompt = useMultiRefElements
      ? this.rewriteMultiImagePromptHandles(req.prompt, refs, req.referenceHandles)
      : req.prompt;

    const payload: Record<string, unknown> = {
      model_name: apiModelName,
      prompt: effectivePrompt,
      ...(req.negativePrompt ? { negative_prompt: req.negativePrompt } : {}),
      duration: durationStr,
      mode: req.mode || 'pro',
      cfg_scale: req.cfgScale ?? 0.5,
    };

    if (useMultiRefElements) {
      endpointPath = '/v1/videos/multi-image2video';
      const imageList: Array<{ image: string }> = [];
      for (const r of refs.slice(0, 4)) {
        imageList.push({ image: await this.prepareKlingImageField(r) });
      }
      payload.image_list = imageList;
      payload.aspect_ratio = aspectRatio;
    } else if (hasRef) {
      endpointPath = '/v1/videos/image2video';
      const startSource = req.startImageUrl || refs[0];
      payload.image = await this.prepareKlingImageField(startSource);
      const tailSource =
        req.endImageUrl || (frameMode === 'start-end' && refs.length >= 2 ? refs[1] : undefined);
      if (tailSource) {
        payload.image_tail = await this.prepareKlingImageField(tailSource);
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
