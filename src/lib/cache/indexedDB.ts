const DB_NAME = 'crxnote-cache';
const DB_VERSION = 1;
const STORES = ['canvas-nodes', 'canvas-edges', 'workspaces', 'node-counts', 'pending-ops'] as const;

type StoreName = (typeof STORES)[number];

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      STORES.forEach((name) => {
        if (!db.objectStoreNames.contains(name)) {
          db.createObjectStore(name);
        }
      });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

let dbPromise: Promise<IDBDatabase> | null = null;
function getDB() {
  if (!dbPromise) dbPromise = openDB();
  return dbPromise;
}

export interface CachedEntry<T> {
  data: T;
  cachedAt: number;
}

export async function cacheGet<T>(store: StoreName, key: string): Promise<CachedEntry<T> | null> {
  try {
    const db = await getDB();
    return new Promise((resolve) => {
      const tx = db.transaction(store, 'readonly');
      const req = tx.objectStore(store).get(key);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function cacheSet<T>(store: StoreName, key: string, data: T): Promise<void> {
  try {
    const db = await getDB();
    const entry: CachedEntry<T> = { data, cachedAt: Date.now() };
    return new Promise((resolve) => {
      const tx = db.transaction(store, 'readwrite');
      tx.objectStore(store).put(entry, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // silently fail
  }
}

export async function cacheDel(store: StoreName, key: string): Promise<void> {
  try {
    const db = await getDB();
    return new Promise((resolve) => {
      const tx = db.transaction(store, 'readwrite');
      tx.objectStore(store).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // silently fail
  }
}

export async function cacheClear(store: StoreName): Promise<void> {
  try {
    const db = await getDB();
    return new Promise((resolve) => {
      const tx = db.transaction(store, 'readwrite');
      tx.objectStore(store).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // silently fail
  }
}

export async function clearAllCaches(): Promise<void> {
  try {
    const db = await getDB();
    const tx = db.transaction([...STORES], 'readwrite');
    STORES.forEach((s) => tx.objectStore(s).clear());
    return new Promise((resolve) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // silently fail
  }
}

// Pending ops for offline queue
export interface PendingOp {
  id: string;
  type: 'saveNode' | 'saveEdge' | 'deleteNode' | 'deleteEdge' | 'updatePosition' | 'updateData' | 'updateStyle' | 'updateEdgeData';
  args: unknown[];
  createdAt: number;
}

export async function addPendingOp(op: PendingOp): Promise<void> {
  await cacheSet('pending-ops', op.id, op);
}

export async function getAllPendingOps(): Promise<PendingOp[]> {
  try {
    const db = await getDB();
    return new Promise((resolve) => {
      const tx = db.transaction('pending-ops', 'readonly');
      const req = tx.objectStore('pending-ops').getAll();
      req.onsuccess = () => {
        const entries = (req.result || []) as CachedEntry<PendingOp>[];
        resolve(entries.map((e) => e.data).sort((a, b) => a.createdAt - b.createdAt));
      };
      req.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

export async function removePendingOp(id: string): Promise<void> {
  await cacheDel('pending-ops', id);
}
