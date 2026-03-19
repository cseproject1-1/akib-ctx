import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, Plus, Loader2 } from 'lucide-react';
import { getWorkspaces, createWorkspace, type Workspace } from '@/lib/firebase/workspaces';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

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
  const [menuPos, setMenuPos] = useState({ left: 0, top: 0, overflowRight: false, overflowBottom: false });
  const buttonRef = useRef<HTMLButtonElement>(null);
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

  useEffect(() => {
    if (open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const menuWidth = 280;
      const menuHeight = 350;
      setMenuPos({
        left: rect.left,
        top: rect.bottom + 8,
        overflowRight: rect.left + menuWidth > window.innerWidth,
        overflowBottom: rect.bottom + 8 + menuHeight > window.innerHeight,
      });
    }
  }, [open]);

  const handleCreate = async () => {
    if (creating) return;
    setCreating(true);
    try {
      const ws = await createWorkspace('Untitled', '#3b82f6');
      setOpen(false);
      navigate(`/workspace/${ws.id}`);
    } catch {
      toast.error('Failed to create workspace');
    } finally {
      setCreating(false);
    }
  };

  const handleSelectWorkspace = (ws: Workspace) => {
    if (ws.id === currentId) {
      setOpen(false);
      return;
    }
    navigate(`/workspace/${ws.id}`);
    setOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setOpen(false);
    } else if (e.key === 'Enter' || e.key === ' ') {
      setOpen(!open);
    }
  };

  return (
    <div className="relative">
      <motion.button
        ref={buttonRef}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => setOpen(!open)}
        onKeyDown={handleKeyDown}
        className="glass-effect pro-shadow flex items-center gap-2.5 rounded-xl px-4 py-2 text-[13px] font-semibold text-foreground transition-all"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="h-2.5 w-2.5 rounded-full border border-white/20" style={{ backgroundColor: currentColor, boxShadow: `0 0 8px ${currentColor}40` }} />
        <span className="max-w-[140px] truncate" title={currentName}>{currentName}</span>
        <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform duration-200", open && "rotate-180")} />
      </motion.button>

      <AnimatePresence>
        {open && (
          <>
            <div 
              className="fixed inset-0 z-[60]" 
              onClick={(e) => { e.stopPropagation(); setOpen(false); }}
              aria-hidden="true"
            />
            <motion.div
              role="listbox"
              aria-label="Select workspace"
              initial={{ opacity: 0, y: 8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.95 }}
              className={cn(
                "absolute z-[70] mt-2 w-64 rounded-2xl glass-effect p-1.5 pro-shadow",
                menuPos.overflowRight ? "right-0" : "left-0"
              )}
              style={{ 
                top: menuPos.overflowBottom ? undefined : menuPos.top,
                bottom: menuPos.overflowBottom ? window.innerHeight - (buttonRef.current?.getBoundingClientRect().top || 0) + 8 : undefined,
                maxHeight: menuPos.overflowBottom ? window.innerHeight - (buttonRef.current?.getBoundingClientRect().top || 0) - 16 : undefined,
              }}
            >
              <div className="px-3 py-2 text-[10px] font-bold text-muted-foreground uppercase tracking-widest border-b border-border/40 mb-1">
                Workspaces
              </div>
              <div className="max-h-64 overflow-y-auto scrollbar-none space-y-0.5">
                {loading ? (
                  <div className="flex justify-center p-4">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  </div>
                ) : workspaces.length === 0 ? (
                  <div className="p-4 text-center text-[11px] text-muted-foreground/50 font-medium">
                    No workspaces yet
                  </div>
                ) : workspaces.map((ws) => (
                  <button
                    key={ws.id}
                    role="option"
                    aria-selected={ws.id === currentId}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-all",
                      ws.id === currentId
                        ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                        : "text-foreground hover:bg-white/10"
                    )}
                    onClick={() => handleSelectWorkspace(ws)}
                  >
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: ws.color }} />
                    <span className="truncate">{ws.name}</span>
                  </button>
                ))}
              </div>
              <div className="my-1 h-px bg-border/40" />
              <button
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-semibold text-primary transition-all hover:bg-primary/10 disabled:opacity-50"
                onClick={handleCreate}
                disabled={creating}
                aria-busy={creating}
              >
                {creating ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus className="h-3.5 w-3.5" />
                    New Workspace
                  </>
                )}
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}