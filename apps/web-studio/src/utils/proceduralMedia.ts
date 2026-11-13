import type { AspectRatio, CanvasNode, StyleDNAPayload } from '../types/studio';

export function getDimensionsForAspect(
  aspect: AspectRatio,
  baseWidth = 360
): { width: number; height: number } {
  switch (aspect) {
    case '16:9':
      return { width: baseWidth, height: Math.round((baseWidth * 9) / 16) };
    case '9:16':
      return { width: 250, height: Math.round((250 * 16) / 9) };
    case '21:9':
      return { width: 420, height: Math.round((420 * 9) / 21) };
    case '1:1':
      return { width: 300, height: 300 };
  }
}

function seededRandom(seed: number): () => number {
  let s = Math.abs(Math.floor(seed)) % 2147483647 || 1337;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export function createDefaultWaveform(seed = 101, barCount = 64): number[] {
  const rand = seededRandom(seed);
  const out: number[] = [];
  for (let i = 0; i < barCount; i++) {
    const t = i / Math.max(1, barCount - 1);
    const envelope =
      0.38 +
      0.28 * Math.sin(t * Math.PI * 3.2 + seed * 0.1) +
      0.18 * Math.cos(t * Math.PI * 7.5);
    const jitter = (rand() - 0.5) * 0.26;
    const val = Math.max(0.1, Math.min(0.96, Number((envelope + jitter).toFixed(3))));
    out.push(val);
  }
  return out;
}

export interface ShotRenderOptions {
  prompt: string;
  seed: number;
  palette?: string[];
  cameraLabel?: string;
  theme?: CanvasNode['videoTheme'];
  isolatedSubjectOnly?: boolean;
  backgroundOnly?: boolean;
  hudBadge?: string;
}

export function drawCinemaShotFrame(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  timeSec: number,
  opts: ShotRenderOptions
): void {
  const rand = seededRandom(opts.seed);
  const pLower = opts.prompt.toLowerCase();
  const isCraft =
    opts.theme === 'craft-macro' ||
    opts.theme === 'product-ugc' ||
    pLower.includes('leica') ||
    pLower.includes('ceramic') ||
    pLower.includes('timber') ||
    pLower.includes('joinery');
  const isAlpine =
    opts.theme === 'alpine-aerial' ||
    pLower.includes('alpine') ||
    pLower.includes('mountain') ||
    pLower.includes('cliff');
  const isGolden =
    opts.theme === 'golden-hour' ||
    pLower.includes('sunset') ||
    pLower.includes('golden') ||
    pLower.includes('terracotta');

  const defaultPalette = isCraft
    ? ['#1A1714', '#2E261F', '#C49A6C', '#8C6D4F', '#EDE6DC']
    : isAlpine
      ? ['#161D22', '#26353F', '#6B8E9B', '#9DB4BD', '#EEF2F3']
      : isGolden
        ? ['#1F1915', '#3B2B20', '#D49B6A', '#9E6B49', '#F4ECE1']
        : ['#181B1E', '#2A333B', '#7A96A4', '#C8A987', '#F2EFE9'];

  const palette =
    opts.palette && opts.palette.length >= 4 ? opts.palette : defaultPalette;

  ctx.save();
  ctx.clearRect(0, 0, w, h);

  const camZoom = 1 + Math.sin(timeSec * 0.32) * 0.024;
  const camShiftX = Math.cos(timeSec * 0.4) * (w * 0.015);
  const camShiftY = Math.sin(timeSec * 0.28) * (h * 0.01);

  ctx.translate(w / 2 + camShiftX, h / 2 + camShiftY);
  ctx.scale(camZoom, camZoom);
  ctx.translate(-w / 2, -h / 2);

  if (!opts.isolatedSubjectOnly) {
    // Natural daylight sky / architectural plaster wash
    const skyGrad = ctx.createLinearGradient(0, 0, w * 0.25, h);
    skyGrad.addColorStop(0, palette[4] + '22');
    skyGrad.addColorStop(0.48, palette[1]);
    skyGrad.addColorStop(1, palette[0]);
    ctx.fillStyle = skyGrad;
    ctx.fillRect(-40, -40, w + 80, h + 80);

    // Warm window / coastal sun diffusion
    const sunGlow = ctx.createRadialGradient(
      w * (0.72 + Math.sin(timeSec * 0.35) * 0.03),
      h * 0.26,
      12,
      w * 0.72,
      h * 0.26,
      w * 0.62
    );
    sunGlow.addColorStop(0, palette[2] + '55');
    sunGlow.addColorStop(0.6, palette[3] + '22');
    sunGlow.addColorStop(1, 'transparent');
    ctx.fillStyle = sunGlow;
    ctx.fillRect(0, 0, w, h);

    // Organic coastal / alpine ridge & limestone horizon
    const horizonY = h * 0.64;
    ctx.beginPath();
    ctx.moveTo(-20, horizonY);
    for (let x = 0; x <= w + 40; x += 40) {
      const ridge =
        Math.sin(x * 0.009 + opts.seed * 0.1) * (h * 0.06) +
        Math.cos(x * 0.021) * (h * 0.025);
      ctx.lineTo(x, horizonY - ridge);
    }
    ctx.lineTo(w + 40, h + 40);
    ctx.lineTo(-20, h + 40);
    ctx.closePath();
    ctx.fillStyle = palette[1];
    ctx.fill();

    // Calm water / courtyard stone plane
    const groundGrad = ctx.createLinearGradient(0, horizonY, 0, h);
    groundGrad.addColorStop(0, palette[2] + '30');
    groundGrad.addColorStop(1, palette[0]);
    ctx.fillStyle = groundGrad;
    ctx.fillRect(-20, horizonY, w + 40, h - horizonY + 20);
  }

  if (!opts.backgroundOnly) {
    // Minimal architectural archway / tactile 35mm composition subject
    const cx = w * 0.5 + Math.sin(timeSec * 0.5) * 3;
    const cy = h * 0.54;
    ctx.save();
    ctx.strokeStyle = palette[4] + '55';
    ctx.lineWidth = 1.5;
    if (isCraft) {
      const rw = w * 0.32;
      const rh = h * 0.28;
      ctx.fillStyle = palette[0] + 'CC';
      ctx.fillRect(cx - rw / 2, cy - rh / 2, rw, rh);
      ctx.strokeRect(cx - rw / 2, cy - rh / 2, rw, rh);
      ctx.beginPath();
      ctx.arc(cx + rw * 0.08, cy, Math.min(rw, rh) * 0.28, 0, Math.PI * 2);
      ctx.strokeStyle = palette[2];
      ctx.lineWidth = 2;
      ctx.stroke();
    } else {
      const aw = w * 0.22;
      const ah = h * 0.44;
      ctx.fillStyle = palette[2] + '26';
      ctx.beginPath();
      ctx.arc(cx, cy - ah * 0.12, aw * 0.5, Math.PI, 0);
      ctx.lineTo(cx + aw * 0.5, cy + ah * 0.45);
      ctx.lineTo(cx - aw * 0.5, cy + ah * 0.45);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    // Subtle film grain specks (Kodak 250D texture)
    ctx.fillStyle = 'rgba(245, 239, 230, 0.06)';
    for (let i = 0; i < 28; i++) {
      const gx = rand() * w;
      const gy = rand() * h;
      ctx.fillRect(gx, gy, 1.5, 1.5);
    }
    ctx.restore();
  }

  ctx.restore();

  if (opts.cameraLabel || opts.hudBadge) {
    ctx.save();
    if (opts.cameraLabel) {
      ctx.fillStyle = 'rgba(14, 14, 14, 0.72)';
      ctx.fillRect(
        10,
        h - 28,
        Math.min(w - 20, opts.cameraLabel.length * 6.8 + 18),
        20
      );
      ctx.fillStyle = '#F5F5F5';
      ctx.font = '600 10px "JetBrains Mono", monospace';
      ctx.fillText(opts.cameraLabel, 17, h - 14);
    }
    if (opts.hudBadge) {
      const bw = opts.hudBadge.length * 6.6 + 16;
      ctx.fillStyle = 'rgba(25, 25, 25, 0.88)';
      ctx.fillRect(w - bw - 10, 10, bw, 19);
      ctx.fillStyle = '#F5F5F5';
      ctx.font = '600 10px "JetBrains Mono", monospace';
      ctx.fillText(opts.hudBadge, w - bw - 2, 23);
    }
    ctx.restore();
  }
}

export function renderShotDataUrl(
  aspect: AspectRatio,
  opts: ShotRenderOptions,
  pixelScale = 2
): string {
  const { width, height } = getDimensionsForAspect(aspect, 380);
  const canvas = document.createElement('canvas');
  canvas.width = width * pixelScale;
  canvas.height = height * pixelScale;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  ctx.scale(pixelScale, pixelScale);
  drawCinemaShotFrame(ctx, width, height, 0.4, opts);
  return canvas.toDataURL('image/png');
}

export const NINE_GRID_LABELS = [
  '01 · WIDE COURTYARD 24mm',
  '02 · COASTAL CLIFF HORIZON',
  '03 · MEDIUM WALKING 35mm',
  '04 · ATELIER WINDOW LIGHT 50mm',
  '05 · NATURAL PORTRAIT 85mm',
  '06 · LEICA CRAFT MACRO 90mm',
  '07 · ALPINE PASS ESTABLISHING',
  '08 · KYOTO CEDAR PAVILION',
  '09 · GOLDEN HOUR SURF',
];

export const FOUR_ANGLE_LABELS = [
  'CAM A · WIDE MASTER 24mm',
  'CAM B · MEDIUM TWO-SHOT 50mm',
  'CAM C · PORTRAIT CLOSE-UP 85mm',
  'CAM D · LOW ARCHITECTURAL 21mm',
];

export function renderContactSheetDataUrl(
  rows: number,
  cols: number,
  prompt: string,
  baseSeed: number,
  palette?: string[]
): { dataUrl: string; labels: string[] } {
  const cellW = 280;
  const cellH = 158;
  const canvas = document.createElement('canvas');
  canvas.width = cols * cellW;
  canvas.height = rows * cellH;
  const ctx = canvas.getContext('2d');
  const labels = rows === 3 && cols === 3 ? NINE_GRID_LABELS : FOUR_ANGLE_LABELS;

  if (!ctx) return { dataUrl: '', labels };

  const themes: Array<ShotRenderOptions['theme']> = [
    'coastal-daylight',
    'architectural-pan',
    'craft-macro',
    'alpine-aerial',
    'golden-hour',
    'coastal-daylight',
  ];

  let idx = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cellCanvas = document.createElement('canvas');
      cellCanvas.width = cellW;
      cellCanvas.height = cellH;
      const cellCtx = cellCanvas.getContext('2d');
      const label = labels[idx] || `PANEL ${idx + 1}`;
      if (cellCtx) {
        drawCinemaShotFrame(cellCtx, cellW, cellH, idx * 0.85, {
          prompt,
          seed: baseSeed + idx * 97,
          palette,
          theme: themes[idx % themes.length],
          cameraLabel: label,
        });
        ctx.drawImage(cellCanvas, c * cellW, r * cellH);
      }
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
      ctx.lineWidth = 2;
      ctx.strokeRect(c * cellW, r * cellH, cellW, cellH);
      idx++;
    }
  }

  return { dataUrl: canvas.toDataURL('image/png'), labels };
}

export async function sliceGridImageDataUrl(
  sourceDataUrl: string,
  rows: number,
  cols: number
): Promise<string[]> {
  const img = await loadImageElement(sourceDataUrl);
  const cellW = Math.floor(img.naturalWidth / cols);
  const cellH = Math.floor(img.naturalHeight / rows);
  const slices: string[] = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const canvas = document.createElement('canvas');
      canvas.width = cellW;
      canvas.height = cellH;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, c * cellW, r * cellH, cellW, cellH, 0, 0, cellW, cellH);
        slices.push(canvas.toDataURL('image/png'));
      }
    }
  }
  return slices;
}

export async function compositeInpaintRedraw(
  baseDataUrl: string,
  maskDataUrl: string,
  regionalPrompt: string,
  seed: number,
  palette?: string[]
): Promise<{ compositedDataUrl: string; isolatedPatchDataUrl: string }> {
  const [baseImg, maskImg] = await Promise.all([
    loadImageElement(baseDataUrl),
    loadImageElement(maskDataUrl),
  ]);

  const w = baseImg.naturalWidth || 640;
  const h = baseImg.naturalHeight || 360;

  const generatedCanvas = document.createElement('canvas');
  generatedCanvas.width = w;
  generatedCanvas.height = h;
  const genCtx = generatedCanvas.getContext('2d')!;
  drawCinemaShotFrame(genCtx, w, h, 1.4, {
    prompt: regionalPrompt,
    seed: seed + 409,
    palette: palette || ['#1F1915', '#3B2B20', '#D49B6A', '#7A96A4', '#F4ECE1'],
    theme: 'golden-hour',
  });

  const patchCanvas = document.createElement('canvas');
  patchCanvas.width = w;
  patchCanvas.height = h;
  const patchCtx = patchCanvas.getContext('2d')!;
  if (maskDataUrl) {
    patchCtx.drawImage(maskImg, 0, 0, w, h);
    patchCtx.globalCompositeOperation = 'source-in';
  }
  patchCtx.drawImage(generatedCanvas, 0, 0, w, h);

  const outCanvas = document.createElement('canvas');
  outCanvas.width = w;
  outCanvas.height = h;
  const outCtx = outCanvas.getContext('2d')!;
  outCtx.drawImage(baseImg, 0, 0, w, h);
  outCtx.drawImage(patchCanvas, 0, 0, w, h);

  return {
    compositedDataUrl: outCanvas.toDataURL('image/png'),
    isolatedPatchDataUrl: patchCanvas.toDataURL('image/png'),
  };
}

export async function expandOutpaintDataUrl(
  baseDataUrl: string,
  targetAspect: AspectRatio,
  prompt: string,
  seed: number,
  palette?: string[]
): Promise<string> {
  const baseImg = await loadImageElement(baseDataUrl);
  const { width, height } = getDimensionsForAspect(targetAspect, 420);
  const scale = 2;
  const outW = width * scale;
  const outH = height * scale;

  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext('2d')!;

  drawCinemaShotFrame(ctx, outW, outH, 0.25, {
    prompt: `${prompt} — expanded ${targetAspect} natural periphery`,
    seed: seed + 77,
    palette,
  });

  const fitRatio = Math.min(
    (outW * 0.74) / Math.max(1, baseImg.naturalWidth),
    (outH * 0.74) / Math.max(1, baseImg.naturalHeight)
  );
  const drawW = baseImg.naturalWidth * fitRatio;
  const drawH = baseImg.naturalHeight * fitRatio;
  const dx = (outW - drawW) / 2;
  const dy = (outH - drawH) / 2;

  ctx.save();
  ctx.shadowColor = 'rgba(14, 14, 14, 0.8)';
  ctx.shadowBlur = 24;
  ctx.drawImage(baseImg, dx, dy, drawW, drawH);
  ctx.restore();

  return canvas.toDataURL('image/png');
}

export function decomposeSubjectAndBackground(
  aspect: AspectRatio,
  prompt: string,
  seed: number,
  palette?: string[]
): { foregroundDataUrl: string; backgroundDataUrl: string } {
  const foregroundDataUrl = renderShotDataUrl(aspect, {
    prompt,
    seed,
    palette,
    isolatedSubjectOnly: true,
  });
  const backgroundDataUrl = renderShotDataUrl(aspect, {
    prompt,
    seed,
    palette,
    backgroundOnly: true,
  });
  return { foregroundDataUrl, backgroundDataUrl };
}

export function extractStyleDnaFromPrompt(prompt: string): StyleDNAPayload {
  const lower = prompt.toLowerCase();
  if (lower.includes('kyoto') || lower.includes('timber') || lower.includes('craft')) {
    return {
      presetName: 'Kyoto Cedar & Warm Window Daylight',
      palette: ['#1A1714', '#2E261F', '#C49A6C', '#8C6D4F', '#EDE6DC'],
      lighting: 'Diffused Shoji Morning Window Light + Warm Cedar Bounce',
      lens: 'Leica Summilux-M 50mm f/1.4 ASPH',
      filmStock: 'Kodak Portra 400 (Medium Format 6×7)',
      motionCadence: '24fps · 180° Shutter · Slow Slider Track',
      locked: true,
    };
  }
  if (lower.includes('alpine') || lower.includes('mountain') || lower.includes('mist')) {
    return {
      presetName: 'Alpine Overcast & Architectural Concrete',
      palette: ['#161D22', '#26353F', '#6B8E9B', '#9DB4BD', '#EEF2F3'],
      lighting: 'Soft High-Altitude Overcast + Atmospheric Mist',
      lens: 'Zeiss Master Prime 27mm T1.3',
      filmStock: 'Kodak Vision3 250D 5207',
      motionCadence: '24fps · Stabilized Aerial Drift',
      locked: true,
    };
  }
  return {
    presetName: 'Mediterranean Kodak 250D Daylight',
    palette: ['#1C1916', '#332C25', '#C89B6E', '#698996', '#F3EDE2'],
    lighting: 'Natural Afternoon Sun + Limestone Courtyard Shadow',
    lens: 'Leica Summilux-C 35mm T1.4',
    filmStock: 'Kodak Vision3 250D 5207 (35mm)',
    motionCadence: '24fps · Gentle Organic Handheld',
    locked: true,
  };
}

export function renderElementAvatarDataUrl(
  label: string,
  accent: string,
  variant: number
): string {
  const canvas = document.createElement('canvas');
  canvas.width = 160;
  canvas.height = 160;
  const ctx = canvas.getContext('2d')!;
  drawCinemaShotFrame(ctx, 160, 160, variant * 0.9, {
    prompt: label,
    seed: 500 + variant * 131,
    palette: ['#1A1714', '#2E261F', accent, '#698996', '#F3EDE2'],
    hudBadge: `REF #${variant + 1}`,
  });
  return canvas.toDataURL('image/png');
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => {
      const fallback = renderShotDataUrl('16:9', {
        prompt: 'Fallback Studio Frame',
        seed: 42,
      });
      const fbImg = new Image();
      fbImg.onload = () => resolve(fbImg);
      fbImg.onerror = reject;
      fbImg.src = fallback;
    };
    img.src = src;
  });
}
