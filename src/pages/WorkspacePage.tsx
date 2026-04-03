import { ReactFlowProvider } from '@xyflow/react';
import { CanvasWrapper } from '@/components/canvas/CanvasWrapper';
import { useParams } from 'react-router-dom';
import { useEffect, useState, useRef, useCallback } from 'react';
import { useCanvasStore } from '@/store/canvasStore';
import { useVaultStore } from '@/store/vaultStore';
import {
  cachedLoadCanvasNodes,
  cachedLoadCanvasEdges,
  cachedLoadCanvasDrawings,
  saveNode,
  saveEdge,
  saveDrawing,
  deleteDrawing,
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
import { auth } from '@/lib/firebase/client';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { PasswordDialog } from '@/components/PasswordDialog';
import { VaultPasswordDialog } from '@/components/VaultPasswordDialog';
import { verifyWorkspacePassword } from '@/lib/aiService';

const WorkspacePage = () => {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const [loading, setLoading] = useState(true);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [workspacePasswordHash, setWorkspacePasswordHash] = useState<string | null>(null);
  const [showVaultPasswordDialog, setShowVaultPasswordDialog] = useState(false);
  const loadCanvas = useCanvasStore((s) => s.loadCanvas);
  const setWorkspaceId = useCanvasStore((s) => s.setWorkspaceId);
  const setWorkspaceMeta = useCanvasStore((s) => s.setWorkspaceMeta);
  const isVaultLocked = useVaultStore((s) => s.isLocked);
  const resetState = useCanvasStore((s) => s.resetState);
  const updateCursorPosition = useCanvasStore((s) => s.updateCursorPosition);
  const removeCursor = useCanvasStore((s) => s.removeCursor);
  const changesSinceSnapshot = useRef(0);
  const loadComplete = useRef(false);
  const serverNodeIds = useRef<Set<string>>(new Set());
  const serverEdgeIds = useRef<Set<string>>(new Set());
  const pendingNodeDeletes = useRef<Set<string>>(new Set());
  const pendingEdgeDeletes = useRef<Set<string>>(new Set());
  const pendingDrawingDeletes = useRef<Set<string>>(new Set());

  const dataTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const posTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const styleTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const edgeTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const deferredDeletes = useRef<{ type: 'node' | 'edge'; id: string }[]>([]);
  const prevSkipSync = useRef(true);

  const loadWorkspaceData = useCallback(async () => {
    if (!workspaceId) return;
    
    loadComplete.current = false;
    setLoading(true);
    try {
      const [nodesResult, edgesResult, drawingsResult] = await Promise.all([
        cachedLoadCanvasNodes(workspaceId, (freshNodes) => {
          if (freshNodes.length === 0 && !navigator.onLine) return;
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
            loadCanvas(freshNodes, useCanvasStore.getState().edges, false, useCanvasStore.getState().drawings);
          }
        }),
        cachedLoadCanvasEdges(workspaceId, (freshEdges) => {
          if (freshEdges.length === 0 && !navigator.onLine) return;
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
            loadCanvas(latestNodes, freshEdges, true, useCanvasStore.getState().drawings);
          }
        }),
        cachedLoadCanvasDrawings(workspaceId, (freshDrawings) => {
          if (freshDrawings.length === 0 && !navigator.onLine) return;
          const { nodes: latestNodes, edges: latestEdges } = useCanvasStore.getState();
          loadCanvas(latestNodes, latestEdges, true, freshDrawings);
        }),
      ]);

      if (nodesResult.cached && edgesResult.cached) {
        loadCanvas(nodesResult.cached, edgesResult.cached, false, drawingsResult.cached ?? []);
        setLoading(false);
      }

      getWorkspaces().then((workspaces) => {
        const ws = workspaces?.find(w => w.id === workspaceId);
        if (ws) setWorkspaceMeta(ws.name, ws.color);
      }).catch(() => toast.error('Failed to load workspace metadata'));

      try {
        const [nodes, edges, drawings] = await Promise.all([nodesResult.fresh, edgesResult.fresh, drawingsResult.fresh]);
        serverNodeIds.current = new Set(nodes.map(n => n.id));
        serverEdgeIds.current = new Set(edges.map(e => e.id));
        
        if (!nodesResult.cached || !edgesResult.cached) {
          loadCanvas(nodes, edges, false, drawings);
        }
      } catch (err) {
        console.warn('[Workspace] Background update failed, continuing with cache', err);
        if (!nodesResult.cached || !edgesResult.cached) throw err;
      }

      loadComplete.current = true; 
      setLoading(false);
      await replayPendingOps();
    } catch (err) {
      toast.error('Failed to load canvas');
      setLoading(false);
    }
  }, [workspaceId, loadCanvas, setWorkspaceMeta]);

  useEffect(() => {
    if (!workspaceId) return;
    setWorkspaceId(workspaceId);

    const load = async () => {
      try {
        const workspaces = await getWorkspaces();
        const ws = workspaces?.find(w => w.id === workspaceId);
        
        if (ws?.is_in_vault && useVaultStore.getState().isLocked) {
          setShowVaultPasswordDialog(true);
          setLoading(false);
          return;
        }
        
        if (ws?.is_password_protected && ws.password_hash) {
          setWorkspacePasswordHash(ws.password_hash);
          setShowPasswordDialog(true);
          setLoading(false);
          return;
        }

        await loadWorkspaceData();
      } catch (err) {
        console.error('Error checking workspace protection:', err);
        await loadWorkspaceData();
      }
    };

    load();

    return () => {
      resetState();
    };
  }, [workspaceId, setWorkspaceId, loadWorkspaceData, resetState, isVaultLocked]);

  useEffect(() => {
    if (!workspaceId) return;

    let nodesUnsub: (() => void) | null = null;
    let edgesUnsub: (() => void) | null = null;

    nodesUnsub = subscribeCanvasNodes(workspaceId, (freshNodes) => {
      if (!loadComplete.current) return;
      const { nodes: currentNodes, edges: currentEdges } = useCanvasStore.getState();

      if (freshNodes.length === 0 && currentNodes.length > 0 && !navigator.onLine) {
        console.warn('[sync] Ignoring empty node update while offline');
        return;
      }

      // Filter out nodes that are currently being deleted
      const filteredFreshNodes = freshNodes.filter(fn => {
        if (pendingNodeDeletes.current.has(fn.id)) {
          console.log(`[sync] Skipping restoration of pending delete node: ${fn.id}`);
          return false;
        }
        return true;
      });
      
      const dirtyIds = useCanvasStore.getState()._dirtyNodeDataIds;
      const mergedNodes = filteredFreshNodes.map(fn => {
        if (dirtyIds.has(fn.id)) {
          const localNode = currentNodes.find(n => n.id === fn.id);
          if (localNode) {
            // Optimistic lock: Only update if the server state is strictly newer than our local change
            const fAny = fn as any;
            const lAny = localNode as any;
            const serverMillis = fAny.updated_at?.toMillis?.() || (fAny.updated_at instanceof Date ? fAny.updated_at.getTime() : (typeof fAny.updated_at === 'number' ? fAny.updated_at : 0));
            const localMillis = lAny.updated_at?.toMillis?.() || (lAny.updated_at instanceof Date ? lAny.updated_at.getTime() : (typeof lAny.updated_at === 'number' ? lAny.updated_at : 0));
            
            if (serverMillis <= localMillis && localMillis > 0) {
              // Server is older or same as our dirty local state, keep local
              return { ...fn, ...localNode, position: localNode.position, data: localNode.data };
            }
          }
        }
        return fn;
      });

      // Retain new local nodes that haven't been picked up by the server yet
      const freshNodeIds = new Set(filteredFreshNodes.map(n => n.id));
      const localOnlyNodes = currentNodes.filter(cn => 
        !freshNodeIds.has(cn.id) && !serverNodeIds.current.has(cn.id) && !pendingNodeDeletes.current.has(cn.id)
      );
      
      const finalMergedNodes = [...mergedNodes, ...localOnlyNodes];

      const nodesChanged = currentNodes.length !== finalMergedNodes.length || 
                         currentNodes.some((cn, i) => cn.id !== finalMergedNodes[i]?.id || cn.position.x !== finalMergedNodes[i]?.position.x || cn.position.y !== finalMergedNodes[i]?.position.y) ||
                         JSON.stringify(currentNodes.map(n => n.data)) !== JSON.stringify(finalMergedNodes.map(n => n.data));
      
      if (nodesChanged) {
        loadCanvas(finalMergedNodes, currentEdges, true, useCanvasStore.getState().drawings);
        import('@/lib/cache/indexedDB').then(({ cacheSet }) => {
          cacheSet('canvas-nodes', workspaceId, finalMergedNodes);
        });
      }
    });

    edgesUnsub = subscribeCanvasEdges(workspaceId, (freshEdges) => {
      if (!loadComplete.current) return;
      const { edges: currentEdges, nodes } = useCanvasStore.getState();

      if (freshEdges.length === 0 && currentEdges.length > 0 && !navigator.onLine) {
        console.warn('[sync] Ignoring empty edge update while offline');
        return;
      }

      // Filter out edges that are currently being deleted
      const filteredFreshEdges = freshEdges.filter(fe => {
        if (pendingEdgeDeletes.current.has(fe.id)) {
          console.log(`[sync] Skipping restoration of pending delete edge: ${fe.id}`);
          return false;
        }
        return true;
      });
      
      // Retain new local edges that haven't synced yet
      const freshEdgeIds = new Set(filteredFreshEdges.map(e => e.id));
      const localOnlyEdges = currentEdges.filter(ce => 
        !freshEdgeIds.has(ce.id) && !serverEdgeIds.current.has(ce.id) && !pendingEdgeDeletes.current.has(ce.id)
      );

      const finalMergedEdges = [...filteredFreshEdges, ...localOnlyEdges];

      const edgesChanged = currentEdges.length !== finalMergedEdges.length || 
                         currentEdges.some((ce, i) => ce.id !== finalMergedEdges[i]?.id) ||
                         JSON.stringify(currentEdges.map(e => ({ id: e.id, data: e.data, style: e.style }))) !== JSON.stringify(finalMergedEdges.map(e => ({ id: e.id, data: e.data, style: e.style })));
      
      if (edgesChanged) {
        loadCanvas(nodes, finalMergedEdges, true, useCanvasStore.getState().drawings);
        import('@/lib/cache/indexedDB').then(({ cacheSet }) => {
          cacheSet('canvas-edges', workspaceId, finalMergedEdges);
        });
      }
    });

    const cursorsUnsub = subscribeCursors(workspaceId, (freshCursors) => {
      const { cursors } = useCanvasStore.getState();
      const freshIds = new Set(Object.keys(freshCursors));
      Object.keys(cursors).forEach((id) => {
        if (!freshIds.has(id)) removeCursor(id);
      });
      Object.entries(freshCursors).forEach(([id, cursor]) => {
        updateCursorPosition(id, cursor.x, cursor.y, cursor.name, cursor.color);
      });
    });

    return () => {
      if (nodesUnsub) nodesUnsub();
      if (edgesUnsub) edgesUnsub();
      if (cursorsUnsub) cursorsUnsub();
    };
  }, [workspaceId, loadCanvas, removeCursor, updateCursorPosition]);

  useEffect(() => {
    if (!workspaceId) return;

    const trackSave = (promise: Promise<unknown>) => {
      const { incSave, decSave, setSaveStatus } = useCanvasStore.getState();
      setSaveStatus('saving');
      incSave();
      return promise
        .then(() => {
          decSave();
        })
        .catch((err) => {
          console.error('[sync] trackSave failure:', err);
          decSave(true);
        });
    };

    const unsub = useCanvasStore.subscribe((state, prev) => {
      if (prevSkipSync.current && !state._skipSync) {
        prevSkipSync.current = false;
        const queued = deferredDeletes.current.splice(0);
        for (const item of queued) {
          if (item.type === 'node') trackSave(deleteCanvasNode(workspaceId, item.id));
          else trackSave(deleteCanvasEdge(workspaceId, item.id));
        }
      } else if (!prevSkipSync.current && state._skipSync) {
        prevSkipSync.current = true;
      }

      if (state._skipSync) {
        const prevNodes = prev.nodes;
        const currNodes = state.nodes;
        const prevEdges = prev.edges;
        const currEdges = state.edges;

        prevNodes.forEach((pNode) => {
          if (!currNodes.find((c) => c.id === pNode.id) && serverNodeIds.current.has(pNode.id)) {
            deferredDeletes.current.push({ type: 'node', id: pNode.id });
          }
        });
        prevEdges.forEach((pEdge) => {
          if (!currEdges.find((c) => c.id === pEdge.id) && serverEdgeIds.current.has(pEdge.id)) {
            deferredDeletes.current.push({ type: 'edge', id: pEdge.id });
          }
        });
        return;
      }

      if (!loadComplete.current || state.workspaceId !== workspaceId) return;

      const prevNodes = prev.nodes;
      const currNodes = state.nodes;
      const prevEdges = prev.edges;
      const currEdges = state.edges;

      currNodes.forEach((node) => {
        const existed = prevNodes.find((p) => p.id === node.id);
        if (!existed) {
          console.log('[sync] New node detected in store:', node.id, node.type);
          trackSave(saveNode(workspaceId, node));
          return;
        }

        if (node.data !== existed.data) {
          const pt = dataTimers.current.get(node.id);
          if (pt) clearTimeout(pt);
          dataTimers.current.set(node.id, setTimeout(() => {
            const { nodes: latest, _clearNodeDataDirty } = useCanvasStore.getState();
            const n = latest.find(ln => ln.id === node.id);
            if (n) {
              trackSave(updateNodeDataInDb(workspaceId, node.id, n.data as Record<string, any>).then(() => {
                _clearNodeDataDirty(node.id);
              }));
            }
            dataTimers.current.delete(node.id);
          }, 800));
        }

        if (node.position.x !== existed.position.x || node.position.y !== existed.position.y) {
          const pt = posTimers.current.get(node.id);
          if (pt) clearTimeout(pt);
          posTimers.current.set(node.id, setTimeout(() => {
            const { nodes: latest } = useCanvasStore.getState();
            const n = latest.find(ln => ln.id === node.id);
            if (n) trackSave(updateNodePosition(workspaceId, node.id, n.position.x, n.position.y));
            posTimers.current.delete(node.id);
          }, 500));
        }

        if (node.style !== existed.style) {
          const pt = styleTimers.current.get(node.id);
          if (pt) clearTimeout(pt);
          styleTimers.current.set(node.id, setTimeout(() => {
            const { nodes: latest } = useCanvasStore.getState();
            const n = latest.find(ln => ln.id === node.id);
            if (n) trackSave(updateNodeStyle(workspaceId, node.id, (n.style?.width as number) || 300, (n.style?.height as number) || 200, (n.style?.zIndex as number) || 0));
            styleTimers.current.delete(node.id);
          }, 500));
        }
      });

      prevNodes.forEach((pNode) => {
        if (!currNodes.find(cn => cn.id === pNode.id) && serverNodeIds.current.has(pNode.id)) {
          const dt = dataTimers.current.get(pNode.id);
          const pt = posTimers.current.get(pNode.id);
          const st = styleTimers.current.get(pNode.id);
          if (dt) clearTimeout(dt);
          if (pt) clearTimeout(pt);
          if (st) clearTimeout(st);
          posTimers.current.delete(pNode.id);
          styleTimers.current.delete(pNode.id);
          
          // Deletion Guard: Prevent snapshot restoration until server confirms delete
          pendingNodeDeletes.current.add(pNode.id);
          trackSave(deleteCanvasNode(workspaceId, pNode.id).finally(() => {
            pendingNodeDeletes.current.delete(pNode.id);
          }));
        }
      });

      currEdges.forEach((edge) => {
        const existed = prevEdges.find(pe => pe.id === edge.id);
        if (!existed) {
          trackSave(saveEdge(workspaceId, edge));
          return;
        }
        if (edge.source !== existed.source || edge.target !== existed.target ||
            edge.sourceHandle !== existed.sourceHandle || edge.targetHandle !== existed.targetHandle) {
          trackSave(saveEdge(workspaceId, edge));
        }
        if (edge.data !== existed.data || edge.label !== existed.label) {
          const pt = edgeTimers.current.get(edge.id);
          if (pt) clearTimeout(pt);
          edgeTimers.current.set(edge.id, setTimeout(() => {
            const { edges: latest } = useCanvasStore.getState();
            const e = latest.find(le => le.id === edge.id);
            if (e) trackSave(updateEdgeDataInDb(workspaceId, edge.id, (e.data as Record<string, any>) || {}, e.label as string | undefined));
            edgeTimers.current.delete(edge.id);
          }, 800));
        }
      });

      prevEdges.forEach((pEdge) => {
        if (!currEdges.find(ce => ce.id === pEdge.id) && serverEdgeIds.current.has(pEdge.id)) {
          const et = edgeTimers.current.get(pEdge.id);
          if (et) clearTimeout(et);
          edgeTimers.current.delete(pEdge.id);

          // Deletion Guard: Prevent snapshot restoration until server confirms delete
          pendingEdgeDeletes.current.add(pEdge.id);
          trackSave(deleteCanvasEdge(workspaceId, pEdge.id).finally(() => {
            pendingEdgeDeletes.current.delete(pEdge.id);
          }));
        }
      });

      const currDrawings = state.drawings;
      const prevDrawings = prev.drawings;
      if (currDrawings !== prevDrawings) {
        currDrawings.forEach((d) => {
          const pd = prevDrawings.find((p) => p.id === d.id);
          if (!pd || JSON.stringify(d) !== JSON.stringify(pd)) trackSave(saveDrawing(workspaceId, d));
        });
        prevDrawings.forEach((pd) => {
          if (!currDrawings.find((c) => c.id === pd.id)) {
            pendingDrawingDeletes.current.add(pd.id);
            trackSave(deleteDrawing(workspaceId, pd.id).finally(() => {
              pendingDrawingDeletes.current.delete(pd.id);
            }));
          }
        });
      }
    });

    return () => {
      unsub();
      dataTimers.current.forEach(t => clearTimeout(t));
      posTimers.current.forEach(t => clearTimeout(t));
      styleTimers.current.forEach(t => clearTimeout(t));
      edgeTimers.current.forEach(t => clearTimeout(t));
      
      const { nodes, edges } = useCanvasStore.getState();
      dataTimers.current.forEach((_, id) => {
        const n = nodes.find(ln => ln.id === id);
        if (n) updateNodeDataInDb(workspaceId, id, n.data as Record<string, any>);
      });
      posTimers.current.forEach((_, id) => {
        const n = nodes.find(ln => ln.id === id);
        if (n) updateNodePosition(workspaceId, id, n.position.x, n.position.y);
      });
      styleTimers.current.forEach((_, id) => {
        const n = nodes.find(ln => ln.id === id);
        if (n) updateNodeStyle(workspaceId, id, (n.style?.width as number) || 300, (n.style?.height as number) || 200, (n.style?.zIndex as number) || 0);
      });
      edgeTimers.current.forEach((_, id) => {
        const e = edges.find(le => le.id === id);
        if (e) updateEdgeDataInDb(workspaceId, id, (e.data as Record<string, any>) || {}, e.label as string | undefined);
      });
    };
  }, [workspaceId]);

  useEffect(() => {
    if (!workspaceId) return;
    let syncing = false;
    const unsub = useCanvasStore.subscribe((state, prev) => {
      if (!loadComplete.current || state.workspaceId !== workspaceId) return;
      
      const { incSave, decSave, setSaveStatus, clearResyncNeeded } = useCanvasStore.getState();
      
      // Handle Force Resync
      if (state._resyncNeeded && !prev._resyncNeeded && !syncing) {
        syncing = true;
        clearResyncNeeded();
        console.log('[sync] Force resync triggered');
        
        const { nodes, edges, drawings } = state;
        const promises = [
          ...nodes.map(n => saveNode(workspaceId, n)),
          ...edges.map(e => saveEdge(workspaceId, e)),
          ...drawings.map(d => saveDrawing(workspaceId, d))
        ];

        setSaveStatus('saving');
        incSave();
        Promise.all(promises)
          .then(() => decSave())
          .catch((err) => {
            console.error('[sync] Force resync failure:', err);
            decSave(true);
          })
          .finally(() => {
            syncing = false;
          });
      }
    });
    return () => unsub();
  }, [workspaceId]);

  useEffect(() => {
    if (!workspaceId) return;
    const unsub = useCanvasStore.subscribe((state, prev) => {
      if (state.nodes !== prev.nodes || state.edges !== prev.edges) changesSinceSnapshot.current++;
    });
    const interval = setInterval(async () => {
      if (changesSinceSnapshot.current === 0) return;
      changesSinceSnapshot.current = 0;
      try {
        const user = auth.currentUser;
        if (!user) return;
        const { nodes, edges, drawings } = useCanvasStore.getState();
        await createSnapshot(workspaceId, 'Auto-save', nodes as unknown[], edges as unknown[], user.uid, drawings as unknown[]);
        await pruneSnapshots(workspaceId, 50);
      } catch (err) {
        console.error('Auto-save snapshot failed:', err);
      }
    }, 5 * 60 * 1000);
    return () => { unsub(); clearInterval(interval); };
  }, [workspaceId]);

  const handleVerifyPassword = async (password: string): Promise<boolean> => {
    if (!workspacePasswordHash) return false;
    const isValid = await verifyWorkspacePassword(password, workspacePasswordHash);
    if (isValid) {
      setShowPasswordDialog(false);
      await loadWorkspaceData();
      toast.success('Workspace unlocked');
    }
    return isValid;
  };
  
  const handleVerifyVaultPassword = async (password: string): Promise<boolean> => {
    const result = await useVaultStore.getState().unlockVault(password);
    if (result === 'success') {
      setShowVaultPasswordDialog(false);
      await loadWorkspaceData();
      toast.success('Vault unlocked');
      return true;
    }
    return false;
  };

  if (loading) {
    return (
      <div className="flex h-screen w-screen flex-col bg-canvas p-4 overflow-hidden relative">
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
       <PasswordDialog isOpen={showPasswordDialog} onClose={() => setShowPasswordDialog(false)} onVerify={handleVerifyPassword} title="Password Protected Workspace" message="This workspace is protected. Please enter the password to unlock it." />
       <VaultPasswordDialog isOpen={showVaultPasswordDialog} onClose={() => setShowVaultPasswordDialog(false)} onVerify={handleVerifyVaultPassword} title="Vault Locked" message="This workspace is in the locked folder. Please enter the vault password to access it." />
     </>
  );
};

export default WorkspacePage;
