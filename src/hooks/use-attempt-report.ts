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
import {
  getAttemptAnalysis,
  getAttemptDetail,
  requestAttemptAnalysis,
  type AttemptAnalysisResponse,
  type AttemptDetailResponse,
} from '@/lib/userPortalApi';
import { buildAttemptReport, type AttemptReportModel } from '@/lib/attempt-report';
import { resolveExamContext } from '@/lib/exam-report-config';

export function useAttemptReportModel(attemptId: string | undefined) {
  const { user } = useUserPortal();
  const { groups } = useTnpscCatalog();

  const [detail, setDetail] = useState<AttemptDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [analysis, setAnalysis] = useState<AttemptAnalysisResponse | null>(null);

  useEffect(() => {
    if (!attemptId) return;
    setLoading(true);
    setFailed(false);
    getAttemptDetail(attemptId)
      .then(setDetail)
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }, [attemptId]);

  /**
   * The new, six-prompt backend pipeline's output (see the backend LLM
   * architecture overhaul plan) — a separate endpoint from `getAttemptDetail`
   * above, so it is fetched independently. Same "prime the cache in the
   * background" idiom `ReportBody.tsx` already uses for the older
   * `/report-insights` endpoint: read what's ready now, and if generation
   * has never been dispatched for this attempt, dispatch it fire-and-forget
   * so a *later* view of this same report has it cached. A screen that reads
   * `analysis` renders its deterministic fallback in the meantime — nothing
   * here blocks the page.
   */
  useEffect(() => {
    if (!attemptId) return;
    getAttemptAnalysis(attemptId)
      .then(result => {
        setAnalysis(result);
        // Dispatch whenever this attempt isn't fully done yet — not just
        // "not_started". The backend task is itself idempotent (it only
        // regenerates whichever sections aren't "ready" yet, see
        // ai_tasks.py), so re-dispatching on a "generating" or "failed"
        // response is exactly what lets a section that failed once (a
        // transient OpenAI error, a config issue since fixed) actually get
        // retried on a later view — gating this on "not_started" alone
        // meant a failed section stayed failed forever, since nothing ever
        // asked the backend to try it again.
        if (result.status !== 'ready') {
          requestAttemptAnalysis(attemptId).catch(() => {
            // Best-effort — the deterministic report already renders in full.
          });
        }
      })
      .catch(() => {
        // Best-effort: a screen reading `analysis` treats a null value the
        // same as "not ready yet" and falls back to deterministic content.
      });
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

  return { detail, model, examContext, loading, failed, analysis };
}
