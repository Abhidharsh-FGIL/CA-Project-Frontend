import { describe, expect, it } from 'vitest';
import { SUBSCRIPTION_PLANS, type SubscriptionPlanInfo } from '@/data/userPortalSampleData';
import { durationText, offeredPlans, perksFor, planDetails, planFromApi, plansFromApi, yearlySavings, type ApiSubscriptionPlan } from '@/lib/plans';

const api = (over: Partial<ApiSubscriptionPlan>): ApiSubscriptionPlan => ({
  plan_id: 'p',
  name: 'standard',
  price: 199,
  features: null,
  active: true,
  highlight: false,
  price_monthly: 199,
  price_yearly: 1999,
  perks: null,
  ...over,
});

const plan = (over: Partial<SubscriptionPlanInfo>): SubscriptionPlanInfo => ({ ...SUBSCRIPTION_PLANS[1], ...over });

describe('offeredPlans — what is on sale', () => {
  it('drops a plan the backend has retired and keeps every other', () => {
    const live = plansFromApi([
      api({ name: 'free', price: 0, price_monthly: 0, price_yearly: 0 }),
      api({ name: 'standard' }),
      api({ name: 'ultimate', price_monthly: 499, price_yearly: 4999, highlight: true }),
      api({ name: 'premium', price_monthly: 999, price_yearly: 9999, active: false }),
    ]);
    expect(live.map(p => p.tier)).toEqual(['free', 'standard', 'ultimate', 'premium']);
    expect(offeredPlans(live).map(p => p.tier)).toEqual(['free', 'standard', 'ultimate']);
  });

  it('offers a plan by what the backend says, not by its name — an active premium is on sale', () => {
    const live = plansFromApi([api({ name: 'standard' }), api({ name: 'premium', price_monthly: 999, price_yearly: 9999 })]);
    expect(offeredPlans(live).map(p => p.tier)).toEqual(['standard', 'premium']);
  });

  it('uses the backend prices, not the bundled ones', () => {
    const [standard] = offeredPlans(plansFromApi([api({ name: 'standard', price_monthly: 149, price_yearly: 1499 })]));
    expect(standard.price_monthly).toBe(149);
    expect(standard.price_monthly).not.toBe(SUBSCRIPTION_PLANS.find(p => p.tier === 'standard')!.price_monthly);
  });

  it('skips a plan the portal has no tier for rather than showing it half-understood', () => {
    expect(planFromApi(api({ name: 'platinum' }))).toBeNull();
  });
});

describe('yearlySavings', () => {
  it('is the smallest and largest saving of a year over twelve months', () => {
    // 199 × 12 = 2388 → 1999 saves 16%;  499 × 12 = 5988 → 4999 saves 17%
    expect(yearlySavings([plan({ price_monthly: 199, price_yearly: 1999 }), plan({ price_monthly: 499, price_yearly: 4999 })])).toEqual({
      min: 16,
      max: 17,
    });
  });

  it('is one figure when every plan saves the same', () => {
    expect(yearlySavings([plan({ price_monthly: 100, price_yearly: 1000 })])).toEqual({ min: 17, max: 17 });
  });

  it('ignores a free plan, and a plan with no yearly price', () => {
    expect(
      yearlySavings([plan({ price_monthly: 0, price_yearly: 0 }), plan({ price_monthly: 199, price_yearly: 0 })]),
    ).toBeNull();
  });

  it('never reports a yearly price that costs as much as twelve months, or more, as a saving', () => {
    expect(yearlySavings([plan({ price_monthly: 100, price_yearly: 1200 }), plan({ price_monthly: 100, price_yearly: 1500 })])).toBeNull();
  });

  it('is null for no plans', () => {
    expect(yearlySavings([])).toBeNull();
  });
});

// The two plans the backend returns today, as it returns them.
const FREE = {
  plan_id: 'e4613878-c12d-49f1-b7ce-ced685964a66',
  name: 'free',
  price: 0,
  features: { support: 'email', download_pdf: false, ai_report_level: 'basic', mock_tests_per_month: 1, history_retention_days: 30, practice_tests_per_month: 2 },
  active: true,
  highlight: false,
  price_monthly: 0,
  price_yearly: 0,
  perks: ['1 mock test', '2 practice tests', 'Practice test reports', 'Upgrade to see mock test reports', 'Validity: unlimited'],
  perks_monthly: null,
  perks_yearly: null,
} as ApiSubscriptionPlan;

const ULTIMATE = {
  plan_id: 'a16ce294-64ed-4f29-9065-6db81118803f',
  name: 'ultimate',
  price: 499,
  features: {
    yearly: { mock_tests_per_month: 30, practice_tests_per_month: 60 },
    monthly: { mock_tests_per_month: 5, practice_tests_per_month: 25 },
    support: 'priority email',
    download_pdf: false,
    ai_report_level: 'detailed',
    mock_tests_per_month: 5,
    history_retention_days: 365,
    practice_tests_per_month: 25,
  },
  active: true,
  highlight: true,
  price_monthly: 499,
  price_yearly: 1999,
  perks: [
    'Monthly ₹499 — 5 mock tests, 25 practice tests, valid 1 month',
    'Yearly ₹1999 — 30 mock tests, 60 practice tests, valid 12 months',
    'Full reports with AI insights',
  ],
  perks_monthly: ['5 mock tests', '25 practice tests', 'Full reports with AI insights', 'Validity: 1 month'],
  perks_yearly: ['30 mock tests', '60 practice tests', 'Full reports with AI insights', 'Validity: 12 months'],
} as ApiSubscriptionPlan;

describe('perksFor — the points of the billing cycle being looked at', () => {
  const [free, ultimate] = plansFromApi([FREE, ULTIMATE]);

  it('shows the monthly plan its monthly limits and the yearly plan its yearly ones', () => {
    expect(perksFor(ultimate, 'monthly')).toEqual(['5 mock tests', '25 practice tests', 'Full reports with AI insights', 'Validity: 1 month']);
    expect(perksFor(ultimate, 'yearly')).toEqual(['30 mock tests', '60 practice tests', 'Full reports with AI insights', 'Validity: 12 months']);
  });

  it('never shows one cycle both options at once', () => {
    for (const cycle of ['monthly', 'yearly'] as const) {
      expect(perksFor(ultimate, cycle).join(' ')).not.toMatch(/Monthly ₹|Yearly ₹/);
    }
  });

  it('a plan with no per-cycle lists reads the same either way', () => {
    expect(perksFor(free, 'monthly')).toEqual(FREE.perks);
    expect(perksFor(free, 'yearly')).toEqual(FREE.perks);
  });

  it('falls back to the single list for a cycle that has none', () => {
    const onlyYearly = planFromApi({ ...ULTIMATE, perks_monthly: null })!;
    expect(perksFor(onlyYearly, 'monthly')).toEqual(ULTIMATE.perks);
    expect(perksFor(onlyYearly, 'yearly')).toEqual(ULTIMATE.perks_yearly);
  });

  it('treats an empty list, or one of blanks and non-strings, as no list', () => {
    const empty = planFromApi({ ...ULTIMATE, perks_monthly: [], perks_yearly: ['', '  ', 7 as unknown as string] })!;
    expect(empty.perks_monthly).toBeUndefined();
    expect(empty.perks_yearly).toBeUndefined();
    expect(perksFor(empty, 'monthly')).toEqual(ULTIMATE.perks);
    expect(perksFor(empty, 'yearly')).toEqual(ULTIMATE.perks);
  });

  it('keeps the real points and drops the stray ones', () => {
    const mixed = planFromApi({ ...ULTIMATE, perks_yearly: ['30 mock tests', '', null as unknown as string, 'Validity: 12 months'] })!;
    expect(mixed.perks_yearly).toEqual(['30 mock tests', 'Validity: 12 months']);
  });

  it('a backend that does not send the lists at all still works from the single one', () => {
    const { perks_monthly, perks_yearly, ...old } = ULTIMATE;
    void perks_monthly;
    void perks_yearly;
    const plan = planFromApi(old as ApiSubscriptionPlan)!;
    expect(perksFor(plan, 'monthly')).toEqual(ULTIMATE.perks);
    expect(perksFor(plan, 'yearly')).toEqual(ULTIMATE.perks);
  });
});

describe('planDetails — everything the plan data says, for the cycle being looked at', () => {
  const [free, ultimate] = plansFromApi([
    { ...FREE, duration_days_monthly: 30, duration_days_yearly: 365 },
    { ...ULTIMATE, duration_days_monthly: 30, duration_days_yearly: 365 },
  ]);
  const asMap = (rows: ReturnType<typeof planDetails>) => Object.fromEntries(rows.map(r => [r.label, r.value]));

  it("lists the live Ultimate plan's history, report level, PDF and support — and not what its points already say", () => {
    expect(planDetails(ultimate, 'monthly')).toEqual([
      { label: 'History retention', value: '365 days' },
      { label: 'AI reports', value: 'Detailed' },
      { label: 'PDF download', value: 'Not included' },
      { label: 'Support', value: 'Priority email' },
    ]);
  });

  it("lists the live Free plan's the same way", () => {
    expect(planDetails(free, 'monthly')).toEqual([
      { label: 'History retention', value: '30 days' },
      { label: 'AI reports', value: 'Basic' },
      { label: 'PDF download', value: 'Not included' },
      { label: 'Support', value: 'Email' },
    ]);
  });

  it('reads the per-cycle counts the backend nests under features.monthly / features.yearly', () => {
    expect(ultimate.limits_monthly).toEqual({ mock: 5, practice: 25 });
    expect(ultimate.limits_yearly).toEqual({ mock: 30, practice: 60 });
    expect(free.limits_monthly).toBeUndefined();
  });

  it('shows the counts and the validity, by cycle, when the points leave them out', () => {
    const bare = { ...ultimate, perks: ['Full reports'], perks_monthly: undefined, perks_yearly: undefined };
    expect(asMap(planDetails(bare, 'monthly'))).toMatchObject({ 'Mock tests': '5', 'Practice tests': '25', Validity: '1 month' });
    expect(asMap(planDetails(bare, 'yearly'))).toMatchObject({ 'Mock tests': '30', 'Practice tests': '60', Validity: '12 months' });
  });

  it("uses the plan's own count when it has no per-cycle one", () => {
    const bare = { ...free, perks: ['Reports'] };
    expect(asMap(planDetails(bare, 'monthly'))).toMatchObject({ 'Mock tests': '1', 'Practice tests': '2' });
  });

  it("never invents a term for a free plan — its 30 days is a billing default", () => {
    const bare = { ...free, perks: ['Reports'] };
    expect(asMap(planDetails(bare, 'monthly'))).not.toHaveProperty('Validity');
  });

  it('says Unlimited and Not included in words', () => {
    const bare = { ...ultimate, perks: ['Reports'], perks_monthly: undefined, limits_monthly: { mock: 'none', practice: 'unlimited' } as const };
    expect(asMap(planDetails(bare, 'monthly'))).toMatchObject({ 'Mock tests': 'Not included', 'Practice tests': 'Unlimited' });
    const unlimited = { ...ultimate, features: { ...ultimate.features, history_retention_days: 'unlimited' as const, download_pdf: true } };
    expect(asMap(planDetails(unlimited, 'monthly'))).toMatchObject({ 'History retention': 'Unlimited', 'PDF download': 'Included' });
  });

  it('a half-filled per-cycle object borrows the missing count from the plan, never a made-up one', () => {
    const half = planFromApi({ ...ULTIMATE, features: { ...(ULTIMATE.features as object), monthly: { mock_tests_per_month: 7 } } })!;
    expect(half.limits_monthly).toEqual({ mock: 7, practice: undefined });
    const bare = { ...half, perks: ['Reports'], perks_monthly: undefined };
    expect(asMap(planDetails(bare, 'monthly'))).toMatchObject({ 'Mock tests': '7', 'Practice tests': '25' });
  });

  it('ignores a per-cycle object that says nothing usable, and a duration that is not days', () => {
    const junk = planFromApi({ ...ULTIMATE, features: { ...(ULTIMATE.features as object), monthly: { mock_tests_per_month: 'lots' }, yearly: 'x' }, duration_days_monthly: -3, duration_days_yearly: 1.5 })!;
    expect(junk.limits_monthly).toBeUndefined();
    expect(junk.limits_yearly).toBeUndefined();
    expect(junk.duration_days_monthly).toBeUndefined();
    expect(junk.duration_days_yearly).toBeUndefined();
  });

  it('never says "per month" — nothing here is an allowance that comes back', () => {
    for (const p of [free, ultimate]) {
      for (const cycle of ['monthly', 'yearly'] as const) {
        const bare = { ...p, perks: ['Reports'], perks_monthly: undefined, perks_yearly: undefined };
        expect(planDetails(bare, cycle).map(r => `${r.label} ${r.value}`).join(' ')).not.toMatch(/per month|a month|reset/i);
      }
    }
  });

  it.each([
    [30, '1 month'],
    [90, '3 months'],
    [365, '12 months'],
    [45, '45 days'],
    [7, '7 days'],
  ])('writes %i days as %s', (n, text) => {
    expect(durationText(n)).toBe(text);
  });
});
