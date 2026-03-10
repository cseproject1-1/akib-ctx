import type { Node, Edge } from '@xyflow/react';
import { cacheGet, cacheSet, cacheDel, clearAllCaches, addPendingOp, getAllPendingOps, removePendingOp } from './indexedDB';
import { cacheClear } from './indexedDB';
import type { PendingOp } from './indexedDB';
import {
  loadCanvasNodes,
  loadCanvasEdges,
  saveNode as serverSaveNode,
  saveEdge as serverSaveEdge,
  deleteCanvasNode as serverDeleteNode,
  deleteCanvasEdge as serverDeleteEdge,
  updateNodePosition as serverUpdatePosition,
  updateNodeDataInDb as serverUpdateData,
  updateNodeStyle as serverUpdateStyle,
  updateEdgeDataInDb as serverUpdateEdgeData,
  getNodeCount as serverGetNodeCount,
} from '@/lib/firebase/canvasData';
import { getWorkspaces as serverGetWorkspaces } from '@/lib/firebase/workspaces';
import type { Workspace } from '@/lib/firebase/workspaces';
import { auth } from '@/lib/firebase/client';
import { toast } from 'sonner';

const SWR_TTL = 30_000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STALE_MS = 24 * 60 * 60 * 1000; // 24h

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
      if (onUpdate && JSON.stringify(merged) !== JSON.stringify(cached)) {
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
      if (onUpdate && JSON.stringify(merged) !== JSON.stringify(cached)) {
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

// ─── Workspaces ───

export async function cachedGetWorkspaces(
  onUpdate?: (ws: Workspace[]) => void
): Promise<{ cached: Workspace[] | null; fresh: Promise<Workspace[]> }> {
  const entry = await cacheGet<Workspace[]>('workspaces', 'list');
  const cached = entry?.data ?? null;

  const fresh = (async () => {
    if (entry && isFresh(entry.cachedAt)) return entry.data;
    try {
      const ws = await serverGetWorkspaces();
      await cacheSet('workspaces', 'list', ws);
      if (onUpdate && JSON.stringify(ws) !== JSON.stringify(cached)) {
        onUpdate(ws);
      }
      return ws;
    } catch {
      if (cached) return cached;
      throw new Error('Failed to load workspaces');
    }
  })();

  return { cached, fresh };
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
  addPendingOp({ ...op, id, createdAt: Date.now() }).then(() => {
    window.dispatchEvent(new Event('pending-ops-changed'));
  });

  if (!navigator.onLine) {
    toast.info('Saved locally — will sync when online', { id: 'offline-save' });
  } else {
    toast.error('Save failed — will retry', { duration: 3000, id: 'save-error' });
  }
}

export async function saveNode(workspaceId: string, node: Node) {
  const entry = await cacheGet<Node[]>('canvas-nodes', workspaceId);
  if (entry) {
    const nodes = entry.data.filter((n) => n.id !== node.id);
    nodes.push(node);
    await cacheSet('canvas-nodes', workspaceId, nodes);
  }
  try {
    await withRetry(() => serverSaveNode(workspaceId, node));
  } catch (err) {
    queueOffline({ type: 'saveNode', args: [workspaceId, node] }, err);
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
  // Update all workspace caches to remove this node immediately
  try {
    const db = await import('./indexedDB').then(m => m.cacheGet<Node[]>('canvas-nodes', ''));
    // We can't easily know the workspaceId here, so we rely on the caller's cache update
  } catch { }
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

export async function replayPendingOps() {
  // Prevent concurrent replays
  if (_replaying) return;
  _replaying = true;

  try {
    // Ensure we have a valid session before replaying
    const hasSession = await ensureSession();
    if (!hasSession) {
      console.warn('[sync] No session — skipping replay');
      return;
    }

    const ops = await getAllPendingOps();
    if (ops.length === 0) return;

    const now = Date.now();
    let purged = 0;
    let replayed = 0;

    for (const op of ops) {
      // Purge stale ops (>24h)
      if (now - op.createdAt > STALE_MS) {
        await removePendingOp(op.id);
        purged++;
        continue;
      }

      try {
        switch (op.type) {
          case 'saveNode': {
            const node = op.args[1] as Node;
            // Normalize sizing for legacy stuck ops
            if (node.style) {
              if (typeof node.style.width !== 'number') node.style.width = 300;
              if (typeof node.style.height !== 'number') node.style.height = 200;
            }
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
            // Skip invalid edge IDs — just remove from queue
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
        }
        await removePendingOp(op.id);
        replayed++;
      } catch (err: any) {
        // If it's a 400/422 (bad data), remove the op — it will never succeed
        if (err?.code === 'invalid-argument' || err?.code === '22P02' || 
            err?.message?.includes('invalid-argument') || err?.message?.includes('invalid input syntax')) {
          console.warn('[sync] Removing permanently failed op:', op.type, err?.message);
          await removePendingOp(op.id);
          purged++;
          continue;
        }
        // Network/auth error — stop replaying, try later
        if (isNetworkError(err) || isAuthError(err)) {
          console.warn('[sync] Stopping replay due to:', err?.message);
          break;
        }
        // Unknown error — remove to prevent infinite loops
        console.error('[sync] Unknown error, removing op:', op.type, err);
        await removePendingOp(op.id);
        purged++;
      }
    }

    if (purged > 0) console.log(`[sync] Purged ${purged} invalid/stale ops`);
    if (replayed > 0) {
      toast.success(`Synced ${replayed} pending change${replayed > 1 ? 's' : ''}`, { id: 'sync-success' });
    }
    if (purged > 0 || replayed > 0) {
      window.dispatchEvent(new Event('pending-ops-changed'));
    }
  } finally {
    _replaying = false;
  }
}

// ─── Cache Invalidation ───

export async function invalidateWorkspaceCache(workspaceId: string) {
  await Promise.all([
    cacheDel('canvas-nodes', workspaceId),
    cacheDel('canvas-edges', workspaceId),
    cacheDel('node-counts', workspaceId),
  ]);
}

export async function invalidateWorkspaceList() {
  await cacheDel('workspaces', 'list');
}

export { clearAllCaches };

// ─── Online listener + periodic retry ───

if (typeof window !== 'undefined') {
  // On first load, replay after a short delay to let auth initialize
  setTimeout(() => replayPendingOps(), 3000);

  window.addEventListener('online', () => {
    // Small delay to let network stabilize
    setTimeout(() => replayPendingOps(), 2000);
  });

  setInterval(() => {
    if (navigator.onLine) {
      replayPendingOps();
    }
  }, 30_000);
}
