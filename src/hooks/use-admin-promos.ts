import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { promosApi, type PromoCreatePayload, type PromoUpdatePayload } from '@/lib/adminApi';
import { toast } from 'sonner';

const QUERY_KEY = 'admin-promos';

export function useAdminPromos(page = 1, limit = 50) {
  return useQuery({
    queryKey: [QUERY_KEY, page, limit],
    queryFn: () => promosApi.list(page, limit),
    staleTime: 60 * 1000,
  });
}

export function useAdminPromoActions() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: [QUERY_KEY] });

  const create = useMutation({
    mutationFn: (payload: PromoCreatePayload) => promosApi.create(payload),
    onSuccess: (data) => {
      toast.success(`Promo "${data.code_string}" created`);
      invalidate();
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to create promo code');
    },
  });

  const update = useMutation({
    mutationFn: ({ codeId, payload }: { codeId: string; payload: PromoUpdatePayload }) =>
      promosApi.update(codeId, payload),
    onSuccess: (data) => {
      toast.success(`Promo "${data.code_string}" updated`);
      invalidate();
    },
  });

  const deletePr = useMutation({
    mutationFn: (codeId: string) => promosApi.delete(codeId),
    onSuccess: () => {
      toast.success('Promo code deleted');
      invalidate();
    },
  });

  const pause = useMutation({
    mutationFn: (codeId: string) => promosApi.pause(codeId),
    onSuccess: () => {
      toast.success('Promo code paused');
      invalidate();
    },
  });

  const resume = useMutation({
    mutationFn: (codeId: string) => promosApi.resume(codeId),
    onSuccess: () => {
      toast.success('Promo code resumed');
      invalidate();
    },
  });

  return { create, update, delete: deletePr, pause, resume };
}
