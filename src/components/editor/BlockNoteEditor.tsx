import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import { MantineProvider } from "@mantine/core";
import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";
import "@mantine/core/styles.css";
import { useEffect, useRef, useMemo, useCallback } from "react";
import { cn } from "@/lib/utils";
import {
  BlockNoteSchema,
  defaultBlockSpecs,
  createCodeBlockSpec,
  Block,
} from "@blocknote/core";

// Syntax highlighting
import { createLowlight, all } from "lowlight";
import "highlight.js/styles/github-dark.css";

const lowlight = createLowlight(all);

/**
 * @function highlightCode
 * @description Syntax-highlights code for BlockNote's code block extension.
 * Falls back to plain text if the language is not registered or highlighting fails.
 * @param {string} code - Source code to highlight
 * @param {string} language - Language identifier (e.g. 'typescript')
 * @returns Lowlight HAST root
 */
const highlightCode = (code: string, language: string) => {
  try {
    const lang = language || 'plaintext';
    const registered = lowlight.listLanguages();
    const targetLang = registered.includes(lang) ? lang : 'plaintext';
    return lowlight.highlight(targetLang, code);
  } catch {
    return { type: 'root', children: [{ type: 'text', value: code }] } as any;
  }
};

const supportedLanguages = {
  javascript: { name: "JavaScript", aliases: ["js"] },
  typescript: { name: "TypeScript", aliases: ["ts"] },
  python: { name: "Python", aliases: ["py"] },
  html: { name: "HTML" },
  css: { name: "CSS" },
  json: { name: "JSON" },
  markdown: { name: "Markdown", aliases: ["md"] },
  bash: { name: "Bash", aliases: ["sh"] },
  sql: { name: "SQL" },
  cpp: { name: "C++" },
  csharp: { name: "C#" },
};

/**
 * Block types that are valid as top-level blocks in BlockNote's default schema.
 * Any block with a type NOT in this set will be converted to a paragraph to
 * prevent BlockNote's schema resolver from receiving `undefined` and crashing
 * with `TypeError: Cannot read properties of undefined (reading 'isInGroup')`.
 */
const VALID_BN_BLOCK_TYPES = new Set([
  'paragraph',
  'heading',
  'bulletListItem',
  'numberedListItem',
  'checkListItem',
  'codeBlock',
  'image',
  'video',
  'audio',
  'file',
  'table',
  // NOTE: tableRow / tableHead / tableCell are internal ProseMirror nodes.
  // They are NOT valid as top-level BlockNote blocks and will crash the editor
  // if passed to replaceBlocks directly. Leave them out so they get remapped
  // to paragraph by the sanitizer.
  'quote',
  'toggleListItem',
]);

/**
 * Block types that must NOT have a non-empty `children` array in BN's schema.
 * These are leaf or inline-only blocks that cannot contain child blocks.
 * NOTE: 'table' is intentionally excluded — tables need children (rows).
 * tableHead/tableCell/tableRow ARE included: cells hold inline content, not child blocks.
 */
const LEAF_BN_BLOCK_TYPES = new Set([
  'image',
  'video',
  'audio',
  'file',
  'codeBlock',
]);

/**
 * Block types that must NOT have a `content` array in BN's schema
 * (their content is derived from children or props).
 * NOTE: 'table' is intentionally NOT here — the table block uses children,
 * and deleting content from it triggers 'Invalid content for node table: <>'.
 */
const NO_CONTENT_BN_BLOCK_TYPES = new Set([
  'image',
  'video',
  'audio',
  'file',
]);

interface BlockNoteEditorProps {
  initialContent?: Block[];
  onChange?: (blocks: Block[]) => void;
  onLoadError?: () => void;
  editable?: boolean;
  placeholder?: string;
  className?: string;
  pasteContent?: string;
  pasteFormat?: 'markdown' | 'html';
}

export const BlockNoteEditor = ({
  initialContent,
  onChange,
  onLoadError,
  editable = true,
  placeholder,
  className,
  pasteContent,
  pasteFormat
}: BlockNoteEditorProps) => {
  const isInitialMount = useRef(true);
  const lastEmittedContent = useRef<string>("");
  const initialContentApplied = useRef(false);
  const pasteAppliedRef = useRef<string | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const onLoadErrorRef = useRef(onLoadError);
  onLoadErrorRef.current = onLoadError;

  // Trace: customBlockSpecs — O(1) memoized, only rebuilt if deps change
  const customBlockSpecs = useMemo(() => {
    return {
      ...defaultBlockSpecs,
      codeBlock: createCodeBlockSpec({
        supportedLanguages,
        createHighlighter: () => Promise.resolve({
          codeToHast: highlightCode,
          // BlockNote calls getLoadedLanguages() on the highlighter instance.
          // Return the lowlight language list to satisfy this requirement.
          getLoadedLanguages: () => lowlight.listLanguages(),
        } as any),
      }),
    };
  }, []);

  const schema = useMemo(() => BlockNoteSchema.create({
    blockSpecs: customBlockSpecs,
  }), [customBlockSpecs]);

  // Configure the editor — initial content is handled in useEffect for stability
  const editor = useCreateBlockNote({
    schema,
    initialContent: undefined,
  });

  // ─── Block Sanitizer ────────────────────────────────────────────────────────
  /**
   * Recursively sanitizes BlockNote blocks before passing them to replaceBlocks.
   *
   * This prevents the `TypeError: Cannot read properties of undefined (reading 'isInGroup')`
   * crash which occurs when BN's ProseMirror schema resolver receives an unknown
   * block type and returns `undefined` instead of a schema group descriptor.
   *
   * Sanitization rules (applied recursively):
   *   1. Reject null/undefined/non-object blocks
   *   2. Reject blocks without a `type` string
   *   3. Ensure each block has a unique `id`
   *   4. Remap unknown block types to 'paragraph' to keep content visible
   *   5. Strip `content` from block types that don't accept inline content
   *   6. Strip `children` from leaf block types that can't have child blocks
   *   7. Normalize `content` null/undefined → [] for content-bearing blocks
   *   8. Filter out null/undefined items inside content and children arrays
   *   9. Parse JSON-stringified arrays in `props` (legacy Firestore serialization)
   */
  const sanitizeBlocks = useCallback((blocks: any[]): any[] => {
    if (!Array.isArray(blocks)) return [];

    return blocks
      .filter((b: any) => b != null && typeof b === 'object' && typeof b.type === 'string')
      .map((b: any) => {
        const sanitized: any = { ...b };

        // Step 1 — Ensure unique ID
        if (!sanitized.id || typeof sanitized.id !== 'string') {
          sanitized.id = crypto.randomUUID();
        }

        // Step 2 — Remap unknown types to paragraph (prevents isInGroup crash)
        if (!VALID_BN_BLOCK_TYPES.has(sanitized.type)) {
          // Try to preserve any text content
          const textContent = extractTextFromUnknownBlock(b);
          sanitized.type = 'paragraph';
          sanitized.props = {
            textColor: 'default',
            backgroundColor: 'default',
            textAlignment: 'left',
          };
          sanitized.content = textContent
            ? [{ type: 'text', text: textContent, styles: {} }]
            : [];
          sanitized.children = [];
          return sanitized;
        }

        // Step 3 — Sanitize props (expand JSON-stringified arrays)
        if (sanitized.props && typeof sanitized.props === 'object') {
          const props = { ...sanitized.props };
          for (const key of Object.keys(props)) {
            if (typeof props[key] === 'string') {
              try {
                const parsed = JSON.parse(props[key]);
                if (Array.isArray(parsed)) props[key] = parsed;
              } catch { /* keep original string value */ }
            }
          }
          sanitized.props = props;
        }

        // Step 4 — Handle content
        if (NO_CONTENT_BN_BLOCK_TYPES.has(sanitized.type)) {
          // These block types must not have an inline content array
          delete sanitized.content;
        } else {
          // Parse JSON-stringified content (legacy Firestore)
          let contentArr = sanitized.content;
          if (typeof contentArr === 'string') {
            try {
              const parsed = JSON.parse(contentArr);
              contentArr = Array.isArray(parsed) ? parsed : [];
            } catch { contentArr = []; }
          }
          sanitized.content = Array.isArray(contentArr)
            ? contentArr.filter((c: any) => c != null && typeof c === 'object')
            : [];
        }

        // Step 5 — Handle children
        if (LEAF_BN_BLOCK_TYPES.has(sanitized.type)) {
          // Leaf blocks must not have children
          sanitized.children = [];
        } else if (sanitized.type === 'table') {
          // Table children must be tableRow blocks. Any other child type is invalid
          // and will cause 'Invalid content for node table: <>' in ProseMirror.
          // Clear all children — if the table has no valid rows, step 6 converts it
          // to a paragraph.
          sanitized.children = [];
        } else {
          let childrenArr = sanitized.children;
          if (typeof childrenArr === 'string') {
            try {
              const parsed = JSON.parse(childrenArr);
              childrenArr = Array.isArray(parsed) ? parsed : [];
            } catch { childrenArr = []; }
          }
          sanitized.children = Array.isArray(childrenArr)
            ? sanitizeBlocks(childrenArr)
            : [];
        }

        // Step 6 — Validate table blocks have at least one row
        if (sanitized.type === 'table' && (!sanitized.children || sanitized.children.length === 0)) {
          sanitized.type = 'paragraph';
          sanitized.props = {
            textColor: 'default',
            backgroundColor: 'default',
            textAlignment: 'left',
          };
          sanitized.content = [];
        }

        return sanitized;
      });
  }, []);

  // Handle image paste from clipboard
  const handlePaste = useCallback((e: ClipboardEvent) => {
    if (!editor || !editable) return;

    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (!file) continue;

        const reader = new FileReader();
        reader.onload = (event) => {
          const src = event.target?.result as string;
          if (src) {
            const imageBlock: any = {
              type: 'image',
              props: {
                url: src,
                caption: '',
                name: file.name || 'pasted-image',
                showPreview: true,
                previewWidth: 512
              }
            };

            try {
              const lastBlock = editor.document[editor.document.length - 1];
              if (lastBlock) {
                editor.insertBlocks([imageBlock], lastBlock, "after");
              } else {
                editor.insertBlocks([imageBlock], editor.document[0], "before");
              }
              lastEmittedContent.current = JSON.stringify(editor.document);
              onChange?.(editor.document);
            } catch (err) {
              console.error('[BlockNote] Image paste failed:', err);
            }
          }
        };
        reader.readAsDataURL(file);
        return;
      }
    }
  }, [editor, editable, onChange]);

  // Attach paste handler
  useEffect(() => {
    if (!editor || !wrapperRef.current) return;

    const wrapper = wrapperRef.current;
    wrapper.addEventListener('paste', handlePaste as any);

    return () => {
      wrapper.removeEventListener('paste', handlePaste as any);
    };
  }, [editor, handlePaste]);

  /**
   * Apply initial content once when editor is ready.
   *
   * Fix for `isInGroup` crash (PRIMARY):
   * ProseMirror needs one full event loop turn after `useCreateBlockNote` to
   * commit its initial empty-document transaction to the view. Calling
   * `replaceBlocks` synchronously in the same render violates this and causes
   * the schema group resolver to receive `undefined`.
   *
   * We use `requestAnimationFrame` to defer the call to after the browser has
   * painted the initial empty editor, at which point all internal ProseMirror
   * state is fully committed and safe to mutate.
   */
  useEffect(() => {
    if (!editor || initialContentApplied.current) return;

    const hasValidContent = Array.isArray(initialContent) && initialContent.length > 0;
    if (!hasValidContent) {
      initialContentApplied.current = true;
      return;
    }

    let cancelled = false;
    let rafHandle: number;

    const applyContent = () => {
      if (cancelled) return;

      const safeContent = sanitizeBlocks(initialContent as any[]);
      if (safeContent.length === 0) {
        initialContentApplied.current = true;
        return;
      }

      // Phase 1: Optimistic batch — fast path for well-formed content
      try {
        editor.replaceBlocks(editor.document, safeContent);
        if (!cancelled) {
          initialContentApplied.current = true;
          lastEmittedContent.current = JSON.stringify(editor.document);
        }
        return;
      } catch (batchError) {
        console.warn(
          '[BlockNote] Batch replaceBlocks failed, switching to resilient one-by-one mode:',
          (batchError as Error)?.message ?? batchError
        );
      }

      // Phase 2: Resilient one-by-one insertion — isolates bad blocks instead of
      // falling back to Tiptap entirely. Skips any block that throws.
      if (cancelled) return;

      let inserted = 0;
      for (let i = 0; i < safeContent.length; i++) {
        if (cancelled) break;
        try {
          const block = safeContent[i];
          if (i === 0) {
            // Replace the initial empty document with the first block
            editor.replaceBlocks(editor.document, [block]);
          } else {
            // Append after the last block in the document
            const lastDoc = editor.document;
            const anchor = lastDoc[lastDoc.length - 1];
            if (anchor) editor.insertBlocks([block], anchor, 'after');
          }
          inserted++;
        } catch (blockError) {
          console.warn(
            `[BlockNote] Skipping block ${i} (type="${safeContent[i]?.type}") — schema error:`,
            (blockError as Error)?.message ?? blockError
          );
        }
      }

      if (!cancelled) {
        if (inserted === 0 && safeContent.length > 0) {
          // Every single block failed — nothing we can do, signal fallback
          console.error('[BlockNote] All blocks failed to insert — falling back to Tiptap');
          onLoadErrorRef.current?.();
        } else {
          initialContentApplied.current = true;
          lastEmittedContent.current = JSON.stringify(editor.document);
        }
      }
    };

    // Defer by one animation frame to let ProseMirror commit its initial transaction
    rafHandle = requestAnimationFrame(applyContent);

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafHandle);
    };
  }, [editor, initialContent, sanitizeBlocks]);

  // Handle paste content separately - only once per unique paste
  useEffect(() => {
    if (!editor || !pasteContent) return;
    if (pasteAppliedRef.current === pasteContent) return;
    pasteAppliedRef.current = pasteContent;

    const handlePasteContent = async () => {
      try {
        let blocks: Block[] = [];
        if (pasteFormat === 'markdown') {
          blocks = await editor.tryParseMarkdownToBlocks(pasteContent);
        } else if (pasteFormat === 'html') {
          blocks = await editor.tryParseHTMLToBlocks(pasteContent);
        }

        if (blocks.length > 0) {
          const lastBlock = editor.document[editor.document.length - 1];
          if (lastBlock) {
            editor.insertBlocks(blocks, lastBlock, "after");
          } else {
            editor.replaceBlocks(editor.document, blocks);
          }
          lastEmittedContent.current = JSON.stringify(editor.document);
        }
      } catch (error) {
        console.error('[BlockNote] Paste failed:', error);
      }
    };

    handlePasteContent();
  }, [editor, pasteContent, pasteFormat]);

  // Handle content changes
  useEffect(() => {
    if (!editor || !onChange) return;

    const cleanup = editor.onChange(() => {
      if (isInitialMount.current) {
        isInitialMount.current = false;
        return;
      }

      const currentJson = JSON.stringify(editor.document);
      if (currentJson === lastEmittedContent.current) return;
      lastEmittedContent.current = currentJson;

      onChange(editor.document);
    });

    return cleanup;
  }, [editor, onChange]);

  return (
    <MantineProvider>
      <div ref={wrapperRef} className={cn("blocknote-wrapper h-full", className)}>
        <BlockNoteView
          editor={editor}
          editable={editable}
          className="min-h-full"
          theme="dark"
        />
        <style>{`
          .blocknote-wrapper .bn-container {
            background: transparent !important;
            padding: 0 !important;
          }
          .blocknote-wrapper .bn-editor {
            padding-inline: 48px !important;
            font-size: 15px !important;
            line-height: 1.6;
          }
          .bn-root {
            --bn-colors-editor-background: transparent;
          }
          .blocknote-wrapper .bn-block-content[data-content-type="codeBlock"] {
            margin: 1rem 0 !important;
          }
          .blocknote-wrapper .bn-code-block {
            background: #1e1e1e !important;
            border-radius: 12px !important;
            padding: 1.5rem !important;
            border: 1px solid rgba(255,255,255,0.1) !important;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3) !important;
            font-family: 'Fira Code', 'Monaco', 'Consolas', monospace !important;
          }
          .hljs-keyword { color: #569cd6 !important; font-weight: bold !important; }
          .hljs-string { color: #ce9178 !important; }
          .hljs-comment { color: #6a9955 !important; font-style: italic !important; }
          .hljs-function { color: #dcdcaa !important; }
          .hljs-params { color: #9cdcfe !important; }
          .hljs-number { color: #b5cea8 !important; }
          .hljs-type { color: #4ec9b0 !important; }
          .hljs-title { color: #dcdcaa !important; }
          .hljs-variable { color: #9cdcfe !important; }
          .hljs-operator { color: #d4d4d4 !important; }
        `}</style>
      </div>
    </MantineProvider>
  );
};

/**
 * @function extractTextFromUnknownBlock
 * @description Best-effort text extraction from any block type not in the
 * valid set, so we don't silently discard user content.
 * @param {any} block - Any block-like object
 * @returns {string} Extracted text or empty string
 */
function extractTextFromUnknownBlock(block: any): string {
  if (!block) return '';

  // Try content array first
  if (Array.isArray(block.content)) {
    const text = block.content
      .filter((c: any) => c?.type === 'text' && typeof c.text === 'string')
      .map((c: any) => c.text)
      .join('');
    if (text) return text;
  }

  // Try children
  if (Array.isArray(block.children)) {
    return block.children.map(extractTextFromUnknownBlock).filter(Boolean).join(' ');
  }

  // Try props.text or props.content
  if (block.props) {
    if (typeof block.props.text === 'string') return block.props.text;
    if (typeof block.props.content === 'string') return block.props.content;
    if (typeof block.props.caption === 'string') return block.props.caption;
    if (typeof block.props.url === 'string') return `[File: ${block.props.name || block.props.url}]`;
  }

  return '';
}

export default BlockNoteEditor;
