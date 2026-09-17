/**
 * The personalised study plan — reference screens 10, 11 and 12.
 *
 * A separate view rather than another card on the report, because this is an
 * action workspace: it spans weeks, it has day-level detail, and it is the thing a
 * student comes back to. Every figure comes from `buildStudyPlan`, which in turn
 * reads only the attempt's own priorities.
 */
import { useState } from 'react';
import {
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  FileText,
  Flag,
  Target,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  ACCENT,
  NotAvailable,
  ReportCard,
  SectionHeader,
  StatTile,
  UnderlineTabs,
  type Accent,
} from '@/components/user/report-ui';
import type { DailyBlock, FocusArea, StudyPlan } from '@/lib/study-plan';

type PlanTab = 'overview' | 'weekly' | 'daily';

const RANK_ACCENT: Accent[] = ['rose', 'amber', 'indigo', 'sky', 'violet'];

const fmtPct = (v: number | null) => (v == null ? '—' : `${v}%`);

export function StudyPlanView({ plan, onBack }: { plan: StudyPlan; onBack?: () => void }) {
  const [tab, setTab] = useState<PlanTab>('overview');

  return (
    <div className="space-y-3 sm:space-y-4">
      <ReportCard>
        <SectionHeader
          icon={<Flag className="w-4 h-4" />}
          title="Personalised study plan"
          subtitle={`Based on ${plan.testName}`}
          action={
            onBack && (
              <button
                type="button"
                onClick={onBack}
                className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline whitespace-nowrap"
              >
                Back to report
              </button>
            )
          }
        />

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <StatTile value={fmtPct(plan.baseline.scorePct)} label="Baseline score" hint="From this attempt" />
          <StatTile value={fmtPct(plan.baseline.accuracy)} label="Accuracy" hint="Of questions attempted" />
          <StatTile value={fmtPct(plan.baseline.attemptRate)} label="Attempt rate" hint="Of the paper reached" />
          <StatTile
            value={`${plan.constraints.minutesPerDay} min`}
            label="Daily study time"
            hint={plan.constraints.budgetKnown ? 'Your recorded availability' : 'Suggested — not yet set'}
            accent="indigo"
            emphasis={!plan.constraints.budgetKnown}
          />
        </div>

        {!plan.constraints.budgetKnown && (
          <p className="mt-2.5 text-[10px] text-gray-400 dark:text-gray-500">
            No study-time budget is recorded for your account, so this is a suggested schedule rather than one
            fitted to your real availability.
          </p>
        )}

        <div className="mt-3">
          <UnderlineTabs<PlanTab>
            value={tab}
            onChange={setTab}
            options={[
              { value: 'overview', label: 'Overview' },
              { value: 'weekly', label: 'Weekly plan' },
              { value: 'daily', label: 'Daily plan' },
            ]}
          />
        </div>
      </ReportCard>

      {tab === 'overview' && <PlanOverview plan={plan} />}
      {tab === 'weekly' && <WeeklyPlan plan={plan} />}
      {tab === 'daily' && <DailyPlan plan={plan} />}
    </div>
  );
}

// ─── Screen 10: overview ───────────────────────────────────────────────────────

function PlanOverview({ plan }: { plan: StudyPlan }) {
  if (plan.focusAreas.length === 0) {
    return (
      <ReportCard>
        <NotAvailable reason="This attempt did not produce a measured priority, so there is nothing to plan around yet." />
      </ReportCard>
    );
  }

  return (
    <div className="grid lg:grid-cols-3 gap-3 sm:gap-4 items-start">
      <ReportCard className="lg:col-span-1">
        <SectionHeader icon={<Flag className="w-4 h-4" />} title="Priority focus areas" accent="rose" />
        <ol className="space-y-2">
          {plan.focusAreas.map((f, i) => (
            <li key={f.subjectId} className="rounded-xl border border-gray-100 dark:border-gray-800 p-2.5">
              <div className="flex items-start gap-2.5">
                <span
                  className={cn(
                    'flex-shrink-0 w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center mt-px',
                    ACCENT[RANK_ACCENT[i] ?? 'slate'].chip,
                  )}
                >
                  {f.rank}
                </span>
                <div className="min-w-0">
                  <p className="text-[11px] font-bold text-gray-900 dark:text-gray-100">{f.name}</p>
                  <p className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold">{f.archetypeLabel}</p>
                  <p className="text-[11px] text-gray-700 dark:text-gray-200 mt-1 leading-relaxed">{f.headline}</p>
                  <p className="text-[10px] text-gray-400 mt-1 tabular-nums">
                    {f.minutesPerSession} min × {f.sessionsPerWeek}/week · {f.questionTarget} questions
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ol>
        {plan.queued.length > 0 && (
          <p className="mt-2 text-[10px] text-gray-400">Queued for a later cycle: {plan.queued.join(', ')}.</p>
        )}
      </ReportCard>

      <ReportCard className="lg:col-span-1">
        <SectionHeader icon={<CalendarDays className="w-4 h-4" />} title={`${plan.weeks.length}-week overview`} />
        <ol className="space-y-2">
          {plan.weeks.map(w => (
            <li key={w.week} className="rounded-xl border border-gray-100 dark:border-gray-800 p-2.5">
              <p className="text-[11px] font-bold text-gray-900 dark:text-gray-100">
                Week {w.week} · {w.purpose}
              </p>
              <p className="text-[11px] text-gray-600 dark:text-gray-300 mt-0.5 leading-relaxed">{w.detail}</p>
            </li>
          ))}
        </ol>
      </ReportCard>

      <ReportCard className="lg:col-span-1">
        <SectionHeader icon={<Target className="w-4 h-4" />} title="Goal" accent="emerald" />
        <p className="text-xs font-bold text-gray-900 dark:text-gray-100 leading-snug">{plan.goal.headline}</p>
        <ul className="mt-2.5 space-y-1.5">
          {plan.goal.targets.map((t, i) => (
            <li key={i} className="flex items-start gap-2 text-[11px] text-gray-700 dark:text-gray-200">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0 mt-px" />
              {t}
            </li>
          ))}
        </ul>
        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 space-y-1.5">
          {plan.focusAreas.slice(0, 2).map(f => (
            <div key={f.subjectId}>
              <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">{f.name} — success</p>
              <p className="text-[11px] text-gray-700 dark:text-gray-200 leading-relaxed">{f.successCriterion}</p>
              <p className="text-[10px] text-gray-500 dark:text-gray-400 leading-relaxed mt-0.5">
                If missed: {f.escalation}
              </p>
            </div>
          ))}
        </div>
      </ReportCard>
    </div>
  );
}

// ─── Screen 11: weekly ─────────────────────────────────────────────────────────

function WeeklyPlan({ plan }: { plan: StudyPlan }) {
  const [week, setWeek] = useState(1);

  return (
    <ReportCard flush>
      <div className="p-4 sm:p-5 pb-0">
        <SectionHeader
          icon={<CalendarDays className="w-4 h-4" />}
          title={`Week ${week} plan`}
          subtitle={`${plan.weeklyMinutes} minutes across ${plan.weekly.filter(r => r.minutes > 0).length} days`}
          action={
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setWeek(w => Math.max(1, w - 1))}
                disabled={week === 1}
                className="p-1 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40"
                aria-label="Previous week"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setWeek(w => Math.min(plan.weeks.length, w + 1))}
                disabled={week >= plan.weeks.length}
                className="p-1 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40"
                aria-label="Next week"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          }
        />
        <p className="text-[11px] text-gray-600 dark:text-gray-300 mb-3">
          {plan.weeks.find(w => w.week === week)?.detail}
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-[11px] min-w-[640px]">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-800/60 text-left">
              {['Day', 'Focus', 'Task', 'Resources', 'Practice', 'Time'].map((h, i) => (
                <th
                  key={h}
                  className={cn(
                    'px-3 py-2 font-semibold text-gray-500 dark:text-gray-400 whitespace-nowrap',
                    i >= 4 && 'text-right',
                  )}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {plan.weekly.map(r => (
              <tr key={r.day} className="border-b border-gray-50 dark:border-gray-800/60">
                <td className="px-3 py-2.5 font-semibold text-gray-900 dark:text-gray-100 whitespace-nowrap">
                  {r.day}
                </td>
                <td className="px-3 py-2.5 text-gray-700 dark:text-gray-200">{r.focus}</td>
                <td className="px-3 py-2.5 text-gray-600 dark:text-gray-300">{r.task}</td>
                <td className="px-3 py-2.5 text-gray-500 dark:text-gray-400">{r.resources}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-gray-600 dark:text-gray-300">
                  {r.questions > 0 ? `${r.questions} Qs` : '—'}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums text-gray-600 dark:text-gray-300">
                  {r.minutes > 0 ? `${r.minutes} min` : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="px-4 sm:px-5 py-3 border-t border-gray-100 dark:border-gray-800">
        <p className="text-[10px] leading-relaxed text-gray-500 dark:text-gray-400">
          Built from your ranked priorities, not a template — the top gap appears twice with a spaced revisit,
          and time scales with priority rather than being split evenly.
          {plan.overBudget && (
            <span className="text-amber-700 dark:text-amber-400">
              {' '}
              This week asks for more than {plan.constraints.minutesPerDay} minutes a day across{' '}
              {plan.constraints.daysPerWeek} days — trim the lowest priority if that is not realistic.
            </span>
          )}
        </p>
      </div>
    </ReportCard>
  );
}

// ─── Screen 12: daily ──────────────────────────────────────────────────────────

const KIND_ICON: Record<DailyBlock['kind'], React.ReactNode> = {
  concept: <BookOpen className="w-3.5 h-3.5" />,
  notes: <FileText className="w-3.5 h-3.5" />,
  practice: <Target className="w-3.5 h-3.5" />,
  review: <CheckCircle2 className="w-3.5 h-3.5" />,
  quiz: <Flag className="w-3.5 h-3.5" />,
};

function DailyPlan({ plan }: { plan: StudyPlan }) {
  const [done, setDone] = useState<Set<number>>(new Set());
  const top: FocusArea | undefined = plan.focusAreas[0];

  if (plan.daily.length === 0 || !top) {
    return (
      <ReportCard>
        <NotAvailable reason="A daily plan needs at least one measured priority from the attempt." />
      </ReportCard>
    );
  }

  const total = plan.daily.reduce((n, b) => n + b.minutes, 0);
  const completed = plan.daily.filter((_, i) => done.has(i)).reduce((n, b) => n + b.minutes, 0);

  return (
    <div className="grid lg:grid-cols-[1.4fr_1fr] gap-3 sm:gap-4 items-start">
      <ReportCard>
        <SectionHeader
          icon={<CalendarDays className="w-4 h-4" />}
          title="A day on this plan"
          subtitle={`${total} minutes · ${top.name} is today's focus`}
          action={
            <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 tabular-nums">
              {completed}/{total} min
            </span>
          }
        />
        <ul className="space-y-2">
          {plan.daily.map((b, i) => {
            const isDone = done.has(i);
            return (
              <li key={i}>
                <button
                  type="button"
                  onClick={() =>
                    setDone(prev => {
                      const next = new Set(prev);
                      next.has(i) ? next.delete(i) : next.add(i);
                      return next;
                    })
                  }
                  className={cn(
                    'w-full flex items-center gap-2.5 rounded-xl border p-2.5 text-left transition-colors',
                    isDone
                      ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/60 dark:bg-emerald-950/30'
                      : 'border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/60',
                  )}
                >
                  {isDone ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                  ) : (
                    <Circle className="w-4 h-4 text-gray-300 dark:text-gray-600 flex-shrink-0" />
                  )}
                  <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 tabular-nums w-14 flex-shrink-0">
                    {b.minutes} min
                  </span>
                  <span
                    className={cn(
                      'text-[11px] flex-1 min-w-0',
                      isDone ? 'text-gray-400 line-through' : 'text-gray-800 dark:text-gray-200',
                    )}
                  >
                    {b.label}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        {/* Ticking a block is local to this browser: there is no endpoint to store
            plan progress yet, so nothing here survives a refresh. */}
        <p className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 text-[10px] text-gray-400 dark:text-gray-500">
          Ticking a task is not saved yet — plan progress has nowhere to be stored.
        </p>
      </ReportCard>

      <ReportCard>
        <SectionHeader icon={<BookOpen className="w-4 h-4" />} title="Today's focus" accent="indigo" />
        <p className="text-xs font-bold text-gray-900 dark:text-gray-100">{top.name}</p>
        <p className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold">{top.archetypeLabel}</p>
        <p className="text-[11px] text-gray-700 dark:text-gray-200 mt-1.5 leading-relaxed">{top.headline}</p>
        <p className="text-[10px] text-gray-400 mt-1 tabular-nums">{top.evidence}</p>

        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
          <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1.5">Success criterion</p>
          <p className="text-[11px] text-gray-700 dark:text-gray-200 leading-relaxed">{top.successCriterion}</p>
          <p className="text-[10px] text-gray-500 dark:text-gray-400 leading-relaxed mt-1.5">
            <span className="font-semibold">If missed: </span>
            {top.escalation}
          </p>
        </div>

        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
          <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1.5">Blocks</p>
          <ul className="space-y-1">
            {plan.daily.map((b, i) => (
              <li key={i} className="flex items-center gap-2 text-[11px] text-gray-600 dark:text-gray-300">
                <span className="w-5 h-5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center flex-shrink-0">
                  {KIND_ICON[b.kind]}
                </span>
                {b.label}
              </li>
            ))}
          </ul>
        </div>
      </ReportCard>
    </div>
  );
}
