import { Panel, useReactFlow } from '@xyflow/react';
import { 
  AlignLeft, 
  AlignCenter, 
  AlignRight, 
  AlignStartVertical as AlignTop, 
  AlignCenterVertical as AlignMiddle, 
  AlignEndVertical as AlignBottom, 
  BetweenHorizontalEnd as DistributeHoriz,
  BetweenVerticalEnd as DistributeVert,
  Lock,
  Unlock,
  Trash2,
  Trash
} from 'lucide-react';
import { useCanvasStore } from '@/store/canvasStore';
import { useNodes, useEdges } from '@xyflow/react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

export function SelectionToolbar() {
  const nodes = useNodes();
  const setNodes = useCanvasStore((s) => s.setNodes);
  const deleteSelected = useCanvasStore((s) => s.deleteSelected);
  const pushSnapshot = useCanvasStore((s) => s.pushSnapshot);
  const { fitView } = useReactFlow();

  const selectedNodes = nodes.filter((n) => n.selected);
  if (selectedNodes.length < 2) return null;

  const handleAlign = (type: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => {
    pushSnapshot();
    const bounds = {
      minX: Math.min(...selectedNodes.map(n => n.position.x)),
      maxX: Math.max(...selectedNodes.map(n => (n.position.x + (n.measured?.width || 0)))),
      minY: Math.min(...selectedNodes.map(n => n.position.y)),
      maxY: Math.max(...selectedNodes.map(n => (n.position.y + (n.measured?.height || 0)))),
    };

    const newNodes = nodes.map(n => {
      if (!n.selected) return n;
      const w = n.measured?.width || 0;
      const h = n.measured?.height || 0;
      
      let x = n.position.x;
      let y = n.position.y;

      if (type === 'left') x = bounds.minX;
      if (type === 'right') x = bounds.maxX - w;
      if (type === 'center') x = bounds.minX + (bounds.maxX - bounds.minX) / 2 - w / 2;
      
      if (type === 'top') y = bounds.minY;
      if (type === 'bottom') y = bounds.maxY - h;
      if (type === 'middle') y = bounds.minY + (bounds.maxY - bounds.minY) / 2 - h / 2;

      return { ...n, position: { x, y } };
    });

    setNodes(newNodes);
    toast.success(`Aligned ${selectedNodes.length} nodes`);
  };

  const handleDistribute = (axis: 'h' | 'v') => {
    pushSnapshot();
    const sorted = [...selectedNodes].sort((a, b) => 
      axis === 'h' ? a.position.x - b.position.x : a.position.y - b.position.y
    );

    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    
    if (axis === 'h') {
      const totalWidth = last.position.x - first.position.x;
      const step = totalWidth / (sorted.length - 1);
      const newNodes = nodes.map(n => {
        const idx = sorted.findIndex(s => s.id === n.id);
        if (idx === -1) return n;
        return { ...n, position: { ...n.position, x: first.position.x + idx * step } };
      });
      setNodes(newNodes);
    } else {
      const totalHeight = last.position.y - first.position.y;
      const step = totalHeight / (sorted.length - 1);
      const newNodes = nodes.map(n => {
        const idx = sorted.findIndex(s => s.id === n.id);
        if (idx === -1) return n;
        return { ...n, position: { ...n.position, y: first.position.y + idx * step } };
      });
      setNodes(newNodes);
    }
    toast.success(`Distributed ${selectedNodes.length} nodes`);
  };

  const handleLockToggle = (lock: boolean) => {
    pushSnapshot();
    const newNodes = nodes.map(n => {
      if (!n.selected) return n;
      return { ...n, data: { ...n.data, locked: lock }, draggable: !lock, selectable: true };
    });
    setNodes(newNodes);
    toast.success(`${lock ? 'Locked' : 'Unlocked'} ${selectedNodes.length} nodes`);
  };

  return (
    <Panel position="top-center" className="mt-20">
      <TooltipProvider delayDuration={300}>
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-0.5 rounded-2xl toolbar-glass p-1.5 pro-shadow"
        >
          <div className="flex items-center px-3 py-1 text-[10px] font-bold tracking-tight text-primary border-r border-border/40 mr-1.5">
            {selectedNodes.length} SELECTED
          </div>
          
          <ActionBtn onClick={() => handleAlign('left')} tip="Align Left">
            <AlignLeft className="h-4 w-4" />
          </ActionBtn>
          <ActionBtn onClick={() => handleAlign('center')} tip="Align Center">
            <AlignCenter className="h-4 w-4" />
          </ActionBtn>
          <ActionBtn onClick={() => handleAlign('right')} tip="Align Right">
            <AlignRight className="h-4 w-4" />
          </ActionBtn>
          
          <Divider />
          
          <ActionBtn onClick={() => handleAlign('top')} tip="Align Top">
            <AlignTop className="h-4 w-4" />
          </ActionBtn>
          <ActionBtn onClick={() => handleAlign('middle')} tip="Align Middle">
            <AlignMiddle className="h-4 w-4" />
          </ActionBtn>
          <ActionBtn onClick={() => handleAlign('bottom')} tip="Align Bottom">
            <AlignBottom className="h-4 w-4" />
          </ActionBtn>

          <Divider />

          <ActionBtn onClick={() => handleDistribute('h')} tip="Distribute Horizontally">
            <DistributeHoriz className="h-4 w-4" />
          </ActionBtn>
          <ActionBtn onClick={() => handleDistribute('v')} tip="Distribute Vertically">
            <DistributeVert className="h-4 w-4" />
          </ActionBtn>

          <Divider />

          <ActionBtn onClick={() => handleLockToggle(true)} tip="Lock All">
            <Lock className="h-4 w-4" />
          </ActionBtn>
          <ActionBtn onClick={() => handleLockToggle(false)} tip="Unlock All">
            <Unlock className="h-4 w-4" />
          </ActionBtn>

          <Divider />

          <ActionBtn onClick={() => { deleteSelected(); toast.success('Deleted selection'); }} tip="Delete Selection" className="hover:bg-destructive/10 hover:text-destructive">
            <Trash2 className="h-4 w-4" />
          </ActionBtn>
        </motion.div>
      </TooltipProvider>
    </Panel>
  );
}

function ActionBtn({ children, onClick, tip, className }: { children: React.ReactNode; onClick: () => void; tip: string; className?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onClick}
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground transition-all hover:bg-white/5 hover:text-foreground active:bg-white/10",
            className
          )}
        >
          {children}
        </motion.button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="premium-tooltip">
        {tip}
      </TooltipContent>
    </Tooltip>
  );
}

function Divider() {
  return <div className="h-4 w-px bg-white/5 mx-1.5 flex-shrink-0" />;
}
