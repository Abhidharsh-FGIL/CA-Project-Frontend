import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { settingsApi } from '@/lib/adminApi';
import { toast } from 'sonner';

const QUERY_KEY = 'admin-settings';

export function useAdminSettings() {
  return useQuery({
    queryKey: [QUERY_KEY],
    queryFn: () => settingsApi.get(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useAdminSettingsActions() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: [QUERY_KEY] });

  const updateProfile = useMutation({
    mutationFn: ({ name, email }: { name?: string; email?: string }) =>
      settingsApi.updateProfile(name, email),
    onSuccess: () => {
      toast.success('Profile updated');
      invalidate();
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to update profile');
    },
  });

  const changePassword = useMutation({
    mutationFn: ({ current_password, new_password }: { current_password: string; new_password: string }) =>
      settingsApi.changePassword(current_password, new_password),
    onSuccess: () => {
      toast.success('Password changed successfully');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to change password');
    },
  });

  const updatePolicy = useMutation({
    mutationFn: (settings: Record<string, unknown>) => settingsApi.updatePolicy(settings),
    onSuccess: () => {
      toast.success('Policy updated');
      invalidate();
    },
  });

  const updateNotifications = useMutation({
    mutationFn: (preferences: Record<string, unknown>) => settingsApi.updateNotifications(preferences),
    onSuccess: () => {
      toast.success('Notification preferences updated');
      invalidate();
    },
  });

  return { updateProfile, changePassword, updatePolicy, updateNotifications };
}
