/**
 * The case that prompted this: a collection named `Unit_4_Tamil_50Q_Hard` held 50 Complex
 * questions for Tamil Unit IV, but the unit picker found 8, because the questions are
 * tagged by the discipline their term comes from (`புள்ளியியல்` — statistics), and nothing
 * in such a tag says "Unit IV".
 */
import { describe, expect, it } from 'vitest';
import { findStage, findUnit } from '@/config/tnpsc';
import { parseCollectionTitle, unitFromCollectionTitle } from '@/lib/collection-unit';
import { inSelectedUnits, questionInUnit, unitBankCounts } from '@/lib/unit-pool';

const stage = findStage('group-4', 'group-4-written')!.stage;
const unit = (id: string) => findUnit(stage, id)!;
const id = (title: string) => unitFromCollectionTitle(stage, title);

describe('unitFromCollectionTitle', () => {
  it('reads the name the team actually used', () => {
    expect(id('Unit_4_Tamil_50Q_Hard')).toBe('g4-ta-technical-terms');
  });

  it('is the paper that decides — Unit IV is a different unit in each', () => {
    expect(id('Unit_4_English_50Q')).toBe('g4-en-technical-terms');
    expect(id('Unit_4_GS_20Q')).toBe('g4-gs-indian-polity');
    expect(id('Unit 4 Tamil')).toBe('g4-ta-technical-terms');
  });

  it('reads a roman numeral and the usual separators', () => {
    expect(id('unit-IV-tamil')).toBe('g4-ta-technical-terms');
    expect(id('Unit.1.Tamil')).toBe('g4-ta-grammar');
    expect(id('TNPSC Group 4 — Unit 7 Tamil')).toBe('g4-ta-literature');
  });

  it('places Aptitude and Reasoning, which number their units I and II', () => {
    expect(id('Unit_1_Aptitude_30Q')).toBe('g4-apt-aptitude');
    expect(id('Unit_2_Reasoning_30Q')).toBe('g4-apt-reasoning');
  });

  it('does not guess a paper from a unit number alone', () => {
    expect(id('Unit_4_50Q_Hard')).toBeNull();
    expect(parseCollectionTitle(stage, 'Unit_4_50Q_Hard').looksLikeUnit).toBe(true);
  });

  it('does not choose between two papers named at once', () => {
    expect(id('Unit_4_Tamil_English')).toBeNull();
  });

  it('leaves a unit that does not exist unplaced', () => {
    expect(id('Unit_9_Tamil')).toBeNull(); // Tamil has seven
    expect(id('Unit_0_Tamil')).toBeNull();
  });

  it('ignores a name that is not about a unit', () => {
    expect(id('Group 4 Mock 12')).toBeNull();
    expect(parseCollectionTitle(stage, 'Group 4 Mock 12').looksLikeUnit).toBe(false);
    expect(id('Community 4 Tamil')).toBeNull(); // "unit" has to stand alone
  });

  it('copes with nothing', () => {
    expect(id('')).toBeNull();
    expect(unitFromCollectionTitle(stage, undefined)).toBeNull();
    expect(unitFromCollectionTitle(undefined, 'Unit_4_Tamil')).toBeNull();
  });
});

describe('placing a question by its collection', () => {
  /** A Tamil technical-terms question as the sheet tagged it — by discipline. */
  const q = (over: Record<string, unknown> = {}) => ({
    subject: 'புள்ளியியல்',
    chapter: 'ஆய்வு மறை',
    difficulty: 'hard',
    ...over,
  });

  it('finds nothing on the tags alone', () => {
    expect(questionInUnit(stage, q(), unit('g4-ta-technical-terms'))).toBe(false);
  });

  it('finds it once the question carries its collection', () => {
    expect(questionInUnit(stage, q({ paper_title: 'Unit_4_Tamil_50Q_Hard' }), unit('g4-ta-technical-terms'))).toBe(true);
  });

  it('puts it in no other unit', () => {
    const placed = q({ paper_title: 'Unit_4_Tamil_50Q_Hard' });
    expect(questionInUnit(stage, placed, unit('g4-ta-grammar'))).toBe(false);
    expect(inSelectedUnits(stage, placed, [unit('g4-ta-technical-terms')])).toBe(true);
  });

  it('lets the question’s own tags win over the collection', () => {
    const polity = q({ subject: 'Indian Polity', chapter: 'Fundamental Rights', paper_title: 'Unit_4_Tamil_50Q_Hard' });
    expect(questionInUnit(stage, polity, unit('g4-gs-indian-polity'))).toBe(true);
    expect(questionInUnit(stage, polity, unit('g4-ta-technical-terms'))).toBe(false);
  });

  it('lets a question’s own unit win over everything', () => {
    const own = q({ unit_id: 'g4-ta-grammar', paper_title: 'Unit_4_Tamil_50Q_Hard' });
    expect(questionInUnit(stage, own, unit('g4-ta-grammar'))).toBe(true);
    expect(questionInUnit(stage, own, unit('g4-ta-technical-terms'))).toBe(false);
  });
});

describe('unitBankCounts — saying what the collection rule did', () => {
  const rows = [
    ...Array.from({ length: 5 }, () => ({ subject: 'புள்ளியியல்', paper_title: 'Unit_4_Tamil_50Q_Hard' })),
    ...Array.from({ length: 2 }, () => ({ subject: 'கணக்கு', paper_title: 'Unit_3_Maths_20Q' })),
    { subject: 'Indian Polity' },
  ];
  const counts = unitBankCounts(stage, rows);

  it('counts the questions a collection placed, and names the collection', () => {
    expect(counts.byUnit['g4-ta-technical-terms']).toBe(5);
    expect(counts.viaCollection.total).toBe(5);
    expect(counts.viaCollection.titles).toEqual([{ title: 'Unit_4_Tamil_50Q_Hard', count: 5 }]);
  });

  it('flags a unit-looking collection that does not say which paper', () => {
    expect(counts.unclearCollections).toEqual([{ title: 'Unit_3_Maths_20Q', count: 2 }]);
  });

  it('does not count a question its own tags placed as the collection’s doing', () => {
    expect(counts.byUnit['g4-gs-indian-polity']).toBe(1);
    expect(counts.viaCollection.total).toBe(5);
  });
});
