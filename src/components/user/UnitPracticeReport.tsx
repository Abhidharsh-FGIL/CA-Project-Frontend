/**
 * The report for a practice set on one unit.
 *
 * Deliberately not the diagnostic report with panels switched off. A unit set is
 * a short, repeatable exercise — thirty questions, one unit, usually one
 * difficulty — and the questions an aspirant has after sitting one are small and
 * concrete: did I pass, which ones did I get wrong, and what do I do next. The
 * diagnostic report answers none of those quickly, because it was built to
 * compare twelve subjects and three difficulties against a syllabus.
 *
 * So this is a recap, not a diagnosis: a verdict line, four numbers, the topics
 * inside the unit if there is more than one, every question, and the next thing
 * to do.
 */
import { useMemo, useState } from 'react';
import { ChevronDown, CheckCircle2, Circle, Clock, MinusCircle, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ACCENT, MeterRow, ReportCard, ScoreRing, StatTile } from '@/components/user/report-ui';
import { isAttempted, type AttemptReportModel } from '@/lib/attempt-report';
import type { QuestionReviewItem } from '@/lib/userPortalApi';
import { MathText } from '@/components/ui/MathText';
import { normaliseLineBreaks, splitExplanationSteps } from '@/lib/question-text';
import { difficultyLabel } from '@/lib/eval-difficulty';
import { MIXED_LABEL } from '@/config/tnpsc';
import { allOptions, answerKeyOf, resolveAnswerLabel } from '@/lib/question-options';
import {
  langToggleOptions,
  paperTranslationLang,
  resolveLanguage,
  type LangMode,
} from '@/lib/question-language';

/** Short, plain, and tied to the pass mark rather than to a mood. */
function verdictFor(pct: number | null, pass: number) {
  if (pct == null) return { title: 'Not scored', note: 'This attempt has no score recorded.', accent: 'slate' as const };
  if (pct >= 85) return { title: 'Strong pass', note: 'You have this unit. Try the next difficulty up.', accent: 'emerald' as const };
  if (pct >= pass) return { title: 'Passed', note: 'Solid. One more pass and it will be automatic.', accent: 'emerald' as const };
  if (pct >= pass - 15) return { title: 'Just short', note: 'Close. Review the ones you missed and sit it again.', accent: 'amber' as const };
  return { title: 'Needs another look', note: 'Work through the concepts before retrying this set.', accent: 'rose' as const };
}

const fmtTime = (sec: number | null) => {
  if (sec == null) return '—';
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
};

export function UnitPracticeReport({
  model,
  examName = null,
  passPercentage = 70,
}: {
  model: AttemptReportModel;
  /** The exam the paper belongs to, e.g. "TNPSC Group 4" — shown above the set's name. */
  examName?: string | null;
  passPercentage?: number;
  /** No longer shown — the report ends with the question recap. Kept so existing callers still compile. */
  retryHref?: string;
  unitHref?: string;
}) {
  const s = model.summary;
  const verdict = verdictFor(s.percentage, passPercentage);

  /** The unit this set came from — one subject, by definition of a unit set. */
  const subject = model.subjects[0];
  const level = model.meta.testName ? inferLevel(model.meta.testName) : null;

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* ── Verdict and score ─────────────────────────────────────────── */}
      <ReportCard>
        <div className="flex items-center gap-4 sm:gap-5 flex-wrap">
          <ScoreRing
            percent={s.percentage ?? 0}
            primary={s.percentage != null ? `${Math.round(s.percentage)}%` : '—'}
            secondary={s.maxMarks != null ? `${s.score ?? 0}/${s.maxMarks}` : undefined}
            accent={verdict.accent}
            size={96}
          />

          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gray-400">
              {examName ? `${examName} · Practice set` : 'Practice set'}
            </p>
            <h2 className="mt-0.5 text-lg sm:text-xl font-bold text-gray-900 dark:text-gray-100 leading-tight">
              {model.meta.testName || subject?.name || 'Practice'}
            </h2>
            <div className="mt-1 flex items-center gap-1.5 flex-wrap">
              {level && (
                <span className={cn('rounded-md px-1.5 py-0.5 text-[10px] font-bold', ACCENT.indigo.chip)}>
                  {level}
                </span>
              )}
              <span className="text-[11px] text-gray-500 dark:text-gray-400">
                {s.totalQuestions} questions
              </span>
            </div>

            <p className={cn('mt-2 text-sm font-bold', ACCENT[verdict.accent].text)}>
              {verdict.title}
            </p>
            <p className="text-[11px] leading-relaxed text-gray-600 dark:text-gray-300">
              {verdict.note}
            </p>
          </div>
        </div>
      </ReportCard>

      {/* ── The four numbers ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <StatTile
          icon={<CheckCircle2 className="w-4 h-4" />}
          value={s.correct}
          label="Correct"
          accent="emerald"
        />
        <StatTile
          icon={<XCircle className="w-4 h-4" />}
          value={s.incorrect}
          label="Wrong"
          accent="rose"
        />
        <StatTile
          icon={<MinusCircle className="w-4 h-4" />}
          value={s.unattempted}
          label="Skipped"
          accent="slate"
        />
        <StatTile
          icon={<Clock className="w-4 h-4" />}
          value={fmtTime(s.timeUsedSec)}
          label="Time taken"
          hint={
            s.avgTimePerAttemptedSec != null
              ? `${Math.round(s.avgTimePerAttemptedSec)}s per question`
              : undefined
          }
          accent="indigo"
        />
      </div>

      {/* ── Categories inside the unit, each opening to its subtopics ── */}
      <CategoryBreakdown questions={model.questions} passPercentage={passPercentage} />

      {/* ── Every question ────────────────────────────────────────────── */}
      <QuestionRecap model={model} />

    </div>
  );
}

/**
 * Every question, compact, wrong ones first.
 *
 * Wrong first because that is the order they are useful in — the point of
 * reviewing a practice set is the ones you missed, and making someone scroll
 * past twenty correct answers to find three wrong ones is the wrong default.
 */
/** The category a question belongs to, and the subtopic under it. */
const categoryOf = (q: QuestionReviewItem) => (q.category ?? '').trim() || 'Other';
const subtopicOf = (q: QuestionReviewItem) => (q.subtopic ?? q.subtopic_name ?? '').trim() || 'General';

/**
 * The unit's categories, each a dropdown that opens to its subtopics.
 *
 * Counts come from the questions themselves, so a category that was not in the paper does not appear and
 * a subtopic shows the number of questions the paper put under it.
 */
function CategoryBreakdown({
  questions,
  passPercentage,
}: {
  questions: QuestionReviewItem[];
  passPercentage: number;
}) {
  const [open, setOpen] = useState<Record<string, boolean>>({});

  const categories = useMemo(() => {
    const byCat = new Map<string, { name: string; questions: number; correct: number; subs: Map<string, { name: string; questions: number; correct: number }> }>();
    for (const q of questions) {
      const cat = categoryOf(q);
      const sub = subtopicOf(q);
      let c = byCat.get(cat);
      if (!c) {
        c = { name: cat, questions: 0, correct: 0, subs: new Map() };
        byCat.set(cat, c);
      }
      c.questions += 1;
      if (q.is_correct) c.correct += 1;
      let sc = c.subs.get(sub);
      if (!sc) {
        sc = { name: sub, questions: 0, correct: 0 };
        c.subs.set(sub, sc);
      }
      sc.questions += 1;
      if (q.is_correct) sc.correct += 1;
    }
    return [...byCat.values()].map(c => ({ ...c, subs: [...c.subs.values()] }));
  }, [questions]);

  if (categories.length === 0) return null;

  return (
    <ReportCard>
      <p className="mb-2.5 text-sm font-bold text-gray-900 dark:text-gray-100">Within this unit</p>
      <div className="space-y-2">
        {categories.map(c => {
          const isOpen = !!open[c.name];
          const accuracy = c.questions > 0 ? (c.correct / c.questions) * 100 : null;
          return (
            <div
              key={c.name}
              className={cn(
                'rounded-xl border transition-colors',
                // An open category is lifted off the page, so its sub-categories read as belonging to it.
                isOpen
                  ? 'border-orange-200 bg-orange-50/40 shadow-sm dark:border-orange-900/50 dark:bg-orange-950/10'
                  : 'border-gray-100 dark:border-gray-800',
              )}
            >
              <button
                type="button"
                onClick={() => setOpen(o => ({ ...o, [c.name]: !o[c.name] }))}
                aria-expanded={isOpen}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-left"
              >
                <div className="min-w-0 flex-1">
                  <MeterRow
                    label={c.name}
                    value={accuracy}
                    accent={
                      (accuracy ?? 0) >= passPercentage
                        ? 'emerald'
                        : (accuracy ?? 0) >= passPercentage - 15
                          ? 'amber'
                          : 'rose'
                    }
                    right={`${c.correct}/${c.questions}`}
                  />
                </div>
                <ChevronDown className={cn('h-4 w-4 flex-shrink-0 text-gray-400 transition-transform', isOpen && 'rotate-180')} />
              </button>

              {isOpen && (
                <div className="border-t border-orange-100 px-3 pb-3 pt-2.5 dark:border-orange-900/40">
                  <p className="mb-2 ml-1 text-[10px] font-bold uppercase tracking-[0.14em] text-orange-600/80 dark:text-orange-400/80">
                    Sub-categories · {c.subs.length}
                  </p>
                  {/* Indented behind a guide line: a different level from the category above. */}
                  <ul className="ml-3 space-y-2 border-l-2 border-orange-300 pl-3 dark:border-orange-700">
                  {c.subs.map(sub => {
                    const subAcc = sub.questions > 0 ? (sub.correct / sub.questions) * 100 : null;
                    return (
                      <li key={sub.name} className="rounded-lg border border-gray-100 bg-white px-2.5 py-2 dark:border-gray-800 dark:bg-gray-900">
                        <MeterRow
                          label={sub.name}
                          value={subAcc}
                          accent={
                            (subAcc ?? 0) >= passPercentage
                              ? 'emerald'
                              : (subAcc ?? 0) >= passPercentage - 15
                                ? 'amber'
                                : 'rose'
                          }
                          right={`${sub.correct}/${sub.questions}`}
                        />
                      </li>
                    );
                  })}
                  </ul>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </ReportCard>
  );
}

function QuestionRecap({ model }: { model: AttemptReportModel }) {

  /**
   * The language the paper can be switched into, or null when it carries one.
   *
   * A Group 4 booklet prints every question twice; the report was showing only
   * the language it was authored in, which for a Tamil-medium candidate is the
   * copy they did not sit. No control is offered where there is nothing to
   * switch to — a toggle that changes nothing teaches the reader to distrust the
   * ones that do.
   */
  const translation = useMemo(
    () => paperTranslationLang(model.questions, q => q.body),
    [model.questions],
  );
  const [lang, setLang] = useState<Exclude<LangMode, 'both'>>('primary');

  /** correct · wrong · skipped — the only three states a reviewed answer has. */
  const stateOf = (q: QuestionReviewItem): 'correct' | 'incorrect' | 'skipped' =>
    !isAttempted(q) ? 'skipped' : q.is_correct ? 'correct' : 'incorrect';

  /** Every question, in the order the paper printed them. */
  const rows = useMemo(
    () => [...model.questions].sort((a, b) => (a.number ?? 0) - (b.number ?? 0)),
    [model.questions],
  );

  return (
    <ReportCard>
      <div className="mb-3 flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm font-bold text-gray-900 dark:text-gray-100">
          All questions <span className="font-normal text-gray-400">({model.questions.length})</span>
        </p>
        <div className="flex items-center gap-3">
          {translation && (
            <LangSwitch value={lang} onChange={setLang} translation={translation} />
          )}
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="py-6 text-center">
          <CheckCircle2 className="mx-auto mb-2 h-6 w-6 text-emerald-500" />
          <p className="text-xs font-semibold text-gray-700 dark:text-gray-200">
            Nothing missed — every question correct.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {rows.map(q => {
            const st = stateOf(q);
            /*
             * Field by field, not card by card. A paper can carry a Tamil stem
             * with no Tamil explanation, and blanking the explanation because
             * the reader asked for Tamil loses the only copy there is.
             */
            const shown = resolveLanguage<string | null>(q, lang, {
              text: q.body,
              options: q.options,
              explanation: q.explanation,
            });
            return (
              <li
                key={q.question_id}
                className={cn(
                  'rounded-xl border p-2.5',
                  st === 'correct'
                    ? 'border-emerald-100 dark:border-emerald-900/60 bg-emerald-50/40 dark:bg-emerald-950/20'
                    : st === 'incorrect'
                      ? 'border-rose-100 dark:border-rose-900/60 bg-rose-50/40 dark:bg-rose-950/20'
                      : 'border-gray-100 dark:border-gray-800',
                )}
              >
                <div className="flex items-start gap-2.5">
                  <span className="mt-px flex-shrink-0">
                    {st === 'correct' ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    ) : st === 'incorrect' ? (
                      <XCircle className="h-4 w-4 text-rose-500" />
                    ) : (
                      <Circle className="h-4 w-4 text-gray-300 dark:text-gray-600" />
                    )}
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium leading-relaxed text-gray-800 dark:text-gray-100">
                      <span className="mr-1.5 font-bold text-gray-400">Q{q.number}.</span>
                      <MathText text={normaliseLineBreaks(shown.text ?? q.body)} />
                    </p>

                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px]">
                      {/* The category, then the subtopic under it — e.g. அணியிலக்கணம் · உவமை அணி. */}
                      {q.category && (
                        <span className="rounded bg-gray-50 px-1.5 py-0.5 text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                          {q.category}
                        </span>
                      )}
                      {(q.subtopic ?? q.subtopic_name) && (
                        <span className="rounded bg-blue-50 px-1.5 py-0.5 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                          {q.subtopic ?? q.subtopic_name}
                        </span>
                      )}
                      {q.difficulty && (
                        <span className="rounded bg-gray-50 px-1.5 py-0.5 text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                          {difficultyLabel(q.difficulty)}
                        </span>
                      )}
                      {q.time_spent_seconds != null && (
                        <span className="text-gray-400">{fmtTime(q.time_spent_seconds)}</span>
                      )}
                    </div>

                    <AnswerOptions
                      question={q}
                      state={st}
                      options={shown.options}
                      explanation={shown.explanation ?? null}
                    />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </ReportCard>
  );
}

/**
 * Every option, with the chosen one and the right one marked — then why.
 *
 * A letter on its own ("You chose: b · Correct: c") marks the question without
 * teaching anything: it says you were wrong and withholds both what you picked
 * and what the answer was. The options are what make a review worth reading —
 * the ones you did not pick are where the trap usually is — and the explanation
 * is the only part that stops the same mistake next time.
 */
function AnswerOptions({
  question,
  state,
  options: rawOptions,
  explanation,
}: {
  question: QuestionReviewItem;
  state: 'correct' | 'incorrect' | 'skipped';
  /** Already resolved into the language on screen. */
  options: unknown;
  explanation: string | null;
}) {
  const options = useMemo(() => allOptions(rawOptions), [rawOptions]);
  const chosen = answerKeyOf(question.user_answer);
  const right = answerKeyOf(question.correct_answer);

  // No options came through — fall back to naming the two answers, which is all
  // there is to say.
  if (options.length === 0) {
    const mine = resolveAnswerLabel(question.user_answer, rawOptions);
    const correct = resolveAnswerLabel(question.correct_answer, rawOptions);
    return (
      <div className="mt-1.5 space-y-1 text-[13px] leading-relaxed">
        {state === 'incorrect' && question.user_answer && (
          <p className="text-rose-600 dark:text-rose-400">
            You chose <b>{mine.label}</b>
            {mine.text ? ` — ${mine.text}` : ''}
          </p>
        )}
        {question.correct_answer && (
          <p className="font-semibold text-emerald-700 dark:text-emerald-400">
            Correct answer: <b>{correct.label}</b>
            {correct.text ? ` — ${correct.text}` : ''}
          </p>
        )}
        <Explanation text={explanation} tip={question.tip} />
      </div>
    );
  }

  return (
    <div className="mt-2 space-y-1.5">
      <ul className="space-y-1">
        {options.map(o => {
          const key = o.label.toLowerCase();
          const isRight = key === right;
          const isMine = key === chosen;

          return (
            <li
              key={o.label}
              className={cn(
                'flex items-start gap-2 rounded-lg border px-2.5 py-1.5 text-[13px] leading-relaxed',
                isRight
                  ? 'border-emerald-200 bg-emerald-50/70 dark:border-emerald-900 dark:bg-emerald-950/30'
                  : isMine
                    ? 'border-rose-200 bg-rose-50/70 dark:border-rose-900 dark:bg-rose-950/30'
                    : 'border-transparent bg-gray-50/70 dark:bg-gray-800/40',
              )}
            >
              <span
                className={cn(
                  'mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded text-[11px] font-bold',
                  isRight
                    ? 'bg-emerald-500 text-white'
                    : isMine
                      ? 'bg-rose-500 text-white'
                      : 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
                )}
              >
                {o.label}
              </span>

              <span className="min-w-0 flex-1 text-gray-700 dark:text-gray-200">
                {o.image_url ? (
                  <img
                    src={o.image_url}
                    alt={`Option ${o.label}`}
                    className="max-h-24 rounded border border-gray-200 dark:border-gray-700"
                  />
                ) : (
                  <MathText text={normaliseLineBreaks(o.text ?? '')} />
                )}
                {o.translated && (
                  <span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">
                    {o.translated}
                  </span>
                )}
              </span>

              {/* Said in words as well as in colour — the marking has to survive
                  a reader who cannot separate the red from the green. */}
              {(isRight || isMine) && (
                <span
                  className={cn(
                    'mt-0.5 flex-shrink-0 text-[10px] font-bold uppercase tracking-wide',
                    isRight ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400',
                  )}
                >
                  {isRight ? (isMine ? 'Your answer · correct' : 'Correct') : 'You chose'}
                </span>
              )}
            </li>
          );
        })}
      </ul>

      <Explanation text={explanation} tip={question.tip} />
    </div>
  );
}

/** The why. Shown wherever the question carries one, in the language on screen. */
function Explanation({ text, tip }: { text: string | null; tip: string | null }) {
  const split = useMemo(() => splitExplanationSteps(text), [text]);
  if (!text && !tip) return null;
  return (
    <div className="rounded-lg border border-blue-100 bg-blue-50/60 px-3 py-2.5 dark:border-blue-900/60 dark:bg-blue-950/30">
      {text && split ? (
        <>
          <p className="text-xs font-bold uppercase tracking-wider text-blue-700 dark:text-brand-300">
            Why — step by step
          </p>
          {split.intro && (
            <p className="mt-1.5 text-[13px] leading-relaxed text-gray-700 dark:text-gray-200">
              <MathText text={split.intro} />
            </p>
          )}
          <ol className="mt-2 space-y-2.5">
            {split.steps.map(step => (
              <li key={step.n} className="flex items-start gap-2.5">
                <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-brand-600 text-[11px] font-bold text-white dark:bg-brand-500">
                  {step.n}
                </span>
                <div className="min-w-0 flex-1 text-[13px] leading-relaxed text-gray-700 dark:text-gray-200">
                  {step.title && (
                    <p className="font-bold text-gray-900 dark:text-gray-100">{step.title}</p>
                  )}
                  {step.body && <MathText as="p" text={step.body} />}
                  {step.options.length > 0 && (
                    <ul className="mt-1 space-y-1">
                      {step.options.map(o => (
                        <li
                          key={o.label}
                          className={cn(
                            'flex items-start gap-2 rounded-md px-2 py-1',
                            o.verdict === 'correct'
                              ? 'bg-emerald-100/70 dark:bg-emerald-900/30'
                              : o.verdict === 'wrong'
                                ? 'bg-rose-100/60 dark:bg-rose-900/20'
                                : 'bg-white/60 dark:bg-gray-800/40',
                          )}
                        >
                          <span
                            className={cn(
                              'mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded text-[11px] font-bold',
                              o.verdict === 'correct'
                                ? 'bg-emerald-500 text-white'
                                : o.verdict === 'wrong'
                                  ? 'bg-rose-500 text-white'
                                  : 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
                            )}
                          >
                            {o.label}
                          </span>
                          <MathText as="span" className="min-w-0 flex-1" text={o.text} />
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </>
      ) : (
        text && (
          <p className="whitespace-pre-line text-[13px] leading-relaxed text-gray-700 dark:text-gray-200">
            <span className="font-bold text-blue-700 dark:text-brand-300">Why: </span>
            <MathText text={normaliseLineBreaks(text)} />
          </p>
        )
      )}
      {tip && (
        <p className="mt-2 text-[13px] leading-relaxed text-gray-600 dark:text-gray-300">
          <span className="font-bold text-blue-700 dark:text-brand-300">Tip: </span>
          <MathText text={normaliseLineBreaks(tip)} />
        </p>
      )}
    </div>
  );
}

/** One switch, two named sides — the paper's own language first. */
function LangSwitch({
  value,
  onChange,
  translation,
}: {
  value: Exclude<LangMode, 'both'>;
  onChange: (next: Exclude<LangMode, 'both'>) => void;
  translation: string;
}) {
  const options = langToggleOptions(translation);
  return (
    <div
      className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5 dark:border-gray-700 dark:bg-gray-800/60"
      role="group"
      aria-label="Question language"
    >
      {options.map(o => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={cn(
            'rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors',
            value === o.value
              ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-900 dark:text-gray-100'
              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** "… · Simple" in a generated title — the level the set was pitched at. */
function inferLevel(title: string): string | null {
  // The all-difficulties set is "Mixed" now and was "Full Unit" in titles written before
  // the rename, so both are read and both show as the current name. "Mixed" is only taken
  // as a trailing tag, since the word turns up in ordinary titles.
  const m = /\b(simple|medium|complex|full unit)\b|[·—-]\s*mixed\s*$/i.exec(title);
  if (!m) return null;
  if (!m[1]) return MIXED_LABEL;
  const v = m[1].toLowerCase();
  return v === 'full unit' ? MIXED_LABEL : v.charAt(0).toUpperCase() + v.slice(1);
}
