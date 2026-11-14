#!/usr/bin/env node
/**
 * Open-DreamFlow Unified Open-Source CLI (`open-dreamflow`)
 *
 * Commands:
 *   open-dreamflow start [--port 3001] [--host 127.0.0.1]
 *   open-dreamflow doctor
 *   open-dreamflow --help
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');

function printHelp() {
  console.log(`
Open-DreamFlow v1.0.0 — Open-Source Spatial AI Film Studio & 12-Tool MCP Engine

Usage:
  open-dreamflow <command> [options]

Commands:
  start                Launch the unified Web Studio SPA + 12-Tool MCP & FFmpeg Engine
  doctor               Verify Node.js, FFmpeg, Provider SDK, MCP Bridge, and Studio build
  help, --help, -h     Show this help message

Options for 'start':
  --port, -p <port>    Port to bind (default: 3001 or $PORT)
  --host <host>        Host interface to bind (default: 127.0.0.1 or $HOST)
  --media-dir <path>   Custom media output directory
  --data-dir <path>    Custom project database directory
  --quiet, -q          Suppress startup banner logs

Examples:
  npx open-dreamflow doctor
  npx open-dreamflow start --port 3001
`);
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
  console.log(`  [${mcpOk ? '✓' : '✗'}] 12-Tool MCP Engine    ${mcpOk ? 'packages/mcp-client/dist/server-bridge.js' : 'MISSING (run npm run build:mcp)'}`);
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
Open-DreamFlow Studio & 12-Tool MCP Engine Ready
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
