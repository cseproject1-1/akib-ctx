import { memo, useCallback, useRef, useMemo } from 'react';
import { type NodeProps } from '@xyflow/react';
import { FileText, RefreshCw } from 'lucide-react';
import { BaseNode } from './BaseNode';
import { NoteEditor, type NoteEditorHandle } from '@/components/tiptap/NoteEditor';
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

export const AINoteNode = memo(({ id, data, selected }: NodeProps) => {
  const { updateNodeData, setNodeContextMenu } = useCanvasStore();
  const nodeData = data as { title?: string; content?: JSONContent | null; pasteContent?: string; pasteFormat?: 'markdown' | 'html'; collapsed?: boolean; emoji?: string; dueDate?: string; opacity?: number; createdAt?: string; tags?: string[] };
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const editorRef = useRef<NoteEditorHandle>(null);

  const handleContentChange = useCallback((json: JSONContent) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      updateNodeData(id, { content: json, pasteContent: undefined, pasteFormat: undefined });
    }, 800);
  }, [id, updateNodeData]);

  const stats = useMemo(() => countWords(nodeData.content), [nodeData.content]);
  const footerStats = stats.words > 0 ? `${stats.words} words · ${stats.chars} chars` : undefined;

  return (
    <BaseNode
      id={id}
      title={nodeData.title || 'Untitled Note'}
      icon={<FileText className="h-4 w-4" />}
      selected={selected}
      onTitleChange={(title) => updateNodeData(id, { title })}
      bodyClassName="min-h-[120px] overflow-auto"
      tags={nodeData.tags}
      collapsed={nodeData.collapsed}
      onToggleCollapse={() => updateNodeData(id, { collapsed: !nodeData.collapsed })}
      emoji={nodeData.emoji}
      dueDate={nodeData.dueDate}
      opacity={nodeData.opacity}
      createdAt={nodeData.createdAt}
      footerStats={footerStats}
      onMenuClick={(e) => setNodeContextMenu({ x: e.clientX, y: e.clientY, nodeId: id })}
      color={(data as any).color}
      headerExtra={
        <button
          className="rounded-md p-0.5 text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-foreground group-hover/header:opacity-100"
          onClick={(e) => { e.stopPropagation(); editorRef.current?.reparseAsMarkdown(); }}
          title="Re-parse markdown"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      }
    >
      <NoteEditor
        ref={editorRef}
        initialContent={nodeData.content}
        onChange={handleContentChange}
        placeholder="Paste an AI reply here…"
        pasteContent={nodeData.pasteContent}
        pasteFormat={nodeData.pasteFormat}
      />
    </BaseNode>
  );
});

AINoteNode.displayName = 'AINoteNode';
