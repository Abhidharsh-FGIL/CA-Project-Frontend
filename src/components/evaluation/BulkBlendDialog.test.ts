import { describe, expect, it } from 'vitest';
import { bulkTargets } from './BulkBlendDialog';

const g2 = 'group-2-prelims';
const g4 = 'group-4-written';
const rows = [
  { id: 'm2', title: 'G2 mock', stage_id: g2, track: 'mock', level: 'simple' },
  { id: 'f2', title: 'G2 full set', stage_id: g2, track: 'practice', scope: 'section', section_name: 'General Studies' },
  { id: 'u2', title: 'G2 mixed unit', stage_id: g2, track: 'practice', scope: 'unit', unit_id: 'g2-gs-indian-polity' },
  { id: 'k2', title: 'G2 key topic', stage_id: g2, track: 'practice', scope: 'unit', unit_id: 'g2-gs-indian-polity', topic_id: 't' },
  { id: 'l2', title: 'G2 level set', stage_id: g2, track: 'practice', scope: 'unit', unit_id: 'g2-gs-indian-polity', level: 'medium' },
  { id: 's2', title: 'G2 saved', stage_id: g2, track: 'mock', level: 'simple', difficulty_blend: { easy: 30, medium: 30, hard: 40 } },
  { id: 'd2', title: 'G2 done', stage_id: g2, track: 'mock', level: 'simple', difficulty_blend: { easy: 10, medium: 30, hard: 60 } },
  { id: 'm4', title: 'G4 mock', stage_id: g4, track: 'mock', level: 'simple' },
];
const ALL = ['mock', 'full-section', 'mixed-unit', 'mixed-topic'] as const;
const mix = { easy: 10, medium: 30, hard: 60 };

describe('bulkTargets — which assessments a bulk mix change touches', () => {
  it('every mixed Group 2 paper with no saved mix, and nothing of Group 4', () => {
    const ids = bulkTargets(rows, { groupId: 'group-2', kinds: [...ALL], onlyUnsaved: true, blend: mix }).map(r => r.id);
    expect(ids).toEqual(['m2', 'f2', 'u2', 'k2']);
  });

  it('leaves out a set pitched at one level — it has no mix', () => {
    const ids = bulkTargets(rows, { groupId: 'group-2', kinds: [...ALL], onlyUnsaved: false, blend: mix }).map(r => r.id);
    expect(ids).not.toContain('l2');
  });

  it('with "only unsaved" off, also changes a paper saved at another mix — but not one already at this mix', () => {
    const ids = bulkTargets(rows, { groupId: 'group-2', kinds: [...ALL], onlyUnsaved: false, blend: mix }).map(r => r.id);
    expect(ids).toContain('s2');
    expect(ids).not.toContain('d2');
  });

  it('only the kinds ticked', () => {
    expect(bulkTargets(rows, { groupId: 'group-2', kinds: ['mock'], onlyUnsaved: true, blend: mix }).map(r => r.id)).toEqual(['m2']);
  });
});
