import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useGamification } from '@/contexts/GamificationContext';
import { useWorkspaceContext } from '@/contexts/WorkspaceContext';

export interface Question {
  id: string;
  type: 'mcq' | 'fill' | 'short' | 'long';
  text: string;
  options?: string[];
  correctAnswer?: string;
  points: number;
}

export function useMyAssessments() {
  const { user } = useAuth();
  const { orgId, workspaceReady } = useWorkspaceContext();
  const wsParam = orgId || 'personal';
  return useQuery({
    queryKey: ['my-assessments', user?.id, wsParam],
    queryFn: async () => {
      const res = await api.get<any>(`/api/v1/assessments/?org_id=${wsParam}&limit=50`);
      return res?.items ?? res ?? [];
    },
    enabled: !!user?.id && workspaceReady,
  });
}

interface AssessmentPage {
  items: any[];
  next_cursor: string | null;
  has_more: boolean;
  total: number;
}

const ASSESSMENTS_PAGE_SIZE = 12;

export function useMyAssessmentsInfinite() {
  const { user } = useAuth();
  const { orgId, workspaceReady } = useWorkspaceContext();
  const wsParam = orgId || 'personal';

  const query = useInfiniteQuery({
    queryKey: ['my-assessments-infinite', user?.id, wsParam],
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams({ org_id: wsParam, limit: String(ASSESSMENTS_PAGE_SIZE) });
      if (pageParam) params.set('cursor', pageParam);
      return api.get<AssessmentPage>(`/api/v1/assessments/?${params}`);
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.has_more ? lastPage.next_cursor : undefined,
    enabled: !!user?.id && workspaceReady,
  });

  const allItems = query.data?.pages.flatMap((p) => p.items) ?? [];
  const total = query.data?.pages[0]?.total ?? 0;

  return {
    ...query,
    data: allItems,
    total,
    fetchNextPage: query.fetchNextPage,
    hasNextPage: query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
  };
}

export function useCreateAssessment() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { orgId } = useWorkspaceContext();
  return useMutation({
    mutationFn: (assessment: {
      title: string;
      subject?: string;
      board?: string;
      grade?: number;
      topics?: string[];
      difficulty?: string;
      mode?: string;
      time_limit?: number;
      negative_marking?: boolean;
      negative_mark_value?: number;
      questions: Question[];
    }) =>
      api.post<any>('/api/v1/assessments/', {
        title: assessment.title,
        subject: assessment.subject || null,
        org_id: orgId || null,
        board: assessment.board || null,
        grade: assessment.grade || null,
        topics: assessment.topics || [],
        difficulty: assessment.difficulty || 'medium',
        mode: assessment.mode || 'practice',
        time_limit: assessment.time_limit || null,
        negative_marking: assessment.negative_marking ?? false,
        negative_mark_value: assessment.negative_mark_value ?? 0.25,
        questions: assessment.questions,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-assessments'] });
      toast({ title: 'Assessment created' });
    },
  });
}

export function useDeleteAssessment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/v1/assessments/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-assessments'] }),
  });
}

export function useAssessmentAttempts(assessmentId?: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['assessment-attempts', assessmentId, user?.id],
    queryFn: () =>
      assessmentId
        ? api.get<any[]>(`/api/v1/assessments/${assessmentId}/attempts`)
        : api.get<any[]>('/api/v1/assessments/attempts'),
    enabled: !!user?.id,
  });
}

export function useStartAttempt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (assessmentId: string) =>
      api.post<any>(`/api/v1/assessments/${assessmentId}/start`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['assessment-attempts'] }),
  });
}

export function useSubmitAttempt() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { recordActivity } = useGamification();
  return useMutation({
    mutationFn: ({ attemptId, responses, score }: { attemptId: string; responses: Record<string, string>; score: number }) =>
      api.post<any>(`/api/v1/assessments/attempts/${attemptId}/submit`, { responses, score }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['assessment-attempts'] });
      qc.invalidateQueries({ queryKey: ['subscription'] });
      qc.invalidateQueries({ queryKey: ['gamification'] });
      toast({ title: 'Assessment submitted!' });
      recordActivity();
    },
  });
}
