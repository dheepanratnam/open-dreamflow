import React, { useState } from 'react';
import {
  ArrowRight,
  Clapperboard,
  Film,
  Image as ImageIcon,
  Lock,
  Play,
  Plus,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react';
import { useStudioStore } from '../store/useStudioStore';
import type { CameraTransitionCurve } from '../types/studio';
import { SmartMediaImage, SmartMediaVideo } from './SmartMedia';

const CURVES: CameraTransitionCurve[] = [
  'Dolly In',
  'Dolly Out',
  'Orbit 180°',
  'Crane Up',
  'Whip Pan',
  'FPV Dive',
  'Rack Focus',
];

function getCurveSvgPath(curve: CameraTransitionCurve): string {
  switch (curve) {
    case 'Dolly In':
      return 'M 4 28 C 28 28, 44 6, 76 4';
    case 'Dolly Out':
      return 'M 4 4 C 30 6, 48 28, 76 28';
    case 'Orbit 180°':
      return 'M 4 16 C 24 2, 56 30, 76 16';
    case 'Crane Up':
      return 'M 4 28 Q 40 24, 76 4';
    case 'Whip Pan':
      return 'M 4 28 C 36 28, 40 4, 76 4';
    case 'FPV Dive':
      return 'M 4 6 C 26 4, 52 30, 76 26';
    case 'Rack Focus':
      return 'M 4 22 Q 40 4, 76 22';
  }
}

export const MultiframeChain: React.FC = () => {
  const {
    multiframes,
    bridges,
    nodes,
    addMultiframeFromNodeOrBlank,
    removeMultiframeCard,
    updateMultiframeCard,
    updateMultiframeBridge,
    synthesizeMultiframeSequence,
  } = useStudioStore();

  const [synthesizing, setSynthesizing] = useState(false);
  const [selectedCanvasNodeId, setSelectedCanvasNodeId] = useState<string>('');
  const [previewVideoByCard, setPreviewVideoByCard] = useState<Record<string, boolean>>({
    'mf-1': true,
    'mf-2': true,
    'mf-3': true,
  });

  const totalSequenceSec = bridges.reduce((acc, b) => acc + b.durationSec, 0);
  const imageOrVideoNodes = nodes.filter(
    (n) => n.kind === 'image' || n.kind === 'video'
  );

  const handleUploadCardImage = (
    cardId: string,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        updateMultiframeCard(cardId, { imageUrl: reader.result });
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  return (
    <div className="w-full h-full overflow-y-auto bg-[#07080C] px-6 py-6 pb-36">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-[#111524] via-[#13182B] to-[#0E1624] border border-violet-500/30 shadow-xl">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-md bg-violet-500/20 border border-violet-400/40 text-violet-300 font-mono text-[10px] font-semibold">
                DREAMINA 2.0 SMART MULTIFRAMES
              </span>
              <span className="px-2 py-0.5 rounded-md bg-sky-500/20 border border-sky-400/40 text-sky-300 font-mono text-[10px] font-semibold">
                GEMINI OMNI 1.2 · FIRST/LAST + 10S CONTEXT
              </span>
            </div>
            <h2 className="text-lg font-bold text-white">
              Smart Multiframe Keyframe Chain ({multiframes.length}/10 Keyframes ·{' '}
              {totalSequenceSec}s Total Sequence)
            </h2>
            <p className="text-xs text-slate-400">
              Chain 2 to 10 keyframe cards with custom camera velocity curves (3s–15s per
              bridge). Each segment locks First & Last keyframes plus 10s temporal motion
              context via `:3001` FFmpeg / Omni 1.2.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap shrink-0">
            <select
              value={selectedCanvasNodeId}
              onChange={(e) => setSelectedCanvasNodeId(e.target.value)}
              className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200"
            >
              <option value="">+ Blank / Procedural Keyframe</option>
              {imageOrVideoNodes.map((n) => (
                <option key={n.id} value={n.id}>
                  From Canvas: {n.title}
                </option>
              ))}
            </select>

            <button
              onClick={() =>
                addMultiframeFromNodeOrBlank(selectedCanvasNodeId || undefined)
              }
              disabled={multiframes.length >= 10}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 border border-slate-600 text-xs font-semibold text-white flex items-center gap-1.5 transition"
            >
              <Plus className="w-4 h-4 text-violet-400" />
              <span>Add Keyframe ({multiframes.length}/10)</span>
            </button>

            <button
              onClick={async () => {
                setSynthesizing(true);
                try {
                  await synthesizeMultiframeSequence();
                } finally {
                  setSynthesizing(false);
                }
              }}
              disabled={synthesizing}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-sky-500 hover:from-violet-500 hover:to-sky-400 text-white font-semibold text-xs flex items-center gap-2 shadow-glow-dream transition"
            >
              <Clapperboard className="w-4 h-4" />
              <span>
                {synthesizing
                  ? 'Synthesizing Chain via :3001...'
                  : 'Synthesize Chain → Canvas & Timeline'}
              </span>
            </button>
          </div>
        </div>

        <div className="flex items-stretch gap-3 overflow-x-auto pb-4 pt-1">
          {multiframes.map((card, idx) => {
            const bridge = bridges.find((b) => b.fromCardId === card.id);
            const showMotion = Boolean(card.videoUrl && (previewVideoByCard[card.id] ?? true));

            return (
              <React.Fragment key={card.id}>
                <div className="w-[290px] shrink-0 rounded-2xl bg-[#0E121C] border border-slate-800 hover:border-violet-500/45 transition flex flex-col overflow-hidden shadow-lg">
                  <div className="flex items-center justify-between px-3 py-2 bg-slate-900/90 border-b border-slate-800">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="px-1.5 py-0.5 rounded bg-violet-600 text-[10px] font-mono font-bold text-white">
                        KF 0{idx + 1}
                      </span>
                      <input
                        type="text"
                        value={card.title}
                        onChange={(e) =>
                          updateMultiframeCard(card.id, { title: e.target.value })
                        }
                        className="bg-transparent text-xs font-semibold text-slate-100 focus:outline-none truncate"
                      />
                    </div>
                    {multiframes.length > 2 && (
                      <button
                        onClick={() => removeMultiframeCard(card.id)}
                        className="p-1 text-slate-500 hover:text-rose-400 transition"
                        title="Remove keyframe"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="relative h-40 bg-slate-950 overflow-hidden group">
                    {showMotion ? (
                      <SmartMediaVideo
                        videoUrl={card.videoUrl}
                        posterUrl={card.imageUrl}
                        playing
                        muted
                        loop
                        className="w-full h-full object-cover"
                        fallbackPrompt={card.prompt}
                        fallbackSeed={1200 + idx * 97}
                        aspectRatio={card.aspectRatio}
                      />
                    ) : (
                      <SmartMediaImage
                        src={card.imageUrl}
                        alt={card.title}
                        className="w-full h-full object-cover"
                        aspectRatio={card.aspectRatio}
                        fallbackPrompt={card.prompt}
                        fallbackSeed={1200 + idx * 97}
                      />
                    )}

                    {card.videoUrl && (
                      <button
                        onClick={() =>
                          setPreviewVideoByCard((p) => ({
                            ...p,
                            [card.id]: !(p[card.id] ?? true),
                          }))
                        }
                        className="absolute bottom-2 left-2 px-2 py-0.5 rounded-md bg-black/75 hover:bg-violet-600/90 text-[10px] font-mono text-white flex items-center gap-1 transition"
                      >
                        {showMotion ? (
                          <>
                            <ImageIcon className="w-3 h-3 text-sky-300" />
                            <span>Still</span>
                          </>
                        ) : (
                          <>
                            <Play className="w-3 h-3 text-emerald-300" />
                            <span>MP4</span>
                          </>
                        )}
                      </button>
                    )}

                    <label className="opacity-0 group-hover:opacity-100 absolute bottom-2 right-2 px-2.5 py-1 rounded-lg bg-black/80 hover:bg-violet-600 text-[11px] text-white font-medium flex items-center gap-1 cursor-pointer transition">
                      <Upload className="w-3 h-3" />
                      <span>Replace Frame</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleUploadCardImage(card.id, e)}
                        className="hidden"
                      />
                    </label>
                  </div>

                  <div className="p-3 flex-1 flex flex-col justify-between space-y-2">
                    <textarea
                      rows={3}
                      value={card.prompt}
                      onChange={(e) =>
                        updateMultiframeCard(card.id, { prompt: e.target.value })
                      }
                      className="w-full bg-slate-950/90 border border-slate-800 rounded-lg p-2 text-[11px] text-slate-200 resize-none focus:outline-none focus:border-violet-500"
                    />
                    <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                      <span className="flex items-center gap-1 text-emerald-400">
                        <Lock className="w-3 h-3" /> Anchor Locked
                      </span>
                      <span>{card.aspectRatio}</span>
                    </div>
                  </div>
                </div>

                {bridge && (
                  <div className="w-[235px] shrink-0 my-auto rounded-2xl bg-[#121726]/95 border border-sky-500/35 p-3 space-y-2.5 shadow-md">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-sky-300 font-semibold flex items-center gap-1">
                        <Film className="w-3 h-3" /> Bridge {idx + 1}
                        <ArrowRight className="w-3 h-3" />
                        {idx + 2}
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-200 font-mono text-[11px] font-bold">
                        {bridge.durationSec}s
                      </span>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                        <span>3s</span>
                        <span>Duration</span>
                        <span>15s Omni</span>
                      </div>
                      <input
                        type="range"
                        min={3}
                        max={15}
                        value={bridge.durationSec}
                        onChange={(e) =>
                          updateMultiframeBridge(bridge.id, {
                            durationSec: Number(e.target.value),
                          })
                        }
                        className="w-full h-1.5 accent-sky-400"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <select
                        value={bridge.curve}
                        onChange={(e) =>
                          updateMultiframeBridge(bridge.id, {
                            curve: e.target.value as CameraTransitionCurve,
                          })
                        }
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs font-medium text-white"
                      >
                        {CURVES.map((c) => (
                          <option key={c} value={c}>
                            🎥 {c}
                          </option>
                        ))}
                      </select>

                      <div className="h-9 rounded-lg bg-slate-950/90 border border-slate-800 flex items-center justify-between px-2.5">
                        <span className="text-[10px] font-mono text-slate-400">
                          Velocity
                        </span>
                        <svg width="80" height="32" className="overflow-visible">
                          <path
                            d={getCurveSvgPath(bridge.curve)}
                            fill="none"
                            stroke="#38BDF8"
                            strokeWidth="2"
                          />
                        </svg>
                      </div>
                    </div>

                    <input
                      type="text"
                      value={bridge.transitionPrompt}
                      onChange={(e) =>
                        updateMultiframeBridge(bridge.id, {
                          transitionPrompt: e.target.value,
                        })
                      }
                      placeholder="Camera/motion note..."
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-[11px] text-slate-200"
                    />

                    <div className="space-y-1 pt-0.5 text-[10px]">
                      <label className="flex items-center justify-between text-slate-300 cursor-pointer">
                        <span className="flex items-center gap-1">
                          <Sparkles className="w-3 h-3 text-violet-400" /> First/Last Lock
                        </span>
                        <input
                          type="checkbox"
                          checked={bridge.firstLastKeyframeLock}
                          onChange={(e) =>
                            updateMultiframeBridge(bridge.id, {
                              firstLastKeyframeLock: e.target.checked,
                            })
                          }
                          className="accent-violet-500"
                        />
                      </label>
                      <label className="flex items-center justify-between text-slate-300 cursor-pointer">
                        <span>10s Prior Context</span>
                        <input
                          type="checkbox"
                          checked={bridge.useTenSecContextWindow}
                          onChange={(e) =>
                            updateMultiframeBridge(bridge.id, {
                              useTenSecContextWindow: e.target.checked,
                            })
                          }
                          className="accent-sky-500"
                        />
                      </label>
                    </div>
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
};
