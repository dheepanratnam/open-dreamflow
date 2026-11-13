import React, { useEffect } from 'react';
import { AlertCircle, Check } from 'lucide-react';
import { useStudioStore } from './store/useStudioStore';
import { CanvasBoard } from './components/CanvasBoard';
import { DreaminaFloatingChrome } from './components/DreaminaFloatingChrome';
import { ContextualNodeOverlay } from './components/ContextualNodeOverlay';
import { InlineImageEditorModal } from './components/InlineImageEditorModal';
import {
  FullscreenTimelineModal,
  TimelinePlaybackEngine,
} from './components/TimelineCanvasNode';
import { ProviderModal } from './components/ProviderModal';
import { MultiframeChain } from './components/MultiframeChain';
import { ShareableAppView } from './components/ShareableAppView';
import { LOCAL_BRIDGE_WS_URL } from './services/executionRouter';
import type { BridgeIncomingEvent } from './types/studio';

export const App: React.FC = () => {
  const activeView = useStudioStore((s) => s.activeView);
  const toastMessage = useStudioStore((s) => s.toastMessage);
  const toastKind = useStudioStore((s) => s.toastKind);
  const lastFailedPlatformId = useStudioStore((s) => s.lastFailedPlatformId);
  const openProviderModal = useStudioStore((s) => s.openProviderModal);
  const hydrateFromUrlRecipe = useStudioStore((s) => s.hydrateFromUrlRecipe);
  const autoConnectLocalMcpBackend = useStudioStore(
    (s) => s.autoConnectLocalMcpBackend
  );
  const refreshPlatformsAndExternalMcp = useStudioStore(
    (s) => s.refreshPlatformsAndExternalMcp
  );
  const bootDiskPersistence = useStudioStore((s) => s.bootDiskPersistence);
  const pingBridge = useStudioStore((s) => s.pingBridge);
  const handleIncomingBridgeEvent = useStudioStore(
    (s) => s.handleIncomingBridgeEvent
  );
  const setBridgeWsConnected = useStudioStore((s) => s.setBridgeWsConnected);
  const ingestBridgeWsEvent = useStudioStore((s) => s.ingestBridgeWsEvent);
  const handleBridgeJobWsEvent = useStudioStore((s) => s.handleBridgeJobWsEvent);

  useEffect(() => {
    const hasUrlRecipe =
      typeof window !== 'undefined' &&
      new URLSearchParams(window.location.search).has('recipe');

    hydrateFromUrlRecipe();
    void autoConnectLocalMcpBackend();
    void refreshPlatformsAndExternalMcp();
    if (!hasUrlRecipe) {
      void bootDiskPersistence();
    }
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
    refreshPlatformsAndExternalMcp,
    bootDiskPersistence,
    pingBridge,
    handleIncomingBridgeEvent,
  ]);

  // Debounced 800ms auto-save of active project graph to local disk (:3001/api/projects + localStorage)
  useEffect(() => {
    let saveTimer: ReturnType<typeof setTimeout> | null = null;
    let bootReady = false;
    const readyTimer = setTimeout(() => {
      bootReady = true;
    }, 1200);

    let prevNodes = useStudioStore.getState().nodes;
    let prevEdges = useStudioStore.getState().edges;
    let prevElements = useStudioStore.getState().elements;
    let prevTitle = useStudioStore.getState().projectTitle;

    const unsubscribe = useStudioStore.subscribe((state) => {
      const changed =
        state.nodes !== prevNodes ||
        state.edges !== prevEdges ||
        state.elements !== prevElements ||
        state.projectTitle !== prevTitle;

      prevNodes = state.nodes;
      prevEdges = state.edges;
      prevElements = state.elements;
      prevTitle = state.projectTitle;

      if (!changed || !bootReady) return;
      if (saveTimer) clearTimeout(saveTimer);
      saveTimer = setTimeout(() => {
        void useStudioStore.getState().persistActiveProjectToDisk();
      }, 800);
    });

    return () => {
      clearTimeout(readyTimer);
      if (saveTimer) clearTimeout(saveTimer);
      unsubscribe();
    };
  }, []);

  // Live WebSocket subscription to ws://localhost:3001/bridge for instant Chrome Extension captures
  useEffect(() => {
    if (typeof window === 'undefined' || typeof WebSocket === 'undefined') {
      return;
    }

    let unmounted = false;
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const connectWs = () => {
      if (unmounted) return;
      try {
        ws = new WebSocket(LOCAL_BRIDGE_WS_URL);
        ws.onopen = () => {
          if (!unmounted) setBridgeWsConnected(true);
        };
        ws.onmessage = (ev) => {
          if (unmounted || typeof ev.data !== 'string') return;
          try {
            const parsed = JSON.parse(ev.data) as Record<string, unknown>;
            if (parsed.type === 'bridge_job_complete') {
              handleBridgeJobWsEvent(parsed);
            } else if (
              parsed.type === 'bridge_asset' ||
              parsed.type === 'bridge_prompt' ||
              parsed.type === 'bridge_session'
            ) {
              ingestBridgeWsEvent(parsed as unknown as BridgeIncomingEvent);
            }
          } catch {
            // ignore non-JSON frames
          }
        };
        ws.onclose = () => {
          if (unmounted) return;
          setBridgeWsConnected(false);
          reconnectTimer = setTimeout(connectWs, 2500);
        };
        ws.onerror = () => {
          try {
            ws?.close();
          } catch {
            // ignore
          }
        };
      } catch {
        setBridgeWsConnected(false);
        reconnectTimer = setTimeout(connectWs, 3000);
      }
    };

    connectWs();

    return () => {
      unmounted = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      try {
        ws?.close();
      } catch {
        // ignore
      }
    };
  }, [setBridgeWsConnected, ingestBridgeWsEvent, handleBridgeJobWsEvent]);

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
            activeInpaintNodeId={null}
            onCloseInpaint={() => undefined}
          />

          {/* Minimal Floating Chrome (Top Strip, Left 12-Tool Dock, Bottom-Left Zoom/Minimap, Bottom-Right Chats) */}
          <DreaminaFloatingChrome />

          {/* Contextual Selected-Node Quick Actions + 648px Prompt Popover */}
          <ContextualNodeOverlay />
        </>
      )}

      {/* Interactive Dreamina Inline Image/Frame Editor (Inpaint Brush + Outpaint Aspect Expansion) */}
      <InlineImageEditorModal />

      {/* Full-Screen Timeline Editor Modal */}
      <FullscreenTimelineModal />

      {/* Zero-Markup BYOK / MCP / Chrome Extension Modal */}
      <ProviderModal />

      {/* Subtle Matte Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed top-[58px] left-1/2 -translate-x-1/2 z-50 min-h-[34px] max-w-[780px] px-3.5 py-1.5 rounded-full dreamina-levitation text-[12px] flex items-center gap-2.5 ${
            toastKind === 'error'
              ? 'border border-amber-400/40 text-amber-100 pointer-events-auto'
              : 'text-white/90 pointer-events-none'
          }`}
        >
          {toastKind === 'error' ? (
            <AlertCircle
              className="w-3.5 h-3.5 text-amber-400 shrink-0"
              strokeWidth={1.75}
            />
          ) : (
            <Check
              className="w-3.5 h-3.5 text-[#10b981] shrink-0"
              strokeWidth={1.75}
            />
          )}
          <span className="truncate">{toastMessage}</span>
          {toastKind === 'error' && lastFailedPlatformId && (
            <button
              type="button"
              onClick={() => openProviderModal('byok', lastFailedPlatformId)}
              className="h-6 px-2.5 rounded-full bg-white hover:bg-[#e6e6e6] text-[#0e0e0e] text-[11px] font-semibold shrink-0 transition-colors"
            >
              Connect Credits
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default App;
