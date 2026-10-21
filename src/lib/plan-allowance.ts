/**
 * How many tests of a kind the person's plan still lets them take.
 *
 * A plan includes a number of practice tests and a number of mock tests (`practice_tests_per_month`
 * / `mock_tests_per_month` — the names are old; the plan notice treats them as totals for the plan,
 * and so does this). What the server counts against them it only says when it refuses a start, so
 * the count here is the person's own attempts of that kind since the plan began, read from the
 * history the portal already holds. The server still has the last word: this is what the page shows,
 * not what it enforces.
 */
import type { SubscriptionPlanInfo } from '@/data/userPortalSampleData';
import type { ApiAttempt, ApiEvalAssessment } from '@/lib/userPortalApi';

export type AllowanceKind = 'practice' | 'mock';

/** What the allowance reads of an attempt: when it began, and which kind of paper it was. */
export type AllowanceAttempt = Pick<ApiAttempt, 'test_mode' | 'start_time'> & Partial<Pick<ApiAttempt, 'test_id' | 'mode'>>;

/** What the allowance reads of a paper — to tell what an attempt was when the attempt does not say. */
export type AllowancePaper = Pick<ApiEvalAssessment, 'assessment_id' | 'mode'>;

const kindOfLabel = (v: unknown): AllowanceKind | null => {
  const s = typeof v === 'string' ? v.trim().toLowerCase() : '';
  return s === 'mock' || s === 'exam' ? 'mock' : s === 'practice' ? 'practice' : null;
};

/**
 * Which allowance an attempt is spent from.
 *
 * Practice tests and Key Topics tests are one allowance. A Key Topics paper is a practice paper — it
 * sits on the practice track, filed as a unit paper that names its topic — so it is counted with
 * every other practice test, never apart from them and never as a mock.
 *
 * The paper's track decides, because it is what the aspirant sees it under. The raw `test_mode` is
 * only the last resort: it is the assessment's exam/practice flag, and a Key Topics test that is
 * timed carries "exam" there — which would otherwise take a mock test's place in the count.
 *
 * Order: the attempt's own `mode`, then the paper's `mode` looked up by its id, then `test_mode`.
 */
export function attemptKind(h: AllowanceAttempt, paperMode?: string | null): AllowanceKind | null {
  return kindOfLabel(h.mode) ?? kindOfLabel(paperMode) ?? kindOfLabel(h.test_mode);
}

export interface PlanAllowance {
  /** What the plan includes of this kind; null when it is unlimited. */
  limit: number | null;
  /** The person's attempts of this kind under the plan, an unfinished one included. */
  used: number;
  /** `limit - used`, never below zero; null when unlimited. */
  left: number | null;
}

/**
 * Whether a subscription was bought for a month or a year, from how long it runs. The subscription
 * record carries no cycle of its own; a month is about 30 days and a year about 365, so anything
 * over two months is a year. Null when the dates are not real.
 */
export function billingCycleOf(start: string, end: string): 'monthly' | 'yearly' | null {
  const days = (Date.parse(end) - Date.parse(start)) / 86_400_000;
  if (!Number.isFinite(days) || days <= 0) return null;
  return days > 60 ? 'yearly' : 'monthly';
}

/**
 * How a plan card on the Subscription page relates to the plan the person holds, for the billing
 * cycle the page is showing.
 *
 *  - `current`  — the plan they hold, in the cycle they hold it (or a Free plan, which has no cycle).
 *  - `switch`   — the plan they hold, but bought for the other cycle: a month-long Ultimate viewed
 *                 on the Yearly tab is something they can move to, not something they have.
 *  - `other`    — any other plan.
 *
 * `held` is null when the cycle is not known (no subscription record, or it is not active), and then
 * the tier alone decides, as it did before the cycle was looked at.
 */
export type PlanCardState = 'current' | 'switch' | 'other';

export function planCardState(
  planTier: string,
  userTier: string,
  shown: 'monthly' | 'yearly',
  held: 'monthly' | 'yearly' | null,
): PlanCardState {
  if (planTier !== userTier) return 'other';
  if (planTier === 'free' || held === null || held === shown) return 'current';
  return 'switch';
}

export function planAllowance(
  plan: SubscriptionPlanInfo,
  kind: AllowanceKind,
  history: AllowanceAttempt[],
  /** When the plan began. Attempts before it were made under another plan and are not counted. */
  since?: string | null,
  /** The papers the portal knows, so an attempt that does not say its track can be matched to its paper. */
  papers?: AllowancePaper[],
): PlanAllowance {
  const included = kind === 'mock' ? plan.features.mock_tests_per_month : plan.features.practice_tests_per_month;
  const limit = included === 'none' ? 0 : typeof included === 'number' ? included : null;

  const from = since ? Date.parse(since) : NaN;
  const paperModes = new Map((papers ?? []).map(p => [p.assessment_id, p.mode]));
  const used = history.filter(
    h =>
      attemptKind(h, h.test_id ? paperModes.get(h.test_id) : undefined) === kind &&
      (Number.isNaN(from) || Date.parse(h.start_time) >= from),
  ).length;

  return { limit, used, left: limit === null ? null : Math.max(0, limit - used) };
}
