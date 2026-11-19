import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import { getTnpscMockOverview, getTnpscPracticeSubjects, type TnpscMockOverview, type TnpscPracticeSubject } from '@/lib/tnpscApi';
import { useExamGroupOptions } from '@/hooks/use-exam-availability';
import { GROUP_STAGE, examGroupLabel, type GroupKey } from '@/hooks/use-progress-trend';
import type { ApiAttempt } from '@/lib/userPortalApi';

const STALE = 5 * 60 * 1000;

/**
 * Which exam a history row belongs to, by name.
 *
 * Attempts carry no exam id and a test's name often does not say ("Full Mock (Tamil)"), so — as the exam filter does
 * (`useGroupMatcher`) — the exams' own test catalogs answer it: a test id found in one exam's mock or practice papers is
 * that exam's. A title is used only when exactly one exam has it, because "Full Mock (Tamil)" is in more than one.
 *
 * With one exam picked in the filter, every row on screen is already that exam's, so no catalog is read and its name is
 * returned for each. With "All groups" the open exams' catalogs are read; they share the Exams pages' cache keys, so
 * an exam the aspirant has browsed costs nothing.
 */
export function useAttemptExams(group: GroupKey): (a: Pick<ApiAttempt, 'test_id' | 'test_name'>) => string | null {
  const options = useExamGroupOptions();
  const all = group === 'all';

  const mocks = useQueries({
    queries: options.map(o => ({
      queryKey: ['tnpsc', 'mock', o.value, GROUP_STAGE[o.value]],
      queryFn: () => getTnpscMockOverview(o.value, GROUP_STAGE[o.value]),
      enabled: all,
      staleTime: STALE,
      retry: false,
    })),
  });
  const practice = useQueries({
    queries: options.map(o => ({
      queryKey: ['tnpsc', 'practice', o.value, GROUP_STAGE[o.value]],
      queryFn: () => getTnpscPracticeSubjects(o.value, GROUP_STAGE[o.value]),
      enabled: all,
      staleTime: STALE,
      retry: false,
    })),
  });

  // Changes only when a catalog settles, so the lookup below is not rebuilt on every render.
  const signature = [...mocks, ...practice].map(q => q.dataUpdatedAt).join('|');

  const lookup = useMemo(() => {
    const byId = new Map<string, string>();
    const byTitle = new Map<string, string | null>(); // null: more than one exam has this title
    options.forEach((o, i) => {
      const add = (id?: string | null, title?: string | null) => {
        if (id && !byId.has(id)) byId.set(id, o.label);
        const t = title?.trim().toLowerCase();
        if (!t) return;
        const seen = byTitle.get(t);
        byTitle.set(t, seen === undefined || seen === o.label ? o.label : null);
      };
      (mocks[i]?.data as TnpscMockOverview | undefined)?.levels.forEach(l => l.tests?.forEach(t => add(t.test_id, t.title)));
      (practice[i]?.data as TnpscPracticeSubject[] | undefined)?.forEach(s => s.tests?.forEach(t => add(t.test_id, t.title)));
    });
    return { byId, byTitle };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, options]);

  return useMemo(() => {
    if (!all) {
      const label = examGroupLabel(group);
      return () => label;
    }
    return a => lookup.byId.get(a.test_id) ?? (a.test_name ? lookup.byTitle.get(a.test_name.trim().toLowerCase()) : null) ?? null;
  }, [all, group, lookup]);
}
