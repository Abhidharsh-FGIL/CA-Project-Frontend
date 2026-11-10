import { Link } from 'react-router-dom';
import { CalendarClock, Gift } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMyPromotional } from '@/hooks/use-my-promotional';
import { onDashboard, promotionalPhase, whenLabel, type PromotionalAssessment } from '@/lib/promotionalApi';
import { promotionalResultPath, promotionalTestPath } from '@/pages/user/PromotionalTestPage';
import { shortCountdown, useNow } from '@/components/promotional/Countdown';

/**
 * The student's free promotional tests on the dashboard: upcoming ones with a countdown, live ones to start, and
 * closed ones they took, to see their result, for six hours after they close — and only while there is nothing newer. Nothing at all when there are none.
 */
export function PromotionalDashboardCard() {
  const { data } = useMyPromotional();
  const now = useNow(0, 1000);
  const all = (data ?? [])
    .filter(p => onDashboard(p, now))
    .sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at));
  // Once there is a test to take (live) or to wait for (upcoming), the closed ones step aside; they show again only
  // when nothing newer is on.
  const current = all.filter(p => promotionalPhase(p, now) !== 'ended');
  const rows = current.length > 0 ? current : all;
  if (rows.length === 0) return null;
  // A test to start right now makes the whole card stand out.
  const anyLive = rows.some(p => promotionalPhase(p, now) === 'live' && !(p.attempted && !p.in_progress_attempt_id));

  return (
    <section
      className={cn(
        'overflow-hidden rounded-2xl border bg-gradient-to-br from-orange-50 via-white to-rose-50 shadow-sm dark:from-orange-950/30 dark:via-gray-900 dark:to-rose-950/20',
        anyLive ? 'mge-live-glow border-2 border-orange-400 dark:border-orange-500' : 'border-orange-200 dark:border-orange-900/60',
      )}
    >
      <header className="flex items-center gap-2 px-4 pt-4 sm:px-5">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-orange-500 to-rose-500 text-white">
          <Gift className="h-4 w-4" />
        </span>
        <div>
          <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">Free tests for you</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">Scheduled tests — free, and not counted in your plan</p>
        </div>
      </header>
      <ul className="space-y-2 p-2 sm:p-3">
        {rows.map(p => (
          <Row key={p.id} promo={p} now={now} />
        ))}
      </ul>
    </section>
  );
}

function Row({ promo, now }: { promo: PromotionalAssessment; now: number }) {
  const phase = promotionalPhase(promo, now);
  const done = !!promo.attempted && !promo.in_progress_attempt_id;
  const highlight = phase === 'live' && !done;
  const action = done
    ? { to: promotionalResultPath(promo.id), label: 'Your result' }
    : phase === 'live'
      ? { to: promotionalTestPath(promo.id), label: 'Start now' }
      : { to: promotionalTestPath(promo.id), label: 'Get ready' };

  return (
    <li
      className={cn(
        'flex flex-col gap-2 rounded-xl border px-3 py-3 sm:flex-row sm:items-center sm:justify-between',
        // The test to take now is lifted off the card; one still to come is tinted; a closed one stays plain.
        highlight
          ? 'border-orange-300 bg-white shadow-md ring-1 ring-orange-300 dark:border-orange-700 dark:bg-gray-900 dark:ring-orange-700'
          : phase === 'upcoming'
            ? 'border-amber-200 bg-amber-50/70 dark:border-amber-900/50 dark:bg-amber-950/20'
            : 'border-transparent',
      )}
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className={cn('truncate font-semibold text-gray-900 dark:text-gray-100', highlight ? 'text-base font-bold' : 'text-sm')}>{promo.title}</p>
          <span
            className={cn(
              'rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide',
              phase === 'live' && 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
              phase === 'upcoming' && 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
              phase === 'ended' && 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
            )}
          >
            {phase === 'live' && (
              <span className="relative mr-1.5 inline-flex h-1.5 w-1.5 align-middle">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
              </span>
            )}
            {phase === 'live' ? 'Live' : phase === 'upcoming' ? 'Upcoming' : 'Closed'}
          </span>
        </div>
        <p className={cn('mt-0.5 flex items-center gap-1.5 text-xs', highlight ? 'font-semibold text-orange-700 dark:text-orange-300' : 'text-gray-500 dark:text-gray-400')}>
          <CalendarClock className="h-3.5 w-3.5" />
          {phase === 'upcoming'
            ? `${whenLabel(promo.starts_at)} · starts in ${shortCountdown(Date.parse(promo.starts_at) - now)}`
            : phase === 'live'
              ? `Closes in ${shortCountdown(Date.parse(promo.ends_at) - now)}`
              : `Closed ${whenLabel(promo.ends_at)}`}
        </p>
      </div>
      <Link
        to={action.to}
        className={cn(
          'inline-flex shrink-0 items-center justify-center rounded-lg bg-gradient-to-r from-orange-500 to-rose-500 font-bold text-white shadow-sm hover:from-orange-600 hover:to-rose-600',
          highlight ? 'px-5 py-2.5 text-sm shadow-md shadow-orange-300/50 dark:shadow-none' : 'px-3.5 py-2 text-xs',
        )}
      >
        {action.label}
      </Link>
    </li>
  );
}
