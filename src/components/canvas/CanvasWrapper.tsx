import { useCallback, useRef, useEffect, useState, useMemo } from 'react';
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
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { useCanvasStore } from '@/store/canvasStore';
import { CanvasContextMenu } from './CanvasContextMenu';
import { NodeContextMenu } from './NodeContextMenu';
import { CanvasToolbar } from './CanvasToolbar';
import { NodeExpandModal } from './NodeExpandModal';
import { AddNodeToolbar } from './AddNodeToolbar';
import { PomodoroTimer } from './PomodoroTimer';
import { PinnedNodesPanel } from './PinnedNodesPanel';
import { CanvasStats } from './CanvasStats';
import { SearchPalette } from './SearchPalette';
import { NodeSelectionToolbar } from './NodeSelectionToolbar';
import { DrawingLayer } from './DrawingLayer';
import { KeyboardShortcutsPanel } from './KeyboardShortcutsPanel';
import { AlignmentGuidesLayer } from './AlignmentGuidesLayer';
import { PresentationMode } from './PresentationMode';
import { nodeTypes } from './nodeTypes';
import { edgeTypes } from './edgeTypes';
import { NodeErrorBoundary } from './NodeErrorBoundary';

const withErrorBoundary = (Component: React.ComponentType<any>) => {
  const Wrapped = (props: any) => (
    <NodeErrorBoundary nodeId={props.id}>
      <Component {...props} />
    </NodeErrorBoundary>
  );
  Wrapped.displayName = `WithErrorBoundary(${Component.displayName || Component.name || 'Component'})`;
  return Wrapped;
};

const safeNodeTypes = Object.fromEntries(
  Object.entries(nodeTypes).map(([key, Component]) => [key, withErrorBoundary(Component as React.ComponentType<any>)])
);

/** Compute the best source/target handle IDs based on relative node positions */
function computeBestHandles(sourceNode: any, targetNode: any): { sourceHandle: string; targetHandle: string } {
  if (!sourceNode || !targetNode) return { sourceHandle: 's-right', targetHandle: 't-left' };

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

  if (Math.abs(dx) > Math.abs(dy)) {
    // Horizontal dominant
    sourceHandle = dx > 0 ? 's-right' : 's-left';
    targetHandle = dx > 0 ? 't-left' : 't-right';
  } else {
    // Vertical dominant
    sourceHandle = dy > 0 ? 's-bottom' : 's-top';
    targetHandle = dy > 0 ? 't-top' : 't-bottom';
  }

  return { sourceHandle, targetHandle };
}
import { useIsMobile } from '@/hooks/use-mobile';
import { uploadCanvasFile } from '@/lib/r2/storage';
import { toast } from 'sonner';
import { useNavigate, useLocation } from 'react-router-dom';

export function CanvasWrapper() {
  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    setContextMenu,
    setNodeContextMenu,
    contextMenu,
    undo,
    redo,
    showMinimap,
    toggleMinimap,
    copySelectedNodes,
    pasteNodes,
    selectAllNodes,
    addNode,
    workspaceId,
    canvasMode,
    focusMode,
    focusedNodeId,
    setFocusedNodeId,
    snapEnabled,
    gridStyle,
    connectMode,
    setConnectMode,
    connectSourceId,
    setConnectSourceId,
    pushSnapshot,
    setLastCursorFlowPosition,
  } = useCanvasStore();

  const reactFlowInstance = useRef<any>(null);
  const routerNavigate = useNavigate();
  const routerLocation = useLocation();

  const isMobile = useIsMobile();
  const [mobileBannerDismissed, setMobileBannerDismissed] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [drawingMode, setDrawingMode] = useState(false);
  const [drawColor, setDrawColor] = useState('hsl(52, 100%, 50%)'); // kept for future use
  const [drawWidth, setDrawWidth] = useState(3); // kept for future use
  const [guides, setGuides] = useState<{ type: 'v' | 'h'; pos: number; start: number; end: number }[]>([]);

  const SNAP_THRESHOLD = 8;
  const isViewMode = canvasMode === 'view';

  // Compute alignment guides while dragging
  const handleNodeDrag = useCallback((_: any, draggedNode: Node) => {
    if (isViewMode) return;
    const rf = reactFlowInstance.current;
    const zoom = rf ? rf.getZoom() : 1;
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

  const handleNodeDragStop = useCallback(() => {
    setGuides([]);
  }, []);

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
    return nodes
      .filter((n) => {
        // Find rough bounds of node
        const nw = (typeof n.style?.width === 'number' ? n.style.width : n.measured?.width) || 300;
        const nh = (typeof n.style?.height === 'number' ? n.style.height : n.measured?.height) || 200;
        const nx = n.position.x;
        const ny = n.position.y;
        
        // Check intersection with viewport bounds
        return !(nx + nw < vLeft || nx > vRight || ny + nh < vTop || ny > vBottom);
      })
      .map((n) => ({
        ...n,
        draggable: isViewMode ? false : !(n.data as any)?.locked,
        connectable: isViewMode ? false : !(n.data as any)?.locked,
        selectable: isViewMode ? false : true,
        style: {
          ...n.style,
          opacity: focusMode && focusedNodeId && focusedNodeId !== n.id ? 0.15 : 1,
          transition: 'opacity 0.3s ease',
        },
      })) as Node[];
  }, [nodes, isViewMode, focusMode, focusedNodeId, vLeft, vRight, vTop, vBottom]);

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

  // Friendly label map for toast messages
  const typeLabels: Record<string, string> = {
    video: '🎥 Video', embed: '🔗 Embed', image: '🖼️ Image', pdf: '📄 PDF',
    codeSnippet: '💻 Code', math: '🧮 Math', table: '📊 Table',
    checklist: '✅ Checklist', summary: '📋 Summary', flashcard: '🃏 Flashcard',
    termQuestion: '📖 Term', aiNote: '📝 Note',
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
            toast.success(`${typeLabels[detected.type] || detected.type} created from paste`);
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
          toast.success(`${typeLabels[detected.type] || '📝 Note'} created from paste`);
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

      if (mod && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
      if (mod && e.key === 'z' && e.shiftKey) { e.preventDefault(); redo(); }
      if (mod && e.key === 'c') { e.preventDefault(); copySelectedNodes(); }
      if (mod && e.key === 'v') {
        e.preventDefault();
        // Check if there are copied nodes first
        const { clipboard } = useCanvasStore.getState();
        if (clipboard.length > 0) {
          pasteNodes();
        } else {
          handleClipboardPaste();
        }
      }
      if (mod && e.key === 'a') { e.preventDefault(); selectAllNodes(); }
      if (mod && e.shiftKey && e.key.toLowerCase() === 'h') {
        e.preventDefault();
        reactFlowInstance.current?.fitView({ duration: 300 });
      }
      if (mod && e.key === '0') {
        e.preventDefault();
        reactFlowInstance.current?.zoomTo(1, { duration: 300 });
      }
      if (e.key === 'm' && !mod) { toggleMinimap(); }

      // Arrow keys to pan the canvas
      const PAN_STEP = 80;
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        const rf = reactFlowInstance.current;
        if (!rf) return;
        // Don't pan if nodes are selected (let React Flow handle node movement)
        const selectedNodes = rf.getNodes().filter((n: any) => n.selected);
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
  }, [undo, redo, copySelectedNodes, pasteNodes, selectAllNodes, toggleMinimap, setContextMenu, setNodeContextMenu, drawingMode, handleClipboardPaste]);

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
    (event: React.MouseEvent, node: any) => {
      event.preventDefault();
      setNodeContextMenu({
        x: event.clientX,
        y: event.clientY,
        nodeId: node.id,
      });
    },
    [setNodeContextMenu]
  );

  // Auto bring-to-front all selected nodes after box select
  const handleSelectionChange = useCallback(({ nodes: selectedNodes }: { nodes: Node[] }) => {
    if (selectedNodes.length > 1) {
      const store = useCanvasStore.getState();
      const maxZ = Math.max(...store.nodes.map((n) => (n.style?.zIndex as number) || 0), 0);
      const ids = new Set(selectedNodes.map((n) => n.id));
      useCanvasStore.setState({
        nodes: store.nodes.map((n, i) =>
          ids.has(n.id) ? { ...n, style: { ...n.style, zIndex: maxZ + 1 + i } } : n
        ),
      });
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
  const handleNodeClick = useCallback((_: React.MouseEvent, node: any) => {
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
      {dragOver && (
        <div className="pointer-events-none fixed inset-0 z-[60] flex items-center justify-center bg-primary/10 backdrop-blur-sm animate-fade-in">
          <div className="rounded-xl border-4 border-dashed border-primary bg-card/90 px-10 py-8 text-center shadow-[6px_6px_0px_hsl(0,0%,10%)] animate-bounce-in">
            <p className="text-lg font-black uppercase tracking-wider text-primary animate-float">
              Drop files here
            </p>
            <p className="mt-1 text-xs text-muted-foreground">PDF or Image files</p>
          </div>
        </div>
      )}

      {isMobile && !mobileBannerDismissed && (
        <div className="fixed left-0 right-0 top-0 z-[60] flex items-center justify-between border-b-2 border-primary bg-primary px-4 py-2 text-xs font-bold uppercase tracking-wider text-primary-foreground">
          <span>Desktop recommended for best experience</span>
          <button onClick={() => setMobileBannerDismissed(true)} className="ml-2 font-bold">✕</button>
        </div>
      )}
      <ReactFlow
        nodes={processedNodes}
        edges={edges.map(e => {
          const sourceNode = nodes.find(n => n.id === e.source);
          const targetNode = nodes.find(n => n.id === e.target);
          const sourceZ = (sourceNode?.style?.zIndex as number) || 0;
          const targetZ = (targetNode?.style?.zIndex as number) || 0;
          const edgeZ = Math.max(0, Math.min(sourceZ, targetZ) - 1);
          return { ...e, zIndex: edgeZ };
        })}
        onNodesChange={isViewMode ? undefined : onNodesChange}
        onEdgesChange={isViewMode ? undefined : onEdgesChange}
        onConnect={isViewMode ? undefined : onConnect}
        onInit={(instance) => { 
          reactFlowInstance.current = instance; 
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
        onMoveEnd={useCallback((_, viewport) => {
          // Sync viewport state to URL immediately
          const hash = `#viewport=${Math.round(viewport.x)},${Math.round(viewport.y)},${viewport.zoom.toFixed(2)}`;
          if (routerLocation.hash !== hash) {
            routerNavigate({ hash }, { replace: true });
          }
        }, [routerLocation, routerNavigate])}
        onPaneContextMenu={isViewMode ? undefined : handleContextMenu}
        onNodeContextMenu={isViewMode ? undefined : handleNodeContextMenu}
        onNodeDrag={isViewMode ? undefined : handleNodeDrag}
        onNodeDragStop={isViewMode ? undefined : handleNodeDragStop}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        snapToGrid={snapEnabled}
        snapGrid={[12, 12]}
        minZoom={0.1}
        maxZoom={4}
        deleteKeyCode={[]}
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
        <Background
          variant={gridStyle === 'dots' ? BackgroundVariant.Dots : gridStyle === 'lines' ? BackgroundVariant.Lines : BackgroundVariant.Cross}
          color="hsl(var(--canvas-dot))"
          gap={24}
          size={gridStyle === 'dots' ? 1.5 : 1}
        />
        <AlignmentGuidesLayer guides={guides} />
        {showMinimap && (
          <MiniMap
            pannable
            zoomable
            nodeColor={() => 'hsl(52, 100%, 50%)'}
            style={{ width: 160, height: 110 }}
          />
        )}
        <CanvasToolbar
          drawingMode={drawingMode}
          onToggleDrawing={() => setDrawingMode(!drawingMode)}
        />
        {!isViewMode && <AddNodeToolbar />}
        <svg style={{ position: 'absolute', top: 0, left: 0, width: 0, height: 0 }}>
          <defs>
            <marker
              id="arrow"
              viewBox="0 0 12 12"
              refX="11"
              refY="6"
              markerWidth={8}
              markerHeight={8}
              orient="auto-start-reverse"
            >
              <path d="M 2 2 L 11 6 L 2 10 L 4.5 6 Z" fill="hsl(0, 0%, 40%)" />
            </marker>
            <marker
              id="arrow-selected"
              viewBox="0 0 12 12"
              refX="11"
              refY="6"
              markerWidth={8}
              markerHeight={8}
              orient="auto-start-reverse"
            >
              <path d="M 2 2 L 11 6 L 2 10 L 4.5 6 Z" fill="hsl(52, 100%, 50%)" />
            </marker>
          </defs>
        </svg>
      </ReactFlow>
      <CanvasContextMenu />
      <NodeContextMenu />
      <NodeExpandModal />
      <SearchPalette />
      <NodeSelectionToolbar />
      <PomodoroTimer />
      <PinnedNodesPanel />
      <CanvasStats />
      <KeyboardShortcutsPanel />
      <PresentationMode />
      <DrawingLayer
        active={drawingMode}
        onFinish={() => setDrawingMode(false)}
      />

      {nodes.length === 0 && !dragOver && (
        <div className="pointer-events-none fixed inset-0 z-30 flex items-center justify-center animate-fade-in">
          <div className="rounded-xl border-2 border-dashed border-border bg-card/60 px-10 py-8 text-center backdrop-blur-sm shadow-[4px_4px_0px_hsl(0,0%,10%)] animate-float max-w-md">
            <div className="mb-3 text-4xl">📝</div>
            <h3 className="text-base font-black uppercase tracking-wider text-foreground mb-2">Empty Canvas</h3>
            <p className="text-xs font-semibold text-muted-foreground leading-relaxed">
              Get started by adding your first node using the <span className="text-primary">+</span> button, right-clicking the canvas, or dropping files here.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <kbd className="rounded border-2 border-border bg-muted px-2 py-1 text-[10px] font-bold text-muted-foreground">Double-click</kbd>
              <kbd className="rounded border-2 border-border bg-muted px-2 py-1 text-[10px] font-bold text-muted-foreground">⌘K Search</kbd>
              <kbd className="rounded border-2 border-border bg-muted px-2 py-1 text-[10px] font-bold text-muted-foreground">Drag & Drop</kbd>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
