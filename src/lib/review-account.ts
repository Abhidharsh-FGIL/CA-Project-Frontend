/**
 * The account the Google Play reviewers sign in with.
 *
 * A reviewer cannot open our inbox, so for this one email the login OTP is shown on the page: the server puts the
 * code in its "OTP sent" reply (`otp`) for this address only, and the OTP step shows it. The page only shows a code
 * the server chose to send, and only for this address; the real gate is the server's.
 */
export const REVIEW_ACCOUNT_EMAIL = 'aravindhkumar@fgilservices.com';

export function isReviewAccount(identifier: string | null | undefined): boolean {
  return (identifier ?? '').trim().toLowerCase() === REVIEW_ACCOUNT_EMAIL;
}

/** The code from the "OTP sent" reply, under whichever name the server uses; null when it sent none. */
export function otpFromReply(res: unknown): string | null {
  const NAMES = ['otp', 'review_otp', 'debug_otp', 'dev_otp', 'test_otp', 'otp_code', 'code'];
  const pick = (o: unknown): unknown => {
    if (!o || typeof o !== 'object') return undefined;
    const r = o as Record<string, unknown>;
    for (const n of NAMES) if (r[n] != null && typeof r[n] !== 'object') return r[n];
    return undefined;
  };
  const r = (res ?? {}) as Record<string, unknown>;
  const raw = pick(r) ?? pick(r.data);
  const code = raw == null ? '' : String(raw).replace(/\D/g, '');
  return code.length >= 4 && code.length <= 8 ? code : null;
}
