import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { attemptsReportApi, dateRangeBackwards, type AttemptReportFilters } from '@/lib/adminReportsApi';

/**
 * One page of the attempts report. The previous page stays on screen while the next loads. A date range running
 * backwards is not asked for: no attempt can match it.
 */
export function useAdminAttemptsReport(filters: AttemptReportFilters, page: number, limit: number) {
  return useQuery({
    queryKey: ['admin-attempts-report', filters, page, limit],
    queryFn: () => attemptsReportApi.list(filters, page, limit),
    enabled: !dateRangeBackwards(filters),
    staleTime: 30 * 1000,
    placeholderData: keepPreviousData,
  });
}
