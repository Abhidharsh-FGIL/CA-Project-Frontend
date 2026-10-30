import { describe, expect, it } from 'vitest';
import {
  KIND_LABEL,
  basisLine,
  displayUnitName,
  masteryBand,
  recommendationKind,
  recommendationHref,
  recommendationPlace,
  recommendationTitle,
  recommendedTestIds,
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

describe('recommendationHref', () => {
  it('opens the assessment, the legacy test flow, or the plans page when locked', () => {
    expect(recommendationHref(rec())).toBe('/user/assessment/t1');
    expect(recommendationHref(rec({ target: { ...rec().target, source: 'test' } }))).toBe('/user/test/t1/start');
    expect(recommendationHref(rec({ target: { ...rec().target, is_locked: true } }))).toBe('/user/subscription');
  });
});

describe('naming a pick', () => {
  it('titles it by the category its test covers (the sub-category is its focus) and places it in its unit', () => {
    expect(recommendationTitle(rec())).toBe('HCF');
    expect(recommendationTitle(rec({ subcategory: { id: 's', name: 'Word problems', mastery: 8 } }))).toBe('HCF');
    expect(recommendationTitle(rec({ type: 'full_mock', category: null }))).toBe('Full mock test');
    expect(recommendationPlace(rec())).toBe('Unit I · Aptitude');
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
    expect(recommendationTitle(unitPick)).toBe('Aptitude');
    expect(recommendationPlace(unitPick)).toBe('Unit I');
    // a Key topic still names its unit under the heading
    expect(recommendationPlace(rec())).toBe('Unit I · Aptitude');
  });
});

describe('unit names follow the rest of the app', () => {
  it("shows the Tamil paper's units in Tamil, and the others in English", () => {
    expect(displayUnitName('g4-ta-grammar', 'Grammar')).toBe('இலக்கணம்');
    expect(displayUnitName('g4-en-grammar', 'Grammar')).toBe('Grammar');
    expect(displayUnitName('g4-apt-aptitude', 'Aptitude')).toBe('Aptitude');
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
