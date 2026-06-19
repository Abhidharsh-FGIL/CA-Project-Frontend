import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

interface UnreadChatsResponse {
  total: number;
  per_chat: Record<string, number>;
}

export function useUnreadChats() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['chats-unread-count', user?.id],
    queryFn: () => api.get<UnreadChatsResponse>('/api/v1/chats/unread-count'),
    enabled: !!user?.id,
    refetchInterval: 30_000,
    staleTime: 10_000,
  });

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['chats-unread-count'] });
  }, [queryClient]);

  return {
    totalUnread: data?.total ?? 0,
    unreadMap: data?.per_chat ?? {},
    isLoading,
    refresh,
  };
}
