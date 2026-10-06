/**
 * /user/study-plan — the active plan, or a prompt to build one.
 * /user/study-plan/:planId — a specific plan, including superseded revisions.
 *
 * A separate route from the report because the plan is a workspace the candidate
 * returns to daily, not another analytics panel. Everything on screen is served
 * by the backend (STUDY_PLAN_BACKEND_CHANGES.md); this page resolves which plan
 * to show, handles the revise handoff from the report page, and renders states.
 */
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Loader2, PauseCircle, PlayCircle, RefreshCw, Sparkles, Wand2 } from 'lucide-react';
import { toast } from 'sonner';
import { UserShell } from '@/components/user/UserShell';
import { ReportCard, SectionHeader } from '@/components/user/report-ui';
import { StudyPlanWorkspace } from '@/components/user/study-plan/StudyPlanWorkspace';
import { StudyPlanGenerating } from '@/components/user/study-plan/StudyPlanGenerating';
import { StudyPlanUnavailable } from '@/components/user/study-plan/plan-ui';
import { useActiveStudyPlan, useStudyPlan, planKeys } from '@/hooks/use-study-plan';
import { useQueryClient } from '@tanstack/react-query';
import {
  pollPlanGeneration,
  revisePlan,
  updateStudyPlan,
  type PlanJobStatus,
} from '@/lib/studyPlanApi';

export default function UserStudyPlanPage() {
  const { planId } = useParams<{ planId: string }>();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const qc = useQueryClient();

  const active = useActiveStudyPlan(!planId);
  const specific = useStudyPlan(planId);

  const [revising, setRevising] = useState(false);
  const [jobStatus, setJobStatus] = useState<PlanJobStatus | null>(null);
  /** Held separately from the URL, which is cleared before the job starts, so a
   *  failed revision can still be retried. */
  const [reviseAttempt, setReviseAttempt] = useState<string | null>(null);

  const plan = planId ? specific.plan : (active.data?.plan ?? null);
  const today = planId ? null : (active.data?.today ?? null);
  const isLoading = planId ? specific.isLoading : active.isLoading;
  const unavailable = planId ? specific.unavailable : active.unavailable;
  const error = planId ? specific.error : active.error;

  /**
   * The report page hands off here with ?revise_from=<attemptId>.
   *
   * Revising versions the plan rather than replacing it, so the candidate keeps
   * the work they have already ticked off while the schedule ahead re-tunes to
   * the newer result.
   */
  const reviseFrom = params.get('revise_from');

  const runRevise = useCallback(
    async (attemptId: string, targetPlanId: string) => {
      setRevising(true);
      setReviseAttempt(attemptId);
      setJobStatus({ status: 'queued', progress: 0, stage_label: null, error: null });
      try {
        const res = await revisePlan(targetPlanId, { kind: 'attempt', attempt_id: attemptId });
        await pollPlanGeneration(res.plan_id, setJobStatus);
        await qc.invalidateQueries({ queryKey: planKeys.active });
        toast.success('Your plan has been re-tuned to your latest result.');
        navigate('/user/study-plan', { replace: true });
      } catch (err) {
        setJobStatus({
          status: 'failed',
          progress: 0,
          stage_label: null,
          error: (err as Error).message,
        });
      } finally {
        setRevising(false);
      }
    },
    [qc, navigate],
  );

  useEffect(() => {
    if (!reviseFrom || !plan || revising) return;
    // Clear the param first, so a refresh mid-generation does not fire it twice.
    setParams(p => {
      const next = new URLSearchParams(p);
      next.delete('revise_from');
      return next;
    }, { replace: true });
    void runRevise(reviseFrom, plan.plan_id);
  }, [reviseFrom, plan, revising, runRevise, setParams]);

  const togglePause = async () => {
    if (!plan) return;
    const next = plan.status === 'paused' ? 'active' : 'paused';
    try {
      await updateStudyPlan(plan.plan_id, { status: next });
      await qc.invalidateQueries({ queryKey: planKeys.active });
      if (planId) await qc.invalidateQueries({ queryKey: planKeys.plan(planId) });
      toast.success(next === 'paused' ? 'Plan paused.' : 'Plan resumed.');
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  // ── States ─────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <UserShell>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        </div>
      </UserShell>
    );
  }

  if (unavailable) {
    return (
      <UserShell>
        <StudyPlanUnavailable />
      </UserShell>
    );
  }

  if (revising || jobStatus?.status === 'failed') {
    return (
      <UserShell>
        <StudyPlanGenerating
          status={jobStatus}
          onRetry={
            reviseAttempt && plan
              ? () => void runRevise(reviseAttempt, plan.plan_id)
              : undefined
          }
          onCancel={() => {
            setJobStatus(null);
            setReviseAttempt(null);
            navigate('/user/study-plan', { replace: true });
          }}
        />
      </UserShell>
    );
  }

  if (error) {
    return (
      <UserShell>
        <ReportCard>
          <SectionHeader icon={<RefreshCw className="w-4 h-4" />} title="Your plan could not be loaded" accent="rose" />
          <p className="text-[11px] text-gray-500 dark:text-gray-400">{error.message}</p>
        </ReportCard>
      </UserShell>
    );
  }

  if (!plan) {
    return (
      <UserShell>
        <EmptyState onCreate={() => navigate('/user/study-plan/new')} />
      </UserShell>
    );
  }

  // A plan still generating (page opened mid-build, or reached by direct link).
  if (plan.status === 'generating') {
    return (
      <UserShell>
        <StudyPlanGenerating status={jobStatus} />
      </UserShell>
    );
  }

  return (
    <UserShell>
      <StudyPlanWorkspace
        plan={plan}
        today={today}
        action={
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={togglePause}
              className="inline-flex items-center gap-1 rounded-lg border border-gray-200 dark:border-gray-800 px-2 py-1 text-[10px] font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/60"
            >
              {plan.status === 'paused' ? (
                <>
                  <PlayCircle className="w-3 h-3" /> Resume
                </>
              ) : (
                <>
                  <PauseCircle className="w-3 h-3" /> Pause
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => navigate('/user/study-plan/new')}
              className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-2 py-1 text-[10px] font-bold text-white hover:bg-indigo-700"
            >
              <Wand2 className="w-3 h-3" /> New plan
            </button>
          </div>
        }
      />
    </UserShell>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <ReportCard>
      <div className="py-10 text-center">
        <span className="inline-flex w-12 h-12 rounded-full items-center justify-center bg-indigo-50 dark:bg-indigo-950/40 mb-3">
          <Wand2 className="w-6 h-6 text-indigo-500" />
        </span>
        <p className="text-sm font-bold text-gray-900 dark:text-gray-100">
          You don't have a study plan yet
        </p>
        <p className="mx-auto mt-1.5 max-w-md text-[11px] leading-relaxed text-gray-500 dark:text-gray-400">
          Tell us how long you have before the exam, which days you study and for how long. We'll
          turn the whole syllabus into a dated, day-by-day plan — weighted towards whatever your
          mock tests show you need most, with spaced revision and mocks built in.
        </p>
        <button
          type="button"
          onClick={onCreate}
          className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-indigo-700"
        >
          <Sparkles className="w-4 h-4" /> Build my study plan
        </button>
      </div>
    </ReportCard>
  );
}
