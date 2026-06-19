import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface ChatSettings {
  id: string;
  chat_id: string;
  student_mode: boolean;
  difficulty: string;
  personality: string;
  content_length: string;
  mind_map: boolean;
  infographic: boolean;
  video_refs: boolean;
  practice: boolean;
  followup: boolean;
  next_steps: boolean;
  explain_3ways: boolean;
  created_at: string;
}

export const defaultSettings: Omit<ChatSettings, 'id' | 'chat_id' | 'created_at'> = {
  student_mode: true,
  difficulty: 'medium',
  personality: 'mentor',
  content_length: 'summary',
  mind_map: false,
  infographic: false,
  video_refs: false,
  practice: false,
  followup: false,
  next_steps: false,
  explain_3ways: false,
};

export function useChatSettings(chatId: string | null) {
  return useQuery({
    queryKey: ['chat-settings', chatId],
    queryFn: () => api.get<ChatSettings>(`/api/v1/ai/chats/${chatId}/settings`),
    enabled: !!chatId,
    // Keep cached data fresh for 5 minutes — prevents background refetches
    // from overwriting optimistic cache updates made by upsertSettings.
    staleTime: 5 * 60 * 1000,
  });
}

export function useUpsertChatSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ chatId, updates }: {
      chatId: string;
      updates: Partial<Omit<ChatSettings, 'id' | 'chat_id' | 'created_at'>>;
    }) =>
      api.patch<ChatSettings>(`/api/v1/ai/chats/${chatId}/settings`, updates),
    onSuccess: (data, vars) =>
      qc.setQueryData(['chat-settings', vars.chatId], data),
  });
}

export function useEnsureChatSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (chatId: string) =>
      api.patch<ChatSettings>(`/api/v1/ai/chats/${chatId}/settings`, defaultSettings),
    onSuccess: (data, chatId) =>
      qc.setQueryData(['chat-settings', chatId], data),
  });
}
