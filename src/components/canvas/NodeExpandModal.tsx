import { useCanvasStore } from '@/store/canvasStore';
import { useNodes } from '@xyflow/react';
import { HybridEditor, type NoteEditorHandle } from '@/components/editor/HybridEditor';
import { OutlinePanel } from '@/components/tiptap/OutlinePanel';
import { X, Maximize2, Minimize2, List as ListIcon, ChevronRight, ChevronLeft, Share2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { Drawer } from 'vaul';
import { useIsMobile } from '@/hooks/use-mobile';
import type { JSONContent } from '@tiptap/react';
import katex from 'katex';
import { cn } from '@/lib/utils';

/* ─── Expandable node types ─── */
const EXPANDABLE_TYPES = ['aiNote', 'lectureNotes', 'checklist', 'summary', 'codeSnippet', 'math', 'termQuestion', 'stickyNote', 'flashcard', 'table', 'image', 'embed', 'drawing', 'video', 'text', 'pdf'];

/* ─── Checklist helpers ─── */
interface CheckItem { id: string; text: string; done: boolean; }

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

/* ─── Summary fullscreen ─── */
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

/* ─── Code fullscreen ─── */
function CodeFullscreen({ code, onChange, editable }: { code: string; onChange: (c: string) => void; editable: boolean }) {
  return (
    <textarea
      className={`w-full h-full min-h-[400px] resize-none bg-muted rounded-lg p-4 font-mono text-sm text-foreground outline-none ${!editable ? 'cursor-default' : ''}`}
      value={code}
      onChange={e => editable && onChange(e.target.value)}
      spellCheck={false}
      readOnly={!editable}
    />
  );
}

/* ─── Math fullscreen ─── */
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

/* ─── Term/Question fullscreen ─── */
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

/* ─── Sticky note fullscreen ─── */
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

/* ─── Flashcard fullscreen ─── */
function FlashcardFullscreen({ flashcards }: { flashcards: { question: string; answer: string }[] }) {
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const card = flashcards[idx];
  if (!card) return <div className="text-muted-foreground text-center">No flashcards</div>;
  return (
    <div className="flex flex-col items-center gap-6">
      <button onClick={() => setFlipped(!flipped)} className="w-full max-w-lg cursor-pointer">
        <div className={`min-h-[200px] rounded-xl border-2 border-dashed p-8 text-center transition-all ${flipped ? 'border-primary/40 bg-primary/5' : 'border-border bg-accent/30'}`}>
          <p className="mb-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">{flipped ? 'Answer' : 'Question'}</p>
          <p className="text-lg font-semibold text-foreground">{flipped ? card.answer : card.question}</p>
        </div>
      </button>
      <div className="flex items-center gap-4">
        <button onClick={() => { setFlipped(false); setIdx(Math.max(0, idx - 1)); }} disabled={idx === 0} className="rounded-lg px-3 py-1 text-sm font-bold text-muted-foreground hover:bg-accent disabled:opacity-20">← Prev</button>
        <span className="text-sm font-bold text-muted-foreground">{idx + 1}/{flashcards.length}</span>
        <button onClick={() => { setFlipped(false); setIdx(Math.min(flashcards.length - 1, idx + 1)); }} disabled={idx === flashcards.length - 1} className="rounded-lg px-3 py-1 text-sm font-bold text-muted-foreground hover:bg-accent disabled:opacity-20">Next →</button>
      </div>
    </div>
  );
}

/* ─── Table fullscreen ─── */
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
            <tr key={ri} className="hover:bg-accent/30">
              {row.map((cell, ci) => (
                <td key={ci} className="border border-border px-3 py-2">
                  <input className={`w-full bg-transparent text-foreground outline-none ${!editable ? 'cursor-default' : ''}`} value={cell.value} onChange={e => updateCell(ri, ci, e.target.value)} placeholder="—" readOnly={!editable} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   Main Modal
   ═══════════════════════════════════════════════════════ */

export function NodeExpandModal() {
  const expandedNode = useCanvasStore((s) => s.expandedNode);
  const setExpandedNode = useCanvasStore((s) => s.setExpandedNode);
  const nodes = useNodes();
  const edges = useCanvasStore((s) => s.edges);
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const canvasMode = useCanvasStore((s) => s.canvasMode);
  const isViewMode = canvasMode === 'view';
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showOutline, setShowOutline] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const editorRef = useRef<NoteEditorHandle>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const isMobile = useIsMobile();
  
  const expandableNodes = useMemo(() => nodes.filter(n => EXPANDABLE_TYPES.includes(n.type || '')), [nodes]);
  const expandableIndex = useMemo(() => expandableNodes.findIndex(n => n.id === expandedNode), [expandableNodes, expandedNode]);

  const node = nodes.find((n) => n.id === expandedNode);

  // Cleanup debounce on unmount (NM1)
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  // Focus management when modal opens (NM9)
  useEffect(() => {
    if (expandedNode && titleInputRef.current) {
      titleInputRef.current.focus();
    }
  }, [expandedNode]);

  // Batch state updates for handleClose (NM2)
  const handleClose = useCallback(() => { 
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      updateNodeData(expandedNode, {});
    }
    setExpandedNode(null); 
    setIsFullscreen(false); 
    setShowOutline(false);
  }, [setExpandedNode, expandedNode, updateNodeData]);

  const activeIdx = useMemo(() => nodes.findIndex(n => n.id === expandedNode), [nodes, expandedNode]);

  // Use refs for navigation to avoid stale closures (NM3)
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  nodesRef.current = nodes;
  edgesRef.current = edges;

  const handlePrev = useCallback(() => {
    const currentNodes = nodesRef.current;
    const currentEdges = edgesRef.current;
    // Validate current node still exists
    const currentNode = currentNodes.find(n => n.id === expandedNode);
    if (!currentNode) return;
    
    // Find edges where this node is the target (incoming edges)
    const incomingEdges = currentEdges.filter(e => e.target === expandedNode);
    if (incomingEdges.length > 0) {
      // Get all source nodes
      const sourceNodes = currentNodes.filter(n => incomingEdges.some(e => e.source === n.id));
      
      // Sort source nodes by position: bottom-to-top, then right-to-left (reverse of reading)
      sourceNodes.sort((a, b) => {
        if (Math.abs(a.position.y - b.position.y) > 20) {
          return b.position.y - a.position.y;
        }
        return b.position.x - a.position.x;
      });
      
      if (sourceNodes[0]) setExpandedNode(sourceNodes[0].id);
    } else {
      // Fallback to expandable array order (NM7, NM16)
      const currentIdx = expandableNodes.findIndex(n => n.id === expandedNode);
      if (currentIdx > 0) {
        setExpandedNode(expandableNodes[currentIdx - 1].id);
      }
    }
  }, [expandedNode, expandableNodes, setExpandedNode]);

  const handleNext = useCallback(() => {
    const currentNodes = nodesRef.current;
    const currentEdges = edgesRef.current;
    // Validate current node still exists
    const currentNode = currentNodes.find(n => n.id === expandedNode);
    if (!currentNode) return;
    
    // Find edges where this node is the source (outgoing edges)
    const outgoingEdges = currentEdges.filter(e => e.source === expandedNode);
    if (outgoingEdges.length > 0) {
      // Get all target nodes
      const targetNodes = currentNodes.filter(n => outgoingEdges.some(e => e.target === n.id));
      
      // Sort target nodes by position: top-to-bottom, then left-to-right
      targetNodes.sort((a, b) => {
        if (Math.abs(a.position.y - b.position.y) > 20) {
          return a.position.y - b.position.y;
        }
        return a.position.x - b.position.x;
      });
      
      if (targetNodes[0]) setExpandedNode(targetNodes[0].id);
    } else {
      // Fallback to expandable array order (NM7, NM16)
      const currentIdx = expandableNodes.findIndex(n => n.id === expandedNode);
      if (currentIdx < expandableNodes.length - 1) {
        setExpandedNode(expandableNodes[currentIdx + 1].id);
      }
    }
  }, [expandedNode, expandableNodes, setExpandedNode]);

  const handleShare = useCallback(() => {
    const url = window.location.href;
    const workspaceName = useCanvasStore.getState().workspaceName;
    const title = node?.data && typeof node.data === 'object' && 'title' in node.data 
      ? (node.data.title as string) 
      : (node?.data && typeof node.data === 'object' && 'year' in node.data ? (node.data.year as string) : 'Untitled');
    if (navigator.share) {
      navigator.share({
        title,
        text: `Check out this note from ${workspaceName}`,
        url
      }).catch((err) => {
        if (err.name !== 'AbortError') {
          console.error('Error sharing:', err);
        }
      });
    } else {
      navigator.clipboard.writeText(url);
    }
  }, [node]);

  // Better detection for Tiptap editor focus (NM5)
  const isEditorFocused = useCallback(() => {
    const activeEl = document.activeElement;
    if (!activeEl) return false;
    if (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA') return true;
    // Check for contenteditable (Tiptap uses this)
    if (activeEl.getAttribute('contenteditable') === 'true') return true;
    // Check if inside Tiptap editor
    if (activeEl.closest('.ProseMirror, [data-type="editor"], .tiptap')) return true;
    return false;
  }, []);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      // Don't handle if modal is not open
      if (!expandedNode) return;
      
      if (e.key === 'Escape') {
        e.preventDefault();
        handleClose();
      }
      if (e.key === 'F11' || (e.ctrlKey && e.shiftKey && e.key === 'F')) { 
        e.preventDefault(); 
        setIsFullscreen(f => !f); 
      }
      
      // Arrow key navigation (ignore if typing in an input/textarea/editor) (NM5)
      if (!isEditorFocused()) {
        if (e.key === 'ArrowLeft') { e.preventDefault(); handlePrev(); }
        if (e.key === 'ArrowRight') { e.preventDefault(); handleNext(); }
        if (e.key === 'f' || e.key === 'F') { e.preventDefault(); setIsFullscreen(f => !f); }
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [expandedNode, handleClose, handlePrev, handleNext, isEditorFocused]);

  if (!node || !expandedNode) return null;

  const nodeData = node.data as {
    title?: string;
    content?: JSONContent;
    pasteContent?: string;
    pasteFormat?: 'markdown' | 'html';
    items?: CheckItem[];
    bullets?: string[];
    code?: string;
    latex?: string;
    year?: string;
    questions?: string[];
    text?: string;
    flashcards?: Array<{ question: string; answer: string }>;
    headers?: string[];
    rows?: { value: string }[][];
    url?: string;
    width?: number;
    height?: number;
    paths?: Array<{ d: string; color: string; width: number }>;
    storageUrl?: string;
    fileType?: string;
    fileName?: string;
  };
  const nodeType = node.type || 'aiNote';

  const handleContentChange = (json: JSONContent, extraData?: Record<string, unknown>) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setIsSaving(true);
    debounceRef.current = setTimeout(() => {
      updateNodeData(expandedNode, { content: json, ...extraData });
      setIsSaving(false);
    }, 800);
  };

  const getTitle = () => nodeData.title || nodeData.year || 'Untitled';

  // Format node type for display (NM12)
  const formatNodeType = (type: string | undefined) => {
    if (!type) return 'Note';
    return type
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim();
  };

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
            forceTiptap={isShareView}
            forceBlockNote={!isShareView}
          />
        );

      case 'checklist':
        return (
          <ChecklistFullscreen
            items={nodeData.items || []}
            onUpdate={(items) => updateNodeData(expandedNode, { items })}
            editable={!isViewMode}
          />
        );

      case 'summary':
        return (
          <SummaryFullscreen
            bullets={nodeData.bullets || ['']}
            onChange={(bullets) => updateNodeData(expandedNode, { bullets })}
            editable={!isViewMode}
          />
        );

      case 'codeSnippet':
        return (
          <CodeFullscreen
            code={nodeData.code || ''}
            onChange={(code) => updateNodeData(expandedNode, { code })}
            editable={!isViewMode}
          />
        );

      case 'math':
        return (
          <MathFullscreen
            latex={nodeData.latex || ''}
            onChange={(latex) => updateNodeData(expandedNode, { latex })}
            editable={!isViewMode}
          />
        );

      case 'termQuestion':
        return (
          <TermQuestionFullscreen
            year={nodeData.year || ''}
            questions={nodeData.questions || ['']}
            onUpdate={(d) => updateNodeData(expandedNode, d)}
            editable={!isViewMode}
          />
        );

      case 'stickyNote':
        return (
          <StickyNoteFullscreen
            text={nodeData.text || ''}
            onChange={(text) => updateNodeData(expandedNode, { text })}
            editable={!isViewMode}
          />
        );

      case 'flashcard':
        return <FlashcardFullscreen flashcards={nodeData.flashcards || []} />;

      case 'table':
        return (
          <TableFullscreen
            headers={nodeData.headers || ['Col A', 'Col B', 'Col C']}
            rows={nodeData.rows || [[{ value: '' }]]}
            onUpdate={(d) => updateNodeData(expandedNode, d)}
            editable={!isViewMode}
          />
        );

      case 'image':
        return (
          <div className="flex items-center justify-center">
            {nodeData.url ? <img src={nodeData.url} alt={nodeData.title || 'Image'} className="max-w-full max-h-[70vh] object-contain rounded-lg" /> : <span className="text-muted-foreground">No image</span>}
          </div>
        );

      case 'embed':
        return nodeData.url ? (
          <iframe src={nodeData.url} title={nodeData.title || 'Embed'} className="w-full h-[70vh] border-0 rounded-lg" sandbox="allow-scripts allow-same-origin allow-popups allow-forms" />
        ) : <span className="text-muted-foreground">No URL set</span>;

      case 'drawing':
        return (
          <svg width={nodeData.width || 800} height={nodeData.height || 600} className="rounded-lg bg-muted">
            {(nodeData.paths || []).map((p, i) => (
              <path key={i} d={p.d} stroke={p.color} strokeWidth={p.width} fill="none" strokeLinecap="round" strokeLinejoin="round" />
            ))}
          </svg>
        );

      case 'video': {
        const ytMatch = (nodeData.url || '').match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
        const vimeoMatch = (nodeData.url || '').match(/vimeo\.com\/(\d+)/);
        const embedUrl = ytMatch
          ? `https://www.youtube.com/embed/${ytMatch[1]}?rel=0&autoplay=1`
          : vimeoMatch
            ? `https://player.vimeo.com/video/${vimeoMatch[1]}?autoplay=1`
            : null;
        return embedUrl ? (
          <iframe src={embedUrl} title={nodeData.title || 'Video'} className="w-full aspect-video rounded-lg border-0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
        ) : <span className="text-muted-foreground">No video URL set</span>;
      }

      case 'text':
        return (
          <StickyNoteFullscreen
            text={nodeData.text || ''}
            onChange={(text) => updateNodeData(expandedNode, { text })}
            editable={!isViewMode}
          />
        );

      case 'pdf': {
        if (!nodeData.storageUrl) return <span className="text-muted-foreground">No document uploaded</span>;
        const ft = nodeData.fileType as string | undefined;
        const isOffice = ft === 'doc' || ft === 'docx' || ft === 'ppt' || ft === 'pptx';
        const src = isOffice
          ? `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(nodeData.storageUrl)}`
          : nodeData.storageUrl;
        return <iframe src={src} title={nodeData.fileName || 'Document'} className="w-full h-[70vh] border-0 rounded-lg" allowFullScreen />;
      }

      default:
        return <div className="text-muted-foreground text-center py-8">This node type doesn't support fullscreen editing yet.</div>;
    }
  };

  if (isMobile) {
    return (
      <Drawer.Root open={!!expandedNode} onOpenChange={(open) => !open && handleClose()}>
        <Drawer.Portal>
          <Drawer.Overlay 
            className="fixed inset-0 z-[150] bg-black/40 backdrop-blur-sm" 
            aria-hidden="true"
          />
          <Drawer.Content 
            className="fixed bottom-0 left-0 right-0 z-[160] flex h-[92vh] flex-col rounded-t-[20px] bg-card border-t shadow-2xl focus:outline-none"
            role="dialog"
            aria-modal="true"
            aria-labelledby="mobile-drawer-title"
            aria-describedby="mobile-drawer-desc"
          >
            <div className="mx-auto mt-4 h-1.5 w-12 shrink-0 rounded-full bg-border" />
            
            <div className="flex items-center justify-between px-6 py-4 border-b border-border/50">
              <div className="flex flex-col overflow-hidden mr-4">
                 <h2 id="mobile-drawer-title" className="text-lg font-bold truncate tracking-tight">{getTitle()}</h2>
                 <p id="mobile-drawer-desc" className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest leading-none mt-1">
                   {formatNodeType(node.type)}
                 </p>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={handleShare} 
                  className="p-2 rounded-full bg-accent/50"
                  aria-label="Share note"
                >
                  <Share2 className="h-4 w-4" />
                </button>
                <button 
                  onClick={handleClose} 
                  className="p-2 rounded-full bg-accent"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 scrollbar-hide pb-28">
              {renderContent()}
            </div>

            <div className="absolute bottom-0 left-0 right-0 p-4 bg-background/80 backdrop-blur-md border-t flex justify-between items-center z-10 min-h-[56px]">
              <button 
                onClick={handlePrev} 
                disabled={expandableIndex <= 0}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-border bg-card text-xs font-bold disabled:opacity-30 active:scale-95 transition-transform"
                aria-label="Previous node"
              >
                <ChevronLeft className="h-4 w-4" /> Previous
              </button>
              <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest" aria-live="polite">
                {expandableIndex + 1} / {expandableNodes.length}
              </span>
              <button 
                onClick={handleNext}
                disabled={expandableIndex >= expandableNodes.length - 1}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-border bg-card text-xs font-bold disabled:opacity-30 active:scale-95 transition-transform text-primary"
                aria-label="Next node"
              >
                Next <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    );
  }

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center bg-background/90 backdrop-blur-sm"
      role="presentation"
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="node-modal-title"
        aria-describedby="node-modal-desc"
        className={cn(
          "relative overflow-hidden rounded-xl border border-border bg-card shadow-[var(--clay-shadow-md)] animate-brutal-pop transition-all duration-200 flex flex-col",

          isFullscreen ? 'w-full h-full max-w-full max-h-full rounded-none' : 'w-full max-w-5xl max-h-[90vh]'
        )}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card px-6 py-4">
          <input
            ref={titleInputRef}
            id="node-modal-title"
            className="flex-1 bg-transparent text-lg font-bold tracking-tight text-foreground outline-none placeholder:text-muted-foreground"
            value={getTitle()}
            onChange={(e) => {
              const key = nodeType === 'termQuestion' ? 'year' : 'title';
              updateNodeData(expandedNode, { [key]: e.target.value });
            }}
            placeholder="Untitled"
            aria-label="Node title"
          />
          <div className="flex items-center gap-1">
            {isSaving && (
              <span className="text-[10px] text-muted-foreground animate-pulse mr-2" aria-live="polite">Saving...</span>
            )}
            <button
               onClick={handleShare}
               className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground hidden sm:block"
               title="Share Note"
               aria-label="Share note"
            >
               <Share2 className="h-4 w-4" />
            </button>
            {(nodeType === 'aiNote' || nodeType === 'lectureNotes') && (
              <button
                onClick={() => setShowOutline(!showOutline)}
                className={cn(
                  "rounded-lg p-1.5 transition-all text-muted-foreground",
                  showOutline ? "bg-primary text-primary-foreground shadow-sm" : "hover:bg-accent hover:text-foreground"
                )}
                title="Toggle outline"
                aria-label="Toggle outline"
                aria-pressed={showOutline}
              >
                <ListIcon className="h-4 w-4" />
              </button>
            )}
            <button
              onClick={() => setIsFullscreen(f => !f)}
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
              title={isFullscreen ? 'Exit fullscreen (F11)' : 'Fullscreen (F11)'}
              aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            >
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>
            <button
              onClick={handleClose}
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
              aria-label="Close modal"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 flex overflow-hidden">
          <div className="flex-1 overflow-y-auto px-6 py-4 scrollbar-hide">
             <div className="max-w-4xl mx-auto">
                {renderContent()}
             </div>
          </div>
          
          {(nodeType === 'aiNote' || nodeType === 'lectureNotes') && showOutline && (
            <div className="w-64 border-l-2 border-border hidden md:block">
              <OutlinePanel 
                editor={editorRef.current?.getEditor() || null} 
                onClose={() => setShowOutline(false)}
              />
            </div>
          )}
        </div>

        {/* Desktop Footer Nav */}
        <div className="border-t-2 border-border px-6 py-3 flex items-center justify-between text-muted-foreground overflow-hidden">
           <div className="flex items-center gap-4">
              <button 
                onClick={handlePrev} 
                disabled={expandableIndex <= 0}
                className="hover:text-primary disabled:opacity-30 transition-colors uppercase text-[10px] font-black tracking-widest focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded px-2 py-1"
                aria-label="Previous node"
              >
                ← Previous
              </button>
              <div className="h-4 w-[1px] bg-border" />
              <button 
                onClick={handleNext} 
                disabled={expandableIndex >= expandableNodes.length - 1}
                className="hover:text-primary disabled:opacity-30 transition-colors uppercase text-[10px] font-black tracking-widest text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded px-2 py-1"
                aria-label="Next node"
              >
                Next →
              </button>
           </div>
           <span id="node-modal-desc" className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40" aria-live="polite">
             {expandableIndex + 1} / {expandableNodes.length}
           </span>
        </div>
      </div>
    </div>
  );
}
