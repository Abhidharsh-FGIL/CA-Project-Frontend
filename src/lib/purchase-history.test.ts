import { describe, expect, it } from 'vitest';
import { describeValidity, formatPurchaseTime, type Purchase } from '@/lib/purchase-history';

const base: Purchase = {
  txn_id: 't', purchased_at: '2026-10-19T12:40:03.151670', invoice_no: 'INV-1', payment_id: 'pay_1', kind: 'plan',
  name: 'Ultimate', billing_cycle: 'monthly', base_amount: 499, discount_amount: 0, amount_paid: 499,
  promo_code: null, payment_method: 'upi', validity: null,
};

describe('formatPurchaseTime', () => {
  it('shows the server’s UTC time in IST', () => {
    expect(formatPurchaseTime('2026-10-19T12:40:03.151670')).toBe('19 Oct 2026, 6:10 PM');
    expect(formatPurchaseTime('2026-10-19T12:40:03Z')).toBe('19 Oct 2026, 6:10 PM');
  });
  it('is a dash for junk', () => {
    expect(formatPurchaseTime('junk')).toBe('—');
  });
});

describe('describeValidity', () => {
  it('gives a plan its dates and status', () => {
    const p = { ...base, validity: { valid_from: '2026-10-18', valid_until: '2026-11-17', status: 'active', mock_tests: null, mock_used: null, practice_tests: null, practice_used: null } };
    expect(describeValidity(p)).toEqual({ line: '18 Oct 2026 – 17 Nov 2026', detail: null, status: 'active' });
  });
  it('gives a top-up "Never expires" and its tests used', () => {
    const p = { ...base, kind: 'topup' as const, validity: { valid_from: null, valid_until: null, status: 'active', mock_tests: 10, mock_used: 0, practice_tests: 30, practice_used: 2 } };
    expect(describeValidity(p)).toEqual({ line: 'Never expires', detail: 'Practice 2/30 used · Mock 0/10 used', status: 'active' });
  });
  it('is a dash for an old record with no validity', () => {
    expect(describeValidity(base).line).toBe('—');
  });
});
