import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { plansApi, type PlanName, type PlanUpdatePayload } from '@/lib/adminApi';
import { toast } from 'sonner';

const QUERY_KEY = 'admin-plans';

export function useAdminPlans() {
  return useQuery({
    queryKey: [QUERY_KEY],
    queryFn: () => plansApi.list(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useAdminPlanActions() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: [QUERY_KEY] });

  const update = useMutation({
    mutationFn: ({ tier, payload }: { tier: PlanName; payload: PlanUpdatePayload }) =>
      plansApi.update(tier, payload),
    onSuccess: (data) => {
      toast.success(`${data.name} plan updated`);
      invalidate();
    },
  });

  const toggleActive = useMutation({
    mutationFn: (tier: PlanName) => plansApi.toggleActive(tier),
    onSuccess: (data) => {
      toast.success(`${data.name} plan ${data.active ? 'activated' : 'deactivated'}`);
      invalidate();
    },
  });

  return { update, toggleActive };
}
