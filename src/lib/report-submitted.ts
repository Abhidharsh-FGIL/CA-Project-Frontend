/**
 * When an attempt was handed in, as the report says it: "Submitted 23 Oct 2026, 7:40 PM" in IST, or
 * "Auto-submitted …" when the timer did it. Null when there is no submission time (an attempt still going).
 */
import { formatDateTime } from '@/lib/admin-history-format';

export function submittedLabel(meta: { submittedAt: string | null; autoSubmitted?: boolean }): string | null {
  const when = formatDateTime(meta.submittedAt);
  if (!meta.submittedAt || when === '—') return null;
  return `${meta.autoSubmitted ? 'Auto-submitted' : 'Submitted'} ${when}`;
}
