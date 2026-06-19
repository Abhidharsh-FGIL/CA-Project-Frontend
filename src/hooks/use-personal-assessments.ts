import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspaceContext } from '@/contexts/WorkspaceContext';

export function usePersonalHistory(limit = 20) {
  const { user } = useAuth();
  const { orgId, workspaceReady } = useWorkspaceContext();
  const wsParam = orgId || 'personal';
  return useQuery({
    queryKey: ['personal-assessment-history', user?.id, limit, wsParam],
    queryFn: () => api.get<any[]>(`/api/v1/assessments/history?limit=${limit}&org_id=${wsParam}`),
    enabled: !!user?.id && workspaceReady,
  });
}

export function usePersonalTrends(subject?: string) {
  const { user } = useAuth();
  const { orgId, workspaceReady } = useWorkspaceContext();
  const wsParam = orgId || 'personal';
  return useQuery({
    queryKey: ['personal-trends', user?.id, subject, wsParam],
    queryFn: () => {
      const params = new URLSearchParams({ org_id: wsParam });
      if (subject) params.set('subject', subject);
      return api.get<any[]>(`/api/v1/assessments/trends?${params}`);
    },
    enabled: !!user?.id && workspaceReady,
  });
}

export function usePersonalRecommendations() {
  const { user } = useAuth();
  const { orgId, workspaceReady } = useWorkspaceContext();
  const wsParam = orgId || 'personal';
  return useQuery({
    queryKey: ['personal-recommendations', user?.id, wsParam],
    queryFn: () => api.get<any[]>(`/api/v1/insights/recommendations?org_id=${wsParam}`),
    enabled: !!user?.id && workspaceReady,
  });
}
