import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { paymentsApi, type ListPaymentsParams } from '@/lib/adminApi';
import { toast } from 'sonner';

const TXN_KEY = 'admin-payments';
const ANALYTICS_KEY = 'admin-payments-analytics';

export function useAdminPayments(params: ListPaymentsParams = {}) {
  return useQuery({
    queryKey: [TXN_KEY, params],
    queryFn: () => paymentsApi.list(params),
    staleTime: 60 * 1000,
  });
}

export function useAdminPaymentAnalytics(date_from?: string, date_to?: string) {
  return useQuery({
    queryKey: [ANALYTICS_KEY, date_from, date_to],
    queryFn: () => paymentsApi.getAnalytics(date_from, date_to),
    staleTime: 2 * 60 * 1000,
  });
}

export function useAdminPaymentActions() {
  const qc = useQueryClient();

  const refund = useMutation({
    mutationFn: (txnId: string) => paymentsApi.refund(txnId),
    onSuccess: () => {
      toast.success('Transaction refunded');
      qc.invalidateQueries({ queryKey: [TXN_KEY] });
      qc.invalidateQueries({ queryKey: [ANALYTICS_KEY] });
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Cannot refund transaction');
    },
  });

  return { refund };
}
