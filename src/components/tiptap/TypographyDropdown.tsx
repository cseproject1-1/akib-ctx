import React, { useState, useRef, useEffect } from 'react';
import { Editor } from '@tiptap/react';
import { Type, AlignJustify, MoveVertical, Smartphone } from 'lucide-react';

const FONT_FAMILIES = [
  { name: 'Sans', value: 'Inter, sans-serif' },
  { name: 'Serif', value: 'Merriweather, serif' },
  { name: 'Mono', value: "'JetBrains Mono', monospace" },
  { name: 'System', value: 'system-ui' },
];

const LINE_HEIGHTS = ['1.0', '1.2', '1.5', '2.0'];
const LETTER_SPACINGS = ['-0.02em', '0', '0.02em', '0.05em'];

export const TypographyDropdown = ({ editor }: { editor: Editor }) => {
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
        className="rounded-md p-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-all"
        title="Typography"
      >
        <AlignJustify className="h-3.5 w-3.5" />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-[999] mt-1 flex flex-col gap-2 rounded-lg border-2 border-primary bg-card p-3 shadow-[4px_4px_0px_rgba(0,0,0,1)] w-48">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-muted-foreground uppercase">Font Family</span>
            <div className="grid grid-cols-2 gap-1">
              {FONT_FAMILIES.map(font => (
                <button
                  key={font.name}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    editor.chain().focus().setFontFamily(font.value).run();
                  }}
                  className="px-2 py-1 rounded text-[10px] bg-muted/50 hover:bg-primary/20 transition-colors truncate"
                  title={font.name}
                >
                  {font.name}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <span className="text-[10px] font-bold text-muted-foreground uppercase">Line Height</span>
            <div className="flex gap-1 overflow-x-auto pb-1">
              {LINE_HEIGHTS.map(lh => (
                <button
                  key={lh}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    editor.chain().focus().setLineHeight(lh).run();
                  }}
                  className="px-2 py-1 rounded text-[10px] bg-muted/50 hover:bg-primary/20 transition-colors"
                >
                  {lh}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <span className="text-[10px] font-bold text-muted-foreground uppercase">Letter Spacing</span>
            <div className="flex gap-1 overflow-x-auto pb-1">
              {LETTER_SPACINGS.map(ls => (
                <button
                  key={ls}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    editor.chain().focus().setLetterSpacing(ls).run();
                  }}
                  className="px-2 py-1 rounded text-[10px] bg-muted/50 hover:bg-primary/20 transition-colors whitespace-nowrap"
                >
                  {ls}
                </button>
              ))}
            </div>
          </div>

          <button
            onMouseDown={(e) => {
              e.preventDefault();
              editor.chain().focus()
                .unsetFontFamily()
                .unsetLineHeight()
                .unsetLetterSpacing()
                .run();
              setOpen(false);
            }}
            className="mt-1 w-full text-center py-1 rounded border border-dashed text-[9px] hover:bg-muted"
          >
            Reset Typography
          </button>
        </div>
      )}
    </div>
  );
};
