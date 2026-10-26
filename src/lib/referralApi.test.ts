import { describe, expect, it } from 'vitest';
import {
  entryStatusLine,
  estimateRewards,
  nextPayoutDate,
  nextWithdrawalWindow,
  withdrawalMail,
  withdrawalWindowOpen,
  withdrawalFrom,
  withdrawalProblem,
  refFromSearch,
  rupees,
  signedRupees,
  walletTypeLabel,
  whatsappShareUrl,
} from '@/lib/referralApi';

describe('money on screen', () => {
  it('shows whole rupees without decimals and part rupees with two', () => {
    expect(rupees(84.7)).toBe('₹84.70');
    expect(rupees(250)).toBe('₹250');
    expect(rupees(1250)).toBe('₹1,250');
  });

  it('signs the ledger amount: plus for money in, minus for money out', () => {
    expect(signedRupees(21.14)).toBe('+₹21.14');
    expect(signedRupees(-50)).toBe('−₹50');
  });
});

describe('the ledger', () => {
  it('names every type the server sends, and falls back to the type itself', () => {
    expect(walletTypeLabel('referral_reward')).toBe('Referral reward');
    expect(walletTypeLabel('purchase')).toBe('Used for purchase');
    expect(walletTypeLabel('withdrawal_reversal')).toBe('Withdrawal rejected, amount returned');
    expect(walletTypeLabel('some_new_type')).toBe('some new type');
  });

  it('says when a pending reward becomes money', () => {
    const line = entryStatusLine({ status: 'pending', available_at: '2026-11-10T00:00:00Z', created_at: '2026-10-26T00:00:00Z' });
    expect(line).toMatch(/^Available on /);
    expect(line).toMatch(/2026/);
  });

  it('shows the date it happened for money already available', () => {
    const line = entryStatusLine({ status: 'available', available_at: null, created_at: '2026-10-26T10:00:00Z' });
    expect(line).not.toMatch(/Available on/);
    expect(line).toMatch(/2026/);
  });
});

describe('the sign-up link', () => {
  it('reads the code from ?ref= and upper-cases a code', () => {
    expect(refFromSearch('?ref=mge-a7k92')).toBe('MGE-A7K92');
    expect(refFromSearch('?x=1&ref=MGE-A7K92')).toBe('MGE-A7K92');
  });

  it('keeps a mobile number or email as it was written, and returns null when there is none', () => {
    expect(refFromSearch('?ref=9876543210')).toBe('9876543210');
    expect(refFromSearch('')).toBeNull();
    expect(refFromSearch('?ref=%20')).toBeNull();
  });

  it('builds a WhatsApp link with the message encoded', () => {
    expect(whatsappShareUrl('Join me: https://x.in/#/signup?ref=A B')).toBe(
      'https://wa.me/?text=Join%20me%3A%20https%3A%2F%2Fx.in%2F%23%2Fsignup%3Fref%3DA%20B',
    );
  });
});

describe('withdrawals', () => {
  const upi = { amount: '250', method: 'upi' as const, upiId: 'name@okaxis', accountNumber: '', ifsc: '', accountName: '' };
  const bank = { amount: '250', method: 'bank' as const, upiId: '', accountNumber: '123456789012', ifsc: 'SBIN0001234', accountName: 'Reeba S' };

  it('accepts a good UPI or bank request', () => {
    expect(withdrawalProblem(upi, 1250, 200)).toBeNull();
    expect(withdrawalProblem(bank, 1250, 200)).toBeNull();
  });

  it('stops an amount that is missing, under the minimum, or over the balance', () => {
    expect(withdrawalProblem({ ...upi, amount: '' }, 1250, 200)).toMatch(/Enter the amount/);
    expect(withdrawalProblem({ ...upi, amount: '150' }, 1250, 200)).toMatch(/minimum withdrawal is ₹200/);
    expect(withdrawalProblem({ ...upi, amount: '2000' }, 1250, 200)).toMatch(/up to ₹1,250/);
  });

  it('stops a bad UPI id, account number, IFSC or name', () => {
    expect(withdrawalProblem({ ...upi, upiId: 'nope' }, 1250, 200)).toMatch(/UPI/);
    expect(withdrawalProblem({ ...bank, accountNumber: '12' }, 1250, 200)).toMatch(/account number/);
    expect(withdrawalProblem({ ...bank, ifsc: 'SBIN1234567' }, 1250, 200)).toMatch(/IFSC/);
    expect(withdrawalProblem({ ...bank, accountName: '' }, 1250, 200)).toMatch(/name/);
  });

  it('reads a request whichever names the server uses, and shows a masked account as it came', () => {
    const w = withdrawalFrom({ withdrawal_id: 'w1', amount: 250, method: 'bank', status: 'paid', account_number: 'XXXX9012', payout_reference: 'UTR1', created_at: '2026-10-01T00:00:00Z' });
    expect(w).toMatchObject({ id: 'w1', amount: 250, status: 'paid', destination: 'XXXX9012', payout_reference: 'UTR1' });
    expect(withdrawalFrom({})).toMatchObject({ id: '', amount: 0, status: 'requested', destination: null });
  });

  it('puts the next payout on the 1st of next month', () => {
    expect(nextPayoutDate(new Date(2026, 9, 26))).toEqual(new Date(2026, 10, 1));
    expect(nextPayoutDate(new Date(2026, 11, 31))).toEqual(new Date(2027, 0, 1));
  });
});

describe('the earnings estimate', () => {
  it('matches the worked examples: 5% of the price without GST', () => {
    expect(estimateRewards({ monthly: 1, annual: 0 }, { monthly: 499, annual: 1999 }, 5)).toBe(21.14);
    expect(estimateRewards({ monthly: 0, annual: 1 }, { monthly: 499, annual: 1999 }, 5)).toBe(84.7);
    expect(estimateRewards({ monthly: 20, annual: 5 }, { monthly: 499, annual: 1999 }, 5)).toBe(846.4);
  });
});

describe('the withdrawal window', () => {
  it('is open from the 1st to the 7th, and only then', () => {
    expect(withdrawalWindowOpen(new Date(2026, 10, 1))).toBe(true);
    expect(withdrawalWindowOpen(new Date(2026, 10, 7, 23, 59))).toBe(true);
    expect(withdrawalWindowOpen(new Date(2026, 10, 8))).toBe(false);
    expect(withdrawalWindowOpen(new Date(2026, 9, 26))).toBe(false);
  });
  it('says when it next opens', () => {
    expect(nextWithdrawalWindow(new Date(2026, 9, 26))).toEqual(new Date(2026, 10, 1));
    expect(nextWithdrawalWindow(new Date(2026, 10, 3))).toEqual(new Date(2026, 10, 1));
  });
  it('writes the request to support with who, how much and where to pay', () => {
    const m = withdrawalMail({ name: 'Asha', email: 'a@x.in', referralCode: 'MGE-1', amount: 300, available: 450, method: 'upi', upiId: 'asha@okaxis' });
    expect(m.subject).toBe('Withdrawal request – Asha (MGE-1)');
    expect(m.body).toContain('Email: a@x.in');
    expect(m.body).toContain('UPI ID: asha@okaxis');
    expect(m.body.split('\n').length).toBeGreaterThan(5);
  });
});
