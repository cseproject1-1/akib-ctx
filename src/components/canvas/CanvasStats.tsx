import { useCanvasStore } from '@/store/canvasStore';
import { useNodes, useEdges } from '@xyflow/react';
import { BarChart3, X } from 'lucide-react';
import { useState } from 'react';

function extractTextFromNode(data: Record<string, unknown>): string {
  const parts: string[] = [];
  if (data.title) parts.push(data.title as string);
  if (data.text) parts.push(data.text as string);
  if (data.content) parts.push(extractTiptapText(data.content));
  if (data.bullets) parts.push((data.bullets as string[]).join(' '));
  if (data.questions) parts.push((data.questions as string[]).join(' '));
  if (data.items) parts.push((data.items as Array<{ text: string }>).map((i) => i.text).join(' '));
  return parts.join(' ');
}

function extractTiptapText(content: unknown): string {
  if (!content) return '';
  if (typeof content === 'string') return content;
  if (typeof content === 'object' && content !== null) {
    const c = content as { text?: string; content?: unknown[] };
    if (c.text) return c.text;
    if (c.content && Array.isArray(c.content)) return c.content.map(extractTiptapText).join(' ');
  }
  return '';
}

export function CanvasStats() {
  const [open, setOpen] = useState(false);
  const nodes = useNodes();
  const edges = useEdges();

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed left-6 bottom-6 z-40 flex h-10 w-10 items-center justify-center rounded-lg border-2 border-border bg-card shadow-[3px_3px_0px_hsl(0,0%,15%)] transition-all hover:bg-accent"
        title="Canvas Stats"
      >
        <BarChart3 className="h-4 w-4 text-muted-foreground" />
      </button>
    );
  }

  // Compute stats
  const selectedNodes = nodes.filter(n => n.selected);
  const targetNodes = selectedNodes.length > 0 ? selectedNodes : nodes;
  const isSelectionMode = selectedNodes.length > 0;

  const typeCounts: Record<string, number> = {};
  let totalWords = 0;
  targetNodes.forEach((n) => {
    typeCounts[n.type || 'unknown'] = (typeCounts[n.type || 'unknown'] || 0) + 1;
    const text = extractTextFromNode(n.data);
    totalWords += text.split(/\s+/).filter(Boolean).length;
  });

  return (
    <div className="fixed left-6 bottom-6 z-40 w-52 rounded-xl border border-border bg-card shadow-[var(--clay-shadow-md)] animate-brutal-pop">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-primary" />
          <span className="text-xs font-black uppercase tracking-widest text-foreground">
            {isSelectionMode ? 'Selection' : 'Canvas'}
          </span>
        </div>
        <button onClick={() => setOpen(false)} className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="space-y-1.5 p-3">
        <StatRow label="Nodes" value={targetNodes.length} />
        <StatRow label="Connections" value={isSelectionMode ? edges.filter(e => selectedNodes.some(n => n.id === e.source || n.id === e.target)).length : edges.length} />
        <StatRow label="Words" value={totalWords} />
        <div className="h-px bg-border" />
        {Object.entries(typeCounts)
          .sort((a, b) => b[1] - a[1])
          .map(([type, count]) => (
            <StatRow key={type} label={type} value={count} />
          ))}
      </div>
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className="text-xs font-bold text-foreground">{value}</span>
    </div>
  );
}
