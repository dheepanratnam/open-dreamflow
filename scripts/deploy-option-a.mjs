#!/usr/bin/env node
/**
 * Open-DreamFlow Option A Production Deployment Automation
 * (Cloudflare Pages Edge SPA + Cloudflare R2 Zero-Egress + Railway Docker Engine)
 *
 * Usage:
 *   node scripts/deploy-option-a.mjs --check
 *   node scripts/deploy-option-a.mjs --deploy [--api-url https://your-api.up.railway.app] [--pages-project open-dreamflow]
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');

function printHelp() {
  console.log(`
Open-DreamFlow Option A Deploy (Cloudflare Pages + R2 + Railway)

Usage:
  node scripts/deploy-option-a.mjs --check          Verify Option A artifacts, CLI tools, and env readiness (dry-run)
  node scripts/deploy-option-a.mjs --deploy         Provision R2 bucket, deploy Railway Docker backend, and deploy CF Pages
  node scripts/deploy-option-a.mjs --help           Show this help message

Options:
  --api-url <url>          Backend HTTPS URL for Vite VITE_API_BASE_URL (e.g. https://dreamflow-api.up.railway.app)
  --pages-project <name>   Cloudflare Pages project name (default: open-dreamflow)
  --r2-bucket <name>       Cloudflare R2 bucket name (default: $R2_BUCKET_NAME or open-dreamflow-media)
  --skip-railway           Skip Railway backend deploy during --deploy
  --skip-r2                Skip Cloudflare R2 bucket check/create during --deploy
  --skip-pages             Skip Cloudflare Pages build/deploy during --deploy
`);
}

function loadEnvPreview() {
  const merged = { ...process.env };
  for (const envName of ['.env', '.env.local']) {
    const full = path.join(REPO_ROOT, envName);
    if (!fs.existsSync(full)) continue;
    const lines = fs.readFileSync(full, 'utf8').split(/\r?\n/);
    for (const raw of lines) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const eq = line.indexOf('=');
      if (eq <= 0) continue;
      const key = line.slice(0, eq).trim();
      let val = line.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (!merged[key]) merged[key] = val;
    }
  }
  return merged;
}

function probeCommand(cmd, args = ['--version']) {
  const res = spawnSync(cmd, args, { stdio: 'pipe', encoding: 'utf8' });
  return {
    available: res.status === 0,
    output: (res.stdout || res.stderr || '').trim().split(/\r?\n/)[0] || '',
  };
}

function runStep(cmd, args, extraEnv = {}) {
  console.log(`\n$ ${cmd} ${args.join(' ')}`);
  const res = spawnSync(cmd, args, {
    cwd: REPO_ROOT,
    stdio: 'inherit',
    env: { ...process.env, ...extraEnv },
  });
  if (res.status !== 0) {
    throw new Error(`Command failed (${res.status}): ${cmd} ${args.join(' ')}`);
  }
}

function parseArgs(argv) {
  const opts = {
    mode: 'check',
    apiUrl: '',
    pagesProject: 'open-dreamflow',
    r2Bucket: '',
    skipRailway: false,
    skipR2: false,
    skipPages: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') opts.mode = 'help';
    else if (arg === '--check' || arg === '--dry-run') opts.mode = 'check';
    else if (arg === '--deploy' || arg === '--apply') opts.mode = 'deploy';
    else if (arg === '--api-url' && argv[i + 1]) opts.apiUrl = argv[++i];
    else if (arg === '--pages-project' && argv[i + 1]) opts.pagesProject = argv[++i];
    else if (arg === '--r2-bucket' && argv[i + 1]) opts.r2Bucket = argv[++i];
    else if (arg === '--skip-railway') opts.skipRailway = true;
    else if (arg === '--skip-r2') opts.skipR2 = true;
    else if (arg === '--skip-pages') opts.skipPages = true;
  }
  return opts;
}

function runCheck(envMap, opts) {
  const requiredFiles = [
    'Dockerfile',
    'railway.json',
    'wrangler.toml',
    '.env.example',
    'packages/mcp-client/src/cloud-r2.ts',
    'apps/web-studio/public/_headers',
    'apps/web-studio/public/_redirects',
    'apps/web-studio/public/brands/higgsfield.png',
    'apps/web-studio/public/brands/dreamina.png',
    'apps/web-studio/public/brands/google.svg',
    'apps/web-studio/public/brands/mcp.svg',
  ];

  console.log('Open-DreamFlow Option A Deployment Check (Cloudflare Pages + R2 + Railway)');
  console.log('─────────────────────────────────────────────────────────────────────────');

  let missingRequiredFiles = 0;
  console.log('\n1. Required Deployment Artifacts:');
  for (const rel of requiredFiles) {
    const full = path.join(REPO_ROOT, rel);
    const exists = fs.existsSync(full) && fs.statSync(full).size > 0;
    if (!exists) missingRequiredFiles += 1;
    console.log(`  [${exists ? '✓' : '✗'}] ${rel}`);
  }

  console.log('\n2. CLI Toolchain Probes:');
  const nodeOk = Number(process.versions.node.split('.')[0] || 0) >= 18;
  const npmProbe = probeCommand('npm', ['--version']);
  const dockerProbe = probeCommand('docker', ['--version']);
  const railwayProbe = probeCommand('railway', ['--version']);
  const wranglerProbe = probeCommand('wrangler', ['--version']);

  console.log(`  [${nodeOk ? '✓' : '✗'}] node       v${process.versions.node}`);
  console.log(`  [${npmProbe.available ? '✓' : '✗'}] npm        ${npmProbe.output || 'missing'}`);
  console.log(`  [${dockerProbe.available ? '✓' : '!'}] docker     ${dockerProbe.output || 'optional locally (Railway builds remotely)'}`);
  console.log(`  [${railwayProbe.available ? '✓' : '!'}] railway    ${railwayProbe.output || 'install: npm i -g @railway/cli'}`);
  console.log(`  [${wranglerProbe.available ? '✓' : '!'}] wrangler   ${wranglerProbe.output || 'install: npm i -g wrangler (or npx wrangler)'}`);

  console.log('\n3. Cloud Environment Variables (.env / .env.local / process.env):');
  const envVars = [
    ['R2_ACCOUNT_ID', 'Cloudflare R2 Account ID'],
    ['R2_ACCESS_KEY_ID', 'Cloudflare R2 S3 Access Key ID'],
    ['R2_SECRET_ACCESS_KEY', 'Cloudflare R2 S3 Secret Key'],
    ['R2_BUCKET_NAME', `R2 Bucket (default: ${opts.r2Bucket || envMap.R2_BUCKET_NAME || 'open-dreamflow-media'})`],
    ['R2_PUBLIC_BASE_URL', 'Optional custom R2 CDN domain (else /media proxy)'],
    ['DREAMFLOW_VAULT_SECRET', 'AES-256-GCM master vault secret (32+ chars)'],
    ['DREAMFLOW_OWNER_EMAIL', 'Workspace owner sign-in email'],
    ['DREAMFLOW_OWNER_PASSCODE', 'Workspace owner passcode'],
    ['VITE_API_BASE_URL', 'Railway HTTPS backend URL for Cloudflare Pages'],
  ];

  for (const [key, desc] of envVars) {
    const present = Boolean(String(envMap[key] || '').trim());
    console.log(`  [${present ? '✓' : '!'}] ${key.padEnd(26)} ${present ? 'configured' : `unset (${desc})`}`);
  }

  console.log('\n4. Recommended Option A Rollout Sequence:');
  console.log('  Step A: railway login && railway init && railway volume add --mount-path /data');
  console.log('  Step B: Set Railway env vars (DREAMFLOW_REQUIRE_AUTH=true, DREAMFLOW_VAULT_SECRET, R2_*, DREAMFLOW_OWNER_*)');
  console.log('  Step C: railway up   # deploys Dockerfile + /health on :3001 + dreamina-canvas + ffmpeg');
  console.log('  Step D: npx wrangler r2 bucket create open-dreamflow-media');
  console.log('  Step E: VITE_API_BASE_URL=https://<railway-domain> npm run build && npx wrangler pages deploy apps/web-studio/dist');
  console.log('─────────────────────────────────────────────────────────────────────────');

  if (missingRequiredFiles > 0 || !nodeOk || !npmProbe.available) {
    console.error(`Check failed: ${missingRequiredFiles} missing artifact(s).`);
    process.exit(1);
  }
  console.log('Option A pre-flight artifact check passed (dry-run ready).');
}

function runDeploy(envMap, opts) {
  const bucket = opts.r2Bucket || envMap.R2_BUCKET_NAME || 'open-dreamflow-media';
  const apiUrl = (opts.apiUrl || envMap.VITE_API_BASE_URL || '').trim().replace(/\/+$/, '');

  if (!opts.skipPages && !apiUrl) {
    throw new Error(
      'VITE_API_BASE_URL (or --api-url https://your-api.up.railway.app) is required before building Cloudflare Pages.'
    );
  }

  if (!opts.skipR2) {
    const wranglerCmd = probeCommand('wrangler', ['--version']).available ? 'wrangler' : 'npx';
    const baseArgs = wranglerCmd === 'npx' ? ['wrangler'] : [];
    console.log(`[deploy-option-a] Ensuring R2 bucket "${bucket}" exists...`);
    const res = spawnSync(wranglerCmd, [...baseArgs, 'r2', 'bucket', 'create', bucket], {
      cwd: REPO_ROOT,
      stdio: 'pipe',
      encoding: 'utf8',
    });
    if (res.status === 0) {
      console.log(`[deploy-option-a] Created R2 bucket "${bucket}".`);
    } else {
      const combined = `${res.stdout || ''}\n${res.stderr || ''}`;
      if (/already exists/i.test(combined)) {
        console.log(`[deploy-option-a] R2 bucket "${bucket}" already exists.`);
      } else {
        throw new Error(`Failed creating R2 bucket "${bucket}": ${combined.trim()}`);
      }
    }
  }

  if (!opts.skipRailway) {
    if (!probeCommand('railway', ['--version']).available) {
      throw new Error('Railway CLI not installed. Run `npm i -g @railway/cli && railway login`.');
    }
    runStep('railway', ['up', '--detach']);
  }

  if (!opts.skipPages) {
    runStep('npm', ['run', 'build:sdk']);
    runStep('npm', ['run', 'build:mcp']);
    runStep('npm', ['run', 'build'], { VITE_API_BASE_URL: apiUrl });
    const wranglerCmd = probeCommand('wrangler', ['--version']).available ? 'wrangler' : 'npx';
    const baseArgs = wranglerCmd === 'npx' ? ['wrangler'] : [];
    runStep(wranglerCmd, [
      ...baseArgs,
      'pages',
      'deploy',
      'apps/web-studio/dist',
      '--project-name',
      opts.pagesProject,
    ]);
  }

  console.log('\n[deploy-option-a] Option A deployment completed successfully.');
}

const opts = parseArgs(process.argv.slice(2));
if (opts.mode === 'help') {
  printHelp();
  process.exit(0);
}

const envMap = loadEnvPreview();
if (opts.mode === 'check') {
  runCheck(envMap, opts);
} else {
  try {
    runDeploy(envMap, opts);
  } catch (err) {
    console.error('[deploy-option-a] Error:', err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}
