/**
 * Plans: the backend is the source of truth, the bundled list is a mirror.
 *
 * The portal used to quote ₹299 / ₹599 from a bundled file while the backend
 * billed ₹199 / ₹499. These pin the two behaviours that stop that recurring: the
 * live response wins, and the fallback is held to what the backend actually says.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { planFromApi, plansFromApi, type ApiSubscriptionPlan } from '@/lib/plans';
import {
  SUBSCRIPTION_PLANS,
  TIER_ORDER,
  getPlan,
  includesAiInsights,
  setLivePlans,
} from '@/data/userPortalSampleData';

/** `GET /api/v1/user/subscription/plans`, as the backend returned it. */
const LIVE: ApiSubscriptionPlan[] = [
  {
    plan_id: 'e4613878',
    name: 'free',
    price: 0,
    features: { support: 'email', download_pdf: false, ai_report_level: 'basic', mock_tests_per_month: 'none', history_retention_days: 30, practice_tests_per_month: 2 },
    duration_days: 30, active: true, highlight: false, price_monthly: 0, price_yearly: 0,
    perks: ['2 practice tests per month', 'Basic AI reports', '30-day history'],
  },
  {
    plan_id: 'b6401555',
    name: 'standard',
    price: 199,
    features: { support: 'email', download_pdf: false, ai_report_level: 'standard', mock_tests_per_month: 3, history_retention_days: 90, practice_tests_per_month: 'unlimited' },
    duration_days: 30, active: true, highlight: false, price_monthly: 199, price_yearly: 1999,
    perks: ['Unlimited practice tests', '3 mock tests per month', 'Standard AI reports', '90-day history'],
  },
  {
    plan_id: 'a16ce294',
    name: 'ultimate',
    price: 499,
    features: { yearly: { mock_tests_per_month: 30, practice_tests_per_month: 60 }, monthly: { mock_tests_per_month: 5, practice_tests_per_month: 25 }, support: 'priority email', download_pdf: false, ai_report_level: 'detailed', mock_tests_per_month: 5, history_retention_days: 365, practice_tests_per_month: 25 },
    duration_days: 30, active: true, highlight: true, price_monthly: 499, price_yearly: 1999,
    perks: ['Monthly ₹499 — 5 mock tests, 25 practice tests, valid 1 month', 'Yearly ₹1999 — 30 mock tests, 60 practice tests, valid 12 months', 'Full reports with AI insights'],
  },
  {
    plan_id: '82a270e1',
    name: 'premium',
    price: 999,
    features: { support: 'priority', download_pdf: true, ai_report_level: 'full', mock_tests_per_month: 'unlimited', history_retention_days: 'unlimited', practice_tests_per_month: 'unlimited' },
    duration_days: 30, active: true, highlight: false, price_monthly: 999, price_yearly: 9999,
    perks: ['Unlimited practice & mock tests', 'Priority mock tests', 'Full downloadable AI reports', 'Unlimited history'],
  },
];

afterEach(() => setLivePlans(null));

describe('the bundled fallback mirrors the backend', () => {
  // The drift this exists to catch: a bundled price that is not the billed price.
  it.each(TIER_ORDER)('%s matches the live plan field for field', tier => {
    const live = planFromApi(LIVE.find(p => p.name === tier)!)!;
    const bundled = SUBSCRIPTION_PLANS.find(p => p.tier === tier)!;
    expect(bundled.price_monthly).toBe(live.price_monthly);
    expect(bundled.price_yearly).toBe(live.price_yearly);
    expect(bundled.features).toEqual(live.features);
    expect(bundled.perks).toEqual(live.perks);
    expect(!!bundled.highlight).toBe(!!live.highlight);
  });
});

describe('planFromApi', () => {
  it('takes price, limits and perks from the backend', () => {
    const standard = planFromApi(LIVE[1])!;
    expect(standard.price_monthly).toBe(199);
    expect(standard.price_yearly).toBe(1999);
    expect(standard.features.mock_tests_per_month).toBe(3);
    expect(standard.perks).toContain('3 mock tests per month');
  });

  it('keeps the tagline, which the backend has no column for', () => {
    expect(planFromApi(LIVE[2])!.tagline).toBeTruthy();
  });

  it('treats an inactive plan as retired but still resolvable', () => {
    const retired = planFromApi({ ...LIVE[3], active: false })!;
    expect(retired.legacy).toBe(true);
    expect(retired.features.mock_tests_per_month).toBe('unlimited');
  });

  it('skips a plan name this build does not know', () => {
    expect(planFromApi({ ...LIVE[0], name: 'enterprise' })).toBeNull();
  });

  it('does not turn a hand-edited typo into a broken limit', () => {
    // `features` is a free-form JSON column an admin edits by hand.
    const p = planFromApi({
      ...LIVE[1],
      features: { ...LIVE[1].features, practice_tests_per_month: 'unlimted', mock_tests_per_month: -4 },
    })!;
    expect(p.features.practice_tests_per_month).toBe('unlimited'); // the fallback's value
    expect(p.features.mock_tests_per_month).toBe(3);
  });

  it('falls back when perks or features are missing', () => {
    const p = planFromApi({ ...LIVE[1], perks: null, features: null })!;
    expect(p.perks.length).toBeGreaterThan(0);
    expect(p.features.ai_report_level).toBe('standard');
  });

  it('reads a name in any case', () => {
    expect(planFromApi({ ...LIVE[2], name: ' Ultimate ' })!.tier).toBe('ultimate');
  });
});

describe('what an order is created against', () => {
  it('carries the backend’s plan id through', () => {
    expect(planFromApi(LIVE[1])!.plan_id).toBe('b6401555');
  });

  it('leaves the fallback without ids, so an unconfirmed plan cannot be bought', () => {
    // A failed plans fetch must disable purchase, not let it run against an id
    // nobody checked.
    for (const p of SUBSCRIPTION_PLANS) expect(p.plan_id, p.tier).toBeUndefined();
  });
});

describe('plansFromApi', () => {
  it('returns the ladder in order whatever order it arrived in', () => {
    const shuffled = [LIVE[3], LIVE[0], LIVE[2], LIVE[1]];
    expect(plansFromApi(shuffled).map(p => p.tier)).toEqual(['free', 'standard', 'ultimate', 'premium']);
  });

  it('survives a response that is not a list', () => {
    expect(plansFromApi(null)).toEqual([]);
    expect(plansFromApi({ error: 'x' })).toEqual([]);
  });
});

describe('getPlan', () => {
  it('prefers the live plan once it has loaded', () => {
    expect(getPlan('standard').price_monthly).toBe(199);
    setLivePlans(plansFromApi(LIVE.map(p => (p.name === 'standard' ? { ...p, price_monthly: 249 } : p))));
    expect(getPlan('standard').price_monthly).toBe(249);
  });

  it('never returns nothing — a missing plan would crash every screen that reads a user’s own', () => {
    setLivePlans(plansFromApi([LIVE[0]])); // backend served only Free
    for (const tier of TIER_ORDER) expect(getPlan(tier), tier).toBeDefined();
  });

  it('drops a live list that is empty rather than hiding every plan', () => {
    setLivePlans([]);
    expect(getPlan('ultimate').price_monthly).toBe(499);
  });
});

describe('the one costly feature follows the plan', () => {
  it('includes AI-written insights only from the detailed level up', () => {
    expect(includesAiInsights(planFromApi(LIVE[0])!)).toBe(false);
    expect(includesAiInsights(planFromApi(LIVE[1])!)).toBe(false);
    expect(includesAiInsights(planFromApi(LIVE[2])!)).toBe(true);
    expect(includesAiInsights(planFromApi(LIVE[3])!)).toBe(true);
  });
});
