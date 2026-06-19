import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useWorkspaceContext } from '@/contexts/WorkspaceContext';

interface PointCost {
  action: string;
  cost: number;
  description: string | null;
}

/**
 * Org-specific points hook. Fetches org point costs (workspace_type=org)
 * and deducts from the org subscription. Completely separate from
 * the personal usePoints() hook.
 */
export function useOrgPoints() {
  const { subscription, pointsBalance } = useSubscription();
  const { orgId, isOrgContext } = useWorkspaceContext();
  const queryClient = useQueryClient();

  const { data: orgPointCosts = [] } = useQuery({
    queryKey: ['point-costs', 'org'],
    queryFn: () => api.get<PointCost[]>('/api/v1/subscriptions/point-costs?workspace_type=org'),
    enabled: isOrgContext,
  });

  const getOrgPointsCost = useCallback(
    (action: string) => (orgPointCosts.find(p => p.action === action)?.cost ?? 0),
    [orgPointCosts]
  );

  const canAffordOrg = useCallback(
    (action: string) => pointsBalance >= getOrgPointsCost(action),
    [getOrgPointsCost, pointsBalance]
  );

  const deductOrgPoints = useCallback(
    async (action: string) => {
      const result = await api.post<{ new_balance: number }>(
        '/api/v1/subscriptions/deduct-points',
        { action, subscription_id: subscription?.id, org_id: orgId }
      );
      queryClient.invalidateQueries({ queryKey: ['subscription'] });
      return result;
    },
    [subscription?.id, orgId, queryClient]
  );

  return { orgPointCosts, getOrgPointsCost, canAffordOrg, deductOrgPoints, pointsBalance };
}
