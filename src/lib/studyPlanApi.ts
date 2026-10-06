/**
 * Study Plan API — the whole plan is generated and owned by the server.
 *
 * There is deliberately no `buildStudyPlan` next to this file. An earlier version
 * computed the plan in the browser and was deleted: it could not exceed four weeks,
 * nothing persisted, and the plan changed every time the page re-rendered. Every
 * date, minute, task and sentence below arrives from the backend — see
 * STUDY_PLAN_BACKEND_CHANGES.md, which this file is the client half of.
 *
 * Endpoints (all under /api/v1/user/, all user-token authenticated):
 *   GET   study-plan/intake-options?group_id=&stage_id=   → IntakeOptions
 *   POST  study-plan/feasibility                          → Feasibility
 *   POST  study-plans                                     → CreatePlanResponse (202)
 *   GET   study-plans/{id}/status                         → PlanJobStatus
 *   GET   study-plans/active                              → ActivePlanResponse | null (204)
 *   GET   study-plans                                     → { items, total }
 *   GET   study-plans/{id}                                → StudyPlan
 *   GET   study-plans/{id}/days?from=&to=                 → DaysResponse
 *   GET   study-plans/{id}/today                          → PlanDay
 *   PATCH study-plans/{id}/tasks/{taskId}                 → TaskUpdateResponse
 *   PATCH study-plans/{id}                                → StudyPlan
 *   POST  study-plans/{id}/reschedule                     → StudyPlan
 *   POST  study-plans/{id}/revise                         → CreatePlanResponse
 */
import { userApi } from './api';

// ─── Intake ───────────────────────────────────────────────────────────────────

export type Weekday = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

/** ISO order, so a week renders Monday-first without re-sorting. */
export const WEEKDAYS: Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

export const WEEKDAY_LABEL: Record<Weekday, string> = {
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
  sat: 'Saturday',
  sun: 'Sunday',
};

export const WEEKDAY_SHORT: Record<Weekday, string> = {
  mon: 'Mon',
  tue: 'Tue',
  wed: 'Wed',
  thu: 'Thu',
  fri: 'Fri',
  sat: 'Sat',
  sun: 'Sun',
};

export type HorizonMode = 'days' | 'weeks' | 'months' | 'exam_date';
export type RevisionIntensity = 'light' | 'balanced' | 'heavy';
export type CoverageMode = 'full' | 'high_yield';
export type BasisKind = 'attempt' | 'latest' | 'progress' | 'cold_start';

export interface PlanBasisInput {
  kind: BasisKind;
  /** Required when kind is 'attempt', forbidden otherwise. */
  attempt_id?: string;
  /**
   * Migration shim (§S6.1). Priority ranking still lives in the frontend's
   * attempt-report.ts, so until it is ported to Python the facts travel with the
   * intake exactly as they already do for `requestReportInsights`. Delete this
   * field — here and server-side — once the port lands.
   */
  facts?: unknown;
}

export interface StudyPlanIntake {
  group_id: string;
  stage_id: string;
  basis: PlanBasisInput;
  horizon: { mode: HorizonMode; value: number };
  start_date: string;
  exam_date?: string | null;
  study_days: Weekday[];
  minutes_per_day: number;
  per_day_minutes?: Partial<Record<Weekday, number>>;
  revision_intensity: RevisionIntensity;
  include_full_mocks: boolean;
  coverage_mode?: CoverageMode;
  language?: 'en' | 'ta';
  optional_subjects?: string[];
}

export type Verdict = 'comfortable' | 'tight' | 'not_feasible';

export interface IntakeOptions {
  group_id: string;
  stage_id: string;
  stage_name: string;
  subject_count: number;
  topic_count: number;
  total_marks: number;
  estimated_syllabus_minutes: number;
  suggested_minutes_per_day: number;
  suggested_horizons: Array<{
    mode: HorizonMode;
    value: number;
    label: string;
    verdict: Verdict;
  }>;
  known_exam_date: string | null;
  optional_subject_groups: Array<{
    choose: number;
    options: Array<{ subject_id: string; name: string }>;
  }>;
  attempts_available: number;
  latest_attempt: {
    attempt_id: string;
    test_name: string | null;
    date: string | null;
    percentage: number | null;
    weak_subjects: string[];
  } | null;
  has_active_plan: boolean;
}

/**
 * A fix the server offers for an intake that does not fit.
 *
 * `patch` is a partial intake the UI merges and re-submits — the server decides
 * what a fix *is*, the frontend only offers it. That keeps "add 45 minutes" from
 * being a number this file guesses at.
 */
export interface FeasibilitySuggestion {
  kind: 'add_minutes' | 'add_day' | 'extend' | 'high_yield';
  label: string;
  patch: Partial<StudyPlanIntake>;
}

export interface Feasibility {
  verdict: Verdict;
  available_minutes: number;
  required_minutes: number;
  shortfall_minutes: number;
  shortfall_pct: number;
  study_day_count: number;
  message: string;
  suggestions: FeasibilitySuggestion[];
}

// ─── Plan ─────────────────────────────────────────────────────────────────────

export type PlanStatus =
  | 'generating'
  | 'active'
  | 'paused'
  | 'archived'
  | 'superseded'
  | 'failed';

export type DayStatus = 'pending' | 'done' | 'partial' | 'skipped';
export type TaskStatus = 'pending' | 'done' | 'partial' | 'skipped';

export type TaskKind =
  | 'concept'
  | 'notes'
  | 'practice'
  | 'review'
  | 'revision'
  | 'mock'
  | 'diagnostic';

export interface PlanPhase {
  phase_id: string;
  idx: number;
  label: string;
  /** LLM-written; null falls back to `label` alone. */
  theme: string | null;
  goal: string | null;
  start_date: string;
  end_date: string;
  week_nos: number[];
}

export interface PlanWeek {
  week_id: string;
  week_no: number;
  phase_idx: number;
  start_date: string;
  end_date: string;
  theme: string;
  /** LLM-written, first weeks only. */
  narrative: string | null;
  target_minutes: number;
  detail_status: 'outline' | 'detailed';
  subject_ids: string[];
  progress: {
    planned_minutes: number;
    completed_minutes: number;
    status: DayStatus;
  };
}

export interface PlanTask {
  task_id: string;
  ord: number;
  kind: TaskKind;
  subject_id: string;
  subject_name: string;
  topic_id: string | null;
  topic_name: string | null;
  unit_id: string | null;
  title: string;
  minutes: number;
  question_target: number;
  resource_ref: string | null;
  /** When set, the task launches a real practice test instead of reading as prose. */
  test_id: string | null;
  /**
   * Which take-flow `test_id` belongs to.
   *
   * The portal has two: admin-managed tests open at `/user/test/{id}/start`, eval
   * assessments at `/user/assessment/{id}` — the same split `testHref` in
   * tnpscApi.ts routes on. Sending the id without the source makes the link a
   * coin-flip, and a wrong guess lands the aspirant on "Test not found".
   * Absent, it is assumed to be 'test'.
   */
  test_source?: 'assessment' | 'test' | null;
  success_criterion: string | null;
  coaching_note: string | null;
  status: TaskStatus;
  actual_minutes: number | null;
  score: number | null;
}

export interface PlanDay {
  day_id: string;
  date: string;
  /** ISO weekday, 1 = Monday. */
  weekday: number;
  week_no: number;
  is_rest: boolean;
  planned_minutes: number;
  completed_minutes: number;
  status: DayStatus;
  tasks: PlanTask[];
}

export interface PlanAdherence {
  window_days: number;
  planned_minutes?: number;
  completed_minutes?: number;
  pct: number;
  streak_days: number;
}

export interface PlanCoverageSummary {
  topics_total: number;
  topics_touched: number;
  pct: number;
}

export interface PlanCoverage extends PlanCoverageSummary {
  by_subject: Array<{
    subject_id: string;
    name: string;
    topics_total: number;
    topics_planned: number;
    topics_completed: number;
    planned_minutes: number;
    priority_rank: number | null;
    archetype: string | null;
  }>;
}

export interface StudyPlan {
  plan_id: string;
  status: PlanStatus;
  version: number;
  revision_of: string | null;
  group_id: string;
  stage_id: string;
  stage_name: string;
  basis: {
    kind: BasisKind;
    attempt_id: string | null;
    test_name: string | null;
    date: string | null;
    percentage: number | null;
  };
  start_date: string;
  end_date: string;
  exam_date: string | null;
  feasibility: Verdict;
  intake: StudyPlanIntake;
  totals: {
    weeks: number;
    study_days: number;
    planned_minutes: number;
    mocks: number;
  };
  goal: { headline: string; targets: string[] };
  phases: PlanPhase[];
  weeks: PlanWeek[];
  coverage: PlanCoverage;
  adherence: PlanAdherence;
  /** Honest about whether the prose on screen came from a model or a template. */
  narrative_source: 'llm' | 'deterministic';
}

export interface ActivePlanResponse {
  plan: StudyPlan;
  today: PlanDay | null;
  adherence: PlanAdherence;
  coverage: PlanCoverageSummary;
}

export interface CreatePlanResponse {
  plan_id: string;
  job_id: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  feasibility: Verdict;
}

export interface PlanJobStatus {
  status: 'queued' | 'running' | 'completed' | 'failed';
  progress: number;
  stage_label: string | null;
  error: string | null;
}

export interface DaysResponse {
  from: string;
  to: string;
  /** First date the plan has not been detailed to yet, when the range runs past it. */
  outline_from: string | null;
  days: PlanDay[];
}

export interface TaskUpdateResponse {
  task: PlanTask;
  day: PlanDay;
  adherence: PlanAdherence;
  coverage: PlanCoverageSummary;
  xp_awarded: number;
}

/**
 * Where a task's linked paper opens.
 *
 * Mirrors `testHref` in tnpscApi.ts. Defaults to the admin-managed test flow when
 * the backend sends no source, which is the common case and what the field
 * defaulted to before it existed.
 */
export function taskTestHref(task: Pick<PlanTask, 'test_id' | 'test_source'>): string | null {
  if (!task.test_id) return null;
  return task.test_source === 'assessment'
    ? `/user/assessment/${task.test_id}`
    : `/user/test/${task.test_id}/start`;
}

// ─── Feature detection ────────────────────────────────────────────────────────

/**
 * True when a failure means "the backend has not built this yet" rather than
 * "something went wrong".
 *
 * The spec asks for 501 + STUDY_PLANS_DISABLED, but an unimplemented route 404s
 * on its own, so both count. Everything else is a real error and must surface as
 * one — swallowing a 500 here would hide a broken plan behind an empty state.
 */
export function isFeatureAbsent(err: unknown): boolean {
  const e = err as { status?: number; code?: string } | null;
  if (!e) return false;
  if (e.status === 404 || e.status === 501) return true;
  return e.code === 'STUDY_PLANS_DISABLED';
}

const BASE = '/api/v1/user';

// ─── Calls ────────────────────────────────────────────────────────────────────

export function getIntakeOptions(groupId: string, stageId: string): Promise<IntakeOptions> {
  const q = new URLSearchParams({ group_id: groupId, stage_id: stageId });
  return userApi.get<IntakeOptions>(`${BASE}/study-plan/intake-options?${q}`);
}

/** Dry run — writes nothing. Safe to call on every wizard keystroke (debounced). */
export function checkFeasibility(intake: StudyPlanIntake): Promise<Feasibility> {
  return userApi.post<Feasibility>(`${BASE}/study-plan/feasibility`, intake);
}

export function createStudyPlan(intake: StudyPlanIntake): Promise<CreatePlanResponse> {
  return userApi.post<CreatePlanResponse>(`${BASE}/study-plans`, intake);
}

export function getPlanStatus(planId: string): Promise<PlanJobStatus> {
  return userApi.get<PlanJobStatus>(`${BASE}/study-plans/${planId}/status`);
}

/** 204 → null. No active plan is a normal state, not an error. */
export async function getActivePlan(): Promise<ActivePlanResponse | null> {
  const res = await userApi.get<ActivePlanResponse | undefined>(`${BASE}/study-plans/active`);
  return res ?? null;
}

export function listStudyPlans(): Promise<{ items: StudyPlan[]; total: number }> {
  return userApi.get<{ items: StudyPlan[]; total: number }>(`${BASE}/study-plans`);
}

export function getStudyPlan(planId: string): Promise<StudyPlan> {
  return userApi.get<StudyPlan>(`${BASE}/study-plans/${planId}`);
}

/** Range is inclusive and capped at 62 days server-side (RANGE_TOO_LARGE beyond). */
export function getPlanDays(planId: string, from: string, to: string): Promise<DaysResponse> {
  const q = new URLSearchParams({ from, to });
  return userApi.get<DaysResponse>(`${BASE}/study-plans/${planId}/days?${q}`);
}

/** `date` omitted → the server resolves the user's local day, not UTC. */
export function getPlanToday(planId: string, date?: string): Promise<PlanDay> {
  const q = date ? `?${new URLSearchParams({ date })}` : '';
  return userApi.get<PlanDay>(`${BASE}/study-plans/${planId}/today${q}`);
}

export function updatePlanTask(
  planId: string,
  taskId: string,
  patch: { status?: TaskStatus; actual_minutes?: number; score?: number },
): Promise<TaskUpdateResponse> {
  return userApi.patch<TaskUpdateResponse>(
    `${BASE}/study-plans/${planId}/tasks/${taskId}`,
    patch,
  );
}

export function updateStudyPlan(
  planId: string,
  patch: { status?: PlanStatus; intake?: Partial<StudyPlanIntake> },
): Promise<StudyPlan> {
  return userApi.patch<StudyPlan>(`${BASE}/study-plans/${planId}`, patch);
}

export function reschedulePlan(
  planId: string,
  body: { from: string; strategy: 'compress' | 'shift' },
): Promise<StudyPlan> {
  return userApi.post<StudyPlan>(`${BASE}/study-plans/${planId}/reschedule`, body);
}

/** Regenerate forward from a newer attempt. Versions the plan; never overwrites. */
export function revisePlan(
  planId: string,
  basis: PlanBasisInput,
): Promise<CreatePlanResponse> {
  return userApi.post<CreatePlanResponse>(`${BASE}/study-plans/${planId}/revise`, { basis });
}

/**
 * Poll a generation job until it settles.
 *
 * Mirrors `pollPaperExtraction` in paperImportApi.ts — same 2-3s cadence, same
 * patience, because a 6-month plan with an LLM narrative pass takes under a
 * minute but not under ten seconds.
 */
export async function pollPlanGeneration(
  planId: string,
  onProgress: (s: PlanJobStatus) => void,
  signal?: AbortSignal,
): Promise<PlanJobStatus> {
  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (signal?.aborted) throw new Error('Plan generation cancelled');
    const status = await getPlanStatus(planId);
    onProgress(status);
    if (status.status === 'completed') return status;
    if (status.status === 'failed') {
      throw new Error(status.error || 'Your study plan could not be generated.');
    }
    await new Promise(r => setTimeout(r, 2000));
  }
}
