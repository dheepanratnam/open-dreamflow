import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowUp,
  Brush,
  Loader2,
  Maximize2,
  RotateCcw,
  Undo2,
  X,
} from 'lucide-react';
import type { AspectRatio } from '../types/studio';
import { useStudioStore } from '../store/useStudioStore';
import { SmartMediaImage } from './SmartMedia';
import { renderShotDataUrl } from '../utils/proceduralMedia';

interface BrushStroke {
  size: number;
  points: Array<{ x: number; y: number }>;
}

const OUTPAINT_PRESETS: Array<{
  aspect: AspectRatio;
  label: string;
  dims: string;
  previewClass: string;
}> = [
  {
    aspect: '16:9',
    label: '16:9 Cinema',
    dims: '1920 × 1080',
    previewClass: 'aspect-video w-[460px]',
  },
  {
    aspect: '21:9',
    label: '21:9 Anamorphic',
    dims: '2520 × 1080',
    previewClass: 'w-[520px] h-[222px]',
  },
  {
    aspect: '9:16',
    label: '9:16 Vertical',
    dims: '1080 × 1920',
    previewClass: 'w-[210px] h-[360px]',
  },
  {
    aspect: '1:1',
    label: '1:1 Square',
    dims: '1440 × 1440',
    previewClass: 'w-[340px] h-[340px]',
  },
];

export const InlineImageEditorModal: React.FC = () => {
  const modal = useStudioStore((s) => s.inlineEditorModal);
  const nodes = useStudioStore((s) => s.nodes);
  const openInlineEditor = useStudioStore((s) => s.openInlineEditor);
  const closeInlineEditor = useStudioStore((s) => s.closeInlineEditor);
  const applyInpaintToNode = useStudioStore((s) => s.applyInpaintToNode);
  const expandOutpaintNode = useStudioStore((s) => s.expandOutpaintNode);

  const [brushSize, setBrushSize] = useState(38);
  const [strokes, setStrokes] = useState<BrushStroke[]>([]);
  const [inpaintPrompt, setInpaintPrompt] = useState(
    'Warm terracotta ceramic amphora in dappled Mediterranean courtyard sunlight, 35mm Kodak 250D'
  );
  const [targetAspect, setTargetAspect] = useState<AspectRatio>('21:9');
  const [outpaintPrompt, setOutpaintPrompt] = useState(
    'Expand sunlit limestone colonnade, olive branches, and distant Atlantic coastline'
  );
  const [submitting, setSubmitting] = useState(false);

  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const activeStrokeRef = useRef<BrushStroke | null>(null);

  const node = useMemo(
    () => nodes.find((n) => n.id === modal.nodeId) || null,
    [nodes, modal.nodeId]
  );

  // Reset strokes when opening on a new node
  useEffect(() => {
    if (modal.open) {
      setStrokes([]);
      setSubmitting(false);
    }
  }, [modal.open, modal.nodeId]);

  // Redraw visible translucent cyan mask strokes whenever strokes change
  useEffect(() => {
    const canvas = previewCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(32, 213, 236, 0.5)';
    ctx.fillStyle = 'rgba(32, 213, 236, 0.5)';

    for (const stroke of strokes) {
      if (stroke.points.length === 0) continue;
      if (stroke.points.length === 1) {
        ctx.beginPath();
        ctx.arc(
          stroke.points[0].x,
          stroke.points[0].y,
          stroke.size / 2,
          0,
          Math.PI * 2
        );
        ctx.fill();
        continue;
      }
      ctx.lineWidth = stroke.size;
      ctx.beginPath();
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
      }
      ctx.stroke();
    }
  }, [strokes, modal.mode, modal.open]);

  if (!modal.open || !node) return null;

  const sourceImageUrl =
    node.imageUrl ||
    renderShotDataUrl(node.aspectRatio, {
      prompt: node.prompt || 'Image Editor Frame',
      seed: node.seed,
    });

  const getCanvasPoint = (clientX: number, clientY: number) => {
    const canvas = previewCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / Math.max(1, rect.width)) * canvas.width,
      y: ((clientY - rect.top) / Math.max(1, rect.height)) * canvas.height,
    };
  };

  const buildBinaryMaskDataUrl = (): string | undefined => {
    if (strokes.length === 0) return undefined;
    const offscreen = document.createElement('canvas');
    offscreen.width = 1280;
    offscreen.height = 720;
    const ctx = offscreen.getContext('2d');
    if (!ctx) return undefined;

    // Black = keep original, White = replace with edited region (FFmpeg maskedmerge)
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, offscreen.width, offscreen.height);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#ffffff';
    ctx.fillStyle = '#ffffff';

    for (const stroke of strokes) {
      if (stroke.points.length === 0) continue;
      if (stroke.points.length === 1) {
        ctx.beginPath();
        ctx.arc(
          stroke.points[0].x,
          stroke.points[0].y,
          stroke.size / 2,
          0,
          Math.PI * 2
        );
        ctx.fill();
        continue;
      }
      ctx.lineWidth = stroke.size;
      ctx.beginPath();
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
      }
      ctx.stroke();
    }

    return offscreen.toDataURL('image/png');
  };

  const handleApply = async () => {
    setSubmitting(true);
    if (modal.mode === 'inpaint') {
      const maskDataUrl = buildBinaryMaskDataUrl();
      await applyInpaintToNode(node.id, maskDataUrl || '', inpaintPrompt);
    } else {
      await expandOutpaintNode(node.id, targetAspect, outpaintPrompt);
    }
    setSubmitting(false);
  };

  const selectedOutpaintPreset =
    OUTPAINT_PRESETS.find((p) => p.aspect === targetAspect) ||
    OUTPAINT_PRESETS[0];

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 select-none"
      onClick={() => !submitting && closeInlineEditor()}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[820px] rounded-[16px] bg-[#191919] border border-white/[0.1] shadow-[0_28px_80px_rgba(0,0,0,0.85)] overflow-hidden flex flex-col text-[#f5f5f5]"
      >
        {/* Top Modal Header + Mode Switcher */}
        <div className="h-[50px] px-4 border-b border-white/[0.08] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 p-1 rounded-[9px] bg-[#121212] border border-white/[0.06]">
              <button
                type="button"
                onClick={() => openInlineEditor('inpaint', node.id)}
                className={`h-7 px-3 rounded-[7px] text-[12px] font-medium flex items-center gap-1.5 transition-colors ${
                  modal.mode === 'inpaint'
                    ? 'bg-[#2b2b2b] text-white'
                    : 'text-white/55 hover:text-white/85'
                }`}
              >
                <Brush className="w-3.5 h-3.5" strokeWidth={1.5} />
                <span>Inpaint Brush</span>
              </button>
              <button
                type="button"
                onClick={() => openInlineEditor('outpaint', node.id)}
                className={`h-7 px-3 rounded-[7px] text-[12px] font-medium flex items-center gap-1.5 transition-colors ${
                  modal.mode === 'outpaint'
                    ? 'bg-[#2b2b2b] text-white'
                    : 'text-white/55 hover:text-white/85'
                }`}
              >
                <Maximize2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                <span>Expand (Outpaint)</span>
              </button>
            </div>
            <span className="text-[12px] text-white/45 truncate max-w-[260px] ml-1">
              {node.title}
            </span>
          </div>

          <button
            type="button"
            disabled={submitting}
            onClick={closeInlineEditor}
            className="w-7 h-7 rounded-[7px] hover:bg-white/[0.08] flex items-center justify-center text-white/60 hover:text-white"
          >
            <X className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </div>

        {/* Stage Area (#141414) */}
        <div className="p-5 bg-[#141414] flex flex-col items-center justify-center min-h-[390px]">
          {modal.mode === 'inpaint' ? (
            <div className="relative w-full max-w-[700px] aspect-video rounded-[12px] overflow-hidden border border-white/[0.1] bg-[#0e0e0e] shadow-[0_16px_44px_rgba(0,0,0,0.65)]">
              <SmartMediaImage
                src={sourceImageUrl}
                alt={node.title}
                className="w-full h-full object-cover pointer-events-none"
              />
              <canvas
                ref={previewCanvasRef}
                width={1280}
                height={720}
                onPointerDown={(e) => {
                  const pt = getCanvasPoint(e.clientX, e.clientY);
                  const nextStroke: BrushStroke = {
                    size: brushSize * 1.8,
                    points: [pt],
                  };
                  activeStrokeRef.current = nextStroke;
                  setStrokes((prev) => [...prev, nextStroke]);

                  const onMove = (ev: PointerEvent) => {
                    if (!activeStrokeRef.current) return;
                    const p = getCanvasPoint(ev.clientX, ev.clientY);
                    activeStrokeRef.current.points.push(p);
                    setStrokes((prev) => [...prev.slice(0, -1), { ...activeStrokeRef.current! }]);
                  };
                  const onUp = () => {
                    activeStrokeRef.current = null;
                    window.removeEventListener('pointermove', onMove);
                    window.removeEventListener('pointerup', onUp);
                  };
                  window.addEventListener('pointermove', onMove);
                  window.addEventListener('pointerup', onUp);
                }}
                className="absolute inset-0 w-full h-full cursor-crosshair touch-none"
              />

              <div className="absolute top-3 left-3 px-2.5 py-1 rounded-[7px] bg-black/70 backdrop-blur-md border border-white/[0.1] text-[11px] text-white/80 pointer-events-none">
                {strokes.length === 0
                  ? 'Paint over region to redraw'
                  : `${strokes.length} mask stroke${strokes.length > 1 ? 's' : ''} active`}
              </div>
            </div>
          ) : (
            <div className="w-full flex flex-col items-center gap-4">
              <div
                className={`${selectedOutpaintPreset.previewClass} rounded-[12px] border border-dashed border-[#20D5EC]/65 bg-[#0e0e0e] relative flex items-center justify-center overflow-hidden p-4 transition-all`}
              >
                <div className="absolute inset-0 opacity-25 blur-xl scale-110 pointer-events-none">
                  <SmartMediaImage
                    src={sourceImageUrl}
                    alt={node.title}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="relative max-w-[72%] max-h-[78%] rounded-[8px] overflow-hidden border border-white/30 shadow-[0_12px_32px_rgba(0,0,0,0.7)]">
                  <SmartMediaImage
                    src={sourceImageUrl}
                    alt={node.title}
                    className="w-full h-full object-contain"
                  />
                </div>
                <span className="absolute bottom-2 right-2.5 px-2 py-0.5 rounded-[5px] bg-black/75 tabular-nums text-[10.5px] text-[#20D5EC]">
                  {selectedOutpaintPreset.dims}
                </span>
              </div>

              {/* Aspect Preset Cards */}
              <div className="grid grid-cols-4 gap-2 w-full max-w-[640px]">
                {OUTPAINT_PRESETS.map((preset) => {
                  const active = targetAspect === preset.aspect;
                  return (
                    <button
                      key={preset.aspect}
                      type="button"
                      onClick={() => setTargetAspect(preset.aspect)}
                      className={`p-2.5 rounded-[10px] border text-left transition-colors ${
                        active
                          ? 'bg-[#282828] border-white/50 text-white'
                          : 'bg-[#191919] border-white/[0.08] text-white/70 hover:border-white/25'
                      }`}
                    >
                      <div className="text-[12px] font-medium">
                        {preset.label}
                      </div>
                      <div className="tabular-nums text-[10.5px] text-white/45 mt-0.5">
                        {preset.dims}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Bottom Controls & Prompt Bar (#191919) */}
        <div className="p-4 border-t border-white/[0.08] bg-[#191919] space-y-3">
          {modal.mode === 'inpaint' && (
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 flex-1 max-w-[340px]">
                <span className="text-[11.5px] text-white/55 shrink-0">
                  Brush Size
                </span>
                <input
                  type="range"
                  min={10}
                  max={90}
                  value={brushSize}
                  onChange={(e) => setBrushSize(Number(e.target.value))}
                  className="flex-1 accent-white"
                />
                <span className="tabular-nums text-[11.5px] text-white/80 w-10 text-right">
                  {brushSize}px
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={strokes.length === 0}
                  onClick={() => setStrokes((prev) => prev.slice(0, -1))}
                  className="h-7 px-2.5 rounded-[7px] bg-[#252525] hover:bg-[#2e2e2e] disabled:opacity-35 text-[12px] text-white/85 flex items-center gap-1.5"
                >
                  <Undo2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                  <span>Undo Stroke</span>
                </button>
                <button
                  type="button"
                  disabled={strokes.length === 0}
                  onClick={() => setStrokes([])}
                  className="h-7 px-2.5 rounded-[7px] bg-[#252525] hover:bg-[#2e2e2e] disabled:opacity-35 text-[12px] text-white/85 flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" strokeWidth={1.5} />
                  <span>Clear Mask</span>
                </button>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2.5">
            <input
              value={modal.mode === 'inpaint' ? inpaintPrompt : outpaintPrompt}
              onChange={(e) =>
                modal.mode === 'inpaint'
                  ? setInpaintPrompt(e.target.value)
                  : setOutpaintPrompt(e.target.value)
              }
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !submitting) {
                  e.preventDefault();
                  void handleApply();
                }
              }}
              placeholder={
                modal.mode === 'inpaint'
                  ? 'Describe what to generate in the masked region...'
                  : 'Optional atmospheric outpaint prompt...'
              }
              className="flex-1 h-10 px-3.5 rounded-[10px] bg-[#252525] border border-white/[0.08] focus:border-white/25 text-[13px] text-white placeholder:text-white/35 outline-none"
            />

            <button
              type="button"
              disabled={submitting}
              onClick={() => void handleApply()}
              title={
                modal.mode === 'inpaint' ? 'Apply Inpaint' : 'Apply Outpaint'
              }
              className="h-10 px-4 rounded-full bg-white hover:bg-[#e5e5e5] text-[#0e0e0e] text-[12.5px] font-semibold flex items-center gap-2 shrink-0 transition-colors disabled:opacity-60"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2} />
              ) : (
                <ArrowUp className="w-4 h-4" strokeWidth={2} />
              )}
              <span>
                {modal.mode === 'inpaint' ? 'Apply Inpaint' : 'Apply Outpaint'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
