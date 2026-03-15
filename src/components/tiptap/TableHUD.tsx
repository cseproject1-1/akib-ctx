import React from 'react';
import { Plus, Minus, Trash2, ArrowDown, ArrowUp, ArrowRight, ArrowLeft } from 'lucide-react';
import { Editor } from '@tiptap/react';

interface TableHUDProps {
  editor: Editor;
}

export function TableHUD({ editor }: TableHUDProps) {
  if (!editor.isActive('table')) return null;

  return (
    <div className="flex items-center gap-1.5 rounded-lg border-2 border-primary bg-card p-1 shadow-[4px_4px_0px_rgba(0,0,0,1)] animate-brutal-pop">
      <div className="flex items-center gap-0.5 border-r pr-1.5 border-border">
         <HUDButton onClick={() => editor.chain().focus().addRowBefore().run()} title="Add Row Above"><ArrowUp className="h-3 w-3" /></HUDButton>
         <HUDButton onClick={() => editor.chain().focus().addRowAfter().run()} title="Add Row Below"><ArrowDown className="h-3 w-3" /></HUDButton>
         <HUDButton onClick={() => editor.chain().focus().deleteRow().run()} title="Delete Row" destructive><Minus className="h-3 w-3" /></HUDButton>
      </div>
      <div className="flex items-center gap-0.5 border-r pr-1.5 border-border">
         <HUDButton onClick={() => editor.chain().focus().addColumnBefore().run()} title="Add Column Left"><ArrowLeft className="h-3 w-3" /></HUDButton>
         <HUDButton onClick={() => editor.chain().focus().addColumnAfter().run()} title="Add Column Right"><ArrowRight className="h-3 w-3" /></HUDButton>
         <HUDButton onClick={() => editor.chain().focus().deleteColumn().run()} title="Delete Column" destructive><Minus className="h-3 w-3" /></HUDButton>
      </div>
      <div className="flex items-center gap-0.5">
         <HUDButton onClick={() => editor.chain().focus().mergeCells().run()} title="Merge Cells">M</HUDButton>
         <HUDButton onClick={() => editor.chain().focus().splitCell().run()} title="Split Cell">S</HUDButton>
         <HUDButton onClick={() => editor.chain().focus().deleteTable().run()} title="Delete Table" destructive><Trash2 className="h-3 w-3" /></HUDButton>
      </div>
    </div>
  );
}

function HUDButton({ children, onClick, title, destructive }: { children: React.ReactNode; onClick: () => void; title: string; destructive?: boolean }) {
  return (
    <button
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      title={title}
      className={`rounded p-1.5 text-[10px] font-bold transition-all ${
        destructive 
          ? 'text-destructive hover:bg-destructive/10' 
          : 'text-foreground hover:bg-accent'
      }`}
    >
      {children}
    </button>
  );
}
