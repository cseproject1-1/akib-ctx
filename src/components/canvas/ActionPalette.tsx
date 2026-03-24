import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useReactFlow, useNodes, type Node } from '@xyflow/react';
import { useCanvasStore } from '@/store/canvasStore';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
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

interface ActionPaletteProps {
  nodeWidth?: number;
  screenX?: number;
  screenY?: number;
}

export function ActionPalette({ nodeWidth = 0, screenX = 0, screenY = 0 }: ActionPaletteProps) {
  const activePalette = useCanvasStore((s) => s.activePalette);
  const setActivePalette = useCanvasStore((s) => s.setActivePalette);
  const isOpen = activePalette === 'action';
  const setIsOpen = useCallback((val: boolean) => setActivePalette(val ? 'action' : null), [setActivePalette]);

  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const nodes = useNodes();
  const selectedNode = nodes.find(n => n.selected);
  const { setNodes } = useReactFlow();
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const deleteNode = useCanvasStore((s) => s.deleteNode);
  const duplicateNode = useCanvasStore((s) => s.duplicateNode);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const toggleOpen = useCallback(() => setIsOpen(!isOpen), [isOpen, setIsOpen]);

// Removed automatic trigger on selection to prevent opening during drag/resize/rename
  // The palette should now only be opened via the Ctrl + / shortcut
  
  // Close the palette if the node is deselected
  useEffect(() => {
    if (!selectedNode && isOpen) {
      setIsOpen(false);
    }
  }, [selectedNode, isOpen, setIsOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === '/') {
        e.preventDefault();
        if (selectedNode) {
          toggleOpen();
        }
      }
      if (e.key === 'Escape') setIsOpen(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedNode, toggleOpen]);

  const actions: Action[] = useMemo(() => [
    {
      id: 'duplicate',
      label: 'Duplicate Node',
      icon: Copy,
      shortcut: 'D',
      handler: (n) => duplicateNode(n.id),
    },
    {
      id: 'lock',
      label: selectedNode?.data && typeof selectedNode.data === 'object' && 'locked' in selectedNode.data && selectedNode.data.locked ? 'Unlock Node' : 'Lock Node',
      icon: selectedNode?.data && typeof selectedNode.data === 'object' && 'locked' in selectedNode.data && selectedNode.data.locked ? Unlock : Lock,
      handler: (n) => {
        const isLocked = n.data && typeof n.data === 'object' && 'locked' in n.data ? n.data.locked : false;
        updateNodeData(n.id, { locked: !isLocked });
      },
    },
    {
      id: 'copy-id',
      label: 'Copy Node ID',
      icon: Anchor,
      handler: (n) => {
        navigator.clipboard.writeText(n.id).then(() => {
          toast.success('Copied ID to clipboard');
        }).catch(() => {
          toast.error('Failed to copy');
        });
      },
    },
    {
      id: 'ai-summarize',
      label: 'AI Summarize',
      icon: Sparkles,
      variant: 'ai',
      handler: (n) => {
        toast.info('AI is analyzing the node content...');
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
  ], [selectedNode, updateNodeData, duplicateNode, deleteNode, setNodes]);

  const filteredActions = useMemo(() => 
    actions.filter(a => a.label.toLowerCase().includes(search.toLowerCase())),
    [actions, search]
  );

  useEffect(() => {
    setSelectedIndex(0);
  }, [search]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  if (!selectedNode) return null;

  const menuWidth = 400;
  const menuLeft = Math.min(screenX, window.innerWidth - menuWidth);
  const menuTop = Math.min(screenY, window.innerHeight - 400);

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] bg-background/20 backdrop-blur-xl" 
            onClick={() => setIsOpen(false)}
          >
            <motion.div
              role="listbox"
              aria-label="Node actions"
              initial={{ opacity: 0, scale: 0.95, y: -20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -20 }}
              className="w-full max-w-md overflow-hidden rounded-[28px] glass-effect pro-shadow border border-white/10"
              style={{ left: menuLeft, top: menuTop }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-4 border-b border-white/5 p-5 bg-white/5">
                <div className="rounded-xl bg-primary/10 p-2 shadow-inner">
                  <Zap className="h-5 w-5 text-primary" />
                </div>
                <input
                  ref={inputRef}
                  autoFocus
                  placeholder="Type an action..."
                  className="w-full bg-transparent text-[15px] font-medium outline-none placeholder:text-muted-foreground/40"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && filteredActions.length > 0) {
                      filteredActions[selectedIndex]?.handler(selectedNode);
                      setIsOpen(false);
                    } else if (e.key === 'ArrowDown') {
                      e.preventDefault();
                      setSelectedIndex(prev => Math.min(prev + 1, filteredActions.length - 1));
                    } else if (e.key === 'ArrowUp') {
                      e.preventDefault();
                      setSelectedIndex(prev => Math.max(prev - 1, 0));
                    }
                  }}
                  aria-activedescendant={filteredActions[selectedIndex]?.id}
                />
              </div>

              <div className="max-h-[300px] overflow-y-auto p-2 scrollbar-none">
                {filteredActions.length > 0 ? (
                  <div className="space-y-0.5" role="group">
                    {filteredActions.map((action, index) => (
                      <motion.button
                        key={action.id}
                        id={action.id}
                        role="option"
                        aria-selected={index === selectedIndex}
                        whileHover={{ x: 4 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => {
                          action.handler(selectedNode);
                          setIsOpen(false);
                        }}
                        onMouseEnter={() => setSelectedIndex(index)}
                        className={cn(
                          "flex w-full items-center justify-between rounded-xl p-3 text-left transition-all",
                          index === selectedIndex ? "bg-white/10" : "hover:bg-white/10",
                          action.variant === 'destructive' ? 'text-destructive' : 
                          action.variant === 'ai' ? 'text-primary' : 'text-foreground'
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <action.icon className="h-4 w-4" />
                          <span className="text-[13px] font-medium">{action.label}</span>
                        </div>
                        {action.shortcut && (
                          <span className="rounded-lg bg-white/5 px-1.5 py-0.5 text-[9px] font-bold text-muted-foreground border border-white/5">
                            {action.shortcut}
                          </span>
                        )}
                      </motion.button>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center text-muted-foreground/50 font-medium text-xs tracking-widest uppercase">
                    No actions found
                  </div>
                )}
              </div>

              <div className="border-t border-white/5 bg-white/5 p-3 px-5 flex justify-between items-center">
                <div className="flex items-center gap-4 text-[9px] font-bold text-muted-foreground uppercase tracking-widest">
                    <span className="flex items-center gap-1.5 opacity-60"><span className="rounded-md bg-white/10 px-1.5 py-0.5 border border-white/5 text-foreground">↑↓</span> NAVIGATE</span>
                    <span className="flex items-center gap-1.5 opacity-60"><span className="rounded-md bg-white/10 px-1.5 py-0.5 border border-white/5 text-foreground">↵</span> SELECT</span>
                </div>
                <div className="text-[9px] font-bold text-primary flex items-center gap-1.5 tracking-widest uppercase">
                    <Eye className="h-3 w-3" /> ID: {selectedNode.id.slice(0, 8)}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
