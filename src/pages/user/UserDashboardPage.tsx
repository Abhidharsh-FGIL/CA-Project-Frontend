import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Flame,
  Gift,
  LineChart as LineChartIcon,
  Loader2,
  Receipt,
  Sparkles,
  Timer,
  TrendingUp,
} from 'lucide-react';
import { UserShell } from '@/components/user/UserShell';
import { useUserPortal } from '@/contexts/UserPortalContext';
import { useTnpscCatalog } from '@/hooks/use-tnpsc';
import { FilterSelect } from '@/components/user/FilterSelect';
import { SubjectBreakdown } from '@/components/user/SubjectBreakdown';
import { TestScoreCard } from '@/components/user/TestScoreCard';
import { useSubjectStrengths } from '@/hooks/use-subject-strengths';
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
import { ALL_TIME, DateRangeFilter, type DateRange } from '@/components/user/DateRangeFilter';
import type { ApiAttempt } from '@/lib/userPortalApi';
import {
  commonMaxMarks,
  getUserDashboardAnalytics,
  marksLabel,
  type UserDashboardAnalytics,
} from '@/lib/userDashboardApi';
import { cn } from '@/lib/utils';
import { BILLING_ENABLED } from '@/config/features';

// Validated for colour-blind separation (see dataviz validator). Do not extend past
// seven: a 14-hue version failed deutan separation, which is why more than seven
// subjects are shown as bars rather than ring slices.
const SUBJECT_COLORS = ['#6366f1', '#f59e0b', '#10b981', '#8b5cf6', '#ef4444', '#06b6d4', '#ec4899'];

/** Subjects the ring shows; beyond this the card switches to a ranked bar list. */
const SUBJECT_PREVIEW_COUNT = 6;

export default function UserDashboardPage() {
  const { user, assessments, history, isLoading } = useUserPortal();
  const { groups } = useTnpscCatalog();
  const [range, setRange] = useState<DateRange>(ALL_TIME);
  const [track, setTrack] = useState<ExamTrackKey>('mock');
  const preferredGroup = resolveGroupKey(user?.preferred_exam);
  const [group, setGroup] = useState<ExamGroupKey>(preferredGroup);

  /**
   * The group follows the registered exam until the aspirant picks one themselves.
   *
   * Keyed on the resolved value rather than fired once: the profile can arrive
   * after first render, or arrive incomplete and be refreshed, and a one-shot seed
   * misses the correction in both cases. `pinned` is what stops a later profile
   * refetch from yanking a deliberate choice back.
   */
  const [pinned, setPinned] = useState(false);
  useEffect(() => {
    if (!pinned) setGroup(preferredGroup);
  }, [preferredGroup, pinned]);
  const chooseGroup = (v: ExamGroupKey) => {
    setPinned(true);
    setGroup(v);
  };
  const [activeSubject, setActiveSubject] = useState<number | null>(null);
  const [showAllSubjects, setShowAllSubjects] = useState(false);

  const analyticsQuery = useQuery<UserDashboardAnalytics>({
    queryKey: ['user-dashboard-analytics', history.length, assessments.length],
    queryFn: () => getUserDashboardAnalytics(history, assessments.length),
    staleTime: 60_000,
  });
  const a = analyticsQuery.data;

  const {
    points: chartTrend,
    caption: trendCaption,
    attempts: filteredAttempts,
    isLoading: groupIndexLoading,
    ceiling: trendMax,
  } = useProgressTrend({ analytics: a, history, group, track, range });

  /**
   * Subject strengths for the selected group. The server's aggregate has no group
   * dimension, so picking a group re-aggregates from those attempts' own breakdowns.
   */
  const {
    subjects: allSubjects,
    overallAccuracy,
    isLoading: subjectsLoading,
    truncated: subjectsTruncated,
  } = useSubjectStrengths({ analytics: a, attempts: filteredAttempts, scoped: true });

  // The ring and the legend must show the same six subjects — previously the ring drew
  // every subject while the legend listed six, so half the ring had no key.
  // The ring only ever draws the preview set. Beyond that the card switches to bars,
  // which don't need a distinguishable hue per subject.
  const topSubjects = useMemo(
    () => allSubjects.slice(0, SUBJECT_PREVIEW_COUNT),
    [allSubjects],
  );
  const hiddenSubjects = Math.max(0, allSubjects.length - topSubjects.length);

  const weakestSubject = useMemo(() => {
    const scored = allSubjects.filter(sub => (sub.attempted ?? 0) > 0);
    if (scored.length < 2) return null;
    return scored.reduce((lo, sub) => (sub.accuracy < lo.accuracy ? sub : lo), scored[0]);
  }, [allSubjects]);

  /** Totals behind the centre figure — shown when nothing is hovered. */
  const answeredTotals = useMemo(() => {
    const list = allSubjects;
    let correct = 0;
    let attempted = 0;
    for (const sub of list) {
      if (sub.correct == null || sub.attempted == null) continue;
      correct += sub.correct;
      attempted += sub.attempted;
    }
    return attempted > 0 ? { correct, attempted } : null;
  }, [allSubjects]);

  /** Marks behind the average, so "3%" isn't shown without its denominator. */
  const averageMarks = useMemo(() => {
    if (filteredAttempts.length === 0) return null;
    const avg =
      Math.round((filteredAttempts.reduce((sum, h) => sum + (h.score ?? 0), 0) / filteredAttempts.length) * 10) / 10;
    return marksLabel(avg, commonMaxMarks(filteredAttempts));
  }, [filteredAttempts]);

  /**
   * The headline tiles, recomputed from the attempts the current group/test
   * selection actually covers.
   *
   * The server's own tiles carry no group or track dimension, so under a selection
   * they report the whole account — a "Group 4 · Mock tests" view would fold a
   * GAT-B practice run into its average and read as a contradiction.
   */
  const stats = useMemo(() => {
    const now = Date.now();
    const daysAgo = (d: number) => now - d * 864e5;
    const at = (h: ApiAttempt) => +new Date(h.start_time);
    const between = (from: number, to: number) => filteredAttempts.filter(h => at(h) >= from && at(h) < to);

    const thisWeek = between(daysAgo(7), now);
    const lastWeek = between(daysAgo(14), daysAgo(7));

    // A percentage change needs a non-zero base; with nothing last week there is no
    // "vs last week" to state, so the tile shows no delta rather than a fake one.
    const changePct = (cur: number, prev: number) => (prev > 0 ? Math.round(((cur - prev) / prev) * 100) : null);
    const mean = (list: ApiAttempt[]) =>
      list.length === 0 ? null : list.reduce((sum, h) => sum + (h.percentage ?? 0), 0) / list.length;

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const avg = mean(filteredAttempts);
    const avgThisWeek = mean(thisWeek);
    const avgLastWeek = mean(lastWeek);

    return {
      attempted: filteredAttempts.length,
      attemptedDelta: changePct(thisWeek.length, lastWeek.length),
      average: avg == null ? 0 : Math.round(avg),
      // Scores already are percentages, so the shift is stated in points rather
      // than as a percentage of a percentage.
      averageDelta:
        avgThisWeek != null && avgLastWeek != null ? Math.round(avgThisWeek - avgLastWeek) : null,
      thisMonth: filteredAttempts.filter(h => at(h) >= +monthStart).length,
    };
  }, [filteredAttempts]);

  /** Assigned work for the selected track. Assessments carry no group, only a mode. */
  const scopedAssessments = useMemo(
    () => assessments.filter(x => x.mode === track),
    [assessments, track],
  );

  const recent = useMemo(() => filteredAttempts.slice(0, 3), [filteredAttempts]);


  /**
   * Two lines under the curve, read off the curve.
   *
   * The caption above it says what is being plotted; this says what it did — a
   * chart that needs the reader to infer the trend from its own slope is only
   * half-finished (§1 "Every chart explains itself").
   */
  const trendNote = useMemo(() => {
    if (chartTrend.length < 2) return null;
    const first = chartTrend[0];
    const last = chartTrend[chartTrend.length - 1];
    const delta = Math.round((last.value - first.value) * 10) / 10;
    const peak = chartTrend.reduce((hi, p) => (p.value > hi.value ? p : hi), chartTrend[0]);
    const direction =
      delta > 0.5 ? `up ${delta} points` : delta < -0.5 ? `down ${Math.abs(delta)} points` : 'broadly flat';
    return `Your rolling average is ${direction} across this period, from ${first.value}% on ${first.label} to ${last.value}% on ${last.label}. Best day so far was ${peak.label} at ${peak.value}%.`;
  }, [chartTrend]);

  /** Same idea for the weekly bars, which otherwise show a number with no reading. */
  const weeklyNote = useMemo(() => {
    const days = a?.weekly_performance?.days ?? [];
    const active = days.filter(d => (d.value ?? 0) > 0);
    if (active.length === 0) return null;
    const best = active.reduce((hi, d) => ((d.value ?? 0) > (hi.value ?? 0) ? d : hi));
    return `${active.length} of ${days.length} days had a submitted test. Strongest was ${best.day} at ${best.value}%.`;
  }, [a?.weekly_performance?.days]);

  /** What the selection is called, for tile labels and empty states. */
  const trackNoun = track === 'mock' ? 'Mock Test' : 'Practice Test';
  const groupLabel = EXAM_GROUP_OPTIONS.find(o => o.value === group)!.label;

  /** The exam card for the selected group — the page shows one exam at a time. */
  const visibleGroups = useMemo(() => groups.filter(g => g.id === group), [groups, group]);

  /**
   * Deep link into the selected group's live stage, so "Take Mock Test" lands on
   * the exam the page is already showing rather than a global list.
   */
  const trackHref = (mode: ExamTrackKey) => `/user/exams/${group}/${GROUP_STAGE[group]}?tab=${mode}`;

  if (!user) return null;
  if (isLoading) {
    return (
      <UserShell>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        </div>
      </UserShell>
    );
  }

  return (
    <UserShell>
      {/* ── Greeting ─────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-3 flex-wrap mb-4 sm:mb-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">
            Welcome back, <span className="text-indigo-600 dark:text-indigo-400">{user.name.split(' ')[0]}</span>! 👋
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-0.5 sm:mt-1">
            Let's continue your preparation and achieve success.
          </p>
        </div>
        {/* These two scope every card below, so they lead the page rather than
            sitting inside one card as that card's own filter. */}
        <div className="flex items-center gap-2 flex-wrap">
          <FilterSelect value={group} options={EXAM_GROUP_OPTIONS} onChange={chooseGroup} ariaLabel="Exam group" />
          <FilterSelect value={track} options={EXAM_TRACK_OPTIONS} onChange={v => setTrack(v)} ariaLabel="Test type" />
          <DateRangeFilter value={range} onChange={setRange} />
        </div>
      </div>

      {/* ── Stats ────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3 mb-3 sm:mb-4">
        <StatCard
          icon={<ClipboardList className="w-5 h-5" />}
          tone="indigo"
          value={scopedAssessments.length}
          label={`${trackNoun}s Assigned`}
          delta={null}
        />
        <StatCard
          icon={<Timer className="w-5 h-5" />}
          tone="emerald"
          value={stats.attempted}
          label={`${trackNoun}s Attempted`}
          delta={stats.attemptedDelta}
        />
        <StatCard
          icon={<TrendingUp className="w-5 h-5" />}
          tone="amber"
          value={`${stats.average}%`}
          label="Average Score"
          hint={averageMarks}
          delta={stats.averageDelta}
        />
        <StatCard
          icon={<LineChartIcon className="w-5 h-5" />}
          tone="rose"
          value={stats.thisMonth}
          label={`${trackNoun}s Taken This Month`}
          delta={null}
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-3 sm:gap-4">
        {/* ── Left: progress + strengths ─────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-3 sm:space-y-4">
          <Card>
            <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
              <div className="min-w-0">
                <p className="text-sm font-bold text-gray-900 dark:text-gray-100">Overall Preparation Progress</p>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">{trendCaption}</p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Link
                  to="/user/performance"
                  className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline whitespace-nowrap"
                >
                  View detailed report
                </Link>
              </div>
            </div>
            {groupIndexLoading ? (
              <div className="h-44 sm:h-56 flex items-center justify-center">
                <Loader2 className="w-5 h-5 animate-spin text-gray-300" />
              </div>
            ) : chartTrend.length > 0 ? (
              <div className="-ml-1">
                <div className="h-44 sm:h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartTrend} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                    <defs>
                      <linearGradient id="progressFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#6366f1" stopOpacity={0.35} />
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
                    <YAxis
                      domain={[0, trendMax]}
                      tickFormatter={(v: number) => `${v}%`}
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 10, fill: '#9ca3af' }}
                      width={40}
                    />
                    <Tooltip
                      contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb', fontSize: 12 }}
                      formatter={(v: any) => [`${v}%`, 'Rolling average']}
                      labelFormatter={formatTrendLabel}
                    />
                    <Area type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={2.5} fill="url(#progressFill)" />
                  </AreaChart>
                </ResponsiveContainer>
                </div>
                {trendNote && (
                  <p className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-800 text-[10px] leading-relaxed text-gray-500 dark:text-gray-400">
                    {trendNote}
                  </p>
                )}
              </div>
            ) : (
              <Empty
                icon={<TrendingUp className="w-5 h-5" />}
                text={
                  range.key === 'all'
                    ? `Your ${groupLabel} curve starts after your first submitted ${trackNoun.toLowerCase()}.`
                    : `No ${trackNoun.toLowerCase()}s in ${groupLabel} over this period.`
                }
                action={
                  range.key === 'all' ? (
                    <Link to={trackHref(track)} className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline">
                      Take a {trackNoun.toLowerCase()}
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setRange(ALL_TIME)}
                      className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                    >
                      Show all time
                    </button>
                  )
                }
              />
            )}
          </Card>

          <TestScoreCard
            attempts={filteredAttempts}
            scopeLabel={`${groupLabel} · ${trackNoun.toLowerCase()}s`}
            trackNoun={trackNoun}
            takeHref={trackHref(track)}
            isLoading={groupIndexLoading}
          />

          {/* Continue your preparation */}
          <div>
            <SectionHead title="Continue Your Preparation" href="/user/exams" />
            <div className={cn('grid gap-3', visibleGroups.length > 1 && 'sm:grid-cols-2')}>
              {visibleGroups.map(g => {
                const open = g.stages.filter(s => s.status === 'active').length;
                return (
                  <Link
                    key={g.id}
                    to={`/user/exams/${g.id}`}
                    className="group relative overflow-hidden rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 hover:shadow-lg hover:border-indigo-200 dark:hover:border-indigo-800 transition-all"
                  >
                    <div className={cn('absolute inset-x-0 top-0 h-1 bg-gradient-to-r', g.accent)} />
                    <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-indigo-500">
                      {g.authority}
                    </p>
                    <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 mt-1">{g.name}</h3>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400">{g.tagline}</p>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-2 line-clamp-2">{g.description}</p>
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {g.stages.map(s => (
                        <span
                          key={s.id}
                          className={cn(
                            'text-[10px] font-semibold px-2 py-0.5 rounded-md border',
                            s.status === 'active'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                              : 'bg-gray-50 text-gray-400 border-gray-200 dark:bg-gray-800 dark:border-gray-700',
                          )}
                        >
                          {s.short_name}{s.status !== 'active' && ' · soon'}
                        </span>
                      ))}
                    </div>
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                      <span className="text-[11px] text-gray-500">
                        {g.stages.length} stage{g.stages.length !== 1 ? 's' : ''} · {open} open now
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 dark:text-indigo-400">
                        Continue <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Assigned assessments */}
          <div>
            <SectionHead title={`Assigned ${trackNoun}s`} href="/user/exams" />
            {scopedAssessments.length === 0 ? (
              <Card>
                <Empty
                  text={
                    assessments.length === 0
                      ? 'Nothing assigned right now — pick an exam above to start a mock or practice test.'
                      : `Nothing assigned under ${trackNoun.toLowerCase()}s. Switch the test dropdown to see the rest.`
                  }
                />
              </Card>
            ) : (
              <div className="grid xs:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
                {scopedAssessments.slice(0, 4).map(x => (
                  <Link
                    key={x.assessment_id}
                    to={`/user/assessment/${x.assessment_id}`}
                    className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-3 hover:shadow-md hover:border-indigo-200 dark:hover:border-indigo-800 transition-all"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-bold text-gray-900 dark:text-gray-100 line-clamp-2">{x.title}</p>
                      <span className={cn(
                        'text-[8px] font-bold px-1.5 py-0.5 rounded flex-shrink-0',
                        x.mode === 'mock'
                          ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300'
                          : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
                      )}>
                        {x.mode === 'mock' ? 'MOCK' : 'PRACTICE'}
                      </span>
                    </div>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1.5">
                      {x.question_count} questions
                    </p>
                    <p className="text-[10px] text-gray-400 capitalize">
                      {x.difficulty ?? '—'} · {x.time_limit_minutes ? `${x.time_limit_minutes} min` : 'Untimed'}
                    </p>
                    <p className="text-[10px] text-gray-400 mt-1">
                      {x.due_date
                        ? `Due ${new Date(x.due_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}`
                        : 'No deadline'}
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Quick actions */}
          <div>
            <SectionHead title="Quick Actions" />
            <div className="grid grid-cols-4 gap-2 sm:gap-3">
              <QuickAction to={trackHref('mock')} icon={<Timer className="w-4 h-4" />} label="Take Mock Test" tone="indigo" />
              <QuickAction to={trackHref('practice')} icon={<BookOpen className="w-4 h-4" />} label="Practice Now" tone="emerald" />
              <QuickAction to="/user/performance" icon={<LineChartIcon className="w-4 h-4" />} label="View Performance" tone="amber" />
              <QuickAction to="/user/history" icon={<Receipt className="w-4 h-4" />} label="Test History" tone="rose" />
            </div>
          </div>
        </div>

        {/* ── Right rail ─────────────────────────────────────────────────── */}
        <div className="space-y-3 sm:space-y-4">
          {/* Strengths */}
          <Card>
            <CardHead
              title="Strengths by Subject"
              subtitle={
                allSubjects.length === 0
                  ? undefined
                  : showAllSubjects || hiddenSubjects === 0
                    ? `Accuracy on the questions you answered · all ${allSubjects.length} subjects`
                    : `Accuracy on the questions you answered · your ${topSubjects.length} strongest`
              }
            />
            {subjectsLoading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="w-5 h-5 animate-spin text-gray-300" />
              </div>
            ) : allSubjects.length > 0 ? (
              <>
                <div className="flex items-center gap-3">
                <div
                  className="relative w-[120px] h-[120px] flex-shrink-0"
                  onMouseLeave={() => setActiveSubject(null)}
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={topSubjects}
                        dataKey="accuracy"
                        nameKey="subject"
                        innerRadius={38}
                        outerRadius={56}
                        paddingAngle={2}
                        stroke="none"
                        onMouseEnter={(_, i) => setActiveSubject(i)}
                      >
                        {topSubjects.map((_, i) => (
                          <Cell
                            key={i}
                            fill={SUBJECT_COLORS[i % SUBJECT_COLORS.length]}
                            // Dim the rest rather than move the slice — the ring keeps
                            // its shape, so nothing appears to change value on hover.
                            opacity={activeSubject == null || activeSubject === i ? 1 : 0.28}
                            style={{ transition: 'opacity 120ms', cursor: 'pointer' }}
                          />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none px-4">
                    <span className="text-lg font-bold text-gray-900 dark:text-gray-100 leading-none">
                      {activeSubject != null
                        ? `${Math.round(topSubjects[activeSubject].accuracy)}%`
                        : overallAccuracy != null
                          ? `${overallAccuracy}%`
                          : '—'}
                    </span>
                    <span className="text-[9px] text-gray-400 text-center leading-tight mt-0.5">
                      Accuracy
                    </span>
                  </div>
                </div>
                <ul className="flex-1 space-y-1.5 min-w-0" onMouseLeave={() => setActiveSubject(null)}>
                  {topSubjects.map((sub, i) => (
                    <li
                      key={sub.subject}
                      onMouseEnter={() => setActiveSubject(i)}
                      title={
                        sub.correct != null && sub.attempted != null
                          ? `${sub.subject} — ${sub.correct} of ${sub.attempted} answered correctly`
                          : sub.subject
                      }
                      className={cn(
                        'flex items-center gap-2 text-[11px] rounded-md px-1 -mx-1 py-0.5 cursor-default transition-colors',
                        activeSubject === i && 'bg-gray-50 dark:bg-gray-800',
                      )}
                    >
                      <span
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ background: SUBJECT_COLORS[i % SUBJECT_COLORS.length] }}
                      />
                      <span className="truncate text-gray-600 dark:text-gray-300">{sub.subject}</span>
                      <span className="ml-auto font-bold text-gray-900 dark:text-gray-100">
                        {Math.round(sub.accuracy)}%
                      </span>
                    </li>
                  ))}
                  {(hiddenSubjects > 0 || showAllSubjects) && (
                    <li className="pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setShowAllSubjects(v => !v);
                          setActiveSubject(null);
                        }}
                        className="inline-flex items-center gap-1 text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                      >
                        {showAllSubjects ? (
                          <>Show top {SUBJECT_PREVIEW_COUNT} <ChevronUp className="w-3 h-3" /></>
                        ) : (
                          <>Show all {allSubjects.length} subjects <ChevronDown className="w-3 h-3" /></>
                        )}
                      </button>
                    </li>
                  )}
                </ul>
                </div>

                {showAllSubjects && (
                  <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-2">
                      All {allSubjects.length} subjects · focus areas first
                    </p>
                    <div className="max-h-[220px] overflow-y-auto scrollbar-thin pr-1">
                      <SubjectBreakdown subjects={allSubjects} sort="weakest" />
                    </div>
                  </div>
                )}
                {/* Fixed detail row — reserved height, so hovering never reflows the card. */}
                <p className="mt-3 pt-2.5 border-t border-gray-100 dark:border-gray-800 text-[10px] leading-snug text-gray-500 dark:text-gray-400 min-h-[2rem]">
                  {activeSubject != null ? (
                    <>
                      <span
                        className="inline-block w-2 h-2 rounded-full mr-1.5 align-middle"
                        style={{ background: SUBJECT_COLORS[activeSubject % SUBJECT_COLORS.length] }}
                      />
                      <span className="font-semibold text-gray-700 dark:text-gray-200">
                        {topSubjects[activeSubject].subject}
                      </span>
                      {topSubjects[activeSubject].correct != null &&
                        topSubjects[activeSubject].attempted != null && (
                          <>
                            {' — '}
                            {topSubjects[activeSubject].correct} of {topSubjects[activeSubject].attempted} answered
                            correctly
                            {topSubjects[activeSubject].total_questions != null &&
                              topSubjects[activeSubject].attempted! < topSubjects[activeSubject].total_questions! && (
                                <>
                                  {' · '}
                                  {topSubjects[activeSubject].total_questions! -
                                    topSubjects[activeSubject].attempted!}{' '}
                                  left blank
                                </>
                              )}
                          </>
                        )}
                    </>
                  ) : (
                    <>
                      {answeredTotals && (
                        <>
                          {answeredTotals.correct} of {answeredTotals.attempted} answered correctly across{' '}
                          {allSubjects.length} subjects
                          {` in ${groupLabel}`}.{' '}
                          {subjectsTruncated && 'Based on your 25 most recent attempts. '}
                        </>
                      )}
                      {/* The list is sorted strongest-first, so the subject that most needs
                          work is the one furthest from view. Call it out regardless. */}
                      {weakestSubject && (
                        <>
                          Weakest:{' '}
                          <span className="font-semibold text-gray-700 dark:text-gray-200">
                            {weakestSubject.subject}
                          </span>{' '}
                          ({Math.round(weakestSubject.accuracy)}%) —{' '}
                          <Link to="/user/practice" className="text-indigo-600 dark:text-indigo-400 hover:underline">
                            practise it
                          </Link>
                          .
                        </>
                      )}
                    </>
                  )}
                </p>
              </>
            ) : (
              <div className="flex items-center gap-3 py-1">
                <div className="w-[76px] h-[76px] rounded-full border-[10px] border-gray-100 dark:border-gray-800 flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  {[0, 1, 2].map(i => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-gray-100 dark:bg-gray-800" />
                      <span className="h-2 rounded bg-gray-100 dark:bg-gray-800" style={{ width: `${70 - i * 14}%` }} />
                    </div>
                  ))}
                  <p className="text-[10px] text-gray-400 pt-0.5 leading-snug">
                    Appears once your attempts have been analysed.
                  </p>
                </div>
              </div>
            )}
          </Card>

          {/* Recent activity */}
          <Card>
            <CardHead
              title="Recent Activity"
              subtitle={`${groupLabel} · ${trackNoun.toLowerCase()}s`}
              action={<Link to="/user/history" className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline">View all</Link>}
            />
            {recent.length === 0 ? (
              <Empty text={`No ${trackNoun.toLowerCase()}s taken under this selection yet.`} />
            ) : (
              <ul className="space-y-2">
                {recent.map(r => (
                  <li key={r.attempt_id}>
                    <Link
                      to={`/user/report/${r.attempt_id}`}
                      className="flex items-center gap-2.5 rounded-xl px-2 py-2 -mx-2 hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors"
                    >
                      <span className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center flex-shrink-0">
                        <ClipboardList className="w-4 h-4 text-indigo-500" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs font-semibold text-gray-900 dark:text-gray-100 truncate">
                          {r.test_name ?? 'Test attempt'}
                        </span>
                        <span className="block text-[10px] text-gray-400">
                          {new Date(r.start_time).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                        </span>
                      </span>
                      <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                        {r.percentage != null ? `${Math.round(r.percentage)}%` : '—'}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* Weekly performance — dark card */}
          <div className="rounded-2xl bg-gray-900 dark:bg-gray-800 p-4 text-white">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-bold">Weekly Performance</p>
              <Link to="/user/performance" className="text-[11px] font-semibold text-indigo-300 hover:underline">
                View report
              </Link>
            </div>
            <div className="flex items-center gap-4 mb-3">
              <div>
                <p className="text-xl font-bold">{a?.weekly_performance?.average ?? 0}%</p>
                <p className="text-[10px] text-gray-400">Average Score (%)</p>
              </div>
              {a?.weekly_performance?.improvement != null && (
                <div className="flex items-center gap-1 text-emerald-400 text-xs font-semibold">
                  <ArrowUpRight className="w-3.5 h-3.5" />
                  {a.weekly_performance?.improvement > 0 ? '+' : ''}
                  {a.weekly_performance?.improvement}% Improvement
                </div>
              )}
            </div>
            <div className="h-20 sm:h-24">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={a?.weekly_performance?.days ?? []} barCategoryGap="28%">
                  <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fontSize: 9, fill: '#9ca3af' }} />
                  <Tooltip
                    cursor={{ fill: 'rgba(255,255,255,0.06)' }}
                    contentStyle={{ borderRadius: 10, border: 'none', fontSize: 11, background: '#111827', color: '#fff' }}
                    formatter={(v: any) => [`${v}%`, 'Average']}
                  />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]} fill="#818cf8" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            {weeklyNote && (
              <p className="mt-2 pt-2 border-t border-white/10 text-[10px] leading-relaxed text-gray-400">
                {weeklyNote}
              </p>
            )}
          </div>

          {/* Study streak */}
          <Card>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-gray-900 dark:text-gray-100">Study Streak</p>
                <p className="mt-1 flex items-center gap-1.5 text-lg font-bold text-amber-500">
                  <Flame className="w-5 h-5" /> {a?.streak?.days ?? 0} Days
                </p>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                  Keep it up! Consistency is the key.
                </p>
              </div>
              <Gift className="w-8 h-8 text-rose-400 flex-shrink-0" />
            </div>
            <div className="flex items-center justify-between mt-4">
              {(a?.streak?.week ?? []).map((d, i) => (
                <div key={d.date ?? i} className="flex flex-col items-center gap-1">
                  <span
                    className={cn(
                      'w-7 h-7 rounded-full flex items-center justify-center',
                      d.streak
                        ? 'bg-emerald-500 text-white'
                        : d.active
                          // Studied, but the run broke after it — shown so the day isn't
                          // erased, muted so it can't be mistaken for streak days.
                          ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-300 dark:text-gray-600',
                    )}
                    title={d.active ? `Studied on ${d.date}` : `No activity on ${d.date}`}
                  >
                    {d.streak ? (
                      <Check className="w-3.5 h-3.5" />
                    ) : d.active ? (
                      <span className="w-1.5 h-1.5 rounded-full bg-current" />
                    ) : (
                      <span className="text-[10px]">·</span>
                    )}
                  </span>
                  <span className="text-[9px] text-gray-400">{d.day.charAt(0)}</span>
                </div>
              ))}
            </div>
          </Card>

          {BILLING_ENABLED && user.subscription_tier === 'free' && (
            <div className="rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 p-4 text-white">
              <Sparkles className="w-5 h-5 mb-2" />
              <p className="text-sm font-bold">Unlock unlimited mocks, detailed analytics &amp; more</p>
              <p className="text-[11px] text-white/80 mt-1">Upgrade to browse and attempt every mock test.</p>
              <Link
                to="/user/subscription"
                className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-white text-indigo-700 text-xs font-bold px-3.5 py-2 hover:bg-white/90 transition-colors"
              >
                Upgrade Now <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          )}
        </div>
      </div>
    </UserShell>
  );
}

// ─── Pieces ────────────────────────────────────────────────────────────────────

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-4', className)}>
      {children}
    </div>
  );
}

function CardHead({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 mb-3">
      <div className="min-w-0">
        <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{title}</p>
        {subtitle && <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

function SectionHead({ title, href }: { title: string; href?: string }) {
  return (
    <div className="flex items-center justify-between mb-2.5">
      <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">{title}</h2>
      {href && (
        <Link to={href} className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline">
          View all
        </Link>
      )}
    </div>
  );
}

function Empty({
  text,
  icon,
  action,
  compact,
}: {
  text: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={cn('text-center', compact ? 'py-5' : 'py-10')}>
      {icon && (
        <span className="inline-flex w-9 h-9 rounded-xl bg-gray-50 dark:bg-gray-800 text-gray-400 items-center justify-center mb-2">
          {icon}
        </span>
      )}
      <p className="text-xs text-gray-400 dark:text-gray-500 max-w-[15rem] mx-auto leading-relaxed">{text}</p>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

const TONE: Record<string, string> = {
  indigo: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400',
  emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400',
  amber: 'bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400',
  rose: 'bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400',
};

function StatCard({
  icon,
  value,
  label,
  hint,
  delta,
  tone,
}: {
  icon: React.ReactNode;
  value: string | number;
  label: string;
  /** The marks behind a percentage — shown instead of the delta when present. */
  hint?: string | null;
  delta?: number | null;
  tone: keyof typeof TONE;
}) {
  return (
    <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-3 sm:p-3.5 flex items-center gap-3">
      <span className={cn('inline-flex w-10 h-10 rounded-xl items-center justify-center flex-shrink-0', TONE[tone])}>
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100 leading-none">{value}</p>
        <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1 leading-tight">{label}</p>
        {hint && <p className="text-[10px] text-gray-400 mt-0.5 leading-tight truncate">{hint}</p>}
        {delta != null && !hint && (
          <p className={cn('text-[10px] font-semibold mt-0.5', delta >= 0 ? 'text-emerald-600' : 'text-rose-500')}>
            {delta >= 0 ? '↑' : '↓'} {Math.abs(delta)}% vs last week
          </p>
        )}
      </div>
    </div>
  );
}

function QuickAction({
  to,
  icon,
  label,
  tone,
}: {
  to: string;
  icon: React.ReactNode;
  label: string;
  tone: keyof typeof TONE;
}) {
  return (
    <Link
      to={to}
      className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-2.5 sm:p-3 flex flex-col items-center gap-1.5 sm:gap-2 hover:shadow-md hover:border-indigo-200 dark:hover:border-indigo-800 transition-all"
    >
      <span className={cn('w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center', TONE[tone])}>{icon}</span>
      <span className="text-[10px] sm:text-[11px] font-semibold text-gray-700 dark:text-gray-300 text-center leading-tight">{label}</span>
    </Link>
  );
}
