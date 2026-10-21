/**
 * The Performance page's unit report: the mock test report's own model, built over the student's attempts.
 *
 * Reads the same per-attempt detail the other performance figures do, under the same query key, so once those are
 * cached it adds no requests. Only the most recent attempts are fetched; `truncated` says when more matched.
 */
import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import { getAttemptDetail, type ApiAttempt, type AttemptDetailResponse } from '@/lib/userPortalApi';
import { buildPerformanceReport } from '@/lib/performance-report';

const MAX_DETAIL_FETCHES = 25;

export function usePerformanceReport(attempts: ApiAttempt[]) {
  const targets = useMemo(
    () =>
      [...attempts]
        .sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime())
        .slice(0, MAX_DETAIL_FETCHES),
    [attempts],
  );

  const details = useQueries({
    queries: targets.map(h => ({
      queryKey: ['attempt-detail', h.attempt_id],
      queryFn: () => getAttemptDetail(h.attempt_id),
      staleTime: Infinity,
      retry: 1,
    })),
  });

  const isLoading = details.some(d => d.isLoading);
  // A new array every render would rebuild the report each time; this changes only when a fetch settles.
  // Includes which attempts are in scope, so changing the date range or exam can never reuse an older report.
  const signature = targets.map((t, i) => `${t.attempt_id}:${details[i]?.status}:${details[i]?.dataUpdatedAt}`).join('|');

  const report = useMemo(() => {
    const loaded = details.map(d => d.data).filter((d): d is AttemptDetailResponse => !!d?.questions?.length);
    return buildPerformanceReport(loaded);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  return { ...report, isLoading, truncated: attempts.length > targets.length, attemptCount: targets.length };
}
