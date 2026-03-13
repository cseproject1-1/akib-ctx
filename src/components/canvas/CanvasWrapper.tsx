import { useCallback, useRef, useEffect, useState, useMemo, memo } from 'react';
import {
  ReactFlow,
  Background,
  MiniMap,
  BackgroundVariant,
  SelectionMode,
  ConnectionMode,
  useReactFlow,
  useViewport,
  type Node,
  type Edge,
  type NodeChange,
  applyNodeChanges,
  type ReactFlowInstance,
} from '@xyflow/react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, Sparkles, MousePointerClick, Search, Maximize2, Eye } from 'lucide-react';
import { debounce } from '@/lib/utils/debounce';
import { useIsMobile } from '@/hooks/use-mobile';
import { uploadCanvasFile } from '@/lib/r2/storage';
import { toast } from 'sonner';
import '@xyflow/react/dist/style.css';

import { useCanvasStore, useNodes, useEdges } from '@/store/canvasStore';
import { HANDLE_IDS } from '@/lib/constants/canvas';
import { CanvasContextMenu } from './CanvasContextMenu';
import { NodeContextMenu } from './NodeContextMenu';
import { EdgeContextMenu } from './EdgeContextMenu';
import { CanvasToolbar } from './CanvasToolbar';
import { NodeExpandModal } from './NodeExpandModal';
import { AddNodeToolbar } from './AddNodeToolbar';
import { PomodoroTimer } from './PomodoroTimer';
import { PinnedNodesPanel } from './PinnedNodesPanel';
import { CanvasStats } from './CanvasStats';
import { SearchPalette } from './SearchPalette';
import { CommandPalette } from './CommandPalette';
import { ThemeEditor } from './ThemeEditor';
import { NodeSelectionToolbar } from './NodeSelectionToolbar';
import { DrawingLayer } from './DrawingLayer';
import { SelectionToolbar } from './SelectionToolbar';
import { TutorialSystem } from './TutorialSystem';
import { ActionPalette } from './ActionPalette';
import { KeyboardShortcutsPanel } from './KeyboardShortcutsPanel';
import { AlignmentGuidesLayer } from './AlignmentGuidesLayer';
import { HistoryPanel } from './HistoryPanel';
import { WorkspaceTabs } from './WorkspaceTabs';
import { NodeSearchPanel, openSearch } from './NodeSearchPanel';
import { PresentationMode } from './PresentationMode';
import { nodeTypes } from './nodeTypes';
import { edgeTypes } from './edgeTypes';
import { cn } from '@/lib/utils';
import { isHotkeyMatch } from '@/lib/utils/hotkeys';
import { useSettingsStore } from '@/store/settingsStore';
import { AISynthesisDialog } from './AISynthesisDialog';
import { NodeErrorBoundary } from './NodeErrorBoundary';
import React from 'react';

const withErrorBoundary = (Component: React.ComponentType<Record<string, unknown>>) => {
  const Wrapped = (props: Record<string, unknown>) => (
    <NodeErrorBoundary nodeId={props.id as string}>
      <Component {...props} />
    </NodeErrorBoundary>
  );
  Wrapped.displayName = `WithErrorBoundary(${Component.displayName || Component.name || 'Component'})`;
  return Wrapped;
};

// Memoize node components to prevent re-renders when other canvas state changes (Feature 3 logic integrated here for convenience)
const memoizeNode = (Component: React.ComponentType<Record<string, unknown>>) => {
  return memo(Component, (prev, next) => {
    return prev.data === next.data && 
           prev.selected === next.selected && 
           prev.dragging === next.dragging;
  });
};

const safeNodeTypes = Object.fromEntries(
  Object.entries(nodeTypes).map(([key, Component]) => [key, memoizeNode(withErrorBoundary(Component as React.ComponentType<Record<string, unknown>>))])
);

const TYPE_LABELS: Record<string, string> = {
  video: '🎥 Video', embed: '🔗 Embed', image: '🖼️ Image', pdf: '📄 PDF',
  codeSnippet: '💻 Code', math: '🧮 Math', table: '📊 Table',
  checklist: '✅ Checklist', summary: '📋 Summary', flashcard: '🃏 Flashcard',
  termQuestion: '📖 Term', aiNote: '📝 Note',
};

/** Compute the best source/target handle IDs based on relative node positions */
function computeBestHandles(sourceNode: Node | undefined, targetNode: Node | undefined): { sourceHandle: string; targetHandle: string } {
  if (!sourceNode || !targetNode) return { sourceHandle: HANDLE_IDS.SOURCE.RIGHT, targetHandle: HANDLE_IDS.TARGET.LEFT };

  const sw = (sourceNode.style?.width as number) || sourceNode.measured?.width || 300;
  const sh = (sourceNode.style?.height as number) || sourceNode.measured?.height || 200;
  const tw = (targetNode.style?.width as number) || targetNode.measured?.width || 300;
  const th = (targetNode.style?.height as number) || targetNode.measured?.height || 200;

  const sCx = sourceNode.position.x + sw / 2;
  const sCy = sourceNode.position.y + sh / 2;
  const tCx = targetNode.position.x + tw / 2;
  const tCy = targetNode.position.y + th / 2;

  const dx = tCx - sCx;
  const dy = tCy - sCy;

  let sourceHandle: string;
  let targetHandle: string;

  // Use a ratio threshold to prevent flickering when nodes are close on one axis
  const ratio = Math.abs(dx) / (Math.abs(dy) || 1);
  const horizontalDominant = ratio > 1.2;
  const verticalDominant = ratio < 0.8;

  if (horizontalDominant) {
    sourceHandle = dx > 0 ? HANDLE_IDS.SOURCE.RIGHT : HANDLE_IDS.SOURCE.LEFT;
    targetHandle = dx > 0 ? HANDLE_IDS.TARGET.LEFT : HANDLE_IDS.TARGET.RIGHT;
  } else if (verticalDominant) {
    sourceHandle = dy > 0 ? HANDLE_IDS.SOURCE.BOTTOM : HANDLE_IDS.SOURCE.TOP;
    targetHandle = dy > 0 ? HANDLE_IDS.TARGET.TOP : HANDLE_IDS.TARGET.BOTTOM;
  } else {
    // Diagonally positioned, check which side is closer to the edge
    if (Math.abs(dx) > Math.abs(dy)) {
      sourceHandle = dx > 0 ? HANDLE_IDS.SOURCE.RIGHT : HANDLE_IDS.SOURCE.LEFT;
      targetHandle = dx > 0 ? HANDLE_IDS.TARGET.LEFT : HANDLE_IDS.TARGET.RIGHT;
    } else {
      sourceHandle = dy > 0 ? HANDLE_IDS.SOURCE.BOTTOM : HANDLE_IDS.SOURCE.TOP;
      targetHandle = dy > 0 ? HANDLE_IDS.TARGET.TOP : HANDLE_IDS.TARGET.BOTTOM;
    }
  }

  return { sourceHandle, targetHandle };
}


export function CanvasWrapper() {
  const nodes = useNodes();
  const edges = useEdges();
  const onNodesChange = useCanvasStore((s) => s.onNodesChange);
  const onEdgesChange = useCanvasStore((s) => s.onEdgesChange);
  const onConnect = useCanvasStore((s) => s.onConnect);
  const setContextMenu = useCanvasStore((s) => s.setContextMenu);
  const setNodeContextMenu = useCanvasStore((s) => s.setNodeContextMenu);
  const setEdgeContextMenu = useCanvasStore((s) => s.setEdgeContextMenu);
  const contextMenu = useCanvasStore((s) => s.contextMenu);
  const undo = useCanvasStore((s) => s.undo);
  const redo = useCanvasStore((s) => s.redo);
  const showMinimap = useCanvasStore((s) => s.showMinimap);
  const toggleMinimap = useCanvasStore((s) => s.toggleMinimap);
  const copySelectedNodes = useCanvasStore((s) => s.copySelectedNodes);
  const pasteNodes = useCanvasStore((s) => s.pasteNodes);
  const selectAllNodes = useCanvasStore((s) => s.selectAllNodes);
  const deleteSelected = useCanvasStore((s) => s.deleteSelected);
  const addNode = useCanvasStore((s) => s.addNode);
  const workspaceId = useCanvasStore((s) => s.workspaceId);
  const canvasMode = useCanvasStore((s) => s.canvasMode);
  const focusMode = useCanvasStore((s) => s.focusMode);
  const toggleFocusMode = useCanvasStore((s) => s.toggleFocusMode);
  const zenMode = useCanvasStore((s) => s.zenMode);
  const toggleZenMode = useCanvasStore((s) => s.toggleZenMode);
  const focusedNodeId = useCanvasStore((s) => s.focusedNodeId);
  const setFocusedNodeId = useCanvasStore((s) => s.setFocusedNodeId);
  const snapEnabled = useCanvasStore((s) => s.snapEnabled);
  const gridStyle = useCanvasStore((s) => s.gridStyle);
  const connectMode = useCanvasStore((s) => s.connectMode);
  const setConnectMode = useCanvasStore((s) => s.setConnectMode);
  const connectSourceId = useCanvasStore((s) => s.connectSourceId);
  const setConnectSourceId = useCanvasStore((s) => s.setConnectSourceId);
  const pushSnapshot = useCanvasStore((s) => s.pushSnapshot);
  const setLastCursorFlowPosition = useCanvasStore((s) => s.setLastCursorFlowPosition);
  const setStoreNodes = useCanvasStore((s) => s.setNodes);
  const isAISynthesisOpen = useCanvasStore((s) => s.isAISynthesisOpen);
  const setAISynthesisOpen = useCanvasStore((s) => s.setAISynthesisOpen);

  const hotkeys = useSettingsStore((s) => s.hotkeys);

  const [localNodes, setLocalNodes] = useState<Node[]>(nodes);
  const [isZoomedOut, setIsZoomedOut] = useState(false);
  const isDraggingRef = useRef(false);
  const prevNodes = useRef<Node[]>(nodes);

  useEffect(() => {
    if (!isDraggingRef.current) {
      // More efficient check to avoid triggering updates if the store didn't actually change content
      if (nodes.length !== prevNodes.current.length) {
        setLocalNodes(nodes);
        prevNodes.current = nodes;
        return;
      }

      const hasChanged = nodes.some((node, i) => {
        const prev = prevNodes.current[i];
        // Basic shallow comparison for common properties that would indicate a change
        return node.id !== prev.id || 
               node.position.x !== prev.position.x || 
               node.position.y !== prev.position.y ||
               node.data !== prev.data || // Data object reference change
               node.type !== prev.type;
      });

      if (hasChanged) {
        setLocalNodes(nodes);
        prevNodes.current = nodes;
      }
    }
  }, [nodes]);

  const debouncedSyncToStore = useMemo(
    () => debounce((n: Node[]) => setStoreNodes(n), 150),
    [setStoreNodes]
  );

  // Cleanup debounce on unmount to prevent leaks
  useEffect(() => {
    return () => {
      debouncedSyncToStore.cancel();
    };
  }, [debouncedSyncToStore]);

  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      setLocalNodes((prev) => {
        const nextNodes = applyNodeChanges(changes, prev);
        const isDrag = changes.some((c) => c.type === 'position' && c.dragging);

        if (isDrag) {
          isDraggingRef.current = true;
          debouncedSyncToStore(nextNodes);
        } else {
          isDraggingRef.current = false;
          debouncedSyncToStore.cancel();
          onNodesChange(changes); // Immediate store sync for selection, remove, etc.
        }
        return nextNodes;
      });
    },
    [onNodesChange, debouncedSyncToStore]
  );

  const reactFlowInstance = useRef<ReactFlowInstance<Node, Edge> | null>(null);
  const routerNavigate = useNavigate();
  const routerLocation = useLocation();

  const isMobile = useIsMobile();
  const [mobileBannerDismissed, setMobileBannerDismissed] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const drawingMode = useCanvasStore((s) => s.drawingMode);
  const setDrawingMode = useCanvasStore((s) => s.setDrawingMode);
  const [drawColor, setDrawColor] = useState('hsl(52, 100%, 50%)'); // kept for future use
  const [drawWidth, setDrawWidth] = useState(3); // kept for future use
  const [guides, setGuides] = useState<{ type: 'v' | 'h'; pos: number; start: number; end: number }[]>([]);

  const SNAP_THRESHOLD = 8;
  const isViewMode = canvasMode === 'view';

  // Compute alignment guides while dragging
  const handleNodeDrag = useCallback((_: React.MouseEvent, draggedNode: Node) => {
    if (isViewMode) return;
    const instance = reactFlowInstance.current;
    const zoom = instance ? instance.getZoom() : 1;
    // Magnetic intensity scales inversely with zoom (easier to snap when zoomed out)
    const dynamicThreshold = SNAP_THRESHOLD / zoom;
    const newGuides: { type: 'v' | 'h'; pos: number; start: number; end: number }[] = [];

    const dw = (typeof draggedNode.style?.width === 'number' ? draggedNode.style.width : draggedNode.measured?.width) || 300;
    const dh = (typeof draggedNode.style?.height === 'number' ? draggedNode.style.height : draggedNode.measured?.height) || 200;
    const dl = draggedNode.position.x;
    const dr = dl + dw;
    const dt = draggedNode.position.y;
    const db = dt + dh;
    const dcx = dl + dw / 2;
    const dcy = dt + dh / 2;

    for (const other of nodes) {
      if (other.id === draggedNode.id) continue;
      const ow = (typeof other.style?.width === 'number' ? other.style.width : other.measured?.width) || 300;
      const oh = (typeof other.style?.height === 'number' ? other.style.height : other.measured?.height) || 200;
      const ol = other.position.x;
      const or2 = ol + ow;
      const ot = other.position.y;
      const ob = ot + oh;
      const ocx = ol + ow / 2;
      const ocy = ot + oh / 2;

      // Vertical guides
      for (const [dv, ov] of [[dl, ol], [dl, or2], [dr, ol], [dr, or2], [dcx, ocx]]) {
        if (Math.abs(dv - ov) < dynamicThreshold) {
          newGuides.push({ type: 'v', pos: ov, start: Math.min(dt, ot) - 20, end: Math.max(db, ob) + 20 });
        }
      }
      // Horizontal guides
      for (const [dv, ov] of [[dt, ot], [dt, ob], [db, ot], [db, ob], [dcy, ocy]]) {
        if (Math.abs(dv - ov) < dynamicThreshold) {
          newGuides.push({ type: 'h', pos: ov, start: Math.min(dl, ol) - 20, end: Math.max(dr, or2) + 20 });
        }
      }
    }
    setGuides(newGuides);
  }, [nodes, isViewMode]);

  const handleNodeDragStop = useCallback((_: React.MouseEvent, node: Node) => {
    setGuides([]);
    isDraggingRef.current = false;
    debouncedSyncToStore.cancel();
    setLocalNodes((current) => {
      setStoreNodes(current);
      return current;
    });
  }, [debouncedSyncToStore, setStoreNodes]);

  // Viewport for virtualization
  const { x: vx, y: vy, zoom } = useViewport();
  // We need to determine the screen dimensions. Defaulting to standard sizes or window if available
  const screenWidth = typeof window !== 'undefined' ? window.innerWidth : 1920;
  const screenHeight = typeof window !== 'undefined' ? window.innerHeight : 1080;
  
  // Viewport bounds in graph coordinates (with a safe padding so things don't pop-in too obviously)
  const padding = 500 / zoom;
  const vLeft = -vx / zoom - padding;
  const vRight = (-vx + screenWidth) / zoom + padding;
  const vTop = -vy / zoom - padding;
  const vBottom = (-vy + screenHeight) / zoom + padding;

  // Apply locked state, view mode, focus mode and Virtualization filter
  const processedNodes = useMemo(() => {
    return localNodes
      .map((n) => {
        // Find rough bounds of node
        const nw = (typeof n.style?.width === 'number' ? n.style.width : n.measured?.width) || 300;
        const nh = (typeof n.style?.height === 'number' ? n.style.height : n.measured?.height) || 200;
        const nx = n.position.x;
        const ny = n.position.y;
        
        // Render window check: skip DOM rendering for nodes outside viewport + buffer
        const isOutOfViewport = (nx + nw < vLeft || nx > vRight || ny + nh < vTop || ny > vBottom);
        
        // Explicitly skip virtualization for heavy media or complex components that 
        // are expensive to reload or maintain internal state.
        const skipVirtualization = [
          'video', 'image', 'audio', 'embed', 'pdf', 'fileAttachment', 
          'spreadsheet', 'focusTimer', 'dailyLog', 'kanban'
        ].includes(n.type || '');
        const shouldRender = skipVirtualization || !isOutOfViewport;

        return {
          ...n,
          hidden: !shouldRender,
          data: { ...n.data, shouldRender },
          draggable: !n.data?.locked,
          selectable: !n.data?.locked,
          connectable: !n.data?.locked,
          style: {
            ...n.style,
            opacity: focusMode && focusedNodeId && focusedNodeId !== n.id ? 0.15 : 1,
            transition: 'opacity 0.3s ease',
          },
        };
      }) as Node[];
  }, [localNodes, focusMode, focusedNodeId, vLeft, vRight, vTop, vBottom]);

  // Pro-level paste type detection with smart title extraction
  const detectPasteType = (text: string, html?: string): { type: string; data: Record<string, unknown>; style?: { width: number; height: number } } => {
    const trimmed = text.trim();
    const lines = trimmed.split('\n');

    // Extract smart title from first line (heading or first few words)
    const extractTitle = (content: string, fallback: string): string => {
      const firstLine = content.split('\n')[0].replace(/^#+\s*/, '').trim();
      if (firstLine.length > 0 && firstLine.length <= 60) return firstLine;
      const words = content.split(/\s+/).slice(0, 5).join(' ');
      return words.length > 50 ? words.slice(0, 47) + '...' : words || fallback;
    };

    // Keep URL detection: Turn pasted links into embed nodes
    if (/^https?:\/\/[^\s]+$/.test(trimmed) && !trimmed.includes('\n')) {
      try {
        const domain = new URL(trimmed).hostname.replace('www.', '');
        return {
          type: 'embed',
          data: { url: trimmed, title: domain },
          style: { width: 450, height: 380 }
        };
      } catch {
        return {
          type: 'embed',
          data: { url: trimmed, title: 'Embedded Link' },
          style: { width: 450, height: 380 }
        };
      }
    }

    // Default: AI note with markdown/html + smart title. Tiptap engine handles UI rendering.
    return {
      type: 'aiNote',
      data: {
        title: extractTitle(trimmed, 'Pasted Note'),
        pasteContent: trimmed,
        pasteFormat: html ? 'html' : 'markdown'
      },
      style: { width: 420, height: Math.min(600, 150 + lines.length * 24) }
    };
  };

  // Handle clipboard paste (images + text + nodes)
  const handleClipboardPaste = useCallback(async () => {
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        // 1. Image binary data (screenshots, copied images)
        const imageType = item.types.find((t) => t.startsWith('image/'));
        if (imageType) {
          const blob = await item.getType(imageType);
          const file = new File([blob], `pasted-image-${Date.now()}.png`, { type: imageType });

          if (!workspaceId) return;
          const nodeId = crypto.randomUUID();
          addNode({
            id: nodeId,
            type: 'image',
            position: { x: Math.random() * 200 - 100, y: Math.random() * 200 - 100 },
            data: { altText: 'Pasted image', uploading: true, progress: 0 },
            style: { width: 320, height: 280 },
          });

          const { uploadCanvasFile } = await import('@/lib/r2/storage');
          try {
            const { url, path } = await uploadCanvasFile(workspaceId, file);
            const { updateNodeData } = useCanvasStore.getState();
            updateNodeData(nodeId, { storageKey: path, storageUrl: url, uploading: false, progress: 100 });
            toast.success('🖼️ Image pasted & uploaded');
          } catch {
            const { updateNodeData } = useCanvasStore.getState();
            updateNodeData(nodeId, { uploading: false });
            toast.error('Failed to upload pasted image');
          }
          return;
        }

        // 2. Read both plain text and HTML
        let plainText = '';
        let htmlContent = '';

        if (item.types.includes('text/plain')) {
          const blob = await item.getType('text/plain');
          plainText = (await blob.text()).trim();
        }
        if (item.types.includes('text/html')) {
          const blob = await item.getType('text/html');
          htmlContent = (await blob.text()).trim();
        }

        if (!plainText && !htmlContent) continue;

        // 3. Run smart detection on plain text
        if (plainText) {
          const detected = detectPasteType(plainText, htmlContent);

          // For non-aiNote types, create the specialized node directly
          if (detected.type !== 'aiNote') {
            addNode({
              id: crypto.randomUUID(),
              type: detected.type,
              position: { x: Math.random() * 200 - 100, y: Math.random() * 200 - 100 },
              data: detected.data,
              style: detected.style || { width: 380, height: 400 },
            });
            toast.success(`${TYPE_LABELS[detected.type] || detected.type} created from paste`);
            return;
          }
        }

        // 4. Rich HTML from AI tools/browsers → aiNote with HTML format
        if (htmlContent) {
          const hasSemanticTags = /<(h[1-6]|table|thead|tbody|tr|th|td|ul|ol|li|pre|code|blockquote|strong|em|img)\b/i.test(htmlContent);
          if (hasSemanticTags) {
            addNode({
              id: crypto.randomUUID(),
              type: 'aiNote',
              position: { x: Math.random() * 200 - 100, y: Math.random() * 200 - 100 },
              data: { title: 'Pasted Note', pasteContent: htmlContent, pasteFormat: 'html' },
              style: { width: 420, height: 500 },
            });
            toast.success('📝 Rich content pasted as note');
            return;
          }
        }

        // 5. Fallback: plain text as markdown note
        if (plainText) {
          const detected = detectPasteType(plainText);
          addNode({
            id: crypto.randomUUID(),
            type: detected.type,
            position: { x: Math.random() * 200 - 100, y: Math.random() * 200 - 100 },
            data: detected.data,
            style: detected.style || { width: 420, height: 500 },
          });
          toast.success(`${TYPE_LABELS[detected.type] || '📝 Note'} created from paste`);
          return;
        }
      }
    } catch {
      // Clipboard API not available or denied — fall back to node paste
      pasteNodes();
    }
  }, [workspaceId, addNode, pasteNodes]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('.tiptap-wrapper') || target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

      const mod = e.metaKey || e.ctrlKey;

      if (isHotkeyMatch(e, hotkeys.undo)) { e.preventDefault(); undo(); }
      if (isHotkeyMatch(e, hotkeys.redo)) { e.preventDefault(); redo(); }
      if (isHotkeyMatch(e, hotkeys.copy)) { e.preventDefault(); copySelectedNodes(); }
      if (isHotkeyMatch(e, hotkeys.paste)) {
        e.preventDefault();
        const { clipboard } = useCanvasStore.getState();
        if (clipboard.length > 0) { pasteNodes(); } else { handleClipboardPaste(); }
      }
      if (isHotkeyMatch(e, hotkeys.selectAll)) { e.preventDefault(); selectAllNodes(); }
      if (isHotkeyMatch(e, hotkeys.fitView)) {
        e.preventDefault();
        reactFlowInstance.current?.fitView({ duration: 300 });
      }
      if (isHotkeyMatch(e, hotkeys.resetZoom)) {
        e.preventDefault();
        reactFlowInstance.current?.zoomTo(1, { duration: 300 });
      }
      if (isHotkeyMatch(e, hotkeys.toggleMinimap)) { e.preventDefault(); toggleMinimap(); }
      if (isHotkeyMatch(e, hotkeys.search)) { e.preventDefault(); openSearch(); }
      if (isHotkeyMatch(e, hotkeys.newNote)) {
        e.preventDefault();
        const pos = useCanvasStore.getState().lastCursorFlowPosition || { x: 0, y: 0 };
        addNode({
          id: crypto.randomUUID(),
          type: 'aiNote',
          position: pos,
          data: { title: 'New Note', content: null },
          style: { width: 380, height: 500 },
        });
      }
      if (isHotkeyMatch(e, hotkeys.toggleZenMode)) { e.preventDefault(); toggleZenMode(); }
      if (isHotkeyMatch(e, hotkeys.toggleFocusMode)) { e.preventDefault(); toggleFocusMode(); }
      if (isHotkeyMatch(e, hotkeys.toggleDrawingMode)) { e.preventDefault(); setDrawingMode(!drawingMode); }

      // Delete selected nodes/edges
      if (e.key === 'Delete' || (e.key === 'Backspace' && !mod)) {
        const { nodes: currentNodes } = useCanvasStore.getState();
        const selectedNodes = currentNodes.filter(n => n.selected);
        if (selectedNodes.length > 0) {
          e.preventDefault();
          deleteSelected();
          toast.success(`Deleted ${selectedNodes.length} node(s)`);
        }
      }

      // Arrow keys to pan the canvas
      const PAN_STEP = 80;
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        const rf = reactFlowInstance.current;
        if (!rf) return;
        // Don't pan if nodes are selected (let React Flow handle node movement)
        const selectedNodes = rf.getNodes().filter((n: Node) => n.selected);
        if (selectedNodes.length > 0) return;
        e.preventDefault();
        const { x, y, zoom } = rf.getViewport();
        const dx = e.key === 'ArrowLeft' ? PAN_STEP : e.key === 'ArrowRight' ? -PAN_STEP : 0;
        const dy = e.key === 'ArrowUp' ? PAN_STEP : e.key === 'ArrowDown' ? -PAN_STEP : 0;
        rf.setViewport({ x: x + dx, y: y + dy, zoom }, { duration: 150 });
      }

      if (e.key === 'Escape') {
        setContextMenu(null);
        setNodeContextMenu(null);
        if (drawingMode) setDrawingMode(false);
        if (useCanvasStore.getState().connectMode) {
          useCanvasStore.getState().setConnectMode(false);
          toast.info('Connector mode cancelled');
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, copySelectedNodes, pasteNodes, selectAllNodes, toggleMinimap, setContextMenu, setNodeContextMenu, drawingMode, setDrawingMode, handleClipboardPaste, hotkeys, addNode, deleteSelected, toggleZenMode, toggleFocusMode]);

  const handleContextMenu = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      if (!reactFlowInstance.current) return;

      const position = reactFlowInstance.current.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      setContextMenu({
        x: Math.min(event.clientX, window.innerWidth - 220),
        y: Math.min(event.clientY, window.innerHeight - 300),
        canvasX: position.x,
        canvasY: position.y,
      });
    },
    [setContextMenu]
  );

  const handleNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node) => {
      event.preventDefault();
      setNodeContextMenu({
        x: event.clientX,
        y: event.clientY,
        nodeId: node.id,
      });
    },
    [setNodeContextMenu]
  );

  const onEdgeContextMenu = useCallback(
    (event: React.MouseEvent, edge: any) => {
      event.preventDefault();
      setEdgeContextMenu({
        x: event.clientX,
        y: event.clientY,
        edgeId: edge.id,
      });
    },
    [setEdgeContextMenu]
  );

  // Auto bring-to-front all selected nodes after box select
  const handleSelectionChange = useCallback(({ nodes: selectedNodes }: { nodes: Node[] }) => {
    if (selectedNodes.length > 1) {
      const ids = selectedNodes.map((n) => n.id);
      useCanvasStore.getState().bringNodesToFront(ids);
    }
  }, []);

  const handlePaneClick = useCallback(() => {
    if (contextMenu) setContextMenu(null);
    setNodeContextMenu(null);
    if (focusMode) setFocusedNodeId(null);
  }, [contextMenu, setContextMenu, setNodeContextMenu, focusMode, setFocusedNodeId]);

  // Double-click on empty canvas to quick-create a note
  const handlePaneDoubleClick = useCallback((event: React.MouseEvent) => {
    if (isViewMode || !reactFlowInstance.current) return;

    // Don't create a new node if double-clicking inside an existing node or interactive element
    const target = event.target as HTMLElement;
    const isInsideNode = target.closest('.react-flow__node');
    const isInsideEditable = target.closest('.tiptap-editor, .tiptap-wrapper, textarea, input, [contenteditable="true"], .nodrag, .nowheel');
    if (isInsideNode || isInsideEditable) return;

    const position = reactFlowInstance.current.screenToFlowPosition({
      x: event.clientX,
      y: event.clientY,
    });
    addNode({
      id: crypto.randomUUID(),
      type: 'aiNote',
      position,
      data: { title: 'Untitled Note', content: null },
      style: { width: 380, height: 500 },
    });
    toast.success('Note created');
  }, [isViewMode, addNode]);

  // In focus mode, clicking a node focuses it
  const handleNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    // Always bring clicked node to front
    useCanvasStore.getState().bringToFront(node.id);

    if (connectMode) {
      if (!connectSourceId) {
        setConnectSourceId(node.id);
        toast.info('Now click the target node');
      } else if (node.id !== connectSourceId) {
        pushSnapshot();
        const { edges: currentEdges, nodes: allNodes } = useCanvasStore.getState();

        // Compute best handles based on relative node positions
        const sourceNode = allNodes.find(n => n.id === connectSourceId);
        const targetNode = node;
        const { sourceHandle, targetHandle } = computeBestHandles(sourceNode, targetNode);

        useCanvasStore.setState({
          edges: [...currentEdges, {
            id: crypto.randomUUID(),
            source: connectSourceId,
            target: node.id,
            sourceHandle,
            targetHandle,
            type: 'custom',
            animated: false,
            data: { color: 'hsl(0, 0%, 40%)', thickness: 2, lineStyle: 'solid', pathType: 'bezier', markerEndStyle: 'arrow', markerStartStyle: 'none', opacity: 100 },
          }],
        });
        setConnectMode(false);
        toast.success('Connection created');
      }
      return;
    }
    if (focusMode) {
      setFocusedNodeId(node.id);
    }
  }, [connectMode, connectSourceId, focusMode, setFocusedNodeId, setConnectSourceId, setConnectMode, pushSnapshot]);

  // Drag and drop file handling
  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOver(false);
  }, []);

  const handleDrop = useCallback(async (event: React.DragEvent) => {
    event.preventDefault();
    setDragOver(false);

    if (!reactFlowInstance.current || !workspaceId) return;

    const files = Array.from(event.dataTransfer.files);
    if (files.length === 0) return;

    const position = reactFlowInstance.current.screenToFlowPosition({
      x: event.clientX,
      y: event.clientY,
    });

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      const officeMimes = [
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'application/vnd.ms-powerpoint',
      ];
      const isPDF = file.type === 'application/pdf' || ext === 'pdf';
      const isOfficeDoc = ['doc', 'docx', 'ppt', 'pptx'].includes(ext) || officeMimes.includes(file.type);
      const isImage = file.type.startsWith('image/');

      if (!isPDF && !isOfficeDoc && !isImage) {
        toast.error(`Unsupported file: ${file.name}`);
        continue;
      }

      const nodeId = crypto.randomUUID();
      const isDocNode = isPDF || isOfficeDoc;
      const nodeType = isDocNode ? 'pdf' : 'image';

      const fileType = isDocNode ? (ext === 'pdf' ? 'pdf' : ext) : undefined;

      const placeholderData = isDocNode
        ? { fileName: file.name, fileSize: file.size, fileType, uploading: true, progress: 0 }
        : { altText: file.name, uploading: true, progress: 0 };

      const size = isDocNode ? { width: 300, height: 180 } : { width: 320, height: 280 };

      addNode({
        id: nodeId,
        type: nodeType,
        position: { x: position.x + i * 40, y: position.y + i * 40 },
        data: placeholderData,
        style: { width: size.width, height: size.height },
      });

      try {
        const { url, path } = await uploadCanvasFile(workspaceId, file);
        const { updateNodeData } = useCanvasStore.getState();
        updateNodeData(nodeId, {
          storageKey: path,
          storageUrl: url,
          uploading: false,
          progress: 100,
        });
        toast.success(`${file.name} uploaded`);
      } catch (err) {
        console.error(err);
        toast.error(`Failed to upload ${file.name}`);
        const { updateNodeData } = useCanvasStore.getState();
        updateNodeData(nodeId, { uploading: false });
      }
    }
  }, [workspaceId, addNode]);

  return (
    <div
      className={`h-screen w-screen bg-canvas-bg ${connectMode ? 'cursor-crosshair' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      <AnimatePresence>
        {dragOver && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="pointer-events-none fixed inset-0 z-[100] flex items-center justify-center bg-primary/5 backdrop-blur-[8px]"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="rounded-3xl border-2 border-dashed border-primary/50 glass-morphism-strong px-12 py-10 text-center pro-shadow"
            >
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/20 text-primary">
                <Upload className="h-8 w-8 animate-bounce" />
              </div>
              <p className="text-xl font-black uppercase tracking-[4px] text-primary">
                Drop to Import
              </p>
              <p className="mt-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
                PDF, IMAGES, OR OFFICE DOCUMENTS
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <TutorialSystem />
      <ActionPalette />
      
      {isAISynthesisOpen && (
        <AISynthesisDialog 
          selectedNodes={nodes.filter(n => n.selected)}
          onClose={() => setAISynthesisOpen(false)}
        />
      )}
      
      {isMobile && !mobileBannerDismissed && (
        <div className="fixed left-0 right-0 top-0 z-[60] flex items-center justify-between border-b-2 border-primary bg-primary px-4 py-2 text-xs font-bold uppercase tracking-wider text-primary-foreground">
          <span>Desktop recommended for best experience</span>
          <button onClick={() => setMobileBannerDismissed(true)} className="ml-2 font-bold">✕</button>
        </div>
      )}
      <ReactFlow
        className={cn(isZoomedOut && 'zoom-out')}
        nodes={processedNodes}
        edges={edges.map(e => {
          const sourceNode = localNodes.find(n => n.id === e.source);
          const targetNode = localNodes.find(n => n.id === e.target);
          const sourceZ = (sourceNode?.style?.zIndex as number) || 0;
          const targetZ = (targetNode?.style?.zIndex as number) || 0;
          const edgeZ = Math.max(0, Math.min(sourceZ, targetZ) - 1);
          return { ...e, zIndex: edgeZ };
        })}
        onNodesChange={isViewMode ? undefined : handleNodesChange}
        onEdgesChange={isViewMode ? undefined : onEdgesChange}
        onConnect={isViewMode ? undefined : onConnect}
        onInit={(instance) => { 
          reactFlowInstance.current = instance as ReactFlowInstance<Node, Edge>; 
          // Restore viewport from URL hash on load
          if (routerLocation.hash.startsWith('#viewport=')) {
            const [x, y, z] = routerLocation.hash.replace('#viewport=', '').split(',');
            if (x && y && z) {
              // use timeout to ensure nodes have rendered bounds
              setTimeout(() => {
                instance.setViewport({ x: parseFloat(x), y: parseFloat(y), zoom: parseFloat(z) });
              }, 50);
            }
          }
        }}
        onPaneClick={handlePaneClick}
        onDoubleClick={handlePaneDoubleClick}
        onNodeClick={handleNodeClick}
        onMouseMove={useCallback((event: React.MouseEvent) => {
          if (reactFlowInstance.current) {
            const pos = reactFlowInstance.current.screenToFlowPosition({ x: event.clientX, y: event.clientY });
            const prev = useCanvasStore.getState().lastCursorFlowPosition;
            if (!prev || Math.abs(prev.x - pos.x) > 5 || Math.abs(prev.y - pos.y) > 5) {
              useCanvasStore.setState({ lastCursorFlowPosition: pos }, false);
            }
          }
        }, [])}
        onMove={useCallback((_, viewport) => {
          if (viewport.zoom < 0.5 !== isZoomedOut) {
            setIsZoomedOut(viewport.zoom < 0.5);
          }
        }, [isZoomedOut])}
        onMoveEnd={useCallback((_, viewport) => {
          // Update zoom-out state one last time to be sure
          setIsZoomedOut(viewport.zoom < 0.5);
          // Sync viewport state to URL immediately
          const hash = `#viewport=${Math.round(viewport.x)},${Math.round(viewport.y)},${viewport.zoom.toFixed(2)}`;
          if (routerLocation.hash !== hash) {
            routerNavigate({ hash }, { replace: true });
          }
        }, [routerLocation, routerNavigate])}
        onPaneContextMenu={isViewMode ? undefined : handleContextMenu}
        onNodeContextMenu={isViewMode ? undefined : handleNodeContextMenu}
        onEdgeContextMenu={isViewMode ? undefined : onEdgeContextMenu}
        onNodeDrag={isViewMode ? undefined : handleNodeDrag}
        onNodeDragStop={isViewMode ? undefined : handleNodeDragStop}
        nodeTypes={safeNodeTypes}
        edgeTypes={edgeTypes}
        fitView
        snapToGrid={snapEnabled}
        snapGrid={[12, 12]}
        minZoom={0.1}
        maxZoom={2}
        deleteKeyCode={['Delete', 'Backspace']}
        onSelectionChange={handleSelectionChange}
        selectionOnDrag={!isViewMode && !connectMode}
        selectionMode={SelectionMode.Partial}
        panOnDrag={isViewMode ? true : connectMode ? [2] : [1, 2]}
        nodesDraggable={!isViewMode}
        connectionMode={ConnectionMode.Loose}
        connectionRadius={50}
        nodesConnectable={!isViewMode}
        elementsSelectable={!isViewMode}
        proOptions={{ hideAttribution: true }}
        defaultEdgeOptions={{
          type: 'custom',
          animated: false,
        }}
      >
        {gridStyle !== 'blank' && (
          <Background
            variant={
              gridStyle === 'dots' ? BackgroundVariant.Dots :
              gridStyle === 'lines' || gridStyle === 'graph' ? BackgroundVariant.Lines :
              BackgroundVariant.Cross
            }
            color={gridStyle === 'graph' ? "hsl(var(--primary)/0.05)" : "hsl(var(--canvas-dot))"}
            gap={gridStyle === 'graph' ? 20 : 24}
            size={gridStyle === 'dots' ? 1.5 : 1}
          />
        )}
        {gridStyle === 'graph' && (
          <Background
            variant={BackgroundVariant.Lines}
            color="hsl(var(--primary)/0.1)"
            gap={100}
            size={1.5}
          />
        )}
        <AlignmentGuidesLayer guides={guides} />
        {showMinimap && !zenMode && (
          <MiniMap
            pannable
            zoomable
            nodeColor={(n) => (n.selected ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground)/0.2)')}
            maskColor="hsl(var(--background)/0.5)"
          />
        )}
        
        {!zenMode && (
          <>
            <HistoryPanel />
            <WorkspaceTabs />
            <NodeSearchPanel />
            <CanvasToolbar />
            <AddNodeToolbar />
          </>
        )}

        {zenMode && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={toggleZenMode}
            className="fixed bottom-6 right-6 z-[60] flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary shadow-xl backdrop-blur-md border border-primary/20 hover:bg-primary/20 transition-all duration-300 group"
          >
            <Eye className="h-6 w-6 group-hover:scale-110 transition-transform" />
            <div className="absolute right-14 whitespace-nowrap rounded-lg bg-black/80 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-white opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
              Exit Zen Mode
            </div>
          </motion.button>
        )}

        <EdgeContextMenu />
        <svg style={{ position: 'absolute', top: 0, left: 0, width: 0, height: 0 }}>
          <defs>
            <marker
              id="arrow"
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth={6}
              markerHeight={6}
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 Z" fill="hsl(0, 0%, 40%)" />
            </marker>
            <marker
              id="arrow-selected"
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth={6}
              markerHeight={6}
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 Z" fill="hsl(52, 100%, 50%)" />
            </marker>
          </defs>
        </svg>
      </ReactFlow>
      <CanvasContextMenu />
      <NodeContextMenu />
      <NodeExpandModal />
      <SearchPalette />
      <CommandPalette />
      <ThemeEditor />
      <NodeSelectionToolbar />
      <SelectionToolbar />
      <ActionPalette />
      <TutorialSystem />
      <PomodoroTimer />
      <PinnedNodesPanel />
      <CanvasStats />
      <KeyboardShortcutsPanel />
      <PresentationMode />
      <DrawingLayer
        active={drawingMode}
        onFinish={() => setDrawingMode(false)}
      />

      <AnimatePresence>
        {nodes.length === 0 && !dragOver && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="pointer-events-none fixed inset-0 z-30 flex items-center justify-center bg-empty-workspace"
          >
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="rounded-[2.5rem] glass-morphism-strong px-12 py-10 text-center pro-shadow max-w-lg border border-white/5"
            >
              <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-[2rem] bg-primary/10 text-primary shadow-2xl shadow-primary/20 animate-pulse">
                <Sparkles className="h-10 w-10 fill-primary/20" />
              </div>
              <h3 className="text-xl font-black uppercase tracking-[6px] text-foreground mb-4">Start Creating</h3>
              <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/60 leading-relaxed mb-8 max-w-[280px] mx-auto">
                Your canvas is a blank slate. Bring your ideas to life with nodes, connections, and AI.
              </p>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col items-center gap-2 rounded-2xl bg-white/5 p-4 border border-white/5 shadow-inner">
                  <MousePointerClick className="h-5 w-5 text-primary/60" />
                  <span className="text-[9px] font-black uppercase tracking-widest text-foreground/40">Double Click</span>
                  <span className="text-[10px] font-bold text-foreground/60">Creative Note</span>
                </div>
                <div className="flex flex-col items-center gap-2 rounded-2xl bg-white/5 p-4 border border-white/5 shadow-inner">
                  <Search className="h-5 w-5 text-primary/60" />
                  <span className="text-[9px] font-black uppercase tracking-widest text-foreground/40">Command + K</span>
                  <span className="text-[10px] font-bold text-foreground/60">Quick Search</span>
                </div>
              </div>
              
              <div className="mt-8 flex justify-center gap-2 items-center text-[10px] font-bold uppercase tracking-widest text-muted-foreground/30">
                <Upload className="h-3 w-3" />
                <span>Or Drop Files Anywhere</span>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
