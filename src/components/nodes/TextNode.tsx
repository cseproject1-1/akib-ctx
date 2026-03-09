import { memo, useState, useCallback, useMemo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { useCanvasStore } from '@/store/canvasStore';

export const TextNode = memo(({ id, data, selected }: NodeProps) => {
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const d = data as { text?: string; fontSize?: number; locked?: boolean; opacity?: number; createdAt?: string };
  const [editing, setEditing] = useState(false);

  const handleBlur = useCallback((e: React.FocusEvent<HTMLTextAreaElement>) => {
    setEditing(false);
    updateNodeData(id, { text: e.target.value });
  }, [id, updateNodeData]);

  const text = d.text || '';
  const wordCount = useMemo(() => {
    if (!text.trim()) return null;
    const words = text.trim().split(/\s+/).length;
    return `${words} words · ${text.length} chars`;
  }, [text]);

  return (
    <div
      className="relative min-w-[60px] min-h-[30px] group"
      style={{ opacity: (d.opacity ?? 100) / 100 }}
      onDoubleClick={() => !d.locked && setEditing(true)}
    >
      {editing ? (
        <textarea
          className="w-full h-full bg-transparent text-foreground outline-none resize-none"
          style={{ fontSize: d.fontSize || 16 }}
          defaultValue={text}
          onBlur={handleBlur}
          onKeyDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          autoFocus
        />
      ) : (
        <p
          className="whitespace-pre-wrap text-foreground"
          style={{ fontSize: d.fontSize || 16 }}
        >
          {text || 'Double-click to edit'}
        </p>
      )}
      {wordCount && !editing && (
        <div className="mt-1 text-[9px] text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
          {wordCount}
        </div>
      )}
      {selected && (
        <div className="absolute -top-0.5 -left-0.5 -right-0.5 -bottom-0.5 border-2 border-primary rounded pointer-events-none" />
      )}
      <Handle type="source" position={Position.Top} id="top" className="perimeter-handle !-top-1 !left-0 !w-full !h-2.5 !rounded-none !transform-none" />
      <Handle type="source" position={Position.Bottom} id="bottom" className="perimeter-handle !-bottom-1 !left-0 !w-full !h-2.5 !rounded-none !transform-none" />
      <Handle type="source" position={Position.Left} id="left" className="perimeter-handle !-left-1 !top-0 !h-full !w-2.5 !rounded-none !transform-none" />
      <Handle type="source" position={Position.Right} id="right" className="perimeter-handle !-right-1 !top-0 !h-full !w-2.5 !rounded-none !transform-none" />
      <div className="anchor-dot top-0 left-1/2 -translate-x-1/2 -translate-y-1/2" />
      <div className="anchor-dot bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2" />
      <div className="anchor-dot left-0 top-1/2 -translate-x-1/2 -translate-y-1/2" />
      <div className="anchor-dot right-0 top-1/2 translate-x-1/2 -translate-y-1/2" />
    </div>
  );
});

TextNode.displayName = 'TextNode';
