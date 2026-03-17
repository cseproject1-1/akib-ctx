import React from 'react';
import { useCanvasStore } from '@/store/canvasStore';
import { X, Plus, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

export function WorkspaceTabs() {
  const openWorkspaces = useCanvasStore((s) => s.openWorkspaces);
  const removeOpenWorkspace = useCanvasStore((s) => s.removeOpenWorkspace);
  const workspaceId = useCanvasStore((s) => s.workspaceId);
  const workspaceName = useCanvasStore((s) => s.workspaceName);
  const workspaceColor = useCanvasStore((s) => s.workspaceColor);
  const addOpenWorkspace = useCanvasStore((s) => s.addOpenWorkspace);
  const navigate = useNavigate();

  // On mount, make sure current workspace is in the open list
  React.useEffect(() => {
    if (workspaceId && workspaceName) {
      addOpenWorkspace({ id: workspaceId, name: workspaceName, color: workspaceColor || 'default' });
    }
  }, [workspaceId, workspaceName, workspaceColor, addOpenWorkspace]);

  if (openWorkspaces.length <= 1) return null;

  return (
    <div className="absolute top-14 left-1/2 -translate-x-1/2 z-[50] flex items-center gap-1.5 px-2 py-1 bg-background/60 backdrop-blur-md rounded-full border border-border shadow-[var(--clay-shadow-sm)] pointer-events-auto">
      <AnimatePresence mode="popLayout" initial={false}>
        {openWorkspaces.map((ws) => (
          <motion.div
             key={ws.id}
             layout
             initial={{ opacity: 0, scale: 0.8 }}
             animate={{ opacity: 1, scale: 1 }}
             exit={{ opacity: 0, scale: 0.8 }}
              className={cn(
                "group relative flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all cursor-pointer select-none",
                ws.id === workspaceId 
                  ? "bg-card border-primary text-foreground shadow-[var(--clay-shadow-sm)]" 
                  : "bg-muted/30 border-transparent text-muted-foreground hover:bg-card hover:border-border hover:text-foreground"
              )}
             onClick={() => { if (ws.id !== workspaceId) navigate(`/workspace/${ws.id}`); }}
          >
            <div className={cn("w-2 h-2 rounded-full", ws.color !== 'default' ? `bg-${ws.color}-500/80` : "bg-primary/50")} />
            <span className="text-[10px] font-black uppercase tracking-widest truncate max-w-[120px]">{ws.name}</span>
            {ws.id !== workspaceId && (
              <button 
                onClick={(e) => { e.stopPropagation(); removeOpenWorkspace(ws.id); }}
                className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-destructive transition-opacity"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
      <div className="w-px h-4 bg-border mx-1" />
      <button 
        onClick={() => navigate('/')} 
        className="p-1 px-2 rounded-full hover:bg-accent text-muted-foreground transition-colors group"
        title="Open another workspace"
      >
        <Plus className="h-3 w-3 group-hover:rotate-90 transition-transform" />
      </button>
    </div>
  );
}
