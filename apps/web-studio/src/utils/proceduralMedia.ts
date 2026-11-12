import type { AspectRatio, StyleDNAPayload } from '../types/studio';

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

export interface ShotRenderOptions {
  prompt: string;
  seed: number;
  palette?: string[];
  cameraLabel?: string;
  theme?: 'cyberpunk-rain' | 'sneaker-macro' | 'drone-canyon' | 'neon-orbit' | 'product-ugc' | 'night-remix';
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
  const isSneaker =
    opts.theme === 'sneaker-macro' ||
    opts.theme === 'product-ugc' ||
    pLower.includes('sneaker') ||
    pLower.includes('shoe') ||
    pLower.includes('product');
  const isDrone =
    opts.theme === 'drone-canyon' ||
    pLower.includes('drone') ||
    pLower.includes('fpv') ||
    pLower.includes('establishing') ||
    pLower.includes('aerial');
  const isNightRemix =
    opts.theme === 'night-remix' || pLower.includes('night remix') || pLower.includes('crimson');

  const defaultPalette = isSneaker
    ? ['#090D16', '#1E1B4B', '#06B6D4', '#A855F7', '#F43F5E']
    : isDrone
    ? ['#0B1320', '#162A3A', '#38BDF8', '#F59E0B', '#E2E8F0']
    : isNightRemix
    ? ['#09050F', '#2B0A2F', '#EC4899', '#8B5CF6', '#22D3EE']
    : ['#070A14', '#131C31', '#0EA5E9', '#8B5CF6', '#F43F5E'];

  const palette = opts.palette && opts.palette.length >= 4 ? opts.palette : defaultPalette;

  ctx.save();
  ctx.clearRect(0, 0, w, h);

  const camZoom = 1 + Math.sin(timeSec * 0.45) * 0.035;
  const camShiftX = Math.cos(timeSec * 0.6) * (w * 0.02);
  const camShiftY = Math.sin(timeSec * 0.4) * (h * 0.012);

  ctx.translate(w / 2 + camShiftX, h / 2 + camShiftY);
  ctx.scale(camZoom, camZoom);
  ctx.translate(-w / 2, -h / 2);

  if (!opts.isolatedSubjectOnly) {
    const skyGrad = ctx.createLinearGradient(0, 0, w * 0.3, h);
    skyGrad.addColorStop(0, palette[0]);
    skyGrad.addColorStop(0.55, palette[1]);
    skyGrad.addColorStop(1, '#05070D');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(-40, -40, w + 80, h + 80);

    const glow1 = ctx.createRadialGradient(
      w * (0.28 + Math.sin(timeSec * 0.7) * 0.05),
      h * 0.34,
      8,
      w * 0.28,
      h * 0.34,
      w * 0.55
    );
    glow1.addColorStop(0, palette[2] + '66');
    glow1.addColorStop(1, 'transparent');
    ctx.fillStyle = glow1;
    ctx.fillRect(0, 0, w, h);

    const glow2 = ctx.createRadialGradient(
      w * (0.74 - Math.cos(timeSec * 0.5) * 0.05),
      h * 0.42,
      8,
      w * 0.74,
      h * 0.42,
      w * 0.48
    );
    glow2.addColorStop(0, palette[3] + '58');
    glow2.addColorStop(1, 'transparent');
    ctx.fillStyle = glow2;
    ctx.fillRect(0, 0, w, h);

    const horizonY = h * 0.68;
    const buildingCount = 14;
    for (let i = 0; i < buildingCount; i++) {
      const bw = (w / buildingCount) * (0.8 + rand() * 0.65);
      const bh = h * (0.18 + rand() * 0.42);
      const bx = (i / buildingCount) * w - 10 + (i % 2 === 0 ? -timeSec * 2 : timeSec * 1.2);
      const by = horizonY - bh;

      ctx.fillStyle = i % 2 === 0 ? 'rgba(9, 13, 24, 0.92)' : 'rgba(15, 22, 38, 0.85)';
      ctx.fillRect(bx, by, bw, bh + h * 0.35);

      if (rand() > 0.35) {
        ctx.fillStyle = (i % 3 === 0 ? palette[2] : palette[3]) + '99';
        ctx.fillRect(bx + 4, by + 8 + rand() * 24, Math.max(6, bw * 0.55), 3);
      }

      ctx.fillStyle = 'rgba(226, 232, 240, 0.24)';
      for (let wy = by + 18; wy < horizonY - 8; wy += 11) {
        for (let wx = bx + 5; wx < bx + bw - 6; wx += 9) {
          if (rand() > 0.55) {
            ctx.fillRect(wx, wy, 3, 4);
          }
        }
      }
    }

    const floorGrad = ctx.createLinearGradient(0, horizonY, 0, h);
    floorGrad.addColorStop(0, 'rgba(12, 18, 32, 0.85)');
    floorGrad.addColorStop(0.4, palette[1] + 'AA');
    floorGrad.addColorStop(1, '#04060B');
    ctx.fillStyle = floorGrad;
    ctx.fillRect(-40, horizonY, w + 80, h - horizonY + 40);

    ctx.strokeStyle = palette[2] + '38';
    ctx.lineWidth = 1;
    for (let i = -6; i <= 6; i++) {
      ctx.beginPath();
      ctx.moveTo(w / 2 + i * (w * 0.03), horizonY);
      ctx.lineTo(w / 2 + i * (w * 0.22), h + 20);
      ctx.stroke();
    }

    ctx.fillStyle = palette[2] + '33';
    ctx.fillRect(w * 0.14, horizonY + h * 0.08, w * 0.28, 3);
    ctx.fillStyle = palette[3] + '38';
    ctx.fillRect(w * 0.55, horizonY + h * 0.14, w * 0.3, 4);
  }

  if (!opts.backgroundOnly) {
    const floatY = Math.sin(timeSec * 2.1) * (h * 0.018);

    if (isSneaker) {
      ctx.save();
      ctx.translate(w * 0.5, h * 0.54 + floatY);
      ctx.rotate(-0.14 + Math.sin(timeSec * 0.9) * 0.04);

      const sw = w * 0.46;
      const sh = h * 0.28;

      const soleGlow = ctx.createRadialGradient(0, sh * 0.45, 4, 0, sh * 0.45, sw * 0.65);
      soleGlow.addColorStop(0, palette[2] + 'BB');
      soleGlow.addColorStop(1, 'transparent');
      ctx.fillStyle = soleGlow;
      ctx.beginPath();
      ctx.ellipse(0, sh * 0.5, sw * 0.58, sh * 0.25, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(-sw * 0.48, sh * 0.22);
      ctx.quadraticCurveTo(0, sh * 0.38, sw * 0.5, sh * 0.16);
      ctx.lineTo(sw * 0.46, sh * 0.34);
      ctx.quadraticCurveTo(0, sh * 0.48, -sw * 0.45, sh * 0.34);
      ctx.closePath();
      const soleGrad = ctx.createLinearGradient(-sw * 0.5, 0, sw * 0.5, 0);
      soleGrad.addColorStop(0, palette[2]);
      soleGrad.addColorStop(0.5, '#F8FAFC');
      soleGrad.addColorStop(1, palette[3]);
      ctx.fillStyle = soleGrad;
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(-sw * 0.46, sh * 0.22);
      ctx.lineTo(-sw * 0.38, -sh * 0.36);
      ctx.quadraticCurveTo(-sw * 0.12, -sh * 0.44, sw * 0.05, -sh * 0.12);
      ctx.quadraticCurveTo(sw * 0.28, -sh * 0.02, sw * 0.5, sh * 0.16);
      ctx.closePath();
      const upperGrad = ctx.createLinearGradient(-sw * 0.4, -sh * 0.4, sw * 0.4, sh * 0.2);
      upperGrad.addColorStop(0, '#1E293B');
      upperGrad.addColorStop(0.6, '#0F172A');
      upperGrad.addColorStop(1, palette[3]);
      ctx.fillStyle = upperGrad;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = palette[2];
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(-sw * 0.28, sh * 0.04);
      ctx.quadraticCurveTo(0, -sh * 0.08, sw * 0.32, sh * 0.12);
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 3.5;
      ctx.stroke();

      ctx.restore();
    } else if (isDrone) {
      ctx.save();
      ctx.translate(w * 0.5, h * 0.48 + floatY);
      ctx.strokeStyle = palette[2];
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, Math.min(w, h) * 0.24, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = palette[3] + 'AA';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, Math.min(w, h) * 0.17, timeSec, timeSec + Math.PI * 1.4);
      ctx.stroke();

      ctx.fillStyle = '#F8FAFC';
      ctx.beginPath();
      ctx.moveTo(0, -14);
      ctx.lineTo(28, 12);
      ctx.lineTo(0, 5);
      ctx.lineTo(-28, 12);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    } else {
      const cx = w * 0.5 + Math.sin(timeSec * 1.1) * 4;
      const baseY = h * 0.86;
      const charH = h * 0.52;

      ctx.save();
      const rim = ctx.createRadialGradient(cx, baseY - charH * 0.65, 4, cx, baseY - charH * 0.6, charH * 0.65);
      rim.addColorStop(0, palette[2] + '75');
      rim.addColorStop(1, 'transparent');
      ctx.fillStyle = rim;
      ctx.beginPath();
      ctx.arc(cx, baseY - charH * 0.6, charH * 0.65, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(cx - charH * 0.26, baseY);
      ctx.lineTo(cx - charH * 0.21, baseY - charH * 0.58);
      ctx.quadraticCurveTo(cx, baseY - charH * 0.68, cx + charH * 0.21, baseY - charH * 0.58);
      ctx.lineTo(cx + charH * 0.28 + Math.sin(timeSec * 2.5) * 4, baseY);
      ctx.closePath();
      const coatGrad = ctx.createLinearGradient(cx - 30, baseY - charH, cx + 30, baseY);
      coatGrad.addColorStop(0, '#1E293B');
      coatGrad.addColorStop(1, '#090D16');
      ctx.fillStyle = coatGrad;
      ctx.fill();
      ctx.strokeStyle = palette[2] + 'CC';
      ctx.lineWidth = 1.8;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(cx, baseY - charH * 0.75, charH * 0.12, 0, Math.PI * 2);
      ctx.fillStyle = '#0F172A';
      ctx.fill();
      ctx.strokeStyle = palette[3];
      ctx.lineWidth = 1.6;
      ctx.stroke();

      ctx.fillStyle = '#38BDF8';
      ctx.shadowColor = '#38BDF8';
      ctx.shadowBlur = 8;
      ctx.fillRect(cx - charH * 0.07, baseY - charH * 0.76, charH * 0.14, 3);
      ctx.shadowBlur = 0;
      ctx.restore();
    }
  }

  if (!opts.isolatedSubjectOnly) {
    ctx.strokeStyle = 'rgba(186, 230, 253, 0.22)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 34; i++) {
      const rx = ((rand() * w + timeSec * 45) % (w + 20)) - 10;
      const ry = ((rand() * h + timeSec * 210) % (h + 20)) - 10;
      ctx.beginPath();
      ctx.moveTo(rx, ry);
      ctx.lineTo(rx - 3, ry + 13);
      ctx.stroke();
    }
  }

  ctx.restore();

  if (opts.cameraLabel || opts.hudBadge) {
    ctx.save();
    if (opts.cameraLabel) {
      ctx.fillStyle = 'rgba(7, 8, 12, 0.72)';
      ctx.fillRect(10, h - 28, Math.min(w - 20, opts.cameraLabel.length * 6.8 + 18), 20);
      ctx.fillStyle = '#E2E8F0';
      ctx.font = '600 10px "JetBrains Mono", monospace';
      ctx.fillText(opts.cameraLabel, 17, h - 14);
    }
    if (opts.hudBadge) {
      const bw = opts.hudBadge.length * 6.6 + 16;
      ctx.fillStyle = 'rgba(139, 92, 246, 0.82)';
      ctx.fillRect(w - bw - 10, 10, bw, 19);
      ctx.fillStyle = '#FFFFFF';
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

const NINE_GRID_LABELS = [
  '01 · EXTREME WIDE 14mm',
  '02 · ESTABLISHING ANAMORPHIC',
  '03 · MEDIUM TRACKING 35mm',
  '04 · OVER-THE-SHOULDER 50mm',
  '05 · HERO CLOSE-UP 85mm',
  '06 · MACRO INSERT 100mm',
  '07 · LOW DUTCH ANGLE 24mm',
  '08 · HIGH CRANE ORBIT',
  '09 · SILHOUETTE CLIMAX',
];

const FOUR_ANGLE_LABELS = [
  'CAM A · WIDE MASTER 24mm',
  'CAM B · MEDIUM TWO-SHOT 50mm',
  'CAM C · HERO CLOSE-UP 85mm',
  'CAM D · LOW HERO TRACK 18mm',
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
    'cyberpunk-rain',
    'drone-canyon',
    'sneaker-macro',
    'neon-orbit',
    'night-remix',
    'cyberpunk-rain',
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
          theme: prompt.toLowerCase().includes('sneaker')
            ? idx % 3 === 1
              ? 'product-ugc'
              : 'sneaker-macro'
            : themes[idx % themes.length],
          cameraLabel: label,
        });
        ctx.drawImage(cellCanvas, c * cellW, r * cellH);
      }
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
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
  drawCinemaShotFrame(genCtx, w, h, 1.8, {
    prompt: regionalPrompt,
    seed: seed + 409,
    palette: palette || ['#090D16', '#311042', '#22D3EE', '#F43F5E', '#FACC15'],
    theme: regionalPrompt.toLowerCase().includes('sneaker') ? 'sneaker-macro' : 'night-remix',
  });

  const glowGrad = genCtx.createLinearGradient(0, 0, w, h);
  glowGrad.addColorStop(0, 'rgba(56, 189, 248, 0.36)');
  glowGrad.addColorStop(0.5, 'rgba(244, 63, 94, 0.34)');
  glowGrad.addColorStop(1, 'rgba(168, 85, 247, 0.38)');
  genCtx.fillStyle = glowGrad;
  genCtx.fillRect(0, 0, w, h);

  const patchCanvas = document.createElement('canvas');
  patchCanvas.width = w;
  patchCanvas.height = h;
  const patchCtx = patchCanvas.getContext('2d')!;
  patchCtx.drawImage(maskImg, 0, 0, w, h);
  patchCtx.globalCompositeOperation = 'source-in';
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
    prompt: `${prompt} — expanded ${targetAspect} anamorphic periphery`,
    seed: seed + 77,
    palette,
  });

  const fitRatio = Math.min((outW * 0.74) / baseImg.naturalWidth, (outH * 0.74) / baseImg.naturalHeight);
  const drawW = baseImg.naturalWidth * fitRatio;
  const drawH = baseImg.naturalHeight * fitRatio;
  const dx = (outW - drawW) / 2;
  const dy = (outH - drawH) / 2;

  ctx.save();
  ctx.shadowColor = 'rgba(7, 8, 12, 0.85)';
  ctx.shadowBlur = 24;
  ctx.drawImage(baseImg, dx, dy, drawW, drawH);
  ctx.restore();

  ctx.fillStyle = 'rgba(14, 165, 233, 0.82)';
  ctx.fillRect(14, 14, 148, 24);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '600 12px "JetBrains Mono", monospace';
  ctx.fillText(`OUTPAINT · ${targetAspect}`, 24, 30);

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
  if (lower.includes('sneaker') || lower.includes('product') || lower.includes('commercial')) {
    return {
      presetName: 'Hyper-Studio Product Anamorphic',
      palette: ['#090D16', '#1E1B4B', '#06B6D4', '#A855F7', '#F43F5E'],
      lighting: 'Dual Volumetric Cyan/Magenta Rim + Top Softbox',
      lens: 'Cooke Anamorphic/i 65mm Macro T2.6',
      filmStock: 'Kodak Vision3 500T 5219 (Clean DI)',
      motionCadence: '24fps · 180° Shutter · High-Speed 120fps Ramp',
      locked: true,
    };
  }
  return {
    presetName: 'Neo-Tokyo Rain & Teal/Violet Specular',
    palette: ['#070A14', '#131C31', '#0EA5E9', '#8B5CF6', '#F43F5E'],
    lighting: 'Wet Sodium-Vapor Crosslight + Volumetric Fog',
    lens: 'Panavision C-Series 40mm Anamorphic T2.0',
    filmStock: 'Kodak Vision3 500T + Halation Bloom',
    motionCadence: '24fps · Smooth Gimbal Steadicam',
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
    palette: ['#090D16', '#18182F', accent, '#8B5CF6', '#38BDF8'],
    hudBadge: `REF #${variant + 1}`,
  });
  return canvas.toDataURL('image/png');
}

export function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err);
    img.src = src;
  });
}
