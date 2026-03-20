import { Columns3 } from 'lucide-react';

interface KanbanCard {
  id: string;
  text: string;
  portalNodeId?: string;
}

interface KanbanColumn {
  id: string;
  title: string;
  color: string;
  cards: KanbanCard[];
}

const DEFAULT_COLUMNS: KanbanColumn[] = [
  { id: 'todo', title: 'To Do', color: 'bg-muted text-muted-foreground', cards: [] },
  { id: 'inprogress', title: 'In Progress', color: 'bg-primary/20 text-primary', cards: [] },
  { id: 'done', title: 'Done', color: 'bg-green-500/20 text-green-500', cards: [] },
];

export function KanbanView({ data }: { data: any }) {
  const columns: KanbanColumn[] = data.columns || DEFAULT_COLUMNS;
  const totalCards = columns.reduce((sum, col) => sum + col.cards.length, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground font-bold uppercase tracking-wider">
        <Columns3 className="h-4 w-4" />
        <span>{totalCards} cards across {columns.length} columns</span>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-2 px-2 snap-x">
        {columns.map((col) => (
          <div
            key={col.id}
            className="flex-shrink-0 w-[260px] snap-start flex flex-col gap-2 rounded-xl border-2 border-border bg-accent/20 p-3"
          >
            <div className={`rounded-lg px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${col.color}`}>
              {col.title}
              <span className="ml-1 opacity-60">({col.cards.length})</span>
            </div>
            {col.cards.length === 0 ? (
              <p className="text-[11px] text-muted-foreground/50 italic text-center py-4">No cards</p>
            ) : (
              col.cards.map((card) => (
                <div
                  key={card.id}
                  className="rounded-lg border border-border bg-card px-3 py-2 text-xs text-foreground shadow-sm"
                >
                  {card.text}
                </div>
              ))
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
