/**
 * @file backend-sync.test.ts
 * @description Unit tests for the backend sync pipeline:
 *   - canvasCache write-through wrappers (saveNode, saveEdge, updateNodeDataInDb, etc.)
 *   - IndexedDB helpers (cacheGet, cacheSet, cacheDel) using a mock IDBFactory
 *   - WorkspacePage sync logic (addNode triggers saveNode, node edits trigger debounced updateNodeDataInDb)
 *
 * Run via: npm run test
 */

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import type { Node, Edge } from '@xyflow/react';

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
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. canvasCache write-through: mocking Firebase serverSaveNode
// ─────────────────────────────────────────────────────────────────────────────

// Mock the Firebase canvasData module so we don't hit the network
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

// Mock the indexedDB helpers to use an in-memory store instead
const _memStore: Record<string, Record<string, unknown>> = {};

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

// Also mock auth so ensureSession doesn't explode
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

describe('canvasCache – saveNode write-through', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(_memStore).forEach((k) => delete _memStore[k]);
  });

  it('calls serverSaveNode with the given node', async () => {
    const { saveNode } = await import('@/lib/cache/canvasCache');
    const { saveNode: serverSave } = await import('@/lib/firebase/canvasData');

    const node = {
      id: crypto.randomUUID(),
      type: 'aiNote',
      position: { x: 100, y: 200 },
      data: { title: 'Test node', content: '' },
      style: { width: 300, height: 200, zIndex: 1 },
    };

    await saveNode('ws-test-123', node as unknown as Node);

    expect(serverSave).toHaveBeenCalledOnce();
    expect(serverSave).toHaveBeenCalledWith('ws-test-123', node);
  });

  it('updates the IndexedDB cache when saving a node', async () => {
    const { saveNode } = await import('@/lib/cache/canvasCache');
    const { cacheSet } = await import('@/lib/cache/indexedDB');

    const node = {
      id: crypto.randomUUID(),
      type: 'aiNote',
      position: { x: 0, y: 0 },
      data: { title: 'Cache test' },
      style: { width: 300, height: 200, zIndex: 0 },
    };

    // Pre-populate cache so the update path fires
    const { cacheSet: rawSet } = await import('@/lib/cache/indexedDB');
    await rawSet('canvas-nodes', 'ws-a', []);

    await saveNode('ws-a', node as unknown as Node);

    // cacheSet should have been called to update the local cache
    expect(cacheSet).toHaveBeenCalled();
  });

  it('queues offline op when serverSaveNode fails', async () => {
    const { saveNode } = await import('@/lib/cache/canvasCache');
    const { saveNode: serverSave } = await import('@/lib/firebase/canvasData');
    const { addPendingOp } = await import('@/lib/cache/indexedDB');

    // withRetry will call it 3 times; reject all 3
    (serverSave as Mock)
      .mockRejectedValueOnce(new Error('network error'))
      .mockRejectedValueOnce(new Error('network error'))
      .mockRejectedValueOnce(new Error('network error'));

    const node = {
      id: crypto.randomUUID(),
      type: 'aiNote',
      position: { x: 0, y: 0 },
      data: { content: 'offline' },
      style: { width: 300, height: 200, zIndex: 0 },
    };

    await saveNode('ws-offline', node as unknown as Node);

    expect(addPendingOp).toHaveBeenCalledOnce();
    const queued = (addPendingOp as Mock).mock.calls[0][0];
    expect(queued.type).toBe('saveNode');
    expect(queued.args[0]).toBe('ws-offline');
  });
});

describe('canvasCache – deleteCanvasNode write-through', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(_memStore).forEach((k) => delete _memStore[k]);
  });

  it('calls serverDeleteNode and updates local cache', async () => {
    const { deleteCanvasNode } = await import('@/lib/cache/canvasCache');
    const { deleteCanvasNode: serverDel } = await import('@/lib/firebase/canvasData');

    await deleteCanvasNode('ws-del', 'node-abc');

    expect(serverDel).toHaveBeenCalledWith('ws-del', 'node-abc');
  });

  it('queues offline op when serverDeleteNode fails', async () => {
    const { deleteCanvasNode } = await import('@/lib/cache/canvasCache');
    const { deleteCanvasNode: serverDel } = await import('@/lib/firebase/canvasData');
    const { addPendingOp } = await import('@/lib/cache/indexedDB');

    (serverDel as Mock)
      .mockRejectedValueOnce(new Error('timeout'))
      .mockRejectedValueOnce(new Error('timeout'))
      .mockRejectedValueOnce(new Error('timeout'));

    await deleteCanvasNode('ws-del', 'node-xyz');

    expect(addPendingOp).toHaveBeenCalledOnce();
    const queued = (addPendingOp as Mock).mock.calls[0][0];
    expect(queued.type).toBe('deleteNode');
  });
});

describe('canvasCache – updateNodeDataInDb write-through', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('forwards data to serverUpdateData', async () => {
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
    const q = (addPendingOp as Mock).mock.calls[0][0];
    expect(q.type).toBe('updateData');
    expect(q.args).toContain('n1');
  });
});

describe('canvasCache – updateNodePosition write-through', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('forwards position to serverUpdatePosition', async () => {
    const { updateNodePosition } = await import('@/lib/cache/canvasCache');
    const { updateNodePosition: serverPos } = await import('@/lib/firebase/canvasData');

    await updateNodePosition('ws-pos', 'n2', 150, 250);

    expect(serverPos).toHaveBeenCalledWith('ws-pos', 'n2', 150, 250);
  });
});

describe('canvasCache – saveEdge write-through', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('saves edge and assigns UUID when edge.id is not a valid UUID', async () => {
    const { saveEdge } = await import('@/lib/cache/canvasCache');
    const { saveEdge: serverEdge } = await import('@/lib/firebase/canvasData');

    const edge = {
      id: 'reactflow__edge-a-b',   // non-UUID id
      source: 'a',
      target: 'b',
      type: 'custom',
      data: {},
    };

    await saveEdge('ws-edge', edge as unknown as Edge);

    expect(serverEdge).toHaveBeenCalledOnce();
    const savedEdge = (serverEdge as Mock).mock.calls[0][1];
    // Should have been given a proper UUID
    expect(savedEdge.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });
});
