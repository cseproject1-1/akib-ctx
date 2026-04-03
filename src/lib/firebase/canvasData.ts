import { collection, doc, query, getDocs, setDoc, updateDoc, deleteDoc, orderBy, onSnapshot, limit, writeBatch, serverTimestamp } from 'firebase/firestore';
import { db } from './client';
import type { Node, Edge } from '@xyflow/react';
import type { DrawingOverlay } from '@/types/canvas';

// For typing purposes you can just define Json locally or ignore it
type Json = Record<string, unknown> | any;

export async function loadCanvasNodes(workspaceId: string): Promise<Node[]> {
    const q = query(collection(db, `workspaces/${workspaceId}/nodes`));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((docSnap) => {
        const row = docSnap.data();
        const existingData = (row.data as Record<string, unknown>) || {};
        return {
            id: row.id,
            type: row.type || 'aiNote',
            position: { 
              x: typeof row.position_x === 'number' && isFinite(row.position_x) ? row.position_x : 0, 
              y: typeof row.position_y === 'number' && isFinite(row.position_y) ? row.position_y : 0 
            },
            data: {
              ...existingData,
              createdAt: existingData.createdAt || row.created_at || null,
              updatedAt: existingData.updatedAt || row.updated_at || null,
            } as Record<string, unknown>,
            style: { 
              width: typeof row.width === 'number' && isFinite(row.width) ? row.width : 300, 
              height: typeof row.height === 'number' && isFinite(row.height) ? row.height : 200, 
              zIndex: typeof row.z_index === 'number' ? row.z_index : 0 
            },
        };
    });
}

export async function loadCanvasEdges(workspaceId: string): Promise<Edge[]> {
    const q = query(collection(db, `workspaces/${workspaceId}/edges`));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((docSnap) => {
        const row = docSnap.data();
        return {
            id: row.id,
            source: row.source_node_id,
            target: row.target_node_id,
            sourceHandle: row.source_handle || undefined,
            targetHandle: row.target_handle || undefined,
            type: 'custom',
            label: row.label || undefined,
            data: (row.style as Record<string, unknown>) || {},
        };
    });
}

/**
 * Sanitizes data for Firestore by removing unsupported types.
 * Firestore supports nested arrays inside objects — only top-level
 * arrays-of-arrays need special handling, which setDoc/updateDoc handle.
 */
function sanitizeForFirestore(data: any): any {
    if (data === null || data === undefined) return data;
    if (typeof data === 'function' || typeof data === 'symbol') return undefined;
    if (Array.isArray(data)) {
        return data
            .map(v => sanitizeForFirestore(v))
            .filter(v => v !== undefined);
    }
    if (typeof data === 'object') {
        // Reject Date-like objects that aren't actual Dates, and prototype pollution attempts
        if (data.constructor && data.constructor !== Object && data.constructor !== Array && !(data instanceof Date)) {
            return undefined;
        }
        const result: Record<string, any> = {};
        for (const key in data) {
            if (Object.prototype.hasOwnProperty.call(data, key)) {
                // Skip __proto__, constructor, prototype to prevent prototype pollution
                if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
                const val = sanitizeForFirestore(data[key]);
                if (val !== undefined) {
                    result[key] = val;
                }
            }
        }
        return result;
    }
    return data;
}

export async function saveNode(workspaceId: string, node: Node) {
    const nodeRef = doc(db, `workspaces/${workspaceId}/nodes`, node.id);
    const sanitizedData = sanitizeForFirestore(node.data);

    const createdAt = (node.data as any)?.createdAt || new Date().toISOString();
    const updatedAt = new Date().toISOString();

    await setDoc(nodeRef, {
        id: node.id,
        workspace_id: workspaceId,
        type: node.type || 'aiNote',
        position_x: isFinite(node.position.x) ? node.position.x : 0,
        position_y: isFinite(node.position.y) ? node.position.y : 0,
        width: typeof node.style?.width === 'number' && isFinite(node.style?.width) ? node.style.width : 300,
        height: typeof node.style?.height === 'number' && isFinite(node.style?.height) ? node.style.height : 200,
        data: sanitizedData as unknown as Json,
        z_index: (node.style?.zIndex as number) || 0,
        created_at: createdAt,
        updated_at: updatedAt,
    }, { merge: true });
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function saveEdge(workspaceId: string, edge: Edge) {
    const edgeId = UUID_RE.test(edge.id) ? edge.id : crypto.randomUUID();
    const edgeRef = doc(db, `workspaces/${workspaceId}/edges`, edgeId);
    const sanitizedStyle = sanitizeForFirestore(edge.data || {});
    await setDoc(edgeRef, {
        id: edgeId,
        workspace_id: workspaceId,
        source_node_id: edge.source,
        target_node_id: edge.target,
        source_handle: edge.sourceHandle || null,
        target_handle: edge.targetHandle || null,
        label: (edge.label as string) || null,
        style: sanitizedStyle as unknown as Json,
    }, { merge: true });
}

export async function updateEdgeDataInDb(workspaceId: string, edgeId: string, data: Record<string, unknown>, label?: string) {
    if (!UUID_RE.test(edgeId)) return;
    const sanitizedData = sanitizeForFirestore(data);
    const update: Record<string, unknown> = { style: sanitizedData as unknown as Json };
    if (label !== undefined) update.label = label || null;
    const edgeRef = doc(db, `workspaces/${workspaceId}/edges`, edgeId);
    await updateDoc(edgeRef, update);
}

export async function deleteCanvasNode(workspaceId: string, nodeId: string) {
    const nodeRef = doc(db, `workspaces/${workspaceId}/nodes`, nodeId);
    await deleteDoc(nodeRef);
}

export async function deleteCanvasEdge(workspaceId: string, edgeId: string) {
    const edgeRef = doc(db, `workspaces/${workspaceId}/edges`, edgeId);
    await deleteDoc(edgeRef);
}

export async function updateNodePosition(workspaceId: string, nodeId: string, x: number, y: number) {
    const nodeRef = doc(db, `workspaces/${workspaceId}/nodes`, nodeId);
    await updateDoc(nodeRef, { 
        position_x: isFinite(x) ? x : 0, 
        position_y: isFinite(y) ? y : 0,
        updated_at: serverTimestamp()
    });
}

export async function updateNodeDataInDb(workspaceId: string, nodeId: string, data: Record<string, unknown>) {
    const nodeRef = doc(db, `workspaces/${workspaceId}/nodes`, nodeId);
    const sanitizedData = sanitizeForFirestore(data);
    await updateDoc(nodeRef, { 
        data: sanitizedData as unknown as Json,
        updated_at: serverTimestamp()
    });
}

export async function updateNodeStyle(workspaceId: string, nodeId: string, width: number, height: number, zIndex: number) {
    const nodeRef = doc(db, `workspaces/${workspaceId}/nodes`, nodeId);
    const w = typeof width === 'number' && isFinite(width) ? width : 300;
    const h = typeof height === 'number' && isFinite(height) ? height : 200;
    await updateDoc(nodeRef, { width: w, height: h, z_index: zIndex });
}

export async function getNodeCount(workspaceId: string): Promise<number> {
    const q = query(collection(db, `workspaces/${workspaceId}/nodes`));
    const snapshot = await getDocs(q);
    return snapshot.size;
}

// ─── Snapshots ───

export async function createSnapshot(workspaceId: string, name: string, nodesData: unknown[], edgesData: unknown[], createdBy: string, drawingsData?: unknown[]) {
    const snapshotRef = doc(collection(db, `workspaces/${workspaceId}/snapshots`));
    const sanitizedNodes = sanitizeForFirestore(nodesData);
    const sanitizedEdges = sanitizeForFirestore(edgesData);
    const sanitizedDrawings = drawingsData ? sanitizeForFirestore(drawingsData) : [];
    await setDoc(snapshotRef, {
        id: snapshotRef.id,
        workspace_id: workspaceId,
        name,
        nodes_data: sanitizedNodes as unknown as Json,
        edges_data: sanitizedEdges as unknown as Json,
        drawings_data: sanitizedDrawings as unknown as Json,
        created_by: createdBy,
        created_at: new Date().toISOString()
    });
}

export async function getSnapshots(workspaceId: string) {
    const q = query(
        collection(db, `workspaces/${workspaceId}/snapshots`),
        orderBy('created_at', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(docSnap => docSnap.data());
}

export async function deleteSnapshot(workspaceId: string, snapshotId: string) {
    const snapshotRef = doc(db, `workspaces/${workspaceId}/snapshots`, snapshotId);
    await deleteDoc(snapshotRef);
}

export async function pruneSnapshots(workspaceId: string, keepCount = 50) {
    const q = query(
        collection(db, `workspaces/${workspaceId}/snapshots`),
        orderBy('created_at', 'desc'),
        limit(keepCount + 1)
    );
    const snapshot = await getDocs(q);
    if (snapshot.size <= keepCount) return;

    const docsToDelete = snapshot.docs.slice(keepCount);
    const batch = writeBatch(db);
    docsToDelete.forEach(d => batch.delete(d.ref));
    await batch.commit();
}

// ─── Real-time Subscriptions ───

export function subscribeCanvasNodes(workspaceId: string, onUpdate: (nodes: Node[]) => void, onError?: (err: Error) => void) {
    const q = query(collection(db, `workspaces/${workspaceId}/nodes`));
    return onSnapshot(q, (snapshot) => {
        // W4 fix: Skip only docs with pending writes, not entire snapshot
        if (!snapshot.metadata.hasPendingWrites) {
            const nodes = snapshot.docs.map((docSnap) => {
                const row = docSnap.data();
                const existingData = (row.data as Record<string, unknown>) || {};
                
                // B24 fix: Validate position values to prevent NaN propagation
                const positionX = isFinite(row.position_x) ? row.position_x : 0;
                const positionY = isFinite(row.position_y) ? row.position_y : 0;
                
                return {
                    id: row.id,
                    type: row.type,
                    position: { x: positionX, y: positionY },
                    data: {
                      ...existingData,
                      createdAt: existingData.createdAt || row.created_at || null,
                      updatedAt: existingData.updatedAt || row.updated_at || null,
                    } as Record<string, unknown>,
                    style: { 
                        width: isFinite(row.width) ? row.width : undefined, 
                        height: isFinite(row.height) ? row.height : undefined, 
                        zIndex: row.z_index || 0 
                    },
                    // M32: preserve metadata for migration safety
                    workspace_id: workspaceId,
                    created_at: row.created_at,
                    updated_at: row.updated_at
                };
            }).filter(node => !workspaceId || (node as any).workspace_id === undefined || (node as any).workspace_id === workspaceId);


            onUpdate(nodes);
        }
    }, (err) => {
        console.error('[sync] Nodes subscription error:', err);
        onError?.(err);
    });
}

export function subscribeCanvasEdges(workspaceId: string, onUpdate: (edges: Edge[]) => void, onError?: (err: Error) => void) {
    const q = query(collection(db, `workspaces/${workspaceId}/edges`));
    return onSnapshot(q, (snapshot) => {
        // W4 fix: Skip only docs with pending writes, not entire snapshot
        if (!snapshot.metadata.hasPendingWrites) {
            const edges = snapshot.docs.map((docSnap) => {
                const row = docSnap.data();
                return {
                    id: row.id,
                    source: row.source_node_id,
                    target: row.target_node_id,
                    sourceHandle: row.source_handle || undefined,
                    targetHandle: row.target_handle || undefined,
                    type: 'custom',
                    label: row.label || undefined,
                    data: (row.style as Record<string, unknown>) || {},
                };
            });
            onUpdate(edges);
        }
    }, (err) => {
        console.error('[sync] Edges subscription error:', err);
        onError?.(err);
    });
}

export async function updateCursorPositionInDb(workspaceId: string, userId: string, x: number, y: number, name: string, color: string) {
    const cursorRef = doc(db, `workspaces/${workspaceId}/presence`, userId);
    await setDoc(cursorRef, {
        x: isFinite(x) ? x : 0,
        y: isFinite(y) ? y : 0,
        name,
        color,
        last_seen: new Date().toISOString()
    }, { merge: true });
}

export function subscribeCursors(workspaceId: string, onUpdate: (cursors: Record<string, any>) => void) {
    const q = query(collection(db, `workspaces/${workspaceId}/presence`));
    return onSnapshot(q, (snapshot) => {
        if (snapshot.metadata.hasPendingWrites) return;

        const cursors: Record<string, any> = {};
        const now = Date.now();
        snapshot.docs.forEach((docSnap) => {
            const data = docSnap.data();
            // Filter out cursors older than 1 minute to keep it clean
            const lastSeen = new Date(data.last_seen).getTime();
            if (now - lastSeen < 60000) {
                // W23 fix: Validate cursor positions to prevent NaN
                cursors[docSnap.id] = {
                    x: isFinite(data.x) ? data.x : 0,
                    y: isFinite(data.y) ? data.y : 0,
                    name: data.name,
                    color: data.color,
                    lastSeen
                };
            }
        });
        onUpdate(cursors);
    }, (err) => {
        console.error('[sync] Cursors subscription error:', err);
    });
}

// ─── Drawings ───

export async function loadCanvasDrawings(workspaceId: string): Promise<DrawingOverlay[]> {
    const q = query(collection(db, `workspaces/${workspaceId}/drawings`));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((docSnap) => {
        const row = docSnap.data();
        return {
            id: row.id,
            paths: (row.paths as DrawingOverlay['paths']) || [],
        };
    });
}

export async function saveDrawing(workspaceId: string, drawing: DrawingOverlay) {
    const ref = doc(db, `workspaces/${workspaceId}/drawings`, drawing.id);
    await setDoc(ref, {
        id: drawing.id,
        workspace_id: workspaceId,
        paths: sanitizeForFirestore(drawing.paths),
    }, { merge: true });
}

export async function deleteDrawingFromDb(workspaceId: string, drawingId: string) {
    const ref = doc(db, `workspaces/${workspaceId}/drawings`, drawingId);
    await deleteDoc(ref);
}
