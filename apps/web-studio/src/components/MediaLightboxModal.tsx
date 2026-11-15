import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Maximize,
  Minimize,
  Minus,
  Pause,
  Play,
  Plus,
  Repeat,
  RotateCcw,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { useStudioStore } from '../store/useStudioStore';
import { getPlatformBadgeLabel } from '../presets/platformCatalog';
import { PlatformBrandIcon } from './PlatformBrandIcon';
import { buildCandidateUrls, SmartMediaImage } from './SmartMedia';

function formatPreciseClock(sec: number): string {
  const safe = Number.isFinite(sec) && sec > 0 ? sec : 0;
  const mins = Math.floor(safe / 60);
  const rem = Math.floor(safe % 60);
  return `${mins}:${String(rem).padStart(2, '0')}`;
}

export const MediaLightboxModal: React.FC = () => {
  const lightboxNodeId = useStudioStore((s) => s.lightboxNodeId);
  const lightboxMediaUrl = useStudioStore((s) => s.lightboxMediaUrl);
  const nodes = useStudioStore((s) => s.nodes);
  const platformsCatalog = useStudioStore((s) => s.platformsCatalog);
  const externalMcpServers = useStudioStore((s) => s.externalMcpServers);
  const openLightbox = useStudioStore((s) => s.openLightbox);
  const closeLightbox = useStudioStore((s) => s.closeLightbox);
  const downloadNodeMedia = useStudioStore((s) => s.downloadNodeMedia);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const scrubRef = useRef<HTMLDivElement | null>(null);
  const scrubbingRef = useRef(false);

  const readyMediaNodes = useMemo(
    () =>
      nodes.filter(
        (n) =>
          (n.kind === 'video' && Boolean(n.videoUrl)) ||
          ((n.kind === 'image' || n.kind === 'contact-sheet' || n.kind === 'element') &&
            Boolean(n.imageUrl))
      ),
    [nodes]
  );

  const activeNode = useMemo(
    () => (lightboxNodeId ? nodes.find((n) => n.id === lightboxNodeId) || null : null),
    [lightboxNodeId, nodes]
  );

  const currentIdx = useMemo(
    () => (activeNode ? readyMediaNodes.findIndex((n) => n.id === activeNode.id) : -1),
    [activeNode, readyMediaNodes]
  );

  // Video player state
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [playbackRate, setPlaybackRate] = useState<0.5 | 1 | 1.5 | 2>(1);
  const [loop, setLoop] = useState(true);
  const [videoCandidateIdx, setVideoCandidateIdx] = useState(0);

  // Image viewer zoom/pan state
  const [zoomScale, setZoomScale] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const panDragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(
    null
  );
  const [isNativeFullscreen, setIsNativeFullscreen] = useState(false);

  const isVideo = activeNode?.kind === 'video' && Boolean(activeNode.videoUrl);
  const activeMediaSrc = isVideo
    ? lightboxMediaUrl || activeNode?.videoUrl
    : lightboxMediaUrl || activeNode?.imageUrl;

  const videoCandidates = useMemo(
    () => (isVideo ? buildCandidateUrls(activeMediaSrc || undefined) : []),
    [isVideo, activeMediaSrc]
  );
  const resolvedVideoSrc =
    videoCandidateIdx < videoCandidates.length
      ? videoCandidates[videoCandidateIdx]
      : undefined;
  const resolvedPosterSrc = useMemo(
    () => (isVideo ? buildCandidateUrls(activeNode?.imageUrl)[0] : undefined),
    [isVideo, activeNode?.imageUrl]
  );

  useEffect(() => {
    setIsPlaying(true);
    setCurrentTime(0);
    setDuration(activeNode?.durationSec || 5);
    setVideoCandidateIdx(0);
    setZoomScale(1);
    setPanOffset({ x: 0, y: 0 });
  }, [activeNode?.id, activeMediaSrc, activeNode?.durationSec]);

  useEffect(() => {
    const onFsChange = () => {
      setIsNativeFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !isVideo || !resolvedVideoSrc) return;
    el.muted = muted;
    el.volume = volume;
    el.playbackRate = playbackRate;
    if (isPlaying) {
      el.play().catch(() => {
        if (!el.muted) {
          el.muted = true;
          setMuted(true);
          el.play().catch(() => undefined);
        }
      });
    } else {
      el.pause();
    }
  }, [isVideo, resolvedVideoSrc, isPlaying, muted, volume, playbackRate]);

  const goPrev = () => {
    if (readyMediaNodes.length <= 1) return;
    const nextIdx =
      currentIdx <= 0 ? readyMediaNodes.length - 1 : currentIdx - 1;
    const prevNode = readyMediaNodes[nextIdx];
    if (prevNode) openLightbox(prevNode.id, null);
  };

  const goNext = () => {
    if (readyMediaNodes.length <= 1) return;
    const nextIdx =
      currentIdx < 0 || currentIdx >= readyMediaNodes.length - 1 ? 0 : currentIdx + 1;
    const nextNode = readyMediaNodes[nextIdx];
    if (nextNode) openLightbox(nextNode.id, null);
  };

  const toggleNativeFullscreen = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else if (containerRef.current?.requestFullscreen) {
        await containerRef.current.requestFullscreen();
      }
    } catch {
      // Ignore fullscreen permission error
    }
  };

  const handleClose = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => undefined);
    }
    closeLightbox();
  };

  useEffect(() => {
    if (!activeNode) return;
    const onKeyDown = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') {
        ev.preventDefault();
        handleClose();
      } else if (ev.key === 'ArrowLeft') {
        ev.preventDefault();
        goPrev();
      } else if (ev.key === 'ArrowRight') {
        ev.preventDefault();
        goNext();
      } else if (ev.key === ' ' && isVideo) {
        ev.preventDefault();
        setIsPlaying((p) => !p);
      } else if ((ev.key === 'm' || ev.key === 'M') && isVideo) {
        ev.preventDefault();
        setMuted((m) => !m);
      } else if (ev.key === 'f' || ev.key === 'F') {
        ev.preventDefault();
        void toggleNativeFullscreen();
      } else if (!isVideo && (ev.key === '+' || ev.key === '=')) {
        ev.preventDefault();
        setZoomScale((z) => Math.min(4, Number((z + 0.25).toFixed(2))));
      } else if (!isVideo && ev.key === '-') {
        ev.preventDefault();
        setZoomScale((z) => {
          const next = Math.max(0.5, Number((z - 0.25).toFixed(2)));
          if (next <= 1) setPanOffset({ x: 0, y: 0 });
          return next;
        });
      } else if (!isVideo && ev.key === '0') {
        ev.preventDefault();
        setZoomScale(1);
        setPanOffset({ x: 0, y: 0 });
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeNode, isVideo, currentIdx, readyMediaNodes]);

  if (!activeNode) return null;

  const platformBadge = getPlatformBadgeLabel(
    activeNode.platformId,
    activeNode.modelId,
    platformsCatalog,
    externalMcpServers
  );

  const seekVideoByClientX = (clientX: number) => {
    const bar = scrubRef.current;
    const el = videoRef.current;
    if (!bar || !el) return;
    const rect = bar.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / Math.max(1, rect.width)));
    const dur = Number.isFinite(el.duration) && el.duration > 0 ? el.duration : duration;
    const targetSec = ratio * dur;
    try {
      el.currentTime = targetSec;
    } catch {
      // ignore
    }
    setCurrentTime(targetSec);
  };

  const progressPct =
    duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;

  return (
    <div
      ref={containerRef}
      data-testid="media-lightbox-modal"
      onClick={handleClose}
      className="fixed inset-0 z-[120] bg-[#07080a]/95 backdrop-blur-xl flex flex-col select-none"
    >
      {/* Top Cinema Header */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="h-[56px] px-5 border-b border-white/[0.08] bg-black/50 flex items-center justify-between gap-4 shrink-0"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-[13.5px] font-semibold text-white truncate max-w-[380px]">
            {activeNode.title}
          </span>
          {platformBadge && (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[6px] bg-white/[0.06] border border-white/[0.09] text-[11px] font-medium text-white/85 shrink-0">
              {activeNode.platformId && (
                <PlatformBrandIcon platformId={activeNode.platformId} size="xs" />
              )}
              <span>{platformBadge}</span>
            </span>
          )}
          {activeNode.resolution && (
            <span className="px-2 py-0.5 rounded-[6px] bg-white/[0.04] border border-white/[0.07] tabular-nums text-[11px] text-white/60 shrink-0">
              {activeNode.resolution} · {activeNode.aspectRatio}
            </span>
          )}
          {readyMediaNodes.length > 1 && currentIdx >= 0 && (
            <span className="tabular-nums text-[11.5px] text-white/45 shrink-0">
              {currentIdx + 1} / {readyMediaNodes.length}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {!isVideo && (
            <div className="flex items-center gap-1 px-1.5 py-1 rounded-[8px] bg-white/[0.05] border border-white/[0.08]">
              <button
                type="button"
                onClick={() =>
                  setZoomScale((z) => {
                    const next = Math.max(0.5, Number((z - 0.25).toFixed(2)));
                    if (next <= 1) setPanOffset({ x: 0, y: 0 });
                    return next;
                  })
                }
                className="w-6 h-6 rounded-[5px] hover:bg-white/[0.1] flex items-center justify-center text-white/80"
                title="Zoom out (-)"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setZoomScale((z) => (z === 1 ? 2 : 1));
                  setPanOffset({ x: 0, y: 0 });
                }}
                className="px-2 h-6 rounded-[5px] hover:bg-white/[0.1] tabular-nums text-[11px] font-medium text-white/90"
                title="Toggle 100% / 200% zoom"
              >
                {Math.round(zoomScale * 100)}%
              </button>
              <button
                type="button"
                onClick={() =>
                  setZoomScale((z) => Math.min(4, Number((z + 0.25).toFixed(2))))
                }
                className="w-6 h-6 rounded-[5px] hover:bg-white/[0.1] flex items-center justify-center text-white/80"
                title="Zoom in (+)"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
              {(zoomScale !== 1 || panOffset.x !== 0 || panOffset.y !== 0) && (
                <button
                  type="button"
                  onClick={() => {
                    setZoomScale(1);
                    setPanOffset({ x: 0, y: 0 });
                  }}
                  className="w-6 h-6 rounded-[5px] hover:bg-white/[0.1] flex items-center justify-center text-[#20D5EC]"
                  title="Reset view (0)"
                >
                  <RotateCcw className="w-3 h-3" />
                </button>
              )}
            </div>
          )}

          <button
            type="button"
            data-testid="lightbox-download-btn"
            onClick={() =>
              void downloadNodeMedia(
                activeNode.id,
                !isVideo && activeMediaSrc ? activeMediaSrc : undefined
              )
            }
            className="h-8 px-3 rounded-[8px] bg-[#20D5EC] hover:bg-[#3be0f5] text-[#0b0d10] text-[12px] font-semibold flex items-center gap-1.5 transition-colors"
            title="Download full-resolution file"
          >
            <Download className="w-3.5 h-3.5" strokeWidth={2} />
            <span>Download {isVideo ? 'MP4' : 'PNG'}</span>
          </button>

          <button
            type="button"
            onClick={() => void toggleNativeFullscreen()}
            className="w-8 h-8 rounded-[8px] bg-white/[0.07] hover:bg-white/[0.14] border border-white/[0.1] flex items-center justify-center text-white/85"
            title={isNativeFullscreen ? 'Exit monitor fullscreen (F)' : 'Monitor fullscreen (F)'}
          >
            {isNativeFullscreen ? (
              <Minimize className="w-4 h-4" strokeWidth={1.75} />
            ) : (
              <Maximize className="w-4 h-4" strokeWidth={1.75} />
            )}
          </button>

          <button
            type="button"
            data-testid="lightbox-close-btn"
            onClick={handleClose}
            className="w-8 h-8 rounded-[8px] bg-white/[0.07] hover:bg-white/[0.16] border border-white/[0.1] flex items-center justify-center text-white/90"
            title="Close full screen (Esc)"
          >
            <X className="w-4 h-4" strokeWidth={1.75} />
          </button>
        </div>
      </div>

      {/* Main Viewport Stage */}
      <div className="relative flex-1 min-h-0 flex items-center justify-center overflow-hidden p-6">
        {readyMediaNodes.length > 1 && (
          <button
            type="button"
            data-testid="lightbox-prev-btn"
            onClick={(e) => {
              e.stopPropagation();
              goPrev();
            }}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-black/70 hover:bg-white/[0.16] border border-white/[0.14] flex items-center justify-center text-white/90 transition-colors"
            title="Previous media node (←)"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}

        {isVideo ? (
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-[calc(100vw-130px)] max-h-full flex flex-col items-center justify-center"
          >
            {resolvedVideoSrc && (
              <video
                ref={videoRef}
                key={resolvedVideoSrc}
                src={resolvedVideoSrc}
                poster={resolvedPosterSrc}
                autoPlay
                loop={loop}
                muted={muted}
                playsInline
                onClick={() => setIsPlaying((p) => !p)}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onLoadedMetadata={(ev) => {
                  const d = ev.currentTarget.duration;
                  if (Number.isFinite(d) && d > 0) setDuration(d);
                }}
                onTimeUpdate={(ev) => {
                  if (!scrubbingRef.current) {
                    setCurrentTime(ev.currentTarget.currentTime);
                  }
                }}
                onError={() => {
                  if (videoCandidateIdx < videoCandidates.length) {
                    setVideoCandidateIdx((i) => i + 1);
                  }
                }}
                className="max-h-[calc(100vh-172px)] max-w-[calc(100vw-130px)] rounded-[12px] bg-black shadow-[0_24px_80px_rgba(0,0,0,0.85)] border border-white/[0.1] object-contain cursor-pointer"
              />
            )}
          </div>
        ) : (
          <div
            onClick={(e) => e.stopPropagation()}
            onWheel={(e) => {
              e.preventDefault();
              const delta = e.deltaY < 0 ? 0.2 : -0.2;
              setZoomScale((z) => {
                const next = Math.min(4, Math.max(0.5, Number((z + delta).toFixed(2))));
                if (next <= 1) setPanOffset({ x: 0, y: 0 });
                return next;
              });
            }}
            onPointerDown={(e) => {
              if (zoomScale <= 1) return;
              e.currentTarget.setPointerCapture(e.pointerId);
              panDragRef.current = {
                startX: e.clientX,
                startY: e.clientY,
                origX: panOffset.x,
                origY: panOffset.y,
              };
            }}
            onPointerMove={(e) => {
              if (!panDragRef.current) return;
              setPanOffset({
                x: panDragRef.current.origX + (e.clientX - panDragRef.current.startX),
                y: panDragRef.current.origY + (e.clientY - panDragRef.current.startY),
              });
            }}
            onPointerUp={() => {
              panDragRef.current = null;
            }}
            className={`relative flex items-center justify-center ${
              zoomScale > 1 ? 'cursor-grab active:cursor-grabbing' : 'cursor-zoom-in'
            }`}
            onDoubleClick={() => {
              if (zoomScale > 1) {
                setZoomScale(1);
                setPanOffset({ x: 0, y: 0 });
              } else {
                setZoomScale(2);
              }
            }}
          >
            <SmartMediaImage
              src={activeMediaSrc || activeNode.imageUrl}
              alt={activeNode.title}
              aspectRatio={activeNode.aspectRatio}
              fallbackPrompt={activeNode.prompt}
              fallbackSeed={activeNode.seed}
              isContactSheet={activeNode.kind === 'contact-sheet'}
              style={{
                transform: `translate3d(${panOffset.x}px, ${panOffset.y}px, 0) scale(${zoomScale})`,
                transition: panDragRef.current ? 'none' : 'transform 140ms ease-out',
              }}
              className="max-h-[calc(100vh-160px)] max-w-[calc(100vw-130px)] rounded-[10px] object-contain shadow-[0_24px_80px_rgba(0,0,0,0.85)] border border-white/[0.1]"
            />
          </div>
        )}

        {readyMediaNodes.length > 1 && (
          <button
            type="button"
            data-testid="lightbox-next-btn"
            onClick={(e) => {
              e.stopPropagation();
              goNext();
            }}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-black/70 hover:bg-white/[0.16] border border-white/[0.14] flex items-center justify-center text-white/90 transition-colors"
            title="Next media node (→)"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Bottom Transport Bar (Video Controls OR Batch Variation Filmstrip / Prompt Info) */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="px-6 py-3 border-t border-white/[0.08] bg-black/65 backdrop-blur-md shrink-0"
      >
        {isVideo ? (
          <div className="max-w-[980px] mx-auto flex items-center gap-3">
            <button
              type="button"
              data-testid="lightbox-video-play-toggle"
              onClick={() => setIsPlaying((p) => !p)}
              className="w-9 h-9 rounded-full bg-white hover:bg-white/90 text-[#0b0d10] flex items-center justify-center shrink-0 transition-colors"
              title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
            >
              {isPlaying ? (
                <Pause className="w-4 h-4" strokeWidth={2} />
              ) : (
                <Play className="w-4 h-4 ml-0.5" strokeWidth={2} />
              )}
            </button>

            <span className="tabular-nums text-[12px] text-white/85 w-[92px] text-center shrink-0">
              {formatPreciseClock(currentTime)} / {formatPreciseClock(duration)}
            </span>

            {/* Full Timeline Scrubber */}
            <div
              ref={scrubRef}
              role="slider"
              aria-label="Full screen video timeline"
              aria-valuemin={0}
              aria-valuemax={Math.round(duration)}
              aria-valuenow={Math.round(currentTime)}
              tabIndex={0}
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                scrubbingRef.current = true;
                seekVideoByClientX(e.clientX);
              }}
              onPointerMove={(e) => {
                if (scrubbingRef.current) seekVideoByClientX(e.clientX);
              }}
              onPointerUp={() => {
                scrubbingRef.current = false;
              }}
              className="flex-1 h-6 flex items-center cursor-pointer group/lbscrub"
            >
              <div className="relative w-full h-1.5 group-hover/lbscrub:h-2 rounded-full bg-white/20 transition-all">
                <div
                  style={{ width: `${progressPct}%` }}
                  className="h-full rounded-full bg-[#20D5EC]"
                />
                <div
                  style={{ left: `${progressPct}%` }}
                  className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full bg-white shadow-md"
                />
              </div>
            </div>

            {/* Audio Mute + Volume Slider */}
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setMuted((m) => !m)}
                className="w-8 h-8 rounded-[8px] hover:bg-white/[0.1] flex items-center justify-center text-white/85"
                title={muted ? 'Unmute (M)' : 'Mute (M)'}
              >
                {muted || volume === 0 ? (
                  <VolumeX className="w-4 h-4 text-white/60" />
                ) : (
                  <Volume2 className="w-4 h-4 text-[#20D5EC]" />
                )}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={muted ? 0 : volume}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setVolume(v);
                  setMuted(v === 0);
                }}
                aria-label="Volume"
                className="w-20 accent-[#20D5EC] cursor-pointer"
              />
            </div>

            {/* Playback Speed Selector */}
            <div className="flex items-center gap-0.5 p-0.5 rounded-[8px] bg-white/[0.06] border border-white/[0.08] shrink-0">
              {([0.5, 1, 1.5, 2] as const).map((rate) => (
                <button
                  key={rate}
                  type="button"
                  onClick={() => setPlaybackRate(rate)}
                  className={`px-2 h-6 rounded-[6px] tabular-nums text-[11px] font-medium transition-colors ${
                    playbackRate === rate
                      ? 'bg-[#20D5EC] text-[#0b0d10]'
                      : 'text-white/65 hover:text-white'
                  }`}
                >
                  {rate}x
                </button>
              ))}
            </div>

            {/* Loop Toggle */}
            <button
              type="button"
              onClick={() => setLoop((l) => !l)}
              className={`h-7 px-2.5 rounded-[8px] border text-[11px] font-medium flex items-center gap-1 shrink-0 transition-colors ${
                loop
                  ? 'bg-[#20D5EC]/15 border-[#20D5EC]/40 text-[#7ceeff]'
                  : 'bg-white/[0.05] border-white/[0.08] text-white/55'
              }`}
              title="Toggle loop"
            >
              <Repeat className="w-3.5 h-3.5" />
              <span>Loop</span>
            </button>
          </div>
        ) : (
          <div className="max-w-[980px] mx-auto flex items-center justify-between gap-4">
            <p className="text-[12px] text-white/65 truncate flex-1">
              {activeNode.prompt || activeNode.title}
            </p>
            {activeNode.generatedOutputs && activeNode.generatedOutputs.length > 1 && (
              <div className="flex items-center gap-1.5 shrink-0">
                {activeNode.generatedOutputs.map((outUrl, idx) => {
                  const selected =
                    (lightboxMediaUrl || activeNode.imageUrl) === outUrl;
                  return (
                    <button
                      key={`${outUrl}_${idx}`}
                      type="button"
                      onClick={() => openLightbox(activeNode.id, outUrl)}
                      className={`w-9 h-9 rounded-[6px] overflow-hidden border transition-all ${
                        selected
                          ? 'border-[#20D5EC] ring-1 ring-[#20D5EC]'
                          : 'border-white/20 opacity-65 hover:opacity-100'
                      }`}
                      title={`Variation #${idx + 1}`}
                    >
                      <SmartMediaImage
                        src={outUrl}
                        alt={`Variation ${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
