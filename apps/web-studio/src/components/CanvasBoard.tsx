import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowUpRight,
  AudioLines,
  ChevronRight,
  Clapperboard,
  Compass,
  Copy,
  Cpu,
  Download,
  Film,
  GitBranch,
  Grid2X2,
  Grid3X3,
  Image as ImageIcon,
  Layers,
  Loader2,
  Maximize2,
  Palette,
  Pause,
  Play,
  Plus,
  Redo2,
  Sparkles,
  StickyNote,
  Trash2,
  Type,
  Undo2,
  Upload,
  UserSquare2,
  Volume2,
  VolumeX,
  X,
  type LucideIcon,
} from 'lucide-react';
import type { CanvasNode, DreaminaToolId } from '../types/studio';
import { getPlatformBadgeLabel } from '../presets/platformCatalog';
import { useStudioStore } from '../store/useStudioStore';
import { createDefaultWaveform } from '../utils/proceduralMedia';
import {
  SmartMediaImage,
  SmartMediaVideo,
  resolvePlayableAudioUrl,
} from './SmartMedia';
import { TimelineCanvasNode } from './TimelineCanvasNode';
import { PlatformBrandIcon } from './PlatformBrandIcon';

export interface CanvasBoardProps {
  activeInpaintNodeId: string | null;
  onCloseInpaint: () => void;
}

interface WireDraftState {
  sourceNodeId: string;
  sourceNodeIds?: string[];
  direction: 'left' | 'right';
  startWorldX: number;
  startWorldY: number;
  curWorldX: number;
  curWorldY: number;
  menuScreenX?: number;
  menuScreenY?: number;
  frozenForMenu: boolean;
}

interface ContextMenuState {
  kind: 'canvas' | 'node';
  screenX: number;
  screenY: number;
  worldX: number;
  worldY: number;
  nodeId?: string;
}

const CREATE_FLYOUT_ITEMS: Array<{
  id: DreaminaToolId;
  label: string;
  shortcut?: string;
  icon: LucideIcon;
}> = [
  { id: 'text', label: 'Text', shortcut: 'T', icon: Type },
  { id: 'image', label: 'Image', shortcut: 'I', icon: ImageIcon },
  { id: 'video', label: 'Video', shortcut: 'G', icon: Clapperboard },
  { id: 'audio', label: 'Audio', shortcut: 'A', icon: AudioLines },
  { id: 'element', label: 'Reference (@Element)', icon: UserSquare2 },
  { id: 'timeline', label: 'Timeline', icon: Film },
  { id: 'cinema-kit', label: 'Cinema Kit', icon: Palette },
  { id: 'camera-3d', label: '3D Director Console', icon: Compass },
  { id: 'image-editor', label: '9-Grid Contact Sheet', icon: Layers },
  { id: 'sticky', label: 'Sticky note', shortcut: 'S', icon: StickyNote },
  { id: 'upload', label: 'Upload from device', icon: Upload },
];

const WIRE_DROP_ITEMS: Array<{
  id: DreaminaToolId | 'blend';
  label: string;
  icon: LucideIcon;
}> = [
  { id: 'image', label: 'Create Image', icon: ImageIcon },
  { id: 'video', label: 'Create Video (from Ref)', icon: Clapperboard },
  { id: 'audio', label: 'Create Voice / SFX', icon: AudioLines },
  { id: 'element', label: 'Reference (@Element)', icon: UserSquare2 },
  { id: 'text', label: 'Prompt / Script Note', icon: Type },
  { id: 'timeline', label: 'Send to Timeline', icon: Film },
];

function getNodeKindIcon(kind: CanvasNode['kind']): LucideIcon {
  switch (kind) {
    case 'video':
      return Clapperboard;
    case 'image':
      return ImageIcon;
    case 'contact-sheet':
      return Grid3X3;
    case 'element':
      return UserSquare2;
    case 'timeline':
      return Film;
    case 'text':
      return Type;
    case 'sticky':
      return StickyNote;
    case 'audio':
      return AudioLines;
    case 'style-dna':
      return Palette;
    case 'mcp-tool':
      return Cpu;
    default:
      return ImageIcon;
  }
}

function buildCubicBezierPath(x1: number, y1: number, x2: number, y2: number): string {
  const dx = Math.max(72, Math.abs(x2 - x1) * 0.46);
  const c1x = x2 >= x1 ? x1 + dx : x1 - dx;
  const c2x = x2 >= x1 ? x2 - dx : x2 + dx;
  return `M ${x1} ${y1} C ${c1x} ${y1}, ${c2x} ${y2}, ${x2} ${y2}`;
}

function formatDurationPill(sec?: number): string {
  const s = Math.max(1, Math.round(sec || 6));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}

export const CanvasBoard: React.FC<CanvasBoardProps> = ({
  activeInpaintNodeId,
  onCloseInpaint,
}) => {
  const nodes = useStudioStore((s) => s.nodes);
  const edges = useStudioStore((s) => s.edges);
  const selectedNodeIds = useStudioStore((s) => s.selectedNodeIds);
  const clipboardNode = useStudioStore((s) => s.clipboardNode);
  const past = useStudioStore((s) => s.past);
  const future = useStudioStore((s) => s.future);

  const panX = useStudioStore((s) => s.panX);
  const panY = useStudioStore((s) => s.panY);
  const zoom = useStudioStore((s) => s.zoom);
  const canvasToolMode = useStudioStore((s) => s.canvasToolMode);
  const showConnections = useStudioStore((s) => s.showConnections);

  const setViewport = useStudioStore((s) => s.setViewport);
  const selectNodes = useStudioStore((s) => s.selectNodes);
  const moveNodes = useStudioStore((s) => s.moveNodes);
  const commitNodePositions = useStudioStore((s) => s.commitNodePositions);
  const connectNodes = useStudioStore((s) => s.connectNodes);
  const updateNodeFields = useStudioStore((s) => s.updateNodeFields);
  const deleteSelectedNodes = useStudioStore((s) => s.deleteSelectedNodes);
  const copySelectedNode = useStudioStore((s) => s.copySelectedNode);
  const pasteClipboardNode = useStudioStore((s) => s.pasteClipboardNode);
  const duplicateNodes = useStudioStore((s) => s.duplicateNodes);
  const spawnDreaminaNodeAt = useStudioStore((s) => s.spawnDreaminaNodeAt);
  const spawnConnectedNodeFromSelection = useStudioStore(
    (s) => s.spawnConnectedNodeFromSelection
  );
  const splitBatchNodeToIndividualNodes = useStudioStore(
    (s) => s.splitBatchNodeToIndividualNodes
  );
  const uploadLocalMediaNode = useStudioStore((s) => s.uploadLocalMediaNode);
  const uploadReferenceToNode = useStudioStore((s) => s.uploadReferenceToNode);
  const saveNodeAsElementReference = useStudioStore(
    (s) => s.saveNodeAsElementReference
  );
  const generateSingleNode = useStudioStore((s) => s.generateSingleNode);
  const runWorkflowPipeline = useStudioStore((s) => s.runWorkflowPipeline);
  const platformsCatalog = useStudioStore((s) => s.platformsCatalog);
  const externalMcpServers = useStudioStore((s) => s.externalMcpServers);
  const sendNodeToTimeline = useStudioStore((s) => s.sendNodeToTimeline);
  const sliceContactSheetNode = useStudioStore((s) => s.sliceContactSheetNode);
  const branchVideoMultiTurn = useStudioStore((s) => s.branchVideoMultiTurn);
  const executeMcpToolNode = useStudioStore((s) => s.executeMcpToolNode);
  const applyInpaintToNode = useStudioStore((s) => s.applyInpaintToNode);
  const openInlineEditor = useStudioStore((s) => s.openInlineEditor);
  const tidyUpNodes = useStudioStore((s) => s.tidyUpNodes);
  const fitAllNodesInViewport = useStudioStore((s) => s.fitAllNodesInViewport);
  const setCameraDirectorOpen = useStudioStore((s) => s.setCameraDirectorOpen);
  const undo = useStudioStore((s) => s.undo);
  const redo = useStudioStore((s) => s.redo);
  const showToast = useStudioStore((s) => s.showToast);

  const boardRef = useRef<HTMLDivElement | null>(null);
  const fileUploadRef = useRef<HTMLInputElement | null>(null);
  const nodeRefUploadInputRef = useRef<HTMLInputElement | null>(null);
  const pendingNodeUploadIdRef = useRef<string | null>(null);
  const pendingUploadWorldRef = useRef<{ x: number; y: number } | null>(null);

  const [spacePressed, setSpacePressed] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [renamingNodeId, setRenamingNodeId] = useState<string | null>(null);
  const [editingHandleNodeId, setEditingHandleNodeId] = useState<string | null>(null);
  const [unmutedNodeIds, setUnmutedNodeIds] = useState<Record<string, boolean>>({});
  const [pausedNodeIds, setPausedNodeIds] = useState<Record<string, boolean>>({});

  const [marquee, setMarquee] = useState<{
    startX: number;
    startY: number;
    curX: number;
    curY: number;
  } | null>(null);

  const [wireDraft, setWireDraft] = useState<WireDraftState | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [createSubmenuOpen, setCreateSubmenuOpen] = useState(false);
  const [createSubmenuPinned, setCreateSubmenuPinned] = useState(false);

  const nodeHoverTimerRef = useRef<number | null>(null);
  const submenuCloseTimerRef = useRef<number | null>(null);

  const cancelNodeHoverClear = () => {
    if (nodeHoverTimerRef.current !== null) {
      window.clearTimeout(nodeHoverTimerRef.current);
      nodeHoverTimerRef.current = null;
    }
  };

  const scheduleNodeHoverClear = (nodeId: string) => {
    cancelNodeHoverClear();
    nodeHoverTimerRef.current = window.setTimeout(() => {
      setHoveredNodeId((cur) => (cur === nodeId ? null : cur));
      nodeHoverTimerRef.current = null;
    }, 240);
  };

  const openCreateSubmenu = () => {
    if (submenuCloseTimerRef.current !== null) {
      window.clearTimeout(submenuCloseTimerRef.current);
      submenuCloseTimerRef.current = null;
    }
    setCreateSubmenuOpen(true);
  };

  const scheduleCreateSubmenuClose = () => {
    if (createSubmenuPinned) return;
    if (submenuCloseTimerRef.current !== null) {
      window.clearTimeout(submenuCloseTimerRef.current);
    }
    submenuCloseTimerRef.current = window.setTimeout(() => {
      setCreateSubmenuOpen(false);
      submenuCloseTimerRef.current = null;
    }, 320);
  };

  useEffect(() => {
    return () => {
      if (nodeHoverTimerRef.current !== null) window.clearTimeout(nodeHoverTimerRef.current);
      if (submenuCloseTimerRef.current !== null) window.clearTimeout(submenuCloseTimerRef.current);
    };
  }, []);

  const selectionGroupBounds = useMemo(() => {
    if (selectedNodeIds.length < 2) return null;
    const selNodes = selectedNodeIds
      .map((id) => nodes.find((n) => n.id === id))
      .filter((n): n is CanvasNode => Boolean(n));
    if (selNodes.length < 2) return null;
    const minX = Math.min(...selNodes.map((n) => n.x));
    const minY = Math.min(...selNodes.map((n) => n.y));
    const maxX = Math.max(...selNodes.map((n) => n.x + n.width));
    const maxY = Math.max(...selNodes.map((n) => n.y + n.height));
    return {
      nodes: selNodes,
      nodeIds: selNodes.map((n) => n.id),
      minX,
      minY,
      maxX,
      maxY,
      width: maxX - minX,
      height: maxY - minY,
      handleX: maxX + 22,
      handleY: (minY + maxY) / 2,
    };
  }, [selectedNodeIds, nodes]);

  const screenToWorld = (clientX: number, clientY: number) => {
    const rect = boardRef.current?.getBoundingClientRect();
    const sx = clientX - (rect?.left || 0);
    const sy = clientY - (rect?.top || 0);
    const state = useStudioStore.getState();
    return {
      x: (sx - state.panX) / state.zoom,
      y: (sy - state.panY) / state.zoom,
    };
  };

  // Native non-passive wheel listener for butter-smooth trackpad pan + pinch zoom
  useEffect(() => {
    const el = boardRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const state = useStudioStore.getState();
      const rect = el.getBoundingClientRect();
      const cursorX = e.clientX - rect.left;
      const cursorY = e.clientY - rect.top;

      if (e.ctrlKey || e.metaKey) {
        const factor = Math.exp(-e.deltaY * 0.0045);
        const nextZoom = Math.max(0.2, Math.min(2.5, state.zoom * factor));
        const scale = nextZoom / state.zoom;
        const nextPanX = cursorX - (cursorX - state.panX) * scale;
        const nextPanY = cursorY - (cursorY - state.panY) * scale;
        state.setViewport(nextPanX, nextPanY, nextZoom);
      } else {
        state.setViewport(state.panX - e.deltaX, state.panY - e.deltaY, state.zoom);
      }
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // Keyboard shortcuts (Space pan, V/H tool, Copy/Paste/Duplicate/Delete/Undo/Redo/Escape)
  useEffect(() => {
    const isTypingTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false;
      const tag = target.tagName.toLowerCase();
      return (
        tag === 'input' ||
        tag === 'textarea' ||
        target.isContentEditable
      );
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setContextMenu(null);
        setWireDraft(null);
        setRenamingNodeId(null);
        onCloseInpaint();
        return;
      }

      if (isTypingTarget(e.target)) return;

      if (e.code === 'Space') {
        e.preventDefault();
        setSpacePressed(true);
        return;
      }

      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        useStudioStore.getState().setSearchModalOpen(true);
        return;
      }
      if (mod && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        copySelectedNode();
        return;
      }
      if (mod && e.key.toLowerCase() === 'v') {
        e.preventDefault();
        pasteClipboardNode();
        return;
      }
      if (mod && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        duplicateNodes();
        return;
      }
      if (mod && e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        redo();
        return;
      }
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        undo();
        return;
      }
      if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault();
        deleteSelectedNodes();
        return;
      }
      if (!mod && e.key.toLowerCase() === 'v') {
        useStudioStore.getState().setCanvasToolMode('select');
      } else if (!mod && e.key.toLowerCase() === 'h') {
        useStudioStore.getState().setCanvasToolMode('hand');
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setSpacePressed(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [
    copySelectedNode,
    pasteClipboardNode,
    duplicateNodes,
    deleteSelectedNodes,
    undo,
    redo,
    onCloseInpaint,
  ]);

  const nodeMap = useMemo(() => {
    const m = new Map<string, CanvasNode>();
    nodes.forEach((n) => m.set(n.id, n));
    return m;
  }, [nodes]);

  const handleCanvasPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button === 2) return; // handled by onContextMenu

    setContextMenu(null);
    setCreateSubmenuOpen(false);
    if (wireDraft?.frozenForMenu) {
      setWireDraft(null);
    }

    const shouldPan =
      e.button === 1 || spacePressed || canvasToolMode === 'hand';

    if (shouldPan) {
      e.preventDefault();
      setIsPanning(true);
      const startX = e.clientX;
      const startY = e.clientY;
      const initPanX = panX;
      const initPanY = panY;

      const onMove = (ev: PointerEvent) => {
        setViewport(
          initPanX + (ev.clientX - startX),
          initPanY + (ev.clientY - startY),
          useStudioStore.getState().zoom
        );
      };
      const onUp = () => {
        setIsPanning(false);
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      return;
    }

    // Left click on empty canvas: clear selection (unless additive modifier held) & start marquee drag
    const additiveMarquee = e.shiftKey || e.metaKey || e.ctrlKey;
    const initialSelectedIds = additiveMarquee
      ? [...useStudioStore.getState().selectedNodeIds]
      : [];
    if (!additiveMarquee) {
      selectNodes([]);
    }

    const rect = boardRef.current?.getBoundingClientRect();
    const sx = e.clientX - (rect?.left || 0);
    const sy = e.clientY - (rect?.top || 0);

    const onMove = (ev: PointerEvent) => {
      const cx = ev.clientX - (rect?.left || 0);
      const cy = ev.clientY - (rect?.top || 0);
      if (Math.hypot(cx - sx, cy - sy) < 4) return;

      setMarquee({ startX: sx, startY: sy, curX: cx, curY: cy });

      const st = useStudioStore.getState();
      const minWX = (Math.min(sx, cx) - st.panX) / st.zoom;
      const maxWX = (Math.max(sx, cx) - st.panX) / st.zoom;
      const minWY = (Math.min(sy, cy) - st.panY) / st.zoom;
      const maxWY = (Math.max(sy, cy) - st.panY) / st.zoom;

      const hits = st.nodes
        .filter(
          (n) =>
            n.x + n.width >= minWX &&
            n.x <= maxWX &&
            n.y + n.height >= minWY &&
            n.y <= maxWY
        )
        .map((n) => n.id);
      selectNodes(
        additiveMarquee ? Array.from(new Set([...initialSelectedIds, ...hits])) : hits
      );
    };

    const onUp = () => {
      setMarquee(null);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const handleNodePointerDown = (
    e: React.PointerEvent<HTMLDivElement>,
    node: CanvasNode
  ) => {
    if (e.button === 2) return;
    e.stopPropagation();

    setContextMenu(null);
    if (wireDraft?.frozenForMenu) {
      setWireDraft(null);
    }

    if (spacePressed || canvasToolMode === 'hand' || e.button === 1) {
      handleCanvasPointerDown(e);
      return;
    }

    const state = useStudioStore.getState();
    const alreadySelected = state.selectedNodeIds.includes(node.id);
    let movingIds = state.selectedNodeIds;

    if (e.shiftKey || e.metaKey || e.ctrlKey) {
      selectNodes([node.id], true);
      movingIds = useStudioStore.getState().selectedNodeIds;
    } else if (!alreadySelected) {
      selectNodes([node.id], false);
      movingIds = [node.id];
    }

    let lastClientX = e.clientX;
    let lastClientY = e.clientY;
    let moved = false;

    const onMove = (ev: PointerEvent) => {
      const z = useStudioStore.getState().zoom;
      const dx = (ev.clientX - lastClientX) / z;
      const dy = (ev.clientY - lastClientY) / z;
      if (Math.abs(ev.clientX - lastClientX) > 1 || Math.abs(ev.clientY - lastClientY) > 1) {
        moved = true;
      }
      lastClientX = ev.clientX;
      lastClientY = ev.clientY;
      moveNodes(movingIds, dx, dy);
    };

    const onUp = () => {
      if (moved) {
        commitNodePositions();
      }
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  // Unified wire-drag / click helper shared by node (+) ports & group right-edge (+) handle
  const beginWireDraftFromSources = (
    e: React.PointerEvent<HTMLButtonElement>,
    direction: 'left' | 'right',
    sourceIds: string[],
    startWorldX: number,
    startWorldY: number
  ) => {
    e.stopPropagation();
    e.preventDefault();
    setContextMenu(null);

    const primarySourceId = sourceIds[0];
    const initialDraft: WireDraftState = {
      sourceNodeId: primarySourceId,
      ...(sourceIds.length > 1 ? { sourceNodeIds: sourceIds } : {}),
      direction,
      startWorldX,
      startWorldY,
      curWorldX: startWorldX + (direction === 'right' ? 140 : -140),
      curWorldY: startWorldY,
      frozenForMenu: false,
    };
    setWireDraft(initialDraft);

    const downClientX = e.clientX;
    const downClientY = e.clientY;
    let dragged = false;

    const onMove = (ev: PointerEvent) => {
      if (Math.hypot(ev.clientX - downClientX, ev.clientY - downClientY) > 5) {
        dragged = true;
      }
      if (!dragged) return;
      const pt = screenToWorld(ev.clientX, ev.clientY);
      setWireDraft((prev) =>
        prev
          ? {
              ...prev,
              curWorldX: pt.x,
              curWorldY: pt.y,
            }
          : null
      );
    };

    const onUp = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);

      const st = useStudioStore.getState();

      if (!dragged) {
        // Click on (+): project wire outward and open Wire-Drop Creation Menu
        const targetWorldX =
          direction === 'right' ? startWorldX + 140 : startWorldX - 420;
        const targetWorldY = startWorldY - 40;
        const wireEndWorldX =
          direction === 'right' ? startWorldX + 128 : startWorldX - 128;
        const menuX = Math.min(
          window.innerWidth - 236,
          Math.max(76, st.panX + wireEndWorldX * st.zoom)
        );
        const menuY = Math.min(
          window.innerHeight - 310,
          Math.max(60, st.panY + startWorldY * st.zoom - 90)
        );
        setWireDraft({
          sourceNodeId: primarySourceId,
          ...(sourceIds.length > 1 ? { sourceNodeIds: sourceIds } : {}),
          direction,
          startWorldX,
          startWorldY,
          curWorldX: targetWorldX,
          curWorldY: targetWorldY,
          menuScreenX: menuX,
          menuScreenY: menuY,
          frozenForMenu: true,
        });
        return;
      }

      const dropWorld = screenToWorld(ev.clientX, ev.clientY);
      const targetNode = st.nodes.find(
        (n) =>
          !sourceIds.includes(n.id) &&
          dropWorld.x >= n.x - 20 &&
          dropWorld.x <= n.x + n.width + 20 &&
          dropWorld.y >= n.y - 20 &&
          dropWorld.y <= n.y + n.height + 20
      );

      if (targetNode) {
        for (const sid of sourceIds) {
          if (direction === 'right') {
            connectNodes(sid, targetNode.id, 'lineage');
          } else {
            connectNodes(targetNode.id, sid, 'lineage');
          }
        }
        if (sourceIds.length > 1) {
          showToast(
            `Connected ${sourceIds.length} reference nodes → "${targetNode.title}"`
          );
        }
        setWireDraft(null);
        return;
      }

      // Dropped on empty canvas -> freeze wire & open Dreamina Wire-Drop Creation Menu!
      const menuX = Math.min(window.innerWidth - 236, Math.max(76, ev.clientX));
      const menuY = Math.min(window.innerHeight - 310, Math.max(60, ev.clientY - 40));
      setWireDraft({
        sourceNodeId: primarySourceId,
        ...(sourceIds.length > 1 ? { sourceNodeIds: sourceIds } : {}),
        direction,
        startWorldX,
        startWorldY,
        curWorldX: dropWorld.x,
        curWorldY: dropWorld.y,
        menuScreenX: menuX,
        menuScreenY: menuY,
        frozenForMenu: true,
      });
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  // Port (+) PointerDown: drag Bezier wire OR click to open Dreamina Wire-Drop Creation Menu
  const handlePortPointerDown = (
    e: React.PointerEvent<HTMLButtonElement>,
    node: CanvasNode,
    direction: 'left' | 'right'
  ) => {
    const startWorldX = direction === 'right' ? node.x + node.width : node.x;
    const startWorldY = node.y + node.height / 2;
    const st = useStudioStore.getState();
    const useMultiSelection =
      direction === 'right' &&
      st.selectedNodeIds.length >= 2 &&
      st.selectedNodeIds.includes(node.id);
    const sourceIds = useMultiSelection ? st.selectedNodeIds : [node.id];
    beginWireDraftFromSources(e, direction, sourceIds, startWorldX, startWorldY);
  };

  const handleCanvasContextMenu = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    setWireDraft(null);
    setCreateSubmenuOpen(false);
    const world = screenToWorld(e.clientX, e.clientY);
    const sx = Math.min(window.innerWidth - 240, Math.max(16, e.clientX));
    const sy = Math.min(window.innerHeight - 280, Math.max(16, e.clientY));
    setContextMenu({
      kind: 'canvas',
      screenX: sx,
      screenY: sy,
      worldX: world.x,
      worldY: world.y,
    });
  };

  const handleNodeContextMenu = (
    e: React.MouseEvent<HTMLDivElement>,
    node: CanvasNode
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setWireDraft(null);
    if (!selectedNodeIds.includes(node.id)) {
      selectNodes([node.id]);
    }
    const world = screenToWorld(e.clientX, e.clientY);
    const sx = Math.min(window.innerWidth - 240, Math.max(16, e.clientX));
    const sy = Math.min(window.innerHeight - 360, Math.max(16, e.clientY));
    setContextMenu({
      kind: 'node',
      screenX: sx,
      screenY: sy,
      worldX: world.x,
      worldY: world.y,
      nodeId: node.id,
    });
  };

  const handleDownloadNodeMedia = (node: CanvasNode) => {
    const href = node.videoUrl || node.imageUrl || node.audioUrl;
    if (!href) {
      showToast('No downloadable media URL on this node yet.');
      return;
    }
    const a = document.createElement('a');
    a.href = href;
    const ext = node.videoUrl ? 'mp4' : node.audioUrl ? 'mp3' : 'png';
    a.download = `${node.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const gridSpacing = Math.max(12, Math.round(20 * zoom));
  const contextNode = contextMenu?.nodeId
    ? nodeMap.get(contextMenu.nodeId) || null
    : null;

  return (
    <div
      ref={boardRef}
      onPointerDown={handleCanvasPointerDown}
      onContextMenu={handleCanvasContextMenu}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes('Files')) {
          e.preventDefault();
        }
      }}
      onDrop={(e) => {
        const file = e.dataTransfer.files?.[0];
        if (file) {
          e.preventDefault();
          const world = screenToWorld(e.clientX, e.clientY);
          uploadLocalMediaNode(file, world.x, world.y);
        }
      }}
      style={{
        backgroundColor: '#0e0e0e',
        backgroundImage:
          'radial-gradient(rgba(255, 255, 255, 0.07) 1px, transparent 1px)',
        backgroundSize: `${gridSpacing}px ${gridSpacing}px`,
        backgroundPosition: `${panX}px ${panY}px`,
      }}
      className={`relative w-full h-full overflow-hidden select-none ${
        isPanning
          ? 'cursor-grabbing'
          : spacePressed || canvasToolMode === 'hand'
          ? 'cursor-grab'
          : 'cursor-default'
      }`}
    >
      {/* Hidden File Input for Context Menu Upload */}
      <input
        ref={fileUploadRef}
        type="file"
        accept="image/*,video/*,audio/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            const pt = pendingUploadWorldRef.current || { x: 400, y: 260 };
            uploadLocalMediaNode(file, pt.x, pt.y);
            e.target.value = '';
          }
        }}
      />

      {/* Hidden File Input for Per-Node Reference Image Upload */}
      <input
        ref={nodeRefUploadInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          const targetId = pendingNodeUploadIdRef.current;
          if (file && targetId) {
            void uploadReferenceToNode(targetId, file);
            pendingNodeUploadIdRef.current = null;
            e.target.value = '';
          }
        }}
      />

      {/* Transformed World Plane */}
      <div
        style={{
          transform: `translate3d(${panX}px, ${panY}px, 0) scale(${zoom})`,
          transformOrigin: '0 0',
        }}
        className="absolute top-0 left-0 w-0 h-0"
      >
        {/* Bezier Node Connection Wires (#20D5EC) */}
        <svg
          className="overflow-visible pointer-events-none"
          style={{ position: 'absolute', left: 0, top: 0, width: 1, height: 1 }}
        >
          {showConnections &&
            edges.map((edge) => {
              const src = nodeMap.get(edge.sourceId);
              const dst = nodeMap.get(edge.targetId);
              if (!src || !dst) return null;

              const x1 = src.x + src.width;
              const y1 = src.y + src.height / 2;
              const x2 = dst.x;
              const y2 = dst.y + dst.height / 2;
              const path = buildCubicBezierPath(x1, y1, x2, y2);

              const isHighlighted =
                selectedNodeIds.includes(src.id) ||
                selectedNodeIds.includes(dst.id) ||
                dst.status === 'generating';

              return (
                <g key={edge.id}>
                  <path
                    d={path}
                    fill="none"
                    stroke="#20D5EC"
                    strokeWidth={isHighlighted ? 2 : 1.75}
                    strokeOpacity={isHighlighted ? 0.92 : 0.45}
                    className={dst.status === 'generating' ? 'animate-wire-active' : ''}
                  />
                  <circle
                    cx={x1}
                    cy={y1}
                    r={3}
                    fill="#20D5EC"
                    fillOpacity={isHighlighted ? 0.95 : 0.5}
                  />
                  <circle
                    cx={x2}
                    cy={y2}
                    r={3}
                    fill="#20D5EC"
                    fillOpacity={isHighlighted ? 0.95 : 0.5}
                  />
                </g>
              );
            })}

          {/* Live / Frozen Draft Wire(s) from (+) Port or Group Handle */}
          {wireDraft && (
            <g>
              {wireDraft.sourceNodeIds && wireDraft.sourceNodeIds.length > 1 ? (
                wireDraft.sourceNodeIds.map((sid) => {
                  const src = nodeMap.get(sid);
                  if (!src) return null;
                  const sx =
                    wireDraft.direction === 'right' ? src.x + src.width : src.x;
                  const sy = src.y + src.height / 2;
                  return (
                    <path
                      key={sid}
                      d={buildCubicBezierPath(
                        sx,
                        sy,
                        wireDraft.curWorldX,
                        wireDraft.curWorldY
                      )}
                      fill="none"
                      stroke="#20D5EC"
                      strokeWidth={2}
                      strokeDasharray="6 5"
                      className="animate-wire-active"
                    />
                  );
                })
              ) : (
                <path
                  d={buildCubicBezierPath(
                    wireDraft.startWorldX,
                    wireDraft.startWorldY,
                    wireDraft.curWorldX,
                    wireDraft.curWorldY
                  )}
                  fill="none"
                  stroke="#20D5EC"
                  strokeWidth={2}
                  strokeDasharray="6 5"
                  className="animate-wire-active"
                />
              )}
              <circle
                cx={wireDraft.curWorldX}
                cy={wireDraft.curWorldY}
                r={5}
                fill="#20D5EC"
              />
            </g>
          )}
        </svg>

        {/* Multi-Reference Group Bounding Halo + Right-Edge (+) Formation Handle */}
        {selectionGroupBounds && (
          <div
            style={{
              left: `${selectionGroupBounds.minX - 16}px`,
              top: `${selectionGroupBounds.minY - 16}px`,
              width: `${selectionGroupBounds.width + 32}px`,
              height: `${selectionGroupBounds.height + 32}px`,
            }}
            className="absolute rounded-[18px] border border-[#20D5EC]/45 bg-[#20D5EC]/[0.025] pointer-events-none z-[5]"
          >
            <div className="absolute -top-7 left-1 px-2.5 py-0.5 rounded-full bg-[#132227]/95 border border-[#20D5EC]/40 text-[11px] font-medium text-[#7ceeff] flex items-center gap-1.5 shadow-lg">
              <span className="w-1.5 h-1.5 rounded-full bg-[#20D5EC] animate-pulse" />
              <span>
                {selectionGroupBounds.nodes.length} References Selected · Ready to Connect
              </span>
            </div>
            <button
              type="button"
              onPointerDown={(e) =>
                beginWireDraftFromSources(
                  e,
                  'right',
                  selectionGroupBounds.nodeIds,
                  selectionGroupBounds.handleX,
                  selectionGroupBounds.handleY
                )
              }
              title={`Connect all ${selectionGroupBounds.nodes.length} selected references into a new node`}
              style={{
                left: `${selectionGroupBounds.width + 32 - 4}px`,
                top: '50%',
              }}
              className="pointer-events-auto absolute -translate-y-1/2 w-[30px] h-[30px] rounded-full bg-[#102026] border border-[#20D5EC] text-[#20D5EC] hover:bg-[#20D5EC] hover:text-[#0b0d10] shadow-[0_0_0_5px_rgba(32,213,236,0.16)] flex items-center justify-center transition-all"
            >
              <Plus className="w-4 h-4" strokeWidth={2} />
            </button>
          </div>
        )}

        {/* Spatial Canvas Nodes */}
        {nodes.map((node) => {
          const isSelected = selectedNodeIds.includes(node.id);
          const isHovered = hoveredNodeId === node.id;
          const showPorts = isSelected || isHovered || wireDraft?.sourceNodeId === node.id;
          const KindIcon = getNodeKindIcon(node.kind);
          const isUnmuted = Boolean(unmutedNodeIds[node.id]);
          const isPaused = Boolean(pausedNodeIds[node.id]);
          const platformBadge = getPlatformBadgeLabel(
            node.platformId,
            node.modelId,
            platformsCatalog,
            externalMcpServers
          );
          const incomingUpstreamNodes = edges
            .filter((ed) => ed.targetId === node.id)
            .map((ed) => nodeMap.get(ed.sourceId))
            .filter((nn): nn is CanvasNode => Boolean(nn));
          const readyUpstreamImages = incomingUpstreamNodes.filter(
            (nn) =>
              (nn.kind === 'image' || nn.kind === 'element' || nn.kind === 'contact-sheet') &&
              Boolean(nn.imageUrl)
          );
          const readyUpstreamVideos = incomingUpstreamNodes.filter(
            (nn) => nn.kind === 'video' && Boolean(nn.videoUrl)
          );
          const readyUpstreamTexts = incomingUpstreamNodes.filter(
            (nn) => (nn.kind === 'text' || nn.kind === 'sticky') && Boolean(nn.prompt.trim())
          );
          const pendingUpstreamImages = incomingUpstreamNodes.filter(
            (nn) =>
              (nn.kind === 'image' || nn.kind === 'element' || nn.kind === 'contact-sheet') &&
              !nn.imageUrl
          );
          const totalImgRefs = Math.max(
            readyUpstreamImages.length,
            node.referenceUrls?.length || 0
          );
          const totalVidRefs = Math.max(
            readyUpstreamVideos.length,
            node.videoReferenceUrls?.length || 0
          );
          const totalTxtRefs = readyUpstreamTexts.length;
          const refSummaryParts = [
            totalImgRefs > 0 ? `${totalImgRefs} Image${totalImgRefs > 1 ? 's' : ''}` : '',
            totalVidRefs > 0 ? `${totalVidRefs} Video` : '',
            totalTxtRefs > 0 ? `${totalTxtRefs} Text` : '',
          ].filter(Boolean);
          const refsReadyLabel =
            refSummaryParts.length > 0
              ? `References Ready · ${refSummaryParts.join(' · ')}`
              : '';

          return (
            <div
              key={node.id}
              style={{
                left: `${node.x}px`,
                top: `${node.y}px`,
                width: `${node.width}px`,
                height: `${node.height}px`,
              }}
              onMouseEnter={() => {
                cancelNodeHoverClear();
                setHoveredNodeId(node.id);
              }}
              onMouseLeave={() => scheduleNodeHoverClear(node.id)}
              onPointerDown={(e) => handleNodePointerDown(e, node)}
              onContextMenu={(e) => handleNodeContextMenu(e, node)}
              className="absolute group"
            >
              {/* Outside Top-Left Node Header Label (-24px above frame) */}
              <div
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  setRenamingNodeId(node.id);
                }}
                className="absolute -top-[24px] left-0 right-0 h-[20px] flex items-center justify-between gap-2 pointer-events-auto"
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <KindIcon
                    className={`w-[13px] h-[13px] shrink-0 transition-colors ${
                      isSelected ? 'text-white/90' : 'text-white/45'
                    }`}
                    strokeWidth={1.5}
                  />
                  {renamingNodeId === node.id ? (
                    <input
                      autoFocus
                      value={node.title}
                      onChange={(e) =>
                        updateNodeFields(node.id, { title: e.target.value })
                      }
                      onBlur={() => setRenamingNodeId(null)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === 'Escape') {
                          setRenamingNodeId(null);
                        }
                      }}
                      onPointerDown={(e) => e.stopPropagation()}
                      className="bg-[#252525] text-[12px] text-white px-1.5 py-0.5 rounded-[5px] outline-none border border-white/25"
                    />
                  ) : (
                    <span
                      className={`text-[12px] font-medium truncate transition-colors ${
                        isSelected
                          ? 'text-white/95'
                          : 'text-white/55 group-hover:text-white/80'
                      }`}
                    >
                      {node.title}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5 shrink-0 max-w-[68%]">
                  {platformBadge &&
                    node.kind !== 'timeline' &&
                    node.kind !== 'sticky' &&
                    node.kind !== 'text' && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[5px] bg-[#191919] border border-white/[0.08] text-[10px] font-medium text-white/75 truncate">
                        {node.platformId && (
                          <PlatformBrandIcon platformId={node.platformId} size="xs" />
                        )}
                        <span className="truncate">{platformBadge}</span>
                      </span>
                    )}
                  {node.resolution &&
                    node.kind !== 'timeline' &&
                    node.kind !== 'sticky' &&
                    node.kind !== 'text' &&
                    node.kind !== 'audio' && (
                      <span className="font-mono text-[10px] text-white/35 shrink-0">
                        {node.resolution}
                        {node.quality ? ` · ${node.quality}` : ''}
                      </span>
                    )}
                </div>
              </div>

              {/* Left (+) Circular Port Handle with Continuous Hover Bridge */}
              <div
                onMouseEnter={() => {
                  cancelNodeHoverClear();
                  setHoveredNodeId(node.id);
                }}
                onMouseLeave={() => scheduleNodeHoverClear(node.id)}
                className={`absolute -left-[44px] top-1/2 -translate-y-1/2 w-[46px] h-[56px] flex items-center justify-start pl-[10px] z-20 ${
                  showPorts ? 'pointer-events-auto' : 'pointer-events-none'
                }`}
              >
                <button
                  type="button"
                  onPointerDown={(e) => handlePortPointerDown(e, node, 'left')}
                  title="Drag wire or click to place upstream reference node"
                  className={`w-[26px] h-[26px] rounded-full bg-[#191919] border border-white/25 hover:border-[#20D5EC] text-white/75 hover:text-[#20D5EC] hover:shadow-[0_0_0_4px_rgba(32,213,236,0.18)] flex items-center justify-center transition-all ${
                    showPorts ? 'opacity-100 scale-100' : 'opacity-0 scale-90'
                  }`}
                >
                  <Plus className="w-3.5 h-3.5" strokeWidth={1.75} />
                </button>
              </div>

              {/* Right (+) Circular Port Handle with Continuous Hover Bridge */}
              <div
                onMouseEnter={() => {
                  cancelNodeHoverClear();
                  setHoveredNodeId(node.id);
                }}
                onMouseLeave={() => scheduleNodeHoverClear(node.id)}
                className={`absolute -right-[44px] top-1/2 -translate-y-1/2 w-[46px] h-[56px] flex items-center justify-end pr-[10px] z-20 ${
                  showPorts ? 'pointer-events-auto' : 'pointer-events-none'
                }`}
              >
                <button
                  type="button"
                  onPointerDown={(e) => handlePortPointerDown(e, node, 'right')}
                  title="Drag wire or click to spawn connected downstream node"
                  className={`w-[26px] h-[26px] rounded-full bg-[#191919] border border-white/25 hover:border-[#20D5EC] text-white/75 hover:text-[#20D5EC] hover:shadow-[0_0_0_4px_rgba(32,213,236,0.18)] flex items-center justify-center transition-all ${
                    showPorts ? 'opacity-100 scale-100' : 'opacity-0 scale-90'
                  }`}
                >
                  <Plus className="w-3.5 h-3.5" strokeWidth={1.75} />
                </button>
              </div>

              {/* Full-Bleed Matte Card Container */}
              <div
                className={`relative w-full h-full rounded-[12px] overflow-hidden bg-[#191919] transition-shadow ${
                  isSelected
                    ? 'border border-white/[0.45] shadow-node-selected'
                    : 'border border-white/[0.08] hover:border-white/[0.2] shadow-[0_12px_34px_rgba(0,0,0,0.48)]'
                }`}
              >
                {/* 1. TIMELINE NODE */}
                {node.kind === 'timeline' && <TimelineCanvasNode node={node} />}

                {/* 2. VIDEO NODE */}
                {node.kind === 'video' && (
                  <div className="relative w-full h-full bg-[#141414]">
                    {node.videoUrl ? (
                      <>
                        <SmartMediaVideo
                          videoUrl={node.videoUrl}
                          posterUrl={node.imageUrl || readyUpstreamImages[0]?.imageUrl}
                          playing={!isPaused}
                          muted={!isUnmuted}
                          fallbackPrompt={node.prompt}
                          fallbackSeed={node.seed}
                          fallbackTheme={node.videoTheme}
                          fallbackDurationSec={node.durationSec || 5}
                          aspectRatio={node.aspectRatio}
                          className="w-full h-full object-cover"
                        />

                        {/* Subtle Hover Audio & Play Micro-Controls */}
                        <div
                          onPointerDown={(e) => e.stopPropagation()}
                          className="absolute top-2.5 right-2.5 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <button
                            type="button"
                            onClick={() =>
                              setPausedNodeIds((p) => ({
                                ...p,
                                [node.id]: !p[node.id],
                              }))
                            }
                            className="w-7 h-7 rounded-full bg-black/65 hover:bg-black/85 backdrop-blur-md flex items-center justify-center text-white/90"
                            title={isPaused ? 'Play video' : 'Pause video'}
                          >
                            {isPaused ? (
                              <Play className="w-3.5 h-3.5 ml-0.5" strokeWidth={1.75} />
                            ) : (
                              <Pause className="w-3.5 h-3.5" strokeWidth={1.75} />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setUnmutedNodeIds((m) => ({
                                ...m,
                                [node.id]: !m[node.id],
                              }))
                            }
                            className="w-7 h-7 rounded-full bg-black/65 hover:bg-black/85 backdrop-blur-md flex items-center justify-center text-white/90"
                            title={isUnmuted ? 'Mute clip audio' : 'Unmute clip audio'}
                          >
                            {isUnmuted ? (
                              <Volume2
                                className="w-3.5 h-3.5 text-[#20D5EC]"
                                strokeWidth={1.75}
                              />
                            ) : (
                              <VolumeX
                                className="w-3.5 h-3.5 text-white/75"
                                strokeWidth={1.75}
                              />
                            )}
                          </button>
                        </div>

                        {/* Dreamina Minimal Bottom-Right Duration Pill */}
                        <div className="absolute bottom-2.5 right-2.5 px-2 py-0.5 rounded-[6px] bg-black/65 backdrop-blur-md font-mono text-[11px] tabular-nums text-white/90 pointer-events-none">
                          {formatDurationPill(node.durationSec)}
                        </div>
                      </>
                    ) : readyUpstreamImages.length > 0 ? (
                      <div className="relative w-full h-full bg-[#191919] flex flex-col items-center justify-center">
                        <SmartMediaImage
                          src={readyUpstreamImages[0].imageUrl}
                          alt={readyUpstreamImages[0].title}
                          aspectRatio={node.aspectRatio}
                          className="absolute inset-0 w-full h-full object-cover opacity-35"
                        />
                        <div className="relative z-10 px-4 py-3 rounded-[10px] bg-[#141414]/90 backdrop-blur-md border border-white/[0.12] flex flex-col items-center gap-1.5 text-center max-w-[85%]">
                          <div className="flex items-center gap-1.5 text-[11.5px] font-medium text-[#20D5EC]">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#20D5EC]" />
                            <span>
                              Reference Ready · {readyUpstreamImages[0].title}
                              {readyUpstreamImages.length > 1
                                ? ` +${readyUpstreamImages.length - 1}`
                                : ''}
                            </span>
                          </div>
                          <p className="text-[11.5px] text-white/65 leading-snug">
                            {node.prompt.trim()
                              ? node.prompt
                              : 'Select video model & prompt below to animate this reference'}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="w-full h-full bg-[#191919] p-5 flex flex-col items-center justify-center text-center gap-2.5">
                        <div className="w-10 h-10 rounded-[10px] bg-[#252525] border border-white/[0.07] flex items-center justify-center text-white/45">
                          <Clapperboard className="w-5 h-5" strokeWidth={1.5} />
                        </div>
                        <div className="space-y-1 max-w-[86%]">
                          <div className="text-[12.5px] font-medium text-white/80">
                            {platformBadge || 'Create Video'}
                          </div>
                          <p className="text-[11.5px] text-white/42 leading-relaxed">
                            {node.prompt.trim()
                              ? node.prompt
                              : 'Choose platform, video model & prompt in the bar below'}
                          </p>
                        </div>
                        {refsReadyLabel ? (
                          <div className="mt-1 px-2.5 py-1 rounded-[6px] bg-[#132227] border border-[#20D5EC]/35 text-[10.5px] font-medium text-[#7ceeff] flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#20D5EC]" />
                            <span>{refsReadyLabel}</span>
                          </div>
                        ) : (
                          pendingUpstreamImages.length > 0 && (
                            <div className="mt-1 px-2.5 py-1 rounded-[6px] bg-[#252525] border border-[#20D5EC]/30 text-[11px] text-[#20D5EC] flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#20D5EC]" />
                              <span>
                                Linked to {pendingUpstreamImages[0].title} · Waiting for image
                              </span>
                            </div>
                          )
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* 3. IMAGE / CONTACT-SHEET / ELEMENT NODE */}
                {(node.kind === 'image' ||
                  node.kind === 'contact-sheet' ||
                  node.kind === 'element') && (
                  <div
                    style={
                      node.isTransparentCutout && node.imageUrl
                        ? {
                            backgroundImage:
                              'repeating-conic-gradient(#1b1b1b 0% 25%, #111111 0% 50%)',
                            backgroundSize: '18px 18px',
                          }
                        : undefined
                    }
                    className="relative w-full h-full bg-[#141414]"
                  >
                    {node.imageUrl ? (
                      <>
                        {node.generatedOutputs &&
                        node.generatedOutputs.length > 1 &&
                        (node.batchViewMode ?? 'grid') === 'grid' ? (
                          <div
                            onPointerDown={(e) => e.stopPropagation()}
                            className={`w-full h-full bg-[#111] grid grid-cols-2 ${
                              node.generatedOutputs.length > 2 ? 'grid-rows-2' : ''
                            } gap-1.5 p-1.5`}
                          >
                            {node.generatedOutputs.map((outUrl, idx) => {
                              const isPrimary = node.imageUrl === outUrl;
                              return (
                                <div
                                  key={`${outUrl}_${idx}`}
                                  onClick={() => updateNodeFields(node.id, { imageUrl: outUrl })}
                                  onDoubleClick={() =>
                                    updateNodeFields(node.id, {
                                      imageUrl: outUrl,
                                      batchViewMode: 'single',
                                    })
                                  }
                                  title={`Variation #${idx + 1} — Click to select, double-click to solo`}
                                  className={`group/tile relative rounded-[7px] overflow-hidden cursor-pointer border transition-all ${
                                    isPrimary
                                      ? 'border-[#20D5EC] ring-1 ring-[#20D5EC]/60'
                                      : 'border-white/[0.08] hover:border-white/30'
                                  }`}
                                >
                                  <SmartMediaImage
                                    src={outUrl}
                                    alt={`${node.title} #${idx + 1}`}
                                    aspectRatio={node.aspectRatio}
                                    fallbackPrompt={node.prompt}
                                    fallbackSeed={(node.seed || 100) + idx}
                                    className="w-full h-full object-cover"
                                  />
                                  <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/75 border border-white/15 font-mono text-[10px] font-semibold text-white">
                                    #{idx + 1}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      splitBatchNodeToIndividualNodes(node.id, idx);
                                    }}
                                    title={`Pop out variation #${idx + 1} as Node`}
                                    className="opacity-0 group-hover/tile:opacity-100 transition-opacity absolute top-1.5 right-1.5 w-6 h-6 rounded-[6px] bg-black/80 hover:bg-[#20D5EC] text-white hover:text-[#0b0d10] border border-white/15 flex items-center justify-center"
                                  >
                                    <ArrowUpRight className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <SmartMediaImage
                            src={node.imageUrl}
                            alt={node.title}
                            aspectRatio={node.aspectRatio}
                            fallbackPrompt={node.prompt}
                            fallbackSeed={node.seed}
                            isContactSheet={node.kind === 'contact-sheet'}
                            className={`w-full h-full ${
                              node.isTransparentCutout ? 'object-contain' : 'object-cover'
                            }`}
                          />
                        )}

                        {node.generatedOutputs && node.generatedOutputs.length > 1 && (
                          <div
                            onPointerDown={(e) => e.stopPropagation()}
                            className="absolute bottom-2 left-2 right-2 flex items-center justify-between gap-1.5 pointer-events-none"
                          >
                            {(node.batchViewMode ?? 'grid') === 'single' ? (
                              <div className="pointer-events-auto flex items-center gap-1 p-1 rounded-[8px] bg-black/75 backdrop-blur-md border border-white/[0.14]">
                                {node.generatedOutputs.map((outUrl, idx) => (
                                  <button
                                    key={idx}
                                    type="button"
                                    onClick={() =>
                                      updateNodeFields(node.id, { imageUrl: outUrl })
                                    }
                                    title={`Select batch output #${idx + 1}`}
                                    className={`w-7 h-7 rounded-[5px] overflow-hidden border transition-all ${
                                      node.imageUrl === outUrl
                                        ? 'border-[#20D5EC] scale-105'
                                        : 'border-white/20 opacity-70 hover:opacity-100'
                                    }`}
                                  >
                                    <SmartMediaImage
                                      src={outUrl}
                                      alt={`Variant ${idx + 1}`}
                                      className="w-full h-full object-cover"
                                    />
                                  </button>
                                ))}
                              </div>
                            ) : (
                              <div />
                            )}

                            <div className="pointer-events-auto flex items-center gap-1 p-1 rounded-[8px] bg-black/80 backdrop-blur-md border border-white/[0.14]">
                              <button
                                type="button"
                                onClick={() =>
                                  updateNodeFields(node.id, {
                                    batchViewMode:
                                      (node.batchViewMode ?? 'grid') === 'grid'
                                        ? 'single'
                                        : 'grid',
                                  })
                                }
                                className="h-6 px-2 rounded-[5px] bg-white/[0.06] hover:bg-white/[0.14] text-[10.5px] font-medium text-white/90 flex items-center gap-1"
                              >
                                <Grid2X2 className="w-3 h-3 text-[#20D5EC]" />
                                <span>
                                  {(node.batchViewMode ?? 'grid') === 'grid'
                                    ? '2×2 Grid'
                                    : 'Solo'}
                                </span>
                              </button>
                              <button
                                type="button"
                                onClick={() => splitBatchNodeToIndividualNodes(node.id)}
                                className="h-6 px-2 rounded-[5px] bg-[#20D5EC]/15 hover:bg-[#20D5EC] text-[#7ceeff] hover:text-[#0b0d10] border border-[#20D5EC]/35 text-[10.5px] font-semibold transition-colors"
                              >
                                Split into {node.generatedOutputs.length} Nodes
                              </button>
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="w-full h-full bg-[#191919] p-4 flex flex-col items-center justify-center text-center gap-2.5">
                        <div className="w-10 h-10 rounded-[10px] bg-[#252525] border border-white/[0.07] flex items-center justify-center text-white/45">
                          <KindIcon className="w-5 h-5" strokeWidth={1.5} />
                        </div>
                        <div className="space-y-1 max-w-[88%]">
                          <div className="text-[12.5px] font-medium text-white/80">
                            {node.kind === 'element'
                              ? `Reference Anchor ${node.elementHandles[0] || '@Ref_1'}`
                              : platformBadge || 'Create Image'}
                          </div>
                          <p className="text-[11.5px] text-white/42 leading-relaxed line-clamp-2">
                            {node.prompt.trim()
                              ? node.prompt
                              : 'Select model & prompt below to generate, or upload a reference'}
                          </p>
                        </div>

                        <div
                          onPointerDown={(e) => e.stopPropagation()}
                          className="flex items-center gap-2 mt-0.5"
                        >
                          <button
                            type="button"
                            onClick={() => {
                              pendingNodeUploadIdRef.current = node.id;
                              nodeRefUploadInputRef.current?.click();
                            }}
                            className="h-7 px-2.5 rounded-[7px] bg-[#252525] hover:bg-white/[0.12] border border-white/[0.09] text-[11.5px] text-white/85 flex items-center gap-1.5 transition-colors"
                          >
                            <Upload className="w-3 h-3 text-white/65" strokeWidth={1.6} />
                            <span>Upload Image</span>
                          </button>
                        </div>

                        {(refsReadyLabel || pendingUpstreamImages.length > 0) && (
                          <div className="mt-0.5 px-2.5 py-1 rounded-[6px] bg-[#132227] border border-[#20D5EC]/35 text-[10.5px] font-medium text-[#7ceeff] flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#20D5EC]" />
                            <span>
                              {refsReadyLabel ||
                                `Linked to ${pendingUpstreamImages[0].title} · Waiting`}
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {node.kind === 'element' && (
                      <div
                        onPointerDown={(e) => e.stopPropagation()}
                        className="absolute top-2.5 left-2.5"
                      >
                        {editingHandleNodeId === node.id ? (
                          <input
                            autoFocus
                            defaultValue={node.elementHandles[0] || '@Ref_1'}
                            onBlur={(e) => {
                              const raw = e.target.value.trim() || '@Ref_1';
                              const clean = raw.startsWith('@') ? raw : `@${raw}`;
                              updateNodeFields(node.id, { elementHandles: [clean] });
                              setEditingHandleNodeId(null);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === 'Escape') {
                                (e.target as HTMLInputElement).blur();
                              }
                            }}
                            className="w-28 h-6 px-2 rounded-[6px] bg-[#252525] border border-[#20D5EC]/60 text-[11px] font-mono text-white outline-none"
                          />
                        ) : (
                          <button
                            type="button"
                            onClick={() => setEditingHandleNodeId(node.id)}
                            title="Click to rename @Reference tag"
                            className="px-2 py-0.5 rounded-[6px] bg-black/75 hover:bg-[#252525] backdrop-blur-md border border-white/[0.14] text-[11px] font-mono text-[#20D5EC]"
                          >
                            {node.elementHandles[0] || '@Ref_1'}
                          </button>
                        )}
                      </div>
                    )}

                    {node.kind === 'contact-sheet' && node.imageUrl && (
                      <button
                        type="button"
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={() => void sliceContactSheetNode(node.id, 3, 3)}
                        className="absolute bottom-2.5 right-2.5 h-7 px-2.5 rounded-[7px] bg-black/75 hover:bg-white hover:text-[#0e0e0e] backdrop-blur-md border border-white/[0.14] text-[11.5px] font-medium text-white/90 flex items-center gap-1.5 transition-colors"
                      >
                        <Grid3X3 className="w-3.5 h-3.5" strokeWidth={1.5} />
                        <span>Slice 3×3 Grid</span>
                      </button>
                    )}

                    {/* Interactive Brush Mask Overlay when Inpaint is active */}
                    {activeInpaintNodeId === node.id && node.imageUrl && (
                      <InpaintMaskOverlay
                        node={node}
                        onCancel={onCloseInpaint}
                        onApply={(maskUrl, regionalPrompt) => {
                          void applyInpaintToNode(node.id, maskUrl, regionalPrompt);
                          onCloseInpaint();
                        }}
                      />
                    )}
                  </div>
                )}

                {/* 4. TEXT NODE */}
                {node.kind === 'text' && (
                  <div
                    onPointerDown={(e) => {
                      if (isSelected) e.stopPropagation();
                    }}
                    className="w-full h-full p-4 bg-[#191919] flex flex-col justify-between"
                  >
                    <textarea
                      value={node.prompt}
                      onChange={(e) =>
                        updateNodeFields(node.id, { prompt: e.target.value })
                      }
                      placeholder="Write script notes, camera beats, or dialogue…"
                      className="w-full flex-1 bg-transparent resize-none outline-none text-[14px] leading-relaxed text-white/90 placeholder:text-white/30"
                    />
                    <div className="text-[11px] text-white/30 flex items-center justify-between pt-2 border-t border-white/[0.06]">
                      <span>Script / Prompt Node</span>
                      <span>{node.prompt.length} chars</span>
                    </div>
                  </div>
                )}

                {/* 5. STICKY NOTE NODE */}
                {node.kind === 'sticky' && (
                  <div
                    onPointerDown={(e) => {
                      if (isSelected) e.stopPropagation();
                    }}
                    className="w-full h-full p-4 bg-[#232019] flex flex-col justify-between"
                  >
                    <textarea
                      value={node.prompt}
                      onChange={(e) =>
                        updateNodeFields(node.id, { prompt: e.target.value })
                      }
                      placeholder="Director note…"
                      className="w-full flex-1 bg-transparent resize-none outline-none text-[13.5px] leading-relaxed text-[#f3ead3] placeholder:text-[#f3ead3]/35"
                    />
                    <span className="text-[10.5px] text-[#f3ead3]/40">
                      Sticky Note
                    </span>
                  </div>
                )}

                {/* 6. AUDIO NODE */}
                {node.kind === 'audio' && (
                  <AudioCanvasCard node={node} />
                )}

                {/* 7. STYLE DNA / CINEMA KIT NODE */}
                {node.kind === 'style-dna' && (
                  <div className="w-full h-full p-4 bg-[#191919] flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                      <span className="text-[12.5px] font-medium text-white/90">
                        {node.styleDna?.presetName || 'Cinema Grade DNA'}
                      </span>
                      <span className="px-2 py-0.5 rounded-[5px] bg-[#252525] text-[10.5px] text-white/65">
                        Locked
                      </span>
                    </div>

                    <div className="grid grid-cols-5 gap-1.5 my-2">
                      {(
                        node.styleDna?.palette || [
                          '#0F172A',
                          '#1E293B',
                          '#20D5EC',
                          '#F59E0B',
                          '#F8FAFC',
                        ]
                      ).map((hex, idx) => (
                        <div
                          key={idx}
                          style={{ backgroundColor: hex }}
                          className="h-9 rounded-[7px] border border-white/15"
                        />
                      ))}
                    </div>

                    <div className="space-y-1 text-[11.5px] text-white/60">
                      <div className="truncate">
                        Lens: {node.styleDna?.lens || 'Cooke S4/i 35mm T2.0'}
                      </div>
                      <div className="truncate">
                        Stock: {node.styleDna?.filmStock || 'Kodak Vision3 250D'}
                      </div>
                    </div>
                  </div>
                )}

                {/* 8. MCP TOOL NODE */}
                {node.kind === 'mcp-tool' && (
                  <div className="w-full h-full p-4 bg-[#191919] flex flex-col justify-between">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="px-2 py-0.5 rounded-[5px] bg-[#252525] font-mono text-[11px] text-white/85">
                          {node.mcpTool?.name || 'mcp_tool'}
                        </span>
                        <span className="text-[10.5px] text-[#10b981] font-mono">
                          :3001/mcp
                        </span>
                      </div>
                      <p className="text-[12px] text-white/60 line-clamp-3 leading-relaxed">
                        {node.mcpTool?.description || node.prompt}
                      </p>
                    </div>
                    <button
                      type="button"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={() => void executeMcpToolNode(node.id)}
                      className="h-8 w-full rounded-[8px] bg-white hover:bg-[#e5e5e5] text-[#0e0e0e] text-[12px] font-semibold flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <Play className="w-3.5 h-3.5" strokeWidth={1.75} />
                      <span>Execute MCP Tool</span>
                    </button>
                  </div>
                )}

                {/* Generating / Active Edit Progress Overlay */}
                {node.status === 'generating' && (
                  <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center gap-2 z-20">
                    <Loader2
                      className="w-6 h-6 text-white animate-spin"
                      strokeWidth={1.75}
                    />
                    <span className="font-mono text-[12px] text-white/90">
                      {node.editBadge ||
                        `Rendering ${node.progress ? `${node.progress}%` : '…'}`}
                    </span>
                  </div>
                )}

                {node.status !== 'generating' && node.editBadge && (
                  <div className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-[7px] bg-[#191919]/95 border border-white/[0.15] backdrop-blur-md flex items-center gap-1.5 z-20 pointer-events-none">
                    <Loader2
                      className="w-3 h-3 text-[#20D5EC] animate-spin"
                      strokeWidth={2}
                    />
                    <span className="font-mono text-[11px] text-white/90">
                      {node.editBadge}
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Marquee Selection Box */}
      {marquee && (
        <div
          style={{
            left: `${Math.min(marquee.startX, marquee.curX)}px`,
            top: `${Math.min(marquee.startY, marquee.curY)}px`,
            width: `${Math.abs(marquee.curX - marquee.startX)}px`,
            height: `${Math.abs(marquee.curY - marquee.startY)}px`,
          }}
          className="absolute border border-white/45 bg-white/[0.05] rounded-[4px] pointer-events-none z-30"
        />
      )}

      {/* Dreamina (+) Wire-Drop Creation Menu (#1e1e1e) */}
      {wireDraft?.frozenForMenu &&
        wireDraft.menuScreenX !== undefined &&
        wireDraft.menuScreenY !== undefined && (
          <div
            style={{
              left: `${wireDraft.menuScreenX}px`,
              top: `${wireDraft.menuScreenY}px`,
            }}
            onPointerDown={(e) => e.stopPropagation()}
            className="fixed w-[216px] p-1.5 rounded-[12px] dreamina-menu z-50 space-y-0.5"
          >
            <div className="px-2.5 py-1 text-[11px] font-medium text-white/45 flex items-center justify-between">
              <span>
                {wireDraft.sourceNodeIds && wireDraft.sourceNodeIds.length > 1
                  ? `Reference ${wireDraft.sourceNodeIds.length} items →`
                  : 'Connect to new'}
              </span>
              <button
                type="button"
                onClick={() => setWireDraft(null)}
                className="text-white/40 hover:text-white"
              >
                <X className="w-3 h-3" strokeWidth={1.5} />
              </button>
            </div>
            {WIRE_DROP_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    if (
                      wireDraft.sourceNodeIds &&
                      wireDraft.sourceNodeIds.length > 1 &&
                      (item.id === 'image' || item.id === 'video' || item.id === 'audio')
                    ) {
                      void spawnConnectedNodeFromSelection(item.id, {
                        nodeIds: wireDraft.sourceNodeIds,
                        x: wireDraft.curWorldX,
                        y: wireDraft.curWorldY,
                        autoGenerate: false,
                      });
                    } else if (item.id === 'camera-3d') {
                      selectNodes(wireDraft.sourceNodeIds || [wireDraft.sourceNodeId]);
                      setCameraDirectorOpen(true);
                    } else {
                      const createdId = spawnDreaminaNodeAt(
                        item.id,
                        wireDraft.curWorldX,
                        wireDraft.curWorldY,
                        {
                          wireFromNodeId: wireDraft.sourceNodeId,
                          wireDirection: wireDraft.direction,
                        }
                      );
                      if (
                        createdId &&
                        wireDraft.sourceNodeIds &&
                        wireDraft.sourceNodeIds.length > 1
                      ) {
                        for (const extraId of wireDraft.sourceNodeIds.slice(1)) {
                          if (wireDraft.direction === 'right') {
                            connectNodes(extraId, createdId, 'lineage');
                          } else {
                            connectNodes(createdId, extraId, 'lineage');
                          }
                        }
                      }
                    }
                    setWireDraft(null);
                  }}
                  className="w-full h-8 px-2.5 rounded-[8px] hover:bg-white/[0.08] text-left text-[12.5px] text-white/90 flex items-center gap-2.5 transition-colors"
                >
                  <Icon className="w-4 h-4 text-white/65" strokeWidth={1.5} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        )}

      {/* Dreamina Right-Click Context Menus (#1e1e1e) */}
      {contextMenu && (
        <div
          style={{
            left: `${contextMenu.screenX}px`,
            top: `${contextMenu.screenY}px`,
          }}
          onPointerDown={(e) => e.stopPropagation()}
          className="fixed w-[224px] p-1.5 rounded-[12px] dreamina-menu z-50 text-[12.5px] select-none"
        >
          {contextMenu.kind === 'canvas' ? (
            <>
              {/* Create new ▸ with 11-item Dreamina side flyout */}
              <div
                className="relative"
                onMouseEnter={openCreateSubmenu}
                onMouseLeave={scheduleCreateSubmenuClose}
              >
                <button
                  type="button"
                  onClick={() =>
                    setCreateSubmenuPinned((pinned) => {
                      const next = !pinned;
                      if (next) openCreateSubmenu();
                      else setCreateSubmenuOpen(false);
                      return next;
                    })
                  }
                  className="w-full h-8 px-2.5 rounded-[8px] hover:bg-white/[0.08] text-white/90 flex items-center justify-between"
                >
                  <span className="flex items-center gap-2">
                    <Plus className="w-3.5 h-3.5 text-white/65" strokeWidth={1.5} />
                    <span>Create new</span>
                  </span>
                  <ChevronRight
                    className="w-3.5 h-3.5 text-white/45"
                    strokeWidth={1.5}
                  />
                </button>

                {createSubmenuOpen && (
                  <div
                    className={`absolute top-0 ${
                      contextMenu.screenX + 448 > window.innerWidth
                        ? 'right-full pr-2 -mr-0.5'
                        : 'left-full pl-2 -ml-0.5'
                    } -my-3 py-3 z-50`}
                  >
                    <div className="w-[220px] p-1.5 rounded-[12px] dreamina-menu space-y-0.5">
                    {CREATE_FLYOUT_ITEMS.map((item) => {
                      const Icon = item.icon;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            if (item.id === 'upload') {
                              pendingUploadWorldRef.current = {
                                x: contextMenu.worldX,
                                y: contextMenu.worldY,
                              };
                              fileUploadRef.current?.click();
                            } else if (item.id === 'camera-3d') {
                              setCameraDirectorOpen(true);
                            } else {
                              spawnDreaminaNodeAt(
                                item.id,
                                contextMenu.worldX,
                                contextMenu.worldY
                              );
                            }
                            setCreateSubmenuPinned(false);
                            setCreateSubmenuOpen(false);
                            setContextMenu(null);
                          }}
                          className="w-full h-8 px-2.5 rounded-[8px] hover:bg-white/[0.08] text-left text-white/90 flex items-center justify-between"
                        >
                          <span className="flex items-center gap-2.5">
                            <Icon
                              className="w-4 h-4 text-white/65"
                              strokeWidth={1.5}
                            />
                            <span>{item.label}</span>
                          </span>
                          {item.shortcut && (
                            <span className="font-mono text-[11px] text-white/35">
                              {item.shortcut}
                            </span>
                          )}
                        </button>
                      );
                    })}
                    </div>
                  </div>
                )}
              </div>

              <div className="my-1 h-px bg-white/[0.07]" />

              <button
                type="button"
                disabled={!clipboardNode}
                onClick={() => {
                  pasteClipboardNode(contextMenu.worldX, contextMenu.worldY);
                  setContextMenu(null);
                }}
                className="w-full h-8 px-2.5 rounded-[8px] hover:bg-white/[0.08] disabled:opacity-35 text-white/90 flex items-center justify-between"
              >
                <span>Paste</span>
                <span className="font-mono text-[11px] text-white/40">⌘V</span>
              </button>

              <button
                type="button"
                disabled={past.length === 0}
                onClick={() => {
                  undo();
                  setContextMenu(null);
                }}
                className="w-full h-8 px-2.5 rounded-[8px] hover:bg-white/[0.08] disabled:opacity-35 text-white/90 flex items-center justify-between"
              >
                <span className="flex items-center gap-2">
                  <Undo2 className="w-3.5 h-3.5 text-white/60" strokeWidth={1.5} />
                  <span>Undo</span>
                </span>
                <span className="font-mono text-[11px] text-white/40">⌘Z</span>
              </button>

              <button
                type="button"
                disabled={future.length === 0}
                onClick={() => {
                  redo();
                  setContextMenu(null);
                }}
                className="w-full h-8 px-2.5 rounded-[8px] hover:bg-white/[0.08] disabled:opacity-35 text-white/90 flex items-center justify-between"
              >
                <span className="flex items-center gap-2">
                  <Redo2 className="w-3.5 h-3.5 text-white/60" strokeWidth={1.5} />
                  <span>Redo</span>
                </span>
                <span className="font-mono text-[11px] text-white/40">⇧⌘Z</span>
              </button>

              <div className="my-1 h-px bg-white/[0.07]" />

              <button
                type="button"
                onClick={() => {
                  tidyUpNodes();
                  setContextMenu(null);
                }}
                className="w-full h-8 px-2.5 rounded-[8px] hover:bg-white/[0.08] text-white/85 flex items-center gap-2"
              >
                <Sparkles className="w-3.5 h-3.5 text-white/60" strokeWidth={1.5} />
                <span>Tidy up nodes</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  fitAllNodesInViewport();
                  setContextMenu(null);
                }}
                className="w-full h-8 px-2.5 rounded-[8px] hover:bg-white/[0.08] text-white/85 flex items-center gap-2"
              >
                <Maximize2 className="w-3.5 h-3.5 text-white/60" strokeWidth={1.5} />
                <span>Fit all in view</span>
              </button>
            </>
          ) : (
            contextNode && (
              <>
                {selectedNodeIds.length >= 2 && selectedNodeIds.includes(contextNode.id) && (
                  <>
                    <div className="px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-wide text-[#7ceeff]">
                      Reference {selectedNodeIds.length} Items →
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        void spawnConnectedNodeFromSelection('image', { autoGenerate: false });
                        setContextMenu(null);
                      }}
                      className="w-full h-8 px-2.5 rounded-[8px] bg-[#20D5EC]/10 hover:bg-[#20D5EC]/20 text-white flex items-center gap-2"
                    >
                      <ImageIcon className="w-3.5 h-3.5 text-[#20D5EC]" strokeWidth={1.6} />
                      <span>Create Image</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        void spawnConnectedNodeFromSelection('video', { autoGenerate: false });
                        setContextMenu(null);
                      }}
                      className="w-full h-8 px-2.5 rounded-[8px] bg-[#20D5EC]/10 hover:bg-[#20D5EC]/20 text-white flex items-center gap-2 mt-0.5"
                    >
                      <Clapperboard className="w-3.5 h-3.5 text-[#20D5EC]" strokeWidth={1.6} />
                      <span>Create Video</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        void spawnConnectedNodeFromSelection('audio', { autoGenerate: false });
                        setContextMenu(null);
                      }}
                      className="w-full h-8 px-2.5 rounded-[8px] hover:bg-white/[0.08] text-white/90 flex items-center gap-2 mt-0.5"
                    >
                      <AudioLines className="w-3.5 h-3.5 text-white/60" strokeWidth={1.6} />
                      <span>Create Audio</span>
                    </button>
                    <div className="my-1 h-px bg-white/[0.07]" />
                  </>
                )}
                <button
                  type="button"
                  onClick={() => {
                    copySelectedNode(contextNode.id);
                    setContextMenu(null);
                  }}
                  className="w-full h-8 px-2.5 rounded-[8px] hover:bg-white/[0.08] text-white/90 flex items-center justify-between"
                >
                  <span className="flex items-center gap-2">
                    <Copy className="w-3.5 h-3.5 text-white/60" strokeWidth={1.5} />
                    <span>Copy</span>
                  </span>
                  <span className="font-mono text-[11px] text-white/40">⌘C</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    duplicateNodes(contextNode.id);
                    setContextMenu(null);
                  }}
                  className="w-full h-8 px-2.5 rounded-[8px] hover:bg-white/[0.08] text-white/90 flex items-center justify-between"
                >
                  <span>Duplicate</span>
                  <span className="font-mono text-[11px] text-white/40">⌘D</span>
                </button>

                <button
                  type="button"
                  disabled={!clipboardNode}
                  onClick={() => {
                    pasteClipboardNode(contextNode.x + 48, contextNode.y + 48);
                    setContextMenu(null);
                  }}
                  className="w-full h-8 px-2.5 rounded-[8px] hover:bg-white/[0.08] disabled:opacity-35 text-white/90 flex items-center justify-between"
                >
                  <span>Paste</span>
                  <span className="font-mono text-[11px] text-white/40">⌘V</span>
                </button>

                <div className="my-1 h-px bg-white/[0.07]" />

                {(contextNode.kind === 'image' ||
                  contextNode.kind === 'video' ||
                  contextNode.kind === 'audio' ||
                  contextNode.kind === 'element' ||
                  contextNode.kind === 'contact-sheet') && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        void generateSingleNode(contextNode.id);
                        setContextMenu(null);
                      }}
                      className="w-full h-8 px-2.5 rounded-[8px] hover:bg-white/[0.08] text-white/95 font-medium flex items-center gap-2"
                    >
                      <Play className="w-3.5 h-3.5 text-[#20D5EC]" strokeWidth={1.75} />
                      <span>Generate Node</span>
                    </button>

                    {edges.some((ed) => ed.sourceId === contextNode.id) && (
                      <button
                        type="button"
                        onClick={() => {
                          void runWorkflowPipeline(contextNode.id);
                          setContextMenu(null);
                        }}
                        className="w-full h-8 px-2.5 rounded-[8px] hover:bg-white/[0.08] text-white/90 flex items-center gap-2"
                      >
                        <GitBranch
                          className="w-3.5 h-3.5 text-[#20D5EC]"
                          strokeWidth={1.6}
                        />
                        <span>Generate &amp; Run Downstream</span>
                      </button>
                    )}

                    <div className="my-1 h-px bg-white/[0.07]" />
                  </>
                )}

                {(contextNode.kind === 'image' || contextNode.kind === 'element') &&
                  contextNode.imageUrl && (
                    <button
                      type="button"
                      onClick={() => {
                        saveNodeAsElementReference(contextNode.id);
                        setContextMenu(null);
                      }}
                      className="w-full h-8 px-2.5 rounded-[8px] hover:bg-white/[0.08] text-white/90 flex items-center gap-2"
                    >
                      <UserSquare2
                        className="w-3.5 h-3.5 text-white/65"
                        strokeWidth={1.5}
                      />
                      <span>Save as @Element Reference</span>
                    </button>
                  )}

                {(contextNode.kind === 'video' ||
                  contextNode.kind === 'image' ||
                  contextNode.kind === 'contact-sheet' ||
                  contextNode.kind === 'audio') && (
                  <button
                    type="button"
                    onClick={() => {
                      sendNodeToTimeline(contextNode.id);
                      setContextMenu(null);
                    }}
                    className="w-full h-8 px-2.5 rounded-[8px] hover:bg-white/[0.08] text-white/90 flex items-center gap-2"
                  >
                    <Film className="w-3.5 h-3.5 text-white/60" strokeWidth={1.5} />
                    <span>
                      {contextNode.kind === 'audio'
                        ? 'Send to Timeline (A1)'
                        : 'Send to Timeline'}
                    </span>
                  </button>
                )}

                {(contextNode.kind === 'image' ||
                  contextNode.kind === 'contact-sheet' ||
                  contextNode.kind === 'element') && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        openInlineEditor('inpaint', contextNode.id);
                        setContextMenu(null);
                      }}
                      className="w-full h-8 px-2.5 rounded-[8px] hover:bg-white/[0.08] text-white/90 flex items-center gap-2"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-white/60" strokeWidth={1.5} />
                      <span>Inpaint Brush…</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        openInlineEditor('outpaint', contextNode.id);
                        setContextMenu(null);
                      }}
                      className="w-full h-8 px-2.5 rounded-[8px] hover:bg-white/[0.08] text-white/90 flex items-center gap-2"
                    >
                      <Maximize2 className="w-3.5 h-3.5 text-white/60" strokeWidth={1.5} />
                      <span>Expand (Outpaint)…</span>
                    </button>
                  </>
                )}

                {(contextNode.kind === 'image' ||
                  contextNode.kind === 'contact-sheet') && (
                  <button
                    type="button"
                    onClick={() => {
                      void sliceContactSheetNode(contextNode.id, 3, 3);
                      setContextMenu(null);
                    }}
                    className="w-full h-8 px-2.5 rounded-[8px] hover:bg-white/[0.08] text-white/90 flex items-center gap-2"
                  >
                    <Grid3X3 className="w-3.5 h-3.5 text-white/60" strokeWidth={1.5} />
                    <span>Slice 9-Grid Sheet</span>
                  </button>
                )}

                {contextNode.kind === 'video' && (
                  <button
                    type="button"
                    onClick={() => {
                      void branchVideoMultiTurn(
                        contextNode.id,
                        'Shift midday courtyard sun to warm late-afternoon amber dusk'
                      );
                      setContextMenu(null);
                    }}
                    className="w-full h-8 px-2.5 rounded-[8px] hover:bg-white/[0.08] text-white/90 flex items-center gap-2"
                  >
                    <GitBranch className="w-3.5 h-3.5 text-white/60" strokeWidth={1.5} />
                    <span>Branch Multi-Turn Edit</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    handleDownloadNodeMedia(contextNode);
                    setContextMenu(null);
                  }}
                  className="w-full h-8 px-2.5 rounded-[8px] hover:bg-white/[0.08] text-white/90 flex items-center gap-2"
                >
                  <Download className="w-3.5 h-3.5 text-white/60" strokeWidth={1.5} />
                  <span>Download</span>
                </button>

                <div className="my-1 h-px bg-white/[0.07]" />

                <button
                  type="button"
                  onClick={() => {
                    deleteSelectedNodes(contextNode.id);
                    setContextMenu(null);
                  }}
                  className="w-full h-8 px-2.5 rounded-[8px] hover:bg-red-500/15 text-red-400 flex items-center justify-between"
                >
                  <span className="flex items-center gap-2">
                    <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                    <span>Delete</span>
                  </span>
                  <span className="font-mono text-[11px] opacity-70">⌫</span>
                </button>
              </>
            )
          )}
        </div>
      )}
    </div>
  );
};

const InpaintMaskOverlay: React.FC<{
  node: CanvasNode;
  onCancel: () => void;
  onApply: (maskDataUrl: string, regionalPrompt: string) => void;
}> = ({ node, onCancel, onApply }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [regionalPrompt, setRegionalPrompt] = useState(
    'Warm afternoon olive branch shadow across limestone wall'
  );
  const drawingRef = useRef(false);

  const drawDot = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = ((clientX - rect.left) / Math.max(1, rect.width)) * canvas.width;
    const y = ((clientY - rect.top) / Math.max(1, rect.height)) * canvas.height;
    ctx.fillStyle = 'rgba(32, 213, 236, 0.55)';
    ctx.beginPath();
    ctx.arc(x, y, 22, 0, Math.PI * 2);
    ctx.fill();
  };

  return (
    <div
      onPointerDown={(e) => e.stopPropagation()}
      className="absolute inset-0 z-20 flex flex-col justify-end"
    >
      <canvas
        ref={canvasRef}
        width={node.width}
        height={node.height}
        onPointerDown={(e) => {
          drawingRef.current = true;
          drawDot(e.clientX, e.clientY);
        }}
        onPointerMove={(e) => {
          if (drawingRef.current) drawDot(e.clientX, e.clientY);
        }}
        onPointerUp={() => {
          drawingRef.current = false;
        }}
        onPointerLeave={() => {
          drawingRef.current = false;
        }}
        className="absolute inset-0 w-full h-full cursor-crosshair"
      />
      <div className="relative m-2.5 p-2 rounded-[10px] bg-[#191919]/95 backdrop-blur-md border border-white/[0.12] flex items-center gap-2">
        <input
          value={regionalPrompt}
          onChange={(e) => setRegionalPrompt(e.target.value)}
          placeholder="Describe regional redraw…"
          className="flex-1 h-7 px-2.5 rounded-[6px] bg-[#252525] text-[12px] text-white outline-none"
        />
        <button
          type="button"
          onClick={onCancel}
          className="h-7 px-2.5 rounded-[6px] bg-[#252525] text-[11.5px] text-white/75 hover:text-white"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => {
            const maskUrl = canvasRef.current?.toDataURL('image/png') || '';
            onApply(maskUrl, regionalPrompt);
          }}
          className="h-7 px-3 rounded-[6px] bg-white text-[#0e0e0e] text-[11.5px] font-semibold"
        >
          Redraw
        </button>
      </div>
    </div>
  );
};

const AudioCanvasCard: React.FC<{ node: CanvasNode }> = ({ node }) => {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [liveDuration, setLiveDuration] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const oscCtxRef = useRef<AudioContext | null>(null);
  const rafTimerRef = useRef<number | null>(null);

  const playableSrc = useMemo(
    () => resolvePlayableAudioUrl(node.audioUrl),
    [node.audioUrl]
  );

  const waveform = useMemo(() => {
    if (Array.isArray(node.waveform) && node.waveform.length > 0) {
      if (node.waveform.length >= 64) return node.waveform.slice(0, 64);
      const padded = [...node.waveform];
      while (padded.length < 64) {
        padded.push(node.waveform[padded.length % node.waveform.length] || 0.35);
      }
      return padded;
    }
    return createDefaultWaveform(node.seed || 305, 64);
  }, [node.waveform, node.seed]);

  useEffect(() => {
    setPlaying(false);
    setProgress(0);
    setLiveDuration(null);
    return () => {
      if (rafTimerRef.current) window.clearInterval(rafTimerRef.current);
      oscCtxRef.current?.close().catch(() => undefined);
    };
  }, [playableSrc]);

  const startSynthFallback = () => {
    try {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      const ctx = new Ctor();
      oscCtxRef.current = ctx;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(164, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(110, ctx.currentTime + 3.0);
      gain.gain.setValueAtTime(0.05, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 3.0);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 3.0);
      setPlaying(true);
      const t0 = performance.now();
      rafTimerRef.current = window.setInterval(() => {
        const p = Math.min(1, (performance.now() - t0) / 3000);
        setProgress(p);
        if (p >= 1) {
          if (rafTimerRef.current) window.clearInterval(rafTimerRef.current);
          setPlaying(false);
          setProgress(0);
        }
      }, 50);
    } catch {
      setPlaying(false);
    }
  };

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (playableSrc && audioRef.current) {
      if (playing) {
        audioRef.current.pause();
        setPlaying(false);
      } else {
        audioRef.current
          .play()
          .then(() => setPlaying(true))
          .catch(() => startSynthFallback());
      }
      return;
    }

    if (playing) {
      if (rafTimerRef.current) window.clearInterval(rafTimerRef.current);
      oscCtxRef.current?.close().catch(() => undefined);
      oscCtxRef.current = null;
      setPlaying(false);
      return;
    }
    startSynthFallback();
  };

  const handleWaveformScrub = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(
      0,
      Math.min(1, (e.clientX - rect.left) / Math.max(1, rect.width))
    );
    setProgress(ratio);
    if (audioRef.current && Number.isFinite(audioRef.current.duration) && audioRef.current.duration > 0) {
      audioRef.current.currentTime = ratio * audioRef.current.duration;
      if (!playing) {
        audioRef.current
          .play()
          .then(() => setPlaying(true))
          .catch(() => undefined);
      }
    }
  };

  const modeLabel =
    node.audioMode === 'tts' || node.audioMode === 'voiceover'
      ? 'Voice TTS'
      : node.audioMode === 'sfx'
      ? 'Sound Effects (SFX)'
      : 'Ambient Audio';

  const displaySec = liveDuration || node.durationSec || 8;

  if (!playableSrc) {
    return (
      <div className="w-full h-full px-4 py-3 bg-[#191919] flex flex-col justify-between">
        <div className="flex items-center justify-between gap-2">
          <span className="px-2 py-0.5 rounded-[5px] bg-[#252525] border border-white/[0.06] text-[10.5px] font-medium text-white/80">
            {modeLabel}
          </span>
          <span className="font-mono text-[10.5px] text-white/40">
            {formatDurationPill(displaySec)}
          </span>
        </div>
        <div className="flex items-center gap-2.5 text-white/55">
          <div className="w-8 h-8 rounded-full bg-[#252525] border border-white/[0.08] flex items-center justify-center shrink-0">
            <AudioLines className="w-4 h-4 text-white/50" strokeWidth={1.5} />
          </div>
          <div className="text-[11.5px] text-white/50 line-clamp-2 leading-snug">
            {node.prompt.trim()
              ? node.prompt
              : 'Select voice or SFX & enter script below to generate'}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full px-4 py-3 bg-[#191919] flex flex-col justify-between">
      {playableSrc && (
        <audio
          ref={audioRef}
          src={playableSrc}
          preload="metadata"
          onLoadedMetadata={(ev) => {
            const d = ev.currentTarget.duration;
            if (Number.isFinite(d) && d > 0) setLiveDuration(d);
          }}
          onTimeUpdate={(ev) => {
            const el = ev.currentTarget;
            const d = Number.isFinite(el.duration) && el.duration > 0 ? el.duration : displaySec;
            setProgress(Math.min(1, Math.max(0, el.currentTime / Math.max(0.1, d))));
          }}
          onEnded={() => {
            setPlaying(false);
            setProgress(0);
          }}
        />
      )}

      {/* Top Row: Mode Tag + Duration Readout */}
      <div className="flex items-center justify-between gap-2">
        <span className="px-2 py-0.5 rounded-[5px] bg-[#252525] border border-white/[0.06] text-[10.5px] font-medium text-white/80">
          {modeLabel}
        </span>
        <span className="font-mono text-[11px] tabular-nums text-white/55">
          {formatDurationPill(displaySec)}
        </span>
      </div>

      {/* Middle Row: Play/Pause + 64-Bar Interactive Waveform */}
      <div className="flex items-center gap-3 my-1">
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={togglePlay}
          title={playing ? 'Pause audio' : 'Play audio'}
          className="w-9 h-9 rounded-full bg-white hover:bg-[#e5e5e5] text-[#0e0e0e] flex items-center justify-center shrink-0 transition-colors"
        >
          {playing ? (
            <Pause className="w-4 h-4" strokeWidth={1.75} />
          ) : (
            <Play className="w-4 h-4 ml-0.5" strokeWidth={1.75} />
          )}
        </button>

        <div
          onPointerDown={(e) => e.stopPropagation()}
          onClick={handleWaveformScrub}
          title="Click to scrub 64-bar waveform"
          className="flex-1 h-10 flex items-center gap-[2px] cursor-pointer py-1"
        >
          {waveform.map((amp, i) => {
            const barRatio = (i + 0.5) / waveform.length;
            const isPlayed = progress > 0 && barRatio <= progress;
            const heightPct = Math.max(12, Math.min(100, Math.round(amp * 100)));
            return (
              <div
                key={i}
                data-waveform-bar={i}
                style={{
                  height: `${heightPct}%`,
                  backgroundColor: isPlayed
                    ? '#20D5EC'
                    : 'rgba(255, 255, 255, 0.22)',
                }}
                className="flex-1 min-w-[2px] rounded-full transition-colors duration-75"
              />
            );
          })}
        </div>
      </div>

      {/* Bottom Row: Prompt Caption */}
      <div className="text-[11px] text-white/50 truncate">{node.prompt}</div>
    </div>
  );
};
