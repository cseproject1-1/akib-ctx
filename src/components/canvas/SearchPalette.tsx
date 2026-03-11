import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useReactFlow, useNodes, type Node } from '@xyflow/react';
import { Search, Clock, Filter, Tag, Hash, FileText, Image as ImageIcon, CheckCircle, Flame, Palette, type LucideIcon, ArrowRight } from 'lucide-react';
import { useCanvasStore } from '@/store/canvasStore';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

function extractTextFromTiptap(content: unknown): string {
  if (!content) return '';
  if (typeof content === 'string') return content;
  if (typeof content === 'object' && content !== null) {
    const c = content as { text?: string; content?: unknown[] };
    if (c.text) return c.text;
    if (c.content && Array.isArray(c.content)) {
      return c.content.map(extractTextFromTiptap).join(' ');
    }
  }
  return '';
}

interface NodeData {
  title?: string;
  label?: string;
  content?: unknown;
  bullets?: string[];
  questions?: string[];
  fileName?: string;
  altText?: string;
  year?: string;
  text?: string;
  latex?: string;
  url?: string;
  tags?: string[];
  flashcards?: Array<{ question: string; answer: string }>;
  headers?: string[];
}

function getNodeSearchText(node: Node): string {
  const d = node.data as NodeData || {};
  const parts: string[] = [];
  if (d.title) parts.push(d.title);
  if (d.label) parts.push(d.label);
  if (d.content) parts.push(extractTextFromTiptap(d.content));
  if (d.bullets) parts.push(d.bullets.join(' '));
  if (d.questions) parts.push(d.questions.join(' '));
  if (d.fileName) parts.push(d.fileName);
  if (d.altText) parts.push(d.altText);
  if (d.year) parts.push(d.year);
  if (d.text) parts.push(d.text);
  if (d.latex) parts.push(d.latex);
  if (d.url) parts.push(d.url);
  if (d.tags) parts.push(d.tags.join(' '));
  if (d.flashcards) {
    d.flashcards.forEach(f => {
      parts.push(f.question || '');
      parts.push(f.answer || '');
    });
  }
  if (d.headers) parts.push(d.headers.join(' '));
  return parts.join(' ').toLowerCase();
}

function getNodeTitle(node: Node): string {
  const d = node.data as NodeData || {};
  return d.title || d.label || d.fileName || d.altText || d.year || d.text?.slice(0, 40) || node.type || 'Untitled';
}

const typeLabels: Record<string, { label: string; icon: LucideIcon }> = {
  aiNote: { label: 'Note', icon: FileText },
  summary: { label: 'Summary', icon: FileText },
  termQuestion: { label: 'Questions', icon: FileText },
  lectureNotes: { label: 'Lecture', icon: FileText },
  pdf: { label: 'PDF', icon: FileText },
  image: { label: 'Image', icon: ImageIcon },
  group: { label: 'Group', icon: FileText },
  flashcard: { label: 'Flashcard', icon: Flame },
  stickyNote: { label: 'Sticky', icon: Palette },
  checklist: { label: 'Checklist', icon: CheckCircle },
  text: { label: 'Text', icon: FileText },
  shape: { label: 'Shape', icon: FileText },
  drawing: { label: 'Drawing', icon: Palette },
  embed: { label: 'Embed', icon: FileText },
  math: { label: 'Math', icon: Hash },
  video: { label: 'Video', icon: FileText },
  table: { label: 'Table', icon: FileText },
};

export function SearchPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [filterType, setFilterType] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const nodes = useNodes();
  const reactFlow = useReactFlow();

  const toggle = useCallback(() => {
    setOpen(prev => {
      if (!prev) {
        setQuery('');
        setSelectedIdx(0);
        setFilterType(null);
        setTimeout(() => inputRef.current?.focus(), 50);
      }
      return !prev;
    });
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        toggle();
      }
      if (e.key === 'Escape' && open) {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, toggle]);

  const results = useMemo(() => {
    let filtered = nodes;
    if (filterType) {
      filtered = filtered.filter(n => n.type === filterType);
    }
    
    if (query.length > 0) {
      return filtered.filter(n => getNodeSearchText(n).includes(query.toLowerCase())).slice(0, 10);
    }
    
    // Default: Sort by some "recency" or just return first 5
    return filtered.slice(0, 5);
  }, [nodes, query, filterType]);

  const jumpToNode = (nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    reactFlow.setCenter(
      node.position.x + ((node.style?.width as number) || 300) / 2,
      node.position.y + ((node.style?.height as number) || 200) / 2,
      { zoom: 1.2, duration: 400 }
    );
    setOpen(false);
  };

  const handleResultKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIdx(i => Math.min(i + 1, results.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIdx(i => Math.max(i - 1, 0)); }
    if (e.key === 'Enter' && results[selectedIdx]) { jumpToNode(results[selectedIdx].id); }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] bg-background/20 backdrop-blur-xl" 
            onClick={() => setOpen(false)} 
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            className="fixed left-1/2 top-[15%] z-[71] w-full max-w-lg -translate-x-1/2 rounded-[32px] glass-effect pro-shadow border border-white/10 overflow-hidden"
          >
        {/* Search input */}
        <div className="flex items-center gap-4 border-b border-white/5 px-6 py-5 bg-white/5">
          <Search className="h-5 w-5 text-primary" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelectedIdx(0); }}
            onKeyDown={handleResultKeyDown}
            placeholder="Search nodes, tags, content..."
            className="flex-1 bg-transparent text-[15px] font-medium text-foreground outline-none placeholder:text-muted-foreground/40"
          />
          <kbd className="hidden sm:inline-flex h-5 select-none items-center gap-1 rounded bg-white/5 px-1.5 font-mono text-[10px] font-medium text-muted-foreground/40 opacity-100 border border-white/5">ESC</kbd>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto px-6 py-2 bg-white/5 border-b border-white/5 scrollbar-none no-scrollbar focus:outline-none">
          <Filter className="h-3.5 w-3.5 text-muted-foreground/40 mr-1 shrink-0" />
          <button
            onClick={() => setFilterType(null)}
            className={cn(
                "px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all",
                !filterType ? "bg-primary/20 text-primary ring-1 ring-primary/20" : "text-muted-foreground/60 hover:text-foreground"
            )}
          >
            All
          </button>
          {Array.from(new Set(nodes.map(n => n.type))).filter(Boolean).map(cat => (
            <button
              key={cat as string}
              onClick={() => setFilterType((cat as string) === filterType ? null : (cat as string))}
              className={cn(
                "px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider whitespace-nowrap transition-all",
                filterType === cat ? "bg-primary/20 text-primary ring-1 ring-primary/20" : "text-muted-foreground/60 hover:text-foreground"
              )}
            >
              {typeLabels[cat as string]?.label || (cat as string)}
            </button>
          ))}
        </div>

        {/* Results */}
        <div className="max-h-[400px] overflow-y-auto p-2 space-y-1">
          {query.length === 0 && !filterType && (
            <div className="flex items-center gap-2 px-3 py-2 text-[10px] font-bold uppercase text-muted-foreground/60">
              <Clock className="h-3 w-3" /> Recent Nodes
            </div>
          )}
          {results.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 px-4 gap-2 text-muted-foreground">
              <Search className="h-8 w-8 opacity-20" />
              <p className="text-xs font-bold uppercase tracking-widest">No matching nodes found</p>
            </div>
          )}
          {results.map((node, idx) => {
            const Icon = typeLabels[node.type || '']?.icon || FileText;
            const isSelected = idx === selectedIdx;
            return (
              <motion.button
                key={node.id}
                initial={false}
                animate={isSelected ? { x: 4 } : { x: 0 }}
                onClick={() => jumpToNode(node.id)}
                onMouseEnter={() => setSelectedIdx(idx)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition-all duration-200 group relative",
                  isSelected ? "bg-white/10" : "hover:bg-white/5"
                )}
              >
                <div className={cn(
                    "p-2.5 rounded-xl transition-all",
                    isSelected ? "bg-primary/20 text-primary shadow-lg shadow-primary/20" : "bg-white/5 text-muted-foreground"
                )}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className={cn(
                      "text-[10px] font-bold uppercase tracking-widest mb-0.5",
                      isSelected ? "text-primary/70" : "text-muted-foreground/40"
                  )}>
                    {typeLabels[node.type || '']?.label || node.type}
                  </div>
                  <div className={cn(
                      "truncate text-[13px] font-medium",
                      isSelected ? "text-foreground" : "text-foreground/70"
                  )}>
                    {getNodeTitle(node)}
                  </div>
                </div>
                <div className={cn(
                    "opacity-0 transition-all flex items-center gap-2 text-[9px] font-bold uppercase tracking-[2px] text-primary pr-2",
                    isSelected && "opacity-100"
                )}>
                  JUMP <ArrowRight className="h-3 w-3" />
                </div>
              </motion.button>
            )
          })}
        </div>
        
        <div className="border-t border-white/5 px-6 py-3 bg-white/5 flex justify-between items-center mt-1">
          <div className="flex gap-5 items-center">
             <span className="flex items-center gap-2 text-[9px] font-bold text-muted-foreground/40 uppercase tracking-widest">
                <kbd className="px-1.5 py-0.5 bg-white/5 border border-white/5 rounded-md text-foreground/60">↑↓</kbd> SELECT
             </span>
             <span className="flex items-center gap-2 text-[9px] font-bold text-muted-foreground/40 uppercase tracking-widest">
                <kbd className="px-1.5 py-0.5 bg-white/5 border border-white/5 rounded-md text-foreground/60">↵</kbd> JUMP
             </span>
          </div>
          <span className="text-[9px] font-black tracking-widest text-primary/40 uppercase">
            {nodes.length} INDEXED
          </span>
        </div>
      </motion.div>
    </>
      )}
    </AnimatePresence>
  );
}

