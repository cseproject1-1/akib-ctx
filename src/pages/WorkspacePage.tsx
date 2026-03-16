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
import { createSnapshot, pruneSnapshots, subscribeCanvasNodes, subscribeCanvasEdges, subscribeCursors } from '@/lib/firebase/canvasData';
// Note: deleteCanvasFile is not migrated yet; we'll keep the import or comment it out if not needed now
import { deleteCanvasFile } from '@/lib/r2/storage';
import { auth } from '@/lib/firebase/client';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { PasswordDialog } from '@/components/PasswordDialog';
import { verifyPassword } from '@/lib/utils/password';

const WorkspacePage = () => {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const [loading, setLoading] = useState(true);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [workspacePasswordHash, setWorkspacePasswordHash] = useState<string | null>(null);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const loadCanvas = useCanvasStore((s) => s.loadCanvas);
  const setWorkspaceId = useCanvasStore((s) => s.setWorkspaceId);
  const setWorkspaceMeta = useCanvasStore((s) => s.setWorkspaceMeta);
  const resetState = useCanvasStore((s) => s.resetState);
  const updateCursorPosition = useCanvasStore((s) => s.updateCursorPosition);
  const removeCursor = useCanvasStore((s) => s.removeCursor);
  const changesSinceSnapshot = useRef(0);
  // Track whether initial load is fully complete — subscriber is inert until this is true
  const loadComplete = useRef(false);
  // Store the server node/edge IDs so we can validate what's real
  const serverNodeIds = useRef<Set<string>>(new Set());
  const serverEdgeIds = useRef<Set<string>>(new Set());

  // Use refs to store active timeouts so they can be cleared consistently and safely
  const dataTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const posTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const styleTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const edgeTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  useEffect(() => {
    if (!workspaceId) return;
    loadComplete.current = false;
    setWorkspaceId(workspaceId);

    const loadCompleteTimer: ReturnType<typeof setTimeout> | null = null;

    const load = async () => {
      try {
        // First, check if workspace is password protected
        const workspaces = await getWorkspaces();
        const ws = workspaces?.find(w => w.id === workspaceId);
        
        if (ws?.is_password_protected && ws.password_hash) {
          setWorkspacePasswordHash(ws.password_hash);
          setShowPasswordDialog(true);
          setLoading(false);
          return; // Stop loading until password is verified
        }

        // If no password protection, proceed with loading
        await loadWorkspaceData();
      } catch (err) {
        console.error('Error checking workspace protection:', err);
        // If error checking protection, try to load anyway
        await loadWorkspaceData();
      }
    };

    const loadWorkspaceData = async () => {
      try {
        // SWR: load cached data first for instant render
        const [nodesResult, edgesResult] = await Promise.all([
          cachedLoadCanvasNodes(workspaceId, (freshNodes) => {
            // Background update when server data arrives
            serverNodeIds.current = new Set(freshNodes.map(n => n.id));
            const { nodes: currentNodes } = useCanvasStore.getState();
            const nodesChanged = currentNodes.length !== freshNodes.length || 
                               currentNodes.some((cn, i) => {
                                 const fn = freshNodes[i];
                                 if (!fn) return true;
                                 return cn.id !== fn.id || 
                                        cn.position.x !== fn.position.x || 
                                        cn.position.y !== fn.position.y ||
                                        JSON.stringify(cn.data) !== JSON.stringify(fn.data) ||
                                        JSON.stringify(cn.style) !== JSON.stringify(fn.style);
                               });
            
            if (nodesChanged) {
              loadCanvas(freshNodes, useCanvasStore.getState().edges);
            }
          }),
          cachedLoadCanvasEdges(workspaceId, (freshEdges) => {
            serverEdgeIds.current = new Set(freshEdges.map(e => e.id));
            const { edges: currentEdges } = useCanvasStore.getState();
            const edgesChanged = currentEdges.length !== freshEdges.length || 
                               currentEdges.some((ce, i) => {
                                 const fe = freshEdges[i];
                                 if (!fe) return true;
                                 return ce.id !== fe.id || 
                                        ce.source !== fe.source ||
                                        ce.target !== fe.target ||
                                        ce.sourceHandle !== fe.sourceHandle ||
                                        ce.targetHandle !== fe.targetHandle ||
                                        JSON.stringify(ce.data) !== JSON.stringify(fe.data) ||
                                        ce.label !== fe.label;
                               });
            
            if (edgesChanged) {
              const { nodes: latestNodes } = useCanvasStore.getState();
              // Use a custom load that preserves history for real-time sync
              loadCanvas(latestNodes, freshEdges, true);
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
        }).catch(() => toast.error('Failed to load workspace metadata'));

        // Background sync: wait for fresh data to ensure source of truth before replaying ops
        try {
          const [nodes, edges] = await Promise.all([nodesResult.fresh, edgesResult.fresh]);
          serverNodeIds.current = new Set(nodes.map(n => n.id));
          serverEdgeIds.current = new Set(edges.map(e => e.id));
          
          // If we had no cache, we MUST load the fresh data now
          if (!nodesResult.cached || !edgesResult.cached) {
            loadCanvas(nodes, edges);
          }
        } catch (err) {
          console.warn('[Workspace] Background update failed, continuing with cache', err);
          if (!nodesResult.cached || !edgesResult.cached) throw err;
        }

        // Mark loading as complete — subscriber can now safely detect changes
        loadComplete.current = true; 
        setLoading(false);
        await replayPendingOps();
      } catch (err) {
        toast.error('Failed to load canvas');
        setLoading(false);
      }
    };

    load();

    return () => {
      if (loadCompleteTimer) clearTimeout(loadCompleteTimer);
      resetState();
    };
  }, [workspaceId, loadCanvas, setWorkspaceId, setWorkspaceMeta, resetState]);

  // ─── Real-time Sync ───
  useEffect(() => {
    if (!workspaceId) return;

    let nodesUnsub: (() => void) | null = null;
    let edgesUnsub: (() => void) | null = null;

    // Start listeners
    nodesUnsub = subscribeCanvasNodes(workspaceId, (freshNodes) => {
      if (!loadComplete.current) return;
      
      const { nodes: currentNodes, edges: currentEdges } = useCanvasStore.getState(); // Get current edges here
      
      // Deep compare to avoid unnecessary re-renders
      const nodesChanged = currentNodes.length !== freshNodes.length || 
                         JSON.stringify(currentNodes) !== JSON.stringify(freshNodes);
      
      if (nodesChanged) {
        console.log('[sync] Applying real-time node updates');
       // Use a custom load that preserves history for real-time sync
      // to avoid clearing the undo/redo stack on every remote change
      loadCanvas(freshNodes, currentEdges, true);
        // Also update local cache
        import('@/lib/cache/indexedDB').then(({ cacheSet }) => {
          cacheSet('canvas-nodes', workspaceId, freshNodes);
        });
      }
    });

    edgesUnsub = subscribeCanvasEdges(workspaceId, (freshEdges) => {
      if (!loadComplete.current) return;
      
      const { edges: currentEdges, loadCanvas, nodes } = useCanvasStore.getState();
      
      const edgesChanged = currentEdges.length !== freshEdges.length || 
                         JSON.stringify(currentEdges) !== JSON.stringify(freshEdges);
      
      if (edgesChanged) {
        console.log('[sync] Applying real-time edge updates');
        const { nodes: latestNodes } = useCanvasStore.getState();
        loadCanvas(latestNodes, freshEdges, true);
        // Also update local cache
        import('@/lib/cache/indexedDB').then(({ cacheSet }) => {
          cacheSet('canvas-edges', workspaceId, freshEdges);
        });
      }
    });

    const cursorsUnsub = subscribeCursors(workspaceId, (freshCursors) => {
      Object.entries(freshCursors).forEach(([id, cursor]) => {
        updateCursorPosition(id, cursor.x, cursor.y, cursor.name, cursor.color);
      });
    });

    return () => {
      if (nodesUnsub) nodesUnsub();
      if (edgesUnsub) edgesUnsub();
      if (cursorsUnsub) cursorsUnsub();
    };
  }, [workspaceId, updateCursorPosition, loadCanvas]);

  // Subscribe to store changes and persist (using cached write-through wrappers)
  useEffect(() => {
    if (!workspaceId) return;

    const { incSave, decSave } = useCanvasStore.getState();
    const currentDataTimers = dataTimers.current;
    const currentPosTimers = posTimers.current;
    const currentStyleTimers = styleTimers.current;
    const currentEdgeTimers = edgeTimers.current;

    const trackSave = (promise: Promise<void>) => {
      incSave();
      promise.then(() => decSave()).catch(() => decSave(true));
    };

    const unsub = useCanvasStore.subscribe((state, prev) => {
      if (state._skipSync) return;
      if (!loadComplete.current) return;
      if (state.workspaceId !== workspaceId) return;
      
      if (prev.workspaceId && prev.workspaceId !== workspaceId) {
        console.warn('[sync] Workspace ID mismatch in prev state, skipping this update');
        return;
      }

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

      // Detect deleted nodes
      const deletedNodes = prev.nodes.filter(pn => !state.nodes.find(n => n.id === pn.id));
      if (deletedNodes.length > 0) {
        import('@/lib/cache/indexedDB').then(({ cacheSet }) => {
          cacheSet('canvas-nodes', workspaceId, state.nodes);
        });
      }
      deletedNodes.forEach(n => {
        trackSave(deleteCanvasNode(workspaceId, n.id));
        const storageKey = (n.data as { storageKey?: string })?.storageKey;
        if (storageKey) deleteCanvasFile(storageKey).catch(() => { });
        
        // Clean up pending timeouts
        if (dataTimers.current.has(n.id)) { clearTimeout(dataTimers.current.get(n.id)); dataTimers.current.delete(n.id); }
        if (posTimers.current.has(n.id)) { clearTimeout(posTimers.current.get(n.id)); posTimers.current.delete(n.id); }
        if (styleTimers.current.has(n.id)) { clearTimeout(styleTimers.current.get(n.id)); styleTimers.current.delete(n.id); }
      });

      // Detect deleted edges
      const deletedEdges = prev.edges.filter(pe => !state.edges.find(e => e.id === pe.id));
      if (deletedEdges.length > 0) {
        import('@/lib/cache/indexedDB').then(({ cacheSet }) => {
          cacheSet('canvas-edges', workspaceId, state.edges);
        });
      }
      deletedEdges.forEach(e => {
        trackSave(deleteCanvasEdge(workspaceId, e.id));
        if (edgeTimers.current.has(e.id)) { clearTimeout(edgeTimers.current.get(e.id)); edgeTimers.current.delete(e.id); }
      });

      // Position, data, and style updates for existing nodes
      state.nodes.forEach(n => {
        const prev_n = prev.nodes.find(pn => pn.id === n.id);
        if (!prev_n) return;

        if (
          (prev_n.position.x !== n.position.x || prev_n.position.y !== n.position.y) &&
          !isNaN(n.position.x) && !isNaN(n.position.y)
        ) {
          const existing = posTimers.current.get(n.id);
          if (existing) clearTimeout(existing);
          posTimers.current.set(n.id, setTimeout(() => {
            trackSave(updateNodePosition(workspaceId, n.id, n.position.x, n.position.y));
            posTimers.current.delete(n.id);
          }, 500));
        }

        const dataChanged = n.data !== prev_n.data;
        if (dataChanged) {
          const existing = dataTimers.current.get(n.id);
          if (existing) clearTimeout(existing);
          dataTimers.current.set(n.id, setTimeout(() => {
            trackSave(updateNodeDataInDb(workspaceId, n.id, n.data as Record<string, unknown>));
            dataTimers.current.delete(n.id);
          }, 800));
        }

        const prevW = (prev_n.style?.width as number) || 300;
        const prevH = (prev_n.style?.height as number) || 200;
        const prevZ = (prev_n.style?.zIndex as number) || 0;
        const curW = (n.style?.width as number) || 300;
        const curH = (n.style?.height as number) || 200;
        const curZ = (n.style?.zIndex as number) || 0;
        if (prevW !== curW || prevH !== curH || prevZ !== curZ) {
          const existing = styleTimers.current.get(n.id);
          if (existing) clearTimeout(existing);
          styleTimers.current.set(n.id, setTimeout(() => {
            trackSave(updateNodeStyle(workspaceId, n.id, curW, curH, curZ));
            styleTimers.current.delete(n.id);
          }, 500));
        }
      });

      // Detect edge data/label changes
      state.edges.forEach(e => {
        const prev_e = prev.edges.find(pe => pe.id === e.id);
        if (!prev_e) return;
        
        // Deep compare data to avoid redundant saves
        const dataChanged = JSON.stringify(e.data) !== JSON.stringify(prev_e.data);
        const labelChanged = e.label !== prev_e.label;
        
        if (dataChanged || labelChanged) {
          const existing = edgeTimers.current.get(e.id);
          if (existing) clearTimeout(existing);
          edgeTimers.current.set(e.id, setTimeout(() => {
            // Re-verify workspaceId before final commit
            if (useCanvasStore.getState().workspaceId === workspaceId) {
              trackSave(updateEdgeDataInDb(workspaceId, e.id, (e.data as Record<string, unknown>) || {}, e.label as string | undefined));
            }
            edgeTimers.current.delete(e.id);
          }, 1000)); // Consolidated slightly longer debounce for edges
        }
      });
    });

    return () => {
      unsub();
      // Ensure all timers are cleared on unmount
      currentDataTimers.forEach(clearTimeout);
      currentPosTimers.forEach(clearTimeout);
      currentStyleTimers.forEach(clearTimeout);
      currentEdgeTimers.forEach(clearTimeout);
      currentDataTimers.clear();
      currentPosTimers.clear();
      currentStyleTimers.clear();
      currentEdgeTimers.clear();
    };
  }, [workspaceId]);

  // ─── Resync after undo/redo ───
  useEffect(() => {
    if (!workspaceId) return;
    let syncing = false;
    const unsub = useCanvasStore.subscribe((state, prev) => {
      if (!loadComplete.current) return;
      if (state.workspaceId !== workspaceId) return;
      if (state._resyncNeeded && !prev._resyncNeeded && !syncing) {
        syncing = true;
        const { nodes, edges, incSave, decSave, clearResyncNeeded } = useCanvasStore.getState();
        clearResyncNeeded();

        const currNodeIds = new Set(nodes.map(n => n.id));
        const currEdgeIds = new Set(edges.map(e => e.id));

        const promises: Promise<void>[] = [];

        nodes.forEach(n => {
          const prevNode = prev.nodes.find(pn => pn.id === n.id);
          if (!prevNode || n.data !== prevNode.data || n.position !== prevNode.position || n.style !== prevNode.style) {
            promises.push(saveNode(workspaceId, n));
          }
        });
        prev.nodes.forEach(pn => {
          if (!currNodeIds.has(pn.id)) promises.push(deleteCanvasNode(workspaceId, pn.id));
        });
        edges.forEach(e => {
          const prevEdge = prev.edges.find(pe => pe.id === e.id);
          if (!prevEdge || e.data !== prevEdge.data || e.label !== prevEdge.label) {
            promises.push(saveEdge(workspaceId, e));
          }
        });
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
    return () => {
      unsub();
    };
  }, [workspaceId]);

  // ─── Auto-snapshot every 5 minutes ───
  useEffect(() => {
    if (!workspaceId) return;
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
      } catch (err) {
        console.error('Auto-save snapshot failed:', err);
      }
    }, 5 * 60 * 1000);

    return () => {
      unsub();
      clearInterval(interval);
    };
  }, [workspaceId]);

  // Password verification handler
  const handleVerifyPassword = async (password: string): Promise<boolean> => {
    if (!workspacePasswordHash) return false;
    
    const isValid = await verifyPassword(password, workspacePasswordHash);
    if (isValid) {
      setIsUnlocked(true);
      setShowPasswordDialog(false);
      // Now load the workspace data
      await loadWorkspaceData();
      toast.success('Workspace unlocked');
    }
    return isValid;
  };

  const loadWorkspaceData = async () => {
    if (!workspaceId) return;
    
    setLoading(true);
    try {
      // SWR: load cached data first for instant render
      const [nodesResult, edgesResult] = await Promise.all([
        cachedLoadCanvasNodes(workspaceId, (freshNodes) => {
          // Background update when server data arrives
          serverNodeIds.current = new Set(freshNodes.map(n => n.id));
          const { nodes: currentNodes } = useCanvasStore.getState();
          const nodesChanged = currentNodes.length !== freshNodes.length || 
                             currentNodes.some((cn, i) => {
                               const fn = freshNodes[i];
                               if (!fn) return true;
                               return cn.id !== fn.id || 
                                      cn.position.x !== fn.position.x || 
                                      cn.position.y !== fn.position.y ||
                                      JSON.stringify(cn.data) !== JSON.stringify(fn.data) ||
                                      JSON.stringify(cn.style) !== JSON.stringify(fn.style);
                             });
          
          if (nodesChanged) {
            loadCanvas(freshNodes, useCanvasStore.getState().edges);
          }
        }),
        cachedLoadCanvasEdges(workspaceId, (freshEdges) => {
          serverEdgeIds.current = new Set(freshEdges.map(e => e.id));
          const { edges: currentEdges } = useCanvasStore.getState();
          const edgesChanged = currentEdges.length !== freshEdges.length || 
                             currentEdges.some((ce, i) => {
                               const fe = freshEdges[i];
                               if (!fe) return true;
                               return ce.id !== fe.id || 
                                      ce.source !== fe.source ||
                                      ce.target !== fe.target ||
                                      ce.sourceHandle !== fe.sourceHandle ||
                                      ce.targetHandle !== fe.targetHandle ||
                                      JSON.stringify(ce.data) !== JSON.stringify(fe.data) ||
                                      ce.label !== fe.label;
                             });
          
          if (edgesChanged) {
            const { nodes: latestNodes } = useCanvasStore.getState();
            // Use a custom load that preserves history for real-time sync
            loadCanvas(latestNodes, freshEdges, true);
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
      }).catch(() => toast.error('Failed to load workspace metadata'));

      // Background sync: wait for fresh data to ensure source of truth before replaying ops
      try {
        const [nodes, edges] = await Promise.all([nodesResult.fresh, edgesResult.fresh]);
        serverNodeIds.current = new Set(nodes.map(n => n.id));
        serverEdgeIds.current = new Set(edges.map(e => e.id));
        
        // If we had no cache, we MUST load the fresh data now
        if (!nodesResult.cached || !edgesResult.cached) {
          loadCanvas(nodes, edges);
        }
      } catch (err) {
        console.warn('[Workspace] Background update failed, continuing with cache', err);
        if (!nodesResult.cached || !edgesResult.cached) throw err;
      }

      // Mark loading as complete — subscriber can now safely detect changes
      loadComplete.current = true; 
      setLoading(false);
      await replayPendingOps();
    } catch (err) {
      toast.error('Failed to load canvas');
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen w-screen flex-col bg-canvas p-4 overflow-hidden relative">
        {/* Top bar skeletons */}
        <div className="flex justify-between items-start pointer-events-none z-10">
          <div className="flex items-center gap-3 glass-morphism rounded-2xl p-2 animate-pulse w-48 h-12" />
          <div className="flex items-center gap-3 glass-morphism rounded-2xl p-2 animate-pulse w-64 h-12" />
        </div>

        {/* Left toolbar skeleton */}
        <div className="absolute left-4 top-1/2 -translate-y-1/2 flex flex-col gap-3 glass-morphism rounded-2xl p-2 animate-pulse w-14 h-[400px]" />

        {/* Bottom toolbar skeleton */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4 glass-morphism rounded-2xl p-3 animate-pulse w-96 h-14" />

        {/* Ghost nodes */}
        <div className="fixed inset-0 pointer-events-none">
          <div className="absolute top-[20%] left-[30%] w-64 h-40 bg-muted/10 rounded-3xl animate-pulse blur-[1px]" />
          <div className="absolute top-[40%] left-[60%] w-72 h-48 bg-muted/5 rounded-3xl animate-pulse blur-[2px]" />
          <div className="absolute top-[60%] left-[25%] w-56 h-36 bg-muted/10 rounded-3xl animate-pulse blur-[1px]" />
        </div>
        
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary/30" />
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/20 animate-pulse">Initializing Workspace</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <ReactFlowProvider>
        <CanvasWrapper />
      </ReactFlowProvider>
      
      <PasswordDialog
        isOpen={showPasswordDialog}
        onClose={() => setShowPasswordDialog(false)}
        onVerify={handleVerifyPassword}
        title="Password Protected Workspace"
        message="This workspace is protected. Please enter the password to unlock it."
      />
    </>
  );
};

export default WorkspacePage;
