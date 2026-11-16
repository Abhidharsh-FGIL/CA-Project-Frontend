import { describe, expect, it } from 'vitest';
import { scoreSum } from './AttemptDiagnosticReport';
import { scoreBelowZero, type AttemptReportModel } from '@/lib/attempt-report';

/** Just the parts of a report the sum reads. */
const model = (summary: { score: number | null; maxMarks: number | null; totalQuestions: number; correct: number; incorrect: number }, lost: number | null, perWrong: number | null) =>
  ({
    summary,
    analyses: { negativeMarks: { state: lost != null ? 'AVAILABLE' : 'DATA_UNAVAILABLE', reason: '', marksLost: lost, perWrong } },
  }) as unknown as AttemptReportModel;

describe('scoreSum — the score as marks earned less negative marks', () => {
  it('explains a negative score: +12 − 15.84 = −3.84', () => {
    expect(scoreSum(model({ score: -3.84, maxMarks: 60, totalQuestions: 60, correct: 12, incorrect: 48 }, 15.84, 0.33))).toEqual({
      correct: 12,
      wrong: 48,
      perCorrect: 1,
      perWrong: 0.33,
      earned: 12,
      lost: 15.84,
      net: 12 - 15.84,
    });
  });

  it('corrects the 0 the server holds a negative score at: 2 right, 18 wrong × 0.33 of 20 is −3.94', () => {
    expect(scoreBelowZero(0, 20, 20, 2, 5.94)).toBe(-3.94);
    expect(scoreBelowZero(0, 60, 60, 12, 15.84)).toBe(-3.84);
  });

  it('leaves every other score alone', () => {
    expect(scoreBelowZero(0, 20, 20, 8, 1.32)).toBeNull(); // a true 0 cannot be told from a positive net; net is +6.68
    expect(scoreBelowZero(7, 20, 20, 8, 1.32)).toBeNull(); // the server's own score is not zero
    expect(scoreBelowZero(0, 20, 20, 0, 0)).toBeNull(); // no negative marking
    expect(scoreBelowZero(null, 20, 20, 2, 5.94)).toBeNull();
  });

  it('adds up to a positive score as it is', () => {
    const sum = scoreSum(model({ score: 36.7, maxMarks: 100, totalQuestions: 100, correct: 40, incorrect: 10 }, 3.3, 0.33));
    expect(sum).toMatchObject({ earned: 40, lost: 3.3 });
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
