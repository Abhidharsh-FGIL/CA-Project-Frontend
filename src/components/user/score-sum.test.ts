import { describe, expect, it } from 'vitest';
import { scoreSum } from './AttemptDiagnosticReport';
import type { AttemptReportModel } from '@/lib/attempt-report';

/** Just the parts of a report the sum reads. */
const model = (summary: { score: number | null; maxMarks: number | null; totalQuestions: number; correct: number; incorrect: number }, lost: number | null, perWrong: number | null) =>
  ({
    summary,
    analyses: { negativeMarks: { state: lost != null ? 'AVAILABLE' : 'DATA_UNAVAILABLE', reason: '', marksLost: lost, perWrong } },
  }) as unknown as AttemptReportModel;

describe('scoreSum — the score as marks earned less negative marks', () => {
  it('explains a 0 that 12 right answers did not earn: +12 − 15.84 = −3.84, and a score cannot go below 0', () => {
    expect(scoreSum(model({ score: 0, maxMarks: 60, totalQuestions: 60, correct: 12, incorrect: 48 }, 15.84, 0.33))).toEqual({
      correct: 12,
      wrong: 48,
      perCorrect: 1,
      perWrong: 0.33,
      earned: 12,
      lost: 15.84,
      net: 12 - 15.84,
      floored: true,
    });
  });

  it('adds up to a positive score as it is', () => {
    const sum = scoreSum(model({ score: 36.7, maxMarks: 100, totalQuestions: 100, correct: 40, incorrect: 10 }, 3.3, 0.33));
    expect(sum).toMatchObject({ earned: 40, lost: 3.3, floored: false });
    expect(sum!.net).toBeCloseTo(36.7);
  });

  it('shows nothing that would disagree with the score (a paper marked differently by section)', () => {
    expect(scoreSum(model({ score: 50, maxMarks: 100, totalQuestions: 100, correct: 40, incorrect: 10 }, 3.3, 0.33))).toBeNull();
  });

  it('shows nothing without negative marking or wrong answers', () => {
    expect(scoreSum(model({ score: 40, maxMarks: 100, totalQuestions: 100, correct: 40, incorrect: 0 }, 0, 0.33))).toBeNull();
    expect(scoreSum(model({ score: 40, maxMarks: 100, totalQuestions: 100, correct: 40, incorrect: 10 }, null, null))).toBeNull();
  });
});
