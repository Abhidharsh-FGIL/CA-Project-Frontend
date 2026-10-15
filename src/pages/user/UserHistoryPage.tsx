import { useState, useMemo, useEffect, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
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

/** The six columns of the attempts table; below `md` each attempt is a small card instead. */
const COLUMNS =
  'md:grid-cols-[minmax(0,2.5fr)_minmax(96px,0.9fr)_minmax(150px,1.4fr)_minmax(84px,0.8fr)_minmax(124px,1fr)_minmax(112px,0.9fr)]';

export default function UserHistoryPage() {
  const { history, courses, assessments, refreshHistory } = useUserPortal();

  useEffect(() => {
    refreshHistory();
  }, [refreshHistory]);
  const [query, setQuery] = useState('');
  const [courseFilter, setCourseFilter] = useState<string>('all');
  const [modeFilter, setModeFilter] = useState<TrackKey>('all');
  const [range, setRange] = useState<DateRange>(ALL_TIME);
  const [statusFilter, setStatusFilter] = useState<StatusKey>('all');
  const [group, setGroup] = useState<GroupKey>('all');

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

  return (
    <UserShell>
      {/* Title on the left; search and filters beside it rather than in a panel of their own. */}
      <div className="mb-5 animate-fadeIn">
        <div className="relative overflow-hidden rounded-2xl border border-blue-100 dark:border-blue-900 bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-blue-950/50 dark:via-purple-950/50 dark:to-pink-950/50 bg-[length:200%_auto] animate-gradient-x p-5 sm:p-6">
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

      <h2 className="mb-3 text-base font-bold text-gray-900 dark:text-gray-100">
        All Attempts <span className="font-semibold text-gray-400 dark:text-gray-500">({filtered.length})</span>
      </h2>

      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden shadow-sm animate-fadeIn">
        {groupLoading ? (
          <div className="p-12 text-center">
            <Loader2 className="w-6 h-6 text-gray-300 dark:text-gray-600 mx-auto animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center animate-fadeIn">
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
          <>
            <div
              className={cn(
                'hidden md:grid items-center gap-4 px-5 py-3 border-b border-gray-100 dark:border-gray-800',
                'bg-gray-50/70 dark:bg-gray-800/40 text-xs font-semibold text-gray-500 dark:text-gray-400',
                COLUMNS,
              )}
            >
              <span>Test Name</span>
              <span>Date</span>
              <span>Score</span>
              <span>Time Taken</span>
              <span>Status</span>
              <span className="text-right">Report</span>
            </div>
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {filtered.map((a, i) => (
                <AttemptRow
                  key={a.attempt_id}
                  attempt={a}
                  courseName={a.course_id ? courses.find(c => c.course_id === a.course_id)?.name : undefined}
                  paperMax={stats.paperMax}
                  resumeTarget={a.status === 'in_progress' ? resumeTargetFor(a) : null}
                  index={i}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </UserShell>
  );
}

/** One attempt: a row of the table from `md` up, a small card below it. */
function AttemptRow({
  attempt: a,
  courseName,
  paperMax,
  resumeTarget,
  index,
}: {
  attempt: ApiAttempt;
  courseName?: string;
  /** The paper size every completed attempt shares — the fallback when one can't give its own. */
  paperMax: number | null;
  /** The assessment an in-progress attempt can be resumed in; null when there isn't one. */
  resumeTarget: string | null;
  index: number;
}) {
  const outcome = attemptOutcome(a);
  const started = new Date(a.start_time);
  const duration = durationLabel(a);
  const flags = Array.isArray(a.malpractice_events) ? a.malpractice_events.length : 0;
  const mode = TEST_MODES[a.test_mode ?? ''] ?? TEST_MODES.other;
  const ModeIcon = mode.icon;
  const gateReport = useReportGate();

  return (
    <div
      className={cn(
        'grid grid-cols-2 gap-x-4 gap-y-3 px-4 py-3.5 sm:px-5 md:items-center',
        'hover:bg-blue-50/40 dark:hover:bg-blue-950/30 transition-colors animate-slideInLeft',
        COLUMNS,
      )}
      style={{ animationDelay: `${Math.min(index, 10) * 0.04}s` }}
    >
      {/* Test name */}
      <div className="col-span-2 md:col-span-1 flex items-center gap-3 min-w-0">
        <span className={cn('w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0', mode.tile)}>
          <ModeIcon className="w-[18px] h-[18px]" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-bold text-gray-900 dark:text-gray-100 line-clamp-2 leading-snug">
            {a.test_name ?? 'Test Attempt'}
          </p>
          <div className="mt-1 flex items-center gap-2 flex-wrap">
            {a.test_mode && (
              <span className={cn('text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded', mode.badge)}>
                {a.test_mode}
              </span>
            )}
            {courseName && <span className="text-[11px] text-gray-500 dark:text-gray-400 truncate">{courseName}</span>}
          </div>
        </div>
      </div>

      {/* Date */}
      <Cell label="Date">
        <p className="text-sm text-gray-700 dark:text-gray-200">
          {started.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
        </p>
        {outcome === 'unfinished' && (
          <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">
            Started {started.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
          </p>
        )}
      </Cell>

      {/* Score */}
      <Cell label="Score">
        <ScoreBar attempt={a} paperMax={paperMax} />
      </Cell>

      {/* Time taken */}
      <Cell label="Time taken">
        <p className={cn('text-sm', duration ? 'text-gray-700 dark:text-gray-200' : 'text-gray-400 dark:text-gray-500')}>
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
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-amber-500 hover:bg-amber-600 px-3 py-1.5 rounded-lg transition-colors press"
            >
              <PlayCircle className="w-3.5 h-3.5" /> Resume
            </Link>
          ) : (
            // No assessment behind it any more — say why rather than offer a
            // button that would 404.
            <span className="text-[11px] text-gray-400" title="The test behind this attempt is no longer available to you.">
              Can't resume
            </span>
          )
        ) : (
          // Its own page rather than a 900px drawer: the report is a
          // wide document — a nine-column subject table, a radar and a
          // four-panel analysis — and half a screen made every one of
          // them scroll sideways. The route already existed and is
          // shareable, which the drawer never was.
          <Link
            to={`/user/report/${a.attempt_id}`}
            onClick={gateReport(a.test_mode)}
            className="group inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-brand-300 bg-white dark:bg-gray-900 border border-blue-200 dark:border-blue-900 hover:bg-blue-50 dark:hover:bg-blue-950/40 px-3 py-1.5 rounded-lg transition-colors press"
          >
            <FileText className="w-3.5 h-3.5" />
            View Report
          </Link>
        )}
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
    <div>
      {marks !== null && (
        <p className="text-sm font-bold tabular-nums text-gray-900 dark:text-gray-100">
          {marks}
          <span className="font-medium text-gray-400 dark:text-gray-500">{max != null ? ` / ${max}` : ' pts'}</span>
        </p>
      )}
      <div className="mt-1 flex items-center gap-2">
        <div className="h-1.5 w-full max-w-[110px] rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
          <div
            className={cn('h-full rounded-full', tone.bar)}
            style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
          />
        </div>
        <span className={cn('text-[11px] font-bold tabular-nums', tone.text)}>{Math.round(pct)}%</span>
      </div>
    </div>
  );
}

const STATUS_BADGES: Record<AttemptOutcome, { label: string; className: string; title?: string }> = {
  completed: {
    label: 'Completed',
    className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  },
  'auto-submitted': {
    label: 'Auto-submitted',
    className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    title: 'The timer ended this attempt and it was submitted for you.',
  },
  unfinished: {
    label: 'Not submitted',
    className: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
    title: 'You started this test but never submitted it, so no score was recorded.',
  },
};

function StatusBadge({ outcome }: { outcome: AttemptOutcome }) {
  const badge = STATUS_BADGES[outcome];
  return (
    <span
      title={badge.title}
      className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold', badge.className)}
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
