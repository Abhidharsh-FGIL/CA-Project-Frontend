/**
 * Key topics — the printed topics of a syllabus unit, and what the question bank holds for each.
 *
 * A key-topic paper is a practice paper about one topic of one unit. The question bank is tagged
 * by subject and chapter (the sheet's "Topic" column is stored as `chapter`), so the bridge from
 * "Citizenship, Fundamental Rights and Fundamental Duties" to the questions that carry it is the
 * chapter's *name*. This reads the bank and says, per topic, how many questions it can supply —
 * so an admin picks a topic the bank can fill, and the paper is then drawn from that topic alone.
 */
import { unitTopics, type TnpscStage, type TnpscSyllabusUnit, type TnpscTopic } from '@/config/tnpsc';
import { questionInUnit } from '@/lib/unit-pool';

/** Compare names the way a reader would: case, punctuation and "&" are noise. */
function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/&/g, ' ')
    .replace(/\band\b/g, ' ')
    // Unicode-aware so Tamil survives; combining marks are kept because Tamil vowel signs are
    // marks, not letters, and dropping them folds different words together.
    .replace(/[^\p{L}\p{N}\p{M}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** A name with and without its parenthetical gloss: "இலக்கணம் (Grammar)" → both forms. */
function spellings(raw: string): string[] {
  const out = new Set([norm(raw), norm(raw.replace(/\([^)]*\)/g, ' '))]);
  out.delete('');
  return [...out];
}

const topicKeyCache = new WeakMap<TnpscTopic, Set<string>>();

/** Every spelling under which a tag may name this topic. */
function topicKeys(topic: TnpscTopic): Set<string> {
  let keys = topicKeyCache.get(topic);
  if (!keys) {
    keys = new Set([...spellings(topic.name), ...spellings(topic.id.replace(/-/g, ' '))]);
    topicKeyCache.set(topic, keys);
  }
  return keys;
}

/** What a question's own tags call its topic — the chapter first, then the topic and subtopic. */
function tagLabels(q: any): string[] {
  const labels: string[] = [];
  for (const v of [q?.chapter, q?.topic, q?.subtopic]) {
    if (typeof v !== 'string' || !v.trim()) continue;
    labels.push(...spellings(v));
    // "Writing Skills – Prepositions": the leading piece names the group, the rest the topic.
    for (const piece of v.split(/\s[–—-]\s|:\s/)) labels.push(...spellings(piece));
  }
  return labels;
}

/** Whether a bank question is about this topic, by the name its tags give it. */
export function questionInTopic(q: any, topic: TnpscTopic): boolean {
  const keys = topicKeys(topic);
  return tagLabels(q).some(label => keys.has(label));
}

/**
 * How many bank questions each of a unit's topics can supply, by topic id.
 *
 * Only questions the bank places in the unit are counted, so a chapter of the same name in another
 * unit's subject is not.
 */
export function bankTopicCounts(
  stage: TnpscStage | undefined,
  unit: TnpscSyllabusUnit | undefined,
  questions: any[],
): Record<string, number> {
  const counts: Record<string, number> = {};
  if (!stage || !unit) return counts;
  const topics = unitTopics(stage, unit);
  for (const t of topics) counts[t.id] = 0;
  if (topics.length === 0) return counts;
  for (const q of questions) {
    if (!questionInUnit(stage, q, unit)) continue;
    for (const t of topics) {
      if (questionInTopic(q, t)) counts[t.id] += 1;
    }
  }
  return counts;
}

/**
 * The chapter names, exactly as the bank spells them, that carry this topic's questions.
 *
 * What a paper filters its pool by: choosing the topic selects these chapters, so the paper is
 * drawn from that topic and nothing else in the unit.
 */
export function chaptersForTopic(questions: any[], topic: TnpscTopic): string[] {
  const chapters = new Set<string>();
  for (const q of questions) {
    const chapter = typeof q?.chapter === 'string' ? q.chapter.trim() : '';
    if (chapter && questionInTopic(q, topic)) chapters.add(q.chapter);
  }
  return [...chapters];
}

/**
 * The categories the question bank gives a unit's questions, with how many each holds — most first.
 *
 * What a key-topic paper is chosen from: the category is the bank's own tag on a question (e.g. அணியிலக்கணம்),
 * so a paper drawn from one category takes that category's questions.
 */
export function bankCategoryCounts(
  stage: TnpscStage | undefined,
  unit: TnpscSyllabusUnit | undefined,
  questions: any[],
): Array<{ name: string; count: number }> {
  if (!stage || !unit) return [];
  const counts = new Map<string, number>();
  for (const q of questions) {
    const name = typeof q?.category === 'string' ? q.category.trim() : '';
    if (!name || !questionInUnit(stage, q, unit)) continue;
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}
