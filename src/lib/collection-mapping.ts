/**
 * Where each collection's questions went.
 *
 * The unit picker maps bank questions to units from their tags. When a unit's count looks
 * short, the useful question is not "how many does the unit have" but "where did *this
 * collection's* questions go" — a collection of 50 that shows up as 0 in its unit has tags
 * the matcher does not read, and those tags are what needs fixing.
 *
 * This groups the bank by the collection each question was saved under, and for each one says
 * how many landed in which unit, how many landed nowhere, and what the ones that landed
 * nowhere are tagged with (and a sample of the question, so a reader can see what it is).
 */
import type { TnpscStage } from '@/config/tnpsc';
import { asQuestionDifficulty } from '@/lib/eval-difficulty';
import { unitIdsOf } from '@/lib/unit-pool';

export interface CollectionRow {
  /** The collection's id; null for questions that belong to none. */
  id: string | null;
  title: string;
  total: number;
  /** Questions that landed in at least one unit. */
  placed: number;
  byUnit: Array<{ unitId: string; count: number }>;
  difficulty: { easy: number; medium: number; hard: number; untagged: number };
  /** The commonest tag pairs among the questions that landed nowhere, with a sample question. */
  unplaced: Array<{ subject: string; chapter: string; count: number; sample: string }>;
}

const NO_COLLECTION = '__none__';

export function summariseCollections(
  stage: TnpscStage | undefined,
  questions: any[],
  papers: Array<{ id?: string; paper_id?: string; title?: string; name?: string }>,
  /** How many unplaced tag pairs to keep per collection. */
  keep = 4,
): CollectionRow[] {
  const titles = new Map<string, string>();
  for (const p of papers) {
    const id = p.id ?? p.paper_id;
    if (id) titles.set(String(id), p.title ?? p.name ?? String(id));
  }

  interface Acc {
    row: CollectionRow;
    units: Map<string, number>;
    tags: Map<string, { subject: string; chapter: string; count: number; sample: string }>;
  }
  const groups = new Map<string, Acc>();

  for (const q of questions) {
    const key = q?.paper_id ? String(q.paper_id) : NO_COLLECTION;
    let g = groups.get(key);
    if (!g) {
      g = {
        row: {
          id: key === NO_COLLECTION ? null : key,
          title: key === NO_COLLECTION ? 'Not in any collection' : (titles.get(key) ?? 'Unnamed collection'),
          total: 0,
          placed: 0,
          byUnit: [],
          difficulty: { easy: 0, medium: 0, hard: 0, untagged: 0 },
          unplaced: [],
        },
        units: new Map(),
        tags: new Map(),
      };
      groups.set(key, g);
    }

    g.row.total += 1;
    const d = asQuestionDifficulty(q?.difficulty);
    if (d) g.row.difficulty[d] += 1;
    else g.row.difficulty.untagged += 1;

    const ids = unitIdsOf(stage, q);
    if (ids.length > 0) {
      g.row.placed += 1;
      for (const id of ids) g.units.set(id, (g.units.get(id) ?? 0) + 1);
    } else {
      const subject = String(q?.subject ?? '').trim();
      const chapter = String(q?.chapter ?? q?.topic ?? '').trim();
      const tag = `${subject}\u0000${chapter}`;
      const hit = g.tags.get(tag);
      if (hit) hit.count += 1;
      else
        g.tags.set(tag, {
          subject,
          chapter,
          count: 1,
          sample: String(q?.text ?? q?.question_text ?? '').replace(/\s+/g, ' ').trim().slice(0, 110),
        });
    }
  }

  const rows = [...groups.values()].map(g => ({
    ...g.row,
    byUnit: [...g.units.entries()].map(([unitId, count]) => ({ unitId, count })).sort((a, b) => b.count - a.count),
    unplaced: [...g.tags.values()].sort((a, b) => b.count - a.count).slice(0, keep),
  }));

  // Collections with questions that landed nowhere first — they are what needs looking at.
  return rows.sort(
    (a, b) => b.total - b.placed - (a.total - a.placed) || a.title.localeCompare(b.title),
  );
}

/** Totals across every collection. */
export function mappingTotals(rows: CollectionRow[]): { total: number; placed: number } {
  return rows.reduce((t, r) => ({ total: t.total + r.total, placed: t.placed + r.placed }), { total: 0, placed: 0 });
}
