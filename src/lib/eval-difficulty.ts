/**
 * One difficulty vocabulary for the whole product: **Simple · Medium · Complex**.
 *
 * There used to be two. Questions and papers were `easy | medium | hard`, while
 * the TNPSC level a paper sits behind in the aspirant portal was `simple | medium
 * | complex` — so the same paper read "Hard" on the admin screen and "Complex" on
 * the portal, and anything comparing the two had to know a mapping. Everything
 * now says Simple / Medium / Complex.
 *
 * **Stored values are still `easy | medium | hard`** (plus `mixed` for a whole
 * paper). That is what the question bank holds and what the API filters on, so
 * flipping it unilaterally would quietly stop `?difficulty=hard` matching
 * anything. The conversion lives here and nowhere else: read through
 * `asQuestionDifficulty`, write through `toStored`, label through
 * `difficultyLabel`. When the backend accepts the TNPSC words (see
 * TNPSC_RECLASSIFY.md §2.2) `STORAGE_VOCABULARY` is the one line to change.
 */

/** The value shape persisted today. */
export type QuestionDifficulty = 'easy' | 'medium' | 'hard';

/** What this product calls those three, everywhere a human reads them. */
export type DifficultyLevel = 'simple' | 'medium' | 'complex';

export const QUESTION_DIFFICULTIES: QuestionDifficulty[] = ['easy', 'medium', 'hard'];

/** Flip to 'tnpsc' once the API accepts simple/medium/complex. */
const STORAGE_VOCABULARY: 'legacy' | 'tnpsc' = 'legacy';

const STORED_TO_LEVEL: Record<QuestionDifficulty, DifficultyLevel> = {
  easy: 'simple',
  medium: 'medium',
  hard: 'complex',
};

const LEVEL_TO_STORED: Record<DifficultyLevel, QuestionDifficulty> = {
  simple: 'easy',
  medium: 'medium',
  complex: 'hard',
};

export const DIFFICULTY_LABELS: Record<string, string> = {
  easy: 'Simple',
  simple: 'Simple',
  medium: 'Medium',
  moderate: 'Medium',
  hard: 'Complex',
  complex: 'Complex',
  difficult: 'Complex',
  mixed: 'Mixed',
};

/** Tailwind classes for a difficulty pill, keyed by the stored value. */
export const DIFFICULTY_PILL: Record<QuestionDifficulty, string> = {
  easy: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
  medium: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
  hard: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800',
};

/** Pill classes for any spelling of a difficulty, stored or TNPSC. */
export function difficultyPill(value: string | null | undefined): string {
  const stored = asQuestionDifficulty(value);
  return stored ? DIFFICULTY_PILL[stored] : 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-700';
}

/** "hard" → "Complex", "simple" → "Simple". Anything unknown is shown as given. */
export function difficultyLabel(value: string | null | undefined): string {
  if (!value) return '—';
  const key = value.trim().toLowerCase();
  return DIFFICULTY_LABELS[key] ?? value;
}

/**
 * Any spelling of a difficulty, normalised to the stored vocabulary.
 *
 * Accepts both because the two have coexisted: a question imported last year says
 * `hard`, one tagged through the portal's level says `complex`, and a spreadsheet
 * may say `difficult`. All three are the same thing.
 */
export function asQuestionDifficulty(value: unknown): QuestionDifficulty | undefined {
  const v = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (!v) return undefined;
  if (v === 'simple') return 'easy';
  if (v === 'complex' || v === 'difficult') return 'hard';
  if (v === 'moderate') return 'medium';
  return (QUESTION_DIFFICULTIES as string[]).includes(v) ? (v as QuestionDifficulty) : undefined;
}

/** The TNPSC level a difficulty corresponds to, whatever spelling came in. */
export function asDifficultyLevel(value: unknown): DifficultyLevel | undefined {
  const stored = asQuestionDifficulty(value);
  return stored ? STORED_TO_LEVEL[stored] : undefined;
}

/**
 * The value to send to the API.
 *
 * Callers work in Simple / Medium / Complex; this is the one place that knows
 * what the backend currently expects.
 */
export function toStored(level: DifficultyLevel): string {
  return STORAGE_VOCABULARY === 'tnpsc' ? level : LEVEL_TO_STORED[level];
}

/**
 * The options a difficulty selector offers: the value to store, the label to show.
 *
 * Every picker in the product builds from this, so none of them can drift into
 * calling the top level "Hard" again.
 */
export const DIFFICULTY_OPTIONS: Array<{ value: string; label: string }> = (
  ['simple', 'medium', 'complex'] as DifficultyLevel[]
).map(level => ({ value: toStored(level), label: DIFFICULTY_LABELS[level] }));

/** The same options plus "Mixed", for a whole paper rather than one question. */
export const PAPER_DIFFICULTY_OPTIONS: Array<{ value: string; label: string }> = [
  ...DIFFICULTY_OPTIONS,
  { value: 'mixed', label: DIFFICULTY_LABELS.mixed },
];

/** How many questions sit at each level. Untagged questions are not counted. */
export function countByDifficulty(
  questions: { difficulty?: string | null }[],
): Record<QuestionDifficulty, number> {
  const counts: Record<QuestionDifficulty, number> = { easy: 0, medium: 0, hard: 0 };
  for (const q of questions) {
    const level = asQuestionDifficulty(q.difficulty);
    if (level) counts[level] += 1;
  }
  return counts;
}

/** "Simple 0 · Medium 0 · Complex 50" */
export function formatDifficultySummary(questions: { difficulty?: string | null }[]): string {
  const counts = countByDifficulty(questions);
  return QUESTION_DIFFICULTIES.map(level => `${DIFFICULTY_LABELS[level]} ${counts[level]}`).join(' · ');
}

/**
 * The level a whole paper is saved at, from the questions it holds.
 *
 * The import screen used to send one fixed "medium" for every paper, whatever its
 * questions said. A paper whose questions are all one level is that level; one that
 * spans several is `mixed`; one with no levels at all keeps the fallback, since
 * there is nothing to go on.
 */
export function paperDifficultyFor(
  questions: { difficulty?: string | null }[],
  fallback: string,
): string {
  const levels = questions.map(q => asQuestionDifficulty(q.difficulty));
  const tagged = levels.filter((l): l is QuestionDifficulty => !!l);
  if (tagged.length === 0) return fallback;
  const allTagged = tagged.length === levels.length;
  return allTagged && new Set(tagged).size === 1 ? tagged[0] : 'mixed';
}
