import { Clock, CheckCircle2, Circle } from 'lucide-react';

interface LogEntry {
  id: string;
  timestamp: string;
  text: string;
  done: boolean;
}

export function DailyLogView({ data }: { data: any }) {
  const entries: LogEntry[] = data.entries || [];
  const doneCount = entries.filter(e => e.done).length;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground font-bold uppercase tracking-wider">
        <Clock className="h-4 w-4" />
        <span>{entries.length} entries · {doneCount} done</span>
      </div>
      {entries.length === 0 ? (
        <p className="text-sm text-muted-foreground/50 italic text-center py-8">No entries yet</p>
      ) : (
        <div className="space-y-1">
          {entries.map((entry) => (
            <div
              key={entry.id}
              className={`flex items-start gap-3 p-3 rounded-xl transition-all ${
                entry.done ? 'opacity-50' : ''
              }`}
            >
              <div className="mt-0.5 text-primary/60">
                {entry.done ? <CheckCircle2 className="h-5 w-5" /> : <Circle className="h-5 w-5" />}
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/40">
                  {entry.timestamp}
                </span>
                <p className={`text-sm text-foreground mt-0.5 ${entry.done ? 'line-through opacity-50' : ''}`}>
                  {entry.text}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
