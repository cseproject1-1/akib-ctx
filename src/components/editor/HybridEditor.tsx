import { Suspense, lazy, useMemo, useEffect, useState, forwardRef, useImperativeHandle, useRef } from 'react';
import { NoteEditor, type NoteEditorHandle } from '@/components/tiptap/NoteEditor';
import { EditorGhost } from './EditorGhost';
import { migrateToBlockNote, migrateToTiPTap, getEditorVersion } from '@/lib/editor/migration';
import { useSettingsStore } from '@/store/settingsStore';
import { useCanvasStore } from '@/store/canvasStore';
import type { JSONContent } from '@tiptap/react';

export type { NoteEditorHandle };

// Lazy load BlockNote to optimize bundle size (Phase 7 prerequisite)
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
  const currentVersion = useMemo(() => getEditorVersion(initialContent), [initialContent]);
  const enableHybridEditor = useSettingsStore((s) => s.enableHybridEditor);

  const isBlockEditorMode = useCanvasStore((s) => s.isBlockEditorMode);

  // Decision logic:
  // If isBlockEditorMode is ON (from Share view), we favor BlockNote.
  const useBlockNote = useMemo(() => {
    if (isBlockEditorMode) return true;
    return enableHybridEditor && (forceBlockNote || (!forceTiptap && currentVersion === 2));
  }, [isBlockEditorMode, enableHybridEditor, forceBlockNote, forceTiptap, currentVersion]);

  // Rules of Hooks: Define all hooks UNCONDITIONALLY at the top level
  const ghostContent = useMemo(() => {
    if (currentVersion === 2) return migrateToTiPTap(initialContent);
    return initialContent;
  }, [initialContent, currentVersion]);

  const blocks = useMemo(() => {
    if (currentVersion === 1 && initialContent) {
      return migrateToBlockNote(initialContent);
    }
    return Array.isArray(initialContent) ? initialContent : [];
  }, [currentVersion, initialContent]);

  const tiptapContent = useMemo(() => {
    if (currentVersion === 2) {
      return migrateToTiPTap(initialContent);
    }
    return initialContent;
  }, [initialContent, currentVersion]);

  useImperativeHandle(ref, () => ({
    getEditor: () => (useBlockNote ? null : tiptapRef.current?.getEditor()),
    // Add other methods if needed
  }));

  // 1. Ghost Mode: Ultra-lightweight static preview (Zero RAM / No Editor initialization)
  // ONLY if Hybrid Editor is enabled. If OFF, we use the "Old Fast" method (Strict TipTap).
  if (isGhost && enableHybridEditor) {
    return <EditorGhost content={ghostContent} placeholder={placeholder} />;
  }

  // 3. Fast-Path for Legacy (Old TipTap Method)
  if (!enableHybridEditor && currentVersion === 1 && !isGhost) {
    return (
      <NoteEditor
        ref={tiptapRef}
        initialContent={initialContent as JSONContent}
        onChange={onChange}
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

  if (useBlockNote) {
    return (
      <Suspense fallback={<div className="animate-pulse bg-muted/20 h-32 w-full rounded-md" />}>
        <BlockNoteEditor
          initialContent={blocks}
          editable={editable}
          placeholder={placeholder}
          pasteContent={pasteContent}
          pasteFormat={pasteFormat}
          onChange={(newBlocks) => {
            const isFirstMigration = currentVersion === 1;
            const extraData: any = { blockVersion: 2 };
            if (isFirstMigration && initialContent !== undefined) {
              extraData._v1Backup = initialContent;
            }
            onChange?.(newBlocks, extraData);
          }}
        />
      </Suspense>
    );
  }

  // Tiptap Path (Canvas / Collapsed)
  return (
    <NoteEditor
      ref={tiptapRef}
      initialContent={tiptapContent}
      onChange={onChange}
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
