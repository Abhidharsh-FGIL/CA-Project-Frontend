/**
 * Bridges an exam's configuration into the report models.
 *
 * Both report specs require the same thing: TNPSC Group 4 is the reference, but
 * subjects, topics, scoring rules and paper structure must come from the selected
 * exam's configuration rather than be written into the report code. The models
 * were already exam-neutral — they derive subjects from whatever the responses
 * carry — but neutral is not the same as configured. Nothing was telling them
 * that this paper has negative marking, runs for three hours, or has a syllabus
 * with subjects the student skipped entirely.
 *
 * This module answers those questions from the catalog, which is itself server-
 * mergeable (`GET /api/v1/user/tnpsc/catalog`), so adding an exam is a data change
 * rather than a code change.
 */
import { findGroup, findStage, TNPSC_GROUPS, type TnpscExamPattern, type TnpscGroup, type TnpscStage } from '@/config/tnpsc';

/** One node of the exam's configured syllabus, independent of what was tested. */
export interface ExamTaxonomyNode {
  id: string;
  name: string;
  nameLocal?: string;
  /**
   * Other wordings a paper may tag this subject with.
   *
   * Papers do not use the catalog's phrasing, so matching on the canonical name
   * alone leaves a question's subject unresolved — which costs it the catalog's
   * English label as well as its section marking.
   */
  aliases?: string[];
  topics: Array<{ id: string; name: string }>;
}

/** How this paper is marked — read from configuration, never assumed. */
export interface MarkingScheme {
  negativeMarking: boolean;
  /** Deduction per wrong answer. Null when the scheme applies but the value varies by section. */
  negativeMarkValue: number | null;
  /** Marks per correct answer, when the paper is uniform. */
  marksPerQuestion: number | null;
  /** True when sections disagree about the deduction, so one figure cannot describe the paper. */
  perSectionNegative: boolean;
}

export interface ExamContext {
  examId: string | null;
  examName: string | null;
  stageId: string | null;
  stageName: string | null;
  /**
   * How this exam presents itself — the body that conducts it, its official
   * title, the posts it recruits for, and the gradient its card wears.
   *
   * Read by the report cover, which used to carry a hardcoded motif and a Tamil
   * motto: correct for one exam and wrong for every other, and telling an
   * aspirant nothing about the paper in front of them.
   */
  authority: string | null;
  tagline: string | null;
  stageDescription: string | null;
  /** Posts this exam recruits for. Empty where the exam is not a recruitment one. */
  posts: string[];
  /** The exam's own Tailwind gradient, so the cover is tinted by exam. */
  accent: string | null;
  /**
   * Every subject the exam configures — including ones this paper did not test.
   * Lets the report say "not assessed" about a configured subject instead of
   * silently omitting it.
   */
  taxonomy: ExamTaxonomyNode[];
  marking: MarkingScheme | null;
  /** Questions the paper is configured to carry. */
  totalQuestions: number | null;
  totalMarks: number | null;
  /** Allowed duration, so the report can show time used against time allowed. */
  durationSec: number | null;
}

function markingFrom(pattern: TnpscExamPattern | undefined): MarkingScheme | null {
  if (!pattern) return null;

  const sectionValues = new Set(
    pattern.sections.map(s => s.negative_mark_value ?? pattern.negative_mark_value ?? null),
  );
  const perSectionNegative = pattern.negative_marking && sectionValues.size > 1;

  const uniformMarks = new Set(
    pattern.sections.map(s => s.marks_per_question ?? null).filter(v => v != null),
  );

  return {
    negativeMarking: !!pattern.negative_marking,
    negativeMarkValue: perSectionNegative ? null : pattern.negative_mark_value ?? null,
    marksPerQuestion: uniformMarks.size === 1 ? [...uniformMarks][0]! : null,
    perSectionNegative,
  };
}

/**
 * Resolve the exam context for an attempt.
 *
 * Attempts carry no `group_id` or `stage_id` (the gap flagged to the backend), so
 * the caller supplies whatever it knows — typically the aspirant's registered exam
 * or the group they are browsing. With nothing to go on this returns null and the
 * reports fall back to product defaults, which is the behaviour they had before.
 */
export function resolveExamContext(
  opts: { groupId?: string | null; stageId?: string | null },
  catalog: TnpscGroup[] = TNPSC_GROUPS,
): ExamContext | null {
  const { groupId, stageId } = opts;
  if (!groupId && !stageId) return null;

  const found = findStage(groupId ?? undefined, stageId ?? undefined, catalog);

  // A caller usually knows the exam but not which stage an attempt belonged to —
  // attempts carry no stage id. Fall back to the group's only open stage, which is
  // unambiguous for a single-stage exam and the common case for the rest.
  let group: TnpscGroup | undefined = found?.group;
  let stage: TnpscStage | undefined = found?.stage;
  if (!stage && groupId) {
    group = findGroup(groupId, catalog);
    const open = group?.stages.filter(st => st.status === 'active') ?? [];
    stage = open.length === 1 ? open[0] : undefined;
  }
  if (!group || !stage) return null;
  const pattern = stage.pattern;

  return {
    examId: group.id,
    examName: group.name,
    stageId: stage.id,
    stageName: stage.name,
    authority: group.authority ?? null,
    tagline: group.tagline ?? null,
    stageDescription: stage.description ?? null,
    posts: group.posts ?? [],
    accent: group.accent ?? null,
    taxonomy: stage.subjects.map(s => ({
      id: s.id,
      name: s.name,
      nameLocal: s.name_ta,
      aliases: s.aliases,
      topics: s.topics.map(t => ({ id: t.id, name: t.name })),
    })),
    marking: markingFrom(pattern),
    totalQuestions: pattern?.total_attempted ?? pattern?.total_questions ?? null,
    totalMarks: pattern?.total_marks ?? null,
    durationSec: pattern?.duration_minutes != null ? pattern.duration_minutes * 60 : null,
  };
}

/**
 * Marks lost to negative marking.
 *
 * Derived from the configured deduction and the evaluated wrong-answer count —
 * transparent arithmetic over two stored facts, which is what §3 permits. Returns
 * null when the scheme does not apply, when no single deduction describes the
 * paper, or when per-question marks would be needed to attribute it properly.
 */
export function negativeMarkLoss(
  marking: MarkingScheme | null,
  incorrect: number,
): { marks: number; perWrong: number } | null {
  if (!marking?.negativeMarking) return null;
  if (marking.negativeMarkValue == null) return null;
  if (incorrect <= 0) return { marks: 0, perWrong: marking.negativeMarkValue };
  return {
    marks: Math.round(incorrect * marking.negativeMarkValue * 100) / 100,
    perWrong: marking.negativeMarkValue,
  };
}
