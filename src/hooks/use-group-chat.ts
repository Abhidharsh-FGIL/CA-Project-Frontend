import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface GroupMessage {
  id: string;
  chatId: string;
  userId: string;
  message: string;
  attachments: { name: string; url: string; type: string }[];
  createdAt: string;
  senderName?: string;
  senderAvatar?: string;
}

export function useGroupChat(chatId: string | null) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const hasFetched = useRef(false);

  const fetchMessages = useCallback(async (showLoading = false) => {
    if (!chatId) return;
    if (showLoading) setIsLoading(true);
    try {
      const data = await api.get<any[]>(`/api/v1/chats/${chatId}/messages`);
      setMessages(
        (data || []).map((m: any) => ({
          id: m.id,
          chatId: m.chat_id,
          userId: m.user_id,
          message: m.content || m.message || '',
          attachments: ((m.attachments || m.attachments_json || []) as any[]).map((att: any) => ({
            name: att.name || att.original_name || 'file',
            url: att.url || '',
            type: att.type || att.content_type || '',
          })),
          createdAt: m.created_at || '',
          senderName: m.sender_name || 'Unknown',
          senderAvatar: m.sender_avatar || undefined,
        }))
      );
    } catch (err) {
      console.error('Error fetching messages:', err);
    } finally {
      if (showLoading) setIsLoading(false);
    }
  }, [chatId]);

  // Initial load + polling every 15 seconds, paused when tab is hidden
  useEffect(() => {
    if (!chatId) return;
    hasFetched.current = false;

    // Initial fetch with loading indicator
    fetchMessages(true);
    hasFetched.current = true;

    let interval: ReturnType<typeof setInterval> | null = null;

    const startPolling = () => {
      if (!interval) {
        interval = setInterval(() => fetchMessages(false), 15000);
      }
    };

    const stopPolling = () => {
      if (interval) {
        clearInterval(interval);
        interval = null;
      }
    };

    const handleVisibility = () => {
      if (document.hidden) {
        stopPolling();
      } else {
        fetchMessages(false); // Refresh when user comes back
        startPolling();
      }
    };

    startPolling();
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      stopPolling();
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [chatId, fetchMessages]);

  const sendMessage = useCallback(
    async (text: string, attachments?: File[]) => {
      if (!chatId || !user?.id) return;
      if (!text.trim() && (!attachments || attachments.length === 0)) return;

      try {
        if (attachments && attachments.length > 0) {
          // Send each attachment as a message with the backend's combined endpoint
          for (let i = 0; i < attachments.length; i++) {
            const fd = new FormData();
            fd.append('file', attachments[i]);
            // Include text content only with the first attachment
            fd.append('content', i === 0 ? text.trim() : '');
            await api.upload(`/api/v1/chats/${chatId}/messages/with-attachment`, fd);
          }
        } else {
          await api.post(`/api/v1/chats/${chatId}/messages`, {
            content: text.trim(),
          });
        }
        await fetchMessages(false);
      } catch {
        toast.error('Failed to send message');
      }
    },
    [chatId, user?.id, fetchMessages]
  );

  const markAsRead = useCallback(async () => {
    if (!chatId || !user?.id) return;
    try {
      await api.post(`/api/v1/chats/${chatId}/read`);
    } catch {
      // silent
    }
  }, [chatId, user?.id]);

  return { messages, isLoading, sendMessage, markAsRead };
}
