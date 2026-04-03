import { memo, useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { type NodeProps } from '@xyflow/react';
import { useCanvasStore } from '@/store/canvasStore';
import { BaseNode } from './BaseNode';
import { TextNodeData } from '@/types/canvas';
import { Type } from 'lucide-react';

export const TextNode = memo(({ id, data, selected }: NodeProps) => {
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const nodeData = data as unknown as TextNodeData;
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(nodeData.text || '');
  const heightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => { if (heightTimerRef.current) clearTimeout(heightTimerRef.current); };
  }, []);

  useEffect(() => {
    if (!editing) {
      setEditValue(nodeData.text || '');
    }
  }, [nodeData.text, editing]);

  const handleBlur = useCallback(() => {
    setEditing(false);
    updateNodeData(id, { text: editValue });
  }, [id, updateNodeData, editValue]);

  const text = nodeData.text || '';
  const wordCount = useMemo(() => {
    if (!text.trim()) return null;
    const words = text.trim().split(/\s+/).length;
    return `${words} words · ${text.length} chars`;
  }, [text]);

  return (
    <BaseNode
      id={id}
      title={nodeData.title || 'Text'}
      icon={<Type className="h-4 w-4" />}
      selected={selected}
      onTitleChange={(t) => updateNodeData(id, { title: t })}
      collapsed={nodeData.collapsed}
      onToggleCollapse={() => updateNodeData(id, { collapsed: !nodeData.collapsed })}
      summary={text.slice(0, 60) + (text.length > 60 ? '...' : '')}
      nodeType="text"
    >
      <div
        className="relative min-w-[100px] min-h-[40px] flex flex-col group p-2 rounded-md hover:bg-accent/10 transition-colors"
        style={{ opacity: (nodeData.opacity ?? 100) / 100 }}
        onDoubleClick={() => !nodeData.locked && selected && setEditing(true)}
      >
        <div className="absolute top-0 right-0 p-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none text-[9px] text-muted-foreground bg-background/50 rounded-bl">
          Double-click to edit
        </div>
        {editing ? (
          <textarea
            className="w-full flex-1 bg-transparent text-foreground outline-none resize-none overflow-hidden custom-scrollbar"
            style={{ fontSize: nodeData.fontSize || 16 }}
            value={editValue}
            onChange={(e) => {
              const val = e.target.value;
              setEditValue(val);
              
              // Auto-resize logic
              const target = e.target as HTMLTextAreaElement;
              target.style.height = 'auto';
              target.style.height = `${target.scrollHeight}px`;
              const newHeight = Math.max(80, target.scrollHeight + 32);

              if (heightTimerRef.current) clearTimeout(heightTimerRef.current);
              heightTimerRef.current = setTimeout(() => {
                // Debounce content + height sync to store
                updateNodeData(id, { 
                  text: val,
                  height: newHeight 
                });
              }, 400);
            }}
            onBlur={handleBlur}
            onKeyDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            autoFocus
            ref={(ref) => {
              if (ref) {
                ref.style.height = 'auto';
                ref.style.height = `${ref.scrollHeight}px`;
              }
            }}
          />
        ) : (
          <p
            className="whitespace-pre-wrap text-foreground flex-1 overflow-hidden"
            style={{ fontSize: nodeData.fontSize || 16 }}
          >
            {text || 'Empty Text'}
          </p>
        )}
        {wordCount && !editing && (
          <div className="mt-1 text-[9px] text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
            {wordCount}
          </div>
        )}
      </div>
    </BaseNode>
  );
});

TextNode.displayName = 'TextNode';
