import React, { useState } from 'react';
import {
  Check,
  Chrome,
  Eye,
  EyeOff,
  KeyRound,
  Plus,
  RefreshCw,
  Server,
  ShieldCheck,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { useStudioStore } from '../store/useStudioStore';
import type { ProviderId } from '../types/studio';

export const ProviderModal: React.FC = () => {
  const {
    providerModalOpen,
    providerModalTab,
    closeProviderModal,
    openProviderModal,
    activeProvider,
    setActiveProvider,
    byok,
    updateByok,
    clearByokKeys,
    mcpServers,
    mcpHealth,
    addMcpServer,
    refreshMcpServer,
    spawnMcpToolAsCanvasNode,
    chromeBridge,
    pingBridge,
    bridgeWsConnected,
    triggerTestBridgeCapture,
  } = useStudioStore();

  const [showSecrets, setShowSecrets] = useState(false);
  const [mcpName, setMcpName] = useState('Local ComfyUI / Studio MCP');
  const [mcpUrl, setMcpUrl] = useState('http://localhost:3001/mcp');
  const [mcpTransport, setMcpTransport] = useState<'websocket' | 'http-sse'>(
    'http-sse'
  );

  if (!providerModalOpen) return null;

  const providerOptions: Array<{
    id: ProviderId;
    label: string;
    tag: string;
    desc: string;
  }> = [
    {
      id: 'local-canvas',
      label: 'Local FFmpeg 8.0 + Studio Engine',
      tag: '$0.00 LOCAL',
      desc: 'Real local MP4 rendering, 9-grid slicing, frame extraction & timeline concat with zero API keys.',
    },
    {
      id: 'mcp-router',
      label: 'Model Context Protocol (MCP) Pipeline',
      tag: '$0.00 MCP',
      desc: 'Routes generation & post-processing directly through connected JSON-RPC 2.0 MCP tools.',
    },
    {
      id: 'gemini-omni',
      label: 'Google AI Studio · Gemini Omni 1.2 Flash',
      tag: '$0 MARKUP BYOK',
      desc: 'Direct POST /v1beta/interactions: 4–15s video, 6 @Element refs & previous_interaction_id.',
    },
    {
      id: 'seedance',
      label: 'BytePlus Ark · Seedream 3.0 & Seedance 2.0',
      tag: '$0 MARKUP BYOK',
      desc: 'Native 2–10 keyframe Smart Multiframes, 9-grid contact sheets & regional inpainting.',
    },
    {
      id: 'fal',
      label: 'Fal.ai · Wan 2.1 Pro / Flux',
      tag: '$0 MARKUP BYOK',
      desc: 'Direct browser-to-Fal queue execution with raw pass-through billing.',
    },
    {
      id: 'comfyui',
      label: 'ComfyUI Local API (:8188)',
      tag: '$0.00 LOCAL GPU',
      desc: 'Connects directly to local ComfyUI workflow graph endpoint.',
    },
    {
      id: 'chrome-bridge-dreamina',
      label: 'Chrome Extension · Dreamina Canvas Bridge',
      tag: 'BROWSER CREDITS',
      desc: 'Routes jobs through your logged-in dreamina.capcut.com browser tab.',
    },
    {
      id: 'chrome-bridge-flow',
      label: 'Chrome Extension · Google Flow Bridge',
      tag: 'BROWSER CREDITS',
      desc: 'Routes jobs through your logged-in labs.google/fx/tools/flow browser tab.',
    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm flex items-center justify-center p-4 select-none"
      onClick={closeProviderModal}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[780px] max-h-[86vh] rounded-[16px] dreamina-menu flex flex-col overflow-hidden text-[#f5f5f5]"
      >
        {/* Modal Header */}
        <div className="h-[52px] px-5 border-b border-white/[0.08] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-4 h-4 text-white/80" strokeWidth={1.5} />
            <span className="text-[14px] font-semibold">
              Zero-Markup Execution · BYOK, MCP & Browser Bridge
            </span>
          </div>
          <button
            type="button"
            onClick={closeProviderModal}
            className="w-7 h-7 rounded-[7px] hover:bg-white/[0.08] flex items-center justify-center text-white/60 hover:text-white"
          >
            <X className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </div>

        {/* Clean Matte Tabs */}
        <div className="px-5 pt-3 pb-2 border-b border-white/[0.06] flex items-center justify-between gap-2 bg-[#161616] shrink-0">
          <div className="flex items-center gap-1.5">
            {(
              [
                { id: 'byok', label: 'BYOK Providers', icon: KeyRound },
                { id: 'mcp', label: 'MCP Servers (:3001)', icon: Server },
                { id: 'bridge', label: 'Browser Credit Bridge', icon: Chrome },
              ] as const
            ).map((tab) => {
              const Icon = tab.icon;
              const active = providerModalTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => openProviderModal(tab.id)}
                  className={`h-8 px-3 rounded-[8px] text-[12px] font-medium flex items-center gap-1.5 transition-colors ${
                    active
                      ? 'bg-white text-[#0e0e0e]'
                      : 'bg-[#252525] text-white/75 hover:text-white hover:bg-[#2e2e2e]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" strokeWidth={1.5} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-1.5 text-[11.5px] font-mono text-white/65">
            <Sparkles className="w-3.5 h-3.5 text-[#face15]" strokeWidth={1.75} />
            <span>0% Platform Markup</span>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {providerModalTab === 'byok' && (
            <>
              <div className="space-y-2">
                <div className="text-[11.5px] font-medium text-white/50">
                  Active Execution Route
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {providerOptions.map((opt) => {
                    const selected = activeProvider === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setActiveProvider(opt.id)}
                        className={`p-3 rounded-[11px] text-left border transition-all ${
                          selected
                            ? 'bg-[#252525] border-white/45'
                            : 'bg-[#151515] border-white/[0.08] hover:border-white/20'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="text-[12.5px] font-medium text-white truncate">
                            {opt.label}
                          </span>
                          <span className="px-1.5 py-0.5 rounded-[5px] bg-white/[0.07] font-mono text-[10px] text-white/75 shrink-0">
                            {opt.tag}
                          </span>
                        </div>
                        <p className="text-[11px] text-white/50 leading-relaxed">
                          {opt.desc}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Local Browser-Only API Keys */}
              <div className="p-4 rounded-[12px] bg-[#151515] border border-white/[0.08] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[12.5px] font-medium text-white/90">
                    Browser-Local API Keys (Stored only in localStorage)
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowSecrets(!showSecrets)}
                      className="h-7 px-2.5 rounded-[7px] bg-[#252525] hover:bg-[#2e2e2e] text-[11.5px] text-white/75 flex items-center gap-1.5"
                    >
                      {showSecrets ? (
                        <EyeOff className="w-3.5 h-3.5" strokeWidth={1.5} />
                      ) : (
                        <Eye className="w-3.5 h-3.5" strokeWidth={1.5} />
                      )}
                      <span>{showSecrets ? 'Hide' : 'Reveal'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={clearByokKeys}
                      className="h-7 px-2.5 rounded-[7px] bg-[#252525] hover:bg-red-500/20 text-[11.5px] text-white/70 hover:text-red-300 flex items-center gap-1"
                    >
                      <Trash2 className="w-3 h-3" strokeWidth={1.5} />
                      <span>Clear</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-white/45 mb-1">
                      Google AI Studio Key (Gemini Omni 1.2 Flash)
                    </label>
                    <input
                      type={showSecrets ? 'text' : 'password'}
                      value={byok.geminiApiKey}
                      onChange={(e) =>
                        updateByok({ geminiApiKey: e.target.value })
                      }
                      placeholder="AIzaSy..."
                      className="w-full h-8 px-3 rounded-[8px] bg-[#222222] border border-white/[0.08] text-[12px] font-mono text-white outline-none focus:border-white/30"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-white/45 mb-1">
                      BytePlus Ark Key (Seedream / Seedance)
                    </label>
                    <input
                      type={showSecrets ? 'text' : 'password'}
                      value={byok.seedanceApiKey}
                      onChange={(e) =>
                        updateByok({ seedanceApiKey: e.target.value })
                      }
                      placeholder="ark-..."
                      className="w-full h-8 px-3 rounded-[8px] bg-[#222222] border border-white/[0.08] text-[12px] font-mono text-white outline-none focus:border-white/30"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-white/45 mb-1">
                      Fal.ai Key
                    </label>
                    <input
                      type={showSecrets ? 'text' : 'password'}
                      value={byok.falApiKey}
                      onChange={(e) => updateByok({ falApiKey: e.target.value })}
                      placeholder="fal_..."
                      className="w-full h-8 px-3 rounded-[8px] bg-[#222222] border border-white/[0.08] text-[12px] font-mono text-white outline-none focus:border-white/30"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-white/45 mb-1">
                      Replicate API Token
                    </label>
                    <input
                      type={showSecrets ? 'text' : 'password'}
                      value={byok.replicateApiKey}
                      onChange={(e) =>
                        updateByok({ replicateApiKey: e.target.value })
                      }
                      placeholder="r8_..."
                      className="w-full h-8 px-3 rounded-[8px] bg-[#222222] border border-white/[0.08] text-[12px] font-mono text-white outline-none focus:border-white/30"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-[11px] text-white/45 mb-1">
                      Local ComfyUI Endpoint
                    </label>
                    <input
                      type="text"
                      value={byok.comfyUiUrl}
                      onChange={(e) =>
                        updateByok({ comfyUiUrl: e.target.value })
                      }
                      className="w-full h-8 px-3 rounded-[8px] bg-[#222222] border border-white/[0.08] text-[12px] font-mono text-white outline-none focus:border-white/30"
                    />
                  </div>
                </div>
              </div>
            </>
          )}

          {providerModalTab === 'mcp' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-[12px] bg-[#151515] border border-white/[0.08] flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      mcpHealth.online ? 'bg-[#10b981]' : 'bg-[#f59e0b]'
                    }`}
                  />
                  <div>
                    <div className="text-[12.5px] font-medium text-white">
                      {mcpHealth.online
                        ? `Live Local FFmpeg 8.0 + MCP Bridge (${mcpHealth.toolCount} tools)`
                        : 'Local MCP Bridge Offline'}
                    </div>
                    <div className="text-[11px] font-mono text-white/45">
                      {mcpHealth.baseUrl} · {mcpHealth.mediaFiles.length} media assets indexed
                    </div>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-[6px] bg-[#252525] font-mono text-[11px] text-white/75">
                  {mcpHealth.pingMs ? `${mcpHealth.pingMs}ms` : 'JSON-RPC 2.0'}
                </span>
              </div>

              {/* Add New MCP Endpoint */}
              <div className="p-3.5 rounded-[12px] bg-[#151515] border border-white/[0.08] flex flex-wrap items-end gap-2">
                <div className="flex-1 min-w-[160px]">
                  <label className="block text-[11px] text-white/45 mb-1">
                    Server Name
                  </label>
                  <input
                    value={mcpName}
                    onChange={(e) => setMcpName(e.target.value)}
                    className="w-full h-8 px-2.5 rounded-[8px] bg-[#222222] border border-white/[0.08] text-[12px] text-white outline-none"
                  />
                </div>
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-[11px] text-white/45 mb-1">
                    Endpoint URL
                  </label>
                  <input
                    value={mcpUrl}
                    onChange={(e) => setMcpUrl(e.target.value)}
                    className="w-full h-8 px-2.5 rounded-[8px] bg-[#222222] border border-white/[0.08] text-[12px] font-mono text-white outline-none"
                  />
                </div>
                <select
                  value={mcpTransport}
                  onChange={(e) =>
                    setMcpTransport(e.target.value as 'websocket' | 'http-sse')
                  }
                  className="h-8 px-2.5 rounded-[8px] bg-[#222222] border border-white/[0.08] text-[12px] text-white outline-none"
                >
                  <option value="http-sse">HTTP JSON-RPC</option>
                  <option value="websocket">WebSocket</option>
                </select>
                <button
                  type="button"
                  onClick={() => void addMcpServer(mcpName, mcpUrl, mcpTransport)}
                  className="h-8 px-3.5 rounded-[8px] bg-white hover:bg-[#e5e5e5] text-[#0e0e0e] text-[12px] font-semibold flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" strokeWidth={1.75} />
                  <span>Connect</span>
                </button>
              </div>

              {/* Connected MCP Servers & Spawnable Tools */}
              <div className="space-y-3">
                {mcpServers.map((srv) => (
                  <div
                    key={srv.id}
                    className="p-4 rounded-[12px] bg-[#151515] border border-white/[0.08] space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-[13px] font-medium text-white flex items-center gap-2">
                          <span>{srv.name}</span>
                          <span className="px-1.5 py-0.5 rounded-[5px] bg-[#252525] font-mono text-[10px] text-white/70">
                            {srv.status}
                          </span>
                        </div>
                        <div className="text-[11px] font-mono text-white/45">
                          {srv.url}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => void refreshMcpServer(srv.id)}
                        className="h-7 px-2.5 rounded-[7px] bg-[#252525] hover:bg-[#2e2e2e] text-[11.5px] text-white/80 flex items-center gap-1.5"
                      >
                        <RefreshCw className="w-3 h-3" strokeWidth={1.5} />
                        <span>Refresh</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {srv.tools.map((tool) => (
                        <div
                          key={tool.name}
                          className="p-2.5 rounded-[9px] bg-[#1d1d1d] border border-white/[0.06] flex items-center justify-between gap-2"
                        >
                          <div className="min-w-0">
                            <div className="font-mono text-[11.5px] text-white/90 truncate">
                              {tool.name}
                            </div>
                            <div className="text-[11px] text-white/45 truncate">
                              {tool.description}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              spawnMcpToolAsCanvasNode(tool);
                              closeProviderModal();
                            }}
                            className="h-7 px-2.5 rounded-[7px] bg-[#2b2b2b] hover:bg-white hover:text-[#0e0e0e] text-[11px] font-medium text-white/90 shrink-0 transition-colors"
                          >
                            + Node
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {providerModalTab === 'bridge' && (
            <div className="space-y-4">
              <div className="p-4 rounded-[12px] bg-[#151515] border border-white/[0.08] space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[13px] font-medium text-white">
                      Manifest V3 Browser Subscription Bridge + Live WS Relay
                    </div>
                    <div className="text-[11.5px] text-white/50">
                      Load <code className="font-mono text-white/80">extensions/chrome-bridge</code> in{' '}
                      <code className="font-mono text-white/80">chrome://extensions</code> to stream assets & prompts over{' '}
                      <code className="font-mono text-white/80">ws://localhost:3001/bridge</code>.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={pingBridge}
                    className="h-8 px-3.5 rounded-[8px] bg-white hover:bg-[#e5e5e5] text-[#0e0e0e] text-[12px] font-semibold shrink-0"
                  >
                    Ping Extension
                  </button>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-1">
                  {[
                    {
                      label: 'WS Relay (:3001/bridge)',
                      ok: bridgeWsConnected,
                    },
                    {
                      label: 'Extension Script',
                      ok: chromeBridge.extensionDetected,
                    },
                    {
                      label: 'Dreamina Canvas Tab',
                      ok: chromeBridge.dreaminaTabConnected,
                    },
                    {
                      label: 'Google Flow Tab',
                      ok: chromeBridge.flowTabConnected,
                    },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="p-3 rounded-[9px] bg-[#1d1d1d] border border-white/[0.06] flex items-center justify-between gap-2"
                    >
                      <span className="text-[11.5px] text-white/80 truncate">
                        {item.label}
                      </span>
                      {item.ok ? (
                        <Check
                          className="w-4 h-4 text-[#10b981] shrink-0"
                          strokeWidth={1.75}
                        />
                      ) : (
                        <span className="text-[10.5px] font-mono text-white/35 shrink-0">
                          Standby
                        </span>
                      )}
                    </div>
                  ))}
                </div>

                <div className="pt-2 border-t border-white/[0.07] flex flex-wrap items-center justify-between gap-2">
                  <div className="text-[11px] text-white/50">
                    Simulate an instant live capture event via{' '}
                    <code className="font-mono text-white/75">POST /api/bridge/push</code> →{' '}
                    <code className="font-mono text-white/75">ws://localhost:3001/bridge</code>:
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        void triggerTestBridgeCapture('dreamina');
                        closeProviderModal();
                      }}
                      className="h-8 px-3 rounded-[8px] bg-[#252525] hover:bg-white hover:text-[#0e0e0e] text-[11.5px] font-medium text-white/90 transition-colors"
                    >
                      Test Bridge Capture (Dreamina)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        void triggerTestBridgeCapture('flow');
                        closeProviderModal();
                      }}
                      className="h-8 px-3 rounded-[8px] bg-[#252525] hover:bg-white hover:text-[#0e0e0e] text-[11.5px] font-medium text-white/90 transition-colors"
                    >
                      Test Bridge Capture (Flow)
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
