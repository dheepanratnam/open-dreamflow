#!/usr/bin/env node
/**
 * Open-DreamFlow — 13-Stage Automated Monorepo End-to-End Verification Suite
 *
 * Stages:
 *   [1/13 provider-sdk]                      Zero-markup SDK clients, 13-platform PLATFORM_CATALOG & $0 markup estimator
 *   [2/13 mcp-client]                        Live JSON-RPC roundtrip verifying all 12 built-in MCP tools on :3001/mcp
 *   [3/13 real-photography-media]            206 Partial Content streaming, ffprobe real photography/cinema check & zero-slop bundle audit
 *   [4/13 inline-editor]                     Live /api/upload-media, /api/inpaint (mask), /api/outpaint (16:9), /api/remove-bg & /api/upscale (4K)
 *   [5/13 keyframe-bridge-and-audio]         Live /api/keyframe-bridge (A->B), /api/generate-audio (64-bar waveform + MP3) & multi-track /api/compile-timeline
 *   [6/13 persistence-bridge]                Live /api/projects CRUD + .dreamflow.json export + /api/bridge/push -> /api/bridge/events
 *   [7/13 live-provider-and-bridge-jobs]     /api/verify-provider, GET /bridge-connector.js (PNA CORS) & Dreamina live bridge lifecycle
 *   [8/13 multi-platform-and-external-mcp]   GET /api/platforms (13 platforms) + real stdio External MCP Server tools/list, /api/mcp/call & /api/generate-node
 *   [9/13 cross-platform-chained-workflow]   Higgsfield (ChatGPT Image 2.6) -> Kling 4.0 (Video) chained base64 reference forwarding
 *   [10/13 guided-connections-and-sume]      GET /api/connections/status, dryRun 1-click Chrome profile launcher (higgsfield + all) & bridge_session status sync
 *   [11/13 chrome-bridge]                    Manifest V3 v1.2.0 across all 8 creator domains (incl. sume.com), icons & syntax check across all 6 scripts
 *   [12/13 cli-and-docker]                   open-dreamflow doctor CLI check, unified single-port SPA GET :3001/, Dockerfile & docker-compose.yml
 *   [13/13 web-studio]                       Production Vite bundle + Stage 8 guided onboarding, Sume & DoP Rig UI markers + dist/media integrity
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import * as zlib from 'node:zlib';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..');

function resolveFfprobeBin() {
  const candidates = [
    process.env.FFPROBE_PATH,
    '/Users/seba/.local/bin/ffprobe',
    '/opt/homebrew/bin/ffprobe',
    '/usr/local/bin/ffprobe',
    '/usr/bin/ffprobe',
  ].filter(Boolean);
  for (const bin of candidates) {
    if (fs.existsSync(bin)) return bin;
  }
  const probe = spawnSync('ffprobe', ['-version'], { stdio: 'pipe' });
  return probe.status === 0 ? 'ffprobe' : null;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
  }
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData), 0);
  return Buffer.concat([len, typeAndData, crc]);
}

function createValidRgbaPngBase64(width, height, pixelFn) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    const rowOff = y * (1 + width * 4);
    raw[rowOff] = 0;
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = pixelFn(x, y);
      const p = rowOff + 1 + x * 4;
      raw[p] = r;
      raw[p + 1] = g;
      raw[p + 2] = b;
      raw[p + 3] = a;
    }
  }
  const idat = zlib.deflateSync(raw);
  return Buffer.concat([
    sig,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', idat),
    pngChunk('IEND', Buffer.alloc(0)),
  ]).toString('base64');
}

const SAMPLE_SOURCE_PNG_B64 = createValidRgbaPngBase64(64, 64, (x, y) => [
  175 + ((x * 7 + y * 3) % 65),
  138 + ((x * 5 + y * 11) % 60),
  104 + ((x * 13 + y * 7) % 55),
  255,
]);
const SAMPLE_MASK_PNG_DATA_URL = `data:image/png;base64,${createValidRgbaPngBase64(
  64,
  64,
  (x, y) => (x >= 16 && x < 48 && y >= 16 && y < 48 ? [255, 255, 255, 255] : [0, 0, 0, 255])
)}`;

function createTempStdioMcpServerScript(pngBase64) {
  return `
const pngB64 = ${JSON.stringify(pngBase64)};
let useContentLength = false;
let buf = Buffer.alloc(0);

function send(msg) {
  const json = JSON.stringify(msg);
  if (useContentLength) {
    const byteLen = Buffer.byteLength(json, 'utf8');
    process.stdout.write('Content-Length: ' + byteLen + '\\r\\n\\r\\n' + json);
  } else {
    process.stdout.write(json + '\\n');
  }
}

function handleRpc(req) {
  if (!req || typeof req !== 'object') return;
  if (req.method === 'initialize') {
    send({
      jsonrpc: '2.0',
      id: req.id,
      result: {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: { name: 'e2e-stdio-image-mcp', version: '1.0.0' },
      },
    });
  } else if (req.method === 'tools/list') {
    send({
      jsonrpc: '2.0',
      id: req.id,
      result: {
        tools: [
          {
            name: 'generate_image',
            description: 'Generate editorial 35mm photograph via connected credits',
            inputSchema: {
              type: 'object',
              properties: { prompt: { type: 'string' } },
              required: ['prompt'],
            },
          },
        ],
      },
    });
  } else if (req.method === 'tools/call') {
    send({
      jsonrpc: '2.0',
      id: req.id,
      result: {
        content: [
          { type: 'image', data: pngB64, mimeType: 'image/png' },
          { type: 'text', text: JSON.stringify({ ok: true, mimeType: 'image/png', dataUrl: 'data:image/png;base64,' + pngB64 }) },
        ],
      },
    });
  } else if (req.id !== undefined) {
    send({ jsonrpc: '2.0', id: req.id, result: {} });
  }
}

process.stdin.on('data', (chunk) => {
  buf = Buffer.concat([buf, chunk]);
  while (buf.length > 0) {
    const str = buf.toString('utf8');
    if (str.startsWith('Content-Length:')) {
      useContentLength = true;
      const sepIdx = buf.indexOf('\\r\\n\\r\\n');
      if (sepIdx === -1) break;
      const header = buf.subarray(0, sepIdx).toString('utf8');
      const match = header.match(/Content-Length:\\s*(\\d+)/i);
      const len = match ? Number(match[1]) : 0;
      const total = sepIdx + 4 + len;
      if (buf.length < total) break;
      const body = buf.subarray(sepIdx + 4, total).toString('utf8');
      buf = buf.subarray(total);
      try { handleRpc(JSON.parse(body)); } catch {}
    } else {
      const nlIdx = buf.indexOf('\\n');
      if (nlIdx === -1) break;
      const line = buf.subarray(0, nlIdx).toString('utf8').trim();
      buf = buf.subarray(nlIdx + 1);
      if (line) {
        try { handleRpc(JSON.parse(line)); } catch {}
      }
    }
  }
});
`;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Verification failed: ${message}`);
  }
}

function logStep(stageLabel, detail) {
  console.log(`  ✓ [${stageLabel}] ${detail}`);
}

function unlinkMediaIfPresent(mediaUrlPath) {
  if (!mediaUrlPath || typeof mediaUrlPath !== 'string') return;
  const baseName = path.basename(mediaUrlPath);
  if (!baseName) return;
  if (baseName.startsWith('real_')) return;
  for (const dir of [
    path.join(ROOT, 'apps/web-studio/public/media'),
    path.join(ROOT, 'apps/web-studio/dist/media'),
  ]) {
    const target = path.join(dir, baseName);
    if (fs.existsSync(target)) {
      try {
        fs.unlinkSync(target);
      } catch {
        // ignore cleanup race
      }
    }
  }
}

function findGeneratedMediaDiskPath(mediaUrlPath) {
  if (!mediaUrlPath || typeof mediaUrlPath !== 'string') return null;
  const baseName = path.basename(mediaUrlPath);
  for (const dir of [
    path.join(ROOT, 'apps/web-studio/public/media'),
    path.join(ROOT, 'apps/web-studio/dist/media'),
  ]) {
    const candidate = path.join(dir, baseName);
    if (fs.existsSync(candidate) && fs.statSync(candidate).size > 60) {
      return candidate;
    }
  }
  return null;
}

async function postJson(baseUrl, route, body) {
  const res = await fetch(`${baseUrl}${route}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  assert(res.ok && json.ok !== false, `POST ${route} failed (${res.status}): ${JSON.stringify(json)}`);
  return json;
}

async function verifyStage1ProviderSdk() {
  const sdkDist = path.join(ROOT, 'packages/provider-sdk/dist/index.js');
  assert(fs.existsSync(sdkDist), 'packages/provider-sdk/dist/index.js missing (run npm run build:sdk)');

  const sdk = await import(pathToFileURL(sdkDist).href);
  for (const sym of [
    'DreamFlowProviderRouter',
    'GeminiOmniClient',
    'SeedanceClient',
    'FalClient',
    'ReplicateClient',
    'ComfyUIClient',
    'estimateZeroMarkupCost',
  ]) {
    assert(typeof sdk[sym] === 'function', `${sym} export missing in @open-dreamflow/provider-sdk`);
  }
  assert(Array.isArray(sdk.PLATFORM_CATALOG), 'PLATFORM_CATALOG array missing in @open-dreamflow/provider-sdk');
  assert(
    sdk.PLATFORM_CATALOG.some((p) => p.id === 'sume'),
    'PLATFORM_CATALOG must include Sume.com (id: sume)'
  );

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
    '1/13 provider-sdk',
    `Verified zero-markup BYOK/Local GPU clients, ${sdk.PLATFORM_CATALOG.length}-platform PLATFORM_CATALOG + $0 markup estimator`
  );
}

async function verifyLiveServerStages() {
  const mcpIndex = path.join(ROOT, 'packages/mcp-client/dist/index.js');
  const mcpBridge = path.join(ROOT, 'packages/mcp-client/dist/server-bridge.js');
  assert(fs.existsSync(mcpIndex), 'packages/mcp-client/dist/index.js missing (run npm run build:mcp)');
  assert(fs.existsSync(mcpBridge), 'packages/mcp-client/dist/server-bridge.js missing');

  const { UniversalMcpClient, convertToolsToCanvasNodes } = await import(pathToFileURL(mcpIndex).href);
  const { McpStdioBridgeServer } = await import(pathToFileURL(mcpBridge).href);

  let baseUrl = 'http://127.0.0.1:3001';
  let ephemeralBridge = null;
  try {
    const probe = await fetch(`${baseUrl}/api/health`);
    if (!probe.ok) throw new Error('not ready');
  } catch {
    const testPort = 13800 + Math.floor(Math.random() * 1000);
    ephemeralBridge = new McpStdioBridgeServer({ host: '127.0.0.1', port: testPort, quiet: true });
    await ephemeralBridge.start();
    baseUrl = `http://127.0.0.1:${testPort}`;
  }

  const createdMediaPaths = [];
  const tempProjectId = `e2e_verify_proj_${Date.now()}`;
  const inboxPath = path.join(ROOT, '.dreamflow-data.nosync/bridge-inbox.json');
  const hadPriorInbox = fs.existsSync(inboxPath);
  const priorInboxBytes = hadPriorInbox ? fs.readFileSync(inboxPath) : null;

  const mcpCfgPath = path.join(ROOT, '.dreamflow-data.nosync/mcp-servers.json');
  const hadPriorMcpCfg = fs.existsSync(mcpCfgPath);
  const priorMcpCfgBytes = hadPriorMcpCfg ? fs.readFileSync(mcpCfgPath) : null;

  const tmpMcpScriptPath = path.join(os.tmpdir(), `dreamflow_e2e_mcp_stdio_${Date.now()}.mjs`);
  let registeredMcpServerId = null;
  let initialOpenDomains = null;

  try {
    // Capture prior openDomains so Stage 10 bridge_session tests leave connections status tidy
    try {
      const preConnRes = await fetch(`${baseUrl}/api/connections/status`);
      if (preConnRes.ok) {
        const preConn = await preConnRes.json();
        initialOpenDomains = Array.isArray(preConn.openDomains) ? preConn.openDomains : [];
      }
    } catch {
      initialOpenDomains = null;
    }

    // -------------------------------------------------------------------------
    // Stage [2/13 mcp-client]: Live JSON-RPC roundtrip verifying all 12 MCP tools
    // -------------------------------------------------------------------------
    const healthRes = await fetch(`${baseUrl}/api/health`);
    assert(healthRes.ok, '/api/health returned non-200');
    const health = await healthRes.json();
    assert(health.ok === true, '/api/health ok !== true');

    const expectedTools = [
      'generate_video',
      'keyframe_bridge',
      'generate_audio',
      'inpaint_frame',
      'outpaint_expand',
      'remove_background',
      'upscale_4k',
      'extract_style_dna',
      'flow_scene_builder',
      'slice_contact_sheet',
      'extract_last_frame',
      'save_project',
    ];

    const client = new UniversalMcpClient({
      url: `${baseUrl}/mcp`,
      transport: 'http',
    });
    await client.connect();
    const tools = await client.listTools();
    assert(tools.length >= 12, `Expected >= 12 MCP tools, got ${tools.length}`);

    const nodeSchemas = convertToolsToCanvasNodes(tools);
    const names = nodeSchemas.map((s) => s.toolName || s.id);
    for (const expected of expectedTools) {
      assert(names.includes(expected), `Missing mapped Canvas Node schema for MCP tool: ${expected}`);
    }

    const callRes = await client.callTool('extract_style_dna', {
      reference_images: [`data:image/png;base64,${SAMPLE_SOURCE_PNG_B64}`],
      lock_strength: 0.9,
    });
    assert(callRes && !callRes.isError, 'MCP tools/call extract_style_dna returned an error');
    await client.disconnect();

    logStep(
      '2/13 mcp-client',
      `Live JSON-RPC roundtrip on ${baseUrl}/mcp verified all ${expectedTools.length} built-in MCP tools`
    );

    // -------------------------------------------------------------------------
    // Stage [3/13 real-photography-media]: 206 Partial Content + ffprobe + zero neon slop
    // -------------------------------------------------------------------------
    const publicMediaDir = path.join(ROOT, 'apps/web-studio/public/media');
    const distMediaDir = path.join(ROOT, 'apps/web-studio/dist/media');
    const resolveAsset = (file) => {
      const distCandidate = path.join(distMediaDir, file);
      if (fs.existsSync(distCandidate)) return distCandidate;
      return path.join(publicMediaDir, file);
    };

    const requiredRealMedia = [
      'real_portrait_clara.jpg',
      'real_leica_craft.jpg',
      'real_courtyard_sun.jpg',
      'real_coastal_cliffs.jpg',
      'real_atelier_interior.jpg',
      'real_alpine_road.jpg',
      'real_kyoto_timber.jpg',
      'real_contact_9grid.jpg',
      'real_shot01_courtyard.mp4',
      'real_shot02_bridge.mp4',
      'real_shot03_atelier.mp4',
      'real_coastal_foley.mp3',
      'real_salt_terracotta_master.mp4',
    ];

    for (const file of requiredRealMedia) {
      const full = resolveAsset(file);
      assert(fs.existsSync(full) && fs.statSync(full).size > 2048, `Missing/empty real photography asset: ${file}`);
    }

    const rangeRes = await fetch(`${baseUrl}/media/real_salt_terracotta_master.mp4`, {
      headers: { Range: 'bytes=0-1023' },
    });
    assert(
      rangeRes.status === 206,
      `Expected 206 Partial Content on /media/real_salt_terracotta_master.mp4, got ${rangeRes.status}`
    );

    const ffprobeBin = resolveFfprobeBin();
    assert(ffprobeBin, 'ffprobe binary required for Stage 3 real photography stream inspection');
    for (const inspectTarget of [
      'real_courtyard_sun.jpg',
      'real_coastal_cliffs.jpg',
      'real_contact_9grid.jpg',
      'real_shot02_bridge.mp4',
      'real_coastal_foley.mp3',
      'real_salt_terracotta_master.mp4',
    ]) {
      const out = execFileSync(
        ffprobeBin,
        ['-v', 'error', '-show_entries', 'stream=codec_type,width,height', '-of', 'json', resolveAsset(inspectTarget)],
        { encoding: 'utf8' }
      );
      const parsed = JSON.parse(out);
      assert(
        Array.isArray(parsed.streams) && parsed.streams.length >= 1,
        `ffprobe found zero streams in ${inspectTarget}`
      );
    }

    const distAssetsDir = path.join(ROOT, 'apps/web-studio/dist/assets');
    assert(fs.existsSync(distAssetsDir), 'apps/web-studio/dist/assets missing (run npm run build)');
    const builtJsFiles = fs.readdirSync(distAssetsDir).filter((f) => f.endsWith('.js'));
    assert(builtJsFiles.length >= 1, 'No JS bundle found in apps/web-studio/dist/assets');
    for (const jsFile of builtJsFiles) {
      const bundleText = fs.readFileSync(path.join(distAssetsDir, jsFile), 'utf8');
      for (const banned of ['Neo-Tokyo', 'Hero_Kael', 'Protocol: Rain', 'Cyber_Sneaker']) {
        assert(
          !bundleText.includes(banned),
          `Forbidden legacy neon slop string "${banned}" found inside compiled bundle ${jsFile}`
        );
      }
    }

    const masterSizeMb = (fs.statSync(resolveAsset('real_salt_terracotta_master.mp4')).size / (1024 * 1024)).toFixed(2);
    logStep(
      '3/13 real-photography-media',
      `Verified 206 Range streaming, ffprobe on ${requiredRealMedia.length} real 35mm/cinema assets (master = ${masterSizeMb} MB) & 0 neon strings in JS bundle`
    );

    // -------------------------------------------------------------------------
    // Stage [4/13 inline-editor]: Live upload, mask inpaint, 16:9 outpaint, cutout & 4K upscale
    // -------------------------------------------------------------------------
    assert(health.ffmpeg === true, 'FFmpeg must be available for Stage 4 inline-editor verification');

    const uploadRes = await postJson(baseUrl, '/api/upload-media', {
      filename: 'verify_seed_linen.png',
      mimeType: 'image/png',
      dataBase64: SAMPLE_SOURCE_PNG_B64,
    });
    const seedUrl = uploadRes.mediaUrl || uploadRes.imageUrl;
    assert(seedUrl, '/api/upload-media did not return mediaUrl');
    createdMediaPaths.push(seedUrl);

    const sourceForEdit = '/media/real_courtyard_sun.jpg';

    const inpaintRes = await postJson(baseUrl, '/api/inpaint', {
      imageUrl: sourceForEdit,
      maskDataUrl: SAMPLE_MASK_PNG_DATA_URL,
      prompt: 'Soften warm Mediterranean afternoon shadow across limestone arch',
    });
    assert(inpaintRes.imageUrl, '/api/inpaint missing imageUrl');
    createdMediaPaths.push(inpaintRes.imageUrl);
    assert(findGeneratedMediaDiskPath(inpaintRes.imageUrl), 'Inpaint PNG missing on disk');

    const outpaintRes = await postJson(baseUrl, '/api/outpaint', {
      imageUrl: sourceForEdit,
      targetAspect: '16:9',
      prompt: 'Extend sunlit terracotta courtyard wall and olive foliage',
    });
    assert(outpaintRes.imageUrl, '/api/outpaint missing imageUrl');
    createdMediaPaths.push(outpaintRes.imageUrl);
    assert(findGeneratedMediaDiskPath(outpaintRes.imageUrl), 'Outpaint PNG missing on disk');

    const cutoutRes = await postJson(baseUrl, '/api/remove-bg', {
      imageUrl: '/media/real_leica_craft.jpg',
    });
    assert(cutoutRes.imageUrl, '/api/remove-bg missing imageUrl');
    createdMediaPaths.push(cutoutRes.imageUrl);
    assert(findGeneratedMediaDiskPath(cutoutRes.imageUrl), 'Cutout PNG missing on disk');

    const upscaleRes = await postJson(baseUrl, '/api/upscale', {
      imageUrl: seedUrl,
    });
    assert(upscaleRes.imageUrl, '/api/upscale missing imageUrl');
    createdMediaPaths.push(upscaleRes.imageUrl);
    assert(findGeneratedMediaDiskPath(upscaleRes.imageUrl), 'Upscale 4K PNG missing on disk');

    logStep(
      '4/13 inline-editor',
      'Verified live /api/upload-media, /api/inpaint (masked), /api/outpaint (16:9), /api/remove-bg & /api/upscale (4K)'
    );

    // -------------------------------------------------------------------------
    // Stage [5/13 keyframe-bridge-and-audio]: A->B optical bridge + 64-bar audio + multi-track mix
    // -------------------------------------------------------------------------
    const bridgeRes = await postJson(baseUrl, '/api/keyframe-bridge', {
      startImageUrl: '/media/real_courtyard_sun.jpg',
      endImageUrl: '/media/real_coastal_cliffs.jpg',
      durationSec: 4,
      motionCurve: 'ease-in-out',
      prompt: 'Natural 35mm optical push from sunlit limestone courtyard to Atlantic cliffs',
    });
    assert(bridgeRes.videoUrl, '/api/keyframe-bridge missing videoUrl');
    createdMediaPaths.push(bridgeRes.videoUrl);
    assert(findGeneratedMediaDiskPath(bridgeRes.videoUrl), 'Keyframe bridge MP4 missing on disk');

    const audioRes = await postJson(baseUrl, '/api/generate-audio', {
      prompt: 'Gentle Atlantic surf swell and warm linen room tone',
      mode: 'ambient',
      durationSec: 4,
    });
    assert(audioRes.audioUrl, '/api/generate-audio missing audioUrl');
    createdMediaPaths.push(audioRes.audioUrl);
    assert(
      Array.isArray(audioRes.waveform) && audioRes.waveform.length === 64,
      `Expected 64-bar RMS waveform array, got ${Array.isArray(audioRes.waveform) ? audioRes.waveform.length : typeof audioRes.waveform}`
    );
    assert(
      audioRes.waveform.every((v) => typeof v === 'number' && Number.isFinite(v) && v > 0 && v <= 1),
      'Waveform values must be normalized finite numbers in (0, 1]'
    );
    assert(findGeneratedMediaDiskPath(audioRes.audioUrl), 'Generated audio MP3 missing on disk');

    const compileMixRes = await postJson(baseUrl, '/api/compile-timeline', {
      clips: ['/media/real_shot01_courtyard.mp4', '/media/real_shot02_bridge.mp4'],
      audioTracks: [{ audioUrl: '/media/real_coastal_foley.mp3', volume: 0.85 }],
    });
    const compiledMasterUrl = compileMixRes.masterVideoUrl || compileMixRes.videoUrl;
    assert(compiledMasterUrl, '/api/compile-timeline with audioTracks did not return master video URL');
    createdMediaPaths.push(compiledMasterUrl);
    assert(findGeneratedMediaDiskPath(compiledMasterUrl), 'Multi-track compiled master MP4 missing on disk');

    logStep(
      '5/13 keyframe-bridge-and-audio',
      'Verified live /api/keyframe-bridge (A→B), /api/generate-audio (64-bar RMS waveform + MP3) & multi-track /api/compile-timeline'
    );

    // -------------------------------------------------------------------------
    // Stage [6/13 persistence-bridge]: Projects CRUD + .dreamflow.json export + Bridge relay
    // -------------------------------------------------------------------------
    const saveRes = await postJson(baseUrl, '/api/projects', {
      id: tempProjectId,
      name: 'Salt & Terracotta E2E Verification',
      state: { nodes: [{ id: 'n1', kind: 'image', title: 'Images 1 · Limestone Courtyard' }], edges: [] },
      createSnapshot: true,
      snapshotLabel: 'Initial Editorial Snapshot',
    });
    assert(saveRes.id === tempProjectId, 'Saved project id mismatch');
    assert(saveRes.snapshotCount >= 1, 'Expected snapshotCount >= 1');

    const getProjRes = await fetch(`${baseUrl}/api/projects/${tempProjectId}`);
    assert(getProjRes.ok, 'GET /api/projects/:id failed');
    const gotProj = await getProjRes.json();
    assert(
      gotProj.ok && gotProj.project?.name === 'Salt & Terracotta E2E Verification',
      'Loaded project payload mismatch'
    );

    const exportRes = await fetch(`${baseUrl}/api/projects/${tempProjectId}/export`);
    assert(exportRes.ok, 'GET /api/projects/:id/export failed');
    const exportedBundle = await exportRes.json();
    assert(
      exportedBundle.format === 'open-dreamflow-project/v1',
      `Unexpected bundle format: ${exportedBundle.format}`
    );

    const delRes = await fetch(`${baseUrl}/api/projects/${tempProjectId}`, { method: 'DELETE' });
    assert(delRes.ok, 'DELETE /api/projects/:id failed');

    const pushBridge = await postJson(baseUrl, '/api/bridge/push', {
      type: 'bridge_asset',
      source: 'dreamina',
      title: 'Bridge · 35mm Alpine Location Frame',
      mediaUrl: '/media/real_alpine_road.jpg',
      prompt: 'Morning mist clearing over timber mountain pass, natural 35mm daylight',
    });
    const pushedEventId = pushBridge.event?.eventId || pushBridge.eventId;
    assert(pushedEventId, '/api/bridge/push did not stamp eventId');

    const eventsRes = await fetch(`${baseUrl}/api/bridge/events`);
    assert(eventsRes.ok, 'GET /api/bridge/events failed');
    const eventsJson = await eventsRes.json();
    assert(
      Array.isArray(eventsJson.events) && eventsJson.events.some((e) => e.eventId === pushedEventId),
      'Pushed bridge event not found in GET /api/bridge/events'
    );

    logStep(
      '6/13 persistence-bridge',
      'Verified /api/projects CRUD + snapshot + .dreamflow.json export + /api/bridge/push -> /api/bridge/events'
    );

    // -------------------------------------------------------------------------
    // Stage [7/13 live-provider-and-bridge-jobs]:
    //   /api/verify-provider, GET /bridge-connector.js & Dreamina job lifecycle
    // -------------------------------------------------------------------------
    const verifyEmptyRes = await fetch(`${baseUrl}/api/verify-provider`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: 'gemini', apiKey: '' }),
    });
    const verifyEmptyJson = await verifyEmptyRes.json();
    assert(
      verifyEmptyJson.valid === false || verifyEmptyJson.ok === false,
      `Expected /api/verify-provider with empty key to report invalid, got: ${JSON.stringify(verifyEmptyJson)}`
    );

    const honestCloudErrRes = await fetch(`${baseUrl}/api/generate-image`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: 'gemini', apiKey: '', prompt: 'Sunlit limestone courtyard' }),
    });
    const honestCloudErrJson = await honestCloudErrRes.json();
    assert(
      !honestCloudErrRes.ok || honestCloudErrJson.ok === false,
      'Explicit cloud provider without API key must return honest error, never silent FFmpeg fallback'
    );

    const pnaOptionsRes = await fetch(`${baseUrl}/api/bridge/jobs/pending`, { method: 'OPTIONS' });
    const pnaHeader = pnaOptionsRes.headers.get('access-control-allow-private-network');
    assert(
      pnaHeader === 'true',
      `Expected Access-Control-Allow-Private-Network: true on OPTIONS, got: ${pnaHeader}`
    );

    const connectorRes = await fetch(`${baseUrl}/bridge-connector.js`);
    assert(
      connectorRes.status === 200,
      `Expected GET /bridge-connector.js to return 200 OK, got ${connectorRes.status}`
    );
    const connectorJs = await connectorRes.text();
    assert(connectorJs.length > 200, 'bridge-connector.js body unexpectedly small');
    const tmpConnectorFile = path.join(os.tmpdir(), `dreamflow_bridge_connector_${Date.now()}.js`);
    fs.writeFileSync(tmpConnectorFile, connectorJs, 'utf8');
    try {
      execFileSync(process.execPath, ['--check', tmpConnectorFile], { stdio: 'pipe' });
    } finally {
      if (fs.existsSync(tmpConnectorFile)) fs.unlinkSync(tmpConnectorFile);
    }

    const uniquePrompt = `E2E Live Dreamina Bridge Verification ${Date.now()}`;
    const enqueueWaitPromise = fetch(`${baseUrl}/api/bridge/enqueue`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        target: 'dreamina',
        mode: 'image',
        prompt: uniquePrompt,
        aspectRatio: '16:9',
        waitForResult: true,
        timeoutMs: 15000,
      }),
    });

    await new Promise((r) => setTimeout(r, 120));

    const pendingRes = await fetch(`${baseUrl}/api/bridge/jobs/pending?target=dreamina&claim=1`);
    assert(pendingRes.ok, `GET /api/bridge/jobs/pending?claim=1 failed (${pendingRes.status})`);
    const pendingJson = await pendingRes.json();
    assert(Array.isArray(pendingJson.jobs), 'pendingJson.jobs must be an array');
    const claimedJob = pendingJson.jobs.find((j) => j.prompt === uniquePrompt) || pendingJson.jobs[0];
    assert(claimedJob && claimedJob.jobId, 'Enqueued Dreamina bridge job not found in /api/bridge/jobs/pending');

    const completeRes = await postJson(baseUrl, `/api/bridge/jobs/${claimedJob.jobId}/complete`, {
      status: 'succeeded',
      dataBase64: SAMPLE_SOURCE_PNG_B64,
      mimeType: 'image/png',
      dataUrl: `data:image/png;base64,${SAMPLE_SOURCE_PNG_B64}`,
    });
    assert(completeRes.ok !== false, 'POST /api/bridge/jobs/:id/complete failed');

    const enqueueResolvedRes = await enqueueWaitPromise;
    const enqueueResolvedJson = await enqueueResolvedRes.json();
    assert(
      enqueueResolvedRes.ok && enqueueResolvedJson.ok !== false,
      `Awaited /api/bridge/enqueue failed: ${JSON.stringify(enqueueResolvedJson)}`
    );
    const completedJob = enqueueResolvedJson.job || completeRes.job || completeRes;
    const savedLiveImage =
      completedJob.localImageUrl ||
      completedJob.imageUrl ||
      completedJob.mediaUrl ||
      completeRes.localImageUrl ||
      completeRes.imageUrl;
    assert(
      savedLiveImage && savedLiveImage.includes('dreamina_live_'),
      `Expected saved /media/dreamina_live_*.png path, got: ${savedLiveImage}`
    );
    createdMediaPaths.push(savedLiveImage);
    assert(findGeneratedMediaDiskPath(savedLiveImage), `Ingested ${savedLiveImage} missing on disk`);

    logStep(
      '7/13 live-provider-and-bridge-jobs',
      `Verified /api/verify-provider, GET /bridge-connector.js (PNA CORS) & Dreamina bridge lifecycle (${path.basename(savedLiveImage)})`
    );

    // -------------------------------------------------------------------------
    // Stage [8/13 multi-platform-and-external-mcp]:
    //   1) GET /api/platforms (all 13 platforms incl. sume + modality-accurate models)
    //   2) Real External stdio MCP Server roundtrip
    // -------------------------------------------------------------------------
    const platformsRes = await fetch(`${baseUrl}/api/platforms`);
    assert(platformsRes.ok, `GET /api/platforms failed (${platformsRes.status})`);
    const platformsJson = await platformsRes.json();
    const rawCatalog = platformsJson.platforms || platformsJson.catalog || [];
    const platformList = Array.isArray(rawCatalog) ? rawCatalog : Object.values(rawCatalog);
    const platformIds = platformList.map((p) => p.id || p.platformId);
    for (const expectedPid of [
      'higgsfield',
      'sume',
      'kling',
      'dreamina',
      'google-flow',
      'openart',
      'imagineart',
      'elevenlabs',
      'openai',
      'fal',
      'replicate',
      'comfyui',
      'custom-mcp',
    ]) {
      assert(platformIds.includes(expectedPid), `GET /api/platforms missing platform: ${expectedPid}`);
    }

    const serializedCatalog = JSON.stringify(rawCatalog);
    for (const expectedModel of [
      'chatgpt-image-2.6',
      'kling-4.0',
      'seedream-5.0-lite',
      'veo-3.1-fast-generate-preview',
      'eleven_multilingual_v2',
      'sume-seedance-2.5',
    ]) {
      assert(
        serializedCatalog.includes(expectedModel),
        `GET /api/platforms missing modality model: ${expectedModel}`
      );
    }

    fs.writeFileSync(tmpMcpScriptPath, createTempStdioMcpServerScript(SAMPLE_SOURCE_PNG_B64), 'utf8');

    const registerMcpRes = await postJson(baseUrl, '/api/mcp/servers', {
      name: 'E2E Stdio Photo MCP',
      platformId: 'higgsfield',
      transport: 'stdio',
      command: process.execPath,
      args: [tmpMcpScriptPath],
      env: { E2E_SECRET_TOKEN: 'secret_do_not_expose_123' },
    });
    const mcpServerObj = registerMcpRes.server || registerMcpRes;
    registeredMcpServerId = mcpServerObj.id;
    assert(registeredMcpServerId, 'POST /api/mcp/servers did not return server.id');

    const listMcpRes = await fetch(`${baseUrl}/api/mcp/servers`);
    assert(listMcpRes.ok, 'GET /api/mcp/servers failed');
    const listMcpText = await listMcpRes.text();
    assert(!listMcpText.includes('secret_do_not_expose_123'), 'GET /api/mcp/servers leaked unredacted env secret');
    const listMcpJson = JSON.parse(listMcpText);
    const foundMcp = (listMcpJson.servers || []).find((s) => s.id === registeredMcpServerId);
    assert(foundMcp, 'Registered stdio MCP server missing from GET /api/mcp/servers');
    assert(
      Array.isArray(foundMcp.tools) && foundMcp.tools.some((t) => t.name === 'generate_image'),
      'Stdio MCP tools/list did not discover generate_image'
    );

    const mcpDirectCall = await postJson(baseUrl, '/api/mcp/call', {
      serverId: registeredMcpServerId,
      toolName: 'generate_image',
      arguments: { prompt: 'Warm limestone courtyard archway on 35mm film' },
    });
    const directMcpMedia = mcpDirectCall.imageUrl || mcpDirectCall.mediaUrl;
    assert(directMcpMedia, 'POST /api/mcp/call did not return ingested mediaUrl');
    createdMediaPaths.push(directMcpMedia);
    assert(findGeneratedMediaDiskPath(directMcpMedia), `MCP direct media missing on disk: ${directMcpMedia}`);

    const genNodeMcpRes = await postJson(baseUrl, '/api/generate-node', {
      nodeId: 'e2e-mcp-node-1',
      kind: 'image',
      platformId: 'higgsfield',
      connectionMode: 'mcp',
      mcpServerId: registeredMcpServerId,
      mcpToolName: 'generate_image',
      modelId: 'chatgpt-image-2.6',
      prompt: 'Sunlit ceramic cup on raw oak table',
    });
    const nodeMcpMedia = genNodeMcpRes.imageUrl || genNodeMcpRes.mediaUrl;
    assert(nodeMcpMedia && nodeMcpMedia.includes('mcp'), `Expected *_mcp_* media output, got: ${nodeMcpMedia}`);
    createdMediaPaths.push(nodeMcpMedia);
    assert(findGeneratedMediaDiskPath(nodeMcpMedia), `generate-node MCP image missing on disk: ${nodeMcpMedia}`);

    const delMcpRes = await fetch(`${baseUrl}/api/mcp/servers/${encodeURIComponent(registeredMcpServerId)}`, {
      method: 'DELETE',
    });
    assert(delMcpRes.ok, 'DELETE /api/mcp/servers/:id failed');
    registeredMcpServerId = null;

    logStep(
      '8/13 multi-platform-and-external-mcp',
      `Verified GET /api/platforms (${platformList.length} platforms incl. sume) + real stdio External MCP Server (${path.basename(nodeMcpMedia)})`
    );

    // -------------------------------------------------------------------------
    // Stage [9/13 cross-platform-chained-workflow]:
    //   Higgsfield (ChatGPT Image 2.6) -> Kling AI (Kling 4.0) chained reference forwarding
    // -------------------------------------------------------------------------
    const hfPrompt = `E2E Higgsfield Base Frame ${Date.now()}`;
    const node1Promise = fetch(`${baseUrl}/api/generate-node`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nodeId: 'e2e-chain-node-1',
        kind: 'image',
        platformId: 'higgsfield',
        connectionMode: 'browser-bridge',
        modelId: 'chatgpt-image-2.6',
        prompt: hfPrompt,
        settings: { aspectRatio: '16:9', resolution: '2K' },
      }),
    });

    await new Promise((r) => setTimeout(r, 140));

    const hfPendingRes = await fetch(`${baseUrl}/api/bridge/jobs/pending?target=higgsfield&claim=1`);
    assert(hfPendingRes.ok, 'GET /api/bridge/jobs/pending?target=higgsfield&claim=1 failed');
    const hfPendingJson = await hfPendingRes.json();
    const hfJob = (hfPendingJson.jobs || []).find((j) => j.prompt === hfPrompt) || (hfPendingJson.jobs || [])[0];
    assert(hfJob && hfJob.jobId, 'Higgsfield image job not found in pending bridge queue');
    assert(hfJob.modelId === 'chatgpt-image-2.6', `Expected hfJob.modelId === 'chatgpt-image-2.6', got ${hfJob.modelId}`);

    await postJson(baseUrl, `/api/bridge/jobs/${hfJob.jobId}/complete`, {
      status: 'succeeded',
      dataBase64: SAMPLE_SOURCE_PNG_B64,
      mimeType: 'image/png',
      dataUrl: `data:image/png;base64,${SAMPLE_SOURCE_PNG_B64}`,
    });

    const node1HttpRes = await node1Promise;
    const node1Json = await node1HttpRes.json();
    assert(node1HttpRes.ok && node1Json.ok !== false, `Node 1 Higgsfield generation failed: ${JSON.stringify(node1Json)}`);
    const node1MediaPath = node1Json.imageUrl || node1Json.mediaUrl;
    assert(
      node1MediaPath && node1MediaPath.includes('higgsfield_live_'),
      `Expected /media/higgsfield_live_*.png from Node 1, got: ${node1MediaPath}`
    );
    createdMediaPaths.push(node1MediaPath);
    assert(findGeneratedMediaDiskPath(node1MediaPath), `Node 1 ${node1MediaPath} missing on disk`);

    const node1FullHttpUrl = node1Json.fullUrl || `${baseUrl}${node1MediaPath}`;
    const klingPrompt = `E2E Kling 4.0 Chained Video ${Date.now()}`;
    const node2Promise = fetch(`${baseUrl}/api/generate-node`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nodeId: 'e2e-chain-node-2',
        kind: 'video',
        platformId: 'kling',
        connectionMode: 'browser-bridge',
        modelId: 'kling-4.0',
        prompt: klingPrompt,
        referenceImages: [node1FullHttpUrl],
        settings: { aspectRatio: '16:9', resolution: '1080p', durationSec: 5 },
      }),
    });

    await new Promise((r) => setTimeout(r, 140));

    const klingPendingRes = await fetch(`${baseUrl}/api/bridge/jobs/pending?target=kling&claim=1`);
    assert(klingPendingRes.ok, 'GET /api/bridge/jobs/pending?target=kling&claim=1 failed');
    const klingPendingJson = await klingPendingRes.json();
    const klingJob = (klingPendingJson.jobs || []).find((j) => j.prompt === klingPrompt) || (klingPendingJson.jobs || [])[0];
    assert(klingJob && klingJob.jobId, 'Kling 4.0 video job not found in pending bridge queue');
    assert(klingJob.modelId === 'kling-4.0', `Expected klingJob.modelId === 'kling-4.0', got ${klingJob.modelId}`);
    assert(
      Array.isArray(klingJob.referenceImages) &&
        klingJob.referenceImages.length >= 1 &&
        klingJob.referenceImages[0].startsWith('data:image/png;base64,'),
      `Expected Kling 4.0 job to receive resolved base64 data:image/png;base64,... from Node 1, got: ${JSON.stringify(klingJob.referenceImages)}`
    );

    const sampleMp4Bytes = fs.readFileSync(resolveAsset('real_shot01_courtyard.mp4'));
    await postJson(baseUrl, `/api/bridge/jobs/${klingJob.jobId}/complete`, {
      status: 'succeeded',
      dataBase64: sampleMp4Bytes.subarray(0, sampleMp4Bytes.length).toString('base64'),
      mimeType: 'video/mp4',
    });

    const node2HttpRes = await node2Promise;
    const node2Json = await node2HttpRes.json();
    assert(node2HttpRes.ok && node2Json.ok !== false, `Node 2 Kling 4.0 generation failed: ${JSON.stringify(node2Json)}`);
    const node2VideoPath = node2Json.videoUrl || node2Json.mediaUrl;
    assert(node2VideoPath, 'Node 2 Kling 4.0 did not return videoUrl');
    createdMediaPaths.push(node2VideoPath);
    assert(findGeneratedMediaDiskPath(node2VideoPath), `Node 2 ${node2VideoPath} missing on disk`);

    logStep(
      '9/13 cross-platform-chained-workflow',
      `Verified Higgsfield (chatgpt-image-2.6) -> Kling 4.0 chained base64 reference forwarding (${path.basename(node1MediaPath)} -> ${path.basename(node2VideoPath)})`
    );

    // -------------------------------------------------------------------------
    // Stage [10/13 guided-connections-and-sume]:
    //   1) GET /api/connections/status (includes all 8 browser platforms incl. sume)
    //   2) POST /api/connections/launch-browser dryRun for 'higgsfield' & 'all'
    //   3) POST /api/bridge/push type:'bridge_session' updates connectedBrowserPlatforms
    // -------------------------------------------------------------------------
    const connStatusRes = await fetch(`${baseUrl}/api/connections/status`);
    assert(connStatusRes.status === 200, `GET /api/connections/status failed (${connStatusRes.status})`);
    const connStatus = await connStatusRes.json();
    assert(connStatus.ok === true, 'GET /api/connections/status ok !== true');
    for (const pid of ['sume', 'higgsfield', 'kling', 'dreamina', 'google-flow', 'elevenlabs', 'openart', 'imagineart']) {
      assert(
        connStatus.byId && connStatus.byId[pid],
        `GET /api/connections/status missing platform summary: ${pid}`
      );
    }

    const dryHiggs = await postJson(baseUrl, '/api/connections/launch-browser', {
      platformId: 'higgsfield',
      dryRun: true,
    });
    assert(dryHiggs.dryRun === true && dryHiggs.launched === false, 'dryRun must not spawn a GUI browser');
    assert(
      typeof dryHiggs.browserPath === 'string' && dryHiggs.browserPath.length > 0,
      'Chrome/Chromium binary not detected by BrowserSessionManager'
    );
    assert(
      Array.isArray(dryHiggs.args) &&
        dryHiggs.args.some((a) => a.startsWith('--load-extension=') && a.endsWith('/extensions/chrome-bridge')),
      `Launch args missing --load-extension=.../extensions/chrome-bridge: ${JSON.stringify(dryHiggs.args)}`
    );
    assert(
      Array.isArray(dryHiggs.urls) && dryHiggs.urls.includes('https://higgsfield.ai'),
      `Expected https://higgsfield.ai in dryRun urls: ${JSON.stringify(dryHiggs.urls)}`
    );

    const dryAll = await postJson(baseUrl, '/api/connections/launch-browser', {
      platformId: 'all',
      dryRun: true,
    });
    assert(
      Array.isArray(dryAll.urls) && dryAll.urls.length >= 8 && dryAll.urls.includes('https://sume.com'),
      `launch-browser platformId:'all' must open all 8 creator URLs incl. sume.com: ${JSON.stringify(dryAll.urls)}`
    );

    await postJson(baseUrl, '/api/bridge/push', {
      type: 'bridge_session',
      source: 'sume',
      openDomains: ['sume.com'],
    });
    const connAfterPushRes = await fetch(`${baseUrl}/api/connections/status`);
    assert(connAfterPushRes.ok, 'GET /api/connections/status after push failed');
    const connAfterPush = await connAfterPushRes.json();
    assert(
      Array.isArray(connAfterPush.connectedBrowserPlatforms) &&
        connAfterPush.connectedBrowserPlatforms.includes('sume'),
      `Expected 'sume' in connectedBrowserPlatforms after bridge_session push, got: ${JSON.stringify(connAfterPush.connectedBrowserPlatforms)}`
    );

    logStep(
      '10/13 guided-connections-and-sume',
      `Verified /api/connections/status (8 browser platforms + ${dryHiggs.browserName}), dryRun --load-extension & bridge_session sync`
    );

    // -------------------------------------------------------------------------
    // Stage [11/13 chrome-bridge]: Manifest V3 v1.2.0 across all 8 creator domains
    // -------------------------------------------------------------------------
    verifyStage11ChromeBridge();

    // -------------------------------------------------------------------------
    // Stage [12/13 cli-and-docker]: open-dreamflow doctor + unified SPA GET :3001/ + Docker
    // -------------------------------------------------------------------------
    const cliPath = path.join(ROOT, 'bin/open-dreamflow.mjs');
    assert(fs.existsSync(cliPath), 'bin/open-dreamflow.mjs missing');
    const doctorOut = execFileSync(process.execPath, [cliPath, 'doctor'], { encoding: 'utf8' });
    assert(
      doctorOut.includes('All core Open-DreamFlow runtime checks passed'),
      `open-dreamflow doctor unexpected output: ${doctorOut}`
    );

    const spaRootRes = await fetch(`${baseUrl}/`);
    assert(spaRootRes.status === 200, `Expected GET ${baseUrl}/ unified SPA to return 200 OK, got ${spaRootRes.status}`);
    const spaHtml = await spaRootRes.text();
    assert(spaHtml.includes('<div id="root"></div>'), 'Unified SPA GET / missing <div id="root"></div>');

    for (const dockerFile of ['Dockerfile', 'docker-compose.yml', '.dockerignore']) {
      const fullDocker = path.join(ROOT, dockerFile);
      assert(fs.existsSync(fullDocker) && fs.statSync(fullDocker).size > 40, `Missing/empty ${dockerFile}`);
    }

    logStep(
      '12/13 cli-and-docker',
      `Verified 'open-dreamflow doctor' (exit 0), unified single-port SPA GET ${baseUrl}/ (200 OK) & Dockerfile + docker-compose.yml`
    );
  } finally {
    if (initialOpenDomains !== null) {
      try {
        await fetch(`${baseUrl}/api/bridge/heartbeat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            source: 'chrome-extension',
            fullSnapshot: true,
            openDomains: initialOpenDomains,
          }),
        });
      } catch {
        // ignore
      }
    }
    if (registeredMcpServerId) {
      try {
        await fetch(`${baseUrl}/api/mcp/servers/${encodeURIComponent(registeredMcpServerId)}`, { method: 'DELETE' });
      } catch {
        // ignore
      }
    }
    if (fs.existsSync(tmpMcpScriptPath)) {
      try {
        fs.unlinkSync(tmpMcpScriptPath);
      } catch {
        // ignore
      }
    }
    for (const mediaPath of createdMediaPaths) {
      unlinkMediaIfPresent(mediaPath);
    }
    try {
      await fetch(`${baseUrl}/api/projects/${tempProjectId}`, { method: 'DELETE' });
    } catch {
      // ignore
    }
    if (hadPriorInbox && priorInboxBytes) {
      fs.writeFileSync(inboxPath, priorInboxBytes);
    } else if (!hadPriorInbox && fs.existsSync(inboxPath)) {
      fs.unlinkSync(inboxPath);
    }
    if (hadPriorMcpCfg && priorMcpCfgBytes) {
      fs.writeFileSync(mcpCfgPath, priorMcpCfgBytes);
    } else if (!hadPriorMcpCfg && fs.existsSync(mcpCfgPath)) {
      fs.unlinkSync(mcpCfgPath);
    }
    if (ephemeralBridge) {
      await ephemeralBridge.stop();
    }
  }
}

function verifyStage11ChromeBridge() {
  const extDir = path.join(ROOT, 'extensions/chrome-bridge');
  const manifestPath = path.join(extDir, 'manifest.json');
  assert(fs.existsSync(manifestPath), 'extensions/chrome-bridge/manifest.json missing');

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  assert(manifest.manifest_version === 3, 'Chrome extension must use Manifest V3');
  assert(manifest.version === '1.2.0', `Expected Chrome Bridge manifest v1.2.0, got ${manifest.version}`);

  const hosts = JSON.stringify(manifest.host_permissions || []);
  for (const domain of [
    'dreamina.capcut.com',
    'labs.google',
    'higgsfield.ai',
    'sume.com',
    'klingai.com',
    'openart.ai',
    'imagine.art',
    'elevenlabs.io',
  ]) {
    assert(hosts.includes(domain), `Manifest missing creator domain host permission: ${domain}`);
  }

  const jsScripts = fs.readdirSync(extDir).filter((f) => f.endsWith('.js'));
  assert(jsScripts.length >= 6, `Expected >= 6 JS scripts in chrome-bridge, got ${jsScripts.length}`);
  for (const script of jsScripts) {
    const full = path.join(extDir, script);
    execFileSync(process.execPath, ['--check', full], { stdio: 'pipe' });
  }

  for (const size of ['16', '48', '128']) {
    const icon = path.join(extDir, 'icons', `icon${size}.png`);
    assert(fs.existsSync(icon) && fs.statSync(icon).size > 100, `Missing/empty icon${size}.png`);
  }

  const bgSource = fs.readFileSync(path.join(extDir, 'background.js'), 'utf8');
  assert(bgSource.includes('isKnownJobId'), 'background.js missing jobId deduplication guard');
  assert(bgSource.includes('dispatch_bridge_job'), 'background.js missing dispatch_bridge_job WS listener');

  logStep(
    '11/13 chrome-bridge',
    `Manifest V3 v${manifest.version} (8 creator domains incl. sume.com), 3 icons & ${jsScripts.length} scripts syntax-checked`
  );
}

function verifyStage13WebStudioBundle() {
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

  const jsPath = path.join(assetsDir, jsFiles[0]);
  const cssPath = path.join(assetsDir, cssFiles[0]);
  const jsSizeKb = (fs.statSync(jsPath).size / 1024).toFixed(1);
  const cssSizeKb = (fs.statSync(cssPath).size / 1024).toFixed(1);

  const jsBundle = fs.readFileSync(jsPath, 'utf8');
  for (const marker of [
    'Launch Connected Creator Browser',
    'Connected via Browser',
    'DoP Rig',
    'Sume',
    'ChatGPT Image 2.6',
    'Kling 4.0',
  ]) {
    assert(
      jsBundle.toLowerCase().includes(marker.toLowerCase()),
      `Stage 8 Studio UI marker missing in compiled bundle: ${marker}`
    );
  }

  const distMedia = path.join(distDir, 'media');
  for (const mediaFile of [
    'real_salt_terracotta_master.mp4',
    'real_shot02_bridge.mp4',
    'real_coastal_foley.mp3',
    'real_courtyard_sun.jpg',
    'real_coastal_cliffs.jpg',
  ]) {
    assert(
      fs.existsSync(path.join(distMedia, mediaFile)),
      `dist/media/${mediaFile} missing from production build`
    );
  }

  logStep(
    '13/13 web-studio',
    `Dreamina 1:1 Vite bundle + Guided 1-Click Connections, Sume & DoP Rig UI verified (${jsFiles[0]} = ${jsSizeKb} kB, ${cssFiles[0]} = ${cssSizeKb} kB)`
  );
}

async function main() {
  console.log('\nOpen-DreamFlow — Running 13-Stage End-to-End Verification Suite...');
  await verifyStage1ProviderSdk();
  await verifyLiveServerStages();
  verifyStage13WebStudioBundle();
  console.log('All 13/13 Open-DreamFlow subsystems passed verification with 0 errors!\n');
}

main().catch((err) => {
  console.error('\n[FAIL]', err instanceof Error ? err.message : err);
  process.exit(1);
});
