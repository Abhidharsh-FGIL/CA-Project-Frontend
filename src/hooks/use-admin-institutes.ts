import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { adminInstitutesApi, type InstituteInput, type InstituteUpdate } from '@/lib/instituteApi';

const KEY = 'admin-institutes';

/** One page of institutes, the previous page kept on screen while the next loads. */
export function useAdminInstitutes(params: { search?: string; page?: number; limit?: number }) {
  return useQuery({
    queryKey: [KEY, 'list', params],
    queryFn: () => adminInstitutesApi.list(params),
    staleTime: 30 * 1000,
    placeholderData: keepPreviousData,
  });
}

export function useAdminInstitute(id: string | undefined) {
  return useQuery({
    queryKey: [KEY, 'one', id],
    queryFn: () => adminInstitutesApi.get(id as string),
    enabled: !!id,
    staleTime: 30 * 1000,
    retry: (count, error) => (error as { status?: number })?.status !== 404 && count < 2,
  });
}

export function useAdminInstituteActions() {
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: [KEY] });

  const create = useMutation({
    mutationFn: (body: InstituteInput) => adminInstitutesApi.create(body),
    onSuccess: inst => {
      toast.success(`${inst.name} added`);
      refresh();
    },
  });
  const update = useMutation({
    mutationFn: ({ id, body }: { id: string; body: InstituteUpdate }) => adminInstitutesApi.update(id, body),
    onSuccess: () => {
      toast.success('Institute updated');
      refresh();
    },
  });
  const resetPassword = useMutation({
    mutationFn: ({ id, password }: { id: string; password: string }) => adminInstitutesApi.resetPassword(id, password),
    onSuccess: () => toast.success('Password changed'),
  });
  return { create, update, resetPassword };
}
