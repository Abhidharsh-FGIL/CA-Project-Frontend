/**
 * Aspirant dashboard analytics.
 *
 * Prefers a single server-computed payload
 * (`GET /api/v1/user/dashboard/analytics`, see TNPSC_DASHBOARD_API.md). Until that
 * ships, everything except subject strengths is derived on the client from the
 * attempt history the portal already holds — so the dashboard is never blank, it
 * just gets more accurate when the endpoint lands.
 *
 * Subject strengths are the one thing the client genuinely cannot compute: the
 * history endpoint returns per-attempt totals, not per-subject breakdowns.
 */
import { userApi } from './api';
import type { ApiAttempt } from './userPortalApi';

export interface TrendPoint {
  /** ISO date (YYYY-MM-DD). */
  date: string;
  /** Short axis label, e.g. "26 Aug". */
  label: string;
  value: number;
  /** Test this point came from, when known — shown in the tooltip. */
  name?: string;
  /** Attempts submitted on this day; 0 on a day carried over from the last one. */
  tests?: number;
}

export interface SubjectStrength {
  subject: string;
  /** correct ÷ attempted, 0–100. Not the same as the average score. */
  accuracy: number;
  /** Questions actually answered — 0 means the accuracy is meaningless. */
  attempted?: number;
  correct?: number;
  /** Questions in the subject, answered or not. */
  total_questions?: number;
}

export interface StreakDay {
  /** "Mon" … "Sun" */
  day: string;
  /** YYYY-MM-DD. */
  date: string;
  /** Attempted something that day. */
  active: boolean;
  /** Part of the run that produces the streak number — a subset of `active`. */
  streak: boolean;
}

export interface WeekdayScore {
  /** "Mon" … "Sun" */
  day: string;
  value: number;
}

export interface DashboardStat {
  value: number;
  /** Change against the previous comparable window, in percentage points. */
  delta?: number | null;
}

export interface UserDashboardAnalytics {
  assessments_assigned: DashboardStat;
  mock_tests_attempted: DashboardStat;
  average_score: DashboardStat;
  tests_this_month: DashboardStat;
  /** Rolling average score over time — the big progress chart. */
  progress_trend: TrendPoint[];
  /** "You're preparing better than N% of learners" — null when unknown. */
  percentile: number | null;
  subject_strengths: SubjectStrength[];
  /**
   * Overall accuracy across every answered question (correct ÷ attempted), 0–100,
   * or null when nothing has been answered. Deliberately distinct from
   * `average_score`, which divides by every question in the paper including the
   * ones left blank — the two differ a lot early on, and conflating them in one
   * widget is what made the donut read wrong.
   */
  overall_accuracy: number | null;
  weekly_performance: {
    average: number;
    improvement: number | null;
    days: WeekdayScore[];
  };
  streak: {
    days: number;
    /**
     * The last seven days ending today, oldest first. A streak is "days up to now",
     * not "days this week", so a Monday-first calendar week can't represent it: a
     * Sat→Mon run would show three days with one mark inside the week.
     */
    week: StreakDay[];
  };
  /** false when the aspirant has no finished attempts — charts show an empty state. */
  has_data: boolean;
  /** true when the numbers came from the server rather than being derived here. */
  server_computed: boolean;
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** GET the server payload; falls back to a client-side derivation on any failure. */
export async function getUserDashboardAnalytics(
  history: ApiAttempt[],
  assessmentCount: number,
): Promise<UserDashboardAnalytics> {
  const derived = deriveAnalytics(history, assessmentCount);
  try {
    const res = await userApi.get<any>('/api/v1/user/dashboard/analytics');
    if (res && Array.isArray(res.progress_trend)) return adaptServerAnalytics(res, derived);
  } catch {
    /* endpoint not deployed yet */
  }
  return derived;
}

/** correct ÷ attempted across every subject — the donut's centre figure. */
function overallAccuracy(list: SubjectStrength[]): number | null {
  let correct = 0;
  let attempted = 0;
  for (const s of list) {
    if (s.correct == null || s.attempted == null) continue;
    correct += s.correct;
    attempted += s.attempted;
  }
  return attempted > 0 ? Math.round((correct / attempted) * 100) : null;
}

// ─── Server → client adaptation ────────────────────────────────────────────────

/**
 * The shipped endpoint does not match the shape in TNPSC_DASHBOARD_API.md: stats are
 * nested under `stats` with different names, trend points carry `running_average`
 * rather than `value`, `weekly_performance` is a flat array, and `streak` has no
 * per-day week. Rather than ask the backend to churn a working endpoint, adapt here —
 * and stay tolerant of the documented shape too, in case it converges later.
 *
 * Anything the server does not carry keeps the client-derived value; nothing is
 * invented.
 */
function adaptServerAnalytics(res: any, derived: UserDashboardAnalytics): UserDashboardAnalytics {
  const stats = res.stats ?? {};
  const num = (v: any): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

  const stat = (server: any, fallback: DashboardStat): DashboardStat => {
    const value = num(server?.value);
    if (value == null) return fallback;
    return { value: Math.round(value), delta: num(server?.delta_percentage) ?? num(server?.delta) };
  };

  // ── Trend: `running_average` is exactly what the chart claims to plot ("rolling
  //    average score over time"); `percentage` is the single attempt's score.
  const trend: TrendPoint[] = res.progress_trend
    .map((p: any) => {
      const value = num(p.value) ?? num(p.running_average) ?? num(p.percentage);
      if (value == null) return null;
      const date = typeof p.date === 'string' ? p.date : '';
      return {
        date,
        // The server's `label` is the test name, not an axis label.
        label: date ? shortLabel(new Date(date)) : (p.label ?? ''),
        value: Math.round(value * 10) / 10,
        name: typeof p.label === 'string' ? p.label : undefined,
      };
    })
    .filter(Boolean) as TrendPoint[];

  // ── Weekly: array of days, or the documented { average, improvement, days }.
  const rawDays: any[] = Array.isArray(res.weekly_performance)
    ? res.weekly_performance
    : (res.weekly_performance?.days ?? []);

  // Key by DATE, not by weekday name. The server window is the rolling last 7 days,
  // so "Thu" in it can be last Thursday — matching on the name would draw a past
  // attempt in a slot that hasn't happened yet.
  const byDate = new Map<string, { value: number; attempts: number }>();
  for (const d of rawDays) {
    if (typeof d?.date !== 'string') continue;
    byDate.set(d.date.slice(0, 10), {
      value: Math.round(num(d.value) ?? num(d.average_score) ?? 0),
      attempts: num(d.attempts) ?? 0,
    });
  }

  const weekDates = currentWeekDates();
  const haveDates = byDate.size > 0;
  // Days of this week the server window doesn't reach (and days still to come) stay
  // empty rather than borrowing last week's numbers.
  const days: WeekdayScore[] = haveDates
    ? DAY_LABELS.map((day, i) => ({ day, value: byDate.get(weekDates[i])?.value ?? 0 }))
    : derived.weekly_performance.days;

  const thisWeekRows = haveDates
    ? weekDates.map(d => byDate.get(d)).filter(Boolean) as { value: number; attempts: number }[]
    : [];
  const attemptWeight = thisWeekRows.reduce((s, d) => s + d.attempts, 0);
  const weekAverage = attemptWeight
    ? Math.round(thisWeekRows.reduce((s, d) => s + d.value * d.attempts, 0) / attemptWeight)
    : haveDates
      ? 0
      : derived.weekly_performance.average;

  // ── Streak: no week array is sent; rebuild it from daily attempt counts.
  const streak = haveDates
    ? buildStreak(d => (byDate.get(d)?.attempts ?? 0) > 0, num(res.streak?.current_days) ?? num(res.streak?.days))
    : derived.streak;

  // ── Subject strengths: drop subjects with nothing answered — a 0% accuracy over
  //    0 attempted questions is not a weakness, and it would top the "needs work" list.
  const strengths: SubjectStrength[] = Array.isArray(res.subject_strengths)
    ? res.subject_strengths
        .map((s: any) => ({
          subject: String(s?.subject ?? '').trim(),
          accuracy: Math.round(num(s?.accuracy) ?? 0),
          attempted: num(s?.attempted) ?? undefined,
          correct: num(s?.correct) ?? undefined,
          total_questions: num(s?.total_questions) ?? undefined,
        }))
        .filter((s: SubjectStrength) => s.subject && (s.attempted == null || s.attempted > 0))
    : derived.subject_strengths;

  return {
    // Not sent by the server — the client knows how many assessments are assigned.
    assessments_assigned: derived.assessments_assigned,
    // `stats.tests_taken` counts every attempt; this card counts mocks only, so the
    // client's mode-aware figure stays.
    mock_tests_attempted: derived.mock_tests_attempted,
    average_score: stat(stats.average_score, derived.average_score),
    tests_this_month: derived.tests_this_month,
    progress_trend: trend.length ? trend : derived.progress_trend,
    percentile: num(res.percentile),
    subject_strengths: strengths,
    overall_accuracy: overallAccuracy(strengths),
    weekly_performance: {
      average: weekAverage,
      // No prior-week baseline in the payload; the client has the history to compute it.
      improvement: derived.weekly_performance.improvement,
      days,
    },
    streak,
    has_data: (num(res.total_attempts) ?? 0) > 0 || trend.length > 0 || derived.has_data,
    server_computed: true,
  };
}

// ─── Marks ────────────────────────────────────────────────────────────────────

/**
 * Total marks for an attempt, inferred from its score and percentage.
 *
 * Attempts carry `score` (marks) and `percentage` but not the paper's maximum, and
 * "Average Score: 2%" reads as a contradiction — an aspirant thinks in marks out of
 * 300. Inferring the denominator lets every percentage be shown next to the marks
 * behind it. Returns null when the percentage is zero, where the maximum is
 * genuinely unknowable.
 */
export function maxMarksOf(h: { score: number | null; percentage: number | null }): number | null {
  if (h.score == null || !h.percentage) return null;
  const max = Math.round(h.score / (h.percentage / 100));
  return Number.isFinite(max) && max > 0 ? max : null;
}

/** The paper size these attempts share, or null when they disagree. */
export function commonMaxMarks(list: { score: number | null; percentage: number | null }[]): number | null {
  const seen = new Set<number>();
  for (const h of list) {
    const max = maxMarksOf(h);
    if (max != null) seen.add(max);
  }
  return seen.size === 1 ? [...seen][0] : null;
}

/** "12 of 300 marks" — omits the total when it can't be inferred. */
export function marksLabel(score: number | null | undefined, max: number | null): string | null {
  if (score == null) return null;
  const rounded = Math.round(score * 10) / 10;
  return max != null ? `${rounded} of ${max} marks` : `${rounded} marks`;
}

// ─── Client-side derivation ────────────────────────────────────────────────────

const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/**
 * Build the streak strip: the last seven days ending today, oldest first, with the
 * current run marked. The run walks back from today (today being empty is not yet a
 * break — the day isn't over), stopping at the first gap.
 *
 * The strip and the number come out of this one function so they can never disagree.
 */
function buildStreak(isActive: (date: string) => boolean, serverDays?: number | null): {
  days: number;
  week: StreakDay[];
} {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dates: string[] = [];
  for (let i = 6; i >= 0; i--) dates.push(dayKey(new Date(today.getTime() - i * 864e5)));

  // Collect the run's actual indices rather than a count: an empty today doesn't break
  // the run but does mean the run isn't simply the last N days of the window.
  const inRun = new Set<number>();
  let i = dates.length - 1;
  if (!isActive(dates[i])) i--; // today isn't over yet
  for (; i >= 0 && isActive(dates[i]); i--) inRun.add(i);
  const run = inRun.size;

  const week: StreakDay[] = dates.map((date, idx) => ({
    date,
    day: DAY_LABELS[(new Date(`${date}T00:00:00`).getDay() + 6) % 7],
    active: isActive(date),
    streak: inRun.has(idx),
  }));

  // Only trust the server's number when our seven-day window is saturated and can't
  // see how much further back the run goes.
  const days = run === 7 && (serverDays ?? 0) > 7 ? serverDays! : run;
  return { days, week };
}

/** The seven dates of the current week, Monday-first, as YYYY-MM-DD. */
function currentWeekDates(): string[] {
  const monday = new Date();
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7)); // Sunday(0) → 6
  monday.setHours(0, 0, 0, 0);
  return DAY_LABELS.map((_, i) => dayKey(new Date(monday.getTime() + i * 864e5)));
}
const shortLabel = (d: Date) =>
  d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });

/** Attempts that actually finished — an in-progress attempt has no score to count. */
function submitted(history: ApiAttempt[]): ApiAttempt[] {
  return history.filter(h => h.status !== 'in_progress' && h.percentage != null);
}

function countBetween(list: ApiAttempt[], from: Date, to: Date): number {
  return list.filter(h => {
    const t = new Date(h.start_time).getTime();
    return t >= from.getTime() && t < to.getTime();
  }).length;
}

/** Change in percentage points between this window and the one before it. */
function windowDelta(list: ApiAttempt[], days: number): number | null {
  const now = new Date();
  const start = new Date(now.getTime() - days * 864e5);
  const prevStart = new Date(now.getTime() - days * 2 * 864e5);
  const current = countBetween(list, start, now);
  const previous = countBetween(list, prevStart, start);
  // Going from nothing to something is not "+100%" — there's no baseline to
  // compare against, and showing one reads as a real trend when it isn't.
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

export function deriveAnalytics(
  history: ApiAttempt[],
  assessmentCount: number,
): UserDashboardAnalytics {
  const done = submitted(history);
  const now = new Date();

  const avg = (list: ApiAttempt[]) =>
    list.length > 0
      ? Math.round(list.reduce((s, h) => s + (h.percentage ?? 0), 0) / list.length)
      : 0;

  // ── Progress trend: rolling average of everything up to each of the last 14 days
  const progress_trend: TrendPoint[] = [];
  for (let i = 13; i >= 0; i--) {
    const day = new Date(now.getTime() - i * 864e5);
    const upTo = done.filter(h => new Date(h.start_time) <= day);
    progress_trend.push({
      date: dayKey(day),
      label: shortLabel(day),
      value: avg(upTo),
    });
  }

  // ── This week, Monday-first
  const monday = new Date(now);
  const offset = (monday.getDay() + 6) % 7; // Sunday(0) → 6
  monday.setDate(monday.getDate() - offset);
  monday.setHours(0, 0, 0, 0);

  const days: WeekdayScore[] = DAY_LABELS.map((day, i) => {
    const from = new Date(monday.getTime() + i * 864e5);
    const to = new Date(from.getTime() + 864e5);
    const onDay = done.filter(h => {
      const t = new Date(h.start_time).getTime();
      return t >= from.getTime() && t < to.getTime();
    });
    return { day, value: avg(onDay) };
  });

  // ── Streak: same construction the server path uses, so both agree.
  const attemptDays = new Set(history.map(h => dayKey(new Date(h.start_time))));
  const streak = buildStreak(d => attemptDays.has(d));

  const thisWeek = done.filter(h => new Date(h.start_time) >= monday);
  const lastWeekStart = new Date(monday.getTime() - 7 * 864e5);
  const lastWeek = done.filter(h => {
    const t = new Date(h.start_time);
    return t >= lastWeekStart && t < monday;
  });
  const weekAvg = avg(thisWeek);
  const improvement = lastWeek.length > 0 ? weekAvg - avg(lastWeek) : null;

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  return {
    assessments_assigned: { value: assessmentCount, delta: null },
    mock_tests_attempted: {
      value: done.filter(h => h.test_mode === 'mock').length,
      delta: windowDelta(done.filter(h => h.test_mode === 'mock'), 7),
    },
    average_score: { value: avg(done), delta: null },
    tests_this_month: {
      value: done.filter(h => new Date(h.start_time) >= monthStart).length,
      delta: windowDelta(done, 7),
    },
    progress_trend,
    percentile: null,
    // Not derivable here — the history endpoint carries no per-subject breakdown.
    subject_strengths: [],
    overall_accuracy: null,
    weekly_performance: { average: weekAvg, improvement, days },
    streak,
    has_data: done.length > 0,
    server_computed: false,
  };
}
