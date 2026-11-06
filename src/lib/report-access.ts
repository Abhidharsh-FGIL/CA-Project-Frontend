/**
 * Which plans get which reports.
 *
 * Every plan, Free included, now sees the report of a test it has taken — practice or mock. The
 * AI insights are still gated server-side (see PLANS.md); that is separate from this.
 *
 * Kept as one function so a lock can be put back in one place: for Free and mock reports it was
 * `tier === 'free' && testMode === 'mock'`.
 */
export function reportIsLocked(_tier: string | null | undefined, _testMode: string | null | undefined): boolean {
  return false;
}
