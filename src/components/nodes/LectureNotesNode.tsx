import { memo, useCallback, useRef, useMemo, useEffect } from 'react';
import { type NodeProps } from '@xyflow/react';
import { BookOpen, Link2 } from 'lucide-react';
import { BaseNode } from './BaseNode';
import { HybridEditor } from '@/components/editor/HybridEditor';
import { useCanvasStore } from '@/store/canvasStore';
import type { JSONContent } from '@tiptap/react';
import { LectureNotesNodeData } from '@/types/canvas';

function countWords(content: any): { words: number; chars: number } {
  if (!content) return { words: 0, chars: 0 };
  const text = extractText(content);
  const chars = text.length;
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  return { words, chars };
}

function extractText(content: any): string {
  if (!content) return '';
  if (typeof content === 'string') return content;
  if (content.text) return content.text;
  if (content.content && Array.isArray(content.content)) {
    return content.content.map(extractText).join(' ');
  }
  return '';
}

export const LectureNotesNode = memo(({ id, data, selected }: NodeProps) => {
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const setNodeContextMenu = useCanvasStore((s) => s.setNodeContextMenu);
  const nodeData = data as unknown as LectureNotesNodeData;
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const backlinks = useCanvasStore((s) => s.backlinks[id] || []);
  const allNodes = useCanvasStore((s) => s.nodes);
  const setFocusedNodeId = useCanvasStore((s) => s.setFocusedNodeId);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handleContentChange = useCallback((json: any, extraData?: any) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      updateNodeData(id, { content: json, ...extraData });
    }, 800);
  }, [id, updateNodeData]);

  const stats = useMemo(() => countWords(nodeData.content), [nodeData.content]);
  const footerStats = useMemo(() => {
    const readTime = Math.max(1, Math.ceil(stats.words / 200));
    return stats.words > 0 
      ? `${stats.words}w · ${stats.chars}c · ${readTime}m` 
      : stats.chars > 0 ? `${stats.chars}c` : undefined;
  }, [stats]);

  return (
    <BaseNode
      id={id}
      title={nodeData.title || 'Lecture Notes'}
      icon={<BookOpen className="h-4 w-4" />}
      selected={selected}
      onTitleChange={(title) => updateNodeData(id, { title })}
      bodyClassName="flex-1 overflow-y-auto min-h-[120px] h-full"
      onMenuClick={(e) => setNodeContextMenu({ x: e.clientX, y: e.clientY, nodeId: id })}
      tags={nodeData.tags}
      collapsed={nodeData.collapsed}
      onToggleCollapse={() => updateNodeData(id, { collapsed: !nodeData.collapsed })}
      emoji={nodeData.emoji}
      dueDate={nodeData.dueDate}
      opacity={nodeData.opacity}
      createdAt={nodeData.createdAt}
      footerStats={footerStats}
      color={nodeData.color}
      progress={nodeData.progress}
      headerExtra={null}
      nodeType="lectureNotes"
    >
      <HybridEditor
        initialContent={nodeData.content}
        onChange={handleContentChange}
        onProgressChange={(progress) => updateNodeData(id, { progress })}
        placeholder="Start typing your lecture notes…"
        forceTiptap={true}
        isGhost={!selected}
        nodeId={id}
      />

      {backlinks.length > 0 && (
        <div className="mt-auto px-4 py-3 border-t border-white/5 bg-gradient-to-b from-transparent to-white/[0.02]">
          <div className="flex items-center gap-2 mb-2 opacity-40 group-hover:opacity-100 transition-opacity">
            <Link2 className="h-3 w-3 text-primary" />
            <span className="text-[10px] font-black uppercase tracking-[0.1em] text-foreground/80">Backlinks</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {backlinks.map(sourceId => {
              const sourceNode = allNodes.find(n => n.id === sourceId);
              const title = (sourceNode?.data as any)?.title || (sourceNode?.data as any)?.label || 'Untitled Node';
              return (
                <button
                  key={sourceId}
                  onClick={(e) => { e.stopPropagation(); setFocusedNodeId(sourceId); }}
                  className="group/link flex items-center gap-2 px-2 py-1 rounded-md bg-white/5 hover:bg-primary/10 transition-all border border-transparent hover:border-primary/20"
                >
                  <div className="w-1 h-1 rounded-full bg-primary/40 group-hover/link:bg-primary transition-colors" />
                  <span className="text-[10px] font-semibold text-muted-foreground group-hover/link:text-foreground transition-colors truncate max-w-[150px]" title={title}>
                    {title}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </BaseNode>
  );
});

LectureNotesNode.displayName = 'LectureNotesNode';
