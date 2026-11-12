import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Download,
  Film,
  Loader2,
  Maximize2,
  Mic,
  Pause,
  Play,
  Plus,
  Scissors,
  SkipBack,
  Sparkles,
  Trash2,
  Volume2,
  VolumeX,
  Waves,
} from 'lucide-react';
import type { CanvasNode } from '../types/studio';
import { useStudioStore } from '../store/useStudioStore';
import { SmartMediaImage } from './SmartMedia';
import {
  compileTimelineToWebm,
  downloadTextFile,
  generateFcpxmlDocument,
} from '../utils/exporters';

function formatTimecode(sec: number): string {
  const clamped = Math.max(0, Math.floor(sec));
  const mins = Math.floor(clamped / 60);
  const rem = clamped % 60;
  return `${String(mins).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
}

export const TimelinePlaybackEngine: React.FC = () => {
  const isPlaying = useStudioStore((s) => s.isPlayingTimeline);
  const timelineClips = useStudioStore((s) => s.timelineClips);
  const setPlayheadSec = useStudioStore((s) => s.setPlayheadSec);
  const setIsPlaying = useStudioStore((s) => s.setIsPlayingTimeline);

  const totalSec = useMemo(() => {
    const maxEnd = timelineClips.reduce(
      (acc, c) => Math.max(acc, c.startSec + c.durationSec),
      0
    );
    return Math.max(6, maxEnd);
  }, [timelineClips]);

  useEffect(() => {
    if (!isPlaying) return;
    let rafId = 0;
    let lastTs = performance.now();

    const tick = (now: number) => {
      const dt = (now - lastTs) / 1000;
      lastTs = now;
      const cur = useStudioStore.getState().playheadSec;
      const next = cur + dt;
      if (next >= totalSec) {
        setPlayheadSec(0);
        setIsPlaying(false);
        return;
      }
      setPlayheadSec(next);
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [isPlaying, totalSec, setPlayheadSec, setIsPlaying]);

  return null;
};

export const TimelineCanvasNode: React.FC<{ node: CanvasNode }> = ({ node }) => {
  const timelineClips = useStudioStore((s) => s.timelineClips);
  const nodes = useStudioStore((s) => s.nodes);
  const playheadSec = useStudioStore((s) => s.playheadSec);
  const isPlaying = useStudioStore((s) => s.isPlayingTimeline);
  const timelineMuted = useStudioStore((s) => s.timelineMuted);
  const isRenderingMasterMp4 = useStudioStore((s) => s.isRenderingMasterMp4);

  const setPlayheadSec = useStudioStore((s) => s.setPlayheadSec);
  const setIsPlaying = useStudioStore((s) => s.setIsPlayingTimeline);
  const setTimelineMuted = useStudioStore((s) => s.setTimelineMuted);
  const setFullscreenTimelineOpen = useStudioStore((s) => s.setFullscreenTimelineOpen);
  const splitTimelineClipAtPlayhead = useStudioStore((s) => s.splitTimelineClipAtPlayhead);
  const removeTimelineClip = useStudioStore((s) => s.removeTimelineClip);
  const sendNodeToTimeline = useStudioStore((s) => s.sendNodeToTimeline);
  const setAssetDrawerOpen = useStudioStore((s) => s.setAssetDrawerOpen);
  const compileTimelineMasterMp4 = useStudioStore((s) => s.compileTimelineMasterMp4);

  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const rulerRef = useRef<HTMLDivElement | null>(null);

  const videoClips = useMemo(
    () =>
      timelineClips
        .filter((c) => c.track === 'video')
        .sort((a, b) => a.startSec - b.startSec),
    [timelineClips]
  );

  const totalDurationSec = useMemo(() => {
    const end = timelineClips.reduce(
      (acc, c) => Math.max(acc, c.startSec + c.durationSec),
      0
    );
    return Math.max(18, end);
  }, [timelineClips]);

  const rulerSpanSec = Math.max(30, Math.ceil(totalDurationSec / 5) * 5);
  const ticks = useMemo(() => {
    const out: number[] = [];
    for (let t = 0; t <= rulerSpanSec; t += 5) {
      out.push(t);
    }
    return out;
  }, [rulerSpanSec]);

  const handleRulerPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const el = rulerRef.current;
    if (!el) return;
    const updateFromClientX = (clientX: number) => {
      const rect = el.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / Math.max(1, rect.width)));
      setPlayheadSec(ratio * rulerSpanSec);
    };
    updateFromClientX(e.clientX);

    const onMove = (ev: PointerEvent) => updateFromClientX(ev.clientX);
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const handleAppendAvailableMedia = (e: React.MouseEvent) => {
    e.stopPropagation();
    const candidate = nodes.find(
      (n) =>
        (n.kind === 'video' || n.kind === 'image') &&
        !videoClips.some((vc) => vc.sourceNodeId === n.id)
    );
    if (candidate) {
      sendNodeToTimeline(candidate.id);
    } else {
      const firstMedia = nodes.find((n) => n.kind === 'video' || n.kind === 'image');
      if (firstMedia) {
        sendNodeToTimeline(firstMedia.id);
      } else {
        setAssetDrawerOpen(true);
      }
    }
  };

  const playheadLeftPct = Math.min(100, Math.max(0, (playheadSec / rulerSpanSec) * 100));

  return (
    <div
      className="w-full h-full bg-[#191919] text-[#f5f5f5] flex flex-col select-none overflow-hidden rounded-[12px]"
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragOver(false);
        const nodeId = e.dataTransfer.getData('text/dreamflow-node-id');
        if (nodeId) {
          sendNodeToTimeline(nodeId);
        }
      }}
    >
      {/* Row 1: Header Bar (38px) */}
      <div
        className="h-[38px] px-3.5 border-b border-white/[0.06] flex items-center justify-between bg-[#191919] shrink-0"
        onPointerDown={(e) => e.stopPropagation()}
      >
        {/* Left: Split & Delete */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => splitTimelineClipAtPlayhead(selectedClipId || undefined)}
            title="Split clip at playhead"
            className="w-7 h-7 rounded-[7px] flex items-center justify-center text-white/65 hover:text-white hover:bg-[#252525] transition-colors"
          >
            <Scissors className="w-3.5 h-3.5" strokeWidth={1.5} />
          </button>
          <button
            type="button"
            onClick={() => {
              const target =
                selectedClipId || videoClips[videoClips.length - 1]?.id;
              if (target) {
                removeTimelineClip(target);
                setSelectedClipId(null);
              }
            }}
            title="Delete selected clip"
            className="w-7 h-7 rounded-[7px] flex items-center justify-center text-white/65 hover:text-white hover:bg-[#252525] transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
          </button>
        </div>

        {/* Center: Play/Pause + Tabular Timecode */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setIsPlaying(!isPlaying)}
            className="w-7 h-7 rounded-full bg-[#252525] hover:bg-[#303030] flex items-center justify-center text-white transition-colors"
            title={isPlaying ? 'Pause timeline' : 'Play timeline'}
          >
            {isPlaying ? (
              <Pause className="w-3.5 h-3.5" strokeWidth={1.75} />
            ) : (
              <Play className="w-3.5 h-3.5 ml-0.5" strokeWidth={1.75} />
            )}
          </button>
          <span className="font-mono text-[12px] tabular-nums text-white/80 tracking-tight">
            {formatTimecode(playheadSec)}{' '}
            <span className="text-white/35">/ {formatTimecode(totalDurationSec)}</span>
          </span>
        </div>

        {/* Right: Download + Edit in full screen */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={isRenderingMasterMp4}
            onClick={() => void compileTimelineMasterMp4()}
            title="Render & Download Master .mp4 via FFmpeg 8.0"
            className="w-7 h-7 rounded-[7px] flex items-center justify-center text-white/70 hover:text-white hover:bg-[#252525] transition-colors disabled:opacity-50"
          >
            {isRenderingMasterMp4 ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={1.5} />
            ) : (
              <Download className="w-3.5 h-3.5" strokeWidth={1.5} />
            )}
          </button>
          <button
            type="button"
            onClick={() => setFullscreenTimelineOpen(true)}
            className="h-7 px-2.5 rounded-[8px] bg-[#252525] hover:bg-[#2e2e2e] border border-white/[0.06] text-[12px] font-medium text-white/90 flex items-center gap-1.5 transition-colors"
          >
            <Maximize2 className="w-3 h-3 text-white/70" strokeWidth={1.5} />
            <span>Edit in full screen</span>
          </button>
        </div>
      </div>

      {/* Row 2 + Row 3 Wrapper for continuous playhead */}
      <div className="relative flex-1 flex flex-col min-h-0">
        {/* Row 2: Timecode Ruler (22px) */}
        <div
          ref={rulerRef}
          onPointerDown={handleRulerPointerDown}
          className="h-[22px] pl-10 pr-3 bg-[#141414] border-b border-white/[0.05] relative flex items-center cursor-ew-resize shrink-0"
        >
          <div className="relative w-full h-full flex items-center justify-between">
            {ticks.map((t) => (
              <div key={t} className="flex items-center gap-1">
                <div className="w-px h-2 bg-white/[0.14]" />
                <span className="font-mono text-[10px] tabular-nums text-white/35">
                  {formatTimecode(t)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Row 3: Track Row */}
        <div
          className={`flex-1 px-2.5 flex items-center gap-2.5 min-h-0 transition-colors ${
            dragOver ? 'bg-[#222222]' : 'bg-[#161616]'
          }`}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {/* Mute/Unmute Track Icon */}
          <button
            type="button"
            onClick={() => setTimelineMuted(!timelineMuted)}
            title={timelineMuted ? 'Unmute timeline audio' : 'Mute timeline audio'}
            className="w-7 h-7 rounded-[7px] shrink-0 flex items-center justify-center text-white/55 hover:text-white hover:bg-[#252525] transition-colors"
          >
            {timelineMuted ? (
              <VolumeX className="w-4 h-4 text-white/40" strokeWidth={1.5} />
            ) : (
              <Volume2 className="w-4 h-4" strokeWidth={1.5} />
            )}
          </button>

          {/* Horizontal Filmstrip Clips + Drop Slot */}
          <div className="relative flex-1 h-[78px] flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
            {videoClips.map((clip) => {
              const widthPx = Math.max(128, Math.round((clip.durationSec / rulerSpanSec) * 960));
              const isSelected = selectedClipId === clip.id;
              return (
                <div
                  key={clip.id}
                  style={{ width: `${widthPx}px` }}
                  onClick={() => {
                    setSelectedClipId(clip.id);
                    setPlayheadSec(clip.startSec + 0.05);
                  }}
                  onDoubleClick={() => setFullscreenTimelineOpen(true)}
                  className={`relative h-[68px] shrink-0 rounded-[8px] overflow-hidden bg-[#222222] cursor-pointer transition-all ${
                    isSelected
                      ? 'ring-1 ring-white/75 shadow-[0_4px_14px_rgba(0,0,0,0.5)]'
                      : 'border border-white/[0.09] hover:border-white/[0.25]'
                  }`}
                >
                  <SmartMediaImage
                    src={clip.thumbnailUrl}
                    alt={clip.title}
                    fallbackPrompt={clip.promptOrDialogue}
                    fallbackSeed={clip.seed || node.seed}
                    className="w-full h-full object-cover opacity-90"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/25 pointer-events-none" />
                  <div className="absolute top-1.5 left-2 right-2 flex items-center justify-between gap-1 pointer-events-none">
                    <span className="text-[11px] font-medium text-white/90 truncate">
                      {clip.title}
                    </span>
                  </div>
                  <div className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded-[5px] bg-black/65 backdrop-blur-sm font-mono text-[10px] tabular-nums text-white/85 pointer-events-none">
                    {formatTimecode(clip.durationSec)}
                  </div>
                </div>
              );
            })}

            {/* "+ Drag and drop media here" Dreamina slot */}
            <button
              type="button"
              onClick={handleAppendAvailableMedia}
              className="h-[68px] min-w-[210px] px-4 rounded-[8px] border border-dashed border-white/[0.14] hover:border-white/[0.3] bg-[#1b1b1b]/70 hover:bg-[#222222] flex items-center justify-center gap-2 text-[12px] text-white/50 hover:text-white/85 transition-colors shrink-0"
            >
              <Plus className="w-3.5 h-3.5" strokeWidth={1.5} />
              <span>Drag and drop media here</span>
            </button>

            {/* Playhead Line Overlay */}
            <div
              style={{ left: `${playheadLeftPct}%` }}
              className="absolute top-[-22px] bottom-0 w-[1.5px] bg-white pointer-events-none z-10 shadow-[0_0_8px_rgba(255,255,255,0.6)]"
            >
              <div className="w-2.5 h-2.5 rounded-full bg-white -ml-[4px] -mt-0.5" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export const FullscreenTimelineModal: React.FC = () => {
  const open = useStudioStore((s) => s.fullscreenTimelineOpen);
  const projectTitle = useStudioStore((s) => s.projectTitle);
  const timelineClips = useStudioStore((s) => s.timelineClips);
  const playheadSec = useStudioStore((s) => s.playheadSec);
  const isPlaying = useStudioStore((s) => s.isPlayingTimeline);
  const timelineMuted = useStudioStore((s) => s.timelineMuted);
  const masterRenderUrl = useStudioStore((s) => s.masterRenderUrl);
  const isRenderingMasterMp4 = useStudioStore((s) => s.isRenderingMasterMp4);

  const setOpen = useStudioStore((s) => s.setFullscreenTimelineOpen);
  const setPlayheadSec = useStudioStore((s) => s.setPlayheadSec);
  const setIsPlaying = useStudioStore((s) => s.setIsPlayingTimeline);
  const setTimelineMuted = useStudioStore((s) => s.setTimelineMuted);
  const splitTimelineClipAtPlayhead = useStudioStore((s) => s.splitTimelineClipAtPlayhead);
  const removeTimelineClip = useStudioStore((s) => s.removeTimelineClip);
  const extractLastFrameToNextShot = useStudioStore((s) => s.extractLastFrameToNextShot);
  const compileTimelineMasterMp4 = useStudioStore((s) => s.compileTimelineMasterMp4);
  const addVoiceOrSfxClip = useStudioStore((s) => s.addVoiceOrSfxClip);
  const showToast = useStudioStore((s) => s.showToast);

  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [compilingWebm, setCompilingWebm] = useState(false);
  const [webmProgress, setWebmProgress] = useState(0);

  const videoClips = useMemo(
    () =>
      timelineClips
        .filter((c) => c.track === 'video')
        .sort((a, b) => a.startSec - b.startSec),
    [timelineClips]
  );
  const voiceClips = useMemo(
    () =>
      timelineClips
        .filter((c) => c.track === 'voice')
        .sort((a, b) => a.startSec - b.startSec),
    [timelineClips]
  );
  const sfxClips = useMemo(
    () =>
      timelineClips
        .filter((c) => c.track === 'sfx')
        .sort((a, b) => a.startSec - b.startSec),
    [timelineClips]
  );

  const totalSec = useMemo(() => {
    const end = timelineClips.reduce(
      (acc, c) => Math.max(acc, c.startSec + c.durationSec),
      0
    );
    return Math.max(18, end);
  }, [timelineClips]);

  const activeClip = useMemo(() => {
    return (
      videoClips.find(
        (c) => playheadSec >= c.startSec && playheadSec < c.startSec + c.durationSec
      ) || videoClips[0]
    );
  }, [videoClips, playheadSec]);

  if (!open) return null;

  const previewVideoSrc =
    masterRenderUrl || activeClip?.videoUrl || '/media/protocol_rain_master.mp4';

  const handleExportFcpxml = () => {
    const xml = generateFcpxmlDocument(projectTitle, timelineClips);
    const slug = projectTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'timeline';
    downloadTextFile(`${slug}.fcpxml`, xml, 'application/xml');
    showToast('Exported Premiere Pro / Final Cut Pro .fcpxml sequence.');
  };

  const handleCompileWebm = async () => {
    try {
      setCompilingWebm(true);
      setWebmProgress(5);
      const blob = await compileTimelineToWebm(timelineClips, (pct) =>
        setWebmProgress(pct)
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'open-dreamflow-roughcut.webm';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      showToast(`Compiled browser .webm rough cut (${(blob.size / 1024).toFixed(0)} KB).`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to compile .webm');
    } finally {
      setCompilingWebm(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#0e0e0e] text-[#f5f5f5] flex flex-col">
      {/* Top Header */}
      <div className="h-[52px] px-4 bg-[#191919] border-b border-white/[0.08] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="h-8 px-3 rounded-[8px] bg-[#252525] hover:bg-[#2e2e2e] border border-white/[0.08] text-[12px] font-medium text-white/90 flex items-center gap-1.5 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" strokeWidth={1.5} />
            <span>Back to Canvas</span>
          </button>
          <div className="h-4 w-px bg-white/[0.08]" />
          <div className="flex items-center gap-2">
            <Film className="w-4 h-4 text-white/65" strokeWidth={1.5} />
            <span className="text-[13px] font-medium text-white/95">
              {projectTitle} · Timelines 1
            </span>
            <span className="px-2 py-0.5 rounded-[6px] bg-white/[0.06] text-[11px] font-mono text-white/60">
              {videoClips.length} shots · {formatTimecode(totalSec)}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() =>
              void extractLastFrameToNextShot(selectedClipId || activeClip?.id)
            }
            className="h-8 px-3 rounded-[8px] bg-[#252525] hover:bg-[#2e2e2e] border border-white/[0.08] text-[12px] text-white/85 flex items-center gap-1.5 transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5 text-white/70" strokeWidth={1.5} />
            <span>Last Frame → Next Shot</span>
          </button>

          <button
            type="button"
            disabled={compilingWebm}
            onClick={() => void handleCompileWebm()}
            className="h-8 px-3 rounded-[8px] bg-[#252525] hover:bg-[#2e2e2e] border border-white/[0.08] text-[12px] text-white/85 flex items-center gap-1.5 transition-colors disabled:opacity-50"
          >
            {compilingWebm ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={1.5} />
            ) : (
              <Download className="w-3.5 h-3.5 text-white/70" strokeWidth={1.5} />
            )}
            <span>{compilingWebm ? `WebM ${webmProgress}%` : 'Export .webm'}</span>
          </button>

          <button
            type="button"
            onClick={handleExportFcpxml}
            className="h-8 px-3 rounded-[8px] bg-[#252525] hover:bg-[#2e2e2e] border border-white/[0.08] text-[12px] text-white/85 transition-colors"
          >
            Export .fcpxml
          </button>

          <button
            type="button"
            disabled={isRenderingMasterMp4}
            onClick={() => void compileTimelineMasterMp4()}
            className="h-8 px-3.5 rounded-[8px] bg-white hover:bg-[#e5e5e5] text-[#0e0e0e] text-[12px] font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-60"
          >
            {isRenderingMasterMp4 ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={1.75} />
            ) : (
              <Download className="w-3.5 h-3.5" strokeWidth={1.75} />
            )}
            <span>{isRenderingMasterMp4 ? 'Rendering MP4…' : 'Render Master .mp4'}</span>
          </button>
        </div>
      </div>

      {/* Program Monitor */}
      <div className="flex-1 min-h-0 flex items-center justify-center p-6 bg-[#0e0e0e] relative">
        <div className="relative max-w-[920px] w-full aspect-video rounded-[12px] overflow-hidden bg-[#141414] border border-white/[0.1] shadow-[0_24px_60px_rgba(0,0,0,0.75)]">
          <video
            key={previewVideoSrc}
            src={previewVideoSrc}
            poster={activeClip?.thumbnailUrl || '/media/shot01_rooftop.png'}
            autoPlay
            loop
            playsInline
            muted={timelineMuted}
            controls
            className="w-full h-full object-cover"
          />
          {masterRenderUrl && (
            <a
              href={masterRenderUrl}
              download="open-dreamflow-master.mp4"
              className="absolute top-3 right-3 h-7 px-2.5 rounded-[7px] bg-[#191919]/90 hover:bg-[#252525] border border-white/[0.12] text-[11px] text-white/90 flex items-center gap-1.5 backdrop-blur-md"
            >
              <Download className="w-3 h-3" strokeWidth={1.5} />
              <span>Download Rendered MP4</span>
            </a>
          )}
        </div>
      </div>

      {/* Transport + Multi-Track Timeline Editor */}
      <div className="h-[268px] bg-[#161616] border-t border-white/[0.08] flex flex-col shrink-0">
        {/* Transport Toolbar */}
        <div className="h-[42px] px-4 bg-[#191919] border-b border-white/[0.06] flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => splitTimelineClipAtPlayhead(selectedClipId || undefined)}
              className="h-7 px-2.5 rounded-[7px] bg-[#252525] hover:bg-[#2e2e2e] text-[12px] text-white/85 flex items-center gap-1.5"
            >
              <Scissors className="w-3.5 h-3.5" strokeWidth={1.5} />
              <span>Split</span>
            </button>
            <button
              type="button"
              onClick={() => {
                if (selectedClipId) {
                  removeTimelineClip(selectedClipId);
                  setSelectedClipId(null);
                }
              }}
              disabled={!selectedClipId}
              className="h-7 px-2.5 rounded-[7px] bg-[#252525] hover:bg-[#2e2e2e] text-[12px] text-white/85 flex items-center gap-1.5 disabled:opacity-40"
            >
              <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
              <span>Delete</span>
            </button>
            <div className="h-4 w-px bg-white/[0.08] mx-1" />
            <button
              type="button"
              onClick={() =>
                addVoiceOrSfxClip(
                  'voice',
                  'Kael Dialogue',
                  'Signal locked. Moving across sector four.',
                  4
                )
              }
              className="h-7 px-2.5 rounded-[7px] bg-[#252525] hover:bg-[#2e2e2e] text-[12px] text-white/80 flex items-center gap-1.5"
            >
              <Mic className="w-3.5 h-3.5 text-white/65" strokeWidth={1.5} />
              <span>+ Dialogue</span>
            </button>
            <button
              type="button"
              onClick={() =>
                addVoiceOrSfxClip(
                  'sfx',
                  'Rain & Sub Impact',
                  'Heavy rain ambience + anamorphic sub-bass',
                  6
                )
              }
              className="h-7 px-2.5 rounded-[7px] bg-[#252525] hover:bg-[#2e2e2e] text-[12px] text-white/80 flex items-center gap-1.5"
            >
              <Waves className="w-3.5 h-3.5 text-white/65" strokeWidth={1.5} />
              <span>+ Foley SFX</span>
            </button>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setPlayheadSec(0)}
              className="w-7 h-7 rounded-[7px] hover:bg-[#252525] flex items-center justify-center text-white/70 hover:text-white"
            >
              <SkipBack className="w-3.5 h-3.5" strokeWidth={1.5} />
            </button>
            <button
              type="button"
              onClick={() => setIsPlaying(!isPlaying)}
              className="w-8 h-8 rounded-full bg-white text-[#0e0e0e] hover:bg-[#e5e5e5] flex items-center justify-center"
            >
              {isPlaying ? (
                <Pause className="w-3.5 h-3.5" strokeWidth={1.75} />
              ) : (
                <Play className="w-3.5 h-3.5 ml-0.5" strokeWidth={1.75} />
              )}
            </button>
            <span className="font-mono text-[12px] tabular-nums text-white/85">
              {formatTimecode(playheadSec)}{' '}
              <span className="text-white/40">/ {formatTimecode(totalSec)}</span>
            </span>
          </div>

          <button
            type="button"
            onClick={() => setTimelineMuted(!timelineMuted)}
            className="h-7 px-2.5 rounded-[7px] bg-[#252525] hover:bg-[#2e2e2e] text-[12px] text-white/85 flex items-center gap-1.5"
          >
            {timelineMuted ? (
              <VolumeX className="w-3.5 h-3.5 text-white/50" strokeWidth={1.5} />
            ) : (
              <Volume2 className="w-3.5 h-3.5" strokeWidth={1.5} />
            )}
            <span>{timelineMuted ? 'Muted' : 'Audio On'}</span>
          </button>
        </div>

        {/* 3 Lanes: V1 Video, A1 Dialogue, A2 SFX */}
        <div
          className="flex-1 px-4 py-3 space-y-2 overflow-x-auto relative"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const ratio = Math.max(
              0,
              Math.min(1, (e.clientX - rect.left - 110) / Math.max(1, rect.width - 130))
            );
            setPlayheadSec(ratio * totalSec);
          }}
        >
          {/* V1 Lane */}
          <div className="flex items-center gap-3 h-[64px]">
            <div className="w-[96px] shrink-0 text-[11px] font-medium text-white/55 flex items-center gap-1.5">
              <Film className="w-3.5 h-3.5" strokeWidth={1.5} />
              <span>V1 · Video</span>
            </div>
            <div className="flex-1 h-full bg-[#121212] rounded-[8px] border border-white/[0.06] relative overflow-hidden">
              {videoClips.map((clip) => {
                const leftPct = (clip.startSec / totalSec) * 100;
                const widthPct = Math.max(6, (clip.durationSec / totalSec) * 100);
                const selected = selectedClipId === clip.id;
                return (
                  <div
                    key={clip.id}
                    style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                    onClick={(ev) => {
                      ev.stopPropagation();
                      setSelectedClipId(clip.id);
                      setPlayheadSec(clip.startSec);
                    }}
                    className={`absolute top-1 bottom-1 rounded-[6px] overflow-hidden cursor-pointer bg-[#252525] ${
                      selected ? 'ring-1 ring-white' : 'border border-white/[0.12]'
                    }`}
                  >
                    <SmartMediaImage
                      src={clip.thumbnailUrl}
                      alt={clip.title}
                      fallbackPrompt={clip.promptOrDialogue}
                      className="w-full h-full object-cover opacity-80"
                    />
                    <div className="absolute inset-0 bg-black/35 px-2 py-1 flex items-end justify-between">
                      <span className="text-[11px] font-medium text-white truncate">
                        {clip.title}
                      </span>
                      <span className="font-mono text-[10px] text-white/80">
                        {clip.durationSec}s
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* A1 Voice Lane */}
          <div className="flex items-center gap-3 h-[44px]">
            <div className="w-[96px] shrink-0 text-[11px] font-medium text-white/55 flex items-center gap-1.5">
              <Mic className="w-3.5 h-3.5" strokeWidth={1.5} />
              <span>A1 · Voice</span>
            </div>
            <div className="flex-1 h-full bg-[#121212] rounded-[8px] border border-white/[0.06] relative overflow-hidden">
              {voiceClips.map((clip) => {
                const leftPct = (clip.startSec / totalSec) * 100;
                const widthPct = Math.max(6, (clip.durationSec / totalSec) * 100);
                const selected = selectedClipId === clip.id;
                return (
                  <div
                    key={clip.id}
                    style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                    onClick={(ev) => {
                      ev.stopPropagation();
                      setSelectedClipId(clip.id);
                    }}
                    className={`absolute top-1 bottom-1 rounded-[6px] px-2.5 flex items-center justify-between cursor-pointer bg-[#222222] ${
                      selected ? 'ring-1 ring-white' : 'border border-white/[0.1]'
                    }`}
                  >
                    <span className="text-[11px] text-white/85 truncate">
                      {clip.title}: “{clip.promptOrDialogue}”
                    </span>
                    <span className="font-mono text-[10px] text-white/50 ml-2">
                      {clip.durationSec}s
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* A2 SFX Lane */}
          <div className="flex items-center gap-3 h-[44px]">
            <div className="w-[96px] shrink-0 text-[11px] font-medium text-white/55 flex items-center gap-1.5">
              <Waves className="w-3.5 h-3.5" strokeWidth={1.5} />
              <span>A2 · SFX</span>
            </div>
            <div className="flex-1 h-full bg-[#121212] rounded-[8px] border border-white/[0.06] relative overflow-hidden">
              {sfxClips.map((clip) => {
                const leftPct = (clip.startSec / totalSec) * 100;
                const widthPct = Math.max(6, (clip.durationSec / totalSec) * 100);
                const selected = selectedClipId === clip.id;
                return (
                  <div
                    key={clip.id}
                    style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                    onClick={(ev) => {
                      ev.stopPropagation();
                      setSelectedClipId(clip.id);
                    }}
                    className={`absolute top-1 bottom-1 rounded-[6px] px-2.5 flex items-center justify-between cursor-pointer bg-[#1e1e1e] ${
                      selected ? 'ring-1 ring-white' : 'border border-white/[0.09]'
                    }`}
                  >
                    <span className="text-[11px] text-white/75 truncate">
                      {clip.title}
                    </span>
                    <span className="font-mono text-[10px] text-white/45 ml-2">
                      {clip.durationSec}s
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
