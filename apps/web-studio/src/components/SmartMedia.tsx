import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Download, Maximize2, Pause, Play, Volume2, VolumeX } from 'lucide-react';
import type { AspectRatio, CanvasNode } from '../types/studio';
import { LOCAL_MCP_BASE } from '../services/executionRouter';
import {
  drawCinemaShotFrame,
  renderContactSheetDataUrl,
  renderShotDataUrl,
} from '../utils/proceduralMedia';

const BACKEND_ORIGIN = LOCAL_MCP_BASE;

export function isRuntimeGeneratedMediaPath(relPath: string): boolean {
  return relPath.startsWith('/media/');
}

export function buildCandidateUrls(src?: string): string[] {
  if (!src) return [];
  if (src.startsWith('data:') || src.startsWith('blob:')) return [src];
  if (src.startsWith('/api/')) {
    return [`${BACKEND_ORIGIN}${src}`, src];
  }
  if (src.startsWith('/media/')) {
    if (isRuntimeGeneratedMediaPath(src)) {
      return [`${BACKEND_ORIGIN}${src}`, src];
    }
    return [src, `${BACKEND_ORIGIN}${src}`];
  }
  if (src.startsWith(`${BACKEND_ORIGIN}/media/`)) {
    const rel = src.slice(BACKEND_ORIGIN.length);
    return [src, rel];
  }
  if (src.startsWith('http://localhost:3001/media/') || src.startsWith('http://127.0.0.1:3001/media/')) {
    const idx = src.indexOf('/media/');
    const rel = src.slice(idx);
    return [`${BACKEND_ORIGIN}${rel}`, rel, src];
  }
  return [src];
}

export function resolvePlayableAudioUrl(src?: string): string | undefined {
  const list = buildCandidateUrls(src);
  return list[0];
}

export const SmartMediaImage: React.FC<{
  src?: string;
  alt: string;
  className?: string;
  style?: React.CSSProperties;
  aspectRatio?: AspectRatio;
  fallbackPrompt?: string;
  fallbackSeed?: number;
  isContactSheet?: boolean;
  draggable?: boolean;
}> = ({
  src,
  alt,
  className,
  style,
  aspectRatio = '16:9',
  fallbackPrompt = 'Open-DreamFlow Cinema Frame',
  fallbackSeed = 204,
  isContactSheet = false,
  draggable = false,
}) => {
  const candidates = useMemo(() => buildCandidateUrls(src), [src]);
  const [candidateIdx, setCandidateIdx] = useState(0);

  useEffect(() => {
    setCandidateIdx(0);
  }, [src]);

  const fallbackDataUrl = useMemo(() => {
    if (candidateIdx < candidates.length) return '';
    if (isContactSheet) {
      return renderContactSheetDataUrl(3, 3, fallbackPrompt, fallbackSeed).dataUrl;
    }
    return renderShotDataUrl(aspectRatio, {
      prompt: fallbackPrompt,
      seed: fallbackSeed,
      cameraLabel: alt.slice(0, 28),
    });
  }, [
    candidateIdx,
    candidates.length,
    isContactSheet,
    aspectRatio,
    fallbackPrompt,
    fallbackSeed,
    alt,
  ]);

  const activeSrc =
    candidateIdx < candidates.length ? candidates[candidateIdx] : fallbackDataUrl;

  if (!activeSrc) return null;

  return (
    <img
      key={activeSrc}
      src={activeSrc}
      alt={alt}
      style={style}
      className={className}
      draggable={draggable}
      onError={() => {
        if (candidateIdx < candidates.length) {
          setCandidateIdx((i) => i + 1);
        }
      }}
    />
  );
};

export const SmartMediaVideo: React.FC<{
  videoUrl?: string;
  posterUrl?: string;
  playing?: boolean;
  muted?: boolean;
  controls?: boolean;
  loop?: boolean;
  className?: string;
  fallbackPrompt: string;
  fallbackSeed: number;
  fallbackTheme?: CanvasNode['videoTheme'];
  fallbackDurationSec?: number;
  fallbackMotionLabel?: string;
  fallbackBadge?: string;
  aspectRatio?: AspectRatio;
}> = ({
  videoUrl,
  posterUrl,
  playing = true,
  muted = true,
  controls = false,
  loop = true,
  className = 'w-full h-full object-cover',
  fallbackPrompt,
  fallbackSeed,
  fallbackTheme,
  fallbackDurationSec = 10,
  fallbackMotionLabel = 'OMNI 1.2',
  fallbackBadge = 'OMNI 1.2 LIVE',
  aspectRatio = '16:9',
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const candidates = useMemo(() => buildCandidateUrls(videoUrl), [videoUrl]);
  const [candidateIdx, setCandidateIdx] = useState(0);

  useEffect(() => {
    setCandidateIdx(0);
  }, [videoUrl]);

  const activeVideoSrc =
    candidateIdx < candidates.length ? candidates[candidateIdx] : undefined;

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !activeVideoSrc) return;
    el.muted = muted;
    if (playing) {
      el.play().catch(() => {
        // Browser autoplay policy fallback: ensure muted playback succeeds
        if (!el.muted) {
          el.muted = true;
          el.play().catch(() => undefined);
        }
      });
    } else {
      el.pause();
    }
  }, [playing, muted, activeVideoSrc]);

  useEffect(() => {
    if (activeVideoSrc || !playing) return;
    let raf = 0;
    const start = performance.now();
    const render = () => {
      const c = canvasRef.current;
      if (c) {
        const ctx = c.getContext('2d');
        if (ctx) {
          const elapsed = (performance.now() - start) / 1000;
          drawCinemaShotFrame(ctx, c.width, c.height, elapsed, {
            prompt: fallbackPrompt,
            seed: fallbackSeed,
            theme: fallbackTheme,
            cameraLabel: `${fallbackMotionLabel} · ${(
              elapsed % fallbackDurationSec
            ).toFixed(1)}s / ${fallbackDurationSec}s`,
            hudBadge: fallbackBadge,
          });
        }
      }
      raf = requestAnimationFrame(render);
    };
    raf = requestAnimationFrame(render);
    return () => cancelAnimationFrame(raf);
  }, [
    activeVideoSrc,
    playing,
    fallbackPrompt,
    fallbackSeed,
    fallbackTheme,
    fallbackDurationSec,
    fallbackMotionLabel,
    fallbackBadge,
  ]);

  const resolvedPoster = useMemo(() => {
    const list = buildCandidateUrls(posterUrl);
    return list[0];
  }, [posterUrl]);

  if (activeVideoSrc) {
    return (
      <video
        ref={videoRef}
        key={activeVideoSrc}
        src={activeVideoSrc}
        poster={resolvedPoster}
        autoPlay={playing}
        preload="metadata"
        loop={loop}
        muted={muted}
        playsInline
        controls={controls}
        className={className}
        onLoadedMetadata={(ev) => {
          const el = ev.currentTarget;
          if (!playing && !resolvedPoster && el.currentTime === 0) {
            try {
              el.currentTime = 0.05;
            } catch {
              // ignore seek restriction before data
            }
          }
        }}
        onError={() => {
          if (candidateIdx < candidates.length) {
            setCandidateIdx((i) => i + 1);
          }
        }}
      />
    );
  }

  if (posterUrl && !playing) {
    return (
      <SmartMediaImage
        src={posterUrl}
        alt={fallbackPrompt}
        className={className}
        aspectRatio={aspectRatio}
        fallbackPrompt={fallbackPrompt}
        fallbackSeed={fallbackSeed}
      />
    );
  }

  if (posterUrl && playing) {
    return (
      <SmartMediaImage
        src={posterUrl}
        alt={fallbackPrompt}
        className={className}
        aspectRatio={aspectRatio}
        fallbackPrompt={fallbackPrompt}
        fallbackSeed={fallbackSeed}
      />
    );
  }

  return (
    <canvas
      ref={canvasRef}
      width={540}
      height={304}
      className={className}
    />
  );
};

function formatClock(sec: number): string {
  const safe = Number.isFinite(sec) && sec > 0 ? sec : 0;
  const mins = Math.floor(safe / 60);
  const rem = Math.floor(safe % 60);
  return `${mins}:${String(rem).padStart(2, '0')}`;
}

export const VideoNodeCardPlayer: React.FC<{
  node: CanvasNode;
  posterUrl?: string;
  isSelected?: boolean;
  onOpenFullscreen: () => void;
  onDownload: () => void;
}> = ({ node, posterUrl, isSelected = false, onOpenFullscreen, onDownload }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const scrubTrackRef = useRef<HTMLDivElement | null>(null);
  const scrubbingRef = useRef(false);

  const candidates = useMemo(() => buildCandidateUrls(node.videoUrl), [node.videoUrl]);
  const [candidateIdx, setCandidateIdx] = useState(0);
  const resolvedPoster = useMemo(() => buildCandidateUrls(posterUrl)[0], [posterUrl]);

  const [hovered, setHovered] = useState(false);
  const [pinnedPlaying, setPinnedPlaying] = useState(false);
  const [pausedDuringHover, setPausedDuringHover] = useState(false);
  const [unmuted, setUnmuted] = useState(false);
  const [isPlayingActual, setIsPlayingActual] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState<number>(node.durationSec || 5);

  useEffect(() => {
    setCandidateIdx(0);
    setCurrentTime(0);
    setDuration(node.durationSec || 5);
    setPinnedPlaying(false);
    setPausedDuringHover(false);
  }, [node.videoUrl, node.durationSec]);

  const activeVideoSrc =
    candidateIdx < candidates.length ? candidates[candidateIdx] : undefined;

  const shouldPlay = pinnedPlaying || (hovered && !pausedDuringHover);

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !activeVideoSrc) return;
    el.muted = !unmuted;
    if (shouldPlay) {
      el.play().catch(() => {
        if (!el.muted) {
          el.muted = true;
          setUnmuted(false);
          el.play().catch(() => undefined);
        }
      });
    } else {
      el.pause();
    }
  }, [shouldPlay, unmuted, activeVideoSrc]);

  const seekByClientX = (clientX: number) => {
    const track = scrubTrackRef.current;
    const el = videoRef.current;
    if (!track || !el) return;
    const rect = track.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / Math.max(1, rect.width)));
    const targetDur = Number.isFinite(el.duration) && el.duration > 0 ? el.duration : duration;
    const nextSec = ratio * targetDur;
    try {
      el.currentTime = nextSec;
    } catch {
      // ignore seek error if metadata not ready
    }
    setCurrentTime(nextSec);
  };

  const handleTogglePlayClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (shouldPlay) {
      setPinnedPlaying(false);
      if (hovered) {
        setPausedDuringHover(true);
      }
    } else {
      setPausedDuringHover(false);
      setPinnedPlaying(true);
    }
  };

  const progressPct =
    duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;
  const showControls = hovered || isSelected || pinnedPlaying;

  return (
    <div
      data-video-card={node.id}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => {
        setHovered(false);
        setPausedDuringHover(false);
        scrubbingRef.current = false;
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onOpenFullscreen();
      }}
      className="relative w-full h-full bg-[#141414]"
    >
      {activeVideoSrc ? (
        <video
          ref={videoRef}
          key={activeVideoSrc}
          src={activeVideoSrc}
          poster={resolvedPoster}
          preload="metadata"
          loop
          muted={!unmuted}
          playsInline
          className="w-full h-full object-cover"
          onPlay={() => setIsPlayingActual(true)}
          onPause={() => setIsPlayingActual(false)}
          onLoadedMetadata={(ev) => {
            const el = ev.currentTarget;
            if (Number.isFinite(el.duration) && el.duration > 0) {
              setDuration(el.duration);
            }
            if (!shouldPlay && !resolvedPoster && el.currentTime === 0) {
              try {
                el.currentTime = 0.05;
              } catch {
                // ignore
              }
            }
          }}
          onTimeUpdate={(ev) => {
            if (!scrubbingRef.current) {
              setCurrentTime(ev.currentTarget.currentTime);
            }
          }}
          onError={() => {
            if (candidateIdx < candidates.length) {
              setCandidateIdx((i) => i + 1);
            }
          }}
        />
      ) : (
        <SmartMediaImage
          src={posterUrl}
          alt={node.title}
          aspectRatio={node.aspectRatio}
          fallbackPrompt={node.prompt}
          fallbackSeed={node.seed}
          className="w-full h-full object-cover"
        />
      )}

      {/* Top-Right Quick Actions: Download + Full Screen */}
      <div
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        className={`absolute top-2.5 right-2.5 z-10 flex items-center gap-1 transition-opacity ${
          showControls ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        }`}
      >
        <button
          type="button"
          data-video-download={node.id}
          onClick={onDownload}
          className="w-7 h-7 rounded-full bg-black/70 hover:bg-black/90 border border-white/[0.12] backdrop-blur-md flex items-center justify-center text-white/90 transition-colors"
          title="Download MP4"
        >
          <Download className="w-3.5 h-3.5" strokeWidth={1.75} />
        </button>
        <button
          type="button"
          data-video-fullscreen={node.id}
          onClick={onOpenFullscreen}
          className="w-7 h-7 rounded-full bg-black/70 hover:bg-black/90 border border-white/[0.12] backdrop-blur-md flex items-center justify-center text-white/90 transition-colors"
          title="Full screen view"
        >
          <Maximize2 className="w-3.5 h-3.5" strokeWidth={1.75} />
        </button>
      </div>

      {/* Idle Rest Badge (when not hovered/selected/playing) */}
      {!showControls && (
        <div className="absolute bottom-2.5 right-2.5 px-2 py-0.5 rounded-[6px] bg-black/70 backdrop-blur-md border border-white/[0.08] tabular-nums text-[11px] text-white/90 flex items-center gap-1.5 pointer-events-none">
          <Play className="w-2.5 h-2.5 text-white/75 fill-white/75" strokeWidth={1.5} />
          <span>{formatClock(duration)}</span>
        </div>
      )}

      {/* Interactive Bottom Transport Bar (Hover / Selected / Pinned) */}
      <div
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        className={`absolute inset-x-0 bottom-0 z-10 px-2.5 pt-5 pb-2 bg-gradient-to-t from-black/85 via-black/50 to-transparent transition-opacity ${
          showControls ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="flex items-center gap-2">
          <button
            type="button"
            data-video-play-toggle={node.id}
            onClick={handleTogglePlayClick}
            className="w-6 h-6 rounded-full bg-white/15 hover:bg-white/25 backdrop-blur-md flex items-center justify-center text-white shrink-0 transition-colors"
            title={isPlayingActual || shouldPlay ? 'Pause video' : 'Play video (pin on canvas)'}
          >
            {isPlayingActual || shouldPlay ? (
              <Pause className="w-3 h-3" strokeWidth={2} />
            ) : (
              <Play className="w-3 h-3 ml-0.5" strokeWidth={2} />
            )}
          </button>

          {/* Scrubbable Timeline Bar */}
          <div
            ref={scrubTrackRef}
            role="slider"
            aria-label="Video timeline scrubber"
            aria-valuemin={0}
            aria-valuemax={Math.round(duration)}
            aria-valuenow={Math.round(currentTime)}
            tabIndex={0}
            onPointerDown={(e) => {
              e.stopPropagation();
              e.currentTarget.setPointerCapture(e.pointerId);
              scrubbingRef.current = true;
              seekByClientX(e.clientX);
            }}
            onPointerMove={(e) => {
              if (scrubbingRef.current) {
                e.stopPropagation();
                seekByClientX(e.clientX);
              }
            }}
            onPointerUp={(e) => {
              if (scrubbingRef.current) {
                e.stopPropagation();
                scrubbingRef.current = false;
              }
            }}
            className="flex-1 h-5 flex items-center cursor-pointer group/scrub"
          >
            <div className="relative w-full h-1 group-hover/scrub:h-1.5 rounded-full bg-white/25 overflow-visible transition-all">
              <div
                style={{ width: `${progressPct}%` }}
                className="h-full rounded-full bg-[#20D5EC]"
              />
              <div
                style={{ left: `${progressPct}%` }}
                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-white shadow opacity-0 group-hover/scrub:opacity-100 transition-opacity"
              />
            </div>
          </div>

          <span className="tabular-nums text-[10.5px] text-white/85 shrink-0">
            {formatClock(currentTime)} / {formatClock(duration)}
          </span>

          <button
            type="button"
            data-video-mute-toggle={node.id}
            onClick={(e) => {
              e.stopPropagation();
              setUnmuted((u) => !u);
            }}
            className="w-6 h-6 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/90 shrink-0 transition-colors"
            title={unmuted ? 'Mute audio' : 'Unmute audio'}
          >
            {unmuted ? (
              <Volume2 className="w-3 h-3 text-[#20D5EC]" strokeWidth={1.75} />
            ) : (
              <VolumeX className="w-3 h-3 text-white/75" strokeWidth={1.75} />
            )}
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenFullscreen();
            }}
            className="w-6 h-6 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/90 shrink-0 transition-colors"
            title="Full screen player"
          >
            <Maximize2 className="w-3 h-3" strokeWidth={1.75} />
          </button>
        </div>
      </div>
    </div>
  );
};
