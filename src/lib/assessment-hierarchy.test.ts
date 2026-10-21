import { describe, expect, it } from 'vitest';
import { TNPSC_GROUPS, stageUnits } from '@/config/tnpsc';
import { buildAssessmentTree, kindOf, seedFor } from './assessment-hierarchy';
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

  it('always has Group 4', () => {
    expect(buildAssessmentTree([]).groups.map(g => g.id)).toEqual(['group-4']);
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
