import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { promosApi, type PromoCreatePayload, type PromoUpdatePayload } from '@/lib/adminApi';
import { toast } from 'sonner';

const QUERY_KEY = 'admin-promos';

/** Two limit lists are the same when they hold the same values; none and empty both mean "no limit". */
function sameList(a: string[] | null | undefined, b: string[] | null | undefined): boolean {
  const x = [...(a ?? [])].sort();
  const y = [...(b ?? [])].sort();
  return x.length === y.length && x.every((v, i) => v === y[i]);
}

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
    onSuccess: (data, { payload }) => {
      // A 200 is not proof the server kept what was sent: an edit endpoint that
      // ignores a field answers exactly as one that stored it. The plan and cycle
      // limits are the newest fields, so read them back and say if they did not take.
      const stuck = (['applies_to_tiers', 'applies_to_billing'] as const).filter(
        k => k in payload && !sameList(payload[k], data[k]),
      );
      if (stuck.length > 0) {
        toast.warning(
          `Promo "${data.code_string}" was saved, but the server kept its previous plan or billing limits. Check the card.`,
        );
      } else {
        toast.success(`Promo "${data.code_string}" updated`);
      }
      invalidate();
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to update promo code');
    },
  });

  const deletePr = useMutation({
    mutationFn: (codeId: string) => promosApi.delete(codeId),
    onSuccess: () => {
      toast.success('Promo code deleted');
      invalidate();
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to delete promo code');
    },
  });

  const pause = useMutation({
    mutationFn: (codeId: string) => promosApi.pause(codeId),
    onSuccess: () => {
      toast.success('Promo code paused');
      invalidate();
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to pause promo code');
    },
  });

  const resume = useMutation({
    mutationFn: (codeId: string) => promosApi.resume(codeId),
    onSuccess: () => {
      toast.success('Promo code resumed');
      invalidate();
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to resume promo code');
    },
  });

  return { create, update, delete: deletePr, pause, resume };
}
