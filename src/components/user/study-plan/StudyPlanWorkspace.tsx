/**
 * The study-plan workspace — overview, this week, and the full schedule.
 *
 * Everything on screen is a field of the server's plan payload. Where the server
 * sent no narrative (`narrative_source: 'deterministic'`, or a null `theme`), the
 * view falls back to the deterministic label rather than hiding the section — the
 * same degradation rule the attempt report's LLM insights follow.
 */
import { useState } from 'react';
import {
  AlertTriangle,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  Flag,
  Flame,
  Layers,
  Target,
  TrendingUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  ACCENT,
  MeterRow,
  NotAvailable,
  ReportCard,
  SectionHeader,
  StatTile,
  UnderlineTabs,
  type Accent,
} from '@/components/user/report-ui';
import type { PlanDay, PlanPhase, StudyPlan } from '@/lib/studyPlanApi';
import { DayDetail, WeekBoard } from './WeekBoard';
import {
  MiniRing,
  VERDICT,
  fmtDate,
  fmtHours,
  fmtMinutes,
  fmtRange,
  todayISO,
} from './plan-ui';

type Tab = 'overview' | 'week' | 'schedule';

const RANK_ACCENT: Accent[] = ['rose', 'amber', 'indigo', 'sky', 'violet'];

export function StudyPlanWorkspace({
  plan,
  today,
  action,
}: {
  plan: StudyPlan;
  today?: PlanDay | null;
  /** Caller-supplied controls (regenerate, pause) — kept out of this component. */
  action?: React.ReactNode;
}) {
  const [tab, setTab] = useState<Tab>('overview');
  const daysLeft = daysBetween(todayISO(), plan.exam_date ?? plan.end_date);

  return (
    <div className="space-y-3 sm:space-y-4">
      <ReportCard>
        <SectionHeader
          icon={<Flag className="w-4 h-4" />}
          title={plan.goal.headline || 'Your study plan'}
          subtitle={`${plan.stage_name} · ${fmtRange(plan.start_date, plan.end_date)}${plan.version > 1 ? ` · revision ${plan.version}` : ''}`}
          action={action}
        />

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <StatTile
            value={daysLeft != null ? `${daysLeft}` : '—'}
            label={plan.exam_date ? 'Days to the exam' : 'Days remaining'}
            hint={plan.exam_date ? fmtDate(plan.exam_date) : fmtDate(plan.end_date)}
            accent="rose"
            emphasis
          />
          <StatTile
            value={`${plan.coverage.pct}%`}
            label="Syllabus covered"
            hint={`${plan.coverage.topics_touched} of ${plan.coverage.topics_total} topics`}
            accent="emerald"
          />
          <StatTile
            value={`${plan.adherence.pct}%`}
            label={`Adherence · ${plan.adherence.window_days}d`}
            hint={
              plan.adherence.streak_days > 0
                ? `${plan.adherence.streak_days}-day streak`
                : 'No streak yet'
            }
            accent="amber"
          />
          <StatTile
            value={fmtHours(plan.totals.planned_minutes)}
            label="Total study time"
            hint={`${plan.totals.study_days} study days · ${plan.totals.mocks} mocks`}
            accent="indigo"
          />
        </div>

        {plan.feasibility !== 'comfortable' && (
          <div
            className={cn(
              'mt-3 rounded-xl border p-2.5 flex items-start gap-2',
              plan.feasibility === 'not_feasible'
                ? 'border-rose-200 dark:border-rose-900 bg-rose-50/70 dark:bg-rose-950/30'
                : 'border-amber-200 dark:border-amber-900 bg-amber-50/70 dark:bg-amber-950/30',
            )}
          >
            <AlertTriangle
              className={cn(
                'w-3.5 h-3.5 mt-px flex-shrink-0',
                plan.feasibility === 'not_feasible' ? 'text-rose-500' : 'text-amber-500',
              )}
            />
            <p className="text-[10px] leading-relaxed text-gray-700 dark:text-gray-200">
              <span className="font-bold">
                {VERDICT[plan.feasibility].label}:{' '}
              </span>
              {VERDICT[plan.feasibility].blurb} Increasing your daily time or adding a study day
              would give this plan more room.
            </p>
          </div>
        )}

        <div className="mt-3">
          <UnderlineTabs<Tab>
            value={tab}
            onChange={setTab}
            options={[
              { value: 'overview', label: 'Overview' },
              { value: 'week', label: 'This week' },
              { value: 'schedule', label: 'Full schedule' },
            ]}
          />
        </div>
      </ReportCard>

      {tab === 'overview' && <Overview plan={plan} today={today} />}
      {tab === 'week' && <WeekBoard plan={plan} />}
      {tab === 'schedule' && <FullSchedule plan={plan} />}
    </div>
  );
}

// ─── Overview ─────────────────────────────────────────────────────────────────

function Overview({ plan, today }: { plan: StudyPlan; today?: PlanDay | null }) {
  return (
    <div className="space-y-3 sm:space-y-4">
      {today && <DayDetail planId={plan.plan_id} day={today} />}

      {plan.goal.targets.length > 0 && (
        <ReportCard>
          <SectionHeader
            icon={<Target className="w-4 h-4" />}
            title="What this plan is aiming at"
            subtitle={
              plan.basis.attempt_id
                ? `Built from ${plan.basis.test_name ?? 'your last mock'}${plan.basis.percentage != null ? ` (${plan.basis.percentage}%)` : ''}`
                : 'Built from the exam’s own mark distribution'
            }
          />
          <ul className="space-y-1.5">
            {plan.goal.targets.map((t, i) => (
              <li key={i} className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400 mt-px flex-shrink-0" />
                <span className="text-[11px] leading-relaxed text-gray-700 dark:text-gray-200">
                  {t}
                </span>
              </li>
            ))}
          </ul>
        </ReportCard>
      )}

      <PhaseTimeline phases={plan.phases} />
      <CoveragePanel plan={plan} />
    </div>
  );
}

// ─── Phase timeline ───────────────────────────────────────────────────────────

export function PhaseTimeline({ phases }: { phases: PlanPhase[] }) {
  const todayStr = todayISO();

  if (phases.length === 0) {
    return (
      <ReportCard>
        <NotAvailable reason="This plan has no phases recorded." />
      </ReportCard>
    );
  }

  return (
    <ReportCard>
      <SectionHeader
        icon={<Layers className="w-4 h-4" />}
        title="How the plan is staged"
        subtitle="Each phase changes the balance of concepts, practice and mocks"
      />

      <ol className="space-y-2">
        {phases.map((p, i) => {
          const current = todayStr >= p.start_date && todayStr <= p.end_date;
          const past = todayStr > p.end_date;
          const accent = RANK_ACCENT[i % RANK_ACCENT.length];

          return (
            <li
              key={p.phase_id}
              className={cn(
                'rounded-xl border p-3',
                current
                  ? cn(ACCENT[accent].ring, ACCENT[accent].wash)
                  : 'border-gray-100 dark:border-gray-800',
                past && 'opacity-60',
              )}
            >
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div className="min-w-0">
                  <p className="text-[11px] font-bold text-gray-900 dark:text-gray-100">
                    <span className={cn('mr-1.5', ACCENT[accent].text)}>{i + 1}.</span>
                    {p.label}
                    {current && (
                      <span
                        className={cn(
                          'ml-2 rounded-full px-1.5 py-0.5 text-[9px] font-bold',
                          ACCENT[accent].chip,
                        )}
                      >
                        Now
                      </span>
                    )}
                  </p>
                  {/* theme is LLM-written; label alone carries the row without it. */}
                  {p.theme && (
                    <p className="mt-0.5 text-[10px] leading-relaxed text-gray-600 dark:text-gray-300">
                      {p.theme}
                    </p>
                  )}
                </div>
                <span className="flex-shrink-0 text-[10px] tabular-nums text-gray-400">
                  {fmtRange(p.start_date, p.end_date)}
                </span>
              </div>

              {p.goal && (
                <p className="mt-1.5 text-[10px] leading-relaxed text-gray-500 dark:text-gray-400">
                  <span className="font-semibold">Goal: </span>
                  {p.goal}
                </p>
              )}
              <p className="mt-1 text-[9px] text-gray-400">
                {p.week_nos.length} week{p.week_nos.length === 1 ? '' : 's'}
              </p>
            </li>
          );
        })}
      </ol>
    </ReportCard>
  );
}

// ─── Coverage ─────────────────────────────────────────────────────────────────

function CoveragePanel({ plan }: { plan: StudyPlan }) {
  const subjects = plan.coverage.by_subject;

  return (
    <ReportCard>
      <SectionHeader
        icon={<TrendingUp className="w-4 h-4" />}
        title="Syllabus coverage"
        subtitle="Every subject the plan schedules, and how far through it you are"
        action={
          plan.adherence.streak_days > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400">
              <Flame className="w-3 h-3" /> {plan.adherence.streak_days}-day streak
            </span>
          )
        }
      />

      {subjects.length === 0 ? (
        <NotAvailable reason="No per-subject coverage has been recorded for this plan." />
      ) : (
        <div className="flex items-start gap-4">
          <div className="hidden sm:flex flex-col items-center gap-1 pt-1">
            <MiniRing pct={plan.coverage.pct} size={64} accent="emerald" />
            <span className="text-[9px] text-gray-400">covered</span>
          </div>

          <div className="min-w-0 flex-1 space-y-2.5">
            {subjects.map(s => {
              const pct =
                s.topics_planned > 0
                  ? Math.round((s.topics_completed / s.topics_planned) * 100)
                  : 0;
              const accent: Accent =
                s.priority_rank != null
                  ? RANK_ACCENT[(s.priority_rank - 1) % RANK_ACCENT.length]
                  : 'slate';

              return (
                <div key={s.subject_id}>
                  <MeterRow
                    label={
                      <span className="flex items-center gap-1.5">
                        {s.name}
                        {s.priority_rank != null && (
                          <span
                            className={cn(
                              'rounded px-1 py-px text-[9px] font-bold',
                              ACCENT[accent].chip,
                            )}
                          >
                            Priority {s.priority_rank}
                          </span>
                        )}
                      </span>
                    }
                    value={pct}
                    accent={accent}
                    right={`${s.topics_completed}/${s.topics_planned} topics · ${fmtHours(s.planned_minutes)}`}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {plan.narrative_source === 'deterministic' && (
        <p className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 text-[10px] text-gray-400 leading-relaxed">
          The wording in this plan is generated from your figures rather than written for you —
          the schedule itself is unaffected.
        </p>
      )}
    </ReportCard>
  );
}

// ─── Full schedule ────────────────────────────────────────────────────────────

function FullSchedule({ plan }: { plan: StudyPlan }) {
  const todayStr = todayISO();

  return (
    <ReportCard flush>
      <div className="p-4 sm:p-5 pb-0">
        <SectionHeader
          icon={<CalendarDays className="w-4 h-4" />}
          title="Every week to the exam"
          subtitle={`${plan.totals.weeks} weeks · ${fmtRange(plan.start_date, plan.end_date)}`}
        />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-y border-gray-100 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-800/40">
              {['Week', 'Dates', 'Focus', 'Time', 'Progress'].map(h => (
                <th
                  key={h}
                  className="px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400 whitespace-nowrap"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {plan.weeks.map(w => {
              const current = todayStr >= w.start_date && todayStr <= w.end_date;
              const pct =
                w.progress.planned_minutes > 0
                  ? Math.round(
                      (w.progress.completed_minutes / w.progress.planned_minutes) * 100,
                    )
                  : 0;

              return (
                <tr
                  key={w.week_id}
                  className={cn(
                    'border-b border-gray-50 dark:border-gray-800/60',
                    current && ACCENT.indigo.wash,
                    w.detail_status === 'outline' && 'opacity-70',
                  )}
                >
                  <td className="px-3 py-2 align-top whitespace-nowrap">
                    <span className="text-[11px] font-bold text-gray-800 dark:text-gray-100">
                      {w.week_no}
                    </span>
                    {current && (
                      <span className="ml-1.5 rounded-full bg-indigo-600 px-1.5 py-px text-[8px] font-bold text-white">
                        Now
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 align-top whitespace-nowrap text-[10px] tabular-nums text-gray-500 dark:text-gray-400">
                    {fmtRange(w.start_date, w.end_date)}
                  </td>
                  <td className="px-3 py-2 align-top min-w-[200px]">
                    <p className="text-[11px] font-semibold text-gray-800 dark:text-gray-100 leading-snug">
                      {w.theme}
                    </p>
                    {w.narrative && (
                      <p className="mt-0.5 text-[10px] leading-relaxed text-gray-500 dark:text-gray-400">
                        {w.narrative}
                      </p>
                    )}
                    {w.detail_status === 'outline' && (
                      <p className="mt-0.5 inline-flex items-center gap-1 text-[9px] text-gray-400">
                        <CalendarClock className="w-2.5 h-2.5" /> Day detail filled in nearer the
                        time
                      </p>
                    )}
                  </td>
                  <td className="px-3 py-2 align-top whitespace-nowrap text-[10px] tabular-nums text-gray-600 dark:text-gray-300">
                    {fmtMinutes(w.target_minutes)}
                  </td>
                  <td className="px-3 py-2 align-top w-28">
                    {w.progress.planned_minutes > 0 ? (
                      <MeterRow
                        label=""
                        value={pct}
                        accent={pct >= 100 ? 'emerald' : pct > 0 ? 'amber' : 'slate'}
                        right={`${pct}%`}
                      />
                    ) : (
                      <span className="text-[10px] text-gray-400">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {plan.weeks.length === 0 && (
        <div className="p-4 sm:p-5">
          <NotAvailable reason="This plan has no weeks recorded." />
        </div>
      )}
    </ReportCard>
  );
}

// ─── Local helper ─────────────────────────────────────────────────────────────

/** Whole days between two ISO dates. Display only — no scheduling depends on it. */
function daysBetween(fromISO: string, toISO: string | null): number | null {
  if (!toISO) return null;
  const a = new Date(`${fromISO}T00:00:00`);
  const b = new Date(`${toISO}T00:00:00`);
  const n = Math.round((b.getTime() - a.getTime()) / 86_400_000);
  return n < 0 ? 0 : n;
}
