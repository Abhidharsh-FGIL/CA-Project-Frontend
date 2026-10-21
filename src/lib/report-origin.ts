/**
 * Where a report should send the aspirant back to.
 *
 * A report is opened from several places — History, Performance, the dashboard — and Back has to return
 * to the one they came from. `navigate(-1)` does not reliably do that: the exam pages change their tab
 * and filters by replacing history entries, so "the previous entry" can be a page further back. Each
 * link therefore records its own page in the navigation state, and the report goes back to that.
 */

/** The app's current path, as the router sees it (the app uses hash routing). */
export function here(): string {
  return window.location.hash.replace(/^#/, '') || '/';
}

/** The page recorded in a report's navigation state, if any. */
export function originOf(state: unknown): string | null {
  const from = (state as { from?: unknown } | null)?.from;
  return typeof from === 'string' && from.startsWith('/') ? from : null;
}
