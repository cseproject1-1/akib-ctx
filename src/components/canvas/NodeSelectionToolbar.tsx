import { useCallback, useMemo } from 'react';
import { useReactFlow, useViewport, useNodes } from '@xyflow/react';
import { useCanvasStore } from '@/store/canvasStore';
import { Copy, Trash2, Star, Lock, Unlock, Palette, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

const colorOptions = [
  { name: 'default', css: 'bg-zinc-500' },
  { name: 'blue', css: 'bg-blue-500' },
  { name: 'green', css: 'bg-emerald-500' },
  { name: 'red', css: 'bg-rose-500' },
  { name: 'purple', css: 'bg-violet-500' },
  { name: 'yellow', css: 'bg-amber-500' },
];

export function NodeSelectionToolbar() {
  const nodes = useNodes();
  const duplicateNode = useCanvasStore((s) => s.duplicateNode);
  const deleteNode = useCanvasStore((s) => s.deleteNode);
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const expandedNode = useCanvasStore((s) => s.expandedNode);
  const isAISynthesisOpen = useCanvasStore((s) => s.isAISynthesisOpen);
  const { flowToScreenPosition, getZoom } = useReactFlow();

  const selectedNodes = useMemo(() => nodes.filter((n) => n.selected), [nodes]);

  const handlePin = useCallback(() => {
    selectedNodes.forEach((n) => {
      const isPinned = (n.data as { pinned?: boolean })?.pinned;
      updateNodeData(n.id, { pinned: !isPinned });
    });
    toast.success('Pin toggled');
  }, [selectedNodes, updateNodeData]);

  const handleLock = useCallback(() => {
    selectedNodes.forEach((n) => {
      const isLocked = (n.data as { locked?: boolean })?.locked;
      updateNodeData(n.id, { locked: !isLocked });
    });
    toast.success('Lock toggled');
  }, [selectedNodes, updateNodeData]);

  const handleColor = useCallback((color: string) => {
    selectedNodes.forEach((n) => updateNodeData(n.id, { color }));
  }, [selectedNodes, updateNodeData]);

  if (selectedNodes.length !== 1 || expandedNode || isAISynthesisOpen) return null;

  const node = selectedNodes[0];
  const isLocked = (node.data as { locked?: boolean })?.locked;
  const isPinned = (node.data as { pinned?: boolean })?.pinned;

  const nodeWidth = (node.measured?.width ?? node.width ?? 200) as number;
  const nodeHeight = (node.measured?.height ?? node.height ?? 100) as number;
  const zoom = getZoom();

  const rawPos = flowToScreenPosition({
    x: node.position.x + nodeWidth / 2,
    y: node.position.y,
  });

  const SAFE_TOP = 100;
  const SAFE_SIDE = 150;
  
  // Decide position: prefers top, flips to bottom if not enough space
  // We need at least ~70px of space above the node to show the toolbar without overlap
  const showAtBottom = rawPos.y < SAFE_TOP + 70;

  const topPos = showAtBottom 
    ? rawPos.y + (nodeHeight * zoom) + 15
    : rawPos.y - 65;

  const leftPos = Math.max(Math.min(rawPos.x, window.innerWidth - SAFE_SIDE), SAFE_SIDE);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, x: '-50%' }}
      animate={{ opacity: 1, y: 0, x: '-50%' }}
      exit={{ opacity: 0, y: 10, x: '-50%' }}
      style={{
        position: 'fixed',
        left: leftPos,
        top: topPos,
        zIndex: 1000,
      }}
      className="pointer-events-auto"
    >
      <div className="flex items-center gap-1 rounded-2xl glass-morphism-strong p-1.5 pro-shadow">
        <TBtn onClick={handlePin} title={isPinned ? 'Unpin' : 'Pin'}>
          <Star className={cn("h-4 w-4 transition-all", isPinned ? 'fill-primary text-primary' : 'text-muted-foreground')} />
        </TBtn>
        
        <TBtn onClick={handleLock} title={isLocked ? 'Unlock' : 'Lock'}>
          {isLocked ? (
            <Lock className="h-4 w-4 text-red-500 fill-red-500/10" />
          ) : (
            <Unlock className="h-4 w-4 text-muted-foreground" />
          )}
        </TBtn>

        <TBtn onClick={() => duplicateNode(node.id)} title="Duplicate">
          <Copy className="h-4 w-4 text-muted-foreground" />
        </TBtn>

        <div className="mx-1 h-6 w-px bg-white/5" />

        <div className="flex items-center gap-1.5 px-2">
          {colorOptions.map((c) => (
            <button
              key={c.name}
              className={cn(
                "h-5 w-5 rounded-full ring-offset-2 ring-offset-background transition-all hover:scale-125 focus:ring-2 active:scale-95",
                c.css,
                (node.data as any)?.color === c.name ? "ring-2 ring-primary" : "ring-transparent"
              )}
              onClick={() => handleColor(c.name)}
              title={c.name}
            />
          ))}
        </div>

        <div className="mx-1 h-6 w-px bg-white/5" />

        <TBtn onClick={() => deleteNode(node.id)} title="Delete" className="hover:bg-red-500/10 hover:text-red-500">
          <Trash2 className="h-4 w-4" />
        </TBtn>
      </div>
    </motion.div>
  );
}

function TBtn({ children, onClick, title, className }: { children: React.ReactNode; onClick: () => void; title: string; className?: string }) {
  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      title={title}
      className={cn(
        "flex h-9 w-9 items-center justify-center rounded-xl transition-all hover:bg-white/5 active:bg-white/10",
        className
      )}
    >
      {children}
    </motion.button>
  );
}
