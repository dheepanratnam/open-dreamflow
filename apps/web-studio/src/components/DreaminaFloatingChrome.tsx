import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowUp,
  AudioLines,
  Check,
  ChevronDown,
  Clapperboard,
  Compass,
  Copy,
  Download,
  ExternalLink,
  Film,
  FolderOpen,
  GitBranch,
  Hand,
  History,
  Image as ImageIcon,
  Layers,
  LayoutGrid,
  Loader2,
  Map as MapIcon,
  MessageSquare,
  Minus,
  MousePointer2,
  MoreHorizontal,
  Palette,
  Play,
  Plus,
  RotateCcw,
  Search,
  Share2,
  Sparkles,
  StickyNote,
  Trash2,
  Type,
  Undo2,
  Redo2,
  Upload,
  UserSquare2,
  Wand2,
  X,
  type LucideIcon,
} from 'lucide-react';
import type { DreaminaToolId } from '../types/studio';
import { MEDIA_ASSET_CATALOG, STUDIO_PRESETS } from '../presets/studioPresets';
import { useStudioStore } from '../store/useStudioStore';
import { SmartMediaImage } from './SmartMedia';
import { downloadTextFile, generateFcpxmlDocument } from '../utils/exporters';

interface DockToolItem {
  id: DreaminaToolId;
  label: string;
  shortcut?: string;
  beta?: boolean;
  icon: LucideIcon;
}

const DOCK_TOOLS: DockToolItem[] = [
  { id: 'text', label: 'Text', shortcut: 'T', icon: Type },
  { id: 'image', label: 'Image', shortcut: 'I', icon: ImageIcon },
  { id: 'video', label: 'Video', shortcut: 'G', icon: Clapperboard },
  { id: 'audio', label: 'Audio', shortcut: 'A', icon: AudioLines },
  { id: 'timeline', label: 'Timeline', icon: Film },
  { id: 'element', label: 'Reference (@Element)', icon: UserSquare2 },
  { id: 'cinema-kit', label: 'Cinema Kit', beta: true, icon: Palette },
  { id: 'camera-3d', label: '3D Director Console', icon: Compass },
  { id: 'image-editor', label: '9-Grid Contact Sheet', icon: Layers },
  { id: 'sticky', label: 'Sticky note', shortcut: 'S', icon: StickyNote },
  { id: 'assets', label: 'Select from Assets', icon: FolderOpen },
  { id: 'upload', label: 'Upload from device', icon: Upload },
];

export const DreaminaFloatingChrome: React.FC = () => {
  const activeProjectId = useStudioStore((s) => s.activeProjectId);
  const projectTitle = useStudioStore((s) => s.projectTitle);
  const saveStatus = useStudioStore((s) => s.saveStatus);
  const diskProjects = useStudioStore((s) => s.diskProjects);
  const projectSnapshots = useStudioStore((s) => s.projectSnapshots);
  const nodes = useStudioStore((s) => s.nodes);
  const timelineClips = useStudioStore((s) => s.timelineClips);
  const panX = useStudioStore((s) => s.panX);
  const panY = useStudioStore((s) => s.panY);
  const zoom = useStudioStore((s) => s.zoom);
  const canvasToolMode = useStudioStore((s) => s.canvasToolMode);
  const showMinimap = useStudioStore((s) => s.showMinimap);
  const showConnections = useStudioStore((s) => s.showConnections);
  const mcpHealth = useStudioStore((s) => s.mcpHealth);
  const chromeBridge = useStudioStore((s) => s.chromeBridge);
  const bridgeWsConnected = useStudioStore((s) => s.bridgeWsConnected);
  const byok = useStudioStore((s) => s.byok);

  const assetDrawerOpen = useStudioStore((s) => s.assetDrawerOpen);
  const chatDrawerOpen = useStudioStore((s) => s.chatDrawerOpen);
  const cameraDirectorOpen = useStudioStore((s) => s.cameraDirectorOpen);
  const searchModalOpen = useStudioStore((s) => s.searchModalOpen);
  const historyPanelOpen = useStudioStore((s) => s.historyPanelOpen);
  const directorModalOpen = useStudioStore((s) => s.directorModalOpen);
  const directorRunning = useStudioStore((s) => s.directorRunning);
  const directorStepLog = useStudioStore((s) => s.directorStepLog);
  const workflowRunning = useStudioStore((s) => s.workflowRunning);
  const workflowProgressText = useStudioStore((s) => s.workflowProgressText);
  const externalMcpServers = useStudioStore((s) => s.externalMcpServers);
  const past = useStudioStore((s) => s.past);
  const future = useStudioStore((s) => s.future);
  const chatMessages = useStudioStore((s) => s.chatMessages);

  const setProjectTitle = useStudioStore((s) => s.setProjectTitle);
  const setActiveView = useStudioStore((s) => s.setActiveView);
  const setCanvasToolMode = useStudioStore((s) => s.setCanvasToolMode);
  const toggleMinimap = useStudioStore((s) => s.toggleMinimap);
  const toggleShowConnections = useStudioStore((s) => s.toggleShowConnections);
  const setViewport = useStudioStore((s) => s.setViewport);
  const fitAllNodesInViewport = useStudioStore((s) => s.fitAllNodesInViewport);
  const tidyUpNodes = useStudioStore((s) => s.tidyUpNodes);
  const loadPresetProject = useStudioStore((s) => s.loadPresetProject);
  const spawnDreaminaNodeAt = useStudioStore((s) => s.spawnDreaminaNodeAt);
  const uploadLocalMediaNode = useStudioStore((s) => s.uploadLocalMediaNode);
  const selectNodes = useStudioStore((s) => s.selectNodes);
  const undo = useStudioStore((s) => s.undo);
  const redo = useStudioStore((s) => s.redo);

  const setAssetDrawerOpen = useStudioStore((s) => s.setAssetDrawerOpen);
  const setChatDrawerOpen = useStudioStore((s) => s.setChatDrawerOpen);
  const setCameraDirectorOpen = useStudioStore((s) => s.setCameraDirectorOpen);
  const setSearchModalOpen = useStudioStore((s) => s.setSearchModalOpen);
  const setHistoryPanelOpen = useStudioStore((s) => s.setHistoryPanelOpen);
  const setDirectorModalOpen = useStudioStore((s) => s.setDirectorModalOpen);
  const openProviderModal = useStudioStore((s) => s.openProviderModal);
  const copyShareableRecipeUrl = useStudioStore((s) => s.copyShareableRecipeUrl);
  const sendChatAssistantPrompt = useStudioStore((s) => s.sendChatAssistantPrompt);
  const runChatQuickAction = useStudioStore((s) => s.runChatQuickAction);
  const switchDiskProject = useStudioStore((s) => s.switchDiskProject);
  const createNewBlankProject = useStudioStore((s) => s.createNewBlankProject);
  const deleteSavedProject = useStudioStore((s) => s.deleteSavedProject);
  const saveVersionSnapshot = useStudioStore((s) => s.saveVersionSnapshot);
  const restoreVersionSnapshot = useStudioStore((s) => s.restoreVersionSnapshot);
  const exportCurrentProjectDreamflowJson = useStudioStore(
    (s) => s.exportCurrentProjectDreamflowJson
  );
  const importProjectDreamflowJson = useStudioStore(
    (s) => s.importProjectDreamflowJson
  );
  const runAutonomousDirectorAgent = useStudioStore(
    (s) => s.runAutonomousDirectorAgent
  );
  const runWorkflowPipeline = useStudioStore((s) => s.runWorkflowPipeline);
  const showToast = useStudioStore((s) => s.showToast);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const importBundleInputRef = useRef<HTMLInputElement | null>(null);
  const [hoveredTool, setHoveredTool] = useState<DreaminaToolId | null>(null);
  const [projectMenuOpen, setProjectMenuOpen] = useState(false);
  const [shareMenuOpen, setShareMenuOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [chatInput, setChatInput] = useState('');
  const [directorBrief, setDirectorBrief] = useState(
    '35mm natural daylight architectural portrait sequence in a warm travertine courtyard transitioning to sunlit coastal cliffs.'
  );

  const connectedCreditSourcesCount =
    [
      byok.higgsfieldApiKey,
      byok.klingAccessKey || byok.klingApiKey,
      byok.seedanceApiKey,
      byok.geminiApiKey,
      byok.elevenlabsApiKey,
      byok.openartApiKey,
      byok.imagineartApiKey,
      byok.openaiApiKey,
      byok.falApiKey,
      byok.replicateApiKey,
    ].filter((v) => Boolean(v?.trim())).length +
    externalMcpServers.filter((srv) => srv.status === 'connected').length +
    Object.values(chromeBridge.connectedPlatforms || {}).filter(Boolean).length;

  const getViewportCenterWorld = () => {
    const w = typeof window !== 'undefined' ? window.innerWidth : 1440;
    const h = typeof window !== 'undefined' ? window.innerHeight : 900;
    const worldX = (w / 2 - panX) / zoom - 220;
    const worldY = (h / 2 - panY) / zoom - 130;
    return { worldX, worldY };
  };

  const handleDockToolClick = (toolId: DreaminaToolId) => {
    if (toolId === 'upload') {
      fileInputRef.current?.click();
      return;
    }
    if (toolId === 'assets') {
      setAssetDrawerOpen(!assetDrawerOpen);
      return;
    }
    if (toolId === 'camera-3d') {
      setCameraDirectorOpen(true);
      return;
    }
    const { worldX, worldY } = getViewportCenterWorld();
    spawnDreaminaNodeAt(toolId, worldX, worldY);
  };

  const handleZoomDelta = (delta: number) => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const cx = w / 2;
    const cy = h / 2;
    const nextZoom = Math.max(0.2, Math.min(2.5, Number((zoom + delta).toFixed(2))));
    const scale = nextZoom / zoom;
    const nextPanX = cx - (cx - panX) * scale;
    const nextPanY = cy - (cy - panY) * scale;
    setViewport(nextPanX, nextPanY, nextZoom);
  };

  const handleExportFcpxml = () => {
    const xml = generateFcpxmlDocument(projectTitle, timelineClips);
    const slug = projectTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'dreamflow';
    downloadTextFile(`${slug}.fcpxml`, xml, 'application/xml');
    showToast('Exported Final Cut / Premiere .fcpxml timeline.');
  };

  const filteredNodes = nodes.filter(
    (n) =>
      n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      n.prompt.toLowerCase().includes(searchQuery.toLowerCase()) ||
      n.kind.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <>
      {/* Hidden File Upload Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*,audio/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            const { worldX, worldY } = getViewportCenterWorld();
            uploadLocalMediaNode(file, worldX, worldY);
            e.target.value = '';
          }
        }}
      />

      {/* Hidden .dreamflow.json Bundle Import Input */}
      <input
        ref={importBundleInputRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            void importProjectDreamflowJson(file);
            e.target.value = '';
            setProjectMenuOpen(false);
          }
        }}
      />

      {/* 1. Top Minimal Floating Header Strip (40px) */}
      <header className="fixed top-[10px] left-[12px] right-[12px] h-[40px] z-30 pointer-events-none flex items-center justify-between select-none">
        {/* Top-Left Project Pill */}
        <div className="pointer-events-auto h-[36px] px-2.5 rounded-[10px] dreamina-levitation flex items-center gap-2 relative">
          {/* Clean 4-Point Monochrome Prism Logo */}
          <div className="w-6 h-6 rounded-[7px] bg-[#252525] flex items-center justify-center">
            <svg
              viewBox="0 0 24 24"
              className="w-3.5 h-3.5 text-white"
              fill="currentColor"
            >
              <path d="M12 2L14.8 9.2L22 12L14.8 14.8L12 22L9.2 14.8L2 12L9.2 9.2L12 2Z" />
            </svg>
          </div>

          {editingTitle ? (
            <input
              autoFocus
              value={projectTitle}
              onChange={(e) => setProjectTitle(e.target.value)}
              onBlur={() => setEditingTitle(false)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === 'Escape') {
                  setEditingTitle(false);
                }
              }}
              className="w-[150px] bg-[#252525] text-[13px] font-medium text-white px-2 py-0.5 rounded-[6px] outline-none border border-white/20"
            />
          ) : (
            <button
              type="button"
              onClick={() => setProjectMenuOpen(!projectMenuOpen)}
              onDoubleClick={() => setEditingTitle(true)}
              className="h-7 px-1.5 rounded-[6px] hover:bg-[#252525] flex items-center gap-1 text-[13px] font-medium text-[#f5f5f5] transition-colors"
            >
              <span>{projectTitle}</span>
              <ChevronDown className="w-3.5 h-3.5 text-white/50" strokeWidth={1.5} />
            </button>
          )}

          <span className="px-2 py-0.5 rounded-[6px] bg-white/[0.06] text-[11px] font-medium text-white/65">
            {nodes.length} nodes
          </span>

          <span className="text-[11px] text-white/42 hidden sm:inline pr-1">
            {saveStatus === 'saving'
              ? 'Saving…'
              : saveStatus === 'saved'
                ? 'Auto saved · Disk'
                : 'Saved locally'}
          </span>

          {projectMenuOpen && (
            <div className="absolute left-0 top-[42px] w-[288px] p-1.5 rounded-[12px] dreamina-menu z-50 space-y-0.5">
              <button
                type="button"
                onClick={() => {
                  void createNewBlankProject('Untitled Canvas');
                  setProjectMenuOpen(false);
                }}
                className="w-full h-8 px-2.5 rounded-[8px] bg-white hover:bg-[#e6e6e6] text-[#0e0e0e] text-left text-[12px] font-semibold flex items-center gap-2 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" strokeWidth={2} />
                <span>+ New Blank Canvas</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  loadPresetProject('cross-platform-blueprint');
                  setProjectMenuOpen(false);
                }}
                className="w-full px-2.5 py-1.5 rounded-[8px] hover:bg-white/[0.08] text-left flex items-center justify-between gap-2 transition-colors"
              >
                <div className="min-w-0">
                  <div className="text-[11.5px] font-medium text-white truncate">
                    Workflow Blueprint · Multi-Credit
                  </div>
                  <div className="text-[10px] text-[#20D5EC] truncate">
                    Higgsfield ChatGPT 2.6 → Kling 4.0 → ElevenLabs
                  </div>
                </div>
                <GitBranch className="w-3.5 h-3.5 text-[#20D5EC] shrink-0" strokeWidth={1.6} />
              </button>

              <div className="my-1 h-px bg-white/[0.07]" />

              <div className="px-2.5 py-1 text-[11px] text-white/45 font-medium flex items-center justify-between">
                <span>Saved Projects (Disk)</span>
                <span className="font-mono text-[10px] text-white/35">
                  {diskProjects.length}
                </span>
              </div>

              {diskProjects.length > 0 && (
                <div className="max-h-[152px] overflow-y-auto space-y-0.5 pb-0.5">
                  {diskProjects.map((proj) => {
                    const isCurrent = proj.id === activeProjectId;
                    return (
                      <div
                        key={proj.id}
                        className={`group h-8 px-2 rounded-[7px] flex items-center justify-between gap-1.5 ${
                          isCurrent
                            ? 'bg-white/[0.09] text-white'
                            : 'hover:bg-white/[0.07] text-white/85'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            void switchDiskProject(proj.id);
                            setProjectMenuOpen(false);
                          }}
                          className="flex-1 min-w-0 text-left flex items-center gap-1.5 text-[12px]"
                        >
                          {isCurrent ? (
                            <Check
                              className="w-3.5 h-3.5 text-[#20D5EC] shrink-0"
                              strokeWidth={1.75}
                            />
                          ) : (
                            <span className="w-3.5 shrink-0" />
                          )}
                          <span className="truncate">{proj.name}</span>
                          <span className="text-[10px] font-mono text-white/40 shrink-0">
                            {proj.nodeCount}n
                          </span>
                        </button>
                        {diskProjects.length > 1 && (
                          <button
                            type="button"
                            title="Delete project from disk"
                            onClick={(e) => {
                              e.stopPropagation();
                              void deleteSavedProject(proj.id);
                            }}
                            className="w-6 h-6 rounded-[5px] opacity-0 group-hover:opacity-100 hover:bg-red-500/20 text-white/45 hover:text-red-300 flex items-center justify-center transition-opacity"
                          >
                            <Trash2 className="w-3 h-3" strokeWidth={1.5} />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="my-1 h-px bg-white/[0.07]" />

              <div className="px-2.5 py-1 text-[11px] text-white/45 font-medium flex items-center justify-between">
                <span>Demo Showcases (35mm)</span>
                <span className="font-mono text-[10px] text-white/35">
                  {
                    STUDIO_PRESETS.filter(
                      (p) => p.id !== 'blank' && p.id !== 'cross-platform-blueprint'
                    ).length
                  }
                </span>
              </div>

              {STUDIO_PRESETS.filter(
                (p) => p.id !== 'blank' && p.id !== 'cross-platform-blueprint'
              ).map((preset) => {
                const isPresetActive = activeProjectId.startsWith(preset.id);
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => {
                      loadPresetProject(preset.id);
                      setProjectMenuOpen(false);
                    }}
                    className={`w-full px-2 py-1.5 rounded-[8px] text-left flex items-center gap-2.5 transition-colors ${
                      isPresetActive
                        ? 'bg-white/[0.1] text-white'
                        : 'hover:bg-white/[0.07] text-white/85'
                    }`}
                  >
                    {preset.thumbnailUrl ? (
                      <div className="w-8 h-6 rounded-[5px] overflow-hidden bg-[#222222] border border-white/[0.08] shrink-0">
                        <SmartMediaImage
                          src={preset.thumbnailUrl}
                          alt={preset.title}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : null}
                    <div className="min-w-0 flex-1">
                      <div className="text-[11.5px] font-medium truncate">
                        {preset.title}
                      </div>
                      <div className="text-[10px] text-white/42 truncate">
                        {preset.subtitle}
                      </div>
                    </div>
                  </button>
                );
              })}

              <div className="my-1 h-px bg-white/[0.07]" />

              <button
                type="button"
                onClick={() => {
                  void exportCurrentProjectDreamflowJson();
                  setProjectMenuOpen(false);
                }}
                className="w-full h-7.5 py-1.5 px-2.5 rounded-[7px] hover:bg-white/[0.08] text-left text-[12px] text-white/85 flex items-center justify-between"
              >
                <span>Export .dreamflow.json</span>
                <Download className="w-3.5 h-3.5 text-white/55" strokeWidth={1.5} />
              </button>

              <button
                type="button"
                onClick={() => importBundleInputRef.current?.click()}
                className="w-full h-7.5 py-1.5 px-2.5 rounded-[7px] hover:bg-white/[0.08] text-left text-[12px] text-white/85 flex items-center justify-between"
              >
                <span>Import .dreamflow.json…</span>
                <Upload className="w-3.5 h-3.5 text-white/55" strokeWidth={1.5} />
              </button>

              <div className="my-1 h-px bg-white/[0.07]" />

              <button
                type="button"
                onClick={() => {
                  setEditingTitle(true);
                  setProjectMenuOpen(false);
                }}
                className="w-full h-7 px-2.5 rounded-[7px] hover:bg-white/[0.08] text-left text-[12px] text-white/70"
              >
                Rename project…
              </button>
            </div>
          )}
        </div>

        {/* Top-Right Floating Pill Cluster */}
        <div className="pointer-events-auto flex items-center gap-1.5">
          {/* Search & History Pill */}
          <div className="h-[34px] px-1 rounded-[10px] dreamina-levitation flex items-center gap-0.5 relative">
            <button
              type="button"
              onClick={() => {
                setSearchModalOpen(!searchModalOpen);
                setHistoryPanelOpen(false);
              }}
              title="Search canvas nodes (⌘K)"
              className="w-7 h-7 rounded-[7px] hover:bg-[#252525] flex items-center justify-center text-white/75 hover:text-white transition-colors"
            >
              <Search className="w-3.5 h-3.5" strokeWidth={1.5} />
            </button>
            <div className="w-px h-3.5 bg-white/[0.08]" />
            <button
              type="button"
              onClick={() => {
                setHistoryPanelOpen(!historyPanelOpen);
                setSearchModalOpen(false);
              }}
              title="Version Snapshots & Undo History"
              className="w-7 h-7 rounded-[7px] hover:bg-[#252525] flex items-center justify-center text-white/75 hover:text-white transition-colors"
            >
              <History className="w-3.5 h-3.5" strokeWidth={1.5} />
            </button>

            {historyPanelOpen && (
              <div className="absolute right-0 top-[40px] w-[288px] p-2.5 rounded-[12px] dreamina-menu z-50 space-y-2">
                <div className="px-1 text-[11px] font-medium text-white/50 flex items-center justify-between">
                  <span>Canvas History & Snapshots</span>
                  <span className="font-mono">{past.length} steps</span>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    disabled={past.length === 0}
                    onClick={undo}
                    className="h-8 rounded-[8px] bg-[#252525] hover:bg-[#303030] disabled:opacity-40 text-[12px] text-white/90 flex items-center justify-center gap-1.5"
                  >
                    <Undo2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                    <span>Undo</span>
                  </button>
                  <button
                    type="button"
                    disabled={future.length === 0}
                    onClick={redo}
                    className="h-8 rounded-[8px] bg-[#252525] hover:bg-[#303030] disabled:opacity-40 text-[12px] text-white/90 flex items-center justify-center gap-1.5"
                  >
                    <Redo2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                    <span>Redo</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => void saveVersionSnapshot()}
                  className="w-full h-8 rounded-[8px] bg-white hover:bg-[#e6e6e6] text-[#0e0e0e] text-[12px] font-semibold flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" strokeWidth={1.75} />
                  <span>Save Version Snapshot</span>
                </button>

                <div className="pt-1 border-t border-white/[0.07] space-y-1 max-h-[180px] overflow-y-auto">
                  {projectSnapshots.length === 0 ? (
                    <div className="px-1.5 py-2 text-[11px] text-white/40 text-center">
                      No disk snapshots saved yet.
                    </div>
                  ) : (
                    projectSnapshots.map((snap) => (
                      <div
                        key={snap.snapshotId}
                        className="px-2 py-1.5 rounded-[8px] bg-[#1e1e1e] border border-white/[0.06] flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <div className="text-[11.5px] font-medium text-white/90 truncate">
                            {snap.label}
                          </div>
                          <div className="text-[10px] font-mono text-white/40">
                            {new Date(snap.createdAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                            })}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            void restoreVersionSnapshot(snap.snapshotId);
                            setHistoryPanelOpen(false);
                          }}
                          className="h-6 px-2 rounded-[6px] bg-[#2a2a2a] hover:bg-white hover:text-[#0e0e0e] text-[11px] font-medium text-white/85 shrink-0 transition-colors"
                        >
                          Restore
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Share Pill */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setShareMenuOpen(!shareMenuOpen);
                setMoreMenuOpen(false);
              }}
              className="h-[34px] px-3 rounded-[10px] dreamina-levitation hover:bg-[#222222] text-[12px] font-medium text-white/90 flex items-center gap-1.5 transition-colors"
            >
              <Share2 className="w-3.5 h-3.5 text-white/75" strokeWidth={1.5} />
              <span>Share</span>
            </button>
            {shareMenuOpen && (
              <div className="absolute right-0 top-[40px] w-[236px] p-1.5 rounded-[12px] dreamina-menu z-50 space-y-0.5">
                <button
                  type="button"
                  onClick={() => {
                    setShareMenuOpen(false);
                    setActiveView('app');
                  }}
                  className="w-full h-8 px-2.5 rounded-[7px] hover:bg-white/[0.08] text-left text-[12px] text-white/90 flex items-center justify-between"
                >
                  <span>Open Shareable App View</span>
                  <ExternalLink className="w-3.5 h-3.5 text-white/55" strokeWidth={1.5} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    copyShareableRecipeUrl();
                    setShareMenuOpen(false);
                  }}
                  className="w-full h-8 px-2.5 rounded-[7px] hover:bg-white/[0.08] text-left text-[12px] text-white/85 flex items-center justify-between"
                >
                  <span>Copy ?recipe= Graph URL</span>
                  <Copy className="w-3.5 h-3.5 text-white/55" strokeWidth={1.5} />
                </button>
              </div>
            )}
          </div>

          {/* More [•••] Menu */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setMoreMenuOpen(!moreMenuOpen);
                setShareMenuOpen(false);
              }}
              className="w-[34px] h-[34px] rounded-[10px] dreamina-levitation hover:bg-[#222222] flex items-center justify-center text-white/80 hover:text-white transition-colors"
            >
              <MoreHorizontal className="w-4 h-4" strokeWidth={1.5} />
            </button>
            {moreMenuOpen && (
              <div className="absolute right-0 top-[40px] w-[240px] p-1.5 rounded-[12px] dreamina-menu z-50 space-y-0.5">
                <button
                  type="button"
                  onClick={() => {
                    setMoreMenuOpen(false);
                    setActiveView('multiframes');
                  }}
                  className="w-full h-8 px-2.5 rounded-[7px] hover:bg-white/[0.08] text-left text-[12px] text-white/90 flex items-center gap-2"
                >
                  <LayoutGrid className="w-3.5 h-3.5 text-white/60" strokeWidth={1.5} />
                  <span>Smart Multiframes View</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMoreMenuOpen(false);
                    setDirectorModalOpen(true);
                  }}
                  className="w-full h-8 px-2.5 rounded-[7px] hover:bg-white/[0.08] text-left text-[12px] text-white/90 flex items-center gap-2"
                >
                  <Wand2 className="w-3.5 h-3.5 text-white/60" strokeWidth={1.5} />
                  <span>Autonomous Director Agent</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    tidyUpNodes();
                    setMoreMenuOpen(false);
                  }}
                  className="w-full h-8 px-2.5 rounded-[7px] hover:bg-white/[0.08] text-left text-[12px] text-white/85 flex items-center gap-2"
                >
                  <Sparkles className="w-3.5 h-3.5 text-white/60" strokeWidth={1.5} />
                  <span>Tidy up nodes</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleExportFcpxml();
                    setMoreMenuOpen(false);
                  }}
                  className="w-full h-8 px-2.5 rounded-[7px] hover:bg-white/[0.08] text-left text-[12px] text-white/85 flex items-center gap-2"
                >
                  <Download className="w-3.5 h-3.5 text-white/60" strokeWidth={1.5} />
                  <span>Export .fcpxml Timeline</span>
                </button>
                <div className="my-1 h-px bg-white/[0.07]" />
                <button
                  type="button"
                  onClick={() => {
                    loadPresetProject('salt-terracotta');
                    setMoreMenuOpen(false);
                  }}
                  className="w-full h-8 px-2.5 rounded-[7px] hover:bg-white/[0.08] text-left text-[12px] text-white/75 flex items-center gap-2"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-white/50" strokeWidth={1.5} />
                  <span>Reset Salt & Terracotta</span>
                </button>
              </div>
            )}
          </div>

          {/* Run Multi-Platform Workflow Chain Pill */}
          <button
            type="button"
            disabled={workflowRunning}
            onClick={() => void runWorkflowPipeline()}
            title="Execute connected canvas nodes in topological order (e.g. Higgsfield Image → Kling 4.0 Video)"
            className={`h-[34px] px-3 rounded-[10px] text-[12px] font-semibold flex items-center gap-1.5 transition-colors ${
              workflowRunning
                ? 'bg-[#252525] text-[#20D5EC] border border-[#20D5EC]/35'
                : 'bg-white hover:bg-[#e6e6e6] text-[#0e0e0e]'
            }`}
          >
            {workflowRunning ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={2} />
                <span className="max-w-[160px] truncate">
                  {workflowProgressText || 'Running Workflow…'}
                </span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" strokeWidth={1.75} />
                <span>Run Workflow</span>
              </>
            )}
          </button>

          {/* Connections · Credits · MCP Config Pill */}
          <button
            type="button"
            onClick={() => openProviderModal('byok')}
            className="h-[34px] px-3 rounded-[10px] dreamina-levitation hover:bg-[#222222] text-[12px] font-medium text-white/90 hover:text-white flex items-center gap-1.5 transition-colors"
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                connectedCreditSourcesCount > 0 ? 'bg-[#10b981]' : 'bg-white/35'
              }`}
            />
            <span>Connections · Credits</span>
            {connectedCreditSourcesCount > 0 && (
              <span className="px-1.5 py-[1px] rounded-[5px] bg-[#10b981]/15 text-[#34d399] font-mono text-[10px]">
                {connectedCreditSourcesCount}
              </span>
            )}
          </button>

          {/* Live Engine / MCP Server Status Pill */}
          <button
            type="button"
            onClick={() => openProviderModal('mcp')}
            className="h-[34px] px-3 rounded-[10px] dreamina-levitation hover:bg-[#222222] text-[12px] font-medium text-white/90 flex items-center gap-2 transition-colors"
          >
            <span
              className={`w-[6px] h-[6px] rounded-full ${
                mcpHealth.online || bridgeWsConnected ? 'bg-[#10b981]' : 'bg-[#f59e0b]'
              }`}
            />
            <span>
              {externalMcpServers.filter((srv) => srv.status === 'connected').length > 0
                ? `${externalMcpServers.filter((srv) => srv.status === 'connected').length} MCP Live`
                : bridgeWsConnected
                ? 'Bridge Ready'
                : mcpHealth.online
                ? 'Studio :3001'
                : 'Offline'}
            </span>
            <span className="text-white/35">·</span>
            <span className="font-mono text-[11px] text-white/80">$0 Markup</span>
          </button>
        </div>
      </header>

      {/* 2. Left Vertical Floating 12-Tool Dock (48px wide, vertically centered) */}
      <aside className="fixed left-[12px] top-1/2 -translate-y-1/2 w-[48px] p-1 rounded-[16px] dreamina-levitation z-30 flex flex-col items-center gap-0.5 select-none">
        {DOCK_TOOLS.map((tool) => {
          const Icon = tool.icon;
          const isActive =
            (tool.id === 'assets' && assetDrawerOpen) ||
            (tool.id === 'camera-3d' && cameraDirectorOpen);
          return (
            <div
              key={tool.id}
              className="relative"
              onMouseEnter={() => setHoveredTool(tool.id)}
              onMouseLeave={() =>
                setHoveredTool((cur) => (cur === tool.id ? null : cur))
              }
            >
              <button
                type="button"
                onClick={() => handleDockToolClick(tool.id)}
                className={`w-[40px] h-[38px] rounded-[11px] flex items-center justify-center relative transition-colors ${
                  isActive
                    ? 'bg-[#303030] text-white'
                    : 'text-white/65 hover:text-white hover:bg-[#252525]'
                }`}
              >
                <Icon className="w-[18px] h-[18px]" strokeWidth={1.5} />
                {tool.beta && (
                  <span className="absolute -top-0.5 -right-0.5 px-1 py-[0.5px] rounded-[4px] bg-[#2e2e2e] border border-white/15 text-[8px] font-medium text-white/80 leading-none">
                    Beta
                  </span>
                )}
              </button>

              {hoveredTool === tool.id && (
                <div className="fixed ml-[50px] -mt-[32px] px-2.5 py-1 rounded-[8px] bg-[#252525] border border-white/[0.1] shadow-[0_8px_24px_rgba(0,0,0,0.65)] text-[12px] text-white/95 whitespace-nowrap pointer-events-none flex items-center gap-2 z-50">
                  <span>{tool.label}</span>
                  {tool.shortcut && (
                    <span className="font-mono text-[10.5px] text-white/45">
                      {tool.shortcut}
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </aside>

      {/* Select from Assets Slide-Out Popover */}
      {assetDrawerOpen && (
        <div className="fixed left-[68px] top-1/2 -translate-y-1/2 w-[328px] max-h-[520px] rounded-[16px] dreamina-menu z-40 flex flex-col overflow-hidden select-none">
          <div className="h-[42px] px-3.5 border-b border-white/[0.08] flex items-center justify-between shrink-0">
            <span className="text-[12.5px] font-medium text-white/90">
              Select from Studio Assets
            </span>
            <button
              type="button"
              onClick={() => setAssetDrawerOpen(false)}
              className="w-6 h-6 rounded-[6px] hover:bg-white/[0.08] flex items-center justify-center text-white/60 hover:text-white"
            >
              <X className="w-3.5 h-3.5" strokeWidth={1.5} />
            </button>
          </div>
          <div className="p-3 overflow-y-auto grid grid-cols-2 gap-2">
            {MEDIA_ASSET_CATALOG.map((asset) => (
              <button
                key={asset.id}
                type="button"
                onClick={() => {
                  const { worldX, worldY } = getViewportCenterWorld();
                  spawnDreaminaNodeAt('assets', worldX, worldY, { asset });
                  setAssetDrawerOpen(false);
                }}
                className="group rounded-[10px] overflow-hidden bg-[#141414] border border-white/[0.08] hover:border-white/[0.28] text-left transition-all"
              >
                <div className="aspect-video bg-[#191919] relative overflow-hidden">
                  <SmartMediaImage
                    src={asset.posterUrl || asset.url}
                    alt={asset.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                  />
                  {asset.durationSec && (
                    <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded-[4px] bg-black/70 font-mono text-[9.5px] text-white/85">
                      00:0{asset.durationSec}
                    </span>
                  )}
                </div>
                <div className="p-2">
                  <div className="text-[11.5px] font-medium text-white/90 truncate">
                    {asset.title}
                  </div>
                  <div className="text-[10px] text-white/45 uppercase mt-0.5">
                    {asset.kind} · {asset.resolution}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 3. Bottom-Left Viewport Controls Pill + Optional Minimap */}
      <div className="fixed left-[12px] bottom-[14px] z-30 flex flex-col items-start gap-2 select-none">
        {showMinimap && (
          <div className="w-[200px] h-[126px] rounded-[12px] dreamina-levitation p-2 relative overflow-hidden">
            <div className="text-[10px] text-white/40 mb-1 flex items-center justify-between">
              <span>Spatial Overview</span>
              <span className="font-mono">{nodes.length} nodes</span>
            </div>
            <div className="relative w-full h-[92px] bg-[#121212] rounded-[7px] border border-white/[0.06] overflow-hidden">
              {nodes.map((n) => {
                const mx = Math.max(2, Math.min(176, (n.x / 2400) * 180 + 6));
                const my = Math.max(2, Math.min(82, (n.y / 1300) * 84 + 4));
                const mw = Math.max(8, (n.width / 2400) * 180);
                const mh = Math.max(5, (n.height / 1300) * 84);
                return (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => {
                      selectNodes([n.id]);
                      setViewport(
                        window.innerWidth / 2 - (n.x + n.width / 2) * zoom,
                        window.innerHeight / 2 - (n.y + n.height / 2) * zoom,
                        zoom
                      );
                    }}
                    style={{
                      left: `${mx}px`,
                      top: `${my}px`,
                      width: `${mw}px`,
                      height: `${mh}px`,
                    }}
                    className="absolute rounded-[2px] bg-white/30 hover:bg-[#20D5EC]/80 transition-colors"
                  />
                );
              })}
            </div>
          </div>
        )}

        <div className="h-[32px] px-1 rounded-[10px] dreamina-levitation flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => setCanvasToolMode('select')}
            title="Select & Marquee Tool (V)"
            className={`w-6 h-6 rounded-[7px] flex items-center justify-center transition-colors ${
              canvasToolMode === 'select'
                ? 'bg-[#303030] text-white'
                : 'text-white/60 hover:text-white hover:bg-[#252525]'
            }`}
          >
            <MousePointer2 className="w-3.5 h-3.5" strokeWidth={1.5} />
          </button>
          <button
            type="button"
            onClick={() => setCanvasToolMode('hand')}
            title="Hand Pan Tool (H / Space)"
            className={`w-6 h-6 rounded-[7px] flex items-center justify-center transition-colors ${
              canvasToolMode === 'hand'
                ? 'bg-[#303030] text-white'
                : 'text-white/60 hover:text-white hover:bg-[#252525]'
            }`}
          >
            <Hand className="w-3.5 h-3.5" strokeWidth={1.5} />
          </button>

          <div className="w-px h-3.5 bg-white/[0.08] mx-0.5" />

          <button
            type="button"
            onClick={toggleMinimap}
            title="Toggle minimap"
            className={`w-6 h-6 rounded-[7px] flex items-center justify-center transition-colors ${
              showMinimap
                ? 'bg-[#303030] text-white'
                : 'text-white/60 hover:text-white hover:bg-[#252525]'
            }`}
          >
            <MapIcon className="w-3.5 h-3.5" strokeWidth={1.5} />
          </button>

          <button
            type="button"
            onClick={toggleShowConnections}
            title="Toggle node connection wires"
            className={`w-6 h-6 rounded-[7px] flex items-center justify-center relative transition-colors ${
              showConnections
                ? 'text-white bg-[#252525]'
                : 'text-white/45 hover:text-white hover:bg-[#252525]'
            }`}
          >
            <GitBranch className="w-3.5 h-3.5" strokeWidth={1.5} />
            {showConnections && (
              <span className="w-1.5 h-1.5 rounded-full bg-[#20D5EC] absolute top-1 right-1" />
            )}
          </button>

          <div className="w-px h-3.5 bg-white/[0.08] mx-0.5" />

          <button
            type="button"
            onClick={() => handleZoomDelta(-0.1)}
            title="Zoom out"
            className="w-6 h-6 rounded-[7px] hover:bg-[#252525] flex items-center justify-center text-white/65 hover:text-white"
          >
            <Minus className="w-3 h-3" strokeWidth={1.5} />
          </button>
          <button
            type="button"
            onClick={() => fitAllNodesInViewport()}
            title="Fit all nodes in viewport"
            className="px-1.5 h-6 rounded-[6px] hover:bg-[#252525] font-mono text-[11.5px] tabular-nums text-white/80 hover:text-white"
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            type="button"
            onClick={() => handleZoomDelta(0.1)}
            title="Zoom in"
            className="w-6 h-6 rounded-[7px] hover:bg-[#252525] flex items-center justify-center text-white/65 hover:text-white"
          >
            <Plus className="w-3 h-3" strokeWidth={1.5} />
          </button>
        </div>
      </div>

      {/* 4. Bottom-Right Dreamina "Chats" Pill + Collapsible Director Assistant Drawer */}
      <div className="fixed right-[16px] bottom-[14px] z-30 flex flex-col items-end gap-2 select-none">
        {chatDrawerOpen && (
          <div className="w-[380px] h-[490px] rounded-[16px] dreamina-menu flex flex-col overflow-hidden">
            <div className="h-[44px] px-3.5 border-b border-white/[0.08] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-white/75" strokeWidth={1.5} />
                <span className="text-[12.5px] font-medium text-white/95">
                  Canvas Director Chat
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setChatDrawerOpen(false);
                    setDirectorModalOpen(true);
                  }}
                  className="h-6 px-2 rounded-[6px] bg-[#252525] hover:bg-[#303030] text-[11px] text-white/80"
                >
                  Auto-Storyboard
                </button>
                <button
                  type="button"
                  onClick={() => setChatDrawerOpen(false)}
                  className="w-6 h-6 rounded-[6px] hover:bg-white/[0.08] flex items-center justify-center text-white/60 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" strokeWidth={1.5} />
                </button>
              </div>
            </div>

            {/* Quick-Action Director Chips */}
            <div className="px-2.5 py-2 border-b border-white/[0.06] bg-[#161616] flex items-center gap-1.5 overflow-x-auto shrink-0">
              {(
                [
                  { id: 'sequence-3', label: '+ 3-Shot Sequence' },
                  { id: 'remix-branch', label: 'Branch Multi-Turn Remix' },
                  { id: 'slice-sheet', label: 'Slice Active Sheet' },
                  { id: 'compile-master', label: 'Compile Master .mp4' },
                ] as const
              ).map((chip) => (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => void runChatQuickAction(chip.id)}
                  className="h-6 px-2.5 rounded-full bg-[#242424] hover:bg-white hover:text-[#0e0e0e] border border-white/[0.08] text-[10.5px] font-medium text-white/85 whitespace-nowrap shrink-0 transition-colors"
                >
                  {chip.label}
                </button>
              ))}
            </div>

            <div className="flex-1 p-3 overflow-y-auto space-y-2.5">
              {chatMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${
                    msg.role === 'user' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  <div
                    className={`max-w-[88%] px-3 py-2 rounded-[12px] text-[12px] leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-white text-[#0e0e0e] font-medium'
                        : 'bg-[#252525] text-white/90 border border-white/[0.06]'
                    }`}
                  >
                    <div>{msg.text}</div>

                    {msg.videoUrl && (
                      <video
                        src={msg.videoUrl}
                        controls
                        playsInline
                        muted
                        className="w-full rounded-[8px] mt-2 border border-white/10 bg-black aspect-video object-cover"
                      />
                    )}

                    {msg.nodeFocusPills && msg.nodeFocusPills.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2 pt-1.5 border-t border-white/[0.08]">
                        {msg.nodeFocusPills.map((pill) => (
                          <button
                            key={pill.nodeId}
                            type="button"
                            onClick={() => {
                              const target = nodes.find((n) => n.id === pill.nodeId);
                              if (!target) return;
                              selectNodes([target.id]);
                              setViewport(
                                window.innerWidth / 2 -
                                  (target.x + target.width / 2) * zoom,
                                window.innerHeight / 2 -
                                  (target.y + target.height / 2) * zoom,
                                zoom
                              );
                            }}
                            className="h-6 px-2 rounded-[6px] bg-[#191919] hover:bg-white hover:text-[#0e0e0e] border border-white/[0.1] text-[10.5px] font-medium text-[#20D5EC] hover:border-white transition-colors truncate max-w-full"
                          >
                            Focus · {pill.title}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!chatInput.trim()) return;
                const text = chatInput;
                setChatInput('');
                void sendChatAssistantPrompt(text);
              }}
              className="p-2.5 border-t border-white/[0.08] flex items-center gap-2 bg-[#161616]"
            >
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Ask Director to spawn a shot, sequence, or 9-grid…"
                className="flex-1 h-8 px-3 rounded-[9px] bg-[#252525] text-[12px] text-white placeholder:text-white/35 outline-none border border-white/[0.06] focus:border-white/25"
              />
              <button
                type="button"
                onClick={() => {
                  if (!chatInput.trim()) return;
                  const text = chatInput;
                  setChatInput('');
                  void sendChatAssistantPrompt(text);
                }}
                className="w-8 h-8 rounded-full bg-white hover:bg-[#e5e5e5] text-[#0e0e0e] flex items-center justify-center shrink-0"
              >
                <ArrowUp className="w-3.5 h-3.5" strokeWidth={2} />
              </button>
            </form>
          </div>
        )}

        <button
          type="button"
          onClick={() => setChatDrawerOpen(!chatDrawerOpen)}
          className="h-[36px] px-3.5 rounded-full bg-[#1f1f1f] hover:bg-[#282828] border border-white/[0.1] shadow-[0_8px_24px_rgba(0,0,0,0.65)] text-[12.5px] font-medium text-white/90 flex items-center gap-2 transition-colors"
        >
          <MessageSquare className="w-3.5 h-3.5 text-white/80" strokeWidth={1.5} />
          <span>Chats</span>
        </button>
      </div>

      {/* 5. Search Modal */}
      {searchModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm flex items-start justify-center pt-[12vh]"
          onClick={() => setSearchModalOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-[480px] rounded-[16px] dreamina-menu overflow-hidden"
          >
            <div className="h-[46px] px-3.5 border-b border-white/[0.08] flex items-center gap-2.5">
              <Search className="w-4 h-4 text-white/45" strokeWidth={1.5} />
              <input
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Jump to canvas node by title, @element, or prompt…"
                className="flex-1 bg-transparent text-[13px] text-white placeholder:text-white/35 outline-none"
              />
              <button
                type="button"
                onClick={() => setSearchModalOpen(false)}
                className="text-[11px] font-mono text-white/40 px-1.5 py-0.5 rounded bg-white/[0.06]"
              >
                ESC
              </button>
            </div>
            <div className="max-h-[300px] overflow-y-auto p-1.5 space-y-0.5">
              {filteredNodes.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => {
                    selectNodes([n.id]);
                    setViewport(
                      window.innerWidth / 2 - (n.x + n.width / 2) * zoom,
                      window.innerHeight / 2 - (n.y + n.height / 2) * zoom,
                      zoom
                    );
                    setSearchModalOpen(false);
                  }}
                  className="w-full px-3 py-2 rounded-[9px] hover:bg-white/[0.08] text-left flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="text-[12.5px] font-medium text-white/90 truncate">
                      {n.title}
                    </div>
                    <div className="text-[11px] text-white/45 truncate">
                      {n.prompt}
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-[5px] bg-[#252525] text-[10px] uppercase text-white/60 shrink-0">
                    {n.kind}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 6. Autonomous Storyboard Director Modal */}
      {directorModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => !directorRunning && setDirectorModalOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-[540px] rounded-[16px] dreamina-menu p-5 space-y-4"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wand2 className="w-4 h-4 text-white/80" strokeWidth={1.5} />
                <h3 className="text-[14px] font-semibold text-white">
                  Autonomous Storyboard Director
                </h3>
              </div>
              <button
                type="button"
                disabled={directorRunning}
                onClick={() => setDirectorModalOpen(false)}
                className="w-7 h-7 rounded-[7px] hover:bg-white/[0.08] flex items-center justify-center text-white/60 hover:text-white"
              >
                <X className="w-4 h-4" strokeWidth={1.5} />
              </button>
            </div>

            <p className="text-[12px] text-white/55 leading-relaxed">
              Describe a commercial or short scene. Director locks @Elements, lays
              out connected keyframe & video nodes on the spatial canvas, and
              populates Timelines 1 automatically.
            </p>

            <textarea
              value={directorBrief}
              onChange={(e) => setDirectorBrief(e.target.value)}
              rows={3}
              className="w-full p-3 rounded-[10px] bg-[#141414] border border-white/[0.08] focus:border-white/25 text-[12.5px] text-white outline-none resize-none"
            />

            {directorStepLog.length > 0 && (
              <div className="p-3 rounded-[10px] bg-[#141414] border border-white/[0.06] space-y-1 max-h-[140px] overflow-y-auto font-mono text-[11px] text-white/70">
                {directorStepLog.map((line, i) => (
                  <div key={i}>{line}</div>
                ))}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                disabled={directorRunning}
                onClick={() => setDirectorModalOpen(false)}
                className="h-8 px-3.5 rounded-[8px] bg-[#252525] hover:bg-[#2e2e2e] text-[12px] text-white/80"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={directorRunning || !directorBrief.trim()}
                onClick={() => void runAutonomousDirectorAgent(directorBrief)}
                className="h-8 px-4 rounded-[8px] bg-white hover:bg-[#e5e5e5] text-[#0e0e0e] text-[12px] font-semibold flex items-center gap-1.5 disabled:opacity-50"
              >
                {directorRunning ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={1.75} />
                ) : (
                  <Wand2 className="w-3.5 h-3.5" strokeWidth={1.75} />
                )}
                <span>{directorRunning ? 'Directing Scene…' : 'Build Scene Graph'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. 3D Camera Director Modal */}
      {cameraDirectorOpen && <CameraDirector3DModal />}
    </>
  );
};

const CameraDirector3DModal: React.FC = () => {
  const setCameraDirectorOpen = useStudioStore((s) => s.setCameraDirectorOpen);
  const injectCameraPromptToSelection = useStudioStore(
    (s) => s.injectCameraPromptToSelection
  );

  const [azimuth, setAzimuth] = useState(32);
  const [elevation, setElevation] = useState(18);
  const [focalMm, setFocalMm] = useState<16 | 24 | 35 | 50 | 85>(35);
  const [shotFraming, setShotFraming] = useState<
    'Close-Up' | 'Medium Shot' | 'Wide Anamorphic' | 'Low-Angle Hero'
  >('Low-Angle Hero');

  const stageCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const draggingRef = useRef<{ startX: number; startY: number; az: number; el: number } | null>(
    null
  );

  useEffect(() => {
    const canvas = stageCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#121212';
    ctx.fillRect(0, 0, w, h);

    const cx = w / 2;
    const cy = h * 0.56;
    const radAz = (azimuth * Math.PI) / 180;
    const radEl = (elevation * Math.PI) / 180;

    const project = (x: number, y: number, z: number) => {
      const rx = x * Math.cos(radAz) - z * Math.sin(radAz);
      const rz = x * Math.sin(radAz) + z * Math.cos(radAz);
      const ry = y * Math.cos(radEl) - rz * Math.sin(radEl);
      const depth = y * Math.sin(radEl) + rz * Math.cos(radEl) + 420;
      const scale = 340 / Math.max(120, depth);
      return { sx: cx + rx * scale, sy: cy - ry * scale };
    };

    // Draw 3D ground grid
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    for (let g = -160; g <= 160; g += 40) {
      const p1 = project(g, 0, -160);
      const p2 = project(g, 0, 160);
      ctx.beginPath();
      ctx.moveTo(p1.sx, p1.sy);
      ctx.lineTo(p2.sx, p2.sy);
      ctx.stroke();

      const q1 = project(-160, 0, g);
      const q2 = project(160, 0, g);
      ctx.beginPath();
      ctx.moveTo(q1.sx, q1.sy);
      ctx.lineTo(q2.sx, q2.sy);
      ctx.stroke();
    }

    // Subject monolith / character marker at origin
    const base = project(0, 0, 0);
    const head = project(0, 82, 0);
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(base.sx, base.sy);
    ctx.lineTo(head.sx, head.sy);
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(head.sx, head.sy - 8, 7, 0, Math.PI * 2);
    ctx.fill();

    // Orbit ring & camera frustum indicator
    ctx.strokeStyle = 'rgba(32, 213, 236, 0.35)';
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    for (let deg = 0; deg <= 360; deg += 8) {
      const r = (deg * Math.PI) / 180;
      const pt = project(Math.sin(r) * 135, 36, Math.cos(r) * 135);
      if (deg === 0) ctx.moveTo(pt.sx, pt.sy);
      else ctx.lineTo(pt.sx, pt.sy);
    }
    ctx.stroke();

    const camPos = project(0, 42 + elevation * 0.9, 135);
    ctx.strokeStyle = '#20D5EC';
    ctx.lineWidth = 1.75;
    ctx.beginPath();
    ctx.moveTo(camPos.sx, camPos.sy);
    ctx.lineTo(head.sx - 18, head.sy + 12);
    ctx.moveTo(camPos.sx, camPos.sy);
    ctx.lineTo(head.sx + 18, head.sy + 12);
    ctx.stroke();

    ctx.fillStyle = '#20D5EC';
    ctx.beginPath();
    ctx.arc(camPos.sx, camPos.sy, 5.5, 0, Math.PI * 2);
    ctx.fill();
  }, [azimuth, elevation, focalMm]);

  const summaryDescriptor = `${shotFraming}, ${focalMm}mm cinema prime, ${azimuth}° azimuth orbit, ${elevation >= 0 ? `+${elevation}°` : `${elevation}°`} elevation`;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 select-none"
      onClick={() => setCameraDirectorOpen(false)}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-[620px] rounded-[16px] dreamina-menu overflow-hidden"
      >
        <div className="h-[46px] px-4 border-b border-white/[0.08] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Compass className="w-4 h-4 text-white/80" strokeWidth={1.5} />
            <span className="text-[13px] font-semibold text-white">
              3D Camera Director Console
            </span>
          </div>
          <button
            type="button"
            onClick={() => setCameraDirectorOpen(false)}
            className="w-7 h-7 rounded-[7px] hover:bg-white/[0.08] flex items-center justify-center text-white/60 hover:text-white"
          >
            <X className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="relative rounded-[12px] overflow-hidden border border-white/[0.08] bg-[#121212]">
            <canvas
              ref={stageCanvasRef}
              width={588}
              height={250}
              onPointerDown={(e) => {
                draggingRef.current = {
                  startX: e.clientX,
                  startY: e.clientY,
                  az: azimuth,
                  el: elevation,
                };
                const onMove = (ev: PointerEvent) => {
                  if (!draggingRef.current) return;
                  const dx = ev.clientX - draggingRef.current.startX;
                  const dy = ev.clientY - draggingRef.current.startY;
                  setAzimuth(
                    Math.max(-180, Math.min(180, Math.round(draggingRef.current.az + dx * 0.7)))
                  );
                  setElevation(
                    Math.max(-35, Math.min(70, Math.round(draggingRef.current.el - dy * 0.45)))
                  );
                };
                const onUp = () => {
                  draggingRef.current = null;
                  window.removeEventListener('pointermove', onMove);
                  window.removeEventListener('pointerup', onUp);
                };
                window.addEventListener('pointermove', onMove);
                window.addEventListener('pointerup', onUp);
              }}
              className="w-full h-[250px] cursor-grab active:cursor-grabbing block"
            />
            <div className="absolute bottom-2.5 left-3 right-3 flex items-center justify-between pointer-events-none">
              <span className="px-2 py-0.5 rounded-[6px] bg-black/65 text-[11px] text-white/75 font-mono">
                Drag stage to orbit camera · {summaryDescriptor}
              </span>
            </div>
          </div>

          {/* Focal Length + Shot Framing Controls */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-[11px] text-white/45 mb-1.5">
                Focal Length (Prime Lens)
              </div>
              <div className="grid grid-cols-5 gap-1">
                {([16, 24, 35, 50, 85] as const).map((mm) => (
                  <button
                    key={mm}
                    type="button"
                    onClick={() => setFocalMm(mm)}
                    className={`h-7 rounded-[7px] text-[11.5px] font-mono transition-colors ${
                      focalMm === mm
                        ? 'bg-white text-[#0e0e0e] font-semibold'
                        : 'bg-[#252525] text-white/75 hover:bg-[#303030]'
                    }`}
                  >
                    {mm}mm
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="text-[11px] text-white/45 mb-1.5">Shot Framing</div>
              <div className="grid grid-cols-2 gap-1">
                {(
                  [
                    'Low-Angle Hero',
                    'Close-Up',
                    'Medium Shot',
                    'Wide Anamorphic',
                  ] as const
                ).map((sf) => (
                  <button
                    key={sf}
                    type="button"
                    onClick={() => setShotFraming(sf)}
                    className={`h-7 px-2 rounded-[7px] text-[11px] truncate transition-colors ${
                      shotFraming === sf
                        ? 'bg-white text-[#0e0e0e] font-semibold'
                        : 'bg-[#252525] text-white/75 hover:bg-[#303030]'
                    }`}
                  >
                    {sf}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              onClick={() => {
                setAzimuth(0);
                setElevation(12);
                setFocalMm(35);
              }}
              className="h-8 px-3 rounded-[8px] bg-[#252525] hover:bg-[#2e2e2e] text-[12px] text-white/75"
            >
              Reset Rig
            </button>
            <button
              type="button"
              onClick={() => {
                injectCameraPromptToSelection(summaryDescriptor);
                setCameraDirectorOpen(false);
              }}
              className="h-8 px-4 rounded-[8px] bg-white hover:bg-[#e5e5e5] text-[#0e0e0e] text-[12px] font-semibold"
            >
              Apply Camera Rig
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
