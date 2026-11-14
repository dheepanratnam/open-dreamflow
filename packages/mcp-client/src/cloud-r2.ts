/**
 * @open-dreamflow/mcp-client — Zero-Dependency Cloudflare R2 (S3 SigV4) Client
 *
 * Uses strictly Node built-ins (`node:crypto`, `node:https`) to authenticate,
 * upload, list, and delete objects in Cloudflare R2 with 0 external dependencies.
 */

import * as crypto from 'node:crypto';
import * as https from 'node:https';

export interface R2AssetObject {
  key: string;
  size: number;
  lastModified: string;
  publicUrl: string;
}

interface R2ResolvedConfig {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  publicBaseUrl: string | null;
  endpointHost: string;
}

interface R2ListCacheEntry {
  expiresAt: number;
  items: R2AssetObject[];
}

const R2_LIST_CACHE_TTL_MS = 15_000;
const r2ListCache = new Map<string, R2ListCacheEntry>();

function readR2Config(): R2ResolvedConfig | null {
  const accountId = String(process.env.R2_ACCOUNT_ID || '').trim();
  const accessKeyId = String(process.env.R2_ACCESS_KEY_ID || '').trim();
  const secretAccessKey = String(process.env.R2_SECRET_ACCESS_KEY || '').trim();
  const bucket = String(process.env.R2_BUCKET_NAME || '').trim();
  const rawPublicBase = String(process.env.R2_PUBLIC_BASE_URL || '').trim().replace(/\/+$/, '');

  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
    return null;
  }

  return {
    accountId,
    accessKeyId,
    secretAccessKey,
    bucket,
    publicBaseUrl: rawPublicBase || null,
    endpointHost: `${accountId}.r2.cloudflarestorage.com`,
  };
}

export function isR2Configured(): boolean {
  return readR2Config() !== null;
}

export function getR2ConfigSummary(): {
  configured: boolean;
  bucket: string | null;
  publicBaseUrl: string | null;
} {
  const cfg = readR2Config();
  if (!cfg) {
    const rawBucket = String(process.env.R2_BUCKET_NAME || '').trim() || null;
    const rawBase = String(process.env.R2_PUBLIC_BASE_URL || '').trim().replace(/\/+$/, '') || null;
    return {
      configured: false,
      bucket: rawBucket,
      publicBaseUrl: rawBase,
    };
  }
  return {
    configured: true,
    bucket: cfg.bucket,
    publicBaseUrl: cfg.publicBaseUrl,
  };
}

function encodeRfc3986(input: string): string {
  return encodeURIComponent(input).replace(/[!'()*]/g, (ch) =>
    `%${ch.charCodeAt(0).toString(16).toUpperCase()}`
  );
}

function normalizeObjectKey(key: string): string {
  return String(key || '').replace(/^\/+/, '').trim();
}

function encodeS3Path(bucket: string, key?: string): string {
  const cleanKey = key ? normalizeObjectKey(key) : '';
  if (!cleanKey) {
    return `/${encodeRfc3986(bucket)}`;
  }
  const encodedSegments = cleanKey
    .split('/')
    .filter((segment) => segment.length > 0)
    .map((segment) => encodeRfc3986(segment))
    .join('/');
  return `/${encodeRfc3986(bucket)}/${encodedSegments}`;
}

export function buildR2PublicUrl(key: string, publicBaseUrl?: string | null): string {
  const cleanKey = normalizeObjectKey(key);
  const encodedKeyPath = cleanKey
    .split('/')
    .filter((segment) => segment.length > 0)
    .map((segment) => encodeURIComponent(segment))
    .join('/');
  const base =
    typeof publicBaseUrl === 'string'
      ? publicBaseUrl.trim().replace(/\/+$/, '')
      : String(process.env.R2_PUBLIC_BASE_URL || '').trim().replace(/\/+$/, '');
  if (base) {
    return `${base}/${encodedKeyPath}`;
  }
  return `/media/${encodedKeyPath}`;
}

function sha256Hex(data: Buffer | string): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

function hmacSha256(key: Buffer | string, data: string): Buffer {
  return crypto.createHmac('sha256', key).update(data, 'utf8').digest();
}

function formatAmzDates(date = new Date()): { amzDate: string; dateStamp: string } {
  const iso = date.toISOString();
  const dateStamp = iso.slice(0, 10).replace(/-/g, '');
  const timeStamp = iso.slice(11, 19).replace(/:/g, '');
  return {
    amzDate: `${dateStamp}T${timeStamp}Z`,
    dateStamp,
  };
}

interface SignedR2RequestOptions {
  method: 'GET' | 'PUT' | 'DELETE' | 'HEAD';
  key?: string;
  query?: Record<string, string>;
  body?: Buffer;
  contentType?: string;
  timeoutMs?: number;
}

interface R2HttpResponse {
  statusCode: number;
  body: Buffer;
  headers: Record<string, string | string[] | undefined>;
}

async function executeSignedR2Request(
  cfg: R2ResolvedConfig,
  opts: SignedR2RequestOptions
): Promise<R2HttpResponse> {
  const payload = opts.body ?? Buffer.alloc(0);
  const payloadHash = sha256Hex(payload);
  const { amzDate, dateStamp } = formatAmzDates();
  const canonicalUri = encodeS3Path(cfg.bucket, opts.key);

  const queryEntries = Object.entries(opts.query || {})
    .map(([k, v]) => [encodeRfc3986(k), encodeRfc3986(v)] as const)
    .sort((a, b) => (a[0] === b[0] ? a[1].localeCompare(b[1]) : a[0].localeCompare(b[0])));
  const canonicalQueryString = queryEntries.map(([k, v]) => `${k}=${v}`).join('&');

  const headerPairs: Array<[string, string]> = [
    ['host', cfg.endpointHost],
    ['x-amz-content-sha256', payloadHash],
    ['x-amz-date', amzDate],
  ];
  if (opts.contentType) {
    headerPairs.push(['content-type', opts.contentType.trim()]);
  }
  if (opts.method === 'PUT') {
    headerPairs.push(['content-length', String(payload.byteLength)]);
  }

  headerPairs.sort((a, b) => a[0].localeCompare(b[0]));

  const canonicalHeaders = headerPairs.map(([k, v]) => `${k}:${v}\n`).join('');
  const signedHeaders = headerPairs.map(([k]) => k).join(';');

  const canonicalRequest = [
    opts.method,
    canonicalUri,
    canonicalQueryString,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');

  const credentialScope = `${dateStamp}/auto/s3/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join('\n');

  const kDate = hmacSha256(`AWS4${cfg.secretAccessKey}`, dateStamp);
  const kRegion = hmacSha256(kDate, 'auto');
  const kService = hmacSha256(kRegion, 's3');
  const kSigning = hmacSha256(kService, 'aws4_request');
  const signature = crypto
    .createHmac('sha256', kSigning)
    .update(stringToSign, 'utf8')
    .digest('hex');

  const authorization = `AWS4-HMAC-SHA256 Credential=${cfg.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const requestHeaders: Record<string, string | number> = {
    Host: cfg.endpointHost,
    'x-amz-date': amzDate,
    'x-amz-content-sha256': payloadHash,
    Authorization: authorization,
  };
  if (opts.contentType) {
    requestHeaders['Content-Type'] = opts.contentType.trim();
  }
  if (opts.method === 'PUT') {
    requestHeaders['Content-Length'] = payload.byteLength;
  }

  const requestPath = canonicalQueryString ? `${canonicalUri}?${canonicalQueryString}` : canonicalUri;
  const timeoutMs = opts.timeoutMs ?? 60_000;

  return new Promise<R2HttpResponse>((resolve, reject) => {
    const req = https.request(
      {
        hostname: cfg.endpointHost,
        port: 443,
        method: opts.method,
        path: requestPath,
        headers: requestHeaders,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode ?? 0,
            body: Buffer.concat(chunks),
            headers: res.headers as Record<string, string | string[] | undefined>,
          });
        });
      }
    );

    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error(`Cloudflare R2 ${opts.method} request timed out after ${timeoutMs}ms.`));
    });
    req.on('error', (err) => reject(err));

    if (payload.byteLength > 0 && opts.method === 'PUT') {
      req.write(payload);
    }
    req.end();
  });
}

function unescapeXmlEntities(value: string): string {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function extractXmlTag(block: string, tagName: string): string {
  const match = block.match(new RegExp(`<${tagName}>([\\s\\S]*?)</${tagName}>`));
  return match?.[1] ? unescapeXmlEntities(match[1].trim()) : '';
}

export function invalidateR2ListCache(): void {
  r2ListCache.clear();
}

export async function uploadBufferToR2(
  key: string,
  body: Buffer,
  contentType: string
): Promise<{ ok: boolean; publicUrl?: string; key: string; error?: string }> {
  const cleanKey = normalizeObjectKey(key);
  if (!cleanKey) {
    return { ok: false, key: cleanKey, error: 'Object key is required for R2 upload.' };
  }

  const cfg = readR2Config();
  if (!cfg) {
    return {
      ok: false,
      key: cleanKey,
      error: 'Cloudflare R2 is not configured (missing R2_ACCOUNT_ID/R2_ACCESS_KEY_ID/R2_SECRET_ACCESS_KEY/R2_BUCKET_NAME).',
    };
  }

  try {
    const res = await executeSignedR2Request(cfg, {
      method: 'PUT',
      key: cleanKey,
      body,
      contentType: contentType || 'application/octet-stream',
      timeoutMs: 120_000,
    });

    if (res.statusCode >= 200 && res.statusCode < 300) {
      invalidateR2ListCache();
      return {
        ok: true,
        key: cleanKey,
        publicUrl: buildR2PublicUrl(cleanKey, cfg.publicBaseUrl),
      };
    }

    const errText = res.body.toString('utf8').trim();
    const message = extractXmlTag(errText, 'Message') || errText.slice(0, 300) || `HTTP ${res.statusCode}`;
    return {
      ok: false,
      key: cleanKey,
      error: `R2 PUT failed (${res.statusCode}): ${message}`,
    };
  } catch (err) {
    return {
      ok: false,
      key: cleanKey,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function listR2Objects(prefix = '', maxKeys = 200): Promise<R2AssetObject[]> {
  const cfg = readR2Config();
  if (!cfg) return [];

  const cleanPrefix = normalizeObjectKey(prefix);
  const clampedMaxKeys = Math.min(Math.max(1, Math.floor(maxKeys || 200)), 1000);
  const cacheKey = `${cfg.accountId}|${cfg.bucket}|${cfg.publicBaseUrl || ''}|${cleanPrefix}|${clampedMaxKeys}`;
  const now = Date.now();
  const cached = r2ListCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return cached.items;
  }

  try {
    const query: Record<string, string> = {
      'list-type': '2',
      'max-keys': String(clampedMaxKeys),
    };
    if (cleanPrefix) {
      query.prefix = cleanPrefix;
    }

    const res = await executeSignedR2Request(cfg, {
      method: 'GET',
      query,
      timeoutMs: 30_000,
    });

    if (res.statusCode < 200 || res.statusCode >= 300) {
      return [];
    }

    const xml = res.body.toString('utf8');
    const items: R2AssetObject[] = [];
    const contentsPattern = /<Contents>([\s\S]*?)<\/Contents>/g;
    let match: RegExpExecArray | null;
    while ((match = contentsPattern.exec(xml)) !== null) {
      const block = match[1];
      const key = extractXmlTag(block, 'Key');
      if (!key) continue;
      const sizeRaw = extractXmlTag(block, 'Size');
      const lastModified = extractXmlTag(block, 'LastModified') || new Date().toISOString();
      items.push({
        key,
        size: Number(sizeRaw) || 0,
        lastModified,
        publicUrl: buildR2PublicUrl(key, cfg.publicBaseUrl),
      });
    }

    items.sort((a, b) => Date.parse(b.lastModified) - Date.parse(a.lastModified));
    r2ListCache.set(cacheKey, {
      expiresAt: now + R2_LIST_CACHE_TTL_MS,
      items,
    });
    return items;
  } catch {
    return [];
  }
}

export async function deleteR2Object(key: string): Promise<boolean> {
  const cleanKey = normalizeObjectKey(key);
  if (!cleanKey) return false;

  const cfg = readR2Config();
  if (!cfg) return false;

  try {
    const res = await executeSignedR2Request(cfg, {
      method: 'DELETE',
      key: cleanKey,
      timeoutMs: 30_000,
    });
    if (res.statusCode >= 200 && res.statusCode < 300) {
      invalidateR2ListCache();
      return true;
    }
    return false;
  } catch {
    return false;
  }
}
