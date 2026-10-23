import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useEvalAssessments, useEvalInvitationStats } from '@/hooks/use-eval-assessments';
import { buildUserHistory, type EvalHistoryUser } from '@/lib/eval-user-history';

/** Assessment details read at once: one request each. */
const MAX_DETAILS = 120;
/** If the counts say no assessment has anyone (or could not be read), the newest few are read anyway. */
const FALLBACK_DETAILS = 25;

/**
 * Who has attended what, across the Evaluation Hub's assessments.
 *
 * The server's user history does not count attempts made on assessments, so this reads them where they are: each
 * assessment's detail, which lists its invitations, their attempts, and the attempts portal users made directly.
 * It reads the ones the bulk counts say someone attended (the same detail the Reports tab uses, shared in the query
 * cache), and `truncated` says when there were more than are read, so the figures are for the newest.
 *
 * A per-user endpoint on the server would replace this (see EVAL_USER_HISTORY.md).
 */
export function useEvalUserHistory() {
  const { data: assessments, isLoading: listLoading } = useEvalAssessments();
  const list = useMemo(
    () => [...((assessments ?? []) as any[])].sort((x, y) => +new Date(y.created_at ?? 0) - +new Date(x.created_at ?? 0)),
    [assessments],
  );
  const ids = useMemo(() => list.map(a => a.id), [list]);
  const { data: stats, isLoading: statsLoading } = useEvalInvitationStats(ids);

  const involved = useMemo(() => {
    const some = list.filter(a => ((stats as any)?.[a.id]?.invited ?? 0) > 0 || ((stats as any)?.[a.id]?.submitted ?? 0) > 0);
    // Counts that say nobody attended anything are as likely to be counts that failed as to be true: look anyway.
    return some.length > 0 || !stats ? some : list.slice(0, FALLBACK_DETAILS);
  }, [list, stats]);
  const targets = useMemo(() => involved.slice(0, MAX_DETAILS), [involved]);

  const details = useQueries({
    queries: targets.map(a => ({
      queryKey: ['eval-assessment-detail', a.id],
      queryFn: () => api.get<any>(`/api/v1/evaluation/assessments/${a.id}`),
      staleTime: 60_000,
      retry: 1,
    })),
  });

  const isLoading = listLoading || statsLoading || details.some(d => d.isLoading);
  // Changes only when a request settles, so the users are not rebuilt on every render.
  const signature = details.map((d, i) => `${targets[i]?.id}:${d.status}:${d.dataUpdatedAt}`).join('|');

  const users = useMemo<EvalHistoryUser[]>(
    () => buildUserHistory(targets.map((assessment, i) => ({ assessment, detail: details[i]?.data }))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [signature],
  );

  return { users, isLoading, truncated: involved.length > targets.length, readCount: targets.length };
}
