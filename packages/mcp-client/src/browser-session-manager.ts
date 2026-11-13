/**
 * @open-dreamflow/mcp-client — 1-Click Guided Creator Browser Session Launcher
 *
 * Launches a dedicated persistent Chrome / Chromium creator profile pre-loaded
 * with `--load-extension=<repo>/extensions/chrome-bridge` and `--user-data-dir=<dataDir>/chrome-creator-profile`
 * so users never have to open `chrome://extensions`, enable Developer Mode, or paste console scripts.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export type LaunchableCreatorPlatformId =
  | 'higgsfield'
  | 'sume'
  | 'kling'
  | 'dreamina'
  | 'google-flow'
  | 'openart'
  | 'imagineart'
  | 'elevenlabs';

export const CREATOR_LAUNCH_ORDER: LaunchableCreatorPlatformId[] = [
  'higgsfield',
  'sume',
  'kling',
  'dreamina',
  'google-flow',
  'elevenlabs',
  'openart',
  'imagineart',
];

export const CREATOR_LAUNCH_URLS: Record<LaunchableCreatorPlatformId, string> = {
  higgsfield: 'https://higgsfield.ai',
  sume: 'https://sume.com',
  kling: 'https://app.klingai.com',
  dreamina: 'https://dreamina.capcut.com/ai-tool/home',
  'google-flow': 'https://labs.google/fx/tools/flow',
  openart: 'https://openart.ai/create',
  imagineart: 'https://www.imagine.art',
  elevenlabs: 'https://elevenlabs.io/app',
};

export interface DetectedBrowserBinary {
  browserName: string;
  browserPath: string;
}

export interface LaunchCreatorBrowserOptions {
  platformId?: string;
  platforms?: string[];
  dryRun?: boolean;
  activeTabsConnected?: string[];
}

export interface LaunchCreatorBrowserResult {
  ok: boolean;
  launched: boolean;
  dryRun: boolean;
  browserName: string;
  browserPath: string;
  extensionPath: string;
  profileDir: string;
  urls: string[];
  args: string[];
  pid?: number;
  activeTabsConnected: string[];
  error?: string;
}

export function normalizeLaunchPlatformId(raw?: string): LaunchableCreatorPlatformId | 'all' {
  const lowered = String(raw || 'all').toLowerCase().trim();
  if (!lowered || lowered === 'all') return 'all';
  if (lowered.includes('higgsfield')) return 'higgsfield';
  if (lowered.includes('sume')) return 'sume';
  if (lowered.includes('kling') && !lowered.includes('openart')) return 'kling';
  if (
    lowered.includes('dreamina') ||
    lowered.includes('seedance') ||
    lowered.includes('seedream') ||
    lowered.includes('jimeng')
  ) {
    return 'dreamina';
  }
  if (lowered.includes('openart')) return 'openart';
  if (lowered.includes('imagine')) return 'imagineart';
  if (lowered.includes('eleven')) return 'elevenlabs';
  if (lowered.includes('flow') || lowered.includes('google') || lowered.includes('gemini')) {
    return 'google-flow';
  }
  return 'all';
}

export function mapDomainToCreatorPlatformId(rawDomainOrUrl: string): LaunchableCreatorPlatformId | null {
  const raw = String(rawDomainOrUrl || '').trim().toLowerCase();
  if (!raw) return null;

  let host = raw;
  if (raw.includes('://')) {
    try {
      host = new URL(raw).hostname.toLowerCase();
    } catch {
      host = raw;
    }
  } else if (raw.includes('/')) {
    host = raw.split('/')[0];
  }

  if (host === 'higgsfield.ai' || host.endsWith('.higgsfield.ai')) return 'higgsfield';
  if (host === 'sume.com' || host.endsWith('.sume.com')) return 'sume';
  if (host === 'klingai.com' || host.endsWith('.klingai.com')) return 'kling';
  if (host.endsWith('dreamina.capcut.com') || host.endsWith('jimeng.jianying.com')) {
    return 'dreamina';
  }
  if (host === 'flow.google.com' || host === 'labs.google') return 'google-flow';
  if (host === 'openart.ai' || host.endsWith('.openart.ai')) return 'openart';
  if (host === 'imagine.art' || host.endsWith('.imagine.art')) return 'imagineart';
  if (host === 'elevenlabs.io' || host.endsWith('.elevenlabs.io')) return 'elevenlabs';
  return null;
}

export class BrowserSessionManager {
  private readonly dataDir: string;

  constructor(dataDir: string) {
    this.dataDir = dataDir;
  }

  public getProfileDir(): string {
    return path.join(this.dataDir, 'chrome-creator-profile');
  }

  public resolveExtensionPath(): string {
    const moduleDir = path.dirname(fileURLToPath(import.meta.url));
    const candidates = [
      path.resolve(moduleDir, '../../../extensions/chrome-bridge'),
      path.resolve(moduleDir, '../../extensions/chrome-bridge'),
      path.resolve(process.cwd(), 'extensions/chrome-bridge'),
      path.resolve(process.cwd(), '../extensions/chrome-bridge'),
      path.resolve(process.cwd(), '../../extensions/chrome-bridge'),
      path.resolve(this.dataDir, '../extensions/chrome-bridge'),
    ];

    for (const candidate of candidates) {
      if (fs.existsSync(path.join(candidate, 'manifest.json'))) {
        return candidate;
      }
    }
    return candidates[0];
  }

  public detectBrowserBinary(): DetectedBrowserBinary | null {
    const override = String(process.env.DREAMFLOW_CHROME_PATH || '').trim();
    if (override && fs.existsSync(override)) {
      return {
        browserName: path.basename(override),
        browserPath: override,
      };
    }

    const platform = process.platform;
    const candidates: DetectedBrowserBinary[] =
      platform === 'darwin'
        ? [
            {
              browserName: 'Google Chrome',
              browserPath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
            },
            {
              browserName: 'Brave Browser',
              browserPath: '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
            },
            {
              browserName: 'Chromium',
              browserPath: '/Applications/Chromium.app/Contents/MacOS/Chromium',
            },
            {
              browserName: 'Microsoft Edge',
              browserPath: '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
            },
            {
              browserName: 'Arc',
              browserPath: '/Applications/Arc.app/Contents/MacOS/Arc',
            },
          ]
        : platform === 'win32'
          ? [
              {
                browserName: 'Google Chrome',
                browserPath: path.join(
                  process.env.ProgramFiles || 'C:\\Program Files',
                  'Google\\Chrome\\Application\\chrome.exe'
                ),
              },
              {
                browserName: 'Google Chrome (x86)',
                browserPath: path.join(
                  process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)',
                  'Google\\Chrome\\Application\\chrome.exe'
                ),
              },
              {
                browserName: 'Brave Browser',
                browserPath: path.join(
                  process.env.ProgramFiles || 'C:\\Program Files',
                  'BraveSoftware\\Brave-Browser\\Application\\brave.exe'
                ),
              },
              {
                browserName: 'Microsoft Edge',
                browserPath: path.join(
                  process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)',
                  'Microsoft\\Edge\\Application\\msedge.exe'
                ),
              },
            ]
          : [
              { browserName: 'Google Chrome', browserPath: '/usr/bin/google-chrome' },
              { browserName: 'Google Chrome Stable', browserPath: '/usr/bin/google-chrome-stable' },
              { browserName: 'Chromium', browserPath: '/usr/bin/chromium' },
              { browserName: 'Chromium Browser', browserPath: '/usr/bin/chromium-browser' },
              { browserName: 'Brave Browser', browserPath: '/usr/bin/brave-browser' },
              { browserName: 'Microsoft Edge', browserPath: '/usr/bin/microsoft-edge' },
            ];

    for (const item of candidates) {
      if (fs.existsSync(item.browserPath)) {
        return item;
      }
    }
    return null;
  }

  public resolveLaunchUrls(options: LaunchCreatorBrowserOptions): string[] {
    if (Array.isArray(options.platforms) && options.platforms.length > 0) {
      const urls: string[] = [];
      for (const rawPlat of options.platforms) {
        const norm = normalizeLaunchPlatformId(rawPlat);
        if (norm === 'all') {
          for (const id of CREATOR_LAUNCH_ORDER) {
            if (!urls.includes(CREATOR_LAUNCH_URLS[id])) {
              urls.push(CREATOR_LAUNCH_URLS[id]);
            }
          }
        } else if (!urls.includes(CREATOR_LAUNCH_URLS[norm])) {
          urls.push(CREATOR_LAUNCH_URLS[norm]);
        }
      }
      if (urls.length > 0) return urls;
    }

    const norm = normalizeLaunchPlatformId(options.platformId);
    if (norm === 'all') {
      return CREATOR_LAUNCH_ORDER.map((id) => CREATOR_LAUNCH_URLS[id]);
    }
    return [CREATOR_LAUNCH_URLS[norm]];
  }

  public launchCreatorBrowser(options: LaunchCreatorBrowserOptions = {}): LaunchCreatorBrowserResult {
    const dryRun = Boolean(options.dryRun);
    const detected = this.detectBrowserBinary();
    const extensionPath = this.resolveExtensionPath();
    const profileDir = this.getProfileDir();
    const urls = this.resolveLaunchUrls(options);
    const activeTabsConnected = Array.isArray(options.activeTabsConnected)
      ? options.activeTabsConnected
      : [];

    if (!detected) {
      return {
        ok: false,
        launched: false,
        dryRun,
        browserName: '',
        browserPath: '',
        extensionPath,
        profileDir,
        urls,
        args: [],
        activeTabsConnected,
        error:
          'No Chromium-based browser (Google Chrome, Brave, Chromium, Edge) found. Install Google Chrome or set DREAMFLOW_CHROME_PATH.',
      };
    }

    if (!fs.existsSync(path.join(extensionPath, 'manifest.json'))) {
      return {
        ok: false,
        launched: false,
        dryRun,
        browserName: detected.browserName,
        browserPath: detected.browserPath,
        extensionPath,
        profileDir,
        urls,
        args: [],
        activeTabsConnected,
        error: `Open-DreamFlow Credit Bridge extension not found at ${extensionPath}.`,
      };
    }

    const cdpPort = Number(process.env.DREAMFLOW_CHROME_CDP_PORT || 9229) || 9229;
    const args = [
      `--user-data-dir=${profileDir}`,
      `--load-extension=${extensionPath}`,
      `--remote-debugging-port=${cdpPort}`,
      '--no-first-run',
      '--no-default-browser-check',
      ...urls,
    ];

    if (dryRun) {
      return {
        ok: true,
        launched: false,
        dryRun: true,
        browserName: detected.browserName,
        browserPath: detected.browserPath,
        extensionPath,
        profileDir,
        urls,
        args,
        activeTabsConnected,
      };
    }

    fs.mkdirSync(profileDir, { recursive: true });
    const child = spawn(detected.browserPath, args, {
      detached: true,
      stdio: 'ignore',
    });
    child.unref();

    return {
      ok: true,
      launched: true,
      dryRun: false,
      browserName: detected.browserName,
      browserPath: detected.browserPath,
      extensionPath,
      profileDir,
      urls,
      args,
      pid: child.pid,
      activeTabsConnected,
    };
  }

  /**
   * Inspects Chrome DevTools Protocol (`http://127.0.0.1:9229/json/list`) to detect
   * signed-in creator tabs directly even when Chrome Stable skips unpacked extension loading.
   */
  public async inspectOpenCreatorTabsViaCdp(cdpPort?: number): Promise<{
    reachable: boolean;
    cdpUrl: string;
    openDomains: string[];
    platforms: LaunchableCreatorPlatformId[];
    tabs: Array<{ title: string; url: string; platformId: LaunchableCreatorPlatformId | null }>;
  }> {
    const port = cdpPort || Number(process.env.DREAMFLOW_CHROME_CDP_PORT || 9229) || 9229;
    const cdpUrl = `http://127.0.0.1:${port}/json/list`;
    try {
      const res = await fetch(cdpUrl, {
        method: 'GET',
        signal: AbortSignal.timeout(600),
      });
      if (!res.ok) {
        return { reachable: false, cdpUrl, openDomains: [], platforms: [], tabs: [] };
      }
      const rawTabs = (await res.json()) as Array<Record<string, unknown>>;
      if (!Array.isArray(rawTabs)) {
        return { reachable: true, cdpUrl, openDomains: [], platforms: [], tabs: [] };
      }

      const domains = new Set<string>();
      const platforms = new Set<LaunchableCreatorPlatformId>();
      const tabs: Array<{
        title: string;
        url: string;
        platformId: LaunchableCreatorPlatformId | null;
      }> = [];

      for (const tab of rawTabs) {
        const url = typeof tab?.url === 'string' ? tab.url.trim() : '';
        const title = typeof tab?.title === 'string' ? tab.title.trim() : '';
        if (!url || !/^https?:/i.test(url)) continue;
        const platformId = mapDomainToCreatorPlatformId(url);
        if (platformId) {
          platforms.add(platformId);
          try {
            const host = new URL(url).hostname.toLowerCase();
            if (host) domains.add(host);
          } catch {
            // Ignore malformed URL
          }
        }
        tabs.push({ title, url, platformId });
      }

      return {
        reachable: true,
        cdpUrl,
        openDomains: Array.from(domains),
        platforms: Array.from(platforms),
        tabs,
      };
    } catch {
      return { reachable: false, cdpUrl, openDomains: [], platforms: [], tabs: [] };
    }
  }
}
