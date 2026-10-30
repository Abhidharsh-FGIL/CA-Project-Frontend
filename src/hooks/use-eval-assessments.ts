import { useQuery, useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { stageUnitId, stageUnitIds, stageUnitWeights } from '@/lib/assessment-pool';
import { api } from '@/lib/api';
import { useWorkspaceContext } from '@/contexts/WorkspaceContext';
import { toast } from 'sonner';
import { describeUnitNotOnServer, groupOfStage } from '@/lib/tnpscAdminApi';
import { syllabusApi } from '@/lib/taxonomyApi';
import type { PoolFilter, PoolMode } from '@/lib/assessment-pool';

export interface EvalAssessmentConfig {
  title: string;
  courseId?: string;
  paperId?: string;
  testType?: string;
  difficulty: string;
  questionIds: string[];
  questionCount: number;
  maxScore: number;
  dueDate?: string;
  mode?: string;
  timeLimitSeconds?: number;
  negativeMarking?: boolean;
  negativeMarkValue?: number;
  negativeMarkMode?: 'per_question' | 'per_group';
  negativeMarkGroupSize?: number;
  /**
   * Per-section deductions, for a paper whose sections are not marked alike
   * (GAT-B: 0.5 in Section A, 1 in Section B). `negativeMarkValue` is still sent
   * alongside — set to the least punitive section — so a backend that does not
   * understand this field scores leniently instead of over-penalising.
   * See GAT_B_BACKEND_CHANGES.md §6.
   */
  negativeMarkSections?: Array<{
    name: string;
    subjectIds?: string[];
    negativeMarkValue: number;
    marksPerQuestion?: number;
    questions: number;
    attempt?: number;
  }>;
  maxAttempts?: number;
  shuffleQuestions?: boolean;
  subjectWeights?: Record<string, number>;
  /**
   * Published syllabus units the questions are drawn from, and their weights (percent,
   * summing to 100). Sent alongside `subjectWeights`, which a server that only knows
   * subjects reads instead — BACKEND_WORK.md item 14.
   */
  unitIds?: string[];
  unitWeights?: Record<string, number>;
  paperIds?: string[];
  paperWeights?: Record<string, number>;
  /**
   * Whether the paper is a fixed set of questions or a pool each attempt is drawn from, and the
   * rule the pool was made by. Sent so the server can draw from the bank as it is when a student
   * starts — see `assessment-pool.ts` and BACKEND_LIVE_POOL.md.
   */
  poolMode?: PoolMode;
  poolFilter?: PoolFilter | null;
  /** The Simple / Medium / Complex mix a whole or mixed paper was made to — BACKEND_BLEND_EDIT.md §3. */
  difficultyBlend?: { easy: number; medium: number; hard: number };
  pricingType?: 'free' | 'paid';
  price?: number;
  promoCode?: string;
  promoDiscountPct?: number;
  /** TNPSC placement — see TNPSC_API_SPEC.md §7.8. */
  tnpscStageId?: string;
  track?: 'mock' | 'practice';
  tnpscLevel?: 'simple' | 'medium' | 'complex';
  tnpscSubjectId?: string;
  tnpscTopicId?: string;
  /** The published syllabus unit a unit-wise practice paper is filed under. */
  tnpscUnitId?: string;
  /** Whether a practice paper covers one unit or a whole printed section. */
  tnpscScope?: 'unit' | 'section';
  /** The section a section-wise practice paper covers, by its printed name. */
  tnpscSectionName?: string;
  /** Which language paper a full mock is sat in, where the stage offers a choice. */
  tnpscLanguage?: 'tamil' | 'english';
}

export function useEvalAssessments(filters?: { status?: string; search?: string }) {
  const { orgId } = useWorkspaceContext();

  return useQuery({
    queryKey: ['eval-assessments', orgId, filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (orgId) params.set('org_id', orgId);
      if (filters?.status && filters.status !== 'all') params.set('status', filters.status);
      if (filters?.search) params.set('search', filters.search);
      return api.get<any[]>(`/api/v1/evaluation/assessments?${params}`);
    },
  });
}

export function useEvalAssessmentDetail(assessmentId?: string) {
  return useQuery({
    queryKey: ['eval-assessment-detail', assessmentId],
    queryFn: () => api.get<any>(`/api/v1/evaluation/assessments/${assessmentId}`),
    enabled: !!assessmentId,
  });
}

/**
 * The unit ids the server lists for a stage (`GET /syllabus/{exam}/{stage}`), shared with `useSyllabus`'s cache.
 * Null when there is no stage or the list cannot be read — the ids are then sent as chosen.
 */
async function stageUnitIdsFromServer(qc: QueryClient, stageId: string | undefined): Promise<string[] | null> {
  const groupId = stageId ? groupOfStage(stageId) : null;
  if (!stageId || !groupId) return null;
  try {
    const syllabus = await qc.fetchQuery({
      queryKey: ['syllabus', groupId, stageId],
      queryFn: () => syllabusApi.get(groupId, stageId),
      staleTime: 5 * 60 * 1000,
    });
    const ids = (syllabus?.units ?? []).map(u => u.id).filter(Boolean);
    return ids.length ? ids : null;
  } catch {
    return null;
  }
}

export function useCreateEvalAssessment() {
  const { orgId } = useWorkspaceContext();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (config: EvalAssessmentConfig) => {
      // The stage's own unit ids, from the server — what it checks every unit id against.
      const stageIds = await stageUnitIdsFromServer(qc, config.tnpscStageId);
      const unitId = (id: string | undefined) => (id ? stageUnitId(id, stageIds) : id);
      const payload = {
        title: config.title,
        course_id: config.courseId || null,
        paper_id: config.paperId || null,
        test_type: config.testType,
        difficulty: config.difficulty,
        question_ids: config.questionIds,
        question_count: config.questionCount,
        max_score: config.maxScore,
        due_date: config.dueDate,
        mode: config.mode || 'exam',
        time_limit_seconds: config.timeLimitSeconds,
        negative_marking: config.negativeMarking ?? false,
        negative_mark_value: config.negativeMarkValue,
        negative_mark_mode: config.negativeMarkMode,
        negative_mark_group_size: config.negativeMarkGroupSize,
        negative_mark_sections: config.negativeMarkSections?.map(sec => ({
          name: sec.name,
          subject_ids: sec.subjectIds,
          negative_mark_value: sec.negativeMarkValue,
          marks_per_question: sec.marksPerQuestion,
          questions: sec.questions,
          attempt: sec.attempt,
        })),
        max_attempts: config.maxAttempts || null,
        shuffle_questions: config.shuffleQuestions ?? true,
        subject_weights: config.subjectWeights,
        unit_ids: stageUnitIds(config.unitIds, stageIds),
        unit_weights: stageUnitWeights(config.unitWeights, stageIds),
        paper_ids: config.paperIds,
        paper_weights: config.paperWeights,
        pool_mode: config.poolMode ?? 'fixed',
        pool_filter: config.poolFilter
          ? { ...config.poolFilter, unit_ids: stageUnitIds(config.poolFilter.unit_ids, stageIds) }
          : null,
        difficulty_blend: config.difficultyBlend ?? null,
        pricing_type: config.pricingType,
        price: config.price,
        promo_code: config.promoCode || null,
        promo_discount_pct: config.promoDiscountPct,
        // TNPSC placement
        tnpsc_stage_id: config.tnpscStageId ?? null,
        track: config.track ?? null,
        tnpsc_level: config.tnpscLevel ?? null,
        tnpsc_subject_id: config.tnpscSubjectId ?? null,
        tnpsc_topic_id: config.tnpscTopicId ?? null,
        tnpsc_unit_id: unitId(config.tnpscUnitId) ?? null,
        tnpsc_scope: config.tnpscScope ?? null,
        tnpsc_section_name: config.tnpscSectionName ?? null,
        tnpsc_language: config.tnpscLanguage ?? null,
      };
      return api.post<any>(`/api/v1/evaluation/assessments?org_id=${orgId}`, payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['eval-assessments'] });
      toast.success('Assessment created!');
    },
    onError: (err: Error) => toast.error(describeUnitNotOnServer(err.message) ?? (err.message || 'Failed to create assessment'), { duration: 12000 }),
  });
}

export function useUpdateEvalAssessmentStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/api/v1/evaluation/assessments/${id}/status`, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['eval-assessments'] });
      toast.success('Status updated');
    },
  });
}

/** Assessment details sent alongside invitations so the backend can render a
 *  rich invite email (title, mode, duration, marks, deadline, etc.). */
export interface AssessmentInviteDetails {
  title?: string | null;
  mode?: string | null;
  difficulty?: string | null;
  subject?: string | null;
  question_count?: number | null;
  max_score?: number | null;
  time_limit_seconds?: number | null;
  due_date?: string | null;
  negative_marking?: boolean | null;
  negative_mark_value?: number | null;
  max_attempts?: number | null;
  course_name?: string | null;
}

export function useSendEvalInvitations() {
  const { orgId } = useWorkspaceContext();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ assessmentId, emails, classId, assessmentDetails }: {
      assessmentId: string;
      emails: string[];
      classId?: string;
      assessmentDetails?: AssessmentInviteDetails;
    }) =>
      api.post<{ created: number; skipped: number; total: number }>(
        `/api/v1/evaluation/assessments/${assessmentId}/distribute`,
        {
          emails,
          class_id: classId || null,
          org_id: orgId,
          assessment_details: assessmentDetails ?? null,
        },
      ),
    onSuccess: (data, vars) => {
      qc.invalidateQueries({ queryKey: ['eval-assessment-detail', vars.assessmentId] });
      qc.invalidateQueries({ queryKey: ['eval-invitation-stats'] });
      qc.invalidateQueries({ queryKey: ['eval-assessments'] });
      const msg = data.skipped > 0
        ? `${data.created} new invitation${data.created !== 1 ? 's' : ''} sent (${data.skipped} already invited)`
        : `${data.created} invitation${data.created !== 1 ? 's' : ''} sent!`;
      toast.success(msg);
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to send invitations'),
  });
}

export function useEvalAssessmentInvitations(assessmentId?: string) {
  return useQuery({
    queryKey: ['eval-invitations', assessmentId],
    queryFn: () =>
      api.get<any[]>(`/api/v1/evaluation/assessments/${assessmentId}/invitations`),
    enabled: !!assessmentId,
  });
}

/** Assessment ids per stats request — short enough to stay well inside any address-length limit. */
const STATS_BATCH = 30;

export function useEvalInvitationStats(assessmentIds: string[]) {
  return useQuery({
    queryKey: ['eval-invitation-stats', assessmentIds],
    queryFn: async () => {
      const stats: Record<string, { invited: number; submitted: number; avgScore: number | null }> = {};
      if (assessmentIds.length === 0) return stats;

      // In batches. Every id in one address ran to several kilobytes at a couple of hundred assessments, which the
      // server refuses — and, with the error swallowed below, every assessment then read as 0 invited, 0 submitted.
      const batches: string[][] = [];
      for (let i = 0; i < assessmentIds.length; i += STATS_BATCH) batches.push(assessmentIds.slice(i, i + STATS_BATCH));
      const results = await Promise.all(
        batches.map(async ids => {
          try {
            return await api.get<any[]>(`/api/v1/evaluation/assessments/stats?ids=${ids.join(',')}`);
          } catch {
            // A batch that fails leaves its assessments at zero; the others still count.
            return [] as any[];
          }
        }),
      );
      for (const rows of results) {
        if (!Array.isArray(rows)) continue;
        for (const row of rows) {
          stats[row.id] = {
            invited: row.invited ?? 0,
            submitted: row.submitted ?? 0,
            avgScore: row.avg_score ?? null,
          };
        }
      }

      for (const id of assessmentIds) {
        if (!stats[id]) stats[id] = { invited: 0, submitted: 0, avgScore: null };
      }
      return stats;
    },
    enabled: assessmentIds.length > 0,
  });
}

export function useReinviteEvalAssessment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ assessmentId, emails }: { assessmentId: string; emails?: string[] }) =>
      api.post<{ created: number; skipped: number; total: number }>(
        `/api/v1/evaluation/assessments/${assessmentId}/reinvite`,
        { emails: emails || null },
      ),
    onSuccess: (data, vars) => {
      qc.invalidateQueries({ queryKey: ['eval-assessment-detail', vars.assessmentId] });
      qc.invalidateQueries({ queryKey: ['eval-invitations', vars.assessmentId] });
      qc.invalidateQueries({ queryKey: ['eval-invitation-stats'] });
      qc.invalidateQueries({ queryKey: ['eval-assessments'] });
      toast.success(`Re-invited ${data.created} student${data.created !== 1 ? 's' : ''}.`);
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to re-invite'),
  });
}

export function useEvalAttemptDetail(assessmentId?: string, attemptId?: string) {
  return useQuery({
    queryKey: ['eval-attempt-detail', assessmentId, attemptId],
    queryFn: () =>
      api.get<any>(`/api/v1/evaluation/assessments/${assessmentId}/attempts/${attemptId}/detail`),
    enabled: !!assessmentId && !!attemptId,
  });
}

export function useDeleteEvalAssessment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/v1/evaluation/assessments/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['eval-assessments'] });
      toast.success('Assessment deleted');
    },
  });
}

/**
 * Change the difficulty mix of a mock, a full set or a mixed unit / key-topic set.
 *
 * `PATCH /api/v1/evaluation/assessments/{id}/blend` — the server draws the paper's questions again to the new mix
 * from the pool it was made from, and stores the mix (BACKEND_BLEND_EDIT.md). Attempts already taken keep the
 * questions they were sat on. A server without the endpoint answers 404/405, which is said plainly.
 */
export function useUpdateAssessmentBlend() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, blend }: { id: string; blend: { easy: number; medium: number; hard: number } }) =>
      api.patch<any>(`/api/v1/evaluation/assessments/${id}/blend`, { difficulty_blend: blend }),
    onSuccess: (res: any, { id }) => {
      qc.invalidateQueries({ queryKey: ['eval-assessments'] });
      qc.invalidateQueries({ queryKey: ['eval-assessment-detail', id] });
      const short = res?.shortfall && Object.values(res.shortfall).some((n: any) => Number(n) > 0);
      if (short) {
        toast.warning(res?.message || 'Mix updated, but the bank is short at some difficulty, so the rest came from the other levels.', {
          duration: 10000,
        });
      } else {
        toast.success('Difficulty mix updated');
      }
    },
    onError: (err: any) => {
      if (err?.status === 404 || err?.status === 405) {
        toast.error('Changing the mix of a saved assessment is not available on the server yet.', { duration: 10000 });
        return;
      }
      toast.error(err?.message || 'Could not update the difficulty mix');
    },
  });
}
