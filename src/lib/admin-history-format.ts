/**
 * How the admin's User History shows what the server sends: dates in IST, durations as "3h 0m", and the
 * three attempt statuses in words. A missing value is a dash, never "null" or "NaN".
 */
import type { HistoryAttemptStatus } from '@/lib/adminHistoryApi';

export const DASH = '—';

/** An ISO string with no offset ("2026-09-02T10:15:00") is how the server writes IST wall time. */
const HAS_ZONE = /(Z|[+-]\d{2}:?\d{2})$/i;

function parse(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const d = new Date(HAS_ZONE.test(iso) ? iso : `${iso}+05:30`);
  return Number.isNaN(d.getTime()) ? null : d;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DATE_PARTS = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'numeric', year: 'numeric' });
const TIME = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit', hour12: true });

/** The day in IST as "2 Sep 2026". Month names are spelt here: newer browsers print "Sept", and this should not vary. */
function dayLabel(d: Date): string {
  const part = (type: string) => DATE_PARTS.formatToParts(d).find(p => p.type === type)?.value ?? '';
  return `${part('day')} ${MONTHS[Number(part('month')) - 1] ?? ''} ${part('year')}`;
}

/** "22 Oct 2026, 7:40 PM" in IST, or a dash. */
export function formatDateTime(iso: string | null | undefined): string {
  const d = parse(iso);
  return d ? `${dayLabel(d)}, ${TIME.format(d).toUpperCase()}` : DASH;
}

/** "2 Sep 2026" in IST, or a dash. */
export function formatDate(iso: string | null | undefined): string {
  const d = parse(iso);
  return d ? dayLabel(d) : DASH;
}

/** "3h 0m", "25m", "40s" — or a dash while a test is still running. */
export function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return DASH;
  const total = Math.round(seconds);
  if (total < 60) return `${total}s`;
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export const ATTEMPT_STATUS: Record<HistoryAttemptStatus, { label: string; tone: 'ok' | 'warn' | 'live' }> = {
  submitted: { label: 'Completed', tone: 'ok' },
  auto_submitted: { label: 'Auto-submitted (time up)', tone: 'warn' },
  in_progress: { label: 'In progress', tone: 'live' },
};

export function attemptStatus(status: string): { label: string; tone: 'ok' | 'warn' | 'live' } {
  return ATTEMPT_STATUS[status as HistoryAttemptStatus] ?? { label: status || DASH, tone: 'ok' };
}

/** "71.25" → "71.3%"; a missing percentage is a dash. */
export function formatPercent(p: number | null | undefined): string {
  return p == null || !Number.isFinite(p) ? DASH : `${Math.round(p * 10) / 10}%`;
}

/** A score without a trailing ".0": 142.5 → "142.5", 7 → "7". */
export function formatScore(s: number | null | undefined): string {
  return s == null || !Number.isFinite(s) ? DASH : String(Math.round(s * 100) / 100);
}

/** A promo's type, as the person reading it would say it ("subscription" → "Subscription"). */
export function promoScope(scope: string | null | undefined): string {
  const t = (scope ?? '').replace(/[_-]+/g, ' ').trim();
  return t ? t[0].toUpperCase() + t.slice(1) : DASH;
}
