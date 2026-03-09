import { useState, useEffect, useCallback, useRef } from 'react';
import { useReactFlow } from '@xyflow/react';
import { Search } from 'lucide-react';
import { useCanvasStore } from '@/store/canvasStore';

function extractTextFromTiptap(content: any): string {
  if (!content) return '';
  if (typeof content === 'string') return content;
  if (content.text) return content.text;
  if (content.content && Array.isArray(content.content)) {
    return content.content.map(extractTextFromTiptap).join(' ');
  }
  return '';
}

function getNodeSearchText(node: any): string {
  const d = node.data || {};
  const parts: string[] = [];
  if (d.title) parts.push(d.title);
  if (d.label) parts.push(d.label);
  if (d.content) parts.push(extractTextFromTiptap(d.content));
  if (d.bullets) parts.push((d.bullets as string[]).join(' '));
  if (d.questions) parts.push((d.questions as string[]).join(' '));
  if (d.fileName) parts.push(d.fileName);
  if (d.altText) parts.push(d.altText);
  if (d.year) parts.push(d.year);
  if (d.text) parts.push(d.text);
  if (d.latex) parts.push(d.latex);
  if (d.url) parts.push(d.url);
  if (d.tags) parts.push((d.tags as string[]).join(' '));
  if (d.flashcards) {
    (d.flashcards as any[]).forEach(f => {
      parts.push(f.question || '');
      parts.push(f.answer || '');
    });
  }
  if (d.headers) parts.push((d.headers as string[]).join(' '));
  return parts.join(' ').toLowerCase();
}

function getNodeTitle(node: any): string {
  const d = node.data || {};
  return d.title || d.label || d.fileName || d.altText || d.year || d.text?.slice(0, 40) || node.type || 'Untitled';
}

const typeLabels: Record<string, string> = {
  aiNote: 'Note',
  summary: 'Summary',
  termQuestion: 'Questions',
  lectureNotes: 'Lecture',
  pdf: 'PDF',
  image: 'Image',
  group: 'Group',
  flashcard: 'Flashcard',
  stickyNote: 'Sticky',
  checklist: 'Checklist',
  text: 'Text',
  shape: 'Shape',
  drawing: 'Drawing',
  embed: 'Embed',
  math: 'Math',
  video: 'Video',
  table: 'Table',
};

export function SearchPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const { nodes } = useCanvasStore();
  const reactFlow = useReactFlow();

  const toggle = useCallback(() => {
    setOpen(prev => {
      if (!prev) {
        setQuery('');
        setSelectedIdx(0);
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

  const results = query.length > 0
    ? nodes.filter(n => getNodeSearchText(n).includes(query.toLowerCase())).slice(0, 10)
    : [];

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

  return (
    <>
      <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setOpen(false)} />
      <div className="fixed left-1/2 top-[15%] z-[71] w-full max-w-md -translate-x-1/2 rounded-xl border-2 border-border bg-card shadow-[var(--brutal-shadow-lg)] animate-slide-down">
        {/* Search input */}
        <div className="flex items-center gap-3 border-b-2 border-border px-4 py-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelectedIdx(0); }}
            onKeyDown={handleResultKeyDown}
            placeholder="Search nodes…"
            className="flex-1 bg-transparent text-sm font-semibold text-foreground outline-none placeholder:text-muted-foreground"
          />
          <kbd className="rounded border-2 border-border px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground">ESC</kbd>
        </div>

        {/* Results */}
        <div className="max-h-[300px] overflow-y-auto p-1.5">
          {query.length === 0 && (
            <p className="px-3 py-6 text-center text-xs text-muted-foreground">
              Type to search across all nodes…
            </p>
          )}
          {query.length > 0 && results.length === 0 && (
            <p className="px-3 py-6 text-center text-xs text-muted-foreground">
              No nodes found
            </p>
          )}
          {results.map((node, idx) => (
            <button
              key={node.id}
              onClick={() => jumpToNode(node.id)}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-all duration-150 hover:bg-primary hover:text-primary-foreground hover:translate-x-1 ${
                idx === selectedIdx ? 'bg-accent' : ''
              }`}
            >
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {typeLabels[node.type || ''] || node.type}
              </span>
              <span className="flex-1 truncate text-sm font-semibold text-foreground">
                {getNodeTitle(node)}
              </span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
