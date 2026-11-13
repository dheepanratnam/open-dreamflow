import React, { useState } from 'react';
import {
  ArrowLeft,
  Check,
  Clapperboard,
  Download,
  Film,
  Link2,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { useStudioStore, type ShareableBeatInput } from '../store/useStudioStore';
import type {
  AspectRatio,
  CameraTransitionCurve,
  ResolutionTier,
} from '../types/studio';
import { estimateZeroMarkupCostUsd } from '../services/executionRouter';
import { SmartMediaImage } from './SmartMedia';

const CURVES: CameraTransitionCurve[] = [
  'Dolly In',
  'Orbit 180°',
  'Crane Up',
  'Whip Pan',
  'FPV Dive',
  'Dolly Out',
  'Rack Focus',
];

const INITIAL_BEATS: ShareableBeatInput[] = [
  {
    id: 'beat-1',
    title: 'Beat 01 · Limestone Courtyard Daylight',
    prompt:
      'Wide 35mm Kodak Vision3 250D establishing shot of @Clara_Vidal in sunlit Mediterranean limestone courtyard, dappled olive shadows',
    imageUrl: '/media/real_courtyard_sun.jpg',
    videoUrl: '/media/real_shot01_courtyard.mp4',
    durationSec: 6,
    cameraCurve: 'Dolly In',
  },
  {
    id: 'beat-2',
    title: 'Beat 02 · Courtyard → Atlantic Cliffs Bridge',
    prompt:
      'Smooth optical keyframe bridge carrying camera from warm terracotta archways out to windswept coastal limestone cliffs at golden hour',
    imageUrl: '/media/real_coastal_cliffs.jpg',
    videoUrl: '/media/real_shot02_bridge.mp4',
    durationSec: 6,
    cameraCurve: 'Orbit 180°',
  },
  {
    id: 'beat-3',
    title: 'Beat 03 · Atelier Contact Table',
    prompt:
      'Intimate 50mm Leica Summilux close-up inside quiet daylight studio as @Clara_Vidal inspects silver-gelatin contact prints beside @Leica_M6',
    imageUrl: '/media/real_atelier_interior.jpg',
    videoUrl: '/media/real_shot03_atelier.mp4',
    durationSec: 6,
    cameraCurve: 'Crane Up',
  },
];

export const ShareableAppView: React.FC = () => {
  const {
    projectTitle,
    elements,
    activeProvider,
    mcpHealth,
    masterRenderUrl,
    appSynthesizing,
    appRenderLog,
    setActiveView,
    copyShareableRecipeUrl,
    synthesizeShareableAppFilm,
  } = useStudioStore();

  const [filmTitle, setFilmTitle] = useState(`${projectTitle} · Shareable App`);
  const [selectedHandles, setSelectedHandles] = useState<string[]>([
    '@Clara_Vidal',
    '@Leica_M6',
  ]);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('16:9');
  const [resolution, setResolution] = useState<ResolutionTier>('720p');
  const [beats, setBeats] = useState<ShareableBeatInput[]>(INITIAL_BEATS);

  const totalSec = beats.reduce((acc, b) => acc + b.durationSec, 0);
  const rawCostUsd = estimateZeroMarkupCostUsd(
    activeProvider,
    'video',
    totalSec,
    resolution
  );

  const toggleHandle = (handle: string) => {
    setSelectedHandles((cur) =>
      cur.includes(handle) ? cur.filter((h) => h !== handle) : [...cur, handle]
    );
  };

  return (
    <div className="w-full h-full bg-[#0e0e0e] text-[#f5f5f5] flex flex-col overflow-hidden select-none">
      {/* Top Floating-Style Matte Header */}
      <div className="h-[52px] px-5 bg-[#191919] border-b border-white/[0.08] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setActiveView('canvas')}
            className="h-8 px-3 rounded-[8px] bg-[#252525] hover:bg-[#2e2e2e] border border-white/[0.08] text-[12px] font-medium text-white/90 flex items-center gap-1.5 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" strokeWidth={1.5} />
            <span>Back to Canvas</span>
          </button>
          <div className="h-4 w-px bg-white/[0.08]" />
          <span className="text-[13.5px] font-semibold text-white">
            Shareable Film App Template
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="h-8 px-3 rounded-[8px] bg-[#252525] font-mono text-[11.5px] text-white/80 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-[#face15]" strokeWidth={1.75} />
            <span>${rawCostUsd.toFixed(2)} raw · 0% markup</span>
          </span>
          <button
            type="button"
            onClick={() => copyShareableRecipeUrl()}
            className="h-8 px-3 rounded-[8px] bg-[#252525] hover:bg-[#2e2e2e] text-[12px] text-white/90 flex items-center gap-1.5"
          >
            <Link2 className="w-3.5 h-3.5" strokeWidth={1.5} />
            <span>Copy ?recipe= Link</span>
          </button>
        </div>
      </div>

      {/* Two-Column Clean Matte Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-[1220px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Form Column */}
          <div className="lg:col-span-7 space-y-5">
            <div className="p-5 rounded-[14px] bg-[#191919] border border-white/[0.08] space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-2">
                  <label className="block text-[11px] text-white/45 mb-1">
                    App Sequence Title
                  </label>
                  <input
                    value={filmTitle}
                    onChange={(e) => setFilmTitle(e.target.value)}
                    className="w-full h-9 px-3 rounded-[8px] bg-[#252525] border border-white/[0.08] text-[13px] text-white outline-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] text-white/45 mb-1">
                      Aspect
                    </label>
                    <select
                      value={aspectRatio}
                      onChange={(e) =>
                        setAspectRatio(e.target.value as AspectRatio)
                      }
                      className="w-full h-9 px-2 rounded-[8px] bg-[#252525] border border-white/[0.08] text-[12px] text-white outline-none"
                    >
                      <option value="16:9">16:9</option>
                      <option value="9:16">9:16</option>
                      <option value="21:9">21:9</option>
                      <option value="1:1">1:1</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] text-white/45 mb-1">
                      Tier
                    </label>
                    <select
                      value={resolution}
                      onChange={(e) =>
                        setResolution(e.target.value as ResolutionTier)
                      }
                      className="w-full h-9 px-2 rounded-[8px] bg-[#252525] border border-white/[0.08] text-[12px] text-white outline-none"
                    >
                      <option value="720p">720p</option>
                      <option value="1080p">1080p</option>
                      <option value="4K">4K</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* @Elements Lock */}
              <div>
                <div className="text-[11px] text-white/45 mb-2">
                  Locked @Element Vaults
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {elements.map((el) => {
                    const active = selectedHandles.includes(el.handle);
                    return (
                      <button
                        key={el.id}
                        type="button"
                        onClick={() => toggleHandle(el.handle)}
                        className={`p-2 rounded-[10px] border flex items-center gap-2.5 text-left transition-colors ${
                          active
                            ? 'bg-[#252525] border-white/45'
                            : 'bg-[#141414] border-white/[0.08] hover:border-white/20'
                        }`}
                      >
                        <div className="w-9 h-9 rounded-[6px] overflow-hidden bg-[#222222] shrink-0">
                          <SmartMediaImage
                            src={el.references[0]?.dataUrl}
                            alt={el.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-[12px] font-medium text-white truncate">
                            {el.handle}
                          </div>
                          <div className="text-[10.5px] text-white/45 truncate">
                            {el.category}
                          </div>
                        </div>
                        {active && (
                          <Check
                            className="w-3.5 h-3.5 text-white shrink-0"
                            strokeWidth={1.75}
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Storyboard Beats */}
            <div className="space-y-2.5">
              {beats.map((beat, idx) => (
                <div
                  key={beat.id}
                  className="p-3.5 rounded-[12px] bg-[#191919] border border-white/[0.08] flex gap-3.5"
                >
                  <div className="w-[132px] aspect-video rounded-[8px] overflow-hidden bg-[#141414] border border-white/[0.08] shrink-0">
                    <SmartMediaImage
                      src={beat.imageUrl}
                      alt={beat.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1 space-y-2 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <input
                        value={beat.title}
                        onChange={(e) =>
                          setBeats((cur) =>
                            cur.map((b, i) =>
                              i === idx ? { ...b, title: e.target.value } : b
                            )
                          )
                        }
                        className="bg-transparent text-[12.5px] font-medium text-white outline-none flex-1"
                      />
                      <div className="flex items-center gap-1.5">
                        <select
                          value={beat.cameraCurve}
                          onChange={(e) =>
                            setBeats((cur) =>
                              cur.map((b, i) =>
                                i === idx
                                  ? {
                                      ...b,
                                      cameraCurve: e.target
                                        .value as CameraTransitionCurve,
                                    }
                                  : b
                              )
                            )
                          }
                          className="h-6 px-2 rounded-[6px] bg-[#252525] text-[11px] text-white/85 outline-none"
                        >
                          {CURVES.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                        {beats.length > 1 && (
                          <button
                            type="button"
                            onClick={() =>
                              setBeats((cur) => cur.filter((_, i) => i !== idx))
                            }
                            className="w-6 h-6 rounded-[6px] hover:bg-white/[0.08] flex items-center justify-center text-white/45 hover:text-white"
                          >
                            <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                          </button>
                        )}
                      </div>
                    </div>
                    <textarea
                      value={beat.prompt}
                      onChange={(e) =>
                        setBeats((cur) =>
                          cur.map((b, i) =>
                            i === idx ? { ...b, prompt: e.target.value } : b
                          )
                        )
                      }
                      rows={2}
                      className="w-full bg-[#141414] rounded-[8px] px-2.5 py-1.5 text-[12px] text-white/85 outline-none resize-none border border-white/[0.06]"
                    />
                  </div>
                </div>
              ))}

              <button
                type="button"
                onClick={() =>
                  setBeats((cur) => [
                    ...cur,
                    {
                      id: `beat-${Date.now()}`,
                      title: `Beat 0${cur.length + 1} · New Shot`,
                      prompt:
                        'Natural daylight Steadicam follow shot locking @Clara_Vidal along sunlit limestone terrace',
                      imageUrl: '/media/real_courtyard_sun.jpg',
                      videoUrl: '/media/real_shot01_courtyard.mp4',
                      durationSec: 6,
                      cameraCurve: 'Dolly In',
                    },
                  ])
                }
                className="w-full h-9 rounded-[10px] border border-dashed border-white/[0.15] hover:border-white/35 text-[12px] text-white/70 hover:text-white flex items-center justify-center gap-1.5 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" strokeWidth={1.5} />
                <span>Add Story Beat</span>
              </button>
            </div>
          </div>

          {/* Right Master Output Column */}
          <div className="lg:col-span-5 space-y-4">
            <div className="p-5 rounded-[14px] bg-[#191919] border border-white/[0.08] space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Film className="w-4 h-4 text-white/75" strokeWidth={1.5} />
                  <span className="text-[13px] font-semibold text-white">
                    Master Output Preview
                  </span>
                </div>
                <span className="font-mono text-[11px] text-white/50">
                  {mcpHealth.online ? 'FFmpeg 8.0 Live' : 'Browser Render'}
                </span>
              </div>

              <div className="aspect-video rounded-[10px] overflow-hidden bg-[#121212] border border-white/[0.08]">
                <video
                  key={masterRenderUrl || '/media/real_salt_terracotta_master.mp4'}
                  src={masterRenderUrl || '/media/real_salt_terracotta_master.mp4'}
                  poster="/media/real_courtyard_sun.jpg"
                  controls
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="w-full h-full object-cover"
                />
              </div>

              <button
                type="button"
                disabled={appSynthesizing}
                onClick={() =>
                  void synthesizeShareableAppFilm({
                    title: filmTitle,
                    selectedHandles,
                    beats,
                    aspectRatio,
                    resolution,
                  })
                }
                className="w-full h-10 rounded-[10px] bg-white hover:bg-[#e5e5e5] text-[#0e0e0e] text-[13px] font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-60"
              >
                {appSynthesizing ? (
                  <Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.75} />
                ) : (
                  <Clapperboard className="w-4 h-4" strokeWidth={1.75} />
                )}
                <span>
                  {appSynthesizing
                    ? 'Synthesizing Multi-Beat Film…'
                    : `Synthesize ${totalSec}s Master Film`}
                </span>
              </button>

              {masterRenderUrl && (
                <a
                  href={masterRenderUrl}
                  download="open-dreamflow-app-film.mp4"
                  className="w-full h-9 rounded-[9px] bg-[#252525] hover:bg-[#303030] text-[12px] text-white/90 flex items-center justify-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" strokeWidth={1.5} />
                  <span>Download Master .mp4</span>
                </a>
              )}

              {appRenderLog.length > 0 && (
                <div className="p-3 rounded-[9px] bg-[#141414] border border-white/[0.06] font-mono text-[11px] text-white/65 space-y-1 max-h-[150px] overflow-y-auto">
                  {appRenderLog.map((line, i) => (
                    <div key={i}>{line}</div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
