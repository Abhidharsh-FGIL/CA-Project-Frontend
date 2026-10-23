import { useEffect, useMemo, useState } from 'react';
import { displayTitle } from '@/lib/display-title';
import { Link, useSearchParams } from 'react-router-dom';
import { readPerformanceView } from '@/lib/performance-view';
import { here } from '@/lib/report-origin';
import { useQuery } from '@tanstack/react-query';
import { TestsPerDayChart } from '@/components/user/TestsPerDayChart';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
  BarChart3,
  ChevronRight,
  FileText,
  Info,
  Loader2,
  TrendingUp,
  Trophy,
  type LucideIcon,
} from 'lucide-react';
import { PANEL_SURFACE, UserShell } from '@/components/user/UserShell';
import { FilterSelect } from '@/components/user/FilterSelect';
import { TestScoreCard } from '@/components/user/TestScoreCard';
import { useSubjectStrengths } from '@/hooks/use-subject-strengths';
import { usePerformanceReport } from '@/hooks/use-performance-report';
import { SubjectPerformance } from '@/components/user/AttemptDiagnosticReport';
import { useUserPortal } from '@/contexts/UserPortalContext';
import { useReportGate } from '@/hooks/use-report-gate';
import {
  EXAM_GROUP_OPTIONS,
  EXAM_TRACK_OPTIONS,
  GROUP_STAGE,
  formatTrendLabel,
  openGroupKey,
  useProgressTrend,
  type ExamGroupKey,
  type ExamTrackKey,
} from '@/hooks/use-progress-trend';
import { useSavedView } from '@/hooks/use-saved-view';
import { ALL_TIME, DateRangeFilter, isoDay, rangeLabel, type DateRange } from '@/components/user/DateRangeFilter';
import {
  commonMaxMarks,
  getUserDashboardAnalytics,
  marksLabel,
  maxMarksOf,
  type UserDashboardAnalytics,
} from '@/lib/userDashboardApi';
import { cn } from '@/lib/utils';

/** The "View detailed report" destination — trend, subject breakdown, every attempt. */
export default function UserPerformancePage() {
  const { user, assessments, history, isLoading } = useUserPortal();
  const gateReport = useReportGate();
  // The dashboard's link carries the exam, test type and range it was showing; start on those.
  const [searchParams] = useSearchParams();
  const fromLink = useMemo(() => readPerformanceView(searchParams), []); // only the view that was opened
  // The same remembered view the dashboard uses, so moving between the two doesn't change what is shown. What the
  // link names wins for this visit and counts as chosen.
  const { group, track, range, preferred: preferredGroup, chooseGroup, chooseTrack, chooseRange, resetView } = useSavedView(user, fromLink);
  const setTrack = chooseTrack;
  const setRange = chooseRange;
  const [showAllAttempts, setShowAllAttempts] = useState(false);

  const { data: a } = useQuery<UserDashboardAnalytics>({
    queryKey: ['user-dashboard-analytics', history.length, assessments.length],
    queryFn: () => getUserDashboardAnalytics(history, assessments.length),
    staleTime: 60_000,
  });

  const {
    points: trend,
    caption: trendCaption,
    attempts: done,
    isLoading: trendLoading,
    ceiling: trendMax,
  } = useProgressTrend({ analytics: a, history, group, track, range });

  /**
   * Every figure on this page is scoped to one exam and one track now, so the old
   * "are any filters on" flag is always true. What still varies is whether the date
   * range has been narrowed — that alone decides between range copy and all-time copy.
   */
  const rangeNarrowed = range.key !== 'all';
  const groupLabel = EXAM_GROUP_OPTIONS.find(o => o.value === group)!.label;
  const trackLabel = EXAM_TRACK_OPTIONS.find(o => o.value === track)!.label;
  const trackNoun = track === 'mock' ? 'Mock Test' : 'Practice Test';
  const trackHref = `/user/exams/${group}/${GROUP_STAGE[group]}?tab=${track}`;

  const isDefaultView = group === preferredGroup && track === 'practice' && !rangeNarrowed;
  // Reset forgets what was remembered too, so the view goes back to following the profile.

  // Subject figures are re-aggregated from the attempts shown, for the "answered N of M" panel — otherwise
  // it would contradict everything above it.
  const { subjects } = useSubjectStrengths({ analytics: a, attempts: done, scoped: true });

  // The unit table is the mock test report's own, built over the questions of the same attempts.
  const perfReport = usePerformanceReport(done);
  const [openUnit, setOpenUnit] = useState<string | null>(null);
  // A row opened under one selection means nothing under another.
  useEffect(() => setOpenUnit(null), [group, track, range]);

  /**
   * Where the marks actually went. Average score divides by every question in the
   * paper; accuracy divides by the ones answered. When those two numbers are far
   * apart the gap is blanks, not wrong answers — and that is the fastest thing to fix.
   */
  const totals = useMemo(() => {
    let correct = 0;
    let attempted = 0;
    let questions = 0;
    for (const s of subjects) {
      if (s.correct == null || s.attempted == null) continue;
      correct += s.correct;
      attempted += s.attempted;
      questions += s.total_questions ?? s.attempted;
    }
    if (attempted === 0 || questions === 0) return null;
    return {
      correct,
      wrong: attempted - correct,
      blank: Math.max(0, questions - attempted),
      attempted,
      questions,
      attemptRate: Math.round((attempted / questions) * 100),
      accuracy: Math.round((correct / attempted) * 100),
    };
  }, [subjects]);

  const best = done.reduce((m, h) => Math.max(m, h.percentage ?? 0), 0);

  // The server's all-time average would contradict the scoped "Tests Taken" beside
  // it, so every figure comes from the same attempts the list below shows.
  const averageValue = done.length
    ? Math.round(done.reduce((sum, h) => sum + (h.percentage ?? 0), 0) / done.length)
    : 0;

  // "Average Score: 2%" reads as a contradiction on its own — an aspirant thinks in
  // marks out of 300. Every percentage gets the marks behind it.
  const paperMax = commonMaxMarks(done);
  const averageMarks = done.length
    ? Math.round((done.reduce((sum, h) => sum + (h.score ?? 0), 0) / done.length) * 10) / 10
    : null;
  const bestAttempt = done.reduce<(typeof done)[number] | null>(
    (top, h) => (top == null || (h.percentage ?? 0) > (top.percentage ?? 0) ? h : top),
    null,
  );

  /**
   * The dark panel describes the selection rather than the account: a global "this week" average or a
   * current streak would contradict the scoped figures beside it.
   */
  const rangeBars = useMemo(() => {
    const byDay = new Map<string, { sum: number; n: number }>();
    for (const h of done) {
      const key = isoDay(new Date(h.start_time));
      const e = byDay.get(key) ?? { sum: 0, n: 0 };
      e.sum += h.percentage ?? 0;
      e.n += 1;
      byDay.set(key, e);
    }
    return [...byDay.entries()]
      .sort(([x], [y]) => (x < y ? -1 : 1))
      .slice(-7) // the panel only has room for about a week of bars
      .map(([date, e]) => ({
        day: new Date(`${date}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
        value: Math.round(e.sum / e.n),
      }));
  }, [done]);
  const attempts = showAllAttempts ? done : done.slice(0, 8);

  /** Two lines under the curve, describing what the curve actually did. */
  const trendNote = useMemo(() => {
    if (trend.length < 2) return null;
    const first = trend[0];
    const last = trend[trend.length - 1];
    const delta = Math.round((last.value - first.value) * 10) / 10;
    const peak = trend.reduce((hi, p) => (p.value > hi.value ? p : hi), trend[0]);
    const move =
      delta > 0.5 ? `risen ${delta} points` : delta < -0.5 ? `fallen ${Math.abs(delta)} points` : 'stayed broadly flat';
    return `Across ${trend.length} days your daily average has ${move}, ${first.value}% on ${first.label} to ${last.value}% on ${last.label}. Best day was ${peak.label} at ${peak.value}%.`;
  }, [trend]);

  const rangeNote = useMemo(() => {
    if (rangeBars.length === 0) return null;
    const best = rangeBars.reduce((hi, d) => (d.value > hi.value ? d : hi), rangeBars[0]);
    const worst = rangeBars.reduce((lo, d) => (d.value < lo.value ? d : lo), rangeBars[0]);
    if (rangeBars.length === 1) return `One active day: ${best.day} at ${best.value}%.`;
    return `${rangeBars.length} active days shown. Best ${best.day} at ${best.value}%, lowest ${worst.day} at ${worst.value}%.`;
  }, [rangeBars]);

  // After every hook above: returning earlier changes how many hooks run between renders.
  if (isLoading) {
    return (
      <UserShell>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      </UserShell>
    );
  }

  return (
    <UserShell>
      <div className="flex items-start justify-between gap-3 flex-wrap mb-4 sm:mb-5">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">Performance</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            How your scores are moving, and every attempt behind them.
          </p>
        </div>
        {/* One filter bar for the page — scores, curve and attempts all obey it. */}
        <div className="flex items-center gap-2 flex-wrap">
          <FilterSelect value={group} options={EXAM_GROUP_OPTIONS} onChange={chooseGroup} ariaLabel="Exam group" />
          <FilterSelect value={track} options={EXAM_TRACK_OPTIONS} onChange={v => setTrack(v)} ariaLabel="Test type" />
          <DateRangeFilter value={range} onChange={setRange} />
          {!isDefaultView && (
            <button
              type="button"
              onClick={resetView}
              className="h-9 px-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:underline"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      <p className="-mt-2 mb-3 text-[11px] text-gray-500 dark:text-gray-400">
        Showing <span className="font-semibold text-gray-700 dark:text-gray-200">{done.length}</span>{' '}
        {done.length === 1 ? 'attempt' : 'attempts'} · {groupLabel} · {trackLabel} · {rangeLabel(range)}
      </p>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3 mb-3 sm:mb-4">
        <Tile
          icon={BarChart3}
          tone="orange"
          label="Average Score"
          value={`${averageValue}%`}
          hint={marksLabel(averageMarks, paperMax) ?? 'of all marks'}
        />
        <Tile
          icon={Trophy}
          tone="green"
          label="Best Score"
          value={`${Math.round(best)}%`}
          hint={bestAttempt ? marksLabel(bestAttempt.score, maxMarksOf(bestAttempt) ?? paperMax) ?? undefined : undefined}
        />
        <Tile
          icon={FileText}
          tone="purple"
          label={`${trackNoun}s Taken`}
          value={done.length}
          className="col-span-2 lg:col-span-1"
        />
      </div>

      {/* ── The headline insight, when the data supports one ─────────────────── */}
      {totals && totals.attemptRate < 70 && (
        <div className="mb-3 sm:mb-4 rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 mt-px text-blue-500 dark:text-blue-400 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-bold text-gray-900 dark:text-gray-100">
                You answered {totals.attempted} of {totals.questions} questions ({totals.attemptRate}%)
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-300 mt-1 leading-relaxed">
                Of the ones you did answer, {totals.accuracy}% were right — but your average score is{' '}
                {averageValue}%, because unanswered questions score zero. Attempting more
                is worth more marks right now than getting more of them right.
              </p>

              <div className="flex items-center gap-[2px] h-3 mt-3">
                <Bit width={(totals.correct / totals.questions) * 100} color="#10b981" first />
                <Bit width={(totals.wrong / totals.questions) * 100} color="#f43f5e" />
                <div className="h-full flex-1 rounded-r-full bg-gray-200 dark:bg-gray-700" />
              </div>
              <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1.5">
                <Dot color="#10b981" /> {totals.correct} correct
                <span className="mx-1.5">·</span>
                <Dot color="#f43f5e" /> {totals.wrong} wrong
                <span className="mx-1.5">·</span>
                <Dot className="bg-gray-300 dark:bg-gray-600" /> {totals.blank} not answered
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Unit-wise performance — the mock test report's own table, over these attempts ───────────── */}
      <div>
        {perfReport.isLoading && !perfReport.model ? (
          <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 py-10 flex items-center justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-gray-300" />
          </div>
        ) : !perfReport.model ? (
          <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
            <p className="text-sm font-bold text-gray-900 dark:text-gray-100">Unit-wise performance</p>
            <p className="py-8 text-center text-xs text-gray-400">
              {done.length === 0
                ? `Take a ${groupLabel} ${trackNoun.toLowerCase()} to see where your marks are coming from.`
                : 'No unit data for the attempts in this selection.'}
            </p>
          </div>
        ) : (
          <SubjectPerformance
            model={perfReport.model}
            expanded={openUnit}
            onToggle={id => setOpenUnit(cur => (cur === id ? null : id))}
            categoriesOnly
            title="Unit-wise performance"
            subtitle={`Open a subject for its units, then a unit for its categories and sub-categories. ${groupLabel} · ${trackNoun.toLowerCase()}s · ${rangeLabel(range).toLowerCase()} — ${perfReport.attemptCount} ${perfReport.attemptCount === 1 ? 'attempt' : 'attempts'}${perfReport.truncated ? ' (the most recent)' : ''}.`}
            footnote={
              perfReport.untagged > 0 ? (
                <p className="mt-2 text-[11px] text-gray-400">
                  {perfReport.untagged} {perfReport.untagged === 1 ? 'question is' : 'questions are'} not tagged to a unit
                  (mostly older attempts) and not counted here.
                </p>
              ) : null
            }
          />
        )}
      </div>

      <TestScoreCard
        attempts={done}
        scopeLabel={`${groupLabel} · ${trackNoun.toLowerCase()}s`}
        trackNoun={trackNoun}
        takeHref={trackHref}
        isLoading={trendLoading}
        className="mt-3 sm:mt-4"
      />

      <div className="grid lg:grid-cols-3 gap-3 sm:gap-4 mt-3 sm:mt-4">
        <div className="lg:col-span-2 rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
          <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
            <div className="min-w-0">
              <p className="text-sm font-bold text-gray-900 dark:text-gray-100">Daily Test Activity</p>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                Tests taken each day · {groupLabel} · {trackNoun.toLowerCase()}s
              </p>
            </div>
          </div>

          {trendLoading ? (
            <div className="h-64 flex items-center justify-center">
              <Loader2 className="w-5 h-5 animate-spin text-gray-300" />
            </div>
          ) : done.length > 0 ? (
            <TestsPerDayChart attempts={done} className="h-64" />
          ) : (
            <div className="h-64 flex flex-col items-center justify-center gap-2 text-center">
              <TrendingUp className="w-5 h-5 text-gray-300" />
              <p className="text-xs text-gray-400">
                {rangeNarrowed
                  ? `No ${trackNoun.toLowerCase()}s in ${groupLabel} over this period.`
                  : `Take a ${groupLabel} ${trackNoun.toLowerCase()} to start the curve.`}
              </p>
              {rangeNarrowed ? (
                <button
                  type="button"
                  onClick={() => setRange(ALL_TIME)}
                  className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Show all time
                </button>
              ) : (
                <Link to={trackHref} className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline">
                  Take a {trackNoun.toLowerCase()}
                </Link>
              )}
            </div>
          )}
        </div>

        <div className={cn('rounded-2xl p-4 text-gray-900 dark:text-gray-100', PANEL_SURFACE)}>
          <p className="text-sm font-bold mb-3">{rangeNarrowed ? rangeLabel(range) : 'Last 7 active days'}</p>
          <div className="flex items-center gap-4 mb-3">
            <div>
              <p className="text-2xl font-bold leading-none">{averageValue}%</p>
              <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1">
                Average across {done.length} {done.length === 1 ? 'attempt' : 'attempts'}
              </p>
            </div>
          </div>
          <div className="h-40">
            {rangeBars.length === 0 ? (
              <div className="h-full flex items-center justify-center text-[11px] text-gray-500 dark:text-gray-400">
                No attempts in this range.
              </div>
            ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rangeBars} barCategoryGap="28%">
                <CartesianGrid stroke="#e9edf3" />
                <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fontSize: 9, fill: '#6b7280' }} />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 9, fill: '#6b7280' }}
                  tickFormatter={(v: number) => `${v}%`}
                  width={30}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(255,108,36,0.08)' }}
                  contentStyle={{ borderRadius: 10, border: 'none', fontSize: 11, background: '#111827', color: '#fff' }}
                  formatter={(v: any) => [`${v}%`, 'Average']}
                />
                <Bar dataKey="value" radius={[4, 4, 0, 0]} fill="#ff6c24" maxBarSize={44} />
              </BarChart>
            </ResponsiveContainer>
            )}
          </div>
          {rangeNote && (
            <p className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-800 text-[11px] leading-relaxed text-gray-500 dark:text-gray-400">
              {rangeNote}
            </p>
          )}
        </div>
      </div>

      {/* ── Attempts ─────────────────────────────────────────────────────────── */}
      <div className="mt-3 sm:mt-4 rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-bold text-gray-900 dark:text-gray-100">
            All attempts{' '}
            <span className="font-normal text-gray-400">
              ({attempts.length} of {done.length})
            </span>
          </p>
          <Link to="/user/history" className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline">
            Full history
          </Link>
        </div>
        {done.length === 0 ? (
          <p className="py-8 text-center text-xs text-gray-400">
            No {trackNoun.toLowerCase()}s attempted in {groupLabel} over this period.
          </p>
        ) : (
          <>
            <ul className="space-y-2">
              {attempts.map(h => {
                const pct = Math.round(h.percentage ?? 0);
                return (
                  <li key={h.attempt_id}>
                    <Link
                      to={`/user/report/${h.attempt_id}`}
                      state={{ from: here() }}
                      onClick={gateReport(h.test_mode)}
                      className="group flex items-center gap-3 rounded-xl border border-gray-100 dark:border-gray-800 px-3 py-2.5 hover:border-blue-200 dark:hover:border-blue-800 hover:bg-blue-50/30 dark:hover:bg-gray-800/40 transition-colors"
                    >
                      <span className="w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center flex-shrink-0">
                        <FileText className="w-4 h-4 text-blue-500" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs font-semibold text-gray-900 dark:text-gray-100 truncate">
                          {displayTitle(h.test_name) ?? 'Test attempt'}
                        </span>
                        <span className="block text-[10px] text-gray-400 capitalize">
                          {new Date(h.start_time).toLocaleString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                            hour12: true,
                          })}
                          {h.test_mode ? ` · ${h.test_mode}` : ''}
                        </span>
                      </span>
                      {/* A bar next to the number turns a column of percentages into a
                          comparison you can scan. */}
                      <span className="hidden sm:block w-24 h-1.5 rounded bg-gray-100 dark:bg-gray-800 overflow-hidden flex-shrink-0">
                        <span
                          className={cn('block h-full rounded', pct >= 50 ? 'bg-emerald-500' : 'bg-blue-400')}
                          style={{ width: `${Math.max(2, pct)}%` }}
                        />
                      </span>
                      <span className="hidden md:block text-[10px] text-gray-400 tabular-nums flex-shrink-0 w-24 text-right">
                        {marksLabel(h.score, maxMarksOf(h) ?? paperMax)}
                      </span>
                      <span
                        className={cn(
                          'text-sm font-bold tabular-nums flex-shrink-0 w-10 text-right',
                          pct >= 50 ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-900 dark:text-gray-100',
                        )}
                      >
                        {pct}%
                      </span>
                      <ChevronRight className="w-4 h-4 text-gray-300 dark:text-gray-600 group-hover:text-blue-500 flex-shrink-0" />
                    </Link>
                  </li>
                );
              })}
            </ul>
            {done.length > 8 && (
              <button
                type="button"
                onClick={() => setShowAllAttempts(v => !v)}
                className="mt-3 w-full py-2 text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline"
              >
                {showAllAttempts ? 'Show fewer' : `Show all ${done.length} attempts`}
              </button>
            )}
          </>
        )}
      </div>
    </UserShell>
  );
}

function Bit({ width, color, first }: { width: number; color: string; first?: boolean }) {
  if (width <= 0) return null;
  return (
    <span
      className={cn('h-full', first ? 'rounded-l-full rounded-r' : 'rounded')}
      style={{ width: `${width}%`, background: color, minWidth: 2 }}
    />
  );
}

function Dot({ color, className }: { color?: string; className?: string }) {
  return (
    <span
      className={cn('inline-block w-1.5 h-1.5 rounded-sm mr-1 align-middle', className)}
      style={color ? { background: color } : undefined}
    />
  );
}

type TileTone = 'orange' | 'blue' | 'green' | 'purple' | 'amber';

/** Each tile keeps its icon's colour; the card behind it is plain. */
const TILE_TONES: Record<TileTone, { card: string; icon: string }> = {
  orange: {
    card: 'border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900',
    icon: 'bg-orange-100 text-orange-600 dark:bg-orange-500/15 dark:text-orange-300',
  },
  blue: {
    card: 'border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900',
    icon: 'bg-blue-100 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300',
  },
  green: {
    card: 'border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900',
    icon: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300',
  },
  purple: {
    card: 'border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900',
    icon: 'bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300',
  },
  amber: {
    card: 'border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900',
    icon: 'bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300',
  },
};

function Tile({
  icon: Icon,
  tone,
  label,
  value,
  hint,
  className,
}: {
  icon: LucideIcon;
  tone: TileTone;
  label: string;
  value: string | number;
  hint?: string;
  className?: string;
}) {
  const t = TILE_TONES[tone];
  return (
    <div className={cn('flex items-center gap-3 rounded-2xl border p-3 sm:p-3.5', t.card, className)}>
      <span className={cn('w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0', t.icon)}>
        <Icon className="w-5 h-5" />
      </span>
      <div className="min-w-0">
        <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100 leading-none">{value}</p>
        <p className="text-[11px] text-gray-600 dark:text-gray-300 mt-1.5 font-medium">{label}</p>
        {hint && <p className="text-[10px] text-gray-400 mt-0.5 leading-tight">{hint}</p>}
      </div>
    </div>
  );
}
