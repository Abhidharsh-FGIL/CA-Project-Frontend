/**
 * Which questions a new assessment can draw on.
 *
 * Two rules used to decide this by exact string and by a field the admin never
 * meant as a filter, and both emptied the pool without saying why:
 *
 *  - **Subject.** The picker offers the syllabus's names ("Geography of India");
 *    the bank holds whatever the import tagged ("Geography"). Comparing the two
 *    as strings matched nothing, so an exam-scoped picker could not select a
 *    single question that was in fact there.
 *  - **Difficulty.** "Default Difficulty" was sent to the server as a filter, so
 *    leaving it on Medium quietly hid every Complex question — and the label
 *    called it a fallback.
 */
import { resolveSubjectId, type TnpscStage } from '@/config/tnpsc';
import { asQuestionDifficulty, toStored, type QuestionDifficulty } from '@/lib/eval-difficulty';
import type { TnpscTagValue } from '@/lib/tnpscAdminApi';

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

/**
 * Whether two subject labels name the same subject.
 *
 * Exact after normalising, or — where a stage is known — both resolving to the
 * same syllabus subject, which is how "Geography", "Geography of India" and the
 * Tamil printed name all land on one. Without a stage there is nothing to resolve
 * against, so only the plain comparison applies.
 */
export function sameSubject(
  stage: TnpscStage | undefined,
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  if (!a || !b) return false;
  if (norm(a) === norm(b)) return true;
  if (!stage) return false;
  const ia = resolveSubjectId(stage, a);
  const ib = resolveSubjectId(stage, b);
  return !!ia && ia === ib;
}

/** Whether a question belongs to any of the chosen subjects. */
export function inSelectedSubjects(
  stage: TnpscStage | undefined,
  questionSubject: string | null | undefined,
  selected: string[],
): boolean {
  if (selected.length === 0) return true;
  return selected.some(s => sameSubject(stage, questionSubject, s));
}

/**
 * The one difficulty the pool must be restricted to, or null for "any".
 *
 * Decided by what the paper is, not by the default picker:
 *  - a unit paper pitched at one level draws only that level;
 *  - a paper that stands for the whole of something (an exam, a section, a Full
 *    Unit) is composed across the range afterwards, so the pool must not be
 *    narrowed first — narrowing it to Medium and *then* asking for 20/30/50
 *    can only ever fail;
 *  - with no TNPSC placement, the old behaviour stands: the picker is the filter.
 */
export function poolDifficulty(
  tag: Pick<TnpscTagValue, 'track' | 'scope' | 'level'>,
  fallback: string,
): QuestionDifficulty | null {
  if (tag.track === 'mock') return null;
  if (tag.track === 'practice') {
    if (tag.scope === 'unit' && tag.level) return asQuestionDifficulty(toStored(tag.level)) ?? null;
    return null;
  }
  return fallback && fallback !== 'all' ? (asQuestionDifficulty(fallback) ?? null) : null;
}

export function matchesDifficulty(
  question: { difficulty?: string | null },
  wanted: QuestionDifficulty | null,
): boolean {
  if (!wanted) return true;
  return asQuestionDifficulty(question.difficulty) === wanted;
}

/** How many questions sit at each difficulty; undeclared ones counted apart. */
export function difficultySpread(questions: Array<{ difficulty?: string | null }>): {
  easy: number;
  medium: number;
  hard: number;
  untagged: number;
} {
  const out = { easy: 0, medium: 0, hard: 0, untagged: 0 };
  for (const q of questions) {
    const d = asQuestionDifficulty(q.difficulty);
    if (d) out[d] += 1;
    else out.untagged += 1;
  }
  return out;
}
