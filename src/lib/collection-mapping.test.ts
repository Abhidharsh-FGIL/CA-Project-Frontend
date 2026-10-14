import { describe, expect, it } from 'vitest';
import { findStage } from '@/config/tnpsc';
import { mappingTotals, summariseCollections } from './collection-mapping';

const stage = findStage('group-4', 'group-4-written')!.stage;

const english = 'In an official order, which term most precisely conveys “Notification” to the public?';

/**
 * A collection of 50 shows 0 in its unit. The useful answer is where its questions went, and
 * what they are tagged with when they went nowhere.
 */
describe('summariseCollections', () => {
  const papers = [
    { id: 'p-simple', title: 'Unit_4_English_50Q_Easy' },
    { id: 'p-hard', title: 'Unit_4_English_50Q_Hard' },
    { id: 'p-ok', title: 'Unit_3_English_50Q_Easy' },
  ];
  const questions = [
    ...Array.from({ length: 3 }, () => ({ paper_id: 'p-simple', subject: 'General English', chapter: 'Unit IV: Technical Terms', difficulty: 'easy', text: english })),
    // A collection whose questions carry a tag the matcher cannot read.
    ...Array.from({ length: 4 }, () => ({ paper_id: 'p-hard', subject: 'Some Other Label', chapter: 'Administrative Terms', difficulty: 'hard', text: english })),
    ...Array.from({ length: 2 }, () => ({ paper_id: 'p-hard', subject: 'Some Other Label', chapter: 'Official Correspondence', difficulty: 'hard', text: english })),
    ...Array.from({ length: 2 }, () => ({ paper_id: 'p-ok', subject: 'English', chapter: 'Unit III: Writing Skills', difficulty: 'easy', text: english })),
    { paper_id: null, subject: 'Indian Polity', difficulty: 'medium', text: 'q' },
  ];

  const rows = summariseCollections(stage, questions, papers);
  const byTitle = (t: string) => rows.find(r => r.title === t)!;

  it('names the unit a collection landed in, with how many', () => {
    const r = byTitle('Unit_4_English_50Q_Easy');
    expect(r.total).toBe(3);
    expect(r.placed).toBe(3);
    expect(r.byUnit).toEqual([{ unitId: 'g4-en-technical-terms', count: 3 }]);
  });

  it('says what an unplaced collection is tagged with, commonest first, with a sample', () => {
    const r = byTitle('Unit_4_English_50Q_Hard');
    expect(r.placed).toBe(0);
    expect(r.unplaced[0]).toMatchObject({ subject: 'Some Other Label', chapter: 'Administrative Terms', count: 4 });
    expect(r.unplaced[1]).toMatchObject({ chapter: 'Official Correspondence', count: 2 });
    expect(r.unplaced[0].sample).toContain('Notification');
  });

  it('reports the difficulty spread of each collection, so a missing Complex band is visible', () => {
    expect(byTitle('Unit_4_English_50Q_Hard').difficulty).toMatchObject({ easy: 0, medium: 0, hard: 6 });
    expect(byTitle('Unit_4_English_50Q_Easy').difficulty).toMatchObject({ easy: 3, hard: 0 });
  });

  it('puts the collections with questions that landed nowhere first', () => {
    expect(rows[0].title).toBe('Unit_4_English_50Q_Hard');
  });

  it('keeps questions that belong to no collection together', () => {
    const r = rows.find(x => x.id === null)!;
    expect(r.title).toBe('Not in any collection');
    expect(r.total).toBe(1);
  });

  it('totals across everything', () => {
    expect(mappingTotals(rows)).toEqual({ total: 12, placed: 6 });
  });
});
