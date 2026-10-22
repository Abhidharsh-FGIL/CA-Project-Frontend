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
  LEVELS_HIDDEN,
  LEVEL_META,
  MIXED_LABEL,
  PRACTICE_MAX_QUESTIONS,
  PRACTICE_MIN_QUESTIONS,
  TNPSC_GROUPS,
  findStage,
  findUnit,
  unitDisplayName,
  subjectForUnit,
  unitTopics,
  type TnpscLevel,
  type TnpscTestType,
} from '@/config/tnpsc';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface TnpscTagValue {
  group_id: string | null;
  stage_id: string | null;
  track: TnpscTestType | null;
  level: TnpscLevel | null;
  /**
   * The published syllabus unit this paper belongs to — "Unit IV: Indian Polity".
   *
   * The aspirant portal lists practice by unit, so this is what decides where a
   * paper appears. `subject_id` is kept alongside and filled from the unit, since
   * the backend's existing contract is written against it and a unit can span two
   * catalog subjects.
   */
  unit_id: string | null;
  subject_id: string | null;
  topic_id: string | null;
  /**
   * How much of the syllabus this paper stands for.
   *
   * `unit` — one published unit, optionally at one difficulty.
   * `section` — a whole printed section (General Studies, General Tamil, …).
   *
   * A section paper and a Full Unit paper are both *whole* papers, so both are
   * composed to the 20/30/50 blend rather than filtered to a single difficulty.
   * Exams are always whole papers and carry no scope of their own.
   */
  scope: TnpscScope | null;
  /** The section a `section`-scoped paper covers, by its printed name. */
  section_name: string | null;
  /**
   * Which language paper an exam is sat in.
   *
   * Group 4's paper is General Studies + Aptitude plus *one* of General Tamil or
   * General English, never both — so a full mock has to say which.
   */
  language: TnpscExamLanguage | null;
}

/**
 * Practice covers a whole printed section, one unit, or one key topic of a unit.
 *
 * `topic` exists in the form and the portal, not on the wire: the server knows a unit paper that
 * names a topic (`scope: 'unit'` with a `topic_id`), and that is what a key-topic paper is saved as.
 * `toPayload` writes it that way and `readTnpscTag` reads it back.
 */
export type TnpscScope = 'unit' | 'section' | 'topic';

export type TnpscExamLanguage = 'tamil' | 'english';

export const EMPTY_TAG: TnpscTagValue = {
  group_id: null,
  stage_id: null,
  track: null,
  level: null,
  unit_id: null,
  subject_id: null,
  topic_id: null,
  scope: null,
  section_name: null,
  language: null,
};

/** Wire shape sent to the backend — `group_id` is derivable from `stage_id`, sent for clarity. */
interface TnpscTagPayload {
  stage_id: string | null;
  track: TnpscTestType | null;
  level: TnpscLevel | null;
  unit_id: string | null;
  subject_id: string | null;
  topic_id: string | null;
  scope: TnpscScope | null;
  section_name: string | null;
  language: TnpscExamLanguage | null;
}

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

/**
 * The id of a key topic *within the unit it is filed under*.
 *
 * The form holds the chosen category as the bank names it ("Figures of speech"). Sent as it is, the server turns the
 * name into a slug and finds the first topic of that name in the whole syllabus — and a name can be printed under
 * two units: "Figures of speech" is a Vocabulary topic (figures-of-speech) and a Literary Works topic
 * (en-figures-of-speech). A paper filed under Literary Works was then refused: the topic belonged to Vocabulary.
 * The unit decides, so the topic is resolved against the unit's own list. A value that is already one of that
 * unit's ids is left alone, and one the unit does not list is passed on unchanged for the server to judge.
 */
export function topicIdForUnit(
  stage: Parameters<typeof findUnit>[0],
  unitId: string | null | undefined,
  topic: string | null | undefined,
): string | null {
  if (!topic) return null;
  const unit = findUnit(stage, unitId);
  if (!unit) return topic;
  const topics = unitTopics(stage, unit);
  if (topics.some(t => t.id === topic)) return topic;
  const key = norm(topic);
  return topics.find(t => norm(t.name) === key || norm(t.id) === key)?.id ?? topic;
}

function toPayload(tag: TnpscTagValue): TnpscTagPayload {
  /*
   * The subject is derived here as well as in the form.
   *
   * The backend's practice endpoints filter on it, so it has to be right
   * whatever built the tag — a form, `readTnpscTag` over an older row, or a bulk
   * action. Deriving it once at the edge is cheaper than trusting every caller.
   */
  const stage = findStage(
    tag.group_id ?? groupOfStage(tag.stage_id) ?? undefined,
    tag.stage_id ?? undefined,
  )?.stage;
  const derivedSubject =
    tag.subject_id ?? subjectForUnit(stage, findUnit(stage, tag.unit_id)) ?? null;

  return {
    stage_id: tag.stage_id,
    track: tag.track,
    // Both tracks carry a level now. A mock's level gates progression; a
    // practice paper's decides which of a unit's difficulty buttons it sits
    // behind, and may be null for a set that covers the whole unit.
    //
    // The server refuses a mock without one (422 LEVEL_REQUIRED), so a mock that
    // was never asked — the form no longer does while the portal shows a single
    // level — is filed under the lowest, which is the group that is shown.
    level: tag.track === 'mock' ? (tag.level ?? 'simple') : tag.level,
    // A unit belongs to a unit- or topic-scoped practice paper and nothing else.
    unit_id: tag.track === 'practice' && (tag.scope === 'unit' || tag.scope === 'topic') ? tag.unit_id : null,
    subject_id: tag.track === 'practice' ? derivedSubject : null,
    // A whole-unit paper has no topic; the topic is what makes a paper a key-topic paper.
    topic_id: tag.track === 'practice' && tag.scope === 'topic' ? topicIdForUnit(stage, tag.unit_id, tag.topic_id) : null,
    // A key-topic paper is saved as a unit paper that names its topic.
    scope: tag.track === 'practice' ? (tag.scope === 'topic' ? 'unit' : tag.scope) : null,
    section_name: tag.track === 'practice' && tag.scope === 'section' ? tag.section_name : null,
    language: tag.track === 'mock' ? tag.language : null,
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
  const unit_id = row.tnpsc_unit_id ?? row.unit_id ?? null;
  const section_name = row.tnpsc_section_name ?? row.section_name ?? null;
  const language = (row.tnpsc_language ?? row.language ?? null) as TnpscExamLanguage | null;
  // A row from before scopes existed still knows which it is: a unit id means
  // unit-scoped, a section name means section-scoped.
  const rawScope = (row.tnpsc_scope ?? row.scope ?? (unit_id ? 'unit' : section_name ? 'section' : null)) as
    | TnpscScope
    | null;
  const subject_id = row.tnpsc_subject_id ?? row.subject_id ?? null;
  const topic_id = row.tnpsc_topic_id ?? row.topic_id ?? null;
  // A unit paper that names a topic is a key-topic paper.
  const scope: TnpscScope | null = rawScope === 'unit' && topic_id ? 'topic' : rawScope;
  const group_id = row.tnpsc_group_id ?? row.group_id ?? groupOfStage(stage_id);
  return {
    group_id,
    stage_id,
    track,
    level,
    unit_id,
    subject_id,
    topic_id,
    scope,
    section_name,
    language,
  };
}

export function groupOfStage(stageId: string | null): string | null {
  if (!stageId) return null;
  for (const g of TNPSC_GROUPS) {
    if (g.stages.some(s => s.id === stageId)) return g.id;
  }
  return null;
}

/**
 * Whether the server's list says anything about placement at all.
 *
 * `GET /evaluation/assessments` does not return the TNPSC fields (BACKEND_WORK.md item 4),
 * so every row reads as untagged whether it is placed or not. A badge that says "Not
 * placed" on forty papers, some of which are placed, is worse than no badge: it sends the
 * admin to re-place work that is done. If no row carries any placement field, the list
 * cannot tell, and should say so.
 */
export function listReportsPlacement(rows: any[] | null | undefined): boolean {
  return (rows ?? []).some(
    r => r && (r.tnpsc_stage_id != null || r.stage_id != null || r.track != null || r.test_track != null),
  );
}

export function isTagged(tag: TnpscTagValue): boolean {
  return !!tag.stage_id && !!tag.track;
}

/** Short human label for a badge, e.g. "G1 Prelims · Mock · Simple". */
export function describeTag(tag: TnpscTagValue): string | null {
  if (!isTagged(tag)) return null;
  const found = findStage(tag.group_id ?? groupOfStage(tag.stage_id) ?? undefined, tag.stage_id ?? undefined);
  const stageLabel = found ? `${found.group.short_name} ${found.stage.short_name}` : tag.stage_id!;
  const trackLabel = tag.track === 'mock' ? 'Exam' : 'Practice';
  const levelLabel = tag.level ? LEVEL_META[tag.level].label : null;

  // A practice paper now names the unit it is filed under and the difficulty
  // button it sits behind — "G4 Written · Practice · Indian Polity · Simple" —
  // because those are the two things that decide where an aspirant finds it.
  const parts: string[] = [stageLabel, trackLabel];
  if (tag.track === 'practice') {
    const unit = found ? findUnit(found.stage, tag.unit_id) : undefined;
    const unitLabel = (unit && unitDisplayName(found?.stage, unit)) || subjectName(tag) || tag.subject_id;
    const topic =
      tag.scope === 'topic' && tag.topic_id && found && unit
        ? unitTopics(found.stage, unit).find(t => t.id === tag.topic_id)?.name
        : undefined;
    const where = topic && unitLabel ? `${unitLabel}: ${topic}` : unitLabel;
    if (where) parts.push(where);
    parts.push(levelLabel ?? MIXED_LABEL);
  } else if (levelLabel && !LEVELS_HIDDEN) {
    // A mock is composed across all three difficulties, so naming one of them on it
    // is only honest while the portal tells the levels apart.
    parts.push(levelLabel);
  }
  return parts.join(' · ');
}

/**
 * A name for a paper, written from its placement.
 *
 * The placement cascade already says exactly what a paper is — which exam, which
 * track, which unit or section, which difficulty — so making the admin invent a
 * title for it is asking them to restate what they just chose, and invites the
 * inconsistent naming that makes a list of two hundred papers unreadable.
 *
 * Returned as a suggestion, not a rule: the field stays editable and stops being
 * overwritten the moment it is typed in.
 *
 * Examples:
 *   TNPSC Group 4 — Indian Polity · Simple
 *   TNPSC Group 4 — Indian Polity: Fundamental Rights · Mixed
 *   TNPSC Group 4 — General Studies · Full Set
 *   TNPSC Group 4 — Full Mock (Tamil) · Complex
 */
export function suggestAssessmentTitle(tag: TnpscTagValue): string | null {
  const found = findStage(
    tag.group_id ?? groupOfStage(tag.stage_id) ?? undefined,
    tag.stage_id ?? undefined,
  );
  if (!found || !tag.track) return null;

  const { group, stage } = found;
  /*
   * The stage earns a mention where the group has more than one — counted across
   * the whole catalog, not just the open ones. Counting open stages would name
   * Group 1 papers "TNPSC Group 1" today and "TNPSC Group 1 Prelims" the day Mains
   * opens, leaving two naming conventions in one list and no way to sort it.
   */
  const head = group.stages.length > 1 ? `${group.name} ${stage.short_name}` : group.name;

  const levelLabel = tag.level ? LEVEL_META[tag.level].label : null;
  const parts: string[] = [];

  if (tag.track === 'mock') {
    const lang = tag.language === 'tamil' ? 'Tamil' : tag.language === 'english' ? 'English' : null;
    parts.push(lang ? `Full Mock (${lang})` : 'Full Mock');
    // "Simple" on a paper that is 20% Simple, 30% Medium and 50% Complex is a
    // mislabel, so the level is left off while the portal shows no levels.
    if (levelLabel && !LEVELS_HIDDEN) parts.push(levelLabel);
  } else if (tag.scope === 'section') {
    if (!tag.section_name) return null;
    parts.push(tag.section_name, 'Full Set');
  } else {
    const unit = findUnit(stage, tag.unit_id);
    if (!unit) return null;
    // A key topic is named by its bank category, which is not always a printed topic.
    const topic = tag.topic_id
      ? (unitTopics(stage, unit).find(t => t.id === tag.topic_id)?.name ?? tag.topic_id)
      : undefined;
    const unitName = unitDisplayName(stage, unit);
    parts.push(topic ? `${unitName}: ${topic}` : unitName);
    parts.push(levelLabel ?? MIXED_LABEL);
  }

  return `${head} — ${parts.join(' · ')}`;
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
    // Not asked while the portal shows one level — `toPayload` fills it in.
    if (!tag.level && !LEVELS_HIDDEN) errors.push('An exam must be assigned a level (Simple / Medium / Complex).');
    // The question-count-vs-pattern warning was removed by request. The "Apply pattern"
    // button on the placement card still offers the full-length shape in one click.
  }

  if (tag.track === 'mock' && found?.stage.pattern?.sections.some(sec => sec.alternative_to)) {
    // Group 4's paper is sat in one language or the other, so a full mock has to
    // say which — the two have different units and different splits.
    if (!tag.language) errors.push('Choose the language this exam is sat in.');
  }

  if (tag.track === 'practice') {
    if (!tag.scope) errors.push('Choose whether this covers one unit, one key topic or a whole section.');
  }

  if (tag.track === 'practice' && tag.scope === 'section') {
    if (!tag.section_name) errors.push('Select the section this paper covers.');
    if (
      tag.section_name &&
      found &&
      !found.stage.pattern?.sections.some(sec => sec.name === tag.section_name)
    ) {
      errors.push('That section does not belong to the selected stage.');
    }
  }

  if (tag.track === 'practice' && (tag.scope === 'unit' || tag.scope === 'topic')) {
    // The unit is what the portal lists unit-wise practice by, so it is required.
    // `subject_id` is derived from it and still checked, because the backend's
    // practice endpoints filter on the subject.
    if (!tag.unit_id) errors.push('A unit-wise practice test must be assigned a syllabus unit.');
    if (tag.unit_id && found && !findUnit(found.stage, tag.unit_id)) {
      errors.push('That unit does not belong to the selected stage.');
    }
    // The subject is derived from the unit where the unit does not name one, so
    // this only fires when neither says anything — never on a complete form.
    const subject =
      tag.subject_id ?? subjectForUnit(found?.stage, findUnit(found?.stage, tag.unit_id));
    if (!subject) errors.push('A practice test must be assigned a syllabus subject.');
    if (subject && found && !found.stage.subjects.some(s => s.id === subject)) {
      errors.push('That subject does not belong to the selected stage.');
    }
    // A unit publishes its own question count; a set far off it is worth flagging.
    const unit = tag.unit_id && found ? findUnit(found.stage, tag.unit_id) : undefined;
    // A level is optional on practice: without one the set covers the whole unit
    // and sits behind "Full Unit" rather than a difficulty button.
    if (unit && tag.scope === 'unit' && questionCount != null && questionCount < unit.questions) {
      warnings.push(
        `${unitDisplayName(found?.stage, unit)} carries ${unit.questions} questions in the real paper — this set has ${questionCount}.`,
      );
    }
    // A key-topic paper is a small set by nature, so the unit's size says nothing about it. Its topic is the
    // bank category it is drawn from, so it only has to be named.
    if (tag.scope === 'topic' && !tag.topic_id) errors.push('Pick the category this paper is drawn from.');
    if (questionCount != null && (questionCount < PRACTICE_MIN_QUESTIONS || questionCount > PRACTICE_MAX_QUESTIONS)) {
      // A warning, not a rule — "must" promised an enforcement that is not there.
      warnings.push(
        `Practice sets are usually ${PRACTICE_MIN_QUESTIONS}–${PRACTICE_MAX_QUESTIONS} questions — this one has ${questionCount}.`,
      );
    }
  }

  return { errors, warnings, ok: errors.length === 0 };
}

// ─── Write ─────────────────────────────────────────────────────────────────────

/**
 * What to tell an admin whose placement was refused.
 *
 * Two different failures used to read the same. A server that does not have the
 * endpoint answers 404 "Not Found"; a server that has it and does not know the
 * *subject* answers 404 `SUBJECT_NOT_FOUND`. The first means "wait for a deploy",
 * the second means "the stage is missing a subject" — and telling someone the
 * endpoint is not deployed when it is sends them to the wrong team.
 */
export function describeTagError(err: any, tag: TnpscTagValue): string {
  const message: string = typeof err?.message === 'string' ? err.message : '';
  const code: string | undefined = err?.code ?? err?.detail?.error_code;

  if (code === 'SUBJECT_NOT_FOUND' || /has no subject/i.test(message)) {
    const slug = message.match(/subject '([^']+)'/)?.[1];
    const found = findStage(tag.group_id ?? groupOfStage(tag.stage_id) ?? undefined, tag.stage_id ?? undefined);
    const name = slug ? (found?.stage.subjects.find(s => s.id === slug)?.name ?? slug) : 'this';
    const where = found ? `${found.group.name} ${found.stage.short_name}` : 'that exam';
    return (
      `The server has no “${name}” subject under ${where} yet, so this paper could not be placed. ` +
      `The paper itself is saved. Once the backend adds that subject (BACKEND_WORK.md, item 13), ` +
      `place it from the Assessments tab.`
    );
  }

  if (err?.status === 404 && !code && /^not found$/i.test(message.trim())) {
    return 'The tagging endpoint is not available on the server yet (PATCH /evaluation/assessments/{id}/tnpsc).';
  }

  return message || 'The placement could not be saved.';
}

/** Whether the server refused a topic because it has no row for it under the subject. */
export function isUnknownTopicError(err: any): boolean {
  const message: string = typeof err?.message === 'string' ? err.message : '';
  const code: string | undefined = err?.code ?? err?.detail?.error_code;
  return (
    code === 'TNPSC_TOPIC_MISMATCH' ||
    code === 'TOPIC_NOT_FOUND' ||
    code === 'TOPIC_NOT_IN_UNIT' ||
    /has no topic/i.test(message) ||
    // "Topic 'x' is printed under unit 'a', not 'b'" — the topic exists, but under another unit.
    /is printed under unit/i.test(message)
  );
}

/**
 * Place an assessment, keeping a key-topic paper that the server will not take as one.
 *
 * The server checks a topic against its own list for the subject, and that list is not the syllabus's
 * printed topics ("Forest and wildlife" is not among Geography of India's five). Refusing the whole
 * placement left a paper created and placed nowhere. Instead a refused key topic is saved as a plain
 * unit paper, and its title — "Geography: Forest and wildlife" — is what carries the topic; the portal
 * reads it back from there (`tnpsc-title-placement.ts`). `topicInTitleOnly` says that happened.
 */
export async function tagAssessmentKeepingTopic(
  assessmentId: string,
  tag: TnpscTagValue,
): Promise<{ topicInTitleOnly: boolean }> {
  try {
    await tagAssessment(assessmentId, tag);
    return { topicInTitleOnly: false };
  } catch (err) {
    if (tag.scope !== 'topic' || !isUnknownTopicError(err)) throw err;
    await tagAssessment(assessmentId, { ...tag, scope: 'unit', topic_id: null });
    return { topicInTitleOnly: true };
  }
}

/** PATCH the TNPSC tags onto an Evaluation-Hub assessment. */
export function tagAssessment(assessmentId: string, tag: TnpscTagValue): Promise<any> {
  return api.patch(`/api/v1/evaluation/assessments/${assessmentId}/tnpsc`, toPayload(tag));
}

/** PATCH the TNPSC tags onto an admin-managed test. */
export function tagTest(testId: string, tag: TnpscTagValue): Promise<any> {
  return api.patch(`/api/v1/admin/tests/${testId}/tnpsc`, toPayload(tag));
}

/**
 * Record what a collection actually contains.
 *
 * Collections are where this belongs rather than assessments: a collection is the
 * content and an assessment is one publication of it, so fixing the collection
 * fixes every assessment built from it afterwards — and there is one collection
 * where there may be a dozen assessments.
 *
 * `PATCH /api/v1/evaluation/papers/{id}` already exists (the Collections list
 * renames through it). Accepting `difficulty` and `tnpsc_level` on it is the whole
 * backend change — see TNPSC_RECLASSIFY.md §3. Callers should treat 404/405/422 as
 * "not supported yet" rather than as a failure.
 */
export function setPaperClassification(
  paperId: string,
  patch: { difficulty?: string; tnpsc_level?: TnpscLevel },
): Promise<any> {
  return api.patch(`/api/v1/evaluation/papers/${paperId}`, patch);
}

/**
 * File a collection under a syllabus unit — the Collections tab's "Move to unit".
 *
 * Sent to the same `PATCH /api/v1/evaluation/papers/{id}` the list already renames through. The backend needs to
 * store `stage_id`, `unit_id` and `section_name` on the collection and return them from the list (see
 * COLLECTION_HIERARCHY.md). Until it does the call is refused (404/405/422), which callers treat as "not
 * supported yet" via `isUnsupportedPatch`.
 */
export function setPaperPlacement(
  paperId: string,
  placement: { groupId: string; stageId: string; unitId: string | null; sectionName: string | null },
): Promise<any> {
  return api.patch(`/api/v1/evaluation/papers/${paperId}`, {
    group_id: placement.groupId,
    stage_id: placement.stageId,
    unit_id: placement.unitId,
    section_name: placement.sectionName,
  });
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
