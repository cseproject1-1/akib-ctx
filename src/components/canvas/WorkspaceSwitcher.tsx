import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, Plus, Loader2 } from 'lucide-react';
import { getWorkspaces, createWorkspace, type Workspace } from '@/lib/firebase/workspaces';
import { toast } from 'sonner';

interface WorkspaceSwitcherProps {
  currentId: string;
  currentName: string;
  currentColor: string;
}

export function WorkspaceSwitcher({ currentId, currentName, currentColor }: WorkspaceSwitcherProps) {
  const [open, setOpen] = useState(false);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (open) {
      setLoading(true);
      getWorkspaces()
        .then(setWorkspaces)
        .catch(() => toast.error('Failed to retrieve workspaces'))
        .finally(() => setLoading(false));
    }
  }, [open]);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const ws = await createWorkspace('Untitled', '#3b82f6');
      navigate(`/workspace/${ws.id}`);
      setOpen(false);
    } catch {
      toast.error('Failed to create workspace');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="brutal-btn flex items-center gap-2 rounded-lg bg-card px-3 py-1.5 text-sm font-bold uppercase tracking-wider text-foreground"
      >
        <span className="h-3 w-3 rounded border-2 border-border" style={{ backgroundColor: currentColor }} />
        <span className="max-w-[140px] truncate">{currentName}</span>
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-50" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full z-50 mt-2 w-56 rounded-lg border-2 border-border bg-card p-1.5 shadow-[4px_4px_0px_hsl(0,0%,15%)] animate-brutal-pop">
            {loading ? (
              <div className="flex justify-center p-4">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : workspaces.map((ws) => (
              <button
                key={ws.id}
                className={`flex w-full items-center gap-2.5 rounded-md px-3 py-2.5 text-sm font-semibold transition-colors ${ws.id === currentId
                    ? 'bg-primary text-primary-foreground'
                    : 'text-foreground hover:bg-accent'
                  }`}
                onClick={() => {
                  navigate(`/workspace/${ws.id}`);
                  setOpen(false);
                }}
              >
                <span className="h-2.5 w-2.5 rounded border border-border" style={{ backgroundColor: ws.color }} />
                <span className="truncate">{ws.name}</span>
              </button>
            ))}
            <div className="my-1 h-0.5 bg-border" />
            <button
              className="flex w-full items-center gap-2.5 rounded-md px-3 py-2.5 text-sm font-semibold text-primary transition-colors hover:bg-accent disabled:opacity-50"
              onClick={handleCreate}
              disabled={creating}
            >
              {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              New Workspace
            </button>
          </div>
        </>
      )}
    </div>
  );
}