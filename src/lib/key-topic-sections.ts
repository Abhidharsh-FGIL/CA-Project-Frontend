/**
 * The Key Topics track as data: each printed section, the topics under it that have a paper, and the
 * papers for each.
 *
 * Kept out of the page so the matching can be tested without rendering it.
 */
import {
  sectionSyllabus,
  unitDisplayName,
  unitTopics,
  type TnpscStage,
  type TnpscTopic,
} from '@/config/tnpsc';
import type { TnpscTest } from '@/lib/tnpscApi';

/** Letters only, lowercased — ids, Tamil labels and titles all normalise to this. */
export const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '');

/**
 * Whether two labels name the same thing.
 *
 * Exact after normalising, or one contained in the other once both are long
 * enough for containment to mean something — "Reading Comprehension" is the unit
 * the topic `comprehension` belongs to, but a 3-letter overlap would match
 * anything. Five is the shortest length where a false positive stops being likely.
 */
export function sameLabel(a: string, b: string): boolean {
  const x = norm(a);
  const y = norm(b);
  if (!x || !y) return false;
  if (x === y) return true;
  const short = x.length <= y.length ? x : y;
  const long = short === x ? y : x;
  return short.length >= 5 && long.includes(short);
}

// ─── Key topics ───────────────────────────────────────────────────────────────

/**
 * A paper about one topic of a unit.
 *
 * The admin files it as a unit paper that names its topic, so a paper with a topic is a key-topic
 * paper and belongs to the Key Topics track — not to the unit's own difficulty buttons, where it
 * would read as a whole-unit set.
 */
export const isKeyTopicPaper = (t: TnpscTest) => !!t.topic_id;

export interface KeyTopicRow {
  topic: TnpscTopic;
  tests: TnpscTest[];
}

export interface KeyTopicGroup {
  key: string;
  /** The unit's numeral, when the group is a published unit. */
  label?: string;
  name: string;
  topics: KeyTopicRow[];
}

export interface KeyTopicSection {
  key: string;
  name: string;
  alternativeTo?: string;
  groups: KeyTopicGroup[];
  topicCount: number;
  testCount: number;
}

/** The papers for one topic: the unit's own id first, then a topic that is the same by name. */
export function testsForTopic(unitId: string | undefined, topic: TnpscTopic, tests: TnpscTest[]): TnpscTest[] {
  const inUnit = tests.filter(t => !unitId || !t.unit_id || t.unit_id === unitId);
  const exact = inUnit.filter(t => t.topic_id === topic.id);
  if (exact.length > 0) return exact;
  return inUnit.filter(
    t => (t.topic_id && sameLabel(topic.id, t.topic_id)) || (t.topic_name && sameLabel(topic.name, t.topic_name)),
  );
}

/**
 * A unit's printed topics, plus any bank category a key-topic paper is filed under that the syllabus does
 * not print. A category is listed under its unit with its own name.
 */
export function unitTopicsWithCategories(stage: TnpscStage, unit: { id: string }, tests: TnpscTest[]): TnpscTopic[] {
  const printed = unitTopics(stage, unit as any);
  const extra = new Map<string, TnpscTopic>();
  for (const t of tests) {
    const id = (t.topic_id ?? '').trim();
    if (!id || t.unit_id !== unit.id) continue;
    if (printed.some(p => p.id === id) || extra.has(id)) continue;
    extra.set(id, { id, name: (t.topic_name ?? '').trim() || id });
  }
  return [...printed, ...extra.values()];
}

/**
 * Each printed section with the topics that have a paper, grouped by unit.
 *
 * Only topics with a paper are listed: a topic is a "key topic" here because someone made a test for
 * it. A section with none is still returned, so the page can show it as coming rather than drop it.
 */
export function buildKeyTopicSections(stage: TnpscStage, tests: TnpscTest[]): KeyTopicSection[] {
  return (stage.pattern?.sections ?? []).map(section => {
    const groups: KeyTopicGroup[] = (
      section.units?.length
        ? section.units.map(unit => ({
            key: unit.id,
            label: unit.label,
            name: unitDisplayName(stage, unit),
            topics: unitTopicsWithCategories(stage, unit, tests)
              .map(topic => ({ topic, tests: testsForTopic(unit.id, topic, tests) }))
              .filter(r => r.tests.length > 0),
          }))
        : // A section with no published units lists its catalog subjects instead.
          sectionSyllabus(stage, section).map(sub => ({
            key: sub.id,
            name: sub.name,
            topics: sub.topics
              .map(topic => ({ topic, tests: testsForTopic(undefined, topic, tests) }))
              .filter(r => r.tests.length > 0),
          }))
    ).filter(g => g.topics.length > 0);

    const rows = groups.flatMap(g => g.topics);
    return {
      key: section.name,
      name: section.name,
      alternativeTo: section.alternative_to,
      groups,
      topicCount: rows.length,
      testCount: rows.reduce((n, r) => n + r.tests.length, 0),
    };
  });
}

