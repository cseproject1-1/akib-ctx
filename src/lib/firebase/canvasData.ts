import { collection, doc, query, getDocs, setDoc, updateDoc, deleteDoc, orderBy } from 'firebase/firestore';
import { db } from './client';
import type { Node, Edge } from '@xyflow/react';

// For typing purposes you can just define Json locally or ignore it
type Json = Record<string, unknown> | any;

export async function loadCanvasNodes(workspaceId: string): Promise<Node[]> {
    const q = query(collection(db, `workspaces/${workspaceId}/nodes`));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((docSnap) => {
        const row = docSnap.data();
        return {
            id: row.id,
            type: row.type,
            position: { x: row.position_x, y: row.position_y },
            data: (row.data as Record<string, unknown>) || {},
            style: { width: row.width, height: row.height, zIndex: row.z_index },
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
            type: 'custom',
            label: row.label || undefined,
            data: (row.style as Record<string, unknown>) || {},
        };
    });
}

/**
 * Sanitizes an object for Firestore by removing nested arrays,
 * which Firestore does not support. Recursively flattens nested arrays.
 */
function sanitizeForFirestore(data: any): any {
    if (data === null || data === undefined) return data;
    if (Array.isArray(data)) {
        return data.map(v => {
            const result = sanitizeForFirestore(v);
            return Array.isArray(result) ? JSON.stringify(result) : result;
        });
    }
    if (typeof data === 'object') {
        const result: Record<string, any> = {};
        for (const key in data) {
            if (Object.prototype.hasOwnProperty.call(data, key)) {
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
    await setDoc(nodeRef, {
        id: node.id,
        workspace_id: workspaceId,
        type: node.type || 'aiNote',
        position_x: node.position.x,
        position_y: node.position.y,
        width: typeof node.style?.width === 'number' ? node.style.width : 300,
        height: typeof node.style?.height === 'number' ? node.style.height : 200,
        data: sanitizedData as unknown as Json,
        z_index: (node.style?.zIndex as number) || 0,
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
    await updateDoc(nodeRef, { position_x: x, position_y: y });
}

export async function updateNodeDataInDb(workspaceId: string, nodeId: string, data: Record<string, unknown>) {
    const nodeRef = doc(db, `workspaces/${workspaceId}/nodes`, nodeId);
    const sanitizedData = sanitizeForFirestore(data);
    await updateDoc(nodeRef, { data: sanitizedData as unknown as Json });
}

export async function updateNodeStyle(workspaceId: string, nodeId: string, width: number, height: number, zIndex: number) {
    const nodeRef = doc(db, `workspaces/${workspaceId}/nodes`, nodeId);
    const w = typeof width === 'number' ? width : 300;
    const h = typeof height === 'number' ? height : 200;
    await updateDoc(nodeRef, { width: w, height: h, z_index: zIndex });
}

export async function getNodeCount(workspaceId: string): Promise<number> {
    const q = query(collection(db, `workspaces/${workspaceId}/nodes`));
    const snapshot = await getDocs(q);
    return snapshot.size;
}

// ─── Snapshots ───

export async function createSnapshot(workspaceId: string, name: string, nodesData: unknown[], edgesData: unknown[], createdBy: string) {
    const snapshotRef = doc(collection(db, `workspaces/${workspaceId}/snapshots`));
    const sanitizedNodes = sanitizeForFirestore(nodesData);
    const sanitizedEdges = sanitizeForFirestore(edgesData);
    await setDoc(snapshotRef, {
        id: snapshotRef.id,
        workspace_id: workspaceId,
        name,
        nodes_data: sanitizedNodes as unknown as Json,
        edges_data: sanitizedEdges as unknown as Json,
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
        orderBy('created_at', 'desc')
    );
    const snapshot = await getDocs(q);
    if (snapshot.size <= keepCount) return;

    const docsToDelete = snapshot.docs.slice(keepCount);
    const deletes = docsToDelete.map(d => deleteDoc(d.ref));
    await Promise.all(deletes);
}
