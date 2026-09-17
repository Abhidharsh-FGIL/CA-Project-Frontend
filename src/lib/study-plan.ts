/**
 * The personalised study plan for one attempt (§11–12 of the This Attempt spec).
 *
 * Built from the attempt's own priorities, so two students who sat the same paper
 * get different plans and one student's weak subject gets a different treatment
 * from their strong one. §11.3 is explicit that the intervention must follow the
 * evidence pattern, and §18 tests that durations are not identical across
 * subjects — so time, volume and success criteria all scale with the priority.
 *
 * Nothing here invents a topic or a resource: tasks name the subject the evidence
 * named, at the deepest level the taxonomy actually reaches.
 */
import {
  ARCHETYPE_LABEL,
  type AttemptReportModel,
  type InterventionArchetype,
  type Priority,
} from './attempt-report';

export interface PlanConstraints {
  /** Minutes available on a study day. Labelled as a suggestion when not supplied. */
  minutesPerDay: number;
  daysPerWeek: number;
  horizonWeeks: number;
  /** False when no budget was recorded and the default is standing in. */
  budgetKnown: boolean;
}

export const DEFAULT_CONSTRAINTS: PlanConstraints = {
  minutesPerDay: 90,
  daysPerWeek: 6,
  horizonWeeks: 4,
  budgetKnown: false,
};

export interface FocusArea {
  subjectId: string;
  name: string;
  rank: number;
  archetype: InterventionArchetype;
  archetypeLabel: string;
  /** The attempt evidence that put this on the list. */
  evidence: string;
  headline: string;
  /** Minutes per session, scaled by priority — never one figure for everything. */
  minutesPerSession: number;
  sessionsPerWeek: number;
  questionTarget: number;
  successCriterion: string;
  escalation: string;
}

export interface WeekOutline {
  week: number;
  purpose: string;
  detail: string;
}

export interface WeeklyRow {
  day: string;
  focus: string;
  task: string;
  resources: string;
  questions: number;
  minutes: number;
}

export interface DailyBlock {
  minutes: number;
  label: string;
  kind: 'concept' | 'notes' | 'practice' | 'review' | 'quiz';
}

export interface StudyPlan {
  sourceAttemptId: string;
  testName: string;
  baseline: {
    scorePct: number | null;
    accuracy: number | null;
    attemptRate: number | null;
    date: string | null;
  };
  goal: {
    headline: string;
    targets: string[];
  };
  constraints: PlanConstraints;
  focusAreas: FocusArea[];
  queued: string[];
  weeks: WeekOutline[];
  weekly: WeeklyRow[];
  daily: DailyBlock[];
  /** Total minutes the week asks for, so it can be checked against the budget. */
  weeklyMinutes: number;
  /** True when the generated week exceeds the available budget (§18 plan budget). */
  overBudget: boolean;
}

const WEEK_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/** What a given intervention actually asks the student to do. */
const ARCHETYPE_TASK: Record<InterventionArchetype, string> = {
  CONCEPT_REPAIR: 'Concept revision, then worked examples, then a targeted set',
  COVERAGE_AND_SELECTION: 'Timed sets to raise attempt volume; selection practice',
  FOUNDATION_FIRST: 'Foundations in small untimed sets before any timed practice',
  SPEED_DRILL: 'Speed drills and timed mixed sets',
  MAINTENANCE: 'One mixed set to keep it warm',
  DIAGNOSTIC_FIRST: 'Short diagnostic set to establish a baseline',
  COLLECT_EVIDENCE: 'Practice set to build enough evidence to judge',
};

const ARCHETYPE_RESOURCE: Record<InterventionArchetype, string> = {
  CONCEPT_REPAIR: 'Concept notes + worked examples',
  COVERAGE_AND_SELECTION: 'Timed question bank',
  FOUNDATION_FIRST: 'Foundation notes + guided examples',
  SPEED_DRILL: 'Timed mixed sets',
  MAINTENANCE: 'Mixed revision set',
  DIAGNOSTIC_FIRST: 'Diagnostic set',
  COLLECT_EVIDENCE: 'Practice set',
};

function focusFrom(p: Priority, nameOf: (id: string) => string): FocusArea {
  // 20 minutes at the bottom of the score range to 55 at the top. Rounded to 5 so
  // the plan reads like a timetable rather than an optimisation output.
  const normalized = Math.max(0, Math.min(1, p.score * 4));
  const minutes = Math.round((20 + normalized * 35) / 5) * 5;
  const questions = Math.max(
    8,
    Math.round(minutes * (p.archetype === 'CONCEPT_REPAIR' || p.archetype === 'FOUNDATION_FIRST' ? 0.5 : 0.9)),
  );

  return {
    subjectId: p.nodeId,
    name: nameOf(p.nodeId),
    rank: p.rank,
    archetype: p.archetype,
    archetypeLabel: ARCHETYPE_LABEL[p.archetype],
    evidence: p.evidence.join(' · '),
    headline: p.reason,
    minutesPerSession: minutes,
    sessionsPerWeek: p.rank === 1 ? 3 : p.rank === 2 ? 2 : 1,
    questionTarget: questions,
    successCriterion: successFor(p, questions),
    escalation: escalationFor(p, nameOf(p.nodeId)),
  };
}

function successFor(p: Priority, questions: number): string {
  switch (p.archetype) {
    case 'DIAGNOSTIC_FIRST':
      return `Enough attempted questions to classify this subject with confidence.`;
    case 'COLLECT_EVIDENCE':
      return `At least ${Math.max(15, questions)} attempted, so the next report can judge it.`;
    case 'COVERAGE_AND_SELECTION':
      return `Attempt rate above 80% on a full section without accuracy dropping.`;
    case 'MAINTENANCE':
      return `Hold current accuracy on one mixed set.`;
    case 'SPEED_DRILL':
      return `Same accuracy at a faster median time.`;
    default:
      return `≥ 70% on two consecutive ${Math.max(10, Math.round(questions / 2))}-question sets.`;
  }
}

function escalationFor(p: Priority, name: string): string {
  switch (p.archetype) {
    case 'DIAGNOSTIC_FIRST':
    case 'COLLECT_EVIDENCE':
      return `Once measured, ${name} moves into repair, improvement or maintenance on its result.`;
    case 'MAINTENANCE':
      return `If it slips, move ${name} up into focused practice.`;
    case 'COVERAGE_AND_SELECTION':
      return `If accuracy falls as volume rises, slow down and rebuild selection judgement first.`;
    default:
      return `If the target is missed, stay on concepts for another cycle rather than adding volume.`;
  }
}

export function buildStudyPlan(
  model: AttemptReportModel,
  constraints: Partial<PlanConstraints> = {},
): StudyPlan {
  const c = { ...DEFAULT_CONSTRAINTS, ...constraints };
  const nameOf = (id: string) => model.subjects.find(s => s.subjectId === id)?.name ?? id;
  const focusAreas = model.priorities.map(p => focusFrom(p, nameOf));
  const s = model.summary;

  // Targets are framed against this attempt, not a generic 75% for everything.
  const targets: string[] = [];
  if (s.attemptRate != null && s.attemptRate < model.config.targetCoverage) {
    targets.push(`Raise attempt rate from ${s.attemptRate}% to at least ${model.config.targetCoverage}%`);
  }
  if (s.accuracy != null && s.accuracy < model.config.targetAccuracy) {
    targets.push(`Raise accuracy from ${s.accuracy}% towards ${model.config.targetAccuracy}%`);
  }
  if (focusAreas[0]) targets.push(`Close the ${focusAreas[0].name} gap first`);
  if (model.coverageGaps.length > 0) {
    targets.push(`Sit a diagnostic in ${model.coverageGaps.length} untested subject${model.coverageGaps.length === 1 ? '' : 's'}`);
  }

  const weeks: WeekOutline[] = [
    {
      week: 1,
      purpose: 'Diagnose and repair the clearest gap in the evidence',
      detail: focusAreas[0]
        ? `${focusAreas[0].name}: ${ARCHETYPE_TASK[focusAreas[0].archetype].toLowerCase()}, with a checkpoint at the end of the week.`
        : 'Establish a baseline in the subjects with the least evidence.',
    },
    {
      week: 2,
      purpose: 'Build accuracy and coverage',
      detail: focusAreas[1]
        ? `Add ${focusAreas[1].name}; volume on ${focusAreas[0]?.name ?? 'week 1'} adapts to how week 1 went.`
        : 'Increase volume where week 1 showed movement.',
    },
    {
      week: 3,
      purpose: 'Mix and time',
      detail: 'Interleaved and timed sets; keep strong areas warm with one set each.',
    },
    {
      week: 4,
      purpose: 'Re-test and consolidate',
      detail: 'A full-length paper under exam conditions, then compare against this attempt.',
    },
  ].slice(0, c.horizonWeeks);

  const weekly = buildWeek(focusAreas, model, c);
  const weeklyMinutes = weekly.reduce((n, r) => n + r.minutes, 0);

  return {
    sourceAttemptId: model.meta.attemptId,
    testName: model.meta.testName,
    baseline: {
      scorePct: s.percentage,
      accuracy: s.accuracy,
      attemptRate: s.attemptRate,
      date: model.meta.date,
    },
    goal: {
      headline: focusAreas[0]
        ? `Lift the next attempt by fixing ${focusAreas[0].name} first`
        : 'Build enough evidence to target the next phase',
      targets: targets.slice(0, 4),
    },
    constraints: c,
    focusAreas,
    queued: model.queuedPriorities.map(p => nameOf(p.nodeId)),
    weeks,
    weekly,
    daily: buildDay(focusAreas[0], c),
    weeklyMinutes,
    overBudget: weeklyMinutes > c.minutesPerDay * c.daysPerWeek,
  };
}

/**
 * The week is laid out from the ranked focus areas, not a fixed timetable.
 *
 * The top priority appears twice with a spaced revisit; a maintenance subject gets
 * one short slot; the week closes with a full paper and a review day.
 */
function buildWeek(focus: FocusArea[], model: AttemptReportModel, c: PlanConstraints): WeeklyRow[] {
  if (focus.length === 0) return [];

  const [first, second, third] = focus;
  const rows: WeeklyRow[] = [];

  const row = (day: string, f: FocusArea | undefined, task: string, scale = 1): WeeklyRow =>
    f
      ? {
          day,
          focus: f.name,
          task,
          resources: ARCHETYPE_RESOURCE[f.archetype],
          questions: Math.round(f.questionTarget * scale),
          minutes: Math.round((f.minutesPerSession * scale) / 5) * 5,
        }
      : { day, focus: 'Flexible', task: 'Catch up on anything missed, or rest.', resources: '—', questions: 0, minutes: 0 };

  rows.push(row(WEEK_DAYS[0], first, ARCHETYPE_TASK[first.archetype]));
  rows.push(row(WEEK_DAYS[1], second ?? first, ARCHETYPE_TASK[(second ?? first).archetype]));
  rows.push(row(WEEK_DAYS[2], third ?? first, ARCHETYPE_TASK[(third ?? first).archetype]));
  rows.push(row(WEEK_DAYS[3], first, `Spaced re-test — same topics, fresh questions, no notes`, 0.7));
  rows.push(row(WEEK_DAYS[4], second ?? third ?? first, ARCHETYPE_TASK[(second ?? third ?? first).archetype], 0.8));

  const mockMinutes = model.summary.timeAllowedSec != null ? Math.round(model.summary.timeAllowedSec / 60) : 120;
  rows.push({
    day: WEEK_DAYS[5],
    focus: 'Full paper',
    task: 'Timed full-length or sectional mock, then mark it honestly',
    resources: 'Mock test',
    questions: model.summary.totalQuestions,
    minutes: mockMinutes,
  });
  rows.push({
    day: WEEK_DAYS[6],
    focus: 'Review',
    task: `Work the week's error log, starting with ${first.name}`,
    resources: 'Error log',
    questions: 0,
    minutes: 45,
  });

  return rows;
}

/** A worked example of one day, built from the top priority's own numbers. */
function buildDay(top: FocusArea | undefined, c: PlanConstraints): DailyBlock[] {
  if (!top) return [];
  const base = Math.min(top.minutesPerSession, c.minutesPerDay);
  const concept = Math.max(10, Math.round(base * 0.3 / 5) * 5);
  const practice = Math.max(15, Math.round(base * 0.4 / 5) * 5);
  const review = Math.max(10, Math.round(base * 0.2 / 5) * 5);

  return [
    { minutes: concept, label: `Concept review — ${top.name}`, kind: 'concept' },
    { minutes: Math.max(10, Math.round(base * 0.1 / 5) * 5), label: 'Read notes and make short notes', kind: 'notes' },
    { minutes: practice, label: `Solve ${top.questionTarget} practice questions`, kind: 'practice' },
    { minutes: review, label: 'Review every incorrect answer', kind: 'review' },
    { minutes: 10, label: 'Quick quiz (10 mixed questions)', kind: 'quiz' },
  ];
}
