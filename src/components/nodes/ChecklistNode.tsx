import { Handle, Position, type NodeProps } from '@xyflow/react';
import { useCanvasStore } from '@/store/canvasStore';
import { BaseNode } from './BaseNode';
import { CheckSquare, Plus, X, GripVertical } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { useCallback, useState } from 'react';

interface CheckItem {
  id: string;
  text: string;
  done: boolean;
}

export function ChecklistNode({ id, data, selected }: NodeProps) {
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const setNodeContextMenu = useCanvasStore((s) => s.setNodeContextMenu);
  const title = (data as any).title || 'Checklist';
  const items: CheckItem[] = (data as any).items || [];
  const nodeData = data as any;
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  const doneCount = items.filter((i) => i.done).length;
  const progress = items.length > 0 ? (doneCount / items.length) * 100 : 0;

  const updateItems = useCallback(
    (newItems: CheckItem[]) => updateNodeData(id, { items: newItems }),
    [id, updateNodeData]
  );

  const addItem = () => {
    updateItems([...items, { id: crypto.randomUUID(), text: '', done: false }]);
  };

  const toggleItem = (itemId: string) => {
    updateItems(items.map((i) => (i.id === itemId ? { ...i, done: !i.done } : i)));
  };

  const updateText = (itemId: string, text: string) => {
    updateItems(items.map((i) => (i.id === itemId ? { ...i, text } : i)));
  };

  const removeItem = (itemId: string) => {
    updateItems(items.filter((i) => i.id !== itemId));
  };

  const handleDragStart = (e: React.DragEvent, idx: number) => {
    e.stopPropagation();
    e.dataTransfer.effectAllowed = 'move';
    setDragIdx(idx);
  };

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    e.stopPropagation();
    if (dragIdx === null || dragIdx === idx) return;
    const newItems = [...items];
    const [moved] = newItems.splice(dragIdx, 1);
    newItems.splice(idx, 0, moved);
    updateItems(newItems);
    setDragIdx(idx);
  };

  const handleDragEnd = (e: React.DragEvent) => {
    e.stopPropagation();
    setDragIdx(null);
  };

  return (
    <BaseNode
      id={id}
      title={title}
      icon={<CheckSquare className="h-4 w-4" />}
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
    >
      <div className="flex flex-col gap-0 p-2">
        {/* Progress bar */}
        <div className="mb-2 flex items-center gap-2">
          <Progress value={progress} className="h-2 flex-1" />
          <span className="text-[10px] font-bold text-muted-foreground">
            {doneCount}/{items.length}
          </span>
        </div>

        {/* Items */}
        <div className="flex flex-col gap-0.5">
          {items.map((item, idx) => (
            <div
              key={item.id}
              className={`group/item flex items-center gap-1 rounded px-1 py-1 hover:bg-accent ${dragIdx === idx ? 'opacity-50' : ''}`}
              draggable
              onDragStart={(e) => handleDragStart(e, idx)}
              onDragOver={(e) => handleDragOver(e, idx)}
              onDragEnd={(e) => handleDragEnd(e)}
            >
              <GripVertical className="h-3 w-3 flex-shrink-0 cursor-grab text-muted-foreground opacity-0 group-hover/item:opacity-100" />
              <button
                onClick={(e) => { e.stopPropagation(); toggleItem(item.id); }}
                className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border-2 transition-colors ${
                  item.done
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-transparent'
                }`}
              >
                {item.done && <span className="text-[10px] font-bold">✓</span>}
              </button>
              <input
                className={`flex-1 bg-transparent text-xs font-medium outline-none placeholder:text-muted-foreground ${
                  item.done ? 'text-muted-foreground line-through' : 'text-foreground'
                }`}
                value={item.text}
                onChange={(e) => updateText(item.id, e.target.value)}
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
                placeholder="To-do item..."
              />
              <button
                onClick={(e) => { e.stopPropagation(); removeItem(item.id); }}
                className="rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover/item:opacity-100"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>

        {/* Add button */}
        <button
          onClick={(e) => { e.stopPropagation(); addItem(); }}
          className="mt-1 flex items-center gap-1.5 rounded px-1 py-1 text-xs font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <Plus className="h-3 w-3" /> Add item
        </button>
      </div>
    </BaseNode>
  );
}
