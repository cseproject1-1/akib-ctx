import { useEditor, EditorContent, Editor } from '@tiptap/react';
import { getEditorExtensions } from '@/lib/tiptap/extensions';
import { cn } from '@/lib/utils';
import { extensionRegistry, type AnyExtension } from '@/lib/tiptap/extensionRegistry';
import { Bold, Italic, Strikethrough, Code, Heading1, Heading2, Link as LinkIcon, List, ListOrdered, Quote, Highlighter, Underline as UnderlineIcon, Palette, Type, Superscript, Subscript, RemoveFormatting, Search, Sparkles } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import type { JSONContent } from '@tiptap/react';
import { Markdown } from 'tiptap-markdown';
import { EditorFooter } from './EditorFooter';
import { FindReplace } from './FindReplace';
import { SlashCommandPopover } from './SlashCommandPopover';
import type { SlashMenuItem } from './SlashMenu';
import { marked } from 'marked';
import { useCanvasStore } from '@/store/canvasStore';
import { TypographyDropdown } from './TypographyDropdown';
import { ColorPickerDropdown } from './ColorPickerDropdown';
import { AIInlineTool } from './AIInlineTool';
import { TableHUD } from './TableHUD';
import { markdownToHtml, sanitizeKatexHtml } from '@/lib/editor/markdownUtils';
import { normalizeHtml, isClipboardFromExternalApp } from '@/lib/editor/htmlNormalizer';

/**
 * Calculate task progress from Tiptap JSON content.
 */
function calculateProgress(json: JSONContent): number | undefined {
  let total = 0;
  let completed = 0;
  const traverse = (node: any) => {
    if (node.type === 'taskItem') {
      total++;
      if (node.attrs?.checked) completed++;
    }
    if (node.content && Array.isArray(node.content)) {
      node.content.forEach(traverse);
    }
  };
  traverse(json);
  return total > 0 ? (completed / total) * 100 : undefined;
}

export interface NoteEditorHandle {
  reparseAsMarkdown: () => void;
  getEditor: () => Editor | null;
}

interface NoteEditorProps {
  initialContent?: JSONContent | null;
  onChange?: (json: JSONContent) => void;
  placeholder?: string;
  editable?: boolean;
  pasteContent?: string;
  pasteFormat?: 'markdown' | 'html';
  title?: string;
  onFocusModeChange?: (active: boolean) => void;
  onProgressChange?: (progress: number | undefined) => void;
  nodeId?: string;
}

let globalAsyncExtensions: AnyExtension[] | null = null;
let globalAsyncExtensionsPromise: Promise<AnyExtension[]> | null = null;

function loadGlobalExtensions() {
  if (globalAsyncExtensionsPromise) return globalAsyncExtensionsPromise;
  
  globalAsyncExtensionsPromise = (async () => {
    try {
      const results = await Promise.allSettled([
        extensionRegistry.loadMath(),
        extensionRegistry.loadCode(),
        extensionRegistry.loadCustomBlocks(),
        extensionRegistry.loadMermaid(),
        extensionRegistry.loadMacro(),
      ]);
      
      const loadedExtensions: AnyExtension[] = [];
      results.forEach((res) => {
        if (res.status === 'fulfilled') {
          if (Array.isArray(res.value)) {
            loadedExtensions.push(...res.value);
          } else {
            loadedExtensions.push(res.value);
          }
        }
      });
      
      globalAsyncExtensions = loadedExtensions;
      return loadedExtensions;
    } catch (error) {
      console.error('Failed to load global extensions:', error);
      globalAsyncExtensions = [];
      return [];
    } finally {
      globalAsyncExtensionsPromise = null;
    }
  })();
  
  return globalAsyncExtensionsPromise;
}

export const NoteEditor = forwardRef<NoteEditorHandle, NoteEditorProps>(function NoteEditor(props, ref) {
  const [extensions, setExtensions] = useState<AnyExtension[] | null>(globalAsyncExtensions);

  useEffect(() => {
    let mounted = true;
    if (!extensions) {
      loadGlobalExtensions().then((exts) => {
        if (mounted) setExtensions(exts);
      });
    }
    return () => { mounted = false; };
  }, [extensions]);

  if (!extensions) {
    return <div className="min-h-[80px] px-4 py-3 animate-pulse bg-muted/10 rounded-md" />;
  }

  return <NoteEditorImpl {...props} asyncExtensions={extensions} ref={ref} />;
});

interface NoteEditorImplProps extends NoteEditorProps {
  asyncExtensions: AnyExtension[];
}

const NoteEditorImpl = forwardRef<NoteEditorHandle, NoteEditorImplProps>(function NoteEditorImpl({ nodeId, initialContent, onChange, placeholder, editable = true, pasteContent, pasteFormat, title, asyncExtensions, onFocusModeChange, onProgressChange }, ref) {
  const [showBubble, setShowBubble] = useState(false);
  const [bubblePos, setBubblePos] = useState({ top: 0, left: 0 });
  const [showFindReplace, setShowFindReplace] = useState(false);
  const [popoverConfig, setPopoverConfig] = useState<{ item: SlashMenuItem; editor: any } | null>(null);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [isTypewriterMode, setIsTypewriterMode] = useState(false);
  const [showAIInline, setShowAIInline] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const backlinkTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const typewriterRef = useRef(isTypewriterMode);
  const nodeIdRef = useRef(nodeId);

  // Sync refs
  useEffect(() => { typewriterRef.current = isTypewriterMode; }, [isTypewriterMode]);
  useEffect(() => { nodeIdRef.current = nodeId; }, [nodeId]);

  const editor = useEditor({
    extensions: [
      ...getEditorExtensions(placeholder),
      ...asyncExtensions,
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
        class: 'tiptap-editor outline-none focus:outline-none min-h-[0] text-sm text-foreground',
      },
      handleKeyDown: (_view, event) => {
        // Ctrl+F / Cmd+F for find & replace
        if ((event.ctrlKey || event.metaKey) && event.key === 'f' && !event.shiftKey) {
          event.preventDefault();
          event.stopPropagation();
          setShowFindReplace(true);
          return true;
        }

        // Ctrl+Shift+D for focus mode
        if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'd') {
          event.preventDefault();
          event.stopPropagation();
          const next = !isFocusMode;
          setIsFocusMode(next);
          onFocusModeChange?.(next);
          return true;
        }

        event.stopPropagation();
        return false;
      },
      handlePaste: (view, event) => {
        // ---------------------------------------------------------------
        // STEP 1 — Image paste (screenshots / copied images)
        // ---------------------------------------------------------------
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

        // ---------------------------------------------------------------
        // STEP 2 — KaTeX math HTML (class="katex" rendered HTML)
        // ---------------------------------------------------------------
        if (clipboardHtml.trim().length > 0 && /class="katex/i.test(clipboardHtml)) {
          event.preventDefault();
          const sanitized = sanitizeKatexHtml(clipboardHtml);
          editor?.commands.insertContent(sanitized);
          return true;
        }

        // ---------------------------------------------------------------
        // STEP 3 — External app HTML (Notion / Google Docs / Word)
        //           Use DOM-based normalizer to preserve structure
        // ---------------------------------------------------------------
        if (clipboardHtml.trim().length > 0 && isClipboardFromExternalApp(clipboardHtml)) {
          event.preventDefault();
          const normalized = normalizeHtml(clipboardHtml);
          if (normalized.trim().length > 0) {
            editor?.commands.insertContent(normalized);
          } else {
            // Normalizer produced nothing — fall back to plain text
            const html = markdownToHtml(clipboardText);
            editor?.commands.insertContent(html);
          }
          return true;
        }

        // ---------------------------------------------------------------
        // STEP 4 — Mermaid diagram text
        // ---------------------------------------------------------------
        const mermaidRe = /^\s*(graph\s+(TD|LR|RL|BT|TB)|sequenceDiagram|gantt|classDiagram|erDiagram|pie(\s+title)?|flowchart\s+(TD|LR|RL|BT|TB)|journey|gitGraph|mindmap|timeline|quadrantChart|requirementDiagram)/i;
        if (mermaidRe.test(clipboardText)) {
          event.preventDefault();
          const fenced = '```mermaid\n' + clipboardText.trim() + '\n```';
          const html = markdownToHtml(fenced);
          editor?.commands.insertContent(html);
          return true;
        }

        // ---------------------------------------------------------------
        // STEP 5 — Strong markdown / code from AI chat / docs
        // ---------------------------------------------------------------
        const isStrongMarkdown = /```[\s\S]*?```|~~~[\s\S]*?~~~|`[^`]+`|^\s*#{1,6}\s|^[\s]*[*+-]\s|^[\s]*\d+\.\s|\[.+\]\(.+\)|\$\$[\s\S]+?\$\$|\|[-:\s]+\|[-:\s]+\|/m.test(clipboardText);
        const isCodeFallback = !isStrongMarkdown && /^(const|let|var|function|class|import|export|if|for|while)\b/m.test(clipboardText);

        if (isStrongMarkdown || isCodeFallback) {
          event.preventDefault();
          let textToParse = clipboardText;
          if (isCodeFallback) {
            textToParse = `\`\`\`javascript\n${clipboardText}\n\`\`\``;
          }
          const html = markdownToHtml(textToParse);
          editor?.commands.insertContent(html);
          return true;
        }

        // ---------------------------------------------------------------
        // STEP 6 — Generic HTML paste (websites, emails, etc.)
        //           Let TipTap's schema filter handle it — it handles
        //           common elements well without normalization
        // ---------------------------------------------------------------
        if (clipboardHtml.trim().length > 0) {
          const hasSemanticTags = /<(h[1-6]|table|thead|tbody|tr|th|td|ul|ol|li|pre|code|blockquote|strong|em|img)\b/i.test(clipboardHtml);
          if (hasSemanticTags) {
            // Let TipTap handle it natively; schema filtering strips unknowns
            return false;
          }
        }

        // ---------------------------------------------------------------
        // STEP 7 — Bare URL → clickable link
        // ---------------------------------------------------------------
        if (/^https?:\/\/[^\s<>]+$/.test(clipboardText.trim())) {
          event.preventDefault();
          const url = clipboardText.trim();
          const sanitizedUrl = url.replace(/"/g, '&quot;');
          editor?.chain().focus().insertContent(
            `<a href="${sanitizedUrl}" target="_blank" rel="noopener noreferrer">${sanitizedUrl}</a>`
          ).run();
          return true;
        }

        // ---------------------------------------------------------------
        // STEP 8 — Plain text fallback: convert via markdownToHtml
        // ---------------------------------------------------------------
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
      const json = editor.getJSON();
      onChange?.(json);
      onProgressChange?.(calculateProgress(json));

      // Debounced Sync backlinks
      if (nodeId) {
        if (backlinkTimeoutRef.current) clearTimeout(backlinkTimeoutRef.current);
        backlinkTimeoutRef.current = setTimeout(() => {
          const targetIds: string[] = [];
          const traverse = (node: any) => {
            if (node.type === 'wiki-link' && node.attrs?.nodeId) {
              targetIds.push(node.attrs.nodeId);
            }
            if (node.content && Array.isArray(node.content)) {
              node.content.forEach(traverse);
            }
          };
          traverse(json);
          useCanvasStore.getState().updateBacklinks(nodeId, [...new Set(targetIds)]);
        }, 1000); // 1s debounce for heavy traversal
      }
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
        setShowAIInline(false);
      }

      if (typewriterRef.current) {
        editor.view.dom.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
    },
  });

  // Cleanup backlink timeout
  useEffect(() => {
    return () => {
      if (backlinkTimeoutRef.current) clearTimeout(backlinkTimeoutRef.current);
      if (pasteTimeoutRef.current) clearTimeout(pasteTimeoutRef.current);
      if (reparseTimeoutRef.current) clearTimeout(reparseTimeoutRef.current);
    };
  }, []);

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
  const pasteTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  // Reset applied paste on node change
  useEffect(() => {
    appliedPasteContent.current = null;
  }, [nodeId]);

  useEffect(() => {
    if (editor && pasteContent && appliedPasteContent.current !== pasteContent) {
      appliedPasteContent.current = pasteContent;
      if (pasteFormat === 'html') {
        editor.commands.setContent(pasteContent);
      } else {
        const html = markdownToHtml(pasteContent);
        editor.commands.setContent(html);
      }
      
      if (pasteTimeoutRef.current) clearTimeout(pasteTimeoutRef.current);
      pasteTimeoutRef.current = setTimeout(() => {
        onChange?.(editor.getJSON());
      }, 50);
    }
    return () => {
      if (pasteTimeoutRef.current) clearTimeout(pasteTimeoutRef.current);
    };
  }, [editor, pasteContent, pasteFormat, onChange]);

  const reparseTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  useImperativeHandle(ref, () => ({
    reparseAsMarkdown: () => {
      if (!editor) return;
      const plainText = editor.getText();
      if (!plainText.trim()) return;
      const html = markdownToHtml(plainText);
      editor.commands.setContent(html);
      
      if (reparseTimeoutRef.current) clearTimeout(reparseTimeoutRef.current);
      reparseTimeoutRef.current = setTimeout(() => {
        onChange?.(editor.getJSON());
      }, 50);
    },
    getEditor: () => editor,
  }), [editor, onChange]);

  useEffect(() => {
    return () => {
      if (reparseTimeoutRef.current) clearTimeout(reparseTimeoutRef.current);
    };
  }, []);

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

  // Wiki-link click handler
  useEffect(() => {
    if (!editor) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('.wiki-link')) {
        const link = target.closest('.wiki-link') as HTMLElement;
        const nodeId = link.getAttribute('data-node-id');
        if (nodeId) {
          e.preventDefault();
          e.stopPropagation();
          useCanvasStore.getState().setFocusedNodeId(nodeId);
          // Also expand if it was collapsed (optional, but good UX)
          useCanvasStore.getState().updateNodeData(nodeId, { collapsed: false });
        }
      }
    };

    const handleMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const link = target.closest('a');
      if (link && link.href) {
        useCanvasStore.getState().setHoveredLink({
          url: link.href,
          x: e.clientX,
          y: e.clientY,
        });
      }
    };

    const handleMouseOut = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('a')) {
        useCanvasStore.getState().setHoveredLink(null);
      }
    };

    editor.view.dom.addEventListener('click', handleClick);
    editor.view.dom.addEventListener('mouseover', handleMouseOver);
    editor.view.dom.addEventListener('mouseout', handleMouseOut);
    
    return () => {
      editor.view.dom.removeEventListener('click', handleClick);
      editor.view.dom.removeEventListener('mouseover', handleMouseOver);
      editor.view.dom.removeEventListener('mouseout', handleMouseOut);
    };
  }, [editor]);

  if (!editor) return (
    <div className="tiptap-wrapper relative nodrag nowheel nopan min-h-[80px] flex items-center justify-center">
      <div className="flex flex-col items-center gap-2 text-muted-foreground">
        <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <span className="text-xs font-medium">Loading editor...</span>
      </div>
    </div>
  );

  return (
    <div className="tiptap-wrapper relative nodrag nowheel nopan" onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()} ref={wrapperRef}>
      {showBubble && editable && (
        <div
          className="absolute z-50 flex items-center gap-0.5 rounded-lg border border-primary bg-card p-1 shadow-[var(--clay-shadow-sm)] animate-brutal-pop"
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
          <div className="mx-0.5 h-5 w-px bg-border" />
          <div className="mx-0.5 h-5 w-px bg-border" />
          <TypographyDropdown editor={editor} />
          <div className="mx-0.5 h-5 w-px bg-border" />
          <button
            onClick={(e) => { e.preventDefault(); setShowAIInline(!showAIInline); }}
            className={cn(
              "rounded-md p-1.5 text-xs transition-all flex items-center gap-1.5 font-bold",
              showAIInline ? "bg-primary text-primary-foreground shadow-[inset_2px_2px_0px_rgba(0,0,0,0.2)]" : "text-primary hover:bg-primary/10"
            )}
          >
            <Sparkles className="h-3.5 w-3.5" />
            {showAIInline ? "Close AI" : "Magic Pen"}
          </button>
        </div>
      )}

      {showAIInline && showBubble && editable && (
        <div
          className="absolute z-50 rounded-xl border border-primary bg-card p-2 shadow-[var(--clay-shadow-md)] animate-brutal-pop"
          style={{ 
            top: bubblePos.top + 45, 
            left: bubblePos.left,
            maxWidth: '320px'
          }}
        >
          <AIInlineTool 
            selectedText={editor.state.doc.textBetween(editor.state.selection.from, editor.state.selection.to)}
            onApply={(text) => {
                const html = markdownToHtml(text);
                editor.chain().focus().insertContent(html).run();
                setShowAIInline(false);
                setShowBubble(false);
            }}
            onCancel={() => setShowAIInline(false)}
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

      {editor.isActive('table') && editable && (
        <div 
          className="absolute z-50 pointer-events-auto"
          style={{ 
            top: bubblePos.top - 40,
            left: bubblePos.left,
          }}
        >
          <TableHUD editor={editor} />
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        <EditorContent 
          editor={editor} 
          className={cn(
            "transition-all duration-500",
            isFocusMode ? "max-w-2xl mx-auto py-20" : ""
          )} 
        />
      </div>
      {editable && (
        <EditorFooter 
          editor={editor} 
          title={title} 
          isFocusMode={isFocusMode}
          onToggleFocus={() => {
            const next = !isFocusMode;
            setIsFocusMode(next);
            onFocusModeChange?.(next);
          }}
          isTypewriterMode={isTypewriterMode}
          onToggleTypewriter={() => setIsTypewriterMode(!isTypewriterMode)}
        />
      )}
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
