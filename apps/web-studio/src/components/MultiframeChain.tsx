import React, { useState } from 'react';
import {
  ArrowLeft,
  Clapperboard,
  Loader2,
  Lock,
  Play,
  Plus,
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
    setActiveView,
    addMultiframeFromNodeOrBlank,
    removeMultiframeCard,
    updateMultiframeCard,
    updateMultiframeBridge,
    synthesizeMultiframeSequence,
  } = useStudioStore();

  const [synthesizing, setSynthesizing] = useState(false);
  const [selectedCanvasNodeId, setSelectedCanvasNodeId] = useState<string>('');
  const [previewVideoByCard, setPreviewVideoByCard] = useState<
    Record<string, boolean>
  >({
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
    const url = URL.createObjectURL(file);
    updateMultiframeCard(cardId, { imageUrl: url });
  };

  return (
    <div className="w-full h-full bg-[#0e0e0e] text-[#f5f5f5] flex flex-col overflow-hidden select-none">
      {/* Matte Top Bar */}
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
            Smart Multiframes · Keyframe Chain ({multiframes.length}/10)
          </span>
          <span className="px-2 py-0.5 rounded-[6px] bg-white/[0.06] font-mono text-[11px] text-white/65">
            {totalSequenceSec}s total
          </span>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={selectedCanvasNodeId}
            onChange={(e) => setSelectedCanvasNodeId(e.target.value)}
            className="h-8 px-2.5 rounded-[8px] bg-[#252525] border border-white/[0.08] text-[12px] text-white/85 outline-none"
          >
            <option value="">+ Blank Keyframe</option>
            {imageOrVideoNodes.map((n) => (
              <option key={n.id} value={n.id}>
                From: {n.title}
              </option>
            ))}
          </select>

          <button
            type="button"
            disabled={multiframes.length >= 10}
            onClick={() =>
              addMultiframeFromNodeOrBlank(selectedCanvasNodeId || undefined)
            }
            className="h-8 px-3 rounded-[8px] bg-[#252525] hover:bg-[#2e2e2e] text-[12px] text-white/90 flex items-center gap-1.5 disabled:opacity-40"
          >
            <Plus className="w-3.5 h-3.5" strokeWidth={1.5} />
            <span>Add Keyframe</span>
          </button>

          <button
            type="button"
            disabled={synthesizing || multiframes.length < 2}
            onClick={async () => {
              setSynthesizing(true);
              await synthesizeMultiframeSequence();
              setSynthesizing(false);
              setActiveView('canvas');
            }}
            className="h-8 px-4 rounded-[8px] bg-white hover:bg-[#e5e5e5] text-[#0e0e0e] text-[12px] font-semibold flex items-center gap-1.5 disabled:opacity-50"
          >
            {synthesizing ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={1.75} />
            ) : (
              <Clapperboard className="w-3.5 h-3.5" strokeWidth={1.75} />
            )}
            <span>
              {synthesizing ? 'Synthesizing…' : 'Synthesize to Canvas'}
            </span>
          </button>
        </div>
      </div>

      {/* Horizontal Keyframe Cards + Transition Bridges */}
      <div className="flex-1 overflow-x-auto p-8 flex items-center gap-4">
        {multiframes.map((card, idx) => {
          const bridge = bridges[idx];
          const showVideo = Boolean(card.videoUrl && previewVideoByCard[card.id]);

          return (
            <React.Fragment key={card.id}>
              <div className="w-[320px] shrink-0 rounded-[14px] bg-[#191919] border border-white/[0.09] overflow-hidden flex flex-col">
                <div className="h-[38px] px-3.5 border-b border-white/[0.06] flex items-center justify-between">
                  <input
                    value={card.title}
                    onChange={(e) =>
                      updateMultiframeCard(card.id, { title: e.target.value })
                    }
                    className="bg-transparent text-[12.5px] font-medium text-white outline-none flex-1"
                  />
                  <div className="flex items-center gap-1">
                    {card.videoUrl && (
                      <button
                        type="button"
                        onClick={() =>
                          setPreviewVideoByCard((p) => ({
                            ...p,
                            [card.id]: !p[card.id],
                          }))
                        }
                        className="w-6 h-6 rounded-[6px] hover:bg-[#252525] flex items-center justify-center text-white/70"
                        title="Toggle video preview"
                      >
                        <Play className="w-3 h-3" strokeWidth={1.5} />
                      </button>
                    )}
                    <label className="w-6 h-6 rounded-[6px] hover:bg-[#252525] flex items-center justify-center text-white/70 cursor-pointer">
                      <Upload className="w-3 h-3" strokeWidth={1.5} />
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleUploadCardImage(card.id, e)}
                      />
                    </label>
                    {multiframes.length > 2 && (
                      <button
                        type="button"
                        onClick={() => removeMultiframeCard(card.id)}
                        className="w-6 h-6 rounded-[6px] hover:bg-red-500/15 flex items-center justify-center text-white/50 hover:text-red-400"
                      >
                        <Trash2 className="w-3 h-3" strokeWidth={1.5} />
                      </button>
                    )}
                  </div>
                </div>

                <div className="aspect-video bg-[#121212] relative overflow-hidden">
                  {showVideo ? (
                    <SmartMediaVideo
                      videoUrl={card.videoUrl}
                      posterUrl={card.imageUrl}
                      fallbackPrompt={card.prompt}
                      fallbackSeed={idx + 101}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <SmartMediaImage
                      src={card.imageUrl}
                      alt={card.title}
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>

                <div className="p-3">
                  <textarea
                    value={card.prompt}
                    onChange={(e) =>
                      updateMultiframeCard(card.id, { prompt: e.target.value })
                    }
                    rows={3}
                    className="w-full rounded-[8px] bg-[#141414] border border-white/[0.06] p-2 text-[12px] text-white/85 outline-none resize-none"
                  />
                </div>
              </div>

              {bridge && (
                <div className="w-[196px] shrink-0 p-3 rounded-[12px] bg-[#191919] border border-white/[0.08] space-y-2.5">
                  <div className="flex items-center justify-between text-[11px] text-white/55">
                    <span>Transition Bridge</span>
                    <span className="font-mono text-[#20D5EC]">
                      {bridge.durationSec}s
                    </span>
                  </div>

                  <svg viewBox="0 0 80 32" className="w-full h-8 bg-[#121212] rounded-[6px] p-1">
                    <path
                      d={getCurveSvgPath(bridge.curve)}
                      fill="none"
                      stroke="#20D5EC"
                      strokeWidth="2"
                    />
                  </svg>

                  <select
                    value={bridge.curve}
                    onChange={(e) =>
                      updateMultiframeBridge(bridge.id, {
                        curve: e.target.value as CameraTransitionCurve,
                      })
                    }
                    className="w-full h-7 px-2 rounded-[6px] bg-[#252525] text-[11.5px] text-white outline-none"
                  >
                    {CURVES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>

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
                    className="w-full accent-white"
                  />

                  <div className="flex items-center gap-1.5 text-[10.5px] text-white/50">
                    <Lock className="w-3 h-3 text-white/60" strokeWidth={1.5} />
                    <span>First/Last Frame Locked</span>
                  </div>
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};
