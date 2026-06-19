import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useGamification } from '@/contexts/GamificationContext';
import { useWorkspaceContext } from '@/contexts/WorkspaceContext';

const MESSAGES_LIMIT = 50;

export function useAiChats() {
  const { user } = useAuth();
  const { orgId, workspaceReady } = useWorkspaceContext();
  const wsParam = orgId || 'personal';
  return useQuery({
    queryKey: ['ai-chats', user?.id, wsParam],
    queryFn: () => api.get<any[]>(`/api/v1/ai/chats?org_id=${wsParam}`),
    enabled: !!user?.id && workspaceReady,
    staleTime: 30 * 1000, // 30s — sidebar list is low-churn
  });
}

export function useAiChatMessages(chatId: string | null) {
  return useInfiniteQuery({
    queryKey: ['ai-chat-messages', chatId],
    queryFn: async ({ pageParam }: { pageParam: string | undefined }) => {
      const url = `/api/v1/ai/chats/${chatId}/messages?limit=${MESSAGES_LIMIT}${pageParam ? `&before=${pageParam}` : ''}`;
      return api.get<any[]>(url);
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (firstPage: any[]) => {
      // firstPage is the OLDEST page loaded so far (prepended).
      // If it returned a full page we can go further back.
      return firstPage.length === MESSAGES_LIMIT ? firstPage[0]?.id : undefined;
    },
    enabled: !!chatId,
    staleTime: 5 * 60 * 1000,  // 5 min — history doesn't change while session is open
    gcTime: 10 * 60 * 1000,    // Keep in cache for 10 min after unmount
    refetchOnWindowFocus: false,
  });
}

/** Fetch just the image_base64 for one message's infographic — called lazily. */
export function useInfographicImage(chatId: string | null, msgId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ['infographic-image', chatId, msgId],
    queryFn: () => api.get<{ image_base64: string }>(`/api/v1/ai/chats/${chatId}/messages/${msgId}/infographic-image`),
    enabled: !!chatId && !!msgId && enabled,
    staleTime: Infinity, // Images never change — cache permanently per session
    gcTime: 30 * 60 * 1000,
  });
}

export function useCreateChat() {
  const qc = useQueryClient();
  const { orgId } = useWorkspaceContext();
  return useMutation({
    mutationFn: (title?: string) =>
      api.post<any>('/api/v1/ai/chats', { title: title || 'New Chat', scope: 'personal', org_id: orgId || null }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ai-chats'] }),
  });
}

export function useSendMessage() {
  const qc = useQueryClient();
  const { recordActivity } = useGamification();
  return useMutation({
    mutationFn: ({ chatId, content }: { chatId: string; content: string; role?: string }) =>
      api.post<any>(`/api/v1/ai/chats/${chatId}/messages`, { message: content }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['ai-chat-messages', vars.chatId] });
      qc.invalidateQueries({ queryKey: ['subscription'] });
      qc.invalidateQueries({ queryKey: ['gamification'] });
      recordActivity();
    },
  });
}

export function useDeleteChat() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (chatId: string) => api.delete(`/api/v1/ai/chats/${chatId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ai-chats'] }),
  });
}

export function useRenameChat() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ chatId, title }: { chatId: string; title: string }) =>
      api.patch(`/api/v1/ai/chats/${chatId}`, { title }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ai-chats'] }),
  });
}
