/**
 * Buying a top-up pack, start to finish. The same steps as buying a plan (see `purchase.ts`), with the
 * top-up endpoints:
 *
 *   1. ask the server for an order for the pack   (it decides the price)
 *   2. if it is already activated (a 100%-off code), done — the pack is added and no payment is taken
 *   3. open Razorpay with that order
 *   4. send the three Razorpay fields to verify, which answers with the new balance
 *
 * A verify failure after money has moved is "unconfirmed", never "failed": telling someone the payment
 * failed invites a second payment.
 */
import { CheckoutDismissed, PaymentFailed, type CheckoutOptions, type RazorpaySuccess } from '@/lib/razorpay';
import { balanceFrom, type TopUpBalance, type TopUpOrder, type TopUpVerifyRequest } from '@/lib/topup-api';
import { SUPPORT_CONTACT } from '@/config/support';

export type TopUpOutcome =
  | { kind: 'paid'; balance: TopUpBalance; order: TopUpOrder }
  | { kind: 'cancelled' }
  | { kind: 'failed'; message: string }
  | { kind: 'unconfirmed'; message: string; paymentId: string };

export interface TopUpDeps {
  createOrder(packId: string, promoCode?: string | null): Promise<TopUpOrder>;
  verifyPayment(req: TopUpVerifyRequest): Promise<TopUpBalance>;
  openCheckout(options: CheckoutOptions): Promise<RazorpaySuccess>;
}

export interface TopUpRequest {
  packId: string;
  packName: string;
  /** Optional promo code; the server applies it when it makes the order. */
  promoCode?: string | null;
  customer?: { name: string; email: string; contact?: string | null };
  brand?: string;
}

const message = (e: unknown, fallback: string) => (e instanceof Error && e.message ? e.message : fallback);

/** The options Razorpay opens with — built from the server's order, so `amount` is never recomputed here. */
export function buildTopUpCheckoutOptions(order: TopUpOrder, req: Pick<TopUpRequest, 'packName' | 'customer' | 'brand'>): CheckoutOptions {
  const prefill = order.prefill ?? req.customer;
  return {
    key: order.key_id as string,
    amount: order.amount as number,
    currency: order.currency || 'INR',
    order_id: order.order_id as string,
    name: req.brand ?? 'MyGovExams',
    description: `${order.pack_name ?? req.packName} · top-up`,
    prefill: prefill ? { name: prefill.name, email: prefill.email, contact: prefill.contact ?? undefined } : undefined,
    theme: { color: '#f05418' },
  };
}

export async function purchaseTopUp(req: TopUpRequest, deps: TopUpDeps): Promise<TopUpOutcome> {
  // 1. The order. A failure here means nothing was charged.
  let order: TopUpOrder;
  try {
    order = await deps.createOrder(req.packId, req.promoCode);
  } catch (e) {
    return { kind: 'failed', message: message(e, 'Could not start the purchase.') };
  }

  // Nothing owed and already added: do not open Razorpay. The balance is the one in the order.
  if (order.activated) {
    return { kind: 'paid', balance: balanceFrom(order.balance), order };
  }

  // A server with no gateway answers with an empty key or order; say so rather than opening a broken window.
  if (!order.key_id || !order.order_id || !order.amount || order.amount <= 0) {
    return { kind: 'failed', message: 'Online payments are not set up on the server yet. Nothing was charged.' };
  }

  // 2. Razorpay.
  let paid: RazorpaySuccess;
  try {
    paid = await deps.openCheckout(buildTopUpCheckoutOptions(order, req));
  } catch (e) {
    if (e instanceof CheckoutDismissed) return { kind: 'cancelled' };
    if (e instanceof PaymentFailed) return { kind: 'failed', message: `${e.message} You have not been charged.` };
    return { kind: 'failed', message: message(e, 'The payment window could not be opened.') };
  }

  // 3. Verify. From here money has moved.
  try {
    const balance = await deps.verifyPayment({
      razorpay_order_id: paid.razorpay_order_id,
      razorpay_payment_id: paid.razorpay_payment_id,
      razorpay_signature: paid.razorpay_signature,
    });
    return { kind: 'paid', balance, order };
  } catch (e) {
    return {
      kind: 'unconfirmed',
      paymentId: paid.razorpay_payment_id,
      message:
        'Your payment went through, but the tests are not confirmed yet. Please do not pay again — they will be added shortly. ' +
        'If they are not, contact support (' + SUPPORT_CONTACT + ') with your payment ID. ' +
        message(e, ''),
    };
  }
}
