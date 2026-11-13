import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { AspectRatio, CanvasNode } from '../types/studio';
import { LOCAL_MCP_BASE } from '../services/executionRouter';
import {
  drawCinemaShotFrame,
  renderContactSheetDataUrl,
  renderShotDataUrl,
} from '../utils/proceduralMedia';

const BACKEND_ORIGIN = LOCAL_MCP_BASE;

export function isRuntimeGeneratedMediaPath(relPath: string): boolean {
  if (!relPath.startsWith('/media/')) return false;
  if (relPath.startsWith('/media/real_')) return false;
  return true;
}

export function buildCandidateUrls(src?: string): string[] {
  if (!src) return [];
  if (src.startsWith('data:') || src.startsWith('blob:')) return [src];
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

  if (activeVideoSrc) {
    return (
      <video
        ref={videoRef}
        key={activeVideoSrc}
        src={activeVideoSrc}
        poster={posterUrl}
        autoPlay={playing}
        loop={loop}
        muted={muted}
        playsInline
        controls={controls}
        className={className}
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
