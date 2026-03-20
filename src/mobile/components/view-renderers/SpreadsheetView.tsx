import { Sheet } from 'lucide-react';

interface Cell {
  value: string;
  format?: {
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    bgColor?: string;
    textColor?: string;
    align?: 'left' | 'center' | 'right';
  };
}

function colLabel(i: number): string {
  return String.fromCharCode(65 + i);
}

function evalFormula(formula: string, grid: Cell[][]): string {
  try {
    const resolved = formula.toUpperCase().replace(/([A-Z]+)(\d+)/g, (_: string, col: string, row: string) => {
      const colIdx = col.charCodeAt(0) - 65;
      const rowIdx = parseInt(row) - 1;
      const raw = grid[rowIdx]?.[colIdx]?.value ?? '0';
      return raw.startsWith('=') ? '0' : (parseFloat(raw) || 0).toString();
    });
    const withFns = resolved
      .replace(/SUM\(([^)]+)\)/g, (_: string, args: string) => `(${args.split(',').join('+')})`)
      .replace(/AVERAGE\(([^)]+)\)/g, (_: string, args: string) => {
        const parts = args.split(',');
        return `(${parts.join('+')}/${parts.length})`;
      })
      .replace(/MIN\(([^)]+)\)/g, (_: string, args: string) => `Math.min(${args})`)
      .replace(/MAX\(([^)]+)\)/g, (_: string, args: string) => `Math.max(${args})`);
    const result = new Function(`return (${withFns})`)();
    return isNaN(result) ? '#ERR' : String(parseFloat(result.toFixed(6)));
  } catch {
    return '#ERR';
  }
}

function getCellStyle(cell: Cell): React.CSSProperties {
  const format = cell.format || {};
  return {
    fontWeight: format.bold ? 'bold' : 'normal',
    fontStyle: format.italic ? 'italic' : 'normal',
    textDecoration: format.underline ? 'underline' : 'none',
    backgroundColor: format.bgColor || undefined,
    color: format.textColor || undefined,
    textAlign: format.align || 'left',
  };
}

export function SpreadsheetView({ data }: { data: any }) {
  const grid: Cell[][] = data.grid || [];
  if (grid.length === 0) return <p className="text-sm text-muted-foreground italic text-center py-8">Empty spreadsheet</p>;

  const rows = grid.length;
  const cols = grid[0]?.length || 0;

  const displayValue = (cell: Cell): string => {
    if (!cell.value) return '';
    if (cell.value.startsWith('=')) return evalFormula(cell.value.slice(1), grid);
    return cell.value;
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground font-bold uppercase tracking-wider">
        <Sheet className="h-4 w-4" />
        <span>{rows} × {cols}</span>
      </div>
      <div className="overflow-x-auto -mx-2 px-2">
        <table className="border-collapse text-xs w-full">
          <thead>
            <tr>
              <th className="w-8 border border-border bg-accent/50 px-1 py-1 text-center text-[9px] font-bold text-muted-foreground">#</th>
              {Array.from({ length: cols }).map((_, ci) => (
                <th key={ci} className="min-w-[70px] border border-border bg-accent/50 px-2 py-1 text-center text-[9px] font-bold text-muted-foreground uppercase">
                  {colLabel(ci)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grid.map((row, ri) => (
              <tr key={ri}>
                <td className="border border-border bg-accent/30 px-1 py-1 text-center text-[9px] font-bold text-muted-foreground">{ri + 1}</td>
                {row.map((cell, ci) => {
                  const display = displayValue(cell);
                  return (
                    <td
                      key={ci}
                      className={`border border-border px-2 py-1 ${display === '#ERR' ? 'bg-destructive/10 text-destructive' : 'text-foreground'}`}
                      style={getCellStyle(cell)}
                    >
                      <span className={`block truncate ${cell.value?.startsWith('=') ? 'text-primary font-semibold' : ''}`}>
                        {display}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
