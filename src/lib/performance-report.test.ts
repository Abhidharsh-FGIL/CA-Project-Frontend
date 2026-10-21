import { describe, expect, it } from 'vitest';
import { buildPerformanceReport, combineAttemptDetails } from './performance-report';
import type { AttemptDetailResponse, QuestionReviewItem } from './userPortalApi';

let n = 0;
const q = (over: Partial<QuestionReviewItem>): QuestionReviewItem =>
  ({
    question_id: 'same-id', // a paper repeated across attempts reuses its ids
    number: ++n,
    body: 'stem',
    options: ['a', 'b'],
    correct_answer: 'a',
    user_answer: 'a',
    is_correct: true,
    time_spent_seconds: 20,
    subject: 'General Tamil',
    ...over,
  }) as QuestionReviewItem;
const many = (k: number, over: Partial<QuestionReviewItem>) => Array.from({ length: k }, () => q(over));
const wrong = { is_correct: false } as Partial<QuestionReviewItem>;

const detail = (questions: QuestionReviewItem[]): AttemptDetailResponse =>
  ({
    attempt: {
      attempt_id: 'a', test_name: 'Mock', test_mode: 'mock', course_id: null, subject: null, score: 0, max_score: 0,
      percentage: 0, start_time: '2026-10-09T10:00:00Z', end_time: '2026-10-09T13:00:00Z', status: 'submitted',
      auto_submitted: false, malpractice_events: [], attempt_type: 'test',
    },
    stats: null,
    questions,
  }) as unknown as AttemptDetailResponse;

const grammar = { unit_id: 'u-grammar', unit_name: 'இலக்கணம்', category: 'அணி', subtopic: 'உவமை' };

describe('the Performance page’s pooled report', () => {
  it('pools every attempt’s questions under one id each, so a repeated paper is not collapsed', () => {
    const c = combineAttemptDetails([detail(many(3, grammar)), detail(many(3, grammar))])!;
    const ids = c.detail.questions.map(x => x.question_id);
    expect(new Set(ids).size).toBe(6);
  });

  it('adds the attempts up: a unit’s counts are all attempts’ questions in it', () => {
    const { model } = buildPerformanceReport([
      detail([...many(6, grammar), ...many(4, { ...grammar, ...wrong })]),
      detail([...many(2, grammar), ...many(8, { ...grammar, ...wrong })]),
    ]);
    const unit = model!.subjects.find(s => s.name === 'இலக்கணம்')!;
    expect(unit.metrics).toMatchObject({ questions: 20, attempted: 20, correct: 8, incorrect: 12 });
    expect(model!.groupedBy).toBe('unit');
  });

  it('opens a unit to its categories and their sub-categories', () => {
    const { model } = buildPerformanceReport([detail(many(5, grammar))]);
    const unit = model!.subjects[0];
    expect(unit.topics.map(t => t.name)).toEqual(['அணி']);
    expect(unit.topics[0].subtopics.map(s => s.name)).toEqual(['உவமை']);
  });

  it('leaves out, and counts, questions that name no unit', () => {
    const r = buildPerformanceReport([detail([...many(5, grammar), ...many(3, { subject: 'History' })])]);
    expect(r.included).toBe(5);
    expect(r.untagged).toBe(3);
    expect(r.model!.summary.totalQuestions).toBe(5);
  });

  it('has no report when no question names a unit', () => {
    const r = buildPerformanceReport([detail(many(4, { subject: 'History' }))]);
    expect(r.model).toBeNull();
    expect(r.untagged).toBe(4);
  });
});
