#!/usr/bin/env node
/**
 * Open-DreamFlow Unified Open-Source CLI & Cloud Canvas MCP Bridge (`open-dreamflow`)
 *
 * Commands:
 *   open-dreamflow start [--port 3001] [--host 127.0.0.1]
 *   open-dreamflow doctor
 *   open-dreamflow mcp-remote [--url https://...] [--token ... | --email ... --passcode ...]
 *   open-dreamflow canvas <list|get|create|rename|organize|generate|credits|sync-rates> [options]
 *   open-dreamflow --help
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as readline from 'node:readline';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');
const DEFAULT_CLOUD_URL = 'https://open-dreamflow-engine-production.up.railway.app';

function printHelp() {
  console.log(`
Open-DreamFlow v1.1.0 — Spatial AI Studio, Cloud Canvas CLI & 22-Tool MCP Engine

Usage:
  open-dreamflow <command> [options]

Commands:
  start                Launch the Web Studio SPA + MCP & FFmpeg Engine
  doctor               Verify Node.js, FFmpeg, Provider SDK, MCP Bridge, and Studio build
  mcp-remote           Run a stdio MCP bridge connected to a live Open-DreamFlow cloud workspace
  canvas <action>      Control a live Open-DreamFlow canvas via MCP (list, get, create, rename,
                       organize, generate, connect, credits, sync-rates)
  help, --help, -h     Show this help message

Cloud / MCP Options ('mcp-remote' & 'canvas'):
  --url <url>          Workspace URL (default: $OPEN_DREAMFLOW_URL or ${DEFAULT_CLOUD_URL})
  --token <token>      Auth bearer token ($OPEN_DREAMFLOW_TOKEN)
  --email <email>      Auto-login email ($OPEN_DREAMFLOW_EMAIL)
  --passcode <code>    Auto-login passcode ($OPEN_DREAMFLOW_PASSCODE)

Canvas Subcommands:
  open-dreamflow canvas list
  open-dreamflow canvas get [--project canvas_default]
  open-dreamflow canvas create --name "Storyboard v2"
  open-dreamflow canvas rename --project canvas_default --name "Ramayana Visual Dev"
  open-dreamflow canvas organize [--project canvas_default]
  open-dreamflow canvas generate --project canvas_default --platform higgsfield --model gpt_image_2_6 --prompt "..."
  open-dreamflow canvas credits [--refresh]
  open-dreamflow canvas sync-rates
  open-dreamflow canvas media-audit [--project canvas_default]
  open-dreamflow canvas download --src /media/... --out ./shot.png [--name "Shot 01"]
  open-dreamflow canvas download-zip [--project canvas_default] [--nodes id1,id2] --out ./group.zip
`);
}

function parseSimpleFlags(args) {
  const out = { _: [] };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith('--')) {
      const eq = a.indexOf('=');
      if (eq > 2) {
        out[a.slice(2, eq)] = a.slice(eq + 1);
      } else {
        const key = a.slice(2);
        const next = args[i + 1];
        if (next !== undefined && !next.startsWith('--')) {
          out[key] = next;
          i++;
        } else {
          out[key] = true;
        }
      }
    } else {
      out._.push(a);
    }
  }
  return out;
}

async function resolveRemoteAuth(flags) {
  const baseUrl = String(
    flags.url || process.env.OPEN_DREAMFLOW_URL || DEFAULT_CLOUD_URL
  ).replace(/\/+$/, '');
  let token = String(flags.token || process.env.OPEN_DREAMFLOW_TOKEN || '').trim();
  const email = String(flags.email || process.env.OPEN_DREAMFLOW_EMAIL || '').trim();
  const passcode = String(flags.passcode || process.env.OPEN_DREAMFLOW_PASSCODE || '').trim();

  if (!token && email && passcode) {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, passcode }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.token) {
      throw new Error(`Login failed (${res.status}): ${data.error || 'Invalid credentials'}`);
    }
    token = String(data.token);
  }
  return { baseUrl, token };
}

async function callRemoteMcpRpc(baseUrl, token, payload, timeoutMs = 600_000) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${baseUrl}/mcp`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`MCP HTTP ${res.status}: ${text.slice(0, 240)}`);
  }
  return text ? JSON.parse(text) : null;
}

async function runMcpRemoteBridge(flagArgs) {
  const flags = parseSimpleFlags(flagArgs);
  const { baseUrl, token } = await resolveRemoteAuth(flags);
  const rl = readline.createInterface({ input: process.stdin, terminal: false });

  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let msg;
    try {
      msg = JSON.parse(trimmed);
    } catch {
      continue;
    }
    const isNotification = msg.id === undefined || msg.id === null;
    try {
      const rpcOut = await callRemoteMcpRpc(baseUrl, token, msg);
      if (!isNotification && rpcOut) {
        process.stdout.write(`${JSON.stringify(rpcOut)}\n`);
      }
    } catch (err) {
      if (!isNotification) {
        process.stdout.write(
          `${JSON.stringify({
            jsonrpc: '2.0',
            id: msg.id,
            error: {
              code: -32000,
              message: err instanceof Error ? err.message : String(err),
            },
          })}\n`
        );
      }
    }
  }
}

async function runCanvasCommand(subArgs) {
  const flags = parseSimpleFlags(subArgs);
  const action = flags._[0] || 'list';
  const { baseUrl, token } = await resolveRemoteAuth(flags);
  const projectId = String(flags.project || flags.projectId || 'canvas_default');

  const invokeTool = async (name, args = {}) => {
    const rpc = await callRemoteMcpRpc(baseUrl, token, {
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'tools/call',
      params: { name, arguments: args },
    });
    if (rpc?.error) {
      throw new Error(rpc.error.message || JSON.stringify(rpc.error));
    }
    if (rpc?.result?.isError) {
      throw new Error(rpc.result?.content?.[0]?.text || 'MCP tool returned an error');
    }
    return rpc?.result?.structuredContent || rpc?.result;
  };

  let out;
  switch (action) {
    case 'list':
      out = await invokeTool('canvas_list', {});
      break;
    case 'get':
      out = await invokeTool('canvas_get', { projectId });
      break;
    case 'create':
      out = await invokeTool('canvas_create', {
        name: String(flags.name || flags._[1] || 'Untitled Canvas'),
        ...(typeof flags.id === 'string' ? { id: flags.id } : {}),
        isSharedWithTeam: Boolean(flags.shared),
      });
      break;
    case 'rename':
      out = await invokeTool('canvas_rename', {
        projectId,
        name: String(flags.name || flags._[1] || ''),
      });
      break;
    case 'organize':
      out = await invokeTool('canvas_organize_layout', { projectId });
      break;
    case 'connect':
      out = await invokeTool('canvas_connect_edges', {
        projectId,
        edges: [
          {
            sourceId: String(flags.from || flags.source || ''),
            targetId: String(flags.to || flags.target || ''),
            kind: String(flags.kind || 'lineage'),
          },
        ],
      });
      break;
    case 'generate':
      out = await invokeTool('canvas_generate_node', {
        projectId,
        ...(typeof flags.node === 'string' ? { nodeId: flags.node } : {}),
        ...(typeof flags.title === 'string' ? { title: flags.title } : {}),
        kind: String(flags.kind || 'image'),
        platformId: String(flags.platform || 'higgsfield'),
        modelId: String(flags.model || 'gpt_image_2_6'),
        prompt: String(flags.prompt || ''),
        aspectRatio: String(flags.ratio || flags.aspectRatio || '16:9'),
        resolution: String(flags.resolution || '1K'),
        ...(typeof flags.quality === 'string' ? { quality: flags.quality } : {}),
        ...(flags.duration ? { durationSec: Number(flags.duration) } : {}),
        ...(typeof flags.ref === 'string' ? { referenceImages: flags.ref.split(',') } : {}),
        overwriteInPlace: Boolean(flags.overwrite),
      });
      break;
    case 'credits':
      out = await invokeTool('credits_summary', {
        forceRefresh: Boolean(flags.refresh),
      });
      break;
    case 'sync-rates':
      out = await invokeTool('credits_sync_rates', { force: true });
      break;
    case 'media-audit': {
      const projOut = await invokeTool('canvas_get', { projectId });
      const nodes = projOut?.project?.state?.nodes || [];
      const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};
      const results = [];
      for (const n of nodes) {
        const mediaSrc =
          n.kind === 'video'
            ? n.videoUrl
            : n.kind === 'audio'
            ? n.audioUrl
            : n.imageUrl || n.videoUrl;
        if (!mediaSrc) continue;
        const dlUrl = `${baseUrl}/api/media/download?src=${encodeURIComponent(mediaSrc)}&filename=${encodeURIComponent(n.title || n.id)}`;
        const headRes = await fetch(dlUrl, { method: 'HEAD', headers: authHeaders });
        results.push({
          nodeId: n.id,
          kind: n.kind,
          title: n.title,
          src: mediaSrc,
          status: headRes.status,
          ok: headRes.ok,
          contentType: headRes.headers.get('content-type'),
          bytes: Number(headRes.headers.get('content-length') || 0),
          contentDisposition: headRes.headers.get('content-disposition'),
        });
      }
      out = {
        ok: results.every((r) => r.ok && r.bytes > 0),
        projectId,
        checkedMediaNodes: results.length,
        passedMediaNodes: results.filter((r) => r.ok && r.bytes > 0).length,
        results,
      };
      break;
    }
    case 'download': {
      const src = String(flags.src || flags._[1] || '').trim();
      const outPath = String(flags.out || flags.o || '').trim();
      if (!src || !outPath) {
        throw new Error('Usage: open-dreamflow canvas download --src <url> --out <file> [--name <title>]');
      }
      const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};
      const dlUrl = `${baseUrl}/api/media/download?src=${encodeURIComponent(src)}${flags.name ? `&filename=${encodeURIComponent(String(flags.name))}` : ''}`;
      const res = await fetch(dlUrl, { headers: authHeaders });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Download failed (${res.status}): ${errText.slice(0, 240)}`);
      }
      const buf = Buffer.from(await res.arrayBuffer());
      fs.mkdirSync(path.dirname(path.resolve(outPath)), { recursive: true });
      fs.writeFileSync(outPath, buf);
      out = {
        ok: true,
        outPath: path.resolve(outPath),
        bytes: buf.length,
        contentType: res.headers.get('content-type'),
        contentDisposition: res.headers.get('content-disposition'),
      };
      break;
    }
    case 'download-zip': {
      const outPath = String(flags.out || flags.o || '').trim();
      if (!outPath) {
        throw new Error('Usage: open-dreamflow canvas download-zip [--project canvas_default] [--nodes id1,id2] --out <file.zip>');
      }
      const nodeIds = typeof flags.nodes === 'string'
        ? flags.nodes.split(',').map((s) => s.trim()).filter(Boolean)
        : undefined;
      const headers = { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
      const res = await fetch(`${baseUrl}/api/media/download-zip`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          projectId,
          ...(nodeIds && nodeIds.length > 0 ? { nodeIds } : {}),
          ...(typeof flags.name === 'string' ? { archiveName: flags.name } : {}),
        }),
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`ZIP download failed (${res.status}): ${errText.slice(0, 240)}`);
      }
      const buf = Buffer.from(await res.arrayBuffer());
      fs.mkdirSync(path.dirname(path.resolve(outPath)), { recursive: true });
      fs.writeFileSync(outPath, buf);
      out = {
        ok: true,
        outPath: path.resolve(outPath),
        bytes: buf.length,
        contentType: res.headers.get('content-type'),
        contentDisposition: res.headers.get('content-disposition'),
      };
      break;
    }
    default:
      throw new Error(`Unknown canvas subcommand "${action}". Run 'open-dreamflow --help'.`);
  }

  console.log(JSON.stringify(out, null, 2));
}

function resolveFfmpeg(explicitEnv, candidates, fallbackCmd) {
  if (explicitEnv && fs.existsSync(explicitEnv)) {
    return { available: true, binPath: explicitEnv };
  }
  for (const c of candidates) {
    if (fs.existsSync(c)) {
      return { available: true, binPath: c };
    }
  }
  const probe = spawnSync(fallbackCmd, ['-version'], { stdio: 'pipe', encoding: 'utf8' });
  if (probe.status === 0) {
    return { available: true, binPath: fallbackCmd };
  }
  return { available: false, binPath: fallbackCmd };
}

function runDoctor() {
  const nodeMajor = Number(process.versions.node.split('.')[0] || 0);
  const nodeOk = nodeMajor >= 18;

  const ffmpegInfo = resolveFfmpeg(
    process.env.FFMPEG_PATH,
    ['/Users/seba/.local/bin/ffmpeg', '/opt/homebrew/bin/ffmpeg', '/usr/local/bin/ffmpeg', '/usr/bin/ffmpeg'],
    'ffmpeg'
  );
  const ffprobeInfo = resolveFfmpeg(
    process.env.FFPROBE_PATH,
    ['/Users/seba/.local/bin/ffprobe', '/opt/homebrew/bin/ffprobe', '/usr/local/bin/ffprobe', '/usr/bin/ffprobe'],
    'ffprobe'
  );

  const sdkDistPath = path.join(REPO_ROOT, 'packages/provider-sdk/dist/index.js');
  const mcpDistPath = path.join(REPO_ROOT, 'packages/mcp-client/dist/server-bridge.js');
  const studioIndexPath = path.join(REPO_ROOT, 'apps/web-studio/dist/index.html');
  const brandAssetPath = path.join(REPO_ROOT, 'apps/web-studio/public/brands/higgsfield.png');

  const sdkOk = fs.existsSync(sdkDistPath);
  const mcpOk = fs.existsSync(mcpDistPath);
  const studioOk = fs.existsSync(studioIndexPath);
  const brandsOk = fs.existsSync(brandAssetPath);

  console.log('Open-DreamFlow Environment Doctor');
  console.log('────────────────────────────────────────────────────────');
  console.log(`  [${nodeOk ? '✓' : '✗'}] Node.js Runtime       v${process.versions.node} (>= 18 required)`);
  console.log(`  [${ffmpegInfo.available ? '✓' : '✗'}] FFmpeg Engine         ${ffmpegInfo.available ? ffmpegInfo.binPath : 'NOT FOUND'}`);
  console.log(`  [${ffprobeInfo.available ? '✓' : '✗'}] FFprobe Inspector     ${ffprobeInfo.available ? ffprobeInfo.binPath : 'NOT FOUND'}`);
  console.log(`  [${sdkOk ? '✓' : '✗'}] Provider SDK Build    ${sdkOk ? 'packages/provider-sdk/dist/index.js' : 'MISSING (run npm run build:sdk)'}`);
  console.log(`  [${mcpOk ? '✓' : '✗'}] 22-Tool MCP Engine    ${mcpOk ? 'packages/mcp-client/dist/server-bridge.js' : 'MISSING (run npm run build:mcp)'}`);
  console.log(`  [${studioOk ? '✓' : '!'}] Web Studio SPA Build  ${studioOk ? 'apps/web-studio/dist/index.html' : 'not built yet (run npm run build)'}`);
  console.log(`  [${brandsOk ? '✓' : '!'}] Official Brand Assets ${brandsOk ? 'apps/web-studio/public/brands/*' : 'missing brand logos'}`);
  console.log('────────────────────────────────────────────────────────');

  if (!nodeOk || !ffmpegInfo.available || !mcpOk) {
    console.error('Doctor found missing required dependencies.');
    process.exit(1);
  }

  console.log('All core Open-DreamFlow runtime checks passed.');
  process.exit(0);
}

async function runStart(flagArgs) {
  if (!process.env.DREAMFLOW_DATA_DIR && process.env.OPEN_DREAMFLOW_DATA_DIR) {
    process.env.DREAMFLOW_DATA_DIR = process.env.OPEN_DREAMFLOW_DATA_DIR;
  }
  const mcpDistPath = path.join(REPO_ROOT, 'packages/mcp-client/dist/server-bridge.js');
  if (!fs.existsSync(mcpDistPath)) {
    console.error('Error: packages/mcp-client/dist/server-bridge.js not found. Run `npm run build:mcp` first.');
    process.exit(1);
  }

  const bridgeModule = await import(pathToFileURL(mcpDistPath).href);
  const cliOpts = bridgeModule.parseBridgeCliArgs(flagArgs);
  const server = new bridgeModule.McpStdioBridgeServer(cliOpts);
  const started = await server.start();

  const displayHost = started.host === '0.0.0.0' ? 'localhost' : started.host;
  if (!cliOpts.quiet) {
    console.log(`
Open-DreamFlow Studio & 22-Tool MCP Engine Ready
  • Web Studio SPA:   http://${displayHost}:${started.port}/
  • MCP HTTP/WS:      ${started.httpUrl}  |  ${started.wsUrl}
  • Chrome Bridge:    ${started.bridgeWsUrl}
`);
  }

  const shutdown = () => {
    void server.stop().finally(() => process.exit(0));
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

const rawArgs = process.argv.slice(2);
const firstArg = rawArgs[0] || 'start';

if (firstArg === '--help' || firstArg === '-h' || firstArg === 'help') {
  printHelp();
  process.exit(0);
} else if (firstArg === 'doctor') {
  runDoctor();
} else if (firstArg === 'mcp-remote') {
  runMcpRemoteBridge(rawArgs.slice(1)).catch((err) => {
    console.error('[open-dreamflow mcp-remote] Error:', err);
    process.exit(1);
  });
} else if (firstArg === 'canvas') {
  runCanvasCommand(rawArgs.slice(1)).catch((err) => {
    console.error('[open-dreamflow canvas] Error:', err instanceof Error ? err.message : err);
    process.exit(1);
  });
} else if (firstArg === 'start' || firstArg.startsWith('-')) {
  const startArgs = firstArg === 'start' ? rawArgs.slice(1) : rawArgs;
  runStart(startArgs).catch((err) => {
    console.error('[open-dreamflow] Startup error:', err);
    process.exit(1);
  });
} else {
  console.error(`Unknown command: ${firstArg}`);
  printHelp();
  process.exit(1);
}
