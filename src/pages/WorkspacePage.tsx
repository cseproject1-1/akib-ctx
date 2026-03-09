import { ReactFlowProvider } from '@xyflow/react';
import { CanvasWrapper } from '@/components/canvas/CanvasWrapper';
import { useParams } from 'react-router-dom';
import { useEffect, useState, useRef } from 'react';
import { useCanvasStore } from '@/store/canvasStore';
import {
  cachedLoadCanvasNodes,
  cachedLoadCanvasEdges,
  saveNode,
  saveEdge,
  deleteCanvasNode,
  deleteCanvasEdge,
  updateNodePosition,
  updateNodeDataInDb,
  updateNodeStyle,
  updateEdgeDataInDb,
  replayPendingOps,
} from '@/lib/cache/canvasCache';
import { getWorkspaces } from '@/lib/firebase/workspaces';
import { createSnapshot, pruneSnapshots } from '@/lib/firebase/canvasData';
// Note: deleteCanvasFile is not migrated yet; we'll keep the import or comment it out if not needed now
import { deleteCanvasFile } from '@/lib/r2/storage';
import { auth } from '@/lib/firebase/client';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const WorkspacePage = () => {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const [loading, setLoading] = useState(true);
  const { loadCanvas, setWorkspaceId, setWorkspaceMeta } = useCanvasStore();
  const changesSinceSnapshot = useRef(0);
  // Track whether initial load is fully complete — subscriber is inert until this is true
  const loadComplete = useRef(false);
  // Store the server node/edge IDs so we can validate what's real
  const serverNodeIds = useRef<Set<string>>(new Set());
  const serverEdgeIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!workspaceId) return;
    loadComplete.current = false;
    setWorkspaceId(workspaceId);

    const load = async () => {
      try {
        // SWR: load cached data first for instant render
        const [nodesResult, edgesResult] = await Promise.all([
          cachedLoadCanvasNodes(workspaceId, (freshNodes) => {
            // Background update when server data arrives
            serverNodeIds.current = new Set(freshNodes.map(n => n.id));
            const { nodes: currentNodes } = useCanvasStore.getState();
            if (JSON.stringify(currentNodes) !== JSON.stringify(freshNodes)) {
              loadCanvas(freshNodes, useCanvasStore.getState().edges);
            }
          }),
          cachedLoadCanvasEdges(workspaceId, (freshEdges) => {
            serverEdgeIds.current = new Set(freshEdges.map(e => e.id));
            const { edges: currentEdges } = useCanvasStore.getState();
            if (JSON.stringify(currentEdges) !== JSON.stringify(freshEdges)) {
              loadCanvas(useCanvasStore.getState().nodes, freshEdges);
            }
          }),
        ]);

        // If we have cached data, render immediately
        if (nodesResult.cached && edgesResult.cached) {
          loadCanvas(nodesResult.cached, edgesResult.cached);
          setLoading(false);
        }

        // Load workspace meta
        getWorkspaces().then((workspaces) => {
          const ws = workspaces?.find(w => w.id === workspaceId);
          if (ws) setWorkspaceMeta(ws.name, ws.color);
        }).catch(() => { });

        // Wait for fresh data if no cache
        if (!nodesResult.cached || !edgesResult.cached) {
          const [nodes, edges] = await Promise.all([nodesResult.fresh, edgesResult.fresh]);
          serverNodeIds.current = new Set(nodes.map(n => n.id));
          serverEdgeIds.current = new Set(edges.map(e => e.id));
          loadCanvas(nodes, edges);
        } else {
          // Even with cache, wait for fresh data to populate serverIds
          Promise.all([nodesResult.fresh, edgesResult.fresh]).then(([nodes, edges]) => {
            serverNodeIds.current = new Set(nodes.map(n => n.id));
            serverEdgeIds.current = new Set(edges.map(e => e.id));
          }).catch(() => { });
        }

        // Replay pending ops after data is loaded to avoid race conditions
        replayPendingOps();

        // Mark loading as complete — subscriber can now safely detect changes
        // Use a small delay to ensure all loadCanvas microtasks have settled
        setTimeout(() => { loadComplete.current = true; }, 200);
      } catch (err) {
        toast.error('Failed to load canvas');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [workspaceId, loadCanvas, setWorkspaceId, setWorkspaceMeta]);

  // Subscribe to store changes and persist (using cached write-through wrappers)
  useEffect(() => {
    if (!workspaceId) return;
    const dataTimers = new Map<string, ReturnType<typeof setTimeout>>();
    const posTimers = new Map<string, ReturnType<typeof setTimeout>>();
    const styleTimers = new Map<string, ReturnType<typeof setTimeout>>();
    const edgeTimers = new Map<string, ReturnType<typeof setTimeout>>();

    const { incSave, decSave } = useCanvasStore.getState();

    const trackSave = (promise: Promise<void>) => {
      incSave();
      promise.then(() => decSave()).catch(() => decSave(true));
    };

    const unsub = useCanvasStore.subscribe((state, prev) => {
      if (state._skipSync) return;

      // Save new nodes
      const newNodes = state.nodes.filter(n => !prev.nodes.find(pn => pn.id === n.id));
      newNodes.forEach(n => {
        trackSave(saveNode(workspaceId, n));
      });

      // Save new edges
      const newEdges = state.edges.filter(e => !prev.edges.find(pe => pe.id === e.id));
      newEdges.forEach(e => {
        trackSave(saveEdge(workspaceId, e));
      });

      // Detect deleted nodes — update local cache immediately so deletes survive refresh
      const deletedNodes = prev.nodes.filter(pn => !state.nodes.find(n => n.id === pn.id));
      if (deletedNodes.length > 0) {
        // Eagerly update local cache with current state
        import('@/lib/cache/indexedDB').then(({ cacheSet }) => {
          cacheSet('canvas-nodes', workspaceId, state.nodes);
        });
      }
      deletedNodes.forEach(n => {
        trackSave(deleteCanvasNode(workspaceId, n.id));
        const storageKey = (n.data as any)?.storageKey;
        if (storageKey) deleteCanvasFile(storageKey).catch(() => { });
      });

      // Detect deleted edges — update local cache immediately
      const deletedEdges = prev.edges.filter(pe => !state.edges.find(e => e.id === pe.id));
      if (deletedEdges.length > 0) {
        import('@/lib/cache/indexedDB').then(({ cacheSet }) => {
          cacheSet('canvas-edges', workspaceId, state.edges);
        });
      }
      deletedEdges.forEach(e => {
        trackSave(deleteCanvasEdge(workspaceId, e.id));
      });

      // Position, data, and style updates for existing nodes
      state.nodes.forEach(n => {
        const prev_n = prev.nodes.find(pn => pn.id === n.id);
        if (!prev_n) return;

        if (prev_n.position.x !== n.position.x || prev_n.position.y !== n.position.y) {
          const existing = posTimers.get(n.id);
          if (existing) clearTimeout(existing);
          posTimers.set(n.id, setTimeout(() => {
            trackSave(updateNodePosition(workspaceId, n.id, n.position.x, n.position.y));
            posTimers.delete(n.id);
          }, 500));
        }

        if (JSON.stringify(prev_n.data) !== JSON.stringify(n.data)) {
          const existing = dataTimers.get(n.id);
          if (existing) clearTimeout(existing);
          dataTimers.set(n.id, setTimeout(() => {
            trackSave(updateNodeDataInDb(workspaceId, n.id, n.data as Record<string, unknown>));
            dataTimers.delete(n.id);
          }, 800));
        }

        const prevW = (prev_n.style?.width as number) || 300;
        const prevH = (prev_n.style?.height as number) || 200;
        const prevZ = (prev_n.style?.zIndex as number) || 0;
        const curW = (n.style?.width as number) || 300;
        const curH = (n.style?.height as number) || 200;
        const curZ = (n.style?.zIndex as number) || 0;
        if (prevW !== curW || prevH !== curH || prevZ !== curZ) {
          const existing = styleTimers.get(n.id);
          if (existing) clearTimeout(existing);
          styleTimers.set(n.id, setTimeout(() => {
            trackSave(updateNodeStyle(workspaceId, n.id, curW, curH, curZ));
            styleTimers.delete(n.id);
          }, 500));
        }
      });

      // Detect edge data/label changes
      state.edges.forEach(e => {
        const prev_e = prev.edges.find(pe => pe.id === e.id);
        if (!prev_e) return;
        if (JSON.stringify(prev_e.data) !== JSON.stringify(e.data) || prev_e.label !== e.label) {
          const existing = edgeTimers.get(e.id);
          if (existing) clearTimeout(existing);
          edgeTimers.set(e.id, setTimeout(() => {
            trackSave(updateEdgeDataInDb(workspaceId, e.id, (e.data as Record<string, unknown>) || {}, e.label as string | undefined));
            edgeTimers.delete(e.id);
          }, 800));
        }
      });
    });

    return () => {
      unsub();
      dataTimers.forEach(t => clearTimeout(t));
      posTimers.forEach(t => clearTimeout(t));
      styleTimers.forEach(t => clearTimeout(t));
      edgeTimers.forEach(t => clearTimeout(t));
    };
  }, [workspaceId]);

  // ─── Resync after undo/redo ───
  useEffect(() => {
    if (!workspaceId) return;
    let syncing = false;
    const unsub = useCanvasStore.subscribe((state, prev) => {
      if (state._resyncNeeded && !prev._resyncNeeded && !syncing) {
        syncing = true;
        const { nodes, edges, incSave, decSave, clearResyncNeeded } = useCanvasStore.getState();
        clearResyncNeeded();

        // Compute diff against prev snapshot instead of saving everything
        const prevNodeIds = new Set(prev.nodes.map(n => n.id));
        const currNodeIds = new Set(nodes.map(n => n.id));
        const prevEdgeIds = new Set(prev.edges.map(e => e.id));
        const currEdgeIds = new Set(edges.map(e => e.id));

        const promises: Promise<void>[] = [];

        // Save new/changed nodes
        nodes.forEach(n => {
          const prevNode = prev.nodes.find(pn => pn.id === n.id);
          if (!prevNode || JSON.stringify(prevNode) !== JSON.stringify(n)) {
            promises.push(saveNode(workspaceId, n));
          }
        });
        // Delete removed nodes
        prev.nodes.forEach(pn => {
          if (!currNodeIds.has(pn.id)) promises.push(deleteCanvasNode(workspaceId, pn.id));
        });
        // Save new/changed edges
        edges.forEach(e => {
          const prevEdge = prev.edges.find(pe => pe.id === e.id);
          if (!prevEdge || JSON.stringify(prevEdge) !== JSON.stringify(e)) {
            promises.push(saveEdge(workspaceId, e));
          }
        });
        // Delete removed edges
        prev.edges.forEach(pe => {
          if (!currEdgeIds.has(pe.id)) promises.push(deleteCanvasEdge(workspaceId, pe.id));
        });

        if (promises.length > 0) {
          incSave();
          Promise.all(promises)
            .then(() => decSave())
            .catch(() => decSave(true))
            .finally(() => { syncing = false; });
        } else {
          syncing = false;
        }
      }
    });
    return unsub;
  }, [workspaceId]);

  // ─── Auto-snapshot every 5 minutes ───
  useEffect(() => {
    if (!workspaceId) return;
    // Track changes
    const unsub = useCanvasStore.subscribe((state, prev) => {
      if (state.nodes !== prev.nodes || state.edges !== prev.edges) {
        changesSinceSnapshot.current++;
      }
    });

    const interval = setInterval(async () => {
      if (changesSinceSnapshot.current === 0) return;
      changesSinceSnapshot.current = 0;
      try {
        const user = auth.currentUser;
        if (!user) return;
        const { nodes, edges } = useCanvasStore.getState();
        await createSnapshot(workspaceId, 'Auto-save', nodes as unknown[], edges as unknown[], user.uid);
        await pruneSnapshots(workspaceId, 50);
      } catch { }
    }, 5 * 60 * 1000); // 5 minutes

    return () => {
      unsub();
      clearInterval(interval);
    };
  }, [workspaceId]);

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <ReactFlowProvider>
      <CanvasWrapper />
    </ReactFlowProvider>
  );
};

export default WorkspacePage;
