/**
 * /user/progress — "Progress Journey" (mockup screen 10).
 *
 * Distinct from This Attempt by design (§2): that answers "what happened in this
 * test", this answers "how has my performance evolved and what should I do next".
 */
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { UserShell } from '@/components/user/UserShell';
import { useUserPortal } from '@/contexts/UserPortalContext';
import { useProgressReport, PROGRESS_WINDOW } from '@/hooks/use-progress-report';
import { ProgressJourney } from '@/components/user/report/ProgressJourney';
import { resolveExamContext } from '@/lib/exam-report-config';
import { useTnpscCatalog } from '@/hooks/use-tnpsc';
import { resolveGroupKey } from '@/hooks/use-progress-trend';

export default function UserProgressPage() {
  const { user, history, isLoading } = useUserPortal();
  const { groups } = useTnpscCatalog();

  const submitted = useMemo(
    () => history.filter(h => h.status !== 'in_progress' && h.percentage != null),
    [history],
  );

  /**
   * One exam per report.
   *
   * A trajectory drawn across a Group 4 paper and a GAT-B paper describes neither
   * — the scores move because the exam changed, not because the aspirant did. The
   * window is scoped to the exam they registered for.
   */
  const groupId = resolveGroupKey(user?.preferred_exam);

  const { model, isLoading: buildingReport, loaded, total, excluded } = useProgressReport({
    attempts: submitted,
    groupId,
    enabled: submitted.length > 0,
  });

  const exam = useMemo(
    () => resolveExamContext({ groupId: user?.preferred_exam ?? null }, groups),
    [user?.preferred_exam, groups],
  );

  /** Attempts belonging to this exam — what the window is drawn from. */
  const inScope = submitted.length - excluded;

  if (!user) return null;

  if (isLoading) {
    return (
      <UserShell>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        </div>
      </UserShell>
    );
  }

  // §19 — with nothing submitted there is no trajectory to report, and the page
  // says so rather than rendering empty charts.
  if (inScope === 0) {
    return (
      <UserShell>
        <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-10 text-center">
          <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">Progress Report</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 max-w-md mx-auto leading-relaxed">
            This report compares your attempts within one exam over time.{' '}
            {excluded > 0
              ? `You have ${excluded} attempt${excluded === 1 ? '' : 's'} recorded, but none in ${exam?.examName ?? 'this exam'} — sit one and the comparison starts.`
              : 'Submit a test and it starts filling in — a second attempt is what makes the comparison meaningful.'}
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
      {buildingReport && (
        <div className="mb-3 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-500" />
          Reading {loaded} of {total} attempts…
        </div>
      )}
      {model ? (
        <ProgressJourney model={model} />
      ) : (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        </div>
      )}
      {(inScope > PROGRESS_WINDOW || excluded > 0) && (
        <p className="text-[11px] text-center text-gray-400 dark:text-gray-500 mt-3">
          {inScope > PROGRESS_WINDOW && (
            <>Showing your {PROGRESS_WINDOW} most recent {exam?.examName ?? 'exam'} attempts of {inScope}. </>
          )}
          {excluded > 0 && (
            <>
              {excluded} attempt{excluded === 1 ? '' : 's'} from other exams {excluded === 1 ? 'is' : 'are'} not
              included — progress is compared within one exam.
            </>
          )}
        </p>
      )}
    </UserShell>
  );
}
