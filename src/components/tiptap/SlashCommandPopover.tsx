import { useState, useRef, useEffect, useCallback } from 'react';
import { X } from 'lucide-react';

interface FieldConfig {
  key: string;
  label: string;
  placeholder: string;
  type?: 'text' | 'number' | 'url';
  defaultValue?: string;
}

interface SlashCommandPopoverProps {
  title: string;
  fields: FieldConfig[];
  onSubmit: (values: Record<string, string>) => void;
  onCancel: () => void;
  position?: { top: number; left: number };
}

export function SlashCommandPopover({ title, fields, onSubmit, onCancel, position }: SlashCommandPopoverProps) {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    fields.forEach((f) => { initial[f.key] = f.defaultValue || ''; });
    return initial;
  });
  const firstRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    firstRef.current?.focus();
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onCancel();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onCancel]);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(values);
  }, [values, onSubmit]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    e.stopPropagation();
    if (e.key === 'Escape') onCancel();
  };

  return (
    <div
      ref={containerRef}
      className="absolute z-[999] w-64 rounded-lg border border-border bg-popover p-3 shadow-[var(--clay-shadow-sm)] animate-brutal-pop"
      style={position ? { top: position.top, left: position.left } : { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}
      onKeyDown={handleKeyDown}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold text-foreground">{title}</span>
        <button onClick={onCancel} className="rounded p-0.5 text-muted-foreground hover:text-foreground">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        {fields.map((field, i) => (
          <div key={field.key}>
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{field.label}</label>
            <input
              ref={i === 0 ? firstRef : undefined}
              type={field.type || 'text'}
              value={values[field.key]}
              onChange={(e) => setValues((v) => ({ ...v, [field.key]: e.target.value }))}
              placeholder={field.placeholder}
              className="mt-0.5 h-7 w-full rounded border border-border bg-background px-2 text-xs text-foreground outline-none focus:border-primary"
            />
          </div>
        ))}
        <button
          type="submit"
          className="mt-1 h-7 w-full rounded-md bg-primary text-xs font-bold text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Insert
        </button>
      </form>
    </div>
  );
}
