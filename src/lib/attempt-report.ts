/**
 * Normalized "This Attempt" report model.
 *
 * One place computes every number the report shows, so the header, the radar, the
 * subject matrix, the question list and the study-plan priorities cannot disagree
 * (§1 Reconciliation, §22.5 of the FINAL V2 blueprint).
 *
 * Everything here derives from the recorded attempt — the question list, the answer
 * key and the student's responses. Nothing is inferred, estimated or filled in:
 * where the data cannot support an analysis the model says so through an explicit
 * state rather than emitting a plausible-looking number (§1 Test-only truth, §17).
 *
 * What the current API cannot support, and therefore what this model reports as
 * unavailable rather than inventing:
 *   • topic / sub-topic tags   — `QuestionReviewItem` stops at `subject`, so the
 *     deepest taxonomy level is the subject (§1 No invented granularity)
 *   • question_type            — present on the wire, so §9's type analysis runs
 *   • per-question marks       — no `max_marks` / `marks_awarded` / negative rule,
 *     so marks reconcile only at subject and attempt level and negative-mark loss
 *     cannot be attributed
 *   • expected_time_sec        — time bands fall back to the student's own median
 */
import type {
  AttemptDetailResponse,
  QuestionReviewItem,
  SubjectBreakdown,
} from './userPortalApi';
import { negativeMarkLoss, type ExamContext, type ExamTaxonomyNode } from './exam-report-config';

// ─── Configuration (§13) ───────────────────────────────────────────────────────

/**
 * Thresholds and weights. Exposed as config rather than constants so a different
 * exam — or a coaching centre with its own targets — changes behaviour without a
 * code change (§21 "All UI components are taxonomy-driven and exam-agnostic").
 */
export interface ReportConfig {
  /** Attempted questions needed before a node's accuracy is treated as measured. */
  minEvidence: number;
  /** Accuracy at or above this, with adequate evidence, qualifies as a strength. */
  strongAccuracy: number;
  /** Below this is a focus area; between the two is developing. */
  developingAccuracy: number;
  /** Coaching-centre target band. Explicitly NOT an official cut-off (§5). */
  targetAccuracy: number;
  /** Coverage at or above this counts as adequately attempted. */
  targetCoverage: number;
  /** How many priorities are active at once; the rest queue (§11.1). */
  maxActivePriorities: number;
  /** Multiple of the student's own median time that counts as slow (§9). */
  slowTimeFactor: number;
}

export const DEFAULT_REPORT_CONFIG: ReportConfig = {
  minEvidence: 5,
  strongAccuracy: 70,
  developingAccuracy: 40,
  targetAccuracy: 70,
  targetCoverage: 70,
  maxActivePriorities: 3,
  slowTimeFactor: 1.25,
};

// ─── States (§17) ──────────────────────────────────────────────────────────────

/** Why a number is, or is not, trustworthy. Drives every label in the UI. */
export type EvidenceState = 'MEASURED' | 'INSUFFICIENT_EVIDENCE' | 'NOT_ASSESSED';

/** Whether an analysis can be rendered at all. */
export type AnalysisState = 'AVAILABLE' | 'DATA_UNAVAILABLE';

export type NodeStatus = 'STRONG' | 'DEVELOPING' | 'FOCUS' | 'INSUFFICIENT_EVIDENCE' | 'NOT_ASSESSED';

/** The single thing most responsible for lost marks on a node (§6). */
export type PrimaryIssue = 'ACCURACY' | 'COVERAGE' | 'TIME' | 'MIXED' | 'INSUFFICIENT_EVIDENCE' | 'NONE';

export type Confidence = 'HIGH' | 'MEDIUM' | 'LOW';

// ─── Metrics (§14) ─────────────────────────────────────────────────────────────

export interface NodeMetrics {
  questions: number;
  attempted: number;
  correct: number;
  incorrect: number;
  skipped: number;
  /** attempted / questions × 100. */
  coverage: number | null;
  /** correct / attempted × 100 — null when nothing was attempted, never 0. */
  accuracy: number | null;
  marksEarned: number | null;
  marksAvailable: number | null;
  /** marksEarned / marksAvailable × 100. */
  scoreEfficiency: number | null;
  /** Mean seconds over attempted, timed questions. */
  avgTimeSec: number | null;
  /** How many attempted questions carried a timing figure. */
  timedCount: number;
}

/**
 * The topic layer of §15's shape.
 *
 * Populated from whatever the questions themselves are tagged with — never from
 * the exam's configured syllabus, which would put topics the paper never asked
 * about into a report about one paper. Empty when the payload carries no tags, in
 * which case the report says so rather than inventing a level.
 */
export interface TopicNode {
  topicId: string;
  name: string;
  /**
   * The same label in the paper's own language, when it differs from `name`.
   *
   * Null for most topics: the catalog stores one name per topic, so the only
   * second wording available is whatever the paper itself was tagged with.
   */
  nameLocal: string | null;
  metrics: NodeMetrics;
  state: EvidenceState;
  /** The sub-topic split under this topic, where questions carry one. */
  subtopics: TopicNode[];
}

export interface SubjectNode {
  subjectId: string;
  /**
   * The subject's label, canonical where the exam configuration knows it.
   *
   * A bilingual paper tags its questions in the language it was printed in, so a
   * Group 4 response names every subject in Tamil. Resolving the question's
   * subject against the configured syllabus recovers the catalog's English label;
   * `nameLocal` keeps the paper's own wording so a reader can have either.
   */
  name: string;
  /** The same subject in the paper's language, when it differs from `name`. */
  nameLocal: string | null;
  metrics: NodeMetrics;
  state: EvidenceState;
  status: NodeStatus;
  primaryIssue: PrimaryIssue;
  confidence: Confidence;
  /** One sentence tied to this subject's own numbers (§7.1). */
  diagnosis: string;
  /** Short badges, e.g. LOW COVERAGE / SMALL SAMPLE (§7.1). */
  issueBadges: string[];
  difficultySplit: DifficultyRow[];
  questionIds: string[];
  /** Empty until questions carry topic tags — see TopicNode. */
  topics: TopicNode[];
}

export interface DifficultyRow {
  label: string;
  questions: number;
  attempted: number;
  correct: number;
  accuracy: number | null;
}

/**
 * An area holding unattempted marks.
 *
 * Accuracy analysis can only speak about questions that were answered, which
 * leaves the largest block of lost marks unexamined. This describes the other
 * half: what was not reached, what it was worth, and which syllabus topics sit
 * behind it — the topics coming from the exam's configured taxonomy, not guessed.
 */
export interface CoverageRow {
  subjectId: string;
  name: string;
  questions: number;
  attempted: number;
  skipped: number;
  /** attempted / questions × 100. */
  coverage: number | null;
  /** Marks sitting in the skipped questions, where subject marks are known. */
  marksAtStake: number | null;
  /** Nothing attempted at all, versus partially worked. */
  state: 'NOT_ASSESSED' | 'PARTIAL';
  /** Accuracy on what *was* attempted — null when nothing was. */
  accuracy: number | null;
  /** Syllabus topics for this subject, from the exam configuration. */
  topics: string[];
  /** What to do, varying by whether there is any evidence to build on. */
  action: string;
  /** Why this one is worth the time relative to the others. */
  rationale: string;
}

/** Where the marks and the mistakes actually sit, subject by subject. */
export interface SubjectShareRow {
  subjectId: string;
  name: string;
  questions: number;
  attempted: number;
  correct: number;
  incorrect: number;
  skipped: number;
  accuracy: number | null;
  /** This subject's share of every wrong answer in the paper. */
  shareOfErrors: number | null;
  /** This subject's share of every unattempted question. */
  shareOfSkipped: number | null;
  /** Marks still on the table here, when subject marks are known. */
  marksUncollected: number | null;
}

export interface TypeRow {
  /** Raw tag, humanised for display. */
  label: string;
  questions: number;
  attempted: number;
  correct: number;
  accuracy: number | null;
}

export interface TimeBandRow {
  label: string;
  questions: number;
  correct: number;
  accuracy: number | null;
}

export interface DiagnosticFinding {
  rank: number;
  /** Observation + interpretation, in plain language (§4). */
  text: string;
  /** The exact figures the claim rests on. */
  evidence: string[];
  confidence: Confidence;
  /**
   * What the claim rests on, said in words rather than as a grade.
   *
   * "HIGH confidence" read as a verdict on how sure the aspirant should feel,
   * when it only ever described how much of their own paper the sentence was
   * computed from. Some of these lines are plain arithmetic off the answer sheet
   * and carry no uncertainty at all; others rest on a handful of answers and
   * should be read as provisional. The wording now says which.
   */
  basis: string;
}

/** A line that is simply counted, not inferred — no uncertainty to declare. */
const COUNTED = 'Counted from your answer sheet';

/**
 * Phrases a sample-based claim by the number of answers behind it, flagging the
 * thin ones instead of leaving the reader to decode a grade.
 */
function basisFromSample(attempted: number, cfg: ReportConfig, what = 'answered questions'): string {
  const base = `Based on ${attempted} ${what}`;
  if (attempted >= cfg.minEvidence * 3) return base;
  if (attempted >= cfg.minEvidence) return `${base} — a small set, so treat it as an early signal`;
  return `${base} — too few to be sure yet`;
}

export interface Insight {
  /** Subject this is about, or null for an attempt-wide observation. */
  subjectId: string | null;
  title: string;
  evidence: string;
  implication: string;
  action: string;
}

export interface Priority {
  nodeId: string;
  nodeType: 'subject';
  rank: number;
  score: number;
  /** Machine-readable reasons, for the UI and for debugging (§11.2). */
  reasonCodes: string[];
  /** Human-readable version of the same thing. */
  reason: string;
  evidence: string[];
  /** Which intervention shape this pattern calls for (§11.3). */
  archetype: InterventionArchetype;
  components: {
    performanceGap: number;
    evidenceWeight: number;
    testWeight: number;
    coverageGap: number;
    errorTimeModifier: number;
  };
}

export type InterventionArchetype =
  | 'CONCEPT_REPAIR'
  | 'COVERAGE_AND_SELECTION'
  | 'FOUNDATION_FIRST'
  | 'SPEED_DRILL'
  | 'MAINTENANCE'
  | 'DIAGNOSTIC_FIRST'
  | 'COLLECT_EVIDENCE';

export interface AttemptReportModel {
  meta: {
    attemptId: string;
    testName: string;
    examName: string | null;
    mode: string | null;
    date: string | null;
    status: string;
    autoSubmitted: boolean;
  };
  summary: {
    score: number | null;
    maxMarks: number | null;
    percentage: number | null;
    totalQuestions: number;
    attempted: number;
    correct: number;
    incorrect: number;
    unattempted: number;
    attemptRate: number | null;
    accuracy: number | null;
    timeUsedSec: number | null;
    timeAllowedSec: number | null;
    avgTimePerAttemptedSec: number | null;
  };
  diagnostics: DiagnosticFinding[];
  /**
   * The proficiency radar.
   *
   * `value` is **accuracy over attempted questions**, not share of marks. A radar
   * asks "how good are you at this subject"; plotting share of marks would answer
   * a different question, because a subject nobody reached would sit at 0% and
   * read as no ability rather than as no evidence. Share of marks is carried
   * alongside as `scorePct` so both numbers are visible where the reader looks.
   */
  radar: Array<{
    subjectId: string;
    label: string;
    /** Accuracy. Null when not assessed — the polygon must not plot that as zero (§5). */
    value: number | null;
    /** Attempted questions — the sample the accuracy rests on. */
    evidenceCount: number;
    /** Correct answers, and the questions the paper carried. */
    correct: number;
    questions: number;
    /** Marks earned as a share of the subject's marks, where marks are known. */
    scorePct: number | null;
    marksEarned: number | null;
    marksAvailable: number | null;
    state: EvidenceState;
  }>;
  /** 3–5 sentences read alongside the radar (§5 Interpretation). */
  radarInterpretation: string[];
  subjects: SubjectNode[];
  analyses: {
    difficulty: { state: AnalysisState; rows: DifficultyRow[]; whatThisMeans: string; reason: string };
    time: {
      state: AnalysisState;
      rows: TimeBandRow[];
      medianSec: number | null;
      avgSec: number | null;
      /** True when each question carries its own time, enabling the band split. */
      hasPerQuestionTiming: boolean;
      /** Seconds per question the paper allows, from duration ÷ questions. */
      idealSec: number | null;
      /** The band shown as "ideal", ±15% of that figure. */
      idealBand: [number, number] | null;
      pace: 'FAST' | 'ON_PACE' | 'SLOW' | null;
      whatThisMeans: string;
    };
    /** Accuracy per subject — the comparison the design asks for (§9). */
    bySubject: { state: AnalysisState; rows: SubjectShareRow[]; whatThisMeans: string };
    /** Where wrong answers concentrate, absent a recorded cause. */
    errorFocus: { state: AnalysisState; rows: SubjectShareRow[]; whatThisMeans: string; reason: string };
    questionType: {
      state: AnalysisState;
      rows: TypeRow[];
      reason: string;
      whatThisMeans: string;
    };
    negativeMarks: {
      state: AnalysisState;
      reason: string;
      /** Marks lost to wrong answers, when the scheme is configured. */
      marksLost: number | null;
      perWrong: number | null;
    };
    errorCategories: { state: AnalysisState; reason: string };
  };
  /**
   * The unattempted half of the paper (§10 coverage gap), ranked by marks at
   * stake rather than by how weak the subject looks.
   */
  coverage: {
    totalSkipped: number;
    marksAtStake: number | null;
    rows: CoverageRow[];
    whatThisMeans: string;
  };
  strengths: Insight[];
  gaps: Insight[];
  coverageGaps: Insight[];
  quickWins: Insight[];
  priorities: Priority[];
  queuedPriorities: Priority[];
  /**
   * The attempt's questions after shape normalisation.
   *
   * Consumers must render from this rather than the raw payload — the admin and
   * student endpoints name the same fields differently, and reading the raw list
   * showed a fully-answered admin paper as 200 skipped questions.
   */
  questions: QuestionReviewItem[];
  dataQuality: {
    missingTopicTags: boolean;
    missingQuestionTypes: boolean;
    missingPerQuestionMarks: boolean;
    missingTiming: boolean;
    missingDifficulty: boolean;
    /** Reconciliation problems — release blockers if they ever fire (§18). */
    warnings: string[];
  };
  config: ReportConfig;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

const pct = (part: number, whole: number): number | null =>
  whole > 0 ? Math.round((part / whole) * 1000) / 10 : null;

const round1 = (n: number) => Math.round(n * 10) / 10;

/** A question counts as attempted when the student recorded an answer. */
export function isAttempted(q: QuestionReviewItem): boolean {
  const a = q.user_answer;
  return a != null && String(a).trim() !== '';
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/**
 * A grouping key for a subject, topic or sub-topic name.
 *
 * Unicode-aware on purpose. An `[^a-z0-9]` filter reduces every Tamil-script name
 * to the same empty string, so all eight subjects of a Group 4 paper collapsed
 * into a single row carrying all 200 questions — and the marks lookup, keyed the
 * same way, resolved every subject to whichever breakdown row was written last.
 * Keeping letters and digits from any script keeps the keys distinct.
 */
function slug(s: string): string {
  return (
    s
      .trim()
      .toLowerCase()
      // \p{L}\p{N} = any script's letters and numbers, so Tamil, Devanagari and
      // Latin names all survive as themselves.
      .replace(/[^\p{L}\p{N}]+/gu, '-')
      .replace(/^-+|-+$/g, '') || 'untagged'
  );
}

/**
 * The key to group a question's taxonomy level under.
 *
 * Prefers the id the backend assigns, which is stable across the two languages a
 * bilingual paper prints the same subject in, and falls back to a slug of the
 * name when no id is sent.
 */
function taxonomyKey(id: string | null | undefined, name: string): string {
  const trimmed = (id ?? '').trim();
  return trimmed.length > 0 ? trimmed : slug(name);
}

function emptyMetrics(): NodeMetrics {
  return {
    questions: 0,
    attempted: 0,
    correct: 0,
    incorrect: 0,
    skipped: 0,
    coverage: null,
    accuracy: null,
    marksEarned: null,
    marksAvailable: null,
    scoreEfficiency: null,
    avgTimeSec: null,
    timedCount: 0,
  };
}

/**
 * Fold a question set into the canonical metric block (§14).
 *
 * Exported because the progress report aggregates the same way across attempts —
 * two implementations of "attempted" or "accuracy" would eventually disagree.
 */
export function metricsFor(questions: QuestionReviewItem[]): NodeMetrics {
  const m = emptyMetrics();
  m.questions = questions.length;
  let timeSum = 0;

  for (const q of questions) {
    if (isAttempted(q)) {
      m.attempted += 1;
      if (q.is_correct) m.correct += 1;
      else m.incorrect += 1;
      const t = q.time_spent_seconds;
      if (typeof t === 'number' && t > 0) {
        timeSum += t;
        m.timedCount += 1;
      }
    } else {
      m.skipped += 1;
    }
  }

  m.coverage = pct(m.attempted, m.questions);
  // Null, not zero: nothing attempted means accuracy is unmeasured (§1 No false zero).
  m.accuracy = m.attempted > 0 ? pct(m.correct, m.attempted) : null;
  m.avgTimeSec = m.timedCount > 0 ? round1(timeSum / m.timedCount) : null;
  return m;
}

/**
 * Groups a subject's questions by their topic tag, and each topic's by sub-topic.
 *
 * Untagged questions are dropped rather than pooled into an "Other" bucket: a
 * topic row that silently means "everything we could not place" reads as a real
 * syllabus area and would be planned around as one. The subject's own totals
 * still count every question, so nothing goes missing from the figures above.
 */
function topicNodes(items: QuestionReviewItem[], cfg: ReportConfig): TopicNode[] {
  const tagged = items.filter(q => (q.topic ?? '').trim().length > 0);
  if (tagged.length === 0) return [];

  const byTopic = new Map<string, { name: string; items: QuestionReviewItem[] }>();
  for (const q of tagged) {
    const name = (q.topic ?? '').trim();
    const id = taxonomyKey(q.topic_id, name);
    const bucket = byTopic.get(id) ?? { name, items: [] };
    bucket.items.push(q);
    byTopic.set(id, bucket);
  }

  const nodes: TopicNode[] = [...byTopic.entries()].map(([topicId, { name, items: qs }]) => {
    const m = metricsFor(qs);

    const bySub = new Map<string, { name: string; items: QuestionReviewItem[] }>();
    for (const q of qs) {
      const subName = (q.subtopic ?? '').trim();
      if (!subName) continue;
      const subId = taxonomyKey(q.subtopic_id, subName);
      const bucket = bySub.get(subId) ?? { name: subName, items: [] };
      bucket.items.push(q);
      bySub.set(subId, bucket);
    }

    const subtopics: TopicNode[] = [...bySub.entries()]
      .map(([subId, sub]) => {
        const sm = metricsFor(sub.items);
        return {
          topicId: `${topicId}/${subId}`,
          name: sub.name,
          nameLocal: null,
          metrics: sm,
          state: evidenceStateFor(sm, cfg),
          subtopics: [],
        };
      })
      .sort((a, b) => b.metrics.questions - a.metrics.questions || a.name.localeCompare(b.name));

    return { topicId, name, nameLocal: null, metrics: m, state: evidenceStateFor(m, cfg), subtopics };
  });

  // Biggest first: the topic carrying the most questions is the one worth reading.
  return nodes.sort((a, b) => b.metrics.questions - a.metrics.questions || a.name.localeCompare(b.name));
}

/**
 * Matches a question's subject onto the exam's configured syllabus.
 *
 * Tries the id the backend assigned, then the canonical name, its local-language
 * name, and any configured alias — each slugged, so punctuation and spacing do
 * not decide the match. Returns null when the paper tagged something the exam
 * configuration does not describe, in which case the paper's own wording stands.
 */
function matchTaxonomy(
  exam: ExamContext | null,
  subjectId: string | null | undefined,
  name: string,
): ExamTaxonomyNode | null {
  const nodes = exam?.taxonomy ?? [];
  if (nodes.length === 0) return null;

  const id = (subjectId ?? '').trim();
  if (id) {
    const byId = nodes.find(n => n.id === id);
    if (byId) return byId;
  }

  const key = slug(name);
  if (!key || key === 'untagged') return null;
  return (
    nodes.find(
      n =>
        slug(n.name) === key ||
        (n.nameLocal != null && slug(n.nameLocal) === key) ||
        (n.aliases ?? []).some(a => slug(a) === key),
    ) ?? null
  );
}

/**
 * The two labels to show for one subject.
 *
 * `name` prefers the catalog's canonical wording — a report read in English
 * should not name its subjects in Tamil just because the paper was printed that
 * way — and `nameLocal` keeps the paper's own wording for the reader who wants
 * it. When nothing matches, both fall back to what the payload carried, which is
 * better than an empty cell.
 */
function subjectLabels(
  exam: ExamContext | null,
  q: QuestionReviewItem | undefined,
  paperName: string,
): { name: string; nameLocal: string | null } {
  const node = matchTaxonomy(exam, q?.subject_id, paperName);
  // The backend resolves some subjects itself and sends the canonical name; that
  // is a better English label than the paper's wording where it differs.
  const fromPayload = (q?.subject_name ?? '').trim();

  const canonical = node?.name ?? (fromPayload && fromPayload !== paperName ? fromPayload : paperName);
  const local = node?.nameLocal ?? (paperName !== canonical ? paperName : null);
  return { name: canonical, nameLocal: local && local !== canonical ? local : null };
}

function evidenceStateFor(m: NodeMetrics, cfg: ReportConfig): EvidenceState {
  if (m.attempted === 0) return 'NOT_ASSESSED';
  return m.attempted < cfg.minEvidence ? 'INSUFFICIENT_EVIDENCE' : 'MEASURED';
}

function confidenceFor(m: NodeMetrics, cfg: ReportConfig): Confidence {
  if (m.attempted >= cfg.minEvidence * 3) return 'HIGH';
  if (m.attempted >= cfg.minEvidence) return 'MEDIUM';
  return 'LOW';
}

function statusFor(m: NodeMetrics, state: EvidenceState, cfg: ReportConfig): NodeStatus {
  if (state === 'NOT_ASSESSED') return 'NOT_ASSESSED';
  if (state === 'INSUFFICIENT_EVIDENCE') return 'INSUFFICIENT_EVIDENCE';
  const acc = m.accuracy ?? 0;
  // A high accuracy on a thinly-covered subject is not yet a strength — the marks
  // left on the table are the bigger story.
  if (acc >= cfg.strongAccuracy && (m.coverage ?? 0) >= cfg.targetCoverage) return 'STRONG';
  if (acc >= cfg.developingAccuracy) return 'DEVELOPING';
  return 'FOCUS';
}

function issueFor(
  m: NodeMetrics,
  state: EvidenceState,
  isSlow: boolean,
  cfg: ReportConfig,
): PrimaryIssue {
  if (state === 'NOT_ASSESSED') return 'COVERAGE';
  if (state === 'INSUFFICIENT_EVIDENCE') return 'INSUFFICIENT_EVIDENCE';
  const lowAccuracy = (m.accuracy ?? 0) < cfg.targetAccuracy;
  const lowCoverage = (m.coverage ?? 0) < cfg.targetCoverage;
  if (lowAccuracy && lowCoverage) return 'MIXED';
  if (lowAccuracy) return 'ACCURACY';
  if (lowCoverage) return 'COVERAGE';
  if (isSlow) return 'TIME';
  return 'NONE';
}

// ─── Build ─────────────────────────────────────────────────────────────────────

/**
 * Reconcile the two shapes an attempt detail arrives in.
 *
 * The student portal nests the attempt under `attempt` and names the response
 * `user_answer`. The admin Evaluation Hub returns the same information flat on the
 * root (`score`, `started_at`, `assessment_title`) and names the response
 * `student_answer`. Reading only one shape made every admin question look
 * unattempted, which rendered a full paper as "Not assessed".
 *
 * Normalising here rather than at each call site means any future caller gets the
 * same treatment, and the model keeps one definition of "attempted".
 */
export function normalizeAttemptDetail(detail: AttemptDetailResponse): AttemptDetailResponse {
  const raw = detail as any;

  const attempt = raw.attempt ?? {
    attempt_id: raw.attempt_id ?? '',
    test_name: raw.assessment_title ?? raw.test_name ?? null,
    test_mode: raw.test_mode ?? raw.mode ?? null,
    course_id: raw.course_id ?? null,
    subject: raw.subject ?? null,
    score: raw.score ?? null,
    max_score: raw.max_score ?? null,
    percentage: raw.percentage ?? null,
    start_time: raw.started_at ?? raw.start_time ?? null,
    end_time: raw.submitted_at ?? raw.end_time ?? null,
    status: raw.status ?? 'submitted',
    auto_submitted: raw.auto_submitted ?? false,
    malpractice_events: raw.malpractice_events ?? [],
    attempt_type: raw.attempt_type ?? 'eval',
  };

  const questions: QuestionReviewItem[] = (raw.questions ?? []).map((q: any, i: number) => ({
    ...q,
    question_id: q.question_id ?? q.id ?? `q${i + 1}`,
    number: q.number ?? i + 1,
    body: q.body ?? q.question_text ?? q.text ?? '',
    options: q.options ?? null,
    correct_answer: q.correct_answer ?? q.answer ?? '',
    // The admin payload calls this `student_answer`; both mean the same thing.
    user_answer: q.user_answer ?? q.student_answer ?? null,
    is_correct: !!q.is_correct,
    time_spent_seconds: q.time_spent_seconds ?? q.time_taken_seconds ?? 0,
    subject: q.subject ?? q.subject_name ?? '',
    // `chapter` is what the question bank calls the topic; `topic` is what the
    // Excel importer calls it. Either resolves to the same level of the syllabus.
    topic: q.topic ?? q.chapter ?? q.topic_name ?? null,
    subtopic: q.subtopic ?? q.sub_topic ?? q.subtopic_name ?? null,
    // Stable ids, where the backend assigns them: the same subject printed in two
    // languages shares an id but not a name, and grouping by name would split it.
    subject_id: q.subject_id ?? null,
    subject_name: q.subject_name ?? null,
    topic_id: q.topic_id ?? null,
    subtopic_id: q.subtopic_id ?? null,
    difficulty: q.difficulty ?? '',
    question_type: q.question_type ?? q.type ?? null,
    explanation: q.explanation ?? q.solution ?? null,
    translations: q.translations ?? undefined,
    tip: q.tip ?? null,
  }));

  /** Elapsed time, from stats or from the timestamps when stats are absent. */
  const elapsed =
    raw.stats?.time_taken_seconds ??
    (attempt.start_time && attempt.end_time
      ? Math.max(0, Math.round((+new Date(attempt.end_time) - +new Date(attempt.start_time)) / 1000))
      : 0);

  const stats = raw.stats ?? {
    correct_count: raw.correct_count ?? null,
    incorrect_count: raw.wrong_count ?? raw.incorrect_count ?? null,
    unattempted_count: raw.unanswered_count ?? raw.unattempted_count ?? 0,
    avg_time_per_question: null,
    slow_question_count: null,
    time_taken_seconds: elapsed,
  };

  return {
    ...raw,
    attempt,
    questions,
    stats: { ...stats, time_taken_seconds: stats.time_taken_seconds || elapsed },
  } as AttemptDetailResponse;
}

export function buildAttemptReport(
  detail: AttemptDetailResponse,
  config: Partial<ReportConfig> = {},
  /**
   * The selected exam's configuration. Supplies the marking scheme, the allowed
   * duration and the configured syllabus — things the response payload does not
   * carry. Omit it and the report behaves exactly as before, on defaults.
   */
  exam: ExamContext | null = null,
): AttemptReportModel {
  const cfg = { ...DEFAULT_REPORT_CONFIG, ...config };
  // Accept either payload shape before anything reads a field off it.
  const normalized = normalizeAttemptDetail(detail);
  detail = normalized;
  const questions = normalized.questions ?? [];
  const breakdown = detail.performance_breakdown ?? null;
  const warnings: string[] = [];

  // ── Attempt-level truth, computed from the responses themselves ──
  const overall = metricsFor(questions);
  const dist = breakdown?.overall_distribution ?? null;
  const stats = detail.stats ?? null;

  /**
   * The question list is the source of truth, but it can arrive short (paging, or a
   * payload that omits unanswered items). Where the server's own totals disagree,
   * trust the larger total and say so — silently reporting a 34-question attempt as
   * complete would break every percentage below it (§18 Overall reconciliation).
   */
  const declaredTotal = dist?.total ?? null;
  const statsTotal =
    stats && stats.correct_count != null && stats.incorrect_count != null
      ? stats.correct_count + stats.incorrect_count + stats.unattempted_count
      : null;
  const totalQuestions = Math.max(
    overall.questions,
    declaredTotal ?? 0,
    statsTotal ?? 0,
    exam?.totalQuestions ?? 0,
  );

  if (declaredTotal != null && declaredTotal !== overall.questions) {
    warnings.push(
      `The question list holds ${overall.questions} of ${declaredTotal} questions, so question-level analysis covers part of the paper.`,
    );
  }
  if (dist && (dist.correct !== overall.correct || dist.incorrect !== overall.incorrect)) {
    warnings.push(
      `Server counts (${dist.correct} correct / ${dist.incorrect} incorrect) differ from the responses (${overall.correct} / ${overall.incorrect}). Figures below follow the responses.`,
    );
  }

  const unattempted = Math.max(0, totalQuestions - overall.attempted);
  const attemptRate = pct(overall.attempted, totalQuestions);
  const timeUsedSec = stats?.time_taken_seconds ?? null;

  // ── Timing bands, relative to the student's own median (§9) ──
  const times = questions.filter(q => isAttempted(q) && q.time_spent_seconds > 0).map(q => q.time_spent_seconds);
  const medianSec = median(times);
  /** Per-question timing drives the fast/slow bands; the average needs only the total. */
  const hasPerQuestionTiming = times.length > 0;
  const slowThreshold = medianSec != null ? medianSec * cfg.slowTimeFactor : null;

  // ── Subjects: the deepest taxonomy the payload actually carries ──
  /**
   * Marks per subject, indexed by name.
   *
   * The breakdown rows carry no id while the questions may, so these cannot be
   * keyed the same way — the lookup below matches on the slugged name instead,
   * which is the one thing both sides always have.
   */
  /**
   * Marks per subject, indexed under every key a subject row might arrive with.
   *
   * The two sides identify a subject differently: questions group under the
   * syllabus node they resolve to, or failing that the backend's `subject_id`,
   * while a breakdown row carries only a name. Indexing each row under both its
   * resolved node id and its slugged name lets one lookup serve both cases
   * instead of silently missing and blanking the subject's score.
   */
  const marksBySubject = new Map<string, SubjectBreakdown>();
  for (const row of breakdown?.subject_breakdown ?? []) {
    const node = matchTaxonomy(exam, null, row.subject);
    marksBySubject.set(slug(row.subject), row);
    if (node) marksBySubject.set(node.id, row);
  }

  /**
   * How many subject groups each marks row ends up describing.
   *
   * The row's `total_questions` is only trustworthy as an override when exactly
   * one group claims it. Where a paper's tagging still splits a subject the
   * syllabus cannot resolve, two groups share the row, and applying its total to
   * both is what inflated a 200-question paper to 220.
   */
  const marksRowClaims = new Map<string, number>();

  /**
   * Questions grouped by the subject they resolve to, not by the string they were
   * tagged with.
   *
   * A paper can name one subject two ways — some questions tagged
   * "தமிழ்நாட்டின் வரலாறு…" and others "Tamil Nadu History, Culture &
   * Socio-Political Movements" — and grouping on the raw tag split that subject
   * into two rows. Both then matched the same marks row and each took its full
   * 20-question total, so a 200-question paper reported 220. Resolving against
   * the exam's syllabus first means the two tags land in one group.
   */
  const bySubject = new Map<string, { name: string; items: QuestionReviewItem[] }>();
  for (const q of questions) {
    const name = (q.subject ?? '').trim() || 'Untagged';
    const node = matchTaxonomy(exam, q.subject_id, name);
    const id = node?.id ?? taxonomyKey(q.subject_id, name);
    const entry = bySubject.get(id) ?? { name, items: [] };
    entry.items.push(q);
    bySubject.set(id, entry);
  }

  /**
   * A subject that appears only in the server's marks table still belongs in the
   * matrix — otherwise a fully-skipped subject vanishes instead of reading
   * "Not Assessed", which is exactly the false-zero the spec forbids.
   *
   * Matched the same way as the questions, so a marks row describing a subject
   * the paper already carried under a different wording does not add a second,
   * empty row for it.
   */
  const claimedRows = new Set<string>();
  for (const [subjectId, { name }] of bySubject.entries()) {
    const row = marksBySubject.get(subjectId) ?? marksBySubject.get(slug(name));
    if (row) claimedRows.add(row.subject);
  }
  for (const row of breakdown?.subject_breakdown ?? []) {
    if (claimedRows.has(row.subject)) continue;
    const node = matchTaxonomy(exam, null, row.subject);
    bySubject.set(node?.id ?? slug(row.subject), { name: row.subject, items: [] });
    claimedRows.add(row.subject);
  }

  /**
   * The exam's configured syllabus is *not* folded in here.
   *
   * A subject this paper never asked about is a coverage fact about the syllabus,
   * not a result in this attempt — showing it as a 0-question "Not assessed" row
   * says the student skipped something that was never on the page. Subjects the
   * paper did carry but the student skipped still appear, with their real question
   * count, from the marks table above.
   */

  /** The marks row a subject group resolves to, or null when none matches. */
  const marksRowFor = (subjectId: string, name: string): SubjectBreakdown | null =>
    marksBySubject.get(subjectId) ?? marksBySubject.get(slug(name)) ?? null;

  for (const [subjectId, { name }] of bySubject.entries()) {
    const row = marksRowFor(subjectId, name);
    if (row) marksRowClaims.set(row.subject, (marksRowClaims.get(row.subject) ?? 0) + 1);
  }

  const subjects: SubjectNode[] = [...bySubject.entries()].map(([subjectId, { name, items }]) => {
    const m = metricsFor(items);
    const marks = marksRowFor(subjectId, name);
    const labels = subjectLabels(exam, items[0], name);

    if (marks) {
      m.marksEarned = marks.estimated_marks;
      m.marksAvailable = marks.max_marks;
      m.scoreEfficiency = marks.max_marks > 0 ? pct(marks.estimated_marks, marks.max_marks) : null;
      // Trust the server's question total for a subject whose questions were not
      // all projected into the list — but only where this marks row describes
      // exactly one subject row, or the same total gets counted twice.
      if (marks.total_questions > m.questions && (marksRowClaims.get(marks.subject) ?? 1) === 1) {
        m.questions = marks.total_questions;
        m.skipped = Math.max(0, marks.total_questions - m.attempted);
        m.coverage = pct(m.attempted, m.questions);
      }
    }

    const state = evidenceStateFor(m, cfg);
    const isSlow =
      slowThreshold != null && m.avgTimeSec != null && m.attempted > 0 && m.avgTimeSec > slowThreshold;
    const status = statusFor(m, state, cfg);
    const primaryIssue = issueFor(m, state, isSlow, cfg);
    const confidence = confidenceFor(m, cfg);

    const badges: string[] = [];
    if (state === 'NOT_ASSESSED') badges.push('NOT ASSESSED');
    if (state === 'INSUFFICIENT_EVIDENCE') badges.push('SMALL SAMPLE');
    if (state !== 'NOT_ASSESSED' && (m.coverage ?? 100) < cfg.targetCoverage) badges.push('LOW COVERAGE');
    if (state === 'MEASURED' && (m.accuracy ?? 100) < cfg.targetAccuracy) badges.push('LOW ACCURACY');
    if (isSlow) badges.push('SLOW');

    return {
      subjectId,
      name: labels.name,
      nameLocal: labels.nameLocal,
      metrics: m,
      state,
      status,
      primaryIssue,
      confidence,
      diagnosis: diagnoseSubject(labels.name, m, state, isSlow, cfg),
      issueBadges: badges,
      difficultySplit: difficultyRows(items),
      questionIds: items.map(q => q.question_id),
      topics: topicNodes(items, cfg),
    };
  });

  subjects.sort((a, b) => b.metrics.questions - a.metrics.questions || a.name.localeCompare(b.name));

  // ── Reconciliation check across the matrix (§18) ──
  /**
   * Subject question counts must add up to the paper.
   *
   * The attempted check below passed while the question counts were 10% over,
   * because one subject's row had been duplicated and only its questions — not
   * its answers — were double-counted. Both totals are now checked.
   */
  const subjectQuestions = subjects.reduce((n, s) => n + s.metrics.questions, 0);
  if (totalQuestions > 0 && subjectQuestions !== totalQuestions) {
    warnings.push(
      `Subject rows account for ${subjectQuestions} questions but the paper carries ${totalQuestions}. Some questions are tagged with a subject the exam configuration does not describe, so one subject may be split across two rows.`,
    );
  }

  const subjectAttempted = subjects.reduce((n, s) => n + s.metrics.attempted, 0);
  if (subjectAttempted !== overall.attempted) {
    warnings.push(
      `Subject rows account for ${subjectAttempted} attempted questions but the attempt records ${overall.attempted}.`,
    );
  }

  // ── Data-quality flags: what the payload simply does not carry ──
  const missingDifficulty = questions.length > 0 && questions.every(q => !(q.difficulty ?? '').trim());
  const typeRows = typeRowsFor(questions);
  /**
   * Average seconds per attempted question.
   *
   * Falls back to the attempt's total elapsed time divided by what was attempted,
   * which is the same figure the design shows and needs no per-question data.
   */
  const avgSec =
    overall.avgTimeSec ??
    // A recorded zero means the clock was never captured, not that the paper took
    // no time — dividing it would report a confident "0s per question".
    (timeUsedSec != null && timeUsedSec > 0 && overall.attempted > 0
      ? Math.round((timeUsedSec / overall.attempted) * 10) / 10
      : null);
  const dataQuality = {
    // True only when the payload really carries no tags. It was hardcoded while no
    // field existed; now it answers from the questions themselves, so the report
    // stops claiming the breakdown is impossible once a paper is tagged.
    missingTopicTags: !questions.some(q => (q.topic ?? '').trim().length > 0),
    missingQuestionTypes: typeRows.length === 0,
    missingPerQuestionMarks: true, // no max_marks / marks_awarded per question
    missingTiming: avgSec == null,
    missingDifficulty,
    warnings,
  };

  const summary = {
    score: detail.attempt?.score ?? null,
    maxMarks: detail.attempt?.max_score ?? null,
    percentage: detail.attempt?.percentage ?? null,
    totalQuestions,
    attempted: overall.attempted,
    correct: overall.correct,
    incorrect: overall.incorrect,
    unattempted,
    attemptRate,
    accuracy: overall.accuracy,
    timeUsedSec,
    timeAllowedSec: exam?.durationSec ?? null,
    avgTimePerAttemptedSec: overall.avgTimeSec,
  };

  /**
   * The pace the paper is built for. Null unless the exam configures both a
   * duration and a question count — an "ideal time" guessed from neither would be
   * the invented benchmark the spec rules out.
   */
  const idealSec =
    exam?.durationSec != null && totalQuestions > 0
      ? Math.round((exam.durationSec / totalQuestions) * 10) / 10
      : null;

  const negativeLoss = negativeMarkLoss(exam?.marking ?? null, overall.incorrect);
  const difficulty = difficultyRows(questions);
  const subjectShares = shareRows(subjects, overall);
  // Only subjects that actually cost marks, heaviest first.
  const errorFocus = subjectShares.filter(r => r.incorrect > 0).sort((a, b) => b.incorrect - a.incorrect);
  const timeRows = timeBandRows(questions, medianSec, cfg);


  return {
    meta: {
      attemptId: detail.attempt?.attempt_id ?? '',
      testName: detail.attempt?.test_name ?? 'Test attempt',
      examName: detail.attempt?.subject ?? null,
      mode: detail.attempt?.test_mode ?? null,
      date: detail.attempt?.start_time ?? null,
      status: detail.attempt?.status ?? 'submitted',
      autoSubmitted: !!detail.attempt?.auto_submitted,
    },
    summary,
    diagnostics: buildDiagnostics(summary, subjects, medianSec, cfg, avgSec, idealSec),
    radar: subjects.map(s => ({
      subjectId: s.subjectId,
      label: s.name,
      value: s.state === 'NOT_ASSESSED' ? null : s.metrics.accuracy,
      evidenceCount: s.metrics.attempted,
      correct: s.metrics.correct,
      questions: s.metrics.questions,
      scorePct: s.metrics.scoreEfficiency,
      marksEarned: s.metrics.marksEarned,
      marksAvailable: s.metrics.marksAvailable,
      state: s.state,
    })),
    radarInterpretation: buildRadarInterpretation(subjects, cfg),
    subjects,
    analyses: {
      bySubject: {
        state: subjectShares.length > 0 ? 'AVAILABLE' : 'DATA_UNAVAILABLE',
        rows: subjectShares,
        whatThisMeans: subjectNarrative(subjectShares, cfg),
      },
      errorFocus: {
        state: errorFocus.length > 0 ? 'AVAILABLE' : 'DATA_UNAVAILABLE',
        rows: errorFocus,
        whatThisMeans: errorNarrative(errorFocus, summary.incorrect),
        reason:
          summary.incorrect === 0
            ? 'No wrong answers in this attempt, so there is nothing to break down.'
            : 'Error causes are not recorded, so this shows where wrong answers concentrate rather than why they happened.',
      },
      difficulty: {
        // Comparing difficulty needs at least two bands. A paper where every
        // question carries the same tag has nothing to compare, and drawing one
        // lone bar invites the reader to mistake the tag for the paper's level.
        state: difficulty.length >= 2 ? 'AVAILABLE' : 'DATA_UNAVAILABLE',
        rows: difficulty,
        whatThisMeans: difficultyNarrative(difficulty),
        reason:
          difficulty.length === 1
            ? `Every question in this paper is tagged "${difficulty[0].label}", so performance cannot be compared across difficulty bands. That tag describes the questions, not the level of the paper itself.`
            : "This test's questions carry no difficulty tag.",
      },
      time: {
        // Available as soon as there is an average to report, even when the
        // per-question bands below it are empty.
        state: avgSec != null ? 'AVAILABLE' : 'DATA_UNAVAILABLE',
        rows: timeRows,
        medianSec,
        avgSec,
        hasPerQuestionTiming,
        idealSec,
        idealBand: idealSec != null ? [Math.round(idealSec * 0.85), Math.round(idealSec * 1.15)] : null,
        pace:
          idealSec == null || avgSec == null
            ? null
            : avgSec < idealSec * 0.85
              ? 'FAST'
              : avgSec > idealSec * 1.15
                ? 'SLOW'
                : 'ON_PACE',
        whatThisMeans: timeNarrative(timeRows, medianSec, avgSec, idealSec, overall.attempted),
      },
      questionType: {
        state: typeRows.length > 0 ? 'AVAILABLE' : 'DATA_UNAVAILABLE',
        rows: typeRows,
        reason: 'Questions in this test carry no question-type tag, so format-wise performance cannot be shown.',
        whatThisMeans: typeNarrative(typeRows),
      },
      negativeMarks: negativeLoss
        ? {
            state: 'AVAILABLE',
            reason: `${summary.incorrect} wrong answer${summary.incorrect === 1 ? '' : 's'} at ${negativeLoss.perWrong} marks each cost ${negativeLoss.marks} marks. Skipping those would have scored higher than guessing them.`,
            marksLost: negativeLoss.marks,
            perWrong: negativeLoss.perWrong,
          }
        : {
            state: 'DATA_UNAVAILABLE',
            reason: exam?.marking?.perSectionNegative
              ? 'This paper deducts different amounts in different sections, and per-question marks are not recorded, so the loss cannot be split accurately.'
              : exam?.marking
                ? 'This paper carries no negative marking, so no marks were lost to wrong answers.'
                : 'The marking scheme for this paper is not configured, so marks lost to negative marking cannot be calculated.',
            marksLost: null,
            perWrong: null,
          },
      errorCategories: {
        state: 'DATA_UNAVAILABLE',
        reason:
          'Error causes are not recorded. A wrong answer alone does not show whether it was a concept gap or a slip.',
      },
    },
    coverage: buildCoverage(subjects, exam, cfg),
    ...buildInsights(subjects, summary, cfg),
    ...splitPriorities(buildPriorities(subjects, summary, cfg), cfg),
    questions,
    dataQuality,
    config: cfg,
  };
}

// ─── Narrative builders ────────────────────────────────────────────────────────

function diagnoseSubject(
  name: string,
  m: NodeMetrics,
  state: EvidenceState,
  isSlow: boolean,
  cfg: ReportConfig,
): string {
  if (state === 'NOT_ASSESSED') {
    return `None of the ${m.questions} ${name} questions were attempted, so this attempt says nothing about the subject either way.`;
  }
  if (state === 'INSUFFICIENT_EVIDENCE') {
    return `Only ${m.attempted} of ${m.questions} ${name} questions were attempted — too few to judge the subject reliably, whatever the raw accuracy.`;
  }
  const acc = m.accuracy ?? 0;
  const cov = m.coverage ?? 0;
  const base = `${m.correct} of ${m.attempted} attempted correct (${acc}%), covering ${cov}% of the ${m.questions} questions`;
  if (acc < cfg.targetAccuracy && cov < cfg.targetCoverage) {
    return `${base}. Both accuracy and coverage are holding the score back here.`;
  }
  if (acc < cfg.targetAccuracy) {
    return `${base}. Coverage is fine; the marks are being lost on accuracy.`;
  }
  if (cov < cfg.targetCoverage) {
    return `${base}. Accuracy is sound — the marks left behind are the ones never attempted.`;
  }
  if (isSlow) {
    return `${base}, but at ${m.avgTimeSec}s per question this is slower than the rest of the paper.`;
  }
  return `${base}. Performing at target on the evidence available.`;
}

function buildDiagnostics(
  summary: AttemptReportModel['summary'],
  subjects: SubjectNode[],
  medianSec: number | null,
  cfg: ReportConfig,
  avgSec: number | null,
  idealSec: number | null,
): DiagnosticFinding[] {
  const out: Array<Omit<DiagnosticFinding, 'rank'>> = [];
  const { attempted, totalQuestions, correct, attemptRate, accuracy } = summary;

  // 1. Coverage vs accuracy — the spec's central distinction (§4).
  if (attemptRate != null && attemptRate < cfg.targetCoverage) {
    const accPart =
      accuracy != null
        ? ` Accuracy among attempted questions is ${accuracy}% (${correct}/${attempted}), so accuracy needs work too.`
        : '';
    out.push({
      text: `Attempt rate is ${attemptRate}% (${attempted}/${totalQuestions}); the score is constrained primarily by low coverage.${accPart}`,
      evidence: [`${attempted} of ${totalQuestions} attempted`, `${summary.unattempted} left blank`],
      confidence: 'HIGH',
      basis: COUNTED,
    });
  } else if (accuracy != null && accuracy < cfg.targetAccuracy) {
    out.push({
      text: `Coverage is good at ${attemptRate}% but accuracy is ${accuracy}% (${correct}/${attempted}); the marks are being lost on questions that were attempted.`,
      evidence: [`${correct}/${attempted} correct`, `${summary.incorrect} incorrect`],
      confidence: attempted >= cfg.minEvidence * 3 ? 'HIGH' : 'MEDIUM',
      basis: basisFromSample(attempted, cfg),
    });
  }

  // 2. Subjects never assessed — stated as unmeasured, never as weak (§4).
  const notAssessed = subjects.filter(s => s.state === 'NOT_ASSESSED');
  if (notAssessed.length > 0) {
    const blank = notAssessed.reduce((n, s) => n + s.metrics.questions, 0);
    const names = notAssessed.slice(0, 3).map(s => s.name).join(', ');
    out.push({
      text: `${notAssessed.length} subject${notAssessed.length === 1 ? '' : 's'} (${names}${notAssessed.length > 3 ? ', …' : ''}) were not assessed in this attempt — ${blank} questions untouched. Their level is unknown, not low.`,
      evidence: notAssessed.slice(0, 5).map(s => `${s.name}: 0 of ${s.metrics.questions} attempted`),
      confidence: 'HIGH',
      basis: COUNTED,
    });
  }

  // 3. The weakest measured subject.
  const measured = subjects.filter(s => s.state === 'MEASURED');
  const weakest = measured.reduce<SubjectNode | null>(
    (lo, s) => (lo == null || (s.metrics.accuracy ?? 0) < (lo.metrics.accuracy ?? 0) ? s : lo),
    null,
  );
  if (weakest && (weakest.metrics.accuracy ?? 0) < cfg.targetAccuracy) {
    out.push({
      text: `${weakest.name} is the weakest measured subject at ${weakest.metrics.accuracy}% (${weakest.metrics.correct}/${weakest.metrics.attempted}), across ${weakest.metrics.questions} questions in this paper.`,
      evidence: [`${weakest.metrics.correct}/${weakest.metrics.attempted} correct`, `${weakest.metrics.questions} questions available`],
      confidence: weakest.confidence,
      basis: basisFromSample(weakest.metrics.attempted, cfg, `answered ${weakest.name} questions`),
    });
  }

  // 4. Strongest measured subject, when there is one worth naming.
  const strongest = measured.reduce<SubjectNode | null>(
    (hi, s) => (hi == null || (s.metrics.accuracy ?? 0) > (hi.metrics.accuracy ?? 0) ? s : hi),
    null,
  );
  if (strongest && (strongest.metrics.accuracy ?? 0) >= cfg.targetAccuracy) {
    out.push({
      text: `${strongest.name} is holding up at ${strongest.metrics.accuracy}% (${strongest.metrics.correct}/${strongest.metrics.attempted}) — enough evidence to treat it as a strength to maintain rather than rebuild.`,
      evidence: [`${strongest.metrics.correct}/${strongest.metrics.attempted} correct`],
      confidence: strongest.confidence,
      basis: basisFromSample(strongest.metrics.attempted, cfg, `answered ${strongest.name} questions`),
    });
  }

  // 5. Pace, only where timing exists.
  if (medianSec != null && attempted > 0) {
    out.push({
      text: `Median time per attempted question was ${Math.round(medianSec)}s across ${attempted} questions.`,
      evidence: [`${attempted} timed responses`],
      confidence: attempted >= cfg.minEvidence * 3 ? 'HIGH' : 'MEDIUM',
      basis: basisFromSample(attempted, cfg, 'timed answers'),
    });
  }

  // 4. Where the mistakes concentrate — the single most actionable line.
  const worstSubjects = [...subjects]
    .filter(x => x.metrics.incorrect > 0)
    .sort((a, b) => b.metrics.incorrect - a.metrics.incorrect);
  if (worstSubjects.length >= 2 && summary.incorrect > 0) {
    const top = worstSubjects.slice(0, 2);
    const share = Math.round((top.reduce((n, x) => n + x.metrics.incorrect, 0) / summary.incorrect) * 100);
    out.push({
      text: `${top.map(x => x.name).join(' and ')} together hold ${share}% of every wrong answer in this paper, so they are where correction pays back fastest.`,
      evidence: top.map(x => `${x.name}: ${x.metrics.incorrect} wrong`),
      confidence: 'HIGH',
      basis: COUNTED,
    });
  }

  // 5. Marks left on the table, where subject marks are known.
  const uncollected = subjects
    .filter(x => x.metrics.marksEarned != null && x.metrics.marksAvailable != null)
    .map(x => ({ name: x.name, lost: (x.metrics.marksAvailable ?? 0) - (x.metrics.marksEarned ?? 0) }))
    .sort((a, b) => b.lost - a.lost);
  if (uncollected.length > 0 && uncollected[0].lost > 0) {
    const totalLost = Math.round(uncollected.reduce((n, x) => n + x.lost, 0) * 10) / 10;
    out.push({
      text: `${totalLost} marks went uncollected across the paper, the largest single block being ${Math.round(uncollected[0].lost * 10) / 10} in ${uncollected[0].name}.`,
      evidence: uncollected.slice(0, 3).map(x => `${x.name}: ${Math.round(x.lost * 10) / 10} marks`),
      confidence: 'HIGH',
      basis: COUNTED,
    });
  }

  // 6. Pace, stated against the paper's own allowance where one is configured.
  if (avgSec != null && idealSec != null) {
    const ratio = avgSec / idealSec;
    out.push({
      text:
        ratio < 0.85
          ? `At ${avgSec}s a question against the ${Math.round(idealSec)}s this paper allows, you are working roughly ${Math.round((1 - ratio) * 100)}% faster than the clock requires — the risk is misreading rather than running out of time.`
          : ratio > 1.15
            ? `At ${avgSec}s a question against the ${Math.round(idealSec)}s allowed, the pace is what leaves questions unreached, not the difficulty.`
            : `Pace is close to the ${Math.round(idealSec)}s a question the paper allows, so time is not the constraint here.`,
      evidence: [`${avgSec}s average`, `${Math.round(idealSec)}s allowed per question`],
      confidence: 'MEDIUM',
      // An average across the paper, not a per-question measurement — worth saying,
      // because a steady pace and a lopsided one produce the same number.
      basis: 'Based on your average pace across the paper',
    });
  }

  return out.slice(0, 7).map((f, i) => ({ ...f, rank: i + 1 }));
}

function buildRadarInterpretation(subjects: SubjectNode[], cfg: ReportConfig): string[] {
  const lines: string[] = [];
  const measured = subjects.filter(s => s.state === 'MEASURED');
  const notAssessed = subjects.filter(s => s.state === 'NOT_ASSESSED');
  const thin = subjects.filter(s => s.state === 'INSUFFICIENT_EVIDENCE');

  if (measured.length === 0) {
    lines.push('No subject has enough attempted questions to plot a measured proficiency yet.');
    lines.push('The shape appears once at least one subject passes the evidence threshold.');
    return lines;
  }

  const sorted = [...measured].sort((a, b) => (b.metrics.accuracy ?? 0) - (a.metrics.accuracy ?? 0));
  const best = sorted[0];
  const worst = sorted[sorted.length - 1];
  const atTarget = measured.filter(s => (s.metrics.accuracy ?? 0) >= cfg.targetAccuracy);
  const below = measured.filter(s => (s.metrics.accuracy ?? 0) < cfg.targetAccuracy);

  lines.push(
    `Strongest measured area: ${best.name} at ${best.metrics.accuracy}% (${best.metrics.correct} of ${best.metrics.attempted} attempted).`,
  );
  if (worst.subjectId !== best.subjectId) {
    lines.push(
      `Weakest measured area: ${worst.name} at ${worst.metrics.accuracy}% (${worst.metrics.correct} of ${worst.metrics.attempted}) — a ${Math.round((best.metrics.accuracy ?? 0) - (worst.metrics.accuracy ?? 0))}-point spread across the shape.`,
    );
  }

  lines.push(
    atTarget.length === 0
      ? `No subject reaches the ${cfg.targetAccuracy}% target yet, so the whole shape sits inside the target ring.`
      : `${atTarget.length} of ${measured.length} measured subjects reach the ${cfg.targetAccuracy}% target: ${atTarget.slice(0, 3).map(s => s.name).join(', ')}${atTarget.length > 3 ? ' and others' : ''}.`,
  );

  if (below.length > 0) {
    const worstThree = below.slice(-3).reverse();
    lines.push(
      `Inside the ring: ${worstThree.map(s => `${s.name} (${s.metrics.accuracy}%)`).join(', ')} — the distance from the ring is the marks available.`,
    );
  }

  if (notAssessed.length > 0) {
    const blank = notAssessed.reduce((n, s) => n + s.metrics.questions, 0);
    lines.push(
      `${notAssessed.length} axis${notAssessed.length === 1 ? '' : 'es'} carry no point because nothing was attempted there (${blank} questions in ${notAssessed.slice(0, 2).map(s => s.name).join(', ')}${notAssessed.length > 2 ? ' and others' : ''}). That is missing evidence, not a score of zero.`,
    );
  }
  if (thin.length > 0) {
    lines.push(
      `${thin.length} subject${thin.length === 1 ? '' : 's'} sit below ${cfg.minEvidence} attempted questions (${thin.slice(0, 2).map(s => s.name).join(', ')}) — plotted, but the figure is not yet reliable.`,
    );
  }
  lines.push('The target ring is a coaching-centre band, not an official cut-off.');
  return lines.slice(0, 7);
}

function difficultyRows(questions: QuestionReviewItem[]): DifficultyRow[] {
  const order = ['easy', 'medium', 'hard'];
  const groups = new Map<string, QuestionReviewItem[]>();
  for (const q of questions) {
    const key = (q.difficulty ?? '').trim().toLowerCase();
    if (!key) continue;
    groups.set(key, [...(groups.get(key) ?? []), q]);
  }
  return [...groups.entries()]
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
}

/**
 * Fast / expected / slow, measured against the student's own median.
 *
 * The spec prefers expected-time metadata; the question record carries none, so
 * these are relative-to-own-median bands and the copy says as much (§9).
 */
function timeBandRows(
  questions: QuestionReviewItem[],
  medianSec: number | null,
  cfg: ReportConfig,
): TimeBandRow[] {
  if (medianSec == null) return [];
  const fastMax = medianSec / cfg.slowTimeFactor;
  const slowMin = medianSec * cfg.slowTimeFactor;
  const bands: Array<{ label: string; test: (t: number) => boolean }> = [
    { label: 'Faster than usual', test: t => t < fastMax },
    { label: 'Around your median', test: t => t >= fastMax && t <= slowMin },
    { label: 'Slower than usual', test: t => t > slowMin },
  ];

  const attempted = questions.filter(q => isAttempted(q) && q.time_spent_seconds > 0);
  return bands.map(band => {
    const items = attempted.filter(q => band.test(q.time_spent_seconds));
    const correct = items.filter(q => q.is_correct).length;
    return {
      label: band.label,
      questions: items.length,
      correct,
      accuracy: items.length > 0 ? pct(correct, items.length) : null,
    };
  });
}

/** "assertion_reason" reads as "Assertion Reason" without a per-exam label map. */
function humanise(tag: string): string {
  return tag
    .replace(/[_-]+/g, ' ')
    .trim()
    .replace(/\b\w/g, c => c.toUpperCase());
}

/** Performance per question format, where the paper tags one. */
function typeRowsFor(questions: QuestionReviewItem[]): TypeRow[] {
  const groups = new Map<string, QuestionReviewItem[]>();
  for (const q of questions) {
    const key = (q.question_type ?? '').trim().toLowerCase();
    if (!key) continue;
    groups.set(key, [...(groups.get(key) ?? []), q]);
  }
  return [...groups.entries()]
    .map(([key, items]) => {
      const m = metricsFor(items);
      return {
        label: humanise(key),
        questions: m.questions,
        attempted: m.attempted,
        correct: m.correct,
        accuracy: m.accuracy,
      };
    })
    .sort((a, b) => b.questions - a.questions);
}

function typeNarrative(rows: TypeRow[]): string {
  const scored = rows.filter(r => r.accuracy != null);
  if (scored.length === 0) return 'No attempted question carries a format tag.';
  if (scored.length === 1) {
    const only = scored[0];
    return `Every question in this paper is a ${only.label} — ${only.correct}/${only.attempted} correct (${only.accuracy}%). With one format there is nothing to compare against.`;
  }
  const best = scored.reduce((hi, r) => ((r.accuracy ?? 0) > (hi.accuracy ?? 0) ? r : hi));
  const worst = scored.reduce((lo, r) => ((r.accuracy ?? 0) < (lo.accuracy ?? 0) ? r : lo));
  return `Strongest on ${best.label} (${best.accuracy}%); weakest on ${worst.label} (${worst.accuracy}%).`;
}

/** Per-subject shares of the paper's errors and skips. */
function shareRows(subjects: SubjectNode[], overall: NodeMetrics): SubjectShareRow[] {
  return subjects
    .map(s => {
      const m = s.metrics;
      const marksUncollected =
        m.marksEarned != null && m.marksAvailable != null
          ? Math.round((m.marksAvailable - m.marksEarned) * 10) / 10
          : null;
      return {
        subjectId: s.subjectId,
        name: s.name,
        questions: m.questions,
        attempted: m.attempted,
        correct: m.correct,
        incorrect: m.incorrect,
        skipped: m.skipped,
        accuracy: m.accuracy,
        shareOfErrors: overall.incorrect > 0 ? pct(m.incorrect, overall.incorrect) : null,
        shareOfSkipped: overall.skipped > 0 ? pct(m.skipped, overall.skipped) : null,
        marksUncollected,
      };
    })
    .sort((a, b) => b.questions - a.questions);
}

function subjectNarrative(rows: SubjectShareRow[], cfg: ReportConfig): string {
  const measured = rows.filter(r => r.accuracy != null && r.attempted >= cfg.minEvidence);
  if (measured.length === 0) return 'No subject has enough attempted questions to compare yet.';
  const best = measured.reduce((hi, r) => ((r.accuracy ?? 0) > (hi.accuracy ?? 0) ? r : hi));
  const worst = measured.reduce((lo, r) => ((r.accuracy ?? 0) < (lo.accuracy ?? 0) ? r : lo));
  const atTarget = measured.filter(r => (r.accuracy ?? 0) >= cfg.targetAccuracy).length;
  if (best.subjectId === worst.subjectId) {
    return `${best.name} is the only subject with enough evidence, at ${best.accuracy}%.`;
  }
  return `${best.name} leads at ${best.accuracy}% and ${worst.name} trails at ${worst.accuracy}% — a ${Math.round((best.accuracy ?? 0) - (worst.accuracy ?? 0))}-point spread. ${atTarget} of ${measured.length} measured subjects clear the ${cfg.targetAccuracy}% target.`;
}

function errorNarrative(rows: SubjectShareRow[], totalIncorrect: number): string {
  if (rows.length === 0 || totalIncorrect === 0) return 'No wrong answers to analyse.';
  const top = rows[0];
  const topTwo = rows.slice(0, 2);
  const combined = topTwo.reduce((n, r) => n + r.incorrect, 0);
  const share = Math.round((combined / totalIncorrect) * 100);
  const marks = top.marksUncollected != null ? ` ${top.marksUncollected} marks went uncollected there.` : '';
  if (rows.length === 1) {
    return `All ${totalIncorrect} wrong answers are in ${top.name}.${marks}`;
  }
  return `${top.name} holds the most wrong answers (${top.incorrect} of ${totalIncorrect}, ${top.shareOfErrors}%), and ${topTwo.map(r => r.name).join(' plus ')} together account for ${share}% of every mistake in the paper.${marks} Fixing those two moves the score further than spreading effort evenly.`;
}

function difficultyNarrative(rows: DifficultyRow[]): string {
  const scored = rows.filter(r => r.accuracy != null);
  if (scored.length === 0) return 'No attempted questions carry a difficulty tag.';
  const best = scored.reduce((hi, r) => ((r.accuracy ?? 0) > (hi.accuracy ?? 0) ? r : hi));
  const worst = scored.reduce((lo, r) => ((r.accuracy ?? 0) < (lo.accuracy ?? 0) ? r : lo));
  if (best.label === worst.label) {
    return `${best.label} questions: ${best.correct}/${best.attempted} correct (${best.accuracy}%).`;
  }
  return `Best on ${best.label} questions (${best.accuracy}%, ${best.correct}/${best.attempted}); weakest on ${worst.label} (${worst.accuracy}%, ${worst.correct}/${worst.attempted}).`;
}

function timeNarrative(
  rows: TimeBandRow[],
  medianSec: number | null,
  avgSec: number | null,
  idealSec: number | null,
  attempted: number,
): string {
  if (avgSec == null) return 'No timing was recorded for this attempt.';
  const parts =
    medianSec != null
      ? [`Median ${Math.round(medianSec)}s per attempted question.`]
      : [`${avgSec}s per attempted question on average, across ${attempted} answered.`];

  if (idealSec != null && avgSec != null) {
    // A real benchmark from the paper's own duration, not a rule of thumb.
    if (avgSec < idealSec * 0.85) {
      parts.push(
        `The paper allows about ${Math.round(idealSec)}s a question, so at ${Math.round(avgSec)}s you are moving quickly — worth checking you are reading the full stem.`,
      );
    } else if (avgSec > idealSec * 1.15) {
      parts.push(
        `The paper allows about ${Math.round(idealSec)}s a question and you averaged ${Math.round(avgSec)}s, which is what leaves questions unreached.`,
      );
    } else {
      parts.push(`That is close to the ${Math.round(idealSec)}s a question the paper allows.`);
    }
  } else {
    parts.push('This paper configures no duration, so there is no target pace to compare against.');
  }

  const slow = rows.find(r => r.label === 'Slower than usual');
  const fast = rows.find(r => r.label === 'Faster than usual');
  if (fast && fast.questions > 0) parts.push(`${fast.questions} answered fast at ${fast.accuracy}% accuracy.`);
  if (slow && slow.questions > 0) parts.push(`${slow.questions} took longer at ${slow.accuracy}% accuracy.`);
  return parts.join(' ');
}

// ─── Coverage: the unattempted half of the paper ───────────────────────────────

function buildCoverage(
  subjects: SubjectNode[],
  exam: ExamContext | null,
  cfg: ReportConfig,
): AttemptReportModel['coverage'] {
  /** Syllabus topics per subject, matched on the configured name. */
  const topicsBySubject = new Map<string, string[]>();
  for (const node of exam?.taxonomy ?? []) {
    topicsBySubject.set(slug(node.name), node.topics.map(t => t.name));
    topicsBySubject.set(node.id, node.topics.map(t => t.name));
  }

  const rows: CoverageRow[] = subjects
    .filter(s => s.metrics.skipped > 0)
    .map(s => {
      const m = s.metrics;
      // Marks per question in this subject, so skipped questions can be priced.
      const perQuestion =
        m.marksAvailable != null && m.questions > 0 ? m.marksAvailable / m.questions : null;
      const marksAtStake = perQuestion != null ? Math.round(perQuestion * m.skipped * 10) / 10 : null;
      const state: CoverageRow['state'] = m.attempted === 0 ? 'NOT_ASSESSED' : 'PARTIAL';
      const topics = topicsBySubject.get(s.subjectId) ?? topicsBySubject.get(slug(s.name)) ?? [];

      return {
        subjectId: s.subjectId,
        name: s.name,
        questions: m.questions,
        attempted: m.attempted,
        skipped: m.skipped,
        coverage: m.coverage,
        marksAtStake,
        state,
        accuracy: m.accuracy,
        topics,
        action: coverageAction(s, state, topics, cfg),
        rationale: coverageRationale(s, state, marksAtStake, cfg),
      };
    })
    // Marks at stake decides the order; a subject with 30 skipped marks outranks
    // one with 5, however weak the second looks on accuracy.
    .sort((a, b) => (b.marksAtStake ?? b.skipped) - (a.marksAtStake ?? a.skipped));

  const totalSkipped = rows.reduce((n, r) => n + r.skipped, 0);
  const priced = rows.filter(r => r.marksAtStake != null);
  const marksAtStake =
    priced.length > 0 ? Math.round(priced.reduce((n, r) => n + (r.marksAtStake ?? 0), 0) * 10) / 10 : null;

  return { totalSkipped, marksAtStake, rows, whatThisMeans: coverageNarrative(rows, totalSkipped, marksAtStake) };
}

function coverageAction(
  s: SubjectNode,
  state: CoverageRow['state'],
  topics: string[],
  cfg: ReportConfig,
): string {
  const m = s.metrics;
  const topicList = topics.length > 0 ? topics.slice(0, 3).join(', ') : null;
  const more = topics.length > 3 ? ` and ${topics.length - 3} more` : '';

  if (state === 'NOT_ASSESSED') {
    return topicList
      ? `Start with a short diagnostic across ${topicList}${more} — ${m.questions} questions were available here and none were contested, so there is nothing yet to say whether this is a gap or a strength.`
      : `Sit a short diagnostic set in ${s.name}. ${m.questions} questions were available and none were attempted, so its level is unknown.`;
  }

  // Partly worked: the advice depends on whether the attempted part held up.
  const acc = m.accuracy ?? 0;
  if (acc >= cfg.targetAccuracy) {
    return topicList
      ? `Accuracy here is already ${acc}%, so this is purely about reach — practise ${topicList}${more} under time so the remaining ${m.skipped} questions get answered.`
      : `Accuracy here is already ${acc}%; practise under time so the remaining ${m.skipped} questions get answered.`;
  }
  if (acc < cfg.developingAccuracy) {
    return topicList
      ? `Rebuild ${topicList}${more} before adding volume — at ${acc}% on what you did attempt, answering more would mostly add wrong answers.`
      : `Rebuild the basics before adding volume — at ${acc}% on what you did attempt, answering more would mostly add wrong answers.`;
  }
  return topicList
    ? `Work ${topicList}${more}, then push attempt rate: at ${acc}% accuracy the ${m.skipped} skipped questions are worth reaching for.`
    : `Improve accuracy first, then push attempt rate on the ${m.skipped} skipped questions.`;
}

function coverageRationale(
  s: SubjectNode,
  state: CoverageRow['state'],
  marksAtStake: number | null,
  cfg: ReportConfig,
): string {
  const m = s.metrics;
  const marks = marksAtStake != null ? `${marksAtStake} marks` : `${m.skipped} questions`;
  if (state === 'NOT_ASSESSED') {
    return `${marks} untouched, and no evidence either way about this subject.`;
  }
  const acc = m.accuracy ?? 0;
  const expected = marksAtStake != null ? Math.round(marksAtStake * (acc / 100) * 10) / 10 : null;
  return expected != null
    ? `${marks} unreached. At your current ${acc}% here, attempting them would be worth roughly ${expected} marks.`
    : `${m.skipped} of ${m.questions} unreached, at ${acc}% accuracy on the rest.`;
}

function coverageNarrative(rows: CoverageRow[], totalSkipped: number, marksAtStake: number | null): string {
  if (rows.length === 0) return 'Every question in this paper was attempted — there is no coverage gap.';
  const untouched = rows.filter(r => r.state === 'NOT_ASSESSED');
  const top = rows[0];
  const worth = marksAtStake != null ? `${marksAtStake} marks` : `${totalSkipped} questions`;

  const lead = `${worth} sit in questions you did not answer — more than most attempts lose to wrong answers.`;
  const biggest =
    top.marksAtStake != null
      ? ` The largest single block is ${top.name} at ${top.marksAtStake} marks across ${top.skipped} questions.`
      : ` The largest single block is ${top.name}, ${top.skipped} questions.`;
  const untested =
    untouched.length > 0
      ? ` ${untouched.length} subject${untouched.length === 1 ? '' : 's'} were not touched at all, so they need a diagnostic before they can be planned around rather than a remedial course.`
      : '';

  return lead + biggest + untested;
}

// ─── Strengths / gaps / quick wins (§10) ───────────────────────────────────────

function buildInsights(
  subjects: SubjectNode[],
  summary: AttemptReportModel['summary'],
  cfg: ReportConfig,
): Pick<AttemptReportModel, 'strengths' | 'gaps' | 'coverageGaps' | 'quickWins'> {
  const strengths: Insight[] = [];
  const gaps: Insight[] = [];
  const coverageGaps: Insight[] = [];
  const quickWins: Insight[] = [];

  for (const s of subjects) {
    const m = s.metrics;
    const marks = m.marksAvailable != null ? `${m.marksAvailable} marks` : `${m.questions} questions`;

    if (s.state === 'NOT_ASSESSED') {
      coverageGaps.push({
        subjectId: s.subjectId,
        title: s.name,
        evidence: `0 of ${m.questions} attempted`,
        implication: `${marks} were available and none were contested. Your level here is unmeasured.`,
        action: `Sit a short ${s.name} diagnostic set to find out where you stand before committing study time.`,
      });
      continue;
    }

    if (s.state === 'INSUFFICIENT_EVIDENCE') {
      gaps.push({
        subjectId: s.subjectId,
        title: `${s.name} — insufficient evidence`,
        evidence: `${m.correct}/${m.attempted} correct (${m.accuracy}% raw)`,
        implication: `${m.attempted} attempted question${m.attempted === 1 ? '' : 's'} cannot support a reliable conclusion either way.`,
        action: `Attempt a ${s.name} practice set to establish a real baseline.`,
      });
      continue;
    }

    const acc = m.accuracy ?? 0;
    const cov = m.coverage ?? 0;

    if (s.status === 'STRONG') {
      strengths.push({
        subjectId: s.subjectId,
        title: s.name,
        evidence: `${m.correct}/${m.attempted} correct (${acc}%), ${cov}% covered`,
        implication: 'Performing at target with enough evidence to trust it.',
        action: 'Hold with low-frequency revision; spend the time saved on weaker areas.',
      });
      continue;
    }

    if (acc >= cfg.targetAccuracy && cov < cfg.targetCoverage) {
      // Accuracy is already there — the marks are sitting in the questions skipped.
      quickWins.push({
        subjectId: s.subjectId,
        title: `${s.name} — attempt more`,
        evidence: `${acc}% accuracy but only ${cov}% attempted (${m.skipped} skipped)`,
        implication: `At your current accuracy, attempting those ${m.skipped} questions is the cheapest score available in this paper.`,
        action: 'Practise timed sets to raise attempt volume; skip the concept revision.',
      });
      continue;
    }

    const { implication, action } = remediationFor(s, cfg);
    gaps.push({
      subjectId: s.subjectId,
      title: s.name,
      evidence: `${m.correct}/${m.attempted} correct (${acc}%) over ${marks}`,
      implication,
      action,
    });
  }

  if (summary.attemptRate != null && summary.attemptRate < cfg.targetCoverage) {
    quickWins.unshift({
      subjectId: null,
      title: 'Raise overall attempt rate',
      evidence: `${summary.attemptRate}% attempted (${summary.attempted}/${summary.totalQuestions})`,
      implication: `${summary.unattempted} questions scored nothing because they were never answered.`,
      action: 'Practise full-length papers against the clock so the whole paper gets reached.',
    });
  }

  return { strengths, gaps, coverageGaps, quickWins };
}

/**
 * What this subject is actually costing, and what to do about it.
 *
 * §1 requires the plan to vary by student *and* by problem type, and §19 calls out
 * repeated identical actions by name. So the wording branches on how far below
 * target the subject sits, whether the loss is accuracy or coverage or both, how
 * many marks ride on it, and how big it is in the paper — and it quotes those
 * numbers, which differ per subject even when two subjects share an archetype.
 */
function remediationFor(s: SubjectNode, cfg: ReportConfig): { implication: string; action: string } {
  const m = s.metrics;
  const acc = m.accuracy ?? 0;
  const cov = m.coverage ?? 0;
  const shortfall = Math.round(cfg.targetAccuracy - acc);
  const marksLost =
    m.marksEarned != null && m.marksAvailable != null
      ? Math.round((m.marksAvailable - m.marksEarned) * 10) / 10
      : null;
  const marksPhrase = marksLost != null && marksLost > 0 ? ` ${marksLost} of ${m.marksAvailable} marks went uncollected here.` : '';

  /** Practice volume scaled to how much of the paper this subject occupies. */
  const setSize = Math.min(30, Math.max(10, Math.round(m.questions / 2)));

  // Coverage and accuracy both short — the subject leaks marks twice over.
  if (s.primaryIssue === 'MIXED') {
    return {
      implication: `${m.skipped} of ${m.questions} questions were never reached, and ${m.incorrect} of the ${m.attempted} attempted came back wrong.${marksPhrase}`,
      action: `Rebuild from the basics in untimed sets of ${Math.min(15, setSize)} before adding volume — at ${acc}% coverage practice would only spread the same gaps wider.`,
    };
  }

  // Accuracy at or near chance: more questions will just repeat the errors.
  if (acc < 30) {
    return {
      implication: `Only ${m.correct} of ${m.attempted} attempted were right (${acc}%) — low enough that the underlying concepts, not exam technique, are the problem.${marksPhrase}`,
      action: `Re-learn the core topics before practising again, then work ${setSize} questions slowly and review every wrong answer against the explanation.`,
    };
  }

  // Middling accuracy with decent coverage: the errors are the lesson.
  if (acc < 55) {
    return {
      implication: `${m.correct} of ${m.attempted} correct puts this ${shortfall} points under the ${cfg.targetAccuracy}% target${marksPhrase ? ',' : '.'}${marksPhrase}`,
      action: `Start with the ${m.incorrect} wrong answers from this paper — what was misread, what was half-known — then a ${setSize}-question set on the same topics.`,
    };
  }

  // Within reach: precision work rather than relearning.
  return {
    implication: `${acc}% is ${shortfall} points off target, so the gap is precision rather than knowledge${marksPhrase ? '.' : '.'}${marksPhrase}`,
    action: `Drill the ${m.incorrect} missed questions and the traps around them; a short ${Math.min(15, setSize)}-question set at full attention should close most of this.`,
  };
}

// ─── Priority engine (§11.2) ───────────────────────────────────────────────────

/**
 * Priority = PerformanceGap × EvidenceWeight × TestWeight × Urgency
 *            + CoverageGap + Error/Time modifier
 *
 * Every component is kept on the result so the UI can explain a ranking and a
 * developer can debug one (§11.2 Explainability payload).
 */
function buildPriorities(
  subjects: SubjectNode[],
  summary: AttemptReportModel['summary'],
  cfg: ReportConfig,
): Priority[] {
  const total = Math.max(1, summary.totalQuestions);

  const scored = subjects.map(s => {
    const m = s.metrics;
    const reasonCodes: string[] = [];
    const evidence: string[] = [];

    // Only measured evidence contributes a performance gap — an unattempted
    // subject is not "0% able", so it earns priority through coverage instead.
    const performanceGap =
      s.state === 'MEASURED' ? Math.max(0, cfg.targetAccuracy - (m.accuracy ?? 0)) / 100 : 0;
    // Caps the influence of a 1/1 result.
    const evidenceWeight = Math.min(1, m.attempted / cfg.minEvidence);
    const testWeight = m.questions / total;
    const coverageGap = s.state === 'NOT_ASSESSED' ? (m.questions / total) * 0.6 : (m.skipped / total) * 0.3;
    const errorTimeModifier = s.issueBadges.includes('SLOW') ? 0.05 : 0;

    if (performanceGap > 0) {
      reasonCodes.push('LOW_ACCURACY');
      evidence.push(`${m.accuracy}% accuracy vs ${cfg.targetAccuracy}% target`);
    }
    if (s.state === 'NOT_ASSESSED') {
      reasonCodes.push('NOT_ASSESSED');
      evidence.push(`0 of ${m.questions} attempted`);
    } else if ((m.coverage ?? 100) < cfg.targetCoverage) {
      reasonCodes.push('LOW_COVERAGE');
      evidence.push(`${m.coverage}% attempted, ${m.skipped} skipped`);
    }
    if (s.state === 'INSUFFICIENT_EVIDENCE') {
      reasonCodes.push('SMALL_SAMPLE');
      evidence.push(`${m.attempted} attempted — below the ${cfg.minEvidence}-question threshold`);
    }
    if (errorTimeModifier > 0) {
      reasonCodes.push('SLOW');
      evidence.push(`${m.avgTimeSec}s average, above the paper's pace`);
    }
    if (testWeight >= 0.2) {
      reasonCodes.push('HIGH_TEST_WEIGHT');
      evidence.push(`${m.questions} of ${total} questions in this paper`);
    }

    const score =
      performanceGap * evidenceWeight * testWeight + coverageGap + errorTimeModifier;

    return {
      nodeId: s.subjectId,
      nodeType: 'subject' as const,
      rank: 0,
      score: Math.round(score * 10000) / 10000,
      reasonCodes,
      reason: reasonFor(reasonCodes, s),
      evidence,
      archetype: archetypeFor(s, cfg),
      components: { performanceGap, evidenceWeight, testWeight, coverageGap, errorTimeModifier },
    };
  });

  return scored
    .filter(p => p.score > 0 && p.reasonCodes.length > 0)
    .sort((a, b) => b.score - a.score)
    .map((p, i) => ({ ...p, rank: i + 1 }));
}

function splitPriorities(
  all: Priority[],
  cfg: ReportConfig,
): Pick<AttemptReportModel, 'priorities' | 'queuedPriorities'> {
  return {
    priorities: all.slice(0, cfg.maxActivePriorities),
    queuedPriorities: all.slice(cfg.maxActivePriorities),
  };
}

function reasonFor(codes: string[], s: SubjectNode): string {
  const m = s.metrics;
  if (codes.includes('NOT_ASSESSED')) {
    return `All ${m.questions} ${s.name} questions were skipped — worth a short diagnostic before it is prioritised or written off.`;
  }
  if (codes.includes('SMALL_SAMPLE')) {
    return `${m.attempted} attempted question${m.attempted === 1 ? '' : 's'} in ${s.name} is too thin to act on; collect evidence first.`;
  }
  if (codes.includes('LOW_ACCURACY') && codes.includes('LOW_COVERAGE')) {
    return `${s.name} loses marks twice — ${m.incorrect} wrong of ${m.attempted} attempted, and ${m.skipped} never reached.`;
  }
  if (codes.includes('LOW_ACCURACY')) {
    return `${s.name} sits at ${m.accuracy}% (${m.correct}/${m.attempted}) on ${m.questions} questions in this paper.`;
  }
  if (codes.includes('LOW_COVERAGE')) {
    return `${s.name} is accurate at ${m.accuracy}%, but ${m.skipped} of ${m.questions} questions were never attempted.`;
  }
  if (codes.includes('SLOW')) {
    return `${s.name} is accurate but averages ${m.avgTimeSec}s a question, which costs time elsewhere.`;
  }
  return `${s.name} is a current priority.`;
}

/** §11.3 — the plan's shape must follow the evidence pattern, not a template. */
function archetypeFor(s: SubjectNode, cfg: ReportConfig): InterventionArchetype {
  if (s.state === 'NOT_ASSESSED') return 'DIAGNOSTIC_FIRST';
  if (s.state === 'INSUFFICIENT_EVIDENCE') return 'COLLECT_EVIDENCE';

  const acc = s.metrics.accuracy ?? 0;
  const cov = s.metrics.coverage ?? 0;
  const goodAccuracy = acc >= cfg.targetAccuracy;
  const goodCoverage = cov >= cfg.targetCoverage;

  if (goodAccuracy && goodCoverage) {
    return s.issueBadges.includes('SLOW') ? 'SPEED_DRILL' : 'MAINTENANCE';
  }
  if (goodAccuracy && !goodCoverage) return 'COVERAGE_AND_SELECTION';
  if (!goodAccuracy && goodCoverage) return 'CONCEPT_REPAIR';
  return 'FOUNDATION_FIRST';
}

// ─── Labels the UI shares ──────────────────────────────────────────────────────

export const STATUS_LABEL: Record<NodeStatus, string> = {
  STRONG: 'Strong',
  DEVELOPING: 'Developing',
  FOCUS: 'Focus',
  INSUFFICIENT_EVIDENCE: 'Insufficient evidence',
  NOT_ASSESSED: 'Not assessed',
};

export const ISSUE_LABEL: Record<PrimaryIssue, string> = {
  ACCURACY: 'Accuracy',
  COVERAGE: 'Coverage',
  TIME: 'Time',
  MIXED: 'Mixed',
  INSUFFICIENT_EVIDENCE: 'Insufficient evidence',
  NONE: '—',
};

export const ARCHETYPE_LABEL: Record<InterventionArchetype, string> = {
  CONCEPT_REPAIR: 'Concept repair',
  COVERAGE_AND_SELECTION: 'Coverage & selection',
  FOUNDATION_FIRST: 'Foundation first',
  SPEED_DRILL: 'Speed drills',
  MAINTENANCE: 'Maintenance only',
  DIAGNOSTIC_FIRST: 'Diagnostic first',
  COLLECT_EVIDENCE: 'Collect evidence',
};
