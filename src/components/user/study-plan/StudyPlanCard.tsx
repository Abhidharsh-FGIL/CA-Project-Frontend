/**
 * The study plan's entry points outside its own page.
 *
 * `StudyPlanCard` is the dashboard's slot: today's work when a plan exists, a
 * prompt to build one when it does not. `StudyPlanReportCta` sits at the foot of
 * an attempt report, which is the moment a candidate has just seen their
 * weaknesses and is most likely to act on them.
 *
 * Both render nothing at all when the backend has not shipped study plans
 * (§S10) — an empty dashboard slot is better than a card advertising a feature
 * that cannot be opened.
 */
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  CalendarCheck,
  CheckCircle2,
  Circle,
  Flame,
  Loader2,
  Moon,
  Sparkles,
  Wand2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ACCENT } from '@/components/user/report-ui';
import { useActiveStudyPlan, useTaskToggle } from '@/hooks/use-study-plan';
import { MiniRing, fmtMinutes } from './plan-ui';

// ─── Dashboard slot ───────────────────────────────────────────────────────────

export function StudyPlanCard() {
  const { data, isLoading, unavailable } = useActiveStudyPlan();

  if (unavailable) return null;

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 flex items-center justify-center h-32">
        <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
      </div>
    );
  }

  if (!data) return <StudyPlanEmptyCard />;

  const { plan, today, adherence, coverage } = data;
  const pending = today?.tasks.filter(t => t.status === 'pending') ?? [];
  const doneCount = today?.tasks.filter(t => t.status === 'done').length ?? 0;

  return (
    <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm p-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0 flex items-start gap-2.5">
          <span
            className={cn(
              'flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center mt-px',
              ACCENT.indigo.chip,
            )}
          >
            <CalendarCheck className="w-4 h-4" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-bold text-gray-900 dark:text-gray-100 leading-snug">
              Today's plan
            </p>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 truncate">
              {today?.is_rest
                ? 'Rest day — nothing scheduled'
                : `${fmtMinutes(today?.planned_minutes ?? 0)} across ${today?.tasks.length ?? 0} task${(today?.tasks.length ?? 0) === 1 ? '' : 's'}`}
            </p>
          </div>
        </div>
        <Link
          to="/user/study-plan"
          className="flex-shrink-0 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline whitespace-nowrap"
        >
          Open plan
        </Link>
      </div>

      {today?.is_rest ? (
        <div className="py-4 text-center">
          <Moon className="w-5 h-5 mx-auto text-gray-300 dark:text-gray-600" />
          <p className="mt-1.5 text-[11px] text-gray-400">
            You set this day aside. Back to it tomorrow.
          </p>
        </div>
      ) : pending.length === 0 && doneCount > 0 ? (
        <div className="py-4 text-center">
          <CheckCircle2 className="w-5 h-5 mx-auto text-emerald-500" />
          <p className="mt-1.5 text-[11px] font-semibold text-gray-700 dark:text-gray-200">
            Today's work is done — all {doneCount} task{doneCount === 1 ? '' : 's'}.
          </p>
        </div>
      ) : (
        <ul className="space-y-1.5">
          {(today?.tasks ?? []).slice(0, 4).map(t => (
            <QuickTask key={t.task_id} planId={plan.plan_id} task={t} />
          ))}
          {(today?.tasks.length ?? 0) > 4 && (
            <li>
              <Link
                to="/user/study-plan"
                className="inline-flex items-center gap-1 text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                {(today?.tasks.length ?? 0) - 4} more today <ArrowRight className="w-3 h-3" />
              </Link>
            </li>
          )}
        </ul>
      )}

      <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <MiniRing pct={coverage.pct} size={44} accent="emerald" />
          <div>
            <p className="text-[10px] font-semibold text-gray-700 dark:text-gray-200">
              Syllabus covered
            </p>
            <p className="text-[10px] text-gray-400 tabular-nums">
              {coverage.topics_touched}/{coverage.topics_total} topics
            </p>
          </div>
        </div>
        {adherence.streak_days > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 dark:bg-amber-950/40 px-2 py-1 text-[10px] font-bold text-amber-600 dark:text-amber-400">
            <Flame className="w-3 h-3" /> {adherence.streak_days}d
          </span>
        )}
      </div>
    </div>
  );
}

/** A compact tick-off row — the dashboard's whole interaction. */
function QuickTask({
  planId,
  task,
}: {
  planId: string;
  task: { task_id: string; title: string; minutes: number; status: string };
}) {
  const toggle = useTaskToggle(planId);
  const done = task.status === 'done';

  return (
    <li className="flex items-start gap-2">
      <button
        type="button"
        aria-label={done ? 'Mark as not done' : 'Mark as done'}
        disabled={toggle.isPending}
        onClick={() =>
          toggle.mutate({
            taskId: task.task_id,
            status: done ? 'pending' : 'done',
            actualMinutes: done ? undefined : task.minutes,
          })
        }
        className="mt-px flex-shrink-0"
      >
        {toggle.isPending ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-500" />
        ) : done ? (
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
        ) : (
          <Circle className="w-3.5 h-3.5 text-gray-300 dark:text-gray-600 hover:text-indigo-400" />
        )}
      </button>
      <span
        className={cn(
          'flex-1 min-w-0 text-[11px] leading-snug',
          done
            ? 'text-gray-400 line-through'
            : 'text-gray-700 dark:text-gray-200',
        )}
      >
        {task.title}
      </span>
      <span className="flex-shrink-0 text-[10px] tabular-nums text-gray-400">
        {fmtMinutes(task.minutes)}
      </span>
    </li>
  );
}

/** No plan yet — the dashboard's prompt to make one. */
function StudyPlanEmptyCard() {
  return (
    <div className="rounded-2xl border border-indigo-100 dark:border-indigo-900/60 bg-indigo-50/50 dark:bg-indigo-950/20 p-4">
      <div className="flex items-start gap-2.5">
        <span
          className={cn(
            'flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center mt-px',
            ACCENT.indigo.chip,
          )}
        >
          <Wand2 className="w-4 h-4" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-bold text-gray-900 dark:text-gray-100 leading-snug">
            Build your study plan
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-gray-600 dark:text-gray-300">
            Tell us how long you have and which evenings you study. We'll turn the syllabus into a
            dated, day-by-day plan — weighted towards whatever your mock tests show you need most.
          </p>
          <Link
            to="/user/study-plan/new"
            className="mt-2.5 inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-indigo-700"
          >
            <Sparkles className="w-3.5 h-3.5" /> Create my plan
          </Link>
        </div>
      </div>
    </div>
  );
}

// ─── Report footer ────────────────────────────────────────────────────────────

/**
 * The call to action at the foot of an attempt report.
 *
 * Offers to build a plan from *this* attempt, or — when a plan already exists —
 * to re-tune the existing one against this newer result, which versions the plan
 * rather than replacing it.
 */
export function StudyPlanReportCta({ attemptId }: { attemptId: string }) {
  const { data, isLoading, unavailable } = useActiveStudyPlan();

  if (unavailable || isLoading) return null;

  const hasPlan = !!data;
  const isThisAttempt = data?.plan.basis.attempt_id === attemptId;

  if (isThisAttempt) {
    return (
      <div className="rounded-2xl border border-emerald-100 dark:border-emerald-900/60 bg-emerald-50/50 dark:bg-emerald-950/20 p-4 flex items-start gap-2.5">
        <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-px flex-shrink-0" />
        <div className="min-w-0">
          <p className="text-xs font-bold text-gray-900 dark:text-gray-100">
            Your study plan is already built from this attempt
          </p>
          <Link
            to="/user/study-plan"
            className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 hover:underline"
          >
            Open your plan <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-indigo-100 dark:border-indigo-900/60 bg-indigo-50/50 dark:bg-indigo-950/20 p-4">
      <div className="flex items-start gap-2.5">
        <span
          className={cn(
            'flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center mt-px',
            ACCENT.indigo.chip,
          )}
        >
          <CalendarCheck className="w-4 h-4" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-bold text-gray-900 dark:text-gray-100 leading-snug">
            {hasPlan ? 'Update your plan with this result' : 'Turn this report into a study plan'}
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-gray-600 dark:text-gray-300">
            {hasPlan
              ? 'Your plan was built on an earlier attempt. Re-tuning it moves subjects you have fixed down the list and brings the ones that slipped up — your completed work is kept.'
              : 'We build a dated, day-by-day plan around exactly the gaps this paper exposed, fitted to the days and hours you actually have.'}
          </p>
          <Link
            to={
              hasPlan
                ? `/user/study-plan?revise_from=${attemptId}`
                : `/user/study-plan/new?attempt=${attemptId}`
            }
            className="mt-2.5 inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-indigo-700"
          >
            <Sparkles className="w-3.5 h-3.5" />
            {hasPlan ? 'Re-tune my plan' : 'Build my study plan'}
          </Link>
        </div>
      </div>
    </div>
  );
}
