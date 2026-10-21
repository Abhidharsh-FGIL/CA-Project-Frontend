/**
 * What the promo form sends to `/admin/promos/`.
 *
 * Kept out of the page so the rules that decide what reaches the server can be
 * tested: the form is easy to get subtly wrong, and a wrong promo is money.
 */
import type {
  PromoCodeOut,
  PromoCreatePayload,
  PromoScope,
  PromoUpdatePayload,
} from '@/lib/adminApi';

/** The plans a code can be limited to. Free has no price to discount. */
export const PROMO_PLAN_OPTIONS = ['standard', 'ultimate', 'premium'] as const;
/** The billing cycles a code can be limited to — the values an order is created with. */
export const PROMO_BILLING_OPTIONS = ['monthly', 'yearly'] as const;

export type PromoDraft = Pick<
  PromoCodeOut,
  | 'code_string'
  | 'scope'
  | 'discount_pct'
  | 'max_uses'
  | 'expiry_date'
  | 'test_id'
  | 'applies_to_tiers'
  | 'applies_to_billing'
  | 'max_uses_per_user'
>;

/** Plan and billing limits only mean something for a subscription code. */
export const limitsPlans = (scope: PromoScope) => scope === 'subscription';

/** The server stores a date, not a moment: `2026-11-08`, never `2026-11-08T00:00:00.000Z`. */
const day = (v: string | null | undefined): string | null => (v ? v.split('T')[0] : null);

const picked = (v: string[] | null | undefined): string[] | null => (v && v.length > 0 ? [...v] : null);

/** Local calendar date as `YYYY-MM-DD`. */
function today(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/** What is wrong with the form, in the admin's words — or null when it can be sent. */
export function validatePromoDraft(d: PromoDraft, isNew: boolean): string | null {
  const code = d.code_string.trim();
  if (code.length < 3 || code.length > 100) return 'The code must be 3 to 100 characters.';
  if (/\s/.test(code)) return 'The code cannot contain spaces.';

  if (!Number.isFinite(d.discount_pct) || d.discount_pct < 1 || d.discount_pct > 100) {
    return 'The discount must be between 1 and 100.';
  }

  // Only a new code is held to this: editing an expired code to give it fresh
  // uses must not be blocked by the date it already carries.
  const expiry = day(d.expiry_date);
  if (isNew && expiry && expiry < today()) return 'The expiry date is in the past.';

  const perUser = d.max_uses_per_user ?? -1;
  if (perUser > 0 && d.max_uses > 0 && perUser > d.max_uses) {
    return 'Uses per user cannot be more than the total uses.';
  }

  return null;
}

/** The body for a new code. Fields that do not apply to its scope are left out. */
export function toCreatePayload(d: PromoDraft): PromoCreatePayload {
  const payload: PromoCreatePayload = {
    code_string: d.code_string.trim().toUpperCase(),
    scope: d.scope,
    discount_pct: d.discount_pct,
    // -1 is how the server says "unlimited". Say it outright rather than omit it.
    max_uses: d.max_uses > 0 ? d.max_uses : -1,
    max_uses_per_user: (d.max_uses_per_user ?? 0) > 0 ? d.max_uses_per_user : -1,
  };

  const expiry = day(d.expiry_date);
  if (expiry) payload.expiry_date = expiry;

  if (d.scope === 'test' && d.test_id?.trim()) payload.test_id = d.test_id.trim();

  if (limitsPlans(d.scope)) {
    const tiers = picked(d.applies_to_tiers);
    const billing = picked(d.applies_to_billing);
    if (tiers) payload.applies_to_tiers = tiers;
    if (billing) payload.applies_to_billing = billing;
  }
  return payload;
}

/**
 * The body for an edit.
 *
 * Every field is stated, including the ones that are being cleared: omitting
 * `max_uses` for an unlimited code meant an edit could never take a limited code
 * back to unlimited, and a leftover `test_id` from a code that was once test-scoped
 * would keep riding along on a subscription code.
 */
export function toUpdatePayload(d: PromoDraft): PromoUpdatePayload {
  return {
    scope: d.scope,
    discount_pct: d.discount_pct,
    max_uses: d.max_uses > 0 ? d.max_uses : -1,
    max_uses_per_user: (d.max_uses_per_user ?? 0) > 0 ? d.max_uses_per_user : -1,
    expiry_date: day(d.expiry_date),
    test_id: d.scope === 'test' ? d.test_id?.trim() || null : null,
    applies_to_tiers: limitsPlans(d.scope) ? picked(d.applies_to_tiers) : null,
    applies_to_billing: limitsPlans(d.scope) ? picked(d.applies_to_billing) : null,
  };
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** "Standard, Ultimate · Yearly only" for a limited subscription code; null where nothing is limited. */
export function restrictionLabel(
  p: Pick<PromoCodeOut, 'scope' | 'applies_to_tiers' | 'applies_to_billing'>,
): string | null {
  if (!limitsPlans(p.scope)) return null;
  const tiers = picked(p.applies_to_tiers);
  const billing = picked(p.applies_to_billing);
  const plans = tiers ? tiers.map(cap).join(', ') : 'All plans';
  const cycle = billing && billing.length === 1 ? ` · ${cap(billing[0])} only` : '';
  return plans + cycle;
}
