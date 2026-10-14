/**
 * What the Test History screen says about an attempt — how it ended, how long it took, how
 * well it went — kept apart from the page so the rules can be tested without rendering it.
 */
import type { ApiAttempt } from '@/lib/userPortalApi';

/** Started but never submitted — the attempt has no score at all. */
export const isUnfinished = (h: Pick<ApiAttempt, 'status' | 'percentage'>) =>
  h.status === 'in_progress' || h.percentage === null;

export type AttemptOutcome = 'completed' | 'auto-submitted' | 'unfinished';

/** How the attempt ended. Having no score outranks everything: nothing was recorded. */
export function attemptOutcome(h: Pick<ApiAttempt, 'status' | 'percentage' | 'auto_submitted'>): AttemptOutcome {
  if (isUnfinished(h)) return 'unfinished';
  return h.auto_submitted ? 'auto-submitted' : 'completed';
}

/** "11 min", "< 1 min" — null when there is no end time or the clocks disagree. */
export function durationLabel(h: Pick<ApiAttempt, 'start_time' | 'end_time'>): string | null {
  if (!h.end_time || !h.start_time) return null;
  const ms = new Date(h.end_time).getTime() - new Date(h.start_time).getTime();
  if (!Number.isFinite(ms) || ms <= 0) return null;
  return ms < 60_000 ? '< 1 min' : `${Math.round(ms / 60_000)} min`;
}

export type ScoreTone = 'high' | 'mid' | 'low';

/** The band a percentage falls in — 70 and over is strong, 50 and over is middling. */
export const scoreTone = (percentage: number): ScoreTone => (percentage >= 70 ? 'high' : percentage >= 50 ? 'mid' : 'low');
