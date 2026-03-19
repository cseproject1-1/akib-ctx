import { useState, useEffect, useCallback } from 'react';
import { useReactFlow, useNodes, type Node } from '@xyflow/react';
import { 
  Search, 
  Plus, 
  FileText, 
  Table, 
  Clock, 
  Sparkles, 
  Monitor, 
  Settings, 
  ChevronRight,
  Terminal,
  Layout,
  Type,
  Square,
  Image as ImageIcon,
  Flame,
  Palette,
  CheckCircle,
  Hash,
  Video,
  Database
} from 'lucide-react';
import { Command } from 'cmdk';
import { motion, AnimatePresence } from 'framer-motion';
import { useCanvasStore } from '@/store/canvasStore';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

export function CommandPalette() {
  const activePalette = useCanvasStore((s) => s.activePalette);
  const setActivePalette = useCanvasStore((s) => s.setActivePalette);
  const open = activePalette === 'command';
  const setOpen = (val: boolean | ((prev: boolean) => boolean)) => {
    if (typeof val === 'function') {
      setActivePalette(val(open) ? 'command' : null);
    } else {
      setActivePalette(val ? 'command' : null);
    }
  };
  const [search, setSearch] = useState('');
  const nodes = useNodes();
  const reactFlow = useReactFlow();
  const addNode = useCanvasStore((s) => s.addNode);
  const workspaceId = useCanvasStore((s) => s.workspaceId);
  const navigate = useNavigate();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  const runCommand = useCallback((command: () => void) => {
    command();
    setOpen(false);
  }, []);

  const handleAddNode = (type: any) => {
    const center = reactFlow.screenToFlowPosition({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    });
    
    const newNode: Node = {
      id: crypto.randomUUID(),
      type,
      position: center,
      data: {
        createdAt: new Date().toISOString(),
      },
    };

    addNode(newNode);
    setOpen(false);
  };

  const jumpToNode = (node: Node) => {
    reactFlow.setCenter(
      node.position.x + ((node.measured?.width || 300) / 2),
      node.position.y + ((node.measured?.height || 200) / 2),
      { zoom: 1.2, duration: 400 }
    );
    setOpen(false);
  };

  return (
    <AnimatePresence>
      {open && (
        <Command.Dialog
          open={open}
          onOpenChange={setOpen}
          label="Global Command Palette"
          className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] p-4 bg-background/20 backdrop-blur-xl"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            className="w-full max-w-2xl overflow-hidden rounded-[32px] glass-effect pro-shadow border border-white/10"
          >
            <div className="flex items-center gap-4 border-b border-white/5 px-6 py-5 bg-white/5">
              <Search className="h-5 w-5 text-primary" />
              <Command.Input
                value={search}
                onValueChange={setSearch}
                placeholder="Search anything... (nodes, tools, commands)"
                className="flex-1 bg-transparent text-[16px] font-medium text-foreground outline-none placeholder:text-muted-foreground/40"
              />
              <kbd className="hidden sm:inline-flex h-5 select-none items-center gap-1 rounded bg-white/5 px-1.5 font-mono text-[10px] font-medium text-muted-foreground/40 opacity-100 border border-white/5">ESC</kbd>
            </div>

            <Command.List className="max-h-[450px] overflow-y-auto p-3 space-y-2 scrollbar-none no-scrollbar">
              <Command.Empty className="flex flex-col items-center justify-center py-12 px-4 gap-2 text-muted-foreground">
                <Search className="h-8 w-8 opacity-20" />
                <p className="text-sm font-bold uppercase tracking-widest">No results found</p>
              </Command.Empty>

              <Command.Group heading={<span className="px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-primary/60">New Node</span>}>
                <Item onSelect={() => handleAddNode('aiNote')} icon={Sparkles} label="AI Note" shortcut="N" />
                <Item onSelect={() => handleAddNode('table')} icon={Table} label="Table Node" shortcut="T" />
                <Item onSelect={() => handleAddNode('databaseNode')} icon={Database} label="Database/Spreadsheet" />
                <Item onSelect={() => handleAddNode('dailyLog')} icon={Clock} label="Daily Log Node" />
                <Item onSelect={() => handleAddNode('stickyNote')} icon={Palette} label="Sticky Note" />
                <Item onSelect={() => handleAddNode('checklist')} icon={CheckCircle} label="Checklist" />
                <Item onSelect={() => handleAddNode('math')} icon={Hash} label="Math (Latex)" />
              </Command.Group>

              <Command.Separator className="h-px bg-white/5 my-2" />

              <Command.Group heading={<span className="px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-primary/60">Search Nodes</span>}>
                {nodes.slice(0, 10).map((node) => (
                  <Command.Item
                    key={node.id}
                    onSelect={() => jumpToNode(node)}
                    className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition-all duration-200 group relative aria-selected:bg-white/10 hover:bg-white/5 cursor-pointer"
                  >
                    <div className="p-2 rounded-xl bg-white/5 text-muted-foreground group-aria-selected:bg-primary/20 group-aria-selected:text-primary transition-all">
                      <FileText className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] font-bold uppercase tracking-widest mb-0.5 text-muted-foreground/40 group-aria-selected:text-primary/70">
                        {node.type}
                      </div>
                      <div className="truncate text-[14px] font-medium text-foreground/70 group-aria-selected:text-foreground">
                        {(node.data as any)?.title || (node.data as any)?.label || node.id.slice(0, 8)}
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground/20 group-aria-selected:text-primary transition-all" />
                  </Command.Item>
                ))}
              </Command.Group>

              <Command.Separator className="h-px bg-white/5 my-2" />

              <Command.Group heading={<span className="px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-primary/60">Navigation</span>}>
                <Item onSelect={() => navigate('/dashboard')} icon={Layout} label="Go to Dashboard" />
                <Item onSelect={() => setOpen(false)} icon={Settings} label="Open Settings" />
              </Command.Group>
            </Command.List>

            <div className="border-t border-white/5 px-6 py-4 bg-white/5 flex justify-between items-center">
              <div className="flex gap-5 items-center">
                 <span className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground/40 uppercase tracking-widest">
                    <kbd className="px-1.5 py-0.5 bg-white/5 border border-white/5 rounded-md text-foreground/60 transition-colors group-hover:bg-primary/20 group-hover:text-primary">↑↓</kbd> SELECT
                 </span>
                 <span className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground/40 uppercase tracking-widest">
                    <kbd className="px-1.5 py-0.5 bg-white/5 border border-white/5 rounded-md text-foreground/60">↵</kbd> EXECUTE
                 </span>
              </div>
              <span className="text-[10px] font-black tracking-widest text-primary/40 uppercase">
                CtxNote System
              </span>
            </div>
          </motion.div>
        </Command.Dialog>
      )}
    </AnimatePresence>
  );
}

function Item({ onSelect, icon: Icon, label, shortcut }: { onSelect: () => void, icon: any, label: string, shortcut?: string }) {
  return (
    <Command.Item
      onSelect={onSelect}
      className="flex w-full items-center justify-between rounded-2xl px-3 py-3 text-left transition-all duration-200 group relative aria-selected:bg-white/10 hover:bg-white/5 cursor-pointer"
    >
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl bg-white/5 text-muted-foreground group-aria-selected:bg-primary/20 group-aria-selected:text-primary transition-all">
          <Icon className="h-4 w-4" />
        </div>
        <span className="text-[14px] font-medium text-foreground/70 group-aria-selected:text-foreground">
          {label}
        </span>
      </div>
      {shortcut && (
        <kbd className="opacity-40 text-[10px] font-bold uppercase tracking-widest group-aria-selected:opacity-100 transition-all">
          {shortcut}
        </kbd>
      )}
    </Command.Item>
  );
}
