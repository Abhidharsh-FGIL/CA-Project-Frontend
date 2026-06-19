import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspaceContext } from '@/contexts/WorkspaceContext';

export function useInsights() {
  const { user } = useAuth();
  const { orgId, workspaceReady } = useWorkspaceContext();
  const wsParam = orgId || 'personal';
  return useQuery({
    queryKey: ['user-insights', user?.id, wsParam],
    queryFn: () => api.get<any[]>(`/api/v1/insights/?unread_only=false&limit=5&org_id=${wsParam}`),
    enabled: !!user?.id && workspaceReady,
  });
}

export function useAllInsights() {
  const { user } = useAuth();
  const { orgId, workspaceReady } = useWorkspaceContext();
  const wsParam = orgId || 'personal';
  return useQuery({
    queryKey: ['all-insights', user?.id, wsParam],
    queryFn: () => api.get<any[]>(`/api/v1/insights/?org_id=${wsParam}`),
    enabled: !!user?.id && workspaceReady,
  });
}

export function useDismissInsight() {
  const qc = useQueryClient();
  return useMutation({
    // PATCH /{id} — backend marks insight as read/dismissed
    mutationFn: (id: string) => api.patch(`/api/v1/insights/${id}`, { dismissed: true }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['user-insights'] });
      qc.invalidateQueries({ queryKey: ['all-insights'] });
    },
  });
}

export function useGenerateInsights() {
  const qc = useQueryClient();
  const { orgId } = useWorkspaceContext();
  const wsParam = orgId || 'personal';
  return useMutation({
    // Send force_refresh: true so existing cached insights are replaced
    mutationFn: () => api.post(`/api/v1/insights/generate?org_id=${wsParam}`, { force_refresh: true }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['user-insights'] });
      qc.invalidateQueries({ queryKey: ['all-insights'] });
    },
  });
}

/** Fetch assessment-based recommendations from the DB (auto-generates on first call). */
export function useRecommendations() {
  const { user } = useAuth();
  const { orgId, workspaceReady } = useWorkspaceContext();
  const wsParam = orgId || 'personal';
  return useQuery({
    queryKey: ['recommendations', user?.id, wsParam],
    queryFn: () => api.get<any[]>(`/api/v1/insights/recommendations?org_id=${wsParam}`),
    enabled: !!user?.id && workspaceReady,
    staleTime: 5 * 60 * 1000,
  });
}

/** Re-generate recommendations from latest assessment data and refresh. */
export function useGenerateRecommendations() {
  const qc = useQueryClient();
  const { orgId } = useWorkspaceContext();
  const wsParam = orgId || 'personal';
  return useMutation({
    mutationFn: () => api.post(`/api/v1/insights/recommendations/generate?org_id=${wsParam}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['recommendations'] });
    },
  });
}

/** Fetch topic mastery for Learning Focus Areas (top subjects by mastery). */
export function useTopicMastery() {
  const { user } = useAuth();
  const { orgId, workspaceReady } = useWorkspaceContext();
  const wsParam = orgId || 'personal';
  return useQuery({
    queryKey: ['topic-mastery', user?.id, wsParam],
    queryFn: () => api.get<any[]>(`/api/v1/assessments/mastery?org_id=${wsParam}`),
    enabled: !!user?.id && workspaceReady,
    staleTime: 5 * 60 * 1000,
  });
}

/** Fetch per-subject aggregate stats: attempt count, average score, best score. */
export function useAssessmentTrends() {
  const { user } = useAuth();
  const { orgId, workspaceReady } = useWorkspaceContext();
  const wsParam = orgId || 'personal';
  return useQuery({
    queryKey: ['assessment-trends', user?.id, wsParam],
    queryFn: () => api.get<any[]>(`/api/v1/assessments/trends?org_id=${wsParam}`),
    enabled: !!user?.id && workspaceReady,
    staleTime: 5 * 60 * 1000,
  });
}

export interface AssessmentSummary {
  summary: string;
  momentum: 'improving' | 'steady' | 'declining' | 'new';
  strengths: { label: string; detail: string }[];
  weak_areas: { label: string; detail: string }[];
  goals: { title: string; type: string; priority: number; subject: string | null; action_href: string }[];
  total_attempts: number;
  overall_avg: number;
  best_score: number;
  cached?: boolean;
}

/** AI-generated coach summary of Assessment Hub usage (cached 30 min server-side). */
export function useAssessmentSummary() {
  const { user } = useAuth();
  const { orgId, workspaceReady } = useWorkspaceContext();
  const wsParam = orgId || 'personal';
  return useQuery({
    queryKey: ['assessment-summary', user?.id, wsParam],
    queryFn: () => api.get<AssessmentSummary>(`/api/v1/insights/assessment-summary?org_id=${wsParam}`),
    enabled: !!user?.id && workspaceReady,
    staleTime: 2 * 60 * 1000,
  });
}

/** Force-refresh the assessment summary (bypass server cache). */
export function useRefreshAssessmentSummary() {
  const qc = useQueryClient();
  const { orgId } = useWorkspaceContext();
  const wsParam = orgId || 'personal';
  return useMutation({
    mutationFn: () => api.get<AssessmentSummary>(`/api/v1/insights/assessment-summary?force_refresh=true&org_id=${wsParam}`),
    onSuccess: (data, _vars, _ctx) => {
      qc.setQueryData(['assessment-summary', undefined], data);
      qc.invalidateQueries({ queryKey: ['assessment-summary'] });
    },
  });
}
