/**
 * The official Unit / Category / Sub-category names, and the admin clean-up that moves the bank onto them.
 *
 * The official list is built by the backend from the uploaded question sheets (see TAXONOMY_BACKEND_HANDOFF.md
 * in the backend repo). Every change made here is logged there with the old values and can be undone.
 *
 *   - `syllabusApi.get`  — public: a stage's official units > categories > sub-categories, in syllabus order.
 *   - `taxonomyApi.*`    — admin: every name in use (official or not), preview / apply / undo, and the log.
 */
import { api, publicApi } from './api';
import type { PaginatedResponse } from './adminApi';

// ─── Public: the official list ────────────────────────────────────────────────

export interface SyllabusSubcategory {
  id: string;
  name: string;
  sort_order: number;
}

export interface SyllabusCategory {
  id: string;
  name: string;
  sort_order: number;
  subcategories: SyllabusSubcategory[];
}

export interface SyllabusUnit {
  id: string;
  name: string;
  sort_order: number;
  categories: SyllabusCategory[];
}

export interface Syllabus {
  exam: string;
  stage: string;
  units: SyllabusUnit[];
}

export const syllabusApi = {
  get: (exam: string, stage: string) =>
    publicApi.get<Syllabus>(`/api/v1/syllabus/${encodeURIComponent(exam)}/${encodeURIComponent(stage)}`),
};

/** A unit's official categories, in order. Empty when the unit has none yet (or the list could not be read). */
export function officialCategories(syllabus: Syllabus | null | undefined, unitId: string | null | undefined): SyllabusCategory[] {
  if (!syllabus || !unitId) return [];
  const unit = syllabus.units.find(u => u.id === unitId);
  return unit ? [...unit.categories].sort((a, b) => a.sort_order - b.sort_order) : [];
}

// ─── Admin: names in use ──────────────────────────────────────────────────────

export type TaxonomyLevel = 'unit' | 'category' | 'subcategory';
export type TaxonomyStatus = 'live' | 'retired only' | 'unused';

export interface TaxonomySuggestion {
  name: string;
  id: string;
  score: number;
}

export interface TaxonomyNode {
  /** Null on a name that is not official. */
  id: string | null;
  name: string;
  level: TaxonomyLevel;
  official: boolean;
  question_count: number;
  questions_retired?: number;
  test_count: number;
  attempt_count: number;
  source?: string;
  status?: TaxonomyStatus;
  suggestion?: TaxonomySuggestion | null;
}

export interface TaxonomyCategoryNode extends TaxonomyNode {
  subcategories: TaxonomyNode[];
}

export interface TaxonomyUnitNode extends TaxonomyNode {
  unit_id?: string;
  unit_name?: string;
  categories: TaxonomyCategoryNode[];
}

export interface TaxonomyTree {
  exam: string;
  stage: string;
  units: TaxonomyUnitNode[];
}

// ─── Admin: changes ───────────────────────────────────────────────────────────

export type TaxonomyAction = 'merge' | 'rename' | 'mark_official';

export interface TaxonomyScope {
  exam?: string;
  stage: string;
  unit?: string;
  /** Narrows a sub-category change to one category. */
  category?: string | null;
}

export interface TaxonomyChange {
  action: TaxonomyAction;
  level: TaxonomyLevel;
  from: string;
  /** Merge / rename only. */
  to?: string | null;
  scope: TaxonomyScope;
  note?: string;
}

export interface TaxonomyCounts {
  questions: number;
  tests: number;
  attempts: number;
  topics?: number;
  collections?: number;
  nodes?: number;
  study_plan_rows?: number;
}

export interface TaxonomySample {
  table: string;
  id: string;
  label?: string;
  old: Record<string, unknown>;
  new: Record<string, unknown>;
}

export interface TaxonomyPreview {
  action: TaxonomyAction;
  from: string;
  to: string | null;
  scope: TaxonomyScope;
  counts: TaxonomyCounts;
  samples: TaxonomySample[];
  notes: string[];
  new_official_names: string[];
}

export interface TaxonomyApplied {
  log_id: string;
  counts: TaxonomyCounts;
  notes: string[];
  new_official_names: string[];
}

export interface TaxonomyLogEntry {
  log_id: string;
  action: TaxonomyAction;
  level: TaxonomyLevel;
  from: string;
  to: string | null;
  scope: TaxonomyScope;
  counts: TaxonomyCounts;
  note: string | null;
  admin_id: string | null;
  time: string;
  undone_at: string | null;
  undone_by: string | null;
}

const BASE = '/api/v1/admin/taxonomy';

function query(params: Record<string, string | number | boolean | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') q.set(k, String(v));
  const s = q.toString();
  return s ? `?${s}` : '';
}

export const taxonomyApi = {
  tree: (exam: string, stage: string, includeRetired = false) =>
    api.get<TaxonomyTree>(`${BASE}${query({ exam, stage, include_retired: includeRetired || undefined })}`),
  preview: (change: TaxonomyChange) => api.post<TaxonomyPreview>(`${BASE}/preview`, change),
  apply: (change: TaxonomyChange) => api.post<TaxonomyApplied>(`${BASE}/apply`, change),
  undo: (logId: string) => api.post<TaxonomyLogEntry>(`${BASE}/undo/${encodeURIComponent(logId)}`),
  log: (params: { stage?: string; include_undone?: boolean; page?: number; limit?: number } = {}) =>
    api.get<PaginatedResponse<TaxonomyLogEntry>>(`${BASE}/log${query(params)}`),
};

/** The words an admin sees for an action. */
export const ACTION_LABEL: Record<TaxonomyAction, string> = {
  merge: 'Merge',
  rename: 'Rename',
  mark_official: 'Mark official',
};

/** The backend's refusal codes, said plainly. Anything not listed shows the server's own message. */
export function taxonomyErrorMessage(e: unknown): string {
  const code = (e as { code?: string } | null)?.code;
  switch (code) {
    case 'UNDO_BLOCKED':
      return 'A later change touched the same questions. Undo that one first.';
    case 'ALREADY_UNDONE':
      return 'This change has already been undone.';
    case 'NOTHING_TO_CHANGE':
      return 'Nothing uses that name any more — the list may be out of date. Refresh and try again.';
    case 'SAME_NAME':
      return 'The new name is the same as the old one.';
    case 'NOT_OFFICIAL':
      return 'That name is not on the official list.';
    case 'CATEGORY_NOT_OFFICIAL':
      return 'Pick an official category for this change.';
  }
  return e instanceof Error && e.message ? e.message : 'The change could not be made.';
}
