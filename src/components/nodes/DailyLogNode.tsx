import { useState } from 'react';
import { type NodeProps } from '@xyflow/react';
import { BaseNode } from './BaseNode';
import { Clock, Plus, Trash2, CheckCircle2, Circle } from 'lucide-react';
import { useCanvasStore } from '@/store/canvasStore';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { DailyLogNodeData } from '@/types/canvas';

export function DailyLogNode({ id, data, selected }: NodeProps) {
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const setNodeContextMenu = useCanvasStore((s) => s.setNodeContextMenu);
  const [newEntry, setNewEntry] = useState('');
  
  const nodeData = data as unknown as DailyLogNodeData;
  const entries = nodeData.entries || [];

  const addEntry = () => {
    if (!newEntry.trim()) return;
    const entry = {
      id: crypto.randomUUID(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      text: newEntry.trim(),
      done: false,
    };
    updateNodeData(id, { entries: [...entries, entry] });
    setNewEntry('');
  };

  const toggleEntry = (entryId: string) => {
    updateNodeData(id, {
      entries: entries.map((e) => 
        e.id === entryId ? { ...e, done: !e.done } : e
      )
    });
  };

  const deleteEntry = (entryId: string) => {
    updateNodeData(id, {
      entries: entries.filter((e) => e.id !== entryId)
    });
  };

  return (
    <BaseNode
      id={id}
      title={nodeData.title || 'Daily Log'}
      icon={<Clock className="h-4 w-4" />}
      selected={selected}
      onMenuClick={(e) => setNodeContextMenu({ x: e.clientX, y: e.clientY, nodeId: id })}
      tags={nodeData.tags}
      color={nodeData.color}
    >
      <div className="flex flex-col h-full min-w-[280px]">
        {/* Entry List */}
        <div className="flex-1 overflow-y-auto max-h-[400px] p-2 space-y-2 scrollbar-none">
          {entries.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground/30 italic text-[10px] uppercase font-bold tracking-widest">
              No entries yet
            </div>
          ) : (
            <AnimatePresence initial={false}>
              {entries.map((entry) => (
                <motion.div
                  key={entry.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className={cn(
                    "group flex items-start gap-3 p-2 rounded-xl transition-all hover:bg-white/5",
                    entry.done && "opacity-50"
                  )}
                >
                  <button 
                    onClick={() => toggleEntry(entry.id)}
                    className="mt-0.5 text-primary/60 hover:text-primary transition-colors"
                  >
                    {entry.done ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
                  </button>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/40">
                        {entry.timestamp}
                      </span>
                      <button 
                        onClick={() => deleteEntry(entry.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded-md hover:bg-destructive/10 hover:text-destructive transition-all"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                    <p className={cn(
                      "text-[13px] font-medium leading-relaxed break-words",
                      entry.done && "line-through"
                    )}>
                      {entry.text}
                    </p>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>

        {/* Input Area */}
        <div className="p-3 border-t border-white/5 bg-white/5">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newEntry}
              onChange={(e) => setNewEntry(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addEntry()}
              placeholder="Add log entry..."
              className="flex-1 bg-transparent text-[13px] font-medium outline-none placeholder:text-muted-foreground/30"
            />
            <button
              onClick={addEntry}
              className="p-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-all shadow-lg shadow-primary/5 disabled:opacity-50"
              disabled={!newEntry.trim()}
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </BaseNode>
  );
}
