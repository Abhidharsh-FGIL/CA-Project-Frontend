import { describe, expect, it } from 'vitest';
import { SUBSCRIPTION_PLANS } from '@/data/userPortalSampleData';
import { planAllowance } from '@/lib/plan-allowance';

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
