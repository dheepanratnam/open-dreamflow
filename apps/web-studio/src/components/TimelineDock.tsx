import React, { useEffect, useRef, useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Download,
  Film,
  Mic,
  Pause,
  Play,
  Plus,
  Scissors,
  Video,
  Volume2,
  X,
} from 'lucide-react';
import { useStudioStore } from '../store/useStudioStore';
import { drawCinemaShotFrame } from '../utils/proceduralMedia';
import {
  compileTimelineToWebm,
  downloadTextFile,
  generateFcpxmlDocument,
} from '../utils/exporters';

export const TimelineDock: React.FC = () => {
  const {
    projectTitle,
    timelineExpanded,
    setTimelineExpanded,
    timelineClips,
    playheadSec,
    isPlayingTimeline,
    setPlayheadSec,
    setIsPlayingTimeline,
    addVoiceOrSfxClip,
    removeTimelineClip,
    extractLastFrameToNextShot,
    showToast,
  } = useStudioStore();

  const monitorRef = useRef<HTMLCanvasElement | null>(null);
  const [selectedClipId, setSelectedClipId] = useState<string | undefined>();
  const [compilingWebm, setCompilingWebm] = useState(false);
  const [compilePct, setCompilePct] = useState(0);

  const totalDurationSec = Math.max(
    15,
    ...timelineClips.map((c) => c.startSec + c.durationSec)
  );
  const pxPerSec = 36;

  useEffect(() => {
    if (!isPlayingTimeline) return;
    let raf = 0;
    let lastTs = performance.now();

    const tick = (now: number) => {
      const dt = (now - lastTs) / 1000;
      lastTs = now;
      const next = useStudioStore.getState().playheadSec + dt;
      if (next >= totalDurationSec) {
        setPlayheadSec(0);
        setIsPlayingTimeline(false);
        return;
      }
      setPlayheadSec(next);
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isPlayingTimeline, totalDurationSec, setPlayheadSec, setIsPlayingTimeline]);

  useEffect(() => {
    const canvas = monitorRef.current;
    if (!canvas || !timelineExpanded) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const videoClips = timelineClips
      .filter((c) => c.track === 'video')
      .sort((a, b) => a.startSec - b.startSec);
    const activeClip =
      videoClips.find(
        (c) =>
          playheadSec >= c.startSec && playheadSec <= c.startSec + c.durationSec
      ) || videoClips[0];

    if (activeClip) {
      const localSec = Math.max(0, playheadSec - activeClip.startSec);
      drawCinemaShotFrame(ctx, canvas.width, canvas.height, localSec, {
        prompt: activeClip.promptOrDialogue,
        seed: activeClip.seed || 202,
        theme: activeClip.videoTheme,
        cameraLabel: `TC ${playheadSec.toFixed(1)}s`,
      });
    } else {
      ctx.fillStyle = '#06080F';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  }, [playheadSec, timelineClips, timelineExpanded]);

  const handleCompileWebm = async () => {
    if (compilingWebm) return;
    setCompilingWebm(true);
    setCompilePct(0);
    try {
      const blob = await compileTimelineToWebm(timelineClips, (pct) =>
        setCompilePct(pct)
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${projectTitle
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')}-roughcut.webm`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      showToast('Compiled & downloaded multi-track .webm master via MediaRecorder!');
    } catch (e) {
      showToast(
        `MediaRecorder export error: ${e instanceof Error ? e.message : 'failed'}`
      );
    } finally {
      setCompilingWebm(false);
    }
  };

  const handleExportFcpxml = () => {
    const xml = generateFcpxmlDocument(projectTitle, timelineClips);
    const slug = projectTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    downloadTextFile(`${slug}.fcpxml`, xml, 'application/xml');
    showToast('Exported Premiere Pro / Final Cut Pro .fcpxml v1.10 timeline!');
  };

  const tracks: Array<{
    id: 'video' | 'voice' | 'sfx';
    label: string;
    icon: React.ReactNode;
    accent: string;
  }> = [
    {
      id: 'video',
      label: 'V1 · Video Track',
      icon: <Film className="w-3.5 h-3.5 text-violet-400" />,
      accent: 'border-violet-500/50 bg-violet-600/25',
    },
    {
      id: 'voice',
      label: 'A1 · Voice / Lip-Sync',
      icon: <Mic className="w-3.5 h-3.5 text-emerald-400" />,
      accent: 'border-emerald-500/50 bg-emerald-600/20',
    },
    {
      id: 'sfx',
      label: 'A2 · SFX / Native Audio',
      icon: <Volume2 className="w-3.5 h-3.5 text-amber-400" />,
      accent: 'border-amber-500/50 bg-amber-600/20',
    },
  ];

  return (
    <div className="w-full bg-[#0A0D15]/98 border-t border-slate-800/90 backdrop-blur-xl z-30 shrink-0">
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800/80 gap-2 flex-wrap">
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setTimelineExpanded(!timelineExpanded)}
            className="flex items-center gap-1.5 text-xs font-bold text-slate-200 hover:text-white"
          >
            {timelineExpanded ? (
              <ChevronDown className="w-4 h-4 text-violet-400" />
            ) : (
              <ChevronUp className="w-4 h-4 text-violet-400" />
            )}
            <span>Multi-Track Rough-Cut Timeline</span>
          </button>

          <button
            onClick={() => setIsPlayingTimeline(!isPlayingTimeline)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold transition"
          >
            {isPlayingTimeline ? (
              <Pause className="w-3.5 h-3.5" />
            ) : (
              <Play className="w-3.5 h-3.5" />
            )}
            <span>{isPlayingTimeline ? 'Pause' : 'Play'}</span>
          </button>

          <span className="font-mono text-xs text-sky-300 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
            {playheadSec.toFixed(1)}s / {totalDurationSec.toFixed(1)}s
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() =>
              addVoiceOrSfxClip(
                'voice',
                '@Hero_Kael Lip-Sync Line',
                'Target locked across the skyline.',
                5
              )
            }
            className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[11px] text-emerald-300 flex items-center gap-1"
          >
            <Plus className="w-3 h-3" /> Voice/Lip-Sync
          </button>

          <button
            onClick={() =>
              addVoiceOrSfxClip(
                'sfx',
                'Anamorphic Bass Riser',
                'Sub-bass riser + cybernetic rain sweep',
                5
              )
            }
            className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[11px] text-amber-300 flex items-center gap-1"
          >
            <Plus className="w-3 h-3" /> SFX Cue
          </button>

          <div className="w-px h-4 bg-slate-800" />

          <button
            onClick={() => extractLastFrameToNextShot(selectedClipId)}
            title="Extract exact final pixel frame onto Spatial Canvas as Next-Shot First-Frame Anchor"
            className="px-2.5 py-1 rounded-lg bg-sky-500/15 hover:bg-sky-500/30 border border-sky-500/35 text-[11px] font-semibold text-sky-200 flex items-center gap-1.5 transition"
          >
            <Scissors className="w-3.5 h-3.5 text-sky-400" />
            <span>✂️ Last Frame → Next Shot</span>
          </button>

          <button
            onClick={handleCompileWebm}
            disabled={compilingWebm}
            className="px-3 py-1 rounded-lg bg-emerald-600/25 hover:bg-emerald-600/40 border border-emerald-500/40 text-[11px] font-semibold text-emerald-200 flex items-center gap-1.5 transition"
          >
            <Video className="w-3.5 h-3.5 text-emerald-400" />
            <span>
              {compilingWebm
                ? `Compiling .webm (${compilePct}%)...`
                : 'Compile .webm'}
            </span>
          </button>

          <button
            onClick={handleExportFcpxml}
            className="px-3 py-1 rounded-lg bg-violet-600/25 hover:bg-violet-600/40 border border-violet-500/40 text-[11px] font-semibold text-violet-200 flex items-center gap-1.5 transition"
          >
            <Download className="w-3.5 h-3.5 text-violet-300" />
            <span>Export .fcpxml</span>
          </button>
        </div>
      </div>

      {timelineExpanded && (
        <div className="flex h-[182px] overflow-hidden">
          <div className="hidden md:flex w-[240px] shrink-0 border-r border-slate-800/80 p-2.5 flex-col justify-between bg-[#070910]">
            <canvas
              ref={monitorRef}
              width={320}
              height={180}
              className="w-full h-[126px] rounded-lg border border-slate-800 object-cover bg-black"
            />
            <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 px-0.5">
              <span>PROGRAM MONITOR</span>
              <span className="text-emerald-400">24 FPS · STEREO</span>
            </div>
          </div>

          <div className="flex-1 flex overflow-hidden">
            <div className="w-44 shrink-0 border-r border-slate-800/80 bg-[#0B0E17] flex flex-col">
              <div className="h-6 border-b border-slate-800/80 px-3 flex items-center text-[10px] font-mono text-slate-500">
                TIMECODE RULER
              </div>
              {tracks.map((tr) => (
                <div
                  key={tr.id}
                  className="flex-1 border-b border-slate-800/60 px-3 flex items-center gap-2 text-xs font-medium text-slate-300"
                >
                  {tr.icon}
                  <span className="truncate">{tr.label}</span>
                </div>
              ))}
            </div>

            <div
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const clickX = e.clientX - rect.left + e.currentTarget.scrollLeft;
                setPlayheadSec(Math.min(totalDurationSec, Math.max(0, clickX / pxPerSec)));
              }}
              className="relative flex-1 overflow-x-auto overflow-y-hidden bg-[#080B12] cursor-pointer"
            >
              <div
                style={{ width: Math.max(900, (totalDurationSec + 4) * pxPerSec) }}
                className="relative h-full flex flex-col"
              >
                <div className="h-6 border-b border-slate-800/80 flex items-center relative bg-[#0B0F19]">
                  {Array.from(
                    { length: Math.ceil(totalDurationSec) + 2 },
                    (_, sec) => (
                      <div
                        key={sec}
                        style={{ left: sec * pxPerSec }}
                        className="absolute top-0 bottom-0 border-l border-slate-800/90 pl-1 text-[9px] font-mono text-slate-500 flex items-center"
                      >
                        {sec}s
                      </div>
                    )
                  )}
                </div>

                {tracks.map((tr) => {
                  const laneClips = timelineClips.filter((c) => c.track === tr.id);
                  return (
                    <div
                      key={tr.id}
                      className="relative flex-1 border-b border-slate-800/50"
                    >
                      {laneClips.map((clip) => {
                        const isSel = selectedClipId === clip.id;
                        return (
                          <div
                            key={clip.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedClipId(clip.id);
                              setPlayheadSec(clip.startSec);
                            }}
                            style={{
                              left: clip.startSec * pxPerSec,
                              width: Math.max(48, clip.durationSec * pxPerSec - 2),
                            }}
                            className={`group absolute top-1 bottom-1 rounded-lg border px-2 flex items-center justify-between gap-1.5 overflow-hidden transition ${
                              tr.accent
                            } ${isSel ? 'ring-2 ring-white' : ''}`}
                          >
                            <div className="flex items-center gap-1.5 min-w-0">
                              {clip.thumbnailUrl && (
                                <img
                                  src={clip.thumbnailUrl}
                                  alt=""
                                  className="w-8 h-6 rounded object-cover shrink-0 border border-white/10"
                                />
                              )}
                              <div className="min-w-0">
                                <div className="text-[11px] font-semibold text-white truncate">
                                  {clip.title}
                                </div>
                                <div className="text-[9px] font-mono text-slate-300 truncate">
                                  {clip.durationSec}s · {clip.promptOrDialogue}
                                </div>
                              </div>
                            </div>

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                removeTimelineClip(clip.id);
                              }}
                              className="opacity-0 group-hover:opacity-100 p-0.5 rounded bg-black/60 text-slate-300 hover:text-rose-400 shrink-0"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}

                <div
                  style={{ left: playheadSec * pxPerSec }}
                  className="absolute top-0 bottom-0 w-0.5 bg-rose-500 pointer-events-none z-20"
                >
                  <div className="w-2.5 h-2.5 -ml-1 rounded-full bg-rose-500 shadow" />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
