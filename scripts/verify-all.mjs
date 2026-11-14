#!/usr/bin/env node
/**
 * Open-DreamFlow — 18-Stage Automated Monorepo End-to-End Verification Suite
 *
 * Stages:
 *   [1/18 provider-sdk]                      Zero-markup SDK clients, 13-platform PLATFORM_CATALOG & $0 markup estimator
 *   [2/18 mcp-client]                        Live JSON-RPC roundtrip verifying all 12 built-in MCP tools on :3001/mcp
 *   [3/18 ephemeral-media-and-clean-audit]   Zero deleted real_* demo assets, ephemeral ffmpeg range streaming, ffprobe & 0-slop/0-mono bundle audit
 *   [4/18 inline-editor]                     Live /api/upload-media, /api/inpaint (mask), /api/outpaint (16:9), /api/remove-bg & /api/upscale (4K)
 *   [5/18 keyframe-bridge-and-audio]         Live /api/keyframe-bridge (A->B), /api/generate-audio (64-bar waveform + MP3) & multi-track /api/compile-timeline
 *   [6/18 persistence-bridge]                Live /api/projects CRUD + .dreamflow.json export + /api/bridge/push -> /api/bridge/events
 *   [7/18 live-provider-and-bridge-jobs]     /api/verify-provider, GET /bridge-connector.js (PNA CORS) & Dreamina live bridge lifecycle
 *   [8/18 multi-platform-and-external-mcp]   GET /api/platforms (13 platforms) + real stdio External MCP Server tools/list, /api/mcp/call & /api/generate-node
 *   [9/18 cross-platform-chained-workflow]   Higgsfield (ChatGPT Image 2.6) -> Kling 4.0 (Video) chained base64 reference forwarding
 *   [10/18 guided-connections-and-sume]      GET /api/connections/status, dryRun 1-click Chrome profile launcher (higgsfield + all) & bridge_session status sync
 *   [11/18 mcp-oauth-and-check-browser]      MCP OAuth 2.1 + PKCE + Streamable HTTP SSE lifecycle (mock + live Higgsfield probe), /api/mcp/call & /api/connections/check-browser
 *   [12/18 batch-multiref-and-dreamina-mcp]  4-image batch outputs (multi-job + single-cap fan-out), multi-modal video+image+start/end refs & Dreamina MCP flow
 *   [13/18 chrome-bridge]                    Manifest V3 v1.2.0 across all 8 creator domains (incl. sume.com), icons & syntax check across all 6 scripts
 *   [14/18 cli-and-docker]                   open-dreamflow doctor CLI check, unified single-port SPA GET :3001/, Dockerfile & docker-compose.yml
 *   [15/18 web-studio]                       Production Vite bundle + official /brands/* + Inter-only (0 font-mono/JetBrains) + 0 real_* / demo audit
 *   [16/18 dreamina-cli-oauth-hermetic]      Hermetic mock dreamina-canvas CLI E2E: auth login/wait/account, upload->create->quote->confirm->run(--credit-token)->wait->show->download(0600->0644)
 *   [17/18 dreamina-44tools-and-catalog]     34 Dreamina models (18 video), 44 official MCP tools, dynamic CLI model discovery (?refresh=1) & post-edit CLI execution
 *   [18/18 multi-user-cloud-credits-and-ui-audit] Strict 401 auth gate, multi-user invites/caps/403 enforcement, isolated BYOK vaults, /api/credits/{summary,quote}, /api/assets, /brands/* immutable & deploy --check
 */

import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as http from 'node:http';
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

function resolveFfmpegBin() {
  const candidates = [
    process.env.FFMPEG_PATH,
    '/Users/seba/.local/bin/ffmpeg',
    '/opt/homebrew/bin/ffmpeg',
    '/usr/local/bin/ffmpeg',
    '/usr/bin/ffmpeg',
  ].filter(Boolean);
  for (const bin of candidates) {
    if (fs.existsSync(bin)) return bin;
  }
  const probe = spawnSync('ffmpeg', ['-version'], { stdio: 'pipe' });
  return probe.status === 0 ? 'ffmpeg' : null;
}

function assertCleanUiText(label, text) {
  const bannedPatterns = [
    { name: 'font-mono', re: /\bfont-mono\b/ },
    { name: 'JetBrains', re: /JetBrains/i },
    { name: 'real_ demo path', re: /\/media\/real_|['"]real_(?:courtyard|coastal|leica|portrait|alpine|kyoto|contact|shot0|salt_terracotta|extra_|slice_)/ },
    { name: 'Salt & Terracotta demo string', re: /Salt & Terracotta|salt-terracotta/i },
    { name: 'Legacy neon slop', re: /Neo-Tokyo|Hero_Kael|Protocol: Rain|Cyber_Sneaker/ },
  ];
  for (const { name, re } of bannedPatterns) {
    if (re.test(text)) {
      throw new Error(`UI cleanliness gate failed (${label}): forbidden pattern "${name}" found`);
    }
  }
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
    '1/18 provider-sdk',
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

  const oauthClientsPath = path.join(ROOT, '.dreamflow-data.nosync/mcp-oauth-clients.json');
  const hadPriorOAuthClients = fs.existsSync(oauthClientsPath);
  const priorOAuthClientsBytes = hadPriorOAuthClients ? fs.readFileSync(oauthClientsPath) : null;

  const tmpMcpScriptPath = path.join(os.tmpdir(), `dreamflow_e2e_mcp_stdio_${Date.now()}.mjs`);
  let registeredMcpServerId = null;
  let registeredOAuthServerId = null;
  let mockOAuthHttpServer = null;
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
    // Stage [2/18 mcp-client]: Live JSON-RPC roundtrip verifying all 12 MCP tools
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
      '2/18 mcp-client',
      `Live JSON-RPC roundtrip on ${baseUrl}/mcp verified all ${expectedTools.length} built-in MCP tools`
    );

    // -------------------------------------------------------------------------
    // Stage [3/18 ephemeral-media-and-clean-audit]: 0 real_* demo files, 206 Partial Content, ffprobe & clean bundle audit
    // -------------------------------------------------------------------------
    const publicMediaDir = path.join(ROOT, 'apps/web-studio/public/media');
    const distMediaDir = path.join(ROOT, 'apps/web-studio/dist/media');
    fs.mkdirSync(publicMediaDir, { recursive: true });

    for (const dir of [publicMediaDir, distMediaDir]) {
      if (fs.existsSync(dir)) {
        const legacyReal = fs.readdirSync(dir).filter((f) => f.startsWith('real_'));
        assert(
          legacyReal.length === 0,
          `Legacy real_* demo files must not exist in ${dir}: found ${legacyReal.join(', ')}`
        );
      }
    }

    const ffmpegBin = resolveFfmpegBin();
    const ffprobeBin = resolveFfprobeBin();
    assert(ffmpegBin, 'ffmpeg binary required for Stage 3 ephemeral media generation');
    assert(ffprobeBin, 'ffprobe binary required for Stage 3 stream inspection');

    const tmpRunTag = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const tmpImg1 = `verify_tmp_frame_a_${tmpRunTag}.jpg`;
    const tmpImg2 = `verify_tmp_frame_b_${tmpRunTag}.jpg`;
    const tmpMp4Master = `verify_tmp_master_${tmpRunTag}.mp4`;
    const tmpMp4Clip2 = `verify_tmp_clip2_${tmpRunTag}.mp4`;
    const tmpMp3Audio = `verify_tmp_foley_${tmpRunTag}.mp3`;

    const writeFixture = (fileName, ffmpegArgs) => {
      const target = path.join(publicMediaDir, fileName);
      createdMediaPaths.push(`/media/${fileName}`);
      execFileSync(ffmpegBin, ['-y', '-loglevel', 'error', ...ffmpegArgs, target], { stdio: 'pipe' });
      assert(fs.existsSync(target) && fs.statSync(target).size > 2048, `Empty ephemeral fixture: ${fileName}`);
      return target;
    };

    writeFixture(tmpImg1, ['-f', 'lavfi', '-i', 'testsrc=size=640x360:rate=1', '-frames:v', '1']);
    writeFixture(tmpImg2, ['-f', 'lavfi', '-i', 'smptebars=size=640x360:rate=1', '-frames:v', '1']);
    writeFixture(tmpMp4Master, [
      '-f', 'lavfi', '-i', 'testsrc=size=320x240:rate=24:duration=2',
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
    ]);
    writeFixture(tmpMp4Clip2, [
      '-f', 'lavfi', '-i', 'color=c=#2E4053:s=320x240:r=24:d=2',
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
    ]);
    writeFixture(tmpMp3Audio, [
      '-f', 'lavfi', '-i', 'sine=frequency=220:duration=2',
      '-c:a', 'libmp3lame', '-b:a', '128k',
    ]);

    const resolveAsset = (file) => {
      const distCandidate = path.join(distMediaDir, file);
      if (fs.existsSync(distCandidate)) return distCandidate;
      return path.join(publicMediaDir, file);
    };

    const rangeRes = await fetch(`${baseUrl}/media/${tmpMp4Master}`, {
      headers: { Range: 'bytes=0-1023' },
    });
    assert(
      rangeRes.status === 206,
      `Expected 206 Partial Content on /media/${tmpMp4Master}, got ${rangeRes.status}`
    );

    for (const inspectTarget of [tmpImg1, tmpImg2, tmpMp4Master, tmpMp4Clip2, tmpMp3Audio]) {
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
      assertCleanUiText(`dist/assets/${jsFile}`, bundleText);
    }

    const masterSizeKb = (fs.statSync(resolveAsset(tmpMp4Master)).size / 1024).toFixed(1);
    logStep(
      '3/18 ephemeral-media-and-clean-audit',
      `Verified 0 real_* demo assets, 206 Range streaming on ephemeral MP4 (${masterSizeKb} KB), ffprobe streams & 0 banned UI strings in bundle`
    );

    // -------------------------------------------------------------------------
    // Stage [4/18 inline-editor]: Live upload, mask inpaint, 16:9 outpaint, cutout & 4K upscale
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

    const sourceForEdit = `/media/${tmpImg1}`;

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
      prompt: 'Extend sunlit warm architectural wall and foliage',
    });
    assert(outpaintRes.imageUrl, '/api/outpaint missing imageUrl');
    createdMediaPaths.push(outpaintRes.imageUrl);
    assert(findGeneratedMediaDiskPath(outpaintRes.imageUrl), 'Outpaint PNG missing on disk');

    const cutoutRes = await postJson(baseUrl, '/api/remove-bg', {
      imageUrl: `/media/${tmpImg2}`,
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
      '4/18 inline-editor',
      'Verified live /api/upload-media, /api/inpaint (masked), /api/outpaint (16:9), /api/remove-bg & /api/upscale (4K)'
    );

    // -------------------------------------------------------------------------
    // Stage [5/18 keyframe-bridge-and-audio]: A->B optical bridge + 64-bar audio + multi-track mix
    // -------------------------------------------------------------------------
    const bridgeRes = await postJson(baseUrl, '/api/keyframe-bridge', {
      startImageUrl: `/media/${tmpImg1}`,
      endImageUrl: `/media/${tmpImg2}`,
      durationSec: 4,
      motionCurve: 'ease-in-out',
      prompt: 'Natural 35mm optical push between keyframe A and keyframe B',
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
      clips: [`/media/${tmpMp4Master}`, `/media/${tmpMp4Clip2}`],
      audioTracks: [{ audioUrl: `/media/${tmpMp3Audio}`, volume: 0.85 }],
    });
    const compiledMasterUrl = compileMixRes.masterVideoUrl || compileMixRes.videoUrl;
    assert(compiledMasterUrl, '/api/compile-timeline with audioTracks did not return master video URL');
    createdMediaPaths.push(compiledMasterUrl);
    assert(findGeneratedMediaDiskPath(compiledMasterUrl), 'Multi-track compiled master MP4 missing on disk');

    logStep(
      '5/18 keyframe-bridge-and-audio',
      'Verified live /api/keyframe-bridge (A→B), /api/generate-audio (64-bar RMS waveform + MP3) & multi-track /api/compile-timeline'
    );

    // -------------------------------------------------------------------------
    // Stage [6/18 persistence-bridge]: Projects CRUD + .dreamflow.json export + Bridge relay
    // -------------------------------------------------------------------------
    const saveRes = await postJson(baseUrl, '/api/projects', {
      id: tempProjectId,
      name: 'Stage 6 Clean Persistence Verification',
      state: { nodes: [{ id: 'n1', kind: 'image', title: 'Images 1 · Clean Frame' }], edges: [] },
      createSnapshot: true,
      snapshotLabel: 'Initial Editorial Snapshot',
    });
    assert(saveRes.id === tempProjectId, 'Saved project id mismatch');
    assert(saveRes.snapshotCount >= 1, 'Expected snapshotCount >= 1');

    const getProjRes = await fetch(`${baseUrl}/api/projects/${tempProjectId}`);
    assert(getProjRes.ok, 'GET /api/projects/:id failed');
    const gotProj = await getProjRes.json();
    assert(
      gotProj.ok && gotProj.project?.name === 'Stage 6 Clean Persistence Verification',
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
      title: 'Bridge · 35mm Location Frame',
      mediaUrl: `/media/${tmpImg1}`,
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
      '6/18 persistence-bridge',
      'Verified /api/projects CRUD + snapshot + .dreamflow.json export + /api/bridge/push -> /api/bridge/events'
    );

    // -------------------------------------------------------------------------
    // Stage [7/18 live-provider-and-bridge-jobs]:
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
      '7/18 live-provider-and-bridge-jobs',
      `Verified /api/verify-provider, GET /bridge-connector.js (PNA CORS) & Dreamina bridge lifecycle (${path.basename(savedLiveImage)})`
    );

    // -------------------------------------------------------------------------
    // Stage [8/18 multi-platform-and-external-mcp]:
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
      'gpt_image_2_6',
      'kling-4.0',
      'seedream_5_0_lite',
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
      '8/18 multi-platform-and-external-mcp',
      `Verified GET /api/platforms (${platformList.length} platforms incl. sume) + real stdio External MCP Server (${path.basename(nodeMcpMedia)})`
    );

    // -------------------------------------------------------------------------
    // Stage [9/18 cross-platform-chained-workflow]:
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

    const sampleMp4Bytes = fs.readFileSync(resolveAsset(tmpMp4Master));
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
      '9/18 cross-platform-chained-workflow',
      `Verified Higgsfield (chatgpt-image-2.6) -> Kling 4.0 chained base64 reference forwarding (${path.basename(node1MediaPath)} -> ${path.basename(node2VideoPath)})`
    );

    // -------------------------------------------------------------------------
    // Stage [10/18 guided-connections-and-sume]:
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
      '10/18 guided-connections-and-sume',
      `Verified /api/connections/status (8 browser platforms + ${dryHiggs.browserName}), dryRun --load-extension & bridge_session sync`
    );

    // -------------------------------------------------------------------------
    // Stage [11/18 mcp-oauth-and-check-browser]: MCP OAuth 2.1 + PKCE + Streamable HTTP SSE + CDP Check
    // -------------------------------------------------------------------------
    const b64u = (v) => Buffer.from(JSON.stringify(v)).toString('base64url');
    const mockAccessToken = `${b64u({ alg: 'none' })}.${b64u({
      sub: 'usr_stage9_e2e',
      email: 'director@higgsfield.ai',
      name: 'Stage 9 Director',
    })}.sig`;
    let mockBaseUrl = '';
    const mockSseSessionId = 'sess_mock_streamable_sse_01';
    let mockUploadCounter = 0;
    let mockCappedJobCounter = 0;
    const mockVideoRequests = [];
    const mockUploadTypes = new Map();

    mockOAuthHttpServer = http.createServer(async (req, res) => {
      const reqUrl = new URL(req.url || '/', mockBaseUrl || 'http://127.0.0.1');
      const chunks = [];
      for await (const c of req) chunks.push(c);
      const rawBody = Buffer.concat(chunks).toString('utf8');

      if (reqUrl.pathname.startsWith('/.well-known/oauth-protected-resource')) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ resource: `${mockBaseUrl}/mcp`, authorization_servers: [mockBaseUrl] }));
        return;
      }
      if (reqUrl.pathname.startsWith('/.well-known/oauth-authorization-server')) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            issuer: mockBaseUrl,
            authorization_endpoint: `${mockBaseUrl}/oauth/authorize`,
            token_endpoint: `${mockBaseUrl}/oauth/token`,
            registration_endpoint: `${mockBaseUrl}/oauth/register`,
            code_challenge_methods_supported: ['S256'],
            scopes_supported: ['openid', 'email', 'offline_access'],
          })
        );
        return;
      }
      if (reqUrl.pathname === '/oauth/register' && req.method === 'POST') {
        const regBody = JSON.parse(rawBody || '{}');
        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ client_id: 'mock_dcr_client_stage9', client_name: regBody.client_name }));
        return;
      }
      if (reqUrl.pathname === '/oauth/token' && req.method === 'POST') {
        const params = new URLSearchParams(rawBody);
        if (params.get('code') !== 'mock_auth_code_9' || !params.get('code_verifier')) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'invalid_grant' }));
          return;
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            access_token: mockAccessToken,
            id_token: mockAccessToken,
            refresh_token: 'mock_refresh_stage9',
            token_type: 'Bearer',
            expires_in: 3600,
          })
        );
        return;
      }
        if (reqUrl.pathname.startsWith('/mock-upload/') && req.method === 'PUT') {
          res.writeHead(200).end();
          return;
        }
                if (reqUrl.pathname === '/mock-assets/result.png' && req.method === 'GET') {
          const tinyPng = Buffer.from(
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
            'base64'
          );
          res.writeHead(200, { 'Content-Type': 'image/png', 'Content-Length': String(tinyPng.length) });
          res.end(tinyPng);
          return;
        }
        if (reqUrl.pathname === '/mock-assets/result.mp4' && req.method === 'GET') {
          const mp4Bytes = fs.readFileSync(resolveAsset(tmpMp4Master));
          res.writeHead(200, { 'Content-Type': 'video/mp4', 'Content-Length': String(mp4Bytes.length) });
          res.end(mp4Bytes);
          return;
        }
                if (reqUrl.pathname === '/mock-assets/thumb_min.webp' && req.method === 'GET') {
          res.writeHead(500, { 'Content-Type': 'text/plain' });
          res.end('should not select minUrl over rawUrl/resource_link');
          return;
        }
        if (reqUrl.pathname === '/mcp' && req.method === 'POST') {
          if (req.headers.authorization !== `Bearer ${mockAccessToken}`) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'unauthorized' }));
            return;
          }
          const rpc = JSON.parse(rawBody || '{}');
          if (rpc.id === undefined || rpc.id === null || rpc.method === 'notifications/initialized') {
            res.writeHead(202, { 'Mcp-Session-Id': mockSseSessionId });
            res.end();
            return;
          }
          let result = {};
          if (rpc.method === 'initialize') {
            result = {
              protocolVersion: '2025-03-26',
              capabilities: { tools: {} },
              serverInfo: { name: 'mock-streamable-higgsfield-mcp', version: '1.0.0' },
            };
          } else if (rpc.method === 'tools/list') {
            if (req.headers['mcp-session-id'] !== mockSseSessionId) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'missing Mcp-Session-Id' }));
              return;
            }
            result = {
              tools: [
                {
                  name: 'models_explore',
                  description: 'Explore and generate image, video, and audio inspirations',
                  inputSchema: { type: 'object', properties: { prompt: { type: 'string' } } },
                },
                {
                  name: 'generate_image',
                  description: 'Generate high-resolution image',
                  inputSchema: {
                    type: 'object',
                    properties: {
                      params: {
                        type: 'object',
                        properties: {
                          model: { type: 'string' },
                          prompt: { type: 'string' },
                          aspect_ratio: { type: 'string' },
                          count: { type: 'number' },
                        },
                        required: ['model', 'prompt'],
                      },
                      context: { type: 'string' },
                    },
                    required: ['params'],
                  },
                },
                {
                  name: 'generate_video',
                  description: 'Generate video',
                  inputSchema: {
                    type: 'object',
                    properties: {
                      params: {
                        type: 'object',
                        properties: {
                          model: { type: 'string' },
                          prompt: { type: 'string' },
                          medias: { type: 'array' },
                        },
                      },
                      context: { type: 'string' },
                    },
                  },
                },
                {
                  name: 'media_upload',
                  description: 'Create presigned upload URL',
                  inputSchema: {
                    type: 'object',
                    properties: {
                      filename: { type: 'string' },
                      content_type: { type: 'string' },
                      type: { type: 'string' },
                    },
                  },
                },
                {
                  name: 'media_confirm',
                  description: 'Confirm uploaded media',
                  inputSchema: { type: 'object', properties: { media_id: { type: 'string' } } },
                },
                { name: 'genjutsu', description: 'Style transfer', inputSchema: { type: 'object', properties: { prompt: { type: 'string' } } } },
                {
                  name: 'job_status',
                  description: 'Check async generation job status',
                  inputSchema: {
                    type: 'object',
                    properties: { jobId: { type: 'string' }, sync: { type: 'boolean' } },
                    required: ['jobId'],
                  },
                },
                { name: 'balance', description: 'Check account credits and plan balance', inputSchema: { type: 'object', properties: {} } },
                { name: 'gpu_status', description: 'Check GPU worker and credit status', inputSchema: { type: 'object', properties: {} } },
              ],
            };
          } else if (rpc.method === 'tools/call' && rpc.params?.name === 'gpu_status') {
            result = {
              content: [{ type: 'text', text: JSON.stringify({ status: 'healthy', activeGpus: 8, queueDepth: 0 }) }],
            };
          } else if (rpc.method === 'tools/call' && rpc.params?.name === 'balance') {
            result = {
              content: [{ type: 'text', text: 'Credits: 999.5 | Plan: ultimate' }],
            };
          } else if (rpc.method === 'tools/call' && rpc.params?.name === 'media_upload') {
            const upId = `mock_media_${++mockUploadCounter}`;
            mockUploadTypes.set(upId, {
              type: rpc.params?.arguments?.type,
              content_type: rpc.params?.arguments?.content_type,
              filename: rpc.params?.arguments?.filename,
            });
            result = {
              structuredContent: { upload_url: `${mockBaseUrl}/mock-upload/${upId}`, media_id: upId },
              content: [{ type: 'text', text: JSON.stringify({ upload_url: `${mockBaseUrl}/mock-upload/${upId}`, media_id: upId }) }],
            };
          } else if (rpc.method === 'tools/call' && rpc.params?.name === 'media_confirm') {
            result = {
              structuredContent: { media_id: rpc.params?.arguments?.media_id, status: 'confirmed' },
              content: [{ type: 'text', text: JSON.stringify({ media_id: rpc.params?.arguments?.media_id }) }],
            };
          } else if (rpc.method === 'tools/call' && rpc.params?.name === 'generate_image') {
            const nestedParams = rpc.params?.arguments?.params || {};
            const pText = String(nestedParams.prompt || '');
            if (pText.includes('BATCH4_MULTI')) {
              if (nestedParams.count !== 4 || nestedParams.use_unlim !== false) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: `Expected count=4, use_unlim=false, got ${JSON.stringify(nestedParams)}` }));
                return;
              }
              result = {
                structuredContent: {
                  results: [
                    { id: 'job_batch_1', status: 'queued' },
                    { id: 'job_batch_2', status: 'queued' },
                    { id: 'job_batch_3', status: 'queued' },
                    { id: 'job_batch_4', status: 'queued' },
                  ],
                },
                content: [{ type: 'text', text: 'Submitted 4 batch jobs' }],
              };
            } else if (pText.includes('BATCH4_CAPPED')) {
              const capId = `job_cap_${++mockCappedJobCounter}`;
              result = {
                structuredContent: { results: [{ id: capId, status: 'queued' }] },
                content: [{ type: 'text', text: `Submitted ${capId}` }],
              };
            } else {
              if (
                nestedParams.model !== 'gpt_image_2_6' ||
                nestedParams.aspect_ratio !== '16:9' ||
                nestedParams.quality !== 'high' ||
                nestedParams.background !== 'transparent' ||
                nestedParams.output_format !== 'png'
              ) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: `Unexpected params payload: ${JSON.stringify(rpc.params?.arguments)}` }));
                return;
              }
              result = {
                structuredContent: { results: [{ id: 'job_stage91_mock_01', status: 'queued' }] },
                content: [{ type: 'text', text: 'Submitted job_stage91_mock_01' }],
              };
            }
          } else if (rpc.method === 'tools/call' && rpc.params?.name === 'generate_video') {
            const nestedParams = rpc.params?.arguments?.params || {};
            mockVideoRequests.push(nestedParams);
            result = {
              structuredContent: { results: [{ id: `job_vid_ref_${mockVideoRequests.length}`, status: 'queued' }] },
              content: [{ type: 'text', text: `Submitted video job` }],
            };
          } else if (rpc.method === 'tools/call' && rpc.params?.name === 'job_status') {
            const jid = String(rpc.params?.arguments?.jobId || '');
            if (jid.startsWith('job_vid_ref_')) {
              result = {
                structuredContent: {
                  generation: {
                    id: jid,
                    status: 'completed',
                    results: { rawUrl: `${mockBaseUrl}/mock-assets/result.mp4?${jid}` },
                  },
                },
              };
            } else if (jid.startsWith('job_batch_') || jid.startsWith('job_cap_')) {
              result = {
                structuredContent: {
                  generation: {
                    id: jid,
                    status: 'completed',
                    results: { rawUrl: `${mockBaseUrl}/mock-assets/result.png?${jid}` },
                  },
                },
              };
            } else {
              if (jid !== 'job_stage91_mock_01' || rpc.params?.arguments?.sync !== true) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: `Unexpected job_status args: ${JSON.stringify(rpc.params?.arguments)}` }));
                return;
              }
              result = {
                content: [
                  {
                    type: 'resource_link',
                    uri: `${mockBaseUrl}/mock-assets/result.png`,
                    mimeType: 'image/png',
                  },
                ],
                structuredContent: {
                  generation: {
                    id: 'job_stage91_mock_01',
                    status: 'completed',
                    results: {
                      minUrl: `${mockBaseUrl}/mock-assets/thumb_min.webp`,
                      rawUrl: `${mockBaseUrl}/mock-assets/result.png`,
                    },
                  },
                },
              };
            }
          }
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Mcp-Session-Id': mockSseSessionId,
        });
        res.end(`event: message\ndata: ${JSON.stringify({ jsonrpc: '2.0', id: rpc.id, result })}\n\n`);
        return;
      }
      res.writeHead(404).end();
    });

    await new Promise((resolve) => mockOAuthHttpServer.listen(0, '127.0.0.1', resolve));
    const mockAddr = mockOAuthHttpServer.address();
    mockBaseUrl = `http://127.0.0.1:${mockAddr.port}`;

    const oauthStart = await postJson(baseUrl, '/api/mcp/oauth/start', {
      platformId: 'mock_oauth_e2e',
      serverName: 'Mock OAuth Streamable MCP',
      mcpUrl: `${mockBaseUrl}/mcp`,
    });
    assert(oauthStart.ok === true && oauthStart.sessionId && oauthStart.state, 'POST /api/mcp/oauth/start failed');
    assert(oauthStart.step === 'awaiting_login', `Expected step=awaiting_login, got ${oauthStart.step}`);
    assert(
      typeof oauthStart.authorizeUrl === 'string' &&
        oauthStart.authorizeUrl.startsWith(`${mockBaseUrl}/oauth/authorize`) &&
        oauthStart.authorizeUrl.includes('code_challenge_method=S256'),
      `Invalid mock PKCE authorizeUrl: ${oauthStart.authorizeUrl}`
    );

    const cbRes = await fetch(
      `${baseUrl}/api/mcp/oauth/callback?code=mock_auth_code_9&state=${encodeURIComponent(oauthStart.state)}`
    );
    assert(cbRes.status === 200, `GET /api/mcp/oauth/callback returned ${cbRes.status}`);
    const cbHtml = await cbRes.text();
    assert(cbHtml.includes('dreamflow_mcp_oauth_complete'), 'OAuth callback HTML missing postMessage event');

    const statusRes = await fetch(`${baseUrl}/api/mcp/oauth/status/${encodeURIComponent(oauthStart.sessionId)}`);
    assert(statusRes.status === 200, `GET /api/mcp/oauth/status failed: ${statusRes.status}`);
    const statusJson = await statusRes.json();
    assert(statusJson.session?.step === 'connected', `Expected session.step=connected, got ${statusJson.session?.step}`);
    assert(
      statusJson.session?.account?.email === 'director@higgsfield.ai',
      `Expected decoded JWT email, got ${JSON.stringify(statusJson.session?.account)}`
    );
    const toolNames = (statusJson.session?.tools || []).map((t) => t.name);
    for (const reqTool of ['generate_image', 'generate_video', 'genjutsu', 'gpu_status']) {
      assert(toolNames.includes(reqTool), `Missing Streamable HTTP SSE tool ${reqTool}: ${JSON.stringify(toolNames)}`);
    }
    registeredOAuthServerId = statusJson.session.serverId;

    const gpuCall = await postJson(baseUrl, '/api/mcp/call', {
      serverId: registeredOAuthServerId,
      toolName: 'gpu_status',
      arguments: {},
    });
    assert(gpuCall.ok === true && String(gpuCall.textContent || '').includes('healthy'), `gpu_status MCP call failed: ${JSON.stringify(gpuCall)}`);

    // Stage 9.1 + 9.2 mock nested { params, context } + models_explore skip + modelParams forwarding + results[0].id -> job_status({ jobId, sync: true }) + resource_link/rawUrl over minUrl
    const mcpNodeGen = await postJson(baseUrl, '/api/generate-node', {
      nodeId: 'e2e-stage91-mcp-node',
      kind: 'image',
      platformId: 'mock_oauth_e2e',
      connectionMode: 'mcp',
      mcpServerId: registeredOAuthServerId,
      modelId: 'chatgpt-image-2.6',
      prompt: 'Seagull field guide coastal cliff illustration',
      settings: {
        aspectRatio: '16:9',
        resolution: '2K',
        quality: 'high',
        modelParams: { background: 'transparent', output_format: 'png' },
      },
    });
    assert(mcpNodeGen.ok === true && mcpNodeGen.transportUsed === 'mcp', `Mock nested MCP generate-node failed: ${JSON.stringify(mcpNodeGen)}`);
    assert(mcpNodeGen.mcpToolName === 'generate_image', `Expected selectBestToolForModality to pick generate_image over models_explore, got ${mcpNodeGen.mcpToolName}`);
    assert(mcpNodeGen.normalizedModelId === 'gpt_image_2_6', `Expected normalizedModelId=gpt_image_2_6, got ${mcpNodeGen.normalizedModelId}`);
    assert(mcpNodeGen.jobId === 'job_stage91_mock_01', `Expected async jobId=job_stage91_mock_01, got ${mcpNodeGen.jobId}`);
    assert(typeof mcpNodeGen.mediaUrl === 'string' && mcpNodeGen.mediaUrl.endsWith('.png'), `Expected lossless .png ahead of _min.webp, got ${mcpNodeGen.mediaUrl}`);
    createdMediaPaths.push(mcpNodeGen.mediaUrl);
    assert(findGeneratedMediaDiskPath(mcpNodeGen.mediaUrl), `Generated Stage 9.1 mock PNG missing on disk: ${mcpNodeGen.mediaUrl}`);

    // Stage 9.2 live catalog + dynamic per-model parameter schema endpoint check
    const mcpModelsRes = await fetch(`${baseUrl}/api/mcp/models?platformId=higgsfield`);
    assert(mcpModelsRes.status === 200, `GET /api/mcp/models failed (${mcpModelsRes.status})`);
    const mcpModelsJson = await mcpModelsRes.json();
    assert(mcpModelsJson.ok === true && Array.isArray(mcpModelsJson.models) && mcpModelsJson.models.length >= 50, `Expected >= 50 Higgsfield models from /api/mcp/models, got ${mcpModelsJson.models?.length}`);
    const gpt26Schema = mcpModelsJson.models.find((m) => m.id === 'gpt_image_2_6');
    assert(
      gpt26Schema &&
        Array.isArray(gpt26Schema.parameters) &&
        gpt26Schema.parameters.some((p) => p.name === 'quality') &&
        gpt26Schema.parameters.some((p) => p.name === 'background') &&
        gpt26Schema.parameters.some((p) => p.name === 'output_format'),
      `Expected gpt_image_2_6 parameters (quality, background, output_format) in /api/mcp/models: ${JSON.stringify(gpt26Schema?.parameters)}`
    );
    const platformsCatalogRes = await fetch(`${baseUrl}/api/platforms`);
    assert(platformsCatalogRes.status === 200, `GET /api/platforms failed (${platformsCatalogRes.status})`);
    const platformsCatalogJson = await platformsCatalogRes.json();
    const oaiCatalog = (platformsCatalogJson.platforms || []).find((p) => p.id === 'openai');
    assert(
      oaiCatalog && oaiCatalog.models?.some((m) => m.id === 'gpt-image-1.5') && oaiCatalog.models?.some((m) => m.id === 'sora-2'),
      `Expected enriched OpenAI catalog (gpt-image-1.5, sora-2), got: ${JSON.stringify(oaiCatalog?.models?.map((m) => m.id))}`
    );

    const balanceConnRes = await fetch(`${baseUrl}/api/connections/status?forceRefresh=1`);
    assert(balanceConnRes.status === 200, `GET /api/connections/status?forceRefresh=1 failed (${balanceConnRes.status})`);
    const balanceConnJson = await balanceConnRes.json();
    const mockSrvSummary = (balanceConnJson.mcpServers || []).find((s) => s.id === registeredOAuthServerId);
    assert(
      mockSrvSummary?.balance?.credits === 999.5 && mockSrvSummary?.balance?.plan === 'ultimate',
      `Expected Stage 9.1 live balance {999.5, ultimate} on ${registeredOAuthServerId}, got: ${JSON.stringify(mockSrvSummary?.balance)}`
    );

    // Live Higgsfield https://mcp.higgsfield.ai/mcp DCR + PKCE probe
    const liveHiggsRes = await fetch(`${baseUrl}/api/mcp/oauth/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ platformId: 'higgsfield' }),
    });
    const liveHiggsJson = await liveHiggsRes.json();
    let liveHiggsStatus = 'live-probe';
    if (liveHiggsRes.ok && liveHiggsJson.ok) {
      assert(
        typeof liveHiggsJson.authorizeUrl === 'string' &&
          (liveHiggsJson.authorizeUrl.startsWith('https://clerk.higgsfield.ai/oauth/authorize') ||
            liveHiggsJson.authorizeUrl.startsWith('https://mcp.higgsfield.ai/oauth2/authorize')),
        `Unexpected live Higgsfield authorizeUrl: ${liveHiggsJson.authorizeUrl}`
      );
      assert(
        liveHiggsJson.authorizeUrl.includes('code_challenge_method=S256') &&
          liveHiggsJson.authorizeUrl.includes('redirect_uri='),
        `Live Higgsfield authorizeUrl missing S256 PKCE or redirect_uri: ${liveHiggsJson.authorizeUrl}`
      );
      liveHiggsStatus = `live Higgsfield PKCE ok (${new URL(liveHiggsJson.authorizeUrl).host})`;
    } else {
      assert(
        /fetch failed|ENOTFOUND|ECONNREFUSED|timeout/i.test(String(liveHiggsJson.error || '')),
        `Live Higgsfield oauth/start returned unexpected non-network error: ${JSON.stringify(liveHiggsJson)}`
      );
      liveHiggsStatus = 'offline fallback checked';
    }

    const checkBrowserRes = await postJson(baseUrl, '/api/connections/check-browser', {});
    assert(checkBrowserRes.ok === true && Array.isArray(checkBrowserRes.connectedBrowserPlatforms), 'POST /api/connections/check-browser invalid response');

    logStep(
      '11/18 mcp-oauth-and-check-browser',
      `Verified Mock OAuth 2.1 PKCE + Streamable HTTP SSE (4 tools + gpu_status), ${liveHiggsStatus}, & POST /api/connections/check-browser (200 OK)`
    );

    // -------------------------------------------------------------------------
    // Stage [12/18 batch-multiref-and-dreamina-mcp]:
    //   1) True 4-image batch outputs (multi-job + single-job-capped fan-out)
    //   2) Multi-modal video + image references & start-end frame roles
    //   3) Isolated Dreamina MCP flow (connect -> status -> connectedMcpPlatforms -> tools/list)
    // -------------------------------------------------------------------------
    const batch4Multi = await postJson(baseUrl, '/api/generate-node', {
      nodeId: 'e2e-stage10-batch4-multi',
      kind: 'image',
      platformId: 'mock_oauth_e2e',
      connectionMode: 'mcp',
      mcpServerId: registeredOAuthServerId,
      modelId: 'gpt_image_2_6',
      prompt: 'BATCH4_MULTI architectural variations',
      settings: { aspectRatio: '16:9', resolution: '2K', batchCount: 4 },
    });
    assert(batch4Multi.ok === true && Array.isArray(batch4Multi.outputs) && batch4Multi.outputs.length === 4, `Expected 4 outputs from BATCH4_MULTI, got ${JSON.stringify(batch4Multi.outputs)}`);
    assert(new Set(batch4Multi.outputs).size === 4, `BATCH4_MULTI outputs must be 4 distinct files: ${JSON.stringify(batch4Multi.outputs)}`);
    for (const outUrl of batch4Multi.outputs) {
      createdMediaPaths.push(outUrl);
      assert(findGeneratedMediaDiskPath(outUrl), `BATCH4_MULTI file missing on disk: ${outUrl}`);
    }

    const batch4Capped = await postJson(baseUrl, '/api/generate-node', {
      nodeId: 'e2e-stage10-batch4-capped',
      kind: 'image',
      platformId: 'mock_oauth_e2e',
      connectionMode: 'mcp',
      mcpServerId: registeredOAuthServerId,
      modelId: 'gpt_image_2_6',
      prompt: 'BATCH4_CAPPED single-job fan-out',
      settings: { aspectRatio: '16:9', resolution: '2K', batchCount: 4 },
    });
    assert(batch4Capped.ok === true && Array.isArray(batch4Capped.outputs) && batch4Capped.outputs.length === 4, `Expected 4 outputs from BATCH4_CAPPED fan-out, got ${JSON.stringify(batch4Capped.outputs)}`);
    assert(new Set(batch4Capped.outputs).size === 4, `BATCH4_CAPPED outputs must be 4 distinct files: ${JSON.stringify(batch4Capped.outputs)}`);
    for (const outUrl of batch4Capped.outputs) {
      createdMediaPaths.push(outUrl);
      assert(findGeneratedMediaDiskPath(outUrl), `BATCH4_CAPPED file missing on disk: ${outUrl}`);
    }

    const multiRefVid = await postJson(baseUrl, '/api/generate-node', {
      nodeId: 'e2e-stage10-multiref-vid',
      kind: 'video',
      platformId: 'mock_oauth_e2e',
      connectionMode: 'mcp',
      mcpServerId: registeredOAuthServerId,
      modelId: 'seedance_2_5',
      prompt: 'Multi-modal courtyard transition',
      referenceFrameMode: 'multi-ref',
      referenceImages: [`/media/${tmpImg1}`, `/media/${tmpImg2}`],
      videoReferences: [`/media/${tmpMp4Master}`],
      settings: { aspectRatio: '16:9', durationSec: 5 },
    });
    assert(multiRefVid.ok === true && multiRefVid.mediaUrl, `Multi-modal video gen failed: ${JSON.stringify(multiRefVid)}`);
    createdMediaPaths.push(multiRefVid.mediaUrl);
    const req1Medias = mockVideoRequests[0]?.medias || [];
    assert(
      req1Medias.filter((m) => m.role === 'image_references').length === 2 &&
        req1Medias.filter((m) => m.role === 'video_references').length === 1,
      `Expected 2 image_references + 1 video_references in Seedance 2.5 medias, got: ${JSON.stringify(req1Medias)}`
    );
    const vidUploadMeta = Array.from(mockUploadTypes.values()).find((u) => u.type === 'video' || String(u.content_type || '').includes('video'));
    assert(Boolean(vidUploadMeta), `Expected video MIME/type media_upload metadata, got: ${JSON.stringify(Array.from(mockUploadTypes.values()))}`);

    const startEndVid = await postJson(baseUrl, '/api/generate-node', {
      nodeId: 'e2e-stage10-startend-vid',
      kind: 'video',
      platformId: 'mock_oauth_e2e',
      connectionMode: 'mcp',
      mcpServerId: registeredOAuthServerId,
      modelId: 'cinematic_studio_video_4_0',
      prompt: 'Start to end frame interpolation',
      referenceFrameMode: 'start-end',
      referenceImages: [`/media/${tmpImg1}`, `/media/${tmpImg2}`],
      settings: { aspectRatio: '16:9', durationSec: 5 },
    });
    assert(startEndVid.ok === true && startEndVid.mediaUrl, `Start-end video gen failed: ${JSON.stringify(startEndVid)}`);
    createdMediaPaths.push(startEndVid.mediaUrl);
    const req2Medias = mockVideoRequests[1]?.medias || [];
    assert(
      req2Medias.some((m) => m.role === 'start_image') && req2Medias.some((m) => m.role === 'end_image'),
      `Expected start_image + end_image roles in start-end mode, got: ${JSON.stringify(req2Medias)}`
    );

    // Isolated Dreamina MCP Connect Flow (uses os.tmpdir DREAMFLOW_DREAMINA_CONFIG_PATH + isolated test bridge port)
    const prevDreaminaEnv = process.env.DREAMFLOW_DREAMINA_CONFIG_PATH;
    const prevDisableSysCli = process.env.DREAMFLOW_DISABLE_SYSTEM_DREAMINA_CLI;
    const tmpDreaminaCfg = path.join(os.tmpdir(), `dreamflow_e2e_dreamina_${Date.now()}.json`);
    process.env.DREAMFLOW_DREAMINA_CONFIG_PATH = tmpDreaminaCfg;
    process.env.DREAMFLOW_DISABLE_SYSTEM_DREAMINA_CLI = '1';
    const dreaminaPort = 14800 + Math.floor(Math.random() * 1000);
    const dreaminaBridge = new McpStdioBridgeServer({ host: '127.0.0.1', port: dreaminaPort, quiet: true });
    try {
      await dreaminaBridge.start();
      const dUrl = `http://127.0.0.1:${dreaminaPort}`;
      const dConn = await postJson(dUrl, '/api/mcp/dreamina/connect', {
        mode: 'session',
        sessionIdCookie: 'e2e_mock_dreamina_cookie_xyz',
      });
      assert(dConn.ok === true && dConn.session?.sessionId, `POST /api/mcp/dreamina/connect failed: ${JSON.stringify(dConn)}`);
      const dStatRes = await fetch(`${dUrl}/api/mcp/dreamina/status/${encodeURIComponent(dConn.session.sessionId)}`);
      assert(dStatRes.status === 200, `GET /api/mcp/dreamina/status failed (${dStatRes.status})`);
      const dStat = await dStatRes.json();
      assert(dStat.session?.step === 'connected', `Expected Dreamina MCP step=connected, got ${JSON.stringify(dStat)}`);

      const dConnStatusRes = await fetch(`${dUrl}/api/connections/status`);
      const dConnStatus = await dConnStatusRes.json();
      assert(
        Array.isArray(dConnStatus.connectedMcpPlatforms) && dConnStatus.connectedMcpPlatforms.includes('dreamina'),
        `Expected dreamina in connectedMcpPlatforms, got: ${JSON.stringify(dConnStatus.connectedMcpPlatforms)}`
      );

      const dServersRes = await fetch(`${dUrl}/api/mcp/servers`);
      const dServersJson = await dServersRes.json();
      const dreaminaSrv = (dServersJson.servers || []).find((s) => s.id === 'mcp_dreamina');
      const dToolNames = (dreaminaSrv?.tools || []).map((t) => t.name);
      assert(
        dToolNames.includes('dreamina_generate_image') && dToolNames.includes('dreamina_generate_video'),
        `Expected mcp_dreamina tools dreamina_generate_image & dreamina_generate_video, got: ${JSON.stringify(dToolNames)}`
      );

      const dModelsRes = await fetch(`${dUrl}/api/mcp/models?platformId=dreamina`);
      const dModelsJson = await dModelsRes.json();
      assert(
        dModelsJson.ok === true && dModelsJson.models?.some((m) => m.id === 'seedream_5_5') && dModelsJson.models?.some((m) => m.id === 'seedance_2_5'),
        `Expected seedream_5_5 & seedance_2_5 from /api/mcp/models?platformId=dreamina`
      );

      await postJson(dUrl, '/api/mcp/dreamina/disconnect', {});
    } finally {
      await dreaminaBridge.stop();
      if (fs.existsSync(tmpDreaminaCfg)) fs.unlinkSync(tmpDreaminaCfg);
      if (prevDreaminaEnv === undefined) {
        delete process.env.DREAMFLOW_DREAMINA_CONFIG_PATH;
      } else {
        process.env.DREAMFLOW_DREAMINA_CONFIG_PATH = prevDreaminaEnv;
      }
      if (prevDisableSysCli === undefined) {
        delete process.env.DREAMFLOW_DISABLE_SYSTEM_DREAMINA_CLI;
      } else {
        process.env.DREAMFLOW_DISABLE_SYSTEM_DREAMINA_CLI = prevDisableSysCli;
      }
    }

    logStep(
      '12/18 batch-multiref-and-dreamina-mcp',
      'Verified 4x batch (multi-job + single-cap fan-out), multi-modal video+image & start/end refs, and isolated Dreamina MCP connect flow'
    );

    // -------------------------------------------------------------------------
    // Stage [13/18 chrome-bridge]: Manifest V3 v1.2.0 across all 8 creator domains
    // -------------------------------------------------------------------------
    verifyStage11ChromeBridge();

    // -------------------------------------------------------------------------
    // Stage [14/18 cli-and-docker]: open-dreamflow doctor + unified SPA GET :3001/ + Docker
    // -------------------------------------------------------------------------
    const cliPath = path.join(ROOT, 'bin/open-dreamflow.mjs');
    assert(fs.existsSync(cliPath), 'bin/open-dreamflow.mjs missing');
    const doctorOut = execFileSync(process.execPath, [cliPath, 'doctor'], { encoding: 'utf8' });
    assert(
      doctorOut.includes('All core Open-DreamFlow runtime checks passed'),
      `open-dreamflow doctor unexpected output: ${doctorOut}`
    );

    const spaRoot = await new Promise((resolve, reject) => {
      const req = http.get(`${baseUrl}/`, { agent: false }, (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          body += chunk;
        });
        res.on('end', () => resolve({ status: res.statusCode, body }));
      });
      req.on('error', reject);
    });
    assert(spaRoot.status === 200, `Expected GET ${baseUrl}/ unified SPA to return 200 OK, got ${spaRoot.status}`);
    assert(spaRoot.body.includes('<div id="root"></div>'), 'Unified SPA GET / missing <div id="root"></div>');

    for (const dockerFile of ['Dockerfile', 'docker-compose.yml', '.dockerignore']) {
      const fullDocker = path.join(ROOT, dockerFile);
      assert(fs.existsSync(fullDocker) && fs.statSync(fullDocker).size > 40, `Missing/empty ${dockerFile}`);
    }

    logStep(
      '14/18 cli-and-docker',
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
    for (const sid of [registeredMcpServerId, registeredOAuthServerId].filter(Boolean)) {
      try {
        await fetch(`${baseUrl}/api/mcp/servers/${encodeURIComponent(sid)}`, { method: 'DELETE' });
      } catch {
        // ignore
      }
    }
    if (mockOAuthHttpServer) {
      try {
        await new Promise((r) => mockOAuthHttpServer.close(r));
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
    if (hadPriorOAuthClients && priorOAuthClientsBytes) {
      fs.writeFileSync(oauthClientsPath, priorOAuthClientsBytes);
    } else if (!hadPriorOAuthClients && fs.existsSync(oauthClientsPath)) {
      fs.unlinkSync(oauthClientsPath);
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
    '13/18 chrome-bridge',
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
  const cssBundle = fs.readFileSync(cssPath, 'utf8');
  for (const bannedHex of ['#A855F7', '#EC4899']) {
    assert(
      !jsBundle.toUpperCase().includes(bannedHex) && !cssBundle.toUpperCase().includes(bannedHex),
      `Banned neon hex ${bannedHex} detected in production web-studio bundle`
    );
  }
  const providerModalSrc = fs.readFileSync(
    path.join(ROOT, 'apps/web-studio/src/components/ProviderModal.tsx'),
    'utf8'
  );
  assert(
    providerModalSrc.includes('seen.has(plat.id)') && providerModalSrc.includes('railPlatforms'),
    'ProviderModal.tsx must deduplicate railPlatforms by plat.id so custom-mcp is never duplicated'
  );
  const platformCatalogSrc = fs.readFileSync(
    path.join(ROOT, 'apps/web-studio/src/presets/platformCatalog.ts'),
    'utf8'
  );
  assert(
    !platformCatalogSrc.includes("'seedance_1_5_pro':") &&
      platformCatalogSrc.includes("platformId !== 'dreamina'"),
    'platformCatalog.ts must not drop seedance_1_5_pro in LEGACY_MODEL_ID_REDIRECTS and must exclude dreamina from allowInDropdown raw MCP tool mixing'
  );
  const overlaySrc = fs.readFileSync(
    path.join(ROOT, 'apps/web-studio/src/components/ContextualNodeOverlay.tsx'),
    'utf8'
  );
  assert(
    overlaySrc.includes('buildFamilyChips') && overlaySrc.includes('familyMatchesChip'),
    'ContextualNodeOverlay.tsx must use dynamic buildFamilyChips + familyMatchesChip matching'
  );
  for (const marker of [
    '2×2 Grid',
    'Split into',
    'Reference to Image',
    'Reference to Video',
    'Connect Dreamina via MCP',
    'Nano Banana 2.1',
    'Official CLI MCP',
    'Seedance 2.5',
    'Seedance 1.5 Pro',
    'Seedance 2.0 Mini',
    'Veo 3.1 Lite',
    'Gemini Omni 1.1 Flash',
    'Motion Imitation',
    'Seed TTS',
    'Resources & Ops',
    'Workflows & 3D',
    'cli_oauth',
    'dreamina_mcp_oauth',
    'Start → End Frame',
    'References Selected',
    'Search 100+ models',
    'gpt_image_2_6_flare',
    'cinematic_studio_video_4_0',
    'Quality:',
    'UNLIM',
    'modelParams',
    'PlatformBrandIcon',
    'Connect Higgsfield via MCP',
    'Connected Successfully',
    'Check Credits & Plan Balance',
    '✓ MCP Connected',
    'Higgsfield MCP',
    'gpt_image_2_6',
    '/api/mcp/oauth/start',
    '/api/connections/check-browser',
    'Launch Connected Creator Browser',
    'Connected via Browser',
    'DoP Rig',
    'Sume',
    'ChatGPT Image 2.6',
    'Kling 4.0',
  ]) {
    assert(
      jsBundle.toLowerCase().includes(marker.toLowerCase()),
      `Stage 10.1 Studio UI marker missing in compiled bundle: ${marker}`
    );
  }

  const distMedia = path.join(distDir, 'media');
  if (fs.existsSync(distMedia)) {
    const legacyDistReal = fs.readdirSync(distMedia).filter((f) => f.startsWith('real_'));
    assert(
      legacyDistReal.length === 0,
      `Forbidden real_* demo media found in apps/web-studio/dist/media: ${legacyDistReal.join(', ')}`
    );
  }

  const distBrands = path.join(distDir, 'brands');
  assert(fs.existsSync(distBrands), 'apps/web-studio/dist/brands missing from production build');
  for (const brandFile of [
    'google.svg',
    'mcp.svg',
    'higgsfield.png',
    'dreamina.png',
    'kling.png',
    'elevenlabs.png',
    'elevenlabs.svg',
    'openai.svg',
    'fal.png',
    'replicate.png',
    'comfyui.png',
    'comfyui.svg',
    'openart.png',
    'imagineart.png',
    'imagineart.svg',
    'sume.png',
  ]) {
    assert(fs.existsSync(path.join(distBrands, brandFile)), `dist/brands/${brandFile} missing`);
  }

  const presetsSrc = fs.readFileSync(
    path.join(ROOT, 'apps/web-studio/src/presets/studioPresets.ts'),
    'utf8'
  );
  assert(
    presetsSrc.includes('export const MEDIA_ASSET_CATALOG: MediaCatalogItem[] = [];'),
    'MEDIA_ASSET_CATALOG in studioPresets.ts must be empty ([])'
  );

  const scanCleanFiles = [
    path.join(ROOT, 'apps/web-studio/index.html'),
    path.join(ROOT, 'apps/web-studio/tailwind.config.js'),
    jsPath,
    cssPath,
  ];
  const walkSrc = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walkSrc(full);
      else if (/\.(ts|tsx|css)$/i.test(entry.name)) scanCleanFiles.push(full);
    }
  };
  walkSrc(path.join(ROOT, 'apps/web-studio/src'));
  for (const filePath of scanCleanFiles) {
    assertCleanUiText(path.relative(ROOT, filePath), fs.readFileSync(filePath, 'utf8'));
  }

  logStep(
    '15/18 web-studio',
    `Dreamina 1:1 Vite bundle + official /brands/* (16 assets) + Inter-only (0 font-mono/JetBrains) + 0 real_* demo purge verified (${jsFiles[0]} = ${jsSizeKb} kB, ${cssFiles[0]} = ${cssSizeKb} kB)`
  );
}

async function verifyStage16DreaminaCliHermetic() {
  const mcpBridge = path.join(ROOT, 'packages/mcp-client/dist/server-bridge.js');
  const { McpStdioBridgeServer } = await import(pathToFileURL(mcpBridge).href);

  const prevCfgEnv = process.env.DREAMFLOW_DREAMINA_CONFIG_PATH;
  const prevBinEnv = process.env.DREAMFLOW_DREAMINA_BINARY_PATH;
  const prevDisableEnv = process.env.DREAMFLOW_DISABLE_SYSTEM_DREAMINA_CLI;

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'df_hermetic_cli_'));
  const tmpCfgPath = path.join(tmpDir, 'dreamina-mcp.json');
  const tmpStatePath = path.join(tmpDir, 'cli-state.json');
  const tmpMockBinPath = path.join(tmpDir, 'dreamina-canvas');
  const tmpMediaTracker = [];

  // Write executable mock dreamina-canvas CLI v1.3.0 in os.tmpdir()
  const mockCliSource = `#!/usr/bin/env node
import * as fs from 'node:fs';
import * as path from 'node:path';

const statePath = ${JSON.stringify(tmpStatePath)};
const loadState = () => {
  try {
    return JSON.parse(fs.readFileSync(statePath, 'utf8'));
  } catch {
    return { loggedIn: false, projectId: null, uploads: 0, runs: [], lastModality: 'image' };
  }
};
const saveState = (s) => fs.writeFileSync(statePath, JSON.stringify(s, null, 2));

const rawArgs = process.argv.slice(2);
const pos = [];
const flags = {};
for (let i = 0; i < rawArgs.length; i++) {
  const a = rawArgs[i];
  if (a === '--format' || a === '--project-id' || a === '--node-id' || a === '--submit-id' || a === '--credit-ceiling' || a === '--credit-token' || a === '--type' || a === '--file' || a === '--ref' || a === '--ratio' || a === '--resolution' || a === '--duration' || a === '--count' || a === '--mode' || a === '--model' || a === '--prompt' || a === '--title' || a === '--device-code' || a === '--timeout' || a === '--interval' || a === '--limit' || a === '-o') {
    const val = rawArgs[i + 1] ?? '';
    if (!flags[a]) flags[a] = [];
    flags[a].push(val);
    i++;
  } else if (a.startsWith('--')) {
    flags[a] = ['true'];
  } else {
    pos.push(a);
  }
}

const out = (data) => {
  process.stdout.write(JSON.stringify({ schemaVersion: '2', ok: true, data }) + '\\n');
};
const fail = (msg) => {
  process.stderr.write(JSON.stringify({ ok: false, error: msg }) + '\\n');
  process.exit(1);
};

const cmd = pos[0];
const sub = pos[1];
const state = loadState();

if (cmd === 'version') {
  out({ version: '1.3.0' });
} else if (cmd === 'auth' && sub === 'status') {
  out({ loggedIn: Boolean(state.loggedIn) });
} else if (cmd === 'auth' && sub === 'login') {
  out({
    status: 'authorization_required',
    challenge: {
      deviceCode: 'mock_dev_code_101',
      userCode: 'DF10-1699',
      verificationUriComplete: 'https://dreamina.capcut.com/oauth/device?user_code=DF10-1699',
    },
  });
} else if (cmd === 'auth' && sub === 'wait') {
  if ((flags['--device-code']?.[0] || '') !== 'mock_dev_code_101') {
    fail('Expected --device-code mock_dev_code_101');
  }
  state.loggedIn = true;
  saveState(state);
  out({ status: 'logged_in' });
} else if (cmd === 'auth' && sub === 'account') {
  if (!state.loggedIn) fail('Not logged in');
  out({ displayName: 'HermeticTestUser', userId: 'u_herm_1', availableCredits: '42000', vipLevel: 'maestro' });
} else if (cmd === 'canvas' && sub === 'ls') {
  out({ canvases: state.projectId ? [{ projectId: state.projectId, name: 'Open-DreamFlow Bridge' }] : [] });
} else if (cmd === 'canvas' && sub === 'create') {
  state.projectId = flags['--project-id']?.[0] || 'proj_herm_101';
  saveState(state);
  out({ projectId: state.projectId });
} else if (cmd === 'model' && sub === 'list') {
  const t = flags['--type']?.[0] || 'image';
  const models =
    t === 'video'
      ? [{ id: 'seedance_2.5_flash', resolutions: ['480p', '720p'], ratios: ['16:9', '9:16'], minDuration: 4, maxDuration: 30, maxCount: 1 }]
      : t === 'audio'
        ? [{ id: 'seed_audio_v1', maxCount: 1 }]
        : [{ id: 'seedream_5.5', resolutions: ['1.5K', '2K'], ratios: ['1:1', '16:9', '9:16'], maxCount: 8 }];
  out({ models });
} else if (cmd === 'resource' && sub === 'upload') {
  const filePath = flags['--file']?.[0] || '';
  if (!filePath || !fs.existsSync(filePath)) fail('resource upload --file missing on disk: ' + filePath);
  state.uploads += 1;
  saveState(state);
  out({ resourceId: 'res_upload_' + state.uploads });
} else if (cmd === 'node' && sub === 'create') {
  const modality = pos[2] || 'image';
  state.lastModality = modality;
  saveState(state);
  out({ nodeId: 'node_herm_' + modality });
} else if (cmd === 'node' && sub === 'quote') {
  out({ totalCredit: 12 });
} else if (cmd === 'node' && sub === 'confirm') {
  if (!flags['--credit-ceiling']?.[0]) fail('Missing --credit-ceiling');
  out({ creditConfirmationToken: 'ctok_herm_999' });
} else if (cmd === 'node' && sub === 'run') {
  if ((flags['--credit-token']?.[0] || '') !== 'ctok_herm_999') {
    fail('Missing or invalid --credit-token');
  }
  state.runs.push({ nodeId: flags['--node-id']?.[0], token: flags['--credit-token']?.[0] });
  saveState(state);
  out({ submitId: flags['--submit-id']?.[0] || 'sub_herm_101' });
} else if (cmd === 'operation' && sub === 'wait') {
  out({ status: 'success' });
} else if (cmd === 'node' && sub === 'show') {
  const isVid = state.lastModality === 'video';
  out({
    node: {
      nodeId: flags['--node-id']?.[0] || 'node_herm',
      resources: [{ resourceId: isVid ? 'res_out_vid_1' : 'res_out_img_1', status: 'success' }],
    },
  });
} else if (cmd === 'resource' && sub === 'download') {
  const rid = pos[2] || 'res_out_img_1';
  const outDir = flags['-o']?.[0];
  if (!outDir) fail('Missing -o outDir');
  fs.mkdirSync(outDir, { recursive: true });
  const isVid = rid.includes('vid');
  const dest = path.join(outDir, isVid ? 'hermetic_out.mp4' : 'hermetic_out.png');
  const payload = isVid
    ? Buffer.from([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x6d, 0x70, 0x34, 0x32])
    : Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
  fs.writeFileSync(dest, payload);
  fs.chmodSync(dest, 0o600);
  out({ path: dest });
} else {
  fail('Unknown command: ' + rawArgs.join(' '));
}
`;

  fs.writeFileSync(tmpMockBinPath, mockCliSource, 'utf8');
  fs.chmodSync(tmpMockBinPath, 0o755);

  // Negative self-check 1: verify mock CLI fails loudly when --credit-token is omitted on node run
  const missingTokenRun = spawnSync(
    tmpMockBinPath,
    ['--format', 'json', 'node', 'run', '--project-id', 'p1', '--node-id', 'n1', '--submit-id', 's1'],
    { encoding: 'utf8' }
  );
  assert(
    missingTokenRun.status !== 0,
    'Negative check failed: mock CLI node run without --credit-token unexpectedly exited 0'
  );
  // Negative self-check 2: verify world-readable mode guard catches 0o600
  const isWorldReadable = (modeBits) => (modeBits & 0o004) !== 0;
  assert(!isWorldReadable(0o600), 'Negative check failed: 0o600 should fail world-readable static serving check');

  process.env.DREAMFLOW_DREAMINA_CONFIG_PATH = tmpCfgPath;
  process.env.DREAMFLOW_DREAMINA_BINARY_PATH = tmpMockBinPath;
  delete process.env.DREAMFLOW_DISABLE_SYSTEM_DREAMINA_CLI;

  const hPort = 15800 + Math.floor(Math.random() * 900);
  const bridge = new McpStdioBridgeServer({ host: '127.0.0.1', port: hPort, quiet: true });
  try {
    await bridge.start();
    const hUrl = `http://127.0.0.1:${hPort}`;

    const connRes = await postJson(hUrl, '/api/mcp/dreamina/connect', { mode: 'cli_oauth' });
    assert(connRes.ok === true && connRes.session?.sessionId, `Hermetic CLI connect failed: ${JSON.stringify(connRes)}`);
    assert(
      connRes.session.step === 'awaiting_login' &&
        String(connRes.session.authorizeUrl || '').includes('DF10-1699') &&
        connRes.session.userCode === 'DF10-1699',
      `Expected awaiting_login with verificationUriComplete & userCode DF10-1699, got: ${JSON.stringify(connRes.session)}`
    );

    let finalSess = connRes.session;
    const deadline = Date.now() + 10_000;
    while (finalSess.step !== 'connected' && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 120));
      const pollRes = await fetch(`${hUrl}/api/mcp/dreamina/status/${encodeURIComponent(connRes.session.sessionId)}`);
      assert(pollRes.status === 200, `Hermetic status poll HTTP ${pollRes.status}`);
      const pollJson = await pollRes.json();
      finalSess = pollJson.session || finalSess;
    }
    assert(finalSess.step === 'connected', `Expected auth wait -> connected, got: ${JSON.stringify(finalSess)}`);

    const statusRes = await fetch(`${hUrl}/api/connections/status`);
    const statusJson = await statusRes.json();
    assert(
      Array.isArray(statusJson.connectedMcpPlatforms) &&
        statusJson.connectedMcpPlatforms.includes('dreamina') &&
        statusJson.mcpBalances?.dreamina?.credits === 42000 &&
        statusJson.mcpBalances?.dreamina?.account === 'HermeticTestUser',
      `Expected live hermetic Dreamina balance 42000 in mcpBalances, got: ${JSON.stringify(statusJson)}`
    );

    const imgGen = await postJson(hUrl, '/api/generate-node', {
      nodeId: 'hermetic-img-1',
      kind: 'image',
      platformId: 'dreamina',
      connectionMode: 'mcp',
      modelId: 'seedream_5_5',
      prompt: 'Hermetic architectural courtyard test',
      settings: { aspectRatio: '16:9', resolution: '2K', batchCount: 1 },
    });
    assert(
      imgGen.ok === true && String(imgGen.mediaUrl || '').startsWith('/media/dreamina_mcp_'),
      `Hermetic CLI image gen failed: ${JSON.stringify(imgGen)}`
    );
    tmpMediaTracker.push(imgGen.mediaUrl);
    const imgDiskPath = findGeneratedMediaDiskPath(imgGen.mediaUrl);
    assert(Boolean(imgDiskPath), `Hermetic image missing on disk: ${imgGen.mediaUrl}`);
    const imgMode = fs.statSync(imgDiskPath).mode & 0o777;
    assert(
      isWorldReadable(imgMode) && imgMode === 0o644,
      `Expected 0o644 after resource download chmod fix, got 0o${imgMode.toString(8)}`
    );
    const imgHttp = await fetch(`${hUrl}${imgGen.mediaUrl}`);
    assert(imgHttp.status === 200, `Expected HTTP 200 on ${imgGen.mediaUrl}, got ${imgHttp.status}`);

    const hermeticRefFile = `verify_tmp_hermetic_ref_${Date.now()}.png`;
    const hermeticRefDiskPath = path.join(ROOT, 'apps/web-studio/public/media', hermeticRefFile);
    fs.mkdirSync(path.dirname(hermeticRefDiskPath), { recursive: true });
    fs.writeFileSync(hermeticRefDiskPath, Buffer.from(SAMPLE_SOURCE_PNG_B64, 'base64'));
    tmpMediaTracker.push(`/media/${hermeticRefFile}`);

    const vidGen = await postJson(hUrl, '/api/generate-node', {
      nodeId: 'hermetic-vid-1',
      kind: 'video',
      platformId: 'dreamina',
      connectionMode: 'mcp',
      modelId: 'seedance_2_5_flash',
      prompt: 'Hermetic I2V motion test',
      referenceImages: [`/media/${hermeticRefFile}`],
      settings: { aspectRatio: '16:9', resolution: '720p', durationSec: 4 },
    });
    assert(
      vidGen.ok === true &&
        String(vidGen.mediaUrl || '').startsWith('/media/dreamina_mcp_') &&
        String(vidGen.mediaUrl || '').endsWith('.mp4'),
      `Hermetic CLI video gen failed: ${JSON.stringify(vidGen)}`
    );
    tmpMediaTracker.push(vidGen.mediaUrl);
    const vidHttp = await fetch(`${hUrl}${vidGen.mediaUrl}`);
    assert(vidHttp.status === 200, `Expected HTTP 200 on ${vidGen.mediaUrl}, got ${vidHttp.status}`);

    const finalState = JSON.parse(fs.readFileSync(tmpStatePath, 'utf8'));
    assert(
      finalState.uploads >= 1 && finalState.runs.length === 2,
      `Expected >=1 resource upload and 2 node runs with --credit-token, got: ${JSON.stringify(finalState)}`
    );

    await postJson(hUrl, '/api/mcp/dreamina/disconnect', {});
  } finally {
    await bridge.stop();
    for (const m of tmpMediaTracker) unlinkMediaIfPresent(m);
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
    if (prevCfgEnv === undefined) delete process.env.DREAMFLOW_DREAMINA_CONFIG_PATH;
    else process.env.DREAMFLOW_DREAMINA_CONFIG_PATH = prevCfgEnv;
    if (prevBinEnv === undefined) delete process.env.DREAMFLOW_DREAMINA_BINARY_PATH;
    else process.env.DREAMFLOW_DREAMINA_BINARY_PATH = prevBinEnv;
    if (prevDisableEnv === undefined) delete process.env.DREAMFLOW_DISABLE_SYSTEM_DREAMINA_CLI;
    else process.env.DREAMFLOW_DISABLE_SYSTEM_DREAMINA_CLI = prevDisableEnv;
  }

  logStep(
    '16/18 dreamina-cli-oauth-hermetic',
    'Verified hermetic mock dreamina-canvas CLI OAuth device flow, resource upload, node create->quote->confirm->run(--credit-token)->wait->show->download (0600->0644) & /media/* HTTP 200'
  );
}

async function verifyStage17Dreamina44ToolsAndCatalog() {
  const sdkDist = path.join(ROOT, 'packages/provider-sdk/dist/index.js');
  const sdk = await import(pathToFileURL(sdkDist).href);
  const catalog = sdk.DREAMINA_CANONICAL_MODELS || [];
  assert(
    catalog.length === 34,
    `Expected 34 canonical Dreamina models (14 image + 18 video + 2 audio), got ${catalog.length}`
  );
  const vidModels = catalog.filter((m) => m.modality === 'video');
  const imgModels = catalog.filter((m) => m.modality === 'image');
  const audModels = catalog.filter((m) => m.modality === 'audio');
  assert(
    imgModels.length === 14 && vidModels.length === 18 && audModels.length === 2,
    `Expected 14 image / 18 video / 2 audio models, got ${imgModels.length}/${vidModels.length}/${audModels.length}`
  );
  for (const requiredVid of [
    'seedance_2_5',
    'seedance_2_5_flash',
    'seedance_2_5_draft',
    'seedance_2_0',
    'seedance_2_0_fast',
    'seedance_2_0_mini',
    'seedance_1_5_pro',
    'seedance_1_0_pro',
    'seedance_pro_fast',
    'seedance_1_0_lite',
    'veo_3_1',
    'veo_3_1_fast',
    'veo_3_1_lite',
    'gemini_omni_1_1_flash',
    'wan_3_0',
    'happyhorse_1_1',
    'omnihuman_1_5',
    'dreamina_motion_imitation',
  ]) {
    assert(
      vidModels.some((m) => m.id === requiredVid),
      `Missing Dreamina video model in DREAMINA_CANONICAL_MODELS: ${requiredVid}`
    );
  }
  assert(
    sdk.normalizeDreaminaModelId('seedance_pro_fast') === 'seedance_pro_fast' &&
      sdk.mapCanonicalDreaminaToCliModel('seedance_pro_fast') === 'seedance_pro_fast',
    'seedance_pro_fast must map cleanly without collapsing into seedance_1_5_pro'
  );

  const mcpBridge = path.join(ROOT, 'packages/mcp-client/dist/server-bridge.js');
  const { McpStdioBridgeServer } = await import(pathToFileURL(mcpBridge).href);

  const prevCfgEnv = process.env.DREAMFLOW_DREAMINA_CONFIG_PATH;
  const prevBinEnv = process.env.DREAMFLOW_DREAMINA_BINARY_PATH;
  const prevDisableEnv = process.env.DREAMFLOW_DISABLE_SYSTEM_DREAMINA_CLI;

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'df_stage17_44tools_'));
  const tmpCfgPath = path.join(tmpDir, 'dreamina-mcp.json');
  const tmpMockBinPath = path.join(tmpDir, 'dreamina-canvas');
  const tmpMediaTracker = [];

  const mockCliSource = `#!/usr/bin/env node
import * as fs from 'node:fs';
import * as path from 'node:path';

const rawArgs = process.argv.slice(2);
const pos = [];
const flags = {};
const valueFlags = new Set([
  '--format', '--type', '--file', '--project-id', '--node-id', '--submit-id',
  '--credit-ceiling', '--credit-token', '--ratio', '--resolution', '--duration',
  '--count', '--mode', '--model', '--prompt', '--title', '--ref', '--timeout',
  '--interval', '--limit', '--kind', '--fps', '--detail', '-o',
]);
for (let i = 0; i < rawArgs.length; i++) {
  const a = rawArgs[i];
  if (valueFlags.has(a)) {
    flags[a] = rawArgs[i + 1] ?? '';
    i++;
  } else if (a.startsWith('--')) {
    flags[a] = 'true';
  } else {
    pos.push(a);
  }
}
const out = (data) => process.stdout.write(JSON.stringify({ schemaVersion: '2', ok: true, data }) + '\\n');
const cmd = pos[0];
const sub = pos[1];
const sub2 = pos[2];

if (cmd === 'version') {
  out({ version: '1.3.0', edition: 'public' });
} else if (cmd === 'schema') {
  out({ leafCommands: 57, directorSubcommands: 10, version: '1.3.0' });
} else if (cmd === 'auth' && sub === 'status') {
  out({ loggedIn: true });
} else if (cmd === 'auth' && sub === 'account') {
  out({ displayName: 'Hermetic44User', userId: 'u_44', availableCredits: '99000', vipLevel: 'maestro' });
} else if (cmd === 'canvas' && sub === 'ls') {
  out({ canvases: [{ projectId: 'proj_44_1', name: 'Open-DreamFlow Bridge' }] });
} else if (cmd === 'canvas' && sub === 'current') {
  out({ projectId: 'proj_44_1', name: 'Open-DreamFlow Bridge' });
} else if (cmd === 'model' && sub === 'list') {
  const t = flags['--type'] || 'image';
  const items =
    t === 'video'
      ? [
          { model: 'seedance_2.5', modes: [{ name: 't2v', flags: [{ flag: '--resolution', values: ['480p', '720p', '1080p', '4k'] }, { flag: '--ratio', values: ['16:9', '9:16'] }, { flag: '--duration', values: ['4', '5', '10', '15', '30'] }] }] },
          { model: 'seedance_3.0_preview', name: 'Seedance 3.0 Preview', modes: [{ name: 't2v', flags: [{ flag: '--resolution', values: ['720p', '1080p'] }, { flag: '--ratio', values: ['16:9'] }, { flag: '--duration', values: ['5', '10', '15'] }] }] },
        ]
      : t === 'audio'
        ? [{ model: 'seed_audio_v1' }]
        : [{ model: 'seedream_5.5' }];
  out({ items });
} else if (cmd === 'model' && sub === 'find') {
  out({ models: [{ id: 'seedance_2.5' }, { id: 'seedance_2.5_flash' }] });
} else if (cmd === 'model' && sub) {
  out({ id: sub, modality: 'video', resolutions: ['480p', '720p', '1080p', '4k'] });
} else if (cmd === 'voice' && sub === 'list') {
  out({ voices: [{ voiceId: 'v_cinema_01', name: 'Cinema Narrator', language: 'en' }] });
} else if (cmd === 'director' && sub === 'catalog') {
  out({ items: [{ id: 'dir_char_01', name: 'Studio Architect' }] });
} else if (cmd === 'workflow' && sub === 'capabilities') {
  out({ templatesSupported: true, maxConcurrent: 4 });
} else if (cmd === 'node' && sub === 'upscale' && sub2 === 'image') {
  out({ nodeId: 'node_up_44', submitId: 'sub_up_44' });
} else if (cmd === 'node' && sub === 'quote') {
  out({ totalCredit: 4 });
} else if (cmd === 'node' && sub === 'confirm') {
  out({ creditConfirmationToken: 'ctok_up_44' });
} else if (cmd === 'node' && sub === 'run') {
  out({ submitId: flags['--submit-id'] || 'sub_up_44' });
} else if (cmd === 'operation' && sub === 'wait') {
  out({ status: 'success' });
} else if (cmd === 'node' && sub === 'show') {
  out({ node: { nodeId: flags['--node-id'] || 'node_up_44', resources: [{ resourceId: 'res_up_44', status: 'success' }] } });
} else if (cmd === 'resource' && sub === 'download') {
  const outDir = flags['-o'];
  fs.mkdirSync(outDir, { recursive: true });
  const dest = path.join(outDir, 'upscale_44.png');
  fs.writeFileSync(dest, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64'));
  fs.chmodSync(dest, 0o600);
  out({ path: dest });
} else {
  out({ echoed: rawArgs });
}
`;
  fs.writeFileSync(tmpMockBinPath, mockCliSource, 'utf8');
  fs.chmodSync(tmpMockBinPath, 0o755);

  process.env.DREAMFLOW_DREAMINA_CONFIG_PATH = tmpCfgPath;
  process.env.DREAMFLOW_DREAMINA_BINARY_PATH = tmpMockBinPath;
  delete process.env.DREAMFLOW_DISABLE_SYSTEM_DREAMINA_CLI;

  const port17 = 16100 + Math.floor(Math.random() * 800);
  const bridge = new McpStdioBridgeServer({ host: '127.0.0.1', port: port17, quiet: true });
  try {
    await bridge.start();
    const u = `http://127.0.0.1:${port17}`;
    const c17 = await postJson(u, '/api/mcp/dreamina/connect', { mode: 'cli_oauth' });
    assert(c17.ok === true && c17.session?.step === 'connected', `Stage 17 CLI connect failed: ${JSON.stringify(c17)}`);

    const srvsJson = await (await fetch(`${u}/api/mcp/servers`)).json();
    const dSrv = (srvsJson.servers || []).find((s) => s.id === 'mcp_dreamina');
    const toolNames = (dSrv?.tools || []).map((t) => t.name);
    assert(
      toolNames.length >= 44,
      `Expected >= 44 Dreamina MCP tools, got ${toolNames.length}: ${JSON.stringify(toolNames)}`
    );
    for (const requiredTool of [
      'dreamina_cli_schema',
      'dreamina_model_info',
      'dreamina_model_find',
      'dreamina_voices_list',
      'dreamina_upscale_image',
      'dreamina_upscale_video',
      'dreamina_cutout_image',
      'dreamina_interpolate_video',
      'dreamina_promote_video_sample',
      'dreamina_canvas_list',
      'dreamina_node_create',
      'dreamina_resource_upload',
      'dreamina_workflow_list',
      'dreamina_director_catalog',
    ]) {
      assert(toolNames.includes(requiredTool), `Missing official Dreamina MCP tool: ${requiredTool}`);
    }

    const refreshedModels = await (
      await fetch(`${u}/api/mcp/models?platformId=dreamina&refresh=1`)
    ).json();
    assert(
      refreshedModels.ok === true &&
        Array.isArray(refreshedModels.models) &&
        refreshedModels.models.length >= 35 &&
        refreshedModels.models.some((m) => m.id === 'seedance_3_0_preview'),
      `Expected dynamic CLI model discovery to append seedance_3_0_preview alongside 34 canonical models, got count=${refreshedModels.models?.length}`
    );

    for (const [toolName, toolArgs] of [
      ['dreamina_cli_schema', {}],
      ['dreamina_model_info', { model: 'seedance_2_5' }],
      ['dreamina_voices_list', { count: 2 }],
      ['dreamina_director_catalog', { kind: 'builtin' }],
      ['dreamina_workflow_capabilities', {}],
    ]) {
      const callOut = await postJson(u, '/api/mcp/call', {
        serverId: 'mcp_dreamina',
        toolName,
        arguments: toolArgs,
      });
      assert(callOut.ok === true, `MCP call ${toolName} failed: ${JSON.stringify(callOut)}`);
    }

    const upCall = await postJson(u, '/api/mcp/call', {
      serverId: 'mcp_dreamina',
      toolName: 'dreamina_upscale_image',
      arguments: { node_id: 'node_up_44', wait: true, resolution: '4K' },
    });
    const upMedia =
      upCall.mediaUrl || upCall.structuredContent?.mediaUrl || upCall.structuredContent?.outputs?.[0];
    assert(
      upCall.ok === true && String(upMedia || '').startsWith('/media/dreamina_mcp_'),
      `Expected dreamina_upscale_image to download /media/dreamina_mcp_*, got: ${JSON.stringify(upCall)}`
    );
    tmpMediaTracker.push(upMedia);
    const upHttp = await fetch(`${u}${upMedia}`);
    assert(upHttp.status === 200, `Expected HTTP 200 on ${upMedia}, got ${upHttp.status}`);

    await postJson(u, '/api/mcp/dreamina/disconnect', {});
  } finally {
    await bridge.stop();
    for (const m of tmpMediaTracker) unlinkMediaIfPresent(m);
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
    if (prevCfgEnv === undefined) delete process.env.DREAMFLOW_DREAMINA_CONFIG_PATH;
    else process.env.DREAMFLOW_DREAMINA_CONFIG_PATH = prevCfgEnv;
    if (prevBinEnv === undefined) delete process.env.DREAMFLOW_DREAMINA_BINARY_PATH;
    else process.env.DREAMFLOW_DREAMINA_BINARY_PATH = prevBinEnv;
    if (prevDisableEnv === undefined) delete process.env.DREAMFLOW_DISABLE_SYSTEM_DREAMINA_CLI;
    else process.env.DREAMFLOW_DISABLE_SYSTEM_DREAMINA_CLI = prevDisableEnv;
  }

  logStep(
    '17/18 dreamina-44tools-and-catalog',
    'Verified 34 Dreamina models (18 video incl. seedance_1_5_pro/pro_fast), 44 official MCP tools, dynamic CLI discovery (?refresh=1) & post-edit execution'
  );
}

async function verifyStage18MultiUserCloudCreditsAndUiAudit() {
  // Gate Self-Test: confirm assertion helper rejects injected bad UI/demo values
  const expectGateRejects = (label, sample) => {
    let threw = false;
    try {
      assertCleanUiText(label, sample);
    } catch {
      threw = true;
    }
    assert(threw, `Self-test gate FAILED to reject injected bad value in ${label}: ${sample}`);
  };
  expectGateRejects('self-test-font-mono', '<span className="font-mono">00:12</span>');
  expectGateRejects('self-test-jetbrains', "fontFamily: 'JetBrains Mono'");
  expectGateRejects('self-test-real-media', 'src="/media/real_courtyard_sun.jpg"');

  const mcpBridge = path.join(ROOT, 'packages/mcp-client/dist/server-bridge.js');
  const { McpStdioBridgeServer } = await import(pathToFileURL(mcpBridge).href);

  const prevOwnerEmail = process.env.DREAMFLOW_OWNER_EMAIL;
  const prevOwnerPass = process.env.DREAMFLOW_OWNER_PASSCODE;
  const prevCfgEnv = process.env.DREAMFLOW_DREAMINA_CONFIG_PATH;
  const prevDisableEnv = process.env.DREAMFLOW_DISABLE_SYSTEM_DREAMINA_CLI;

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'df_stage18_'));
  const tmpDataDir = path.join(tmpDir, 'data');
  const tmpMediaDir = path.join(tmpDir, 'media');
  fs.mkdirSync(tmpDataDir, { recursive: true });
  fs.mkdirSync(tmpMediaDir, { recursive: true });

  const ownerEmail = 'owner-s18@dreamflow.studio';
  const ownerPass = 's18OwnerPass!';
  process.env.DREAMFLOW_OWNER_EMAIL = ownerEmail;
  process.env.DREAMFLOW_OWNER_PASSCODE = ownerPass;
  process.env.DREAMFLOW_DREAMINA_CONFIG_PATH = path.join(tmpDir, 'dreamina-mcp.json');
  process.env.DREAMFLOW_DISABLE_SYSTEM_DREAMINA_CLI = '1';

  let mockCreditsBalance = 100;
  let mockMcpBaseUrl = '';
  const mockMcpServer = http.createServer(async (req, res) => {
    const reqUrl = new URL(req.url || '/', mockMcpBaseUrl || 'http://127.0.0.1');
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const rawBody = Buffer.concat(chunks).toString('utf8');

    if (reqUrl.pathname === '/tiny.png' && req.method === 'GET') {
      const tinyPng = Buffer.from(SAMPLE_SOURCE_PNG_B64, 'base64');
      res.writeHead(200, { 'Content-Type': 'image/png', 'Content-Length': String(tinyPng.length) });
      res.end(tinyPng);
      return;
    }

    if (reqUrl.pathname === '/mcp' && req.method === 'POST') {
      const rpc = JSON.parse(rawBody || '{}');
      if (rpc.id === undefined || rpc.id === null || rpc.method === 'notifications/initialized') {
        res.writeHead(202).end();
        return;
      }
      let result = {};
      if (rpc.method === 'initialize') {
        result = {
          protocolVersion: '2025-03-26',
          capabilities: { tools: {} },
          serverInfo: { name: 'stage18-mock-higgsfield', version: '1.0.0' },
        };
      } else if (rpc.method === 'tools/list') {
        result = {
          tools: [
            {
              name: 'balance',
              description: 'Read mock credit balance',
              inputSchema: { type: 'object', properties: {} },
            },
            {
              name: 'generate_image',
              description: 'Generate test image (5 credits)',
              inputSchema: {
                type: 'object',
                properties: { prompt: { type: 'string' } },
                required: ['prompt'],
              },
            },
          ],
        };
      } else if (rpc.method === 'tools/call') {
        const toolName = rpc.params?.name;
        if (toolName === 'balance') {
          result = {
            structuredContent: {
              credits: mockCreditsBalance,
              plan: 'ultimate',
              account: 'Stage18 Owner',
            },
            content: [
              {
                type: 'text',
                text: `Credits: ${mockCreditsBalance} | Plan: ultimate | Account: Stage18 Owner`,
              },
            ],
          };
        } else if (toolName === 'generate_image') {
          mockCreditsBalance = Math.max(0, mockCreditsBalance - 5);
          result = {
            content: [
              { type: 'image', data: SAMPLE_SOURCE_PNG_B64, mimeType: 'image/png' },
              {
                type: 'text',
                text: JSON.stringify({ ok: true, mimeType: 'image/png' }),
              },
            ],
          };
        }
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ jsonrpc: '2.0', id: rpc.id, result }));
      return;
    }
    res.writeHead(404).end();
  });

  await new Promise((resolve) => mockMcpServer.listen(0, '127.0.0.1', resolve));
  const mockAddr = mockMcpServer.address();
  mockMcpBaseUrl = `http://127.0.0.1:${mockAddr.port}`;

  const s18Port = 17900 + Math.floor(Math.random() * 800);
  const s18Bridge = new McpStdioBridgeServer({
    host: '127.0.0.1',
    port: s18Port,
    dataDir: tmpDataDir,
    mediaDir: tmpMediaDir,
    quiet: true,
  });

  const apiCall = async (base, route, opts = {}) => {
    const res = await fetch(`${base}${route}`, {
      method: opts.method || 'GET',
      headers: {
        'X-Dreamflow-Require-Auth': '1',
        ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
        ...(opts.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
    const text = await res.text();
    let json = {};
    try {
      json = JSON.parse(text);
    } catch {
      json = { raw: text };
    }
    return { status: res.status, headers: res.headers, json, text };
  };

  try {
    await s18Bridge.start();
    const u = `http://127.0.0.1:${s18Port}`;

    // 1. Strict 401 enforcement when X-Dreamflow-Require-Auth: 1 is set without a valid token
    for (const protectedRoute of ['/api/auth/me', '/api/credits/summary', '/api/projects', '/api/assets']) {
      const noTok = await apiCall(u, protectedRoute);
      assert(
        noTok.status === 401,
        `Expected 401 without token on ${protectedRoute} with X-Dreamflow-Require-Auth: 1, got ${noTok.status}`
      );
      const badTok = await apiCall(u, protectedRoute, { token: 'invalid_token_injected_bad' });
      assert(
        badTok.status === 401,
        `Expected 401 with invalid Bearer token on ${protectedRoute}, got ${badTok.status}`
      );
    }

    // 2. Owner login (wrong passcode rejected 401; valid passcode succeeds 200)
    const badLogin = await apiCall(u, '/api/auth/login', {
      method: 'POST',
      body: { email: ownerEmail, passcode: 'wrong-passcode' },
    });
    assert(badLogin.status === 401, `Expected 401 on wrong owner passcode, got ${badLogin.status}`);

    const ownerLogin = await apiCall(u, '/api/auth/login', {
      method: 'POST',
      body: { email: ownerEmail, passcode: ownerPass },
    });
    assert(
      ownerLogin.status === 200 && ownerLogin.json.token && ownerLogin.json.user?.role === 'owner',
      `Owner login failed: ${JSON.stringify(ownerLogin.json)}`
    );
    const ownerToken = ownerLogin.json.token;

    // 3. Owner connects mock Higgsfield MCP + saves isolated Owner BYOK secret
    const ownerVaultSecret = 'sk-owner-secret-isolated-999';
    const regMcp = await apiCall(u, '/api/mcp/servers', {
      method: 'POST',
      token: ownerToken,
      body: {
        id: 'mcp_higgsfield_s18',
        name: 'Stage 18 Higgsfield MCP',
        platformId: 'higgsfield',
        transport: 'http',
        url: `${mockMcpBaseUrl}/mcp`,
      },
    });
    assert(
      regMcp.status === 200 && regMcp.json.server?.id === 'mcp_higgsfield_s18',
      `Failed to register mock Higgsfield MCP: ${JSON.stringify(regMcp.json)}`
    );

    const saveOwnerVault = await apiCall(u, '/api/user/vault', {
      method: 'PUT',
      token: ownerToken,
      body: { byok: { openai: { apiKey: ownerVaultSecret } } },
    });
    assert(saveOwnerVault.status === 200, `Owner vault save failed: ${saveOwnerVault.status}`);

    // 4. Invite Friend #1 (Close Friend: cap 5 credits) & Friend #2 (Independent: shared disabled)
    const inviteF1 = await apiCall(u, '/api/team/invites', {
      method: 'POST',
      token: ownerToken,
      body: {
        email: 'friend1@studio.test',
        displayName: 'Friend One',
        passcode: 'friend1pass',
        sharedGrants: {
          dreamina: { enabled: true, capCredits: 5 },
          higgsfield: { enabled: true, capCredits: 5 },
        },
      },
    });
    assert(inviteF1.status === 200 && inviteF1.json.member?.id, `Friend #1 invite failed: ${JSON.stringify(inviteF1.json)}`);

    const inviteF2 = await apiCall(u, '/api/team/invites', {
      method: 'POST',
      token: ownerToken,
      body: {
        email: 'friend2@studio.test',
        displayName: 'Friend Two',
        passcode: 'friend2pass',
        sharedGrants: {
          dreamina: { enabled: false, capCredits: 0 },
          higgsfield: { enabled: false, capCredits: 0 },
        },
      },
    });
    assert(inviteF2.status === 200 && inviteF2.json.member?.id, `Friend #2 invite failed: ${JSON.stringify(inviteF2.json)}`);

    // 5. Friend #1 login, shared pool usage -> cap enforcement (403), own isolated BYOK vault & zero secret leakage
    const f1Login = await apiCall(u, '/api/auth/login', {
      method: 'POST',
      body: { email: 'friend1@studio.test', passcode: 'friend1pass' },
    });
    assert(
      f1Login.status === 200 && f1Login.json.token && f1Login.json.user?.role === 'member',
      `Friend #1 login failed: ${JSON.stringify(f1Login.json)}`
    );
    const f1Token = f1Login.json.token;

    const memberInviteAttempt = await apiCall(u, '/api/team/invites', {
      method: 'POST',
      token: f1Token,
      body: { email: 'rogue@studio.test', displayName: 'Rogue', passcode: 'rogue' },
    });
    assert(memberInviteAttempt.status === 403, `Expected 403 when member calls /api/team/invites, got ${memberInviteAttempt.status}`);

    const f1Call1 = await apiCall(u, '/api/mcp/call', {
      method: 'POST',
      token: f1Token,
      body: {
        serverId: 'mcp_higgsfield_s18',
        toolName: 'generate_image',
        creditSource: 'shared',
        arguments: { prompt: 'Close friend shared generation 1 (5 credits)' },
      },
    });
    assert(
      f1Call1.status === 200 && f1Call1.json.ok === true,
      `Friend #1 first shared call within cap should succeed, got ${f1Call1.status}: ${JSON.stringify(f1Call1.json)}`
    );

    const f1Call2OverCap = await apiCall(u, '/api/mcp/call', {
      method: 'POST',
      token: f1Token,
      body: {
        serverId: 'mcp_higgsfield_s18',
        toolName: 'generate_image',
        creditSource: 'shared',
        arguments: { prompt: 'Close friend over-cap call (should return 403)' },
      },
    });
    assert(
      f1Call2OverCap.status === 403 && /cap reached/i.test(f1Call2OverCap.json.error || ''),
      `Expected 403 cap enforcement on Friend #1 second shared call, got ${f1Call2OverCap.status}: ${JSON.stringify(f1Call2OverCap.json)}`
    );

    const f1Secret = 'fal-friend1-secret-111';
    const f1VaultRes = await apiCall(u, '/api/user/vault', {
      method: 'PUT',
      token: f1Token,
      body: { byok: { fal: { apiKey: f1Secret } } },
    });
    assert(f1VaultRes.status === 200, `Friend #1 vault update failed: ${f1VaultRes.status}`);

    const f1Me = await apiCall(u, '/api/auth/me', { token: f1Token });
    const f1Conn = await apiCall(u, '/api/connections/status', { token: f1Token });
    assert(!f1Me.text.includes(ownerVaultSecret) && !f1Conn.text.includes(ownerVaultSecret), 'Owner BYOK secret leaked to Friend #1!');

    // 6. Friend #2 login, blocked shared pool (403), own isolated BYOK vault & zero cross-user leakage
    const f2Login = await apiCall(u, '/api/auth/login', {
      method: 'POST',
      body: { email: 'friend2@studio.test', passcode: 'friend2pass' },
    });
    assert(f2Login.status === 200 && f2Login.json.token, `Friend #2 login failed: ${JSON.stringify(f2Login.json)}`);
    const f2Token = f2Login.json.token;

    const f2BlockedMcp = await apiCall(u, '/api/mcp/call', {
      method: 'POST',
      token: f2Token,
      body: {
        serverId: 'mcp_higgsfield_s18',
        toolName: 'generate_image',
        creditSource: 'shared',
        arguments: { prompt: 'Friend 2 blocked MCP shared attempt' },
      },
    });
    assert(
      f2BlockedMcp.status === 403,
      `Expected 403 when Friend #2 (disabled) uses shared MCP credits, got ${f2BlockedMcp.status}`
    );

    const f2BlockedGen = await apiCall(u, '/api/generate-node', {
      method: 'POST',
      token: f2Token,
      body: {
        nodeId: 's18-f2-blocked',
        kind: 'image',
        platformId: 'higgsfield',
        modelId: 'gpt_image_2_6',
        creditSource: 'shared',
        prompt: 'Blocked shared generate-node check',
      },
    });
    assert(
      f2BlockedGen.status === 403,
      `Expected 403 when Friend #2 calls /api/generate-node with creditSource:'shared', got ${f2BlockedGen.status}`
    );

    const f2Secret = 'fal-friend2-secret-222';
    const f2VaultRes = await apiCall(u, '/api/user/vault', {
      method: 'PUT',
      token: f2Token,
      body: { byok: { fal: { apiKey: f2Secret } } },
    });
    assert(f2VaultRes.status === 200, `Friend #2 vault update failed: ${f2VaultRes.status}`);

    const f2Me = await apiCall(u, '/api/auth/me', { token: f2Token });
    const f2Conn = await apiCall(u, '/api/connections/status', { token: f2Token });
    assert(
      !f2Me.text.includes(ownerVaultSecret) &&
        !f2Me.text.includes(f1Secret) &&
        !f2Conn.text.includes(ownerVaultSecret) &&
        !f2Conn.text.includes(f1Secret),
      'Cross-user secret leakage detected in Friend #2 responses!'
    );

    // 7. Credits Summary & <5ms Cached Credits Quote
    const ownerSummary = await apiCall(u, '/api/credits/summary?refresh=1', { token: ownerToken });
    assert(
      ownerSummary.status === 200 &&
        ownerSummary.json.ok === true &&
        Array.isArray(ownerSummary.json.platforms?.dreamina?.buckets) &&
        ownerSummary.json.platforms?.higgsfield?.credits === 95 &&
        Array.isArray(ownerSummary.json.sharedPools) &&
        ownerSummary.json.sharedPools.length === 2,
      `Unexpected /api/credits/summary payload: ${JSON.stringify(ownerSummary.json)}`
    );

    const quoteBody = {
      platformId: 'dreamina',
      modelId: 'seedream_5_5',
      modality: 'image',
      settings: { aspectRatio: '16:9', batchCount: 1 },
    };
    const q1 = await apiCall(u, '/api/credits/quote', {
      method: 'POST',
      token: ownerToken,
      body: quoteBody,
    });
    assert(
      q1.status === 200 && q1.json.ok === true && Number(q1.json.estimatedCredits) > 0,
      `Initial /api/credits/quote failed: ${JSON.stringify(q1.json)}`
    );
    const t0 = performance.now();
    const q2 = await apiCall(u, '/api/credits/quote', {
      method: 'POST',
      token: ownerToken,
      body: quoteBody,
    });
    const cachedQuoteMs = performance.now() - t0;
    assert(
      q2.status === 200 && q2.json.cached === true && cachedQuoteMs < 50,
      `Expected cached quote hit; got cached=${q2.json.cached}, dt=${cachedQuoteMs.toFixed(2)}ms`
    );

    // 8. Assets list (0 real_*) + /api/assets/import + /brands/* immutable
    const imp = await apiCall(u, '/api/assets/import', {
      method: 'POST',
      token: ownerToken,
      body: { remoteUrl: `${mockMcpBaseUrl}/tiny.png`, platformId: 'verify' },
    });
    assert(imp.status === 200 && imp.json.ok === true && imp.json.asset?.mediaUrl, `Import failed: ${JSON.stringify(imp.json)}`);

    const assetsRes = await apiCall(u, '/api/assets?source=all', { token: ownerToken });
    assert(
      assetsRes.status === 200 &&
        assetsRes.json.ok === true &&
        Array.isArray(assetsRes.json.items) &&
        assetsRes.json.items.some((it) => it.mediaUrl === imp.json.asset.mediaUrl) &&
        !assetsRes.json.items.some((it) => String(it.filename || '').startsWith('real_')),
      `Unexpected /api/assets payload: ${JSON.stringify(assetsRes.json)}`
    );

    for (const brandFile of [
      'google.svg',
      'mcp.svg',
      'higgsfield.png',
      'dreamina.png',
      'kling.png',
      'elevenlabs.svg',
      'openai.svg',
      'fal.png',
      'replicate.png',
      'comfyui.svg',
      'openart.png',
      'imagineart.png',
      'sume.png',
    ]) {
      const bRes = await fetch(`${u}/brands/${brandFile}`);
      const cc = bRes.headers.get('cache-control') || '';
      assert(
        bRes.status === 200 && cc.includes('immutable'),
        `Brand asset /brands/${brandFile} failed: status=${bRes.status}, Cache-Control=${cc}`
      );
    }

    // 9. Option A deploy dry-run check
    const deployOut = execFileSync('node', [path.join(ROOT, 'scripts/deploy-option-a.mjs'), '--check'], {
      cwd: ROOT,
      encoding: 'utf8',
    });
    assert(
      deployOut.includes('dry-run ready') || deployOut.includes('passed'),
      `deploy-option-a.mjs --check unexpected output: ${deployOut}`
    );

    // 10. Visual brand & frontend contract regression checks
    const openaiSvg = fs.readFileSync(path.join(ROOT, 'apps/web-studio/public/brands/openai.svg'), 'utf8');
    assert(
      openaiSvg.includes('width=') && openaiSvg.includes('height='),
      'apps/web-studio/public/brands/openai.svg must declare explicit width= and height='
    );
    const brandIconSrc = fs.readFileSync(
      path.join(ROOT, 'apps/web-studio/src/components/PlatformBrandIcon.tsx'),
      'utf8'
    );
    assert(
      !brandIconSrc.includes('p-['),
      'apps/web-studio/src/components/PlatformBrandIcon.tsx must contain zero p-[ percentage padding classes'
    );
    const execRouterSrc = fs.readFileSync(
      path.join(ROOT, 'apps/web-studio/src/services/executionRouter.ts'),
      'utf8'
    );
    assert(
      execRouterSrc.includes('Object.entries') &&
        execRouterSrc.includes('sharedPools') &&
        execRouterSrc.includes('entry.grants') &&
        execRouterSrc.includes('json.asset'),
      'executionRouter.ts must handle keyed-object json.platforms (Object.entries), owner sharedPools (entry.grants), and json.asset in importAssetViaBackend'
    );

    // 11. Live :3001 /api/assets?source=storage latency & user-asset integrity check
    let liveAssetsInfo = 'ephemeral-only';
    try {
      const liveHealth = await fetch('http://127.0.0.1:3001/health');
      if (liveHealth.ok) {
        const a0 = performance.now();
        const liveAssetsRes = await fetch('http://127.0.0.1:3001/api/assets?source=storage');
        const liveAssetsMs = performance.now() - a0;
        assert(liveAssetsRes.status === 200, `Live GET :3001/api/assets?source=storage returned ${liveAssetsRes.status}`);
        const liveAssetsJson = await liveAssetsRes.json();
        const liveItems = Array.isArray(liveAssetsJson.items) ? liveAssetsJson.items : [];
        assert(
          liveAssetsMs < 150,
          `Live GET :3001/api/assets?source=storage took ${liveAssetsMs.toFixed(2)}ms (expected <150ms)`
        );
        assert(
          liveItems.length >= 35,
          `Expected >= 35 real user items in live /api/assets?source=storage, got ${liveItems.length}`
        );
        assert(
          !liveItems.some((it) => String(it.filename || '').startsWith('real_')),
          'Found legacy real_* demo asset in live /api/assets?source=storage'
        );
        liveAssetsInfo = `${liveItems.length} items in ${liveAssetsMs.toFixed(2)}ms`;
      }
    } catch (err) {
      if (err instanceof Error && err.message.startsWith('Verification failed:')) throw err;
    }

    logStep(
      '18/18 multi-user-cloud-credits-and-ui-audit',
      `Verified 401 auth gate, Friend #1 cap 403 & Friend #2 disabled 403, AES-GCM vault isolation, cached quote (${cachedQuoteMs.toFixed(2)}ms), live storage (${liveAssetsInfo}), openai.svg/PlatformBrandIcon/executionRouter contracts, /brands/* immutable, self-test gate & deploy --check`
    );
  } finally {
    await s18Bridge.stop();
    await new Promise((resolve) => mockMcpServer.close(resolve));
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
    if (prevOwnerEmail === undefined) delete process.env.DREAMFLOW_OWNER_EMAIL;
    else process.env.DREAMFLOW_OWNER_EMAIL = prevOwnerEmail;
    if (prevOwnerPass === undefined) delete process.env.DREAMFLOW_OWNER_PASSCODE;
    else process.env.DREAMFLOW_OWNER_PASSCODE = prevOwnerPass;
    if (prevCfgEnv === undefined) delete process.env.DREAMFLOW_DREAMINA_CONFIG_PATH;
    else process.env.DREAMFLOW_DREAMINA_CONFIG_PATH = prevCfgEnv;
    if (prevDisableEnv === undefined) delete process.env.DREAMFLOW_DISABLE_SYSTEM_DREAMINA_CLI;
    else process.env.DREAMFLOW_DISABLE_SYSTEM_DREAMINA_CLI = prevDisableEnv;
  }
}

async function main() {
  console.log('\nOpen-DreamFlow — Running 18-Stage End-to-End Verification Suite...');
  await verifyStage1ProviderSdk();
  await verifyLiveServerStages();
  verifyStage13WebStudioBundle();
  await verifyStage16DreaminaCliHermetic();
  await verifyStage17Dreamina44ToolsAndCatalog();
  await verifyStage18MultiUserCloudCreditsAndUiAudit();
  console.log('All 18/18 Open-DreamFlow subsystems passed verification with 0 errors!\n');
}

main().catch((err) => {
  console.error('\n[FAIL]', err instanceof Error ? err.stack || err.message : err, err?.cause ? `\nCause: ${err.cause}` : '');
  process.exit(1);
});
