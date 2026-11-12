import React, { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { useStudioStore } from './store/useStudioStore';
import { CanvasBoard } from './components/CanvasBoard';
import { DreaminaFloatingChrome } from './components/DreaminaFloatingChrome';
import { ContextualNodeOverlay } from './components/ContextualNodeOverlay';
import {
  FullscreenTimelineModal,
  TimelinePlaybackEngine,
} from './components/TimelineCanvasNode';
import { ProviderModal } from './components/ProviderModal';
import { MultiframeChain } from './components/MultiframeChain';
import { ShareableAppView } from './components/ShareableAppView';

export const App: React.FC = () => {
  const activeView = useStudioStore((s) => s.activeView);
  const toastMessage = useStudioStore((s) => s.toastMessage);
  const hydrateFromUrlRecipe = useStudioStore((s) => s.hydrateFromUrlRecipe);
  const autoConnectLocalMcpBackend = useStudioStore(
    (s) => s.autoConnectLocalMcpBackend
  );
  const pingBridge = useStudioStore((s) => s.pingBridge);
  const handleIncomingBridgeEvent = useStudioStore(
    (s) => s.handleIncomingBridgeEvent
  );

  const [activeInpaintNodeId, setActiveInpaintNodeId] = useState<string | null>(
    null
  );

  useEffect(() => {
    hydrateFromUrlRecipe();
    void autoConnectLocalMcpBackend();
    pingBridge();

    const onMessage = (ev: MessageEvent) => {
      if (ev.data && typeof ev.data === 'object' && 'type' in ev.data) {
        handleIncomingBridgeEvent(
          ev.data as { type?: string; payload?: Record<string, unknown> }
        );
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [
    hydrateFromUrlRecipe,
    autoConnectLocalMcpBackend,
    pingBridge,
    handleIncomingBridgeEvent,
  ]);

  return (
    <div className="w-screen h-screen overflow-hidden bg-[#0e0e0e] text-[#f5f5f5] relative">
      {/* Continuous RAF Playhead Sync Engine */}
      <TimelinePlaybackEngine />

      {activeView === 'app' ? (
        <ShareableAppView />
      ) : activeView === 'multiframes' ? (
        <MultiframeChain />
      ) : (
        <>
          {/* 95% Open Spatial Infinite Canvas (#0e0e0e + 20px dot grid) */}
          <CanvasBoard
            activeInpaintNodeId={activeInpaintNodeId}
            onCloseInpaint={() => setActiveInpaintNodeId(null)}
          />

          {/* Minimal Floating Chrome (Top Strip, Left 12-Tool Dock, Bottom-Left Zoom/Minimap, Bottom-Right Chats) */}
          <DreaminaFloatingChrome />

          {/* Contextual Selected-Node Quick Actions + 648px Prompt Popover */}
          <ContextualNodeOverlay
            activeInpaintNodeId={activeInpaintNodeId}
            onToggleInpaint={(nodeId) =>
              setActiveInpaintNodeId((cur) => (cur === nodeId ? null : nodeId))
            }
          />
        </>
      )}

      {/* Full-Screen Timeline Editor Modal */}
      <FullscreenTimelineModal />

      {/* Zero-Markup BYOK / MCP / Chrome Extension Modal */}
      <ProviderModal />

      {/* Subtle Matte Toast Notification */}
      {toastMessage && (
        <div className="fixed top-[58px] left-1/2 -translate-x-1/2 z-50 h-8 px-3.5 rounded-full dreamina-levitation text-[12px] text-white/90 flex items-center gap-2 pointer-events-none">
          <Check className="w-3.5 h-3.5 text-[#10b981]" strokeWidth={1.75} />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
};

export default App;
