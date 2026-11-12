import React, { useState } from 'react';
import {
  CheckCircle2,
  Chrome,
  Cpu,
  Eye,
  EyeOff,
  KeyRound,
  Plus,
  RefreshCw,
  Server,
  ShieldCheck,
  Sparkles,
  Trash2,
  Workflow,
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
    addMcpServer,
    refreshMcpServer,
    spawnMcpToolAsCanvasNode,
    chromeBridge,
    pingBridge,
  } = useStudioStore();

  const [showSecrets, setShowSecrets] = useState(false);
  const [mcpName, setMcpName] = useState('ComfyUI + Flow MCP Server');
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
      label: 'Open-DreamFlow Instant Studio Engine',
      tag: '$0.00 OFFLINE',
      desc: 'Deterministic HTML5 procedural cinema frames, 9-grid slicing & live 30fps preview with zero API keys.',
    },
    {
      id: 'gemini-omni',
      label: 'Google AI Studio · Gemini Omni 1.2 Flash',
      tag: '$0 MARKUP BYOK',
      desc: 'Direct POST /v1beta/interactions: 3–15s video, 6 ref images, First/Last frame & previous_interaction_id.',
    },
    {
      id: 'seedance',
      label: 'BytePlus Ark · Seedream 3.0 & Seedance 1.0',
      tag: '$0 MARKUP BYOK',
      desc: 'Native 2–10 keyframe Smart Multiframes, 9-grid contact sheets & regional brush inpainting.',
    },
    {
      id: 'fal',
      label: 'Fal.ai · Wan 2.1 / HunyuanVideo / Flux',
      tag: '$0 MARKUP BYOK',
      desc: 'Raw pass-through open-weight video & image endpoints billed directly to your Fal account.',
    },
    {
      id: 'comfyui',
      label: 'Local GPU · ComfyUI API (127.0.0.1:8188)',
      tag: '100% LOCAL GPU',
      desc: 'Run Wan 2.1, LTX-Video & Flux locally on Apple Silicon or NVIDIA RTX at zero cloud cost.',
    },
    {
      id: 'chrome-bridge-flow',
      label: 'Chrome Bridge · flow.google.com Credits',
      tag: 'SUBSCRIPTION BRIDGE',
      desc: 'Routes prompts & @Elements through your active Google AI Pro/Ultra browser session at $0 API cost.',
    },
    {
      id: 'chrome-bridge-dreamina',
      label: 'Chrome Bridge · dreamina.capcut.com Credits',
      tag: 'SUBSCRIPTION BRIDGE',
      desc: 'Queues Dreamina 2.0 Smart Canvas & Seedance jobs via your existing consumer web subscription.',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-4xl max-h-[88vh] rounded-2xl bg-[#0C0F17] border border-slate-700/80 shadow-2xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 bg-[#101420] border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-600 to-sky-500 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-white">
                Zero-Markup Execution Router · BYOK + MCP + Browser Credits
              </h2>
              <p className="text-xs text-slate-400">
                $0 SaaS middleman tax. Keys stay 100% in your browser `localStorage` and
                call endpoints directly.
              </p>
            </div>
          </div>
          <button
            onClick={closeProviderModal}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex items-center gap-2 px-6 py-2.5 bg-[#0A0D14] border-b border-slate-800 text-xs">
          <button
            onClick={() => openProviderModal('byok')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-semibold transition ${
              providerModalTab === 'byok'
                ? 'bg-violet-600 text-white'
                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>1. Zero-Markup BYOK APIs</span>
          </button>

          <button
            onClick={() => openProviderModal('mcp')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-semibold transition ${
              providerModalTab === 'mcp'
                ? 'bg-emerald-600 text-white'
                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
            }`}
          >
            <Workflow className="w-3.5 h-3.5" />
            <span>2. MCP Server Manager ({mcpServers.length})</span>
          </button>

          <button
            onClick={() => openProviderModal('bridge')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-semibold transition ${
              providerModalTab === 'bridge'
                ? 'bg-sky-600 text-white'
                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
            }`}
          >
            <Chrome className="w-3.5 h-3.5" />
            <span>3. Chrome Extension Bridge</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {providerModalTab === 'byok' && (
            <>
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Active Canvas Synthesis Route
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {providerOptions.map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => setActiveProvider(opt.id)}
                      className={`p-3 rounded-xl border text-left transition ${
                        activeProvider === opt.id
                          ? 'bg-violet-600/20 border-violet-400 shadow-glow-dream'
                          : 'bg-slate-900/70 border-slate-800 hover:border-slate-600'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-white">
                          {opt.label}
                        </span>
                        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shrink-0">
                          {opt.tag}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                        {opt.desc}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-900/75 border border-slate-800 space-y-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                    <Cpu className="w-4 h-4 text-violet-400" /> Direct Provider API
                    Credentials (Stored in `localStorage` only)
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowSecrets((s) => !s)}
                      className="flex items-center gap-1 px-2 py-1 rounded bg-slate-800 text-[11px] text-slate-300 hover:text-white"
                    >
                      {showSecrets ? (
                        <EyeOff className="w-3.5 h-3.5" />
                      ) : (
                        <Eye className="w-3.5 h-3.5" />
                      )}
                      <span>{showSecrets ? 'Hide' : 'Reveal'}</span>
                    </button>
                    <button
                      onClick={clearByokKeys}
                      className="flex items-center gap-1 px-2 py-1 rounded bg-rose-500/15 text-[11px] text-rose-300 hover:bg-rose-500/25"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Clear Keys
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div className="space-y-1">
                    <label className="text-slate-300 font-medium">
                      Google AI Studio Key (`gemini-omni-1.2-flash`)
                    </label>
                    <input
                      type={showSecrets ? 'text' : 'password'}
                      value={byok.geminiApiKey}
                      onChange={(e) => updateByok({ geminiApiKey: e.target.value })}
                      placeholder="AIzaSy..."
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 font-mono text-slate-100"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-slate-300 font-medium">
                      BytePlus Ark Key (`seedream-3-0` / `seedance-1-0-pro`)
                    </label>
                    <input
                      type={showSecrets ? 'text' : 'password'}
                      value={byok.seedanceApiKey}
                      onChange={(e) => updateByok({ seedanceApiKey: e.target.value })}
                      placeholder="ark-..."
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 font-mono text-slate-100"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-slate-300 font-medium">
                      Fal.ai Key (Wan 2.1 / HunyuanVideo / Flux)
                    </label>
                    <input
                      type={showSecrets ? 'text' : 'password'}
                      value={byok.falApiKey}
                      onChange={(e) => updateByok({ falApiKey: e.target.value })}
                      placeholder="fal_..."
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 font-mono text-slate-100"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-slate-300 font-medium">
                      Replicate API Token
                    </label>
                    <input
                      type={showSecrets ? 'text' : 'password'}
                      value={byok.replicateApiKey}
                      onChange={(e) => updateByok({ replicateApiKey: e.target.value })}
                      placeholder="r8_..."
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 font-mono text-slate-100"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-slate-300 font-medium">
                      OpenAI API Key (`gpt-image-1` / Sora)
                    </label>
                    <input
                      type={showSecrets ? 'text' : 'password'}
                      value={byok.openaiApiKey}
                      onChange={(e) => updateByok({ openaiApiKey: e.target.value })}
                      placeholder="sk-..."
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 font-mono text-slate-100"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-slate-300 font-medium">
                      Local ComfyUI Endpoint
                    </label>
                    <input
                      type="text"
                      value={byok.comfyUiUrl}
                      onChange={(e) => updateByok({ comfyUiUrl: e.target.value })}
                      placeholder="http://127.0.0.1:8188"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 font-mono text-slate-100"
                    />
                  </div>
                </div>
              </div>
            </>
          )}

          {providerModalTab === 'mcp' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-emerald-950/20 border border-emerald-500/30 space-y-2">
                <div className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                  <Server className="w-4 h-4" /> Universal Model Context Protocol (MCP)
                  Canvas Node Auto-Discovery
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Connect any WebSocket or HTTP JSON-RPC 2.0 MCP server (such as{' '}
                  <code className="font-mono text-emerald-200">
                    packages/mcp-client/src/server-bridge.ts
                  </code>{' '}
                  on <code className="font-mono text-emerald-200">ws://localhost:3001/mcp</code>
                  ). Discovered MCP tools automatically become interactive Canvas Nodes and{' '}
                  <code className="font-mono text-emerald-200">/mcp:*</code> skills!
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 pt-2">
                  <input
                    type="text"
                    value={mcpName}
                    onChange={(e) => setMcpName(e.target.value)}
                    placeholder="Server Name"
                    className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white"
                  />
                  <input
                    type="text"
                    value={mcpUrl}
                    onChange={(e) => setMcpUrl(e.target.value)}
                    placeholder="ws://localhost:3001/mcp"
                    className="sm:col-span-2 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-emerald-200"
                  />
                  <div className="flex gap-1.5">
                    <select
                      value={mcpTransport}
                      onChange={(e) =>
                        setMcpTransport(e.target.value as 'websocket' | 'http-sse')
                      }
                      className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-2 text-xs text-slate-200"
                    >
                      <option value="websocket">WS</option>
                      <option value="http-sse">HTTP</option>
                    </select>
                    <button
                      onClick={() => addMcpServer(mcpName, mcpUrl, mcpTransport)}
                      className="flex-1 px-3 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" /> Connect
                    </button>
                  </div>
                </div>
              </div>

              {mcpServers.map((srv) => (
                <div
                  key={srv.id}
                  className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-2.5 h-2.5 rounded-full ${
                          srv.status === 'connected'
                            ? 'bg-emerald-400'
                            : 'bg-amber-400'
                        }`}
                      />
                      <span className="text-sm font-bold text-white">{srv.name}</span>
                      <span className="font-mono text-xs text-slate-400">{srv.url}</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-emerald-300">
                        {srv.status === 'connected'
                          ? `LIVE · ${srv.lastPingMs}ms`
                          : 'SCHEMA PREVIEW READY'}
                      </span>
                    </div>
                    <button
                      onClick={() => refreshMcpServer(srv.id)}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200"
                    >
                      <RefreshCw className="w-3.5 h-3.5" /> Ping `tools/list`
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {srv.tools.map((tool) => (
                      <div
                        key={tool.name}
                        className="p-3 rounded-xl bg-slate-950/90 border border-slate-800 flex items-start justify-between gap-2"
                      >
                        <div className="space-y-1">
                          <div className="font-mono text-xs font-bold text-emerald-300">
                            {tool.name}
                          </div>
                          <p className="text-[11px] text-slate-400 leading-snug">
                            {tool.description}
                          </p>
                        </div>
                        <button
                          onClick={() => spawnMcpToolAsCanvasNode(tool)}
                          className="shrink-0 px-2.5 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500 text-emerald-200 hover:text-slate-950 border border-emerald-500/40 text-[11px] font-semibold transition"
                        >
                          + Canvas Node
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {providerModalTab === 'bridge' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-sky-950/25 border border-sky-500/35 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Chrome className="w-5 h-5 text-sky-400" />
                    <div>
                      <h3 className="text-sm font-bold text-white">
                        Subscription Credit Bridge (`extensions/chrome-bridge`)
                      </h3>
                      <p className="text-xs text-slate-400">
                        Use your existing Google AI Pro/Ultra (`flow.google.com`) &
                        Dreamina (`dreamina.capcut.com`) web credits at $0 API cost.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={pingBridge}
                    className="px-3.5 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs flex items-center gap-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Ping Extension
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                  <div className="p-3 rounded-xl bg-slate-950/90 border border-slate-800 space-y-1">
                    <div className="text-[11px] text-slate-400">Extension Handshake</div>
                    <div className="text-xs font-bold flex items-center gap-1.5 text-slate-200">
                      <CheckCircle2
                        className={`w-4 h-4 ${
                          chromeBridge.extensionDetected
                            ? 'text-emerald-400'
                            : 'text-slate-500'
                        }`}
                      />
                      <span>
                        {chromeBridge.extensionDetected
                          ? 'Connected (`content-studio.js`)'
                          : 'Awaiting Unpacked Extension'}
                      </span>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-950/90 border border-slate-800 space-y-1">
                    <div className="text-[11px] text-slate-400">
                      Google Flow (`flow.google.com`)
                    </div>
                    <div className="text-xs font-bold text-sky-300">
                      {chromeBridge.flowTabConnected
                        ? 'Active Session Ready'
                        : 'Open flow.google.com Tab'}
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-950/90 border border-slate-800 space-y-1">
                    <div className="text-[11px] text-slate-400">
                      Dreamina (`dreamina.capcut.com`)
                    </div>
                    <div className="text-xs font-bold text-violet-300">
                      {chromeBridge.dreaminaTabConnected
                        ? 'Active Session Ready'
                        : 'Open dreamina.capcut.com Tab'}
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2 text-xs text-slate-300">
                <div className="font-bold text-white flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-amber-400" /> 30-Second Unpacked
                  Extension Setup
                </div>
                <ol className="list-decimal list-inside space-y-1.5 text-slate-300">
                  <li>
                    Open <code className="font-mono text-sky-300">chrome://extensions</code>{' '}
                    in Chrome / Arc / Brave and enable <strong>Developer mode</strong>.
                  </li>
                  <li>
                    Click <strong>Load unpacked</strong> and select{' '}
                    <code className="font-mono text-violet-300">
                      open-dreamflow/extensions/chrome-bridge
                    </code>
                    .
                  </li>
                  <li>
                    Keep a logged-in tab open to{' '}
                    <code className="font-mono text-sky-300">https://flow.google.com</code>{' '}
                    or{' '}
                    <code className="font-mono text-violet-300">
                      https://dreamina.capcut.com
                    </code>
                    , then select the Chrome Bridge route in Tab 1!
                  </li>
                </ol>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
