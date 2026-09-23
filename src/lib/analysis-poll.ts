/**
 * The state machine behind the report's analysis polling.
 *
 * Pure and separate from `use-attempt-report.ts` for the same reason
 * `report-gate-state.ts` is separate from `ReportGate.tsx`: this decides
 * whether an aspirant waiting for their report ever stops waiting. A loop that
 * gives up on one flaky response strands them on an error card; a loop that
 * never gives up strands them on a spinner. Both are worth being able to test.
 */

/**
 * Where this attempt's analysis has got to.
 *
 * `pending` covers every "the backend has nothing for you yet" answer — a
 * `not_started` body, a `generating` one, and the moment just after a dispatch
 * returns `{"status":"dispatched"}`. They are one state as far as a screen is
 * concerned: there is no analysis, so there is nothing truthful to render.
 *
 * `stalled` is `pending` that has outlasted POLL_LIMIT polls. Kept distinct
 * because the honest message differs: "a few minutes" stops being true after
 * ten, and the aspirant should be offered a retry rather than left watching a
 * spinner that will never resolve if the worker is down.
 */
export type AnalysisPhase = 'loading' | 'pending' | 'stalled' | 'ready' | 'failed' | 'unreachable';

/**
 * Poll quickly at first, then settle down.
 *
 * Most reports are opened from History long after they were generated, or a
 * few seconds after a dispatch — both resolve in the fast window. Only a
 * genuinely fresh, large attempt reaches the slow one, and there is no point
 * asking every 5 seconds about a pipeline that will take minutes.
 */
export const FAST_POLL_MS = 5000;
export const SLOW_POLL_MS = 15000;
export const FAST_POLLS = 12;

export function pollDelayMs(polls: number): number {
  return polls < FAST_POLLS ? FAST_POLL_MS : SLOW_POLL_MS;
}

/**
 * How many "nothing yet" responses to accept before calling it stalled.
 *
 * Sized against what generation actually costs, not picked round: the pipeline
 * runs six stages in sequence — Mistake DNA (chunked, 4 at a time), Diagnosis,
 * topic diagnoses, subject diagnoses, diagnostic insights (chunked), and the
 * weekly plan — and a 200-question attempt with a hundred-odd wrong answers
 * takes several minutes of that, longer if a stage retries.
 *
 * Measured in production at upwards of ten minutes for a full 200-question
 * paper, which is what the waiting card now tells the aspirant to expect. The
 * stall threshold has to sit well beyond the normal case, not at it: with the
 * schedule above this is 12x5s + 78x15s ≈ 20 minutes, so a run that is merely
 * slow finishes normally and only a genuinely stuck one reaches "still working
 * on your report".
 *
 * Earlier values got this wrong twice — 45 polls at a flat 8s gave 6 minutes,
 * then 60 gave 13 — both close enough to the real duration that a normal run
 * could trip the stall message and invite a Retry that starts a second task
 * alongside the one already working.
 */
export const POLL_LIMIT = 90;

/**
 * Consecutive fetch failures tolerated before giving up. One transient 502 —
 * a backend restarting mid-deploy, a dropped connection — must not end the
 * wait for a report that is generating perfectly well.
 */
export const FAILURE_LIMIT = 3;

export interface PollState {
  /** Successful responses that said "nothing yet". */
  polls: number;
  /** Fetch failures since the last successful response. */
  failures: number;
}

export const initialPollState: PollState = { polls: 0, failures: 0 };

export type PollEvent =
  | { type: 'response'; status: string }
  | { type: 'error' };

export interface PollStep {
  phase: AnalysisPhase;
  state: PollState;
  /** Schedule another poll? False on every terminal phase. */
  continuePolling: boolean;
  /** How long to wait before that poll. Meaningless when `continuePolling` is false. */
  delayMs: number;
  /** Dispatch generation, if it hasn't been dispatched already this cycle. */
  dispatch: boolean;
}

export function pollStep(state: PollState, event: PollEvent): PollStep {
  if (event.type === 'error') {
    const failures = state.failures + 1;
    if (failures >= FAILURE_LIMIT) {
      return {
        phase: 'unreachable',
        state: { ...state, failures },
        continuePolling: false,
        delayMs: 0,
        dispatch: false,
      };
    }
    // Keep waiting. The analysis may well be generating fine behind a blip in
    // the endpoint that reports on it.
    return {
      phase: 'pending',
      state: { ...state, failures },
      continuePolling: true,
      delayMs: pollDelayMs(state.polls),
      dispatch: false,
    };
  }

  // A successful response clears the failure streak: whatever was wrong is
  // over, and a later blip should get the full tolerance again rather than
  // inheriting a count from minutes ago.
  const cleared: PollState = { ...state, failures: 0 };

  if (event.status === 'ready') {
    return { phase: 'ready', state: cleared, continuePolling: false, delayMs: 0, dispatch: false };
  }
  if (event.status === 'failed') {
    return { phase: 'failed', state: cleared, continuePolling: false, delayMs: 0, dispatch: false };
  }

  // not_started, generating, and anything a future backend invents: there is
  // no analysis, so there is no report. An unrecognised status deliberately
  // lands here rather than being treated as ready — the one safe default.
  const polls = cleared.polls + 1;
  if (polls >= POLL_LIMIT) {
    return { phase: 'stalled', state: { ...cleared, polls }, continuePolling: false, delayMs: 0, dispatch: true };
  }
  return {
    phase: 'pending',
    state: { ...cleared, polls },
    continuePolling: true,
    delayMs: pollDelayMs(polls),
    dispatch: true,
  };
}
