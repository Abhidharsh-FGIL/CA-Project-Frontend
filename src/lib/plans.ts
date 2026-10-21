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
  type PlanCard,
  type PlanLimits,
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
  /** The plan's points when billed monthly / yearly. Null where the plan reads the same either way. */
  perks_monthly?: string[] | null;
  perks_yearly?: string[] | null;
  /** The card's words per billing cycle — see `PlanCard`. */
  cards?: { monthly?: unknown; yearly?: unknown } | null;
}

const text = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);

/** One card's words from the backend, or undefined when it sends nothing usable. */
export function cardFrom(raw: unknown): PlanCard | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const r = raw as Record<string, unknown>;
  const included = Array.isArray(r.included)
    ? r.included.flatMap(item => {
        const i = (item ?? {}) as Record<string, unknown>;
        const title = text(i.title);
        return title ? [{ title, detail: text(i.detail) ?? '' }] : [];
      })
    : [];
  const excluded = Array.isArray(r.excluded) ? r.excluded.map(text).filter((x): x is string => !!x) : [];
  const headline = text(r.headline) ?? '';
  const description = text(r.description) ?? '';
  if (!headline && !description && included.length === 0) return undefined;
  return {
    headline,
    description,
    included,
    excluded,
    best_for: text(r.best_for) ?? '',
    cta: text(r.cta) ?? '',
    badge: text(r.badge),
  };
}

export function cardsFrom(raw: unknown): SubscriptionPlanInfo['cards'] {
  if (!raw || typeof raw !== 'object') return undefined;
  const r = raw as Record<string, unknown>;
  const monthly = cardFrom(r.monthly);
  const yearly = cardFrom(r.yearly);
  return monthly || yearly ? { monthly, yearly } : undefined;
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
    perks_monthly: pointList(p.perks_monthly),
    perks_yearly: pointList(p.perks_yearly),
    cards: cardsFrom(p.cards),
    limits_monthly: limitsOf(f.monthly),
    limits_yearly: limitsOf(f.yearly),
    duration_days_monthly: days(p.duration_days_monthly),
    duration_days_yearly: days(p.duration_days_yearly),
  };
}

/** A whole number of days that is really a duration. */
const days = (v: unknown): number | undefined => (typeof v === 'number' && Number.isInteger(v) && v > 0 ? v : undefined);

/**
 * The allowance a plan gives for one billing cycle, from `features.monthly` / `features.yearly`.
 * Only what the object actually says: a count it leaves out is read from the plan's top-level one
 * at the time of use (see `planDetails`), so a half-filled object cannot show a made-up number.
 */
function limitsOf(v: unknown): PlanLimits | undefined {
  if (!v || typeof v !== 'object') return undefined;
  const o = v as Record<string, unknown>;
  const mock = readCount(o.mock_tests_per_month, ['unlimited', 'none']);
  const practice = readCount(o.practice_tests_per_month, ['unlimited']);
  if (mock === undefined && practice === undefined) return undefined;
  return { mock, practice } as PlanLimits;
}

/** `count` without a fallback: a number, one of the words, or undefined. */
function readCount<T extends string>(v: unknown, words: T[]): number | T | undefined {
  if (typeof v === 'number' && Number.isFinite(v) && v >= 0) return v;
  if (typeof v === 'string' && (words as string[]).includes(v)) return v as T;
  return undefined;
}

/** A list of points the backend sent, or undefined — a null, an empty list or a stray non-string is no list. */
function pointList(v: unknown): string[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const points = v.filter((x): x is string => typeof x === 'string' && x.trim().length > 0);
  return points.length > 0 ? points : undefined;
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

/**
 * What a plan includes for the billing cycle being looked at.
 *
 * A plan whose limits differ by cycle (Ultimate: 5 mock tests a month, or 30 on the yearly plan)
 * carries a list for each, and the card shows the one that matches the toggle — so a buyer reads the
 * limits of the option they are about to pay for, not both at once. A plan with no list for the
 * cycle falls back to its single `perks`.
 */
export function perksFor(plan: SubscriptionPlanInfo, billing: 'monthly' | 'yearly'): string[] {
  return (billing === 'yearly' ? plan.perks_yearly : plan.perks_monthly) ?? plan.perks;
}

/** One labelled fact about a plan, for the small print under its points. */
export interface PlanDetail {
  label: string;
  value: string;
}

const countText = (v: number | 'unlimited' | 'none'): string => (v === 'unlimited' ? 'Unlimited' : v === 'none' ? 'Not included' : String(v));

/** 30 → "1 month", 365 → "12 months" — the words the plans' own points use — and anything else in days. */
export function durationText(days: number): string {
  if (days === 365) return '12 months';
  if (days % 30 === 0) return days === 30 ? '1 month' : `${days / 30} months`;
  return `${days} days`;
}

const sentence = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * Everything the plan data says about a plan, for the billing cycle being looked at — so nothing the
 * backend sends goes unshown.
 *
 * The points already carry most counts and the validity ("5 mock tests", "Validity: 1 month"), so
 * those three rows appear only when the points do not already say them: a plan whose list is just
 * "Full reports" still shows what it lets someone take and for how long. History, report level, PDF
 * and support are always listed. No row says "per month": those counts are what the plan includes,
 * not an allowance that comes back.
 */
export function planDetails(plan: SubscriptionPlanInfo, billing: 'monthly' | 'yearly'): PlanDetail[] {
  const points = perksFor(plan, billing).join(' ');
  const limits = billing === 'yearly' ? plan.limits_yearly : plan.limits_monthly;
  const mock = limits?.mock ?? plan.features.mock_tests_per_month;
  const practice = limits?.practice ?? plan.features.practice_tests_per_month;
  const validFor = billing === 'yearly' ? plan.duration_days_yearly : plan.duration_days_monthly;

  const rows: PlanDetail[] = [];
  if (!/mock/i.test(points)) rows.push({ label: 'Mock tests', value: countText(mock) });
  if (!/practice/i.test(points)) rows.push({ label: 'Practice tests', value: countText(practice) });
  // A free plan has no term to state: its "30 days" is a billing default, and its points say "unlimited".
  if (!/valid/i.test(points) && plan.price_monthly > 0 && validFor) rows.push({ label: 'Validity', value: durationText(validFor) });

  const retention = plan.features.history_retention_days;
  rows.push({ label: 'History retention', value: retention === 'unlimited' ? 'Unlimited' : `${retention} days` });
  rows.push({ label: 'AI reports', value: sentence(plan.features.ai_report_level) });
  rows.push({ label: 'PDF download', value: plan.features.download_pdf ? 'Included' : 'Not included' });
  rows.push({ label: 'Support', value: sentence(plan.features.support) });
  return rows;
}

/**
 * How many mock and practice tests a plan includes in a billing cycle, as the backend sends them: the
 * cycle's own counts when it has them, else the plan's. Null where the data says nothing — never a
 * number from the copy, so a change on the server shows everywhere it is read.
 */
export function planCounts(
  plan: SubscriptionPlanInfo,
  billing: 'monthly' | 'yearly',
): { mock: number | null; practice: number | null; mockText: string; practiceText: string } {
  const limits = billing === 'yearly' ? plan.limits_yearly : plan.limits_monthly;
  const mock = limits?.mock ?? plan.features.mock_tests_per_month;
  const practice = limits?.practice ?? plan.features.practice_tests_per_month;
  return {
    mock: typeof mock === 'number' ? mock : null,
    practice: typeof practice === 'number' ? practice : null,
    mockText: countText(mock),
    practiceText: countText(practice),
  };
}

/**
 * How long a plan lasts in a billing cycle, in the backend's own words: its "Validity: …" point when it
 * has one ("1 month", "unlimited"), else the length of the cycle in days. Null when the data says neither.
 */
export function validityOf(plan: SubscriptionPlanInfo, billing: 'monthly' | 'yearly'): string | null {
  const point = perksFor(plan, billing).find(p => /^validity\b/i.test(p));
  if (point) return point.replace(/^validity:?\s*/i, '').trim() || null;
  const days = billing === 'yearly' ? plan.duration_days_yearly : plan.duration_days_monthly;
  return plan.price_monthly > 0 && days ? durationText(days) : null;
}

/** The line under a plan's name: "Lifetime access", or "Valid for 1 month" — from the plan's own validity. */
export function validityLabel(plan: SubscriptionPlanInfo, billing: 'monthly' | 'yearly'): string | null {
  const v = validityOf(plan, billing);
  if (!v) return null;
  return /^unlimited$/i.test(v) ? 'Lifetime validity' : `Valid for ${v}`;
}

/** Price per month of a cycle, rounded — "₹167" for the yearly plan. Null for a free plan or a cycle with no length. */
export function costPerMonth(plan: SubscriptionPlanInfo, billing: 'monthly' | 'yearly'): number | null {
  const price = billing === 'yearly' ? plan.price_yearly : plan.price_monthly;
  const days = billing === 'yearly' ? plan.duration_days_yearly : plan.duration_days_monthly;
  if (!(price > 0) || !days) return null;
  return Math.round(price / Math.max(1, Math.round(days / 30)));
}
