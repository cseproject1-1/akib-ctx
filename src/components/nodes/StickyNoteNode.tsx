import { memo, useCallback, useMemo, useRef, useEffect } from 'react';
import { Handle, Position, type NodeProps, NodeResizer } from '@xyflow/react';
import { useCanvasStore } from '@/store/canvasStore';
import { Expand } from 'lucide-react';
import { StickyNoteNodeData } from '@/types/canvas';
import { HANDLE_IDS } from '@/lib/constants/canvas';

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

  const handleResizeEnd = useCallback(
    (_event: unknown, params: { width: number; height: number }) => {
      updateNodeData(id, {
        width: Math.round(params.width),
        height: Math.round(params.height),
      });
    },
    [id, updateNodeData]
  );

  const wordCount = useMemo(() => {
    if (!text.trim()) return null;
    const words = text.trim().split(/\s+/).length;
    return `${words}w`;
  }, [text]);

  return (
    <div
      className="animate-node-appear h-full w-full rounded-xl border transition-all relative group touch-manipulation"
      style={{
        backgroundColor: palette.bg,
        borderColor: selected ? 'hsl(var(--primary))' : 'hsl(0, 0%, 20%)',
        boxShadow: selected
          ? '4px 4px 0px hsl(var(--primary)), 0 0 20px hsla(52,100%,50%,0.2)'
          : 'var(--brutal-shadow)',
        width: nodeData.width,
        height: nodeData.height,
      }}
    >
      <NodeResizer
        isVisible={selected}
        minWidth={150}
        minHeight={100}
        onResizeEnd={handleResizeEnd}
        lineClassName="!border-primary/40"
        handleClassName="!w-2.5 !h-2.5 !bg-primary !border-2 !border-background !rounded-sm"
      />
      <textarea
        className="absolute inset-0 w-full h-full resize-none bg-transparent p-3 font-medium outline-none placeholder:opacity-50 nodrag nowheel nopan"
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

      {/* Action buttons - subtle on hover */}
      <div className="absolute top-1 left-1 right-1 flex justify-between items-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none group-hover:pointer-events-auto">
        <button
          className="rounded px-1 py-0.5 text-[10px] pointer-events-auto transition-opacity hover:opacity-100 focus:opacity-100 focus:outline-none"
          style={{ color: palette.text, backgroundColor: 'rgba(0,0,0,0.1)' }}
          onClick={(e) => { e.stopPropagation(); setExpandedNode(id); }}
          title="Fullscreen"
          aria-label="Open in fullscreen"
        >
          <Expand className="h-3 w-3" />
        </button>

        <button
          className="rounded px-1.5 py-0.5 text-[10px] font-medium pointer-events-auto transition-opacity hover:opacity-100 focus:opacity-100 focus:outline-none"
          style={{ color: palette.text, backgroundColor: 'rgba(0,0,0,0.1)' }}
          onClick={(e) => { e.stopPropagation(); cycleFontSize(); }}
          title={`Font size: ${fontSize} (click to cycle)`}
          aria-label={`Font size ${fontSize}, click to change`}
        >
          {fontSize}
        </button>
      </div>

      {/* Word count - always visible but subtle */}
      {wordCount && (
        <span
          className="absolute bottom-1 right-2 text-[9px] font-medium opacity-40"
          style={{ color: palette.text }}
          aria-live="polite"
        >
          {wordCount}
        </span>
      )}

      <Handle type="target" position={Position.Top} id={HANDLE_IDS.TARGET.TOP} className="perimeter-handle !-top-1 !left-0 !w-full !h-2.5 !rounded-none !transform-none" />
      <Handle type="source" position={Position.Top} id={HANDLE_IDS.SOURCE.TOP} className="perimeter-handle !-top-1 !left-0 !w-full !h-2.5 !rounded-none !transform-none" />
      <Handle type="target" position={Position.Bottom} id={HANDLE_IDS.TARGET.BOTTOM} className="perimeter-handle !-bottom-1 !left-0 !w-full !h-2.5 !rounded-none !transform-none" />
      <Handle type="source" position={Position.Bottom} id={HANDLE_IDS.SOURCE.BOTTOM} className="perimeter-handle !-bottom-1 !left-0 !w-full !h-2.5 !rounded-none !transform-none" />
      <Handle type="target" position={Position.Left} id={HANDLE_IDS.TARGET.LEFT} className="perimeter-handle !-left-1 !top-0 !h-full !w-2.5 !rounded-none !transform-none" />
      <Handle type="source" position={Position.Left} id={HANDLE_IDS.SOURCE.LEFT} className="perimeter-handle !-left-1 !top-0 !h-full !w-2.5 !rounded-none !transform-none" />
      <Handle type="target" position={Position.Right} id={HANDLE_IDS.TARGET.RIGHT} className="perimeter-handle !-right-1 !top-0 !h-full !w-2.5 !rounded-none !transform-none" />
      <Handle type="source" position={Position.Right} id={HANDLE_IDS.SOURCE.RIGHT} className="perimeter-handle !-right-1 !top-0 !h-full !w-2.5 !rounded-none !transform-none" />
      <div className="anchor-dot top-0 left-1/2 -translate-x-1/2 -translate-y-1/2" title="Top anchor" aria-hidden="true" />
      <div className="anchor-dot bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2" title="Bottom anchor" aria-hidden="true" />
      <div className="anchor-dot left-0 top-1/2 -translate-x-1/2 -translate-y-1/2" title="Left anchor" aria-hidden="true" />
      <div className="anchor-dot right-0 top-1/2 translate-x-1/2 -translate-y-1/2" title="Right anchor" aria-hidden="true" />
    </div>
  );
});

StickyNoteNode.displayName = 'StickyNoteNode';
