import React, { useEffect, useState } from 'react';
import { type Editor } from '@tiptap/react';
import { ListIcon, ChevronRight, Hash } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OutlinePanelProps {
  editor: Editor | null;
  onClose?: () => void;
}

export function OutlinePanel({ editor, onClose }: OutlinePanelProps) {
  const [headings, setHeadings] = useState<{ text: string; level: number; pos: number }[]>([]);

  useEffect(() => {
    if (!editor) return;

    const updateHeadings = () => {
      const items: { text: string; level: number; pos: number }[] = [];
      editor.state.doc.descendants((node, pos) => {
        if (node.type.name === 'heading') {
          items.push({
            text: node.textContent,
            level: node.attrs.level,
            pos: pos,
          });
        }
      });
      setHeadings(items);
    };

    updateHeadings();
    editor.on('update', updateHeadings);
    return () => { editor.off('update', updateHeadings); };
  }, [editor]);

  if (!editor) return null;

  const scrollToHeading = (pos: number) => {
    editor.commands.focus();
    editor.commands.setTextSelection(pos);
    editor.commands.scrollIntoView();
  };

  return (
    <div className="flex h-full flex-col bg-muted/30 border-l border-border animate-slide-in-right overflow-hidden select-none">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <ListIcon className="h-4 w-4 text-primary" />
          <span className="text-xs font-black uppercase tracking-widest text-foreground">Outline</span>
        </div>
        {onClose && (
           <button onClick={onClose} className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground" title="Close outline">
             <ChevronRight className="h-4 w-4" />
           </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-2 scrollbar-hide">
        {headings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
             <Hash className="h-8 w-8 opacity-20 mb-2" />
             <p className="text-[10px] font-bold uppercase tracking-wider">No headings found</p>
             <p className="text-[9px] mt-1 px-4 opacity-60">Add H1-H6 headers to see them here.</p>
          </div>
        ) : (
          <div className="space-y-0.5">
            {headings.map((h, i) => (
              <button
                key={i}
                onClick={() => scrollToHeading(h.pos)}
                className={cn(
                  "group flex w-full items-start gap-2 rounded-md px-3 py-2 text-left transition-all hover:bg-accent",
                  h.level === 1 ? "pl-3" :
                  h.level === 2 ? "pl-6" :
                  h.level === 3 ? "pl-9" :
                  "pl-12"
                )}
              >
                <span className={cn(
                  "mt-1 text-[11px] font-bold leading-tight line-clamp-2",
                  h.level === 1 ? "text-foreground font-black uppercase" :
                  h.level === 2 ? "text-foreground/90" :
                  "text-muted-foreground"
                )}>
                  {h.text || <span className="italic opacity-50 font-normal">Untitled Heading</span>}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
