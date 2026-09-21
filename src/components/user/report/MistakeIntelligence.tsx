/**
 * "Mistake Intelligence" (mockup screen 6).
 *
 * Real content as of Stage 3 (Mistake DNA / Error Intelligence) of the backend
 * LLM architecture overhaul plan: `analysis.error_intelligence` clusters this
 * attempt's actual wrong answers into a fixed pattern vocabulary, from the
 * question/options/explanation alone — never from timing or the answer choice
 * alone. Falls back to a static illustrative placeholder while that section
 * isn't ready yet (never generated, still generating, or failed) — the same
 * graceful degradation every other LLM-backed section on this report already
 * uses, so this screen never blocks on it and never shows a loading spinner
 * for it specifically.
 */
import { useNavigate } from 'react-router-dom';
import { XCircle, Target, AlertCircle, HelpCircle, ClipboardList, Lightbulb, ArrowLeft, Sparkles, ChevronRight } from 'lucide-react';
import type { AttemptReportModel } from '@/lib/attempt-report';
import type { AttemptAnalysisResponse, MistakeCategory } from '@/lib/userPortalApi';
import { ReportCard } from '@/components/user/report-ui';
import { cn } from '@/lib/utils';

const CATEGORY_DISPLAY: Record<MistakeCategory, { icon: typeof XCircle; accent: string; title: string }> = {
  concept_confusion: { icon: XCircle, accent: 'bg-rose-500', title: 'Concept / definition confusion' },
  institution_function_confusion: { icon: Target, accent: 'bg-amber-500', title: 'Institution / function confusion' },
  chronology_sequence_confusion: { icon: Target, accent: 'bg-amber-500', title: 'Chronology / timeline errors' },
  rule_definition_misapplied: { icon: AlertCircle, accent: 'bg-rose-500', title: 'Rule application errors' },
  formula_method_selection: { icon: AlertCircle, accent: 'bg-rose-500', title: 'Formula / method selection' },
  calculation_process_error: { icon: AlertCircle, accent: 'bg-rose-500', title: 'Calculation errors' },
  language_reading_misinterpretation: { icon: Target, accent: 'bg-amber-500', title: 'Reading / language misinterpretation' },
  similar_option_discrimination: { icon: Target, accent: 'bg-amber-500', title: 'Similar-option confusion' },
  cannot_determine: { icon: HelpCircle, accent: 'bg-slate-400', title: 'Cannot determine from answer alone' },
};

// Static illustrative fallback — used only while the real analysis isn't
// ready yet, never derived from this attempt's actual answers (that would
// misleadingly imply real per-category analysis before it exists).
const PLACEHOLDER_PATTERNS: Array<{
  icon: typeof XCircle;
  accent: string;
  title: string;
  description: string;
  count: string;
}> = [
  {
    icon: XCircle,
    accent: 'bg-rose-500',
    title: 'Concept / definition confusion',
    description: 'You are sometimes confusing similar concepts or definitions.',
    count: '6 questions',
  },
  {
    icon: Target,
    accent: 'bg-amber-500',
    title: 'Institution / function confusion',
    description: 'You are sometimes associating a function with the wrong institution.',
    count: '5 questions',
  },
  {
    icon: Target,
    accent: 'bg-amber-500',
    title: 'Chronology / timeline errors',
    description: 'Some answers show confusion in the sequence of events.',
    count: '4 questions',
  },
  {
    icon: AlertCircle,
    accent: 'bg-rose-500',
    title: 'Rule application errors',
    description: 'Difficulty applying rules or formulas to new contexts.',
    count: '3 questions',
  },
  {
    icon: HelpCircle,
    accent: 'bg-slate-400',
    title: 'Cannot determine from answer alone',
    description: 'For some questions, the reason for the error cannot be reliably inferred from the selected answer.',
    count: 'Many questions',
  },
];

export function MistakeIntelligence({
  model,
  analysis,
}: {
  model: AttemptReportModel;
  /** The new backend pipeline's output, when ready — see the module doc comment above. */
  analysis?: AttemptAnalysisResponse | null;
}) {
  const navigate = useNavigate();
  const attemptId = model.meta.attemptId;
  const clusters = analysis?.error_intelligence;
  // Shape, not just presence: a backend still running the pre-redesign
  // Mistake DNA code (or a deploy lagging behind this frontend build)
  // returns `error_intelligence` as an array too, just in the old shape
  // (`pattern`/`student_message`/`repair_action` — no `category`). Reading
  // `.category` off those would throw rather than degrade, so an empty
  // array is fine (a real "nothing to show" result), but a non-empty one
  // must actually have a recognised `category` on every entry.
  const isLive = Array.isArray(clusters) && clusters.every(c => c.category in CATEGORY_DISPLAY);

  const goToQuestions = (questionIds: string[]) => {
    // A category's supporting questions aren't guaranteed to share one
    // subject — resolve from whichever question is first, and let the
    // filtered Question Insights page itself resolve each row's own
    // subject for its "View" link (see SubjectQuestionsPage.tsx).
    const firstSubject = model.subjects.find(s => s.questionIds.includes(questionIds[0]));
    const subjectId = firstSubject?.subjectId ?? model.subjects[0]?.subjectId;
    if (!subjectId) return;
    navigate(`/user/report/${attemptId}/subjects/${subjectId}/questions?ids=${questionIds.join(',')}`);
  };

  // Normalize both sources (real clusters, or the static placeholder) to one
  // shape so the list below renders from a single, simple map — no
  // per-render branching on which source produced a given row. Only a real
  // cluster is clickable — a placeholder row's "questions" are illustrative
  // counts, not real question ids, so there is nothing to navigate to yet.
  const rows = isLive
    ? clusters!.map(c => ({
        key: c.category,
        icon: CATEGORY_DISPLAY[c.category].icon,
        accent: CATEGORY_DISPLAY[c.category].accent,
        title: CATEGORY_DISPLAY[c.category].title,
        description: c.sample_reason,
        count: `${c.count} question${c.count === 1 ? '' : 's'}`,
        onClick: () => goToQuestions(c.supporting_question_ids),
      }))
    : PLACEHOLDER_PATTERNS.map(p => ({ key: p.title, ...p, onClick: undefined as (() => void) | undefined }));

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-4">
      <button
        onClick={() => navigate(`/user/report/${attemptId}`)}
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Report
      </button>

      <div className="flex items-start gap-3">
        <span className="flex-shrink-0 w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
          <ClipboardList className="w-4.5 h-4.5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xl font-extrabold text-gray-900 dark:text-gray-100">Mistake Intelligence</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Common patterns found in your incorrect answers</p>
        </div>
        {isLive && (
          <span className="flex-shrink-0 inline-flex items-center gap-1 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 rounded-full px-2.5 py-1">
            <Sparkles className="w-3 h-3" /> AI-analyzed
          </span>
        )}
      </div>

      {isLive && clusters!.length === 0 ? (
        <ReportCard className="text-center py-8">
          {model.summary.incorrect === 0 ? (
            <>
              <p className="text-[13px] font-semibold text-gray-700 dark:text-gray-200">
                No incorrect answers to analyse in this attempt.
              </p>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                Nothing to cluster here — every attempted question was either correct or skipped.
              </p>
            </>
          ) : (
            <>
              <p className="text-[13px] font-semibold text-gray-700 dark:text-gray-200">
                No repeated mistake pattern confirmed yet.
              </p>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                We could identify what was wrong, but not reliably why it was chosen.
              </p>
            </>
          )}
        </ReportCard>
      ) : (
        <ReportCard flush>
          {rows.map((row, i) => {
            const Row = row.onClick ? 'button' : 'div';
            return (
              <Row
                key={row.key}
                {...(row.onClick ? { type: 'button' as const, onClick: row.onClick } : {})}
                className={cn(
                  'w-full flex items-center gap-3 px-4 sm:px-5 py-3.5 text-left',
                  i > 0 && 'border-t border-gray-100 dark:border-gray-800',
                  row.onClick && 'hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors cursor-pointer',
                )}
              >
                <span className={cn('flex-shrink-0 w-8 h-8 rounded-full text-white flex items-center justify-center', row.accent)}>
                  <row.icon className="w-4 h-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-bold text-[#1e2a5a] dark:text-gray-100">{row.title}</p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-snug">{row.description}</p>
                  {row.onClick && (
                    <p className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 mt-0.5">Review questions</p>
                  )}
                </div>
                <span className="flex-shrink-0 flex items-center gap-1 text-[12px] font-bold text-gray-500 dark:text-gray-400 text-right whitespace-nowrap">
                  {row.count}
                  {row.onClick && <ChevronRight className="w-3.5 h-3.5" />}
                </span>
              </Row>
            );
          })}
        </ReportCard>
      )}

      <div className="rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900 p-3.5">
        <p className="inline-flex items-center gap-1.5 text-[12px] font-bold text-indigo-700 dark:text-indigo-300 mb-2">
          <Lightbulb className="w-3.5 h-3.5" /> What this means for you
        </p>
        <ul className="space-y-1 text-[11px] text-indigo-900/80 dark:text-indigo-200">
          {isLive && clusters!.length > 0 ? (
            clusters!.slice(0, 3).map(c => (
              <li key={c.category}>
                • {CATEGORY_DISPLAY[c.category].title} shows up across {c.count} question{c.count === 1 ? '' : 's'} — {c.sample_reason}
              </li>
            ))
          ) : (
            <>
              <li>• Your errors are not random — there are clear patterns in some areas.</li>
              <li>• Focus on repeated patterns first, as they can lead to the biggest improvement.</li>
              <li>• For errors where the cause cannot be determined, we recommend a general concept review and more practice.</li>
            </>
          )}
        </ul>
      </div>
    </div>
  );
}
