import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
  BarChart3,
  CalendarDays,
  ChevronRight,
  FileText,
  Info,
  Loader2,
  Target,
  TrendingUp,
  Trophy,
  type LucideIcon,
} from 'lucide-react';
import { REPORT_NAVY, UserShell } from '@/components/user/UserShell';
import { FilterSelect } from '@/components/user/FilterSelect';
import { SubjectBreakdown, SubjectKey, sortSubjects, type SubjectSort } from '@/components/user/SubjectBreakdown';
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

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-2.5 sm:gap-3 mb-3 sm:mb-4">
        <Tile
          icon={BarChart3}
          tone="orange"
          label="Average Score"
          value={`${averageValue}%`}
          hint={marksLabel(averageMarks, paperMax) ?? 'of all marks'}
        />
        <Tile
          icon={Target}
          tone="blue"
          label="Accuracy"
          value={totals ? `${totals.accuracy}%` : '—'}
          // Subject data is aggregated server-side across every attempt; it carries no
          // group or date dimension, so this tile can't follow the filters. Say so.
          hint="of questions you answered"
        />
        <Tile
          icon={Trophy}
          tone="green"
          label="Best Score"
          value={`${Math.round(best)}%`}
          hint={bestAttempt ? marksLabel(bestAttempt.score, maxMarksOf(bestAttempt) ?? paperMax) ?? undefined : undefined}
        />
        <Tile icon={FileText} tone="purple" label={`${trackNoun}s Taken`} value={done.length} />
        <Tile
          icon={CalendarDays}
          tone="amber"
          label="Days Active"
          value={`${activeDays} ${activeDays === 1 ? 'day' : 'days'}`}
          hint={rangeNarrowed ? 'in this range' : 'in this selection'}
          className="col-span-2 lg:col-span-1"
        />
      </div>

      {/* ── The headline insight, when the data supports one ─────────────────── */}
      {totals && totals.attemptRate < 70 && (
        <div className="mb-3 sm:mb-4 rounded-2xl border border-blue-100 dark:border-blue-900/50 bg-blue-50/60 dark:bg-brand-500/10 p-4">
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
                      <stop offset="0%" stopColor="#2f7fe0" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#2f7fe0" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#eef1f6" />
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
                  <Area type="monotone" dataKey="value" stroke="#2f7fe0" strokeWidth={2} fill="url(#perfFill)" />
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

        <div className="rounded-2xl p-4 text-white" style={{ background: REPORT_NAVY }}>
          <p className="text-sm font-bold mb-3">{rangeNarrowed ? rangeLabel(range) : 'Last 7 active days'}</p>
          <div className="flex items-center gap-4 mb-3">
            <div>
              <p className="text-2xl font-bold leading-none">{averageValue}%</p>
              <p className="text-[10px] text-blue-200/70 mt-1">
                Average across {done.length} {done.length === 1 ? 'attempt' : 'attempts'}
              </p>
            </div>
          </div>
          <div className="h-40">
            {rangeBars.length === 0 ? (
              <div className="h-full flex items-center justify-center text-[11px] text-blue-200/60">
                No attempts in this range.
              </div>
            ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rangeBars} barCategoryGap="28%">
                <CartesianGrid stroke="rgba(255,255,255,0.08)" />
                <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fontSize: 9, fill: '#93a4c8' }} />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 9, fill: '#93a4c8' }}
                  tickFormatter={(v: number) => `${v}%`}
                  width={30}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(255,255,255,0.06)' }}
                  contentStyle={{ borderRadius: 10, border: 'none', fontSize: 11, background: '#0b1630', color: '#fff' }}
                  formatter={(v: any) => [`${v}%`, 'Average']}
                />
                <Bar dataKey="value" radius={[4, 4, 0, 0]} fill="#4d8ef7" maxBarSize={44} />
              </BarChart>
            </ResponsiveContainer>
            )}
          </div>
          {rangeNote && (
            <p className="mt-2 pt-2 border-t border-white/10 text-[11px] leading-relaxed text-blue-200/70">
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
          {subjects.length > 0 && (
            <div className="flex items-center gap-4 flex-wrap">
              <SubjectKey />
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
              <SubjectBreakdown subjects={subjectColumns[0]} composition showKey={false} sort={subjectSort} />
              <SubjectBreakdown
                subjects={subjectColumns[1]}
                composition
                showKey={false}
                sort={subjectSort}
                className="mt-2.5 sm:mt-0"
              />
            </div>
            <p className="mt-4 flex items-start gap-2 rounded-xl border border-blue-100 dark:border-blue-900/50 bg-blue-50/60 dark:bg-brand-500/10 px-3 py-2.5 text-[11px] leading-relaxed text-gray-600 dark:text-gray-300">
              <Info className="w-3.5 h-3.5 mt-0.5 text-blue-500 dark:text-blue-400 flex-shrink-0" />
              Accuracy counts only the questions you answered. A subject with a handful answered can show a
              high percentage on very little evidence — the counts under each bar say how much.
            </p>
          </>
        )}
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
                      className="group flex items-center gap-3 rounded-xl border border-gray-100 dark:border-gray-800 px-3 py-2.5 hover:border-blue-200 dark:hover:border-blue-800 hover:bg-blue-50/30 dark:hover:bg-gray-800/40 transition-colors"
                    >
                      <span className="w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center flex-shrink-0">
                        <FileText className="w-4 h-4 text-blue-500" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs font-semibold text-gray-900 dark:text-gray-100 truncate">
                          {h.test_name ?? 'Test attempt'}
                        </span>
                        <span className="block text-[10px] text-gray-400 capitalize">
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

/** Each tile is tinted to its icon, so the row reads as five distinct figures at a glance. */
const TILE_TONES: Record<TileTone, { card: string; icon: string }> = {
  orange: {
    card: 'border-orange-100 bg-orange-50/60 dark:border-orange-900/40 dark:bg-orange-950/20',
    icon: 'bg-orange-100 text-orange-600 dark:bg-orange-500/15 dark:text-orange-300',
  },
  blue: {
    card: 'border-blue-100 bg-blue-50/60 dark:border-blue-900/40 dark:bg-blue-950/20',
    icon: 'bg-blue-100 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300',
  },
  green: {
    card: 'border-emerald-100 bg-emerald-50/60 dark:border-emerald-900/40 dark:bg-emerald-950/20',
    icon: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300',
  },
  purple: {
    card: 'border-violet-100 bg-violet-50/60 dark:border-violet-900/40 dark:bg-violet-950/20',
    icon: 'bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300',
  },
  amber: {
    card: 'border-amber-100 bg-amber-50/60 dark:border-amber-900/40 dark:bg-amber-950/20',
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
