import { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { type NodeProps } from '@xyflow/react';
import { BaseNode } from './BaseNode';
import { Sigma, Eye, Code2 } from 'lucide-react';
import { useCanvasStore } from '@/store/canvasStore';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { MathNodeData } from '@/types/canvas';

const EXAMPLES = [
  '\\int_{0}^{\\infty} e^{-x^2} dx = \\frac{\\sqrt{\\pi}}{2}',
  'E = mc^2',
  '\\sum_{n=1}^{\\infty} \\frac{1}{n^2} = \\frac{\\pi^2}{6}',
  'f(x) = \\frac{1}{\\sigma\\sqrt{2\\pi}} e^{-\\frac{(x-\\mu)^2}{2\\sigma^2}}',
];

export function MathNode({ id, data, selected }: NodeProps) {
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const canvasMode = useCanvasStore((s) => s.canvasMode);
  const nodeData = data as unknown as MathNodeData;
  const [latex, setLatex] = useState(nodeData.latex || '');
  const [viewMode, setViewMode] = useState<'split' | 'preview'>('split');
  const previewRef = useRef<HTMLDivElement>(null);
  const isView = canvasMode === 'view';

  // Stable placeholder that doesn't change on re-render
  const placeholder = useMemo(() => EXAMPLES[Math.floor(Math.random() * EXAMPLES.length)], []);

  const renderKatex = useCallback(() => {
    if (!previewRef.current) return;
    const expression = latex || '';
    if (!expression.trim()) {
      previewRef.current.innerHTML = '<span class="text-muted-foreground italic text-sm">LaTeX preview…</span>';
      return;
    }
    try {
      katex.render(expression, previewRef.current, {
        displayMode: true,
        throwOnError: false,
        trust: true,
        strict: false,
        output: 'html',
      });
    } catch {
      previewRef.current.innerHTML = '<span class="text-destructive text-xs">Invalid LaTeX</span>';
    }
  }, [latex]);

  useEffect(() => {
    renderKatex();
  }, [renderKatex]);

  // Sync local state from data changes (e.g. undo/redo)
  const dataLatex = nodeData.latex;
  useEffect(() => {
    if (dataLatex !== undefined && dataLatex !== latex) {
      setLatex(dataLatex);
    }
  }, [dataLatex, latex]);

  const handleChange = (val: string) => {
    setLatex(val);
    updateNodeData(id, { latex: val });
  };

  // In view mode or preview-only, show only the rendered output
  if (isView || viewMode === 'preview') {
    return (
      <BaseNode
        id={id}
        title={nodeData.title || 'Math'}
        icon={<Sigma className="h-4 w-4" />}
        selected={selected}
        onTitleChange={isView ? undefined : (t) => updateNodeData(id, { title: t })}
        tags={nodeData.tags}
        locked={nodeData.locked}
        color={nodeData.color}
        headerExtra={
          !isView ? (
            <button
              onClick={(e) => { e.stopPropagation(); setViewMode('split'); }}
              className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
              title="Show editor"
            >
              <Code2 className="h-3.5 w-3.5" />
            </button>
          ) : undefined
        }
      >
        <div className="p-4" onClick={(e) => e.stopPropagation()}>
          <div
            ref={previewRef}
            className="min-h-[50px] overflow-auto text-foreground"
            onDoubleClick={() => !isView && setViewMode('split')}
            style={{ fontSize: '1.1rem' }}
          />
        </div>
      </BaseNode>
    );
  }

  // Split view: editor on left, preview on right
  return (
    <BaseNode
      id={id}
      title={nodeData.title || 'Math'}
      icon={<Sigma className="h-4 w-4" />}
      selected={selected}
      onTitleChange={(t) => updateNodeData(id, { title: t })}
      tags={nodeData.tags}
      locked={nodeData.locked}
      color={nodeData.color}
      headerExtra={
        <button
          onClick={(e) => { e.stopPropagation(); setViewMode('preview'); }}
          className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
          title="Preview only"
        >
          <Eye className="h-3.5 w-3.5" />
        </button>
      }
    >
      <div className="flex h-full min-h-[120px]" onClick={(e) => e.stopPropagation()}>
        {/* Editor pane */}
        <div className="flex-1 border-r-2 border-border flex flex-col">
          <div className="px-2 py-1 border-b border-border/50">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">LaTeX</span>
          </div>
          <textarea
            className="flex-1 w-full bg-transparent p-2 font-mono text-xs text-foreground outline-none resize-none placeholder:text-muted-foreground/50"
            value={latex}
            onChange={(e) => handleChange(e.target.value)}
            placeholder={placeholder}
            onKeyDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            spellCheck={false}
          />
        </div>

        {/* Preview pane */}
        <div className="flex-1 flex flex-col">
          <div className="px-2 py-1 border-b border-border/50">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Preview</span>
          </div>
          <div className="flex-1 flex items-center justify-center p-3 overflow-auto">
            <div
              ref={previewRef}
              className="text-foreground"
              style={{ fontSize: '1.1rem' }}
            />
          </div>
        </div>
      </div>
    </BaseNode>
  );
}
