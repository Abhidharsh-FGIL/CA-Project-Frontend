import { useQuery } from '@tanstack/react-query';
import { listMyPromotional } from '@/lib/promotionalApi';

/** The student's promotional tests (upcoming, live, and recently ended ones they took) — for the popup and the dashboard. */
export function useMyPromotional(enabled = true) {
  return useQuery({
    queryKey: ['promotional', 'list'],
    queryFn: listMyPromotional,
    enabled,
    staleTime: 60 * 1000,
    // A server without the endpoint yet answers 404: nothing to show, and nothing to retry.
    retry: false,
  });
}
