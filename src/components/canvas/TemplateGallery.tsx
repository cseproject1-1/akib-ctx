import { useState } from 'react';
import { X, Sparkles, Search, Loader2, Wand2 } from 'lucide-react';
import { NODE_TEMPLATES, type NodeTemplate } from '@/lib/canvas/templates';
import { useCanvasStore } from '@/store/canvasStore';
import { generateCanvasFromPrompt } from '@/lib/aiService';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export function TemplateGallery({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [search, setSearch] = useState('');
  const [magicPrompt, setMagicPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const addNode = useCanvasStore((s) => s.addNode);
  const addNodesAndEdges = useCanvasStore((s) => s.addNodesAndEdges);

  if (!open) return null;

  const handleMagicGenerate = async () => {
    if (!magicPrompt.trim()) return;
    setIsGenerating(true);
    try {
      const { nodes, edges } = await generateCanvasFromPrompt(magicPrompt);
      if (!nodes || nodes.length === 0) {
        throw new Error('AI produced an empty map');
      }
      
      addNodesAndEdges(nodes, edges);
      toast.success(`Generated ${nodes.length} nodes for your plan!`);
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Magic generation failed');
    } finally {
      setIsGenerating(false);
    }
  };

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
        <div className="flex items-center justify-between border-b-2 border-border p-4 bg-primary px-6 py-4">
          <div className="flex items-center gap-3">
            <Sparkles className="h-6 w-6 text-primary-foreground fill-current animate-pulse" />
            <h2 className="text-xl font-black uppercase tracking-tighter text-primary-foreground italic">Nexus Magic Gallery</h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-primary-foreground hover:bg-white/20 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Magic Generator */}
        <div className="p-6 border-b-2 border-border bg-muted/50 relative overflow-hidden group">
          <div className="absolute top-0 right-0 -mt-8 -mr-8 h-32 w-32 bg-primary/5 rounded-full blur-3xl group-hover:bg-primary/10 transition-colors" />
          <div className="relative z-10">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-primary mb-3 block italic">
              AI Manifestation Engine
            </label>
            <div className="flex gap-2 p-1 rounded-2xl border-2 border-primary bg-background shadow-[4px_4px_0px_hsl(var(--primary))] transition-shadow hover:shadow-[6px_6px_0px_hsl(var(--primary))]">
              <input 
                value={magicPrompt}
                onChange={(e) => setMagicPrompt(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleMagicGenerate()}
                placeholder="Type anything (e.g. 'Project launch plan', 'Learn React roadmap')..."
                className="flex-1 bg-transparent px-4 py-3 text-sm font-bold placeholder:text-muted-foreground outline-none"
                disabled={isGenerating}
              />
              <button
                onClick={handleMagicGenerate}
                disabled={isGenerating || !magicPrompt.trim()}
                className="flex items-center gap-2 rounded-xl bg-primary px-6 py-2 text-sm font-black text-primary-foreground transition-all active:scale-95 disabled:opacity-50"
              >
                {isGenerating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Wand2 className="h-4 w-4" />
                )}
                <span>GENERATE</span>
              </button>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="px-6 py-4 border-b-2 border-border bg-background">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search static templates..."
              className="w-full rounded-xl border-2 border-border bg-muted/20 pl-12 pr-4 py-2 text-xs font-bold uppercase tracking-wider outline-none focus:border-primary transition-all"
            />
          </div>
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filtered.map((template) => (
              <button
                key={template.id}
                onClick={() => handleApply(template)}
                className="group flex flex-col gap-4 rounded-2xl border-2 border-border bg-card p-5 text-left transition-all hover:border-primary hover:shadow-[4px_4px_0px_hsl(var(--primary))] hover:-translate-y-1"
              >
                <div className="flex items-center justify-between">
                  <div className="rounded-xl bg-primary/10 p-2.5 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-all shadow-inner">
                    <template.icon className="h-6 w-6" />
                  </div>
                  <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground px-2.5 py-1 rounded-full border-2 border-border bg-muted/30">
                    {template.category}
                  </span>
                </div>
                <div>
                  <h3 className="font-black text-foreground group-hover:text-primary transition-colors uppercase tracking-tight leading-none mb-1.5">{template.name}</h3>
                  <p className="text-[11px] font-medium text-muted-foreground line-clamp-2 leading-relaxed">{template.description}</p>
                </div>
                <div className="mt-auto pt-3 flex items-center justify-between border-t-2 border-border/10">
                  <span className="text-[9px] font-black text-muted-foreground bg-muted/50 px-2 py-1 rounded uppercase tracking-tighter">
                    {template.type}
                  </span>
                  <span className="text-[10px] font-black text-primary opacity-0 group-hover:opacity-100 transition-all uppercase tracking-tighter flex items-center gap-1">
                    USE TEMPLATE <Wand2 className="h-3 w-3" />
                  </span>
                </div>
              </button>
            ))}
          </div>
          {filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="rounded-full bg-muted p-6 mb-4 border-2 border-border border-dashed">
                <Search className="h-10 w-10 text-muted-foreground/30" />
              </div>
              <p className="text-lg font-black text-foreground uppercase tracking-tight">No Results Found</p>
              <p className="text-xs font-medium text-muted-foreground mt-1">Try the Magic Generator above for custom layouts!</p>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t-2 border-border bg-muted/30">
          <p className="text-[9px] text-center text-muted-foreground font-black uppercase tracking-[0.15em] opacity-60">
            Nexus AI automatically handles arrangement and iconography during generation.
          </p>
        </div>
      </div>
    </>
  );
}
