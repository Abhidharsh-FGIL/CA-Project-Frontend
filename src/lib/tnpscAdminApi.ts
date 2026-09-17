/**
 * Admin-side TNPSC helpers — tagging papers into the group → stage → track → level
 * hierarchy so they surface in the aspirant portal.
 *
 * A paper (test or eval assessment) is invisible to the TNPSC endpoints until it
 * carries `tnpsc_stage_id` + `track` (+ `tnpsc_level` for mock / `tnpsc_subject_id`
 * for practice). Everything here exists to set those five fields.
 *
 * Endpoints (see TNPSC_API_SPEC.md §6.2, §6.3, §6.6):
 *   PATCH /api/v1/evaluation/assessments/{id}/tnpsc
 *   PATCH /api/v1/admin/tests/{id}/tnpsc
 *   POST  /api/v1/admin/tnpsc/bulk-tag
 *   GET   /api/v1/admin/tnpsc/coverage?stage_id=
 */
import { api } from './api';
import {
  PRACTICE_MAX_QUESTIONS,
  PRACTICE_MIN_QUESTIONS,
  TNPSC_GROUPS,
  findStage,
  type TnpscLevel,
  type TnpscTestType,
} from '@/config/tnpsc';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface TnpscTagValue {
  group_id: string | null;
  stage_id: string | null;
  track: TnpscTestType | null;
  level: TnpscLevel | null;
  subject_id: string | null;
  topic_id: string | null;
}

export const EMPTY_TAG: TnpscTagValue = {
  group_id: null,
  stage_id: null,
  track: null,
  level: null,
  subject_id: null,
  topic_id: null,
};

/** Wire shape sent to the backend — `group_id` is derivable from `stage_id`, sent for clarity. */
interface TnpscTagPayload {
  stage_id: string | null;
  track: TnpscTestType | null;
  level: TnpscLevel | null;
  subject_id: string | null;
  topic_id: string | null;
}

function toPayload(tag: TnpscTagValue): TnpscTagPayload {
  return {
    stage_id: tag.stage_id,
    track: tag.track,
    level: tag.track === 'mock' ? tag.level : null,
    subject_id: tag.track === 'practice' ? tag.subject_id : null,
    topic_id: tag.track === 'practice' ? tag.topic_id : null,
  };
}

// ─── Read tags off an API row ──────────────────────────────────────────────────

/**
 * Normalise the TNPSC tags off an assessment/test row. Tolerates both the
 * `tnpsc_*` prefixed column names and the bare names, since the two backends
 * (evaluation hub vs admin tests) may not converge on one spelling.
 */
export function readTnpscTag(row: any): TnpscTagValue {
  if (!row) return { ...EMPTY_TAG };
  const stage_id = row.tnpsc_stage_id ?? row.stage_id ?? null;
  const track = (row.track ?? row.test_track ?? null) as TnpscTestType | null;
  const level = (row.tnpsc_level ?? row.level ?? null) as TnpscLevel | null;
  const subject_id = row.tnpsc_subject_id ?? row.subject_id ?? null;
  const topic_id = row.tnpsc_topic_id ?? row.topic_id ?? null;
  const group_id = row.tnpsc_group_id ?? row.group_id ?? groupOfStage(stage_id);
  return { group_id, stage_id, track, level, subject_id, topic_id };
}

export function groupOfStage(stageId: string | null): string | null {
  if (!stageId) return null;
  for (const g of TNPSC_GROUPS) {
    if (g.stages.some(s => s.id === stageId)) return g.id;
  }
  return null;
}

export function isTagged(tag: TnpscTagValue): boolean {
  return !!tag.stage_id && !!tag.track;
}

/** Short human label for a badge, e.g. "G1 Prelims · Mock · Simple". */
export function describeTag(tag: TnpscTagValue): string | null {
  if (!isTagged(tag)) return null;
  const found = findStage(tag.group_id ?? groupOfStage(tag.stage_id) ?? undefined, tag.stage_id ?? undefined);
  const stageLabel = found ? `${found.group.short_name} ${found.stage.short_name}` : tag.stage_id!;
  const trackLabel = tag.track === 'mock' ? 'Mock' : 'Practice';
  const tail =
    tag.track === 'mock'
      ? tag.level
        ? ` · ${tag.level[0].toUpperCase()}${tag.level.slice(1)}`
        : ''
      : tag.subject_id
      ? ` · ${subjectName(tag) ?? tag.subject_id}`
      : '';
  return `${stageLabel} · ${trackLabel}${tail}`;
}

/**
 * The generator's `test_type`, e.g. "TNPSC Group 4" or "GAT-B" — the value that
 * switches the backend into that exam's style (TNPSC: 5 options with
 * "விடை தெரியவில்லை" as option E; GAT-B: 4 options, English, negative marking).
 *
 * Read off the group rather than composed from its name — not every exam in the
 * catalog is a TNPSC group. Must match both BOARDS in src/constants.ts and the
 * EXAM_SYLLABUS keys.
 */
export function examTypeLabel(tag: TnpscTagValue): string | null {
  const found = findStage(tag.group_id ?? groupOfStage(tag.stage_id) ?? undefined, tag.stage_id ?? undefined);
  if (!found) return null;
  return found.group.exam_type;
}

export function subjectName(tag: TnpscTagValue): string | null {
  const found = findStage(tag.group_id ?? groupOfStage(tag.stage_id) ?? undefined, tag.stage_id ?? undefined);
  return found?.stage.subjects.find(s => s.id === tag.subject_id)?.name ?? null;
}

// ─── Validation (mirrors the server matrix in TNPSC_API_SPEC.md §7.8) ─────────

export interface TagValidation {
  /** Blocking problems — the paper will be rejected or will not show up. */
  errors: string[];
  /** Non-blocking mismatches worth surfacing before publish. */
  warnings: string[];
  ok: boolean;
}

export function validateTnpscTag(tag: TnpscTagValue, questionCount?: number): TagValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!tag.stage_id) errors.push('Select the examination stage.');
  if (!tag.track) errors.push('Select the track — Mock Test or Practice Test.');

  const found = findStage(tag.group_id ?? groupOfStage(tag.stage_id) ?? undefined, tag.stage_id ?? undefined);
  if (tag.stage_id && !found) errors.push(`Unknown stage "${tag.stage_id}".`);
  if (found && found.stage.status !== 'active') {
    errors.push(`${found.stage.name} is not open yet — papers tagged to it stay hidden.`);
  }

  if (tag.track === 'mock') {
    if (!tag.level) errors.push('A mock test must be assigned a level (Simple / Medium / Complex).');
    // The question-count-vs-pattern warning was removed by request. The "Apply pattern"
    // button on the placement card still offers the full-length shape in one click.
  }

  if (tag.track === 'practice') {
    if (!tag.subject_id) errors.push('A practice test must be assigned a syllabus subject.');
    if (tag.subject_id && found && !found.stage.subjects.some(s => s.id === tag.subject_id)) {
      errors.push('That subject does not belong to the selected stage.');
    }
    if (questionCount != null && (questionCount < PRACTICE_MIN_QUESTIONS || questionCount > PRACTICE_MAX_QUESTIONS)) {
      warnings.push(
        `Practice sets must be ${PRACTICE_MIN_QUESTIONS}–${PRACTICE_MAX_QUESTIONS} questions — this one has ${questionCount}.`,
      );
    }
  }

  return { errors, warnings, ok: errors.length === 0 };
}

// ─── Write ─────────────────────────────────────────────────────────────────────

/** PATCH the TNPSC tags onto an Evaluation-Hub assessment. */
export function tagAssessment(assessmentId: string, tag: TnpscTagValue): Promise<any> {
  return api.patch(`/api/v1/evaluation/assessments/${assessmentId}/tnpsc`, toPayload(tag));
}

/** PATCH the TNPSC tags onto an admin-managed test. */
export function tagTest(testId: string, tag: TnpscTagValue): Promise<any> {
  return api.patch(`/api/v1/admin/tests/${testId}/tnpsc`, toPayload(tag));
}

export interface BulkTagResult {
  updated: number;
  skipped?: Array<{ id: string; reason: string }>;
}

export function bulkTag(
  target: 'tests' | 'assessments' | 'questions',
  ids: string[],
  tag: TnpscTagValue,
): Promise<BulkTagResult> {
  return api.post<BulkTagResult>('/api/v1/admin/tnpsc/bulk-tag', {
    target,
    ids,
    ...toPayload(tag),
  });
}

// ─── Coverage ──────────────────────────────────────────────────────────────────

export interface CoverageSubject {
  subject_id: string;
  subject_name?: string;
  topics_total: number;
  topics_with_sets: number;
  sets: number;
  questions_tagged?: number;
}

export interface StageCoverage {
  stage_id: string;
  mock: Record<TnpscLevel, number>;
  practice: { subjects: CoverageSubject[] };
  gaps?: string[];
  /** false when the numbers were counted in the browser rather than by the server. */
  server_computed: boolean;
}

/** GET the server-computed coverage; callers fall back to `computeCoverage` on failure. */
export async function getTnpscCoverage(stageId: string): Promise<StageCoverage | null> {
  try {
    const res = await api.get<StageCoverage>(`/api/v1/admin/tnpsc/coverage?stage_id=${stageId}`);
    if (res && res.mock) return { ...res, server_computed: true };
  } catch {
    /* endpoint not built yet */
  }
  return null;
}

/**
 * Count coverage from a list of assessment rows already loaded in the browser.
 * Used until GET /admin/tnpsc/coverage exists.
 */
export function computeCoverage(stageId: string, rows: any[]): StageCoverage {
  const stage = findStage(groupOfStage(stageId) ?? undefined, stageId)?.stage;
  const tagged = rows.map(readTnpscTag).map((t, i) => ({ tag: t, row: rows[i] }));
  const forStage = tagged.filter(x => x.tag.stage_id === stageId);

  const mock: Record<TnpscLevel, number> = { simple: 0, medium: 0, complex: 0 };
  for (const x of forStage) {
    if (x.tag.track === 'mock' && x.tag.level) mock[x.tag.level] += 1;
  }

  const subjects: CoverageSubject[] = (stage?.subjects ?? []).map(s => {
    const sets = forStage.filter(x => x.tag.track === 'practice' && x.tag.subject_id === s.id);
    const topics = new Set(sets.map(x => x.tag.topic_id).filter(Boolean) as string[]);
    return {
      subject_id: s.id,
      subject_name: s.name,
      topics_total: s.topics.length,
      topics_with_sets: topics.size,
      sets: sets.length,
    };
  });

  return { stage_id: stageId, mock, practice: { subjects }, server_computed: false };
}
