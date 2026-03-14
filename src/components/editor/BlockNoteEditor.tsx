import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import { MantineProvider } from "@mantine/core";
import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";
import "@mantine/core/styles.css";
import { useEffect, useRef, useMemo } from "react";
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
    // Check if language is registered, if not use plaintext
    const registered = lowlight.listLanguages();
    const targetLang = registered.includes(lang) ? lang : 'plaintext';
    return lowlight.highlight(targetLang, code);
  } catch (e) {
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
  editable?: boolean;
  placeholder?: string;
  className?: string;
  pasteContent?: string;
  pasteFormat?: 'markdown' | 'html';
}

export const BlockNoteEditor = ({
  initialContent,
  onChange,
  editable = true,
  placeholder,
  className,
  pasteContent,
  pasteFormat
}: BlockNoteEditorProps) => {
  const isInitialMount = useRef(true);
  const lastEmittedContent = useRef<string>("");

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

  // Configure the editor with memory-friendly settings
  const editor = useCreateBlockNote({
    schema,
    initialContent: (Array.isArray(initialContent) && initialContent.length > 0) 
      ? initialContent 
      : undefined,
  });

  // Handle initial paste/content injection
  useEffect(() => {
    if (editor && pasteContent) {
      const handleInitialPaste = async () => {
        let blocks: Block[] = [];
        if (pasteFormat === 'markdown') {
          blocks = await editor.tryParseMarkdownToBlocks(pasteContent);
        } else if (pasteFormat === 'html') {
          blocks = await editor.tryParseHTMLToBlocks(pasteContent);
        }
        
        if (blocks.length > 0) {
          editor.replaceBlocks(editor.document, blocks);
        }
      };
      handleInitialPaste();
    }
  }, [editor, pasteContent, pasteFormat]);

  // Handle content changes
  useEffect(() => {
    if (!editor || !onChange) return;

    const cleanup = editor.onChange(() => {
      if (isInitialMount.current) {
        isInitialMount.current = false;
        return;
      }

      // Check if actual content changed to avoid unnecessary re-renders in parent
      const currentJson = JSON.stringify(editor.document);
      if (currentJson === lastEmittedContent.current) return;
      lastEmittedContent.current = currentJson;
      
      onChange(editor.document);
    });

    return cleanup;
  }, [editor, onChange]);

  return (
    <MantineProvider>
      <div className={cn("blocknote-wrapper h-full", className)}>
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
          /* Premium Code Block Styling */
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
          /* Syntax Highlighting Colors - Match TipTap */
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
