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
import { officialCategories, type Syllabus } from '@/lib/taxonomyApi';

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
  /** Set on the Current Affairs group, which is listed first and marked with a star instead of a unit numeral. */
  star?: boolean;
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

/** Whether an official category is this topic: same name, same id, or the abbreviation it glosses ("LCM"). */
function isOfficialFor(topic: TnpscTopic, official: string): boolean {
  const o = norm(official);
  if (!o) return false;
  if (norm(topic.name) === o || norm(topic.id) === o) return true;
  const gloss = /\(([^)]+)\)\s*$/.exec(topic.name)?.[1];
  return !!gloss && norm(gloss) === o;
}

/**
 * A unit's topics named and ordered by the official list (built from the uploaded sheets).
 *
 * An official category that is a known topic keeps that topic's id — so the papers filed under it still find it
 * — and takes the official name. One that is not becomes a topic of its own, named and keyed by the category
 * (a key-topic paper is filed under the category text). Topics the list does not mention follow, so a paper
 * filed under an old name is never dropped from the page. No official list: the topics as they were.
 */
export function withOfficialNames(topics: TnpscTopic[], official: Array<{ name: string }>): TnpscTopic[] {
  if (official.length === 0) return topics;
  const used = new Set<TnpscTopic>();
  const named = official.map(c => {
    // Every spelling of it is this one row ("Lowest Common Multiple (LCM)" printed, "LCM" from a paper); the
    // papers of each still match the row by name.
    const same = topics.filter(t => !used.has(t) && isOfficialFor(t, c.name));
    same.forEach(t => used.add(t));
    return { id: same[0]?.id ?? c.name, name: c.name };
  });
  return [...named, ...topics.filter(t => !used.has(t))];
}

/**
 * Each printed section with the topics that have a paper, grouped by unit.
 *
 * Only topics with a paper are listed: a topic is a "key topic" here because someone made a test for
 * it. A section with none is still returned, so the page can show it as coming rather than drop it.
 */
function buildSections(stage: TnpscStage, tests: TnpscTest[], syllabus?: Syllabus | null): KeyTopicSection[] {
  return (stage.pattern?.sections ?? []).map(section => {
    const groups: KeyTopicGroup[] = (
      section.units?.length
        ? section.units.map(unit => ({
            key: unit.id,
            label: unit.label,
            name: unitDisplayName(stage, unit),
            topics: withOfficialNames(unitTopicsWithCategories(stage, unit, tests), officialCategories(syllabus, unit.id))
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
      groups: currentAffairsFirst(groups),
      topicCount: rows.length,
      testCount: rows.reduce((n, r) => n + r.tests.length, 0),
    };
  });
}

/**
 * Current Affairs is not one of the commission's numbered units - it runs through several of them - so it leads
 * its section as its own thing, starred, and takes no unit numeral. (The Practice tab lists it first for the
 * same reason.)
 */
const isCurrentAffairsName = (name: string) => /current\s+affairs/i.test(name);
export function currentAffairsFirst(groups: KeyTopicGroup[]): KeyTopicGroup[] {
  const current = groups.filter(g => isCurrentAffairsName(g.name)).map(g => ({ ...g, label: undefined, star: true }));
  return current.length === 0 ? groups : [...current, ...groups.filter(g => !isCurrentAffairsName(g.name))];
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

/** `syllabus` is the official list (`GET /syllabus`); without it the hand-typed syllabus names the topics. */
export function buildKeyTopicSections(stage: TnpscStage, tests: TnpscTest[], syllabus?: Syllabus | null): KeyTopicSection[] {
  return claimOnce(buildSections(stage, tests, syllabus));
}

