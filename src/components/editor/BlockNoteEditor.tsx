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

// Custom Highlighter for BlockNote
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

  // Create custom block specs with highlighting
  const customBlockSpecs = useMemo(() => {
    return {
      ...defaultBlockSpecs,
      codeBlock: createCodeBlockSpec({
        supportedLanguages,
        createHighlighter: () => Promise.resolve({
          codeToHast: highlightCode
        } as any),
      }),
    };
  }, []);

  const schema = useMemo(() => BlockNoteSchema.create({
    blockSpecs: customBlockSpecs,
  }), [customBlockSpecs]);

  // Configure the editor
  const editor = useCreateBlockNote({
    schema,
    initialContent: undefined, // Handled in useEffect for stability
  });

  // Ensure content is an array for BlockNote
  const safeInitialContent = useMemo(() => {
    if (!initialContent) return [];
    return Array.isArray(initialContent) ? initialContent : [];
  }, [initialContent]);

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

            const lastBlock = editor.document[editor.document.length - 1];
            if (lastBlock) {
              editor.insertBlocks([imageBlock], lastBlock, "after");
            } else {
              editor.insertBlocks([imageBlock], editor.document[0], "before");
            }

            lastEmittedContent.current = JSON.stringify(editor.document);
            onChange?.(editor.document);
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

  // Apply initial content once when editor is ready
  useEffect(() => {
    if (!editor || initialContentApplied.current) return;

    const hasValidContent = Array.isArray(initialContent) && initialContent.length > 0;
    if (!hasValidContent) {
      initialContentApplied.current = true;
      return;
    }

    try {
      // Helper: parse a value that may be a JSON-stringified array
      const tryParseArray = (val: any): any[] | null => {
        if (Array.isArray(val)) return val;
        if (typeof val === 'string') {
          try {
            const parsed = JSON.parse(val);
            return Array.isArray(parsed) ? parsed : null;
          } catch { return null; }
        }
        return null;
      };

      // Recursively sanitize blocks to prevent BlockNote from crashing on malformed nodes
      const sanitizeBlocks = (blocks: any[]): any[] => {
        if (!Array.isArray(blocks)) return [];
        return blocks
          .filter((b: any) => b && typeof b === 'object' && b.type)
          .map((b: any) => {
            const sanitized: any = { ...b };

            // Ensure id exists
            if (!sanitized.id) sanitized.id = crypto.randomUUID();

            // Sanitize props — handle JSON-stringified arrays (e.g. columnWidths)
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

            // Sanitize content — may be JSON-stringified from old sanitizeForFirestore
            const contentArr = tryParseArray(b.content);
            if (contentArr) {
              sanitized.content = contentArr.filter((c: any) => c && typeof c === 'object');
            } else if (b.content && Array.isArray(b.content)) {
              sanitized.content = b.content.filter((c: any) => c && typeof c === 'object');
            } else if (b.content === null || b.content === undefined) {
              sanitized.content = undefined;
            }

            // Sanitize children — may be JSON-stringified from old sanitizeForFirestore
            const childrenArr = tryParseArray(b.children);
            if (childrenArr) {
              sanitized.children = sanitizeBlocks(childrenArr);
            } else if (b.children && Array.isArray(b.children)) {
              sanitized.children = sanitizeBlocks(b.children);
            } else {
              sanitized.children = [];
            }

            return sanitized;
          });
      };
      
      const safeContent = sanitizeBlocks(initialContent);

      if (safeContent.length > 0) {
        editor.replaceBlocks(editor.document, safeContent);
      }
    } catch (error) {
      console.error('[BlockNote] Failed to apply initial content safely:', error);
      // Signal parent to fallback to Tiptap — content will not be silently lost
      onLoadErrorRef.current?.();
    }

    initialContentApplied.current = true;
    lastEmittedContent.current = JSON.stringify(editor.document);
  }, [editor, initialContent]);

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

export default BlockNoteEditor;
