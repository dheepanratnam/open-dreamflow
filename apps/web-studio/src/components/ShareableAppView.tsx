import React, { useState } from 'react';
import {
  Check,
  Clapperboard,
  DollarSign,
  Download,
  Film,
  Layers,
  Link2,
  Plus,
  Sparkles,
  Trash2,
  Zap,
} from 'lucide-react';
import { useStudioStore, type ShareableBeatInput } from '../store/useStudioStore';
import type {
  AspectRatio,
  CameraTransitionCurve,
  ResolutionTier,
} from '../types/studio';
import { estimateZeroMarkupCostUsd } from '../services/executionRouter';
import { SmartMediaImage, SmartMediaVideo } from './SmartMedia';

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
    title: 'Beat 01 · Rooftop Rain Hook',
    prompt:
      'Wide anamorphic establishing shot on rain-slicked Neo-Tokyo rooftop ledge, cyan neon reflections',
    imageUrl: '/media/shot01_rooftop.png',
    videoUrl: '/media/shot01_rooftop.mp4',
    durationSec: 7,
    cameraCurve: 'Dolly In',
  },
  {
    id: 'beat-2',
    title: 'Beat 02 · Shinjuku Alley Pursuit',
    prompt:
      'High-energy tracking sprint down wet Shinjuku neon alley, glowing kinetic sneaker sole splashing rainwater',
    imageUrl: '/media/shot02_alley_chase.png',
    videoUrl: '/media/shot02_alley_chase.mp4',
    durationSec: 7,
    cameraCurve: 'Orbit 180°',
  },
  {
    id: 'beat-3',
    title: 'Beat 03 · Golden Dawn Climax',
    prompt:
      'Multi-turn lighting reveal as golden dawn sunlight breaks through Neo-Tokyo storm clouds over hero product silhouette',
    imageUrl: '/media/shot02b_sunrise_remix.png',
    videoUrl: '/media/shot02b_sunrise_remix.mp4',
    durationSec: 7,
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
    synthesizeShareableAppFilm,
    copyShareableRecipeUrl,
    setActiveView,
    openProviderModal,
  } = useStudioStore();

  const [filmTitle, setFilmTitle] = useState(projectTitle);
  const [selectedHandles, setSelectedHandles] = useState<string[]>([
    '@Hero_Kael',
    '@Cyber_Sneaker',
    '@Brand_Style',
  ]);
  const [beats, setBeats] = useState<ShareableBeatInput[]>(INITIAL_BEATS);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('16:9');
  const [resolution, setResolution] = useState<ResolutionTier>('1080p');
  const [activePreviewUrl, setActivePreviewUrl] = useState<string | null>(null);

  const totalDurationSec = beats.reduce((acc, b) => acc + b.durationSec, 0);

  const rawByokCost = estimateZeroMarkupCostUsd(
    activeProvider,
    'video',
    totalDurationSec,
    resolution
  );
  const saasEquivalentCost = Number((totalDurationSec * 0.14).toFixed(2));

  const toggleHandle = (handle: string) => {
    setSelectedHandles((prev) =>
      prev.includes(handle) ? prev.filter((h) => h !== handle) : [...prev, handle]
    );
  };

  const updateBeat = (id: string, patch: Partial<ShareableBeatInput>) => {
    setBeats((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  };

  const addStoryBeat = () => {
    if (beats.length >= 6) return;
    const idx = beats.length + 1;
    setBeats((prev) => [
      ...prev,
      {
        id: `beat-${Date.now()}`,
        title: `Beat 0${idx} · Encore Cut`,
        prompt:
          'Macro slow-motion hero reveal with volumetric neon rain speculars and anamorphic bokeh',
        imageUrl: '/media/shot01_rooftop.png',
        videoUrl: '/media/shot01_rooftop.mp4',
        durationSec: 6,
        cameraCurve: 'Dolly In',
      },
    ]);
  };

  const removeBeat = (id: string) => {
    if (beats.length <= 1) return;
    setBeats((prev) => prev.filter((b) => b.id !== id));
  };

  const handleSynthesize = async () => {
    setActivePreviewUrl(null);
    const outUrl = await synthesizeShareableAppFilm({
      title: filmTitle,
      selectedHandles,
      beats,
      aspectRatio,
      resolution,
    });
    if (outUrl) {
      setActivePreviewUrl(outUrl);
    }
  };

  const playerVideoUrl =
    activePreviewUrl || masterRenderUrl || beats[0]?.videoUrl || '/media/shot01_rooftop.mp4';

  return (
    <div className="w-full h-full overflow-y-auto bg-[#07080C] px-4 sm:px-6 py-6 pb-36">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-[#111628] via-[#15122A] to-[#0D1A22] border border-emerald-500/30 shadow-2xl">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 font-mono text-[10px] font-bold flex items-center gap-1">
                <Zap className="w-3 h-3" /> SHAREABLE APP MODE · ZERO-JARGON TEMPLATE
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-violet-500/20 border border-violet-400/40 text-violet-200 font-mono text-[10px] font-semibold">
                WEAVE / DREAMINA 2.0 WORKFLOW RUNNER
              </span>
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-white">
              1-Click Multi-Shot Film & Commercial Synthesizer
            </h2>
            <p className="text-xs text-slate-300 max-w-2xl">
              Share any Spatial Canvas graph as a clean consumer app. Pick locked{' '}
              <code className="text-violet-300">@Elements</code>, customize story beats, and
              compile a stitched H.264 + Stereo Audio <code className="text-emerald-300">.mp4</code>{' '}
              at $0 platform markup.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={copyShareableRecipeUrl}
              className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-sky-300 flex items-center gap-1.5 transition"
            >
              <Link2 className="w-3.5 h-3.5" />
              <span>Copy App `?recipe=` Link</span>
            </button>
            <button
              onClick={() => setActiveView('canvas')}
              className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-200 flex items-center gap-1.5 transition"
            >
              <Layers className="w-3.5 h-3.5 text-violet-400" />
              <span>Inspect Node Graph</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Zero-Jargon Consumer Controls */}
          <div className="lg:col-span-7 space-y-5">
            <div className="p-4 rounded-2xl bg-[#0D111B] border border-slate-800/90 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  1. Film Title & Continuity Cast (`@Elements`)
                </label>
                <span className="text-[11px] font-mono text-emerald-400">
                  {selectedHandles.length} Continuity Vaults Locked
                </span>
              </div>

              <input
                type="text"
                value={filmTitle}
                onChange={(e) => setFilmTitle(e.target.value)}
                placeholder="Enter film or campaign title..."
                className="w-full bg-slate-950 border border-slate-800 focus:border-violet-500 rounded-xl px-3.5 py-2 text-sm font-semibold text-white focus:outline-none"
              />

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {elements.map((vault) => {
                  const active = selectedHandles.includes(vault.handle);
                  const coverUrl = vault.references[0]?.dataUrl;
                  return (
                    <button
                      key={vault.id}
                      type="button"
                      onClick={() => toggleHandle(vault.handle)}
                      className={`p-2.5 rounded-xl border text-left transition flex items-center gap-2.5 ${
                        active
                          ? 'bg-violet-600/20 border-violet-400 shadow-glow-dream'
                          : 'bg-slate-950/80 border-slate-800 hover:border-slate-700 opacity-75'
                      }`}
                    >
                      <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0 border border-white/10 bg-slate-900">
                        <SmartMediaImage
                          src={coverUrl}
                          alt={vault.name}
                          className="w-full h-full object-cover"
                          fallbackPrompt={vault.name}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-mono text-xs font-bold text-white truncate">
                            {vault.handle}
                          </span>
                          {active && (
                            <span className="w-4 h-4 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center shrink-0">
                              <Check className="w-2.5 h-2.5 stroke-[3]" />
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-300 truncate">{vault.name}</div>
                        <div className="text-[10px] font-mono text-slate-400">
                          {vault.references.length}/6 refs
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-[#0D111B] border border-slate-800/90 space-y-3.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  2. Story Beats ({beats.length} Shots · {totalDurationSec}s Total)
                </label>
                <button
                  type="button"
                  onClick={addStoryBeat}
                  disabled={beats.length >= 6}
                  className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-40 border border-slate-700 text-xs font-semibold text-violet-300 flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Story Beat
                </button>
              </div>

              <div className="space-y-3">
                {beats.map((beat, index) => (
                  <div
                    key={beat.id}
                    className="p-3 rounded-xl bg-slate-950/90 border border-slate-800 hover:border-slate-700 transition flex flex-col sm:flex-row gap-3"
                  >
                    <div className="w-full sm:w-36 h-24 rounded-lg overflow-hidden shrink-0 relative border border-slate-800 bg-black">
                      <SmartMediaImage
                        src={beat.imageUrl}
                        alt={beat.title}
                        className="w-full h-full object-cover"
                        fallbackPrompt={beat.prompt}
                        fallbackSeed={900 + index * 77}
                      />
                      <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/80 font-mono text-[10px] font-bold text-violet-300">
                        SHOT 0{index + 1}
                      </span>
                    </div>

                    <div className="flex-1 space-y-2 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <input
                          type="text"
                          value={beat.title}
                          onChange={(e) => updateBeat(beat.id, { title: e.target.value })}
                          className="bg-transparent text-xs font-bold text-white focus:outline-none flex-1"
                        />
                        <div className="flex items-center gap-1.5 shrink-0">
                          <select
                            value={beat.cameraCurve}
                            onChange={(e) =>
                              updateBeat(beat.id, {
                                cameraCurve: e.target.value as CameraTransitionCurve,
                              })
                            }
                            className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-0.5 text-[11px] text-sky-300 font-medium"
                          >
                            {CURVES.map((c) => (
                              <option key={c} value={c}>
                                {c}
                              </option>
                            ))}
                          </select>

                          <select
                            value={beat.durationSec}
                            onChange={(e) =>
                              updateBeat(beat.id, { durationSec: Number(e.target.value) })
                            }
                            className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-0.5 text-[11px] font-mono text-slate-200"
                          >
                            {[4, 6, 7, 8, 10, 12, 15].map((sec) => (
                              <option key={sec} value={sec}>
                                {sec}s
                              </option>
                            ))}
                          </select>

                          {beats.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeBeat(beat.id)}
                              className="p-1 text-slate-500 hover:text-rose-400"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      <textarea
                        rows={2}
                        value={beat.prompt}
                        onChange={(e) => updateBeat(beat.id, { prompt: e.target.value })}
                        className="w-full bg-slate-900/90 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 resize-none focus:outline-none focus:border-violet-500"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-[#0D111B] border border-slate-800/90 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    3. Aspect Ratio
                  </label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {(['16:9', '9:16', '21:9', '1:1'] as AspectRatio[]).map((ratio) => (
                      <button
                        key={ratio}
                        type="button"
                        onClick={() => setAspectRatio(ratio)}
                        className={`py-1.5 rounded-lg text-xs font-mono font-semibold border transition ${
                          aspectRatio === ratio
                            ? 'bg-violet-600 border-violet-400 text-white'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        {ratio}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    4. Master Resolution
                  </label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {(['720p', '1080p', '2K', '4K'] as ResolutionTier[]).map((res) => (
                      <button
                        key={res}
                        type="button"
                        onClick={() => setResolution(res)}
                        className={`py-1.5 rounded-lg text-xs font-mono font-semibold border transition ${
                          resolution === res
                            ? 'bg-sky-500 border-sky-300 text-slate-950 font-bold'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        {res}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Zero-Markup Cost Ticker */}
              <div className="p-3 rounded-xl bg-emerald-950/25 border border-emerald-500/35 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center shrink-0">
                    <DollarSign className="w-4 h-4 text-emerald-300" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-emerald-200 flex items-center gap-2">
                      <span>
                        Zero-Markup Pass-Through Cost: ${rawByokCost.toFixed(2)} USD
                      </span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                        $0.00 PLATFORM FEE
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Engine:{' '}
                      <span className="text-slate-200 font-mono">
                        {mcpHealth.online
                          ? 'Live :3001 FFmpeg + MCP ($0 Local)'
                          : activeProvider}
                      </span>{' '}
                      · Typical SaaS wrapper price:{' '}
                      <span className="line-through text-rose-400">
                        ${saasEquivalentCost.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => openProviderModal('byok')}
                  className="text-[11px] font-mono text-emerald-300 hover:underline shrink-0"
                >
                  Switch Engine →
                </button>
              </div>

              <button
                type="button"
                onClick={handleSynthesize}
                disabled={appSynthesizing}
                className="w-full py-3.5 px-5 rounded-xl bg-gradient-to-r from-violet-600 via-fuchsia-600 to-sky-500 hover:from-violet-500 hover:via-fuchsia-500 hover:to-sky-400 disabled:opacity-50 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-glow-dream transition"
              >
                <Clapperboard className="w-4 h-4" />
                <span>
                  {appSynthesizing
                    ? 'Synthesizing & Stitching Multi-Shot Film (.mp4)...'
                    : `Synthesize Multi-Shot Film (.mp4) · ${totalDurationSec}s`}
                </span>
              </button>
            </div>
          </div>

          {/* Right Column: Live Master Cinema Player */}
          <div className="lg:col-span-5 space-y-4">
            <div className="p-4 rounded-2xl bg-[#0D111B] border border-violet-500/35 shadow-2xl space-y-3.5 sticky top-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Film className="w-4 h-4 text-violet-400" />
                  <span className="text-xs font-bold text-white uppercase tracking-wider">
                    Master Cinema Player (.mp4)
                  </span>
                </div>
                <span className="px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 font-mono text-[10px] text-emerald-300">
                  H.264 · AAC STEREO
                </span>
              </div>

              <div className="relative aspect-video w-full rounded-xl overflow-hidden bg-black border border-slate-800 shadow-inner">
                <SmartMediaVideo
                  videoUrl={playerVideoUrl}
                  posterUrl={beats[0]?.imageUrl || '/media/shot01_rooftop.png'}
                  playing
                  muted={false}
                  controls
                  loop
                  className="w-full h-full object-contain bg-black"
                  fallbackPrompt={filmTitle}
                  fallbackSeed={777}
                  fallbackDurationSec={totalDurationSec}
                />
              </div>

              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="text-xs text-slate-300 font-medium truncate">
                  {filmTitle} ({aspectRatio} · {resolution})
                </div>

                {playerVideoUrl && (
                  <a
                    href={playerVideoUrl}
                    download={`${filmTitle
                      .toLowerCase()
                      .replace(/[^a-z0-9]+/g, '-')}-master.mp4`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 transition"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download .mp4</span>
                  </a>
                )}
              </div>

              {/* Shot Selector Strip */}
              <div className="space-y-1.5 pt-1 border-t border-slate-800/80">
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span>Quick Preview Reel:</span>
                  {masterRenderUrl && (
                    <button
                      type="button"
                      onClick={() => setActivePreviewUrl(masterRenderUrl)}
                      className="text-violet-300 hover:underline font-mono text-[10px]"
                    >
                      Play Stitched Master Cut
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {beats.slice(0, 3).map((b, idx) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() =>
                        setActivePreviewUrl(b.videoUrl || '/media/shot01_rooftop.mp4')
                      }
                      className="group relative h-16 rounded-lg overflow-hidden border border-slate-800 hover:border-violet-400 transition"
                    >
                      <SmartMediaImage
                        src={b.imageUrl}
                        alt={b.title}
                        className="w-full h-full object-cover"
                        fallbackPrompt={b.prompt}
                        fallbackSeed={300 + idx}
                      />
                      <span className="absolute inset-x-0 bottom-0 bg-black/75 text-[9px] font-mono text-white py-0.5 truncate px-1">
                        Shot 0{idx + 1} · {b.durationSec}s
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {appRenderLog.length > 0 && (
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 font-mono text-[11px] text-emerald-300 space-y-1 max-h-36 overflow-y-auto">
                  {appRenderLog.map((line, idx) => (
                    <div key={idx} className="flex items-start gap-1.5">
                      <Sparkles className="w-3 h-3 text-violet-400 shrink-0 mt-0.5" />
                      <span>{line}</span>
                    </div>
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
