import { useState, useEffect } from 'react';
import { X, Clock, RotateCcw, Trash2, Plus, Loader2 } from 'lucide-react';
import { useCanvasStore } from '@/store/canvasStore';
import { getSnapshots, createSnapshot, deleteSnapshot, pruneSnapshots } from '@/lib/firebase/canvasData';
import { auth } from '@/lib/firebase/client';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import type { Node, Edge } from '@xyflow/react';

interface Snapshot {
  id: string;
  name: string;
  nodes_data: unknown;
  edges_data: unknown;
  created_at: string;
}

export function VersionHistoryPanel() {
  const { workspaceId, nodes, edges, loadCanvas, setVersionHistoryOpen } = useCanvasStore();
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [customName, setCustomName] = useState('');

  const loadSnapshots = async () => {
    if (!workspaceId) return;
    try {
      const data = await getSnapshots(workspaceId);
      setSnapshots(data as Snapshot[]);
    } catch {
      toast.error('Failed to load versions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSnapshots();
  }, [workspaceId]);

  const handleSaveVersion = async () => {
    if (!workspaceId) return;
    setSaving(true);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('Not authenticated');
      const name = customName.trim() || `Manual save`;
      await createSnapshot(workspaceId, name, nodes as unknown[], edges as unknown[], user.uid);
      await pruneSnapshots(workspaceId, 50);
      setCustomName('');
      toast.success('Version saved');
      loadSnapshots();
    } catch {
      toast.error('Failed to save version');
    } finally {
      setSaving(false);
    }
  };

  const handleRestore = (snapshot: Snapshot) => {
    const restoredNodes = (snapshot.nodes_data as Node[]) || [];
    const restoredEdges = (snapshot.edges_data as Edge[]) || [];
    loadCanvas(restoredNodes, restoredEdges);
    toast.success(`Restored "${snapshot.name}"`);
  };

  const handleDelete = async (id: string) => {
    if (!workspaceId) return;
    try {
      await deleteSnapshot(workspaceId, id);
      setSnapshots(s => s.filter(snap => snap.id !== id));
      toast.success('Version deleted');
    } catch {
      toast.error('Failed to delete');
    }
  };

  return (
    <div className="fixed right-0 top-0 z-50 flex h-full w-80 flex-col border-l-2 border-border bg-card shadow-[var(--brutal-shadow)] animate-slide-left">
      <div className="flex items-center justify-between border-b-2 border-border px-4 py-3">
        <h3 className="text-sm font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
          <Clock className="h-4 w-4 text-primary" />
          Version History
        </h3>
        <button onClick={() => setVersionHistoryOpen(false)} className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Save new version */}
      <div className="border-b-2 border-border p-3">
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Version name (optional)"
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            className="flex-1 rounded-md border-2 border-border bg-background px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
          />
          <button
            onClick={handleSaveVersion}
            disabled={saving}
            className="flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-bold uppercase text-primary-foreground transition-transform hover:scale-105 active:scale-95 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
            Save
          </button>
        </div>
      </div>

      {/* Snapshots list */}
      <div className="flex-1 overflow-y-auto p-2">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : snapshots.length === 0 ? (
          <p className="py-8 text-center text-xs text-muted-foreground">No versions saved yet</p>
        ) : (
          <div className="flex flex-col gap-1">
            {snapshots.map((snap) => {
              const nodeCount = Array.isArray(snap.nodes_data) ? (snap.nodes_data as unknown[]).length : 0;
              return (
                <div
                  key={snap.id}
                  className="group flex items-center justify-between rounded-lg border-2 border-border bg-background px-3 py-2.5 transition-colors hover:border-primary/50"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold text-foreground">{snap.name}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {formatDistanceToNow(new Date(snap.created_at), { addSuffix: true })} · {nodeCount} node{nodeCount !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      onClick={() => handleRestore(snap)}
                      className="rounded-md p-1.5 text-primary hover:bg-accent"
                      title="Restore this version"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(snap.id)}
                      className="rounded-md p-1.5 text-destructive hover:bg-accent"
                      title="Delete this version"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
