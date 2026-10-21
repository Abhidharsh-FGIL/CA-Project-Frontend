/**
 * Purchase history — the user's successful plan and top-up purchases, newest first.
 *
 *   GET /api/v1/user/payment/history?kind=plan|topup&page=&limit=
 */
import { userApi } from './api';

export interface PurchaseValidity {
  valid_from: string | null;
  valid_until: string | null;
  /** Plans: active | expired | replaced. Top-ups: active | used_up. */
  status: string;
  mock_tests: number | null;
  mock_used: number | null;
  practice_tests: number | null;
  practice_used: number | null;
}

export interface Purchase {
  txn_id: string;
  purchased_at: string;
  invoice_no: string | null;
  payment_id: string | null;
  kind: 'plan' | 'topup';
  name: string;
  billing_cycle: 'monthly' | 'yearly' | null;
  base_amount: number;
  discount_amount: number;
  amount_paid: number;
  /** The GST inside `amount_paid`. Absent or 0 on a purchase made before GST was charged. */
  gst_amount?: number | null;
  /** Where the tax invoice (a PDF) is fetched from, with the bearer token. Null when there is none. */
  invoice_url?: string | null;
  promo_code: string | null;
  payment_method: string | null;
  /** Null for very old records. */
  validity: PurchaseValidity | null;
}

export interface PurchasePage {
  items: Purchase[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export function getPurchaseHistory(opts: { kind?: 'plan' | 'topup'; page?: number; limit?: number } = {}): Promise<PurchasePage> {
  const q = new URLSearchParams();
  if (opts.kind) q.set('kind', opts.kind);
  q.set('page', String(opts.page ?? 1));
  q.set('limit', String(opts.limit ?? 20));
  return userApi.get<PurchasePage>(`/api/v1/user/payment/history?${q.toString()}`);
}

/**
 * Fetch a purchase's tax invoice and hand it to the browser under the name the server gives it.
 *
 * The request needs the bearer token, so it cannot be a plain link. A 404 (no such invoice) and the
 * rest come back as the server's own message; a 401 is the session popup's business.
 */
export async function downloadInvoice(p: Pick<Purchase, 'invoice_url' | 'invoice_no' | 'txn_id'>): Promise<void> {
  if (!p.invoice_url) throw new Error('There is no invoice for this purchase.');
  const { blob, filename } = await userApi.getFile(p.invoice_url);
  const href = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = href;
  // The server names the file (student, plan or top-up, date); ours is only for when it did not say.
  a.download = filename ?? `invoice_${p.invoice_no ?? p.txn_id}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(href);
}

/** "19 Oct 2026, 6:10 PM" — the server's UTC time shown in IST. */
export function formatPurchaseTime(iso: string): string {
  // The server sends a UTC time with no zone marker; read it as UTC.
  const utc = /[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso}Z`;
  const d = new Date(utc);
  if (Number.isNaN(d.getTime())) return '—';
  return d
    .toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
    .replace(/\b(am|pm)\b/, m => m.toUpperCase());
}

const dayOnly = (iso: string | null) =>
  iso
    ? new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : null;

/** What the validity column says: the dates for a plan, "Never expires" and tests used for a top-up. */
export function describeValidity(p: Purchase): { line: string; detail: string | null; status: string | null } {
  const v = p.validity;
  if (!v) return { line: '—', detail: null, status: null };
  if (p.kind === 'topup') {
    const parts = [
      v.practice_tests != null ? `Practice ${v.practice_used ?? 0}/${v.practice_tests} used` : null,
      v.mock_tests != null ? `Mock ${v.mock_used ?? 0}/${v.mock_tests} used` : null,
    ].filter(Boolean);
    return { line: 'Never expires', detail: parts.join(' · ') || null, status: v.status };
  }
  const from = dayOnly(v.valid_from);
  const until = dayOnly(v.valid_until);
  return { line: from && until ? `${from} – ${until}` : (until ?? from ?? '—'), detail: null, status: v.status };
}
