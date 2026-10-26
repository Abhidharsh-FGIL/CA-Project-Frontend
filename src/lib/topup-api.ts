/**
 * Top-up packs — extra mock and practice tests bought on top of a plan. The backend's four endpoints:
 *
 *   GET  /api/v1/user/topup/packs     → the packs, the saved balance, can_purchase and reason
 *   POST /api/v1/user/topup/order     → { pack_id, promo_code? } → Razorpay Checkout data (the server sets the price)
 *   POST /api/v1/user/promo/validate  → { code, pack_id } → the price with the code applied (a preview)
 *   POST /api/v1/user/topup/verify    → the same 3 Razorpay fields as plan verify → the new balance
 *   GET  /api/v1/user/topup/balance   → { mock, practice }
 *
 * The checkout is the plan checkout, with these endpoints. The amount Razorpay charges is the server's
 * (`amount`, in paise); nothing here computes a price.
 *
 * The pack's field names are read defensively (`mock` or `mock_tests`, and so on) because the contract
 * for them was not in the note this was written from. Anything that is missing is left out, never invented.
 */
import { userApi } from './api';

export interface TopUpBalance {
  mock: number;
  practice: number;
}

export interface TopUpPack {
  pack_id: string;
  name: string;
  /** Mock tests in the pack. 0 when it has none. */
  mock: number;
  /** Practice tests in the pack. 0 when it has none. */
  practice: number;
  /** Rupees. */
  price: number;
  /** Short line under the name, when the server sends one. */
  description: string | null;
}

export interface TopUpPacksResponse {
  packs: TopUpPack[];
  balance: TopUpBalance;
  can_purchase: boolean;
  /** Why they cannot buy now (e.g. "Active Ultimate plan required"), when they cannot. */
  reason: string | null;
}

/** The Razorpay Checkout data for a pack — the same shape as a plan's order. */
export interface TopUpOrder {
  key_id?: string;
  order_id?: string;
  /** Paise. What Razorpay charges. */
  amount?: number;
  currency?: string;
  prefill?: { name: string; email: string; contact?: string | null } | null;
  pack_name?: string | null;
  activated?: boolean;
  base_amount?: number;
  gst_percent?: number;
  gst_amount?: number;
  /** Rupees, GST included. */
  final_amount?: number;
  /** Rupees taken off by the promo code, when one was used. */
  discount_amount?: number;
  promo_code?: string | null;
  /** Present when `activated`: the balance after the pack was added without a payment (a 100%-off code). */
  balance?: unknown;
}

/** What `/user/promo/validate` says about a code for a pack. Rupees. */
export interface TopUpPromoQuote {
  valid: boolean;
  message: string;
  base_amount?: number;
  discount_amount?: number;
  final_amount?: number;
}

export interface TopUpVerifyRequest {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

const num = (...values: unknown[]): number => {
  for (const v of values) if (typeof v === 'number' && Number.isFinite(v) && v >= 0) return v;
  return 0;
};

/** Reads one pack the way the server sends it, whichever of its names it uses. */
export function packFrom(raw: Record<string, unknown>): TopUpPack | null {
  const id = raw.pack_id ?? raw.id;
  if (typeof id !== 'string' || !id) return null;
  return {
    pack_id: id,
    name: typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim() : 'Top-up pack',
    mock: num(raw.mock, raw.mock_tests, raw.mock_test_count),
    practice: num(raw.practice, raw.practice_tests, raw.practice_test_count),
    price: num(raw.price, raw.price_inr, raw.amount),
    description: typeof raw.description === 'string' && raw.description.trim() ? raw.description.trim() : null,
  };
}

/** The packs response, tolerant of missing parts: no packs means no section, not a crash. */
export function topUpPacksFrom(raw: unknown): TopUpPacksResponse {
  const r = (raw ?? {}) as Record<string, unknown>;
  const list = Array.isArray(r.packs) ? r.packs : [];
  const balance = (r.balance ?? {}) as Record<string, unknown>;
  return {
    packs: list
      .map(p => packFrom((p ?? {}) as Record<string, unknown>))
      .filter((p): p is TopUpPack => p !== null),
    balance: { mock: num(balance.mock), practice: num(balance.practice) },
    can_purchase: r.can_purchase === true,
    reason: typeof r.reason === 'string' && r.reason.trim() ? r.reason.trim() : null,
  };
}

/** The balance, whether the server sends it bare or inside `balance`. */
export function balanceFrom(raw: unknown): TopUpBalance {
  const r = (raw ?? {}) as Record<string, unknown>;
  const inner = (r.balance ?? r) as Record<string, unknown>;
  return { mock: num(inner.mock), practice: num(inner.practice) };
}

export function getTopUpPacks(): Promise<TopUpPacksResponse> {
  return userApi.get<unknown>('/api/v1/user/topup/packs').then(topUpPacksFrom);
}

export function getTopUpBalance(): Promise<TopUpBalance> {
  return userApi.get<unknown>('/api/v1/user/topup/balance').then(balanceFrom);
}

/** An empty or missing `promoCode` means no code. A bad code is a 400 whose message says why. */
export function createTopUpOrder(packId: string, promoCode?: string | null): Promise<TopUpOrder> {
  const code = promoCode?.trim();
  return userApi.post<TopUpOrder>('/api/v1/user/topup/order', {
    pack_id: packId,
    ...(code ? { promo_code: code } : {}),
  });
}

/** Previews what a promo code does to a pack's price. The order applies the code again, so this is only a preview. */
export function validateTopUpPromo(code: string, packId: string): Promise<TopUpPromoQuote> {
  return userApi.post<TopUpPromoQuote>('/api/v1/user/promo/validate', { code: code.trim(), pack_id: packId });
}

export function verifyTopUp(req: TopUpVerifyRequest): Promise<TopUpBalance> {
  return userApi.post<unknown>('/api/v1/user/topup/verify', req).then(balanceFrom);
}
