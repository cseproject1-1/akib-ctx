import { useEffect, useState } from 'react';
import { Download, FileText, FileDown } from 'lucide-react';
import type { Editor } from '@tiptap/react';
import { editorToMarkdown, downloadFile, editorToPdf } from '@/lib/tiptap/exportEditor';
import { toast } from 'sonner';

interface EditorFooterProps {
  editor: Editor | null;
  title?: string;
}

export function EditorFooter({ editor, title }: EditorFooterProps) {
  const [stats, setStats] = useState({ words: 0, chars: 0, readTime: '0 min' });
  const [showExport, setShowExport] = useState(false);

  useEffect(() => {
    if (!editor) return;

    const update = () => {
      const text = editor.getText();
      const words = text.trim() ? text.trim().split(/\s+/).length : 0;
      const chars = text.length;
      const minutes = Math.max(1, Math.ceil(words / 200));
      setStats({ words, chars, readTime: `${minutes} min read` });
    };

    update();
    editor.on('update', update);
    return () => { editor.off('update', update); };
  }, [editor]);

  if (!editor) return null;

  const handleExportMarkdown = () => {
    const md = editorToMarkdown(editor);
    const filename = `${(title || 'document').replace(/\s+/g, '-').toLowerCase()}.md`;
    downloadFile(md, filename, 'text/markdown');
    toast.success('Exported as Markdown');
    setShowExport(false);
  };

  const handleExportPdf = () => {
    editorToPdf(editor, title);
    toast.success('PDF export opened');
    setShowExport(false);
  };

  return (
    <div className="flex items-center justify-between border-t border-border px-4 py-1.5 select-none">
      <div className="flex items-center gap-3 text-[10px] font-mono text-muted-foreground">
        <span>{stats.words} words</span>
        <span className="text-border">·</span>
        <span>{stats.chars} chars</span>
        <span className="text-border">·</span>
        <span>{stats.readTime}</span>
      </div>

      {/* Export menu */}
      <div className="relative">
        <button
          onClick={() => setShowExport(!showExport)}
          className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground transition-all hover:bg-accent hover:text-foreground active:scale-95"
          title="Export"
        >
          <Download className="h-3 w-3" />
          <span className="hidden sm:inline">Export</span>
        </button>

        {showExport && (
          <div className="absolute right-0 bottom-full mb-1 z-50 flex flex-col gap-0.5 rounded-lg border-2 border-border bg-card p-1 shadow-[var(--brutal-shadow)] animate-scale-in min-w-[140px]">
            <button
              onClick={handleExportMarkdown}
              className="flex items-center gap-2 rounded px-2.5 py-1.5 text-xs font-bold text-foreground transition-all hover:bg-accent hover:translate-x-0.5"
            >
              <FileText className="h-3.5 w-3.5 text-muted-foreground" />
              Markdown (.md)
            </button>
            <button
              onClick={handleExportPdf}
              className="flex items-center gap-2 rounded px-2.5 py-1.5 text-xs font-bold text-foreground transition-all hover:bg-accent hover:translate-x-0.5"
            >
              <FileDown className="h-3.5 w-3.5 text-muted-foreground" />
              PDF (Print)
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
