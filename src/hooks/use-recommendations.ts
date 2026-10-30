import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useUserPortal } from '@/contexts/UserPortalContext';
import { recommendationsApi, type RecommendationFeedback, type Recommendations } from '@/lib/recommendationsApi';

/**
 * The picks are cached per person. The page's cache outlives a sign-out, so a key without the person would hand the
 * last user's picks to whoever signs in next on the same tab (until the cache went stale) — and open the coach's
 * popup with them.
 */
const keyFor = (userId: string | null | undefined, exam: string | null | undefined, stage: string | null | undefined) =>
  ['recommendations', userId ?? null, exam, stage] as const;

/**
 * The aspirant's "what to practise next" for one exam stage.
 *
 * While the backend is still working the picks out after a test (`computing`), it asks again every few seconds.
 * A failure is not shown as an error: the dashboard simply goes without the section.
 */
export function useRecommendations(exam: string | null | undefined, stage: string | null | undefined) {
  const { user } = useUserPortal();
  const userId = user?.user_id;
  return useQuery<Recommendations>({
    queryKey: keyFor(userId, exam, stage),
    queryFn: () => recommendationsApi.get(exam!, stage!),
    enabled: !!exam && !!stage && !!userId,
    staleTime: 60_000,
    retry: 1,
    refetchInterval: q => (q.state.data?.status === 'computing' ? 8_000 : false),
  });
}

/** Tell the backend what the aspirant did with a pick; a dismissed one is replaced by the next. */
export function useRecommendationFeedback(exam: string | null | undefined, stage: string | null | undefined) {
  const qc = useQueryClient();
  const { user } = useUserPortal();
  const userId = user?.user_id;
  return useMutation({
    mutationFn: ({ recId, action }: { recId: string; action: RecommendationFeedback }) =>
      recommendationsApi.feedback(exam!, stage!, recId, action),
    onSuccess: (res, { action }) => {
      if (action === 'started') return;
      // The answer carries the picks with the next one in the dismissed one's place.
      if (res?.recommendations) qc.setQueryData(keyFor(userId, exam, stage), res.recommendations);
      else void qc.invalidateQueries({ queryKey: keyFor(userId, exam, stage) });
    },
  });
}
