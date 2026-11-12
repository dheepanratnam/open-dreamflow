import React, { useEffect, useState } from 'react';
import {
  Bot,
  Clapperboard,
  Columns2,
  Cpu,
  LayoutGrid,
  Link2,
  Redo2,
  Sparkles,
  Undo2,
  X,
  Zap,
} from 'lucide-react';
import { CanvasBoard } from './components/CanvasBoard';
import { PromptDock } from './components/PromptDock';
import { MultiframeChain } from './components/MultiframeChain';
import { ProviderModal } from './components/ProviderModal';
import { TimelineDock } from './components/TimelineDock';
import { ShareableAppView } from './components/ShareableAppView';
import { useStudioStore } from './store/useStudioStore';
import { pingChromeBridge } from './services/executionRouter';

export const App: React.FC = () => {
  const {
    projectTitle,
    setProjectTitle,
    activeView,
    setActiveView,
    past,
    future,
    undo,
    redo,
    copyShareableRecipeUrl,
    hydrateFromUrlRecipe,
    autoConnectLocalMcpBackend,
    openProviderModal,
    activeProvider,
    mcpServers,
    mcpHealth,
    chromeBridge,
    handleIncomingBridgeEvent,
    directorModalOpen,
    setDirectorModalOpen,
    directorRunning,
    directorStepLog,
    runAutonomousDirectorAgent,
    toastMessage,
  } = useStudioStore();

  const [directorBrief, setDirectorBrief] = useState(
    '30s cyberpunk commercial for @Cyber_Sneaker starring @Hero_Kael sprinting across rain-slicked Neo-Tokyo rooftops in @Brand_Style anamorphic lighting'
  );

  useEffect(() => {
    hydrateFromUrlRecipe();
    autoConnectLocalMcpBackend();

    const retryTimer = setTimeout(() => {
      if (!useStudioStore.getState().mcpHealth.online) {
        autoConnectLocalMcpBackend();
      }
    }, 3200);

    const onMessage = (event: MessageEvent) => {
      const data = event.data;
      if (!data || typeof data !== 'object') return;
      const src = String(data.source || '').toLowerCase();
      if (
        src === 'open-dreamflow-extension' ||
        src === 'dreamflow-chrome-bridge' ||
        src === 'chrome-bridge'
      ) {
        handleIncomingBridgeEvent({
          type: data.type,
          payload: data.payload,
        });
      }
    };

    window.addEventListener('message', onMessage);
    const t = setTimeout(() => pingChromeBridge(), 450);
    return () => {
      window.removeEventListener('message', onMessage);
      clearTimeout(t);
      clearTimeout(retryTimer);
    };
  }, [hydrateFromUrlRecipe, autoConnectLocalMcpBackend, handleIncomingBridgeEvent]);

  return (
    <div className="w-screen h-screen flex flex-col bg-[#07080C] text-slate-100 overflow-hidden">
      <header className="px-4 py-2 bg-[#0B0E16]/95 border-b border-slate-800/85 flex items-center justify-between gap-3 shrink-0 z-40">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-violet-600 via-fuchsia-500 to-sky-400 flex items-center justify-center shadow-glow-dream">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div className="leading-tight">
              <div className="text-xs font-bold tracking-tight text-white flex items-center gap-1.5">
                <span>Open-DreamFlow</span>
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-300 border border-violet-500/30">
                  v1.0 MIT
                </span>
              </div>
              <div className="text-[10px] text-slate-400 hidden sm:block">
                Dreamina 2.0 Canvas + Google Flow Omni 1.2
              </div>
            </div>
          </div>

          <div className="h-5 w-px bg-slate-800 hidden md:block" />

          <input
            type="text"
            value={projectTitle}
            onChange={(e) => setProjectTitle(e.target.value)}
            className="hidden xl:block bg-slate-900/80 hover:bg-slate-900 border border-slate-800 focus:border-violet-500 rounded-lg px-2.5 py-1 text-xs font-medium text-slate-200 w-52 focus:outline-none"
          />
        </div>

        <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setActiveView('canvas')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition ${
              activeView === 'canvas'
                ? 'bg-violet-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span>Spatial Canvas</span>
          </button>

          <button
            onClick={() => setActiveView('multiframes')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition ${
              activeView === 'multiframes'
                ? 'bg-violet-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Clapperboard className="w-3.5 h-3.5" />
            <span>Smart Multiframes</span>
          </button>

          <button
            onClick={() => setActiveView('split')}
            className={`hidden xl:flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition ${
              activeView === 'split'
                ? 'bg-violet-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Columns2 className="w-3.5 h-3.5" />
            <span>Split View</span>
          </button>

          <button
            onClick={() => setActiveView('app')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition ${
              activeView === 'app'
                ? 'bg-gradient-to-r from-emerald-500 to-sky-500 text-slate-950 font-bold shadow'
                : 'text-emerald-300 hover:text-white'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>⚡ Shareable App Mode</span>
          </button>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setDirectorModalOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-fuchsia-600/25 to-violet-600/25 hover:from-fuchsia-600/40 hover:to-violet-600/40 border border-fuchsia-500/40 text-fuchsia-200 text-xs font-semibold transition"
          >
            <Bot className="w-3.5 h-3.5 text-fuchsia-300" />
            <span className="hidden md:inline">Director Agent</span>
          </button>

          <div className="flex items-center bg-slate-900 rounded-lg border border-slate-800">
            <button
              onClick={undo}
              disabled={past.length === 0}
              title="Undo (Cmd+Z)"
              className="p-1.5 text-slate-300 hover:text-white disabled:opacity-30"
            >
              <Undo2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={redo}
              disabled={future.length === 0}
              title="Redo (Cmd+Shift+Z)"
              className="p-1.5 text-slate-300 hover:text-white disabled:opacity-30"
            >
              <Redo2 className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            onClick={copyShareableRecipeUrl}
            title="Encode scene graph into shareable ?recipe= URL"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-medium text-slate-200 transition"
          >
            <Link2 className="w-3.5 h-3.5 text-sky-400" />
            <span className="hidden lg:inline">Share `?recipe=`</span>
          </button>

          <button
            onClick={() => openProviderModal(mcpHealth.online ? 'mcp' : 'byok')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition ${
              mcpHealth.online
                ? 'bg-emerald-500/20 hover:bg-emerald-500/30 border-emerald-400/60 text-emerald-100 shadow-[0_0_16px_rgba(16,185,129,0.22)]'
                : 'bg-emerald-500/15 hover:bg-emerald-500/25 border-emerald-500/40 text-emerald-200'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                mcpHealth.online || chromeBridge.extensionDetected
                  ? 'bg-emerald-400 animate-pulse'
                  : 'bg-amber-400'
              }`}
            />
            <Cpu className="w-3.5 h-3.5 text-emerald-400" />
            <span>
              {mcpHealth.online
                ? `MCP Live · FFmpeg + ${mcpHealth.toolCount} Tools`
                : `BYOK · MCP (${mcpServers.length})`}
            </span>
            {!mcpHealth.online && (
              <span className="hidden xl:inline font-mono text-[10px] text-emerald-300">
                [{activeProvider}]
              </span>
            )}
          </button>
        </div>
      </header>

      <main className="relative flex-1 overflow-hidden flex">
        {activeView === 'canvas' && (
          <div className="relative w-full h-full">
            <CanvasBoard />
            <div className="absolute bottom-3 inset-x-0 pointer-events-none flex justify-center">
              <PromptDock />
            </div>
          </div>
        )}

        {activeView === 'multiframes' && (
          <div className="relative w-full h-full">
            <MultiframeChain />
          </div>
        )}

        {activeView === 'split' && (
          <div className="w-full h-full grid grid-cols-1 lg:grid-cols-2 divide-x divide-slate-800">
            <div className="relative h-full overflow-hidden">
              <CanvasBoard />
            </div>
            <div className="relative h-full overflow-hidden">
              <MultiframeChain />
            </div>
          </div>
        )}

        {activeView === 'app' && (
          <div className="relative w-full h-full">
            <ShareableAppView />
          </div>
        )}

        {toastMessage && (
          <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-[#131826]/95 border border-violet-400/50 shadow-glow-dream text-xs font-medium text-white flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-violet-400" />
            <span>{toastMessage}</span>
          </div>
        )}
      </main>

      <TimelineDock />
      <ProviderModal />

      {directorModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-xl rounded-2xl bg-[#0D111B] border border-fuchsia-500/40 shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Bot className="w-5 h-5 text-fuchsia-400" />
                <div>
                  <h3 className="text-sm font-bold text-white">
                    Autonomous AI Director Agent · Storyboard & Rough-Cut Builder
                  </h3>
                  <p className="text-xs text-slate-400">
                    Decomposes any creative brief into Style DNA + multi-turn Gemini Omni
                    1.2 / FFmpeg shots + Timeline rough cut.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setDirectorModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <textarea
              rows={3}
              value={directorBrief}
              onChange={(e) => setDirectorBrief(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-100 focus:outline-none focus:border-fuchsia-400"
            />

            {directorStepLog.length > 0 && (
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 font-mono text-[11px] text-fuchsia-200 space-y-1 max-h-36 overflow-y-auto">
                {directorStepLog.map((line, i) => (
                  <div key={i}>{line}</div>
                ))}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDirectorModalOpen(false)}
                className="px-3.5 py-2 rounded-xl bg-slate-800 text-xs text-slate-300 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={() => runAutonomousDirectorAgent(directorBrief)}
                disabled={directorRunning}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-fuchsia-600 to-violet-600 hover:from-fuchsia-500 hover:to-violet-500 text-white text-xs font-bold flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>
                  {directorRunning
                    ? 'Directing Storyboard...'
                    : 'Build Connected Storyboard & Rough Cut'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
