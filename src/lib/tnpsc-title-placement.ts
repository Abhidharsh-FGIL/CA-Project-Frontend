/**
 * Recovering a practice paper's unit and level from its title.
 *
 * The aspirant portal files a practice paper under a unit by the paper's `unit_id`, and
 * under a difficulty button by its `level`. Both are stored when the paper is placed, but
 * the practice *listing* has not always returned them — the paper is visible, its tag is
 * saved, and the portal still shows "No paper yet" under the unit because nothing in the
 * listing says which unit it is. See BACKEND_WORK.md item 4.
 *
 * The assessment wizard writes the title from the placement, so the placement is in it:
 *
 *     TNPSC Group 4 — இலக்கணம் · Simple
 *     TNPSC Group 4 — Indian Polity: Fundamental Rights · Mixed
 *
 * This reads it back. It is a fallback, not a source of truth, and is deliberately
 * strict: the unit part must equal a unit's display name exactly, and be the only unit
 * that does, or nothing is inferred. A title an admin has rewritten simply does not
 * parse, and the paper is placed — or not — exactly as it was before. The server's own
 * `unit_id` and `level`, when present, are never overridden.
 */
import {
  MIXED_LABEL,
  stageUnits,
  unitDisplayName,
  unitTopics,
  type TnpscLevel,
  type TnpscStage,
  type TnpscTopic,
} from '@/config/tnpsc';

export interface TitlePlacement {
  unit_id: string;
  /** The difficulty button; null for the all-difficulties ("Mixed") set. */
  level: TnpscLevel | null;
  /**
   * The unit's printed topic the title names ("Indian Polity: Fundamental Rights"), or null.
   *
   * A key-topic paper is saved as a unit paper naming its topic, but the server only accepts topics it
   * has a row for, and its list is not the printed one. Where it refuses, the paper is saved as a plain
   * unit paper and the title is what remembers the topic.
   */
  topic: TnpscTopic | null;
}

const LEVELS: Record<string, TnpscLevel> = { simple: 'simple', medium: 'medium', complex: 'complex' };

/** Case, spacing and Unicode composition do not distinguish two spellings of a name. */
const key = (s: string) => s.normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim();

export function placementFromTitle(
  stage: TnpscStage | undefined,
  title: string | null | undefined,
): TitlePlacement | null {
  const t = title?.trim();
  if (!stage || !t) return null;

  // "<exam> — <unit>[: <topic>] · <level>"
  const dash = t.indexOf(' — ');
  if (dash < 0) return null;
  const rest = t.slice(dash + 3);
  const dot = rest.lastIndexOf(' · ');
  if (dot < 0) return null;

  const levelPart = key(rest.slice(dot + 3));
  let level: TnpscLevel | null;
  if (levelPart in LEVELS) level = LEVELS[levelPart];
  // "Mixed" now; "Full Unit" on titles written before the rename.
  else if (levelPart === key(MIXED_LABEL) || levelPart === 'full unit') level = null;
  else return null;

  const head = rest.slice(0, dot);
  const colon = head.indexOf(':');
  const unitPart = key(colon < 0 ? head : head.slice(0, colon));
  if (!unitPart) return null;

  const hits = stageUnits(stage).filter(({ unit }) => key(unitDisplayName(stage, unit)) === unitPart);
  if (hits.length !== 1) return null;

  // What follows the colon is a topic only if it is one of this unit's printed topics, exactly.
  const topicPart = colon < 0 ? '' : key(head.slice(colon + 1));
  const topic = topicPart ? (unitTopics(stage, hits[0].unit).find(t => key(t.name) === topicPart) ?? null) : null;
  return { unit_id: hits[0].unit.id, level, topic };
}

/**
 * Fill in `unit_id`, `level` and the key topic on practice papers the server did not place.
 *
 * Only ever adds: a paper that already carries a unit keeps it, and one that carries a
 * level keeps that too. A paper the server did place as a unit paper still gets its topic from the
 * title when the title names one of that unit's topics — that is the key-topic paper the server had no
 * topic row for.
 */
export function withTitlePlacement<
  T extends {
    title: string;
    test_type?: string | null;
    unit_id?: string | null;
    level?: TnpscLevel | null;
    topic_id?: string | null;
    topic_name?: string | null;
  },
>(stage: TnpscStage | undefined, tests: T[]): T[] {
  if (!stage) return tests;
  return tests.map(t => {
    if (t.test_type && t.test_type !== 'practice') return t;
    const placed = placementFromTitle(stage, t.title);
    if (!placed) return t;
    const topic = !t.topic_id && placed.topic && placed.unit_id === (t.unit_id ?? placed.unit_id) ? placed.topic : null;
    const topicFields = topic ? { topic_id: topic.id, topic_name: topic.name } : {};
    // A paper the server placed keeps its unit and level; only an unplaced one takes them from the title.
    if (t.unit_id) return topic ? { ...t, ...topicFields } : t;
    return { ...t, unit_id: placed.unit_id, level: t.level ?? placed.level, ...topicFields };
  });
}
