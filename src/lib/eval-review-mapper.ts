import type { ReviewQuestion } from '@/components/personal-assessments/QuestionReviewPanel';
import { stripInlineOptions, stripInlineOptionsFromTranslation } from '@/lib/question-text';
import { asQuestionDifficulty } from '@/lib/eval-difficulty';

/**
 * Generator output (`question_json` + `answer_key_json` from the job stream) ->
 * the review screen's questions.
 *
 * Carries `difficulty` and `subtopic` through. Dropping them here is what used
 * to make every saved question take the paper's level, whatever it was written
 * at, and flattened the report's sub-topic drilldown.
 */
export function mapGeneratedQuestions(questionJson: any[], answerKeyJson: any[] | null | undefined): ReviewQuestion[] {
  const answerKey: any[] = answerKeyJson || [];
  return questionJson.map((q: any) => {
    const ak = answerKey.find((a: any) => a.id === q.id);
    return {
      id: q.id,
      type: q.type,
      subtype: q.subtype,   // MCQ subtype from AI (e.g. 'standard', 'statement_based')
      // The generator sometimes repeats the choices inside the stem;
      // drop that run so the paper doesn't show them twice.
      text: stripInlineOptions(q.text, q.options),
      options: q.options,
      points: q.points || 1,
      pairs: q.pairs,
      correctAnswer: (() => {
        if (!ak) return undefined;
        if (q.type === 'mcq' && Array.isArray(q.options)) {
          const idx = q.options.indexOf(ak.correctAnswer);
          return idx >= 0 ? idx : ak.correctAnswer;
        }
        return ak.correctAnswer;
      })(),
      explanation: ak?.explanation,
      subject: q.subject,
      chapter: q.chapter,
      subtopic: q.subtopic ?? undefined,
      // The level this question was generated (and validated) at.
      difficulty: asQuestionDifficulty(q.difficulty),
      // Shared-passage grouping emitted by the backend (optional).
      passage: q.passage,
      group_id: q.group_id,
      // Bilingual payload — carried through review into /papers/save.
      translations: q.translations
        ? Object.fromEntries(
            Object.entries(q.translations).map(([lang, tr]) => [
              lang,
              stripInlineOptionsFromTranslation(tr as any),
            ]),
          )
        : undefined,
    };
  });
}
