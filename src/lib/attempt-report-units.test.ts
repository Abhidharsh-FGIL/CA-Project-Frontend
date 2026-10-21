/**
 * A report by syllabus unit: each unit is a row, named for the unit, with its categories (and their
 * sub-categories) under it — and the marks the server scored by subject shared out among the units.
 */
import { describe, expect, it } from 'vitest';
import { buildAttemptReport } from './attempt-report';
import { resolveExamContext } from './exam-report-config';
import type { AttemptDetailResponse, QuestionReviewItem } from './userPortalApi';

const exam = resolveExamContext({ groupId: 'group-4', stageId: 'group-4-written' });

let seq = 0;
function q(over: Partial<QuestionReviewItem>): QuestionReviewItem {
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

const many = (n: number, over: Partial<QuestionReviewItem>) => Array.from({ length: n }, () => q(over));
const skipped = { user_answer: null, is_correct: false } as Partial<QuestionReviewItem>;

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

const detail = (questions: QuestionReviewItem[], rows: ReturnType<typeof row>[]): AttemptDetailResponse =>
  ({
    attempt: {
      attempt_id: 'a1', test_name: 'Mock', test_mode: 'mock', course_id: null, subject: null,
      score: 0, max_score: 0, percentage: 0,
      start_time: '2026-10-09T10:00:00Z', end_time: '2026-10-09T13:00:00Z',
      status: 'submitted', auto_submitted: false, malpractice_events: [], attempt_type: 'test',
    },
    stats: null,
    questions,
    performance_breakdown: {
      overall_distribution: { correct: 0, incorrect: 0, unattempted: 0, total: questions.length },
      subject_breakdown: rows,
      feedback: { performance_level: 'developing', motivation: null, strengths: [], improvement_areas: [] },
    },
  }) as unknown as AttemptDetailResponse;

/**
 * 175 questions. General Tamil is two units — Grammar (60 questions: 45 right, 15 skipped; two categories) and
 * Literature (40: 15 right, 25 skipped) — and Indian Polity is one unit of 75, all right.
 * The server scored the Tamil subject as one row (90 of 150 marks) and Polity as another (75 of 75).
 */
function paper() {
  const grammar = { subject: 'General Tamil', unit_id: 'g4-ta-grammar', unit_name: 'இலக்கணம்' };
  const literature = { subject: 'General Tamil', unit_id: 'g4-ta-literature', unit_name: 'இலக்கியம்' };
  const polity = { subject: 'Indian Polity', unit_id: 'g4-polity', unit_name: 'Indian Constitution' };
  return detail(
    [
      ...many(30, { ...grammar, category: 'அணியிலக்கணம்', subtopic: 'உவமை' }),
      ...many(15, { ...grammar, category: 'புணர்ச்சி' }),
      ...many(15, { ...grammar, ...skipped, category: 'புணர்ச்சி' }),
      ...many(15, { ...literature, category: 'சங்க இலக்கியம்' }),
      ...many(25, { ...literature, ...skipped, category: 'சங்க இலக்கியம்' }),
      ...many(75, polity),
    ],
    [row('General Tamil', 100, 60, 0, 90, 150), row('Indian Polity', 75, 75, 0, 75, 75)],
  );
}

describe('a paper whose questions name their units', () => {
  const m = buildAttemptReport(paper(), {}, exam);
  const unit = (name: string) => m.subjects.find(s => s.name === name)!;

  it('is reported by unit', () => {
    expect(m.groupedBy).toBe('unit');
  });

  it('has a row for each unit, named for the unit — never renamed after its subject', () => {
    expect(m.subjects.map(s => s.name).sort()).toEqual(['Indian Constitution', 'இலக்கணம்', 'இலக்கியம்'].sort());
    expect(m.subjects.some(s => s.name === 'General Tamil')).toBe(false);
  });

  it('counts every question once, with no empty subject row beside the units', () => {
    expect(m.subjects).toHaveLength(3);
    expect(m.subjects.reduce((n, s) => n + s.metrics.questions, 0)).toBe(175);
  });

  it('gives each unit its own counts', () => {
    expect(unit('இலக்கணம்').metrics).toMatchObject({ questions: 60, attempted: 45, correct: 45, skipped: 15 });
    expect(unit('இலக்கியம்').metrics).toMatchObject({ questions: 40, attempted: 15, skipped: 25 });
  });

  it('lists the categories under a unit, with the sub-categories under those', () => {
    const grammar = unit('இலக்கணம்');
    expect(grammar.topics.map(t => t.name).sort()).toEqual(['அணியிலக்கணம்', 'புணர்ச்சி'].sort());
    const figure = grammar.topics.find(t => t.name === 'அணியிலக்கணம்')!;
    expect(figure.metrics.questions).toBe(30);
    expect(figure.subtopics.map(s => s.name)).toEqual(['உவமை']);
    expect(grammar.topics.find(t => t.name === 'புணர்ச்சி')!.metrics).toMatchObject({ questions: 30, attempted: 15, skipped: 15 });
  });

  it('shares the Tamil subject’s marks between its two units by question count and correct answers', () => {
    expect(unit('இலக்கணம்').metrics).toMatchObject({ marksAvailable: 90, marksEarned: 67.5 });
    expect(unit('இலக்கியம்').metrics).toMatchObject({ marksAvailable: 60, marksEarned: 22.5 });
  });

  it('shares add back up to the subject’s own marks', () => {
    const tamil = [unit('இலக்கணம்'), unit('இலக்கியம்')];
    expect(tamil.reduce((n, s) => n + (s.metrics.marksAvailable ?? 0), 0)).toBe(150);
    expect(tamil.reduce((n, s) => n + (s.metrics.marksEarned ?? 0), 0)).toBe(90);
  });

  it('gives a unit that is a whole subject all of that subject’s marks', () => {
    expect(unit('Indian Constitution').metrics).toMatchObject({ marksAvailable: 75, marksEarned: 75 });
  });
});

describe('the order of the unit rows', () => {
  it('lists Tamil units, then General Studies units, then Aptitude units', () => {
    const questions = [
      ...many(30, { subject: 'Aptitude & Mental Ability', unit_id: 'u-apt', unit_name: 'Aptitude' }),
      ...many(20, { subject: 'Indian Polity', unit_id: 'u-pol', unit_name: 'Indian Polity' }),
      ...many(10, { subject: 'General Tamil', unit_id: 'u-ta1', unit_name: 'இலக்கணம்' }),
      ...many(15, { subject: 'General Tamil', unit_id: 'u-ta2', unit_name: 'இலக்கியம்' }),
    ];
    const m = buildAttemptReport(detail(questions, []), {}, exam);
    expect(m.subjects.map(s => s.name)).toEqual(['இலக்கியம்', 'இலக்கணம்', 'Indian Polity', 'Aptitude']);
  });
});

describe('marks left on the table in a unit report', () => {
  it('prices every skipped question at the paper’s own rate', () => {
    const d = detail(
      [
        ...many(15, { subject: 'General Tamil', unit_id: 'u1', unit_name: 'A' }),
        ...many(5, { subject: 'General Tamil', unit_id: 'u1', unit_name: 'A', ...skipped }),
        ...many(15, { subject: 'Indian Polity', unit_id: 'u2', unit_name: 'B' }),
        ...many(5, { subject: 'Indian Polity', unit_id: 'u2', unit_name: 'B', ...skipped }),
      ],
      [row('General Tamil', 20, 15, 0, 10, 12), row('Indian Polity', 20, 15, 0, 10, 40)],
    );
    (d.attempt as any).max_score = 60; // 40 questions → 1.5 each
    const m = buildAttemptReport(d, {}, exam);
    expect(m.coverage.marksAtStake).toBe(15); // 10 skipped × 1.5
  });
});

describe('a paper whose questions mostly do not name a unit', () => {
  it('is reported by subject, as before', () => {
    const questions = [
      ...many(30, { subject: 'General Tamil', unit_id: 'g4-ta-grammar', unit_name: 'இலக்கணம்' }),
      ...many(70, { subject: 'General Tamil' }),
    ];
    const m = buildAttemptReport(detail(questions, [row('General Tamil', 100, 100, 0, 150, 150)]), {}, exam);
    expect(m.groupedBy).toBe('subject');
    expect(m.subjects.map(s => s.name)).toEqual(['General Tamil']);
  });

  it('keeps a unit report when only a few questions are untagged, grouping those by subject', () => {
    const questions = [
      ...many(60, { subject: 'Indian Polity', unit_id: 'g4-polity', unit_name: 'Indian Constitution' }),
      ...many(10, { subject: 'Aptitude & Mental Ability' }),
    ];
    const m = buildAttemptReport(detail(questions, [row('Indian Polity', 60, 60, 0, 60, 60), row('Aptitude & Mental Ability', 10, 10, 0, 10, 10)]), {}, exam);
    expect(m.groupedBy).toBe('unit');
    expect(m.subjects.reduce((n, s) => n + s.metrics.questions, 0)).toBe(70);
    expect(m.subjects.find(s => s.name === 'Indian Constitution')?.metrics.questions).toBe(60);
  });
});
