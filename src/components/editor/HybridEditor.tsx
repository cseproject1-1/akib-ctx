import { Suspense, lazy, useMemo, forwardRef, useImperativeHandle, useRef, useState, useEffect, useCallback, memo } from 'react';
import { NoteEditor, type NoteEditorHandle } from '@/components/tiptap/NoteEditor';
import { EditorGhost } from './EditorGhost';
import { migrateToBlockNote, migrateToTiPTap, getEditorVersion } from '@/lib/editor/migration';
import { useSettingsStore } from '@/store/settingsStore';
import { useCanvasStore } from '@/store/canvasStore';
import type { JSONContent } from '@tiptap/react';

export type { NoteEditorHandle };

// Lazy load BlockNote to optimize bundle size
const BlockNoteEditor = lazy(() => import('./BlockNoteEditor'));

interface HybridEditorProps {
  nodeId?: string;
  initialContent?: any;
  onChange?: (content: any, extraData?: any) => void;
  editable?: boolean;
  placeholder?: string;
  forceBlockNote?: boolean;
  forceTiptap?: boolean;
  pasteContent?: string;
  pasteFormat?: 'markdown' | 'html';
  title?: string;
  onProgressChange?: (progress: number | undefined) => void;
  isGhost?: boolean;
}

export const HybridEditor = memo(forwardRef<any, HybridEditorProps>(function HybridEditor(
  {
    nodeId,
    initialContent,
    onChange,
    editable = true,
    placeholder,
    forceBlockNote = false,
    forceTiptap = false,
    pasteContent,
    pasteFormat,
    title,
    onProgressChange,
    isGhost = false
  },
  ref
) {
  const tiptapRef = useRef<NoteEditorHandle>(null);
  const enableHybridEditor = useSettingsStore((s) => s.enableHybridEditor);
  const isBlockEditorMode = useCanvasStore((s) => s.isBlockEditorMode);
  const [blockNoteFailed, setBlockNoteFailed] = useState(false);

  // Stability check: store stringified content to avoid re-migration loops during debounced saves
  const prevContentStrRef = useRef<string>('');
  const stabilizedBlocksRef = useRef<any[]>([]);
  const stabilizedTiptapRef = useRef<JSONContent | undefined>(undefined);

  // Detect version dynamically based on initialContent
  const detectedVersion = useMemo(() => getEditorVersion(initialContent), [initialContent]);

  // Determine which editor to use
  const useBlockNote = useMemo(() => {
    if (blockNoteFailed) return false;
    if (forceBlockNote && !forceTiptap) return true;
    if (forceTiptap && !forceBlockNote) return false;
    if (isBlockEditorMode) return true;
    return enableHybridEditor && detectedVersion === 2;
  }, [blockNoteFailed, isBlockEditorMode, enableHybridEditor, forceBlockNote, forceTiptap, detectedVersion]);

  // Convert content for the appropriate editor format - memoized to prevent unnecessary re-conversions
  const blocks = useMemo(() => {
    if (!initialContent) return [];
    
    const contentStr = JSON.stringify(initialContent);
    if (contentStr === prevContentStrRef.current && stabilizedBlocksRef.current.length > 0) {
      return stabilizedBlocksRef.current;
    }

    let result: any[] = [];
    if (detectedVersion === 2) {
      result = Array.isArray(initialContent) ? initialContent : [];
    } else {
      result = migrateToBlockNote(initialContent);
    }

    prevContentStrRef.current = contentStr;
    stabilizedBlocksRef.current = result;
    return result;
  }, [initialContent, detectedVersion]);

  const tiptapContent = useMemo(() => {
    if (!initialContent) return undefined;
    
    const contentStr = JSON.stringify(initialContent);
    if (contentStr === prevContentStrRef.current && stabilizedTiptapRef.current) {
      return stabilizedTiptapRef.current;
    }

    let result: JSONContent | undefined;
    if (detectedVersion === 1) {
      result = initialContent as JSONContent;
    } else {
      result = migrateToTiPTap(initialContent);
    }

    prevContentStrRef.current = contentStr;
    stabilizedTiptapRef.current = result;
    return result;
  }, [initialContent, detectedVersion]);

  // Bug 17: Ghost content respects editor format
  const ghostContent = useMemo(() => {
    if (!initialContent) return undefined;
    if (detectedVersion === 1) return initialContent as JSONContent;
    // Return BlockNote format as-is for ghost rendering
    if (Array.isArray(initialContent)) return initialContent;
    return migrateToTiPTap(initialContent);
  }, [initialContent, detectedVersion]);

  useImperativeHandle(ref, () => ({
    getEditor: () => (useBlockNote ? null : tiptapRef.current?.getEditor()),
    reparseAsMarkdown: () => {
      if (!useBlockNote) {
        tiptapRef.current?.reparseAsMarkdown();
      }
    }
  }));

  // Handle content changes with version tracking
  // Handle content changes with version tracking
  // NM-FIX: Remove dependencies from handleContentChange to prevent recreation loops
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const initialContentRef = useRef(initialContent);
  initialContentRef.current = initialContent;
  const useBlockNoteRef = useRef(useBlockNote);
  useBlockNoteRef.current = useBlockNote;
  const detectedVersionRef = useRef(detectedVersion);
  detectedVersionRef.current = detectedVersion;

  const handleContentChange = useCallback((newContent: any, extraData?: any) => {
    if (!onChangeRef.current) return;
    
    // Stability Check: don't trigger onChange if the content is literally identical to what just came in
    try {
      if (JSON.stringify(newContent) === JSON.stringify(initialContentRef.current)) {
        return;
      }
    } catch (e) { /* ignore stringify errors */ }

    const now = new Date().toISOString();
    const finalExtra: any = {
      ...extraData,
      blockVersion: useBlockNoteRef.current ? 2 : 1,
      updatedAt: now,
    };

    // On first migration from v1 to BlockNote, backup original
    if (detectedVersionRef.current === 1 && useBlockNoteRef.current && initialContentRef.current !== undefined) {
      finalExtra._v1Backup = initialContentRef.current;
    }

    onChangeRef.current(newContent, finalExtra);
  }, []);

  // BlockNote load failure — fallback to Tiptap so content is never silently lost
  const handleBlockNoteLoadError = useCallback(() => {
    console.warn('[HybridEditor] BlockNote failed to load content, falling back to Tiptap');
    setBlockNoteFailed(true);
  }, []);

  // Ghost mode - ultra-lightweight static preview
  if (isGhost && enableHybridEditor) {
    return <EditorGhost content={ghostContent} placeholder={placeholder} />;
  }

  // Legacy fast-path: hybrid disabled, Tiptap-only content
  if (!enableHybridEditor && detectedVersion === 1 && !isGhost && !useBlockNote) {
    return (
      <NoteEditor
        ref={tiptapRef}
        initialContent={initialContent as JSONContent}
        onChange={handleContentChange}
        editable={editable}
        placeholder={placeholder}
        pasteContent={pasteContent}
        pasteFormat={pasteFormat}
        title={title}
        onProgressChange={onProgressChange}
        nodeId={nodeId}
      />
    );
  }

  // BlockNote path
  if (useBlockNote) {
    return (
      <Suspense fallback={<div className="animate-pulse bg-muted/20 h-32 w-full rounded-md" />}>
        <BlockNoteEditor
          nodeId={nodeId}
          initialContent={blocks}
          editable={editable}
          placeholder={placeholder}
          pasteContent={pasteContent}
          pasteFormat={pasteFormat}
          onChange={handleContentChange}
          onLoadError={handleBlockNoteLoadError}
        />
      </Suspense>
    );
  }

  // Tiptap path (default for canvas nodes)
  return (
    <NoteEditor
      ref={tiptapRef}
      initialContent={tiptapContent}
      onChange={handleContentChange}
      editable={editable}
      placeholder={placeholder}
      pasteContent={pasteContent}
      pasteFormat={pasteFormat}
      title={title}
      onProgressChange={onProgressChange}
      nodeId={nodeId}
    />
  );
}));

HybridEditor.displayName = 'HybridEditor';
export default HybridEditor;
