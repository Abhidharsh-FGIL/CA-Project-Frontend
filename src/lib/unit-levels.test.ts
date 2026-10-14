/**
 * The Mixed button must open the Mixed paper.
 *
 * Reported: Mixed papers were created for every Tamil unit, and pressing Mixed opened a
 * paper titled "· Complex". The button was built from every paper the unit held and
 * opened the first of them.
 */
import { describe, expect, it } from 'vitest';
import { levelStats } from '@/lib/unit-levels';
import type { TnpscTest } from '@/lib/tnpscApi';

const paper = (id: string, level: TnpscTest['level'], over: Partial<TnpscTest> = {}): TnpscTest =>
  ({ test_id: id, title: id, level, attempts_used: 0, is_completed: false, best_percentage: null, ...over }) as TnpscTest;

const byKey = (tests: TnpscTest[]) => Object.fromEntries(levelStats(tests).map(s => [s.key, s]));

describe('levelStats', () => {
  // The Complex paper is listed first, as it was in the real unit.
  const unit = [
    paper('complex', 'complex'),
    paper('simple', 'simple'),
    paper('medium', 'medium'),
    paper('mixed', null),
  ];

  it('opens the Mixed paper from the Mixed button, not whichever is listed first', () => {
    expect(byKey(unit).all.test?.test_id).toBe('mixed');
  });

  it('gives each graded button its own paper', () => {
    const s = byKey(unit);
    expect(s.simple.test?.test_id).toBe('simple');
    expect(s.medium.test?.test_id).toBe('medium');
    expect(s.complex.test?.test_id).toBe('complex');
  });

  it('counts a button’s attempts from its own paper only', () => {
    const s = byKey([
      paper('complex', 'complex', { attempts_used: 5 }),
      paper('mixed', null, { attempts_used: 1 }),
    ]);
    expect(s.all.attempts).toBe(1);
    expect(s.complex.attempts).toBe(5);
  });

  it('does not call Mixed cleared because a different paper was', () => {
    const s = byKey([
      paper('simple', 'simple', { is_completed: true, best_percentage: 90 }),
      paper('mixed', null),
    ]);
    expect(s.all.cleared).toBe(false);
    expect(s.all.best).toBeNull();
  });

  it('leaves Mixed empty when the unit has only graded papers', () => {
    // Opening a Complex paper under a button called Mixed misreports what it is.
    const s = byKey([paper('simple', 'simple'), paper('complex', 'complex')]);
    expect(s.all.test).toBeNull();
    expect(s.all.papers).toEqual([]);
  });

  it('still treats a paper with no difficulty of its own as the unit’s general set', () => {
    // Papers from before levels were tagged on practice carry none.
    const s = byKey([paper('old-1', null), paper('old-2', null)]);
    expect(s.all.papers).toHaveLength(2);
    expect(s.all.test?.test_id).toBe('old-1');
  });

  it('always returns all four buttons, filled or not', () => {
    expect(levelStats([]).map(s => s.key)).toEqual(['simple', 'medium', 'complex', 'all']);
  });
});
