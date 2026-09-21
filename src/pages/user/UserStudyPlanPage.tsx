/**
 * /user/study-plan/:attemptId — the plan generated from one attempt.
 *
 * A separate route because the plan is an action workspace, not another analytics
 * card on the report (§11 of the This Attempt spec).
 */
import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { UserShell } from '@/components/user/UserShell';
import { StudyPlanView } from '@/components/user/StudyPlanView';
import { buildStudyPlan } from '@/lib/study-plan';
import { useAttemptReportModel } from '@/hooks/use-attempt-report';

export default function UserStudyPlanPage() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const navigate = useNavigate();
  const { model, loading, failed, analysis } = useAttemptReportModel(attemptId);

  // The deterministic plan stays as the fallback while the new backend's
  // priorities/weekly_plan/daily_plan aren't ready yet — see StudyPlanView.tsx.
  const plan = useMemo(() => (model ? buildStudyPlan(model) : null), [model]);

  if (loading) {
    return (
      <UserShell>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        </div>
      </UserShell>
    );
  }

  if (failed || !plan || !model) {
    return (
      <UserShell>
        <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-10 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            This attempt's detail could not be loaded, so a plan cannot be built from it.
          </p>
        </div>
      </UserShell>
    );
  }

  return (
    <UserShell>
      <StudyPlanView plan={plan} model={model} analysis={analysis} onBack={() => navigate(`/user/report/${attemptId}`)} />
    </UserShell>
  );
}
