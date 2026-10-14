import { describe, expect, it } from 'vitest';
import { TNPSC_GROUPS } from '@/config/tnpsc';
import { OPEN_EXAM_IDS, UPCOMING_EXAMS, splitExams } from '@/lib/exam-listing';

describe('splitExams', () => {
  const { open, soon } = splitExams(TNPSC_GROUPS);

  it('opens Group 4, and only Group 4', () => {
    expect(open.map(g => g.id)).toEqual(['group-4']);
  });

  it('leaves every other catalog exam as coming soon, in catalog order', () => {
    expect(soon.map(g => g.id)).toEqual(TNPSC_GROUPS.map(g => g.id).filter(id => id !== 'group-4'));
    expect(soon.map(g => g.id)).toContain('group-1');
    expect(soon.map(g => g.id)).toContain('gat-b');
  });

  it('loses nothing', () => {
    expect(open.length + soon.length).toBe(TNPSC_GROUPS.length);
  });

  it('puts Group 4 first even when the server lists it last', () => {
    const reversed = [...TNPSC_GROUPS].reverse();
    const split = splitExams(reversed);
    expect([...split.open, ...split.soon][0].id).toBe('group-4');
  });

  it('shows nothing as open when the catalog has no open exam', () => {
    expect(splitExams(TNPSC_GROUPS.filter(g => g.id !== 'group-4')).open).toEqual([]);
  });
});

describe('the upcoming exams', () => {
  it('are not in the catalog — the admin pickers read the catalog', () => {
    const real = new Set<string>(TNPSC_GROUPS.map(g => g.id));
    for (const e of UPCOMING_EXAMS) expect(real.has(e.id), e.id).toBe(false);
  });

  it('are never open', () => {
    for (const e of UPCOMING_EXAMS) expect(OPEN_EXAM_IDS.has(e.id), e.id).toBe(false);
  });

  it('each have an id of their own', () => {
    expect(new Set(UPCOMING_EXAMS.map(e => e.id)).size).toBe(UPCOMING_EXAMS.length);
  });

  it('say who runs them', () => {
    for (const e of UPCOMING_EXAMS) {
      expect(e.authority.length, e.id).toBeGreaterThan(3);
      expect(e.name.length, e.id).toBeGreaterThan(2);
    }
  });
});
