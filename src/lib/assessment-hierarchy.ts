/**
 * The Assessments tab as the syllabus:
 *
 *   Exam group        TNPSC Group 4
 *     Mock            the full-length mocks — the assessments directly
 *     Key Topics      Subject → Unit → the key-topic assessments
 *     Practice        Subject → Unit → the practice assessments (a whole-subject set sits under its subject)
 *
 * An assessment's place comes from its own TNPSC tag (`track`, `scope`, `unit_id`, `section_name`, `topic_id`).
 * One the tag cannot place — untagged, or naming a unit its stage does not have — is listed as unplaced rather
 * than filed somewhere it was not meant for.
 */
import {
  TNPSC_GROUPS,
  findStage,
  stageUnits,
  subjectForUnit,
  unitDisplayName,
  type TnpscStage,
  type TnpscSyllabusUnit,
} from '@/config/tnpsc';
import { displayTitle } from '@/lib/display-title';
import { groupOfStage, isTagged, readTnpscTag, type TnpscTagValue } from '@/lib/tnpscAdminApi';

type Row = Record<string, any>;

export type AssessmentKind = 'mock' | 'keytopic' | 'practice';

export const KIND_LABEL: Record<AssessmentKind, string> = {
  mock: 'Mock',
  keytopic: 'Key Topics',
  practice: 'Practice',
};

/** Which of the three an assessment is, or null when its tag does not say. */
export function kindOf(tag: TnpscTagValue): AssessmentKind | null {
  if (tag.track === 'mock') return 'mock';
  if (tag.track === 'practice') return tag.scope === 'topic' || !!tag.topic_id ? 'keytopic' : 'practice';
  return null;
}

export interface TreeUnitA {
  unitId: string;
  label: string;
  name: string;
  items: Row[];
}
export interface TreeSectionA {
  name: string;
  units: TreeUnitA[];
  /** Whole-subject sets (a section-scoped paper), which belong to the subject and no particular unit. */
  whole: Row[];
  total: number;
}
export interface TreeGroupA {
  id: string;
  name: string;
  stageId: string | null;
  mock: Row[];
  keyTopics: TreeSectionA[];
  practice: TreeSectionA[];
  total: number;
}
export interface AssessmentTree {
  groups: TreeGroupA[];
  /** The tag does not place these: untagged, or naming something the catalog does not have. */
  unplaced: Row[];
}

/** The stage a group's units are published under — Group 4's written paper. */
/**
 * The unit an assessment sits in, in its own stage's terms.
 *
 * Group 2 shares Group 4's question bank, so a Group 2 assessment can carry the Group 4 id of its unit
 * (`g4-apt-reasoning`) — or, where the server would not take a Group 2 unit, no unit at all. So the id is tried as
 * it is, then as the stage's own twin (`g2-` ⇄ `g4-`), and failing both the title is read: "Reasoning · Mixed" and
 * "Aptitude: Simplification · Mixed" name their unit first.
 */
export function unitForAssessment(
  stage: TnpscStage | undefined,
  unitId: string | null | undefined,
  title?: string | null,
): { unit: TnpscSyllabusUnit; sectionName: string } | undefined {
  const units = stageUnits(stage);
  if (unitId) {
    const tries = [unitId, unitId.replace(/^g4-/, 'g2-'), unitId.replace(/^g2-/, 'g4-')];
    for (const id of tries) {
      const hit = units.find(u => u.unit.id === id);
      if (hit) return hit;
    }
  }
  const head = (displayTitle(title ?? '') || '').split(/\s*[·:]\s*/)[0]?.trim().toLowerCase();
  if (!head) return undefined;
  return units.find(u => u.unit.name.toLowerCase() === head || (u.unit.name_ta ?? '').toLowerCase() === head);
}

function unitStageOf(groupId: string): TnpscStage | undefined {
  return TNPSC_GROUPS.find(g => g.id === groupId)?.stages.find(s => stageUnits(s).length > 0);
}

function sectionsOf(stage: TnpscStage | undefined): TreeSectionA[] {
  return (stage?.pattern?.sections ?? [])
    .filter(sec => (sec.units ?? []).length > 0)
    .map(sec => ({
      name: sec.name,
      units: (sec.units ?? []).map(u => ({ unitId: u.id, label: u.label ?? '', name: unitDisplayName(stage, u), items: [] })),
      whole: [],
      total: 0,
    }));
}

export function buildAssessmentTree(assessments: Row[]): AssessmentTree {
  const groups = new Map<string, TreeGroupA>();
  const unplaced: Row[] = [];

  const groupFor = (id: string): TreeGroupA => {
    let g = groups.get(id);
    if (!g) {
      const stage = unitStageOf(id);
      g = {
        id,
        name: TNPSC_GROUPS.find(x => x.id === id)?.name ?? id,
        stageId: stage?.id ?? null,
        mock: [],
        // Every subject and unit is listed, filled or not, so what is missing is as visible as what is there.
        keyTopics: sectionsOf(stage),
        practice: sectionsOf(stage),
        total: 0,
      };
      groups.set(id, g);
    }
    return g;
  };

  for (const row of assessments) {
    const tag = readTnpscTag(row);
    const kind = tag.stage_id && tag.track ? kindOf(tag) : null;
    const groupId = tag.group_id ?? groupOfStage(tag.stage_id);
    if (!isTagged(tag) || !kind || !groupId || !TNPSC_GROUPS.some(g => g.id === groupId)) {
      unplaced.push(row);
      continue;
    }
    const g = groupFor(groupId);

    if (kind === 'mock') {
      g.mock.push(row);
      g.total += 1;
      continue;
    }

    const sections = kind === 'keytopic' ? g.keyTopics : g.practice;
    // The unit decides the subject; a whole-subject set names its subject itself.
    const stage = findStage(groupId, tag.stage_id ?? undefined)?.stage ?? unitStageOf(groupId);
    const hit = unitForAssessment(stage, tag.unit_id, row.title);
    const sectionName = hit?.sectionName ?? tag.section_name;
    const section = sections.find(s => s.name === sectionName);
    if (!section) {
      unplaced.push(row);
      continue;
    }
    g.total += 1;
    section.total += 1;
    const unit = hit ? section.units.find(u => u.unitId === hit.unit.id) : undefined;
    if (unit) unit.items.push(row);
    else section.whole.push(row);
  }

  // Group 4 is always there, so the structure is on screen before its first assessment.
  groupFor('group-4');
  groupFor('group-2');
  const order = (id: string) => (id === 'group-4' ? -1 : TNPSC_GROUPS.findIndex(g => g.id === id));
  return { groups: [...groups.values()].sort((a, b) => order(a.id) - order(b.id)), unplaced };
}

/**
 * The placement to start a new assessment on, from a spot in the tree — so "add one here" fills the form in
 * rather than asking for what the tree already said.
 */
export type NewAssessmentSeed = Partial<TnpscTagValue>;

export function seedFor(
  groupId: string,
  kind: AssessmentKind,
  at?: { unitId?: string; section?: string },
): NewAssessmentSeed {
  const stage = unitStageOf(groupId);
  const base: NewAssessmentSeed = { group_id: groupId, stage_id: stage?.id ?? null };
  if (kind === 'mock') return { ...base, track: 'mock', level: 'simple' };

  const unit = at?.unitId ? stageUnits(stage).find(u => u.unit.id === at.unitId) : undefined;
  if (unit) {
    return {
      ...base,
      track: 'practice',
      scope: kind === 'keytopic' ? 'topic' : 'unit',
      unit_id: unit.unit.id,
      subject_id: subjectForUnit(stage, unit.unit) ?? null,
    };
  }
  // A whole subject: only Practice has such a set; a key topic always sits in a unit.
  return { ...base, track: 'practice', scope: kind === 'keytopic' ? 'topic' : 'section', section_name: kind === 'keytopic' ? null : at?.section ?? null };
}

/**
 * Where an assessment sits, read off its own tag — group, kind, section and unit — for a list that only has the
 * paper's name. Null when the tag places it nowhere.
 */
export function placementOf(row: Row): { group: string; kind: AssessmentKind; section: string | null; unit: string | null } | null {
  const tag = readTnpscTag(row);
  const kind = tag.stage_id && tag.track ? kindOf(tag) : null;
  const groupId = tag.group_id ?? groupOfStage(tag.stage_id);
  const group = TNPSC_GROUPS.find(g => g.id === groupId);
  if (!kind || !group) return null;
  const stage = findStage(group.id, tag.stage_id ?? undefined)?.stage ?? unitStageOf(group.id);
  const hit = unitForAssessment(stage, tag.unit_id, row.title);
  return {
    group: group.name,
    kind,
    section: hit?.sectionName ?? tag.section_name ?? null,
    unit: hit ? `Unit ${hit.unit.label} · ${unitDisplayName(stage, hit.unit)}` : null,
  };
}

/** The placement as one line: "TNPSC Group 2 · Aptitude & Mental Ability › Unit II · Reasoning". */
export function placementLine(row: Row): string | null {
  const p = placementOf(row);
  if (!p) return null;
  if (p.kind === 'mock') return `${p.group} · Full mock`;
  return [p.group, [p.section, p.unit].filter(Boolean).join(' › ')].filter(Boolean).join(' · ');
}
