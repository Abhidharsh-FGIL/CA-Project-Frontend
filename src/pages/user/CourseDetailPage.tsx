import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, Link, useNavigate, Navigate } from 'react-router-dom';
import { UserShell } from '@/components/user/UserShell';
import { useUserPortal } from '@/contexts/UserPortalContext';
import {
  getCourseTests,
  getCourseEvalAssessments,
  type ApiTest,
  type ApiEvalAssessment,
} from '@/lib/userPortalApi';
import {
  Lock,
  Sparkles,
  Clock,
  FileText,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  AlertCircle,
  RefreshCw,
  CalendarCheck,
  BookOpen,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

// ─── Constants ────────────────────────────────────────────────────────────────

const TIER_LABEL: Record<string, string> = {
  free: 'Free',
  standard: 'Standard',
  ultimate: 'Ultimate',
  premium: 'Premium',
};

const DIFFICULTY_COLOR: Record<string, string> = {
  easy: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300',
  medium: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300',
  hard: 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300',
  mixed: 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300',
};

/** Default max-attempts per mode. */
const DEFAULT_MAX_ATTEMPTS: Record<string, number> = { practice: 3, mock: 1 };

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CourseDetailPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const { courses, history } = useUserPortal();

  const [tab, setTab] = useState<'practice' | 'mock'>('practice');

  // Tests (admin test-management)
  const [tests, setTests] = useState<ApiTest[]>([]);
  const [testsLoading, setTestsLoading] = useState(true);
  const [testsError, setTestsError] = useState<string | null>(null);

  // Evaluation-Hub assessments
  const [evalAssessments, setEvalAssessments] = useState<ApiEvalAssessment[]>([]);
  const [evalLoading, setEvalLoading] = useState(true);
  const [evalError, setEvalError] = useState<string | null>(null);

  const course = courses.find(c => c.course_id === courseId);

  // ── Fetch helpers ───────────────────────────────────────────────────────────
  const loadTests = useCallback(() => {
    if (!courseId) return;
    setTestsLoading(true);
    setTestsError(null);
    getCourseTests(courseId)
      .then(data => setTests(data))
      .catch(err => setTestsError(err?.message || 'Failed to load tests.'))
      .finally(() => setTestsLoading(false));
  }, [courseId]);

  const loadEvalAssessments = useCallback(() => {
    if (!courseId) return;
    setEvalLoading(true);
    setEvalError(null);
    getCourseEvalAssessments(courseId)
      .then(data => setEvalAssessments(data))
      .catch(err => setEvalError(err?.message || 'Failed to load assessments.'))
      .finally(() => setEvalLoading(false));
  }, [courseId]);

  useEffect(() => {
    loadTests();
    loadEvalAssessments();
  }, [loadTests, loadEvalAssessments]);

  // ── Attempt counts from history ────────────────────────────────────────────
  const attemptsByTestId = useMemo(() => {
    const map = new Map<string, number>();
    for (const h of history) map.set(h.test_id, (map.get(h.test_id) || 0) + 1);
    return map;
  }, [history]);

  // ── Guard ──────────────────────────────────────────────────────────────────
  if (!course) return <Navigate to="/user/courses" replace />;

  const loading = testsLoading || evalLoading;

  // Split by tab
  const practiceTests   = tests.filter(t => t.mode === 'practice');
  const mockTests       = tests.filter(t => t.mode === 'mock');
  const practiceEvals   = evalAssessments.filter(a => a.mode === 'practice');
  const mockEvals       = evalAssessments.filter(a => a.mode === 'mock');

  const visibleTests = tab === 'practice' ? practiceTests : mockTests;
  const visibleEvals = tab === 'practice' ? practiceEvals : mockEvals;

  const practiceCount = practiceTests.length + practiceEvals.length;
  const mockCount     = mockTests.length + mockEvals.length;

  const hasError = testsError || evalError;
  const isEmpty  = visibleTests.length === 0 && visibleEvals.length === 0;

  return (
    <UserShell>
      {/* Back */}
      <button
        onClick={() => navigate('/user/courses')}
        className="group inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 mb-4 transition-colors animate-fadeIn"
      >
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
        Back to Courses
      </button>

      {/* Course header */}
      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/40 dark:to-purple-950/40 border border-indigo-100 dark:border-indigo-900/40 rounded-2xl p-3 sm:p-4 mb-5 animate-scaleIn">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0 flex-1">
            {course.exam_body && (
              <span className="inline-block bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold tracking-wider px-2 py-0.5 rounded-full mb-1.5">
                {course.exam_body}
              </span>
            )}
            <p className="text-[10px] font-semibold uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
              {course.subject}
            </p>
            <h1 className="text-lg sm:text-xl font-bold mt-0.5 text-gray-900 dark:text-gray-100">
              {course.name}
            </h1>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 max-w-2xl">
              {course.description}
            </p>
          </div>

          {/* Count pills */}
          {!loading && (
            <div className="flex gap-2 text-xs flex-shrink-0">
              <div className="bg-white dark:bg-gray-900 border border-indigo-100 dark:border-indigo-900/40 rounded-lg px-3 py-1.5 text-center">
                <p className="font-bold text-base text-gray-900 dark:text-gray-100 leading-tight">{practiceCount}</p>
                <p className="text-[10px] text-gray-500 dark:text-gray-400">Practice</p>
              </div>
              <div className="bg-white dark:bg-gray-900 border border-indigo-100 dark:border-indigo-900/40 rounded-lg px-3 py-1.5 text-center">
                <p className="font-bold text-base text-gray-900 dark:text-gray-100 leading-tight">{mockCount}</p>
                <p className="text-[10px] text-gray-500 dark:text-gray-400">Mock</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-800 mb-5">
        {(['practice', 'mock'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'px-5 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-all duration-300',
              tab === t
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200',
            )}
          >
            {t === 'practice' ? 'Practice' : 'Mock'}
            {!loading && (
              <span
                className={cn(
                  'ml-2 text-xs px-1.5 py-0.5 rounded transition-all',
                  tab === t
                    ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400',
                )}
              >
                {t === 'practice' ? practiceCount : mockCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20 gap-3 text-gray-400 dark:text-gray-500 animate-fadeIn">
          <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />
          <span className="text-sm">Loading assessments…</span>
        </div>
      ) : hasError ? (
        <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-xl p-8 text-center animate-fadeIn">
          <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-3" />
          <p className="text-sm font-medium text-red-700 dark:text-red-400 mb-1">
            Could not load assessments
          </p>
          <p className="text-xs text-red-500 dark:text-red-500 mb-4">
            {testsError || evalError}
          </p>
          <button
            onClick={() => { loadTests(); loadEvalAssessments(); }}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-gray-900 px-4 py-2 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Try again
          </button>
        </div>
      ) : isEmpty ? (
        <div className="text-center py-16 animate-fadeIn">
          <FileText className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-sm text-gray-400 dark:text-gray-500">
            No {tab} assessments available for this course yet.
          </p>
        </div>
      ) : (
        <div key={tab} className="space-y-6">

          {/* ── Self-service Tests ─────────────────────────────────────────── */}
          {visibleTests.length > 0 && (
            <section>
              <SectionHeader
                icon={<BookOpen className="w-3.5 h-3.5" />}
                label="Tests"
                subtitle="Take anytime, at your own pace"
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                {visibleTests.map((t, i) => (
                  <div key={t.test_id} className="animate-slideUp" style={{ animationDelay: `${i * 0.05}s` }}>
                    <TestCard
                      test={t}
                      attemptsUsed={attemptsByTestId.get(t.test_id) ?? 0}
                      maxAttempts={DEFAULT_MAX_ATTEMPTS[t.mode] ?? 1}
                    />
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ── Free Assessments ──────────────────────────────────────────── */}
          {visibleEvals.filter((a: ApiEvalAssessment) => (a.pricing_type || 'free') === 'free' && !a.has_invitation).length > 0 && (
            <section>
              <SectionHeader
                icon={<Zap className="w-3.5 h-3.5" />}
                label="Free Assessments"
                subtitle="Take anytime — no invitation needed"
                accent
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                {visibleEvals
                  .filter((a: ApiEvalAssessment) => (a.pricing_type || 'free') === 'free' && !a.has_invitation)
                  .map((a, i) => (
                    <div key={a.assessment_id} className="animate-slideUp" style={{ animationDelay: `${i * 0.05}s` }}>
                      <FreeAssessmentCard assessment={a} />
                    </div>
                  ))}
              </div>
            </section>
          )}

          {/* ── Scheduled Assessments ─────────────────────────────────────── */}
          {visibleEvals.filter((a: ApiEvalAssessment) => a.has_invitation).length > 0 && (
            <section>
              <SectionHeader
                icon={<CalendarCheck className="w-3.5 h-3.5" />}
                label="Scheduled Assessments"
                subtitle="Administered assessments — invitation required"
                accent
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                {visibleEvals
                  .filter((a: ApiEvalAssessment) => a.has_invitation)
                  .map((a, i) => (
                    <div key={a.assessment_id} className="animate-slideUp" style={{ animationDelay: `${i * 0.05}s` }}>
                      <EvalAssessmentCard assessment={a} />
                    </div>
                  ))}
              </div>
            </section>
          )}

        </div>
      )}
    </UserShell>
  );
}

// ─── Section Header ────────────────────────────────────────────────────────────

function SectionHeader({
  icon,
  label,
  subtitle,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  subtitle?: string;
  accent?: boolean;
}) {
  return (
    <div className="flex items-center gap-2.5 pb-2 border-b border-gray-100 dark:border-gray-800">
      <span
        className={cn(
          'inline-flex items-center justify-center w-6 h-6 rounded-md',
          accent
            ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400'
            : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400',
        )}
      >
        {icon}
      </span>
      <div>
        <p className="text-sm font-bold text-gray-800 dark:text-gray-200">{label}</p>
        {subtitle && <p className="text-[11px] text-gray-500 dark:text-gray-400">{subtitle}</p>}
      </div>
    </div>
  );
}

// ─── TestCard (self-service tests) ────────────────────────────────────────────

function TestCard({
  test,
  attemptsUsed,
  maxAttempts,
}: {
  test: ApiTest;
  attemptsUsed: number;
  maxAttempts: number;
}) {
  const navigate = useNavigate();
  const attemptsLeft = Math.max(0, maxAttempts - attemptsUsed);
  const exhausted = attemptsLeft === 0;
  const attempted = attemptsUsed > 0;
  const canStart = !test.is_locked && !exhausted;

  return (
    <div
      className={cn(
        'bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-4 transition-all relative',
        canStart
          ? 'hover:shadow-md hover:border-indigo-200 dark:hover:border-indigo-800 cursor-pointer'
          : 'opacity-95',
      )}
      onClick={() => canStart && navigate(`/user/test/${test.test_id}/start`)}
    >
      {test.is_new && !attempted && (
        <span className="absolute top-3 right-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow animate-bounce-soft">
          NEW
        </span>
      )}
      {attempted && (
        <span className="absolute top-3 right-3 inline-flex items-center gap-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-[10px] font-semibold px-2 py-0.5 rounded-full">
          <CheckCircle2 className="w-3 h-3" /> Attempted
        </span>
      )}

      <div className="flex items-start gap-2 mb-2 pr-20">
        <div className="min-w-0">
          <p className="text-sm font-bold text-gray-900 dark:text-gray-100 line-clamp-2">
            {test.name || 'Untitled Test'}
          </p>
          {test.subject && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{test.subject}</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap mt-3">
        <Chip icon={<FileText className="w-3 h-3" />} label={`${test.question_count} Qs`} />
        {test.time_limit > 0 && (
          <Chip icon={<Clock className="w-3 h-3" />} label={`${test.time_limit} min`} />
        )}
        {test.difficulty && (
          <span className={cn('text-[11px] font-semibold px-2 py-1 rounded-md capitalize', DIFFICULTY_COLOR[test.difficulty] ?? 'bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300')}>
            {test.difficulty}
          </span>
        )}
        {test.negative_marking && (
          <span className="text-[11px] font-semibold text-red-600 dark:text-red-300 bg-red-50 dark:bg-red-950/40 px-2 py-1 rounded-md">
            -{test.negative_marking_fraction || 0.25} neg
          </span>
        )}
        <span className={cn('inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-md', exhausted ? 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400' : 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300')}
          title={`${attemptsUsed} of ${maxAttempts} attempts used`}>
          {attemptsUsed}/{maxAttempts} attempts
        </span>
      </div>

      <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between gap-2">
        <div className="text-[11px] text-gray-500 dark:text-gray-400 flex items-center gap-2 flex-wrap">
          <span>
            Requires{' '}
            <span className="font-semibold text-gray-700 dark:text-gray-200">
              {TIER_LABEL[test.required_tier ?? 'free'] ?? test.required_tier ?? 'Free'}
            </span>
          </span>
          {(test.price ?? 0) > 0 ? (
            <span className="inline-flex items-center text-[11px] font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/40 px-1.5 py-0.5 rounded">
              ₹{test.price}
            </span>
          ) : (
            <span className="inline-flex items-center text-[11px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded">
              FREE
            </span>
          )}
        </div>

        {test.is_locked ? (
          <button
            onClick={e => { e.stopPropagation(); navigate('/user/subscription'); }}
            className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 px-3 py-1.5 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors"
          >
            <Lock className="w-3 h-3" /> Upgrade <Sparkles className="w-3 h-3" />
          </button>
        ) : exhausted ? (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-3 py-1.5 rounded-lg cursor-not-allowed"
            onClick={e => e.stopPropagation()}>
            <Lock className="w-3 h-3" /> No attempts left
          </span>
        ) : (
          <Link
            to={`/user/test/${test.test_id}/start`}
            className={cn('text-xs font-semibold px-3 py-1.5 rounded-lg transition-all', test.mode === 'mock' ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'bg-emerald-600 text-white hover:bg-emerald-700')}
            onClick={e => e.stopPropagation()}
          >
            {test.mode === 'mock' ? 'Start Mock' : 'Practice'}
          </Link>
        )}
      </div>
    </div>
  );
}

// ─── FreeAssessmentCard (self-service free assessments) ───────────────────────

function FreeAssessmentCard({ assessment: a }: { assessment: ApiEvalAssessment }) {
  const navigate = useNavigate();
  const isExpired = !!a.due_date && new Date(a.due_date) < new Date();

  return (
    <div
      className={cn(
        'bg-white dark:bg-gray-900 rounded-2xl border p-4 transition-all relative cursor-pointer',
        !isExpired
          ? 'border-indigo-100 dark:border-indigo-900/60 hover:shadow-md hover:border-indigo-200 dark:hover:border-indigo-800'
          : 'border-gray-100 dark:border-gray-800 opacity-70',
      )}
      onClick={() => !isExpired && navigate(`/user/assessment/${a.assessment_id}`)}
    >
      {/* Free badge */}
      <span className="absolute top-3 right-3 inline-flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
        FREE
      </span>

      {/* Title */}
      <div className="pr-16 mb-3">
        <p className="text-sm font-bold text-gray-900 dark:text-gray-100 line-clamp-2">
          {a.title}
        </p>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 mt-0.5">
          Free Assessment
        </p>
      </div>

      {/* Metadata chips */}
      <div className="flex items-center gap-2 flex-wrap">
        <Chip icon={<FileText className="w-3 h-3" />} label={`${a.question_count} Qs`} />
        {a.time_limit_minutes != null && a.time_limit_minutes > 0 && (
          <Chip icon={<Clock className="w-3 h-3" />} label={`${a.time_limit_minutes} min`} />
        )}
        {a.difficulty && (
          <span
            className={cn(
              'text-[11px] font-semibold px-2 py-1 rounded-md capitalize',
              DIFFICULTY_COLOR[a.difficulty] ?? 'bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300',
            )}
          >
            {a.difficulty}
          </span>
        )}
        {a.negative_marking && (
          <span className="text-[11px] font-semibold text-red-600 dark:text-red-300 bg-red-50 dark:bg-red-950/40 px-2 py-1 rounded-md">
            -{a.negative_mark_value || 0.25} neg
          </span>
        )}
        {a.max_score > 0 && <Chip icon={null} label={`${a.max_score} marks`} />}
      </div>

      {/* Footer */}
      <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between gap-2">
        <p
          className={cn(
            'text-[11px]',
            isExpired ? 'text-red-500 font-medium' : 'text-gray-400 dark:text-gray-500',
          )}
        >
          {a.due_date
            ? `${isExpired ? 'Expired' : 'Due'}: ${new Date(a.due_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`
            : 'No deadline'}
        </p>

        {isExpired ? (
          <span className="text-xs font-semibold text-gray-400 bg-gray-100 dark:bg-gray-800 px-3 py-1.5 rounded-lg">
            Expired
          </span>
        ) : (
          <button
            onClick={e => {
              e.stopPropagation();
              navigate(`/user/assessment/${a.assessment_id}`);
            }}
            className={cn(
              'text-xs font-semibold px-3 py-1.5 rounded-lg transition-all',
              a.mode === 'mock'
                ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                : 'bg-emerald-600 text-white hover:bg-emerald-700',
            )}
          >
            {a.mode === 'mock' ? 'Start Mock' : 'Start Practice'}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── EvalAssessmentCard (Evaluation-Hub assessments) ──────────────────────────

function EvalAssessmentCard({ assessment: a }: { assessment: ApiEvalAssessment }) {
  const navigate = useNavigate();
  const isExpired = !!a.due_date && new Date(a.due_date) < new Date();
  const canStart = a.has_invitation && !isExpired;

  const handleStart = () => {
    // Use the authenticated assessment flow (GET/POST /api/v1/user/eval-assessments/{id}),
    // which exists on the backend. The token-based /take-assessment public flow is not
    // implemented on the server, so invited assessments are taken while logged in.
    navigate(`/user/assessment/${a.assessment_id}`);
  };

  return (
    <div
      className={cn(
        'bg-white dark:bg-gray-900 rounded-2xl border p-4 transition-all relative',
        canStart
          ? 'border-indigo-100 dark:border-indigo-900/60 hover:shadow-md hover:border-indigo-200 dark:hover:border-indigo-800 cursor-pointer'
          : 'border-gray-100 dark:border-gray-800',
        isExpired && 'opacity-70',
      )}
      onClick={() => canStart && handleStart()}
    >
      {/* Invitation badge */}
      {a.has_invitation && (
        <span className="absolute top-3 right-3 inline-flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
          <CheckCircle2 className="w-3 h-3" /> Invited
        </span>
      )}

      {/* Title */}
      <div className="pr-20 mb-3">
        <p className="text-sm font-bold text-gray-900 dark:text-gray-100 line-clamp-2">
          {a.title}
        </p>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 mt-0.5">
          Scheduled Assessment
        </p>
      </div>

      {/* Metadata chips */}
      <div className="flex items-center gap-2 flex-wrap">
        <Chip icon={<FileText className="w-3 h-3" />} label={`${a.question_count} Qs`} />
        {a.time_limit_minutes != null && a.time_limit_minutes > 0 && (
          <Chip icon={<Clock className="w-3 h-3" />} label={`${a.time_limit_minutes} min`} />
        )}
        {a.difficulty && (
          <span className={cn('text-[11px] font-semibold px-2 py-1 rounded-md capitalize', DIFFICULTY_COLOR[a.difficulty] ?? 'bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300')}>
            {a.difficulty}
          </span>
        )}
        {a.negative_marking && (
          <span className="text-[11px] font-semibold text-red-600 dark:text-red-300 bg-red-50 dark:bg-red-950/40 px-2 py-1 rounded-md">
            -{a.negative_mark_value || 0.25} neg
          </span>
        )}
        {a.max_score > 0 && (
          <Chip icon={null} label={`${a.max_score} marks`} />
        )}
      </div>

      {/* Footer */}
      <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between gap-2">
        <p className={cn('text-[11px]', isExpired ? 'text-red-500 font-medium' : 'text-gray-400 dark:text-gray-500')}>
          {a.due_date
            ? `${isExpired ? 'Expired' : 'Due'}: ${format(new Date(a.due_date), 'dd MMM yyyy')}`
            : 'No deadline'}
        </p>

        {canStart ? (
          <button
            onClick={e => { e.stopPropagation(); handleStart(); }}
            className={cn(
              'text-xs font-semibold px-3 py-1.5 rounded-lg transition-all',
              a.mode === 'mock'
                ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                : 'bg-emerald-600 text-white hover:bg-emerald-700',
            )}
          >
            {a.mode === 'mock' ? 'Start Mock' : 'Start Practice'}
          </button>
        ) : isExpired ? (
          <span className="text-xs font-semibold text-gray-400 bg-gray-100 dark:bg-gray-800 px-3 py-1.5 rounded-lg">
            Expired
          </span>
        ) : null}
      </div>
    </div>
  );
}

// ─── Chip helper ──────────────────────────────────────────────────────────────

function Chip({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-[11px] bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-2 py-1 rounded-md">
      {icon}
      {label}
    </span>
  );
}
