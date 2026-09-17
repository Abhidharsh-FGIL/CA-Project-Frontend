/**
 * Section 18 acceptance tests — release blockers.
 *
 * These are the rules that make the report trustworthy rather than merely
 * plausible: numbers must reconcile, an unattempted subject must never read as 0%
 * ability, a 1-of-1 result must not become a "strength", and two students with
 * opposite problems must not receive the same plan.
 */
import { describe, expect, it } from 'vitest';
import { buildAttemptReport, DEFAULT_REPORT_CONFIG } from './attempt-report';
import type { AttemptDetailResponse, QuestionReviewItem } from './userPortalApi';

// ─── Fixtures ──────────────────────────────────────────────────────────────────

let seq = 0;

function q(over: Partial<QuestionReviewItem> = {}): QuestionReviewItem {
  seq += 1;
  return {
    question_id: `q${seq}`,
    number: seq,
    body: 'stem',
    title: null,
    options: ['a', 'b'],
    correct_answer: 'a',
    user_answer: 'a',
    is_correct: true,
    time_spent_seconds: 30,
    subject: 'Tamil',
    difficulty: 'easy',
    explanation: null,
    tip: null,
    ...over,
  };
}

/** n questions in one subject: `correct` right, `wrong` wrong, the rest skipped. */
function block(subject: string, correct: number, wrong: number, skipped: number, over: Partial<QuestionReviewItem> = {}) {
  return [
    ...Array.from({ length: correct }, () => q({ subject, is_correct: true, user_answer: 'a', ...over })),
    ...Array.from({ length: wrong }, () => q({ subject, is_correct: false, user_answer: 'b', ...over })),
    ...Array.from({ length: skipped }, () => q({ subject, is_correct: false, user_answer: null, ...over })),
  ];
}

function detail(questions: QuestionReviewItem[], over: Partial<AttemptDetailResponse> = {}): AttemptDetailResponse {
  const correct = questions.filter(x => x.user_answer && x.is_correct).length;
  const incorrect = questions.filter(x => x.user_answer && !x.is_correct).length;
  return {
    attempt: {
      attempt_id: 'a1',
      test_name: 'Mock 02',
      test_mode: 'mock',
      course_id: null,
      subject: null,
      score: correct,
      max_score: questions.length,
      percentage: questions.length ? (correct / questions.length) * 100 : 0,
      start_time: '2026-09-08T10:00:00Z',
      end_time: '2026-09-08T11:00:00Z',
      status: 'submitted',
      auto_submitted: false,
      malpractice_events: [],
      attempt_type: 'test',
    },
    stats: {
      correct_count: correct,
      incorrect_count: incorrect,
      unattempted_count: questions.length - correct - incorrect,
      avg_time_per_question: 30,
      slow_question_count: 0,
      time_taken_seconds: 1800,
    },
    ai_report: null,
    questions,
    ...over,
  } as AttemptDetailResponse;
}

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe('§18 overall reconciliation', () => {
  it('correct + incorrect + unattempted equals the total', () => {
    const m = buildAttemptReport(detail(block('Tamil', 10, 24, 166)));
    const s = m.summary;
    expect(s.correct + s.incorrect + s.unattempted).toBe(s.totalQuestions);
    expect(s.totalQuestions).toBe(200);
  });

  it('reproduces the blueprint reference attempt: 34 attempted, 17% attempt rate', () => {
    const m = buildAttemptReport(detail(block('Tamil', 10, 24, 166)));
    expect(m.summary.attempted).toBe(34);
    expect(m.summary.attemptRate).toBe(17);
    // 10/34 = 29.4%, not 5% of the whole paper.
    expect(m.summary.accuracy).toBe(29.4);
  });

  it('subject rows reconcile to the attempt totals', () => {
    const m = buildAttemptReport(detail([...block('Tamil', 5, 5, 10), ...block('Polity', 3, 2, 15)]));
    const attempted = m.subjects.reduce((n, s) => n + s.metrics.attempted, 0);
    const questions = m.subjects.reduce((n, s) => n + s.metrics.questions, 0);
    expect(attempted).toBe(m.summary.attempted);
    expect(questions).toBe(m.summary.totalQuestions);
    expect(m.dataQuality.warnings).toHaveLength(0);
  });
});

describe('§18 no false zero', () => {
  it('a subject with nothing attempted is Not Assessed, never 0% proficiency', () => {
    const m = buildAttemptReport(detail([...block('Tamil', 8, 2, 0), ...block('Polity', 0, 0, 20)]));
    const polity = m.subjects.find(s => s.name === 'Polity')!;
    expect(polity.state).toBe('NOT_ASSESSED');
    expect(polity.status).toBe('NOT_ASSESSED');
    expect(polity.metrics.accuracy).toBeNull();
  });

  it('keeps an unassessed subject off the radar polygon rather than plotting zero', () => {
    const m = buildAttemptReport(detail([...block('Tamil', 8, 2, 0), ...block('Polity', 0, 0, 20)]));
    const point = m.radar.find(r => r.label === 'Polity')!;
    expect(point.value).toBeNull();
    expect(point.state).toBe('NOT_ASSESSED');
  });

  it('describes a skipped subject as unmeasured, not weak', () => {
    const m = buildAttemptReport(detail([...block('Tamil', 8, 2, 0), ...block('Polity', 0, 0, 20)]));
    const polity = m.subjects.find(s => s.name === 'Polity')!;
    expect(polity.diagnosis).toMatch(/not.*attempted|says nothing/i);
    expect(m.coverageGaps.some(g => g.title === 'Polity')).toBe(true);
    expect(m.gaps.some(g => g.title === 'Polity')).toBe(false);
  });
});

describe('§18 evidence-aware conclusions', () => {
  it('1/1 correct shows 100% raw accuracy but is not a firm strength', () => {
    const m = buildAttemptReport(detail([...block('Tamil', 1, 0, 9), ...block('Polity', 5, 5, 0)]));
    const tamil = m.subjects.find(s => s.name === 'Tamil')!;
    expect(tamil.metrics.accuracy).toBe(100);
    expect(tamil.state).toBe('INSUFFICIENT_EVIDENCE');
    expect(tamil.status).toBe('INSUFFICIENT_EVIDENCE');
    expect(m.strengths.some(s => s.title === 'Tamil')).toBe(false);
  });

  it('caps a tiny sample’s influence on priority through the evidence weight', () => {
    const m = buildAttemptReport(detail([...block('Tamil', 0, 1, 9), ...block('Polity', 2, 18, 0)]));
    const tamil = m.priorities.concat(m.queuedPriorities).find(p => p.nodeId === 'tamil');
    expect(tamil?.components.evidenceWeight).toBeLessThan(1);
  });
});

describe('§18 plan targets the actual problem', () => {
  it('high accuracy + low coverage asks for coverage, not concept revision', () => {
    const m = buildAttemptReport(detail(block('Tamil', 9, 1, 40)));
    const tamil = m.subjects.find(s => s.name === 'Tamil')!;
    expect(tamil.primaryIssue).toBe('COVERAGE');
    expect(m.priorities[0].archetype).toBe('COVERAGE_AND_SELECTION');
    expect(m.quickWins.some(w => w.title.includes('attempt more'))).toBe(true);
  });

  it('low accuracy + high coverage asks for concept repair', () => {
    const m = buildAttemptReport(detail(block('Tamil', 4, 16, 0)));
    const tamil = m.subjects.find(s => s.name === 'Tamil')!;
    expect(tamil.primaryIssue).toBe('ACCURACY');
    expect(m.priorities[0].archetype).toBe('CONCEPT_REPAIR');
  });

  it('low accuracy + low coverage starts from foundations', () => {
    const m = buildAttemptReport(detail(block('Tamil', 2, 8, 30)));
    expect(m.priorities[0].archetype).toBe('FOUNDATION_FIRST');
  });

  it('a skipped subject gets a diagnostic first, not a long remedial plan', () => {
    const m = buildAttemptReport(detail([...block('Tamil', 8, 2, 0), ...block('Polity', 0, 0, 30)]));
    const polity = m.priorities.find(p => p.nodeId === 'polity')!;
    expect(polity.archetype).toBe('DIAGNOSTIC_FIRST');
    expect(polity.reasonCodes).toContain('NOT_ASSESSED');
  });

  it('opposite students on the same test get materially different priorities', () => {
    const coverageProblem = buildAttemptReport(
      detail([...block('Tamil', 9, 1, 40), ...block('Polity', 18, 2, 0)]),
    );
    const accuracyProblem = buildAttemptReport(
      detail([...block('Tamil', 20, 30, 0), ...block('Polity', 4, 16, 0)]),
    );
    expect(coverageProblem.priorities[0].archetype).not.toBe(accuracyProblem.priorities[0].archetype);
  });
});

describe('§1 personalized action — no repeated template', () => {
  it('gives materially different advice to subjects with different evidence', () => {
    // Same issue type (accuracy), different severities and sizes.
    const m = buildAttemptReport(
      detail([
        ...block('Tamil', 1, 19, 0), // 5% — concepts
        ...block('Polity', 8, 12, 0), // 40% — error review
        ...block('Economy', 13, 7, 0), // 65% — precision
      ]),
    );
    const actions = m.gaps.map(g => g.action);
    expect(actions.length).toBe(3);
    expect(new Set(actions).size).toBe(3);

    const implications = m.gaps.map(g => g.implication);
    expect(new Set(implications).size).toBe(3);
  });

  it('quotes each subject’s own numbers in its priority reason', () => {
    const m = buildAttemptReport(detail([...block('Tamil', 2, 18, 0), ...block('Polity', 5, 15, 0)]));
    const reasons = m.priorities.concat(m.queuedPriorities).map(p => p.reason);
    expect(new Set(reasons).size).toBe(reasons.length);
  });
});

describe('§9 difficulty needs more than one band', () => {
  it('does not draw a one-band comparison when every question shares a tag', () => {
    const m = buildAttemptReport(detail(block('Tamil', 10, 10, 0, { difficulty: 'medium' })));
    expect(m.analyses.difficulty.state).toBe('DATA_UNAVAILABLE');
    expect(m.analyses.difficulty.reason).toMatch(/tagged "Medium"/);
    // And it says the tag is about the questions, not the paper's level.
    expect(m.analyses.difficulty.reason).toMatch(/not the level of the paper/i);
  });

  it('compares bands once there are two or more', () => {
    const m = buildAttemptReport(
      detail([
        ...block('Tamil', 8, 2, 0, { difficulty: 'easy' }),
        ...block('Tamil', 2, 8, 0, { difficulty: 'hard' }),
      ]),
    );
    expect(m.analyses.difficulty.state).toBe('AVAILABLE');
    expect(m.analyses.difficulty.rows).toHaveLength(2);
  });
});

describe('§18 missing tags are never fabricated', () => {
  it('reports topic tagging as unavailable and emits no topic rows', () => {
    const m = buildAttemptReport(detail(block('Tamil', 5, 5, 0)));
    expect(m.dataQuality.missingTopicTags).toBe(true);
    expect(m.subjects.every(s => s.topics.length === 0)).toBe(true);
  });

  it('hides question-type, negative-mark and error-cause analyses the data cannot support', () => {
    const m = buildAttemptReport(detail(block('Tamil', 5, 5, 0)));
    expect(m.analyses.questionType.state).toBe('DATA_UNAVAILABLE');
    expect(m.analyses.negativeMarks.state).toBe('DATA_UNAVAILABLE');
    expect(m.analyses.errorCategories.state).toBe('DATA_UNAVAILABLE');
  });

  it('hides difficulty analysis when nothing carries a difficulty tag', () => {
    const m = buildAttemptReport(detail(block('Tamil', 5, 5, 0, { difficulty: '' })));
    expect(m.analyses.difficulty.state).toBe('DATA_UNAVAILABLE');
    expect(m.analyses.difficulty.rows).toHaveLength(0);
  });

  it('still reports an average from the attempt total when per-question time is missing', () => {
    // The attempt records 1800s elapsed over 10 attempted, so 180s a question is
    // computable even with no per-question timing.
    const m = buildAttemptReport(detail(block('Tamil', 5, 5, 0, { time_spent_seconds: 0 })));
    expect(m.analyses.time.state).toBe('AVAILABLE');
    expect(m.analyses.time.avgSec).toBe(180);
    // The fast/slow bands need per-question data and stay empty.
    expect(m.analyses.time.hasPerQuestionTiming).toBe(false);
    expect(m.analyses.time.rows).toHaveLength(0);
  });

  it('hides time analysis only when no timing exists at all', () => {
    const m = buildAttemptReport(
      detail(block('Tamil', 5, 5, 0, { time_spent_seconds: 0 }), {
        stats: {
          correct_count: 5,
          incorrect_count: 5,
          unattempted_count: 0,
          avg_time_per_question: null,
          slow_question_count: null,
          time_taken_seconds: 0,
        },
      } as Partial<AttemptDetailResponse>),
    );
    expect(m.analyses.time.state).toBe('DATA_UNAVAILABLE');
    expect(m.dataQuality.missingTiming).toBe(true);
  });
});

describe('per-subject analysis replaces a one-band difficulty split', () => {
  it('compares accuracy across subjects and names the spread', () => {
    const m = buildAttemptReport(
      detail([...block('Tamil', 2, 18, 0), ...block('Polity', 16, 4, 0), ...block('Economy', 9, 11, 0)]),
    );
    expect(m.analyses.bySubject.state).toBe('AVAILABLE');
    expect(m.analyses.bySubject.rows).toHaveLength(3);
    expect(m.analyses.bySubject.whatThisMeans).toMatch(/point spread/);
  });

  it('points error focus at the subjects holding the most wrong answers', () => {
    const m = buildAttemptReport(detail([...block('Tamil', 2, 18, 0), ...block('Polity', 18, 2, 0)]));
    expect(m.analyses.errorFocus.rows[0].name).toBe('Tamil');
    expect(m.analyses.errorFocus.rows[0].shareOfErrors).toBe(90);
    expect(m.analyses.errorFocus.whatThisMeans).toMatch(/Tamil/);
  });

  it('says why a cause breakdown is absent rather than inferring one', () => {
    const m = buildAttemptReport(detail(block('Tamil', 5, 5, 0)));
    expect(m.analyses.errorFocus.reason).toMatch(/not recorded/i);
    expect(m.analyses.errorFocus.reason).toMatch(/where wrong answers concentrate/i);
  });
});

describe('§18 explainability', () => {
  it('every priority exposes reason codes and evidence', () => {
    const m = buildAttemptReport(detail([...block('Tamil', 2, 8, 20), ...block('Polity', 0, 0, 20)]));
    expect(m.priorities.length).toBeGreaterThan(0);
    for (const p of m.priorities) {
      expect(p.reasonCodes.length).toBeGreaterThan(0);
      expect(p.evidence.length).toBeGreaterThan(0);
      expect(p.reason).toBeTruthy();
    }
  });

  it('holds the active list to the configured maximum and queues the rest', () => {
    const questions = ['Tamil', 'Polity', 'Economy', 'History', 'Science'].flatMap(s => block(s, 1, 9, 10));
    const m = buildAttemptReport(detail(questions));
    expect(m.priorities.length).toBeLessThanOrEqual(DEFAULT_REPORT_CONFIG.maxActivePriorities);
    expect(m.priorities.length + m.queuedPriorities.length).toBeGreaterThan(
      DEFAULT_REPORT_CONFIG.maxActivePriorities,
    );
  });

  it('produces a ranked, non-empty set of findings', () => {
    const m = buildAttemptReport(detail([...block('Tamil', 10, 24, 100), ...block('Polity', 0, 0, 66)]));
    expect(m.diagnostics.length).toBeGreaterThanOrEqual(3);
    expect(m.diagnostics.length).toBeLessThanOrEqual(8);
    expect(m.diagnostics.map(d => d.rank)).toEqual(m.diagnostics.map((_, i) => i + 1));
    // Every finding quotes at least one figure rather than generalising.
    expect(m.diagnostics.every(d => /\d/.test(d.text))).toBe(true);
  });
});

describe('§18 reconciliation warnings', () => {
  it('flags a question list shorter than the declared paper instead of silently rescaling', () => {
    const questions = block('Tamil', 5, 5, 0);
    const m = buildAttemptReport(
      detail(questions, {
        performance_breakdown: {
          overall_distribution: { correct: 5, incorrect: 5, unattempted: 190, total: 200 },
          subject_breakdown: [],
          feedback: { performance_level: 'developing', motivation: null, strengths: [], improvement_areas: [] },
        },
      } as Partial<AttemptDetailResponse>),
    );
    expect(m.summary.totalQuestions).toBe(200);
    expect(m.dataQuality.warnings.join(' ')).toMatch(/10 of 200/);
  });
});

// ─── Exam configuration drives the report, not hardcoded rules ────────────────

describe('exam configuration is read, never assumed', () => {
  const examWithNegative = {
    examId: 'demo-exam',
    examName: 'Demo Exam',
    stageId: 'demo-stage',
    stageName: 'Written',
    taxonomy: [
      { id: 'alpha', name: 'Alpha', topics: [] },
      { id: 'beta', name: 'Beta', topics: [] },
      { id: 'gamma', name: 'Gamma', topics: [] },
    ],
    marking: { negativeMarking: true, negativeMarkValue: 0.33, marksPerQuestion: 1, perSectionNegative: false },
    totalQuestions: 60,
    totalMarks: 60,
    durationSec: 3600,
  };

  it('computes negative-mark loss from the configured deduction', () => {
    const m = buildAttemptReport(detail(block('Alpha', 10, 12, 0)), {}, examWithNegative as any);
    expect(m.analyses.negativeMarks.state).toBe('AVAILABLE');
    // 12 wrong × 0.33 = 3.96
    expect(m.analyses.negativeMarks.marksLost).toBeCloseTo(3.96, 2);
  });

  it('says so plainly when the exam carries no negative marking', () => {
    const noNegative = { ...examWithNegative, marking: { ...examWithNegative.marking, negativeMarking: false } };
    const m = buildAttemptReport(detail(block('Alpha', 10, 12, 0)), {}, noNegative as any);
    expect(m.analyses.negativeMarks.state).toBe('DATA_UNAVAILABLE');
    expect(m.analyses.negativeMarks.reason).toMatch(/no negative marking/i);
  });

  it('will not guess a single deduction when sections disagree', () => {
    const perSection = {
      ...examWithNegative,
      marking: { negativeMarking: true, negativeMarkValue: null, marksPerQuestion: null, perSectionNegative: true },
    };
    const m = buildAttemptReport(detail(block('Alpha', 10, 12, 0)), {}, perSection as any);
    expect(m.analyses.negativeMarks.state).toBe('DATA_UNAVAILABLE');
    expect(m.analyses.negativeMarks.marksLost).toBeNull();
  });

  it('keeps a subject the paper carried but the student skipped', () => {
    // 10 questions asked, none attempted — a real result about this attempt.
    const m = buildAttemptReport(detail([...block('Alpha', 10, 10, 0), ...block('Beta', 0, 0, 10)]), {}, examWithNegative as any);
    const beta = m.subjects.find(s => s.name === 'Beta')!;
    expect(beta.state).toBe('NOT_ASSESSED');
    expect(beta.metrics.questions).toBe(10);
    expect(beta.metrics.accuracy).toBeNull();
  });

  it('does not invent rows for configured subjects this paper never asked about', () => {
    // Gamma is in the exam's syllabus but carries no question here — that is a
    // coverage fact about the syllabus, not a result in this attempt.
    const m = buildAttemptReport(detail(block('Alpha', 10, 10, 0)), {}, examWithNegative as any);
    expect(m.subjects.map(s => s.name)).toEqual(['Alpha']);
  });

  it('takes the allowed duration from the exam pattern', () => {
    const m = buildAttemptReport(detail(block('Alpha', 10, 10, 0)), {}, examWithNegative as any);
    expect(m.summary.timeAllowedSec).toBe(3600);
  });

  it('falls back to defaults with no exam configured', () => {
    const m = buildAttemptReport(detail(block('Alpha', 10, 10, 0)));
    expect(m.summary.timeAllowedSec).toBeNull();
    expect(m.analyses.negativeMarks.state).toBe('DATA_UNAVAILABLE');
  });
});

// ─── Coverage: the unattempted half of the paper ──────────────────────────────

describe('unattempted areas get content and guidance, not just a label', () => {
  const exam = {
    examId: 'e1',
    examName: 'Demo',
    stageId: 's1',
    stageName: 'Written',
    taxonomy: [
      { id: 'alpha', name: 'Alpha', topics: [{ id: 't1', name: 'Topic One' }, { id: 't2', name: 'Topic Two' }] },
      { id: 'beta', name: 'Beta', topics: [{ id: 't3', name: 'Topic Three' }] },
    ],
    marking: { negativeMarking: false, negativeMarkValue: null, marksPerQuestion: 1, perSectionNegative: false },
    totalQuestions: 40,
    totalMarks: 40,
    durationSec: 3600,
  };

  it('lists partly-done subjects alongside untouched ones', () => {
    const m = buildAttemptReport(
      detail([...block('Alpha', 5, 5, 10), ...block('Beta', 0, 0, 20)]),
      {},
      exam as any,
    );
    const names = m.coverage.rows.map(r => r.name);
    expect(names).toContain('Alpha');
    expect(names).toContain('Beta');
    expect(m.coverage.rows.find(r => r.name === 'Alpha')!.state).toBe('PARTIAL');
    expect(m.coverage.rows.find(r => r.name === 'Beta')!.state).toBe('NOT_ASSESSED');
  });

  it('surfaces the syllabus topics behind each unattempted subject', () => {
    const m = buildAttemptReport(detail(block('Alpha', 5, 5, 10)), {}, exam as any);
    const alpha = m.coverage.rows.find(r => r.name === 'Alpha')!;
    expect(alpha.topics).toEqual(['Topic One', 'Topic Two']);
    expect(alpha.action).toMatch(/Topic One/);
  });

  it('counts the marks sitting in unanswered questions', () => {
    const m = buildAttemptReport(
      detail(block('Alpha', 5, 5, 10), {
        performance_breakdown: {
          overall_distribution: { correct: 5, incorrect: 5, unattempted: 10, total: 20 },
          subject_breakdown: [
            {
              subject: 'Alpha',
              total_questions: 20,
              correct: 5,
              incorrect: 5,
              unattempted: 10,
              accuracy_percentage: 50,
              estimated_marks: 5,
              max_marks: 20,
            },
          ],
          feedback: { performance_level: 'developing', motivation: null, strengths: [], improvement_areas: [] },
        },
      } as Partial<AttemptDetailResponse>),
      exam as any,
    );
    const alpha = m.coverage.rows.find(r => r.name === 'Alpha')!;
    // 20 marks over 20 questions = 1 each; 10 skipped = 10 marks at stake.
    expect(alpha.marksAtStake).toBe(10);
    expect(m.coverage.marksAtStake).toBe(10);
  });

  it('varies the instruction by whether there is evidence to build on', () => {
    const untouched = buildAttemptReport(detail(block('Beta', 0, 0, 20)), {}, exam as any);
    const strongButThin = buildAttemptReport(detail(block('Alpha', 9, 1, 30)), {}, exam as any);
    const weakAndThin = buildAttemptReport(detail(block('Alpha', 1, 9, 30)), {}, exam as any);

    expect(untouched.coverage.rows[0].action).toMatch(/diagnostic/i);
    expect(strongButThin.coverage.rows[0].action).toMatch(/under time|reach/i);
    expect(weakAndThin.coverage.rows[0].action).toMatch(/Rebuild/i);

    const actions = [
      untouched.coverage.rows[0].action,
      strongButThin.coverage.rows[0].action,
      weakAndThin.coverage.rows[0].action,
    ];
    expect(new Set(actions).size).toBe(3);
  });

  it('ranks by marks at stake rather than by apparent weakness', () => {
    // Beta is weaker on accuracy but Alpha holds far more unanswered questions.
    const m = buildAttemptReport(
      detail([...block('Alpha', 8, 2, 60), ...block('Beta', 1, 9, 5)]),
      {},
      exam as any,
    );
    expect(m.coverage.rows[0].name).toBe('Alpha');
  });

  it('says so plainly when nothing was skipped', () => {
    const m = buildAttemptReport(detail(block('Alpha', 10, 10, 0)), {}, exam as any);
    expect(m.coverage.rows).toHaveLength(0);
    expect(m.coverage.whatThisMeans).toMatch(/no coverage gap/i);
  });
});

// ─── Both payload shapes ──────────────────────────────────────────────────────

describe('the flat admin payload reads the same as the nested student one', () => {
  /** What the Evaluation Hub returns: flat root, `student_answer` on questions. */
  const adminShape = {
    attempt_id: 'a9',
    assessment_title: 'Mock 02',
    student_name: 'Sanjana',
    started_at: '2026-09-08T10:00:00Z',
    submitted_at: '2026-09-08T10:30:00Z',
    score: 6,
    max_score: 20,
    percentage: 30,
    status: 'submitted',
    correct_count: 6,
    wrong_count: 4,
    unanswered_count: 10,
    questions: [
      ...Array.from({ length: 6 }, (_, i) => ({
        id: `q${i}`,
        text: 'stem',
        subject: 'Tamil',
        student_answer: 'a',
        is_correct: true,
        difficulty: 'medium',
        type: 'standard',
      })),
      ...Array.from({ length: 4 }, (_, i) => ({
        id: `w${i}`,
        text: 'stem',
        subject: 'Tamil',
        student_answer: 'b',
        is_correct: false,
        difficulty: 'medium',
        type: 'standard',
      })),
      ...Array.from({ length: 10 }, (_, i) => ({
        id: `s${i}`,
        text: 'stem',
        subject: 'Tamil',
        student_answer: null,
        is_correct: false,
        difficulty: 'medium',
        type: 'standard',
      })),
    ],
  } as unknown as AttemptDetailResponse;

  it('counts student_answer as attempted', () => {
    const m = buildAttemptReport(adminShape);
    // Was reading 0 attempted, which rendered a whole paper as "Not assessed".
    expect(m.summary.attempted).toBe(10);
    expect(m.summary.correct).toBe(6);
    expect(m.summary.incorrect).toBe(4);
    expect(m.summary.unattempted).toBe(10);
    expect(m.summary.accuracy).toBe(60);
  });

  it('reads attempt meta from the flat root', () => {
    const m = buildAttemptReport(adminShape);
    expect(m.meta.testName).toBe('Mock 02');
    expect(m.meta.date).toBe('2026-09-08T10:00:00Z');
    expect(m.summary.score).toBe(6);
    expect(m.summary.maxMarks).toBe(20);
  });

  it('derives elapsed time from the timestamps when stats are absent', () => {
    const m = buildAttemptReport(adminShape);
    expect(m.summary.timeUsedSec).toBe(1800);
    expect(m.analyses.time.state).toBe('AVAILABLE');
  });

  it('picks up question text, type and subject under their admin names', () => {
    const m = buildAttemptReport(adminShape);
    expect(m.subjects.map(s => s.name)).toEqual(['Tamil']);
    expect(m.analyses.questionType.state).toBe('AVAILABLE');
    expect(m.analyses.questionType.rows[0].label).toBe('Standard');
  });

  it('leaves the nested student payload untouched', () => {
    const m = buildAttemptReport(detail(block('Tamil', 6, 4, 10)));
    expect(m.summary.attempted).toBe(10);
    expect(m.summary.accuracy).toBe(60);
  });
});

// ─── Topic tagging ─────────────────────────────────────────────────────────────

describe('topic breakdown', () => {
  it('stays empty, and says so, when no question carries a tag', () => {
    const m = buildAttemptReport(detail(block('Tamil', 5, 5, 0)));
    expect(m.subjects[0].topics).toEqual([]);
    expect(m.dataQuality.missingTopicTags).toBe(true);
  });

  it('groups a subject by topic and reports per-topic accuracy', () => {
    const m = buildAttemptReport(
      detail([
        ...block('Tamil', 4, 1, 0, { topic: 'Grammar' }),
        ...block('Tamil', 1, 3, 1, { topic: 'Literature' }),
      ]),
    );
    const tamil = m.subjects.find(x => x.name === 'Tamil')!;
    expect(m.dataQuality.missingTopicTags).toBe(false);
    // Both carry 5 questions, so the alphabetical tiebreak decides the order.
    expect(tamil.topics.map(t => t.name)).toEqual(['Grammar', 'Literature']);

    const grammar = tamil.topics.find(t => t.name === 'Grammar')!;
    expect(grammar.metrics.questions).toBe(5);
    expect(grammar.metrics.attempted).toBe(5);
    expect(grammar.metrics.accuracy).toBe(80);

    const lit = tamil.topics.find(t => t.name === 'Literature')!;
    expect(lit.metrics.questions).toBe(5);
    expect(lit.metrics.attempted).toBe(4);
    expect(lit.metrics.accuracy).toBe(25);
  });

  it('reads the question bank’s `chapter` as the topic', () => {
    const m = buildAttemptReport(detail(block('Tamil', 3, 0, 0, { chapter: 'Grammar' })));
    expect(m.subjects[0].topics.map(t => t.name)).toEqual(['Grammar']);
  });

  it('nests sub-topics under their topic', () => {
    const m = buildAttemptReport(
      detail([
        ...block('Tamil', 2, 0, 0, { topic: 'Grammar', subtopic: 'Sandhi' }),
        ...block('Tamil', 0, 2, 0, { topic: 'Grammar', subtopic: 'Verbs' }),
      ]),
    );
    const grammar = m.subjects[0].topics[0];
    expect(grammar.name).toBe('Grammar');
    expect(grammar.metrics.questions).toBe(4);
    expect(grammar.subtopics.map(x => [x.name, x.metrics.accuracy])).toEqual([
      ['Sandhi', 100],
      ['Verbs', 0],
    ]);
  });

  it('never pools untagged questions into a bucket that reads as a topic', () => {
    const m = buildAttemptReport(
      detail([...block('Tamil', 3, 0, 0, { topic: 'Grammar' }), ...block('Tamil', 2, 0, 0)]),
    );
    const tamil = m.subjects[0];
    // The subject counts all five; only the tagged three appear as a topic.
    expect(tamil.metrics.questions).toBe(5);
    expect(tamil.topics).toHaveLength(1);
    expect(tamil.topics[0].metrics.questions).toBe(3);
  });

  it('shows an unattempted topic as not assessed, never as 0% ability', () => {
    const m = buildAttemptReport(detail(block('Tamil', 0, 0, 6, { topic: 'Literature' })));
    const topic = m.subjects[0].topics[0];
    expect(topic.state).toBe('NOT_ASSESSED');
    expect(topic.metrics.accuracy).toBeNull();
  });
});

// ─── Non-Latin taxonomy names ──────────────────────────────────────────────────

/**
 * A Group 4 paper names every subject, topic and sub-topic in Tamil script. The
 * first grouping key was `[^a-z0-9]`-filtered, which reduced all of them to the
 * same string: eight subjects rendered as one row carrying all 200 questions, and
 * the marks lookup resolved every subject to whichever breakdown row was written
 * last. These are the real names from that payload.
 */
describe('Tamil-script names', () => {
  const TAMIL = '\u0ba4\u0bae\u0bbf\u0bb4\u0bcd \u0ba4\u0b95\u0bc1\u0ba4\u0bbf';
  const SCIENCE = '\u0baa\u0bc6\u0bbe\u0ba4\u0bc1 \u0b85\u0bb1\u0bbf\u0bb5\u0bbf\u0baf\u0bb2\u0bcd';
  const GEOGRAPHY = '\u0baa\u0bc1\u0bb5\u0bbf\u0baf\u0bbf\u0baf\u0bb2\u0bcd';

  it('keeps each subject as its own row instead of collapsing them', () => {
    const m = buildAttemptReport(
      detail([
        ...block(TAMIL, 0, 1, 99),
        ...block(SCIENCE, 0, 2, 16),
        ...block(GEOGRAPHY, 0, 0, 10),
      ]),
    );
    expect(m.subjects).toHaveLength(3);
    expect(m.subjects.map(x => x.name).sort()).toEqual([TAMIL, SCIENCE, GEOGRAPHY].sort());

    const tamil = m.subjects.find(x => x.name === TAMIL)!;
    expect(tamil.metrics.questions).toBe(100);
    expect(tamil.metrics.attempted).toBe(1);

    const geo = m.subjects.find(x => x.name === GEOGRAPHY)!;
    expect(geo.metrics.questions).toBe(10);
    expect(geo.state).toBe('NOT_ASSESSED');
  });

  it('gives each subject its own marks row rather than the last one written', () => {
    const m = buildAttemptReport(
      detail([...block(TAMIL, 0, 1, 99), ...block(GEOGRAPHY, 0, 0, 10)], {
        performance_breakdown: {
          overall_distribution: { correct: 0, incorrect: 1, unattempted: 109, total: 110 },
          subject_breakdown: [
            {
              subject: TAMIL,
              total_questions: 100,
              correct: 0,
              incorrect: 1,
              unattempted: 99,
              accuracy_percentage: 0,
              estimated_marks: 0,
              max_marks: 150,
            },
            {
              subject: GEOGRAPHY,
              total_questions: 10,
              correct: 0,
              incorrect: 0,
              unattempted: 10,
              accuracy_percentage: 0,
              estimated_marks: 0,
              max_marks: 15,
            },
          ],
        },
      } as any),
    );
    expect(m.subjects.find(x => x.name === TAMIL)!.metrics.marksAvailable).toBe(150);
    expect(m.subjects.find(x => x.name === GEOGRAPHY)!.metrics.marksAvailable).toBe(15);
  });

  it('keeps Tamil-named topics and sub-topics distinct', () => {
    const GRAMMAR = '\u0b87\u0bb2\u0b95\u0bcd\u0b95\u0ba3\u0bae\u0bcd';
    const LITERATURE = '\u0b87\u0bb2\u0b95\u0bcd\u0b95\u0bbf\u0baf\u0bae\u0bcd';
    const m = buildAttemptReport(
      detail([
        ...block(TAMIL, 1, 1, 0, { topic: GRAMMAR }),
        ...block(TAMIL, 0, 2, 0, { topic: LITERATURE }),
      ]),
    );
    expect(m.subjects[0].topics.map(t => t.name).sort()).toEqual([GRAMMAR, LITERATURE].sort());
  });

  it('groups on the backend id when one is sent, across two language spellings', () => {
    const m = buildAttemptReport(
      detail([
        ...block(TAMIL, 1, 0, 0, { subject_id: 'general-science' }),
        ...block('General Science', 0, 1, 0, { subject_id: 'general-science' }),
      ]),
    );
    // One subject, not two — the id is what identifies it.
    expect(m.subjects).toHaveLength(1);
    expect(m.subjects[0].metrics.questions).toBe(2);
  });
});

// ─── Subject labels across two languages ───────────────────────────────────────

describe('subject labels', () => {
  const GEO_TA = '\u0baa\u0bc1\u0bb5\u0bbf\u0baf\u0bbf\u0baf\u0bb2\u0bcd';

  /** A minimal exam context: one subject the catalog knows in both languages. */
  const exam = {
    examId: 'group-4',
    examName: 'TNPSC Group 4',
    stageId: 'group-4-written',
    stageName: 'Written Examination',
    taxonomy: [
      {
        id: 'geography',
        name: 'Geography of India',
        nameLocal: '\u0b87\u0ba8\u0bcd\u0ba4\u0bbf\u0baf \u0baa\u0bc1\u0bb5\u0bbf\u0baf\u0bbf\u0baf\u0bb2\u0bcd',
        aliases: [GEO_TA],
        topics: [],
      },
    ],
    marking: null,
    totalQuestions: null,
    totalMarks: null,
    durationSec: null,
  } as any;

  it('resolves the English label from the id the backend sends', () => {
    const m = buildAttemptReport(detail(block(GEO_TA, 2, 1, 0, { subject_id: 'geography' })), {}, exam);
    expect(m.subjects[0].name).toBe('Geography of India');
    expect(m.subjects[0].nameLocal).toBe(exam.taxonomy[0].nameLocal);
  });

  it('resolves it from a configured alias when no id is sent', () => {
    const m = buildAttemptReport(detail(block(GEO_TA, 2, 1, 0)), {}, exam);
    expect(m.subjects[0].name).toBe('Geography of India');
  });

  it("uses the backend's canonical name when the catalog does not know the subject", () => {
    const m = buildAttemptReport(
      detail(block('\u0baa\u0bc6\u0bbe\u0ba4\u0bc1', 1, 0, 0, { subject_name: 'General Science' })),
      {},
      exam,
    );
    expect(m.subjects[0].name).toBe('General Science');
    // The paper's own wording is kept, so the Tamil reading still has a label.
    expect(m.subjects[0].nameLocal).toBe('\u0baa\u0bc6\u0bbe\u0ba4\u0bc1');
  });

  it("falls back to the paper's wording rather than blanking the cell", () => {
    const m = buildAttemptReport(detail(block(GEO_TA, 1, 0, 0)));
    expect(m.subjects[0].name).toBe(GEO_TA);
    expect(m.subjects[0].nameLocal).toBeNull();
  });

  it('names the subject in the diagnosis with the resolved label', () => {
    const m = buildAttemptReport(detail(block(GEO_TA, 0, 3, 0, { subject_id: 'geography' })), {}, exam);
    expect(m.subjects[0].diagnosis).toContain('Geography of India');
  });
});

// ─── What the radar plots ──────────────────────────────────────────────────────

describe('proficiency radar', () => {
  it('plots accuracy, and carries share-of-marks beside it', () => {
    // 20 questions, 10 answered, 2 right. Accuracy is 20%; the subject earned
    // 2 of 20 marks, so its share of the marks is 10% — two different numbers,
    // and the tooltip has to be able to name both.
    const m = buildAttemptReport(
      detail(block('Polity', 2, 8, 10), {
        performance_breakdown: {
          overall_distribution: { correct: 2, incorrect: 8, unattempted: 10, total: 20 },
          subject_breakdown: [
            {
              subject: 'Polity',
              total_questions: 20,
              correct: 2,
              incorrect: 8,
              unattempted: 10,
              accuracy_percentage: 20,
              estimated_marks: 2,
              max_marks: 20,
            },
          ],
        },
      } as any),
    );
    const row = m.radar[0];
    expect(row.value).toBe(20);
    expect(row.correct).toBe(2);
    expect(row.evidenceCount).toBe(10);
    expect(row.questions).toBe(20);
    expect(row.scorePct).toBe(10);
    expect(row.marksEarned).toBe(2);
    expect(row.marksAvailable).toBe(20);
  });

  it('plots nothing for an unassessed subject rather than a zero', () => {
    const m = buildAttemptReport(detail(block('Polity', 0, 0, 12)));
    expect(m.radar[0].value).toBeNull();
    expect(m.radar[0].state).toBe('NOT_ASSESSED');
    expect(m.radar[0].questions).toBe(12);
  });
});

// ─── One subject, two wordings ─────────────────────────────────────────────────

describe('subjects tagged two ways', () => {
  /** A 40-question paper: one subject the catalog knows under two names. */
  const exam = {
    examId: 'group-4',
    examName: 'TNPSC Group 4',
    stageId: 'group-4-written',
    stageName: 'Written',
    taxonomy: [
      {
        id: 'tn-history',
        name: 'History, Culture & Socio-Political Movements of Tamil Nadu',
        aliases: ['Tamil Nadu History, Culture & Socio-Political Movements'],
        topics: [],
      },
      { id: 'polity', name: 'Indian Polity', topics: [] },
    ],
    marking: null,
    totalQuestions: 40,
    totalMarks: null,
    durationSec: null,
  } as any;

  const bothWordings = () => [
    ...block('History, Culture & Socio-Political Movements of Tamil Nadu', 0, 1, 0),
    ...block('Tamil Nadu History, Culture & Socio-Political Movements', 1, 18, 0),
    ...block('Indian Polity', 0, 20, 0),
  ];

  const breakdown = {
    overall_distribution: { correct: 1, incorrect: 39, unattempted: 0, total: 40 },
    subject_breakdown: [
      {
        subject: 'Tamil Nadu History, Culture & Socio-Political Movements',
        total_questions: 20,
        correct: 1,
        incorrect: 19,
        unattempted: 0,
        accuracy_percentage: 5,
        estimated_marks: 1.5,
        max_marks: 30,
      },
      {
        subject: 'Indian Polity',
        total_questions: 20,
        correct: 0,
        incorrect: 20,
        unattempted: 0,
        accuracy_percentage: 0,
        estimated_marks: 0,
        max_marks: 30,
      },
    ],
  };

  it('merges them into one row', () => {
    const m = buildAttemptReport(detail(bothWordings(), { performance_breakdown: breakdown } as any), {}, exam);
    expect(m.subjects).toHaveLength(2);
    const tn = m.subjects.find(x => x.subjectId === 'tn-history')!;
    expect(tn.metrics.questions).toBe(20);
    expect(tn.metrics.attempted).toBe(20);
  });

  it("does not inflate the paper's question count", () => {
    const m = buildAttemptReport(detail(bothWordings(), { performance_breakdown: breakdown } as any), {}, exam);
    const total = m.subjects.reduce((n, x) => n + x.metrics.questions, 0);
    expect(total).toBe(40);
    expect(m.dataQuality.warnings.join(' ')).not.toContain('questions but the paper carries');
  });

  it('still finds the marks row after the merge', () => {
    const m = buildAttemptReport(detail(bothWordings(), { performance_breakdown: breakdown } as any), {}, exam);
    const tn = m.subjects.find(x => x.subjectId === 'tn-history')!;
    expect(tn.metrics.marksAvailable).toBe(30);
    expect(tn.metrics.marksEarned).toBe(1.5);
  });

  it('warns when two unresolvable wordings still split a subject', () => {
    // No exam configuration, so nothing can merge them — the report must say the
    // totals do not add up rather than present 40 questions as 60.
    const m = buildAttemptReport(
      detail(bothWordings(), { performance_breakdown: breakdown } as any),
    );
    expect(m.subjects.length).toBe(3);
    // It cannot silently present a wrong total: the mismatch is stated.
    expect(m.dataQuality.warnings.join(' ')).toContain('questions but the paper carries');
  });
});
