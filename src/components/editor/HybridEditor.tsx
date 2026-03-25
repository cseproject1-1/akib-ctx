import { Suspense, lazy, useMemo, forwardRef, useImperativeHandle, useRef, useState, useEffect } from 'react';
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

export const HybridEditor = forwardRef<any, HybridEditorProps>(function HybridEditor(
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

  // Detect version dynamically based on initialContent
  const detectedVersion = useMemo(() => getEditorVersion(initialContent), [initialContent]);

  // Determine which editor to use
  const useBlockNote = useMemo(() => {
    if (forceBlockNote && !forceTiptap) return true;
    if (forceTiptap && !forceBlockNote) return false;
    if (isBlockEditorMode) return true;
    return enableHybridEditor && detectedVersion === 2;
  }, [isBlockEditorMode, enableHybridEditor, forceBlockNote, forceTiptap, detectedVersion]);

  // Convert content for the appropriate editor format - memoized to prevent unnecessary re-conversions
  const blocks = useMemo(() => {
    if (!initialContent) return [];
    if (detectedVersion === 2) return Array.isArray(initialContent) ? initialContent : [];
    return migrateToBlockNote(initialContent);
  }, [initialContent, detectedVersion]);

  const tiptapContent = useMemo(() => {
    if (!initialContent) return undefined;
    if (detectedVersion === 1) return initialContent as JSONContent;
    return migrateToTiPTap(initialContent);
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
  const handleContentChange = useMemo(() => {
    if (!onChange) return undefined;
    return (newContent: any, extraData?: any) => {
      const now = new Date().toISOString();
      const finalExtra: any = {
        ...extraData,
        blockVersion: useBlockNote ? 2 : 1,
        updatedAt: now,
      };

      // On first migration from v1 to BlockNote, backup original
      if (detectedVersion === 1 && useBlockNote && initialContent !== undefined) {
        finalExtra._v1Backup = initialContent;
      }

      // Preserve original createdAt from node data (not from content object)
      // initialContent is the editor JSON (Tiptap or BlockNote), NOT node.data
      // We rely on extraData.createdAt passed from AINoteNode's handleContentChange
      // which gets it from nodeData.createdAt via validateExtraData

      onChange(newContent, finalExtra);
    };
  }, [onChange, useBlockNote, detectedVersion, initialContent]);

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
          initialContent={blocks}
          editable={editable}
          placeholder={placeholder}
          pasteContent={pasteContent}
          pasteFormat={pasteFormat}
          onChange={handleContentChange}
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
});

export default HybridEditor;
