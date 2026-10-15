/**
 * Login with a one-time password — the parts of it that are decisions rather than plumbing.
 *
 * The student gives an email ID or a mobile number, is sent a six-digit code, and signs in with
 * it. The server owns the rules (60 s between codes, 5 wrong tries, a 5-minute life); the screen
 * mirrors them so it can say what is happening instead of waiting to be told no.
 */

export const OTP_LENGTH = 6;
/** How soon after one code another may be asked for. */
export const RESEND_COOLDOWN_SECONDS = 60;
/** How long a code stays good. */
export const OTP_VALID_SECONDS = 300;

const INVALID_IDENTIFIER = 'Enter a valid email ID or 10-digit mobile number';
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MOBILE = /^\d{10}$/;

/** Either what to send to the server, or why not — tell them apart with `'error' in result`. */
export type ParsedIdentifier = { identifier: string; kind: 'email' | 'mobile' } | { error: string };

/**
 * What the student typed, as the server wants it — or why it will not do.
 *
 * A mobile number is typed with spaces or dashes as often as without ("98765 43210"), and the
 * server takes ten bare digits, so those are tidied away rather than refused.
 */
export function parseIdentifier(raw: string): ParsedIdentifier {
  const text = raw.trim();
  if (!text) return { error: 'Enter your email ID or mobile number' };

  if (text.includes('@')) {
    return EMAIL.test(text) ? { identifier: text, kind: 'email' } : { error: INVALID_IDENTIFIER };
  }

  const digits = text.replace(/[\s-]/g, '');
  return MOBILE.test(digits) ? { identifier: digits, kind: 'mobile' } : { error: INVALID_IDENTIFIER };
}

/** Only digits, and no more than a code has — what the OTP box accepts, typed or pasted. */
export function otpDigits(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, OTP_LENGTH);
}

/**
 * How long the server says to wait before asking again ("Please wait 42 seconds before
 * requesting a new OTP"), so the Resend button counts down the server's clock and not just ours
 * — a refresh or a second tab does not reset that. `null` when the message is about anything else.
 */
export function secondsToWait(message: string): number | null {
  const found = /wait\s+(\d+)\s+second/i.exec(message);
  return found ? Number(found[1]) : null;
}

/**
 * Whether the server has thrown the code away and a new one has to be asked for ("Too many wrong
 * OTPs. Please request a new OTP.") — after which typing the same code again can only fail.
 */
export function needsNewOtp(message: string): boolean {
  return /request a new otp/i.test(message);
}

/** `4:07` — the time left on a code. */
export function clock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
