import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Download, Sparkles, AlertTriangle, CheckCircle2, XCircle, Brain, Clock, Target, TrendingUp, Trophy } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { useUserPortal } from '@/contexts/UserPortalContext';
import {
  getAttemptDetail,
  type AttemptDetailResponse,
  type StrengthItem,
  type ImprovementAreaItem,
  type QuestionReviewItem,
  type OverallDistribution,
  type SubjectBreakdown,
  type FeedbackStrength,
  type FeedbackImprovement,
  type AttemptBadge,
  type TopicPerformance,
  type TopicFocus,
} from '@/lib/userPortalApi';
import { MathText } from '@/components/ui/MathText';
import { parseOptionRepr } from '@/lib/question-text';
import { orderBySection, stageForSubjects, stageForTitle } from '@/config/tnpsc';
import { MarkdownText } from '@/components/ui/MarkdownText';
import { buildUrl } from '@/lib/api';
import { SkhcReport } from '@/components/user/SkhcReport';
import { ProgressReportView } from '@/components/user/ProgressReportView';
import { useProgressReport } from '@/hooks/use-progress-report';
import { resolveGroupKey } from '@/hooks/use-progress-trend';
import { resolveExamContext, type ExamContext } from '@/lib/exam-report-config';
import { useTnpscCatalog } from '@/hooks/use-tnpsc';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { translationOf, type LangMode } from '@/lib/question-language';
import { ReportLanguageProvider, type ReportLanguage } from '@/components/user/report-ui';
import { cn } from '@/lib/utils';
import { buildAttemptReport } from '@/lib/attempt-report';

/** Rows per page in the question table — a full 200-question paper needs paging. */
const QUESTIONS_PER_PAGE = 25;
import {
  AttemptSummary,
  CoverageAnalysis,
  QuestionInsightsTable,
  ReportCover,
  ReportTitleRow,
  KeyTakeawaysAndNextSteps,
  PerformanceSnapshot,
  QuestionErrorAnalysis,
  QuestionInsightsToolbar,
  StrengthsAndGaps,
  SubjectPerformance,
  type ResultFilter,
} from '@/components/user/AttemptDiagnosticReport';

interface ReportBodyProps {
  attempt: any;
  canDownloadPDF: boolean;
}

// ── Option display helpers ─────────────────────────────────────────────────────

const OPTION_LETTERS = ['a', 'b', 'c', 'd', 'e', 'f'];
const OPTION_LABELS = ['A', 'B', 'C', 'D', 'E', 'F'];

/** True if the string is an image path/URL (so an image option renders as a picture, not text). */
function isImageUrl(s: string): boolean {
  return /^\/static\//i.test(s) ||
    /\.(png|jpe?g|webp|gif|svg)(\?|#|$)/i.test(s) ||
    (/^https?:\/\//i.test(s) && /\.(png|jpe?g|webp|gif|svg)/i.test(s));
}

/** Look up an option by letter — supports an array (indexed) or a {A: …} map. */
function optionAt(options: any, key: string, idx: number): any {
  if (Array.isArray(options)) return idx >= 0 ? options[idx] : undefined;
  if (options && typeof options === 'object') return options[key?.toUpperCase()] ?? options[key] ?? undefined;
  return undefined;
}

function resolveAnswerLabel(key: string | null, options: any): { label: string; text: string | null; image_url: string | null } {
  if (!key) return { label: '—', text: null, image_url: null };
  const idx = OPTION_LETTERS.indexOf(key.toLowerCase());
  const label = idx >= 0 ? OPTION_LABELS[idx] : key.toUpperCase();
  const opt = optionAt(options, key, idx);
  if (opt && typeof opt === 'object') {
    return { label, text: opt.text ?? null, image_url: opt.image_url ?? opt.imageUrl ?? null };
  }
  // An image option serialised by Python's str() rather than as JSON — the URL is
  // in there, so recover it instead of printing the dict.
  const rich = parseOptionRepr(opt);
  if (rich) return { label, text: rich.text, image_url: rich.image_url };

  if (opt != null && opt !== '') {
    const raw = String(opt);
    if (isImageUrl(raw)) return { label, text: null, image_url: raw };
    return { label, text: raw.replace(/^[A-Fa-f][.)]\s*/, '').trim() || raw, image_url: null };
  }
  return { label, text: null, image_url: null };
}

function reasonLabel(reason: string): string {
  switch (reason) {
    case 'tab_violations': return 'Tab violations';
    case 'time_expired': return 'Time expired';
    case 'browser_close': return 'Browser closed';
    case 'manual': return 'Manual submit';
    default: return reason.replace(/_/g, ' ');
  }
}

function formatEvent(ev: any): string {
  if (typeof ev === 'string') return ev;
  if (ev && typeof ev === 'object') {
    const type = String(ev.event_type ?? ev.type ?? 'event');
    const ts = ev.timestamp ?? ev.time ?? null;
    const d = ts ? new Date(ts) : null;
    return d && !isNaN(d.getTime()) ? `${type} · ${d.toLocaleString('en-IN')}` : type;
  }
  return String(ev);
}
function BadgeTile({ badge }: { badge: AttemptBadge }) {
  return (
    <div
      className={cn(
        'relative rounded-xl border p-3 flex flex-col items-center text-center gap-1 transition-all',
        badge.earned
          ? 'bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-950/30 dark:to-yellow-950/20 border-amber-300 dark:border-amber-700 shadow-sm'
          : 'bg-gray-50 dark:bg-gray-800/40 border-dashed border-gray-200 dark:border-gray-700 opacity-60',
      )}
      title={badge.criteria}
    >
      {badge.earned && (
        <CheckCircle2 className="absolute top-1.5 right-1.5 w-3.5 h-3.5 text-emerald-500" />
      )}
      <span className={cn('text-2xl leading-none', !badge.earned && 'grayscale')}>{badge.icon}</span>
      <span className="text-xs font-bold text-gray-800 dark:text-gray-200 leading-tight">{badge.title}</span>
      <span className="text-[10px] text-gray-400 leading-tight">{badge.criteria}</span>
    </div>
  );
}

function BadgesPanel({ badges }: { badges: AttemptBadge[] }) {
  const earnedLevel = badges.find(b => b.group === 'level' && b.earned);
  const earnedCount = badges.filter(b => b.earned).length;
  // Earned badges first
  const sorted = [...badges].sort((a, b) => Number(b.earned) - Number(a.earned));

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Trophy className="w-4 h-4 text-amber-500" />
        <h3 className="font-semibold text-gray-800 dark:text-gray-200 text-sm">Badges</h3>
        <span className="ml-auto text-xs text-gray-400">{earnedCount} of {badges.length} earned</span>
      </div>

      {/* Earned level highlight */}
      {earnedLevel && (
        <div className="flex items-center gap-3 mb-4 rounded-xl bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/40 dark:to-purple-950/30 border border-indigo-100 dark:border-indigo-900/40 p-3">
          <span className="text-3xl leading-none">{earnedLevel.icon}</span>
          <div className="min-w-0">
            <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{earnedLevel.title}</p>
            {earnedLevel.message && (
              <p className="text-xs text-gray-600 dark:text-gray-400 leading-snug">{earnedLevel.message}</p>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2">
        {sorted.map(b => (
          <BadgeTile key={b.id} badge={b} />
        ))}
      </div>
    </div>
  );
}
function QuestionCard({
  q,
  index,
  forceExpanded,
  langMode = 'both',
}: {
  q: QuestionReviewItem;
  index: number;
  forceExpanded?: boolean;
  /** Which language(s) of a bilingual paper to show. Ignored on a single-language one. */
  langMode?: LangMode;
}) {
  const [expanded, setExpanded] = useState(false);
  const isOpen = forceExpanded || expanded;

  // The stored answer stays in the paper's primary language whatever is on
  // screen — it is what grading matched against, so translating it would print
  // something the aspirant never chose.
  const showPrimary = langMode !== 'translation';
  const tr = translationOf(q, langMode !== 'primary');
  const userAns = resolveAnswerLabel(q.user_answer, q.options);
  const correctAns = resolveAnswerLabel(q.correct_answer, q.options);

  // The stem can arrive as plain text or — like the options on image questions —
  // as a stringified dict carrying the picture. Normalise before deciding.
  const stem = parseOptionRepr(q.body) ?? { text: q.body ?? null, image_url: null };
  // Blank-but-present bodies are common (" ", "\n"). Treated as text they render
  // nothing *and* used to suppress the image, which is how an image-only question
  // ended up showing neither.
  const stemText = stem.text && stem.text.trim() ? stem.text : null;
  const stemImage = stem.image_url || q.attachment_url || q.question_image_url || null;

  const borderColor = !q.user_answer
    ? 'border-gray-200'
    : q.is_correct
    ? 'border-emerald-200'
    : 'border-red-200';

  const badgeBg = !q.user_answer
    ? 'bg-gray-100 text-gray-500'
    : q.is_correct
    ? 'bg-emerald-100 text-emerald-700'
    : 'bg-red-100 text-red-700';

  return (
    <div className={`border rounded-xl overflow-hidden ${borderColor}`}>
      <button
        className="w-full text-left p-4 flex items-start gap-3 hover:bg-gray-50/60 transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        <span
          className={`flex-shrink-0 w-7 h-7 rounded-lg text-xs font-bold flex items-center justify-center ${badgeBg}`}
        >
          {index + 1}
        </span>
        <div className="flex-1 min-w-0">
          {showPrimary && stemText && (
            <p className={`text-sm text-gray-800 leading-snug ${isOpen ? 'whitespace-pre-wrap' : 'line-clamp-2'}`}>
              <MathText text={stemText} />
            </p>
          )}
          {/* The other language sits under the stem rather than replacing it in
              'both' mode, which is how the test screen shows it. */}
          {tr?.text && tr.text.trim() && (
            <p
              className={`text-sm leading-snug ${showPrimary ? 'text-gray-500 mt-1' : 'text-gray-800'} ${
                isOpen ? 'whitespace-pre-wrap' : 'line-clamp-2'
              }`}
            >
              <MathText text={tr.text} />
            </p>
          )}
          {/* Shown whenever there is one — a question can have both a stem and a
              diagram, and the old `!body &&` guard hid the diagram in that case. */}
          {stemImage && (
            <img
              src={buildUrl(stemImage)}
              alt={`Question ${index + 1}`}
              className="max-h-40 rounded-lg border border-gray-200 object-contain"
            />
          )}
          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
            {q.subject && (
              <span className="text-[10px] bg-blue-50 text-blue-600 border border-blue-100 px-1.5 py-0.5 rounded font-medium">
                {q.subject}
              </span>
            )}
            {q.time_spent_seconds > 0 && (
              <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
                <Clock className="w-3 h-3" />
                {q.time_spent_seconds}s
              </span>
            )}
          </div>
        </div>
        <div className="flex-shrink-0">
          {!q.user_answer ? (
            <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-1 rounded-full font-semibold">
              Skipped
            </span>
          ) : q.is_correct ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
          ) : (
            <XCircle className="w-5 h-5 text-red-500" />
          )}
        </div>
      </button>

      {isOpen && (
        <div className="border-t border-gray-100 p-4 bg-gray-50/40 space-y-3">
          {/* Shared passage / context (reading-comprehension groups) */}
          {(q as any).passage && (
            <div className="bg-white border border-gray-200 rounded-lg px-3 py-2.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-500 mb-1">Passage</p>
              <MarkdownText text={(q as any).passage} className="text-gray-700" />
            </div>
          )}
          {/* Answer comparison */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div
              className={`rounded-lg px-3 py-2.5 border ${
                q.user_answer
                  ? q.is_correct
                    ? 'bg-emerald-50 border-emerald-200'
                    : 'bg-red-50 border-red-200'
                  : 'bg-gray-50 border-gray-200'
              }`}
            >
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">Your answer</p>
              {q.user_answer ? (
                <div className="flex items-center gap-2">
                  <span
                    className={`flex-shrink-0 w-6 h-6 rounded font-bold text-xs flex items-center justify-center ${
                      q.is_correct ? 'bg-emerald-200 text-emerald-800' : 'bg-red-200 text-red-800'
                    }`}
                  >
                    {userAns.label}
                  </span>
                  {userAns.image_url ? (
                    <img src={buildUrl(userAns.image_url)} alt="Your answer" className="max-h-24 rounded border border-gray-200 object-contain" />
                  ) : userAns.text ? (
                    <span className="text-sm text-gray-800 leading-snug">
                      <MathText text={userAns.text} />
                    </span>
                  ) : null}
                </div>
              ) : (
                <span className="text-sm text-gray-400 italic">Not answered</span>
              )}
            </div>

            <div className="rounded-lg px-3 py-2.5 border bg-emerald-50 border-emerald-200">
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">Correct answer</p>
              <div className="flex items-center gap-2">
                <span className="flex-shrink-0 w-6 h-6 rounded bg-emerald-200 text-emerald-800 font-bold text-xs flex items-center justify-center">
                  {correctAns.label}
                </span>
                {correctAns.image_url ? (
                  <img src={buildUrl(correctAns.image_url)} alt="Correct answer" className="max-h-24 rounded border border-gray-200 object-contain" />
                ) : correctAns.text ? (
                  <span className="text-sm text-gray-800 leading-snug">
                    <MathText text={correctAns.text} />
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          {/* Explanation */}
          {q.explanation && (
            <div className="bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-500 mb-1">Explanation</p>
              {showPrimary && <p className="text-sm text-indigo-900 leading-relaxed">{q.explanation}</p>}
              {tr?.explanation && tr.explanation.trim() && (
                <p className={`text-sm leading-relaxed ${showPrimary ? 'text-indigo-700/80 mt-1.5' : 'text-indigo-900'}`}>
                  {tr.explanation}
                </p>
              )}
            </div>
          )}

          {/* Tip */}
          {q.tip && (
            <div className="bg-amber-50 border border-amber-100 rounded-lg px-3 py-2.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-amber-600 mb-1">Study tip</p>
              <p className="text-sm text-amber-900 leading-relaxed">{q.tip}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function ReportBody({ attempt, canDownloadPDF }: ReportBodyProps) {
  const { courses, user, history } = useUserPortal();
  const { groups } = useTnpscCatalog();
  const [detail, setDetail] = useState<AttemptDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);

  useEffect(() => {
    setLoading(true);
    setFetchError(false);
    getAttemptDetail(attempt.attempt_id)
      .then(setDetail)
      .catch(() => setFetchError(true))
      .finally(() => setLoading(false));
  }, [attempt.attempt_id]);

  const courseName = attempt.course_id
    ? (courses.find((c: any) => c.course_id === attempt.course_id)?.name ?? null)
    : null;

  /**
   * The Progress tab's content, built from the attempt history rather than the
   * server's SKHC payload. Needs two attempts before it can compare anything.
   */
  const submitted = useMemo(
    () => history.filter(h => h.status !== 'in_progress' && h.percentage != null),
    [history],
  );
  /**
   * Scoped to the exam this attempt belongs to, so the Progress tab beside a
   * Group 4 result compares Group 4 attempts and nothing else.
   */
  const progressGroupId = resolveGroupKey((attempt as any).group_id ?? user?.preferred_exam);

  const { model: progressModel } = useProgressReport({
    attempts: submitted,
    groupId: progressGroupId,
    enabled: submitted.length >= 2,
  });

  /**
   * The exam this attempt belongs to, so the report can read its marking scheme,
   * duration and syllabus rather than assume product defaults.
   *
   * The detail response now states it outright (`group_id` / `stage_id` on the
   * attempt), which is exact. The history row is tried next, and only then the
   * exam the aspirant registered for — a guess that is wrong for anyone sitting a
   * different exam's paper, so it is the last resort rather than the first.
   */
  const examContext = useMemo(() => {
    const fromDetail = (detail as any)?.attempt ?? {};
    return resolveExamContext(
      {
        groupId: fromDetail.group_id ?? (attempt as any).group_id ?? user?.preferred_exam ?? null,
        stageId: fromDetail.stage_id ?? (attempt as any).stage_id ?? null,
      },
      groups,
    );
  }, [detail, attempt, user?.preferred_exam, groups]);

  return (
    <AttemptReport
      detail={detail}
      attempt={attempt}
      courseName={courseName}
      canDownloadPDF={canDownloadPDF}
      loading={loading}
      fetchError={fetchError}
      examContext={examContext}
      studentName={user?.name ?? 'Student'}
      progressView={
        progressModel && submitted.length >= 2 ? (
          <ProgressReportView
            model={progressModel}
            studentName={user?.name ?? 'You'}
            examName={examContext?.examName ?? null}
          />
        ) : undefined
      }
    />
  );
}

/**
 * Presentational report — renders the full student-style report from an already-fetched
 * AttemptDetailResponse. Decoupled from the user fetch/context so admin can reuse it.
 */
export function AttemptReport({
  detail,
  attempt,
  courseName,
  canDownloadPDF,
  loading = false,
  fetchError = false,
  progressView,
  examContext = null,
  studentName = 'Student',
}: {
  detail: AttemptDetailResponse | null;
  attempt: any;
  courseName: string | null;
  canDownloadPDF: boolean;
  loading?: boolean;
  fetchError?: boolean;
  /**
   * The rebuilt multi-attempt Progress Report. Supplied by the student portal,
   * which has the attempt history; the admin view leaves it undefined and falls
   * back to whatever `skhc_report` the payload carried.
   */
  progressView?: React.ReactNode;
  /** The selected exam's configuration — marking scheme, duration, syllabus. */
  examContext?: ExamContext | null;
  /** Shown on the cover. Admin passes the candidate; the portal passes the aspirant. */
  studentName?: string;
}) {
  const navigate = useNavigate();
  const [expandAll, setExpandAll] = useState(false);
  /** Which subject's inline deep dive is open, and which subject filters the questions. */
  const [openSubject, setOpenSubject] = useState<string | null>(null);
  const [questionSubject, setQuestionSubject] = useState<string | null>(null);
  const [resultFilter, setResultFilter] = useState<ResultFilter>('all');
  const [questionPage, setQuestionPage] = useState(1);
  const [openQuestion, setOpenQuestion] = useState<string | null>(null);
  /**
   * Which language the question stems are read in.
   *
   * Opens on 'both', matching the test screen: an aspirant who sat a bilingual
   * paper read both columns then, and a review that silently drops one of them
   * is not the paper they sat.
   */
  const [questionLang, setQuestionLang] = useState<LangMode>('both');
  /**
   * The language the report's labels are read in.
   *
   * Fixed to English while the toggle is hidden: subject labels resolve to the
   * exam catalog's English names, which is what a report shared with a teacher or
   * a parent needs to read as. Everything the toggle drove is still in place —
   * `ReportLanguageProvider`, `useLabel`, both labels on every subject and topic
   * — so restoring it is a `useState` here plus the two props on the title row.
   */
  const language: ReportLanguage = 'en';

  /**
   * One normalized model behind every analytic section (§22.5). Built from the
   * detail payload only — without it there is nothing to diagnose, and the report
   * says so rather than rendering empty charts.
   */
  const model = useMemo(
    () => (detail ? buildAttemptReport(detail, {}, examContext) : null),
    [detail, examContext],
  );

  const questionCounts = useMemo(() => {
    const list = model?.questions ?? [];
    const answered = (q: any) => q.user_answer != null && String(q.user_answer).trim() !== '';
    return {
      all: list.length,
      correct: list.filter(q => answered(q) && q.is_correct).length,
      incorrect: list.filter(q => answered(q) && !q.is_correct).length,
      skipped: list.filter(q => !answered(q)).length,
    };
  }, [model]);

  useEffect(() => {
    setQuestionPage(1);
    setOpenQuestion(null);
  }, [resultFilter, questionSubject]);

  const visibleQuestions = useMemo(() => {
    const list = model?.questions ?? [];
    const subjectName = questionSubject
      ? model?.subjects.find(sub => sub.subjectId === questionSubject)?.name ?? null
      : null;
    return list.filter(q => {
      if (subjectName && (q.subject ?? '').trim() !== subjectName) return false;
      const answered = q.user_answer != null && String(q.user_answer).trim() !== '';
      if (resultFilter === 'correct') return answered && q.is_correct;
      if (resultFilter === 'incorrect') return answered && !q.is_correct;
      if (resultFilter === 'skipped') return !answered;
      return true;
    });
  }, [model, questionSubject, resultFilter]);
  const dateStr = attempt.start_time
    ? new Date(attempt.start_time).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : '—';

  // Use detail data if loaded, fall back to list data (admin /detail may omit `attempt`)
  const score = detail?.attempt?.score ?? (detail as any)?.score ?? attempt.score;
  const maxScore = detail?.attempt?.max_score ?? (detail as any)?.max_score ?? attempt.max_score ?? null;
  const pct = detail?.attempt?.percentage ?? (detail as any)?.percentage ?? attempt.percentage;
  const pctRounded = pct != null ? Math.round(pct) : null;
  const status = detail?.attempt?.status ?? (detail as any)?.status ?? attempt.status;
  const autoSubmitted = detail?.attempt?.auto_submitted ?? (detail as any)?.auto_submitted ?? attempt.auto_submitted;

  // Test integrity / violations — gathered defensively (admin & student payloads differ).
  const attemptMeta: any =
    (detail?.attempt as any)?.attempt_metadata ?? (detail as any)?.attempt_metadata ?? (attempt as any)?.attempt_metadata ?? {};
  const malpracticeEvents: any[] =
    (detail?.attempt?.malpractice_events as any[]) ?? (attempt.malpractice_events as any[]) ?? [];
  const tabViolations: number =
    attemptMeta.tab_violations ?? (Array.isArray(malpracticeEvents) ? malpracticeEvents.length : 0);
  const submitReason: string | null = attemptMeta.submit_reason ?? null;
  const hasIntegrityInfo = tabViolations > 0 || malpracticeEvents.length > 0 || !!autoSubmitted;

  const timeTakenMin =
    detail?.stats?.time_taken_seconds
      ? Math.round(detail.stats.time_taken_seconds / 60)
      : attempt.end_time && attempt.start_time
      ? Math.round((new Date(attempt.end_time).getTime() - new Date(attempt.start_time).getTime()) / 60000)
      : null;

  const scoreDisplay =
    score != null
      ? maxScore != null
        ? `${score} / ${maxScore}`
        : String(score)
      : '—';

  const passed = pctRounded != null && pctRounded >= 40;

  // ── Loading skeleton ───────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-4">
        {/* Header skeleton */}
        <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl p-4 animate-pulse space-y-3">
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-32" />
          <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-2/3" />
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-40" />
          <div className="grid grid-cols-3 gap-2 mt-2">
            {[0, 1, 2].map(i => (
              <div key={i} className="h-12 bg-gray-200 dark:bg-gray-700 rounded-lg" />
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {[0, 1, 2, 3, 4].map(i => (
            <div key={i} className="h-16 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[0, 1].map(i => (
            <div key={i} className="h-40 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <AlertTriangle className="w-8 h-8 text-amber-500" />
        <p className="text-sm text-gray-600 dark:text-gray-400">Could not load report details. Please try again.</p>
      </div>
    );
  }

  const stats = detail?.stats;
  const aiReport = detail?.ai_report;
  // Normalize backend question fields → what the report card reads.
  // Admin attempt-detail sends `question_text`/`text` (student portal sends `body`),
  // and the chosen option as `student_answer` (card reads `user_answer`). Without this
  // remap every answered question shows as "Not answered"/"Skipped".
  const mappedQuestions = (model?.questions ?? []).map((q: any) => ({
    ...q,
    body: q.body ?? q.question_text ?? q.text ?? '',
    passage: q.passage ?? undefined,
    user_answer: q.user_answer ?? q.student_answer ?? null,
    correct_answer: q.correct_answer ?? q.correctAnswer ?? null,
  }));

  // Same section order the paper was sat in, so review numbering matches the exam.
  const reviewStage =
    stageForTitle(
      detail?.attempt?.test_name ?? (detail as any)?.test_name ?? attempt.test_name ?? null,
    ) ?? stageForSubjects(mappedQuestions.map((q: any) => q.subject));
  const questions = orderBySection(reviewStage, mappedQuestions, (q: any) => q.subject);
  const skhc = detail?.skhc_report ?? null;

  // New richer payload
  const pb = detail?.performance_breakdown ?? null;
  const feedback = pb?.feedback ?? null;
  const distribution = pb?.overall_distribution ?? null;
  const subjects = pb?.subject_breakdown ?? [];
  const badges = pb?.badges ?? [];
  const topicPerf = pb?.topic_performance ?? null;

  // Prefer new feedback shape; fall back to legacy ai_report
  const fbStrengths = feedback?.strengths ?? [];
  const fbImprovements = feedback?.improvement_areas ?? [];
  const strengths = aiReport?.strengths ?? [];
  const improvementAreas = aiReport?.improvement_areas ?? [];
  const overallSummary = aiReport?.overall_summary ?? (attempt.analysis_text ?? null);

  // ── Render ────────────────────────────────────────────────────────────────

  const attemptContent = (
    <div className="space-y-5">
      {model && (
        // Download and share are deliberately not wired: the PDF export does not
        // exist yet (the handler only raised "coming soon"), and a shared link
        // needs a viewer who is not signed in as this aspirant. `ReportTitleRow`
        // hides each button when its handler is absent, so passing neither is all
        // it takes — and passing them again is all it takes to bring them back.
        <ReportTitleRow model={model} />
      )}

      {/* ── Diagnostic report (§2 information architecture) ─────────────────
          Every figure comes from the normalized model, so the snapshot, radar,
          matrix and priorities cannot disagree with each other or with the
          question list below. */}
      {model ? (
        <div className="space-y-3 sm:space-y-4">
          <ReportCover
            model={model}
            studentName={studentName}
            examName={examContext?.examName ?? null}
            exam={examContext}
          />
          <AttemptSummary model={model} />
          <PerformanceSnapshot
            model={model}
            onSelectSubject={id => {
              setOpenSubject(id);
              document.getElementById('subject-performance')?.scrollIntoView({ behavior: 'smooth' });
            }}
          />
          <div id="subject-performance">
            <SubjectPerformance
              model={model}
              expanded={openSubject}
              onToggle={id => setOpenSubject(cur => (cur === id ? null : id))}
              onViewQuestions={id => {
                setQuestionSubject(id);
                document.getElementById('question-insights')?.scrollIntoView({ behavior: 'smooth' });
              }}
            />
          </div>
          <CoverageAnalysis model={model} />
          <QuestionErrorAnalysis model={model} />
          <StrengthsAndGaps model={model} />
          <KeyTakeawaysAndNextSteps
            model={model}
            onOpenPlan={
              model.meta.attemptId
                ? () => navigate(`/user/study-plan/${model.meta.attemptId}`)
                : undefined
            }
          />
        </div>
      ) : (
        !loading && (
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Question-level data for this attempt is unavailable, so the diagnostic breakdown cannot be shown.
            </p>
          </div>
        )
      )}

      {/* ── Badges (above question-level review) ── */}
      {badges.length > 0 && <BadgesPanel badges={badges} />}

      {/* ── Question Insights (§8) — the evidence layer ──────────────────────
          Filters exist so a claim made above ("weak in X") can be traced to the
          exact questions that produced it. */}
      {questions.length > 0 && (
        <div
          id="question-insights"
          className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4"
        >
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <Brain className="w-4 h-4 text-indigo-500" />
            <h3 className="font-semibold text-gray-800 dark:text-gray-200 text-sm">Question Insights</h3>
            <span className="text-xs text-gray-400">
              {visibleQuestions.length} of {questions.length}
            </span>
            <button
              onClick={() => setExpandAll(v => !v)}
              className="ml-auto text-xs font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
            >
              {expandAll ? 'Collapse all' : 'Expand all'}
            </button>
          </div>

          {model && (
            <QuestionInsightsToolbar
              model={model}
              lang={questionLang}
              onLang={setQuestionLang}
              result={resultFilter}
              onResult={setResultFilter}
              subject={questionSubject}
              onSubject={setQuestionSubject}
              counts={questionCounts}
            />
          )}

          {visibleQuestions.length === 0 ? (
            <p className="py-8 text-center text-xs text-gray-400">No questions match this filter.</p>
          ) : expandAll ? (
            <div className="space-y-2">
              {visibleQuestions.map((q, i) => (
                <QuestionCard key={q.question_id} q={q} index={i} forceExpanded />
              ))}
            </div>
          ) : (
            <QuestionInsightsTable
              questions={visibleQuestions as any}
              page={questionPage}
              pageSize={QUESTIONS_PER_PAGE}
              onPage={setQuestionPage}
              onOpen={id => setOpenQuestion(cur => (cur === id ? null : id))}
              openId={openQuestion}
              renderDetail={id => {
                const idx = visibleQuestions.findIndex(x => x.question_id === id);
                const q = visibleQuestions[idx];
                return q ? <QuestionCard q={q} index={idx} forceExpanded langMode={questionLang} /> : null;
              }}
            />
          )}
        </div>
      )}

      {/* ── Test integrity / violations ── */}
      {hasIntegrityInfo && (
        <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2.5">
            <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />
            <h3 className="text-sm font-semibold text-red-700 dark:text-red-300">Test Integrity &amp; Violations</h3>
          </div>
          <div className="flex flex-wrap gap-2 mb-2">
            <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300">
              Tab / window switches: {tabViolations}
            </span>
            {autoSubmitted && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">
                Auto-submitted{submitReason ? ` · ${reasonLabel(submitReason)}` : ''}
              </span>
            )}
          </div>
          {malpracticeEvents.length > 0 && (
            <ul className="space-y-1">
              {malpracticeEvents.map((ev: any, i: number) => (
                <li key={i} className="text-xs text-red-700 dark:text-red-300 flex items-center gap-1.5">
                  <XCircle className="w-3 h-3 shrink-0" />
                  {formatEvent(ev)}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );

  const progressTab = progressView ?? (skhc ? <SkhcReport report={skhc} /> : null);

  // Nothing longitudinal to show → the single-attempt breakdown is the report.
  if (!progressTab) {
    return <ReportLanguageProvider language={language}>{attemptContent}</ReportLanguageProvider>;
  }

  /**
   * Two tabs, opening on This Attempt.
   *
   * It used to default to Progress, which meant every rebuilt section opened
   * behind a tab nobody clicked — you asked for a report on one attempt, so that
   * is what should be on screen first.
   */
  return (
    <ReportLanguageProvider language={language}>
      <Tabs defaultValue="attempt" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="attempt">This Attempt</TabsTrigger>
          <TabsTrigger value="progress">Progress</TabsTrigger>
        </TabsList>
        <TabsContent value="attempt" className="mt-4 focus-visible:outline-none">
          {attemptContent}
        </TabsContent>
        <TabsContent value="progress" className="mt-4 focus-visible:outline-none">
          {progressTab}
        </TabsContent>
      </Tabs>
    </ReportLanguageProvider>
  );
}

function StatusBadge({ status, autoSubmitted }: { status: string; autoSubmitted: boolean }) {
  if (status === 'in_progress') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400">
        Incomplete
      </span>
    );
  }
  if (autoSubmitted || status === 'auto_submitted') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
        <AlertTriangle className="w-3 h-3" /> Auto-submitted
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400">
      <CheckCircle2 className="w-3 h-3" /> Submitted
    </span>
  );
}
