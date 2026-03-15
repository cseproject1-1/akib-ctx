import { memo, useState, useCallback, useMemo } from 'react';
import { type NodeProps } from '@xyflow/react';
import { useCanvasStore } from '@/store/canvasStore';
import { Table2, Plus, Trash2, Expand } from 'lucide-react';
import { BaseNode } from './BaseNode';
import { TableNodeData } from '@/types/canvas';

export const TableNode = memo(({ id, data, selected }: NodeProps) => {
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const canvasMode = useCanvasStore((s) => s.canvasMode);
  const setExpandedNode = useCanvasStore((s) => s.setExpandedNode);
  const nodeData = data as unknown as TableNodeData;
  const isView = canvasMode === 'view';

  const headers = useMemo(() => nodeData.headers || ['Col A', 'Col B', 'Col C'], [nodeData.headers]);
  const rows = useMemo(() => nodeData.rows || [[{ value: '' }, { value: '' }, { value: '' }]], [nodeData.rows]);

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

  const removeColumn = useCallback((ci: number) => {
    if (headers.length <= 1) return;
    const newHeaders = headers.filter((_, i) => i !== ci);
    const newRows = rows.map((r) => r.filter((_, i) => i !== ci));
    updateNodeData(id, { headers: newHeaders, rows: newRows });
  }, [id, headers, rows, updateNodeData]);

  const downloadCsv = useCallback(() => {
    const csvContent = [headers.join(',')]
      .concat(rows.map(r => r.map(c => `"${c.value.replace(/"/g, '""')}"`).join(',')))
      .join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${nodeData.title || 'Table'}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  }, [headers, rows, nodeData.title]);

  const safeEvaluate = (val: string) => {
    if (!val.startsWith('=')) return val;
    try {
      // Evaluate simple math
      const mathExp = val.substring(1).replace(/[^0-9+\-*/().]/g, '');
      return new Function(`return ${mathExp}`)();
    } catch {
      return '!ERR';
    }
  };

  return (
    <BaseNode
      id={id}
      title={nodeData.title || 'Table'}
      icon={<Table2 className="h-4 w-4 text-cyan" />}
      selected={selected}
      onTitleChange={(t) => updateNodeData(id, { title: t })}
      bodyClassName="flex-1 overflow-auto custom-scrollbar"
      onMenuClick={(e) => useCanvasStore.getState().setNodeContextMenu({ x: e.clientX, y: e.clientY, nodeId: id })}
      tags={nodeData.tags}
      collapsed={nodeData.collapsed}
      onToggleCollapse={() => updateNodeData(id, { collapsed: !nodeData.collapsed })}
      emoji={nodeData.emoji}
      dueDate={nodeData.dueDate}
      opacity={nodeData.opacity}
      createdAt={nodeData.createdAt}
      color={nodeData.color}
      nodeType="table"
    >
      {/* Table Toolbar */}
      {!isView && (
        <div className="flex items-center gap-2 p-1 border-b border-border bg-muted/30 px-3">
          <button
            onClick={downloadCsv}
            className="text-[10px] font-bold uppercase tracking-wider text-primary hover:text-primary/80 flex items-center gap-1"
          >
            Download CSV
          </button>
        </div>
      )}
      
      <div className="p-0 nodrag nowheel nopan" onClick={(e) => e.stopPropagation()}>
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              {headers.map((h, ci) => (
                <th key={ci} className="border-b border-r border-border bg-muted px-2 py-1.5 text-left font-bold uppercase tracking-wider text-muted-foreground group">
                  <div className="flex items-center justify-between gap-1">
                    {!isView ? (
                      <input
                        className="w-full bg-transparent outline-none text-muted-foreground font-bold uppercase tracking-wider"
                        value={h}
                        onChange={(e) => updateHeader(ci, e.target.value)}
                        onKeyDown={(e) => e.stopPropagation()}
                      />
                    ) : h}
                    {!isView && (
                        <button onClick={() => removeColumn(ci)} className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity">
                            <Trash2 className="h-3 w-3" />
                        </button>
                    )}
                  </div>
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
              <tr key={ri} className="hover:bg-accent/30 odd:bg-transparent even:bg-muted/10 transition-colors">
                {row.map((cell, ci) => (
                  <td key={ci} className="border-b border-r border-border px-2 py-1 relative group/cell">
                    {!isView ? (
                      <input
                        className="w-full bg-transparent text-foreground outline-none"
                        value={cell.value}
                        onChange={(e) => updateCell(ri, ci, e.target.value)}
                        onKeyDown={(e) => e.stopPropagation()}
                        placeholder="—"
                      />
                    ) : (
                      <span className="text-foreground">{cell.value.startsWith('=') ? safeEvaluate(cell.value) : cell.value || '—'}</span>
                    )}
                      {!isView && cell.value.startsWith('=') && (
                        <div className="absolute top-full left-0 z-10 bg-black text-white text-[10px] px-1 rounded opacity-0 group-hover/cell:opacity-100 pointer-events-none whitespace-nowrap">
                          Output: {safeEvaluate(cell.value)}
                        </div>
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
    </BaseNode>
  );
});

TableNode.displayName = 'TableNode';
