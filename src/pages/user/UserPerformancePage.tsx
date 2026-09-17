import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Area, AreaChart, Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Loader2, Target, TrendingUp } from 'lucide-react';
import { UserShell } from '@/components/user/UserShell';
import { FilterSelect } from '@/components/user/FilterSelect';
import { SubjectBreakdown, sortSubjects, type SubjectSort } from '@/components/user/SubjectBreakdown';
import { TestScoreCard } from '@/components/user/TestScoreCard';
import { useSubjectStrengths } from '@/hooks/use-subject-strengths';
import { useUserPortal } from '@/contexts/UserPortalContext';
import {
  EXAM_GROUP_OPTIONS,
  EXAM_TRACK_OPTIONS,
  GROUP_STAGE,
  formatTrendLabel,
  resolveGroupKey,
  useProgressTrend,
  type ExamGroupKey,
  type ExamTrackKey,
} from '@/hooks/use-progress-trend';
import { ALL_TIME, DateRangeFilter, isoDay, rangeLabel, type DateRange } from '@/components/user/DateRangeFilter';
import {
  commonMaxMarks,
  getUserDashboardAnalytics,
  marksLabel,
  maxMarksOf,
  type UserDashboardAnalytics,
} from '@/lib/userDashboardApi';
import type { FilterOption } from '@/components/user/FilterSelect';
import { cn } from '@/lib/utils';

const SORT_OPTIONS: FilterOption<SubjectSort>[] = [
  { value: 'weakest', label: 'Focus areas', hint: 'Revise these first' },
  { value: 'strongest', label: 'Top subjects', hint: 'Your best scoring' },
  { value: 'most-answered', label: 'Most answered', hint: 'Best evidence' },
];

/** The "View detailed report" destination — trend, subject breakdown, every attempt. */
export default function UserPerformancePage() {
  const { user, assessments, history, isLoading } = useUserPortal();
  const [range, setRange] = useState<DateRange>(ALL_TIME);
  const [track, setTrack] = useState<ExamTrackKey>('mock');
  const preferredGroup = resolveGroupKey(user?.preferred_exam);
  const [group, setGroup] = useState<ExamGroupKey>(preferredGroup);

  /**
   * Follows the registered exam until the aspirant picks one — the same rule the
   * dashboard uses, so moving between the two doesn't change which exam is shown.
   */
  const [pinned, setPinned] = useState(false);
  useEffect(() => {
    if (!pinned) setGroup(preferredGroup);
  }, [preferredGroup, pinned]);
  const chooseGroup = (v: ExamGroupKey) => {
    setPinned(true);
    setGroup(v);
  };
  const [subjectSort, setSubjectSort] = useState<SubjectSort>('weakest');
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

  const isDefaultView = group === preferredGroup && track === 'mock' && !rangeNarrowed;
  // Reset releases the pin too, so the view goes back to following the profile.
  const resetView = () => {
    setPinned(false);
    setGroup(preferredGroup);
    setTrack('mock');
    setRange(ALL_TIME);
  };

  // With any filter on, subject figures are re-aggregated from those attempts' own
  // breakdowns — otherwise the card would contradict everything above it.
  const {
    subjects,
    isLoading: subjectsLoading,
    truncated: subjectsTruncated,
  } = useSubjectStrengths({ analytics: a, attempts: done, scoped: true });

  const subjectColumns = useMemo(() => {
    const ordered = sortSubjects(subjects, subjectSort);
    const half = Math.ceil(ordered.length / 2);
    return [ordered.slice(0, half), ordered.slice(half)];
  }, [subjects, subjectSort]);

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

  if (isLoading) {
    return (
      <UserShell>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        </div>
      </UserShell>
    );
  }

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
   * The dark panel and the last tile both describe the selection rather than the
   * account: a global "this week" average or a current streak would contradict the
   * scoped figures beside them.
   */
  const activeDays = useMemo(
    () => new Set(done.map(h => isoDay(new Date(h.start_time)))).size,
    [done],
  );

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
    return `Across ${trend.length} points your rolling average has ${move}, ${first.value}% on ${first.label} to ${last.value}% on ${last.label}. Peak was ${peak.value}% on ${peak.label}.`;
  }, [trend]);

  const rangeNote = useMemo(() => {
    if (rangeBars.length === 0) return null;
    const best = rangeBars.reduce((hi, d) => (d.value > hi.value ? d : hi), rangeBars[0]);
    const worst = rangeBars.reduce((lo, d) => (d.value < lo.value ? d : lo), rangeBars[0]);
    if (rangeBars.length === 1) return `One active day: ${best.day} at ${best.value}%.`;
    return `${rangeBars.length} active days shown. Best ${best.day} at ${best.value}%, lowest ${worst.day} at ${worst.value}%.`;
  }, [rangeBars]);

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
              className="h-9 px-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:underline"
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

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-2.5 sm:gap-3 mb-3 sm:mb-4">
        <Tile
          label="Average Score"
          value={`${averageValue}%`}
          hint={marksLabel(averageMarks, paperMax) ?? 'of all marks'}
        />
        <Tile
          label="Accuracy"
          value={totals ? `${totals.accuracy}%` : '—'}
          // Subject data is aggregated server-side across every attempt; it carries no
          // group or date dimension, so this tile can't follow the filters. Say so.
          hint="of questions you answered"
          accent
        />
        <Tile
          label="Best Score"
          value={`${Math.round(best)}%`}
          hint={bestAttempt ? marksLabel(bestAttempt.score, maxMarksOf(bestAttempt) ?? paperMax) ?? undefined : undefined}
        />
        <Tile label={`${trackNoun}s Taken`} value={done.length} />
        <Tile
          label="Days Active"
          value={`${activeDays} days`}
          hint={rangeNarrowed ? 'in this range' : 'in this selection'}
        />
      </div>

      {/* ── The headline insight, when the data supports one ─────────────────── */}
      {totals && totals.attemptRate < 70 && (
        <div className="mb-3 sm:mb-4 rounded-2xl border border-indigo-100 dark:border-indigo-900/50 bg-indigo-50/60 dark:bg-indigo-500/10 p-4">
          <div className="flex items-start gap-3">
            <span className="w-9 h-9 rounded-xl bg-white dark:bg-gray-900 flex items-center justify-center flex-shrink-0">
              <Target className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-bold text-gray-900 dark:text-gray-100">
                You answered {totals.attempted} of {totals.questions} questions ({totals.attemptRate}%)
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-300 mt-1 leading-relaxed">
                Of the ones you did answer, {totals.accuracy}% were right — but your average score is{' '}
                {averageValue}%, because unanswered questions score zero. Attempting more
                is worth more marks right now than getting more of them right.
              </p>

              <div className="flex items-center gap-[2px] h-2.5 mt-3">
                <Bit width={(totals.correct / totals.questions) * 100} color="#10b981" />
                <Bit width={(totals.wrong / totals.questions) * 100} color="#f43f5e" />
                <div className="h-full flex-1 rounded-r bg-gray-200 dark:bg-gray-700" />
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

      <div className="grid lg:grid-cols-3 gap-3 sm:gap-4">
        <div className="lg:col-span-2 rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
          <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
            <div className="min-w-0">
              <p className="text-sm font-bold text-gray-900 dark:text-gray-100">
                Score trend <span className="font-normal text-gray-400">(%)</span>
              </p>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">{trendCaption}</p>
            </div>
          </div>

          {trendLoading ? (
            <div className="h-64 flex items-center justify-center">
              <Loader2 className="w-5 h-5 animate-spin text-gray-300" />
            </div>
          ) : trend.length > 0 ? (
            <div className="-ml-2">
              <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trend}>
                  <defs>
                    <linearGradient id="perfFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6366f1" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 10, fill: '#9ca3af' }}
                    minTickGap={28}
                  />
                  {/* Scaled to the data: a fixed 0–100 axis draws early scores as a flat
                      line on the baseline, which reads as a broken chart. */}
                  <YAxis
                    domain={[0, trendMax]}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 10, fill: '#9ca3af' }}
                    tickFormatter={(v: number) => `${v}%`}
                    width={40}
                  />
                  <Tooltip
                    contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb', fontSize: 12 }}
                    formatter={(v: any) => [`${v}%`, 'Rolling average']}
                    labelFormatter={formatTrendLabel}
                  />
                  <Area type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={2} fill="url(#perfFill)" />
                </AreaChart>
              </ResponsiveContainer>
              </div>
              {trendNote && (
                <p className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-800 text-[11px] leading-relaxed text-gray-500 dark:text-gray-400">
                  {trendNote}
                </p>
              )}
            </div>
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
                  className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  Show all time
                </button>
              ) : (
                <Link to={trackHref} className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline">
                  Take a {trackNoun.toLowerCase()}
                </Link>
              )}
            </div>
          )}
        </div>

        <div className="rounded-2xl bg-gray-900 dark:bg-gray-800 p-4 text-white">
          <p className="text-sm font-bold mb-3">{rangeNarrowed ? rangeLabel(range) : 'Last 7 active days'}</p>
          <div className="flex items-center gap-4 mb-3">
            <div>
              <p className="text-xl font-bold">{averageValue}%</p>
              <p className="text-[10px] text-gray-400">
                Average across {done.length} {done.length === 1 ? 'attempt' : 'attempts'}
              </p>
            </div>
          </div>
          <div className="h-40">
            {rangeBars.length === 0 ? (
              <div className="h-full flex items-center justify-center text-[11px] text-gray-500">
                No attempts in this range.
              </div>
            ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rangeBars} barCategoryGap="28%">
                <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fontSize: 9, fill: '#9ca3af' }} />
                <Tooltip
                  cursor={{ fill: 'rgba(255,255,255,0.06)' }}
                  contentStyle={{ borderRadius: 10, border: 'none', fontSize: 11, background: '#111827' }}
                  formatter={(v: any) => [`${v}%`, 'Average']}
                />
                <Bar dataKey="value" radius={[4, 4, 0, 0]} fill="#818cf8" />
              </BarChart>
            </ResponsiveContainer>
            )}
          </div>
          {rangeNote && (
            <p className="mt-2 pt-2 border-t border-white/10 text-[11px] leading-relaxed text-gray-400">
              {rangeNote}
            </p>
          )}
        </div>
      </div>

      <TestScoreCard
        attempts={done}
        scopeLabel={`${groupLabel} · ${trackNoun.toLowerCase()}s`}
        trackNoun={trackNoun}
        takeHref={trackHref}
        isLoading={trendLoading}
        className="mt-3 sm:mt-4"
      />

      {/* ── Subject breakdown — the richest data the portal has ──────────────── */}
      <div className="mt-3 sm:mt-4 rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
        <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
          <div className="min-w-0">
            <p className="text-sm font-bold text-gray-900 dark:text-gray-100">Subject breakdown</p>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
              {/* When empty, the body below carries the message — don't say it twice. */}
              {subjects.length === 0
                ? ''
                : `${subjects.length} subjects across the ${done.length} ${done.length === 1 ? 'attempt' : 'attempts'} shown.` +
                  (subjectsTruncated ? ' Based on the 25 most recent.' : '')}
            </p>
          </div>
          {subjects.length > 1 && (
            <FilterSelect
              value={subjectSort}
              options={SORT_OPTIONS}
              onChange={v => setSubjectSort(v)}
              size="sm"
              ariaLabel="Sort subjects"
            />
          )}
        </div>

        {subjectsLoading ? (
          <div className="py-8 flex items-center justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-gray-300" />
          </div>
        ) : subjects.length === 0 ? (
          <p className="py-8 text-center text-xs text-gray-400">
            {done.length === 0
              ? `Take a ${groupLabel} ${trackNoun.toLowerCase()} to see where your marks are coming from.`
              : 'No subject data for the attempts in this selection.'}
          </p>
        ) : (
          <>
            {/* Two columns so thirteen subjects don't become a very long scroll; the
                chosen order reads down the left column, then the right. */}
            <div className="grid sm:grid-cols-2 gap-x-6">
              <SubjectBreakdown subjects={subjectColumns[0]} composition sort={subjectSort} />
              <SubjectBreakdown
                subjects={subjectColumns[1]}
                composition
                sort={subjectSort}
                className="mt-2.5 sm:mt-0"
              />
            </div>
            <p className="text-[10px] text-gray-400 mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
              Accuracy counts only the questions you answered. A subject with a handful answered can show a
              high percentage on very little evidence — the counts under each bar say how much.
            </p>
          </>
        )}
      </div>

      {/* ── Attempts ─────────────────────────────────────────────────────────── */}
      <div className="mt-3 sm:mt-4 rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
          <p className="text-sm font-bold text-gray-900 dark:text-gray-100">
            All attempts{' '}
            <span className="font-normal text-gray-400">
              ({attempts.length} of {done.length})
            </span>
          </p>
          <Link to="/user/history" className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline">
            Full history
          </Link>
        </div>
        {done.length === 0 ? (
          <p className="py-10 text-center text-xs text-gray-400">
            No {trackNoun.toLowerCase()}s attempted in {groupLabel} over this period.
          </p>
        ) : (
          <>
            <ul className="divide-y divide-gray-50 dark:divide-gray-800">
              {attempts.map(h => {
                const pct = Math.round(h.percentage ?? 0);
                return (
                  <li key={h.attempt_id}>
                    <Link
                      to={`/user/report/${h.attempt_id}`}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/60"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs font-semibold text-gray-900 dark:text-gray-100 truncate">
                          {h.test_name ?? 'Test attempt'}
                        </span>
                        <span className="block text-[10px] text-gray-400">
                          {new Date(h.start_time).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}
                          {h.test_mode ? ` · ${h.test_mode}` : ''}
                        </span>
                      </span>
                      {/* A bar next to the number turns a column of percentages into a
                          comparison you can scan. */}
                      <span className="hidden sm:block w-24 h-1.5 rounded bg-gray-100 dark:bg-gray-800 overflow-hidden flex-shrink-0">
                        <span
                          className={cn('block h-full rounded', pct >= 50 ? 'bg-emerald-500' : 'bg-indigo-400')}
                          style={{ width: `${Math.max(2, pct)}%` }}
                        />
                      </span>
                      <span className="hidden md:block text-[10px] text-gray-400 tabular-nums flex-shrink-0 w-24 text-right">
                        {marksLabel(h.score, maxMarksOf(h) ?? paperMax)}
                      </span>
                      <span
                        className={cn(
                          'text-xs font-bold px-2 py-0.5 rounded tabular-nums flex-shrink-0',
                          pct >= 50
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                            : 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
                        )}
                      >
                        {pct}%
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
            {done.length > 8 && (
              <button
                type="button"
                onClick={() => setShowAllAttempts(v => !v)}
                className="w-full py-2.5 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-gray-50 dark:hover:bg-gray-800/60 border-t border-gray-100 dark:border-gray-800"
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

function Bit({ width, color }: { width: number; color: string }) {
  if (width <= 0) return null;
  return <span className="h-full rounded" style={{ width: `${width}%`, background: color, minWidth: 2 }} />;
}

function Dot({ color, className }: { color?: string; className?: string }) {
  return (
    <span
      className={cn('inline-block w-1.5 h-1.5 rounded-sm mr-1 align-middle', className)}
      style={color ? { background: color } : undefined}
    />
  );
}

function Tile({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string | number;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <div
      className={cn(
        'rounded-2xl border p-3 sm:p-3.5',
        accent
          ? 'border-indigo-100 dark:border-indigo-900/50 bg-indigo-50/50 dark:bg-indigo-500/10'
          : 'border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900',
      )}
    >
      <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100 leading-none">{value}</p>
      <p className="text-[11px] text-gray-600 dark:text-gray-300 mt-1.5 font-medium">{label}</p>
      {hint && <p className="text-[10px] text-gray-400 mt-0.5 leading-tight">{hint}</p>}
    </div>
  );
}
