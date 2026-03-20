import { Database } from 'lucide-react';

interface DbColumn {
  id: string;
  name: string;
  type: string;
}

interface DbRow extends Record<string, any> {
  id: string;
}

export function DatabaseView({ data }: { data: any }) {
  const columns: DbColumn[] = data.columns || [
    { id: 'name', name: 'Name', type: 'text' },
    { id: 'status', name: 'Status', type: 'text' },
  ];
  const rows: DbRow[] = data.rows || [];

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground font-bold uppercase tracking-wider">
        <Database className="h-4 w-4" />
        <span>{rows.length} record{rows.length !== 1 ? 's' : ''}</span>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground/50 italic text-center py-8">No records</p>
      ) : (
        <div className="overflow-x-auto -mx-2 px-2">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-accent/30">
                {columns.map((col) => (
                  <th key={col.id} className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground border-b border-border">
                    {col.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {rows.map((row) => (
                <tr key={row.id} className="hover:bg-accent/20">
                  {columns.map((col) => (
                    <td key={col.id} className="px-3 py-2 text-foreground font-medium">
                      {row[col.id] || '—'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
