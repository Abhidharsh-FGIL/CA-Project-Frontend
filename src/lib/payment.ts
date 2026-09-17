/**
 * Payment gateway integration: PhonePe (India) and Stripe (International).
 *
 * Both gateways use a redirect-based flow:
 *   1. Call createCheckoutSession(gateway, item) → get redirect_url
 *   2. Redirect user to the payment page
 *   3. On return, call verifyPhonePePayment() or getPaymentStatus() to confirm
 */
import { api } from '@/lib/api';

export type PaymentGateway = 'phonepe' | 'stripe';

export type PaymentItemType = 'plan_upgrade' | 'point_pack';

export interface PaymentItem {
  type: PaymentItemType;
  item_id: string;
  label: string;
  amount_inr: number;
  org_id?: string;
}

export interface CheckoutSessionResponse {
  session_id: string;
  redirect_url: string;
  gateway: PaymentGateway;
}

export interface PaymentStatusResponse {
  status: 'success' | 'pending' | 'failed';
  message: string;
  plan?: string;
  points_added?: number;
}

export interface PromoValidateResponse {
  valid: boolean;
  message: string;
  discount_amount: number;
  final_amount: number;
  discount_label: string;
}

/**
 * Create a checkout session on the backend.
 */
export async function createCheckoutSession(
  gateway: PaymentGateway,
  item: PaymentItem,
  orgId?: string | null,
  promoCode?: string | null,
): Promise<CheckoutSessionResponse> {
  return api.post<CheckoutSessionResponse>('/api/v1/payments/checkout', {
    gateway,
    item_type: item.type,
    item_id: item.item_id,
    amount_inr: item.amount_inr,
    org_id: orgId || undefined,
    promo_code: promoCode || undefined,
    success_url: `${window.location.origin}${import.meta.env.BASE_URL}#/user/subscription?payment=success`,
    cancel_url: `${window.location.origin}${import.meta.env.BASE_URL}#/user/subscription?payment=cancelled`,
  });
}

/**
 * Validate a promo code against an item before checkout.
 */
export async function validatePromoCode(
  code: string,
  itemType: PaymentItemType,
  itemId: string,
  amountInr: number,
): Promise<PromoValidateResponse> {
  return api.post<PromoValidateResponse>('/api/v1/payments/validate-promo', {
    code,
    item_type: itemType,
    item_id: itemId,
    amount_inr: amountInr,
  });
}

/**
 * Check PhonePe payment status after redirect back.
 */
export async function verifyPhonePePayment(
  merchantOrderId: string,
  itemType: string,
  itemId: string,
  orgId?: string,
  promoCode?: string,
  promoDiscount?: string,
): Promise<PaymentStatusResponse> {
  const params = new URLSearchParams({
    item_type: itemType,
    item_id: itemId,
    org_id: orgId || '',
    promo_code: promoCode || '',
    promo_discount: promoDiscount || '0',
  });
  return api.get<PaymentStatusResponse>(
    `/api/v1/payments/phonepe/status/${merchantOrderId}?${params}`,
  );
}

/**
 * Check Stripe payment status after redirect back.
 */
export async function getPaymentStatus(sessionId: string): Promise<PaymentStatusResponse> {
  return api.get<PaymentStatusResponse>(`/api/v1/payments/status/${sessionId}`);
}
