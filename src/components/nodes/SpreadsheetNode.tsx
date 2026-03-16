import { memo, useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { type NodeProps } from '@xyflow/react';
import { useCanvasStore } from '@/store/canvasStore';
import { toast } from 'sonner';
import { BaseNode } from './BaseNode';
import { Sheet, Plus, Trash2, Download, Upload, Eraser, BarChart3, Bold, Italic, Underline, Palette, Type, HelpCircle, X, Maximize2 } from 'lucide-react';
import { SpreadsheetNodeData } from '@/types/canvas';
import {
  BarChart,
  Bar,
  LineChart as ReLineChart,
  Line,
  PieChart as RePieChart,
  Pie as RePie,
  Cell as ReCell,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';

interface Cell {
  value: string;
  format?: CellFormat;
}

interface CellFormat {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  bgColor?: string;
  textColor?: string;
  align?: 'left' | 'center' | 'right';
}

type Grid = Cell[][];
type ChartType = 'none' | 'bar' | 'line' | 'pie';

interface ChartConfig {
  type: ChartType;
  dataColumn: number;
  labelColumn: number;
  color: string;
}

const COLORS = ['#4f46e5', '#ec4899', '#10b981', '#f59e0b', '#3b82f6', '#8b5cf6'];

const DEFAULT_ROWS = 6;
const DEFAULT_COLS = 5;

// Generate chart data from grid
interface ChartData {
  name: string;
  value: number;
}

function generateChartData(grid: Grid, dataColumn: number, labelColumn: number): ChartData[] {
  const data: ChartData[] = [];
  for (let i = 1; i < grid.length; i++) {
    const dataVal = parseFloat(grid[i]?.[dataColumn]?.value || '0');
    const labelVal = grid[i]?.[labelColumn]?.value || `Row ${i + 1}`;
    if (!isNaN(dataVal)) {
      data.push({ name: labelVal, value: dataVal });
    }
  }
  return data;
}

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
export const SpreadsheetNode = memo(({ id, data, selected }: NodeProps) => {
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const setNodeContextMenu = useCanvasStore((s) => s.setNodeContextMenu);
  const nodeData = data as unknown as SpreadsheetNodeData;

  const grid: Grid = (nodeData.grid as unknown as Grid) || makeGrid(DEFAULT_ROWS, DEFAULT_COLS);
  const rows = grid.length;
  const cols = grid[0]?.length || DEFAULT_COLS;

  // Which cell is being edited
  const [editing, setEditing] = useState<{ r: number; c: number } | null>(null);
  const [editVal, setEditVal] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const setGrid = useCallback((g: Grid) => updateNodeData(id, { grid: g as unknown as { value: string }[][] }), [id, updateNodeData]);

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

  // Chart and fullscreen state
  const [showChartPanel, setShowChartPanel] = useState(false);
  const [selectedCell, setSelectedCell] = useState<{ r: number; c: number } | null>(null);
  const [chartConfig, setChartConfig] = useState<ChartConfig>({
    type: 'none',
    dataColumn: 1,
    labelColumn: 0,
    color: COLORS[0]
  });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const spreadsheetRef = useRef<HTMLDivElement>(null);

  // Chart data
  const chartData = useMemo(() => {
    if (chartConfig.type === 'none') return [];
    return generateChartData(grid, chartConfig.dataColumn, chartConfig.labelColumn);
  }, [grid, chartConfig]);

  // Format cell
  const formatCell = (key: keyof CellFormat, value: string | boolean | undefined) => {
    if (!selectedCell) return;
    const newGrid = grid.map((row, ri) =>
      row.map((cell, ci) => {
        if (ri === selectedCell.r && ci === selectedCell.c) {
          const format = { ...(cell.format || {}), [key]: value };
          return { ...cell, format };
        }
        return cell;
      })
    );
    setGrid(newGrid);
  };

  // Get cell style
  const getCellStyle = (cell: Cell): React.CSSProperties => {
    const format = cell.format || {};
    return {
      fontWeight: format.bold ? 'bold' : 'normal',
      fontStyle: format.italic ? 'italic' : 'normal',
      textDecoration: format.underline ? 'underline' : 'none',
      backgroundColor: format.bgColor || undefined,
      color: format.textColor || undefined,
      textAlign: format.align || 'left',
    };
  };

  // Fullscreen handling
  const toggleFullscreen = useCallback(() => {
    if (!spreadsheetRef.current) return;
    if (!isFullscreen) {
      spreadsheetRef.current.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  }, [isFullscreen]);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

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
          <button 
            onClick={(e) => { e.stopPropagation(); setShowChartPanel(!showChartPanel); }} 
            title="Charts" 
            className={`rounded p-0.5 transition-colors ${showChartPanel ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:text-primary'}`}
          >
            <BarChart3 className="h-3.5 w-3.5" />
          </button>
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
          <button onClick={(e) => { e.stopPropagation(); toggleFullscreen(); }} title="Fullscreen" className="rounded p-0.5 text-muted-foreground hover:text-primary transition-colors">
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
        </div>
      }
      footerStats={`${rows} × ${cols}`}
    >
      {/* Chart Panel */}
      {showChartPanel && (
        <div className="bg-muted p-2 mb-2 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-semibold">Chart:</span>
            <select 
              value={chartConfig.type}
              onChange={(e) => setChartConfig({ ...chartConfig, type: e.target.value as ChartType })}
              className="text-xs bg-background border border-border rounded px-2 py-0.5"
            >
              <option value="none">None</option>
              <option value="bar">Bar</option>
              <option value="line">Line</option>
              <option value="pie">Pie</option>
            </select>
          </div>
          
          {chartConfig.type !== 'none' && (
            <>
              <div className="flex gap-2 mb-2">
                <label className="text-xs">
                  Data Col:
                  <select 
                    value={chartConfig.dataColumn}
                    onChange={(e) => setChartConfig({ ...chartConfig, dataColumn: Number(e.target.value) })}
                    className="ml-1 text-xs bg-background border border-border rounded px-1"
                  >
                    {Array.from({ length: cols }, (_, i) => (
                      <option key={i} value={i}>{colLabel(i)}</option>
                    ))}
                  </select>
                </label>
                <label className="text-xs">
                  Labels:
                  <select 
                    value={chartConfig.labelColumn}
                    onChange={(e) => setChartConfig({ ...chartConfig, labelColumn: Number(e.target.value) })}
                    className="ml-1 text-xs bg-background border border-border rounded px-1"
                  >
                    {Array.from({ length: cols }, (_, i) => (
                      <option key={i} value={i}>{colLabel(i)}</option>
                    ))}
                  </select>
                </label>
              </div>
              
              <div className="h-32 bg-background rounded border border-border p-2">
                <ResponsiveContainer width="100%" height="100%">
                  {chartConfig.type === 'bar' ? (
                    <BarChart data={chartData}>
                      <Bar dataKey="value" fill={chartConfig.color} />
                      <Tooltip />
                    </BarChart>
                  ) : chartConfig.type === 'line' ? (
                    <ReLineChart data={chartData}>
                      <Line dataKey="value" stroke={chartConfig.color} />
                      <Tooltip />
                    </ReLineChart>
                  ) : (
                    <RePieChart>
                      <RePie data={chartData} dataKey="value" nameKey="name" outerRadius={40} fill={chartConfig.color}>
                        {chartData.map((_, index) => (
                          <ReCell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </RePie>
                      <Tooltip />
                    </RePieChart>
                  )}
                </ResponsiveContainer>
              </div>
            </>
          )}
        </div>
      )}
      
      <div ref={spreadsheetRef} className="flex flex-col gap-1.5 overflow-auto">
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
                    const isSelected = selectedCell?.r === ri && selectedCell.c === ci;
                    const display = displayValue(cell);
                    return (
                      <td
                        key={ci}
                        className={`border border-border px-0 py-0 cursor-cell relative ${display === '#ERR' ? 'bg-destructive/10' : ''} ${isSelected ? 'ring-1 ring-primary' : ''}`}
                        style={getCellStyle(cell)}
                        onDoubleClick={(e) => { e.stopPropagation(); startEdit(ri, ci); }}
                        onClick={(e) => { e.stopPropagation(); setSelectedCell({ r: ri, c: ci }); }}
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
                            style={getCellStyle(cell)}
                          />
                        ) : (
                          <span 
                            className={`block px-1 py-0.5 min-h-[20px] select-all whitespace-nowrap ${cell.value.startsWith('=') ? 'text-primary font-semibold' : 'text-foreground'} ${display === '#ERR' ? 'text-destructive' : ''}`}
                            style={getCellStyle(cell)}
                          >
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
          <span className="ml-auto text-[9px] text-muted-foreground italic">
            {selectedCell && `Selected: ${colLabel(selectedCell.c)}${selectedCell.r + 1} | `}
            dbl-click to edit · =SUM(A1,B1)
          </span>
        </div>
      </div>
    </BaseNode>
  );
});

SpreadsheetNode.displayName = 'SpreadsheetNode';
