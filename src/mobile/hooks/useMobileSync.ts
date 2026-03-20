import { useCallback } from 'react';
import { useCanvasStore } from '@/store/canvasStore';
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
  updateEdgeDataInDb,
  replayPendingOps,
} from '@/lib/cache/canvasCache';
import { getWorkspaces } from '@/lib/firebase/workspaces';

// Reuse existing sync infrastructure to ensure mobile works identically to desktop
// This ensures data integrity and no corruption - uses the same IndexedDB and Firebase logic
export function useMobileSync() {
  const workspaceId = useCanvasStore((s) => s.workspaceId);
  const loadCanvas = useCanvasStore((s) => s.loadCanvas);
  const setWorkspaceMeta = useCanvasStore((s) => s.setWorkspaceMeta);

  const loadWorkspaceData = useCallback(async (id: string) => {
    try {
      // Use existing cache system - identical to desktop
      const [nodesResult, edgesResult, drawingsResult] = await Promise.all([
        cachedLoadCanvasNodes(id, (freshNodes) => {
          // Background sync callback - same as desktop
          const { nodes: currentNodes } = useCanvasStore.getState();
          const nodesChanged = currentNodes.length !== freshNodes.length;
          if (nodesChanged) {
            loadCanvas(freshNodes, useCanvasStore.getState().edges, false, useCanvasStore.getState().drawings);
          }
        }),
        cachedLoadCanvasEdges(id, (freshEdges) => {
          const { edges: currentEdges } = useCanvasStore.getState();
          const edgesChanged = currentEdges.length !== freshEdges.length;
          if (edgesChanged) {
            const { nodes: latestNodes } = useCanvasStore.getState();
            loadCanvas(latestNodes, freshEdges, true, useCanvasStore.getState().drawings);
          }
        }),
        cachedLoadCanvasDrawings(id, (freshDrawings) => {
          const { nodes: latestNodes, edges: latestEdges } = useCanvasStore.getState();
          loadCanvas(latestNodes, latestEdges, true, freshDrawings);
        }),
      ]);

      // Load from cache first for instant render
      if (nodesResult.cached && edgesResult.cached) {
        loadCanvas(nodesResult.cached, edgesResult.cached, false, drawingsResult.cached ?? []);
      }

      // Wait for fresh data and replay pending operations
      const [nodes, edges, drawings] = await Promise.all([nodesResult.fresh, edgesResult.fresh, drawingsResult.fresh]);
      if (!nodesResult.cached || !edgesResult.cached) {
        loadCanvas(nodes, edges, false, drawings);
      }

      // Replay any pending operations - ensures data consistency
      await replayPendingOps();

      // Load workspace meta
      getWorkspaces().then((workspaces) => {
        const ws = workspaces?.find(w => w.id === id);
        if (ws) setWorkspaceMeta(ws.name, ws.color);
      }).catch(() => {});

      // Silent mode - workspace loaded, no toast needed
    } catch (err) {
      console.error('[MobileSync] Failed to load workspace:', err);
      // Silent mode - error is logged
    }
  }, [loadCanvas, workspaceId]);

  const saveNodeToCloud = useCallback(async (node: any) => {
    try {
      if (!workspaceId) return;
      await saveNode(workspaceId, node);
      return true;
    } catch (err) {
      console.error('[MobileSync] Failed to save node:', err);
      // Silent mode - error is logged, retry happens automatically
      return false;
    }
  }, [workspaceId]);

  const saveEdgeToCloud = useCallback(async (edge: any) => {
    try {
      if (!workspaceId) return;
      await saveEdge(workspaceId, edge);
      return true;
    } catch (err) {
      console.error('[MobileSync] Failed to save edge:', err);
      // Silent mode - error is logged, retry happens automatically
      return false;
    }
  }, [workspaceId]);

  const deleteNodeFromCloud = useCallback(async (nodeId: string) => {
    try {
      if (!workspaceId) return;
      await deleteCanvasNode(workspaceId, nodeId);
      return true;
    } catch (err) {
      console.error('[MobileSync] Failed to delete node:', err);
      // Silent mode - error is logged, retry happens automatically
      return false;
    }
  }, [workspaceId]);

  const deleteEdgeFromCloud = useCallback(async (edgeId: string) => {
    try {
      if (!workspaceId) return;
      await deleteCanvasEdge(workspaceId, edgeId);
      return true;
    } catch (err) {
      console.error('[MobileSync] Failed to delete edge:', err);
      // Silent mode - error is logged, retry happens automatically
      return false;
    }
  }, [workspaceId]);

  return {
    loadWorkspaceData,
    saveNodeToCloud,
    saveEdgeToCloud,
    deleteNodeFromCloud,
    deleteEdgeFromCloud,
  };
}
