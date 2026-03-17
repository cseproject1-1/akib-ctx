import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Clock, 
  RotateCcw, 
  Trash2, 
  X, 
  Check,
  ChevronRight,
  Save
} from 'lucide-react';
import { useCanvasStore } from '@/store/canvasStore';
import { getSnapshots, createSnapshot, deleteSnapshot, pruneSnapshots } from '@/lib/firebase/canvasData';
import { auth } from '@/lib/firebase/client';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { useNodes, useEdges, type Node, type Edge } from '@xyflow/react';
import { cn } from '@/lib/utils';

interface Snapshot {
  id: string;
  name: string;
  nodes_data: unknown;
  edges_data: unknown;
  created_at: string;
}

interface MobileVersionHistoryProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MobileVersionHistory({ isOpen, onClose }: MobileVersionHistoryProps) {
  const workspaceId = useCanvasStore((s) => s.workspaceId);
  const nodes = useNodes();
  const edges = useEdges();
  const loadCanvas = useCanvasStore((s) => s.loadCanvas);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [customName, setCustomName] = useState('');

  const loadSnapshots = useCallback(async () => {
    if (!workspaceId) return;
    try {
      const data = await getSnapshots(workspaceId);
      setSnapshots(data as Snapshot[]);
    } catch {
      toast.error('Failed to load versions');
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    if (isOpen) {
      loadSnapshots();
    }
  }, [isOpen, loadSnapshots]);

  const handleSaveVersion = async () => {
    if (!workspaceId) return;
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('Not authenticated');
      const name = customName.trim() || `Version ${snapshots.length + 1}`;
      await createSnapshot(workspaceId, name, nodes as unknown[], edges as unknown[], user.uid);
      await pruneSnapshots(workspaceId, 50);
      setCustomName('');
      toast.success('Version saved');
      loadSnapshots();
    } catch {
      toast.error('Failed to save version');
    }
  };

  const handleRestore = (snapshot: Snapshot) => {
    const restoredNodes = (snapshot.nodes_data as Node[]) || [];
    const restoredEdges = (snapshot.edges_data as Edge[]) || [];
    loadCanvas(restoredNodes, restoredEdges);
    toast.success(`Restored "${snapshot.name}"`);
    onClose();
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

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/50 flex items-end justify-center"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          className="w-full max-w-lg bg-background rounded-t-3xl max-h-[80vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              <h2 className="font-semibold">Version History</h2>
            </div>
            <button onClick={onClose} className="p-2 rounded-full hover:bg-accent">
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Save New Version */}
          <div className="p-4 border-b">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Version name (optional)"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                className="flex-1 h-10 px-3 rounded-lg bg-accent/40 border border-transparent focus:border-primary/50 outline-none"
              />
              <button
                onClick={handleSaveVersion}
                className="px-4 h-10 rounded-lg bg-primary text-primary-foreground flex items-center gap-2"
              >
                <Save className="h-4 w-4" />
                Save
              </button>
            </div>
          </div>

          {/* Version List */}
          <div className="flex-1 overflow-y-auto p-2">
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin h-6 w-6 border-2 border-primary/20 border-t-primary rounded-full" />
              </div>
            ) : snapshots.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Clock className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No versions saved yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                <AnimatePresence>
                  {snapshots.map((snapshot) => (
                    <motion.div
                      key={snapshot.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-xl border bg-card",
                        "hover:border-primary/50 transition-colors"
                      )}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{snapshot.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(snapshot.created_at), { addSuffix: true })}
                        </p>
                      </div>
                      <button
                        onClick={() => handleRestore(snapshot)}
                        className="p-2 rounded-full hover:bg-primary/10 text-primary"
                        title="Restore"
                      >
                        <RotateCcw className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(snapshot.id)}
                        className="p-2 rounded-full hover:bg-destructive/10 text-destructive"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
