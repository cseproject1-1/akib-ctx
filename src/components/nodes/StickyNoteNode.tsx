import { memo, useCallback, useMemo, useRef, useEffect } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { useCanvasStore } from '@/store/canvasStore';
import { Expand } from 'lucide-react';
import { StickyNoteNodeData } from '@/types/canvas';

const STICKY_COLORS: Record<string, { bg: string; text: string }> = {
  yellow: { bg: 'hsl(52, 100%, 50%)', text: 'hsl(0, 0%, 0%)' },
  green: { bg: 'hsl(142, 71%, 45%)', text: 'hsl(0, 0%, 0%)' },
  cyan: { bg: 'hsl(187, 85%, 53%)', text: 'hsl(0, 0%, 0%)' },
  orange: { bg: 'hsl(25, 95%, 53%)', text: 'hsl(0, 0%, 0%)' },
  purple: { bg: 'hsl(263, 70%, 58%)', text: 'hsl(0, 0%, 100%)' },
  pink: { bg: 'hsl(330, 80%, 60%)', text: 'hsl(0, 0%, 0%)' },
};

const FONT_SIZES: Record<string, number> = { S: 12, M: 16, L: 22 };
const FONT_CYCLE: ('S' | 'M' | 'L')[] = ['S', 'M', 'L'];

export const StickyNoteNode = memo(({ id, data, selected }: NodeProps) => {
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const setExpandedNode = useCanvasStore((s) => s.setExpandedNode);
  const nodeData = data as unknown as StickyNoteNodeData;
  const color = nodeData.color || 'yellow';
  const text = nodeData.text || '';
  const fontSize: 'S' | 'M' | 'L' = nodeData.fontSize || 'M';
  const opacity: number = nodeData.opacity ?? 100;
  const palette = STICKY_COLORS[color] || STICKY_COLORS.yellow;
  
  // Debounce text updates (SN1)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  const handleTextChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        updateNodeData(id, { text: e.target.value });
      }, 300);
    },
    [id, updateNodeData]
  );

  const cycleFontSize = useCallback(() => {
    const idx = FONT_CYCLE.indexOf(fontSize);
    const next = FONT_CYCLE[(idx + 1) % FONT_CYCLE.length];
    updateNodeData(id, { fontSize: next });
  }, [id, fontSize, updateNodeData]);

  const wordCount = useMemo(() => {
    if (!text.trim()) return null;
    const words = text.trim().split(/\s+/).length;
    return `${words}w`;
  }, [text]);

  return (
    <div
      className="animate-node-appear h-full w-full rounded-lg border-2 transition-all relative group touch-manipulation"
      style={{
        backgroundColor: palette.bg,
        borderColor: selected ? 'hsl(var(--primary))' : 'hsl(0, 0%, 25%)',
        boxShadow: selected
          ? '4px 4px 0px hsl(var(--primary)), 0 0 20px hsla(52,100%,50%,0.15)'
          : 'var(--brutal-shadow)',
      }}
    >
      <textarea
        className="absolute inset-0 w-full h-full resize-none bg-transparent p-3 font-semibold outline-none placeholder:opacity-50 nodrag nowheel nopan"
        style={{ color: palette.text, fontSize: FONT_SIZES[fontSize], opacity: opacity / 100 }}
        value={text}
        onChange={handleTextChange}
        placeholder="Quick note..."
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        readOnly={!selected}
        aria-label="Sticky note content"
        aria-placeholder="Quick note..."
      />

      {/* Fullscreen button - always visible on touch, hover on desktop (SN3) */}
      <button
        className="absolute top-1 left-1 rounded px-1 py-0.5 text-[10px] opacity-70 hover:opacity-100 sm:group-hover:opacity-70 transition-opacity focus:opacity-100 focus:outline-none focus:ring-1"
        style={{ color: palette.text, backgroundColor: 'rgba(0,0,0,0.15)' }}
        onClick={(e) => { e.stopPropagation(); setExpandedNode(id); }}
        title="Fullscreen"
        aria-label="Open in fullscreen"
      >
        <Expand className="h-3 w-3" />
      </button>

      {/* Font size toggle - always visible on touch, hover on desktop (SN3) */}
      <button
        className="absolute top-1 right-1 rounded px-1.5 py-0.5 text-[10px] font-bold opacity-70 hover:opacity-100 sm:group-hover:opacity-70 transition-opacity focus:opacity-100 focus:outline-none focus:ring-1"
        style={{ color: palette.text, backgroundColor: 'rgba(0,0,0,0.15)' }}
        onClick={(e) => { e.stopPropagation(); cycleFontSize(); }}
        title={`Font size: ${fontSize} (click to cycle)`}
        aria-label={`Font size ${fontSize}, click to change`}
      >
        {fontSize}
      </button>

      {/* Word count */}
      {wordCount && (
        <span
          className="absolute bottom-1 right-2 text-[9px] font-bold opacity-50 sm:group-hover:opacity-50 group-focus-within:opacity-50"
          style={{ color: palette.text }}
          aria-live="polite"
        >
          {wordCount}
        </span>
      )}

      <Handle type="source" position={Position.Top} id="top" className="perimeter-handle !-top-1 !left-0 !w-full !h-2.5 !rounded-none !transform-none" />
      <Handle type="source" position={Position.Bottom} id="bottom" className="perimeter-handle !-bottom-1 !left-0 !w-full !h-2.5 !rounded-none !transform-none" />
      <Handle type="source" position={Position.Left} id="left" className="perimeter-handle !-left-1 !top-0 !h-full !w-2.5 !rounded-none !transform-none" />
      <Handle type="source" position={Position.Right} id="right" className="perimeter-handle !-right-1 !top-0 !h-full !w-2.5 !rounded-none !transform-none" />
      <div className="anchor-dot top-0 left-1/2 -translate-x-1/2 -translate-y-1/2" title="Top anchor" aria-hidden="true" />
      <div className="anchor-dot bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2" title="Bottom anchor" aria-hidden="true" />
      <div className="anchor-dot left-0 top-1/2 -translate-x-1/2 -translate-y-1/2" title="Left anchor" aria-hidden="true" />
      <div className="anchor-dot right-0 top-1/2 translate-x-1/2 -translate-y-1/2" title="Right anchor" aria-hidden="true" />
    </div>
  );
});

StickyNoteNode.displayName = 'StickyNoteNode';
