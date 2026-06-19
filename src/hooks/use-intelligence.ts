import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspaceContext } from '@/contexts/WorkspaceContext';

type IntelligenceAction =
  | 'dashboard_snapshot'
  | 'engagement_analytics'
  | 'recommendation_score'
  | 'career_compatibility'
  | 'predictive_insights';

export function useIntelligence(action: IntelligenceAction, enabled = true) {
  const { user } = useAuth();
  const { orgId, workspaceReady } = useWorkspaceContext();
  const wsParam = orgId || 'personal';
  return useQuery({
    queryKey: ['intelligence', action, user?.id, wsParam],
    queryFn: () => api.post<any>(`/api/v1/insights/intelligence?org_id=${wsParam}`, { action }),
    enabled: !!user?.id && enabled && workspaceReady,
    staleTime: action === 'dashboard_snapshot' ? 5 * 60 * 1000 : 30 * 60 * 1000,
    retry: 1,
  });
}

export const useDashboardSnapshot = () => useIntelligence('dashboard_snapshot');
export const useEngagementAnalytics = (enabled = true) => useIntelligence('engagement_analytics', enabled);
export const useRecommendationScore = (enabled = true) => useIntelligence('recommendation_score', enabled);
export const useCareerCompatibility = (enabled = true) => useIntelligence('career_compatibility', enabled);
export const usePredictiveInsights = (enabled = true) => useIntelligence('predictive_insights', enabled);
