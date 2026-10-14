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
  type TnpscLevel,
  type TnpscStage,
} from '@/config/tnpsc';

export interface TitlePlacement {
  unit_id: string;
  /** The difficulty button; null for the all-difficulties ("Mixed") set. */
  level: TnpscLevel | null;
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

  const unitPart = key(rest.slice(0, dot).split(':')[0]);
  if (!unitPart) return null;

  const hits = stageUnits(stage).filter(({ unit }) => key(unitDisplayName(stage, unit)) === unitPart);
  return hits.length === 1 ? { unit_id: hits[0].unit.id, level } : null;
}

/**
 * Fill in `unit_id` and `level` on practice papers the server did not place.
 *
 * Only ever adds: a paper that already carries a unit keeps it, and one that carries a
 * level keeps that too.
 */
export function withTitlePlacement<
  T extends { title: string; test_type?: string | null; unit_id?: string | null; level?: TnpscLevel | null },
>(stage: TnpscStage | undefined, tests: T[]): T[] {
  if (!stage) return tests;
  return tests.map(t => {
    if (t.unit_id || (t.test_type && t.test_type !== 'practice')) return t;
    const placed = placementFromTitle(stage, t.title);
    if (!placed) return t;
    return { ...t, unit_id: placed.unit_id, level: t.level ?? placed.level };
  });
}
