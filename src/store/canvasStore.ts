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
  setEdgeContextMenu: (menu: CanvasState['edgeContextMenu']) => void;
  updateEdgeData: (id: string, data: Record<string, unknown>) => void;
  setExpandedNode: (id: string | null) => void;
  bringToFront: (id: string) => void;
  bringNodesToFront: (ids: string[]) => void;
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
  toggleGroupCollapse: (groupId: string) => void;
  addBookmark: (name: string, viewport: { x: number; y: number; zoom: number }) => void;
  removeBookmark: (id: string) => void;
  addOpenWorkspace: (workspace: { id: string; name: string; color: string }) => void;
  removeOpenWorkspace: (id: string) => void;
  setAISynthesisOpen: (open: boolean) => void;
  setOpenWorkspaces: (workspaces: { id: string; name: string; color: string }[]) => void;
  toggleBlockEditorMode: () => void;
  toggleMobileMode: () => void;
  importNodes: (nodes: Node[]) => void;
  updateBacklinks: (sourceId: string, targetIds: string[]) => void;



  // History actions
  pushSnapshot: (label?: string) => void;
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
  past: [],
  future: [],
  backlinks: {},


  importNodes: (newNodes) => {
    get().pushSnapshot('Import Nodes');
    set({ nodes: [...get().nodes, ...newNodes] });
  },

  updateBacklinks: (sourceId, targetIds) => {
    const newBacklinks = { ...get().backlinks };
    
    // Remove old backlinks from this source
    Object.keys(newBacklinks).forEach(targetId => {
      newBacklinks[targetId] = newBacklinks[targetId].filter(id => id !== sourceId);
      if (newBacklinks[targetId].length === 0) delete newBacklinks[targetId];
    });

    // Add new backlinks
    targetIds.forEach(targetId => {
      if (!newBacklinks[targetId]) newBacklinks[targetId] = [];
      if (!newBacklinks[targetId].includes(sourceId)) {
        newBacklinks[targetId].push(sourceId);
      }
    });

    set({ backlinks: newBacklinks });
  },


  setWorkspaceId: (id) => set({ workspaceId: id }),
  setWorkspaceMeta: (name, color) => set({ workspaceName: name, workspaceColor: color }),
  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),

  onNodesChange: (changes) => {
    const nodes = get().nodes;
    const removedIds = changes
      .filter((c) => c.type === 'remove')
      .map((c) => (c as { id: string }).id);

    if (removedIds.length > 0) {
      const newBacklinks = { ...get().backlinks };
      removedIds.forEach(id => {
        delete newBacklinks[id];
        Object.keys(newBacklinks).forEach(targetId => {
          newBacklinks[targetId] = newBacklinks[targetId].filter(sourceId => sourceId !== id);
          if (newBacklinks[targetId].length === 0) delete newBacklinks[targetId];
        });
      });
      set({ backlinks: newBacklinks });
    }

    set({ nodes: applyNodeChanges(changes, nodes) });
  },

  onEdgesChange: (changes) => {
    set({ edges: applyEdgeChanges(changes, get().edges) });
  },

  onConnect: (connection) => {
    get().pushSnapshot('Connect Nodes');
    set({
      edges: addEdge(
        { ...connection, id: crypto.randomUUID(), type: 'custom', animated: false },
        get().edges
      ),
    });
  },

  setAISynthesisOpen: (open) => set({ isAISynthesisOpen: open }),
  setOpenWorkspaces: (workspaces) => set({ openWorkspaces: workspaces }),

  addNode: (node) => {
    get().pushSnapshot(`Add ${node.type} Node`);
    const cursor = get().lastCursorFlowPosition;
    const positioned = cursor
      ? { ...node, position: { x: cursor.x - 150, y: cursor.y - 50 } }
      : node;
    set({ nodes: [...get().nodes, positioned] });
  },

  deleteNode: (id) => {
    get().pushSnapshot('Remove Node');
    const newBacklinks = { ...get().backlinks };
    delete newBacklinks[id];
    Object.keys(newBacklinks).forEach(targetId => {
      newBacklinks[targetId] = newBacklinks[targetId].filter(sourceId => sourceId !== id);
      if (newBacklinks[targetId].length === 0) delete newBacklinks[targetId];
    });

    set({
      nodes: get().nodes.filter((n) => n.id !== id),
      edges: get().edges.filter((e) => e.source !== id && e.target !== id),
      backlinks: newBacklinks,
    });
  },

  duplicateNode: (id) => {
    const node = get().nodes.find((n) => n.id === id);
    if (!node) return;
    get().pushSnapshot('Duplicate Node');
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
  setEdgeContextMenu: (menu) => set({ edgeContextMenu: menu }),
  updateEdgeData: (id, data) => {
    // Filter out undefined values to prevent Firestore sync errors
    const sanitizedData = Object.fromEntries(
      Object.entries(data).filter(([_, v]) => v !== undefined)
    );
    set({
      edges: get().edges.map((e) =>
        e.id === id ? { ...e, data: { ...e.data, ...sanitizedData } } : e
      ),
    });
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
        nodes: state.nodes.map((n, i) =>
          idSet.has(n.id) ? { ...n, style: { ...n.style, zIndex: maxZ + 1 + i } } : n
        ),
      };
    });
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

  toggleGroupCollapse: (groupId) => {
    const nodes = get().nodes;
    const group = nodes.find(n => n.id === groupId);
    if (!group) return;

    const isCollapsing = !(group.data as any).collapsed;
    
    // Store original size when collapsing
    const originalStyle = isCollapsing 
      ? { ...group.style, width: group.measured?.width || group.width, height: group.measured?.height || group.height }
      : (group.data as any).originalStyle || group.style;

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
    get().pushSnapshot('Paste Nodes');

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
    if (selected.length === 0) return;
    get().pushSnapshot('Delete Selected');
    const ids = new Set(selected.map((n) => n.id));

    const newBacklinks = { ...get().backlinks };
    ids.forEach(id => {
      delete newBacklinks[id];
      Object.keys(newBacklinks).forEach(targetId => {
        newBacklinks[targetId] = newBacklinks[targetId].filter(sourceId => sourceId !== id);
        if (newBacklinks[targetId].length === 0) delete newBacklinks[targetId];
      });
    });

    set({
      nodes: get().nodes.filter((n) => !ids.has(n.id)),
      edges: get().edges.filter((e) => !ids.has(e.source) && !ids.has(e.target)),
      backlinks: newBacklinks,
    });
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

  pushSnapshot: (label = 'Action') => {
    const { nodes, edges, past } = get();
    // Deep clone data to prevent reference leakage across history states
    const snapshot: HistorySnapshot = { 
      nodes: nodes.map(n => ({ ...n, data: JSON.parse(JSON.stringify(n.data || {})) })), 
      edges: edges.map(e => ({ ...e, data: JSON.parse(JSON.stringify(e.data || {})) })),
      label,
      timestamp: Date.now()
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
    const currentSnapshot: HistorySnapshot = { 
      nodes: nodes.map(n => ({ ...n, data: JSON.parse(JSON.stringify(n.data || {})) })), 
      edges: edges.map(e => ({ ...e, data: JSON.parse(JSON.stringify(e.data || {})) })),
      label: 'Undo Action',
      timestamp: Date.now()
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
    const currentSnapshot: HistorySnapshot = { 
      nodes: nodes.map(n => ({ ...n, data: JSON.parse(JSON.stringify(n.data || {})) })), 
      edges: edges.map(e => ({ ...e, data: JSON.parse(JSON.stringify(e.data || {})) })),
      label: 'Redo Action',
      timestamp: Date.now()
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
}));

// Custom Selector Hooks
export const useNodes = () => useCanvasStore(useShallow((s) => s.nodes));
export const useEdges = () => useCanvasStore(useShallow((s) => s.edges));
export const useSelectedNodes = () => useCanvasStore(useShallow((s) => s.nodes.filter(n => n.selected)));
