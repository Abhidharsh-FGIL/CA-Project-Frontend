/**
 * Fetch + build the normalized report model for one attempt.
 *
 * `ReportBody.tsx` and `UserStudyPlanPage.tsx` each independently repeat this exact
 * fetch-then-build sequence (getAttemptDetail → resolveExamContext →
 * buildAttemptReport). The new report-flow screens introduced alongside this hook
 * (Overview, Detailed Insights, Subject Deep Dive, Question Insights, Question
 * Review, Mistake Intelligence) all need the identical sequence, so it is extracted
 * once here rather than copied five more times.
 *
 * The hook also owns the analysis lifecycle — status, polling and dispatch — so
 * that every report screen gates on the same judgement of "is the analysis
 * actually here yet" rather than each one deciding for itself (see
 * `ReportGate.tsx`, which is what screens render).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import {
  initialPollState,
  pollStep,
  type AnalysisPhase,
  type PollState,
} from '@/lib/analysis-poll';

export type { AnalysisPhase };

export function useAttemptReportModel(attemptId: string | undefined) {
  const { user } = useUserPortal();
  const { groups } = useTnpscCatalog();

  const [detail, setDetail] = useState<AttemptDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [analysis, setAnalysis] = useState<AttemptAnalysisResponse | null>(null);
  const [analysisPhase, setAnalysisPhase] = useState<AnalysisPhase>('loading');
  const [pollNonce, setPollNonce] = useState(0);

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
   * The backend pipeline's output (see the backend LLM architecture overhaul
   * plan) — a separate endpoint from `getAttemptDetail` above, so it is
   * fetched independently, then polled until it resolves.
   *
   * Polling exists because report screens now wait for this rather than
   * rendering around it. Without it, an aspirant who opens a report the
   * moment they finish a test would sit on "preparing your report" until they
   * thought to reload the page by hand.
   *
   * Generation is dispatched at most once per mount, tracked by a ref rather
   * than by the response status: the task only skips work whose sections
   * already read "ready", so a POST on every poll would be dozens of pointless
   * requests and, worse, could start a second task alongside one still
   * working. An explicit retry clears the ref, so the case that genuinely
   * needs re-dispatching — a section that failed on a transient error — still
   * gets it.
   */
  const dispatchedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!attemptId) return;
    const id = attemptId;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let state: PollState = initialPollState;

    const dispatchOnce = () => {
      if (dispatchedRef.current === id) return;
      dispatchedRef.current = id;
      requestAttemptAnalysis(id).catch(() => {
        // Best-effort. A dispatch that never lands leaves the poll loop to
        // reach `stalled`, which offers the aspirant a retry.
      });
    };

    const apply = (step: ReturnType<typeof pollStep>) => {
      state = step.state;
      setAnalysisPhase(step.phase);
      if (step.dispatch) dispatchOnce();
      if (step.continuePolling) timer = setTimeout(tick, step.delayMs);
    };

    function tick() {
      getAttemptAnalysis(id)
        .then(result => {
          if (cancelled) return;
          setAnalysis(result);
          apply(pollStep(state, { type: 'response', status: result.status }));
        })
        .catch(() => {
          if (cancelled) return;
          // The last good response stays in `analysis` — a blip in the status
          // endpoint must not blank a report that is already on screen.
          apply(pollStep(state, { type: 'error' }));
        });
    }

    setAnalysisPhase('loading');
    tick();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [attemptId, pollNonce]);

  /** Re-dispatch generation and restart polling — what a gate's Retry does. */
  const retryAnalysis = useCallback(() => {
    dispatchedRef.current = null;
    setPollNonce(n => n + 1);
  }, []);

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

  return { detail, model, examContext, loading, failed, analysis, analysisPhase, retryAnalysis };
}
