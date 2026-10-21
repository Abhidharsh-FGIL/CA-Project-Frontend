/**
 * The progress curve, filtered by exam group, track and period.
 *
 * Shared by the dashboard and the performance page so the two can't drift apart.
 *
 * With no group/track filter the server's trend is used as-is — it isn't capped at the
 * 50 attempts `/user/history` returns. Filtering needs per-attempt group and mode,
 * which the trend doesn't carry (see §6b of TNPSC_DASHBOARD_API.md), so a filtered
 * view is recomputed from history using the server's own semantics: one point per
 * attempt, value = running average of everything up to it.
 */
import { useMemo } from 'react';
import { useTnpscMockTests, useTnpscPracticeTests } from '@/hooks/use-tnpsc';
import type { TrendPoint, UserDashboardAnalytics } from '@/lib/userDashboardApi';
import type { ApiAttempt } from '@/lib/userPortalApi';
import type { FilterOption } from '@/components/user/FilterSelect';
import { inRange, isoDay, rangeLabel, type DateRange } from '@/components/user/DateRangeFilter';
import { OPEN_EXAM_IDS } from '@/lib/exam-listing';

export type TrackKey = 'all' | 'mock' | 'practice';
export type GroupKey = 'all' | 'group-1' | 'group-4' | 'gat-b';

/**
 * The same two dimensions with the "all" escape hatch removed.
 *
 * History and Performance are browsing surfaces where "everything" is a sensible
 * view, so they keep it. The dashboard is always scoped to one exam and one test
 * type, and these types make that an invariant the compiler enforces rather than a
 * convention the JSX has to keep restating.
 */
export type ExamGroupKey = Exclude<GroupKey, 'all'>;
export type ExamTrackKey = Exclude<TrackKey, 'all'>;

/** The stage each group's tests live under — Prelims and Written are the focus. */
export const GROUP_STAGE: Record<ExamGroupKey, string> = {
  'group-1': 'group-1-prelims',
  'group-4': 'group-4-written',
  'gat-b': 'gat-b-exam',
};

/**
 * The group a dashboard opens on when the aspirant has expressed no usable
 * preference — either they registered before `preferred_exam` existed, or the
 * profile payload didn't carry it.
 */
export const FALLBACK_GROUP: ExamGroupKey = 'group-4';

/**
 * The exam chosen at registration, as a filter key.
 *
 * Anything unrecognised — absent, stale, or a code this build's catalog doesn't
 * know — lands on FALLBACK_GROUP rather than 'all', so the dashboard always opens
 * on one concrete exam instead of an unfiltered blur.
 */
export function resolveGroupKey(preferredExam?: string | null): ExamGroupKey {
  const key = (preferredExam ?? '').trim().toLowerCase();
  return key in GROUP_STAGE ? (key as ExamGroupKey) : FALLBACK_GROUP;
}

export const EXAM_TRACK_OPTIONS: FilterOption<ExamTrackKey>[] = [
  { value: 'mock', label: 'Mock tests', hint: 'Full-length papers' },
  { value: 'practice', label: 'Practice', hint: 'Syllabus-wise sets' },
];

const EXAM_GROUPS: FilterOption<ExamGroupKey>[] = [
  { value: 'group-1', label: 'Group 1', hint: 'Prelims' },
  { value: 'group-4', label: 'Group 4', hint: 'Written' },
  { value: 'gat-b', label: 'GAT-B', hint: 'Biotechnology' },
];

/**
 * The exam filter. An exam that is not open yet is listed but cannot be chosen — the same rule
 * as the Exams page (`OPEN_EXAM_IDS`), so a filter never opens a view of an exam the rest of the
 * portal says is not there.
 */
export const EXAM_GROUP_OPTIONS: FilterOption<ExamGroupKey>[] = EXAM_GROUPS.map(o =>
  OPEN_EXAM_IDS.has(o.value) ? o : { ...o, hint: 'Coming soon', disabled: true },
);

/**
 * The group a view opens on: the aspirant's exam if it is open, otherwise the fallback — an exam
 * that is not open cannot be the selected, un-changeable, filter.
 */
export function openGroupKey(preferredExam?: string | null): ExamGroupKey {
  const key = resolveGroupKey(preferredExam);
  return OPEN_EXAM_IDS.has(key) ? key : FALLBACK_GROUP;
}

export const TRACK_OPTIONS: FilterOption<TrackKey>[] = [
  { value: 'all', label: 'All tests' },
  ...EXAM_TRACK_OPTIONS,
];

export const GROUP_OPTIONS: FilterOption<GroupKey>[] = [
  { value: 'all', label: 'All groups' },
  ...EXAM_GROUP_OPTIONS,
];

/**
 * One point per calendar day: the average score of the attempts taken on that day.
 *
 * Not a running average — each point is that day's own result, so a bad day shows as a dip and a good
 * one as a peak, instead of being smoothed into everything that came before. A day with no test has no
 * point; the chart joins the days that have one, and the tooltip says how many tests make up each.
 */
export function toDailyAverages(attempts: Array<Pick<ApiAttempt, 'start_time' | 'percentage' | 'test_name'>>): TrendPoint[] {
  const byDay = new Map<string, { sum: number; n: number; names: string[] }>();
  for (const h of attempts) {
    if (h.percentage == null) continue;
    const day = isoDay(new Date(h.start_time));
    const entry = byDay.get(day) ?? { sum: 0, n: 0, names: [] };
    entry.sum += h.percentage;
    entry.n += 1;
    if (h.test_name) entry.names.push(h.test_name);
    byDay.set(day, entry);
  }

  return [...byDay.entries()]
    .sort(([x], [y]) => (x < y ? -1 : 1))
    .map(([date, e]) => ({
      date,
      label: new Date(`${date}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
      value: Math.round((e.sum / e.n) * 10) / 10,
      tests: e.n,
      name: e.n === 1 ? e.names[0] : `${e.n} tests`,
    }));
}

/**
 * Tooltip heading for a daily point: the date, plus what was taken that day.
 */
export function formatTrendLabel(label: any, payload: any): string {
  const p = payload?.[0]?.payload;
  if (!p) return String(label ?? '');
  const tests = p.tests ?? (p.name ? 1 : 0);
  if (tests === 0) return `${label} · no tests`;
  if (tests === 1 && p.name) return `${label} · ${p.name}`;
  return `${label} · ${tests} tests`;
}

/**
 * Value-axis ceiling: a fixed 0–100 axis flattens early scores into the baseline.
 *
 * Takes anything carrying a `value` so the per-test chart scales on the same rule
 * as the trend curve — two charts side by side must not use different ceilings.
 */
export function trendCeiling(points: { value: number }[]): number {
  const peak = Math.max(0, ...points.map(p => p.value));
  return Math.min(100, Math.max(20, Math.ceil((peak * 1.5) / 10) * 10));
}

interface Args {
  analytics: UserDashboardAnalytics | undefined;
  history: ApiAttempt[];
  group: GroupKey;
  track: TrackKey;
  range: DateRange;
}

/**
 * Resolves whether an attempt belongs to an exam group.
 *
 * Attempts carry no group id (see §6b of TNPSC_DASHBOARD_API.md), so the group's
 * catalog is what answers the question. The queries stay disabled while the filter is
 * "all", so nothing extra is fetched until the filter is actually used.
 */
export function useGroupMatcher(group: GroupKey) {
  const stageForGroup = group === 'all' ? undefined : GROUP_STAGE[group];
  const groupMocks = useTnpscMockTests(stageForGroup ? group : undefined, stageForGroup);
  const groupPractice = useTnpscPracticeTests(stageForGroup ? group : undefined, stageForGroup);

  const index = useMemo(() => {
    const ids = new Set<string>();
    const titles = new Set<string>();
    const add = (id?: string | null, title?: string | null) => {
      if (id) ids.add(id);
      if (title) titles.add(title.trim().toLowerCase());
    };
    groupMocks.levels.forEach(l => l.tests?.forEach(t => add(t.test_id, t.title)));
    groupPractice.subjects.forEach(sub => sub.tests?.forEach(t => add(t.test_id, t.title)));
    return { ids, titles };
  }, [groupMocks.levels, groupPractice.subjects]);

  const matchesGroup = useMemo(() => {
    return (h: Pick<ApiAttempt, 'test_id' | 'test_name'>) => {
      if (group === 'all') return true;
      if (index.ids.has(h.test_id)) return true;
      return !!h.test_name && index.titles.has(h.test_name.trim().toLowerCase());
    };
  }, [group, index]);

  return {
    matchesGroup,
    isLoading: group !== 'all' && (groupMocks.isLoading || groupPractice.isLoading),
  };
}

export function useProgressTrend({ analytics, history, group, track, range }: Args) {
  const { matchesGroup, isLoading: groupLoading } = useGroupMatcher(group);

  const dimensionFiltered = track !== 'all' || group !== 'all';
  const filtersActive = dimensionFiltered || range.key !== 'all';
  const isLoading = groupLoading;

  /** One predicate, so the chart, the tiles and the attempts list can never disagree. */
  const matches = useMemo(() => {
    return (h: ApiAttempt) => {
      if (track !== 'all' && (h.test_mode ?? '').toLowerCase() !== track) return false;
      if (!inRange(isoDay(new Date(h.start_time)), range)) return false;
      return matchesGroup(h);
    };
  }, [track, range, matchesGroup]);

  /** Submitted attempts passing every filter, newest first. */
  const attempts = useMemo(
    () =>
      history
        .filter(h => h.status !== 'in_progress' && h.percentage != null && matches(h))
        .sort((x, y) => +new Date(y.start_time) - +new Date(x.start_time)),
    [history, matches],
  );

  // Each day's own average, from the attempts that pass every filter. (The server's trend is a running
  // average per attempt, so a day's own result cannot be read back out of it.)
  const points = useMemo<TrendPoint[]>(() => toDailyAverages(attempts), [attempts]);

  /** States exactly what's plotted, so a filtered chart can't read as the whole picture. */
  const caption = useMemo(() => {
    const bits = [
      group === 'all' ? null : GROUP_OPTIONS.find(o => o.value === group)?.label,
      track === 'all' ? null : track === 'mock' ? 'Mock Tests' : 'Practice Tests',
      rangeLabel(range).replace(/\w/g, c => c.toUpperCase()),
    ].filter(Boolean);
    return `Average Score by Day · ${bits.join(' · ')}`;
  }, [group, track, range]);

  return { points, caption, attempts, matches, filtersActive, isLoading, ceiling: trendCeiling(points) };
}
