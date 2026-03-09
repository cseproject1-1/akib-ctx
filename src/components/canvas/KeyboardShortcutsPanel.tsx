import { useEffect, useState } from 'react';
import { X, Keyboard, Search } from 'lucide-react';

const shortcuts = [
  { category: 'General', items: [
    { keys: ['⌘', 'Z'], label: 'Undo' },
    { keys: ['⌘', '⇧', 'Z'], label: 'Redo' },
    { keys: ['⌘', 'C'], label: 'Copy nodes' },
    { keys: ['⌘', 'V'], label: 'Paste' },
    { keys: ['⌘', 'A'], label: 'Select all' },
    { keys: ['Del'], label: 'Delete selected' },
    { keys: ['Esc'], label: 'Close menus / exit drawing' },
  ]},
  { category: 'Canvas', items: [
    { keys: ['⌘', '⇧', 'H'], label: 'Fit view' },
    { keys: ['⌘', '0'], label: 'Reset zoom' },
    { keys: ['M'], label: 'Toggle minimap' },
    { keys: ['⌘', 'K'], label: 'Search palette' },
    { keys: ['?'], label: 'Keyboard shortcuts' },
  ]},
  { category: 'Tools', items: [
    { keys: ['D'], label: 'Toggle drawing mode' },
    { keys: ['S'], label: 'Toggle snap to grid' },
    { keys: ['G'], label: 'Cycle grid style' },
    { keys: ['L'], label: 'Lock / unlock all nodes' },
    { keys: ['F'], label: 'Toggle focus mode' },
    { keys: ['P'], label: 'Start presentation' },
  ]},
  { category: 'Editor', items: [
    { keys: ['/'], label: 'Slash commands (in note)' },
    { keys: ['⌘', 'B'], label: 'Bold' },
    { keys: ['⌘', 'I'], label: 'Italic' },
    { keys: ['⌘', 'E'], label: 'Code' },
    { keys: ['⌘', '⇧', 'X'], label: 'Strikethrough' },
  ]},
];

export function KeyboardShortcutsPanel() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('.tiptap-wrapper') || target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
      if (e.key === '?' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === 'Escape' && open) setOpen(false);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open]);

  if (!open) return null;

  const filteredShortcuts = search
    ? shortcuts.map((g) => ({
        ...g,
        items: g.items.filter((i) => i.label.toLowerCase().includes(search.toLowerCase()) || i.keys.join('').toLowerCase().includes(search.toLowerCase())),
      })).filter((g) => g.items.length > 0)
    : shortcuts;

  return (
    <>
      <div className="fixed inset-0 z-[70] bg-background/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
      <div className="fixed left-1/2 top-1/2 z-[71] w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border-2 border-border bg-card p-6 shadow-[6px_6px_0px_hsl(0,0%,10%)] animate-brutal-pop">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Keyboard className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-bold uppercase tracking-wider text-foreground">Keyboard Shortcuts</h2>
          </div>
          <button onClick={() => setOpen(false)} className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter shortcuts…"
            className="w-full rounded-lg border-2 border-border bg-background pl-9 pr-3 py-2 text-sm text-foreground outline-none focus:border-primary"
            autoFocus
          />
        </div>

        <div className="space-y-4 max-h-[55vh] overflow-y-auto">
          {filteredShortcuts.map((group) => (
            <div key={group.category}>
              <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">{group.category}</h3>
              <div className="space-y-1">
                {group.items.map((item) => (
                  <div key={item.label} className="flex items-center justify-between py-1.5">
                    <span className="text-sm text-foreground">{item.label}</span>
                    <div className="flex items-center gap-1">
                      {item.keys.map((k, i) => (
                        <kbd key={i} className="rounded border-2 border-border bg-muted px-1.5 py-0.5 text-xs font-mono text-muted-foreground">
                          {k}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {filteredShortcuts.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-4">No shortcuts found</p>
          )}
        </div>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Press <kbd className="rounded border border-border px-1 py-0.5 text-xs font-mono">?</kbd> to toggle
        </p>
      </div>
    </>
  );
}
