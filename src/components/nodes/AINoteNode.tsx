import { memo, useCallback, useRef, useMemo, useEffect } from 'react';
import { type NodeProps } from '@xyflow/react';
import { FileText, RefreshCw, Link2 } from 'lucide-react';
import { BaseNode } from './BaseNode';
import { HybridEditor, type NoteEditorHandle } from '@/components/editor/HybridEditor';
import { useCanvasStore } from '@/store/canvasStore';
import { useIsMobile } from '@/hooks/use-mobile';
import type { JSONContent } from '@tiptap/react';
import { AINoteNodeData } from '@/types/canvas';
import { extractText } from '../../lib/utils/contentParser';

function countWords(content: JSONContent | null | string): { words: number; chars: number } {
  if (!content) return { words: 0, chars: 0 };
  try {
    const text = extractText(content);
    if (!text) return { words: 0, chars: 0 };
    const chars = text.length;
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    return { words, chars };
  } catch (err) {
    console.error('Error counting words:', err);
    return { words: 0, chars: 0 };
  }
}


export const AINoteNode = memo(({ id, data, selected }: NodeProps) => {
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const scanContentForLinks = useCanvasStore((s) => s.scanContentForLinks);
  const setNodeContextMenu = useCanvasStore((s) => s.setNodeContextMenu);
  const nodeData = data as unknown as AINoteNodeData;
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const editorRef = useRef<NoteEditorHandle>(null);
  const backlinks = useCanvasStore((s) => s.backlinks[id] || []);
  const allNodes = useCanvasStore((s) => s.nodes);
  const setFocusedNodeId = useCanvasStore((s) => s.setFocusedNodeId);
  const isMobile = useIsMobile();

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handleContentChange = useCallback((json: JSONContent, extraData?: Partial<AINoteNodeData>) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      updateNodeData(id, { 
        content: json, 
        pasteContent: undefined, 
        pasteFormat: undefined,
        ...extraData 
      });
      scanContentForLinks(id, json);
    }, 800);
  }, [id, updateNodeData, scanContentForLinks]);

  const stats = useMemo(() => countWords(nodeData.content), [nodeData.content]);
  const footerStats = stats.words > 0 ? `${stats.words} words · ${stats.chars} chars` : undefined;

  return (
    <BaseNode
      id={id}
      title={nodeData.title || 'Untitled Note'}
      icon={<FileText className="h-4 w-4" />}
      selected={selected}
      onTitleChange={(title) => updateNodeData(id, { title })}
      bodyClassName="flex-1 overflow-y-auto min-h-[120px] h-full"
      tags={nodeData.tags}
      collapsed={nodeData.collapsed}
      onToggleCollapse={() => {
        const isCollapsed = !nodeData.collapsed;
        updateNodeData(id, { collapsed: isCollapsed });
        useCanvasStore.getState().updateNodeStyle(id, { height: 'auto' });
      }}
      emoji={nodeData.emoji}
      dueDate={nodeData.dueDate}
      opacity={nodeData.opacity}
      createdAt={nodeData.createdAt}
      footerStats={footerStats}
      onMenuClick={(e) => setNodeContextMenu({ x: e.clientX, y: e.clientY, nodeId: id })}
      color={(data as any).color}
      progress={nodeData.progress}
      isSyncing={false} // Placeholder for real sync state
      headerExtra={
        <button
          className={`rounded-md p-0.5 text-muted-foreground transition-opacity hover:bg-accent hover:text-foreground ${
            isMobile ? "opacity-100" : "opacity-0 group-hover/header:opacity-100"
          }`}
          onClick={(e) => { e.stopPropagation(); editorRef.current?.reparseAsMarkdown(); }}
          title="Re-parse markdown"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      }
    >
      <HybridEditor
        ref={editorRef}
        initialContent={nodeData.content}
        onChange={handleContentChange}
        onProgressChange={(progress) => updateNodeData(id, { progress })}
        placeholder="Paste an AI reply here…"
        pasteContent={nodeData.pasteContent}
        pasteFormat={nodeData.pasteFormat}
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
                  <span className="text-[9px] font-medium text-muted-foreground hover:text-primary transition-colors truncate max-w-[120px]" title={title}>{title}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </BaseNode>
  );
});

AINoteNode.displayName = 'AINoteNode';
