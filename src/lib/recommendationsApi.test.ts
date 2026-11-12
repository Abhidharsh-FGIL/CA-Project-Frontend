import { describe, expect, it } from 'vitest';
import { findStage } from '@/config/tnpsc';
import type { TnpscTest } from '@/lib/tnpscApi';
import {
  KIND_LABEL,
  basisLine,
  displayUnitName,
  masteryBand,
  practisedLanguage,
  recommendationKind,
  recommendationLanguage,
  recommendationsForLanguage,
  unitLanguage,
  recommendationHref,
  recommendationPlace,
  recommendationTitle,
  recommendedTestIds,
  recommendationsQuery,
  pickName,
  starterPicks,
  type Recommendation,
  type Recommendations,
} from '@/lib/recommendationsApi';

const rec = (over: Partial<Recommendation> = {}): Recommendation => ({
  rec_id: 'r1',
  type: 'fix_weak',
  priority: 0.9,
  unit: { id: 'g4-apt-aptitude', name: 'Aptitude', label: 'I' },
  category: { id: 'c1', name: 'HCF' },
  subcategory: null,
  mastery: { score: 38, accuracy: 40, attempted: 10, correct: 4, trend: -5, last_practised_at: null, level: 'simple' },
  target: { kind: 'key_topic_test', test_id: 't1', level: 'medium', question_count: 20, est_minutes: 15, is_locked: false, lock_reason: null },
  reason: 'You got 4 of 10 on HCF.',
  tip: null,
  reason_source: 'ai',
  ...over,
});

describe('an RRB NTPC pick', () => {
  it('is named in English alone for an aspirant sitting it in English, with no Tamil beside it', () => {
    const r = rec({ unit: { id: 'n1-current-events', name: 'Current Events', label: 'I' }, category: null });
    expect(recommendationTitle(r)).toBe('Current Events');
    expect(pickName(r, 'Current Events')).toBe('Current Events');
  });

  it('leaves a TNPSC pick in both languages', () => {
    expect(pickName(rec({ unit: { id: 'g4-gs-polity', name: 'Indian Polity' } }), 'Indian Polity')).toBe('Indian Polity / இந்திய அரசியலமைப்பு');
  });
});

describe('recommendationsQuery', () => {
  it('names an RRB NTPC exam and stage in the backend codes', () => {
    expect(recommendationsQuery('rrb-ntpc-cbt-1', 'rrb-ntpc-cbt-1-exam')).toBe('exam=rrb-ntpc&stage=rrb-ntpc-cbt-1');
    expect(recommendationsQuery('rrb-ntpc-cbt-2', 'rrb-ntpc-cbt-2-exam')).toBe('exam=rrb-ntpc&stage=rrb-ntpc-cbt-2');
  });

  it('leaves the other exams as they are', () => {
    expect(recommendationsQuery('group-2', 'group-2-prelims')).toBe('exam=group-2&stage=group-2-prelims');
    expect(recommendationsQuery('gat-b', 'gat-b-exam')).toBe('exam=gat-b&stage=gat-b-exam');
  });
});

describe('recommendationHref', () => {
  it('opens the assessment, the legacy test flow, or the plans page when locked', () => {
    expect(recommendationHref(rec())).toBe('/user/assessment/t1');
    expect(recommendationHref(rec({ target: { ...rec().target, source: 'test' } }))).toBe('/user/test/t1/start');
    expect(recommendationHref(rec({ target: { ...rec().target, is_locked: true } }))).toBe('/user/subscription');
  });
});

describe('naming a pick', () => {
  it('titles it by the category its test covers (the sub-category is its focus) and places it in its unit', () => {
    expect(recommendationTitle(rec())).toBe('HCF / மீப்பெரு பொது வகுத்தி (மீ.பொ.வ)');
    expect(recommendationTitle(rec({ subcategory: { id: 's', name: 'Word problems', mastery: 8 } }))).toBe('HCF / மீப்பெரு பொது வகுத்தி (மீ.பொ.வ)');
    expect(recommendationTitle(rec({ type: 'full_mock', category: null }))).toBe('Full mock test');
    expect(recommendationPlace(rec())).toBe('Unit I · Aptitude / திறனறிவு');
  });

  it("places a full mock by its test's title", () => {
    const mock = rec({ type: 'full_mock', unit: null, category: null, target: { ...rec().target, kind: 'mock_test', title: 'Full Mock (English)' } });
    expect(recommendationPlace(mock)).toBe('Full Mock (English)');
  });
});

describe('what a pick covers', () => {
  const unitPick = rec({
    category: null,
    subcategory: null,
    target: { ...rec().target, kind: 'unit_practice' },
  });

  it('says Key topic, Whole unit or Full mock', () => {
    expect(recommendationKind(rec())).toBe('topic');
    expect(recommendationKind(unitPick)).toBe('unit');
    expect(recommendationKind(rec({ type: 'full_mock', unit: null, category: null, target: { ...rec().target, kind: 'mock_test' } }))).toBe('mock');
    expect(KIND_LABEL.topic).toBe('Key topic');
    expect(KIND_LABEL.unit).toBe('Whole unit');
  });

  it('names a whole unit once: the heading is the unit, and the line under it only gives its number', () => {
    expect(recommendationTitle(unitPick)).toBe('Aptitude / திறனறிவு');
    expect(recommendationPlace(unitPick)).toBe('Unit I');
    // a Key topic still names its unit under the heading
    expect(recommendationPlace(rec())).toBe('Unit I · Aptitude / திறனறிவு');
  });
});

describe('unit names follow the rest of the app', () => {
  it('shows every unit in both languages, English first', () => {
    // General Tamil in Tamil only, General English in English only, the other papers in both.
    expect(displayUnitName('g4-ta-grammar', 'Grammar')).toBe('இலக்கணம்');
    expect(displayUnitName('g4-en-grammar', 'Grammar')).toBe('Grammar');
    expect(displayUnitName('g4-apt-aptitude', 'Aptitude')).toBe('Aptitude / திறனறிவு');
  });

  it('falls back to the backend name for a unit the app does not know', () => {
    expect(displayUnitName('g9-unknown', 'Something')).toBe('Something');
    expect(displayUnitName(null, 'Something')).toBe('Something');
  });

  it('puts the Tamil unit name on a Tamil pick, under its Tamil topic', () => {
    const tamil = rec({
      unit: { id: 'g4-ta-grammar', name: 'Grammar', label: 'I' },
      category: { id: 'c', name: 'சொல்லிலக்கணம்' },
    });
    expect(recommendationTitle(tamil)).toBe('சொல்லிலக்கணம்');
    expect(recommendationPlace(tamil)).toBe('Unit I · இலக்கணம்');
    // a whole-unit pick is headed by the unit's name, in Tamil too
    const unitPick = rec({ unit: { id: 'g4-ta-vocabulary', name: 'Vocabulary', label: 'II' }, category: null, subcategory: null, target: { ...rec().target, kind: 'unit_practice' } });
    expect(recommendationTitle(unitPick)).not.toBe('Vocabulary');
  });
});

describe('basisLine', () => {
  const base = { status: 'ready' as const, window_days: 15, attempts_used: 3, based_on_attempts: 3 };

  it('says which tests the picks came from, for each basis', () => {
    expect(basisLine({ ...base, basis: 'last_15_days' })).toBe('Based on your 3 tests in the last 15 days');
    expect(basisLine({ ...base, basis: 'last_15_days', attempts_used: 1, based_on_attempts: 1 })).toBe('Based on your 1 test in the last 15 days');
    expect(basisLine({ ...base, basis: 'last_15_days_plus', attempts_used: 5, based_on_attempts: 5 })).toBe(
      'Based on your last 5 tests (few in the last 15 days)',
    );
    expect(basisLine({ ...base, basis: 'last_5_tests' })).toBe('No test in the last 15 days, so based on your last 3 tests');
    expect(basisLine({ ...base, status: 'not_enough_data', basis: 'new', attempts_used: 0, based_on_attempts: 0 })).toBe(
      'You are new here. Start with these topics, then take a test.',
    );
  });

  it('keeps the old wording for a result stored before the backend sent a basis', () => {
    expect(basisLine({ status: 'ready', based_on_attempts: 71 })).toBe('Based on your last 71 tests');
    expect(basisLine({ status: 'not_enough_data', based_on_attempts: 0 })).toBe('Take a few tests and these picks will be made just for you.');
  });
});

describe('masteryBand', () => {
  it('reads weak under 40, building under 70, strong from 70, none without a score', () => {
    expect(masteryBand(null)).toBe('none');
    expect(masteryBand(39)).toBe('weak');
    expect(masteryBand(40)).toBe('building');
    expect(masteryBand(70)).toBe('strong');
  });
});

describe('recommendedTestIds', () => {
  it('marks the tests picked, but not a locked one', () => {
    const data = {
      items: [rec(), rec({ rec_id: 'r2', target: { ...rec().target, test_id: 't2', is_locked: true } })],
    } as Recommendations;
    expect([...recommendedTestIds(data)]).toEqual(['t1']);
    expect(recommendedTestIds(null).size).toBe(0);
  });
});

describe('the language paper', () => {
  const tamil = rec({ rec_id: 'ta', unit: { id: 'g4-ta-grammar', name: 'Grammar', label: 'I' }, category: { id: 'p', name: 'பிழை திருத்தம்' } });
  const english = rec({ rec_id: 'en', unit: { id: 'g4-en-grammar', name: 'Grammar', label: 'I' }, category: { id: 'q', name: 'Question Tags' } });
  const english2 = rec({ rec_id: 'en2', unit: { id: 'g4-en-vocabulary', name: 'Vocabulary', label: 'II' }, category: null });
  const aptitude = rec();
  const data = (over: Partial<Recommendations> = {}): Recommendations => ({
    status: 'ready',
    generated_at: null,
    based_on_attempts: 1,
    readiness: { score: 16, sections: [{ name: 'General English', score: 32, questions: 25 }, { name: 'General Tamil', score: null, questions: 0 }, { name: 'General Studies', score: 0 }] },
    items: [english, tamil, english2, aptitude],
    weak_map: [
      { unit_id: 'g4-en-vocabulary', unit_name: 'Vocabulary', mastery: 18, categories: [] },
      { unit_id: 'g4-ta-grammar', unit_name: 'Grammar', mastery: null, categories: [] },
    ],
    improved: [],
    ...over,
  });

  it('reads a unit and a pick as Tamil, English or for everyone', () => {
    expect(unitLanguage('g4-ta-grammar')).toBe('tamil');
    expect(unitLanguage('g2-en-vocabulary')).toBe('english');
    expect(unitLanguage('g4-apt-aptitude')).toBeNull();
    expect(unitLanguage(null, 'General English')).toBe('english');
    expect(recommendationLanguage(tamil)).toBe('tamil');
    expect(recommendationLanguage(aptitude)).toBeNull();
  });

  it('knows the paper from what was practised, and gives up when it was both or neither', () => {
    expect(practisedLanguage(data())).toBe('english');
    expect(practisedLanguage(data({ weak_map: [{ unit_id: 'g4-ta-grammar', unit_name: 'Grammar', mastery: 40, categories: [] }] }))).toBeNull();
    expect(practisedLanguage(data({ weak_map: [], readiness: null }))).toBeNull();
  });

  it('drops the other paper: its picks, its units and its readiness row, keeping what everyone sits', () => {
    const d = recommendationsForLanguage(data(), 'english');
    expect(d.items.map(r => r.rec_id)).toEqual(['en', 'en2', 'r1']);
    expect(d.weak_map.map(u => u.unit_id)).toEqual(['g4-en-vocabulary']);
    expect(d.readiness?.sections.map(s => s.name)).toEqual(['General English', 'General Studies']);
    expect(recommendationsForLanguage(data(), 'tamil').items.map(r => r.rec_id)).toEqual(['ta', 'r1']);
    expect(recommendationsForLanguage(data(), null).items).toHaveLength(4);
  });
});
describe('starterPicks', () => {
  const stage = findStage('group-4', 'group-4-written')!.stage;
  const paper = (unit_id: string, over: Partial<TnpscTest> = {}) =>
    ({ test_id: `t-${unit_id}`, source: 'assessment', title: unit_id, unit_id, topic_id: null, question_count: 20, time_limit_minutes: null, is_locked: false, ...over }) as TnpscTest;
  const tests = ['g4-ta-grammar', 'g4-en-grammar', 'g4-gs-geography', 'g4-apt-aptitude'].map(u => paper(u));
  const empty = { items: [] as Recommendation[], weak_map: [] as Recommendations['weak_map'] };

  it('offers unpractised units of the chosen language paper and the shared ones, never the other paper', () => {
    const picks = starterPicks({ stage, tests, language: 'tamil', data: empty, max: 3 });
    expect(picks.map(r => r.unit?.id)).toEqual(['g4-ta-grammar', 'g4-gs-geography', 'g4-apt-aptitude']);
    expect(picks.every(r => r.type === 'start_new' && r.rec_id.startsWith('local-'))).toBe(true);
  });

  it('skips units already picked or already practised, units without a paper, and honours the limit', () => {
    const data = {
      items: [rec({ unit: { id: 'g4-ta-grammar', name: 'Grammar' } })],
      weak_map: [{ unit_id: 'g4-gs-geography', unit_name: 'Geography', mastery: 40, categories: [] }],
    };
    expect(starterPicks({ stage, tests, language: 'tamil', data, max: 3 }).map(r => r.unit?.id)).toEqual(['g4-apt-aptitude']);
    expect(starterPicks({ stage, tests, language: 'english', data: empty, max: 1 }).map(r => r.unit?.id)).toEqual(['g4-en-grammar']);
    expect(starterPicks({ stage, tests, language: 'tamil', data: empty, max: 0 })).toEqual([]);
  });
});
