import { describe, expect, it } from 'vitest';
import { TNPSC_GROUPS, stageUnits } from '@/config/tnpsc';
import { buildAssessmentTree, kindOf, placementLine, seedFor, unitForAssessment } from './assessment-hierarchy';
import { EMPTY_TAG } from './tnpscAdminApi';

const stage = TNPSC_GROUPS.find(g => g.id === 'group-4')!.stages[0];
const units = stageUnits(stage);
const tamil = units.find(u => u.sectionName === 'General Tamil')!;
const english = units.find(u => u.sectionName === 'General English')!;
const gs = units.find(u => u.sectionName === 'General Studies')!;

const row = (id: string, over: Record<string, any>) => ({ id, title: id, stage_id: stage.id, ...over });

describe('kindOf', () => {
  it('reads mock, key topic and practice off the tag', () => {
    expect(kindOf({ ...EMPTY_TAG, track: 'mock' })).toBe('mock');
    expect(kindOf({ ...EMPTY_TAG, track: 'practice', scope: 'unit' })).toBe('practice');
    expect(kindOf({ ...EMPTY_TAG, track: 'practice', scope: 'section' })).toBe('practice');
    expect(kindOf({ ...EMPTY_TAG, track: 'practice', scope: 'topic' })).toBe('keytopic');
    expect(kindOf({ ...EMPTY_TAG, track: 'practice', scope: 'unit', topic_id: 't1' })).toBe('keytopic');
    expect(kindOf(EMPTY_TAG)).toBeNull();
  });
});

describe('buildAssessmentTree', () => {
  const rows = [
    row('m1', { track: 'mock', level: 'simple' }),
    row('m2', { track: 'mock', level: 'medium' }),
    row('p1', { track: 'practice', scope: 'unit', unit_id: tamil.unit.id }),
    row('p2', { track: 'practice', scope: 'unit', unit_id: english.unit.id }),
    row('p3', { track: 'practice', scope: 'section', section_name: 'General Studies' }),
    row('k1', { track: 'practice', scope: 'unit', unit_id: gs.unit.id, topic_id: 'topic-1' }),
    row('x1', { title: 'No placement' }),
    row('x2', { track: 'practice', scope: 'unit', unit_id: 'no-such-unit' }),
  ];
  const tree = buildAssessmentTree(rows);
  const g4 = tree.groups.find(g => g.id === 'group-4')!;
  const unit = (list: typeof g4.practice, name: string, id: string) => list.find(s => s.name === name)!.units.find(u => u.unitId === id)!;

  it('puts mocks directly under the exam', () => {
    expect(g4.mock.map(r => r.id)).toEqual(['m1', 'm2']);
  });

  it('files practice under subject → unit', () => {
    expect(unit(g4.practice, 'General Tamil', tamil.unit.id).items.map(r => r.id)).toEqual(['p1']);
    expect(unit(g4.practice, 'General English', english.unit.id).items.map(r => r.id)).toEqual(['p2']);
  });

  it('files a whole-subject set under its subject, in no unit', () => {
    expect(g4.practice.find(s => s.name === 'General Studies')!.whole.map(r => r.id)).toEqual(['p3']);
  });

  it('files key topics under subject → unit, apart from practice', () => {
    expect(unit(g4.keyTopics, 'General Studies', gs.unit.id).items.map(r => r.id)).toEqual(['k1']);
    expect(g4.practice.flatMap(s => s.units.flatMap(u => u.items)).map(r => r.id)).not.toContain('k1');
  });

  it('lists every subject the exam has, units and all, filled or not', () => {
    for (const list of [g4.practice, g4.keyTopics]) {
      expect(list.map(s => s.name)).toEqual(['General Tamil', 'General English', 'General Studies', 'Aptitude & Mental Ability']);
      expect(list.every(s => s.units.length > 0)).toBe(true);
    }
  });

  it('sets aside what the tag does not place, without losing it', () => {
    expect(tree.unplaced.map(r => r.id).sort()).toEqual(['x1', 'x2']);
    expect(g4.total + tree.unplaced.length).toBe(rows.length);
  });

  it('always has Group 4, and Group 2 beside it, so both are there before their first assessment', () => {
    expect(buildAssessmentTree([]).groups.map(g => g.id)).toEqual(['group-4', 'group-2']);
  });
});

describe('seedFor — where a new assessment starts', () => {
  it('seeds a mock, a unit practice set, a key-topic set and a whole-subject set', () => {
    expect(seedFor('group-4', 'mock')).toMatchObject({ stage_id: stage.id, track: 'mock' });
    expect(seedFor('group-4', 'practice', { unitId: tamil.unit.id })).toMatchObject({ track: 'practice', scope: 'unit', unit_id: tamil.unit.id });
    expect(seedFor('group-4', 'keytopic', { unitId: gs.unit.id })).toMatchObject({ track: 'practice', scope: 'topic', unit_id: gs.unit.id });
    expect(seedFor('group-4', 'practice', { section: 'General Studies' })).toMatchObject({ scope: 'section', section_name: 'General Studies' });
  });
});

describe('Group 2', () => {
  const g2stage = TNPSC_GROUPS.find(g => g.id === 'group-2')!.stages.find(s => s.id === 'group-2-prelims')!;
  const g2units = stageUnits(g2stage);
  const g2gs = g2units.find(u => u.sectionName === 'General Studies')!;

  it('has Group 4’s units under its own g2- ids — the ids the server lists for group-2-prelims', () => {
    expect(g2units.length).toBeGreaterThan(0);
    expect(g2units.map(u => u.unit.id)).toEqual(units.map(u => u.unit.id.replace(/^g4-/, 'g2-')));
    expect(g2units.map(u => u.unit.id)).toContain('g2-gs-general-science');
  });

  it('files a Group 2 assessment under Group 2, by its stage and unit', () => {
    const tree = buildAssessmentTree([
      { id: 'a', title: 'a', stage_id: 'group-2-prelims', track: 'mock', level: 'simple' },
      { id: 'b', title: 'b', stage_id: 'group-2-prelims', track: 'practice', scope: 'unit', unit_id: g2gs.unit.id },
    ]);
    const g2 = tree.groups.find(g => g.id === 'group-2')!;
    expect(g2.mock.map(r => r.id)).toEqual(['a']);
    expect(g2.practice.find(s => s.name === 'General Studies')!.units.find(u => u.unitId === g2gs.unit.id)!.items.map(r => r.id)).toEqual(['b']);
    expect(tree.unplaced).toEqual([]);
  });

  it('starts from Group 4’s split, so the wizard’s unit weightage is filled in the same way', () => {
    const g4by = new Map(units.map(u => [u.unit.id, u.unit.questions]));
    for (const u of g2units) expect(u.unit.questions).toBe(g4by.get(u.unit.id.replace(/^g2-/, 'g4-')));
  });
});

describe('Group 2 assessments find their units as Group 4 ones do', () => {
  const g2 = TNPSC_GROUPS.find(g => g.id === 'group-2')!.stages.find(st => st.id === 'group-2-prelims')!;
  const base = { group_id: 'group-2', stage_id: 'group-2-prelims', track: 'practice', scope: 'unit' };

  it('takes the g2- unit id the papers are stored with', () => {
    expect(unitForAssessment(g2, 'g2-apt-reasoning')?.unit.id).toBe('g2-apt-reasoning');
    expect(unitForAssessment(g2, 'g2-gs-general-science')?.unit.id).toBe('g2-gs-general-science');
  });

  it('reads the unit off the title when the tag has none', () => {
    expect(unitForAssessment(g2, null, 'TNPSC Group 2 Prelims — Reasoning · Mixed')?.unit.id).toBe('g2-apt-reasoning');
    expect(unitForAssessment(g2, null, 'Aptitude: Simplification · Mixed')?.unit.id).toBe('g2-apt-aptitude');
    expect(unitForAssessment(g2, null, 'Something else · Mixed')).toBeUndefined();
  });

  it('files them under their unit in the tree, and names the unit in a line', () => {
    const rows = [
      { id: 'a', title: 'TNPSC Group 2 Prelims — Reasoning · Mixed', ...base, unit_id: 'g2-apt-reasoning' },
      { id: 'b', title: 'TNPSC Group 2 Prelims — Reasoning · Mixed', ...base },
    ];
    const tree = buildAssessmentTree(rows);
    const apt = tree.groups.find(g => g.id === 'group-2')!.practice.find(sec => sec.name === 'Aptitude & Mental Ability')!;
    expect(apt.units.find(u => u.unitId === 'g2-apt-reasoning')!.items.map(r => r.id)).toEqual(['a', 'b']);
    expect(placementLine(rows[1])).toBe('TNPSC Group 2 · Aptitude & Mental Ability › Unit II · Reasoning');
  });
});
