import React, { memo, useCallback, useRef, useMemo, useEffect, useState } from 'react';
import { type NodeProps } from '@xyflow/react';
import { FileText, RefreshCw, Link2 } from 'lucide-react';
import { BaseNode } from './BaseNode';
import { HybridEditor, type NoteEditorHandle } from '@/components/editor/HybridEditor';
import { useCanvasStore } from '@/store/canvasStore';
import { useShallow } from 'zustand/react/shallow';
import { useIsMobile } from '@/hooks/use-mobile';
import type { JSONContent } from '@tiptap/react';
import { type AINoteNodeData } from '@/types/canvas';
import { toast } from 'sonner';
import { extractText } from '../../lib/utils/contentParser';

// Bug 16: Extract debounce delay to constant for configurability
const CONTENT_DEBOUNCE_MS = 800;
const QUICK_DEBOUNCE_MS = 300;

// Allowed keys for extraData validation (Bug 9, 30)
const ALLOWED_EXTRA_DATA_KEYS = new Set([
  'blockVersion', 'updatedAt', 'createdAt', 'color', 'tags',
  'emoji', 'dueDate', 'opacity', '_v1Backup', 'collapsed'
]);

function countWords(content: JSONContent | null | string): { words: number; chars: number } {
  if (!content) return { words: 0, chars: 0 };
  try {
    const text = extractText(content);
    if (!text) return { words: 0, chars: 0 };
    const chars = text.length;
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    return { words, chars };
  } catch {
    return { words: 0, chars: 0 };
  }
}

function safeJsonStringify(content: any): string {
  try {
    return JSON.stringify(content);
  } catch {
    return '';
  }
}

// Bug 9, 30: Type-safe extraData validation
function validateExtraData(extraData: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!extraData || typeof extraData !== 'object') return {};
  const safeExtra: Record<string, unknown> = {};
  for (const key of ALLOWED_EXTRA_DATA_KEYS) {
    if (key in extraData && extraData[key] !== undefined && extraData[key] !== null) {
      safeExtra[key] = extraData[key];
    }
  }
  return safeExtra;
}

// Bug 18: Error boundary for editor
function EditorErrorBoundary({ children, nodeId }: { children: React.ReactNode; nodeId: string }) {
  const [hasError, setHasError] = useState(false);

  if (hasError) {
    return (
      <div className="flex items-center justify-center h-full p-4 text-center">
        <div className="text-sm text-muted-foreground">
          <p className="font-medium">Editor Error</p>
          <p className="text-xs mt-1">Content could not be rendered</p>
          <button
            className="mt-2 text-xs text-primary hover:underline"
            onClick={() => setHasError(false)}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <ErrorCatcher onError={() => setHasError(true)}>
      {children}
    </ErrorCatcher>
  );
}

class ErrorCatcher extends React.Component<
  { children: React.ReactNode; onError: () => void },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode; onError: () => void }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch() {
    this.props.onError();
  }

  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

export const AINoteNode = memo(({ id, data, selected }: NodeProps) => {
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const scanContentForLinks = useCanvasStore((s) => s.scanContentForLinks);
  const setNodeContextMenu = useCanvasStore((s) => s.setNodeContextMenu);
  const nodeData = data as AINoteNodeData;

  // Bug 7: Separate refs for each debounce timer
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const titleDebounceRef = useRef<ReturnType<typeof setTimeout>>();
  const progressDebounceRef = useRef<ReturnType<typeof setTimeout>>();
  const editorRef = useRef<NoteEditorHandle>(null);
  const mountedRef = useRef(true);
  const previousHeightRef = useRef<number | undefined>(undefined);

  const isMobile = useIsMobile();

  const setFocusedNodeId = useCanvasStore((s) => s.setFocusedNodeId);
  const isNodeDirty = useCanvasStore((s) => s._dirtyNodeDataIds.has(id));

  // Bug 10 fix: Use shallow comparison for backlinks to avoid unnecessary re-renders
  const backlinks = useCanvasStore(
    useShallow((s) => s.backlinks[id] || [])
  );

  // Bug 19 fix: Build a node map for efficient O(1) lookup
  const backlinkTitles = useCanvasStore(
    useShallow((s) => {
      if (!s.backlinks[id] || s.backlinks[id].length === 0) return [];
      const nodeMap = new Map(s.nodes.map(n => [n.id, n]));
      return s.backlinks[id].map(sourceId => {
        const sourceNode = nodeMap.get(sourceId);
        const title = (sourceNode?.data as any)?.title || (sourceNode?.data as any)?.label || 'Untitled Node';
        const collapsed = !!(sourceNode?.data as any)?.collapsed;
        return { id: sourceId, title, collapsed };
      });
    })
  );

  // Bug 7, 8: Mount/unmount tracking with mounted ref
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (titleDebounceRef.current) clearTimeout(titleDebounceRef.current);
      if (progressDebounceRef.current) clearTimeout(progressDebounceRef.current);
    };
  }, []);

  // Bug 8, 9, 16, 20, 30: Content change handler with validation and cleanup
  const handleContentChange = useCallback((json: JSONContent, extraData?: Record<string, unknown>) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (!mountedRef.current) return;
      // Bug 9, 30: Validate extraData
      const safeExtra = validateExtraData(extraData);
      // Bug 20: Clear paste content after first use
      updateNodeData(id, {
        content: json,
        pasteContent: undefined,
        pasteFormat: undefined,
        ...safeExtra,
      });
      scanContentForLinks(id, json);
    }, CONTENT_DEBOUNCE_MS);
  }, [id, updateNodeData, scanContentForLinks]);

  // Bug 12: Debounced progress updates
  const handleProgressChange = useCallback((progress: number | undefined) => {
    if (progressDebounceRef.current) clearTimeout(progressDebounceRef.current);
    progressDebounceRef.current = setTimeout(() => {
      if (!mountedRef.current) return;
      updateNodeData(id, { progress });
    }, QUICK_DEBOUNCE_MS);
  }, [id, updateNodeData]);

  // Bug 27: Debounced title changes
  const handleTitleChange = useCallback((title: string) => {
    if (titleDebounceRef.current) clearTimeout(titleDebounceRef.current);
    titleDebounceRef.current = setTimeout(() => {
      if (!mountedRef.current) return;
      updateNodeData(id, { title });
    }, QUICK_DEBOUNCE_MS);
  }, [id, updateNodeData]);

  // Bug 11: Use stable string dependency for useMemo
  const contentKey = useMemo(() => safeJsonStringify(nodeData.content), [nodeData.content]);
  const stats = useMemo(() => countWords(nodeData.content), [contentKey]);
  // Bug 25: Show stats even for empty nodes (0 chars)
  const footerStats = stats.words > 0 ? `${stats.words} words · ${stats.chars} chars` : `${stats.chars} chars`;

  // Bug 28: Store previous height before collapsing
  const handleToggleCollapse = useCallback(() => {
    const isCollapsed = !nodeData.collapsed;
    updateNodeData(id, { collapsed: isCollapsed });
    if (isCollapsed) {
      const currentNode = useCanvasStore.getState().nodes.find(n => n.id === id);
      if (currentNode?.style?.height) {
        previousHeightRef.current = currentNode.style.height as number;
      }
      useCanvasStore.getState().updateNodeStyle(id, { height: 48 });
    } else {
      const restoreHeight = previousHeightRef.current || 200;
      useCanvasStore.getState().updateNodeStyle(id, { height: restoreHeight });
    }
  }, [id, nodeData.collapsed, updateNodeData]);

  // Bug 15: Consistent type casting
  const nodeColor = (nodeData as any).color;

  // Bug 29: Expand collapsed node when clicking backlink
  const handleBacklinkClick = useCallback((sourceId: string, collapsed: boolean, e: React.MouseEvent) => {
    e.stopPropagation();
    if (collapsed) {
      const sourceNode = useCanvasStore.getState().nodes.find(n => n.id === sourceId);
      if (sourceNode) {
        useCanvasStore.getState().updateNodeData(sourceId, { collapsed: false });
      }
    }
    setFocusedNodeId(sourceId);
  }, [setFocusedNodeId]);

  return (
    <BaseNode
      id={id}
      title={nodeData.title || 'Untitled Note'}
      icon={<FileText className="h-4 w-4" />}
      selected={selected}
      onTitleChange={handleTitleChange}
      bodyClassName="flex-1 overflow-y-auto min-h-[120px] h-full"
      tags={nodeData.tags}
      collapsed={nodeData.collapsed}
      onToggleCollapse={handleToggleCollapse}
      emoji={nodeData.emoji}
      dueDate={nodeData.dueDate}
      opacity={nodeData.opacity}
      createdAt={nodeData.createdAt}
      footerStats={footerStats}
      onMenuClick={(e) => setNodeContextMenu({ x: e.clientX, y: e.clientY, nodeId: id })}
      color={nodeColor}
      progress={nodeData.progress}
      isSyncing={isNodeDirty}
      headerExtra={
        <button
          className={`rounded-md p-0.5 text-muted-foreground transition-opacity hover:bg-accent hover:text-foreground ${
            isMobile ? "opacity-100" : "opacity-0 group-hover/header:opacity-100"
          }`}
          onClick={(e) => { 
            e.stopPropagation(); 
            // N10: Reactive feedback for sync status
            const isNoteDirty = useCanvasStore.getState()._dirtyNodeDataIds.has(id);
            if (isNoteDirty) {
              toast.info('Syncing changes... please wait a moment');
            } else {
              toast.success('All changes synced');
            }
            editorRef.current?.reparseAsMarkdown(); 
          }}
          title="Re-parse markdown (Ctrl+Shift+R)"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      }
    >
      {/* Bug 18: Error boundary around editor */}
      <EditorErrorBoundary nodeId={id}>
        {/* Bug 5: No forceTiptap - allows BlockNote migration */}
        <HybridEditor
          ref={editorRef}
          initialContent={nodeData.content}
          onChange={handleContentChange}
          onProgressChange={handleProgressChange}
          placeholder="Start typing or paste content…" /* Bug 22: Generic placeholder */
          pasteContent={nodeData.pasteContent}
          pasteFormat={nodeData.pasteFormat}
          isGhost={!selected}
          nodeId={id}
        />
      </EditorErrorBoundary>

      {backlinks.length > 0 && backlinkTitles.length > 0 && (
        <div className="mt-2 px-3 py-2 border-t border-white/5 bg-white/5 rounded-xl">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Link2 className="h-2.5 w-2.5 text-primary/60" />
            <span className="text-[9px] font-black uppercase tracking-wider text-primary/40">Linked From</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {/* Bug 19, 29: Efficient lookup + expand collapsed on click */}
            {backlinkTitles.map(({ id: sourceId, title, collapsed: isCollapsed }) => (
              <button
                key={sourceId}
                onClick={(e) => handleBacklinkClick(sourceId, isCollapsed, e)}
                className="flex items-center gap-1 px-1.5 py-0.5 rounded-lg bg-white/5 hover:bg-primary/20 transition-all border border-white/5"
              >
                <span className="text-[9px] font-medium text-muted-foreground hover:text-primary transition-colors truncate max-w-[120px]" title={title}>{title}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </BaseNode>
  );
});

AINoteNode.displayName = 'AINoteNode';
