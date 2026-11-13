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
import { useStudioStore } from '../store/useStudioStore';
import { LOCAL_MCP_BASE } from '../services/executionRouter';
import {
  BROWSER_BRIDGE_PLATFORMS,
  EXTERNAL_MCP_TEMPLATES,
  PLATFORM_CATALOG,
  getPlatformConnectionStatus,
  type ExternalMcpTemplate,
} from '../presets/platformCatalog';
import type {
  DreaminaToolId,
  PlatformId,
  ProviderVerificationResult,
} from '../types/studio';

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
          <strong className="font-semibold">Verified</strong>
          {unlocked.length > 0
            ? ` · Models: ${unlocked.join(', ')}`
            : status.allCount
            ? ` · ${status.allCount} models accessible`
            : ' · Connection active'}
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
    byok,
    updateByok,
    clearByokKeys,
    verifyProviderConnection,
    runLiveBridgeTestGeneration,
    mcpServers,
    mcpHealth,
    refreshMcpServer,
    spawnMcpToolAsCanvasNode,
    externalMcpServers,
    platformsCatalog,
    refreshPlatformsAndExternalMcp,
    addExternalMcpServer,
    refreshExternalMcpById,
    removeExternalMcpById,
    spawnDreaminaNodeAt,
    updateNodeFields,
    chromeBridge,
    pingBridge,
    bridgeWsConnected,
    showToast,
  } = useStudioStore();

  const [showSecrets, setShowSecrets] = useState(false);

  // External MCP Registration Form State
  const [extName, setExtName] = useState('ElevenLabs Official MCP');
  const [extPlatformId, setExtPlatformId] = useState<PlatformId>('elevenlabs');
  const [extTransport, setExtTransport] = useState<'stdio' | 'http'>('stdio');
  const [extCommand, setExtCommand] = useState('npx');
  const [extArgs, setExtArgs] = useState('-y @elevenlabs/elevenlabs-mcp');
  const [extEnvKey, setExtEnvKey] = useState('ELEVENLABS_API_KEY');
  const [extEnvVal, setExtEnvVal] = useState('');
  const [extHttpUrl, setExtHttpUrl] = useState('http://localhost:3002/mcp');
  const [connectingExtMcp, setConnectingExtMcp] = useState(false);

  const higgsfieldRef = useRef<HTMLInputElement | null>(null);
  const klingRef = useRef<HTMLInputElement | null>(null);
  const geminiInputRef = useRef<HTMLInputElement | null>(null);
  const seedanceInputRef = useRef<HTMLInputElement | null>(null);
  const elevenlabsRef = useRef<HTMLInputElement | null>(null);
  const openartRef = useRef<HTMLInputElement | null>(null);
  const imagineartRef = useRef<HTMLInputElement | null>(null);
  const openaiRef = useRef<HTMLInputElement | null>(null);
  const falInputRef = useRef<HTMLInputElement | null>(null);
  const replicateInputRef = useRef<HTMLInputElement | null>(null);
  const comfyInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!providerModalOpen) return;
    void refreshPlatformsAndExternalMcp();
  }, [providerModalOpen, refreshPlatformsAndExternalMcp]);

  useEffect(() => {
    if (!providerModalOpen || providerModalTab !== 'byok' || !providerFocusField) {
      return;
    }
    const timer = setTimeout(() => {
      const refMap: Record<string, React.RefObject<HTMLInputElement | null>> = {
        higgsfield: higgsfieldRef,
        kling: klingRef,
        gemini: geminiInputRef,
        'google-flow': geminiInputRef,
        seedance: seedanceInputRef,
        dreamina: seedanceInputRef,
        elevenlabs: elevenlabsRef,
        openart: openartRef,
        imagineart: imagineartRef,
        openai: openaiRef,
        fal: falInputRef,
        replicate: replicateInputRef,
        comfyui: comfyInputRef,
      };
      const target = refMap[providerFocusField]?.current;
      target?.focus();
      target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 60);
    return () => clearTimeout(timer);
  }, [providerModalOpen, providerModalTab, providerFocusField]);

  if (!providerModalOpen) return null;

  const connectorSnippet = `import('${LOCAL_MCP_BASE}/bridge-connector.js')`;

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast(`Copied ${label}`);
    } catch {
      showToast(`Copy manually: ${text}`);
    }
  };

  const applyMcpTemplate = (tpl: ExternalMcpTemplate) => {
    setExtName(tpl.name);
    setExtPlatformId(tpl.platformId);
    setExtTransport(tpl.transport);
    if (tpl.transport === 'stdio') {
      setExtCommand(tpl.command || 'npx');
      setExtArgs((tpl.args || []).join(' '));
      setExtEnvKey(tpl.envKeyName || '');
      if (tpl.platformId === 'elevenlabs' && byok.elevenlabsApiKey) {
        setExtEnvVal(byok.elevenlabsApiKey);
      } else if (tpl.platformId === 'fal' && byok.falApiKey) {
        setExtEnvVal(byok.falApiKey);
      } else {
        setExtEnvVal('');
      }
    } else {
      setExtHttpUrl(tpl.url || 'http://localhost:3002/mcp');
    }
  };

  const handleConnectExternalMcp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!extName.trim() || connectingExtMcp) return;
    setConnectingExtMcp(true);
    try {
      const envObj: Record<string, string> = {};
      if (extEnvKey.trim() && extEnvVal.trim()) {
        envObj[extEnvKey.trim()] = extEnvVal.trim();
      }
      const parsedArgs = extArgs
        .split(/\s+/)
        .map((s) => s.trim())
        .filter(Boolean);

      await addExternalMcpServer({
        name: extName.trim(),
        platformId: extPlatformId,
        transport: extTransport,
        command: extTransport === 'stdio' ? extCommand.trim() : undefined,
        args: extTransport === 'stdio' ? parsedArgs : undefined,
        env:
          extTransport === 'stdio' && Object.keys(envObj).length > 0
            ? envObj
            : undefined,
        url: extTransport === 'http' ? extHttpUrl.trim() : undefined,
      });
    } finally {
      setConnectingExtMcp(false);
    }
  };

  const handleSpawnExternalMcpToolNode = (
    serverId: string,
    serverName: string,
    platformId: string | undefined,
    toolName: string,
    toolDesc?: string
  ) => {
    const lower = `${toolName} ${toolDesc || ''}`.toLowerCase();
    const toolKind: DreaminaToolId = lower.includes('video')
      ? 'video'
      : lower.includes('audio') ||
        lower.includes('speech') ||
        lower.includes('tts') ||
        lower.includes('voice') ||
        lower.includes('sfx')
      ? 'audio'
      : 'image';

    spawnDreaminaNodeAt(toolKind, 260, 180);
    const createdId = useStudioStore.getState().selectedNodeIds[0];
    if (createdId) {
      const resolvedPlat: PlatformId = (platformId as PlatformId) || 'custom-mcp';
      updateNodeFields(createdId, {
        platformId: resolvedPlat,
        connectionMode: 'mcp',
        modelId:
          resolvedPlat === 'custom-mcp'
            ? `${serverId}::${toolName}`
            : `mcp:${serverId}:${toolName}`,
        mcpServerId: serverId,
        mcpToolName: toolName,
        providerUsed: `${serverName} · ${toolName}`,
      });
    }
    closeProviderModal();
  };

  const statusBadgeFor = (platformId: PlatformId) => {
    const st = getPlatformConnectionStatus(
      platformId,
      byok,
      chromeBridge,
      externalMcpServers,
      platformsCatalog.find((p) => p.id === platformId)
    );
    return (
      <span
        className={`px-2 py-0.5 rounded-[5px] font-mono text-[10px] flex items-center gap-1 shrink-0 ${
          st.connected
            ? 'bg-[#10b981]/15 text-[#34d399] border border-[#10b981]/30'
            : 'bg-white/[0.05] text-white/45 border border-white/[0.06]'
        }`}
      >
        <span
          className={`w-1.5 h-1.5 rounded-full ${
            st.connected ? 'bg-[#10b981]' : 'bg-white/30'
          }`}
        />
        <span>{st.connected ? `Connected · ${st.summary}` : 'Not connected'}</span>
      </span>
    );
  };

  const isBrowserPlatformConnected = (id: string): boolean => {
    if (chromeBridge.connectedPlatforms?.[id]) return true;
    if (id === 'dreamina' && chromeBridge.dreaminaTabConnected) return true;
    if (id === 'google-flow' && chromeBridge.flowTabConnected) return true;
    return false;
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 select-none"
      onClick={closeProviderModal}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[880px] max-h-[89vh] rounded-[16px] dreamina-menu flex flex-col overflow-hidden text-[#f5f5f5]"
      >
        {/* Modal Header */}
        <div className="h-[52px] px-5 border-b border-white/[0.08] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-4 h-4 text-[#20D5EC]" strokeWidth={1.6} />
            <span className="text-[14px] font-semibold">
              Connections · Credits · MCP Hub
            </span>
            <span className="hidden sm:inline px-2 py-0.5 rounded-[6px] bg-white/[0.06] font-mono text-[10.5px] text-white/65">
              Higgsfield · Kling 4.0 · Dreamina · Flow · OpenArt · ImagineArt · ElevenLabs
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

        {/* Clean Matte 3-Tab Strip */}
        <div className="px-5 pt-3 pb-2.5 border-b border-white/[0.06] flex flex-wrap items-center justify-between gap-2 bg-[#161616] shrink-0">
          <div className="flex items-center gap-1.5">
            {(
              [
                { id: 'byok', label: 'Creator Platforms & API Keys', icon: KeyRound },
                { id: 'mcp', label: 'MCP Servers (Use Credits via MCP)', icon: Server },
                { id: 'bridge', label: 'Browser Credit Bridge (7 Platforms)', icon: Chrome },
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

          <div className="flex items-center gap-1.5 text-[11px] font-mono text-white/60">
            <Sparkles className="w-3.5 h-3.5 text-[#20D5EC]" strokeWidth={1.6} />
            <span>$0 Wrapper Markup · Keys Never Leave Your Device</span>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* TAB 1: CREATOR PLATFORMS & API KEYS */}
          {providerModalTab === 'byok' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-[12px] bg-[#151515] border border-white/[0.08] flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[12.5px] font-medium text-white">
                    Bring Your Own Platform Credits — Zero Wrapper Markup
                  </div>
                  <div className="text-[11px] text-white/50">
                    Connect API keys below, attach an MCP server in the MCP tab, or use your logged-in web subscription via Browser Credit Bridge. Shared workflows never include your credentials.
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setShowSecrets(!showSecrets)}
                    className="h-7 px-2.5 rounded-[7px] bg-[#252525] hover:bg-[#2e2e2e] text-[11.5px] text-white/80 flex items-center gap-1.5"
                  >
                    {showSecrets ? (
                      <EyeOff className="w-3.5 h-3.5" strokeWidth={1.5} />
                    ) : (
                      <Eye className="w-3.5 h-3.5" strokeWidth={1.5} />
                    )}
                    <span>{showSecrets ? 'Hide Keys' : 'Reveal Keys'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={clearByokKeys}
                    className="h-7 px-2.5 rounded-[7px] bg-[#252525] hover:bg-red-500/20 text-[11.5px] text-white/70 hover:text-red-300 flex items-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" strokeWidth={1.5} />
                    <span>Clear All</span>
                  </button>
                </div>
              </div>

              {/* Primary Creator Platforms Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* 1. Higgsfield */}
                <div
                  className={`p-3.5 rounded-[12px] bg-[#161616] border space-y-2 ${
                    providerFocusField === 'higgsfield'
                      ? 'border-[#20D5EC]/70'
                      : 'border-white/[0.08]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="text-[12.5px] font-semibold text-white">
                        Higgsfield
                      </div>
                      <div className="text-[10.5px] text-white/45">
                        ChatGPT Image 2.6 · Soul · DoP Cinema I2V · Wan 2.6
                      </div>
                    </div>
                    {statusBadgeFor('higgsfield')}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <input
                      ref={higgsfieldRef}
                      type={showSecrets ? 'text' : 'password'}
                      value={byok.higgsfieldApiKey}
                      onChange={(e) =>
                        updateByok({ higgsfieldApiKey: e.target.value })
                      }
                      placeholder="hf_... (or connect via MCP / Browser Bridge)"
                      className="flex-1 h-8 px-2.5 rounded-[8px] bg-[#222222] border border-white/[0.08] text-[11.5px] font-mono text-white outline-none focus:border-white/35 select-text"
                    />
                    <button
                      type="button"
                      disabled={Boolean(verifyingProvider.higgsfield)}
                      onClick={() => void verifyProviderConnection('higgsfield')}
                      className="h-8 px-2.5 rounded-[8px] bg-white hover:bg-[#e5e5e5] text-[#0e0e0e] text-[11px] font-semibold shrink-0 flex items-center gap-1"
                    >
                      {verifyingProvider.higgsfield && (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      )}
                      <span>Verify</span>
                    </button>
                  </div>
                  <div className="flex items-center justify-between text-[10.5px] text-white/45">
                    <button
                      type="button"
                      onClick={() => openProviderModal('bridge')}
                      className="text-[#20D5EC] hover:underline"
                    >
                      Or use logged-in higgsfield.ai credits →
                    </button>
                    <a
                      href="https://higgsfield.ai"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-white flex items-center gap-1"
                    >
                      <span>higgsfield.ai</span>
                      <ExternalLink className="w-3 h-3" strokeWidth={1.5} />
                    </a>
                  </div>
                  <VerificationReadout status={providerVerifyStatus.higgsfield} />
                </div>

                {/* 2. Kling AI */}
                <div
                  className={`p-3.5 rounded-[12px] bg-[#161616] border space-y-2 ${
                    providerFocusField === 'kling'
                      ? 'border-[#20D5EC]/70'
                      : 'border-white/[0.08]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="text-[12.5px] font-semibold text-white">
                        Kling AI
                      </div>
                      <div className="text-[10.5px] text-white/45">
                        Kling 4.0 (I2V + Native Audio) · Kling 3.0 Master · Kolors
                      </div>
                    </div>
                    {statusBadgeFor('kling')}
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <input
                      ref={klingRef}
                      type={showSecrets ? 'text' : 'password'}
                      value={byok.klingAccessKey}
                      onChange={(e) =>
                        updateByok({ klingAccessKey: e.target.value })
                      }
                      placeholder="Access Key (AK)..."
                      className="h-8 px-2.5 rounded-[8px] bg-[#222222] border border-white/[0.08] text-[11.5px] font-mono text-white outline-none focus:border-white/35 select-text"
                    />
                    <input
                      type={showSecrets ? 'text' : 'password'}
                      value={byok.klingSecretKey}
                      onChange={(e) =>
                        updateByok({ klingSecretKey: e.target.value })
                      }
                      placeholder="Secret Key (SK)..."
                      className="h-8 px-2.5 rounded-[8px] bg-[#222222] border border-white/[0.08] text-[11.5px] font-mono text-white outline-none focus:border-white/35 select-text"
                    />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <input
                      type={showSecrets ? 'text' : 'password'}
                      value={byok.klingApiKey}
                      onChange={(e) => updateByok({ klingApiKey: e.target.value })}
                      placeholder="Or single Kling Bearer / Gateway Token..."
                      className="flex-1 h-8 px-2.5 rounded-[8px] bg-[#222222] border border-white/[0.08] text-[11.5px] font-mono text-white outline-none focus:border-white/35 select-text"
                    />
                    <button
                      type="button"
                      disabled={Boolean(verifyingProvider.kling)}
                      onClick={() => void verifyProviderConnection('kling')}
                      className="h-8 px-2.5 rounded-[8px] bg-white hover:bg-[#e5e5e5] text-[#0e0e0e] text-[11px] font-semibold shrink-0 flex items-center gap-1"
                    >
                      {verifyingProvider.kling && (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      )}
                      <span>Verify</span>
                    </button>
                  </div>
                  <div className="flex items-center justify-between text-[10.5px] text-white/45">
                    <button
                      type="button"
                      onClick={() => openProviderModal('bridge')}
                      className="text-[#20D5EC] hover:underline"
                    >
                      Or use app.klingai.com web credits →
                    </button>
                    <a
                      href="https://app.klingai.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-white flex items-center gap-1"
                    >
                      <span>app.klingai.com</span>
                      <ExternalLink className="w-3 h-3" strokeWidth={1.5} />
                    </a>
                  </div>
                  <VerificationReadout status={providerVerifyStatus.kling} />
                </div>

                {/* 3. Dreamina / Seedream / Seedance */}
                <div
                  className={`p-3.5 rounded-[12px] bg-[#161616] border space-y-2 ${
                    providerFocusField === 'seedance' ||
                    providerFocusField === 'dreamina'
                      ? 'border-[#20D5EC]/70'
                      : 'border-white/[0.08]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="text-[12.5px] font-semibold text-white">
                        Dreamina · BytePlus Ark
                      </div>
                      <div className="text-[10.5px] text-white/45">
                        Seedream 5.0 Pro · Seedance 2.5 · Multi-Ref Keyframes
                      </div>
                    </div>
                    {statusBadgeFor('dreamina')}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <input
                      ref={seedanceInputRef}
                      type={showSecrets ? 'text' : 'password'}
                      value={byok.seedanceApiKey}
                      onChange={(e) =>
                        updateByok({ seedanceApiKey: e.target.value })
                      }
                      placeholder="ark-... (BytePlus Ark API Key)"
                      className="flex-1 h-8 px-2.5 rounded-[8px] bg-[#222222] border border-white/[0.08] text-[11.5px] font-mono text-white outline-none focus:border-white/35 select-text"
                    />
                    <button
                      type="button"
                      disabled={Boolean(verifyingProvider.seedance)}
                      onClick={() => void verifyProviderConnection('seedance')}
                      className="h-8 px-2.5 rounded-[8px] bg-white hover:bg-[#e5e5e5] text-[#0e0e0e] text-[11px] font-semibold shrink-0 flex items-center gap-1"
                    >
                      {verifyingProvider.seedance && (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      )}
                      <span>Verify</span>
                    </button>
                  </div>
                  <div className="flex items-center justify-between text-[10.5px] text-white/45">
                    <button
                      type="button"
                      onClick={() => openProviderModal('bridge')}
                      className="text-[#20D5EC] hover:underline"
                    >
                      Or use dreamina.capcut.com credits →
                    </button>
                    <a
                      href="https://dreamina.capcut.com/ai-tool/canvas"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-white flex items-center gap-1"
                    >
                      <span>dreamina.capcut.com</span>
                      <ExternalLink className="w-3 h-3" strokeWidth={1.5} />
                    </a>
                  </div>
                  <VerificationReadout status={providerVerifyStatus.seedance} />
                </div>

                {/* 4. Google Flow / Gemini / Veo 3.1 */}
                <div
                  className={`p-3.5 rounded-[12px] bg-[#161616] border space-y-2 ${
                    providerFocusField === 'gemini' ||
                    providerFocusField === 'google-flow'
                      ? 'border-[#20D5EC]/70'
                      : 'border-white/[0.08]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="text-[12.5px] font-semibold text-white">
                        Google Flow · Gemini / Veo 3.1
                      </div>
                      <div className="text-[10.5px] text-white/45">
                        Imagen 4 · Nano Banana 2 · Veo 3.1 Quality / Fast
                      </div>
                    </div>
                    {statusBadgeFor('google-flow')}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <input
                      ref={geminiInputRef}
                      type={showSecrets ? 'text' : 'password'}
                      value={byok.geminiApiKey}
                      onChange={(e) => updateByok({ geminiApiKey: e.target.value })}
                      placeholder="AIzaSy... (Google AI Studio Key)"
                      className="flex-1 h-8 px-2.5 rounded-[8px] bg-[#222222] border border-white/[0.08] text-[11.5px] font-mono text-white outline-none focus:border-white/35 select-text"
                    />
                    <button
                      type="button"
                      disabled={Boolean(verifyingProvider.gemini)}
                      onClick={() => void verifyProviderConnection('gemini')}
                      className="h-8 px-2.5 rounded-[8px] bg-white hover:bg-[#e5e5e5] text-[#0e0e0e] text-[11px] font-semibold shrink-0 flex items-center gap-1"
                    >
                      {verifyingProvider.gemini && (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      )}
                      <span>Verify</span>
                    </button>
                  </div>
                  <div className="flex items-center justify-between text-[10.5px] text-white/45">
                    <a
                      href="https://aistudio.google.com/apikey"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#20D5EC] hover:underline flex items-center gap-1"
                    >
                      <span>Get AI Studio key</span>
                      <ExternalLink className="w-3 h-3" strokeWidth={1.5} />
                    </a>
                    <a
                      href="https://labs.google/fx/tools/flow"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-white flex items-center gap-1"
                    >
                      <span>Open Google Flow</span>
                      <ExternalLink className="w-3 h-3" strokeWidth={1.5} />
                    </a>
                  </div>
                  <VerificationReadout status={providerVerifyStatus.gemini} />
                </div>

                {/* 5. ElevenLabs */}
                <div
                  className={`p-3.5 rounded-[12px] bg-[#161616] border space-y-2 ${
                    providerFocusField === 'elevenlabs'
                      ? 'border-[#20D5EC]/70'
                      : 'border-white/[0.08]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="text-[12.5px] font-semibold text-white">
                        ElevenLabs
                      </div>
                      <div className="text-[10.5px] text-white/45">
                        Multilingual v2 Voice TTS · Flash v2.5 · Sound Effects v2
                      </div>
                    </div>
                    {statusBadgeFor('elevenlabs')}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <input
                      ref={elevenlabsRef}
                      type={showSecrets ? 'text' : 'password'}
                      value={byok.elevenlabsApiKey}
                      onChange={(e) =>
                        updateByok({ elevenlabsApiKey: e.target.value })
                      }
                      placeholder="sk_... / xi-... (ElevenLabs API Key)"
                      className="flex-1 h-8 px-2.5 rounded-[8px] bg-[#222222] border border-white/[0.08] text-[11.5px] font-mono text-white outline-none focus:border-white/35 select-text"
                    />
                    <button
                      type="button"
                      disabled={Boolean(verifyingProvider.elevenlabs)}
                      onClick={() => void verifyProviderConnection('elevenlabs')}
                      className="h-8 px-2.5 rounded-[8px] bg-white hover:bg-[#e5e5e5] text-[#0e0e0e] text-[11px] font-semibold shrink-0 flex items-center gap-1"
                    >
                      {verifyingProvider.elevenlabs && (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      )}
                      <span>Verify</span>
                    </button>
                  </div>
                  <div className="flex items-center justify-between text-[10.5px] text-white/45">
                    <button
                      type="button"
                      onClick={() => openProviderModal('mcp')}
                      className="text-[#20D5EC] hover:underline"
                    >
                      Or 1-click ElevenLabs Official MCP →
                    </button>
                    <a
                      href="https://elevenlabs.io"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-white flex items-center gap-1"
                    >
                      <span>elevenlabs.io</span>
                      <ExternalLink className="w-3 h-3" strokeWidth={1.5} />
                    </a>
                  </div>
                  <VerificationReadout status={providerVerifyStatus.elevenlabs} />
                </div>

                {/* 6. OpenArt */}
                <div
                  className={`p-3.5 rounded-[12px] bg-[#161616] border space-y-2 ${
                    providerFocusField === 'openart'
                      ? 'border-[#20D5EC]/70'
                      : 'border-white/[0.08]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="text-[12.5px] font-semibold text-white">
                        OpenArt
                      </div>
                      <div className="text-[10.5px] text-white/45">
                        ChatGPT Image 2.6 · OpenArt Photoreal · Character Lock · Kling 4.0
                      </div>
                    </div>
                    {statusBadgeFor('openart')}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <input
                      ref={openartRef}
                      type={showSecrets ? 'text' : 'password'}
                      value={byok.openartApiKey}
                      onChange={(e) => updateByok({ openartApiKey: e.target.value })}
                      placeholder="oa_... (or connect via MCP / Browser Bridge)"
                      className="flex-1 h-8 px-2.5 rounded-[8px] bg-[#222222] border border-white/[0.08] text-[11.5px] font-mono text-white outline-none focus:border-white/35 select-text"
                    />
                    <button
                      type="button"
                      disabled={Boolean(verifyingProvider.openart)}
                      onClick={() => void verifyProviderConnection('openart')}
                      className="h-8 px-2.5 rounded-[8px] bg-white hover:bg-[#e5e5e5] text-[#0e0e0e] text-[11px] font-semibold shrink-0 flex items-center gap-1"
                    >
                      {verifyingProvider.openart && (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      )}
                      <span>Verify</span>
                    </button>
                  </div>
                  <div className="flex items-center justify-between text-[10.5px] text-white/45">
                    <button
                      type="button"
                      onClick={() => openProviderModal('bridge')}
                      className="text-[#20D5EC] hover:underline"
                    >
                      Or use openart.ai web credits →
                    </button>
                    <a
                      href="https://openart.ai"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-white flex items-center gap-1"
                    >
                      <span>openart.ai</span>
                      <ExternalLink className="w-3 h-3" strokeWidth={1.5} />
                    </a>
                  </div>
                  <VerificationReadout status={providerVerifyStatus.openart} />
                </div>

                {/* 7. ImagineArt */}
                <div
                  className={`p-3.5 rounded-[12px] bg-[#161616] border space-y-2 ${
                    providerFocusField === 'imagineart'
                      ? 'border-[#20D5EC]/70'
                      : 'border-white/[0.08]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="text-[12.5px] font-semibold text-white">
                        ImagineArt (Vyro)
                      </div>
                      <div className="text-[10.5px] text-white/45">
                        Imagine V2 · Flux Realism · Hailuo 02 · Kling 4.0
                      </div>
                    </div>
                    {statusBadgeFor('imagineart')}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <input
                      ref={imagineartRef}
                      type={showSecrets ? 'text' : 'password'}
                      value={byok.imagineartApiKey}
                      onChange={(e) =>
                        updateByok({ imagineartApiKey: e.target.value })
                      }
                      placeholder="vk-... (Vyro / ImagineArt Bearer Token)"
                      className="flex-1 h-8 px-2.5 rounded-[8px] bg-[#222222] border border-white/[0.08] text-[11.5px] font-mono text-white outline-none focus:border-white/35 select-text"
                    />
                    <button
                      type="button"
                      disabled={Boolean(verifyingProvider.imagineart)}
                      onClick={() => void verifyProviderConnection('imagineart')}
                      className="h-8 px-2.5 rounded-[8px] bg-white hover:bg-[#e5e5e5] text-[#0e0e0e] text-[11px] font-semibold shrink-0 flex items-center gap-1"
                    >
                      {verifyingProvider.imagineart && (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      )}
                      <span>Verify</span>
                    </button>
                  </div>
                  <div className="flex items-center justify-between text-[10.5px] text-white/45">
                    <button
                      type="button"
                      onClick={() => openProviderModal('bridge')}
                      className="text-[#20D5EC] hover:underline"
                    >
                      Or use imagine.art web credits →
                    </button>
                    <a
                      href="https://www.imagine.art"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-white flex items-center gap-1"
                    >
                      <span>imagine.art</span>
                      <ExternalLink className="w-3 h-3" strokeWidth={1.5} />
                    </a>
                  </div>
                  <VerificationReadout status={providerVerifyStatus.imagineart} />
                </div>

                {/* 8. OpenAI Direct */}
                <div
                  className={`p-3.5 rounded-[12px] bg-[#161616] border space-y-2 ${
                    providerFocusField === 'openai'
                      ? 'border-[#20D5EC]/70'
                      : 'border-white/[0.08]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="text-[12.5px] font-semibold text-white">
                        OpenAI Direct
                      </div>
                      <div className="text-[10.5px] text-white/45">
                        GPT Image 1.5 / ChatGPT Image · Sora 2 Video
                      </div>
                    </div>
                    {statusBadgeFor('openai')}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <input
                      ref={openaiRef}
                      type={showSecrets ? 'text' : 'password'}
                      value={byok.openaiApiKey}
                      onChange={(e) => updateByok({ openaiApiKey: e.target.value })}
                      placeholder="sk-proj-..."
                      className="flex-1 h-8 px-2.5 rounded-[8px] bg-[#222222] border border-white/[0.08] text-[11.5px] font-mono text-white outline-none focus:border-white/35 select-text"
                    />
                    <button
                      type="button"
                      disabled={Boolean(verifyingProvider.openai)}
                      onClick={() => void verifyProviderConnection('openai')}
                      className="h-8 px-2.5 rounded-[8px] bg-white hover:bg-[#e5e5e5] text-[#0e0e0e] text-[11px] font-semibold shrink-0 flex items-center gap-1"
                    >
                      {verifyingProvider.openai && (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      )}
                      <span>Verify</span>
                    </button>
                  </div>
                  <VerificationReadout status={providerVerifyStatus.openai} />
                </div>
              </div>

              {/* Raw Compute & Local GPU Pass-Through Row */}
              <div className="p-3.5 rounded-[12px] bg-[#151515] border border-white/[0.08] space-y-3">
                <div className="text-[11.5px] font-medium text-white/65">
                  Direct Inference Cloud & Local GPU Pass-Through ($0 Markup)
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] text-white/55 mb-1">
                      Fal.ai Key (Flux / Kling / Wan)
                    </label>
                    <div className="flex items-center gap-1.5">
                      <input
                        ref={falInputRef}
                        type={showSecrets ? 'text' : 'password'}
                        value={byok.falApiKey}
                        onChange={(e) => updateByok({ falApiKey: e.target.value })}
                        placeholder="fal_..."
                        className="flex-1 h-8 px-2.5 rounded-[8px] bg-[#222222] border border-white/[0.08] text-[11.5px] font-mono text-white outline-none focus:border-white/30 select-text"
                      />
                      <button
                        type="button"
                        disabled={Boolean(verifyingProvider.fal)}
                        onClick={() => void verifyProviderConnection('fal')}
                        className="h-8 px-2.5 rounded-[8px] bg-[#2a2a2a] hover:bg-[#343434] text-[11px] font-medium text-white/85 shrink-0"
                      >
                        {verifyingProvider.fal ? '…' : 'Verify'}
                      </button>
                    </div>
                    <VerificationReadout status={providerVerifyStatus.fal} />
                  </div>

                  <div>
                    <label className="block text-[11px] text-white/55 mb-1">
                      Replicate Token (Flux / Video)
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
                        className="flex-1 h-8 px-2.5 rounded-[8px] bg-[#222222] border border-white/[0.08] text-[11.5px] font-mono text-white outline-none focus:border-white/30 select-text"
                      />
                      <button
                        type="button"
                        disabled={Boolean(verifyingProvider.replicate)}
                        onClick={() => void verifyProviderConnection('replicate')}
                        className="h-8 px-2.5 rounded-[8px] bg-[#2a2a2a] hover:bg-[#343434] text-[11px] font-medium text-white/85 shrink-0"
                      >
                        {verifyingProvider.replicate ? '…' : 'Verify'}
                      </button>
                    </div>
                    <VerificationReadout status={providerVerifyStatus.replicate} />
                  </div>

                  <div>
                    <label className="block text-[11px] text-white/55 mb-1">
                      ComfyUI Local GPU (:8188)
                    </label>
                    <div className="flex items-center gap-1.5">
                      <input
                        ref={comfyInputRef}
                        type="text"
                        value={byok.comfyUiUrl}
                        onChange={(e) => updateByok({ comfyUiUrl: e.target.value })}
                        className="flex-1 h-8 px-2.5 rounded-[8px] bg-[#222222] border border-white/[0.08] text-[11.5px] font-mono text-white outline-none focus:border-white/30 select-text"
                      />
                      <button
                        type="button"
                        disabled={Boolean(verifyingProvider.comfyui)}
                        onClick={() => void verifyProviderConnection('comfyui')}
                        className="h-8 px-2.5 rounded-[8px] bg-[#2a2a2a] hover:bg-[#343434] text-[11px] font-medium text-white/85 shrink-0"
                      >
                        {verifyingProvider.comfyui ? '…' : 'Verify'}
                      </button>
                    </div>
                    <VerificationReadout status={providerVerifyStatus.comfyui} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: EXTERNAL & PLATFORM MCP SERVERS */}
          {providerModalTab === 'mcp' && (
            <div className="space-y-4">
              {/* 1-Click MCP Credit Templates */}
              <div className="p-3.5 rounded-[12px] bg-[#151515] border border-white/[0.08] space-y-2.5">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[12.5px] font-semibold text-white">
                      1-Click Creator MCP Templates (stdio & Streamable HTTP)
                    </div>
                    <div className="text-[11px] text-white/50">
                      Attach official or Playwright-powered MCP servers so canvas nodes spend your existing platform credits directly.
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {EXTERNAL_MCP_TEMPLATES.map((tpl) => (
                    <div
                      key={tpl.id}
                      className="p-3 rounded-[10px] bg-[#1c1c1c] border border-white/[0.07] flex items-start justify-between gap-2.5"
                    >
                      <div className="min-w-0">
                        <div className="text-[12px] font-medium text-white truncate">
                          {tpl.name}
                        </div>
                        <div className="text-[10.5px] text-white/45 leading-snug mt-0.5">
                          {tpl.description}
                        </div>
                        <div className="font-mono text-[10px] text-[#20D5EC] mt-1 truncate">
                          {tpl.transport === 'stdio'
                            ? `${tpl.command} ${(tpl.args || []).join(' ')}`
                            : tpl.url}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => applyMcpTemplate(tpl)}
                        className="h-7 px-2.5 rounded-[7px] bg-[#2b2b2b] hover:bg-white hover:text-[#0e0e0e] text-[11px] font-medium text-white/90 shrink-0 transition-colors"
                      >
                        Load
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Register External MCP Server Form */}
              <form
                onSubmit={handleConnectExternalMcp}
                className="p-4 rounded-[12px] bg-[#151515] border border-white/[0.08] space-y-3"
              >
                <div className="text-[12.5px] font-semibold text-white">
                  Connect External MCP Server (/api/mcp/servers)
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-[10.5px] text-white/50 mb-1">
                      Server Label
                    </label>
                    <input
                      value={extName}
                      onChange={(e) => setExtName(e.target.value)}
                      placeholder="e.g. Higgsfield MCP"
                      className="w-full h-8 px-2.5 rounded-[8px] bg-[#222222] border border-white/[0.08] text-[12px] text-white outline-none select-text"
                    />
                  </div>

                  <div>
                    <label className="block text-[10.5px] text-white/50 mb-1">
                      Bind to Canvas Platform
                    </label>
                    <select
                      value={extPlatformId}
                      onChange={(e) => setExtPlatformId(e.target.value as PlatformId)}
                      className="w-full h-8 px-2.5 rounded-[8px] bg-[#222222] border border-white/[0.08] text-[12px] text-white outline-none"
                    >
                      {PLATFORM_CATALOG.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10.5px] text-white/50 mb-1">
                      MCP Transport
                    </label>
                    <select
                      value={extTransport}
                      onChange={(e) =>
                        setExtTransport(e.target.value as 'stdio' | 'http')
                      }
                      className="w-full h-8 px-2.5 rounded-[8px] bg-[#222222] border border-white/[0.08] text-[12px] text-white outline-none"
                    >
                      <option value="stdio">Local Process (stdio · npx / uvx / node)</option>
                      <option value="http">Remote / Local HTTP JSON-RPC</option>
                    </select>
                  </div>
                </div>

                {extTransport === 'stdio' ? (
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-2.5">
                    <div>
                      <label className="block text-[10.5px] text-white/50 mb-1">
                        Command
                      </label>
                      <input
                        value={extCommand}
                        onChange={(e) => setExtCommand(e.target.value)}
                        placeholder="npx"
                        className="w-full h-8 px-2.5 rounded-[8px] bg-[#222222] border border-white/[0.08] text-[12px] font-mono text-white outline-none select-text"
                      />
                    </div>
                    <div className="md:col-span-3">
                      <label className="block text-[10.5px] text-white/50 mb-1">
                        Arguments (space-separated)
                      </label>
                      <input
                        value={extArgs}
                        onChange={(e) => setExtArgs(e.target.value)}
                        placeholder="-y @elevenlabs/elevenlabs-mcp"
                        className="w-full h-8 px-2.5 rounded-[8px] bg-[#222222] border border-white/[0.08] text-[12px] font-mono text-white outline-none select-text"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-[10.5px] text-white/50 mb-1">
                        Optional Env Variable Name
                      </label>
                      <input
                        value={extEnvKey}
                        onChange={(e) => setExtEnvKey(e.target.value)}
                        placeholder="ELEVENLABS_API_KEY"
                        className="w-full h-8 px-2.5 rounded-[8px] bg-[#222222] border border-white/[0.08] text-[11.5px] font-mono text-white outline-none select-text"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-[10.5px] text-white/50 mb-1">
                        Optional Env Variable Secret
                      </label>
                      <input
                        type={showSecrets ? 'text' : 'password'}
                        value={extEnvVal}
                        onChange={(e) => setExtEnvVal(e.target.value)}
                        placeholder="Paste token passed only to local MCP process"
                        className="w-full h-8 px-2.5 rounded-[8px] bg-[#222222] border border-white/[0.08] text-[11.5px] font-mono text-white outline-none select-text"
                      />
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="block text-[10.5px] text-white/50 mb-1">
                      MCP HTTP Endpoint URL
                    </label>
                    <input
                      value={extHttpUrl}
                      onChange={(e) => setExtHttpUrl(e.target.value)}
                      placeholder="http://localhost:3002/mcp"
                      className="w-full h-8 px-2.5 rounded-[8px] bg-[#222222] border border-white/[0.08] text-[12px] font-mono text-white outline-none select-text"
                    />
                  </div>
                )}

                <div className="flex items-center justify-between pt-1">
                  <span className="text-[11px] text-white/45">
                    Discovered tools automatically appear under the bound platform in every node&apos;s model picker.
                  </span>
                  <button
                    type="submit"
                    disabled={connectingExtMcp || !extName.trim()}
                    className="h-8 px-4 rounded-[8px] bg-white hover:bg-[#e5e5e5] disabled:opacity-55 text-[#0e0e0e] text-[12px] font-semibold flex items-center gap-1.5 shrink-0"
                  >
                    {connectingExtMcp ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Plus className="w-3.5 h-3.5" strokeWidth={1.8} />
                    )}
                    <span>Connect MCP Server</span>
                  </button>
                </div>
              </form>

              {/* Connected External MCP Servers */}
              {externalMcpServers.length > 0 && (
                <div className="space-y-2.5">
                  <div className="text-[11.5px] font-medium text-white/65">
                    Connected Creator MCP Servers ({externalMcpServers.length})
                  </div>
                  {externalMcpServers.map((srv) => (
                    <div
                      key={srv.id}
                      className="p-3.5 rounded-[12px] bg-[#151515] border border-white/[0.08] space-y-2.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span
                              className={`w-2 h-2 rounded-full ${
                                srv.status === 'connected'
                                  ? 'bg-[#10b981]'
                                  : 'bg-red-400'
                              }`}
                            />
                            <span className="text-[12.5px] font-semibold text-white truncate">
                              {srv.name}
                            </span>
                            {srv.platformId && (
                              <span className="px-1.5 py-0.5 rounded-[5px] bg-white/[0.07] font-mono text-[10px] text-[#20D5EC]">
                                {srv.platformId}
                              </span>
                            )}
                            <span className="px-1.5 py-0.5 rounded-[5px] bg-[#252525] font-mono text-[10px] text-white/65">
                              {srv.tools.length} tools
                            </span>
                          </div>
                          <div className="text-[11px] font-mono text-white/45 truncate mt-0.5">
                            {srv.transport === 'stdio'
                              ? `${srv.command} ${(srv.args || []).join(' ')}`
                              : srv.url}
                          </div>
                          {srv.error && (
                            <div className="text-[11px] text-red-300 mt-1">
                              {srv.error}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => void refreshExternalMcpById(srv.id)}
                            className="h-7 px-2.5 rounded-[7px] bg-[#252525] hover:bg-[#303030] text-[11px] text-white/85 flex items-center gap-1"
                          >
                            <RefreshCw className="w-3 h-3" strokeWidth={1.5} />
                            <span>Refresh</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => void removeExternalMcpById(srv.id)}
                            className="h-7 px-2 rounded-[7px] bg-[#252525] hover:bg-red-500/20 text-white/65 hover:text-red-300 flex items-center justify-center"
                          >
                            <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                          </button>
                        </div>
                      </div>

                      {srv.tools.length > 0 && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {srv.tools.map((tool) => (
                            <div
                              key={tool.name}
                              className="p-2 rounded-[8px] bg-[#1d1d1d] border border-white/[0.06] flex items-center justify-between gap-2"
                            >
                              <div className="min-w-0">
                                <div className="font-mono text-[11px] text-white/90 truncate">
                                  {tool.name}
                                </div>
                                {tool.description && (
                                  <div className="text-[10.5px] text-white/45 truncate">
                                    {tool.description}
                                  </div>
                                )}
                              </div>
                              <button
                                type="button"
                                onClick={() =>
                                  handleSpawnExternalMcpToolNode(
                                    srv.id,
                                    srv.name,
                                    srv.platformId,
                                    tool.name,
                                    tool.description
                                  )
                                }
                                className="h-6 px-2 rounded-[6px] bg-[#2b2b2b] hover:bg-white hover:text-[#0e0e0e] text-[10.5px] font-medium text-white/90 shrink-0 transition-colors"
                              >
                                + Node
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Built-In Studio :3001 MCP Server Card */}
              <div className="p-3.5 rounded-[12px] bg-[#151515] border border-white/[0.08] space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        mcpHealth.online ? 'bg-[#10b981]' : 'bg-[#f59e0b]'
                      }`}
                    />
                    <div>
                      <div className="text-[12px] font-medium text-white">
                        {mcpHealth.online
                          ? `Built-In Open-DreamFlow Engine (:3001/mcp · ${mcpHealth.toolCount} tools)`
                          : 'Built-In Studio MCP Server Offline'}
                      </div>
                      <div className="text-[10.5px] font-mono text-white/45">
                        {mcpHealth.baseUrl} · Multi-platform router + local FFmpeg 8.0 post-tools
                      </div>
                    </div>
                  </div>
                  {mcpServers[0] && (
                    <button
                      type="button"
                      onClick={() => void refreshMcpServer(mcpServers[0].id)}
                      className="h-7 px-2.5 rounded-[7px] bg-[#252525] hover:bg-[#303030] text-[11px] text-white/80 flex items-center gap-1"
                    >
                      <RefreshCw className="w-3 h-3" strokeWidth={1.5} />
                      <span>Ping</span>
                    </button>
                  )}
                </div>

                {mcpServers[0] && mcpServers[0].tools.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                    {mcpServers[0].tools.slice(0, 6).map((tool) => (
                      <div
                        key={tool.name}
                        className="px-2.5 py-1.5 rounded-[8px] bg-[#1c1c1c] border border-white/[0.05] flex items-center justify-between gap-2"
                      >
                        <span className="font-mono text-[11px] text-white/80 truncate">
                          {tool.name}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            spawnMcpToolAsCanvasNode(tool);
                            closeProviderModal();
                          }}
                          className="h-6 px-2 rounded-[6px] bg-[#282828] hover:bg-white hover:text-[#0e0e0e] text-[10px] font-medium text-white/85 shrink-0"
                        >
                          + Node
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: 7-PLATFORM BROWSER CREDIT BRIDGE */}
          {providerModalTab === 'bridge' && (
            <div className="space-y-4">
              <div className="p-4 rounded-[12px] bg-[#151515] border border-white/[0.08] space-y-3.5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-[13px] font-semibold text-white">
                      7-Platform Browser Subscription Credit Bridge
                    </div>
                    <div className="text-[11px] text-white/50">
                      Use the monthly web credits you already pay for on Higgsfield, Kling, Dreamina, Google Flow, OpenArt, ImagineArt, and ElevenLabs via{' '}
                      <code className="font-mono text-white/80">ws://localhost:3001/bridge</code>.
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`px-2.5 py-1 rounded-[7px] font-mono text-[11px] flex items-center gap-1.5 ${
                        bridgeWsConnected
                          ? 'bg-[#10b981]/15 text-[#34d399] border border-[#10b981]/30'
                          : 'bg-white/[0.05] text-white/45'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          bridgeWsConnected ? 'bg-[#10b981]' : 'bg-white/30'
                        }`}
                      />
                      <span>
                        {bridgeWsConnected
                          ? `WS Relay Live (${mcpHealth.bridgeClients || 1} peers)`
                          : 'WS Relay Standby'}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={pingBridge}
                      className="h-8 px-3 rounded-[8px] bg-white hover:bg-[#e5e5e5] text-[#0e0e0e] text-[11.5px] font-semibold"
                    >
                      Ping Bridge
                    </button>
                  </div>
                </div>

                {/* 7 Supported Creator Web Platforms */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {BROWSER_BRIDGE_PLATFORMS.map((plat) => {
                    const connected = isBrowserPlatformConnected(plat.id);
                    const testingThis = liveBridgeTestRunning === plat.id;
                    return (
                      <div
                        key={plat.id}
                        className="p-3 rounded-[10px] bg-[#1c1c1c] border border-white/[0.07] flex items-center justify-between gap-2.5"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span
                              className={`w-2 h-2 rounded-full shrink-0 ${
                                connected ? 'bg-[#10b981]' : 'bg-white/25'
                              }`}
                            />
                            <span className="text-[12.5px] font-medium text-white truncate">
                              {plat.name}
                            </span>
                            <span className="font-mono text-[10px] text-white/45">
                              {connected ? 'Tab Live' : 'Open tab to link'}
                            </span>
                          </div>
                          <div className="text-[10.5px] text-white/45 truncate mt-0.5">
                            {plat.creditNote}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <a
                            href={plat.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="h-7 px-2 rounded-[7px] bg-[#262626] hover:bg-[#323232] text-[11px] text-white/85 flex items-center gap-1"
                          >
                            <span>Open</span>
                            <ExternalLink className="w-3 h-3 text-white/55" strokeWidth={1.5} />
                          </a>
                          <button
                            type="button"
                            disabled={Boolean(liveBridgeTestRunning)}
                            onClick={() =>
                              void runLiveBridgeTestGeneration(
                                plat.id,
                                plat.id === 'elevenlabs' ? 'audio' : 'image'
                              )
                            }
                            className="h-7 px-2.5 rounded-[7px] bg-white hover:bg-[#e5e5e5] disabled:opacity-55 text-[#0e0e0e] text-[11px] font-semibold flex items-center gap-1"
                          >
                            {testingThis ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Play className="w-3 h-3" strokeWidth={1.75} />
                            )}
                            <span>Test</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {liveBridgeStatusText && (
                  <div className="px-3 py-2 rounded-[8px] bg-[#1f1f1f] border border-white/[0.08] font-mono text-[11px] text-white/85">
                    {liveBridgeStatusText}
                  </div>
                )}
              </div>

              {/* Setup Instructions: Chrome Extension v1.1.0 OR 1-Line Console Script */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-3.5 rounded-[12px] bg-[#151515] border border-white/[0.08] space-y-2">
                  <div className="text-[12px] font-medium text-white flex items-center gap-1.5">
                    <Chrome className="w-3.5 h-3.5 text-white/80" strokeWidth={1.5} />
                    <span>Option A · Chrome Extension v1.1.0 (All 7 Platforms)</span>
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
                      <span>Copy</span>
                    </button>
                  </div>
                </div>

                <div className="p-3.5 rounded-[12px] bg-[#151515] border border-white/[0.08] space-y-2">
                  <div className="text-[12px] font-medium text-white flex items-center gap-1.5">
                    <Terminal className="w-3.5 h-3.5 text-[#20D5EC]" strokeWidth={1.5} />
                    <span>Option B · 1-Line DevTools Console Connector</span>
                  </div>
                  <p className="text-[11px] text-white/50 leading-relaxed">
                    In any signed-in Higgsfield, Kling, Dreamina, Flow, OpenArt, ImagineArt, or ElevenLabs tab, paste into DevTools Console:
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
                        void copyToClipboard(connectorSnippet, '1-Line Bridge Connector')
                      }
                      className="h-8 px-2.5 rounded-[7px] bg-[#2b2b2b] hover:bg-white hover:text-[#0e0e0e] text-[11px] font-medium text-white/90 flex items-center gap-1 shrink-0 transition-colors"
                    >
                      <Copy className="w-3 h-3" strokeWidth={1.5} />
                      <span>Copy</span>
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
