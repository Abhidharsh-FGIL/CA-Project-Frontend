import { describe, expect, it } from 'vitest';
import { composeByGroups, planGroups, type ComposeGroup } from './compose-pool';

/** A tiny seeded generator so "random" tests are repeatable. */
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

type Q = { id: string; unit: string; difficulty: 'easy' | 'medium' | 'hard' };
const bands = ['easy', 'medium', 'hard'] as const;
const make = (unit: string, n: number): Q[] =>
  Array.from({ length: n }, (_, i) => ({ id: `${unit}-${i}`, unit, difficulty: bands[i % 3] }));
const classify = (q: Q) => [q.unit];

/**
 * A Group 4 mock was built from every unit and came out as 172 Aptitude and 28 Tamil:
 * the 20/30/50 blend was applied to the whole pool in bank order, ignoring the units.
 */
describe('composeByGroups', () => {
  const groups: ComposeGroup[] = [
    { key: 'tamil-a', label: 'Tamil A', cluster: 'Tamil' },
    { key: 'tamil-b', label: 'Tamil B', cluster: 'Tamil' },
    { key: 'gs', label: 'General Studies', cluster: 'GS' },
    { key: 'apt', label: 'Aptitude', cluster: 'Apt' },
  ];
  const weights = { 'tamil-a': 30, 'tamil-b': 20, gs: 37.5, apt: 12.5 }; // 60 / 40 / 75 / 25 of 200

  // Newest-first bank order puts Aptitude first, as in the real bank.
  const pool = [...make('apt', 400), ...make('tamil-a', 300), ...make('tamil-b', 300), ...make('gs', 500)];

  it('gives each group its share of the paper, whatever order the bank lists them in', () => {
    const r = composeByGroups(pool, groups, classify, weights, 200, { blend: true, random: seeded(1) });
    expect(r.picked).toHaveLength(200);
    expect(r.byGroup).toEqual({ 'tamil-a': 60, 'tamil-b': 40, gs: 75, apt: 25 });
    expect(r.unfilled).toBe(0);
    expect(r.short).toEqual([]);
  });

  it('applies the 30/30/40 blend inside each group, so the whole paper follows it too', () => {
    const r = composeByGroups(pool, groups, classify, weights, 200, { blend: true, random: seeded(2) });
    const count = (d: string) => r.picked.filter(q => q.difficulty === d).length;
    // 30/30/40 of 200 is 60/60/80. Rounding inside small groups (a 25-question group cannot
    // split into 7.5 / 7.5 / 10) can move a band by a question or two, not more.
    for (const [band, target] of [['easy', 60], ['medium', 60], ['hard', 80]] as const) {
      expect(Math.abs(count(band) - target)).toBeLessThanOrEqual(2);
    }
  });

  it('does not use a question twice', () => {
    const r = composeByGroups(pool, groups, classify, weights, 200, { blend: true, random: seeded(3) });
    expect(new Set(r.picked.map(q => q.id)).size).toBe(200);
  });

  it('builds a different paper each time, not the newest N of the pool', () => {
    const a = composeByGroups(pool, groups, classify, weights, 200, { blend: true, random: seeded(4) });
    const b = composeByGroups(pool, groups, classify, weights, 200, { blend: true, random: seeded(5) });
    expect(a.picked.map(q => q.id)).not.toEqual(b.picked.map(q => q.id));
  });

  it('makes up a short group from its own cluster before anyone else', () => {
    // Tamil A has only 10 of the 60 asked of it. Tamil B (same cluster) has plenty.
    const thin = [...make('apt', 400), ...make('tamil-a', 10), ...make('tamil-b', 300), ...make('gs', 500)];
    const r = composeByGroups(thin, groups, classify, weights, 200, { blend: true, random: seeded(6) });
    expect(r.byGroup['tamil-a']).toBe(10);
    expect(r.byGroup['tamil-b']).toBe(90); // 40 + the 50 Tamil A could not supply
    expect(r.byGroup.gs).toBe(75);
    expect(r.byGroup.apt).toBe(25);
    expect(r.picked).toHaveLength(200);
    expect(r.short.map(s => s.key)).toEqual(['tamil-a']);
  });

  it('falls back to other clusters only when its own has nothing left', () => {
    const none = [...make('apt', 400), ...make('gs', 500)]; // no Tamil in the bank at all
    const r = composeByGroups(none, groups, classify, weights, 200, { blend: true, random: seeded(7) });
    expect(r.byGroup['tamil-a']).toBe(0);
    expect(r.byGroup['tamil-b']).toBe(0);
    expect(r.picked).toHaveLength(200);
    expect(r.short.map(s => s.key).sort()).toEqual(['tamil-a', 'tamil-b']);
  });

  it('reports what it could not place when every pool is dry', () => {
    const tiny = [...make('apt', 10), ...make('gs', 10)];
    const r = composeByGroups(tiny, groups, classify, weights, 200, { blend: true, random: seeded(8) });
    expect(r.picked).toHaveLength(20);
    expect(r.unfilled).toBe(180);
  });

  it('takes a question that fits two groups once', () => {
    const both = make('x', 50);
    const r = composeByGroups(
      both,
      [{ key: 'a', label: 'A' }, { key: 'b', label: 'B' }],
      () => ['a', 'b'],
      { a: 50, b: 50 },
      40,
      { blend: false, random: seeded(9) },
    );
    expect(new Set(r.picked.map(q => q.id)).size).toBe(r.picked.length);
    expect(r.picked).toHaveLength(40);
  });

  it('without the blend, takes the group share as it comes', () => {
    const r = composeByGroups(pool, groups, classify, weights, 200, { blend: false, random: seeded(10) });
    expect(r.byGroup).toEqual({ 'tamil-a': 60, 'tamil-b': 40, gs: 75, apt: 25 });
  });

  it('copes with weights that do not total 100, or are missing', () => {
    const r = composeByGroups(pool, groups, classify, { 'tamil-a': 3, 'tamil-b': 2, gs: 3.75, apt: 1.25 }, 200, {
      blend: true,
      random: seeded(11),
    });
    expect(r.byGroup).toEqual({ 'tamil-a': 60, 'tamil-b': 40, gs: 75, apt: 25 });
    const even = composeByGroups(pool, groups, classify, {}, 200, { blend: true, random: seeded(12) });
    expect(Object.values(even.byGroup)).toEqual([50, 50, 50, 50]);
  });
});

describe('planGroups', () => {
  it('shows what each group is asked for and what the pool holds, before anything is chosen', () => {
    const plan = planGroups(
      [...make('a', 5), ...make('b', 500)],
      [{ key: 'a', label: 'A' }, { key: 'b', label: 'B' }],
      classify,
      { a: 50, b: 50 },
      100,
    );
    expect(plan).toEqual([
      { key: 'a', label: 'A', wanted: 50, available: 5 },
      { key: 'b', label: 'B', wanted: 50, available: 500 },
    ]);
  });
});
