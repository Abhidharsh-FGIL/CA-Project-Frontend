import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspaceContext } from '@/contexts/WorkspaceContext';

export function useVideoHistory() {
  const { user } = useAuth();
  const { orgId, workspaceReady } = useWorkspaceContext();
  const wsParam = orgId || 'personal';
  return useQuery({
    queryKey: ['video-history', user?.id, wsParam],
    queryFn: () => api.get<any[]>(`/api/v1/video-studio/?org_id=${wsParam}`),
    enabled: !!user?.id && workspaceReady,
  });
}
