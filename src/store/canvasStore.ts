import { create } from 'zustand';
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

interface HistorySnapshot {
  nodes: Node[];
  edges: Edge[];
}

interface CanvasState {
  nodes: Node[];
  edges: Edge[];
  workspaceId: string | null;
  workspaceName: string;
  workspaceColor: string;
  contextMenu: { x: number; y: number; canvasX: number; canvasY: number } | null;
  nodeContextMenu: { x: number; y: number; nodeId: string } | null;
  expandedNode: string | null;
  showMinimap: boolean;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
  _saveCounter: number;
  _skipSync: boolean;
  _resyncNeeded: boolean;
  lastSavedAt: number | null;
  clipboard: Node[];
  canvasMode: 'edit' | 'view';
  focusMode: boolean;
  focusedNodeId: string | null;
  snapEnabled: boolean;
  gridStyle: 'dots' | 'lines' | 'cross';
  allLocked: boolean;
  connectMode: boolean;
  connectSourceId: string | null;
  lastCursorFlowPosition: { x: number; y: number } | null;
  versionHistoryOpen: boolean;

  // History
  past: HistorySnapshot[];
  future: HistorySnapshot[];

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
  setContextMenu: (menu: CanvasState['contextMenu']) => void;
  setNodeContextMenu: (menu: CanvasState['nodeContextMenu']) => void;
  setExpandedNode: (id: string | null) => void;
  bringToFront: (id: string) => void;
  sendToBack: (id: string) => void;
  loadCanvas: (nodes: Node[], edges: Edge[]) => void;
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

  // History actions
  pushSnapshot: () => void;
  undo: () => void;
  redo: () => void;
  clearResyncNeeded: () => void;
  setVersionHistoryOpen: (open: boolean) => void;
  resetState: () => void;
}

let skipSyncTimeout: ReturnType<typeof setTimeout> | null = null;

export const useCanvasStore = create<CanvasState>((set, get) => ({
  nodes: [],
  edges: [],
  workspaceId: null,
  workspaceName: 'Untitled',
  workspaceColor: '#3b82f6',
  contextMenu: null,
  nodeContextMenu: null,
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
  past: [],
  future: [],

  setWorkspaceId: (id) => set({ workspaceId: id }),
  setWorkspaceMeta: (name, color) => set({ workspaceName: name, workspaceColor: color }),
  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),

  onNodesChange: (changes) => {
    set({ nodes: applyNodeChanges(changes, get().nodes) });
  },

  onEdgesChange: (changes) => {
    set({ edges: applyEdgeChanges(changes, get().edges) });
  },

  onConnect: (connection) => {
    get().pushSnapshot();
    set({
      edges: addEdge(
        { ...connection, id: crypto.randomUUID(), type: 'custom', animated: false },
        get().edges
      ),
    });
  },

  addNode: (node) => {
    get().pushSnapshot();
    const cursor = get().lastCursorFlowPosition;
    const positioned = cursor
      ? { ...node, position: { x: cursor.x - 150, y: cursor.y - 50 } }
      : node;
    set({ nodes: [...get().nodes, positioned] });
  },

  deleteNode: (id) => {
    get().pushSnapshot();
    set({
      nodes: get().nodes.filter((n) => n.id !== id),
      edges: get().edges.filter((e) => e.source !== id && e.target !== id),
    });
  },

  duplicateNode: (id) => {
    const node = get().nodes.find((n) => n.id === id);
    if (!node) return;
    get().pushSnapshot();
    // Deep clone data to avoid shared references
    const clonedData = JSON.parse(JSON.stringify(node.data || {}));
    // Reset pinned state on duplicate
    delete clonedData.pinned;
    const newNode: Node = {
      ...node,
      id: crypto.randomUUID(),
      type: node.type,
      position: { x: node.position.x + 30, y: node.position.y + 30 },
      selected: false,
      data: clonedData,
      style: node.style ? { ...node.style } : undefined,
      measured: undefined,
    };
    set({ nodes: [...get().nodes, newNode] });
  },

  updateNodeData: (id, data) => {
    // Filter out undefined values to prevent Firestore sync errors
    const sanitizedData = Object.fromEntries(
      Object.entries(data).filter(([_, v]) => v !== undefined)
    );
    set({
      nodes: get().nodes.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, ...sanitizedData } } : n
      ),
    });
  },

  updateNodeStyle: (id, style) => {
    // Filter out undefined values to prevent Firestore sync errors
    const sanitizedStyle = Object.fromEntries(
      Object.entries(style).filter(([_, v]) => v !== undefined)
    );
    set({
      nodes: get().nodes.map((n) =>
        n.id === id ? { ...n, style: { ...n.style, ...sanitizedStyle } } : n
      ),
    });
  },

  setContextMenu: (menu) => set({ contextMenu: menu }),
  setNodeContextMenu: (menu) => set({ nodeContextMenu: menu }),
  setExpandedNode: (id) => set({ expandedNode: id }),

  bringToFront: (id) => {
    const maxZ = Math.max(...get().nodes.map((n) => (n.style?.zIndex as number) || 0), 0);
    set({
      nodes: get().nodes.map((n) =>
        n.id === id ? { ...n, style: { ...n.style, zIndex: maxZ + 1 } } : n
      ),
    });
  },

  sendToBack: (id) => {
    const minZ = Math.min(...get().nodes.map((n) => (n.style?.zIndex as number) || 0), 0);
    set({
      nodes: get().nodes.map((n) =>
        n.id === id ? { ...n, style: { ...n.style, zIndex: minZ - 1 } } : n
      ),
    });
  },

  loadCanvas: (nodes, edges) => {
    if (skipSyncTimeout) clearTimeout(skipSyncTimeout);
    set({ nodes, edges, past: [], future: [], _skipSync: true });
    // Use setTimeout instead of queueMicrotask for safer timing
    skipSyncTimeout = setTimeout(() => {
      set({ _skipSync: false });
      skipSyncTimeout = null;
    }, 150); // Slightly longer delay to be safe
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
      set({ clipboard: selected.map((n) => ({ ...n, data: { ...n.data } })) });
    }
  },

  pasteNodes: () => {
    const { clipboard, lastCursorFlowPosition: cursor } = get();
    if (clipboard.length === 0) return;
    get().pushSnapshot();

    // Calculate center of clipboard nodes
    const minX = Math.min(...clipboard.map(n => n.position.x));
    const minY = Math.min(...clipboard.map(n => n.position.y));

    const newNodes = clipboard.map((n) => {
      const offset = cursor
        ? { x: cursor.x + (n.position.x - minX), y: cursor.y + (n.position.y - minY) }
        : { x: n.position.x + 40, y: n.position.y + 40 };
      return {
        ...n,
        id: crypto.randomUUID(),
        position: offset,
        selected: false,
        data: { ...n.data },
      };
    });
    set({ nodes: [...get().nodes, ...newNodes] });
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
    const order: CanvasState['gridStyle'][] = ['dots', 'lines', 'cross'];
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
    if (selected.length === 0) return;
    get().pushSnapshot();
    const ids = new Set(selected.map((n) => n.id));
    set({
      nodes: get().nodes.filter((n) => !ids.has(n.id)),
      edges: get().edges.filter((e) => !ids.has(e.source) && !ids.has(e.target)),
    });
  },

  duplicateEdge: (id) => {
    const edge = get().edges.find((e) => e.id === id);
    if (!edge) return;
    get().pushSnapshot();
    const newEdge = { ...edge, id: crypto.randomUUID(), data: { ...edge.data } };
    set({ edges: [...get().edges, newEdge] });
  },

  reverseEdge: (id) => {
    const edge = get().edges.find((e) => e.id === id);
    if (!edge) return;
    get().pushSnapshot();
    set({
      edges: get().edges.map((e) =>
        e.id === id
          ? { ...e, source: e.target, target: e.source, sourceHandle: e.targetHandle, targetHandle: e.sourceHandle }
          : e
      ),
    });
  },

  pushSnapshot: () => {
    const { nodes, edges, past } = get();
    // Deep clone data to prevent reference leakage across history states
    const snapshot = { 
      nodes: nodes.map(n => ({ ...n, data: JSON.parse(JSON.stringify(n.data || {})) })), 
      edges: edges.map(e => ({ ...e, data: JSON.parse(JSON.stringify(e.data || {})) })) 
    };
    set({
      past: [...past.slice(-49), snapshot],
      future: [],
    });
  },

  undo: () => {
    const { past, nodes, edges, future } = get();
    if (past.length === 0) return;
    const prev = past[past.length - 1];
    const currentSnapshot = { 
      nodes: nodes.map(n => ({ ...n, data: JSON.parse(JSON.stringify(n.data || {})) })), 
      edges: edges.map(e => ({ ...e, data: JSON.parse(JSON.stringify(e.data || {})) })) 
    };
    
    set({
      _skipSync: true,
      past: past.slice(0, -1),
      future: [currentSnapshot, ...future],
      nodes: prev.nodes,
      edges: prev.edges,
    });
    queueMicrotask(() => set({ _skipSync: false, _resyncNeeded: true }));
  },

  redo: () => {
    const { future, nodes, edges, past } = get();
    if (future.length === 0) return;
    const next = future[0];
    const currentSnapshot = { 
      nodes: nodes.map(n => ({ ...n, data: JSON.parse(JSON.stringify(n.data || {})) })), 
      edges: edges.map(e => ({ ...e, data: JSON.parse(JSON.stringify(e.data || {})) })) 
    };

    set({
      _skipSync: true,
      future: future.slice(1),
      past: [...past, currentSnapshot],
      nodes: next.nodes,
      edges: next.edges,
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
    clipboard: []
  }),
}));
