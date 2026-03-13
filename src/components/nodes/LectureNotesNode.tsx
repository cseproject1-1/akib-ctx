import { memo, useCallback, useRef, useMemo } from 'react';
import { type NodeProps } from '@xyflow/react';
import { BookOpen, Link2 } from 'lucide-react';
import { BaseNode } from './BaseNode';
import { HybridEditor } from '@/components/editor/HybridEditor';
import { useCanvasStore } from '@/store/canvasStore';
import type { JSONContent } from '@tiptap/react';

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
  const nodeData = data as { title: string; content?: JSONContent | null; viewMode?: boolean; collapsed?: boolean; emoji?: string; dueDate?: string; opacity?: number; createdAt?: string; tags?: string[]; progress?: number };
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const backlinks = useCanvasStore((s) => s.backlinks[id] || []);
  const allNodes = useCanvasStore((s) => s.nodes);
  const setFocusedNodeId = useCanvasStore((s) => s.setFocusedNodeId);

  const handleContentChange = useCallback((json: any, extraData?: any) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      updateNodeData(id, { content: json, ...extraData });
    }, 800);
  }, [id, updateNodeData]);

  const stats = useMemo(() => countWords(nodeData.content), [nodeData.content]);
  const footerStats = stats.words > 0 ? `${stats.words} words · ${stats.chars} chars` : undefined;

  return (
    <BaseNode
      id={id}
      title={nodeData.title || 'Lecture Notes'}
      icon={<BookOpen className="h-4 w-4" />}
      selected={selected}
      onTitleChange={(title) => updateNodeData(id, { title })}
      bodyClassName="min-h-[200px] overflow-auto"
      onMenuClick={(e) => setNodeContextMenu({ x: e.clientX, y: e.clientY, nodeId: id })}
      tags={nodeData.tags}
      collapsed={nodeData.collapsed}
      onToggleCollapse={() => updateNodeData(id, { collapsed: !nodeData.collapsed })}
      emoji={nodeData.emoji}
      dueDate={nodeData.dueDate}
      opacity={nodeData.opacity}
      createdAt={nodeData.createdAt}
      footerStats={footerStats}
      color={(data as any).color}
      progress={nodeData.progress}
      headerExtra={null}
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
        <div className="mt-2 px-3 py-2 border-t border-white/5 bg-white/5 rounded-xl">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Link2 className="h-2.5 w-2.5 text-primary/60" />
            <span className="text-[9px] font-black uppercase tracking-wider text-primary/40">Linked From</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {backlinks.map(sourceId => {
              const sourceNode = allNodes.find(n => n.id === sourceId);
              const title = (sourceNode?.data as any)?.title || (sourceNode?.data as any)?.label || 'Untitled Node';
              return (
                <button
                  key={sourceId}
                  onClick={(e) => { e.stopPropagation(); setFocusedNodeId(sourceId); }}
                  className="flex items-center gap-1 px-1.5 py-0.5 rounded-lg bg-white/5 hover:bg-primary/20 transition-all border border-white/5"
                >
                  <span className="text-[9px] font-medium text-muted-foreground hover:text-primary transition-colors truncate max-w-[120px]">{title}</span>
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
