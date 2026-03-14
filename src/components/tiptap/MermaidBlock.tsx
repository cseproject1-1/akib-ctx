import { NodeViewWrapper, NodeViewProps } from '@tiptap/react';
import { useState, useEffect, useRef, useCallback } from 'react';
import mermaid from 'mermaid';
import { Settings, Play, SplitSquareHorizontal, Download, Trash2 } from 'lucide-react';

// Initialize mermaid once globally if in a browser environment
if (typeof window !== 'undefined') {
  mermaid.initialize({
    startOnLoad: false,
    theme: 'default',
    securityLevel: 'loose',
  });
}

export function MermaidBlock(props: NodeViewProps) {
  const [code, setCode] = useState(props.node.attrs.code || 'graph TD\n  A[Start] --> B[End]');
  const [isPreview, setIsPreview] = useState(props.node.attrs.previewMode ?? true);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const graphId = useRef(props.node.attrs.id || `mermaid-${Math.random().toString(36).substr(2, 9)}`);


  const renderDiagram = useCallback(async () => {
    if (!containerRef.current) return;
    setError(null);
    try {
      const { svg } = await mermaid.render(graphId.current, code);
      if (containerRef.current) {
        containerRef.current.innerHTML = svg;
      }
    } catch (err: any) {
      console.error('Mermaid render error:', err);
      setError(err?.message || 'Syntax Error in Mermaid diagram');
    }
  }, [code]);

  useEffect(() => {
    if (isPreview && containerRef.current) {
      renderDiagram();
    }
  }, [code, isPreview, renderDiagram]);

  const handleApply = () => {
    props.updateAttributes({ code, previewMode: true });
    setIsPreview(true);
  };

  const downloadSvg = () => {
    if (!containerRef.current?.querySelector('svg')) return;
    const svgStr = containerRef.current.innerHTML;
    const blob = new Blob([svgStr], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `diagram-${Date.now()}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <NodeViewWrapper className="my-4 rounded-xl border-2 border-border bg-card shadow-[4px_4px_0px_hsl(0,0%,15%)] overflow-hidden" contentEditable="false">
      <div className="flex items-center justify-between border-b-2 border-border bg-muted/30 px-3 py-2">
        <div className="flex gap-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          <span className="flex items-center gap-1"><SplitSquareHorizontal className="h-3.5 w-3.5" /> Mermaid Diagram</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsPreview(!isPreview)}
            className={`rounded-md px-2 py-1 text-xs font-bold transition-colors ${isPreview ? 'bg-primary/20 text-primary' : 'bg-transparent text-muted-foreground hover:bg-muted'}`}
            title="Toggle Preview"
          >
            {isPreview ? 'Preview' : 'Code'}
          </button>
          {isPreview && (
            <button
              onClick={downloadSvg}
              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-primary/20 hover:text-primary"
              title="Download SVG"
            >
              <Download className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            onClick={() => props.deleteNode()}
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/20 hover:text-destructive"
            title="Delete Block"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row relative min-h-[200px]">
        {/* Editor Pane */}
        {!isPreview && (
          <div className="flex-1 border-r-2 border-border p-0">
            <textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="h-full min-h-[200px] w-full resize-none border-0 bg-background/50 p-4 text-xs font-mono outline-none text-foreground placeholder:text-muted-foreground/50"
              spellCheck={false}
              placeholder="Enter Mermaid syntax here..."
            />
            <div className="absolute bottom-4 right-4 flex items-center gap-2">
              <button
                onClick={handleApply}
                className="flex items-center gap-1 rounded bg-primary px-3 py-1 text-xs font-bold text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
              >
                <Play className="h-3 w-3" /> Render
              </button>
            </div>
          </div>
        )}

        {/* Preview Pane */}
        {(isPreview || error) && (
          <div className="flex-1 flex flex-col items-center justify-center p-6 min-h-[200px] bg-background">
            {error ? (
              <div className="text-center">
                <p className="text-sm font-bold text-destructive mb-2 uppercase tracking-wide">Diagram Error</p>
                <code className="text-[10px] text-destructive/80 bg-destructive/10 px-2 py-1 rounded block max-w-sm whitespace-pre-wrap">{error}</code>
                <button
                  onClick={() => setIsPreview(false)}
                  className="mt-4 rounded bg-border px-3 py-1 text-xs font-bold text-foreground hover:bg-muted"
                >
                  Edit Code
                </button>
              </div>
            ) : (
              <div 
                ref={containerRef} 
                className="mermaid flex items-center justify-center w-full [&_svg]:max-w-full [&_svg]:h-auto"
              >
                {/* SVG rendered here */}
              </div>
            )}
          </div>
        )}
      </div>
    </NodeViewWrapper>
  );
}
