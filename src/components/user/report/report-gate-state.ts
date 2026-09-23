/**
 * The decision behind `ReportGate` — whether a report screen may render, and
 * if not, what to say instead.
 *
 * Pure and separate from the component because this is the part that must be
 * right: it is the single rule standing between an aspirant and a screen full
 * of content that was never generated from their attempt. Keeping it out of
 * the JSX means it can be reasoned about, and tested, as a plain table.
 */
import type { AnalysisPhase } from '@/lib/analysis-poll';
import type { AttemptAnalysisResponse } from '@/lib/userPortalApi';

export type GateState =
  /** Still asking the backend what it has. A plain spinner — too short-lived to justify a message. */
  | { kind: 'spinner' }
  /**
   * Nothing generated yet. `not_started`, `generating`, or a dispatch that has
   * just gone out. `emphasis` is the part of `body` the card highlights — the
   * expected wait, called out so nobody sits watching a spinner wondering
   * whether it is stuck.
   */
  | { kind: 'waiting'; title: string; body: string; emphasis: string }
  /** Generated, or generating, but this screen's own section is still missing. */
  | { kind: 'section-waiting'; title: string; body: string }
  /** Something is wrong and the aspirant should be offered a retry. */
  | { kind: 'error'; title: string; body: string; retryLabel: string }
  /** The analysis is here. Render the screen. */
  | { kind: 'ready' };

export function gateState(
  phase: AnalysisPhase,
  analysis: AttemptAnalysisResponse | null,
  section?: keyof AttemptAnalysisResponse,
): GateState {
  if (phase === 'loading') return { kind: 'spinner' };

  if (phase === 'pending') {
    return {
      kind: 'waiting',
      title: 'Preparing your report',
      // "a few minutes" was measured and wrong: the pipeline runs six LLM
      // stages in sequence and a full 200-question paper takes upwards of ten.
      // Understating it makes a normal run look broken, which is worse than a
      // long number honestly stated.
      emphasis: 'This usually takes around 10 minutes.',
      body:
        "We're analysing every answer from this attempt — what you got wrong, why, and what to do about it. " +
        'You can stay on this page or come back later; it updates by itself as soon as the analysis is ready.',
    };
  }

  if (phase === 'unreachable') {
    return {
      kind: 'error',
      title: "Couldn't reach the analysis service",
      body:
        'Your answers are safe — only the analysis could not be fetched just now. ' +
        'Check your connection and try again.',
      retryLabel: 'Try again',
    };
  }

  if (phase === 'stalled') {
    return {
      kind: 'error',
      title: 'Still working on your report',
      body:
        'This is taking longer than usual. Your attempt is saved and the analysis will keep running — ' +
        'come back in a little while, or start it again now.',
      retryLabel: 'Start it again',
    };
  }

  if (phase === 'failed') {
    return {
      kind: 'error',
      title: "The report couldn't be generated",
      body:
        'Something went wrong while analysing this attempt. Your answers and score are unaffected. ' +
        'Starting it again usually works.',
      retryLabel: 'Generate it again',
    };
  }

  // phase === 'ready'. The pipeline has produced *something*: the backend
  // reports "ready" as soon as any one section lands, so a screen built around
  // one section has to check for that section itself.
  if (section) {
    if (analysis?.section_status?.[section as string] === 'failed') {
      return {
        kind: 'error',
        title: "This part of the report couldn't be generated",
        body:
          'The rest of your report is ready — use the tabs above. This section alone failed to generate; ' +
          'starting it again usually works.',
        retryLabel: 'Generate it again',
      };
    }
    // Presence, not truthiness: a section can legitimately be an empty array
    // (no topic diagnoses because nothing qualified) and that is a real,
    // finished answer, not a missing one.
    if (analysis?.[section] === undefined) {
      return {
        kind: 'section-waiting',
        title: 'This part is still being prepared',
        body:
          'The rest of your report is ready — use the tabs above. This section is still being analysed ' +
          'and will appear here shortly.',
      };
    }
  }

  return { kind: 'ready' };
}
