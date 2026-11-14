import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardPaste,
  Copy,
  Cpu,
  ExternalLink,
  Globe,
  KeyRound,
  Layers,
  Loader2,
  Play,
  PlugZap,
  Plus,
  RefreshCw,
  Search,
  Server,
  ShieldCheck,
  Sparkles,
  Terminal,
  Trash2,
  Wrench,
  X,
} from 'lucide-react';
import {
  EXTERNAL_MCP_TEMPLATES,
  PLATFORM_CATALOG,
  PLATFORM_UI_META,
  getPlatformConnectionStatus,
} from '../presets/platformCatalog';
import { callExternalMcpToolViaBackend } from '../services/executionRouter';
import { useStudioStore } from '../store/useStudioStore';
import type {
  BYOKCredentials,
  BrowserPlatformTarget,
  ExternalMcpServerRecord,
  ExternalMcpToolItem,
  McpOAuthSession,
  McpToolCallResult,
  PlatformDefinition,
  PlatformId,
  ProviderVerificationResult,
} from '../types/studio';
import { PlatformBrandIcon } from './PlatformBrandIcon';

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

const RAIL_ORDER: PlatformId[] = [
  'higgsfield',
  'dreamina',
  'elevenlabs',
  'sume',
  'kling',
  'google-flow',
  'openart',
  'imagineart',
  'openai',
  'fal',
  'replicate',
  'comfyui',
  'custom-mcp',
];

const CUSTOM_MCP_PLATFORM: PlatformDefinition = {
  id: 'custom-mcp',
  name: 'Custom MCP',
  shortLabel: 'Custom MCP',
  webUrl: 'https://modelcontextprotocol.io',
  modalities: ['image', 'video', 'audio'],
  supportsBrowserBridge: false,
  supportsApiKey: false,
  supportsMcp: true,
  models: [],
};

function formatCompactRailCredits(credits: number): string {
  if (!Number.isFinite(credits)) return '0';
  if (credits >= 1000) return `${(credits / 1000).toFixed(1)}k`;
  if (credits >= 100) return credits.toFixed(0);
  return credits.toFixed(1);
}

function focusFieldToPlatformId(focus: string | null | undefined): PlatformId {
  if (!focus) return 'higgsfield';
  if (focus === 'gemini') return 'google-flow';
  if (focus === 'seedance') return 'dreamina';
  if (focus === 'custom-mcp') return 'custom-mcp';
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
      return [
        {
          byokField: 'higgsfieldKeyId',
          label: 'Console Key ID',
          placeholder: 'hf_key_id_...',
        },
        {
          byokField: 'higgsfieldKeySecret',
          label: 'Console Key Secret',
          placeholder: 'hf_key_secret_...',
        },
        {
          byokField: 'higgsfieldApiKey',
          label: 'Or Combined KEY_ID:KEY_SECRET Token',
          placeholder: 'KEY_ID:KEY_SECRET',
        },
      ];
    case 'sume':
      return [{ byokField: 'sumeApiKey', label: 'Sume API Key', placeholder }];
    case 'kling':
      return [
        {
          byokField: 'klingAccessKey',
          label: 'Kling Access Key (AK)',
          placeholder: 'Access Key ID...',
        },
        {
          byokField: 'klingSecretKey',
          label: 'Kling Secret Key (SK)',
          placeholder: 'Secret Key...',
        },
        {
          byokField: 'klingApiKey',
          label: 'Or Single Bearer Token',
          placeholder,
        },
      ];
    case 'dreamina':
      return [
        {
          byokField: 'seedanceApiKey',
          label: 'BytePlus / Dreamina API Key',
          placeholder,
        },
        {
          byokField: 'seedanceEndpoint',
          label: 'Endpoint ID / URL (Optional)',
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
        <div className="font-semibold">{result.valid ? 'Connected Successfully' : 'Verification Failed'}</div>
        <div className="opacity-90 break-words mt-0.5">{detailText}</div>
      </div>
    </div>
  );
}

function getOAuthProgressPercent(step: McpOAuthSession['step']): number {
  switch (step) {
    case 'registering':
      return 24;
    case 'awaiting_login':
      return 52;
    case 'exchanging_token':
      return 78;
    case 'discovering_tools':
      return 93;
    case 'connected':
      return 100;
    default:
      return 15;
  }
}

interface ConnectionProgressCardProps {
  platformId: PlatformId;
  platformName: string;
  session: McpOAuthSession;
  onReopenPopup: () => void;
  onCheckStatusNow: () => void;
  onReset: () => void;
}

const ConnectionProgressCard: React.FC<ConnectionProgressCardProps> = ({
  platformId,
  platformName,
  session,
  onReopenPopup,
  onCheckStatusNow,
  onReset,
}) => {
  const step = session.step;
  const pct = getOAuthProgressPercent(step);
  const isError = step === 'error';
  const isConnected = step === 'connected';

  const stageIndex =
    step === 'registering'
      ? 0
      : step === 'awaiting_login'
      ? 1
      : step === 'exchanging_token' || step === 'discovering_tools'
      ? 2
      : step === 'connected'
      ? 3
      : 1;

  const stages = [
    {
      label: `Handshake with ${session.mcpUrl.replace(/^https?:\/\//, '').split('/')[0] || 'MCP'}`,
    },
    { label: `Authorize ${platformName} Account` },
    { label: 'Syncing OAuth Token & Discovering MCP Functions' },
    { label: 'Connected Successfully!' },
  ];

  return (
    <div
      className={`rounded-2xl border p-5 transition-all ${
        isConnected
          ? 'border-[#10b981]/45 bg-gradient-to-b from-[#10b981]/[0.11] to-[#131313] shadow-[0_0_40px_rgba(16,185,129,0.12)]'
          : isError
          ? 'border-[#ef4444]/40 bg-[#ef4444]/[0.06]'
          : 'border-[#20D5EC]/35 bg-[#15181a]'
      }`}
    >
      {/* Orbital Ring + Brand Icon / Spring Emerald Checkmark */}
      <div className="flex flex-col sm:flex-row items-center gap-5">
        <div className="relative w-20 h-20 flex items-center justify-center shrink-0">
          {!isConnected && !isError && (
            <>
              <div
                className="absolute inset-0 rounded-full animate-orbit-spin"
                style={{
                  background:
                    'conic-gradient(from 0deg, rgba(32,213,236,0.95) 0deg, rgba(32,213,236,0.18) 120deg, transparent 240deg, rgba(255,255,255,0.22) 360deg)',
                  WebkitMask:
                    'radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 2px))',
                  mask: 'radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 2px))',
                }}
              />
              <div className="animate-brand-pulse rounded-[14px]">
                <PlatformBrandIcon platformId={platformId} size="xl" />
              </div>
            </>
          )}

          {isConnected && (
            <div className="relative flex items-center justify-center w-20 h-20">
              <div className="absolute inset-0 rounded-full border-2 border-[#10b981]/50 bg-[#10b981]/15 animate-pulse" />
              <div className="relative w-14 h-14 rounded-full bg-[#10b981] flex items-center justify-center shadow-[0_0_24px_rgba(16,185,129,0.5)] animate-check-spring">
                <svg viewBox="0 0 28 28" className="w-8 h-8" fill="none">
                  <path
                    d="M6.5 14.5 11.5 19.5 21.5 8.5"
                    stroke="#062217"
                    strokeWidth="3.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="animate-check-stroke"
                  />
                </svg>
              </div>
              <div className="absolute -bottom-1 -right-1 rounded-md ring-2 ring-[#111]">
                <PlatformBrandIcon platformId={platformId} size="sm" />
              </div>
            </div>
          )}

          {isError && (
            <div className="w-16 h-16 rounded-full bg-[#ef4444]/15 border border-[#ef4444]/40 flex items-center justify-center">
              <AlertCircle className="w-8 h-8 text-[#ef4444]" />
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0 w-full space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h4 className="text-sm font-semibold text-white">
                {isConnected
                  ? 'Connected Successfully!'
                  : isError
                  ? 'Connection Interrupted'
                  : `Connecting ${platformName} Official MCP…`}
              </h4>
              <p className="text-xs text-[#a3a3a3] mt-0.5">
                {isConnected ? (
                  <>
                    Signed in as{' '}
                    <span className="text-white font-medium">
                      {session.account?.email ||
                        session.account?.name ||
                        session.account?.username ||
                        `${platformName} Account`}
                    </span>{' '}
                    ·{' '}
                    <span className="text-[#6ee7b7] font-medium">
                      {session.tools?.length ?? 0} MCP Tools Ready
                    </span>
                  </>
                ) : isError ? (
                  session.error || 'Authorization did not complete.'
                ) : step === 'awaiting_login' ? (
                  <span className="inline-flex flex-wrap items-center gap-2">
                    <span>
                      {session.userCode
                        ? `Authorize in the ${platformName} popup with device code:`
                        : `Sign in & click Allow in the ${platformName} popup window.`}
                    </span>
                    {session.userCode && (
                      <button
                        type="button"
                        onClick={() => void navigator.clipboard?.writeText(session.userCode || '')}
                        title="Copy device verification code"
                        className="inline-flex items-center gap-1 rounded border border-[#20D5EC]/40 bg-[#20D5EC]/15 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-white hover:bg-[#20D5EC]/25"
                      >
                        <span>{session.userCode}</span>
                        <Copy className="w-2.5 h-2.5 text-[#20D5EC]" />
                      </button>
                    )}
                  </span>
                ) : step === 'exchanging_token' || step === 'discovering_tools' ? (
                  'Exchanging PKCE token & loading MCP tool schemas…'
                ) : (
                  'Registering Open-DreamFlow OAuth 2.1 + PKCE client…'
                )}
              </p>
            </div>

            {!isConnected && (
              <span className="text-xs font-mono text-[#20D5EC] font-semibold">
                {isError ? 'Stopped' : `${pct}%`}
              </span>
            )}
          </div>

          {/* Smooth Progress Bar */}
          {!isError && (
            <div className="h-1.5 w-full rounded-full bg-white/[0.08] overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  isConnected ? 'bg-[#10b981]' : 'bg-[#20D5EC]'
                }`}
                style={{ width: `${pct}%` }}
              />
            </div>
          )}

          {/* Live 4-Stage Stepper */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
            {stages.map((st, idx) => {
              const done = isConnected || (!isError && idx < stageIndex);
              const active = !isConnected && !isError && idx === stageIndex;
              return (
                <div
                  key={st.label}
                  className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[11px] border ${
                    done
                      ? 'border-[#10b981]/30 bg-[#10b981]/10 text-[#6ee7b7]'
                      : active
                      ? 'border-[#20D5EC]/40 bg-[#20D5EC]/10 text-white'
                      : 'border-white/[0.06] bg-white/[0.02] text-[#787878]'
                  }`}
                >
                  {done ? (
                    <Check className="w-3.5 h-3.5 text-[#10b981] shrink-0" />
                  ) : active ? (
                    <Loader2 className="w-3.5 h-3.5 text-[#20D5EC] animate-spin shrink-0" />
                  ) : (
                    <span className="w-3.5 h-3.5 rounded-full border border-white/20 text-[9px] inline-flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                  )}
                  <span className="truncate">{idx + 1}. {st.label}</span>
                </div>
              );
            })}
          </div>

          {/* Interactive Recovery Buttons so user is NEVER stuck */}
          {step === 'awaiting_login' && (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                onClick={onReopenPopup}
                className="inline-flex items-center gap-1.5 rounded-lg bg-white hover:bg-[#e7e7e7] px-3 py-1.5 text-[11px] font-semibold text-[#0e0e0e] cursor-pointer"
              >
                <ExternalLink className="w-3 h-3" />
                <span>Re-open Popup</span>
              </button>
              <button
                type="button"
                onClick={onCheckStatusNow}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.12] bg-white/[0.05] hover:bg-white/[0.1] px-3 py-1.5 text-[11px] text-white cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Check Status Now</span>
              </button>
              <button
                type="button"
                onClick={onReset}
                className="text-[11px] text-[#8d8d8d] hover:text-white px-2 py-1"
              >
                Cancel
              </button>
            </div>
          )}

          {isError && (
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={onReset}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.12] bg-white/[0.06] hover:bg-white/[0.12] px-3 py-1.5 text-[11px] text-white"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Try Again</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

type McpToolCategory =
  | 'All'
  | 'Generate'
  | 'Post-Edit'
  | 'Models & Voices'
  | 'Canvas & Nodes'
  | 'Resources & Ops'
  | 'Workflows & 3D'
  | 'Account';

const MCP_TOOL_CATEGORIES: McpToolCategory[] = [
  'All',
  'Generate',
  'Post-Edit',
  'Models & Voices',
  'Canvas & Nodes',
  'Resources & Ops',
  'Workflows & 3D',
  'Account',
];

function classifyMcpToolCategory(toolName: string): Exclude<McpToolCategory, 'All'> {
  const n = toolName.toLowerCase();
  if (/(model|voice)/.test(n)) return 'Models & Voices';
  if (/(balance|auth|session|account|quota|credit|schema|gpu_status)/.test(n)) {
    return 'Account';
  }
  if (/(workflow|director|template)/.test(n)) return 'Workflows & 3D';
  if (/(resource|operation)/.test(n)) return 'Resources & Ops';
  if (/(upscale|cutout|interpolate|promote|inpaint|outpaint|remove_bg)/.test(n)) {
    return 'Post-Edit';
  }
  if (/(canvas|node)/.test(n)) return 'Canvas & Nodes';
  return 'Generate';
}

interface McpFunctionsExplorerProps {
  server: ExternalMcpServerRecord;
  onRefresh: () => void;
  onDisconnect: () => void;
  onSpawnToolNode: (tool: ExternalMcpToolItem) => void;
}

const McpFunctionsExplorer: React.FC<McpFunctionsExplorerProps> = ({
  server,
  onRefresh,
  onDisconnect,
  onSpawnToolNode,
}) => {
  const showToast = useStudioStore((s) => s.showToast);
  const mcpBalances = useStudioStore((s) => s.mcpBalances);
  const [selectedToolName, setSelectedToolName] = useState<string>(
    server.tools[0]?.name || ''
  );
  const [toolSearch, setToolSearch] = useState<string>('');
  const [toolCategory, setToolCategory] = useState<McpToolCategory>('All');
  const [argValues, setArgValues] = useState<Record<string, string>>({});
  const [rawJsonArgs, setRawJsonArgs] = useState<string>('{}');
  const [useRawJson, setUseRawJson] = useState(false);
  const [showAllSchemas, setShowAllSchemas] = useState(false);
  const [runningTool, setRunningTool] = useState<string | null>(null);
  const [callResult, setCallResult] = useState<McpToolCallResult | null>(null);

  useEffect(() => {
    setToolSearch('');
    setToolCategory('All');
  }, [server.id]);

  useEffect(() => {
    if (server.tools.length > 0 && !server.tools.some((t) => t.name === selectedToolName)) {
      setSelectedToolName(server.tools[0].name);
      setArgValues({});
      setRawJsonArgs('{}');
    }
  }, [server.tools, selectedToolName]);

  const categoryCounts = useMemo(() => {
    const counts: Record<McpToolCategory, number> = {
      All: server.tools.length,
      Generate: 0,
      'Post-Edit': 0,
      'Models & Voices': 0,
      'Canvas & Nodes': 0,
      'Resources & Ops': 0,
      'Workflows & 3D': 0,
      Account: 0,
    };
    for (const tool of server.tools) {
      counts[classifyMcpToolCategory(tool.name)] += 1;
    }
    return counts;
  }, [server.tools]);

  const filteredTools = useMemo(() => {
    const q = toolSearch.trim().toLowerCase();
    return server.tools.filter((tool) => {
      if (toolCategory !== 'All' && classifyMcpToolCategory(tool.name) !== toolCategory) {
        return false;
      }
      if (!q) return true;
      return (
        tool.name.toLowerCase().includes(q) ||
        (tool.description || '').toLowerCase().includes(q)
      );
    });
  }, [server.tools, toolSearch, toolCategory]);

  const activeTool =
    filteredTools.find((t) => t.name === selectedToolName) ||
    filteredTools[0] ||
    server.tools.find((t) => t.name === selectedToolName) ||
    server.tools[0] ||
    null;

  const schemaProperties = useMemo(() => {
    const props = (activeTool?.inputSchema as { properties?: Record<string, Record<string, unknown>> } | undefined)
      ?.properties;
    if (!props || typeof props !== 'object') return [];
    const requiredList = Array.isArray(
      (activeTool?.inputSchema as { required?: unknown[] } | undefined)?.required
    )
      ? ((activeTool?.inputSchema as { required?: unknown[] }).required as string[])
      : [];
    return Object.entries(props).map(([key, def]) => ({
      key,
      type: typeof def?.type === 'string' ? def.type : 'string',
      description: typeof def?.description === 'string' ? def.description : '',
      enumVals: Array.isArray(def?.enum) ? (def.enum as string[]) : null,
      required: requiredList.includes(key),
    }));
  }, [activeTool]);

  const runToolWithArgs = async (toolName: string, args: Record<string, unknown>) => {
    setRunningTool(toolName);
    try {
      const res = await callExternalMcpToolViaBackend(server.id, toolName, args);
      setCallResult(res);
      if (res.ok) {
        showToast(`${toolName} returned live result`, 'ok');
      } else {
        showToast(res.error || `${toolName} failed`, 'error');
      }
    } finally {
      setRunningTool(null);
    }
  };

  const handleRunActiveTool = async () => {
    if (!activeTool) return;
    let payload: Record<string, unknown> = {};
    if (useRawJson || schemaProperties.length === 0) {
      try {
        payload = rawJsonArgs.trim() ? JSON.parse(rawJsonArgs) : {};
      } catch {
        showToast('Invalid JSON arguments', 'error');
        return;
      }
    } else {
      for (const prop of schemaProperties) {
        const rawVal = argValues[prop.key];
        if (rawVal === undefined || rawVal === '') continue;
        if (prop.type === 'number' || prop.type === 'integer') {
          const num = Number(rawVal);
          payload[prop.key] = Number.isNaN(num) ? rawVal : num;
        } else if (prop.type === 'boolean') {
          payload[prop.key] = rawVal === 'true';
        } else if (prop.type === 'array' || prop.type === 'object') {
          try {
            payload[prop.key] = JSON.parse(rawVal);
          } catch {
            payload[prop.key] = rawVal;
          }
        } else {
          payload[prop.key] = rawVal;
        }
      }
    }
    await runToolWithArgs(activeTool.name, payload);
  };

  const handleQuickInfoCheck = async () => {
    const balanceTool = server.tools.find((t) => t.name === 'balance');
    const gpuStatusTool = server.tools.find((t) => t.name === 'gpu_status');
    const accountOverviewTool = server.tools.find((t) => t.name === 'get_account_overview');
    const fallbackTool =
      server.tools.find((t) =>
        /status|gpu|account|info|credit|user|quota|models|list/i.test(t.name)
      ) || server.tools[0];
    const infoCandidate = balanceTool || gpuStatusTool || accountOverviewTool || fallbackTool;
    if (!infoCandidate) {
      showToast('Connected MCP has 0 callable tools registered yet.', 'error');
      return;
    }
    const args =
      infoCandidate.name === 'get_account_overview' ? { info: 'free_trial' } : {};
    setSelectedToolName(infoCandidate.name);
    await runToolWithArgs(infoCandidate.name, args);
  };

  return (
    <div className="space-y-4">
      {/* Connected Banner */}
      <div className="rounded-xl border border-[#10b981]/35 bg-[#10b981]/[0.09] px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-full bg-[#10b981]/20 border border-[#10b981]/40 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-4 h-4 text-[#10b981]" />
          </div>
          <div className="min-w-0">
            {(() => {
              const resolvedBal =
                server.balance ||
                (server.platformId ? mcpBalances[String(server.platformId)] : undefined);
              const resolvedAccount =
                resolvedBal?.account ||
                server.account?.email ||
                server.account?.name ||
                server.account?.username;
              return (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold text-white">
                      ✓ {server.name} Connected
                    </span>
                    {resolvedBal?.credits !== undefined && (
                      <span className="rounded-full border border-[#10b981]/40 bg-[#10b981]/15 px-2.5 py-0.5 text-[10.5px] font-semibold text-white">
                        {resolvedBal.credits.toLocaleString(undefined, {
                          minimumFractionDigits: resolvedBal.credits >= 1000 ? 0 : 2,
                          maximumFractionDigits: 2,
                        })}{' '}
                        Credits
                        {resolvedBal.plan ? ` · ${resolvedBal.plan.toUpperCase()}` : ''}
                      </span>
                    )}
                    <span className="rounded-full bg-[#10b981]/20 px-2 py-0.5 text-[10px] font-medium text-[#6ee7b7]">
                      {server.tools.length} functions discovered
                    </span>
                  </div>
                  <div className="text-[11px] text-[#9ee6cc]/85 truncate mt-0.5">
                    {resolvedAccount ? `${resolvedAccount} · ` : ''}
                    <span className="font-mono text-[10.5px] opacity-80">
                      {server.url || `${server.command || 'stdio'} ${(server.args || []).join(' ')}`}
                    </span>
                  </div>
                </>
              );
            })()}
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={onRefresh}
            className="inline-flex items-center gap-1 rounded-lg border border-white/[0.12] bg-white/[0.06] hover:bg-white/[0.12] px-2.5 py-1.5 text-[11px] text-white"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Refresh Tools</span>
          </button>
          <button
            type="button"
            onClick={onDisconnect}
            className="inline-flex items-center gap-1 rounded-lg border border-[#ef4444]/30 bg-[#ef4444]/10 hover:bg-[#ef4444]/20 px-2.5 py-1.5 text-[11px] text-[#fca5a5]"
          >
            <Trash2 className="w-3 h-3" />
            <span>Disconnect</span>
          </button>
        </div>
      </div>

      {/* Interactive MCP Functions & Info Explorer */}
      <div className="rounded-xl border border-white/[0.08] bg-[#151515] p-4 space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h4 className="text-xs font-semibold text-white flex items-center gap-1.5">
              <Wrench className="w-3.5 h-3.5 text-[#20D5EC]" />
              <span>MCP Functions &amp; Info Explorer</span>
            </h4>
            <p className="text-[11px] text-[#8d8d8d] mt-0.5">
              Inspect live tools, query account/GPU status, run functions directly, or drop any function onto your canvas.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => void handleQuickInfoCheck()}
              disabled={runningTool !== null || server.tools.length === 0}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#20D5EC]/35 bg-[#20D5EC]/10 hover:bg-[#20D5EC]/20 disabled:opacity-50 px-2.5 py-1.5 text-[11px] font-medium text-[#7ceeff]"
            >
              {runningTool ? <Loader2 className="w-3 h-3 animate-spin" /> : <Cpu className="w-3 h-3" />}
              <span>Check Credits &amp; Plan Balance</span>
            </button>
            <button
              type="button"
              onClick={() => setShowAllSchemas((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.1] bg-white/[0.04] hover:bg-white/[0.09] px-2.5 py-1.5 text-[11px] text-[#d4d4d4]"
            >
              <Layers className="w-3 h-3" />
              <span>{showAllSchemas ? 'Hide Schemas' : 'List Available Tools & Schemas'}</span>
            </button>
          </div>
        </div>

        {server.tools.length === 0 ? (
          <div className="rounded-lg border border-white/[0.06] bg-black/25 px-3 py-3 text-[11px] text-[#8d8d8d]">
            No MCP tools reported yet. Click Refresh Tools above.
          </div>
        ) : (
          <div className="space-y-2.5">
            {/* Search & Category Filter Pills */}
            {server.tools.length > 4 && (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-[#737373] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={toolSearch}
                    onChange={(e) => setToolSearch(e.target.value)}
                    placeholder={`Filter ${server.tools.length} functions: generate, upscale, cutout, voice, canvas, workflow, director…`}
                    className="w-full rounded-lg border border-white/[0.1] bg-[#101010] pl-8 pr-7 py-1.5 text-[11.5px] text-white placeholder-[#666666] focus:border-[#20D5EC]/60 focus:outline-none"
                  />
                  {toolSearch && (
                    <button
                      type="button"
                      onClick={() => setToolSearch('')}
                      aria-label="Clear function filter"
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-[#737373] hover:text-white"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-1">
                  {MCP_TOOL_CATEGORIES.filter(
                    (cat) => cat === 'All' || categoryCounts[cat] > 0
                  ).map((cat) => {
                    const activeCat = toolCategory === cat;
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setToolCategory(cat)}
                        className={`rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors ${
                          activeCat
                            ? 'border-white bg-white text-[#0e0e0e]'
                            : 'border-white/[0.09] bg-white/[0.04] text-[#bdbdbd] hover:bg-white/[0.09] hover:text-white'
                        }`}
                      >
                        {cat} ({categoryCounts[cat]})
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-[250px_1fr] gap-3">
              {/* Function Cards List */}
              <div className="max-h-[340px] overflow-y-auto space-y-1.5 pr-1">
                {filteredTools.length === 0 ? (
                  <div className="rounded-lg border border-white/[0.06] bg-[#111111] p-3 text-[11px] text-[#8c8c8c] space-y-2">
                    <p>No functions match &ldquo;{toolSearch || toolCategory}&rdquo;.</p>
                    <button
                      type="button"
                      onClick={() => {
                        setToolSearch('');
                        setToolCategory('All');
                      }}
                      className="rounded border border-white/[0.12] bg-white/[0.05] hover:bg-white/[0.1] px-2 py-1 text-[10.5px] text-white"
                    >
                      Reset filter
                    </button>
                  </div>
                ) : (
                  filteredTools.map((tool) => {
                    const active = activeTool?.name === tool.name;
                    const paramCount = Object.keys(
                      ((tool.inputSchema as { properties?: Record<string, unknown> } | undefined)
                        ?.properties) || {}
                    ).length;
                    return (
                      <button
                        key={tool.name}
                        type="button"
                        onClick={() => {
                          setSelectedToolName(tool.name);
                          setArgValues({});
                          setRawJsonArgs('{}');
                          setCallResult(null);
                        }}
                        className={`w-full text-left rounded-lg border p-2.5 transition-colors ${
                          active
                            ? 'border-[#20D5EC]/55 bg-[#192326] text-white'
                            : 'border-white/[0.06] bg-[#111111] hover:bg-white/[0.04] text-[#cfcfcf]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1.5">
                          <span className="text-[11.5px] font-mono font-semibold truncate">
                            {tool.name}
                          </span>
                          <span className="text-[9.5px] text-[#808080] shrink-0">
                            {paramCount} params
                          </span>
                        </div>
                        {tool.description && (
                          <div className="text-[10.5px] text-[#8c8c8c] line-clamp-2 mt-0.5">
                            {tool.description}
                          </div>
                        )}
                      </button>
                    );
                  })
                )}
              </div>

              {/* Inline Run Function Tester */}
            {activeTool && (
              <div className="rounded-xl border border-white/[0.08] bg-[#101010] p-3.5 space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-xs font-mono font-semibold text-white">
                      {activeTool.name}
                    </div>
                    {activeTool.description && (
                      <p className="text-[11px] text-[#959595] mt-0.5">
                        {activeTool.description}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => setUseRawJson((v) => !v)}
                      className="rounded-md border border-white/[0.1] bg-white/[0.04] hover:bg-white/[0.09] px-2 py-1 text-[10px] text-[#bcbcbc]"
                    >
                      {useRawJson ? 'Form Inputs' : 'Raw JSON'}
                    </button>
                    <button
                      type="button"
                      onClick={() => onSpawnToolNode(activeTool)}
                      className="inline-flex items-center gap-1 rounded-md border border-[#20D5EC]/35 bg-[#20D5EC]/10 hover:bg-[#20D5EC]/20 px-2.5 py-1 text-[10.5px] font-medium text-[#7ceeff]"
                    >
                      <Plus className="w-3 h-3" />
                      <span>+ Spawn as Canvas Node</span>
                    </button>
                  </div>
                </div>

                {showAllSchemas && activeTool.inputSchema && (
                  <pre className="max-h-28 overflow-auto rounded-lg bg-black/50 border border-white/[0.06] p-2 text-[10px] font-mono text-[#9ca3af]">
                    {JSON.stringify(activeTool.inputSchema, null, 2)}
                  </pre>
                )}

                {!useRawJson && schemaProperties.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {schemaProperties.map((prop) => (
                      <div key={prop.key} className="space-y-1">
                        <label className="block text-[10.5px] font-mono text-[#b5b5b5]">
                          {prop.key}
                          {prop.required ? (
                            <span className="text-[#ef4444] ml-0.5">*</span>
                          ) : null}{' '}
                          <span className="text-[#6f6f6f]">({prop.type})</span>
                        </label>
                        {prop.enumVals ? (
                          <select
                            value={argValues[prop.key] ?? ''}
                            onChange={(e) =>
                              setArgValues((prev) => ({ ...prev, [prop.key]: e.target.value }))
                            }
                            className="w-full rounded-lg border border-white/[0.1] bg-[#171717] px-2.5 py-1.5 text-[11px] text-white focus:border-[#20D5EC] focus:outline-none"
                          >
                            <option value="">Default</option>
                            {prop.enumVals.map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type="text"
                            value={argValues[prop.key] ?? ''}
                            onChange={(e) =>
                              setArgValues((prev) => ({ ...prev, [prop.key]: e.target.value }))
                            }
                            placeholder={prop.description || prop.type}
                            className="w-full rounded-lg border border-white/[0.1] bg-[#171717] px-2.5 py-1.5 text-[11px] text-white placeholder-[#595959] focus:border-[#20D5EC] focus:outline-none"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div>
                    <label className="block text-[10.5px] text-[#9b9b9b] mb-1">
                      JSON Arguments ({schemaProperties.length === 0 ? 'Optional' : 'Raw JSON'})
                    </label>
                    <textarea
                      rows={2}
                      value={rawJsonArgs}
                      onChange={(e) => setRawJsonArgs(e.target.value)}
                      className="w-full rounded-lg border border-white/[0.1] bg-[#171717] px-2.5 py-1.5 text-[11px] font-mono text-white focus:border-[#20D5EC] focus:outline-none"
                    />
                  </div>
                )}

                <div className="flex items-center justify-end">
                  <button
                    type="button"
                    onClick={() => void handleRunActiveTool()}
                    disabled={runningTool !== null}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-white hover:bg-[#e8e8e8] disabled:opacity-60 px-3.5 py-1.5 text-[11.5px] font-semibold text-[#0e0e0e] cursor-pointer"
                  >
                    {runningTool === activeTool.name ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Play className="w-3.5 h-3.5" />
                    )}
                    <span>
                      {runningTool === activeTool.name ? 'Running Function...' : 'Run Function'}
                    </span>
                  </button>
                </div>

                {/* Live Result Output */}
                {callResult && (
                  <div
                    className={`rounded-lg border p-2.5 text-[11px] space-y-2 ${
                      callResult.ok
                        ? 'border-[#10b981]/30 bg-[#10b981]/[0.06] text-[#d1fae5]'
                        : 'border-[#ef4444]/35 bg-[#ef4444]/[0.08] text-[#fecaca]'
                    }`}
                  >
                    {callResult.error && <div>{callResult.error}</div>}
                    {callResult.textContent && (
                      <div className="whitespace-pre-wrap break-words font-mono text-[10.5px]">
                        {callResult.textContent}
                      </div>
                    )}
                    {callResult.structuredData !== undefined && (
                      <pre className="max-h-32 overflow-auto rounded bg-black/40 p-2 font-mono text-[10px]">
                        {JSON.stringify(callResult.structuredData, null, 2)}
                      </pre>
                    )}
                    {(callResult.imageUrl || callResult.fullUrl) && !callResult.videoUrl && (
                      <img
                        src={callResult.imageUrl || callResult.fullUrl}
                        alt="MCP tool output"
                        className="max-h-40 rounded-lg border border-white/10 object-contain"
                      />
                    )}
                    {callResult.videoUrl && (
                      <video
                        src={callResult.videoUrl}
                        controls
                        className="max-h-40 rounded-lg border border-white/10"
                      />
                    )}
                  </div>
                )}
              </div>
            )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export const ProviderModal: React.FC = () => {
  const providerModalOpen = useStudioStore((s) => s.providerModalOpen);
  const providerFocusField = useStudioStore((s) => s.providerFocusField);
  const closeProviderModal = useStudioStore((s) => s.closeProviderModal);

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
  const checkingBrowserPlatform = useStudioStore((s) => s.checkingBrowserPlatform);
  const mcpOAuthSession = useStudioStore((s) => s.mcpOAuthSession);
  const refreshConnectionsStatus = useStudioStore((s) => s.refreshConnectionsStatus);
  const launchConnectedCreatorBrowser = useStudioStore((s) => s.launchConnectedCreatorBrowser);
  const checkBrowserConnections = useStudioStore((s) => s.checkBrowserConnections);
  const startMcpOAuth = useStudioStore((s) => s.startMcpOAuth);
  const pollMcpOAuthStatus = useStudioStore((s) => s.pollMcpOAuthStatus);
  const startDreaminaMcpConnect = useStudioStore((s) => s.startDreaminaMcpConnect);
  const disconnectDreaminaMcp = useStudioStore((s) => s.disconnectDreaminaMcp);
  const setMcpOAuthSession = useStudioStore((s) => s.setMcpOAuthSession);
  const mcpBalances = useStudioStore((s) => s.mcpBalances);

  const mcpServers = useStudioStore((s) => s.mcpServers);
  const mcpHealth = useStudioStore((s) => s.mcpHealth);
  const refreshMcpServer = useStudioStore((s) => s.refreshMcpServer);
  const spawnMcpToolAsCanvasNode = useStudioStore((s) => s.spawnMcpToolAsCanvasNode);

  const externalMcpServers = useStudioStore((s) => s.externalMcpServers);
  const platformsCatalog = useStudioStore((s) => s.platformsCatalog);
  const addExternalMcpServer = useStudioStore((s) => s.addExternalMcpServer);
  const refreshExternalMcpById = useStudioStore((s) => s.refreshExternalMcpById);
  const removeExternalMcpById = useStudioStore((s) => s.removeExternalMcpById);

  const chromeBridge = useStudioStore((s) => s.chromeBridge);
  const bridgeWsConnected = useStudioStore((s) => s.bridgeWsConnected);
  const pingBridge = useStudioStore((s) => s.pingBridge);
  const liveBridgeTestRunning = useStudioStore((s) => s.liveBridgeTestRunning);
  const liveBridgeStatusText = useStudioStore((s) => s.liveBridgeStatusText);
  const runLiveBridgeTestGeneration = useStudioStore((s) => s.runLiveBridgeTestGeneration);

  const showToast = useStudioStore((s) => s.showToast);

  const [selectedPlatformId, setSelectedPlatformId] = useState<PlatformId>('higgsfield');

  // Higgsfield secondary compact accordions
  const [hfAccordion, setHfAccordion] = useState<'none' | 'cli' | 'api' | 'browser'>('none');
  const [hfCliAdding, setHfCliAdding] = useState(false);

  // Dreamina MCP accordions & cookie state
  const [dreaminaAccordion, setDreaminaAccordion] = useState<
    'none' | 'browser' | 'session' | 'ark' | 'ext_mcp'
  >('none');
  const [dreaminaSessionCookie, setDreaminaSessionCookie] = useState('');
  const [dreaminaBusy, setDreaminaBusy] = useState(false);

  // Generic MCP inline form state for other platforms & Custom MCP
  const [inlineMcpUrl, setInlineMcpUrl] = useState('http://localhost:3002/mcp');
  const [inlineMcpName, setInlineMcpName] = useState('Custom Streamable HTTP MCP');
  const [inlineMcpTransport, setInlineMcpTransport] = useState<'http' | 'stdio'>('http');
  const [inlineMcpCommand, setInlineMcpCommand] = useState('npx');
  const [inlineMcpArgs, setInlineMcpArgs] = useState('-y @elevenlabs/elevenlabs-mcp');
  const [inlineMcpApiKey, setInlineMcpApiKey] = useState('');
  const [inlineMcpAdvanced, setInlineMcpAdvanced] = useState(false);
  const [mcpConnecting, setMcpConnecting] = useState(false);

  // Browser verification animation badge per click
  const [browserVerifyState, setBrowserVerifyState] = useState<{
    platformId: string;
    phase: 'checking' | 'connected' | 'not_found';
  } | null>(null);

  const [manualAccordionOpen, setManualAccordionOpen] = useState(false);
  const [copiedSnippet, setCopiedSnippet] = useState<string | null>(null);
  const popupRef = useRef<Window | null>(null);

  // Ordered rail matching #104 (deduplicated by platform id)
  const railPlatforms = useMemo(() => {
    const seen = new Set<string>();
    const all = [...PLATFORM_CATALOG, CUSTOM_MCP_PLATFORM].filter((plat) => {
      if (seen.has(plat.id)) return false;
      seen.add(plat.id);
      return true;
    });
    return [...all].sort((a, b) => {
      const ia = RAIL_ORDER.indexOf(a.id);
      const ib = RAIL_ORDER.indexOf(b.id);
      return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    });
  }, []);

  useEffect(() => {
    if (!providerModalOpen) return;
    if (providerFocusField) {
      setSelectedPlatformId(focusFieldToPlatformId(providerFocusField));
    }
  }, [providerModalOpen, providerFocusField]);

  // Poll /api/connections/status every 3s while modal is open
  useEffect(() => {
    if (!providerModalOpen) return;
    void refreshConnectionsStatus();
    const timer = window.setInterval(() => {
      void refreshConnectionsStatus();
    }, 3000);
    return () => window.clearInterval(timer);
  }, [providerModalOpen, refreshConnectionsStatus]);

  // Poll GET /api/mcp/oauth/status/:sessionId every 1s during active OAuth handshake
  useEffect(() => {
    if (!providerModalOpen || !mcpOAuthSession) return;
    const step = mcpOAuthSession.step;
    if (
      step !== 'awaiting_login' &&
      step !== 'exchanging_token' &&
      step !== 'discovering_tools'
    ) {
      return;
    }
    const timer = window.setInterval(() => {
      void pollMcpOAuthStatus(mcpOAuthSession.sessionId);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [providerModalOpen, mcpOAuthSession, pollMcpOAuthStatus]);

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
    for (const plat of railPlatforms) {
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
  }, [railPlatforms, byok, chromeBridge, externalMcpServers, platformsCatalog, liveStatusObj]);

  const connectedTotalCount = useMemo(
    () => PLATFORM_CATALOG.filter((p) => platformStatuses[p.id]?.connected).length,
    [platformStatuses]
  );

  if (!providerModalOpen) return null;

  const selectedPlatform =
    railPlatforms.find((p) => p.id === selectedPlatformId) ?? railPlatforms[0];
  const selectedStatus = platformStatuses[selectedPlatform.id];
  const selectedMeta = PLATFORM_UI_META[selectedPlatform.id];
  const selectedVerifySlug = platformIdToVerifySlug(selectedPlatform.id);
  const selectedVerifyResult = providerVerifyStatus[selectedVerifySlug];
  const isVerifyingSelected = Boolean(verifyingProvider[selectedVerifySlug]);
  const keyFields = getPlatformKeyFields(selectedPlatform.id);

  // Connected MCP server for the currently selected company (if any)
  const matchingMcpServers = externalMcpServers.filter(
    (s) =>
      s.platformId === selectedPlatform.id ||
      (selectedPlatform.id === 'custom-mcp' && s.platformId === 'custom-mcp')
  );
  const connectedMcpServer =
    matchingMcpServers.find((s) => s.status === 'connected') || matchingMcpServers[0] || null;

  const matchingPreset = EXTERNAL_MCP_TEMPLATES.find(
    (t) => t.platformId === selectedPlatform.id
  );

  const consoleSnippet = `import('http://localhost:3001/bridge-connector.js')`;
  const extensionFolderPath = 'open-dreamflow/extensions/chrome-bridge';
  const localStudioEngine = mcpServers[0];

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

  const handleConnectHiggsfieldOAuthMcp = async () => {
    // Open blank popup synchronously inside click gesture to avoid popup blockers
    const win = window.open(
      'about:blank',
      'hf_mcp_oauth',
      'width=540,height=720,menubar=no,toolbar=no,status=no'
    );
    popupRef.current = win;
    const sess = await startMcpOAuth('higgsfield', 'https://mcp.higgsfield.ai/mcp');
    if (sess?.authorizeUrl) {
      if (win && !win.closed) {
        win.location.href = sess.authorizeUrl;
        win.focus();
      } else {
        window.open(sess.authorizeUrl, 'hf_mcp_oauth', 'width=540,height=720');
      }
    } else if (win && !win.closed) {
      win.close();
    }
  };

  const handleConnectHiggsfieldCliMcp = async () => {
    const combined =
      byok.higgsfieldKeyId?.trim() && byok.higgsfieldKeySecret?.trim()
        ? `${byok.higgsfieldKeyId.trim()}:${byok.higgsfieldKeySecret.trim()}`
        : byok.higgsfieldApiKey?.trim() || '';
    setHfCliAdding(true);
    try {
      await addExternalMcpServer({
        name: 'Higgsfield CLI MCP (@higgsfield/cli)',
        platformId: 'higgsfield',
        transport: 'stdio',
        command: 'npx',
        args: ['-y', '@higgsfield/cli', 'mcp'],
        env: combined ? { HF_API_KEY: combined } : undefined,
      });
      await refreshConnectionsStatus();
    } finally {
      setHfCliAdding(false);
    }
  };

  const handleConnectDreaminaMcp = async () => {
    // Open blank popup synchronously inside click gesture to avoid popup blockers;
    // close cleanly if cli_oauth reconnects immediately from OS Keyring.
    const win = window.open(
      'about:blank',
      'dreamina_mcp_oauth',
      'width=560,height=740,menubar=no,toolbar=no,status=no'
    );
    popupRef.current = win;
    setDreaminaBusy(true);
    try {
      const sess = await startDreaminaMcpConnect({ mode: 'cli_oauth' });
      if (sess?.step === 'awaiting_login' && sess.authorizeUrl) {
        if (win && !win.closed) {
          win.location.href = sess.authorizeUrl;
          win.focus();
        } else {
          window.open(sess.authorizeUrl, 'dreamina_mcp_oauth', 'width=560,height=740');
        }
        await refreshConnectionsStatus();
      } else {
        if (win && !win.closed) {
          win.close();
        }
        await refreshConnectionsStatus();
      }
    } finally {
      setDreaminaBusy(false);
    }
  };

  const handleConnectDreaminaBrowserFallback = async () => {
    setDreaminaBusy(true);
    try {
      const sess = await startDreaminaMcpConnect({ mode: 'browser', launchBrowser: true });
      if (sess?.step === 'awaiting_login') {
        await refreshConnectionsStatus();
      }
    } finally {
      setDreaminaBusy(false);
    }
  };

  const handleConnectDreaminaSessionCookie = async () => {
    if (!dreaminaSessionCookie.trim()) {
      showToast('Paste your Dreamina sessionid cookie value first', 'error');
      return;
    }
    setDreaminaBusy(true);
    try {
      await startDreaminaMcpConnect({
        mode: 'session',
        sessionIdCookie: dreaminaSessionCookie.trim(),
      });
      await refreshConnectionsStatus();
    } finally {
      setDreaminaBusy(false);
    }
  };

  const handleConnectDreaminaArkKey = async () => {
    const key = byok.seedanceApiKey?.trim() || '';
    if (!key) {
      showToast('Enter your BytePlus ModelArk ARK_API_KEY first', 'error');
      return;
    }
    setDreaminaBusy(true);
    try {
      await startDreaminaMcpConnect({
        mode: 'ark_api_key',
        arkApiKey: key,
        arkEndpoint: byok.seedanceEndpoint?.trim() || undefined,
      });
      await refreshConnectionsStatus();
    } finally {
      setDreaminaBusy(false);
    }
  };

  const handleConnectDreaminaExternalMcp = async (pkg: '@acedatacloud/mcp-seedream' | 'jimeng-mcp-server') => {
    setDreaminaBusy(true);
    try {
      await addExternalMcpServer({
        name: pkg === '@acedatacloud/mcp-seedream' ? 'Seedream MCP (AceDataCloud)' : 'Jimeng / Dreamina MCP Server',
        platformId: 'dreamina',
        transport: 'stdio',
        command: 'npx',
        args: ['-y', pkg],
        env: byok.seedanceApiKey?.trim() ? { ARK_API_KEY: byok.seedanceApiKey.trim() } : undefined,
      });
      await refreshConnectionsStatus();
    } finally {
      setDreaminaBusy(false);
    }
  };

  const handleConnectPresetForPlatform = async () => {
    if (!matchingPreset) return;
    const keyVal =
      inlineMcpApiKey.trim() ||
      (selectedPlatform.id === 'elevenlabs' ? byok.elevenlabsApiKey?.trim() : '') ||
      (selectedPlatform.id === 'fal' ? byok.falApiKey?.trim() : '') ||
      '';
    if (matchingPreset.envKeyName && !keyVal) {
      showToast(`Paste your ${matchingPreset.envKeyName} first`, 'error');
      return;
    }
    setMcpConnecting(true);
    try {
      await addExternalMcpServer({
        name: matchingPreset.name,
        platformId: matchingPreset.platformId,
        transport: matchingPreset.transport,
        command: matchingPreset.command,
        args: matchingPreset.args,
        env:
          matchingPreset.envKeyName && keyVal
            ? { [matchingPreset.envKeyName]: keyVal }
            : undefined,
      });
      await refreshConnectionsStatus();
    } finally {
      setMcpConnecting(false);
    }
  };

  const handleConnectCustomMcp = async () => {
    setMcpConnecting(true);
    try {
      const targetPlatformId =
        selectedPlatform.id === 'custom-mcp' ? 'custom-mcp' : selectedPlatform.id;
      await addExternalMcpServer({
        name:
          inlineMcpName.trim() ||
          `${selectedPlatform.name} MCP`,
        platformId: targetPlatformId,
        transport: inlineMcpTransport,
        url: inlineMcpTransport === 'http' ? inlineMcpUrl.trim() : undefined,
        headers:
          inlineMcpTransport === 'http' && inlineMcpApiKey.trim()
            ? { Authorization: `Bearer ${inlineMcpApiKey.trim()}` }
            : undefined,
        command: inlineMcpTransport === 'stdio' ? inlineMcpCommand.trim() : undefined,
        args:
          inlineMcpTransport === 'stdio'
            ? inlineMcpArgs
                .split(/\s+/)
                .map((x) => x.trim())
                .filter(Boolean)
            : undefined,
      });
      await refreshConnectionsStatus();
    } finally {
      setMcpConnecting(false);
    }
  };

  const handleVerifyBrowserSignIn = async (pid: string) => {
    setBrowserVerifyState({ platformId: pid, phase: 'checking' });
    const res = await checkBrowserConnections(pid);
    setBrowserVerifyState({
      platformId: pid,
      phase: res.connected ? 'connected' : 'not_found',
    });
  };

  const handleSpawnToolNode = (tool: ExternalMcpToolItem, srv: ExternalMcpServerRecord) => {
    spawnMcpToolAsCanvasNode({
      name: tool.name,
      description: tool.description || srv.name,
      serverUrl: srv.url || srv.id,
      serverName: srv.name,
      inputSchema: tool.inputSchema || {},
    });
    closeProviderModal();
  };

  const showProgressForSelected =
    mcpOAuthSession && mcpOAuthSession.platformId === selectedPlatform.id;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-3 sm:p-6"
      onClick={closeProviderModal}
    >
      <div
        className="relative flex flex-col w-full max-w-[1080px] max-h-[91vh] rounded-2xl border border-white/[0.09] bg-[#111111] text-[#e5e5e5] shadow-[0_24px_80px_rgba(0,0,0,0.75)] overflow-hidden"
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
                  Connections · MCP &amp; Creator Credits
                </h2>
                <span className="inline-flex items-center gap-1 rounded-full border border-[#10b981]/30 bg-[#10b981]/10 px-2 py-0.5 text-[10px] font-medium text-[#6ee7b7]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#10b981]" />
                  {connectedTotalCount} / {PLATFORM_CATALOG.length} Connected
                </span>
              </div>
              <p className="text-[11px] text-[#9a9a9a] truncate">
                MCP-first creator studio — connect companies via Official MCP, OAuth, API Key ($0 markup), or verified browser sign-in.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => void launchConnectedCreatorBrowser('all')}
              disabled={launchingBrowserTarget !== null}
              className="hidden md:inline-flex items-center gap-1.5 rounded-lg border border-white/[0.1] bg-white/[0.05] hover:bg-white/[0.1] disabled:opacity-50 px-2.5 py-1.5 text-[11px] text-white transition-colors cursor-pointer"
              title="Launch pre-bridged Creator Chrome profile with all tabs"
            >
              {launchingBrowserTarget === 'all' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Globe className="w-3.5 h-3.5 text-[#20D5EC]" />
              )}
              <span>Launch Connected Creator Browser</span>
            </button>
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

        {/* Main Split Body */}
        <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-[276px_1fr] overflow-hidden">
          {/* Left Rail — Company Directory with Distinct Brand Icons */}
          <div className="border-b md:border-b-0 md:border-r border-white/[0.07] bg-[#131313] overflow-y-auto p-2.5 space-y-1">
            <div className="px-2 pt-1 pb-1.5 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-[#787878]">
              <span>Step 1 · Featured MCP</span>
              <ShieldCheck className="w-3 h-3 text-[#10b981]" />
            </div>

            {railPlatforms.map((plat, idx) => {
              const st = platformStatuses[plat.id];
              const isActive = selectedPlatform.id === plat.id;
              const isHiggsfield = plat.id === 'higgsfield';
              const isDreamina = plat.id === 'dreamina';
              const isCustom = plat.id === 'custom-mcp';
              const platBal =
                mcpBalances[plat.id] ||
                externalMcpServers.find((srv) => srv.platformId === plat.id && srv.balance)?.balance;

              return (
                <React.Fragment key={plat.id}>
                  {idx === 2 && (
                    <div className="px-2 pt-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-[#6e6e6e]">
                      All Creator Platforms
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedPlatformId(plat.id);
                      setBrowserVerifyState(null);
                    }}
                    className={`w-full text-left rounded-xl px-2.5 py-2 border transition-all flex items-center justify-between gap-2 ${
                      isActive
                        ? 'bg-[#1e1e1e] border-white/[0.18] text-white shadow-sm'
                        : isHiggsfield
                        ? 'bg-[#DFFF00]/[0.04] border-[#DFFF00]/20 hover:bg-[#DFFF00]/[0.08] text-[#e8e8e8]'
                        : isDreamina
                        ? 'bg-[#20D5EC]/[0.04] border-[#20D5EC]/20 hover:bg-[#20D5EC]/[0.08] text-[#e8e8e8]'
                        : 'bg-transparent border-transparent hover:bg-white/[0.04] text-[#c2c2c2]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <PlatformBrandIcon platformId={plat.id} size="md" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-medium truncate">{plat.name}</span>
                          {isHiggsfield && !st?.connected && (
                            <span className="rounded bg-[#DFFF00]/15 border border-[#DFFF00]/35 px-1.5 py-0.5 text-[9px] font-semibold text-[#DFFF00] shrink-0">
                              Official MCP
                            </span>
                          )}
                          {isDreamina && !st?.connected && (
                            <span className="rounded bg-[#20D5EC]/15 border border-[#20D5EC]/35 px-1.5 py-0.5 text-[9px] font-semibold text-[#7ceeff] shrink-0">
                              Official CLI MCP
                            </span>
                          )}
                          {plat.id === 'elevenlabs' && (
                            <span className="rounded bg-white/[0.07] px-1.5 py-0.5 text-[9px] text-[#bdbdbd] shrink-0">
                              MCP
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-[#7c7c7c] truncate mt-0.5">
                          {isCustom
                            ? 'Any HTTP / Stdio MCP'
                            : platBal?.credits !== undefined
                            ? `${formatCompactRailCredits(platBal.credits)} credits${platBal.plan ? ` · ${platBal.plan.toUpperCase()}` : ''}`
                            : plat.modalities.join(' · ')}
                        </div>
                      </div>
                    </div>

                    <span
                      className={`shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium border ${
                        st?.connected
                          ? 'border-[#10b981]/35 bg-[#10b981]/10 text-[#6ee7b7]'
                          : 'border-white/[0.08] bg-white/[0.03] text-[#858585]'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          st?.connected ? 'bg-[#10b981]' : 'bg-[#5c5c5c]'
                        }`}
                      />
                      <span>
                        {st?.connected
                          ? platBal?.credits !== undefined
                            ? `${st.hasMcp ? 'MCP' : st.hasBrowser ? 'Br' : 'Key'} · ${formatCompactRailCredits(platBal.credits)}`
                            : st.hasMcp
                            ? 'MCP'
                            : st.hasBrowser
                            ? 'Browser'
                            : 'Key'
                          : 'Off'}
                      </span>
                    </span>
                  </button>
                </React.Fragment>
              );
            })}
          </div>

          {/* Right Detail Pane */}
          <div className="overflow-y-auto p-5 space-y-4 bg-[#111111]">
            {/* Company Identity Header */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3.5 border-b border-white/[0.07]">
              <div className="flex items-center gap-3 min-w-0">
                <PlatformBrandIcon platformId={selectedPlatform.id} size="lg" />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
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
                  <p className="text-xs text-[#9b9b9b] mt-0.5">
                    {selectedMeta?.tagline || selectedPlatform.webUrl}
                  </p>
                </div>
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

            {/* Active OAuth / Animated Progress Panel */}
            {showProgressForSelected && mcpOAuthSession && (
              <ConnectionProgressCard
                platformId={selectedPlatform.id}
                platformName={selectedPlatform.name}
                session={mcpOAuthSession}
                onReopenPopup={() => {
                  if (mcpOAuthSession.authorizeUrl) {
                    window.open(
                      mcpOAuthSession.authorizeUrl,
                      selectedPlatform.id === 'dreamina'
                        ? 'dreamina_mcp_oauth'
                        : 'hf_mcp_oauth',
                      'width=560,height=740'
                    );
                  }
                }}
                onCheckStatusNow={() => void pollMcpOAuthStatus(mcpOAuthSession.sessionId)}
                onReset={() => setMcpOAuthSession(null)}
              />
            )}

            {/* HIGGSFIELD (#1 Featured MCP Experience) */}
            {selectedPlatform.id === 'higgsfield' ? (
              <div className="space-y-4">
                {connectedMcpServer ? (
                  /* State B: Connected via MCP -> Interactive Functions & Info Explorer */
                  <McpFunctionsExplorer
                    server={connectedMcpServer}
                    onRefresh={() => void refreshExternalMcpById(connectedMcpServer.id)}
                    onDisconnect={() => {
                      void removeExternalMcpById(connectedMcpServer.id);
                      setMcpOAuthSession(null);
                    }}
                    onSpawnToolNode={(tool) => handleSpawnToolNode(tool, connectedMcpServer)}
                  />
                ) : (
                  /* State A: Not Connected -> Clean Focused Hero Card */
                  !showProgressForSelected && (
                    <div className="rounded-2xl border border-[#DFFF00]/25 bg-gradient-to-br from-[#DFFF00]/[0.07] via-[#161616] to-[#131313] p-6">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
                        <div className="flex items-start gap-4 min-w-0">
                          <PlatformBrandIcon platformId="higgsfield" size="xl" />
                          <div className="space-y-1.5 min-w-0">
                            <div className="inline-flex items-center gap-1.5 rounded-full border border-[#DFFF00]/30 bg-[#DFFF00]/10 px-2.5 py-0.5 text-[10.5px] font-semibold text-[#DFFF00]">
                              <Sparkles className="w-3 h-3" />
                              <span>Official MCP OAuth 2.1 · mcp.higgsfield.ai</span>
                            </div>
                            <h4 className="text-base font-semibold text-white">
                              Connect your Higgsfield Account
                            </h4>
                            <p className="text-xs text-[#b3b3b3] leading-relaxed max-w-[540px]">
                              Connect your Higgsfield account via Official MCP (mcp.higgsfield.ai) — uses your existing Higgsfield credits and unlocks all image, video, Soul ID, Cinema Studio &amp; Genjutsu functions.
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => void handleConnectHiggsfieldOAuthMcp()}
                          className="shrink-0 inline-flex items-center justify-center gap-2 rounded-xl bg-[#DFFF00] hover:bg-[#ebff52] px-5 py-3 text-xs font-bold text-[#0b0b0b] shadow-[0_8px_28px_rgba(223,255,0,0.22)] transition-all cursor-pointer"
                        >
                          <PlugZap className="w-4 h-4" />
                          <span>Connect Higgsfield via MCP →</span>
                        </button>
                      </div>
                    </div>
                  )
                )}

                {/* Compact Secondary Accordions under Higgsfield */}
                <div className="space-y-2">
                  {/* 1. Higgsfield CLI MCP (@higgsfield/cli) */}
                  <div className="rounded-xl border border-white/[0.08] bg-[#151515] overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setHfAccordion(hfAccordion === 'cli' ? 'none' : 'cli')}
                      className="w-full px-4 py-2.5 flex items-center justify-between text-xs font-medium text-[#d4d4d4] hover:text-white hover:bg-white/[0.03]"
                    >
                      <span className="inline-flex items-center gap-2">
                        <Terminal className="w-3.5 h-3.5 text-[#20D5EC]" />
                        <span>Connect via Higgsfield CLI MCP (@higgsfield/cli)</span>
                      </span>
                      {hfAccordion === 'cli' ? (
                        <ChevronDown className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5" />
                      )}
                    </button>
                    {hfAccordion === 'cli' && (
                      <div className="px-4 pb-3.5 pt-1 border-t border-white/[0.06] space-y-2.5">
                        <p className="text-[11px] text-[#949494]">
                          Spawns <code className="text-[#d4d4d4]">npx -y @higgsfield/cli mcp</code> locally via Open-DreamFlow&apos;s External MCP Host. Fill in Console Key ID &amp; Secret below if required, or connect immediately.
                        </p>
                        <button
                          type="button"
                          onClick={() => void handleConnectHiggsfieldCliMcp()}
                          disabled={hfCliAdding}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-white hover:bg-[#e8e8e8] disabled:opacity-60 px-3.5 py-2 text-xs font-semibold text-[#0e0e0e]"
                        >
                          {hfCliAdding ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <PlugZap className="w-3.5 h-3.5" />
                          )}
                          <span>Spawn @higgsfield/cli MCP</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* 2. Console API Key (Key ID + Secret) */}
                  <div className="rounded-xl border border-white/[0.08] bg-[#151515] overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setHfAccordion(hfAccordion === 'api' ? 'none' : 'api')}
                      className="w-full px-4 py-2.5 flex items-center justify-between text-xs font-medium text-[#d4d4d4] hover:text-white hover:bg-white/[0.03]"
                    >
                      <span className="inline-flex items-center gap-2">
                        <KeyRound className="w-3.5 h-3.5 text-[#20D5EC]" />
                        <span>Connect via Console API Key (Key ID + Secret)</span>
                        {selectedStatus?.hasApiKey && (
                          <span className="text-[10px] text-[#6ee7b7]">● Saved</span>
                        )}
                      </span>
                      {hfAccordion === 'api' ? (
                        <ChevronDown className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5" />
                      )}
                    </button>
                    {hfAccordion === 'api' && (
                      <div className="px-4 pb-3.5 pt-2 border-t border-white/[0.06] space-y-3">
                        <a
                          href="https://console.higgsfield.ai"
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 rounded-lg border border-white/[0.1] bg-white/[0.04] hover:bg-white/[0.08] px-3 py-1.5 text-xs text-white"
                        >
                          <span>Get Console Key ID &amp; Secret at console.higgsfield.ai ↗</span>
                          <ExternalLink className="w-3.5 h-3.5 text-[#9c9c9c]" />
                        </a>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          {keyFields.map((f, idx) => (
                            <div key={f.byokField} className={idx === 2 ? 'sm:col-span-2' : ''}>
                              <label className="block text-[11px] text-[#a5a5a5] mb-1">
                                {f.label}
                              </label>
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="password"
                                  value={String(byok[f.byokField] ?? '')}
                                  onChange={(e) =>
                                    updateByok({
                                      [f.byokField]: e.target.value,
                                    } as Partial<BYOKCredentials>)
                                  }
                                  placeholder={f.placeholder}
                                  className="flex-1 min-w-0 rounded-lg border border-white/[0.1] bg-[#0e0e0e] px-3 py-1.5 text-xs text-white placeholder-[#5e5e5e] focus:border-[#20D5EC] focus:outline-none"
                                />
                                {idx === 0 && (
                                  <button
                                    type="button"
                                    onClick={() => void handlePasteIntoField(f.byokField)}
                                    className="rounded-lg border border-white/[0.1] bg-white/[0.05] hover:bg-white/[0.1] px-2.5 py-1.5 text-[11px] text-[#d4d4d4]"
                                  >
                                    <ClipboardPaste className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                        <VerificationReadout result={selectedVerifyResult} />
                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={() => void verifyProviderConnection('higgsfield')}
                            disabled={isVerifyingSelected}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-white hover:bg-[#e8e8e8] disabled:opacity-60 px-3.5 py-1.5 text-xs font-semibold text-[#0e0e0e]"
                          >
                            {isVerifyingSelected ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            )}
                            <span>Save &amp; Verify Console Key</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 3. Browser Window + Explicit Check & Sync Sign-In */}
                  <div className="rounded-xl border border-white/[0.08] bg-[#151515] overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setHfAccordion(hfAccordion === 'browser' ? 'none' : 'browser')}
                      className="w-full px-4 py-2.5 flex items-center justify-between text-xs font-medium text-[#d4d4d4] hover:text-white hover:bg-white/[0.03]"
                    >
                      <span className="inline-flex items-center gap-2">
                        <Globe className="w-3.5 h-3.5 text-[#20D5EC]" />
                        <span>Connect via Browser Window + Check Sign-In</span>
                        {selectedStatus?.hasBrowser && (
                          <span className="text-[10px] text-[#6ee7b7]">● Connected via Browser</span>
                        )}
                      </span>
                      {hfAccordion === 'browser' ? (
                        <ChevronDown className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5" />
                      )}
                    </button>
                    {hfAccordion === 'browser' && (
                      <div className="px-4 pb-3.5 pt-2 border-t border-white/[0.06] space-y-3">
                        <p className="text-[11px] text-[#969696]">
                          Launch a CDP-monitored Chrome window, sign into Higgsfield once, then click <strong className="text-white">Check &amp; Sync Browser Sign-In</strong> to verify and bind the active tab immediately.
                        </p>
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => void launchConnectedCreatorBrowser('higgsfield')}
                            disabled={launchingBrowserTarget !== null}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-white hover:bg-[#e8e8e8] disabled:opacity-60 px-3.5 py-2 text-xs font-semibold text-[#0e0e0e]"
                          >
                            {launchingBrowserTarget === 'higgsfield' ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <ExternalLink className="w-3.5 h-3.5" />
                            )}
                            <span>Launch Higgsfield Browser</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => void handleVerifyBrowserSignIn('higgsfield')}
                            disabled={checkingBrowserPlatform !== null}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-[#20D5EC]/40 bg-[#20D5EC]/10 hover:bg-[#20D5EC]/20 disabled:opacity-60 px-3.5 py-2 text-xs font-medium text-[#7ceeff]"
                          >
                            {checkingBrowserPlatform === 'higgsfield' ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <RefreshCw className="w-3.5 h-3.5" />
                            )}
                            <span>↻ Check &amp; Sync Browser Sign-In</span>
                          </button>
                        </div>

                        {browserVerifyState?.platformId === 'higgsfield' && (
                          <div
                            className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 text-xs ${
                              browserVerifyState.phase === 'connected'
                                ? 'border-[#10b981]/35 bg-[#10b981]/10 text-[#6ee7b7]'
                                : browserVerifyState.phase === 'checking'
                                ? 'border-[#20D5EC]/35 bg-[#20D5EC]/10 text-white'
                                : 'border-[#f59e0b]/35 bg-[#f59e0b]/10 text-[#fcd34d]'
                            }`}
                          >
                            {browserVerifyState.phase === 'checking' ? (
                              <Loader2 className="w-4 h-4 animate-spin text-[#20D5EC]" />
                            ) : browserVerifyState.phase === 'connected' ? (
                              <CheckCircle2 className="w-4 h-4 text-[#10b981] animate-check-spring" />
                            ) : (
                              <AlertCircle className="w-4 h-4 text-[#f59e0b]" />
                            )}
                            <span>
                              {browserVerifyState.phase === 'checking'
                                ? 'Checking open browser tabs & CDP bridge…'
                                : browserVerifyState.phase === 'connected'
                                ? 'Connected Successfully — Higgsfield browser tab verified!'
                                : 'No active Higgsfield tab found yet. Sign in above, then click Check & Sync again.'}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : selectedPlatform.id === 'dreamina' ? (
              /* DREAMINA #2 FEATURED MCP STUDIO EXPERIENCE */
              <div className="space-y-4">
                {connectedMcpServer ? (
                  <McpFunctionsExplorer
                    server={connectedMcpServer}
                    onRefresh={() => void refreshExternalMcpById(connectedMcpServer.id)}
                    onDisconnect={() => {
                      if (connectedMcpServer.id === 'mcp_dreamina') {
                        void disconnectDreaminaMcp();
                      } else {
                        void removeExternalMcpById(connectedMcpServer.id);
                      }
                    }}
                    onSpawnToolNode={(tool) => handleSpawnToolNode(tool, connectedMcpServer)}
                  />
                ) : (
                  <div className="rounded-2xl border border-[#20D5EC]/35 bg-gradient-to-b from-[#20D5EC]/[0.08] to-[#141414] p-5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="space-y-1.5">
                        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#20D5EC]/15 text-[10.5px] font-semibold text-[#7ceeff]">
                          <Sparkles className="w-3 h-3" />
                          <span>#2 Featured · Dreamina Unified MCP Engine</span>
                        </div>
                        <h3 className="text-base font-semibold text-white">
                          Connect Dreamina Account &amp; Credits (MCP)
                        </h3>
                        <p className="text-xs text-[#b0b0b0] leading-relaxed max-w-lg">
                          Sign in once at{' '}
                          <span className="font-mono text-white">dreamina.capcut.com</span> or attach a BytePlus ARK key to unlock{' '}
                          <strong className="text-white">Seedream 5.5</strong>,{' '}
                          <strong className="text-white">5.0 Pro</strong>,{' '}
                          <strong className="text-white">Seedance 2.5</strong> &amp;{' '}
                          <strong className="text-white">OmniHuman 1.5</strong> directly on canvas.
                        </p>
                      </div>

                      <div className="flex flex-col gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => void handleConnectDreaminaMcp()}
                          disabled={dreaminaBusy}
                          className="inline-flex items-center justify-center gap-2 rounded-xl bg-white hover:bg-[#eaeaea] disabled:opacity-60 px-4 py-2.5 text-xs font-semibold text-[#0e0e0e] shadow-lg transition-all"
                        >
                          {dreaminaBusy ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Server className="w-4 h-4" />
                          )}
                          <span>Connect Dreamina via MCP →</span>
                        </button>

                        {mcpOAuthSession?.platformId === 'dreamina' &&
                          mcpOAuthSession.step !== 'connected' && (
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() =>
                                  void pollMcpOAuthStatus(mcpOAuthSession.sessionId)
                                }
                                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#10b981]/45 bg-[#10b981]/15 hover:bg-[#10b981]/25 px-3 py-1.5 text-[11px] font-medium text-[#6ee7b7]"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>✓ I&apos;ve Authorized — Verify &amp; Connect</span>
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  window.open(
                                    mcpOAuthSession.authorizeUrl ||
                                      'https://dreamina.capcut.com/ai-tool/home',
                                    'dreamina_mcp_oauth',
                                    'width=560,height=740'
                                  )
                                }
                                className="inline-flex items-center gap-1 rounded-lg border border-white/[0.12] bg-white/[0.05] hover:bg-white/[0.1] px-2.5 py-1.5 text-[11px] text-white/85"
                              >
                                <ExternalLink className="w-3 h-3" />
                                <span>Re-open Dreamina Sign-In</span>
                              </button>
                            </div>
                          )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Secondary Dreamina Auth Accordions (Session Cookie · ARK API Key · External Stdio MCP) */}
                <div className="space-y-2">
                  {/* Option A: Paste Dreamina sessionid Cookie */}
                  <div className="rounded-xl border border-white/[0.08] bg-[#151515] overflow-hidden">
                    <button
                      type="button"
                      onClick={() =>
                        setDreaminaAccordion(
                          dreaminaAccordion === 'session' ? 'none' : 'session'
                        )
                      }
                      className="w-full px-4 py-2.5 flex items-center justify-between text-xs font-medium text-[#d4d4d4] hover:text-white hover:bg-white/[0.03]"
                    >
                      <span className="inline-flex items-center gap-2">
                        <Globe className="w-3.5 h-3.5 text-[#20D5EC]" />
                        <span>Option A: Paste Dreamina sessionid Cookie (Zero Extension)</span>
                      </span>
                      {dreaminaAccordion === 'session' ? (
                        <ChevronDown className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5" />
                      )}
                    </button>
                    {dreaminaAccordion === 'session' && (
                      <div className="px-4 pb-3.5 pt-2 border-t border-white/[0.06] space-y-2.5">
                        <p className="text-[11px] text-[#969696]">
                          Paste your{' '}
                          <code className="text-white">sessionid</code> cookie from{' '}
                          <code className="text-[#7ceeff]">dreamina.capcut.com</code> DevTools → Application → Cookies to bind MCP execution directly.
                        </p>
                        <div className="flex items-center gap-2">
                          <input
                            type="password"
                            value={dreaminaSessionCookie}
                            onChange={(e) => setDreaminaSessionCookie(e.target.value)}
                            placeholder="sessionid=..."
                            className="flex-1 rounded-lg border border-white/[0.1] bg-[#0e0e0e] px-3 py-1.5 text-xs text-white placeholder-[#5e5e5e] focus:border-[#20D5EC] focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => void handleConnectDreaminaSessionCookie()}
                            disabled={dreaminaBusy}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-white hover:bg-[#e8e8e8] disabled:opacity-60 px-3.5 py-1.5 text-xs font-semibold text-[#0e0e0e]"
                          >
                            {dreaminaBusy ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <PlugZap className="w-3.5 h-3.5" />
                            )}
                            <span>Bind Session Cookie</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Option B: BytePlus ModelArk ARK_API_KEY */}
                  <div className="rounded-xl border border-white/[0.08] bg-[#151515] overflow-hidden">
                    <button
                      type="button"
                      onClick={() =>
                        setDreaminaAccordion(dreaminaAccordion === 'ark' ? 'none' : 'ark')
                      }
                      className="w-full px-4 py-2.5 flex items-center justify-between text-xs font-medium text-[#d4d4d4] hover:text-white hover:bg-white/[0.03]"
                    >
                      <span className="inline-flex items-center gap-2">
                        <KeyRound className="w-3.5 h-3.5 text-[#20D5EC]" />
                        <span>Option B: BytePlus ModelArk ARK_API_KEY (Zero-Markup API)</span>
                        {selectedStatus?.hasApiKey && (
                          <span className="text-[10px] text-[#6ee7b7]">● Saved</span>
                        )}
                      </span>
                      {dreaminaAccordion === 'ark' ? (
                        <ChevronDown className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5" />
                      )}
                    </button>
                    {dreaminaAccordion === 'ark' && (
                      <div className="px-4 pb-3.5 pt-2 border-t border-white/[0.06] space-y-2.5">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          <div>
                            <label className="block text-[11px] text-[#a5a5a5] mb-1">
                              ARK_API_KEY
                            </label>
                            <div className="flex items-center gap-1.5">
                              <input
                                type="password"
                                value={String(byok.seedanceApiKey ?? '')}
                                onChange={(e) =>
                                  updateByok({ seedanceApiKey: e.target.value })
                                }
                                placeholder="ark-..."
                                className="flex-1 min-w-0 rounded-lg border border-white/[0.1] bg-[#0e0e0e] px-3 py-1.5 text-xs text-white placeholder-[#5e5e5e] focus:border-[#20D5EC] focus:outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => void handlePasteIntoField('seedanceApiKey')}
                                className="rounded-lg border border-white/[0.1] bg-white/[0.05] hover:bg-white/[0.1] px-2.5 py-1.5 text-[11px] text-[#d4d4d4]"
                              >
                                <ClipboardPaste className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                          <div>
                            <label className="block text-[11px] text-[#a5a5a5] mb-1">
                              BytePlus Ark Endpoint
                            </label>
                            <input
                              type="text"
                              value={String(byok.seedanceEndpoint ?? '')}
                              onChange={(e) =>
                                updateByok({ seedanceEndpoint: e.target.value })
                              }
                              placeholder="https://ark.ap-southeast.bytepluses.com/api/v3/..."
                              className="w-full rounded-lg border border-white/[0.1] bg-[#0e0e0e] px-3 py-1.5 text-xs text-white placeholder-[#5e5e5e] focus:border-[#20D5EC] focus:outline-none"
                            />
                          </div>
                        </div>
                        <VerificationReadout result={selectedVerifyResult} />
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => void verifyProviderConnection('seedance')}
                            disabled={isVerifyingSelected}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.12] bg-white/[0.06] hover:bg-white/[0.12] px-3 py-1.5 text-xs text-white"
                          >
                            <span>Verify API Key</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleConnectDreaminaArkKey()}
                            disabled={dreaminaBusy}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-white hover:bg-[#e8e8e8] disabled:opacity-60 px-3.5 py-1.5 text-xs font-semibold text-[#0e0e0e]"
                          >
                            {dreaminaBusy ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            )}
                            <span>Connect ARK via MCP</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Option C: External Stdio / HTTP MCP Packages */}
                  <div className="rounded-xl border border-white/[0.08] bg-[#151515] overflow-hidden">
                    <button
                      type="button"
                      onClick={() =>
                        setDreaminaAccordion(
                          dreaminaAccordion === 'ext_mcp' ? 'none' : 'ext_mcp'
                        )
                      }
                      className="w-full px-4 py-2.5 flex items-center justify-between text-xs font-medium text-[#d4d4d4] hover:text-white hover:bg-white/[0.03]"
                    >
                      <span className="inline-flex items-center gap-2">
                        <Terminal className="w-3.5 h-3.5 text-[#20D5EC]" />
                        <span>Option C: External Stdio MCP (@acedatacloud/mcp-seedream · jimeng-mcp-server)</span>
                      </span>
                      {dreaminaAccordion === 'ext_mcp' ? (
                        <ChevronDown className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5" />
                      )}
                    </button>
                    {dreaminaAccordion === 'ext_mcp' && (
                      <div className="px-4 pb-3.5 pt-2 border-t border-white/[0.06] flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            void handleConnectDreaminaExternalMcp('@acedatacloud/mcp-seedream')
                          }
                          disabled={dreaminaBusy}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-white/[0.08] hover:bg-white/[0.15] border border-white/[0.12] px-3 py-1.5 text-xs text-white"
                        >
                          <Terminal className="w-3.5 h-3.5 text-[#20D5EC]" />
                          <span>npx -y @acedatacloud/mcp-seedream</span>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            void handleConnectDreaminaExternalMcp('jimeng-mcp-server')
                          }
                          disabled={dreaminaBusy}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-white/[0.08] hover:bg-white/[0.15] border border-white/[0.12] px-3 py-1.5 text-xs text-white"
                        >
                          <Terminal className="w-3.5 h-3.5 text-[#20D5EC]" />
                          <span>npx -y jimeng-mcp-server</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Option D: Browser Window + Explicit Check & Sync Sign-In */}
                  <div className="rounded-xl border border-white/[0.08] bg-[#151515] overflow-hidden">
                    <button
                      type="button"
                      onClick={() =>
                        setDreaminaAccordion(
                          dreaminaAccordion === 'browser' ? 'none' : 'browser'
                        )
                      }
                      className="w-full px-4 py-2.5 flex items-center justify-between text-xs font-medium text-[#d4d4d4] hover:text-white hover:bg-white/[0.03]"
                    >
                      <span className="inline-flex items-center gap-2">
                        <Globe className="w-3.5 h-3.5 text-[#20D5EC]" />
                        <span>Connect via Browser Window + Check Sign-In</span>
                        {selectedStatus?.hasBrowser && (
                          <span className="text-[10px] text-[#6ee7b7]">● Connected via Browser</span>
                        )}
                      </span>
                      {dreaminaAccordion === 'browser' ? (
                        <ChevronDown className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5" />
                      )}
                    </button>
                    {dreaminaAccordion === 'browser' && (
                      <div className="px-4 pb-3.5 pt-2 border-t border-white/[0.06] space-y-3">
                        <p className="text-[11px] text-[#969696]">
                          Launch a CDP-monitored Chrome window, sign into{' '}
                          <span className="text-white font-mono">dreamina.capcut.com</span> once, then click{' '}
                          <strong className="text-white">Check &amp; Sync Browser Sign-In</strong> or bind Browser MCP directly.
                        </p>
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => void launchConnectedCreatorBrowser('dreamina')}
                            disabled={launchingBrowserTarget !== null}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-white hover:bg-[#e8e8e8] disabled:opacity-60 px-3.5 py-2 text-xs font-semibold text-[#0e0e0e]"
                          >
                            {launchingBrowserTarget === 'dreamina' ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <ExternalLink className="w-3.5 h-3.5" />
                            )}
                            <span>Launch Dreamina Browser</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => void handleVerifyBrowserSignIn('dreamina')}
                            disabled={checkingBrowserPlatform !== null}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-[#20D5EC]/40 bg-[#20D5EC]/10 hover:bg-[#20D5EC]/20 disabled:opacity-60 px-3.5 py-2 text-xs font-medium text-[#7ceeff]"
                          >
                            {checkingBrowserPlatform === 'dreamina' ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <RefreshCw className="w-3.5 h-3.5" />
                            )}
                            <span>↻ Check &amp; Sync Browser Sign-In</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => void handleConnectDreaminaBrowserFallback()}
                            disabled={dreaminaBusy}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.12] bg-white/[0.06] hover:bg-white/[0.12] disabled:opacity-60 px-3 py-2 text-xs text-white"
                          >
                            {dreaminaBusy ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <PlugZap className="w-3.5 h-3.5" />
                            )}
                            <span>Capture Session via MCP</span>
                          </button>
                        </div>

                        {browserVerifyState?.platformId === 'dreamina' && (
                          <div
                            className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 text-xs ${
                              browserVerifyState.phase === 'connected'
                                ? 'border-[#10b981]/35 bg-[#10b981]/10 text-[#6ee7b7]'
                                : browserVerifyState.phase === 'checking'
                                ? 'border-[#20D5EC]/35 bg-[#20D5EC]/10 text-white'
                                : 'border-[#f59e0b]/35 bg-[#f59e0b]/10 text-[#fcd34d]'
                            }`}
                          >
                            {browserVerifyState.phase === 'checking' ? (
                              <Loader2 className="w-4 h-4 animate-spin text-[#20D5EC]" />
                            ) : browserVerifyState.phase === 'connected' ? (
                              <CheckCircle2 className="w-4 h-4 text-[#10b981] animate-check-spring" />
                            ) : (
                              <AlertCircle className="w-4 h-4 text-[#f59e0b]" />
                            )}
                            <span>
                              {browserVerifyState.phase === 'checking'
                                ? 'Checking open browser tabs & CDP bridge…'
                                : browserVerifyState.phase === 'connected'
                                ? 'Connected Successfully — Dreamina browser tab verified!'
                                : 'No active Dreamina tab found yet. Sign in above, then click Check & Sync again.'}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              /* OTHER COMPANIES (MCP-First + Verified Browser Sign-In + API Key) */
              <div className="space-y-4">
                {/* 1. Primary: Official / Presets / Custom MCP Section */}
                {connectedMcpServer ? (
                  <McpFunctionsExplorer
                    server={connectedMcpServer}
                    onRefresh={() => void refreshExternalMcpById(connectedMcpServer.id)}
                    onDisconnect={() => void removeExternalMcpById(connectedMcpServer.id)}
                    onSpawnToolNode={(tool) => handleSpawnToolNode(tool, connectedMcpServer)}
                  />
                ) : (
                  <div className="rounded-xl border border-[#20D5EC]/25 bg-[#15181a] p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Server className="w-4 h-4 text-[#20D5EC]" />
                        <h4 className="text-xs font-semibold text-white">
                          {matchingPreset
                            ? `1-Click MCP Connection · ${matchingPreset.name}`
                            : selectedPlatform.id === 'custom-mcp'
                            ? 'Connect Custom MCP Server (Streamable HTTP / Stdio)'
                            : `Connect ${selectedPlatform.name} via MCP`}
                        </h4>
                      </div>
                      <button
                        type="button"
                        onClick={() => setInlineMcpAdvanced((v) => !v)}
                        className="text-[11px] text-[#9b9b9b] hover:text-white underline underline-offset-2"
                      >
                        {inlineMcpAdvanced ? 'Simple Mode' : 'Advanced Config'}
                      </button>
                    </div>

                    {matchingPreset && !inlineMcpAdvanced ? (
                      <div className="space-y-2.5">
                        <p className="text-[11px] text-[#9c9c9c]">{matchingPreset.description}</p>
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                          {matchingPreset.envKeyName && (
                            <input
                              type="password"
                              value={inlineMcpApiKey}
                              onChange={(e) => setInlineMcpApiKey(e.target.value)}
                              placeholder={`Paste ${matchingPreset.envKeyName} (${matchingPreset.envPlaceholder || '...'})`}
                              className="flex-1 rounded-lg border border-white/[0.1] bg-[#0e0e0e] px-3 py-2 text-xs text-white placeholder-[#5e5e5e] focus:border-[#20D5EC] focus:outline-none"
                            />
                          )}
                          <button
                            type="button"
                            onClick={() => void handleConnectPresetForPlatform()}
                            disabled={mcpConnecting}
                            className="shrink-0 inline-flex items-center justify-center gap-1.5 rounded-xl bg-white hover:bg-[#e8e8e8] disabled:opacity-60 px-4 py-2 text-xs font-semibold text-[#0e0e0e] cursor-pointer"
                          >
                            {mcpConnecting ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <PlugZap className="w-3.5 h-3.5" />
                            )}
                            <span>Connect {selectedPlatform.shortLabel} MCP →</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div>
                          <label className="block text-[11px] text-[#a5a5a5] mb-1">
                            MCP Server Name
                          </label>
                          <input
                            type="text"
                            value={inlineMcpName}
                            onChange={(e) => setInlineMcpName(e.target.value)}
                            placeholder={`${selectedPlatform.name} MCP`}
                            className="w-full rounded-lg border border-white/[0.1] bg-[#0e0e0e] px-3 py-1.5 text-xs text-white focus:border-[#20D5EC] focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] text-[#a5a5a5] mb-1">Transport</label>
                          <select
                            value={inlineMcpTransport}
                            onChange={(e) =>
                              setInlineMcpTransport(e.target.value as 'http' | 'stdio')
                            }
                            className="w-full rounded-lg border border-white/[0.1] bg-[#0e0e0e] px-3 py-1.5 text-xs text-white focus:border-[#20D5EC] focus:outline-none"
                          >
                            <option value="http">Streamable HTTP / SSE URL</option>
                            <option value="stdio">Local Command (stdio)</option>
                          </select>
                        </div>
                        {inlineMcpTransport === 'http' ? (
                          <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            <div>
                              <label className="block text-[11px] text-[#a5a5a5] mb-1">
                                MCP Endpoint URL
                              </label>
                              <input
                                type="text"
                                value={inlineMcpUrl}
                                onChange={(e) => setInlineMcpUrl(e.target.value)}
                                placeholder="https://.../mcp"
                                className="w-full rounded-lg border border-white/[0.1] bg-[#0e0e0e] px-3 py-1.5 text-xs text-white focus:border-[#20D5EC] focus:outline-none"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] text-[#a5a5a5] mb-1">
                                Bearer Token (Optional)
                              </label>
                              <input
                                type="password"
                                value={inlineMcpApiKey}
                                onChange={(e) => setInlineMcpApiKey(e.target.value)}
                                placeholder="Optional Authorization header..."
                                className="w-full rounded-lg border border-white/[0.1] bg-[#0e0e0e] px-3 py-1.5 text-xs text-white focus:border-[#20D5EC] focus:outline-none"
                              />
                            </div>
                          </div>
                        ) : (
                          <>
                            <div>
                              <label className="block text-[11px] text-[#a5a5a5] mb-1">
                                Command
                              </label>
                              <input
                                type="text"
                                value={inlineMcpCommand}
                                onChange={(e) => setInlineMcpCommand(e.target.value)}
                                className="w-full rounded-lg border border-white/[0.1] bg-[#0e0e0e] px-3 py-1.5 text-xs font-mono text-white focus:border-[#20D5EC] focus:outline-none"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] text-[#a5a5a5] mb-1">Args</label>
                              <input
                                type="text"
                                value={inlineMcpArgs}
                                onChange={(e) => setInlineMcpArgs(e.target.value)}
                                className="w-full rounded-lg border border-white/[0.1] bg-[#0e0e0e] px-3 py-1.5 text-xs font-mono text-white focus:border-[#20D5EC] focus:outline-none"
                              />
                            </div>
                          </>
                        )}
                        <div className="sm:col-span-2 flex justify-end pt-1">
                          <button
                            type="button"
                            onClick={() => void handleConnectCustomMcp()}
                            disabled={mcpConnecting}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-white hover:bg-[#e8e8e8] disabled:opacity-60 px-4 py-2 text-xs font-semibold text-[#0e0e0e] cursor-pointer"
                          >
                            {mcpConnecting ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <PlugZap className="w-3.5 h-3.5" />
                            )}
                            <span>Connect MCP Server →</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 2. Side-by-side Browser Sign-In (+ Explicit Verify Button) & Official API Key */}
                {selectedPlatform.id !== 'custom-mcp' && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Browser Subscription Card */}
                    <div className="flex flex-col justify-between rounded-xl border border-white/[0.08] bg-[#161616] p-4 space-y-3.5">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#20D5EC]">
                            <Globe className="w-3.5 h-3.5" />
                            <span>Browser Session</span>
                          </span>
                          {selectedStatus?.hasBrowser && (
                            <span className="text-[10px] font-medium text-[#6ee7b7]">
                              ● Connected via Browser
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-[#9c9c9c] leading-relaxed">
                          {selectedPlatform.supportsBrowserBridge
                            ? `Sign into ${selectedPlatform.name} in the Connected Creator Browser, then click Verify Browser Sign-In to confirm pickup immediately.`
                            : `${selectedPlatform.name} connects via MCP or API Key on the right.`}
                        </p>
                      </div>

                      {selectedPlatform.supportsBrowserBridge && (
                        <div className="space-y-2.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => void launchConnectedCreatorBrowser(selectedPlatform.id)}
                              disabled={launchingBrowserTarget !== null}
                              className="inline-flex items-center gap-1.5 rounded-xl bg-white hover:bg-[#e8e8e8] disabled:opacity-60 px-3.5 py-2 text-xs font-semibold text-[#0e0e0e] cursor-pointer"
                            >
                              {launchingBrowserTarget === selectedPlatform.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <ExternalLink className="w-3.5 h-3.5" />
                              )}
                              <span>Sign In to {selectedPlatform.shortLabel} ↗</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => void handleVerifyBrowserSignIn(selectedPlatform.id)}
                              disabled={checkingBrowserPlatform !== null}
                              className="inline-flex items-center gap-1.5 rounded-xl border border-[#20D5EC]/40 bg-[#20D5EC]/10 hover:bg-[#20D5EC]/20 disabled:opacity-60 px-3 py-2 text-xs font-medium text-[#7ceeff] cursor-pointer"
                            >
                              {checkingBrowserPlatform === selectedPlatform.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <RefreshCw className="w-3.5 h-3.5" />
                              )}
                              <span>↻ Verify Browser Sign-In</span>
                            </button>
                          </div>

                          {browserVerifyState?.platformId === selectedPlatform.id && (
                            <div
                              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-[11px] ${
                                browserVerifyState.phase === 'connected'
                                  ? 'border-[#10b981]/35 bg-[#10b981]/10 text-[#6ee7b7]'
                                  : browserVerifyState.phase === 'checking'
                                  ? 'border-[#20D5EC]/35 bg-[#20D5EC]/10 text-white'
                                  : 'border-[#f59e0b]/35 bg-[#f59e0b]/10 text-[#fcd34d]'
                              }`}
                            >
                              {browserVerifyState.phase === 'checking' ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#20D5EC]" />
                              ) : browserVerifyState.phase === 'connected' ? (
                                <CheckCircle2 className="w-3.5 h-3.5 text-[#10b981] animate-check-spring" />
                              ) : (
                                <AlertCircle className="w-3.5 h-3.5 text-[#f59e0b]" />
                              )}
                              <span>
                                {browserVerifyState.phase === 'checking'
                                  ? 'Scanning active Chrome tabs…'
                                  : browserVerifyState.phase === 'connected'
                                  ? 'Connected Successfully!'
                                  : `Open ${selectedPlatform.name} tab & sign in, then click Verify again.`}
                              </span>
                            </div>
                          )}

                          {selectedStatus?.hasBrowser && (
                            <button
                              type="button"
                              onClick={() =>
                                void runLiveBridgeTestGeneration(
                                  selectedPlatform.id as BrowserPlatformTarget,
                                  selectedPlatform.modalities[0]
                                )
                              }
                              disabled={liveBridgeTestRunning !== null}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-[#10b981]/35 bg-[#10b981]/10 hover:bg-[#10b981]/20 px-3 py-1.5 text-[11px] font-medium text-[#6ee7b7]"
                            >
                              {liveBridgeTestRunning === selectedPlatform.id ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <Sparkles className="w-3 h-3" />
                              )}
                              <span>Test Browser Generation</span>
                            </button>
                          )}

                          {liveBridgeStatusText && liveBridgeTestRunning === null && (
                            <div className="rounded-lg border border-white/[0.08] bg-black/30 px-2.5 py-1.5 text-[11px] text-[#bdbdbd]">
                              {liveBridgeStatusText}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Official API Key ($0 Markup) Card */}
                    <div className="flex flex-col justify-between rounded-xl border border-white/[0.08] bg-[#161616] p-4 space-y-3.5">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#d4d4d4]">
                            <KeyRound className="w-3.5 h-3.5 text-[#20D5EC]" />
                            <span>Official API Key ($0 Markup)</span>
                          </span>
                          {selectedStatus?.hasApiKey && (
                            <span className="text-[10px] font-medium text-[#6ee7b7]">
                              ● Saved
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
                            <span>
                              {selectedMeta.apiKeyUrlLabel ||
                                `Get ${selectedPlatform.name} API Key ↗`}
                            </span>
                            <ExternalLink className="w-3.5 h-3.5 text-[#9c9c9c]" />
                          </a>
                        )}

                        <div className="space-y-2">
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
                                  className="flex-1 min-w-0 rounded-lg border border-white/[0.1] bg-[#0e0e0e] px-3 py-1.5 text-xs text-white placeholder-[#5e5e5e] focus:border-[#20D5EC] focus:outline-none"
                                />
                                {idx === 0 && (
                                  <button
                                    type="button"
                                    onClick={() => void handlePasteIntoField(fieldCfg.byokField)}
                                    title="Paste from clipboard"
                                    className="shrink-0 inline-flex items-center gap-1 rounded-lg border border-white/[0.1] bg-white/[0.05] hover:bg-white/[0.1] px-2.5 py-1.5 text-[11px] text-[#d4d4d4]"
                                  >
                                    <ClipboardPaste className="w-3.5 h-3.5" />
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
                          className="text-[11px] text-[#888] hover:text-[#e5e5e5]"
                        >
                          Clear key
                        </button>

                        <button
                          type="button"
                          onClick={() => void verifyProviderConnection(selectedVerifySlug)}
                          disabled={isVerifyingSelected}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-white hover:bg-[#e8e8e8] disabled:opacity-60 px-4 py-2 text-xs font-semibold text-[#0e0e0e] cursor-pointer"
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
                )}
              </div>
            )}

            {/* Built-In Studio Engine Footer Status Card */}
            {localStudioEngine && (
              <div className="rounded-xl border border-white/[0.07] bg-[#141414] px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                <div className="flex items-center gap-2 text-[#9c9c9c]">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      mcpHealth.online ? 'bg-[#10b981]' : 'bg-[#ef4444]'
                    }`}
                  />
                  <span className="font-medium text-[#d4d4d4]">{localStudioEngine.name}</span>
                  <span className="font-mono text-[10px] text-[#787878]">
                    {localStudioEngine.url}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => void refreshMcpServer(localStudioEngine.id)}
                  className="text-[#9e9e9e] hover:text-white underline underline-offset-2"
                >
                  Ping Local MCP
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Collapsible Footer Accordion: Manual Chrome Extension & Reset */}
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
  );
};
