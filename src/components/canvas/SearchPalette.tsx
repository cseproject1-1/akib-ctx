import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useReactFlow, useNodes, type Node } from '@xyflow/react';
import { Search, Clock, Filter, Tag, Hash, FileText, Image as ImageIcon, CheckCircle, Flame, Palette, type LucideIcon } from 'lucide-react';
import { useCanvasStore } from '@/store/canvasStore';

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

  if (!open) return null;

  const categories = Array.from(new Set(nodes.map(n => n.type))).filter(Boolean);

  return (
    <>
      <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setOpen(false)} />
      <div className="fixed left-1/2 top-[15%] z-[71] w-full max-w-lg -translate-x-1/2 rounded-xl border-2 border-border bg-card shadow-[var(--brutal-shadow-lg)] animate-slide-down overflow-hidden">
        {/* Search input */}
        <div className="flex items-center gap-3 border-b-2 border-border px-4 py-4">
          <Search className="h-5 w-5 text-muted-foreground" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelectedIdx(0); }}
            onKeyDown={handleResultKeyDown}
            placeholder="Search nodes, tags, content..."
            className="flex-1 bg-transparent text-base font-bold text-foreground outline-none placeholder:text-muted-foreground/50"
          />
          <kbd className="rounded border-2 border-border px-2 py-1 text-[10px] font-bold text-muted-foreground bg-accent/20">ESC</kbd>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 overflow-x-auto px-4 py-2 bg-muted/20 border-b border-border no-scrollbar focus:outline-none">
          <Filter className="h-3.5 w-3.5 text-muted-foreground mr-1 shrink-0" />
          <button
            onClick={() => setFilterType(null)}
            className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider transition-colors ${!filterType ? 'bg-primary text-primary-foreground' : 'bg-accent/50 text-muted-foreground hover:bg-accent'}`}
          >
            All
          </button>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setFilterType(cat === filterType ? null : (cat as string))}
              className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider whitespace-nowrap transition-colors ${filterType === cat ? 'bg-primary text-primary-foreground' : 'bg-accent/50 text-muted-foreground hover:bg-accent'}`}
            >
              {typeLabels[cat as string]?.label || cat}
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
            return (
              <button
                key={node.id}
                onClick={() => jumpToNode(node.id)}
                onMouseEnter={() => setSelectedIdx(idx)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition-all duration-150 group border-2 border-transparent ${
                  idx === selectedIdx ? 'bg-primary text-primary-foreground border-border translate-x-1 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,0.1)]' : 'hover:bg-accent/50 text-foreground'
                }`}
              >
                <div className={`p-2 rounded-md ${idx === selectedIdx ? 'bg-white/20' : 'bg-muted'}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className={`text-xs font-bold uppercase tracking-wider mb-0.5 ${idx === selectedIdx ? 'text-white/80' : 'text-muted-foreground'}`}>
                    {typeLabels[node.type || '']?.label || node.type}
                  </div>
                  <div className="truncate text-sm font-bold">
                    {getNodeTitle(node)}
                  </div>
                </div>
                <div className={`opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap text-[10px] font-bold px-2 py-1 rounded border overflow-hidden ${idx === selectedIdx ? 'border-white/20 bg-white/10' : 'border-border bg-card'}`}>
                  JUMP ↵
                </div>
              </button>
            )
          })}
        </div>
        
        <div className="border-t border-border px-4 py-2 bg-accent/20 flex justify-between items-center">
          <div className="flex gap-4 items-center">
             <span className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground">
                <kbd className="px-1 py-0.5 bg-card border border-border rounded">↑↓</kbd> Select
             </span>
             <span className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground">
                <kbd className="px-1 py-0.5 bg-card border border-border rounded">Enter</kbd> Jump
             </span>
          </div>
          <span className="text-[10px] font-bold text-muted-foreground uppercase opacity-50">
            {nodes.length} nodes indexed
          </span>
        </div>
      </div>
    </>
  );
}

