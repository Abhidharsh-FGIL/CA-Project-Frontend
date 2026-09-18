/**
 * Fetch + build the normalized report model for one attempt.
 *
 * `ReportBody.tsx` and `UserStudyPlanPage.tsx` each independently repeat this exact
 * fetch-then-build sequence (getAttemptDetail → resolveExamContext →
 * buildAttemptReport). The new report-flow screens introduced alongside this hook
 * (Overview, Detailed Insights, Subject Deep Dive, Question Insights, Question
 * Review, Mistake Intelligence) all need the identical sequence, so it is extracted
 * once here rather than copied five more times.
 */
import { useEffect, useMemo, useState } from 'react';
import { useTnpscCatalog } from '@/hooks/use-tnpsc';
import { useUserPortal } from '@/contexts/UserPortalContext';
import { getAttemptDetail, type AttemptDetailResponse } from '@/lib/userPortalApi';
import { buildAttemptReport, type AttemptReportModel } from '@/lib/attempt-report';
import { resolveExamContext } from '@/lib/exam-report-config';

export function useAttemptReportModel(attemptId: string | undefined) {
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

  // The attempt's own group/stage is exact; the aspirant's registered exam is a
  // fallback for whatever it doesn't carry — same preference order ReportBody uses.
  const examContext = useMemo(() => {
    const fromDetail = (detail as any)?.attempt ?? {};
    return resolveExamContext(
      {
        groupId: fromDetail.group_id ?? user?.preferred_exam ?? null,
        stageId: fromDetail.stage_id ?? null,
      },
      groups,
    );
  }, [detail, user?.preferred_exam, groups]);

  const model: AttemptReportModel | null = useMemo(() => {
    if (!detail) return null;
    return buildAttemptReport(detail, {}, examContext);
  }, [detail, examContext]);

  return { detail, model, examContext, loading, failed };
}
