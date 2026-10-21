/**
 * Buying a plan, start to finish.
 *
 *   1. ask the server for an order            (it decides the price, promo included)
 *   2. if nothing is owed it has already activated — done
 *   3. otherwise open Razorpay with *that* order
 *   4. send what Razorpay returns to the server to verify and activate
 *
 * Returns an outcome rather than throwing for anything that is an ordinary way for
 * a purchase to end, because each calls for a different message and only one of
 * them is an error. Dependencies are passed in so every branch can be tested
 * without a browser or a network.
 */
import { SUPPORT_CONTACT } from '@/config/support';
import {
  CheckoutDismissed,
  PaymentFailed,
  type CheckoutOptions,
  type RazorpaySuccess,
} from '@/lib/razorpay';
import type {
  BillingCycle,
  CreateOrderRequest,
  CreateOrderResponse,
  CurrentSubscription,
  PaymentResult,
  VerifyPaymentRequest,
} from '@/lib/subscriptionApi';

export type PurchaseOutcome =
  /** Paid and verified. */
  | { kind: 'paid'; order: CreateOrderResponse; result: PaymentResult }
  /** Nothing was owed, so the server activated it without a payment. */
  | { kind: 'free'; order: CreateOrderResponse }
  /** The customer closed the window. Say nothing alarming. */
  | { kind: 'cancelled' }
  /** Nothing was charged, or the failure is certain. */
  | { kind: 'failed'; message: string }
  /**
   * Money may have been taken but we could not confirm the plan is active.
   *
   * The dangerous one: telling this customer "payment failed" invites them to pay a
   * second time. It carries the payment id so they can quote it to support.
   */
  | { kind: 'unconfirmed'; message: string; paymentId: string; order: CreateOrderResponse };

export interface PurchaseDeps {
  createOrder(req: CreateOrderRequest): Promise<CreateOrderResponse>;
  verifyPayment(req: VerifyPaymentRequest): Promise<PaymentResult>;
  openCheckout(options: CheckoutOptions): Promise<RazorpaySuccess>;
  getCurrentSubscription(): Promise<CurrentSubscription | null>;
  /** Injected so tests do not wait. */
  sleep?(ms: number): Promise<void>;
}

export interface PurchaseRequest {
  planId: string;
  planLabel: string;
  billing: BillingCycle;
  promoCode?: string | null;
  /** The signed-in user, used only to fill Razorpay's form if the server sends no prefill. */
  customer?: { name: string; email: string; contact?: string | null };
  brand?: string;
}

/** How long to wait, and how often, for a verification we could not complete. */
const CONFIRM_ATTEMPTS = 3;
const CONFIRM_DELAY_MS = 2000;

const message = (e: unknown, fallback: string) =>
  e instanceof Error && e.message ? e.message : fallback;

/**
 * The options Razorpay is opened with — built from the *server's* order.
 *
 * Exported because this is where a wrong figure would charge the wrong amount:
 * `amount` is the server's, in paise, never recomputed from a price shown on screen.
 */
export function buildCheckoutOptions(
  order: CreateOrderResponse,
  req: Pick<PurchaseRequest, 'planLabel' | 'billing' | 'customer' | 'brand'>,
): CheckoutOptions {
  const prefill = order.prefill ?? req.customer;
  return {
    key: order.key_id as string,
    amount: order.amount as number,
    currency: order.currency || 'INR',
    order_id: order.order_id as string,
    name: req.brand ?? 'MyGovExams',
    description: `${req.planLabel} · ${req.billing === 'yearly' ? '1 year' : '1 month'}`,
    prefill: prefill
      ? {
          name: prefill.name,
          email: prefill.email,
          contact: prefill.contact ?? undefined,
        }
      : undefined,
    theme: { color: '#f05418' },
  };
}

export async function purchasePlan(req: PurchaseRequest, deps: PurchaseDeps): Promise<PurchaseOutcome> {
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>(r => setTimeout(r, ms)));

  // 1. The order. Failure here means nothing was charged.
  let order: CreateOrderResponse;
  try {
    order = await deps.createOrder({
      plan_id: req.planId,
      billing_cycle: req.billing,
      promo_code: req.promoCode || null,
    });
  } catch (e) {
    return { kind: 'failed', message: message(e, 'Could not start the payment.') };
  }

  // 2. Nothing owed — the server has already activated it.
  if (order.activated) return { kind: 'free', order };

  // A server with no gateway configured answers 200 with an empty key and order.
  // Opening checkout with those would show an error inside Razorpay's own window,
  // which reads as a fault in the payment rather than in the setup.
  if (!order.key_id || !order.order_id || !order.amount || order.amount <= 0) {
    return {
      kind: 'failed',
      message: 'Online payments are not set up on the server yet. Nothing was charged.',
    };
  }

  // 3. Razorpay.
  let paid: RazorpaySuccess;
  try {
    paid = await deps.openCheckout(buildCheckoutOptions(order, req));
  } catch (e) {
    if (e instanceof CheckoutDismissed) return { kind: 'cancelled' };
    if (e instanceof PaymentFailed) {
      return { kind: 'failed', message: `${e.message} You have not been charged.` };
    }
    return { kind: 'failed', message: message(e, 'The payment window could not be opened.') };
  }

  // 4. Verify. From here money has moved, so a failure is not "payment failed".
  try {
    const result = await deps.verifyPayment({
      razorpay_order_id: paid.razorpay_order_id,
      razorpay_payment_id: paid.razorpay_payment_id,
      razorpay_signature: paid.razorpay_signature,
    });
    return { kind: 'paid', order, result };
  } catch (verifyError) {
    // The webhook (`order.paid`) activates the plan independently, so the
    // subscription may already exist. Look before telling anyone anything.
    for (let i = 0; i < CONFIRM_ATTEMPTS; i++) {
      await sleep(CONFIRM_DELAY_MS);
      try {
        const sub = await deps.getCurrentSubscription();
        const ours =
          sub?.status === 'active' &&
          (sub.payment_ref === paid.razorpay_payment_id || sub.payment_ref === paid.razorpay_order_id);
        if (ours && sub) {
          return {
            kind: 'paid',
            order,
            result: {
              status: 'already_processed',
              plan_name: order.plan_name,
              start_date: sub.start_date,
              end_date: sub.end_date,
            },
          };
        }
      } catch {
        // Keep trying; the last attempt falls through to "unconfirmed".
      }
    }

    return {
      kind: 'unconfirmed',
      paymentId: paid.razorpay_payment_id,
      order,
      message:
        'Your payment went through, but we could not confirm your plan yet. Please do not pay again — ' +
        'it will activate shortly, and if it does not, contact support (' + SUPPORT_CONTACT + ') with your payment ID. ' +
        message(verifyError, ''),
    };
  }
}
