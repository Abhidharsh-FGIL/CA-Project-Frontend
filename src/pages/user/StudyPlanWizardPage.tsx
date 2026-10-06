/**
 * /user/study-plan/new — the intake, then the generation job.
 *
 * The page's only responsibilities are resolving which exam stage the plan is
 * for, supplying the §S6.1 facts shim when the plan is based on an attempt, and
 * driving the job poll. The intake itself is `StudyPlanWizard`, and everything it
 * collects is posted to the server, which decides what the plan actually contains.
 */
import { useCallback, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { UserShell } from '@/components/user/UserShell';
import { ReportCard, SectionHeader } from '@/components/user/report-ui';
import { StudyPlanWizard } from '@/components/user/study-plan/StudyPlanWizard';
import { StudyPlanGenerating } from '@/components/user/study-plan/StudyPlanGenerating';
import { StudyPlanUnavailable } from '@/components/user/study-plan/plan-ui';
import { useIntakeOptions, planKeys } from '@/hooks/use-study-plan';
import { useTnpscCatalog } from '@/hooks/use-tnpsc';
import { useUserPortal } from '@/contexts/UserPortalContext';
import { findGroup } from '@/config/tnpsc';
import {
  createStudyPlan,
  pollPlanGeneration,
  type PlanJobStatus,
  type StudyPlanIntake,
} from '@/lib/studyPlanApi';
import { buildAttemptReport, factsFromModel } from '@/lib/attempt-report';
import { resolveExamContext } from '@/lib/exam-report-config';
import { getAttemptDetail } from '@/lib/userPortalApi';

export default function StudyPlanWizardPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const qc = useQueryClient();
  const { user } = useUserPortal();
  const { groups } = useTnpscCatalog();

  /**
   * Which exam this plan is for.
   *
   * The candidate's `preferred_exam` names the group; the stage is the group's
   * first (and for every current exam, only) stage. An explicit ?stage= wins, so
   * a multi-stage exam can link straight to the stage it means.
   */
  const { groupId, stageId } = useMemo(() => {
    const g = params.get('group') ?? user?.preferred_exam ?? null;
    const explicitStage = params.get('stage');
    if (explicitStage) return { groupId: g, stageId: explicitStage };
    const group = findGroup(g ?? undefined, groups);
    return { groupId: group?.id ?? null, stageId: group?.stages[0]?.id ?? null };
  }, [params, user?.preferred_exam, groups]);

  const { options, isLoading, unavailable } = useIntakeOptions(
    groupId ?? undefined,
    stageId ?? undefined,
  );

  const [submitting, setSubmitting] = useState(false);
  const [jobStatus, setJobStatus] = useState<PlanJobStatus | null>(null);
  const [lastIntake, setLastIntake] = useState<StudyPlanIntake | null>(null);

  /**
   * Facts for an attempt-based plan — the migration shim of §S6.1.
   *
   * Priority ranking still lives in `attempt-report.ts`, so the numbers the
   * backend would need to rank subjects travel with the intake, exactly as they
   * already do for `requestReportInsights`. Once the backend computes priorities
   * itself, this function and `basis.facts` both go.
   */
  const factsFor = useCallback(
    async (attemptId: string): Promise<unknown | undefined> => {
      try {
        const detail = await getAttemptDetail(attemptId);
        const exam = resolveExamContext({ groupId, stageId }, groups);
        return factsFromModel(buildAttemptReport(detail, {}, exam));
      } catch {
        // The plan is still buildable without them — the server falls back to
        // mark-share weighting, which is the cold-start path.
        return undefined;
      }
    },
    [groupId, stageId, groups],
  );

  const submit = useCallback(
    async (intake: StudyPlanIntake) => {
      setSubmitting(true);
      setLastIntake(intake);
      setJobStatus({ status: 'queued', progress: 0, stage_label: null, error: null });

      try {
        // Resolve the facts shim here rather than in the wizard, so the wizard
        // stays synchronous and never waits on a network call mid-step.
        let body = intake;
        if (intake.basis.kind === 'attempt' && intake.basis.attempt_id && !intake.basis.facts) {
          const facts = await factsFor(intake.basis.attempt_id);
          if (facts) body = { ...intake, basis: { ...intake.basis, facts } };
        }

        const created = await createStudyPlan(body);
        await pollPlanGeneration(created.plan_id, setJobStatus);
        await qc.invalidateQueries({ queryKey: planKeys.active });
        toast.success('Your study plan is ready.');
        navigate('/user/study-plan', { replace: true });
      } catch (err) {
        setJobStatus({
          status: 'failed',
          progress: 0,
          stage_label: null,
          error: (err as Error).message,
        });
      } finally {
        setSubmitting(false);
      }
    },
    [factsFor, qc, navigate],
  );

  // ── States ─────────────────────────────────────────────────────────────────

  if (unavailable) {
    return (
      <UserShell>
        <StudyPlanUnavailable />
      </UserShell>
    );
  }

  if (!groupId || !stageId) {
    return (
      <UserShell>
        <ReportCard>
          <SectionHeader
            icon={<AlertTriangle className="w-4 h-4" />}
            title="We don't know which exam to plan for"
            accent="amber"
          />
          <p className="text-[11px] leading-relaxed text-gray-500 dark:text-gray-400">
            Set your target exam on your profile, then come back — the plan is built from that
            exam's syllabus, so it cannot be made without one.
          </p>
          <button
            type="button"
            onClick={() => navigate('/user/profile?tab=profile&edit=1')}
            className="mt-3 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-indigo-700"
          >
            Choose my exam
          </button>
        </ReportCard>
      </UserShell>
    );
  }

  if (isLoading) {
    return (
      <UserShell>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        </div>
      </UserShell>
    );
  }

  if (jobStatus && (submitting || jobStatus.status === 'failed')) {
    return (
      <UserShell>
        <StudyPlanGenerating
          status={jobStatus}
          onRetry={lastIntake ? () => void submit(lastIntake) : undefined}
          onCancel={() => setJobStatus(null)}
        />
      </UserShell>
    );
  }

  return (
    <UserShell>
      <StudyPlanWizard
        groupId={groupId}
        stageId={stageId}
        options={options}
        onSubmit={intake => void submit(intake)}
        submitting={submitting}
        onCancel={() => navigate('/user/study-plan')}
      />
    </UserShell>
  );
}
