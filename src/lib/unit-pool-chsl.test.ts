import { describe, expect, it } from 'vitest';
import { SSC_CHSL_GROUPS } from '@/config/ssc-chsl';
import { BRIDGE_UNIT_KEYS } from '@/config/chsl-bank-bridge';
import { stageUnits } from '@/config/tnpsc';
import { inLanguageSubjectUnit, inSelectedUnits, subjectIdForQuestion, unitBankCounts, unitIdsOf, unitWeightsFromSyllabus } from './unit-pool';

const tier1 = SSC_CHSL_GROUPS[0].stages[0];
const tier2 = SSC_CHSL_GROUPS[1].stages[0];
const ids = (stage: typeof tier1, q: any) => unitIdsOf(stage, q).map(id => id.replace(/^c[12]-/, ''));

/**
 * CHSL is new, so the bank holds no question tagged with a CHSL unit. What it holds is RRB NTPC's and TNPSC's, and these pin
 * which CHSL units those are offered to (SSC_CHSL_Question_Match_NTPC_TNPSC.xlsx).
 */
describe('CHSL units over the existing NTPC and TNPSC bank', () => {
  it('every unit the bridge names exists in the catalog', () => {
    const all = new Set([...stageUnits(tier1), ...stageUnits(tier2)].map(x => x.unit.id.replace(/^c[12]-/, '')));
    for (const k of BRIDGE_UNIT_KEYS) expect(all.has(k), k).toBe(true);
  });

  it('puts NTPC maths questions in the matching quantitative units', () => {
    expect(ids(tier1, { subject: 'Mathematics', chapter: 'Number System' })).toEqual(['quantitative-aptitude-number-systems']);
    expect(ids(tier1, { subject: 'Mathematics', chapter: 'Percentage' })).toEqual(['quantitative-aptitude-fundamental-arithmetic']);
    expect(ids(tier1, { subject: 'Mathematics', chapter: 'Time, Speed, and Distance' })).toEqual(['quantitative-aptitude-fundamental-arithmetic']);
    expect(ids(tier1, { subject: 'Mathematics', chapter: 'Mensuration' })).toEqual(['quantitative-aptitude-mensuration']);
    expect(ids(tier1, { subject: 'Mathematics', chapter: 'Elementary Algebra' })).toEqual(['quantitative-aptitude-algebra']);
  });

  it('puts statistics in Data Interpretation for Tier I and Statistics and Probability for Tier II', () => {
    const q = { subject: 'Mathematics', chapter: 'Elementary Statistics' };
    expect(ids(tier1, q)).toEqual(['quantitative-aptitude-data-interpretation']);
    expect(ids(tier2, q)).toEqual(['quantitative-aptitude-statistics-and-probability']);
  });

  it('puts NTPC reasoning topics in the reasoning units', () => {
    expect(ids(tier1, { subject: 'General Intelligence & Reasoning', chapter: 'Analogies' })).toEqual(['general-intelligence-and-reasoning-analogy']);
    expect(ids(tier1, { subject: 'General Intelligence & Reasoning', chapter: 'Number Series' })).toEqual(['general-intelligence-and-reasoning-series-and-patterns']);
    expect(ids(tier1, { subject: 'General Intelligence & Reasoning', chapter: 'Syllogism' })).toEqual(['general-intelligence-and-reasoning-logical-and-analytical-reasoning']);
    expect(ids(tier1, { subject: 'General Intelligence & Reasoning', chapter: 'Venn Diagrams' })).toEqual(['general-intelligence-and-reasoning-spatial-and-non-verbal-reasoning']);
  });

  it('puts NTPC general awareness topics in the awareness units', () => {
    const ga = (chapter: string) => ids(tier1, { subject: 'General Awareness', chapter });
    expect(ga('History of India')).toEqual(['general-awareness-history']);
    expect(ga('Indian Polity and Governance')).toEqual(['general-awareness-indian-polity-and-general-policy']);
    expect(ga('Indian Economy')).toEqual(['general-awareness-economy']);
    expect(ga('Games and Sports')).toEqual(['general-awareness-current-affairs']);
    expect(ga('Life Science')).toEqual(['general-awareness-general-science']);
    expect(ga('Art and Culture of India')).toEqual(['general-awareness-culture-and-miscellaneous-general-knowledge']);
  });

  it('puts TNPSC English and Aptitude questions in the matching units', () => {
    expect(ids(tier1, { subject: 'English', chapter: 'Vocabulary', subtopic: 'Synonyms' })).toEqual(['english-language-vocabulary']);
    expect(ids(tier1, { subject: 'General English', chapter: 'Reading Comprehension' })).toEqual(['english-language-comprehension']);
    expect(ids(tier1, { subject: 'Aptitude', chapter: 'Percentage' })).toEqual(['quantitative-aptitude-fundamental-arithmetic']);
    expect(ids(tier1, { subject: 'Aptitude and Mental Ability', chapter: 'Reasoning' })).toContain('general-intelligence-and-reasoning-logical-and-analytical-reasoning');
  });

  it('puts computer basics in the Tier II computer units, and nowhere in Tier I', () => {
    const q = { subject: 'General Awareness', chapter: 'Basics of Computers and Computer Applications' };
    expect(ids(tier2, q)).toContain('computer-knowledge-computer-fundamentals');
    expect(ids(tier1, q)).toEqual([]);
  });

  it('leaves Tamil Nadu content, the Tamil paper and narrow NTPC topics out', () => {
    expect(ids(tier1, { subject: 'General Studies', chapter: 'Tamil Nadu Geography' })).toEqual([]);
    expect(ids(tier1, { subject: 'தமிழ்', chapter: 'இலக்கணம்' })).toEqual([]);
    expect(ids(tier1, { subject: 'General Awareness', chapter: 'List of Phobias' })).toEqual([]);
  });

  it('reads another exam\'s unit id when the tags say nothing, and the other tier\'s id as the same unit', () => {
    expect(ids(tier1, { subject: 'Mathematics', unit_id: 'n1-ma-algebra' })).toEqual(['quantitative-aptitude-algebra']);
    expect(ids(tier1, { unit_id: 'ng-ga-history' })).toEqual(['general-awareness-history']);
    expect(ids(tier1, { unit_id: 'c2-english-language-grammar' })).toEqual(['english-language-grammar']);
    expect(unitIdsOf(tier2, { unit_id: 'c1-english-language-grammar' })).toEqual(['c2-english-language-grammar']);
  });

  it("keeps a Tamil or Hindi NTPC question in its unit: the paper's language decides which are drawn", () => {
    expect(ids(tier1, { subject: 'Mathematics', chapter: 'Percentage', text: 'ஒரு எண்ணின் 20 சதவீதம் 40 எனில் அந்த எண் என்ன?' })).toEqual([
      'quantitative-aptitude-fundamental-arithmetic',
    ]);
  });

  it('marks English Language questions as English whatever the paper language, and nothing else', () => {
    expect(inLanguageSubjectUnit(tier1, { subject: 'English', chapter: 'Vocabulary' })).toBe(true);
    expect(inLanguageSubjectUnit(tier2, { unit_id: 'c2-english-language-grammar' })).toBe(true);
    expect(inLanguageSubjectUnit(tier1, { subject: 'Mathematics', chapter: 'Percentage' })).toBe(false);
    expect(inLanguageSubjectUnit(undefined, { subject: 'English', chapter: 'Vocabulary' })).toBe(false);
  });

  it('a question that names a CHSL unit itself is not moved', () => {
    expect(unitIdsOf(tier1, { unit_id: 'c1-english-language-grammar', subject: 'Mathematics' })).toEqual(['c1-english-language-grammar']);
  });

  it('counts the reachable bank per unit and selects by unit', () => {
    const bank = [
      { subject: 'English', chapter: 'Vocabulary' },
      { subject: 'English', chapter: 'Vocabulary' },
      { subject: 'Mathematics', chapter: 'Number System' },
      { subject: 'தமிழ்', chapter: 'இலக்கணம்' },
    ];
    const counts = unitBankCounts(tier1, bank);
    expect(counts.byUnit['c1-english-language-vocabulary']).toBe(2);
    expect(counts.byUnit['c1-quantitative-aptitude-number-systems']).toBe(1);
    const vocab = stageUnits(tier1).find(x => x.unit.id === 'c1-english-language-vocabulary')!.unit;
    expect(bank.filter(q => inSelectedUnits(tier1, q, [vocab]))).toHaveLength(2);
  });

  it("weights follow Tier I's unit split, and Tier II's section sizes 30/30/40/20/15 of 135", () => {
    const w1 = unitWeightsFromSyllabus(stageUnits(tier1).map(x => x.unit), tier1);
    expect(Object.values(w1).reduce((a, b) => a + b, 0)).toBeCloseTo(100, 5);
    expect(w1['c1-english-language-vocabulary']).toBe(6);
    expect(w1['c1-quantitative-aptitude-fundamental-arithmetic']).toBe(13);
    expect(w1['c1-quantitative-aptitude-algebra']).toBe(1);
    const sectionSum = (w: Record<string, number>, prefix: string) =>
      Object.entries(w).filter(([k]) => k.startsWith(prefix)).reduce((a, [, v]) => a + v, 0);
    expect(sectionSum(w1, 'c1-general-awareness-')).toBeCloseTo(25, 1);
    const w2 = unitWeightsFromSyllabus(stageUnits(tier2).map(x => x.unit), tier2);
    expect(sectionSum(w2, 'c2-english-language-')).toBeCloseTo((40 / 135) * 100, 1);
    expect(sectionSum(w2, 'c2-computer-knowledge-')).toBeCloseTo((15 / 135) * 100, 1);
  });

  it('gives every borrowed question its CHSL section on the test screen', () => {
    const sec = (q: any) => subjectIdForQuestion(tier1, q);
    // A topic in three English units is still English.
    expect(sec({ subject: 'English', chapter: 'Writing Skills' })).toBe('chsl-english');
    expect(sec({ subject: 'English', chapter: 'Vocabulary' })).toBe('chsl-english');
    expect(sec({ subject: 'Mathematics', chapter: 'Number System' })).toBe('chsl-quant');
    expect(sec({ subject: 'Aptitude', chapter: 'Percentage' })).toBe('chsl-quant');
    expect(sec({ subject: 'General Studies', chapter: 'Indian Polity' })).toBe('chsl-general-awareness');
    // Drawn for Data Interpretation, so sat in Quantitative Aptitude whatever its Subject says.
    expect(sec({ subject: 'General Intelligence & Reasoning', chapter: 'Maps and Graph Interpretation' })).toBe('chsl-quant');
    expect(sec({ subject: 'General Intelligence & Reasoning', chapter: 'Syllogism' })).toBe('chsl-reasoning');
    // The CHSL unit id the backend now stores wins.
    expect(sec({ subject: 'Mathematics', chapter: 'Percentage', unit_id: 'c1-english-language-grammar' })).toBe('chsl-english');
  });

  it('reads the most specific tag first, and the longest phrase in it', () => {
    expect(ids(tier1, { subject: 'General English', chapter: 'Writing Skills', subtopic: 'Jumbled sentences' })).toEqual(['english-language-sentence-transformation']);
    expect(ids(tier1, { subject: 'General English', chapter: 'Writing Skills', subtopic: 'Blanks' })).toEqual(['english-language-grammar']);
    expect(ids(tier1, { subject: 'General English', chapter: 'Vocabulary', subtopic: 'Phrasal verbs' })).toEqual(['english-language-vocabulary']);
    expect(ids(tier1, { subject: 'General English', chapter: 'Vocabulary', subtopic: 'Spelling of words' })).toEqual(['english-language-spelling']);
    expect(ids(tier1, { subject: 'Aptitude and Mental Ability', chapter: 'Reasoning', subtopic: 'Number series' })).toEqual(['general-intelligence-and-reasoning-series-and-patterns']);
    expect(ids(tier1, { subject: 'General Intelligence & Reasoning', chapter: 'Similarities and Differences' })).toEqual(['general-intelligence-and-reasoning-classification']);
  });

  it("keeps TNPSC's national economy topics and leaves the Tamil Nadu ones out, on every route", () => {
    const eco = (chapter: string) => ids(tier1, { subject: 'Indian Economy and Development Administration in Tamil Nadu', chapter });
    expect(eco('Reserve Bank of India')).toEqual(['general-awareness-economy']);
    expect(eco('Goods and Services Tax')).toEqual(['general-awareness-economy']);
    expect(eco('Land reforms and agriculture')).toEqual(['general-awareness-economy']);
    expect(eco('Education and health systems in Tamil Nadu')).toEqual([]);
    expect(ids(tier1, { subject: 'Current Affairs', chapter: 'Tamil Nadu Affairs' })).toEqual([]);
    expect(ids(tier1, { subject: 'General English', chapter: 'Translation', subtopic: 'Tense related translation tasks' })).toEqual([]);
  });

  it("uses the server's chsl_unit_ids when it sends them", () => {
    const both = ['c1-general-awareness-history', 'c2-general-awareness-history'];
    // The server's answer wins over the tags.
    expect(unitIdsOf(tier1, { subject: 'Mathematics', chapter: 'Percentage', unit_id: 'n1-ma-arithmetic', chsl_unit_ids: both })).toEqual(['c1-general-awareness-history']);
    expect(unitIdsOf(tier2, { subject: 'Mathematics', chapter: 'Percentage', chsl_unit_ids: both })).toEqual(['c2-general-awareness-history']);
    // Null: the mapping gave it no CHSL unit, and the portal does not guess.
    expect(unitIdsOf(tier1, { subject: 'Mathematics', chapter: 'Percentage', chsl_unit_ids: null })).toEqual([]);
    // A unit this tier does not print is ignored.
    expect(unitIdsOf(tier1, { subject: 'Mathematics', chsl_unit_ids: ['c2-quantitative-aptitude-statistics-and-probability'] })).toEqual([]);
    // CHSL's own questions carry null and keep their own id, either tier's.
    expect(unitIdsOf(tier1, { unit_id: 'c1-english-language-grammar', chsl_unit_ids: null })).toEqual(['c1-english-language-grammar']);
    expect(unitIdsOf(tier1, { unit_id: 'c2-english-language-grammar', chsl_unit_ids: null })).toEqual(['c1-english-language-grammar']);
    // The test screen's section follows it too.
    expect(subjectIdForQuestion(tier1, { subject: 'Mathematics', chapter: 'Percentage', chsl_unit_ids: both })).toBe('chsl-general-awareness');
    // Without the field, the portal's own rules still decide.
    expect(unitIdsOf(tier1, { subject: 'Mathematics', chapter: 'Percentage' })).toEqual(['c1-quantitative-aptitude-fundamental-arithmetic']);
  });
});
