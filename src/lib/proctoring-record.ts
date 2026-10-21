/**
 * What this browser saw while a test was being sat — how often the candidate left the tab, and what ended it.
 *
 * The test screen counts tab switches and sends the count with the submit. When the server does not hand that
 * count back on the report, the report would say "0 switches" for a paper that was auto-submitted after three.
 * So the count is also kept here, per attempt, and the report uses it when it is larger than the server's.
 * It lives in this browser only: it is a stopgap, not a record.
 */
import type { SubmitReason } from '@/lib/userPortalApi';

export interface ProctoringRecord {
  tab_violations: number;
  submit_reason: SubmitReason;
}

const key = (attemptId: string) => `mge:proctoring:${attemptId}`;

export function saveProctoringRecord(attemptId: string, record: ProctoringRecord): void {
  try {
    localStorage.setItem(key(attemptId), JSON.stringify(record));
  } catch {
    /* Storage can be unavailable (private window, blocked site data); the report then shows the server's figure. */
  }
}

export function readProctoringRecord(attemptId: string): ProctoringRecord | null {
  try {
    const raw = localStorage.getItem(key(attemptId));
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<ProctoringRecord>;
    return typeof v.tab_violations === 'number' && v.submit_reason
      ? { tab_violations: v.tab_violations, submit_reason: v.submit_reason }
      : null;
  } catch {
    return null;
  }
}
