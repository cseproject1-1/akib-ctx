import { memo, useState, useCallback } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { useCanvasStore } from '@/store/canvasStore';
import { Table2, Plus, Trash2, Expand } from 'lucide-react';

interface CellData {
  value: string;
}

export const TableNode = memo(({ id, data, selected }: NodeProps) => {
  const { updateNodeData, canvasMode, setExpandedNode } = useCanvasStore();
  const d = data as { title?: string; rows?: CellData[][]; headers?: string[]; locked?: boolean };
  const isView = canvasMode === 'view';

  const headers = d.headers || ['Col A', 'Col B', 'Col C'];
  const rows = d.rows || [[{ value: '' }, { value: '' }, { value: '' }]];

  const updateCell = useCallback((ri: number, ci: number, value: string) => {
    const newRows = rows.map((r, i) =>
      i === ri ? r.map((c, j) => (j === ci ? { value } : c)) : r
    );
    updateNodeData(id, { rows: newRows });
  }, [id, rows, updateNodeData]);

  const updateHeader = useCallback((ci: number, value: string) => {
    const newHeaders = headers.map((h, i) => (i === ci ? value : h));
    updateNodeData(id, { headers: newHeaders });
  }, [id, headers, updateNodeData]);

  const addRow = useCallback(() => {
    const newRow = headers.map(() => ({ value: '' }));
    updateNodeData(id, { rows: [...rows, newRow] });
  }, [id, rows, headers, updateNodeData]);

  const removeRow = useCallback((ri: number) => {
    if (rows.length <= 1) return;
    updateNodeData(id, { rows: rows.filter((_, i) => i !== ri) });
  }, [id, rows, updateNodeData]);

  const addColumn = useCallback(() => {
    const newHeaders = [...headers, `Col ${String.fromCharCode(65 + headers.length)}`];
    const newRows = rows.map((r) => [...r, { value: '' }]);
    updateNodeData(id, { headers: newHeaders, rows: newRows });
  }, [id, headers, rows, updateNodeData]);

  return (
    <div
      className={`animate-node-appear flex h-full w-full flex-col overflow-hidden rounded-lg border-2 bg-card transition-all ${
        selected ? 'border-primary shadow-[4px_4px_0px_hsl(var(--primary)/0.3)]' : 'border-border shadow-[var(--brutal-shadow)]'
      }`}
    >
      {/* Header */}
      <div className="flex items-center gap-2 border-b-2 border-border px-3 py-2 cursor-grab active:cursor-grabbing">
        <Table2 className="h-4 w-4 text-cyan" />
        {!isView ? (
          <input
            className="flex-1 bg-transparent text-sm font-bold uppercase tracking-wide text-foreground outline-none placeholder:text-muted-foreground"
            value={d.title || 'Table'}
            onChange={(e) => updateNodeData(id, { title: e.target.value })}
            onClick={(e) => e.stopPropagation()}
            placeholder="Table"
          />
        ) : (
          <span className="flex-1 text-sm font-bold uppercase tracking-wide text-foreground">{d.title || 'Table'}</span>
        )}
        <button
          className="rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-foreground group-hover:opacity-100"
          onClick={(e) => { e.stopPropagation(); setExpandedNode(id); }}
          title="Fullscreen"
        >
          <Expand className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto" onClick={(e) => e.stopPropagation()}>
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              {headers.map((h, ci) => (
                <th key={ci} className="border-b border-r border-border bg-muted px-2 py-1.5 text-left font-bold uppercase tracking-wider text-muted-foreground">
                  {!isView ? (
                    <input
                      className="w-full bg-transparent outline-none text-muted-foreground font-bold uppercase tracking-wider"
                      value={h}
                      onChange={(e) => updateHeader(ci, e.target.value)}
                      onKeyDown={(e) => e.stopPropagation()}
                    />
                  ) : h}
                </th>
              ))}
              {!isView && (
                <th className="w-8 border-b border-border bg-muted">
                  <button onClick={addColumn} className="p-1 text-muted-foreground hover:text-primary">
                    <Plus className="h-3 w-3" />
                  </button>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri} className="hover:bg-accent/30">
                {row.map((cell, ci) => (
                  <td key={ci} className="border-b border-r border-border px-2 py-1">
                    {!isView ? (
                      <input
                        className="w-full bg-transparent text-foreground outline-none"
                        value={cell.value}
                        onChange={(e) => updateCell(ri, ci, e.target.value)}
                        onKeyDown={(e) => e.stopPropagation()}
                        placeholder="—"
                      />
                    ) : (
                      <span className="text-foreground">{cell.value || '—'}</span>
                    )}
                  </td>
                ))}
                {!isView && (
                  <td className="w-8 border-b border-border text-center">
                    <button onClick={() => removeRow(ri)} className="p-0.5 text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {!isView && (
          <button
            onClick={addRow}
            className="flex w-full items-center justify-center gap-1 border-t border-border py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <Plus className="h-3 w-3" /> Add row
          </button>
        )}
      </div>

      <Handle type="target" position={Position.Top} className="!-top-1.5" />
      <Handle type="source" position={Position.Bottom} className="!-bottom-1.5" />
      <Handle type="target" position={Position.Left} className="!-left-1.5" />
      <Handle type="source" position={Position.Right} className="!-right-1.5" />
    </div>
  );
});

TableNode.displayName = 'TableNode';
