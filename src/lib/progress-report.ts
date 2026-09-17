/**
 * Normalized Progress Report model — the multi-attempt companion to
 * `attempt-report.ts`.
 *
 * Where This Attempt answers "what happened in this test", this answers "how has
 * performance evolved and what should I do next" (§2 of the Progress Report spec).
 *
 * The non-negotiable principle: every displayed fact is traceable to stored
 * assessment records or to a transparent calculation over them. Nothing is
 * estimated. Where evidence is missing the model returns an explicit state and the
 * UI drops the dependent claim rather than softening it into a guess (§3, §19).
 *
 * Canonical metrics are imported from the attempt model rather than re-derived —
 * two definitions of "attempted" would eventually disagree, and §20.2 requires the
 * arithmetic to reconcile.
 */
import { isAttempted, metricsFor, type NodeMetrics } from './attempt-report';
import type { AttemptDetailResponse, ApiAttempt, QuestionReviewItem } from './userPortalApi';

// ─── Configuration (§10, §13, §14 — all thresholds are config, not truth) ──────

export interface ProgressConfig {
  /** Attempted questions before a subject figure is treated as evidence. */
  minEvidence: number;
  /** Latest accuracy at or above this, with evidence, is a strength (§10). */
  strengthAccuracy: number;
  /** Below this in the latest attempt is a gap (§10). */
  gapAccuracy: number;
  /** Percentage-point move that counts as improving or declining (§10). */
  movementPoints: number;
  /** Score % the readiness model treats as exam-ready. Not an official cut-off. */
  targetScorePct: number;
  /** Accuracy the readiness model treats as exam-ready. */
  targetAccuracy: number;
  /** Active priorities; the rest queue (§19). */
  maxActivePriorities: number;
  /** Readiness component weights (§13). Re-normalized when a component is unavailable. */
  readinessWeights: {
    performance: number;
    accuracy: number;
    coverage: number;
    consistency: number;
    gapClosure: number;
    behaviour: number;
  };
  /** Grade bands, high to low. Product configuration (§13). */
  gradeBands: Array<{ min: number; grade: string; label: string }>;
}

export const DEFAULT_PROGRESS_CONFIG: ProgressConfig = {
  minEvidence: 5,
  strengthAccuracy: 75,
  gapAccuracy: 50,
  movementPoints: 10,
  targetScorePct: 60,
  targetAccuracy: 70,
  maxActivePriorities: 4,
  readinessWeights: {
    performance: 30,
    accuracy: 20,
    coverage: 15,
    consistency: 15,
    gapClosure: 10,
    behaviour: 10,
  },
  gradeBands: [
    { min: 85, grade: 'A+', label: 'Exam ready' },
    { min: 70, grade: 'A', label: 'Strong' },
    { min: 55, grade: 'B', label: 'Developing' },
    { min: 40, grade: 'C', label: 'Building' },
    { min: 0, grade: 'D', label: 'Early stage' },
  ],
};

// ─── States ────────────────────────────────────────────────────────────────────

/** §10 trend classification. Deterministic, never a judgement call. */
export type TrendStatus =
  | 'STRENGTH'
  | 'IMPROVING'
  | 'STABLE'
  | 'DECLINING'
  | 'PERSISTENT_GAP'
  | 'NEW_GAP'
  | 'INSUFFICIENT_EVIDENCE'
  | 'NOT_TESTED';

/** §11 gap lifecycle. */
export type GapState = 'RESOLVED' | 'IMPROVING' | 'PERSISTENT' | 'NEW';

export type PlanBucket = 'REPAIR' | 'IMPROVE' | 'MAINTAIN' | 'VALIDATE' | 'EXAM_BEHAVIOUR';

// ─── Shapes ────────────────────────────────────────────────────────────────────

export interface AttemptPoint {
  attemptId: string;
  label: string;
  date: string;
  score: number | null;
  maxScore: number | null;
  /** Normalized, so attempts with different maxima stay comparable (§5, §20.5). */
  scorePct: number | null;
  correct: number;
  incorrect: number;
  unattempted: number;
  totalQuestions: number;
  accuracyPct: number | null;
  attemptRatePct: number | null;
  /** False when question detail could not be loaded — counts come from headline only. */
  detailed: boolean;
}

export interface SubjectAttemptMetric {
  attemptId: string;
  label: string;
  metrics: NodeMetrics;
}

export interface SubjectProgress {
  subjectId: string;
  name: string;
  /** One entry per attempt that tested this subject. */
  series: SubjectAttemptMetric[];
  first: NodeMetrics | null;
  latest: NodeMetrics | null;
  /** Best normalized accuracy across the series. */
  bestAccuracy: number | null;
  /** Latest minus first, in percentage points (§5 — points, not percent growth). */
  deltaPoints: number | null;
  status: TrendStatus;
  /** Total attempted across the window, the sample the status rests on. */
  evidenceCount: number;
  attemptsObserved: number;
  /** One sentence naming the movement and the evidence behind it. */
  interpretation: string;
}

export interface GapRow {
  subjectId: string;
  name: string;
  firstAccuracy: number | null;
  latestAccuracy: number | null;
  deltaPoints: number | null;
  attemptsObserved: number;
  latestSample: number;
  state: GapState;
  evidence: string;
}

export interface ReadinessComponent {
  key: string;
  label: string;
  /** 0–100 on its own scale. */
  value: number;
  /** Weight after re-normalization, so the shown weights always sum to 100. */
  weight: number;
  evidence: string;
}

export interface Readiness {
  score: number;
  grade: string;
  label: string;
  components: ReadinessComponent[];
  /** The two components holding the grade back. */
  blockers: ReadinessComponent[];
  /** The two carrying it. */
  strengths: ReadinessComponent[];
  /** What would move the student into the next band. */
  nextBand: string | null;
}

export interface PlanPriority {
  subjectId: string;
  name: string;
  rank: number;
  /** 0–100 (§14.1). */
  score: number;
  bucket: PlanBucket;
  components: {
    performanceGap: number;
    persistence: number;
    recentDecline: number;
    marksExposure: number;
    sampleAdequacy: number;
  };
  evidence: string;
  action: string;
  /** Minutes per session, allocated by priority — never a flat figure (§14.3, §15). */
  minutesPerSession: number;
  sessionsPerWeek: number;
  questionTarget: number;
  successCriterion: string;
  escalation: string;
}

export interface ProgressNarrative {
  /** §7 / §16.3 — trajectory, drivers, constraints, behaviour, implication. */
  trajectory: string[];
  improvementDrivers: string[];
  persistentGaps: string[];
  newOrDeclining: string[];
  behaviour: string[];
  studentMessage: string;
}

export interface ProgressReportModel {
  window: {
    attempts: number;
    firstDate: string | null;
    latestDate: string | null;
    /** How many attempts carried question-level detail. */
    detailedAttempts: number;
  };
  /** §19 — one attempt shows a baseline, two show direction, three-plus a trend. */
  comparability: 'BASELINE_ONLY' | 'DIRECTION_ONLY' | 'TREND';
  attempts: AttemptPoint[];
  headline: {
    latestScore: number | null;
    latestMax: number | null;
    latestScorePct: number | null;
    bestScorePct: number | null;
    bestAttemptLabel: string | null;
    /** Percentage points, first → latest. Never expressed as percent growth (§7). */
    scoreDeltaPoints: number | null;
    /** Raw marks difference, stated separately so the two are never conflated. */
    scoreDeltaMarks: number | null;
    latestAccuracy: number | null;
    accuracyDeltaPoints: number | null;
    latestAttemptRate: number | null;
    attemptRateDeltaPoints: number | null;
  };
  subjects: SubjectProgress[];
  gaps: { resolved: GapRow[]; improving: GapRow[]; persistent: GapRow[]; new: GapRow[] };
  readiness: Readiness | null;
  priorities: PlanPriority[];
  queuedPriorities: PlanPriority[];
  narrative: ProgressNarrative;
  /** §8 — the takeaway printed under the journey chart, built from the points. */
  journeyTakeaway: string;
  /** The short checklist beside the journey chart, each line a measured movement. */
  keyTakeaways: string[];
  /**
   * Difficulty performance aggregated across the window (§12). Available only
   * where the papers actually tag more than one band.
   */
  difficulty: {
    state: 'AVAILABLE' | 'DATA_UNAVAILABLE';
    rows: Array<{ label: string; questions: number; attempted: number; correct: number; accuracy: number | null }>;
    reason: string;
  };
  /** Mean seconds per attempted question across the window, when timing exists. */
  avgTimePerQuestionSec: number | null;
  dataQuality: {
    timingAvailable: boolean;
    difficultyAvailable: boolean;
    taxonomyDepth: 'SUBJECT' | 'TOPIC' | 'SUBTOPIC';
    cohortAvailable: boolean;
    syllabusBlueprintAvailable: boolean;
    undetailedAttempts: number;
    warnings: string[];
  };
  config: ProgressConfig;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

const pct = (part: number, whole: number): number | null =>
  whole > 0 ? Math.round((part / whole) * 1000) / 10 : null;

const pts = (a: number | null, b: number | null): number | null =>
  a == null || b == null ? null : Math.round((a - b) * 10) / 10;

function slug(s: string): string {
  return s.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'untagged';
}

function shortDate(iso: string): string {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

/** Population standard deviation — used for the consistency component only. */
function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length);
}

// ─── Build ─────────────────────────────────────────────────────────────────────

export function buildProgressReport(
  attempts: ApiAttempt[],
  details: Map<string, AttemptDetailResponse>,
  config: Partial<ProgressConfig> = {},
): ProgressReportModel {
  const cfg = { ...DEFAULT_PROGRESS_CONFIG, ...config };
  const warnings: string[] = [];

  // Oldest first — a journey reads left to right.
  const ordered = [...attempts]
    .filter(a => a.status !== 'in_progress')
    .sort((x, y) => +new Date(x.start_time) - +new Date(y.start_time));

  const points: AttemptPoint[] = ordered.map((a, i) => {
    const d = details.get(a.attempt_id);
    const questions = d?.questions ?? [];
    const m = questions.length > 0 ? metricsFor(questions) : null;
    const declaredTotal = d?.performance_breakdown?.overall_distribution?.total ?? null;
    const total = Math.max(m?.questions ?? 0, declaredTotal ?? 0);

    return {
      attemptId: a.attempt_id,
      label: a.test_name ? `${a.test_name}` : `Attempt ${i + 1}`,
      date: a.start_time,
      score: a.score,
      maxScore: (a as any).max_score ?? d?.attempt?.max_score ?? null,
      scorePct: a.percentage ?? d?.attempt?.percentage ?? null,
      correct: m?.correct ?? 0,
      incorrect: m?.incorrect ?? 0,
      unattempted: m ? Math.max(0, total - m.attempted) : 0,
      totalQuestions: total,
      accuracyPct: m?.accuracy ?? null,
      attemptRatePct: m ? pct(m.attempted, total) : null,
      detailed: m != null,
    };
  });

  const detailed = points.filter(p => p.detailed);
  if (detailed.length < points.length) {
    warnings.push(
      `${points.length - detailed.length} of ${points.length} attempts have no question-level detail, so subject and gap analysis covers the rest.`,
    );
  }

  // §19: what the window can honestly claim.
  const comparability: ProgressReportModel['comparability'] =
    points.length <= 1 ? 'BASELINE_ONLY' : points.length === 2 ? 'DIRECTION_ONLY' : 'TREND';

  const first = points[0] ?? null;
  const latest = points[points.length - 1] ?? null;
  const best = points.reduce<AttemptPoint | null>(
    (hi, p) => (p.scorePct == null ? hi : hi == null || p.scorePct > (hi.scorePct ?? -1) ? p : hi),
    null,
  );

  const headline = {
    latestScore: latest?.score ?? null,
    latestMax: latest?.maxScore ?? null,
    latestScorePct: latest?.scorePct ?? null,
    bestScorePct: best?.scorePct ?? null,
    bestAttemptLabel: best?.label ?? null,
    // Points and marks are reported separately — "+96%" for a marks difference is
    // precisely the mislabelling §7 calls out.
    scoreDeltaPoints: pts(latest?.scorePct ?? null, first?.scorePct ?? null),
    scoreDeltaMarks:
      latest?.score != null && first?.score != null ? Math.round((latest.score - first.score) * 10) / 10 : null,
    latestAccuracy: latest?.accuracyPct ?? null,
    accuracyDeltaPoints: pts(latest?.accuracyPct ?? null, first?.accuracyPct ?? null),
    latestAttemptRate: latest?.attemptRatePct ?? null,
    attemptRateDeltaPoints: pts(latest?.attemptRatePct ?? null, first?.attemptRatePct ?? null),
  };

  // ── Subjects across attempts ──
  const subjects = buildSubjectProgress(ordered, details, cfg);

  // ── Data quality, read off what the questions actually carry ──
  const allQuestions: QuestionReviewItem[] = ordered.flatMap(a => details.get(a.attempt_id)?.questions ?? []);
  const timingAvailable = allQuestions.some(q => isAttempted(q) && q.time_spent_seconds > 0);
  const difficultyTags = new Set(
    allQuestions.map(q => (q.difficulty ?? '').trim().toLowerCase()).filter(Boolean),
  );

  const gaps = buildGapEvolution(subjects, cfg);
  const readiness = detailed.length > 0 ? buildReadiness(points, subjects, gaps, cfg) : null;
  const allPriorities = buildPriorities(subjects, gaps, points, cfg);

  return {
    window: {
      attempts: points.length,
      firstDate: first?.date ?? null,
      latestDate: latest?.date ?? null,
      detailedAttempts: detailed.length,
    },
    comparability,
    attempts: points,
    headline,
    subjects,
    gaps,
    readiness,
    priorities: allPriorities.slice(0, cfg.maxActivePriorities),
    queuedPriorities: allPriorities.slice(cfg.maxActivePriorities),
    narrative: buildNarrative(points, headline, subjects, gaps, comparability, cfg),
    journeyTakeaway: buildJourneyTakeaway(points, comparability),
    keyTakeaways: buildKeyTakeaways(points, headline, subjects, comparability),
    difficulty: buildDifficulty(allQuestions),
    avgTimePerQuestionSec: (() => {
      const times = allQuestions.filter(q => isAttempted(q) && q.time_spent_seconds > 0);
      if (times.length === 0) return null;
      return Math.round((times.reduce((n, q) => n + q.time_spent_seconds, 0) / times.length) * 10) / 10;
    })(),
    dataQuality: {
      timingAvailable,
      // One tag across the whole window is not a difficulty dimension (§19).
      difficultyAvailable: difficultyTags.size >= 2,
      taxonomyDepth: 'SUBJECT', // questions carry no topic/sub-topic field
      cohortAvailable: false, // no cohort endpoint — percentile stays hidden (§3)
      syllabusBlueprintAvailable: false, // no per-subject syllabus weights available
      undetailedAttempts: points.length - detailed.length,
      warnings,
    },
    config: cfg,
  };
}

// ─── Subject progress (§10) ────────────────────────────────────────────────────

function buildSubjectProgress(
  ordered: ApiAttempt[],
  details: Map<string, AttemptDetailResponse>,
  cfg: ProgressConfig,
): SubjectProgress[] {
  const bySubject = new Map<string, { name: string; series: SubjectAttemptMetric[] }>();

  ordered.forEach((a, i) => {
    const d = details.get(a.attempt_id);
    if (!d?.questions?.length) return;
    const label = a.test_name ?? `Attempt ${i + 1}`;

    const grouped = new Map<string, QuestionReviewItem[]>();
    for (const q of d.questions) {
      const name = (q.subject ?? '').trim() || 'Untagged';
      grouped.set(slug(name), [...(grouped.get(slug(name)) ?? []), q]);
    }

    for (const [id, items] of grouped) {
      const name = (items[0].subject ?? '').trim() || 'Untagged';
      const entry = bySubject.get(id) ?? { name, series: [] };
      entry.series.push({ attemptId: a.attempt_id, label, metrics: metricsFor(items) });
      bySubject.set(id, entry);
    }
  });

  return [...bySubject.entries()]
    .map(([subjectId, { name, series }]) => {
      // Only attempts where the subject was actually engaged can speak to a trend;
      // an attempt where it was skipped says nothing about ability (§19).
      const measured = series.filter(s => s.metrics.attempted >= cfg.minEvidence);
      const firstM = measured[0]?.metrics ?? null;
      const latestM = measured[measured.length - 1]?.metrics ?? null;
      const evidenceCount = series.reduce((n, s) => n + s.metrics.attempted, 0);

      const accuracies = measured.map(s => s.metrics.accuracy).filter((v): v is number => v != null);
      const bestAccuracy = accuracies.length > 0 ? Math.max(...accuracies) : null;
      const deltaPoints = pts(latestM?.accuracy ?? null, firstM?.accuracy ?? null);

      const status = classifyTrend(series, measured, cfg);

      return {
        subjectId,
        name,
        series,
        first: firstM,
        latest: latestM,
        bestAccuracy,
        deltaPoints,
        status,
        evidenceCount,
        attemptsObserved: series.length,
        interpretation: describeTrend(name, status, firstM, latestM, deltaPoints, measured.length, cfg),
      };
    })
    .sort((a, b) => (b.latest?.questions ?? 0) - (a.latest?.questions ?? 0) || a.name.localeCompare(b.name));
}

/** §10's deterministic rules, applied in priority order. */
function classifyTrend(
  series: SubjectAttemptMetric[],
  measured: SubjectAttemptMetric[],
  cfg: ProgressConfig,
): TrendStatus {
  if (series.length === 0) return 'NOT_TESTED';
  if (measured.length === 0) return 'INSUFFICIENT_EVIDENCE';

  const latest = measured[measured.length - 1].metrics;
  const firstAcc = measured[0].metrics.accuracy;
  const latestAcc = latest.accuracy;
  if (latestAcc == null) return 'INSUFFICIENT_EVIDENCE';

  const delta = firstAcc == null ? null : latestAcc - firstAcc;
  const belowGap = measured.filter(s => (s.metrics.accuracy ?? 100) < cfg.gapAccuracy).length;

  // Strength first — a high latest figure with evidence and no recent slide.
  const recentDecline = delta != null && delta <= -cfg.movementPoints;
  if (latestAcc >= cfg.strengthAccuracy && !recentDecline) return 'STRENGTH';

  if (recentDecline) return 'DECLINING';

  if (latestAcc < cfg.gapAccuracy) {
    // Repeatedly below threshold is persistent; newly below is new.
    if (belowGap >= 2) return 'PERSISTENT_GAP';
    if (measured.length >= 2 && (firstAcc ?? 0) >= cfg.gapAccuracy) return 'NEW_GAP';
    return 'PERSISTENT_GAP';
  }

  if (delta != null && delta >= cfg.movementPoints) return 'IMPROVING';
  return 'STABLE';
}

function describeTrend(
  name: string,
  status: TrendStatus,
  first: NodeMetrics | null,
  latest: NodeMetrics | null,
  delta: number | null,
  measuredAttempts: number,
  cfg: ProgressConfig,
): string {
  const sample = latest ? `${latest.correct}/${latest.attempted} in the latest attempt` : 'no measured attempt';
  const move = delta == null ? '' : ` (${delta > 0 ? '+' : ''}${delta} pp from the first measured attempt)`;

  switch (status) {
    case 'STRENGTH':
      return `${name} is holding at ${latest?.accuracy}%, ${sample}${move}. Maintain rather than rebuild.`;
    case 'IMPROVING':
      return `${name} has moved to ${latest?.accuracy}%${move} — ${sample}. The current approach is working.`;
    case 'DECLINING':
      return `${name} has slipped to ${latest?.accuracy}%${move}, ${sample}. Worth checking what changed.`;
    case 'PERSISTENT_GAP':
      return `${name} has stayed below ${cfg.gapAccuracy}% across ${measuredAttempts} measured attempt${measuredAttempts === 1 ? '' : 's'} — ${sample}.`;
    case 'NEW_GAP':
      return `${name} was holding up earlier but fell to ${latest?.accuracy}% in the latest attempt (${sample}).`;
    case 'STABLE':
      return `${name} is steady at ${latest?.accuracy}%${move}, ${sample}.`;
    case 'INSUFFICIENT_EVIDENCE':
      return `${name} has not been attempted enough times to judge — fewer than ${cfg.minEvidence} questions in any attempt.`;
    default:
      return `${name} has not been tested in this window.`;
  }
}

// ─── Gap evolution (§11) ───────────────────────────────────────────────────────

function buildGapEvolution(subjects: SubjectProgress[], cfg: ProgressConfig): ProgressReportModel['gaps'] {
  const out: ProgressReportModel['gaps'] = { resolved: [], improving: [], persistent: [], new: [] };

  for (const s of subjects) {
    if (s.latest == null || s.first == null) continue;
    const firstAcc = s.first.accuracy;
    const latestAcc = s.latest.accuracy;
    if (firstAcc == null || latestAcc == null) continue;

    const wasGap = firstAcc < cfg.gapAccuracy;
    const isGap = latestAcc < cfg.gapAccuracy;
    const row: GapRow = {
      subjectId: s.subjectId,
      name: s.name,
      firstAccuracy: firstAcc,
      latestAccuracy: latestAcc,
      deltaPoints: s.deltaPoints,
      attemptsObserved: s.attemptsObserved,
      latestSample: s.latest.attempted,
      state: 'PERSISTENT',
      evidence:
        `${firstAcc}% → ${latestAcc}% across ${s.attemptsObserved} attempt${s.attemptsObserved === 1 ? '' : 's'}, ${s.latest.attempted} attempted in the latest` +
        (isGap && (s.deltaPoints ?? 0) > 0
          ? ` — moving in the right direction but still under ${cfg.gapAccuracy}%`
          : ''),
    };

    /**
     * The four states are mutually exclusive and keyed off the same facts as the
     * trend status, so a subject cannot read "persistent gap" in one section and
     * "improving" in another.
     *
     * A gap that is still below threshold stays Persistent even when the number is
     * rising — the movement is reported in the evidence line rather than promoting
     * the row out of the bucket. Improving means it has actually climbed out.
     */
    if (wasGap && latestAcc >= cfg.strengthAccuracy) out.resolved.push({ ...row, state: 'RESOLVED' });
    else if (isGap && !wasGap) out.new.push({ ...row, state: 'NEW' });
    else if (isGap) out.persistent.push({ ...row, state: 'PERSISTENT' });
    else if (wasGap) out.improving.push({ ...row, state: 'IMPROVING' });
  }

  return out;
}

// ─── Readiness (§13) ───────────────────────────────────────────────────────────

function buildReadiness(
  points: AttemptPoint[],
  subjects: SubjectProgress[],
  gaps: ProgressReportModel['gaps'],
  cfg: ProgressConfig,
): Readiness {
  const latest = points[points.length - 1];
  const recent = points.slice(-3);
  const w = cfg.readinessWeights;

  const raw: Array<ReadinessComponent & { available: boolean }> = [];

  // Performance — latest normalized score against the configured target.
  raw.push({
    key: 'performance',
    label: 'Performance level',
    value: latest.scorePct == null ? 0 : Math.min(100, (latest.scorePct / cfg.targetScorePct) * 100),
    weight: w.performance,
    evidence:
      latest.scorePct == null
        ? 'No scored attempt'
        : `${latest.scorePct}% against a ${cfg.targetScorePct}% target`,
    available: latest.scorePct != null,
  });

  raw.push({
    key: 'accuracy',
    label: 'Accuracy',
    value: latest.accuracyPct == null ? 0 : Math.min(100, (latest.accuracyPct / cfg.targetAccuracy) * 100),
    weight: w.accuracy,
    evidence:
      latest.accuracyPct == null
        ? 'Nothing attempted'
        : `${latest.accuracyPct}% against a ${cfg.targetAccuracy}% target`,
    available: latest.accuracyPct != null,
  });

  // Coverage needs a syllabus blueprint to divide by; without one its weight is
  // redistributed rather than guessed (§13 re-normalization).
  raw.push({
    key: 'coverage',
    label: 'Syllabus coverage',
    value: 0,
    weight: w.coverage,
    evidence: 'No syllabus blueprint configured — weight redistributed',
    available: false,
  });

  // Consistency — how tightly recent scores cluster.
  const recentPcts = recent.map(p => p.scorePct).filter((v): v is number => v != null);
  const spread = stdDev(recentPcts);
  raw.push({
    key: 'consistency',
    label: 'Consistency',
    value: recentPcts.length < 2 ? 0 : Math.max(0, 100 - spread * 5),
    weight: w.consistency,
    evidence:
      recentPcts.length < 2
        ? 'Needs at least two scored attempts'
        : `${Math.round(spread * 10) / 10} pp spread across the last ${recentPcts.length}`,
    available: recentPcts.length >= 2,
  });

  const gapTotal =
    gaps.resolved.length + gaps.improving.length + gaps.persistent.length + gaps.new.length;
  raw.push({
    key: 'gapClosure',
    label: 'Gap closure',
    value: gapTotal === 0 ? 0 : ((gaps.resolved.length + gaps.improving.length) / gapTotal) * 100,
    weight: w.gapClosure,
    evidence:
      gapTotal === 0
        ? 'No comparable gaps yet'
        : `${gaps.resolved.length} resolved and ${gaps.improving.length} improving of ${gapTotal}`,
    available: gapTotal > 0,
  });

  raw.push({
    key: 'behaviour',
    label: 'Attempt management',
    value: latest.attemptRatePct ?? 0,
    weight: w.behaviour,
    evidence: latest.attemptRatePct == null ? 'No attempt data' : `${latest.attemptRatePct}% of the paper attempted`,
    available: latest.attemptRatePct != null,
  });

  const usable = raw.filter(c => c.available);
  const totalWeight = usable.reduce((n, c) => n + c.weight, 0) || 1;
  const components: ReadinessComponent[] = usable.map(c => ({
    key: c.key,
    label: c.label,
    value: Math.round(c.value * 10) / 10,
    weight: Math.round((c.weight / totalWeight) * 1000) / 10,
    evidence: c.evidence,
  }));

  const score = Math.round(
    components.reduce((sum, c) => sum + (c.value * c.weight) / 100, 0) * 10,
  ) / 10;

  const band = cfg.gradeBands.find(b => score >= b.min) ?? cfg.gradeBands[cfg.gradeBands.length - 1];
  const ranked = [...components].sort((a, b) => a.value - b.value);
  const nextBandEntry = [...cfg.gradeBands].reverse().find(b => b.min > score) ?? null;

  return {
    score,
    grade: band.grade,
    label: band.label,
    components,
    blockers: ranked.slice(0, 2),
    strengths: ranked.slice(-2).reverse(),
    nextBand: nextBandEntry
      ? `${Math.round((nextBandEntry.min - score) * 10) / 10} points of readiness would reach ${nextBandEntry.grade} (${nextBandEntry.label}). The fastest route is ${ranked[0]?.label.toLowerCase()}.`
      : null,
  };
}

// ─── Priorities and plan (§14) ─────────────────────────────────────────────────

/**
 * §14.1's weighted score: performance gap, persistence, recent decline, marks
 * exposure, sample adequacy. Exam weight is unavailable (no blueprint), so its
 * share is folded into marks exposure measured from the test itself.
 */
function buildPriorities(
  subjects: SubjectProgress[],
  gaps: ProgressReportModel['gaps'],
  points: AttemptPoint[],
  cfg: ProgressConfig,
): PlanPriority[] {
  const latestTotal = Math.max(1, points[points.length - 1]?.totalQuestions ?? 1);
  const persistentIds = new Set(gaps.persistent.map(g => g.subjectId));
  const newIds = new Set(gaps.new.map(g => g.subjectId));

  const scored = subjects
    .filter(s => s.latest != null || s.status === 'INSUFFICIENT_EVIDENCE')
    .map(s => {
      const latest = s.latest;
      const acc = latest?.accuracy ?? 0;
      const questions = latest?.questions ?? s.series[s.series.length - 1]?.metrics.questions ?? 0;

      const performanceGap =
        s.status === 'INSUFFICIENT_EVIDENCE' ? 0 : Math.max(0, cfg.strengthAccuracy - acc) / cfg.strengthAccuracy;
      const persistence = persistentIds.has(s.subjectId) ? 1 : 0;
      const recentDecline = s.status === 'DECLINING' || newIds.has(s.subjectId) ? 1 : 0;
      const marksExposure = Math.min(1, questions / latestTotal);
      const sampleAdequacy = Math.min(1, (latest?.attempted ?? 0) / cfg.minEvidence);

      const score =
        30 * performanceGap +
        20 * persistence +
        15 * recentDecline +
        25 * marksExposure + // exam-weight share folded in; no blueprint available
        10 * sampleAdequacy;

      const bucket = bucketFor(s, persistence === 1);
      const plan = planFor(s, bucket, score, cfg);

      return {
        subjectId: s.subjectId,
        name: s.name,
        rank: 0,
        score: Math.round(score * 10) / 10,
        bucket,
        components: { performanceGap, persistence, recentDecline, marksExposure, sampleAdequacy },
        evidence: gapEvidence(s, cfg),
        ...plan,
      };
    });

  return scored
    .filter(p => p.bucket !== 'MAINTAIN' || p.score > 20)
    .sort((a, b) => b.score - a.score)
    .map((p, i) => ({ ...p, rank: i + 1 }));
}

function bucketFor(s: SubjectProgress, persistent: boolean): PlanBucket {
  if (s.status === 'INSUFFICIENT_EVIDENCE' || s.status === 'NOT_TESTED') return 'VALIDATE';
  if (s.status === 'STRENGTH') return 'MAINTAIN';
  if (persistent || s.status === 'PERSISTENT_GAP') return 'REPAIR';
  if (s.status === 'DECLINING' || s.status === 'NEW_GAP') return 'IMPROVE';
  return 'IMPROVE';
}

function gapEvidence(s: SubjectProgress, cfg: ProgressConfig): string {
  if (s.latest == null) return `Not enough attempted questions to measure ${s.name}.`;
  const move =
    s.deltaPoints == null ? '' : ` (${s.deltaPoints > 0 ? '+' : ''}${s.deltaPoints} pp since the first attempt)`;
  return `${s.name} latest accuracy ${s.latest.accuracy}% across ${s.latest.attempted} attempted questions${move}; below ${cfg.strengthAccuracy}% in ${s.series.filter(x => (x.metrics.accuracy ?? 100) < cfg.strengthAccuracy).length} of ${s.attemptsObserved} attempts.`;
}

/**
 * Time, volume and success criteria scale with the priority score and the bucket.
 * §14.3 forbids a flat allocation, and §20.14 tests that durations differ.
 */
function planFor(
  s: SubjectProgress,
  bucket: PlanBucket,
  score: number,
  cfg: ProgressConfig,
): Pick<PlanPriority, 'action' | 'minutesPerSession' | 'sessionsPerWeek' | 'questionTarget' | 'successCriterion' | 'escalation'> {
  const acc = s.latest?.accuracy ?? 0;
  // 15 minutes at the bottom of the range, 60 at the top — never the same for two
  // differently-scored priorities.
  const minutes = Math.round(Math.min(60, Math.max(15, 15 + score * 0.55)) / 5) * 5;
  const questions = Math.round(minutes * (bucket === 'REPAIR' ? 0.6 : 1.0));
  const target = Math.min(cfg.strengthAccuracy, Math.round(acc + cfg.movementPoints));

  switch (bucket) {
    case 'REPAIR':
      return {
        action: `Concept revision on ${s.name}, then worked examples, then ${questions} targeted questions with every wrong answer reviewed.`,
        minutesPerSession: minutes,
        sessionsPerWeek: score >= 60 ? 3 : 2,
        questionTarget: questions,
        successCriterion: `≥ ${target}% on a fresh ${Math.max(10, Math.round(questions / 2))}-question set.`,
        escalation: `If below ${target}%, keep ${s.name} in Repair and run another concept-plus-practice cycle before adding volume.`,
      };
    case 'IMPROVE':
      return {
        action: `Focused ${s.name} practice — ${questions} questions, then review every error and revisit in 3 days.`,
        minutesPerSession: minutes,
        sessionsPerWeek: 2,
        questionTarget: questions,
        successCriterion: `≥ ${target}% accuracy across two consecutive sets.`,
        escalation: `If accuracy does not move, drop back to concept revision rather than repeating practice.`,
      };
    case 'MAINTAIN':
      return {
        action: `Keep ${s.name} warm with one mixed set of ${questions} questions — no concept revision needed.`,
        minutesPerSession: Math.min(25, minutes),
        sessionsPerWeek: 1,
        questionTarget: questions,
        successCriterion: `Hold at or above ${Math.round(acc)}%.`,
        escalation: `If it slips more than ${cfg.movementPoints} pp, move ${s.name} to Improve.`,
      };
    case 'VALIDATE':
      return {
        action: `Short ${s.name} diagnostic set of ${Math.max(15, Math.round(questions / 2))} questions to establish a baseline before committing study time.`,
        minutesPerSession: Math.min(30, minutes),
        sessionsPerWeek: 1,
        questionTarget: Math.max(15, Math.round(questions / 2)),
        successCriterion: `Enough attempted questions to classify ${s.name} with confidence.`,
        escalation: `Once measured, ${s.name} moves into Repair, Improve or Maintain on its result.`,
      };
    default:
      return {
        action: `Timed ${s.name} sets with a skip-and-return strategy.`,
        minutesPerSession: minutes,
        sessionsPerWeek: 2,
        questionTarget: questions,
        successCriterion: `Attempt rate above ${cfg.targetAccuracy}% without accuracy falling.`,
        escalation: `If accuracy drops as volume rises, slow down and rebuild selection judgement.`,
      };
  }
}

// ─── Narrative (§7, §16.3) ─────────────────────────────────────────────────────

/**
 * §8's key takeaways — two to four lines, each naming a movement the chart shows.
 *
 * Deliberately short and quantified: a takeaway that could be true of any student
 * ("keep practising") is the thing the spec is trying to eliminate.
 */
function buildKeyTakeaways(
  points: AttemptPoint[],
  headline: ProgressReportModel['headline'],
  subjects: SubjectProgress[],
  comparability: ProgressReportModel['comparability'],
): string[] {
  if (comparability === 'BASELINE_ONLY' || points.length < 2) {
    return ['A second attempt is needed before any movement can be reported.'];
  }

  const out: string[] = [];
  const sd = headline.scoreDeltaPoints;
  if (sd != null) {
    out.push(
      sd > 0
        ? `Your score is up ${sd} points since the first attempt${headline.scoreDeltaMarks != null ? ` (${headline.scoreDeltaMarks > 0 ? '+' : ''}${headline.scoreDeltaMarks} marks)` : ''}.`
        : sd < 0
          ? `Your score is down ${Math.abs(sd)} points since the first attempt.`
          : 'Your score is level with your first attempt.',
    );
  }

  const ad = headline.accuracyDeltaPoints;
  if (ad != null && headline.latestAccuracy != null) {
    out.push(
      ad === 0
        ? `Accuracy is holding at ${headline.latestAccuracy}%.`
        : `Accuracy has moved ${ad > 0 ? 'up' : 'down'} ${Math.abs(ad)} points to ${headline.latestAccuracy}%.`,
    );
  }

  const rd = headline.attemptRateDeltaPoints;
  if (rd != null && headline.latestAttemptRate != null) {
    out.push(
      rd > 0
        ? `You are reaching more of the paper — attempt rate up ${rd} points to ${headline.latestAttemptRate}%.`
        : rd < 0
          ? `You are reaching less of the paper — attempt rate down ${Math.abs(rd)} points to ${headline.latestAttemptRate}%.`
          : `Attempt rate is steady at ${headline.latestAttemptRate}%.`,
    );
  }

  const best = subjects
    .filter(x => (x.deltaPoints ?? 0) > 0)
    .sort((a, b) => (b.deltaPoints ?? 0) - (a.deltaPoints ?? 0))[0];
  if (best) {
    out.push(`${best.name} has gained the most: ${best.first?.accuracy}% → ${best.latest?.accuracy}%.`);
  }

  return out.slice(0, 4);
}

/** Difficulty bands across the whole window, where the papers tag more than one. */
function buildDifficulty(questions: QuestionReviewItem[]): ProgressReportModel['difficulty'] {
  const order = ['easy', 'medium', 'hard'];
  const groups = new Map<string, QuestionReviewItem[]>();
  for (const q of questions) {
    const key = (q.difficulty ?? '').trim().toLowerCase();
    if (!key) continue;
    groups.set(key, [...(groups.get(key) ?? []), q]);
  }

  const rows = [...groups.entries()]
    .sort(([a], [b]) => {
      const ia = order.indexOf(a);
      const ib = order.indexOf(b);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    })
    .map(([key, items]) => {
      const m = metricsFor(items);
      return {
        label: key.charAt(0).toUpperCase() + key.slice(1),
        questions: m.questions,
        attempted: m.attempted,
        correct: m.correct,
        accuracy: m.accuracy,
      };
    });

  return {
    state: rows.length >= 2 ? 'AVAILABLE' : 'DATA_UNAVAILABLE',
    rows,
    reason:
      rows.length === 1
        ? `Every question across these attempts is tagged "${rows[0].label}", so performance cannot be compared across difficulty bands.`
        : 'These attempts carry no difficulty tag on their questions.',
  };
}

function buildJourneyTakeaway(points: AttemptPoint[], comparability: ProgressReportModel['comparability']): string {
  if (points.length === 0) return 'No submitted attempts yet.';
  if (comparability === 'BASELINE_ONLY') {
    const only = points[0];
    return `One attempt so far — ${only.scorePct ?? '—'}% on ${shortDate(only.date)}. A second attempt is needed before any trend can be read.`;
  }

  const scored = points.filter(p => p.scorePct != null);
  if (scored.length < 2) return 'Not enough scored attempts to describe a trend.';

  let rises = 0;
  for (let i = 1; i < scored.length; i++) {
    if ((scored[i].scorePct ?? 0) > (scored[i - 1].scorePct ?? 0)) rises += 1;
  }
  const first = scored[0];
  const last = scored[scored.length - 1];
  const delta = Math.round(((last.scorePct ?? 0) - (first.scorePct ?? 0)) * 10) / 10;

  if (comparability === 'DIRECTION_ONLY') {
    const dir = delta > 0 ? 'up' : delta < 0 ? 'down' : 'level';
    return `Two attempts: ${first.scorePct}% then ${last.scorePct}% — ${dir} ${Math.abs(delta)} points. Direction only; a third attempt is needed before calling it a trend.`;
  }

  return `Score improved in ${rises} of the last ${scored.length - 1} transitions, moving ${delta > 0 ? '+' : ''}${delta} points from ${first.scorePct}% to ${last.scorePct}%.`;
}

function buildNarrative(
  points: AttemptPoint[],
  headline: ProgressReportModel['headline'],
  subjects: SubjectProgress[],
  gaps: ProgressReportModel['gaps'],
  comparability: ProgressReportModel['comparability'],
  cfg: ProgressConfig,
): ProgressNarrative {
  const trajectory: string[] = [];

  if (comparability === 'BASELINE_ONLY') {
    trajectory.push(
      `This is a baseline from a single attempt${headline.latestScorePct != null ? ` at ${headline.latestScorePct}%` : ''}. Progress needs a second attempt before anything can be compared.`,
    );
  } else {
    const n = points.length;
    const sd = headline.scoreDeltaPoints;
    const ad = headline.accuracyDeltaPoints;
    trajectory.push(
      `Across ${n} attempts your normalized score moved from ${points[0].scorePct}% to ${headline.latestScorePct}%${sd != null ? ` (${sd > 0 ? '+' : ''}${sd} pp)` : ''}${
        ad != null ? `, and accuracy moved ${ad > 0 ? '+' : ''}${ad} pp to ${headline.latestAccuracy}%` : ''
      }.`,
    );
    if (headline.scoreDeltaMarks != null) {
      trajectory.push(
        `In raw marks that is ${headline.scoreDeltaMarks > 0 ? '+' : ''}${headline.scoreDeltaMarks} on the latest paper — marks and percentage points are different measures and are shown separately.`,
      );
    }
  }

  const drivers = subjects
    .filter(s => s.status === 'IMPROVING' || s.status === 'STRENGTH')
    .sort((a, b) => (b.deltaPoints ?? 0) - (a.deltaPoints ?? 0))
    .slice(0, 3)
    .map(s =>
      s.deltaPoints != null && s.deltaPoints !== 0
        ? `${s.name}: ${s.first?.accuracy}% → ${s.latest?.accuracy}% (${s.deltaPoints > 0 ? '+' : ''}${s.deltaPoints} pp)`
        : `${s.name}: holding at ${s.latest?.accuracy}%`,
    );

  const persistent = gaps.persistent
    .slice(0, 3)
    .map(g => `${g.name}: below ${cfg.gapAccuracy}% across ${g.attemptsObserved} attempts (${g.evidence})`);

  const newOrDeclining = [
    ...gaps.new.map(g => `${g.name} newly fell to ${g.latestAccuracy}% in the latest attempt`),
    ...subjects
      .filter(s => s.status === 'DECLINING')
      .map(s => `${s.name} declined ${Math.abs(s.deltaPoints ?? 0)} pp to ${s.latest?.accuracy}%`),
  ].slice(0, 3);

  const behaviour: string[] = [];
  if (headline.attemptRateDeltaPoints != null && headline.latestAttemptRate != null) {
    const d = headline.attemptRateDeltaPoints;
    behaviour.push(
      `Attempt rate ${d > 0 ? 'rose' : d < 0 ? 'fell' : 'held'} ${d !== 0 ? `${Math.abs(d)} pp ` : ''}to ${headline.latestAttemptRate}% of the paper.`,
    );
  }
  if (headline.latestAccuracy != null && headline.latestAttemptRate != null) {
    behaviour.push(
      headline.latestAttemptRate < 60
        ? 'Marks are being left on the table by questions never reached, not only by wrong answers.'
        : 'Most of the paper is being reached, so accuracy is what decides the score now.',
    );
  }

  const message =
    comparability === 'BASELINE_ONLY'
      ? 'One attempt is a starting point, not a verdict — the next one makes this report useful.'
      : (headline.scoreDeltaPoints ?? 0) > 0
        ? `You have moved ${headline.scoreDeltaPoints} points since your first attempt; the plan below targets what is still holding the score down.`
        : 'The score has not moved yet, and the plan below is built around the specific areas the evidence points to.';

  return {
    trajectory,
    improvementDrivers: drivers,
    persistentGaps: persistent,
    newOrDeclining,
    behaviour,
    studentMessage: message,
  };
}

// ─── Labels the UI shares ──────────────────────────────────────────────────────

export const TREND_LABEL: Record<TrendStatus, string> = {
  STRENGTH: 'Strength',
  IMPROVING: 'Improving',
  STABLE: 'Stable',
  DECLINING: 'Declining',
  PERSISTENT_GAP: 'Persistent gap',
  NEW_GAP: 'New gap',
  INSUFFICIENT_EVIDENCE: 'Insufficient evidence',
  NOT_TESTED: 'Not tested',
};

export const BUCKET_LABEL: Record<PlanBucket, string> = {
  REPAIR: 'Repair',
  IMPROVE: 'Improve',
  MAINTAIN: 'Maintain',
  VALIDATE: 'Validate',
  EXAM_BEHAVIOUR: 'Exam behaviour',
};
