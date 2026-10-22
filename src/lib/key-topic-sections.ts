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

/**
 * Letters only, lowercased — ids, Tamil labels and titles all normalise to this.
 *
 * Letters of any script, plus the combining marks Tamil vowel signs are made of. Keeping only a–z made every
 * Tamil name normalise to "", so all Tamil topics looked identical: papers matched the wrong topics, and
 * papers with different titles were collapsed into one.
 */
export const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{M}]/gu, '');

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

/**
 * Whether a paper's topic label is this topic. Stricter than `sameLabel`: a short label inside a long topic
 * name is not a match unless it is most of it — "Physics" sits inside "Everyday application of mechanics, …
 * and nuclear physics", but it is a different topic with a paper of its own.
 */
const sameTopic = (a: string, b: string) => {
  const x = norm(a);
  const y = norm(b);
  if (!x || !y) return false;
  if (x === y) return true;
  return sameLabel(a, b) && Math.min(x.length, y.length) / Math.max(x.length, y.length) >= 0.5;
};

/**
 * The papers for one topic: the unit's own id first, then a topic that is the same by name.
 *
 * A paper filed under a differently-worded copy of the topic ("Letter Writing: Formal and Informal" for
 * "Letter writing (formal and informal)") belongs to the topic too, so the two are one row. The same
 * paper listed twice under one title is shown once.
 */
export function testsForTopic(unitId: string | undefined, topic: TnpscTopic, tests: TnpscTest[]): TnpscTest[] {
  const inUnit = tests.filter(t => !unitId || !t.unit_id || t.unit_id === unitId);
  const sameName = (t: TnpscTest) => !!t.topic_name && norm(t.topic_name) === norm(topic.name);
  const exact = inUnit.filter(t => t.topic_id === topic.id || sameName(t));
  const found =
    exact.length > 0
      ? exact
      : inUnit.filter(
          t => (t.topic_id && sameTopic(topic.id, t.topic_id)) || (t.topic_name && sameTopic(topic.name, t.topic_name)),
        );
  const seen = new Set<string>();
  return found.filter(t => {
    // Digits count here: "…File1" and "…File2" are two papers, not one listed twice.
    const key = `${t.title.toLowerCase().replace(/[^\p{L}\p{M}\p{N}]/gu, '')}|${t.level ?? ''}|${t.test_type}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
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
    const name = (t.topic_name ?? '').trim() || id;
    // A category that only rewords a printed topic is that topic, not a second one.
    if (printed.some(p => p.id === id || norm(p.name) === norm(name)) || extra.has(id)) continue;
    if ([...extra.values()].some(e => norm(e.name) === norm(name))) continue;
    extra.set(id, { id, name });
  }
  const all = [...printed, ...extra.values()];
  // A syllabus that prints the same topic twice still has one topic.
  const seen = new Set<string>();
  return all.filter(t => {
    const key = norm(t.name) || t.id;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Each printed section with the topics that have a paper, grouped by unit.
 *
 * Only topics with a paper are listed: a topic is a "key topic" here because someone made a test for
 * it. A section with none is still returned, so the page can show it as coming rather than drop it.
 */
function buildSections(stage: TnpscStage, tests: TnpscTest[]): KeyTopicSection[] {
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

/**
 * Each paper belongs on exactly one row of the whole page.
 *
 * Matching is by id first and by name after it, and two topics can both claim a paper by name — a reworded
 * topic, or a paper with no unit that two units could take. Left alone the paper is listed under each. So a
 * paper stays on the row whose topic id it carries, or failing that the first row that matched it.
 */
function claimOnce(sections: KeyTopicSection[]): KeyTopicSection[] {
  const owner = new Map<string, KeyTopicRow>();
  const rank = (row: KeyTopicRow, t: TnpscTest) => (t.topic_id === row.topic.id ? 0 : 1);
  for (const row of sections.flatMap(sec => sec.groups.flatMap(g => g.topics))) {
    for (const t of row.tests) {
      const current = owner.get(t.test_id);
      if (!current || rank(row, t) < rank(current, t)) owner.set(t.test_id, row);
    }
  }
  return sections.map(sec => {
    const groups = sec.groups
      .map(g => ({
        ...g,
        topics: g.topics
          .map(r => ({ ...r, tests: r.tests.filter(t => owner.get(t.test_id) === r) }))
          .filter(r => r.tests.length > 0),
      }))
      .filter(g => g.topics.length > 0);
    const rows = groups.flatMap(g => g.topics);
    return { ...sec, groups, topicCount: rows.length, testCount: rows.reduce((n, r) => n + r.tests.length, 0) };
  });
}

export function buildKeyTopicSections(stage: TnpscStage, tests: TnpscTest[]): KeyTopicSection[] {
  return claimOnce(buildSections(stage, tests));
}

