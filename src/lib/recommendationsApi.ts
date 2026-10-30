/**
 * "What to practise next" — the backend's personalised picks for one exam stage.
 *
 * The backend chooses by rules (mastery per unit / category, exam weight, time since practised) and ties every
 * pick to a real test; the AI only words the reason and the tip, from the numbers. See the backend's
 * recommendations handoff for the maths.
 */
import { userApi } from './api';
import { unitNameForId } from '@/config/tnpsc';

export type RecommendationType = 'fix_weak' | 'start_new' | 'revise' | 'level_up' | 'full_mock';
export type RecommendationStatus = 'ready' | 'computing' | 'not_enough_data';
export type RecommendationFeedback = 'started' | 'dismissed' | 'already_know';

export interface RecommendationMastery {
  score: number | null;
  accuracy: number | null;
  attempted: number;
  correct: number;
  trend: number | null;
  last_practised_at: string | null;
  level: string | null;
}

export interface RecommendationTarget {
  kind: 'key_topic_test' | 'unit_practice' | 'mock' | string;
  test_id: string;
  level: string | null;
  question_count: number | null;
  est_minutes: number | null;
  is_locked: boolean;
  lock_reason: string | null;
  title?: string | null;
  /** Set when the test is a legacy one that opens through the test flow rather than the assessment flow. */
  source?: 'assessment' | 'test';
}

export interface Recommendation {
  rec_id: string;
  type: RecommendationType;
  priority: number;
  unit: { id: string; name: string; label?: string | null } | null;
  category: { id: string | null; name: string } | null;
  /** The weakest sub-category inside the category, when there is one: what to focus on within the test. */
  subcategory: { id: string | null; name: string; mastery?: number | null } | null;
  mastery: RecommendationMastery | null;
  target: RecommendationTarget;
  reason: string;
  tip: string | null;
  reason_source: 'ai' | 'template';
}

export interface WeakMapCategory {
  id: string | null;
  name: string;
  mastery: number | null;
  attempted: number;
}

export interface WeakMapUnit {
  unit_id: string;
  unit_name: string;
  label?: string | null;
  mastery: number | null;
  categories: WeakMapCategory[];
}

export interface Improvement {
  category: string;
  category_id?: string;
  unit_id?: string;
  from: number;
  to: number;
  since: string;
}

/**
 * Which tests the picks were made from: the last 15 days; those topped up to the last 5 when the 15 days held too
 * few; the last 5 when nothing was taken in 15 days; or none at all (a new user).
 */
export type RecommendationBasis = 'last_15_days' | 'last_15_days_plus' | 'last_5_tests' | 'new';

export interface Recommendations {
  status: RecommendationStatus;
  generated_at: string | null;
  /** Null on a result stored before the backend began sending it. */
  basis?: RecommendationBasis | null;
  window_days?: number;
  /** The number of tests the picks were made from (same as `based_on_attempts`). */
  attempts_used?: number;
  window_start?: string | null;
  /** The user's latest finished test, of any date. */
  last_attempt_at?: string | null;
  based_on_attempts: number;
  readiness: { score: number | null; sections: Array<{ name: string; score: number | null; questions?: number }> } | null;
  items: Recommendation[];
  weak_map: WeakMapUnit[];
  improved: Improvement[];
}

export const recommendationsApi = {
  get: (exam: string, stage: string) =>
    userApi.get<Recommendations>(
      `/api/v1/user/recommendations?exam=${encodeURIComponent(exam)}&stage=${encodeURIComponent(stage)}`,
    ),
  /** Answers with the refreshed picks (`recommendations`), the dismissed one replaced by the next. */
  feedback: (exam: string, stage: string, recId: string, action: RecommendationFeedback) =>
    userApi.post<{ ok: boolean; recommendations?: Recommendations }>(
      `/api/v1/user/recommendations/${encodeURIComponent(recId)}/feedback?exam=${encodeURIComponent(exam)}&stage=${encodeURIComponent(stage)}`,
      { action },
    ),
};

/** Where a pick's Start button goes: the test itself, or the plans page when it is locked. */
export function recommendationHref(r: Recommendation): string {
  if (r.target.is_locked) return '/user/subscription';
  return r.target.source === 'test' ? `/user/test/${r.target.test_id}/start` : `/user/assessment/${r.target.test_id}`;
}

/** Why a pick was chosen, in plain words. */
export const TYPE_LABEL: Record<RecommendationType, string> = {
  fix_weak: 'Needs practice',
  start_new: 'Try something new',
  revise: 'Time to revise',
  level_up: 'Go a level harder',
  full_mock: 'Take a full mock',
};

/** What a pick covers: one Key Topic of a unit, a whole unit, or a full mock exam. */
export type RecommendationKind = 'topic' | 'unit' | 'mock';

export function recommendationKind(r: Recommendation): RecommendationKind {
  if (r.type === 'full_mock' || r.target.kind === 'mock_test' || r.target.kind === 'mock') return 'mock';
  if (r.category || r.target.kind === 'key_topic_test') return 'topic';
  return 'unit';
}

export const KIND_LABEL: Record<RecommendationKind, string> = {
  topic: 'Key topic',
  unit: 'Whole unit',
  mock: 'Full mock',
};

/** The band a mastery score falls in, for colour: under 40 weak, under 70 building, else strong. */
export function masteryBand(score: number | null | undefined): 'none' | 'weak' | 'building' | 'strong' {
  if (score == null) return 'none';
  if (score < 40) return 'weak';
  if (score < 70) return 'building';
  return 'strong';
}

/**
 * A unit's name as the rest of the app shows it. The backend sends the English name; the Tamil paper's units are
 * printed in Tamil by the commission ("இலக்கணம்", not "Grammar"), and that also tells them apart from the English
 * paper's units of the same name. So the unit is looked up by id, and the backend's name is only the fallback.
 */
export function displayUnitName(id: string | null | undefined, fallback: string): string {
  return unitNameForId(id) ?? fallback;
}

/**
 * Where a pick sits, under its heading. A Key Topic names its unit ("Unit I · Aptitude"); a whole unit is already
 * named by its heading, so it only gives the unit's number; a mock gives its own title.
 */
export function recommendationPlace(r: Recommendation): string {
  if (!r.unit) return r.target.title ?? '';
  const label = r.unit.label ? `Unit ${r.unit.label}` : '';
  if (recommendationKind(r) === 'unit') return label;
  return `${label ? `${label} · ` : ''}${displayUnitName(r.unit.id, r.unit.name)}`;
}

/** The heading of a pick: the category its test covers, else the unit. The sub-category is shown as its focus. */
export function recommendationTitle(r: Recommendation): string {
  if (r.type === 'full_mock') return 'Full mock test';
  return r.category?.name ?? (r.unit ? displayUnitName(r.unit.id, r.unit.name) : 'Practice');
}

/** One plain line saying which tests the picks came from, for the header. */
export function basisLine(d: Pick<Recommendations, 'status' | 'basis' | 'window_days' | 'attempts_used' | 'based_on_attempts'>): string {
  const n = d.attempts_used ?? d.based_on_attempts ?? 0;
  const tests = `${n} test${n === 1 ? '' : 's'}`;
  const days = d.window_days ?? 15;
  switch (d.basis) {
    case 'last_15_days':
      return `Based on your ${tests} in the last ${days} days`;
    case 'last_15_days_plus':
      return `Based on your last ${tests} (few in the last ${days} days)`;
    case 'last_5_tests':
      return `No test in the last ${days} days, so based on your last ${tests}`;
    case 'new':
      return 'You are new here. Start with these topics, then take a test.';
    default:
      // An older stored result, from before the backend said which tests it used.
      return d.status === 'not_enough_data' ? 'Take a few tests and these picks will be made just for you.' : `Based on your last ${tests}`;
  }
}

/** Test ids the aspirant is being pointed to — for the "Recommended for you" badge elsewhere. */
export function recommendedTestIds(data: Recommendations | null | undefined): Set<string> {
  return new Set((data?.items ?? []).filter(r => !r.target.is_locked).map(r => r.target.test_id));
}
