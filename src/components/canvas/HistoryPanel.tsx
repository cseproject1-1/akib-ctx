import React, { useState } from 'react';
import { useCanvasStore } from '@/store/canvasStore';
import { motion, AnimatePresence } from 'framer-motion';
import { History, X, RotateCcw, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export function HistoryPanel() {
  const past = useCanvasStore((s) => s.past);
  const setNodes = useCanvasStore((s) => s.setNodes);
  const setEdges = useCanvasStore((s) => s.setEdges);
  const pushSnapshot = useCanvasStore((s) => s.pushSnapshot);
  
  const [isOpen, setIsOpen] = useState(false);

  const handleRevert = (index: number) => {
    const snapshot = past[index];
    if (!snapshot) return;

    pushSnapshot('Revert to historical state');
    setNodes(snapshot.nodes);
    setEdges(snapshot.edges);
    setIsOpen(false);
  };

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, x: 300 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 300 }}
            className="fixed right-4 top-20 bottom-24 w-80 z-[1000] flex flex-col rounded-xl border-2 border-border bg-card shadow-[var(--brutal-shadow-lg)] overflow-hidden"
          >
            <div className="flex items-center justify-between border-b-2 border-border p-4 bg-primary/5">
              <div className="flex items-center gap-2">
                <History className="h-5 w-5 text-primary" />
                <h3 className="text-sm font-black uppercase tracking-widest text-foreground">Action History</h3>
              </div>
              <button onClick={() => setIsOpen(false)} className="rounded-md p-1 hover:bg-accent hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2 scrollbar-none">
              {past.length === 0 ? (
                <div className="py-20 text-center">
                  <Clock className="h-10 w-10 text-muted-foreground mx-auto mb-2 opacity-20" />
                  <p className="text-xs font-bold text-muted-foreground uppercase opacity-50 italic">No history yet</p>
                </div>
              ) : (
                [...past].reverse().map((snapshot, i) => {
                  const actualIdx = past.length - 1 - i;
                  return (
                    <div 
                      key={snapshot.timestamp + actualIdx} 
                      className="group relative rounded-lg border-2 border-transparent p-3 hover:border-border hover:bg-accent transition-all cursor-pointer"
                      onClick={() => handleRevert(actualIdx)}
                    >
                      <div className="flex flex-col gap-1">
                        <span className="text-xs font-black uppercase tracking-tight text-foreground truncate">{snapshot.label}</span>
                        <div className="flex items-center justify-between">
                           <span className="text-[10px] font-bold text-muted-foreground">{formatDistanceToNow(snapshot.timestamp, { addSuffix: true })}</span>
                           <span className="text-[9px] font-bold text-primary opacity-0 group-hover:opacity-100 uppercase tracking-tighter flex items-center gap-1">
                             <RotateCcw className="h-2.5 w-2.5" /> Revert
                           </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="border-t-2 border-border p-3 bg-muted/30 text-center">
              <p className="text-[9px] font-bold text-muted-foreground uppercase">Showing last 50 actions</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <HistoryTrigger onToggle={() => setIsOpen(!isOpen)} />
    </>
  );
}

let toggleHistoryPanel: () => void = () => {};
export const openHistory = () => toggleHistoryPanel();

function HistoryTrigger({ onToggle }: { onToggle: () => void }) {
  toggleHistoryPanel = onToggle;
  return null;
}
