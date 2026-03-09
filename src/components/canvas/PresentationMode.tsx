import { useState, useEffect, useCallback, useRef, forwardRef } from 'react';
import { useCanvasStore } from '@/store/canvasStore';
import { X, ChevronLeft, ChevronRight, Maximize, Minimize } from 'lucide-react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

export const PresentationMode = forwardRef<HTMLDivElement>(function PresentationMode(_props, ref) {
  const { nodes } = useCanvasStore();
  const [active, setActive] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const mathRef = useRef<HTMLDivElement>(null);

  // Sort nodes top-to-bottom, left-to-right for slide order
  const sortedNodes = [...nodes]
    .filter((n) => n.type !== 'group' && n.type !== 'shape' && n.type !== 'drawing')
    .sort((a, b) => a.position.y - b.position.y || a.position.x - b.position.x);

  const total = sortedNodes.length;
  const current = sortedNodes[currentIndex];

  // Render KaTeX for math nodes
  useEffect(() => {
    if (!active || !current || current.type !== 'math' || !mathRef.current) return;
    const latex = (current.data as any)?.latex || '';
    if (!latex.trim()) {
      mathRef.current.innerHTML = '<span class="text-muted-foreground italic">No equation</span>';
      return;
    }
    try {
      katex.render(latex, mathRef.current, { displayMode: true, throwOnError: false, trust: true, strict: false });
    } catch {
      mathRef.current.innerHTML = '<span class="text-destructive">Invalid LaTeX</span>';
    }
  }, [active, current, currentIndex]);

  // Keyboard navigation
  useEffect(() => {
    if (!active) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        setCurrentIndex((i) => Math.min(i + 1, total - 1));
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setCurrentIndex((i) => Math.max(i - 1, 0));
      }
      if (e.key === 'Escape') {
        setActive(false);
        setFullscreen(false);
        if (document.fullscreenElement) document.exitFullscreen();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [active, total]);

  // Listen for activation via custom event
  useEffect(() => {
    const handler = () => { setActive(true); setCurrentIndex(0); };
    window.addEventListener('start-presentation', handler);
    return () => window.removeEventListener('start-presentation', handler);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setFullscreen(true);
    } else {
      document.exitFullscreen();
      setFullscreen(false);
    }
  }, []);

  if (!active || total === 0) return null;

  const nodeTitle = (current?.data as any)?.title || (current?.data as any)?.text || (current?.data as any)?.fileName || `Slide ${currentIndex + 1}`;

  return (
    <div ref={ref} className="fixed inset-0 z-[80] flex flex-col bg-background">
      {/* Top bar */}
      <div className="flex items-center justify-between border-b-2 border-border px-6 py-3">
        <span className="text-sm font-bold uppercase tracking-wider text-foreground">
          Presentation — {currentIndex + 1} / {total}
        </span>
        <div className="flex items-center gap-2">
          <button onClick={toggleFullscreen} className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground" title="Fullscreen">
            {fullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
          </button>
          <button onClick={() => { setActive(false); setFullscreen(false); if (document.fullscreenElement) document.exitFullscreen(); }} className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground" title="Exit">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-1 items-center justify-center p-8 overflow-auto">
        <div className="max-w-3xl w-full rounded-xl border-2 border-border bg-card p-8 shadow-[var(--brutal-shadow-lg)]">
          <h2 className="mb-4 text-xl font-bold uppercase tracking-wider text-foreground">{nodeTitle}</h2>
          {renderSlideContent(current, mathRef)}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-center gap-4 border-t-2 border-border py-4">
        <button
          onClick={() => setCurrentIndex((i) => Math.max(i - 1, 0))}
          disabled={currentIndex === 0}
          className="brutal-btn flex items-center gap-1 rounded-lg bg-card px-4 py-2 text-sm font-bold uppercase text-foreground disabled:opacity-30"
        >
          <ChevronLeft className="h-4 w-4" /> Previous
        </button>
        <div className="flex items-center gap-1.5">
          {sortedNodes.length <= 20 && sortedNodes.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentIndex(i)}
              className={`h-2 w-2 rounded-full transition-all ${i === currentIndex ? 'bg-primary scale-125' : 'bg-muted-foreground/30 hover:bg-muted-foreground'}`}
            />
          ))}
          {sortedNodes.length > 20 && (
            <span className="text-xs font-bold text-muted-foreground">{currentIndex + 1} / {total}</span>
          )}
        </div>
        <button
          onClick={() => setCurrentIndex((i) => Math.min(i + 1, total - 1))}
          disabled={currentIndex === total - 1}
          className="brutal-btn flex items-center gap-1 rounded-lg bg-primary px-4 py-2 text-sm font-bold uppercase text-primary-foreground disabled:opacity-30"
        >
          Next <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
});

PresentationMode.displayName = 'PresentationMode';

function renderSlideContent(current: any, mathRef: React.RefObject<HTMLDivElement | null>) {
  if (!current) return null;
  const d = current.data as any;

  switch (current.type) {
    case 'aiNote':
    case 'lectureNotes':
      return <div className="tiptap-editor prose text-foreground" dangerouslySetInnerHTML={{ __html: getNodeHtml(current) }} />;

    case 'summary':
      return (
        <ul className="space-y-2">
          {(d.bullets || []).map((b: string, i: number) => (
            <li key={i} className="text-foreground">• {b}</li>
          ))}
        </ul>
      );

    case 'stickyNote':
    case 'text':
      return <p className="text-foreground whitespace-pre-wrap">{d.text}</p>;

    case 'checklist':
      return (
        <ul className="space-y-1">
          {(d.items || []).map((item: any) => (
            <li key={item.id} className={`flex items-center gap-2 ${item.done ? 'line-through opacity-50' : ''}`}>
              <input type="checkbox" checked={item.done} readOnly className="accent-primary" />
              <span className="text-foreground">{item.text}</span>
            </li>
          ))}
        </ul>
      );

    case 'image':
      return d.storageUrl
        ? <img src={d.storageUrl} alt={d.altText} className="max-h-[60vh] rounded-lg mx-auto" />
        : <p className="text-muted-foreground">No image</p>;

    case 'math':
      return <div ref={mathRef} className="flex items-center justify-center min-h-[60px] text-foreground" style={{ fontSize: '1.4rem' }} />;

    case 'video':
      if (d.url) {
        const ytMatch = d.url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
        const vimeoMatch = d.url.match(/vimeo\.com\/(\d+)/);
        if (ytMatch) return <iframe src={`https://www.youtube.com/embed/${ytMatch[1]}?rel=0`} className="w-full aspect-video rounded-lg" allowFullScreen />;
        if (vimeoMatch) return <iframe src={`https://player.vimeo.com/video/${vimeoMatch[1]}`} className="w-full aspect-video rounded-lg" allowFullScreen />;
      }
      return <p className="text-muted-foreground italic">No video</p>;

    case 'table':
      return (
        <div className="overflow-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                {(d.headers || []).map((h: string, i: number) => (
                  <th key={i} className="border border-border bg-muted px-3 py-2 text-left font-bold text-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(d.rows || []).map((row: any[], ri: number) => (
                <tr key={ri}>
                  {row.map((cell: any, ci: number) => (
                    <td key={ci} className="border border-border px-3 py-2 text-foreground">{cell.value || '—'}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );

    case 'flashcard':
      return (
        <div className="space-y-3">
          {(d.flashcards || []).map((fc: any, i: number) => (
            <div key={i} className="rounded-lg border border-border p-3">
              <p className="text-xs font-bold uppercase text-muted-foreground mb-1">Q{i + 1}</p>
              <p className="text-foreground font-semibold">{fc.question}</p>
              <p className="mt-2 text-sm text-muted-foreground">{fc.answer}</p>
            </div>
          ))}
        </div>
      );

    case 'embed':
      return d.url
        ? <iframe src={d.url} className="w-full aspect-video rounded-lg" sandbox="allow-scripts allow-same-origin allow-popups" />
        : <p className="text-muted-foreground italic">No embed URL</p>;

    case 'termQuestion':
      return (
        <div>
          {d.year && <p className="text-sm font-bold text-primary mb-2">{d.year}</p>}
          <ul className="space-y-1">
            {(d.questions || []).map((q: string, i: number) => (
              <li key={i} className="text-foreground">{i + 1}. {q}</li>
            ))}
          </ul>
        </div>
      );

    default:
      return <p className="text-muted-foreground italic">Content preview not available for this node type.</p>;
  }
}

function getNodeHtml(node: any): string {
  const content = node.data?.content;
  if (!content) return '<p class="text-muted-foreground italic">Empty note</p>';
  if (typeof content === 'object' && content.type === 'doc') {
    return renderTiptapJson(content);
  }
  return '<p class="text-muted-foreground italic">Content available in editor</p>';
}

function renderTiptapJson(doc: any): string {
  if (!doc.content) return '';
  return doc.content.map((node: any) => renderTiptapNode(node)).join('');
}

function renderTiptapNode(node: any): string {
  switch (node.type) {
    case 'paragraph':
      return `<p>${renderInline(node.content)}</p>`;
    case 'heading':
      return `<h${node.attrs?.level || 2}>${renderInline(node.content)}</h${node.attrs?.level || 2}>`;
    case 'bulletList':
      return `<ul>${(node.content || []).map((li: any) => renderTiptapNode(li)).join('')}</ul>`;
    case 'orderedList':
      return `<ol>${(node.content || []).map((li: any) => renderTiptapNode(li)).join('')}</ol>`;
    case 'listItem':
      return `<li>${(node.content || []).map((c: any) => renderTiptapNode(c)).join('')}</li>`;
    case 'blockquote':
      return `<blockquote>${(node.content || []).map((c: any) => renderTiptapNode(c)).join('')}</blockquote>`;
    case 'codeBlock':
      return `<pre><code>${renderInline(node.content)}</code></pre>`;
    case 'horizontalRule':
      return '<hr>';
    default:
      return renderInline(node.content);
  }
}

function renderInline(content: any[]): string {
  if (!content) return '';
  return content.map((node: any) => {
    if (node.type === 'text') {
      let text = node.text || '';
      text = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      if (node.marks) {
        for (const mark of node.marks) {
          if (mark.type === 'bold') text = `<strong>${text}</strong>`;
          if (mark.type === 'italic') text = `<em>${text}</em>`;
          if (mark.type === 'strike') text = `<s>${text}</s>`;
          if (mark.type === 'code') text = `<code>${text}</code>`;
          if (mark.type === 'link') text = `<a href="${mark.attrs?.href || '#'}">${text}</a>`;
        }
      }
      return text;
    }
    if (node.type === 'hardBreak') return '<br>';
    return '';
  }).join('');
}
