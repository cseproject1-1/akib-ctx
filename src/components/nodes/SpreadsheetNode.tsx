import { type NodeProps } from '@xyflow/react';
import { useCanvasStore } from '@/store/canvasStore';
import { toast } from 'sonner';
import { BaseNode } from './BaseNode';
import { Sheet, Plus, Trash2, Download, Upload, Eraser } from 'lucide-react';
import { useState, useCallback, useRef } from 'react';

interface Cell {
  value: string;
}

type Grid = Cell[][];

const DEFAULT_ROWS = 4;
const DEFAULT_COLS = 4;

/**
 * Evaluate simple cell formulas starting with '='.
 * Supports: SUM(A1:B2), AVERAGE(...), MIN(...), MAX(...), basic arithmetic.
 * Cell refs like A1 map to row/col in the grid.
 * @param {string} formula - Raw formula string (without leading '=')
 * @param {Grid} grid - Current spreadsheet grid
 * @returns {string} Computed value string
 */
function evalFormula(formula: string, grid: Grid): string {
  try {
    // Resolve cell refs like A1, B3 → grid[row][col].value
    const resolved = formula.toUpperCase().replace(/([A-Z]+)(\d+)/g, (_: string, col: string, row: string) => {
      const colIdx = col.charCodeAt(0) - 65;
      const rowIdx = parseInt(row) - 1;
      const raw = grid[rowIdx]?.[colIdx]?.value ?? '0';
      return raw.startsWith('=') ? '0' : (parseFloat(raw) || 0).toString();
    });

    // Handle range functions: SUM(1,2,3), AVERAGE(...), etc.
    const withFns = resolved
      .replace(/SUM\(([^)]+)\)/g, (_: string, args: string) => `(${args.split(',').join('+')}`)
      .replace(/AVERAGE\(([^)]+)\)/g, (_: string, args: string) => {
        const parts = args.split(',');
        return `(${parts.join('+')}/${parts.length})`;
      })
      .replace(/MIN\(([^)]+)\)/g, (_: string, args: string) => `Math.min(${args})`)
      .replace(/MAX\(([^)]+)\)/g, (_: string, args: string) => `Math.max(${args})`);

    // eslint-disable-next-line no-new-func
    const result = new Function(`return (${withFns})`)();
    return isNaN(result) ? '#ERR' : String(parseFloat(result.toFixed(6)));
  } catch {
    return '#ERR';
  }
}

function colLabel(i: number): string {
  return String.fromCharCode(65 + i);
}

function makeGrid(rows: number, cols: number): Grid {
  return Array.from({ length: rows }, () => Array.from({ length: cols }, () => ({ value: '' })));
}

/**
 * @component SpreadsheetNode
 * @description Lightweight editable spreadsheet with formula support (=SUM, =AVERAGE, =MIN, =MAX, arithmetic).
 * Includes row/col add/remove and CSV export.
 * @param {NodeProps} props - React Flow node props
 */
export function SpreadsheetNode({ id, data, selected }: NodeProps) {
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const setNodeContextMenu = useCanvasStore((s) => s.setNodeContextMenu);
  const nodeData = data as any;

  const grid: Grid = nodeData.grid || makeGrid(DEFAULT_ROWS, DEFAULT_COLS);
  const rows = grid.length;
  const cols = grid[0]?.length || DEFAULT_COLS;

  // Which cell is being edited
  const [editing, setEditing] = useState<{ r: number; c: number } | null>(null);
  const [editVal, setEditVal] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const setGrid = useCallback((g: Grid) => updateNodeData(id, { grid: g }), [id, updateNodeData]);

  const startEdit = (r: number, c: number) => {
    setEditing({ r, c });
    setEditVal(grid[r][c].value);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const commitEdit = () => {
    if (!editing) return;
    const newGrid = grid.map((row, ri) =>
      row.map((cell, ci) => (ri === editing.r && ci === editing.c ? { value: editVal } : cell))
    );
    setGrid(newGrid);
    setEditing(null);
  };

  const addRow = () => setGrid([...grid, Array.from({ length: cols }, () => ({ value: '' }))]);
  const addCol = () => setGrid(grid.map((row) => [...row, { value: '' }]));
  const removeRow = () => { if (rows > 1) setGrid(grid.slice(0, -1)); };
  const removeCol = () => { if (cols > 1) setGrid(grid.map((row) => row.slice(0, -1))); };

  const exportCSV = () => {
    const csv = grid.map((row) =>
      row.map((cell) => {
        const val = cell.value.startsWith('=') ? evalFormula(cell.value.slice(1), grid) : cell.value;
        return `"${val.replace(/"/g, '""')}"`;
      }).join(',')
    ).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), { href: url, download: `${nodeData.title || 'spreadsheet'}.csv` });
    a.click();
    URL.revokeObjectURL(url);
  };

  const importCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const csv = event.target?.result as string;
      const rows = csv.split(/\r?\n/).filter(r => r.trim());
      const newGrid = rows.map(r => {
        const cells = r.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || [];
        return cells.map(c => ({ value: c.replace(/^"|"$/g, '').replace(/""/g, '"') }));
      });
      if (newGrid.length > 0) {
        setGrid(newGrid);
        toast.success(`Imported ${newGrid.length} rows`);
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset input
  };

  const clearGrid = () => {
    if (confirm('Clear all data in this spreadsheet?')) {
      setGrid(makeGrid(rows, cols));
      toast.info('Grid cleared');
    }
  };

  const displayValue = (cell: Cell): string => {
    if (!cell.value) return '';
    if (cell.value.startsWith('=')) return evalFormula(cell.value.slice(1), grid);
    return cell.value;
  };

  return (
    <BaseNode
      id={id}
      title={nodeData.title || 'Spreadsheet'}
      icon={<Sheet className="h-4 w-4" />}
      selected={selected}
      onTitleChange={(t) => updateNodeData(id, { title: t })}
      onMenuClick={(e) => setNodeContextMenu({ x: e.clientX, y: e.clientY, nodeId: id })}
      tags={nodeData.tags}
      collapsed={nodeData.collapsed}
      onToggleCollapse={() => updateNodeData(id, { collapsed: !nodeData.collapsed })}
      emoji={nodeData.emoji}
      dueDate={nodeData.dueDate}
      opacity={nodeData.opacity}
      createdAt={nodeData.createdAt}
      color={nodeData.color}
      nodeType="spreadsheet"
      bodyClassName="p-2"
      headerExtra={
        <div className="flex items-center gap-1 opacity-0 group-hover/node:opacity-100 transition-opacity">
          <button onClick={(e) => { e.stopPropagation(); exportCSV(); }} title="Export CSV" className="rounded p-0.5 text-muted-foreground hover:text-primary transition-colors">
            <Download className="h-3.5 w-3.5" />
          </button>
          <label className="cursor-pointer rounded p-0.5 text-muted-foreground hover:text-primary transition-colors" title="Import CSV">
            <Upload className="h-3.5 w-3.5" />
            <input type="file" accept=".csv" className="hidden" onChange={importCSV} />
          </label>
          <button onClick={(e) => { e.stopPropagation(); clearGrid(); }} title="Clear Selection" className="rounded p-0.5 text-muted-foreground hover:text-destructive transition-colors">
            <Eraser className="h-3.5 w-3.5" />
          </button>
        </div>
      }
      footerStats={`${rows} × ${cols}`}
    >
      <div className="flex flex-col gap-1.5 overflow-auto">
        <div className="overflow-auto">
          <table className="border-collapse text-[11px]">
            <thead>
              <tr>
                {/* Row number column header */}
                <th className="w-6 border border-border bg-accent/50 px-1 text-center text-[9px] font-bold text-muted-foreground">#</th>
                {Array.from({ length: cols }).map((_, ci) => (
                  <th key={ci} className="min-w-[80px] border border-border bg-accent/50 px-1 py-0.5 text-center text-[9px] font-bold text-muted-foreground uppercase">
                    {colLabel(ci)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {grid.map((row, ri) => (
                <tr key={ri}>
                  <td className="border border-border bg-accent/30 px-1 text-center text-[9px] font-bold text-muted-foreground">{ri + 1}</td>
                  {row.map((cell, ci) => {
                    const isEditing = editing?.r === ri && editing.c === ci;
                    const display = displayValue(cell);
                    return (
                      <td
                        key={ci}
                        className={`border border-border px-0 py-0 cursor-cell relative ${display === '#ERR' ? 'bg-destructive/10' : ''}`}
                        onDoubleClick={(e) => { e.stopPropagation(); startEdit(ri, ci); }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {isEditing ? (
                          <input
                            ref={inputRef}
                            value={editVal}
                            onChange={(e) => setEditVal(e.target.value)}
                            onBlur={commitEdit}
                            onKeyDown={(e) => {
                              e.stopPropagation();
                              if (e.key === 'Enter') commitEdit();
                              if (e.key === 'Escape') setEditing(null);
                            }}
                            className="w-full px-1 py-0.5 bg-primary/10 border-2 border-primary outline-none text-[11px] text-foreground"
                          />
                        ) : (
                          <span className={`block px-1 py-0.5 min-h-[20px] select-all whitespace-nowrap ${cell.value.startsWith('=') ? 'text-primary font-semibold' : 'text-foreground'} ${display === '#ERR' ? 'text-destructive' : ''}`}>
                            {display}
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Row/Col controls */}
        <div className="flex items-center gap-1 flex-wrap">
          <button onClick={(e) => { e.stopPropagation(); addRow(); }} className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground hover:bg-accent hover:text-foreground">
            <Plus className="h-3 w-3" /> Row
          </button>
          <button onClick={(e) => { e.stopPropagation(); addCol(); }} className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground hover:bg-accent hover:text-foreground">
            <Plus className="h-3 w-3" /> Col
          </button>
          <button onClick={(e) => { e.stopPropagation(); removeRow(); }} disabled={rows <= 1} className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-30">
            <Trash2 className="h-3 w-3" /> Row
          </button>
          <button onClick={(e) => { e.stopPropagation(); removeCol(); }} disabled={cols <= 1} className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-30">
            <Trash2 className="h-3 w-3" /> Col
          </button>
          <span className="ml-auto text-[9px] text-muted-foreground italic">dbl-click to edit · =SUM(A1,B1)</span>
        </div>
      </div>
    </BaseNode>
  );
}
