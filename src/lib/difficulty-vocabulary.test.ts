/**
 * One vocabulary: Simple · Medium · Complex.
 *
 * The product used to speak two — questions and papers were easy/medium/hard while
 * the TNPSC level a paper sits behind was simple/medium/complex, so the same paper
 * read "Hard" on the admin screen and "Complex" on the portal. These pin the
 * single vocabulary so it cannot drift apart again.
 */
import { describe, it, expect } from 'vitest';
import {
  DIFFICULTY_OPTIONS,
  PAPER_DIFFICULTY_OPTIONS,
  asDifficultyLevel,
  asQuestionDifficulty,
  difficultyLabel,
  formatDifficultySummary,
} from '@/lib/eval-difficulty';

describe('the words shown to a human', () => {
  it('never says "Easy" or "Hard"', () => {
    const everySpelling = ['easy', 'simple', 'medium', 'moderate', 'hard', 'complex', 'difficult'];
    const labels = everySpelling.map(difficultyLabel);
    expect(labels).not.toContain('Easy');
    expect(labels).not.toContain('Hard');
    expect(new Set(labels)).toEqual(new Set(['Simple', 'Medium', 'Complex']));
  });

  it('shows an unknown value as given rather than inventing one', () => {
    expect(difficultyLabel('bananas')).toBe('bananas');
    expect(difficultyLabel(null)).toBe('—');
    expect(difficultyLabel('')).toBe('—');
  });
});

describe('every picker builds from one list', () => {
  it('offers exactly Simple, Medium, Complex', () => {
    expect(DIFFICULTY_OPTIONS.map(o => o.label)).toEqual(['Simple', 'Medium', 'Complex']);
  });

  it('stores values the current API understands', () => {
    // Storage is still the legacy vocabulary — see STORAGE_VOCABULARY. A picker
    // that sent "complex" today would stop matching `?difficulty=hard`.
    expect(DIFFICULTY_OPTIONS.map(o => o.value)).toEqual(['easy', 'medium', 'hard']);
  });

  it('adds Mixed only for a whole paper, never for one question', () => {
    expect(PAPER_DIFFICULTY_OPTIONS.map(o => o.label)).toEqual([
      'Simple',
      'Medium',
      'Complex',
      'Mixed',
    ]);
    expect(DIFFICULTY_OPTIONS.some(o => o.value === 'mixed')).toBe(false);
  });
});

describe('reading whatever a question was tagged with', () => {
  it('treats both vocabularies as the same thing', () => {
    expect(asQuestionDifficulty('simple')).toBe('easy');
    expect(asQuestionDifficulty('Complex')).toBe('hard');
    expect(asQuestionDifficulty('difficult')).toBe('hard');
    expect(asQuestionDifficulty('moderate')).toBe('medium');
    expect(asQuestionDifficulty(' HARD ')).toBe('hard');
  });

  it('maps a stored value onto the level a paper sits behind', () => {
    expect(asDifficultyLevel('easy')).toBe('simple');
    expect(asDifficultyLevel('medium')).toBe('medium');
    expect(asDifficultyLevel('hard')).toBe('complex');
    // And is stable through the other spelling.
    expect(asDifficultyLevel('complex')).toBe('complex');
  });

  it('has no answer for a value it does not recognise', () => {
    expect(asQuestionDifficulty('mixed')).toBeUndefined();
    expect(asQuestionDifficulty(null)).toBeUndefined();
    expect(asDifficultyLevel('bananas')).toBeUndefined();
  });
});

describe('summaries', () => {
  it('counts in the product’s own words', () => {
    expect(formatDifficultySummary([{ difficulty: 'hard' }, { difficulty: 'simple' }])).toBe(
      'Simple 1 · Medium 0 · Complex 1',
    );
  });
});
