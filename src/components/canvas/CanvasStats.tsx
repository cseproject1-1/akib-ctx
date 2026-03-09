import { useCanvasStore } from '@/store/canvasStore';
import { BarChart3, X } from 'lucide-react';
import { useState } from 'react';

function extractTextFromNode(data: any): string {
  const parts: string[] = [];
  if (data.title) parts.push(data.title);
  if (data.text) parts.push(data.text);
  if (data.content) parts.push(extractTiptapText(data.content));
  if (data.bullets) parts.push((data.bullets as string[]).join(' '));
  if (data.questions) parts.push((data.questions as string[]).join(' '));
  if (data.items) parts.push((data.items as any[]).map((i) => i.text).join(' '));
  return parts.join(' ');
}

function extractTiptapText(content: any): string {
  if (!content) return '';
  if (typeof content === 'string') return content;
  if (content.text) return content.text;
  if (content.content && Array.isArray(content.content)) return content.content.map(extractTiptapText).join(' ');
  return '';
}

export function CanvasStats() {
  const [open, setOpen] = useState(false);
  const { nodes, edges } = useCanvasStore();

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
  const typeCounts: Record<string, number> = {};
  let totalWords = 0;
  nodes.forEach((n) => {
    typeCounts[n.type || 'unknown'] = (typeCounts[n.type || 'unknown'] || 0) + 1;
    const text = extractTextFromNode(n.data);
    totalWords += text.split(/\s+/).filter(Boolean).length;
  });

  return (
    <div className="fixed left-6 bottom-6 z-40 w-52 rounded-xl border-2 border-border bg-card shadow-[6px_6px_0px_hsl(0,0%,15%)] animate-brutal-pop">
      <div className="flex items-center justify-between border-b-2 border-border px-3 py-2">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-bold uppercase tracking-wider text-foreground">Stats</span>
        </div>
        <button onClick={() => setOpen(false)} className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="space-y-1.5 p-3">
        <StatRow label="Nodes" value={nodes.length} />
        <StatRow label="Connections" value={edges.length} />
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
