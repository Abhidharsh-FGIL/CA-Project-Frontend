import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { historyApi, type HistoryListParams, type HistoryModeFilter } from '@/lib/adminHistoryApi';

/** Who has taken tests — one page of the list, the previous page kept on screen while the next loads. */
export function useAdminHistoryUsers(params: HistoryListParams) {
  return useQuery({
    queryKey: ['admin-history', 'users', params],
    queryFn: () => historyApi.list(params),
    staleTime: 30 * 1000,
    placeholderData: keepPreviousData,
  });
}

/** One person's attempts and promo uses, narrowed to mock or practice when asked. */
export function useAdminHistoryUser(userId: string | undefined, mode: HistoryModeFilter) {
  return useQuery({
    queryKey: ['admin-history', 'user', userId, mode],
    queryFn: () => historyApi.get(userId as string, mode),
    enabled: !!userId,
    staleTime: 30 * 1000,
    placeholderData: keepPreviousData,
    // A 404 ("User not found") will not change by asking again.
    retry: (count, error) => (error as { status?: number })?.status !== 404 && count < 2,
  });
}
