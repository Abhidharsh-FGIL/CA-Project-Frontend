/**
 * Subscription purchase API — the backend half of the Razorpay flow.
 *
 *   POST /api/v1/user/payment/order      → create a Razorpay order (or activate, if nothing is owed)
 *   POST /api/v1/user/payment/verify     → check the signature Razorpay returned, activate the plan
 *   POST /api/v1/user/promo/validate     → is this code real, and what percentage does it take off
 *   GET  /api/v1/user/subscription/current
 *
 * Contracts read from the backend's OpenAPI document, not assumed. The amount the
 * customer pays is always the *server's* (`amount`, in paise): this client never
 * computes a price it then charges, only one it shows as a preview.
 */
import { userApi } from './api';

export type BillingCycle = 'monthly' | 'yearly';

export interface CreateOrderRequest {
  plan_id: string;
  billing_cycle?: BillingCycle | null;
  promo_code?: string | null;
}

/** Who the customer is, so Razorpay's form opens already filled in. */
export interface CheckoutPrefill {
  name: string;
  email: string;
  contact?: string | null;
}

export interface CreateOrderResponse {
  /**
   * True when nothing was owed — a free plan, or a 100% promo — and the server has
   * already activated the subscription. There is no payment to take or verify.
   */
  activated?: boolean;
  /** Razorpay key *id*. Public by design; empty when the server has no gateway configured. */
  key_id?: string;
  order_id?: string;
  /** Paise. What Razorpay charges. */
  amount?: number;
  currency?: string;
  base_amount?: number;
  discount_amount?: number;
  /** What GST is charged on: the price less any discount. */
  taxable_amount?: number;
  gst_percent?: number;
  gst_amount?: number;
  /** Rupees, GST included — the same sum as `amount`, which is in paise. */
  final_amount?: number;
  plan_name: string;
  billing_cycle?: string | null;
  duration_days: number;
  prefill?: CheckoutPrefill | null;
}

export interface VerifyPaymentRequest {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

export interface PaymentResult {
  /** `already_processed` means the webhook got there first — the plan is active either way. */
  status: 'activated' | 'already_processed';
  txn_id?: string | null;
  invoice_no?: string | null;
  plan_name: string;
  start_date: string;
  end_date: string;
}

export interface PromoValidation {
  valid: boolean;
  message: string;
  code_id?: string | null;
  discount_pct: number;
  /**
   * The price with the code applied, as the server works it out — the figures the checkout shows.
   * Absent on a server that does not send them, and the checkout then shows no breakdown.
   */
  base_amount?: number;
  discount_amount?: number;
  taxable_amount?: number;
  gst_percent?: number;
  gst_amount?: number;
  final_amount?: number;
}

export interface CurrentSubscription {
  sub_id: string;
  plan_id: string;
  start_date: string;
  end_date: string;
  payment_ref: string | null;
  status: 'active' | 'expired' | 'cancelled';
  /** The plan's name, as the server has it. */
  plan_name?: string | null;
  /** 'monthly' | 'yearly' — stored from activation. Null for rows bought before it was stored. */
  billing_cycle?: 'monthly' | 'yearly' | null;
}

export function createOrder(req: CreateOrderRequest): Promise<CreateOrderResponse> {
  return userApi.post<CreateOrderResponse>('/api/v1/user/payment/order', req);
}

export function verifyPayment(req: VerifyPaymentRequest): Promise<PaymentResult> {
  return userApi.post<PaymentResult>('/api/v1/user/payment/verify', req);
}

/** `plan_id` and the cycle let the server price the code against what is being bought. */
export function validatePromo(code: string, plan?: { plan_id: string; billing_cycle: BillingCycle }): Promise<PromoValidation> {
  return userApi.post<PromoValidation>('/api/v1/user/promo/validate', { code, ...(plan ?? {}) });
}

/** `null` when the user has never subscribed. */
export function getCurrentSubscription(): Promise<CurrentSubscription | null> {
  return userApi.get<CurrentSubscription | null>('/api/v1/user/subscription/current');
}
