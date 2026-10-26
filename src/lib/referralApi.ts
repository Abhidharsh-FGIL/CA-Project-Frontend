/**
 * Refer & Earn: cash rewards. The backend's endpoints (all under /api/v1, login token needed except `validate`):
 *
 *   POST /user/referral/validate    → { code } → { valid, message, referrer_name }   (sign-up page, no login)
 *   GET  /user/referral/me          → the code, the share link, the stats and the wallet
 *   POST /user/referral/apply       → { code } → { message, referrer_name }           (a user who joined without one)
 *   GET  /user/referral/friends     → the friends this user referred
 *   GET  /user/referral/wallet      → ?page&limit → the balance and the ledger of rewards and payouts
 *   POST /user/referral/withdrawals → ask for the available balance to be paid out (UPI or bank)
 *   GET  /user/referral/withdrawals → the requests made and where each stands
 *
 * The rules, so the screens say the same: the referrer gets `reward_percent` of the price without GST on a
 * friend's FIRST eligible purchase (within `eligibility_months` of joining); a reward is "pending" for `hold_days`, then "available";
 * available money is paid out in cash (a minimum, once a month, from the 1st). Rewards are never spent at checkout.
 * Nothing here computes a reward — every figure is the server's.
 */
import { publicApi, userApi } from './api';

export interface ReferralStats {
  friends_referred: number;
  paying_friends: number;
  total_earned: number;
}

export interface WalletBalance {
  available: number;
  pending: number;
}

export interface ReferralMe {
  referral_code: string;
  share_link: string;
  reward_percent: number;
  eligibility_months: number;
  hold_days: number;
  min_withdrawal: number;
  withdrawals_enabled: boolean;
  wallet_spend_enabled: boolean;
  stats: ReferralStats;
  wallet: WalletBalance;
  my_referrer: { name: string; linked_at: string | null } | null;
  can_apply_code: boolean;
  apply_problem: string | null;
}

export interface ReferralFriend {
  name: string;
  joined_at: string | null;
  earning_until: string | null;
  earning_active: boolean;
  /** 1: they bought and you earned. 0: still waiting for their first purchase. */
  purchases: number;
  earned: number;
}

export interface ReferralFriends {
  items: ReferralFriend[];
  total: number;
}

export type WalletEntryType =
  | 'referral_reward'
  | 'referral_reversal'
  | 'purchase'
  | 'purchase_refund'
  | 'withdrawal'
  | 'withdrawal_reversal'
  | 'adjustment';

export interface WalletEntry {
  entry_id: string;
  type: WalletEntryType | string;
  /** Rupees: + money in, − money out. */
  amount: number;
  status: 'pending' | 'available' | string;
  available_at: string | null;
  note: string | null;
  created_at: string | null;
}

export interface WalletHistory extends WalletBalance {
  items: WalletEntry[];
  total: number;
  page: number;
  limit: number;
}

export interface ReferralCheck {
  valid: boolean;
  message: string;
  referrer_name?: string | null;
}

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

export const validateReferralCode = (code: string): Promise<ReferralCheck> =>
  publicApi.post<ReferralCheck>('/api/v1/user/referral/validate', { code: code.trim() });

export const getReferralMe = (): Promise<ReferralMe> =>
  userApi.get<Partial<ReferralMe>>('/api/v1/user/referral/me').then(r => ({
    referral_code: r.referral_code ?? '',
    share_link: r.share_link ?? '',
    reward_percent: num(r.reward_percent),
    eligibility_months: num(r.eligibility_months),
    hold_days: num(r.hold_days),
    min_withdrawal: num(r.min_withdrawal),
    withdrawals_enabled: r.withdrawals_enabled === true,
    wallet_spend_enabled: r.wallet_spend_enabled !== false,
    stats: {
      friends_referred: num(r.stats?.friends_referred),
      paying_friends: num(r.stats?.paying_friends),
      total_earned: num(r.stats?.total_earned),
    },
    wallet: { available: num(r.wallet?.available), pending: num(r.wallet?.pending) },
    my_referrer: r.my_referrer ?? null,
    can_apply_code: r.can_apply_code === true,
    apply_problem: r.apply_problem ?? null,
  }));

export const applyReferralCode = (code: string) =>
  userApi.post<{ message: string; referrer_name?: string | null }>('/api/v1/user/referral/apply', { code: code.trim() });

export const getReferralFriends = (): Promise<ReferralFriends> =>
  userApi.get<Partial<ReferralFriends>>('/api/v1/user/referral/friends').then(r => ({
    items: Array.isArray(r.items) ? r.items : [],
    total: num(r.total),
  }));

export const getWalletHistory = (page = 1, limit = 20): Promise<WalletHistory> =>
  userApi.get<Partial<WalletHistory>>(`/api/v1/user/referral/wallet?page=${page}&limit=${limit}`).then(r => ({
    available: num(r.available),
    pending: num(r.pending),
    items: Array.isArray(r.items) ? r.items : [],
    total: num(r.total),
    page: r.page ?? page,
    limit: r.limit ?? limit,
  }));

// ─── Withdrawals (cash payout of the available rewards) ──────────────────────

export type WithdrawalRequest =
  | { amount: number; method: 'upi'; upi_id: string }
  | { amount: number; method: 'bank'; account_number: string; ifsc: string; account_name: string };

export interface Withdrawal {
  id: string;
  amount: number;
  method: 'upi' | 'bank' | string;
  /** requested → paid, or rejected (the money goes back to the available balance). */
  status: 'requested' | 'paid' | 'rejected' | string;
  /** The UPI id, or the account number masked as XXXX9012. */
  destination: string | null;
  payout_reference: string | null;
  note: string | null;
  created_at: string | null;
}

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);

/** One request as the server sends it, whichever of the likely names it uses. Anything missing is left out, never invented. */
export function withdrawalFrom(raw: Record<string, unknown>): Withdrawal {
  const payout = (raw.payout_details ?? {}) as Record<string, unknown>;
  return {
    id: str(raw.withdrawal_id) ?? str(raw.id) ?? str(raw.request_id) ?? '',
    amount: num(raw.amount),
    method: str(raw.method) ?? 'upi',
    status: str(raw.status) ?? 'requested',
    destination:
      str(raw.upi_id) ?? str(raw.account_number) ?? str(payout.upi_id) ?? str(payout.account_number) ?? str(raw.destination),
    payout_reference: str(raw.payout_reference),
    note: str(raw.note),
    created_at: str(raw.created_at) ?? str(raw.requested_at),
  };
}

export const requestWithdrawal = (req: WithdrawalRequest): Promise<Withdrawal> =>
  userApi.post<Record<string, unknown>>('/api/v1/user/referral/withdrawals', req).then(withdrawalFrom);

export const getWithdrawals = (): Promise<Withdrawal[]> =>
  userApi.get<unknown>('/api/v1/user/referral/withdrawals').then(r => {
    const list = Array.isArray(r) ? r : ((r as { items?: unknown[] } | null)?.items ?? []);
    return (Array.isArray(list) ? list : []).map(x => withdrawalFrom((x ?? {}) as Record<string, unknown>));
  });

export const WITHDRAWAL_STATUS_LABEL: Record<string, string> = {
  requested: 'Requested',
  paid: 'Paid',
  rejected: 'Rejected — returned to balance',
};

/** What is wrong with a withdrawal before it is sent, or null. The server checks again (one a month, balance, formats). */
export function withdrawalProblem(
  form: { amount: string; method: 'upi' | 'bank'; upiId: string; accountNumber: string; ifsc: string; accountName: string },
  available: number,
  minimum: number,
): string | null {
  const amount = Number(form.amount);
  if (!form.amount.trim() || !Number.isFinite(amount) || amount <= 0) return 'Enter the amount to withdraw.';
  if (amount < minimum) return `The minimum withdrawal is ${rupees(minimum)}.`;
  if (amount > available) return `You can withdraw up to ${rupees(available)}.`;
  if (form.method === 'upi') {
    if (!/^[\w.\-]{2,}@[a-zA-Z]{2,}$/.test(form.upiId.trim())) return 'Enter a valid UPI ID, like name@okaxis.';
    return null;
  }
  if (!/^\d{9,18}$/.test(form.accountNumber.trim())) return 'Enter a valid account number (9–18 digits).';
  if (!/^[A-Za-z]{4}0[A-Za-z0-9]{6}$/.test(form.ifsc.trim())) return 'Enter a valid IFSC, like SBIN0001234.';
  if (form.accountName.trim().length < 2) return 'Enter the name on the bank account.';
  return null;
}

/** Withdrawals are requested in the first week of the month: from the 1st to the 7th, both included. */
export const WITHDRAWAL_FIRST_DAY = 1;
export const WITHDRAWAL_LAST_DAY = 7;

/** Whether a withdrawal can be requested on this day. */
export function withdrawalWindowOpen(on: Date = new Date()): boolean {
  const day = on.getDate();
  return day >= WITHDRAWAL_FIRST_DAY && day <= WITHDRAWAL_LAST_DAY;
}

/** The 1st of the month the window next opens: the coming 1st, or this month's if today is before it (never, but total). */
export function nextWithdrawalWindow(from: Date = new Date()): Date {
  return withdrawalWindowOpen(from) ? new Date(from.getFullYear(), from.getMonth(), WITHDRAWAL_FIRST_DAY) : nextPayoutDate(from);
}

/**
 * The e-mail a withdrawal request becomes: to support, from the student's own mail app, saying who is asking, how
 * much and where to pay it. Plain text, so any mail app shows it as written.
 */
export function withdrawalMail(req: {
  name: string;
  email: string;
  phone?: string;
  referralCode: string;
  amount: number;
  available: number;
  method: 'upi' | 'bank';
  upiId?: string;
  accountName?: string;
  accountNumber?: string;
  ifsc?: string;
}): { subject: string; body: string } {
  const lines = [
    'Hello Support,',
    '',
    `${req.name} has requested a withdrawal of referral rewards.`,
    '',
    `Name: ${req.name}`,
    `Email: ${req.email}`,
    ...(req.phone ? [`Mobile: ${req.phone}`] : []),
    `Referral code: ${req.referralCode}`,
    `Amount requested: ${rupees(req.amount)} (available balance ${rupees(req.available)})`,
    `Payout method: ${req.method === 'upi' ? 'UPI' : 'Bank account'}`,
    ...(req.method === 'upi'
      ? [`UPI ID: ${req.upiId ?? ''}`]
      : [`Account holder: ${req.accountName ?? ''}`, `Account number: ${req.accountNumber ?? ''}`, `IFSC: ${req.ifsc ?? ''}`]),
    '',
    'Please verify and process this request.',
  ];
  return { subject: `Withdrawal request – ${req.name} (${req.referralCode})`, body: lines.join('\n') };
}

/** The first of next month — when approved withdrawals start to be paid. */
export function nextPayoutDate(from: Date = new Date()): Date {
  return new Date(from.getFullYear(), from.getMonth() + 1, 1);
}

/**
 * What a referrer could earn: `reward_percent` of the price without GST (the displayed price includes it) on each
 * eligible purchase. A rough guide for the "estimate your earnings" box, not a promise.
 */
export function estimateRewards(
  counts: { monthly: number; annual: number },
  prices: { monthly: number; annual: number },
  rewardPercent: number,
  gstPercent = 18,
): number {
  const net = (price: number) => price / (1 + gstPercent / 100);
  // Rounded once, at the end, so a hundred small rewards do not drift from the sum of the unrounded ones.
  const each = (price: number) => (net(price) * rewardPercent) / 100;
  return Math.round((each(prices.monthly) * counts.monthly + each(prices.annual) * counts.annual) * 100) / 100;
}

// ─── Presentation ─────────────────────────────────────────────────────────────

/** What each ledger type is called on screen. An unknown type is shown as the server wrote it. */
export const WALLET_TYPE_LABEL: Record<string, string> = {
  referral_reward: 'Referral reward',
  referral_reversal: "Reward reversed (friend's payment refunded)",
  purchase: 'Used for purchase',
  purchase_refund: 'Returned (purchase refunded)',
  withdrawal: 'Withdrawal',
  withdrawal_reversal: 'Withdrawal rejected, amount returned',
  adjustment: 'Adjustment by admin',
};

export const walletTypeLabel = (type: string): string => WALLET_TYPE_LABEL[type] ?? type.replace(/_/g, ' ');

/** ₹1,234.50 — whole rupees keep no decimals. */
export function rupees(n: number): string {
  const whole = Number.isInteger(n);
  return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2 })}`;
}

/** A signed amount for the ledger: +₹21.14 / −₹50. */
export function signedRupees(n: number): string {
  return `${n < 0 ? '−' : '+'}${rupees(Math.abs(n))}`;
}

export function shortDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** The line under a ledger row's amount: when a pending reward turns into money, else the date it happened. */
export function entryStatusLine(e: Pick<WalletEntry, 'status' | 'available_at' | 'created_at'>): string {
  if (e.status === 'pending' && e.available_at) return `Available on ${shortDate(e.available_at)}`;
  return shortDate(e.created_at);
}

// ─── The sign-up link ─────────────────────────────────────────────────────────

/** A code, mobile number or email — the three things the field takes. Trimmed; an empty one means none. */
export const cleanReferralInput = (raw: string): string => raw.trim();

/** The `ref` in a page's query string (`?ref=MGE-A7K92`), upper-cased when it is a code, else null. */
export function refFromSearch(search: string): string | null {
  const v = new URLSearchParams(search).get('ref')?.trim();
  if (!v) return null;
  return /^MGE-/i.test(v) ? v.toUpperCase() : v;
}

const SAVED_KEY = 'mge:referral-code';

/** Keep a code from a share link: Google sign-in can reload the page and lose `?ref=`. Storage can be blocked; then it is simply not kept. */
export function saveReferral(code: string) {
  try {
    localStorage.setItem(SAVED_KEY, code);
  } catch {
    /* not kept */
  }
}

export function savedReferral(): string | null {
  try {
    return localStorage.getItem(SAVED_KEY) || null;
  } catch {
    return null;
  }
}

/** Forget the kept code once the account is made. */
export function clearSavedReferral() {
  try {
    localStorage.removeItem(SAVED_KEY);
  } catch {
    /* nothing to clear */
  }
}

/** The WhatsApp share link for a message and the referral link. */
export function whatsappShareUrl(message: string): string {
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}
