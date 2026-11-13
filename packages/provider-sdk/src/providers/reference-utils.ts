/**
 * @open-dreamflow/provider-sdk — Cross-Node Reference Image Resolution Helpers
 * Ensures local `/media/...` and `http://localhost:3001/media/...` outputs from Node 1
 * are seamlessly converted into `data:<mime>;base64,...` (or raw base64) when passed
 * to remote cloud APIs in Node 2 (`Kling`, `Fal`, `Replicate`, `OpenAI`, `Higgsfield`, `Gemini`).
 */

export interface ResolvedReferenceImage {
  originalUrl: string;
  publicOrDataUrl: string;
  base64Data: string;
  mimeType: string;
}

export function guessMimeTypeFromPath(pathOrUrl: string): string {
  const clean = pathOrUrl.split('?')[0].split('#')[0].toLowerCase();
  if (clean.endsWith('.png')) return 'image/png';
  if (clean.endsWith('.webp')) return 'image/webp';
  if (clean.endsWith('.gif')) return 'image/gif';
  if (clean.endsWith('.jpg') || clean.endsWith('.jpeg')) return 'image/jpeg';
  if (clean.endsWith('.mp4')) return 'video/mp4';
  if (clean.endsWith('.mp3')) return 'audio/mpeg';
  return 'image/png';
}

export function stripDataUriPrefix(input: string): { base64Data: string; mimeType: string } {
  const trimmed = input.trim();
  const match = /^data:([^;,]+);base64,(.+)$/s.exec(trimmed);
  if (match) {
    return {
      mimeType: match[1].trim().toLowerCase(),
      base64Data: match[2].replace(/\s+/g, ''),
    };
  }
  return {
    mimeType: 'image/png',
    base64Data: trimmed.replace(/\s+/g, ''),
  };
}

export function isLocalhostOrRelativeMediaUrl(url: string): boolean {
  const trimmed = url.trim();
  if (trimmed.startsWith('/media/')) return true;
  if (/^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(:\d+)?\//i.test(trimmed)) {
    return true;
  }
  return false;
}

/**
 * Resolves a reference image URL (`data:...`, `/media/...`, `http://localhost:3001/media/...`,
 * or public `https://...`) so remote cloud providers never receive an unreachable localhost URL.
 */
export async function resolveReferenceImageForCloud(
  refInput: string,
  options: {
    mediaDir?: string;
    localServerOrigin?: string;
    preferDataUriEvenForRemote?: boolean;
    fetchImpl?: typeof fetch;
  } = {}
): Promise<ResolvedReferenceImage> {
  const trimmed = String(refInput || '').trim();
  if (!trimmed) {
    throw new Error('Reference image input is empty.');
  }

  // 1. Already a data: URI
  if (trimmed.startsWith('data:')) {
    const { base64Data, mimeType } = stripDataUriPrefix(trimmed);
    return {
      originalUrl: trimmed,
      publicOrDataUrl: `data:${mimeType};base64,${base64Data}`,
      base64Data,
      mimeType,
    };
  }

  const fetchFn = options.fetchImpl ?? globalThis.fetch.bind(globalThis);

  // 2. Local `/media/<filename>` on disk (when running in Node with mediaDir or cwd)
  const localMediaMatch =
    /^\/media\/([^?#]+)$/i.exec(trimmed) ||
    /^https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0)(?::\d+)?\/media\/([^?#]+)$/i.exec(trimmed);

  if (localMediaMatch && typeof process !== 'undefined' && process.versions?.node) {
    const fileName = decodeURIComponent(localMediaMatch[1]).replace(/\.\./g, '');
    try {
      const fsMod = await import('node:fs/promises');
      const pathMod = await import('node:path');
      const candidateDirs = [
        options.mediaDir,
        pathMod.resolve(process.cwd(), 'apps/web-studio/public/media'),
        pathMod.resolve(process.cwd(), 'public/media'),
      ].filter((d): d is string => Boolean(d));

      for (const dir of candidateDirs) {
        const candidatePath = pathMod.join(dir, fileName);
        try {
          const buf = await fsMod.readFile(candidatePath);
          const mimeType = guessMimeTypeFromPath(fileName);
          const base64Data = Buffer.from(buf).toString('base64');
          return {
            originalUrl: trimmed,
            publicOrDataUrl: `data:${mimeType};base64,${base64Data}`,
            base64Data,
            mimeType,
          };
        } catch {
          // Try next candidate directory
        }
      }
    } catch {
      // Fall through to HTTP fetch below
    }
  }

  // 3. Localhost URL or relative URL fetched via local HTTP server -> convert to data URI
  if (isLocalhostOrRelativeMediaUrl(trimmed) || options.preferDataUriEvenForRemote) {
    const fetchUrl = trimmed.startsWith('/')
      ? `${(options.localServerOrigin || 'http://127.0.0.1:3001').replace(/\/+$/, '')}${trimmed}`
      : trimmed;
    const res = await fetchFn(fetchUrl);
    if (!res.ok) {
      throw new Error(`Failed to fetch reference image (${res.status}) from ${fetchUrl}`);
    }
    const mimeType =
      res.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() ||
      guessMimeTypeFromPath(fetchUrl);
    const bytes = new Uint8Array(await res.arrayBuffer());
    const base64Data =
      typeof Buffer !== 'undefined'
        ? Buffer.from(bytes).toString('base64')
        : btoa(String.fromCharCode(...bytes));
    return {
      originalUrl: trimmed,
      publicOrDataUrl: `data:${mimeType};base64,${base64Data}`,
      base64Data,
      mimeType,
    };
  }

  // 4. Public https:// URL — keep as public URL unless base64Data is specifically needed
  if (/^https?:\/\//i.test(trimmed)) {
    return {
      originalUrl: trimmed,
      publicOrDataUrl: trimmed,
      base64Data: '',
      mimeType: guessMimeTypeFromPath(trimmed),
    };
  }

  // 5. Raw base64 fallback
  const cleaned = trimmed.replace(/\s+/g, '');
  return {
    originalUrl: trimmed,
    publicOrDataUrl: `data:image/png;base64,${cleaned}`,
    base64Data: cleaned,
    mimeType: 'image/png',
  };
}
