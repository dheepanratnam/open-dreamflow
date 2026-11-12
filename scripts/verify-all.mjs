#!/usr/bin/env node
/**
 * Open-DreamFlow — Automated Monorepo End-to-End Verification Suite
 *
 * Verifies:
 *   1. @open-dreamflow/provider-sdk build & runtime router / zero-markup cost engine
 *   2. @open-dreamflow/mcp-client live HTTP JSON-RPC roundtrip & Canvas Node schema mapper
 *   3. extensions/chrome-bridge Manifest V3 schema, icons & JS syntax (`node --check`)
 *   4. @open-dreamflow/web-studio production Vite bundle integrity (`dist/`)
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..');

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Verification failed: ${message}`);
  }
}

function logStep(step, detail) {
  console.log(`  ✓ [${step}] ${detail}`);
}

async function verifyProviderSdk() {
  const sdkDist = path.join(ROOT, 'packages/provider-sdk/dist/index.js');
  assert(fs.existsSync(sdkDist), 'packages/provider-sdk/dist/index.js missing (run npm run build:sdk)');

  const sdk = await import(pathToFileURL(sdkDist).href);
  assert(typeof sdk.DreamFlowProviderRouter === 'function', 'DreamFlowProviderRouter export missing');
  assert(typeof sdk.GeminiOmniClient === 'function', 'GeminiOmniClient export missing');
  assert(typeof sdk.SeedanceClient === 'function', 'SeedanceClient export missing');
  assert(typeof sdk.FalClient === 'function', 'FalClient export missing');
  assert(typeof sdk.ReplicateClient === 'function', 'ReplicateClient export missing');
  assert(typeof sdk.ComfyUIClient === 'function', 'ComfyUIClient export missing');
  assert(typeof sdk.estimateZeroMarkupCost === 'function', 'estimateZeroMarkupCost export missing');

  const router = new sdk.DreamFlowProviderRouter({
    gemini: 'test-gemini-key',
    seedance: 'test-seedance-key',
    fal: 'test-fal-key',
  });
  const configured = router.listConfiguredProviders();
  assert(configured.includes('gemini-omni'), 'gemini-omni should be registered');
  assert(configured.includes('seedance'), 'seedance should be registered');
  assert(configured.includes('comfyui'), 'comfyui local GPU should always be registered');

  const cost = sdk.estimateZeroMarkupCost({
    provider: 'gemini-omni',
    durationSeconds: 15,
    resolution: '1080p',
  });
  assert(cost.openDreamFlowMarkupUsd === 0, 'Open-DreamFlow markup must strictly equal $0');
  assert(cost.rawProviderCostUsd > 0, 'Raw Gemini Omni 15s estimate must be positive');

  logStep(
    'provider-sdk',
    `Verified 6 BYOK/Local GPU clients + $0 markup estimator (15s 1080p Omni = $${cost.rawProviderCostUsd})`
  );
}

async function verifyMcpClientAndBridge() {
  const mcpIndex = path.join(ROOT, 'packages/mcp-client/dist/index.js');
  const mcpBridge = path.join(ROOT, 'packages/mcp-client/dist/server-bridge.js');
  assert(fs.existsSync(mcpIndex), 'packages/mcp-client/dist/index.js missing (run npm run build:mcp)');
  assert(fs.existsSync(mcpBridge), 'packages/mcp-client/dist/server-bridge.js missing');

  const { UniversalMcpClient, convertToolsToCanvasNodes } = await import(pathToFileURL(mcpIndex).href);
  const { McpStdioBridgeServer } = await import(pathToFileURL(mcpBridge).href);

  const testPort = 13800 + Math.floor(Math.random() * 1000);
  const bridge = new McpStdioBridgeServer({ host: '127.0.0.1', port: testPort, quiet: true });
  await bridge.start();

  try {
    const client = new UniversalMcpClient({
      url: `http://127.0.0.1:${testPort}/mcp`,
      transport: 'http',
    });
    await client.connect();
    const tools = await client.listTools();
    assert(tools.length >= 4, `Expected >= 4 built-in MCP tools, got ${tools.length}`);

    const nodeSchemas = convertToolsToCanvasNodes(tools);
    const names = nodeSchemas.map((s) => s.toolName || s.id);
    for (const expected of ['generate_video', 'inpaint_frame', 'extract_style_dna', 'flow_scene_builder']) {
      assert(names.includes(expected), `Missing mapped Canvas Node schema for MCP tool: ${expected}`);
    }

    const callRes = await client.callTool('extract_style_dna', {
      reference_images: ['data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='],
      lock_strength: 0.9,
    });
    assert(callRes && !callRes.isError, 'MCP tools/call extract_style_dna returned an error');

    await client.disconnect();
    logStep(
      'mcp-client',
      `Live JSON-RPC HTTP roundtrip on :${testPort} verified (${names.join(', ')})`
    );
  } finally {
    await bridge.stop();
  }
}

function verifyChromeBridgeExtension() {
  const extDir = path.join(ROOT, 'extensions/chrome-bridge');
  const manifestPath = path.join(extDir, 'manifest.json');
  assert(fs.existsSync(manifestPath), 'extensions/chrome-bridge/manifest.json missing');

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  assert(manifest.manifest_version === 3, 'Chrome extension must use Manifest V3');
  const hosts = JSON.stringify(manifest.host_permissions || []);
  assert(hosts.includes('flow.google.com'), 'Manifest missing flow.google.com host permission');
  assert(hosts.includes('dreamina.capcut.com'), 'Manifest missing dreamina.capcut.com host permission');

  const scripts = [
    'background.js',
    'content-flow.js',
    'content-dreamina.js',
    'content-studio.js',
    'popup.js',
  ];
  for (const script of scripts) {
    const full = path.join(extDir, script);
    assert(fs.existsSync(full), `Missing Chrome extension script: ${script}`);
    execFileSync(process.execPath, ['--check', full], { stdio: 'pipe' });
  }

  for (const size of ['16', '48', '128']) {
    const icon = path.join(extDir, 'icons', `icon${size}.png`);
    assert(fs.existsSync(icon) && fs.statSync(icon).size > 100, `Missing/empty icon${size}.png`);
  }

  const bgSource = fs.readFileSync(path.join(extDir, 'background.js'), 'utf8');
  assert(bgSource.includes('isKnownJobId'), 'background.js missing jobId deduplication guard');

  logStep(
    'chrome-bridge',
    `Manifest V3 v${manifest.version}, 3 icons, and ${scripts.length} scripts syntax-checked`
  );
}

function verifyWebStudioBundle() {
  const distDir = path.join(ROOT, 'apps/web-studio/dist');
  const indexHtml = path.join(distDir, 'index.html');
  assert(
    fs.existsSync(indexHtml),
    'apps/web-studio/dist/index.html missing (run npm run build first)'
  );

  const html = fs.readFileSync(indexHtml, 'utf8');
  assert(html.includes('<div id="root"></div>'), 'dist/index.html missing React #root mount');

  const assetsDir = path.join(distDir, 'assets');
  assert(fs.existsSync(assetsDir), 'apps/web-studio/dist/assets missing');
  const assets = fs.readdirSync(assetsDir);
  const jsFiles = assets.filter((f) => f.endsWith('.js'));
  const cssFiles = assets.filter((f) => f.endsWith('.css'));
  assert(jsFiles.length >= 1, 'No compiled JS bundle in apps/web-studio/dist/assets');
  assert(cssFiles.length >= 1, 'No compiled CSS bundle in apps/web-studio/dist/assets');

  const jsSizeKb = (fs.statSync(path.join(assetsDir, jsFiles[0])).size / 1024).toFixed(1);
  const cssSizeKb = (fs.statSync(path.join(assetsDir, cssFiles[0])).size / 1024).toFixed(1);

  logStep(
    'web-studio',
    `Production Vite bundle verified (${jsFiles[0]} = ${jsSizeKb} kB, ${cssFiles[0]} = ${cssSizeKb} kB)`
  );
}

async function main() {
  console.log('\nOpen-DreamFlow — Running End-to-End Verification Suite...');
  await verifyProviderSdk();
  await verifyMcpClientAndBridge();
  verifyChromeBridgeExtension();
  verifyWebStudioBundle();
  console.log('All 4 Open-DreamFlow subsystems passed verification with 0 errors!\n');
}

main().catch((err) => {
  console.error('\n[FAIL]', err instanceof Error ? err.message : err);
  process.exit(1);
});
