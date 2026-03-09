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

export async function saveNode(workspaceId: string, node: Node) {
    const nodeRef = doc(db, `workspaces/${workspaceId}/nodes`, node.id);
    await setDoc(nodeRef, {
        id: node.id,
        workspace_id: workspaceId,
        type: node.type || 'aiNote',
        position_x: node.position.x,
        position_y: node.position.y,
        width: (node.style?.width as number) || 300,
        height: (node.style?.height as number) || 200,
        data: node.data as unknown as Json,
        z_index: (node.style?.zIndex as number) || 0,
    }, { merge: true });
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function saveEdge(workspaceId: string, edge: Edge) {
    const edgeId = UUID_RE.test(edge.id) ? edge.id : crypto.randomUUID();
    const edgeRef = doc(db, `workspaces/${workspaceId}/edges`, edgeId);
    await setDoc(edgeRef, {
        id: edgeId,
        workspace_id: workspaceId,
        source_node_id: edge.source,
        target_node_id: edge.target,
        label: (edge.label as string) || null,
        style: (edge.data as unknown as Json) || {},
    }, { merge: true });
}

export async function updateEdgeDataInDb(workspaceId: string, edgeId: string, data: Record<string, unknown>, label?: string) {
    if (!UUID_RE.test(edgeId)) return;
    const update: Record<string, unknown> = { style: data as unknown as Json };
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
    await updateDoc(nodeRef, { data: data as unknown as Json });
}

export async function updateNodeStyle(workspaceId: string, nodeId: string, width: number, height: number, zIndex: number) {
    const nodeRef = doc(db, `workspaces/${workspaceId}/nodes`, nodeId);
    await updateDoc(nodeRef, { width, height, z_index: zIndex });
}

export async function getNodeCount(workspaceId: string): Promise<number> {
    const q = query(collection(db, `workspaces/${workspaceId}/nodes`));
    const snapshot = await getDocs(q);
    return snapshot.size;
}

// ─── Snapshots ───

export async function createSnapshot(workspaceId: string, name: string, nodesData: unknown[], edgesData: unknown[], createdBy: string) {
    const snapshotRef = doc(collection(db, `workspaces/${workspaceId}/snapshots`));
    await setDoc(snapshotRef, {
        id: snapshotRef.id,
        workspace_id: workspaceId,
        name,
        nodes_data: nodesData as unknown as Json,
        edges_data: edgesData as unknown as Json,
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
