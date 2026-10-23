import { describe, expect, it } from 'vitest';
import { findStage } from '@/config/tnpsc';
import { buildKeyTopicSections, isKeyTopicPaper, norm, testsForTopic } from '@/lib/key-topic-sections';
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

describe('duplicates', () => {
  const topic = { id: 'directive-principles', name: 'Directive Principles of State Policy' };

  it('shows one paper once when it is listed twice under the same title', () => {
    const a = test({ unit_id: POLITY, topic_id: topic.id, title: 'Grammar: Concord · Mixed' });
    const b = test({ unit_id: POLITY, topic_id: topic.id, title: 'Grammar: Concord · Mixed' });
    expect(testsForTopic(POLITY, topic, [a, b])).toEqual([a]);
  });

  it('keeps two papers that differ in level', () => {
    const a = test({ unit_id: POLITY, topic_id: topic.id, title: 'Same title', level: 'simple' });
    const b = test({ unit_id: POLITY, topic_id: topic.id, title: 'Same title', level: 'medium' });
    expect(testsForTopic(POLITY, topic, [a, b])).toHaveLength(2);
  });

  it('files a paper under a reworded copy of a topic with the topic itself', () => {
    const reworded = test({ unit_id: POLITY, topic_id: 'dpsp-copy', topic_name: 'Directive principles of state policy' });
    const own = test({ unit_id: POLITY, topic_id: topic.id, title: 'Own paper' });
    expect(testsForTopic(POLITY, topic, [own, reworded]).map(t => t.test_id)).toEqual([own.test_id, reworded.test_id]);
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

describe('one paper, one row', () => {
  const fake = (): any => ({
    id: 's',
    pattern: {
      sections: [
        {
          name: 'Sec',
          units: [
            { id: 'u1', label: 'I', name: 'Unit one', subject_ids: [], topic_ids: ['alpha'], topics: [{ id: 'alpha', name: 'Alpha topic' }] },
            { id: 'u2', label: 'II', name: 'Unit two', subject_ids: [], topic_ids: ['alpha-2'], topics: [{ id: 'alpha-2', name: 'Alpha topic' }] },
          ],
        },
      ],
    },
  });

  it('lists a unit-less paper under one of two units that both name its topic, not both', () => {
    const paper = test({ topic_id: 'alpha', topic_name: 'Alpha topic' });
    const out = buildKeyTopicSections(fake(), [paper]);
    const rows = out.flatMap(sec => sec.groups.flatMap(g => g.topics)).filter(r => r.tests.some(t => t.test_id === paper.test_id));
    expect(rows.length).toBeLessThanOrEqual(1);
  });
});

describe('Tamil names', () => {
  it('stay distinct once normalised (they used to all become an empty string)', () => {
    expect(norm('புணர்ச்சி இலக்கணம்')).not.toBe('');
    expect(norm('புணர்ச்சி இலக்கணம்')).not.toBe(norm('எழுத்திலக்கணம்'));
  });

  it('keep papers with different Tamil titles apart', () => {
    const topic = { id: 'punarchi', name: 'புணர்ச்சி இலக்கணம்' };
    const a = test({ topic_id: 'punarchi', topic_name: 'புணர்ச்சி இலக்கணம்', title: 'புணர்ச்சி இலக்கணம் — 1' });
    const b = test({ topic_id: 'punarchi', topic_name: 'புணர்ச்சி இலக்கணம்', title: 'புணர்ச்சி இலக்கணம் — 2' });
    const other = test({ topic_id: 'ezhuthu', topic_name: 'எழுத்திலக்கணம்', title: 'எழுத்திலக்கணம் — 1' });
    const found = testsForTopic(undefined, topic, [a, b, other]);
    expect(found.map(t => t.test_id).sort()).toEqual([a.test_id, b.test_id].sort());
  });
});

describe('Current Affairs in the key topics', () => {
  it('leads its section, starred, with no unit numeral', async () => {
    const { currentAffairsFirst } = await import('@/lib/key-topic-sections');
    const group = (name: string, label?: string) => ({ key: name, name, label, topics: [] });
    const out = currentAffairsFirst([group('Indian Polity', 'IV'), group('Current Affairs', 'VII'), group('Geography', 'II')]);
    expect(out.map(g => g.name)).toEqual(['Current Affairs', 'Indian Polity', 'Geography']);
    expect(out[0].star).toBe(true);
    expect(out[0].label).toBeUndefined();
    expect(out[1].star).toBeUndefined();
  });

  it('leaves a section without it alone', async () => {
    const { currentAffairsFirst } = await import('@/lib/key-topic-sections');
    const groups = [{ key: 'a', name: 'Indian Polity', label: 'IV', topics: [] }];
    expect(currentAffairsFirst(groups)).toBe(groups);
  });
});
