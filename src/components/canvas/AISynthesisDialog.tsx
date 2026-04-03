import React, { useState } from 'react';
import { Sparkles, X, Brain, Send, Copy, FilePlus } from 'lucide-react';
import { useCanvasStore } from '@/store/canvasStore';
import { askAIAboutNodes, extractNodeText } from '@/lib/aiService';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useReactFlow } from '@xyflow/react';
import { motion, AnimatePresence } from 'framer-motion';

import { autoFormatText } from '@/lib/codeDetection';

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
      // Automatically detect and format code in the reply
      setResponse(autoFormatText(reply));
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
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-synthesis flex items-center justify-center p-4 bg-background/40 backdrop-blur-xl"
    >
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="w-full max-w-2xl rounded-[32px] glass-effect pro-shadow flex flex-col max-h-[85vh] overflow-hidden border border-white/10"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/5 p-6 bg-white/5">
          <div className="flex items-center gap-4">
             <div className="rounded-2xl bg-primary/10 p-2.5 shadow-inner">
               <Sparkles className="h-6 w-6 text-primary" />
             </div>
             <div>
               <h2 className="text-sm font-bold tracking-tight text-foreground uppercase">Synthesis Assistant</h2>
               <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest">{selectedNodes.length} nodes in context</p>
             </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6 border-b border-white/5 bg-white/5">
          <div className="flex gap-3">
            <textarea
              className="flex-1 min-h-[70px] max-h-[140px] rounded-2xl bg-white/5 border border-white/10 p-4 text-[13px] font-medium text-foreground outline-none focus:border-primary/40 focus:ring-4 focus:ring-primary/10 transition-all resize-none placeholder:text-muted-foreground/40"
              placeholder="What should AI do with these nodes?"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                 if (e.key === 'Enter' && e.ctrlKey) { e.preventDefault(); handleAsk(); }
              }}
            />
            <motion.button
               whileHover={{ scale: 1.05 }}
               whileTap={{ scale: 0.95 }}
               onClick={handleAsk}
               disabled={loading || !prompt.trim()}
               className="group flex flex-col items-center justify-center gap-1.5 rounded-2xl bg-primary px-7 text-primary-foreground shadow-lg shadow-primary/20 transition-all disabled:opacity-50"
            >
              <Send className={cn("h-5 w-5", loading && "animate-pulse")} />
              <span className="text-[9px] font-bold uppercase tracking-widest">RUN</span>
            </motion.button>
          </div>
        </div>

        {/* Results Area */}
        <div className="flex-1 overflow-y-auto p-5 scrollbar-hide bg-muted/10">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="relative mb-6">
                <motion.div 
                  animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="absolute inset-0 bg-primary/20 blur-2xl rounded-full"
                />
                <Brain className="h-16 w-16 text-primary relative z-10" />
              </div>
              <p className="text-sm font-bold tracking-tight text-foreground uppercase">AI is synthesizing...</p>
              <p className="text-[11px] text-muted-foreground mt-2 font-medium">Extracting key concepts and building connections</p>
            </div>
          ) : response ? (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <div className="rounded-[24px] border border-white/5 bg-white/5 p-6 shadow-inner prose prose-sm prose-invert max-w-none font-medium leading-relaxed text-foreground/90">
                <div className="whitespace-pre-wrap">
                  {response}
                </div>
              </div>
              
              <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-white/5">
                 <motion.button 
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => { navigator.clipboard.writeText(response).then(() => toast.success('Copied to clipboard')).catch(() => toast.error('Failed to copy')); }}
                  className="flex items-center gap-2 rounded-xl bg-white/5 px-4 py-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground transition-all hover:bg-white/10 hover:text-foreground"
                 >
                   <Copy className="h-4 w-4" /> Copy Text
                 </motion.button>

                 <motion.button 
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handlePasteToCanvas}
                  className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-[11px] font-bold uppercase tracking-widest text-primary-foreground shadow-lg shadow-primary/20"
                 >
                   <FilePlus className="h-4 w-4" /> Create Node
                 </motion.button>
              </div>
            </motion.div>
          ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center opacity-40 grayscale">
             <Sparkles className="h-12 w-12 mb-4" />
             <p className="text-[11px] font-bold uppercase tracking-widest">Synthesis results will appear here</p>
          </div>
        )}
        </div>
      </motion.div>
    </motion.div>
  );
}
