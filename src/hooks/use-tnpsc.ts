import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useUserPortal } from '@/contexts/UserPortalContext';
import {
  applyAttemptHistory,
  effectivePassPercentage,
  getTnpscCatalog,
  getTnpscMockOverview,
  getTnpscPracticeSubjects,
  normaliseLevelGroups,
  type AttemptSummary,
  type TnpscMockOverview,
  type TnpscPracticeSubject,
} from '@/lib/tnpscApi';
import { TNPSC_GROUPS, type TnpscGroup } from '@/config/tnpsc';

const STALE = 5 * 60 * 1000;

/** The TNPSC group → stage catalog (server-driven when available). */
export function useTnpscCatalog() {
  const query = useQuery<TnpscGroup[]>({
    queryKey: ['tnpsc', 'catalog'],
    queryFn: getTnpscCatalog,
    staleTime: STALE,
    placeholderData: TNPSC_GROUPS,
  });
  return { ...query, groups: query.data ?? TNPSC_GROUPS };
}

/** Attempt history reduced to what the level gate needs. */
function useAttemptSummaries(): AttemptSummary[] {
  const { history } = useUserPortal();
  return useMemo(
    () => history.map(h => ({ test_id: h.test_id, percentage: h.percentage, status: h.status })),
    [history],
  );
}

/**
 * Mock tests for a stage, grouped into Simple → Medium → Complex.
 *
 * The gate is always recomputed here — from scores, against the pass mark — so a
 * server that flags a failed attempt as "completed" cannot unlock a level it
 * shouldn't. Locally-known attempts are overlaid first, keeping the view correct
 * even before the server has caught up.
 */
export function useTnpscMockTests(groupId?: string, stageId?: string) {
  const attempts = useAttemptSummaries();

  const query = useQuery<TnpscMockOverview>({
    queryKey: ['tnpsc', 'mock', groupId, stageId],
    queryFn: () => getTnpscMockOverview(groupId!, stageId!),
    enabled: !!groupId && !!stageId,
    staleTime: STALE,
  });

  const levels = useMemo(() => {
    const data = query.data;
    if (!data) return [];
    const pass = effectivePassPercentage(
      data.pass_percentage ?? data.levels.find(l => l.required_percentage != null)?.required_percentage,
    );
    const withHistory = data.levels.map(l => ({
      ...l,
      tests: applyAttemptHistory(l.tests ?? [], attempts, pass),
    }));
    return normaliseLevelGroups(withHistory, pass);
  }, [query.data, attempts]);

  return { ...query, levels };
}

/** Syllabus-wise practice tests for a stage. */
export function useTnpscPracticeTests(groupId?: string, stageId?: string) {
  const attempts = useAttemptSummaries();

  const query = useQuery<TnpscPracticeSubject[]>({
    queryKey: ['tnpsc', 'practice', groupId, stageId],
    queryFn: () => getTnpscPracticeSubjects(groupId!, stageId!),
    enabled: !!groupId && !!stageId,
    staleTime: STALE,
  });

  const subjects = useMemo(() => {
    if (!query.data) return [];
    return query.data.map(s => ({ ...s, tests: applyAttemptHistory(s.tests, attempts) }));
  }, [query.data, attempts]);

  return { ...query, subjects };
}
