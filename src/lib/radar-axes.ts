/**
 * How many spokes a proficiency radar can carry and still be read, and the grouping used past that.
 *
 * A radar has one spoke per unit, and an RRB NTPC paper has 52: their names ran into each other until the chart was
 * a ring of overlapping words. Past `MAX_RADAR_AXES` the report draws every unit as a bar instead, under the section
 * of the paper it sits in ("General Awareness", "Mathematics", …) — nothing is dropped or merged.
 */
import { TNPSC_GROUPS, stageUnits } from '@/config/tnpsc';
import type { AttemptReportModel } from '@/lib/attempt-report';

/** The most spokes a radar is drawn with; a paper with 18 or more units gets bars instead. */
export const MAX_RADAR_AXES = 17;

export type RadarRow = AttemptReportModel['radar'][number];

export interface RadarSection {
  /** The paper's section, or null for the units no section claims. */
  name: string | null;
  rows: RadarRow[];
  correct: number;
  questions: number;
}

let sectionOfUnit: Map<string, string> | null = null;

/** The section of its paper a unit sits in, by unit id ("n1-current-events" → "General Awareness"). */
function sectionFor(subjectId: string): string | null {
  if (!sectionOfUnit) {
    sectionOfUnit = new Map();
    for (const group of TNPSC_GROUPS) {
      for (const stage of group.stages) {
        for (const { unit, sectionName } of stageUnits(stage)) if (!sectionOfUnit.has(unit.id)) sectionOfUnit.set(unit.id, sectionName);
      }
    }
  }
  return sectionOfUnit.get(subjectId.replace(/^unit:/, '')) ?? null;
}

/**
 * Every row, grouped by section in the order the sections first appear, each row keeping its place in the paper.
 * Units no section claims are gathered last under a null name; when none is claimed there is one group, unnamed.
 */
export function radarSections(radar: RadarRow[]): RadarSection[] {
  const groups = new Map<string | null, RadarRow[]>();
  for (const r of radar) {
    const name = sectionFor(r.subjectId);
    groups.set(name, [...(groups.get(name) ?? []), r]);
  }
  const loose = groups.get(null);
  groups.delete(null);
  if (loose) groups.set(null, loose);
  return [...groups].map(([name, rows]) => ({
    name,
    rows,
    correct: rows.reduce((n, r) => n + r.correct, 0),
    questions: rows.reduce((n, r) => n + r.questions, 0),
  }));
}
