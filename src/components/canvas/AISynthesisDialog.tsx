import React, { useState } from 'react';
import { Sparkles, X, Brain, Send, Copy, FilePlus } from 'lucide-react';
import { useCanvasStore } from '@/store/canvasStore';
import { askAIAboutNodes, extractNodeText } from '@/lib/aiService';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useReactFlow } from '@xyflow/react';

interface AISynthesisDialogProps {
  selectedNodes: any[];
  onClose: () => void;
}

export function AISynthesisDialog({ selectedNodes, onClose }: AISynthesisDialogProps) {
  const [prompt, setPrompt] = useState('Summarize these nodes and link the main ideas.');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);
  const addNode = useCanvasStore((s) => s.addNode);
  const { getViewport } = useReactFlow();

  const handleAsk = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    try {
      const context = selectedNodes.map(n => ({
        id: n.id,
        type: n.type || 'note',
        title: (n.data as any).title || 'Untitled',
        content: extractNodeText(n)
      }));

      const reply = await askAIAboutNodes(context, prompt);
      setResponse(reply);
      toast.success('AI response generated!');
    } catch (err: any) {
      toast.error(err.message || 'AI request failed');
    } finally {
      setLoading(false);
    }
  };

  const handlePasteToCanvas = () => {
    if (!response) return;
    const vp = getViewport();
    // Position it center-ish of the view
    const pos = {
      x: -vp.x / vp.zoom + 100,
      y: -vp.y / vp.zoom + 100
    };
    
    addNode({ 
      id: crypto.randomUUID(),
      type: 'aiNote',
      position: pos,
      data: {
        title: 'AI Synthesis Result',
        pasteContent: response,
        pasteFormat: 'markdown'
      }
    });
    toast.success('Synthesis node created on canvas!');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-background/80 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-2xl rounded-2xl border-2 border-border bg-card shadow-[10px_10px_0px_hsl(var(--primary-foreground))] flex flex-col max-h-[85vh] overflow-hidden animate-brutal-pop">
        {/* Header */}
        <div className="flex items-center justify-between border-b-2 border-border p-5 bg-primary/5">
          <div className="flex items-center gap-3">
             <div className="rounded-xl bg-primary/10 p-2 shadow-inner">
               <Sparkles className="h-5 w-5 text-primary" />
             </div>
             <div>
               <h2 className="text-sm font-black uppercase tracking-widest text-foreground">Synthesis Assistant</h2>
               <p className="text-[10px] font-bold text-muted-foreground uppercase">{selectedNodes.length} nodes in context</p>
             </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Prompt Input */}
        <div className="p-5 border-b-2 border-border">
          <div className="flex gap-2">
            <textarea
              className="flex-1 min-h-[60px] max-h-[120px] rounded-xl border-2 border-border bg-muted/30 p-3 text-sm font-bold text-foreground outline-none focus:border-primary transition-all resize-none shadow-inner"
              placeholder="What should AI do with these nodes?"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                 if (e.key === 'Enter' && e.ctrlKey) { e.preventDefault(); handleAsk(); }
              }}
            />
            <button
               onClick={handleAsk}
               disabled={loading || !prompt.trim()}
               className="group flex flex-col items-center justify-center gap-1 rounded-xl bg-primary px-6 text-primary-foreground transition-all hover:scale-[1.02] active:scale-95 disabled:grayscale disabled:opacity-50 shadow-[4px_4px_0px_hsl(var(--primary)/0.3)]"
            >
              <Send className={cn("h-5 w-5", loading && "animate-pulse")} />
              <span className="text-[10px] font-black uppercase tracking-tighter">Run (Ctrl+↵)</span>
            </button>
          </div>
        </div>

        {/* Results Area */}
        <div className="flex-1 overflow-y-auto p-5 scrollbar-hide bg-muted/10">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="relative mb-6">
                <Brain className="h-12 w-12 text-primary animate-pulse" />
                <div className="absolute inset-0 h-12 w-12 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              </div>
              <p className="text-xs font-black uppercase tracking-widest text-foreground">AI is thinking...</p>
              <p className="text-[10px] text-muted-foreground mt-1">Analyzing content and synthesizing relationships</p>
            </div>
          ) : response ? (
            <div className="space-y-4 animate-scale-in">
              <div className="rounded-xl border-2 border-border bg-card p-4 shadow-sm prose prose-sm prose-invert max-w-none font-medium leading-relaxed">
                {response.split('\n').map((line, i) => (
                  <p key={i} className="mb-1">{line}</p>
                ))}
              </div>
              
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/50">
                 <button 
                  onClick={() => { navigator.clipboard.writeText(response); toast.success('Copied to clipboard'); }}
                  className="flex items-center gap-2 rounded-lg border-2 border-border bg-card px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground transition-all hover:bg-accent hover:text-foreground"
                 >
                   <Copy className="h-3.5 w-3.5" /> Copy Text
                 </button>

                 <button 
                  onClick={handlePasteToCanvas}
                  className="flex items-center gap-2 rounded-lg border-2 border-border bg-primary px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-primary-foreground transition-all hover:translate-y-[-2px] shadow-[3px_3px_0px_hsl(var(--primary)/0.2)]"
                 >
                   <FilePlus className="h-3.5 w-3.5" /> Create Note on Canvas
                 </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center opacity-40 grayscale">
               <Sparkles className="h-10 w-10 mb-3" />
               <p className="text-[10px] font-black uppercase tracking-widest">Synthesis results will appear here</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
