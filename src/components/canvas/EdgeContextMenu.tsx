import React, { useState, useEffect, useCallback } from 'react';
import { useCanvasStore } from '@/store/canvasStore';
import { useEdges } from '@xyflow/react';
import { Trash2, Type, Zap, ZapOff, ArrowRight, CornerDownRight, Minus, Layers, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface EdgeData {
  lineStyle?: 'solid' | 'dashed' | 'dotted';
  pathType?: 'straight' | 'step' | 'bezier';
  animated?: boolean;
  color?: string;
  label?: string;
}

const EDGE_COLORS = [
  { value: 'hsl(0, 0%, 40%)', label: 'Gray' },
  { value: 'hsl(0, 85%, 55%)', label: 'Red' },
  { value: 'hsl(30, 95%, 55%)', label: 'Orange' },
  { value: 'hsl(52, 100%, 50%)', label: 'Yellow' },
  { value: 'hsl(140, 70%, 45%)', label: 'Green' },
  { value: 'hsl(210, 90%, 55%)', label: 'Blue' },
];

export function EdgeContextMenu() {
  const edgeContextMenu = useCanvasStore((s) => s.edgeContextMenu);
  const setEdgeContextMenu = useCanvasStore((s) => s.setEdgeContextMenu);
  const edges = useEdges();
  const updateEdgeData = useCanvasStore((s) => s.updateEdgeData);
  const deleteEdgeAction = useCanvasStore((s) => s.deleteEdge);
  const pushSnapshot = useCanvasStore((s) => s.pushSnapshot);

  const [menuPos, setMenuPos] = useState({ left: 0, top: 0 });

  useEffect(() => {
    if (!edgeContextMenu) return;
    const { x, y } = edgeContextMenu;
    const menuWidth = 220;
    const menuHeight = 400;
    const left = Math.min(x, window.innerWidth - menuWidth);
    const top = Math.min(y, window.innerHeight - menuHeight);
    setMenuPos({ left: Math.max(0, left), top: Math.max(0, top) });
  }, [edgeContextMenu]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      setEdgeContextMenu(null);
    }
  }, [setEdgeContextMenu]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  if (!edgeContextMenu) return null;

  const { x, y, edgeId } = edgeContextMenu;
  const edge = edges.find(e => e.id === edgeId);

  if (!edge) {
    setEdgeContextMenu(null);
    return null;
  }

  const data = (edge?.data || {}) as EdgeData;

  const handleAction = (action: () => void) => {
    action();
    setEdgeContextMenu(null);
  };

  const setEdgeStyle = (style: Partial<EdgeData>, label = 'Update Edge Style') => {
    pushSnapshot(label);
    updateEdgeData(edgeId, style);
    setEdgeContextMenu(null);
  };

  const deleteEdge = (id: string) => {
    deleteEdgeAction(id);
  };

  const handleSetLabel = (e: React.MouseEvent) => {
    e.stopPropagation();
    const label = prompt('Enter edge label:', typeof edge?.label === 'string' ? edge.label : '');
    if (label !== null) {
      const trimmed = label.trim();
      if (!trimmed) {
        toast.error('Edge label cannot be empty');
        setEdgeContextMenu(null);
        return;
      }
      if (trimmed === (edge?.label || '')) {
        setEdgeContextMenu(null);
        return;
      }
      pushSnapshot('Update Edge Label');
      updateEdgeData(edgeId, { label: trimmed });
    }
    setEdgeContextMenu(null);
  };

  const closeMenu = () => setEdgeContextMenu(null);

  return (
    <>
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[90] bg-background/5 backdrop-blur-[1px]"
          onClick={closeMenu}
          onContextMenu={(e) => { e.preventDefault(); closeMenu(); }}
          aria-hidden="true"
        />
      </AnimatePresence>
      <AnimatePresence>
        <motion.div
          role="menu"
          aria-label="Edge settings"
          initial={{ opacity: 0, scale: 0.95, y: -10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -10 }}
          transition={{ duration: 0.15 }}
          className="absolute z-[95] min-w-[200px] rounded-[1.5rem] glass-morphism-strong p-3 pro-shadow border border-white/5"
          style={{ left: menuPos.left, top: menuPos.top }}
        >
          <div className="px-4 py-3 border-b border-white/5 mb-3 flex items-center justify-between bg-white/5 rounded-t-[1.2rem]">
            <p className="text-[10px] font-black text-foreground/40 uppercase tracking-[3px]">Edge Settings</p>
            <div className="h-2 w-2 rounded-full bg-primary/40" />
          </div>

          <CtxBtn role="menuitem" onClick={(e) => handleSetLabel(e)}>
            <Type className="h-4 w-4" /> {edge?.label ? 'Edit Label' : 'Add Label'}
          </CtxBtn>

          <div className="my-2 h-px bg-white/5 mx-1" />

          <div className="px-1 py-1 text-[9px] font-black text-foreground/40 uppercase opacity-50">Line Type</div>
          <div className="grid grid-cols-3 gap-1 px-1 mb-3">
            {(['solid', 'dashed', 'dotted'] as const).map((s) => (
              <button
                key={s}
                role="menuitem"
                onClick={() => setEdgeStyle({ lineStyle: s }, 'Change Edge Style')}
                className={`flex flex-col items-center gap-1 rounded-xl border-2 py-2 transition-all ${data.lineStyle === s || (!data.lineStyle && s === 'solid') ? 'bg-primary/10 border-primary text-primary' : 'border-transparent hover:bg-white/5'}`}
              >
                <span className="text-[8px] font-bold uppercase">{s}</span>
              </button>
            ))}
          </div>

          <div className="px-1 py-1 text-[9px] font-black text-foreground/40 uppercase opacity-50">Path Type</div>
          <div className="grid grid-cols-3 gap-1 px-1 mb-3">
            {(['straight', 'step', 'bezier'] as const).map((p) => (
              <button
                key={p}
                role="menuitem"
                onClick={() => setEdgeStyle({ pathType: p }, 'Change Edge Path')}
                className={`flex flex-col items-center gap-1 rounded-xl border-2 py-2 transition-all ${data.pathType === p || (!data.pathType && p === 'bezier') ? 'bg-primary/10 border-primary text-primary' : 'border-transparent hover:bg-white/5'}`}
              >
                <span className="text-[8px] font-bold uppercase">{p}</span>
              </button>
            ))}
          </div>

          <div className="px-1 py-1 text-[9px] font-black text-foreground/40 uppercase opacity-50">Flow</div>
          <CtxBtn role="menuitem" onClick={() => setEdgeStyle({ animated: !data.animated }, 'Toggle Edge Flow')}>
            {data.animated ? <ZapOff className="h-4 w-4" /> : <Zap className="h-4 w-4" />}
            {data.animated ? 'Stop Flow' : 'Start Flow'}
          </CtxBtn>

          <div className="my-2 h-px bg-white/5 mx-1" />

          <div className="px-1 py-1 text-[9px] font-black text-foreground/40 uppercase opacity-50">Color</div>
          <div className="grid grid-cols-6 gap-1.5 p-2 mb-3">
            {EDGE_COLORS.map((c) => (
              <button
                key={c.value}
                role="menuitem"
                className={`h-6 w-6 rounded-full border-2 transition-all hover:scale-125 ${data.color === c.value ? 'ring-2 ring-primary border-card' : 'border-white/10 hover:border-white/20'}`}
                style={{ backgroundColor: c.value }}
                onClick={() => setEdgeStyle({ color: c.value }, 'Change Edge Color')}
                title={c.label}
              />
            ))}
          </div>

          <CtxBtn 
            role="menuitem"
            onClick={() => handleAction(() => { deleteEdge(edgeId); toast.success('Edge deleted'); })}
            className="text-destructive hover:bg-destructive/10 hover:text-destructive rounded-xl"
          >
            <Trash2 className="h-4 w-4" /> Delete Edge
          </CtxBtn>
        </motion.div>
      </AnimatePresence>
    </>
  );
}

const CtxBtn = React.forwardRef<HTMLButtonElement, { children: React.ReactNode; onClick: (e: React.MouseEvent) => void; disabled?: boolean; className?: string; role?: string }>(
  ({ children, onClick, disabled, className, role }, ref) => (
    <motion.button
      ref={ref}
      whileTap={{ scale: 0.97 }}
      role={role}
      className={cn(
        "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[11px] font-bold uppercase tracking-widest text-foreground/80 transition-all hover:bg-white/5 hover:text-foreground disabled:opacity-40",
        className
      )}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </motion.button>
  )
);
CtxBtn.displayName = 'CtxBtn';
