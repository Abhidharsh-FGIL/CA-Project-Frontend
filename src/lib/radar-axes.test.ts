import { describe, expect, it } from 'vitest';
import { TNPSC_GROUPS, stageUnits } from '@/config/tnpsc';
import { MAX_RADAR_AXES, radarSections, type RadarRow } from './radar-axes';

const row = (subjectId: string, over: Partial<RadarRow> = {}): RadarRow => ({
  subjectId,
  label: subjectId,
  value: 0,
  evidenceCount: 0,
  correct: 0,
  questions: 2,
  scorePct: null,
  marksEarned: null,
  marksAvailable: null,
  state: 'NOT_ASSESSED',
  ...over,
});

const ntpcUnits = stageUnits(TNPSC_GROUPS.find(g => g.id === 'rrb-ntpc-cbt-1')!.stages[0]);

describe('radarSections', () => {
  it("keeps every one of an RRB NTPC paper's units, under its three sections", () => {
    expect(ntpcUnits.length).toBeGreaterThan(MAX_RADAR_AXES);
    const radar = ntpcUnits.map(({ unit }, i) => row(`unit:${unit.id}`, i === 0 ? { correct: 2 } : {}));
    const sections = radarSections(radar);

    expect(sections.map(s => s.name)).toEqual(['General Awareness', 'Mathematics', 'General Intelligence & Reasoning']);
    expect(sections.flatMap(s => s.rows)).toEqual(radar);
    expect(sections[0].correct).toBe(2);
    expect(sections.reduce((n, s) => n + s.questions, 0)).toBe(ntpcUnits.length * 2);
  });

  it('puts units no section claims last, and leaves an unknown paper as one unnamed group', () => {
    const known = row(`unit:${ntpcUnits[0].unit.id}`);
    expect(radarSections([row('x-1'), known]).map(s => s.name)).toEqual(['General Awareness', null]);
    expect(radarSections([row('x-1'), row('x-2')])).toEqual([{ name: null, rows: [row('x-1'), row('x-2')], correct: 0, questions: 4 }]);
  });
});
