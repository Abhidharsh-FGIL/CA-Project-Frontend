import { describe, expect, it } from 'vitest';
import { findStage } from '@/config/tnpsc';
import { suggestAssessmentTitle, EMPTY_TAG, type TnpscTagValue } from '@/lib/tnpscAdminApi';
import { placementFromTitle, withTitlePlacement } from './tnpsc-title-placement';

const stage = findStage('group-4', 'group-4-written')!.stage;

/**
 * A paper was created and tagged, `is_visible_to_users: true`, and the unit still said
 * "No paper yet": the listing carried no `unit_id`. The title carries it.
 */
describe('placementFromTitle', () => {
  it('reads the title of the paper that went missing', () => {
    expect(placementFromTitle(stage, 'TNPSC Group 4 — இலக்கணம் · Simple')).toEqual({
      unit_id: 'g4-ta-grammar',
      level: 'simple',
    });
  });

  it('reads each difficulty, and Mixed as no difficulty', () => {
    expect(placementFromTitle(stage, 'TNPSC Group 4 — Indian Polity · Medium')?.level).toBe('medium');
    expect(placementFromTitle(stage, 'TNPSC Group 4 — Indian Polity · Complex')?.level).toBe('complex');
    expect(placementFromTitle(stage, 'TNPSC Group 4 — Indian Polity · Mixed')).toEqual({
      unit_id: 'g4-gs-indian-polity',
      level: null,
    });
  });

  it('still reads titles written before "Full Unit" became "Mixed"', () => {
    expect(placementFromTitle(stage, 'TNPSC Group 4 — Indian Polity · Full Unit')).toEqual({
      unit_id: 'g4-gs-indian-polity',
      level: null,
    });
  });

  it('ignores a topic after the unit', () => {
    expect(
      placementFromTitle(stage, 'TNPSC Group 4 — Indian Polity: Fundamental Rights · Simple')?.unit_id,
    ).toBe('g4-gs-indian-polity');
  });

  it('keeps the Tamil and English papers apart — each unit is named in its own language', () => {
    expect(placementFromTitle(stage, 'TNPSC Group 4 — Grammar · Simple')?.unit_id).toBe('g4-en-grammar');
    expect(placementFromTitle(stage, 'TNPSC Group 4 — இலக்கணம் · Simple')?.unit_id).toBe('g4-ta-grammar');
  });

  it('infers nothing from a title that is not a unit paper', () => {
    expect(placementFromTitle(stage, 'TNPSC Group 4 — General Studies · Full Set')).toBeNull();
    expect(placementFromTitle(stage, 'TNPSC Group 4 — Full Mock (Tamil)')).toBeNull();
    expect(placementFromTitle(stage, 'Exam-1 General Tamil & General Studies')).toBeNull();
    expect(placementFromTitle(stage, 'TNPSC Group 4 — இலக்கணம் · Easy')).toBeNull();
    expect(placementFromTitle(stage, 'TNPSC Group 4 — Not A Unit · Simple')).toBeNull();
    expect(placementFromTitle(stage, '')).toBeNull();
    expect(placementFromTitle(undefined, 'TNPSC Group 4 — இலக்கணம் · Simple')).toBeNull();
  });

  /** The wizard's own suggestion is what this reads back, so the two must agree. */
  it('reads back what the wizard writes, for every unit and difficulty', () => {
    const base: TnpscTagValue = { ...EMPTY_TAG, group_id: 'group-4', stage_id: 'group-4-written', track: 'practice', scope: 'unit' };
    const units = stage.pattern!.sections.flatMap(s => s.units ?? []);
    expect(units.length).toBeGreaterThan(10);
    for (const unit of units) {
      for (const level of ['simple', 'medium', 'complex', null] as const) {
        const title = suggestAssessmentTitle({ ...base, unit_id: unit.id, level });
        expect(placementFromTitle(stage, title), title ?? '').toEqual({ unit_id: unit.id, level });
      }
    }
  });
});

describe('withTitlePlacement', () => {
  const paper = { title: 'TNPSC Group 4 — இலக்கணம் · Simple', test_type: 'practice', unit_id: null, level: null };

  it('fills in a unit and level the server left out', () => {
    expect(withTitlePlacement(stage, [paper])[0]).toMatchObject({ unit_id: 'g4-ta-grammar', level: 'simple' });
  });

  it('never overrides what the server said', () => {
    const placed = withTitlePlacement(stage, [{ ...paper, unit_id: 'g4-ta-vocabulary', level: 'complex' as const }])[0];
    expect(placed.unit_id).toBe('g4-ta-vocabulary');
    expect(placed.level).toBe('complex');
  });

  it('leaves mock papers alone', () => {
    const mock = { ...paper, test_type: 'mock' };
    expect(withTitlePlacement(stage, [mock])[0]).toBe(mock);
  });

  it('leaves a paper it cannot read untouched', () => {
    const other = { ...paper, title: 'Exam-1 General Tamil & General Studies' };
    expect(withTitlePlacement(stage, [other])[0]).toBe(other);
  });
});
