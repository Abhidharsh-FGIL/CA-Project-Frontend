import { useQuery } from '@tanstack/react-query';
import { useUserPortal } from '@/contexts/UserPortalContext';
import { getPurchaseHistory } from '@/lib/purchase-history';
import { activePlanPurchase } from '@/lib/plan-allowance';

/**
 * The plan purchase now in force, from the purchase history — with the tests the server has counted against it.
 * Null for a Free plan (nothing was bought) and while it loads. Re-read each time a page that shows a count
 * opens, since the count moves with every test started.
 */
export function useCurrentPlanPurchase() {
  const { user } = useUserPortal();
  const { data } = useQuery({
    queryKey: ['purchase-history', 'plan-current'],
    queryFn: () => getPurchaseHistory({ kind: 'plan', limit: 5 }),
    enabled: !!user && user.subscription_tier !== 'free',
    staleTime: 0,
    refetchOnMount: 'always',
  });
  return activePlanPurchase(data?.items);
}
