/**
 * Date filter: presets plus a real custom range.
 *
 * "This week / month / all time" can't answer "how did I do during the August
 * revision block", so the presets are backed by two date inputs. Everything
 * downstream consumes the resolved `{ from, to }`, never the preset name.
 */
import { useState } from 'react';
import { CalendarDays, Check, ChevronDown } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

/** Local YYYY-MM-DD — toISOString() shifts the day for IST users after midnight. */
export const isoDay = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export type DateRangeKey = 'all' | 'week' | 'month' | 'quarter' | 'custom';

export interface DateRange {
  key: DateRangeKey;
  /** Inclusive YYYY-MM-DD bounds; null means unbounded on that side. */
  from: string | null;
  to: string | null;
}

export const ALL_TIME: DateRange = { key: 'all', from: null, to: null };

const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return isoDay(d);
};

const PRESETS: { key: Exclude<DateRangeKey, 'custom'>; label: string; hint: string; build: () => DateRange }[] = [
  { key: 'all', label: 'All time', hint: 'Every attempt', build: () => ALL_TIME },
  { key: 'week', label: 'Last 7 days', hint: 'This week', build: () => ({ key: 'week', from: daysAgo(6), to: null }) },
  { key: 'month', label: 'Last 30 days', hint: 'This month', build: () => ({ key: 'month', from: daysAgo(29), to: null }) },
  { key: 'quarter', label: 'Last 90 days', hint: 'This quarter', build: () => ({ key: 'quarter', from: daysAgo(89), to: null }) },
];

const pretty = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });

export function rangeLabel(range: DateRange): string {
  if (range.key === 'custom') {
    if (range.from && range.to) return `${pretty(range.from)} – ${pretty(range.to)}`;
    if (range.from) return `From ${pretty(range.from)}`;
    if (range.to) return `Until ${pretty(range.to)}`;
    return 'Custom range';
  }
  return PRESETS.find(p => p.key === range.key)?.label ?? 'All time';
}

/** True when a date falls inside the range; undated points are never excluded. */
export function inRange(date: string | undefined, range: DateRange): boolean {
  if (!date) return true;
  if (range.from && date < range.from) return false;
  if (range.to && date > range.to) return false;
  return true;
}

export function DateRangeFilter({
  value,
  onChange,
  size = 'md',
  align = 'end',
}: {
  value: DateRange;
  onChange: (range: DateRange) => void;
  size?: 'sm' | 'md';
  align?: 'start' | 'end';
}) {
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(value.from ?? '');
  const [to, setTo] = useState(value.to ?? '');
  const today = isoDay(new Date());
  const isFiltered = value.key !== 'all';

  const applyCustom = () => {
    if (!from && !to) return;
    // Tolerate a reversed range rather than silently returning nothing.
    const [lo, hi] = from && to && from > to ? [to, from] : [from, to];
    onChange({ key: 'custom', from: lo || null, to: hi || null });
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Date range"
          className={cn(
            'inline-flex items-center gap-1.5 rounded-xl border font-semibold transition-colors',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 dark:focus-visible:ring-indigo-700',
            size === 'sm' ? 'h-8 px-2.5 text-[11px]' : 'h-9 px-3 text-xs',
            isFiltered
              ? 'border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-500/20'
              : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800',
          )}
        >
          <CalendarDays className="w-3.5 h-3.5 opacity-70 flex-shrink-0" />
          <span className="truncate max-w-[10rem]">{rangeLabel(value)}</span>
          <ChevronDown className="w-3.5 h-3.5 opacity-60 flex-shrink-0" />
        </button>
      </PopoverTrigger>

      <PopoverContent align={align} className="w-64 rounded-xl p-1.5">
        {PRESETS.map(p => (
          <button
            key={p.key}
            type="button"
            onClick={() => {
              onChange(p.build());
              setOpen(false);
            }}
            className={cn(
              'w-full flex items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs transition-colors',
              value.key === p.key
                ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300'
                : 'hover:bg-gray-50 dark:hover:bg-gray-800',
            )}
          >
            <span className="flex-1 min-w-0">
              <span className="block font-medium">{p.label}</span>
              <span className="block text-[10px] text-gray-400">{p.hint}</span>
            </span>
            {value.key === p.key && <Check className="w-3.5 h-3.5 flex-shrink-0" />}
          </button>
        ))}

        <div className="mt-1.5 pt-2 border-t border-gray-100 dark:border-gray-800 px-1.5 pb-1">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1.5">Custom range</p>
          <div className="flex items-center gap-1.5">
            <input
              type="date"
              value={from}
              max={to || today}
              onChange={e => setFrom(e.target.value)}
              className="flex-1 min-w-0 h-8 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 text-[11px] focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-800"
            />
            <span className="text-[10px] text-gray-400">to</span>
            <input
              type="date"
              value={to}
              min={from || undefined}
              max={today}
              onChange={e => setTo(e.target.value)}
              className="flex-1 min-w-0 h-8 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 text-[11px] focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-800"
            />
          </div>
          <div className="flex items-center gap-1.5 mt-2">
            <button
              type="button"
              onClick={applyCustom}
              disabled={!from && !to}
              className="flex-1 h-8 rounded-lg bg-indigo-600 text-white text-[11px] font-semibold hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Apply
            </button>
            {isFiltered && (
              <button
                type="button"
                onClick={() => {
                  setFrom('');
                  setTo('');
                  onChange(ALL_TIME);
                  setOpen(false);
                }}
                className="h-8 px-2.5 rounded-lg border border-gray-200 dark:border-gray-700 text-[11px] font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
