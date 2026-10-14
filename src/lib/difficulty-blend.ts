/**
 * The difficulty mix a *whole* paper is built to.
 *
 * A paper pitched at one difficulty — "Indian Polity · Simple" — draws only Simple
 * questions. A paper that stands for the whole of something does not: a Full Unit
 * set, a full section set and a full mock each have to span the range the real
 * exam spans, or they test the aspirant on a slice of it and report a score that
 * means nothing.
 *
 * So those three are composed to a fixed blend rather than filtered to one level.
 */
import { distributeQuestions } from '@/lib/distribution-utils';
import { asQuestionDifficulty, type QuestionDifficulty } from '@/lib/eval-difficulty';

/**
 * 20 / 30 / 50 — Simple, Medium, Complex.
 *
 * Weighted towards the harder end on purpose: a paper that mirrors the exam has
 * to discriminate at the top, and a set that is mostly Simple flatters everyone
 * who sits it.
 */
export const FULL_PAPER_BLEND: Record<QuestionDifficulty, number> = {
  easy: 20,
  medium: 30,
  hard: 50,
};

/** How many of each difficulty a paper of `total` questions should hold. */
export function blendTargets(
  total: number,
  blend: Record<QuestionDifficulty, number> = FULL_PAPER_BLEND,
): Record<QuestionDifficulty, number> {
  const out = distributeQuestions(total, blend as unknown as Record<string, number>);
  return {
    easy: out.easy ?? 0,
    medium: out.medium ?? 0,
    hard: out.hard ?? 0,
  };
}

export interface BlendResult<T> {
  /** The chosen questions, ordered Simple → Medium → Complex. */
  picked: T[];
  /** What was asked for at each difficulty. */
  target: Record<QuestionDifficulty, number>;
  /** What the pool could actually supply. */
  taken: Record<QuestionDifficulty, number>;
  /** Bands the pool could not fill, and by how many. */
  shortfall: Partial<Record<QuestionDifficulty, number>>;
  /** True when every band was met exactly. */
  exact: boolean;
}

/**
 * Choose `total` questions from `pool` in the blend's proportions.
 *
 * Where a band runs short the rest is made up from the other bands rather than
 * returning a thin paper — an admin asking for 50 questions wants 50. The
 * shortfall is reported so the screen can say the mix was not available, which is
 * a question-bank problem the admin can act on.
 *
 * Untagged questions are used only as a last resort: they are not known to be
 * wrong for a band, but they are not known to be right either.
 */
export function pickByBlend<T extends { difficulty?: string | null }>(
  pool: T[],
  total: number,
  blend: Record<QuestionDifficulty, number> = FULL_PAPER_BLEND,
): BlendResult<T> {
  const target = blendTargets(total, blend);

  const banded: Record<QuestionDifficulty, T[]> = { easy: [], medium: [], hard: [] };
  const untagged: T[] = [];
  for (const q of pool) {
    const d = asQuestionDifficulty(q.difficulty);
    if (d) banded[d].push(q);
    else untagged.push(q);
  }

  const picked: T[] = [];
  const taken: Record<QuestionDifficulty, number> = { easy: 0, medium: 0, hard: 0 };
  const shortfall: Partial<Record<QuestionDifficulty, number>> = {};

  // Each band takes what it was asked for, up to what exists.
  (['easy', 'medium', 'hard'] as QuestionDifficulty[]).forEach(band => {
    const want = target[band];
    const got = banded[band].splice(0, want);
    picked.push(...got);
    taken[band] = got.length;
    if (got.length < want) shortfall[band] = want - got.length;
  });

  // Top up from whatever is left, hardest first, then the untagged.
  if (picked.length < total) {
    const leftovers = [...banded.hard, ...banded.medium, ...banded.easy, ...untagged];
    const extra = leftovers.slice(0, total - picked.length);
    picked.push(...extra);
    for (const q of extra) {
      const d = asQuestionDifficulty(q.difficulty);
      if (d) taken[d] += 1;
    }
  }

  return {
    picked,
    target,
    taken,
    shortfall,
    exact: Object.keys(shortfall).length === 0,
  };
}

/** "Simple 10 · Medium 15 · Complex 25" */
export function describeBlend(counts: Record<QuestionDifficulty, number>): string {
  return `Simple ${counts.easy} · Medium ${counts.medium} · Complex ${counts.hard}`;
}

/**
 * Why a Mixed paper cannot be built to the blend, in words an admin can act on.
 *
 * The shortfall used to surface as a toast after the paper was already made, and a
 * Mixed paper built from a bank that holds only Complex questions came out as fifty
 * Complex questions under a label that promises the opposite. This is shown before
 * the paper is created, and again as the thing to confirm.
 */
export function explainBlendShortfall(
  result: Pick<BlendResult<unknown>, 'target' | 'taken' | 'shortfall'>,
  total: number,
): string {
  const missing = (['easy', 'medium', 'hard'] as QuestionDifficulty[])
    .filter(band => (result.shortfall[band] ?? 0) > 0)
    .map(band => `${result.shortfall[band]} ${band === 'easy' ? 'Simple' : band === 'medium' ? 'Medium' : 'Complex'}`)
    .join(', ');
  return (
    `A Mixed paper is built ${describeBlend(result.target)} (${total} questions), but the questions ` +
    `available can supply only ${describeBlend(result.taken)} — short of ${missing}. It would not span ` +
    `the range its label promises. Grade questions at those levels in the Question Bank, or pick a ` +
    `single difficulty button instead.`
  );
}
