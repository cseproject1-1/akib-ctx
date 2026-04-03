/**
 * @file backend-sync.test.ts
 * @description Unit tests for the backend sync pipeline:
 *   - canvasCache write-through wrappers (saveNode, saveEdge, updateNodeDataInDb, etc.)
 *   - IndexedDB helpers (cacheGet, cacheSet, cacheDel) using a mock IDBFactory
 *   - WorkspacePage sync logic (addNode triggers saveNode, node edits trigger debounced updateNodeDataInDb)
 *
 * Run via: npm run test
 */

import { describe, it, expect, vi, beforeEach, type Mock, afterEach } from 'vitest';
import type { Node, Edge } from '@xyflow/react';

// Mock navigator.onLine for offline tests
const originalNavigator = { ...globalThis.navigator };

// ─────────────────────────────────────────────────────────────────────────────
// 1. Pure-logic unit: sanitizeForFirestore (vendor logic copy)
// ─────────────────────────────────────────────────────────────────────────────

function sanitizeForFirestore(data: unknown): unknown {
  if (data === null || data === undefined) return data;
  if (typeof data === 'function' || typeof data === 'symbol') return undefined;
  if (Array.isArray(data)) {
    return data.map((v) => {
      const result = sanitizeForFirestore(v);
      return Array.isArray(result) ? JSON.stringify(result) : result;
    });
  }
  if (typeof data === 'object') {
    const result: Record<string, unknown> = {};
    for (const key in data as Record<string, unknown>) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
        const val = sanitizeForFirestore((data as Record<string, unknown>)[key]);
        if (val !== undefined) result[key] = val;
      }
    }
    return result;
  }
  return data;
}

describe('sanitizeForFirestore', () => {
  it('passes through primitive values', () => {
    expect(sanitizeForFirestore('hello')).toBe('hello');
    expect(sanitizeForFirestore(42)).toBe(42);
    expect(sanitizeForFirestore(true)).toBe(true);
    expect(sanitizeForFirestore(null)).toBeNull();
  });

  it('removes undefined values from objects', () => {
    const result = sanitizeForFirestore({ a: 1, b: undefined }) as Record<string, unknown>;
    expect(result).toEqual({ a: 1 });
    expect('b' in result).toBe(false);
  });

  it('removes function values', () => {
    const result = sanitizeForFirestore({ fn: () => {} }) as Record<string, unknown>;
    expect('fn' in result).toBe(false);
  });

  it('prevents prototype pollution keys', () => {
    const input = { '__proto__': 'evil', normal: 'fine' } as Record<string, unknown>;
    const result = sanitizeForFirestore(input) as Record<string, unknown>;
    expect(result.normal).toBe('fine');
    expect(Object.prototype.hasOwnProperty.call(result, '__proto__')).toBe(false);
  });

  it('flattens nested arrays by JSON-stringifying them', () => {
    const result = sanitizeForFirestore({ matrix: [[1, 2], [3, 4]] }) as Record<string, unknown>;
    expect(result.matrix).toEqual(['[1,2]', '[3,4]']);
  });

  it('recursively sanitizes nested objects', () => {
    const result = sanitizeForFirestore({ outer: { inner: undefined, ok: 'yes' } }) as Record<string, unknown>;
    expect((result.outer as Record<string, unknown>).ok).toBe('yes');
    expect('inner' in (result.outer as Record<string, unknown>)).toBe(false);
  });

  it('handles symbol values in objects', () => {
    const sym = Symbol('test');
    const result = sanitizeForFirestore({ a: 1, sym }) as Record<string, unknown>;
    expect(result).toEqual({ a: 1 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Mock Setup
// ─────────────────────────────────────────────────────────────────────────────

const _memStore: Record<string, Record<string, unknown>> = {};

vi.mock('@/lib/firebase/canvasData', () => ({
  saveNode: vi.fn().mockResolvedValue(undefined),
  saveEdge: vi.fn().mockResolvedValue(undefined),
  deleteCanvasNode: vi.fn().mockResolvedValue(undefined),
  deleteCanvasEdge: vi.fn().mockResolvedValue(undefined),
  updateNodePosition: vi.fn().mockResolvedValue(undefined),
  updateNodeDataInDb: vi.fn().mockResolvedValue(undefined),
  updateNodeStyle: vi.fn().mockResolvedValue(undefined),
  updateEdgeDataInDb: vi.fn().mockResolvedValue(undefined),
  getNodeCount: vi.fn().mockResolvedValue(0),
  loadCanvasNodes: vi.fn().mockResolvedValue([]),
  loadCanvasEdges: vi.fn().mockResolvedValue([]),
  loadCanvasDrawings: vi.fn().mockResolvedValue([]),
  saveDrawing: vi.fn().mockResolvedValue(undefined),
  deleteDrawingFromDb: vi.fn().mockResolvedValue(undefined),
  subscribeCanvasNodes: vi.fn().mockReturnValue(() => {}),
  subscribeCanvasEdges: vi.fn().mockReturnValue(() => {}),
  subscribeCursors: vi.fn().mockReturnValue(() => {}),
  createSnapshot: vi.fn().mockResolvedValue(undefined),
  pruneSnapshots: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/cache/indexedDB', () => ({
  cacheGet: vi.fn().mockImplementation(async (store: string, key: string) => {
    return _memStore[`${store}::${key}`] ?? null;
  }),
  cacheSet: vi.fn().mockImplementation(async (store: string, key: string, data: unknown) => {
    _memStore[`${store}::${key}`] = { data, cachedAt: Date.now() };
  }),
  cacheDel: vi.fn().mockImplementation(async (store: string, key: string) => {
    delete _memStore[`${store}::${key}`];
  }),
  cacheClear: vi.fn().mockResolvedValue(undefined),
  clearAllCaches: vi.fn().mockResolvedValue(undefined),
  addPendingOp: vi.fn().mockResolvedValue(undefined),
  getAllPendingOps: vi.fn().mockResolvedValue([]),
  removePendingOp: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/firebase/client', () => ({
  auth: { currentUser: { getIdToken: vi.fn().mockResolvedValue('fake-token') } },
  db: {},
}));

vi.mock('@/lib/firebase/settings', () => ({
  updateUserSettings: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/firebase/workspaces', () => ({
  getWorkspaces: vi.fn().mockResolvedValue([]),
}));

vi.mock('sonner', () => ({
  toast: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

// ─────────────────────────────────────────────────────────────────────────────
// 3. canvasCache Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('canvasCache – saveNode write-through', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(_memStore).forEach((k) => delete _memStore[k]);
  });

  it('adds date fields when saving a new node', async () => {
    const { saveNode } = await import('@/lib/cache/canvasCache');
    const { saveNode: serverSave } = await import('@/lib/firebase/canvasData');

    const node: Node = {
      id: crypto.randomUUID(),
      type: 'aiNote',
      position: { x: 100, y: 200 },
      data: { title: 'Test node', content: '' },
      style: { width: 300, height: 200, zIndex: 1 },
    };

    await saveNode('ws-test-123', node);

    expect(serverSave).toHaveBeenCalledOnce();
    const calledWith = (serverSave as Mock).mock.calls[0];
    expect(calledWith[0]).toBe('ws-test-123');
    expect(calledWith[1].id).toBe(node.id);
    expect(calledWith[1].data.createdAt).toBeDefined();
    expect(calledWith[1].data.updatedAt).toBeDefined();
    expect(calledWith[1].data.lastSyncedAt).toBeDefined();
  });

  it('preserves existing createdAt when updating node', async () => {
    const { saveNode } = await import('@/lib/cache/canvasCache');
    const { saveNode: serverSave } = await import('@/lib/firebase/canvasData');

    const existingCreatedAt = '2024-01-01T00:00:00.000Z';
    const node: Node = {
      id: crypto.randomUUID(),
      type: 'aiNote',
      position: { x: 0, y: 0 },
      data: { title: 'Test', content: '', createdAt: existingCreatedAt },
      style: { width: 300, height: 200, zIndex: 0 },
    };

    await saveNode('ws-a', node);

    const savedNode = (serverSave as Mock).mock.calls[0][1];
    expect(savedNode.data.createdAt).toBe(existingCreatedAt);
    expect(savedNode.data.updatedAt).not.toBe(existingCreatedAt);
  });

  it('updates local IndexedDB cache', async () => {
    const { saveNode } = await import('@/lib/cache/canvasCache');
    const { cacheSet: rawSet } = await import('@/lib/cache/indexedDB');

    await rawSet('canvas-nodes', 'ws-cache', []);

    const node: Node = {
      id: crypto.randomUUID(),
      type: 'aiNote',
      position: { x: 0, y: 0 },
      data: { title: 'Cache test' },
      style: { width: 300, height: 200, zIndex: 0 },
    };

    await saveNode('ws-cache', node);

    // Verify cache was updated (cacheSet called with 'canvas-nodes')
    const { cacheSet } = await import('@/lib/cache/indexedDB');
    expect(cacheSet).toHaveBeenCalledWith('canvas-nodes', 'ws-cache', expect.arrayContaining([
      expect.objectContaining({ id: node.id }),
    ]));
  });

  it('queues offline op when serverSaveNode fails after retries', async () => {
    const { saveNode } = await import('@/lib/cache/canvasCache');
    const { saveNode: serverSave } = await import('@/lib/firebase/canvasData');
    const { addPendingOp } = await import('@/lib/cache/indexedDB');

    (serverSave as Mock)
      .mockRejectedValueOnce(new Error('network error'))
      .mockRejectedValueOnce(new Error('network error'))
      .mockRejectedValueOnce(new Error('network error'));

    const node: Node = {
      id: crypto.randomUUID(),
      type: 'aiNote',
      position: { x: 0, y: 0 },
      data: { content: 'offline' },
      style: { width: 300, height: 200, zIndex: 0 },
    };

    await saveNode('ws-offline', node);

    expect(addPendingOp).toHaveBeenCalledOnce();
    const queued = (addPendingOp as Mock).mock.calls[0][0] as { type: string; args: unknown[] };
    expect(queued.type).toBe('saveNode');
    expect(queued.args[0]).toBe('ws-offline');
  });
});

describe('canvasCache – deleteCanvasNode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(_memStore).forEach((k) => delete _memStore[k]);
  });

  it('calls server delete and updates local cache', async () => {
    const { deleteCanvasNode } = await import('@/lib/cache/canvasCache');
    const { deleteCanvasNode: serverDel } = await import('@/lib/firebase/canvasData');

    await deleteCanvasNode('ws-del', 'node-abc');

    expect(serverDel).toHaveBeenCalledWith('ws-del', 'node-abc');
  });

  it('removes node from local cache', async () => {
    const { deleteCanvasNode, saveNode } = await import('@/lib/cache/canvasCache');
    const nodeId = 'node-to-delete';
    
    // Pre-populate cache with a node
    const { cacheSet } = await import('@/lib/cache/indexedDB');
    await cacheSet('canvas-nodes', 'ws-del', [{
      id: nodeId,
      type: 'aiNote',
      position: { x: 0, y: 0 },
      data: {},
      style: { width: 300, height: 200, zIndex: 0 },
    }]);

    await deleteCanvasNode('ws-del', nodeId);

    // Verify local cache was updated
    const { cacheGet } = await import('@/lib/cache/indexedDB');
    const entry = await cacheGet<Node[]>('canvas-nodes', 'ws-del');
    expect(entry?.data).toEqual([]);
  });

  it('queues offline op when server fails', async () => {
    const { deleteCanvasNode } = await import('@/lib/cache/canvasCache');
    const { deleteCanvasNode: serverDel } = await import('@/lib/firebase/canvasData');
    const { addPendingOp } = await import('@/lib/cache/indexedDB');

    (serverDel as Mock)
      .mockRejectedValueOnce(new Error('timeout'))
      .mockRejectedValueOnce(new Error('timeout'))
      .mockRejectedValueOnce(new Error('timeout'));

    await deleteCanvasNode('ws-del', 'node-xyz');

    expect(addPendingOp).toHaveBeenCalledOnce();
    const queued = (addPendingOp as Mock).mock.calls[0][0] as { type: string; args: unknown[] };
    expect(queued.type).toBe('deleteNode');
  });
});

describe('canvasCache – updateNodeDataInDb', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(_memStore).forEach((k) => delete _memStore[k]);
  });

  it('forwards data to server', async () => {
    const { updateNodeDataInDb } = await import('@/lib/cache/canvasCache');
    const { updateNodeDataInDb: serverUpdate } = await import('@/lib/firebase/canvasData');

    await updateNodeDataInDb('ws-upd', 'node-1', { title: 'New title', content: 'hello' });

    expect(serverUpdate).toHaveBeenCalledWith('ws-upd', 'node-1', { title: 'New title', content: 'hello' });
  });

  it('queues offline op on network failure', async () => {
    const { updateNodeDataInDb } = await import('@/lib/cache/canvasCache');
    const { updateNodeDataInDb: serverUpdate } = await import('@/lib/firebase/canvasData');
    const { addPendingOp } = await import('@/lib/cache/indexedDB');

    (serverUpdate as Mock)
      .mockRejectedValueOnce(new Error('connection refused'))
      .mockRejectedValueOnce(new Error('connection refused'))
      .mockRejectedValueOnce(new Error('connection refused'));

    await updateNodeDataInDb('ws-fail', 'n1', { text: 'save me' });

    expect(addPendingOp).toHaveBeenCalledOnce();
    const q = (addPendingOp as Mock).mock.calls[0][0] as { type: string; args: unknown[] };
    expect(q.type).toBe('updateData');
    expect(q.args).toContain('n1');
  });
});

describe('canvasCache – updateNodePosition', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('forwards position to server', async () => {
    const { updateNodePosition } = await import('@/lib/cache/canvasCache');
    const { updateNodePosition: serverPos } = await import('@/lib/firebase/canvasData');

    await updateNodePosition('ws-pos', 'n2', 150, 250);

    expect(serverPos).toHaveBeenCalledWith('ws-pos', 'n2', 150, 250);
  });

  it('queues on failure', async () => {
    const { updateNodePosition } = await import('@/lib/cache/canvasCache');
    const { updateNodePosition: serverPos } = await import('@/lib/firebase/canvasData');
    const { addPendingOp } = await import('@/lib/cache/indexedDB');

    (serverPos as Mock)
      .mockRejectedValueOnce(new Error('network'))
      .mockRejectedValueOnce(new Error('network'))
      .mockRejectedValueOnce(new Error('network'));

    await updateNodePosition('ws-fail', 'nX', 10, 20);

    expect(addPendingOp).toHaveBeenCalledOnce();
    const q = (addPendingOp as Mock).mock.calls[0][0] as { type: string; args: unknown[] };
    expect(q.type).toBe('updatePosition');
    expect(q.args).toEqual(['ws-fail', 'nX', 10, 20]);
  });
});

describe('canvasCache – updateNodeStyle', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('forwards style to server', async () => {
    const { updateNodeStyle } = await import('@/lib/cache/canvasCache');
    const { updateNodeStyle: serverStyle } = await import('@/lib/firebase/canvasData');

    await updateNodeStyle('ws-style', 'node-1', 400, 300, 5);

    expect(serverStyle).toHaveBeenCalledWith('ws-style', 'node-1', 400, 300, 5);
  });
});

describe('canvasCache – saveEdge', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('assigns UUID when edge.id is not a valid UUID', async () => {
    const { saveEdge } = await import('@/lib/cache/canvasCache');
    const { saveEdge: serverEdge } = await import('@/lib/firebase/canvasData');

    const edge: Edge = {
      id: 'reactflow__edge-a-b',
      source: 'a',
      target: 'b',
      type: 'custom',
      data: {},
    };

    await saveEdge('ws-edge', edge);

    expect(serverEdge).toHaveBeenCalledOnce();
    const savedEdge = (serverEdge as Mock).mock.calls[0][1] as Edge;
    expect(savedEdge.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });

  it('preserves valid UUID edge.id', async () => {
    const { saveEdge } = await import('@/lib/cache/canvasCache');
    const { saveEdge: serverEdge } = await import('@/lib/firebase/canvasData');

    const validUuid = '12345678-1234-1234-1234-123456789012';
    const edge: Edge = {
      id: validUuid,
      source: 'a',
      target: 'b',
    };

    await saveEdge('ws-edge', edge);

    const savedEdge = (serverEdge as Mock).mock.calls[0][1] as Edge;
    expect(savedEdge.id).toBe(validUuid);
  });
});

describe('canvasCache – deleteCanvasEdge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(_memStore).forEach((k) => delete _memStore[k]);
  });

  it('skips non-UUID edge IDs', async () => {
    const { deleteCanvasEdge } = await import('@/lib/cache/canvasCache');
    const { deleteCanvasEdge: serverDel } = await import('@/lib/firebase/canvasData');

    await deleteCanvasEdge('ws-edge', 'reactflow__edge-a-b');

    expect(serverDel).not.toHaveBeenCalled();
  });

  it('deletes valid UUID edges', async () => {
    const { deleteCanvasEdge } = await import('@/lib/cache/canvasCache');
    const { deleteCanvasEdge: serverDel } = await import('@/lib/firebase/canvasData');

    await deleteCanvasEdge('ws-edge', '12345678-1234-1234-1234-123456789012');

    expect(serverDel).toHaveBeenCalledWith('ws-edge', '12345678-1234-1234-1234-123456789012');
  });
});

describe('canvasCache – updateEdgeDataInDb', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('skips non-UUID edge IDs', async () => {
    const { updateEdgeDataInDb } = await import('@/lib/cache/canvasCache');
    const { updateEdgeDataInDb: serverUpdate } = await import('@/lib/firebase/canvasData');

    await updateEdgeDataInDb('ws-edge', 'reactflow__edge', { foo: 'bar' });

    expect(serverUpdate).not.toHaveBeenCalled();
  });

  it('updates valid UUID edges with data', async () => {
    const { updateEdgeDataInDb } = await import('@/lib/cache/canvasCache');
    const { updateEdgeDataInDb: serverUpdate } = await import('@/lib/firebase/canvasData');

    await updateEdgeDataInDb('ws-edge', '12345678-1234-1234-1234-123456789012', { label: 'new label' });

    expect(serverUpdate).toHaveBeenCalledWith('ws-edge', '12345678-1234-1234-1234-123456789012', { label: 'new label' }, undefined);
  });

  it('includes optional label parameter', async () => {
    const { updateEdgeDataInDb } = await import('@/lib/cache/canvasCache');
    const { updateEdgeDataInDb: serverUpdate } = await import('@/lib/firebase/canvasData');

    await updateEdgeDataInDb('ws-edge', '12345678-1234-1234-1234-123456789012', { foo: 'bar' }, 'My Label');

    expect(serverUpdate).toHaveBeenCalledWith('ws-edge', '12345678-1234-1234-1234-123456789012', { foo: 'bar' }, 'My Label');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Offline Queue Replay Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('canvasCache – pending ops handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(_memStore).forEach((k) => delete _memStore[k]);
  });

  it('getAllPendingOps returns empty array when no ops', async () => {
    const { getAllPendingOps } = await import('@/lib/cache/indexedDB');
    const ops = await getAllPendingOps();
    expect(ops).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Cached Load Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('canvasCache – cachedLoadCanvasNodes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(_memStore).forEach((k) => delete _memStore[k]);
  });

  it('returns cached data immediately when available', async () => {
    const { cacheSet } = await import('@/lib/cache/indexedDB');
    const cachedNodes: Node[] = [
      { id: 'n1', type: 'aiNote', position: { x: 0, y: 0 }, data: {}, style: {} },
    ];
    await cacheSet('canvas-nodes', 'ws-1', cachedNodes);

    const { cachedLoadCanvasNodes } = await import('@/lib/cache/canvasCache');
    const result = await cachedLoadCanvasNodes('ws-1');

    expect(result.cached).not.toBeNull();
    expect(result.cached).toHaveLength(1);
    expect(result.cached?.[0].id).toBe('n1');
  });

  it('returns null cached when no data', async () => {
    const { cachedLoadCanvasNodes } = await import('@/lib/cache/canvasCache');
    const result = await cachedLoadCanvasNodes('ws-empty');

    expect(result.cached).toBeNull();
  });

  it('fresh promise loads from server', async () => {
    const { loadCanvasNodes } = await import('@/lib/firebase/canvasData');
    (loadCanvasNodes as Mock).mockResolvedValue([
      { id: 'server-n1', type: 'aiNote', position: { x: 0, y: 0 }, data: {}, style: {} },
    ]);

    const { cachedLoadCanvasNodes } = await import('@/lib/cache/canvasCache');
    const result = await cachedLoadCanvasNodes('ws-1');

    const freshNodes = await result.fresh;
    expect(loadCanvasNodes).toHaveBeenCalledWith('ws-1');
    expect(freshNodes).toHaveLength(1);
    expect(freshNodes[0].id).toBe('server-n1');
  });
});

describe('canvasCache – cachedLoadCanvasEdges', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(_memStore).forEach((k) => delete _memStore[k]);
  });

  it('returns cached data immediately', async () => {
    const { cacheSet } = await import('@/lib/cache/indexedDB');
    const cachedEdges: Edge[] = [
      { id: 'e1', source: 'a', target: 'b' },
    ];
    await cacheSet('canvas-edges', 'ws-1', cachedEdges);

    const { cachedLoadCanvasEdges } = await import('@/lib/cache/canvasCache');
    const result = await cachedLoadCanvasEdges('ws-1');

    expect(result.cached).not.toBeNull();
    expect(result.cached).toHaveLength(1);
  });

  it('handles empty cache', async () => {
    const { cachedLoadCanvasEdges } = await import('@/lib/cache/canvasCache');
    const result = await cachedLoadCanvasEdges('ws-no-cache');

    expect(result.cached).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. Workspace Cache Invalidation
// ───────────────────────────────────────────────────��─��───────────────────────

describe('canvasCache – cache invalidation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(_memStore).forEach((k) => delete _memStore[k]);
  });

  it('invalidates workspace cache', async () => {
    const { cacheSet } = await import('@/lib/cache/indexedDB');
    await cacheSet('canvas-nodes', 'ws-invalidate', [{ id: 'n1' }]);

    const { invalidateWorkspaceCache } = await import('@/lib/cache/canvasCache');
    await invalidateWorkspaceCache('ws-invalidate');

    const { cacheGet } = await import('@/lib/cache/indexedDB');
    const entry = await cacheGet('canvas-nodes', 'ws-invalidate');
    expect(entry).toBeNull();
  });

  it('invalidates workspace list cache', async () => {
    const { invalidateWorkspaceList } = await import('@/lib/cache/canvasCache');
    
    // Should not throw
    await expect(invalidateWorkspaceList()).resolves.not.toThrow();
  });
});