import { useState } from 'react';
import { GitBranch, Loader2, Merge, X } from 'lucide-react';
import { useCanvasStore } from '@/store/canvasStore';
import { branchWorkspace, mergeWorkspaceBack } from '@/lib/firebase/workspaces';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

interface BranchDialogProps {
  onClose: () => void;
  parentWorkspaceId?: string | null;
}

export function BranchDialog({ onClose, parentWorkspaceId }: BranchDialogProps) {
  const { workspaceId, workspaceName } = useCanvasStore();
  const [branchName, setBranchName] = useState(`${workspaceName} (branch)`);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleBranch = async () => {
    if (!workspaceId) return;
    setLoading(true);
    try {
      const ws = await branchWorkspace(workspaceId, branchName.trim() || 'Branch');
      toast.success('Branch created!');
      navigate(`/workspace/${ws.id}`);
      onClose();
    } catch {
      toast.error('Failed to create branch');
    } finally {
      setLoading(false);
    }
  };

  const handleMerge = async () => {
    if (!workspaceId) return;
    setLoading(true);
    try {
      const parentId = await mergeWorkspaceBack(workspaceId);
      toast.success('Merged back to parent!');
      navigate(`/workspace/${parentId}`);
      onClose();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to merge');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="w-96 rounded-xl border-2 border-border bg-card p-5 shadow-[var(--brutal-shadow)] animate-brutal-pop" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
            <GitBranch className="h-4 w-4 text-primary" />
            Branch Workspace
          </h3>
          <button onClick={onClose} className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Create branch */}
        <div className="mb-4">
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Branch Name
          </label>
          <input
            type="text"
            value={branchName}
            onChange={(e) => setBranchName(e.target.value)}
            className="w-full rounded-md border-2 border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
            placeholder="My experimental branch"
          />
          <button
            onClick={handleBranch}
            disabled={loading}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-primary-foreground transition-transform hover:scale-[1.02] active:scale-95 disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <GitBranch className="h-3.5 w-3.5" />}
            Create Branch
          </button>
        </div>

        {/* Merge back (only show if this is a branch) */}
        {parentWorkspaceId && (
          <>
            <div className="my-4 h-px bg-border" />
            <div>
              <p className="mb-2 text-xs text-muted-foreground">
                This workspace is a branch. You can merge it back to the parent, replacing all parent content with this branch's content.
              </p>
              <button
                onClick={handleMerge}
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-destructive bg-background px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-destructive transition-transform hover:scale-[1.02] active:scale-95 disabled:opacity-50"
              >
                {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Merge className="h-3.5 w-3.5" />}
                Merge Back to Parent
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
