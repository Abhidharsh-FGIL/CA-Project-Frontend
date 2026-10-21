import { describe, expect, it } from 'vitest';
import { findStage } from '@/config/tnpsc';
import { buildKeyTopicSections, isKeyTopicPaper, testsForTopic } from '@/lib/key-topic-sections';
import type { TnpscTest } from '@/lib/tnpscApi';

const stage = findStage('group-4', 'group-4-written')!.stage;

let n = 0;
const test = (over: Partial<TnpscTest>): TnpscTest => ({
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

const POLITY = 'g4-gs-indian-polity';
const rights = test({ unit_id: POLITY, topic_id: 'citizenship-rights-duties' });
const dpspA = test({ unit_id: POLITY, topic_id: 'directive-principles', level: 'simple' });
const dpspB = test({ unit_id: POLITY, topic_id: 'directive-principles', level: 'medium' });
const wholeUnit = test({ unit_id: POLITY });

describe('isKeyTopicPaper', () => {
  it('is a paper that names a topic', () => {
    expect(isKeyTopicPaper(rights)).toBe(true);
    expect(isKeyTopicPaper(wholeUnit)).toBe(false);
  });
});

describe('testsForTopic', () => {
  const topic = { id: 'directive-principles', name: 'Directive Principles of State Policy' };

  it('takes the papers that name the topic in that unit', () => {
    expect(testsForTopic(POLITY, topic, [rights, dpspA, dpspB]).map(t => t.test_id)).toEqual([dpspA.test_id, dpspB.test_id]);
  });

  it("leaves out another unit's paper on a topic of the same id", () => {
    const elsewhere = test({ unit_id: 'g4-gs-some-other-unit', topic_id: 'directive-principles' });
    expect(testsForTopic(POLITY, topic, [elsewhere])).toEqual([]);
  });

  it('still finds a paper the server did not tag with a unit', () => {
    const noUnit = test({ topic_id: 'directive-principles' });
    expect(testsForTopic(POLITY, topic, [noUnit])).toEqual([noUnit]);
  });

  it('falls back to the topic’s name when the id is not the catalog’s', () => {
    const byName = test({ unit_id: POLITY, topic_id: 'dpsp-x', topic_name: 'Directive Principles of State Policy' });
    expect(testsForTopic(POLITY, topic, [byName])).toEqual([byName]);
  });
});

describe('buildKeyTopicSections', () => {
  const sections = buildKeyTopicSections(stage, [rights, dpspA, dpspB]);
  const byName = (name: string) => sections.find(s => s.name === name)!;

  it('returns every printed section, whether or not it has a paper', () => {
    expect(sections.map(s => s.name)).toEqual(stage.pattern!.sections.map(s => s.name));
    expect(sections.length).toBeGreaterThanOrEqual(4);
  });

  it('lists only the topics that have a paper, under the unit that prints them', () => {
    const studies = sections.find(s => s.groups.some(g => g.key === POLITY))!;
    const group = studies.groups.find(g => g.key === POLITY)!;
    expect(group.topics.map(r => r.topic.id)).toEqual(['citizenship-rights-duties', 'directive-principles']);
    expect(group.topics[1].tests).toHaveLength(2);
    expect(studies.topicCount).toBe(2);
    expect(studies.testCount).toBe(3);
  });

  it('leaves a section with no paper empty rather than dropping it', () => {
    const empty = sections.filter(s => s.topicCount === 0);
    expect(empty.length).toBeGreaterThan(0);
    for (const s of empty) expect(s.groups).toEqual([]);
  });

  it('is all empty with no key-topic papers', () => {
    expect(buildKeyTopicSections(stage, []).every(s => s.topicCount === 0 && s.testCount === 0)).toBe(true);
    expect(byName).toBeDefined();
  });
});
