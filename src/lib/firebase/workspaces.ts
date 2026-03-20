import { collection, doc, query, where, getDocs, getDoc, setDoc, updateDoc, deleteDoc, writeBatch, orderBy } from 'firebase/firestore';
import { db, auth } from './client';

export interface Workspace {
    id: string;
    created_at: string;
    name: string;
    color: string;
    is_public: boolean;
    parent_workspace_id: string | null;
    updated_at: string;
    user_id: string;
    tags?: string[];
    folder?: string | null;
    is_deleted?: boolean;
    deleted_at?: string | null;
    // Password protection (optional, backward compatible)
    password_hash?: string;
    is_password_protected?: boolean;
}

export async function getWorkspaces(): Promise<Workspace[]> {
    const user = auth.currentUser;
    if (!user) throw new Error('Not authenticated');

    const q = query(
        collection(db, 'workspaces'),
        where('user_id', '==', user.uid),
        orderBy('updated_at', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Workspace));
}

export async function createWorkspace(name: string, color: string, passwordHash?: string): Promise<Workspace> {
    const user = auth.currentUser;
    if (!user) throw new Error('Not authenticated');

    const wsRef = doc(collection(db, 'workspaces'));
    const now = new Date().toISOString();
    const newWs: Workspace = {
        id: wsRef.id,
        created_at: now,
        updated_at: now,
        name,
        color,
        is_public: false,
        parent_workspace_id: null,
        user_id: user.uid,
        tags: [],
        folder: null,
        is_deleted: false,
        // Password protection fields (optional, backward compatible)
        password_hash: passwordHash,
        is_password_protected: !!passwordHash
    };

    await setDoc(wsRef, newWs);
    return newWs;
}

export async function updateWorkspace(id: string, updates: { name?: string; color?: string; is_public?: boolean; tags?: string[]; folder?: string | null; is_deleted?: boolean; deleted_at?: string | null; password_hash?: string; is_password_protected?: boolean }) {
    const wsRef = doc(db, 'workspaces', id);
    await updateDoc(wsRef, {
        ...updates,
        updated_at: new Date().toISOString()
    });
}

/** Soft delete a workspace */
export async function deleteWorkspace(id: string) {
    const wsRef = doc(db, 'workspaces', id);
    await updateDoc(wsRef, {
        is_deleted: true,
        deleted_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    });
}

/** Restore a workspace from trash */
export async function restoreWorkspace(id: string) {
    const wsRef = doc(db, 'workspaces', id);
    await updateDoc(wsRef, {
        is_deleted: false,
        deleted_at: null,
        updated_at: new Date().toISOString()
    });
}

/** Permanently delete a workspace */
export async function permanentlyDeleteWorkspace(id: string) {
    const wsRef = doc(db, 'workspaces', id);
    // Cleanup subcollections
    const nodesSnap = await getDocs(collection(wsRef, 'nodes'));
    const edgesSnap = await getDocs(collection(wsRef, 'edges'));
    
    const deletePromises = [
      ...nodesSnap.docs.map(d => deleteDoc(d.ref)),
      ...edgesSnap.docs.map(d => deleteDoc(d.ref))
    ];
    await Promise.all(deletePromises);
    
    await deleteDoc(wsRef);
}

/** Permanently delete all items in trash */
export async function emptyTrash() {
    const user = auth.currentUser;
    if (!user) throw new Error('Not authenticated');

    const q = query(
        collection(db, 'workspaces'),
        where('user_id', '==', user.uid),
        where('is_deleted', '==', true)
    );
    
    const snapshot = await getDocs(q);
    const deletes = snapshot.docs.map(d => permanentlyDeleteWorkspace(d.id));
    await Promise.all(deletes);
}

const chunkArray = <T>(arr: T[], size: number): T[][] => {
    return Array.from({ length: Math.ceil(arr.length / size) }, (v, i) =>
        arr.slice(i * size, i * size + size)
    );
};

export async function branchWorkspace(sourceId: string, name: string): Promise<Workspace> {
    const user = auth.currentUser;
    if (!user) throw new Error('Not authenticated');

    const branchWsRef = doc(collection(db, 'workspaces'));
    const now = new Date().toISOString();
    const branchWs: Workspace = {
        id: branchWsRef.id,
        created_at: now,
        updated_at: now,
        name,
        color: '#f59e0b',
        is_public: false,
        parent_workspace_id: sourceId,
        user_id: user.uid
    };

    await setDoc(branchWsRef, branchWs);

    const nodesQ = query(collection(db, `workspaces/${sourceId}/nodes`));
    const nodesSnap = await getDocs(nodesQ);

    const idMap = new Map<string, string>();
    const writes: (() => void)[] = [];

    if (!nodesSnap.empty) {
        for (const docSnap of nodesSnap.docs) {
            const oldNode = docSnap.data();
            const newNodeRef = doc(collection(db, `workspaces/${branchWsRef.id}/nodes`));
            idMap.set(docSnap.id, newNodeRef.id);

            writes.push(() => setDoc(newNodeRef, {
                ...oldNode,
                id: newNodeRef.id,
                workspace_id: branchWsRef.id
            }));
        }
    }

    const edgesQ = query(collection(db, `workspaces/${sourceId}/edges`));
    const edgesSnap = await getDocs(edgesQ);

    if (!edgesSnap.empty) {
        for (const docSnap of edgesSnap.docs) {
            const oldEdge = docSnap.data();
            if (idMap.has(oldEdge.source_node_id) && idMap.has(oldEdge.target_node_id)) {
                const newEdgeRef = doc(collection(db, `workspaces/${branchWsRef.id}/edges`));
                writes.push(() => setDoc(newEdgeRef, {
                    ...oldEdge,
                    id: newEdgeRef.id,
                    workspace_id: branchWsRef.id,
                    source_node_id: idMap.get(oldEdge.source_node_id),
                    target_node_id: idMap.get(oldEdge.target_node_id)
                }));
            }
        }
    }

    // Execute writes
    await Promise.all(writes.map(w => w()));

    return branchWs;
}

export async function duplicateWorkspace(sourceId: string, name: string, color: string): Promise<Workspace> {
    const user = auth.currentUser;
    if (!user) throw new Error('Not authenticated');

    const newWsRef = doc(collection(db, 'workspaces'));
    const now = new Date().toISOString();
    const sourceWs = await getDoc(doc(db, 'workspaces', sourceId));
    if (!sourceWs.exists()) throw new Error('Source workspace not found');
    const sourceData = sourceWs.data() as Workspace;

    const newWs: Workspace = {
        id: newWsRef.id,
        created_at: now,
        updated_at: now,
        name,
        color,
        is_public: false,
        parent_workspace_id: null,
        user_id: user.uid,
        tags: sourceData?.tags || [],
        folder: sourceData?.folder || null
    };

    await setDoc(newWsRef, newWs);

    const nodesQ = query(collection(db, `workspaces/${sourceId}/nodes`));
    const nodesSnap = await getDocs(nodesQ);

    const idMap = new Map<string, string>();
    const writes: (() => void)[] = [];

    if (!nodesSnap.empty) {
        for (const docSnap of nodesSnap.docs) {
            const oldNode = docSnap.data();
            const newNodeRef = doc(collection(db, `workspaces/${newWsRef.id}/nodes`));
            idMap.set(docSnap.id, newNodeRef.id);

            writes.push(() => setDoc(newNodeRef, {
                ...oldNode,
                id: newNodeRef.id,
                workspace_id: newWsRef.id
            }));
        }
    }

    const edgesQ = query(collection(db, `workspaces/${sourceId}/edges`));
    const edgesSnap = await getDocs(edgesQ);

    if (!edgesSnap.empty) {
        for (const docSnap of edgesSnap.docs) {
            const oldEdge = docSnap.data();
            if (idMap.has(oldEdge.source_node_id) && idMap.has(oldEdge.target_node_id)) {
                const newEdgeRef = doc(collection(db, `workspaces/${newWsRef.id}/edges`));
                writes.push(() => setDoc(newEdgeRef, {
                    ...oldEdge,
                    id: newEdgeRef.id,
                    workspace_id: newWsRef.id,
                    source_node_id: idMap.get(oldEdge.source_node_id),
                    target_node_id: idMap.get(oldEdge.target_node_id)
                }));
            }
        }
    }

    await Promise.all(writes.map(w => w()));

    return newWs;
}

export async function mergeWorkspaceBack(branchId: string): Promise<string> {
    const branchRef = doc(db, 'workspaces', branchId);
    const branchSnap = await getDoc(branchRef);
    if (!branchSnap.exists()) throw new Error('Branch not found');

    const branchData = branchSnap.data() as Workspace;
    const parentId = branchData.parent_workspace_id;
    if (!parentId) throw new Error('Not a branch');

    const parentNodesSnap = await getDocs(query(collection(db, `workspaces/${parentId}/nodes`)));
    const parentEdgesSnap = await getDocs(query(collection(db, `workspaces/${parentId}/edges`)));

    const deletes: Promise<void>[] = [];
    parentNodesSnap.forEach(d => deletes.push(deleteDoc(d.ref)));
    parentEdgesSnap.forEach(d => deletes.push(deleteDoc(d.ref)));
    await Promise.all(deletes);

    const branchNodesSnap = await getDocs(query(collection(db, `workspaces/${branchId}/nodes`)));
    const idMap = new Map<string, string>();
    const writes: Promise<void>[] = [];

    branchNodesSnap.forEach(docSnap => {
        const oldNode = docSnap.data();
        const newNodeRef = doc(collection(db, `workspaces/${parentId}/nodes`));
        idMap.set(docSnap.id, newNodeRef.id);
        writes.push(setDoc(newNodeRef, {
            ...oldNode,
            id: newNodeRef.id,
            workspace_id: parentId
        }));
    });

    const branchEdgesSnap = await getDocs(query(collection(db, `workspaces/${branchId}/edges`)));
    branchEdgesSnap.forEach(docSnap => {
        const oldEdge = docSnap.data();
        if (idMap.has(oldEdge.source_node_id) && idMap.has(oldEdge.target_node_id)) {
            const newEdgeRef = doc(collection(db, `workspaces/${parentId}/edges`));
            writes.push(setDoc(newEdgeRef, {
                ...oldEdge,
                id: newEdgeRef.id,
                workspace_id: parentId,
                source_node_id: idMap.get(oldEdge.source_node_id),
                target_node_id: idMap.get(oldEdge.target_node_id)
            }));
        }
    });

    await Promise.all(writes);
    return parentId;
}
