import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import {
  type Node,
  type Edge,
  type OnNodesChange,
  type OnEdgesChange,
  type OnConnect,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
} from '@xyflow/react';
import { extractText } from '@/lib/utils/contentParser';

interface HistorySnapshot {
  nodes: Node[];
  edges: Edge[];
  label: string;
  timestamp: number;
}

interface CanvasState {
  nodes: Node[];
  edges: Edge[];
  workspaceId: string | null;
  workspaceName: string;
  workspaceColor: string;
  contextMenu: { x: number; y: number; canvasX: number; canvasY: number } | null;
  nodeContextMenu: { x: number; y: number; nodeId: string } | null;
  edgeContextMenu: { x: number; y: number; edgeId: string } | null;
  expandedNode: string | null;
  showMinimap: boolean;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
  _saveCounter: number;
  _skipSync: boolean;
  _resyncNeeded: boolean;
  lastSavedAt: number | null;
  exportProgress: number | null; // 0-100 or null
  clipboard: Node[];
  canvasMode: 'edit' | 'view';
  focusMode: boolean;
  focusedNodeId: string | null;
  snapEnabled: boolean;
  gridStyle: 'dots' | 'lines' | 'cross' | 'graph' | 'blank';
  allLocked: boolean;
  connectMode: boolean;
  connectSourceId: string | null;
  lastCursorFlowPosition: { x: number; y: number } | null;
  versionHistoryOpen: boolean;
  bookmarks: { id: string; name: string; viewport: { x: number; y: number; zoom: number } }[];
  openWorkspaces: { id: string; name: string; color: string }[];
  isAISynthesisOpen: boolean;
  isBlockEditorMode: boolean;
  mobileMode: boolean;
  backlinks: Record<string, string[]>; // targetId -> sourceIds[]
  _contentBacklinks: Record<string, string[]>;
  _syncAllBacklinks: () => void;


  // History
  past: HistorySnapshot[];
  future: HistorySnapshot[];
  drawingMode: boolean;
  zenMode: boolean;
  zoomOnScroll: boolean;

  // Actions
  setWorkspaceId: (id: string | null) => void;
  setWorkspaceMeta: (name: string, color: string) => void;
  setNodes: (nodes: Node[]) => void;
  setEdges: (edges: Edge[]) => void;
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  addNode: (node: Node) => void;
  deleteNode: (id: string) => void;
  duplicateNode: (id: string) => void;
  updateNodeData: (id: string, data: Record<string, unknown>) => void;
  updateNodeStyle: (id: string, style: Record<string, unknown>) => void;
  deleteEdge: (id: string) => void;
  setDrawingMode: (val: boolean) => void;
  setZenMode: (val: boolean) => void;
  toggleZenMode: () => void;
  setContextMenu: (menu: CanvasState['contextMenu']) => void;
  setNodeContextMenu: (menu: CanvasState['nodeContextMenu']) => void;
  setEdgeContextMenu: (menu: CanvasState['edgeContextMenu']) => void;
  updateEdgeData: (id: string, data: Record<string, unknown>) => void;
  setExpandedNode: (id: string | null) => void;
  bringToFront: (id: string) => void;
  bringNodesToFront: (ids: string[]) => void;
  sendToBack: (id: string) => void;
  toggleMinimap: () => void;
  setSaveStatus: (s: CanvasState['saveStatus']) => void;
  incSave: () => void;
  decSave: (error?: boolean) => void;
  copySelectedNodes: () => void;
  pasteNodes: () => void;
  selectAllNodes: () => void;
  toggleCanvasMode: () => void;
  toggleFocusMode: () => void;
  setFocusedNodeId: (id: string | null) => void;
  toggleSnap: () => void;
  cycleGridStyle: () => void;
  toggleLockAll: () => void;
  deleteSelected: () => void;
  duplicateEdge: (id: string) => void;
  reverseEdge: (id: string) => void;
  setConnectMode: (on: boolean) => void;
  setConnectSourceId: (id: string | null) => void;
  setLastCursorFlowPosition: (pos: { x: number; y: number } | null) => void;
  createGroupFromSelection: () => void;
  toggleGroupCollapse: (groupId: string) => void;
  addBookmark: (name: string, viewport: { x: number; y: number; zoom: number }) => void;
  removeBookmark: (id: string) => void;
  addOpenWorkspace: (workspace: { id: string; name: string; color: string }) => void;
  removeOpenWorkspace: (id: string) => void;
  setAISynthesisOpen: (open: boolean) => void;
  setOpenWorkspaces: (workspaces: { id: string; name: string; color: string }[]) => void;
  toggleBlockEditorMode: () => void;
  toggleMobileMode: () => void;
  setExportProgress: (p: number | null) => void;
  importNodes: (nodes: Node[]) => void;
  updateBacklinks: (sourceId: string, targetIds: string[]) => void;
  highlightedNodeIds: string[];
  setHighlightedNodes: (ids: string[]) => void;
  isDeepWorkActive: boolean;
  setDeepWorkActive: (active: boolean) => void;
  scanContentForLinks: (sourceId: string, content: any) => void;
  tidyUp: () => void;
  toggleZoomOnScroll: () => void;



  // History actions
  pushSnapshot: (label?: string) => void;
  undo: () => void;
  redo: () => void;
  clearResyncNeeded: () => void;
  setVersionHistoryOpen: (open: boolean) => void;
  resetState: () => void;
  loadCanvas: (nodes: Node[], edges: Edge[], preserveHistory?: boolean) => void;
}

let skipSyncTimeout: ReturnType<typeof setTimeout> | null = null;
let loadCounter = 0;

export const useCanvasStore = create<CanvasState>((set, get) => ({
  nodes: [],
  edges: [],
  workspaceId: null,
  workspaceName: 'Untitled',
  workspaceColor: '#3b82f6',
  contextMenu: null,
  nodeContextMenu: null,
  edgeContextMenu: null,
  expandedNode: null,
  showMinimap: true,
  saveStatus: 'idle',
  _saveCounter: 0,
  _skipSync: false,
  _resyncNeeded: false,
  lastSavedAt: null,
  clipboard: [],
  canvasMode: 'edit',
  focusMode: false,
  focusedNodeId: null,
  snapEnabled: true,
  gridStyle: 'dots' as const,
  allLocked: false,
  connectMode: false,
  connectSourceId: null,
  lastCursorFlowPosition: null,
  versionHistoryOpen: false,
  bookmarks: [],
  openWorkspaces: [],
  isAISynthesisOpen: false,
  isBlockEditorMode: false,
  mobileMode: false,
  exportProgress: null,
  past: [],
  future: [],
  drawingMode: false,
  zenMode: false,
  zoomOnScroll: true,
  backlinks: {},
  _contentBacklinks: {},
  _syncAllBacklinks: () => {
    const { _contentBacklinks, edges } = get();
    // Deep clone to prevent mutating the _contentBacklinks arrays
    const newBacklinks: Record<string, string[]> = {};
    Object.keys(_contentBacklinks).forEach(tid => {
      newBacklinks[tid] = [...(_contentBacklinks[tid] || [])];
    });
    
    edges.forEach(edge => {
      const sourceId = edge.source;
      const targetId = edge.target;
      // Hardening: Only sync backlinks if both nodes technically exist (avoid ghost edges)
      if (!newBacklinks[targetId]) newBacklinks[targetId] = [];
      if (!newBacklinks[targetId].includes(sourceId)) {
        newBacklinks[targetId].push(sourceId);
      }
    });

    set({ backlinks: newBacklinks });
  },


  importNodes: (newNodes) => {
    get().pushSnapshot('Import Nodes');
    set({ nodes: [...get().nodes, ...newNodes] });
  },

  updateBacklinks: (sourceId, targetIds) => {
    const newContentBacklinks = { ...get()._contentBacklinks };
    
    // Remove old content-based backlinks from this source
    Object.keys(newContentBacklinks).forEach(targetId => {
      newContentBacklinks[targetId] = (newContentBacklinks[targetId] || []).filter(id => id !== sourceId);
      if (newContentBacklinks[targetId].length === 0) delete newContentBacklinks[targetId];
    });

    // Add new content-based backlinks
    targetIds.forEach(targetId => {
      if (!newContentBacklinks[targetId]) newContentBacklinks[targetId] = [];
      if (!newContentBacklinks[targetId].includes(sourceId)) {
        newContentBacklinks[targetId].push(sourceId);
      }
    });

    set({ _contentBacklinks: newContentBacklinks });
    get()._syncAllBacklinks();
  },

  scanContentForLinks: (sourceId, content) => {
    const text = extractText(content);
    if (!text) return;

    const nodes = get().nodes;
    const targetIds: string[] = [];

    // Find all node titles in the text using [[Title]] or simple title match
    nodes.forEach(node => {
      if (node.id === sourceId) return;
      const title = (node.data as any)?.title || (node.data as any)?.label;
      if (!title) return;

      // Escape title for regex
      const escapedTitle = title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const wikiLinkRegex = new RegExp(`\\[\\[${escapedTitle}\\]\\]`, 'gi');
      
      if (wikiLinkRegex.test(text)) {
        targetIds.push(node.id);
      }
    });

    if (targetIds.length > 0) {
      get().updateBacklinks(sourceId, targetIds);
    }
  },


  setWorkspaceId: (id) => set({ workspaceId: id }),
  setWorkspaceMeta: (name, color) => set({ workspaceName: name, workspaceColor: color }),
  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),

  highlightedNodeIds: [],
  setHighlightedNodes: (ids) => set({ highlightedNodeIds: ids }),
  isDeepWorkActive: false,
  setDeepWorkActive: (active) => set({ isDeepWorkActive: active }),
  
  onNodesChange: (changes) => {
    const nodes = get().nodes;
    const removedIds = changes
      .filter((c) => c.type === 'remove')
      .map((c) => (c as { id: string }).id);

    if (removedIds.length > 0) {
      const newContentBacklinks = { ...get()._contentBacklinks };
      removedIds.forEach(id => {
        delete newContentBacklinks[id];
        Object.keys(newContentBacklinks).forEach(targetId => {
          newContentBacklinks[targetId] = (newContentBacklinks[targetId] || []).filter(sourceId => sourceId !== id);
          if (newContentBacklinks[targetId].length === 0) delete newContentBacklinks[targetId];
        });
      });
      set({ _contentBacklinks: newContentBacklinks });
    }

    set({ nodes: applyNodeChanges(changes, nodes) });
    if (removedIds.length > 0) get()._syncAllBacklinks();
  },

  onEdgesChange: (changes) => {
    set({ edges: applyEdgeChanges(changes, get().edges) });
    const hasRemoval = changes.some(c => c.type === 'remove');
    if (hasRemoval) get()._syncAllBacklinks();
  },

  onConnect: (connection) => {
    if (connection.source === connection.target) return;
    get().pushSnapshot('Connect Nodes');
    const newEdges = addEdge(
      { ...connection, id: crypto.randomUUID(), type: 'custom', animated: false },
      get().edges
    );
    set({ edges: newEdges });
    get()._syncAllBacklinks();
  },

  setAISynthesisOpen: (open) => set({ isAISynthesisOpen: open }),
  setOpenWorkspaces: (workspaces) => set({ openWorkspaces: workspaces }),

  addNode: (node) => {
    get().pushSnapshot(`Add ${node.type} Node`);
    const cursor = get().lastCursorFlowPosition;
    
    // Safety check for NaN in cursor position
    const safeCursor = (cursor && !isNaN(cursor.x) && !isNaN(cursor.y)) ? cursor : null;
    
    // If node has a non-zero position, or we don't have a cursor, trust the input position
    const hasPosition = node.position.x !== 0 || node.position.y !== 0;
    const isSafePosition = !isNaN(node.position.x) && !isNaN(node.position.y);
    
    const finalPosition = (!hasPosition && safeCursor)
      ? { x: safeCursor.x - 150, y: safeCursor.y - 50 }
      : isSafePosition ? node.position : { x: 0, y: 0 };

    const positioned = { ...node, position: finalPosition };

    set({ nodes: [...get().nodes, positioned] });
  },

  deleteNode: (id) => {
    get().pushSnapshot('Remove Node');
    const newContentBacklinks = { ...get()._contentBacklinks };
    delete newContentBacklinks[id];
    Object.keys(newContentBacklinks).forEach(targetId => {
      newContentBacklinks[targetId] = (newContentBacklinks[targetId] || []).filter(sourceId => sourceId !== id);
      if (newContentBacklinks[targetId].length === 0) delete newContentBacklinks[targetId];
    });

    set({
      nodes: get().nodes.filter((n) => n.id !== id),
      edges: get().edges.filter((e) => e.source !== id && e.target !== id),
      _contentBacklinks: newContentBacklinks,
    });
    get()._syncAllBacklinks();
  },

  duplicateNode: (id) => {
    const node = get().nodes.find((n) => n.id === id);
    if (!node) return;
    get().pushSnapshot('Duplicate Node');
    
    // Use structuredClone for high-fidelity deep cloning
    const newNodeProps = structuredClone(node);
    delete (newNodeProps as any).data.pinned;
    
    // Guard against NaN in original position
    const posX = isNaN(node.position.x) ? 0 : node.position.x;
    const posY = isNaN(node.position.y) ? 0 : node.position.y;

    const newNode: Node = {
      ...newNodeProps,
      id: crypto.randomUUID(),
      position: { x: posX + 30, y: posY + 30 },
      selected: true,
      measured: undefined,
    };
    
    set({ nodes: [...get().nodes.map(n => ({ ...n, selected: false })), newNode] });
  },

  updateNodeData: (id, data) => {
    // Filter out null and undefined values to prevent Firestore sync errors
    const sanitizedData = Object.fromEntries(
      Object.entries(data).filter(([_, v]) => v !== undefined && v !== null)
    );
    set({
      nodes: get().nodes.map((n) => {
        if (n.id === id) {
          const nextData = { ...n.data, ...sanitizedData };
          // If locked is specified, sync it to React Flow top-level props
          const isLocked = !!nextData.locked;
          return { 
            ...n, 
            data: nextData,
            draggable: !isLocked,
            selectable: true, 
            deletable: !isLocked
          };
        }
        return n;
      }),
    });
  },

  updateNodeStyle: (id, style) => {
    // Filter out null and undefined values to prevent Firestore sync errors
    const sanitizedStyle = Object.fromEntries(
      Object.entries(style).filter(([_, v]) => v !== undefined && v !== null)
    );
    set({
      nodes: get().nodes.map((n) =>
        n.id === id ? { ...n, style: { ...n.style, ...sanitizedStyle } } : n
      ),
    });
  },

  setContextMenu: (menu) => set({ contextMenu: menu }),
  setNodeContextMenu: (menu) => set({ nodeContextMenu: menu }),
  setEdgeContextMenu: (menu) => set({ edgeContextMenu: menu }),
  updateEdgeData: (id, data) => {
    // Hardening: Trim label if present to prevent empty labels or accidental spaces
    const processedData = { ...data };
    const label = typeof data.label === 'string' ? data.label.trim() : undefined;
    
    set((state) => ({
      edges: state.edges.map((e) => (
        e.id === id 
          ? { 
              ...e, 
              data: { ...e.data, ...processedData }, 
              label: label !== undefined ? label : e.label 
            } 
          : e
      )),
    }));
  },
  setExpandedNode: (id) => set({ expandedNode: id }),

  bringToFront: (id) => {
    set((state) => {
      const maxZ = Math.max(...state.nodes.map((n) => (n.style?.zIndex as number) || 0), 0);
      return {
        nodes: state.nodes.map((n) =>
          n.id === id ? { ...n, style: { ...n.style, zIndex: maxZ + 1 } } : n
        ),
      };
    });
  },

  bringNodesToFront: (ids) => {
    set((state) => {
      const maxZ = Math.max(...state.nodes.map((n) => (n.style?.zIndex as number) || 0), 0);
      const idSet = new Set(ids);
      return {
        _skipSync: true, // Avoid triggering a loop when just adjusting order for UI
        nodes: state.nodes.map((n) => {
          if (idSet.has(n.id)) {
            return { ...n, style: { ...n.style, zIndex: maxZ + 1 } };
          }
          return n;
        }),
      };
    });
    // Toggle sync back after a tick
    setTimeout(() => set({ _skipSync: false }), 50);
  },

  sendToBack: (id) => {
    set((state) => {
      const minZ = Math.min(...state.nodes.map((n) => (n.style?.zIndex as number) || 0), 0);
      return {
        nodes: state.nodes.map((n) =>
          n.id === id ? { ...n, style: { ...n.style, zIndex: minZ - 1 } } : n
        ),
      };
    });
  },

  createGroupFromSelection: () => {
    const { nodes, pushSnapshot } = get();
    const selectedNodes = nodes.filter(n => n.selected);

    if (selectedNodes.length === 0) return;

    pushSnapshot('Create Group');

    // Calculate bounding box of selected nodes
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    selectedNodes.forEach(node => {
      const nodeWidth = node.measured?.width || 200; // Default width if not measured
      const nodeHeight = node.measured?.height || 100; // Default height if not measured
      minX = Math.min(minX, node.position.x);
      minY = Math.min(minY, node.position.y);
      maxX = Math.max(maxX, node.position.x + nodeWidth);
      maxY = Math.max(maxY, node.position.y + nodeHeight);
    });

    const padding = 40; // Padding around the group
    const groupX = minX - padding;
    const groupY = minY - padding;
    const groupWidth = (maxX - minX) + (2 * padding);
    const groupHeight = (maxY - minY) + (2 * padding);

    const groupId = crypto.randomUUID();

    const groupNode = {
      id: groupId,
      type: 'group',
      position: { x: groupX, y: groupY },
      data: { label: 'New Group', collapsed: false },
      style: { width: groupWidth, height: groupHeight, zIndex: 0 },
      draggable: true,
      selectable: true,
      deletable: true,
    };

    const updatedNodes = nodes.map(n => {
      if (selectedNodes.some(sn => sn.id === n.id)) {
        // Update selected nodes to be children of the new group
        return {
          ...n,
          parentId: groupId,
          extent: 'parent' as const,
          position: { x: n.position.x - groupX, y: n.position.y - groupY },
          selected: false,
        };
      }
      return { ...n, selected: false }; // Deselect other nodes
    });

    set({ nodes: [groupNode, ...updatedNodes] });
  },

  toggleGroupCollapse: (groupId) => {
    const nodes = get().nodes;
    const group = nodes.find(n => n.id === groupId);
    if (!group) return;

    const isCollapsing = !group.data.collapsed;
    
    // Store original size when collapsing
    const originalStyle = isCollapsing 
      ? { ...group.style, width: group.measured?.width || (group as any).width, height: group.measured?.height || (group as any).height }
      : group.data.originalStyle || group.style;

    set({
      nodes: nodes.map(n => {
        if (n.id === groupId) {
          return {
            ...n,
            data: { 
              ...n.data, 
              collapsed: isCollapsing,
              originalStyle: isCollapsing ? originalStyle : undefined
            },
            style: isCollapsing 
              ? { ...n.style, width: 200, height: 48, zIndex: 10 } 
              : originalStyle
          };
        }
        if (n.parentId === groupId) {
          return { ...n, hidden: isCollapsing };
        }
        return n;
      })
    });
  },

  loadCanvas: (nodes, edges, preserveHistory = false) => {
    const currentLoadId = ++loadCounter;
    if (skipSyncTimeout) {
      clearTimeout(skipSyncTimeout);
      skipSyncTimeout = null;
    }
    
    // Sanitize incoming nodes to prevent NaN from corrupting the canvas
    const safeNodes = (nodes || []).map(n => ({
      ...n,
      position: {
        x: isNaN(n.position?.x) ? 0 : n.position.x,
        y: isNaN(n.position?.y) ? 0 : n.position.y
      }
    }));

    // Clear history ONLY if preserveHistory is false
    set({ 
      nodes: structuredClone(safeNodes), 
      edges: structuredClone(edges || []), 
      past: preserveHistory ? get().past : [], 
      future: preserveHistory ? get().future : [], 
      _skipSync: true, 
      _resyncNeeded: false 
    });
    
    skipSyncTimeout = setTimeout(() => {
      if (currentLoadId === loadCounter) {
        set({ _skipSync: false });
        skipSyncTimeout = null;
      }
    }, 200);
  },

  toggleMinimap: () => set({ showMinimap: !get().showMinimap }),

  setSaveStatus: (s) => set({ saveStatus: s }),

  incSave: () => {
    const c = get()._saveCounter + 1;
    set({ _saveCounter: c, saveStatus: 'saving' });
  },

  decSave: (error?: boolean) => {
    const c = Math.max(0, get()._saveCounter - 1);
    set({ _saveCounter: c, saveStatus: error ? 'error' : c === 0 ? 'saved' : 'saving', lastSavedAt: error ? get().lastSavedAt : Date.now() });
  },

  copySelectedNodes: () => {
    const selected = get().nodes.filter((n) => n.selected);
    if (selected.length > 0) {
      // High-fidelity clone for clipboard
      set({ clipboard: structuredClone(selected) });
    }
  },

  pasteNodes: () => {
    const { clipboard, lastCursorFlowPosition: cursor } = get();
    if (clipboard.length === 0) return;
    get().pushSnapshot('Paste Nodes');

    // Filter clipboard for safe nodes and calculate center
    const safeClipboard = clipboard.filter(n => !isNaN(n.position.x) && !isNaN(n.position.y));
    if (safeClipboard.length === 0) return;

    const minX = Math.min(...safeClipboard.map(n => n.position.x));
    const minY = Math.min(...safeClipboard.map(n => n.position.y));

    const safeCursor = (cursor && !isNaN(cursor.x) && !isNaN(cursor.y)) ? cursor : null;

    const newNodes = safeClipboard.map((n) => {
      const offset = safeCursor
        ? { x: safeCursor.x + (n.position.x - minX), y: safeCursor.y + (n.position.y - minY) }
        : { x: n.position.x + 40, y: n.position.y + 40 };
      
      return {
        ...structuredClone(n),
        id: crypto.randomUUID(),
        position: offset,
        selected: true,
      };
    });
    
    set({ 
      nodes: [...get().nodes.map(n => ({ ...n, selected: false })), ...newNodes] 
    });
  },

  selectAllNodes: () => {
    set({
      nodes: get().nodes.map((n) => ({ ...n, selected: true })),
    });
  },

  toggleCanvasMode: () => {
    const current = get().canvasMode;
    set({ canvasMode: current === 'edit' ? 'view' : 'edit' });
  },

  toggleFocusMode: () => {
    const current = get().focusMode;
    set({ focusMode: !current, focusedNodeId: null });
  },

  setFocusedNodeId: (id) => set({ focusedNodeId: id }),

  toggleSnap: () => set({ snapEnabled: !get().snapEnabled }),

  cycleGridStyle: () => {
    const order: CanvasState['gridStyle'][] = ['dots', 'lines', 'cross', 'graph', 'blank'];
    const idx = order.indexOf(get().gridStyle);
    set({ gridStyle: order[(idx + 1) % order.length] });
  },

  toggleLockAll: () => {
    const lock = !get().allLocked;
    set({
      allLocked: lock,
      nodes: get().nodes.map((n) => ({ ...n, data: { ...n.data, locked: lock } })),
    });
  },

  deleteSelected: () => {
    const selected = get().nodes.filter((n) => n.selected);
    const selectedEdges = get().edges.filter((e) => e.selected);
    if (selected.length === 0 && selectedEdges.length === 0) return;
    
    get().pushSnapshot('Delete Selected');
    const ids = new Set(selected.map((n) => n.id));
    const edgeIds = new Set(selectedEdges.map((e) => e.id));

    const newContentBacklinks = { ...get()._contentBacklinks };
    ids.forEach(id => {
      delete newContentBacklinks[id];
      Object.keys(newContentBacklinks).forEach(targetId => {
        newContentBacklinks[targetId] = (newContentBacklinks[targetId] || []).filter(sourceId => sourceId !== id);
        if (newContentBacklinks[targetId].length === 0) delete newContentBacklinks[targetId];
      });
    });

    set({
      nodes: get().nodes.filter((n) => !ids.has(n.id)),
      edges: get().edges.filter((e) => !edgeIds.has(e.id) && !ids.has(e.source) && !ids.has(e.target)),
      _contentBacklinks: newContentBacklinks,
    });
    get()._syncAllBacklinks();
  },

  duplicateEdge: (id) => {
    const edge = get().edges.find((e) => e.id === id);
    if (!edge) return;
    get().pushSnapshot('Duplicate Connection');
    const newEdge = { ...edge, id: crypto.randomUUID(), data: { ...edge.data } };
    set({ edges: [...get().edges, newEdge] });
  },

  reverseEdge: (id) => {
    const edge = get().edges.find((e) => e.id === id);
    if (!edge) return;
    get().pushSnapshot('Reverse Connection');
    set({
      edges: get().edges.map((e) =>
        e.id === id
          ? { ...e, source: e.target, target: e.source, sourceHandle: e.targetHandle, targetHandle: e.sourceHandle }
          : e
      ),
    });
  },

  deleteEdge: (id) => {
    get().pushSnapshot('Remove Connection');
    set({
      edges: get().edges.filter((e) => e.id !== id),
    });
    get()._syncAllBacklinks();
  },

  setDrawingMode: (val) => set({ drawingMode: val }),
  setZenMode: (val) => set({ zenMode: val }),
  toggleZenMode: () => set((state) => ({ zenMode: !state.zenMode })),

  pushSnapshot: (label = 'Action') => {
    const { nodes, edges, past } = get();
    
    // Atomic/Smart History: If the last action was the same as this one and happened very recently,
    // we don't need a new snapshot (e.g., consecutive 'Move' actions while dragging)
    const lastSnapshot = past[past.length - 1];
    if (lastSnapshot && lastSnapshot.label === label && (Date.now() - lastSnapshot.timestamp < 1000)) {
      // Just update timestamp, don't add new entry
      set({
        past: [...past.slice(0, -1), { ...lastSnapshot, timestamp: Date.now() }]
      });
      return;
    }

    // Use structuredClone for full fidelity deep cloning of the entire state
    const snapshot: HistorySnapshot = { 
      nodes: structuredClone(nodes), 
      edges: structuredClone(edges),
      label,
      timestamp: Date.now()
    };
    set({
      past: [...past.slice(-99), snapshot],
      future: [],
    });
  },

  undo: () => {
    const { past, nodes, edges, future } = get();
    if (past.length === 0) return;
    const prev = past[past.length - 1];
    
    // Clone current state for future
    const currentSnapshot: HistorySnapshot = { 
      nodes: structuredClone(nodes), 
      edges: structuredClone(edges),
      label: 'Undo Action',
      timestamp: Date.now()
    };
    
    set({
      _skipSync: true,
      past: past.slice(0, -1),
      future: [currentSnapshot, ...future],
      nodes: structuredClone(prev.nodes),
      edges: structuredClone(prev.edges),
    });
    queueMicrotask(() => set({ _skipSync: false, _resyncNeeded: true }));
  },

  redo: () => {
    const { future, nodes, edges, past } = get();
    if (future.length === 0) return;
    const next = future[0];
    
    // Clone current state for past
    const currentSnapshot: HistorySnapshot = { 
      nodes: structuredClone(nodes), 
      edges: structuredClone(edges),
      label: 'Redo Action',
      timestamp: Date.now()
    };

    set({
      _skipSync: true,
      future: future.slice(1),
      past: [...past, currentSnapshot],
      nodes: structuredClone(next.nodes),
      edges: structuredClone(next.edges),
    });
    queueMicrotask(() => set({ _skipSync: false, _resyncNeeded: true }));
  },

  clearResyncNeeded: () => set({ _resyncNeeded: false }),
  setVersionHistoryOpen: (open) => set({ versionHistoryOpen: open }),

  setConnectMode: (on) => set({ connectMode: on, connectSourceId: null }),
  setConnectSourceId: (id) => set({ connectSourceId: id }),
  setLastCursorFlowPosition: (pos) => set({ lastCursorFlowPosition: pos }),

  resetState: () => set({
    nodes: [],
    edges: [],
    past: [],
    future: [],
    workspaceId: null,
    saveStatus: 'idle',
    _saveCounter: 0,
    clipboard: [],
    bookmarks: [],
    isBlockEditorMode: false,
    mobileMode: false,
  }),

  addBookmark: (name, viewport) => set({ bookmarks: [...get().bookmarks, { id: crypto.randomUUID(), name, viewport }] }),
  removeBookmark: (id) => set({ bookmarks: get().bookmarks.filter(b => b.id !== id) }),
  addOpenWorkspace: (ws) => {
    const exists = get().openWorkspaces.find(w => w.id === ws.id);
    if (!exists) set({ openWorkspaces: [...get().openWorkspaces, ws] });
  },
  removeOpenWorkspace: (id) => set({ openWorkspaces: get().openWorkspaces.filter(w => w.id !== id) }),
  toggleBlockEditorMode: () => set({ isBlockEditorMode: !get().isBlockEditorMode }),
  toggleMobileMode: () => set({ mobileMode: !get().mobileMode }),
  toggleZoomOnScroll: () => set({ zoomOnScroll: !get().zoomOnScroll }),
  tidyUp: () => {
    const selected = get().nodes.filter(n => n.selected);
    if (selected.length < 2) return;
    
    get().pushSnapshot('Tidy Up Canvas');
    
    // Sort selected nodes top-to-bottom, left-to-right
    const sorted = [...selected].sort((a, b) => (a.position.y - b.position.y) || (a.position.x - b.position.x));
    
    const startX = Math.min(...selected.map(n => n.position.x));
    const startY = Math.min(...selected.map(n => n.position.y));
    
    const COLUMNS = Math.ceil(Math.sqrt(selected.length));
    const SPACING_X = 400;
    const SPACING_Y = 300;
    
    const newNodes = get().nodes.map(n => {
      const idx = sorted.findIndex(s => s.id === n.id);
      if (idx === -1) return n;
      
      const col = idx % COLUMNS;
      const row = Math.floor(idx / COLUMNS);
      
      return {
        ...n,
        position: {
          x: startX + col * SPACING_X,
          y: startY + row * SPACING_Y
        }
      };
    });
    
    set({ nodes: newNodes });
  },

  setExportProgress: (p) => set({ exportProgress: p }),
}));

// Custom Selector Hooks
export const useNodes = () => useCanvasStore(useShallow((s) => s.nodes));
export const useEdges = () => useCanvasStore(useShallow((s) => s.edges));
export const useSelectedNodes = () => useCanvasStore(useShallow((s) => s.nodes.filter(n => n.selected)));
