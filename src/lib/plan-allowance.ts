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
import type { ApiAttempt } from '@/lib/userPortalApi';

export type AllowanceKind = 'practice' | 'mock';

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

export function planAllowance(
  plan: SubscriptionPlanInfo,
  kind: AllowanceKind,
  history: Array<Pick<ApiAttempt, 'test_mode' | 'start_time'>>,
  /** When the plan began. Attempts before it were made under another plan and are not counted. */
  since?: string | null,
): PlanAllowance {
  const included = kind === 'mock' ? plan.features.mock_tests_per_month : plan.features.practice_tests_per_month;
  const limit = included === 'none' ? 0 : typeof included === 'number' ? included : null;

  const from = since ? Date.parse(since) : NaN;
  const used = history.filter(
    h =>
      (h.test_mode ?? '').trim().toLowerCase() === kind && (Number.isNaN(from) || Date.parse(h.start_time) >= from),
  ).length;

  return { limit, used, left: limit === null ? null : Math.max(0, limit - used) };
}
