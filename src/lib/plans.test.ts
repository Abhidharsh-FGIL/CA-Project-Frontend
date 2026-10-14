import { describe, expect, it } from 'vitest';
import { SUBSCRIPTION_PLANS, type SubscriptionPlanInfo } from '@/data/userPortalSampleData';
import { offeredPlans, planFromApi, plansFromApi, yearlySavings, type ApiSubscriptionPlan } from '@/lib/plans';

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
