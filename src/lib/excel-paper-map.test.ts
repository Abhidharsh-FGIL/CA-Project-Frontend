/**
 * What survives from an imported sheet to the saved question.
 *
 * A sheet of Simple questions was arriving in the bank as Medium: the mapper dropped
 * each row's Difficulty, the save endpoint fell back to the paper's level, and the
 * import screen sets that to Medium. These hold the level through that hand-off.
 */
import { describe, expect, it } from 'vitest';
import { LEVEL_FROM_SHEET, applyLevelChoice, mapExcelPaper } from '@/lib/excel-paper-map';
import { paperDifficultyFor } from '@/lib/eval-difficulty';
import type { ExcelPaperQuestion } from '@/lib/excelPaperApi';

const row = (over: Partial<ExcelPaperQuestion> = {}): ExcelPaperQuestion => ({
  id: 'q1',
  text: 'What is the capital of Tamil Nadu?',
  options: ['Chennai', 'Madurai'],
  subject: 'Indian Polity',
  ...over,
});

const map = (...items: ExcelPaperQuestion[]) => mapExcelPaper(items, [], 'TNPSC Group 4');

describe('mapExcelPaper — difficulty', () => {
  it('keeps the level the sheet gave', () => {
    expect(map(row({ difficulty: 'easy' }))[0].difficulty).toBe('easy');
    expect(map(row({ difficulty: 'hard' }))[0].difficulty).toBe('hard');
  });

  it('reads the portal words as the stored ones — the save endpoint stores easy / medium / hard', () => {
    expect(map(row({ difficulty: 'Simple' }))[0].difficulty).toBe('easy');
    expect(map(row({ difficulty: 'COMPLEX' }))[0].difficulty).toBe('hard');
    expect(map(row({ difficulty: ' Difficult ' }))[0].difficulty).toBe('hard');
  });

  it('does not turn a missing level into Medium', () => {
    expect(map(row())[0].difficulty).toBeUndefined();
    expect(map(row({ difficulty: '' }))[0].difficulty).toBeUndefined();
  });

  it('does not pass off a value it does not recognise as Medium', () => {
    // It stays unset, so the review screen asks for a level instead of hiding the gap.
    expect(map(row({ difficulty: 'tricky' }))[0].difficulty).toBeUndefined();
  });

  it('still carries the rest of the row', () => {
    const q = map(row({ difficulty: 'easy', chapter: 'Preamble', subtopic: 'Amendments' }))[0];
    expect(q.subject).toBe('Indian Polity');
    expect(q.chapter).toBe('Preamble');
    expect(q.subtopic).toBe('Amendments');
  });
});

describe('paperDifficultyFor', () => {
  const q = (difficulty?: string) => ({ difficulty });

  it('is the level when every question shares it', () => {
    expect(paperDifficultyFor([q('easy'), q('easy')], 'medium')).toBe('easy');
    expect(paperDifficultyFor([q('simple'), q('easy')], 'medium')).toBe('easy');
  });

  it('is mixed when the questions span levels', () => {
    expect(paperDifficultyFor([q('easy'), q('hard')], 'medium')).toBe('mixed');
  });

  it('is mixed when some questions have a level and some do not', () => {
    // Calling it Simple would claim a level for the ones that have none.
    expect(paperDifficultyFor([q('easy'), q()], 'medium')).toBe('mixed');
  });

  it('keeps the fallback when nothing has a level', () => {
    expect(paperDifficultyFor([q(), q('')], 'medium')).toBe('medium');
    expect(paperDifficultyFor([], 'medium')).toBe('medium');
  });
});

describe('applyLevelChoice', () => {
  const sheet = () => map(row({ id: 'a', difficulty: 'easy' }), row({ id: 'b', difficulty: 'hard' }), row({ id: 'c' }));

  it('leaves the sheet alone when asked to take its levels', () => {
    expect(applyLevelChoice(sheet(), LEVEL_FROM_SHEET).map(q => q.difficulty)).toEqual(['easy', 'hard', undefined]);
  });

  it('sets the chosen level on every question, replacing the sheet', () => {
    expect(applyLevelChoice(sheet(), 'easy').map(q => q.difficulty)).toEqual(['easy', 'easy', 'easy']);
    expect(applyLevelChoice(sheet(), 'hard').map(q => q.difficulty)).toEqual(['hard', 'hard', 'hard']);
  });

  it('gives a question paper — which has no levels of its own — the chosen one', () => {
    const extracted = [{ id: 'x', type: 'mcq', text: 't', points: 1 }];
    expect(applyLevelChoice(extracted, 'medium')[0].difficulty).toBe('medium');
  });

  it('does not touch the questions for a value that is not a level', () => {
    expect(applyLevelChoice(sheet(), 'nonsense').map(q => q.difficulty)).toEqual(['easy', 'hard', undefined]);
  });
});
