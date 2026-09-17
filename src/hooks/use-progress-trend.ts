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

export const EXAM_GROUP_OPTIONS: FilterOption<ExamGroupKey>[] = [
  { value: 'group-1', label: 'Group 1', hint: 'Prelims' },
  { value: 'group-4', label: 'Group 4', hint: 'Written' },
  { value: 'gat-b', label: 'GAT-B', hint: 'Biotechnology' },
];

export const TRACK_OPTIONS: FilterOption<TrackKey>[] = [
  { value: 'all', label: 'All tests' },
  ...EXAM_TRACK_OPTIONS,
];

export const GROUP_OPTIONS: FilterOption<GroupKey>[] = [
  { value: 'all', label: 'All groups' },
  ...EXAM_GROUP_OPTIONS,
];

/** Longest gap worth filling; beyond this the axis is drawn from active days only. */
const MAX_FILLED_DAYS = 400;

/**
 * Collapse an attempt-per-point series into one point per calendar day.
 *
 * The server emits one point per attempt, so five tests on 31 Aug produce five points
 * all labelled "31 Aug" — the axis reads as a repeated date and the spacing implies
 * time passing when it isn't. One point per day, holding the running average across
 * quiet days, makes the x-axis an actual timeline.
 */
export function toDailySeries(points: TrendPoint[]): TrendPoint[] {
  const dated = points.filter(p => !!p.date);
  if (dated.length === 0) return points;

  const byDate = new Map<string, { value: number; names: string[] }>();
  for (const p of dated) {
    // Points arrive oldest-first, so the last of a day is that day's closing average.
    const entry = byDate.get(p.date) ?? { value: p.value, names: [] };
    entry.value = p.value;
    if (p.name) entry.names.push(p.name);
    byDate.set(p.date, entry);
  }

  const days = [...byDate.keys()].sort();
  const first = new Date(`${days[0]}T00:00:00`);
  const last = new Date(`${days[days.length - 1]}T00:00:00`);
  const span = Math.round((last.getTime() - first.getTime()) / 864e5) + 1;

  const label = (d: Date) => d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  const point = (date: string, value: number, names: string[], tests: number): TrendPoint => ({
    date,
    label: label(new Date(`${date}T00:00:00`)),
    value,
    tests,
    name: names.length === 1 ? names[0] : names.length > 1 ? `${names.length} tests` : undefined,
  });

  if (span > MAX_FILLED_DAYS) {
    return days.map(d => {
      const e = byDate.get(d)!;
      return point(d, e.value, e.names, e.names.length);
    });
  }

  const out: TrendPoint[] = [];
  let carried = byDate.get(days[0])!.value;
  for (let i = 0; i < span; i++) {
    const d = new Date(first.getTime() + i * 864e5);
    const key = isoDay(d);
    const entry = byDate.get(key);
    if (entry) carried = entry.value;
    // A quiet day still belongs on a timeline; the average simply doesn't move.
    out.push(point(key, carried, entry?.names ?? [], entry?.names.length ?? 0));
  }
  return out;
}

/**
 * Tooltip heading for a daily point: the date, plus what happened that day. A day the
 * average was carried across says so rather than implying a test was taken.
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

  const points = useMemo<TrendPoint[]>(() => {
    // Unfiltered by group/track, the server's trend is richer than history — it isn't
    // capped at 50 attempts — so date-only filtering trims that rather than rebuilding.
    if (!dimensionFiltered) {
      return toDailySeries((analytics?.progress_trend ?? []).filter(p => inRange(p.date, range)));
    }

    let sum = 0;
    const perAttempt = [...attempts]
      .reverse()
      .map((h, i) => {
        sum += h.percentage ?? 0;
        const d = new Date(h.start_time);
        return {
          date: isoDay(d),
          label: d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
          value: Math.round((sum / (i + 1)) * 10) / 10,
          name: h.test_name ?? undefined,
        };
      });
    return toDailySeries(perAttempt);
  }, [analytics?.progress_trend, dimensionFiltered, attempts, range]);

  /** States exactly what's plotted, so a filtered chart can't read as the whole picture. */
  const caption = useMemo(() => {
    const bits = [
      group === 'all' ? null : GROUP_OPTIONS.find(o => o.value === group)?.label,
      track === 'all' ? null : TRACK_OPTIONS.find(o => o.value === track)?.label,
      rangeLabel(range).toLowerCase(),
    ].filter(Boolean);
    return `Rolling average score by day · ${bits.join(' · ')}`;
  }, [group, track, range]);

  return { points, caption, attempts, matches, filtersActive, isLoading, ceiling: trendCeiling(points) };
}
