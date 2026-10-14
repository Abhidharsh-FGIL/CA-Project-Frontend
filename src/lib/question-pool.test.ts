import { describe, it, expect } from 'vitest';
import { TNPSC_GROUPS, findStage } from '@/config/tnpsc';
import {
  difficultySpread,
  inSelectedSubjects,
  matchesDifficulty,
  poolDifficulty,
  sameSubject,
} from '@/lib/question-pool';

const g4 = findStage('group-4', 'group-4-written', TNPSC_GROUPS)!.stage;

describe('sameSubject — the picker’s name versus the bank’s', () => {
  it('matches the syllabus name to the shorter wording an import used', () => {
    // The reported case: the picker offers "Geography of India", the bank says
    // "Geography", and an exact comparison matched nothing.
    expect(sameSubject(g4, 'Geography', 'Geography of India')).toBe(true);
    expect(sameSubject(g4, 'geography ', 'GEOGRAPHY OF INDIA')).toBe(true);
  });

  it('matches the Tamil printed name as well', () => {
    expect(sameSubject(g4, 'இந்திய புவியியல்', 'Geography of India')).toBe(true);
  });

  it('keeps different subjects apart', () => {
    expect(sameSubject(g4, 'Indian Polity', 'Geography of India')).toBe(false);
    expect(sameSubject(g4, 'Indian Economy', 'Indian Polity')).toBe(false);
  });

  it('falls back to the plain comparison with no stage to resolve against', () => {
    expect(sameSubject(undefined, 'Maths', 'maths')).toBe(true);
    expect(sameSubject(undefined, 'Geography', 'Geography of India')).toBe(false);
  });

  it('never matches an empty label', () => {
    expect(sameSubject(g4, '', 'Geography')).toBe(false);
    expect(sameSubject(g4, null, null)).toBe(false);
  });
});

describe('inSelectedSubjects', () => {
  it('lets everything through when nothing is selected', () => {
    expect(inSelectedSubjects(g4, 'Geography', [])).toBe(true);
  });

  it('matches against any of several', () => {
    expect(inSelectedSubjects(g4, 'Geography', ['Indian Polity', 'Geography of India'])).toBe(true);
    expect(inSelectedSubjects(g4, 'Indian Economy', ['Indian Polity', 'Geography of India'])).toBe(
      false,
    );
  });
});

describe('poolDifficulty — what the paper is, not what a picker says', () => {
  it('restricts a unit paper to its level', () => {
    expect(poolDifficulty({ track: 'practice', scope: 'unit', level: 'simple' }, 'medium')).toBe('easy');
    expect(poolDifficulty({ track: 'practice', scope: 'unit', level: 'complex' }, 'medium')).toBe('hard');
  });

  it('does not narrow a whole paper before it is blended', () => {
    // Narrowing to Medium and *then* asking for 20/30/50 can only fail.
    expect(poolDifficulty({ track: 'mock', scope: null, level: 'simple' }, 'medium')).toBeNull();
    expect(poolDifficulty({ track: 'practice', scope: 'section', level: null }, 'medium')).toBeNull();
    expect(poolDifficulty({ track: 'practice', scope: 'unit', level: null }, 'medium')).toBeNull();
  });

  it('ignores the Default Difficulty picker for a TNPSC paper', () => {
    // The reported case: left on Medium, it hid every Complex question.
    expect(poolDifficulty({ track: 'practice', scope: 'unit', level: 'complex' }, 'easy')).toBe('hard');
  });

  it('keeps the picker as the filter where there is no TNPSC placement', () => {
    expect(poolDifficulty({ track: null, scope: null, level: null }, 'hard')).toBe('hard');
    expect(poolDifficulty({ track: null, scope: null, level: null }, 'all')).toBeNull();
  });
});

describe('matchesDifficulty', () => {
  it('reads both vocabularies', () => {
    expect(matchesDifficulty({ difficulty: 'complex' }, 'hard')).toBe(true);
    expect(matchesDifficulty({ difficulty: 'Simple' }, 'easy')).toBe(true);
    expect(matchesDifficulty({ difficulty: 'medium' }, 'hard')).toBe(false);
  });

  it('passes anything when no difficulty is wanted', () => {
    expect(matchesDifficulty({ difficulty: null }, null)).toBe(true);
  });

  it('does not count an undeclared question as a match for a level', () => {
    expect(matchesDifficulty({ difficulty: null }, 'hard')).toBe(false);
  });
});

describe('difficultySpread', () => {
  it('counts what is there, in the stored vocabulary', () => {
    const s = difficultySpread([
      { difficulty: 'medium' },
      { difficulty: 'medium' },
      { difficulty: 'complex' },
      { difficulty: null },
    ]);
    expect(s).toEqual({ easy: 0, medium: 2, hard: 1, untagged: 1 });
  });
});
