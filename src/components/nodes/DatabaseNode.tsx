import { memo, useMemo, useState } from 'react';
import { type NodeProps } from '@xyflow/react';
import { BaseNode } from './BaseNode';
import { 
  Database, 
  Plus, 
  Search, 
  ArrowUpDown, 
  Filter, 
  Trash2, 
  MoreVertical,
  Settings2
} from 'lucide-react';
import { useCanvasStore } from '@/store/canvasStore';
import { GroupNodeData } from '@/types/canvas';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  createColumnHelper,
  SortingState,
} from '@tanstack/react-table';
import { DatabaseNodeData } from '@/types/canvas';

interface DatabaseRow extends Record<string, any> {
  id: string;
}

const columnHelper = createColumnHelper<DatabaseRow>();

export const DatabaseNode = memo(({ id, data, selected }: NodeProps) => {
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const setNodeContextMenu = useCanvasStore((s) => s.setNodeContextMenu);
  
  const nodeData = data as unknown as DatabaseNodeData;
  const columnsData = useMemo(() => nodeData.columns || [
    { id: 'name', name: 'Name', type: 'text' },
    { id: 'status', name: 'Status', type: 'text' }
  ], [nodeData.columns]);
  const rowsData = useMemo(() => nodeData.rows || [
    { id: '1', name: 'Example Item', status: 'In Progress' }
  ], [nodeData.rows]);

  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');

  const columns = useMemo(() => [
    ...columnsData.map((col) => 
      columnHelper.accessor(col.id as any, {
        header: () => (
          <div className="flex items-center gap-1">
            <span>{col.name}</span>
          </div>
        ),
        cell: (info) => (
          <input
            className="w-full bg-transparent outline-none py-1"
            value={info.getValue() || ''}
            onChange={(e) => {
              const newRows = [...rowsData];
              newRows[info.row.index] = {
                ...newRows[info.row.index],
                [col.id]: e.target.value
              };
              updateNodeData(id, { rows: newRows });
            }}
          />
        ),
      })
    ),
    columnHelper.display({
      id: 'actions',
      cell: (info) => (
        <button 
          onClick={() => {
            const newRows = rowsData.filter((_, i) => i !== info.row.index);
            updateNodeData(id, { rows: newRows });
          }}
          className="p-1 opacity-0 group-hover/row:opacity-100 hover:text-destructive transition-all"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      ),
    })
  ], [columnsData, rowsData, id, updateNodeData]);

  const table = useReactTable({
    data: rowsData,
    columns: columns as any,
    state: {
      sorting,
      globalFilter,
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const addRow = () => {
    const newRow = { id: crypto.randomUUID() };
    columnsData.forEach((col: { id: string }) => {
      newRow[col.id] = '';
    });
    updateNodeData(id, { rows: [...rowsData, newRow] });
  };

  const addColumn = () => {
    const newColId = `col_${Date.now()}`;
    const newColumns = [...columnsData, { id: newColId, name: 'New Column', type: 'text' as const }];
    updateNodeData(id, { columns: newColumns });
  };

  return (
    <BaseNode
      id={id}
      title={nodeData.title || 'Database'}
      icon={<Database className="h-4 w-4" />}
      selected={selected}
      onMenuClick={(e) => setNodeContextMenu({ x: e.clientX, y: e.clientY, nodeId: id })}
      tags={nodeData.tags}
      color={nodeData.color}
    >
      <div className="flex flex-col min-w-[400px] h-full">
        {/* Toolbar */}
        <div className="flex items-center justify-between gap-2 p-2 border-b border-white/5 bg-white/2">
          <div className="flex items-center gap-2 bg-black/20 rounded-lg px-2 py-1 flex-1 max-w-[200px]">
            <Search className="h-3.5 w-3.5 text-muted-foreground" />
            <input
              value={globalFilter ?? ''}
              onChange={(e) => setGlobalFilter(e.target.value)}
              placeholder="Filter..."
              className="bg-transparent text-xs w-full outline-none"
            />
          </div>
          <div className="flex items-center gap-1">
            <button 
              onClick={addColumn}
              className="p-1.5 rounded-lg hover:bg-white/5 text-muted-foreground hover:text-foreground transition-all"
              title="Add Column"
            >
              <Settings2 className="h-4 w-4" />
            </button>
            <button 
              onClick={addRow}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-all text-xs font-bold uppercase tracking-wider"
            >
              <Plus className="h-3.5 w-3.5" />
              Row
            </button>
          </div>
        </div>

        {/* Table Container */}
        <div className="overflow-x-auto scrollbar-none">
          <table className="w-full text-left border-collapse">
            <thead>
              {table.getHeaderGroups().map(headerGroup => (
                <tr key={headerGroup.id} className="bg-white/5">
                  {headerGroup.headers.map(header => (
                    <th 
                      key={header.id} 
                      className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground border-b border-white/5"
                    >
                      <div 
                        className={`flex items-center gap-1 select-none ${
                          header.column.getCanSort() ? "cursor-pointer hover:text-foreground" : ""
                        }`}
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getCanSort() && (
                          <ArrowUpDown className="h-3 w-3 opacity-30" />
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y divide-white/5">
              {table.getRowModel().rows.map(row => (
                <tr key={row.id} className="group/row hover:bg-white/2 transition-colors">
                  {row.getVisibleCells().map(cell => (
                    <td key={cell.id} className="px-3 py-1 text-[13px] font-medium">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {rowsData.length === 0 && (
          <div className="py-12 text-center text-muted-foreground/30 italic text-[10px] uppercase font-bold tracking-widest">
            No items in database
          </div>
        )}
      </div>
    </BaseNode>
  );
});

DatabaseNode.displayName = 'DatabaseNode';
