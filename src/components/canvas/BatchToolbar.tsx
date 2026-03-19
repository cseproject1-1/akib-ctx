import React, { useMemo } from 'react';
import { useCanvasStore } from '@/store/canvasStore';
import { useNodes, useReactFlow } from '@xyflow/react';
import { motion, AnimatePresence } from 'framer-motion';
import { Palette, Tag, Trash2, X, Check, Copy } from 'lucide-react';
import { toast } from 'sonner';

const PRESET_COLORS = [
  '#ffffff', // Default
  '#fecaca', // Red
  '#fed7aa', // Orange
  '#fef08a', // Yellow
  '#bbf7d0', // Green
  '#bfdbfe', // Blue
  '#ddd6fe', // Purple
  '#f5d0fe', // Pink
];

export function BatchToolbar() {
  const nodes = useNodes();
  const selectedNodes = useMemo(() => nodes.filter((n) => n.selected), [nodes]);
  const hasSelection = selectedNodes.length > 1;
  
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const deleteNodes = useCanvasStore((s) => s.setNodes);
  const currentNodes = useCanvasStore((s) => s.nodes);

  if (!hasSelection) return null;

  const handleApplyColor = (color: string) => {
    selectedNodes.forEach((node) => {
      updateNodeData(node.id, { color });
    });
    toast.success(`Applied color to ${selectedNodes.length} nodes`);
  };

  const handleDeleteAll = () => {
    const selectedIds = new Set(selectedNodes.map(n => n.id));
    useCanvasStore.getState().setNodes(currentNodes.filter(n => !selectedIds.has(n.id)));
    toast.error(`Deleted ${selectedNodes.length} nodes`);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 50, opacity: 0, x: '-50%' }}
        animate={{ y: 0, opacity: 1, x: '-50%' }}
        exit={{ y: 50, opacity: 0, x: '-50%' }}
        className="fixed bottom-40 left-1/2 z-[100] flex items-center gap-2 rounded-2xl border border-primary bg-card dark:bg-zinc-900 p-2 shadow-[var(--clay-shadow-sm)]"
      >
        <div className="flex items-center gap-2 px-3 border-r-2 border-border mr-2">
          <div className="flex -space-x-2">
            {selectedNodes.slice(0, 3).map((n, i) => (
              <div 
                key={n.id} 
                className="w-6 h-6 rounded-lg border-2 border-card bg-primary/20 flex items-center justify-center text-[10px] font-black"
                style={{ zIndex: 3 - i }}
              >
                {(n.data as any).emoji || '📄'}
              </div>
            ))}
          </div>
          <span className="text-[10px] font-black uppercase tracking-widest text-primary">
            {selectedNodes.length} SELECTED
          </span>
        </div>

        {/* Color Palette */}
        <div className="flex items-center gap-2 px-2">
          {PRESET_COLORS.map((color) => (
            <button
              key={color}
              onClick={() => handleApplyColor(color)}
              className="w-6 h-6 rounded-md border-2 border-border transition-transform hover:scale-110 active:scale-95"
              style={{ backgroundColor: color }}
            />
          ))}
        </div>

        <div className="w-[2px] h-6 bg-border mx-1" />

        {/* Actions */}
        <div className="flex items-center gap-1">
          <button 
            onClick={handleDeleteAll}
            className="p-2 rounded-xl hover:bg-destructive/10 text-destructive transition-colors group"
            title="Delete Selected"
          >
            <Trash2 className="h-4 w-4 group-hover:scale-110 transition-transform" />
          </button>
          
          <button 
            onClick={() => {
              const ids = selectedNodes.map(n => n.id);
              // Implementation for batch tagging could go here
              toast.info("Batch tagging coming soon");
            }}
            className="p-2 rounded-xl hover:bg-primary/10 text-primary transition-colors group"
            title="Batch Tag"
          >
            <Tag className="h-4 w-4 group-hover:rotate-12 transition-transform" />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
