/**
 * One week of the plan, and the day detail underneath it.
 *
 * The only arithmetic here is which seven dates to ask the server for — the day
 * rows, their tasks, their minutes and their order all arrive as sent. Rest days
 * come back from the API as real rows with no tasks, so the seven columns are
 * never reconstructed locally from `study_days`.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  Clock,
  Hourglass,
  Loader2,
  MinusCircle,
  Moon,
  PlayCircle,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { ACCENT, NotAvailable, ReportCard, SectionHeader } from '@/components/user/report-ui';
import { useStudyPlanDays, useTaskToggle, useWeekWindow } from '@/hooks/use-study-plan';
import { taskTestHref, type PlanDay, type PlanTask, type StudyPlan, type TaskStatus } from '@/lib/studyPlanApi';
import {
  DAY_STATUS,
  TaskKindChip,
  fmtDate,
  fmtMinutes,
  fmtRange,
  todayISO,
} from './plan-ui';

export function WeekBoard({ plan }: { plan: StudyPlan }) {
  const today = todayISO();
  // Anchor on today when the plan is under way, otherwise on its first day — a
  // plan starting next Monday should open on week 1, not on an empty this-week.
  const anchor = today < plan.start_date ? plan.start_date : today;
  const win = useWeekWindow(anchor);
  const { days, outlineFrom, isLoading, error } = useStudyPlanDays(plan.plan_id, win.from, win.to);

  const [selected, setSelected] = useState<string | null>(null);

  /**
   * Follow the week: landing on a new one opens today if it is in range, else that
   * week's first working day.
   *
   * Guarded on the selection still being in range rather than on `days` changing.
   * Ticking a task patches the cached day rows optimistically, which hands back a
   * fresh array — re-selecting on every such change would throw the candidate
   * from the day they are working on back to today mid-tick.
   */
  useEffect(() => {
    if (days.length === 0) return;
    if (selected && days.some(d => d.date === selected)) return;
    const inRange = days.find(d => d.date === today);
    const firstWorking = days.find(d => !d.is_rest);
    setSelected((inRange ?? firstWorking ?? days[0]).date);
  }, [days, selected, today]);

  const selectedDay = useMemo(
    () => days.find(d => d.date === selected) ?? null,
    [days, selected],
  );

  const weekNo = days[0]?.week_no ?? null;
  const weekMeta = weekNo != null ? plan.weeks.find(w => w.week_no === weekNo) : undefined;
  const planned = days.reduce((n, d) => n + d.planned_minutes, 0);
  const completed = days.reduce((n, d) => n + d.completed_minutes, 0);

  return (
    <div className="space-y-3 sm:space-y-4">
      <ReportCard>
        <SectionHeader
          icon={<CalendarClock className="w-4 h-4" />}
          title={weekNo != null ? `Week ${weekNo}` : 'This week'}
          subtitle={weekMeta?.theme ?? fmtRange(win.from, win.to)}
          action={
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={win.prev}
                aria-label="Previous week"
                className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/60"
              >
                <ChevronLeft className="w-3.5 h-3.5 text-gray-500" />
              </button>
              {win.offset !== 0 && (
                <button
                  type="button"
                  onClick={win.reset}
                  className="px-2 py-1 rounded-lg border border-gray-200 dark:border-gray-800 text-[10px] font-semibold text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800/60"
                >
                  Today
                </button>
              )}
              <button
                type="button"
                onClick={win.next}
                aria-label="Next week"
                className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/60"
              >
                <ChevronRight className="w-3.5 h-3.5 text-gray-500" />
              </button>
            </div>
          }
        />

        {weekMeta?.narrative && (
          <p className="mb-3 text-[11px] leading-relaxed text-gray-600 dark:text-gray-300">
            {weekMeta.narrative}
          </p>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />
          </div>
        ) : error ? (
          <NotAvailable reason={error.message} />
        ) : days.length === 0 ? (
          <NotAvailable
            reason={
              outlineFrom
                ? `This week is planned in outline only — detailed tasks are filled in nearer the time (from ${fmtDate(outlineFrom)}).`
                : 'This week falls outside your plan.'
            }
          />
        ) : (
          <>
            <div className="grid grid-cols-7 gap-1.5">
              {days.map(d => (
                <DayColumn
                  key={d.date}
                  day={d}
                  isToday={d.date === today}
                  selected={d.date === selected}
                  onSelect={() => setSelected(d.date)}
                />
              ))}
            </div>

            <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between text-[11px]">
              <span className="text-gray-500 dark:text-gray-400">
                {fmtRange(win.from, win.to)}
              </span>
              <span className="tabular-nums font-semibold text-gray-700 dark:text-gray-200">
                {fmtMinutes(completed)} of {fmtMinutes(planned)} done
              </span>
            </div>
          </>
        )}

        {outlineFrom && days.length > 0 && (
          <p className="mt-2 text-[10px] text-gray-400 leading-snug">
            Days from {fmtDate(outlineFrom)} are planned in outline. They are filled in with
            day-level tasks nearer the time, so they can take account of the mocks you sit between
            now and then.
          </p>
        )}
      </ReportCard>

      {selectedDay && <DayDetail planId={plan.plan_id} day={selectedDay} />}
    </div>
  );
}

// ─── One column of the week strip ─────────────────────────────────────────────

function DayColumn({
  day,
  isToday,
  selected,
  onSelect,
}: {
  day: PlanDay;
  isToday: boolean;
  selected: boolean;
  onSelect: () => void;
}) {
  const tone = DAY_STATUS[day.status];
  const pct =
    day.planned_minutes > 0
      ? Math.min(100, Math.round((day.completed_minutes / day.planned_minutes) * 100))
      : 0;

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={isToday ? 'date' : undefined}
      className={cn(
        'rounded-xl border p-1.5 sm:p-2 text-center transition-colors min-w-0',
        selected
          ? cn(ACCENT.indigo.ring, ACCENT.indigo.wash)
          : 'border-gray-100 dark:border-gray-800 hover:border-indigo-200 dark:hover:border-indigo-900',
        day.is_rest && !selected && 'bg-gray-50/70 dark:bg-gray-800/30',
      )}
    >
      <span className="block text-[9px] font-semibold uppercase tracking-wide text-gray-400">
        {fmtDate(day.date, 'EEE')}
      </span>
      <span
        className={cn(
          'block text-sm font-bold leading-tight',
          isToday ? ACCENT.indigo.text : 'text-gray-800 dark:text-gray-100',
        )}
      >
        {fmtDate(day.date, 'd')}
      </span>

      {day.is_rest ? (
        <Moon className="w-3 h-3 mx-auto mt-1 text-gray-300 dark:text-gray-600" />
      ) : (
        <>
          <span className="mt-1 block h-1 rounded bg-gray-100 dark:bg-gray-800 overflow-hidden">
            <span
              className={cn('block h-full rounded', ACCENT[tone.accent].bar)}
              style={{ width: `${pct}%` }}
            />
          </span>
          <span className="mt-1 block text-[9px] tabular-nums text-gray-400 truncate">
            {fmtMinutes(day.planned_minutes)}
          </span>
        </>
      )}
    </button>
  );
}

// ─── The selected day ─────────────────────────────────────────────────────────

export function DayDetail({ planId, day }: { planId: string; day: PlanDay }) {
  if (day.is_rest) {
    return (
      <ReportCard>
        <div className="py-6 text-center">
          <Moon className="w-6 h-6 mx-auto text-gray-300 dark:text-gray-600" />
          <p className="mt-2 text-xs font-semibold text-gray-700 dark:text-gray-200">
            {fmtDate(day.date, 'EEEE d MMMM')} — rest day
          </p>
          <p className="mt-0.5 text-[11px] text-gray-400">
            You left this day out of your week. Nothing is scheduled.
          </p>
        </div>
      </ReportCard>
    );
  }

  return (
    <ReportCard>
      <SectionHeader
        icon={<Clock className="w-4 h-4" />}
        title={fmtDate(day.date, 'EEEE d MMMM')}
        subtitle={`${day.tasks.length} task${day.tasks.length === 1 ? '' : 's'} · ${fmtMinutes(day.planned_minutes)} planned`}
        action={
          <span className="text-[11px] tabular-nums font-semibold text-gray-600 dark:text-gray-300">
            {fmtMinutes(day.completed_minutes)} done
          </span>
        }
      />

      {day.tasks.length === 0 ? (
        <NotAvailable reason="No tasks are scheduled for this day yet." />
      ) : (
        <ul className="space-y-2">
          {day.tasks.map(t => (
            <TaskRow key={t.task_id} planId={planId} task={t} />
          ))}
        </ul>
      )}
    </ReportCard>
  );
}

// ─── One task ─────────────────────────────────────────────────────────────────

const NEXT_STATUS: Record<TaskStatus, TaskStatus> = {
  pending: 'done',
  done: 'pending',
  partial: 'done',
  skipped: 'pending',
};

export function TaskRow({ planId, task }: { planId: string; task: PlanTask }) {
  const toggle = useTaskToggle(planId);
  const done = task.status === 'done';
  const skipped = task.status === 'skipped';
  const href = taskTestHref(task);

  return (
    <li
      className={cn(
        'rounded-xl border p-2.5 transition-colors',
        done
          ? 'border-emerald-100 dark:border-emerald-900/60 bg-emerald-50/40 dark:bg-emerald-950/20'
          : 'border-gray-100 dark:border-gray-800',
        skipped && 'opacity-60',
      )}
    >
      <div className="flex items-start gap-2.5">
        <button
          type="button"
          aria-label={done ? 'Mark as not done' : 'Mark as done'}
          aria-pressed={done}
          disabled={toggle.isPending}
          onClick={() =>
            toggle.mutate({
              taskId: task.task_id,
              status: NEXT_STATUS[task.status],
              actualMinutes: NEXT_STATUS[task.status] === 'done' ? task.minutes : undefined,
            })
          }
          className="mt-px flex-shrink-0"
        >
          {toggle.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
          ) : done ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          ) : skipped ? (
            <MinusCircle className="w-4 h-4 text-rose-400" />
          ) : (
            <Circle className="w-4 h-4 text-gray-300 dark:text-gray-600 hover:text-indigo-400" />
          )}
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <p
              className={cn(
                'text-[11px] font-semibold leading-snug',
                done
                  ? 'text-gray-500 dark:text-gray-400 line-through'
                  : 'text-gray-800 dark:text-gray-100',
              )}
            >
              {task.title}
            </p>
            <span className="flex-shrink-0 inline-flex items-center gap-1 text-[10px] tabular-nums font-semibold text-gray-500 dark:text-gray-400">
              <Hourglass className="w-3 h-3" />
              {fmtMinutes(task.minutes)}
            </span>
          </div>

          <div className="mt-1 flex items-center gap-1.5 flex-wrap">
            <TaskKindChip kind={task.kind} />
            <span className="text-[10px] text-gray-400 truncate">
              {task.topic_name ? `${task.subject_name} · ${task.topic_name}` : task.subject_name}
            </span>
            {task.question_target > 0 && (
              <span className="text-[10px] tabular-nums text-gray-400">
                {task.question_target} questions
              </span>
            )}
          </div>

          {task.coaching_note && (
            <p className="mt-1.5 text-[10px] leading-relaxed text-indigo-700 dark:text-indigo-300">
              {task.coaching_note}
            </p>
          )}

          {task.success_criterion && (
            <p className="mt-1 text-[10px] leading-relaxed text-gray-500 dark:text-gray-400">
              <span className="font-semibold">Done when: </span>
              {task.success_criterion}
            </p>
          )}

          <div className="mt-1.5 flex items-center gap-2 flex-wrap">
            {/* A task bound to a real test is one click from being started. That
                link is most of what separates a plan from homework prose. */}
            {href && (
              <Link
                to={href}
                className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-2 py-1 text-[10px] font-bold text-white hover:bg-indigo-700"
              >
                <PlayCircle className="w-3 h-3" /> Start this test
              </Link>
            )}
            {!done && !skipped && (
              <button
                type="button"
                onClick={() => toggle.mutate({ taskId: task.task_id, status: 'skipped' })}
                className="text-[10px] font-semibold text-gray-400 hover:text-rose-500"
              >
                Skip
              </button>
            )}
            {task.resource_ref && !href && (
              <span className="text-[10px] text-gray-400">{task.resource_ref}</span>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}
