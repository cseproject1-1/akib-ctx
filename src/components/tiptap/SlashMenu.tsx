import { forwardRef, useEffect, useImperativeHandle, useState, useCallback } from 'react';
import {
  Heading1, Heading2, Heading3, Heading4, Heading5, Heading6,
  List, ListOrdered, Code2, Quote, Minus, CheckSquare,
  Type, AlignLeft, AlignCenter, AlignRight, AlertCircle, Sparkles,
  Table2, ImageIcon, ChevronRight, Highlighter, Smile,
  Superscript as SuperscriptIcon, Subscript as SubscriptIcon,
  Calculator, Columns2, AlertTriangle, XCircle,
  Strikethrough, RemoveFormatting, Calendar, Keyboard, FileText,
  Footprints, CaseLower, BarChart3, Tag, Link2, Indent, Outdent,
  CheckCircle2, GitBranch, Music, Video, BookOpen,
} from 'lucide-react';

export interface SlashMenuItem {
  title: string;
  icon: React.ElementType;
  command: (props: { editor: any; range: any }) => void;
  group?: string;
  /** If set, the slash menu will show a popover instead of running immediately */
  popover?: {
    title: string;
    fields: { key: string; label: string; placeholder: string; type?: 'text' | 'number' | 'url'; defaultValue?: string }[];
    onSubmit: (values: Record<string, string>, editor: any) => void;
  };
}

export const slashMenuItems: SlashMenuItem[] = [
  // AI
  {
    title: 'Ask AI',
    icon: Sparkles,
    group: 'AI',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).run();
      editor.chain().focus().insertContent('<div data-callout data-callout-type="info"><p>Ask AI: </p></div>').run();
    },
  },
  // Basic blocks
  {
    title: 'Text',
    icon: Type,
    group: 'Basic',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setParagraph().run();
    },
  },
  {
    title: 'Heading 1',
    icon: Heading1,
    group: 'Basic',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setNode('heading', { level: 1 }).run();
    },
  },
  {
    title: 'Heading 2',
    icon: Heading2,
    group: 'Basic',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setNode('heading', { level: 2 }).run();
    },
  },
  {
    title: 'Heading 3',
    icon: Heading3,
    group: 'Basic',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setNode('heading', { level: 3 }).run();
    },
  },
  {
    title: 'Heading 4',
    icon: Heading4,
    group: 'Basic',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setNode('heading', { level: 4 }).run();
    },
  },
  {
    title: 'Heading 5',
    icon: Heading5,
    group: 'Basic',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setNode('heading', { level: 5 }).run();
    },
  },
  {
    title: 'Heading 6',
    icon: Heading6,
    group: 'Basic',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setNode('heading', { level: 6 }).run();
    },
  },
  {
    title: 'Callout',
    icon: AlertCircle,
    group: 'Basic',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).insertContent('<div data-callout data-callout-type="info"><p>Callout text</p></div>').run();
    },
  },
  {
    title: 'Warning',
    icon: AlertTriangle,
    group: 'Basic',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).insertContent('<div data-callout data-callout-type="warning"><p>Warning text</p></div>').run();
    },
  },
  {
    title: 'Success',
    icon: CheckCircle2,
    group: 'Basic',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).insertContent('<div data-callout data-callout-type="success"><p>Success text</p></div>').run();
    },
  },
  {
    title: 'Error',
    icon: XCircle,
    group: 'Basic',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).insertContent('<div data-callout data-callout-type="error"><p>Error text</p></div>').run();
    },
  },
  // Lists
  {
    title: 'Bullet List',
    icon: List,
    group: 'Lists',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleBulletList().run();
    },
  },
  {
    title: 'Numbered List',
    icon: ListOrdered,
    group: 'Lists',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleOrderedList().run();
    },
  },
  {
    title: 'To-do List',
    icon: CheckSquare,
    group: 'Lists',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleTaskList().run();
    },
  },
  // Code & Blocks
  {
    title: 'Code Block',
    icon: Code2,
    group: 'Blocks',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleCodeBlock().run();
    },
  },
  {
    title: 'Blockquote',
    icon: Quote,
    group: 'Blocks',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleBlockquote().run();
    },
  },
  {
    title: 'Divider',
    icon: Minus,
    group: 'Blocks',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setHorizontalRule().run();
    },
  },
  {
    title: 'Table',
    icon: Table2,
    group: 'Blocks',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
    },
  },
  {
    title: 'Toggle',
    icon: ChevronRight,
    group: 'Blocks',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).run();
      (editor.commands as any).insertToggle();
    },
  },
  {
    title: 'Columns',
    icon: Columns2,
    group: 'Blocks',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).run();
      (editor.commands as any).insertColumns();
    },
  },
  {
    title: 'Math Block',
    icon: Calculator,
    group: 'Blocks',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).run();
    },
    popover: {
      title: 'Insert Math Block',
      fields: [{ key: 'latex', label: 'LaTeX Expression', placeholder: 'E = mc^2', type: 'text', defaultValue: 'E = mc^2' }],
      onSubmit: (values, editor) => {
        if (values.latex) (editor.commands as any).insertMathBlock({ latex: values.latex });
      },
    },
  },
  {
    title: 'Summary',
    icon: FileText,
    group: 'Blocks',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).insertContent(
        '<div data-callout data-callout-type="summary"><p><strong>TL;DR</strong></p><p>Summary text here…</p></div>'
      ).run();
    },
  },
  // Media
  {
    title: 'Image',
    icon: ImageIcon,
    group: 'Media',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).run();
    },
    popover: {
      title: 'Insert Image',
      fields: [{ key: 'url', label: 'Image URL', placeholder: 'https://example.com/image.png', type: 'url' }],
      onSubmit: (values, editor) => {
        if (values.url) editor.chain().focus().setImage({ src: values.url }).run();
      },
    },
  },
  {
    title: 'Emoji',
    icon: Smile,
    group: 'Media',
    command: ({ editor, range }) => {
      const emojis = ['😀', '👍', '❤️', '🎉', '🔥', '⭐', '💡', '✅', '❌', '⚠️', '📌', '🚀'];
      const pick = window.prompt(`Pick emoji (paste or choose):\n${emojis.join(' ')}`, '🎉');
      editor.chain().focus().deleteRange(range).insertContent(pick || '').run();
    },
  },
  {
    title: 'Audio',
    icon: Music,
    group: 'Media',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).run();
    },
    popover: {
      title: 'Insert Audio',
      fields: [{ key: 'src', label: 'Audio URL', placeholder: 'https://example.com/audio.mp3', type: 'url' }],
      onSubmit: (values, editor) => {
        if (values.src) (editor.commands as any).insertAudioBlock({ src: values.src });
      },
    },
  },
  {
    title: 'Video',
    icon: Video,
    group: 'Media',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).run();
    },
    popover: {
      title: 'Insert Video',
      fields: [{ key: 'src', label: 'Video URL (mp4, YouTube, Vimeo)', placeholder: 'https://youtube.com/watch?v=...', type: 'url' }],
      onSubmit: (values, editor) => {
        if (values.src) {
          const url = values.src;
          const isEmbed = url.includes('youtube') || url.includes('vimeo') || url.includes('youtu.be');
          const embedUrl = isEmbed ? url.replace('watch?v=', 'embed/').replace('youtu.be/', 'youtube.com/embed/') : url;
          (editor.commands as any).insertVideoBlock({ src: embedUrl, isEmbed });
        }
      },
    },
  },
  // Formatting
  {
    title: 'Highlight',
    icon: Highlighter,
    group: 'Formatting',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleHighlight().run();
    },
  },
  {
    title: 'Superscript',
    icon: SuperscriptIcon,
    group: 'Formatting',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleSuperscript().run();
    },
  },
  {
    title: 'Subscript',
    icon: SubscriptIcon,
    group: 'Formatting',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleSubscript().run();
    },
  },
  {
    title: 'Strikethrough',
    icon: Strikethrough,
    group: 'Formatting',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleStrike().run();
    },
  },
  {
    title: 'Clear Formatting',
    icon: RemoveFormatting,
    group: 'Formatting',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).unsetAllMarks().clearNodes().run();
    },
  },
  {
    title: 'Keyboard',
    icon: Keyboard,
    group: 'Formatting',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).run();
    },
    popover: {
      title: 'Insert Keyboard Shortcut',
      fields: [{ key: 'key', label: 'Shortcut Text', placeholder: 'Ctrl+S', type: 'text', defaultValue: 'Ctrl+S' }],
      onSubmit: (values, editor) => {
        editor.chain().focus().insertContent(`<kbd>${values.key || 'Key'}</kbd>`).run();
      },
    },
  },
  {
    title: 'Indent',
    icon: Indent,
    group: 'Formatting',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).run();
      const el = editor.view.domAtPos(editor.state.selection.from).node as HTMLElement;
      const current = parseInt(el?.style?.marginLeft || '0', 10);
      editor.chain().focus().insertContent(`<p style="margin-left: ${current + 24}px"> </p>`).run();
    },
  },
  {
    title: 'Outdent',
    icon: Outdent,
    group: 'Formatting',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).run();
      const el = editor.view.domAtPos(editor.state.selection.from).node as HTMLElement;
      const current = parseInt(el?.style?.marginLeft || '0', 10);
      const next = Math.max(0, current - 24);
      editor.chain().focus().insertContent(`<p style="margin-left: ${next}px"> </p>`).run();
    },
  },
  // Insert
  {
    title: 'Date',
    icon: Calendar,
    group: 'Insert',
    command: ({ editor, range }) => {
      const now = new Date();
      const formatted = now.toLocaleDateString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      });
      editor.chain().focus().deleteRange(range).insertContent(
        `<span data-date class="inline-date">${formatted}</span>`
      ).run();
    },
  },
  {
    title: 'Footnote',
    icon: Footprints,
    group: 'Insert',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).run();
    },
    popover: {
      title: 'Insert Footnote',
      fields: [{ key: 'text', label: 'Footnote Text', placeholder: 'Reference note…', type: 'text' }],
      onSubmit: (values, editor) => {
        if (values.text) (editor.commands as any).insertFootnote({ text: values.text });
      },
    },
  },
  {
    title: 'Caption',
    icon: CaseLower,
    group: 'Insert',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).run();
      (editor.commands as any).insertCaption();
    },
  },
  {
    title: 'Progress',
    icon: BarChart3,
    group: 'Insert',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).run();
    },
    popover: {
      title: 'Insert Progress Bar',
      fields: [{ key: 'value', label: 'Percentage (0-100)', placeholder: '50', type: 'number', defaultValue: '50' }],
      onSubmit: (values, editor) => {
        const val = Math.min(100, Math.max(0, parseInt(values.value || '50', 10)));
        (editor.commands as any).insertProgress({ value: val });
      },
    },
  },
  {
    title: 'Badge',
    icon: Tag,
    group: 'Insert',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).run();
    },
    popover: {
      title: 'Insert Badge',
      fields: [{ key: 'label', label: 'Badge Label', placeholder: 'New', type: 'text', defaultValue: 'New' }],
      onSubmit: (values, editor) => {
        if (values.label) (editor.commands as any).insertBadge({ label: values.label });
      },
    },
  },
  {
    title: 'Bookmark',
    icon: Link2,
    group: 'Insert',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).run();
    },
    popover: {
      title: 'Insert Bookmark',
      fields: [
        { key: 'url', label: 'URL', placeholder: 'https://example.com', type: 'url' },
        { key: 'title', label: 'Title', placeholder: 'My Bookmark', type: 'text' },
      ],
      onSubmit: (values, editor) => {
        if (values.url) (editor.commands as any).insertBookmark({ url: values.url, title: values.title || values.url });
      },
    },
  },
  {
    title: 'Diagram',
    icon: GitBranch,
    group: 'Insert',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).run();
      (editor.commands as any).insertMermaidBlock();
    },
  },
  // Alignment
  {
    title: 'Align Left',
    icon: AlignLeft,
    group: 'Align',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setTextAlign('left').run();
    },
  },
  {
    title: 'Align Center',
    icon: AlignCenter,
    group: 'Align',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setTextAlign('center').run();
    },
  },
  {
    title: 'Align Right',
    icon: AlignRight,
    group: 'Align',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setTextAlign('right').run();
    },
  },
  // Templates
  {
    title: 'Meeting Minutes',
    icon: FileText,
    group: 'Templates',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).insertContent(`
        <h1>📅 Meeting Minutes</h1>
        <p><strong>Date:</strong> \${new Date().toLocaleDateString()}</p>
        <p><strong>Participants:</strong> </p>
        <hr />
        <h3>Objective</h3>
        <p>Briefly state the goal of the meeting.</p>
        <h3>Agenda</h3>
        <ul><li></li></ul>
        <h3>Action Items</h3>
        <ul data-type="taskList">
          <li data-type="taskItem" data-checked="false"><label><input type="checkbox" /> Task 1</label></li>
        </ul>
      `).run();
    },
  },
  {
    title: 'Project Roadmap',
    icon: GitBranch,
    group: 'Templates',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).insertContent(`
        <h1>🚀 Project Roadmap</h1>
        <div data-callout data-callout-type="info"><p>Current Status: Planning</p></div>
        <h3>Phase 1: Research</h3>
        <ul data-type="taskList">
          <li data-type="taskItem" data-checked="true"><label><input type="checkbox" checked /> Market Analysis</label></li>
          <li data-type="taskItem" data-checked="false"><label><input type="checkbox" /> Competitor Review</label></li>
        </ul>
        <h3>Phase 2: Execution</h3>
        <p>Next steps...</p>
      `).run();
    },
  },
  {
    title: 'Cornell Notes',
    icon: BookOpen,
    group: 'Templates',
    command: ({ editor, range }) => {
       editor.chain().focus().deleteRange(range).insertContent(`
        <h1>📖 Cornell Notes</h1>
        <table class="tiptap-table">
          <tbody>
            <tr>
              <th colspan="1" rowspan="1"><p>Cues/Questions</p></th>
              <th colspan="2" rowspan="1"><p>Notes</p></th>
            </tr>
            <tr>
              <td colspan="1" rowspan="2"><p></p></td>
              <td colspan="2" rowspan="2"><p></p></td>
            </tr>
          </tbody>
        </table>
        <div data-callout data-callout-type="summary"><p><strong>Summary</strong></p><p>Synthesis of the main ideas...</p></div>
      `).run();
    },
  },
  {
    title: 'Budget Table',
    icon: BarChart3,
    group: 'Templates',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).run();
      (editor.commands as any).insertBudgetTable();
    },
  },
  {
    title: 'Calendar Table',
    icon: Calendar,
    group: 'Templates',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).run();
      (editor.commands as any).insertCalendarTable();
    },
  },
];

interface SlashMenuListProps {
  items: SlashMenuItem[];
  command: (item: SlashMenuItem) => void;
}

export const SlashMenuList = forwardRef<any, SlashMenuListProps>(
  ({ items, command }, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0);

    useEffect(() => {
      setSelectedIndex(0);
    }, [items]);

    const selectItem = useCallback(
      (index: number) => {
        const item = items[index];
        if (item) command(item);
      },
      [items, command]
    );

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }: { event: KeyboardEvent }) => {
        if (event.key === 'ArrowUp') {
          setSelectedIndex((prev) => (prev + items.length - 1) % items.length);
          return true;
        }
        if (event.key === 'ArrowDown') {
          setSelectedIndex((prev) => (prev + 1) % items.length);
          return true;
        }
        if (event.key === 'Enter') {
          selectItem(selectedIndex);
          return true;
        }
        return false;
      },
    }));

    if (items.length === 0) return null;

    const groups: { name: string; items: { item: SlashMenuItem; globalIndex: number }[] }[] = [];
    const groupMap = new Map<string, { item: SlashMenuItem; globalIndex: number }[]>();

    items.forEach((item, i) => {
      const g = item.group || 'Other';
      if (!groupMap.has(g)) groupMap.set(g, []);
      groupMap.get(g)!.push({ item, globalIndex: i });
    });

    groupMap.forEach((gItems, name) => {
      groups.push({ name, items: gItems });
    });

    return (
      <div className="z-[500] max-h-[320px] w-60 overflow-y-auto rounded-lg border border-primary bg-card p-1.5 shadow-[var(--clay-shadow-sm)] animate-brutal-pop">
        {groups.map((group) => (
          <div key={group.name}>
            <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              {group.name}
            </div>
            {group.items.map(({ item, globalIndex }) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.title}
                  className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-semibold transition-all ${
                    globalIndex === selectedIndex
                      ? 'bg-primary text-primary-foreground'
                      : 'text-foreground hover:bg-accent'
                  }`}
                  onClick={() => selectItem(globalIndex)}
                  onMouseEnter={() => setSelectedIndex(globalIndex)}
                >
                  <Icon className="h-4 w-4" />
                  {item.title}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    );
  }
);

SlashMenuList.displayName = 'SlashMenuList';
