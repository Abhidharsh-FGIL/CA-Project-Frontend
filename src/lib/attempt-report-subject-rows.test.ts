/**
 * Subject rows must add up to the paper.
 *
 * The report warned "Subject rows account for 86 questions but the paper carries 200"
 * and "…32 attempted questions but the attempt records 98" on a Group 4 attempt, and
 * listed General Tamil and Aptitude as "not assessed" though both had been answered.
 *
 * The cause: the server's marks table is grouped by the subject *as tagged*, so one
 * subject can arrive as several rows — "General Tamil" and "தகவல் தொழில்நுட்பம்" (a
 * Tamil technical-terms question, tagged by the discipline it is about). The questions
 * all resolve to one subject, but the report claimed only one of those rows for it, and
 * the others were then added "so a skipped subject still shows" — by *replacing* the
 * subject's entry with an empty one. Every question in it vanished from the rows.
 */
import { describe, expect, it } from 'vitest';
import { buildAttemptReport } from './attempt-report';
import { resolveExamContext } from './exam-report-config';
import type { AttemptDetailResponse, QuestionReviewItem } from './userPortalApi';

const exam = resolveExamContext({ groupId: 'group-4', stageId: 'group-4-written' });

let seq = 0;
function q(over: Partial<QuestionReviewItem> & { chapter?: string }): QuestionReviewItem {
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
    time_spent_seconds: 20,
    subject: 'General Tamil',
    difficulty: 'medium',
    explanation: null,
    tip: null,
    ...over,
  } as QuestionReviewItem;
}

const many = (n: number, over: Partial<QuestionReviewItem> & { chapter?: string }) =>
  Array.from({ length: n }, () => q(over));

/** One server marks row, as the backend groups them: by subject as tagged. */
const row = (subject: string, total: number, correct: number, incorrect: number, marks: number, max: number) => ({
  subject,
  total_questions: total,
  correct,
  incorrect,
  unattempted: total - correct - incorrect,
  accuracy_percentage: correct + incorrect > 0 ? (correct / (correct + incorrect)) * 100 : 0,
  estimated_marks: marks,
  max_marks: max,
});

/**
 * 200 questions, as a Group 4 sheet really tags them: ten Tamil technical-terms questions
 * carry the discipline (`தகவல் தொழில்நுட்பம்`) as Subject and the unit as Topic, the rest of
 * the Tamil paper says `General Tamil`.
 */
function attempt(): AttemptDetailResponse {
  const questions = [
    ...many(10, { subject: 'தகவல் தொழில்நுட்பம்', chapter: 'கலைச் சொற்கள்', is_correct: false, user_answer: 'b' }),
    ...many(90, { subject: 'General Tamil', chapter: 'இலக்கணம்' }),
    ...many(75, { subject: 'Indian Polity' }),
    ...many(25, { subject: 'Aptitude & Mental Ability', chapter: 'Aptitude' }),
  ];
  return {
    attempt: {
      attempt_id: 'a1', test_name: 'Mock', test_mode: 'mock', course_id: null, subject: null,
      score: 150, max_score: 300, percentage: 50,
      start_time: '2026-10-09T10:00:00Z', end_time: '2026-10-09T13:00:00Z',
      status: 'submitted', auto_submitted: false, malpractice_events: [], attempt_type: 'test',
    },
    stats: { correct_count: 190, incorrect_count: 10, unattempted_count: 0, avg_time_per_question: 20, slow_question_count: 0, time_taken_seconds: 4000 },
    questions,
    performance_breakdown: {
      overall_distribution: { correct: 190, incorrect: 10, unattempted: 0, total: 200 },
      subject_breakdown: [
        row('தகவல் தொழில்நுட்பம்', 10, 0, 10, 0, 15),
        row('General Tamil', 90, 90, 0, 135, 135),
        row('Indian Polity', 75, 75, 0, 75, 75),
        row('Aptitude & Mental Ability', 25, 25, 0, 25, 25),
      ],
      feedback: { performance_level: 'developing', motivation: null, strengths: [], improvement_areas: [] },
    },
  } as unknown as AttemptDetailResponse;
}

describe('a subject that arrives as several marks rows', () => {
  const m = buildAttemptReport(attempt(), {}, exam);
  const byName = (name: string) => m.subjects.find(s => s.name === name);

  it('raises no reconciliation warning', () => {
    const mismatch = m.dataQuality.warnings.filter(w => /Subject rows account for/.test(w));
    expect(mismatch).toEqual([]);
  });

  it('accounts for every question and every attempt', () => {
    expect(m.subjects.reduce((n, s) => n + s.metrics.questions, 0)).toBe(200);
    expect(m.subjects.reduce((n, s) => n + s.metrics.attempted, 0)).toBe(200);
  });

  it('keeps all of General Tamil in one row — including the discipline-tagged questions', () => {
    const tamil = byName('General Tamil');
    expect(tamil?.metrics.questions).toBe(100);
    expect(tamil?.metrics.attempted).toBe(100);
  });

  it('does not report an answered subject as not assessed', () => {
    expect(m.subjects.filter(s => s.state === 'NOT_ASSESSED').map(s => s.name)).toEqual([]);
  });

  it('does not show the discipline as a subject of its own', () => {
    expect(m.subjects.map(s => s.name)).not.toContain('தகவல் தொழில்நுட்பம்');
  });

  it('adds the marks of every row the subject arrived as', () => {
    const tamil = byName('General Tamil')!;
    expect(tamil.metrics.marksEarned).toBe(135);
    expect(tamil.metrics.marksAvailable).toBe(150); // 135 + 15
  });
});

/**
 * The other way it went wrong: two server rows that both resolve to one subject
 * ("General Tamil" and the commission's own name for the paper), where the second
 * `set` over the first's group and emptied it.
 */
describe('two marks rows that resolve to the same subject', () => {
  const TAMIL_PAPER = 'தமிழ் தகுதி மற்றும் மதிப்பீட்டுத் தேர்வு';
  function wiped(): AttemptDetailResponse {
    const d = attempt() as any;
    d.questions = [
      ...many(60, { subject: 'General Tamil', chapter: 'இலக்கணம்' }),
      ...many(40, { subject: TAMIL_PAPER }),
      ...many(75, { subject: 'Indian Polity' }),
      ...many(25, { subject: 'Aptitude & Mental Ability', chapter: 'Aptitude' }),
    ];
    d.stats = { ...d.stats, correct_count: 200, incorrect_count: 0, unattempted_count: 0 };
    d.performance_breakdown.overall_distribution = { correct: 200, incorrect: 0, unattempted: 0, total: 200 };
    d.performance_breakdown.subject_breakdown = [
      row('General Tamil', 60, 60, 0, 90, 90),
      row(TAMIL_PAPER, 40, 40, 0, 60, 60),
      row('Indian Polity', 75, 75, 0, 75, 75),
      row('Aptitude & Mental Ability', 25, 25, 0, 25, 25),
    ];
    return d;
  }
  const m = buildAttemptReport(wiped(), {}, exam);

  it('keeps every question in the subject', () => {
    expect(m.subjects.find(s => s.name === 'General Tamil')?.metrics.questions).toBe(100);
  });

  it('adds up to the paper, with no warning', () => {
    expect(m.subjects.reduce((n, s) => n + s.metrics.questions, 0)).toBe(200);
    expect(m.subjects.reduce((n, s) => n + s.metrics.attempted, 0)).toBe(200);
    expect(m.dataQuality.warnings.filter(w => /Subject rows account for/.test(w))).toEqual([]);
  });

  it('shows the answered subjects as measured, not as not assessed', () => {
    expect(m.subjects.filter(s => s.state === 'NOT_ASSESSED')).toEqual([]);
  });

  it('adds both rows’ marks', () => {
    expect(m.subjects.find(s => s.name === 'General Tamil')?.metrics.marksEarned).toBe(150);
  });
});

describe('a subject the student really skipped still reads as not assessed', () => {
  it('keeps a server row that none of the questions belong to', () => {
    const d = attempt() as any;
    d.performance_breakdown.subject_breakdown.push(row('Geography', 5, 0, 0, 0, 5));
    const m = buildAttemptReport(d, {}, exam);
    // Shown under the catalog's name for it, with no answers behind it.
    const geography = m.subjects.find(s => /Geography/.test(s.name));
    expect(geography).toBeDefined();
    expect(geography!.state).toBe('NOT_ASSESSED');
  });
});
