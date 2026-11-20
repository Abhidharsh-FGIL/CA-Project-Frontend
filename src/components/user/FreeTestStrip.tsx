import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarClock, ChevronDown, Gift } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePromotionalToShow } from '@/hooks/use-promotional-to-show';
import { promotionalPhase, whenLabel, type PromotionalAssessment } from '@/lib/promotionalApi';
import { promotionalResultPath, promotionalTestPath } from '@/pages/user/PromotionalTestPage';
import { shortCountdown } from '@/components/promotional/Countdown';
import { useT } from '@/content/useText';

type T = ReturnType<typeof useT>;

/** Where the button of a free test leads, what it says, and the status pill beside the title. */
function actionFor(p: PromotionalAssessment, now: number, t: T) {
  const phase = promotionalPhase(p, now);
  const done = !!p.attempted && !p.in_progress_attempt_id;
  if (done) return { to: promotionalResultPath(p.id), label: t('exams.free.btn.result'), live: false, pill: t('exams.free.pill.done'), pillTone: 'done' as const };
  if (phase === 'live') return { to: promotionalTestPath(p.id), label: t('exams.free.btn.start'), live: true, pill: t('exams.free.pill.live'), pillTone: 'live' as const };
  if (phase === 'upcoming') return { to: promotionalTestPath(p.id), label: t('exams.free.btn.ready'), live: false, pill: t('exams.free.pill.upcoming'), pillTone: 'upcoming' as const };
  return { to: promotionalTestPath(p.id), label: t('exams.free.btn.details'), live: false, pill: t('exams.free.pill.closed'), pillTone: 'done' as const };
}

/** "Tue, 17 Nov, 6:00 pm · starts in 5h 52m", "… · closes in 41m", or "Closed 17 Nov, 8:00 pm". */
function clockLine(p: PromotionalAssessment, now: number, t: T): string {
  const phase = promotionalPhase(p, now);
  if (phase === 'upcoming') return t('exams.free.clock.upcoming', { when: whenLabel(p.starts_at), left: shortCountdown(Date.parse(p.starts_at) - now) });
  if (phase === 'live') return t('exams.free.clock.live', { when: whenLabel(p.starts_at), left: shortCountdown(Date.parse(p.ends_at) - now) });
  return t('exams.free.clock.closed', { when: whenLabel(p.ends_at) });
}

const PILL: Record<'live' | 'upcoming' | 'done', string> = {
  live: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300',
  upcoming: 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300',
  done: 'bg-gray-100 text-gray-600 dark:bg-gray-700/60 dark:text-gray-300',
};

function TestRow({ p, now }: { p: PromotionalAssessment; now: number }) {
  const t = useT();
  const a = actionFor(p, now, t);
  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-orange-200/70 bg-gradient-to-r from-amber-50 to-orange-50 px-3.5 py-2.5',
        'dark:border-orange-500/20 dark:from-orange-500/10 dark:to-amber-500/5',
        a.live && 'mge-live-glow',
      )}
    >
      <div className="min-w-0 flex-1 basis-56">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-bold leading-tight text-gray-900 dark:text-gray-100">
          <span className="truncate">{p.title}</span>
          <span className={cn('inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide', PILL[a.pillTone])}>
            {a.live && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" aria-hidden />}
            {a.pill}
          </span>
        </p>
        <p className="mt-1 flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
          <CalendarClock className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span className="tabular-nums">{clockLine(p, now, t)}</span>
        </p>
      </div>
      <Link
        to={a.to}
        className="shrink-0 rounded-lg bg-gradient-to-b from-orange-500 to-orange-600 px-4 py-2 text-xs font-bold text-white shadow-sm shadow-orange-500/30 transition hover:from-orange-600 hover:to-orange-700"
      >
        {a.label}
      </Link>
    </div>
  );
}

/**
 * The student's free scheduled tests as a soft highlighted card under the Exams page heading: a gift tile with
 * "Free tests for you", then a row per test — title, status pill, when it starts or closes, and a button. A test to start
 * now leads, else the soonest; with more than one, the rest fold under "+N more". Nothing at all when there are none.
 */
export function FreeTestStrip({ className }: { className?: string }) {
  const t = useT();
  const { tests, now } = usePromotionalToShow();
  const [open, setOpen] = useState(false);
  if (tests.length === 0) return null;

  // A test to start right now leads; otherwise they are already soonest first.
  const ordered = [...tests].sort((a, b) => Number(actionFor(b, now, t).live) - Number(actionFor(a, now, t).live));
  const [lead, ...rest] = ordered;

  return (
    <section
      aria-label="Free tests"
      className={cn(
        'rounded-2xl border border-orange-200 bg-gradient-to-br from-orange-50 via-amber-50/60 to-white p-3 shadow-sm sm:p-4',
        'dark:border-orange-500/25 dark:from-orange-500/10 dark:via-gray-900 dark:to-gray-900',
        className,
      )}
    >
      <div className="mb-3 flex items-center gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-orange-500 to-rose-500 text-white shadow-sm shadow-orange-500/30">
          <Gift className="h-[18px] w-[18px]" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-bold leading-tight text-gray-900 dark:text-gray-100">{t('exams.free.title')}</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">{t('exams.free.subtitle')}</p>
        </div>
        {rest.length > 0 && (
          <button
            type="button"
            onClick={() => setOpen(v => !v)}
            aria-expanded={open}
            className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2.5 py-1 text-[11px] font-bold text-orange-700 hover:bg-orange-200 dark:bg-orange-500/20 dark:text-orange-300"
          >
            {t('exams.free.more', { count: rest.length })}
            <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')} aria-hidden />
          </button>
        )}
      </div>

      <div className="space-y-2">
        <TestRow p={lead} now={now} />
        {open && rest.map(p => <TestRow key={p.id} p={p} now={now} />)}
      </div>
    </section>
  );
}
