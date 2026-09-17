/**
 * Subject strengths, optionally scoped to a set of attempts.
 *
 * The server aggregates `subject_strengths` across every attempt with no group or
 * date dimension (§6b of TNPSC_DASHBOARD_API.md), so it cannot answer "how am I doing
 * on Group 1 papers". Filtering by syllabus wouldn't work either — Group 1 Prelims
 * subjects are a subset of Group 4 Written's, so both lists would look almost the same.
 *
 * What does work: every attempt detail carries `performance_breakdown.subject_breakdown`
 * with per-subject correct / incorrect / unattempted. Re-aggregating those for the
 * attempts in scope gives a genuine per-group answer.
 *
 * The unfiltered case still uses the server's figure — it's one request and covers
 * attempts older than the 50 `/user/history` returns.
 */
import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import { getAttemptDetail, type ApiAttempt } from '@/lib/userPortalApi';
import type { SubjectStrength, UserDashboardAnalytics } from '@/lib/userDashboardApi';

/** Attempt details fetched at once. Each is one request; they're immutable once submitted. */
const MAX_DETAIL_FETCHES = 25;

interface Args {
  analytics: UserDashboardAnalytics | undefined;
  /** Attempts already narrowed by the caller's filters. */
  attempts: ApiAttempt[];
  /** False to skip the fetches and use the server aggregate. */
  scoped: boolean;
}

export function useSubjectStrengths({ analytics, attempts, scoped }: Args) {
  const targets = useMemo(() => attempts.slice(0, MAX_DETAIL_FETCHES), [attempts]);

  const details = useQueries({
    queries: targets.map(h => ({
      queryKey: ['attempt-detail', h.attempt_id],
      queryFn: () => getAttemptDetail(h.attempt_id),
      enabled: scoped,
      // A submitted attempt's breakdown never changes.
      staleTime: Infinity,
      retry: 1,
    })),
  });

  const isLoading = scoped && details.some(d => d.isLoading);

  const scopedSubjects = useMemo<SubjectStrength[]>(() => {
    if (!scoped) return [];
    const totals = new Map<string, { correct: number; wrong: number; total: number }>();

    for (const d of details) {
      const rows = d.data?.performance_breakdown?.subject_breakdown ?? [];
      for (const row of rows) {
        const subject = (row.subject ?? '').trim();
        if (!subject) continue;
        const entry = totals.get(subject) ?? { correct: 0, wrong: 0, total: 0 };
        entry.correct += row.correct ?? 0;
        entry.wrong += row.incorrect ?? 0;
        entry.total += row.total_questions ?? 0;
        totals.set(subject, entry);
      }
    }

    return [...totals.entries()]
      .map(([subject, t]) => {
        const attempted = t.correct + t.wrong;
        return {
          subject,
          accuracy: attempted > 0 ? Math.round((t.correct / attempted) * 100) : 0,
          attempted,
          correct: t.correct,
          total_questions: t.total,
        };
      })
      // A 0% over nothing answered is not a weakness — it would top the "needs work" list.
      .filter(s => (s.attempted ?? 0) > 0)
      .sort((x, y) => y.accuracy - x.accuracy);
  }, [scoped, details]);

  const subjects = scoped ? scopedSubjects : analytics?.subject_strengths ?? [];

  const overallAccuracy = useMemo(() => {
    if (!scoped) return analytics?.overall_accuracy ?? null;
    let correct = 0;
    let attempted = 0;
    for (const s of subjects) {
      correct += s.correct ?? 0;
      attempted += s.attempted ?? 0;
    }
    return attempted > 0 ? Math.round((correct / attempted) * 100) : null;
  }, [scoped, subjects, analytics?.overall_accuracy]);

  return {
    subjects,
    overallAccuracy,
    isLoading,
    /** True when more attempts matched than were fetched — the figures are partial. */
    truncated: scoped && attempts.length > targets.length,
  };
}
