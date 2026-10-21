import { describe, expect, it } from 'vitest';
import { TNPSC_GROUPS } from '@/config/tnpsc';
import { groupUnitsBySubject, subjectOfUnit } from '@/lib/unit-hierarchy';

const written = TNPSC_GROUPS.find(g => g.id === 'group-4')!.stages.find(s => s.id === 'group-4-written')!;
const sections = written.pattern!.sections!;

describe('subjectOfUnit', () => {
  it('names the section that lists a unit, with or without the report’s unit: prefix', () => {
    const section = sections.find(s => (s.units ?? []).length > 0)!;
    const unit = section.units![0];
    expect(subjectOfUnit(unit.id)?.subject).toBe(section.name);
    expect(subjectOfUnit(`unit:${unit.id}`)?.subject).toBe(section.name);
  });

  it('is null for a unit the catalog does not know, and for nothing', () => {
    expect(subjectOfUnit('no-such-unit')).toBeNull();
    expect(subjectOfUnit(null)).toBeNull();
    expect(subjectOfUnit(undefined)).toBeNull();
  });
});

describe('groupUnitsBySubject', () => {
  const first = sections.filter(s => (s.units ?? []).length > 0);
  const idsOf = (i: number) => first[i].units!.map(u => `unit:${u.id}`);

  it('groups units under their subject, in the order the paper prints them', () => {
    // fed in reverse, so the paper's order has to come from the catalog and not from the input
    const items = [...idsOf(first.length - 1), ...idsOf(0)];
    const groups = groupUnitsBySubject(items, id => id);
    expect(groups.map(g => g.subject)).toEqual([first[0].name, first[first.length - 1].name]);
    expect(groups[0].items).toEqual(idsOf(0));
  });

  it('keeps a unit the catalog does not know, in a group of its own at the end', () => {
    const groups = groupUnitsBySubject([...idsOf(0), 'unit:mystery'], id => id);
    expect(groups[groups.length - 1]).toEqual({ subject: null, items: ['unit:mystery'] });
  });

  it('loses nothing', () => {
    const items = [...idsOf(0), 'unit:mystery', ...idsOf(first.length - 1)];
    expect(groupUnitsBySubject(items, id => id).flatMap(g => g.items).sort()).toEqual([...items].sort());
  });
});
