import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usersApi, type ListUsersParams, type SubscriptionTier } from '@/lib/adminApi';
import { toast } from 'sonner';

const QUERY_KEY = 'admin-users';

export function useAdminUsers(params: ListUsersParams = {}) {
  return useQuery({
    queryKey: [QUERY_KEY, params],
    queryFn: () => usersApi.list(params),
    staleTime: 60 * 1000,
  });
}

export function useAdminUserActions() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: [QUERY_KEY] });

  const lock = useMutation({
    mutationFn: (userId: string) => usersApi.lock(userId),
    onSuccess: (_, userId) => {
      toast.success('User locked');
      invalidate();
    },
  });

  const unlock = useMutation({
    mutationFn: (userId: string) => usersApi.unlock(userId),
    onSuccess: () => {
      toast.success('User unlocked');
      invalidate();
    },
  });

  const suspend = useMutation({
    mutationFn: ({ userId, reason }: { userId: string; reason?: string }) =>
      usersApi.suspend(userId, reason),
    onSuccess: () => {
      toast.success('User suspended');
      invalidate();
    },
  });

  const reactivate = useMutation({
    mutationFn: (userId: string) => usersApi.reactivate(userId),
    onSuccess: () => {
      toast.success('User reactivated');
      invalidate();
    },
  });

  const updateSubscription = useMutation({
    mutationFn: ({ userId, tier, expiry_days }: { userId: string; tier: SubscriptionTier; expiry_days?: number }) =>
      usersApi.updateSubscription(userId, tier, expiry_days),
    onSuccess: () => {
      toast.success('Subscription updated');
      invalidate();
    },
  });

  return { lock, unlock, suspend, reactivate, updateSubscription };
}
