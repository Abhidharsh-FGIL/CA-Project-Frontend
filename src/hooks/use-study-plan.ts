/**
 * Study-plan data hooks.
 *
 * These are thin on purpose. The plan is computed server-side (see
 * STUDY_PLAN_BACKEND_CHANGES.md), so there is no model-building step here of the
 * kind `use-progress-report.ts` needs — the only local work is caching, the
 * date-range window the week board asks for, and an optimistic tick-off.
 */
import { useCallback, useMemo, useState } from 'react';
import { addDays, format, parseISO, startOfWeek } from 'date-fns';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  checkFeasibility,
  getActivePlan,
  getIntakeOptions,
  getPlanDays,
  getStudyPlan,
  isFeatureAbsent,
  updatePlanTask,
  type ActivePlanResponse,
  type DaysResponse,
  type Feasibility,
  type IntakeOptions,
  type PlanDay,
  type StudyPlan,
  type StudyPlanIntake,
  type TaskStatus,
} from '@/lib/studyPlanApi';

/** Query keys, in one place so a mutation can invalidate precisely. */
export const planKeys = {
  active: ['study-plan', 'active'] as const,
  plan: (id: string) => ['study-plan', id] as const,
  days: (id: string, from: string, to: string) => ['study-plan', id, 'days', from, to] as const,
  intakeOptions: (g: string, s: string) => ['study-plan', 'intake-options', g, s] as const,
};

/**
 * Retrying a 404/501 four times just to land on the same empty state wastes a
 * second and fills the console. Real errors still get one retry.
 */
function retryUnlessAbsent(count: number, err: unknown): boolean {
  if (isFeatureAbsent(err)) return false;
  return count < 1;
}

// ─── The active plan (dashboard card, workspace landing) ──────────────────────

export function useActiveStudyPlan(enabled = true): {
  data: ActivePlanResponse | null;
  isLoading: boolean;
  /** The backend has not shipped study plans yet — render the explicit state. */
  unavailable: boolean;
  error: Error | null;
  refetch: () => void;
} {
  const q = useQuery({
    queryKey: planKeys.active,
    queryFn: getActivePlan,
    enabled,
    staleTime: 60_000,
    retry: retryUnlessAbsent,
  });

  const unavailable = isFeatureAbsent(q.error);

  return {
    data: q.data ?? null,
    isLoading: q.isLoading,
    unavailable,
    error: unavailable ? null : ((q.error as Error) ?? null),
    refetch: q.refetch,
  };
}

// ─── One plan's outline ───────────────────────────────────────────────────────

export function useStudyPlan(planId: string | undefined): {
  plan: StudyPlan | null;
  isLoading: boolean;
  unavailable: boolean;
  error: Error | null;
} {
  const q = useQuery({
    queryKey: planKeys.plan(planId ?? ''),
    queryFn: () => getStudyPlan(planId!),
    enabled: !!planId,
    staleTime: 60_000,
    retry: retryUnlessAbsent,
  });

  const unavailable = isFeatureAbsent(q.error);

  return {
    plan: q.data ?? null,
    isLoading: q.isLoading,
    unavailable,
    error: unavailable ? null : ((q.error as Error) ?? null),
  };
}

// ─── A window of days ────────────────────────────────────────────────────────

/**
 * Day rows for a date range.
 *
 * The server caps a range at 62 days, so the week board asks for one week at a
 * time and the month view for one month — never the whole horizon, which for a
 * one-year plan would be ~310 days of tasks nobody is looking at.
 */
export function useStudyPlanDays(
  planId: string | undefined,
  from: string,
  to: string,
): {
  days: PlanDay[];
  outlineFrom: string | null;
  isLoading: boolean;
  error: Error | null;
} {
  const q = useQuery({
    queryKey: planKeys.days(planId ?? '', from, to),
    queryFn: () => getPlanDays(planId!, from, to),
    enabled: !!planId && !!from && !!to,
    staleTime: 30_000,
    retry: retryUnlessAbsent,
  });

  return {
    days: q.data?.days ?? [],
    outlineFrom: q.data?.outline_from ?? null,
    isLoading: q.isLoading,
    error: isFeatureAbsent(q.error) ? null : ((q.error as Error) ?? null),
  };
}

// ─── Ticking a task off ──────────────────────────────────────────────────────

/**
 * Optimistic tick-off.
 *
 * The checkbox must respond instantly — this is the interaction the candidate
 * performs a dozen times a day. The server's reply carries the recomputed day,
 * adherence and coverage, so the meters settle on real figures in one round trip
 * rather than needing a refetch per counter.
 */
export function useTaskToggle(planId: string | undefined) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ taskId, status, actualMinutes, score }: {
      taskId: string;
      status: TaskStatus;
      actualMinutes?: number;
      score?: number;
    }) => updatePlanTask(planId!, taskId, {
      status,
      actual_minutes: actualMinutes,
      score,
    }),

    onMutate: async ({ taskId, status }) => {
      // Patch every cached day window that holds this task, so whichever view is
      // on screen reacts without waiting for the network.
      const snapshots = qc.getQueriesData<DaysResponse>({
        queryKey: ['study-plan', planId ?? '', 'days'],
      });

      snapshots.forEach(([key, data]) => {
        if (!data) return;
        qc.setQueryData<DaysResponse>(key, {
          ...data,
          days: data.days.map(d => ({
            ...d,
            tasks: d.tasks.map(t => (t.task_id === taskId ? { ...t, status } : t)),
          })),
        });
      });

      const activeSnapshot = qc.getQueryData<ActivePlanResponse | null>(planKeys.active);
      if (activeSnapshot?.today) {
        qc.setQueryData<ActivePlanResponse>(planKeys.active, {
          ...activeSnapshot,
          today: {
            ...activeSnapshot.today,
            tasks: activeSnapshot.today.tasks.map(t =>
              t.task_id === taskId ? { ...t, status } : t,
            ),
          },
        });
      }

      return { snapshots, activeSnapshot };
    },

    onError: (_err, _vars, ctx) => {
      ctx?.snapshots.forEach(([key, data]) => qc.setQueryData(key, data));
      if (ctx?.activeSnapshot !== undefined) {
        qc.setQueryData(planKeys.active, ctx.activeSnapshot);
      }
    },

    onSuccess: () => {
      // Coverage and adherence live on the plan header and the active-plan
      // payload, so both are refetched rather than hand-patched.
      qc.invalidateQueries({ queryKey: planKeys.active });
      if (planId) qc.invalidateQueries({ queryKey: planKeys.plan(planId) });
    },
  });
}

// ─── Intake options ──────────────────────────────────────────────────────────

export function useIntakeOptions(
  groupId: string | undefined,
  stageId: string | undefined,
): {
  options: IntakeOptions | null;
  isLoading: boolean;
  unavailable: boolean;
  error: Error | null;
} {
  const q = useQuery({
    queryKey: planKeys.intakeOptions(groupId ?? '', stageId ?? ''),
    queryFn: () => getIntakeOptions(groupId!, stageId!),
    enabled: !!groupId && !!stageId,
    staleTime: 5 * 60_000,
    retry: retryUnlessAbsent,
  });

  const unavailable = isFeatureAbsent(q.error);

  return {
    options: q.data ?? null,
    isLoading: q.isLoading,
    unavailable,
    error: unavailable ? null : ((q.error as Error) ?? null),
  };
}

// ─── Feasibility ─────────────────────────────────────────────────────────────

/**
 * Feasibility for the intake as it currently stands.
 *
 * Deliberately imperative rather than a `useQuery` on the whole intake: the
 * wizard calls it when a step is completed, not on every slider tick, so the
 * server is asked once per meaningful change.
 */
export function useFeasibility(): {
  result: Feasibility | null;
  isChecking: boolean;
  unavailable: boolean;
  error: Error | null;
  check: (intake: StudyPlanIntake) => Promise<Feasibility | null>;
  reset: () => void;
} {
  const [result, setResult] = useState<Feasibility | null>(null);
  const [isChecking, setChecking] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  const check = useCallback(async (intake: StudyPlanIntake) => {
    setChecking(true);
    setError(null);
    try {
      const res = await checkFeasibility(intake);
      setResult(res);
      setUnavailable(false);
      return res;
    } catch (err) {
      if (isFeatureAbsent(err)) {
        setUnavailable(true);
      } else {
        setError(err as Error);
      }
      setResult(null);
      return null;
    } finally {
      setChecking(false);
    }
  }, []);

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
    setUnavailable(false);
  }, []);

  return { result, isChecking, unavailable, error, check, reset };
}

// ─── Date-window helper ──────────────────────────────────────────────────────

/**
 * The Monday-anchored week window the board pages through.
 *
 * This is the one piece of date arithmetic the frontend does, and it is layout,
 * not planning: which seven dates to request. Nothing here decides what is
 * studied on them.
 */
export function useWeekWindow(anchorISO: string) {
  const [offset, setOffset] = useState(0);

  const { from, to } = useMemo(() => {
    // date-fns throughout, and never `toISOString` — that converts to UTC, which
    // east of Greenwich moves a local midnight back into the previous day and
    // would request Sunday-to-Saturday for every Indian user.
    const monday = addDays(startOfWeek(parseISO(anchorISO), { weekStartsOn: 1 }), offset * 7);
    const fmt = (d: Date) => format(d, 'yyyy-MM-dd');
    return { from: fmt(monday), to: fmt(addDays(monday, 6)) };
  }, [anchorISO, offset]);

  return {
    from,
    to,
    offset,
    next: () => setOffset(o => o + 1),
    prev: () => setOffset(o => o - 1),
    reset: () => setOffset(0),
  };
}
