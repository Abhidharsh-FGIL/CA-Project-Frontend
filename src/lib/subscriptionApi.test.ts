import { describe, expect, it } from 'vitest';
import { usageFor, type CurrentSubscription, type SubscriptionUsage } from './subscriptionApi';

/** The `usage` block as the live server sends it (an Ultimate plan, 4 Nov – 4 Dec 2026). */
const usage: SubscriptionUsage = {
  can_use_topup: true,
  topup_mock_left: 0,
  topup_practice_left: 0,
  mock_limit: 5,
  mock_used: 5,
  mock_plan_left: 0,
  mock_left: 0,
  mock_used_all_time: 6,
  mock_overall: 6,
  practice_limit: 50,
  practice_used: 1,
  practice_plan_left: 49,
  practice_left: 49,
  practice_used_all_time: 5,
  practice_overall: 54,
};

const sub = (u: SubscriptionUsage | null) => ({ status: 'active', usage: u }) as CurrentSubscription;

describe('usageFor', () => {
  it('counts every test ever available, free and carried-over ones included', () => {
    expect(usageFor(sub(usage), 'mock')).toMatchObject({ used: 6, total: 6, left: 0 });
    expect(usageFor(sub(usage), 'practice')).toMatchObject({ used: 5, total: 54, left: 49 });
  });

  it("falls back to this period's count on a server that sends no all-time one", () => {
    const { mock_overall, mock_used_all_time, ...older } = usage;
    expect(usageFor(sub(older), 'mock')).toMatchObject({ used: 5, total: 5, left: 0 });
  });

  it('is null when the server sent no usage', () => {
    expect(usageFor(sub(null), 'mock')).toBeNull();
  });
});
