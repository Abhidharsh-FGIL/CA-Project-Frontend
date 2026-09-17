import { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { UserShell } from '@/components/user/UserShell';
import { useUserPortal } from '@/contexts/UserPortalContext';
import { Search, FileText, Loader2, XCircle, Clock, AlertTriangle, Trophy, Target, BarChart3, CalendarDays, PlayCircle, PauseCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FilterSelect, type FilterOption } from '@/components/user/FilterSelect';
import type { ApiAttempt } from '@/lib/userPortalApi';
import { ALL_TIME, DateRangeFilter, inRange, isoDay, type DateRange } from '@/components/user/DateRangeFilter';
import { GROUP_OPTIONS, TRACK_OPTIONS, useGroupMatcher, type GroupKey, type TrackKey } from '@/hooks/use-progress-trend';
import { commonMaxMarks, marksLabel, maxMarksOf } from '@/lib/userDashboardApi';

type StatusKey = 'all' | 'completed' | 'unfinished';

const STATUS_OPTIONS: FilterOption<StatusKey>[] = [
  { value: 'all', label: 'All attempts' },
  { value: 'completed', label: 'Completed', hint: 'Scored and reported' },
  { value: 'unfinished', label: 'Not submitted', hint: 'Started, never finished' },
];

/** Started but never submitted — the attempt has no score at all. */
const isUnfinished = (h: ApiAttempt) => h.status === 'in_progress' || h.percentage === null;

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
    };
  }, [filtered]);

  return (
    <UserShell>
      {/* Hero header */}
      <div className="mb-6 animate-fadeIn">
        <div className="relative overflow-hidden rounded-2xl border border-indigo-100 dark:border-indigo-900 bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 dark:from-indigo-950/50 dark:via-purple-950/50 dark:to-pink-950/50 bg-[length:200%_auto] animate-gradient-x p-5 sm:p-6">
          <div className="absolute -top-16 -right-16 w-48 h-48 bg-purple-300/30 dark:bg-purple-700/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-16 -left-16 w-48 h-48 bg-indigo-300/30 dark:bg-indigo-700/20 rounded-full blur-3xl pointer-events-none" />
          <div className="relative flex items-end justify-between gap-3 flex-wrap">
            <div>
              <p className="text-[10px] uppercase tracking-[0.25em] text-indigo-700 dark:text-indigo-300 font-bold mb-2">
                Your Progress
              </p>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">
                Test <span className="gradient-text-animated">History</span>
              </h1>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1.5">
                All your past attempts and AI reports in one place.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Stats summary — computed from the filtered set, matching the list below. */}
      {filtersActive && (
        <p className="-mt-3 mb-2 text-[11px] text-gray-500 dark:text-gray-400">
          Figures below reflect your current filters.
        </p>
      )}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3 mb-6">
        <HistoryStat
          icon={<Trophy className="w-4 h-4" />}
          label="Best Score"
          value={`${stats.bestScore}%`}
          hint={stats.bestMarks}
          tone="amber"
          index={0}
        />
        <HistoryStat
          icon={<Target className="w-4 h-4" />}
          label="Average Score"
          value={`${stats.avgScore}%`}
          hint={stats.avgMarks}
          tone="emerald"
          index={1}
        />
        <HistoryStat
          icon={<BarChart3 className="w-4 h-4" />}
          label="Tests Completed"
          value={String(stats.totalAttempts)}
          tone="indigo"
          index={2}
        />
        <HistoryStat
          icon={<CalendarDays className="w-4 h-4" />}
          label="This Month"
          value={String(stats.thisMonth)}
          tone="rose"
          index={3}
        />
      </div>

      {/* ── Unfinished attempts: the one thing on this page that needs an action ── */}
      {unfinished.length > 0 && statusFilter !== 'unfinished' && (
        <div className="mb-4 rounded-2xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/70 dark:bg-amber-950/20 p-4">
          <div className="flex items-start gap-3">
            <span className="w-9 h-9 rounded-xl bg-white dark:bg-gray-900 flex items-center justify-center flex-shrink-0">
              <PauseCircle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-gray-900 dark:text-gray-100">
                {unfinished.length} test{unfinished.length === 1 ? '' : 's'} left unfinished
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-300 mt-1 leading-relaxed">
                You opened {unfinished.length === 1 ? 'this test' : 'these tests'} but never submitted, so no score was
                recorded. Unfinished attempts still count against your attempt limit — resume and submit, even with
                blanks, to get a score and a report.
              </p>
              <button
                type="button"
                onClick={() => setStatusFilter('unfinished')}
                className="mt-2 text-xs font-semibold text-amber-700 dark:text-amber-400 hover:underline"
              >
                Show only unfinished →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-3 sm:p-4 mb-5">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="relative flex-1 min-w-full sm:min-w-[220px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search by test name..."
              className="w-full h-9 pl-9 pr-3 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-900/40"
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
              className="h-9 px-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:underline"
            >
              Clear
            </button>
          )}
        </div>
        {filtersActive && (
          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-2.5">
            Showing <span className="font-semibold text-gray-700 dark:text-gray-200">{filtered.length}</span> of{' '}
            {history.length} attempts
          </p>
        )}
      </div>

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
                className="mt-2 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {filtered.map((a, i) => (
              <div
                key={a.attempt_id}
                className="p-3 sm:p-4 hover:bg-indigo-50/40 dark:hover:bg-indigo-950/30 transition-colors animate-slideInLeft"
                style={{ animationDelay: `${i * 0.04}s` }}
              >
                <div className="flex items-start justify-between gap-3 flex-wrap sm:flex-nowrap">
                  <div className="min-w-0 flex-1 w-full sm:w-auto">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      {a.test_mode && (
                        <span
                          className={cn(
                            'text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded',
                            a.test_mode === 'mock'
                              ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300'
                              : 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300',
                          )}
                        >
                          {a.test_mode}
                        </span>
                      )}
                      <p className="text-sm font-bold text-gray-900 dark:text-gray-100 line-clamp-1">
                        {a.test_name ?? 'Test Attempt'}
                      </p>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {[
                        a.course_id ? courses.find(c => c.course_id === a.course_id)?.name : null,
                        new Date(a.start_time).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        }),
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>

                    <div className="flex flex-wrap items-center gap-3 mt-2 text-[11px]">
                      {a.percentage !== null ? (
                        <span
                          className={cn(
                            'font-bold px-2 py-0.5 rounded',
                            (a.percentage ?? 0) >= 70
                              ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
                              : (a.percentage ?? 0) >= 50
                              ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300'
                              : 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300',
                          )}
                        >
                          {a.score !== null ? `${a.score} pts · ` : ''}{Math.round(a.percentage ?? 0)}%
                        </span>
                      ) : (
                        <span
                          className="inline-flex items-center gap-1 font-bold px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400"
                          title="You started this test but never submitted it, so no score was recorded."
                        >
                          <PauseCircle className="w-3 h-3" /> Not submitted
                        </span>
                      )}
                      {a.percentage === null && (
                        <span className="text-gray-500 dark:text-gray-400">
                          Started {new Date(a.start_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} · never submitted
                        </span>
                      )}
                      {a.auto_submitted && (
                        <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-semibold">
                          <AlertTriangle className="w-3 h-3" /> Auto-submitted
                        </span>
                      )}
                      {Array.isArray(a.malpractice_events) && a.malpractice_events.length > 0 && (
                        <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-400">
                          <XCircle className="w-3 h-3" /> {a.malpractice_events.length} flag{a.malpractice_events.length !== 1 ? 's' : ''}
                        </span>
                      )}
                      {a.end_time && a.start_time && (() => {
                        const ms = new Date(a.end_time).getTime() - new Date(a.start_time).getTime();
                        const label = ms <= 0 ? null : ms < 60000 ? '< 1 min' : `${Math.round(ms / 60000)} min`;
                        return label ? (
                          <span className="inline-flex items-center gap-1 text-gray-500 dark:text-gray-400">
                            <Clock className="w-3 h-3" /> {label}
                          </span>
                        ) : null;
                      })()}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 w-full sm:w-auto justify-end">
                    {a.status === 'in_progress' ? (
                      resumeTargetFor(a) ? (
                        <Link
                          to={`/user/assessment/${resumeTargetFor(a)}`}
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
                        className="group text-xs font-semibold text-indigo-600 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 px-3 py-1.5 rounded-lg transition-all hover:shadow-sm press inline-flex items-center gap-1"
                      >
                        View Report
                        <span className="opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all">→</span>
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </UserShell>
  );
}

function HistoryStat({
  icon,
  label,
  value,
  hint,
  tone,
  index = 0,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  /** The marks behind a percentage, so "11%" isn't the only thing on screen. */
  hint?: string | null;
  tone: 'indigo' | 'emerald' | 'amber' | 'rose';
  index?: number;
}) {
  const toneText: Record<typeof tone, string> = {
    indigo: 'text-indigo-600 dark:text-indigo-400',
    emerald: 'text-emerald-600 dark:text-emerald-400',
    amber: 'text-amber-600 dark:text-amber-400',
    rose: 'text-rose-600 dark:text-rose-400',
  } as any;
  const toneAccent: Record<typeof tone, string> = {
    indigo: 'from-indigo-500/10',
    emerald: 'from-emerald-500/10',
    amber: 'from-amber-500/10',
    rose: 'from-rose-500/10',
  } as any;
  const toneGlow: Record<typeof tone, string> = {
    indigo: 'hover:shadow-indigo-100/50 dark:hover:shadow-indigo-950/40',
    emerald: 'hover:shadow-emerald-100/50 dark:hover:shadow-emerald-950/40',
    amber: 'hover:shadow-amber-100/50 dark:hover:shadow-amber-950/40',
    rose: 'hover:shadow-rose-100/50 dark:hover:shadow-rose-950/40',
  } as any;
  const toneBorder: Record<typeof tone, string> = {
    indigo: 'border-l-indigo-500',
    emerald: 'border-l-emerald-500',
    amber: 'border-l-amber-500',
    rose: 'border-l-rose-500',
  } as any;
  return (
    <div
      className={`group relative bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 border-l-2 ${toneBorder[tone]} p-3 sm:p-4 animate-slideUp hover-lift hover:shadow-lg ${toneGlow[tone]} card-shine overflow-hidden`}
      style={{ animationDelay: `${index * 0.05}s` }}
    >
      <div className={`absolute -right-6 -top-6 w-24 h-24 rounded-full bg-gradient-to-br ${toneAccent[tone]} via-transparent to-transparent pointer-events-none`} />
      <div className="relative">
        <div className="flex items-center gap-2 mb-2">
          <span className={`${toneText[tone]} transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6`}>
            {icon}
          </span>
          <p className="text-[10px] uppercase tracking-[0.22em] text-gray-500 dark:text-gray-400 font-medium">
            {label}
          </p>
        </div>
        <p className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100 leading-none tabular-nums tracking-tight">
          {value}
        </p>
        {hint && <p className="text-[10px] text-gray-400 mt-1.5 leading-tight">{hint}</p>}
      </div>
    </div>
  );
}
