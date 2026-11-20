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
  BarChart3,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  Flag,
  Flame,
  Layers,
  Loader2,
  PieChart,
  Target,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { bilingual, studentTitle } from '@/lib/bilingual';
import {
  ACCENT,
  MeterRow,
  NotAvailable,
  ReportCard,
  UnderlineTabs,
  type Accent,
} from '@/components/user/report-ui';
import type { PlanDay, PlanPhase, StudyPlan } from '@/lib/studyPlanApi';
import { DayDetail, WeekBoard, WeekStrip, useWeekSelection } from './WeekBoard';
import {
  MiniRing,
  PanelHeader,
  VERDICT,
  fmtDate,
  fmtHours,
  fmtMinutes,
  fmtRange,
  todayISO,
} from './plan-ui';
import { useT } from '@/content/useText';

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
  const t = useT();
  const [tab, setTab] = useState<Tab>('overview');
  const daysLeft = daysBetween(todayISO(), plan.exam_date ?? plan.end_date);

  return (
    <div className="space-y-3 sm:space-y-4">
      <ReportCard className="sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <span className={cn('flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl', ACCENT.indigo.chip)}>
              <Flag className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h1 className="text-lg font-bold leading-snug text-gray-900 dark:text-gray-100 sm:text-xl">
                {plan.goal.headline || t('reports.plan.workspace.title')}
              </h1>
              <p className="mt-0.5 text-[13px] text-gray-500 dark:text-gray-400">
                {`${plan.stage_name} · ${fmtRange(plan.start_date, plan.end_date)}${plan.version > 1 ? ` · revision ${plan.version}` : ''}`}
              </p>
            </div>
          </div>
          {action}
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <PlanTile
            icon={CalendarDays}
            tone="rose"
            value={daysLeft != null ? `${daysLeft}` : '—'}
            label={plan.exam_date ? t('reports.plan.tile.daysToExam') : t('reports.plan.tile.daysRemaining')}
            hint={plan.exam_date ? fmtDate(plan.exam_date) : fmtDate(plan.end_date)}
          />
          <PlanTile
            icon={PieChart}
            tone="emerald"
            value={`${plan.coverage.pct}%`}
            label={t('reports.plan.tile.covered')}
            hint={t('reports.plan.tile.covered.hint', { touched: plan.coverage.topics_touched, total: plan.coverage.topics_total })}
          />
          <PlanTile
            icon={Target}
            tone="orange"
            value={`${plan.adherence.pct}%`}
            label={t('reports.plan.tile.adherence', { days: plan.adherence.window_days })}
            hint={
              plan.adherence.streak_days > 0
                ? t('reports.plan.streak', { days: plan.adherence.streak_days })
                : t('reports.plan.tile.noStreak')
            }
          />
          <PlanTile
            icon={BarChart3}
            tone="blue"
            value={fmtHours(plan.totals.planned_minutes)}
            label={t('reports.plan.tile.total')}
            hint={t('reports.plan.tile.total.hint', { days: plan.totals.study_days, mocks: plan.totals.mocks })}
          />
        </div>

        {plan.feasibility !== 'comfortable' && (
          <div
            className={cn(
              'mt-4 flex items-center gap-3 rounded-xl border px-4 py-3',
              plan.feasibility === 'not_feasible'
                ? 'border-rose-200 dark:border-rose-900 bg-rose-50/80 dark:bg-rose-950/30'
                : 'border-amber-200 dark:border-amber-900 bg-amber-50/80 dark:bg-amber-950/30',
            )}
          >
            <AlertTriangle
              className={cn(
                'h-4 w-4 flex-shrink-0',
                plan.feasibility === 'not_feasible' ? 'text-rose-500' : 'text-amber-500',
              )}
            />
            <p className="text-[13px] leading-relaxed text-gray-700 dark:text-gray-200">
              <span className="font-bold">
                {VERDICT[plan.feasibility].label}:{' '}
              </span>
              {t(VERDICT[plan.feasibility].blurb)} {t('reports.plan.verdict.advice')}
            </p>
          </div>
        )}

        <div className="mt-4">
          <UnderlineTabs<Tab>
            value={tab}
            onChange={setTab}
            underline="blue"
            options={[
              { value: 'overview', label: t('reports.plan.tab.overview') },
              { value: 'week', label: t('reports.plan.tab.week') },
              { value: 'schedule', label: t('reports.plan.tab.schedule') },
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

// ─── Headline tiles ───────────────────────────────────────────────────────────

type TileTone = 'rose' | 'emerald' | 'orange' | 'blue';

/** Each tile is tinted to its icon, so the row reads as four distinct figures at a glance. */
const TILE_TONES: Record<TileTone, { card: string; icon: string; value: string }> = {
  rose: {
    card: 'border-rose-100 bg-rose-50/60 dark:border-rose-900/40 dark:bg-rose-950/20',
    icon: 'bg-rose-100 text-rose-500 dark:bg-rose-500/15 dark:text-rose-300',
    value: 'text-rose-600 dark:text-rose-300',
  },
  emerald: {
    card: 'border-emerald-100 bg-emerald-50/60 dark:border-emerald-900/40 dark:bg-emerald-950/20',
    icon: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300',
    value: 'text-emerald-600 dark:text-emerald-300',
  },
  orange: {
    card: 'border-orange-100 bg-orange-50/60 dark:border-orange-900/40 dark:bg-orange-950/20',
    icon: 'bg-orange-100 text-orange-500 dark:bg-orange-500/15 dark:text-orange-300',
    value: 'text-orange-600 dark:text-orange-300',
  },
  blue: {
    card: 'border-blue-100 bg-blue-50/60 dark:border-blue-900/40 dark:bg-blue-950/20',
    icon: 'bg-blue-100 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300',
    value: 'text-blue-700 dark:text-blue-300',
  },
};

function PlanTile({
  icon: Icon,
  tone,
  value,
  label,
  hint,
}: {
  icon: LucideIcon;
  tone: TileTone;
  value: string;
  label: string;
  hint?: string;
}) {
  const t = TILE_TONES[tone];
  return (
    <div className={cn('flex items-center gap-3 rounded-2xl border p-3.5', t.card)}>
      <span className={cn('flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl', t.icon)}>
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <p className={cn('text-2xl font-bold leading-none tabular-nums', t.value)}>{value}</p>
        <p className="mt-1.5 text-[13px] font-medium text-gray-700 dark:text-gray-200">{label}</p>
        {hint && <p className="text-xs leading-snug text-gray-400">{hint}</p>}
      </div>
    </div>
  );
}

// ─── Overview ─────────────────────────────────────────────────────────────────

/**
 * The day on the left, the week and the road to the exam on the right.
 *
 * Picking a tile in the week strip changes the day shown beside it, so the page is one place to
 * look at today and, a click away, any other day. The plan's own aim, phases and per-subject
 * coverage sit underneath.
 */
function Overview({ plan, today }: { plan: StudyPlan; today?: PlanDay | null }) {
  const t = useT();
  const sel = useWeekSelection(plan);
  // The week's days take a request; the plan payload already carries today, so it fills the gap.
  const day = sel.selectedDay ?? (sel.isLoading ? (today ?? null) : null);

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="grid items-start gap-3 sm:gap-4 xl:grid-cols-2">
        <div className="min-w-0">
          {day ? (
            <DayDetail planId={plan.plan_id} groupId={plan.group_id} stageId={plan.stage_id} day={day} />
          ) : (
            <ReportCard className="sm:p-6">
              {sel.isLoading ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
                </div>
              ) : (
                <NotAvailable reason={t('reports.plan.overview.pickDay')} />
              )}
            </ReportCard>
          )}
        </div>

        <div className="min-w-0 space-y-3 sm:space-y-4">
          <WeekStrip sel={sel} />
          <FullSchedule plan={plan} />
        </div>
      </div>

      <div className="grid items-start gap-3 sm:gap-4 xl:grid-cols-2">
        <div className="min-w-0 space-y-3 sm:space-y-4">
          {plan.goal.targets.length > 0 && (
            <ReportCard className="sm:p-6">
              <PanelHeader
                icon={<Target className="w-4 h-4" />}
                title={t('reports.plan.aim.title')}
                subtitle={
                  plan.basis.attempt_id
                    ? t('reports.plan.aim.fromAttempt', {
                        test: `${studentTitle(plan.basis.test_name) || 'your last mock'}${plan.basis.percentage != null ? ` (${plan.basis.percentage}%)` : ''}`,
                      })
                    : t('reports.plan.aim.fromExam')
                }
              />
              <ul className="space-y-1.5">
                {plan.goal.targets.map((target, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 mt-px flex-shrink-0" />
                    <span className="text-[14px] leading-relaxed text-gray-700 dark:text-gray-200">
                      {target}
                    </span>
                  </li>
                ))}
              </ul>
            </ReportCard>
          )}

          <PhaseTimeline phases={plan.phases} />
        </div>

        <CoveragePanel plan={plan} />
      </div>
    </div>
  );
}

// ─── Phase timeline ───────────────────────────────────────────────────────────

export function PhaseTimeline({ phases }: { phases: PlanPhase[] }) {
  const t = useT();
  const todayStr = todayISO();

  if (phases.length === 0) {
    return (
      <ReportCard className="sm:p-6">
        <NotAvailable reason={t('reports.plan.phases.none')} />
      </ReportCard>
    );
  }

  return (
    <ReportCard className="sm:p-6">
      <PanelHeader
        icon={<Layers className="w-4 h-4" />}
        title={t('reports.plan.phases.title')}
        subtitle={t('reports.plan.phases.subtitle')}
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
                  <p className="text-[14px] font-bold text-gray-900 dark:text-gray-100">
                    <span className={cn('mr-1.5', ACCENT[accent].text)}>{i + 1}.</span>
                    {p.label}
                    {current && (
                      <span
                        className={cn(
                          'ml-2 rounded-full px-1.5 py-0.5 text-[12px] font-bold',
                          ACCENT[accent].chip,
                        )}
                      >
                        {t('reports.plan.now')}
                      </span>
                    )}
                  </p>
                  {/* theme is LLM-written; label alone carries the row without it. */}
                  {p.theme && (
                    <p className="mt-0.5 text-[13px] leading-relaxed text-gray-600 dark:text-gray-300">
                      {p.theme}
                    </p>
                  )}
                </div>
                <span className="flex-shrink-0 text-[13px] tabular-nums text-gray-400">
                  {fmtRange(p.start_date, p.end_date)}
                </span>
              </div>

              {p.goal && (
                <p className="mt-1.5 text-[13px] leading-relaxed text-gray-500 dark:text-gray-400">
                  <span className="font-semibold">{t('reports.plan.phases.goal')} </span>
                  {p.goal}
                </p>
              )}
              <p className="mt-1 text-[12px] text-gray-400">
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
  const t = useT();
  const subjects = plan.coverage.by_subject;

  return (
    <ReportCard className="sm:p-6">
      <PanelHeader
        icon={<TrendingUp className="w-4 h-4" />}
        title={t('reports.plan.coverage.title')}
        subtitle={t('reports.plan.coverage.subtitle')}
        action={
          plan.adherence.streak_days > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 text-[13px] font-bold text-amber-600 dark:text-amber-400">
              <Flame className="w-3 h-3" /> {t('reports.plan.streak', { days: plan.adherence.streak_days })}
            </span>
          )
        }
      />

      {subjects.length === 0 ? (
        <NotAvailable reason={t('reports.plan.coverage.none')} />
      ) : (
        <div className="flex items-start gap-4">
          <div className="hidden sm:flex flex-col items-center gap-1 pt-1">
            <MiniRing pct={plan.coverage.pct} size={64} accent="emerald" />
            <span className="text-[12px] text-gray-400">{t('reports.plan.coverage.covered')}</span>
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
                        {bilingual(s.name)}
                        {s.priority_rank != null && (
                          <span
                            className={cn(
                              'rounded px-1 py-px text-[12px] font-bold',
                              ACCENT[accent].chip,
                            )}
                          >
                            {t('reports.plan.coverage.priority', { rank: s.priority_rank })}
                          </span>
                        )}
                      </span>
                    }
                    value={pct}
                    accent={accent}
                    right={t('reports.plan.coverage.subject', { done: s.topics_completed, planned: s.topics_planned, hours: fmtHours(s.planned_minutes) })}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {plan.narrative_source === 'deterministic' && (
        <p className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 text-[13px] text-gray-400 leading-relaxed">
          {t('reports.plan.coverage.deterministic')}
        </p>
      )}
    </ReportCard>
  );
}

// ─── Full schedule ────────────────────────────────────────────────────────────

/** Every week to the exam, as a table — its own tab, and the lower half of the Overview's right column. */
export function FullSchedule({ plan }: { plan: StudyPlan }) {
  const t = useT();
  const todayStr = todayISO();

  return (
    <ReportCard className="sm:p-6">
      <PanelHeader
        icon={<CalendarClock className="w-4 h-4" />}
        title={t('reports.plan.schedule.title')}
        subtitle={t('reports.plan.schedule.subtitle', { weeks: plan.totals.weeks, range: fmtRange(plan.start_date, plan.end_date) })}
      />

      {plan.weeks.length === 0 ? (
        <NotAvailable reason={t('reports.plan.schedule.none')} />
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-100 dark:border-gray-800">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50/70 dark:bg-gray-800/40">
                  {([
                    ['week', t('reports.plan.schedule.col.week')],
                    ['dates', t('reports.plan.schedule.col.dates')],
                    ['focus', t('reports.plan.schedule.col.focus')],
                    ['time', t('reports.plan.schedule.col.time')],
                    ['progress', t('reports.plan.schedule.col.progress')],
                  ] as const).map(([id, h]) => (
                    <th
                      key={id}
                      className={cn(
                        'whitespace-nowrap px-3 py-2.5 text-[12px] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400',
                        id === 'dates' && 'hidden sm:table-cell',
                      )}
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
                      ? Math.round((w.progress.completed_minutes / w.progress.planned_minutes) * 100)
                      : 0;

                  return (
                    <tr
                      key={w.week_id}
                      className={cn(
                        'border-t border-gray-100 dark:border-gray-800/80',
                        current && 'bg-blue-50/50 dark:bg-blue-950/20',
                        w.detail_status === 'outline' && 'opacity-80',
                      )}
                    >
                      <td className="whitespace-nowrap px-3 py-3 align-top">
                        <span className="text-[14px] font-bold text-gray-800 dark:text-gray-100">{w.week_no}</span>
                        {current && (
                          <span className="ml-1.5 rounded-full bg-blue-600 px-2 py-px text-[12px] font-bold text-white">
                            {t('reports.plan.now')}
                          </span>
                        )}
                        <span className="mt-0.5 block text-[12px] font-normal tabular-nums text-gray-400 sm:hidden">
                          {fmtRange(w.start_date, w.end_date)}
                        </span>
                      </td>
                      <td className="hidden whitespace-nowrap px-3 py-3 align-top text-[13px] tabular-nums text-gray-500 dark:text-gray-400 sm:table-cell">
                        {fmtRange(w.start_date, w.end_date)}
                      </td>
                      <td className="min-w-[170px] px-3 py-3 align-top sm:min-w-[200px]">
                        <p className="text-[14px] font-semibold leading-snug text-gray-800 dark:text-gray-100">
                          {w.theme}
                        </p>
                        {w.narrative && (
                          <p className="mt-0.5 text-[13px] leading-relaxed text-gray-500 dark:text-gray-400">
                            {w.narrative}
                          </p>
                        )}
                        {w.detail_status === 'outline' && (
                          <p className="mt-1 inline-flex items-center gap-1 text-[12px] text-gray-400">
                            <CalendarClock className="h-3 w-3" /> {t('reports.plan.schedule.outline')}
                          </p>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 align-top text-[13px] tabular-nums text-gray-600 dark:text-gray-300">
                        {fmtMinutes(w.target_minutes)}
                      </td>
                      <td className="w-36 px-3 py-3 align-top">
                        {w.progress.planned_minutes > 0 ? (
                          <div className="flex items-center gap-2">
                            <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                              <div
                                className={cn(
                                  'h-full rounded-full',
                                  pct >= 100 ? 'bg-emerald-500' : 'bg-amber-500',
                                )}
                                style={{ width: `${Math.min(100, pct)}%` }}
                              />
                            </div>
                            <span className="w-9 text-right text-[13px] tabular-nums text-gray-600 dark:text-gray-300">
                              {pct}%
                            </span>
                          </div>
                        ) : (
                          <span className="text-[13px] text-gray-400">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
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
