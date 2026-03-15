import { useState } from 'react';
import { useCanvasStore } from '@/store/canvasStore';
import { useReactFlow, useNodes } from '@xyflow/react';
import { Star, ChevronRight, X } from 'lucide-react';

export function PinnedNodesPanel() {
  const [open, setOpen] = useState(false);
  const nodes = useNodes();
  const reactFlow = useReactFlow();

  const pinnedNodes = nodes.filter((n) => (n.data as { pinned?: boolean })?.pinned);

  const handleNavigate = (nodeId: string) => {
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;
    const w = (node.style?.width as number) || 300;
    const h = (node.style?.height as number) || 300;
    reactFlow.setCenter(node.position.x + w / 2, node.position.y + h / 2, { duration: 400, zoom: 1.2 });
  };

  const getNodeLabel = (node: Node): string => {
    const d = node.data as Record<string, unknown> || {};
    return (d.title as string) || (d.label as string) || (d.fileName as string) || (d.altText as string) || (d.sourceTitle as string) || (d.text as string)?.slice(0, 30) || node.type || 'Node';
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed left-6 bottom-20 z-[60] flex h-10 items-center gap-1.5 rounded-lg border-2 border-border bg-card px-3 shadow-[3px_3px_0px_hsl(0,0%,15%)] transition-all hover:bg-accent active:scale-95"
        title="Pinned Nodes"
      >
        <Star className="h-4 w-4 text-primary" />
        {pinnedNodes.length > 0 && (
          <span className="text-xs font-bold text-foreground">{pinnedNodes.length}</span>
        )}
      </button>
    );
  }

  return (
    <div className="fixed left-6 bottom-20 z-[60] w-60 rounded-xl border border-border bg-card shadow-[var(--clay-shadow-md)] animate-brutal-pop">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <div className="flex items-center gap-2">
          <Star className="h-4 w-4 text-primary" />
          <span className="text-xs font-bold uppercase tracking-wider text-foreground">Pinned</span>
        </div>
        <button onClick={() => setOpen(false)} className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="max-h-60 overflow-y-auto p-1.5">
        {pinnedNodes.length === 0 ? (
          <p className="px-2 py-4 text-center text-xs text-muted-foreground">
            No pinned nodes yet. Right-click a node → Pin.
          </p>
        ) : (
          pinnedNodes.map((node) => (
            <button
              key={node.id}
              onClick={() => handleNavigate(node.id)}
              className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs font-semibold text-foreground transition-all hover:bg-accent"
            >
              <ChevronRight className="h-3 w-3 text-muted-foreground" />
              <span className="flex-1 truncate">{getNodeLabel(node)}</span>
              <span className="text-[10px] text-muted-foreground">{node.type}</span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
