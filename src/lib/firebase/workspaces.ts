import { collection, query, where, getDocs, doc, setDoc, updateDoc, deleteDoc, writeBatch, getDoc } from 'firebase/firestore';
import { db, auth } from './client';
import { Workspace } from '@/types/canvas';
import { chunkArray } from '@/lib/utils';
import { deleteWorkspaceCache, deleteWorkspacePendingOps, cacheDel } from '@/lib/cache/indexedDB';


/** Get all workspaces for the current user */
export async function getWorkspaces(options: { excludeVault?: boolean; includeDeleted?: boolean } = {}): Promise<Workspace[]> {
    const { excludeVault = false, includeDeleted = false } = options;

    const user = auth.currentUser;
    if (!user) return [];

    const q = query(
        collection(db, 'workspaces'),
        where('user_id', '==', user.uid),
        ...(includeDeleted ? [] : [where('is_deleted', '==', false)]),
        ...(excludeVault ? [where('is_in_vault', '==', false)] : [])
    );


    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    } as Workspace)).sort((a, b) => 
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    );
}

/** Create a new workspace */
export async function createWorkspace(name: string, color: string, passwordHash?: string): Promise<Workspace> {

    const user = auth.currentUser;
    if (!user) throw new Error('Not authenticated');

    const wsRef = doc(collection(db, 'workspaces'));
    const now = new Date().toISOString();
    const ws: Workspace = {
        id: wsRef.id,
        user_id: user.uid,
        name,
        color,
        created_at: now,
        updated_at: now,
        is_deleted: false,
        is_public: false,
        tags: [],
        folder: null,
        is_in_vault: false,
        is_password_protected: !!passwordHash,
        password_hash: passwordHash || null
    };


    await setDoc(wsRef, ws);
    return ws;
}

/** Update workspace metadata */
export async function updateWorkspace(id: string, updates: Partial<Workspace>) {
    const user = auth.currentUser;
    if (!user) throw new Error('Not authenticated');

    const wsRef = doc(db, 'workspaces', id);
    const wsSnap = await getDoc(wsRef);
    if (!wsSnap.exists() || wsSnap.data().user_id !== user.uid) {
        throw new Error('Not authorized to update this workspace');
    }

    await updateDoc(wsRef, {
        ...updates,
        updated_at: new Date().toISOString()
    });
}

/** Move a workspace to trash */
export async function deleteWorkspace(id: string) {
    const user = auth.currentUser;
    if (!user) throw new Error('Not authenticated');

    const wsRef = doc(db, 'workspaces', id);
    const wsSnap = await getDoc(wsRef);
    if (!wsSnap.exists() || wsSnap.data().user_id !== user.uid) {
        throw new Error('Not authorized to delete this workspace');
    }

    await updateDoc(wsRef, {
        is_deleted: true,
        deleted_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    });
}

/** Restore a workspace from trash */
export async function restoreWorkspace(id: string) {
    const user = auth.currentUser;
    if (!user) throw new Error('Not authenticated');

    const wsRef = doc(db, 'workspaces', id);
    const wsSnap = await getDoc(wsRef);
    if (!wsSnap.exists() || wsSnap.data().user_id !== user.uid) {
        throw new Error('Not authorized to restore this workspace');
    }

    await updateDoc(wsRef, {
        is_deleted: false,
        deleted_at: null,
        updated_at: new Date().toISOString()
    });
}

/** Permanently delete a workspace */
export async function permanentlyDeleteWorkspace(id: string) {
    const user = auth.currentUser;
    if (!user) throw new Error('Not authenticated');

    const wsRef = doc(db, 'workspaces', id);
    const wsSnap = await getDoc(wsRef);
    if (!wsSnap.exists()) return; // Already deleted
    
    if (wsSnap.data().user_id !== user.uid) {
        throw new Error('Not authorized to permanently delete this workspace');
    }

    const subcollections = ['nodes', 'edges', 'drawings', 'snapshots', 'presence'];
    
    // Parallelize subcollection cleanup
    await Promise.all(subcollections.map(async (colName) => {
      try {
        const snap = await getDocs(collection(wsRef, colName));
        if (snap.empty) return;
        
        const chunks = chunkArray(snap.docs, 500);
        for (const chunk of chunks) {
          const batch = writeBatch(db);
          chunk.forEach(d => batch.delete(d.ref));
          await batch.commit();
        }
      } catch (err) {
        console.error(`[workspaces] Failed to clean ${colName} for ${id}:`, err);
      }
    }));
    
    await deleteDoc(wsRef);

    // Clear local caches for this workspace
    await Promise.all([
      deleteWorkspaceCache(id),
      deleteWorkspacePendingOps(id),
      cacheDel('workspaces', 'list')
    ]);
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
    if (snapshot.empty) return;

    // Parallelize workspace deletions
    await Promise.all(snapshot.docs.map(d => permanentlyDeleteWorkspace(d.id)));
    
    // Final cache flush
    await cacheDel('workspaces', 'list');
}


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
        is_deleted: false,
        is_public: false,
        parent_workspace_id: sourceId,
        user_id: user.uid,
        tags: [],
        folder: null,
        is_password_protected: false,
        is_in_vault: false,
        password_hash: null,
        shared_with: []
    };

    await setDoc(branchWsRef, branchWs);

    const nodesQ = query(collection(db, `workspaces/${sourceId}/nodes`));
    const nodesSnap = await getDocs(nodesQ);

    const idMap = new Map<string, string>();
    const nodeWrites: { ref: any, data: any }[] = [];

    if (!nodesSnap.empty) {
        for (const docSnap of nodesSnap.docs) {
            const oldNode = docSnap.data();
            const newNodeRef = doc(collection(db, `workspaces/${branchWsRef.id}/nodes`));
            idMap.set(docSnap.id, newNodeRef.id);

            nodeWrites.push({
                ref: newNodeRef,
                data: {
                    ...oldNode,
                    id: newNodeRef.id,
                    workspace_id: branchWsRef.id
                }
            });
        }
    }

    const edgesQ = query(collection(db, `workspaces/${sourceId}/edges`));
    const edgesSnap = await getDocs(edgesQ);
    const edgeWrites: { ref: any, data: any }[] = [];

    if (!edgesSnap.empty) {
        for (const docSnap of edgesSnap.docs) {
            const oldEdge = docSnap.data();
            if (idMap.has(oldEdge.source_node_id) && idMap.has(oldEdge.target_node_id)) {
                const newEdgeRef = doc(collection(db, `workspaces/${branchWsRef.id}/edges`));
                edgeWrites.push({
                    ref: newEdgeRef,
                    data: {
                        ...oldEdge,
                        id: newEdgeRef.id,
                        workspace_id: branchWsRef.id,
                        source_node_id: idMap.get(oldEdge.source_node_id),
                        target_node_id: idMap.get(oldEdge.target_node_id)
                    }
                });
            }
        }
    }

    // Batch execute all writes
    const allWrites = [...nodeWrites, ...edgeWrites];
    const chunks = chunkArray(allWrites, 500);
    for (const chunk of chunks) {
        const batch = writeBatch(db);
        chunk.forEach(w => batch.set(w.ref, w.data));
        await batch.commit();
    }

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
        is_deleted: false,
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
    const nodeWrites: { ref: any, data: any }[] = [];

    if (!nodesSnap.empty) {
        for (const docSnap of nodesSnap.docs) {
            const oldNode = docSnap.data();
            const newNodeRef = doc(collection(db, `workspaces/${newWsRef.id}/nodes`));
            idMap.set(docSnap.id, newNodeRef.id);

            nodeWrites.push({
                ref: newNodeRef,
                data: {
                    ...oldNode,
                    id: newNodeRef.id,
                    workspace_id: newWsRef.id
                }
            });
        }
    }

    const edgesQ = query(collection(db, `workspaces/${sourceId}/edges`));
    const edgesSnap = await getDocs(edgesQ);
    const edgeWrites: { ref: any, data: any }[] = [];

    if (!edgesSnap.empty) {
        for (const docSnap of edgesSnap.docs) {
            const oldEdge = docSnap.data();
            if (idMap.has(oldEdge.source_node_id) && idMap.has(oldEdge.target_node_id)) {
                const newEdgeRef = doc(collection(db, `workspaces/${newWsRef.id}/edges`));
                edgeWrites.push({
                    ref: newEdgeRef,
                    data: {
                        ...oldEdge,
                        id: newEdgeRef.id,
                        workspace_id: newWsRef.id,
                        source_node_id: idMap.get(oldEdge.source_node_id),
                        target_node_id: idMap.get(oldEdge.target_node_id)
                    }
                });
            }
        }
    }

    const allWrites = [...nodeWrites, ...edgeWrites];
    const chunks = chunkArray(allWrites, 500);
    for (const chunk of chunks) {
        const batch = writeBatch(db);
        chunk.forEach(w => batch.set(w.ref, w.data));
        await batch.commit();
    }

    return newWs;
}

export async function mergeWorkspaceBack(branchId: string): Promise<string> {
    const user = auth.currentUser;
    if (!user) throw new Error('Not authenticated');

    const branchRef = doc(db, 'workspaces', branchId);
    const branchSnap = await getDoc(branchRef);
    if (!branchSnap.exists()) throw new Error('Branch not found');

    const branchData = branchSnap.data() as Workspace;
    if (branchData.user_id !== user.uid) throw new Error('Permission denied');
    
    const parentId = branchData.parent_workspace_id;
    if (!parentId) throw new Error('Not a branch');

    const parentNodesSnap = await getDocs(query(collection(db, `workspaces/${parentId}/nodes`)));
    const parentEdgesSnap = await getDocs(query(collection(db, `workspaces/${parentId}/edges`)));

    // 1. Prepare deletes for parent
    const deleteRefs = [...parentNodesSnap.docs, ...parentEdgesSnap.docs].map(d => d.ref);
    
    // 2. Prepare copies from branch
    const branchNodesSnap = await getDocs(query(collection(db, `workspaces/${branchId}/nodes`)));
    const branchEdgesSnap = await getDocs(query(collection(db, `workspaces/${branchId}/edges`)));
    
    const idMap = new Map<string, string>();
    const nodeCopies: { ref: any, data: any }[] = [];
    
    branchNodesSnap.forEach(docSnap => {
        const oldNode = docSnap.data();
        const newNodeRef = doc(collection(db, `workspaces/${parentId}/nodes`));
        idMap.set(docSnap.id, newNodeRef.id);
        nodeCopies.push({
            ref: newNodeRef,
            data: { ...oldNode, id: newNodeRef.id, workspace_id: parentId }
        });
    });

    const edgeCopies: { ref: any, data: any }[] = [];
    branchEdgesSnap.forEach(docSnap => {
        const oldEdge = docSnap.data();
        if (idMap.has(oldEdge.source_node_id) && idMap.has(oldEdge.target_node_id)) {
            const newEdgeRef = doc(collection(db, `workspaces/${parentId}/edges`));
            edgeCopies.push({
                ref: newEdgeRef,
                data: {
                    ...oldEdge,
                    id: newEdgeRef.id,
                    workspace_id: parentId,
                    source_node_id: idMap.get(oldEdge.source_node_id),
                    target_node_id: idMap.get(oldEdge.target_node_id)
                }
            });
        }
    });

    // 3. Execute all in chunked batches
    // Optimization: If total ops <= 500, use ONE batch for true atomicity
    const allOps = [
        ...deleteRefs.map(ref => ({ type: 'delete', ref })),
        ...nodeCopies.map(w => ({ type: 'set', ref: w.ref, data: w.data })),
        ...edgeCopies.map(w => ({ type: 'set', ref: w.ref, data: w.data }))
    ];

    const chunks = chunkArray(allOps, 500);
    for (const chunk of chunks) {
        const batch = writeBatch(db);
        chunk.forEach(op => {
            const operation = op as any;
            if (operation.type === 'delete') {
                batch.delete(operation.ref);
            } else {
                batch.set(operation.ref, operation.data);
            }
        });
        
        // 3. drawings
        const now = new Date().toISOString();
        const drawingsSnapshot = await getDocs(collection(db, 'workspaces', branchId, 'drawings'));
        drawingsSnapshot.docs.forEach(docSnap => {
            batch.set(doc(collection(db, 'workspaces', parentId, 'drawings')), {
                ...docSnap.data(),
                updated_at: now
            });
        });

        
        await batch.commit();
    }

    // 4. Update parent timestamp
    await updateDoc(doc(db, 'workspaces', parentId), { updated_at: new Date().toISOString() });

    return parentId;
}
