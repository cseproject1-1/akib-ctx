import { useState, useEffect, useRef, useCallback } from 'react';
import { useReactFlow, useNodes, type Node } from '@xyflow/react';
import { useCanvasStore } from '@/store/canvasStore';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Zap, 
  Copy, 
  Trash2, 
  FileJson, 
  FileText, 
  Sparkles, 
  ArrowLeftRight, 
  Anchor, 
  ExternalLink, 
  Scissors,
  Share2,
  Lock,
  Unlock,
  Eye
} from 'lucide-react';
import { toast } from 'sonner';
import { LucideIcon } from 'lucide-react';

interface Action {
  id: string;
  label: string;
  icon: LucideIcon;
  shortcut?: string;
  handler: (node: Node) => void;
  variant?: 'default' | 'destructive' | 'ai';
}

export function ActionPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const nodes = useNodes();
  const selectedNode = nodes.find(n => n.selected);
  const { flowToScreenPosition, setNodes } = useReactFlow();
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const deleteNode = useCanvasStore((s) => s.deleteNode);
  const duplicateNode = useCanvasStore((s) => s.duplicateNode);

  const containerRef = useRef<HTMLDivElement>(null);

  const toggleOpen = useCallback(() => setIsOpen(prev => !prev), []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === '/') {
        e.preventDefault();
        if (selectedNode) toggleOpen();
      }
      if (e.key === 'Escape') setIsOpen(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedNode, toggleOpen]);

  const actions: Action[] = [
    {
      id: 'duplicate',
      label: 'Duplicate Node',
      icon: Copy,
      shortcut: 'D',
      handler: (n) => duplicateNode(n.id),
    },
    {
      id: 'lock',
      label: (selectedNode?.data as { locked?: boolean })?.locked ? 'Unlock Node' : 'Lock Node',
      icon: (selectedNode?.data as { locked?: boolean })?.locked ? Unlock : Lock,
      handler: (n) => updateNodeData(n.id, { locked: !(n.data as { locked?: boolean })?.locked }),
    },
    {
      id: 'copy-id',
      label: 'Copy Node ID',
      icon: Anchor,
      handler: (n) => {
        navigator.clipboard.writeText(n.id);
        toast.success('Copied ID to clipboard');
      },
    },
    {
      id: 'ai-summarize',
      label: 'AI Summarize',
      icon: Sparkles,
      variant: 'ai',
      handler: (n) => {
        toast.info('AI is analyzing the node content...');
        // Mock AI logic
      },
    },
    {
        id: 'convert-sticky',
        label: 'Convert to Sticky Note',
        icon: ArrowLeftRight,
        handler: (n) => {
            setNodes(nds => nds.map(node => node.id === n.id ? { ...node, type: 'stickyNote' } : node));
            toast.success('Converted to Sticky Note');
        }
    },
    {
      id: 'export-json',
      label: 'Export as JSON',
      icon: FileJson,
      handler: (n) => {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(n, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", `node-${n.id}.json`);
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
      },
    },
    {
      id: 'delete',
      label: 'Delete Node',
      icon: Trash2,
      shortcut: 'DEL',
      variant: 'destructive',
      handler: (n) => {
        deleteNode(n.id);
        setIsOpen(false);
      },
    },
  ];

  const filteredActions = actions.filter(a => 
    a.label.toLowerCase().includes(search.toLowerCase())
  );

  if (!selectedNode) return null;

  const nodeWidth = (selectedNode.measured?.width ?? selectedNode.width ?? 200) as number;
  const screenPos = flowToScreenPosition({
    x: selectedNode.position.x + nodeWidth / 2,
    y: selectedNode.position.y + (selectedNode.measured?.height ?? selectedNode.height ?? 100),
  });

  return (
    <>
      {/* Trigger in NodeSelectionToolbar would be better, but we can also have it here if needed */}
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-[2000] flex items-start justify-center pt-[15vh] bg-background/20 backdrop-blur-[2px]" onClick={() => setIsOpen(false)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -20 }}
              className="w-full max-w-md overflow-hidden rounded-xl border-2 border-border bg-card shadow-[var(--brutal-shadow-lg)]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 border-b-2 border-border p-4">
                <Zap className="h-5 w-5 text-primary" />
                <input
                  autoFocus
                  placeholder="Type an action..."
                  className="w-full bg-transparent text-lg font-bold outline-none placeholder:text-muted-foreground"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && filteredActions.length > 0) {
                      filteredActions[0].handler(selectedNode);
                      setIsOpen(false);
                    }
                  }}
                />
              </div>

              <div className="max-h-[300px] overflow-y-auto p-2 scrollbar-none">
                {filteredActions.length > 0 ? (
                  filteredActions.map((action) => (
                    <button
                      key={action.id}
                      onClick={() => {
                        action.handler(selectedNode);
                        setIsOpen(false);
                      }}
                      className={`flex w-full items-center justify-between rounded-lg p-3 text-left transition-colors ${
                        action.variant === 'destructive' 
                          ? 'hover:bg-destructive/10 text-destructive' 
                          : action.variant === 'ai'
                          ? 'hover:bg-primary/10 text-primary'
                          : 'hover:bg-accent text-foreground'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <action.icon className="h-4 w-4" />
                        <span className="font-bold uppercase tracking-wider text-xs">{action.label}</span>
                      </div>
                      {action.shortcut && (
                        <span className="text-[10px] font-bold text-muted-foreground opacity-50">{action.shortcut}</span>
                      )}
                    </button>
                  ))
                ) : (
                  <div className="p-8 text-center text-muted-foreground font-medium">
                    No actions found for "{search}"
                  </div>
                )}
              </div>

              <div className="border-t-2 border-border bg-muted/30 p-2 px-4 flex justify-between items-center">
                <div className="flex items-center gap-4 text-[10px] font-bold text-muted-foreground uppercase">
                    <span className="flex items-center gap-1"><span className="rounded bg-border px-1">↑↓</span> Navigate</span>
                    <span className="flex items-center gap-1"><span className="rounded bg-border px-1">↵</span> Select</span>
                </div>
                <div className="text-[10px] font-bold text-primary flex items-center gap-1">
                    <Eye className="h-3 w-3" /> NODE ID: {selectedNode.id.slice(0, 8)}...
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Trigger Button - Floating near node when selected */}
      {!isOpen && (
        <div 
          className="fixed z-[1001] pointer-events-none"
          style={{ 
            left: screenPos.x, 
            top: screenPos.y + 12, 
            transform: 'translateX(-50%)' 
          }}
        >
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="pointer-events-auto flex items-center gap-1.5 rounded-full border-2 border-border bg-card px-3 py-1 text-[10px] font-bold uppercase tracking-tighter shadow-sm hover:border-primary hover:text-primary transition-all active:scale-95"
            onClick={toggleOpen}
            title="Action Palette (Ctrl+/)"
          >
            <Zap className="h-3 w-3" />
            Actions
          </motion.button>
        </div>
      )}
    </>
  );
}
