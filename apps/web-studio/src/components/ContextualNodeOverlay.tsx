import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowUp,
  AtSign,
  AudioLines,
  Check,
  ChevronDown,
  Clapperboard,
  Copy,
  Eraser,
  Film,
  GitBranch,
  Image as ImageIcon,
  Link2,
  Loader2,
  Maximize2,
  Paintbrush,
  Play,
  Plus,
  Scissors,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Upload,
  UserSquare2,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import type {
  AspectRatio,
  ConnectionTransport,
  PlatformId,
  ResolutionTier,
} from '../types/studio';
import {
  ELEVENLABS_VOICES,
  getModelsForPlatformAndModality,
  getPlatformConnectionStatus,
  getPlatformsForModality,
  nodeKindToModality,
} from '../presets/platformCatalog';
import { useStudioStore } from '../store/useStudioStore';
import { SmartMediaImage } from './SmartMedia';

const IMAGE_ASPECTS: AspectRatio[] = ['16:9', '1:1', '9:16', '4:3', '3:4', '21:9'];
const VIDEO_ASPECTS: AspectRatio[] = ['16:9', '9:16', '1:1', '21:9'];
const IMAGE_RESOLUTIONS: ResolutionTier[] = ['1K', '2K', '4K'];
const VIDEO_RESOLUTIONS: ResolutionTier[] = ['720p', '1080p', '4K'];
const VIDEO_DURATIONS = [5, 8, 10, 15];
const AUDIO_DURATIONS = [5, 8, 10, 15];
const BATCH_COUNTS: Array<1 | 2 | 4> = [1, 2, 4];

const TRANSPORT_OPTIONS: Array<{
  id: ConnectionTransport;
  label: string;
  hint: string;
}> = [
  { id: 'auto', label: 'Auto (Best Available)', hint: 'MCP → Browser Credits → API Key' },
  { id: 'mcp', label: 'MCP Server Credits', hint: 'Route via connected MCP server' },
  { id: 'browser-bridge', label: 'Browser Session Credits', hint: 'Logged-in web tab via Chrome Bridge' },
  { id: 'api-key', label: 'Direct API Key ($0 Markup)', hint: 'Raw BYOK provider call' },
];

export const ContextualNodeOverlay: React.FC = () => {
  const nodes = useStudioStore((s) => s.nodes);
  const edges = useStudioStore((s) => s.edges);
  const selectedNodeIds = useStudioStore((s) => s.selectedNodeIds);
  const panX = useStudioStore((s) => s.panX);
  const panY = useStudioStore((s) => s.panY);
  const zoom = useStudioStore((s) => s.zoom);

  const elements = useStudioStore((s) => s.elements);
  const byok = useStudioStore((s) => s.byok);
  const chromeBridge = useStudioStore((s) => s.chromeBridge);
  const platformsCatalog = useStudioStore((s) => s.platformsCatalog);
  const externalMcpServers = useStudioStore((s) => s.externalMcpServers);
  const lastImagePlatformId = useStudioStore((s) => s.lastImagePlatformId);
  const lastVideoPlatformId = useStudioStore((s) => s.lastVideoPlatformId);
  const lastAudioPlatformId = useStudioStore((s) => s.lastAudioPlatformId);
  const lastFailedPlatformId = useStudioStore((s) => s.lastFailedPlatformId);
  const workflowRunning = useStudioStore((s) => s.workflowRunning);

  const updateNodeFields = useStudioStore((s) => s.updateNodeFields);
  const setNodePlatformAndModel = useStudioStore((s) => s.setNodePlatformAndModel);
  const setNodeAspectRatio = useStudioStore((s) => s.setNodeAspectRatio);
  const uploadReferenceToNode = useStudioStore((s) => s.uploadReferenceToNode);
  const attachReferenceToNode = useStudioStore((s) => s.attachReferenceToNode);
  const removeReferenceUrlFromNode = useStudioStore((s) => s.removeReferenceUrlFromNode);
  const saveNodeAsElementReference = useStudioStore((s) => s.saveNodeAsElementReference);
  const generateSingleNode = useStudioStore((s) => s.generateSingleNode);
  const runWorkflowPipeline = useStudioStore((s) => s.runWorkflowPipeline);
  const spawnDreaminaNodeAt = useStudioStore((s) => s.spawnDreaminaNodeAt);
  const connectNodes = useStudioStore((s) => s.connectNodes);
  const duplicateNodes = useStudioStore((s) => s.duplicateNodes);
  const deleteSelectedNodes = useStudioStore((s) => s.deleteSelectedNodes);
  const openInlineEditor = useStudioStore((s) => s.openInlineEditor);
  const removeBgAndDecomposeLayers = useStudioStore((s) => s.removeBgAndDecomposeLayers);
  const upscaleNodeHd = useStudioStore((s) => s.upscaleNodeHd);
  const extractLastFrameToNextShot = useStudioStore((s) => s.extractLastFrameToNextShot);
  const sendNodeToTimeline = useStudioStore((s) => s.sendNodeToTimeline);
  const openProviderModal = useStudioStore((s) => s.openProviderModal);

  const [openMenu, setOpenMenu] = useState<
    | null
    | 'platform'
    | 'model'
    | 'aspect'
    | 'resolution'
    | 'duration'
    | 'batch'
    | 'voice'
    | 'advanced'
    | 'add-ref'
  >(null);
  const [atAutocompleteOpen, setAtAutocompleteOpen] = useState(false);

  const refUploadInputRef = useRef<HTMLInputElement | null>(null);
  const directCardUploadInputRef = useRef<HTMLInputElement | null>(null);

  const selectedNode = useMemo(() => {
    if (selectedNodeIds.length !== 1) return null;
    return nodes.find((n) => n.id === selectedNodeIds[0]) || null;
  }, [nodes, selectedNodeIds]);

  useEffect(() => {
    setOpenMenu(null);
    setAtAutocompleteOpen(false);
  }, [selectedNode?.id]);

  if (!selectedNode) return null;

  const modality = nodeKindToModality(selectedNode.kind);
  const hasMedia = Boolean(
    selectedNode.imageUrl || selectedNode.videoUrl || selectedNode.audioUrl
  );

  // Screen-space anchor coordinates of the selected node
  const nodeLeftScreen = panX + selectedNode.x * zoom;
  const nodeTopScreen = panY + selectedNode.y * zoom;
  const nodeWidthScreen = selectedNode.width * zoom;
  const nodeBottomScreen = nodeTopScreen + selectedNode.height * zoom;
  const centerScreenX = nodeLeftScreen + nodeWidthScreen / 2;

  const quickBarLeft = Math.max(
    220,
    Math.min(window.innerWidth - 220, centerScreenX)
  );
  const quickBarTop = Math.max(58, nodeTopScreen - 56);

  const popoverWidth = Math.min(688, window.innerWidth - 96);
  const popoverLeft = Math.max(
    72,
    Math.min(window.innerWidth - popoverWidth - 20, centerScreenX - popoverWidth / 2)
  );
  const popoverTop = Math.min(
    window.innerHeight - 238,
    Math.max(96, nodeBottomScreen + 18)
  );

  // Wired upstream & downstream inspection
  const upstreamNodes = edges
    .filter((e) => e.targetId === selectedNode.id)
    .map((e) => nodes.find((n) => n.id === e.sourceId))
    .filter((n): n is NonNullable<typeof n> => Boolean(n));

  const upstreamRefNodes = upstreamNodes.filter(
    (n) => n.kind === 'image' || n.kind === 'element' || n.kind === 'contact-sheet'
  );

  const hasDownstreamEdges = edges.some((e) => e.sourceId === selectedNode.id);

  // Linkable canvas image/element nodes not yet wired into selectedNode
  const linkableCanvasImageNodes = nodes.filter(
    (n) =>
      n.id !== selectedNode.id &&
      (n.kind === 'image' || n.kind === 'element' || n.kind === 'contact-sheet') &&
      !edges.some((e) => e.sourceId === n.id && e.targetId === selectedNode.id)
  );

  // Resolve active platform & model for generatable nodes
  const effectivePlatformId: PlatformId =
    selectedNode.platformId ||
    (modality === 'video'
      ? lastVideoPlatformId
      : modality === 'audio'
      ? lastAudioPlatformId
      : lastImagePlatformId);

  const availablePlatforms = modality
    ? getPlatformsForModality(modality, platformsCatalog)
    : [];

  const activePlatformDef =
    availablePlatforms.find((p) => p.id === effectivePlatformId) ||
    availablePlatforms[0];

  const availableModels = modality
    ? getModelsForPlatformAndModality(
        activePlatformDef?.id || effectivePlatformId,
        modality,
        platformsCatalog,
        externalMcpServers
      )
    : [];

  const activeModelDef =
    availableModels.find((m) => m.id === selectedNode.modelId) ||
    availableModels[0];

  const activeConnStatus = activePlatformDef
    ? getPlatformConnectionStatus(
        activePlatformDef.id,
        byok,
        chromeBridge,
        externalMcpServers,
        activePlatformDef
      )
    : { connected: false, transports: [], summary: 'Connect Credits' };

  const activeVoice =
    ELEVENLABS_VOICES.find((v) => v.id === (selectedNode.voiceId || 'JBFqnCBsd6RMkjVDRZzb')) ||
    ELEVENLABS_VOICES[0];

  const isGenerating = selectedNode.status === 'generating';

  const handlePromptChange = (val: string) => {
    updateNodeFields(selectedNode.id, { prompt: val });
    if (val.endsWith('@') && elements.length > 0) {
      setAtAutocompleteOpen(true);
    } else if (!val.includes('@') || val.endsWith(' ')) {
      setAtAutocompleteOpen(false);
    }
  };

  return (
    <>
      {/* Hidden file inputs */}
      <input
        ref={refUploadInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) {
            void attachReferenceToNode(selectedNode.id, f);
            e.target.value = '';
          }
          setOpenMenu(null);
        }}
      />
      <input
        ref={directCardUploadInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) {
            void uploadReferenceToNode(selectedNode.id, f);
            e.target.value = '';
          }
        }}
      />

      {/* 1. Floating Top Quick-Action Pill Bar */}
      {selectedNode.kind !== 'timeline' && (
        <div
          style={{
            left: `${quickBarLeft}px`,
            top: `${quickBarTop}px`,
            transform: 'translateX(-50%)',
          }}
          onPointerDown={(e) => e.stopPropagation()}
          className="fixed z-40 h-9 px-1.5 rounded-[10px] dreamina-levitation flex items-center gap-1 text-[11.5px] select-none"
        >
          {(selectedNode.kind === 'image' ||
            selectedNode.kind === 'element' ||
            selectedNode.kind === 'contact-sheet') &&
            hasMedia && (
              <>
                <button
                  type="button"
                  onClick={() => saveNodeAsElementReference(selectedNode.id)}
                  className="h-7 px-2.5 rounded-[7px] hover:bg-white/[0.08] text-white/90 flex items-center gap-1.5"
                  title="Register this image as a reusable @Element reference tag"
                >
                  <UserSquare2 className="w-3.5 h-3.5 text-[#20D5EC]" strokeWidth={1.6} />
                  <span>Save @Ref</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    spawnDreaminaNodeAt(
                      'video',
                      selectedNode.x + selectedNode.width + 130,
                      selectedNode.y - 20,
                      {
                        wireFromNodeId: selectedNode.id,
                        wireDirection: 'right',
                      }
                    );
                  }}
                  className="h-7 px-2.5 rounded-[7px] bg-white/[0.08] hover:bg-white/[0.15] text-white font-medium flex items-center gap-1.5"
                  title="Spawn a connected Video node using this image as Reference"
                >
                  <Clapperboard className="w-3.5 h-3.5 text-[#20D5EC]" strokeWidth={1.6} />
                  <span>→ Create Video</span>
                </button>

                <div className="w-px h-4 bg-white/[0.08] mx-0.5" />

                <button
                  type="button"
                  onClick={() => openInlineEditor('inpaint', selectedNode.id)}
                  className="h-7 px-2 rounded-[7px] hover:bg-white/[0.08] text-white/80 flex items-center gap-1"
                >
                  <Paintbrush className="w-3.5 h-3.5 text-white/60" strokeWidth={1.5} />
                  <span>Inpaint</span>
                </button>

                <button
                  type="button"
                  onClick={() => openInlineEditor('outpaint', selectedNode.id)}
                  className="h-7 px-2 rounded-[7px] hover:bg-white/[0.08] text-white/80 flex items-center gap-1"
                >
                  <Maximize2 className="w-3.5 h-3.5 text-white/60" strokeWidth={1.5} />
                  <span>Expand</span>
                </button>

                <button
                  type="button"
                  onClick={() => void removeBgAndDecomposeLayers(selectedNode.id)}
                  className="h-7 px-2 rounded-[7px] hover:bg-white/[0.08] text-white/80 flex items-center gap-1"
                >
                  <Eraser className="w-3.5 h-3.5 text-white/60" strokeWidth={1.5} />
                  <span>Cutout</span>
                </button>

                <button
                  type="button"
                  onClick={() => void upscaleNodeHd(selectedNode.id, '4K')}
                  className="h-7 px-2 rounded-[7px] hover:bg-white/[0.08] text-white/80 flex items-center gap-1"
                >
                  <Sparkles className="w-3.5 h-3.5 text-white/60" strokeWidth={1.5} />
                  <span>4K</span>
                </button>

                <div className="w-px h-4 bg-white/[0.08] mx-0.5" />
              </>
            )}

          {(selectedNode.kind === 'image' || selectedNode.kind === 'element') &&
            !hasMedia && (
              <>
                <button
                  type="button"
                  onClick={() => directCardUploadInputRef.current?.click()}
                  className="h-7 px-2.5 rounded-[7px] hover:bg-white/[0.08] text-white/85 flex items-center gap-1.5"
                >
                  <Upload className="w-3.5 h-3.5 text-white/65" strokeWidth={1.5} />
                  <span>Upload Image</span>
                </button>
                <div className="w-px h-4 bg-white/[0.08] mx-0.5" />
              </>
            )}

          {selectedNode.kind === 'video' && hasMedia && (
            <>
              <button
                type="button"
                onClick={() => void extractLastFrameToNextShot(selectedNode.id)}
                className="h-7 px-2.5 rounded-[7px] hover:bg-white/[0.08] text-white/85 flex items-center gap-1.5"
              >
                <Scissors className="w-3.5 h-3.5 text-white/65" strokeWidth={1.5} />
                <span>Last Frame → Next Shot</span>
              </button>
              <button
                type="button"
                onClick={() => sendNodeToTimeline(selectedNode.id)}
                className="h-7 px-2.5 rounded-[7px] hover:bg-white/[0.08] text-white/85 flex items-center gap-1.5"
              >
                <Film className="w-3.5 h-3.5 text-white/65" strokeWidth={1.5} />
                <span>To Timeline</span>
              </button>
              <div className="w-px h-4 bg-white/[0.08] mx-0.5" />
            </>
          )}

          {selectedNode.kind === 'audio' && hasMedia && (
            <>
              <button
                type="button"
                onClick={() => sendNodeToTimeline(selectedNode.id)}
                className="h-7 px-2.5 rounded-[7px] hover:bg-white/[0.08] text-white/85 flex items-center gap-1.5"
              >
                <Film className="w-3.5 h-3.5 text-white/65" strokeWidth={1.5} />
                <span>Send to Timeline (A1)</span>
              </button>
              <div className="w-px h-4 bg-white/[0.08] mx-0.5" />
            </>
          )}

          <button
            type="button"
            onClick={() => duplicateNodes(selectedNode.id)}
            className="h-7 px-2 rounded-[7px] hover:bg-white/[0.08] text-white/75 flex items-center gap-1"
            title="Duplicate node (⌘D)"
          >
            <Copy className="w-3.5 h-3.5" strokeWidth={1.5} />
          </button>

          <button
            type="button"
            onClick={() => deleteSelectedNodes(selectedNode.id)}
            className="h-7 px-2 rounded-[7px] hover:bg-red-500/15 text-red-400 flex items-center gap-1"
            title="Delete node"
          >
            <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
          </button>
        </div>
      )}

      {/* 2. Modality-Locked Creation Bar ([Where] + [Model] + [Settings] + [References] + [Generate]) */}
      {modality && (
        <div
          style={{
            left: `${popoverLeft}px`,
            top: `${popoverTop}px`,
            width: `${popoverWidth}px`,
          }}
          onPointerDown={(e) => e.stopPropagation()}
          className="fixed z-40 rounded-[16px] dreamina-levitation p-3 space-y-2.5 select-none"
        >
          {/* Top Strip: Modality Header + Live Wired / Uploaded References */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="px-2 py-0.5 rounded-[6px] bg-[#252525] border border-white/[0.07] text-[11px] font-medium text-white/85 flex items-center gap-1.5">
                {modality === 'video' ? (
                  <Clapperboard className="w-3 h-3 text-[#20D5EC]" strokeWidth={1.75} />
                ) : modality === 'audio' ? (
                  <AudioLines className="w-3 h-3 text-[#20D5EC]" strokeWidth={1.75} />
                ) : selectedNode.kind === 'element' ? (
                  <UserSquare2 className="w-3 h-3 text-[#20D5EC]" strokeWidth={1.75} />
                ) : (
                  <ImageIcon className="w-3 h-3 text-[#20D5EC]" strokeWidth={1.75} />
                )}
                <span>
                  {selectedNode.kind === 'element'
                    ? `Create Reference (${selectedNode.elementHandles[0] || '@Ref_1'})`
                    : modality === 'video'
                    ? 'Create Video'
                    : modality === 'audio'
                    ? 'Create Voice / SFX'
                    : 'Create Image'}
                </span>
              </span>

              {/* Wired Upstream Reference Chips */}
              {modality !== 'audio' &&
                upstreamRefNodes.map((up) => (
                  <div
                    key={up.id}
                    className="h-6 pl-1 pr-2 rounded-[6px] bg-[#252525] border border-[#20D5EC]/35 flex items-center gap-1.5 text-[11px] text-white/90"
                    title={
                      up.imageUrl
                        ? `Wired reference from ${up.title}`
                        : `Waiting for ${up.title} to generate`
                    }
                  >
                    {up.imageUrl ? (
                      <SmartMediaImage
                        src={up.imageUrl}
                        alt={up.title}
                        className="w-4 h-4 rounded-[3px] object-cover"
                      />
                    ) : (
                      <span className="w-2 h-2 rounded-full bg-[#20D5EC]/70 ml-1" />
                    )}
                    <span className="truncate max-w-[110px]">{up.title}</span>
                    {!up.imageUrl && (
                      <span className="text-[10px] text-[#20D5EC]">Pending</span>
                    )}
                  </div>
                ))}

              {/* Attached Custom Reference Image Chips */}
              {modality !== 'audio' &&
                (selectedNode.referenceUrls || []).map((refUrl, idx) => (
                  <div
                    key={`${refUrl}_${idx}`}
                    className="h-6 pl-1 pr-1.5 rounded-[6px] bg-[#252525] border border-white/[0.12] flex items-center gap-1 text-[11px] text-white/85"
                  >
                    <SmartMediaImage
                      src={refUrl}
                      alt={`Ref ${idx + 1}`}
                      className="w-4 h-4 rounded-[3px] object-cover"
                    />
                    <span>Ref {idx + 1}</span>
                    <button
                      type="button"
                      onClick={() =>
                        removeReferenceUrlFromNode(selectedNode.id, refUrl)
                      }
                      className="text-white/45 hover:text-white ml-0.5"
                    >
                      <X className="w-3 h-3" strokeWidth={1.75} />
                    </button>
                  </div>
                ))}

              {/* + Add Reference Dropdown Button */}
              {modality !== 'audio' && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() =>
                      setOpenMenu(openMenu === 'add-ref' ? null : 'add-ref')
                    }
                    className="h-6 px-2 rounded-[6px] bg-[#252525] hover:bg-white/[0.1] border border-dashed border-white/[0.18] text-[11px] text-white/75 hover:text-white flex items-center gap-1 transition-colors"
                  >
                    <Plus className="w-3 h-3" strokeWidth={1.75} />
                    <span>Reference</span>
                  </button>

                  {openMenu === 'add-ref' && (
                    <div className="absolute bottom-full left-0 mb-1.5 w-[248px] p-1.5 rounded-[12px] dreamina-menu z-50 space-y-0.5 text-[12px]">
                      <button
                        type="button"
                        onClick={() => refUploadInputRef.current?.click()}
                        className="w-full h-8 px-2.5 rounded-[8px] hover:bg-white/[0.08] text-white/90 flex items-center gap-2 text-left"
                      >
                        <Upload className="w-3.5 h-3.5 text-white/65" strokeWidth={1.5} />
                        <span>Upload reference image…</span>
                      </button>

                      {linkableCanvasImageNodes.length > 0 && (
                        <>
                          <div className="my-1 h-px bg-white/[0.07]" />
                          <div className="px-2.5 py-0.5 text-[10.5px] text-white/40 uppercase tracking-wider">
                            Link Canvas Node
                          </div>
                          {linkableCanvasImageNodes.slice(0, 6).map((cn) => (
                            <button
                              key={cn.id}
                              type="button"
                              onClick={() => {
                                connectNodes(cn.id, selectedNode.id, 'lineage');
                                setOpenMenu(null);
                              }}
                              className="w-full h-8 px-2.5 rounded-[8px] hover:bg-white/[0.08] text-white/90 flex items-center justify-between gap-2 text-left"
                            >
                              <span className="flex items-center gap-2 min-w-0">
                                <Link2
                                  className="w-3.5 h-3.5 text-[#20D5EC] shrink-0"
                                  strokeWidth={1.5}
                                />
                                <span className="truncate">{cn.title}</span>
                              </span>
                              <span className="text-[10px] text-white/40 shrink-0">
                                {cn.imageUrl ? 'Ready' : 'Idle'}
                              </span>
                            </button>
                          ))}
                        </>
                      )}

                      {elements.length > 0 && (
                        <>
                          <div className="my-1 h-px bg-white/[0.07]" />
                          <div className="px-2.5 py-0.5 text-[10.5px] text-white/40 uppercase tracking-wider">
                            Project @Elements
                          </div>
                          {elements.map((el) => (
                            <button
                              key={el.id}
                              type="button"
                              onClick={() => {
                                const nextPrompt = selectedNode.prompt.includes(el.handle)
                                  ? selectedNode.prompt
                                  : `${selectedNode.prompt}${
                                      selectedNode.prompt &&
                                      !selectedNode.prompt.endsWith(' ')
                                        ? ' '
                                        : ''
                                    }${el.handle} `;
                                updateNodeFields(selectedNode.id, {
                                  prompt: nextPrompt,
                                  elementHandles: Array.from(
                                    new Set([...selectedNode.elementHandles, el.handle])
                                  ),
                                });
                                setOpenMenu(null);
                              }}
                              className="w-full h-8 px-2.5 rounded-[8px] hover:bg-white/[0.08] text-white/90 flex items-center justify-between gap-2 text-left"
                            >
                              <span className="flex items-center gap-2 min-w-0">
                                <AtSign
                                  className="w-3.5 h-3.5 text-[#20D5EC] shrink-0"
                                  strokeWidth={1.5}
                                />
                                <span className="font-mono text-[11.5px] truncate">
                                  {el.handle}
                                </span>
                              </span>
                              <span className="text-[10px] text-white/45 shrink-0">
                                {el.references.length} ref
                              </span>
                            </button>
                          ))}
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Active Connection Badge */}
            <button
              type="button"
              onClick={() =>
                openProviderModal(
                  activeConnStatus.transports.includes('mcp')
                    ? 'mcp'
                    : activeConnStatus.transports.includes('browser-bridge')
                    ? 'bridge'
                    : 'byok',
                  effectivePlatformId
                )
              }
              className="h-6 px-2 rounded-[6px] bg-[#252525] hover:bg-white/[0.1] border border-white/[0.07] text-[10.5px] text-white/70 hover:text-white flex items-center gap-1.5 transition-colors"
              title="Configure MCP, Browser Session Credits, or Zero-Markup API Keys"
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  activeConnStatus.connected ? 'bg-[#10b981]' : 'bg-amber-400/80'
                }`}
              />
              <span>{activeConnStatus.summary}</span>
            </button>
          </div>

          {/* Prompt Input Area */}
          <div className="relative">
            <textarea
              rows={2}
              value={selectedNode.prompt}
              onChange={(e) => handlePromptChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  void generateSingleNode(selectedNode.id);
                }
              }}
              placeholder={
                selectedNode.kind === 'element'
                  ? 'Describe the character, product, or visual reference to create…'
                  : modality === 'video'
                  ? upstreamRefNodes.length > 0
                    ? `Describe how ${upstreamRefNodes[0].title} moves, camera motion & scene action…`
                    : 'Describe camera motion, subject action & scene dynamics…'
                  : modality === 'audio'
                  ? selectedNode.audioMode === 'sfx'
                    ? 'Describe the foley or ambient sound effect to generate…'
                    : 'Write the voiceover script or character dialogue…'
                  : 'Describe the image you want to create…'
              }
              className="w-full bg-[#141414] border border-white/[0.07] focus:border-white/[0.22] rounded-[10px] px-3 py-2 text-[13px] leading-relaxed text-white placeholder:text-white/32 resize-none outline-none select-text"
            />

            {/* Inline @Element Autocomplete (ONLY when active project actually has elements!) */}
            {atAutocompleteOpen && elements.length > 0 && (
              <div className="absolute bottom-full left-2 mb-1.5 w-[240px] p-1.5 rounded-[11px] dreamina-menu z-50 space-y-0.5">
                {elements.map((el) => (
                  <button
                    key={el.id}
                    type="button"
                    onClick={() => {
                      const nextPrompt = selectedNode.prompt.replace(
                        /@$/,
                        `${el.handle} `
                      );
                      updateNodeFields(selectedNode.id, {
                        prompt: nextPrompt,
                        elementHandles: Array.from(
                          new Set([...selectedNode.elementHandles, el.handle])
                        ),
                      });
                      setAtAutocompleteOpen(false);
                    }}
                    className="w-full h-8 px-2.5 rounded-[7px] hover:bg-white/[0.08] text-left text-[12px] text-white/90 flex items-center justify-between"
                  >
                    <span className="font-mono text-[#20D5EC]">{el.handle}</span>
                    <span className="text-[11px] text-white/45 truncate ml-2">
                      {el.name}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Actionable Banner if User Just Clicked Generate Without Connected Credits */}
          {lastFailedPlatformId === effectivePlatformId && !activeConnStatus.connected && (
            <div className="px-3 py-2 rounded-[9px] bg-amber-500/[0.09] border border-amber-400/25 flex items-center justify-between gap-2 text-[11.5px]">
              <span className="text-amber-100/90 truncate">
                Connect your {activePlatformDef?.name || effectivePlatformId} credits (MCP, Browser Tab, or API Key) to run this node.
              </span>
              <button
                type="button"
                onClick={() => openProviderModal('byok', effectivePlatformId)}
                className="h-6 px-2.5 rounded-[6px] bg-white text-[#0e0e0e] font-semibold shrink-0 hover:bg-white/90"
              >
                Connect Credits →
              </button>
            </div>
          )}

          {/* Bottom Controls Row: [Where (Platform)] + [Model] + [Settings] + [Generate] */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 flex-wrap">
              {/* 1. WHERE (Platform Selector) */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() =>
                    setOpenMenu(openMenu === 'platform' ? null : 'platform')
                  }
                  className="h-8 px-2.5 rounded-[8px] bg-[#252525] hover:bg-white/[0.11] border border-white/[0.08] text-[12px] font-medium text-white/95 flex items-center gap-1.5 transition-colors"
                  title="Where this node gets generated (Platform / Credits)"
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      activeConnStatus.connected ? 'bg-[#10b981]' : 'bg-white/35'
                    }`}
                  />
                  <span>{activePlatformDef?.shortLabel || effectivePlatformId}</span>
                  <ChevronDown className="w-3.5 h-3.5 text-white/45" strokeWidth={1.6} />
                </button>

                {openMenu === 'platform' && (
                  <div className="absolute bottom-full left-0 mb-1.5 w-[256px] max-h-[320px] overflow-y-auto p-1.5 rounded-[12px] dreamina-menu z-50 space-y-0.5">
                    <div className="px-2.5 py-1 text-[10.5px] font-medium text-white/40 uppercase tracking-wider">
                      Where to Generate
                    </div>
                    {availablePlatforms.map((plat) => {
                      const st = getPlatformConnectionStatus(
                        plat.id,
                        byok,
                        chromeBridge,
                        externalMcpServers,
                        plat
                      );
                      const active = plat.id === effectivePlatformId;
                      return (
                        <button
                          key={plat.id}
                          type="button"
                          onClick={() => {
                            setNodePlatformAndModel(selectedNode.id, plat.id);
                            setOpenMenu(null);
                          }}
                          className={`w-full px-2.5 py-1.5 rounded-[8px] text-left flex items-center justify-between gap-2 transition-colors ${
                            active ? 'bg-white/[0.1] text-white' : 'hover:bg-white/[0.06] text-white/85'
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="text-[12px] font-medium flex items-center gap-1.5">
                              <span
                                className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                  st.connected ? 'bg-[#10b981]' : 'bg-white/25'
                                }`}
                              />
                              <span className="truncate">{plat.name}</span>
                            </div>
                            <div className="text-[10.5px] text-white/40 pl-3 truncate">
                              {st.connected ? st.summary : 'Click to select · Setup credits'}
                            </div>
                          </div>
                          {active && (
                            <Check className="w-3.5 h-3.5 text-[#20D5EC] shrink-0" strokeWidth={2} />
                          )}
                        </button>
                      );
                    })}
                    <div className="my-1 h-px bg-white/[0.07]" />
                    <button
                      type="button"
                      onClick={() => {
                        setOpenMenu(null);
                        openProviderModal('mcp');
                      }}
                      className="w-full h-8 px-2.5 rounded-[8px] hover:bg-white/[0.08] text-[11.5px] text-[#20D5EC] flex items-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" strokeWidth={1.75} />
                      <span>Connect Platform / MCP Credits…</span>
                    </button>
                  </div>
                )}
              </div>

              {/* 2. MODEL Selector (strictly filtered by Modality + Platform) */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() =>
                    setOpenMenu(openMenu === 'model' ? null : 'model')
                  }
                  className="h-8 px-2.5 rounded-[8px] bg-[#252525] hover:bg-white/[0.11] border border-white/[0.08] text-[12px] text-white/90 flex items-center gap-1.5 transition-colors max-w-[210px]"
                  title="Model on selected platform"
                >
                  <span className="truncate">
                    {activeModelDef?.label ||
                      (effectivePlatformId === 'custom-mcp'
                        ? 'Connect MCP Tool…'
                        : selectedNode.modelId || 'Select Model')}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 text-white/45 shrink-0" strokeWidth={1.6} />
                </button>

                {openMenu === 'model' && (
                  <div className="absolute bottom-full left-0 mb-1.5 w-[280px] max-h-[300px] overflow-y-auto p-1.5 rounded-[12px] dreamina-menu z-50 space-y-0.5">
                    <div className="px-2.5 py-1 text-[10.5px] font-medium text-white/40 uppercase tracking-wider">
                      {activePlatformDef?.name || 'Platform'} ·{' '}
                      {modality === 'video'
                        ? 'Video Models'
                        : modality === 'audio'
                        ? 'Audio Models'
                        : 'Image Models'}
                    </div>
                    {availableModels.length === 0 ? (
                      <div className="px-2.5 py-2 text-[11.5px] text-white/55 space-y-2">
                        <p>No MCP tools registered yet.</p>
                        <button
                          type="button"
                          onClick={() => {
                            setOpenMenu(null);
                            openProviderModal('mcp');
                          }}
                          className="h-7 px-2.5 rounded-[7px] bg-white text-[#0e0e0e] font-medium text-[11.5px]"
                        >
                          Add MCP Server →
                        </button>
                      </div>
                    ) : (
                      availableModels.map((m) => {
                        const active = m.id === (activeModelDef?.id || selectedNode.modelId);
                        return (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => {
                              setNodePlatformAndModel(
                                selectedNode.id,
                                effectivePlatformId,
                                m.id
                              );
                              setOpenMenu(null);
                            }}
                            className={`w-full px-2.5 py-1.5 rounded-[8px] text-left flex items-center justify-between gap-2 transition-colors ${
                              active
                                ? 'bg-white/[0.1] text-white'
                                : 'hover:bg-white/[0.06] text-white/85'
                            }`}
                          >
                            <div className="min-w-0">
                              <div className="text-[12px] font-medium truncate">
                                {m.label}
                              </div>
                              {m.description && (
                                <div className="text-[10.5px] text-white/42 line-clamp-1">
                                  {m.description}
                                </div>
                              )}
                            </div>
                            {active && (
                              <Check className="w-3.5 h-3.5 text-[#20D5EC] shrink-0" strokeWidth={2} />
                            )}
                          </button>
                        );
                      })
                    )}
                  </div>
                )}
              </div>

              {/* 3. MODEL SETTINGS (Modality-Specific) */}
              {modality !== 'audio' && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() =>
                      setOpenMenu(openMenu === 'aspect' ? null : 'aspect')
                    }
                    className="h-8 px-2 rounded-[8px] bg-[#252525] hover:bg-white/[0.11] border border-white/[0.07] font-mono text-[11.5px] text-white/85 flex items-center gap-1"
                    title="Aspect Ratio"
                  >
                    <span>{selectedNode.aspectRatio}</span>
                    <ChevronDown className="w-3 h-3 text-white/40" strokeWidth={1.6} />
                  </button>
                  {openMenu === 'aspect' && (
                    <div className="absolute bottom-full left-0 mb-1.5 w-[124px] p-1 rounded-[10px] dreamina-menu z-50 space-y-0.5">
                      {(modality === 'video' ? VIDEO_ASPECTS : IMAGE_ASPECTS).map((ar) => (
                        <button
                          key={ar}
                          type="button"
                          onClick={() => {
                            setNodeAspectRatio(selectedNode.id, ar);
                            setOpenMenu(null);
                          }}
                          className={`w-full h-7 px-2.5 rounded-[7px] font-mono text-[11.5px] flex items-center justify-between ${
                            selectedNode.aspectRatio === ar
                              ? 'bg-white/[0.1] text-white'
                              : 'hover:bg-white/[0.06] text-white/80'
                          }`}
                        >
                          <span>{ar}</span>
                          {selectedNode.aspectRatio === ar && (
                            <Check className="w-3 h-3 text-[#20D5EC]" strokeWidth={2} />
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {modality !== 'audio' && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() =>
                      setOpenMenu(openMenu === 'resolution' ? null : 'resolution')
                    }
                    className="h-8 px-2 rounded-[8px] bg-[#252525] hover:bg-white/[0.11] border border-white/[0.07] font-mono text-[11.5px] text-white/85 flex items-center gap-1"
                    title="Output Resolution"
                  >
                    <span>{selectedNode.resolution}</span>
                    <ChevronDown className="w-3 h-3 text-white/40" strokeWidth={1.6} />
                  </button>
                  {openMenu === 'resolution' && (
                    <div className="absolute bottom-full left-0 mb-1.5 w-[112px] p-1 rounded-[10px] dreamina-menu z-50 space-y-0.5">
                      {(modality === 'video' ? VIDEO_RESOLUTIONS : IMAGE_RESOLUTIONS).map(
                        (res) => (
                          <button
                            key={res}
                            type="button"
                            onClick={() => {
                              updateNodeFields(selectedNode.id, { resolution: res });
                              setOpenMenu(null);
                            }}
                            className={`w-full h-7 px-2.5 rounded-[7px] font-mono text-[11.5px] flex items-center justify-between ${
                              selectedNode.resolution === res
                                ? 'bg-white/[0.1] text-white'
                                : 'hover:bg-white/[0.06] text-white/80'
                            }`}
                          >
                            <span>{res}</span>
                            {selectedNode.resolution === res && (
                              <Check className="w-3 h-3 text-[#20D5EC]" strokeWidth={2} />
                            )}
                          </button>
                        )
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Image Batch Count */}
              {modality === 'image' && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() =>
                      setOpenMenu(openMenu === 'batch' ? null : 'batch')
                    }
                    className="h-8 px-2 rounded-[8px] bg-[#252525] hover:bg-white/[0.11] border border-white/[0.07] font-mono text-[11.5px] text-white/85 flex items-center gap-1"
                    title="Batch image count"
                  >
                    <span>{selectedNode.batchCount || 1}×</span>
                    <ChevronDown className="w-3 h-3 text-white/40" strokeWidth={1.6} />
                  </button>
                  {openMenu === 'batch' && (
                    <div className="absolute bottom-full left-0 mb-1.5 w-[108px] p-1 rounded-[10px] dreamina-menu z-50 space-y-0.5">
                      {BATCH_COUNTS.map((cnt) => (
                        <button
                          key={cnt}
                          type="button"
                          onClick={() => {
                            updateNodeFields(selectedNode.id, { batchCount: cnt });
                            setOpenMenu(null);
                          }}
                          className={`w-full h-7 px-2.5 rounded-[7px] font-mono text-[11.5px] flex items-center justify-between ${
                            (selectedNode.batchCount || 1) === cnt
                              ? 'bg-white/[0.1] text-white'
                              : 'hover:bg-white/[0.06] text-white/80'
                          }`}
                        >
                          <span>{cnt} {cnt === 1 ? 'image' : 'images'}</span>
                          {(selectedNode.batchCount || 1) === cnt && (
                            <Check className="w-3 h-3 text-[#20D5EC]" strokeWidth={2} />
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Video Duration + Native Sound Toggle */}
              {modality === 'video' && (
                <>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() =>
                        setOpenMenu(openMenu === 'duration' ? null : 'duration')
                      }
                      className="h-8 px-2 rounded-[8px] bg-[#252525] hover:bg-white/[0.11] border border-white/[0.07] font-mono text-[11.5px] text-white/85 flex items-center gap-1"
                      title="Clip Duration"
                    >
                      <span>{selectedNode.durationSec || 5}s</span>
                      <ChevronDown className="w-3 h-3 text-white/40" strokeWidth={1.6} />
                    </button>
                    {openMenu === 'duration' && (
                      <div className="absolute bottom-full left-0 mb-1.5 w-[100px] p-1 rounded-[10px] dreamina-menu z-50 space-y-0.5">
                        {VIDEO_DURATIONS.map((sec) => (
                          <button
                            key={sec}
                            type="button"
                            onClick={() => {
                              updateNodeFields(selectedNode.id, { durationSec: sec });
                              setOpenMenu(null);
                            }}
                            className={`w-full h-7 px-2.5 rounded-[7px] font-mono text-[11.5px] flex items-center justify-between ${
                              (selectedNode.durationSec || 5) === sec
                                ? 'bg-white/[0.1] text-white'
                                : 'hover:bg-white/[0.06] text-white/80'
                            }`}
                          >
                            <span>{sec}s</span>
                            {(selectedNode.durationSec || 5) === sec && (
                              <Check className="w-3 h-3 text-[#20D5EC]" strokeWidth={2} />
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      updateNodeFields(selectedNode.id, {
                        audioEnabled: !(selectedNode.audioEnabled ?? true),
                      })
                    }
                    className={`h-8 px-2 rounded-[8px] border text-[11.5px] flex items-center gap-1 transition-colors ${
                      selectedNode.audioEnabled ?? true
                        ? 'bg-[#252525] border-white/[0.1] text-white/90'
                        : 'bg-[#191919] border-white/[0.06] text-white/40'
                    }`}
                    title="Toggle native video audio"
                  >
                    {selectedNode.audioEnabled ?? true ? (
                      <Volume2 className="w-3.5 h-3.5 text-[#20D5EC]" strokeWidth={1.6} />
                    ) : (
                      <VolumeX className="w-3.5 h-3.5" strokeWidth={1.6} />
                    )}
                    <span>Audio</span>
                  </button>
                </>
              )}

              {/* Audio Mode + Voice + Duration */}
              {modality === 'audio' && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      const nextMode = selectedNode.audioMode === 'sfx' ? 'tts' : 'sfx';
                      const nextModel =
                        nextMode === 'sfx'
                          ? 'eleven_text_to_sound_v2'
                          : 'eleven_multilingual_v2';
                      updateNodeFields(selectedNode.id, {
                        audioMode: nextMode,
                        modelId:
                          effectivePlatformId === 'elevenlabs'
                            ? nextModel
                            : selectedNode.modelId,
                      });
                    }}
                    className="h-8 px-2.5 rounded-[8px] bg-[#252525] hover:bg-white/[0.11] border border-white/[0.07] text-[11.5px] text-white/90"
                    title="Switch between Voice TTS and Sound Effects"
                  >
                    {selectedNode.audioMode === 'sfx' ? 'Mode: SFX' : 'Mode: Voice TTS'}
                  </button>

                  {selectedNode.audioMode !== 'sfx' && (
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() =>
                          setOpenMenu(openMenu === 'voice' ? null : 'voice')
                        }
                        className="h-8 px-2.5 rounded-[8px] bg-[#252525] hover:bg-white/[0.11] border border-white/[0.07] text-[11.5px] text-white/90 flex items-center gap-1"
                      >
                        <span>Voice: {activeVoice.name}</span>
                        <ChevronDown className="w-3 h-3 text-white/40" strokeWidth={1.6} />
                      </button>
                      {openMenu === 'voice' && (
                        <div className="absolute bottom-full left-0 mb-1.5 w-[220px] p-1 rounded-[10px] dreamina-menu z-50 space-y-0.5">
                          {ELEVENLABS_VOICES.map((v) => (
                            <button
                              key={v.id}
                              type="button"
                              onClick={() => {
                                updateNodeFields(selectedNode.id, { voiceId: v.id });
                                setOpenMenu(null);
                              }}
                              className={`w-full px-2.5 py-1.5 rounded-[7px] text-left flex items-center justify-between ${
                                (selectedNode.voiceId || ELEVENLABS_VOICES[0].id) === v.id
                                  ? 'bg-white/[0.1] text-white'
                                  : 'hover:bg-white/[0.06] text-white/85'
                              }`}
                            >
                              <div>
                                <div className="text-[12px] font-medium">{v.name}</div>
                                <div className="text-[10.5px] text-white/40">{v.accent}</div>
                              </div>
                              {(selectedNode.voiceId || ELEVENLABS_VOICES[0].id) ===
                                v.id && (
                                <Check className="w-3.5 h-3.5 text-[#20D5EC]" strokeWidth={2} />
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="relative">
                    <button
                      type="button"
                      onClick={() =>
                        setOpenMenu(openMenu === 'duration' ? null : 'duration')
                      }
                      className="h-8 px-2 rounded-[8px] bg-[#252525] hover:bg-white/[0.11] border border-white/[0.07] font-mono text-[11.5px] text-white/85 flex items-center gap-1"
                    >
                      <span>{selectedNode.durationSec || 8}s</span>
                      <ChevronDown className="w-3 h-3 text-white/40" strokeWidth={1.6} />
                    </button>
                    {openMenu === 'duration' && (
                      <div className="absolute bottom-full left-0 mb-1.5 w-[100px] p-1 rounded-[10px] dreamina-menu z-50 space-y-0.5">
                        {AUDIO_DURATIONS.map((sec) => (
                          <button
                            key={sec}
                            type="button"
                            onClick={() => {
                              updateNodeFields(selectedNode.id, { durationSec: sec });
                              setOpenMenu(null);
                            }}
                            className="w-full h-7 px-2.5 rounded-[7px] hover:bg-white/[0.08] font-mono text-[11.5px] text-white/85 text-left"
                          >
                            {sec}s
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Advanced Settings Popover (Connection Transport, Negative Prompt, Seed) */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() =>
                    setOpenMenu(openMenu === 'advanced' ? null : 'advanced')
                  }
                  className={`w-8 h-8 rounded-[8px] border flex items-center justify-center transition-colors ${
                    openMenu === 'advanced'
                      ? 'bg-white text-[#0e0e0e] border-white'
                      : 'bg-[#252525] hover:bg-white/[0.11] border-white/[0.07] text-white/75'
                  }`}
                  title="Connection Route, Negative Prompt & Seed"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" strokeWidth={1.6} />
                </button>

                {openMenu === 'advanced' && (
                  <div className="absolute bottom-full right-0 mb-1.5 w-[290px] p-3 rounded-[12px] dreamina-menu z-50 space-y-3 text-[12px]">
                    <div className="space-y-1">
                      <label className="text-[10.5px] font-medium text-white/45 uppercase tracking-wider">
                        Credit Connection Route
                      </label>
                      <div className="space-y-1">
                        {TRANSPORT_OPTIONS.map((tr) => {
                          const active = (selectedNode.connectionMode || 'auto') === tr.id;
                          return (
                            <button
                              key={tr.id}
                              type="button"
                              onClick={() =>
                                updateNodeFields(selectedNode.id, {
                                  connectionMode: tr.id,
                                })
                              }
                              className={`w-full px-2.5 py-1.5 rounded-[8px] text-left flex items-center justify-between ${
                                active
                                  ? 'bg-white/[0.1] text-white'
                                  : 'hover:bg-white/[0.06] text-white/80'
                              }`}
                            >
                              <div>
                                <div className="text-[11.5px] font-medium">{tr.label}</div>
                                <div className="text-[10px] text-white/40">{tr.hint}</div>
                              </div>
                              {active && (
                                <Check className="w-3.5 h-3.5 text-[#20D5EC]" strokeWidth={2} />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {modality !== 'audio' && (
                      <div className="space-y-1">
                        <label className="text-[10.5px] font-medium text-white/45 uppercase tracking-wider">
                          Negative Prompt
                        </label>
                        <input
                          value={selectedNode.negativePrompt || ''}
                          onChange={(e) =>
                            updateNodeFields(selectedNode.id, {
                              negativePrompt: e.target.value,
                            })
                          }
                          placeholder="blur, watermark, distortion…"
                          className="w-full h-7 px-2.5 rounded-[7px] bg-[#141414] border border-white/[0.08] text-[11.5px] text-white outline-none select-text"
                        />
                      </div>
                    )}

                    <div className="flex items-center justify-between gap-2">
                      <label className="text-[10.5px] font-medium text-white/45 uppercase tracking-wider">
                        Seed
                      </label>
                      <input
                        type="number"
                        value={selectedNode.seed}
                        onChange={(e) =>
                          updateNodeFields(selectedNode.id, {
                            seed: Number(e.target.value) || 100,
                          })
                        }
                        className="w-28 h-7 px-2 rounded-[7px] bg-[#141414] border border-white/[0.08] font-mono text-[11.5px] text-white outline-none select-text"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right Execution CTAs */}
            <div className="flex items-center gap-1.5 shrink-0">
              {hasDownstreamEdges && (
                <button
                  type="button"
                  disabled={isGenerating || workflowRunning}
                  onClick={() => void runWorkflowPipeline(selectedNode.id)}
                  className="h-8 px-2.5 rounded-[9px] bg-[#252525] hover:bg-white/[0.12] disabled:opacity-45 border border-[#20D5EC]/35 text-[11.5px] font-medium text-[#20D5EC] flex items-center gap-1.5 transition-colors"
                  title="Generate this node, then pass its output automatically into wired downstream nodes"
                >
                  <GitBranch className="w-3.5 h-3.5" strokeWidth={1.7} />
                  <span>Run Chain</span>
                </button>
              )}

              <button
                type="button"
                disabled={isGenerating}
                onClick={() => void generateSingleNode(selectedNode.id)}
                title={`Generate on ${activePlatformDef?.name || effectivePlatformId} · ${
                  activeModelDef?.label || ''
                } (⌘Enter)`}
                className="h-8 px-3 rounded-full bg-white hover:bg-[#e5e5e5] disabled:opacity-50 text-[#0e0e0e] text-[12px] font-semibold flex items-center gap-1.5 transition-colors"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={2} />
                    <span>Generating</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3 h-3 fill-current" strokeWidth={2} />
                    <span>Generate</span>
                    <ArrowUp className="w-3.5 h-3.5" strokeWidth={2.2} />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
