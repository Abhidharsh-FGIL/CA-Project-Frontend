/**
 * /user/study-plan/:attemptId — the plan generated from one attempt.
 *
 * A separate route because the plan is an action workspace, not another analytics
 * card on the report (§11 of the This Attempt spec).
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { UserShell } from '@/components/user/UserShell';
import { StudyPlanView } from '@/components/user/StudyPlanView';
import { buildAttemptReport } from '@/lib/attempt-report';
import { buildStudyPlan } from '@/lib/study-plan';
import { resolveExamContext } from '@/lib/exam-report-config';
import { useTnpscCatalog } from '@/hooks/use-tnpsc';
import { useUserPortal } from '@/contexts/UserPortalContext';
import { getAttemptDetail, type AttemptDetailResponse } from '@/lib/userPortalApi';

export default function UserStudyPlanPage() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const navigate = useNavigate();
  const { user } = useUserPortal();
  const { groups } = useTnpscCatalog();

  const [detail, setDetail] = useState<AttemptDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!attemptId) return;
    setLoading(true);
    setFailed(false);
    getAttemptDetail(attemptId)
      .then(setDetail)
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }, [attemptId]);

  const exam = useMemo(
    () => resolveExamContext({ groupId: user?.preferred_exam ?? null }, groups),
    [user?.preferred_exam, groups],
  );

  const plan = useMemo(() => {
    if (!detail) return null;
    return buildStudyPlan(buildAttemptReport(detail, {}, exam));
  }, [detail, exam]);

  if (loading) {
    return (
      <UserShell>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        </div>
      </UserShell>
    );
  }

  if (failed || !plan) {
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
      <StudyPlanView plan={plan} onBack={() => navigate(`/user/report/${attemptId}`)} />
    </UserShell>
  );
}
