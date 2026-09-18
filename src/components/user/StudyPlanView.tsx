/**
 * The personalised study plan — reference screens 10, 11 and 12.
 *
 * A separate view rather than another card on the report, because this is an
 * action workspace: it spans weeks, it has day-level detail, and it is the thing a
 * student comes back to. Every figure comes from `buildStudyPlan`, which in turn
 * reads only the attempt's own priorities.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  FileText,
  Flag,
  Lightbulb,
  Sprout,
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
import { priorityBadge, weekDateRange, weekDates } from '@/lib/study-plan';

const fmtDayDate = (d: Date) => d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

type PlanTab = 'queue' | 'weekly' | 'daily';

const RANK_ACCENT: Accent[] = ['rose', 'amber', 'indigo', 'sky', 'violet'];

const fmtPct = (v: number | null) => (v == null ? '—' : `${v}%`);

export function StudyPlanView({ plan, onBack }: { plan: StudyPlan; onBack?: () => void }) {
  const [tab, setTab] = useState<PlanTab>('queue');

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
              { value: 'queue', label: 'Learning Queue' },
              { value: 'weekly', label: 'Weekly Plan' },
              { value: 'daily', label: 'Daily Plan' },
            ]}
          />
        </div>
      </ReportCard>

      {tab === 'queue' && <LearningQueue plan={plan} />}
      {tab === 'weekly' && <WeeklyPlan plan={plan} />}
      {tab === 'daily' && <DailyPlan plan={plan} />}
    </div>
  );
}

const BADGE_ACCENT: Record<'Highest' | 'High' | 'Medium', Accent> = {
  Highest: 'rose',
  High: 'amber',
  Medium: 'sky',
};

// ─── Learning Queue (mockup screen 7) ──────────────────────────────────────────

function LearningQueue({ plan }: { plan: StudyPlan }) {
  const navigate = useNavigate();

  if (plan.focusAreas.length === 0) {
    return (
      <ReportCard>
        <NotAvailable reason="This attempt did not produce a measured priority, so there is nothing to plan around yet." />
      </ReportCard>
    );
  }

  return (
    <div className="space-y-4">
      <ReportCard>
        <p className="text-lg font-extrabold text-[#1e2a5a] dark:text-gray-100">Your Personalised Study Plan</p>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">A focused plan to help you improve.</p>
      </ReportCard>

      <ReportCard flush>
        {plan.focusAreas.map((f, i) => {
          const badge = priorityBadge(f.rank);
          return (
            <div
              key={f.subjectId}
              className={cn(
                'flex items-center gap-3 px-4 sm:px-5 py-3.5',
                i > 0 && 'border-t border-gray-100 dark:border-gray-800',
              )}
            >
              <span
                className={cn(
                  'flex-shrink-0 w-7 h-7 rounded-full text-white text-[12px] font-bold flex items-center justify-center',
                )}
                style={{ background: ACCENT[RANK_ACCENT[i] ?? 'slate'].hex }}
              >
                {f.rank}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-bold text-[#1e2a5a] dark:text-gray-100 truncate">{f.name}</p>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-snug truncate">{f.headline}</p>
              </div>
              <span
                className={cn(
                  'flex-shrink-0 text-[10px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap',
                  ACCENT[BADGE_ACCENT[badge]].chip,
                )}
              >
                {badge} Priority
              </span>
              <button
                type="button"
                onClick={() => navigate(`/user/report/${plan.sourceAttemptId}/subjects/${f.subjectId}`)}
                className="flex-shrink-0 inline-flex items-center gap-1 text-[11px] font-semibold text-white bg-gradient-to-r from-indigo-600 to-purple-600 rounded-lg px-3 py-1.5 hover:from-indigo-700 hover:to-purple-700 whitespace-nowrap"
              >
                Open <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          );
        })}
      </ReportCard>

      {plan.queued.length > 0 && (
        <p className="text-[11px] text-gray-400 dark:text-gray-500">Queued for a later cycle: {plan.queued.join(', ')}.</p>
      )}

      <div className="rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900 p-3.5 flex items-center gap-2.5">
        <Sprout className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
        <p className="text-[12px] text-emerald-800 dark:text-emerald-200">
          This plan adapts automatically as you complete practice and assessments. Keep learning, keep improving!
        </p>
      </div>
    </div>
  );
}

// ─── Screen 11: weekly ─────────────────────────────────────────────────────────

function WeeklyPlan({ plan }: { plan: StudyPlan }) {
  const [week, setWeek] = useState(1);
  const dates = weekDates(week);

  return (
    <div className="space-y-4">
      <ReportCard>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <CalendarDays className="w-4 h-4" />
            </span>
            <div>
              <p className="text-base font-extrabold text-[#1e2a5a] dark:text-gray-100">
                Week {week} Plan ({weekDateRange(week)})
              </p>
              <p className="text-[12px] text-gray-500 dark:text-gray-400 mt-0.5">
                A realistic plan based on your learning queue.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
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
        </div>
      </ReportCard>

      <ReportCard flush>
        {plan.weekly.map((r, i) => (
          <div
            key={r.day}
            className={cn(
              'flex items-center gap-3 px-4 sm:px-5 py-3',
              i > 0 && 'border-t border-gray-100 dark:border-gray-800',
            )}
          >
            <div className="flex-shrink-0 w-14 text-center">
              <p className="text-[11px] font-bold text-[#1e2a5a] dark:text-gray-100">{r.day.slice(0, 3)}</p>
              <p className="text-[10px] text-gray-400">{fmtDayDate(dates[i])}</p>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-bold text-gray-900 dark:text-gray-100 truncate">{r.focus}</p>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-snug">{r.task}</p>
            </div>
            <span className="flex-shrink-0 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 rounded-lg px-2.5 py-1 whitespace-nowrap">
              ~{r.minutes} min
            </span>
          </div>
        ))}
      </ReportCard>

      <div className="rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900 p-3.5 flex items-start gap-2.5">
        <Lightbulb className="w-4 h-4 text-indigo-500 flex-shrink-0 mt-0.5" />
        <p className="text-[11px] text-indigo-700 dark:text-indigo-300">
          Adjust the plan based on your progress and time availability.
          {plan.overBudget && (
            <span className="text-amber-700 dark:text-amber-400">
              {' '}
              This week asks for more than {plan.constraints.minutesPerDay} minutes a day across{' '}
              {plan.constraints.daysPerWeek} days — trim the lowest priority if that is not realistic.
            </span>
          )}
        </p>
      </div>
    </div>
  );
}

// ─── Daily Plan (mockup screen 9) ──────────────────────────────────────────────

/** A short, mockup-matching label for each block kind — the real content is
 * `DailyBlock.label` underneath; this is just the section it falls into. */
const KIND_TITLE: Record<DailyBlock['kind'], string> = {
  concept: 'Learn',
  notes: 'Understand',
  practice: 'Practice',
  review: 'Review',
  quiz: 'Quick Quiz',
};

const KIND_ACCENT: Record<DailyBlock['kind'], Accent> = {
  concept: 'emerald',
  notes: 'sky',
  practice: 'indigo',
  review: 'emerald',
  quiz: 'violet',
};

function todayLabel(date: Date = new Date()): string {
  return date.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' });
}

function DailyPlan({ plan }: { plan: StudyPlan }) {
  const navigate = useNavigate();
  const top: FocusArea | undefined = plan.focusAreas[0];

  if (plan.daily.length === 0 || !top) {
    return (
      <ReportCard>
        <NotAvailable reason="A daily plan needs at least one measured priority from the attempt." />
      </ReportCard>
    );
  }

  const total = plan.daily.reduce((n, b) => n + b.minutes, 0);

  return (
    <div className="space-y-4">
      <ReportCard>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <CalendarDays className="w-4 h-4" />
            </span>
            <div>
              <p className="text-base font-extrabold text-[#1e2a5a] dark:text-gray-100">Today's Plan</p>
              <p className="text-[12px] text-gray-500 dark:text-gray-400 mt-0.5">{todayLabel()}</p>
            </div>
          </div>
          <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 rounded-lg px-2.5 py-1.5 whitespace-nowrap">
            Estimated time ~{total} min
          </span>
        </div>
      </ReportCard>

      <ReportCard>
        <ol className="space-y-3.5">
          {plan.daily.map((b, i) => (
            <li key={i} className="flex items-start gap-3">
              <span
                className="flex-shrink-0 w-7 h-7 rounded-full text-white text-[12px] font-bold flex items-center justify-center"
                style={{ background: ACCENT[KIND_ACCENT[b.kind]].hex }}
              >
                {i + 1}
              </span>
              <div className="min-w-0">
                <p className="text-[13px] font-bold text-gray-900 dark:text-gray-100">
                  {KIND_TITLE[b.kind]} ({b.minutes} min)
                </p>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-snug">{b.label}</p>
              </div>
            </li>
          ))}
        </ol>

        <button
          type="button"
          onClick={() => navigate('/user/practice')}
          className="mt-4 w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-[13px] font-semibold px-3.5 py-2.5 hover:from-indigo-700 hover:to-purple-700 transition-all"
        >
          Start Practice <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </ReportCard>

      <div className="rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900 p-3.5 flex items-center gap-2.5">
        <Sprout className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
        <p className="text-[12px] text-emerald-800 dark:text-emerald-200">
          Complete today's tasks to strengthen your concepts.
        </p>
      </div>
    </div>
  );
}
