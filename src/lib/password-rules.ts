/**
 * The one password rule, and what to say when a password misses it.
 *
 * Sign-up, "set a new password" and "change password" each carried their own copy, and the copies
 * disagreed: the Profile page told people "min 8 chars, 1 uppercase, 1 number, 1 special character"
 * and then checked only the length, so a password it accepted could be refused by the server with a
 * message that said nothing about why. One rule, one wording, everywhere.
 */

export const PASSWORD_MIN_LENGTH = 8;

/** The rule as a sentence — the hint under a password field. */
export const PASSWORD_HINT = 'Min 8 chars, 1 uppercase, 1 number, 1 special character';

/** What a password is still missing, in the order a person would fix it. Empty when it is fine. */
export function passwordMisses(password: string): string[] {
  const misses: string[] = [];
  if (password.length < PASSWORD_MIN_LENGTH) misses.push(`at least ${PASSWORD_MIN_LENGTH} characters`);
  if (!/[A-Z]/.test(password)) misses.push('1 uppercase letter');
  if (!/\d/.test(password)) misses.push('1 number');
  if (!/[^A-Za-z0-9]/.test(password)) misses.push('1 special character');
  return misses;
}

const list = (items: string[]) =>
  items.length <= 1 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;

/**
 * The error for a password that does not meet the rule, naming only what is missing — or null when it
 * does. An empty password is "required", not a list of everything it lacks.
 */
export function passwordError(password: string): string | null {
  if (!password) return 'Enter a password';
  const misses = passwordMisses(password);
  return misses.length > 0 ? `Password needs ${list(misses)}` : null;
}

/** The error for a confirmation that does not match the password — or null when it does. */
export function confirmError(password: string, confirm: string): string | null {
  if (!confirm) return 'Confirm your password';
  return password === confirm ? null : 'Passwords do not match';
}
