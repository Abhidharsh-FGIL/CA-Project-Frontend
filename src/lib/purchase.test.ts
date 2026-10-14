/**
 * Every way buying a plan can end, and what the customer is told.
 *
 * The cases that matter most are the ones where money may have moved but the
 * plan did not activate: telling that customer "payment failed" invites them to
 * pay twice.
 */
import { describe, expect, it, vi } from 'vitest';
import { buildCheckoutOptions, purchasePlan, type PurchaseDeps } from '@/lib/purchase';
import { CheckoutDismissed, PaymentFailed } from '@/lib/razorpay';
import type { CreateOrderResponse, PaymentResult } from '@/lib/subscriptionApi';

const ORDER: CreateOrderResponse = {
  activated: false,
  key_id: 'rzp_test_abc',
  order_id: 'order_123',
  amount: 19900, // paise
  currency: 'INR',
  base_amount: 199,
  discount_amount: 0,
  final_amount: 199,
  plan_name: 'standard',
  billing_cycle: 'monthly',
  duration_days: 30,
  prefill: { name: 'Aravindh', email: 'a@x.com', contact: '9345166639' },
};

const PAID = {
  razorpay_order_id: 'order_123',
  razorpay_payment_id: 'pay_456',
  razorpay_signature: 'sig_789',
};

const RESULT: PaymentResult = {
  status: 'activated',
  txn_id: 't1',
  invoice_no: 'INV-1',
  plan_name: 'standard',
  start_date: '2026-10-09',
  end_date: '2026-11-08',
};

const REQ = { planId: 'plan-uuid', planLabel: 'Standard', billing: 'monthly' as const };

function deps(over: Partial<PurchaseDeps> = {}): PurchaseDeps {
  return {
    createOrder: vi.fn().mockResolvedValue(ORDER),
    verifyPayment: vi.fn().mockResolvedValue(RESULT),
    openCheckout: vi.fn().mockResolvedValue(PAID),
    getCurrentSubscription: vi.fn().mockResolvedValue(null),
    sleep: () => Promise.resolve(),
    ...over,
  };
}

describe('the happy path', () => {
  it('orders, takes payment with that order, verifies, and reports paid', async () => {
    const d = deps();
    const out = await purchasePlan({ ...REQ, promoCode: 'WELCOME26' }, d);

    expect(out.kind).toBe('paid');
    expect(d.createOrder).toHaveBeenCalledWith({
      plan_id: 'plan-uuid',
      billing_cycle: 'monthly',
      promo_code: 'WELCOME26',
    });
    // Razorpay is opened with the server's order, and the signature goes back untouched.
    expect((d.openCheckout as any).mock.calls[0][0].order_id).toBe('order_123');
    expect(d.verifyPayment).toHaveBeenCalledWith(PAID);
  });

  it('treats an already-processed result as paid — the webhook simply got there first', async () => {
    const d = deps({ verifyPayment: vi.fn().mockResolvedValue({ ...RESULT, status: 'already_processed' }) });
    expect((await purchasePlan(REQ, d)).kind).toBe('paid');
  });

  it('sends no promo when none was entered', async () => {
    const d = deps();
    await purchasePlan(REQ, d);
    expect((d.createOrder as any).mock.calls[0][0].promo_code).toBeNull();
  });
});

describe('the amount charged is the server’s', () => {
  it('uses the order’s paise, never a price recomputed on screen', () => {
    const o = buildCheckoutOptions({ ...ORDER, amount: 9950, final_amount: 99.5 }, REQ);
    expect(o.amount).toBe(9950);
    expect(o.key).toBe('rzp_test_abc');
    expect(o.currency).toBe('INR');
  });

  it('prefers the server’s prefill, and falls back to the signed-in user', () => {
    expect(buildCheckoutOptions(ORDER, REQ).prefill?.email).toBe('a@x.com');
    const noPrefill = buildCheckoutOptions({ ...ORDER, prefill: null }, {
      ...REQ,
      customer: { name: 'Fallback', email: 'f@x.com' },
    });
    expect(noPrefill.prefill?.email).toBe('f@x.com');
  });

  it('describes the billing period in words', () => {
    expect(buildCheckoutOptions(ORDER, REQ).description).toBe('Standard · 1 month');
    expect(buildCheckoutOptions(ORDER, { ...REQ, billing: 'yearly' }).description).toBe('Standard · 1 year');
  });
});

describe('nothing owed', () => {
  it('does not open checkout when the server has already activated the plan', async () => {
    // A free plan or a 100% promo: there is no payment to take or verify.
    const d = deps({ createOrder: vi.fn().mockResolvedValue({ ...ORDER, activated: true, amount: 0 }) });
    const out = await purchasePlan(REQ, d);
    expect(out.kind).toBe('free');
    expect(d.openCheckout).not.toHaveBeenCalled();
    expect(d.verifyPayment).not.toHaveBeenCalled();
  });
});

describe('failing before any money moves', () => {
  it('reports an order the server refuses, with its own reason', async () => {
    const d = deps({ createOrder: vi.fn().mockRejectedValue(new Error('Promo code has expired')) });
    const out = await purchasePlan(REQ, d);
    expect(out).toEqual({ kind: 'failed', message: 'Promo code has expired' });
    expect(d.openCheckout).not.toHaveBeenCalled();
  });

  it('refuses to open checkout when the server has no gateway configured', async () => {
    // The backend answers 200 with an empty key and order id when Razorpay is not
    // set up. Opening checkout with those would blame the payment for a setup fault.
    for (const bad of [{ key_id: '' }, { order_id: '' }, { amount: 0 }]) {
      const d = deps({ createOrder: vi.fn().mockResolvedValue({ ...ORDER, ...bad }) });
      const out = await purchasePlan(REQ, d);
      expect(out.kind).toBe('failed');
      expect((out as any).message).toMatch(/not set up/i);
      expect((out as any).message).toMatch(/nothing was charged/i);
      expect(d.openCheckout).not.toHaveBeenCalled();
    }
  });
});

describe('the customer’s side of the window', () => {
  it('treats closing the window as cancelled, not as a failure', async () => {
    const d = deps({ openCheckout: vi.fn().mockRejectedValue(new CheckoutDismissed()) });
    expect(await purchasePlan(REQ, d)).toEqual({ kind: 'cancelled' });
    expect(d.verifyPayment).not.toHaveBeenCalled();
  });

  it('reports a failed payment, and says they were not charged', async () => {
    const d = deps({ openCheckout: vi.fn().mockRejectedValue(new PaymentFailed('Card declined')) });
    const out = await purchasePlan(REQ, d);
    expect(out.kind).toBe('failed');
    expect((out as any).message).toContain('Card declined');
    expect((out as any).message).toContain('not been charged');
  });

  it('reports a checkout that could not load', async () => {
    const d = deps({ openCheckout: vi.fn().mockRejectedValue(new Error('script blocked')) });
    expect(((await purchasePlan(REQ, d)) as any).message).toBe('script blocked');
  });
});

describe('paid, but verification could not be completed', () => {
  const verifyDown = () => vi.fn().mockRejectedValue(new Error('network down'));

  it('recovers when the webhook already activated the plan', async () => {
    const d = deps({
      verifyPayment: verifyDown(),
      getCurrentSubscription: vi.fn().mockResolvedValue({
        sub_id: 's',
        plan_id: 'plan-uuid',
        start_date: '2026-10-09',
        end_date: '2026-11-08',
        payment_ref: 'pay_456',
        status: 'active',
      }),
    });
    const out = await purchasePlan(REQ, d);
    expect(out.kind).toBe('paid');
    expect((out as any).result.status).toBe('already_processed');
  });

  it('matches the subscription by order id as well as payment id', async () => {
    const d = deps({
      verifyPayment: verifyDown(),
      getCurrentSubscription: vi.fn().mockResolvedValue({
        sub_id: 's', plan_id: 'p', start_date: 'a', end_date: 'b', payment_ref: 'order_123', status: 'active',
      }),
    });
    expect((await purchasePlan(REQ, d)).kind).toBe('paid');
  });

  it('does not mistake an unrelated active subscription for this payment', async () => {
    // A renewal: the user already has an active plan from an earlier payment.
    const d = deps({
      verifyPayment: verifyDown(),
      getCurrentSubscription: vi.fn().mockResolvedValue({
        sub_id: 's', plan_id: 'plan-uuid', start_date: 'a', end_date: 'b', payment_ref: 'pay_OLD', status: 'active',
      }),
    });
    expect((await purchasePlan(REQ, d)).kind).toBe('unconfirmed');
  });

  it('never says "payment failed" — it says not to pay again, and gives the payment id', async () => {
    const out = await purchasePlan(REQ, deps({ verifyPayment: verifyDown() }));
    expect(out.kind).toBe('unconfirmed');
    if (out.kind !== 'unconfirmed') throw new Error('unreachable');
    expect(out.paymentId).toBe('pay_456');
    expect(out.message).toMatch(/do not pay again/i);
    expect(out.message).not.toMatch(/payment failed/i);
  });

  it('keeps looking before giving up, and survives the lookup failing too', async () => {
    const lookup = vi.fn().mockRejectedValue(new Error('still down'));
    const out = await purchasePlan(REQ, deps({ verifyPayment: verifyDown(), getCurrentSubscription: lookup }));
    expect(out.kind).toBe('unconfirmed');
    expect(lookup).toHaveBeenCalledTimes(3);
  });

  it('finds the subscription on a later attempt', async () => {
    const lookup = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        sub_id: 's', plan_id: 'p', start_date: 'a', end_date: 'b', payment_ref: 'pay_456', status: 'active',
      });
    const out = await purchasePlan(REQ, deps({ verifyPayment: verifyDown(), getCurrentSubscription: lookup }));
    expect(out.kind).toBe('paid');
    expect(lookup).toHaveBeenCalledTimes(2);
  });

  it('ignores a subscription that is not active', async () => {
    const d = deps({
      verifyPayment: verifyDown(),
      getCurrentSubscription: vi.fn().mockResolvedValue({
        sub_id: 's', plan_id: 'p', start_date: 'a', end_date: 'b', payment_ref: 'pay_456', status: 'expired',
      }),
    });
    expect((await purchasePlan(REQ, d)).kind).toBe('unconfirmed');
  });
});
