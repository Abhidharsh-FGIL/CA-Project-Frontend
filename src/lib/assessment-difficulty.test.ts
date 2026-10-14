/**
 * The difficulty an assessment records.
 *
 * Mirrors `difficultyOf` in EvalAssessmentConfigPanel. The panel's picker is a
 * default that keeps its value whatever you then select, so a collection of 100
 * hard questions was saving as "medium" and misreporting itself to the portal's
 * difficulty chips, the report's difficulty analysis and the study plan.
 */
import { describe, it, expect } from 'vitest';

/** Kept in step with the panel's own copy. */
function difficultyOf(questions: Array<{ difficulty?: string | null }>, fallback: string): string {
  const seen = new Set(
    questions.map(q => (q?.difficulty ?? '').trim().toLowerCase()).filter(Boolean),
  );
  if (seen.size === 0) return fallback;
  if (seen.size === 1) return [...seen][0];
  return 'mixed';
}

const q = (difficulty?: string | null) => ({ difficulty });

describe('difficultyOf', () => {
  it('takes the questions’ difficulty over the picker default', () => {
    // The reported bug: a 100-question hard paper saved as the untouched default.
    const hundredHard = Array.from({ length: 100 }, () => q('hard'));
    expect(difficultyOf(hundredHard, 'medium')).toBe('hard');
  });

  it('records a genuine mix as mixed, not as one of its parts', () => {
    expect(difficultyOf([q('easy'), q('hard')], 'medium')).toBe('mixed');
    expect(difficultyOf([q('easy'), q('medium'), q('hard')], 'easy')).toBe('mixed');
  });

  it('falls back to the picker only when nothing declares a difficulty', () => {
    expect(difficultyOf([q(null), q(undefined), q('')], 'medium')).toBe('medium');
    expect(difficultyOf([], 'easy')).toBe('easy');
  });

  it('ignores case and padding rather than reading them as different levels', () => {
    expect(difficultyOf([q('Hard'), q(' hard '), q('HARD')], 'medium')).toBe('hard');
  });

  it('does not let undeclared questions turn a uniform paper into a mix', () => {
    // A paper where some rows lack the field is still a hard paper.
    expect(difficultyOf([q('hard'), q(null), q('hard')], 'medium')).toBe('hard');
  });
});
