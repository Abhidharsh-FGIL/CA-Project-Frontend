import { describe, expect, it } from 'vitest';
import { actualMix, blendKindOf, blendProblem, sameBlend, startingBlend, storedBlend, wholeBlend } from './assessment-blend';

const row = (over: Record<string, any>) => ({ id: 'a', title: 't', stage_id: 'group-4-written', ...over });

describe('blendKindOf — which papers have a mix to change', () => {
  it('a mock', () => {
    expect(blendKindOf(row({ track: 'mock', level: 'simple' }))).toBe('mock');
  });

  it('a full set (a whole section)', () => {
    expect(blendKindOf(row({ track: 'practice', scope: 'section', section_name: 'General Studies' }))).toBe('full-section');
  });

  it('a unit or key-topic set left Mixed (no level)', () => {
    expect(blendKindOf(row({ track: 'practice', scope: 'unit', unit_id: 'g4-gs-indian-polity' }))).toBe('mixed-unit');
    expect(blendKindOf(row({ track: 'practice', scope: 'unit', unit_id: 'g4-gs-indian-polity', topic_id: 'x' }))).toBe('mixed-topic');
  });

  it('not a unit set pitched at one level — it has no mix', () => {
    expect(blendKindOf(row({ track: 'practice', scope: 'unit', unit_id: 'g4-gs-indian-polity', level: 'medium' }))).toBeNull();
  });

  it('an unplaced paper saved as Mixed, and not one saved at a level', () => {
    expect(blendKindOf({ id: 'x', difficulty: 'mixed' })).toBe('mixed');
    expect(blendKindOf({ id: 'x', difficulty: 'easy' })).toBeNull();
  });
});

describe('storedBlend', () => {
  it('reads the server’s mix, under either name', () => {
    expect(storedBlend({ difficulty_blend: { easy: 20, medium: 30, hard: 50 } })).toEqual({ easy: 20, medium: 30, hard: 50 });
    expect(storedBlend({ blend: { simple: 40, medium: 40, complex: 20 } })).toEqual({ easy: 40, medium: 40, hard: 20 });
  });

  it('is null when there is none, or it is not a mix', () => {
    expect(storedBlend({})).toBeNull();
    expect(storedBlend({ difficulty_blend: { easy: 'a', medium: 1 } })).toBeNull();
  });
});

describe('actualMix — what the paper holds now', () => {
  it('counts the questions’ difficulties', () => {
    const qs = [
      ...Array(3).fill({ difficulty: 'easy' }),
      ...Array(3).fill({ difficulty: 'medium' }),
      ...Array(4).fill({ difficulty: 'hard' }),
    ];
    expect(actualMix({ questions: qs })).toEqual({ blend: { easy: 30, medium: 30, hard: 40 }, counts: { easy: 3, medium: 3, hard: 4 }, total: 10 });
  });

  it('is null when the questions do not say', () => {
    expect(actualMix({ questions: [{ id: 1 }] })).toBeNull();
    expect(actualMix({})).toBeNull();
  });
});

describe('blendProblem', () => {
  it('accepts a mix that adds up to 100', () => {
    expect(blendProblem({ easy: 30, medium: 30, hard: 40 })).toBeNull();
    expect(blendProblem({ easy: 0, medium: 0, hard: 100 })).toBeNull();
  });

  it('says when it does not add up, or a band is not a whole percentage', () => {
    expect(blendProblem({ easy: 30, medium: 30, hard: 30 })).toMatch(/add up to 100% .*90%/);
    expect(blendProblem({ easy: 30.5, medium: 30, hard: 39.5 })).toMatch(/whole number/);
    expect(blendProblem({ easy: -10, medium: 60, hard: 50 })).toMatch(/whole number/);
  });
});

describe('sameBlend', () => {
  it('compares two mixes', () => {
    expect(sameBlend({ easy: 1, medium: 2, hard: 97 }, { easy: 1, medium: 2, hard: 97 })).toBe(true);
    expect(sameBlend({ easy: 1, medium: 2, hard: 97 }, null)).toBe(false);
  });
});


describe('wholeBlend — counts as whole percentages that add up to 100', () => {
  it('a 20-question paper made 10 / 30 / 60', () => {
    expect(wholeBlend({ easy: 2, medium: 6, hard: 12 })).toEqual({ easy: 10, medium: 30, hard: 60 });
  });

  it('never 99 or 101, where rounding each alone would be', () => {
    const b = wholeBlend({ easy: 1, medium: 1, hard: 1 });
    expect(b.easy + b.medium + b.hard).toBe(100);
  });
});

describe('startingBlend — what the dialog opens on', () => {
  const qs = (e: number, m: number, h: number) => [
    ...Array(e).fill({ difficulty: 'easy' }),
    ...Array(m).fill({ difficulty: 'medium' }),
    ...Array(h).fill({ difficulty: 'hard' }),
  ];

  it('the mix the server saved, first', () => {
    expect(startingBlend({ difficulty_blend: { easy: 10, medium: 30, hard: 60 }, questions: qs(5, 5, 10) })).toEqual({
      blend: { easy: 10, medium: 30, hard: 60 },
      source: 'saved',
    });
  });

  it('else what the questions add up to — a paper made 10 / 30 / 60 opens on 10 / 30 / 60', () => {
    expect(startingBlend({ questions: qs(2, 6, 12) })).toEqual({ blend: { easy: 10, medium: 30, hard: 60 }, source: 'questions' });
  });

  it('else the standard mix, and says so', () => {
    expect(startingBlend({}, undefined)).toEqual({ blend: { easy: 30, medium: 30, hard: 40 }, source: 'standard' });
  });

  it('looks at the detail before the list row', () => {
    expect(startingBlend({ questions: qs(2, 6, 12) }, { questions: qs(3, 3, 4) }).blend).toEqual({ easy: 10, medium: 30, hard: 60 });
  });
});
