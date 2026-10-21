import { describe, expect, it } from 'vitest';
import { PLAN_COPY, cardFor, cycleShown, includedFor, validityFor } from '@/lib/plan-copy';
import { plansFromApi } from '@/lib/plans';

// The two plans the backend returns today, as it returns them.
const FREE = {
  plan_id: 'e4613878',
  name: 'free',
  price: 0,
  features: { support: 'email', download_pdf: false, ai_report_level: 'basic', mock_tests_per_month: 1, history_retention_days: 30, practice_tests_per_month: 2 },
  active: true,
  highlight: false,
  price_monthly: 0,
  price_yearly: 0,
  duration_days_monthly: 30,
  duration_days_yearly: 365,
  perks: ['1 mock test', '2 practice tests', 'Practice test reports', 'Upgrade to see mock test reports', 'Validity: unlimited'],
  perks_monthly: null,
  perks_yearly: null,
};

const ULTIMATE = {
  plan_id: 'a16ce294',
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
  duration_days_monthly: 30,
  duration_days_yearly: 365,
  perks: ['Monthly ₹499 — 5 mock tests, 25 practice tests, valid 1 month'],
  perks_monthly: ['5 mock tests', '25 practice tests', 'Full reports with AI insights', 'Validity: 1 month'],
  perks_yearly: ['30 mock tests', '60 practice tests', 'Full reports with AI insights', 'Validity: 12 months'],
};

const [free, ultimate] = plansFromApi([FREE, ULTIMATE]);

describe('cycleShown', () => {
  const freePlan = { price_monthly: 0, price_yearly: 0 };
  const paid = { price_monthly: 199, price_yearly: 1999 };
  const monthlyOnly = { price_monthly: 199, price_yearly: 0 };

  it('shows the cycle that was asked for when the plan has a price for it', () => {
    expect(cycleShown(paid, 'yearly')).toBe('yearly');
    expect(cycleShown(paid, 'monthly')).toBe('monthly');
  });

  it('keeps a paid plan with no yearly price on monthly rather than showing ₹0', () => {
    expect(cycleShown(monthlyOnly, 'yearly')).toBe('monthly');
  });

  it('lets a free plan follow the toggle — it reads the same either way', () => {
    expect(cycleShown(freePlan, 'yearly')).toBe('yearly');
    expect(cycleShown(freePlan, 'monthly')).toBe('monthly');
  });
});

describe('PLAN_COPY — the words, with no numbers of their own', () => {
  const all = Object.entries(PLAN_COPY).flatMap(([tier, byCycle]) =>
    Object.entries(byCycle).map(([cycle, copy]) => ({ id: `${tier}/${cycle}`, copy: copy! })),
  );

  it('has a free plan and an ultimate plan, each for both cycles', () => {
    expect(Object.keys(PLAN_COPY).sort()).toEqual(['free', 'ultimate']);
    for (const byCycle of Object.values(PLAN_COPY)) expect(Object.keys(byCycle).sort()).toEqual(['monthly', 'yearly']);
  });

  it('gives every card the words the pages show', () => {
    for (const { id, copy } of all) {
      expect(copy.headline, id).toBeTruthy();
      expect(copy.blurb, id).toBeTruthy();
      expect(copy.bestFor, id).toBeTruthy();
      expect(copy.cta, id).toBeTruthy();
      expect(copy.included.length, id).toBeGreaterThan(0);
    }
  });

  it('writes no test count or validity into its text — those come from the plan', () => {
    for (const { id, copy } of all) {
      const text = JSON.stringify(copy);
      expect(text, id).not.toMatch(/\b\d+\s+(Full-Length|Subject-wise|Mock|Practice)/i);
      expect(text, id).not.toMatch(/Valid for|30-Day|12-Month|30 days|12 months/i);
    }
  });

  it('marks where the counts go, so the plan fills them in', () => {
    for (const { id, copy } of all) {
      expect(copy.included[0][0], id).toContain('{mock}');
      expect(copy.included[1][0], id).toContain('{practice}');
    }
  });
});

describe('includedFor — the points, with the backend’s counts', () => {
  it('fills the Ultimate yearly points with the yearly counts', () => {
    const points = includedFor(PLAN_COPY.ultimate.yearly!, ultimate, 'yearly').map(([t]) => t);
    expect(points[0]).toBe('30 Full-Length Mock Tests');
    expect(points[1]).toBe('60 Subject-wise Practice Tests');
  });

  it('fills the Ultimate monthly points with the monthly counts', () => {
    const points = includedFor(PLAN_COPY.ultimate.monthly!, ultimate, 'monthly').map(([t]) => t);
    expect(points[0]).toBe('5 Full-Length Mock Tests');
    expect(points[1]).toBe('25 Subject-wise Practice Tests');
  });

  it('uses the singular for a single test', () => {
    const points = includedFor(PLAN_COPY.free.monthly!, free, 'monthly').map(([t]) => t);
    expect(points[0]).toBe('1 Full-Length Mock Test');
    expect(points[1]).toBe('2 Subject-wise Practice Tests');
  });

  it('leaves out a count the server does not give, rather than inventing it', () => {
    const bare = { ...ultimate, limits_monthly: undefined, limits_yearly: undefined, features: { ...ultimate.features, mock_tests_per_month: undefined as unknown as number, practice_tests_per_month: undefined as unknown as number } };
    const points = includedFor(PLAN_COPY.ultimate.monthly!, bare as typeof ultimate, 'monthly').map(([t]) => t);
    expect(points.some(t => /Mock Test/.test(t))).toBe(false);
    expect(points.some(t => /Practice Test/.test(t))).toBe(false);
    expect(points).toContain('Detailed performance reports');
  });
});

describe('cardFor — the card’s words come from the backend', () => {
  const API_CARD = {
    headline: 'From the server',
    description: 'Written by the backend.',
    included: [{ title: '30 Full-Length Mock Tests', detail: 'From the server.' }],
    excluded: [],
    best_for: 'Served.',
    cta: 'Choose Annual Plan',
    badge: null,
  };

  it('uses the backend’s card for the cycle when it sends one', () => {
    const withCards = { ...ultimate, cards: { yearly: API_CARD } };
    expect(cardFor(withCards, 'yearly')?.headline).toBe('From the server');
    expect(cardFor(withCards, 'yearly')?.included[0].title).toBe('30 Full-Length Mock Tests');
  });

  it('falls back to the bundled wording, with the plan’s own counts, when the backend sends none', () => {
    const card = cardFor(ultimate, 'yearly');
    expect(card?.included[0].title).toBe('30 Full-Length Mock Tests');
    expect(card?.description).toMatch(/serious aspirants/);
  });

  it('has no card for a plan the bundled copy does not know', () => {
    expect(cardFor({ ...ultimate, tier: 'premium' as never }, 'monthly')).toBeNull();
  });
});

describe('validityFor — how long the plan lasts, from the plan', () => {
  it('reads the cycle’s own validity point', () => {
    expect(validityFor(ultimate, 'monthly')).toBe('Valid for 1 month');
    expect(validityFor(ultimate, 'yearly')).toBe('Valid for 12 months');
  });

  it('calls a plan with unlimited validity lifetime validity', () => {
    expect(validityFor(free, 'monthly')).toBe('Lifetime validity');
  });
});
