/**
 * How much report a paper can honestly carry.
 *
 * The diagnostic report was written for a full mock: 200 questions spread over
 * twelve subjects and three difficulties, where a subject breakdown, a coverage
 * matrix and a ranked plan all have something to compare. Run the same report
 * over a 30-question unit set pitched at one difficulty and every one of those
 * panels degenerates — the subject chart is a single bar, the difficulty split is
 * a single row, and "coverage" reports that you covered the one unit you sat.
 *
 * Those panels are not merely redundant there. They imply a comparison the paper
 * cannot support, which is worse than leaving them out. So the report comes in
 * three depths, chosen from what the paper actually covered.
 */
import type { AttemptReportModel } from '@/lib/attempt-report';

export type ReportDepth = 'brief' | 'section' | 'full';

/** What each depth is for, in one line — shown on the report itself. */
export const DEPTH_NOTE: Record<ReportDepth, string> = {
  brief: 'A practice set on one unit — your score and every question, reviewed.',
  section: 'A full section — how you did across its units, and every question.',
  full: 'A full-length paper — the complete diagnostic.',
};

/**
 * The placement an attempt came from, as far as it is known.
 *
 * Every field is optional because the backend does not yet return placement on an
 * attempt (see BACKEND_WORK.md). Where it does, it decides; where it does not,
 * the shape of the paper is read off the questions instead.
 */
export interface AttemptPlacement {
  /** 'mock' | 'practice' — already on every attempt as `test_mode`. */
  track?: string | null;
  /** 'unit' | 'section' — only once the backend sends it. */
  scope?: string | null;
  /** Present on a unit-wise paper. */
  unitId?: string | null;
  /** Present on a section-wise paper. */
  sectionName?: string | null;
}

/**
 * Which report an attempt gets.
 *
 * Explicit placement wins. Without it the subject spread is the best available
 * signal: a unit paper draws on one subject, a section paper on several, and a
 * mock on all of them. The fallback can only over-deliver — a unit that happens
 * to span two catalog subjects (Group 4's Unit III covers two) reads as a section
 * and gets a slightly fuller report, which is a far better failure than cutting a
 * real section report down to a score.
 */
export function reportDepth(
  placement: AttemptPlacement | null | undefined,
  model: Pick<AttemptReportModel, 'subjects'> | null | undefined,
): ReportDepth {
  const track = placement?.track?.trim().toLowerCase() ?? null;
  const scope = placement?.scope?.trim().toLowerCase() ?? null;

  // A mock is the whole paper, whatever else is or is not tagged on it.
  if (track === 'mock') return 'full';

  if (scope === 'unit') return 'brief';
  if (scope === 'section') return 'section';

  // Not tagged as either, but something names one of them.
  if (placement?.unitId) return 'brief';
  if (placement?.sectionName) return 'section';

  // Nothing explicit. A practice paper is read from its subject spread.
  const subjects = model?.subjects?.length ?? 0;
  if (track === 'practice') return subjects <= 1 ? 'brief' : 'section';

  // Track unknown — an eval assessment sat outside the TNPSC tracks, say. The
  // full report is the long-standing behaviour and the safe default: it shows
  // more than a short paper needs rather than hiding something a long one has.
  return subjects <= 1 ? 'brief' : 'full';
}

/** Whether a depth includes a given panel. One table, so the rules stay comparable. */
const PANELS = {
  /** Score, accuracy, attempt rate. Every report has it. */
  summary: ['brief', 'section', 'full'],
  /** Per-question review — the thing an aspirant actually reads after practice. */
  questions: ['brief', 'section', 'full'],
  /** Needs more than one subject to say anything. */
  subjectPerformance: ['section', 'full'],
  /** Where the marks were lost. Useful once there is more than one place to lose them. */
  errorAnalysis: ['section', 'full'],
  /** The full cover sheet, radar, coverage matrix, strengths/gaps and plan. */
  diagnostics: ['full'],
} as const satisfies Record<string, readonly ReportDepth[]>;

export type ReportPanel = keyof typeof PANELS;

export function showsPanel(depth: ReportDepth, panel: ReportPanel): boolean {
  return (PANELS[panel] as readonly ReportDepth[]).includes(depth);
}
