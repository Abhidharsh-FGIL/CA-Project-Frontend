import { useQuery } from '@tanstack/react-query';
import { auditApi, type ListAuditParams } from '@/lib/adminApi';

const QUERY_KEY = 'admin-audit-log';

export function useAdminAuditLog(params: ListAuditParams = {}) {
  return useQuery({
    queryKey: [QUERY_KEY, params],
    queryFn: () => auditApi.list(params),
    staleTime: 30 * 1000,
  });
}
