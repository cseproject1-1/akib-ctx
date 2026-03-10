import { useEditor, EditorContent } from '@tiptap/react';
import { getEditorExtensions } from '@/lib/tiptap/extensions';
import { Bold, Italic, Strikethrough, Code, Heading1, Heading2, Link as LinkIcon, List, ListOrdered, Quote, Highlighter, Underline as UnderlineIcon, Palette, Type, Superscript, Subscript, RemoveFormatting, Search } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import type { JSONContent } from '@tiptap/react';
import { Markdown } from 'tiptap-markdown';
import { EditorFooter } from './EditorFooter';
import { FindReplace } from './FindReplace';
import { SlashCommandPopover } from './SlashCommandPopover';
import type { SlashMenuItem } from './SlashMenu';
import { marked } from 'marked';

/**
 * Sanitize pasted KaTeX HTML by extracting original LaTeX from annotation tags
 * and converting to math-block divs the KaTeXExtension can parse.
 */
function sanitizeKatexHtml(html: string): string {
  // Extract LaTeX from <annotation encoding="application/x-tex"> inside KaTeX spans
  // Handle display math: <span class="katex-display">...</span>
  let result = html.replace(
    /<span[^>]*class="katex-display"[^>]*>[\s\S]*?<annotation[^>]*encoding="application\/x-tex"[^>]*>([\s\S]*?)<\/annotation>[\s\S]*?<\/span>\s*<\/span>\s*<\/span>/g,
    (_match, latex: string) => {
      const decoded = latex.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
      const escaped = decoded.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      return `<div data-math-block data-latex="${escaped}">${escaped}</div>`;
    }
  );

  // Handle inline math: <span class="katex">...</span>
  result = result.replace(
    /<span[^>]*class="katex"[^>]*>[\s\S]*?<annotation[^>]*encoding="application\/x-tex"[^>]*>([\s\S]*?)<\/annotation>[\s\S]*?<\/span>\s*<\/span>\s*<\/span>/g,
    (_match, latex: string) => {
      const decoded = latex.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
      const escaped = decoded.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      return `<code class="math-inline" data-math-inline="${escaped}">${escaped}</code>`;
    }
  );

  // Fallback: catch any remaining katex spans that didn't match the annotation pattern
  // Just strip them entirely to avoid showing raw markup
  result = result.replace(/<span[^>]*class="katex[^"]*"[^>]*>[\s\S]*?<\/span>/g, (match) => {
    // Try to extract annotation one more time with a looser pattern
    const annMatch = match.match(/<annotation[^>]*encoding="application\/x-tex"[^>]*>([\s\S]*?)<\/annotation>/);
    if (annMatch) {
      const decoded = annMatch[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
      const escaped = decoded.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      return `<div data-math-block data-latex="${escaped}">${escaped}</div>`;
    }
    return '';
  });

  return result;
}

// Configure marked for full GFM support
marked.setOptions({
  gfm: true,
  breaks: false,
});

// Use a custom renderer to force code blocks to output classes that Tiptap CodeBlockLowlight expects
const renderer = new marked.Renderer();
renderer.code = function(codeBase) {
  let lang = '';
  let code = '';

  // Handle marked 14+ string vs object token differences
  if (typeof codeBase === 'string') {
    code = codeBase;
    lang = arguments.length > 1 ? arguments[1] : '';
  } else if (typeof codeBase === 'object' && codeBase !== null) {
    code = (codeBase as any).text || '';
    lang = (codeBase as any).lang || '';
  }

  const languageClass = lang ? `language-${lang}` : 'language-plaintext';
  const escapedCode = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  return `<pre><code class="${languageClass}">${escapedCode}</code></pre>`;
};
marked.use({ renderer });

/**
 * Pre-process LaTeX math delimiters before passing to marked.
 * Converts $$...$$ (display) and $...$ (inline) to KaTeX-rendered HTML.
 */
function preprocessMath(md: string): string {
  // Display math: $$...$$ → simple div that KaTeXExtension can parse
  md = md.replace(/\$\$([\s\S]+?)\$\$/g, (_match, latex: string) => {
    const escaped = latex.trim().replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return `<div data-math-block data-latex="${escaped}">${escaped}</div>`;
  });

  // Inline math: $...$ → <code> with data attribute (no rendered KaTeX HTML)
  md = md.replace(/(?<!\$)\$(?!\$)([^\n$]+?)\$(?!\$)/g, (_match, latex: string) => {
    const escaped = latex.trim().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return `<code class="math-inline" data-math-inline="${escaped}">${escaped}</code>`;
  });

  return md;
}

/**
 * Robust markdown-to-HTML converter using the `marked` library.
 * Handles all standard and GFM markdown: tables, task lists, code blocks,
 * nested lists, blockquotes, inline formatting, images, links, math, etc.
 */
export function markdownToHtml(md: string): string {
  // Pre-process LaTeX math before markdown parsing
  const processed = preprocessMath(md);

  let html = '';
  // Handle marked 15+ synchronous parsing
  if (typeof (marked as any).parseSync === 'function') {
    html = (marked as any).parseSync(processed) as string;
  } else {
    html = marked.parse(processed, { async: false }) as string;
  }

  // Convert GFM task-list markup to Tiptap-compatible data attributes
  html = html
    .replace(/<ul>\s*<li><input\s/g, '<ul data-type="taskList"><li data-type="taskItem" data-checked="')
    .replace(/<li><input\s+checked=""\s+disabled=""\s+type="checkbox"\s*>\s*/g, '<li data-type="taskItem" data-checked="true"><label><input type="checkbox" checked />')
    .replace(/<li><input\s+disabled=""\s+type="checkbox"\s*>\s*/g, '<li data-type="taskItem" data-checked="false"><label><input type="checkbox" />')
    .replace(/(<li data-type="taskItem"[^>]*><label><input[^/]*\/>)([^<]*)<\/li>/g, '$1$2</label></li>');

  return html;
}

export interface NoteEditorHandle {
  reparseAsMarkdown: () => void;
}

interface NoteEditorProps {
  initialContent?: JSONContent | null;
  onChange?: (json: JSONContent) => void;
  placeholder?: string;
  editable?: boolean;
  pasteContent?: string;
  pasteFormat?: 'markdown' | 'html';
  title?: string;
}

export const NoteEditor = forwardRef<NoteEditorHandle, NoteEditorProps>(function NoteEditor({ initialContent, onChange, placeholder, editable = true, pasteContent, pasteFormat, title }, ref) {
  const [showBubble, setShowBubble] = useState(false);
  const [bubblePos, setBubblePos] = useState({ top: 0, left: 0 });
  const [showFindReplace, setShowFindReplace] = useState(false);
  const [popoverConfig, setPopoverConfig] = useState<{ item: SlashMenuItem; editor: any } | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const editor = useEditor({
    extensions: [
      ...getEditorExtensions(placeholder),
      Markdown.configure({
        html: true,
        transformPastedText: false,
        transformCopiedText: false,
        linkify: false,
      }),
    ],
    content: initialContent || undefined,
    editable,
    editorProps: {
      attributes: {
        class: 'tiptap-editor outline-none min-h-[80px] px-4 py-3 text-sm text-foreground',
      },
      handleKeyDown: (_view, event) => {
        // Ctrl+F / Cmd+F for find & replace
        if ((event.ctrlKey || event.metaKey) && event.key === 'f') {
          event.preventDefault();
          event.stopPropagation();
          setShowFindReplace(true);
          return true;
        }
        event.stopPropagation();
        return false;
      },
      handlePaste: (view, event) => {
        // 1. Handle image paste (screenshots, copied images)
        const items = event.clipboardData?.items;
        if (items) {
          for (let i = 0; i < items.length; i++) {
            if (items[i].type.startsWith('image/')) {
              event.preventDefault();
              const file = items[i].getAsFile();
              if (!file) continue;
              const reader = new FileReader();
              reader.onload = (e) => {
                const src = e.target?.result as string;
                if (src) editor?.commands.setImage({ src });
              };
              reader.readAsDataURL(file);
              return true;
            }
          }
        }

        const clipboardText = event.clipboardData?.getData('text/plain') || '';
        const clipboardHtml = event.clipboardData?.getData('text/html') || '';

        // 2. Intercept AI Chat Markdown (ChatGPT/Claude)
        // AI chats often put broken HTML into the clipboard but perfect markdown into text/plain.
        // If we detect strong markdown signatures like code blocks or math, parse the markdown explicitly.
        const isStrongMarkdown = /```[\s\S]*?```|~~~[\s\S]*?~~~|`[^`]+`|^\s{4,}.+$|\$\$[\s\S]+?\$\$|\|[-:\s]+\|[-:\s]+\|/m.test(clipboardText);
        const isCodeFallback = !isStrongMarkdown && /^(const|let|var|function|class|import|export|if|for|while)\b/m.test(clipboardText);
        
        if (isStrongMarkdown || isCodeFallback) {
          event.preventDefault();
          // If we fallback because of code keywords, wrap in a codeblock so marked parses it correctly
          let textToParse = clipboardText;
          if (isCodeFallback) {
            textToParse = `\`\`\`javascript\n${clipboardText}\n\`\`\``;
          }
          const html = markdownToHtml(textToParse);
          editor?.commands.insertContent(html);
          return true;
        }

        // 3. If clipboard has semantic HTML (from web/spreadsheets), use it directly
        //    If it contains KaTeX-rendered HTML, sanitize it first to extract LaTeX
        if (clipboardHtml.trim().length > 0) {
          const hasKatex = /class="katex/i.test(clipboardHtml);
          if (hasKatex) {
            event.preventDefault();
            const sanitized = sanitizeKatexHtml(clipboardHtml);
            editor?.commands.insertContent(sanitized);
            return true;
          }
          const hasSemanticTags = /<(h[1-6]|table|thead|tbody|tr|th|td|ul|ol|li|pre|code|blockquote|strong|em|img|figure|details|summary|picture|svg|dl|dt|dd|sup|sub|mark|kbd|abbr)\b/i.test(clipboardHtml);
          if (hasSemanticTags) {
            // Let Tiptap handle well-structured HTML natively
            return false;
          }
        }

        // 3. Handle URLs pasted inside editor — create clickable link
        if (/^https?:\/\/[^\s]+$/.test(clipboardText.trim())) {
          event.preventDefault();
          const url = clipboardText.trim();
          editor?.chain().focus().insertContent(
            `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`
          ).run();
          return true;
        }

        // 4. Otherwise convert plain text as markdown (with math support)
        if (clipboardText.trim().length > 0) {
          event.preventDefault();
          const html = markdownToHtml(clipboardText);
          editor?.commands.insertContent(html);
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor }) => {
      onChange?.(editor.getJSON());
    },
    onSelectionUpdate: ({ editor }) => {
      const { from, to } = editor.state.selection;
      if (from !== to && editable) {
        const coords = editor.view.coordsAtPos(from);
        const wrapperRect = wrapperRef.current?.getBoundingClientRect();
        if (wrapperRect) {
          setBubblePos({
            top: coords.top - wrapperRect.top - 44,
            left: Math.max(0, coords.left - wrapperRect.left),
          });
        }
        setShowBubble(true);
      } else {
        setShowBubble(false);
      }
    },
  });

  // Listen for popover requests from slash commands
  useEffect(() => {
    if (!editor) return;

    const handler = (item: SlashMenuItem) => {
      if (item.popover) {
        setPopoverConfig({ item, editor });
      }
    };

    // Store handler on editor instance for slash command access
    (editor as any).__popoverHandler = handler;

    return () => {
      delete (editor as any).__popoverHandler;
    };
  }, [editor]);

  // Track which pasteContent we've already applied
  const appliedPasteContent = useRef<string | null>(null);

  useEffect(() => {
    // Apply pasteContent when it's new and different from what we've already applied
    if (editor && pasteContent && appliedPasteContent.current !== pasteContent) {
      appliedPasteContent.current = pasteContent;
      if (pasteFormat === 'html') {
        editor.commands.setContent(pasteContent);
      } else {
        const html = markdownToHtml(pasteContent);
        editor.commands.setContent(html);
      }
      setTimeout(() => {
        onChange?.(editor.getJSON());
      }, 50);
    }
  }, [editor, pasteContent, pasteFormat, onChange]);

  useImperativeHandle(ref, () => ({
    reparseAsMarkdown: () => {
      if (!editor) return;
      const plainText = editor.getText();
      if (!plainText.trim()) return;
      const html = markdownToHtml(plainText);
      editor.commands.setContent(html);
      setTimeout(() => {
        onChange?.(editor.getJSON());
      }, 50);
    },
  }), [editor, onChange]);

  useEffect(() => {
    if (editor && editable !== editor.isEditable) {
      editor.setEditable(editable);
    }
  }, [editor, editable]);

  const setLink = useCallback(() => {
    if (!editor) return;
    const url = window.prompt('URL', editor.getAttributes('link').href || '');
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  }, [editor]);

  if (!editor) return null;

  return (
    <div className="tiptap-wrapper relative nodrag nowheel nopan" onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()} ref={wrapperRef}>
      {showBubble && editable && (
        <div
          className="absolute z-50 flex items-center gap-0.5 rounded-lg border-2 border-border bg-popover p-1 shadow-[4px_4px_0px_hsl(0,0%,10%)] animate-fade-slide-in"
          style={{ top: bubblePos.top, left: bubblePos.left }}
        >
          <BubbleBtn active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()} title="Bold">
            <Bold className="h-3.5 w-3.5" />
          </BubbleBtn>
          <BubbleBtn active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()} title="Italic">
            <Italic className="h-3.5 w-3.5" />
          </BubbleBtn>
          <BubbleBtn active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()} title="Strike">
            <Strikethrough className="h-3.5 w-3.5" />
          </BubbleBtn>
          <BubbleBtn active={editor.isActive('code')} onClick={() => editor.chain().focus().toggleCode().run()} title="Code">
            <Code className="h-3.5 w-3.5" />
          </BubbleBtn>
          <div className="mx-0.5 h-5 w-px bg-border" />
          <BubbleBtn active={editor.isActive('heading', { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} title="H1">
            <Heading1 className="h-3.5 w-3.5" />
          </BubbleBtn>
          <BubbleBtn active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} title="H2">
            <Heading2 className="h-3.5 w-3.5" />
          </BubbleBtn>
          <div className="mx-0.5 h-5 w-px bg-border" />
          <BubbleBtn active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()} title="Bullet List">
            <List className="h-3.5 w-3.5" />
          </BubbleBtn>
          <BubbleBtn active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Numbered List">
            <ListOrdered className="h-3.5 w-3.5" />
          </BubbleBtn>
          <BubbleBtn active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()} title="Quote">
            <Quote className="h-3.5 w-3.5" />
          </BubbleBtn>
          <div className="mx-0.5 h-5 w-px bg-border" />
          <BubbleBtn active={editor.isActive('link')} onClick={setLink} title="Link">
            <LinkIcon className="h-3.5 w-3.5" />
          </BubbleBtn>
          <BubbleBtn active={editor.isActive('highlight')} onClick={() => editor.chain().focus().toggleHighlight().run()} title="Highlight">
            <Highlighter className="h-3.5 w-3.5" />
          </BubbleBtn>
          <BubbleBtn active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()} title="Underline">
            <UnderlineIcon className="h-3.5 w-3.5" />
          </BubbleBtn>
          <BubbleBtn active={editor.isActive('superscript')} onClick={() => editor.chain().focus().toggleSuperscript().run()} title="Superscript">
            <Superscript className="h-3.5 w-3.5" />
          </BubbleBtn>
          <BubbleBtn active={editor.isActive('subscript')} onClick={() => editor.chain().focus().toggleSubscript().run()} title="Subscript">
            <Subscript className="h-3.5 w-3.5" />
          </BubbleBtn>
          <BubbleBtn active={false} onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()} title="Clear Formatting">
            <RemoveFormatting className="h-3.5 w-3.5" />
          </BubbleBtn>
          <div className="mx-0.5 h-5 w-px bg-border" />
          <BubbleBtn active={false} onClick={() => setShowFindReplace(true)} title="Find & Replace (Ctrl+F)">
            <Search className="h-3.5 w-3.5" />
          </BubbleBtn>
          <ColorPickerDropdown
            icon={<Type className="h-3.5 w-3.5" />}
            title="Text Color"
            currentColor={editor.getAttributes('textStyle').color || ''}
            onSelect={(color) => color ? editor.chain().focus().setColor(color).run() : editor.chain().focus().unsetColor().run()}
          />
          <ColorPickerDropdown
            icon={<Palette className="h-3.5 w-3.5" />}
            title="Background Color"
            currentColor={editor.getAttributes('highlight').color || ''}
            onSelect={(color) => color ? editor.chain().focus().toggleHighlight({ color }).run() : editor.chain().focus().unsetHighlight().run()}
          />
        </div>
      )}

      {showFindReplace && (
        <FindReplace editor={editor} onClose={() => setShowFindReplace(false)} />
      )}

      {popoverConfig?.item.popover && (
        <SlashCommandPopover
          title={popoverConfig.item.popover.title}
          fields={popoverConfig.item.popover.fields}
          onSubmit={(values) => {
            popoverConfig.item.popover!.onSubmit(values, popoverConfig.editor);
            setPopoverConfig(null);
          }}
          onCancel={() => setPopoverConfig(null)}
        />
      )}

      <EditorContent editor={editor} />
      {editable && <EditorFooter editor={editor} title={title} />}
    </div>
  );
});

function BubbleBtn({ children, active, onClick, title }: { children: React.ReactNode; active: boolean; onClick: () => void; title: string }) {
  return (
    <button
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      title={title}
      className={`rounded-md p-1.5 text-xs transition-all ${
        active ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:bg-accent hover:text-foreground'
      }`}
    >
      {children}
    </button>
  );
}

const COLOR_PALETTE = [
  '#000000', '#434343', '#666666', '#999999', '#cccccc', '#ffffff',
  '#e06c75', '#d19a66', '#e5c07b', '#98c379', '#56b6c2', '#61afef',
  '#c678dd', '#be5046',
  '#ff6b6b', '#ffa94d', '#ffd43b', '#69db7c', '#38d9a9', '#4dabf7',
  '#9775fa', '#f06595',
];

function ColorPickerDropdown({ icon, title, currentColor, onSelect }: {
  icon: React.ReactNode;
  title: string;
  currentColor: string;
  onSelect: (color: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onMouseDown={(e) => { e.preventDefault(); setOpen(!open); }}
        title={title}
        className={`rounded-md p-1.5 text-xs transition-all ${
          currentColor ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:bg-accent hover:text-foreground'
        }`}
        style={currentColor ? { color: currentColor } : undefined}
      >
        {icon}
      </button>
      {open && (
        <div className="absolute left-0 top-full z-[999] mt-1 grid grid-cols-7 gap-1 rounded-lg border-2 border-border bg-popover p-2 shadow-[4px_4px_0px_hsl(0,0%,10%)]">
          <button
            onMouseDown={(e) => { e.preventDefault(); onSelect(''); setOpen(false); }}
            className="col-span-7 mb-1 rounded px-2 py-0.5 text-[10px] font-semibold text-muted-foreground hover:bg-accent"
            title="Remove color"
          >
            Reset
          </button>
          {COLOR_PALETTE.map((color) => (
            <button
              key={color}
              onMouseDown={(e) => { e.preventDefault(); onSelect(color); setOpen(false); }}
              className="h-5 w-5 rounded-sm border border-border transition-transform hover:scale-125"
              style={{ backgroundColor: color }}
              title={color}
            />
          ))}
        </div>
      )}
    </div>
  );
}
