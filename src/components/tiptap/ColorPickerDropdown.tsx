import React, { useState, useRef, useEffect } from 'react';

const COLOR_PALETTE = [
  '#000000', '#434343', '#666666', '#999999', '#cccccc', '#ffffff',
  '#e06c75', '#d19a66', '#e5c07b', '#98c379', '#56b6c2', '#61afef',
  '#c678dd', '#be5046',
  '#ff6b6b', '#ffa94d', '#ffd43b', '#69db7c', '#38d9a9', '#4dabf7',
  '#9775fa', '#f06595',
];

export function ColorPickerDropdown({ icon, title, currentColor, onSelect }: {
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
        <div className="absolute left-0 top-full z-[500] mt-1 grid grid-cols-7 gap-1 rounded-lg border-2 border-primary bg-card p-2 shadow-[4px_4px_0px_rgba(0,0,0,1)]">
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
