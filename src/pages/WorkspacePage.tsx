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
import { createSnapshot, pruneSnapshots, subscribeCanvasNodes, subscribeCanvasEdges, subscribeCursors, loadCanvasDrawings } from '@/lib/firebase/canvasData';
import type { DrawingOverlay } from '@/types/canvas';
// Note: deleteCanvasFile is not migrated yet; we'll keep the import or comment it out if not needed now
import { deleteCanvasFile } from '@/lib/r2/storage';
import { auth } from '@/lib/firebase/client';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { PasswordDialog } from '@/components/PasswordDialog';
import { VaultPasswordDialog } from '@/components/VaultPasswordDialog';
import { verifyPassword } from '@/lib/utils/password';

const WorkspacePage = () => {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const [loading, setLoading] = useState(true);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [workspacePasswordHash, setWorkspacePasswordHash] = useState<string | null>(null);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [showVaultPasswordDialog, setShowVaultPasswordDialog] = useState(false);
  const loadCanvas = useCanvasStore((s) => s.loadCanvas);
  const setWorkspaceId = useCanvasStore((s) => s.setWorkspaceId);
  const setWorkspaceMeta = useCanvasStore((s) => s.setWorkspaceMeta);
  const isVaultLocked = useVaultStore((s) => s.isLocked);
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
  // Queue node/edge deletions that occur during _skipSync window so they aren't silently lost
  const deferredDeletes = useRef<{ type: 'node' | 'edge'; id: string }[]>([]);
  const prevSkipSync = useRef(true); // track _skipSync transitions

  const loadWorkspaceData = useCallback(async () => {
    if (!workspaceId) return;
    
    loadComplete.current = false;
    setLoading(true);
    try {
      // SWR: load cached data first for instant render
      const [nodesResult, edgesResult, drawingsResult] = await Promise.all([
        cachedLoadCanvasNodes(workspaceId, (freshNodes) => {
          // Background update when server data arrives
          if (freshNodes.length === 0 && !navigator.onLine) return; // Don't clear if offline and empty

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
          if (freshEdges.length === 0 && !navigator.onLine) return; // Don't clear if offline and empty

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
            loadCanvas(latestNodes, freshEdges, true, useCanvasStore.getState().drawings);
          }
        }),
        cachedLoadCanvasDrawings(workspaceId, (freshDrawings) => {
          if (freshDrawings.length === 0 && !navigator.onLine) return;
          const { nodes: latestNodes, edges: latestEdges } = useCanvasStore.getState();
          loadCanvas(latestNodes, latestEdges, true, freshDrawings);
        }),
      ]);

      // If we have cached data, render immediately
      if (nodesResult.cached && edgesResult.cached) {
        loadCanvas(nodesResult.cached, edgesResult.cached, false, drawingsResult.cached ?? []);
        setLoading(false);
      }

      // Load workspace meta
      getWorkspaces().then((workspaces) => {
        const ws = workspaces?.find(w => w.id === workspaceId);
        if (ws) setWorkspaceMeta(ws.name, ws.color);
      }).catch(() => toast.error('Failed to load workspace metadata'));

      // Background sync: wait for fresh data to ensure source of truth before replaying ops
      try {
        const [nodes, edges, drawings] = await Promise.all([nodesResult.fresh, edgesResult.fresh, drawingsResult.fresh]);
        serverNodeIds.current = new Set(nodes.map(n => n.id));
        serverEdgeIds.current = new Set(edges.map(e => e.id));
        
        // If we had no cache, we MUST load the fresh data now
        if (!nodesResult.cached || !edgesResult.cached) {
          loadCanvas(nodes, edges, false, drawings);
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
  }, [workspaceId, loadCanvas, setWorkspaceMeta]);

   useEffect(() => {
     if (!workspaceId) return;
     setWorkspaceId(workspaceId);
 
     const load = async () => {
 
       try {
         // First, check if workspace is password protected
         const workspaces = await getWorkspaces();
         const ws = workspaces?.find(w => w.id === workspaceId);
         
         // Check if workspace is in the vault and vault is locked
         if (ws?.is_in_vault && useVaultStore.getState().isLocked) {
           setShowVaultPasswordDialog(true);
           setLoading(false);
           return; // Stop loading until vault password is verified
         }
         
         // Check if workspace is individually password protected
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
 
     load();
 
     return () => {
       resetState();
     };
   }, [workspaceId, loadCanvas, setWorkspaceId, setWorkspaceMeta, resetState, loadWorkspaceData, useVaultStore.getState().isLocked]);

  // ─── Real-time Sync ───
  useEffect(() => {
    if (!workspaceId) return;

    let nodesUnsub: (() => void) | null = null;
    let edgesUnsub: (() => void) | null = null;

    // Start listeners
    nodesUnsub = subscribeCanvasNodes(workspaceId, (freshNodes) => {
      if (!loadComplete.current) return;
      
      const { nodes: currentNodes, edges: currentEdges } = useCanvasStore.getState(); // Get current edges here

      // Hardening: If offline and we receive an empty list, it's likely a Firestore sync issue
      // We should NOT clear the canvas in this case if we have current data.
      if (freshNodes.length === 0 && currentNodes.length > 0 && !navigator.onLine) {
        console.warn('[sync] Ignoring empty node update while offline');
        return;
      }
      
      // Hardening: If any nodes are marked as "dirty" locally (unsaved changes),
      // merge those local changes into the fresh remote data so they aren't lost.
      const dirtyIds = useCanvasStore.getState()._dirtyNodeDataIds;
      const mergedNodes = freshNodes.map(fn => {
        if (dirtyIds.has(fn.id)) {
          const localNode = currentNodes.find(n => n.id === fn.id);
          if (localNode) {
            return { ...fn, data: { ...fn.data, ...localNode.data } };
          }
        }
        return fn;
      });

      // Deep compare to avoid unnecessary re-renders
      const nodesChanged = currentNodes.length !== mergedNodes.length || 
                         JSON.stringify(currentNodes) !== JSON.stringify(mergedNodes);
      
      if (nodesChanged) {
        console.log('[sync] Applying real-time node updates (protected by dirty flags)');
        // Use a custom load that preserves history for real-time sync
        // to avoid clearing the undo/redo stack on every remote change
        loadCanvas(mergedNodes, currentEdges, true);
        // Also update local cache
        import('@/lib/cache/indexedDB').then(({ cacheSet }) => {
          cacheSet('canvas-nodes', workspaceId, mergedNodes);
        });
      }
    });

    edgesUnsub = subscribeCanvasEdges(workspaceId, (freshEdges) => {
      if (!loadComplete.current) return;
      
      const { edges: currentEdges, loadCanvas, nodes } = useCanvasStore.getState();

      // Hardening: If offline and we receive an empty list, it's likely a Firestore sync issue
      if (freshEdges.length === 0 && currentEdges.length > 0 && !navigator.onLine) {
        console.warn('[sync] Ignoring empty edge update while offline');
        return;
      }
      
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
      const { cursors } = useCanvasStore.getState();
      const freshIds = new Set(Object.keys(freshCursors));

      // Remove cursors that are no longer present (user left or timed out)
      Object.keys(cursors).forEach((id) => {
        if (!freshIds.has(id)) {
          removeCursor(id);
        }
      });

      // Add/update remaining cursors
      Object.entries(freshCursors).forEach(([id, cursor]) => {
        updateCursorPosition(id, cursor.x, cursor.y, cursor.name, cursor.color);
      });
    });

    return () => {
      if (nodesUnsub) nodesUnsub();
      if (edgesUnsub) edgesUnsub();
      if (cursorsUnsub) cursorsUnsub();
    };
  }, [workspaceId, updateCursorPosition, removeCursor, loadCanvas]);

   // Subscribe to store changes and persist (using cached write-through wrappers)
   useEffect(() => {
     if (!workspaceId) return;
 
     const { incSave, decSave } = useCanvasStore.getState();
 
     const trackSave = (promise: Promise<void>) => {
       incSave();
       promise.then(() => decSave()).catch(() => decSave(true));
     };
 
      const unsub = useCanvasStore.subscribe((state, prev) => {
        // When _skipSync transitions from true to false, flush any queued deletions
        if (prevSkipSync.current && !state._skipSync) {
          prevSkipSync.current = false;
          const queued = deferredDeletes.current.splice(0);
          for (const item of queued) {
            if (item.type === 'node') {
              trackSave(deleteCanvasNode(workspaceId, item.id));
            } else {
              trackSave(deleteCanvasEdge(workspaceId, item.id));
            }
          }
        } else if (!prevSkipSync.current && state._skipSync) {
          prevSkipSync.current = true;
        }

        if (state._skipSync) {
          // During _skipSync, still track deletions so they aren't lost
          const prevNodes = prev.nodes;
          const currNodes = state.nodes;
          const prevEdges = prev.edges;
          const currEdges = state.edges;

          prevNodes.forEach((pNode) => {
            const stillExists = currNodes.find((c) => c.id === pNode.id);
            if (!stillExists && serverNodeIds.current.has(pNode.id)) {
              deferredDeletes.current.push({ type: 'node', id: pNode.id });
            }
          });
          prevEdges.forEach((pEdge) => {
            const stillExists = currEdges.find((c) => c.id === pEdge.id);
            if (!stillExists && serverEdgeIds.current.has(pEdge.id)) {
              deferredDeletes.current.push({ type: 'edge', id: pEdge.id });
            }
          });
          return;
        }
        if (!loadComplete.current) return;
        if (state.workspaceId !== workspaceId) return;

       const prevNodes = prev.nodes;
       const currNodes = state.nodes;
       const prevEdges = prev.edges;
       const currEdges = state.edges;

       // ── Node additions (new nodes → saveNode) ──
       currNodes.forEach((node) => {
         const existed = prevNodes.find((p) => p.id === node.id);
         if (!existed) {
           // Brand-new node: save the whole thing
           trackSave(saveNode(workspaceId, node));
           return;
         }

         // ── Data changes (debounced 800ms) ──
         if (node.data !== existed.data) {
           const prev = dataTimers.current.get(node.id);
           if (prev) clearTimeout(prev);
           dataTimers.current.set(
             node.id,
             setTimeout(() => {
               const { nodes: latest, _clearNodeDataDirty } = useCanvasStore.getState();
               const n = latest.find((n) => n.id === node.id);
               if (n) {
                 trackSave(
                   updateNodeDataInDb(workspaceId, node.id, n.data as Record<string, unknown>).then(() => {
                     _clearNodeDataDirty(node.id);
                   })
                 );
               }
               dataTimers.current.delete(node.id);
             }, 800)
           );
         }

         // ── Position changes (debounced 500ms after drag-end) ──
         if (node.position !== existed.position) {
           const prev = posTimers.current.get(node.id);
           if (prev) clearTimeout(prev);
           posTimers.current.set(
             node.id,
             setTimeout(() => {
               const { nodes: latest } = useCanvasStore.getState();
               const n = latest.find((n) => n.id === node.id);
               if (n) trackSave(updateNodePosition(workspaceId, node.id, n.position.x, n.position.y));
               posTimers.current.delete(node.id);
             }, 500)
           );
         }

         // ── Style changes (width/height/zIndex, debounced 500ms) ──
         if (node.style !== existed.style) {
           const prev = styleTimers.current.get(node.id);
           if (prev) clearTimeout(prev);
           styleTimers.current.set(
             node.id,
             setTimeout(() => {
               const { nodes: latest } = useCanvasStore.getState();
               const n = latest.find((n) => n.id === node.id);
               if (n)
                 trackSave(
                   updateNodeStyle(
                     workspaceId,
                     node.id,
                     (n.style?.width as number) || 300,
                     (n.style?.height as number) || 200,
                     (n.style?.zIndex as number) || 0
                   )
                 );
               styleTimers.current.delete(node.id);
             }, 500)
           );
         }
       });

       // ── Node deletions ──
       prevNodes.forEach((pNode) => {
         const stillExists = currNodes.find((c) => c.id === pNode.id);
         if (!stillExists && serverNodeIds.current.has(pNode.id)) {
           // Cancel any pending debounced saves for this node
           const dt = dataTimers.current.get(pNode.id);
           const pt = posTimers.current.get(pNode.id);
           const st = styleTimers.current.get(pNode.id);
           if (dt) { clearTimeout(dt); dataTimers.current.delete(pNode.id); }
           if (pt) { clearTimeout(pt); posTimers.current.delete(pNode.id); }
           if (st) { clearTimeout(st); styleTimers.current.delete(pNode.id); }
           trackSave(deleteCanvasNode(workspaceId, pNode.id));
         }
       });

        // ── Edge additions ──
        currEdges.forEach((edge) => {
          const existed = prevEdges.find((p) => p.id === edge.id);
          if (!existed) {
            trackSave(saveEdge(workspaceId, edge));
            return;
          }

          // ── Edge source/target/handle changes (re-save entire edge) ──
          if (edge.source !== existed.source || edge.target !== existed.target ||
              edge.sourceHandle !== existed.sourceHandle || edge.targetHandle !== existed.targetHandle) {
            trackSave(saveEdge(workspaceId, edge));
          }

          // ── Edge data/label changes (debounced 800ms) ──
          if (edge.data !== existed.data || edge.label !== existed.label) {
            const prev = edgeTimers.current.get(edge.id);
            if (prev) clearTimeout(prev);
            edgeTimers.current.set(
              edge.id,
              setTimeout(() => {
                const { edges: latest } = useCanvasStore.getState();
                const e = latest.find((e) => e.id === edge.id);
                if (e) trackSave(updateEdgeDataInDb(workspaceId, edge.id, (e.data as Record<string, unknown>) || {}, e.label as string | undefined));
                edgeTimers.current.delete(edge.id);
              }, 800)
            );
          }
        });

       // ── Edge deletions ──
       prevEdges.forEach((pEdge) => {
         const stillExists = currEdges.find((c) => c.id === pEdge.id);
         if (!stillExists && serverEdgeIds.current.has(pEdge.id)) {
           const et = edgeTimers.current.get(pEdge.id);
           if (et) { clearTimeout(et); edgeTimers.current.delete(pEdge.id); }
           trackSave(deleteCanvasEdge(workspaceId, pEdge.id));
         }
       });

       // ── Drawing saves ──
       const currDrawings = state.drawings;
       const prevDrawings = prev.drawings;
       if (currDrawings !== prevDrawings) {
         currDrawings.forEach((d) => {
           const pd = prevDrawings.find((p) => p.id === d.id);
           if (!pd || JSON.stringify(d) !== JSON.stringify(pd)) {
             trackSave(saveDrawing(workspaceId, d));
           }
         });
         prevDrawings.forEach((pd) => {
           if (!currDrawings.find((c) => c.id === pd.id)) {
             trackSave(deleteDrawing(workspaceId, pd.id));
           }
         });
       }
     });
     const curDataTimers = dataTimers.current;
     const curPosTimers = posTimers.current;
     const curStyleTimers = styleTimers.current;
     const curEdgeTimers = edgeTimers.current;
 
      return () => {
        unsub();
        // Clear all pending debounce timers to prevent duplicate writes
        curDataTimers.forEach((timerId) => clearTimeout(timerId));
        curPosTimers.forEach((timerId) => clearTimeout(timerId));
        curStyleTimers.forEach((timerId) => clearTimeout(timerId));
        curEdgeTimers.forEach((timerId) => clearTimeout(timerId));
        // Flush pending debounced saves instead of just clearing timers (prevents data loss on navigation)
        const { nodes, edges } = useCanvasStore.getState();
        curDataTimers.forEach((_, nodeId) => {
          const node = nodes.find(n => n.id === nodeId);
          if (node) updateNodeDataInDb(workspaceId, nodeId, node.data as Record<string, unknown>);
        });
        curPosTimers.forEach((_, nodeId) => {
          const node = nodes.find(n => n.id === nodeId);
          if (node) updateNodePosition(workspaceId, nodeId, node.position.x, node.position.y);
        });
        curStyleTimers.forEach((_, nodeId) => {
          const node = nodes.find(n => n.id === nodeId);
          if (node) updateNodeStyle(workspaceId, nodeId, (node.style?.width as number) || 300, (node.style?.height as number) || 200, (node.style?.zIndex as number) || 0);
        });
        curEdgeTimers.forEach((_, edgeId) => {
          const edge = edges.find(e => e.id === edgeId);
          if (edge) updateEdgeDataInDb(workspaceId, edgeId, (edge.data as Record<string, unknown>) || {}, edge.label as string | undefined);
        });
        curDataTimers.clear();
        curPosTimers.clear();
        curStyleTimers.clear();
        curEdgeTimers.clear();
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

        // Sync drawings
        const { drawings } = useCanvasStore.getState();
        const currDrawingIds = new Set(drawings.map(d => d.id));
        drawings.forEach(d => {
          const prevDrawing = prev.drawings.find(pd => pd.id === d.id);
          if (!prevDrawing || JSON.stringify(d) !== JSON.stringify(prevDrawing)) {
            promises.push(saveDrawing(workspaceId, d));
          }
        });
        prev.drawings.forEach(pd => {
          if (!currDrawingIds.has(pd.id)) promises.push(deleteDrawing(workspaceId, pd.id));
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
   
   // Vault password verification handler
   const handleVerifyVaultPassword = async (password: string): Promise<boolean> => {
     const result = await useVaultStore.getState().unlockVault(password);
     const isValid = result === 'success';
     if (isValid) {
       setShowVaultPasswordDialog(false);
       // Now load the workspace data
       await loadWorkspaceData();
       toast.success('Vault unlocked');
     }
     return isValid;
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
       
       <VaultPasswordDialog
         isOpen={showVaultPasswordDialog}
         onClose={() => setShowVaultPasswordDialog(false)}
         onVerify={handleVerifyVaultPassword}
         title="Vault Locked"
         message="This workspace is in the locked folder. Please enter the vault password to access it."
       />
     </>
  );
};

export default WorkspacePage;
