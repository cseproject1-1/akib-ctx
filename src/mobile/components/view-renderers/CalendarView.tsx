import { useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameDay, isSameMonth, isToday, addMonths, subMonths } from 'date-fns';

interface CalendarEvent {
  id: string;
  date: string;
  label: string;
  color: string;
}

export function CalendarView({ data }: { data: any }) {
  const events: CalendarEvent[] = data.events || [];
  const [viewDate, setViewDate] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  const monthStart = startOfMonth(viewDate);
  const monthEnd = endOfMonth(viewDate);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startPad = getDay(monthStart);

  const eventsForDay = (day: Date) => events.filter((e) => isSameDay(new Date(e.date), day));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground font-bold uppercase tracking-wider">
        <CalendarDays className="h-4 w-4" />
        <span>{events.length} event{events.length !== 1 ? 's' : ''}</span>
      </div>

      <div className="space-y-3">
        {/* Month navigation */}
        <div className="flex items-center justify-between">
          <button onClick={() => setViewDate(subMonths(viewDate, 1))} className="rounded-lg p-2 hover:bg-accent active:scale-95 transition-all">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <span className="text-sm font-bold">{format(viewDate, 'MMMM yyyy')}</span>
          <button onClick={() => setViewDate(addMonths(viewDate, 1))} className="rounded-lg p-2 hover:bg-accent active:scale-95 transition-all">
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        {/* Day-of-week headers */}
        <div className="grid grid-cols-7 gap-1">
          {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
            <div key={d} className="text-center text-[10px] font-bold uppercase tracking-wider text-muted-foreground py-1">{d}</div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: startPad }).map((_, i) => <div key={`pad-${i}`} />)}
          {days.map((day) => {
            const dayEvts = eventsForDay(day);
            const isSelected = selectedDay ? isSameDay(day, selectedDay) : false;
            return (
              <button
                key={day.toISOString()}
                onClick={() => setSelectedDay(isSameDay(day, selectedDay ?? new Date(0)) ? null : day)}
                className={`relative flex flex-col items-center rounded-lg p-1 transition-all min-h-[40px] active:scale-95 ${
                  isSelected ? 'bg-primary text-primary-foreground' :
                  isToday(day) ? 'bg-primary/20 text-primary font-bold' :
                  !isSameMonth(day, viewDate) ? 'opacity-30' :
                  'hover:bg-accent'
                }`}
              >
                <span className="text-xs font-semibold">{format(day, 'd')}</span>
                {dayEvts.length > 0 && (
                  <div className="flex gap-0.5 flex-wrap justify-center mt-0.5">
                    {dayEvts.slice(0, 3).map((e) => (
                      <div key={e.id} className={`h-1.5 w-1.5 rounded-full ${e.color.split(' ')[0]}`} />
                    ))}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Selected day events */}
        {selectedDay && (
          <div className="border-t border-border/50 pt-3 space-y-2">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{format(selectedDay, 'EEEE, MMM d')}</p>
            {eventsForDay(selectedDay).length === 0 ? (
              <p className="text-xs text-muted-foreground/50 italic">No events</p>
            ) : (
              eventsForDay(selectedDay).map((evt) => (
                <div key={evt.id} className={`rounded-lg px-3 py-2 text-xs font-semibold ${evt.color}`}>
                  {evt.label}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
