import { describe, expect, it, vi } from 'vitest';
import { SUBSCRIPTION_PLANS } from '@/data/userPortalSampleData';
import {
  attemptsUsed,
  composePlanNotice,
  planErrorFacts,
  reportLocked,
  subscriptionExpired,
  subscriptionLapsed,
  type PlanErrorFacts,
  type PlanNoticeContext,
} from '@/lib/plan-notice';
import { reportIsLocked } from '@/lib/report-access';
import { announcePlanNotice, onPlanNotice, showPlanNotice, withPlanNotice } from '@/lib/plan-notice-bus';
import { toRequestError } from '@/lib/api';

const plans = SUBSCRIPTION_PLANS.filter(p => !p.legacy);
const plan = (tier: string) => SUBSCRIPTION_PLANS.find(p => p.tier === tier)!;

const refusal = (detail: Record<string, unknown>, status = 403) => toRequestError({ detail }, status);

/** Anything that talks about limits or attempts coming back, or about a month. */
const NO_RESET = /reset|refill|renew|restore|a month|per month|monthly|the 1st|next month/i;

/**
 * Everything the popup says in its own words, as one string — for "never says X" checks. The plan's
 * perk lines are the backend's copy, shown as the Subscription page shows them, so they are not here.
 */
const allText = (facts: PlanErrorFacts, tier: string, extra: Partial<PlanNoticeContext> = {}) => {
  const n = composePlanNotice(facts, { current: plan(tier), plans, ...extra });
  return [n.title, ...n.body, ...n.usage.flatMap(u => [u.label, u.value]), n.primary.label, n.secondary?.label ?? '', n.dismiss].join(' | ');
};

describe('planErrorFacts', () => {
  it('reads the numbers from the body when the server sends them', () => {
    const f = planErrorFacts(refusal({ code: 'PLAN_LIMIT_REACHED', message: 'x', kind: 'practice', limit: 2, used: 2 }));
    expect(f).toMatchObject({ code: 'PLAN_LIMIT_REACHED', kind: 'practice', limit: 2, used: 2 });
  });

  it("falls back to the server's sentence for the numbers — the real live message", () => {
    const f = planErrorFacts(
      refusal({
        code: 'PLAN_LIMIT_REACHED',
        message: 'Your Free plan includes 2 practice tests a month, and you have used 2. The count resets on the 1st.',
      }),
    );
    expect(f).toMatchObject({ kind: 'practice', limit: 2, used: 2 });
  });

  it('knows a mock test from a practice test', () => {
    expect(planErrorFacts(refusal({ code: 'PLAN_LIMIT_REACHED', message: 'Your plan includes 3 mock tests, and you have used 3.' }))?.kind).toBe('mock');
  });

  it('copes with usage nested one level down', () => {
    expect(planErrorFacts(refusal({ code: 'PLAN_LIMIT_REACHED', message: 'm', limit: 3, usage: { used: 3 } }))?.used).toBe(3);
  });

  it('works when the body is only a code', () => {
    const f = planErrorFacts(refusal({ code: 'PLAN_LIMIT_REACHED', limit: 2, used: 2 }));
    expect(f).toMatchObject({ code: 'PLAN_LIMIT_REACHED', limit: 2 });
  });

  it('reads error_code as well as code', () => {
    expect(planErrorFacts(refusal({ error_code: 'PLAN_REQUIRED', message: 'm' }))?.code).toBe('PLAN_REQUIRED');
  });

  it('reads the plan a PLAN_REQUIRED needs', () => {
    expect(planErrorFacts(refusal({ code: 'PLAN_REQUIRED', message: 'm', required_plan: 'Ultimate', feature: 'ai_insights' }))).toMatchObject({
      requiredTier: 'ultimate',
      feature: 'ai_insights',
    });
  });

  it.each([
    ['a level lock', refusal({ code: 'LEVEL_LOCKED', message: 'Clear level 1 first.' })],
    ['a plain 500', refusal({ message: 'boom' }, 500)],
    ['a string detail', toRequestError({ detail: 'Not found' }, 404)],
    ['an ordinary error', new Error('Network down')],
    ['null', null],
    ['a string', 'PLAN_LIMIT_REACHED'],
  ])('is not a plan refusal: %s', (_name, error) => {
    expect(planErrorFacts(error)).toBeNull();
  });
});

describe('composePlanNotice — the limit', () => {
  const limit = (kind: PlanErrorFacts['kind'], n: number | null, used: number | null = n): PlanErrorFacts => ({
    code: 'PLAN_LIMIT_REACHED', kind, limit: n, used, requiredTier: null, feature: null,
  });
  const ultimate = plan('ultimate');
  const labels = (n: ReturnType<typeof composePlanNotice>) => n.options.map(o => o.label);

  describe('mock tests used up, practice tests still left', () => {
    it('says so, shows the two counts, and offers practice as the way on', () => {
      const n = composePlanNotice(limit('mock', 1), { current: plan('free'), plans, left: { mock: 0, practice: 2 } });
      expect(n.icon).toBe('clipboard');
      expect(n.title).toBe('Mock Test Limit Reached!');
      expect(n.body).toEqual([
        "You've completed the mock test included in your current plan.",
        'Good news! You still have **2 Subject-wise Practice Tests** remaining. Continue practising or upgrade your plan to unlock more mock tests.',
      ]);
      expect(n.usage).toEqual([
        { label: 'Mock Tests', value: '1/1 Used', tone: 'used' },
        { label: 'Practice Tests', value: '2 Remaining', tone: 'left' },
      ]);
      expect(n.primary).toEqual({ label: 'Upgrade Plan', to: '/user/subscription' });
      expect(n.secondary).toEqual({ label: 'Continue with Practice Tests', to: '/user/exams' });
      expect(n.options).toEqual([]);
    });

    it('says "1 Subject-wise Practice Test", not "1 … Tests"', () => {
      const n = composePlanNotice(limit('mock', 1), { current: plan('free'), plans, left: { mock: 0, practice: 1 } });
      expect(n.body[1]).toContain('**1 Subject-wise Practice Test**');
    });

    it('counts the mock tests when the plan has several', () => {
      const n = composePlanNotice(limit('mock', 5), { current: ultimate, plans, left: { mock: 0, practice: 10 } });
      expect(n.body[0]).toBe("You've completed all 5 mock tests included in your current plan.");
      expect(n.usage[0].value).toBe('5/5 Used');
    });

    it('on a paid plan, adds the renew / upgrade cards, and still offers practice', () => {
      const monthly = composePlanNotice(limit('mock', 5), { current: ultimate, plans, billing: 'monthly', left: { mock: 0, practice: 2 } });
      expect(monthly.title).toBe('Mock Test Limit Reached!');
      expect(monthly.body[1]).toBe(
        'Good news! You still have **2 Subject-wise Practice Tests** remaining. Continue practising, or choose a plan below to unlock more mock tests.',
      );
      expect(labels(monthly)).toEqual(['Renew Monthly', 'Upgrade to Annual']);
      expect(monthly.secondary).toEqual({ label: 'Continue with Practice Tests', to: '/user/exams' });

      const yearly = composePlanNotice(limit('mock', 30), { current: ultimate, plans, billing: 'yearly', left: { mock: 0, practice: 2 } });
      expect(labels(yearly)).toEqual(['Renew Annual', 'Switch to Monthly']);
    });

    it('says the plan has no mock tests when the allowance is zero', () => {
      const n = composePlanNotice(limit('mock', 0), { current: plan('free'), plans, left: { mock: 0, practice: 2 } });
      expect(n.title).toBe('Mock Tests Not Included');
      expect(n.body[0]).toBe("Mock tests aren't included in your Free plan.");
      expect(n.usage[0].value).toBe('Not included');
    });

    it('works out the allowance from the plan itself when the error has no numbers (Free has no mocks)', () => {
      const n = composePlanNotice(limit('mock', null, null), { current: plan('free'), plans, left: { mock: 0, practice: 2 } });
      expect(n.title).toBe('Mock Tests Not Included');
    });

    it('is not this popup when no practice tests are left, or when it was the practice tests that ran out', () => {
      expect(composePlanNotice(limit('mock', 1), { current: plan('free'), plans, left: { mock: 0, practice: 0 } }).title).toBe('Ready for the Next Step?');
      expect(composePlanNotice(limit('mock', 1), { current: plan('free'), plans }).title).toBe('Ready for the Next Step?');
      expect(composePlanNotice(limit('practice', 2), { current: plan('free'), plans, left: { mock: 1, practice: 0 } }).title).toBe('Ready for the Next Step?');
    });
  });

  describe('a Free plan used up', () => {
    it('congratulates, and offers the monthly plan beside the annual one', () => {
      const n = composePlanNotice(limit('practice', 2), { current: plan('free'), plans });
      expect(n.icon).toBe('graduation');
      expect(n.title).toBe('Ready for the Next Step?');
      expect(n.body).toEqual([
        "You've completed your free test allowance! Keep your preparation going with more mock tests, subject-wise practice, and detailed performance reports.",
      ]);
      expect(labels(n)).toEqual(['Monthly Plan', 'Annual Plan']);
      expect(n.dismiss).toBe('Maybe Later');
    });

    it('prices the cards from the plan, and sends each to its own billing cycle', () => {
      const [monthly, annual] = composePlanNotice(limit('practice', 2), { current: plan('free'), plans }).options;
      expect(monthly).toMatchObject({ price: ultimate.price_monthly, validity: '30-day validity', cta: 'Choose Monthly', featured: false, to: '/user/subscription?billing=monthly' });
      expect(monthly.points).toEqual(['5 Mock Tests', '25 Practice Tests', 'Detailed Reports']);
      expect(annual).toMatchObject({ price: ultimate.price_yearly, validity: '12-month validity', cta: 'Choose Annual', featured: true, accent: true, star: true, to: '/user/subscription?billing=yearly' });
      expect(annual.points).toEqual(['30 Mock Tests', '60 Practice Tests', 'Detailed Reports']);
    });

    it('offers the highlighted paid plan, and leaves out a cycle the plan has no price for', () => {
      const noYearly = plans.map(p => (p.tier === 'ultimate' ? { ...p, price_yearly: 0 } : p));
      expect(labels(composePlanNotice(limit('practice', 2), { current: plan('free'), plans: noYearly }))).toEqual(['Monthly Plan']);
    });

    it('offers no cards, only "View plans", when nothing is on sale', () => {
      const n = composePlanNotice(limit('practice', 2), { current: plan('free'), plans: [plan('free')] });
      expect(n.options).toEqual([]);
      expect(n.primary).toEqual({ label: 'View plans', to: '/user/subscription' });
    });

    it('still reads sensibly when the error says nothing about the kind or the number, or there is no current plan', () => {
      expect(composePlanNotice(limit(null, null, null), { current: plan('free'), plans }).title).toBe('Ready for the Next Step?');
      expect(composePlanNotice(limit('practice', 2), { current: null, plans }).title).toBe('Ready for the Next Step?');
    });
  });

  describe('a monthly plan used up', () => {
    it('names what was completed, and offers to renew or go annual', () => {
      const n = composePlanNotice(limit('practice', 25), { current: ultimate, plans, billing: 'monthly' });
      expect(n.title).toBe('Keep Your Preparation Going!');
      expect(n.body).toEqual([
        "You've completed all 5 Mock Tests and 25 Practice Tests in your Ultimate plan.",
        "You're making progress! Choose a plan to continue practising and improving your performance.",
      ]);
      expect(labels(n)).toEqual(['Renew Monthly', 'Upgrade to Annual']);
      expect(n.options[0]).toMatchObject({ cta: 'Renew Monthly', validity: '30 days', featured: false });
      expect(n.options[1]).toMatchObject({ cta: 'Choose Annual', validity: '12 months', featured: true, accent: true, star: false });
    });

    it('reads as monthly when the cycle is not known', () => {
      expect(composePlanNotice(limit('practice', 25), { current: ultimate, plans }).title).toBe('Keep Your Preparation Going!');
    });

    it('does not quote numbers the plan data does not have', () => {
      const n = composePlanNotice(limit('practice', 3), { current: plan('standard'), plans, billing: 'monthly' });
      expect(n.body[0]).toBe("You've used all the tests included in your Standard plan.");
    });
  });

  describe('an annual plan used up', () => {
    it('names what was used, and offers to renew or step down to monthly', () => {
      const n = composePlanNotice(limit('practice', 60), { current: ultimate, plans, billing: 'yearly' });
      expect(n.title).toBe("You've Completed Your Test Allowance!");
      expect(n.body).toEqual([
        "You've used all 30 Mock Tests and 60 Subject-wise Practice Tests included in your Ultimate plan.",
        'Keep your preparation going! Choose a plan to access more tests and continue tracking your progress.',
      ]);
      expect(labels(n)).toEqual(['Renew Annual', 'Switch to Monthly']);
      expect(n.options[0]).toMatchObject({ cta: 'Renew Annual', featured: true, accent: false, price: ultimate.price_yearly });
      expect(n.options[1]).toMatchObject({ cta: 'Choose Monthly', featured: false, price: ultimate.price_monthly });
    });
  });

  it('renews the plan they held, not another, when more than one is on sale', () => {
    const n = composePlanNotice(limit('practice', 25), { current: plan('standard'), plans, billing: 'monthly', held: ultimate });
    expect(n.options[0].price).toBe(ultimate.price_monthly);
  });

  // "We are not resetting any limit" — and no need to say so either: the popup says nothing about resets, in any form.
  it.each(['free', 'standard', 'ultimate', 'premium'])('says nothing about a reset, a refill, a renewal or a month — %s', tier => {
    for (const kind of ['practice', 'mock', null] as const) {
      for (const left of [undefined, { mock: 0, practice: 2 }]) {
        expect(allText(limit(kind, 2), tier, { left })).not.toMatch(NO_RESET);
      }
    }
  });
});

describe('composePlanNotice — a plan that has run out of time', () => {
  const expired = subscriptionExpired();
  const ultimate = plan('ultimate');
  const labels = (n: ReturnType<typeof composePlanNotice>) => n.options.map(o => o.label);

  it('tells an annual plan its 12 months are over, and offers to renew or go monthly', () => {
    const n = composePlanNotice(expired, { current: ultimate, plans, billing: 'yearly' });
    expect(n.icon).toBe('calendar');
    expect(n.title).toBe('Your Subscription Has Expired!');
    expect(n.body).toEqual([
      'Your Ultimate plan has reached the end of its 12-month validity.',
      "Your learning journey doesn't have to stop here! Choose a plan to continue taking tests and improving your performance.",
    ]);
    expect(labels(n)).toEqual(['Renew Annual', 'Switch to Monthly']);
  });

  it('tells a monthly plan its 30 days are over, and offers to renew or go annual', () => {
    const n = composePlanNotice(expired, { current: ultimate, plans, billing: 'monthly' });
    expect(n.title).toBe('Your Monthly Plan Has Expired!');
    expect(n.body[0]).toBe("Your 30-day subscription has come to an end, but your preparation journey doesn't have to stop!");
    expect(n.body[1]).toMatch(/^Renew your Monthly Plan or upgrade to Annual/);
    expect(labels(n)).toEqual(['Renew Monthly', 'Upgrade to Annual']);
  });

  it('names the plan they held when they have since dropped to Free', () => {
    const n = composePlanNotice(expired, { current: plan('free'), plans, billing: 'yearly', held: ultimate });
    expect(n.body[0]).toBe('Your Ultimate plan has reached the end of its 12-month validity.');
    expect(n.options[0].price).toBe(ultimate.price_yearly);
  });

  it('still says something when the plan is not known', () => {
    const n = composePlanNotice(expired, { current: plan('free'), plans, billing: 'yearly' });
    expect(n.body[0]).toBe('Your plan has reached the end of its 12-month validity.');
  });
});

describe('subscriptionLapsed', () => {
  const past = '2020-01-01T00:00:00Z';
  const future = new Date(Date.now() + 40 * 86_400_000).toISOString();

  it('is true for a paid tier whose end date has passed', () => {
    expect(subscriptionLapsed('ultimate', past)).toBe(true);
  });

  it('is true when the subscription itself says it has expired', () => {
    expect(subscriptionLapsed('free', null, 'expired')).toBe(true);
    expect(subscriptionLapsed('ultimate', future, 'expired')).toBe(true);
  });

  it('is false for a paid tier that has time left, an active one, or Free', () => {
    expect(subscriptionLapsed('ultimate', future)).toBe(false);
    expect(subscriptionLapsed('ultimate', future, 'active')).toBe(false);
    expect(subscriptionLapsed('free', past)).toBe(false);
  });

  it('is false for no date, the epoch placeholder, or junk', () => {
    expect(subscriptionLapsed('ultimate', null)).toBe(false);
    expect(subscriptionLapsed('ultimate', new Date(0).toISOString())).toBe(false);
    expect(subscriptionLapsed('ultimate', 'junk')).toBe(false);
    expect(subscriptionLapsed(undefined, past)).toBe(false);
  });
});

describe('an expired subscription from the server', () => {
  it.each(['SUBSCRIPTION_EXPIRED', 'SUBSCRIPTION_INACTIVE', 'PLAN_EXPIRED'])('reads the code %s', code => {
    expect(planErrorFacts(refusal({ code, message: 'm' }))?.code).toBe('SUBSCRIPTION_EXPIRED');
  });

  it('reads the older `error: subscription_inactive` body', () => {
    expect(planErrorFacts(refusal({ error: 'subscription_inactive', message: 'Your subscription is not active.' }))?.code).toBe('SUBSCRIPTION_EXPIRED');
  });
});

describe('composePlanNotice — a plan that is required', () => {
  const required = (tier: PlanErrorFacts['requiredTier'], feature: string | null = null): PlanErrorFacts => ({
    code: 'PLAN_REQUIRED', kind: null, limit: null, used: null, requiredTier: tier, feature,
  });

  it('names the plan that is needed', () => {
    const n = composePlanNotice(required('ultimate', 'ai_insights'), { current: plan('free'), plans });
    expect(n.title).toBe('Ultimate plan needed');
    expect(n.body[0]).toBe("You need the Ultimate plan for AI insights — you're on Free.");
    expect(n.primary.label).toBe('Upgrade to Ultimate');
    expect(n.suggestion?.name).toBe('Ultimate');
  });

  it('falls back to the next plan up when the error names none', () => {
    const n = composePlanNotice(required(null), { current: plan('free'), plans });
    expect(n.title).toBe('Upgrade needed');
    expect(n.body[0]).toBe("Your Free plan doesn't include this.");
    expect(n.suggestion?.name).toBe('Standard');
  });

  it('turns an unknown feature key into words', () => {
    expect(composePlanNotice(required('standard', 'mock_analysis'), { current: plan('free'), plans }).body[0]).toBe(
      "You need the Standard plan for mock analysis — you're on Free.",
    );
    expect(composePlanNotice(required(null, 'study_plan'), { current: plan('free'), plans }).body[0]).toBe(
      "Your Free plan doesn't include the study plan.",
    );
  });
});

describe('spent attempts', () => {
  it("reads the server's bare 400 — the real message, with its number", () => {
    const f = planErrorFacts(toRequestError({ detail: 'Maximum attempts (3) reached for this assessment' }, 400));
    expect(f).toMatchObject({ code: 'ATTEMPTS_USED', limit: 3 });
  });

  it('reads a code if the server ever sends one', () => {
    expect(planErrorFacts(refusal({ code: 'MAX_ATTEMPTS_REACHED', message: 'm', max_attempts: 2 }))).toMatchObject({ code: 'ATTEMPTS_USED', limit: 2 });
  });

  it('does not take other 400s, or the same words on a server error, for spent attempts', () => {
    expect(planErrorFacts(toRequestError({ detail: 'No questions available' }, 400))).toBeNull();
    expect(planErrorFacts(toRequestError({ detail: 'Maximum attempts (3) reached' }, 500))).toBeNull();
    expect(planErrorFacts(refusal({ code: 'SOMETHING_ELSE', message: 'Maximum attempts reached' }))).toBeNull();
  });

  it('a plan refusal is still a plan refusal', () => {
    expect(planErrorFacts(refusal({ code: 'PLAN_LIMIT_REACHED', message: 'Your plan includes 2 practice tests and you have used 2.' }))?.code).toBe('PLAN_LIMIT_REACHED');
  });

  it('tells a Free user to move to a paid plan, and goes to the Subscription page', () => {
    const n = composePlanNotice(attemptsUsed(3), { current: plan('free'), plans });
    expect(n.title).toBe('No attempts left');
    expect(n.body).toEqual(["You've used all 3 attempts on this test.", 'Upgrade to a paid plan to practise with more tests.']);
    expect(n.primary).toEqual({ label: 'Upgrade to Standard', to: '/user/subscription' });
    expect(n.suggestion?.name).toBe('Standard');
  });

  it('speaks to a paid user about the plan above theirs', () => {
    const n = composePlanNotice(attemptsUsed(1), { current: plan('standard'), plans });
    expect(n.body[0]).toBe("You've used all 1 attempt on this test.");
    expect(n.body[1]).toMatch(/higher plan/);
    expect(n.primary.label).toBe('Upgrade to Ultimate');
  });

  it('still leads to the plans for someone on the top one, with nothing to suggest', () => {
    const top = [...plans].sort((a, b) => b.price_monthly - a.price_monthly)[0];
    const n = composePlanNotice(attemptsUsed(3), { current: top, plans });
    expect(n.suggestion).toBeNull();
    expect(n.body).toEqual(["You've used all 3 attempts on this test."]);
    expect(n.primary).toEqual({ label: 'View plans', to: '/user/subscription' });
    expect(n.dismiss).toBe('Close');
  });

  it('says it without a number when the test does not say how many', () => {
    expect(composePlanNotice(attemptsUsed(null), { current: plan('free'), plans }).body[0]).toBe("You've used all your attempts on this test.");
  });

  it.each(['free', 'standard', 'ultimate', 'premium'])('says nothing about a reset, a refill, a renewal or a month — %s', tier => {
    expect(allText(attemptsUsed(3), tier)).not.toMatch(NO_RESET);
    expect(allText(attemptsUsed(null), tier)).not.toMatch(NO_RESET);
  });
});

describe('composePlanNotice — a report the plan does not include', () => {
  it('asks a Free user to upgrade to see the report, and says how long their plan lasts', () => {
    const n = composePlanNotice(reportLocked(), { current: plan('free'), plans });
    expect(n.title).toBe('Upgrade to see your report');
    expect(n.body).toEqual(['Upgrade your plan to see the report.', 'Your Free plan · Validity: unlimited']);
    expect(n.primary).toEqual({ label: 'Upgrade to Standard', to: '/user/subscription' });
    expect(n.dismiss).toBe('Not now');
  });

  it("uses the plan's own validity point when the backend has one", () => {
    const withValidity = { ...plan('free'), perks: ['1 mock test', 'Validity: for life'] };
    const n = composePlanNotice(reportLocked(), { current: withValidity, plans });
    expect(n.body[1]).toBe('Your Free plan · Validity: for life');
  });

  it('leaves the validity line out for a plan that does not state one', () => {
    expect(composePlanNotice(reportLocked(), { current: plan('standard'), plans }).body).toEqual(['Upgrade your plan to see the report.']);
  });

  it('still leads to the plans for someone on the top one', () => {
    const top = [...plans].sort((a, b) => b.price_monthly - a.price_monthly)[0];
    const n = composePlanNotice(reportLocked(), { current: top, plans });
    expect(n.primary).toEqual({ label: 'View plans', to: '/user/subscription' });
    expect(n.dismiss).toBe('Close');
  });

  it('is never read off a server error', () => {
    expect(planErrorFacts(refusal({ code: 'REPORT_LOCKED', message: 'm' }))).toBeNull();
  });
});

describe('reportIsLocked', () => {
  it('locks the mock report on Free, and nothing else', () => {
    expect(reportIsLocked('free', 'mock')).toBe(true);
    expect(reportIsLocked('free', ' Mock ')).toBe(true);
    expect(reportIsLocked('free', 'practice')).toBe(false);
    expect(reportIsLocked('free', null)).toBe(false);
    expect(reportIsLocked('standard', 'mock')).toBe(false);
    expect(reportIsLocked('ultimate', 'mock')).toBe(false);
    expect(reportIsLocked(undefined, 'mock')).toBe(false);
  });
});

describe('the bus', () => {
  const planError = () => refusal({ code: 'PLAN_LIMIT_REACHED', message: 'm', limit: 2, used: 2 });

  it('reports false, and does nothing, when no popup is listening', () => {
    expect(announcePlanNotice(planError())).toBe(false);
  });

  it('hands a plan refusal to the popup', () => {
    const seen = vi.fn();
    const off = onPlanNotice(seen);
    expect(announcePlanNotice(planError())).toBe(true);
    expect(seen).toHaveBeenCalledWith(expect.objectContaining({ code: 'PLAN_LIMIT_REACHED', limit: 2 }));
    off();
    expect(announcePlanNotice(planError())).toBe(false);
  });

  it('showPlanNotice raises facts a screen already has, and says whether anyone took them', () => {
    expect(showPlanNotice(attemptsUsed(3))).toBe(false);
    const seen = vi.fn();
    const off = onPlanNotice(seen);
    expect(showPlanNotice(attemptsUsed(3))).toBe(true);
    expect(seen).toHaveBeenCalledWith(expect.objectContaining({ code: 'ATTEMPTS_USED', limit: 3 }));
    off();
  });

  it('a bare 400 for spent attempts opens the popup and is rethrown handled', async () => {
    const off = onPlanNotice(() => {});
    const caught = await withPlanNotice(Promise.reject(toRequestError({ detail: 'Maximum attempts (3) reached for this assessment' }, 400))).catch(e => e);
    expect(caught.handled).toBe(true);
    off();
  });

  it('leaves every other error to its toast', () => {
    const seen = vi.fn();
    const off = onPlanNotice(seen);
    expect(announcePlanNotice(new Error('Network down'))).toBe(false);
    expect(announcePlanNotice(refusal({ code: 'LEVEL_LOCKED', message: 'Clear level 1.' }))).toBe(false);
    expect(seen).not.toHaveBeenCalled();
    off();
  });

  it('withPlanNotice rethrows a plan refusal marked handled, and any other error untouched', async () => {
    const off = onPlanNotice(() => {});
    const caught = await withPlanNotice(Promise.reject(planError())).catch(e => e);
    expect(caught.handled).toBe(true);
    expect(caught.code).toBe('PLAN_LIMIT_REACHED');

    const other = await withPlanNotice(Promise.reject(new Error('boom'))).catch(e => e);
    expect(other.handled).toBeUndefined();
    off();
  });

  it('withPlanNotice does not mark it handled when nothing took it', async () => {
    const caught = await withPlanNotice(Promise.reject(planError())).catch(e => e);
    expect(caught.handled).toBeUndefined();
  });

  it('withPlanNotice passes a result straight through', async () => {
    await expect(withPlanNotice(Promise.resolve({ ok: 1 }))).resolves.toEqual({ ok: 1 });
  });
});
