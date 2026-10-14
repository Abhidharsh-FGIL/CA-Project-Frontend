import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  restrictionLabel,
  toCreatePayload,
  toUpdatePayload,
  validatePromoDraft,
  type PromoDraft,
} from '@/lib/promo-payload';

const draft = (over: Partial<PromoDraft> = {}): PromoDraft => ({
  code_string: 'save99',
  scope: 'subscription',
  discount_pct: 99,
  max_uses: -1,
  expiry_date: null,
  test_id: null,
  applies_to_tiers: null,
  applies_to_billing: null,
  ...over,
});

afterEach(() => vi.useRealTimers());

describe('toCreatePayload', () => {
  it('builds the body the backend was shown working', () => {
    // The Postman call: code, scope, discount, unlimited uses — nothing else.
    expect(toCreatePayload(draft())).toEqual({
      code_string: 'SAVE99',
      scope: 'subscription',
      discount_pct: 99,
      max_uses: -1,
    });
  });

  it('sends the expiry as a date, not a timestamp', () => {
    expect(toCreatePayload(draft({ expiry_date: '2026-11-08' })).expiry_date).toBe('2026-11-08');
    expect(toCreatePayload(draft({ expiry_date: '2026-11-08T00:00:00.000Z' })).expiry_date).toBe('2026-11-08');
  });

  it('says unlimited outright rather than leaving it out', () => {
    expect(toCreatePayload(draft({ max_uses: -1 })).max_uses).toBe(-1);
    expect(toCreatePayload(draft({ max_uses: 0 })).max_uses).toBe(-1);
    expect(toCreatePayload(draft({ max_uses: 50 })).max_uses).toBe(50);
  });

  it('limits a subscription code to the plans and cycles picked', () => {
    const p = toCreatePayload(draft({ applies_to_tiers: ['standard', 'ultimate'], applies_to_billing: ['yearly'] }));
    expect(p.applies_to_tiers).toEqual(['standard', 'ultimate']);
    expect(p.applies_to_billing).toEqual(['yearly']);
  });

  it('leaves the limits out when none are picked — an empty list could read as "no plan"', () => {
    const p = toCreatePayload(draft({ applies_to_tiers: [], applies_to_billing: [] }));
    expect(p).not.toHaveProperty('applies_to_tiers');
    expect(p).not.toHaveProperty('applies_to_billing');
  });

  it('does not carry a test id onto a subscription code', () => {
    expect(toCreatePayload(draft({ test_id: 'old-test' }))).not.toHaveProperty('test_id');
  });

  it('does not carry plan limits onto a test code', () => {
    const p = toCreatePayload(draft({ scope: 'test', test_id: 't-1', applies_to_tiers: ['standard'] }));
    expect(p.test_id).toBe('t-1');
    expect(p).not.toHaveProperty('applies_to_tiers');
  });
});

describe('toUpdatePayload', () => {
  it('can take a limited code back to unlimited', () => {
    expect(toUpdatePayload(draft({ max_uses: -1 })).max_uses).toBe(-1);
  });

  it('states what is being cleared', () => {
    const p = toUpdatePayload(draft({ expiry_date: null, applies_to_tiers: [], test_id: 'stale' }));
    expect(p.expiry_date).toBeNull();
    expect(p.applies_to_tiers).toBeNull();
    expect(p.test_id).toBeNull();
  });

  it('keeps a test code test id', () => {
    expect(toUpdatePayload(draft({ scope: 'test', test_id: ' t-1 ' })).test_id).toBe('t-1');
  });
});

describe('validatePromoDraft', () => {
  it('accepts the code that was created in Postman', () => {
    expect(validatePromoDraft(draft(), true)).toBeNull();
  });

  it.each([
    ['too short', 'AB'],
    ['spaces', 'SAVE 99'],
    ['empty', '   '],
  ])('rejects a code that is %s', (_why, code) => {
    expect(validatePromoDraft(draft({ code_string: code }), true)).toBeTruthy();
  });

  it.each([0, 101, NaN])('rejects a discount of %s', pct => {
    expect(validatePromoDraft(draft({ discount_pct: pct }), true)).toBeTruthy();
  });

  it('accepts 100 — a fully free plan is a legitimate code', () => {
    expect(validatePromoDraft(draft({ discount_pct: 100 }), true)).toBeNull();
  });

  it('rejects a past expiry on a new code', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 9, 12));
    expect(validatePromoDraft(draft({ expiry_date: '2026-10-08' }), true)).toBeTruthy();
    expect(validatePromoDraft(draft({ expiry_date: '2026-10-09' }), true)).toBeNull();
  });

  it('does not block editing a code that has already expired', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 9, 12));
    expect(validatePromoDraft(draft({ expiry_date: '2026-01-01' }), false)).toBeNull();
  });
});

describe('restrictionLabel', () => {
  it('reads as unrestricted for a plain subscription code', () => {
    expect(restrictionLabel(draft())).toBe('All plans');
  });

  it('names the plans and the one cycle', () => {
    expect(
      restrictionLabel(draft({ applies_to_tiers: ['standard', 'ultimate'], applies_to_billing: ['yearly'] })),
    ).toBe('Standard, Ultimate · Yearly only');
  });

  it('does not call both cycles a limit', () => {
    expect(restrictionLabel(draft({ applies_to_billing: ['monthly', 'yearly'] }))).toBe('All plans');
  });

  it('has nothing to say for a test code', () => {
    expect(restrictionLabel(draft({ scope: 'test' }))).toBeNull();
  });
});
