import React, { useState } from 'react';
import { Search, Keyboard, X, Command } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

const SHORTCUTS = [
  { group: 'General', shortcuts: [
    { keys: ['⌘', 'K'], desc: 'Search nodes' },
    { keys: ['⌘', '/'], desc: 'Slash commands' },
    { keys: ['Esc'], desc: 'Close/Deselect' },
    { keys: ['⌘', 'Z'], desc: 'Undo' },
    { keys: ['⌘', '⇧', 'Z'], desc: 'Redo' },
  ]},
  { group: 'Editor', shortcuts: [
    { keys: ['⌘', 'B'], desc: 'Bold' },
    { keys: ['⌘', 'I'], desc: 'Italic' },
    { keys: ['Tab'], desc: 'Indent List' },
    { keys: ['⇧', 'Tab'], desc: 'Outdent List' },
    { keys: ['Alt', '↑'], desc: 'Expand Selection' },
  ]},
  { group: 'Canvas', shortcuts: [
    { keys: ['V'], desc: 'View Mode' },
    { keys: ['E'], desc: 'Edit Mode' },
    { keys: ['S'], desc: 'Toggle Snap' },
    { keys: ['G'], desc: 'Cycle Grid' },
    { keys: ['F11'], desc: 'Full Screen' },
  ]},
];

export const ShortcutsDialog = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
  const [query, setQuery] = useState('');

  const filtered = SHORTCUTS.map(g => ({
    ...g,
    shortcuts: g.shortcuts.filter(s => 
      s.desc.toLowerCase().includes(query.toLowerCase()) || 
      s.keys.join(' ').toLowerCase().includes(query.toLowerCase())
    )
  })).filter(g => g.shortcuts.length > 0);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg glass-morphism-strong border-white/10 p-0 overflow-hidden rounded-3xl">
        <DialogHeader className="p-6 pb-2">
          <DialogTitle className="flex items-center gap-3 text-xl font-black uppercase tracking-widest text-foreground">
            <Keyboard className="h-6 w-6 text-primary" />
            Command Center
          </DialogTitle>
          <div className="relative mt-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40" />
            <Input 
              placeholder="Search shortcuts..." 
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-10 h-10 bg-white/5 border-white/5 rounded-xl focus-visible:ring-primary/40 focus-visible:ring-offset-0"
            />
          </div>
        </DialogHeader>

        <div className="max-h-[400px] overflow-y-auto p-6 pt-2 scrollbar-hide space-y-6">
          {filtered.map(group => (
            <div key={group.group} className="space-y-3">
              <h3 className="text-[10px] font-black uppercase tracking-[3px] text-primary/40">{group.group}</h3>
              <div className="space-y-1.5">
                {group.shortcuts.map((s, i) => (
                  <div key={i} className="flex items-center justify-between p-2 rounded-xl hover:bg-white/5 transition-colors group">
                    <span className="text-[11px] font-bold text-muted-foreground group-hover:text-foreground transition-colors">{s.desc}</span>
                    <div className="flex gap-1">
                      {s.keys.map((k, j) => (
                        <kbd key={j} className="h-6 min-w-[24px] px-1.5 flex items-center justify-center rounded-md bg-white/10 border border-white/10 text-[10px] font-black text-foreground/80 shadow-[0_2px_0_rgba(0,0,0,0.2)]">
                          {k}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="py-12 text-center text-muted-foreground/20 italic text-[10px] font-bold uppercase tracking-widest">
              No matching shortcuts
            </div>
          )}
        </div>

        <div className="p-4 bg-primary/5 border-t border-white/5 flex items-center justify-between">
            <p className="text-[9px] font-bold text-primary/60 uppercase tracking-widest">Custom remapping coming soon</p>
            <button className="text-[9px] font-black uppercase tracking-widest text-foreground/40 hover:text-primary transition-colors">Reset all</button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
