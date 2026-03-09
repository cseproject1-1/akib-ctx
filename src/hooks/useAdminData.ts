import { useState, useEffect, useCallback } from 'react';
import { db, auth } from '@/lib/firebase/client';
import { collection, getDocs, query, orderBy, doc, deleteDoc, getDoc, writeBatch, where } from 'firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { getAdminStorageStats, deleteWorkspaceFiles, deleteUserFiles } from '@/lib/r2/storage';

interface AdminStats {
  totalUsers: number;
  totalWorkspaces: number;
  totalNodes: number;
  totalStorageBytes: number;
  totalFiles: number;
}

interface AdminUser {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  email: string;
  created_at: string;
  workspace_count: number;
  roles: string[];
}

interface AdminWorkspace {
  id: string;
  name: string;
  color: string;
  user_id: string;
  owner_name: string;
  is_public: boolean;
  node_count: number;
  storage_bytes: number;
  created_at: string;
  updated_at: string;
}

interface StorageWorkspace {
  id: string;
  name: string;
  color: string;
  owner_name: string;
  storage_bytes: number;
  file_count: number;
}

interface AdminStorage {
  totalBytes: number;
  totalFiles: number;
  workspaces: StorageWorkspace[];
}

const ADMIN_EMAIL = 'mm.adnanakib@gmail.com';

export function useAdminCheck() {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user) { setIsAdmin(false); return; }
    setIsAdmin(user.email === ADMIN_EMAIL);
  }, [user]);

  return isAdmin;
}

export function useAdminStats() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetch_ = useCallback(async () => {
    try {
      setLoading(true);
      const [usersSnap, workspacesSnap, r2Stats] = await Promise.all([
        getDocs(collection(db, 'users')),
        getDocs(collection(db, 'workspaces')),
        getAdminStorageStats()
      ]);

      setStats({
        totalUsers: usersSnap.size,
        totalWorkspaces: workspacesSnap.size,
        totalNodes: 0, // Would require querying all subcollections
        totalStorageBytes: r2Stats.totalBytes,
        totalFiles: r2Stats.totalFiles,
      });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch_(); }, [fetch_]);
  return { stats, loading, refetch: fetch_ };
}

export function useAdminUsers() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch_ = useCallback(async () => {
    try {
      setLoading(true);
      const snap = await getDocs(query(collection(db, 'users')));
      const usersList = snap.docs.map(d => ({
        id: d.id,
        ...d.data(),
        email: d.data().email || 'N/A',
        workspace_count: 0,
        roles: d.data().role ? [d.data().role] : ['user']
      })) as AdminUser[];
      setUsers(usersList);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteUser = useCallback(async (userId: string) => {
    try {
      toast.loading('Deleting user and cleaning up storage...', { id: 'delete-user' });

      // 1. Delete all user files from R2
      await deleteUserFiles(userId);

      // 2. Delete all workspaces owned by the user
      const wsSnap = await getDocs(query(collection(db, 'workspaces'), where('user_id', '==', userId)));
      const deletePromises = wsSnap.docs.map(d => deleteDoc(d.ref));
      await Promise.all(deletePromises);

      // 3. Delete user profile doc
      await deleteDoc(doc(db, 'users', userId));

      toast.success('User and all associated data deleted', { id: 'delete-user' });
      fetch_();
    } catch (e: any) {
      toast.error(e.message, { id: 'delete-user' });
    }
  }, [fetch_]);

  useEffect(() => { fetch_(); }, [fetch_]);
  return { users, loading, deleteUser, refetch: fetch_ };
}

export function useAdminWorkspaces() {
  const [workspaces, setWorkspaces] = useState<AdminWorkspace[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch_ = useCallback(async () => {
    try {
      setLoading(true);
      const [snap, r2Stats] = await Promise.all([
        getDocs(query(collection(db, 'workspaces'))),
        getAdminStorageStats()
      ]);
      const wsList = snap.docs.map(d => ({
        id: d.id,
        ...d.data(),
        owner_name: 'Unknown',
        node_count: 0,
        storage_bytes: r2Stats.workspaceMap[d.id]?.bytes || 0
      })) as AdminWorkspace[];
      setWorkspaces(wsList);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteWorkspace = useCallback(async (workspaceId: string) => {
    try {
      toast.loading('Deleting workspace and files...', { id: 'delete-ws' });

      // 1. Delete R2 files
      await deleteWorkspaceFiles(workspaceId);

      // 2. Delete Firestore subcollections (Nodes, Edges, Snapshots)
      // Note: In production, large collections should be deleted via Cloud Function or Batch
      const subcollections = ['nodes', 'edges', 'snapshots'];
      for (const sub of subcollections) {
        const snap = await getDocs(collection(db, `workspaces/${workspaceId}/${sub}`));
        if (!snap.empty) {
          const batch = writeBatch(db);
          snap.docs.forEach(d => batch.delete(d.ref));
          await batch.commit();
        }
      }

      // 3. Delete main workspace doc
      await deleteDoc(doc(db, 'workspaces', workspaceId));

      toast.success('Workspace permanently deleted', { id: 'delete-ws' });
      fetch_();
    } catch (e: any) {
      toast.error(e.message, { id: 'delete-ws' });
    }
  }, [fetch_]);

  useEffect(() => { fetch_(); }, [fetch_]);
  return { workspaces, loading, deleteWorkspace, refetch: fetch_ };
}

export function useAdminStorage() {
  const [storage, setStorage] = useState<AdminStorage | null>(null);
  const [loading, setLoading] = useState(true);

  const fetch_ = useCallback(async () => {
    try {
      setLoading(true);
      const [snap, r2Stats] = await Promise.all([
        getDocs(query(collection(db, 'workspaces'))),
        getAdminStorageStats()
      ]);
      const wsMap = new Map();
      snap.docs.forEach(d => wsMap.set(d.id, d.data()));

      const storageWorkspaces = Object.keys(r2Stats.workspaceMap).map(wsId => {
        const data = wsMap.get(wsId);
        return {
          id: wsId,
          name: data?.name || 'Unknown Workspace',
          color: data?.color || '#cccccc',
          owner_name: data?.owner_name || 'Unknown',
          storage_bytes: r2Stats.workspaceMap[wsId].bytes,
          file_count: r2Stats.workspaceMap[wsId].count,
        };
      });

      setStorage({
        totalBytes: r2Stats.totalBytes,
        totalFiles: r2Stats.totalFiles,
        workspaces: storageWorkspaces.sort((a, b) => b.storage_bytes - a.storage_bytes)
      });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch_(); }, [fetch_]);
  return { storage, loading, refetch: fetch_ };
}
