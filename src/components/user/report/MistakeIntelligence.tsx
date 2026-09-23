/**
 * "Mistake Intelligence" (mockup screen 6).
 *
 * Renders `analysis.error_intelligence` — this attempt's actual wrong answers,
 * classified one at a time from the question/options/explanation alone, never
 * from timing or the answer choice alone.
 *
 * Every wrong answer is shown somewhere on this screen. It used not to be: the
 * backend kept only the categories clearing its display thresholds and dropped
 * the rest, so an attempt with 122 wrong answers rendered three rows totalling
 * 22 questions with no denominator anywhere — the screen read as though 100
 * mistakes had simply not happened. The thresholds still decide what may be
 * called a *confirmed* repeated pattern; they no longer decide what appears.
 * The three bands below (confirmed, emerging, cause not established) sum to the
 * attempt's incorrect count, and that total is stated at the top.
 *
 * This screen renders nothing at all until the real analysis exists. It used
 * to fall back to a fixed, illustrative list of patterns and counts while the
 * section was still generating — content that looked exactly like analysis but
 * described no attempt in particular. `ReportGate` in the page above now holds
 * the screen until `error_intelligence` has actually arrived, so there is no
 * "meanwhile" left to fill.
 */
import { useNavigate } from 'react-router-dom';
import { XCircle, Target, AlertCircle, HelpCircle, ClipboardList, Lightbulb, ArrowLeft, Sparkles, ChevronRight } from 'lucide-react';
import type { AttemptReportModel } from '@/lib/attempt-report';
import type {
  AttemptAnalysisResponse,
  AttemptAnalysisErrorCluster,
  AttemptAnalysisErrorIntelligence,
  MistakeCategory,
} from '@/lib/userPortalApi';
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
  cannot_determine: { icon: HelpCircle, accent: 'bg-slate-400', title: 'Cause not determinable from the answer alone' },
};

type Normalized = AttemptAnalysisErrorIntelligence & {
  /**
   * True when the coverage numbers were reconstructed from an older backend's
   * bare cluster array rather than reported by it — the residue then lumps
   * below-threshold categories in with the genuinely undeterminable ones, so
   * the third band is worded more cautiously and isn't clickable.
   */
  derived: boolean;
};

const isCluster = (c: unknown): c is AttemptAnalysisErrorCluster =>
  !!c && typeof c === 'object' && (c as AttemptAnalysisErrorCluster).category in CATEGORY_DISPLAY;

/**
 * One shape out of three possible inputs: the current object, an older
 * backend's bare cluster array, or something unrecognised (a deploy lagging
 * far enough behind that `error_intelligence` still holds the pre-redesign
 * `pattern`/`student_message` shape — reading `.category` off those would
 * throw rather than degrade, so they must resolve to `null`, not an empty
 * result).
 */
function normalize(
  raw: AttemptAnalysisResponse['error_intelligence'],
  reportIncorrect: number,
): Normalized | null {
  if (Array.isArray(raw)) {
    if (!raw.every(isCluster)) return null;
    const all = raw.map(c => ({ ...c, tier: c.tier ?? ('confirmed' as const) }));
    // `cannot_determine` belongs in the residue band, not ranked among the
    // patterns — an older backend could in principle emit it as a cluster of
    // its own, and it would then be counted and shown twice.
    const patterns = all.filter(c => c.category !== 'cannot_determine');
    const tagged = all.filter(c => c.category === 'cannot_determine');
    const shown = patterns.reduce((n, c) => n + c.count, 0);
    const taggedCount = tagged.reduce((n, c) => n + c.count, 0);
    // An older backend reported no denominator, so the report's own incorrect
    // count supplies it and everything it didn't show becomes the residue.
    // Clamped at zero: a mismatch must never render a negative band.
    const residue = Math.max(taggedCount, reportIncorrect - shown);
    return {
      derived: true,
      total_incorrect: shown + residue,
      patterns,
      undetermined: { count: residue, question_ids: tagged.flatMap(c => c.supporting_question_ids) },
      coverage: {
        confirmed: patterns.filter(p => p.tier === 'confirmed').reduce((n, c) => n + c.count, 0),
        emerging: patterns.filter(p => p.tier === 'emerging').reduce((n, c) => n + c.count, 0),
        undetermined: residue,
      },
    };
  }

  if (!raw || typeof raw !== 'object') return null;
  const o = raw as AttemptAnalysisErrorIntelligence;
  if (!Array.isArray(o.patterns) || !o.coverage) return null;

  // A category this build has no display entry for — a backend that has added
  // one to its vocabulary since this bundle shipped. Folded into the residue
  // with its questions kept, rather than rejecting the whole payload and
  // discarding the payload: one unknown row must not cost the aspirant the
  // other real ones, which is the same mistake the backend's own
  // all-or-nothing chunk validation used to make.
  const known = o.patterns.filter(isCluster);
  // Typed loosely on purpose: these are rows this build does not recognise, so
  // only the two fields needed to fold them into the residue are read, both
  // defensively.
  const unknown = (o.patterns as unknown[]).filter(
    c => !isCluster(c),
  ) as Array<Partial<AttemptAnalysisErrorCluster> | null | undefined>;
  if (unknown.length === 0) {
    return { ...o, derived: false, undetermined: o.undetermined ?? { count: 0, question_ids: [] } };
  }

  const unknownCount = unknown.reduce((n, c) => n + (c?.count ?? 0), 0);
  const base = o.undetermined ?? { count: 0, question_ids: [] };
  return {
    ...o,
    derived: false,
    patterns: known,
    undetermined: {
      count: base.count + unknownCount,
      question_ids: [...base.question_ids, ...unknown.flatMap(c => c?.supporting_question_ids ?? [])],
    },
    coverage: {
      confirmed: known.filter(c => c.tier !== 'emerging').reduce((n, c) => n + c.count, 0),
      emerging: known.filter(c => c.tier === 'emerging').reduce((n, c) => n + c.count, 0),
      undetermined: base.count + unknownCount,
    },
  };
}

function CoverageBar({ coverage, total }: { coverage: Normalized['coverage']; total: number }) {
  const bands = [
    { key: 'confirmed', label: 'Confirmed patterns', value: coverage.confirmed, swatch: 'bg-rose-500' },
    { key: 'emerging', label: 'Emerging', value: coverage.emerging, swatch: 'bg-amber-400' },
    { key: 'undetermined', label: 'Cause unclear', value: coverage.undetermined, swatch: 'bg-slate-300 dark:bg-slate-600' },
  ].filter(b => b.value > 0);

  if (total === 0) return null;

  return (
    <ReportCard>
      <p className="text-[13px] font-bold text-[#1e2a5a] dark:text-gray-100">
        All {total} incorrect answer{total === 1 ? '' : 's'} reviewed
      </p>
      <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
        Each one is counted in exactly one band below — nothing is left out of this screen.
      </p>
      <div className="mt-3 flex h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
        {bands.map(b => (
          <div key={b.key} className={cn('h-full', b.swatch)} style={{ width: `${(b.value / total) * 100}%` }} />
        ))}
      </div>
      <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1.5">
        {bands.map(b => (
          <span key={b.key} className="inline-flex items-center gap-1.5 text-[11px] text-gray-600 dark:text-gray-300">
            <span className={cn('w-2 h-2 rounded-full flex-shrink-0', b.swatch)} />
            <span className="font-semibold">{b.value}</span> {b.label}
          </span>
        ))}
      </div>
    </ReportCard>
  );
}

interface PatternRow {
  key: string;
  icon: typeof XCircle;
  accent: string;
  title: string;
  description: string;
  count: string;
  onClick?: () => void;
}

function PatternRows({ rows }: { rows: PatternRow[] }) {
  return (
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
  );
}

function SectionHeading({ title, note }: { title: string; note: string }) {
  return (
    <div className="pt-1">
      <p className="text-[12px] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">{title}</p>
      <p className="text-[11px] text-gray-400 dark:text-gray-500 leading-snug">{note}</p>
    </div>
  );
}

export function MistakeIntelligence({
  model,
  analysis,
}: {
  model: AttemptReportModel;
  /** The backend pipeline's output, when ready — see the module doc comment above. */
  analysis?: AttemptAnalysisResponse | null;
}) {
  const navigate = useNavigate();
  const attemptId = model.meta.attemptId;
  const data = normalize(analysis?.error_intelligence, model.summary.incorrect);

  const goToQuestions = (questionIds: string[]) => {
    if (questionIds.length === 0) return;
    // A category's supporting questions aren't guaranteed to share one
    // subject — resolve from whichever question is first, and let the
    // filtered Question Insights page itself resolve each row's own
    // subject for its "View" link (see SubjectQuestionsPage.tsx).
    const firstSubject = model.subjects.find(s => s.questionIds.includes(questionIds[0]));
    const subjectId = firstSubject?.subjectId ?? model.subjects[0]?.subjectId;
    if (!subjectId) return;
    navigate(`/user/report/${attemptId}/subjects/${subjectId}/questions?ids=${questionIds.join(',')}`);
  };

  const toRow = (c: AttemptAnalysisErrorCluster): PatternRow => ({
    key: c.category,
    icon: CATEGORY_DISPLAY[c.category].icon,
    accent: CATEGORY_DISPLAY[c.category].accent,
    title: CATEGORY_DISPLAY[c.category].title,
    description: c.sample_reason,
    count: `${c.count} question${c.count === 1 ? '' : 's'}`,
    onClick: () => goToQuestions(c.supporting_question_ids),
  });

  const confirmed = data ? data.patterns.filter(p => p.tier !== 'emerging') : [];
  const emerging = data ? data.patterns.filter(p => p.tier === 'emerging') : [];
  const undetermined = data?.undetermined ?? { count: 0, question_ids: [] };

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
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Every incorrect answer in this attempt, grouped by what went wrong
          </p>
        </div>
        {data && (
          <span className="flex-shrink-0 inline-flex items-center gap-1 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 rounded-full px-2.5 py-1">
            <Sparkles className="w-3 h-3" /> AI-analyzed
          </span>
        )}
      </div>

      {!data ? (
        // Only reachable if the backend sends a shape this build cannot read
        // at all — ReportGate has already held the screen back until
        // `error_intelligence` is present. It says so plainly rather than
        // showing anything invented.
        <ReportCard className="text-center py-8">
          <p className="text-[13px] font-semibold text-gray-700 dark:text-gray-200">
            This analysis could not be read.
          </p>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
            Your answers are safe. Try reloading the report — if it keeps happening, the app needs an update.
          </p>
        </ReportCard>
      ) : data.total_incorrect === 0 ? (
        <ReportCard className="text-center py-8">
          <p className="text-[13px] font-semibold text-gray-700 dark:text-gray-200">
            No incorrect answers to analyse in this attempt.
          </p>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
            Nothing to group here — every attempted question was either correct or skipped.
          </p>
        </ReportCard>
      ) : (
        <>
          <CoverageBar coverage={data.coverage} total={data.total_incorrect} />

          {confirmed.length > 0 && (
            <>
              <SectionHeading
                title="Confirmed patterns"
                note="Repeated often and consistently enough to act on first."
              />
              <PatternRows rows={confirmed.map(toRow)} />
            </>
          )}

          {emerging.length > 0 && (
            <>
              <SectionHeading
                title="Emerging patterns"
                note="Real mistakes of the same kind, but too few or too uncertain to call a settled pattern yet."
              />
              <PatternRows rows={emerging.map(toRow)} />
            </>
          )}

          {confirmed.length === 0 && emerging.length === 0 && (
            <ReportCard className="text-center py-6">
              <p className="text-[13px] font-semibold text-gray-700 dark:text-gray-200">
                No repeated mistake pattern confirmed yet.
              </p>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                We could identify what was wrong on each question, but not reliably why it was chosen.
              </p>
            </ReportCard>
          )}

          {undetermined.count > 0 && (
            <>
              <SectionHeading
                title="Cause not established"
                note={
                  data.derived
                    ? 'Counted from this attempt, but this report predates per-question cause tracking.'
                    : 'Reviewed one by one — the selected answer does not show why it was chosen.'
                }
              />
              <PatternRows
                rows={[
                  {
                    key: 'undetermined',
                    icon: HelpCircle,
                    accent: 'bg-slate-400',
                    title: 'Cause not determinable from the answer alone',
                    description:
                      'A wrong option on its own does not prove whether it was a concept gap, a slip or a guess. Reviewing these questions yourself is the fastest way to find out.',
                    count: `${undetermined.count} question${undetermined.count === 1 ? '' : 's'}`,
                    onClick:
                      undetermined.question_ids.length > 0
                        ? () => goToQuestions(undetermined.question_ids)
                        : undefined,
                  },
                ]}
              />
            </>
          )}
        </>
      )}

      <div className="rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900 p-3.5">
        <p className="inline-flex items-center gap-1.5 text-[12px] font-bold text-indigo-700 dark:text-indigo-300 mb-2">
          <Lightbulb className="w-3.5 h-3.5" /> What this means for you
        </p>
        <ul className="space-y-1 text-[11px] text-indigo-900/80 dark:text-indigo-200">
          {data && data.total_incorrect > 0 ? (
            <>
              {confirmed.slice(0, 3).map(c => (
                <li key={c.category}>
                  • {CATEGORY_DISPLAY[c.category].title} shows up across {c.count} question
                  {c.count === 1 ? '' : 's'} — {c.sample_reason}
                </li>
              ))}
              {emerging.length > 0 && (
                <li>
                  • Another {data.coverage.emerging} wrong answer{data.coverage.emerging === 1 ? '' : 's'} fall into{' '}
                  {emerging.length} pattern{emerging.length === 1 ? '' : 's'} that {emerging.length === 1 ? 'is' : 'are'}{' '}
                  not settled yet — worth watching in your next attempt to see whether{' '}
                  {emerging.length === 1 ? 'it repeats' : 'they repeat'}.
                </li>
              )}
              {undetermined.count > 0 && (
                <li>
                  • For {data.coverage.undetermined} of your {data.total_incorrect} wrong answers, the cause cannot be
                  read off the answer alone. Going through those questions yourself is what turns the largest slice of
                  this screen into something you can act on.
                </li>
              )}
            </>
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
