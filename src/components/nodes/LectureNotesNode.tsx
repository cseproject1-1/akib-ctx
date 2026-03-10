import { memo, useCallback, useRef, useMemo } from 'react';
import { type NodeProps } from '@xyflow/react';
import { BookOpen } from 'lucide-react';
import { BaseNode } from './BaseNode';
import { NoteEditor } from '@/components/tiptap/NoteEditor';
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
  const nodeData = data as { title: string; content?: JSONContent | null; viewMode?: boolean; collapsed?: boolean; emoji?: string; dueDate?: string; opacity?: number; createdAt?: string; tags?: string[] };
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const handleContentChange = useCallback((json: JSONContent) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      updateNodeData(id, { content: json });
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
      headerExtra={null}
    >
      <NoteEditor
        initialContent={nodeData.content}
        onChange={handleContentChange}
        placeholder="Start typing your lecture notes…"
      />
    </BaseNode>
  );
});

LectureNotesNode.displayName = 'LectureNotesNode';
