import { describe, expect, it } from 'vitest';
import { SUBSCRIPTION_PLANS } from '@/data/userPortalSampleData';
import { activePlanPurchase, billingCycleOf, planAllowance, planCardState } from '@/lib/plan-allowance';

const plan = (tier: string) => SUBSCRIPTION_PLANS.find(p => p.tier === tier)!;
const withFeatures = (tier: string, features: Record<string, unknown>) => {
  const base = plan(tier);
  return { ...base, features: { ...base.features, ...features } } as typeof base;
};

const at = (test_mode: string | null, start_time: string) => ({ test_mode, start_time });

describe('planAllowance', () => {
  const free = withFeatures('free', { practice_tests_per_month: 2, mock_tests_per_month: 1 });

  it('is the plan’s whole allowance when nothing has been taken', () => {
    expect(planAllowance(free, 'practice', [])).toEqual({ limit: 2, used: 0, left: 2 });
    expect(planAllowance(free, 'mock', [])).toEqual({ limit: 1, used: 0, left: 1 });
  });

  it('counts attempts of the kind asked about, and no others', () => {
    const history = [at('practice', '2026-10-01T10:00:00Z'), at('mock', '2026-10-02T10:00:00Z'), at(null, '2026-10-03T10:00:00Z')];
    expect(planAllowance(free, 'practice', history)).toEqual({ limit: 2, used: 1, left: 1 });
    expect(planAllowance(free, 'mock', history)).toEqual({ limit: 1, used: 1, left: 0 });
  });

  it('never goes below zero', () => {
    const history = [at('practice', '2026-10-01T00:00:00Z'), at('practice', '2026-10-02T00:00:00Z'), at('Practice', '2026-10-03T00:00:00Z')];
    expect(planAllowance(free, 'practice', history).left).toBe(0);
  });

  it('leaves out attempts from before the plan began', () => {
    const history = [at('practice', '2026-09-01T00:00:00Z'), at('practice', '2026-10-05T00:00:00Z')];
    expect(planAllowance(free, 'practice', history, '2026-10-01T00:00:00Z').used).toBe(1);
    expect(planAllowance(free, 'practice', history, null).used).toBe(2);
    expect(planAllowance(free, 'practice', history, 'not a date').used).toBe(2);
  });

  it('has no limit and nothing left to count down on an unlimited plan', () => {
    const unlimited = withFeatures('ultimate', { practice_tests_per_month: 'unlimited', mock_tests_per_month: 'unlimited' });
    expect(planAllowance(unlimited, 'practice', [at('practice', '2026-10-01T00:00:00Z')])).toEqual({ limit: null, used: 1, left: null });
  });

  it('reads "none" as a limit of zero', () => {
    const none = withFeatures('free', { mock_tests_per_month: 'none' });
    expect(planAllowance(none, 'mock', [])).toEqual({ limit: 0, used: 0, left: 0 });
  });
});

describe('billingCycleOf', () => {
  it('reads a 30-day subscription as monthly and a 365-day one as yearly', () => {
    expect(billingCycleOf('2026-10-12', '2026-11-11')).toBe('monthly');
    expect(billingCycleOf('2026-10-12', '2027-10-12')).toBe('yearly');
  });

  it('is null for dates that are not real or run backwards', () => {
    expect(billingCycleOf('junk', '2026-11-11')).toBeNull();
    expect(billingCycleOf('2026-11-11', '2026-10-12')).toBeNull();
  });
});

describe('planCardState', () => {
  it('marks the held plan current only on the cycle it was bought for', () => {
    expect(planCardState('ultimate', 'ultimate', 'monthly', 'monthly')).toBe('current');
    expect(planCardState('ultimate', 'ultimate', 'yearly', 'monthly')).toBe('switch');
    expect(planCardState('ultimate', 'ultimate', 'monthly', 'yearly')).toBe('switch');
    expect(planCardState('ultimate', 'ultimate', 'yearly', 'yearly')).toBe('current');
  });

  it('falls back to the tier alone when the cycle is not known', () => {
    expect(planCardState('ultimate', 'ultimate', 'yearly', null)).toBe('current');
    expect(planCardState('ultimate', 'ultimate', 'monthly', null)).toBe('current');
  });

  it('never marks a different plan current', () => {
    expect(planCardState('free', 'ultimate', 'monthly', 'monthly')).toBe('other');
    expect(planCardState('standard', 'ultimate', 'yearly', 'yearly')).toBe('other');
  });

  it('a Free plan has no cycle, so it is current on both tabs', () => {
    expect(planCardState('free', 'free', 'yearly', 'monthly')).toBe('current');
    expect(planCardState('free', 'free', 'monthly', null)).toBe('current');
  });
});

describe('planAllowance with the plan purchase', () => {
  const ultimate = plan('ultimate');
  const at = (start_time: string) => ({ test_mode: 'practice', mode: 'practice', start_time }) as any;
  // Two practice tests under the Free plan, then one after upgrading on 15 Oct.
  const history = [at('2026-10-02T10:00:00Z'), at('2026-10-05T10:00:00Z'), at('2026-10-16T10:00:00Z')];
  const purchase = (over: Record<string, unknown> = {}) => ({
    purchased_at: '2026-10-15T08:00:00Z',
    validity: { valid_from: '2026-10-15T08:00:00Z', status: 'active', mock_tests: 5, mock_used: 0, practice_tests: 25, practice_used: 1, ...over },
  });

  it('uses the server’s own count for the plan, which never includes tests taken under an earlier plan', () => {
    const a = planAllowance(ultimate, 'practice', history, null, undefined, purchase());
    expect(a).toEqual({ limit: 25, used: 1, left: 24 });
  });

  it('takes the limit from the purchase, so a yearly plan is judged by its own', () => {
    expect(planAllowance(ultimate, 'practice', history, null, undefined, purchase({ practice_tests: 60 })).limit).toBe(60);
  });

  it('without a count from the server, counts only from when the plan was bought — even with no subscription start', () => {
    const noCount = purchase({ practice_used: null, practice_tests: null });
    const a = planAllowance(ultimate, 'practice', history, null, undefined, noCount);
    expect(a.used).toBe(1); // the two Free-plan tests are not counted
  });

  it('counts from the later of the subscription start and the purchase', () => {
    const noCount = purchase({ practice_used: null });
    expect(planAllowance(ultimate, 'practice', history, '2026-09-01T00:00:00Z', undefined, noCount).used).toBe(1);
    expect(planAllowance(ultimate, 'practice', history, '2026-10-20T00:00:00Z', undefined, noCount).used).toBe(0);
  });

  it('with no purchase at all it counts as before', () => {
    expect(planAllowance(ultimate, 'practice', history).used).toBe(3);
    expect(planAllowance(ultimate, 'practice', history, null, undefined, null).used).toBe(3);
  });

  it('finds the purchase in force: the newest one marked active', () => {
    const items = [
      { purchased_at: '2026-10-15', validity: { status: 'active' } },
      { purchased_at: '2026-09-01', validity: { status: 'replaced' } },
    ] as any[];
    expect(activePlanPurchase(items)).toBe(items[0]);
    expect(activePlanPurchase([{ purchased_at: 'x', validity: { status: 'expired' } }] as any[])).toBeNull();
    expect(activePlanPurchase(undefined)).toBeNull();
  });
});