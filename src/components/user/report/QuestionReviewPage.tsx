/**
 * "Question Review" (mockup screen 5) — one question, with prev/next through
 * the rest of its subject's question list.
 *
 * Simplified per the report redesign: "Why your answer is incorrect" (a
 * templated restatement, not real content), "Concept to remember" and
 * "Common trap" (both placeholder — no backend field ever existed for
 * either, just a fixed 3-item pool picked by hashing the question id) are
 * all removed. The one real, question-grounded thing this screen had —
 * "Why the correct answer is right", from `explanation`/`tip` — is now the
 * only card, shown for every question regardless of whether the answer was
 * right, wrong, or skipped, instead of being duplicated/varied by outcome.
 *
 * A bilingual paper (TNPSC prints Parts B and C in Tamil and English) carries
 * the second language under `translations`, index-aligned with `options`. This
 * screen reads English by default and offers a toggle back to the language the
 * paper was written in. The toggle appears only on a paper that actually
 * carries both — a control that changes nothing on screen teaches the reader to
 * distrust the ones that do.
 */
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronLeft, ChevronRight, CheckCircle2, XCircle, Sparkles } from 'lucide-react';
import type { AttemptReportModel, SubjectNode } from '@/lib/attempt-report';
import { answerLetter, isAttempted } from '@/components/user/report/SubjectQuestionsPage';
import { ReportCard } from '@/components/user/report-ui';
import {
  defaultLangMode,
  langToggleOptions,
  paperTranslationLang,
  questionCopyForMode,
  type SingleLangMode,
} from '@/lib/question-language';
import { plainText } from '@/lib/question-text';
import { cn } from '@/lib/utils';

export function QuestionReviewPage({
  model,
  subject,
  questionId,
}: {
  model: AttemptReportModel;
  subject: SubjectNode;
  questionId: string;
}) {
  const navigate = useNavigate();
  const attemptId = model.meta.attemptId;

  const subjectQuestions = useMemo(
    () =>
      model.questions
        .filter(q => subject.questionIds.includes(q.question_id))
        .sort((a, b) => a.number - b.number),
    [model.questions, subject.questionIds],
  );

  const currentIndex = subjectQuestions.findIndex(q => q.question_id === questionId);
  const q = subjectQuestions[currentIndex];

  /**
   * The language this paper can be switched into, read across the whole
   * attempt rather than the question on screen: a single question missing its
   * translation must not make the toggle flicker away as the reader pages past
   * it. `questionCopyForMode` falls back per field, so the toggle stays
   * harmless on such a question.
   */
  const trLang = useMemo(
    () => paperTranslationLang(model.questions ?? [], x => x.body),
    [model.questions],
  );
  // Null until the reader chooses, rather than seeded from `trLang` — `trLang`
  // is only known once the model has loaded, and seeding state from it would
  // need an effect to correct itself afterwards.
  const [chosenMode, setChosenMode] = useState<SingleLangMode | null>(null);
  const langMode = chosenMode ?? defaultLangMode(trLang);

  const goTo = (i: number) => {
    const target = subjectQuestions[i];
    if (target) navigate(`/user/report/${attemptId}/subjects/${subject.subjectId}/questions/${target.question_id}`);
  };

  if (!q) {
    return (
      <div className="p-4 sm:p-6 max-w-4xl mx-auto">
        <p className="text-sm text-gray-500 dark:text-gray-400">This question wasn't found on this attempt.</p>
      </div>
    );
  }

  const attempted = isAttempted(q);
  // Letters are resolved against the ORIGINAL options, never the translated
  // ones: `answerLetter` can match an answer stored as the option's own text,
  // and that text is in the language the paper was written in.
  const userLetter = answerLetter(q.user_answer, q.options);
  const correctLetter = answerLetter(q.correct_answer, q.options);

  const copy = questionCopyForMode(
    q.translations,
    { body: q.body, options: q.options, explanation: q.explanation },
    trLang,
    langMode,
  );
  const explanation =
    plainText(copy.explanation) || plainText(q.tip) || 'No explanation was recorded for this question.';

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          onClick={() => navigate(`/user/report/${attemptId}/subjects/${subject.subjectId}/questions`)}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Question Insights
        </button>
        <div className="inline-flex items-center gap-2">
          {trLang && (
            <div
              role="group"
              aria-label="Question language"
              className="inline-flex items-center rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden mr-1"
            >
              {langToggleOptions(trLang).map(o => (
                <button
                  key={o.mode}
                  type="button"
                  onClick={() => setChosenMode(o.mode)}
                  aria-pressed={langMode === o.mode}
                  className={cn(
                    'text-[11px] font-semibold px-2.5 py-1 transition-colors',
                    langMode === o.mode
                      ? 'bg-indigo-600 text-white'
                      : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800',
                  )}
                >
                  {o.label}
                </button>
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={() => goTo(currentIndex - 1)}
            disabled={currentIndex <= 0}
            className="w-7 h-7 rounded-lg border border-gray-200 dark:border-gray-700 flex items-center justify-center text-gray-500 disabled:opacity-30 hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-[12px] font-semibold text-gray-600 dark:text-gray-300 whitespace-nowrap">
            Question {currentIndex + 1} of {subjectQuestions.length}
          </span>
          <button
            type="button"
            onClick={() => goTo(currentIndex + 1)}
            disabled={currentIndex >= subjectQuestions.length - 1}
            className="w-7 h-7 rounded-lg border border-gray-200 dark:border-gray-700 flex items-center justify-center text-gray-500 disabled:opacity-30 hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1.6fr_1fr] gap-4 items-start">
        <ReportCard>
          {/* whitespace-pre-wrap: a stem that the paper set across several
              lines — assertion/reason, match-the-following, a quoted passage —
              keeps them. */}
          <p className="text-[13px] font-bold text-[#1e2a5a] dark:text-gray-100 mb-3 whitespace-pre-wrap">
            Q{q.number}. {plainText(copy.body)}
          </p>
          <div className="space-y-2">
            {(copy.options ?? []).map((opt, i) => {
              const letter = String.fromCharCode(65 + i);
              const isUser = attempted && letter === userLetter;
              const isCorrect = letter === correctLetter;
              return (
                <div
                  key={i}
                  className={cn(
                    'flex items-center gap-2.5 rounded-xl border px-3 py-2',
                    isCorrect
                      ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/60 dark:bg-emerald-950/25'
                      : isUser
                        ? 'border-rose-200 dark:border-rose-800 bg-rose-50/60 dark:bg-rose-950/25'
                        : 'border-gray-100 dark:border-gray-800',
                  )}
                >
                  <span
                    className={cn(
                      'flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold',
                      isCorrect
                        ? 'bg-emerald-500 text-white'
                        : isUser
                          ? 'bg-rose-500 text-white'
                          : 'border border-gray-300 dark:border-gray-600 text-gray-400',
                    )}
                  >
                    {isCorrect ? <CheckCircle2 className="w-3.5 h-3.5" /> : isUser ? <XCircle className="w-3.5 h-3.5" /> : letter}
                  </span>
                  <span className="flex-1 text-[12px] text-gray-700 dark:text-gray-200 whitespace-pre-wrap">{plainText(opt)}</span>
                  {isUser && (
                    <span className="flex-shrink-0 text-[10px] font-bold text-rose-600 dark:text-rose-400 bg-white dark:bg-gray-900 rounded-md px-2 py-0.5">
                      Your Answer
                    </span>
                  )}
                  {isCorrect && (
                    <span className="flex-shrink-0 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-white dark:bg-gray-900 rounded-md px-2 py-0.5">
                      Correct Answer
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </ReportCard>

        <ReportCard className="space-y-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Topic</p>
            <p className="text-[13px] font-semibold text-gray-800 dark:text-gray-100">{q.topic || subject.name}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Difficulty</p>
            <p className="text-[13px] font-semibold text-amber-600 dark:text-amber-400 capitalize">{q.difficulty || '—'}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Your Answer</p>
            <p className={cn('text-[13px] font-bold', attempted ? 'text-rose-600 dark:text-rose-400' : 'text-gray-400')}>
              {attempted ? userLetter : 'Not attempted'}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Correct Answer</p>
            <p className="text-[13px] font-bold text-emerald-600 dark:text-emerald-400">{correctLetter}</p>
          </div>
        </ReportCard>
      </div>

      <ReportCard>
        <p className="inline-flex items-center gap-1.5 text-[12px] font-bold text-emerald-600 dark:text-emerald-400 mb-1.5">
          <CheckCircle2 className="w-3.5 h-3.5" /> {attempted ? 'Why the correct answer is right' : 'This question was not attempted — why the correct answer is right'}
        </p>
        {/* The card this screen exists for. Explanations arrive as structured
            prose — verdict, concept section, bullets, "why the others are
            wrong", exam tip — and every one of those breaks is a `
` that a
            default `<p>` would collapse away. */}
        <p className="text-[11px] leading-relaxed text-gray-600 dark:text-gray-300 whitespace-pre-wrap">
          {explanation}
        </p>
      </ReportCard>

      <ReportCard className="flex flex-wrap items-center justify-between gap-3 bg-indigo-50/70 dark:bg-indigo-950/30 border-indigo-100 dark:border-indigo-900">
        <div>
          <p className="text-[12px] font-bold text-gray-900 dark:text-gray-100">Want to practise more?</p>
          <p className="text-[11px] text-gray-600 dark:text-gray-300">Take a short practice test on this concept.</p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/user/practice')}
          className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-xs font-semibold px-3.5 py-2 hover:from-indigo-700 hover:to-purple-700 transition-all whitespace-nowrap"
        >
          <Sparkles className="w-3.5 h-3.5" /> Start Practice
        </button>
      </ReportCard>
    </div>
  );
}
