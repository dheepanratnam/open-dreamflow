import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Check,
  Chrome,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Play,
  Plus,
  RefreshCw,
  Server,
  ShieldCheck,
  Sparkles,
  Terminal,
  Trash2,
  X,
} from 'lucide-react';
import { useStudioStore, normalizeProviderId } from '../store/useStudioStore';
import { LOCAL_MCP_BASE } from '../services/executionRouter';
import type { ProviderId, ProviderVerificationResult } from '../types/studio';

const CHROME_EXTENSION_DISK_PATH =
  '/Users/seba/Documents/antigravity/clever-mendel/open-dreamflow/extensions/chrome-bridge';

const VerificationReadout: React.FC<{
  status?: ProviderVerificationResult;
}> = ({ status }) => {
  if (!status) return null;

  if (status.valid) {
    const unlocked = [
      ...(status.videoModels || []),
      ...(status.imageModels || []),
    ].slice(0, 4);
    return (
      <div className="mt-1.5 px-2.5 py-1.5 rounded-[7px] bg-[#10b981]/10 border border-[#10b981]/30 text-[11px] text-[#34d399] flex items-start gap-1.5 leading-snug">
        <Check className="w-3.5 h-3.5 shrink-0 mt-0.5" strokeWidth={2} />
        <span>
          <strong className="font-semibold">Valid Key</strong>
          {unlocked.length > 0
            ? ` · Unlocked: ${unlocked.join(', ')}`
            : status.allCount
            ? ` · ${status.allCount} models accessible`
            : ' · Endpoint verified'}
        </span>
      </div>
    );
  }

  return (
    <div className="mt-1.5 px-2.5 py-1.5 rounded-[7px] bg-red-500/10 border border-red-400/30 text-[11px] text-red-300 flex items-start gap-1.5 leading-snug">
      <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" strokeWidth={1.75} />
      <span>{status.error || 'Verification failed'}</span>
    </div>
  );
};

export const ProviderModal: React.FC = () => {
  const {
    providerModalOpen,
    providerModalTab,
    providerFocusField,
    providerVerifyStatus,
    verifyingProvider,
    liveBridgeTestRunning,
    liveBridgeStatusText,
    closeProviderModal,
    openProviderModal,
    activeProvider,
    setActiveProvider,
    byok,
    updateByok,
    clearByokKeys,
    verifyProviderConnection,
    runLiveBridgeTestGeneration,
    mcpServers,
    mcpHealth,
    addMcpServer,
    refreshMcpServer,
    spawnMcpToolAsCanvasNode,
    chromeBridge,
    pingBridge,
    bridgeWsConnected,
    triggerTestBridgeCapture,
    showToast,
  } = useStudioStore();

  const [showSecrets, setShowSecrets] = useState(false);
  const [mcpName, setMcpName] = useState('Local ComfyUI / Studio MCP');
  const [mcpUrl, setMcpUrl] = useState(`${LOCAL_MCP_BASE}/mcp`);
  const [mcpTransport, setMcpTransport] = useState<'websocket' | 'http-sse'>(
    'http-sse'
  );

  const geminiInputRef = useRef<HTMLInputElement | null>(null);
  const falInputRef = useRef<HTMLInputElement | null>(null);
  const replicateInputRef = useRef<HTMLInputElement | null>(null);
  const seedanceInputRef = useRef<HTMLInputElement | null>(null);
  const comfyInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!providerModalOpen || providerModalTab !== 'byok' || !providerFocusField) {
      return;
    }
    const timer = setTimeout(() => {
      const refMap = {
        gemini: geminiInputRef,
        fal: falInputRef,
        replicate: replicateInputRef,
        seedance: seedanceInputRef,
        comfyui: comfyInputRef,
      };
      const target = refMap[providerFocusField]?.current;
      target?.focus();
      target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 60);
    return () => clearTimeout(timer);
  }, [providerModalOpen, providerModalTab, providerFocusField]);

  if (!providerModalOpen) return null;

  const normalizedActive = normalizeProviderId(activeProvider);
  const connectorSnippet = `import('${LOCAL_MCP_BASE}/bridge-connector.js')`;

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast(`Copied ${label}`);
    } catch {
      showToast(`Copy manually: ${text}`);
    }
  };

  const providerOptions: Array<{
    id: ProviderId;
    label: string;
    tag: string;
    desc: string;
  }> = [
    {
      id: 'dreamina-bridge',
      label: 'Dreamina · Live Browser',
      tag: 'BROWSER CREDITS',
      desc: 'Dispatches live Seedream / Seedance jobs directly to your signed-in dreamina.capcut.com tab via ws://localhost:3001/bridge.',
    },
    {
      id: 'flow-bridge',
      label: 'Google Flow · Live Browser',
      tag: 'BROWSER CREDITS',
      desc: 'Dispatches live Veo / Imagen jobs directly to your signed-in labs.google/fx/tools/flow tab using your browser subscription.',
    },
    {
      id: 'gemini-api',
      label: 'Google Gemini / Veo 3.1 API',
      tag: '$0 MARKUP BYOK',
      desc: 'Real Google AI Studio execution: gemini-3.1-flash-image-preview / imagen-3 & veo-3.1-fast-generate-preview:predictLongRunning.',
    },
    {
      id: 'fal',
      label: 'Fal.ai · Flux / Wan 2.1 Pro',
      tag: '$0 MARKUP BYOK',
      desc: 'Direct pass-through execution on fal.run (Flux Dev/Schnell images & Wan Pro image-to-video).',
    },
    {
      id: 'replicate',
      label: 'Replicate · Flux / Video',
      tag: '$0 MARKUP BYOK',
      desc: 'Direct Replicate model predictions with raw pass-through API billing.',
    },
    {
      id: 'seedance',
      label: 'BytePlus Ark · Seedream / Seedance',
      tag: '$0 MARKUP BYOK',
      desc: 'Official BytePlus Ark API for Seedream 3.0 frames & Seedance 2.0 multi-keyframe shots.',
    },
    {
      id: 'comfyui',
      label: 'ComfyUI · Local GPU (:8188)',
      tag: '$0.00 LOCAL GPU',
      desc: 'Executes local node workflows directly against your ComfyUI HTTP/WS queue.',
    },
    {
      id: 'ffmpeg-local',
      label: 'FFmpeg 8.0 · Local Camera',
      tag: '$0.00 OFFLINE',
      desc: 'Deterministic local 35mm camera-drift MP4 synthesis, A→B optical bridges, 9-grid slicing & 4K Lanczos upscaling.',
    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm flex items-center justify-center p-4 select-none"
      onClick={closeProviderModal}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[820px] max-h-[88vh] rounded-[16px] dreamina-menu flex flex-col overflow-hidden text-[#f5f5f5]"
      >
        {/* Modal Header */}
        <div className="h-[52px] px-5 border-b border-white/[0.08] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-4 h-4 text-white/80" strokeWidth={1.5} />
            <span className="text-[14px] font-semibold">
              Live Execution Hub · Google Flow, Dreamina, BYOK APIs & MCP
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
                { id: 'bridge', label: 'Browser Credit Bridge', icon: Chrome },
                { id: 'mcp', label: 'MCP Servers (:3001)', icon: Server },
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
            <span>Zero Fake Fallbacks · 0% Markup</span>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {providerModalTab === 'byok' && (
            <>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11.5px] font-medium text-white/50">
                    Active Canvas Generation Engine
                  </span>
                  <span className="text-[11px] font-mono text-white/45">
                    Selected route runs strictly with zero silent fallback
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {providerOptions.map((opt) => {
                    const selected = normalizedActive === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setActiveProvider(opt.id)}
                        className={`p-3 rounded-[11px] text-left border transition-all ${
                          selected
                            ? 'bg-[#252525] border-white/50'
                            : 'bg-[#151515] border-white/[0.08] hover:border-white/20'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="text-[12.5px] font-medium text-white truncate flex items-center gap-1.5">
                            {selected && (
                              <Check
                                className="w-3.5 h-3.5 text-[#20D5EC] shrink-0"
                                strokeWidth={2}
                              />
                            )}
                            <span className="truncate">{opt.label}</span>
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

              {/* Local Browser-Only API Keys + Real Model Detection */}
              <div className="p-4 rounded-[12px] bg-[#151515] border border-white/[0.08] space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-[12.5px] font-medium text-white/95">
                      Browser-Local API Keys & Live Model Verification
                    </div>
                    <div className="text-[11px] text-white/45">
                      Stored exclusively in your browser localStorage and verified directly via :3001/api/verify-provider.
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
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

                {/* Primary Highlighted Card: Google Gemini / Veo 3.1 API Key */}
                <div
                  className={`p-3 rounded-[10px] bg-[#1b1b1b] border transition-colors ${
                    providerFocusField === 'gemini'
                      ? 'border-[#20D5EC]/70'
                      : 'border-white/[0.08]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <label className="text-[11.5px] font-medium text-white/90">
                      Google Gemini / Veo 3.1 API Key (Google AI Studio)
                    </label>
                    <a
                      href="https://aistudio.google.com/apikey"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-[#20D5EC] hover:underline flex items-center gap-1"
                    >
                      <span>Get a key at aistudio.google.com/apikey</span>
                      <ExternalLink className="w-3 h-3" strokeWidth={1.5} />
                    </a>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      ref={geminiInputRef}
                      type={showSecrets ? 'text' : 'password'}
                      value={byok.geminiApiKey}
                      onChange={(e) => {
                        updateByok({ geminiApiKey: e.target.value });
                        if (e.target.value.trim()) {
                          setActiveProvider('gemini-api');
                        }
                      }}
                      placeholder="AIzaSy..."
                      className="flex-1 h-8 px-3 rounded-[8px] bg-[#242424] border border-white/[0.1] text-[12px] font-mono text-white outline-none focus:border-white/40 select-text"
                    />
                    <button
                      type="button"
                      disabled={Boolean(verifyingProvider.gemini)}
                      onClick={() => void verifyProviderConnection('gemini')}
                      className="h-8 px-3 rounded-[8px] bg-white hover:bg-[#e5e5e5] disabled:opacity-60 text-[#0e0e0e] text-[11.5px] font-semibold flex items-center gap-1.5 shrink-0 transition-colors"
                    >
                      {verifyingProvider.gemini ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={2} />
                      ) : (
                        <ShieldCheck className="w-3.5 h-3.5" strokeWidth={1.75} />
                      )}
                      <span>Verify & Detect Models</span>
                    </button>
                  </div>
                  <VerificationReadout status={providerVerifyStatus.gemini} />
                </div>

                {/* Secondary BYOK & Local GPU Inputs */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-white/55 mb-1">
                      Fal.ai API Key (Flux / Wan 2.1 Pro)
                    </label>
                    <div className="flex items-center gap-1.5">
                      <input
                        ref={falInputRef}
                        type={showSecrets ? 'text' : 'password'}
                        value={byok.falApiKey}
                        onChange={(e) => updateByok({ falApiKey: e.target.value })}
                        placeholder="fal_..."
                        className="flex-1 h-8 px-3 rounded-[8px] bg-[#222222] border border-white/[0.08] text-[12px] font-mono text-white outline-none focus:border-white/30 select-text"
                      />
                      <button
                        type="button"
                        disabled={Boolean(verifyingProvider.fal)}
                        onClick={() => void verifyProviderConnection('fal')}
                        className="h-8 px-2.5 rounded-[8px] bg-[#2a2a2a] hover:bg-[#343434] text-[11px] font-medium text-white/85 shrink-0 flex items-center gap-1"
                      >
                        {verifyingProvider.fal ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : null}
                        <span>Verify</span>
                      </button>
                    </div>
                    <VerificationReadout status={providerVerifyStatus.fal} />
                  </div>

                  <div>
                    <label className="block text-[11px] text-white/55 mb-1">
                      Replicate API Token (Flux / Video)
                    </label>
                    <div className="flex items-center gap-1.5">
                      <input
                        ref={replicateInputRef}
                        type={showSecrets ? 'text' : 'password'}
                        value={byok.replicateApiKey}
                        onChange={(e) =>
                          updateByok({ replicateApiKey: e.target.value })
                        }
                        placeholder="r8_..."
                        className="flex-1 h-8 px-3 rounded-[8px] bg-[#222222] border border-white/[0.08] text-[12px] font-mono text-white outline-none focus:border-white/30 select-text"
                      />
                      <button
                        type="button"
                        disabled={Boolean(verifyingProvider.replicate)}
                        onClick={() => void verifyProviderConnection('replicate')}
                        className="h-8 px-2.5 rounded-[8px] bg-[#2a2a2a] hover:bg-[#343434] text-[11px] font-medium text-white/85 shrink-0 flex items-center gap-1"
                      >
                        {verifyingProvider.replicate ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : null}
                        <span>Verify</span>
                      </button>
                    </div>
                    <VerificationReadout status={providerVerifyStatus.replicate} />
                  </div>

                  <div>
                    <label className="block text-[11px] text-white/55 mb-1">
                      BytePlus Ark Key (Seedream / Seedance)
                    </label>
                    <div className="flex items-center gap-1.5">
                      <input
                        ref={seedanceInputRef}
                        type={showSecrets ? 'text' : 'password'}
                        value={byok.seedanceApiKey}
                        onChange={(e) =>
                          updateByok({ seedanceApiKey: e.target.value })
                        }
                        placeholder="ark-..."
                        className="flex-1 h-8 px-3 rounded-[8px] bg-[#222222] border border-white/[0.08] text-[12px] font-mono text-white outline-none focus:border-white/30 select-text"
                      />
                      <button
                        type="button"
                        disabled={Boolean(verifyingProvider.seedance)}
                        onClick={() => void verifyProviderConnection('seedance')}
                        className="h-8 px-2.5 rounded-[8px] bg-[#2a2a2a] hover:bg-[#343434] text-[11px] font-medium text-white/85 shrink-0 flex items-center gap-1"
                      >
                        {verifyingProvider.seedance ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : null}
                        <span>Verify</span>
                      </button>
                    </div>
                    <VerificationReadout status={providerVerifyStatus.seedance} />
                  </div>

                  <div>
                    <label className="block text-[11px] text-white/55 mb-1">
                      Local ComfyUI Endpoint (:8188)
                    </label>
                    <div className="flex items-center gap-1.5">
                      <input
                        ref={comfyInputRef}
                        type="text"
                        value={byok.comfyUiUrl}
                        onChange={(e) =>
                          updateByok({ comfyUiUrl: e.target.value })
                        }
                        className="flex-1 h-8 px-3 rounded-[8px] bg-[#222222] border border-white/[0.08] text-[12px] font-mono text-white outline-none focus:border-white/30 select-text"
                      />
                      <button
                        type="button"
                        disabled={Boolean(verifyingProvider.comfyui)}
                        onClick={() => void verifyProviderConnection('comfyui')}
                        className="h-8 px-2.5 rounded-[8px] bg-[#2a2a2a] hover:bg-[#343434] text-[11px] font-medium text-white/85 shrink-0 flex items-center gap-1"
                      >
                        {verifyingProvider.comfyui ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : null}
                        <span>Verify</span>
                      </button>
                    </div>
                    <VerificationReadout status={providerVerifyStatus.comfyui} />
                  </div>
                </div>
              </div>
            </>
          )}

          {providerModalTab === 'bridge' && (
            <div className="space-y-4">
              {/* Status + Quick Launch Row */}
              <div className="p-4 rounded-[12px] bg-[#151515] border border-white/[0.08] space-y-3.5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-[13px] font-medium text-white">
                      Real-Time Browser Session Bridge (Dreamina & Google Flow)
                    </div>
                    <div className="text-[11.5px] text-white/50">
                      Dispatches canvas prompts directly into your signed-in browser tabs over{' '}
                      <code className="font-mono text-white/80">ws://localhost:3001/bridge</code> and streams generated media back onto your nodes.
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <a
                      href="https://dreamina.capcut.com/ai-tool/canvas"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="h-8 px-3 rounded-[8px] bg-[#252525] hover:bg-[#303030] text-[11.5px] font-medium text-white/90 flex items-center gap-1.5 transition-colors"
                    >
                      <span>Open Dreamina</span>
                      <ExternalLink className="w-3 h-3 text-white/60" strokeWidth={1.5} />
                    </a>
                    <a
                      href="https://labs.google/fx/tools/flow"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="h-8 px-3 rounded-[8px] bg-[#252525] hover:bg-[#303030] text-[11.5px] font-medium text-white/90 flex items-center gap-1.5 transition-colors"
                    >
                      <span>Open Google Flow</span>
                      <ExternalLink className="w-3 h-3 text-white/60" strokeWidth={1.5} />
                    </a>
                    <button
                      type="button"
                      onClick={pingBridge}
                      className="h-8 px-3 rounded-[8px] bg-white hover:bg-[#e5e5e5] text-[#0e0e0e] text-[11.5px] font-semibold shrink-0"
                    >
                      Ping Bridge
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {[
                    {
                      label: 'WS Relay (:3001/bridge)',
                      ok: bridgeWsConnected,
                      detail: mcpHealth.bridgeClients
                        ? `${mcpHealth.bridgeClients} peers`
                        : 'Live',
                    },
                    {
                      label: 'Bridge Connector',
                      ok: chromeBridge.extensionDetected || bridgeWsConnected,
                      detail: 'Ready',
                    },
                    {
                      label: 'Dreamina Tab',
                      ok: chromeBridge.dreaminaTabConnected,
                      detail: 'Connected',
                    },
                    {
                      label: 'Google Flow Tab',
                      ok: chromeBridge.flowTabConnected,
                      detail: 'Connected',
                    },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="p-2.5 rounded-[9px] bg-[#1d1d1d] border border-white/[0.06] flex items-center justify-between gap-2"
                    >
                      <span className="text-[11.5px] text-white/80 truncate">
                        {item.label}
                      </span>
                      {item.ok ? (
                        <span className="text-[10.5px] font-mono text-[#10b981] flex items-center gap-1 shrink-0">
                          <Check className="w-3.5 h-3.5" strokeWidth={2} />
                          <span>{item.detail}</span>
                        </span>
                      ) : (
                        <span className="text-[10.5px] font-mono text-white/35 shrink-0">
                          Standby
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* 2 Connection Methods: Unpacked Chrome Extension OR 1-Line Live Bridge Script */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-3.5 rounded-[12px] bg-[#151515] border border-white/[0.08] space-y-2">
                  <div className="text-[12px] font-medium text-white flex items-center gap-1.5">
                    <Chrome className="w-3.5 h-3.5 text-white/75" strokeWidth={1.5} />
                    <span>Option A · Chrome Extension (Auto-Connect)</span>
                  </div>
                  <p className="text-[11px] text-white/50 leading-relaxed">
                    Open <code className="font-mono text-white/80">chrome://extensions</code>, enable{' '}
                    <strong className="text-white/80">Developer mode</strong>, click{' '}
                    <strong className="text-white/80">Load unpacked</strong>, and select:
                  </p>
                  <div className="flex items-center gap-1.5">
                    <input
                      readOnly
                      value={CHROME_EXTENSION_DISK_PATH}
                      className="flex-1 h-8 px-2.5 rounded-[7px] bg-[#202020] border border-white/[0.08] font-mono text-[10.5px] text-white/80 outline-none select-all"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        void copyToClipboard(
                          CHROME_EXTENSION_DISK_PATH,
                          'Chrome Extension folder path'
                        )
                      }
                      className="h-8 px-2.5 rounded-[7px] bg-[#2b2b2b] hover:bg-white hover:text-[#0e0e0e] text-[11px] font-medium text-white/90 flex items-center gap-1 shrink-0 transition-colors"
                    >
                      <Copy className="w-3 h-3" strokeWidth={1.5} />
                      <span>Copy Path</span>
                    </button>
                  </div>
                </div>

                <div className="p-3.5 rounded-[12px] bg-[#151515] border border-white/[0.08] space-y-2">
                  <div className="text-[12px] font-medium text-white flex items-center gap-1.5">
                    <Terminal className="w-3.5 h-3.5 text-[#20D5EC]" strokeWidth={1.5} />
                    <span>Option B · Zero-Install 1-Line Console Connector</span>
                  </div>
                  <p className="text-[11px] text-white/50 leading-relaxed">
                    In any signed-in Dreamina or Google Flow tab, press{' '}
                    <code className="font-mono text-white/80">⌥⌘J</code> (DevTools Console) and paste:
                  </p>
                  <div className="flex items-center gap-1.5">
                    <input
                      readOnly
                      value={connectorSnippet}
                      className="flex-1 h-8 px-2.5 rounded-[7px] bg-[#202020] border border-white/[0.08] font-mono text-[10.5px] text-[#20D5EC] outline-none select-all"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        void copyToClipboard(
                          connectorSnippet,
                          '1-Line Live Bridge Script'
                        )
                      }
                      className="h-8 px-2.5 rounded-[7px] bg-[#2b2b2b] hover:bg-white hover:text-[#0e0e0e] text-[11px] font-medium text-white/90 flex items-center gap-1 shrink-0 transition-colors"
                    >
                      <Copy className="w-3 h-3" strokeWidth={1.5} />
                      <span>Copy 1-Line Live Bridge Script</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* 1-Click Live Test Generation Dispatch */}
              <div className="p-4 rounded-[12px] bg-[#151515] border border-white/[0.08] space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-[12.5px] font-medium text-white">
                      Test Real Live Browser Generation (POST /api/bridge/enqueue)
                    </div>
                    <div className="text-[11px] text-white/50">
                      Sends a 35mm natural-daylight prompt into your connected Dreamina or Google Flow tab and loads the generated asset onto the canvas.
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={Boolean(liveBridgeTestRunning)}
                    onClick={() => void runLiveBridgeTestGeneration('dreamina', 'image')}
                    className="h-9 px-3.5 rounded-[8px] bg-white hover:bg-[#e5e5e5] disabled:opacity-60 text-[#0e0e0e] text-[12px] font-semibold flex items-center gap-2 transition-colors"
                  >
                    {liveBridgeTestRunning === 'dreamina' ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={2} />
                    ) : (
                      <Play className="w-3.5 h-3.5" strokeWidth={1.75} />
                    )}
                    <span>Run Live Dreamina Test Generation</span>
                  </button>

                  <button
                    type="button"
                    disabled={Boolean(liveBridgeTestRunning)}
                    onClick={() =>
                      void runLiveBridgeTestGeneration('google-flow', 'image')
                    }
                    className="h-9 px-3.5 rounded-[8px] bg-white hover:bg-[#e5e5e5] disabled:opacity-60 text-[#0e0e0e] text-[12px] font-semibold flex items-center gap-2 transition-colors"
                  >
                    {liveBridgeTestRunning === 'google-flow' ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={2} />
                    ) : (
                      <Play className="w-3.5 h-3.5" strokeWidth={1.75} />
                    )}
                    <span>Run Live Google Flow Test Generation</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      void triggerTestBridgeCapture('dreamina');
                      closeProviderModal();
                    }}
                    className="h-9 px-3 rounded-[8px] bg-[#252525] hover:bg-[#303030] text-[11.5px] font-medium text-white/75 hover:text-white transition-colors ml-auto"
                  >
                    Sample Relay Ping
                  </button>
                </div>

                {liveBridgeStatusText && (
                  <div className="px-3 py-2 rounded-[8px] bg-[#1f1f1f] border border-white/[0.08] font-mono text-[11px] text-white/80">
                    {liveBridgeStatusText}
                  </div>
                )}
              </div>
            </div>
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
                    className="w-full h-8 px-2.5 rounded-[8px] bg-[#222222] border border-white/[0.08] text-[12px] text-white outline-none select-text"
                  />
                </div>
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-[11px] text-white/45 mb-1">
                    Endpoint URL
                  </label>
                  <input
                    value={mcpUrl}
                    onChange={(e) => setMcpUrl(e.target.value)}
                    className="w-full h-8 px-2.5 rounded-[8px] bg-[#222222] border border-white/[0.08] text-[12px] font-mono text-white outline-none select-text"
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
        </div>
      </div>
    </div>
  );
};
