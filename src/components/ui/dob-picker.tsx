import * as React from 'react';
import { ChevronLeft, ChevronRight, CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format, getDaysInMonth, startOfMonth, getDay } from 'date-fns';

interface DobPickerProps {
  value: string; // yyyy-MM-dd
  onChange: (value: string) => void;
  minYear?: number;
  maxYear?: number;
  placeholder?: string;
}

type View = 'days' | 'months' | 'years';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export function DobPicker({ value, onChange, minYear = 1940, maxYear, placeholder = 'Pick a date' }: DobPickerProps) {
  const computedMaxYear = maxYear ?? new Date().getFullYear();

  const selected = value ? new Date(value + 'T00:00:00') : null;
  const [viewMonth, setViewMonth] = React.useState(selected ? selected.getMonth() : 0);
  const [viewYear, setViewYear] = React.useState(selected ? selected.getFullYear() : 2010);
  const [view, setView] = React.useState<View>('days');
  const [yearPageStart, setYearPageStart] = React.useState(() => {
    const y = selected ? selected.getFullYear() : 2010;
    return y - (y % 12);
  });
  const [open, setOpen] = React.useState(false);

  // Reset view state when popover opens
  React.useEffect(() => {
    if (open) {
      const d = value ? new Date(value + 'T00:00:00') : null;
      setViewMonth(d ? d.getMonth() : 0);
      setViewYear(d ? d.getFullYear() : 2010);
      setView('days');
      const y = d ? d.getFullYear() : 2010;
      setYearPageStart(y - (y % 12));
    }
  }, [open, value]);

  const handleSelectDay = (day: number) => {
    const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    onChange(dateStr);
    setOpen(false);
  };

  const handleSelectMonth = (month: number) => {
    setViewMonth(month);
    setView('days');
  };

  const handleSelectYear = (year: number) => {
    setViewYear(year);
    setView('months');
  };

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  // Days grid
  const daysInMonth = getDaysInMonth(new Date(viewYear, viewMonth));
  const firstDayOfWeek = getDay(startOfMonth(new Date(viewYear, viewMonth)));

  const isSelectedDay = (day: number) =>
    selected && selected.getDate() === day && selected.getMonth() === viewMonth && selected.getFullYear() === viewYear;

  const isToday = (day: number) => {
    const now = new Date();
    return now.getDate() === day && now.getMonth() === viewMonth && now.getFullYear() === viewYear;
  };

  const isDayDisabled = (day: number) => {
    const d = new Date(viewYear, viewMonth, day);
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    return d > today || viewYear < minYear;
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className={cn('w-full justify-start text-left font-normal h-10', !value && 'text-muted-foreground')}>
          <CalendarIcon className="mr-2 h-4 w-4" />
          {selected ? format(selected, 'dd MMM yyyy') : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0" align="start">
        <div className="p-3">
          {/* ── Day View ── */}
          {view === 'days' && (
            <>
              <div className="flex items-center justify-between mb-3">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={prevMonth}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <button
                  type="button"
                  className="text-sm font-medium hover:text-primary transition-colors cursor-pointer px-2 py-1 rounded hover:bg-accent"
                  onClick={() => setView('months')}
                >
                  {MONTHS[viewMonth]} {viewYear}
                </button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={nextMonth}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              <div className="grid grid-cols-7 gap-0 mb-1">
                {DAYS.map(d => (
                  <div key={d} className="text-center text-xs font-medium text-muted-foreground py-1">{d}</div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-0">
                {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                  <div key={`empty-${i}`} className="h-8 w-full" />
                ))}
                {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
                  const disabled = isDayDisabled(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      disabled={disabled}
                      onClick={() => handleSelectDay(day)}
                      className={cn(
                        'h-8 w-full rounded-md text-sm transition-colors',
                        'hover:bg-accent hover:text-accent-foreground',
                        'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1',
                        isSelectedDay(day) && 'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground',
                        isToday(day) && !isSelectedDay(day) && 'bg-accent text-accent-foreground',
                        disabled && 'text-muted-foreground opacity-40 pointer-events-none',
                      )}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {/* ── Month View ── */}
          {view === 'months' && (
            <>
              <div className="flex items-center justify-between mb-3">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setViewYear(y => y - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <button
                  type="button"
                  className="text-sm font-medium hover:text-primary transition-colors cursor-pointer px-2 py-1 rounded hover:bg-accent"
                  onClick={() => setView('years')}
                >
                  {viewYear}
                </button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setViewYear(y => y + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {MONTHS.map((m, i) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => handleSelectMonth(i)}
                    className={cn(
                      'py-2 px-3 rounded-md text-sm transition-colors',
                      'hover:bg-accent hover:text-accent-foreground',
                      i === viewMonth && 'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground',
                    )}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </>
          )}

          {/* ── Year View ── */}
          {view === 'years' && (
            <>
              <div className="flex items-center justify-between mb-3">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setYearPageStart(y => y - 12)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm font-medium">
                  {yearPageStart} – {yearPageStart + 11}
                </span>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setYearPageStart(y => y + 12)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {Array.from({ length: 12 }, (_, i) => yearPageStart + i).map(year => {
                  const outOfRange = year < minYear || year > computedMaxYear;
                  return (
                    <button
                      key={year}
                      type="button"
                      disabled={outOfRange}
                      onClick={() => handleSelectYear(year)}
                      className={cn(
                        'py-2 px-3 rounded-md text-sm transition-colors',
                        'hover:bg-accent hover:text-accent-foreground',
                        year === viewYear && 'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground',
                        outOfRange && 'text-muted-foreground opacity-40 pointer-events-none',
                      )}
                    >
                      {year}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
