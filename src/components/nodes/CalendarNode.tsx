import { memo, useState, useCallback } from 'react';
import { type NodeProps } from '@xyflow/react';
import { useCanvasStore } from '@/store/canvasStore';
import { BaseNode } from './BaseNode';
import { CalendarDays, ChevronLeft, ChevronRight, Plus, X } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameDay, isSameMonth, isToday, addMonths, subMonths } from 'date-fns';
import { CalendarNodeData } from '@/types/canvas';

const EVENT_COLORS = [
  'bg-primary text-primary-foreground',
  'bg-green-500 text-white',
  'bg-orange-500 text-white',
  'bg-red-500 text-white',
  'bg-purple-500 text-white',
  'bg-cyan-500 text-white',
];

/**
 * @component CalendarNode
 * @description An interactive monthly calendar node with events/reminders support.
 * Events are stored as ISO date strings in node data.
 * @param {NodeProps} props - React Flow node props
 */
export const CalendarNode = memo(({ id, data, selected }: NodeProps) => {
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const setNodeContextMenu = useCanvasStore((s) => s.setNodeContextMenu);
  const nodeData = data as unknown as CalendarNodeData;

  const events = nodeData.events || [];
  const [viewDate, setViewDate] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [newLabel, setNewLabel] = useState('');
  const [newColor, setNewColor] = useState(EVENT_COLORS[0]);

  const setEvents = useCallback(
    (evts: NonNullable<CalendarNodeData['events']>) => updateNodeData(id, { events: evts }),
    [id, updateNodeData]
  );

  // Calendar grid
  const monthStart = startOfMonth(viewDate);
  const monthEnd = endOfMonth(viewDate);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startPad = getDay(monthStart); // 0=Sun

  const addEvent = () => {
    if (!selectedDay || !newLabel.trim()) return;
    setEvents([...events, { id: crypto.randomUUID(), date: selectedDay.toISOString(), label: newLabel.trim(), color: newColor }]);
    setNewLabel('');
  };

  const removeEvent = (evtId: string) => setEvents(events.filter((e) => e.id !== evtId));

  const eventsForDay = (day: Date) => events.filter((e) => isSameDay(new Date(e.date), day));

  return (
    <BaseNode
      id={id}
      title={nodeData.title || 'Calendar'}
      icon={<CalendarDays className="h-4 w-4" />}
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
      nodeType="calendar"
      bodyClassName="p-2"
    >
      <div className="flex flex-col gap-2 min-w-[280px]">
        {/* Month navigation */}
        <div className="flex items-center justify-between gap-2">
          <button onClick={(e) => { e.stopPropagation(); setViewDate(subMonths(viewDate, 1)); }} className="rounded p-1 hover:bg-accent">
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <span className="text-xs font-bold">{format(viewDate, 'MMMM yyyy')}</span>
          <button onClick={(e) => { e.stopPropagation(); setViewDate(addMonths(viewDate, 1)); }} className="rounded p-1 hover:bg-accent">
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Day-of-week headers */}
        <div className="grid grid-cols-7 gap-px">
          {['Su','Mo','Tu','We','Th','Fr','Sa'].map((d) => (
            <div key={d} className="text-center text-[9px] font-bold uppercase tracking-wider text-muted-foreground py-0.5">{d}</div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7 gap-px">
          {/* Padding cells */}
          {Array.from({ length: startPad }).map((_, i) => <div key={`pad-${i}`} />)}
          {days.map((day) => {
            const dayEvts = eventsForDay(day);
            const isSelected = selectedDay ? isSameDay(day, selectedDay) : false;
            return (
              <button
                key={day.toISOString()}
                onClick={(e) => { e.stopPropagation(); setSelectedDay(isSameDay(day, selectedDay ?? new Date(0)) ? null : day); }}
                className={`relative flex flex-col items-center rounded p-0.5 transition-colors min-h-[28px] ${
                  isSelected ? 'bg-primary text-primary-foreground' :
                  isToday(day) ? 'bg-primary/20 text-primary font-bold' :
                  !isSameMonth(day, viewDate) ? 'opacity-30' :
                  'hover:bg-accent'
                }`}
              >
                <span className="text-[10px] font-semibold">{format(day, 'd')}</span>
                {dayEvts.length > 0 && (
                  <div className="flex gap-px flex-wrap justify-center mt-0.5">
                    {dayEvts.slice(0, 3).map((e) => (
                      <div key={e.id} className={`h-1 w-1 rounded-full ${e.color.split(' ')[0]}`} />
                    ))}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Selected day events */}
        {selectedDay && (
          <div className="border-t border-border/50 pt-2 flex flex-col gap-1.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{format(selectedDay, 'EEEE, MMM d')}</p>
            {eventsForDay(selectedDay).map((evt) => (
              <div key={evt.id} className="flex items-center gap-1 group/evt">
                <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold flex-1 ${evt.color}`}>{evt.label}</span>
                <button onClick={(e) => { e.stopPropagation(); removeEvent(evt.id); }} className="opacity-0 group-hover/evt:opacity-100 transition-opacity">
                  <X className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                </button>
              </div>
            ))}
            {/* Add event */}
            <div className="flex gap-1">
              <input
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') addEvent(); }}
                placeholder="Add event…"
                className="flex-1 rounded border border-border bg-transparent px-2 py-1 text-[10px] outline-none focus:border-primary"
              />
              {/* Color picker */}
              <div className="flex gap-0.5 items-center">
                {EVENT_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={(e) => { e.stopPropagation(); setNewColor(c); }}
                    className={`h-3.5 w-3.5 rounded-full ${c.split(' ')[0]} ${newColor === c ? 'ring-2 ring-offset-1 ring-primary' : ''}`}
                  />
                ))}
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); addEvent(); }}
                disabled={!newLabel.trim()}
                className="rounded bg-primary px-1.5 py-0.5 disabled:opacity-40"
              >
                <Plus className="h-3 w-3 text-primary-foreground" />
              </button>
            </div>
          </div>
        )}
      </div>
    </BaseNode>
  );
});

CalendarNode.displayName = 'CalendarNode';
