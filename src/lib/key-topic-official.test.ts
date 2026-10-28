import { describe, expect, it } from 'vitest';
import { findStage } from '@/config/tnpsc';
import { buildKeyTopicSections, withOfficialNames } from '@/lib/key-topic-sections';
import { officialCategoryOptions } from '@/lib/key-topics';
import { officialCategories, type Syllabus } from '@/lib/taxonomyApi';
import type { TnpscTest } from '@/lib/tnpscApi';

const stage = findStage('group-4', 'group-4-written')!.stage;
const APT = 'g4-apt-aptitude';

let n = 0;
const paper = (over: Partial<TnpscTest>): TnpscTest => ({
  test_id: `t${++n}`,
  source: 'assessment',
  title: `Paper ${n}`,
  group_id: 'group-4',
  stage_id: 'group-4-written',
  test_type: 'practice',
  level: null,
  subject_id: null,
  subject_name: null,
  topic_id: null,
  topic_name: null,
  question_count: 20,
  max_marks: 20,
  time_limit_minutes: null,
  negative_marking: false,
  negative_mark_value: null,
  price: 0,
  required_tier: null,
  is_locked: false,
  lock_reason: null,
  attempts_used: 0,
  max_attempts: null,
  best_percentage: null,
  is_completed: false,
  ...over,
});

const cat = (name: string, sort_order: number) => ({ id: `id-${name}`, name, sort_order, subcategories: [] });
const syllabus: Syllabus = {
  exam: 'group-4',
  stage: 'group-4-written',
  units: [{ id: APT, name: 'Aptitude', sort_order: 21, categories: [cat('LCM', 1), cat('HCF', 0), cat('Mixtures', 2)] }],
};

describe('officialCategories', () => {
  it("lists a unit's official categories in their order", () => {
    expect(officialCategories(syllabus, APT).map(c => c.name)).toEqual(['HCF', 'LCM', 'Mixtures']);
  });
  it('is empty with no list, no unit, or a unit the list does not have', () => {
    expect(officialCategories(null, APT)).toEqual([]);
    expect(officialCategories(syllabus, null)).toEqual([]);
    expect(officialCategories(syllabus, 'g4-apt-reasoning')).toEqual([]);
  });
});

describe('withOfficialNames', () => {
  const printed = [
    { id: 'hcf', name: 'Highest Common Factor (HCF)' },
    { id: 'lcm', name: 'Lowest Common Multiple (LCM)' },
    { id: 'area', name: 'Area' },
  ];

  it('renames a printed topic to its official name and keeps its id, in the official order', () => {
    const out = withOfficialNames(printed, [{ name: 'HCF' }, { name: 'LCM' }]);
    expect(out.slice(0, 2)).toEqual([
      { id: 'hcf', name: 'HCF' },
      { id: 'lcm', name: 'LCM' },
    ]);
  });

  it('keeps topics the list does not mention, after it, so no paper is dropped', () => {
    expect(withOfficialNames(printed, [{ name: 'HCF' }]).map(t => t.name)).toEqual(['HCF', 'Lowest Common Multiple (LCM)', 'Area']);
  });

  it('adds an official category that is no printed topic, keyed by its name', () => {
    expect(withOfficialNames(printed, [{ name: 'Mixtures' }])[0]).toEqual({ id: 'Mixtures', name: 'Mixtures' });
  });

  it('folds every spelling of one category into one row', () => {
    const out = withOfficialNames([...printed, { id: 'LCM', name: 'LCM' }], [{ name: 'LCM' }]);
    expect(out.filter(t => t.name === 'LCM')).toEqual([{ id: 'lcm', name: 'LCM' }]);
    expect(out).toHaveLength(3);
  });

  it('changes nothing without an official list', () => {
    expect(withOfficialNames(printed, [])).toBe(printed);
  });
});

describe('Key Topics with the official list', () => {
  const rows = (s: Syllabus | null, tests: TnpscTest[]) =>
    buildKeyTopicSections(stage, tests, s)
      .flatMap(sec => sec.groups)
      .filter(g => g.key === APT)
      .flatMap(g => g.topics.map(r => ({ name: r.topic.name, tests: r.tests.map(t => t.test_id) })));

  it('shows the official name for a paper filed under the printed topic, and under the bank category', () => {
    const printedPaper = paper({ unit_id: APT, topic_id: 'lcm', topic_name: 'Lowest Common Multiple (LCM)' });
    const bankPaper = paper({ unit_id: APT, topic_id: 'LCM', topic_name: 'LCM', level: 'medium' });
    expect(rows(syllabus, [printedPaper, bankPaper])).toEqual([{ name: 'LCM', tests: [printedPaper.test_id, bankPaper.test_id] }]);
  });

  it('keeps the hand-typed name when there is no official list', () => {
    const p = paper({ unit_id: APT, topic_id: 'lcm' });
    expect(rows(null, [p])).toEqual([{ name: 'Lowest Common Multiple (LCM)', tests: [p.test_id] }]);
  });

  it('still lists a paper whose topic the official list does not have', () => {
    const p = paper({ unit_id: APT, topic_id: 'area' });
    expect(rows(syllabus, [p]).map(r => r.tests)).toEqual([[p.test_id]]);
  });
});

describe('officialCategoryOptions (admin key-topic dropdown)', () => {
  const bank = [
    { name: 'LCM', count: 65 },
    { name: 'Quantitative aptitude', count: 1 },
  ];

  it('offers the official names only, in order, with how many bank questions carry each exactly', () => {
    expect(officialCategoryOptions([{ name: 'HCF' }, { name: 'LCM' }], bank)).toEqual([
      { name: 'HCF', count: 0 },
      { name: 'LCM', count: 65 },
    ]);
  });

  it('is null without an official list, so the bank list is used as before', () => {
    expect(officialCategoryOptions([], bank)).toBeNull();
  });
});
