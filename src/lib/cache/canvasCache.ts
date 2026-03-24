import type { Node, Edge } from '@xyflow/react';
import { cacheGet, cacheSet, cacheDel, clearAllCaches, addPendingOp, getAllPendingOps, removePendingOp } from './indexedDB';
import { cacheClear } from './indexedDB';
import type { PendingOp } from './indexedDB';
import type { DrawingOverlay } from '@/types/canvas';
import {
  loadCanvasNodes,
  loadCanvasEdges,
  loadCanvasDrawings,
  saveNode as serverSaveNode,
  saveEdge as serverSaveEdge,
  saveDrawing as serverSaveDrawing,
  deleteDrawingFromDb as serverDeleteDrawing,
  deleteCanvasNode as serverDeleteNode,
  deleteCanvasEdge as serverDeleteEdge,
  updateNodePosition as serverUpdatePosition,
  updateNodeDataInDb as serverUpdateData,
  updateNodeStyle as serverUpdateStyle,
  updateEdgeDataInDb as serverUpdateEdgeData,
  getNodeCount as serverGetNodeCount,
} from '@/lib/firebase/canvasData';
import { updateUserSettings as serverUpdateSettings } from '@/lib/firebase/settings';
import type { UserSettings } from '@/lib/firebase/settings';
import { getWorkspaces as serverGetWorkspaces } from '@/lib/firebase/workspaces';
import type { Workspace } from '@/lib/firebase/workspaces';
import { auth } from '@/lib/firebase/client';
import { toast } from 'sonner';

const SWR_TTL = 30_000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STALE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const MAX_RETRY_INTERVAL = 60_000; // 1m
let _retryDelay = 5000;

function isFresh(cachedAt: number) {
  return Date.now() - cachedAt < SWR_TTL;
}

function isValidUUID(id: string): boolean {
  return UUID_RE.test(id);
}

// ─── Pending Ops Merge ───

async function applyPendingOpsToNodes(nodes: Node[], workspaceId: string): Promise<Node[]> {
  const ops = await getAllPendingOps();
  if (ops.length === 0) return nodes;

  let result = [...nodes];
  const existingIds = new Set(nodes.map(n => n.id));

  for (const op of ops) {
    switch (op.type) {
      case 'saveNode': {
        const opWsId = op.args[0] as string;
        const opNode = op.args[1] as Node;
        if (opWsId !== workspaceId) continue;
        const idx = result.findIndex(n => n.id === opNode.id);
        if (idx >= 0) {
          // Update existing node with pending changes
          result[idx] = opNode;
        } else if (!existingIds.has(opNode.id)) {
          // Add new node that was created while offline
          result.push(opNode);
          existingIds.add(opNode.id);
        }
        break;
      }
      case 'deleteNode': {
        // BUG FIX: renamed destructured vars to avoid shadowing outer `workspaceId`
        const [opDelWsId, nodeId] = op.args as [string, string];
        if (opDelWsId !== workspaceId) continue;
        result = result.filter(n => n.id !== nodeId);
        break;
      }
      case 'updatePosition': {
        const [wsId, nodeId, x, y] = op.args as [string, string, number, number];
        if (wsId !== workspaceId) continue;
        const node = result.find(n => n.id === nodeId);
        if (node) node.position = { x, y };
        break;
      }
      case 'updateData': {
        const [wsId, nodeId, data] = op.args as [string, string, Record<string, unknown>];
        if (wsId !== workspaceId) continue;
        const node = result.find(n => n.id === nodeId);
        if (node) node.data = { ...node.data, ...data };
        break;
      }
      case 'updateStyle': {
        const [wsId, nodeId, width, height, zIndex] = op.args as [string, string, number, number, number];
        if (wsId !== workspaceId) continue;
        const node = result.find(n => n.id === nodeId);
        if (node) node.style = { ...node.style, width, height, zIndex };
        break;
      }
    }
  }

  return result;
}

async function applyPendingOpsToEdges(edges: Edge[], workspaceId: string): Promise<Edge[]> {
  const ops = await getAllPendingOps();
  if (ops.length === 0) return edges;

  let result = [...edges];

  const existingEdgeIds = new Set(edges.map(e => e.id));
  for (const op of ops) {
    switch (op.type) {
      case 'saveEdge': {
        const opWsId = op.args[0] as string;
        const opEdge = op.args[1] as Edge;
        if (opWsId !== workspaceId) continue;
        const idx = result.findIndex(e => e.id === opEdge.id);
        if (idx >= 0) {
          result[idx] = opEdge;
        } else if (!existingEdgeIds.has(opEdge.id)) {
          // Add new edge created while offline
          result.push(opEdge);
          existingEdgeIds.add(opEdge.id);
        }
        break;
      }
      case 'deleteEdge': {
        const [opDelEdgeWsId, edgeId] = op.args as [string, string];
        if (opDelEdgeWsId !== workspaceId) continue;
        result = result.filter(e => e.id !== edgeId);
        break;
      }
      case 'updateEdgeData': {
        const [wsId, edgeId, data, label] = op.args as [string, string, Record<string, unknown>, string | undefined];
        if (wsId !== workspaceId) continue;
        const edge = result.find(e => e.id === edgeId);
        if (edge) {
          edge.data = { ...edge.data, ...data };
          if (label !== undefined) edge.label = label;
        }
        break;
      }
    }
  }

  return result;
}

/**
 * Validates that an operation still makes sense to perform.
 * e.g. don't try to update a node that has a pending delete operation.
 */
async function validateAndFilterOps(ops: PendingOp[]): Promise<PendingOp[]> {
  const deletedNodeIds = new Map<string, Set<string>>(); // workspaceId -> Set<nodeId>
  const deletedEdgeIds = new Map<string, Set<string>>(); // workspaceId -> Set<edgeId>
  
  // First pass: identify all deletions
  for (const op of ops) {
    if (op.type === 'deleteNode') {
      const [wsId, nodeId] = op.args as [string, string];
      if (!deletedNodeIds.has(wsId)) deletedNodeIds.set(wsId, new Set());
      deletedNodeIds.get(wsId)!.add(nodeId);
    }
    if (op.type === 'deleteEdge') {
      const [wsId, edgeId] = op.args as [string, string];
      if (!deletedEdgeIds.has(wsId)) deletedEdgeIds.set(wsId, new Set());
      deletedEdgeIds.get(wsId)!.add(edgeId);
    }
  }

  // Second pass: filter out ops on deleted items
  return ops.filter(op => {
    const args = op.args;
    const wsId = args[0] as string;
    
    switch (op.type) {
      case 'saveNode':
      case 'updatePosition':
      case 'updateData':
      case 'updateStyle': {
        const nodeId = (op.type === 'saveNode' ? (args[1] as Node).id : args[1]) as string;
        return !deletedNodeIds.get(wsId)?.has(nodeId);
      }
      case 'saveEdge':
      case 'updateEdgeData': {
        const edge = op.type === 'saveEdge' ? (args[1] as Edge) : null;
        const edgeId = edge ? edge.id : (args[1] as string);
        if (deletedEdgeIds.get(wsId)?.has(edgeId)) return false;
        
        // If node is deleted, edge is orphaned
        if (edge && (deletedNodeIds.get(wsId)?.has(edge.source) || deletedNodeIds.get(wsId)?.has(edge.target))) return false;
        return true;
      }
      default:
        return true;
    }
  });
}

// ─── Canvas Nodes ───

export async function cachedLoadCanvasNodes(
  workspaceId: string,
  onUpdate?: (nodes: Node[]) => void
): Promise<{ cached: Node[] | null; fresh: Promise<Node[]> }> {
  const entry = await cacheGet<Node[]>('canvas-nodes', workspaceId);
  const rawCached = entry?.data ?? null;
  const cached = rawCached ? await applyPendingOpsToNodes(rawCached, workspaceId) : null;

  const fresh = (async () => {
    // Always fetch from server; the 'fresh' promise is used for background update
    try {
      const nodes = await loadCanvasNodes(workspaceId);
      await cacheSet('canvas-nodes', workspaceId, nodes);
      const merged = await applyPendingOpsToNodes(nodes, workspaceId);
      
      const isChanged = !cached || 
        merged.length !== cached.length || 
        JSON.stringify(merged) !== JSON.stringify(cached);

      if (onUpdate && isChanged) {
        onUpdate(merged);
      }
      return merged;
    } catch {
      if (cached) return cached;
      throw new Error('Failed to load nodes');
    }
  })();

  return { cached, fresh };
}

// ─── Canvas Edges ───

export async function cachedLoadCanvasEdges(
  workspaceId: string,
  onUpdate?: (edges: Edge[]) => void
): Promise<{ cached: Edge[] | null; fresh: Promise<Edge[]> }> {
  const entry = await cacheGet<Edge[]>('canvas-edges', workspaceId);
  const rawCached = entry?.data ?? null;
  const cached = rawCached ? await applyPendingOpsToEdges(rawCached, workspaceId) : null;

  const fresh = (async () => {
    // Always fetch from server; the 'fresh' promise is used for background update
    try {
      const edges = await loadCanvasEdges(workspaceId);
      await cacheSet('canvas-edges', workspaceId, edges);
      const merged = await applyPendingOpsToEdges(edges, workspaceId);
      
      const isChanged = !cached || 
        merged.length !== cached.length || 
        JSON.stringify(merged) !== JSON.stringify(cached);

      if (onUpdate && isChanged) {
        onUpdate(merged);
      }
      return merged;
    } catch {
      if (cached) return cached;
      throw new Error('Failed to load edges');
    }
  })();

  return { cached, fresh };
}

// ─── Canvas Drawings ───

export async function cachedLoadCanvasDrawings(
  workspaceId: string,
  onUpdate?: (drawings: DrawingOverlay[]) => void
): Promise<{ cached: DrawingOverlay[] | null; fresh: Promise<DrawingOverlay[]> }> {
  const entry = await cacheGet<DrawingOverlay[]>('canvas-drawings', workspaceId);
  const cached = entry?.data ?? null;

  const fresh = (async () => {
    try {
      const drawings = await loadCanvasDrawings(workspaceId);
      await cacheSet('canvas-drawings', workspaceId, drawings);

      const isChanged = !cached ||
        drawings.length !== cached.length ||
        JSON.stringify(drawings) !== JSON.stringify(cached);

      if (onUpdate && isChanged) {
        onUpdate(drawings);
      }
      return drawings;
    } catch (err) {
      console.warn('[sync] Failed to load drawings from server, using cache:', err);
      if (cached) return cached;
      // Don't throw — drawings are non-essential, don't block canvas load
      return [];
    }
  })();

  return { cached, fresh };
}

export async function saveDrawing(workspaceId: string, drawing: DrawingOverlay) {
  // Update IndexedDB cache
  const entry = await cacheGet<DrawingOverlay[]>('canvas-drawings', workspaceId);
  const drawings = entry?.data ?? [];
  const idx = drawings.findIndex(d => d.id === drawing.id);
  if (idx >= 0) {
    drawings[idx] = drawing;
  } else {
    drawings.push(drawing);
  }
  await cacheSet('canvas-drawings', workspaceId, drawings);

  // Save to server
  try {
    await serverSaveDrawing(workspaceId, drawing);
  } catch (err) {
    queueOffline({ type: 'saveDrawing', args: [workspaceId, drawing] }, err as Error);
  }
}

export async function deleteDrawing(workspaceId: string, drawingId: string) {
  // Update IndexedDB cache
  const entry = await cacheGet<DrawingOverlay[]>('canvas-drawings', workspaceId);
  if (entry) {
    const drawings = entry.data.filter(d => d.id !== drawingId);
    await cacheSet('canvas-drawings', workspaceId, drawings);
  }

  // Delete from server
  try {
    await serverDeleteDrawing(workspaceId, drawingId);
  } catch (err) {
    queueOffline({ type: 'deleteDrawing', args: [workspaceId, drawingId] }, err as Error);
  }
}

// ─── Workspaces ───

export async function cachedGetWorkspaces(
  onUpdate?: (ws: Workspace[]) => void,
  options: { excludeVault?: boolean } = {}
): Promise<{ cached: Workspace[] | null; fresh: Promise<Workspace[]> }> {
  const { excludeVault = false } = options;
  const entry = await cacheGet<Workspace[]>('workspaces', 'list');
  const cached = entry?.data ?? null;

  const fresh = (async () => {
    if (entry && isFresh(entry.cachedAt)) return entry.data;
    try {
      const ws = await serverGetWorkspaces();
      await cacheSet('workspaces', 'list', ws);
      // Apply filtering for onUpdate and fresh return
      const filteredWs = excludeVault ? ws.filter(w => !w.is_in_vault) : ws;
      if (onUpdate) {
        const isChanged = !cached || filteredWs.length !== cached.length || filteredWs.some((w, i) => w.id !== cached[i].id || w.updated_at !== cached[i].updated_at);
        if (isChanged) {
          onUpdate(filteredWs);
        }
      }
      return filteredWs;
    } catch {
      if (cached) {
        const filteredCached = excludeVault ? cached.filter(w => !w.is_in_vault) : cached;
        if (onUpdate) {
          onUpdate(filteredCached);
        }
        return filteredCached;
      }
      throw new Error('Failed to load workspaces');
    }
  })();

  // Return filtered cached and fresh
  return {
    cached: excludeVault ? (cached?.filter(w => !w.is_in_vault) ?? null) : cached,
    fresh
  };
}

// ─── Node Counts ───

export async function cachedGetNodeCount(workspaceId: string): Promise<number> {
  const entry = await cacheGet<number>('node-counts', workspaceId);
  if (entry && isFresh(entry.cachedAt)) return entry.data;
  try {
    const count = await serverGetNodeCount(workspaceId);
    await cacheSet('node-counts', workspaceId, count);
    return count;
  } catch {
    return entry?.data ?? 0;
  }
}

// ─── Auth-aware Retry Helper ───

async function ensureSession(): Promise<boolean> {
  try {
    const user = auth.currentUser;
    if (!user) return false;
    await user.getIdToken(true); // force refresh
    return true;
  } catch {
    return false;
  }
}

function isAuthError(err: any): boolean {
  const msg = String(err?.message || '').toLowerCase();
  const code = String(err?.code || '').toLowerCase();
  return msg.includes('jwt') || msg.includes('not authenticated') ||
    msg.includes('unauthenticated') || msg.includes('permission-denied') ||
    code === '401' || code === '403' || code === 'permission-denied' || 
    code === 'unauthenticated' || code.includes('auth/');
}

function isNetworkError(err: any): boolean {
  const code = String(err?.code || '');
  const msg = String(err?.message || '');
  return !navigator.onLine || 
         msg.includes('Failed to fetch') || 
         err?.name === 'TypeError' ||
         code === 'unavailable' || 
         code === 'deadline-exceeded' || 
         code === 'cancelled' ||
         msg.includes('network') ||
         msg.includes('channel') ||
         msg.includes('Failed to get document');
}

async function withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err: any) {
      lastErr = err;
      console.warn(`[sync] Retry ${i + 1}/${attempts}:`, err?.message || err);

      if (isAuthError(err)) {
        const refreshed = await ensureSession();
        if (!refreshed && i === attempts - 1) throw err;
      }

      if (i === attempts - 1) throw err;
      await new Promise(r => setTimeout(r, Math.pow(2, i) * 500));
    }
  }
  throw lastErr;
}

// ─── Write-through wrappers ───

function queueOffline(op: Omit<PendingOp, 'id' | 'createdAt'>, error?: unknown) {
  const errMsg = error instanceof Error ? error.message : String(error);
  console.error('[sync] Queuing offline:', op.type, errMsg);
  const id = crypto.randomUUID();
  const opWithMeta = { ...op, id, createdAt: Date.now() };
  // Deep clone args to avoid capturing mutable references from Zustand store
  if (Array.isArray(opWithMeta.args)) {
    opWithMeta.args = structuredClone(opWithMeta.args);
  }
  addPendingOp(opWithMeta).then(() => {
    window.dispatchEvent(new Event('pending-ops-changed'));
  }).catch((err) => {
    console.error('[sync] CRITICAL: Failed to queue pending op:', err);
    toast.error('Failed to save change locally', { duration: 5000 });
  });

  if (!navigator.onLine) {
    toast.info('Saved locally — will sync when online', { id: `offline-save-${id}` });
  } else {
    toast.error('Save failed — will retry', { duration: 3000, id: `save-error-${id}` });
  }
}

export async function saveNode(workspaceId: string, node: Node) {
  // Ensure updatedAt is set when saving
  const now = new Date().toISOString();
  const nodeWithDates: Node = {
    ...node,
    data: {
      ...(node.data as any),
      createdAt: (node.data as any)?.createdAt || now,
      updatedAt: now,
      lastSyncedAt: now,
    },
  };

  const entry = await cacheGet<Node[]>('canvas-nodes', workspaceId);
  if (entry) {
    const nodes = entry.data.filter((n) => n.id !== nodeWithDates.id);
    nodes.push(nodeWithDates);
    await cacheSet('canvas-nodes', workspaceId, nodes);
  }
  try {
    await withRetry(() => serverSaveNode(workspaceId, nodeWithDates));
  } catch (err) {
    queueOffline({ type: 'saveNode', args: [workspaceId, nodeWithDates] }, err);
  }
}

export async function saveEdge(workspaceId: string, edge: Edge) {
  // Always ensure edge has a valid UUID
  const fixedEdge = isValidUUID(edge.id) ? edge : { ...edge, id: crypto.randomUUID() };
  const entry = await cacheGet<Edge[]>('canvas-edges', workspaceId);
  if (entry) {
    const edges = entry.data.filter((e) => e.id !== fixedEdge.id);
    edges.push(fixedEdge);
    await cacheSet('canvas-edges', workspaceId, edges);
  }
  try {
    await withRetry(() => serverSaveEdge(workspaceId, fixedEdge));
  } catch (err) {
    queueOffline({ type: 'saveEdge', args: [workspaceId, fixedEdge] }, err);
  }
}

export async function deleteCanvasNode(workspaceId: string, nodeId: string) {
  // Update local cache immediately so deletes survive refresh
  const entry = await cacheGet<Node[]>('canvas-nodes', workspaceId);
  if (entry) {
    const nodes = entry.data.filter((n) => n.id !== nodeId);
    await cacheSet('canvas-nodes', workspaceId, nodes);
  }
  try {
    await withRetry(() => serverDeleteNode(workspaceId, nodeId));
  } catch (err) {
    queueOffline({ type: 'deleteNode', args: [workspaceId, nodeId] }, err);
  }
}

export async function deleteCanvasEdge(workspaceId: string, edgeId: string) {
  // Skip non-UUID edge IDs — they were never persisted
  if (!isValidUUID(edgeId)) {
    console.warn('[sync] Skipping delete for non-UUID edge:', edgeId);
    return;
  }
  // Update local cache immediately (matching deleteCanvasNode pattern)
  const entry = await cacheGet<Edge[]>('canvas-edges', workspaceId);
  if (entry) {
    const edges = entry.data.filter((e) => e.id !== edgeId);
    await cacheSet('canvas-edges', workspaceId, edges);
  }
  try {
    await withRetry(() => serverDeleteEdge(workspaceId, edgeId));
  } catch (err) {
    queueOffline({ type: 'deleteEdge', args: [workspaceId, edgeId] }, err);
  }
}

export async function updateNodePosition(workspaceId: string, nodeId: string, x: number, y: number) {
  try {
    await withRetry(() => serverUpdatePosition(workspaceId, nodeId, x, y));
  } catch (err) {
    queueOffline({ type: 'updatePosition', args: [workspaceId, nodeId, x, y] }, err);
  }
}

export async function updateNodeDataInDb(workspaceId: string, nodeId: string, data: Record<string, unknown>) {
  try {
    await withRetry(() => serverUpdateData(workspaceId, nodeId, data));
  } catch (err) {
    queueOffline({ type: 'updateData', args: [workspaceId, nodeId, data] }, err);
  }
}

export async function updateNodeStyle(workspaceId: string, nodeId: string, width: number, height: number, zIndex: number) {
  try {
    await withRetry(() => serverUpdateStyle(workspaceId, nodeId, width, height, zIndex));
  } catch (err) {
    queueOffline({ type: 'updateStyle', args: [workspaceId, nodeId, width, height, zIndex] }, err);
  }
}

export async function updateEdgeDataInDb(workspaceId: string, edgeId: string, data: Record<string, unknown>, label?: string) {
  // Skip non-UUID edge IDs
  if (!isValidUUID(edgeId)) return;
  try {
    await withRetry(() => serverUpdateEdgeData(workspaceId, edgeId, data, label));
  } catch (err) {
    queueOffline({ type: 'updateEdgeData', args: [workspaceId, edgeId, data, label] }, err);
  }
}

// ─── Offline Queue Replay ───

export async function clearPendingOps() {
  await cacheClear('pending-ops');
  console.log('[sync] Cleared all pending operations');
}

let _replaying = false;
let _replayGeneration = 0;

export async function replayPendingOps(isRetry = false) {
  // Prevent concurrent replays
  if (_replaying) return;
  _replaying = true;
  const myGeneration = ++_replayGeneration;

  // Safety timeout to reset _replaying if it gets stuck (e.g. extremely long wait)
  const safetyTimeout = setTimeout(() => {
    if (_replaying) {
      console.warn('[sync] Replay safety timeout reached - resetting flag');
      _replaying = false;
    }
  }, 60000); // 60s max per replay attempt

  try {
    const hasSession = await ensureSession();
    if (!hasSession) {
      console.warn('[sync] No session — skipping replay');
      return;
    }

    let ops = await getAllPendingOps();
    if (ops.length === 0) {
      _retryDelay = 5000; // reset delay
      return;
    }

    // Filter out conflicting/orphaned ops
    ops = await validateAndFilterOps(ops);
    
    const now = Date.now();
    let purged = 0;
    let replayed = 0;

    for (const op of ops) {
      // Abort if sync manager was stopped during replay
      if (myGeneration !== _replayGeneration) return;
      // Purge stale ops (>30 days)
      if (now - op.createdAt > STALE_MS) {
        await removePendingOp(op.id);
        purged++;
        toast.warning('An old unsynced change was removed (>30 days)', { id: `stale-purge-${op.id}` });
        continue;
      }

      // Conflict Resolution: Removed aggressive purging based on cache timestamp to prevent data loss.
      // Replay should attempt all valid pending ops unless they are explicitly stale (>24h).

      try {
        switch (op.type) {
          case 'saveNode': {
            const node = op.args[1] as Node;
            if (node.style) {
              if (typeof node.style.width !== 'number') node.style.width = 300;
              if (typeof node.style.height !== 'number') node.style.height = 200;
            }
            // Ensure createdAt is preserved, update updatedAt and lastSyncedAt
            const now = new Date().toISOString();
            const nodeData = node.data as any;
            if (nodeData && !nodeData.createdAt) {
              nodeData.createdAt = now;
            }
            nodeData.updatedAt = now;
            nodeData.lastSyncedAt = now;
            await serverSaveNode(op.args[0] as string, node);
            break;
          }
          case 'saveEdge': {
            const edge = op.args[1] as Edge;
            const fixedEdge = isValidUUID(edge.id) ? edge : { ...edge, id: crypto.randomUUID() };
            await serverSaveEdge(op.args[0] as string, fixedEdge);
            break;
          }
          case 'deleteNode':
            await serverDeleteNode(op.args[0] as string, op.args[1] as string);
            break;
          case 'deleteEdge': {
            const delWsId = op.args[0] as string;
            const delEdgeId = op.args[1] as string;
            if (!isValidUUID(delEdgeId)) {
              await removePendingOp(op.id);
              purged++;
              continue;
            }
            await serverDeleteEdge(delWsId, delEdgeId);
            break;
          }
          case 'updatePosition':
            await serverUpdatePosition(op.args[0] as string, op.args[1] as string, op.args[2] as number, op.args[3] as number);
            break;
          case 'updateData':
            await serverUpdateData(op.args[0] as string, op.args[1] as string, op.args[2] as Record<string, unknown>);
            break;
          case 'updateStyle': {
            const w = typeof op.args[2] === 'number' ? op.args[2] : 300;
            const h = typeof op.args[3] === 'number' ? op.args[3] : 200;
            await serverUpdateStyle(op.args[0] as string, op.args[1] as string, w, h, op.args[4] as number);
            break;
          }
          case 'updateEdgeData': {
            const wsId = op.args[0] as string;
            const eId = op.args[1] as string;
            if (!isValidUUID(eId)) {
              await removePendingOp(op.id);
              purged++;
              continue;
            }
            await serverUpdateEdgeData(wsId, eId, op.args[2] as Record<string, unknown>, op.args[3] as string | undefined);
            break;
          }
          case 'updateSettings': {
            await serverUpdateSettings(op.args[0] as Partial<UserSettings>);
            break;
          }
          case 'saveDrawing': {
            await serverSaveDrawing(op.args[0] as string, op.args[1] as DrawingOverlay);
            break;
          }
          case 'deleteDrawing': {
            await serverDeleteDrawing(op.args[0] as string, op.args[1] as string);
            break;
          }
        }
        await removePendingOp(op.id);
        replayed++;
        _retryDelay = 5000; // success, reset delay
      } catch (err: any) {
        if (err?.code === 'invalid-argument' || err?.code === '22P02' ||
            err?.message?.includes('invalid-argument') || err?.message?.includes('invalid input syntax')) {
          console.warn('[sync] Removing permanently failed op:', op.type, err?.message);
          await removePendingOp(op.id);
          purged++;
          toast.warning('A change could not be saved and was removed', { id: `perm-fail-${op.id}` });
          continue;
        }

        if (isNetworkError(err) || isAuthError(err)) {
          console.warn('[sync] Stopping replay due to network/auth error');
          // Start/Increase exponential backoff
          _retryDelay = Math.min(_retryDelay * 1.5, MAX_RETRY_INTERVAL);
          break;
        }

        // Transient server errors: keep op for retry instead of permanently removing
        if (err?.code === 'internal' || err?.code === 'unavailable' || 
            err?.code === 'deadline-exceeded' || err?.code === 'aborted' ||
            err?.code === 'resource-exhausted') {
          console.warn('[sync] Transient server error, keeping op for retry:', op.type, err?.code);
          _retryDelay = Math.min(_retryDelay * 1.5, MAX_RETRY_INTERVAL);
          break;
        }

        console.error('[sync] Unknown error, removing op:', op.type, err);
        await removePendingOp(op.id);
        purged++;
        toast.warning('A change could not be saved and was removed', { id: `unknown-fail-${op.id}` });
      }
    }

    if (purged > 0) console.log(`[sync] Purged ${purged} invalid/stale/conflicting ops`);
    if (replayed > 0) {
      toast.success(`Synced ${replayed} pending change${replayed > 1 ? 's' : ''}`, { id: 'sync-success' });
    }
    if (purged > 0 || replayed > 0) {
      window.dispatchEvent(new Event('pending-ops-changed'));
    }
  } catch (err) {
    console.error('[sync] Replay failed with unexpected error:', err);
  } finally {
    clearTimeout(safetyTimeout);
    _replaying = false;
  }
}

// ─── Cache Invalidation ───

export async function invalidateWorkspaceCache(workspaceId: string) {
  await Promise.all([
    cacheDel('canvas-nodes', workspaceId),
    cacheDel('canvas-edges', workspaceId),
    cacheDel('canvas-drawings', workspaceId),
    cacheDel('node-counts', workspaceId),
  ]);
}

export async function invalidateWorkspaceList() {
  await cacheDel('workspaces', 'list');
}

export { clearAllCaches };

// ─── Online listener + periodic retry ───

let _syncTimeout: any = null;
let _onlineHandler: (() => void) | null = null;
let _offlineHandler: (() => void) | null = null;
let _startupTimeout: any = null;

function scheduleReplay(delay: number) {
  if (_syncTimeout) clearTimeout(_syncTimeout);
  if (!navigator.onLine) return;
  _syncTimeout = setTimeout(async () => {
    if (navigator.onLine && !_replaying) {
      await replayPendingOps();
    }
    // Schedule next run with current delay, ensures periodic sync even if one attempt fails
    scheduleReplay(_retryDelay);
  }, delay);
}

/**
 * Starts the global synchronization manager that replays pending operations
 * when online and periodically as a fallback.
 */
export function startSyncManager() {
  if (typeof window === 'undefined') return;
  if (_syncTimeout || _startupTimeout) return; // Already running

  // On first load, replay after a short delay to let auth initialize
  _startupTimeout = setTimeout(() => {
    replayPendingOps();
    _startupTimeout = null;
    // Start periodic sync after initial run
    scheduleReplay(_retryDelay);
  }, 3000);

  _onlineHandler = () => {
    // Small delay to let network stabilize
    setTimeout(() => replayPendingOps(), 2000);
  };
  window.addEventListener('online', _onlineHandler);

  _offlineHandler = () => {
    if (_syncTimeout) {
      clearTimeout(_syncTimeout);
      _syncTimeout = null;
    }
  };
  window.addEventListener('offline', _offlineHandler);
}

/**
 * Stops the global synchronization manager and cleans up listeners.
 */
export function stopSyncManager() {
  if (_syncTimeout) {
    clearTimeout(_syncTimeout);
    _syncTimeout = null;
  }
  if (_startupTimeout) {
    clearTimeout(_startupTimeout);
    _startupTimeout = null;
  }
  if (_onlineHandler) {
    window.removeEventListener('online', _onlineHandler);
    _onlineHandler = null;
  }
  if (_offlineHandler) {
    window.removeEventListener('offline', _offlineHandler);
    _offlineHandler = null;
  }
  // Clear any active replay
  _replayGeneration++; // Invalidate any running replay loop
  _replaying = false;
  _retryDelay = 5000;
}
