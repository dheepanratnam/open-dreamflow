import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardPaste,
  Copy,
  ExternalLink,
  Globe,
  KeyRound,
  Loader2,
  PlugZap,
  Plus,
  RefreshCw,
  Server,
  ShieldCheck,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import {
  EXTERNAL_MCP_TEMPLATES,
  PLATFORM_CATALOG,
  PLATFORM_UI_META,
  getPlatformConnectionStatus,
} from '../presets/platformCatalog';
import { useStudioStore } from '../store/useStudioStore';
import type {
  BYOKCredentials,
  BrowserPlatformTarget,
  PlatformId,
  ProviderVerificationResult,
} from '../types/studio';

type VerifySlug =
  | 'gemini'
  | 'fal'
  | 'replicate'
  | 'seedance'
  | 'comfyui'
  | 'kling'
  | 'elevenlabs'
  | 'openai'
  | 'higgsfield'
  | 'sume'
  | 'openart'
  | 'imagineart';

interface PlatformKeyFieldConfig {
  byokField: keyof BYOKCredentials;
  label: string;
  placeholder: string;
  isUrl?: boolean;
}

function focusFieldToPlatformId(focus: string | null | undefined): PlatformId {
  if (!focus) return 'higgsfield';
  if (focus === 'gemini') return 'google-flow';
  if (focus === 'seedance') return 'dreamina';
  const match = PLATFORM_CATALOG.find((p) => p.id === focus);
  return match ? match.id : 'higgsfield';
}

function platformIdToVerifySlug(platformId: PlatformId): VerifySlug {
  const fromMeta = PLATFORM_UI_META[platformId]?.verifySlug as VerifySlug | undefined;
  if (fromMeta) return fromMeta;
  if (platformId === 'google-flow') return 'gemini';
  if (platformId === 'dreamina') return 'seedance';
  return platformId as VerifySlug;
}

function getPlatformKeyFields(platformId: PlatformId): PlatformKeyFieldConfig[] {
  const meta = PLATFORM_UI_META[platformId];
  const placeholder = meta?.apiPlaceholder || 'Paste API key...';

  switch (platformId) {
    case 'higgsfield':
      return [{ byokField: 'higgsfieldApiKey', label: 'Higgsfield API Key', placeholder }];
    case 'sume':
      return [{ byokField: 'sumeApiKey', label: 'Sume API Key', placeholder }];
    case 'kling':
      return [
        { byokField: 'klingAccessKey', label: 'Kling Access Key (AK)', placeholder: 'Access Key ID...' },
        { byokField: 'klingSecretKey', label: 'Kling Secret Key (SK)', placeholder: 'Secret Key...' },
        { byokField: 'klingApiKey', label: 'Or Single Bearer Token', placeholder },
      ];
    case 'dreamina':
      return [
        { byokField: 'seedanceApiKey', label: 'BytePlus / Dreamina API Key', placeholder },
        {
          byokField: 'seedanceEndpoint',
          label: 'Endpoint ID (Optional)',
          placeholder: 'ep-... (Ark Model Endpoint)',
          isUrl: true,
        },
      ];
    case 'google-flow':
      return [{ byokField: 'geminiApiKey', label: 'Google AI Studio Key', placeholder }];
    case 'elevenlabs':
      return [{ byokField: 'elevenlabsApiKey', label: 'ElevenLabs API Key', placeholder }];
    case 'openart':
      return [{ byokField: 'openartApiKey', label: 'OpenArt API Key', placeholder }];
    case 'imagineart':
      return [{ byokField: 'imagineartApiKey', label: 'ImagineArt API Key', placeholder }];
    case 'openai':
      return [{ byokField: 'openaiApiKey', label: 'OpenAI API Key', placeholder }];
    case 'fal':
      return [{ byokField: 'falApiKey', label: 'Fal.ai API Key', placeholder }];
    case 'replicate':
      return [{ byokField: 'replicateApiKey', label: 'Replicate API Token', placeholder }];
    case 'comfyui':
      return [
        {
          byokField: 'comfyUiUrl',
          label: 'Local ComfyUI Server URL',
          placeholder: 'http://127.0.0.1:8188',
          isUrl: true,
        },
      ];
    default:
      return [{ byokField: 'geminiApiKey', label: 'API Key', placeholder }];
  }
}

function VerificationReadout({ result }: { result?: ProviderVerificationResult }) {
  if (!result) return null;
  const detailText = result.valid
    ? result.message || `${result.allCount ?? 'Live'} models available`
    : result.error || result.message || 'Check your API key and try again.';
  return (
    <div
      className={`mt-2.5 flex items-start gap-2 rounded-lg border px-3 py-2 text-[11px] leading-snug ${
        result.valid
          ? 'border-[#10b981]/35 bg-[#10b981]/10 text-[#6ee7b7]'
          : 'border-[#ef4444]/35 bg-[#ef4444]/10 text-[#fca5a5]'
      }`}
    >
      {result.valid ? (
        <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0 text-[#10b981]" />
      ) : (
        <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-[#ef4444]" />
      )}
      <div className="min-w-0 flex-1">
        <div className="font-semibold flex items-center gap-1.5">
          <span>{result.valid ? 'Connected' : 'Verification Failed'}</span>
        </div>
        <div className="opacity-90 break-words mt-0.5">{detailText}</div>
      </div>
    </div>
  );
}

export const ProviderModal: React.FC = () => {
  const providerModalOpen = useStudioStore((s) => s.providerModalOpen);
  const providerModalTab = useStudioStore((s) => s.providerModalTab);
  const providerFocusField = useStudioStore((s) => s.providerFocusField);
  const closeProviderModal = useStudioStore((s) => s.closeProviderModal);
  const openProviderModal = useStudioStore((s) => s.openProviderModal);

  const byok = useStudioStore((s) => s.byok);
  const updateByok = useStudioStore((s) => s.updateByok);
  const clearByokKeys = useStudioStore((s) => s.clearByokKeys);
  const providerVerifyStatus = useStudioStore((s) => s.providerVerifyStatus);
  const verifyingProvider = useStudioStore((s) => s.verifyingProvider);
  const verifyProviderConnection = useStudioStore((s) => s.verifyProviderConnection);

  const connectedBrowserPlatforms = useStudioStore((s) => s.connectedBrowserPlatforms);
  const connectedMcpPlatforms = useStudioStore((s) => s.connectedMcpPlatforms);
  const configuredApiPlatforms = useStudioStore((s) => s.configuredApiPlatforms);
  const launchingBrowserTarget = useStudioStore((s) => s.launchingBrowserTarget);
  const refreshConnectionsStatus = useStudioStore((s) => s.refreshConnectionsStatus);
  const launchConnectedCreatorBrowser = useStudioStore((s) => s.launchConnectedCreatorBrowser);

  const mcpServers = useStudioStore((s) => s.mcpServers);
  const mcpHealth = useStudioStore((s) => s.mcpHealth);
  const refreshMcpServer = useStudioStore((s) => s.refreshMcpServer);
  const spawnMcpToolAsCanvasNode = useStudioStore((s) => s.spawnMcpToolAsCanvasNode);

  const externalMcpServers = useStudioStore((s) => s.externalMcpServers);
  const platformsCatalog = useStudioStore((s) => s.platformsCatalog);
  const addExternalMcpServer = useStudioStore((s) => s.addExternalMcpServer);
  const refreshExternalMcpById = useStudioStore((s) => s.refreshExternalMcpById);
  const removeExternalMcpById = useStudioStore((s) => s.removeExternalMcpById);
  const refreshPlatformsAndExternalMcp = useStudioStore((s) => s.refreshPlatformsAndExternalMcp);

  const chromeBridge = useStudioStore((s) => s.chromeBridge);
  const bridgeWsConnected = useStudioStore((s) => s.bridgeWsConnected);
  const pingBridge = useStudioStore((s) => s.pingBridge);
  const liveBridgeTestRunning = useStudioStore((s) => s.liveBridgeTestRunning);
  const liveBridgeStatusText = useStudioStore((s) => s.liveBridgeStatusText);
  const runLiveBridgeTestGeneration = useStudioStore((s) => s.runLiveBridgeTestGeneration);

  const showToast = useStudioStore((s) => s.showToast);
  const spawnDreaminaNodeAt = useStudioStore((s) => s.spawnDreaminaNodeAt);
  const updateNodeFields = useStudioStore((s) => s.updateNodeFields);

  const [selectedPlatformId, setSelectedPlatformId] = useState<PlatformId>('higgsfield');
  const [selectedMcpPresetId, setSelectedMcpPresetId] = useState<string>(
    EXTERNAL_MCP_TEMPLATES[0]?.id ?? 'tpl-elevenlabs-mcp'
  );
  const [mcpApiKeyInput, setMcpApiKeyInput] = useState('');
  const [mcpAdvancedOpen, setMcpAdvancedOpen] = useState(false);
  const [mcpName, setMcpName] = useState(EXTERNAL_MCP_TEMPLATES[0]?.name ?? 'ElevenLabs Voice & SFX MCP');
  const [mcpPlatformId, setMcpPlatformId] = useState<string>(
    EXTERNAL_MCP_TEMPLATES[0]?.platformId ?? 'elevenlabs'
  );
  const [mcpTransport, setMcpTransport] = useState<'stdio' | 'http'>('stdio');
  const [mcpCommand, setMcpCommand] = useState(EXTERNAL_MCP_TEMPLATES[0]?.command ?? 'npx');
  const [mcpArgsText, setMcpArgsText] = useState(
    (EXTERNAL_MCP_TEMPLATES[0]?.args ?? ['-y', '@modelcontextprotocol/server-elevenlabs']).join(' ')
  );
  const [mcpEnvKeyName, setMcpEnvKeyName] = useState(
    EXTERNAL_MCP_TEMPLATES[0]?.envKeyName ?? 'ELEVENLABS_API_KEY'
  );
  const [mcpUrl, setMcpUrl] = useState('http://127.0.0.1:4100/mcp');
  const [mcpAdding, setMcpAdding] = useState(false);

  const [manualAccordionOpen, setManualAccordionOpen] = useState(false);
  const [copiedSnippet, setCopiedSnippet] = useState<string | null>(null);

  const activeTab: 'platforms' | 'mcp' = providerModalTab === 'mcp' ? 'mcp' : 'platforms';

  useEffect(() => {
    if (!providerModalOpen) return;
    if (providerFocusField) {
      setSelectedPlatformId(focusFieldToPlatformId(providerFocusField));
    }
  }, [providerModalOpen, providerFocusField]);

  useEffect(() => {
    if (!providerModalOpen) return;
    void refreshConnectionsStatus();
    const timer = window.setInterval(() => {
      void refreshConnectionsStatus();
    }, 3000);
    return () => window.clearInterval(timer);
  }, [providerModalOpen, refreshConnectionsStatus]);

  const liveStatusObj = useMemo(
    () => ({
      connectedBrowserPlatforms,
      connectedMcpPlatforms,
      configuredApiPlatforms,
    }),
    [connectedBrowserPlatforms, connectedMcpPlatforms, configuredApiPlatforms]
  );

  const platformStatuses = useMemo(() => {
    const map: Record<string, ReturnType<typeof getPlatformConnectionStatus>> = {};
    for (const plat of PLATFORM_CATALOG) {
      const backendPlat = platformsCatalog.find((b) => b.id === plat.id);
      map[plat.id] = getPlatformConnectionStatus(
        plat.id,
        byok,
        chromeBridge,
        externalMcpServers,
        backendPlat,
        liveStatusObj
      );
    }
    return map;
  }, [byok, chromeBridge, externalMcpServers, platformsCatalog, liveStatusObj]);

  const connectedTotalCount = useMemo(
    () => PLATFORM_CATALOG.filter((p) => platformStatuses[p.id]?.connected).length,
    [platformStatuses]
  );

  if (!providerModalOpen) return null;

  const selectedPlatform =
    PLATFORM_CATALOG.find((p) => p.id === selectedPlatformId) ?? PLATFORM_CATALOG[0];
  const selectedStatus = platformStatuses[selectedPlatform.id];
  const selectedMeta = PLATFORM_UI_META[selectedPlatform.id];
  const selectedVerifySlug = platformIdToVerifySlug(selectedPlatform.id);
  const selectedVerifyResult = providerVerifyStatus[selectedVerifySlug];
  const isVerifyingSelected = Boolean(verifyingProvider[selectedVerifySlug]);
  const keyFields = getPlatformKeyFields(selectedPlatform.id);

  const consoleSnippet = `import('http://localhost:3001/bridge-connector.js')`;
  const extensionFolderPath = 'open-dreamflow/extensions/chrome-bridge';

  const handleCopyText = async (text: string, tag: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedSnippet(tag);
      showToast(`Copied ${tag} to clipboard`, 'ok');
      window.setTimeout(() => setCopiedSnippet(null), 1800);
    } catch {
      showToast('Copy failed — please copy manually', 'error');
    }
  };

  const handlePasteIntoField = async (byokField: keyof BYOKCredentials) => {
    try {
      const clip = await navigator.clipboard.readText();
      if (!clip.trim()) {
        showToast('Clipboard is empty', 'error');
        return;
      }
      updateByok({ [byokField]: clip.trim() } as Partial<BYOKCredentials>);
      showToast('Pasted from clipboard', 'ok');
    } catch {
      showToast('Browser blocked clipboard read — paste with Cmd+V', 'error');
    }
  };

  const handleSelectMcpPreset = (presetId: string) => {
    setSelectedMcpPresetId(presetId);
    const tpl = EXTERNAL_MCP_TEMPLATES.find((t) => t.id === presetId);
    if (!tpl) return;
    setMcpName(tpl.name);
    setMcpPlatformId(tpl.platformId);
    setMcpTransport(tpl.transport);
    setMcpCommand(tpl.command || 'npx');
    setMcpArgsText((tpl.args || []).join(' '));
    setMcpUrl(tpl.url || 'http://127.0.0.1:4100/mcp');
    const primaryEnvKey = tpl.envKeyName || '';
    setMcpEnvKeyName(primaryEnvKey);

    // Pre-fill API key cleanly if already stored in BYOK
    if (tpl.platformId === 'elevenlabs' && byok.elevenlabsApiKey) {
      setMcpApiKeyInput(byok.elevenlabsApiKey);
    } else if (tpl.platformId === 'fal' && byok.falApiKey) {
      setMcpApiKeyInput(byok.falApiKey);
    } else if (tpl.platformId === 'replicate' && byok.replicateApiKey) {
      setMcpApiKeyInput(byok.replicateApiKey);
    } else {
      setMcpApiKeyInput('');
    }
    setMcpAdvancedOpen(tpl.id === 'tpl-http-mcp');
  };

  const handleConnectMcpPreset = async () => {
    const isCustom = selectedMcpPresetId === 'tpl-http-mcp';
    const trimmedKey = mcpApiKeyInput.trim();
    if (!isCustom && mcpEnvKeyName && !trimmedKey) {
      showToast(`Paste your ${mcpEnvKeyName} first`, 'error');
      return;
    }
    setMcpAdding(true);
    try {
      const envPayload: Record<string, string> = {};
      if (mcpEnvKeyName && trimmedKey) {
        envPayload[mcpEnvKeyName] = trimmedKey;
      }
      const ok = await addExternalMcpServer({
        name: mcpName.trim() || 'MCP Server',
        platformId: mcpPlatformId,
        transport: mcpTransport,
        command: mcpTransport === 'stdio' ? mcpCommand.trim() : undefined,
        args:
          mcpTransport === 'stdio'
            ? mcpArgsText
                .split(/\s+/)
                .map((s) => s.trim())
                .filter(Boolean)
            : undefined,
        env: Object.keys(envPayload).length > 0 ? envPayload : undefined,
        url: mcpTransport === 'http' ? mcpUrl.trim() : undefined,
        headers:
          mcpTransport === 'http' && trimmedKey
            ? { Authorization: `Bearer ${trimmedKey}` }
            : undefined,
      });
      if (ok) {
        await refreshConnectionsStatus();
      }
    } finally {
      setMcpAdding(false);
    }
  };

  const localStudioEngine = mcpServers[0];
  const isCustomMcpSelected = selectedMcpPresetId === 'tpl-http-mcp';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-3 sm:p-6"
      onClick={closeProviderModal}
    >
      <div
        className="relative flex flex-col w-full max-w-[1040px] max-h-[90vh] rounded-2xl border border-white/[0.09] bg-[#111111] text-[#e5e5e5] shadow-[0_24px_80px_rgba(0,0,0,0.75)] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Modal Header */}
        <div className="flex items-center justify-between gap-4 px-5 py-3.5 border-b border-white/[0.07] bg-[#141414]">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-white/[0.06] border border-white/[0.08] flex items-center justify-center shrink-0">
              <PlugZap className="w-4 h-4 text-[#20D5EC]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-white tracking-tight truncate">
                  Connections · Credits &amp; API Keys
                </h2>
                <span className="inline-flex items-center gap-1 rounded-full border border-[#10b981]/30 bg-[#10b981]/10 px-2 py-0.5 text-[10px] font-medium text-[#6ee7b7]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#10b981]" />
                  {connectedTotalCount} / {PLATFORM_CATALOG.length} Connected
                </span>
              </div>
              <p className="text-[11px] text-[#9a9a9a] truncate">
                Use your existing web subscriptions via 1-Click Connected Browser or paste $0-markup API keys.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => void refreshConnectionsStatus()}
              title="Refresh live connection status"
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.04] hover:bg-white/[0.08] px-2.5 py-1.5 text-[11px] text-[#cfcfcf] transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <button
              type="button"
              onClick={closeProviderModal}
              aria-label="Close Connections Modal"
              className="w-8 h-8 rounded-lg border border-white/[0.08] bg-white/[0.04] hover:bg-white/[0.09] flex items-center justify-center text-[#bdbdbd] hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Hero 1-Click Guided Onboarding Banner */}
        <div className="px-5 py-3.5 border-b border-white/[0.07] bg-[#161616]">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3.5">
            <div className="space-y-2 min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-[11px]">
                <span className="inline-flex items-center gap-1.5 rounded-md bg-white/[0.05] border border-white/[0.07] px-2 py-1 text-[#d4d4d4]">
                  <span className="w-4 h-4 rounded-full bg-white text-black font-bold text-[10px] inline-flex items-center justify-center">
                    1
                  </span>
                  Click Launch Connected Browser
                </span>
                <ChevronRight className="w-3.5 h-3.5 text-[#666]" />
                <span className="inline-flex items-center gap-1.5 rounded-md bg-white/[0.05] border border-white/[0.07] px-2 py-1 text-[#d4d4d4]">
                  <span className="w-4 h-4 rounded-full bg-white text-black font-bold text-[10px] inline-flex items-center justify-center">
                    2
                  </span>
                  Sign into your accounts once
                </span>
                <ChevronRight className="w-3.5 h-3.5 text-[#666]" />
                <span className="inline-flex items-center gap-1.5 rounded-md bg-[#10b981]/10 border border-[#10b981]/30 px-2 py-1 text-[#6ee7b7]">
                  <span className="w-4 h-4 rounded-full bg-[#10b981] text-black font-bold text-[10px] inline-flex items-center justify-center">
                    3
                  </span>
                  Green Connected badge lights up automatically
                </span>
              </div>
              <p className="text-[11px] text-[#8f8f8f]">
                No Chrome DevTools setup required — opens a pre-linked Creator Chrome profile signed into Higgsfield, Sume, Kling, Dreamina, Google Flow, OpenArt, ImagineArt, and ElevenLabs.
              </p>
            </div>

            <button
              type="button"
              onClick={() => void launchConnectedCreatorBrowser('all')}
              disabled={launchingBrowserTarget !== null}
              className="shrink-0 inline-flex items-center justify-center gap-2 rounded-xl bg-white hover:bg-[#e9e9e9] disabled:opacity-60 px-4 py-2.5 text-xs font-semibold text-[#0e0e0e] shadow-sm transition-colors cursor-pointer"
            >
              {launchingBrowserTarget === 'all' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Globe className="w-4 h-4" />
              )}
              <span>
                {launchingBrowserTarget === 'all'
                  ? 'Launching Connected Browser...'
                  : 'Launch Connected Creator Browser (Connect All Accounts)'}
              </span>
            </button>
          </div>
        </div>

        {/* Clean 2-Tab Navigation */}
        <div className="flex items-center justify-between gap-3 px-5 pt-2.5 border-b border-white/[0.07] bg-[#121212]">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => openProviderModal('byok', selectedPlatform.id)}
              className={`px-3.5 py-2 text-xs font-medium rounded-t-lg border-b-2 transition-colors ${
                activeTab === 'platforms'
                  ? 'border-[#20D5EC] text-white bg-white/[0.04]'
                  : 'border-transparent text-[#8c8c8c] hover:text-[#d4d4d4]'
              }`}
            >
              Creator Platforms &amp; APIs ({PLATFORM_CATALOG.length})
            </button>
            <button
              type="button"
              onClick={() => openProviderModal('mcp')}
              className={`px-3.5 py-2 text-xs font-medium rounded-t-lg border-b-2 transition-colors ${
                activeTab === 'mcp'
                  ? 'border-[#20D5EC] text-white bg-white/[0.04]'
                  : 'border-transparent text-[#8c8c8c] hover:text-[#d4d4d4]'
              }`}
            >
              MCP Servers · 1-Click Presets ({externalMcpServers.length + 1})
            </button>
          </div>

          <div className="hidden sm:flex items-center gap-2 pb-1.5 text-[11px] text-[#888]">
            <ShieldCheck className="w-3.5 h-3.5 text-[#10b981]" />
            <span>Zero markup · Keys stay local in your browser</span>
          </div>
        </div>

        {/* Main Body */}
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
          {activeTab === 'platforms' ? (
            <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-[260px_1fr] overflow-hidden">
              {/* Left Sidebar: All 12 Platforms */}
              <div className="border-b md:border-b-0 md:border-r border-white/[0.07] bg-[#131313] overflow-y-auto p-2.5 space-y-1">
                {PLATFORM_CATALOG.map((plat) => {
                  const st = platformStatuses[plat.id];
                  const isActive = selectedPlatform.id === plat.id;
                  return (
                    <button
                      key={plat.id}
                      type="button"
                      onClick={() => setSelectedPlatformId(plat.id)}
                      className={`w-full text-left rounded-xl px-3 py-2.5 border transition-all flex items-center justify-between gap-2 ${
                        isActive
                          ? 'bg-[#1d1d1d] border-white/[0.16] text-white shadow-sm'
                          : 'bg-transparent border-transparent hover:bg-white/[0.04] text-[#bcbcbc]'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-medium truncate">{plat.name}</div>
                        <div className="text-[10px] text-[#7f7f7f] truncate mt-0.5">
                          {plat.modalities.join(' · ')}
                        </div>
                      </div>
                      <span
                        className={`shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium border ${
                          st?.connected
                            ? 'border-[#10b981]/35 bg-[#10b981]/10 text-[#6ee7b7]'
                            : 'border-white/[0.08] bg-white/[0.03] text-[#8c8c8c]'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            st?.connected ? 'bg-[#10b981]' : 'bg-[#5c5c5c]'
                          }`}
                        />
                        <span>{st?.connected ? st.statusLabel.replace('Connected via ', '') : 'Off'}</span>
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Right Detail Pane: Selected Platform */}
              <div className="overflow-y-auto p-5 space-y-4 bg-[#111111]">
                {/* Platform Header */}
                <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b border-white/[0.07]">
                  <div>
                    <div className="flex items-center gap-2.5">
                      <h3 className="text-base font-semibold text-white">{selectedPlatform.name}</h3>
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium border ${
                          selectedStatus?.connected
                            ? 'border-[#10b981]/35 bg-[#10b981]/10 text-[#6ee7b7]'
                            : 'border-white/[0.1] bg-white/[0.04] text-[#9b9b9b]'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            selectedStatus?.connected ? 'bg-[#10b981]' : 'bg-[#666]'
                          }`}
                        />
                        {selectedStatus?.statusLabel || 'Not Connected'}
                      </span>
                    </div>
                    <p className="text-xs text-[#9b9b9b] mt-1">
                      {selectedMeta?.tagline || selectedPlatform.webUrl}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {selectedPlatform.modalities.map((m) => (
                      <span
                        key={m}
                        className="rounded-md border border-white/[0.08] bg-white/[0.03] px-2 py-0.5 text-[10px] uppercase tracking-wider text-[#b5b5b5]"
                      >
                        {m}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Two Clean Side-by-Side Cards: Card A (1-Click Sign In) & Card B (Official API Key) */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Card A: Use Web Subscription / Free Credits */}
                  <div className="flex flex-col justify-between rounded-xl border border-white/[0.08] bg-[#161616] p-4 space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#20D5EC]">
                          <Globe className="w-3.5 h-3.5" />
                          Option A · Web Subscription / Free Credits
                        </span>
                        {selectedStatus?.hasBrowser && (
                          <span className="text-[10px] font-medium text-[#6ee7b7]">
                            ● Connected via Browser
                          </span>
                        )}
                      </div>

                      <h4 className="text-sm font-semibold text-white">1-Click Sign In</h4>
                      <p className="text-xs text-[#9c9c9c] leading-relaxed">
                        {selectedPlatform.supportsBrowserBridge
                          ? `Use your existing ${selectedPlatform.name} subscription or daily free credits directly from your signed-in Creator Browser tab — no API billing needed.`
                          : `${selectedPlatform.name} runs via API Key or local endpoint (use Option B on the right).`}
                      </p>
                    </div>

                    <div className="space-y-2.5">
                      {selectedPlatform.supportsBrowserBridge ? (
                        <>
                          <button
                            type="button"
                            onClick={() => void launchConnectedCreatorBrowser(selectedPlatform.id)}
                            disabled={launchingBrowserTarget !== null}
                            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-white hover:bg-[#eaeaea] disabled:opacity-60 px-4 py-2.5 text-xs font-semibold text-[#0e0e0e] transition-colors cursor-pointer"
                          >
                            {launchingBrowserTarget === selectedPlatform.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <ExternalLink className="w-3.5 h-3.5" />
                            )}
                            <span>
                              {launchingBrowserTarget === selectedPlatform.id
                                ? `Opening ${selectedPlatform.name}...`
                                : `Sign In to ${selectedPlatform.name} ↗`}
                            </span>
                          </button>

                          {selectedStatus?.hasBrowser && (
                            <div className="flex flex-wrap items-center gap-2 pt-1">
                              <button
                                type="button"
                                onClick={() =>
                                  void runLiveBridgeTestGeneration(
                                    selectedPlatform.id as BrowserPlatformTarget,
                                    selectedPlatform.modalities[0]
                                  )
                                }
                                disabled={liveBridgeTestRunning !== null}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-[#10b981]/35 bg-[#10b981]/10 hover:bg-[#10b981]/20 px-3 py-1.5 text-[11px] font-medium text-[#6ee7b7] transition-colors"
                              >
                                {liveBridgeTestRunning === selectedPlatform.id ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <Sparkles className="w-3 h-3" />
                                )}
                                <span>Test Connection</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  const modality = selectedPlatform.modalities[0];
                                  const kind =
                                    modality === 'audio'
                                      ? 'audio'
                                      : modality === 'video'
                                        ? 'video'
                                        : 'image';
                                  const id = spawnDreaminaNodeAt(kind, 240, 180);
                                  if (id) {
                                    updateNodeFields(id, {
                                      platformId: selectedPlatform.id,
                                      connectionMode: 'browser-bridge',
                                    });
                                  }
                                  closeProviderModal();
                                }}
                                className="inline-flex items-center gap-1 rounded-lg border border-white/[0.1] bg-white/[0.04] hover:bg-white/[0.08] px-2.5 py-1.5 text-[11px] text-[#d4d4d4] transition-colors"
                              >
                                <Plus className="w-3 h-3" />
                                <span>Add {selectedPlatform.name} Node</span>
                              </button>
                            </div>
                          )}

                          {liveBridgeStatusText && liveBridgeTestRunning === null && (
                            <div className="rounded-lg border border-white/[0.08] bg-black/30 px-2.5 py-1.5 text-[11px] text-[#bdbdbd]">
                              {liveBridgeStatusText}
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="rounded-xl border border-white/[0.08] bg-black/25 px-3.5 py-3 text-[11px] text-[#9c9c9c]">
                          Browser subscription bridge is not needed for {selectedPlatform.name}. Paste your key/URL in Option B to connect immediately.
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Card B: Use Official API Key ($0 Markup) */}
                  <div className="flex flex-col justify-between rounded-xl border border-white/[0.08] bg-[#161616] p-4 space-y-4">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#d4d4d4]">
                          <KeyRound className="w-3.5 h-3.5 text-[#20D5EC]" />
                          Option B · Official API Key ($0 Markup)
                        </span>
                        {selectedStatus?.hasApiKey && (
                          <span className="text-[10px] font-medium text-[#6ee7b7]">
                            ● Connected via API Key
                          </span>
                        )}
                      </div>

                      {selectedMeta?.apiKeyUrl && (
                        <a
                          href={selectedMeta.apiKeyUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="w-full inline-flex items-center justify-between gap-2 rounded-lg border border-white/[0.1] bg-white/[0.04] hover:bg-white/[0.08] px-3 py-2 text-xs font-medium text-white transition-colors"
                        >
                          <span>{selectedMeta.apiKeyUrlLabel || `Get ${selectedPlatform.name} API Key ↗`}</span>
                          <ExternalLink className="w-3.5 h-3.5 text-[#9c9c9c]" />
                        </a>
                      )}

                      <div className="space-y-2.5">
                        {keyFields.map((fieldCfg, idx) => (
                          <div key={fieldCfg.byokField} className="space-y-1">
                            <label className="block text-[11px] font-medium text-[#b5b5b5]">
                              {fieldCfg.label}
                            </label>
                            <div className="flex items-center gap-1.5">
                              <input
                                type={fieldCfg.isUrl ? 'text' : 'password'}
                                value={String(byok[fieldCfg.byokField] ?? '')}
                                onChange={(e) =>
                                  updateByok({
                                    [fieldCfg.byokField]: e.target.value,
                                  } as Partial<BYOKCredentials>)
                                }
                                placeholder={fieldCfg.placeholder}
                                className="flex-1 min-w-0 rounded-lg border border-white/[0.1] bg-[#0e0e0e] px-3 py-2 text-xs text-white placeholder-[#5e5e5e] focus:border-[#20D5EC] focus:outline-none"
                              />
                              {idx === 0 && (
                                <button
                                  type="button"
                                  onClick={() => void handlePasteIntoField(fieldCfg.byokField)}
                                  title="Paste from clipboard"
                                  className="shrink-0 inline-flex items-center gap-1 rounded-lg border border-white/[0.1] bg-white/[0.05] hover:bg-white/[0.1] px-2.5 py-2 text-[11px] text-[#d4d4d4] transition-colors"
                                >
                                  <ClipboardPaste className="w-3.5 h-3.5" />
                                  <span>Paste</span>
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>

                      <VerificationReadout result={selectedVerifyResult} />
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          const patch: Partial<BYOKCredentials> = {};
                          for (const f of keyFields) {
                            patch[f.byokField] = '' as never;
                          }
                          updateByok(patch);
                          showToast(`Cleared ${selectedPlatform.name} key`, 'ok');
                        }}
                        className="text-[11px] text-[#888] hover:text-[#e5e5e5] transition-colors"
                      >
                        Clear key
                      </button>

                      <button
                        type="button"
                        onClick={() => void verifyProviderConnection(selectedVerifySlug)}
                        disabled={isVerifyingSelected}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-white hover:bg-[#e8e8e8] disabled:opacity-60 px-4 py-2 text-xs font-semibold text-[#0e0e0e] transition-colors cursor-pointer"
                      >
                        {isVerifyingSelected ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        )}
                        <span>{isVerifyingSelected ? 'Verifying...' : 'Save & Verify'}</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Available Models on this platform */}
                <div className="rounded-xl border border-white/[0.07] bg-[#141414] p-3.5">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-[11px] font-medium text-[#b5b5b5]">
                      Models unlocked by connecting {selectedPlatform.name}
                    </span>
                    <span className="text-[10px] text-[#7c7c7c]">
                      {selectedPlatform.models.length} models
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedPlatform.models.map((m) => (
                      <span
                        key={m.id}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-[11px] text-[#d6d6d6]"
                      >
                        <span className="font-medium text-white">{m.label}</span>
                        <span className="text-[10px] text-[#8f8f8f]">· {m.modality}</span>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Tab 2: MCP Servers (1-Click Presets) */
            <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-5 bg-[#111111]">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                {EXTERNAL_MCP_TEMPLATES.map((tpl) => {
                  const selected = selectedMcpPresetId === tpl.id;
                  return (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() => handleSelectMcpPreset(tpl.id)}
                      className={`text-left rounded-xl border p-3.5 transition-all ${
                        selected
                          ? 'border-[#20D5EC]/60 bg-[#182225] text-white'
                          : 'border-white/[0.08] bg-[#161616] hover:bg-[#1b1b1b] text-[#d0d0d0]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <Server className="w-4 h-4 text-[#20D5EC] shrink-0" />
                        <span className="text-[10px] uppercase tracking-wider text-[#8e8e8e]">
                          {tpl.id === 'tpl-http-mcp' ? 'Custom' : '1-Click Preset'}
                        </span>
                      </div>
                      <div className="text-xs font-semibold text-white mt-2">{tpl.name}</div>
                      <div className="text-[11px] text-[#959595] mt-1 line-clamp-2">
                        {tpl.description}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Guided 1-Click MCP Connection Box */}
              <div className="rounded-xl border border-white/[0.08] bg-[#161616] p-4 space-y-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-semibold text-white">{mcpName}</h4>
                    <p className="text-[11px] text-[#959595] mt-0.5">
                      {isCustomMcpSelected
                        ? 'Connect any HTTP/SSE or local MCP endpoint to expose its tools directly as canvas nodes.'
                        : mcpEnvKeyName
                          ? `Step 1: Paste your ${mcpEnvKeyName} · Step 2: Click Connect MCP`
                          : 'Click Connect MCP below to activate this built-in browser/automation MCP preset.'}
                    </p>
                  </div>

                  {!isCustomMcpSelected && (
                    <button
                      type="button"
                      onClick={() => setMcpAdvancedOpen((v) => !v)}
                      className="text-[11px] text-[#9a9a9a] hover:text-white underline underline-offset-2"
                    >
                      {mcpAdvancedOpen ? 'Hide Advanced Config' : 'Advanced Config'}
                    </button>
                  )}
                </div>

                {!isCustomMcpSelected && mcpEnvKeyName && (
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    <input
                      type="password"
                      value={mcpApiKeyInput}
                      onChange={(e) => setMcpApiKeyInput(e.target.value)}
                      placeholder={`Paste your ${mcpEnvKeyName}...`}
                      className="flex-1 rounded-lg border border-white/[0.1] bg-[#0e0e0e] px-3 py-2 text-xs text-white placeholder-[#606060] focus:border-[#20D5EC] focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => void handleConnectMcpPreset()}
                      disabled={mcpAdding}
                      className="shrink-0 inline-flex items-center justify-center gap-1.5 rounded-xl bg-white hover:bg-[#e9e9e9] disabled:opacity-60 px-4 py-2 text-xs font-semibold text-[#0e0e0e] transition-colors cursor-pointer"
                    >
                      {mcpAdding ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <PlugZap className="w-3.5 h-3.5" />
                      )}
                      <span>{mcpAdding ? 'Connecting...' : 'Connect MCP'}</span>
                    </button>
                  </div>
                )}

                {!isCustomMcpSelected && !mcpEnvKeyName && (
                  <div>
                    <button
                      type="button"
                      onClick={() => void handleConnectMcpPreset()}
                      disabled={mcpAdding}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-white hover:bg-[#e9e9e9] disabled:opacity-60 px-4 py-2 text-xs font-semibold text-[#0e0e0e] transition-colors cursor-pointer"
                    >
                      {mcpAdding ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <PlugZap className="w-3.5 h-3.5" />
                      )}
                      <span>{mcpAdding ? 'Connecting...' : 'Connect Preset MCP'}</span>
                    </button>
                  </div>
                )}

                {(isCustomMcpSelected || mcpAdvancedOpen) && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-white/[0.06]">
                    <div>
                      <label className="block text-[11px] text-[#a5a5a5] mb-1">Server Name</label>
                      <input
                        type="text"
                        value={mcpName}
                        onChange={(e) => setMcpName(e.target.value)}
                        className="w-full rounded-lg border border-white/[0.1] bg-[#0e0e0e] px-3 py-2 text-xs text-white focus:border-[#20D5EC] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-[#a5a5a5] mb-1">Transport</label>
                      <select
                        value={mcpTransport}
                        onChange={(e) => setMcpTransport(e.target.value as 'stdio' | 'http')}
                        className="w-full rounded-lg border border-white/[0.1] bg-[#0e0e0e] px-3 py-2 text-xs text-white focus:border-[#20D5EC] focus:outline-none"
                      >
                        <option value="http">HTTP / SSE Endpoint</option>
                        <option value="stdio">Local Command (stdio)</option>
                      </select>
                    </div>

                    {mcpTransport === 'http' ? (
                      <div className="sm:col-span-2">
                        <label className="block text-[11px] text-[#a5a5a5] mb-1">MCP URL</label>
                        <input
                          type="text"
                          value={mcpUrl}
                          onChange={(e) => setMcpUrl(e.target.value)}
                          placeholder="http://127.0.0.1:4100/mcp"
                          className="w-full rounded-lg border border-white/[0.1] bg-[#0e0e0e] px-3 py-2 text-xs text-white focus:border-[#20D5EC] focus:outline-none"
                        />
                      </div>
                    ) : (
                      <>
                        <div>
                          <label className="block text-[11px] text-[#a5a5a5] mb-1">Command</label>
                          <input
                            type="text"
                            value={mcpCommand}
                            onChange={(e) => setMcpCommand(e.target.value)}
                            className="w-full rounded-lg border border-white/[0.1] bg-[#0e0e0e] px-3 py-2 text-xs text-white font-mono focus:border-[#20D5EC] focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] text-[#a5a5a5] mb-1">Args</label>
                          <input
                            type="text"
                            value={mcpArgsText}
                            onChange={(e) => setMcpArgsText(e.target.value)}
                            className="w-full rounded-lg border border-white/[0.1] bg-[#0e0e0e] px-3 py-2 text-xs text-white font-mono focus:border-[#20D5EC] focus:outline-none"
                          />
                        </div>
                      </>
                    )}

                    {isCustomMcpSelected && (
                      <div className="sm:col-span-2 flex justify-end">
                        <button
                          type="button"
                          onClick={() => void handleConnectMcpPreset()}
                          disabled={mcpAdding}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-white hover:bg-[#e9e9e9] px-4 py-2 text-xs font-semibold text-[#0e0e0e] transition-colors cursor-pointer"
                        >
                          {mcpAdding ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Plus className="w-3.5 h-3.5" />
                          )}
                          <span>Connect Custom MCP</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Connected MCP Servers + Built-In Studio Engine */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-[#9c9c9c]">
                    Active MCP Servers
                  </h4>
                  <button
                    type="button"
                    onClick={() => void refreshPlatformsAndExternalMcp()}
                    className="inline-flex items-center gap-1 text-[11px] text-[#9c9c9c] hover:text-white"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Sync Tools</span>
                  </button>
                </div>

                {/* Built-in :3001/mcp */}
                {localStudioEngine && (
                  <div className="rounded-xl border border-white/[0.08] bg-[#151515] px-4 py-3 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            mcpHealth.online ? 'bg-[#10b981]' : 'bg-[#ef4444]'
                          }`}
                        />
                        <span className="text-xs font-semibold text-white">
                          {localStudioEngine.name}
                        </span>
                        <span className="text-[10px] font-mono text-[#7f7f7f]">
                          {localStudioEngine.url}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#8d8d8d] mt-0.5">
                        {mcpHealth.online
                          ? `${localStudioEngine.tools.length} built-in media & browser tools active`
                          : 'Waiting for local engine on :3001'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void refreshMcpServer(localStudioEngine.id)}
                      className="rounded-lg border border-white/[0.1] bg-white/[0.04] hover:bg-white/[0.08] px-2.5 py-1 text-[11px] text-[#d4d4d4]"
                    >
                      Ping
                    </button>
                  </div>
                )}

                {externalMcpServers.map((srv) => (
                  <div
                    key={srv.id}
                    className="rounded-xl border border-white/[0.08] bg-[#151515] p-3.5 space-y-2.5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            srv.status === 'connected' ? 'bg-[#10b981]' : 'bg-[#f59e0b]'
                          }`}
                        />
                        <span className="text-xs font-semibold text-white truncate">{srv.name}</span>
                        <span className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-[#b4b4b4]">
                          {srv.tools.length} tools
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => void refreshExternalMcpById(srv.id)}
                          className="rounded-lg border border-white/[0.09] bg-white/[0.04] hover:bg-white/[0.08] px-2 py-1 text-[11px] text-[#d4d4d4]"
                        >
                          Refresh
                        </button>
                        <button
                          type="button"
                          onClick={() => void removeExternalMcpById(srv.id)}
                          title="Remove MCP Server"
                          className="rounded-lg border border-white/[0.09] bg-white/[0.04] hover:bg-[#ef4444]/15 hover:text-[#fca5a5] p-1 text-[#999]"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {srv.tools.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {srv.tools.slice(0, 8).map((tool) => (
                          <button
                            key={tool.name}
                            type="button"
                            onClick={() => {
                              spawnMcpToolAsCanvasNode({
                                name: tool.name,
                                description: tool.description || srv.name,
                                serverUrl: srv.url || srv.id,
                                serverName: srv.name,
                                inputSchema: tool.inputSchema || {},
                              });
                              closeProviderModal();
                            }}
                            className="inline-flex items-center gap-1 rounded-lg border border-white/[0.08] bg-black/30 hover:bg-white/[0.08] px-2 py-1 text-[11px] text-[#d4d4d4]"
                          >
                            <Plus className="w-3 h-3 text-[#20D5EC]" />
                            <span>{tool.name}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Collapsible Footer Accordion: Manual Chrome Setup (tucked away cleanly) */}
          <div className="border-t border-white/[0.07] bg-[#131313] px-5 py-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setManualAccordionOpen((v) => !v)}
                className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[#9f9f9f] hover:text-white transition-colors"
              >
                {manualAccordionOpen ? (
                  <ChevronDown className="w-3.5 h-3.5" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5" />
                )}
                <span>Already using your own Chrome window? Manual setup</span>
              </button>

              <div className="flex items-center gap-3 text-[11px]">
                <span className="text-[#7c7c7c]">
                  Bridge WS:{' '}
                  <span className={bridgeWsConnected ? 'text-[#6ee7b7]' : 'text-[#8c8c8c]'}>
                    {bridgeWsConnected ? 'Online (:3001)' : 'Connecting...'}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={pingBridge}
                  className="text-[#9e9e9e] hover:text-white transition-colors"
                >
                  Ping Bridge
                </button>
                <button
                  type="button"
                  onClick={() => {
                    clearByokKeys();
                    showToast('Cleared all saved API keys', 'ok');
                  }}
                  className="text-[#888] hover:text-[#fca5a5] transition-colors"
                >
                  Reset All Keys
                </button>
              </div>
            </div>

            {manualAccordionOpen && (
              <div className="mt-2.5 grid grid-cols-1 md:grid-cols-2 gap-3 rounded-xl border border-white/[0.08] bg-[#0e0e0e] p-3 text-[11px] text-[#b4b4b4]">
                <div className="space-y-1.5">
                  <div className="font-semibold text-white">
                    Method 1 · Unpacked Chrome Extension
                  </div>
                  <p className="text-[#8e8e8e]">
                    Open <code className="text-[#d4d4d4]">chrome://extensions</code> → enable Developer Mode → Load Unpacked folder:
                  </p>
                  <div className="flex items-center gap-1.5">
                    <code className="flex-1 rounded bg-white/[0.05] px-2 py-1 font-mono text-[10px] text-[#d4d4d4] truncate">
                      {extensionFolderPath}
                    </code>
                    <button
                      type="button"
                      onClick={() => void handleCopyText(extensionFolderPath, 'extension path')}
                      className="inline-flex items-center gap-1 rounded border border-white/[0.1] bg-white/[0.05] hover:bg-white/[0.1] px-2 py-1 text-[10px] text-white"
                    >
                      <Copy className="w-3 h-3" />
                      <span>{copiedSnippet === 'extension path' ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="font-semibold text-white">
                    Method 2 · Zero-Install Console Connector
                  </div>
                  <p className="text-[#8e8e8e]">
                    Paste once in DevTools Console on any open creator tab:
                  </p>
                  <div className="flex items-center gap-1.5">
                    <code className="flex-1 rounded bg-white/[0.05] px-2 py-1 font-mono text-[10px] text-[#d4d4d4] truncate">
                      {consoleSnippet}
                    </code>
                    <button
                      type="button"
                      onClick={() => void handleCopyText(consoleSnippet, 'console snippet')}
                      className="inline-flex items-center gap-1 rounded border border-white/[0.1] bg-white/[0.05] hover:bg-white/[0.1] px-2 py-1 text-[10px] text-white"
                    >
                      <Copy className="w-3 h-3" />
                      <span>{copiedSnippet === 'console snippet' ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
