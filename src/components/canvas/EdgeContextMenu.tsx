import React from 'react';
import { useCanvasStore } from '@/store/canvasStore';
import { useEdges } from '@xyflow/react';
import { Trash2, Type, Zap, ZapOff, ArrowRight, CornerDownRight, Minus, Layers, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

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
  const setEdges = useCanvasStore((s) => s.setEdges);

  if (!edgeContextMenu) return null;

  const { x, y, edgeId } = edgeContextMenu;
  const edge = edges.find(e => e.id === edgeId);
  const data = (edge?.data || {}) as any;

  const handleAction = (action: () => void) => {
    action();
    setEdgeContextMenu(null);
  };

  const setEdgeStyle = (style: any, label = 'Update Edge Style') => {
    pushSnapshot(label);
    updateEdgeData(edgeId, style);
    setEdgeContextMenu(null);
  };

  const deleteEdge = (id: string) => {
    deleteEdgeAction(id);
  };

  const handleSetLabel = () => {
    const label = prompt('Enter edge label:', typeof edge?.label === 'string' ? edge.label : '');
    if (label !== null) {
      const trimmed = label.trim();
      if (trimmed === (edge?.label || '')) {
        setEdgeContextMenu(null);
        return;
      }
      pushSnapshot('Update Edge Label');
      setEdges(useCanvasStore.getState().edges.map(e => e.id === edgeId ? { ...e, label: trimmed || undefined } : e));
    }
    setEdgeContextMenu(null);
  };

  return (
    <>
      <div
        className="fixed inset-0 z-50"
        onClick={() => setEdgeContextMenu(null)}
        onContextMenu={(e) => { e.preventDefault(); setEdgeContextMenu(null); }}
      />
      <div
        className="fixed z-50 min-w-[200px] rounded-xl border-2 border-border bg-card p-2 shadow-[var(--brutal-shadow)] animate-brutal-pop overflow-hidden"
        style={{ left: Math.min(x, window.innerWidth - 220), top: Math.min(y, window.innerHeight - 350) }}
      >
        <div className="px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground border-b-2 border-border mb-2 bg-muted/30 -mx-2 -mt-2">
          Edge Settings
        </div>

        <CtxBtn onClick={handleSetLabel}>
          <Type className="h-4 w-4" /> {edge?.label ? 'Edit Label' : 'Add Label'}
        </CtxBtn>

        <div className="my-1.5 h-0.5 bg-border" />

        <div className="px-2 py-1 text-[9px] font-black text-muted-foreground uppercase opacity-50">Line Type</div>
        <div className="grid grid-cols-3 gap-1 px-1 mb-2">
          {['solid', 'dashed', 'dotted'].map((s) => (
            <button key={s} onClick={() => setEdgeStyle({ lineStyle: s }, 'Change Edge Style')}
              className={`flex flex-col items-center gap-1 rounded-md border-2 py-1.5 transition-all ${data.lineStyle === s || (!data.lineStyle && s === 'solid') ? 'bg-primary/10 border-primary' : 'border-transparent hover:bg-muted'}`}>
              <span className="text-[8px] font-bold uppercase">{s}</span>
            </button>
          ))}
        </div>

        <div className="px-2 py-1 text-[9px] font-black text-muted-foreground uppercase opacity-50">Path Path</div>
        <div className="grid grid-cols-3 gap-1 px-1 mb-2">
          {['straight', 'step', 'bezier'].map((p) => (
            <button key={p} onClick={() => setEdgeStyle({ pathType: p }, 'Change Edge Path')}
              className={`flex flex-col items-center gap-1 rounded-md border-2 py-1.5 transition-all ${data.pathType === p || (!data.pathType && p === 'bezier') ? 'bg-primary/10 border-primary' : 'border-transparent hover:bg-muted'}`}>
              <span className="text-[8px] font-bold uppercase">{p}</span>
            </button>
          ))}
        </div>

        <div className="px-2 py-1 text-[9px] font-black text-muted-foreground uppercase opacity-50">Flow</div>
        <CtxBtn onClick={() => setEdgeStyle({ animated: !data.animated }, 'Toggle Edge Flow')}>
          {data.animated ? <ZapOff className="h-4 w-4" /> : <Zap className="h-4 w-4" />}
          {data.animated ? 'Stop Animation' : 'Start Flow'}
        </CtxBtn>

        <div className="my-1.5 h-0.5 bg-border" />

        <div className="px-2 py-1 text-[9px] font-black text-muted-foreground uppercase opacity-50">Color</div>
        <div className="grid grid-cols-6 gap-1.5 p-1 mb-2">
          {EDGE_COLORS.map((c) => (
            <button
              key={c.value}
              className={`h-6 w-6 rounded-full border-2 transition-transform hover:scale-125 ${data.color === c.value ? 'ring-2 ring-primary border-card' : 'border-border'}`}
              style={{ backgroundColor: c.value }}
              onClick={() => setEdgeStyle({ color: c.value }, 'Change Edge Color')}
              title={c.label}
            />
          ))}
        </div>

        <button
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-black text-destructive hover:bg-destructive hover:text-destructive-foreground transition-all uppercase tracking-tight"
          onClick={() => handleAction(() => { deleteEdge(edgeId); toast.success('Edge deleted'); })}
        >
          <Trash2 className="h-4 w-4" /> Delete Edge
        </button>
      </div>
    </>
  );
}

const CtxBtn = React.forwardRef<HTMLButtonElement, { children: React.ReactNode; onClick: () => void }>(
  ({ children, onClick }, ref) => (
    <button
      ref={ref}
      className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-bold text-foreground hover:bg-primary/10 hover:text-primary transition-all"
      onClick={onClick}
    >
      {children}
    </button>
  )
);
CtxBtn.displayName = 'CtxBtn';
