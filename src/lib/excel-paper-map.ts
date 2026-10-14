/**
 * An imported sheet's questions, as the review screen edits them.
 *
 * Lives outside the import panel so the one thing that must not go wrong here —
 * what survives from the sheet to the saved question — can be tested without
 * rendering a component.
 */
import type { ReviewQuestion } from '@/components/personal-assessments/QuestionReviewPanel';
import { marksForSubject, stageForExamType } from '@/config/tnpsc';
import { asQuestionDifficulty } from '@/lib/eval-difficulty';
import type { ExcelPaperAnswer, ExcelPaperQuestion } from '@/lib/excelPaperApi';

/**
 * Marks a question is worth by default, from the exam's section weighting.
 *
 * A paper whose sections are weighted differently (GAT-B: 1 mark at 10+2 level, 3 at
 * graduate level) can't use a flat default — the question's own subject decides. Falls
 * back to 1 for uniform papers and for subjects the catalog doesn't recognise, which
 * is what every TNPSC import gets.
 */
export function defaultPoints(examLabel: string, subject?: string | null): number {
  return marksForSubject(stageForExamType(examLabel), subject) ?? 1;
}

/** Excel payload → the shape the shared review panel edits. */
export function mapExcelPaper(
  items: ExcelPaperQuestion[],
  answers: ExcelPaperAnswer[],
  examLabel: string,
): ReviewQuestion[] {
  const keyById = new Map(answers.map(a => [a.id, a]));
  return items.map((q, i) => {
    const key = keyById.get(q.id);
    return {
      id: q.id || `xls_${i + 1}`,
      type: q.type || 'mcq',
      subtype: q.subtype,
      text: q.text || '',
      options: q.options,
      correctAnswer: key?.correctAnswer,
      explanation: key?.explanation,
      points: q.points ?? defaultPoints(examLabel, q.subject),
      subject: q.subject,
      chapter: q.chapter,
      subtopic: q.subtopic,
      /*
       * The sheet's Difficulty column. This was dropped here, and a question saved
       * without its own level takes the paper's — Medium, since nothing on the import
       * screen sets it — so a sheet of Simple questions arrived in the bank as Medium.
       *
       * Normalised to the stored vocabulary, because a sheet may say Simple, Complex
       * or Difficult and the save endpoint stores easy / medium / hard. A value that
       * is not recognised stays unset rather than guessed, so the review screen shows
       * it as needing a level instead of passing it off as Medium.
       */
      difficulty: asQuestionDifficulty(q.difficulty),
      passage: q.passage ?? undefined,
      group_id: q.group_id ?? undefined,
      translations: q.translations,
      confidence: key?.confidence,
      // Sheet numbers are strings ("1"), the badge wants a number.
      sourceNumber: q.source_number != null ? Number(q.source_number) || undefined : undefined,
      needsReview: q.needs_review ?? undefined,
    };
  });
}

/** "Take each row's own level from the sheet" — the alternative to choosing one for the lot. */
export const LEVEL_FROM_SHEET = 'sheet';

/**
 * Apply the level the admin chose on the import form.
 *
 * `sheet` leaves every question as it came, so a sheet's own per-row levels stand. Any
 * other choice sets that level on every question, replacing whatever the sheet said:
 * picking "Simple" for the import is an instruction, and honouring it for some rows
 * and not others would leave a paper nobody chose.
 */
export function applyLevelChoice(questions: ReviewQuestion[], choice: string): ReviewQuestion[] {
  if (choice === LEVEL_FROM_SHEET) return questions;
  const level = asQuestionDifficulty(choice);
  if (!level) return questions;
  return questions.map(q => ({ ...q, difficulty: level }));
}
