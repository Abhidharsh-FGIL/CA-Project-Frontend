import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useSubscription } from '@/contexts/SubscriptionContext';

interface PointCost {
  action: string;
  cost: number;
  description: string | null;
}

export function usePoints() {
  const { subscription, pointsBalance } = useSubscription();
  const queryClient = useQueryClient();

  const { data: pointCosts = [] } = useQuery({
    queryKey: ['point-costs'],
    queryFn: () => api.get<PointCost[]>('/api/v1/subscriptions/point-costs'),
  });

  const getPointsCost = useCallback(
    (action: string) => (pointCosts.find(p => p.action === action)?.cost ?? 0),
    [pointCosts]
  );

  const canAfford = useCallback(
    (action: string) => pointsBalance >= getPointsCost(action),
    [getPointsCost, pointsBalance]
  );

  const deductPoints = useCallback(
    async (action: string) => {
      const result = await api.post<{ new_balance: number }>(
        '/api/v1/subscriptions/deduct-points',
        { action, subscription_id: subscription?.id }
      );
      queryClient.invalidateQueries({ queryKey: ['subscription'] });
      return result;
    },
    [subscription?.id, queryClient]
  );

  return { pointCosts, getPointsCost, canAfford, deductPoints, pointsBalance };
}
