/**
 * Naming a paper from its placement.
 *
 * The cascade already states what a paper is, so the title is derived rather than
 * invented — two hundred hand-named papers neither sort nor scan.
 */
import { describe, it, expect } from 'vitest';
import { EMPTY_TAG, suggestAssessmentTitle, type TnpscTagValue } from '@/lib/tnpscAdminApi';

const g4 = (over: Partial<TnpscTagValue> = {}): TnpscTagValue => ({
  ...EMPTY_TAG,
  group_id: 'group-4',
  stage_id: 'group-4-written',
  ...over,
});

describe('unit-wise practice', () => {
  it('names the unit and the button it sits behind', () => {
    expect(
      suggestAssessmentTitle(
        g4({ track: 'practice', scope: 'unit', unit_id: 'g4-gs-indian-polity', level: 'simple' }),
      ),
    ).toBe('TNPSC Group 4 — Indian Polity · Simple');
  });

  it('says Mixed where there is no level', () => {
    expect(
      suggestAssessmentTitle(
        g4({ track: 'practice', scope: 'unit', unit_id: 'g4-gs-indian-polity', level: null }),
      ),
    ).toBe('TNPSC Group 4 — Indian Polity · Mixed');
  });

  it('includes the topic when the paper is narrowed to one', () => {
    expect(
      suggestAssessmentTitle(
        g4({
          track: 'practice',
          scope: 'unit',
          unit_id: 'g4-gs-indian-polity',
          topic_id: 'constitution-preamble',
          level: 'complex',
        }),
      ),
    ).toBe('TNPSC Group 4 — Indian Polity: Constitution of India — Preamble · Complex');
  });

  it('names a Tamil unit by its printed title — in Tamil', () => {
    expect(
      suggestAssessmentTitle(
        g4({ track: 'practice', scope: 'unit', unit_id: 'g4-ta-grammar', level: 'medium' }),
      ),
    ).toBe('TNPSC Group 4 — இலக்கணம் · Medium');
  });

  it('tells the two language papers apart — both have a Grammar', () => {
    const title = (unit_id: string) =>
      suggestAssessmentTitle(g4({ track: 'practice', scope: 'unit', unit_id, level: 'medium' }));
    expect(title('g4-en-grammar')).toBe('TNPSC Group 4 — Grammar · Medium');
    expect(title('g4-ta-grammar')).not.toBe(title('g4-en-grammar'));
  });
});

describe('section-wise practice', () => {
  it('names the section and marks it a full set', () => {
    expect(
      suggestAssessmentTitle(
        g4({ track: 'practice', scope: 'section', section_name: 'General Studies' }),
      ),
    ).toBe('TNPSC Group 4 — General Studies · Full Set');
  });
});

describe('exams', () => {
  // A mock is composed 20% Simple / 30% Medium / 50% Complex, so the title does not name
  // one level while the portal shows no levels (LEVELS_HIDDEN). Its stored level still
  // goes to the server — see `toPayload`.
  it('names the language the paper is sat in', () => {
    expect(suggestAssessmentTitle(g4({ track: 'mock', language: 'tamil', level: 'simple' }))).toBe(
      'TNPSC Group 4 — Full Mock (Tamil)',
    );
    expect(
      suggestAssessmentTitle(g4({ track: 'mock', language: 'english', level: 'complex' })),
    ).toBe('TNPSC Group 4 — Full Mock (English)');
  });

  it('names the stage where the group has more than one', () => {
    // Group 1 runs Prelims and Mains, so the group name alone is ambiguous.
    expect(
      suggestAssessmentTitle({
        ...EMPTY_TAG,
        group_id: 'group-1',
        stage_id: 'group-1-prelims',
        track: 'mock',
        level: 'simple',
      }),
    ).toBe('TNPSC Group 1 Prelims — Full Mock');
  });

  it('leaves the stage out where the group has only one', () => {
    expect(
      suggestAssessmentTitle({
        ...EMPTY_TAG,
        group_id: 'gat-b',
        stage_id: 'gat-b-exam',
        track: 'mock',
        level: 'medium',
      }),
    ).toBe('GAT-B — Full Mock');
  });

  it('names the stage from the catalog, not from what is open today', () => {
    // Counting only *open* stages would rename every Group 1 paper the day Mains
    // opens, leaving two conventions in one list.
    const prelims = suggestAssessmentTitle({
      ...EMPTY_TAG,
      group_id: 'group-1',
      stage_id: 'group-1-prelims',
      track: 'mock',
      level: 'simple',
    });
    expect(prelims).toContain('Prelims');
  });
});

describe('an incomplete placement has no name yet', () => {
  it('waits for the track', () => {
    expect(suggestAssessmentTitle(g4())).toBeNull();
  });

  it('waits for the unit', () => {
    expect(
      suggestAssessmentTitle(g4({ track: 'practice', scope: 'unit', unit_id: null })),
    ).toBeNull();
  });

  it('waits for the section', () => {
    expect(
      suggestAssessmentTitle(g4({ track: 'practice', scope: 'section', section_name: null })),
    ).toBeNull();
  });

  it('waits for the stage', () => {
    expect(suggestAssessmentTitle({ ...EMPTY_TAG, track: 'mock', level: 'simple' })).toBeNull();
  });
});
