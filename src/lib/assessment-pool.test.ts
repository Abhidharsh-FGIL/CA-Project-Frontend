import { describe, expect, it } from 'vitest';
import { bankUnitId, bankUnitIds, bankUnitWeights, describePool } from '@/lib/assessment-pool';

const base = { source: 'bank' as const, shuffle: true, composed: false, stageId: 'group-4-written' };

const pool = [
  { subject: 'Aptitude & Mental Ability', chapter: 'Percentage' },
  { subject: 'Aptitude & Mental Ability', chapter: 'Ratio & Proportion' },
  { subject: 'Aptitude', chapter: 'Percentage' },
];

describe('describePool — a paper that draws a fresh sample from a pool is live', () => {
  it('a Medium paper on one unit', () => {
    expect(
      describePool({ ...base, unitIds: ['g4-apt-aptitude'], difficulty: 'medium', sourceType: 'online', questions: pool }),
    ).toEqual({
      mode: 'live',
      filter: {
        stage_id: 'group-4-written',
        unit_ids: ['g4-apt-aptitude'],
        subjects: ['Aptitude & Mental Ability', 'Aptitude'],
        chapters: ['Percentage', 'Ratio & Proportion'],
        paper_ids: null,
        difficulty: 'medium',
        question_types: null,
        source_type: 'online',
      },
    });
  });

  it('several units, any difficulty', () => {
    const { mode, filter } = describePool({ ...base, unitIds: ['g4-apt-aptitude', 'g4-apt-reasoning'], difficulty: null, questions: pool });
    expect(mode).toBe('live');
    expect(filter?.unit_ids).toEqual(['g4-apt-aptitude', 'g4-apt-reasoning']);
    expect(filter?.difficulty).toBeNull();
  });

  it('a paper placed by subject rather than unit is live on what its questions carry', () => {
    const { mode, filter } = describePool({ ...base, difficulty: 'hard', questions: pool });
    expect(mode).toBe('live');
    expect(filter?.unit_ids).toBeNull();
    expect(filter?.subjects).toEqual(['Aptitude & Mental Ability', 'Aptitude']);
    expect(filter?.chapters).toEqual(['Percentage', 'Ratio & Proportion']);
  });

  it('carries the question types it was narrowed to', () => {
    const { filter } = describePool({ ...base, unitIds: ['u1'], questionTypes: ['mcq'], questions: pool });
    expect(filter?.question_types).toEqual(['mcq']);
  });

  it('whole collections, whatever else was chosen', () => {
    const { mode, filter } = describePool({
      ...base,
      source: 'paper',
      paperIds: ['p1', 'p2'],
      unitIds: ['ignored'],
      difficulty: 'medium',
      questions: pool,
    });
    expect(mode).toBe('live');
    expect(filter?.paper_ids).toEqual(['p1', 'p2']);
    expect(filter?.unit_ids).toBeNull();
    expect(filter?.subjects).toBeNull();
    expect(filter?.difficulty).toBeNull();
  });
});

describe('describePool — what the questions carry', () => {
  it('keeps one spelling of a subject that appears in several cases', () => {
    const { filter } = describePool({
      ...base,
      unitIds: ['u1'],
      questions: [
        { subject: 'Aptitude', chapter: 'Percentage' },
        { subject: 'APTITUDE', chapter: 'percentage' },
        { subject: ' Aptitude ', chapter: 'Percentage ' },
      ],
    });
    expect(filter?.subjects).toEqual(['Aptitude']);
    expect(filter?.chapters).toEqual(['Percentage']);
  });

  it('ignores blank and missing subjects and topics', () => {
    const { filter } = describePool({
      ...base,
      unitIds: ['u1'],
      questions: [{ subject: '', chapter: null }, { subject: 'Aptitude', chapter: 'Area' }, {}],
    });
    expect(filter?.subjects).toEqual(['Aptitude']);
    expect(filter?.chapters).toEqual(['Area']);
  });

  it('a subject without a topic is too loose to send — it would span two units', () => {
    const { mode, filter } = describePool({ ...base, unitIds: ['u1'], questions: [{ subject: 'Aptitude', chapter: '' }] });
    expect(mode).toBe('live'); // the unit still says which questions belong
    expect(filter?.subjects).toBeNull();
    expect(filter?.chapters).toBeNull();
  });

  it('no unit and no topics leaves nothing to match on', () => {
    expect(describePool({ ...base, questions: [{ subject: 'Aptitude', chapter: '' }] })).toEqual({ mode: 'fixed', filter: null });
  });
});

describe('describePool — everything else is a fixed set', () => {
  it('a composed paper (built to the exam split and blend) stays fixed', () => {
    expect(describePool({ ...base, composed: true, unitIds: ['u1'], questions: pool })).toEqual({ mode: 'fixed', filter: null });
  });

  it('a paper taken in one fixed order stays fixed', () => {
    expect(describePool({ ...base, shuffle: false, unitIds: ['u1'], questions: pool })).toEqual({ mode: 'fixed', filter: null });
  });

  it('a pool with nothing chosen has no rule to state', () => {
    expect(describePool({ ...base })).toEqual({ mode: 'fixed', filter: null });
    expect(describePool({ ...base, unitIds: [], questions: [] })).toEqual({ mode: 'fixed', filter: null });
    expect(describePool({ ...base, source: 'paper', paperIds: [] })).toEqual({ mode: 'fixed', filter: null });
  });
});

describe('the unit ids sent to draw from the bank', () => {
  it('turns a Group 2 unit into the Group 4 id the bank’s questions are tagged with', () => {
    expect(bankUnitId('g2-ta-grammar')).toBe('g4-ta-grammar');
    expect(bankUnitId('g2-gs-indian-polity')).toBe('g4-gs-indian-polity');
  });

  it('leaves Group 4’s own ids exactly as they are', () => {
    expect(bankUnitId('g4-ta-grammar')).toBe('g4-ta-grammar');
    expect(bankUnitIds(['g4-gs-geography', 'g4-apt-reasoning'])).toEqual(['g4-gs-geography', 'g4-apt-reasoning']);
    expect(bankUnitWeights({ 'g4-gs-geography': 5 })).toEqual({ 'g4-gs-geography': 5 });
  });

  it('maps a list and its weights, and keeps a missing list missing', () => {
    expect(bankUnitIds(['g2-ta-grammar', 'g2-gs-geography'])).toEqual(['g4-ta-grammar', 'g4-gs-geography']);
    expect(bankUnitWeights({ 'g2-ta-grammar': 10, 'g2-gs-geography': 5 })).toEqual({ 'g4-ta-grammar': 10, 'g4-gs-geography': 5 });
    expect(bankUnitIds(undefined)).toBeUndefined();
    expect(bankUnitWeights(undefined)).toBeUndefined();
  });

  it('puts the bank’s ids in a live pool’s rule too', () => {
    const { filter } = describePool({ ...base, stageId: 'group-2-prelims', unitIds: ['g2-gs-geography'], questions: pool });
    expect(filter?.unit_ids).toEqual(['g4-gs-geography']);
  });
});
