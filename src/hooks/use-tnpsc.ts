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
import {
  catalogForLanguage,
  examLanguageOf,
  papersFor,
  subjectLanguage,
  type ExamLanguage,
} from '@/lib/exam-language';

const STALE = 5 * 60 * 1000;

/**
 * The TNPSC group → stage catalog (server-driven when available).
 *
 * `forMyLanguage` is for the screens an aspirant browses the exam on: Group 4 then lists only the
 * language paper they sit, General Tamil or General English, and not the other. Anything that reads
 * the catalog to make sense of an attempt that has already happened — a report, the study-plan
 * calendar — leaves it off, because that attempt may be on either.
 */
export function useTnpscCatalog(opts?: { forMyLanguage?: boolean }) {
  const { user } = useUserPortal();
  const query = useQuery<TnpscGroup[]>({
    queryKey: ['tnpsc', 'catalog'],
    queryFn: getTnpscCatalog,
    staleTime: STALE,
    placeholderData: TNPSC_GROUPS,
  });
  const all = query.data ?? TNPSC_GROUPS;
  const language = examLanguageOf(user?.medium);
  const forMyLanguage = !!opts?.forMyLanguage;
  const groups = useMemo(() => (forMyLanguage ? catalogForLanguage(all, language) : all), [all, language, forMyLanguage]);
  return { ...query, groups };
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
 *
 * Pass `language` to list only that language paper's mocks (and the ones that name no language).
 * It is applied before the levels are counted, so "2 of 3 cleared" never counts a paper the
 * aspirant is not shown. Left off, every paper is listed — which is what matching an attempt to
 * its exam needs.
 */
export function useTnpscMockTests(groupId?: string, stageId?: string, language?: ExamLanguage | null) {
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
      tests: applyAttemptHistory(papersFor(language ?? null, l.tests ?? []), attempts, pass),
    }));
    return normaliseLevelGroups(withHistory, pass);
  }, [query.data, attempts, language]);

  return { ...query, levels };
}

/**
 * Syllabus-wise practice tests for a stage.
 *
 * `language` is as for the mock tests: the other language paper's subject and papers are left out.
 */
export function useTnpscPracticeTests(groupId?: string, stageId?: string, language?: ExamLanguage | null) {
  const attempts = useAttemptSummaries();

  const query = useQuery<TnpscPracticeSubject[]>({
    queryKey: ['tnpsc', 'practice', groupId, stageId],
    queryFn: () => getTnpscPracticeSubjects(groupId!, stageId!),
    enabled: !!groupId && !!stageId,
    staleTime: STALE,
  });

  const subjects = useMemo(() => {
    if (!query.data) return [];
    return query.data
      .filter(s => {
        const own = subjectLanguage(s.subject_id);
        return !language || !own || own === language;
      })
      .map(s => ({ ...s, tests: applyAttemptHistory(papersFor(language ?? null, s.tests), attempts) }));
  }, [query.data, attempts, language]);

  return { ...query, subjects };
}
