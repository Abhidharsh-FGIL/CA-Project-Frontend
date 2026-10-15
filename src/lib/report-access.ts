/**
 * Which plans get which reports.
 *
 * The Free plan includes the practice test report and not the detailed mock test report — "Upgrade to
 * see mock test reports" is one of its listed points. The backend does not enforce that for the
 * report itself (only the AI insights are gated server-side, see PLANS.md), so the app keeps the
 * report back and shows the plan popup in its place.
 *
 * Keyed on the tier rather than a plan feature because the plan data has no field for it. To lock
 * practice reports too, or to open mock reports to Free, this is the one place to change.
 */
export function reportIsLocked(tier: string | null | undefined, testMode: string | null | undefined): boolean {
  return tier === 'free' && (testMode ?? '').trim().toLowerCase() === 'mock';
}
