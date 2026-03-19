import { memo, useCallback, useState } from 'react';
import { type NodeProps } from '@xyflow/react';
import { useCanvasStore } from '@/store/canvasStore';
import { BaseNode } from './BaseNode';
import { CheckSquare, Plus, X, GripVertical } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { ChecklistNodeData } from '@/types/canvas';

const MAX_ITEMS = 50;

export const ChecklistNode = memo(({ id, data, selected }: NodeProps) => {
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const setNodeContextMenu = useCanvasStore((s) => s.setNodeContextMenu);
  const nodeData = data as unknown as ChecklistNodeData;
  const title = nodeData.title || 'Checklist';
  const items = Array.isArray(nodeData.items) ? nodeData.items : [];
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [focusedItemId, setFocusedItemId] = useState<string | null>(null);

  const doneCount = items.filter((i) => i.done).length;
  const progress = items.length > 0 ? (doneCount / items.length) * 100 : 0;

  const updateItems = useCallback(
    (newItems: NonNullable<ChecklistNodeData['items']>) => updateNodeData(id, { items: newItems }),
    [id, updateNodeData]
  );

  const addItem = () => {
    if (items.length >= MAX_ITEMS) return;
    updateItems([...items, { id: crypto.randomUUID(), text: '', done: false }]);
  };

  const toggleItem = (itemId: string) => {
    updateItems(items.map((i) => (i.id === itemId ? { ...i, done: !i.done } : i)));
  };

  const updateText = (itemId: string, text: string) => {
    updateItems(items.map((i) => (i.id === itemId ? { ...i, text } : i)));
  };

  const removeItem = (itemId: string) => {
    if (items.length === 1) {
      updateItems([]);
    } else {
      updateItems(items.filter((i) => i.id !== itemId));
    }
  };

  // CN1: Reset drag state on drag leave
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.stopPropagation();
    setDragIdx(null);
  }, []);

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

  // CN4/CN7: Handle item keydown for keyboard accessibility
  const handleItemKeyDown = (e: React.KeyboardEvent, itemId: string, idx: number) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggleItem(itemId);
    } else if (e.key === 'Delete' || (e.key === 'Backspace' && items.find(i => i.id === itemId)?.text === '')) {
      e.preventDefault();
      removeItem(itemId);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const nextItem = items[idx + 1];
      if (nextItem) {
        setFocusedItemId(nextItem.id);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prevItem = items[idx - 1];
      if (prevItem) {
        setFocusedItemId(prevItem.id);
      }
    }
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
      summary={`${doneCount}/${items.length} tasks done`}
    >
      <div className="flex flex-col gap-0 p-2">
        {/* Progress bar */}
        <div className="mb-2 flex items-center gap-2" role="progressbar" aria-valuenow={doneCount} aria-valuemin={0} aria-valuemax={items.length} aria-label={`${doneCount} of ${items.length} tasks completed`}>
          <Progress 
            value={progress} 
            className={`h-2 flex-1 ${progress === 100 ? 'bg-green-500' : ''}`} 
          />
          <span className="text-[10px] font-bold text-muted-foreground">
            {doneCount}/{items.length}
          </span>
        </div>

        {/* Items */}
        <div className="flex flex-col gap-0.5" role="list" aria-label="Checklist items">
          {items.length === 0 && (
            <p className="text-center text-[10px] text-muted-foreground/50 py-4">No items yet</p>
          )}
          {items.map((item, idx) => (
            <div
              key={item.id}
              className={`group/item flex items-center gap-1 rounded px-1 py-1 hover:bg-accent focus-within:bg-accent ${dragIdx === idx ? 'opacity-50' : ''} ${focusedItemId === item.id ? 'ring-1 ring-primary' : ''}`}
              draggable
              onDragStart={(e) => handleDragStart(e, idx)}
              onDragOver={(e) => handleDragOver(e, idx)}
              onDragEnd={(e) => handleDragEnd(e)}
              onDragLeave={handleDragLeave}
              role="listitem"
            >
              {/* Touch-friendly: always show grip on mobile */}
              <GripVertical className="h-3 w-3 flex-shrink-0 cursor-grab text-muted-foreground opacity-0 group-hover/item:opacity-100 sm:opacity-0 touch:opacity-100" aria-hidden="true" />
              <button
                onClick={(e) => { e.stopPropagation(); toggleItem(item.id); }}
                onKeyDown={(e) => handleItemKeyDown(e, item.id, idx)}
                className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border-2 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                  item.done
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-transparent hover:border-primary/50'
                }`}
                aria-checked={item.done}
                aria-label={`${item.done ? 'Mark as incomplete' : 'Mark as complete'}: ${item.text || 'Empty item'}`}
                tabIndex={0}
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
                onKeyDown={(e) => { e.stopPropagation(); handleItemKeyDown(e, item.id, idx); }}
                placeholder="To-do item..."
                readOnly={!selected}
                aria-label={`Item ${idx + 1}: ${item.text || 'empty'}`}
                onFocus={() => setFocusedItemId(item.id)}
                onBlur={() => setFocusedItemId(null)}
              />
              <button
                onClick={(e) => { e.stopPropagation(); removeItem(item.id); }}
                className="rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover/item:opacity-100 sm:opacity-0 touch:opacity-100"
                aria-label={`Remove item: ${item.text || 'empty'}`}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>

        {/* Add button - CN7: Always enabled but shows warning when max reached */}
        <button
          onClick={(e) => { e.stopPropagation(); addItem(); }}
          disabled={items.length >= MAX_ITEMS}
          className={`mt-4 rounded-lg border-2 p-2 text-center text-[10px] font-black uppercase tracking-widest transition-all hover:bg-accent/50 ${
            items.length >= MAX_ITEMS 
              ? 'border-destructive/30 bg-destructive/10 text-destructive/50 cursor-not-allowed' 
              : 'border-border bg-accent/30 text-muted-foreground'
          } ${progress === 100 && items.length > 0 ? 'border-green/30 bg-green/10 text-green animate-bounce-subtle' : ''}`}
          aria-label={items.length >= MAX_ITEMS ? `Maximum ${MAX_ITEMS} items reached` : 'Add new item'}
        >
          <Plus className="h-3 w-3 inline mr-1" /> Add item {items.length >= MAX_ITEMS && `(${MAX_ITEMS} max)`}
        </button>
      </div>
    </BaseNode>
  );
});

ChecklistNode.displayName = 'ChecklistNode';
