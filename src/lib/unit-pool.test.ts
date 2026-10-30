import { describe, expect, it } from 'vitest';
import { findStage, findUnit, stageUnits } from '@/config/tnpsc';
import {
  inSelectedUnits,
  questionInUnit,
  subjectSpread,
  subjectWeightsFromUnits,
  unitBankCounts,
  unitWeightsFromSyllabus,
} from './unit-pool';

const stage = findStage('group-4', 'group-4-written')!.stage;
const unit = (id: string) => findUnit(stage, id)!;
const unitsOf = (q: any) => stageUnits(stage).filter(x => questionInUnit(stage, q, x.unit)).map(x => x.unit.id);

/**
 * The assessment wizard offers the commission's published units, but the bank is
 * tagged by subject and topic. These pin the bridge between the two.
 */
describe('questionInUnit', () => {
  it('puts a question in the unit that owns its subject, and only that one', () => {
    expect(unitsOf({ subject: 'Indian Polity', chapter: 'Fundamental Rights' })).toEqual(['g4-gs-indian-polity']);
    expect(unitsOf({ subject: 'Geography of India' })).toEqual(['g4-gs-geography']);
  });

  it('keeps both halves of a two-subject unit inside that unit', () => {
    expect(unitsOf({ subject: 'Indian Economy' })).toEqual(['g4-gs-economy-and-dev-admin']);
    expect(unitsOf({ subject: 'Development Administration in Tamil Nadu' })).toEqual(['g4-gs-economy-and-dev-admin']);
  });

  it('separates the Tamil units by Topic, since they share one subject', () => {
    expect(unitsOf({ subject: 'General Tamil', chapter: 'இலக்கணம்' })).toEqual(['g4-ta-grammar']);
    expect(unitsOf({ subject: 'General Tamil', chapter: 'சொல்லகராதி' })).toEqual(['g4-ta-vocabulary']);
  });

  it('accepts a printed sub-topic as naming its unit, with or without the English gloss', () => {
    expect(unitsOf({ subject: 'General Tamil', chapter: 'பிரித்து எழுதுதல் (Splitting words)' })).toEqual(['g4-ta-grammar']);
    expect(unitsOf({ subject: 'General Tamil', chapter: 'பிரித்து எழுதுதல்' })).toEqual(['g4-ta-grammar']);
  });

  it('does not confuse Tamil Grammar with English Grammar — the subject decides the language', () => {
    expect(unitsOf({ subject: 'General English', chapter: 'Grammar' })).toEqual(['g4-en-grammar']);
    expect(unitsOf({ subject: 'General Tamil', chapter: 'Grammar' })).not.toContain('g4-en-grammar');
  });

  it('separates Aptitude from Reasoning by Topic', () => {
    expect(unitsOf({ subject: 'Aptitude and Mental Ability', chapter: 'Aptitude' })).toEqual(['g4-apt-aptitude']);
    expect(unitsOf({ subject: 'Aptitude and Mental Ability', chapter: 'Reasoning' })).toEqual(['g4-apt-reasoning']);
  });

  it('leaves a shared-subject question with an unknown Topic in no unit, rather than guessing', () => {
    expect(unitsOf({ subject: 'General Tamil', chapter: 'a topic nobody printed' })).toEqual([]);
    expect(unitsOf({ subject: 'General Tamil' })).toEqual([]);
  });

  it('trusts the question’s own unit_id over anything inferred', () => {
    const q = { subject: 'Indian Polity', unit_id: 'g4-gs-geography' };
    expect(questionInUnit(stage, q, unit('g4-gs-geography'))).toBe(true);
    expect(questionInUnit(stage, q, unit('g4-gs-indian-polity'))).toBe(false);
  });
});

describe('inSelectedUnits', () => {
  it('is unrestricted when nothing is selected, as the subject picker is', () => {
    expect(inSelectedUnits(stage, { subject: 'Geography of India' }, [])).toBe(true);
  });

  it('matches any of the chosen units', () => {
    const chosen = [unit('g4-gs-geography'), unit('g4-gs-indian-polity')];
    expect(inSelectedUnits(stage, { subject: 'Indian Polity' }, chosen)).toBe(true);
    expect(inSelectedUnits(stage, { subject: 'General Science' }, chosen)).toBe(false);
  });
});

describe('unitBankCounts', () => {
  it('counts per unit and reports what no unit claims', () => {
    const bank = [
      { subject: 'Indian Polity' },
      { subject: 'Indian Polity' },
      { subject: 'General Tamil', chapter: 'இலக்கணம்' },
      { subject: 'General Tamil', chapter: 'a topic nobody printed' },
      { subject: 'Current Events' },
      { subject: 'Not an exam subject at all' },
    ];
    const { byUnit, unmapped } = unitBankCounts(stage, bank);
    expect(byUnit['g4-gs-indian-polity']).toBe(2);
    expect(byUnit['g4-ta-grammar']).toBe(1);
    expect(byUnit['g4-gs-geography']).toBe(0);
    // Current Events now belongs to the Current Affairs unit; only the unprinted Tamil topic is in no unit;
    // the last row is not the exam's subject at all, so it is not counted against it.
    expect(unmapped).toBe(1);
    expect(byUnit['g4-gs-current-affairs']).toBe(1);
  });
});

describe('unitWeightsFromSyllabus', () => {
  it('follows the printed split, not an even one', () => {
    const w = unitWeightsFromSyllabus([unit('g4-gs-indian-polity'), unit('g4-gs-economy-and-dev-admin')]);
    // 15 : 20 questions.
    expect(w['g4-gs-indian-polity']).toBeCloseTo(42.86, 1);
    expect(w['g4-gs-economy-and-dev-admin']).toBeCloseTo(57.14, 1);
  });

  it('always totals exactly 100, which is what the editor accepts', () => {
    const all = stageUnits(stage).map(x => x.unit);
    for (const set of [all, all.slice(0, 3), all.slice(2, 9), all.slice(5, 6)]) {
      const w = unitWeightsFromSyllabus(set);
      const total = Math.round(Object.values(w).reduce((s, v) => s + v, 0) * 100) / 100;
      expect(total).toBe(100);
      expect(Object.values(w).every(v => v >= 1)).toBe(true);
    }
  });

  it('gives one unit the whole 100', () => {
    expect(unitWeightsFromSyllabus([unit('g4-gs-geography')])).toEqual({ 'g4-gs-geography': 100 });
  });
});

describe('subjectWeightsFromUnits', () => {
  it('spreads a unit across the subject names its pool carries, and merges units that share one', () => {
    const w = subjectWeightsFromUnits(
      { u1: 60, u2: 40 },
      {
        u1: [{ subject: 'General Tamil' }, { subject: 'General Tamil' }],
        u2: [{ subject: 'General Tamil' }, { subject: 'Geography' }],
      },
    );
    // u1 -> 60 to Tamil; u2 -> 20 Tamil + 20 Geography.
    expect(w['General Tamil']).toBeCloseTo(80, 5);
    expect(w['Geography']).toBeCloseTo(20, 5);
    expect(Math.round(Object.values(w).reduce((s, v) => s + v, 0) * 100) / 100).toBe(100);
  });
});

describe('subjectSpread', () => {
  it('lists the names the bank holds, commonest first, with blanks called out', () => {
    const spread = subjectSpread([
      { subject: 'Tamil' }, { subject: 'Tamil' }, { subject: 'Tamil' }, { subject: 'Tamil' },
      { subject: 'Polity' }, { subject: ' ' }, { subject: null }, {},
    ]);
    expect(spread[0]).toEqual(['Tamil', 4]);
    expect(spread).toContainEqual(['(no subject)', 3]);
    expect(spread).toContainEqual(['Polity', 1]);
  });

  it('stops at the limit', () => {
    const qs = Array.from({ length: 20 }, (_, i) => ({ subject: `S${i}` }));
    expect(subjectSpread(qs, 5)).toHaveLength(5);
  });
});

/**
 * The bank is tens of thousands of questions and the matcher runs over all of it on
 * the wizard's own render. The first version took over a minute on 20,000 and froze
 * the page; this fails loudly if per-question work creeps back in.
 */
describe('matching a large bank', () => {
  const subjects = [
    'Indian Polity', 'General Science', 'Geography of India', 'General Tamil', 'General English',
    'Aptitude and Mental Ability', 'Current Events', 'Indian Economy and Development Administration in Tamil Nadu',
  ];
  const topics = ['இலக்கணம்', 'சொல்லகராதி', 'Grammar', 'Aptitude', 'Reasoning', 'Fundamental Rights'];
  const bank = Array.from({ length: 20000 }, (_, i) => ({
    id: String(i),
    subject: subjects[i % subjects.length],
    chapter: topics[i % topics.length],
  }));

  it('counts 20,000 questions per unit in well under a second', () => {
    const t = performance.now();
    const { byUnit } = unitBankCounts(stage, bank);
    expect(performance.now() - t).toBeLessThan(1500);
    expect(byUnit['g4-gs-indian-polity']).toBe(2500);
  });

  it('filters 20,000 questions through every unit in well under a second', () => {
    const all = stageUnits(stage).map(x => x.unit);
    const t = performance.now();
    const kept = bank.filter(q => inSelectedUnits(stage, q, all));
    expect(performance.now() - t).toBeLessThan(1500);
    expect(kept.length).toBeGreaterThan(0);
  });
});

/**
 * Spellings taken from the question sheets actually in the bank, 12 Oct 2026. On the
 * printed names alone 32% of 4,209 questions matched a unit; these are the shapes that
 * made up most of the rest.
 */
describe('how the bank is really tagged', () => {
  it('reads an old three-part Tamil subject: the part names the unit', () => {
    expect(unitsOf({ subject: 'பொதுத்தமிழ் - பகுதி அ - இலக்கணம்' })).toEqual(['g4-ta-grammar']);
    expect(unitsOf({ subject: 'பொதுத்தமிழ் - பகுதி ஆ - இலக்கியம்' })).toEqual(['g4-ta-literature']);
    expect(unitsOf({ subject: 'பொதுத்தமிழ் - பகுதி இ - தமிழ் அறிஞர்களும் தமிழ்த் தொண்டும்' })).toEqual(['g4-ta-literature']);
  });

  it('reads "Tamil – Vocabulary", and lets the unit the author wrote beat a topic filed elsewhere', () => {
    expect(unitsOf({ subject: 'தமிழ் – சொல்லகராதி' })).toEqual(['g4-ta-vocabulary']);
    // எதிர்ச்சொல் (antonym) is listed under Grammar in the catalog, but the sheet said Vocabulary.
    expect(unitsOf({ subject: 'தமிழ் – சொல்லகராதி', chapter: 'எதிர்ச்சொல்' })).toEqual(['g4-ta-vocabulary']);
  });

  it('matches a unit name written without its space', () => {
    expect(unitsOf({ subject: 'கலைச்சொற்கள்' })).toEqual(['g4-ta-technical-terms']);
  });

  it('matches Unit V in the Tamil wording sheets use, which differs from the catalog’s', () => {
    expect(unitsOf({ subject: 'இந்திய பொருளாதாரம் மற்றும் தமிழ்நாட்டில் வளர்ச்சி நிர்வாகம்' })).toEqual([
      'g4-gs-economy-and-dev-admin',
    ]);
  });

  it('strips a "Unit III:" or "Part A – Unit V:" prefix', () => {
    expect(unitsOf({ subject: 'English', chapter: 'Unit III: Writing Skills' })).toEqual(['g4-en-writing']);
    expect(unitsOf({ subject: 'Part A – Unit V: Indian Economy and Development Administration in Tamil Nadu' })).toEqual([
      'g4-gs-economy-and-dev-admin',
    ]);
  });

  it('takes a bare language as the subject, and a language word leading a label as both', () => {
    expect(unitsOf({ subject: 'English', chapter: 'Parts of Speech / Verbs' })).toEqual(['g4-en-grammar']);
    expect(unitsOf({ subject: 'English Grammar' })).toEqual(['g4-en-grammar']);
  });

  it('files Reasoning and Aptitude topics, English and Tamil, by what they are', () => {
    const apt = 'Aptitude and Mental Ability';
    expect(unitsOf({ subject: apt, chapter: 'Dice — Opposite Faces' })).toEqual(['g4-apt-reasoning']);
    expect(unitsOf({ subject: apt, chapter: 'Syllogism' })).toEqual(['g4-apt-reasoning']);
    expect(unitsOf({ subject: apt, chapter: 'சதவீதம்' })).toEqual(['g4-apt-aptitude']);
    expect(unitsOf({ subject: apt, chapter: 'மீச்சிறு பொது மடங்கு' })).toEqual(['g4-apt-aptitude']);
  });

  /**
   * The point of not guessing. These say nothing about which unit — or which language —
   * they mean, so they stay out of every unit and are counted as unplaced instead.
   */
  it('does not guess when a tag does not say', () => {
    expect(unitsOf({ subject: 'தமிழ்' })).toEqual([]); // 600 rows: Tamil, but which unit?
    expect(unitsOf({ subject: 'Vocabulary' })).toEqual([]); // Tamil's or English's?
    expect(unitsOf({ subject: 'Technical Terms' })).toEqual([]);
    expect(unitsOf({ subject: 'Writing Skills' })).toEqual([]);
    expect(unitsOf({ subject: 'Current Affairs' })).toEqual(['g4-gs-current-affairs']);
  });

  it('keeps Tamil Grammar and English Grammar apart whichever way the word is spelt', () => {
    expect(unitsOf({ subject: 'தமிழ்', chapter: 'இலக்கணம்' })).toEqual(['g4-ta-grammar']);
    expect(unitsOf({ subject: 'English', chapter: 'Grammar' })).toEqual(['g4-en-grammar']);
  });
});

/**
 * English unit IV was missing its Medium and Complex sheets: the Simple one said
 * `General English` / `Unit IV: Technical Terms`, the other two just `Technical Terms` — which
 * is the name of both the Tamil unit IV and the English one. 100 questions fell out of the unit
 * they were written for. The language the question is written in settles it.
 */
describe('a name both papers share is settled by the question’s language', () => {
  const english = 'In an official order, which term most precisely conveys “Notification” to the public?';
  const tamil = 'அரசு அலுவலகத்தில் “Notification” என்பதற்கு நிகரான தமிழ்ச் சொல் எது?';

  it('puts an English question under the English unit', () => {
    expect(unitsOf({ subject: 'Technical Terms', chapter: 'Administrative Terms', text: english })).toEqual(['g4-en-technical-terms']);
    expect(unitsOf({ subject: 'Vocabulary', text: english })).toEqual(['g4-en-vocabulary']);
  });

  it('puts a Tamil question under the Tamil unit', () => {
    expect(unitsOf({ subject: 'Technical Terms', text: tamil })).toEqual(['g4-ta-technical-terms']);
    expect(unitsOf({ subject: 'Vocabulary', text: tamil })).toEqual(['g4-ta-vocabulary']);
  });

  it('does not guess without text, or from text that is too short or too mixed', () => {
    expect(unitsOf({ subject: 'Technical Terms' })).toEqual([]);
    expect(unitsOf({ subject: 'Technical Terms', text: 'Which?' })).toEqual([]);
    expect(unitsOf({ subject: 'Technical Terms', text: 'அரசு Notification Circular அலுவலகம் order' })).toEqual([]);
  });

  it('does not guess when the tags name two different pairs', () => {
    expect(unitsOf({ subject: 'Technical Terms', chapter: 'Grammar', text: english })).toEqual([]);
  });

  it('does not touch a name that only one paper carries', () => {
    expect(unitsOf({ subject: 'Literary Works', text: english })).toEqual([]);
  });
});

describe('the rest of the English unit II, aptitude and Part A sheets', () => {
  it('reads the word-level topics of the vocabulary sheets', () => {
    for (const chapter of ['Homophones / Commonly confused words', 'Homonyms and commonly confused words', 'Synonyms and word distinctions', 'Spelling and correct usage', 'Idioms & Phrases', 'Word creation and derivatives']) {
      expect(unitsOf({ subject: 'General English', chapter }), chapter).toEqual(['g4-en-vocabulary']);
    }
  });

  it('still reads Parts of Speech as grammar, even on a vocabulary sheet', () => {
    expect(unitsOf({ subject: 'English', chapter: 'Parts of speech and word usage' })).toEqual(['g4-en-grammar']);
  });

  it('reads the class maths sheets, by their topic', () => {
    expect(unitsOf({ subject: 'Mathematics – Aptitude & Reasoning', chapter: 'HCF' })).toEqual(['g4-apt-aptitude']);
    expect(unitsOf({ subject: 'Mathematics - Aptitude & Reasoning', chapter: 'Compound Interest' })).toEqual(['g4-apt-aptitude']);
    expect(unitsOf({ subject: 'திறனறிவு மற்றும் மனக்கணக்கு நுண்ணறிவு', chapter: 'மீப்பெரு பொதுக் காரணி' })).toEqual(['g4-apt-aptitude']);
    expect(unitsOf({ subject: 'திறனறிவு மற்றும் மனக்கணக்கு நுண்ணறிவு', chapter: 'தர்க்கப் பகுத்தறிதல்' })).toEqual(['g4-apt-reasoning']);
    expect(unitsOf({ subject: 'திறனறிவு மற்றும் மனக்கணக்கு நுண்ணறிவு', chapter: 'புதிர்கள்' })).toEqual(['g4-apt-reasoning']);
  });

  it('reads "Part A – Unit VI" as the unit it names, and not Part C, which has two', () => {
    expect(unitsOf({ subject: 'Part A – Unit VI', chapter: 'Archaeology' })).toEqual(['g4-gs-tamil-nadu-history']);
    expect(unitsOf({ subject: 'பகுதி A – அலகு VI' })).toEqual(['g4-gs-tamil-nadu-history']);
    expect(unitsOf({ subject: 'Part B – Unit II' })).toEqual(['g4-apt-reasoning']);
    expect(unitsOf({ subject: 'Part C – Unit VI' })).toEqual([]);
  });
});

describe('Group 2 shares the Group 4 question bank', () => {
  const g2 = findStage('group-2', 'group-2-prelims')!.stage;
  const g2unitsOf = (q: any) => stageUnits(g2).filter(x => questionInUnit(g2, q, x.unit)).map(x => x.unit.id);

  it('finds the Group 2 unit by subject, as it does for Group 4', () => {
    expect(g2unitsOf({ subject: 'Indian Polity', chapter: 'Fundamental Rights' })).toEqual(['g2-gs-indian-polity']);
  });

  it('counts a bank question filed under Group 4’s copy of a shared unit toward Group 2’s unit of the same family', () => {
    expect(g2unitsOf({ unit_id: 'g4-gs-indian-polity' })).toEqual(['g2-gs-indian-polity']);
    expect(g2unitsOf({ unit_id: 'g4-apt-reasoning' })).toEqual(['g2-apt-reasoning']);
  });

  it('carries the language papers too, finding the Tamil unit by its topic and by Group 4’s unit id', () => {
    expect(g2unitsOf({ subject: 'General Tamil', chapter: 'இலக்கணம்' })).toEqual(['g2-ta-grammar']);
    expect(g2unitsOf({ unit_id: 'g4-ta-grammar' })).toEqual(['g2-ta-grammar']);
    expect(g2unitsOf({ unit_id: 'g4-en-vocabulary' })).toEqual(['g2-en-vocabulary']);
  });

  it('shows Group 4-tagged bank questions against Group 2’s own unit ids', () => {
    const counts = unitBankCounts(g2, [{ unit_id: 'g4-gs-indian-polity' }, { unit_id: 'g4-gs-indian-polity' }, { subject: 'Geography of India' }]);
    expect(counts.byUnit['g2-gs-indian-polity']).toBe(2);
    expect(counts.byUnit['g2-gs-geography']).toBe(1);
  });

  it('does not change Group 4: its own ids still resolve as before', () => {
    expect(unitsOf({ unit_id: 'g4-gs-indian-polity' })).toEqual(['g4-gs-indian-polity']);
  });
});
