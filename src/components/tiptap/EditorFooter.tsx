import { useEffect, useState } from 'react';
import { Download, FileText, FileDown, Eye, MousePointerClick, Zap, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Editor } from '@tiptap/react';
import { editorToMarkdown, downloadFile, editorToPdf } from '@/lib/tiptap/exportEditor';
import { toast } from 'sonner';

interface EditorFooterProps {
  editor: Editor | null;
  title?: string;
  isFocusMode?: boolean;
  onToggleFocus?: () => void;
  isTypewriterMode?: boolean;
  onToggleTypewriter?: () => void;
}

export function EditorFooter({ 
  editor, 
  title, 
  isFocusMode, 
  onToggleFocus, 
  isTypewriterMode, 
  onToggleTypewriter,
}: EditorFooterProps) {
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

      {/* Macro System */}
      <div className="flex items-center gap-2">
        <div className="relative">
          <button
            onClick={() => {
              const macroStorage = (editor.storage as any).macro;
              if (macroStorage?.isRecording) {
                const name = window.prompt('Macro Name:');
                editor.commands.stopRecording(name || '');
              } else {
                editor.commands.startRecording();
                toast.info('Recording macro... interactions are being tracked.');
              }
            }}
            className={`flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider transition-all active:scale-95 ${
              (editor.storage as any).macro?.isRecording 
                ? 'bg-destructive/10 text-destructive animate-pulse' 
                : 'text-muted-foreground hover:bg-accent hover:text-foreground'
            }`}
            title={(editor.storage as any).macro?.isRecording ? 'Stop Recording' : 'Record Macro'}
          >
            <div className={`h-2 w-2 rounded-full ${(editor.storage as any).macro?.isRecording ? 'bg-destructive' : 'bg-muted-foreground'}`} />
            {(editor.storage as any).macro?.isRecording ? 'Rec ON' : 'Macro'}
          </button>
        </div>

        {(editor.storage as any).macro?.macros?.length > 0 && (
          <div className="group relative">
            <button className="rounded px-1 text-[10px] font-bold text-muted-foreground hover:bg-accent hover:text-foreground">
              Play ({(editor.storage as any).macro?.macros.length})
            </button>
            <div className="absolute right-0 bottom-full mb-1 z-50 hidden group-hover:flex flex-col gap-0.5 rounded-lg border-2 border-border bg-card p-1 shadow-[var(--brutal-shadow)] min-w-[120px]">
              {(editor.storage as any).macro?.macros.map((m: any) => (
                <button
                  key={m.id}
                  onClick={() => {
                    editor.commands.playMacro(m.id);
                    toast.success(`Played "${m.name}"`);
                  }}
                  className="flex items-center rounded px-2 py-1 text-[10px] font-bold text-foreground hover:bg-accent"
                >
                  {m.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="h-4 w-px bg-border mx-1" />

        {/* Focus Mode & Typewriter */}
        <button
          onClick={onToggleFocus}
          className={cn(
            "flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider transition-all active:scale-95",
            isFocusMode ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground"
          )}
          title="Focus Mode (Distraction-free)"
        >
          <Eye className="h-3 w-3" />
          <span className="hidden lg:inline">Focus</span>
        </button>

        <button
          onClick={onToggleTypewriter}
          className={cn(
            "flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider transition-all active:scale-95",
            isTypewriterMode ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground"
          )}
          title="Typewriter Mode (Autoscroll cursor)"
        >
          <Zap className="h-3 w-3" />
          <span className="hidden lg:inline">Typewriter</span>
        </button>

        <div className="h-4 w-px bg-border mx-1" />

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
    </div>
  );
}
