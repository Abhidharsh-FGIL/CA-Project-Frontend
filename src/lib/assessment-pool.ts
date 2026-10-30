/**
 * How an assessment describes the questions it draws from — sent with it when it is created.
 *
 * An assessment is stored with the list of question ids it was made from, and each attempt is
 * sampled from that list. The list is a photograph of the bank on the day the paper was made: a
 * question uploaded afterwards is not in it, and one whose collection was since deleted still is.
 *
 * A paper that was made as a *pool* — "any 30 of the Medium Aptitude questions" — is not really a
 * fixed set at all, so it says so: `pool_mode: 'live'`, with a `pool_filter` that states the rule
 * the pool was made by. A server that reads it draws each attempt from the stored list **plus**
 * whatever in the bank matches that rule when the attempt starts; one that does not simply keeps
 * using the list, which is sent as before. See BACKEND_LIVE_POOL.md §C.
 *
 * A paper that is *composed* — built to the exam's split and 20/30/50 blend, or taken in a fixed
 * order — is a particular set of questions, and stays `fixed`.
 *
 * What counts as "matching" is decided on the server, from three things this rule carries:
 *
 *  - `unit_ids` — a question tagged to one of those units (exact; what a sheet with a Unit column gets);
 *  - `subjects` + `chapters` — a question with *no* unit, of a subject and topic the paper already
 *    holds. A question an admin adds by hand has a subject and a topic and no unit; this is how it
 *    finds the paper that its neighbours are in;
 *  - `paper_ids` — a pool made of whole collections.
 */
import type { QuestionDifficulty } from '@/lib/eval-difficulty';

export type PoolMode = 'fixed' | 'live';

/** A unit id without its exam prefix: "gs-general-science" for both `g2-gs-general-science` and `g4-gs-general-science`. */
const unitFamily = (id: string): string => id.replace(/^g\d+-/, '');

/**
 * A unit id as the stage itself lists it.
 *
 * Each stage has its own unit ids on the server (`GET /syllabus/{exam}/{stage}`): Group 2 Prelims'
 * General Science is `g2-gs-general-science`, and `g4-gs-general-science` is refused there. An id the
 * stage lists passes through; one it does not is swapped for the stage's unit of the same family; with
 * no list to check against (the syllabus could not be read), ids pass through unchanged.
 */
export function stageUnitId(id: string, stageIds: readonly string[] | null | undefined): string {
  if (!stageIds?.length || stageIds.includes(id)) return id;
  return stageIds.find(s => unitFamily(s) === unitFamily(id)) ?? id;
}

/** A list of unit ids as the stage lists them, each once. */
export const stageUnitIds = <T extends string[] | null | undefined>(ids: T, stageIds: readonly string[] | null | undefined): T =>
  (ids ? [...new Set(ids.map(id => stageUnitId(id, stageIds)))] : ids) as T;

/** Weights keyed by unit id, re-keyed the same way. */
export const stageUnitWeights = <T extends Record<string, number> | undefined>(
  weights: T,
  stageIds: readonly string[] | null | undefined,
): T =>
  (weights
    ? Object.fromEntries(Object.entries(weights).map(([id, w]) => [stageUnitId(id, stageIds), w]))
    : weights) as T;

/** The rule a pool was made by. */
export interface PoolFilter {
  /** The exam stage whose syllabus the units belong to. Context only — not a filter. */
  stage_id: string | null;
  /** Published syllabus units the paper is placed on. */
  unit_ids: string[] | null;
  /** The subjects the paper's questions carry, as stored on them. Used with `chapters`. */
  subjects: string[] | null;
  /** The topics the paper's questions carry, as stored on them. Used with `subjects`. */
  chapters: string[] | null;
  /** Collections (papers) the questions come from, when the pool is whole collections. */
  paper_ids: string[] | null;
  /** The one difficulty the pool is held to, as stored on a question; null for any. */
  difficulty: QuestionDifficulty | null;
  question_types: string[] | null;
  /** The bank's source filter (`online` | `text` | `file`); null for any source. */
  source_type: string | null;
}

export interface PoolInput {
  /** Where the questions come from: the question bank, or the questions of chosen collections. */
  source: 'bank' | 'paper';
  /** Each attempt draws its own questions rather than every student getting the same set. */
  shuffle: boolean;
  /** The paper is built to the exam's split and blend — a composed set, not a pool. */
  composed: boolean;
  stageId?: string | null;
  unitIds?: string[];
  paperIds?: string[];
  difficulty?: QuestionDifficulty | null;
  questionTypes?: string[];
  sourceType?: string | null;
  /** The questions the paper holds — read for the subjects and topics they carry. */
  questions?: Array<{ subject?: string | null; chapter?: string | null }>;
}

const orNull = <T>(list: T[] | undefined): T[] | null => (list && list.length > 0 ? list : null);

/** The distinct, non-blank values, keeping the first spelling of each (the server compares lower-cased). */
function distinct(values: Array<string | null | undefined>): string[] {
  const seen = new Map<string, string>();
  for (const v of values) {
    const text = (v ?? '').trim();
    if (text && !seen.has(text.toLowerCase())) seen.set(text.toLowerCase(), text);
  }
  return [...seen.values()];
}

/**
 * Whether the paper is a live pool and, if so, the rule behind it.
 *
 * Fixed — and no filter — unless the paper draws a fresh sample for every attempt from a pool
 * that was chosen by a rule. A pool with nothing to say about which questions belong has no rule
 * to state, so it is fixed too.
 */
export function describePool(input: PoolInput): { mode: PoolMode; filter: PoolFilter | null } {
  const fixed = { mode: 'fixed' as const, filter: null };
  if (!input.shuffle || input.composed) return fixed;

  const fromBank = input.source === 'bank';
  const subjects = fromBank ? orNull(distinct((input.questions ?? []).map(q => q.subject))) : null;
  const chapters = fromBank ? orNull(distinct((input.questions ?? []).map(q => q.chapter))) : null;

  const filter: PoolFilter = {
    stage_id: input.stageId ?? null,
    unit_ids: fromBank ? orNull(input.unitIds) : null,
    // Only meaningful together: a subject alone ("Aptitude & Mental Ability") spans both the
    // Aptitude and Reasoning units, so it cannot say which a new question belongs to.
    subjects: subjects && chapters ? subjects : null,
    chapters: subjects && chapters ? chapters : null,
    paper_ids: !fromBank ? orNull(input.paperIds) : null,
    difficulty: fromBank ? (input.difficulty ?? null) : null,
    question_types: fromBank ? orNull(input.questionTypes) : null,
    source_type: fromBank ? (input.sourceType ?? null) : null,
  };

  const ruled = filter.unit_ids || filter.paper_ids || (filter.subjects && filter.chapters);
  return ruled ? { mode: 'live', filter } : fixed;
}
