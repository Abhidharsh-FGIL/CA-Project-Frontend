import { describe, expect, it } from 'vitest';
import { mapGeneratedQuestions } from './eval-review-mapper';
import {
  asQuestionDifficulty,
  countByDifficulty,
  difficultyLabel,
  formatDifficultySummary,
} from './eval-difficulty';

/**
 * The review mapper used to drop each question's `difficulty` (and `subtopic`),
 * so POST /papers/save fell back to the paper's level for every question. These
 * pin that both now survive the trip from the generator to the review screen.
 */
const questionJson = [
  {
    id: 'q_tmp_0001',
    type: 'mcq',
    subtype: 'statement_based',
    text: 'Consider the following statements: (1) A (2) B (3) C. Which is/are correct?',
    options: ['(1) only', '(1) and (2) only', '(2) and (3) only', 'All of them', 'Answer not known'],
    points: 1,
    subject: 'Indian Polity',
    chapter: 'Fundamental Rights',
    subtopic: 'Article 19',
    difficulty: 'hard',
    form: 'statement_set',
  },
  {
    id: 'q_tmp_0002',
    type: 'mcq',
    subtype: 'standard',
    text: 'Which Article abolishes untouchability?',
    options: ['Article 17', 'Article 14', 'Article 21', 'Article 15', 'Answer not known'],
    points: 1,
    subject: 'Indian Polity',
    chapter: 'Fundamental Rights',
    difficulty: 'easy',
  },
  { id: 'q_tmp_0003', type: 'mcq', text: 'Untagged', options: ['a', 'b'], difficulty: 'bogus' },
];
const answerKey = [
  { id: 'q_tmp_0001', correctAnswer: 'All of them', explanation: 'All three hold.' },
  { id: 'q_tmp_0002', correctAnswer: 'Article 17', explanation: 'Art. 17.' },
];

describe('mapGeneratedQuestions', () => {
  const mapped = mapGeneratedQuestions(questionJson, answerKey);

  it('carries difficulty through to the review question', () => {
    expect(mapped.map(q => q.difficulty)).toEqual(['hard', 'easy', undefined]);
  });

  it('carries subtopic through to the review question', () => {
    expect(mapped[0].subtopic).toBe('Article 19');
    expect(mapped[1].subtopic).toBeUndefined();
  });

  it('keeps everything it mapped before', () => {
    expect(mapped[0].subtype).toBe('statement_based');
    expect(mapped[0].correctAnswer).toBe(3); // index of the correct option
    expect(mapped[0].explanation).toBe('All three hold.');
    expect(mapped[0].chapter).toBe('Fundamental Rights');
    expect(mapped[2].correctAnswer).toBeUndefined();
  });

  it('feeds a save payload that still has both fields', () => {
    // What EvalGeneratingPage.handleSave spreads into POST /papers/save.
    const payload = mapped.map(q => ({ ...q, subtopic: q.subtopic, difficulty: q.difficulty }));
    expect(payload[0]).toMatchObject({ difficulty: 'hard', subtopic: 'Article 19' });
  });
});

describe('difficulty labels and summary', () => {
  it('labels easy as Simple', () => {
    expect(difficultyLabel('easy')).toBe('Simple');
    expect(difficultyLabel('hard')).toBe('Hard');
    expect(difficultyLabel('mixed')).toBe('Mixed');
  });

  it('accepts the portal aliases', () => {
    expect(asQuestionDifficulty('Simple')).toBe('easy');
    expect(asQuestionDifficulty('complex')).toBe('hard');
    expect(asQuestionDifficulty('mixed')).toBeUndefined();
  });

  it('counts and formats the per-level summary', () => {
    const qs = [{ difficulty: 'hard' }, { difficulty: 'hard' }, { difficulty: 'easy' }, {}];
    expect(countByDifficulty(qs)).toEqual({ easy: 1, medium: 0, hard: 2 });
    expect(formatDifficultySummary(qs)).toBe('Simple 1 · Medium 0 · Hard 2');
    expect(formatDifficultySummary(Array(50).fill({ difficulty: 'hard' }))).toBe('Simple 0 · Medium 0 · Hard 50');
  });
});
