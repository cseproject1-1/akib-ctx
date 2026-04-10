import { useCanvasStore } from '@/store/canvasStore';
import { useNodes } from '@xyflow/react';
import { HybridEditor, type NoteEditorHandle } from '@/components/editor/HybridEditor';
import { getEditorVersion } from '@/lib/editor/migration';
import { useSettingsStore } from '@/store/settingsStore';
import { OutlinePanel } from '@/components/tiptap/OutlinePanel';
import { X, Maximize2, Minimize2, List as ListIcon, ChevronRight, ChevronLeft, Share2, LayoutList } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { Drawer } from 'vaul';
import { useIsMobile } from '@/hooks/use-mobile';
import type { JSONContent } from '@tiptap/react';
import katex from 'katex';
import { cn } from '@/lib/utils';
import { extractText } from '@/lib/utils/contentParser';
import { LinkPreview, LinkMetadata } from '@/components/canvas/LinkPreview';
import { fetchLinkMetadata } from '@/lib/metadataService';
import { getEmbedConfig, isRestrictedSite } from '@/lib/utils/embedUtils';


/* ─── Expandable node types ─── */
const EXPANDABLE_TYPES = ['aiNote', 'lectureNotes', 'checklist', 'summary', 'codeSnippet', 'math', 'termQuestion', 'stickyNote', 'flashcard', 'table', 'image', 'embed', 'drawing', 'video', 'text'];
const POSITION_THRESHOLD = 20;

/* ─── Checklist helpers ─── */
interface CheckItem { id: string; text: string; done: boolean; }

function countWords(content: any): { words: number; chars: number } {
  if (!content) return { words: 0, chars: 0 };
  try {
    const text = extractText(content);
    if (!text) return { words: 0, chars: 0 };
    const chars = text.length;
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    return { words, chars };
  } catch {
    return { words: 0, chars: 0 };
  }
}

function ChecklistFullscreen({ items, onUpdate, editable }: { items: CheckItem[]; onUpdate: (items: CheckItem[]) => void; editable: boolean }) {
  const toggle = (itemId: string) => editable && onUpdate(items.map(i => i.id === itemId ? { ...i, done: !i.done } : i));
  const updateText = (itemId: string, text: string) => editable && onUpdate(items.map(i => i.id === itemId ? { ...i, text } : i));
  const add = () => editable && onUpdate([...items, { id: crypto.randomUUID(), text: '', done: false }]);
  const remove = (itemId: string) => editable && onUpdate(items.filter(i => i.id !== itemId));
  const doneCount = items.filter(i => i.done).length;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs text-muted-foreground font-bold mb-3">
        <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
          <div className="h-full bg-primary transition-all" style={{ width: `${items.length ? (doneCount / items.length) * 100 : 0}%` }} />
        </div>
        {doneCount}/{items.length}
      </div>
      {items.map(item => (
        <div key={item.id} className="flex items-center gap-3 group">
          <button
            onClick={() => toggle(item.id)}
            disabled={!editable}
            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors ${item.done ? 'border-primary bg-primary text-primary-foreground' : 'border-border'} ${!editable ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {item.done && <span className="text-xs font-bold">✓</span>}
          </button>
          <input
            className={`flex-1 bg-transparent text-sm outline-none ${item.done ? 'line-through text-muted-foreground' : 'text-foreground'} ${!editable ? 'cursor-default' : ''}`}
            value={item.text}
            onChange={e => updateText(item.id, e.target.value)}
            placeholder="To-do item..."
            readOnly={!editable}
          />
          {editable && (
            <button onClick={() => remove(item.id)} className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      ))}
      {editable && (
        <button onClick={add} className="text-xs font-semibold text-muted-foreground hover:text-foreground mt-2">+ Add item</button>
      )}
    </div>
  );
}

function SummaryFullscreen({ bullets, onChange, editable }: { bullets: string[]; onChange: (b: string[]) => void; editable: boolean }) {
  const update = (i: number, v: string) => { if (!editable) return; const b = [...bullets]; b[i] = v; onChange(b); };
  const handleKey = (i: number, e: React.KeyboardEvent) => {
    if (!editable) return;
    if (e.key === 'Enter') { e.preventDefault(); const b = [...bullets]; b.splice(i + 1, 0, ''); onChange(b); }
    if (e.key === 'Backspace' && !bullets[i] && bullets.length > 1) { e.preventDefault(); onChange(bullets.filter((_, j) => j !== i)); }
  };
  return (
    <ul className="space-y-2">
      {bullets.map((b, i) => (
        <li key={i} className="flex items-start gap-3">
          <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary" />
          <input 
            className={`flex-1 bg-transparent text-sm text-foreground outline-none ${!editable ? 'cursor-default' : ''}`} 
            value={b} 
            onChange={e => update(i, e.target.value)} 
            onKeyDown={e => handleKey(i, e)} 
            placeholder="Type a point…" 
            readOnly={!editable}
          />
        </li>
      ))}
    </ul>
  );
}

function CodeFullscreen({ code, onChange, editable }: { code: string; onChange: (c: string) => void; editable: boolean }) {
  return (
    <div className="h-full min-h-[400px]">
      <textarea
        className={`w-full h-full resize-none bg-muted rounded-lg p-4 font-mono text-sm text-foreground outline-none ${!editable ? 'cursor-default' : ''}`}
        value={code}
        onChange={e => editable && onChange(e.target.value)}
        spellCheck={false}
        readOnly={!editable}
      />
    </div>
  );
}

function MathFullscreen({ latex, onChange, editable }: { latex: string; onChange: (l: string) => void; editable: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    if (!latex.trim()) { ref.current.innerHTML = '<span class="text-muted-foreground italic">LaTeX preview…</span>'; return; }
    try { katex.render(latex, ref.current, { displayMode: true, throwOnError: false }); } catch { ref.current.innerHTML = '<span class="text-destructive">Invalid LaTeX</span>'; }
  }, [latex]);
  return (
    <div className="flex gap-4 h-full min-h-[300px]">
      <textarea 
        className={`flex-1 resize-none bg-muted rounded-lg p-4 font-mono text-sm text-foreground outline-none ${!editable ? 'cursor-default' : ''}`} 
        value={latex} 
        onChange={e => editable && onChange(e.target.value)} 
        spellCheck={false} 
        placeholder="\\int_0^\\infty e^{-x^2} dx" 
        readOnly={!editable}
      />
      <div ref={ref} className="flex-1 flex items-center justify-center text-foreground overflow-auto" style={{ fontSize: '1.4rem' }} />
    </div>
  );
}

function TermQuestionFullscreen({ year, questions, onUpdate, editable }: { year: string; questions: string[]; onUpdate: (d: { year?: string; questions?: string[] }) => void; editable: boolean }) {
  const updateQ = (i: number, v: string) => { if (!editable) return; const q = [...questions]; q[i] = v; onUpdate({ questions: q }); };
  const handleKey = (i: number, e: React.KeyboardEvent) => {
    if (!editable) return;
    if (e.key === 'Enter') { e.preventDefault(); const q = [...questions]; q.splice(i + 1, 0, ''); onUpdate({ questions: q }); }
    if (e.key === 'Backspace' && !questions[i] && questions.length > 1) { e.preventDefault(); onUpdate({ questions: questions.filter((_, j) => j !== i) }); }
  };
  return (
    <div>
      <input 
        className={`w-full bg-transparent text-3xl font-bold text-foreground outline-none mb-4 ${!editable ? 'cursor-default' : ''}`} 
        value={year} 
        onChange={e => editable && onUpdate({ year: e.target.value })} 
        placeholder="Title / Year…"
        readOnly={!editable}
      />
      <ol className="space-y-2">
        {questions.map((q, i) => (
          <li key={i} className="flex items-start gap-3">
            <span className="mt-1 text-sm font-mono text-muted-foreground">{i + 1}.</span>
            <input 
              className={`flex-1 bg-transparent text-sm text-foreground outline-none ${!editable ? 'cursor-default' : ''}`} 
              value={q} 
              onChange={e => updateQ(i, e.target.value)} 
              onKeyDown={e => handleKey(i, e)} 
              placeholder="Type a question…"
              readOnly={!editable}
            />
          </li>
        ))}
      </ol>
    </div>
  );
}

function StickyNoteFullscreen({ text, onChange, editable }: { text: string; onChange: (t: string) => void; editable: boolean }) {
  return (
    <textarea 
      className={`w-full h-full min-h-[300px] resize-none bg-transparent p-2 text-lg font-semibold text-foreground outline-none ${!editable ? 'cursor-default' : ''}`} 
      value={text} 
      onChange={e => editable && onChange(e.target.value)} 
      placeholder="Quick note..."
      readOnly={!editable}
    />
  );
}

function FlashcardFullscreen({ flashcards, onUpdate, editable }: { flashcards: { question: string; answer: string }[]; onUpdate: (f: { question: string; answer: string }[]) => void; editable: boolean }) {
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const card = flashcards[idx];

  const updateCard = (field: 'question' | 'answer', value: string) => {
    if (!editable) return;
    const newCards = [...flashcards];
    newCards[idx] = { ...newCards[idx], [field]: value };
    onUpdate(newCards);
  };

  const addCard = () => {
    if (!editable) return;
    const newCards = [...flashcards, { question: '', answer: '' }];
    onUpdate(newCards);
    setIdx(newCards.length - 1);
    setIsEditing(true);
  };

  if (!card && !isEditing) {
     return (
       <div className="flex flex-col items-center justify-center py-12">
         <p className="text-muted-foreground mb-4">No flashcards yet</p>
         {editable && <button onClick={addCard} className="text-xs font-bold text-primary underline">Create first card</button>}
       </div>
     );
  }

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="w-full max-w-lg">
        {isEditing && editable ? (
          <div className="space-y-4 rounded-xl border-2 border-primary/20 bg-accent/10 p-6">
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1 block">Question</label>
              <textarea 
                className="w-full bg-transparent text-sm font-semibold outline-none resize-none" 
                value={card?.question || ''} 
                onChange={e => updateCard('question', e.target.value)}
                placeholder="Type question..."
              />
            </div>
            <div className="h-[1px] bg-border" />
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1 block">Answer</label>
              <textarea 
                className="w-full bg-transparent text-sm font-semibold outline-none resize-none" 
                value={card?.answer || ''} 
                onChange={e => updateCard('answer', e.target.value)}
                placeholder="Type answer..."
              />
            </div>
            <button onClick={() => setIsEditing(false)} className="w-full py-2 bg-primary text-primary-foreground rounded-lg text-xs font-bold">Done</button>
          </div>
        ) : (
          <button onClick={() => setFlipped(!flipped)} className="w-full cursor-pointer">
            <div className={`min-h-[200px] rounded-xl border-2 border-dashed p-8 text-center transition-all ${flipped ? 'border-primary/40 bg-primary/5' : 'border-border bg-accent/30'}`}>
              <p className="mb-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">{flipped ? 'Answer' : 'Question'}</p>
              <p className="text-lg font-semibold text-foreground">{flipped ? card.answer : card.question}</p>
            </div>
          </button>
        )}
      </div>
      <div className="flex items-center gap-4">
        <button onClick={() => { setFlipped(false); setIdx(Math.max(0, idx - 1)); }} disabled={idx === 0 || isEditing} className="rounded-lg px-3 py-1 text-sm font-bold text-muted-foreground hover:bg-accent disabled:opacity-20">← Prev</button>
        <span className="text-sm font-bold text-muted-foreground">{flashcards.length > 0 ? `${idx + 1}/${flashcards.length}` : '0/0'}</span>
        <button onClick={() => { setFlipped(false); setIdx(Math.min(flashcards.length - 1, idx + 1)); }} disabled={idx === flashcards.length - 1 || isEditing} className="rounded-lg px-3 py-1 text-sm font-bold text-muted-foreground hover:bg-accent disabled:opacity-20">Next →</button>
        {editable && !isEditing && (
          <div className="flex gap-2 ml-4">
            <button onClick={() => setIsEditing(true)} className="text-[10px] font-black uppercase text-primary hover:underline">Edit</button>
            <button onClick={addCard} className="text-[10px] font-black uppercase text-muted-foreground hover:text-foreground">Add New</button>
          </div>
        )}
      </div>
    </div>
  );
}

function TableFullscreen({ headers, rows, onUpdate, editable }: { headers: string[]; rows: { value: string }[][]; onUpdate: (d: { headers?: string[]; rows?: { value: string }[][] }) => void; editable: boolean }) {
  const updateCell = (ri: number, ci: number, value: string) => {
    if (!editable) return;
    const newRows = rows.map((r, i) => i === ri ? r.map((c, j) => j === ci ? { value } : c) : r);
    onUpdate({ rows: newRows });
  };
  const updateHeader = (ci: number, value: string) => {
    if (!editable) return;
    onUpdate({ headers: headers.map((h, i) => i === ci ? value : h) });
  };
  return (
    <div className="overflow-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>{headers.map((h, ci) => (
            <th key={ci} className="border border-border bg-muted px-3 py-2 text-left font-bold uppercase tracking-wider text-muted-foreground">
              <input className={`w-full bg-transparent outline-none ${!editable ? 'cursor-default' : ''}`} value={h} onChange={e => updateHeader(ci, e.target.value)} readOnly={!editable} />
            </th>
          ))}</tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} className="hover:bg-accent/30 group">
              {row.map((cell, ci) => (
                <td key={ci} className="border border-border px-3 py-2">
                  <input className={`w-full bg-transparent text-foreground outline-none ${!editable ? 'cursor-default' : ''}`} value={cell.value} onChange={e => updateCell(ri, ci, e.target.value)} placeholder="—" readOnly={!editable} />
                </td>
              ))}
              {editable && (
                <td className="w-8 border-none opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => onUpdate({ rows: rows.filter((_, i) => i !== ri) })} className="text-muted-foreground hover:text-destructive">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {editable && (
        <button 
          onClick={() => onUpdate({ rows: [...rows, headers.map(() => ({ value: '' }))] })} 
          className="mt-3 text-[10px] font-black uppercase text-primary hover:underline"
        >
          + Add Row
        </button>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   Main Modal Components
   ═══════════════════════════════════════════════════════ */

function ViewerErrorBoundary({ children, onRetry }: { children: React.ReactNode; onRetry?: () => void }) {
  const [hasError, setHasError] = useState(false);
  if (hasError) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="rounded-lg bg-destructive/10 p-6 text-destructive">
          <p className="font-bold uppercase tracking-widest text-xs mb-1">Viewer Error</p>
          <p className="text-sm opacity-80">Something went wrong while rendering this content.</p>
          <button 
            onClick={() => { setHasError(false); onRetry?.(); }}
            className="mt-4 rounded-lg bg-destructive px-4 py-2 text-xs font-bold text-destructive-foreground hover:opacity-90 transition-opacity"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }
  return (
    <ErrorCatcher onError={() => setHasError(true)}>
      {children}
    </ErrorCatcher>
  );
}

class ErrorCatcher extends React.Component<{ children: React.ReactNode; onError: () => void }, { hasError: boolean }> {
  constructor(props: { children: React.ReactNode; onError: () => void }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch() { this.props.onError(); }
  render() { return this.state.hasError ? null : this.props.children; }
}

export function NodeExpandModal() {
  const expandedNode = useCanvasStore((s) => s.expandedNode);
  const setExpandedNode = useCanvasStore((s) => s.setExpandedNode);
  const node = useCanvasStore((s) => s.nodes.find((n) => n.id === expandedNode));
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const clearNodePasteContent = useCanvasStore((s) => s.clearNodePasteContent);
  const canvasMode = useCanvasStore((s) => s.canvasMode);
  const isViewMode = canvasMode === 'view';
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const [isFullscreen, setIsFullscreen] = useState(() => localStorage.getItem('node_modal_fullscreen') === 'true');
  const [showOutline, setShowOutline] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [localTitle, setLocalTitle] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<LinkMetadata | null>(null);
  const [loadingMeta, setLoadingMeta] = useState(false);
  const editorRef = useRef<NoteEditorHandle>(null);

  const modalRef = useRef<HTMLDivElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const isMobile = useIsMobile();
  const latestContentRef = useRef<{ json: JSONContent, extraData?: Record<string, unknown> } | null>(null);
  const expandedNodeRef = useRef(expandedNode);
  expandedNodeRef.current = expandedNode;

  const expandableNodes = useCanvasStore((s) => s.nodes.filter(n => EXPANDABLE_TYPES.includes(n.type || '')));
  const expandableIndex = useMemo(() => expandableNodes.findIndex(n => n.id === expandedNode), [expandableNodes, expandedNode]);

  useEffect(() => {
    localStorage.setItem('node_modal_fullscreen', String(isFullscreen));
  }, [isFullscreen]);

  useEffect(() => {
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, []);

  useEffect(() => {
    if (expandedNode) {
      const timer = requestAnimationFrame(() => titleInputRef.current?.focus());
      return () => cancelAnimationFrame(timer);
    }
  }, [expandedNode]);

  const handleClose = useCallback(() => { 
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setExpandedNode(null); 
    setIsFullscreen(false); 
    setShowOutline(false);
  }, [setExpandedNode]);

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      if (latestContentRef.current && expandedNodeRef.current) {
        updateNodeData(expandedNodeRef.current, { 
          content: latestContentRef.current.json, 
          ...latestContentRef.current.extraData 
        });
        latestContentRef.current = null;
      }
    }
  }, [expandedNode, updateNodeData]);

  useEffect(() => { setLocalTitle(null); }, [expandedNode]);

  const handlePrev = useCallback(() => {
    const { nodes: currentNodes, edges: currentEdges } = useCanvasStore.getState();
    const currentNode = currentNodes.find(n => n.id === expandedNode);
    if (!currentNode) return;
    
    const incomingEdges = currentEdges.filter(e => e.target === expandedNode);
    if (incomingEdges.length > 0) {
      const sourceNodes = currentNodes.filter(n => incomingEdges.some(e => e.source === n.id));
      sourceNodes.sort((a, b) => (Math.abs(a.position.y - b.position.y) > POSITION_THRESHOLD) ? b.position.y - a.position.y : b.position.x - a.position.x);
      if (sourceNodes[0]) setExpandedNode(sourceNodes[0].id);
    } else {
      const currentIdx = expandableNodes.findIndex(n => n.id === expandedNode);
      if (currentIdx > 0) setExpandedNode(expandableNodes[currentIdx - 1].id);
    }
  }, [expandedNode, expandableNodes, setExpandedNode]);

  // Load metadata for embed/bookmark nodes
  useEffect(() => {
    if (!node || !expandedNode) return;
    const url = (node.data as any).url;
    const type = node.type;
    
    if (url && (type === 'embed' || type === 'bookmark')) {
      setLoadingMeta(true);
      fetchLinkMetadata(url).then(setMetadata).catch(console.error).finally(() => setLoadingMeta(false));
    } else {
      setMetadata(null);
    }
  }, [expandedNode, node]);


  const handleNext = useCallback(() => {
    const { nodes: currentNodes, edges: currentEdges } = useCanvasStore.getState();
    const currentNode = currentNodes.find(n => n.id === expandedNode);
    if (!currentNode) return;
    
    const outgoingEdges = currentEdges.filter(e => e.source === expandedNode);
    if (outgoingEdges.length > 0) {
      const targetNodes = currentNodes.filter(n => outgoingEdges.some(e => e.target === n.id));
      targetNodes.sort((a, b) => (Math.abs(a.position.y - b.position.y) > POSITION_THRESHOLD) ? a.position.y - b.position.y : a.position.x - b.position.x);
      if (targetNodes[0]) setExpandedNode(targetNodes[0].id);
    } else {
      const currentIdx = expandableNodes.findIndex(n => n.id === expandedNode);
      if (currentIdx >= 0 && currentIdx < expandableNodes.length - 1) setExpandedNode(expandableNodes[currentIdx + 1].id);
    }
  }, [expandedNode, expandableNodes, setExpandedNode]);

  const handleShare = useCallback(() => {
    const url = new URL(window.location.href);
    url.searchParams.set('node', expandedNode || '');
    const shareUrl = url.toString();
    const title = (node?.data as any)?.title || (node?.data as any)?.year || 'Untitled';

    if (navigator.share) {
      navigator.share({ title, text: 'Check out this note', url: shareUrl }).catch(() => {});
    } else {
      navigator.clipboard.writeText(shareUrl).then(() => {
        import('sonner').then(({ toast }) => toast.success('Link copied to clipboard'));
      }).catch(() => {});
    }
  }, [node, expandedNode]);

  const isEditorFocused = useCallback(() => {
    const activeEl = document.activeElement;
    if (!activeEl) return false;
    if (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA') return true;
    if (activeEl.getAttribute('contenteditable') === 'true') return true;
    if (activeEl.closest('.ProseMirror, [data-type="editor"], .tiptap')) return true;
    return false;
  }, []);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (!expandedNode) return;
      if (e.key === 'Escape') { e.preventDefault(); handleClose(); }
      if (e.key === 'F11' || (e.ctrlKey && e.shiftKey && e.key === 'F')) { e.preventDefault(); setIsFullscreen(f => !f); }
      if (!isEditorFocused()) {
        if (e.key === 'ArrowLeft') { e.preventDefault(); handlePrev(); }
        if (e.key === 'ArrowRight') { e.preventDefault(); handleNext(); }
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [expandedNode, handleClose, handlePrev, handleNext, isEditorFocused]);

  const contentForStats = (node?.data as any)?.content || null;
  const stats = useMemo(() => countWords(contentForStats), [contentForStats]);
  const footStatsText = useMemo(() => {
    const readTime = Math.max(1, Math.ceil(stats.words / 200));
    return stats.words > 0 ? `${stats.words}w · ${stats.chars}c · ${readTime}m` : stats.chars > 0 ? `${stats.chars}c` : '';
  }, [stats]);

  const handleContentChange = useCallback((json: JSONContent, extraData?: Record<string, unknown>) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setIsSaving(true);
    latestContentRef.current = { json, extraData };
    const targetNodeId = expandedNode;
    debounceRef.current = setTimeout(() => {
      const finalId = expandedNodeRef.current === targetNodeId ? targetNodeId : expandedNodeRef.current;
      if (finalId) {
        updateNodeData(finalId, { content: json, ...extraData });
        clearNodePasteContent(finalId);
      }
      latestContentRef.current = null;
      setIsSaving(false);
    }, 400); 
  }, [expandedNode, updateNodeData, clearNodePasteContent]);

  if (!node || !expandedNode || !node.data || typeof node.data !== 'object') return null;

  const nodeData = node.data as any;
  const nodeType = node.type || 'aiNote';
  const getTitle = () => localTitle !== null ? localTitle : (nodeData.title ?? nodeData.year ?? 'Untitled');
  const formatNodeType = (type: string | undefined) => (type || 'Note').replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()).trim();
  const isShareView = typeof window !== 'undefined' && window.location.pathname.startsWith('/view/');

  const renderContent = () => {
    switch (nodeType) {
      case 'aiNote':
      case 'lectureNotes':
        return (
          <HybridEditor
            ref={editorRef}
            initialContent={nodeData.content}
            onChange={handleContentChange}
            placeholder="Start typing…"
            pasteContent={nodeData.pasteContent}
            pasteFormat={nodeData.pasteFormat}
            editable={!isViewMode}
            title={getTitle()}
            forceTiptap={isShareView || nodeData.useBlockEditor === false}
            forceBlockNote={!isShareView && nodeData.useBlockEditor === true}
          />
        );
      case 'checklist':
        return <ChecklistFullscreen items={nodeData.items || []} onUpdate={(items) => updateNodeData(expandedNode, { items })} editable={!isViewMode} />;
      case 'summary':
        return <SummaryFullscreen bullets={nodeData.bullets || ['']} onChange={(bullets) => updateNodeData(expandedNode, { bullets })} editable={!isViewMode} />;
      case 'codeSnippet':
        return <CodeFullscreen code={nodeData.code || ''} onChange={(code) => updateNodeData(expandedNode, { code })} editable={!isViewMode} />;
      case 'math':
        return <MathFullscreen latex={nodeData.latex || ''} onChange={(latex) => updateNodeData(expandedNode, { latex })} editable={!isViewMode} />;
      case 'termQuestion':
        return <TermQuestionFullscreen year={nodeData.year || ''} questions={nodeData.questions || ['']} onUpdate={(d) => updateNodeData(expandedNode, d)} editable={!isViewMode} />;
      case 'stickyNote':
      case 'text':
        return <StickyNoteFullscreen text={nodeData.text || ''} onChange={(text) => updateNodeData(expandedNode, { text })} editable={!isViewMode} />;
      case 'flashcard':
        return <FlashcardFullscreen flashcards={nodeData.flashcards || []} onUpdate={(flashcards) => updateNodeData(expandedNode, { flashcards })} editable={!isViewMode} />;
      case 'table':
        return <TableFullscreen headers={nodeData.headers || ['Col A', 'Col B', 'Col C']} rows={nodeData.rows || [[{ value: '' }]]} onUpdate={(d) => updateNodeData(expandedNode, d)} editable={!isViewMode} />;
      case 'image':
        return (
          <div className="flex items-center justify-center">
            {(nodeData.storageUrl || nodeData.url) ? <img src={nodeData.storageUrl || nodeData.url} alt={nodeData.title || 'Image'} className="max-w-full max-h-[70vh] object-contain rounded-lg" /> : <span className="text-muted-foreground">No image</span>}
          </div>
        );
      case 'embed': {
        const url = nodeData.url;
        const restricted = url ? isRestrictedSite(url) : false;
        const config = url ? getEmbedConfig(url) : null;
        
        if (!url) return <span className="text-muted-foreground">No URL</span>;
        
        if (restricted || nodeData.preferredMode === 'bookmark') {
          return (
            <div className="flex justify-center py-8">
              <LinkPreview metadata={metadata || { url }} isLoading={loadingMeta} variant="modal" />
            </div>
          );
        }
        
        return <iframe src={config?.embedUrl || url} title="Embed" className="w-full h-[70vh] border-0 rounded-lg shadow-sm" sandbox="allow-forms allow-modals allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts allow-presentation" />;

      }
      case 'bookmark':
        return (
          <div className="flex justify-center py-8">
            <LinkPreview metadata={metadata || { url: nodeData.url || '' }} isLoading={loadingMeta} variant="modal" />
          </div>
        );
      case 'drawing':
        return (
          <svg viewBox={`0 0 ${nodeData.width || 800} ${nodeData.height || 600}`} preserveAspectRatio="xMidYMid meet" className="w-full h-auto rounded-lg bg-muted">
            {(nodeData.paths || []).map((p: any, i: number) => <path key={i} d={p.d} stroke={p.color} strokeWidth={p.width} fill="none" strokeLinecap="round" strokeLinejoin="round" />)}
          </svg>
        );
      case 'video': {
        const config = (nodeData.url || '').trim() ? getEmbedConfig(nodeData.url) : null;
        const embedUrl = config ? config.embedUrl : null;
        return embedUrl ? (
          <iframe 
            src={embedUrl} 
            title="Video" 
            className="w-full aspect-video rounded-lg border-0 shadow-lg" 
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
            sandbox="allow-forms allow-modals allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts allow-presentation"
            allowFullScreen 
          />
        ) : <span className="text-muted-foreground">No video</span>;
      }

      case 'pdf': {
        if (!nodeData.storageUrl) return <span className="text-muted-foreground">No document</span>;
        const ft = nodeData.fileType;
        const isOffice = ft === 'doc' || ft === 'docx' || ft === 'ppt' || ft === 'pptx';
        const src = isOffice ? `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(nodeData.storageUrl)}` : nodeData.storageUrl;
        return <iframe src={src} title="Doc" className="w-full h-[70vh] border-0 rounded-lg" allowFullScreen />;
      }

      default:
        return <div className="text-muted-foreground text-center py-8">Not supported yet.</div>;
    }
  };

  if (isMobile) {
    return (
      <Drawer.Root open={!!expandedNode} onOpenChange={(open) => !open && handleClose()}>
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 z-expand-backdrop bg-black/40 backdrop-blur-sm" />
          <Drawer.Content className="fixed bottom-0 left-0 right-0 z-expand-modal flex h-[92vh] flex-col rounded-t-[20px] bg-card border-t shadow-2xl focus:outline-none">
            <div className="mx-auto mt-4 h-1.5 w-12 shrink-0 rounded-full bg-border" />
            <div className="flex items-center justify-between px-6 py-4 border-b border-border/50">
              <div className="flex flex-col overflow-hidden mr-4">
                 <h2 className="text-lg font-bold truncate tracking-tight">{getTitle()}</h2>
                 <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest leading-none mt-1">{formatNodeType(node.type)}</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={handleShare} className="p-2 rounded-full bg-accent/50"><Share2 className="h-4 w-4" /></button>
                <button onClick={handleClose} className="p-2 rounded-full bg-accent"><X className="h-4 w-4" /></button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-6 pb-28">{renderContent()}</div>
            <div className="absolute bottom-0 left-0 right-0 p-4 bg-background/80 backdrop-blur-md border-t flex justify-between items-center z-10 min-h-[56px]">
              <button onClick={handlePrev} disabled={expandableIndex <= 0} className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-border bg-card text-xs font-bold disabled:opacity-30 transition-transform"><ChevronLeft className="h-4 w-4" /> Previous</button>
              <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">
                {footStatsText && <span className="mr-3 lowercase font-mono opacity-60">{footStatsText}</span>}
                {expandableIndex + 1} / {expandableNodes.length}
              </span>
              <button onClick={handleNext} disabled={expandableIndex >= expandableNodes.length - 1} className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-border bg-card text-xs font-bold disabled:opacity-30 transition-transform text-primary">Next <ChevronRight className="h-4 w-4" /></button>
            </div>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    );
  }

  return (
    <div className="fixed inset-0 z-expand-backdrop flex items-center justify-center bg-background/80 backdrop-blur-md">
      <div ref={modalRef} role="dialog" aria-modal="true" className={cn("relative overflow-hidden rounded-2xl border border-border/50 bg-card/95 shadow-[var(--node-shadow-elevated)] animate-in duration-200 flex flex-col", isFullscreen ? 'w-full h-full max-w-full max-h-full rounded-none' : 'w-full max-w-5xl max-h-[90vh]')}>
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border/30 bg-card/80 px-5 py-3 backdrop-blur-sm">
          <input ref={titleInputRef} className="flex-1 bg-transparent text-base font-medium tracking-tight text-foreground outline-none placeholder:text-muted-foreground/50" value={getTitle()} onChange={(e) => setLocalTitle(e.target.value.replace(/[<>]/g, ''))} onBlur={() => { if (localTitle !== null) { updateNodeData(expandedNode, { [nodeType === 'termQuestion' ? 'year' : 'title']: localTitle }); setLocalTitle(null); } }} onKeyDown={(e) => e.key === 'Enter' && titleInputRef.current?.blur()} placeholder="Untitled" />
          <div className="flex items-center gap-0.5">
            {isSaving && <span className="text-[10px] text-muted-foreground animate-pulse mr-1">Saving...</span>}
            <button onClick={handleShare} className="rounded-md p-1.5 text-muted-foreground/70 hover:bg-accent/50 hover:text-foreground hidden sm:block"><Share2 className="h-4 w-4" /></button>
            {(nodeType === 'aiNote' || nodeType === 'lectureNotes') && !isViewMode && (
              <button
                onClick={() => {
                  const isActive = nodeData.useBlockEditor ?? (useCanvasStore.getState().isBlockEditorMode || (useSettingsStore.getState().enableHybridEditor && getEditorVersion(nodeData.content) === 2));
                  let updates: any = { useBlockEditor: !isActive };
                  if (latestContentRef.current) {
                    if (debounceRef.current) clearTimeout(debounceRef.current);
                    updates.content = latestContentRef.current.json;
                    if (latestContentRef.current.extraData) updates = { ...updates, ...latestContentRef.current.extraData };
                    latestContentRef.current = null;
                    setIsSaving(false);
                  }
                  updateNodeData(expandedNode, updates);
                }}
                className={cn("rounded-md p-1.5 transition-all hidden sm:block", (nodeData.useBlockEditor ?? (useCanvasStore.getState().isBlockEditorMode || (useSettingsStore.getState().enableHybridEditor && getEditorVersion(nodeData.content) === 2))) ? "bg-primary text-primary-foreground" : "text-muted-foreground/70 hover:bg-accent/50 hover:text-foreground")}
              ><LayoutList className="h-4 w-4" /></button>
            )}
            {(nodeType === 'aiNote' || nodeType === 'lectureNotes') && (
              <button onClick={() => setShowOutline(!showOutline)} className={cn("rounded-md p-1.5 transition-all text-muted-foreground/70", showOutline ? "bg-primary text-primary-foreground" : "hover:bg-accent/50 hover:text-foreground")}><ListIcon className="h-4 w-4" /></button>
            )}
            <button onClick={() => setIsFullscreen(f => !f)} className="rounded-md p-1.5 text-muted-foreground/70 hover:bg-accent/50 hover:text-foreground">{isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}</button>
            <button onClick={handleClose} className="rounded-md p-1.5 text-muted-foreground/70 hover:bg-accent/50 hover:text-foreground"><X className="h-5 w-5" /></button>
          </div>
        </div>
        <div className="flex-1 flex overflow-hidden min-h-0">
          <div className="flex-1 overflow-y-auto px-5 py-4 scrollbar-hide min-h-0">
             <div className="max-w-4xl mx-auto h-full min-h-0"><ViewerErrorBoundary>{!node ? <div className="flex items-center justify-center py-20"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div> : renderContent()}</ViewerErrorBoundary></div>
           </div>
           {(nodeType === 'aiNote' || nodeType === 'lectureNotes') && showOutline && (<div className="w-64 border-l border-border/30 hidden md:block"><OutlinePanel editor={editorRef.current?.getEditor() || null} onClose={() => setShowOutline(false)} /></div>)}
        </div>
        <div className="border-t border-border/30 px-5 py-2.5 flex items-center justify-between text-muted-foreground/60 overflow-hidden">
           <div className="flex items-center gap-3">
              <button onClick={handlePrev} disabled={expandableIndex <= 0} className="hover:text-primary disabled:opacity-30 transition-colors text-[11px] font-medium tracking-wide px-2 py-1 rounded-md hover:bg-accent/50">← Previous</button>
              <div className="h-3 w-px bg-border/30" />
              <button onClick={handleNext} disabled={expandableIndex >= expandableNodes.length - 1} className="hover:text-primary disabled:opacity-30 transition-colors text-[11px] font-medium tracking-wide px-2 py-1 rounded-md hover:bg-accent/50 text-primary">Next →</button>
           </div>
           <div className="flex items-center gap-3">
              {footStatsText && (<><span className="text-[10px] font-mono opacity-40">{footStatsText}</span><div className="h-3 w-px bg-border/30" /></>)}
              <span className="text-[10px] font-medium tracking-wider opacity-50">{expandableIndex + 1} / {expandableNodes.length}</span>
           </div>
        </div>
      </div>
    </div>
  );
}
