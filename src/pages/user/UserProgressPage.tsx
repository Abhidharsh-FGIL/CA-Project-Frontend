/**
 * /user/progress and /user/progress/:attemptId — "Progress Journey" (mockup screen 10).
 *
 * Distinct from This Attempt by design (§2): that answers "what happened in this
 * test", this answers "how has my performance evolved and what should I do next".
 * The data itself is never attempt-scoped (it's a trend across the user's whole
 * exam history) — `attemptId`, when present, only decides whether this renders
 * inside the report flow's own `ReportSubNav` (reached via a report's "Progress"
 * tab, so that tab's click stays inside the report's local navigation instead of
 * bouncing out to the top-level nav) or standalone (reached with no attempt in
 * context, e.g. before any report exists at all).
 *
 * Fetches the real `GET /user/progress/` endpoint directly — see item 9 of the
 * report redesign: every number it needs (score/max_score/accuracy_percentage/
 * correct/attempted per attempt, and how many attempts are actually comparable)
 * is already unambiguous on the backend (progress_report.py), so this screen no
 * longer fans out a `getAttemptDetail` call per attempt and re-derives its own
 * numbers client-side the way it used to.
 */
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { UserShell } from '@/components/user/UserShell';
import { ReportSubNav } from '@/components/user/ReportSubNav';
import { useUserPortal } from '@/contexts/UserPortalContext';
import { getProgressReport } from '@/lib/userPortalApi';
import { ProgressJourney } from '@/components/user/report/ProgressJourney';
import { resolveExamContext } from '@/lib/exam-report-config';
import { useTnpscCatalog } from '@/hooks/use-tnpsc';
import { resolveGroupKey } from '@/hooks/use-progress-trend';

export default function UserProgressPage() {
  const { attemptId } = useParams<{ attemptId?: string }>();
  const { user } = useUserPortal();
  const { groups } = useTnpscCatalog();

  const groupKey = resolveGroupKey(user?.preferred_exam);

  const { data, isLoading } = useQuery({
    queryKey: ['progress-report', groupKey],
    queryFn: () => getProgressReport({ exam: groupKey }),
    enabled: !!user,
  });

  const exam = resolveExamContext({ groupId: user?.preferred_exam ?? null }, groups);

  if (!user) return null;

  const subNav = attemptId ? <ReportSubNav attemptId={attemptId} active="progress" /> : null;

  if (isLoading) {
    return (
      <UserShell>
        {subNav}
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        </div>
      </UserShell>
    );
  }

  // §19 — with nothing submitted there is no trajectory to report, and the page
  // says so rather than rendering empty charts.
  if (!data || data.window.attempts_in_window === 0) {
    return (
      <UserShell>
        {subNav}
        <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-10 text-center">
          <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">Progress Report</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 max-w-md mx-auto leading-relaxed">
            This report compares your attempts within one exam over time.{' '}
            Submit a test and it starts filling in — a second attempt is what makes the comparison meaningful.
          </p>
          <Link
            to="/user/exams"
            className="inline-flex items-center gap-1.5 mt-4 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-xs font-semibold px-3.5 py-2 hover:from-indigo-700 hover:to-purple-700 transition-all"
          >
            Choose an exam
          </Link>
        </div>
      </UserShell>
    );
  }

  return (
    <UserShell>
      {subNav}
      <ProgressJourney data={data} examName={exam?.examName} />
      {data.window.attempts_truncated > 0 && (
        <p className="text-[11px] text-center text-gray-400 dark:text-gray-500 mt-3">
          Showing your {data.window.attempts_in_window} most recent {exam?.examName ?? 'exam'} attempts of{' '}
          {data.window.attempts_total}.
        </p>
      )}
    </UserShell>
  );
}
