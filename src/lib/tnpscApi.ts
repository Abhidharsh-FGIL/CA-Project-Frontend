/**
 * TNPSC portal API — catalog, mock-test levels and syllabus practice tests.
 *
 * Preferred (new) endpoints — see TNPSC_BACKEND_CHANGES.md:
 *   GET /api/v1/user/tnpsc/catalog
 *   GET /api/v1/user/tnpsc/stages/{stage_id}/mock-tests
 *   GET /api/v1/user/tnpsc/stages/{stage_id}/practice-tests?subject=&topic=
 *
 * Until those ship, every call falls back to the existing
 * `/api/v1/user/eval-assessments` payload and derives the TNPSC hierarchy on the
 * client (mode → track, difficulty → level, title → group/stage/subject). The UI
 * is identical either way; only the accuracy of the grouping differs.
 */
import { userApi } from './api';
import { getUserAssessments, type ApiEvalAssessment } from './userPortalApi';
import {
  DIFFICULTY_TO_LEVEL,
  LEVEL_GATE_ENABLED,
  LEVEL_PASS_PERCENTAGE,
  LEVEL_RESPECT_SERVER_LOCK,
  LEVEL_UNLOCK_RULE,
  TNPSC_GROUPS,
  TNPSC_LEVELS,
  findStage,
  levelIndex,
  previousLevel,
  type TnpscExamPattern,
  type TnpscGroup,
  type TnpscLevel,
  type TnpscStage,
  type TnpscTestType,
} from '@/config/tnpsc';

// ─── Types ─────────────────────────────────────────────────────────────────────

/** A single attemptable paper inside the TNPSC hierarchy. */
export interface TnpscTest {
  test_id: string;
  /** Which take-flow to route to: eval assessment or admin-managed test. */
  source: 'assessment' | 'test';
  title: string;
  group_id: string | null;
  stage_id: string | null;
  test_type: TnpscTestType;
  /** Mock tests only — practice tests are ungated. */
  level: TnpscLevel | null;
  subject_id: string | null;
  subject_name: string | null;
  topic_id: string | null;
  topic_name: string | null;
  question_count: number;
  max_marks: number;
  time_limit_minutes: number | null;
  negative_marking: boolean;
  negative_mark_value: number | null;
  price: number;
  required_tier: string | null;
  /** Subscription/paywall lock — independent of the level lock. */
  is_locked: boolean;
  lock_reason: string | null;
  attempts_used: number;
  max_attempts: number | null;
  best_percentage: number | null;
  /** true when the aspirant has a submitted attempt that met the pass mark. */
  is_completed: boolean;
}

export interface TnpscLevelGroup {
  level: TnpscLevel;
  /** false while the previous level has not been cleared. */
  is_unlocked: boolean;
  lock_reason: string | null;
  required_percentage: number;
  best_percentage: number | null;
  is_completed: boolean;
  tests_total: number;
  tests_completed: number;
  tests: TnpscTest[];
}

export interface TnpscMockOverview {
  stage_id: string;
  levels: TnpscLevelGroup[];
  /** Pass mark the server applies, if it reports one. */
  pass_percentage?: number;
  /** true when the payload came from the server, false when derived on the client. */
  server_computed: boolean;
}

export interface TnpscPracticeSubject {
  subject_id: string;
  subject_name: string;
  subject_name_ta?: string;
  tests: TnpscTest[];
}

// ─── Catalog ───────────────────────────────────────────────────────────────────

/** GET /api/v1/user/tnpsc/catalog — falls back to the bundled catalog. */
export async function getTnpscCatalog(): Promise<TnpscGroup[]> {
  try {
    const res = await userApi.get<{ groups: TnpscGroup[] } | TnpscGroup[]>('/api/v1/user/tnpsc/catalog');
    const groups = Array.isArray(res) ? res : res?.groups;
    if (Array.isArray(groups) && groups.length > 0) return mergeCatalog(groups);
  } catch {
    /* endpoint not deployed yet — use the bundled catalog */
  }
  return TNPSC_GROUPS;
}

// ─── Catalog merge ─────────────────────────────────────────────────────────────

/** A value the server actually sent — `null`, `undefined`, `''` and `[]` are gaps. */
function sent<T>(v: T | null | undefined): v is T {
  if (v == null) return false;
  if (typeof v === 'string') return v.trim() !== '';
  if (Array.isArray(v)) return v.length > 0;
  return true;
}

/** The subset of an object the server actually populated. */
function populated<T extends object>(o: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(o)) if (sent(v)) out[k] = v;
  return out as Partial<T>;
}

/**
 * Merge the server catalog over the bundled one, field by field.
 *
 * The server is authoritative for everything it actually sends, but it may be
 * running a schema older than this build: missing `authority`/`exam_type`, or not
 * yet carrying an exam the frontend already supports (see GAT_B_BACKEND_CHANGES.md).
 * Taking the payload wholesale would then blank those fields — an empty card eyebrow
 * — and hide the exam entirely, which is exactly what happened when GAT-B landed
 * before the backend did.
 *
 * Groups and stages known locally but absent from the payload are appended: the
 * bundled catalog is this build's declaration of what it can render. A server that
 * genuinely retires an exam should mark the stage `coming_soon` rather than drop it,
 * since a field-level status does override the bundled value.
 */
export function mergeCatalog(server: TnpscGroup[], local: TnpscGroup[] = TNPSC_GROUPS): TnpscGroup[] {
  const localById = new Map(local.map(g => [g.id, g]));
  const merged = server.map(g => {
    const l = localById.get(g.id);
    return l ? mergeGroup(g, l) : g;
  });

  const seen = new Set(server.map(g => g.id));
  for (const l of local) if (!seen.has(l.id)) merged.push(l);
  return merged;
}

function mergeGroup(server: TnpscGroup, local: TnpscGroup): TnpscGroup {
  const localStages = new Map(local.stages.map(st => [st.id, st]));
  const serverStages = server.stages ?? [];

  const stages = serverStages.map(st => {
    const l = localStages.get(st.id);
    return l ? mergeStage(st, l) : st;
  });
  const seen = new Set(serverStages.map(st => st.id));
  for (const l of local.stages) if (!seen.has(l.id)) stages.push(l);

  return { ...local, ...populated(server), stages };
}

function mergeStage(server: TnpscStage, local: TnpscStage): TnpscStage {
  return {
    ...local,
    ...populated(server),
    // `subjects: []` means "not populated yet", not "this stage has no syllabus" —
    // an empty list would leave the practice track with nothing to bucket into.
    subjects: sent(server.subjects) ? server.subjects : local.subjects,
    pattern: mergePattern(server.pattern, local.pattern),
  };
}

function mergePattern(
  server?: TnpscExamPattern,
  local?: TnpscExamPattern,
): TnpscExamPattern | undefined {
  if (!server) return local;
  if (!local) return server;
  return {
    ...local,
    ...populated(server),
    sections: mergeSections(server.sections, local.sections),
  };
}

/**
 * Sections match on name. A server that predates the per-section fields sends only
 * `{name, questions, marks}`, so the bundled `attempt` / `marks_per_question` /
 * `negative_mark_value` must survive underneath it.
 */
function mergeSections(
  server: TnpscExamPattern['sections'],
  local: TnpscExamPattern['sections'],
): TnpscExamPattern['sections'] {
  if (!sent(server)) return local;
  const byName = new Map((local ?? []).map(sec => [sec.name, sec]));
  return server.map(sec => {
    const l = byName.get(sec.name);
    return l ? { ...l, ...populated(sec) } : sec;
  });
}

// ─── Mock tests (level-gated) ──────────────────────────────────────────────────

export async function getTnpscMockOverview(
  groupId: string,
  stageId: string,
): Promise<TnpscMockOverview> {
  try {
    const res = await userApi.get<{ levels: TnpscLevelGroup[]; pass_percentage?: number }>(
      `/api/v1/user/tnpsc/stages/${stageId}/mock-tests`,
    );
    if (res && Array.isArray(res.levels)) {
      return {
        stage_id: stageId,
        levels: res.levels,
        pass_percentage: res.pass_percentage,
        server_computed: true,
      };
    }
  } catch {
    /* fall through to the derived view */
  }
  const tests = await deriveTests(groupId, stageId, 'mock');
  return { stage_id: stageId, levels: buildLevelGroups(tests), server_computed: false };
}

/**
 * The pass mark actually applied, in percent.
 *
 * Takes the stricter of the bundled constant and whatever the server reports, so
 * the UI never invites an aspirant into a level the server would refuse to start.
 * When the backend's `TNPSC_LEVEL_PASS_PERCENTAGE` is aligned the two agree.
 */
export function effectivePassPercentage(serverRequired?: number | null): number {
  return Math.max(LEVEL_PASS_PERCENTAGE, serverRequired ?? 0);
}

/**
 * Has this aspirant actually cleared this paper?
 *
 * A score decides it. Absent a score, a paper with no attempts is never cleared —
 * whatever flag the payload carries. (Observed from the live API: every test came
 * back `is_completed: true` including ones with `attempts_used: 0`, which would
 * have unlocked every level for a brand-new user.) The server flag is only
 * trusted when there *is* an attempt but no score to judge it by.
 */
function isTestCleared(t: TnpscTest, pass: number): boolean {
  if (t.best_percentage != null) return t.best_percentage >= pass;
  return (t.attempts_used ?? 0) > 0 && !!t.is_completed;
}

/** Highest known score across a set of papers. */
function bestOf(tests: TnpscTest[]): number | null {
  return tests.reduce<number | null>(
    (max, t) => (t.best_percentage == null ? max : max == null ? t.best_percentage : Math.max(max, t.best_percentage)),
    null,
  );
}

/** Bucket a flat list of mocks into the three levels, then normalise. */
export function buildLevelGroups(tests: TnpscTest[], pass = LEVEL_PASS_PERCENTAGE): TnpscLevelGroup[] {
  const skeleton: TnpscLevelGroup[] = TNPSC_LEVELS.map(level => {
    const levelTests = tests.filter(t => (t.level ?? 'simple') === level);
    return {
      level,
      is_unlocked: true,
      lock_reason: null,
      required_percentage: pass,
      best_percentage: bestOf(levelTests),
      is_completed: false,
      tests_total: levelTests.length,
      tests_completed: 0,
      tests: levelTests,
    };
  });
  return normaliseLevelGroups(skeleton, pass);
}

/**
 * Single source of truth for what "cleared" and "unlocked" mean.
 *
 * Scores decide, not flags: a paper counts as cleared only when its best score
 * reaches the pass mark, whoever computed the payload. A server that marks a 2%
 * attempt "completed" is corrected here rather than passed through to the UI —
 * the flag is honoured only when no score is available to judge by.
 */
export function normaliseLevelGroups(
  levels: TnpscLevelGroup[],
  pass = LEVEL_PASS_PERCENTAGE,
): TnpscLevelGroup[] {
  const byLevel = new Map((levels ?? []).map(l => [l.level, l]));

  const groups: TnpscLevelGroup[] = TNPSC_LEVELS.map(level => {
    const l = byLevel.get(level);
    const tests = (l?.tests ?? []).map(t => ({ ...t, is_completed: isTestCleared(t, pass) }));

    // A locked level comes back with its tests hidden but its counts intact.
    const hidden = tests.length === 0 && (l?.tests_total ?? 0) > 0;
    const levelBest = l?.best_percentage ?? bestOf(tests);
    const clearedByScore = levelBest != null && levelBest >= pass;

    const testsTotal = hidden ? l!.tests_total : tests.length;
    const testsCompleted = hidden
      ? clearedByScore
        ? Math.max(1, l?.tests_completed ?? 0)
        : 0
      : tests.filter(t => t.is_completed).length;

    const isCompleted =
      testsTotal > 0 &&
      (LEVEL_UNLOCK_RULE === 'all' ? testsCompleted >= testsTotal : testsCompleted > 0);

    // The server runs its own gate, and this flag decides whether the portal
    // repeats it. With it off every level is offered.
    //
    // Note what that cannot do: a level the server has closed arrives with
    // `tests: []` and `POST .../start` answers 403 LEVEL_LOCKED regardless, so
    // opening it here shows an empty level rather than a usable one. The reason is
    // carried through either way — an empty level that is actually locked must say
    // so instead of rendering "No medium mock tests published yet" and sending the
    // aspirant to look for content that is not missing at all.
    const serverLocked = LEVEL_RESPECT_SERVER_LOCK && l?.is_unlocked === false;

    return {
      level,
      is_unlocked: !serverLocked,
      lock_reason: l?.lock_reason ?? null,
      required_percentage: pass,
      best_percentage: levelBest ?? null,
      is_completed: isCompleted,
      tests_total: testsTotal,
      tests_completed: testsCompleted,
      tests,
    };
  });

  // Local gate disabled → add nothing further; any lock still standing came from
  // the server above.
  if (!LEVEL_GATE_ENABLED) return groups;

  // Progression: a level opens only once the one before it is cleared.
  return groups.map(g => {
    const prev = previousLevel(g.level);
    if (!prev) return g;
    const prevGroup = groups[levelIndex(prev)];
    // Nothing published at the previous level → don't dead-end the aspirant.
    if (prevGroup.tests_total === 0) return g;
    if (prevGroup.is_completed) return g;
    const prevLabel = prev[0].toUpperCase() + prev.slice(1);
    const scored =
      prevGroup.best_percentage != null ? ` Your best so far is ${Math.round(prevGroup.best_percentage)}%.` : '';
    return {
      ...g,
      is_unlocked: false,
      tests: [],
      lock_reason: `Score at least ${pass}% in a ${prevLabel} level mock test to unlock this level.${scored}`,
    };
  });
}

// ─── Practice tests (syllabus based) ───────────────────────────────────────────

export async function getTnpscPracticeSubjects(
  groupId: string,
  stageId: string,
): Promise<TnpscPracticeSubject[]> {
  let tests: TnpscTest[] = [];
  try {
    const res = await userApi.get<{ subjects?: TnpscPracticeSubject[]; tests?: TnpscTest[] }>(
      `/api/v1/user/tnpsc/stages/${stageId}/practice-tests`,
    );
    if (res && Array.isArray(res.subjects)) return res.subjects;
    if (res && Array.isArray(res.tests)) tests = res.tests;
    else throw new Error('unexpected payload');
  } catch {
    tests = await deriveTests(groupId, stageId, 'practice');
  }
  return groupPracticeBySubject(groupId, stageId, tests);
}

/** Bucket practice tests under the syllabus subjects of the stage. */
export function groupPracticeBySubject(
  groupId: string,
  stageId: string,
  tests: TnpscTest[],
): TnpscPracticeSubject[] {
  const stage = findStage(groupId, stageId)?.stage;
  const subjects: TnpscPracticeSubject[] = (stage?.subjects ?? []).map(s => ({
    subject_id: s.id,
    subject_name: s.name,
    subject_name_ta: s.name_ta,
    tests: [],
  }));
  const index = new Map(subjects.map(s => [s.subject_id, s]));

  const unmatched: TnpscTest[] = [];
  for (const t of tests) {
    const bucket = t.subject_id ? index.get(t.subject_id) : undefined;
    if (bucket) bucket.tests.push(t);
    else unmatched.push(t);
  }
  if (unmatched.length > 0) {
    subjects.push({ subject_id: 'other', subject_name: 'Other Practice Sets', tests: unmatched });
  }
  return subjects;
}

// ─── Fallback derivation from the existing assessments API ─────────────────────

const STAGE_KEYWORDS: Record<string, string[]> = {
  'group-1-prelims': ['group 1', 'group-1', 'group1', 'g1', 'prelim'],
  'group-1-mains': ['group 1 main', 'group-1-main', 'mains'],
  'group-4-written': ['group 4', 'group-4', 'group4', 'g4', 'vao', 'written'],
  'gat-b-exam': ['gat-b', 'gat b', 'gatb', 'biotechnology aptitude'],
};

async function deriveTests(
  groupId: string,
  stageId: string,
  type: TnpscTestType,
): Promise<TnpscTest[]> {
  let assessments: ApiEvalAssessment[] = [];
  try {
    assessments = await getUserAssessments();
  } catch {
    return [];
  }

  const wanted = assessments.filter(a => (a.mode === 'mock' ? 'mock' : 'practice') === type);
  const hinted = wanted.filter(a => matchesStage(a.title, stageId));
  // Only fall back to "show everything" when no assessment carries a stage hint —
  // otherwise a hinted catalog would leak Group-1 papers into the Group-4 stage.
  const anyHinted = wanted.some(a => hasAnyStageHint(a.title));
  const pool = hinted.length > 0 ? hinted : anyHinted ? [] : wanted;

  return pool.map(a => toTnpscTest(a, groupId, stageId, type));
}

function hasAnyStageHint(title: string): boolean {
  return Object.keys(STAGE_KEYWORDS).some(stageId => matchesStage(title, stageId));
}

function matchesStage(title: string, stageId: string): boolean {
  const keywords = STAGE_KEYWORDS[stageId] ?? [];
  const t = (title || '').toLowerCase();
  return keywords.some(k => t.includes(k));
}

function toTnpscTest(
  a: ApiEvalAssessment,
  groupId: string,
  stageId: string,
  type: TnpscTestType,
): TnpscTest {
  const subject = type === 'practice' ? inferSubject(a.title, groupId, stageId) : null;
  return {
    test_id: a.assessment_id,
    source: 'assessment',
    title: a.title,
    group_id: groupId,
    stage_id: stageId,
    test_type: type,
    level: type === 'mock' ? DIFFICULTY_TO_LEVEL[(a.difficulty || '').toLowerCase()] ?? 'simple' : null,
    subject_id: subject?.id ?? null,
    subject_name: subject?.name ?? null,
    topic_id: null,
    topic_name: null,
    question_count: a.question_count,
    max_marks: a.max_score,
    time_limit_minutes: a.time_limit_minutes,
    negative_marking: a.negative_marking,
    negative_mark_value: a.negative_mark_value,
    price: 0,
    required_tier: null,
    is_locked: false,
    lock_reason: null,
    attempts_used: 0,
    max_attempts: a.max_attempts,
    best_percentage: null,
    is_completed: false,
  };
}

/** Best-effort subject match from the paper title against the stage syllabus. */
function inferSubject(title: string, groupId: string, stageId: string): { id: string; name: string } | null {
  const stage = findStage(groupId, stageId)?.stage;
  if (!stage) return null;
  const t = (title || '').toLowerCase();
  for (const s of stage.subjects) {
    if (t.includes(s.name.toLowerCase())) return { id: s.id, name: s.name };
    // Also try the first significant word of the subject (e.g. "Polity", "Economy").
    const head = s.name.split(/[\s/&]+/)[0].toLowerCase();
    if (head.length > 4 && t.includes(head)) return { id: s.id, name: s.name };
  }
  return null;
}

// ─── Attempt-history enrichment ────────────────────────────────────────────────

export interface AttemptSummary {
  test_id: string;
  percentage: number | null;
  status: string;
}

/**
 * Overlay locally-known attempt history onto derived tests so the level gate works
 * even before the backend returns `is_completed` / `best_percentage`.
 */
export function applyAttemptHistory(
  tests: TnpscTest[],
  attempts: AttemptSummary[],
  pass = LEVEL_PASS_PERCENTAGE,
): TnpscTest[] {
  const byTest = new Map<string, { count: number; best: number | null }>();
  for (const at of attempts) {
    if (at.status === 'in_progress') continue;
    const cur = byTest.get(at.test_id) ?? { count: 0, best: null };
    cur.count += 1;
    if (at.percentage != null) cur.best = cur.best == null ? at.percentage : Math.max(cur.best, at.percentage);
    byTest.set(at.test_id, cur);
  }
  return tests.map(t => {
    const rec = byTest.get(t.test_id);
    if (!rec) return t;
    // Prefer whichever score is higher — the server may not have caught up with
    // an attempt this session already knows about.
    const best =
      t.best_percentage == null
        ? rec.best
        : rec.best == null
        ? t.best_percentage
        : Math.max(t.best_percentage, rec.best);
    const attempts = Math.max(t.attempts_used, rec.count);
    return {
      ...t,
      attempts_used: attempts,
      best_percentage: best,
      // A known score is decisive in both directions: reaching the pass mark clears
      // the paper, falling short leaves it uncleared however it arrived flagged.
      is_completed: isTestCleared({ ...t, attempts_used: attempts, best_percentage: best }, pass),
    };
  });
}

/** Route the aspirant to the correct take-flow for a paper. */
export function testHref(t: TnpscTest): string {
  return t.source === 'test' ? `/user/test/${t.test_id}/start` : `/user/assessment/${t.test_id}`;
}
