import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Download, Sparkles, AlertTriangle, CheckCircle2, XCircle, Brain, Clock, Target } from 'lucide-react';
import { toast } from 'sonner';
import { useUserPortal } from '@/contexts/UserPortalContext';
import {
  getAttemptDetail,
  type AttemptDetailResponse,
  type StrengthItem,
  type ImprovementAreaItem,
  type QuestionReviewItem,
} from '@/lib/userPortalApi';
import { MathText } from '@/components/ui/MathText';
import { cn } from '@/lib/utils';

interface ReportBodyProps {
  attempt: any;
  canDownloadPDF: boolean;
}

// ── Option display helpers ─────────────────────────────────────────────────────

const OPTION_LETTERS = ['a', 'b', 'c', 'd', 'e', 'f'];
const OPTION_LABELS = ['A', 'B', 'C', 'D', 'E', 'F'];

function resolveOptionText(key: string | null, options: string[] | null): string | null {
  if (!key) return null;
  if (!options) return key;
  const idx = OPTION_LETTERS.indexOf(key.toLowerCase());
  if (idx >= 0 && options[idx] !== undefined) {
    const raw = String(options[idx]);
    // Strip leading "A. " / "A) " prefix if present
    return raw.replace(/^[A-Fa-f][.)]\s*/, '').trim() || raw;
  }
  return key;
}

function resolveAnswerLabel(key: string | null, options: string[] | null): { label: string; text: string | null } {
  if (!key) return { label: '—', text: null };
  const idx = OPTION_LETTERS.indexOf(key.toLowerCase());
  const label = idx >= 0 ? OPTION_LABELS[idx] : key.toUpperCase();
  const text = resolveOptionText(key, options);
  return { label, text };
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function StatTile({
  label,
  value,
  tone,
  icon,
}: {
  label: string;
  value: string | number;
  tone: 'green' | 'red' | 'blue' | 'amber' | 'gray';
  icon: React.ReactNode;
}) {
  const colours = {
    green: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    red: 'bg-red-50 border-red-200 text-red-700',
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
    amber: 'bg-amber-50 border-amber-200 text-amber-700',
    gray: 'bg-gray-50 border-gray-200 text-gray-600',
  };
  const valColours = {
    green: 'text-emerald-700',
    red: 'text-red-600',
    blue: 'text-blue-700',
    amber: 'text-amber-600',
    gray: 'text-gray-700',
  };
  return (
    <div className={`rounded-xl border p-3 flex flex-col items-center gap-1 ${colours[tone]}`}>
      <div className="flex items-center gap-1.5">
        <span className="opacity-70">{icon}</span>
        <span className="text-[10px] font-semibold uppercase tracking-wide opacity-80">{label}</span>
      </div>
      <span className={`text-xl font-bold tabular-nums ${valColours[tone]}`}>{value}</span>
    </div>
  );
}

function StrengthRow({ item }: { item: StrengthItem | string }) {
  if (typeof item === 'string') {
    // Old format: plain string, try to parse "Topic — XX% accurate"
    const match = item.match(/^(.+?)\s*[—–-]\s*(\d+)%/);
    if (match) {
      return (
        <div className="flex items-start gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-gray-800">{match[1].trim()}</span>
              <span className="text-sm font-bold text-emerald-600 whitespace-nowrap">{match[2]}%</span>
            </div>
          </div>
        </div>
      );
    }
    return (
      <div className="flex items-start gap-2">
        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
        <span className="text-sm text-gray-700">{item}</span>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-2">
      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium text-gray-800">{item.topic}</span>
          <span className="text-sm font-bold text-emerald-600 whitespace-nowrap">{item.accuracy}%</span>
        </div>
        {item.detail && (
          <p className="text-xs text-gray-500 mt-0.5">{item.detail}</p>
        )}
      </div>
    </div>
  );
}

function ImprovementRow({ item }: { item: ImprovementAreaItem | string }) {
  if (typeof item === 'string') {
    const match = item.match(/^(.+?)\s*[—–-]\s*(\d+)%/);
    if (match) {
      const pct = Number(match[2]);
      return (
        <div className="bg-white border border-gray-100 rounded-xl p-3.5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-gray-800">{match[1].trim()}</span>
            <span className="text-sm font-bold text-amber-600">{pct}%</span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-amber-400 rounded-full" style={{ width: `${pct}%` }} />
          </div>
        </div>
      );
    }
    return (
      <div className="bg-white border border-gray-100 rounded-xl p-3.5">
        <div className="flex items-start gap-2">
          <Target className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          <span className="text-sm text-gray-700">{item}</span>
        </div>
      </div>
    );
  }
  return (
    <div className="bg-white border border-gray-100 rounded-xl p-3.5">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm font-semibold text-gray-800">{item.topic}</span>
        <span className="text-sm font-bold text-amber-600">{item.accuracy}%</span>
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mb-2">
        <div className="h-full bg-amber-400 rounded-full transition-all" style={{ width: `${item.accuracy}%` }} />
      </div>
      {item.advice && (
        <p className="text-xs text-gray-600 leading-relaxed">{item.advice}</p>
      )}
    </div>
  );
}

function QuestionCard({ q, index }: { q: QuestionReviewItem; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const userAns = resolveAnswerLabel(q.user_answer, q.options);
  const correctAns = resolveAnswerLabel(q.correct_answer, q.options);

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
          <p className="text-sm text-gray-800 leading-snug line-clamp-2">
            <MathText text={q.body} />
          </p>
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

      {expanded && (
        <div className="border-t border-gray-100 p-4 bg-gray-50/40 space-y-3">
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
                  {userAns.text && (
                    <span className="text-sm text-gray-800 leading-snug">
                      <MathText text={userAns.text} />
                    </span>
                  )}
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
                {correctAns.text && (
                  <span className="text-sm text-gray-800 leading-snug">
                    <MathText text={correctAns.text} />
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Explanation */}
          {q.explanation && (
            <div className="bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-500 mb-1">Explanation</p>
              <p className="text-sm text-indigo-900 leading-relaxed">{q.explanation}</p>
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
  const { courses } = useUserPortal();
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

  const dateStr = attempt.start_time
    ? new Date(attempt.start_time).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : '—';

  // Use detail data if loaded, fall back to list data
  const score = detail?.attempt.score ?? attempt.score;
  const maxScore = detail?.attempt.max_score ?? attempt.max_score ?? null;
  const pct = detail?.attempt.percentage ?? attempt.percentage;
  const pctRounded = pct != null ? Math.round(pct) : null;
  const status = detail?.attempt.status ?? attempt.status;
  const autoSubmitted = detail?.attempt.auto_submitted ?? attempt.auto_submitted;

  const timeTakenMin =
    detail?.stats.time_taken_seconds
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
  const questions = detail?.questions ?? [];

  const strengths = aiReport?.strengths ?? [];
  const improvementAreas = aiReport?.improvement_areas ?? [];
  const overallSummary = aiReport?.overall_summary ?? (attempt.analysis_text ?? null);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      {/* ── Header ── */}
      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/40 dark:to-purple-950/40 border border-indigo-100 dark:border-indigo-900/40 rounded-2xl p-4">
        <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-400 mb-1">
          AI Performance Report
        </p>
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 break-words">
          {detail?.attempt.test_name ?? attempt.test_name ?? 'Test Attempt'}
        </h1>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          {courseName && <span>{courseName} · </span>}
          {dateStr}
        </p>

        {/* Score / Pct / Time */}
        <div className="grid grid-cols-3 gap-2 mt-4">
          <div className="bg-white dark:bg-gray-900 rounded-lg px-2.5 py-2 border border-gray-200 dark:border-gray-800">
            <p className="text-[9px] uppercase tracking-wider text-gray-500 dark:text-gray-400">Score</p>
            <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{scoreDisplay}</p>
          </div>
          <div
            className={cn(
              'rounded-lg px-2.5 py-2 border',
              pctRounded == null
                ? 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800'
                : passed
                ? 'bg-white dark:bg-gray-900 border-green-300 dark:border-green-700'
                : 'bg-white dark:bg-gray-900 border-red-300 dark:border-red-700',
            )}
          >
            <p className="text-[9px] uppercase tracking-wider text-gray-500 dark:text-gray-400">Percentage</p>
            <p
              className={cn(
                'text-sm font-bold',
                pctRounded == null
                  ? 'text-gray-900 dark:text-gray-100'
                  : passed
                  ? 'text-green-700 dark:text-green-400'
                  : 'text-red-700 dark:text-red-400',
              )}
            >
              {pctRounded != null ? `${pctRounded}%` : '—'}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-900 rounded-lg px-2.5 py-2 border border-gray-200 dark:border-gray-800">
            <p className="text-[9px] uppercase tracking-wider text-gray-500 dark:text-gray-400">Time Taken</p>
            <p className="text-sm font-bold text-gray-900 dark:text-gray-100">
              {timeTakenMin != null ? `${timeTakenMin} min` : '—'}
            </p>
          </div>
        </div>

        {/* Status + download row */}
        <div className="flex items-center justify-between mt-3 flex-wrap gap-2">
          <StatusBadge status={status} autoSubmitted={autoSubmitted} />
          {canDownloadPDF ? (
            <button
              onClick={() => toast.info('PDF download coming soon.')}
              className="inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
            >
              <Download className="w-3.5 h-3.5" /> Download report
            </button>
          ) : (
            <Link
              to="/user/subscription"
              className="inline-flex items-center gap-1.5 bg-amber-400 text-amber-900 px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-amber-300 transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5" /> Upgrade to download
            </Link>
          )}
        </div>
      </div>

      {/* ── 5 stat tiles ── */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          <StatTile
            label="Correct"
            value={stats.correct_count ?? '—'}
            tone="green"
            icon={<CheckCircle2 className="w-3.5 h-3.5" />}
          />
          <StatTile
            label="Incorrect"
            value={stats.incorrect_count ?? '—'}
            tone="red"
            icon={<XCircle className="w-3.5 h-3.5" />}
          />
          <StatTile
            label="Unattempted"
            value={stats.unattempted_count}
            tone="blue"
            icon={<Target className="w-3.5 h-3.5" />}
          />
          <StatTile
            label="Avg time / Q"
            value={stats.avg_time_per_question != null ? `${stats.avg_time_per_question}s` : '—'}
            tone="amber"
            icon={<Clock className="w-3.5 h-3.5" />}
          />
          <StatTile
            label="Slow questions"
            value={stats.slow_question_count ?? '—'}
            tone="gray"
            icon={<Brain className="w-3.5 h-3.5" />}
          />
        </div>
      )}

      {/* ── Overall Summary + Strengths ── */}
      {(overallSummary || strengths.length > 0) && (
        <div className={`grid grid-cols-1 gap-4 ${strengths.length > 0 && overallSummary ? 'lg:grid-cols-2' : ''}`}>
          {/* Strengths */}
          {strengths.length > 0 && (
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <h3 className="font-semibold text-gray-800 dark:text-gray-200 text-sm">Strengths</h3>
              </div>
              <div className="space-y-3">
                {strengths.map((item, i) => (
                  <StrengthRow key={i} item={item} />
                ))}
              </div>
            </div>
          )}

          {/* Overall Summary */}
          {overallSummary && (
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Brain className="w-4 h-4 text-indigo-500" />
                <h3 className="font-semibold text-gray-800 dark:text-gray-200 text-sm">Overall Summary</h3>
              </div>
              <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                {overallSummary}
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── Improvement Areas ── */}
      {improvementAreas.length > 0 && (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Target className="w-4 h-4 text-amber-500" />
            <h3 className="font-semibold text-gray-800 dark:text-gray-200 text-sm">Improvement Areas</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {improvementAreas.map((item, i) => (
              <ImprovementRow key={i} item={item} />
            ))}
          </div>
        </div>
      )}

      {/* ── AI report pending notice ── */}
      {!overallSummary && (
        attempt.attempt_type === 'test'
          ? (!aiReport || aiReport.generation_status !== 'completed')
          : attempt.attempt_type === 'eval'
      ) && (
        <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-xl p-3 text-sm text-amber-800 dark:text-amber-300">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <p>
            AI analysis is being generated. Check back in a moment for your performance summary.
          </p>
        </div>
      )}

      {/* ── Question-level review ── */}
      {questions.length > 0 && (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Brain className="w-4 h-4 text-indigo-500" />
            <h3 className="font-semibold text-gray-800 dark:text-gray-200 text-sm">Question-level Review</h3>
            <span className="ml-auto text-xs text-gray-400 dark:text-gray-500">
              Click a question to expand
            </span>
          </div>
          <div className="space-y-2">
            {questions.map((q, i) => (
              <QuestionCard key={q.question_id} q={q} index={i} />
            ))}
          </div>
        </div>
      )}

      {/* ── Malpractice events ── */}
      {Array.isArray(attempt.malpractice_events) && attempt.malpractice_events.length > 0 && (
        <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />
            <h3 className="text-sm font-semibold text-red-700 dark:text-red-300">
              Flagged Events ({attempt.malpractice_events.length})
            </h3>
          </div>
          <ul className="space-y-1">
            {attempt.malpractice_events.map((ev: any, i: number) => (
              <li key={i} className="text-xs text-red-700 dark:text-red-300 flex items-center gap-1.5">
                <XCircle className="w-3 h-3 shrink-0" />
                {typeof ev === 'string' ? ev : JSON.stringify(ev)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
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
