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
import { displayTitle } from '@/lib/display-title';
import { useMemo, useState } from 'react';
import { Award, ChevronDown, CheckCircle2, Circle, Clock, MinusCircle, Trophy, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { submittedLabel } from '@/lib/report-submitted';
import { ACCENT, MeterRow, ReportCard } from '@/components/user/report-ui';
import { OverallScoreSummary } from '@/components/user/AttemptDiagnosticReport';
import { isAttempted, type AttemptReportModel } from '@/lib/attempt-report';
import type { QuestionReviewItem } from '@/lib/userPortalApi';
import { MathText } from '@/components/ui/MathText';
import { normaliseLineBreaks, splitExplanationSteps } from '@/lib/question-text';
import { difficultyLabel } from '@/lib/eval-difficulty';
import { MIXED_LABEL } from '@/config/tnpsc';
import { PERFORMANCE_LABEL, passMarkFor, performanceOf, standingOf, type PassMark } from '@/config/pass-marks';
import { usePassMarks } from '@/hooks/use-pass-marks';
import { allOptions, answerKeyOf, resolveAnswerLabel } from '@/lib/question-options';
import {
  langToggleOptions,
  paperTranslationLang,
  resolveLanguage,
  type LangMode,
} from '@/lib/question-language';

/** Short, plain, and tied to the pass mark rather than to a mood. The mark depends on the set's difficulty. */
function verdictFor(pct: number | null, mark: PassMark) {
  const standing = standingOf(pct, mark);
  if (standing == null) return { title: 'Not scored', performance: null, note: 'This attempt has no score recorded.', accent: 'slate' as const };
  const performance = performanceOf(pct, mark)!;
  const title = PERFORMANCE_LABEL[performance];
  if (standing === 'target') return { title, performance, note: `You are at or above the ${mark.target}% target. Try the next difficulty up.`, accent: 'emerald' as const };
  if (standing === 'pass') return { title, performance, note: `Above the ${mark.pass}% pass mark. Aim for ${mark.target}% to have this unit secure.`, accent: 'emerald' as const };
  if (standing === 'close') return { title, performance, note: `The pass mark is ${mark.pass}%. Review the ones you missed and sit it again.`, accent: 'amber' as const };
  return { title, performance, note: `The pass mark is ${mark.pass}%. Work through the concepts before retrying this set.`, accent: 'rose' as const };
}

const BAR_FILL = {
  emerald: 'bg-emerald-500',
  amber: 'bg-amber-500',
  rose: 'bg-rose-500',
  slate: 'bg-slate-400',
} as Record<string, string>;

/**
 * How the set went against the pass mark, for the right of the header.
 *
 * The score card below already shows the score and the counts, so this does not repeat them. It answers
 * the next question: how far from passing was it? A bar with the pass mark marked on it, what is still
 * missing in marks (or points, when the paper has no marks), and the pace the set was done at.
 */
function PassGap({
  score,
  maxMarks,
  percentage,
  pass,
  accent,
  timeSec,
  perQuestionSec,
  attempted,
  total,
}: {
  score: number | null;
  maxMarks: number | null;
  percentage: number | null;
  pass: number;
  accent: string;
  timeSec: number | null;
  perQuestionSec: number | null;
  attempted: number;
  total: number;
}) {
  const pct = percentage == null ? null : Math.round(percentage * 10) / 10;
  const passed = pct != null && pct >= pass;
  // Marks when the paper has them (9 of 60, pass at 42 — 33 to go); otherwise points of percentage.
  const passMarks = maxMarks != null ? Math.ceil((pass / 100) * maxMarks * 100) / 100 : null;
  const short =
    pct == null
      ? null
      : passMarks != null && score != null
        ? `${Math.round((passMarks - score) * 100) / 100} more marks`
        : `${Math.round((pass - pct) * 10) / 10} more points`;

  return (
    <div className="w-full md:w-[23rem] flex-shrink-0 rounded-xl bg-gray-50 dark:bg-gray-800/50 p-3.5">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Your score vs the pass mark</p>
        {pct != null && (
          <p className={cn('text-[11px] font-bold', passed ? 'text-emerald-600 dark:text-emerald-400' : ACCENT[accent as 'rose'].text)}>
            {passed ? 'Passed' : `${short} to pass`}
          </p>
        )}
      </div>

      <div className="relative mt-3.5 h-3 rounded-full bg-gray-200 dark:bg-gray-700">
        <div
          className={cn('h-full rounded-full transition-all', BAR_FILL[accent] ?? BAR_FILL.slate)}
          style={{ width: `${Math.min(100, Math.max(0, pct ?? 0))}%` }}
        />
        {/* the pass mark */}
        <div className="absolute -top-1 h-5 w-0.5 rounded bg-slate-700 dark:bg-slate-200" style={{ left: `${pass}%` }} aria-hidden />
      </div>
      <div className="relative mt-1 h-4 text-[10px] tabular-nums">
        <span className="absolute left-0 font-bold text-gray-700 dark:text-gray-200">You {pct == null ? '—' : `${pct}%`}</span>
        <span className="absolute -translate-x-1/2 whitespace-nowrap font-semibold text-gray-500 dark:text-gray-400" style={{ left: `${Math.min(pass, 88)}%` }}>
          Pass mark {pass}%
        </span>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 border-t border-gray-200 dark:border-gray-700 pt-3 text-center">
        {[
          { label: 'Time taken', value: fmtTime(timeSec) },
          { label: 'Per question', value: perQuestionSec == null ? '—' : `${Math.round(perQuestionSec)}s` },
          { label: 'Attempted', value: `${attempted}/${total}` },
        ].map(c => (
          <div key={c.label}>
            <p className="text-sm font-bold tabular-nums text-gray-900 dark:text-gray-100">{c.value}</p>
            <p className="text-[10px] text-gray-400">{c.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
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
  passMark,
}: {
  model: AttemptReportModel;
  /** The exam the paper belongs to, e.g. "TNPSC Group 4" — shown above the set's name. */
  examName?: string | null;
  /** Override the benchmark; by default it follows the set's difficulty. */
  passMark?: PassMark;
  /** No longer shown — the report ends with the question recap. Kept so existing callers still compile. */
  retryHref?: string;
  unitHref?: string;
}) {
  usePassMarks(); // draws again once the server's benchmarks arrive
  const s = model.summary;

  /** The unit this set came from — one subject, by definition of a unit set. */
  const subject = model.subjects[0];
  const level = model.meta.testName ? inferLevel(model.meta.testName) : null;
  // Simple is held to 70 %, Medium 60 %, Complex 50 %, a Mixed set 60 % — see config/pass-marks.
  const mark = passMark ?? passMarkFor({ kind: 'practice', level });
  const verdict = verdictFor(s.percentage, mark);

  return (
    <div id="report-pdf-root" className="space-y-3 sm:space-y-4">
      {/* ── Which set, and how it went ────────────────────────────────── */}
      <ReportCard>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="min-w-0 flex-1">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gray-400">
          {examName ? `${examName} · Practice set` : 'Practice set'}
        </p>
        <h2 className="mt-0.5 text-lg sm:text-xl font-bold text-gray-900 dark:text-gray-100 leading-tight">
          {model.meta.testName || subject?.name || 'Practice'}
        </h2>
        <div className="mt-1.5 flex items-center gap-2 flex-wrap">
          {level && (
            <span className={cn('rounded-md px-1.5 py-0.5 text-[10px] font-bold', ACCENT.indigo.chip)}>{level}</span>
          )}
          <span className="text-[11px] text-gray-500 dark:text-gray-400">{s.totalQuestions} questions</span>
          {submittedLabel(model.meta) && (
            <span className="text-[11px] text-gray-500 dark:text-gray-400">· {submittedLabel(model.meta)}</span>
          )}
        </div>
        {verdict.performance && verdict.performance !== 'needs-improvement' ? (
          // Passed: the verdict arrives with a pop, a ring of light and a sheen, so a pass feels like one.
          <p className="verdict-pass mt-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-sm font-extrabold text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900">
            {verdict.performance === 'excellent' ? (
              <Trophy className="h-4 w-4" />
            ) : verdict.performance === 'strong' ? (
              <Award className="h-4 w-4" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            <span className="verdict-shimmer">{verdict.title}</span>
          </p>
        ) : (
          <p className={cn('mt-2 text-sm font-bold', ACCENT[verdict.accent].text)}>{verdict.title}</p>
        )}
        <p className="text-[11px] leading-relaxed text-gray-600 dark:text-gray-300">{verdict.note}</p>
        </div>
        <PassGap
          score={s.score}
          maxMarks={s.maxMarks}
          percentage={s.percentage ?? s.correctPct}
          pass={mark.pass}
          accent={verdict.accent}
          timeSec={s.timeUsedSec}
          perQuestionSec={s.avgTimePerAttemptedSec ?? (s.timeUsedSec != null && s.attempted > 0 ? s.timeUsedSec / s.attempted : null)}
          attempted={s.attempted}
          total={s.totalQuestions}
        />
        </div>
      </ReportCard>

      {/* ── The score, and how the set split ──────────────────────────── */}
      <OverallScoreSummary model={model} />

      {/* ── Categories inside the unit, each opening to its subtopics ── */}
      <CategoryBreakdown questions={model.questions} passPercentage={mark.pass} fallback={setTopicFromTitle(model.meta.testName)} />

      {/* ── Every question ────────────────────────────────────────────── */}
      <div data-no-print>
        <QuestionRecap model={model} />
      </div>

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
/**
 * The category a question belongs to, and the subtopic under it.
 *
 * Not every question comes back with a category. Then its topic (the bank's `chapter`) stands in, and failing that
 * the topic the set is named for — a key-topic set, "இலக்கணம்: சொல்லிலக்கணம் · Mixed", is all one topic.
 */
const categoryOf = (q: QuestionReviewItem, fallback: string | null) =>
  (q.category ?? '').trim() || (q.topic ?? q.chapter ?? '').trim() || fallback || 'Other';

/** The topic a key-topic set is named for: what follows the unit in "Unit: Topic · Level". Null for a unit set. */
export function setTopicFromTitle(title: string | null | undefined): string | null {
  const head = (displayTitle(title ?? '') || '').split('·')[0];
  const i = head.indexOf(':');
  return i >= 0 ? head.slice(i + 1).trim() || null : null;
}
/** A question with no sub-category of its own. */
const NO_SUBTOPIC = 'General';
const subtopicOf = (q: QuestionReviewItem) => (q.subtopic ?? q.subtopic_name ?? '').trim() || NO_SUBTOPIC;

/**
 * The unit's categories, each a dropdown that opens to its subtopics.
 *
 * Counts come from the questions themselves, so a category that was not in the paper does not appear and
 * a subtopic shows the number of questions the paper put under it.
 */
function CategoryBreakdown({
  questions,
  passPercentage,
  fallback,
}: {
  questions: QuestionReviewItem[];
  passPercentage: number;
  /** The category for a question that has none of its own. */
  fallback: string | null;
}) {
  const [selected, setSelected] = useState<string | null>(null);

  const categories = useMemo(() => {
    type Sub = { name: string; questions: number; correct: number };
    const byCat = new Map<string, { name: string; questions: number; correct: number; results: boolean[]; subs: Map<string, Sub> }>();
    for (const q of questions) {
      const cat = categoryOf(q, fallback);
      const sub = subtopicOf(q);
      let c = byCat.get(cat);
      if (!c) {
        c = { name: cat, questions: 0, correct: 0, results: [], subs: new Map() };
        byCat.set(cat, c);
      }
      c.questions += 1;
      c.results.push(!!q.is_correct);
      if (q.is_correct) c.correct += 1;
      let sc = c.subs.get(sub);
      if (!sc) {
        sc = { name: sub, questions: 0, correct: 0 };
        c.subs.set(sub, sc);
      }
      sc.questions += 1;
      if (q.is_correct) sc.correct += 1;
    }
    const rate = (c: { questions: number; correct: number }) => (c.questions ? c.correct / c.questions : 0);
    // Weakest first: the list reads as what to work on, in order.
    return [...byCat.values()]
      .map(c => ({ ...c, subs: [...c.subs.values()] }))
      .sort((a, b) => rate(a) - rate(b) || b.questions - a.questions);
  }, [questions, fallback]);

  if (categories.length === 0) return null;

  // Green at or above the pass mark, amber within 15 points of it, red below.
  const toneOf = (accuracy: number | null) =>
    (accuracy ?? 0) >= passPercentage ? 'emerald' : (accuracy ?? 0) >= passPercentage - 15 ? 'amber' : 'rose';
  const TONE = {
    emerald: { ring: 'stroke-emerald-500', text: 'text-emerald-600 dark:text-emerald-400', stripe: 'bg-emerald-500', dot: 'bg-emerald-500' },
    amber: { ring: 'stroke-amber-500', text: 'text-amber-600 dark:text-amber-400', stripe: 'bg-amber-500', dot: 'bg-amber-500' },
    rose: { ring: 'stroke-rose-500', text: 'text-rose-600 dark:text-rose-400', stripe: 'bg-rose-500', dot: 'bg-rose-500' },
  } as const;
  const pctOf = (c: { questions: number; correct: number }) => (c.questions > 0 ? (c.correct / c.questions) * 100 : null);
  // The weakest category is open first: it is the one to read.
  const picked = categories.find(c => c.name === selected) ?? categories[0];
  const pickedPct = pctOf(picked);
  const pickedTone = TONE[toneOf(pickedPct)];
  const wrong = picked.questions - picked.correct;

  // A ring for the picked category: the arc is the share answered correctly.
  const R = 52;
  const CIRC = 2 * Math.PI * R;

  return (
    <ReportCard>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="text-sm font-bold text-gray-900 dark:text-gray-100">Within this unit</p>
        <p className="text-[11px] text-gray-500 dark:text-gray-400">
          {categories.length} categor{categories.length === 1 ? 'y' : 'ies'} · pick one to see how it went
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-[minmax(0,15rem)_1fr]">
        {/* Picker: a scrolling strip on a phone, a column beside the detail from tablet up. */}
        <nav className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 md:mx-0 md:max-h-[26rem] md:flex-col md:overflow-x-hidden md:overflow-y-auto md:px-0 md:pb-0 md:pr-1" aria-label="Categories">
          {categories.map(c => {
            const isPicked = c.name === picked.name;
            const acc = pctOf(c);
            return (
              <button
                key={c.name}
                type="button"
                onClick={() => setSelected(c.name)}
                aria-current={isPicked}
                className={cn(
                  'flex flex-shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-semibold transition md:flex-shrink',
                  isPicked
                    ? 'bg-orange-500 text-white shadow-sm'
                    : 'bg-gray-50 text-gray-700 hover:bg-orange-50 dark:bg-gray-800/60 dark:text-gray-200 dark:hover:bg-gray-800',
                )}
              >
                <span className={cn('h-2 w-2 flex-shrink-0 rounded-full', isPicked ? 'bg-white' : TONE[toneOf(acc)].dot)} />
                <span className="min-w-0 flex-1 whitespace-nowrap md:whitespace-normal">{c.name}</span>
                <span className={cn('tabular-nums', isPicked ? 'text-white/90' : 'text-gray-500 dark:text-gray-400')}>
                  {acc == null ? '—' : `${Math.round(acc)}%`}
                </span>
              </button>
            );
          })}
        </nav>

        <div className="rounded-2xl border border-gray-100 p-4 dark:border-gray-800">
          <div className="flex items-center gap-4">
            <div className="relative h-28 w-28 flex-shrink-0">
              <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90" aria-hidden>
                <circle cx="60" cy="60" r={R} fill="none" strokeWidth="11" className="stroke-gray-100 dark:stroke-gray-800" />
                <circle
                  cx="60"
                  cy="60"
                  r={R}
                  fill="none"
                  strokeWidth="11"
                  strokeLinecap="round"
                  strokeDasharray={`${((pickedPct ?? 0) / 100) * CIRC} ${CIRC}`}
                  className={cn('transition-all duration-500', pickedTone.ring)}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={cn('text-2xl font-extrabold tabular-nums leading-none', pickedTone.text)}>
                  {pickedPct == null ? '—' : `${Math.round(pickedPct)}%`}
                </span>
                <span className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">correct</span>
              </div>
            </div>
            <div className="min-w-0">
              <p className="text-base font-extrabold leading-snug text-gray-900 dark:text-gray-100">{picked.name}</p>
              <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                <b className="text-emerald-600 dark:text-emerald-400">{picked.correct}</b> right ·{' '}
                <b className="text-rose-600 dark:text-rose-400">{wrong}</b> wrong or skipped · {picked.questions} question
                {picked.questions === 1 ? '' : 's'}
              </p>
              <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                Pass mark {passPercentage}% ·{' '}
                {(pickedPct ?? 0) >= passPercentage
                  ? 'above it'
                  : `${Math.ceil((passPercentage / 100) * picked.questions - picked.correct)} more right to reach it`}
              </p>
            </div>
          </div>

          {picked.subs.some(sub => sub.name !== NO_SUBTOPIC) ? (
            <div className="mt-4 border-t border-gray-100 pt-3 dark:border-gray-800">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-gray-500 dark:text-gray-400">
                Sub-categories
              </p>
              <ul className="space-y-2">
                {picked.subs.map(sub => {
                  const acc = pctOf(sub) ?? 0;
                  return (
                    <li key={sub.name} className="flex items-center gap-3">
                      <span className="min-w-0 flex-1 text-xs font-medium text-gray-800 dark:text-gray-200">{sub.name}</span>
                      <div className="h-1.5 w-20 flex-shrink-0 overflow-hidden rounded-full bg-gray-100 sm:w-32 dark:bg-gray-800">
                        <div className={cn('h-full rounded-full', TONE[toneOf(acc)].stripe)} style={{ width: `${acc}%` }} />
                      </div>
                      <span className="w-9 flex-shrink-0 text-right text-xs font-bold tabular-nums text-gray-700 dark:text-gray-300">
                        {sub.correct}/{sub.questions}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : (
            <p className="mt-4 border-t border-gray-100 pt-3 text-[11px] text-gray-500 dark:border-gray-800 dark:text-gray-400">
              These questions are not tagged with a sub-category.
            </p>
          )}
        </div>
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
                      {/* A zero is "time was not recorded", not "answered in no time". */}
                      {(q.time_spent_seconds ?? 0) > 0 && (
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
