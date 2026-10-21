import { describe, expect, it, vi } from 'vitest';
import { CheckoutDismissed, PaymentFailed } from '@/lib/razorpay';
import { packFrom, topUpPacksFrom, balanceFrom } from '@/lib/topup-api';
import { buildTopUpCheckoutOptions, purchaseTopUp, type TopUpDeps } from '@/lib/topup-purchase';

const ORDER = { key_id: 'rzp_test', order_id: 'order_1', amount: 44900, currency: 'INR', pack_name: 'Combo Top-Up Plus' };
const PAID = { razorpay_order_id: 'order_1', razorpay_payment_id: 'pay_1', razorpay_signature: 'sig' };
const req = { packId: 'pack-1', packName: 'Combo Top-Up Plus' };

const deps = (over: Partial<TopUpDeps> = {}): TopUpDeps => ({
  createOrder: vi.fn(async () => ORDER),
  openCheckout: vi.fn(async () => PAID),
  verifyPayment: vi.fn(async () => ({ mock: 13, practice: 42 })),
  ...over,
});

describe('purchaseTopUp', () => {
  it('orders the pack, takes payment, verifies, and reports the new balance', async () => {
    const d = deps();
    const out = await purchaseTopUp(req, d);
    expect(d.createOrder).toHaveBeenCalledWith('pack-1');
    expect(d.verifyPayment).toHaveBeenCalledWith(PAID);
    expect(out).toMatchObject({ kind: 'paid', balance: { mock: 13, practice: 42 } });
  });

  it('opens Razorpay with the server’s amount, never a figure of its own', async () => {
    const d = deps();
    await purchaseTopUp(req, d);
    const opts = (d.openCheckout as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(opts.amount).toBe(44900);
    expect(opts.order_id).toBe('order_1');
  });

  it('says nothing was charged when the order cannot be made', async () => {
    const out = await purchaseTopUp(req, deps({ createOrder: vi.fn(async () => { throw new Error('Plan required'); }) }));
    expect(out).toEqual({ kind: 'failed', message: 'Plan required' });
  });

  it('says so when the server has no gateway set up, instead of opening a broken window', async () => {
    const d = deps({ createOrder: vi.fn(async () => ({ ...ORDER, key_id: '' })) });
    const out = await purchaseTopUp(req, d);
    expect(out.kind).toBe('failed');
    expect(d.openCheckout).not.toHaveBeenCalled();
  });

  it('treats closing the window as cancelled, not as an error', async () => {
    expect(await purchaseTopUp(req, deps({ openCheckout: vi.fn(async () => { throw new CheckoutDismissed(); }) }))).toEqual({ kind: 'cancelled' });
  });

  it('reports a declined payment as failed, and says no money moved', async () => {
    const out = await purchaseTopUp(req, deps({ openCheckout: vi.fn(async () => { throw new PaymentFailed('Card declined.'); }) }));
    expect(out).toMatchObject({ kind: 'failed' });
    expect((out as { message: string }).message).toMatch(/not been charged/);
  });

  it('never says a paid pack failed to verify — it is unconfirmed, with the payment id to quote', async () => {
    const out = await purchaseTopUp(req, deps({ verifyPayment: vi.fn(async () => { throw new Error('timeout'); }) }));
    expect(out).toMatchObject({ kind: 'unconfirmed', paymentId: 'pay_1' });
    expect((out as { message: string }).message).toMatch(/do not pay again/i);
  });

  it('builds the checkout from the order, with the brand and the customer', () => {
    const opts = buildTopUpCheckoutOptions(ORDER, { packName: 'x', customer: { name: 'A', email: 'a@b.co' } });
    expect(opts.description).toBe('Combo Top-Up Plus · top-up');
    expect(opts.prefill).toEqual({ name: 'A', email: 'a@b.co', contact: undefined });
  });
});

describe('the packs the server sends', () => {
  it('reads a pack under the names it uses, and drops one with no id', () => {
    expect(packFrom({ pack_id: 'p', name: 'Mock', mock_tests: 3, price_inr: 99 })).toMatchObject({ mock: 3, practice: 0, price: 99 });
    expect(packFrom({ name: 'no id' })).toBeNull();
  });

  it('keeps the packs, the balance and the purchase state, and tolerates a missing part', () => {
    const r = topUpPacksFrom({
      packs: [{ pack_id: 'a', name: 'Mock', mock: 3, practice: 0, price: 99 }, { bad: true }],
      balance: { mock: 2, practice: 5 },
      can_purchase: false,
      reason: 'Active Ultimate plan required.',
    });
    expect(r.packs).toHaveLength(1);
    expect(r.balance).toEqual({ mock: 2, practice: 5 });
    expect(r.can_purchase).toBe(false);
    expect(r.reason).toBe('Active Ultimate plan required.');
    expect(topUpPacksFrom(undefined)).toMatchObject({ packs: [], can_purchase: false, balance: { mock: 0, practice: 0 } });
  });

  it('reads the balance bare or inside `balance`', () => {
    expect(balanceFrom({ mock: 4, practice: 1 })).toEqual({ mock: 4, practice: 1 });
    expect(balanceFrom({ balance: { mock: 4, practice: 1 } })).toEqual({ mock: 4, practice: 1 });
  });
});
