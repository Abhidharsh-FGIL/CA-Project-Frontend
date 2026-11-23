import { describe, expect, it } from 'vitest';
import { cardFor } from '@/lib/plan-copy';
import { plansFromApi } from '@/lib/plans';
import {
  PLAN_STARTERS,
  cardFromForm,
  cardProblem,
  cardToForm,
  cardsToWire,
  emptyCardForm,
} from '@/lib/plan-editor';

describe('card form ⇄ wire', () => {
  it('an empty card is not sent', () => {
    expect(cardFromForm(emptyCardForm())).toBeNull();
    expect(cardsToWire(emptyCardForm(), emptyCardForm())).toBeNull();
  });

  it('a card of only blanks and spaces is still empty', () => {
    expect(cardFromForm({ ...emptyCardForm(), headline: '   ', included: [{ title: ' ', detail: '' }] })).toBeNull();
  });

  it('trims, turns blanks into null, drops points with no title, splits "not included" by line', () => {
    const wire = cardFromForm({
      headline: ' Start Small ',
      description: '',
      included: [
        { title: ' Progress Tracking ', detail: '' },
        { title: '', detail: 'orphan detail' },
      ],
      excluded: 'No PDF\n\n  No priority support ',
      best_for: 'Beginners',
      cta: '',
      badge: '',
    })!;
    expect(wire).toEqual({
      headline: 'Start Small',
      description: null,
      included: [{ title: 'Progress Tracking', detail: null }],
      excluded: ['No PDF', 'No priority support'],
      best_for: 'Beginners',
      cta: null,
      badge: null,
    });
  });

  it('round-trips a card the server sent', () => {
    const wire = { headline: 'H', description: 'D', included: [{ title: 'T', detail: 'x' }], excluded: ['no'], best_for: 'B', cta: 'Go', badge: 'Hot' };
    expect(cardFromForm(cardToForm(wire))).toEqual(wire);
  });

  it('only the cycle written is sent as a card', () => {
    const m = { ...emptyCardForm(), headline: 'Monthly' };
    expect(cardsToWire(m, emptyCardForm())).toEqual({
      monthly: expect.objectContaining({ headline: 'Monthly' }),
      yearly: null,
    });
  });
});

describe('cardProblem', () => {
  it('passes a normal card', () => {
    expect(cardProblem({ ...emptyCardForm(), headline: 'Fine' }, 'monthly')).toBeNull();
  });
  it('names the cycle and the field that is too long', () => {
    expect(cardProblem({ ...emptyCardForm(), cta: 'x'.repeat(41) }, 'yearly')).toMatch(/Yearly card: button text/);
  });
  it('limits the number of included points', () => {
    const included = Array.from({ length: 13 }, (_, i) => ({ title: `P${i}`, detail: '' }));
    expect(cardProblem({ ...emptyCardForm(), included }, 'monthly')).toMatch(/at most 12/);
  });
});

describe('the Essential starter', () => {
  const s = PLAN_STARTERS.essential!;
  it('carries the plan as specified: ₹149 monthly, 1 mock, 15 practice, no yearly price', () => {
    expect(s.price_monthly).toBe(149);
    expect(s.price_yearly).toBe(0);
    expect(s.mock).toBe(1);
    expect(s.practice).toBe(15);
  });
  it('writes counts as placeholders, never as typed numbers', () => {
    const titles = s.monthly.included.map(i => i.title).join(' ');
    expect(titles).toContain('{mock}');
    expect(titles).toContain('{practice}');
    expect(titles).not.toMatch(/\b15\b|\b1 Full/);
  });
});

describe('an admin-written card on the pricing page', () => {
  const api = plansFromApi([
    {
      plan_id: 'x1',
      name: 'essential',
      price: 149,
      features: { mock_tests_per_month: 1, practice_tests_per_month: 15, ai_report_level: 'standard', history_retention_days: 90, support: 'email', download_pdf: false },
      active: true,
      highlight: false,
      price_monthly: 149,
      price_yearly: 0,
      perks: ['x'],
      cards: {
        monthly: {
          headline: 'Start Small',
          description: 'd',
          included: [
            { title: '{mock} Full-Length Mock Test{mock_s}', detail: 'timed' },
            { title: '{practice} Subject-wise Practice Test{practice_s}', detail: 'subjects' },
            { title: 'Progress Tracking', detail: '' },
          ],
          best_for: 'Beginners',
          cta: 'Choose Essential',
        },
      },
    },
  ])[0];

  it('fills the counts from the plan, singular and plural', () => {
    const card = cardFor(api, 'monthly')!;
    expect(card.included.map(i => i.title)).toEqual(['1 Full-Length Mock Test', '15 Subject-wise Practice Tests', 'Progress Tracking']);
  });

  it('a yearly request on a plan with no yearly price still shows the monthly card', () => {
    expect(cardFor(api, 'yearly')!.headline).toBe('Start Small');
  });

  it('follows the plan when its limit changes', () => {
    const more = { ...api, features: { ...api.features, mock_tests_per_month: 3 } };
    expect(cardFor(more, 'monthly')!.included[0].title).toBe('3 Full-Length Mock Tests');
  });
});
