/**
 * Re-deriving a paper's difficulty and TNPSC level from the questions it holds.
 *
 * Two fields drift from the questions underneath them, for two different reasons:
 *
 *  - `difficulty` on the assessment was a *default* the create form never
 *    reconciled with the questions chosen, so papers built before that was fixed
 *    carry whatever the picker happened to be left on — usually "medium".
 *  - `tnpsc_level` was only ever set on mock tests, so practice papers have none
 *    at all, which is why the portal's Simple / Medium / Complex buttons sit
 *    empty next to units that do have papers.
 *
 * Neither can be repaired from the stored values — the stored values *are* the
 * problem. The questions are the only honest source, so everything here reads
 * them and proposes; nothing is written without the admin confirming.
 */
import { DIFFICULTY_TO_LEVEL, type TnpscLevel } from '@/config/tnpsc';

/** The difficulty a question declares, normalised. */
export type QuestionDifficulty = string;

/**
 * The collection the API assembles on the fly out of manually-added questions.
 *
 * `GET /evaluation/papers` returns it like any other row, but there is no paper
 * behind it — so there is nowhere to store a difficulty or a level, and the
 * backend answers `409 CUSTOM_PAPER_NOT_EDITABLE` to any attempt. It is left out
 * of the scan rather than offered as a change that can never be applied.
 */
export const VIRTUAL_PAPER_ID = 'custom-questions';

export function isVirtualPaper(paper: { id?: string } | null | undefined): boolean {
  return paper?.id === VIRTUAL_PAPER_ID;
}

/**
 * True when the backend refused because the collection cannot hold these fields.
 *
 * Matched three ways on purpose: `toRequestError` lifts `detail.code`, while this
 * endpoint answers `error_code`, so neither alone is reliable — and the status is
 * what survives either spelling.
 */
export function isNotEditableError(err: unknown): boolean {
  const e = err as { status?: number; code?: string; detail?: { error_code?: string } } | null;
  if (!e) return false;
  if (e.status === 409) return true;
  return (
    e.code === 'CUSTOM_PAPER_NOT_EDITABLE' || e.detail?.error_code === 'CUSTOM_PAPER_NOT_EDITABLE'
  );
}

/**
 * Whether a write actually took, judged from the row the server sent back.
 *
 * A 200 means the request was understood, not that the field was stored — a
 * server that ignores keys it does not know answers 200 and changes nothing, and
 * a tool that trusts the status reports success over untouched rows.
 *
 *  - `applied`  — the response carries the field and it matches.
 *  - `ignored`  — the response carries the field and it does not match.
 *  - `unknown`  — the response does not say, so nothing can be concluded.
 */
export function writeOutcome(
  response: unknown,
  field: 'difficulty' | 'tnpsc_level',
  expected: string,
): 'applied' | 'ignored' | 'unknown' {
  const row = response as Record<string, unknown> | null | undefined;
  if (!row || typeof row !== 'object') return 'unknown';
  // Presence of the key is the signal, not its value: a row that echoes
  // `tnpsc_level: null` is the clearest possible "ignored", and `??` would have
  // read that null as "not sent" and said unknown.
  const key = field in row ? field : field === 'tnpsc_level' && 'level' in row ? 'level' : null;
  if (key === null) return 'unknown';
  const got = row[key];
  const a = typeof got === 'string' ? got.trim().toLowerCase() : '';
  const b = expected.trim().toLowerCase();
  if (field === 'difficulty') {
    return normaliseDifficulty(a) === normaliseDifficulty(b) ? 'applied' : 'ignored';
  }
  return a === b ? 'applied' : 'ignored';
}

/** easy/simple, hard/complex — the two vocabularies compared as one. */
function normaliseDifficulty(v: string): string {
  if (v === 'simple') return 'easy';
  if (v === 'complex' || v === 'difficult') return 'hard';
  if (v === 'moderate') return 'medium';
  return v;
}

export interface DifficultyMix {
  /** How many questions declared each difficulty, keyed by the normalised value. */
  counts: Record<string, number>;
  /** Questions that declared nothing. */
  unknown: number;
  total: number;
  /** Unanimous → that value. More than one → 'mixed'. None → null. */
  verdict: string | null;
  /** The single most common declared difficulty, even when the paper is mixed. */
  dominant: string | null;
}

const norm = (v: unknown): string => (typeof v === 'string' ? v.trim().toLowerCase() : '');

/**
 * What a set of questions actually is.
 *
 * `verdict` is what the paper should record as its difficulty; `dominant` is what
 * a level has to be chosen from when the paper is genuinely mixed, since a level
 * is one of three and "mixed" is not one of them.
 */
export function difficultyMix(questions: Array<{ difficulty?: string | null }>): DifficultyMix {
  const counts: Record<string, number> = {};
  let unknown = 0;

  for (const q of questions) {
    const d = norm(q?.difficulty);
    if (!d) unknown += 1;
    else counts[d] = (counts[d] ?? 0) + 1;
  }

  const declared = Object.keys(counts);
  const dominant =
    declared.length === 0
      ? null
      : declared.reduce((best, k) => (counts[k] > counts[best] ? k : best), declared[0]);

  return {
    counts,
    unknown,
    total: questions.length,
    verdict: declared.length === 0 ? null : declared.length === 1 ? declared[0] : 'mixed',
    dominant,
  };
}

/**
 * The TNPSC level a paper belongs at.
 *
 * A mixed paper takes its *dominant* difficulty rather than being refused one:
 * every paper has to sit under some button, and the level a majority of its
 * questions justify is the least wrong answer. `DIFFICULTY_TO_LEVEL` already
 * knows the vocabularies apart — questions are easy/medium/hard, levels are
 * simple/medium/complex.
 */
export function levelFor(mix: DifficultyMix): TnpscLevel | null {
  const source = mix.verdict === 'mixed' ? mix.dominant : mix.verdict;
  if (!source) return null;
  return DIFFICULTY_TO_LEVEL[source] ?? null;
}

/** A one-line account of what the scan found, for the review table. */
export function describeMix(mix: DifficultyMix): string {
  if (mix.total === 0) return 'No questions';
  const parts = Object.entries(mix.counts)
    .sort((a, b) => b[1] - a[1])
    .map(([d, n]) => `${n}× ${d}`);
  if (mix.unknown > 0) parts.push(`${mix.unknown} untagged`);
  return parts.join(' · ');
}

export interface ReclassifyRow {
  id: string;
  title: string;
  /** What the paper records today. */
  currentDifficulty: string | null;
  currentLevel: TnpscLevel | null;
  /** What its questions say — null until scanned. */
  mix: DifficultyMix | null;
  proposedDifficulty: string | null;
  proposedLevel: TnpscLevel | null;
  /** Why this row is worth acting on, or null when nothing would change. */
  change: 'difficulty' | 'level' | 'both' | null;
  error?: string;
}

/** What a scanned paper would change, if anything. */
export function changeOf(
  row: Pick<ReclassifyRow, 'currentDifficulty' | 'currentLevel' | 'proposedDifficulty' | 'proposedLevel'>,
): ReclassifyRow['change'] {
  const d =
    !!row.proposedDifficulty && norm(row.proposedDifficulty) !== norm(row.currentDifficulty ?? '');
  const l = !!row.proposedLevel && row.proposedLevel !== row.currentLevel;
  if (d && l) return 'both';
  if (d) return 'difficulty';
  if (l) return 'level';
  return null;
}

/**
 * Run `task` over `items`, `limit` at a time.
 *
 * A scan is one request per paper, and a few hundred papers fired at once is a
 * way to be rate-limited or to hang the browser. Results keep the input order so
 * the review table does not reshuffle as it fills.
 */
export async function mapLimit<T, R>(
  items: T[],
  limit: number,
  task: (item: T, index: number) => Promise<R>,
  onProgress?: (done: number, total: number) => void,
): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  let done = 0;

  const worker = async () => {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      out[i] = await task(items[i], i);
      done += 1;
      onProgress?.(done, items.length);
    }
  };

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}
