import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspaceContext } from '@/contexts/WorkspaceContext';

export function useTopicMastery() {
  const { user } = useAuth();
  const { orgId, workspaceReady } = useWorkspaceContext();
  const wsParam = orgId || 'personal';
  return useQuery({
    queryKey: ['topic-mastery', user?.id, wsParam],
    queryFn: () => api.get<any[]>(`/api/v1/assessments/mastery?org_id=${wsParam}`),
    enabled: !!user?.id && workspaceReady,
  });
}

export function useUpsertMastery() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (mastery: {
      subject: string;
      topic: string;
      mastery_level: number;
      total_attempts: number;
      correct_count: number;
    }) => api.post<any>('/api/v1/assessments/mastery', mastery),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['topic-mastery'] }),
  });
}
