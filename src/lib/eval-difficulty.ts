/**
 * Question-difficulty vocabulary for the evaluation generator and review screen.
 *
 * Stored values stay `easy | medium | hard` (plus `mixed` for a whole paper);
 * admins see the TNPSC portal's wording, "Simple" for easy.
 */

export type QuestionDifficulty = 'easy' | 'medium' | 'hard';

export const QUESTION_DIFFICULTIES: QuestionDifficulty[] = ['easy', 'medium', 'hard'];

export const DIFFICULTY_LABELS: Record<string, string> = {
  easy: 'Simple',
  medium: 'Medium',
  hard: 'Hard',
  mixed: 'Mixed',
};

/** Tailwind classes for a per-question difficulty pill. */
export const DIFFICULTY_PILL: Record<QuestionDifficulty, string> = {
  easy: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
  medium: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
  hard: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800',
};

/** "easy" -> "Simple"; anything unknown is shown as given. */
export function difficultyLabel(value: string | null | undefined): string {
  if (!value) return '—';
  return DIFFICULTY_LABELS[value.toLowerCase()] ?? value;
}

/** A question's level if it is one of the three, else undefined. */
export function asQuestionDifficulty(value: unknown): QuestionDifficulty | undefined {
  const v = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (v === 'simple') return 'easy';
  if (v === 'complex') return 'hard';
  return (QUESTION_DIFFICULTIES as string[]).includes(v) ? (v as QuestionDifficulty) : undefined;
}

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

/** "Simple 0 · Medium 0 · Hard 50" */
export function formatDifficultySummary(questions: { difficulty?: string | null }[]): string {
  const counts = countByDifficulty(questions);
  return QUESTION_DIFFICULTIES.map(level => `${DIFFICULTY_LABELS[level]} ${counts[level]}`).join(' · ');
}
