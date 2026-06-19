import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useWorkspaceContext } from '@/contexts/WorkspaceContext';

export interface AppNotification {
  id: string;
  notification_type: string;
  category: 'personalized' | 'system';
  title: string;
  body: string;
  data_json?: Record<string, any> | null;
  icon?: string | null;
  priority: 'low' | 'normal' | 'high';
  is_read: boolean;
  created_at: string;
}

interface NotificationListResponse {
  total: number;
  unread_count: number;
  items: AppNotification[];
}

interface UnreadCountResponse {
  count: number;
}

export function useNotifications(enabled = true) {
  const queryClient = useQueryClient();
  const { orgId } = useWorkspaceContext();
  const orgParam = orgId ? `org_id=${orgId}` : '';

  const buildUrl = (base: string, extra?: string) => {
    const parts = [orgParam, extra].filter(Boolean).join('&');
    return parts ? `${base}?${parts}` : base;
  };

  // Lightweight poll for unread count (every 30s)
  const { data: unreadData } = useQuery({
    queryKey: ['notifications-unread-count', orgId],
    queryFn: () => api.get<UnreadCountResponse>(buildUrl('/api/v1/notifications/unread-count')),
    refetchInterval: 30_000,
    enabled,
  });

  // Full notification list (fetched on demand when popover opens)
  const {
    data: listData,
    isLoading,
    refetch: refetchList,
  } = useQuery({
    queryKey: ['notifications-list', orgId],
    queryFn: () => api.get<NotificationListResponse>(buildUrl('/api/v1/notifications', 'limit=30')),
    enabled: false, // manual fetch only
  });

  // Mark single as read
  const markRead = useMutation({
    mutationFn: (id: string) => api.patch(`/api/v1/notifications/${id}/read`),
    onSuccess: (_data, id) => {
      // Optimistically mark the single notification as read in the cache
      queryClient.setQueryData<NotificationListResponse | undefined>(
        ['notifications-list', orgId],
        (old) => old ? {
          ...old,
          unread_count: Math.max(0, old.unread_count - 1),
          items: old.items.map(n => n.id === id ? { ...n, is_read: true } : n),
        } : old,
      );
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-list'] });
    },
  });

  // Mark all as read
  const markAllRead = useMutation({
    mutationFn: () => api.post(buildUrl('/api/v1/notifications/mark-all-read')),
    onSuccess: () => {
      // Optimistically update the cached list so blue dots disappear immediately
      queryClient.setQueryData<NotificationListResponse | undefined>(
        ['notifications-list', orgId],
        (old) => old ? { ...old, unread_count: 0, items: old.items.map(n => ({ ...n, is_read: true })) } : old,
      );
      queryClient.setQueryData<UnreadCountResponse | undefined>(
        ['notifications-unread-count', orgId],
        () => ({ count: 0 }),
      );
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-list'] });
    },
  });

  // Dismiss
  const dismiss = useMutation({
    mutationFn: (id: string) => api.delete(`/api/v1/notifications/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-list'] });
    },
  });

  return {
    unreadCount: unreadData?.count ?? 0,
    notifications: listData?.items ?? [],
    total: listData?.total ?? 0,
    isLoading,
    refetchList,
    markRead: markRead.mutate,
    markAllRead: markAllRead.mutate,
    dismiss: dismiss.mutate,
  };
}
