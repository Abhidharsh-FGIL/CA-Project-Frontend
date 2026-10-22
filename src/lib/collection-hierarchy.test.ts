import { describe, expect, it } from 'vitest';
import { TNPSC_GROUPS, stageUnits } from '@/config/tnpsc';
import { buildCollectionTree, placeCollection, placeableGroups, unitChoices } from './collection-hierarchy';

const g4 = TNPSC_GROUPS.find(g => g.id === 'group-4')!;
const stage = g4.stages[0];
const units = stageUnits(stage);
const tamilUnit = units.find(u => u.sectionName === 'General Tamil')!;
const gsUnit = units.find(u => u.sectionName === 'General Studies')!;

describe('placeCollection', () => {
  it('trusts the placement the server stored, in any of its spellings', () => {
    for (const row of [
      { stage_id: stage.id, unit_id: tamilUnit.unit.id },
      { tnpsc_stage_id: stage.id, tnpsc_unit_id: tamilUnit.unit.id },
      { placement: { stageId: stage.id, unitId: tamilUnit.unit.id } },
      { unit_id: tamilUnit.unit.id }, // a unit id alone is enough to find its stage
    ]) {
      expect(placeCollection({ title: 'anything', ...row })).toMatchObject({
        groupId: 'group-4',
        section: 'General Tamil',
        unitId: tamilUnit.unit.id,
        via: 'placement',
      });
    }
  });

  it('files a collection under its subject when the server knows the subject but not the unit', () => {
    const p = placeCollection({ stage_id: stage.id, section_name: 'General Studies' });
    expect(p).toMatchObject({ groupId: 'group-4', section: 'General Studies', unitId: null, via: 'placement' });
  });

  it('reads a unit from the name when the name says which paper and which unit', () => {
    const p = placeCollection({ title: 'Unit_4_Tamil_50Q_Hard' });
    expect(p.via).toBe('name');
    expect(p.section).toBe('General Tamil');
    expect(p.unitId).toBeTruthy();
  });

  it('does not guess from a name that does not say which paper', () => {
    expect(placeCollection({ title: 'Unit_VI_Translation_40_Questions_Simple_Cleaned_v1' })).toMatchObject({ unitId: null, via: null });
    expect(placeCollection({ title: 'Mock paper 3' })).toMatchObject({ groupId: null, via: null });
  });
});

describe('buildCollectionTree', () => {
  const a = { id: 'a', title: 'A', stage_id: stage.id, unit_id: tamilUnit.unit.id };
  const b = { id: 'b', title: 'B', stage_id: stage.id, unit_id: tamilUnit.unit.id };
  const c = { id: 'c', title: 'C', stage_id: stage.id, unit_id: gsUnit.unit.id };
  const loose = { id: 'd', title: 'D', stage_id: stage.id, section_name: 'General Studies' };
  const none = { id: 'e', title: 'Quarterly review' };
  const custom = { id: 'manual', title: 'Custom Questions', source_type: 'manual' };

  const tree = buildCollectionTree([a, b, c, loose, none, custom], p => p.source_type === 'manual');
  const group4 = tree.groups.find(g => g.id === 'group-4')!;

  it('nests exam → subject → unit → collections', () => {
    const tamil = group4.sections.find(s => s.name === 'General Tamil')!;
    expect(tamil.units.find(u => u.unitId === tamilUnit.unit.id)!.papers.map(p => p.id)).toEqual(['a', 'b']);
    expect(group4.sections.find(s => s.name === 'General Studies')!.units.find(u => u.unitId === gsUnit.unit.id)!.papers.map(p => p.id)).toEqual(['c']);
  });

  it('lists every subject the exam has, with its units, filled or not', () => {
    expect(group4.sections.map(s => s.name)).toEqual(['General Tamil', 'General English', 'General Studies', 'Aptitude & Mental Ability']);
    expect(group4.sections.every(s => s.units.length > 0)).toBe(true);
  });

  it('keeps a subject-only collection under its subject, and the rest out of the tree', () => {
    expect(group4.sections.find(s => s.name === 'General Studies')!.loose.map(p => p.id)).toEqual(['d']);
    expect(tree.unassigned.map(p => p.id)).toEqual(['e']);
    expect(tree.custom.map(p => p.id)).toEqual(['manual']);
  });

  it('counts each collection once', () => {
    expect(group4.total).toBe(4);
    const all = [
      ...group4.sections.flatMap(s => [...s.units.flatMap(u => u.papers), ...s.loose]),
      ...group4.loose,
      ...tree.unassigned,
      ...tree.custom,
    ];
    expect(all.map(p => p.id).sort()).toEqual(['a', 'b', 'c', 'd', 'e', 'manual']);
  });

  it('always shows Group 4 and Group 2, even with no collections', () => {
    expect(buildCollectionTree([]).groups.map(g => g.id)).toEqual(['group-4', 'group-2']);
  });
});

describe('assign choices', () => {
  it('offers each subject’s units for an exam, and the exams that publish units', () => {
    const choices = unitChoices('group-4');
    expect(choices.map(c => c.section)).toContain('General English');
    expect(choices.every(c => c.stageId === stage.id && c.units.length > 0)).toBe(true);
    expect(placeableGroups().map(g => g.id)).toContain('group-4');
    expect(unitChoices('nope')).toEqual([]);
  });
});
