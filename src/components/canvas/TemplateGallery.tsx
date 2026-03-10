import { useState } from 'react';
import { X, Sparkles, Search } from 'lucide-react';
import { NODE_TEMPLATES, type NodeTemplate } from '@/lib/canvas/templates';
import { useCanvasStore } from '@/store/canvasStore';
import { cn } from '@/lib/utils';

export function TemplateGallery({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [search, setSearch] = useState('');
  const addNode = useCanvasStore((s) => s.addNode);

  if (!open) return null;

  const filtered = search
    ? NODE_TEMPLATES.filter(t => 
        t.name.toLowerCase().includes(search.toLowerCase()) || 
        t.description.toLowerCase().includes(search.toLowerCase()) ||
        t.category.toLowerCase().includes(search.toLowerCase())
      )
    : NODE_TEMPLATES;

  const handleApply = (template: NodeTemplate) => {
    addNode({
      id: crypto.randomUUID(),
      type: template.type,
      position: { x: 0, y: 0 }, // addNode will reposition based on cursor
      data: { ...template.data },
      style: { 
        width: template.width || 350, 
        height: template.height || undefined,
        zIndex: 100 
      },
    });
    onClose();
  };

  return (
    <>
      <div className="fixed inset-0 z-[70] bg-background/60 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed left-1/2 top-1/2 z-[71] w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 rounded-xl border-2 border-border bg-card shadow-[var(--brutal-shadow-lg)] animate-brutal-pop flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b-2 border-border p-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-bold uppercase tracking-wider text-foreground">Template Gallery</h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b-2 border-border bg-muted/30">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search templates (e.g. meeting, project, study)..."
              className="w-full rounded-lg border-2 border-border bg-background pl-10 pr-4 py-2.5 text-sm outline-none focus:border-primary transition-all"
              autoFocus
            />
          </div>
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filtered.map((template) => (
              <button
                key={template.id}
                onClick={() => handleApply(template)}
                className="group flex flex-col gap-3 rounded-xl border-2 border-border bg-card p-4 text-left transition-all hover:border-primary hover:shadow-[4px_4px_0px_hsl(var(--primary))]"
              >
                <div className="flex items-center justify-between">
                  <div className="rounded-lg bg-primary/10 p-2 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                    <template.icon className="h-5 w-5" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-2 py-0.5 rounded-full border border-border">
                    {template.category}
                  </span>
                </div>
                <div>
                  <h3 className="font-bold text-foreground group-hover:text-primary transition-colors">{template.name}</h3>
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{template.description}</p>
                </div>
                <div className="mt-auto pt-2 flex items-center justify-between">
                  <span className="text-[10px] font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded capitalize">
                    {template.type}
                  </span>
                  <span className="text-[10px] font-bold text-primary opacity-0 group-hover:opacity-100 transition-opacity uppercase">
                    Use Template →
                  </span>
                </div>
              </button>
            ))}
          </div>
          {filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="rounded-full bg-muted p-4 mb-3">
                <Search className="h-8 w-8 text-muted-foreground/50" />
              </div>
              <p className="text-sm font-semibold text-foreground">No templates found</p>
              <p className="text-xs text-muted-foreground">Try searching for something else</p>
            </div>
          )}
        </div>

        <div className="p-4 border-t-2 border-border bg-muted/10">
          <p className="text-[10px] text-center text-muted-foreground font-medium uppercase tracking-wider">
            Tip: Templates help you bypass manual setup and get straight to work.
          </p>
        </div>
      </div>
    </>
  );
}
