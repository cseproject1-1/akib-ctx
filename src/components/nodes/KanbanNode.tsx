import { type NodeProps } from '@xyflow/react';
import { useCanvasStore } from '@/store/canvasStore';
import { BaseNode } from './BaseNode';
import { Columns3, Plus, X, GripVertical } from 'lucide-react';
import { useCallback, useState } from 'react';
import { KanbanNodeData } from '@/types/canvas';

interface KanbanCard {
  id: string;
  text: string;
}

interface KanbanColumn {
  id: string;
  title: string;
  color: string;
  cards: KanbanCard[];
}

const DEFAULT_COLUMNS: KanbanColumn[] = [
  { id: 'todo',        title: 'To Do',       color: 'bg-muted text-muted-foreground',               cards: [] },
  { id: 'inprogress',  title: 'In Progress',  color: 'bg-primary/20 text-primary',                  cards: [] },
  { id: 'done',        title: 'Done',         color: 'bg-green-500/20 text-green-500',               cards: [] },
];

/**
 * @component KanbanNode
 * @description A Kanban board node with drag-and-drop cards across To Do / In Progress / Done columns.
 * @param {NodeProps} props - React Flow node props
 */
export function KanbanNode({ id, data, selected }: NodeProps) {
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const setNodeContextMenu = useCanvasStore((s) => s.setNodeContextMenu);
  const nodeData = data as unknown as KanbanNodeData;
  const title: string = nodeData.title || 'Kanban';
  const columns: KanbanColumn[] = (nodeData.columns as unknown as KanbanColumn[]) || DEFAULT_COLUMNS;

  // Drag state: { cardId, fromColId }
  const [drag, setDrag] = useState<{ cardId: string; fromColId: string } | null>(null);
  const [addingIn, setAddingIn] = useState<string | null>(null);
  const [newCardText, setNewCardText] = useState('');

  const setColumns = useCallback(
    (cols: KanbanColumn[]) => updateNodeData(id, { columns: cols as any }),
    [id, updateNodeData]
  );

  // Add card to column
  const addCard = (colId: string) => {
    if (!newCardText.trim()) return;
    setColumns(
      columns.map((col) =>
        col.id === colId
          ? { ...col, cards: [...col.cards, { id: crypto.randomUUID(), text: newCardText.trim() }] }
          : col
      )
    );
    setNewCardText('');
    setAddingIn(null);
  };

  // Remove card
  const removeCard = (colId: string, cardId: string) => {
    setColumns(columns.map((col) => col.id === colId ? { ...col, cards: col.cards.filter((c) => c.id !== cardId) } : col));
  };

  // Drag-start
  const handleDragStart = (e: React.DragEvent, cardId: string, fromColId: string) => {
    e.stopPropagation();
    e.dataTransfer.effectAllowed = 'move';
    setDrag({ cardId, fromColId });
  };

  // Drop onto column
  const handleDrop = (e: React.DragEvent, toColId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!drag || drag.fromColId === toColId) { setDrag(null); return; }
    const card = columns.find((c) => c.id === drag.fromColId)?.cards.find((c) => c.id === drag.cardId);
    if (!card) { setDrag(null); return; }
    setColumns(
      columns.map((col) => {
        if (col.id === drag.fromColId) return { ...col, cards: col.cards.filter((c) => c.id !== drag.cardId) };
        if (col.id === toColId) return { ...col, cards: [...col.cards, card] };
        return col;
      })
    );
    setDrag(null);
  };

  return (
    <BaseNode
      id={id}
      title={title}
      icon={<Columns3 className="h-4 w-4" />}
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
      nodeType="kanban"
      bodyClassName="p-2"
    >
      <div className="flex gap-2 min-w-[480px]">
        {columns.map((col) => (
          <div
            key={col.id}
            className="flex flex-col gap-1.5 flex-1 min-w-[140px] rounded-lg border-2 border-border bg-accent/30 p-2"
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
            onDrop={(e) => handleDrop(e, col.id)}
          >
            {/* Column header */}
            <div className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${col.color}`}>
              {col.title}
              <span className="ml-1 opacity-60">({col.cards.length})</span>
            </div>

            {/* Cards */}
            {col.cards.map((card) => (
              <div
                key={card.id}
                draggable
                onDragStart={(e) => handleDragStart(e, card.id, col.id)}
                onDragEnd={(e) => { e.stopPropagation(); setDrag(null); }}
                className={`group/card flex items-start gap-1 rounded border border-border bg-card px-2 py-1.5 text-xs cursor-grab active:cursor-grabbing shadow-sm hover:shadow-md transition-all ${drag?.cardId === card.id ? 'opacity-40 scale-95' : ''}`}
              >
                <GripVertical className="h-3 w-3 mt-0.5 flex-shrink-0 text-muted-foreground opacity-0 group-hover/card:opacity-100 transition-opacity" />
                <span className="flex-1 text-foreground break-words">{card.text}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); removeCard(col.id, card.id); }}
                  className="opacity-0 group-hover/card:opacity-100 transition-opacity text-muted-foreground hover:text-destructive flex-shrink-0"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}

            {/* Add card input */}
            {addingIn === col.id ? (
              <div className="flex flex-col gap-1">
                <textarea
                  autoFocus
                  rows={2}
                  value={newCardText}
                  onChange={(e) => setNewCardText(e.target.value)}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addCard(col.id); }
                    if (e.key === 'Escape') { setAddingIn(null); setNewCardText(''); }
                  }}
                  onClick={(e) => e.stopPropagation()}
                  placeholder="Card text…"
                  className="w-full resize-none rounded border border-border bg-card px-2 py-1 text-xs outline-none focus:border-primary"
                />
                <div className="flex gap-1">
                  <button
                    onClick={(e) => { e.stopPropagation(); addCard(col.id); }}
                    className="rounded bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground hover:opacity-90"
                  >Add</button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setAddingIn(null); setNewCardText(''); }}
                    className="rounded bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground hover:bg-accent"
                  >Cancel</button>
                </div>
              </div>
            ) : (
              <button
                onClick={(e) => { e.stopPropagation(); setAddingIn(col.id); }}
                className="flex items-center gap-1 rounded px-1 py-1 text-[10px] font-semibold text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              >
                <Plus className="h-3 w-3" /> Add card
              </button>
            )}
          </div>
        ))}
      </div>
    </BaseNode>
  );
}
