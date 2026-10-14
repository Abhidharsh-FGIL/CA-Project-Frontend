/**
 * Plans as the backend serves them.
 *
 * `GET /api/v1/user/subscription/plans` is the source of truth for what a plan
 * costs and includes. The portal used to read a bundled copy instead, and the two
 * drifted: the bundled file said ₹299 / ₹599 while the backend charged ₹199 / ₹499,
 * so the pricing page quoted prices nobody was being billed.
 *
 * The bundled list survives only as an offline fallback (see
 * `SUBSCRIPTION_PLANS`), and it is what supplies the one thing the API has no
 * field for — each plan's tagline.
 */
import {
  SUBSCRIPTION_PLANS,
  TIER_ORDER,
  type PlanFeatures,
  type SubscriptionPlanInfo,
  type SubscriptionTier,
} from '@/data/userPortalSampleData';

/** One plan as the endpoint returns it. */
export interface ApiSubscriptionPlan {
  plan_id: string;
  name: string;
  price: number | null;
  features: Record<string, unknown> | null;
  duration_days?: number;
  active: boolean;
  highlight: boolean;
  price_monthly: number | null;
  price_yearly: number | null;
  duration_days_monthly?: number;
  duration_days_yearly?: number;
  perks: string[] | null;
}

const isTier = (v: string): v is SubscriptionTier => (TIER_ORDER as string[]).includes(v);

const REPORT_LEVELS: PlanFeatures['ai_report_level'][] = ['basic', 'standard', 'detailed', 'full'];

/** A count that is a number, `'unlimited'`, or — for mocks — `'none'`. */
function count<T extends string>(v: unknown, words: T[], fallback: number | T): number | T {
  if (typeof v === 'number' && Number.isFinite(v) && v >= 0) return v;
  if (typeof v === 'string' && (words as string[]).includes(v)) return v as T;
  return fallback;
}

/**
 * One API plan as the portal's own shape.
 *
 * Returns null for a name that is not a tier the portal knows — a plan the backend
 * has but this build cannot render is skipped rather than shown half-understood.
 *
 * Each feature is read defensively and falls back to the bundled value, because
 * `features` is a free-form JSON column an admin edits by hand: a typo there
 * ("unlimted") must not turn a plan's limit into `NaN` or `undefined` on a screen
 * that compares against it.
 */
export function planFromApi(p: ApiSubscriptionPlan): SubscriptionPlanInfo | null {
  const name = (p.name ?? '').trim().toLowerCase();
  if (!isTier(name)) return null;

  const base = SUBSCRIPTION_PLANS.find(x => x.tier === name)!;
  const f = (p.features ?? {}) as Record<string, unknown>;

  const level = REPORT_LEVELS.includes(f.ai_report_level as PlanFeatures['ai_report_level'])
    ? (f.ai_report_level as PlanFeatures['ai_report_level'])
    : base.features.ai_report_level;

  return {
    plan_id: p.plan_id,
    tier: name,
    name: name.charAt(0).toUpperCase() + name.slice(1),
    tagline: base.tagline,
    price_monthly: p.price_monthly ?? p.price ?? base.price_monthly,
    price_yearly: p.price_yearly ?? base.price_yearly,
    highlight: !!p.highlight,
    // An inactive plan is not sold, but its existing holders still resolve to it.
    legacy: p.active === false,
    features: {
      practice_tests_per_month: count(
        f.practice_tests_per_month,
        ['unlimited'],
        base.features.practice_tests_per_month,
      ) as PlanFeatures['practice_tests_per_month'],
      mock_tests_per_month: count(
        f.mock_tests_per_month,
        ['unlimited', 'none'],
        base.features.mock_tests_per_month,
      ) as PlanFeatures['mock_tests_per_month'],
      ai_report_level: level,
      history_retention_days: count(
        f.history_retention_days,
        ['unlimited'],
        base.features.history_retention_days,
      ) as PlanFeatures['history_retention_days'],
      support: typeof f.support === 'string' && f.support.trim() ? f.support : base.features.support,
      download_pdf: typeof f.download_pdf === 'boolean' ? f.download_pdf : base.features.download_pdf,
    },
    perks: Array.isArray(p.perks) && p.perks.length > 0 ? p.perks : base.perks,
  };
}

/** The whole response, in ladder order, skipping anything unrecognised. */
export function plansFromApi(raw: unknown): SubscriptionPlanInfo[] {
  if (!Array.isArray(raw)) return [];
  const mapped = raw
    .map(p => planFromApi(p as ApiSubscriptionPlan))
    .filter((p): p is SubscriptionPlanInfo => p !== null);
  return mapped.sort((a, b) => TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier));
}

/**
 * The plans that are on sale: what the backend serves, less any it has retired.
 *
 * The one rule behind both the Subscription page and the landing page, so the two can never
 * offer different sets. An inactive plan is not sold, but its existing holders still resolve to
 * it through `getPlan`.
 */
export function offeredPlans(plans: SubscriptionPlanInfo[]): SubscriptionPlanInfo[] {
  return plans.filter(p => !p.legacy);
}

/**
 * How much cheaper a year is than twelve months, across the paid plans: the smallest and the
 * largest saving, as whole percents. Null when no paid plan has both prices — and a plan whose
 * yearly price is not actually lower saves nothing and is left out, not shown as a negative.
 */
export function yearlySavings(plans: SubscriptionPlanInfo[]): { min: number; max: number } | null {
  const pcts = plans
    .filter(p => p.price_monthly > 0 && p.price_yearly > 0 && p.price_yearly < p.price_monthly * 12)
    .map(p => Math.round((1 - p.price_yearly / (p.price_monthly * 12)) * 100))
    .filter(pct => pct > 0);
  return pcts.length ? { min: Math.min(...pcts), max: Math.max(...pcts) } : null;
}
