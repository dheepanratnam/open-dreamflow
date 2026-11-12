import React, { useEffect, useRef, useState } from 'react';
import {
  Brush,
  Camera,
  Check,
  Clapperboard,
  Dice5,
  Eye,
  EyeOff,
  Film,
  GitBranch,
  Grid3X3,
  Layers,
  Lock,
  Maximize2,
  Play,
  Pause,
  Plus,
  Scissors,
  Sparkles,
  Trash2,
  Wand2,
  Workflow,
  X,
} from 'lucide-react';
import { useStudioStore } from '../store/useStudioStore';
import type { AspectRatio, CanvasEdge, CanvasNode, FrameLayerType } from '../types/studio';
import { drawCinemaShotFrame } from '../utils/proceduralMedia';

const LiveVideoNodeSurface: React.FC<{
  node: CanvasNode;
  playing: boolean;
}> = ({ node, playing }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    const start = performance.now();
    const render = () => {
      const el = canvasRef.current;
      if (el) {
        const ctx = el.getContext('2d');
        if (ctx) {
          const elapsed = (performance.now() - start) / 1000;
          drawCinemaShotFrame(ctx, el.width, el.height, elapsed, {
            prompt: node.prompt,
            seed: node.seed,
            theme: node.videoTheme,
            cameraLabel: `${node.cameraMotion || 'OMNI 1.2'} · ${(
              elapsed %
              (node.durationSec || 15)
            ).toFixed(1)}s / ${node.durationSec || 15}s`,
            hudBadge: node.previousInteractionId ? 'MULTI-TURN' : 'OMNI 1.2 LIVE',
          });
        }
      }
      raf = requestAnimationFrame(render);
    };
    raf = requestAnimationFrame(render);
    return () => cancelAnimationFrame(raf);
  }, [playing, node]);

  if (node.videoUrl) {
    return (
      <video
        src={node.videoUrl}
        className="w-full h-full object-cover pointer-events-none"
        autoPlay={playing}
        loop
        muted
        playsInline
      />
    );
  }

  if (!playing && node.imageUrl) {
    return (
      <img
        src={node.imageUrl}
        alt={node.title}
        className="w-full h-full object-cover pointer-events-none"
        draggable={false}
      />
    );
  }

  return (
    <canvas
      ref={canvasRef}
      width={node.width * 1.5}
      height={node.height * 1.5}
      className="w-full h-full object-cover pointer-events-none"
    />
  );
};

const InpaintMaskCanvas: React.FC<{
  width: number;
  height: number;
  brushSize: number;
  onMaskReady: (dataUrl: string) => void;
  clearSignal: number;
}> = ({ width, height, brushSize, onMaskReady, clearSignal }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, c.width, c.height);
    }
  }, [clearSignal]);

  const paintAt = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = canvasRef.current;
    if (!c) return;
    const rect = c.getBoundingClientRect();
    const scaleX = c.width / rect.width;
    const scaleY = c.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = 'rgba(236, 72, 153, 0.72)';
    ctx.beginPath();
    ctx.arc(x, y, brushSize, 0, Math.PI * 2);
    ctx.fill();
  };

  return (
    <canvas
      ref={canvasRef}
      width={width * 2}
      height={height * 2}
      onPointerDown={(e) => {
        e.stopPropagation();
        drawingRef.current = true;
        e.currentTarget.setPointerCapture(e.pointerId);
        paintAt(e);
      }}
      onPointerMove={(e) => {
        if (!drawingRef.current) return;
        e.stopPropagation();
        paintAt(e);
      }}
      onPointerUp={(e) => {
        e.stopPropagation();
        drawingRef.current = false;
        if (canvasRef.current) {
          onMaskReady(canvasRef.current.toDataURL('image/png'));
        }
      }}
      className="absolute inset-0 w-full h-full cursor-crosshair z-20"
    />
  );
};

export const CanvasBoard: React.FC = () => {
  const {
    nodes,
    edges,
    selectedNodeIds,
    panX,
    panY,
    zoom,
    snapToGrid,
    setViewport,
    toggleSnapToGrid,
    resetViewport,
    selectNodes,
    moveNodes,
    commitNodePositions,
    connectNodes,
    deleteSelectedNodes,
    pushHistory,
    applyInpaintToNode,
    expandOutpaintNode,
    removeBgAndDecomposeLayers,
    updateNodeLayer,
    upscaleNodeHd,
    retakeNode,
    sliceContactSheetNode,
    generateFourAngleCoverage,
    convertImageToOmniVideo,
    branchVideoMultiTurn,
    executeMcpToolNode,
    sendNodeToTimeline,
    addMultiframeFromNodeOrBlank,
  } = useStudioStore();

  const boardRef = useRef<HTMLDivElement | null>(null);

  const [isPanning, setIsPanning] = useState(false);
  const [spacePressed, setSpacePressed] = useState(false);
  const panStartRef = useRef({ x: 0, y: 0, origPanX: 0, origPanY: 0 });

  const draggingNodeRef = useRef<{
    active: boolean;
    ids: string[];
    lastClientX: number;
    lastClientY: number;
    moved: boolean;
  }>({ active: false, ids: [], lastClientX: 0, lastClientY: 0, moved: false });

  const [marquee, setMarquee] = useState<{
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  } | null>(null);

  const [draftEdge, setDraftEdge] = useState<{
    sourceId: string;
    startX: number;
    startY: number;
    currX: number;
    currY: number;
  } | null>(null);

  const [activeSubTool, setActiveSubTool] = useState<
    'none' | 'inpaint' | 'outpaint' | 'layers' | 'upscale' | 'branch'
  >('none');
  const [inpaintPrompt, setInpaintPrompt] = useState(
    'Glowing holographic cyber-visor & neon raindrop speculars'
  );
  const [brushSize, setBrushSize] = useState(26);
  const [maskDataUrl, setMaskDataUrl] = useState<string>('');
  const [clearMaskCounter, setClearMaskCounter] = useState(0);
  const [branchPrompt, setBranchPrompt] = useState(
    'Shift street lighting to crimson cyberpunk neon rain, orbit camera 90° right, keep @Hero_Kael motion locked'
  );
  const [playingNodeIds, setPlayingNodeIds] = useState<Record<string, boolean>>({
    'node-video-omni-1': true,
  });

  const primarySelectedNode =
    selectedNodeIds.length === 1
      ? nodes.find((n) => n.id === selectedNodeIds[0])
      : undefined;

  useEffect(() => {
    setActiveSubTool('none');
    setMaskDataUrl('');
  }, [primarySelectedNode?.id]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const inInput =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);

      if (e.code === 'Space' && !inInput) {
        setSpacePressed(true);
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && !inInput) {
        deleteSelectedNodes();
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z' && !inInput) {
        e.preventDefault();
        if (e.shiftKey) {
          useStudioStore.getState().redo();
        } else {
          useStudioStore.getState().undo();
        }
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') setSpacePressed(false);
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [deleteSelectedNodes]);

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const rect = boardRef.current?.getBoundingClientRect();
    if (!rect) return;

    if (e.ctrlKey || e.metaKey || Math.abs(e.deltaY) > 45) {
      const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
      const nextZoom = Math.min(2.4, Math.max(0.22, zoom * zoomFactor));
      const cursorX = e.clientX - rect.left;
      const cursorY = e.clientY - rect.top;
      const worldX = (cursorX - panX) / zoom;
      const worldY = (cursorY - panY) / zoom;
      const nextPanX = cursorX - worldX * nextZoom;
      const nextPanY = cursorY - worldY * nextZoom;
      setViewport(nextPanX, nextPanY, nextZoom);
    } else {
      setViewport(panX - e.deltaX, panY - e.deltaY, zoom);
    }
  };

  const clientToWorld = (clientX: number, clientY: number) => {
    const rect = boardRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: (clientX - rect.left - panX) / zoom,
      y: (clientY - rect.top - panY) / zoom,
    };
  };

  const handleBoardPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.target !== boardRef.current && !(e.target as HTMLElement).dataset.canvasBg) {
      return;
    }

    if (e.shiftKey) {
      const pt = clientToWorld(e.clientX, e.clientY);
      setMarquee({ x1: pt.x, y1: pt.y, x2: pt.x, y2: pt.y });
      return;
    }

    if (!spacePressed && e.button === 0) {
      selectNodes([]);
    }
    setIsPanning(true);
    panStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      origPanX: panX,
      origPanY: panY,
    };
  };

  const handleBoardPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isPanning) {
      const dx = e.clientX - panStartRef.current.x;
      const dy = e.clientY - panStartRef.current.y;
      setViewport(
        panStartRef.current.origPanX + dx,
        panStartRef.current.origPanY + dy,
        zoom
      );
      return;
    }

    if (marquee) {
      const pt = clientToWorld(e.clientX, e.clientY);
      setMarquee((m) => (m ? { ...m, x2: pt.x, y2: pt.y } : null));
      return;
    }

    if (draftEdge) {
      const pt = clientToWorld(e.clientX, e.clientY);
      setDraftEdge((de) => (de ? { ...de, currX: pt.x, currY: pt.y } : null));
      return;
    }

    if (draggingNodeRef.current.active) {
      const dx = (e.clientX - draggingNodeRef.current.lastClientX) / zoom;
      const dy = (e.clientY - draggingNodeRef.current.lastClientY) / zoom;
      if (Math.abs(dx) > 0.2 || Math.abs(dy) > 0.2) {
        if (!draggingNodeRef.current.moved) {
          pushHistory();
          draggingNodeRef.current.moved = true;
        }
        moveNodes(draggingNodeRef.current.ids, dx, dy);
        draggingNodeRef.current.lastClientX = e.clientX;
        draggingNodeRef.current.lastClientY = e.clientY;
      }
    }
  };

  const handleBoardPointerUp = () => {
    if (isPanning) setIsPanning(false);

    if (marquee) {
      const minX = Math.min(marquee.x1, marquee.x2);
      const maxX = Math.max(marquee.x1, marquee.x2);
      const minY = Math.min(marquee.y1, marquee.y2);
      const maxY = Math.max(marquee.y1, marquee.y2);
      const hitIds = nodes
        .filter(
          (n) =>
            n.x + n.width >= minX &&
            n.x <= maxX &&
            n.y + n.height >= minY &&
            n.y <= maxY
        )
        .map((n) => n.id);
      selectNodes(hitIds);
      setMarquee(null);
    }

    if (draftEdge) {
      setDraftEdge(null);
    }

    if (draggingNodeRef.current.active) {
      if (draggingNodeRef.current.moved) {
        commitNodePositions();
      }
      draggingNodeRef.current.active = false;
    }
  };

  const renderEdgeStroke = (kind: CanvasEdge['kind']) => {
    switch (kind) {
      case 'style-dna':
        return '#F43F5E';
      case 'multi-turn-branch':
        return '#38BDF8';
      case 'grid-slice':
        return '#A855F7';
      case 'mcp-pipe':
        return '#10B981';
      default:
        return '#8B5CF6';
    }
  };

  const buildBezierPath = (x1: number, y1: number, x2: number, y2: number) => {
    const dist = Math.max(60, Math.abs(x2 - x1) * 0.48);
    return `M ${x1} ${y1} C ${x1 + dist} ${y1}, ${x2 - dist} ${y2}, ${x2} ${y2}`;
  };

  return (
    <div
      ref={boardRef}
      data-canvas-bg="true"
      onWheel={handleWheel}
      onPointerDown={handleBoardPointerDown}
      onPointerMove={handleBoardPointerMove}
      onPointerUp={handleBoardPointerUp}
      className={`relative w-full h-full overflow-hidden bg-[#07080C] ${
        isPanning || spacePressed ? 'cursor-grabbing' : 'cursor-default'
      }`}
      style={{
        backgroundImage: snapToGrid
          ? `radial-gradient(rgba(148, 163, 184, 0.16) 1px, transparent 1px)`
          : 'none',
        backgroundSize: `${24 * zoom}px ${24 * zoom}px`,
        backgroundPosition: `${panX}px ${panY}px`,
      }}
    >
      <div
        data-canvas-bg="true"
        style={{
          transform: `translate(${panX}px, ${panY}px) scale(${zoom})`,
          transformOrigin: '0 0',
        }}
        className="absolute top-0 left-0 w-[6000px] h-[4000px] pointer-events-none"
      >
        <svg className="absolute top-0 left-0 w-[6000px] h-[4000px] overflow-visible pointer-events-none">
          <defs>
            <filter id="edge-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="2.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {edges.map((edge) => {
            const src = nodes.find((n) => n.id === edge.sourceId);
            const dst = nodes.find((n) => n.id === edge.targetId);
            if (!src || !dst) return null;
            const x1 = src.x + src.width;
            const y1 = src.y + src.height / 2 + 16;
            const x2 = dst.x;
            const y2 = dst.y + dst.height / 2 + 16;
            const path = buildBezierPath(x1, y1, x2, y2);
            const color = renderEdgeStroke(edge.kind);
            const midX = (x1 + x2) / 2;
            const midY = (y1 + y2) / 2;

            return (
              <g key={edge.id}>
                <path
                  d={path}
                  fill="none"
                  stroke={color}
                  strokeOpacity={0.22}
                  strokeWidth={5}
                  filter="url(#edge-glow)"
                />
                <path
                  d={path}
                  fill="none"
                  stroke={color}
                  strokeWidth={2}
                  className="animate-edge-flow"
                />
                {edge.label && (
                  <g transform={`translate(${midX}, ${midY})`}>
                    <rect
                      x={-(edge.label.length * 3.3 + 10)}
                      y={-10}
                      width={edge.label.length * 6.6 + 20}
                      height={20}
                      rx={6}
                      fill="#0C0E14"
                      stroke={color}
                      strokeOpacity={0.55}
                      strokeWidth={1}
                    />
                    <text
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill="#E2E8F0"
                      fontSize="10"
                      fontFamily="JetBrains Mono, monospace"
                    >
                      {edge.label}
                    </text>
                  </g>
                )}
              </g>
            );
          })}

          {draftEdge && (
            <path
              d={buildBezierPath(
                draftEdge.startX,
                draftEdge.startY,
                draftEdge.currX,
                draftEdge.currY
              )}
              fill="none"
              stroke="#38BDF8"
              strokeWidth={2.5}
              strokeDasharray="5 5"
            />
          )}

          {marquee && (
            <rect
              x={Math.min(marquee.x1, marquee.x2)}
              y={Math.min(marquee.y1, marquee.y2)}
              width={Math.abs(marquee.x2 - marquee.x1)}
              height={Math.abs(marquee.y2 - marquee.y1)}
              fill="rgba(139, 92, 246, 0.14)"
              stroke="#8B5CF6"
              strokeWidth={1.5}
              strokeDasharray="4 4"
            />
          )}
        </svg>

        {nodes.map((node) => {
          const isSelected = selectedNodeIds.includes(node.id);
          const isPrimary = primarySelectedNode?.id === node.id;
          const fgLayer = node.layers.find((l) => l.id === 'fg');
          const bgLayer = node.layers.find((l) => l.id === 'bg');
          const maskLayer = node.layers.find((l) => l.id === 'mask');
          const textLayer = node.layers.find((l) => l.id === 'text');
          const hasSplitBgRemoved = Boolean(fgLayer?.bgRemoved);

          return (
            <div
              key={node.id}
              style={{
                left: node.x,
                top: node.y,
                width: node.width,
              }}
              onPointerDown={(e) => {
                if (spacePressed) return;
                e.stopPropagation();
                const nextSelection = e.shiftKey
                  ? selectedNodeIds.includes(node.id)
                    ? selectedNodeIds
                    : [...selectedNodeIds, node.id]
                  : selectedNodeIds.includes(node.id) && selectedNodeIds.length > 1
                  ? selectedNodeIds
                  : [node.id];

                if (e.shiftKey) {
                  selectNodes([node.id], true);
                } else if (!selectedNodeIds.includes(node.id)) {
                  selectNodes([node.id], false);
                }

                draggingNodeRef.current = {
                  active: true,
                  ids: nextSelection,
                  lastClientX: e.clientX,
                  lastClientY: e.clientY,
                  moved: false,
                };
              }}
              className={`absolute pointer-events-auto rounded-2xl transition-shadow duration-150 ${
                isSelected
                  ? 'ring-2 ring-violet-400 shadow-glow-dream z-30'
                  : 'ring-1 ring-slate-700/60 hover:ring-slate-500/80 z-10'
              } bg-[#0D1017]/95 backdrop-blur-md`}
            >
              {isPrimary && node.kind !== 'style-dna' && node.kind !== 'mcp-tool' && (
                <div
                  onPointerDown={(e) => e.stopPropagation()}
                  className="absolute -top-14 left-1/2 -translate-x-1/2 flex items-center gap-1 px-2 py-1.5 rounded-xl bg-[#111520]/95 border border-violet-500/40 shadow-2xl backdrop-blur-xl whitespace-nowrap z-50"
                >
                  <button
                    onClick={() =>
                      setActiveSubTool(activeSubTool === 'inpaint' ? 'none' : 'inpaint')
                    }
                    title="Interactive Brush Mask + Regional Redraw"
                    className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium transition ${
                      activeSubTool === 'inpaint'
                        ? 'bg-pink-500/25 text-pink-200 border border-pink-400/50'
                        : 'text-slate-200 hover:bg-slate-800'
                    }`}
                  >
                    <Brush className="w-3.5 h-3.5 text-pink-400" />
                    <span>🖌️ Inpaint</span>
                  </button>

                  <button
                    onClick={() =>
                      setActiveSubTool(activeSubTool === 'outpaint' ? 'none' : 'outpaint')
                    }
                    title="Expand Aspect Ratio & Outpaint Boundaries"
                    className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium transition ${
                      activeSubTool === 'outpaint'
                        ? 'bg-sky-500/25 text-sky-200 border border-sky-400/50'
                        : 'text-slate-200 hover:bg-slate-800'
                    }`}
                  >
                    <Maximize2 className="w-3.5 h-3.5 text-sky-400" />
                    <span>⤢ Expand</span>
                  </button>

                  <button
                    onClick={() =>
                      setActiveSubTool(activeSubTool === 'layers' ? 'none' : 'layers')
                    }
                    title="Remove BG & Non-Destructive Layer Stack"
                    className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium transition ${
                      activeSubTool === 'layers'
                        ? 'bg-emerald-500/25 text-emerald-200 border border-emerald-400/50'
                        : 'text-slate-200 hover:bg-slate-800'
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5 text-emerald-400" />
                    <span>✂️ Remove BG & Layers</span>
                  </button>

                  <div className="w-px h-4 bg-slate-700/70 mx-0.5" />

                  <button
                    onClick={() =>
                      upscaleNodeHd(node.id, node.resolution === '2K' ? '4K' : '2K')
                    }
                    title="HD Upscale (2K / 4K Master)"
                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium text-slate-200 hover:bg-slate-800 transition"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>💎 {node.resolution === '2K' ? '4K' : '2K'}</span>
                  </button>

                  <button
                    onClick={() => retakeNode(node.id)}
                    title="Retake Shot (New Seed, Locked @Elements)"
                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium text-slate-200 hover:bg-slate-800 transition"
                  >
                    <Dice5 className="w-3.5 h-3.5 text-violet-400" />
                    <span>🎲 Retake</span>
                  </button>

                  <div className="w-px h-4 bg-slate-700/70 mx-0.5" />

                  <button
                    onClick={() => sliceContactSheetNode(node.id, 3, 3)}
                    title="9-Grid Contact Sheet Slicer (3×3 → 9 Linked Frames)"
                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium bg-violet-500/15 hover:bg-violet-500/30 text-violet-200 border border-violet-500/30 transition"
                  >
                    <Grid3X3 className="w-3.5 h-3.5 text-violet-300" />
                    <span>⊞ 9-Grid Slicer</span>
                  </button>

                  <button
                    onClick={() => generateFourAngleCoverage(node.id)}
                    title="4-Angle Multi-Cam Coverage (2×2 → 4 Linked Angles)"
                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium text-slate-200 hover:bg-slate-800 transition"
                  >
                    <Camera className="w-3.5 h-3.5 text-cyan-400" />
                    <span>4-Angle</span>
                  </button>

                  <div className="w-px h-4 bg-slate-700/70 mx-0.5" />

                  <button
                    onClick={() => convertImageToOmniVideo(node.id, 15)}
                    title="Synthesize 15s Gemini Omni 1.2 Flash Shot"
                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium bg-sky-500/15 hover:bg-sky-500/30 text-sky-200 border border-sky-400/30 transition"
                  >
                    <Clapperboard className="w-3.5 h-3.5 text-sky-300" />
                    <span>🎬 15s Omni</span>
                  </button>

                  <button
                    onClick={() =>
                      setActiveSubTool(activeSubTool === 'branch' ? 'none' : 'branch')
                    }
                    title="Stateful Multi-Turn Video Branch (previous_interaction_id)"
                    className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium transition ${
                      activeSubTool === 'branch'
                        ? 'bg-cyan-500/30 text-cyan-100 border border-cyan-400/60'
                        : 'text-cyan-200 hover:bg-slate-800'
                    }`}
                  >
                    <GitBranch className="w-3.5 h-3.5 text-cyan-400" />
                    <span>🌿 Multi-Turn</span>
                  </button>
                </div>
              )}

              {isPrimary && activeSubTool === 'inpaint' && (
                <div
                  onPointerDown={(e) => e.stopPropagation()}
                  className="absolute -top-44 left-0 w-[370px] p-3 rounded-xl bg-[#111521]/98 border border-pink-500/40 shadow-2xl z-50 space-y-2"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-pink-300 flex items-center gap-1.5">
                      <Brush className="w-3.5 h-3.5" /> Paint Mask Directly on Frame Below
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-400 font-mono">
                        Brush {brushSize}px
                      </span>
                      <input
                        type="range"
                        min={10}
                        max={64}
                        value={brushSize}
                        onChange={(e) => setBrushSize(Number(e.target.value))}
                        className="w-16 accent-pink-500"
                      />
                      <button
                        onClick={() => {
                          setClearMaskCounter((c) => c + 1);
                          setMaskDataUrl('');
                        }}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 hover:text-white"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={inpaintPrompt}
                      onChange={(e) => setInpaintPrompt(e.target.value)}
                      placeholder="Describe regional redraw..."
                      className="flex-1 bg-slate-900/90 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-pink-400"
                    />
                    <button
                      onClick={async () => {
                        if (!maskDataUrl) {
                          const autoCanvas = document.createElement('canvas');
                          autoCanvas.width = node.width * 2;
                          autoCanvas.height = node.height * 2;
                          const c = autoCanvas.getContext('2d')!;
                          c.fillStyle = 'rgba(236,72,153,0.9)';
                          c.beginPath();
                          c.arc(node.width, node.height * 0.9, 95, 0, Math.PI * 2);
                          c.fill();
                          await applyInpaintToNode(
                            node.id,
                            autoCanvas.toDataURL('image/png'),
                            inpaintPrompt
                          );
                        } else {
                          await applyInpaintToNode(node.id, maskDataUrl, inpaintPrompt);
                        }
                        setActiveSubTool('none');
                      }}
                      className="px-3 py-1.5 rounded-lg bg-pink-600 hover:bg-pink-500 text-white text-xs font-semibold flex items-center gap-1"
                    >
                      <Check className="w-3.5 h-3.5" /> Redraw
                    </button>
                  </div>
                </div>
              )}

              {isPrimary && activeSubTool === 'outpaint' && (
                <div
                  onPointerDown={(e) => e.stopPropagation()}
                  className="absolute -top-28 left-1/2 -translate-x-1/2 p-2.5 rounded-xl bg-[#111521]/98 border border-sky-500/40 shadow-2xl z-50 flex items-center gap-2"
                >
                  <span className="text-[11px] font-semibold text-sky-300 px-1">
                    Expand Ratio:
                  </span>
                  {(['16:9', '21:9', '9:16', '1:1'] as AspectRatio[]).map((ratio) => (
                    <button
                      key={ratio}
                      onClick={async () => {
                        await expandOutpaintNode(node.id, ratio);
                        setActiveSubTool('none');
                      }}
                      className={`px-2.5 py-1 rounded-lg text-xs font-mono font-medium transition ${
                        node.aspectRatio === ratio
                          ? 'bg-sky-500 text-slate-950 font-bold'
                          : 'bg-slate-800 text-slate-200 hover:bg-sky-500/25'
                      }`}
                    >
                      {ratio}
                    </button>
                  ))}
                </div>
              )}

              {isPrimary && activeSubTool === 'layers' && (
                <div
                  onPointerDown={(e) => e.stopPropagation()}
                  className="absolute -right-[275px] top-0 w-[264px] p-3 rounded-xl bg-[#111521]/98 border border-emerald-500/40 shadow-2xl z-50 space-y-2.5"
                >
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="text-xs font-semibold text-emerald-300 flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5" /> Non-Destructive Layers
                    </span>
                    <button
                      onClick={() => setActiveSubTool('none')}
                      className="text-slate-400 hover:text-white"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <button
                    onClick={() => removeBgAndDecomposeLayers(node.id)}
                    className="w-full py-1.5 px-2.5 rounded-lg bg-emerald-600/25 hover:bg-emerald-600/40 border border-emerald-500/40 text-emerald-200 text-xs font-medium flex items-center justify-center gap-1.5 transition"
                  >
                    <Scissors className="w-3.5 h-3.5" />
                    <span>Isolate Subject (Remove BG)</span>
                  </button>

                  <div className="space-y-1.5">
                    {node.layers.map((layer) => (
                      <div
                        key={layer.id}
                        className="p-2 rounded-lg bg-slate-900/90 border border-slate-800 space-y-1.5"
                      >
                        <div className="flex items-center justify-between text-[11px]">
                          <button
                            onClick={() =>
                              updateNodeLayer(node.id, layer.id as FrameLayerType, {
                                visible: !layer.visible,
                              })
                            }
                            className="flex items-center gap-1.5 text-slate-200 hover:text-white font-medium"
                          >
                            {layer.visible ? (
                              <Eye className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <EyeOff className="w-3.5 h-3.5 text-slate-500" />
                            )}
                            <span>{layer.name}</span>
                          </button>
                          <span className="font-mono text-[10px] text-slate-400">
                            {layer.opacity}%
                          </span>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          value={layer.opacity}
                          onChange={(e) =>
                            updateNodeLayer(node.id, layer.id as FrameLayerType, {
                              opacity: Number(e.target.value),
                            })
                          }
                          className="w-full h-1 accent-emerald-400"
                        />
                        {layer.id === 'text' && (
                          <input
                            type="text"
                            value={layer.textContent || ''}
                            onChange={(e) =>
                              updateNodeLayer(node.id, 'text', {
                                visible: true,
                                textContent: e.target.value,
                              })
                            }
                            placeholder="Title graphic text..."
                            className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-[11px] text-slate-200"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {isPrimary && activeSubTool === 'branch' && (
                <div
                  onPointerDown={(e) => e.stopPropagation()}
                  className="absolute -top-36 left-0 w-[390px] p-3 rounded-xl bg-[#111521]/98 border border-cyan-500/45 shadow-2xl z-50 space-y-2"
                >
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-cyan-300 flex items-center gap-1.5">
                      <GitBranch className="w-3.5 h-3.5" /> Multi-Turn Stateful Video Branch
                    </span>
                    <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-500/30">
                      prev_id: {node.interactionId || `int_omni_${node.seed}`}
                    </span>
                  </div>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={branchPrompt}
                      onChange={(e) => setBranchPrompt(e.target.value)}
                      placeholder="Conversational edit delta (lighting, camera, weather)..."
                      className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-cyan-400"
                    />
                    <button
                      onClick={async () => {
                        await branchVideoMultiTurn(node.id, branchPrompt);
                        setActiveSubTool('none');
                      }}
                      className="px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold"
                    >
                      Branch
                    </button>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800/80">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      node.kind === 'style-dna'
                        ? 'bg-rose-400'
                        : node.kind === 'video'
                        ? 'bg-sky-400'
                        : node.kind === 'contact-sheet'
                        ? 'bg-violet-400'
                        : node.kind === 'mcp-tool'
                        ? 'bg-emerald-400'
                        : 'bg-amber-400'
                    }`}
                  />
                  <span className="text-xs font-semibold text-slate-100 truncate">
                    {node.title}
                  </span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800/90 text-slate-300">
                    {node.kind === 'style-dna'
                      ? 'DNA LOCK'
                      : node.kind === 'mcp-tool'
                      ? 'MCP'
                      : `${node.aspectRatio} · ${node.resolution}`}
                  </span>
                </div>
              </div>

              {node.kind === 'style-dna' && node.styleDna ? (
                <div className="p-3 space-y-2.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-medium text-rose-300 flex items-center gap-1">
                      <Lock className="w-3 h-3" /> {node.styleDna.presetName}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {node.styleDna.palette.map((hex, idx) => (
                      <div key={idx} className="flex-1 space-y-1 text-center">
                        <div
                          className="h-7 rounded-md border border-white/15 shadow-inner"
                          style={{ backgroundColor: hex }}
                        />
                        <span className="block font-mono text-[9px] text-slate-400">
                          {hex}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-1 gap-1 text-[11px] bg-slate-900/80 p-2 rounded-lg border border-slate-800/80">
                    <div className="truncate">
                      <span className="text-slate-400">Light: </span>
                      <span className="text-slate-200">{node.styleDna.lighting}</span>
                    </div>
                    <div className="truncate">
                      <span className="text-slate-400">Lens: </span>
                      <span className="text-slate-200">{node.styleDna.lens}</span>
                    </div>
                    <div className="truncate">
                      <span className="text-slate-400">Stock: </span>
                      <span className="text-slate-200">{node.styleDna.filmStock}</span>
                    </div>
                  </div>
                </div>
              ) : node.kind === 'mcp-tool' && node.mcpTool ? (
                <div className="p-3 space-y-2.5 text-xs">
                  <div className="flex items-center gap-1.5 text-emerald-300 font-mono text-[11px]">
                    <Workflow className="w-3.5 h-3.5" />
                    <span>{node.mcpTool.serverUrl}</span>
                  </div>
                  <p className="text-slate-300 text-[11px] leading-relaxed">
                    {node.mcpTool.description}
                  </p>
                  <button
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={() => executeMcpToolNode(node.id)}
                    className="w-full py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs flex items-center justify-center gap-1.5 transition"
                  >
                    <Wand2 className="w-3.5 h-3.5" /> Invoke MCP `tools/call`
                  </button>
                </div>
              ) : (
                <div
                  style={{ height: node.height }}
                  className="relative w-full overflow-hidden bg-[#090C14]"
                >
                  <div
                    className="absolute inset-0"
                    style={{
                      backgroundImage:
                        'linear-gradient(45deg, #161b26 25%, transparent 25%), linear-gradient(-45deg, #161b26 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #161b26 75%), linear-gradient(-45deg, transparent 75%, #161b26 75%)',
                      backgroundSize: '16px 16px',
                      backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px',
                    }}
                  />

                  {node.kind === 'video' ? (
                    <LiveVideoNodeSurface
                      node={node}
                      playing={Boolean(playingNodeIds[node.id])}
                    />
                  ) : hasSplitBgRemoved ? (
                    <>
                      {bgLayer?.visible && bgLayer.dataUrl && (
                        <img
                          src={bgLayer.dataUrl}
                          alt="Background Plate"
                          style={{ opacity: (bgLayer.opacity ?? 100) / 100 }}
                          className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                        />
                      )}
                      {fgLayer?.visible && fgLayer.dataUrl && (
                        <img
                          src={fgLayer.dataUrl}
                          alt="Isolated Subject"
                          style={{ opacity: (fgLayer.opacity ?? 100) / 100 }}
                          className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                        />
                      )}
                    </>
                  ) : (
                    node.imageUrl &&
                    fgLayer?.visible !== false && (
                      <img
                        src={node.imageUrl}
                        alt={node.title}
                        style={{ opacity: (fgLayer?.opacity ?? 100) / 100 }}
                        className="relative w-full h-full object-cover pointer-events-none"
                        draggable={false}
                      />
                    )
                  )}

                  {maskLayer && !maskLayer.visible && (
                    <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-slate-900/80 text-[10px] text-slate-400">
                      Inpaint Mask Hidden
                    </div>
                  )}

                  {textLayer?.visible && textLayer.textContent && (
                    <div
                      style={{ opacity: textLayer.opacity / 100 }}
                      className="absolute inset-x-3 bottom-9 text-center pointer-events-none"
                    >
                      <span className="px-3 py-1 rounded bg-black/70 border border-white/15 font-mono font-bold tracking-widest text-xs text-white uppercase shadow-lg">
                        {textLayer.textContent}
                      </span>
                    </div>
                  )}

                  {isPrimary && activeSubTool === 'inpaint' && (
                    <InpaintMaskCanvas
                      width={node.width}
                      height={node.height}
                      brushSize={brushSize}
                      onMaskReady={setMaskDataUrl}
                      clearSignal={clearMaskCounter}
                    />
                  )}

                  {node.kind === 'video' && (
                    <button
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={() =>
                        setPlayingNodeIds((p) => ({ ...p, [node.id]: !p[node.id] }))
                      }
                      className="absolute bottom-2 left-2 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/75 hover:bg-violet-600/90 text-white text-[11px] font-mono backdrop-blur-md transition z-10"
                    >
                      {playingNodeIds[node.id] ? (
                        <Pause className="w-3 h-3" />
                      ) : (
                        <Play className="w-3 h-3" />
                      )}
                      <span>{node.durationSec || 15}s Omni</span>
                    </button>
                  )}

                  {node.kind === 'contact-sheet' && (
                    <button
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={() =>
                        sliceContactSheetNode(
                          node.id,
                          node.gridSpec?.rows || 3,
                          node.gridSpec?.cols || 3
                        )
                      }
                      className="absolute bottom-2 right-2 flex items-center gap-1 px-2.5 py-1 rounded-lg bg-violet-600/95 hover:bg-violet-500 text-white text-[11px] font-semibold shadow-lg transition z-10"
                    >
                      <Grid3X3 className="w-3.5 h-3.5" />
                      <span>
                        Slice {(node.gridSpec?.rows || 3) * (node.gridSpec?.cols || 3)}{' '}
                        Frames
                      </span>
                    </button>
                  )}
                </div>
              )}

              <div className="px-3 py-2 bg-[#0A0D14] rounded-b-2xl border-t border-slate-800/70 space-y-1.5">
                <p className="text-[11px] text-slate-400 line-clamp-1">{node.prompt}</p>
                <div className="flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1 flex-wrap overflow-hidden">
                    {node.elementHandles.slice(0, 3).map((h) => (
                      <span
                        key={h}
                        className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-violet-500/15 text-violet-300 border border-violet-500/25"
                      >
                        {h}
                      </span>
                    ))}
                    {node.previousInteractionId && (
                      <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-300 border border-cyan-500/25">
                        ↳ {node.previousInteractionId.slice(-6)}
                      </span>
                    )}
                  </div>

                  {node.kind !== 'style-dna' && node.kind !== 'mcp-tool' && (
                    <div
                      onPointerDown={(e) => e.stopPropagation()}
                      className="flex items-center gap-1 shrink-0"
                    >
                      <button
                        onClick={() => addMultiframeFromNodeOrBlank(node.id)}
                        title="Add Keyframe to Smart Multiframes Chain"
                        className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-violet-300 transition"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => sendNodeToTimeline(node.id)}
                        title="Append Shot to Rough-Cut Timeline"
                        className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-800/90 hover:bg-violet-600/80 text-[10px] text-slate-200 hover:text-white transition"
                      >
                        <Film className="w-3 h-3" />
                        <span>Timeline</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div
                onPointerUp={(e) => {
                  e.stopPropagation();
                  if (draftEdge && draftEdge.sourceId !== node.id) {
                    connectNodes(draftEdge.sourceId, node.id);
                    setDraftEdge(null);
                  }
                }}
                title="Drop connection here"
                className="absolute -left-2 top-1/2 w-4 h-4 rounded-full bg-slate-900 border-2 border-slate-500 hover:border-cyan-400 hover:scale-125 transition cursor-crosshair"
              />

              <div
                onPointerDown={(e) => {
                  e.stopPropagation();
                  const startX = node.x + node.width;
                  const startY = node.y + node.height / 2 + 16;
                  setDraftEdge({
                    sourceId: node.id,
                    startX,
                    startY,
                    currX: startX,
                    currY: startY,
                  });
                }}
                title="Drag to connect to another frame"
                className="absolute -right-2 top-1/2 w-4 h-4 rounded-full bg-violet-500 border-2 border-slate-950 hover:bg-cyan-400 hover:scale-125 transition cursor-crosshair shadow"
              />
            </div>
          );
        })}
      </div>

      <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#0D1017]/90 border border-slate-800/80 backdrop-blur-md text-xs text-slate-300 z-30">
        <button
          onClick={() => setViewport(panX, panY, zoom * 0.85)}
          className="px-1.5 py-0.5 rounded hover:bg-slate-800 font-mono"
          title="Zoom Out"
        >
          −
        </button>
        <span className="font-mono text-[11px] w-12 text-center">
          {Math.round(zoom * 100)}%
        </span>
        <button
          onClick={() => setViewport(panX, panY, zoom * 1.15)}
          className="px-1.5 py-0.5 rounded hover:bg-slate-800 font-mono"
          title="Zoom In"
        >
          +
        </button>
        <div className="w-px h-3.5 bg-slate-700 mx-0.5" />
        <button
          onClick={resetViewport}
          className="px-2 py-0.5 rounded hover:bg-slate-800 text-[11px]"
        >
          Fit
        </button>
        <button
          onClick={toggleSnapToGrid}
          className={`px-2 py-0.5 rounded text-[11px] transition ${
            snapToGrid
              ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
              : 'text-slate-400 hover:bg-slate-800'
          }`}
        >
          Snap Grid
        </button>
        {selectedNodeIds.length > 1 && (
          <span className="ml-1 px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-mono text-[10px]">
            {selectedNodeIds.length} Selected
          </span>
        )}
        {selectedNodeIds.length > 0 && (
          <button
            onClick={deleteSelectedNodes}
            title="Delete selected nodes"
            className="p-1 rounded hover:bg-rose-500/20 text-slate-400 hover:text-rose-400"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div className="hidden xl:flex absolute top-3 right-3 items-center gap-3 px-3 py-1.5 rounded-xl bg-[#0D1017]/85 border border-slate-800/80 backdrop-blur-md text-[11px] text-slate-400 z-20">
        <span>Scroll/Space: Pan</span>
        <span>·</span>
        <span>Shift+Drag: Multi-Select</span>
        <span>·</span>
        <span>Drag Port ●→●: Link Style DNA / Branch</span>
      </div>
    </div>
  );
};
