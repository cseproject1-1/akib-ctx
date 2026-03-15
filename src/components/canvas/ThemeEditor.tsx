import { useState, useEffect } from 'react';
import { Palette, X, Grid3X3, Droplet, Sparkles, Sliders, Check } from 'lucide-react';
import { useCanvasStore } from '@/store/canvasStore';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

const ACCENT_COLORS = [
  { name: 'Default', value: '#3b82f6' },
  { name: 'Emerald', value: '#10b981' },
  { name: 'Rose', value: '#f43f5e' },
  { name: 'Amber', value: '#f59e0b' },
  { name: 'Violet', value: '#8b5cf6' },
];

const GRID_STYLES: { label: string; value: 'dots' | 'lines' | 'cross' | 'graph' | 'blank' }[] = [
  { label: 'Dots', value: 'dots' },
  { label: 'Lines', value: 'lines' },
  { label: 'Cross', value: 'cross' },
  { label: 'Graph', value: 'graph' },
  { label: 'None', value: 'blank' },
];

export function ThemeEditor() {
  const [open, setOpen] = useState(false);
  const gridStyle = useCanvasStore((s) => s.gridStyle);
  const cycleGridStyle = useCanvasStore((s) => s.cycleGridStyle);
  
  // Local state for UI refinement - real implementation would sync to CSS variables
  const [accent, setAccent] = useState(() => localStorage.getItem('theme-accent') || '#3b82f6');
  const [glass, setGlass] = useState(() => Number(localStorage.getItem('theme-glass')) || 0.8);

  useEffect(() => {
    // Convert Hex to HSL for index.css compatibility (hsl(var(--primary)))
    const hexToHsl = (hex: string) => {
      const r = parseInt(hex.slice(1, 3), 16) / 255;
      const g = parseInt(hex.slice(3, 5), 16) / 255;
      const b = parseInt(hex.slice(5, 7), 16) / 255;
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      let h = 0, s = 0;
      const l = (max + min) / 2;
      if (max === min) h = s = 0;
      else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
          case r: h = (g - b) / d + (g < b ? 6 : 0); break;
          case g: h = (b - r) / d + 2; break;
          case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
      }
      return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
    };

    document.documentElement.style.setProperty('--primary', hexToHsl(accent));
    localStorage.setItem('theme-accent', accent);
  }, [accent]);

  useEffect(() => {
    document.documentElement.style.setProperty('--glass-opacity', String(glass));
    localStorage.setItem('theme-glass', String(glass));
  }, [glass]);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-[196px] left-6 z-[60] flex h-12 w-12 items-center justify-center rounded-xl border-2 border-border bg-card shadow-[4px_4px_0px_rgba(0,0,0,0.1)] transition-all hover:bg-accent active:scale-95"
        title="Customization"
      >
        <Palette className="h-5 w-5 text-primary" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-[196px] left-6 z-[60] w-72 rounded-xl border border-border bg-card shadow-[var(--clay-shadow-lg)] animate-brutal-pop overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-4 py-3 bg-muted/30">
        <div className="flex items-center gap-2">
          <Palette className="h-4 w-4 text-primary" />
          <span className="text-xs font-black uppercase tracking-widest">Aesthetics</span>
        </div>
        <button onClick={() => setOpen(false)} className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="p-4 space-y-6">
        {/* Accent Color */}
        <section className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            <Droplet className="h-3.5 w-3.5" />
            Primary Accent
          </div>
          <div className="flex flex-wrap gap-2">
            {ACCENT_COLORS.map((c) => (
              <button
                key={c.value}
                onClick={() => setAccent(c.value)}
                className={cn(
                  "h-8 w-8 rounded-lg border-2 border-transparent transition-all hover:scale-110 flex items-center justify-center",
                  accent === c.value && "border-white shadow-lg scale-110"
                )}
                style={{ backgroundColor: c.value }}
              >
                {accent === c.value && <Check className="h-4 w-4 text-white drop-shadow-md" />}
              </button>
            ))}
            <input 
              type="color" 
              value={accent} 
              onChange={(e) => setAccent(e.target.value)}
              className="h-8 w-8 rounded-lg bg-transparent border-2 border-dashed border-muted-foreground/30 cursor-pointer"
            />
          </div>
        </section>

        {/* Grid Setting */}
        <section className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            <Grid3X3 className="h-3.5 w-3.5" />
            Canvas Background
          </div>
          <div className="grid grid-cols-2 gap-2">
            {GRID_STYLES.map((s) => (
              <button
                key={s.value}
                onClick={cycleGridStyle} // This cycles in store, but we might want direct set
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-lg border-2 border-border bg-muted/20 text-[10px] font-bold uppercase tracking-wider transition-all hover:bg-muted/40",
                  gridStyle === s.value && "border-primary bg-primary/10 text-primary"
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
        </section>

        {/* Glassmorphism */}
        <section className="space-y-3">
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-muted-foreground">
            <div className="flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5" />
              Glass Intensity
            </div>
            <span className="text-[10px] opacity-50">{Math.round(glass * 100)}%</span>
          </div>
          <input 
            type="range" 
            min="0.1" 
            max="1" 
            step="0.05"
            value={glass} 
            onChange={(e) => setGlass(Number(e.target.value))}
            className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
          />
        </section>
      </div>

      <div className="bg-muted/50 p-3 border-t-2 border-border">
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 leading-tight">
          <Sliders className="h-3 w-3" />
          Settings applied locally and persist across sessions.
        </div>
      </div>
    </div>
  );
}
