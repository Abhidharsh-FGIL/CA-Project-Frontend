import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useUserPortal } from '@/contexts/UserPortalContext';
import {
  adminFeedbackApi,
  feedbackApi,
  feedbackDateRangeBackwards,
  type FeedbackFilters,
  type FeedbackInput,
  type FeedbackStatus,
} from '@/lib/feedbackApi';

/** The student's own feedback, newest first. Per user, so one student never sees another's after a sign-in. */
export function useMyFeedback(page = 1, limit = 20) {
  const userId = useUserPortal().user?.user_id;
  return useQuery({
    queryKey: ['my-feedback', userId, page, limit],
    queryFn: () => feedbackApi.mine(page, limit),
    enabled: !!userId,
    staleTime: 30 * 1000,
    placeholderData: keepPreviousData,
  });
}

export function useSendFeedback() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: FeedbackInput) => feedbackApi.send(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-feedback'] }),
  });
}

/** One page of the admin's feedback list. A date range running backwards is not asked for. */
export function useAdminFeedback(filters: FeedbackFilters, page: number, limit: number) {
  return useQuery({
    queryKey: ['admin-feedback', filters, page, limit],
    queryFn: () => adminFeedbackApi.list(filters, page, limit),
    enabled: !feedbackDateRangeBackwards(filters),
    staleTime: 30 * 1000,
    placeholderData: keepPreviousData,
  });
}

export function useAdminFeedbackSummary(filters: FeedbackFilters) {
  return useQuery({
    queryKey: ['admin-feedback-summary', filters],
    queryFn: () => adminFeedbackApi.summary(filters),
    enabled: !feedbackDateRangeBackwards(filters),
    staleTime: 30 * 1000,
    placeholderData: keepPreviousData,
  });
}

export function useSetFeedbackStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: FeedbackStatus }) => adminFeedbackApi.setStatus(id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-feedback'] });
      qc.invalidateQueries({ queryKey: ['admin-feedback-summary'] });
    },
  });
}
