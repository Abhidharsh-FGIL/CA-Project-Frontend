import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspaceContext } from '@/contexts/WorkspaceContext';

export function useInsightFeed(category?: string, language?: string) {
  const { user } = useAuth();
  const { orgId, workspaceReady } = useWorkspaceContext();
  const wsParam = orgId || 'personal';
  return useQuery({
    queryKey: ['insight-feed', user?.id, wsParam, category, language],
    queryFn: () => {
      const params = new URLSearchParams();
      if (category && category !== 'all') params.set('category', category);
      if (language) params.set('language', language);
      params.set('org_id', wsParam);
      return api.get<any[]>(`/api/v1/insights/feed?${params}`);
    },
    enabled: !!user?.id && workspaceReady,
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });
}

export function useGenerateFeed() {
  const qc = useQueryClient();
  const { orgId } = useWorkspaceContext();
  const wsParam = orgId || 'personal';
  return useMutation({
    mutationFn: (language: string = 'english') =>
      api.post(`/api/v1/insights/feed/generate?org_id=${wsParam}`, { language }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['insight-feed'] }),
  });
}

export function useToggleBookmark() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, bookmarked }: { id: string; bookmarked: boolean }) =>
      api.patch(`/api/v1/insights/feed/${id}`, { bookmarked: !bookmarked }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['insight-feed'] }),
  });
}

// ── Real-time Google News hooks ──────────────────────────────────────────────

export function useCommonNews(category?: string, language?: string, active = true) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['common-news', user?.id, category, language],
    queryFn: () => {
      const params = new URLSearchParams();
      if (category && category !== 'all') params.set('category', category);
      if (language) params.set('language', language);
      params.set('max_results', '20');
      return api.get<any[]>(`/api/v1/insights/news/common?${params}`);
    },
    enabled: !!user?.id && active,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function usePersonalNews(language?: string, active = true) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['personal-news', user?.id, language],
    queryFn: () => {
      const params = new URLSearchParams();
      if (language) params.set('language', language);
      params.set('max_results', '20');
      return api.get<any[]>(`/api/v1/insights/news/personal?${params}`);
    },
    enabled: !!user?.id && active,
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
