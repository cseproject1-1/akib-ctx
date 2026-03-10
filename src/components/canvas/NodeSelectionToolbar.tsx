import { useCallback, useMemo } from 'react';
import { useReactFlow, useViewport, useNodes } from '@xyflow/react';
import { useCanvasStore } from '@/store/canvasStore';
import { Copy, Trash2, Star, Lock, Unlock, Palette } from 'lucide-react';
import { toast } from 'sonner';

const colorOptions = [
  { name: 'default', css: 'hsl(0 0% 40%)' },
  { name: 'blue', css: 'hsl(217, 91%, 60%)' },
  { name: 'green', css: 'hsl(142, 76%, 46%)' },
  { name: 'red', css: 'hsl(0, 84%, 60%)' },
  { name: 'purple', css: 'hsl(262, 83%, 58%)' },
  { name: 'yellow', css: 'hsl(52, 100%, 50%)' },
];

export function NodeSelectionToolbar() {
  const nodes = useNodes();
  const duplicateNode = useCanvasStore((s) => s.duplicateNode);
  const deleteNode = useCanvasStore((s) => s.deleteNode);
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const { flowToScreenPosition } = useReactFlow();
  const viewport = useViewport();

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

  if (selectedNodes.length !== 1) return null;

  const node = selectedNodes[0];
  const isLocked = (node.data as { locked?: boolean })?.locked;
  const isPinned = (node.data as { pinned?: boolean })?.pinned;

  const nodeWidth = (node.measured?.width ?? node.width ?? 200) as number;

  const rawPos = flowToScreenPosition({
    x: node.position.x + nodeWidth / 2,
    y: node.position.y,
  });

  const SAFE_TOP = 70; // Header clearance
  const SAFE_SIDE = 120;
  
  const topPos = Math.max(rawPos.y - 52, SAFE_TOP);
  const leftPos = Math.max(Math.min(rawPos.x, window.innerWidth - SAFE_SIDE), SAFE_SIDE);

  // Position toolbar centered above the node, high z-index to never overlap
  const toolbarStyle: React.CSSProperties = {
    position: 'fixed',
    left: leftPos,
    top: topPos,
    transform: 'translateX(-50%)',
    zIndex: 1000,
  };

  return (
    <div style={toolbarStyle} className="animate-slide-up">
      <div className="flex items-center gap-0.5 rounded-lg border-2 border-border bg-card px-1 py-1 shadow-[4px_4px_0px_hsl(0,0%,15%)] backdrop-blur-sm">
        <TBtn onClick={handlePin} title={isPinned ? 'Unpin' : 'Pin'}>
          <Star className={`h-3.5 w-3.5 ${isPinned ? 'fill-primary text-primary' : ''}`} />
        </TBtn>
        <TBtn onClick={handleLock} title={isLocked ? 'Unlock' : 'Lock'}>
          {isLocked ? <Lock className="h-3.5 w-3.5 text-destructive" /> : <Unlock className="h-3.5 w-3.5" />}
        </TBtn>
        <TBtn onClick={() => duplicateNode(node.id)} title="Duplicate">
          <Copy className="h-3.5 w-3.5" />
        </TBtn>
        <div className="h-5 w-px bg-border mx-0.5" />
        {colorOptions.map((c) => (
          <button
            key={c.name}
            className="h-4 w-4 rounded-sm border border-border transition-transform hover:scale-125"
            style={{ backgroundColor: c.css }}
            onClick={() => handleColor(c.name)}
            title={c.name}
          />
        ))}
        <div className="h-5 w-px bg-border mx-0.5" />
        <TBtn onClick={() => deleteNode(node.id)} title="Delete" className="hover:text-destructive">
          <Trash2 className="h-3.5 w-3.5" />
        </TBtn>
      </div>
    </div>
  );
}

function TBtn({ children, onClick, title, className }: { children: React.ReactNode; onClick: () => void; title: string; className?: string }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`rounded p-1.5 text-muted-foreground transition-all duration-150 hover:bg-accent hover:text-foreground active:scale-90 ${className || ''}`}
    >
      {children}
    </button>
  );
}
