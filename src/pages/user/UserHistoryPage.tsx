import { useState, useMemo, useEffect, type ReactNode } from 'react';
import { displayTitle } from '@/lib/display-title';
import { Link, useSearchParams } from 'react-router-dom';
import { readPerformanceView } from '@/lib/performance-view';
import { here } from '@/lib/report-origin';
import { UserShell } from '@/components/user/UserShell';
import { useUserPortal } from '@/contexts/UserPortalContext';
import { useReportGate } from '@/hooks/use-report-gate';
import {
  Search,
  FileText,
  Loader2,
  XCircle,
  Trophy,
  Target,
  BarChart3,
  CalendarDays,
  ClipboardList,
  PlayCircle,
  PauseCircle,
  Clock,
  ChevronRight,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { FilterSelect, type FilterOption } from '@/components/user/FilterSelect';
import type { ApiAttempt } from '@/lib/userPortalApi';
import { ALL_TIME, DateRangeFilter, inRange, isoDay, type DateRange } from '@/components/user/DateRangeFilter';
import { GROUP_OPTIONS, TRACK_OPTIONS, useGroupMatcher, type GroupKey, type TrackKey } from '@/hooks/use-progress-trend';
import { commonMaxMarks, marksLabel, maxMarksOf } from '@/lib/userDashboardApi';
import { attemptOutcome, durationLabel, isUnfinished, scoreTone, type AttemptOutcome, type ScoreTone } from '@/lib/attempt-history';

type StatusKey = 'all' | 'completed' | 'unfinished';

const STATUS_OPTIONS: FilterOption<StatusKey>[] = [
  { value: 'all', label: 'All attempts' },
  { value: 'completed', label: 'Completed', hint: 'Scored and reported' },
  { value: 'unfinished', label: 'Not submitted', hint: 'Started, never finished' },
];

/** The attempts table's columns from `md` up; below it each attempt is a small card. Level only where the group has one. */
const COLUMNS_WITH_LEVEL =
  'md:grid-cols-[minmax(0,2.2fr)_minmax(104px,0.9fr)_minmax(72px,0.55fr)_minmax(160px,1.3fr)_minmax(64px,0.55fr)_minmax(118px,0.9fr)_minmax(100px,0.8fr)]';
const COLUMNS_NO_LEVEL =
  'md:grid-cols-[minmax(0,2.4fr)_minmax(104px,0.9fr)_minmax(160px,1.3fr)_minmax(64px,0.55fr)_minmax(118px,0.9fr)_minmax(100px,0.8fr)]';

/** A trailing difficulty in a practice paper's name — "இலக்கணம் · Simple" — is a column of its own, not part of the name. */
const LEVEL_TAIL = /\s*[·•|-]\s*(Simple|Medium|Complex|Mixed|Easy|Hard)\s*$/i;
function splitLevel(title: string | null): { name: string; level: string | null } {
  const t = displayTitle(title) ?? 'Test Attempt';
  const m = t.match(LEVEL_TAIL);
  if (!m || m.index == null) return { name: t, level: null };
  return { name: t.slice(0, m.index).trim() || t, level: m[1][0].toUpperCase() + m[1].slice(1).toLowerCase() };
}

const LEVEL_CHIP: Record<string, string> = {
  Simple: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900',
  Easy: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900',
  Medium: 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900',
  Complex: 'bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:ring-rose-900',
  Hard: 'bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:ring-rose-900',
  Mixed: 'bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:ring-sky-900',
};

/** The groups the list is cut into, in the order they are shown. */
const GROUPS: Array<{ key: string; label: string; modes: string[] }> = [
  { key: 'mock', label: 'Mock tests', modes: ['mock'] },
  { key: 'practice', label: 'Practice tests', modes: ['practice'] },
  { key: 'other', label: 'Other tests', modes: [] },
];

export default function UserHistoryPage() {
  const { history, courses, assessments, refreshHistory } = useUserPortal();

  useEffect(() => {
    refreshHistory();
  }, [refreshHistory]);
  const [query, setQuery] = useState('');
  const [courseFilter, setCourseFilter] = useState<string>('all');
  // The dashboard's "View all" carries the exam, test type and range it was showing; start on those.
  const [searchParams] = useSearchParams();
  const fromLink = useMemo(() => readPerformanceView(searchParams), []); // only the view that was opened
  const [modeFilter, setModeFilter] = useState<TrackKey>(fromLink.track ?? 'all');
  const [range, setRange] = useState<DateRange>(fromLink.range ?? ALL_TIME);
  const [statusFilter, setStatusFilter] = useState<StatusKey>('all');
  const [group, setGroup] = useState<GroupKey>(fromLink.group ?? 'all');

  // Attempts carry no group id, so the group's catalog decides which tests belong to it.
  const { matchesGroup, isLoading: groupLoading } = useGroupMatcher(group);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return history.filter(h => {
      if (q && !(h.test_name ?? '').toLowerCase().includes(q)) return false;
      if (courseFilter !== 'all' && h.course_id !== courseFilter) return false;
      if (modeFilter !== 'all' && h.test_mode !== modeFilter) return false;
      if (!inRange(isoDay(new Date(h.start_time)), range)) return false;
      if (statusFilter === 'unfinished' && !isUnfinished(h)) return false;
      if (statusFilter === 'completed' && isUnfinished(h)) return false;
      if (!matchesGroup(h)) return false;
      return true;
    });
  }, [history, query, courseFilter, modeFilter, range, statusFilter, matchesGroup]);

  /** Started but never submitted — no score was ever recorded. */
  const unfinished = useMemo(() => history.filter(isUnfinished), [history]);

  /**
   * An unfinished attempt is only resumable if we can find the assessment behind it.
   * Attempts carry `test_id`; assessments are keyed by `assessment_id`, and the two
   * line up for eval assessments — falling back to the title covers the rest.
   */
  const resumeTargetFor = useMemo(() => {
    const byId = new Map(assessments.map(x => [x.assessment_id, x.assessment_id]));
    const byTitle = new Map(assessments.map(x => [x.title.trim().toLowerCase(), x.assessment_id]));
    return (h: (typeof history)[number]) =>
      byId.get(h.test_id) ?? (h.test_name ? byTitle.get(h.test_name.trim().toLowerCase()) : undefined) ?? null;
  }, [assessments]);

  const filtersActive =
    query.trim() !== '' ||
    courseFilter !== 'all' ||
    modeFilter !== 'all' ||
    range.key !== 'all' ||
    statusFilter !== 'all' ||
    group !== 'all';

  const clearFilters = () => {
    setQuery('');
    setCourseFilter('all');
    setModeFilter('all');
    setRange(ALL_TIME);
    setStatusFilter('all');
    setGroup('all');
  };

  const stats = useMemo(() => {
    const completed = filtered.filter(h => h.status !== 'in_progress' && h.percentage !== null);
    const bestScore = completed.length ? Math.max(...completed.map(h => h.percentage ?? 0)) : 0;
    const avgScore = completed.length
      ? Math.round(completed.reduce((s, h) => s + (h.percentage ?? 0), 0) / completed.length)
      : 0;
    const totalAttempts = completed.length;
    const thisMonth = completed.filter(h => {
      const d = new Date(h.start_time);
      const now = new Date();
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length;
    // Marks behind the percentages — "Best Score 11%" alone doesn't say 33 of 300.
    const paperMax = commonMaxMarks(completed);
    const bestAttempt = completed.reduce<(typeof completed)[number] | null>(
      (top, h) => (top == null || (h.percentage ?? 0) > (top.percentage ?? 0) ? h : top),
      null,
    );
    const avgMarks = completed.length
      ? Math.round((completed.reduce((sum, h) => sum + (h.score ?? 0), 0) / completed.length) * 10) / 10
      : null;
    return {
      bestScore,
      avgScore,
      totalAttempts,
      thisMonth,
      bestMarks: bestAttempt ? marksLabel(bestAttempt.score, maxMarksOf(bestAttempt) ?? paperMax) : null,
      avgMarks: marksLabel(avgMarks, paperMax),
      // A 0% attempt can't give its own paper size, so a row falls back to the one they share.
      paperMax,
    };
  }, [filtered]);

  // Practice and mock attempts each get a table of their own, so a row never has to say which it is.
  const grouped = useMemo(() => {
    const known = new Set(GROUPS.flatMap(g => g.modes));
    return GROUPS.map(g => ({
      ...g,
      rows: filtered.filter(h => (g.modes.length ? g.modes.includes(h.test_mode ?? '') : !known.has(h.test_mode ?? ''))),
    })).filter(g => g.rows.length > 0);
  }, [filtered]);

  // One kind of test at a time. Until a tab is picked it follows the newest attempt, so the page opens on what
  // the student was last doing; a tab that a filter has emptied falls back the same way.
  const [tab, setTab] = useState<string | null>(fromLink.track ?? null);
  const activeGroup =
    grouped.find(g => g.key === tab) ??
    grouped.find(g => g.rows.includes(filtered[0])) ??
    grouped[0] ??
    null;
  const activeHasLevel = !!activeGroup && activeGroup.rows.some(r => splitLevel(r.test_name).level);

  return (
    <UserShell>
      {/* Title on the left; search and filters beside it rather than in a panel of their own. */}
      <div className="mb-5 animate-fadeIn">
        <div className="relative overflow-hidden rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 sm:p-6">
          <div className="absolute -top-16 -right-16 w-48 h-48 bg-purple-300/30 dark:bg-purple-700/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-16 -left-16 w-48 h-48 bg-blue-300/30 dark:bg-brand-700/20 rounded-full blur-3xl pointer-events-none" />
          <div className="relative flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">
                Test <span className="gradient-text-animated">History</span>
              </h1>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1.5">
                All your past attempts and AI reports in one place.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-full sm:w-56">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
                <input
                  type="text"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Search tests..."
                  aria-label="Search tests"
                  className="w-full h-9 pl-9 pr-3 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-900/40"
                />
              </div>
              <FilterSelect value={group} options={GROUP_OPTIONS} onChange={v => setGroup(v)} ariaLabel="Exam group" />
              <FilterSelect value={statusFilter} options={STATUS_OPTIONS} onChange={v => setStatusFilter(v)} ariaLabel="Status" />
              <FilterSelect value={modeFilter} options={TRACK_OPTIONS} onChange={v => setModeFilter(v)} ariaLabel="Test type" />
              <DateRangeFilter value={range} onChange={setRange} />
              {/* Course only exists for the older course-based tests; TNPSC attempts have none. */}
              {courses.length > 0 && (
                <FilterSelect
                  value={courseFilter}
                  options={[
                    { value: 'all', label: 'All courses' },
                    ...courses.map(c => ({ value: c.course_id, label: c.name })),
                  ]}
                  onChange={v => setCourseFilter(v)}
                  ariaLabel="Course"
                />
              )}
              {filtersActive && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="h-9 px-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:underline"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
          {filtersActive && (
            <p className="relative text-[11px] text-gray-500 dark:text-gray-400 mt-3">
              Showing <span className="font-semibold text-gray-700 dark:text-gray-200">{filtered.length}</span> of{' '}
              {history.length} attempts
            </p>
          )}
        </div>
      </div>

      {/* Stats summary — computed from the filtered set, matching the list below. */}
      {filtersActive && (
        <p className="-mt-2 mb-2 text-[11px] text-gray-500 dark:text-gray-400">
          Figures below reflect your current filters.
        </p>
      )}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3 mb-5">
        <HistoryStat
          icon={Trophy}
          label="Best Score"
          value={`${stats.bestScore}%`}
          hint={stats.bestMarks}
          tone="violet"
          index={0}
        />
        <HistoryStat
          icon={BarChart3}
          label="Average Score"
          value={`${stats.avgScore}%`}
          hint={stats.avgMarks}
          tone="blue"
          index={1}
        />
        <HistoryStat icon={FileText} label="Tests Completed" value={String(stats.totalAttempts)} tone="sky" index={2} />
        <HistoryStat icon={CalendarDays} label="This Month" value={String(stats.thisMonth)} tone="rose" index={3} />
      </div>

      {/* ── Unfinished attempts: the one thing on this page that needs an action ── */}
      {unfinished.length > 0 && statusFilter !== 'unfinished' && (
        <div className="mb-5 rounded-2xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/80 dark:bg-amber-950/20 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex items-start gap-3 min-w-0 flex-1">
              <span className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-500/15 flex items-center justify-center flex-shrink-0">
                <PauseCircle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-bold text-gray-900 dark:text-gray-100">
                  {unfinished.length} test{unfinished.length === 1 ? '' : 's'} left unfinished
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-300 mt-1 leading-relaxed">
                  You opened {unfinished.length === 1 ? 'this test' : 'these tests'} but never submitted, so no score was
                  recorded. Unfinished attempts still count against your attempt limit — resume and submit, even with
                  blanks, to get a score and a report.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setStatusFilter('unfinished')}
              className="self-start sm:self-center flex-shrink-0 h-9 px-3.5 rounded-xl border border-amber-300 dark:border-amber-700 bg-white dark:bg-gray-900 text-xs font-semibold text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 transition-colors press"
            >
              Show only unfinished →
            </button>
          </div>
        </div>
      )}

      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">
          All Attempts <span className="font-semibold text-gray-400 dark:text-gray-500">({filtered.length})</span>
        </h2>
        {grouped.length > 1 && (
          <div role="tablist" aria-label="Kind of test" className="inline-flex rounded-xl bg-gray-100 p-1 dark:bg-gray-800">
            {grouped.map(g => {
              const mode = TEST_MODES[g.key] ?? TEST_MODES.other;
              const TabIcon = mode.icon;
              const on = g.key === activeGroup?.key;
              return (
                <button
                  key={g.key}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  onClick={() => setTab(g.key)}
                  className={cn(
                    'inline-flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-sm font-semibold transition-all',
                    on
                      ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-900 dark:text-gray-100'
                      : 'text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200',
                  )}
                >
                  <TabIcon className={cn('h-4 w-4', on ? mode.tile.split(' ').filter(x => x.startsWith('text-') || x.startsWith('dark:text-')).join(' ') : '')} />
                  {g.label}
                  <span
                    className={cn(
                      'rounded-full px-1.5 text-[11px] font-bold tabular-nums',
                      on ? 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200' : 'bg-gray-200/70 text-gray-500 dark:bg-gray-700 dark:text-gray-400',
                    )}
                  >
                    {g.rows.length}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {groupLoading ? (
        <div className="rounded-2xl border border-gray-100 bg-white p-12 text-center dark:border-gray-800 dark:bg-gray-900">
          <Loader2 className="w-6 h-6 text-gray-300 dark:text-gray-600 mx-auto animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-gray-100 bg-white p-12 text-center animate-fadeIn dark:border-gray-800 dark:bg-gray-900">
          <FileText className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3 animate-bounce-soft" />
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {filtersActive ? 'No attempts match your filters.' : 'No attempts yet.'}
          </p>
          {filtersActive && (
            <button
              type="button"
              onClick={clearFilters}
              className="mt-2 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        activeGroup && (
          <section
            key={activeGroup.key}
            role="tabpanel"
            className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm animate-fadeIn dark:border-gray-800 dark:bg-gray-900"
          >
            <div
              className={cn(
                'hidden md:grid items-center gap-3 px-4 py-2 bg-gray-50/70 dark:bg-gray-800/40',
                'text-[10.5px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500',
                activeHasLevel ? COLUMNS_WITH_LEVEL : COLUMNS_NO_LEVEL,
              )}
            >
              <span>Test</span>
              <span>Date</span>
              {activeHasLevel && <span>Level</span>}
              <span>Score</span>
              <span>Time</span>
              <span>Status</span>
              <span className="text-right">Report</span>
            </div>
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {activeGroup.rows.map((a, i) => (
                <AttemptRow
                  key={a.attempt_id}
                  attempt={a}
                  hasLevel={activeHasLevel}
                  courseName={a.course_id ? courses.find(c => c.course_id === a.course_id)?.name : undefined}
                  paperMax={stats.paperMax}
                  resumeTarget={a.status === 'in_progress' ? resumeTargetFor(a) : null}
                  index={i}
                />
              ))}
            </div>
          </section>
        )      )}
    </UserShell>
  );
}

/** One attempt: a row of the table from `md` up, a small card below it. */
function AttemptRow({
  attempt: a,
  hasLevel,
  courseName,
  paperMax,
  resumeTarget,
  index,
}: {
  attempt: ApiAttempt;
  /** Whether the group's table has a Level column. */
  hasLevel: boolean;
  courseName?: string;
  /** The paper size every completed attempt shares — the fallback when one can't give its own. */
  paperMax: number | null;
  /** The assessment an in-progress attempt can be resumed in; null when there isn't one. */
  resumeTarget: string | null;
  index: number;
}) {
  const outcome = attemptOutcome(a);
  const started = new Date(a.start_time);
  const endedAt = a.end_time ? new Date(a.end_time) : null;
  const ended = endedAt && !Number.isNaN(endedAt.getTime()) ? endedAt : null;
  const duration = durationLabel(a);
  const flags = Array.isArray(a.malpractice_events) ? a.malpractice_events.length : 0;
  const gateReport = useReportGate();
  const { name, level } = splitLevel(a.test_name);
  const when = outcome === 'unfinished' ? started : (ended ?? started);
  const time = when.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

  return (
    <>
    <AttemptCard
      attempt={a}
      name={name}
      level={level}
      when={when}
      time={time}
      outcome={outcome}
      duration={duration}
      flags={flags}
      paperMax={paperMax}
      resumeTarget={resumeTarget}
      index={index}
    />
    <div
      className={cn(
        'hidden md:grid grid-cols-2 gap-x-3 gap-y-2 px-4 py-2.5 md:items-center',
        'hover:bg-orange-50/40 dark:hover:bg-gray-800/40 transition-colors animate-slideInLeft',
        hasLevel ? COLUMNS_WITH_LEVEL : COLUMNS_NO_LEVEL,
      )}
      style={{ animationDelay: `${Math.min(index, 10) * 0.03}s` }}
    >
      {/* Test name */}
      <div className="col-span-2 md:col-span-1 min-w-0">
        <p className="text-[13px] font-bold text-gray-900 dark:text-gray-100 line-clamp-2 leading-snug">{name}</p>
        {courseName && <p className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400 truncate">{courseName}</p>}
      </div>

      {/* Date */}
      <Cell label="Date">
        <p className="text-[13px] text-gray-700 dark:text-gray-200 leading-tight">
          {when.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
        </p>
        <p className="text-[11px] text-gray-400 dark:text-gray-500 leading-tight">
          {outcome === 'unfinished' ? 'Started' : ended ? 'Submitted' : ''} {time}
        </p>
      </Cell>

      {/* Level */}
      {hasLevel && (
        <Cell label="Level">
          {level ? (
            <span className={cn('inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset', LEVEL_CHIP[level] ?? LEVEL_CHIP.Mixed)}>
              {level}
            </span>
          ) : (
            <span className="text-sm text-gray-300 dark:text-gray-600">—</span>
          )}
        </Cell>
      )}

      {/* Score */}
      <Cell label="Score">
        <ScoreBar attempt={a} paperMax={paperMax} />
      </Cell>

      {/* Time taken */}
      <Cell label="Time">
        <p className={cn('text-[13px]', duration ? 'text-gray-700 dark:text-gray-200' : 'text-gray-400 dark:text-gray-500')}>
          {duration ?? '—'}
        </p>
      </Cell>

      {/* Status */}
      <Cell label="Status">
        <StatusBadge outcome={outcome} />
        {flags > 0 && (
          <p className="mt-1 flex items-center gap-1 text-[11px] text-red-600 dark:text-red-400">
            <XCircle className="w-3 h-3" /> {flags} flag{flags !== 1 ? 's' : ''}
          </p>
        )}
      </Cell>

      {/* Report */}
      <div className="col-span-2 md:col-span-1 flex items-center justify-end">
        {a.status === 'in_progress' ? (
          resumeTarget ? (
            <Link
              to={`/user/assessment/${resumeTarget}`}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-800 bg-amber-100 ring-1 ring-inset ring-amber-300 hover:bg-amber-200 dark:text-amber-300 dark:bg-amber-950/30 dark:ring-amber-900 px-3 py-1 rounded-full transition-colors press"
            >
              <PlayCircle className="w-3.5 h-3.5" /> Resume
            </Link>
          ) : (
            // No assessment behind it any more — say why rather than offer a
            // button that would 404.
            <span className="text-[11px] text-gray-400" title="The test behind this attempt is no longer available to you.">
              Can&apos;t resume
            </span>
          )
        ) : (
          // Its own page rather than a 900px drawer: the report is a wide document, and half a screen made
          // every table in it scroll sideways. The route is shareable, which the drawer never was.
          <Link
            to={`/user/report/${a.attempt_id}`}
            state={{ from: here() }}
            onClick={gateReport(a.test_mode)}
            className="group inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 ring-1 ring-inset ring-blue-200 dark:bg-blue-950/30 dark:ring-blue-900 hover:bg-blue-100 dark:hover:bg-blue-950/50 px-3 py-1 rounded-full transition-colors press"
          >
            <FileText className="w-3.5 h-3.5" />
            Report
          </Link>
        )}
      </div>
    </div>
    </>
  );
}

/**
 * One attempt on a phone: a card with a coloured edge for how it ended, the score as a ring on the left, the
 * name and date beside it, a line of chips, and one clear action. (From `md` up the table row is used instead.)
 */
function AttemptCard({
  attempt: a,
  name,
  level,
  when,
  time,
  outcome,
  duration,
  flags,
  paperMax,
  resumeTarget,
  index,
}: {
  attempt: ApiAttempt;
  name: string;
  level: string | null;
  when: Date;
  time: string;
  outcome: AttemptOutcome;
  duration: string | null;
  flags: number;
  paperMax: number | null;
  resumeTarget: string | null;
  index: number;
}) {
  const gateReport = useReportGate();
  const pct = a.percentage;
  const tone = pct === null ? null : SCORE_TONES[scoreTone(pct)];
  const max = maxMarksOf(a) ?? paperMax;
  const marks = a.score === null ? null : Math.round(a.score * 10) / 10;
  const edge = outcome === 'completed' ? 'bg-emerald-500' : outcome === 'auto-submitted' ? 'bg-amber-500' : 'bg-rose-400';
  const mode = TEST_MODES[a.test_mode ?? ''] ?? TEST_MODES.other;
  const ModeIcon = mode.icon;

  // The score ring: a circle that fills to the percentage.
  const R = 21;
  const C = 2 * Math.PI * R;
  const ring = (
    <div className="relative h-[54px] w-[54px] flex-shrink-0">
      <svg viewBox="0 0 54 54" className="h-full w-full -rotate-90" aria-hidden>
        <circle cx="27" cy="27" r={R} fill="none" strokeWidth="5" className="stroke-gray-100 dark:stroke-gray-800" />
        {pct !== null && (
          <circle
            cx="27"
            cy="27"
            r={R}
            fill="none"
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={`${(Math.max(0, Math.min(100, pct)) / 100) * C} ${C}`}
            className={tone?.bar.replace('bg-', 'stroke-')}
          />
        )}
      </svg>
      <span className={cn('absolute inset-0 flex items-center justify-center text-[12px] font-extrabold tabular-nums', tone ? tone.text : 'text-gray-300 dark:text-gray-600')}>
        {pct === null ? '—' : `${Math.round(pct)}%`}
      </span>
    </div>
  );

  const action =
    a.status === 'in_progress' ? (
      resumeTarget ? (
        <Link
          to={`/user/assessment/${resumeTarget}`}
          className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 px-3.5 py-2 text-xs font-bold text-white shadow-sm active:scale-95 transition-transform"
        >
          <PlayCircle className="h-4 w-4" /> Resume
        </Link>
      ) : (
        <span className="text-[11px] text-gray-400">Can&apos;t resume</span>
      )
    ) : (
      <Link
        to={`/user/report/${a.attempt_id}`}
        state={{ from: here() }}
        onClick={gateReport(a.test_mode)}
        className="inline-flex items-center gap-1 rounded-xl bg-gray-900 px-3.5 py-2 text-xs font-bold text-white shadow-sm active:scale-95 transition-transform dark:bg-gray-100 dark:text-gray-900"
      >
        View report <ChevronRight className="h-3.5 w-3.5" />
      </Link>
    );

  return (
    <div
      className="md:hidden relative overflow-hidden px-4 py-3.5 pl-5 animate-slideUp"
      style={{ animationDelay: `${Math.min(index, 8) * 0.04}s` }}
    >
      <span className={cn('absolute inset-y-3 left-0 w-1 rounded-r-full', edge)} />
      <div className="flex items-center gap-3">
        {ring}
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-bold leading-snug text-gray-900 dark:text-gray-100 line-clamp-2">{name}</p>
          <p className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">
            {when.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} · {time}
          </p>
        </div>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold', mode.badge)}>
          <ModeIcon className="h-3 w-3" />
          {a.test_mode === 'mock' ? 'Mock' : a.test_mode === 'practice' ? 'Practice' : 'Test'}
        </span>
        <StatusBadge outcome={outcome} />
        {duration && (
          <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300">
            <Clock className="h-3 w-3" /> {duration}
          </span>
        )}
        {level && (
          <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset', LEVEL_CHIP[level] ?? LEVEL_CHIP.Mixed)}>
            {level}
          </span>
        )}
        {flags > 0 && (
          <span className="inline-flex items-center gap-1 text-[11px] text-red-600 dark:text-red-400">
            <XCircle className="h-3 w-3" /> {flags} flag{flags !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-[12px] text-gray-500 dark:text-gray-400">
          {marks !== null ? (
            <>
              <b className="text-[15px] font-extrabold tabular-nums text-gray-900 dark:text-gray-100">{marks}</b>
              {max != null ? ` / ${max}` : ''} marks
            </>
          ) : (
            'No score recorded'
          )}
        </p>
        {action}
      </div>
    </div>
  );
}

/** A table cell that names itself on a phone, where the column headers are gone. */
function Cell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <span className="md:hidden block mb-0.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
        {label}
      </span>
      {children}
    </div>
  );
}

const TEST_MODES: Record<string, { icon: LucideIcon; tile: string; badge: string }> = {
  mock: {
    icon: ClipboardList,
    tile: 'bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300',
    badge: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-brand-300',
  },
  practice: {
    icon: Target,
    tile: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300',
    badge: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300',
  },
  other: {
    icon: FileText,
    tile: 'bg-slate-100 text-slate-500 dark:bg-slate-500/15 dark:text-slate-300',
    badge: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300',
  },
};

const SCORE_TONES: Record<ScoreTone, { bar: string; text: string }> = {
  high: { bar: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400' },
  mid: { bar: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-400' },
  low: { bar: 'bg-red-500', text: 'text-red-600 dark:text-red-400' },
};

/** "21 / 300" over a bar and the percentage — or a dash when nothing was scored. */
function ScoreBar({ attempt: a, paperMax }: { attempt: ApiAttempt; paperMax: number | null }) {
  if (a.percentage === null) return <p className="text-sm text-gray-400 dark:text-gray-500">—</p>;

  const pct = a.percentage;
  const tone = SCORE_TONES[scoreTone(pct)];
  const max = maxMarksOf(a) ?? paperMax;
  const marks = a.score === null ? null : Math.round(a.score * 10) / 10;

  return (
    <div className="flex items-center gap-2">
      {marks !== null && (
        <span className="min-w-[3.25rem] text-[13px] font-bold tabular-nums text-gray-900 dark:text-gray-100">
          {marks}
          <span className="font-medium text-gray-400 dark:text-gray-500">{max != null ? `/${max}` : ''}</span>
        </span>
      )}
      <div className="h-1.5 w-12 flex-shrink-0 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
        <div className={cn('h-full rounded-full', tone.bar)} style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
      </div>
      <span className={cn('text-[11px] font-bold tabular-nums', tone.text)}>{Math.round(pct)}%</span>
    </div>
  );
}

const STATUS_BADGES: Record<AttemptOutcome, { label: string; className: string; title?: string }> = {
  completed: {
    label: 'Completed',
    className: 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900',
  },
  'auto-submitted': {
    label: 'Auto-submitted',
    className: 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900',
    title: 'The timer ended this attempt and it was submitted for you.',
  },
  unfinished: {
    label: 'Not submitted',
    className: 'bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:ring-rose-900',
    title: 'You started this test but never submitted it, so no score was recorded.',
  },
};

function StatusBadge({ outcome }: { outcome: AttemptOutcome }) {
  const badge = STATUS_BADGES[outcome];
  return (
    <span
      title={badge.title}
      className={cn('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold', badge.className)}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {badge.label}
    </span>
  );
}

type StatTone = 'violet' | 'blue' | 'sky' | 'rose';

const STAT_TILES: Record<StatTone, string> = {
  violet: 'bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300',
  blue: 'bg-blue-100 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300',
  sky: 'bg-sky-100 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300',
  rose: 'bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300',
};

function HistoryStat({
  icon: Icon,
  label,
  value,
  hint,
  tone,
  index = 0,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  /** The marks behind a percentage, so "11%" isn't the only thing on screen. */
  hint?: string | null;
  tone: StatTone;
  index?: number;
}) {
  return (
    <div
      className="flex items-center gap-3 sm:gap-4 rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-3.5 sm:p-4 shadow-sm animate-slideUp hover-lift"
      style={{ animationDelay: `${index * 0.05}s` }}
    >
      <span className={cn('w-11 h-11 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center flex-shrink-0', STAT_TILES[tone])}>
        <Icon className="w-5 h-5 sm:w-[22px] sm:h-[22px]" />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] sm:text-xs font-medium text-gray-500 dark:text-gray-400">{label}</p>
        <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100 leading-tight tabular-nums">{value}</p>
        {hint && <p className="text-[10px] sm:text-[11px] text-gray-400 dark:text-gray-500 mt-0.5 truncate">{hint}</p>}
      </div>
    </div>
  );
}
