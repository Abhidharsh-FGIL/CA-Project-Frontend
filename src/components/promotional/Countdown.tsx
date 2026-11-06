import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { countdownParts } from '@/lib/promotionalApi';

/** The time now, corrected by `offset` (server minus device), ticking every `everyMs`. */
export function useNow(offset = 0, everyMs = 1000): number {
  const [now, setNow] = useState(() => Date.now() + offset);
  useEffect(() => {
    setNow(Date.now() + offset);
    const t = setInterval(() => setNow(Date.now() + offset), everyMs);
    return () => clearInterval(t);
  }, [offset, everyMs]);
  return now;
}

/** Days · hours · minutes · seconds to a moment, in big tiles. */
export function Countdown({ to, now, className, tone = 'light' }: { to: string; now: number; className?: string; tone?: 'light' | 'dark' }) {
  const { days, hours, minutes, seconds } = countdownParts(Date.parse(to) - now);
  const tiles = [
    ...(days > 0 ? [{ v: days, l: days === 1 ? 'Day' : 'Days' }] : []),
    { v: hours, l: 'Hours' },
    { v: minutes, l: 'Min' },
    { v: seconds, l: 'Sec' },
  ];
  return (
    <div className={cn('flex items-center justify-center gap-2 sm:gap-3', className)} role="timer" aria-live="off">
      {tiles.map(t => (
        <div
          key={t.l}
          className={cn(
            'min-w-[3.75rem] rounded-xl px-2 py-2 text-center sm:min-w-[4.5rem]',
            tone === 'dark' ? 'bg-white/15 text-white backdrop-blur' : 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100',
          )}
        >
          <p className="text-2xl font-extrabold tabular-nums sm:text-3xl">{String(t.v).padStart(2, '0')}</p>
          <p className="text-[10px] font-semibold uppercase tracking-wider opacity-75">{t.l}</p>
        </div>
      ))}
    </div>
  );
}

/** "2d 4h", "3h 12m", "4m 05s" — for a card or a line. */
export function shortCountdown(ms: number): string {
  const { days, hours, minutes, seconds } = countdownParts(ms);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
}
