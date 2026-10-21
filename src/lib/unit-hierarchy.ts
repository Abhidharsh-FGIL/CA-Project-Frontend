/**
 * Which subject a unit sits under, for reading a unit-wise report as a tree:
 *
 *   Level 1  Subject       General Tamil / General Studies / Aptitude
 *   Level 2  Unit          Grammar / Geography / History / Mathematics
 *   Level 3  Category      the topics the paper tagged under the unit
 *   Level 4  Sub-category  the sub-topics under those
 *
 * Levels 3 and 4 come from the questions themselves (see `TopicNode`); levels 1 and 2 are the catalog's:
 * a stage's paper is made of sections (the subjects), each listing its units.
 */
import { TNPSC_GROUPS } from '@/config/tnpsc';

interface Placement {
  subject: string;
  /** The subject's position in the paper, so the tree reads in the order the paper prints. */
  order: number;
}

let index: Map<string, Placement> | null = null;

function build(): Map<string, Placement> {
  const map = new Map<string, Placement>();
  let order = 0;
  for (const group of TNPSC_GROUPS) {
    for (const stage of group.stages) {
      for (const section of stage.pattern?.sections ?? []) {
        order += 1;
        for (const unit of section.units ?? []) {
          if (!map.has(unit.id)) map.set(unit.id, { subject: section.name, order });
        }
      }
    }
  }
  return map;
}

/** The subject a unit belongs to (the section that lists it), or null when the catalog does not know the unit. */
export function subjectOfUnit(unitId: string | null | undefined): { subject: string; order: number } | null {
  if (!unitId) return null;
  index ??= build();
  return index.get(unitId.replace(/^unit:/, '')) ?? null;
}

export interface UnitGroup<T> {
  /** The subject's name, or `null` for units the catalog does not place. */
  subject: string | null;
  items: T[];
}

/**
 * Units grouped under their subject, in the order the paper prints its subjects. Units the catalog does
 * not know go last, in a group of their own, so none is lost.
 */
export function groupUnitsBySubject<T>(items: T[], idOf: (item: T) => string): Array<UnitGroup<T>> {
  const groups = new Map<string, { order: number; items: T[] }>();
  const unplaced: T[] = [];
  for (const item of items) {
    const placed = subjectOfUnit(idOf(item));
    if (!placed) {
      unplaced.push(item);
      continue;
    }
    const g = groups.get(placed.subject) ?? { order: placed.order, items: [] };
    g.items.push(item);
    groups.set(placed.subject, g);
  }
  const out: Array<UnitGroup<T>> = [...groups.entries()]
    .sort((a, b) => a[1].order - b[1].order)
    .map(([subject, g]) => ({ subject, items: g.items }));
  if (unplaced.length > 0) out.push({ subject: null, items: unplaced });
  return out;
}
