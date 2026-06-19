import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useGamification } from '@/contexts/GamificationContext';
import { useWorkspaceContext } from '@/contexts/WorkspaceContext';

export function useVaultChats() {
  const { user } = useAuth();
  const { orgId, workspaceReady } = useWorkspaceContext();
  const wsParam = orgId || 'personal';
  return useQuery({
    queryKey: ['vault-chats', user?.id, wsParam],
    queryFn: () => api.get<any[]>(`/api/v1/ai/chats?scope=vault&org_id=${wsParam}`),
    enabled: !!user?.id && workspaceReady,
  });
}

export function useCreateVaultChat() {
  const qc = useQueryClient();
  const { orgId } = useWorkspaceContext();
  return useMutation({
    mutationFn: (title?: string) =>
      api.post<any>('/api/v1/ai/chats', { title: title || 'Vault Chat', scope: 'vault', org_id: orgId || null }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vault-chats'] }),
  });
}

export function useVaultChatMessages(chatId: string | null) {
  return useQuery({
    queryKey: ['vault-chat-messages', chatId],
    queryFn: () => api.get<any[]>(`/api/v1/ai/chats/${chatId}/messages`),
    enabled: !!chatId,
  });
}

export function useSendVaultMessage() {
  const qc = useQueryClient();
  const { recordActivity } = useGamification();
  return useMutation({
    mutationFn: ({ chatId, content }: { chatId: string; content: string; role?: string }) =>
      api.post<any>(`/api/v1/ai/chats/${chatId}/messages`, { message: content }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['vault-chat-messages', vars.chatId] });
      qc.invalidateQueries({ queryKey: ['subscription'] });
      qc.invalidateQueries({ queryKey: ['gamification'] });
      recordActivity();
    },
  });
}

export function useDeleteVaultChat() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (chatId: string) => api.delete(`/api/v1/ai/chats/${chatId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vault-chats'] }),
  });
}
