/**
 * The syllabus tree (Subject → Unit → Category → Sub-category) for a set of attempts.
 *
 * Reads the same per-attempt detail the other performance figures do, under the same query key, so it adds no
 * requests once those are cached. Only the most recent attempts are fetched; `truncated` says when more matched.
 */
import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import { getAttemptDetail, type ApiAttempt } from '@/lib/userPortalApi';
import { buildPerformanceTree, type AttemptQuestions } from '@/lib/performance-tree';

const MAX_DETAIL_FETCHES = 25;

export function usePerformanceTree(attempts: ApiAttempt[]) {
  // The newest attempts, then oldest-first so a trend reads forward in time.
  const targets = useMemo(
    () =>
      [...attempts]
        .sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime())
        .slice(0, MAX_DETAIL_FETCHES)
        .reverse(),
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
  // A new array each render would rebuild the tree every time; this changes only when a fetch settles.
  const signature = details.map(d => `${d.status}:${d.dataUpdatedAt}`).join('|');

  const tree = useMemo(() => {
    const rows: AttemptQuestions[] = [];
    details.forEach((d, i) => {
      const questions = d.data?.questions;
      if (questions?.length) rows.push({ attemptId: targets[i].attempt_id, questions });
    });
    return buildPerformanceTree(rows);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, targets]);

  return { tree, isLoading, truncated: attempts.length > targets.length, attemptCount: targets.length };
}
