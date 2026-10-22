/**
 * The Collections tab as the syllabus:
 *
 *   Exam group      TNPSC Group 4
 *   Subject         General Tamil / General English / General Studies / Aptitude & Mental Ability
 *   Unit            the published units under each subject
 *   Collections     the question sets filed under that unit
 *
 * Where a collection sits is read, in order, from:
 *   1. the placement the server stored on it (`stage_id`, `unit_id`, `section_name`, or the same under a
 *      `tnpsc_` prefix, or nested in `placement`) — the only source that is always right;
 *   2. the name it was saved under (`Unit_4_Tamil_50Q_Hard`, `TNPSC-G2-English-Unit-6-…`), which is a fallback
 *      and only when the name settles it;
 * and a collection neither settles is listed as unassigned, for an admin to place by hand, rather than guessed at.
 */
import { TNPSC_GROUPS, stageUnits, unitDisplayName, type TnpscGroup, type TnpscStage, type TnpscSyllabusUnit } from '@/config/tnpsc';
import { parseCollectionTitle } from '@/lib/collection-unit';
import { PRIMARY_EXAM_ID } from '@/lib/exam-listing';

type Paper = Record<string, any>;

export interface CollectionPlace {
  groupId: string | null;
  stageId: string | null;
  section: string | null;
  unitId: string | null;
  /** How it was worked out; null when it could not be. */
  via: 'placement' | 'name' | null;
}

const NOWHERE: CollectionPlace = { groupId: null, stageId: null, section: null, unitId: null, via: null };

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);

/** The stages that publish units — the only ones a collection can be filed under. */
const STAGES_WITH_UNITS: Array<{ group: TnpscGroup; stage: TnpscStage }> = TNPSC_GROUPS.flatMap(group =>
  group.stages.filter(stage => stageUnits(stage).length > 0).map(stage => ({ group, stage })),
);

const stageById = (id: string | null) => STAGES_WITH_UNITS.find(s => s.stage.id === id) ?? null;

/** "TNPSC-G2-English-Unit-6" → group-2. Only a group that exists in the catalog. */
function groupFromName(title: string): string | null {
  const m = title.toLowerCase().match(/(?:^|[^a-z0-9])g(?:roup)?[\s_-]*(\d)(?![0-9])/);
  if (!m) return null;
  const id = `group-${m[1]}`;
  return TNPSC_GROUPS.some(g => g.id === id) ? id : null;
}

/** The placement a collection row carries, in any of the spellings the backend may use. */
export function storedPlacement(paper: Paper): { stageId: string | null; unitId: string | null; section: string | null; groupId: string | null } {
  const nested = paper?.placement ?? {};
  return {
    groupId: str(paper?.group_id) ?? str(paper?.tnpsc_group_id) ?? str(nested.groupId) ?? str(nested.group_id),
    stageId: str(paper?.stage_id) ?? str(paper?.tnpsc_stage_id) ?? str(nested.stageId) ?? str(nested.stage_id),
    unitId: str(paper?.unit_id) ?? str(paper?.tnpsc_unit_id) ?? str(nested.unitId) ?? str(nested.unit_id),
    section: str(paper?.section_name) ?? str(paper?.tnpsc_section_name) ?? str(paper?.section),
  };
}

export function placeCollection(paper: Paper): CollectionPlace {
  const stored = storedPlacement(paper);

  // 1. What the server stored.
  const found = stageById(stored.stageId) ?? (stored.unitId ? STAGES_WITH_UNITS.find(s => stageUnits(s.stage).some(u => u.unit.id === stored.unitId)) ?? null : null);
  if (found) {
    const hit = stageUnits(found.stage).find(u => u.unit.id === stored.unitId);
    if (hit) return { groupId: found.group.id, stageId: found.stage.id, section: hit.sectionName, unitId: hit.unit.id, via: 'placement' };
    const sections = found.stage.pattern?.sections ?? [];
    const section = stored.section && sections.some(s => s.name === stored.section) ? stored.section : null;
    // A stage with no unit or section: filed under the group, with nowhere finer to go.
    return { groupId: found.group.id, stageId: found.stage.id, section, unitId: null, via: 'placement' };
  }

  // 2. What the name says — only when it says one unit of one paper.
  const title = str(paper?.title) ?? str(paper?.name);
  if (title) {
    const hint = groupFromName(title);
    const candidates = STAGES_WITH_UNITS.filter(s => !hint || s.group.id === hint);
    const hits = candidates
      .map(s => ({ s, unitId: parseCollectionTitle(s.stage, title).unitId }))
      .filter((x): x is { s: (typeof candidates)[number]; unitId: string } => !!x.unitId);
    // Group 2 shares Group 4's unit names, so a bare "Unit_4_Tamil_50Q" parses under both. A name that does
    // not say which exam is a Group 4 collection — it was the only exam when the name was written — so the
    // primary exam wins a tie. A name that names Group 2 never reaches here with Group 4 in the running.
    const primary = hits.filter(x => x.s.group.id === PRIMARY_EXAM_ID);
    const pick = hits.length === 1 ? hits : !hint && primary.length === 1 ? primary : [];
    if (pick.length === 1) {
      const { s, unitId } = pick[0];
      const hit = stageUnits(s.stage).find(u => u.unit.id === unitId)!;
      return { groupId: s.group.id, stageId: s.stage.id, section: hit.sectionName, unitId, via: 'name' };
    }
  }
  return NOWHERE;
}

export interface TreeUnit {
  unitId: string;
  label: string;
  name: string;
  papers: Paper[];
}
export interface TreeSection {
  name: string;
  units: TreeUnit[];
  /** Collections known to be in this subject but not in a particular unit. */
  loose: Paper[];
  total: number;
}
export interface TreeGroup {
  id: string;
  name: string;
  sections: TreeSection[];
  /** Collections known to be in this exam but not in a subject. */
  loose: Paper[];
  total: number;
}
export interface CollectionTree {
  groups: TreeGroup[];
  /** Neither the server nor the name says where these go. */
  unassigned: Paper[];
  /** Manually added questions — not a paper, so not placed. */
  custom: Paper[];
}

export function buildCollectionTree(papers: Paper[], isCustom: (p: Paper) => boolean = () => false): CollectionTree {
  const groups = new Map<string, TreeGroup>();
  const unassigned: Paper[] = [];
  const custom: Paper[] = [];

  const groupFor = (groupId: string): TreeGroup => {
    let g = groups.get(groupId);
    if (!g) {
      const group = TNPSC_GROUPS.find(x => x.id === groupId)!;
      const stage = STAGES_WITH_UNITS.find(s => s.group.id === groupId)?.stage;
      // Every subject and unit the stage publishes is shown, empty or not: an admin looks here to see what is missing.
      const sections: TreeSection[] = (stage?.pattern?.sections ?? []).map(sec => ({
        name: sec.name,
        units: (sec.units ?? []).map((u: TnpscSyllabusUnit) => ({
          unitId: u.id,
          label: u.label ?? '',
          name: unitDisplayName(stage, u),
          papers: [],
        })),
        loose: [],
        total: 0,
      }));
      g = { id: groupId, name: group.name, sections, loose: [], total: 0 };
      groups.set(groupId, g);
    }
    return g;
  };

  for (const paper of papers) {
    if (isCustom(paper)) {
      custom.push(paper);
      continue;
    }
    const place = placeCollection(paper);
    if (!place.groupId) {
      unassigned.push(paper);
      continue;
    }
    const g = groupFor(place.groupId);
    g.total += 1;
    const sec = g.sections.find(s => s.name === place.section);
    if (!sec) {
      g.loose.push(paper);
      continue;
    }
    sec.total += 1;
    const unit = sec.units.find(u => u.unitId === place.unitId);
    if (unit) unit.papers.push(paper);
    else sec.loose.push(paper);
  }

  // The exams a student can sit first, then any other that has collections. Group 4 leads: it is the live one.
  const order = (id: string) => (id === 'group-4' ? -1 : TNPSC_GROUPS.findIndex(g => g.id === id));
  // Group 4 is always shown, even before its first collection, so the structure is there to fill.
  groupFor('group-4');
  groupFor('group-2');
  return {
    groups: [...groups.values()].sort((a, b) => order(a.id) - order(b.id)),
    unassigned,
    custom,
  };
}

/** The units an admin can choose from for a group: its stage's sections, each with its units. */
export function unitChoices(groupId: string | null): Array<{ stageId: string; section: string; units: Array<{ id: string; label: string; name: string }> }> {
  const found = STAGES_WITH_UNITS.find(s => s.group.id === groupId);
  if (!found) return [];
  return (found.stage.pattern?.sections ?? [])
    .filter(sec => (sec.units ?? []).length > 0)
    .map(sec => ({
      stageId: found.stage.id,
      section: sec.name,
      units: (sec.units ?? []).map((u: TnpscSyllabusUnit) => ({ id: u.id, label: u.label ?? '', name: unitDisplayName(found.stage, u) })),
    }));
}

/** The exams that publish units, for the "assign" picker. */
export const placeableGroups = (): Array<{ id: string; name: string }> =>
  [...new Map(STAGES_WITH_UNITS.map(s => [s.group.id, { id: s.group.id, name: s.group.name }])).values()];
