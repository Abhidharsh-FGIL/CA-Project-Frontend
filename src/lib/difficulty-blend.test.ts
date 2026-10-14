import { describe, it, expect } from 'vitest';
import {
  FULL_PAPER_BLEND,
  blendTargets,
  describeBlend,
  explainBlendShortfall,
  pickByBlend,
} from '@/lib/difficulty-blend';

/** A pool of `n` questions at one difficulty, each tagged so it can be identified. */
const band = (difficulty: string, n: number) =>
  Array.from({ length: n }, (_, i) => ({ id: `${difficulty}-${i}`, difficulty }));

const countOf = (qs: Array<{ difficulty?: string | null }>, d: string) =>
  qs.filter(q => q.difficulty === d).length;

describe('blendTargets', () => {
  it('splits a paper 20 / 30 / 50', () => {
    expect(blendTargets(50)).toEqual({ easy: 10, medium: 15, hard: 25 });
    expect(blendTargets(100)).toEqual({ easy: 20, medium: 30, hard: 50 });
    expect(blendTargets(200)).toEqual({ easy: 40, medium: 60, hard: 100 });
  });

  it('always totals exactly what was asked for, however it rounds', () => {
    for (const total of [1, 7, 13, 25, 33, 47, 99, 175]) {
      const t = blendTargets(total);
      expect(t.easy + t.medium + t.hard).toBe(total);
    }
  });

  it('is the blend the product states', () => {
    expect(FULL_PAPER_BLEND).toEqual({ easy: 20, medium: 30, hard: 50 });
  });
});

describe('pickByBlend', () => {
  it('builds a paper to the blend when the bank can supply it', () => {
    const pool = [...band('easy', 30), ...band('medium', 30), ...band('hard', 30)];
    const r = pickByBlend(pool, 50);

    expect(r.picked).toHaveLength(50);
    expect(countOf(r.picked, 'easy')).toBe(10);
    expect(countOf(r.picked, 'medium')).toBe(15);
    expect(countOf(r.picked, 'hard')).toBe(25);
    expect(r.exact).toBe(true);
    expect(r.shortfall).toEqual({});
  });

  it('still returns a full paper when a band runs short', () => {
    // Only 5 hard questions exist, but 25 were wanted.
    const pool = [...band('easy', 40), ...band('medium', 40), ...band('hard', 5)];
    const r = pickByBlend(pool, 50);

    expect(r.picked).toHaveLength(50);
    expect(r.shortfall).toEqual({ hard: 20 });
    expect(r.exact).toBe(false);
    // The gap is made up, not left as a short paper.
    expect(countOf(r.picked, 'hard')).toBe(5);
  });

  it('reports every band that fell short', () => {
    const pool = [...band('easy', 50), ...band('medium', 2), ...band('hard', 3)];
    const r = pickByBlend(pool, 50);
    expect(r.shortfall).toEqual({ medium: 13, hard: 22 });
    expect(r.picked).toHaveLength(50);
  });

  it('uses untagged questions last, never in place of a known band', () => {
    const pool = [
      ...band('easy', 10),
      ...band('medium', 15),
      ...band('hard', 25),
      ...Array.from({ length: 20 }, (_, i) => ({ id: `u-${i}`, difficulty: undefined })),
    ];
    const r = pickByBlend(pool, 50);
    expect(r.exact).toBe(true);
    // Every pick is a tagged one; the untagged pool was not touched.
    expect(r.picked.filter(q => q.difficulty == null)).toHaveLength(0);
  });

  it('falls back to untagged questions rather than returning a thin paper', () => {
    const pool = [
      ...band('easy', 2),
      ...Array.from({ length: 30 }, (_, i) => ({ id: `u-${i}`, difficulty: undefined })),
    ];
    const r = pickByBlend(pool, 20);
    expect(r.picked).toHaveLength(20);
    expect(r.exact).toBe(false);
  });

  it('cannot return more than the pool holds', () => {
    const r = pickByBlend([...band('easy', 3)], 50);
    expect(r.picked).toHaveLength(3);
    expect(r.exact).toBe(false);
  });

  it('never picks the same question twice', () => {
    const pool = [...band('easy', 40), ...band('medium', 40), ...band('hard', 40)];
    const r = pickByBlend(pool, 100);
    expect(new Set(r.picked.map(q => q.id)).size).toBe(r.picked.length);
  });

  it('reads both difficulty vocabularies', () => {
    // A question tagged through the portal says "complex"; one imported says "hard".
    const pool = [
      ...band('simple', 10),
      ...band('medium', 15),
      ...band('complex', 25),
    ];
    const r = pickByBlend(pool, 50);
    expect(r.exact).toBe(true);
    expect(r.taken).toEqual({ easy: 10, medium: 15, hard: 25 });
  });

  it('handles an empty pool without throwing', () => {
    const r = pickByBlend([], 50);
    expect(r.picked).toEqual([]);
    expect(r.shortfall).toEqual({ easy: 10, medium: 15, hard: 25 });
  });
});

describe('describeBlend', () => {
  it('reads in the product’s own vocabulary', () => {
    expect(describeBlend(blendTargets(50))).toBe('Simple 10 · Medium 15 · Complex 25');
  });
});

describe('explainBlendShortfall — a Mixed paper over a bank graded all Complex', () => {
  const allHard = Array.from({ length: 112 }, () => ({ difficulty: 'hard' }));
  const result = pickByBlend(allHard, 50);

  it('cannot be built to the blend', () => {
    expect(result.exact).toBe(false);
    expect(result.taken).toEqual({ easy: 0, medium: 0, hard: 50 });
  });

  it('says so in numbers, before the paper exists', () => {
    const text = explainBlendShortfall(result, 50);
    expect(text).toContain('Simple 10 · Medium 15 · Complex 25'); // what it should be
    expect(text).toContain('Simple 0 · Medium 0 · Complex 50'); // what it would be
    expect(text).toContain('10 Simple, 15 Medium'); // what is missing
  });

  it('names only the bands that are short', () => {
    const some = pickByBlend(
      [
        ...Array.from({ length: 20 }, () => ({ difficulty: 'easy' })),
        ...Array.from({ length: 20 }, () => ({ difficulty: 'medium' })),
        ...Array.from({ length: 5 }, () => ({ difficulty: 'hard' })),
      ],
      50,
    );
    const text = explainBlendShortfall(some, 50);
    expect(text).toContain('20 Complex');
    expect(text).not.toContain('Simple,');
  });
});
