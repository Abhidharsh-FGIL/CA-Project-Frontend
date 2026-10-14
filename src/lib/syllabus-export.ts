/**
 * A stage's published syllabus as plain data — what a backend can load.
 *
 * The study plan is built on the server, from the server's own subject list, and
 * that list is not the commission's syllabus: it schedules "Physics" and "Botany"
 * where the paper prints units and the topics under them. Handing the server this
 * file lets it plan from what is actually printed, with the same ids the portal
 * already uses for `unit_id` and `topic_id`.
 *
 * The file is written from the catalog, never by hand. A test compares it to the
 * catalog, so the two cannot drift.
 */
import { subjectForUnit, type TnpscStage } from '@/config/tnpsc';

export interface ExportedTopic {
  id: string;
  name: string;
}

export interface ExportedSubject {
  id: string;
  name: string;
  name_ta: string | null;
  topics: ExportedTopic[];
}

export interface ExportedUnit {
  id: string;
  /** The numeral as printed, e.g. "IV". */
  label: string | null;
  name: string;
  name_ta: string | null;
  /** Questions this unit carries in the real paper. */
  questions: number;
  /**
   * The subjects this unit sits under. A paper is tagged with a subject *and* a unit,
   * and the server checks that the unit covers the subject — so a unit whose subject
   * the server has never heard of cannot be placed.
   */
  subject_ids: string[];
  topics: ExportedTopic[];
}

export interface ExportedSection {
  name: string;
  questions: number;
  /** Set on a language paper that is sat instead of another — never both. */
  alternative_to: string | null;
  units: ExportedUnit[];
}

export interface ExportedSyllabus {
  stage_id: string;
  stage_name: string;
  source: string;
  total_questions: number;
  /** Every subject of the stage. Papers are tagged against these slugs. */
  subjects: ExportedSubject[];
  sections: ExportedSection[];
}

export function exportStageSyllabus(stage: TnpscStage, source: string): ExportedSyllabus {
  return {
    stage_id: stage.id,
    stage_name: stage.name,
    source,
    total_questions: stage.pattern?.total_questions ?? 0,
    subjects: stage.subjects.map(sub => ({
      id: sub.id,
      name: sub.name,
      name_ta: sub.name_ta ?? null,
      topics: sub.topics.map(t => ({ id: t.id, name: t.name })),
    })),
    sections: (stage.pattern?.sections ?? []).map(sec => ({
      name: sec.name,
      questions: sec.questions,
      alternative_to: sec.alternative_to ?? null,
      units: (sec.units ?? []).map(u => ({
        id: u.id,
        label: u.label ?? null,
        name: u.name,
        name_ta: u.name_ta ?? null,
        questions: u.questions,
        subject_ids: u.subject_ids?.length
          ? [...u.subject_ids]
          : [subjectForUnit(stage, u)].filter((id): id is string => !!id),
        topics: (u.topics ?? []).map(t => ({ id: t.id, name: t.name })),
      })),
    })),
  };
}
