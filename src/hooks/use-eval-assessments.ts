import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useWorkspaceContext } from '@/contexts/WorkspaceContext';
import { toast } from 'sonner';

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
  paperIds?: string[];
  paperWeights?: Record<string, number>;
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

export function useCreateEvalAssessment() {
  const { orgId } = useWorkspaceContext();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (config: EvalAssessmentConfig) => {
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
        paper_ids: config.paperIds,
        paper_weights: config.paperWeights,
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
      };
      return api.post<any>(`/api/v1/evaluation/assessments?org_id=${orgId}`, payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['eval-assessments'] });
      toast.success('Assessment created!');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to create assessment'),
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

export function useEvalInvitationStats(assessmentIds: string[]) {
  return useQuery({
    queryKey: ['eval-invitation-stats', assessmentIds],
    queryFn: async () => {
      const stats: Record<string, { invited: number; submitted: number; avgScore: number | null }> = {};
      if (assessmentIds.length === 0) return stats;

      try {
        const rows = await api.get<any[]>(
          `/api/v1/evaluation/assessments/stats?ids=${assessmentIds.join(',')}`,
        );
        if (Array.isArray(rows)) {
          for (const row of rows) {
            stats[row.id] = {
              invited: row.invited ?? 0,
              submitted: row.submitted ?? 0,
              avgScore: row.avg_score ?? null,
            };
          }
        }
      } catch {
        // return empty stats on error
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
