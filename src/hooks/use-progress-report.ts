/**
 * Loads the attempt window and builds the Progress Report model.
 *
 * The report needs question-level detail for every attempt it compares, and the
 * API serves that one attempt at a time — so this fans out a bounded set of
 * requests and hands `buildProgressReport` whatever came back. Attempts whose
 * detail is missing still appear in the journey with their headline score; the
 * model counts them in `dataQuality.undetailedAttempts` and says so on screen.
 *
 * A single `GET /api/v1/user/progress/` would replace the fan-out entirely; until
 * it exists this is the honest shape of the cost.
 */
import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import { getAttemptDetail, type AttemptDetailResponse, type ApiAttempt } from '@/lib/userPortalApi';
import { buildProgressReport, type ProgressConfig, type ProgressReportModel } from '@/lib/progress-report';
import { useGroupMatcher, type GroupKey } from '@/hooks/use-progress-trend';

/**
 * How many attempts the window reaches back over.
 *
 * Each one is a request, so this is a deliberate ceiling rather than a data
 * limit — a long history would otherwise open the page with thirty round trips.
 */
export const PROGRESS_WINDOW = 10;

interface Args {
  /** Submitted attempts, any order. */
  attempts: ApiAttempt[];
  /**
   * Scope the window to one exam.
   *
   * A progress report compares like with like — mixing a Group 4 paper with a
   * GAT-B one produces a trajectory that describes neither (§2: "all valid
   * attempts in the selected exam/test series"). Attempts carry no group id, so
   * membership is resolved against the exam's own test catalog.
   *
   * Omit it, or pass 'all', to compare across everything.
   */
  groupId?: GroupKey | null;
  config?: Partial<ProgressConfig>;
  enabled?: boolean;
}

export function useProgressReport({ attempts, groupId, config, enabled = true }: Args): {
  model: ProgressReportModel | null;
  isLoading: boolean;
  loaded: number;
  total: number;
  /** How many attempts the exam filter excluded, so the UI can say so. */
  excluded: number;
} {
  const scope: GroupKey = groupId ?? 'all';
  const { matchesGroup, isLoading: matcherLoading } = useGroupMatcher(scope);

  const submitted = useMemo(
    () => attempts.filter(a => a.status !== 'in_progress' && a.percentage != null),
    [attempts],
  );

  /** Newest-first from the API; take the most recent window, then read forward. */
  const window = useMemo(() => {
    const inScope = scope === 'all' ? submitted : submitted.filter(a => matchesGroup(a));
    return [...inScope]
      .sort((x, y) => +new Date(y.start_time) - +new Date(x.start_time))
      .slice(0, PROGRESS_WINDOW)
      .reverse();
  }, [submitted, scope, matchesGroup]);

  const excluded = scope === 'all' ? 0 : submitted.length - submitted.filter(a => matchesGroup(a)).length;

  const results = useQueries({
    queries: window.map(a => ({
      queryKey: ['attempt-detail', a.attempt_id],
      queryFn: () => getAttemptDetail(a.attempt_id),
      enabled,
      // A submitted attempt's responses never change, so this is cached for good
      // and shared with the This Attempt report's own detail fetches.
      staleTime: Infinity,
      retry: 1,
    })),
  });

  const details = useMemo(() => {
    const map = new Map<string, AttemptDetailResponse>();
    results.forEach((r, i) => {
      if (r.data) map.set(window[i].attempt_id, r.data);
    });
    return map;
  }, [results, window]);

  // The catalog fetch that resolves membership counts as loading too, otherwise
  // the report renders an unscoped window for a moment before narrowing.
  const isLoading = enabled && (matcherLoading || results.some(r => r.isLoading));
  const loaded = results.filter(r => r.data).length;

  const model = useMemo(
    () => (window.length === 0 ? null : buildProgressReport(window, details, config)),
    [window, details, config],
  );

  return { model, isLoading, loaded, total: window.length, excluded };
}
